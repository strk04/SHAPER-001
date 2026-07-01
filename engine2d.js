// engine2d.js — pure functions for the 2D grid section of SHAPER 001.
// Independent from the 3D pipeline (engine.js) except for `layout()`: every
// cell repeats the full Àtom text through the same character-level layout
// engine used by 3D, so every Àtom slider/mode (kerning, opacity, blink,
// size, skew, accent...) applies identically per cell.
import { layout, resolveFontSpec } from './engine.js';

// ── Easing (ported from the reference "Stacked Text Tool" motion presets) ────
export const EASE = {
  sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  inOutQuint: (t) => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
  inOutQuart: (t) => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
};

const PERIOD = 3.5;

// ── Grid layout: pure geometry, N rows × M cols ─────────────────────────────
// The Àtom text repeats identically in every cell (see drawGrid2D), so this
// only needs to compute cell rectangles.
export function layoutGrid2D(rows, cols, width, height) {
  const r = Math.max(1, Math.round(rows));
  const c = Math.max(1, Math.round(cols));
  const cellW = width / c;
  const cellH = height / r;

  const cells = [];
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      cells.push({ row, col, x: col * cellW, y: row * cellH, w: cellW, h: cellH });
    }
  }
  return { rows: r, cols: c, cellW, cellH, cells };
}

// ── Per-index scale-multiplier presets ───────────────────────────────────────
// Each returns a multiplier centered on 1 for index i out of n, at cycle
// position t∈[0,1), scaled by intensity I. Ported 1:1 from the reference tool.
export const SCALE_PRESETS = {
  wave: (t, i, n, I) => {
    const ph = i / Math.max(n, 1);
    const s = (Math.sin((t - ph) * Math.PI * 2) + 1) / 2;
    return 1 + I * 0.35 * (EASE.sine(s) * 2 - 1);
  },
  accordion: (t, i, n, I) => {
    const sign = i % 2 === 0 ? 1 : -1;
    const s = (Math.sin(t * Math.PI * 2) + 1) / 2;
    return 1 + sign * I * 0.45 * (EASE.inOutQuint(s) * 2 - 1);
  },
  cascade: (t, i, n, I) => {
    const ph = (i / Math.max(n, 1)) * 0.55;
    const raw = (t - ph + 10) % 1;
    const s = (Math.sin(raw * Math.PI * 2) + 1) / 2;
    return 1 + I * 0.45 * (EASE.inOutQuart(s) * 2 - 1);
  },
};

// ── Warp: deforms the boundary between adjacent cells instead of scaling ────
// Returns an offset (in px) for the boundary after index b (0..n), where
// boundaries 0 and n (the outer edges) never move.
export function warpBoundaryOffset(t, b, n, size, I) {
  if (b <= 0 || b >= n) return 0;
  const amp = size * 0.15 * I;
  const ph = (b / Math.max(n, 1)) * 0.5;
  const s = (Math.sin((t - ph) * Math.PI * 2) + 1) / 2;
  return (EASE.sine(s) * 2 - 1) * amp;
}

// ── Block: sequential reveal by index, one at a time, looping ───────────────
// v1 simplification of the reference's two-phase Block In (arrival + push):
// only the arrival phase is ported (each index grows 0→1 in turn, eased with
// outQuint); when all have arrived the cycle restarts. The push-phase queue
// shift is not implemented in v1.
export function blockReveal(t, i, n) {
  const cycle = t * (n + 1);
  const local = ((cycle % (n + 1)) + (n + 1)) % (n + 1);
  const arrived = Math.floor(local);
  if (i < arrived) return 1;
  if (i === arrived) return EASE.outQuint(Math.min(1, local - arrived));
  return 0;
}

export const PRESET_NAMES = Object.freeze(['none', 'wave', 'accordion', 'cascade', 'warpflow', 'block']);

// evalAxis: resolves one axis's per-index multiplier for a given preset name.
// Returns 1 (neutral) for 'none' or an unknown preset.
function evalAxisScale(preset, animTime, speed, i, n, intensity) {
  if (preset === 'none' || !preset) return 1;
  const cycleT = ((animTime * speed) / PERIOD) % 1;
  const t = ((cycleT % 1) + 1) % 1;
  if (preset === 'block') return 0.05 + 0.95 * blockReveal(t, i, n);
  const fn = SCALE_PRESETS[preset];
  if (fn) return Math.max(0.05, fn(t, i, n, intensity));
  return 1; // warpflow handled separately (boundary offsets, not a scale)
}

