import * as THREE from 'three';
import { createCamera, createRenderer, createScene, createShaderProjectionPlane, loadTextures, createParticleSystem } from './graphics/render';
import { createStatsGUI } from './gui/statsGUI';
import { createSceneConfig } from './sceneConfig';
import { createPresetSwitcher } from './gui/presetSwitcher';
import { ThreeDQualityManager } from './performance/ThreeDQualityManager';
import { createStoryOverlay } from './story/StoryOverlay';
import { createTunnel } from './graphics/tunnel';
import { createPlanet } from './graphics/planet';

/**
 * Start the journey inside `root` and return the function that tears it down.
 *
 * In portfolio-3D this file is a top-level IIFE: the page is the scene, it runs
 * on load, and it only ever stops when the tab closes. Here it is one route
 * among many, mounted and unmounted by React, possibly more than once in a
 * session and twice in a row under StrictMode. So the body became a function
 * and the teardown became its return value. `disposeApp` already existed and
 * already released everything - it was simply wired to `beforeunload`, which is
 * not an event a client-side route change fires.
 *
 * @param {HTMLElement} root - the element the canvas and overlays live in. Every
 *   piece of DOM the scene reads is looked up inside it rather than in the
 *   document, so nothing here can collide with the rest of the site.
 * @param {import('lenis').default} lenis - the site's scroll instance. The
 *   journey is a pure function of scroll position and the site already owns one
 *   Lenis in the root layout; a second one would mean two sources of truth for
 *   a single number. See docs/ANIMATIONS.md.
 * @param {boolean} [showDevTools] - render the FPS meter and tier switcher.
 * @returns {Promise<() => void>} teardown
 */
