// preset-panel.js — shared preset UI panel
// Injects its own HTML into a container element.
//
// Usage:
//   const panel = createPresetPanel({ container, id, store, builtins, capturePreset, applyPreset, localKey, setStatus });
//   panel.activate();   // call when the tool section becomes active (triggers auto-connect)

const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export function createPresetPanel({ container, id, store, builtins = [], capturePreset, applyPreset, localKey, setStatus }) {
  const state = { connected: false, login: null, projects: [], project: null, list: [], active: null };

  // ── Local preset helpers (offline fallback) ────────────────────────────────
  function loadLocal() {
    if (!localKey) return [];
    try { const s = JSON.parse(localStorage.getItem(localKey)); return Array.isArray(s) ? s : []; } catch { return []; }
  }
  function saveLocal(list) {
    if (!localKey) return;
    try { localStorage.setItem(localKey, JSON.stringify(list)); } catch { /* quota */ }
  }

  // ── DOM helpers ────────────────────────────────────────────────────────────
  const $ = (suffix) => document.getElementById(`${id}-${suffix}`);
  function setPanelStatus(msg) {
    const el = $('status');
    if (el) el.textContent = msg;
    if (setStatus) setStatus(msg);
  }
  function announce(msg) {
    const el = $('announce');
    if (el) el.textContent = msg;
  }

  // ── HTML injection ─────────────────────────────────────────────────────────
  container.innerHTML = `
    <div id="${id}-announce" aria-live="polite" aria-atomic="true" class="sr-only"></div>

    <div id="${id}-project-row" class="control-row" style="margin-bottom:var(--space-2)" hidden>
      <label for="${id}-project">Projecte</label>
      <select id="${id}-project" style="flex:1"></select>
    </div>

    <div id="${id}-update-row" class="control-row" hidden style="margin-bottom:var(--space-2)">
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Preset: <span id="${id}-update-name" style="color:var(--ink-2)"></span></span>
      <button id="${id}-update-btn" type="button">Actualitzar</button>
    </div>

    <p id="${id}-status" class="hint" role="status" aria-live="polite" aria-atomic="true"></p>

    <ul id="${id}-list" role="list" aria-label="Presets" style="list-style:none;padding:0;margin:0"></ul>

    <div id="${id}-connected-save" hidden style="margin-top:var(--space-6)">
      <div class="control-row">
        <label class="sr-only" for="${id}-name">Nom del preset</label>
        <input type="text" id="${id}-name" placeholder="Nom del preset" autocomplete="off" style="flex:1;min-width:0">
        <button id="${id}-save-btn" type="button">CREAR</button>
      </div>
    </div>

    <div id="${id}-offline-save" ${localKey ? '' : 'hidden'} style="margin-top:var(--space-6)">
      <div class="control-row">
        <label class="sr-only" for="${id}-offline-name">Nom del preset</label>
        <input type="text" id="${id}-offline-name" placeholder="Nom del preset" autocomplete="off" style="flex:1;min-width:0">
        <button id="${id}-offline-save-btn" type="button">CREAR</button>
      </div>
    </div>

    <div id="${id}-new-project-row" class="control-row" hidden style="margin-top:var(--space-2)">
      <label class="sr-only" for="${id}-new-project">Nom projecte</label>
      <input type="text" id="${id}-new-project" placeholder="Nom projecte" autocomplete="off" style="flex:1;min-width:0">
      <button id="${id}-new-project-btn" type="button">CREAR</button>
    </div>

    <div style="display:flex;gap:var(--space-1);margin-top:var(--space-6)">
      <button id="${id}-export-btn" type="button" style="flex:1 1 0;min-width:0" title="Exporta el preset actual com a fitxer JSON">EXPORT</button>
      <button id="${id}-import-btn" type="button" style="flex:1 1 0;min-width:0" title="Importa preset des d'un fitxer JSON">IMPORT</button>
      <input id="${id}-import-input" type="file" accept=".json,application/json" class="sr-only">
    </div>

    <div id="${id}-connected-bottom" class="control-row" hidden style="margin-top:var(--space-2)">
      <span id="${id}-user" style="flex:1;font-size:var(--text-xs);color:var(--ink-2)"></span>
      <button id="${id}-disconnect-btn" type="button">Desconnecta</button>
    </div>

    <div id="${id}-disconnected-view" style="margin-top:var(--space-2)">
      <div class="control-row">
        <label class="sr-only" for="${id}-token">GitHub Personal Access Token</label>
        <input type="password" id="${id}-token" placeholder="ghp_…" autocomplete="current-password" style="flex:1;min-width:0">
        <button id="${id}-connect-btn" type="button">Connecta</button>
      </div>
    </div>`;

  // ── Render ─────────────────────────────────────────────────────────────────
  function renderProjectSelector() {
    const sel = $('project');
    if (!sel) return;
    sel.innerHTML = state.projects.map(p => `<option value="${esc(p)}"${p === state.project ? ' selected' : ''}>${esc(p)}</option>`).join('');
    const row = $('project-row');
    if (row) row.hidden = state.projects.length === 0;
  }

  function renderList() {
    const list = $('list');
    if (!list) return;

    const builtinItems = builtins.map((p, i) => `
      <li class="preset-item">
        <span class="preset-name">${esc(p.name)}</span>
        <button class="preset-btn preset-load" data-builtin="${i}" type="button" aria-label="Carrega preset ${esc(p.name)}">Load</button>
      </li>`).join('');

    if (state.connected) {
      const userItems = state.list.length
        ? state.list.map(p => `
          <li class="preset-item">
            <span class="preset-name">${esc(p.name)}</span>
            <button class="preset-btn preset-load" data-gh-path="${esc(p.path)}" type="button" aria-label="Carrega preset ${esc(p.name)}">Load</button>
            <button class="preset-btn preset-delete" data-gh-path="${esc(p.path)}" type="button" aria-label="Elimina preset ${esc(p.name)}">✕</button>
          </li>`).join('')
        : `<li style="color:var(--ink-4);font-size:var(--text-xs);padding:var(--space-1) 0">Cap preset desat.</li>`;

      if (builtins.length) {
        list.innerHTML =
          `<li role="presentation"><ul role="group" aria-label="Built-in presets" style="list-style:none;padding:0;margin:0">${builtinItems}</ul></li>` +
          `<li role="presentation"><ul role="group" aria-label="My Presets" style="list-style:none;padding:0;margin:0">
            <li class="preset-divider">${state.list.length ? 'My Presets' : ''}</li>
            ${userItems}</ul></li>`;
      } else {
        list.innerHTML = userItems;
      }

    } else {
      const local = loadLocal();
      const localItems = local.length
        ? local.map((p, i) => `
          <li class="preset-item">
            <span class="preset-name">${esc(p.name)}</span>
            <button class="preset-btn preset-load" data-local="${i}" type="button" aria-label="Carrega preset ${esc(p.name)}">Load</button>
            <button class="preset-btn preset-delete" data-local="${i}" type="button" aria-label="Elimina preset ${esc(p.name)}">✕</button>
          </li>`).join('')
        : `<li style="color:var(--ink-4);font-size:var(--text-xs);padding:var(--space-1) 0">Cap preset desat.</li>`;

      if (builtins.length) {
        list.innerHTML =
          `<li role="presentation"><ul role="group" aria-label="Built-in presets" style="list-style:none;padding:0;margin:0">${builtinItems}</ul></li>` +
          `<li role="presentation"><ul role="group" aria-label="My Presets" style="list-style:none;padding:0;margin:0">
            <li class="preset-divider">${local.length ? 'My Presets' : ''}</li>
            ${localItems}</ul></li>`;
      } else {
        list.innerHTML = localItems;
      }
    }
  }

  function setActive(active) {
    state.active = active;
    const row = $('update-row');
    const nameEl = $('update-name');
    if (active) {
      if (nameEl) nameEl.textContent = active.name;
      row?.removeAttribute('hidden');
    } else {
      row?.setAttribute('hidden', '');
    }
  }

  function showConnected(login) {
    state.connected = true;
    state.login = login;
    $('disconnected-view')?.setAttribute('hidden', '');
    $('connected-save')?.removeAttribute('hidden');
    $('new-project-row')?.removeAttribute('hidden');
    $('connected-bottom')?.removeAttribute('hidden');
    $('offline-save')?.setAttribute('hidden', '');
    const userEl = $('user');
    if (userEl) userEl.textContent = `@${login}`;
    announce(`Connectat com a @${login}`);
  }

  function showDisconnected() {
    state.connected = false;
    state.login = null;
    state.projects = [];
    state.project = null;
    state.list = [];
    setActive(null);
    $('connected-save')?.setAttribute('hidden', '');
    $('new-project-row')?.setAttribute('hidden', '');
    $('connected-bottom')?.setAttribute('hidden', '');
    $('project-row')?.setAttribute('hidden', '');
    $('disconnected-view')?.removeAttribute('hidden');
    if (localKey) $('offline-save')?.removeAttribute('hidden');
  }

  // ── Connect / Disconnect ───────────────────────────────────────────────────
  async function connect() {
    const tokenEl = $('token');
    const token = (tokenEl?.value ?? '').trim();
    if (!token) { setPanelStatus('Introdueix un token.'); return; }
    store.setToken(token);
    setPanelStatus('Connectant…');
    try {
      const login = await store.validateToken();
      if (tokenEl) tokenEl.value = '';
      showConnected(login);
      setPanelStatus('');
      state.projects = await store.listProjects();
      state.project = state.projects[0] ?? null;
      state.list = state.project ? await store.listPresets(state.project) : [];
      renderProjectSelector();
      renderList();
    } catch (e) {
      store.clearToken();
      setPanelStatus(e.message);
    }
  }

  function disconnect() {
    store.clearToken();
    showDisconnected();
    setPanelStatus('Desconnectat de GitHub.');
    renderList();
  }

  async function autoConnect() {
    if (state.connected || !store.getToken()) return;
    setPanelStatus('Reconnectant…');
    try {
      const login = await store.validateToken();
      showConnected(login);
      setPanelStatus('');
      state.projects = await store.listProjects();
      state.project = state.projects[0] ?? null;
      state.list = state.project ? await store.listPresets(state.project) : [];
      renderProjectSelector();
      renderList();
    } catch (e) {
      showDisconnected();
      setPanelStatus(`No s'ha pogut reconnectar. El token continua guardat. ${e.message}`);
      renderList();
    }
  }

  // ── Event wiring ───────────────────────────────────────────────────────────
  $('connect-btn')?.addEventListener('click', connect);
  $('token')?.addEventListener('keydown', e => { if (e.key === 'Enter') connect(); });

  $('disconnect-btn')?.addEventListener('click', function () {
    const ann = $('announce');
    if (this.dataset.confirming === '1') {
      clearTimeout(Number(this.dataset.timer));
      delete this.dataset.confirming;
      this.textContent = 'Desconnecta';
      if (ann) ann.textContent = '';
      disconnect();
    } else {
      this.dataset.confirming = '1';
      this.textContent = 'Segur?';
      if (ann) ann.textContent = 'Prem de nou per desconnectar';
      const timer = setTimeout(() => {
        this.dataset.confirming = '';
        this.textContent = 'Desconnecta';
        if (ann) ann.textContent = '';
      }, 3000);
      this.dataset.timer = String(timer);
    }
  });

  $('project')?.addEventListener('change', async function () {
    state.project = this.value;
    state.list = await store.listPresets(state.project);
    setActive(null);
    renderList();
  });

  $('new-project-btn')?.addEventListener('click', () => {
    const input = $('new-project');
    const name = (input?.value ?? '').trim();
    if (!name || state.projects.includes(name)) {
      setPanelStatus(name ? 'Projecte ja existent.' : 'Introdueix un nom.');
      return;
    }
    state.projects.push(name);
    state.projects.sort();
    state.project = name;
    state.list = [];
    setActive(null);
    if (input) input.value = '';
    setPanelStatus('Projecte creat. Es guardarà a GitHub en desar el primer preset.');
    renderProjectSelector();
    renderList();
  });

  $('save-btn')?.addEventListener('click', async () => {
    const nameEl = $('name');
    const name = (nameEl?.value ?? '').trim() || `Preset ${new Date().toLocaleTimeString()}`;
    if (!state.project) { setPanelStatus('Selecciona o crea un projecte primer.'); return; }
    setPanelStatus(`Guardant "${name}"…`);
    try {
      const path = await store.savePreset(state.project, name, capturePreset());
      state.list = await store.listPresets(state.project);
      if (nameEl) nameEl.value = '';
      setActive({ type: 'gh', path, name });
      renderList();
      setPanelStatus(`Guardat: "${name}"`);
    } catch (e) {
      setPanelStatus(`Error: ${e.message}`);
    }
  });

  // Offline save
  $('offline-save-btn')?.addEventListener('click', () => {
    const nameEl = $('offline-name');
    const name = (nameEl?.value ?? '').trim() || `Preset ${new Date().toLocaleTimeString()}`;
    const presets = loadLocal();
    presets.unshift({ name, data: capturePreset() });
    if (presets.length > 20) presets.length = 20;
    saveLocal(presets);
    if (nameEl) nameEl.value = '';
    setActive({ type: 'local', index: 0, name });
    renderList();
    setPanelStatus(`Guardat: "${name}"`);
  });

  // Update active preset
  $('update-btn')?.addEventListener('click', async () => {
    if (!state.active) return;
    const { type, path, index, name } = state.active;
    setPanelStatus(`Actualitzant "${name}"…`);
    try {
      if (type === 'gh') {
        await store.savePreset(state.project, name, capturePreset());
        state.list = await store.listPresets(state.project);
        renderList();
      } else {
        const presets = loadLocal();
        if (presets[index]) { presets[index].data = capturePreset(); saveLocal(presets); renderList(); }
      }
      const btn = $('update-btn');
      if (btn) {
        btn.textContent = 'Guardat ✓';
        setTimeout(() => { btn.textContent = 'Actualitzar'; }, 2000);
      }
      setPanelStatus(`Actualitzat: "${name}"`);
    } catch (e) {
      setPanelStatus(`Error: ${e.message}`);
    }
  });

  // Export current preset as JSON file
  $('export-btn')?.addEventListener('click', () => {
    const data = capturePreset();
    const name = $('name')?.value.trim() || $('offline-name')?.value.trim() || 'preset';
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name}.json`; a.click();
    URL.revokeObjectURL(url);
  });

  // Import button triggers hidden file input
  $('import-btn')?.addEventListener('click', () => $('import-input')?.click());

  // Import preset from JSON file
  $('import-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        applyPreset(data);
        setPanelStatus(`Importat: "${file.name}"`);
      } catch { setPanelStatus('Error: fitxer JSON invàlid.'); }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // Preset list: load / delete (event delegation)
  $('list')?.addEventListener('click', async (e) => {
    // Built-in load (no update — read-only)
    const builtinBtn = e.target.closest('.preset-load[data-builtin]');
    if (builtinBtn) {
      const p = builtins[parseInt(builtinBtn.dataset.builtin)];
      if (p) { applyPreset(p.data); setActive(null); setPanelStatus(`Carregat: "${p.name}"`); }
      return;
    }

    // GitHub load
    const ghLoadBtn = e.target.closest('.preset-load[data-gh-path]');
    if (ghLoadBtn) {
      setPanelStatus('Carregant…');
      try {
        const data = await store.loadPreset(ghLoadBtn.dataset.ghPath);
        const name = ghLoadBtn.closest('.preset-item')?.querySelector('.preset-name')?.textContent ?? '';
        applyPreset(data);
        setActive({ type: 'gh', path: ghLoadBtn.dataset.ghPath, name });
        setPanelStatus(`Carregat: "${name}"`);
      } catch (e) { setPanelStatus(`Error: ${e.message}`); }
      return;
    }

    // GitHub delete (double confirm)
    const ghDelBtn = e.target.closest('.preset-delete[data-gh-path]');
    if (ghDelBtn) {
      if (ghDelBtn.dataset.confirming === '1') {
        clearTimeout(Number(ghDelBtn.dataset.timer));
        const name = ghDelBtn.closest('.preset-item')?.querySelector('.preset-name')?.textContent ?? '';
        setPanelStatus('Eliminant…');
        try {
          await store.deletePreset(ghDelBtn.dataset.ghPath);
          state.list = await store.listPresets(state.project);
          setActive(null);
          renderList();
          setPanelStatus(`Eliminat: "${name}"`);
        } catch (e) { setPanelStatus(`Error: ${e.message}`); }
      } else {
        const name = ghDelBtn.getAttribute('aria-label')?.replace('Elimina preset ', '') ?? '';
        ghDelBtn.dataset.confirming = '1';
        ghDelBtn.textContent = 'Sure?';
        ghDelBtn.setAttribute('aria-label', `Confirma: elimina preset ${name}`);
        const timer = setTimeout(() => {
          ghDelBtn.dataset.confirming = '';
          ghDelBtn.textContent = '✕';
          ghDelBtn.setAttribute('aria-label', `Elimina preset ${name}`);
        }, 3000);
        ghDelBtn.dataset.timer = String(timer);
      }
      return;
    }

    // Local load
    const localLoadBtn = e.target.closest('.preset-load[data-local]');
    if (localLoadBtn) {
      const presets = loadLocal();
      const idx = parseInt(localLoadBtn.dataset.local);
      const p = presets[idx];
      if (p) { applyPreset(p.data); setActive({ type: 'local', index: idx, name: p.name }); setPanelStatus(`Carregat: "${p.name}"`); }
      return;
    }

    // Local delete (double confirm)
    const localDelBtn = e.target.closest('.preset-delete[data-local]');
    if (localDelBtn) {
      if (localDelBtn.dataset.confirming === '1') {
        clearTimeout(Number(localDelBtn.dataset.timer));
        const presets = loadLocal();
        const idx = parseInt(localDelBtn.dataset.local);
        const name = presets[idx]?.name ?? '';
        presets.splice(idx, 1);
        saveLocal(presets);
        setActive(null);
        renderList();
        setPanelStatus(`Eliminat: "${name}"`);
      } else {
        const name = localDelBtn.getAttribute('aria-label')?.replace('Elimina preset ', '') ?? '';
        localDelBtn.dataset.confirming = '1';
        localDelBtn.textContent = 'Sure?';
        localDelBtn.setAttribute('aria-label', `Confirma: elimina preset ${name}`);
        const timer = setTimeout(() => {
          localDelBtn.dataset.confirming = '';
          localDelBtn.textContent = '✕';
          localDelBtn.setAttribute('aria-label', `Elimina preset ${name}`);
        }, 3000);
        localDelBtn.dataset.timer = String(timer);
      }
      return;
    }
  });

  // Initial render (disconnected state)
  renderList();

  return {
    activate() { autoConnect(); },
  };
}
