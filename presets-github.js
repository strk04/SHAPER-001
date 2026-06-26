// presets-github.js — configured GitHub-backed preset storage for SHAPER 001.
import { createGithubStore } from './github-store.js';

export const store = createGithubStore({
  repo: 'strk04/querida-presets',
  prefix: 'presets/shaper',
  tokenKey: 'querida-gh-token',
});

export const {
  getToken,
  setToken,
  clearToken,
  validateToken,
  listProjects,
  listPresets,
  loadPreset,
  savePreset,
  deletePreset,
} = store;
