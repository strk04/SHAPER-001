// tests/director-ui.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { directorViewModel } from '../director-ui.js';

test('directorViewModel exposes the whole timeline as one duration', () => {
  const view = directorViewModel({
    version: 1, enabled: true, loop: true, duration: 5,
    automations: {},
  }, 2.5);
  assert.equal(view.duration, 5);
  assert.equal(view.time, 2.5);
  assert.equal(view.director.enabled, true);
});
