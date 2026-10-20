import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fragmentShader as cinematic } from "@/cinematic/scene/graphics/fragmentShader";
import { BAKE_FRAGMENT, DISK_FRAGMENT } from "../shaders";
import { apparentScale, cameraVectors } from "../renderer";

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
    const { position, dir, up } = cameraVectors({ distance: 20, elevationDeg: 30, rollDeg: 0, fovDeg: 60 });
    expect(position[0]).toBeCloseTo(0);
    expect(position[1]).toBeCloseTo(10);
    expect(position[2]).toBeCloseTo(20 * Math.cos(Math.PI / 6));
    expect(dir.map((v, i) => v + position[i] / 20).every((v) => Math.abs(v) < 1e-9)).toBe(true);
    // Up is square to the view and points away from the disk plane.
    expect(up[0] * dir[0] + up[1] * dir[1] + up[2] * dir[2]).toBeCloseTo(0);
    expect(up[1]).toBeGreaterThan(0);
  });

  it("rolls up about the view axis", () => {
    const level = cameraVectors({ distance: 20, elevationDeg: 10, rollDeg: 0, fovDeg: 60 });
    const rolled = cameraVectors({ distance: 20, elevationDeg: 10, rollDeg: 90, fovDeg: 60 });
    const dot = level.up.reduce((sum, v, i) => sum + v * rolled.up[i], 0);
    expect(dot).toBeCloseTo(0);
    expect(rolled.up[0] * rolled.dir[0] + rolled.up[1] * rolled.dir[1] + rolled.up[2] * rolled.dir[2]).toBeCloseTo(0);
  });
});

describe("apparentScale", () => {
  const at = (distance: number) => ({ distance, elevationDeg: 10, rollDeg: 0, fovDeg: 75 });

  it("is 1 when the camera has not moved", () => {
    expect(apparentScale(at(20), at(20))).toBe(1);
  });

  it("grows as the inverse of the distance", () => {
    expect(apparentScale(at(20), at(10))).toBeCloseTo(2);
    expect(apparentScale(at(12), at(20))).toBeCloseTo(0.6);
  });
});