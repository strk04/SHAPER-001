// github-store.js — factory for GitHub Contents API preset storage
// Usage: const store = createGithubStore({ repo, prefix, tokenKey })
// Canonical source — sync to SHAPER via scripts/sync-shaper.sh

const API = 'https://api.github.com';

export function createGithubStore({ repo, prefix, tokenKey }) {
  const shas = new Map();

  const getToken   = () => localStorage.getItem(tokenKey);
  const setToken   = (t) => localStorage.setItem(tokenKey, t);
  const clearToken = () => localStorage.removeItem(tokenKey);

  async function ghFetch(path, opts = {}) {
    const r = await fetch(`${API}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...opts.headers,
      },
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      let msg = j.message || `GitHub ${r.status}`;
      if (r.status === 401) msg = `Token invàlid o caducat (401). Reconnecta amb un token nou.`;
      else if (r.status === 403) msg = `Sense permís (403). El token necessita escriptura de continguts a ${repo}.`;
      else if (r.status === 404) msg = `El token no té accés a ${repo} (404). Dóna-li accés amb permís Contents: Read and write.`;
      const err = new Error(msg);
      err.status = r.status;
      throw err;
    }
    return r.status === 204 ? null : r.json();
  }

  async function validateToken() {
    const d = await ghFetch('/user');
    let repoData;
    try {
      repoData = await ghFetch(`/repos/${repo}`);
    } catch (e) {
      if (e.status === 404) throw new Error(`Connectat com a @${d.login}, però el token no veu ${repo}.`);
      throw e;
    }
    if (repoData.permissions && repoData.permissions.push === false) {
      throw new Error(`@${d.login} només té lectura a ${repo}. Cal Contents: Read and write.`);
    }
    return d.login;
  }

  const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');

  async function listProjects() {
    try {
      const items = await ghFetch(`/repos/${repo}/contents/${prefix}`);
      return items.filter(i => i.type === 'dir').map(i => i.name).sort();
    } catch (e) {
      if (e.status === 404) return [];
      throw e;
    }
  }

  async function listPresets(project) {
    try {
      const items = await ghFetch(`/repos/${repo}/contents/${prefix}/${encodeURIComponent(project)}`);
      const files = items.filter(i => i.type === 'file' && i.name.endsWith('.json'));
      files.forEach(f => shas.set(f.path, f.sha));
      return files
        .map(f => ({ name: f.name.slice(0, -5), path: f.path }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      if (e.status === 404) return [];
      throw e;
    }
  }

  async function loadPreset(path) {
    const d = await ghFetch(`/repos/${repo}/contents/${encPath(path)}`);
    shas.set(d.path, d.sha);
    const bytes = Uint8Array.from(atob(d.content.replace(/\s/g, '')), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function toBase64(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj, null, 2));
    let bin = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return btoa(bin);
  }

  async function savePreset(project, name, data) {
    const safe = name.replace(/[^\w\s\-]/g, '').trim() || 'preset';
    const path = `${prefix}/${project}/${safe}.json`;
    const body = { message: `preset: "${safe}"`, content: toBase64(data) };
    const sha = shas.get(path);
    if (sha) body.sha = sha;
    const res = await ghFetch(`/repos/${repo}/contents/${encPath(path)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (res?.content?.sha) shas.set(path, res.content.sha);
    return path;
  }

  async function deletePreset(path) {
    const sha = shas.get(path);
    if (!sha) throw new Error('SHA desconegut — recarrega la llista primer');
    await ghFetch(`/repos/${repo}/contents/${encPath(path)}`, {
      method: 'DELETE',
      body: JSON.stringify({ message: `preset: delete "${path}"`, sha }),
    });
    shas.delete(path);
  }

  return { getToken, setToken, clearToken, validateToken, listProjects, listPresets, loadPreset, savePreset, deletePreset };
}
