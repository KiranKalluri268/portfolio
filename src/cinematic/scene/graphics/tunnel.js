import * as THREE from 'three';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

// The black hole is a raymarched exterior solution — it has no inside to fly
// through, and pushing the camera past the horizon feeds garbage to the geodesic
// integrator. The passage is therefore a scene of its own, swapped in behind a
// blackout while the raymarcher is off. That swap is also a large saving: the
// tunnel costs a few thousand triangles where the raymarcher costs hundreds of
// ray steps per pixel.

const TUNNEL_LENGTH = 400;
const TUNNEL_RADIUS = 3.2;
const TRAVEL_START = 0.02;  // stay clear of both end caps
const TRAVEL_END = 0.97;

// The passage bends. Control points run the length of the tube and push it off
// the axis in between; Catmull-Rom rounds the corners, so what the camera flies
// is a set of long sweeping turns rather than anything angular.
//
// The lateral offsets are large next to the 3.2 radius but small next to the 100
// units of tube each one is spread over — about 13 degrees at the sharpest. That
// is the whole budget: turn harder and the wall on the inside of the bend swings
// across the camera's near plane and you end up looking through it. Alternating
// the sign is what makes the exit light leave the frame and come back rather
// than drifting steadily to one side.
const TUNNEL_PATH = [
  [0, 0, TUNNEL_LENGTH / 2],
  [10, -6, TUNNEL_LENGTH / 4],
  [-14, 8, 0],
  [12, 10, -TUNNEL_LENGTH / 4],
  [0, 0, -TUNNEL_LENGTH / 2],
];

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    // TubeGeometry lays its UVs out the other way up from the CylinderGeometry
    // this used to be: u runs ALONG the tube and v around it, and u starts at 0
    // where the camera starts rather than at the far mouth. Swapped and flipped
    // here so the fragment shader keeps the convention it was written against —
    // x around the wall, y along it, 0 at the exit.
    vUv = vec2(uv.y, 1.0 - uv.x);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Procedural, matching the project's no-licensed-textures approach. The noise
