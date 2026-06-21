// tests/director.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DIRECTOR, normalizeDirector } from '../director.js';
import {
  addScene, duplicateScene, moveScene, removeScene, upsertKeyframe, removeKeyframe,
  upsertBehavior, updateBehavior, removeBehavior, isAutomatablePath,
} from '../director.js';

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

test('scene editing is immutable and never removes the final scene', () => {
  const base = normalizeDirector(null);
  const added = addScene(base, { name: 'Òrbita', duration: 3 });
  const duplicated = duplicateScene(added, added.scenes[1].id);
  const moved = moveScene(duplicated, 2, 0);
  const removed = removeScene(moved, moved.scenes[1].id);
  assert.equal(base.scenes.length, 1);
  assert.equal(added.scenes.length, 2);
  assert.equal(duplicated.scenes.length, 3);
  assert.equal(removed.scenes.length, 2);
  assert.equal(removeScene(base, base.scenes[0].id).scenes.length, 1);
});

test('upsertKeyframe clamps time and replaces same-time values', () => {
  const scene = normalizeDirector(null).scenes[0];
  const once = upsertKeyframe(scene, 'param:morphT', { time: 8, value: 0.4, easing: 'linear' });
  const twice = upsertKeyframe(once, 'param:morphT', { time: 5, value: 0.8, easing: 'ease-out' });
  assert.deepEqual(twice.automations['param:morphT'], [{ time: 5, value: 0.8, easing: 'ease-out' }]);
});

test('behavior editing creates supported defaults and stays immutable', () => {
  const scene = normalizeDirector(null).scenes[0];
  const withOrbit = upsertBehavior(scene, 'orbit');
  const id = withOrbit.behaviors[0].id;
  const updated = updateBehavior(withOrbit, id, { intensity: 0.75, params: { radius: 240 } });
  const removed = removeBehavior(updated, id);
  assert.equal(scene.behaviors.length, 0);
  assert.equal(withOrbit.behaviors[0].type, 'orbit');
  assert.equal(updated.behaviors[0].intensity, 0.75);
  assert.equal(updated.behaviors[0].params.radius, 240);
  assert.equal(removed.behaviors.length, 0);
});

test('removeKeyframe removes exact-time frame and cleans empty lane', () => {
  const scene = normalizeDirector(null).scenes[0];
  const with2 = upsertKeyframe(
    upsertKeyframe(scene, 'param:morphT', { time: 1, value: 0.2, easing: 'linear' }),
    'param:morphT', { time: 3, value: 0.8, easing: 'linear' },
  );
  const after = removeKeyframe(with2, 'param:morphT', 1);
  assert.deepEqual(after.automations['param:morphT'], [{ time: 3, value: 0.8, easing: 'linear' }]);

  const empty = removeKeyframe(after, 'param:morphT', 3);
  assert.equal('param:morphT' in empty.automations, false, 'lane removed when empty');
});

test('removeKeyframe is a no-op for unknown path or missing time', () => {
  const scene = normalizeDirector(null).scenes[0];
  const withKf = upsertKeyframe(scene, 'param:morphT', { time: 2, value: 0.5, easing: 'linear' });
  assert.deepEqual(removeKeyframe(withKf, 'param:unknown', 2), removeKeyframe(withKf, 'param:unknown', 2));
  assert.deepEqual(removeKeyframe(withKf, 'param:morphT', 9).automations['param:morphT'],
    [{ time: 2, value: 0.5, easing: 'linear' }], 'non-matching time leaves lane intact');
});

test('automation allowlist accepts known paths and rejects arbitrary state', () => {
  assert.equal(isAutomatablePath('param:morphT'), true);
  assert.equal(isAutomatablePath('param:textColor'), true);
  assert.equal(isAutomatablePath('param:director'), false);
  assert.equal(isAutomatablePath('behavior:orbit-1:intensity'), true);
});

import { simplifySamples } from '../director.js';

test('simplifySamples keeps endpoints and meaningful changes', () => {
  const result = simplifySamples([
    { time: 0, value: 0 },
    { time: 0.1, value: 0.01 },
    { time: 0.2, value: 0.5 },
    { time: 0.3, value: 0.51 },
    { time: 0.4, value: 1 },
  ], 0.05);
  assert.deepEqual(result, [
    { time: 0, value: 0, easing: 'linear' },
    { time: 0.2, value: 0.5, easing: 'linear' },
    { time: 0.4, value: 1, easing: 'linear' },
  ]);
});
