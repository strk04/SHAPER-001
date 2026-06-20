// main.js — UI wiring for SHAPER 001
import { buildSVG, buildScene, drawScene, DEFAULT_CUSTOM_PROFILE, DEFAULT_CUSTOM_OUTLINE } from './engine.js';
import { getToken, setToken, clearToken, validateToken, listProjects, listPresets, loadPreset, savePreset, deletePreset } from './presets-github.js';
import { DEFAULT_DIRECTOR, advanceDirectorTime, evaluateDirector, normalizeDirector, normalizeScene, totalDuration, addScene, duplicateScene, moveScene, removeScene, upsertBehavior, updateBehavior, removeBehavior, upsertKeyframe, AUTOMATABLE_PARAMS, simplifySamples } from './director.js';
import { mountDirectorUI, mountLivePads, AUTOMATION_CONTROL_IDS } from './director-ui.js';

// Slider definitions: key -> { label, default }
const SLIDERS = {
  fontSize: { label: 'Cos', def: 24 },
  amplitude: { label: 'Amplitud', def: 47 },
  frequency: { label: 'Freqüència', def: 0.001 },
  charTrack: { label: 'Kerning', def: 36 },
  leading: { label: 'Interlínia', def: 50 },
  noiseAmt: { label: 'Soroll horitzontal', def: 0 },
  rainSpeed2d: { label: 'Velocitat de moviment', def: 0 },
  speed2d: { label: 'Velocitat', def: 0.2 },
  speed3d: { label: 'Velocitat', def: 0.1 },
  wordTrack: { label: 'Espai entre paraules', def: 52 },
  wordChaos: { label: 'Variació de paraules', def: 0 },
  wordRamp: { label: 'Progressió de paraules', def: 0.6 },
  charChaos: { label: 'Desordre de lletres', def: 0 },
  yJitter: { label: 'Tremolor vertical', def: 0 },
  yJitterAffect: { label: 'Abast del tremolor', def: 0 },
  dropProb: { label: 'Amagar caràcters', def: 0 },
  densityMap: { label: 'Mapa de densitat', def: 0 },
  wordsPerRow: { label: 'Paraules per línia', def: 2 },
  // --- Per caràcter ---
  charOpacity: { label: 'Grau', def: 0.6 },
  charSkew: { label: 'Inclinació aleatòria', def: 0 },
  opacityProb: { label: 'Probabilitat', def: 0.15 },
  opacityEvery: { label: 'Freqüència', def: 2 },
  blinkRate: { label: 'Velocitat', def: 2 },
  blinkFade: { label: 'Dissolència', def: 0 },
  blinkProb: { label: 'Probabilitat', def: 0.15 },
  blinkEvery: { label: 'Freqüència', def: 2 },
  sizeAmt: { label: 'Quantitat', def: 1.5 },
  sizeProb: { label: 'Probabilitat', def: 0.15 },
  sizeEvery: { label: 'Freqüència', def: 2 },
  // --- Accent colors ---
  accentProb:   { label: 'Probabilitat 1', def: 0.15 },
  accentEvery:  { label: 'Freqüència 1', def: 2 },
  accentProb2:  { label: 'Probabilitat 2', def: 0 },
  accentEvery2: { label: 'Freqüència 2', def: 2 },
  accentProb3:  { label: 'Probabilitat 3', def: 0 },
  accentEvery3: { label: 'Freqüència 3', def: 2 },
  accentProb4:  { label: 'Probabilitat 4', def: 0 },
  accentEvery4: { label: 'Freqüència 4', def: 2 },
  // --- 3D: Form ---
  formSize: { label: 'Mida de forma', def: 413 },
  aspect: { label: 'Proporció', def: 2.6 },
  facets: { label: 'Cares', def: 4 },
  turns: { label: 'Voltes', def: 1 },
  count: { label: 'Quantitat', def: 3 },
  scatter: { label: 'Dispersió', def: 0 },
  // --- 3D: Camera ---
  fov: { label: 'Camp visual', def: 60 },
  zoom: { label: 'Zoom', def: 2.3 },
  rotXSpeed: { label: 'Rotació X', def: -0.7 },
  rotYSpeed: { label: 'Rotació Y', def: 0 },
  rotZSpeed: { label: 'Rotació Z', def: 0 },
  angleX: { label: 'Angle X', def: 141.3984375 },
  angleY: { label: 'Angle Y', def: 126.4140625 },
  depthFade: { label: 'Esvaïment per profunditat', def: 0 },
  // --- 3D: Motion ---
  pulse: { label: 'Pols', def: 0 },
  pulseSpeed: { label: 'Velocitat del pols', def: 0 },
  rainProb: { label: 'Probabilitat de pluja', def: 0 },
  rainSpeed: { label: 'Velocitat de pluja', def: 0 },
  // --- 3D: Distribució ---
  noiseTexture: { label: 'Buits de textura', def: 0 },
  // --- Morph ---
  morphT:       { label: 'Blend', def: 0 },
  morphSpeed:   { label: 'Velocitat morph', def: 0.05 },
  morphScatter:  { label: 'Dispersió aleatòria', def: 0 },
  morphSpeedVar: { label: 'Variació de velocitat', def: 0 },
};

const FORM_3D_CONTROLS = {
  plane:         ['formSize', 'aspect'],
  cylinder:      ['formSize', 'aspect'],
  helix:         ['formSize', 'aspect', 'turns'],
  sphere:        ['formSize'],
  cube:          ['formSize'],
  cluster:       ['formSize', 'count', 'scatter'],
  'star-prism':  ['formSize', 'aspect', 'facets'],
  'custom-prism':['formSize', 'aspect'],
  torus:         ['formSize', 'aspect'],
  cone:          ['formSize', 'aspect'],
  disc:          ['formSize', 'aspect'],
  'wave-plane':  ['formSize', 'aspect', 'turns'],
  mobius:        ['formSize', 'aspect'],
  'torus-knot':  ['formSize', 'facets', 'turns'],
  box:           ['formSize'],
  saddle:        ['formSize', 'aspect'],
  capsule:       ['formSize', 'aspect'],
  'double-helix':  ['formSize', 'aspect', 'turns'],
  paraboloid:      ['formSize', 'aspect'],
  hyperboloid:     ['formSize', 'aspect'],
  ellipsoid:       ['formSize', 'aspect'],
  spring:          ['formSize', 'aspect', 'turns'],
  shell:           ['formSize', 'turns'],
  catenoid:        ['formSize', 'aspect'],
  superquadric:    ['formSize', 'aspect', 'facets'],
  dini:            ['formSize', 'aspect', 'turns'],
  enneper:         ['formSize'],
  pseudosphere:    ['formSize'],
  scherk:          ['formSize'],
  'boy-surface':   ['formSize'],
  'roman-surface': ['formSize'],
  'klein-bottle':  ['formSize'],
  'knot-27':       ['formSize', 'aspect'],
  'lissajous-3d':  ['formSize', 'aspect', 'facets', 'turns'],
  'cardioid-rev':  ['formSize'],
  'hyperboloid-2': ['formSize', 'aspect'],
  'lemniscate-rev':['formSize'],
  'dupin-cyclide': ['formSize'],
  superformula:    ['formSize', 'aspect', 'facets', 'turns'],
  oloid:           ['formSize'],
  swallowtail:     ['formSize'],
  seifert:         ['formSize'],
};

const $ = (id) => document.getElementById(id);

const state = {
  text: '!"·$%&/()=?¿',
  font: 'courier-regular',
  shape: 'rectangle',
  textColor: '#111111',
  bgColor: '#f4f4f4',
  seed: 1,
  hardWrap: false,
  motion2d: 'static',
  mode: '3d', // '2d' | '3d'
  // --- 3D selects + checkboxes (sliders come from SLIDERS defaults below) ---
  form: 'mobius',
  projection: 'isometric',
  guides: true,
  backfaceMirror: false,
  surfaceText: true,
  vNorm: false,
  wrapMode: 'rings',
  t: 0,
  canvasW: 1350,
  canvasH: 1080,
  cameraEnabled: {
    zoom: true, fov: true,
    rotXSpeed: true, rotYSpeed: true, rotZSpeed: true,
    angleX: true, angleY: true, depthFade: true,
  },
  guideMeta: false,
  opacityMode: 'none',
  blinkMode: 'none',
  blinkFade: 0,
  sizeMode: 'none',
  accentMode:  'none',
  accentMode2: 'none',
  accentMode3: 'none',
  accentMode4: 'none',
  accentColor:  '#e8400a',
  accentColor2: '#0055ff',
  accentColor3: '#00aa55',
  accentColor4: '#ffaa00',
  fps: 0,
  morphForm: '',
  morphForm2: '',
  morphForm3: '',
  morphAuto: false,
  morphClock: 0,
  // Director state
  director: structuredClone(DEFAULT_DIRECTOR),
  directorTime: 0,
  directorRate: 1,
  directorLiveOverrides: {},
  directorRecording: false,
  directorRecordedSamples: {},
  directorActiveLive: {},
  selectedDirectorSceneId: 'scene-1',
  // Custom drawing data (input data, never randomness). Plain arrays so they
  // pass straight into the engine. Default = engine defaults.
  customProfile: DEFAULT_CUSTOM_PROFILE.slice(),
  customOutline: DEFAULT_CUSTOM_OUTLINE.slice(),
  ...Object.fromEntries(Object.entries(SLIDERS).map(([k, v]) => [k, v.def])),
};


// --- Build slider rows ---
const sliderRefs = {}; // key -> { range, number }

function formatSliderValue(key, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (['dropProb', 'yJitterAffect', 'depthFade', 'pulse', 'rainProb', 'wordRamp',
       'charOpacity', 'charSkew', 'densityMap',
       'opacityProb', 'blinkProb', 'sizeProb',
       'accentProb', 'accentProb2', 'accentProb3', 'accentProb4',
       'morphScatter', 'morphSpeedVar'].includes(key)) {
    return n.toFixed(2).replace(/\.?0+$/, '');
  }
  if (['frequency'].includes(key)) return n.toFixed(3).replace(/\.?0+$/, '');
  if (Math.abs(n - Math.round(n)) < 0.0001) return String(Math.round(n));
  return n.toFixed(1).replace(/\.?0+$/, '');
}

