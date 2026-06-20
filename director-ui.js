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

// ── Helpers ──────────────────────────────────────────────────────────────────

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

// ── DOM Mount ────────────────────────────────────────────────────────────────

/**
 * mountDirectorUI({ inspector, timeline, getState, onSelectScene, onSeek, onToggleEnabled })
 * Returns { render, setTime }
 */
export function mountDirectorUI({ inspector, timeline, getState, onSelectScene, onSeek, onToggleEnabled }) {
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
  `;

  // ── Timeline ───────────────────────────────────────────────────────────────
  timeline.innerHTML = `
    <div class="director-scenes" role="radiogroup" aria-label="Escenes" id="directorScenes"></div>
  `;

  // Element refs
  const enabledCb   = inspector.querySelector('#directorEnabled');
  const sceneNameEl = inspector.querySelector('#directorSceneName');
  const timeOutput  = inspector.querySelector('#directorTimeOutput');
  const playhead    = inspector.querySelector('#directorPlayhead');
  const scenesEl    = timeline.querySelector('#directorScenes');

  // ── Listener: enabled checkbox ─────────────────────────────────────────────
  enabledCb.addEventListener('change', () => {
    onToggleEnabled(enabledCb.checked);
  });

  // ── Listener: playhead seek ────────────────────────────────────────────────
  playhead.addEventListener('input', () => {
    onSeek(Number(playhead.value));
  });

  // ── Scene radiogroup: build + roving tabindex + keyboard ──────────────────
  function buildScenes(vm) {
    const { scenes, activeScene, duration } = vm;
    scenesEl.innerHTML = '';

    scenes.forEach((scene, idx) => {
      const isChecked = scene.id === activeScene.id;
      const pct = duration > 0 ? (scene.duration / duration) * 100 : (100 / scenes.length);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.role = 'radio';
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

      // Click → select
      btn.addEventListener('click', () => {
        onSelectScene(scene.id);
      });

      scenesEl.appendChild(btn);
    });

    // Keyboard roving: ArrowRight/Down, ArrowLeft/Up, Home, End
    // Attach once on the container (event delegation)
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
    // Focus will be moved after render rebuilds the buttons; to be safe, focus immediately
    nextScene.focus();
  });

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
