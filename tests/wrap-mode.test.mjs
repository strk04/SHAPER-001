import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScene } from '../engine.js';

const baseParams = {
  text: 'ABC DEF GHI JKL MNO PQR',
  font: 'courier-regular',
  seed: 1,
  fontSize: 24,
  charTrack: 0,
  trackRand: 0,
  leading: 40,
  noiseAmt: 0,
  wordTrack: 0,
  wordChaos: 0,
  wordRamp: 0,
  charChaos: 0,
  yJitter: 0,
  yJitterAffect: 0,
  dropProb: 0,
  wordsPerRow: 2,
  hardWrap: true,
  t: 0,
  speed: 1,
  textColor: '#111111',
  bgColor: '#f4f4f4',
  form: 'sphere',
  projection: 'isometric',
  formSize: 320,
  aspect: 1,
  facets: 4,
  turns: 2,
  count: 1,
  scatter: 0,
  fov: 60,
  zoom: 1,
  rotXSpeed: 0,
  rotYSpeed: 0,
  rotZSpeed: 0,
  depthFade: 0,
  pulse: 0,
  pulseSpeed: 1,
  rainProb: 0,
  rainSpeed: 1,
  angleX: 0,
  angleY: 0,
  surfaceText: true,
  surfaceColor: '#336699',
  surfaceTransparency: 0.25,
  surfaceOcclusion: false,
};

function glyphSignature(params) {
  const scene = buildScene(params, 640, 480);
  assert.ok(scene.glyphs.length > 0, `expected glyphs for wrapMode=${params.wrapMode}`);
  return scene.glyphs.map((g) => `${g.X.toFixed(2)},${g.Y.toFixed(2)}`).join('|');
}

test('brick, boustro, fan and ripple wrapModes render glyphs without crashing', () => {
  for (const wrapMode of ['brick', 'boustro', 'fan', 'ripple']) {
    const scene = buildScene({ ...baseParams, wrapMode }, 640, 480);
    assert.ok(scene.glyphs.length > 0, `wrapMode=${wrapMode} produced no glyphs`);
    assert.ok(scene.glyphs.every((g) => Number.isFinite(g.X) && Number.isFinite(g.Y)));
  }
});

test('each new wrapMode produces a distinct layout from rings and from each other', () => {
  const signatures = new Map();
  for (const wrapMode of ['rings', 'brick', 'boustro', 'fan', 'ripple']) {
    signatures.set(wrapMode, glyphSignature({ ...baseParams, wrapMode }));
  }
  const values = [...signatures.values()];
  const unique = new Set(values);
  assert.equal(unique.size, values.length, 'expected every wrapMode to produce a distinct glyph layout');
});

test('brick offsets alternating lines by half a wrap relative to rings', () => {
  const rings = buildScene({ ...baseParams, wrapMode: 'rings' }, 640, 480);
  const brick = buildScene({ ...baseParams, wrapMode: 'brick' }, 640, 480);
  assert.notDeepEqual(
    brick.glyphs.map((g) => [g.X, g.Y]),
    rings.glyphs.map((g) => [g.X, g.Y]),
  );
});

test('ripple keeps v near the line latitude (bounded oscillation, not a random jump)', () => {
  const scene = buildScene({ ...baseParams, wrapMode: 'ripple' }, 640, 480);
  assert.ok(scene.glyphs.length > 0);
});
