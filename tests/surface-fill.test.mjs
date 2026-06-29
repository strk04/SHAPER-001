import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScene, buildSVG } from '../engine.js';

const baseParams = {
  text: 'ABC',
  font: 'courier-regular',
  seed: 1,
  fontSize: 24,
  charTrack: 0,
  trackRand: 0,
  leading: 50,
  noiseAmt: 0,
  wordTrack: 0,
  wordChaos: 0,
  wordRamp: 0,
  charChaos: 0,
  yJitter: 0,
  yJitterAffect: 0,
  dropProb: 0,
  wordsPerRow: 1,
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
  turns: 1,
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
  regionSurface: true,
  surfaceColor: '#336699',
  surfaceTransparency: 0.25,
  surfaceOcclusion: false,
};

test('buildScene adds colored surface tiles with alpha derived from transparency', () => {
  const scene = buildScene(baseParams, 640, 480);
  assert.ok(scene.surfaces.length > 0);
  assert.equal(scene.surfaces[0].color, '#336699');
  assert.equal(scene.surfaces[0].opacity, 0.75);
  assert.ok(scene.glyphs.some((glyph) => glyph.back));
  assert.ok(scene.glyphs.some((glyph) => !glyph.back));
});

test('buildSVG serializes surface paths between text layers', () => {
  const svg = buildSVG(baseParams, 640, 480);
  assert.match(svg, /<path d="M[^"]+Z" fill="#336699" opacity="0\.750"\/>/);
  assert.match(svg, /<g[^>]*data-layer="text-back"[\s\S]*<g data-layer="surface"[\s\S]*<g[^>]*data-layer="text-front"/);
});

test('surface occlusion removes back-facing glyphs while preserving the surface', () => {
  const scene = buildScene({ ...baseParams, surfaceOcclusion: true }, 640, 480);
  assert.ok(scene.surfaces.length > 0);
  assert.equal(scene.glyphs.some((glyph) => glyph.back), false);
  assert.ok(scene.glyphs.some((glyph) => !glyph.back));
});

test('small mathematical forms get a normalized visual zoom', () => {
  const roman = buildScene({ ...baseParams, form: 'roman-surface' }, 640, 480);
  const pts = roman.surfaces.flatMap((surface) => surface.points);
  const width = Math.max(...pts.map((pt) => pt.X)) - Math.min(...pts.map((pt) => pt.X));
  assert.ok(width >= 220);
});