// lattice wraps on the u axis so the walls have no visible seam where the
// cylinder's UVs meet.
const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;

  uniform sampler2D uStarTex;
  uniform sampler2D uBgTex;
  uniform float uSkyAmount;
  uniform float uFlow;
  uniform float uExitGlow;
  uniform float uReveal;
  uniform vec3  uColorNear;
  uniform vec3  uColorFar;
  uniform vec3  uExitLight;

  float hash(vec2 i, float period) {
    i.x = mod(i.x, period);
    return fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float vnoise(vec2 p, float period) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i, period);
    float b = hash(i + vec2(1.0, 0.0), period);
    float c = hash(i + vec2(0.0, 1.0), period);
    float d = hash(i + vec2(1.0, 1.0), period);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p, float period) {
    float total = 0.0;
    float amplitude = 0.5;
    for (int k = 0; k < 5; k++) {
      total += amplitude * vnoise(p, period);
      p *= 2.0;
      period *= 2.0;
      amplitude *= 0.5;
    }
    return total;
  }

  // Lifted from the raymarcher, because these are meant to be recognisably the
  // same stars: the star plate packs temperature in red and brightness in green
  // rather than storing colour, so sampling it raw gives a red-green field that
  // looks nothing like the sky outside.
  vec3 temp_to_color(float temp_kelvin){
    vec3 color;
    temp_kelvin = clamp(temp_kelvin, 1000.0, 40000.0) / 100.0;
    if (temp_kelvin <= 66.0){
      color.r = 255.0;
      color.g = clamp(99.4708025861 * log(temp_kelvin) - 161.1195681661, 0.0, 255.0);
    } else {
      color.r = clamp(329.698727446 * pow(max(temp_kelvin - 60.0, 0.0), -0.1332047592), 0.0, 255.0);
      color.g = clamp(288.1221695283 * pow(max(temp_kelvin - 60.0, 0.0), -0.0755148492), 0.0, 255.0);
    }
    if (temp_kelvin >= 66.0) {
      color.b = 255.0;
    } else if (temp_kelvin <= 19.0) {
      color.b = 0.0;
    } else {
      color.b = clamp(138.5177312231 * log(temp_kelvin - 10.0) - 305.0447927307, 0.0, 255.0);
    }
    return color / 255.0;
  }

  void main() {
    // vUv.y is 0 at the far mouth and 1 behind the camera, so "toExit" grows
    // toward the light we are heading for.
    float toExit = 1.0 - vUv.y;

    float body = fbm(vec2(vUv.x * 8.0, vUv.y * 50.0 - uFlow), 8.0);
    float streak = fbm(vec2(vUv.x * 26.0, vUv.y * 7.0 - uFlow * 0.5), 26.0);

    float wall = pow(body, 1.5) * 0.9 + pow(streak, 2.5) * 1.1;

    // Lit relative to the camera rather than to a fixed point on the tube.
    // Without this the walls hang in place as a static starburst; with it the
    // lit stretch travels with the ship and the surface streams past.
    float dist = length(vWorldPos - cameraPosition);
    // The decay length matters far more now the tube bends. Straight, everything
    // past the falloff was hidden behind the vanishing point and it did not
    // matter that it went black. Bent, that stretch swings out into open frame,
    // and at 0.055 it arrived as a dark snake lying across a lit wall. Reaching
    // roughly three times further keeps the tube reading as one continuous
    // surface all the way into the turn.
    // Reach and intensity trade off. Tripling the reach without dropping the
    // multiplier lights the near wall and the whole mid stretch at once, and the
    // bloom pass takes that to a white screen — so the multiplier comes down by
    // about the same factor the reach went up.
    // The floor is what stops any stretch of wall reaching black. It matters
    // more than the multiplier does for how lit the passage feels: the lit
    // patch travelling with the ship was never the problem, the unlit rest of
    // the tube was. Raised well above the old 0.06, where the wall between the
    // headlight and the exit glow fell into a dead band.
    float headlight = exp(-dist * 0.018) * 0.58 + 0.16;

    vec3 color = mix(uColorNear, uColorFar, smoothstep(0.1, 1.0, toExit));
    color *= wall * headlight;

    // ── The sky, wrapped onto the wall ──
    // The same two plates the world outside uses, read with the tube's own UVs:
    // x wraps around the wall, y runs along it. An equirectangular sky forced
    // onto a cylinder is the distortion — it arrives stretched down the tube and
    // wound around it, which is the point. The y scale is what sets how hard it
    // is drawn out; at 3 the field is stretched enough to read as motion rather
    // than as a photograph of the sky pasted inside a pipe.
    //
    // Scrolled by uFlow so it streams past with the walls instead of sitting
    // still while the noise underneath it moves — the two coming apart is
    // immediately obvious and reads as a texture sliding over a surface.
    vec2 skyUv = vec2(vUv.x, fract(vUv.y * 3.0 - uFlow * 0.02));

    vec4 star = texture2D(uStarTex, skyUv);
    vec3 sky = vec3(0.0);
    if (star.g > 0.0) {
      sky += temp_to_color(1000.0 + 39000.0 * star.r) * star.g * 0.6;
    }
    sky += texture2D(uBgTex, skyUv).rgb * 0.15;

    // Faded out toward the far end. The exit glow and the bloom threshold are
    // both already climbing there, and a broadband star field added on top of
    // them takes the last third of the passage to a flat white screen — the
    // walls, the mouth and the light all bleach into one thing.
    sky *= 1.0 - pow(toExit, 2.5);

    // Tinted toward the far end's warmth and lit by the same headlight, so the
    // stars belong to the tunnel's depth cue rather than floating on top of it
    // at full brightness all the way down the tube.
    color += sky * uColorFar * headlight * uSkyAmount;

    // Softens the rim so the tunnel opens into the light rather than stopping at
    // a disc.
    //
    // Two terms, because one cannot do both jobs. The tight one is the arrival:
    // it only bites in the last stretch and it is what makes coming out feel
    // like coming out. The wide one is always on, and it exists because the
    // headlight is exp(-dist) — by the far end it has decayed to nothing, so
    // without a light of its own the mouth was a black plug in the middle of the
    // frame and the tunnel read as closed rather than as opening into anything.
    //
    // The wide term is kept shallow on purpose. The original note here was right
    // that spreading the bright one floods the tube through bloom; the fix is a
    // second, dimmer falloff rather than a wider bright one.
    color += uColorFar * pow(toExit, 12.0) * uExitGlow * 0.28;
    color += uColorFar * pow(toExit, 2.0) * (0.11 + 0.10 * uExitGlow);

    // A third, flat term over the whole tube. The two above are both powers of
    // toExit, so everything they give is concentrated at the far end — the
    // stretch immediately around the ship gets nothing from either and is lit by
    // the headlight alone. This is the light that is simply in here with us.
    // Carries the wall's own structure rather than washing flat over it, and
    // weighted toward the near end so it adds where the light was missing
    // instead of on top of the exit, which is already at the bloom threshold.
    color += mix(uColorNear, uColorFar, toExit)
           * (0.40 + 0.60 * wall) * 0.20 * (1.0 - 0.6 * toExit);

    // ── The ellipse at the end ──
    // The tube's far opening is a circle cut square across the curve, and by the
    // time we see it the curve has turned — so it is presented at an angle and
    // arrives on screen as an ellipse. Nothing is wrong with it; it is simply
    // what a round hole looks like from off to one side, and no amount of
    // geometry avoids it while there is a crisp boundary between wall and
    // opening.
    //
    // So take the boundary away. Over the last stretch the wall is carried into
    // the same light that fills the opening, and the two meet with nothing
    // between them to draw an edge. The hole stops being a shape and becomes the
    // place the light is coming from.
    color = mix(color, uExitLight, smoothstep(0.86, 1.0, toExit));

    gl_FragColor = vec4(color * uReveal, 1.0);
  }
