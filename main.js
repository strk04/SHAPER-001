// main.js — UI wiring for SHAPER 001
import { buildSVG, buildScene, drawScene, DEFAULT_CUSTOM_PROFILE, DEFAULT_CUSTOM_OUTLINE } from './engine.js';

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
  charOpacity: { label: 'Opacitat aleatòria', def: 0 },
  charSkew: { label: 'Inclinació aleatòria', def: 0 },
  sizeRamp: { label: 'Rampa de mida', def: 0 },
  // --- Màscara ---
  maskRadius: { label: 'Mida de la màscara', def: 0.75 },
  // --- Color gradient ---
  colorRamp: { label: 'Gradient de color', def: 0 },
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
  paramSpeed: { label: 'Easing paramètric', def: 0 },
  surfaceEase: { label: 'Inèrcia de superfície', def: 1 },
  noiseTexture: { label: 'Buits de textura', def: 0 },
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
  'monkey-saddle': ['formSize', 'aspect'],
  shell:           ['formSize', 'turns'],
  catenoid:        ['formSize', 'aspect'],
  superquadric:    ['formSize', 'aspect', 'facets'],
  dini:            ['formSize', 'aspect', 'turns'],
  trifolium:       ['formSize', 'aspect'],
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
  maskShape: 'none',
  colorRampTo: '#111111',
  fps: 0,
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
       'charOpacity', 'charSkew', 'sizeRamp', 'densityMap', 'colorRamp', 'maskRadius'].includes(key)) {
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

function render() {
  ensureCanvas();
  const scene = buildScene(state, displayW, displayH);
  drawScene(displayCtx, scene, displayW, displayH, displayDpr);
}

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
  const psEl = document.querySelector('.slider[data-key="paramSpeed"]');
  if (psEl) psEl.hidden = state.wrapMode !== 'rings' && state.wrapMode !== 'spiral';
  const seEl = document.querySelector('.slider[data-key="surfaceEase"]');
  if (seEl) seEl.hidden = state.wrapMode !== 'rings' && state.wrapMode !== 'spiral';
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

  const maskShapeEl = $('maskShape');
  if (maskShapeEl) {
    maskShapeEl.addEventListener('change', (e) => {
      state.maskShape = e.target.value;
      scheduleRender();
    });
  }
  const colorRampToEl = $('colorRampTo');
  if (colorRampToEl) {
    colorRampToEl.addEventListener('input', (e) => {
      state.colorRampTo = e.target.value;
      scheduleRender();
    });
  }

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
   'maskShape', 'colorRampTo'].forEach((k) => {
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
  if (p.maskShape != null) {
    state.maskShape = p.maskShape;
    const el = $('maskShape');
    if (el) el.value = p.maskShape;
  }
  if (p.colorRampTo != null) {
    state.colorRampTo = p.colorRampTo;
    const el = $('colorRampTo');
    if (el) el.value = p.colorRampTo;
  }
  scheduleRender();
}

function renderPresetList() {
  const list = $('presetList');
  if (!list) return;
  const presets = loadPresets();
  if (!presets.length) {
    list.innerHTML = `<li style="color:var(--ink-4);font-size:var(--text-xs);padding:var(--space-1) 0">Cap preset desat.</li>`;
    return;
  }
  list.innerHTML = presets.map((p, i) => `
    <li class="preset-item">
      <span class="preset-name">${esc(p.name)}</span>
      <button class="preset-btn preset-load" data-idx="${i}" type="button" aria-label="Carrega el preset ${esc(p.name)}">Load</button>
      <button class="preset-btn preset-delete" data-idx="${i}" type="button" aria-label="Elimina el preset ${esc(p.name)}">✕</button>
    </li>`).join('');
}

function wirePresets() {
  $('savePreset')?.addEventListener('click', () => {
    const nameEl = $('presetName');
    const name = (nameEl?.value ?? '').trim() || `Preset ${new Date().toLocaleTimeString()}`;
    const presets = loadPresets();
    presets.unshift({ name, data: capturePreset() });
    if (presets.length > 20) presets.length = 20;
    savePresets(presets);
    if (nameEl) nameEl.value = '';
    renderPresetList();
    setExportStatus(`Desat: "${name}"`);
  });

  $('presetList')?.addEventListener('click', (e) => {
    const loadBtn = e.target.closest('.preset-load');
    const delBtn  = e.target.closest('.preset-delete');
    if (loadBtn) {
      const idx = parseInt(loadBtn.dataset.idx);
      const presets = loadPresets();
      if (presets[idx]) { applyPreset(presets[idx].data); setExportStatus(`Carregat: "${presets[idx].name}"`); }
    }
    if (delBtn) {
      if (delBtn.dataset.confirming === '1') {
        clearTimeout(Number(delBtn.dataset.timer));
        const idx = parseInt(delBtn.dataset.idx);
        const presets = loadPresets();
        const name = presets[idx]?.name ?? '';
        presets.splice(idx, 1);
        savePresets(presets);
        renderPresetList();
        setExportStatus(`Eliminat: "${name}"`);
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

  $('exportPresets')?.addEventListener('click', () => {
    const presets = loadPresets();
    if (!presets.length) { setExportStatus('Cap preset a exportar.'); return; }
    const blob = new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `shaper-presets-${Date.now()}.json`,
    });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setExportStatus(`Exportats ${presets.length} preset${presets.length !== 1 ? 's' : ''}.`);
  });

  $('importPresetsBtn')?.addEventListener('click', () => { $('importPresets')?.click(); });

  $('importPresets')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!Array.isArray(imported)) throw new Error('format invàlid');
        const merged = [...imported, ...loadPresets()].slice(0, 20);
        savePresets(merged);
        renderPresetList();
        setExportStatus(`Importats ${imported.length} preset${imported.length !== 1 ? 's' : ''}.`);
      } catch { setExportStatus('Importació fallida — fitxer no vàlid.'); }
      e.target.value = '';
    };
    reader.readAsText(file);
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
  bindNavigation();
  wireControls();
  wirePresets();
  renderPresetList();
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
  updatePlayPauseUI();
  updateArtworkLabel();
  render();

  // prefers-reduced-motion: load PAUSED with a static frame. Explicit Play
  // is still allowed (button never disabled/hidden). If the user enables
  // reduce mid-session, pause immediately.
  const rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!rmq.matches) play();
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
