import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('surface color controls are wired through UI state and presets', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /id="surfaceColor"/);
  assert.match(html, /id="surfaceOcclusion"/);
  assert.match(html, /data-key="surfaceTransparency"/);
  assert.match(main, /surfaceTransparency:\s*\{\s*label:\s*'Transparència superfície'/);
  assert.match(main, /surfaceColor:\s*'#d8d8d8'/);
  assert.match(main, /surfaceOcclusion:\s*true/);
  assert.match(main, /\$\('surfaceColor'\)\.addEventListener\('input'/);
  assert.match(main, /\$\('surfaceOcclusion'\)\.addEventListener\('change'/);
  assert.match(main, /'surfaceColor'/);
  assert.match(main, /'surfaceOcclusion'/);
  assert.match(main, /\$\('surfaceColor'\)\.value\s*=\s*state\.surfaceColor/);
  assert.match(main, /\$\('surfaceOcclusion'\)\.checked\s*=\s*state\.surfaceOcclusion/);
  assert.match(main, /resetFormViewDefaults\(\)/);
});

test('guide layer control is wired through UI state and presets', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /id="guideLayer"/);
  assert.match(html, /id="guideColor"/);
  assert.match(html, /id="guideMetaColor"/);
  assert.match(html, /value="back"[\s\S]*Darrere/);
  assert.match(html, /value="front"[\s\S]*Davant/);
  assert.match(main, /guideLayer:\s*'back'/);
  assert.match(main, /guideColor:\s*'#111111'/);
  assert.match(main, /guideMetaColor:\s*'#111111'/);
  assert.match(main, /\$\('guideLayer'\)\.addEventListener\('change'/);
  assert.match(main, /\$\('guideColor'\)\.addEventListener\('input'/);
  assert.match(main, /\$\('guideMetaColor'\)\.addEventListener\('input'/);
  assert.match(main, /'guideLayer'/);
  assert.match(main, /'guideColor'/);
  assert.match(main, /'guideMetaColor'/);
  assert.match(main, /\$\('guideLayer'\)\.value\s*=\s*state\.guideLayer/);
  assert.match(main, /\$\('guideColor'\)\.value\s*=\s*state\.guideColor/);
  assert.match(main, /\$\('guideMetaColor'\)\.value\s*=\s*state\.guideMetaColor/);
});

test('3D style panel no longer exposes region toggles', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /id="regionFieldset"/);
  assert.doesNotMatch(html, /id="regionSurface"/);
  assert.doesNotMatch(html, /id="regionCaps"/);
  assert.doesNotMatch(html, /id="regionVolume"/);
  assert.doesNotMatch(html, /id="capsWrapMode"/);
  assert.doesNotMatch(html, /id="interiorMode"/);
  assert.doesNotMatch(html, /data-key="capsFontScale"/);
  assert.doesNotMatch(html, /data-key="capsOpacity"/);
  assert.doesNotMatch(html, /data-key="interiorPlanes"/);
  assert.doesNotMatch(html, /data-key="interiorFontScale"/);
  assert.doesNotMatch(html, /data-key="interiorOpacity"/);
  assert.doesNotMatch(main, /'regionSurface'/);
  assert.doesNotMatch(main, /'regionCaps'/);
  assert.doesNotMatch(main, /'regionVolume'/);
  assert.doesNotMatch(main, /p\.regionSurface/);
  assert.doesNotMatch(main, /p\.regionCaps/);
  assert.doesNotMatch(main, /p\.regionVolume/);
});

test('Director feature has been fully removed', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const presetState = await readFile(new URL('../preset-state.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /director/i);
  assert.doesNotMatch(main, /director/i);
  assert.doesNotMatch(presetState, /director/i);
});

test('fixed-duration MP4 export falls back to real-time capture', async () => {
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /encodeDirectorFrames/);
  assert.doesNotMatch(main, /resolveOfflineAnimationState/);
  assert.match(main, /recState\.loopTotal = isNaN\(dur\) \? 0 : dur \* fps/);
});

test('2D grid section has been fully removed', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const presetState = await readFile(new URL('../preset-state.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /grid2d/i);
  assert.doesNotMatch(html, /panel-2d/i);
  assert.doesNotMatch(main, /grid2d/i);
  assert.doesNotMatch(main, /engine2d/i);
  assert.doesNotMatch(presetState, /grid2d/i);
  await assert.rejects(readFile(new URL('../engine2d.js', import.meta.url)));
});
