// tests/director.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DIRECTOR, normalizeDirector, evaluateDirector, totalDuration, advanceDirectorTime,
  upsertKeyframe, removeKeyframe, isAutomatablePath,
} from '../director.js';

test('normalizeDirector returns a safe disabled config for missing input', () => {
  const result = normalizeDirector(null);
  assert.equal(result.enabled, false);
  assert.equal(result.version, 1);
  assert.equal(result.duration, 5);
  assert.deepEqual(result.automations, {});
});

test('normalizeDirector clamps invalid duration', () => {
  const result = normalizeDirector({ version: 1, enabled: true, duration: -4 });
  assert.equal(result.duration, 0.1);
});

test('default config is not mutated by normalization', () => {
  const before = structuredClone(DEFAULT_DIRECTOR);
  normalizeDirector({ version: 1, duration: 20 });
  assert.deepEqual(DEFAULT_DIRECTOR, before);
});

test('unknown versions stay visible but disabled', () => {
  const result = normalizeDirector({ version: 9, enabled: true, duration: 2 });
  assert.equal(result.enabled, false);
  assert.equal(result.unsupportedVersion, true);
});

test('unknown fields survive normalization for forward-compatible round trips', () => {
  const result = normalizeDirector({ version: 1, futureFlag: 'keep-me', duration: 2 });
  assert.equal(result.futureFlag, 'keep-me');
});

test('evaluateDirector interpolates numeric automations across the whole timeline', () => {
  const config = normalizeDirector({
    version: 1, enabled: true, loop: false, duration: 4,
    automations: {
      'param:charTrack': [
        { time: 0, value: 0, easing: 'linear' },
        { time: 4, value: 1, easing: 'linear' },
      ],
    },
  });
  assert.equal(evaluateDirector(config, 2, { charTrack: 0 }).params.charTrack, 0.5);
});

test('evaluateDirector clamps time to [0, duration]', () => {
  const config = normalizeDirector({
    version: 1, enabled: true, duration: 4,
    automations: { 'param:charTrack': [{ time: 0, value: 0, easing: 'linear' }, { time: 4, value: 1, easing: 'linear' }] },
  });
  assert.equal(evaluateDirector(config, 100, {}).params.charTrack, 1);
  assert.equal(evaluateDirector(config, -100, {}).params.charTrack, 0);
});

test('advanceDirectorTime loops and clamps with absolute seconds', () => {
  assert.equal(totalDuration(normalizeDirector(null)), 5);
  assert.ok(Math.abs(advanceDirectorTime(4.8, 1, 5, true) - 0.8) < 1e-9);
  assert.equal(advanceDirectorTime(4.8, 1, 5, false), 5);
  assert.ok(Math.abs(advanceDirectorTime(0.2, -1, 5, true) - 4.2) < 1e-9);
});

test('disabled director returns the original base object', () => {
  const base = { morphT: 0.25 };
  const result = evaluateDirector({ version: 1, enabled: false, duration: 5 }, 10, base);
  assert.equal(result.params, base);
});

test('upsertKeyframe clamps time and replaces same-time values', () => {
  const director = normalizeDirector(null);
  const once = upsertKeyframe(director, 'param:charTrack', { time: 8, value: 0.4, easing: 'linear' });
  const twice = upsertKeyframe(once, 'param:charTrack', { time: 5, value: 0.8, easing: 'ease-out' });
  assert.deepEqual(twice.automations['param:charTrack'], [{ time: 5, value: 0.8, easing: 'ease-out' }]);
});

test('removeKeyframe removes exact-time frame and cleans empty lane', () => {
  const director = normalizeDirector(null);
  const with2 = upsertKeyframe(
    upsertKeyframe(director, 'param:charTrack', { time: 1, value: 0.2, easing: 'linear' }),
    'param:charTrack', { time: 3, value: 0.8, easing: 'linear' },
  );
  const after = removeKeyframe(with2, 'param:charTrack', 1);
  assert.deepEqual(after.automations['param:charTrack'], [{ time: 3, value: 0.8, easing: 'linear' }]);

  const empty = removeKeyframe(after, 'param:charTrack', 3);
  assert.equal('param:charTrack' in empty.automations, false, 'lane removed when empty');
});

test('removeKeyframe is a no-op for unknown path or missing time', () => {
  const director = normalizeDirector(null);
  const withKf = upsertKeyframe(director, 'param:charTrack', { time: 2, value: 0.5, easing: 'linear' });
  assert.deepEqual(removeKeyframe(withKf, 'param:unknown', 2), removeKeyframe(withKf, 'param:unknown', 2));
  assert.deepEqual(removeKeyframe(withKf, 'param:charTrack', 9).automations['param:charTrack'],
    [{ time: 2, value: 0.5, easing: 'linear' }], 'non-matching time leaves lane intact');
});

test('automation allowlist accepts known paths and rejects arbitrary state', () => {
  assert.equal(isAutomatablePath('param:charTrack'), true);
  assert.equal(isAutomatablePath('param:formSize'), true);
  assert.equal(isAutomatablePath('param:director'), false);
  assert.equal(isAutomatablePath('behavior:orbit-1:intensity'), false);
});
