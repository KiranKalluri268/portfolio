// The off-centre projection, in one place.
//
// fragmentShader.glsl slides its image plane sideways and up so the black hole
// composes off to the right and above the middle rather than dead centre. It
// does that by subtracting COMPOSE_SHIFT from the screen coordinate before it
// builds the ray, which means the frustum the raymarcher actually sees is the
// usual one moved bodily off the view axis — the same size, not the same place.
//
// Anything rendered to its own target and sampled back by ray direction has to
// carry the identical shift, or the two disagree about where a direction lands
// on the screen. Two things do that: the planet, and the star sprites. They had
// separate answers to it — the planet a correct one, the sprites none at all —
// which is what this module exists to stop.
//
// Must match the constants at the top of fragmentShader.glsl.
export const COMPOSE_SHIFT = 0.67;
export const COMPOSE_SHIFT_Y = 0.26;

const DEG_TO_RAD = Math.PI / 180;

// Build the shifted frustum onto a camera, in place of updateProjectionMatrix().
//
// Deriving it: the shader builds its ray as forward + right*x*t + up*y*t, where
// t = tan(fov/2), y runs -1 to 1 up the screen, and x runs -1 to 1 across it,
// shifted by COMPOSE_SHIFT and then scaled by the aspect ratio. Its right vector
// is cross(forward, up), which in three.js view space — where forward is -Z and
// up is +Y — is +X. So the two agree on handedness, and the near plane bounds
// fall straight out of substituting x and y at the edges.
//
// updateProjectionMatrix() is deliberately not called: it would overwrite this
// with the centred frustum. Cameras using this must route every projection
// change through here.
export function applyComposeShiftProjection(camera, fov, aspect) {
  const halfHeight = camera.near * Math.tan(fov / 2 * DEG_TO_RAD);
  const halfWidth = halfHeight * aspect;
  camera.projectionMatrix.makePerspective(
    (-1 - COMPOSE_SHIFT) * halfWidth,
    (1 - COMPOSE_SHIFT) * halfWidth,
    (1 - COMPOSE_SHIFT_Y) * halfHeight,
    (-1 - COMPOSE_SHIFT_Y) * halfHeight,
    camera.near,
    camera.far,
  );
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