function syncOutput(key) {
  const ref = sliderRefs[key];
  if (!ref) return;
  ref.output.textContent = formatSliderValue(key, state[key]);
}

function buildSliders() {
  document.querySelectorAll('.slider').forEach((host) => {
    const key = host.dataset.key;
    const meta = SLIDERS[key];
    if (!meta) return;
    const min = host.dataset.min;
    const max = host.dataset.max;
    const step = host.dataset.step;
    const rangeId = 'rng-' + key;
    const outputId = 'out-' + key;

    host.setAttribute('for', rangeId);

    const line = document.createElement('span');
    line.className = 'control-line';

    const label = document.createElement('span');
    label.textContent = meta.label;

    const output = document.createElement('output');
    output.id = outputId;
    output.setAttribute('for', rangeId);
    output.textContent = formatSliderValue(key, state[key]);

    const range = document.createElement('input');
    range.type = 'range';
    range.id = rangeId;
    range.min = min;
    range.max = max;
    range.step = step;
    range.value = state[key];
    range.setAttribute('aria-valuetext', output.textContent);

    if ('camToggle' in host.dataset) {
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'cam-toggle-btn';
      toggleBtn.setAttribute('aria-label', 'Activa/desactiva ' + meta.label);
      toggleBtn.setAttribute('aria-pressed', 'true');
      toggleBtn.textContent = '[·]';
      host.classList.add('has-cam-toggle');
      toggleBtn.addEventListener('click', () => {
        const nowOn = !state.cameraEnabled[key];
        state.cameraEnabled[key] = nowOn;
        toggleBtn.textContent = nowOn ? '[·]' : '[ ]';
        toggleBtn.setAttribute('aria-pressed', String(nowOn));
        host.classList.toggle('cam-disabled', !nowOn);
        scheduleRender();
      });
      line.prepend(toggleBtn);
    }
    line.append(label, output);
    host.append(line, range);
    sliderRefs[key] = { range, output, min: +min, max: +max };

    range.addEventListener('input', () => {
      state[key] = +range.value;
      syncOutput(key);
      range.setAttribute('aria-valuetext', output.textContent);
      scheduleRender();
    });
  });
}

function syncSliderUI(key) {
  const ref = sliderRefs[key];
  if (!ref) return;
  ref.range.value = state[key];
  syncOutput(key);
  ref.range.setAttribute('aria-valuetext', ref.output.textContent);
}

// --- Render (rAF debounced) ---
// Live preview is a <canvas> painted via drawScene — no SVG parse per frame.
// #artwork keeps role="img" + aria-label; the canvas is decorative inside it.
const artwork = $('artwork');
let displayCanvas = null;
let displayCtx = null;
let displayW = 0; // CSS px
let displayH = 0; // CSS px
let displayDpr = 1;

function ensureCanvas() {
  if (displayCanvas) return;
  displayCanvas = document.createElement('canvas');
  displayCanvas.id = 'displayCanvas';
  artwork.appendChild(displayCanvas);
  displayCtx = displayCanvas.getContext('2d');
  resizeCanvas();
}

// Size the backing store to CSS rect × devicePixelRatio (capped at 2).
function fitArtworkSize() {
  const rect = artwork.getBoundingClientRect();
  const scale = Math.min(rect.width / state.canvasW, rect.height / state.canvasH);
  const fittedW = Math.max(1, Math.round(state.canvasW * scale));
  const fittedH = Math.max(1, Math.round(state.canvasH * scale));
  artwork.style.setProperty('--artwork-w', `${fittedW}px`);
  artwork.style.setProperty('--artwork-h', `${fittedH}px`);
  return { fittedW, fittedH };
}

function resizeCanvas() {
  if (!displayCanvas) return;
  fitArtworkSize();
  displayW = Math.max(1, Math.round(state.canvasW));
  displayH = Math.max(1, Math.round(state.canvasH));
  displayDpr = Math.min(2, window.devicePixelRatio || 1);
  displayCanvas.width = Math.max(1, Math.round(displayW * displayDpr));
  displayCanvas.height = Math.max(1, Math.round(displayH * displayDpr));
}

function applyCanvasSize(width, height) {
  const w = Math.round(Number(width));
  const h = Math.round(Number(height));
  const status = $('formatStatus');
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 100 || h < 100) {
    if (status) status.textContent = 'Mida no vàlida (mínim 100 px).';
    return false;
  }
  state.canvasW = w;
  state.canvasH = h;
  if (status) status.textContent = 'Canvas ' + w + ' × ' + h + ' px';
  const renderInfo = $('renderInfo');
  if (renderInfo) renderInfo.textContent = 'Canvas ' + w + ' × ' + h;
  resizeCanvas();
  render();
  return true;
}

let rafId = null;

function scheduleRender() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    render();
  });
}

function resolveRenderState(atTime = state.directorTime) {
  if (!state.director.enabled) return state;
  const resolved = evaluateDirector(state.director, atTime, state, state.directorLiveOverrides);
  const mode = resolved.params.mode || state.mode;
  const animationSpeed = mode === '2d'
    ? Number(resolved.params.speed2d ?? state.speed2d)
    : Number(resolved.params.speed3d ?? state.speed3d);
  return {
    ...state,
    ...resolved.params,
    t: atTime * (Number.isFinite(animationSpeed) ? animationSpeed : 1),
    morphClock: atTime,
    directorTime: atTime,
    motionBehaviors: resolved.behaviors,
    activeDirectorSceneId: resolved.sceneId,
  };
}

function render(atTime = state.directorTime) {
  ensureCanvas();
  const renderState = resolveRenderState(atTime);
  const scene = buildScene(renderState, displayW, displayH);
  drawScene(displayCtx, scene, displayW, displayH, displayDpr);
  directorUI?.setTime(atTime, renderState.activeDirectorSceneId);
  if (state.director.enabled && renderState.activeDirectorSceneId !== lastAnnouncedDirectorSceneId) {
    lastAnnouncedDirectorSceneId = renderState.activeDirectorSceneId;
    const active = state.director.scenes.find((item) => item.id === renderState.activeDirectorSceneId);
    if (active) announce(`Escena ${active.name}`);
  }
}

// --- Director UI ---
let directorUI = null;
let lastAnnouncedDirectorSceneId = null;

// --- Animation loop ---
let playing = false;
let animId = null;
let lastTs = 0;

function frame(ts) {
  if (!playing) return;
  if (lastTs) {
    const dt = (ts - lastTs) / 1000;
    const speed = state.mode === '2d' ? state.speed2d : state.speed3d;
    state.t += dt * speed;
    state.morphClock = (state.morphClock || 0) + dt; // real seconds, for morph hold
    if (state.director.enabled) {
      state.directorTime = advanceDirectorTime(
        state.directorTime,
        dt * state.directorRate,
        totalDuration(state.director),
        state.director.loop,
      );
    }
    if (dt > 0) state.fps = state.fps * 0.85 + (1 / dt) * 0.15;
    if (recState.isRecording) {
      const fps = getRecordFps();
      recState._accumTime += dt;
      const interval = 1 / fps;
      while (recState._accumTime >= interval) {
        captureFrame();
        recState._accumTime -= interval;
      }
    }
  }
  lastTs = ts;
  render();
  animId = requestAnimationFrame(frame);
}

function play() {
  if (playing) return;
  playing = true;
  lastTs = 0;
  updatePlayPauseUI();
  updateArtworkLabel();
  animId = requestAnimationFrame(frame);
}

function pause() {
  if (!playing) return;
  playing = false;
  if (animId) cancelAnimationFrame(animId); // SC 2.2.2: truly freeze
  animId = null;
  updatePlayPauseUI();
  updateArtworkLabel();
}

function updatePlayPauseUI() {
  const btn = $('playPause');
  if (playing) {
    btn.textContent = 'Pausa';
    btn.setAttribute('aria-label', 'Pausa l’animació');
  } else {
    btn.textContent = 'Reprodueix';
    btn.setAttribute('aria-label', 'Reprodueix l’animació');
  }
}

// Update artwork label ONLY on play/pause change (never per frame).
function updateArtworkLabel() {
  const base = 'Previsualització de tipografia generativa';
  artwork.setAttribute(
    'aria-label',
    playing ? base + ', animació en marxa' : base + ', animació en pausa',
  );
}

// ===========================================================================
// Custom drawing editors (2D profile + 3D outline).
// Drawings are INPUT DATA, not randomness — no PRNG involvement. Same drawing
// + seed + t => identical SVG.
// ===========================================================================

const PROFILE_LEN = 64; // profile array length (matches engine default)
const OUTLINE_LEN = 96; // resampled outline point count
const PROFILE_KEY = 'shaper-custom-profile';
const OUTLINE_KEY = 'shaper-custom-outline';

// --- Predefined 2D profile stamps (offset in [-1,1] per row) ---
function makeProfile(fn) {
  const arr = new Array(PROFILE_LEN);
  for (let i = 0; i < PROFILE_LEN; i++) {
    const t = i / (PROFILE_LEN - 1);
    arr[i] = Math.max(-1, Math.min(1, fn(t)));
  }
  return arr;
}
const PROFILE_STAMPS = {
  's-curve': () => DEFAULT_CUSTOM_PROFILE.slice(),
  zigzag: () => makeProfile((t) => {
    const p = (t * 4) % 1; // 4 teeth
    return (p < 0.5 ? p * 2 : 2 - p * 2) * 2 - 1;
  }),
  steps: () => makeProfile((t) => {
    const s = Math.floor(t * 5) / 4; // 5 levels 0..1
    return s * 2 - 1;
  }),
  pulse: () => makeProfile((t) => (((t * 3) % 1) < 0.5 ? 0.8 : -0.8)),
  clear: () => makeProfile(() => 0),
};

