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

const BEHAVIOR_FIELDS = Object.freeze({
  drift: ['angle', 'elevation', 'distance', 'speed', 'phase'],
  orbit: ['centerX', 'centerY', 'centerZ', 'radius', 'speed', 'phase', 'depth', 'spread'],
  attract: ['targetX', 'targetY', 'targetZ', 'strength', 'radius', 'falloff'],
  explode: ['centerX', 'centerY', 'centerZ', 'distance', 'spread', 'progress'],
});

const BEHAVIOR_LABELS = Object.freeze({
  drift: 'Deriva', orbit: 'Òrbita', attract: 'Atracció', explode: 'Explosió',
});
const MOVEMENT_OPTIONS = Object.entries(BEHAVIOR_LABELS);
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

const shortSceneLabel = (index) => `E${String(index + 1).padStart(2, '0')}`;

const keyframeLabel = (path) => {
  if (path.startsWith('param:')) return path.slice(6);
  if (path.startsWith('behavior:')) return path.split(':')[2] || path;
  return path;
};

const keyframeValue = (value) => {
  if (typeof value === 'number') {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  }
  if (value == null || value === '') return '—';
  return String(value);
};

const syncPlayhead = (playheadEl, duration, time) => {
  if (!playheadEl) return;
  const pct = duration > 0 ? Math.max(0, Math.min(100, ((time ?? 0) / duration) * 100)) : 0;
  playheadEl.style.left = `${pct}%`;
};

// ── DOM Mount ────────────────────────────────────────────────────────────────

/**
 * mountDirectorUI({
 *   inspector, timeline, getState,
 *   onSelectScene, onSeek, onToggleEnabled,
 *   onSceneAction, onSceneDuration, onSceneMovement, onTransitionChange,
 *   onAddKeyframe, onUpdateBehavior,
 * })
 * Returns { render, setTime }
 */
