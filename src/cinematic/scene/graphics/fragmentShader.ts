// The black hole raymarcher. Generated - do not edit by hand.
//
// Tuned in portfolio-3D as fragmentShader.glsl, where Vite reads it with
// `?raw`, and brought across by scripts/port-shader.mjs. Edit it there and
// re-run the script; anything changed here is lost on the next port.
//
// It is a string rather than a .glsl file because Turbopack has no import that
// survives contact with one. Its `type: "raw"` rule produces a module with no
// ES namespace, so the import arrives as undefined and the shader compiles as
// the literal text "undefined" - which fails at the GPU driver rather than at
// the build, so the page loads, the canvas appears, and only the console says
// why the frame is black. A webpack raw-loader through import attributes would
// work, at the cost of a build dependency in a production site, and Vitest
// would still need telling separately. A string needs none of that.

export const fragmentShader = `//#define STEP 0.04
//#define NSTEPS 700
#define PI 3.141592653589793238462643383279
#define DEG_TO_RAD (PI/180.0)
#define ROT_Y(a) mat3(1, 0, 0, 0, cos(a), sin(a), 0, -sin(a), cos(a))
#define ROT_Z(a) mat3(cos(a), -sin(a), 0, sin(a), cos(a), 0, 0, 0, 1)


uniform float time;
uniform vec2 resolution;

uniform vec3 cam_pos;
uniform vec3 cam_dir;
uniform vec3 cam_up;
uniform float fov;
uniform vec3 cam_vel;

const float MIN_TEMPERATURE = 1000.0;
const float TEMPERATURE_RANGE = 39000.0;

// How far left of centre the rays are aimed, in half-screens, so the object being
// orbited sits off to the right instead of in the middle. src/graphics/planet.js
// mirrors this when it aims the planet at a screen position, and must be changed
// with it.
//
// Fitted off the reference with the two scaled to a common height: its shadow
// centres at 0.836 of the width, which is 0.67 half-screens right of the middle,
// far enough that the circle runs off the right edge. The disk runs out to the
// left of it.
//
// Earlier values here came from thresholding the JPEG directly and were wrong
// twice — it is graded, glow fills the shadow, and no threshold separates the
// two. Compare renders against it by eye at a matched height; do not trust a
// number taken off that file alone.
//
// Applied before the aspect scaling, so this is a fraction of the width and the
// composition holds its proportions on any viewport.
const float COMPOSE_SHIFT = 0.67;

// The same thing vertically, in half-screens up. The reference does not show a
// whole black hole: its shadow centres above the top third and runs off the top
// and right edges, so what is in frame is the lower left of the circle with the
// disk crossing the rest. Centred vertically that cannot happen at any distance —
// the shadow grows symmetrically and meets both edges at once — which is why this
// exists rather than the distance being pushed further in.
//
// Fitting the reference's arc gives its centre 0.27 of the way down a frame whose
// middle is 0.5 — 0.46 half-screens up. That is too much here and 0.26 is what
// was kept, because this camera ends up inside the disk's outer edge where the
// reference's is outside it: lifting the frame puts more near-side disk under the
// black hole rather than the empty dark the reference has there, and by 0.46 the
// bottom half of the frame is nothing else.
const float COMPOSE_SHIFT_Y = 0.26;

uniform bool accretion_disk;
uniform bool use_disk_texture;
const float DISK_IN = 2.0;
const float DISK_WIDTH = 4.0;

uniform bool doppler_shift;
uniform bool lorentz_transform;
uniform bool beaming;

uniform sampler2D bg_texture;
uniform sampler2D star_texture;
uniform sampler2D disk_texture;
uniform sampler2D particle_texture; // Lensed stars (small)
uniform sampler2D particle_texture_unlensed; // Unlensed stars (large foreground)
uniform sampler2D planet_texture;
uniform float planet_amount;        // 0 outside the new world, and the target is not even drawn
uniform bool show_lensing;

// Whole-frame gain, applied last. 1.0 everywhere except the crossing, where it
// is driven up hard so the throat blows out on its own before the veil covers
// it. A flash that lives only in the overlay is a white rectangle appearing in
// front of the scene; the light has to come off the thing we are flying into,
// and it has to reach the bloom pass to spread the way real overexposure does.
uniform float exposure;

// ── World appearance ────────────────────────────────────────────────────────
// The same geodesic renders both worlds. Only what the horizon and the sky are
// made of changes, so the lensing that sells the black hole also sells the
// wormhole. At the defaults below this block is a no-op and the output is
// identical to the untinted black hole.
uniform float throat_throughput; // 0.0 = black hole absorbs, 1.0 = wormhole transmits
uniform vec3 disk_tint;
uniform vec3 bg_tint;            // multiplies stars and the nebula plate
uniform float bg_lensing;        // 0 = background sampled straight, 1 = bent with the ray
uniform vec3 space_color_plane;  // deep space toward the galactic plane
uniform vec3 space_color_pole;   // deep space away from it

// What the background sky is made of, as gains rather than literals at the call
// site. They exist so each layer can be switched off on its own: the scene has a
// long-standing complaint that the world reads as a sphere rather than as open
// space, and there are several candidate causes stacked on top of each other -
// the star plate, the nebula plate, the plane-to-pole gradient and a point field
// in front of all three. Isolating them by eye is the only way to tell which.
// Defaults are the values that used to be written in the call.
uniform float bg_star_gain;      // 1.0
uniform float bg_nebula_gain;    // 0.2

// The five domains of the skill web, laid across the sky as the arms of the
// galaxy this system sits in.
//
// Not decoration and not invented: src/data/skill-web.json already gives every
// domain an angle and an accent colour, and /skills already draws that same
// radial arrangement in two dimensions. These are those numbers handed over as
// uniforms, so a sixth domain added to the data changes the sky with no shader
// edit. See docs/CINEMATIC_DECISION.md section 8.
//
// A fixed array size because GLSL ES 1.00 wants a constant loop bound.
// DOMAIN_SLOTS is the ceiling, not the truth; arm_count says how many are really
// there and the rest are skipped.
#define DOMAIN_SLOTS 8
uniform vec3 arm_color[DOMAIN_SLOTS];
uniform float arm_angle[DOMAIN_SLOTS]; // radians about the galactic pole
uniform int arm_count;
uniform float arm_gain;                // 0 switches the whole thing off
uniform vec3 arm_pole;                 // normal of the galactic plane the arms lie in


// The sky on the far side of the throat. Its own rotation and colours, because a
// wormhole that opened onto the same sky it sits in would not read as a way out.
// The gains are not decoration: sampled at the background's own brightness the
// throat is barely distinguishable from the sky around it and disappears entirely
// once the camera has pulled back.
uniform float throat_sky_rotation;
uniform vec3 throat_color_plane;
uniform vec3 throat_color_pole;
uniform float throat_bend_clamp; // radians of winding the far side is allowed to show
uniform float throat_twist;      // azimuthal drag, radians of spin per radian of bend
uniform vec3 throat_spin_axis;   // the throat's own axis, NOT the line of sight
uniform float throat_star_blur;  // widens the far side's stars so they stop aliasing into rings
uniform vec3 throat_tint;       // multiplies the far side's stars and nebula
uniform float throat_star_gain;
uniform float throat_nebula_gain;

// The galaxy lying across the far sky — the one thing through the throat with a
// shape, and so the only thing whose distortion can be read.
uniform vec3 throat_band_pole;   // normal of the disc it lies in; only its part across the view is used
uniform vec3 throat_band_color;
uniform float throat_band_gain;  // 0 removes it entirely



vec2 square_frame(vec2 screen_size){
  vec2 position = 2.0 * (gl_FragCoord.xy / screen_size.xy) - 1.0; 
  // first make pixels arranged in 0..1
  // then by multiplying by 2 and subtracting 1, put them in -1..1
  
  return position;
}

vec2 to_spherical(vec3 cartesian_coord){
  // spherical projection
  // polar angles are directly used as horizontal and vertical coordinates
  // here angle to y-axis mapped to latitude (looking vertically 180 degrees)
  // xz plane to longitude (looking horizontally 360 degrees)
  vec2 uv = vec2(atan(cartesian_coord.z,cartesian_coord.x), asin(cartesian_coord.y)); 
  uv *= vec2(1.0/(2.0*PI), 1.0/PI); //long, lat
  uv += 0.5;
  return uv;
}

vec3 lorentz_transform_velocity(vec3 u, vec3 v){ 
  // u = ray
  // v = observer
  float speed = length(v);
  if (speed > 0.0){
    float gamma = 1.0/sqrt(1.0-dot(v,v));
    
    float denominator = 1.0 - dot(v,u);
    
    vec3 new_u = (u/gamma - v + (gamma/(gamma+1.0)) * dot(u,v)*v)/denominator;
    return new_u;
  }
  return u;
}

vec3 temp_to_color(float temp_kelvin){
  vec3 color;
  // 1k ~ 40k rescale by dividing 100
  temp_kelvin = clamp(temp_kelvin, 1000.0, 40000.0) / 100.0;
  if (temp_kelvin <= 66.0){
    color.r = 255.0;
    color.g = temp_kelvin;
    color.g = 99.4708025861 * log(color.g) - 161.1195681661;
    if (color.g < 0.0) color.g = 0.0;
    if (color.g > 255.0)  color.g = 255.0;
  } else {
    color.r = temp_kelvin - 60.0;
    if (color.r < 0.0) color.r = 0.0;
    color.r = 329.698727446 * pow(color.r, -0.1332047592);
    if (color.r < 0.0) color.r = 0.0;
    if (color.g > 255.0) color.r = 255.0;
    color.g = temp_kelvin - 60.0;
    if (color.g < 0.0) color.g = 0.0;
    color.g = 288.1221695283 * pow(color.g, -0.0755148492);
    if (color.g > 255.0)  color.g = 255.0;  
  }
  if (temp_kelvin >= 66.0){
    color.b = 255.0;
  } else if (temp_kelvin <= 19.0){
    color.b = 0.0;
  } else {
    color.b = temp_kelvin - 10.0;
    color.b = 138.5177312231 * log(color.b) - 305.0447927307;
    if (color.b < 0.0) color.b = 0.0;
    if (color.b > 255.0) color.b = 255.0;
  }
  color /= 255.0; // make it 0..1
  return color;
}


// One sky, sampled twice: once for the background along the unbent ray, and once
// through the wormhole throat along the bent one. Keeping it in a single place is
// what stops the two skies drifting apart as either is tuned.
//   rotation      degrees about Z, so the far side is a different patch of sky
//   doppler_factor pass 1.0 to leave the star temperatures alone
// One star, decoded. Pulled out of sample_sky so the throat can average several
// taps of it without duplicating the temperature decode.
vec3 star_at(vec2 tex_coord, vec3 tint, float star_gain, float doppler_factor){
  vec4 star_color = texture2D(star_texture, tex_coord);
  if (star_color.g <= 0.0) return vec3(0.0);
  float star_temperature = (MIN_TEMPERATURE + TEMPERATURE_RANGE*star_color.r);
  float star_velocity = star_color.b - 0.5;
  float star_doppler_factor = sqrt((1.0+star_velocity)/(1.0-star_velocity));
  if (doppler_shift)
    star_temperature /= doppler_factor*star_doppler_factor;
  return temp_to_color(star_temperature) * tint * star_color.g * star_gain;
}

// A galaxy lying across the far sky.
//
// Everything the throat shows is stars, and a star is a point. A point has no
// shape to distort, so a field of them carries no information about what the
// mapping is doing to it — they land where the mapping puts them and the eye
// reads the arrangement, which is circles, because that is what the mapping
// makes. Distortion is only legible on something that had a form to begin with:
// a band that should be straight and is bent, a lane that should be even and is
// pinched. That is the whole reason this exists. It is not decoration on the far
// side, it is the thing the lensing is applied to.
//
// Low frequency throughout on purpose. Anything fine enough to alias would come
// back as rings the same way the stars did.
vec3 galaxy_band(vec3 dir, vec3 pole, vec3 view, vec3 tint, float gain){
  // Half-thickness of the disc, in units of the sine of the angle off it. Wide
  // enough to stay a band rather than a line once the throat stretches it.
  const float WIDTH = 0.11;

  vec3 v = normalize(view);

  // The pole is held square to the view, which puts the band's own plane through
  // the view direction — so the band crosses the middle of the mouth instead of
  // circling it. This is not cosmetic. The deflection sweeps a cone about the
  // view whose angle grows with screen radius, so a band whose pole leans toward
  // the view is very nearly one of those cones and comes back as an even ring
  // hugging the rim, which is what the first attempt did: it read as more rim
  // glow, indistinguishable from what was already there. Square to the view the
  // band cuts across every cone instead of lying along one, and arrives as a
  // stripe over the throat with the bending visible along it.
  vec3 p = normalize(pole - v * dot(v, pole));

  vec3 n = normalize(dir);
  float lat = dot(n, p);              // 0 along the band, +-1 at its poles
  float belt = exp(-(lat*lat) / (WIDTH*WIDTH));

  // Longitude from the core's bearing. The core is set a little off the view
  // rather than on it, so the bulge sits inside the mouth but off its centre and
  // the band has a near end and a far end to tell apart.
  vec3 c = normalize(v + 0.45 * cross(p, v));
  vec3 t = cross(p, c);
  float lon = atan(dot(n, t), dot(n, c));

  // The bulge: brighter and thicker toward the core, the way the middle of a
  // disc galaxy swells out of it. Gives the band one end that is unmistakably
  // its centre, so a stretch along its length is visible as a stretch.
  float bulge = exp(-(lon*lon) / 0.9) * exp(-(lat*lat) / (WIDTH*WIDTH*4.0));

  // Slow variation down the length so it is not an even stripe.
  float mottle = 0.72 + 0.28*sin(lon*2.0 + 0.9) + 0.16*sin(lon*3.0 - 2.1);

  // The dust lane. A thin dark line down the middle is the most recognisable
  // thing about a galaxy seen edge on, and more to the point it is one long
  // continuous curve — the clearest thing in the frame for the bending to act
  // on, and the only feature here whose warping can be followed by eye.
  float lane = 1.0 - 0.92 * exp(-(lat*lat) / (WIDTH*WIDTH*0.10));

  return tint * gain * (belt*mottle*lane + bulge*1.6);
}

// The galaxy this system sits in, with the skill web's domains as its arms.
//
// Distinct from galaxy_band above, which belongs to the far side of the throat
// and is a single band chosen to make lensing legible. This one belongs to the
// black hole's own sky and has a different job: to be the skills, present in the
// world, as something you fall through rather than something written over the
// top of it.
//
// Sampled by direction, so it sits at infinity: no radius, no shell, nothing for
// the camera to reach the edge of. It is added at the background call site,
// which passes the bent ray, so the arms lens around the hole for free.
//
// Deliberately low frequency. The star field learned this the hard way - see the
// note about aliasing into rings in sample_sky - and an arm with fine structure
// would come back the same way once the deflection stretches it.
vec3 domain_arms(vec3 dir){
  if (arm_gain <= 0.0) return vec3(0.0);

  vec3 pole = normalize(arm_pole);
  // Any two directions square to the pole will do for measuring longitude from;
  // the arms carry their own angles and the whole thing is rotationally free.
  // Cross with whichever axis the pole leans on least, so this never degenerates.
  vec3 seed = abs(pole.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 ref = normalize(cross(pole, seed));
  vec3 tangent = cross(pole, ref);

  vec3 n = normalize(dir);
  float lat = dot(n, pole);          // 0 in the galactic plane, +-1 at its poles

  // The disc. Thick enough to read as a galaxy rather than a drawn line, and
  // thick enough to survive being stretched by the lensing.
  float disc = exp(-(lat * lat) / (0.26 * 0.26));

  float lon = atan(dot(n, tangent), dot(n, ref));

  vec3 arms = vec3(0.0);
  for (int i = 0; i < DOMAIN_SLOTS; i++) {
    if (i >= arm_count) break;

    // Wrapped into [-pi, pi] through atan rather than by adding multiples of
    // 2*pi, so an arm at the seam is as bright as one in the middle.
    float delta = lon - arm_angle[i];
    delta = atan(sin(delta), cos(delta));

    // Two lobes half a turn apart: an arm of a spiral galaxy crosses the sky and
    // comes back, and one lobe reads as a smudge rather than as structure.
    float near = exp(-(delta * delta) / (0.42 * 0.42));
    float far = exp(-((abs(delta) - PI) * (abs(delta) - PI)) / (0.55 * 0.55));

    arms += arm_color[i] * (near + far * 0.45);
  }

  // Brighter toward the plane and toward the core, which is the direction the
  // arms all leave from, so the whole thing has a centre.
  float core = exp(-(lat * lat) / 0.02) * 0.6;

  return arm_gain * (arms * disc + core * vec3(0.55, 0.45, 0.62));
}


vec3 sample_sky(vec3 dir, float rotation, vec3 tint, vec3 plane_color, vec3 pole_color,
                float star_gain, float nebula_gain, float doppler_factor, float star_blur){
  vec2 tex_coord = to_spherical(dir * ROT_Z(rotation * DEG_TO_RAD));
  vec3 sky = vec3(0.0);

  // A star is one texel. Where the mapping from screen to sky is steep — which
  // is the whole interior of the throat — that one texel gets replicated across
  // a long arc, and a field of points becomes a field of rings. Averaging a few
  // taps turns each point back into a small disc, which smears along the arc
  // instead of stamping a hard line down it.
  //
  // The background passes 0 and keeps its single tap: it is sampled along the
  // unbent ray, where the mapping is near enough uniform that there is nothing
  // to alias, and the stars there are meant to be points.
  if (star_blur > 0.0) {
    float r = star_blur * 0.004;
    sky += star_at(tex_coord, tint, star_gain, doppler_factor) * 0.36;
    sky += star_at(tex_coord + vec2( r, 0.0), tint, star_gain, doppler_factor) * 0.16;
    sky += star_at(tex_coord + vec2(-r, 0.0), tint, star_gain, doppler_factor) * 0.16;
    sky += star_at(tex_coord + vec2(0.0,  r), tint, star_gain, doppler_factor) * 0.16;
    sky += star_at(tex_coord + vec2(0.0, -r), tint, star_gain, doppler_factor) * 0.16;
  } else {
    sky += star_at(tex_coord, tint, star_gain, doppler_factor);
  }

  sky += mix(plane_color, pole_color, smoothstep(0.0, 0.55, abs(dir.y)));
  sky += texture2D(bg_texture, tex_coord).rgb * nebula_gain * tint;
  return sky;
}

// https://gist.github.com/fieldOfView/5106319
// https://gamedev.stackexchange.com/questions/93032/what-causes-this-distortion-in-my-perspective-projection-at-steep-view-angles
// for reference
void main()	{
  // z towards you, y towards up, x towards your left
  //  float hfov = (2.0 * ((uv.x+0.5)/resolution.x) - 1.0) * d * resolution.x/resolution.y;
  // float vfov = (1.0 - 2.0 * ((uv.y+0.5)/resolution.y)) * d;
  //  float d = tan(fov*DEG_TO_RAD / 2.0);

  float uvfov = tan(fov / 2.0 * DEG_TO_RAD);
  vec2 uv = square_frame(resolution);

  // Off-center projection: put the black hole up and to the right rather than in
  // the middle. uv is in [-1, +1] on both axes, so subtracting a shift moves the
  // "center" (the black hole) by that much in half-screens. Anything rendered to
  // an offscreen target and sampled back by ray direction has to know about both
  // shifts — see the planet block.
  uv.x -= COMPOSE_SHIFT;
  uv.y -= COMPOSE_SHIFT_Y;

  uv *= vec2(resolution.x/resolution.y, 1.0);
  vec3 forward = normalize(cam_dir); // 
  vec3 up = normalize(cam_up);
  vec3 nright = normalize(cross(forward, up));
  up = cross(nright, forward);
  // generate ray
  vec3 pixel_pos =cam_pos + forward +
                 nright*uv.x*uvfov+ up*uv.y*uvfov;
  
  vec3 ray_dir = normalize(pixel_pos - cam_pos);
  vec3 orig_ray_dir = ray_dir; // saved before geodesic — used when show_lensing is off

  // light aberration alters ray path
  if (lorentz_transform)
    ray_dir = lorentz_transform_velocity(ray_dir, cam_vel);

  
  // initial color
  vec4 color = vec4(0.0,0.0,0.0,1.0);

  // The disk is kept out of \`color\` and added at the very end. It is emissive and
  // accumulates additively, so the order never used to matter — but the planet is
  // composited alpha-over, and the planet sits far outside the disk. Left in line,
  // the planet's mix wiped the disk wherever the two crossed on screen, which
  // portrait made obvious once the disk grew to fill the frame.
  vec3 disk_glow = vec3(0.0);

  // geodesic by leapfrog integration

  vec3 point = cam_pos;
  vec3 velocity = ray_dir;
  vec3 c = cross(point,velocity);
  float h2 = dot(c,c);

  
  // for doppler effect (using hardware inversesqrt)
  float ray_gamma = inversesqrt(1.0 - dot(cam_vel, cam_vel));
  float ray_doppler_factor = ray_gamma * (1.0 + dot(ray_dir, -cam_vel));
    
  float ray_intensity = 1.0;
  if (beaming) {
    float rdf = ray_doppler_factor;
    ray_intensity /= (rdf * rdf * rdf);
  }
  
  
  vec3 oldpoint; 
  float pointsqr;
  
  float distance = length(point);

  // Leapfrog geodesic
  for (int i=0; i<NSTEPS;i++){ 
    oldpoint = point; // remember previous point for finding intersection
    
    point += velocity * STEP;
    
    // distance from origin
    float distSq = dot(point, point);
    distance = sqrt(distSq);

    // Optimization: Replace expensive pow() with fast multiplication.
    float dist5 = distSq * distSq * distance;
    
    vec3 accel = -1.5 * h2 * point / dist5;
    velocity += accel * STEP;    
    
    bool horizon_mask = distSq < 1.0 && dot(oldpoint, oldpoint) > 1.0;// intersecting eventhorizon
    // does it enter event horizon?
    if (horizon_mask) {
      // Nothing is shaded here. Everything this ray needs is already in
      // velocity and distance, and both survive the loop — so the far side is
      // worked out after it, once, instead of inside a body the compiler has to
      // budget registers for on every one of the hundreds of steps. See below.
      break;
    }
    
    // intersect accretion disk
    if (accretion_disk){
      if (oldpoint.y * point.y < 0.0){
        // move along y axis
        float lambda = - oldpoint.y/velocity.y;
        vec3 intersection = oldpoint + lambda*velocity;
        float r = length(intersection);//dot(intersection,intersection);
        if (DISK_IN <= r&&r <= DISK_IN+DISK_WIDTH ){
          float phi = atan(intersection.x, intersection.z);
          
          vec3 disk_velocity = vec3(-intersection.x, 0.0, intersection.z) * inversesqrt(2.0*(r-1.0)) / (r*r); 
          phi -= time;
          phi = mod(phi , PI*2.0);
          float disk_gamma = inversesqrt(1.0 - dot(disk_velocity, disk_velocity));
          float disk_doppler_factor = disk_gamma*(1.0+dot(ray_dir/distance, disk_velocity)); // from source 
          
          if (use_disk_texture){
          // texture
            vec2 tex_coord = vec2(mod(phi,2.0*PI)/(2.0*PI),1.0-(r-DISK_IN)/(DISK_WIDTH));
            vec4 disk_color = texture2D(disk_texture, tex_coord) / (ray_doppler_factor * disk_doppler_factor);
            float disk_alpha = clamp(dot(disk_color,disk_color)/4.5,0.0,1.0);

            if (beaming) {
              float ddf = disk_doppler_factor;
              disk_alpha /= (ddf * ddf * ddf);
            }
            
            disk_glow += disk_color.rgb * disk_tint * disk_alpha;
          } else {
          
          // use blackbody 
          float disk_temperature = 10000.0*(pow(r/DISK_IN, -3.0/4.0));
          
            //doppler effect
          if (doppler_shift)
            disk_temperature /= ray_doppler_factor*disk_doppler_factor;

          vec3 disk_color = temp_to_color(disk_temperature) * disk_tint;
          float disk_alpha = clamp(dot(disk_color,disk_color)/3.0,0.0,1.0);
          
          if (beaming) {
            float ddf = disk_doppler_factor;
            disk_alpha /= (ddf * ddf * ddf);
          }
            
          disk_glow += disk_color * disk_alpha;
          
          }
        }
      }
    }
    
  }
  
  // ── The far side of the throat ──
  // Out here rather than in the loop above, and that placement is the whole
  // performance story. Everything below runs at most once per ray, but sitting
  // inside the marching loop it was compiled as part of a body that executes
  // hundreds of times: the register budget is set by the largest the body can
  // ever get, so four sky taps and a galaxy in one arm of one branch cost
  // occupancy on every single step, whether or not any ray ever crossed. Moving
  // it out changed nothing about what is computed and gave the frame rate back.
  //
  // The gate on throat_throughput is the same economy for the black hole, which
  // absorbs and has no far side to shade: it does not run this at all.
  if (distance <= 1.0 && throat_throughput > 0.0) {

    // A black hole absorbs the ray. A wormhole is a hole — it hands back what
    // is on the other side. Either way the ray terminates here, so everything
    // outside still bends around the same mass and the lensing is untouched.
    //
    // velocity at the crossing is the fully bent direction, so the far sky
    // arrives already swirled toward the rim: the crystal-ball distortion is
    // the integrator's doing, not an effect layered on top. No doppler — the
    // far side is not moving with respect to anything here.
    vec3 vdir = normalize(velocity);
    float bend = acos(clamp(dot(orig_ray_dir, vdir), -1.0, 1.0));

    // Compressed, not capped. There is a radius on screen inside which every
    // ray is captured and loops the throat before crossing, and outside which
    // it crosses on the first pass — the same boundary that draws the black
    // hole's shadow. It is a perfect circle. tanh saturated: every looped ray,
    // whether it wound once or ten times, came back with the same deflection,
    // so the whole capture disc went uniform while just outside it the image
    // was still changing fast. Continuous in value, discontinuous in rate,
    // which the eye reads as an edge — a flat window set into the lensing.
    //
    // log never saturates. It still matches bend for small bend and still
    // pulls the deep winding back to something showable, but it keeps a
    // gradient all the way in, so the two families run into each other.
    float bend_eff = bend > 0.0001
      ? throat_bend_clamp * log(1.0 + bend / throat_bend_clamp)
      : bend;
    vec3 through = normalize(mix(orig_ray_dir, vdir,
                                 bend > 0.0001 ? bend_eff / bend : 1.0));

    // ── Why this is here ──
    // The acceleration above is central, so a ray never leaves the plane
    // containing itself and the origin: every ray bends straight toward or
    // away from the throat's centre on screen. The direction we end up
    // sampling is therefore a function of one number — how far the ray passed
    // from the centre — and two pixels at the same screen radius read the same
    // latitude of the far sky. Concentric rings were not an artifact sitting
    // on the image, they were what the mapping can produce.
    //
    // The drag below is what breaks that, but only because it turns about a
    // fixed axis of the throat's own. Turning about the axis to the camera —
    // which is what this did first — is useless for the purpose: that axis IS
    // the symmetry axis of the screen image, so rotating about it slides
    // points along the very circles the problem is made of. Latitude stays
    // constant around each one and the rings survive as spirals.
    //
    // About a fixed axis, how far a ray is dragged depends on where it passed
    // relative to that axis and not just on how close it came, so latitude
    // varies with azimuth and screen-radius circles stop mapping to sky
    // latitude circles. That is also the more honest version: a rotating
    // throat has a spin axis of its own, and light's inclination to it is
    // exactly what decides the drag.
    // The drag rides on a bounded measure of the winding, not on bend_eff.
    // bend_eff now grows without limit toward the centre, and a twist that
    // grew with it would pass a full turn somewhere in the capture disc and
    // wrap — a new circle to replace the one being removed here.
    // Held perpendicular to the view. A rotation about any axis leaves that
    // axis's two poles fixed, and a fixed point in a field of swirling is a
    // centre — so wherever the axis pierces the far sky, a second centre
    // appears next to the throat's own. Taking only the part of the tilt
    // that is across the line of sight throws both poles out to the rim,
    // where the throat's edge covers them, and leaves one centre in frame.
    // Perpendicular is also the far end from the degenerate case: an axis
    // along the view is the screen image's own symmetry axis and does no
    // symmetry breaking at all.
    vec3 view = normalize(cam_dir);
    vec3 axis = normalize(throat_spin_axis - view * dot(view, throat_spin_axis));
    float twist = throat_twist * throat_bend_clamp
                * tanh(bend / throat_bend_clamp);
    float ct = cos(twist);
    float st = sin(twist);
    through = normalize(through * ct
                        + cross(axis, through) * st
                        + axis * dot(axis, through) * (1.0 - ct));

    // One tap, and the star blur rather than several jittered taps.
    //
    // The taps did resolve what one cannot — the mapping is steep enough in here
    // that a pixel covers a long stretch of far sky — but averaging across that
    // stretch is a blur by another name, and the streaked stars are the best
    // thing in the frame. They are what the distortion is legible on. Trading
    // their edges for a quieter interior is a bad trade.
    vec3 far_side = sample_sky(through, throat_sky_rotation, throat_tint,
                               throat_color_plane, throat_color_pole,
                               throat_star_gain, throat_nebula_gain, 1.0,
                               throat_star_blur);
    // Sampled along the same bent direction as the stars, so it is warped by the
    // throat rather than laid over it.
    far_side += galaxy_band(through, throat_band_pole, view,
                            throat_band_color, throat_band_gain);

    // There used to be a grazing-angle rim term here to give the throat an
    // edge. It did, but pow(rim, 3.0) is a function of the crossing angle
    // alone, so it painted the same value all the way around every ray shell
    // and stacked up as hard concentric rings inside the sphere. The swirled
    // sky already reads as a boundary on its own, so the term is gone.

    color += vec4(far_side * throat_throughput, 1.0);
  }

  if (distance > 1.0){

    // ── Background ──
    // The black hole samples this straight down the unbent ray, which is a
    // deliberate call: its own arcs read better against a still field.
    //
    // The wormhole does not get that. It is a hole you look through, and the
    // whole point of the arc around it is that the sky behind is being dragged
    // around the rim — a straight background leaves the arc sitting on top of a
    // field that never moved, and the mouth stops reading as a lens. So the
    // direction bends with the ray here, and bg_lensing carries the world.
    vec3 bg_dir = normalize(mix(orig_ray_dir, normalize(velocity), bg_lensing));
    color += vec4(sample_sky(bg_dir, 45.0, bg_tint,
                             space_color_plane, space_color_pole,
                             bg_star_gain, bg_nebula_gain, ray_doppler_factor, 0.0), 1.0);

    // The domains, added over the sky rather than into sample_sky, because
    // sample_sky is shared with the far side of the throat and the wormhole is
    // not this galaxy. arm_gain carries the world: it is driven to 0 while the
    // wormhole is on screen.
    color += vec4(domain_arms(bg_dir), 0.0);

    // ── The planet ────────────────────────────────────────────────────────
    // Composited alpha-over, and before the star field and the disk, because it
    // orbits further out than either — so both of those add over it, and only the
    // black hole covers it. The block sits inside "distance > 1.0", so rays that
    // end on the horizon never reach it and the shadow stays clean.
    //
    // Sampled along the BENT ray, the same as the star field, by reconstructing a
    // screen position from the ray direction and reading the planet's target
    // there. It used to be sampled at gl_FragCoord — straight down the unbent ray
    // — and the difference is what the planet is allowed to do.
    //
    // Straight, the planet had to be kept angularly clear of the shadow for the
    // whole fall, because a straight ray aimed behind the black hole terminates at
    // the horizon and never reaches this block: the planet would not be occluded
    // so much as deleted. That clearance is a hard floor on how near the black
    // hole it can be placed, and it is the reason the planet kept coming out
    // further away than wanted.
    //
    // Bent, rays that pass close to the black hole curve around it rather than
    // ending on it, so they find the planet even when it is geometrically behind.
    // It goes where it likes: near the rim the image is pushed outward and drawn
    // into an arc, which is the real behaviour, and directly behind it wraps the
    // photon ring instead of vanishing.
    //
    // The inverse of the projection at the top of main(), COMPOSE_SHIFT included.
    // The particle blocks below do the same; all three cameras carry the shift,
    // which is what composeShift.js is for.
    if (planet_amount > 0.0) {
      vec3 planet_dir = show_lensing ? normalize(point - oldpoint) : orig_ray_dir;
      float planet_fwd = dot(planet_dir, forward);
      if (planet_fwd > 0.0) {
        float planet_aspect = resolution.x / resolution.y;
        float planet_x = dot(planet_dir, nright) / (planet_fwd * uvfov * planet_aspect) + COMPOSE_SHIFT;
        float planet_y = dot(planet_dir, up) / (planet_fwd * uvfov) + COMPOSE_SHIFT_Y;
        vec2 planet_uv = vec2(planet_x, planet_y) * 0.5 + 0.5;
        if (planet_uv.x > 0.0 && planet_uv.x < 1.0 && planet_uv.y > 0.0 && planet_uv.y < 1.0) {
          vec4 planet = texture2D(planet_texture, planet_uv);
          color.rgb = mix(color.rgb, planet.rgb, planet.a * planet_amount);
        }
      }
    }

    // ── Screen-space lensed particles (Option B) ──────────────────────────
    // Project the bent ray direction onto the camera frustum to get screen UV,
    // then sample the off-screen particle framebuffer at that position.
    // show_lensing ON  → use lensed direction → particles arc around BH
    // show_lensing OFF → use straight direction → particles at true 3D positions
    //
    // COMPOSE_SHIFT is applied here and the particle camera is built with the
    // matching off-centre frustum. Without it the bounds test below rejected
    // every ray left of u = -0.33, which is the leftmost 33.5 percent of the
    // frame at any aspect ratio: the sprites were not dim there, they were
    // absent, and the sky across that third had no parallax at all.
    vec3 sample_dir = show_lensing ? normalize(point - oldpoint) : orig_ray_dir;
    float fwd_dot = dot(sample_dir, forward);
    if (fwd_dot > 0.0) {
      float aspect = resolution.x / resolution.y;
      float px = dot(sample_dir, nright) / (fwd_dot * uvfov);
      float py = dot(sample_dir, up)    / (fwd_dot * uvfov);
      // Lensed particles (small stars)
      vec2 p_uv = vec2((px / aspect + COMPOSE_SHIFT) * 0.5 + 0.5,
                       (py + COMPOSE_SHIFT_Y) * 0.5 + 0.5);
      if (p_uv.x > 0.0 && p_uv.x < 1.0 && p_uv.y > 0.0 && p_uv.y < 1.0) {
        color += texture2D(particle_texture, p_uv);
      }
    }
    
    // Unlensed particles (bright foreground stars) - always use orig_ray_dir
    float orig_fwd_dot = dot(orig_ray_dir, forward);
    if (orig_fwd_dot > 0.0) {
      float aspect = resolution.x / resolution.y;
      float orig_px = dot(orig_ray_dir, nright) / (orig_fwd_dot * uvfov);
      float orig_py = dot(orig_ray_dir, up)    / (orig_fwd_dot * uvfov);
      vec2 p_uv_unlensed = vec2((orig_px / aspect + COMPOSE_SHIFT) * 0.5 + 0.5,
                                (orig_py + COMPOSE_SHIFT_Y) * 0.5 + 0.5);
      if (p_uv_unlensed.x > 0.0 && p_uv_unlensed.x < 1.0 && p_uv_unlensed.y > 0.0 && p_uv_unlensed.y < 1.0) {
        color += texture2D(particle_texture_unlensed, p_uv_unlensed);
      }
    }

  }

  // Added last so it lies over the planet, which is far outside it.
  color.rgb += disk_glow;

  gl_FragColor = color*ray_intensity*exposure;
}
`;