// --- Predefined 3D outline stamps (flat [x,z,...] in [-1,1]) ---
function polyFromRadius(n, radFn) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const rad = radFn(a, i);
    arr.push(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  return arr;
}
const OUTLINE_STAMPS = {
  blob: () => DEFAULT_CUSTOM_OUTLINE.slice(),
  gear: () => polyFromRadius(OUTLINE_LEN, (a) => 0.75 + 0.2 * (Math.sin(a * 9) > 0 ? 1 : -1)),
  arrow: () => [
    -0.4, -0.8, 0.0, -0.8, 0.0, -0.4, 0.8, -0.4,
    0.0, 0.8, -0.8, -0.4, 0.0, -0.4, -0.4, -0.4,
  ],
  triangle: () => [0.0, -0.85, 0.8, 0.6, -0.8, 0.6],
  clear: () => DEFAULT_CUSTOM_OUTLINE.slice(),
};

// Resample a flat outline (any point count) by arc length to OUTLINE_LEN even
// points, normalized to [-1,1] centered on the centroid.
function resampleOutline(flat) {
  const pts = [];
  for (let i = 0; i + 1 < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  if (pts.length < 3) return DEFAULT_CUSTOM_OUTLINE.slice();
  // Centroid-center.
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  const cen = pts.map((p) => [p[0] - cx, p[1] - cy]);
  // Close the loop and measure cumulative arc length.
  const loop = cen.concat([cen[0]]);
  const cum = [0];
  for (let i = 1; i < loop.length; i++) {
    const dx = loop[i][0] - loop[i - 1][0];
    const dy = loop[i][1] - loop[i - 1][1];
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  const total = cum[cum.length - 1] || 1;
  const out = [];
  let seg = 0;
  let maxR = 0;
  for (let k = 0; k < OUTLINE_LEN; k++) {
    const target = (k / OUTLINE_LEN) * total;
    while (seg < cum.length - 2 && cum[seg + 1] < target) seg++;
    const segLen = cum[seg + 1] - cum[seg] || 1;
    const frac = (target - cum[seg]) / segLen;
    const x = loop[seg][0] + (loop[seg + 1][0] - loop[seg][0]) * frac;
    const y = loop[seg][1] + (loop[seg + 1][1] - loop[seg][1]) * frac;
    out.push(x, y);
    maxR = Math.max(maxR, Math.hypot(x, y));
  }
  // Normalize to [-1,1].
  const s = maxR > 0 ? 1 / maxR : 1;
  for (let i = 0; i < out.length; i++) out[i] *= s;
  return out;
}

// --- Persistence ---
function persistProfile() {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(state.customProfile)); } catch (e) {}
}
function persistOutline() {
  try { localStorage.setItem(OUTLINE_KEY, JSON.stringify(state.customOutline)); } catch (e) {}
}
function restoreCustomData() {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY));
    if (Array.isArray(p) && p.length) state.customProfile = p;
  } catch (e) {}
  try {
    const o = JSON.parse(localStorage.getItem(OUTLINE_KEY));
    if (Array.isArray(o) && o.length >= 6) state.customOutline = o;
  } catch (e) {}
}

function updateOpacityVisibility() {
  const mode = state.opacityMode;
  const amtRow  = document.querySelector('[data-key="charOpacity"]');
  const probRow = document.querySelector('[data-key="opacityProb"]');
  const evRow   = document.querySelector('[data-key="opacityEvery"]');
  if (amtRow)  amtRow.hidden  = mode === 'none';
  if (probRow) probRow.hidden = mode !== 'seeded';
  if (evRow)   evRow.hidden   = mode !== 'alternating-word';
}

function updateBlinkVisibility() {
  const mode = state.blinkMode;
  const rateRow  = document.querySelector('[data-key="blinkRate"]');
  const probRow  = document.querySelector('[data-key="blinkProb"]');
  const evRow    = document.querySelector('[data-key="blinkEvery"]');
  const fadeRow  = document.querySelector('[data-key="blinkFade"]');
  if (rateRow)  rateRow.hidden  = mode === 'none';
  if (probRow)  probRow.hidden  = mode !== 'seeded';
  if (evRow)    evRow.hidden    = mode !== 'alternating-word';
  if (fadeRow)  fadeRow.hidden  = mode === 'none';
}

function updateSizeVisibility() {
  const mode = state.sizeMode;
  const amtRow  = document.querySelector('[data-key="sizeAmt"]');
  const probRow = document.querySelector('[data-key="sizeProb"]');
  const evRow   = document.querySelector('[data-key="sizeEvery"]');
  if (amtRow)  amtRow.hidden  = mode === 'none';
  if (probRow) probRow.hidden = mode !== 'seeded';
  if (evRow)   evRow.hidden   = mode !== 'alternating-word';
}

function updateAccentVisibility() {
  [1, 2, 3, 4].forEach(n => {
    const modeKey  = n === 1 ? 'accentMode'  : `accentMode${n}`;
    const colorKey = n === 1 ? 'accentColor' : `accentColor${n}`;
    const probKey  = n === 1 ? 'accentProb'  : `accentProb${n}`;
    const everyKey = n === 1 ? 'accentEvery' : `accentEvery${n}`;
    const mode = state[modeKey];
    const colorEl = document.querySelector(`label[for="${colorKey}"]`);
    const probEl  = document.querySelector(`[data-key="${probKey}"]`);
    const evEl    = document.querySelector(`[data-key="${everyKey}"]`);
    if (colorEl) colorEl.hidden = mode === 'none';
    if (probEl)  probEl.hidden  = mode !== 'seeded';
    if (evEl)    evEl.hidden    = mode !== 'alternating-word';
  });
}

function updateMorphVisibility() {
  const active = !!state.morphForm;
  // Reveal destí 2 once destí 1 is set, destí 3 once destí 2 is set.
  const row2 = document.querySelector('label[for="morphForm2"]');
  const row3 = document.querySelector('label[for="morphForm3"]');
  if (row2) row2.hidden = !state.morphForm;
  if (row3) row3.hidden = !state.morphForm2;
  const autoRow    = document.querySelector('[data-morph="auto-row"]');
  const blendRow   = document.querySelector('[data-key="morphT"]');
  const speedRow   = document.querySelector('[data-key="morphSpeed"]');
  const scatterRow = document.querySelector('[data-key="morphScatter"]');
  if (autoRow)    autoRow.hidden    = !active;
  if (blendRow)   blendRow.hidden   = !active || state.morphAuto;
  if (speedRow)   speedRow.hidden   = !active || !state.morphAuto;
  const speedVarRow = document.querySelector('[data-key="morphSpeedVar"]');
  if (scatterRow)  scatterRow.hidden  = !active;
  if (speedVarRow) speedVarRow.hidden = !active;
}

// --- Visibility (reused by select listeners and init) ---
function updateEditorVisibility() {
  const su2d = $('svgUpload2d');
  const su3d = $('svgUpload3d');
  if (su2d) su2d.hidden = state.shape !== 'custom';
  if (su3d) su3d.hidden = state.form !== 'custom-prism';
  const guideMetaRow = $('guideMetaRow');
  if (guideMetaRow) guideMetaRow.hidden = !state.guides;

  const form = state.form;
  const visibleFormControls = new Set(FORM_3D_CONTROLS[form] || FORM_3D_CONTROLS.plane);
  for (const key of ['formSize', 'aspect', 'facets', 'turns', 'count', 'scatter']) {
    const el = document.querySelector(`.slider[data-key="${key}"]`);
    if (el) el.hidden = !visibleFormControls.has(key);
  }
}

// --- SVG shape import ---
async function loadSvgProfile(file) {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'image/svg+xml');
  const pathEl = doc.querySelector('path');
  if (!pathEl) { announce('Cap path al SVG'); return; }

  const tmpSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tmpSvg.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0';
  document.body.appendChild(tmpSvg);
  const pathClone = document.importNode(pathEl, true);
  tmpSvg.appendChild(pathClone);

  const len = pathClone.getTotalLength();
  const xs = [];
  for (let i = 0; i < PROFILE_LEN; i++) {
    xs.push(pathClone.getPointAtLength((i / (PROFILE_LEN - 1)) * len).x);
  }
  document.body.removeChild(tmpSvg);

  const minX = Math.min(...xs), range = (Math.max(...xs) - minX) || 1;
  state.customProfile = xs.map((x) => ((x - minX) / range) * 2 - 1);
  persistProfile();
  state.shape = 'custom';
  $('shape').value = 'custom';
  updateEditorVisibility();
  scheduleRender();
  announce('Forma SVG carregada');
}

async function loadSvgOutline(file) {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'image/svg+xml');
  const pathEl = doc.querySelector('path');
  if (!pathEl) { announce('Cap path al SVG'); return; }

  const tmpSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tmpSvg.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0';
  document.body.appendChild(tmpSvg);
  const pathClone = document.importNode(pathEl, true);
  tmpSvg.appendChild(pathClone);

  const len = pathClone.getTotalLength();
  const flat = [];
  for (let i = 0; i < OUTLINE_LEN; i++) {
    const pt = pathClone.getPointAtLength((i / OUTLINE_LEN) * len);
    flat.push(pt.x, pt.y);
  }
  document.body.removeChild(tmpSvg);

  state.customOutline = resampleOutline(flat);
  persistOutline();
  state.form = 'custom-prism';
  $('form').value = 'custom-prism';
  updateEditorVisibility();
  scheduleRender();
  announce('Contorn SVG carregat');
}

function announce(msg) {
  const el = $('srAnnounce');
  if (el) el.textContent = msg;
}

