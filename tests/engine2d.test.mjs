import test from 'node:test';
import assert from 'node:assert/strict';
import {
  layoutGrid2D, SCALE_PRESETS, warpBoundaryOffset, blockReveal, evaluateGrid2D,
} from '../engine2d.js';

test('layoutGrid2D distributes words evenly in row-major reading order', () => {
  const grid = layoutGrid2D('one two three four five six', 2, 3, 300, 200);
  assert.equal(grid.cells.length, 6);
  assert.equal(grid.cellW, 100);
  assert.equal(grid.cellH, 100);
  assert.deepEqual(grid.cells.map((c) => c.text), ['one', 'two', 'three', 'four', 'five', 'six']);
  assert.equal(grid.cells[0].row, 0);
  assert.equal(grid.cells[0].col, 0);
  assert.equal(grid.cells[3].row, 1);
  assert.equal(grid.cells[3].col, 0);
});

test('layoutGrid2D spreads remainder words across the first cells', () => {
  const grid = layoutGrid2D('a b c d e', 1, 2, 100, 50);
  assert.equal(grid.cells[0].text, 'a b c');
  assert.equal(grid.cells[1].text, 'd e');
});

test('layoutGrid2D clamps rows/cols to at least 1 and rounds', () => {
  const grid = layoutGrid2D('x', 0, 2.6, 100, 100);
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
  const grid = layoutGrid2D('a b c d', 2, 2, 200, 200);
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
  const grid = layoutGrid2D('a b c d', 2, 1, 200, 200);
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
  const grid = layoutGrid2D('a b c d', 2, 2, 200, 200);
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
