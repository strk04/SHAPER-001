import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('preset capture and apply include director data', async () => {
  const source = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  const presetState = await readFile(new URL('../preset-state.js', import.meta.url), 'utf8');
  assert.match(source, /captureCreativePreset\(state,\s*Object\.keys\(SLIDERS\)\)/);
  assert.match(presetState, /'director'/);
  assert.match(presetState, /'cameraEnabled'/);
  assert.match(presetState, /'customOutline'/);
  assert.match(source, /state\.director\s*=\s*normalizeDirector\(p\.director\)/);
  assert.match(source, /syncCameraToggleUI\(\)/);
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

test('director has a single timeline, no scene management', async () => {
  const ui = await readFile(new URL('../director-ui.js', import.meta.url), 'utf8');
  const director = await readFile(new URL('../director.js', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /data-director-action/);
  assert.doesNotMatch(ui, /Nova escena/);
  assert.doesNotMatch(director, /scenes:/);
  assert.doesNotMatch(director, /applySceneAction/);
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

test('director sidebar shows a single duration field, no scene/transition fields', async () => {
  const ui = await readFile(new URL('../director-ui.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(ui, /Activa mode Director/);
  assert.match(ui, /id="directorDuration"/);
  assert.match(ui, /<span>Durada<\/span>/);
  assert.doesNotMatch(ui, /Durada total/);
  assert.doesNotMatch(ui, /Durada transició/);
  assert.doesNotMatch(ui, /Estil transició/);
  assert.match(ui, /director-duration-field/);
  assert.match(ui, />seg<\/span>/);
  assert.doesNotMatch(ui, />segons<\/span>/);
  assert.match(css, /\.director-duration-field/);
  assert.match(css, /\.director-duration-field input[\s\S]*width:/);
});

test('director scene exposes a grouped list of concrete effects', async () => {
  const ui = await readFile(new URL('../director-ui.js', import.meta.url), 'utf8');
  const director = await readFile(new URL('../director.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(ui, /director-effects-group/);
  assert.match(ui, /<details class="director-effects-group"/);
  assert.match(ui, /data-effect-path/);
  assert.match(director, /charTrack: 'number', leading: 'number', wrapMode: 'hold'/);
  assert.match(director, /EFFECT_GROUPS/);
  assert.match(css, /\.director-effect\b/);
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
  assert.match(ui, /syncPlayhead\(playheadEl, vm\.duration, vm\.time \?\? 0\)/);
  assert.match(ui, /syncPlayhead\(playheadEl, duration, time\)/);
  assert.match(ui, /onSelectEffect/);
  assert.match(ui, /onUpdateEffect/);
  assert.match(ui, /contextmenu/);
  assert.match(ui, /pointerdown/);
  assert.match(ui, /onSeek\(/);
  assert.match(main, /selectedDirectorEffect/);
  assert.match(css, /\.director-inline-timeline/);
  assert.match(css, /\.director-keyframe-label/);
  assert.match(css, /\.director-keyframe-value/);
  assert.match(css, /\.director-keyframe-label\s*\{[\s\S]*font-size:\s*var\(--text-xs\)/);
  assert.match(css, /\.director-keyframe-value\s*\{[\s\S]*font-size:\s*var\(--text-xs\)/);
  assert.match(css, /\.director-track/);
  assert.doesNotMatch(css, /\.director-scene\s*\{/);
  assert.doesNotMatch(css, /\.director-scenes\s*\{/);
});

test('director effect editor offers a shape/mode picker and easing durations', async () => {
  const ui = await readFile(new URL('../director-ui.js', import.meta.url), 'utf8');
  assert.match(ui, /function buildValueField/);
  assert.match(ui, /AUTOMATABLE_PARAMS\[name\] === 'hold'/);
  assert.match(ui, /<select id="directorEffectValue"/);
  assert.match(ui, /<span>Easing entrada<\/span>/);
  assert.match(ui, /<span>Easing sortida<\/span>/);
  assert.doesNotMatch(ui, /Estil transició/);
});

test('fixed-duration MP4 export renders offline outside Director', async () => {
  const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(main, /resolveOfflineAnimationState/);
  assert.match(main, /function drawResolvedState/);
  assert.match(main, /if \(!Number\.isNaN\(dur\)\)[\s\S]*encodeDirectorFrames/);
  assert.match(main, /drawResolvedState\(resolveOfflineAnimationState\(baseExportState, time, fps\)\)/);
});
