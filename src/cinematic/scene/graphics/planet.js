import * as THREE from 'three';
import { applyComposeShiftProjection } from './composeShift';

// The system we arrive in needs a body in it, not just a black hole in an empty
// sky. The planet is a mesh rendered to its own target and sampled back by the
// raymarcher, the same trick the star field already uses — see
// createParticleSystem() — with two differences that matter.
//
// Stars are emitters and composite additively. A planet has a night side, and
// adding it would leave that side transparent with the sky showing through, so
// this target is composited alpha-over: the material writes an opaque alpha and
// the target is cleared to a transparent one.
//
// Both are sampled along the bent ray. The planet was on the straight one for a
// long time, because bending it warped the sphere and threw off a second lensed
// image that read as a detached sliver rather than as physics — both worst in
// portrait, where the black hole fills much more of the frame. That was at three
// times this size and five times this orbit radius. Small and near, the warp is
// invisible and the second image is the point rather than the cost: it is what
// lets the planet sit against the black hole instead of having to stay clear of
// it. See the planet block in fragmentShader.glsl.

const SEGMENTS = 64;

// How far from the black hole the planet sits. With the anchor angles below,
// this is the whole lever on how close to the black hole the planet looks
// through the first half of the fall, and it took two goes to see why.
//
// The separation the camera sees is atan(R sin f / (d + R cos f)), where R is
// this radius, f is the total angular offset of the anchor, and d is the camera
// distance. Two things fall out of it. Far out, d dominates the denominator, so
// the separation is small and R scales it almost linearly — that is the half of
// the fall this number controls. Close in, d drops away and the separation tends
// to f whatever R is, so the last frame is governed by the anchor angles alone
// and not by this at all.
//
// Which is why dropping 65 to 30 barely moved anything: it pulled the arrival in
// a little but left the crowded final frame where it was, so the anchor angles
// could not be opened up to compensate. Small radius with wide angles is the
// combination that works — near the axis while the black hole is far, well clear
// of it once the black hole fills the frame.
//
// The floor is the occlusion. The planet is composited in the shader's
// background block, which rays terminating at the horizon never reach, so the
// black hole covers whatever is behind it and nothing else does — free, and
// correct only while the planet really is the further of the two. Anchored
// beyond the black hole, camera-to-planet runs about 38 down to 16 against a
// camera-to-black-hole 30 down to 5. It holds, but the margin never gets above
// about 10 units, so this should not go much below 12.
//
// It used to be 65, outside the star shell. Inside it now, which changes
// nothing: the particle layers add over the planet rather than depth-testing
// against it, and always did.
const ORBIT_RADIUS = 12.0;

// Where the planet is put, the first frame of the fall.
//
// Azimuth is relative to the camera's own, plus half a turn — so the planet sits
// beyond the black hole rather than off to one side of it. That is what the
// reference frame has, and it is also what makes the approach read: a body on
// the far side is one the fall genuinely closes on, so it grows, just far more
// slowly than the thing being fallen into. The small offset on top takes it off
// the exact axis and puts it to one side.
//
// Elevation is absolute, measured from the disk plane. The camera runs 14 to 5
// degrees above that plane, so at 5.4 the planet sits below the camera for most
// of the fall and only just above it at the end — close to edge-on with the disk
// the whole way. That is low, and it is the one thing here worth a second look:
// the planet passes near the near-side arc rather than reading against open sky,
// and it is only outside the disk at all because the disk stops at r = 6 and the
// orbit is at 12.
//
// Both were picked backwards from the last frame, where the planet used to have
// to clear the shadow or be deleted by it. Sampling along the bent ray removed
// that — see the planet block in fragmentShader.glsl — so the offset that was
// buying clearance now buys nearness instead. Halved from 38/12, the pair that
// first followed the lensing change, which keeps the bearing and halves the
// distance.
//
// Which puts the planet a long way inside the shadow geometrically by the end,
// at about 0.42 of its radius. It will not appear there. Lensing displaces an
// image outward, and an object that far behind the rim comes back out pinned to
// the photon ring — so the last of the fall converges on the ring wherever the
// planet is put, and this number stops meaning much before it gets there.
//
// Which is why the two are traded against each other rather than set apart. The
// pair carries a total angular offset, and only the total has to clear the
// shadow — so elevation can come down if azimuth goes up, and the planet drops
// in the frame without losing any of its margin. It is not an even trade: the
// horizontal axis is compressed by the aspect ratio, so on a wide viewport a
// degree spent sideways costs far less of the frame than a degree spent upward,
// and buys the same separation. Dropping 32/38 to 24/44 lowers the planet by
// about a fifth of the frame and leaves the clearance exactly where it was.
//
// They are wide in total because ORBIT_RADIUS is small — see the note there. The
// two move together: the radius sets how near the axis the planet is while the
// black hole is still far away, the angles set where it ends up once the black
// hole fills the frame, and only a small radius with wide angles gets both.
const ANCHOR_AZIMUTH_OFFSET = 17.0 * Math.PI / 180;
const ANCHOR_ELEVATION = 5.4 * Math.PI / 180;

