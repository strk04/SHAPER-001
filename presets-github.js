// presets-github.js — GitHub-backed preset storage for SHAPER 001
// Stores presets as JSON files at presets/{project}/{name}.json in the repo.

const REPO      = 'strk04/shaper-presets';
const API       = 'https://api.github.com';
const TOKEN_KEY = 'shaper-gh-token';

// In-memory SHA cache: path → sha (avoids extra GET before PUT/DELETE)
const shas = new Map();

export const getToken   = ()  => localStorage.getItem(TOKEN_KEY);
export const setToken   = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = ()  => localStorage.removeItem(TOKEN_KEY);

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
    // Translate the common auth/access failures into actionable messages.
    // GitHub returns 404 (not 403) for private repos a token can't see, so a
    // 404 on a write almost always means the token lacks access to the repo.
    let msg = j.message || `GitHub ${r.status}`;
    if (r.status === 401) {
      msg = `Token invàlid o caducat (401). Reconnecta amb un token nou.`;
    } else if (r.status === 403) {
      msg = `Sense permís (403). El token necessita escriptura de continguts a ${REPO}.`;
    } else if (r.status === 404) {
      msg = `El token no té accés a ${REPO} (404). Si és un token fine-grained, ` +
            `dóna-li accés a aquest repo amb permís Contents: Read and write. ` +
            `Si és clàssic, marca l'scope "repo".`;
    }
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return r.status === 204 ? null : r.json();
}

export async function validateToken() {
  const d = await ghFetch('/user');
  return d.login;
}

export async function listProjects() {
  try {
    const items = await ghFetch(`/repos/${REPO}/contents/presets`);
    return items.filter(i => i.type === 'dir').map(i => i.name).sort();
  } catch (e) {
    if (e.status === 404) return [];
    throw e;
  }
}

export async function listPresets(project) {
  try {
    const items = await ghFetch(`/repos/${REPO}/contents/presets/${encodeURIComponent(project)}`);
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

export async function loadPreset(path) {
  const d = await ghFetch(`/repos/${REPO}/contents/${path}`);
  shas.set(d.path, d.sha);
  const bytes = Uint8Array.from(atob(d.content.replace(/\s/g, '')), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function toBase64(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj, null, 2));
  let bin = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export async function savePreset(project, name, data) {
  const safe = name.replace(/[^\w\s\-]/g, '').trim() || 'preset';
  const path = `presets/${project}/${safe}.json`;
  const body = { message: `preset: "${safe}"`, content: toBase64(data) };
  const sha = shas.get(path);
  if (sha) body.sha = sha;
  const res = await ghFetch(`/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (res?.content?.sha) shas.set(path, res.content.sha);
  return path;
}

export async function deletePreset(path) {
  const sha = shas.get(path);
  if (!sha) throw new Error('SHA desconegut — recarrega la llista primer');
  await ghFetch(`/repos/${REPO}/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({ message: `preset: delete "${path}"`, sha }),
  });
  shas.delete(path);
}
