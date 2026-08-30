import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  COMPOSE_SHIFT,
  COMPOSE_SHIFT_Y,
  applyComposeShiftProjection,
} from '../composeShift';

// The shader builds its ray as
//
//   forward + right * (u - COMPOSE_SHIFT) * aspect * t + up * (v - COMPOSE_SHIFT_Y) * t
//
// for screen coordinates u, v running -1..1 and t = tan(fov/2). These helpers
// are that formula and nothing else, so a test that agrees with them is a test
// that agrees with the raymarcher rather than with this module's own arithmetic.
const FOV = 60;
const ASPECT = 16 / 9;
const t = Math.tan((FOV / 2) * (Math.PI / 180));

/** The world direction the raymarcher draws at screen position (u, v). */
function rayForScreen(u: number, v: number) {
  // Camera at the origin looking down -Z, three.js style: right is +X, up is +Y.
  return new THREE.Vector3(
    (u - COMPOSE_SHIFT) * ASPECT * t,
    (v - COMPOSE_SHIFT_Y) * t,
    -1,
  ).normalize();
}

/**
 * Where a camera puts that direction on its render target, in -1..1 NDC.
 *
 * Untyped because three 0.148 ships no declarations — see ../../three.d.ts for
 * why there is a shim rather than @types/three.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function projectToNdc(camera: any, dir: any) {
  return dir.clone().multiplyScalar(10).applyMatrix4(camera.projectionMatrix);
}

function shiftedCamera() {
  const camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 100000);
  applyComposeShiftProjection(camera, FOV, ASPECT);
  return camera;
}

function centredCamera() {
  const camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 100000);
  camera.updateProjectionMatrix();
  return camera;
}

describe('applyComposeShiftProjection', () => {
  it('lands the ray drawn at the screen centre on the centre of the target', () => {
    const ndc = projectToNdc(shiftedCamera(), rayForScreen(0, 0));
    expect(ndc.x).toBeCloseTo(0, 6);
    expect(ndc.y).toBeCloseTo(0, 6);
  });

  it.each([
    ['left edge', -1, 0],
    ['right edge', 1, 0],
    ['bottom left corner', -1, -1],
    ['top right corner', 1, 1],
  ])('agrees with the raymarcher at the %s', (_name, u, v) => {
    const ndc = projectToNdc(shiftedCamera(), rayForScreen(u, v));
    expect(ndc.x).toBeCloseTo(u, 6);
    expect(ndc.y).toBeCloseTo(v, 6);
  });

  // The defect this module exists to fix. A centred camera covers screen
  // coordinates u > -0.33 only, because the raymarcher's frame reaches 1.67
  // half-screens left of the axis and a centred frustum reaches 1.0. Everything
  // further left sampled outside the target and drew nothing.
  it('covers the left third of the frame, which a centred camera does not', () => {
    const farLeft = rayForScreen(-0.9, 0);

    const centred = projectToNdc(centredCamera(), farLeft);
    expect(Math.abs(centred.x)).toBeGreaterThan(1);

    const shifted = projectToNdc(shiftedCamera(), farLeft);
    expect(Math.abs(shifted.x)).toBeLessThan(1);
  });

  it('covers the bottom of the frame, which a centred camera does not', () => {
    const bottom = rayForScreen(0, -0.9);

    expect(Math.abs(projectToNdc(centredCamera(), bottom).y)).toBeGreaterThan(1);
    expect(Math.abs(projectToNdc(shiftedCamera(), bottom).y)).toBeLessThan(1);
  });

  // -0.33 across is where a centred frustum runs out, so it is the boundary the
  // old behaviour had and the number quoted in the shader comment. Pinning both
  // sides of it stops the coverage tests above passing on a frustum that is
  // merely bigger rather than correctly placed.
  it('puts the centred camera cutoff exactly where the shift predicts', () => {
    const centred = centredCamera();
    const cutoff = COMPOSE_SHIFT - 1;
    expect(cutoff).toBeCloseTo(-0.33, 2);

    const justInside = projectToNdc(centred, rayForScreen(cutoff + 0.02, 0));
    const justOutside = projectToNdc(centred, rayForScreen(cutoff - 0.02, 0));
    expect(Math.abs(justInside.x)).toBeLessThan(1);
    expect(Math.abs(justOutside.x)).toBeGreaterThan(1);
  });

  it('keeps the inverse in step with the matrix it just built', () => {
    const camera = shiftedCamera();
    const identity = camera.projectionMatrix
      .clone()
      .multiply(camera.projectionMatrixInverse);
    for (const [i, expected] of new THREE.Matrix4().elements.entries()) {
      expect(identity.elements[i]).toBeCloseTo(expected, 6);
    }
  });

  it('rebuilds the shift when the aspect ratio changes', () => {
    const camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 100000);
    applyComposeShiftProjection(camera, FOV, ASPECT);
    const wide = camera.projectionMatrix.elements.slice();

    applyComposeShiftProjection(camera, FOV, 0.5);
    expect(camera.projectionMatrix.elements.slice()).not.toEqual(wide);

    // Still off-centre by the same fraction of the frame, not by the same
    // distance — the shift is in half-screens and has to survive the reshape.
    expect(camera.projectionMatrix.elements[8]).toBeCloseTo(-COMPOSE_SHIFT, 6);
    expect(camera.projectionMatrix.elements[9]).toBeCloseTo(-COMPOSE_SHIFT_Y, 6);
  });
});
