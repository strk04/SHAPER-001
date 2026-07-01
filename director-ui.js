// director-ui.js — Pure model + DOM mount for the Director panel (single timeline, hold segments)
import { normalizeDirector, totalDuration, EFFECT_GROUPS, AUTOMATABLE_PARAMS, DEFAULT_EASE_LENGTH } from './director.js';

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

const DEFAULT_SEGMENT_LENGTH = 1;

// ── Helpers ──────────────────────────────────────────────────────────────────

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const effectLabel = (path) => {
  const name = path.startsWith('param:') ? path.slice(6) : path;
  return EFFECT_LABELS[name] || name;
};

const effectValue = (value) => {
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

const effectInputType = (value) => typeof value === 'number' ? 'number' : 'text';

const findSelectedEffect = (state, director) => {
  const selected = state.selectedDirectorEffect;
  if (!selected || !director) return null;
  const segments = director.automations?.[selected.path] || [];
  const segment = segments.find((item) => Math.abs(item.start - selected.start) <= 0.0001);
  return segment ? { ...selected, segment } : null;
};

// ── DOM Mount ────────────────────────────────────────────────────────────────

/**
 * mountDirectorUI({
 *   inspector, timeline, getState,
 *   onSeek, onToggleEnabled, onDurationChange,
 *   onToggleEffect, onSelectEffect, onUpdateEffect, onRemoveEffect,
 * })
 * Returns { render, setTime }
 */
export function mountDirectorUI({
  inspector, timeline, getState,
  onSeek, onToggleEnabled, onDurationChange,
  onToggleEffect, onSelectEffect, onUpdateEffect, onRemoveEffect,
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
      <div id="directorEffectMenu" class="director-keyframe-menu" hidden></div>
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
  const effectMenuEl = timeline.querySelector('#directorEffectMenu');
  let playheadDragging = false;
  let trackDragging = false;

  // ── Listener: enabled checkbox ─────────────────────────────────────────────
  enabledCb.addEventListener('change', () => {
    onToggleEnabled(enabledCb.checked);
  });

  // ── Inspector: effect actions + properties (delegated) ─────────────
  inspector.addEventListener('click', (event) => {
    const deleteBtn = event.target.closest('[data-director-effect-delete]');
    if (deleteBtn && onRemoveEffect) {
      onRemoveEffect(deleteBtn.dataset.effectPath, Number(deleteBtn.dataset.effectStart));
      return;
    }
    const addBtn = event.target.closest('[data-effect-path]');
    if (addBtn && onToggleEffect) {
      onToggleEffect(addBtn.dataset.effectPath, addBtn.dataset.effectField);
    }
  });

  inspector.addEventListener('change', (event) => {
    const { target } = event;
    if (target.dataset.effectEditorPath && onUpdateEffect) {
      const path = target.dataset.effectEditorPath;
      const start = Number(target.dataset.effectEditorStart);
      if (target.id === 'directorEffectStart') {
        onUpdateEffect(path, start, { start: Number(target.value) });
        return;
      }
      if (target.id === 'directorEffectEnd') {
        onUpdateEffect(path, start, { end: Number(target.value) });
        return;
      }
      if (target.id === 'directorEffectValue') {
        const value = target.type === 'number' ? Number(target.value) : target.value;
        onUpdateEffect(path, start, { value });
        return;
      }
      if (target.id === 'directorEffectEaseIn') {
        onUpdateEffect(path, start, { easeIn: Number(target.value) });
        return;
      }
      if (target.id === 'directorEffectEaseOut') {
        onUpdateEffect(path, start, { easeOut: Number(target.value) });
        return;
      }
    }
    if (target.id === 'directorDuration' && onDurationChange) {
      onDurationChange(Number(target.value));
      return;
    }
  });

  const hideEffectMenu = () => {
    if (!effectMenuEl) return;
    effectMenuEl.hidden = true;
    effectMenuEl.innerHTML = '';
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

  // ── Timeline effect segment select / menu ──────────────────────────────────
  lanesEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-effect-path][data-effect-start]');
    hideEffectMenu();
    if (!btn || !onSelectEffect) return;
    onSelectEffect(btn.dataset.effectPath, Number(btn.dataset.effectStart));
    btn.focus();
  });

  lanesEl.addEventListener('contextmenu', (event) => {
    const btn = event.target.closest('[data-effect-path][data-effect-start]');
    if (!btn || !effectMenuEl) return;
    event.preventDefault();
    const path = btn.dataset.effectPath;
    const start = Number(btn.dataset.effectStart);
    onSelectEffect?.(path, start);
    effectMenuEl.hidden = false;
    effectMenuEl.style.left = `${event.clientX}px`;
    effectMenuEl.style.top = `${event.clientY}px`;
    effectMenuEl.innerHTML = `<button type="button" data-menu-delete data-effect-path="${escapeHtml(path)}" data-effect-start="${start}">Eliminar</button>`;
  });

  effectMenuEl?.addEventListener('click', (event) => {
    const deleteBtn = event.target.closest('[data-menu-delete]');
    if (!deleteBtn || !onRemoveEffect) return;
    onRemoveEffect(deleteBtn.dataset.effectPath, Number(deleteBtn.dataset.effectStart));
    hideEffectMenu();
  });

  document.addEventListener('click', (event) => {
    if (!effectMenuEl || effectMenuEl.hidden) return;
    if (event.target.closest('.director-keyframe-menu')) return;
    hideEffectMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideEffectMenu();
  });

  // ── Build effects list (collapsible groups) ────────────────────────────────
  const slugify = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  function buildEffectsList(director, time) {
    const t = time ?? 0;
    return EFFECT_GROUPS.map((group) => {
      const groupId = `directorEffectsGroup-${slugify(group.title)}`;
      const items = group.items.map((name) => {
        const path = `param:${name}`;
        const segments = director.automations[path] || [];
        const isCurrent = segments.some((seg) => t >= seg.start && t <= seg.end);
        const hasAny = segments.length > 0;
        const label = EFFECT_LABELS[name] || name;
        const actionLabel = isCurrent
          ? `${label}: edita el segment en aquest instant`
          : `${label}: crea un segment en aquest instant`;
        return `
          <button type="button" class="director-effect${hasAny ? ' has-keyframes' : ''}"
            data-effect-path="${escapeHtml(path)}"
            data-effect-field="${escapeHtml(name)}"
            aria-pressed="${isCurrent}"
            aria-label="${escapeHtml(actionLabel)}"
            ${hasAny ? 'aria-describedby="directorEffectsHasKeyframesHint"' : ''}>
            <span aria-hidden="true" class="director-effect-dot"></span>
            <span class="director-effect-label">${escapeHtml(label)}</span>
          </button>`;
      }).join('');
      return `
        <details class="director-effects-group" id="${groupId}">
          <summary class="director-settings-title">${escapeHtml(group.title)}</summary>
          <div class="director-effects-row">${items}</div>
        </details>`;
    }).join('');
  }

  // Effects whose value is a discrete choice (a shape id, a wrap mode) get a <select> in the
  // editor cloned from the live control's own <option> list, instead of a freeform text input.
  function buildValueField(path, segment) {
    const name = path.startsWith('param:') ? path.slice(6) : path;
    const editorAttrs = `data-effect-editor-path="${escapeHtml(path)}" data-effect-editor-start="${segment.start}"`;
    if (AUTOMATABLE_PARAMS[name] === 'hold') {
      const sourceEl = document.getElementById(AUTOMATION_CONTROL_IDS[name]);
      const options = sourceEl && sourceEl.tagName === 'SELECT' ? Array.from(sourceEl.options) : [];
      const optionsHtml = options.map((opt) => `<option value="${escapeHtml(opt.value)}"${opt.value === String(segment.value) ? ' selected' : ''}>${escapeHtml(opt.textContent)}</option>`).join('');
      return `<select id="directorEffectValue" ${editorAttrs}>${optionsHtml}</select>`;
    }
    const inputType = effectInputType(segment.value);
    return `<input id="directorEffectValue" type="${inputType}" ${inputType === 'number' ? 'step="any"' : ''}
      value="${escapeHtml(segment.value ?? '')}" ${editorAttrs}>`;
  }

  function buildEffectsArea(director, selectedEffect, time) {
    const effectsList = buildEffectsList(director, time);

    let effectEditor = '';
    if (selectedEffect) {
      const { path, segment } = selectedEffect;
      const name = path.startsWith('param:') ? path.slice(6) : path;
      const span = Math.max(0, segment.end - segment.start);
      const canEase = AUTOMATABLE_PARAMS[name] !== 'hold';
      const easingFields = canEase ? `
          <label class="control-row" for="directorEffectEaseIn"><span>Easing entrada</span>
            <span class="director-duration-field">
              <input id="directorEffectEaseIn" type="number" min="0" max="${span}" step="0.1" inputmode="decimal"
                value="${segment.easeIn ?? 0}"
                data-effect-editor-path="${escapeHtml(path)}"
                data-effect-editor-start="${segment.start}">
              <span class="director-inline-unit">seg</span>
            </span>
          </label>
          <label class="control-row" for="directorEffectEaseOut"><span>Easing sortida</span>
            <span class="director-duration-field">
              <input id="directorEffectEaseOut" type="number" min="0" max="${span}" step="0.1" inputmode="decimal"
                value="${segment.easeOut ?? 0}"
                data-effect-editor-path="${escapeHtml(path)}"
                data-effect-editor-start="${segment.start}">
              <span class="director-inline-unit">seg</span>
            </span>
          </label>` : '';
      effectEditor = `
        <div class="director-keyframe-editor director-behavior-item" role="group" aria-label="Edició de l'efecte">
          <h5 class="director-settings-title">Efecte</h5>
          <label class="control-row"><span>Paràmetre</span>
            <output class="director-keyframe-readonly">${escapeHtml(effectLabel(path))}</output>
          </label>
          <label class="control-row" for="directorEffectValue"><span>Valor</span>
            ${buildValueField(path, segment)}
          </label>
          <label class="control-row" for="directorEffectStart"><span>Inici</span>
            <span class="director-duration-field">
              <input id="directorEffectStart" type="number" min="0" max="${director.duration}" step="0.1" inputmode="decimal"
                value="${segment.start}"
                data-effect-editor-path="${escapeHtml(path)}"
                data-effect-editor-start="${segment.start}">
              <span class="director-inline-unit">seg</span>
            </span>
          </label>
          <label class="control-row" for="directorEffectEnd"><span>Final</span>
            <span class="director-duration-field">
              <input id="directorEffectEnd" type="number" min="0" max="${director.duration}" step="0.1" inputmode="decimal"
                value="${segment.end}"
                data-effect-editor-path="${escapeHtml(path)}"
                data-effect-editor-start="${segment.start}">
              <span class="director-inline-unit">seg</span>
            </span>
          </label>
          ${easingFields}
          <div class="director-scene-card-actions">
            <button type="button" data-director-effect-delete data-effect-path="${escapeHtml(path)}" data-effect-start="${segment.start}">Eliminar</button>
          </div>
        </div>
      `;
    }

    effectsAreaEl.innerHTML = `
      <div class="director-effects" role="group" aria-labelledby="directorEffectsTitle">
        <h4 class="panel-title" id="directorEffectsTitle">Efectes</h4>
        <p id="directorEffectsHasKeyframesHint" class="sr-only">Aquest efecte ja té algun segment en un altre interval d'aquesta línia de temps.</p>
        ${effectsList}
      </div>
      ${effectEditor}
    `;
  }

  // ── Build effect segment bars in timeline ──────────────────────────────────
  function buildLanes(director, time, total) {
    if (!lanesEl) return;
    const t = time ?? 0;
    const selected = getState().selectedDirectorEffect;
    const entries = Object.entries(director.automations).flatMap(([path, segments]) => {
      const label = effectLabel(path);
      return [...segments]
        .sort((a, b) => a.start - b.start)
        .map((segment) => ({
          path,
          start: segment.start,
          end: segment.end,
          isCurrent: t >= segment.start && t <= segment.end,
          isSelected: selected?.path === path && Math.abs(selected.start - segment.start) <= 0.0001,
          label,
          value: effectValue(segment.value),
          left: Math.min(99, (segment.start / total) * 100),
          widthPct: ((segment.end - segment.start) / total) * 100,
        }));
    }).sort((a, b) => a.left - b.left || a.start - b.start);

    if (!entries.length) {
      lanesEl.innerHTML = '';
      return;
    }

    const rows = [];
    const minGap = 9;
    const buttons = entries.map((entry) => {
      let row = rows.findIndex((lastRight) => entry.left - lastRight >= minGap);
      const width = Math.min(entry.widthPct, 100 - entry.left);
      if (row === -1) {
        row = rows.length;
        rows.push(entry.left + width);
      } else {
        rows[row] = entry.left + width;
      }
      return `<button type="button" class="director-effect-segment${entry.isCurrent ? ' is-current' : ''}${entry.isSelected ? ' is-selected' : ''}"
        style="left:${entry.left}%; width:max(${width}%, 24px); --director-keyframe-row:${row};"
        data-effect-path="${escapeHtml(entry.path)}"
        data-effect-start="${entry.start}"
        data-current="${entry.isCurrent}"
        aria-label="Edita ${escapeHtml(entry.label)} ${escapeHtml(entry.value)}, de ${entry.start.toFixed(2)} a ${entry.end.toFixed(2)} s">
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
    const selectedEffect = findSelectedEffect(state, vm.director);

    // Enabled checkbox + duration field
    enabledCb.checked = !!vm.director.enabled;
    if (document.activeElement !== durationInput) durationInput.value = vm.director.duration;
    trackEl?.setAttribute('aria-valuemax', String(vm.duration));
    trackEl?.setAttribute('aria-valuenow', String(vm.time ?? 0));
    trackEl?.setAttribute('aria-valuetext', timeText(vm.time ?? 0));

    if (reverseBtn) reverseBtn.setAttribute('aria-pressed', String((state.directorRate ?? 1) < 0));
    if (loopBtn) loopBtn.setAttribute('aria-pressed', String(vm.director.loop !== false));

    // Rebuild effects + effect editor
    buildEffectsArea(vm.director, selectedEffect, vm.time ?? 0);

    // Rebuild effect segment bars
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

export { DEFAULT_SEGMENT_LENGTH };
