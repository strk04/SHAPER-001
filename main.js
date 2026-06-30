// main.js — UI wiring for SHAPER 001
import { buildSVG, buildScene, drawScene, DEFAULT_CUSTOM_OUTLINE } from './engine.js';
import { encodeDirectorFrames, resolveOfflineAnimationState } from './export-video.js';
import { store as _ghStore } from './presets-github.js';
import { createPresetPanel } from './preset-panel.js';
import { captureCreativePreset } from './preset-state.js';
import { DEFAULT_DIRECTOR, advanceDirectorTime, evaluateDirector, normalizeDirector, normalizeScene, totalDuration, applySceneAction, setSceneMovement, updateBehavior, upsertKeyframe, removeKeyframe, AUTOMATABLE_PARAMS } from './director.js';
import { mountDirectorUI, AUTOMATION_CONTROL_IDS } from './director-ui.js';

// Slider definitions: key -> { label, default }
const SLIDERS = {
  // --- Funcionals: necessiten valor per funcionar ---
  fontSize:    { label: 'Cos', def: 24 },
  leading:     { label: 'Interlínia', def: 50 },
  wordsPerRow: { label: 'Paraules per línia', def: 2 },
  speed3d:     { label: 'Velocitat', def: 0.1 },
  formSize:    { label: 'Mida de forma', def: 413 },
  aspect:      { label: 'Proporció', def: 1 },
  facets:      { label: 'Cares', def: 4 },
  turns:       { label: 'Voltes', def: 1 },
  count:       { label: 'Quantitat', def: 1 },
  fov:         { label: 'Camp visual', def: 60 },
  zoom:        { label: 'Zoom', def: 1 },
  surfaceTransparency: { label: 'Transparència superfície', def: 0.25 },
  // --- Efectes: 0 = sense efecte ---
  amplitude:     { label: 'Amplitud', def: 0 },
  frequency:     { label: 'Freqüència', def: 0.001 },
  charTrack:     { label: 'Kerning', def: 0 },
  noiseAmt:      { label: 'Soroll horitzontal', def: 0 },
  wordTrack:     { label: 'Espai entre paraules', def: 0 },
  wordChaos:     { label: 'Variació de paraules', def: 0 },
  wordRamp:      { label: 'Progressió de paraules', def: 0 },
  charChaos:     { label: 'Desordre de lletres', def: 0 },
  yJitter:       { label: 'Tremolor vertical', def: 0 },
  yJitterAffect: { label: 'Abast del tremolor', def: 0 },
  dropProb:      { label: 'Amagar caràcters', def: 0 },
  densityMap:    { label: 'Mapa de densitat', def: 0 },
  charOpacity:   { label: 'Grau', def: 0 },
  charSkew:      { label: 'Inclinació aleatòria', def: 0 },
  opacityProb:   { label: 'Probabilitat', def: 0 },
  opacityEvery:  { label: 'Freqüència', def: 0 },
  blinkRate:     { label: 'Velocitat', def: 0 },
  blinkFade:     { label: 'Dissolència', def: 0 },
  blinkProb:     { label: 'Probabilitat', def: 0 },
  blinkEvery:    { label: 'Freqüència', def: 0 },
  sizeAmt:       { label: 'Quantitat', def: 0 },
  sizeProb:      { label: 'Probabilitat', def: 0 },
  sizeEvery:     { label: 'Freqüència', def: 0 },
  accentProb:    { label: 'Probabilitat 1', def: 0 },
  accentEvery:   { label: 'Freqüència 1', def: 0 },
  accentProb2:   { label: 'Probabilitat 2', def: 0 },
  accentEvery2:  { label: 'Freqüència 2', def: 0 },
  accentProb3:   { label: 'Probabilitat 3', def: 0 },
  accentEvery3:  { label: 'Freqüència 3', def: 0 },
  accentProb4:   { label: 'Probabilitat 4', def: 0 },
  accentEvery4:  { label: 'Freqüència 4', def: 0 },
  scatter:       { label: 'Dispersió', def: 0 },
  rotXSpeed:     { label: 'Rotació X', def: 0 },
  rotYSpeed:     { label: 'Rotació Y', def: 0 },
  rotZSpeed:     { label: 'Rotació Z', def: 0 },
  angleX:        { label: 'Angle X', def: 0 },
  angleY:        { label: 'Angle Y', def: 0 },
  depthFade:     { label: 'Esvaïment per profunditat', def: 0 },
  pulse:         { label: 'Pols', def: 0 },
  pulseSpeed:    { label: 'Velocitat del pols', def: 0 },
  rainProb:      { label: 'Probabilitat de pluja', def: 0 },
  rainSpeed:     { label: 'Velocitat de pluja', def: 0 },
  noiseTexture:  { label: 'Buits de textura', def: 0 },
  morphT:        { label: 'Blend', def: 0 },
  morphSpeed:    { label: 'Velocitat morph', def: 0 },
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
  text: '',
  font: 'courier-regular',
  textColor: '#111111',
  bgColor: '#f4f4f4',
  guideColor: '#111111',
  guideMetaColor: '#111111',
  surfaceColor: '#d8d8d8',
  surfaceOcclusion: true,
  seed: 1,
  hardWrap: false,
  mode: '3d',
  // --- 3D selects + checkboxes (sliders come from SLIDERS defaults below) ---
  form: 'mobius',
  projection: 'isometric',
  guides: false,
  guideLayer: 'back',
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
  selectedDirectorSceneId: 'scene-1',
  selectedDirectorKeyframe: null,
  // Custom 3D outline data.
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
       'morphScatter', 'morphSpeedVar', 'surfaceTransparency'].includes(key)) {
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

function resetFormViewDefaults() {
  state.formSize = SLIDERS.formSize.def;
  state.zoom = SLIDERS.zoom.def;
  syncSliderUI('formSize');
  syncSliderUI('zoom');
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

function syncCameraToggleUI() {
  document.querySelectorAll('.slider[data-cam-toggle]').forEach((host) => {
    const key = host.dataset.key;
    const enabled = state.cameraEnabled[key] !== false;
    const toggleBtn = host.querySelector('.cam-toggle-btn');
    if (toggleBtn) {
      toggleBtn.textContent = enabled ? '[·]' : '[ ]';
      toggleBtn.setAttribute('aria-pressed', String(enabled));
    }
    host.classList.toggle('cam-disabled', !enabled);
  });
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
  const resolved = evaluateDirector(state.director, atTime, state);
  const animationSpeed = Number(resolved.params.speed3d ?? state.speed3d);
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
  drawResolvedState(renderState);
  directorUI?.setTime(atTime, renderState.activeDirectorSceneId);
  if (state.director.enabled && renderState.activeDirectorSceneId !== lastAnnouncedDirectorSceneId) {
    lastAnnouncedDirectorSceneId = renderState.activeDirectorSceneId;
    const active = state.director.scenes.find((item) => item.id === renderState.activeDirectorSceneId);
    if (active) announce(`Escena ${active.name}`);
  }
}

function drawResolvedState(renderState) {
  ensureCanvas();
  const scene = buildScene(renderState, displayW, displayH);
  drawScene(displayCtx, scene, displayW, displayH, displayDpr);
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
    const speed = state.speed3d;
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

const OUTLINE_LEN = 96; // resampled outline point count
const OUTLINE_KEY = 'shaper-custom-outline';

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
function persistOutline() {
  try { localStorage.setItem(OUTLINE_KEY, JSON.stringify(state.customOutline)); } catch (e) {}
}
function restoreCustomData() {
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
  const su3d = $('svgUpload3d');
  if (su3d) su3d.hidden = state.form !== 'custom-prism';
  const guideMetaRow = $('guideMetaRow');
  if (guideMetaRow) guideMetaRow.hidden = !state.guides;
  const guideLayerRow = $('guideLayerRow');
  if (guideLayerRow) guideLayerRow.hidden = !state.guides;

  const form = state.form;
  const visibleFormControls = new Set(FORM_3D_CONTROLS[form] || FORM_3D_CONTROLS.plane);
  for (const key of ['formSize', 'aspect', 'facets', 'turns', 'count', 'scatter']) {
    const el = document.querySelector(`.slider[data-key="${key}"]`);
    if (el) el.hidden = !visibleFormControls.has(key);
  }

  // FOV: only relevant for perspective projection.
  const fovRow = document.querySelector('.slider[data-key="fov"]');
  if (fovRow) fovRow.hidden = state.projection !== 'perspective';
}

// --- SVG shape import ---
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

  if (panelId === 'panel-3d' && state.mode !== '3d') {
    state.mode = '3d';
    announce('Mode 3D activat');
    scheduleRender();
  }

  const directorOpen = panelId === 'panel-director';
  document.body.toggleAttribute('data-director-panel-active', directorOpen);
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

  $('textColor').addEventListener('input', (e) => {
    state.textColor = e.target.value;
    scheduleRender();
  });
  $('bgColor').addEventListener('input', (e) => {
    state.bgColor = e.target.value;
    scheduleRender();
  });
  $('guideColor').addEventListener('input', (e) => {
    state.guideColor = e.target.value;
    scheduleRender();
  });
  $('guideMetaColor').addEventListener('input', (e) => {
    state.guideMetaColor = e.target.value;
    scheduleRender();
  });
  $('surfaceColor').addEventListener('input', (e) => {
    state.surfaceColor = e.target.value;
    scheduleRender();
  });
  $('surfaceOcclusion').addEventListener('change', (e) => {
    state.surfaceOcclusion = e.target.checked;
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

  // --- 3D selects + checkboxes ---
  $('form').addEventListener('change', (e) => {
    state.form = e.target.value;
    resetFormViewDefaults();
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
    updateEditorVisibility();
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
  $('guideLayer').addEventListener('change', (e) => {
    state.guideLayer = e.target.value === 'front' ? 'front' : 'back';
    scheduleRender();
  });
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
  const el = document.getElementById('shaper-status');
  if (el) el.textContent = msg;
}

function saveSVG() {
  const width = Math.max(1, Math.round(state.canvasW));
  const height = Math.max(1, Math.round(state.canvasH));
  const exportState = resolveRenderState(state.directorTime);
  const svg = buildSVG(exportState, width, height);
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
  const exportState = resolveRenderState(state.directorTime);
  const scene = buildScene(exportState, w, h);
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

function encodeCurrentCanvas(frameIndex, fps) {
  const ts = Math.round(frameIndex * (1_000_000 / fps));
  const videoFrame = new VideoFrame(displayCanvas, { timestamp: ts });
  recState.videoEncoder.encode(videoFrame, { keyFrame: frameIndex % (fps * 2) === 0 });
  videoFrame.close();
}

function captureFrame() {
  if (!recState.isRecording || !recState.videoEncoder || !displayCanvas) return;
  const fps = getRecordFps();
  encodeCurrentCanvas(recState.frameN, fps);
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

    if (state.director.enabled) {
      const duration = totalDuration(state.director);
      const wasPlaying = playing;
      pause();
      try {
        await encodeDirectorFrames({
          duration, fps,
          renderAt: (time) => render(time),
          encodeCanvas: (index, exportFps) => encodeCurrentCanvas(index, exportFps),
          onProgress: (done, total) => setExportStatus(`Exportant Director… ${done}/${total}`),
        });
        await stopRecord();
      } finally {
        state.directorTime = 0;
        render(0);
        if (wasPlaying) play();
      }
      return;
    }

    if (!Number.isNaN(dur)) {
      const wasPlaying = playing;
      const baseExportState = {
        ...state,
        cameraEnabled: { ...state.cameraEnabled },
        customOutline: state.customOutline.slice(),
      };
      pause();
      try {
        await encodeDirectorFrames({
          duration: dur, fps,
          renderAt: (time) => drawResolvedState(resolveOfflineAnimationState(baseExportState, time, fps)),
          encodeCanvas: (index, exportFps) => encodeCurrentCanvas(index, exportFps),
          onProgress: (done, total) => setExportStatus(`Exportant MP4… ${done}/${total}`),
        });
        await stopRecord();
      } finally {
        render();
        if (wasPlaying) play();
      }
      return;
    }

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

function capturePreset() {
  return captureCreativePreset(state, Object.keys(SLIDERS));
}

function applyPreset(p) {
  if (!p || p.v !== 1) return;
  state.director = normalizeDirector(p.director);
  state.directorTime = 0;
  state.selectedDirectorSceneId = state.director.scenes[0].id;
  state.selectedDirectorKeyframe = null;
  if (state.director.unsupportedVersion) {
    setPresetStatus('Aquest preset usa una versió més nova del Director; es carrega la composició base amb Director desactivat.');
  }
  Object.keys(SLIDERS).forEach((k) => {
    if (p[k] != null) { state[k] = p[k]; syncSliderUI(k); }
  });
  if (p.text    != null) { state.text    = p.text;    $('text').value    = p.text; }
  if (p.font    != null) { state.font    = p.font;    $('font').value    = p.font; }
  if (p.textColor != null) { state.textColor = p.textColor; $('textColor').value = p.textColor; }
  if (p.bgColor   != null) { state.bgColor   = p.bgColor;   $('bgColor').value   = p.bgColor; }
  if (p.guideColor != null) { state.guideColor = p.guideColor; $('guideColor').value = p.guideColor; }
  if (p.guideMetaColor != null) { state.guideMetaColor = p.guideMetaColor; $('guideMetaColor').value = p.guideMetaColor; }
  if (p.surfaceColor != null) { state.surfaceColor = p.surfaceColor; $('surfaceColor').value = p.surfaceColor; }
  if (p.surfaceOcclusion != null) { state.surfaceOcclusion = p.surfaceOcclusion; $('surfaceOcclusion').checked = p.surfaceOcclusion; }
  if (p.seed != null && Number.isFinite(Number(p.seed))) { state.seed = Number(p.seed); }
  if (p.cameraEnabled && typeof p.cameraEnabled === 'object') {
    state.cameraEnabled = { ...state.cameraEnabled, ...p.cameraEnabled };
    syncCameraToggleUI();
  }
  if (Array.isArray(p.customOutline) && p.customOutline.length >= 6) {
    state.customOutline = p.customOutline.slice();
    persistOutline();
  }
  if (p.hardWrap  != null) { state.hardWrap  = p.hardWrap;  $('hardWrap').checked  = p.hardWrap; }
  if (p.speed3d != null) { state.speed3d = p.speed3d; syncSliderUI('speed3d'); }
  if (p.mode != null) {
    state.mode = '3d';
    activatePanel('panel-3d');
    updateEditorVisibility();
  }
  if (p.form       != null) { state.form       = p.form;       $('form').value       = p.form;       updateEditorVisibility(); }
  if (p.projection != null) { state.projection = p.projection; $('projection').value = p.projection; updateFovEnabled(); updateEditorVisibility(); }
  if (p.guides          != null) { state.guides          = p.guides;          $('guides').checked          = p.guides; }
  if (p.guideMeta       != null) { state.guideMeta       = p.guideMeta;       const el=$('guideMeta');      if(el) el.checked = p.guideMeta; }
  if (p.guideLayer      != null) { state.guideLayer      = p.guideLayer === 'front' ? 'front' : 'back'; $('guideLayer').value = state.guideLayer; }
  if (p.backfaceMirror  != null) { state.backfaceMirror  = p.backfaceMirror;  $('backfaceMirror').checked  = p.backfaceMirror; }
  if (p.surfaceText     != null) { state.surfaceText      = p.surfaceText;     $('surfaceText').checked     = p.surfaceText; }
  if (p.vNorm           != null) { state.vNorm           = p.vNorm; }
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
  directorUI?.render();
  updateAutomationButtonStates();
}

// --- Preset panel ---
const shaperPresetPanel = createPresetPanel({
  container:     document.getElementById('shaperPresetContainer'),
  id:            'shaper',
  store:         _ghStore,
  builtins:      [],
  capturePreset,
  applyPreset,
  localKey:      'shaper-presets-v1',
  setStatus:     setPresetStatus,
});

// --- Director scene editing helpers ---
function replaceDirectorScene(nextScene) {
  state.director = { ...state.director, scenes: state.director.scenes.map((scene) => scene.id === nextScene.id ? nextScene : scene) };
  if (state.selectedDirectorKeyframe?.sceneId === nextScene.id) {
    const frames = nextScene.automations?.[state.selectedDirectorKeyframe.path] || [];
    const exists = frames.some((frame) => Math.abs(frame.time - state.selectedDirectorKeyframe.time) <= 0.0001);
    if (!exists) state.selectedDirectorKeyframe = null;
  }
  directorUI.render(); scheduleRender();
  updateAutomationButtonStates();
}
function selectedDirectorScene() {
  return state.director.scenes.find((scene) => scene.id === state.selectedDirectorSceneId) || state.director.scenes[0];
}
function handleDirectorSceneAction(action) {
  const result = applySceneAction(state.director, state.selectedDirectorSceneId, action);
  state.director = result.director;
  state.selectedDirectorSceneId = result.selectedSceneId;
  state.selectedDirectorKeyframe = null;
  directorUI.render(); scheduleRender();
}
function updateSelectedSceneDuration(duration) { replaceDirectorScene(normalizeScene({ ...selectedDirectorScene(), duration })); }
function updateSelectedTransition(patch) { const s = selectedDirectorScene(); replaceDirectorScene(normalizeScene({ ...s, transition: { ...s.transition, ...patch } })); }
function updateSelectedSceneMovement(type) { replaceDirectorScene(setSceneMovement(selectedDirectorScene(), type)); }
function updateSelectedBehavior(id, patch) { replaceDirectorScene(updateBehavior(selectedDirectorScene(), id, patch)); }
function updateSelectedKeyframe(path, time, patch) {
  const scene = selectedDirectorScene();
  const frames = scene?.automations?.[path] || [];
  const current = frames.find((frame) => Math.abs(frame.time - time) <= 0.0001);
  if (!current) return;
  const nextTime = Number.isFinite(Number(patch.time)) ? Number(patch.time) : current.time;
  const nextValue = Object.prototype.hasOwnProperty.call(patch, 'value') ? patch.value : current.value;
  const nextEasing = patch.easing ?? current.easing ?? 'linear';
  let nextScene = removeKeyframe(scene, path, time);
  nextScene = upsertKeyframe(nextScene, path, { time: nextTime, value: nextValue, easing: nextEasing });
  state.selectedDirectorKeyframe = { sceneId: scene.id, path, time: Math.max(0, Math.min(scene.duration, nextTime)) };
  replaceDirectorScene(nextScene);
}

function updateAutomationButtonStates() {
  document.body.toggleAttribute('data-director-enabled', !!state.director?.enabled);
  if (!state.director?.enabled) return;
  const scene = selectedDirectorScene();
  const { localTime } = evaluateDirector(state.director, state.directorTime, state);
  for (const name of Object.keys(AUTOMATION_CONTROL_IDS)) {
    const btn = document.querySelector(`[data-automation-path="${name}"]`);
    if (!btn) continue;
    const frames = scene?.automations?.[`param:${name}`] || [];
    btn.setAttribute('aria-pressed', String(frames.some((f) => Math.abs(f.time - localTime) <= 0.0001)));
  }
}

function installAutomationButtons() {
  for (const [name, id] of Object.entries(AUTOMATION_CONTROL_IDS)) {
    const control = $(id);
    if (!control || document.querySelector(`[data-automation-path="${name}"]`)) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'automation-key-button';
    button.dataset.automationPath = name;
    button.setAttribute('aria-label', `Keyframe a ${name}`);
    button.setAttribute('aria-pressed', 'false');
    const glyph = document.createElement('span');
    glyph.setAttribute('aria-hidden', 'true');
    button.appendChild(glyph);
    control.insertAdjacentElement('afterend', button);
    button.addEventListener('click', () => {
      const { localTime } = evaluateDirector(state.director, state.directorTime, state);
      const scene = selectedDirectorScene();
      const path = `param:${name}`;
      const frames = scene?.automations?.[path] || [];
      const has = frames.some((f) => Math.abs(f.time - localTime) <= 0.0001);
      if (has) {
        replaceDirectorScene(removeKeyframe(scene, path, localTime));
      } else {
        const kind = AUTOMATABLE_PARAMS[name];
        const value = kind === 'number' ? Number(control.value) : control.value;
        replaceDirectorScene(upsertKeyframe(scene, path, { time: localTime, value, easing: kind === 'hold' ? 'hold' : 'linear' }));
      }
    });
  }
}

// --- Director wiring ---
function wireDirector() {
  directorUI = mountDirectorUI({
    inspector: $('directorInspector'),
    timeline: $('directorTimeline'),
    getState: () => state,
    onSelectScene: (id) => { state.selectedDirectorSceneId = id; state.selectedDirectorKeyframe = null; directorUI.render(); },
    onSeek: (time) => { state.directorTime = time; render(time); directorUI.render(); updateAutomationButtonStates(); },
    onToggleEnabled: (enabled) => { state.director = { ...state.director, enabled }; scheduleRender(); directorUI.render(); updateAutomationButtonStates(); },
    onSceneAction: handleDirectorSceneAction,
    onSceneDuration: updateSelectedSceneDuration,
    onSceneMovement: updateSelectedSceneMovement,
    onTransitionChange: updateSelectedTransition,
    onUpdateBehavior: updateSelectedBehavior,
    onSelectKeyframe: (path, time) => {
      state.selectedDirectorKeyframe = { sceneId: state.selectedDirectorSceneId, path, time };
      directorUI.render();
    },
    onUpdateKeyframe: updateSelectedKeyframe,
    onRemoveKeyframe: (path, time) => {
      if (state.selectedDirectorKeyframe
        && state.selectedDirectorKeyframe.path === path
        && Math.abs(state.selectedDirectorKeyframe.time - time) <= 0.0001) {
        state.selectedDirectorKeyframe = null;
      }
      replaceDirectorScene(removeKeyframe(selectedDirectorScene(), path, time));
    },
    onToggleKeyframe: (path, _field) => {
      const { localTime } = evaluateDirector(state.director, state.directorTime, state);
      const scene = selectedDirectorScene();
      const frames = scene?.automations?.[path] || [];
      const has = frames.some((f) => Math.abs(f.time - localTime) <= 0.0001);
      if (has) {
        if (state.selectedDirectorKeyframe
          && state.selectedDirectorKeyframe.path === path
          && Math.abs(state.selectedDirectorKeyframe.time - localTime) <= 0.0001) {
          state.selectedDirectorKeyframe = null;
        }
        replaceDirectorScene(removeKeyframe(scene, path, localTime));
        return;
      }
      let value = 0;
      let kind = 'number';
      if (path.startsWith('param:')) {
        const name = path.slice(6);
        kind = AUTOMATABLE_PARAMS[name] || 'number';
        value = state[name] !== undefined ? state[name] : 0;
      } else if (path.startsWith('behavior:')) {
        const [, id, field] = path.split(':');
        const behavior = scene.behaviors.find((b) => b.id === id);
        if (behavior) {
          value = Number.isFinite(behavior.params?.[field]) ? behavior.params[field]
            : (Number.isFinite(behavior[field]) ? behavior[field] : 0);
        }
      }
      state.selectedDirectorKeyframe = { sceneId: scene.id, path, time: localTime };
      replaceDirectorScene(upsertKeyframe(scene, path, { time: localTime, value, easing: kind === 'hold' ? 'hold' : 'linear' }));
    },
  });

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
  updateAutomationButtonStates();
  bindNavigation();
  wireControls();
  shaperPresetPanel.activate();
  wireDirector();
  // Sync select / checkbox UI to state defaults
  $('text').value = state.text;
  $('font').value = state.font;
  $('form').value = state.form;
  $('projection').value = state.projection;
  $('surfaceColor').value = state.surfaceColor;
  $('guideColor').value = state.guideColor;
  $('guideMetaColor').value = state.guideMetaColor;
  $('surfaceOcclusion').checked = state.surfaceOcclusion;
  $('guides').checked = state.guides;
  $('guideLayer').value = state.guideLayer;
  $('backfaceMirror').checked = state.backfaceMirror;
  $('surfaceText').checked = state.surfaceText;

  $('wrapMode').value = state.wrapMode;
  syncCameraToggleUI();
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