// What a narrow viewport gives back. At the wide split the planet finishes about
// 0.86 of the way to the left edge on a phone, near enough to walking off it, and
// four more degrees of azimuth does walk it off. Portrait has the height instead,
// so the offset moves back into elevation — which is the landscape split from
// before this, and measures the same clearance it did.
const NARROW_AZIMUTH_GIVE = 3.6 * Math.PI / 180;
const NARROW_ELEVATION_GAIN = 5.4 * Math.PI / 180;

// World radius. Apparent size is this over the real distance and nothing else,
// so it is set once and the fall does the rest.
const PLANET_RADIUS = 0.26;


const vertexShader = /* glsl */ `
  varying vec3 vObjectPos;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vObjectPos = position;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Procedural, matching the project's no-licensed-textures approach.
const fragmentShader = /* glsl */ `
  varying vec3 vObjectPos;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  uniform vec3 uLightDir;
  uniform vec3 uLandLow;
  uniform vec3 uLandHigh;
  uniform vec3 uOcean;
  uniform vec3 uAtmosphere;
  uniform float uSeed;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }

  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash(i);
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));
    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    float total = 0.0;
    float amplitude = 0.5;
    for (int k = 0; k < 5; k++) {
      total += amplitude * vnoise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return total;
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 p = normalize(vObjectPos) * 2.4 + uSeed;

    float elevation = fbm(p);
    // Continents rather than an even scatter: the ridged term clusters the high
    // ground instead of leaving noise spread flat across the whole sphere.
    float ridged = 1.0 - abs(fbm(p * 1.8) * 2.0 - 1.0);
    elevation = elevation * 0.75 + ridged * 0.35;

    float land = smoothstep(0.48, 0.56, elevation);
    vec3 surface = mix(uOcean, mix(uLandLow, uLandHigh, smoothstep(0.5, 0.78, elevation)), land);

    // Lit by the accretion disk at the centre of the system, which is the only
    // source out here.
    float lambert = max(dot(n, normalize(uLightDir)), 0.0);
    // A little wrap so the terminator is a band rather than a hard edge, and a
    // floor so the night side is dark without being a hole in the sky.
    //
    // The reference frame has this as a near-black silhouette, and that is what
    // it was for a while. It does not survive being shrunk: at a couple of
    // percent of frame height a dark disc against dark sky is something you have
    // to go looking for, and a thing nobody finds is not scale reference. Exposed
    // enough to be picked out at a glance instead, which is the job it is here to
    // do — still well under the disk, so it reads as lit by it rather than as its
    // own source.
    float lighting = pow(lambert, 0.85) * 0.85 + 0.06;

    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    // Atmosphere tracks the light, so the limb glows on the lit side only. At
    // this size the rim is a good part of the disc, and it is the blue that makes
    // the planet findable against a field of white stars.
    vec3 atmosphere = uAtmosphere * fresnel * (0.15 + lambert * 1.10);

    gl_FragColor = vec4(surface * lighting + atmosphere, 1.0);
  }
