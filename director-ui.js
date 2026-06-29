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

const BEHAVIOR_LABELS = Object.freeze({
  drift: 'Deriva', orbit: 'Òrbita', attract: 'Atracció', explode: 'Explosió',
});
const MOVEMENT_OPTIONS = Object.entries(BEHAVIOR_LABELS);

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
 *   onSceneAction, onSceneDuration, onSceneMovement, onTransitionChange,
 *   onAddKeyframe,
 * })
 * Returns { render, setTime }
 */
export function mountDirectorUI({
  inspector, timeline, getState,
  onSelectScene, onSeek, onToggleEnabled,
  onSceneAction, onSceneDuration, onSceneMovement, onTransitionChange,
  onToggleKeyframe, onRemoveKeyframe,
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
  function buildSceneInspector(active) {
    if (!active) { sceneEditEl.innerHTML = ''; return; }
    const movement = active.behaviors[0]?.type || '';
    const movementOptions = MOVEMENT_OPTIONS.map(([value, label]) => `
      <option value="${value}"${movement === value ? ' selected' : ''}>${label}</option>
    `).join('');

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

    if (reverseBtn) reverseBtn.setAttribute('aria-pressed', String((state.directorRate ?? 1) < 0));
    if (loopBtn) loopBtn.setAttribute('aria-pressed', String(vm.director.loop !== false));
    if (collapseBtn) collapseBtn.setAttribute('aria-expanded', String(!document.body.hasAttribute('data-director-collapsed')));

    // Rebuild scene radiogroup
    buildScenes(vm);

    // Rebuild scene inspector
    const localTime = Math.max(0, (vm.time ?? 0) - (vm.activeScene?.start ?? 0));
    buildSceneInspector(vm.activeScene);

    // Rebuild automation lanes
    buildLanes(vm.activeScene, localTime);
  }

  // ── setTime(time, sceneId) ─────────────────────────────────────────────────
  function setTime(time, sceneId) {
    // Toggle .is-playing on the matching radio
    const radios = scenesEl.querySelectorAll('[role="radio"]');
    radios.forEach((btn) => {
      btn.classList.toggle('is-playing', btn.dataset.sceneId === sceneId);
    });
  }

  return { render, setTime };
}
