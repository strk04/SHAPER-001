// tests/director-ui.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { directorViewModel } from '../director-ui.js';

test('directorViewModel computes contiguous scene positions', () => {
  const view = directorViewModel({
    version: 1, enabled: true, loop: true,
    scenes: [
      { id: 'a', name: 'Flota', duration: 2, transition: { duration: 0 }, params: {}, behaviors: [], automations: {} },
      { id: 'b', name: 'Òrbita', duration: 3, transition: { duration: 0 }, params: {}, behaviors: [], automations: {} },
    ],
  }, 'b', 2.5);
  assert.deepEqual(view.scenes.map(({ id, start, end }) => ({ id, start, end })), [
    { id: 'a', start: 0, end: 2 },
    { id: 'b', start: 2, end: 5 },
  ]);
  assert.equal(view.activeScene.id, 'b');
  assert.equal(view.duration, 5);
});
