// main.js — UI wiring for SHAPER 001
import { buildSVG, buildScene, drawScene, DEFAULT_CUSTOM_PROFILE, DEFAULT_CUSTOM_OUTLINE } from './engine.js';

// Slider definitions: key -> { label, default }
const SLIDERS = {
  fontSize: { label: 'Cos', def: 16 },
  amplitude: { label: 'Amplitud', def: 0 },
  frequency: { label: 'Freqüència', def: 0.001 },
  charTrack: { label: ‘Kerning’, def: 0 },
  leading: { label: 'Interlínia', def: 72 },
  noiseAmt: { label: 'Soroll horitzontal', def: 0 },
  rainSpeed2d: { label: 'Velocitat de pluja', def: 1 },
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

const $ = (id) => document.getElementById(id);

const state = {
  text: 'Shared rhythm. Individual flow.',
  font: 'courier-regular',
  shape: 'rectangle',
  textColor: '#111111',
  bgColor: '#f4f4f4',
  seed: 1,
  hardWrap: false,
  motion2d: 'rain',
  mode: '2d', // '2d' | '3d'
  // --- 3D selects + checkboxes (sliders come from SLIDERS defaults below) ---
  form: 'plane',
  projection: 'isometric',
  guides: false,
  backfaceMirror: false,
  surfaceText: false,
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

function buildSliders() {
  document.querySelectorAll('.slider').forEach((host) => {
    const key = host.dataset.key;
    const meta = SLIDERS[key];
    if (!meta) return; // skip non-parameter sliders (e.g. the Speed row, wired separately)
    const min = host.dataset.min;
    const max = host.dataset.max;
    const step = host.dataset.step;

    host.classList.add('slider-row');
    const labelId = `lbl-${key}`;
    const rangeId = `rng-${key}`;

    const label = document.createElement('label');
    label.id = labelId;
    label.setAttribute('for', rangeId);
    label.textContent = meta.label;

    const range = document.createElement('input');
    range.type = 'range';
    range.id = rangeId;
    range.min = min;
    range.max = max;
    range.step = step;
    range.value = state[key];

    const number = document.createElement('input');
    number.type = 'number';
    number.min = min;
    number.max = max;
    number.step = step;
    number.value = state[key];
    number.setAttribute('aria-labelledby', labelId);

    host.append(label, range, number);
    sliderRefs[key] = { range, number, min: +min, max: +max };

    // Range: sync on input (live)
    range.addEventListener('input', () => {
      state[key] = +range.value;
      number.value = range.value;
      scheduleRender();
    });

    // Number: sync live on input, clamp on change
    number.addEventListener('input', () => {
      const v = number.value;
      if (v === '' || isNaN(+v)) return;
      state[key] = +v;
      range.value = v;
      scheduleRender();
    });
    number.addEventListener('change', () => {
      let v = +number.value;
      if (isNaN(v)) v = meta.def;
      v = Math.min(sliderRefs[key].max, Math.max(sliderRefs[key].min, v));
      number.value = v;
      range.value = v;
      state[key] = v;
      scheduleRender();
    });
  });
}

function syncSliderUI(key) {
  const ref = sliderRefs[key];
  if (!ref) return;
  ref.range.value = state[key];
  ref.number.value = state[key];
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
  if (status) status.textContent = `Canvas: ${w} × ${h} px`;
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
    const dt = (ts - lastTs) / 1000; // seconds since last frame
    state.t += dt * state.speed;
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
    playing ? `${base}, animating` : `${base}, animation paused`,
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
  const showFacets = ['cylinder', 'helix', 'star-prism', 'custom-prism'].includes(form);
  for (const [key, show] of [
    ['facets',  showFacets],
    ['turns',   form === 'helix'],
    ['count',   form === 'cluster'],
    ['scatter', form === 'cluster'],
  ]) {
    const el = document.querySelector(`.slider[data-key="${key}"]`);
    if (el) el.hidden = !show;
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

// Announce via #recordStatus role="status".
function announce(msg) {
  const el = $('recordStatus');
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
function wireTabs() {
  const tablist = document.querySelector('[role="tablist"]');
  if (!tablist) return;
  const STORAGE_KEY = 'shaper-active-tab';

  function activateTab(tab) {
    tablist.querySelectorAll('[role="tab"]').forEach((t) => {
      t.setAttribute('aria-selected', 'false');
      t.setAttribute('tabindex', '-1');
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = true;
    });
    tab.setAttribute('aria-selected', 'true');
    tab.setAttribute('tabindex', '0');
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    if (panel) panel.hidden = false;
    try { sessionStorage.setItem(STORAGE_KEY, tab.id); } catch (e) {}
  }

  tablist.addEventListener('keydown', (e) => {
    const tabs = [...tablist.querySelectorAll('[role="tab"]:not([aria-disabled="true"])')];
    const idx = tabs.indexOf(document.activeElement);
    let next = -1;
    if (e.key === 'ArrowDown')  next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowUp') next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home')  next = 0;
    else if (e.key === 'End')   next = tabs.length - 1;
    else return;
    e.preventDefault();
    tabs[next].focus();
    activateTab(tabs[next]);
  });

  tablist.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (!tab || tab.getAttribute('aria-disabled') === 'true') return;
    activateTab(tab);
    tab.focus();
  });

  const saved = sessionStorage.getItem(STORAGE_KEY);
  const savedTab = saved ? document.getElementById(saved) : null;
  const first = tablist.querySelector('[role="tab"]:not([aria-disabled="true"])');
  activateTab((savedTab && savedTab.getAttribute('aria-disabled') !== 'true') ? savedTab : first);
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
  $('savePng').addEventListener('click', savePNG);

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

  // Speed slider pair (same pattern as the other sliders).
  // Speed 0 is visually static but must NOT flip Play/Pause state.
  const speedRange = $('rng-speed');
  const speedNumber = $('num-speed');

  speedRange.addEventListener('input', () => {
    state.speed = +speedRange.value;
    speedNumber.value = speedRange.value;
    if (!playing) scheduleRender();
  });
  speedNumber.addEventListener('input', () => {
    const v = speedNumber.value;
    if (v === '' || isNaN(+v)) return;
    state.speed = +v;
    speedRange.value = v;
    if (!playing) scheduleRender();
  });
  speedNumber.addEventListener('change', () => {
    let v = +speedNumber.value;
    if (isNaN(v)) v = 1;
    v = Math.min(2, Math.max(0, v));
    speedNumber.value = v;
    speedRange.value = v;
    state.speed = v;
    if (!playing) scheduleRender();
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
  ref.number.disabled = disabled;
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

// --- Video recording ---
// Captures the live display canvas directly — near-zero overhead, no SVG
// rasterization pipeline. Whatever is painted (incl. while playing) is grabbed.
let recording = false;
let recorder = null;
let recChunks = [];
let recStart = 0;
let recTimerInt = null;

function toggleRecord() {
  if (recording) stopRecord();
  else startRecord();
}

function startRecord() {
  if (recording) return;
  ensureCanvas();

  let mime = 'video/webm;codecs=vp9';
  if (!('MediaRecorder' in window) || !MediaRecorder.isTypeSupported(mime)) {
    mime = 'video/webm';
  }
  const stream = displayCanvas.captureStream(30);
  try {
    recorder = new MediaRecorder(stream, { mimeType: mime });
  } catch (err) {
    $('recordStatus').textContent = 'Aquest navegador no permet gravar';
    return;
  }
  recChunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) recChunks.push(e.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(recChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shaper-${state.seed}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    $('recordStatus').textContent = 'Gravació aturada, vídeo descarregat';
  };

  recording = true;
  recorder.start();
  recStart = performance.now();

  const btn = $('recordVideo');
  btn.textContent = 'Atura gravació';
  btn.classList.add('recording');
  $('recordStatus').textContent = 'Gravació iniciada';

  const timer = $('recordTimer');
  recTimerInt = setInterval(() => {
    const s = Math.floor((performance.now() - recStart) / 1000);
    timer.textContent = `Gravació: ${s} s`;
  }, 250);
}

function stopRecord() {
  if (!recording) return;
  recording = false;
  if (recTimerInt) clearInterval(recTimerInt);
  recTimerInt = null;
  $('recordTimer').textContent = '';
  const btn = $('recordVideo');
  btn.textContent = 'Grava vídeo';
  btn.classList.remove('recording');
  if (recorder && recorder.state !== 'inactive') recorder.stop();
}

function saveSVG() {
  const width = Math.max(1, Math.round(state.canvasW));
  const height = Math.max(1, Math.round(state.canvasH));
  const svg = buildSVG(state, width, height);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shaper-${state.seed}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function savePNG() {
  if (!displayCanvas) return;
  const url = displayCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `shaper-${state.seed}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// --- Init ---
function init() {
  restoreCustomData();
  buildSliders();
  wireTabs();
  wireControls();
  // Sync select / checkbox UI to state defaults
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
  $('num-speed').value = state.speed;
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