export async function mountCinematic(root, lenis, showDevTools = false) {

  const loadingOverlay = root.querySelector('[data-cinematic="loading-overlay"]')
  const loadingPercentage = root.querySelector('[data-cinematic="loading-percentage"]')
  const loadingStatus = root.querySelector('[data-cinematic="loading-status"]')
  const sourceLicenseLinks = root.querySelector('[data-cinematic="source-license-links"]')
  const transitionVeil = root.querySelector('[data-cinematic="transition-veil"]')
  const cockpitVignette = root.querySelector('[data-cinematic="cockpit-vignette"]')
  let loadingTargetProgress = 0
  let loadingDisplayedProgress = 0
  let loadingReadyToDismiss = false
  let entryGateArmed = false
  let entryHoldTimer = null
  const ENTRY_HOLD_DURATION_MS = 900
  const storyOverlay = createStoryOverlay(root.querySelector('[data-cinematic="story-overlay"]'))
  // Namespaced, unlike portfolio-3D's bare `is-loading`. This document belongs
  // to a whole site rather than to the scene, and the site has a loading screen
  // of its own that could reasonably want that name later.
  document.documentElement.classList.add('cinematic-loading')
  window.scrollTo(0, 0)

  function setLoadingStage(message, progress) {
    loadingTargetProgress = Math.max(loadingTargetProgress, progress)
    if (loadingStatus) loadingStatus.textContent = message
  }

  function updateLoadingProgress(frameDeltaSeconds) {
    // Frame-rate independent easing. A fixed 0.08-per-frame lerp is ~0.2s at
    // 60fps but crawls to nearly a minute at 1fps — on exactly the slow devices
    // where everything is already loaded and the visitor is staring at 89%.
    // This reproduces the 60fps feel at any frame rate.
    const smoothing = 1 - Math.pow(1 - 0.08, Math.min(frameDeltaSeconds, 0.5) * 60)
    loadingDisplayedProgress += (loadingTargetProgress - loadingDisplayedProgress) * smoothing
    if (loadingTargetProgress >= 100 && loadingDisplayedProgress > 99.5) loadingDisplayedProgress = 100
    if (loadingPercentage) loadingPercentage.textContent = `${Math.floor(loadingDisplayedProgress)}%`
    if (loadingReadyToDismiss && loadingDisplayedProgress === 100 && !entryGateArmed) {
      armEntryGate()
    }
  }

  function armEntryGate() {
    entryGateArmed = true
    const usesTouch = window.matchMedia('(pointer: coarse)').matches
    if (loadingStatus) {
      loadingStatus.textContent = usesTouch
        ? 'Touch and hold to enter the spaceship'
        : 'Click and hold to enter the spaceship'
    }
    loadingOverlay?.classList.add('ready-to-enter')
    loadingOverlay?.addEventListener('pointerdown', startEntryHold)
    loadingOverlay?.addEventListener('pointerup', cancelEntryHold)
    loadingOverlay?.addEventListener('pointercancel', cancelEntryHold)
    loadingOverlay?.addEventListener('pointerleave', cancelEntryHold)
    window.addEventListener('keydown', handleEntryKeydown)
  }

  function startEntryHold(event) {
    if (!entryGateArmed || loadingOverlayDismissed || entryHoldTimer) return
    event.preventDefault()
    loadingOverlay?.setPointerCapture?.(event.pointerId)
    loadingOverlay?.classList.add('holding-entry')
    entryHoldTimer = window.setTimeout(enterSite, ENTRY_HOLD_DURATION_MS)
  }

  function cancelEntryHold() {
    if (entryHoldTimer) window.clearTimeout(entryHoldTimer)
    entryHoldTimer = null
    loadingOverlay?.classList.remove('holding-entry')
  }

  function handleEntryKeydown(event) {
    if (event.key === 'Enter') enterSite()
  }

  function enterSite() {
    if (!entryGateArmed || loadingOverlayDismissed) return

    cancelEntryHold()
    loadingOverlayDismissed = true
    loadingOverlay?.removeEventListener('pointerdown', startEntryHold)
    loadingOverlay?.removeEventListener('pointerup', cancelEntryHold)
    loadingOverlay?.removeEventListener('pointercancel', cancelEntryHold)
    loadingOverlay?.removeEventListener('pointerleave', cancelEntryHold)
    window.removeEventListener('keydown', handleEntryKeydown)
    document.documentElement.classList.remove('cinematic-loading')
    lenis.start()
    loadingOverlay?.classList.add('loaded')
    loadingOverlay?.addEventListener('transitionend', () => loadingOverlay.remove(), { once: true })
  }

  setLoadingStage('Initializing renderer...', 3)

  let lastframe = performance.now()
  let delta = 0
  let time = 0
  let lastScrollY = window.scrollY
  let orbitDirection = 1;         // 1 for forward, -1 for backward
  let currentOrbitSpeed = 0.05;   // current smoothly interpolated speed
  const BASE_ORBIT_SPEED = 0.05;  // constant idle spin
  const PERFORMANCE_PRESETS = {
    low: {
      resolution: 0.5,
      maxPixelRatio: 1.0,
      quality: 'low',
      bloomStrength: 1,
      bloomRadius: 1,
      particleScale: 1.0,
    },
    medium: {
      resolution: 0.75,
      maxPixelRatio: 1.25,
      quality: 'medium',
      bloomStrength: 1,
      bloomRadius: 1,
      particleScale: 1.0,
    },
    high: {
      resolution: 1.0,
      maxPixelRatio: 1.5,
      quality: 'high',
      bloomStrength: 1,
      bloomRadius: 1,
      particleScale: 1.0,
    },
  };

  // Initial loading and frame-time benchmark state.
  let texturesLoaded = false;
  let initialQualityBenchmarkComplete = false;
  let benchmarkStarted = false;
  let loadingOverlayDismissed = false;

  // set variables types for shader
  const uniforms = {
    time: { type: "f", value: 0.0 },
    resolution: { type: "v2", value: new THREE.Vector2() },
    accretion_disk: { type: "b", value: false },
    use_disk_texture: { type: "b", value: true },
    lorentz_transform: { type: "b", value: false },
    doppler_shift: { type: "b", value: false },
    beaming: { type: "b", value: false },
    cam_pos: { type: "v3", value: new THREE.Vector3() },
    cam_vel: { type: "v3", value: new THREE.Vector3() },
    cam_dir: { type: "v3", value: new THREE.Vector3() },
    cam_up: { type: "v3", value: new THREE.Vector3() },
    fov: { type: "f", value: 0.0 },
    bg_texture: { type: "t", value: null },
    star_texture: { type: "t", value: null },
    disk_texture: { type: "t", value: null },
    particle_texture: { type: "t", value: null },
    particle_texture_unlensed: { type: "t", value: null },
    planet_texture: { type: "t", value: null },
    planet_amount: { type: "f", value: 0.0 },
    show_lensing: { type: "b", value: true },
    exposure: { type: "f", value: 1.0 },
    bg_lensing: { type: "f", value: 0.0 },
    // Defaults reproduce the black hole exactly — the values below are the
    // constants they replaced in the shader. The journey drives them.
    // throat_throughput at 0 collapses the horizon branch back to black, so the
    // whole approach is untouched however the rest of these are tuned.
    throat_throughput: { type: "f", value: 0.0 },
    disk_tint: { type: "v3", value: new THREE.Vector3(1.0, 1.0, 1.0) },
    bg_tint: { type: "v3", value: new THREE.Vector3(1.0, 1.0, 1.0) },
    space_color_plane: { type: "v3", value: new THREE.Vector3(0.01, 0.013, 0.03) },
    space_color_pole: { type: "v3", value: new THREE.Vector3(0.0, 0.0, 0.006) },
    // The far side. Rotated well away from the background's own 45° so the star
    // pattern through the throat is visibly not the star pattern around it, and
    // landed on 40° because that patch of the nebula plate has the clumpy
    // structure the reference shows rather than an even wash.
    //
    // The sphere is warm and mostly dark. The nebula plate carries the body of
    // it — the tint is what makes it amber rather than the blue it inherited
    // from bg_tint never reaching this far — and the stars are turned right
    // down. Every ray that crosses the throat has wound some way around it
    // first, so a bright point source gets dragged into a full circle: at the
    // old gain of 4 the far side was a bullseye of smeared star tracks. At 0.35
    // they read as the sparse speckle they are meant to be.
    throat_sky_rotation: { type: "f", value: 40.0 },
    throat_color_plane: { type: "v3", value: new THREE.Vector3(0.020, 0.009, 0.007) },
    throat_color_pole: { type: "v3", value: new THREE.Vector3(0.006, 0.002, 0.002) },
    // Sets how hard the deflection is compressed, and with it how far into the
    // sky the deep interior is allowed to swing. The spin axis sits square to
    // the view, so its poles are a quarter turn out; keeping the swing short of
    // that keeps them off screen entirely rather than merely near the rim.
    throat_bend_clamp: { type: "f", value: 0.3 },
    // Tilted off every scene axis on purpose. Aligned with the view or with the
    // disk normal it lines back up with the screen's own symmetry and the rings
    // start coming back.
    throat_spin_axis: { type: "v3", value: new THREE.Vector3(0.35, 0.82, 0.45).normalize() },
    // Raised to hold the drag where it was: the twist is scaled by the clamp,
    // so shortening the swing above would otherwise have weakened it too.
    throat_twist: { type: "f", value: 5.0 },
    throat_star_blur: { type: "f", value: 1.0 },
    throat_tint: { type: "v3", value: new THREE.Vector3(1.0, 0.66, 0.44) },
    throat_star_gain: { type: "f", value: 0.35 },
    throat_nebula_gain: { type: "f", value: 1.6 },
    // The galaxy on the far side. Only the part of this pole across the line of
    // sight is used, so what it really sets is the angle the band lies at over
    // the mouth; the shader holds it square to the view so the band crosses the
    // middle rather than circling the rim.
    throat_band_pole: { type: "v3", value: new THREE.Vector3(0.30, 0.88, -0.37).normalize() },
    throat_band_color: { type: "v3", value: new THREE.Vector3(0.075, 0.050, 0.034) },
    throat_band_gain: { type: "f", value: 1.0 },
  }

  // Where we start: warm sky, and no accretion disk. The disk is the black
  // hole's tell — the dark gap between the horizon at r=1 and the disk's inner
  // edge at r=2 is the silhouette itself — so the wormhole does without one.
  const WORMHOLE = {
    throatThroughput: 1.0,
    diskTint: new THREE.Vector3(0.62, 0.86, 1.0),
    bgTint: new THREE.Vector3(1.0, 0.82, 0.72),
    spaceColorPlane: new THREE.Vector3(0.045, 0.022, 0.028),
    spaceColorPole: new THREE.Vector3(0.012, 0.004, 0.008),
    bgLensing: 1.0,
  }
  // Where we come out. Captured before anything drives them, so these are the
  // values the shader was built with and the black hole is exactly itself.
  const BLACK_HOLE = {
    throatThroughput: 0.0,
    diskTint: uniforms.disk_tint.value.clone(),
    bgTint: uniforms.bg_tint.value.clone(),
    spaceColorPlane: uniforms.space_color_plane.value.clone(),
    spaceColorPole: uniforms.space_color_pole.value.clone(),
    bgLensing: 0.0,
  }

  // Phase boundaries, in viewport units of scroll. body height in style.css has
  // to cover approachEnd with room to spare.
  //
  // The wormhole comes first and the black hole last, the order Interstellar
  // puts them in: cross to the throat, pass through it, and fall toward
  // Gargantua on the other side.
  const JOURNEY = {
    crossingEnd: 5.0,
    blackoutEnd: 6.5,
    tunnelEnd: 11.5,
    arrivalEnd: 13.0,
    // The fall itself (arrivalEnd to here) is 14 units, twice its old length —
    // starting the black hole further out (see arriveDist) and not shortening the
    // scroll it takes to close the distance is what makes the extra distance
    // actually felt rather than just eased through faster.
    approachEnd: 27.0,
  }

  // Where the benchmark parks the camera while it judges this device.
  //
  // Scroll sits at zero during loading, and at zero the journey is the wormhole
  // seen from 22 units out: a small bright shape on a mostly empty frame, and
  // about the cheapest thing this scene ever draws. The expensive part is the
  // fall — the raymarcher up close, the disk filling the frame, rays bent far
  // enough round the photon sphere to spend most of their step budget. Judging
  // a device on the opening and then sending it into the fall is measuring the
  // wrong workload, and it comes out optimistic every time. Measured on a
  // Realme 9 Speed Edition, high runs at 75fps inside the tunnel and 5-10fps in
  // the fall: same tier, same device, a tenfold spread across one journey.
  //
  // 0.85 of the approach rather than the very last frame. The fall is nearly at
  // its closest here, so it stands in for the worst the device will be asked
  // for, while staying clear of the final frame's viewport-dependent framing.
  // One global tier has to survive the most expensive moment, so that is the
  // moment to measure.
  const BENCHMARK_APPROACH_PROGRESS = 0.85
  const BENCHMARK_POSE_UNITS =
    JOURNEY.arrivalEnd + (JOURNEY.approachEnd - JOURNEY.arrivalEnd) * BENCHMARK_APPROACH_PROGRESS

  // The pose is only ever held behind the loading overlay. The entry gate cannot
  // arm until loading progress reaches 100, and only the benchmark's own
  // completion takes it there, so there is no ordinary path where a visitor is
  // looking at the scene while this is on. The dismissal check is a second lock
  // on that, not the first: if it ever did overlap, the visitor would find the
  // camera somewhere they did not scroll to.
  function benchmarkPoseActive() {
    return benchmarkStarted && !initialQualityBenchmarkComplete && !loadingOverlayDismissed
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value))
  }

  function smoothstep(t) {
    return t * t * (3.0 - 2.0 * t)
  }

  // create scene, 3d context, etc.. instances
  const renderer = createRenderer()
  const { composer, bloomPass, scene, camera, renderPass, disposeScene } = createScene(renderer);
  root.appendChild(renderer.domElement)
  setLoadingStage('Loading assets...', 10)

  // init graphics — textures load async; ready resolves when all are done
  const { textures, ready, disposeTextures } = loadTextures(({ loaded, total }) => {
    setLoadingStage(`Loading assets... ${loaded} / ${total}`, 10 + (loaded / total) * 60)
  });
  setLoadingStage('Compiling black hole shader...', 18)
  const { mesh, changePerformanceQuality, disposeShaderPlane } = await createShaderProjectionPlane(uniforms);
  // add shader plane to scene
  scene.add(mesh);
  setLoadingStage('Initializing camera...', 22)

  // setup camera
  const { observer, cameraControl } = createCamera(renderer);
  scene.add(observer)
  setLoadingStage('Initializing particle field...', 26)

  // particle system — 3D stars rendered to offscreen target, lensed in shader
  const { 
    particleSceneLensed, 
    particleTargetLensed,
    particleSceneUnlensed, 
    particleTargetUnlensed,
    particleCamera,
    resizeParticleTargets,
    disposeParticleSystem
  } = createParticleSystem();
  uniforms.particle_texture.value = particleTargetLensed.texture;
  uniforms.particle_texture_unlensed.value = particleTargetUnlensed.texture;

  // The passage between the two worlds. Rendered through the same composer, so
  // it inherits bloom without a second post-processing chain.
  const { tunnelScene, tunnelCamera, updateTunnel, resizeTunnel, disposeTunnel, setTunnelTextures } =
    createTunnel(window.innerWidth / window.innerHeight);
  let tunnelActive = false;

  // Somewhere to arrive. Rendered to its own target and sampled by the shader —
  // see src/graphics/planet.js for why it does not share the particle ones.
  //
  // Unmounted. The placement is settled and the lensed compositing works, but the
  // last pass put the planet low enough to graze the accretion disk and near
  // enough that the end of the fall is governed by the photon ring rather than by
  // where the planet is anchored — neither of which has been looked at yet. See
  // status.md for where it was left and what the open questions are.
  //
  // Nothing is deleted or unwired. This flag is the whole of it: false and the
  // target is never created, never drawn, and planet_amount stays at 0 so the
  // shader's planet block never runs. True puts it back exactly as it was.
  const PLANET_ENABLED = false;

  const planet = PLANET_ENABLED
    ? createPlanet(window.innerWidth, window.innerHeight)
    : null;
  if (planet) uniforms.planet_texture.value = planet.planetTarget.texture;
  ready.then(() => {
    uniforms.bg_texture.value = textures.get('bg1')
    uniforms.star_texture.value = textures.get('star')
    uniforms.disk_texture.value = textures.get('disk')
    // The passage borrows the world's sky plates for its walls.
    setTunnelTextures(textures.get('star'), textures.get('bg1'))
  });

  // The scene's tunable state. In portfolio-3D lil-gui owns these objects and
  // hands them over; here they are plain defaults, because a tuning panel does
  // not belong in a site bundle and the values it held still do. See
  // sceneConfig.js.
  const { cameraConfig, effectConfig, performanceConfig, bloomConfig, updateDiagnostics, disposeConfig } =
    createSceneConfig();
  let qualityManager;

  // The FPS meter and the tier switcher are the two things worth having on a
  // real phone: watching a tier settle and holding one still is exactly what
  // cannot be done from a desktop. They are still instruments rather than site
  // furniture, so they only appear when the flag asks for them.
  const stats = showDevTools ? createStatsGUI() : null;
  if (stats) root.appendChild(stats.dom);

  // A hand-picked preset pins the manager: it may still drop the tier to protect
  // the frame rate, but it stops probing upward. Selecting the tier already
  // running still pins it, which is how you hold a tier the benchmark would
  // otherwise have moved.
  const presetSwitcher = showDevTools
    ? createPresetSwitcher({
        onSelect: (tier) => {
          qualityManager?.setUserTier(tier);
          applyPerformancePreset(tier, false);
          presetSwitcher.setTier(tier);
        },
        onLockChange: (locked) => {
          qualityManager?.setLocked(locked);
        },
        root,
      })
    : { setTier() {}, dispose() {} };

  const DEFAULT_ELEVATION = 5 * Math.PI / 180 // 5° — default camera elevation above disk

  // Resize handler — only fires on actual window resize, not every frame
  let renderWidth = 0
  let renderHeight = 0
  let renderPixelRatio = 0
  let particleCameraFov = null
  let particleCameraAspect = null
  let lastDiagnosticsUpdate = 0

  function applyRenderScale(
    resolution = performanceConfig.resolution,
    maxPixelRatio = PERFORMANCE_PRESETS[performanceConfig.preset]?.maxPixelRatio ?? 1.5
  ) {
    performanceConfig.resolution = resolution
    const pixelRatio = Math.min(window.devicePixelRatio * resolution, maxPixelRatio)
    const nextRenderWidth = Math.max(1, Math.floor(window.innerWidth * pixelRatio))
    const nextRenderHeight = Math.max(1, Math.floor(window.innerHeight * pixelRatio))

    if (
      nextRenderWidth === renderWidth &&
      nextRenderHeight === renderHeight &&
      pixelRatio === renderPixelRatio
    ) return

    renderWidth = nextRenderWidth
    renderHeight = nextRenderHeight
    renderPixelRatio = pixelRatio

    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    composer.setPixelRatio(pixelRatio)
    composer.setSize(window.innerWidth, window.innerHeight)
    resizeParticleTargets(renderWidth, renderHeight)
    planet?.resizePlanetTarget(renderWidth, renderHeight)
    resizeTunnel(window.innerWidth / window.innerHeight)
    uniforms.resolution.value.set(renderWidth, renderHeight)
  }

  function setPerformanceQuality(quality) {
    performanceConfig.quality = quality
    changePerformanceQuality(quality)
  }

  function applyConfigChange(group, property, value) {
    if (group === 'bloom') {
      bloomPass[property] = value
      return
    }

    if (group === 'camera') {
      if (property === 'fov') {
        observer.fov = value
        return
      }
      if (property === 'orbit') {
        observer.moving = value
        return
      }
      if (property === 'enableDrag') {
        cameraControl.enabled = value
      }
      return
    }

    const uniform = uniforms[property]
    if (group === 'effect' && uniform) {
      uniform.value = value
    }
  }

  function applyInitialConfig() {
    applyConfigChange('bloom', 'strength', bloomConfig.strength)
    applyConfigChange('bloom', 'radius', bloomConfig.radius)
    applyConfigChange('bloom', 'threshold', bloomConfig.threshold)
    applyConfigChange('camera', 'fov', cameraConfig.fov)
    applyConfigChange('camera', 'orbit', cameraConfig.orbit)
    applyConfigChange('camera', 'enableDrag', cameraConfig.enableDrag)
    for (const [property, value] of Object.entries(effectConfig)) {
      applyConfigChange('effect', property, value)
    }
  }

  function applyPerformancePreset(presetName, syncQualityManager = true) {
    const preset = PERFORMANCE_PRESETS[presetName] ?? PERFORMANCE_PRESETS.high

    performanceConfig.preset = presetName
    performanceConfig.particleScale = preset.particleScale
    bloomConfig.strength = preset.bloomStrength
    bloomConfig.radius = preset.bloomRadius
    applyConfigChange('bloom', 'strength', bloomConfig.strength)
    applyConfigChange('bloom', 'radius', bloomConfig.radius)
    setPerformanceQuality(preset.quality)
    applyRenderScale(preset.resolution, preset.maxPixelRatio)

    if (syncQualityManager && qualityManager) {
      qualityManager.setTier(presetName)
    }
  }

  function handleResize() {
    applyRenderScale()
  }
  window.addEventListener('resize', handleResize)

  qualityManager = new ThreeDQualityManager({
    tiers: ['low', 'medium', 'high'],
    initialTier: 'medium',
    warmupMs: 3000,
    // 22ms is ~45fps and 25ms is 40fps. These were 18 and 20, which put the bar
    // at "near 60 or it is failing" and cost the tier that was actually working:
    // an iPhone 16 Pro holds 40-60fps through the fall on high, every frame of
    // which the old 20ms line scored as heavy. Six heavy frames inside 1.5s is a
    // downgrade, and at 40fps that is essentially every frame, so high came off a
    // device that was rendering it well.
    //
    // 40fps is the honest bar for this scene. It is a scroll-driven cinematic,
    // not something being aimed at, and the fall is meant to be heavy. Panic
    // stays at 50ms: that path is the one that behaved, dropping the same phone
    // off high at 5-10fps exactly as it should.
    healthyFrameMs: 22,
    heavyFrameMs: 25,
    panicFrameMs: 50,
    maxFrameGapMs: 250,
    benchmarkDeadlineMs: 15000,
    heavyFrameLimit: 5,
    heavyFrameWindowMs: 1500,
    cooldownMs: 7000,
    ignoredFramesAfterChange: 5,
    upgradeStableMs: 8000,
    mediumHeavyFrameLimit: 20,
    lowToMediumProbeMs: 8000,
    mediumProbeEvaluationMs: 4000,
    failedProbeCooldownMs: 20000,
    allowHighAutoUpgrade: true,
    onQualityDowngrade: (newTier, { reason }) => {
      console.log("Quality Manager: Downgraded to " + newTier + " (" + reason + ")");
      // The dropdown follows a safety downgrade: it shows what is running, not
      // what was asked for, so an overridden selection is visible immediately.
      presetSwitcher.setTier(newTier);
      if (benchmarkStarted && !initialQualityBenchmarkComplete) {
        setLoadingStage(`Adjusting graphics to ${newTier}...`, 93)
      }
      applyPerformancePreset(newTier, false);
    },
    onQualityUpgrade: (newTier, { reason }) => {
      console.log("Quality Manager: Upgraded to " + newTier + " (" + reason + ")");
      presetSwitcher.setTier(newTier);
      if (benchmarkStarted && !initialQualityBenchmarkComplete) {
        setLoadingStage(`Testing ${newTier} graphics...`, 96)
      }
      applyPerformancePreset(newTier, false);
    },
    onWarmupComplete: ({ tier, heavyFrames, panicFrames, reason }) => {
      console.log(
        "Quality Manager: Warmup complete at " + tier +
        " (" + heavyFrames + " heavy frames, " + panicFrames + " panic frames, " + reason + ")"
      );
      setTimeout(() => {
        // A benchmark that ran out of wall-clock never sampled a usable frame,
        // so its zeroed counters are not evidence of spare capacity. Settle at
        // the safe tier and let the visitor in rather than probing upward.
        // Only hand off to the probe if it actually started. It refuses when the
        // tier is pinned or locked, and now also once a probe has already failed
        // this session - and this branch returns without settling, waiting on
        // onMediumProbeComplete to finish loading. A refusal that was not
        // noticed would leave the visitor at 96% on a screen that never opens.
        if (reason !== 'benchmark-deadline' && qualityManager.currentTier === 'low' && panicFrames === 0) {
          setLoadingStage('Testing Medium graphics...', 96)
          if (qualityManager.startMediumProbe()) return
        }

        initialQualityBenchmarkComplete = true;
        setLoadingStage(`Selected ${qualityManager.currentTier} graphics`, 100)
        dismissLoadingOverlayIfReady();
      }, 0)
    },
    onMediumProbeComplete: ({ tier }) => {
      initialQualityBenchmarkComplete = true
      setLoadingStage(`Selected ${tier} graphics`, 100)
      dismissLoadingOverlayIfReady()
    },
  });

  applyPerformancePreset('medium', false);
  presetSwitcher.setTier('medium');
  applyInitialConfig();
  handleResize()

  function handleVisibilityChange() {
    const now = performance.now();
    qualityManager.resetTiming(document.hidden ? null : now);
    lastframe = now;
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);

  ready
    .then(() => {
      texturesLoaded = true;
      benchmarkStarted = true;
      qualityManager.resetTiming(performance.now());
      setLoadingStage('Determining graphics settings for this device...', 90)
    })
    .catch((error) => {
      texturesLoaded = true;
      console.error('One or more textures failed to load.', error);
      benchmarkStarted = true;
      qualityManager.resetTiming(performance.now());
      setLoadingStage('Determining graphics settings for this device...', 90)
    });

  // Scroll has one owner. portfolio-3D creates its own Lenis here because there
  // is nothing else on the page to own it; this site already has one in the root
  // layout, driving ScrollTrigger and the section detection. A second instance
  // would mean two things reading and writing one scroll position, which is the
  // trap docs/ANIMATIONS.md is about - so the site's instance is passed in and
  // this scene borrows it.
  //
  // Held still until the entry gate opens, the same as before. That is a
  // borrowed instance being stopped, so disposeApp starts it again on the way
  // out rather than leaving the rest of the site unable to scroll.
  lenis.stop();

  // start render loop immediately (renders black until textures arrive)
  // requestAnimationFrame passes a high-res timestamp automatically
  let animationFrameId = requestAnimationFrame(update);

  // The overlay is dismissed after textures load and the benchmark completes.


  // UPDATING

  function update(timeNow) {
    // No lenis.raf() here, unlike portfolio-3D. The site drives its own instance
    // from the GSAP ticker (SmoothScrollContext), so advancing it from this loop
    // as well would step it twice a frame and scroll would run at double speed.
    // This loop only reads lenis.scroll; something else is responsible for
    // moving it.

    const frameTimestamp = timeNow ?? performance.now()
    delta = (frameTimestamp - lastframe) / 1000
    time += delta
    updateLoadingProgress(delta)

    // scroll logic
    //
    // While the benchmark runs, the journey is driven from a fixed pose in the
    // fall instead of from scroll. This works because every value below is a
    // pure function of this number, so there is nothing to restore afterwards —
    // the frame after the benchmark ends reads scroll again and retraces itself.
    const scrollViewportUnits = benchmarkPoseActive()
      ? BENCHMARK_POSE_UNITS
      : lenis.scroll / Math.max(1, window.innerHeight);
    storyOverlay.update(scrollViewportUnits)
    if (benchmarkStarted) qualityManager.update(frameTimestamp);
    if (frameTimestamp - lastDiagnosticsUpdate >= 250) {
      lastDiagnosticsUpdate = frameTimestamp
      updateDiagnostics(qualityManager.getDiagnostics())
    }

    // Frame-time quality sampling is handled by ThreeDQualityManager.

    // ── The journey ──
    // Cross to the wormhole, go dark, travel the passage, and come out falling
    // toward the black hole. Every value below is a pure function of scroll, so
    // scrubbing backwards retraces it.
    const crossingStartDist = 22.0;
    // As close as we get before the crossing. Pushed in from 3.2 so the mouth
    // runs off every edge of the frame before the light takes over — with sky
    // still visible around it, the handover reads as the surroundings being cut
    // away rather than as going through something.
    const crossingNearDist = 2.4;
    const closeDist = 1.8;          // held through the passage
    // How far out we come up on the far side.
    //
    // 30 rather than the 42 it was, so the black hole is already something on the
    // first frame past the passage instead of a bright speck — its shadow comes up
    // at about 45 pixels of radius on a 1888 by 820 frame where it used to be 32.
    // The fall gives up a third of its distance for that, 37 units down to 25,
    // over the same 14 units of scroll.
    //
    // The ceiling on this is the raymarcher's step budget. NSTEPS*STEP is a fixed
    // ray-path length per quality tier — on 'low' that's 280*0.16 = 44.8 — and a
    // ray that has to bend its way around the photon sphere needs meaningfully
    // more path length than the straight-line camera distance. Above roughly 43-44
    // units on 'low', the most-bent rays run out of steps before they complete and
    // the ring comes up with a wedge missing rather than closed. Measured across
    // all three tiers at both a phone and a desktop aspect: complete from 43 down,
    // visibly bitten into by 44. Coming down to 30 leaves that with room to spare.
    //
    // The floor is the planet. ORBIT_RADIUS in planet.js is 12, and the planet is
    // anchored beyond the black hole, so camera-to-planet leads camera-to-black-
    // hole by about 8 units here — that lead is what the draw-order occlusion
    // trick depends on, and it narrows as this number climbs, not as it falls.
    const arriveDist = 30.0;
    // Closest point of the fall, and the last frame of the journey. The black hole
    // subtends the same angle whatever the viewport, but portrait has far less
    // width for it to subtend that angle in — at the landscape distance it owns
    // the whole phone screen, leaving the planet nowhere to be and the disk
    // running off both edges. Backed off in proportion to how narrow it is.
    const viewportAspect = Math.max(window.innerWidth / window.innerHeight, 0.4);
    const narrowFraming = clamp01((1.2 - viewportAspect) / 0.8);
    // Closest approach, and what sets how big the black hole ends up in frame.
    // Settled by rendering the last frame headlessly and laying it beside the
    // reference scaled to the same height, rather than by measuring the
    // reference on its own — see the note on COMPOSE_SHIFT in the shader for why
    // that file does not survive being thresholded.
    //
    // The reference does not show a whole black hole — its shadow is about 0.97
    // of the frame height across and centred high and right, so the top and the
    // right of the circle are off frame and the disk covers most of the rest.
    // Measured here, full diameter: 0.48 at 5.6, 0.71 at 4.2, 1.37 at 3.1. That
    // is a steep curve, close to the inverse square of the distance, so small
    // steps in here move the frame a long way. 3.6 lands on 0.97.
    //
    // Note this is inside the disk's outer edge (DISK_WIDTH puts that at r = 6),
    // so the near side of the disk passes between the camera and the black hole
    // and fills the bottom of the frame. The reference is shot from outside its
    // disk, which is why its lower left recedes into dark where ours is a bright
    // slab. Closing that is a disk-extent change, not a camera one.
    const blackHoleDist = 3.6 * (1.0 + 0.55 * narrowFraming);
    // Nothing swings edge-on across the crossing, so the elevation only decides
    // how much of the star field sits above the horizon. Held flat: the whole
    // point of this half is that it is a straight line in.
    const crossingElev = 15.0 * Math.PI / 180;
    // The fall opens 60 degrees above the disk plane and settles to 2.5, which is
    // the whole cinematic move of this half: the disk arrives as a plate seen from
    // above, opens out underneath the camera, and lays over edge-on as the black
    // hole closes in. Without that sweep the approach is a straight dolly and the
    // last frame is the only thing in it worth looking at.
    //
    // This was flattened to 14 degrees at one point because the planet, once it
    // became a fixed body in the world rather than a scripted screen position,
    // swung further from a turning camera than an approaching one ever moved it —
    // the rotation ate the parallax. The planet is unmounted now (PLANET_ENABLED),
    // so that constraint is gone and the sweep comes back.
    //
    // Elevation is the angle between the disk plane and the camera-to-black-hole
    // line. Only the start moves here: the end is still 2.5, so every frame of the
    // arrival is untouched. 2.5 is deliberately just above the 2 degree floor
    // CameraDragControls clamps to, so the scripted fall does not finish somewhere
    // drag cannot follow it back to.
    const startElev = 60.0 * Math.PI / 180;
    const endElev = 2.5 * Math.PI / 180;
    // Roll. The reference frame is not shot level — the disk runs up to the right
    // across the whole width, which is what stops it reading as a horizon line
    // and starts it reading as a plane the camera happens to be near. Elevation
    // cannot do this: at five degrees the disk is edge-on either way, it just
    // sits flat. Only turning the camera about its own view axis tilts it.
    //
    // Rolled in across the fall rather than held from the start, so the horizon
    // coming off level is part of the arrival rather than a frame someone lands
    // in. Eighteen degrees is measured off the near-side arc in the reference.
    const endRoll = 18.0 * Math.PI / 180;

    const crossingProgress = clamp01(scrollViewportUnits / JOURNEY.crossingEnd);
    const closeProgress = clamp01(
      (scrollViewportUnits - JOURNEY.crossingEnd) / (JOURNEY.blackoutEnd - JOURNEY.crossingEnd));
    const tunnelProgress = clamp01(
      (scrollViewportUnits - JOURNEY.blackoutEnd) / (JOURNEY.tunnelEnd - JOURNEY.blackoutEnd));
    const arrivalProgress = clamp01(
      (scrollViewportUnits - JOURNEY.tunnelEnd) / (JOURNEY.arrivalEnd - JOURNEY.tunnelEnd));
    const approachProgress = clamp01(
      (scrollViewportUnits - JOURNEY.arrivalEnd) / (JOURNEY.approachEnd - JOURNEY.arrivalEnd));

    const crossingEase = smoothstep(crossingProgress);
    const closeEase = smoothstep(closeProgress);
    const approachEase = smoothstep(approachProgress);

    // The raymarcher is only on either side of the passage. Between the two it
    // is not just hidden but skipped — that is where the frame budget for the
    // tunnel comes from.
    const inTunnel = scrollViewportUnits > JOURNEY.blackoutEnd
      && scrollViewportUnits <= JOURNEY.tunnelEnd;
    const pastTunnel = scrollViewportUnits > JOURNEY.tunnelEnd;

    sourceLicenseLinks?.classList.toggle('visible', scrollViewportUnits >= JOURNEY.approachEnd - 0.15)

    if (scrollViewportUnits <= JOURNEY.crossingEnd) {
      cameraConfig.distance = crossingStartDist + (crossingNearDist - crossingStartDist) * crossingEase;
    } else if (scrollViewportUnits <= JOURNEY.blackoutEnd) {
      cameraConfig.distance = crossingNearDist + (closeDist - crossingNearDist) * closeEase;
    } else if (inTunnel) {
      cameraConfig.distance = closeDist;
    } else {
      cameraConfig.distance = arriveDist + (blackHoleDist - arriveDist) * approachEase;
    }

    if (!cameraConfig.enableDrag) {
      observer.elevationAngle = pastTunnel
        ? startElev + (endElev - startElev) * approachEase
        : crossingElev;
    }

    // The two worlds swap outright rather than blending, because the swap happens
    // while the arrival veil is still fully opaque and nothing of it is on screen.
    updateWorldAppearance(pastTunnel ? 0 : 1);

    // The scene blows out into the crossing rather than being covered up by
    // something bright. An overlay on its own is a white rectangle appearing in
    // front of the frame — it goes bright without anything having got brighter.
    // Driving the whole render up means the throat itself overexposes, the bloom
    // pass catches it and spreads it the way real overexposure spreads, and the
    // veil arrives on top of a frame that is already blinding.
    //
    // Ramped over the front of the approach so the light is clearly coming out
    // of the mouth, and only past the crossing does the veil take over.
    uniforms.exposure.value = inTunnel || pastTunnel
      ? 1.0
      : 1.0 + 7.0 * smoothstep(clamp01((closeProgress - 0.02) / 0.30));

    updateTransitionVeil(closeProgress, tunnelProgress, arrivalProgress, inTunnel);

    // Set per phase. Nothing here is allowed to sit at threshold 0 — that is what
    // bleached a whole half of the journey before.
    if (inTunnel) {
      bloomPass.strength = 0.9;
      bloomPass.radius = 1.0;
      bloomPass.threshold = 0.55;
    } else if (pastTunnel) {
      // Restrained through the fall so the disk stays legible rather than
      // blooming into a single white mass as it fills the frame.
      bloomPass.strength = bloomConfig.strength + (0.2 - bloomConfig.strength) * approachEase;
      bloomPass.radius = bloomConfig.radius;
      bloomPass.threshold = bloomConfig.threshold + (0.1 - bloomConfig.threshold) * approachEase;
    } else {
      // The throat is a light source and it grows to fill the frame on the way
      // in, so the threshold climbs with it — held at its opening value the
      // crossing washes out long before the dark arrives to cover it.
      //
      // Then it comes back down again through the crossing itself, and hard.
      // The threshold is what decides whether the exposure surge above reads as
      // a burst or as a flat bright frame: held at its approach value the
      // overexposed throat sits there clipped and inert, and only by dropping
      // the bar does the light actually leave the mouth and spill over the rest
      // of the frame.
      bloomPass.strength = 0.95 + 1.4 * closeEase;
      bloomPass.radius = 1.0;
      bloomPass.threshold = Math.max(0.05, 0.5 + 0.3 * crossingEase - 0.7 * closeEase);
    }

    tunnelActive = inTunnel;
    if (inTunnel) {
      const reveal = clamp01((tunnelProgress - 0.10) / 0.14);
      updateTunnel(tunnelProgress, reveal, time);
    }


    const currentScrollY = lenis.scroll;
    const scrollDelta = currentScrollY - lastScrollY;
    lastScrollY = currentScrollY;

    // 1. Set continuous direction based on last scroll
    if (scrollDelta > 0) orbitDirection = 1;
    else if (scrollDelta < 0) orbitDirection = -1;

    // 2. Calculate target speed (base speed + scroll momentum)
    const extraSpeed = Math.abs(scrollDelta) * 0.1;
    // The hard cinematic spin used to belong to the dive into the black hole.
    // That dive is gone — the crossing is a straight line in, and the fall is
    // now where the journey ends rather than where it turns — so both halves
    // run on the ordinary idle drift.
    //
    // Damped away across the fall. At 0.05 rad/s the idle spin comes to about
    // three degrees a second, which is nothing to look at while the journey is
    // moving but carries the camera most of the way round in the time someone
    // might leave the last frame sitting there — and the planet is a fixed point
    // in the world now, so it would simply leave the shot. The fall ends still.
    const orbitDamp = pastTunnel ? 1 - approachEase : 1;
    const targetOrbitSpeed = (BASE_ORBIT_SPEED + extraSpeed) * orbitDirection * orbitDamp;

    // 3. Smoothly accelerate/decelerate towards target speed
    currentOrbitSpeed += (targetOrbitSpeed - currentOrbitSpeed) * 5 * delta;

    // 4. Apply continuous momentum to camera
    observer.theta -= currentOrbitSpeed * delta;

    // update peripherals
    stats?.update()

    // update renderer
    observer.distance = cameraConfig.distance
    observer.update(delta)
    cameraControl.update(delta)

    // Roll is applied here, after everything that can move the camera, because it
    // is defined about the view axis and that axis is only final once theta,
    // elevation and any drag have settled for the frame. The shader takes cam_up
    // as given and re-orthogonalises it against cam_dir, and the particle cameras
    // copy it before their own lookAt, so tilting this one vector tilts the
    // raymarched disk and the star field together.
    const roll = pastTunnel ? endRoll * approachEase : 0;
    observer.up.set(0, 1, 0).applyAxisAngle(observer.direction, roll);

    // slowly revolve particles around the BH when toggle is on
    if (cameraConfig.particleOrbit) {
      particleSceneLensed.rotation.y += delta * 0.01  // ~1 full revolution per ~2.5 min
      particleSceneUnlensed.rotation.y -= delta * 0.01 // rotate in opposite direction
    }

    // The planet belongs to the black hole's system, so it fades up shortly after
    // the arrival and rides the whole fall. Placed after the orbit has been
    // advanced, because it is positioned from the camera's own basis and would
    // otherwise sit a frame behind the camera it is framed against.
    const planetProgress = approachProgress
    uniforms.planet_amount.value = planet && pastTunnel
      ? smoothstep(clamp01(planetProgress / 0.22))
      : 0
    // Placed on every frame past the tunnel, not only on the ones it is visible
    // for. Gating the placement on the same flag as the draw left the mesh
    // wherever it was last put — including its initial position at the origin —
    // so the first frame after it faded up could sample a planet still sitting
    // inside the black hole.
    if (planet && pastTunnel) {
      planet.updatePlanet(planetProgress, observer, window.innerWidth / window.innerHeight, time)
    } else if (planet) {
      // Scrolled back off the fall. Drop the anchor so coming back down aims a
      // fresh one — the camera's azimuth keeps drifting up in the tunnel, and a
      // point fixed against where it used to be would be off the edge on return.
      planet.resetPlanetAnchor()
    }

    // update shader variables
    updateUniforms()

    // render
    render();

    // loop
    animationFrameId = requestAnimationFrame(update)
    lastframe = frameTimestamp
  }

  function render() {
    // Swapping what the existing RenderPass points at is the whole handover —
    // bloom, sizing and the composer chain are shared by both worlds.
    if (tunnelActive) {
      renderPass.scene = tunnelScene
      renderPass.camera = tunnelCamera
      renderer.setRenderTarget(null)
      composer.render()
      return
    }

    renderPass.scene = scene
    renderPass.camera = camera

    const particleTarget = effectConfig.show_lensing
      ? particleTargetLensed
      : particleTargetUnlensed
    const particleScene = effectConfig.show_lensing
      ? particleSceneLensed
      : particleSceneUnlensed

    // Render only the particle target sampled by the current shader path.
    renderer.setRenderTarget(particleTarget)
    renderer.clear()
    renderer.render(particleScene, particleCamera)

    // Only drawn once there is something to draw, so the approach and the
    // passage pay nothing for it.
    if (planet && uniforms.planet_amount.value > 0) {
      // The renderer's clear alpha is 1, which is right for the particle targets
      // because they composite additively and their alpha is never read. This one
      // is composited alpha-over, so clearing it opaque would paint a black frame
      // across the whole sky. Cleared transparent, and put back afterwards.
      renderer.setClearAlpha(0)
      renderer.setRenderTarget(planet.planetTarget)
      renderer.clear()
      renderer.render(planet.planetScene, planet.planetCamera)
      renderer.setClearAlpha(1)
    }

    renderer.setRenderTarget(null)

    // Main ray-marching + bloom.
    composer.render()
  }

  // Blends the shader between the two worlds. At mix 1 it is the wormhole we set
  // out from; at mix 0 every uniform holds the value the shader was built with,
  // so the black hole we arrive at is exactly itself.
  function updateWorldAppearance(mix) {
    uniforms.throat_throughput.value = WORMHOLE.throatThroughput * mix
    // The GUI toggle owns the disk everywhere the journey does not. The journey
    // only ever overrides it downwards, and only for the wormhole half, which has
    // no disk to show.
    uniforms.accretion_disk.value = effectConfig.accretion_disk && mix <= 0
    uniforms.disk_tint.value.lerpVectors(BLACK_HOLE.diskTint, WORMHOLE.diskTint, mix)
    uniforms.bg_tint.value.lerpVectors(BLACK_HOLE.bgTint, WORMHOLE.bgTint, mix)
    uniforms.space_color_plane.value.lerpVectors(
      BLACK_HOLE.spaceColorPlane, WORMHOLE.spaceColorPlane, mix)
    uniforms.space_color_pole.value.lerpVectors(
      BLACK_HOLE.spaceColorPole, WORMHOLE.spaceColorPole, mix)
    uniforms.bg_lensing.value =
      BLACK_HOLE.bgLensing + (WORMHOLE.bgLensing - BLACK_HOLE.bgLensing) * mix
  }

  let veilColor = ''
  let veilOpacity = -1
  let vignetteOpacity = -1

  // Black going in, white coming out. Both scene swaps happen while this is
  // fully opaque, so neither is ever visible.
  function updateTransitionVeil(closeProgress, tunnelProgress, arrivalProgress, inTunnel) {
    let color = '#000000'
    let opacity = 0

    if (arrivalProgress > 0) {
      color = '#ffffff'
      opacity = 1 - clamp01((arrivalProgress - 0.05) / 0.35)
    } else if (tunnelProgress > 0) {
      if (tunnelProgress >= 0.92) {
        color = '#ffffff'
        opacity = (tunnelProgress - 0.92) / 0.08
      } else {
        // Held opaque for the first stretch so the horizon message lands on
        // black, then pulled back to reveal the passage.
        opacity = 1 - clamp01((tunnelProgress - 0.10) / 0.14)
      }
    } else {
      // Going in. The crossing is a burst of light rather than a fade to black.
      //
      // A fade to black is a cut with the lights off: the eye keeps its detail
      // right up to the moment the frame empties, so it registers the throat
      // being taken away. A flash gives it nothing to hold on to — everything
      // blows out at once, and by the time it recovers it is somewhere else.
      // That is what makes the handover read as going through the wormhole
      // instead of the wormhole being removed.
      //
      // Warm rather than pure white, because it has to come out of the throat it
      // is replacing, and the throat is copper.
      const flash = smoothstep(clamp01((closeProgress - 0.04) / 0.22))

      // The light then burns down to black over the back half, so the scene swap
      // at blackoutEnd still happens under full black and the horizon message
      // still lands on it. The flash covers the crossing; the black covers the
      // machinery.
      const settle = smoothstep(clamp01((closeProgress - 0.55) / 0.30))
      const level = 1 - settle

      opacity = flash
      // Warm at the leading edge and pure white at the peak. Holding it warm all
      // the way through caps it at the brightness of the copper it came from,
      // which is the difference between a bright frame and a frame that is too
      // bright to look at.
      const toWhite = smoothstep(clamp01((closeProgress - 0.14) / 0.16))
      const g = (236 + 19 * toWhite) * level
      const b = (214 + 41 * toWhite) * level
      color = `rgb(${Math.round(255 * level)}, ${Math.round(g)}, ${Math.round(b)})`
    }

    if (color !== veilColor) {
      veilColor = color
      if (transitionVeil) transitionVeil.style.backgroundColor = color
    }
    if (opacity.toFixed(3) !== veilOpacity) {
      veilOpacity = opacity.toFixed(3)
      if (transitionVeil) transitionVeil.style.opacity = veilOpacity
    }

    const vignette = inTunnel
      ? clamp01((tunnelProgress - 0.10) / 0.14) * (1 - clamp01((tunnelProgress - 0.80) / 0.20))
      : 0
    if (vignette.toFixed(3) !== vignetteOpacity) {
      vignetteOpacity = vignette.toFixed(3)
      if (cockpitVignette) cockpitVignette.style.opacity = vignetteOpacity
    }
  }

  function updateUniforms() {
    uniforms.time.value = time

    uniforms.cam_pos.value = observer.position
    uniforms.cam_dir.value = observer.direction
    uniforms.cam_up.value = observer.up
    uniforms.fov.value = observer.fov

    uniforms.cam_vel.value = observer.velocity

    // sync particle camera to observer so 3D positions are correct
    const nextParticleAspect = window.innerWidth / window.innerHeight
    if (particleCameraFov !== observer.fov || particleCameraAspect !== nextParticleAspect) {
      particleCameraFov = observer.fov
      particleCameraAspect = nextParticleAspect
      particleCamera.fov = particleCameraFov
      particleCamera.aspect = particleCameraAspect
      particleCamera.updateProjectionMatrix()
    }
    particleCamera.position.copy(observer.position)
    particleCamera.up.copy(observer.up)
    particleCamera.lookAt(0, 0, 0)
    particleCamera.updateMatrixWorld()

  }

  function dismissLoadingOverlayIfReady() {
    if (loadingOverlayDismissed || !texturesLoaded || !initialQualityBenchmarkComplete) return;
    loadingTargetProgress = 100
    loadingReadyToDismiss = true
  }

  let appDisposed = false;
  function disposeApp() {
    if (appDisposed) return;
    appDisposed = true;

    cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', disposeApp);
    cancelEntryHold();
    loadingOverlay?.removeEventListener('pointerdown', startEntryHold);
    loadingOverlay?.removeEventListener('pointerup', cancelEntryHold);
    loadingOverlay?.removeEventListener('pointercancel', cancelEntryHold);
    loadingOverlay?.removeEventListener('pointerleave', cancelEntryHold);
    window.removeEventListener('keydown', handleEntryKeydown);
    // The scroll instance belongs to the site, not to the scene. Destroying it
    // on the way out would take smooth scrolling down with it for every other
    // route in the session. Hand it back the way it was found instead: running,
    // and not stopped by a loading screen that no longer exists.
    lenis.start();
    cameraControl.dispose();
    disposeConfig();
    presetSwitcher.dispose();
    storyOverlay.dispose();
    disposeParticleSystem();
    disposeTunnel();
    planet?.disposePlanet();
    disposeShaderPlane();
    disposeScene();
    disposeTextures();
    renderer.dispose();
    renderer.domElement.remove();
    stats?.dom.remove();
  }
  // Still worth holding on a hard navigation - the GPU resources are the same
  // either way. React's unmount is the path that matters now, and it gets this
  // function back as the return value.
  window.addEventListener('beforeunload', disposeApp);

  return disposeApp;
}
