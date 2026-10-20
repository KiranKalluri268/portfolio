// The homepage black hole, drawn from the cinematic's own geodesics.
//
// The cinematic raymarcher (src/cinematic/scene/graphics/fragmentShader.ts)
// integrates every pixel's light ray through up to 850 steps of bent space,
// every frame. For a camera that does not move, almost none of that changes
// between frames: where a ray bends, where it crosses the disk, and how its
// Doppler factor comes out are all fixed by the camera alone. The only thing
// time touches is the disk's angle, `phi -= time`, which is applied after the
// crossing is found.
//
// So the integration runs once (BAKE_FRAGMENT) and records, per pixel, each
// disk crossing's angle, radius and Doppler factor. Every frame after that
// (DISK_FRAGMENT) is a few texture reads: rotate the recorded angle by the
// time, sample the disk texture, and apply the cinematic's own colour, alpha
// and beaming arithmetic to it. Same ray, same numbers, same pixel — computed
// once instead of sixty times a second.
//
// What carries over unchanged from the cinematic shader, and must change with
// it: the leapfrog step, DISK_IN and DISK_WIDTH, the disk-velocity and Doppler
// expressions, and the texture coordinate. __tests__/shaders.test.ts compares
// those lines against the cinematic source so the two cannot drift silently.
//
// What does not carry over: the sky, the planet, the particle layers and the
// wormhole. The homepage draws its own stars behind this canvas, and the black
// hole's world has no planet or throat. The camera is also assumed still, so
// the cinematic's observer-velocity terms (aberration, and the ray's own
// Doppler factor) are at their rest values — exactly 1.

/** How many times a ray may cross the disk before the rest are dropped. The
 *  first is the disk itself, the second the lensed far side arching over the
 *  shadow, the third the photon ring hugging the shadow's edge. Anything past
 *  that passes within a hair of the photon sphere and lands on a sliver of a
 *  pixel: compared with the cinematic, keeping a fourth changed no channel by
 *  more than the 1/255 the comparison already allows. */
export const MAX_CROSSINGS = 3;

/** How many shapes the black hole can dim behind at once: a line of text is
 *  one, a card or a form field is one. Only the shapes on screen are passed. */
export const MAX_DIM_RECTS = 48;

// ── The bake's format ──
// Every value is a 16-bit fraction, five 32-bit words a pixel — 20 bytes, where
// float32 for four crossings was 64. At a phone's 2x that was 180MB of GPU
// memory for a background; this is a third of it before the resolution cap.
//
//   angle    fraction of a turn, 1/65536 steps — 1/32 of a disk-texture column
//   v        disk texture v, 1/65534 steps; 0xFFFF means "no crossing here"
//   doppler  the disk's Doppler factor, mapped from [0.5, 1.5]; the physical
//            range at the disk's inner edge is about 0.88 to 1.26
//   ray      the ray's own Doppler factor from the camera's motion, 15 bits
//            over the same [0.5, 1.5]; about 0.96 to 1.04 at the closest the
//            home page comes, and exactly 1 for a camera that is not moving
//
//   word 0: angle0 | v0 << 16      word 1: doppler0 | angle1 << 16
//   word 2: v1 | doppler1 << 16    word 3: angle2 | v2 << 16
//   word 4: doppler2 | ray << 16 | horizon << 31
//
// Words 0-3 are one RGBA32UI target, word 4 an R32UI one. Integer targets are
// renderable in every WebGL2, where float ones needed an extension.
const PACKING = /* glsl */ `
const uint NO_CROSSING = 0xFFFFu;
const float DOPPLER_MIN = 0.5;
const float DOPPLER_SPAN = 1.0;
`;

