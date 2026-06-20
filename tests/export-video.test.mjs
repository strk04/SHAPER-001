import test from 'node:test';
import assert from 'node:assert/strict';
import { directorFrameTimes, encodeDirectorFrames } from '../export-video.js';

test('directorFrameTimes covers frame zero and excludes the end sentinel', () => {
  assert.deepEqual(directorFrameTimes(1, 4), [0, 0.25, 0.5, 0.75]);
});

test('directorFrameTimes rejects invalid duration or fps', () => {
  assert.deepEqual(directorFrameTimes(0, 30), []);
  assert.deepEqual(directorFrameTimes(1, 0), []);
});

test('encodeDirectorFrames renders and encodes the same absolute times', async () => {
  const rendered = [];
  const encoded = [];
  await encodeDirectorFrames({
    duration: 1, fps: 2,
    renderAt: (time) => rendered.push(time),
    encodeCanvas: (index, fps) => encoded.push([index, fps]),
    yieldEvery: 99,
  });
  assert.deepEqual(rendered, [0, 0.5]);
  assert.deepEqual(encoded, [[0, 2], [1, 2]]);
});
