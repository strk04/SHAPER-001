// director.js — single continuous timeline, hold-value effect segments
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

export function totalDuration(config) {
  return normalizeDirector(config).duration;
}

export function advanceDirectorTime(time, delta, duration, loop) {
  if (!(duration > 0)) return 0;
  const next = finite(time, 0) + finite(delta, 0);
  if (!loop) return clamp(next, 0, duration);
  return ((next % duration) + duration) % duration;
}

// A segment holds ONE fixed value for the whole [start, end] window; outside it, the
// param falls back to whatever the base state already had.
function segmentValue(segments, time, fallback) {
  const list = (Array.isArray(segments) ? segments : [])
    .filter((seg) => Number.isFinite(seg?.start) && Number.isFinite(seg?.end));
  const hit = list.find((seg) => time >= seg.start && time <= seg.end);
  return hit ? hit.value : fallback;
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

export function upsertEffect(directorInput, path, segmentInput) {
  const director = normalizeDirector(directorInput);
  if (!isAutomatablePath(path)) return director;
  const start = clamp(finite(segmentInput?.start, 0), 0, director.duration);
  const end = clamp(finite(segmentInput?.end, start), start, director.duration);
  const segment = { start, end, value: segmentInput?.value };
  const existing = Array.isArray(director.automations[path]) ? director.automations[path] : [];
  const segments = [...existing.filter((item) => Math.abs(item.start - start) > 0.0001), segment]
    .sort((a, b) => a.start - b.start);
  return { ...director, automations: { ...director.automations, [path]: segments } };
}

export function removeEffect(directorInput, path, start) {
  const director = normalizeDirector(directorInput);
  if (!isAutomatablePath(path)) return director;
  const s = clamp(finite(start, 0), 0, director.duration);
  const existing = Array.isArray(director.automations[path]) ? director.automations[path] : [];
  const segments = existing.filter((item) => Math.abs(item.start - s) > 0.0001);
  const automations = { ...director.automations };
  if (segments.length === 0) delete automations[path];
  else automations[path] = segments;
  return { ...director, automations };
}

// ── Evaluation ───────────────────────────────────────────────────────────────

export function evaluateDirector(input, absoluteTime, baseState = {}) {
  const config = normalizeDirector(input);
  if (!config.enabled) return { localTime: 0, params: baseState };
  const time = clamp(finite(absoluteTime, 0), 0, config.duration);
  const params = { ...baseState };
  for (const [path, segments] of Object.entries(config.automations)) {
    const parts = path.split(':');
    if (parts[0] === 'param' && parts.length === 2) {
      params[parts[1]] = segmentValue(segments, time, params[parts[1]]);
    }
  }
  return { localTime: time, params };
}
