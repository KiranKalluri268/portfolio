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
 *  shadow, the third and fourth the thin photon rings. A ray that winds more
 *  times than this passes within a hair of the photon sphere, and what it
 *  would add covers a sliver of a pixel. */
export const MAX_CROSSINGS = 4;

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

#define STEP 0.055
#define NSTEPS 850

uniform vec2 resolution;
uniform vec3 cam_pos;
uniform vec3 cam_dir;
uniform vec3 cam_up;
uniform float fov;

const float DISK_IN = 2.0;
const float DISK_WIDTH = 4.0;
const float PI = 3.141592653589793238462643383279;
const float DEG_TO_RAD = PI / 180.0;

// One crossing per target: x = angle as a fraction of a turn, before the time
// is subtracted; y = the disk texture's v; z = the disk's Doppler factor;
// w = 1 where there is a crossing. The last target's w also carries whether the
// ray ended on the horizon, as +2, which saves a fifth target for one bit.
layout(location = 0) out vec4 crossing0;
layout(location = 1) out vec4 crossing1;
layout(location = 2) out vec4 crossing2;
layout(location = 3) out vec4 crossing3;

void main() {
  // The cinematic's projection with its compose shift left out: the shift
  // places the black hole off-centre in a full-screen frame, and this canvas is
  // already only the black hole.
  float uvfov = tan(fov / 2.0 * DEG_TO_RAD);
  vec2 uv = 2.0 * (gl_FragCoord.xy / resolution.xy) - 1.0;
  uv *= vec2(resolution.x / resolution.y, 1.0);

  vec3 forward = normalize(cam_dir);
  vec3 up = normalize(cam_up);
  vec3 nright = normalize(cross(forward, up));
  up = cross(nright, forward);
  vec3 pixel_pos = cam_pos + forward + nright * uv.x * uvfov + up * uv.y * uvfov;
  vec3 ray_dir = normalize(pixel_pos - cam_pos);

  vec4 found[4];
  found[0] = vec4(0.0);
  found[1] = vec4(0.0);
  found[2] = vec4(0.0);
  found[3] = vec4(0.0);
  int count = 0;
  float horizon = 0.0;

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
      horizon = 1.0;
      break;
    }

    if (oldpoint.y * point.y < 0.0) {
      float lambda = -oldpoint.y / velocity.y;
      vec3 intersection = oldpoint + lambda * velocity;
      float r = length(intersection);
      if (DISK_IN <= r && r <= DISK_IN + DISK_WIDTH) {
        float phi = atan(intersection.x, intersection.z);
        vec3 disk_velocity = vec3(-intersection.x, 0.0, intersection.z) * inversesqrt(2.0 * (r - 1.0)) / (r * r);
        float disk_gamma = inversesqrt(1.0 - dot(disk_velocity, disk_velocity));
        float disk_doppler_factor = disk_gamma * (1.0 + dot(ray_dir / distance, disk_velocity));
        vec4 crossing = vec4(phi / (2.0 * PI), 1.0 - (r - DISK_IN) / DISK_WIDTH, disk_doppler_factor, 1.0);
        if (count == 0) found[0] = crossing;
        else if (count == 1) found[1] = crossing;
        else if (count == 2) found[2] = crossing;
        else if (count == 3) found[3] = crossing;
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

  crossing0 = found[0];
  crossing1 = found[1];
  crossing2 = found[2];
  crossing3 = vec4(found[3].xyz, found[3].w + 2.0 * horizon);
}
`;

// Per frame. Reads the bake at this exact pixel — texelFetch, never a filtered
// read, because the recorded angle wraps from 1 back to 0 and interpolating
// across that seam would draw a line across the disk.
export const DISK_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

uniform highp sampler2D crossings0;
uniform highp sampler2D crossings1;
uniform highp sampler2D crossings2;
uniform highp sampler2D crossings3;
uniform sampler2D disk_texture;
uniform float turn;       // time / 2pi, already wrapped into [0, 1)
uniform vec3 disk_tint;
uniform float exposure;

out vec4 outColor;

vec3 shade(vec4 crossing) {
  if (crossing.w < 0.5) return vec3(0.0);
  // The cinematic: phi -= time; mod(phi, 2pi) / 2pi. As fractions of a turn.
  vec2 tex_coord = vec2(fract(crossing.x - turn), crossing.y);
  float ddf = crossing.z;
  // ray_doppler_factor is 1 for a still camera, so it drops out of these.
  vec4 disk_color = texture(disk_texture, tex_coord) / ddf;
  float disk_alpha = clamp(dot(disk_color, disk_color) / 4.5, 0.0, 1.0);
  disk_alpha /= (ddf * ddf * ddf);
  return disk_color.rgb * disk_tint * disk_alpha;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 c3 = texelFetch(crossings3, p, 0);
  float horizon = c3.w > 1.5 ? 1.0 : 0.0;
  c3.w -= 2.0 * horizon;

  vec3 glow = shade(texelFetch(crossings0, p, 0))
            + shade(texelFetch(crossings1, p, 0))
            + shade(texelFetch(crossings2, p, 0))
            + shade(c3);

  // The cinematic's background is black here (no sky on this canvas), and the
  // composer's target clamps to [0, 1] before the bloom reads it. Alpha marks
  // the shadow: it is the one part of the frame that should hide the page's
  // stars behind the canvas rather than add light over them.
  outColor = vec4(clamp(glow * exposure, 0.0, 1.0), horizon);
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
out vec4 outColor;
void main() {
  vec4 scene = texture(sceneTexture, vUv);
  // The one departure from the cinematic's bloom. There it spreads across a
  // full-screen frame; here the frame is a square on the page, and the widest
  // mip's haze reached its edges and stopped dead, drawing the square's outline
  // over the stars. Faded out over the outer tenth instead. The black hole is
  // framed well inside that band, so only the haze is touched.
  vec2 edge = min(vUv, 1.0 - vUv);
  float keep = smoothstep(0.0, 0.1, min(edge.x, edge.y));
  vec3 bloom = texture(bloomTexture, vUv).rgb * keep;
  // Premultiplied: rgb with alpha 0 is added over what is behind the canvas.
  outColor = vec4(min(scene.rgb + bloom, vec3(1.0)), scene.a);
}
`;
