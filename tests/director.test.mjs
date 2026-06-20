// tests/director.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DIRECTOR, normalizeDirector } from '../director.js';

test('normalizeDirector returns a safe disabled config for missing input', () => {
  const result = normalizeDirector(null);
  assert.equal(result.enabled, false);
  assert.equal(result.version, 1);
  assert.equal(result.scenes.length, 1);
  assert.equal(result.scenes[0].duration, 5);
});

test('normalizeDirector clamps invalid scene and behavior values', () => {
  const result = normalizeDirector({
    version: 1,
    enabled: true,
    scenes: [{
      id: '', name: '', duration: -4,
      transition: { duration: 99, easing: 'wild' },
      params: { morphT: Number.NaN },
      behaviors: [{ id: 'b', type: 'orbit', intensity: 8, cohesion: -2 }],
      automations: {},
    }],
  });
  assert.equal(result.scenes[0].duration, 0.1);
  assert.equal(result.scenes[0].transition.duration, 0.1);
  assert.equal(result.scenes[0].transition.easing, 'ease-in-out');
  assert.deepEqual(result.scenes[0].params, {});
  assert.equal(result.scenes[0].behaviors[0].intensity, 1);
  assert.equal(result.scenes[0].behaviors[0].cohesion, 0);
});

test('default config is not mutated by normalization', () => {
  const before = structuredClone(DEFAULT_DIRECTOR);
  normalizeDirector({ version: 1, scenes: [] });
  assert.deepEqual(DEFAULT_DIRECTOR, before);
});

test('unknown versions and behaviors stay visible but disabled', () => {
  const result = normalizeDirector({
    version: 9, enabled: true,
    scenes: [{ duration: 2, behaviors: [{ id: 'x', type: 'teleport', intensity: 1 }] }],
  });
  assert.equal(result.enabled, false);
  assert.equal(result.unsupportedVersion, true);
  assert.equal(result.scenes[0].behaviors[0].unsupported, true);
  assert.equal(result.scenes[0].behaviors[0].enabled, false);
});

test('unknown fields survive normalization for forward-compatible round trips', () => {
  const result = normalizeDirector({
    version: 1, futureFlag: 'keep-me',
    scenes: [{ duration: 2, futureSceneField: 7, behaviors: [] }],
  });
  assert.equal(result.futureFlag, 'keep-me');
  assert.equal(result.scenes[0].futureSceneField, 7);
});
