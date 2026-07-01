// tests/director.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DIRECTOR, normalizeDirector, evaluateDirector, totalDuration, advanceDirectorTime,
  upsertEffect, removeEffect, isAutomatablePath,
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

test('evaluateDirector holds a fixed value inside [start, end] and falls back outside it', () => {
  const config = normalizeDirector({
    version: 1, enabled: true, loop: false, duration: 5,
    automations: { 'param:charTrack': [{ start: 1, end: 3, value: 0.8 }] },
  });
  assert.equal(evaluateDirector(config, 0.5, { charTrack: 0 }).params.charTrack, 0);
  assert.equal(evaluateDirector(config, 1, { charTrack: 0 }).params.charTrack, 0.8);
  assert.equal(evaluateDirector(config, 2, { charTrack: 0 }).params.charTrack, 0.8);
  assert.equal(evaluateDirector(config, 3, { charTrack: 0 }).params.charTrack, 0.8);
  assert.equal(evaluateDirector(config, 4, { charTrack: 0 }).params.charTrack, 0);
});

test('evaluateDirector clamps time to [0, duration]', () => {
  const config = normalizeDirector({
    version: 1, enabled: true, duration: 4,
    automations: { 'param:charTrack': [{ start: 0, end: 4, value: 1 }] },
  });
  assert.equal(evaluateDirector(config, 100, {}).params.charTrack, 1);
  assert.equal(evaluateDirector(config, -100, {}).params.charTrack, 1);
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

test('upsertEffect clamps start/end to [0, duration] and keeps end >= start', () => {
  const director = normalizeDirector(null);
  const seg = upsertEffect(director, 'param:charTrack', { start: 8, end: 20, value: 0.4 });
  assert.deepEqual(seg.automations['param:charTrack'], [{ start: 5, end: 5, value: 0.4 }]);
});

test('upsertEffect replaces the segment that starts at the same time', () => {
  const director = normalizeDirector(null);
  const once = upsertEffect(director, 'param:charTrack', { start: 1, end: 2, value: 0.4 });
  const twice = upsertEffect(once, 'param:charTrack', { start: 1, end: 3, value: 0.9 });
  assert.deepEqual(twice.automations['param:charTrack'], [{ start: 1, end: 3, value: 0.9 }]);
});

test('removeEffect removes the segment starting at that time and cleans empty lane', () => {
  const director = normalizeDirector(null);
  const with2 = upsertEffect(
    upsertEffect(director, 'param:charTrack', { start: 1, end: 2, value: 0.2 }),
    'param:charTrack', { start: 3, end: 4, value: 0.8 },
  );
  const after = removeEffect(with2, 'param:charTrack', 1);
  assert.deepEqual(after.automations['param:charTrack'], [{ start: 3, end: 4, value: 0.8 }]);

  const empty = removeEffect(after, 'param:charTrack', 3);
  assert.equal('param:charTrack' in empty.automations, false, 'lane removed when empty');
});

test('removeEffect is a no-op for unknown path or missing start', () => {
  const director = normalizeDirector(null);
  const withEffect = upsertEffect(director, 'param:charTrack', { start: 2, end: 3, value: 0.5 });
  assert.deepEqual(removeEffect(withEffect, 'param:unknown', 2), removeEffect(withEffect, 'param:unknown', 2));
  assert.deepEqual(removeEffect(withEffect, 'param:charTrack', 9).automations['param:charTrack'],
    [{ start: 2, end: 3, value: 0.5 }], 'non-matching start leaves lane intact');
});

test('automation allowlist accepts known paths and rejects arbitrary state', () => {
  assert.equal(isAutomatablePath('param:charTrack'), true);
  assert.equal(isAutomatablePath('param:formSize'), true);
  assert.equal(isAutomatablePath('param:director'), false);
  assert.equal(isAutomatablePath('behavior:orbit-1:intensity'), false);
});
