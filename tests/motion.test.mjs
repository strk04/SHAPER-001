// tests/motion.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMotionBehaviors, centroidOf } from '../motion.js';

const point = { x: 10, y: 0, z: 0 };
const centroid = { x: 0, y: 0, z: 0 };

test('zero intensity preserves the exact point', () => {
  const result = applyMotionBehaviors(point, centroid, 3, [{
    id: 'd', type: 'drift', enabled: true, intensity: 0, cohesion: 0,
    seedOffset: 1, params: { angle: 0, elevation: 0, distance: 100, speed: 1, phase: 0 },
  }], 1, 42);
  assert.deepEqual(result, point);
});

test('same seed and time produce identical explosion offsets', () => {
  const behavior = {
    id: 'e', type: 'explode', enabled: true, intensity: 1, cohesion: 0,
    seedOffset: 9, params: { centerX: 0, centerY: 0, centerZ: 0, distance: 80, spread: 1, progress: 0.5 },
  };
  assert.deepEqual(
    applyMotionBehaviors(point, centroid, 7, [behavior], 2, 99),
    applyMotionBehaviors(point, centroid, 7, [behavior], 2, 99),
  );
});

test('cohesion one gives the same offset to every glyph', () => {
  const behavior = {
    id: 'a', type: 'attract', enabled: true, intensity: 1, cohesion: 1,
    seedOffset: 1, params: { targetX: 100, targetY: 0, targetZ: 0, strength: 20, radius: 200, falloff: 1 },
  };
  const a = applyMotionBehaviors({ x: 10, y: 0, z: 0 }, centroid, 1, [behavior], 0, 1);
  const b = applyMotionBehaviors({ x: -10, y: 0, z: 0 }, centroid, 2, [behavior], 0, 1);
  assert.equal(a.x - 10, b.x + 10);
});

test('centroidOf averages finite points', () => {
  assert.deepEqual(centroidOf([{ x: 0, y: 2, z: 4 }, { x: 2, y: 4, z: 6 }]), { x: 1, y: 3, z: 5 });
});
