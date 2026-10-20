import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fragmentShader as cinematic } from "@/cinematic/scene/graphics/fragmentShader";
import { BAKE_FRAGMENT, DISK_FRAGMENT } from "../shaders";
import { cameraVectors } from "../renderer";
import { HOME_PATH, STILL_PATH, STOP_MOVE_MS, cameraBetween, moveEase } from "../BakedBlackhole";

/** Whitespace is free to differ between the two; nothing else is. */
const squash = (source: string) => source.replace(/\s+/g, "");

// The baked black hole is only the cinematic's black hole while these lines are
// the cinematic's lines. Each one decides where a ray goes or what colour the
// disk is where it lands, and a retune in portfolio-3D that reaches the
// cinematic would otherwise leave the homepage drawing the old one.
const GEODESIC = [
  "vec3 c = cross(point,velocity);",
  "float h2 = dot(c,c);",
  "point += velocity * STEP;",
  "float dist5 = distSq * distSq * distance;",
  "vec3 accel = -1.5 * h2 * point / dist5;",
  "velocity += accel * STEP;",
  "oldpoint.y * point.y < 0.0",
  "float lambda = - oldpoint.y/velocity.y;",
  "vec3 intersection = oldpoint + lambda*velocity;",
  "float phi = atan(intersection.x, intersection.z);",
  "vec3 disk_velocity = vec3(-intersection.x, 0.0, intersection.z) * inversesqrt(2.0*(r-1.0)) / (r*r);",
  "float disk_gamma = inversesqrt(1.0 - dot(disk_velocity, disk_velocity));",
  "float disk_doppler_factor = disk_gamma*(1.0+dot(ray_dir/distance, disk_velocity));",
  "const float DISK_IN = 2.0;",
  "const float DISK_WIDTH = 4.0;",
  "vec3 new_u = (u/gamma - v + (gamma/(gamma+1.0)) * dot(u,v)*v)/denominator;",
  "ray_dir = lorentz_transform_velocity(ray_dir, cam_vel);",
  "float ray_gamma = inversesqrt(1.0 - dot(cam_vel, cam_vel));",
  "float ray_doppler_factor = ray_gamma * (1.0 + dot(ray_dir, -cam_vel));",
];

const SHADING = [
  "float disk_alpha = clamp(dot(disk_color,disk_color)/4.5,0.0,1.0);",
];

describe("the baked black hole", () => {
  for (const line of GEODESIC) {
    it(`integrates rays as the cinematic does: ${line}`, () => {
      expect(squash(cinematic)).toContain(squash(line));
      expect(squash(BAKE_FRAGMENT)).toContain(squash(line));
    });
  }

  for (const line of SHADING) {
    it(`shades the disk as the cinematic does: ${line}`, () => {
      expect(squash(cinematic)).toContain(squash(line));
      expect(squash(DISK_FRAGMENT)).toContain(squash(line));
    });
  }

  it("bakes at the cinematic's high-tier step size and count", () => {
    const render = readFileSync(new URL("../../../cinematic/scene/graphics/render.js", import.meta.url), "utf8");
    const high = render.slice(render.indexOf("case 'high':"), render.indexOf("break;", render.indexOf("case 'high':")));
    const step = high.match(/STEP = ([\d.]+)/)?.[1];
    const steps = high.match(/NSTEPS = (\d+)/)?.[1];
    expect(BAKE_FRAGMENT).toContain(`#define STEP ${step}`);
    expect(BAKE_FRAGMENT).toContain(`#define NSTEPS ${steps}`);
  });

  it("blooms with the values the cinematic settles on at the black hole", () => {
    const main = readFileSync(new URL("../../../cinematic/scene/main.js", import.meta.url), "utf8");
    const component = readFileSync(new URL("../BakedBlackhole.tsx", import.meta.url), "utf8");
    const strength = main.match(/bloomPass\.strength = bloomConfig\.strength \+ \(([\d.]+) - bloomConfig\.strength\)/)?.[1];
    const threshold = main.match(/bloomPass\.threshold = bloomConfig\.threshold \+ \(([\d.]+) - bloomConfig\.threshold\)/)?.[1];
    expect(strength).toBeDefined();
    expect(threshold).toBeDefined();
    expect(component).toContain(`strength: ${strength}`);
    expect(component).toContain(`threshold: ${threshold}`);
  });
});

describe("cameraVectors", () => {
  it("places the camera above the disk looking at the hole, as the Observer does", () => {
    const { position, dir, up } = cameraVectors({ distance: 20, elevationDeg: 30, rollDeg: 0, fovDeg: 60, shift: [0, 0] });
    expect(position[0]).toBeCloseTo(0);
    expect(position[1]).toBeCloseTo(10);
    expect(position[2]).toBeCloseTo(20 * Math.cos(Math.PI / 6));
    expect(dir.map((v, i) => v + position[i] / 20).every((v) => Math.abs(v) < 1e-9)).toBe(true);
    // Up is square to the view and points away from the disk plane.
    expect(up[0] * dir[0] + up[1] * dir[1] + up[2] * dir[2]).toBeCloseTo(0);
    expect(up[1]).toBeGreaterThan(0);
  });

  it("rolls up about the view axis", () => {
    const level = cameraVectors({ distance: 20, elevationDeg: 10, rollDeg: 0, fovDeg: 60, shift: [0, 0] });
    const rolled = cameraVectors({ distance: 20, elevationDeg: 10, rollDeg: 90, fovDeg: 60, shift: [0, 0] });
    const dot = level.up.reduce((sum, v, i) => sum + v * rolled.up[i], 0);
    expect(dot).toBeCloseTo(0);
    expect(rolled.up[0] * rolled.dir[0] + rolled.up[1] * rolled.dir[1] + rolled.up[2] * rolled.dir[2]).toBeCloseTo(0);
  });
});