// --- Tab navigation (ARIA tabs pattern) ---
function activatePanel(panelId) {
  const panels = document.querySelectorAll('.section-sidebar .panel');
  const targets = document.querySelectorAll('[data-panel-target]');

  panels.forEach((panel) => {
    const isActive = panel.id === panelId;
    panel.hidden = !isActive;
    panel.classList.toggle('is-active', isActive);
  });

  targets.forEach((target) => {
    const isActive = target.dataset.panelTarget === panelId;
    target.setAttribute('aria-pressed', String(isActive));
    target.querySelector('.app-menu-mark').textContent = '[' + (isActive ? '*' : ' ') + ']';
  });

  if (panelId === 'panel-2d' && state.mode !== '2d') {
    state.mode = '2d';
    announce('Mode 2D activat');
    scheduleRender();
  } else if (panelId === 'panel-3d' && state.mode !== '3d') {
    state.mode = '3d';
    announce('Mode 3D activat');
    scheduleRender();
  }

  // Director dock open/close
  const directorOpen = panelId === 'panel-director';
  document.body.toggleAttribute('data-director-open', directorOpen);
  const dock = $('directorDock');
  const livePads = $('directorLivePads');
  if (dock) dock.hidden = !directorOpen;
  if (livePads) livePads.hidden = !directorOpen;
  if (directorOpen) { directorUI?.render(); }
  resizeCanvas();

  if (panelId === 'panel-charmap') buildCharMap();
  const sidebar = document.querySelector('.section-sidebar');
  if (sidebar) sidebar.scrollTop = 0;
}

function bindNavigation() {
  const targets = document.querySelectorAll('[data-panel-target]');

  targets.forEach((button) => {
    button.addEventListener('click', () => {
      const panel = document.getElementById(button.dataset.panelTarget);
      if (!panel) return;
      activatePanel(panel.id);
    });
  });

  activatePanel('panel-atom');

  const navToggle = document.querySelector('#navToggle');
  const appMenu = document.querySelector('#appMenu');
  if (!navToggle || !appMenu) return;

  navToggle.addEventListener('click', () => {
    const isCollapsed = document.body.hasAttribute('data-nav-collapsed');
    if (isCollapsed) {
      appMenu.removeAttribute('inert');
      delete document.body.dataset.navCollapsed;
      navToggle.setAttribute('aria-expanded', 'true');
      navToggle.setAttribute('aria-label', 'Amaga la navegació');
      navToggle.querySelector('span').textContent = '[← nav]';
    } else {
      if (appMenu.contains(document.activeElement)) navToggle.focus();
      appMenu.setAttribute('inert', '');
      document.body.dataset.navCollapsed = '';
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', 'Mostra la navegació');
      navToggle.querySelector('span').textContent = '[→ nav]';
    }
    setTimeout(() => { resizeCanvas(); scheduleRender(); }, 240);
  });
}

// --- Controls wiring ---
function ensureShapeAmplitude() {
  if (state.shape === 'rectangle' || state.amplitude !== 0) return;
  state.amplitude = 80;
  syncSliderUI('amplitude');
}

function wireFormatControls() {
  const formatSelect = $('format-select');
  const customRow = $('custom-size-row');
  const customUnit = $('custom-unit');
  const dpiRow = $('custom-dpi-row');
  const dpiSelect = $('custom-dpi');
  const widthInput = $('custom-width');
  const heightInput = $('custom-height');

  if (!formatSelect) return;

  const syncCustomInputsFromState = () => {
    if (customUnit.value === 'cm') {
      const ppc = Number(dpiSelect.value) / 2.54;
      widthInput.value = (state.canvasW / ppc).toFixed(2);
      heightInput.value = (state.canvasH / ppc).toFixed(2);
      widthInput.step = '0.1';
      heightInput.step = '0.1';
    } else {
      widthInput.value = state.canvasW;
      heightInput.value = state.canvasH;
      widthInput.step = '1';
      heightInput.step = '1';
    }
  };

  const updateUnitLabels = () => {
    const isCm = customUnit.value === 'cm';
    dpiRow.hidden = !isCm;
    document.querySelectorAll('.custom-unit-label').forEach((el) => {
      el.textContent = isCm ? 'cm' : 'px';
    });
    syncCustomInputsFromState();
  };

  formatSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      customRow.hidden = false;
      syncCustomInputsFromState();
      return;
    }
    customRow.hidden = true;
    const [w, h] = e.target.value.split('x').map(Number);
    applyCanvasSize(w, h);
  });

  customUnit.addEventListener('change', updateUnitLabels);
  dpiSelect.addEventListener('change', () => {
    if (customUnit.value === 'cm') syncCustomInputsFromState();
  });

  $('apply-custom-size').addEventListener('click', () => {
    const isCm = customUnit.value === 'cm';
    const dpi = Number(dpiSelect.value);
    const ppc = dpi / 2.54;
    const rawW = Number.parseFloat(widthInput.value);
    const rawH = Number.parseFloat(heightInput.value);
    const w = isCm ? Math.round(rawW * ppc) : Math.round(rawW);
    const h = isCm ? Math.round(rawH * ppc) : Math.round(rawH);
    if (applyCanvasSize(w, h)) {
      const value = `${w}x${h}`;
      const exists = [...formatSelect.options].some((option) => option.value === value);
      formatSelect.value = exists ? value : 'custom';
      customRow.hidden = exists;
    }
  });

  updateUnitLabels();
}

function wireControls() {
  wireFormatControls();

  $('text').addEventListener('input', (e) => {
    state.text = e.target.value;
    scheduleRender();
  });

  $('font').addEventListener('change', (e) => {
    state.font = e.target.value;
    scheduleRender();
  });

  $('shape').addEventListener('change', (e) => {
    state.shape = e.target.value;
    ensureShapeAmplitude();
    updateEditorVisibility(); // focus stays on the select
    scheduleRender();
  });

  $('textColor').addEventListener('input', (e) => {
    state.textColor = e.target.value;
    scheduleRender();
  });
  $('bgColor').addEventListener('input', (e) => {
    state.bgColor = e.target.value;
    scheduleRender();
  });

  const opacityModeEl = $('opacityMode');
  if (opacityModeEl) {
    opacityModeEl.addEventListener('change', (e) => {
      state.opacityMode = e.target.value;
      updateOpacityVisibility();
      scheduleRender();
    });
  }
  const blinkModeEl = $('blinkMode');
  if (blinkModeEl) {
    blinkModeEl.addEventListener('change', (e) => {
      state.blinkMode = e.target.value;
      updateBlinkVisibility();
      scheduleRender();
    });
  }
  const sizeModeEl = $('sizeMode');
  if (sizeModeEl) {
    sizeModeEl.addEventListener('change', (e) => {
      state.sizeMode = e.target.value;
      updateSizeVisibility();
      scheduleRender();
    });
  }
  ['accentMode', 'accentMode2', 'accentMode3', 'accentMode4'].forEach(id => {
    $(id)?.addEventListener('change', (e) => { state[id] = e.target.value; updateAccentVisibility(); scheduleRender(); });
  });
  ['accentColor', 'accentColor2', 'accentColor3', 'accentColor4'].forEach(id => {
    $(id)?.addEventListener('input', (e) => { state[id] = e.target.value; scheduleRender(); });
  });

  $('hardWrap').addEventListener('change', (e) => {
    state.hardWrap = e.target.checked;
    scheduleRender();
  });

  $('motion2d').addEventListener('change', (e) => {
    state.motion2d = e.target.value;
    scheduleRender();
  });

  // --- 3D selects + checkboxes ---
  $('form').addEventListener('change', (e) => {
    state.form = e.target.value;
    updateEditorVisibility();
    // Flat surfaces (plane, wave-plane, saddle) viewed edge-on with arbitrary
    // inherited angles. Reset to face-on when switching to these forms.
    if (state.form === 'plane' || state.form === 'wave-plane' || state.form === 'saddle') {
      state.angleX = 0;
      state.angleY = 0;
      syncSliderUI('angleX');
      syncSliderUI('angleY');
    }
    const st = $('form3d-status');
    if (st) st.textContent = `Paràmetres actualitzats per a ${e.target.options[e.target.selectedIndex].text}`;
    scheduleRender();
  });
  $('projection').addEventListener('change', (e) => {
    state.projection = e.target.value;
    updateFovEnabled();
    scheduleRender();
  });
  $('guides').addEventListener('change', (e) => {
    state.guides = e.target.checked;
    updateEditorVisibility();
    scheduleRender();
  });
  const guideMetaEl = $('guideMeta');
  if (guideMetaEl) {
    guideMetaEl.addEventListener('change', (e) => {
      state.guideMeta = e.target.checked;
      scheduleRender();
    });
  }
  $('backfaceMirror').addEventListener('change', (e) => {
    state.backfaceMirror = e.target.checked;
    scheduleRender();
  });
  $('surfaceText').addEventListener('change', (e) => {
    state.surfaceText = e.target.checked;
    scheduleRender();
  });

  $('wrapMode').addEventListener('change', (e) => {
    state.wrapMode = e.target.value;
    updateEditorVisibility();
    scheduleRender();
  });

  // Clone the destí-1 option list into destí 2 and 3, then sync initial values.
  ['morphForm2', 'morphForm3'].forEach((id) => {
    $(id).innerHTML = $('morphForm').innerHTML;
    $(id).value = state[id];
  });
  ['morphForm', 'morphForm2', 'morphForm3'].forEach((id) => {
    $(id).addEventListener('change', (e) => {
      state[id] = e.target.value;
      updateMorphVisibility();
      scheduleRender();
    });
  });

  $('morphAuto').addEventListener('change', (e) => {
    state.morphAuto = e.target.checked;
    if (state.morphAuto) state.morphClock = 0;
    updateMorphVisibility();
    scheduleRender();
  });

  $('recordVideo').addEventListener('click', toggleRecord);
  $('saveSvg').addEventListener('click', saveSVG);
  $('savePng72').addEventListener('click', () => savePNG(72));
  $('savePng150').addEventListener('click', () => savePNG(150));
  $('savePng300').addEventListener('click', () => savePNG(300));
  $('recordDuration').addEventListener('change', (e) => {
    const loopNote = $('loopNote');
    if (loopNote) loopNote.hidden = e.target.value === 'manual';
  });

  // SVG shape upload
  $('svgFile2d').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadSvgProfile(file);
    e.target.value = '';
  });
  $('svgFile3d').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadSvgOutline(file);
    e.target.value = '';
  });

  // --- Animation controls ---
  $('playPause').addEventListener('click', () => {
    if (playing) pause();
    else play();
  });

  // --- Drag-to-orbit on the artwork div ---
  // Wrap a value into −180..180 (modulo wrap-around).
  function wrapAngle(v) {
    return (((v + 180) % 360) + 360) % 360 - 180;
  }

  let dragActive = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartAngleX = 0;
  let dragStartAngleY = 0;

  artwork.addEventListener('pointerdown', (e) => {
    // SC 2.5.2: record start but do not change state yet (movement required).
    dragActive = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartAngleX = state.angleX;
    dragStartAngleY = state.angleY;
    artwork.setPointerCapture(e.pointerId);
    artwork.classList.add('grabbing');
  });

  artwork.addEventListener('pointermove', (e) => {
    if (!dragActive) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    state.angleY = wrapAngle(dragStartAngleY + dx * 0.5);
    state.angleX = wrapAngle(dragStartAngleX + dy * 0.5);
    syncSliderUI('angleX');
    syncSliderUI('angleY');
    if (!playing) scheduleRender();
  });

  function endDrag() {
    if (!dragActive) return;
    dragActive = false;
    artwork.classList.remove('grabbing');
  }

  artwork.addEventListener('pointerup', endDrag);
  artwork.addEventListener('pointercancel', endDrag);

  // Enter in any number input must not submit
  $('controls').addEventListener('submit', (e) => e.preventDefault());
}