export const FULLSCREEN_VERTEX = /* glsl */ `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const BAKE_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

#define STEP 0.055
#define NSTEPS 850

uniform vec2 resolution;
uniform vec3 cam_pos;
uniform vec3 cam_dir;
uniform vec3 cam_up;
uniform float fov;
uniform vec2 compose_shift;
// The observer's orbital velocity, as the cinematic's Observer sets it. Zero
// would be a camera hanging still beside the hole; the cinematic's never is.
uniform vec3 cam_vel;

const float DISK_IN = 2.0;
const float DISK_WIDTH = 4.0;
const float PI = 3.141592653589793238462643383279;
const float DEG_TO_RAD = PI / 180.0;
${PACKING}

layout(location = 0) out uvec4 words;
layout(location = 1) out uint lastWord;

uint angle16(float turns) { return uint(fract(turns) * 65536.0 + 0.5) & 0xFFFFu; }
uint v16(float v) { return uint(clamp(v, 0.0, 1.0) * 65534.0 + 0.5); }
uint doppler16(float d) { return uint(clamp((d - DOPPLER_MIN) / DOPPLER_SPAN, 0.0, 1.0) * 65535.0 + 0.5); }
uint doppler15(float d) { return uint(clamp((d - DOPPLER_MIN) / DOPPLER_SPAN, 0.0, 1.0) * 32767.0 + 0.5); }

// The cinematic's, unchanged.
vec3 lorentz_transform_velocity(vec3 u, vec3 v){
  float speed = length(v);
  if (speed > 0.0){
    float gamma = 1.0/sqrt(1.0-dot(v,v));
    float denominator = 1.0 - dot(v,u);
    vec3 new_u = (u/gamma - v + (gamma/(gamma+1.0)) * dot(u,v)*v)/denominator;
    return new_u;
  }
  return u;
}

void main() {
  // The cinematic's projection, compose shift included: the canvas is the whole
  // screen, and the shift puts the black hole where the frame wants it rather
  // than in the middle — in half-screens, and before the aspect scaling, so a
  // fraction of the width.
  float uvfov = tan(fov / 2.0 * DEG_TO_RAD);
  vec2 uv = 2.0 * (gl_FragCoord.xy / resolution.xy) - 1.0;
  uv -= compose_shift;
  uv *= vec2(resolution.x / resolution.y, 1.0);

  vec3 forward = normalize(cam_dir);
  vec3 up = normalize(cam_up);
  vec3 nright = normalize(cross(forward, up));
  up = cross(nright, forward);
  vec3 pixel_pos = cam_pos + forward + nright * uv.x * uvfov + up * uv.y * uvfov;
  vec3 ray_dir = normalize(pixel_pos - cam_pos);
  // Light aberration: a moving camera sees every ray arrive from further
  // ahead. With the ray's own Doppler factor, the cinematic's, unchanged.
  ray_dir = lorentz_transform_velocity(ray_dir, cam_vel);
  float ray_gamma = inversesqrt(1.0 - dot(cam_vel, cam_vel));
  float ray_doppler_factor = ray_gamma * (1.0 + dot(ray_dir, -cam_vel));

  uint angle[3] = uint[3](0u, 0u, 0u);
  uint v[3] = uint[3](NO_CROSSING, NO_CROSSING, NO_CROSSING);
  uint doppler[3] = uint[3](0u, 0u, 0u);
  int count = 0;
  uint horizon = 0u;

  // ── From the cinematic, unchanged ──
  vec3 point = cam_pos;
  vec3 velocity = ray_dir;
  vec3 c = cross(point, velocity);
  float h2 = dot(c, c);
  vec3 oldpoint;
  float distance = length(point);

  for (int i = 0; i < NSTEPS; i++) {
    oldpoint = point;
    point += velocity * STEP;
    float distSq = dot(point, point);
    distance = sqrt(distSq);
    float dist5 = distSq * distSq * distance;
    vec3 accel = -1.5 * h2 * point / dist5;
    velocity += accel * STEP;

    if (distSq < 1.0 && dot(oldpoint, oldpoint) > 1.0) {
      horizon = 1u;
      break;
    }

    if (count < 3 && oldpoint.y * point.y < 0.0) {
      float lambda = -oldpoint.y / velocity.y;
      vec3 intersection = oldpoint + lambda * velocity;
      float r = length(intersection);
      if (DISK_IN <= r && r <= DISK_IN + DISK_WIDTH) {
        float phi = atan(intersection.x, intersection.z);
        vec3 disk_velocity = vec3(-intersection.x, 0.0, intersection.z) * inversesqrt(2.0 * (r - 1.0)) / (r * r);
        float disk_gamma = inversesqrt(1.0 - dot(disk_velocity, disk_velocity));
        float disk_doppler_factor = disk_gamma * (1.0 + dot(ray_dir / distance, disk_velocity));
        angle[count] = angle16(phi / (2.0 * PI));
        v[count] = v16(1.0 - (r - DISK_IN) / DISK_WIDTH);
        doppler[count] = doppler16(disk_doppler_factor);
        count++;
      }
    }

    // Not in the cinematic, and changes nothing it draws: a ray already
    // outside the disk and heading away from the hole only ever gets further
    // away, so it has no crossing left to find. The cinematic marches it to the
    // end of its step budget regardless; stopping here is what makes the bake
    // affordable on a phone.
    if (distance > DISK_IN + DISK_WIDTH + STEP && dot(point, velocity) > 0.0) break;
  }

  words = uvec4(
    angle[0] | (v[0] << 16),
    doppler[0] | (angle[1] << 16),
    v[1] | (doppler[1] << 16),
    angle[2] | (v[2] << 16));
  lastWord = doppler[2] | (doppler15(ray_doppler_factor) << 16) | (horizon << 31);
}
`;

