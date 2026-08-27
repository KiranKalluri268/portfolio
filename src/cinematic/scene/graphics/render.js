import * as THREE from 'three';
import { worldConfig } from '../worldConfig';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { CameraDragControls } from "../camera/CameraDragControls";
import { Observer } from "../camera/Observer";
import { Vector2 } from 'three/src/math/Vector2';
// Generated from portfolio-3D's fragmentShader.glsl by scripts/port-shader.mjs.
// A string rather than a .glsl import because Turbopack has no equivalent of
// Vite's `?raw` that works - the header of the generated file has the detail.
import { fragmentShader } from './fragmentShader';

// Served from /public rather than imported. Between them these three are 9.7MB,
// and an import would put every byte in the JS bundle, where they would be
// fetched and parsed before anything at all could paint. As URLs they are
// ordinary image requests the scene makes once it is running, which is what the
// loading screen is counting.
const starUrl = '/textures/star_noise-generated.png';
const milkywayUrl = '/textures/milkyway-preview.jpg';
const diskUrl = '/textures/accretion_disk.png';

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer()
  renderer.setClearColor(0x000000, 1.0)
  renderer.setSize(window.innerWidth, window.innerHeight) // res
  renderer.autoClear = false
  return renderer;
}

export function createScene(renderer) {
  // scene and camera
  const scene = new THREE.Scene()
  // this camera is THREE.js camera fixated at position z=1
  // since drawing happens only with shader on a 2D plane, actual camera control is done by Observer
  const camera = new THREE.Camera()
  camera.position.z = 1

  // render pass composing
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera)
  // strength, kernelSize, sigma, res
  // resolution, strength, radius, threshold
  const bloomPass = new UnrealBloomPass(new Vector2(128, 128), 0.8, 2.0, 0.0)
  composer.addPass(renderPass);
  composer.addPass(bloomPass);

  function dispose() {
    renderPass.dispose?.();
    bloomPass.dispose?.();
    composer.renderTarget1?.dispose();
    composer.renderTarget2?.dispose();
  }

  return {
    scene, camera, composer, bloomPass, renderPass, disposeScene: dispose
  }
}

export function createCamera(renderer) {
  const observer = new Observer(60.0, window.innerWidth / window.innerHeight, 1, 80000)
  const cameraControl = new CameraDragControls(observer, renderer.domElement) // take care of camera view
  return {
    observer, cameraControl
  }
}

export function loadTextures(onProgress = () => {}) {
  const textures = new Map();
  const textureLoader = new THREE.TextureLoader()
  const pending = [];
  let loadedCount = 0;
  const totalCount = 3;

  loadTexture('bg1', milkywayUrl, THREE.NearestFilter)
  loadTexture('star', starUrl, THREE.LinearFilter)
  loadTexture('disk', diskUrl, THREE.LinearFilter)

  function dispose() {
    for (const texture of textures.values()) {
      if (texture) texture.dispose();
    }
  }

  // resolves when all textures have loaded
  const ready = Promise.all(pending);

  return { textures, ready, disposeTextures: dispose };

  function loadTexture(name, image, interpolation, wrap = THREE.ClampToEdgeWrapping) {
    textures.set(name, null);
    const p = new Promise((resolve, reject) => {
      textureLoader.load(image, (texture) => {
        texture.magFilter = interpolation
        texture.minFilter = interpolation
        texture.wrapT = wrap
        texture.wrapS = wrap
        textures.set(name, texture);
        loadedCount++;
        onProgress({ name, loaded: loadedCount, total: totalCount });
        resolve();
      }, undefined, (error) => {
        console.error(`Failed to load texture "${name}"`, error);
        loadedCount++;
        onProgress({ name, loaded: loadedCount, total: totalCount, failed: true });
        reject(error);
      });
    });
    pending.push(p);
  }
}


// The raymarcher draws to a full-screen plane, so the vertex stage only has to
// pass the position straight through. In portfolio-3D this lives in index.html
// as a <script type="x-shader/x-vertex">, which there is no equivalent of here -
// nothing owns a hand-written document - so the four lines are inlined.
const vertexShader = `
  void main() {
    gl_Position = vec4( position, 1.0 );
  }
`;

export async function createShaderProjectionPlane(uniforms) {

  const defines = getShaderDefineConstant('high');
  const material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader,
    fragmentShader: defines + fragmentShader,
  })
  material.needsUpdate = true;

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)

  function dispose() {
    mesh.geometry.dispose();
    material.dispose();
  }


  async function changePerformanceQuality(quality) {
    const defines = getShaderDefineConstant(quality);
    material.fragmentShader = defines + fragmentShader;
    material.needsUpdate = true;
  }


  function getShaderDefineConstant(quality) {
    let STEP, NSTEPS;
    switch (quality) {
      case 'low':
        STEP = 0.16;
        NSTEPS = 280;
        break;
      case 'medium':
        STEP = 0.09;
        NSTEPS = 500;
        break;
      case 'high':
        STEP = 0.055;
        NSTEPS = 850;
        break;
      default:
        STEP = 0.09;
        NSTEPS = 500;
    }
    return `
  #define STEP ${STEP} 
  #define NSTEPS ${NSTEPS} 
`
  }

  return {
    mesh,
    changePerformanceQuality,
    disposeShaderPlane: dispose
  };
}

