// director-ui.js — Pure model + DOM mount for the Director panel
import { normalizeDirector, totalDuration } from './director.js';

// ── Live pads mount (Task 8) ─────────────────────────────────────────────────

/**
 * mountLivePads(container, { onLiveStart, onLiveEnd })
 * Renders ATTRACT / REPEL / EXPLODE pads into container and wires:
 *   - Pointer: pointerdown → start + setPointerCapture; pointerup + pointercancel → end
 *   - Keyboard: keydown Space/Enter (no repeat) → start; keyup Space/Enter → end
 *   - Force-release: element blur → end; window blur → end ALL held pads
 *   - aria-pressed reflects held state; no latch-on possible after focus/window loss
 */
export function mountLivePads(container, { onLiveStart, onLiveEnd } = {}) {
  if (!container) return;

  const PAD_DEFS = [
    { type: 'attract', value: 1,  label: 'ATTRACT' },
    { type: 'attract', value: -1, label: 'REPEL'   },
    { type: 'explode', value: 1,  label: 'EXPLODE' },
  ];

  // Track which pads are currently held so window-blur can clear all
  const heldPads = new Set(); // Set<{ el, type }>

  container.innerHTML = '';

  for (const def of PAD_DEFS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'director-pad';
    btn.dataset.liveBehavior = def.type;
    btn.dataset.liveValue = String(def.value);
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = def.label;

    const entry = { el: btn, type: def.type };

    const start = () => {
      if (btn.getAttribute('aria-pressed') === 'true') return; // already held
      btn.setAttribute('aria-pressed', 'true');
      heldPads.add(entry);
      onLiveStart?.(def.type, def.value);
    };

    const end = () => {
      if (btn.getAttribute('aria-pressed') === 'false') return; // already released
      btn.setAttribute('aria-pressed', 'false');
      heldPads.delete(entry);
      onLiveEnd?.(def.type);
    };

    // ── Pointer events ────────────────────────────────────────────────────────
    btn.addEventListener('pointerdown', (e) => {
      start();
      if (e.pointerId != null) {
        try { btn.setPointerCapture(e.pointerId); } catch (_) { /* ignore if already captured */ }
      }
    });

    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);

    // ── Keyboard events ───────────────────────────────────────────────────────
    btn.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (e.repeat) return; // ignore held key auto-repeat
      e.preventDefault();
      start();
    });

    btn.addEventListener('keyup', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      end();
    });

    // ── Force-release on element blur (prevents stuck-on) ─────────────────────
    btn.addEventListener('blur', end);

    container.appendChild(btn);
  }

  // ── Force-release ALL held pads on window blur ────────────────────────────
  window.addEventListener('blur', () => {
    for (const entry of [...heldPads]) {
      entry.el.setAttribute('aria-pressed', 'false');
      heldPads.delete(entry);
      onLiveEnd?.(entry.type);
    }
  });
}

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
  onAddBehavior, onUpdateBehavior, onRemoveBehavior, onAddKeyframe,
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
    if (addKeyframeBtn && onAddKeyframe) {
      onAddKeyframe(addKeyframeBtn.dataset.keyframePath, addKeyframeBtn.dataset.keyframeField);
    }
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

    const behaviorRows = active.behaviors.map((behavior) => {
      if (behavior.unsupported) {
        return `<div class="director-behavior-item" role="group" aria-label="Comportament ${escapeHtml(behavior.type)}">
          <span>${escapeHtml(behavior.type)} — <em>no compatible</em></span>
        </div>`;
      }
      const fields = BEHAVIOR_FIELDS[behavior.type] || [];
      const fieldInputs = fields.map((field) => `
        <label class="control-row" for="bfield-${escapeHtml(behavior.id)}-${field}">
          <span>${escapeHtml(field)}</span>
          <input id="bfield-${escapeHtml(behavior.id)}-${field}"
            type="number" step="any"
            value="${Number.isFinite(behavior.params[field]) ? behavior.params[field] : 0}"
            data-behavior-field="${escapeHtml(field)}">
          <button type="button" class="automation-key-button"
            data-keyframe-path="behavior:${escapeHtml(behavior.id)}:${escapeHtml(field)}"
            data-keyframe-field="${escapeHtml(field)}"
            aria-label="Afegeix keyframe a ${escapeHtml(field)}">
            <span aria-hidden="true">◇</span>
          </button>
        </label>`).join('');
      return `<div class="director-behavior-item" role="group" aria-label="Comportament ${escapeHtml(behavior.type)}" data-behavior-id="${escapeHtml(behavior.id)}">
        <div class="director-behavior-header">
          <strong>${escapeHtml(behavior.type)}</strong>
          <button type="button" data-remove-behavior="${escapeHtml(behavior.id)}"
            aria-label="Elimina comportament ${escapeHtml(behavior.type)}">Elimina</button>
        </div>
        <label class="control-row" for="bintensity-${escapeHtml(behavior.id)}">
          <span>intensity</span>
          <input id="bintensity-${escapeHtml(behavior.id)}" type="range" min="0" max="1" step="0.01"
            value="${behavior.intensity}" data-behavior-field="intensity">
        </label>
        <label class="control-row" for="bcohesion-${escapeHtml(behavior.id)}">
          <span>cohesion</span>
          <input id="bcohesion-${escapeHtml(behavior.id)}" type="range" min="0" max="1" step="0.01"
            value="${behavior.cohesion}" data-behavior-field="cohesion">
        </label>
        ${fieldInputs}
      </div>`;
    }).join('');

    sceneEditEl.innerHTML = `
      <div class="director-scene-actions" role="group" aria-label="Accions d'escena">
        <button type="button" data-director-action="add" aria-label="Afegeix escena"><span aria-hidden="true">+</span> Afegeix</button>
        <button type="button" data-director-action="duplicate" aria-label="Duplica escena">Duplica</button>
        <button type="button" data-director-action="left" aria-label="Mou escena a l'esquerra"><span aria-hidden="true">←</span></button>
        <button type="button" data-director-action="right" aria-label="Mou escena a la dreta"><span aria-hidden="true">→</span></button>
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
  function buildLanes(active) {
    if (!active || !lanesEl) return;
    const lanes = Object.entries(active.automations).map(([path, frames]) => `
      <div class="director-lane" data-lane-path="${escapeHtml(path)}">
        <span>${escapeHtml(path)}</span>
        <div class="director-keyframes">${frames.map((frame) => `<button type="button" class="director-keyframe" style="left:${(frame.time / active.duration) * 100}%" aria-label="${escapeHtml(path)} a ${frame.time.toFixed(2)} segons"></button>`).join('')}</div>
      </div>
    `).join('');
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
    buildSceneInspector(vm.activeScene);

    // Rebuild automation lanes
    buildLanes(vm.activeScene);
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
