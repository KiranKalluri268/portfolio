import {
  BAKE_FRAGMENT,
  COMPOSITE_FRAGMENT,
  DISK_FRAGMENT,
  FINAL_FRAGMENT,
  FULLSCREEN_VERTEX,
  HIGH_PASS_FRAGMENT,
  MAX_CROSSINGS,
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
}

export interface BakedBlackholeOptions {
  camera: BlackholeCamera;
  /** The cinematic's UnrealBloomPass values for the frame being matched. */
  bloom: { strength: number; radius: number; threshold: number };
  diskTint?: [number, number, number];
  exposure?: number;
}

export interface BakedBlackhole {
  /** Size in device pixels. Re-runs the bake when it changes. */
  resize(width: number, height: number): void;
  /** Advances the bake by one strip, or draws a frame once it is done.
   *  Returns true when a frame of the black hole was drawn. */
  render(timeSeconds: number): boolean;
  /** 0 to 1. */
  readonly bakeProgress: number;
  dispose(): void;
}

/** The bake is spread over frames in strips of about this many pixels, so no
 *  single frame asks a phone's GPU for the whole integration at once — a long
 *  enough draw can trip the driver's watchdog and lose the context. */
const PIXELS_PER_BAKE_STRIP = 160_000;

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
  return { position, dir, up };
}

/** Null when this browser cannot run it — no WebGL2, or no float render
 *  targets to hold the bake. The caller keeps the video in that case. */
export function createBakedBlackhole(
  canvas: HTMLCanvasElement,
  diskImage: TexImageSource,
  options: BakedBlackholeOptions,
): BakedBlackhole | null {
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return null;
  // Float32 holds the angle to well under one of the disk texture's 2048
  // columns. Half floats would land up to a column off near a full turn.
  if (!gl.getExtension("EXT_color_buffer_float")) return null;
  if (gl.getParameter(gl.MAX_DRAW_BUFFERS) < MAX_CROSSINGS) return null;

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

  function createTarget(width: number, height: number, count: number, float: boolean): Target {
    const fbo = gl!.createFramebuffer()!;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
    const textures: WebGLTexture[] = [];
    for (let i = 0; i < count; i++) {
      const texture = gl!.createTexture()!;
      gl!.bindTexture(gl!.TEXTURE_2D, texture);
      if (float) {
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA32F, width, height, 0, gl!.RGBA, gl!.FLOAT, null);
      } else {
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA8, width, height, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
      }
      // Float targets are only ever texelFetched; RGBA8 ones are filtered the
      // way three's render targets are.
      const filter = float ? gl!.NEAREST : gl!.LINEAR;
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, filter);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, filter);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0 + i, gl!.TEXTURE_2D, texture, 0);
      textures.push(texture);
    }
    gl!.drawBuffers(textures.map((_, i) => gl!.COLOR_ATTACHMENT0 + i));
    return { fbo, textures, width, height };
  }

  function deleteTarget(target: Target | null) {
    if (!target) return;
    gl!.deleteFramebuffer(target.fbo);
    for (const texture of target.textures) gl!.deleteTexture(texture);
  }

  let width = 0;
  let height = 0;
  let bake: Target | null = null;
  let scene: Target | null = null;
  let bright: Target | null = null;
  let horizontal: Target[] = [];
  let vertical: Target[] = [];
  let bakedRows = 0;

  function resize(nextWidth: number, nextHeight: number) {
    nextWidth = Math.max(1, Math.round(nextWidth));
    nextHeight = Math.max(1, Math.round(nextHeight));
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    canvas.width = width;
    canvas.height = height;

    deleteTarget(bake);
    deleteTarget(scene);
    deleteTarget(bright);
    horizontal.forEach(deleteTarget);
    vertical.forEach(deleteTarget);

    bake = createTarget(width, height, MAX_CROSSINGS, true);
    gl!.clearBufferfv(gl!.COLOR, 0, [0, 0, 0, 0]);
    scene = createTarget(width, height, 1, false);
    // UnrealBloomPass.setSize: half size, then halving per mip.
    let rx = Math.round(width / 2);
    let ry = Math.round(height / 2);
    bright = createTarget(rx, ry, 1, false);
    horizontal = [];
    vertical = [];
    for (let i = 0; i < BLOOM_KERNELS.length; i++) {
      horizontal.push(createTarget(Math.max(1, rx), Math.max(1, ry), 1, false));
      vertical.push(createTarget(Math.max(1, rx), Math.max(1, ry), 1, false));
      rx = Math.round(rx / 2);
      ry = Math.round(ry / 2);
    }
    bakedRows = 0;
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

  const { position, dir, up } = cameraVectors(options.camera);

  function bakeStrip() {
    const rows = Math.max(1, Math.floor(PIXELS_PER_BAKE_STRIP / width));
    const { p, u } = programs.bake;
    bind(bake);
    gl!.useProgram(p);
    gl!.uniform2f(u("resolution"), width, height);
    gl!.uniform3fv(u("cam_pos"), position);
    gl!.uniform3fv(u("cam_dir"), dir);
    gl!.uniform3fv(u("cam_up"), up);
    gl!.uniform1f(u("fov"), options.camera.fovDeg);
    gl!.enable(gl!.SCISSOR_TEST);
    gl!.scissor(0, bakedRows, width, Math.min(rows, height - bakedRows));
    draw();
    gl!.disable(gl!.SCISSOR_TEST);
    bakedRows = Math.min(height, bakedRows + rows);
  }

  const tint = options.diskTint ?? [1, 1, 1];
  const exposure = options.exposure ?? 1;

  function drawFrame(timeSeconds: number) {
    // Disk, into the clamped RGBA8 target the cinematic's composer renders to.
    {
      const { p, u } = programs.disk;
      bind(scene);
      gl!.useProgram(p);
      bake!.textures.forEach((tex, i) => texture(i, tex, u(`crossings${i}`)));
      texture(4, disk, u("disk_texture"));
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
      draw();
    }
  }

  return {
    resize,
    render(timeSeconds) {
      if (!bake || gl!.isContextLost()) return false;
      gl!.bindVertexArray(vao);
      if (bakedRows < height) {
        bakeStrip();
        return false;
      }
      drawFrame(timeSeconds);
      return true;
    },
    get bakeProgress() {
      return height === 0 ? 0 : bakedRows / height;
    },
    dispose() {
      deleteTarget(bake);
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
