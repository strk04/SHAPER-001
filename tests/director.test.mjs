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

import { evaluateDirector, totalDuration, advanceDirectorTime } from '../director.js';

test('evaluateDirector selects scenes and interpolates numeric params', () => {
  const config = normalizeDirector({
    version: 1, enabled: true, loop: false,
    scenes: [
      { id: 'a', duration: 2, params: { morphT: 0 }, automations: {} },
      {
        id: 'b', duration: 2, transition: { duration: 1, easing: 'linear' },
        params: { morphT: 1 }, behaviors: [], automations: {},
      },
    ],
  });
  assert.equal(evaluateDirector(config, 2.5, { morphT: 0 }).sceneId, 'b');
  assert.equal(evaluateDirector(config, 2.5, { morphT: 0 }).params.morphT, 0.5);
});

test('automation overrides the scene value in local scene time', () => {
  const config = normalizeDirector({
    version: 1, enabled: true, loop: false,
    scenes: [{
      id: 'a', duration: 4, params: { morphT: 0 }, behaviors: [],
      automations: {
        'param:morphT': [
          { time: 0, value: 0, easing: 'linear' },
          { time: 4, value: 1, easing: 'linear' },
        ],
      },
    }],
  });
  assert.equal(evaluateDirector(config, 2, { morphT: 0 }).params.morphT, 0.5);
});

test('advanceDirectorTime loops and clamps with absolute seconds', () => {
  assert.equal(totalDuration(normalizeDirector(null)), 5);
  assert.ok(Math.abs(advanceDirectorTime(4.8, 1, 5, true) - 0.8) < 1e-9);
  assert.equal(advanceDirectorTime(4.8, 1, 5, false), 5);
  assert.ok(Math.abs(advanceDirectorTime(0.2, -1, 5, true) - 4.2) < 1e-9);
});

test('the first scene transitions from the base preset', () => {
  const config = normalizeDirector({
    version: 1, enabled: true, loop: false,
    scenes: [{
      id: 'a', duration: 2,
      transition: { duration: 1, easing: 'linear' },
      params: { zoom: 3, bgColor: '#ffffff' }, behaviors: [], automations: {},
    }],
  });
  const result = evaluateDirector(config, 0.5, { zoom: 1, bgColor: '#000000' });
  assert.equal(result.params.zoom, 2);
  assert.equal(result.params.bgColor, '#000000');
});

test('disabled director returns the original base object', () => {
  const base = { morphT: 0.25 };
  const result = evaluateDirector({ version: 1, enabled: false, scenes: [] }, 10, base);
  assert.equal(result.params, base);
  assert.deepEqual(result.behaviors, []);
});
