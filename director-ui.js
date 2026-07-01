// director-ui.js — Pure model + DOM mount for the Director panel (single timeline)
import { normalizeDirector, totalDuration, EFFECT_GROUPS } from './director.js';

// ── Pure view model ─────────────────────────────────────────────────────────

export function directorViewModel(input, time) {
  const director = normalizeDirector(input);
  return {
    director,
    duration: totalDuration(director),
    time,
  };
}

const EFFECT_LABELS = Object.freeze({
  charTrack: 'Kerning', leading: 'Interlínia', wrapMode: "Aplicació de l'àtom",
  form: 'Forma', formSize: 'Mida de forma', aspect: 'Proporció',
  rotXSpeed: 'Rotació X', rotYSpeed: 'Rotació Y', rotZSpeed: 'Rotació Z', angleX: 'Angle X', angleY: 'Angle Y',
  speed3d: 'Velocitat', rainProb: 'Probabilitat de pluja', rainSpeed: 'Velocitat de pluja',
});

// Maps AUTOMATABLE_PARAMS key → actual element id in index.html / built by buildSliders()
export const AUTOMATION_CONTROL_IDS = Object.freeze({
  charTrack: 'rng-charTrack',
  leading: 'rng-leading',
  wrapMode: 'wrapMode',
  form: 'form',
  formSize: 'rng-formSize',
  aspect: 'rng-aspect',
  rotXSpeed: 'rng-rotXSpeed',
  rotYSpeed: 'rng-rotYSpeed',
  rotZSpeed: 'rng-rotZSpeed',
  angleX: 'rng-angleX',
  angleY: 'rng-angleY',
  speed3d: 'rng-speed3d',
  rainProb: 'rng-rainProb',
  rainSpeed: 'rng-rainSpeed',
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const keyframeLabel = (path) => {
  const name = path.startsWith('param:') ? path.slice(6) : path;
  return EFFECT_LABELS[name] || name;
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

const timeText = (seconds) => {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const rem = (s % 60).toFixed(1);
  return `${m}:${rem.padStart(4, '0')}`;
};

const keyframeInputType = (value) => typeof value === 'number' ? 'number' : 'text';

const findSelectedKeyframe = (state, director) => {
  const selected = state.selectedDirectorKeyframe;
  if (!selected || !director) return null;
  const frames = director.automations?.[selected.path] || [];
  const frame = frames.find((item) => Math.abs(item.time - selected.time) <= 0.0001);
  return frame ? { ...selected, frame } : null;
};

// ── DOM Mount ────────────────────────────────────────────────────────────────

/**
 * mountDirectorUI({
 *   inspector, timeline, getState,
 *   onSeek, onToggleEnabled, onDurationChange,
 *   onToggleKeyframe, onSelectKeyframe, onUpdateKeyframe, onRemoveKeyframe,
 * })
 * Returns { render, setTime }
 */
export function mountDirectorUI({
  inspector, timeline, getState,
  onSeek, onToggleEnabled, onDurationChange,
  onToggleKeyframe, onSelectKeyframe, onUpdateKeyframe, onRemoveKeyframe,
}) {
  if (!inspector || !timeline) return { render: () => {}, setTime: () => {} };

  // ── Inspector ──────────────────────────────────────────────────────────────
  inspector.innerHTML = `
    <h3 class="panel-title">Director</h3>
    <label class="control-row" for="directorEnabled">
      <span>Activa mode Director</span>
      <input type="checkbox" id="directorEnabled" name="directorEnabled">
    </label>
    <label class="control-row" for="directorDuration"><span>Durada</span>
      <span class="director-duration-field">
        <input id="directorDuration" type="number" min="0.1" max="3600" step="0.1" inputmode="decimal" aria-describedby="directorDurationUnit">
        <span id="directorDurationUnit" class="director-inline-unit">seg</span>
      </span>
    </label>
    <div id="directorEffectsArea"></div>
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
        <div class="director-track" id="directorTrack" role="slider" tabindex="0"
          aria-label="Línia de temps del Director" aria-valuemin="0" aria-valuenow="0"></div>
        <div id="directorPlayhead" class="director-playhead" aria-hidden="true"></div>
      </div>
      <div id="directorLanes" class="director-lanes"></div>
      <div id="directorKeyframeMenu" class="director-keyframe-menu" hidden></div>
    </div>
  `;

  // Element refs
  const enabledCb    = inspector.querySelector('#directorEnabled');
  const durationInput = inspector.querySelector('#directorDuration');
  const effectsAreaEl = inspector.querySelector('#directorEffectsArea');
  const reverseBtn   = inspector.querySelector('#directorReverse');
  const loopBtn      = inspector.querySelector('#directorLoop');
  const trackEl      = timeline.querySelector('#directorTrack');
  const playheadEl   = timeline.querySelector('#directorPlayhead');
  const lanesEl      = timeline.querySelector('#directorLanes');
  const keyframeMenuEl = timeline.querySelector('#directorKeyframeMenu');
  let playheadDragging = false;
  let trackDragging = false;

  // ── Listener: enabled checkbox ─────────────────────────────────────────────
  enabledCb.addEventListener('change', () => {
    onToggleEnabled(enabledCb.checked);
  });

  // ── Inspector: keyframe actions + properties (delegated) ─────────────
  inspector.addEventListener('click', (event) => {
    const deleteKeyframeBtn = event.target.closest('[data-director-keyframe-delete]');
    if (deleteKeyframeBtn && onRemoveKeyframe) {
      onRemoveKeyframe(deleteKeyframeBtn.dataset.keyframePath, Number(deleteKeyframeBtn.dataset.keyframeTime));
      return;
    }
    const addKeyframeBtn = event.target.closest('[data-keyframe-path]');
    if (addKeyframeBtn && onToggleKeyframe) {
      onToggleKeyframe(addKeyframeBtn.dataset.keyframePath, addKeyframeBtn.dataset.keyframeField);
    }
  });

  inspector.addEventListener('change', (event) => {
    const { target } = event;
    if (target.dataset.keyframeEditorPath && onUpdateKeyframe) {
      const path = target.dataset.keyframeEditorPath;
      const time = Number(target.dataset.keyframeEditorTime);
      if (target.id === 'directorKeyframeTime') {
        onUpdateKeyframe(path, time, { time: Number(target.value) });
        return;
      }
      if (target.id === 'directorKeyframeValue') {
        const value = target.type === 'number' ? Number(target.value) : target.value;
        onUpdateKeyframe(path, time, { value });
        return;
      }
      if (target.id === 'directorKeyframeEasing') {
        onUpdateKeyframe(path, time, { easing: target.value });
        return;
      }
    }
    if (target.id === 'directorDuration' && onDurationChange) {
      onDurationChange(Number(target.value));
      return;
    }
  });

  const hideKeyframeMenu = () => {
    if (!keyframeMenuEl) return;
    keyframeMenuEl.hidden = true;
    keyframeMenuEl.innerHTML = '';
  };

  const seekFromClientX = (clientX) => {
    const rect = trackEl.getBoundingClientRect();
    if (!(rect.width > 0)) return;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const duration = totalDuration(getState().director);
    onSeek(pct * duration);
  };

  playheadEl?.addEventListener('pointerdown', (event) => {
    playheadDragging = true;
    playheadEl.setPointerCapture(event.pointerId);
    seekFromClientX(event.clientX);
    event.preventDefault();
  });

  playheadEl?.addEventListener('pointermove', (event) => {
    if (!playheadDragging) return;
    seekFromClientX(event.clientX);
  });

  playheadEl?.addEventListener('pointerup', (event) => {
    playheadDragging = false;
    playheadEl.releasePointerCapture?.(event.pointerId);
  });

  playheadEl?.addEventListener('pointercancel', () => {
    playheadDragging = false;
  });

  trackEl?.addEventListener('pointerdown', (event) => {
    trackDragging = true;
    trackEl.setPointerCapture(event.pointerId);
    seekFromClientX(event.clientX);
  });

  trackEl?.addEventListener('pointermove', (event) => {
    if (!trackDragging) return;
    seekFromClientX(event.clientX);
  });

  trackEl?.addEventListener('pointerup', (event) => {
    trackDragging = false;
    trackEl.releasePointerCapture?.(event.pointerId);
  });

  trackEl?.addEventListener('pointercancel', () => {
    trackDragging = false;
  });

  trackEl?.addEventListener('keydown', (event) => {
    const duration = totalDuration(getState().director);
    const time = getState().directorTime ?? 0;
    const step = event.shiftKey ? 1 : 0.1;
    if (event.key === 'ArrowRight') { onSeek(Math.min(duration, time + step)); event.preventDefault(); }
    else if (event.key === 'ArrowLeft') { onSeek(Math.max(0, time - step)); event.preventDefault(); }
    else if (event.key === 'Home') { onSeek(0); event.preventDefault(); }
    else if (event.key === 'End') { onSeek(duration); event.preventDefault(); }
  });

  // ── Timeline keyframe select / menu ────────────────────────────────────────
  lanesEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-keyframe-path][data-keyframe-time]');
    hideKeyframeMenu();
    if (!btn || !onSelectKeyframe) return;
    onSelectKeyframe(btn.dataset.keyframePath, Number(btn.dataset.keyframeTime));
    btn.focus();
  });

  lanesEl.addEventListener('contextmenu', (event) => {
    const btn = event.target.closest('[data-keyframe-path][data-keyframe-time]');
    if (!btn || !keyframeMenuEl) return;
    event.preventDefault();
    const path = btn.dataset.keyframePath;
    const time = Number(btn.dataset.keyframeTime);
    onSelectKeyframe?.(path, time);
    keyframeMenuEl.hidden = false;
    keyframeMenuEl.style.left = `${event.clientX}px`;
    keyframeMenuEl.style.top = `${event.clientY}px`;
    keyframeMenuEl.innerHTML = `<button type="button" data-menu-delete data-keyframe-path="${escapeHtml(path)}" data-keyframe-time="${time}">Eliminar</button>`;
  });

  keyframeMenuEl?.addEventListener('click', (event) => {
    const deleteBtn = event.target.closest('[data-menu-delete]');
    if (!deleteBtn || !onRemoveKeyframe) return;
    onRemoveKeyframe(deleteBtn.dataset.keyframePath, Number(deleteBtn.dataset.keyframeTime));
    hideKeyframeMenu();
  });

  document.addEventListener('click', (event) => {
    if (!keyframeMenuEl || keyframeMenuEl.hidden) return;
    if (event.target.closest('.director-keyframe-menu')) return;
    hideKeyframeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideKeyframeMenu();
  });

  // ── Build effects list ─────────────────────────────────────────────────────
  const slugify = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  function buildEffectsList(director, time) {
    const t = time ?? 0;
    return EFFECT_GROUPS.map((group) => {
      const groupId = `directorEffectsGroup-${slugify(group.title)}`;
      const items = group.items.map((name) => {
        const path = `param:${name}`;
        const frames = director.automations[path] || [];
        const isCurrent = frames.some((frame) => Math.abs(frame.time - t) <= 0.0001);
        const hasAny = frames.length > 0;
        const label = EFFECT_LABELS[name] || name;
        return `
          <button type="button" class="director-effect${hasAny ? ' has-keyframes' : ''}"
            data-keyframe-path="${escapeHtml(path)}"
            data-keyframe-field="${escapeHtml(name)}"
            aria-pressed="${isCurrent}"
            aria-label="Keyframe a ${escapeHtml(label)}"
            ${hasAny ? 'aria-describedby="directorEffectsHasKeyframesHint"' : ''}>
            <span aria-hidden="true" class="director-effect-dot"></span>
            <span class="director-effect-label">${escapeHtml(label)}</span>
          </button>`;
      }).join('');
      return `
        <div class="director-effects-group" role="group" aria-labelledby="${groupId}">
          <h5 class="director-settings-title" id="${groupId}">${escapeHtml(group.title)}</h5>
          <div class="director-effects-row">${items}</div>
        </div>`;
    }).join('');
  }

  function buildEffectsArea(director, selectedKeyframe, time) {
    const effectsList = buildEffectsList(director, time);

    let keyframeEditor = '';
    if (selectedKeyframe) {
      const { path, time: kfTime, frame } = selectedKeyframe;
      const inputType = keyframeInputType(frame.value);
      keyframeEditor = `
        <div class="director-keyframe-editor director-behavior-item" role="group" aria-label="Edició del rombo">
          <h5 class="director-settings-title">Rombo</h5>
          <label class="control-row"><span>Paràmetre</span>
            <output class="director-keyframe-readonly">${escapeHtml(keyframeLabel(path))}</output>
          </label>
          <label class="control-row" for="directorKeyframeValue"><span>Valor</span>
            <input id="directorKeyframeValue" type="${inputType}" ${inputType === 'number' ? 'step="any"' : ''}
              value="${escapeHtml(frame.value ?? '')}"
              data-keyframe-editor-path="${escapeHtml(path)}"
              data-keyframe-editor-time="${kfTime}">
          </label>
          <label class="control-row" for="directorKeyframeTime"><span>Temps</span>
            <span class="director-duration-field">
              <input id="directorKeyframeTime" type="number" min="0" max="${director.duration}" step="0.1" inputmode="decimal"
                value="${kfTime}"
                data-keyframe-editor-path="${escapeHtml(path)}"
                data-keyframe-editor-time="${kfTime}">
              <span class="director-inline-unit">seg</span>
            </span>
          </label>
          <label class="control-row" for="directorKeyframeEasing"><span>Easing</span>
            <select id="directorKeyframeEasing"
              data-keyframe-editor-path="${escapeHtml(path)}"
              data-keyframe-editor-time="${kfTime}">
              <option value="hold"${frame.easing === 'hold' ? ' selected' : ''}>hold</option>
              <option value="linear"${frame.easing === 'linear' ? ' selected' : ''}>linear</option>
              <option value="ease-in"${frame.easing === 'ease-in' ? ' selected' : ''}>ease-in</option>
              <option value="ease-out"${frame.easing === 'ease-out' ? ' selected' : ''}>ease-out</option>
              <option value="ease-in-out"${frame.easing === 'ease-in-out' ? ' selected' : ''}>ease-in-out</option>
            </select>
          </label>
          <div class="director-scene-card-actions">
            <button type="button" data-director-keyframe-delete data-keyframe-path="${escapeHtml(path)}" data-keyframe-time="${kfTime}">Eliminar</button>
          </div>
        </div>
      `;
    }

    effectsAreaEl.innerHTML = `
      <div class="director-effects" role="group" aria-labelledby="directorEffectsTitle">
        <h4 class="panel-title" id="directorEffectsTitle">Efectes</h4>
        <p id="directorEffectsHasKeyframesHint" class="sr-only">Aquest efecte ja té algun fotograma clau en un altre instant de la línia de temps.</p>
        ${effectsList}
      </div>
      ${keyframeEditor}
    `;
  }

  // ── Build automation lanes in timeline ────────────────────────────────────
  function buildLanes(director, time, total) {
    if (!lanesEl) return;
    const t = time ?? 0;
    const selected = getState().selectedDirectorKeyframe;
    const entries = Object.entries(director.automations).flatMap(([path, frames]) => {
      const label = keyframeLabel(path);
      return [...frames]
        .sort((a, b) => a.time - b.time)
        .map((frame) => ({
          path,
          time: frame.time,
          isCurrent: Math.abs(frame.time - t) <= 0.0001,
          isSelected: selected?.path === path && Math.abs(selected.time - frame.time) <= 0.0001,
          label,
          value: keyframeValue(frame.value),
          left: (frame.time / total) * 100,
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
      return `<button type="button" class="director-keyframe${entry.isCurrent ? ' is-current' : ''}${entry.isSelected ? ' is-selected' : ''}"
        style="left:${entry.left}%; --director-keyframe-row:${row};"
        data-keyframe-path="${escapeHtml(entry.path)}"
        data-keyframe-time="${entry.time}"
        data-current="${entry.isCurrent}"
        aria-label="Edita keyframe ${escapeHtml(entry.label)} ${escapeHtml(entry.value)} a ${entry.time.toFixed(2)} s">
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
    const vm = directorViewModel(state.director, state.directorTime ?? 0);
    const selectedKeyframe = findSelectedKeyframe(state, vm.director);

    // Enabled checkbox + duration field
    enabledCb.checked = !!vm.director.enabled;
    if (document.activeElement !== durationInput) durationInput.value = vm.director.duration;
    trackEl?.setAttribute('aria-valuemax', String(vm.duration));
    trackEl?.setAttribute('aria-valuenow', String(vm.time ?? 0));
    trackEl?.setAttribute('aria-valuetext', timeText(vm.time ?? 0));

    if (reverseBtn) reverseBtn.setAttribute('aria-pressed', String((state.directorRate ?? 1) < 0));
    if (loopBtn) loopBtn.setAttribute('aria-pressed', String(vm.director.loop !== false));

    // Rebuild effects + keyframe editor
    buildEffectsArea(vm.director, selectedKeyframe, vm.time ?? 0);

    // Rebuild automation lanes
    buildLanes(vm.director, vm.time ?? 0, vm.duration || 1);

    syncPlayhead(playheadEl, vm.duration, vm.time ?? 0);
  }

  // ── setTime(time) ─────────────────────────────────────────────────────────
  function setTime(time) {
    const state = getState();
    const duration = totalDuration(state.director);
    syncPlayhead(playheadEl, duration, time);
    trackEl?.setAttribute('aria-valuenow', String(time));
    trackEl?.setAttribute('aria-valuetext', timeText(time));
  }

  return { render, setTime };
}
