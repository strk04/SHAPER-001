import test from 'node:test';
import assert from 'node:assert/strict';
import {
  layoutGrid2D, SCALE_PRESETS, warpBoundaryOffset, blockReveal, evaluateGrid2D, drawGrid2D,
  instanceSizeMul,
} from '../engine2d.js';

const ATOM_PARAMS = {
  text: 'hi', font: 'courier-regular', seed: 1, fontSize: 16,
  charTrack: 0, trackRand: 0, leading: 20, noiseAmt: 0,
  wordTrack: 0, wordChaos: 0, wordRamp: 0, charChaos: 0,
  yJitter: 0, yJitterAffect: 0, dropProb: 0, densityMap: 0,
  wordsPerRow: 5, hardWrap: true, t: 0, speed: 1,
  charOpacity: 0.6, charSkew: 0,
  opacityMode: 'none', opacityProb: 0.15, opacityEvery: 2,
  blinkMode: 'none', blinkRate: 2, blinkProb: 0.15, blinkEvery: 2, blinkFade: 0,
  sizeMode: 'none', sizeAmt: 1.5, sizeProb: 0.15, sizeEvery: 2,
  accentMode: 'none', accentProb: 0.15, accentEvery: 2,
  accentMode2: 'none', accentProb2: 0, accentEvery2: 2,
  accentMode3: 'none', accentProb3: 0, accentEvery3: 2,
  accentMode4: 'none', accentProb4: 0, accentEvery4: 2,
  textColor: '#111111', bgColor: '#ffffff', morphClock: 0,
};

function makeFakeCtx() {
  const calls = [];
  return {
    calls,
    set fillStyle(value) { calls.push(['fillStyle', value]); },
    get fillStyle() { return '#000'; },
    set strokeStyle(value) { calls.push(['strokeStyle', value]); },
    get strokeStyle() { return '#000'; },
    set globalAlpha(value) { calls.push(['globalAlpha', value]); },
    get globalAlpha() { return 1; },
    set font(value) { calls.push(['font', value]); },
    get font() { return ''; },
    set textAlign(value) { calls.push(['textAlign', value]); },
    get textAlign() { return 'left'; },
    set textBaseline(value) { calls.push(['textBaseline', value]); },
    get textBaseline() { return 'alphabetic'; },
    set lineWidth(value) { calls.push(['lineWidth', value]); },
    get lineWidth() { return 1; },
    setTransform: () => {},
    translate: (...args) => calls.push(['translate', ...args]),
    scale: (...args) => calls.push(['scale', ...args]),
    transform: () => {},
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    strokeRect: (...args) => calls.push(['strokeRect', ...args]),
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    rect: () => {},
    clip: () => {},
    fillText: (...args) => calls.push(['fillText', ...args]),
  };
}

test('layoutGrid2D lays out cells in row-major reading order', () => {
  const grid = layoutGrid2D(2, 3, 300, 200);
  assert.equal(grid.cells.length, 6);
  assert.equal(grid.cellW, 100);
  assert.equal(grid.cellH, 100);
  assert.equal(grid.cells[0].row, 0);
  assert.equal(grid.cells[0].col, 0);
  assert.equal(grid.cells[3].row, 1);
  assert.equal(grid.cells[3].col, 0);
});

test('layoutGrid2D clamps rows/cols to at least 1 and rounds', () => {
  const grid = layoutGrid2D(0, 2.6, 100, 100);
  assert.equal(grid.rows, 1);
  assert.equal(grid.cols, 3);
});

test('scale presets stay centered around 1 and respect intensity', () => {
  for (const name of ['wave', 'accordion', 'cascade']) {
    const fn = SCALE_PRESETS[name];
    const zeroIntensity = fn(0.3, 1, 4, 0);
    assert.ok(Math.abs(zeroIntensity - 1) < 1e-9, `${name} with intensity 0 stays at 1`);
    const withIntensity = fn(0.3, 1, 4, 1);
    assert.notEqual(withIntensity, 1);
  }
});

test('warpBoundaryOffset never moves the outer edges', () => {
  assert.equal(warpBoundaryOffset(0.4, 0, 4, 400, 1), 0);
  assert.equal(warpBoundaryOffset(0.4, 4, 4, 400, 1), 0);
  const inner = warpBoundaryOffset(0.4, 2, 4, 400, 1);
  assert.equal(typeof inner, 'number');
});

test('blockReveal marks earlier indices fully arrived and later indices at 0', () => {
  assert.equal(blockReveal(0.5, 0, 4), 1); // index 0 fully arrived by the time index 2 starts
  assert.equal(blockReveal(0.05, 3, 4), 0);
});

test('blockReveal loops back to the start after all indices have arrived', () => {
  const early = blockReveal(0.01, 0, 3);
  const afterFullCycle = blockReveal(1.01, 0, 3);
  assert.ok(Math.abs(early - afterFullCycle) < 1e-9);
});

test('evaluateGrid2D applies a shared preset to every row when rowAnim.same is true', () => {
  const grid = layoutGrid2D(2, 2, 200, 200);
  const evaluated = evaluateGrid2D(
    grid, 0.1,
    { same: true, presets: ['wave'] },
    { same: true, presets: ['none'] },
    1, 1,
  );
  const rowScalesByRow = new Map();
  for (const cell of evaluated.cells) rowScalesByRow.set(cell.row, cell.rowScale);
  assert.equal(rowScalesByRow.size, 2);
  for (const cell of evaluated.cells) assert.equal(cell.colScale, 1);
});