export function createParticleSystem() {
  const targetLensed = new THREE.WebGLRenderTarget(
    window.innerWidth, window.innerHeight,
    { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat }
  );
  const targetUnlensed = new THREE.WebGLRenderTarget(
    window.innerWidth, window.innerHeight,
    { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat }
  );

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100000);

  const sceneLensed = new THREE.Scene();
  const sceneUnlensed = new THREE.Scene();
  let targetWidth = window.innerWidth;
  let targetHeight = window.innerHeight;

  // What this field is for, and why its numbers changed.
  //
  // It used to be the universe: 2,500 points in a hollow shell from radius 8 to
  // 42, flattened to a lens by multiplying Y by 0.25. The fall runs the camera
  // from 30 down to about 3.6, so a visitor arrived just inside its outer wall
  // and ended inside its inner void, with every point outside them and nothing at
  // all beyond 42. A bounded bubble, crossed end to end. That is the sphere.
  //
  // It was never needed for that job. The sky is already infinite and already
  // right: sample_sky in the fragment shader draws stars, a nebula plate and the
  // domain arms from the ray direction, so it has no radius to reach the edge of
  // and it bends with the lensing for free.
  //
  // So the field stops being the universe and becomes local dust: near, sparse,
  // faint, and there for the one thing an infinite sky cannot do, which is
  // parallax. Motion is only legible against something close enough to slide.
  //
  // The inner radius stays clear of where the fall ends so the camera does not
  // finish inside a cloud of sprites, and the outer radius stops well short of
  // the arrival distance so there is no wall to arrive at.
  const dust = worldConfig.sky
    ? { count: 900, innerRadius: 5, radiusSpan: 12, size: 0.05, brightCount: 120, brightSize: 0.075 }
    : { count: 2200, innerRadius: 8, radiusSpan: 34, size: 0.08, brightCount: 300, brightSize: 0.11 };

  // ── Shared circular sprite — tight core, fast falloff (no large shadow halo)
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0,    'rgba(255,255,255,1)');
  grad.addColorStop(0.12, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.30, 'rgba(255,255,255,0.4)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const pointTex = new THREE.CanvasTexture(canvas);

  const matBase = {
    map: pointTex,
    color: 0xffffff,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    alphaTest: 0.005,
  };

  // Layer 1: many small crisp stars (bulk of the field)
  const COUNT_S = dust.count;
  const posS = new Float32Array(COUNT_S * 3);
  for (let i = 0; i < COUNT_S; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = dust.innerRadius + Math.random() * dust.radiusSpan;
    posS[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    posS[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.25;
    posS[i * 3 + 2] = r * Math.cos(phi);
  }
  const geoS = new THREE.BufferGeometry();
  geoS.setAttribute('position', new THREE.BufferAttribute(posS, 3));
  const materialS = new THREE.PointsMaterial({ ...matBase, size: dust.size });
  sceneLensed.add(new THREE.Points(geoS, materialS));

  // Layer 2: fewer brighter slightly-larger stars (foreground highlights)
  const COUNT_B = dust.brightCount;
  const posB = new Float32Array(COUNT_B * 3);
  for (let i = 0; i < COUNT_B; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = dust.innerRadius + Math.random() * (dust.radiusSpan * 0.88);
    posB[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    posB[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.25;
    posB[i * 3 + 2] = r * Math.cos(phi);
  }
  const geoB = new THREE.BufferGeometry();
  geoB.setAttribute('position', new THREE.BufferAttribute(posB, 3));
  const materialB = new THREE.PointsMaterial({ ...matBase, size: dust.brightSize });
  sceneUnlensed.add(new THREE.Points(geoB, materialB));

  function resize(width, height) {
    if (width === targetWidth && height === targetHeight) return;

    targetWidth = width;
    targetHeight = height;
    targetLensed.setSize(width, height);
    targetUnlensed.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    geoS.dispose();
    geoB.dispose();
    materialS.dispose();
    materialB.dispose();
    pointTex.dispose();
    targetLensed.dispose();
    targetUnlensed.dispose();
  }

  return { 
    particleSceneLensed: sceneLensed, 
    particleTargetLensed: targetLensed,
    particleSceneUnlensed: sceneUnlensed, 
    particleTargetUnlensed: targetUnlensed,
    particleCamera: camera,
    resizeParticleTargets: resize,
    disposeParticleSystem: dispose
  };
}