// Native disabled on BOTH fov inputs when projection is isometric.
function updateFovEnabled() {
  const ref = sliderRefs.fov;
  if (!ref) return;
  const disabled = state.projection !== 'perspective';
  ref.range.disabled = disabled;
}

// Randomize all sliders within sensible sub-ranges (avoid degenerate output)
function randomizeValues() {
  const R = (lo, hi) => lo + Math.random() * (hi - lo);
  const ranges = {
    fontSize: [36, 110],
    amplitude: [0, 140],
    frequency: [0.002, 0.02],
    charTrack: [0, 30],
    trackRand: [0, 0.4],
    leading: [30, 120],
    noiseAmt: [0, 50],
    wordTrack: [20, 150],
    wordChaos: [0, 80],
    wordRamp: [0, 1],
    charChaos: [0, 50],
    yJitter: [0, 40],
    yJitterAffect: [0, 1],
    dropProb: [0, 0.15],
    wordsPerRow: [2, 12],
    // 3D params (form/projection/fov/checkboxes intentionally NOT randomized)
    formSize: [200, 700],
    aspect: [0.4, 2.5],
    facets: [3, 8],
    turns: [1, 6],
    count: [1, 6],
    scatter: [0, 180],
    zoom: [0.5, 2],
    rotXSpeed: [-1.2, 1.2],
    rotYSpeed: [-1.2, 1.2],
    rotZSpeed: [-1.2, 1.2],
    depthFade: [0, 0.8],
    pulse: [0, 0.8],
    pulseSpeed: [0.2, 1.5],
    rainProb: [0, 0.4],
    rainSpeed: [0.5, 2],
  };
  for (const [key, [lo, hi]] of Object.entries(ranges)) {
    const step = +sliderRefs[key].range.step || 1;
    let v = R(lo, hi);
    v = Math.round(v / step) * step;
    v = +v.toFixed(4);
    state[key] = v;
    syncSliderUI(key);
  }
  scheduleRender();
}

// --- Export ---
function setExportStatus(msg) {
  const el = $('exportStatus');
  if (el) el.textContent = msg;
}

// Preset feedback lives in its own panel — exportStatus is in a different,
// often-hidden panel, so preset save/load/delete messages must go here.
function setPresetStatus(msg) {
  const el = $('presetStatus');
  if (el) el.textContent = msg;
}

function saveSVG() {
  const width = Math.max(1, Math.round(state.canvasW));
  const height = Math.max(1, Math.round(state.canvasH));
  const svg = buildSVG(state, width, height);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `shaper-${state.seed}.svg` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setExportStatus('SVG exportat.');
}

function savePNG(dpi) {
  const scale = dpi / 72;
  const w = Math.round(state.canvasW * scale);
  const h = Math.round(state.canvasH * scale);
  const oc = document.createElement('canvas');
  oc.width = w; oc.height = h;
  const octx = oc.getContext('2d');
  const scene = buildScene(state, w, h);
  drawScene(octx, scene, w, h, 1);
  setExportStatus('Exportant PNG…');
  oc.toBlob((blob) => {
    if (!blob) { setExportStatus('Error PNG.'); return; }
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `shaper-${dpi}dpi-${state.seed}.png`,
    });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportStatus('PNG exportat.');
  }, 'image/png');
}

// --- Video recording (WebCodecs → MP4) ---
const recState = {
  isRecording: false,
  _stopping: false,
  videoEncoder: null,
  muxer: null,
  frameN: 0,
  loopTotal: 0,
  _accumTime: 0,
};

function getRecordFps() {
  return parseInt($('recordFps')?.value ?? '30');
}

function captureFrame() {
  if (!recState.isRecording || !recState.videoEncoder || !displayCanvas) return;
  const fps = getRecordFps();
  const ts = Math.round(recState.frameN * (1_000_000 / fps));
  const videoFrame = new VideoFrame(displayCanvas, { timestamp: ts });
  recState.videoEncoder.encode(videoFrame, { keyFrame: recState.frameN % (fps * 2) === 0 });
  videoFrame.close();
  recState.frameN++;

  if (recState.frameN % fps === 0) {
    const elapsed = Math.round(recState.frameN / fps);
    if (recState.loopTotal > 0) {
      const remaining = Math.ceil((recState.loopTotal - recState.frameN) / fps);
      setExportStatus(`Gravant… ${remaining}s restants`);
    } else {
      setExportStatus(`Gravant… ${elapsed}s`);
    }
  }

  if (recState.loopTotal > 0 && recState.frameN >= recState.loopTotal) stopRecord();
}

function toggleRecord() {
  if (recState.isRecording) stopRecord();
  else startRecord();
}

async function startRecord() {
  if (recState.isRecording) return;
  if (typeof VideoEncoder === 'undefined') {
    setExportStatus('La gravació MP4 requereix Chrome o Edge.');
    return;
  }
  try {
    const { Muxer, ArrayBufferTarget } = await import('./mp4-muxer.mjs');
    const w = state.canvasW;
    const h = state.canvasH;
    const fps = getRecordFps();
    const durVal = $('recordDuration')?.value ?? 'manual';
    const dur = parseInt(durVal);

    recState.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: w, height: h },
      fastStart: 'in-memory',
    });
    recState.videoEncoder = new VideoEncoder({
      output: (chunk, meta) => recState.muxer.addVideoChunk(chunk, meta),
      error: (e) => setExportStatus(`Error encoder: ${e.message}`),
    });
    recState.videoEncoder.configure({
      codec: 'avc1.640033', width: w, height: h,
      bitrate: 8_000_000, framerate: fps,
      latencyMode: 'quality', hardwareAcceleration: 'prefer-hardware',
    });

    recState.frameN = 0;
    recState._accumTime = 0;
    recState.loopTotal = isNaN(dur) ? 0 : dur * fps;
    recState.isRecording = true;

    const btn = $('recordVideo');
    if (btn) {
      btn.setAttribute('aria-pressed', 'true');
      btn.textContent = 'Atura gravació';
      btn.classList.add('is-recording');
    }
    if ($('recordFps')) $('recordFps').disabled = true;
    if ($('recordDuration')) $('recordDuration').disabled = true;
    setExportStatus('Gravant…');
    if (!playing) play();
  } catch (e) {
    recState.isRecording = false;
    recState.videoEncoder = null;
    recState.muxer = null;
    setExportStatus(`Error de gravació: ${e.message}`);
  }
}

async function stopRecord() {
  if (!recState.videoEncoder || recState._stopping) return;
  recState._stopping = true;
  recState.isRecording = false; // stop captureFrame from queuing more encodes
  try {
    await recState.videoEncoder.flush();
    recState.muxer.finalize();
    const { buffer } = recState.muxer.target;
    const url = URL.createObjectURL(new Blob([buffer], { type: 'video/mp4' }));
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `shaper-${state.seed}.mp4`,
    });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportStatus('MP4 desat.');
  } catch (e) {
    setExportStatus(`Error export: ${e.message}`);
  } finally {
    recState._stopping = false;
    recState.isRecording = false;
    recState.loopTotal = 0;
    recState.videoEncoder = null;
    recState.muxer = null;
    recState.frameN = 0;
    const btn = $('recordVideo');
    if (btn) {
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = 'Grava MP4';
      btn.classList.remove('is-recording');
    }
    if ($('recordFps')) $('recordFps').disabled = false;
    if ($('recordDuration')) $('recordDuration').disabled = false;
  }
}

// --- Presets ---
const PRESETS_KEY = 'shaper-presets-v1';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function loadPresets() {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) ?? []; } catch { return []; }
}
function savePresets(list) {
  try { localStorage.setItem(PRESETS_KEY, JSON.stringify(list)); } catch { /* quota */ }
}

