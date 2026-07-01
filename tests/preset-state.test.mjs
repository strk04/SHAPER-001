import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureCreativePreset,
  CREATIVE_PRESET_EXTRA_KEYS,
  EPHEMERAL_PRESET_KEYS,
} from '../preset-state.js';

test('creative preset snapshot captures nested creative state and sliders', () => {
  const state = {
    text: 'Camera test',
    seed: 72,
    zoom: 1.7,
    fps: 58,
    t: 42,
    cameraEnabled: { zoom: false, angleX: false, angleY: true },
    customOutline: [0, 0, 1, 0, 1, 1],
  };

  const preset = captureCreativePreset(state, ['zoom']);

  assert.equal(preset.v, 1);
  assert.equal(preset.seed, 72);
  assert.equal(preset.zoom, 1.7);
  assert.deepEqual(preset.cameraEnabled, { zoom: false, angleX: false, angleY: true });
  assert.deepEqual(preset.customOutline, [0, 0, 1, 0, 1, 1]);
  assert.equal('fps' in preset, false);
  assert.equal('t' in preset, false);

  state.cameraEnabled.zoom = true;
  state.customOutline[0] = 9;
  assert.equal(preset.cameraEnabled.zoom, false);
  assert.equal(preset.customOutline[0], 0);
});

test('preset key lists document creative and ephemeral boundaries', () => {
  assert.ok(CREATIVE_PRESET_EXTRA_KEYS.includes('cameraEnabled'));
  assert.ok(CREATIVE_PRESET_EXTRA_KEYS.includes('seed'));
  assert.ok(CREATIVE_PRESET_EXTRA_KEYS.includes('customOutline'));
  assert.ok(CREATIVE_PRESET_EXTRA_KEYS.includes('guideMeta'));
  assert.equal(CREATIVE_PRESET_EXTRA_KEYS.includes('director'), false);
  assert.ok(EPHEMERAL_PRESET_KEYS.includes('fps'));
  assert.equal(EPHEMERAL_PRESET_KEYS.includes('selectedDirectorEffect'), false);
});