// ── Full grid evaluation for a frame ────────────────────────────────────────
// grid: output of layoutGrid2D. rowAnim/colAnim: { same: bool, presets: string[] }
// (presets has length 1 when `same` is true, else one entry per row/col).
// Returns cells with resolved {x,y,w,h,text,rowScale,colScale} for this frame,
// plus optional row/col boundary warp offsets when a warpflow preset is active.
export function evaluateGrid2D(grid, animTime, rowAnim, colAnim, intensity, speed) {
  const { rows, cols, cellW, cellH } = grid;

  const rowPresetFor = (i) => rowAnim.same ? (rowAnim.presets[0] || 'none') : (rowAnim.presets[i] || 'none');
  const colPresetFor = (i) => colAnim.same ? (colAnim.presets[0] || 'none') : (colAnim.presets[i] || 'none');

  const rowScales = Array.from({ length: rows }, (_, i) => evalAxisScale(rowPresetFor(i), animTime, speed, i, rows, intensity));
  const colScales = Array.from({ length: cols }, (_, i) => evalAxisScale(colPresetFor(i), animTime, speed, i, cols, intensity));

  const cycleT = ((animTime * speed) / PERIOD) % 1;
  const t = ((cycleT % 1) + 1) % 1;
  const rowWarp = Array.from({ length: rows + 1 }, (_, b) =>
    rowPresetFor(Math.min(b, rows - 1)) === 'warpflow' ? warpBoundaryOffset(t, b, rows, cellH * rows, intensity) : 0);
  const colWarp = Array.from({ length: cols + 1 }, (_, b) =>
    colPresetFor(Math.min(b, cols - 1)) === 'warpflow' ? warpBoundaryOffset(t, b, cols, cellW * cols, intensity) : 0);

  const cells = grid.cells.map((cell) => ({
    ...cell,
    rowScale: rowScales[cell.row],
    colScale: colScales[cell.col],
    warpX: colWarp[cell.col],
    warpY: rowWarp[cell.row],
    warpX2: colWarp[cell.col + 1],
    warpY2: rowWarp[cell.row + 1],
  }));

  return { rows, cols, cellW, cellH, cells };
}

// ── Canvas drawing ───────────────────────────────────────────────────────────
// Paints an evaluated grid onto a 2D canvas context. `atomParams` is the full
// shared Àtom state (text, font, fontSize, charTrack, leading, noise/chaos,
// opacity/blink/size/accent modes, seed, t, speed...) — passed straight to
// `layout()` so every Àtom control affects the 2D grid exactly as it does 3D.
// `opts`: { textColor, bgColor, dpr, showGrid, gridColor }
export function drawGrid2D(ctx, evaluated, width, height, atomParams, opts = {}) {
  const d = opts.dpr || 1;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.fillStyle = opts.bgColor || atomParams.bgColor || '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const { family, weight } = resolveFontSpec(atomParams.font);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const clockMs = (atomParams.morphClock || 0) * 1000;
  const blinkHalfMs = atomParams.blinkRate > 0 ? (500 / atomParams.blinkRate) : 500;
  const blinkActive = atomParams.blinkFade === 0 && atomParams.blinkMode !== 'none'
    && Math.floor(clockMs / blinkHalfMs) % 2 === 0;
  const cosPhase = (Math.cos(clockMs / (blinkHalfMs * 2) * Math.PI * 2) + 1) / 2;
  const blinkFadeFactor = atomParams.blinkFade > 0 && atomParams.blinkMode !== 'none'
    ? 1 - atomParams.blinkFade * (1 - cosPhase) : 1;
  const accentColors = {
    1: atomParams.accentColor  || opts.textColor || atomParams.textColor,
    2: atomParams.accentColor2 || opts.textColor || atomParams.textColor,
    3: atomParams.accentColor3 || opts.textColor || atomParams.textColor,
    4: atomParams.accentColor4 || opts.textColor || atomParams.textColor,
  };
  const baseColor = opts.textColor || atomParams.textColor || '#000000';

  for (const cell of evaluated.cells) {
    const cw = cell.w * cell.colScale;
    const ch = cell.h * cell.rowScale;
    if (cw <= 0 || ch <= 0) continue;
    const { lines } = layout(atomParams, cw, ch);

    ctx.save();
    ctx.beginPath();
    ctx.rect(cell.x + cell.warpX, cell.y + cell.warpY, cw, ch);
    ctx.clip();
    ctx.translate(cell.x + cell.warpX, cell.y + cell.warpY);
    ctx.font = `${weight} ${atomParams.fontSize}px ${family}`;

    for (const line of lines) {
      for (const char of line.chars) {
        if (char.blinkT && blinkActive) continue;
        const baseOp = (char.blinkT && atomParams.blinkFade > 0) ? blinkFadeFactor : 1;
        ctx.globalAlpha = baseOp * (char.extraOp !== undefined ? char.extraOp : 1);
        ctx.fillStyle = char.accentT ? (accentColors[char.accentT] || baseColor) : baseColor;
        const sm = char.sizeMul !== undefined ? char.sizeMul : 1;
        ctx.save();
        ctx.translate(char.x, char.y);
        if (sm !== 1) ctx.scale(sm, sm);
        if (char.skew) ctx.transform(1, 0, char.skew, 1, 0, 0);
        ctx.fillText(char.ch, 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  if (opts.showGrid) {
    ctx.save();
    ctx.strokeStyle = opts.gridColor || '#999999';
    ctx.lineWidth = 1;
    for (const cell of evaluated.cells) {
      const cw = cell.w * cell.colScale;
      const ch = cell.h * cell.rowScale;
      ctx.strokeRect(cell.x + cell.warpX + 0.5, cell.y + cell.warpY + 0.5, cw, ch);
    }
    ctx.restore();
  }
}
