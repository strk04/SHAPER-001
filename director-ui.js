// director-ui.js — Pure model + DOM mount for the Director panel
import { normalizeDirector, totalDuration } from './director.js';

// ── Pure view model ─────────────────────────────────────────────────────────

export function directorViewModel(input, selectedSceneId, time) {
  const director = normalizeDirector(input);
  let cursor = 0;
  const scenes = director.scenes.map((scene) => {
    const item = { ...scene, start: cursor, end: cursor + scene.duration };
    cursor += scene.duration;
    return item;
  });
  return {
    director,
    scenes,
    duration: totalDuration(director),
    time,
    activeScene: scenes.find((scene) => scene.id === selectedSceneId) || scenes[0],
  };
}

// ── Behavior fields map ──────────────────────────────────────────────────────

const BEHAVIOR_FIELDS = Object.freeze({
  drift: ['angle', 'elevation', 'distance', 'speed', 'phase'],
  orbit: ['centerX', 'centerY', 'centerZ', 'radius', 'speed', 'phase', 'depth', 'spread'],
  attract: ['targetX', 'targetY', 'targetZ', 'strength', 'radius', 'falloff'],
  explode: ['centerX', 'centerY', 'centerZ', 'distance', 'spread', 'progress'],
});

// Display names (Catalan) for behavior types; internal id/type stays English.
const BEHAVIOR_LABELS = Object.freeze({
  drift: 'Deriva', orbit: 'Òrbita', attract: 'Atracció', explode: 'Explosió',
});
const behaviorLabel = (type) => BEHAVIOR_LABELS[type] || type;

