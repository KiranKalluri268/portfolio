import {
  BAKE_FRAGMENT,
  COMPOSITE_FRAGMENT,
  DISK_FRAGMENT,
  FINAL_FRAGMENT,
  FULLSCREEN_VERTEX,
  HIGH_PASS_FRAGMENT,
  MAX_DIM_RECTS,
  blurFragment,
} from "./shaders";

/** Where the camera sits, in the cinematic's units: the horizon is radius 1
 *  and the disk runs from 2 to 6. */
export interface BlackholeCamera {
  distance: number;
  /** Above the disk plane. The cinematic's observer is never below it. */
  elevationDeg: number;
  /** About the view axis. */
  rollDeg: number;
  /** Vertical field of view. */
  fovDeg: number;
  /** The cinematic's compose shift: where the black hole sits in the frame, in
   *  half-screens from the middle, x a fraction of the width, y up. */
  shift: [number, number];
}

export interface BakedBlackholeOptions {
  camera: BlackholeCamera;
  /** The cinematic's UnrealBloomPass values for the frame being matched. */
  bloom: { strength: number; radius: number; threshold: number };
  diskTint?: [number, number, number];
  exposure?: number;
}

/** Where the canvas sits on screen and the text it should dim behind, all in
 *  CSS pixels. */
export interface BlackholeDimming {
  /** The canvas's top-left corner. */
  origin: [number, number];
  size: [number, number];
  /** Screen rectangles as left, top, right, bottom, then the corner radius
   *  and the half-width of the soft edge on the outline. At most
   *  MAX_DIM_RECTS. */
  rects: [number, number, number, number, number, number][];
  /** What is left of the light behind text, from 0 to 1. */
  floor: number;
}

export interface BakedBlackhole {
  /** Size in device pixels. Re-runs the bake when it changes. */
  resize(width: number, height: number): void;
  /** Moves the camera. The black hole keeps drawing from the last finished
   *  bake, scaled toward the new distance, while the exact one is integrated
   *  behind it; it swaps in as soon as it is complete. */
  setCamera(camera: BlackholeCamera): void;
  /** Advances any bake by one strip and draws a frame once there is a finished
   *  bake to draw from. Returns true when a frame was drawn. */
  render(timeSeconds: number): boolean;
  /** Dims the black hole behind the given text from the next frame on. */
  setDimming(dimming: BlackholeDimming | null): void;
  /** 0 to 1, for the first bake. */
  readonly bakeProgress: number;
  /** True while a bake is still being integrated — for the first frame, or a
   *  camera that has moved. Frames need drawing until it lands. */
  readonly busy: boolean;
  /** Bytes of GPU memory the bakes hold right now. */
  readonly bakeBytes: number;
  dispose(): void;
}

/** RGBA32UI plus R32UI: five 32-bit words a pixel. */
const BYTES_PER_BAKED_PIXEL = 20;

/** Where each strip's size starts, and the bounds it adapts within. A strip is
 *  sized to the frame budget: grown while frames keep their pace, cut back as
 *  soon as one runs long, so a slow GPU bakes in small pieces rather than
 *  stalling the page, and a fast one finishes a re-bake in a frame or two.
 *
 *  The ceiling is a third of a desktop frame because a pixel's cost is not
 *  fixed: far out most rays leave in a few steps, close in they wind round the
 *  hole for hundreds. A strip grown on the cheap rays at the top of the page
 *  cost 100ms in one frame near the bottom before the budget could cut it. */
const STRIP_PIXELS = { start: 120_000, min: 16_000, max: 400_000 };
const FRAME_BUDGET_MS = { grow: 18, shrink: 24 };

/** How long the camera has to sit still before the spare bake is let go. It is
 *  only needed while something is moving. */
const SPARE_RELEASE_MS = 2_000;