test('evaluateGrid2D lets each row/column use its own preset when not shared', () => {
  const grid = layoutGrid2D(2, 1, 200, 200);
  const evaluated = evaluateGrid2D(
    grid, 0.25,
    { same: false, presets: ['wave', 'none'] },
    { same: true, presets: ['none'] },
    1, 1,
  );
  const row0 = evaluated.cells.find((c) => c.row === 0);
  const row1 = evaluated.cells.find((c) => c.row === 1);
  assert.notEqual(row0.rowScale, 1);
  assert.equal(row1.rowScale, 1);
});

test('evaluateGrid2D produces zero warp offsets when no warpflow preset is active', () => {
  const grid = layoutGrid2D(2, 2, 200, 200);
  const evaluated = evaluateGrid2D(
    grid, 0.5,
    { same: true, presets: ['wave'] },
    { same: true, presets: ['cascade'] },
    1, 1,
  );
  for (const cell of evaluated.cells) {
    assert.equal(cell.warpX, 0);
    assert.equal(cell.warpY, 0);
  }
});

test('drawGrid2D repeats the Àtom text in every cell and paints the background', () => {
  const grid = layoutGrid2D(2, 2, 200, 200);
  const evaluated = evaluateGrid2D(grid, 0, { same: true, presets: ['none'] }, { same: true, presets: ['none'] }, 1, 1);
  const ctx = makeFakeCtx();
  drawGrid2D(ctx, evaluated, 200, 200, ATOM_PARAMS, { textColor: '#111111', bgColor: '#ffffff', dpr: 1 });
  const fillTextCalls = ctx.calls.filter((c) => c[0] === 'fillText');
  assert.ok(fillTextCalls.length >= 8, 'expects "hi" (2 chars) drawn in each of the 4 cells');
  assert.ok(ctx.calls.some((c) => c[0] === 'fillRect'));
});

test('drawGrid2D scales the atom itself per cell, not just the cell container', () => {
  const grid = layoutGrid2D(2, 1, 200, 200);
  const evaluated = evaluateGrid2D(grid, 0.1, { same: false, presets: ['wave', 'none'] }, { same: true, presets: ['none'] }, 1, 1);
  const row0 = evaluated.cells.find((c) => c.row === 0);
  assert.notEqual(row0.rowScale, 1, 'precondition: row 0 has a non-neutral scale to actually test');
  const ctx = makeFakeCtx();
  drawGrid2D(ctx, evaluated, 200, 200, ATOM_PARAMS, {});
  const scaleCalls = ctx.calls.filter((c) => c[0] === 'scale');
  assert.equal(scaleCalls.length, evaluated.cells.length, 'one ctx.scale per cell');
  assert.ok(scaleCalls.some((c) => c[2] === row0.rowScale), 'the animated rowScale is applied via ctx.scale, not just cell geometry');
});

test('instanceSizeMul stays at 1 with zero variance and oscillates otherwise', () => {
  assert.equal(instanceSizeMul(0.3, 1, 0.5, 0), 1);
  const a = instanceSizeMul(0.1, 1, 0.11, 0.5);
  const b = instanceSizeMul(0.1, 1, 0.73, 0.5);
  assert.notEqual(a, b, 'different phases produce different sizes at the same instant');
});

test('drawGrid2D packs density×density independent repeats per cell', () => {
  const grid = layoutGrid2D(1, 1, 200, 200);
  const evaluated = evaluateGrid2D(grid, 0, { same: true, presets: ['none'] }, { same: true, presets: ['none'] }, 1, 1);
  const ctx = makeFakeCtx();
  drawGrid2D(ctx, evaluated, 200, 200, ATOM_PARAMS, { density: 1 });
  const fillTextCallsD1 = ctx.calls.filter((c) => c[0] === 'fillText').length;

  const ctx2 = makeFakeCtx();
  drawGrid2D(ctx2, evaluated, 200, 200, ATOM_PARAMS, { density: 2 });
  const fillTextCallsD2 = ctx2.calls.filter((c) => c[0] === 'fillText').length;

  assert.ok(fillTextCallsD2 > fillTextCallsD1, 'density 2 (2x2=4 sub-instances) draws more repeats than density 1');
});

test('drawGrid2D gives each sub-instance its own animated font size when sizeVariance > 0', () => {
  const grid = layoutGrid2D(1, 1, 200, 200);
  const evaluated = evaluateGrid2D(grid, 0, { same: true, presets: ['none'] }, { same: true, presets: ['none'] }, 1, 1);
  const ctx = makeFakeCtx();
  drawGrid2D(ctx, evaluated, 200, 200, ATOM_PARAMS, { density: 3, sizeVariance: 0.8, animTime: 0.37, animSpeed: 1 });
  const fontValues = new Set(ctx.calls.filter((c) => c[0] === 'font').map((c) => c[1]));
  assert.ok(fontValues.size > 1, 'sub-instances render at different font sizes, not one uniform size');
});

test('drawGrid2D only strokes cell boundaries when showGrid is true', () => {
  const grid = layoutGrid2D(2, 2, 200, 200);
  const evaluated = evaluateGrid2D(grid, 0, { same: true, presets: ['none'] }, { same: true, presets: ['none'] }, 1, 1);
  const hiddenCtx = makeFakeCtx();
  drawGrid2D(hiddenCtx, evaluated, 200, 200, ATOM_PARAMS, { showGrid: false });
  assert.equal(hiddenCtx.calls.some((c) => c[0] === 'strokeRect'), false);

  const shownCtx = makeFakeCtx();
  drawGrid2D(shownCtx, evaluated, 200, 200, ATOM_PARAMS, { showGrid: true });
  const strokeRectCalls = shownCtx.calls.filter((c) => c[0] === 'strokeRect');
  assert.equal(strokeRectCalls.length, 4);
});