`;

export function createTunnel(aspect = 1) {
  const scene = new THREE.Scene();

  // What fills the aperture at the far end. The tube is closed all the way
  // around and the camera is inside it, so the only thing this is ever seen
  // through is the exit — which makes the scene's own background the light at
  // the end of it. No geometry, so no edge, so nothing for the tube's facets to
  // interleave with: the ring the mouth disc kept drawing cannot come back.
  //
  // Driven from black on the same ramp the disc used, so the arrival still reads
  // as arriving somewhere rather than as a light that was always on.
  const exitLight = new THREE.Color(0x000000);
  scene.background = exitLight;
  const camera = new THREE.PerspectiveCamera(78, aspect, 0.1, 2000);

  const curve = new THREE.CatmullRomCurve3(
    TUNNEL_PATH.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  );
  // Enough tubular segments that the bends are smooth at this length — the wall
  // is only ever a few units from the camera, so faceting shows.
  const geometry = new THREE.TubeGeometry(curve, 400, TUNNEL_RADIUS, 48, false);

  const uniforms = {
    uStarTex: { value: null },
    uBgTex: { value: null },
    uSkyAmount: { value: 1.0 },
    uFlow: { value: 0 },
    uExitGlow: { value: 0 },
    uReveal: { value: 0 },
    // Was a cold violet, which fought everything either side of it: the throat
    // we come in from and the light we come out into are both warm, and the
    // passage in between was the one violet stretch of the whole journey.
    uColorNear: { value: new THREE.Color(0x7a4020) },
    uColorFar: { value: new THREE.Color(0xffdcc0) },
    // Kept equal to the scene background, which is what fills the opening. The
    // wall fades into this at the very end so the two never meet at an edge.
    uExitLight: { value: new THREE.Color(0x000000) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    // Writes depth, which the straight tube did not need to. A cylinder seen
    // from inside never overlaps itself on screen, so draw order was harmless.
    // A bent one does: the stretch beyond the turn sits inside the silhouette of
    // the wall in front of it, and with nothing writing depth the far end simply
    // painted over the near wall — the whole tunnel showed through itself as a
    // dark shape lying across a lit surface.
    depthWrite: true,
  });

  const walls = new THREE.Mesh(geometry, material);
  scene.add(walls);

  // There is no mouth disc any more.
  //
  // It existed to stop the far end reading as a hole, but the tube's end is a
  // ring of flat facets rather than a circle, and any disc drawn across it has
  // an edge that has to meet those facets somewhere. Hard edged, they interleave
  // and each facet bites a notch out of it — a ring of black dots. Soft edged,
  // the falloff itself is darker than the blown-out wall around it and reads as
  // a dark ring. Both are the same problem wearing different clothes: a separate
  // surface sitting in the one place where everything else is brightest.
  //
  // The wall's own exit glow already carries the arrival — it climbs into the
  // bloom threshold over the last third and takes the whole end of the tube
  // white, which is what the disc was there to do. Nothing to interleave with,
  // so nothing to draw a ring.

  // Scratch vectors, reused every frame so the flight allocates nothing.
  const position = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const right = new THREE.Vector3();
  const frameUp = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();

  /**
   * @param progress  0 at the tunnel entrance, 1 at the mouth
   * @param reveal    0 hides the walls entirely, for handing off to the blackout
   * @param elapsed   seconds, for drift that does not depend on scrolling
   */
  function update(progress, reveal, elapsed) {
    const eased = progress * progress * (3.0 - 2.0 * progress);

    // Position and heading both come off the curve now. The camera is placed on
    // it and aimed a little further down it, so it banks into the turns instead
    // of sliding through them facing one fixed direction.
    const t = TRAVEL_START + eased * (TRAVEL_END - TRAVEL_START);
    curve.getPointAt(t, position);
    curve.getTangentAt(t, tangent);

    // A frame built from world up rather than the curve's own Frenet normal.
    // Frenet frames flip through an inflection point, and this path has two of
    // them — using one would roll the horizon over twice on the way through.
    right.crossVectors(tangent, WORLD_UP).normalize();
    frameUp.crossVectors(right, tangent).normalize();

    // A little unsteadiness so it reads as piloted rather than railed. Applied
    // along the frame rather than in world axes: on a bend, a world-space nudge
    // pushes the camera toward the wall instead of away from the centre line.
    position.addScaledVector(right, Math.sin(elapsed * 0.31) * 0.16);
    position.addScaledVector(frameUp, Math.cos(elapsed * 0.24) * 0.13);
    camera.position.copy(position);

    curve.getPointAt(Math.min(t + 0.02, 1), lookTarget);
    camera.up.copy(frameUp);
    camera.lookAt(lookTarget);
    camera.rotateZ(Math.sin(elapsed * 0.19) * 0.035);

    uniforms.uFlow.value = eased * 46 + elapsed * 0.6;
    uniforms.uReveal.value = reveal;
    // The mouth only starts to bite in the last third, so the arrival reads as
    // arriving somewhere rather than a light that was always on.
    uniforms.uExitGlow.value = Math.max(0, (progress - 0.35) / 0.65);

    // Warm at first and running to white, so the exit is the brightest thing in
    // frame by the time we reach it rather than merely the least dark.
    const exit = Math.min(1, (0.35 + Math.max(0, (progress - 0.45) / 0.55) * 0.65) * reveal);
    exitLight.setRGB(exit, exit * (0.80 + 0.20 * exit), exit * (0.62 + 0.38 * exit));
    uniforms.uExitLight.value.copy(exitLight);
  }

  // The plates arrive with the rest of the loader, after the tunnel is built.
  //
  // Cloned rather than used directly. The wall wraps the sky all the way around
  // the tube, so it needs RepeatWrapping to close without a seam — and the
  // originals are ClampToEdge because that is what the raymarcher wants. A clone
  // shares the uploaded image but carries its own sampler state, so the tunnel
  // gets its wrap without reaching into the world's copy.
  let ownedTextures = [];
  function setTextures(starTexture, bgTexture) {
    ownedTextures.forEach((t) => t.dispose());
    ownedTextures = [starTexture, bgTexture].filter(Boolean).map((source) => {
      const copy = source.clone();
      copy.wrapS = THREE.RepeatWrapping;
      copy.wrapT = THREE.RepeatWrapping;
      copy.needsUpdate = true;
      return copy;
    });
    uniforms.uStarTex.value = ownedTextures[0] ?? null;
    uniforms.uBgTex.value = ownedTextures[1] ?? null;
  }

  function resize(nextAspect) {
    if (camera.aspect === nextAspect) return;
    camera.aspect = nextAspect;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    ownedTextures.forEach((t) => t.dispose());
    ownedTextures = [];
  }

  return { tunnelScene: scene, tunnelCamera: camera, updateTunnel: update, resizeTunnel: resize, disposeTunnel: dispose, setTunnelTextures: setTextures };
}
