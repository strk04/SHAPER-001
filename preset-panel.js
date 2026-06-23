// preset-panel.js — shared preset UI panel
// Injects its own HTML into a container element.
//
// Usage:
//   const panel = createPresetPanel({ container, id, store, builtins, capturePreset, applyPreset, localKey, setStatus });
//   panel.activate();   // call when the tool section becomes active (triggers auto-connect)

const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export function createPresetPanel({ container, id, store, builtins = [], capturePreset, applyPreset, localKey, setStatus }) {
  const state = { connected: false, login: null, projects: [], project: null, list: [] };

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

    <div id="${id}-disconnected-view">
      <div class="control-row">
        <label class="sr-only" for="${id}-token">GitHub Personal Access Token</label>
        <input type="password" id="${id}-token" placeholder="ghp_…" autocomplete="current-password" style="flex:1;min-width:0">
        <button id="${id}-connect-btn" type="button">Connecta</button>
      </div>
    </div>

    <div id="${id}-connected-view" hidden>
      <div class="control-row" style="margin-bottom:var(--space-2)">
        <span id="${id}-user" style="flex:1;font-size:var(--text-xs);color:var(--ink-2)"></span>
        <button id="${id}-disconnect-btn" type="button">Desconnecta</button>
      </div>
      <div id="${id}-project-row" class="control-row" style="margin-bottom:var(--space-2)" hidden>
        <label class="sr-only" for="${id}-project">Projecte</label>
        <select id="${id}-project" style="flex:1"></select>
      </div>
      <div class="control-row" style="margin-bottom:var(--space-2)">
        <label class="sr-only" for="${id}-new-project">Nom del nou projecte</label>
        <input type="text" id="${id}-new-project" placeholder="Nou projecte" autocomplete="off" style="flex:1;min-width:0">
        <button id="${id}-new-project-btn" type="button">+ Projecte</button>
      </div>
      <div class="control-row">
        <label class="sr-only" for="${id}-name">Nom del preset</label>
        <input type="text" id="${id}-name" placeholder="Nom del preset" autocomplete="off" style="flex:1;min-width:0">
        <button id="${id}-save-btn" type="button">Desa</button>
      </div>
    </div>

    <div id="${id}-offline-save" ${localKey ? '' : 'hidden'}>
      <div class="control-row" style="margin-top:var(--space-2)">
        <label class="sr-only" for="${id}-offline-name">Nom del preset</label>
        <input type="text" id="${id}-offline-name" placeholder="Nom del preset" autocomplete="off" style="flex:1;min-width:0">
        <button id="${id}-offline-save-btn" type="button">Desa</button>
      </div>
    </div>

    <p id="${id}-status" class="hint" role="status" aria-live="polite" aria-atomic="true"></p>

    <ul id="${id}-list" role="list" aria-label="Presets"></ul>

    <div id="${id}-migrate-row" hidden style="margin-top:var(--space-2)">
      <button id="${id}-migrate-btn" type="button" style="width:100%">Importa locals → GitHub</button>
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

      const migrateRow = $('migrate-row');
      if (migrateRow) migrateRow.hidden = !localKey || loadLocal().length === 0;
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

  function showConnected(login) {
    state.connected = true;
    state.login = login;
    $('disconnected-view')?.setAttribute('hidden', '');
    $('connected-view')?.removeAttribute('hidden');
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
    $('connected-view')?.setAttribute('hidden', '');
    $('disconnected-view')?.removeAttribute('hidden');
    if (localKey) $('offline-save')?.removeAttribute('hidden');
    const migrateRow = $('migrate-row');
    if (migrateRow) migrateRow.hidden = true;
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
    } catch {
      store.clearToken();
      showDisconnected();
      setPanelStatus('');
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
    if (input) input.value = '';
    setPanelStatus('');
    renderProjectSelector();
    renderList();
  });

  $('save-btn')?.addEventListener('click', async () => {
    const nameEl = $('name');
    const name = (nameEl?.value ?? '').trim() || `Preset ${new Date().toLocaleTimeString()}`;
    if (!state.project) { setPanelStatus('Selecciona o crea un projecte primer.'); return; }
    setPanelStatus(`Desant "${name}"…`);
    try {
      await store.savePreset(state.project, name, capturePreset());
      state.list = await store.listPresets(state.project);
      if (nameEl) nameEl.value = '';
      renderList();
      setPanelStatus(`Desat: "${name}"`);
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
    renderList();
    setPanelStatus(`Saved: "${name}"`);
  });

  // Migrate locals → GitHub
  $('migrate-btn')?.addEventListener('click', async () => {
    const locals = loadLocal();
    if (!locals.length) { setPanelStatus('Cap preset local.'); return; }
    if (!state.project) { setPanelStatus('Selecciona un projecte.'); return; }
    let ok = 0;
    setPanelStatus(`Important ${locals.length} presets…`);
    for (const p of locals) {
      try { await store.savePreset(state.project, p.name, p.data); ok++; } catch { /* skip */ }
    }
    state.list = await store.listPresets(state.project);
    renderList();
    setPanelStatus(`Importats ${ok}/${locals.length} presets a "${state.project}".`);
  });

  // Preset list: load / delete (event delegation)
  $('list')?.addEventListener('click', async (e) => {
    // Built-in load
    const builtinBtn = e.target.closest('.preset-load[data-builtin]');
    if (builtinBtn) {
      const p = builtins[parseInt(builtinBtn.dataset.builtin)];
      if (p) { applyPreset(p.data); setPanelStatus(`Carregat: "${p.name}"`); }
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
      const p = presets[parseInt(localLoadBtn.dataset.local)];
      if (p) { applyPreset(p.data); setPanelStatus(`Carregat: "${p.name}"`); }
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
  if (localKey) $('offline-save')?.removeAttribute('hidden');
  renderList();

  return {
    activate() { autoConnect(); },
  };
}