const BLOOM_KERNELS = [3, 5, 7, 9, 11];

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Black hole shader failed to compile: ${log}`);
  }
  return shader;
}

function program(gl: WebGL2RenderingContext, fragment: string) {
  const p = gl.createProgram()!;
  const vs = compile(gl, gl.VERTEX_SHADER, FULLSCREEN_VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, "position");
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`Black hole program failed to link: ${gl.getProgramInfoLog(p)}`);
  }
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  const u = (name: string) => {
    if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(p, name));
    return uniforms.get(name)!;
  };
  return { p, u };
}

type Program = ReturnType<typeof program>;

interface Target {
  fbo: WebGLFramebuffer;
  textures: WebGLTexture[];
  width: number;
  height: number;
}

interface Bake {
  target: Target;
  camera: BlackholeCamera;
  rows: number;
}

const sameCamera = (a: BlackholeCamera, b: BlackholeCamera) =>
  a.distance === b.distance &&
  a.elevationDeg === b.elevationDeg &&
  a.rollDeg === b.rollDeg &&
  a.fovDeg === b.fovDeg &&
  a.shift[0] === b.shift[0] &&
  a.shift[1] === b.shift[1];

/** Camera vectors the way the cinematic's Observer builds them, at orbit
 *  angle 0: on the +z side, raised by the elevation, looking at the origin. */
export function cameraVectors({ distance, elevationDeg, rollDeg }: BlackholeCamera) {
  const e = (elevationDeg * Math.PI) / 180;
  const position = [0, distance * Math.sin(e), distance * Math.cos(e)];
  const dir = position.map((v) => -v / distance);
  // World up made square to the view, then turned about it by the roll.
  const worldUp = [0, 1, 0];
  const dot = worldUp[0] * dir[0] + worldUp[1] * dir[1] + worldUp[2] * dir[2];
  let up = worldUp.map((v, i) => v - dot * dir[i]);
  const len = Math.hypot(up[0], up[1], up[2]);
  up = up.map((v) => v / len);
  const right = [
    dir[1] * up[2] - dir[2] * up[1],
    dir[2] * up[0] - dir[0] * up[2],
    dir[0] * up[1] - dir[1] * up[0],
  ];
  const r = (rollDeg * Math.PI) / 180;
  up = up.map((v, i) => v * Math.cos(r) + right[i] * Math.sin(r));
  // The cinematic's Observer is always in orbit, and at orbit angle 0 its
  // velocity is (-cos(elevation) * angularVelocity, 0, 0) — written as it is
  // there, angular velocity standing in for speed — with angularVelocity at its
  // orbital ceiling, 1 / sqrt(2(r - 1)) / r. Negligible far out; about 0.04 at
  // the closest the home page comes, distance 7.
  const angularVelocity = 1 / Math.sqrt(2 * (distance - 1)) / distance;
  const velocity = [-Math.cos(e) * angularVelocity, 0, 0];
  return { position, dir, up, velocity };
}

/** Null when this browser cannot run it — no WebGL2, or a shader the driver
 *  rejects. The caller keeps the video in that case. */
export function createBakedBlackhole(
  canvas: HTMLCanvasElement,
  diskImage: TexImageSource,
  options: BakedBlackholeOptions,
): BakedBlackhole | null {
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return null;

  let programs: {
    bake: Program;
    disk: Program;
    highPass: Program;
    blurs: Program[];
    composite: Program;
    final: Program;
  };
  try {
    programs = {
      bake: program(gl, BAKE_FRAGMENT),
      disk: program(gl, DISK_FRAGMENT),
      highPass: program(gl, HIGH_PASS_FRAGMENT),
      blurs: BLOOM_KERNELS.map((k) => program(gl, blurFragment(k))),
      composite: program(gl, COMPOSITE_FRAGMENT),
      final: program(gl, FINAL_FRAGMENT),
    };
  } catch (error) {
    console.error(error);
    return null;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // three.js loads textures flipped and unpremultiplied, with no colour-space
  // conversion in r148's linear pipeline. Matched, or the disk samples land
  // upside down and a shade off.
  const disk = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, disk);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, diskImage);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  type Format = "bake" | "color";

  function createTarget(width: number, height: number, format: Format): Target {
    const fbo = gl!.createFramebuffer()!;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
    // Integer bake targets are only ever texelFetched; colour ones are
    // filtered the way three's render targets are.
    const layers =
      format === "bake"
        ? [
            { internal: gl!.RGBA32UI, format: gl!.RGBA_INTEGER, type: gl!.UNSIGNED_INT, filter: gl!.NEAREST },
            { internal: gl!.R32UI, format: gl!.RED_INTEGER, type: gl!.UNSIGNED_INT, filter: gl!.NEAREST },
          ]
        : [{ internal: gl!.RGBA8, format: gl!.RGBA, type: gl!.UNSIGNED_BYTE, filter: gl!.LINEAR }];
    const textures = layers.map((layer, i) => {
      const texture = gl!.createTexture()!;
      gl!.bindTexture(gl!.TEXTURE_2D, texture);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, layer.internal, width, height, 0, layer.format, layer.type, null);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, layer.filter);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, layer.filter);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0 + i, gl!.TEXTURE_2D, texture, 0);
      return texture;
    });
    gl!.drawBuffers(textures.map((_, i) => gl!.COLOR_ATTACHMENT0 + i));
    return { fbo, textures, width, height };
  }

  function deleteTarget(target: Target | null | undefined) {
    if (!target) return;
    gl!.deleteFramebuffer(target.fbo);
    for (const texture of target.textures) gl!.deleteTexture(texture);
  }

  let width = 0;
  let height = 0;
  let camera = options.camera;
  /** What is on screen. Null until the first bake completes. */
  let front: Bake | null = null;
  /** Being integrated: the first bake, or the next camera's. */
  let back: Bake | null = null;
  /** A finished-with bake kept for reuse while the camera is moving. */
  let spare: Target | null = null;
  let stillSince = performance.now();
  let scene: Target | null = null;
  let bright: Target | null = null;
  let horizontal: Target[] = [];
  let vertical: Target[] = [];
  let stripPixels = STRIP_PIXELS.start;
  let lastRender = 0;

  function freeBakes() {
    deleteTarget(front?.target);
    deleteTarget(back?.target);
    deleteTarget(spare);
    front = null;
    back = null;
    spare = null;
  }

  function resize(nextWidth: number, nextHeight: number) {
    nextWidth = Math.max(1, Math.round(nextWidth));
    nextHeight = Math.max(1, Math.round(nextHeight));
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    canvas.width = width;
    canvas.height = height;

    freeBakes();
    deleteTarget(scene);
    deleteTarget(bright);
    horizontal.forEach(deleteTarget);
    vertical.forEach(deleteTarget);

    back = { target: createTarget(width, height, "bake"), camera, rows: 0 };
    scene = createTarget(width, height, "color");
    // UnrealBloomPass.setSize: half size, then halving per mip.
    let rx = Math.round(width / 2);
    let ry = Math.round(height / 2);
    bright = createTarget(rx, ry, "color");
    horizontal = [];
    vertical = [];
    for (let i = 0; i < BLOOM_KERNELS.length; i++) {
      horizontal.push(createTarget(Math.max(1, rx), Math.max(1, ry), "color"));
      vertical.push(createTarget(Math.max(1, rx), Math.max(1, ry), "color"));
      rx = Math.round(rx / 2);
      ry = Math.round(ry / 2);
    }
  }

  function bind(target: Target | null) {
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, target ? target.fbo : null);
    gl!.viewport(0, 0, target ? target.width : width, target ? target.height : height);
  }

  function texture(unit: number, tex: WebGLTexture, location: WebGLUniformLocation | null) {
    gl!.activeTexture(gl!.TEXTURE0 + unit);
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.uniform1i(location, unit);
  }

  function draw() {
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
  }

  function bakeStrip(bake: Bake) {
    const rows = Math.max(1, Math.floor(stripPixels / width));
    const { position, dir, up, velocity } = cameraVectors(bake.camera);
    const { p, u } = programs.bake;
    bind(bake.target);
    gl!.useProgram(p);
    gl!.uniform2f(u("resolution"), width, height);
    gl!.uniform3fv(u("cam_pos"), position);
    gl!.uniform3fv(u("cam_dir"), dir);
    gl!.uniform3fv(u("cam_up"), up);
    gl!.uniform3fv(u("cam_vel"), velocity);
    gl!.uniform1f(u("fov"), bake.camera.fovDeg);
    gl!.uniform2fv(u("compose_shift"), bake.camera.shift);
    gl!.enable(gl!.SCISSOR_TEST);
    gl!.scissor(0, bake.rows, width, Math.min(rows, height - bake.rows));
    draw();
    gl!.disable(gl!.SCISSOR_TEST);
    bake.rows = Math.min(height, bake.rows + rows);
  }

  /** Swaps a finished bake in, and starts the next one if the camera has moved
   *  on since it began. */
  function advanceBakes(now: number) {
    if (back && back.rows >= height) {
      if (front) spare = front.target;
      front = back;
      back = null;
    }
    if (!back && front && !sameCamera(front.camera, camera)) {
      back = { target: spare ?? createTarget(width, height, "bake"), camera, rows: 0 };
      spare = null;
    }
    if (back) {
      stillSince = now;
      bakeStrip(back);
    } else if (spare && now - stillSince > SPARE_RELEASE_MS) {
      deleteTarget(spare);
      spare = null;
    }
  }

  const tint = options.diskTint ?? [1, 1, 1];
  const exposure = options.exposure ?? 1;

  function drawFrame(timeSeconds: number, shown: Bake) {
    // Disk, into the clamped RGBA8 target the cinematic's composer renders to.
    {
      const { p, u } = programs.disk;
      bind(scene);
      gl!.useProgram(p);
      texture(0, shown.target.textures[0], u("bakeWords"));
      texture(1, shown.target.textures[1], u("bakeLastWord"));
      texture(2, disk, u("disk_texture"));
      const turn = timeSeconds / (2 * Math.PI);
      gl!.uniform1f(u("turn"), turn - Math.floor(turn));
      gl!.uniform3fv(u("disk_tint"), tint);
      gl!.uniform1f(u("exposure"), exposure);
      draw();
    }

    // Bloom.
    {
      const { p, u } = programs.highPass;
      bind(bright);
      gl!.useProgram(p);
      texture(0, scene!.textures[0], u("tDiffuse"));
      gl!.uniform1f(u("luminosityThreshold"), options.bloom.threshold);
      gl!.uniform1f(u("smoothWidth"), 0.01);
      draw();
    }
    let input = bright!;
    for (let i = 0; i < BLOOM_KERNELS.length; i++) {
      const { p, u } = programs.blurs[i];
      gl!.useProgram(p);
      gl!.uniform2f(u("texSize"), horizontal[i].width, horizontal[i].height);
      bind(horizontal[i]);
      texture(0, input.textures[0], u("colorTexture"));
      gl!.uniform2f(u("direction"), 1, 0);
      draw();
      bind(vertical[i]);
      texture(0, horizontal[i].textures[0], u("colorTexture"));
      gl!.uniform2f(u("direction"), 0, 1);
      draw();
      input = vertical[i];
    }
    {
      const { p, u } = programs.composite;
      bind(horizontal[0]);
      gl!.useProgram(p);
      vertical.forEach((target, i) => texture(i, target.textures[0], u(`blurTexture${i + 1}`)));
      gl!.uniform1f(u("bloomStrength"), options.bloom.strength);
      gl!.uniform1f(u("bloomRadius"), options.bloom.radius);
      draw();
    }
    {
      const { p, u } = programs.final;
      bind(null);
      gl!.useProgram(p);
      texture(0, scene!.textures[0], u("sceneTexture"));
      texture(1, horizontal[0].textures[0], u("bloomTexture"));
      const halfTan = (c: BlackholeCamera) => Math.tan((c.fovDeg * Math.PI) / 360);
      const turn = ((shown.camera.rollDeg - camera.rollDeg) * Math.PI) / 180;
      gl!.uniform1f(u("aspect"), width / height);
      gl!.uniform2fv(u("shownShift"), shown.camera.shift);
      gl!.uniform2fv(u("targetShift"), camera.shift);
      gl!.uniform1f(u("shownTan"), halfTan(shown.camera));
      gl!.uniform1f(u("targetTan"), halfTan(camera));
      gl!.uniform1f(u("distanceRatio"), camera.distance / shown.camera.distance);
      gl!.uniform2f(u("rollTurn"), Math.cos(turn), Math.sin(turn));
      const count = dimming ? Math.min(dimming.rects.length, MAX_DIM_RECTS) : 0;
      gl!.uniform1i(u("dimCount"), count);
      if (dimming && count > 0) {
        gl!.uniform2fv(u("canvasOrigin"), dimming.origin);
        gl!.uniform2fv(u("canvasSize"), dimming.size);
        const shown = dimming.rects.slice(0, count);
        gl!.uniform4fv(u("dimRects"), shown.flatMap((r) => r.slice(0, 4)));
        gl!.uniform2fv(u("dimShapes"), shown.flatMap((r) => [r[4], Math.max(r[5], 1e-3)]));
        gl!.uniform1f(u("dimFloor"), dimming.floor);
      }
      draw();
    }
  }

  let dimming: BlackholeDimming | null = null;

  return {
    resize,
    setCamera(next) {
      camera = next;
    },
    setDimming(next) {
      dimming = next;
    },
    render(timeSeconds) {
      if (gl!.isContextLost() || (!front && !back)) return false;
      const now = performance.now();
      // Size the strips to how this device is keeping up. Measured only while
      // a bake is running, which is the only time a strip is drawn.
      if (back && lastRender) {
        const interval = now - lastRender;
        if (interval > FRAME_BUDGET_MS.shrink) stripPixels = Math.max(STRIP_PIXELS.min, stripPixels * 0.6);
        else if (interval < FRAME_BUDGET_MS.grow) stripPixels = Math.min(STRIP_PIXELS.max, stripPixels * 1.25);
      }
      lastRender = now;
      gl!.bindVertexArray(vao);
      advanceBakes(now);
      if (!front) return false;
      drawFrame(timeSeconds, front);
      return true;
    },
    get bakeProgress() {
      if (front) return 1;
      return back && height ? back.rows / height : 0;
    },
    get busy() {
      return back !== null || (front !== null && !sameCamera(front.camera, camera));
    },
    get bakeBytes() {
      const count = [front?.target, back?.target, spare].filter(Boolean).length;
      return count * width * height * BYTES_PER_BAKED_PIXEL;
    },
    dispose() {
      freeBakes();
      deleteTarget(scene);
      deleteTarget(bright);
      horizontal.forEach(deleteTarget);
      vertical.forEach(deleteTarget);
      gl!.deleteTexture(disk);
      gl!.deleteBuffer(quad);
      gl!.deleteVertexArray(vao);
      for (const { p } of [programs.bake, programs.disk, programs.highPass, programs.composite, programs.final, ...programs.blurs]) {
        gl!.deleteProgram(p);
      }
    },
  };
}