describe("the home page's path", () => {
  const main = readFileSync(new URL("../../../cinematic/scene/main.js", import.meta.url), "utf8");
  const shader = readFileSync(new URL("../../../cinematic/scene/graphics/fragmentShader.ts", import.meta.url), "utf8");
  const sceneConfig = readFileSync(new URL("../../../cinematic/scene/sceneConfig.js", import.meta.url), "utf8");
  const number = (source: string, pattern: RegExp) => Number(source.match(pattern)?.[1]);
  const desktop = { width: 1440, height: 900, wide: true };
  const phone = { width: 390, height: 844, wide: false };

  // The scroll ends on the cinematic's framing of the reference image: its
  // elevation, roll and compose shift. A retune there should move the
  // homepage's end with it.
  it("ends on the cinematic's framing of the reference", () => {
    const { end } = HOME_PATH(desktop);
    expect(end.elevationDeg).toBe(number(main, /endElev = ([\d.]+) \*/));
    expect(end.rollDeg).toBe(number(main, /endRoll = ([\d.]+) \*/));
    expect(end.shift).toEqual([
      number(shader, /const float COMPOSE_SHIFT = ([\d.]+);/),
      number(shader, /const float COMPOSE_SHIFT_Y = ([\d.]+);/),
    ]);
  });

  // The cinematic ends at 3.6 with a 90 degree field of view, inside the disk.
  // The homepage ends outside it, zoomed in to keep the shadow the same size:
  // the same tan(fov / 2) * distance, near enough.
  it("ends outside the disk, with the shadow the size the cinematic's was", () => {
    const { end } = HOME_PATH(desktop);
    const cinematicDistance = number(main, /blackHoleDist = ([\d.]+) \*/);
    const cinematicFov = number(sceneConfig, /fov: ([\d.]+),/);
    expect(end.distance).toBeGreaterThan(6);
    const size = (distance: number, fov: number) => 1 / (distance * Math.tan((fov * Math.PI) / 360));
    expect(size(end.distance, end.fovDeg) / size(cinematicDistance, cinematicFov)).toBeCloseTo(1, 1);
  });

  it("backs off on a narrow screen as the cinematic does", () => {
    const backOff = number(main, /\(1\.0 \+ ([\d.]+) \* narrowFraming\)/);
    const aspect = phone.width / phone.height;
    const narrow = Math.min(1, Math.max(0, (1.2 - aspect) / 0.8));
    expect(HOME_PATH(phone).end.distance).toBeCloseTo(7 * (1 + backOff * narrow));
  });

  it("starts level and smaller than the video", () => {
    const { start } = HOME_PATH(desktop);
    expect(start.rollDeg).toBe(0);
    expect(start.distance).toBeGreaterThan(20);
  });

  it("grows steadily: the inverse distance moves in step along the path", () => {
    const { start, end } = HOME_PATH(desktop);
    const half = cameraBetween(start, end, 0.5);
    expect(1 / half.distance).toBeCloseTo((1 / start.distance + 1 / end.distance) / 2);
    expect(cameraBetween(start, end, 0)).toEqual(start);
    expect(cameraBetween(start, end, 1).distance).toBeCloseTo(end.distance);
  });

  it("holds the starting frame away from the home page", () => {
    const { start, end } = STILL_PATH(desktop);
    expect(end).toEqual(start);
    expect(start).toEqual(HOME_PATH(desktop).start);
  });
});

describe("moving between stops", () => {
  it("starts and lands still, and is over in STOP_MOVE_MS", () => {
    expect(moveEase(0)).toBe(0);
    expect(moveEase(STOP_MOVE_MS)).toBe(1);
    expect(moveEase(STOP_MOVE_MS * 2)).toBe(1);
    expect(moveEase(-100)).toBe(0);
    expect(moveEase(STOP_MOVE_MS / 2)).toBeCloseTo(0.5);
    // Eased in and out: slow at both ends, so no jolt on leaving or arriving.
    const step = STOP_MOVE_MS / 100;
    expect(moveEase(step)).toBeLessThan(0.001);
    expect(1 - moveEase(STOP_MOVE_MS - step)).toBeLessThan(0.001);
  });

  it("never runs backwards", () => {
    let last = 0;
    for (let ms = 0; ms <= STOP_MOVE_MS; ms += 10) {
      expect(moveEase(ms)).toBeGreaterThanOrEqual(last);
      last = moveEase(ms);
    }
  });
});
