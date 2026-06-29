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

test('director scene UI keeps only add and delete actions', async () => {
  const ui = await readFile(new URL('../director-ui.js', import.meta.url), 'utf8');
  assert.match(ui, /data-director-action="add"/);
  assert.match(ui, /data-director-action="delete"/);
  assert.doesNotMatch(ui, /data-director-action="duplicate"/);
  assert.doesNotMatch(ui, /data-director-action="left"/);
  assert.doesNotMatch(ui, /data-director-action="right"/);
});

test('director general controls live in column 2, not in dock transport', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../director-ui.js', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /id="directorStop"/);
  assert.doesNotMatch(html, /id="directorHold"/);
  assert.doesNotMatch(html, /id="directorReverse"/);
  assert.doesNotMatch(html, /id="directorLoop"/);
  assert.doesNotMatch(html, /id="directorCollapse"/);
  assert.doesNotMatch(html, /director-transport/);
  assert.match(ui, /id="directorReverse"/);
  assert.match(ui, /id="directorLoop"/);
  assert.match(ui, /id="directorCollapse"/);
  assert.match(main, /directorReverse/);
  assert.match(main, /directorLoop/);
  assert.match(main, /directorCollapse/);
  assert.doesNotMatch(main, /directorStop/);
  assert.doesNotMatch(main, /directorHold/);
});

test('director sidebar shows the active scene card after global controls', async () => {
  const ui = await readFile(new URL('../director-ui.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(ui, /Activa mode Director/);
  assert.match(ui, /data-director-action="add"[\s\S]*Nova escena/);
  assert.match(ui, /director-scene-toolbar/);
  assert.match(ui, /director-scene-card/);
  assert.match(ui, /Escena \$\{escapeHtml\(active\.name\)\}/);
  assert.match(ui, /<span>Moviment<\/span>/);
  assert.match(ui, /<span>Durada total<\/span>/);
  assert.match(ui, /<span>Durada transició<\/span>/);
  assert.match(ui, /<span>Estil transició<\/span>/);
  assert.match(ui, /director-duration-field/);
  assert.match(ui, />seg<\/span>/);
  assert.doesNotMatch(ui, />segons<\/span>/);
  assert.match(ui, /data-director-action="add"[\s\S]*director-scene-card/);
  assert.match(ui, /director-scene-card[\s\S]*data-director-action="delete"/);
  assert.doesNotMatch(ui, /director-scene-actions/);
  assert.match(css, /\.director-scene-toolbar/);
  assert.match(css, /\.director-scene-card/);
  assert.match(css, /\.director-duration-field/);
  assert.match(css, /\.director-duration-field input[\s\S]*width:/);
  assert.match(css, /border-top: 1px solid var\(--paper-3\)/);
});

test('director movement selection still exposes movement parameters and adjustments', async () => {
  const ui = await readFile(new URL('../director-ui.js', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(ui, /director-movement-settings/);
  assert.match(ui, /data-behavior-id/);
  assert.match(ui, /<span>intensity<\/span>/);
  assert.match(ui, /<span>cohesion<\/span>/);
  assert.match(main, /updateBehavior/);
  assert.match(main, /onUpdateBehavior:/);
  assert.match(css, /\.director-movement-settings/);
});
