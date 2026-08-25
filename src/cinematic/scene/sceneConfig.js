// The scene's tunable state, without the panel that used to own it.
//
// In portfolio-3D these objects are created by lil-gui: `createConfigGUI` builds
// the folders and hands back the objects the scene then reads every frame. That
// made the tuning panel the source of truth for how the scene runs, which is
// fine in a lab and wrong in a site - lil-gui is a tuning tool and has no place
// in a production bundle, but the values it held are not optional.
//
// So the values live here and the panel stays behind. Shader tuning still
// happens in portfolio-3D, where the tight visual loop is; what lands here is
// the settled result. When a value is retuned there, it is changed here.
//
// Every default below is the value lil-gui starts with, so a scene built from
// this config is the scene as it opens in the lab with nothing touched.

export function createSceneConfig() {
  // Resolution and quality are overwritten by the quality manager as soon as the
  // benchmark finishes. These are only what the first few frames render at.
  const performanceConfig = {
    resolution: 1.0,
    quality: 'high',
    preset: 'high',
    particleScale: 1.0,
  };

  const bloomConfig = {
    strength: 1,
    radius: 1,
    threshold: 0.6,
  };

  const cameraConfig = {
    distance: 25,
    orbit: true,
    fov: 90.0,
    // Off by default: visitors scroll, they do not fly the camera. The drag
    // controls are still wired up so the lab can turn them on.
    enableDrag: false,
    particleOrbit: false,
  };

  const effectConfig = {
    lorentz_transform: true,
    accretion_disk: true,
    use_disk_texture: true,
    doppler_shift: true,
    beaming: true,
    show_lensing: true,
  };

  // The lil-gui build mirrored the quality manager's diagnostics into a folder of
  // disabled fields. Nothing reads them here, but the scene calls this every few
  // frames, so it stays as a no-op rather than becoming a null check on the hot
  // path. The FPS meter and the preset switcher cover what those fields showed.
  function updateDiagnostics() {}

  function disposeConfig() {}

  return {
    performanceConfig,
    bloomConfig,
    cameraConfig,
    effectConfig,
    updateDiagnostics,
    disposeConfig,
  };
}