function capturePreset() {
  const snap = { v: 1 };
  Object.keys(SLIDERS).forEach((k) => { snap[k] = state[k]; });
  ['text', 'font', 'shape', 'textColor', 'bgColor', 'hardWrap',
   'motion2d', 'mode', 'form', 'projection', 'guides',
   'backfaceMirror', 'surfaceText', 'wrapMode', 'canvasW', 'canvasH',
   'opacityMode', 'blinkMode', 'blinkFade', 'sizeMode',
   'accentMode', 'accentMode2', 'accentMode3', 'accentMode4',
   'accentColor', 'accentColor2', 'accentColor3', 'accentColor4',
   'morphForm', 'morphForm2', 'morphForm3', 'morphAuto'].forEach((k) => {
    snap[k] = state[k];
  });
  return snap;
}

function applyPreset(p) {
  if (!p || p.v !== 1) return;
  Object.keys(SLIDERS).forEach((k) => {
    if (p[k] != null) { state[k] = p[k]; syncSliderUI(k); }
  });
  if (p.text    != null) { state.text    = p.text;    $('text').value    = p.text; }
  if (p.font    != null) { state.font    = p.font;    $('font').value    = p.font; }
  if (p.shape   != null) { state.shape   = p.shape;   $('shape').value   = p.shape; }
  if (p.textColor != null) { state.textColor = p.textColor; $('textColor').value = p.textColor; }
  if (p.bgColor   != null) { state.bgColor   = p.bgColor;   $('bgColor').value   = p.bgColor; }
  if (p.hardWrap  != null) { state.hardWrap  = p.hardWrap;  $('hardWrap').checked  = p.hardWrap; }
  if (p.motion2d  != null) { state.motion2d  = p.motion2d;  $('motion2d').value    = p.motion2d; }
  if (p.speed2d != null) { state.speed2d = p.speed2d; syncSliderUI('speed2d'); }
  if (p.speed3d != null) { state.speed3d = p.speed3d; syncSliderUI('speed3d'); }
  // backward compat: presets saved before the split had a single 'speed'
  if (p.speed != null && p.speed2d == null) {
    state.speed2d = p.speed; state.speed3d = p.speed;
    syncSliderUI('speed2d'); syncSliderUI('speed3d');
  }
  if (p.mode != null) {
    state.mode = p.mode;
    activatePanel(p.mode === '2d' ? 'panel-2d' : 'panel-3d');
    updateEditorVisibility();
  }
  if (p.form       != null) { state.form       = p.form;       $('form').value       = p.form;       updateEditorVisibility(); }
  if (p.projection != null) { state.projection = p.projection; $('projection').value = p.projection; updateFovEnabled(); }
  if (p.guides          != null) { state.guides          = p.guides;          $('guides').checked          = p.guides; }
  if (p.backfaceMirror  != null) { state.backfaceMirror  = p.backfaceMirror;  $('backfaceMirror').checked  = p.backfaceMirror; }
  if (p.surfaceText     != null) { state.surfaceText      = p.surfaceText;     $('surfaceText').checked     = p.surfaceText; }
  if (p.wrapMode        != null) { state.wrapMode         = p.wrapMode;        $('wrapMode').value          = p.wrapMode; updateEditorVisibility(); }
  if (p.canvasW && p.canvasH) applyCanvasSize(p.canvasW, p.canvasH);
  if (p.blinkFade != null) {
    state.blinkFade = typeof p.blinkFade === 'number' ? p.blinkFade : (p.blinkFade ? 1 : 0);
    syncSliderUI('blinkFade');
  }
  if (p.opacityMode != null) {
    state.opacityMode = p.opacityMode;
    const el = $('opacityMode');
    if (el) el.value = p.opacityMode;
    updateOpacityVisibility();
  }
  if (p.blinkMode != null) {
    state.blinkMode = p.blinkMode;
    const el = $('blinkMode');
    if (el) el.value = p.blinkMode;
    updateBlinkVisibility();
  }
  if (p.sizeMode != null) {
    state.sizeMode = p.sizeMode;
    const el = $('sizeMode');
    if (el) el.value = p.sizeMode;
    updateSizeVisibility();
  }
  ['accentMode', 'accentMode2', 'accentMode3', 'accentMode4'].forEach(k => {
    if (p[k] != null) { state[k] = p[k]; const el = $(k); if (el) el.value = p[k]; }
  });
  if (['accentMode','accentMode2','accentMode3','accentMode4'].some(k => p[k] != null)) updateAccentVisibility();
  ['accentColor', 'accentColor2', 'accentColor3', 'accentColor4'].forEach(k => {
    if (p[k] != null) { state[k] = p[k]; const el = $(k); if (el) el.value = p[k]; }
  });
  ['morphForm', 'morphForm2', 'morphForm3'].forEach((k) => {
    if (p[k] != null) { state[k] = p[k]; const el = $(k); if (el) el.value = p[k]; }
  });
  if (p.morphAuto != null) {
    state.morphAuto = p.morphAuto;
    const el = $('morphAuto');
    if (el) el.checked = p.morphAuto;
  }
  if (['morphForm','morphForm2','morphForm3','morphAuto'].some(k => p[k] != null)) updateMorphVisibility();
  scheduleRender();
}

// --- GitHub preset state ---
let _ghProjects = [];
let _ghPresets  = []; // { name, path }

function _ghUpdateView() {
  const has = !!getToken();
  const setup = $('ghSetup');
  const ui    = $('ghUI');
  if (setup) setup.hidden = has;
  if (ui)    ui.hidden    = !has;
}

async function _ghLoadProjects() {
  let projects = await listProjects();
  if (!projects.length) projects = ['General'];
  _ghProjects = projects;
  const sel = $('ghProject');
  if (sel) sel.innerHTML = projects.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
}

async function _ghLoadPresets() {
  const project = $('ghProject')?.value;
  if (!project) return;
  const list = $('presetList');
  if (list) list.innerHTML = `<li style="color:var(--ink-4);font-size:var(--text-xs);padding:var(--space-1) 0">Carregant…</li>`;
  _ghPresets = await listPresets(project);
  _ghRenderList();
}

function _ghRenderList() {
  const list = $('presetList');
  if (!list) return;
  if (!_ghPresets.length) {
    list.innerHTML = `<li style="color:var(--ink-4);font-size:var(--text-xs);padding:var(--space-1) 0">Cap preset desat.</li>`;
    return;
  }
  list.innerHTML = _ghPresets.map((p, i) => `
    <li class="preset-item">
      <span class="preset-name">${esc(p.name)}</span>
      <button class="preset-btn preset-load" data-idx="${i}" type="button" aria-label="Carrega el preset ${esc(p.name)}">Load</button>
      <button class="preset-btn preset-delete" data-idx="${i}" type="button" aria-label="Elimina el preset ${esc(p.name)}">✕</button>
    </li>`).join('');
}

function wirePresets() {
  _ghUpdateView();
  if (getToken()) {
    _ghLoadProjects().then(() => _ghLoadPresets()).catch(e => setPresetStatus('Error GitHub: ' + e.message));
  }

  // Connect
  $('ghConnect')?.addEventListener('click', async () => {
    const tokenEl = $('ghToken');
    const token = tokenEl?.value.trim();
    if (!token) return;
    setToken(token);
    try {
      const login = await validateToken();
      if (tokenEl) tokenEl.value = '';
      _ghUpdateView();
      await _ghLoadProjects();
      await _ghLoadPresets();
      setPresetStatus(`Connectat com a @${login}`);
    } catch (e) {
      clearToken();
      _ghUpdateView();
      setPresetStatus('Token invàlid: ' + e.message);
    }
  });

  // Disconnect
  $('ghDisconnect')?.addEventListener('click', () => {
    clearToken();
    _ghUpdateView();
    setPresetStatus('Desconnectat de GitHub.');
  });

  // Project change
  $('ghProject')?.addEventListener('change', () => {
    _ghLoadPresets().catch(e => setPresetStatus('Error: ' + e.message));
  });

  // New project
  $('ghNewProject')?.addEventListener('click', () => {
    const name = prompt('Nom del nou projecte:')?.trim();
    if (!name) return;
    if (!_ghProjects.includes(name)) {
      _ghProjects = [..._ghProjects, name].sort();
      const sel = $('ghProject');
      if (sel) sel.innerHTML = _ghProjects.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
    }
    const sel = $('ghProject');
    if (sel) sel.value = name;
    _ghPresets = [];
    _ghRenderList();
  });

  // Save
  $('savePreset')?.addEventListener('click', async () => {
    const nameEl  = $('presetName');
    const project = $('ghProject')?.value;
    const name    = nameEl?.value.trim() || `preset-${new Date().toLocaleTimeString()}`;
    if (!project) { setPresetStatus('Selecciona un projecte.'); return; }
    try {
      setPresetStatus('Desant…');
      await savePreset(project, name, capturePreset());
      if (nameEl) nameEl.value = '';
      await _ghLoadPresets();
      setPresetStatus(`Desat: "${name}"`);
    } catch (e) { setPresetStatus('Error desant: ' + e.message); }
  });

  // Load / Delete
  $('presetList')?.addEventListener('click', async (e) => {
    const loadBtn = e.target.closest('.preset-load');
    const delBtn  = e.target.closest('.preset-delete');

    if (loadBtn) {
      const p = _ghPresets[parseInt(loadBtn.dataset.idx)];
      if (!p) return;
      try {
        setPresetStatus('Carregant…');
        applyPreset(await loadPreset(p.path));
        setPresetStatus(`Carregat: "${p.name}"`);
      } catch (e) { setPresetStatus('Error carregant: ' + e.message); }
    }

    if (delBtn) {
      if (delBtn.dataset.confirming === '1') {
        clearTimeout(Number(delBtn.dataset.timer));
        const p = _ghPresets[parseInt(delBtn.dataset.idx)];
        if (!p) return;
        try {
          await deletePreset(p.path);
          await _ghLoadPresets();
          setPresetStatus(`Eliminat: "${p.name}"`);
        } catch (e) { setPresetStatus('Error eliminant: ' + e.message); }
      } else {
        const name = delBtn.getAttribute('aria-label').replace('Elimina el preset ', '');
        delBtn.dataset.confirming = '1';
        delBtn.textContent = 'Sure?';
        delBtn.setAttribute('aria-label', `Confirma: elimina el preset ${name}`);
        const timer = setTimeout(() => {
          delBtn.dataset.confirming = '';
          delBtn.textContent = '✕';
          delBtn.setAttribute('aria-label', `Elimina el preset ${name}`);
        }, 3000);
        delBtn.dataset.timer = String(timer);
      }
    }
  });

  // Migrate localStorage → GitHub
  $('ghMigrate')?.addEventListener('click', async () => {
    const locals  = loadPresets();
    const project = $('ghProject')?.value;
    if (!locals.length) { setPresetStatus('Cap preset local a importar.'); return; }
    if (!project)       { setPresetStatus('Selecciona un projecte.'); return; }
    let ok = 0;
    setPresetStatus(`Important ${locals.length} presets…`);
    for (const p of locals) {
      try { await savePreset(project, p.name, p.data); ok++; } catch { /* skip */ }
    }
    await _ghLoadPresets();
    setPresetStatus(`Importats ${ok}/${locals.length} presets a "${project}".`);
  });
}

