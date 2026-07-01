// director.js — single continuous timeline (no scenes)
const EASINGS = new Set(['hold', 'linear', 'ease-in', 'ease-out', 'ease-in-out']);

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const DEFAULT_DIRECTOR = Object.freeze({
  version: 1,
  unsupportedVersion: false,
  enabled: false,
  loop: true,
  duration: 5,
  automations: Object.freeze({}),
});

export function normalizeDirector(input) {
  const duration = clamp(finite(input?.duration, 5), 0.1, 3600);
  return {
    ...structuredClone(input || {}),
    version: 1,
    unsupportedVersion: input?.version != null && input.version !== 1,
    enabled: input?.version === 1 && input?.enabled === true,
    loop: input?.loop !== false,
    duration,
    automations: typeof input?.automations === 'object' && input.automations ? structuredClone(input.automations) : {},
  };
}

const ease = (name, t) => {
  const x = clamp(t, 0, 1);
  if (name === 'hold') return 0;
  if (name === 'ease-in') return x * x;
  if (name === 'ease-out') return 1 - (1 - x) * (1 - x);
  if (name === 'ease-in-out') return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  return x;
};

export function totalDuration(config) {
  return normalizeDirector(config).duration;
}

export function advanceDirectorTime(time, delta, duration, loop) {
  if (!(duration > 0)) return 0;
  const next = finite(time, 0) + finite(delta, 0);
  if (!loop) return clamp(next, 0, duration);
  return ((next % duration) + duration) % duration;
}

function laneValue(keyframes, localTime, fallback) {
  const frames = (Array.isArray(keyframes) ? keyframes : [])
    .filter((frame) => Number.isFinite(frame?.time) && (typeof frame.value !== 'number' || Number.isFinite(frame.value)))
    .sort((a, b) => a.time - b.time);
  if (!frames.length) return fallback;
  if (localTime <= frames[0].time) return frames[0].value;
  if (localTime >= frames.at(-1).time) return frames.at(-1).value;
  const rightIndex = frames.findIndex((frame) => frame.time >= localTime);
  const left = frames[rightIndex - 1];
  const right = frames[rightIndex];
  if (typeof left.value !== 'number' || typeof right.value !== 'number') return left.value;
  const span = Math.max(0.000001, right.time - left.time);
  const mix = ease(left.easing || 'linear', (localTime - left.time) / span);
  return left.value + (right.value - left.value) * mix;
}

export const AUTOMATABLE_PARAMS = Object.freeze({
  charTrack: 'number', leading: 'number', wrapMode: 'hold',
  form: 'hold', formSize: 'number', aspect: 'number',
  rotXSpeed: 'number', rotYSpeed: 'number', rotZSpeed: 'number', angleX: 'number', angleY: 'number',
  speed3d: 'number', rainProb: 'number', rainSpeed: 'number',
});

export const EFFECT_GROUPS = Object.freeze([
  { title: 'Àtom', items: ['charTrack', 'leading', 'wrapMode'] },
  { title: 'Forma 3D', items: ['form', 'formSize', 'aspect'] },
  { title: 'Càmera', items: ['rotXSpeed', 'rotYSpeed', 'rotZSpeed', 'angleX', 'angleY'] },
  { title: 'Moviment 3D', items: ['speed3d', 'rainProb', 'rainSpeed'] },
]);

export function isAutomatablePath(path) {
  const parts = String(path).split(':');
  return parts[0] === 'param' && parts.length === 2 && parts[1] in AUTOMATABLE_PARAMS;
}

export function upsertKeyframe(directorInput, path, frameInput) {
  const director = normalizeDirector(directorInput);
  if (!isAutomatablePath(path)) return director;
  const time = clamp(finite(frameInput?.time, 0), 0, director.duration);
  const easing = EASINGS.has(frameInput?.easing) ? frameInput.easing : 'linear';
  const frame = { time, value: frameInput?.value, easing };
  const existing = Array.isArray(director.automations[path]) ? director.automations[path] : [];
  const frames = [...existing.filter((item) => Math.abs(item.time - time) > 0.0001), frame].sort((a, b) => a.time - b.time);
  return { ...director, automations: { ...director.automations, [path]: frames } };
}

export function removeKeyframe(directorInput, path, time) {
  const director = normalizeDirector(directorInput);
  if (!isAutomatablePath(path)) return director;
  const t = clamp(finite(time, 0), 0, director.duration);
  const existing = Array.isArray(director.automations[path]) ? director.automations[path] : [];
  const frames = existing.filter((item) => Math.abs(item.time - t) > 0.0001);
  const automations = { ...director.automations };
  if (frames.length === 0) delete automations[path];
  else automations[path] = frames;
  return { ...director, automations };
}

// ── Evaluation ───────────────────────────────────────────────────────────────

export function evaluateDirector(input, absoluteTime, baseState = {}) {
  const config = normalizeDirector(input);
  if (!config.enabled) return { localTime: 0, params: baseState };
  const time = clamp(finite(absoluteTime, 0), 0, config.duration);
  const params = { ...baseState };
  for (const [path, frames] of Object.entries(config.automations)) {
    const parts = path.split(':');
    if (parts[0] === 'param' && parts.length === 2) {
      params[parts[1]] = laneValue(frames, time, params[parts[1]]);
    }
  }
  return { localTime: time, params };
}