`;

export function createPlanet(width, height) {
  const scene = new THREE.Scene();
  const target = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
  });
  const camera = new THREE.PerspectiveCamera(90, width / height, 0.1, 100000);
  let projectionFov = -1;
  let projectionAspect = -1;

  // Reproduces the raymarcher's projection exactly, off-centre shift included.
  //
  // The two used to disagree: this camera ran a 45 degree lens against the
  // shader's 90, so a direction landed at half the screen offset it should have,
  // and the shift meant it landed on the wrong side of centre as well. That was
  // survivable while the planet's screen position was authored outright — the
  // numbers were tuned against what came out, not against what was correct — but
  // it is the whole game once the planet is a fixed point in the world and the
  // projection is what decides where it appears.
  //
  // The frustum itself is derived in composeShift.js, which the star sprites
  // share.
  //
  // The wide lens costs a little shape: a sphere this far off axis is stretched
  // by 1/cos of the angle, around 12 percent out at 27 degrees. That is the
  // correct projection of a sphere through a wide lens rather than an error, and
  // at this size it is invisible. It was a real problem at the 65 degrees the
  // planet used to sit at, which is what the narrow lens was there to dodge.
  function applyProjection(fov, aspect) {
    if (fov === projectionFov && aspect === projectionAspect) return;
    projectionFov = fov;
    projectionAspect = aspect;

    applyComposeShiftProjection(camera, fov, aspect);
  }

  const geometry = new THREE.SphereGeometry(1, SEGMENTS, SEGMENTS / 2);
  const uniforms = {
    uLightDir: { value: new THREE.Vector3(-0.5, 0.35, 0.8).normalize() },
    uLandLow: { value: new THREE.Color(0x2f5d3a) },
    uLandHigh: { value: new THREE.Color(0xb2a279) },
    uOcean: { value: new THREE.Color(0x14315e) },
    uAtmosphere: { value: new THREE.Color(0x6fa8ff) },
    uSeed: { value: 3.7 },
  };

  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // The planet's world position, fixed the first frame of the fall and not
  // touched again until the fall is left. See update().
  const anchor = new THREE.Vector3();
  let anchored = false;

  /**
   * @param progress  0 as the fall toward the black hole begins, 1 at the end
   * @param observer  the camera being flown, for its position and orientation
   * @param aspect    viewport aspect ratio
   * @param time      elapsed seconds
   */
  function update(progress, observer, aspect, time) {
    // The camera rides with the observer, looks where it looks, and now sees
    // through the same lens — see applyProjection().
    camera.position.copy(observer.position);
    camera.up.copy(observer.up);
    camera.lookAt(0, 0, 0);
    applyProjection(observer.fov, aspect);
    camera.updateMatrixWorld();

    // The planet is put somewhere once, on the first frame of the fall, and then
    // left alone. Everything the visitor sees it do after that — drawing out from
    // the black hole, growing, sliding as the camera's elevation drops — is the
    // camera moving against a body that isn't.
    //
    // This is the whole point of the arrangement. Its screen position used to be
    // authored as a curve in `progress`, which meant it had no parallax at all:
    // drag the view, or let the idle spin drift, and the star field and the
    // lensing moved while the planet sat exactly where it was. That one missing
    // cue is what made it read as a decal composited over the scene rather than
    // an object inside it, and no amount of tuning the curve fixes it, because
    // the curve is the problem.
    //
    // Two things had to give way for a fixed point to stay framed, both in
    // main.js: the idle orbit now damps to nothing across the fall, and the
    // camera's elevation swing was cut from 55 degrees to 9. A world-fixed body
    // seen from a camera rotating 55 degrees swings further from the rotation
    // than it ever does from the approach, and in the wrong direction.
    if (!anchored) {
      // Spherical coordinates about the black hole, in the observer's own
      // convention — see applyOrbitPosition() in src/camera/Observer.js.
      //
      // The azimuth is taken from the camera's rather than fixed in the world,
      // because the idle spin leaves it somewhere arbitrary on the way through
      // the tunnel and a world-fixed azimuth would put the planet anywhere at
      // all. Everything that matters — the distance, the elevation above the
      // disk, and so how the fall changes both — is absolute.
      //
      // ORBIT_RADIUS is also what makes the occlusion right. The planet is
      // composited in the background block, which rays terminating at the horizon
      // never reach, so the black hole covers whatever is behind it and nothing
      // else does. Holding it further from the black hole than the camera ever
      // gets means it is always the further of the two, so "behind" is the only
      // case that can arise and the free occlusion is always the correct one.
      //
      // How the offset is split between the two depends on the viewport, and it
      // has to. Only the total has to clear the shadow, so the split is free —
      // but it is spent against whichever axis of the frame has room, and which
      // axis that is flips. A wide viewport has width to spare and no height, so
      // the offset goes mostly sideways and the planet rides low. A phone has the
      // reverse, and the same wide azimuth walks it off the left edge, so the
      // offset moves back into elevation and the planet rides high. Same total,
      // same clearance, opposite framing.
      const narrow = Math.min(1, Math.max(0, (1.2 - aspect) / 0.8));
      const azimuthOffset = ANCHOR_AZIMUTH_OFFSET - NARROW_AZIMUTH_GIVE * narrow;
      const elevation = ANCHOR_ELEVATION + NARROW_ELEVATION_GAIN * narrow;

      const azimuth = observer.theta + Math.PI + azimuthOffset;
      const cosElevation = Math.cos(elevation);
      anchor.set(
        ORBIT_RADIUS * cosElevation * Math.sin(azimuth),
        ORBIT_RADIUS * Math.sin(elevation),
        ORBIT_RADIUS * cosElevation * Math.cos(azimuth),
      );
      anchored = true;
    }

    mesh.position.copy(anchor);
    mesh.scale.setScalar(PLANET_RADIUS);
    // Spins on its own axis. Slow, and the only motion left that isn't the
    // camera's — a body this far out covers no meaningful arc of its orbit in the
    // time anyone spends here, so anything faster reads as a turntable.
    mesh.rotation.y = time * 0.012 + 0.6;

    // Lit by the accretion disk, which is the only light in this system and sits
    // at the origin the planet orbits. It used to be lit relative to the view,
    // because on the far side of the wormhole there was no source in frame to
    // justify anything else — the throat transmits rather than emits.
    //
    // Being lit from the middle of the shot is also why the phase is stable now.
    // A world-fixed light direction was a coin toss when the planet's own position
    // followed the drifting orbit angle; pointing at the origin, the terminator
    // falls in the same place whatever the camera has done.
    uniforms.uLightDir.value.copy(mesh.position).negate().normalize();
  }

  // Called whenever the fall is left — scrolled back into the tunnel, where the
  // planet is not drawn — so that coming back down re-frames it. The camera's
  // azimuth drifts while the visitor is away and a point fixed against the old
  // one would be off the edge on return.
  //
  // Deliberately not called on resize. The anchor holding through a resize is the
  // honest behaviour for a body that is actually out there, and re-aiming on
  // every resize event would make the planet jump around on mobile, where hiding
  // and showing the address bar fires them continuously.
  function resetAnchor() {
    anchored = false;
  }

  function resize(nextWidth, nextHeight) {
    target.setSize(nextWidth, nextHeight);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    target.dispose();
  }

  return {
    planetScene: scene,
    planetTarget: target,
    planetCamera: camera,
    updatePlanet: update,
    resetPlanetAnchor: resetAnchor,
    resizePlanetTarget: resize,
    disposePlanet: dispose,
  };
}