// --- Director live behavior + gesture recording (Task 8) ---

function setLiveBehavior(type, value) {
  const activeSceneId = evaluateDirector(state.director, state.directorTime, state).sceneId;
  const scene = state.director.scenes.find((item) => item.id === activeSceneId);
  const behavior = scene?.behaviors.find((item) => item.type === type);
  if (!behavior) return;
  const field = type === 'attract' ? 'strength' : 'progress';
  const baseValue = Number(behavior.params[field]) || 0;
  const liveValue = type === 'attract' ? value * Math.max(1, Math.abs(baseValue)) : Math.max(0, value);
  state.directorActiveLive = { ...state.directorActiveLive, [type]: { sceneId: scene.id, behaviorId: behavior.id, field, baseValue } };
  state.directorLiveOverrides = { ...state.directorLiveOverrides, [behavior.id]: { params: { [field]: liveValue } } };
  if (state.directorRecording) {
    const path = `${scene.id}|behavior:${behavior.id}:${field}`;
    const list = state.directorRecordedSamples[path] || [];
    state.directorRecordedSamples = { ...state.directorRecordedSamples, [path]: [...list, { time: state.directorTime, value: liveValue }] };
  }
  scheduleRender();
}

function clearLiveBehavior(type) {
  const active = state.directorActiveLive[type];
  if (!active) return;
  const scene = state.director.scenes.find((item) => item.id === active.sceneId);
  const behavior = scene?.behaviors.find((item) => item.id === active.behaviorId);
  if (!scene || !behavior) return;
  const { field, baseValue } = active;
  if (state.directorRecording) {
    const path = `${scene.id}|behavior:${behavior.id}:${field}`;
    const list = state.directorRecordedSamples[path] || [];
    state.directorRecordedSamples = { ...state.directorRecordedSamples, [path]: [...list, { time: state.directorTime, value: baseValue }] };
  }
  const next = { ...state.directorLiveOverrides }; delete next[behavior.id];
  state.directorLiveOverrides = next;
  const activeNext = { ...state.directorActiveLive }; delete activeNext[type];
  state.directorActiveLive = activeNext;
  scheduleRender();
}

function finishDirectorRecording() {
  let director = normalizeDirector(state.director);
  for (const [compoundPath, samples] of Object.entries(state.directorRecordedSamples)) {
    const separator = compoundPath.indexOf('|');
    const sceneId = compoundPath.slice(0, separator);
    const path = compoundPath.slice(separator + 1);
    const sceneIndex = director.scenes.findIndex((scene) => scene.id === sceneId);
    if (sceneIndex < 0) continue;
    const sceneStart = director.scenes.slice(0, sceneIndex).reduce((sum, scene) => sum + scene.duration, 0);
    const scene = director.scenes[sceneIndex];
    const frames = simplifySamples(samples, 0.02).map((frame) => ({
      time: Math.max(0, Math.min(scene.duration, frame.time - sceneStart)),
      value: frame.value, easing: 'linear',
    }));
    const scenes = director.scenes.slice();
    scenes[sceneIndex] = { ...scene, automations: { ...scene.automations, [path]: frames } };
    director = { ...director, scenes };
  }
  state.director = director;
  state.directorRecording = false;
  state.directorRecordedSamples = {};
  $('directorRecord').setAttribute('aria-pressed', 'false');
  directorUI.render();
}

// --- Director scene editing helpers ---
function replaceDirectorScene(nextScene) {
  state.director = { ...state.director, scenes: state.director.scenes.map((scene) => scene.id === nextScene.id ? nextScene : scene) };
  directorUI.render(); scheduleRender();
}
function selectedDirectorScene() {
  return state.director.scenes.find((scene) => scene.id === state.selectedDirectorSceneId) || state.director.scenes[0];
}
function handleDirectorSceneAction(action) {
  const scene = selectedDirectorScene();
  const index = state.director.scenes.findIndex((item) => item.id === scene.id);
  if (action === 'add') state.director = addScene(state.director, { name: `Escena ${state.director.scenes.length + 1}` });
  if (action === 'duplicate') state.director = duplicateScene(state.director, scene.id);
  if (action === 'left') state.director = moveScene(state.director, index, index - 1);
  if (action === 'right') state.director = moveScene(state.director, index, index + 1);
  if (action === 'delete') state.director = removeScene(state.director, scene.id);
  if (!state.director.scenes.some((item) => item.id === state.selectedDirectorSceneId)) {
    state.selectedDirectorSceneId = state.director.scenes[Math.min(index, state.director.scenes.length - 1)].id;
  }
  directorUI.render(); scheduleRender();
}
function updateSelectedSceneDuration(duration) { replaceDirectorScene(normalizeScene({ ...selectedDirectorScene(), duration })); }
function updateSelectedTransition(patch) { const s = selectedDirectorScene(); replaceDirectorScene(normalizeScene({ ...s, transition: { ...s.transition, ...patch } })); }
function addSelectedBehavior(type) { replaceDirectorScene(upsertBehavior(selectedDirectorScene(), type)); }
function updateSelectedBehavior(id, patch) { replaceDirectorScene(updateBehavior(selectedDirectorScene(), id, patch)); }
function removeSelectedBehavior(id) { replaceDirectorScene(removeBehavior(selectedDirectorScene(), id)); }

function installAutomationButtons() {
  for (const [name, id] of Object.entries(AUTOMATION_CONTROL_IDS)) {
    const control = $(id);
    if (!control || document.querySelector(`[data-automation-path="${name}"]`)) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'automation-key-button';
    button.dataset.automationPath = name;
    button.setAttribute('aria-label', `Afegeix keyframe a ${name}`);
    const glyph = document.createElement('span');
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = '◇';
    button.appendChild(glyph);
    control.insertAdjacentElement('afterend', button);
    button.addEventListener('click', () => {
      const kind = AUTOMATABLE_PARAMS[name];
      const value = kind === 'number' ? Number(control.value) : control.value;
      const { localTime } = evaluateDirector(state.director, state.directorTime, state);
      const scene = selectedDirectorScene();
      replaceDirectorScene(upsertKeyframe(scene, `param:${name}`, { time: localTime, value, easing: kind === 'hold' ? 'hold' : 'linear' }));
    });
  }
}

// --- Director wiring ---
function wireDirector() {
  directorUI = mountDirectorUI({
    inspector: $('directorInspector'),
    timeline: $('directorTimeline'),
    getState: () => state,
    onSelectScene: (id) => { state.selectedDirectorSceneId = id; directorUI.render(); },
    onSeek: (time) => { state.directorTime = time; render(time); directorUI.render(); },
    onToggleEnabled: (enabled) => { state.director = { ...state.director, enabled }; scheduleRender(); directorUI.render(); },
    onSceneAction: handleDirectorSceneAction,
    onSceneDuration: updateSelectedSceneDuration,
    onTransitionChange: updateSelectedTransition,
    onAddBehavior: addSelectedBehavior,
    onUpdateBehavior: updateSelectedBehavior,
    onRemoveBehavior: removeSelectedBehavior,
    onAddKeyframe: (path, _field) => {
      const { localTime } = evaluateDirector(state.director, state.directorTime, state);
      const scene = selectedDirectorScene();
      const kind = path.startsWith('param:') ? (AUTOMATABLE_PARAMS[path.slice(6)] || 'number') : 'number';
      replaceDirectorScene(upsertKeyframe(scene, path, { time: localTime, value: 0, easing: kind === 'hold' ? 'hold' : 'linear' }));
    },
  });

  const resizeHandle = $('directorResize');
  let resizeStart = null;
  if (resizeHandle) {
    resizeHandle.addEventListener('pointerdown', (event) => {
      resizeStart = { y: event.clientY, height: $('directorDock').getBoundingClientRect().height };
      resizeHandle.setPointerCapture(event.pointerId);
    });
    resizeHandle.addEventListener('pointermove', (event) => {
      if (!resizeStart) return;
      const height = Math.max(140, Math.min(480, resizeStart.height + resizeStart.y - event.clientY));
      document.body.style.setProperty('--director-dock-height', `${height}px`);
      resizeHandle.setAttribute('aria-valuenow', String(Math.round(height)));
      resizeCanvas();
    });
    resizeHandle.addEventListener('pointerup', () => { resizeStart = null; });
    resizeHandle.addEventListener('pointercancel', () => { resizeStart = null; });
    resizeHandle.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      const current = Number(resizeHandle.getAttribute('aria-valuenow')) || 220;
      const height = Math.max(140, Math.min(480, current + (event.key === 'ArrowUp' ? 10 : -10)));
      document.body.style.setProperty('--director-dock-height', `${height}px`);
      resizeHandle.setAttribute('aria-valuenow', String(height));
      resizeCanvas();
      event.preventDefault();
    });
  }

  // Collapse toggle
  const collapseBtn = $('directorCollapse');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      const collapsed = document.body.hasAttribute('data-director-collapsed');
      if (collapsed) {
        document.body.removeAttribute('data-director-collapsed');
        collapseBtn.setAttribute('aria-expanded', 'true');
      } else {
        document.body.setAttribute('data-director-collapsed', '');
        collapseBtn.setAttribute('aria-expanded', 'false');
      }
      resizeCanvas();
    });
  }

  // Stop button
  const stopBtn = $('directorStop');
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      pause();
      state.directorTime = 0;
      render(0);
      directorUI.render();
    });
  }

  // Hold (play/pause) toggle
  const holdBtn = $('directorHold');
  if (holdBtn) {
    holdBtn.addEventListener('click', () => {
      if (playing) {
        pause();
        holdBtn.setAttribute('aria-pressed', 'true');
      } else {
        play();
        holdBtn.setAttribute('aria-pressed', 'false');
      }
    });
  }

  // Reverse direction toggle
  const reverseBtn = $('directorReverse');
  if (reverseBtn) {
    reverseBtn.addEventListener('click', () => {
      state.directorRate = (state.directorRate ?? 1) * -1;
      reverseBtn.setAttribute('aria-pressed', String(state.directorRate < 0));
    });
  }

  // Loop toggle
  const loopBtn = $('directorLoop');
  if (loopBtn) {
    loopBtn.addEventListener('click', () => {
      const nowLoop = !state.director.loop;
      state.director = { ...state.director, loop: nowLoop };
      loopBtn.setAttribute('aria-pressed', String(nowLoop));
    });
  }

  // REC button — start/stop gesture recording
  const recBtn = $('directorRecord');
  if (recBtn) {
    recBtn.addEventListener('click', () => {
      if (state.directorRecording) {
        finishDirectorRecording();
        announce('Gravació aturada');
      } else {
        state.directorRecording = true;
        state.directorRecordedSamples = {};
        $('directorRecord').setAttribute('aria-pressed', 'true');
        announce('Gravant');
      }
    });
  }

  // Live pads — mount into #directorLivePads
  mountLivePads($('directorLivePads'), {
    onLiveStart: (type, value) => setLiveBehavior(type, value),
    onLiveEnd:   (type)        => clearLiveBehavior(type),
  });
}

