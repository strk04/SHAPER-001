import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('preset capture and apply include director data', async () => {
  const source = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(source, /snap\.director\s*=\s*structuredClone\(state\.director\)/);
  assert.match(source, /state\.director\s*=\s*normalizeDirector\(p\.director\)/);
});

test('director UI is wired in HTML and CSS', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const engine = await readFile(new URL('../engine.js', import.meta.url), 'utf8');
  assert.match(html, /id="panel-director"/);
  assert.match(html, /id="directorDock"/);
  assert.match(css, /\.director-dock/);
  assert.match(engine, /applyMotionBehaviors/);
  assert.match(engine, /clockMs/);
});

test('director excludes live performance controls', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../director-ui.js', import.meta.url), 'utf8');
  const director = await readFile(new URL('../director.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /id="directorRecord"/);
  assert.doesNotMatch(html, /id="directorLivePads"/);
  assert.doesNotMatch(main, /mountLivePads/);
  assert.doesNotMatch(main, /directorRecording|directorLiveOverrides|directorActiveLive|directorRecordedSamples/);
  assert.doesNotMatch(ui, /ATTRACT|REPEL|EXPLODE/);
  assert.doesNotMatch(director, /liveOverrides|simplifySamples/);
});