// Per frame. Reads the bake at this exact pixel — texelFetch, never a filtered
// read, because the recorded angle wraps from 1 back to 0 and interpolating
// across that seam would draw a line across the disk.
export const DISK_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform highp usampler2D bakeWords;
uniform highp usampler2D bakeLastWord;
uniform sampler2D disk_texture;
uniform float turn;       // time / 2pi, already wrapped into [0, 1)
uniform vec3 disk_tint;
uniform float exposure;
${PACKING}

out vec4 outColor;

vec3 shade(uint angle, uint v, uint doppler, float ray_doppler_factor) {
  if (v == NO_CROSSING) return vec3(0.0);
  // The cinematic: phi -= time; mod(phi, 2pi) / 2pi. As fractions of a turn.
  vec2 tex_coord = vec2(fract(float(angle) / 65536.0 - turn), float(v) / 65534.0);
  float ddf = DOPPLER_MIN + DOPPLER_SPAN * float(doppler) / 65535.0;
  vec4 disk_color = texture(disk_texture, tex_coord) / (ray_doppler_factor * ddf);
  float disk_alpha = clamp(dot(disk_color,disk_color)/4.5,0.0,1.0);
  disk_alpha /= (ddf * ddf * ddf);
  return disk_color.rgb * disk_tint * disk_alpha;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  uvec4 w = texelFetch(bakeWords, p, 0);
  uint last = texelFetch(bakeLastWord, p, 0).r;
  const uint LOW = 0xFFFFu;
  float rdf = DOPPLER_MIN + DOPPLER_SPAN * float((last >> 16) & 0x7FFFu) / 32767.0;

  vec3 glow = shade(w.x & LOW, w.x >> 16, w.y & LOW, rdf)
            + shade(w.y >> 16, w.z & LOW, w.z >> 16, rdf)
            + shade(w.w & LOW, w.w >> 16, last & LOW, rdf);
  float horizon = float(last >> 31);

  // The cinematic's background is black here (no sky on this canvas), and the
  // composer's target clamps to [0, 1] before the bloom reads it. Alpha marks
  // the shadow: it is the one part of the frame that should hide the page's
  // stars behind the canvas rather than add light over them.
  // Beaming from the camera's own motion, over the whole pixel: the
  // cinematic's ray_intensity, 1 / rdf^3, applied as it is there at the end.
  float ray_intensity = 1.0 / (rdf * rdf * rdf);
  outColor = vec4(clamp(glow * ray_intensity * exposure, 0.0, 1.0), horizon);
}
`;

// ── UnrealBloomPass, as three.js r148 runs it ──
// Ported rather than imported so the homepage does not pull in three.js. The
// arithmetic is line for line the same; see
// node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js.

export const HIGH_PASS_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D tDiffuse;
uniform float luminosityThreshold;
uniform float smoothWidth;
out vec4 outColor;
void main() {
  vec4 texel = texture(tDiffuse, vUv);
  vec3 luma = vec3(0.299, 0.587, 0.114);
  float v = dot(texel.xyz, luma);
  vec4 outputColor = vec4(0.0);
  float alpha = smoothstep(luminosityThreshold, luminosityThreshold + smoothWidth, v);
  outColor = mix(outputColor, texel, alpha);
}
`;

export function blurFragment(kernelRadius: number) {
  return /* glsl */ `#version 300 es
precision highp float;
#define KERNEL_RADIUS ${kernelRadius}
#define SIGMA ${kernelRadius}
in vec2 vUv;
uniform sampler2D colorTexture;
uniform vec2 texSize;
uniform vec2 direction;
out vec4 outColor;
float gaussianPdf(in float x, in float sigma) {
  return 0.39894 * exp(-0.5 * x * x / (sigma * sigma)) / sigma;
}
void main() {
  vec2 invSize = 1.0 / texSize;
  float fSigma = float(SIGMA);
  float weightSum = gaussianPdf(0.0, fSigma);
  vec3 diffuseSum = texture(colorTexture, vUv).rgb * weightSum;
  for (int i = 1; i < KERNEL_RADIUS; i++) {
    float x = float(i);
    float w = gaussianPdf(x, fSigma);
    vec2 uvOffset = direction * invSize * x;
    vec3 sample1 = texture(colorTexture, vUv + uvOffset).rgb;
    vec3 sample2 = texture(colorTexture, vUv - uvOffset).rgb;
    diffuseSum += (sample1 + sample2) * w;
    weightSum += 2.0 * w;
  }
  outColor = vec4(diffuseSum / weightSum, 1.0);
}
`;
}

