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
  assert.match(html, /id="directorTimelineHost"/);
  assert.match(html, /id="directorTimeline"/);
  assert.doesNotMatch(html, /id="directorDock"/);
  assert.doesNotMatch(html, /id="directorResize"/);
  assert.match(css, /\.director-timeline-host/);
  assert.match(engine, /applyMotionBehaviors/);
  assert.match(engine, /clockMs/);
});

test('surface color controls are wired through UI state and presets', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /id="surfaceColor"/);
  assert.match(html, /data-key="surfaceTransparency"/);
  assert.match(main, /surfaceTransparency:\s*\{\s*label:\s*'Transparència superfície'/);
  assert.match(main, /surfaceColor:\s*'#d8d8d8'/);
  assert.match(main, /\$\('surfaceColor'\)\.addEventListener\('input'/);
  assert.match(main, /'surfaceColor'/);
  assert.match(main, /\$\('surfaceColor'\)\.value\s*=\s*state\.surfaceColor/);
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
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /id="directorStop"/);
  assert.doesNotMatch(html, /id="directorHold"/);
  assert.doesNotMatch(html, /id="directorReverse"/);
  assert.doesNotMatch(html, /id="directorLoop"/);
  assert.doesNotMatch(html, /id="directorCollapse"/);
  assert.doesNotMatch(html, /director-transport/);
  assert.match(ui, /id="directorReverse"/);
  assert.match(ui, /id="directorLoop"/);
  assert.doesNotMatch(ui, /id="directorCollapse"/);
  assert.match(main, /directorReverse/);
  assert.match(main, /directorLoop/);
  assert.doesNotMatch(main, /directorCollapse/);
  assert.doesNotMatch(main, /directorResize/);
  assert.doesNotMatch(main, /directorDock/);
  assert.doesNotMatch(main, /directorStop/);
  assert.doesNotMatch(main, /directorHold/);
  assert.match(css, /\.director-general-actions button\[aria-pressed="true"\][\s\S]*background:\s*var\(--ink\)/);
  assert.match(css, /\.director-general-actions button\[aria-pressed="true"\][\s\S]*color:\s*var\(--paper\)/);
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

test('director timeline is inline under canvas and shows keyframe label plus value', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../director-ui.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /<section id="directorTimelineHost" class="director-timeline-host" aria-label="Timeline del Director">/);
  assert.match(ui, /director-inline-timeline/);
  assert.match(ui, /director-keyframe-label/);
  assert.match(ui, /director-keyframe-value/);
  assert.match(ui, /director-keyframe-editor/);
  assert.match(ui, /director-keyframe-menu/);
  assert.doesNotMatch(ui, /director-lane-label/);
  assert.doesNotMatch(ui, /Sense rombos en aquesta escena\./);
  assert.match(ui, /const syncPlayhead = \(playheadEl, duration, time\) =>/);
  assert.match(ui, /playheadEl\.style\.left = `\$\{pct\}%`/);
  assert.match(ui, /syncPlayhead\(playheadEl, duration, vm\.time \?\? 0\)/);
  assert.match(ui, /syncPlayhead\(playheadEl, duration, time\)/);
  assert.match(ui, /onSelectKeyframe/);
  assert.match(ui, /onUpdateKeyframe/);
  assert.match(ui, /contextmenu/);
  assert.match(ui, /pointerdown/);
  assert.match(ui, /onSeek\(/);
  assert.match(main, /selectedDirectorKeyframe/);
  assert.match(css, /\.director-inline-timeline/);
  assert.match(css, /\.director-keyframe-label/);
  assert.match(css, /\.director-keyframe-value/);
  assert.match(css, /\.director-scene-label\s*\{[\s\S]*font-size:\s*var\(--text-xs\)/);
  assert.match(css, /\.director-keyframe-label\s*\{[\s\S]*font-size:\s*var\(--text-xs\)/);
  assert.match(css, /\.director-keyframe-value\s*\{[\s\S]*font-size:\s*var\(--text-xs\)/);
  assert.match(css, /\.director-scene::after/);
  assert.match(css, /\.director-scene:first-child::before/);
});