export function mountDirectorUI({
  inspector, timeline, getState,
  onSelectScene, onSeek, onToggleEnabled,
  onSceneAction, onSceneDuration, onSceneMovement, onTransitionChange,
  onUpdateBehavior, onToggleKeyframe, onRemoveKeyframe,
}) {
  if (!inspector || !timeline) return { render: () => {}, setTime: () => {} };

  // ── Inspector ──────────────────────────────────────────────────────────────
  inspector.innerHTML = `
    <h3 class="panel-title">Director</h3>
    <label class="control-row" for="directorEnabled">
      <span>Activa mode Director</span>
      <input type="checkbox" id="directorEnabled" name="directorEnabled">
    </label>
    <div id="directorSceneEditArea"></div>
    <div class="director-general" role="group" aria-label="Opcions generals del Director">
      <h4 class="panel-title">General</h4>
      <div class="director-general-actions">
        <button type="button" id="directorReverse" aria-pressed="false">Reverse</button>
        <button type="button" id="directorLoop" aria-pressed="true">Loop</button>
      </div>
    </div>
    <div id="directorStatus" aria-live="polite" class="sr-only"></div>
  `;

  // ── Timeline ───────────────────────────────────────────────────────────────
  timeline.innerHTML = `
    <div class="director-inline-timeline">
      <div class="director-scenes-wrap">
        <div class="director-scenes" role="radiogroup" aria-label="Escenes" id="directorScenes"></div>
        <div id="directorPlayhead" class="director-playhead" aria-hidden="true"></div>
      </div>
      <div id="directorLanes" class="director-lanes"></div>
    </div>
  `;

  // Element refs
  const enabledCb   = inspector.querySelector('#directorEnabled');
  const sceneEditEl = inspector.querySelector('#directorSceneEditArea');
  const reverseBtn  = inspector.querySelector('#directorReverse');
  const loopBtn     = inspector.querySelector('#directorLoop');
  const scenesEl    = timeline.querySelector('#directorScenes');
  const playheadEl  = timeline.querySelector('#directorPlayhead');
  const lanesEl     = timeline.querySelector('#directorLanes');

  // ── Listener: enabled checkbox ─────────────────────────────────────────────
  enabledCb.addEventListener('change', () => {
    onToggleEnabled(enabledCb.checked);
  });

  // ── Listener: playhead seek ────────────────────────────────────────────────
  // ── Inspector: scene action buttons + properties (delegated) ─────────────
  inspector.addEventListener('click', (event) => {
    const actionBtn = event.target.closest('[data-director-action]');
    if (actionBtn && onSceneAction) {
      onSceneAction(actionBtn.dataset.directorAction);
      return;
    }
    const addKeyframeBtn = event.target.closest('[data-keyframe-path]');
    if (addKeyframeBtn && onToggleKeyframe) {
      onToggleKeyframe(addKeyframeBtn.dataset.keyframePath, addKeyframeBtn.dataset.keyframeField);
    }
  });

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
    if (target.id === 'directorSceneBehavior' && onSceneMovement) {
      onSceneMovement(target.value);
      return;
    }
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
    const movementSettings = target.closest('[data-behavior-id]');
    if (movementSettings && target.dataset.behaviorField && onUpdateBehavior) {
      const id = movementSettings.dataset.behaviorId;
      if (target.dataset.behaviorField === 'intensity') {
        onUpdateBehavior(id, { intensity: Number(target.value) });
      } else if (target.dataset.behaviorField === 'cohesion') {
        onUpdateBehavior(id, { cohesion: Number(target.value) });
      } else {
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

    scenes.forEach((scene, index) => {
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
      btn.setAttribute('aria-label', `${scene.name}, ${scene.duration.toFixed(1)} segons`);
      btn.innerHTML = `<span class="director-scene-label">${shortSceneLabel(index)}</span>`;

      btn.addEventListener('click', () => {
        onSelectScene(scene.id);
      });

      scenesEl.appendChild(btn);
    });

    syncPlayhead(playheadEl, duration, vm.time ?? 0);
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
  function buildSceneInspector(active) {
    if (!active) { sceneEditEl.innerHTML = ''; return; }
    const behavior = active.behaviors[0] || null;
    const movement = behavior?.type || '';
    const movementOptions = MOVEMENT_OPTIONS.map(([value, label]) => `
      <option value="${value}"${movement === value ? ' selected' : ''}>${label}</option>
    `).join('');
    let movementSettings = '';
    if (behavior) {
      const fields = BEHAVIOR_FIELDS[behavior.type] || [];
      const fieldInputs = fields.map((field) => {
        const kfPath = `behavior:${behavior.id}:${field}`;
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
                aria-pressed="false">
                <span aria-hidden="true"></span>
              </button>
            </span>
          </label>`;
      }).join('');
      const intensityTxt = Number(behavior.intensity).toFixed(2);
      const cohesionTxt = Number(behavior.cohesion).toFixed(2);
      movementSettings = `
        <div class="director-movement-settings director-behavior-item" role="group" aria-label="Ajustos del moviment ${escapeHtml(behaviorLabel(behavior.type))}" data-behavior-id="${escapeHtml(behavior.id)}">
          <h5 class="director-settings-title">Ajustos</h5>
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
        </div>
      `;
    }

    sceneEditEl.innerHTML = `
      <div class="director-scene-toolbar" role="group" aria-label="Accions globals d'escena">
        <button type="button" data-director-action="add" aria-label="Nova escena">Nova escena</button>
      </div>
      <div class="director-scene-card" role="group" aria-label="Propietats de l'escena">
        <h4 class="panel-title">Escena ${escapeHtml(active.name)}</h4>
        <label class="control-row" for="directorSceneBehavior"><span>Moviment</span>
          <select id="directorSceneBehavior">
            ${movementOptions}
          </select>
        </label>
        <label class="control-row" for="directorSceneDuration"><span>Durada total</span>
          <span class="director-duration-field">
            <input id="directorSceneDuration" type="number" min="0.1" max="3600" step="0.1" inputmode="decimal"
              value="${active.duration}" aria-describedby="directorDurationUnit">
            <span id="directorDurationUnit" class="director-inline-unit">seg</span>
          </span>
        </label>
        <label class="control-row" for="directorTransitionDuration"><span>Durada transició</span>
          <span class="director-duration-field">
            <input id="directorTransitionDuration" type="number" min="0" max="${active.duration}" step="0.1" inputmode="decimal"
              value="${active.transition.duration}" aria-describedby="directorTransitionUnit">
            <span id="directorTransitionUnit" class="director-inline-unit">seg</span>
          </span>
        </label>
        <label class="control-row" for="directorTransitionEasing"><span>Estil transició</span>
          <select id="directorTransitionEasing">
            <option value="hold"${active.transition.easing === 'hold' ? ' selected' : ''}>hold</option>
            <option value="linear"${active.transition.easing === 'linear' ? ' selected' : ''}>linear</option>
            <option value="ease-in"${active.transition.easing === 'ease-in' ? ' selected' : ''}>ease-in</option>
            <option value="ease-out"${active.transition.easing === 'ease-out' ? ' selected' : ''}>ease-out</option>
            <option value="ease-in-out"${active.transition.easing === 'ease-in-out' ? ' selected' : ''}>ease-in-out</option>
          </select>
        </label>
        <div class="director-scene-card-actions">
          <button type="button" data-director-action="delete" aria-label="Elimina escena">Elimina</button>
        </div>
      </div>
      ${movementSettings}
    `;
  }

  // ── Build automation lanes in timeline ────────────────────────────────────
  function buildLanes(vm, active, localTime) {
    if (!active || !lanesEl) return;
    const lt = localTime ?? 0;
    const total = vm.duration || active.duration || 1;
    const entries = Object.entries(active.automations).flatMap(([path, frames]) => {
      const label = keyframeLabel(path);
      return [...frames]
        .sort((a, b) => a.time - b.time)
        .map((frame) => ({
          path,
          time: frame.time,
          isCurrent: Math.abs(frame.time - lt) <= 0.0001,
          label,
          value: keyframeValue(frame.value),
          left: ((active.start + frame.time) / total) * 100,
        }));
    }).sort((a, b) => a.left - b.left || a.time - b.time);

    if (!entries.length) {
      lanesEl.innerHTML = '';
      return;
    }

    const rows = [];
    const minGap = 9;
    const buttons = entries.map((entry) => {
      let row = rows.findIndex((lastLeft) => entry.left - lastLeft >= minGap);
      if (row === -1) {
        row = rows.length;
        rows.push(entry.left);
      } else {
        rows[row] = entry.left;
      }
      return `<button type="button" class="director-keyframe${entry.isCurrent ? ' is-current' : ''}"
        style="left:${entry.left}%; --director-keyframe-row:${row};"
        data-keyframe-path="${escapeHtml(entry.path)}"
        data-keyframe-time="${entry.time}"
        data-current="${entry.isCurrent}"
        aria-label="Elimina keyframe ${escapeHtml(entry.label)} ${escapeHtml(entry.value)} a ${entry.time.toFixed(2)} s">
        <span aria-hidden="true" class="director-keyframe-diamond"></span>
        <span class="director-keyframe-label">${escapeHtml(entry.label)}</span>
        <span class="director-keyframe-value">${escapeHtml(entry.value)}</span>
      </button>`;
    }).join('');

    lanesEl.innerHTML = `<div class="director-keyframes" style="--director-keyframe-rows:${Math.max(rows.length, 1)}" tabindex="-1">${buttons}</div>`;
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

    if (reverseBtn) reverseBtn.setAttribute('aria-pressed', String((state.directorRate ?? 1) < 0));
    if (loopBtn) loopBtn.setAttribute('aria-pressed', String(vm.director.loop !== false));

    // Rebuild scene radiogroup
    buildScenes(vm);

    // Rebuild scene inspector
    const localTime = Math.max(0, (vm.time ?? 0) - (vm.activeScene?.start ?? 0));
    buildSceneInspector(vm.activeScene);

    // Rebuild automation lanes
    buildLanes(vm, vm.activeScene, localTime);
  }

  // ── setTime(time, sceneId) ─────────────────────────────────────────────────
  function setTime(time, sceneId) {
    // Toggle .is-playing on the matching radio
    const radios = scenesEl.querySelectorAll('[role="radio"]');
    radios.forEach((btn) => {
      btn.classList.toggle('is-playing', btn.dataset.sceneId === sceneId);
    });
    const state = getState();
    const duration = totalDuration(state.director);
    syncPlayhead(playheadEl, duration, time);
  }

  return { render, setTime };
}