// Maps AUTOMATABLE_PARAMS key → actual element id in index.html / built by buildSliders()
export const AUTOMATION_CONTROL_IDS = Object.freeze({
  morphT: 'rng-morphT',
  morphSpeed: 'rng-morphSpeed',
  morphScatter: 'rng-morphScatter',
  morphSpeedVar: 'rng-morphSpeedVar',
  zoom: 'rng-zoom',
  angleX: 'rng-angleX',
  angleY: 'rng-angleY',
  depthFade: 'rng-depthFade',
  formSize: 'rng-formSize',
  pulse: 'rng-pulse',
  noiseTexture: 'rng-noiseTexture',
  textColor: 'textColor',
  bgColor: 'bgColor',
  form: 'form',
  projection: 'projection',
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

// ── DOM Mount ────────────────────────────────────────────────────────────────

/**
 * mountDirectorUI({
 *   inspector, timeline, getState,
 *   onSelectScene, onSeek, onToggleEnabled,
 *   onSceneAction, onSceneDuration, onTransitionChange,
 *   onAddBehavior, onUpdateBehavior, onRemoveBehavior, onAddKeyframe,
 * })
 * Returns { render, setTime }
 */
export function mountDirectorUI({
  inspector, timeline, getState,
  onSelectScene, onSeek, onToggleEnabled,
  onSceneAction, onSceneDuration, onTransitionChange,
  onAddBehavior, onUpdateBehavior, onRemoveBehavior, onToggleKeyframe, onRemoveKeyframe,
}) {
  if (!inspector || !timeline) return { render: () => {}, setTime: () => {} };

  // ── Inspector ──────────────────────────────────────────────────────────────
  inspector.innerHTML = `
    <h3 class="panel-title">Director</h3>
    <label class="control-row" for="directorEnabled">
      <span>Activa</span>
      <input type="checkbox" id="directorEnabled" name="directorEnabled">
    </label>
    <p class="director-scene-name" id="directorSceneName" aria-live="off"></p>
    <output id="directorTimeOutput" aria-live="off"></output>
    <label class="sr-only" for="directorPlayhead">Temps del Director</label>
    <input id="directorPlayhead" type="range" min="0" max="0" step="0.01" value="0" aria-valuetext="0.00 s de 0.00 s">
    <div id="directorSceneEditArea"></div>
    <div class="director-general" role="group" aria-label="Opcions generals del Director">
      <h4 class="panel-title">General</h4>
      <div class="director-general-actions">
        <button type="button" id="directorReverse" aria-pressed="false">Reverse</button>
        <button type="button" id="directorLoop" aria-pressed="true">Loop</button>
        <button type="button" id="directorCollapse" aria-expanded="true" aria-controls="directorTimeline">Timeline</button>
      </div>
    </div>
    <div id="directorStatus" aria-live="polite" class="sr-only"></div>
  `;

  // ── Timeline ───────────────────────────────────────────────────────────────
  timeline.innerHTML = `
    <div class="director-scenes" role="radiogroup" aria-label="Escenes" id="directorScenes"></div>
    <div id="directorLanes" class="director-lanes"></div>
  `;

  // Element refs
  const enabledCb   = inspector.querySelector('#directorEnabled');
  const sceneNameEl = inspector.querySelector('#directorSceneName');
  const timeOutput  = inspector.querySelector('#directorTimeOutput');
  const playhead    = inspector.querySelector('#directorPlayhead');
  const sceneEditEl = inspector.querySelector('#directorSceneEditArea');
  const reverseBtn  = inspector.querySelector('#directorReverse');
  const loopBtn     = inspector.querySelector('#directorLoop');
  const collapseBtn = inspector.querySelector('#directorCollapse');
  const scenesEl    = timeline.querySelector('#directorScenes');
  const lanesEl     = timeline.querySelector('#directorLanes');

  // ── Listener: enabled checkbox ─────────────────────────────────────────────
  enabledCb.addEventListener('change', () => {
    onToggleEnabled(enabledCb.checked);
  });

  // ── Listener: playhead seek ────────────────────────────────────────────────
  playhead.addEventListener('input', () => {
    onSeek(Number(playhead.value));
  });

  // ── Inspector: scene action buttons + properties (delegated) ─────────────
  inspector.addEventListener('click', (event) => {
    const actionBtn = event.target.closest('[data-director-action]');
    if (actionBtn && onSceneAction) {
      onSceneAction(actionBtn.dataset.directorAction);
      return;
    }
    const addBehaviorBtn = event.target.closest('[data-add-behavior]');
    if (addBehaviorBtn && onAddBehavior) {
      onAddBehavior(addBehaviorBtn.dataset.addBehavior);
      return;
    }
    const removeBehaviorBtn = event.target.closest('[data-remove-behavior]');
    if (removeBehaviorBtn && onRemoveBehavior) {
      onRemoveBehavior(removeBehaviorBtn.dataset.removeBehavior);
      return;
    }
    const addKeyframeBtn = event.target.closest('[data-keyframe-path]');
    if (addKeyframeBtn && onToggleKeyframe) {
      onToggleKeyframe(addKeyframeBtn.dataset.keyframePath, addKeyframeBtn.dataset.keyframeField);
    }
  });

  // Live readout for intensity/cohesion sliders while dragging (no re-render, no SR chatter).
  inspector.addEventListener('input', (event) => {
    const { target } = event;
    const field = target.dataset?.behaviorField;
    if (target.type !== 'range' || (field !== 'intensity' && field !== 'cohesion')) return;
    const txt = Number(target.value).toFixed(2);
    target.setAttribute('aria-valuetext', txt);
    const out = target.parentElement?.querySelector('output.director-value');
    if (out) out.textContent = txt;
  });

  inspector.addEventListener('change', (event) => {
    const { target } = event;
    if (target.id === 'directorSceneDuration' && onSceneDuration) {
      onSceneDuration(Number(target.value));
      return;
    }
    if (target.id === 'directorTransitionDuration' && onTransitionChange) {
      onTransitionChange({ duration: Number(target.value) });
      return;
    }
    if (target.id === 'directorTransitionEasing' && onTransitionChange) {
      onTransitionChange({ easing: target.value });
      return;
    }
    const behaviorIntensity = target.closest('[data-behavior-id]');
    if (behaviorIntensity && target.dataset.behaviorField && onUpdateBehavior) {
      const id = behaviorIntensity.dataset.behaviorId;
      if (target.dataset.behaviorField === 'intensity') {
        onUpdateBehavior(id, { intensity: Number(target.value) });
      } else if (target.dataset.behaviorField === 'cohesion') {
        onUpdateBehavior(id, { cohesion: Number(target.value) });
      } else if (target.dataset.behaviorField) {
        onUpdateBehavior(id, { params: { [target.dataset.behaviorField]: Number(target.value) } });
      }
    }
  });

  // ── Timeline keyframe delete ───────────────────────────────────────────────
  lanesEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-keyframe-path][data-keyframe-time]');
    if (!btn || !onRemoveKeyframe) return;
    const path = btn.dataset.keyframePath;
    const time = Number(btn.dataset.keyframeTime);
    const label = btn.getAttribute('aria-label') || `Keyframe ${path} a ${time.toFixed(2)} s`;
    const focusTarget = btn.nextElementSibling ?? btn.previousElementSibling ?? btn.closest('.director-keyframes');
    onRemoveKeyframe(path, time);
    focusTarget?.focus();
    const statusEl = inspector.querySelector('#directorStatus');
    if (statusEl) statusEl.textContent = `${label} eliminat.`;
  });

  // ── Scene radiogroup: build + roving tabindex + keyboard ──────────────────
  function buildScenes(vm) {
    const { scenes, activeScene, duration } = vm;
    scenesEl.innerHTML = '';

    scenes.forEach((scene) => {
      const isChecked = scene.id === activeScene.id;
      const pct = duration > 0 ? (scene.duration / duration) * 100 : (100 / scenes.length);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.className = 'director-scene' + (isChecked ? ' is-active' : '');
      btn.dataset.sceneId = scene.id;
      btn.setAttribute('aria-checked', String(isChecked));
      if (isChecked) btn.setAttribute('aria-current', 'true');
      btn.setAttribute('tabindex', isChecked ? '0' : '-1');
      btn.style.width = `${pct}%`;

      if (isChecked) {
        btn.innerHTML = `<span class="director-scene-dot" aria-hidden="true">●</span>${escapeHtml(scene.name)}`;
      } else {
        btn.textContent = scene.name;
      }

      btn.addEventListener('click', () => {
        onSelectScene(scene.id);
      });

      scenesEl.appendChild(btn);
    });
  }

  // Arrow-key navigation on the radiogroup container
  scenesEl.addEventListener('keydown', (event) => {
    const radios = Array.from(scenesEl.querySelectorAll('[role="radio"]'));
    if (!radios.length) return;
    const currentIdx = radios.findIndex((r) => r.getAttribute('aria-checked') === 'true');

    let nextIdx = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIdx = (currentIdx + 1) % radios.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIdx = (currentIdx - 1 + radios.length) % radios.length;
    } else if (event.key === 'Home') {
      nextIdx = 0;
    } else if (event.key === 'End') {
      nextIdx = radios.length - 1;
    }

    if (nextIdx === null) return;
    event.preventDefault();

    const nextScene = radios[nextIdx];
    const sceneId = nextScene.dataset.sceneId;
    onSelectScene(sceneId);
    nextScene.focus();
  });

  // ── Build scene inspector panel ────────────────────────────────────────────
  function buildSceneInspector(active, localTime) {
    if (!active) { sceneEditEl.innerHTML = ''; return; }

    const behaviorRows = active.behaviors.map((behavior) => {
      const label = behaviorLabel(behavior.type);
      if (behavior.unsupported) {
        return `<div class="director-behavior-item" role="group" aria-label="Comportament ${escapeHtml(label)}">
          <span>${escapeHtml(label)} — <em>no compatible</em></span>
        </div>`;
      }
      const fields = BEHAVIOR_FIELDS[behavior.type] || [];
      const fieldInputs = fields.map((field) => {
        const kfPath = `behavior:${behavior.id}:${field}`;
        const frames = active.automations[kfPath];
        const hasKf = Array.isArray(frames) && frames.some((f) => Math.abs(f.time - localTime) <= 0.0001);
        return `
        <label class="control-row" for="bfield-${escapeHtml(behavior.id)}-${field}">
          <span>${escapeHtml(field)}</span>
          <span class="director-field-input">
            <input id="bfield-${escapeHtml(behavior.id)}-${field}"
              type="number" step="any"
              value="${Number.isFinite(behavior.params[field]) ? behavior.params[field] : 0}"
              data-behavior-field="${escapeHtml(field)}">
            <button type="button" class="automation-key-button"
              data-keyframe-path="${escapeHtml(kfPath)}"
              data-keyframe-field="${escapeHtml(field)}"
              aria-label="Keyframe a ${escapeHtml(field)}"
              aria-pressed="${hasKf}">
              <span aria-hidden="true"></span>
            </button>
          </span>
        </label>`;
      }).join('');
      const intensityTxt = Number(behavior.intensity).toFixed(2);
      const cohesionTxt = Number(behavior.cohesion).toFixed(2);
      return `<div class="director-behavior-item" role="group" aria-label="Comportament ${escapeHtml(label)}" data-behavior-id="${escapeHtml(behavior.id)}">
        <div class="director-behavior-header">
          <strong>${escapeHtml(label)}</strong>
          <button type="button" data-remove-behavior="${escapeHtml(behavior.id)}"
            aria-label="Elimina comportament ${escapeHtml(label)}">Elimina</button>
        </div>
        <label class="control-row" for="bintensity-${escapeHtml(behavior.id)}">
          <span>intensity</span>
          <span class="director-field-input">
            <input id="bintensity-${escapeHtml(behavior.id)}" type="range" min="0" max="1" step="0.01"
              value="${behavior.intensity}" data-behavior-field="intensity"
              aria-valuetext="${intensityTxt}">
            <output class="director-value" for="bintensity-${escapeHtml(behavior.id)}" aria-live="off">${intensityTxt}</output>
          </span>
        </label>
        <label class="control-row" for="bcohesion-${escapeHtml(behavior.id)}">
          <span>cohesion</span>
          <span class="director-field-input">
            <input id="bcohesion-${escapeHtml(behavior.id)}" type="range" min="0" max="1" step="0.01"
              value="${behavior.cohesion}" data-behavior-field="cohesion"
              aria-valuetext="${cohesionTxt}">
            <output class="director-value" for="bcohesion-${escapeHtml(behavior.id)}" aria-live="off">${cohesionTxt}</output>
          </span>
        </label>
        ${fieldInputs}
      </div>`;
    }).join('');

    sceneEditEl.innerHTML = `
      <div class="director-scene-actions" role="group" aria-label="Accions d'escena">
        <button type="button" data-director-action="add" aria-label="Afegeix escena"><span aria-hidden="true">+</span> Afegeix</button>
        <button type="button" data-director-action="delete" aria-label="Elimina escena">Elimina</button>
      </div>
      <div role="group" aria-label="Propietats de l'escena">
        <label class="control-row" for="directorSceneDuration"><span>Durada</span>
          <input id="directorSceneDuration" type="number" min="0.1" max="3600" step="0.1" inputmode="decimal"
            value="${active.duration}" aria-describedby="directorDurationUnit">
        </label>
        <span id="directorDurationUnit" class="control-unit">segons</span>
        <label class="control-row" for="directorTransitionDuration"><span>Transició</span>
          <input id="directorTransitionDuration" type="number" min="0" max="${active.duration}" step="0.1" inputmode="decimal"
            value="${active.transition.duration}" aria-describedby="directorTransitionUnit">
        </label>
        <span id="directorTransitionUnit" class="control-unit">segons</span>
        <label class="control-row" for="directorTransitionEasing"><span>Easing</span>
          <select id="directorTransitionEasing">
            <option value="linear"${active.transition.easing === 'linear' ? ' selected' : ''}>linear</option>
            <option value="ease-in"${active.transition.easing === 'ease-in' ? ' selected' : ''}>ease-in</option>
            <option value="ease-out"${active.transition.easing === 'ease-out' ? ' selected' : ''}>ease-out</option>
            <option value="ease-in-out"${active.transition.easing === 'ease-in-out' ? ' selected' : ''}>ease-in-out</option>
          </select>
        </label>
      </div>
      <div class="director-behavior-palette" role="group" aria-label="Afegeix comportament">
        <button type="button" data-add-behavior="drift">Deriva</button>
        <button type="button" data-add-behavior="orbit">Òrbita</button>
        <button type="button" data-add-behavior="attract">Atracció</button>
        <button type="button" data-add-behavior="explode">Explosió</button>
      </div>
      ${behaviorRows}
    `;
  }

  // ── Build automation lanes in timeline ────────────────────────────────────
  function buildLanes(active, localTime) {
    if (!active || !lanesEl) return;
    const lt = localTime ?? 0;
    const lanes = Object.entries(active.automations).map(([path, frames]) => {
      const label = path.startsWith('param:') ? path.slice(6)
        : path.startsWith('behavior:') ? path.split(':').slice(1).join(' · ')
        : path;
      const sorted = [...frames].sort((a, b) => a.time - b.time);
      const buttons = sorted.map((frame) => {
        const isCurrent = Math.abs(frame.time - lt) <= 0.0001;
        const valStr = typeof frame.value === 'number' ? ` = ${frame.value.toFixed(2)}` : (frame.value != null ? ` = ${frame.value}` : '');
        return `<button type="button" class="director-keyframe${isCurrent ? ' is-current' : ''}"
          style="left:${(frame.time / active.duration) * 100}%"
          data-keyframe-path="${escapeHtml(path)}"
          data-keyframe-time="${frame.time}"
          data-current="${isCurrent}"
          aria-label="Elimina keyframe ${escapeHtml(label)}${escapeHtml(valStr)} a ${frame.time.toFixed(2)} s">
          <span aria-hidden="true"></span>
        </button>`;
      }).join('');
      return `<div class="director-lane" data-lane-path="${escapeHtml(path)}">
        <span class="director-lane-label">${escapeHtml(label)}</span>
        <div class="director-keyframes" tabindex="-1">${buttons}</div>
      </div>`;
    }).join('');
    lanesEl.innerHTML = lanes;
  }

  // ── render() ──────────────────────────────────────────────────────────────
  function render() {
    const state = getState();
    const vm = directorViewModel(
      state.director,
      state.selectedDirectorSceneId,
      state.directorTime ?? 0,
    );

    // Enabled checkbox
    enabledCb.checked = !!vm.director.enabled;

    // Active scene name
    sceneNameEl.textContent = vm.activeScene ? vm.activeScene.name : '';

    if (reverseBtn) reverseBtn.setAttribute('aria-pressed', String((state.directorRate ?? 1) < 0));
    if (loopBtn) loopBtn.setAttribute('aria-pressed', String(vm.director.loop !== false));
    if (collapseBtn) collapseBtn.setAttribute('aria-expanded', String(!document.body.hasAttribute('data-director-collapsed')));

    // Time output
    const time = vm.time ?? 0;
    const dur  = vm.duration;
    timeOutput.textContent = `${time.toFixed(2)} s / ${dur.toFixed(2)} s`;

    // Playhead max + value + aria-valuetext
    playhead.max = String(dur);
    if (document.activeElement !== playhead) {
      playhead.value = String(time);
    }
    playhead.setAttribute('aria-valuetext', `${time.toFixed(2)} s de ${dur.toFixed(2)} s`);

    // Rebuild scene radiogroup
    buildScenes(vm);

    // Rebuild scene inspector
    const localTime = Math.max(0, (vm.time ?? 0) - (vm.activeScene?.start ?? 0));
    buildSceneInspector(vm.activeScene, localTime);

    // Rebuild automation lanes
    buildLanes(vm.activeScene, localTime);
  }

  // ── setTime(time, sceneId) ─────────────────────────────────────────────────
  function setTime(time, sceneId) {
    const state = getState();
    const vm = directorViewModel(
      state.director,
      sceneId || state.selectedDirectorSceneId,
      time,
    );
    const dur = vm.duration;
    const t   = time ?? 0;

    // Always update aria-valuetext and output text
    const valuetext = `${t.toFixed(2)} s de ${dur.toFixed(2)} s`;
    playhead.setAttribute('aria-valuetext', valuetext);
    timeOutput.textContent = `${t.toFixed(2)} s / ${dur.toFixed(2)} s`;
    sceneNameEl.textContent = vm.activeScene ? vm.activeScene.name : '';

    // Only write playhead.value when it is NOT the focused element (avoids SR flooding)
    if (document.activeElement !== playhead) {
      playhead.max   = String(dur);
      playhead.value = String(t);
    }

    // Toggle .is-playing on the matching radio
    const radios = scenesEl.querySelectorAll('[role="radio"]');
    radios.forEach((btn) => {
      btn.classList.toggle('is-playing', btn.dataset.sceneId === sceneId);
    });
  }

  return { render, setTime };
}