// --- Character Map ---
const CHARMAP_FONT_CSS = {
  'times-regular':     { family: '"Times New Roman", Times, serif', weight: 400 },
  'times-bold':        { family: '"Times New Roman", Times, serif', weight: 700 },
  'courier-regular':   { family: '"Courier New", Courier, monospace', weight: 400 },
  'courier-bold':      { family: '"Courier New", Courier, monospace', weight: 700 },
  'helvetica-regular': { family: 'Helvetica, Arial, sans-serif', weight: 400 },
  'helvetica-bold':    { family: 'Helvetica, Arial, sans-serif', weight: 700 },
};

const CHAR_BLOCKS = [
  { label: 'Basic Latin (ASCII)',          start: 0x0020, end: 0x007E },
  { label: 'Latin-1 Supplement',           start: 0x00A0, end: 0x00FF },
  { label: 'Latin Extended-A',             start: 0x0100, end: 0x017F },
  { label: 'Latin Extended-B',             start: 0x0180, end: 0x024F },
  { label: 'IPA Extensions',               start: 0x0250, end: 0x02AF },
  { label: 'Space Modifier Letters',       start: 0x02B0, end: 0x02FF },
  { label: 'Combining Diacritical Marks',  start: 0x0300, end: 0x036F },
  { label: 'Greek and Coptic',             start: 0x0370, end: 0x03FF },
  { label: 'Cyrillic',                     start: 0x0400, end: 0x04FF },
  { label: 'General Punctuation',          start: 0x2000, end: 0x206F },
  { label: 'Superscripts & Subscripts',    start: 0x2070, end: 0x209F },
  { label: 'Currency Symbols',             start: 0x20A0, end: 0x20CF },
  { label: 'Letterlike Symbols',           start: 0x2100, end: 0x214F },
  { label: 'Number Forms',                 start: 0x2150, end: 0x218F },
  { label: 'Arrows',                       start: 0x2190, end: 0x21FF },
  { label: 'Mathematical Operators',       start: 0x2200, end: 0x22FF },
  { label: 'Enclosed Alphanumerics',       start: 0x2460, end: 0x24FF },
  { label: 'Box Drawing',                  start: 0x2500, end: 0x257F },
  { label: 'Block Elements',               start: 0x2580, end: 0x259F },
  { label: 'Geometric Shapes',             start: 0x25A0, end: 0x25FF },
  { label: 'Miscellaneous Symbols',        start: 0x2600, end: 0x26FF },
  { label: 'Dingbats',                     start: 0x2700, end: 0x27BF },
  { label: 'Braille Patterns',             start: 0x2800, end: 0x28FF },
];

function buildCharMap() {
  const container = $('panel-charmap');
  if (!container || container.dataset.built) return;
  container.dataset.built = '1';

  const blocksEl = $('charmapBlocks');
  const fontSel = $('charmapFont');
  const searchEl = $('charmapSearch');

  fontSel.value = CHARMAP_FONT_CSS[state.font] ? state.font : 'courier-regular';

  function gridStyle() {
    const f = CHARMAP_FONT_CSS[fontSel.value] || CHARMAP_FONT_CSS['courier-regular'];
    return 'font-family:' + f.family + ';font-weight:' + f.weight;
  }

  CHAR_BLOCKS.forEach(({ label, start, end }) => {
    const section = document.createElement('div');
    section.className = 'charmap-block';
    section.dataset.blockLabel = label.toLowerCase();

    const title = document.createElement('p');
    title.className = 'charmap-block-title';
    title.textContent = label;
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'charmap-grid';
    grid.setAttribute('style', gridStyle());

    for (let cp = start; cp <= end; cp++) {
      const ch = String.fromCodePoint(cp);
      const hex = cp.toString(16).toUpperCase().padStart(4, '0');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'charmap-cell';
      btn.setAttribute('aria-label', 'U+' + hex + ' — copia');
      btn.dataset.cp = hex;
      btn.dataset.ch = ch;

      const charSpan = document.createElement('span');
      charSpan.className = 'charmap-char';
      charSpan.setAttribute('aria-hidden', 'true');
      charSpan.textContent = ch;

      const hexSpan = document.createElement('span');
      hexSpan.className = 'charmap-hex';
      hexSpan.setAttribute('aria-hidden', 'true');
      hexSpan.textContent = hex;

      btn.append(charSpan, hexSpan);

      btn.addEventListener('click', () => {
        // Append char to Atom text
        const textEl = $('text');
        if (textEl) {
          state.text += ch;
          textEl.value = state.text;
          scheduleRender();
        }
        navigator.clipboard.writeText(ch).then(() => {
          btn.classList.add('is-copied');
          announce('Afegit U+' + hex);
          setTimeout(() => btn.classList.remove('is-copied'), 500);
        }).catch(() => {
          announce('Afegit U+' + hex);
        });
      });

      grid.appendChild(btn);
    }

    section.appendChild(grid);
    blocksEl.appendChild(section);
  });

  fontSel.addEventListener('change', () => {
    const style = gridStyle();
    blocksEl.querySelectorAll('.charmap-grid').forEach((g) => g.setAttribute('style', style));
  });

  searchEl.addEventListener('input', () => {
    const q = searchEl.value.trim().toLowerCase();
    blocksEl.querySelectorAll('.charmap-block').forEach((block) => {
      if (!q) {
        block.hidden = false;
        block.querySelectorAll('.charmap-cell').forEach((c) => { c.hidden = false; });
        return;
      }
      if (block.dataset.blockLabel.includes(q)) {
        block.hidden = false;
        block.querySelectorAll('.charmap-cell').forEach((c) => { c.hidden = false; });
        return;
      }
      let any = false;
      block.querySelectorAll('.charmap-cell').forEach((cell) => {
        const vis = cell.dataset.cp.toLowerCase().includes(q) || cell.dataset.ch === q;
        cell.hidden = !vis;
        if (vis) any = true;
      });
      block.hidden = !any;
    });
  });
}

// --- Init ---
function init() {
  restoreCustomData();
  buildSliders();
  installAutomationButtons();
  bindNavigation();
  wireControls();
  wirePresets();
  wireDirector();
  // Sync select / checkbox UI to state defaults
  $('text').value = state.text;
  $('font').value = state.font;
  $('motion2d').value = state.motion2d;
  $('form').value = state.form;
  $('projection').value = state.projection;
  $('guides').checked = state.guides;
  $('backfaceMirror').checked = state.backfaceMirror;
  $('surfaceText').checked = state.surfaceText;

  $('wrapMode').value = state.wrapMode;
  // Sync format-select and renderInfo to default canvas size
  const formatSel = $('format-select');
  if (formatSel) {
    const canvasVal = `${state.canvasW}x${state.canvasH}`;
    const exists = [...formatSel.options].some((o) => o.value === canvasVal);
    formatSel.value = exists ? canvasVal : 'custom';
  }
  const renderInfo = $('renderInfo');
  if (renderInfo) renderInfo.textContent = `Canvas ${state.canvasW} × ${state.canvasH}`;
  updateFovEnabled();
  updateEditorVisibility();
  updateOpacityVisibility();
  updateBlinkVisibility();
  updateSizeVisibility();
  updateAccentVisibility();
  updateMorphVisibility();
  updatePlayPauseUI();
  updateArtworkLabel();
  render();

  play();
  const rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onReducedChange = (e) => {
    if (e.matches) pause();
  };
  if (typeof rmq.addEventListener === 'function') {
    rmq.addEventListener('change', onReducedChange);
  } else if (typeof rmq.addListener === 'function') {
    rmq.addListener(onReducedChange); // older Safari
  }

  // Re-render on resize (resize the canvas backing store first).
  let resizeRaf = null;
  window.addEventListener('resize', () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = null;
      resizeCanvas();
      render();
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
