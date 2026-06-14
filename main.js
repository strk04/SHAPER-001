// main.js — UI wiring for SHAPER 001
import { buildSVG, buildScene, drawScene, DEFAULT_CUSTOM_PROFILE, DEFAULT_CUSTOM_OUTLINE } from './engine.js';

// Slider definitions: key -> { label, default }
const SLIDERS = {
  fontSize: { label: 'Cos', def: 16 },
  amplitude: { label: 'Amplitud', def: 0 },
  frequency: { label: 'Freqüència', def: 0.001 },
  charTrack: { label: 'Kerning', def: 0 },
  leading: { label: 'Interlínia', def: 72 },
  noiseAmt: { label: 'Soroll horitzontal', def: 0 },
  rainSpeed2d: { label: 'Velocitat de moviment', def: 1 },
  wordTrack: { label: 'Espai entre paraules', def: 0 },
  wordChaos: { label: 'Variació de paraules', def: 0 },
  wordRamp: { label: 'Progressió de paraules', def: 0 },
  charChaos: { label: 'Desordre de lletres', def: 0 },
  yJitter: { label: 'Tremolor vertical', def: 0 },
  yJitterAffect: { label: 'Abast del tremolor', def: 0 },
  dropProb: { label: 'Amagar caràcters', def: 0 },
  wordsPerRow: { label: 'Paraules per línia', def: 4 },
  // --- 3D: Form ---
  formSize: { label: 'Mida de forma', def: 400 },
  aspect: { label: 'Proporció', def: 1 },
  facets: { label: 'Cares', def: 4 },
  turns: { label: 'Voltes', def: 3 },
  count: { label: 'Quantitat', def: 3 },
  scatter: { label: 'Dispersió', def: 0 },
  // --- 3D: Camera ---
  fov: { label: 'Camp visual', def: 60 },
  zoom: { label: 'Zoom', def: 1 },
  rotXSpeed: { label: 'Rotació X', def: 0 },
  rotYSpeed: { label: 'Rotació Y', def: 0 },
  rotZSpeed: { label: 'Rotació Z', def: 0 },
  angleX: { label: 'Angle X', def: 0 },
  angleY: { label: 'Angle Y', def: 0 },
  depthFade: { label: 'Esvaïment per profunditat', def: 0 },
  // --- 3D: Motion ---
  pulse: { label: 'Pols', def: 0 },
  pulseSpeed: { label: 'Velocitat del pols', def: 0 },
  rainProb: { label: 'Probabilitat de pluja', def: 0 },
  rainSpeed: { label: 'Velocitat de pluja', def: 0 },
};

const FORM_3D_CONTROLS = {
  plane: ['formSize', 'aspect'],
  cylinder: ['formSize', 'aspect'],
  helix: ['formSize', 'aspect', 'turns'],
  sphere: ['formSize'],
  cube: ['formSize'],
  cluster: ['formSize', 'count', 'scatter'],
  'star-prism': ['formSize', 'aspect', 'facets'],
  'custom-prism': ['formSize', 'aspect'],
};

const $ = (id) => document.getElementById(id);

const state = {
  text: 'Ritme compartit. Flux individual.',
  font: 'courier-regular',
  shape: 'rectangle',
  textColor: '#111111',
  bgColor: '#f4f4f4',
  seed: 1,
  hardWrap: false,
  motion2d: 'flow',
  mode: '2d', // '2d' | '3d'
  // --- 3D selects + checkboxes (sliders come from SLIDERS defaults below) ---
  form: 'plane',
  projection: 'isometric',
  guides: false,
  backfaceMirror: false,
  surfaceText: true,
  t: 0, // animation time (seconds)
  speed: 1, // animation speed multiplier (0..2)
  canvasW: 1080,
  canvasH: 1350,
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
  if (['dropProb', 'yJitterAffect', 'depthFade', 'pulse', 'rainProb', 'wordRamp'].includes(key)) {
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
    state.t += dt * state.speed;
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

// --- Mode switch ---
function updateModeUI() {
  const c2d = $('section-2d-content');
  const c3d = $('section-3d-content');
  if (state.mode === '2d') {
    if (c2d) c2d.hidden = false;
    if (c3d) c3d.hidden = true;
  } else {
    if (c2d) c2d.hidden = true;
    if (c3d) c3d.hidden = false;
  }
  const r2d = $('mode2d');
  const r3d = $('mode3d');
  if (r2d) r2d.checked = state.mode === '2d';
  if (r3d) r3d.checked = state.mode === '3d';
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

  // Mode radios
  document.querySelectorAll('input[name="mode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        state.mode = radio.value;
        updateModeUI();
        scheduleRender();
      }
    });
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

  const speedRange = $('rng-speed');
  const speedOutput = $('out-speed');
  const syncSpeedOutput = () => {
    speedOutput.textContent = formatSliderValue('speed', state.speed);
    speedRange.setAttribute('aria-valuetext', speedOutput.textContent);
  };

  speedRange.addEventListener('input', () => {
    state.speed = +speedRange.value;
    syncSpeedOutput();
    if (!playing) scheduleRender();
  });

  syncSpeedOutput();

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
  if (!recState.videoEncoder) return;
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

// --- Init ---
function init() {
  restoreCustomData();
  buildSliders();
  bindNavigation();
  wireControls();
  // Sync select / checkbox UI to state defaults
  $('text').value = state.text;
  $('font').value = state.font;
  $('motion2d').value = state.motion2d;
  $('form').value = state.form;
  $('projection').value = state.projection;
  $('guides').checked = state.guides;
  $('backfaceMirror').checked = state.backfaceMirror;
  $('surfaceText').checked = state.surfaceText;
  updateFovEnabled();
  updateModeUI();
  updateEditorVisibility();
  $('rng-speed').value = state.speed;
  $('out-speed').textContent = formatSliderValue('speed', state.speed);
  updatePlayPauseUI();
  updateArtworkLabel();
  render();

  // prefers-reduced-motion: load PAUSED with a static frame. Explicit Play
  // is still allowed (button never disabled/hidden). If the user enables
  // reduce mid-session, pause immediately.
  const rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
  // (Already paused on load — nothing to do for the initial reduced state.)
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