export const COMPOSITE_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D blurTexture1;
uniform sampler2D blurTexture2;
uniform sampler2D blurTexture3;
uniform sampler2D blurTexture4;
uniform sampler2D blurTexture5;
uniform float bloomStrength;
uniform float bloomRadius;
out vec4 outColor;
float lerpBloomFactor(const in float factor) {
  float mirrorFactor = 1.2 - factor;
  return mix(factor, mirrorFactor, bloomRadius);
}
void main() {
  outColor = bloomStrength * (
      lerpBloomFactor(1.0) * texture(blurTexture1, vUv)
    + lerpBloomFactor(0.8) * texture(blurTexture2, vUv)
    + lerpBloomFactor(0.6) * texture(blurTexture3, vUv)
    + lerpBloomFactor(0.4) * texture(blurTexture4, vUv)
    + lerpBloomFactor(0.2) * texture(blurTexture5, vUv));
}
`;

// The bloom pass's last step draws the scene and then adds the bloom over it.
// Done in one shader here so the alpha stays the scene's own: the canvas sits
// over the page's stars, and only the shadow should cover them.
export const FINAL_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D sceneTexture;
uniform sampler2D bloomTexture;
// Between bakes. While the camera moves, the next exact bake is still being
// integrated, so the last finished one stands in for it: carried from where
// the shown camera put each direction to where the target camera puts it.
// Positions are taken about each camera's compose shift, in the tangent plane
// (aspect-scaled uv times tan of half the fov), then turned by the difference
// in roll and scaled by the ratio of distances — an approach makes everything
// near the hole look bigger in proportion. Exact for the shift, the turn and
// the field of view; close for the distance; and replaced by the real thing as
// soon as its bake lands. All identity when nothing is moving.
uniform float aspect;
uniform vec2 shownShift;
uniform vec2 targetShift;
uniform float shownTan;
uniform float targetTan;
uniform float distanceRatio; // target distance over shown distance
uniform vec2 rollTurn;       // cos and sin of shown roll minus target roll
// Where the page's text sits, so the black hole can step back behind it.
// canvasOrigin and canvasSize place the canvas on screen in CSS pixels;
// dimRects are screen rectangles, also in CSS pixels, as left, top, right,
// bottom, and dimShapes their corner radius and the width of their soft
// edge. The dimming fades in from nothing at the outline to dimFloor of the
// brightness that far inside it: nothing spills out around them, and no hard
// edge traces the outline.
uniform vec2 canvasOrigin;
uniform vec2 canvasSize;
uniform vec4 dimRects[${MAX_DIM_RECTS}];
uniform vec2 dimShapes[${MAX_DIM_RECTS}];
uniform int dimCount;
uniform float dimFloor;
out vec4 outColor;
float behindText() {
  vec2 screen = canvasOrigin + vec2(vUv.x, 1.0 - vUv.y) * canvasSize;
  float covered = 0.0;
  for (int i = 0; i < dimCount; i++) {
    vec4 rect = dimRects[i];
    float radius = min(dimShapes[i].x, 0.5 * min(rect.z - rect.x, rect.w - rect.y));
    float soft = dimShapes[i].y;
    vec2 half_size = 0.5 * (rect.zw - rect.xy);
    vec2 q = abs(screen - 0.5 * (rect.xy + rect.zw)) - half_size + radius;
    float outside = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
    covered = max(covered, 1.0 - smoothstep(-soft, 0.0, outside));
  }
  return covered;
}
vec2 standIn(vec2 target) {
  vec2 frame = vec2(aspect, 1.0);
  vec2 t = (2.0 * target - 1.0 - targetShift) * frame * targetTan * distanceRatio;
  vec2 s = vec2(rollTurn.x * t.x - rollTurn.y * t.y, rollTurn.y * t.x + rollTurn.x * t.y);
  return (s / (frame * shownTan) + shownShift + 1.0) * 0.5;
}
void main() {
  vec2 uv = standIn(vUv);
  // Off the shown bake's edge there is nothing to stand in with: left empty
  // for the frame or two until the exact bake fills it, rather than smearing
  // the edge pixels across.
  vec2 inside = step(0.0, uv) * step(uv, vec2(1.0));
  float shown = inside.x * inside.y;
  vec4 scene = texture(sceneTexture, uv) * shown;
  // UnrealBloomPass adds its composite over the scene with three's
  // AdditiveBlending on a material that is not premultiplied: blendFunc(
  // SRC_ALPHA, ONE). The composite's alpha is the same weighted sum as its
  // colour, every blur mip carrying alpha 1 — strength 0.2 times factors that
  // add to 3.0 at radius 1, so 0.6 — and the glow lands at 0.6 of its colour.
  vec4 glow = texture(bloomTexture, uv);
  vec3 bloom = glow.rgb * glow.a * shown;
  // Premultiplied: rgb with alpha 0 is added over what is behind the canvas.
  // The shadow stays as dark as it is; only the light is taken down.
  float light = mix(1.0, dimFloor, behindText());
  outColor = vec4(min(scene.rgb + bloom, vec3(1.0)) * light, scene.a);
}
`;
