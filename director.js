// director.js
const EASINGS = new Set(['hold', 'linear', 'ease-in', 'ease-out', 'ease-in-out']);
const BEHAVIOR_TYPES = new Set(['drift', 'orbit', 'attract', 'explode']);

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const DEFAULT_DIRECTOR = Object.freeze({
  version: 1,
  unsupportedVersion: false,
  enabled: false,
  loop: true,
  scenes: [Object.freeze({
    id: 'scene-1',
    name: 'Escena 1',
    duration: 5,
    transition: Object.freeze({ duration: 0, easing: 'ease-in-out' }),
    params: Object.freeze({}),
    behaviors: Object.freeze([]),
    automations: Object.freeze({}),
  })],
});

export function normalizeBehavior(input, index = 0) {
  const supported = BEHAVIOR_TYPES.has(input?.type);
  const type = supported ? input.type : String(input?.type || 'unknown');
  return {
    ...structuredClone(input || {}),
    id: String(input?.id || `behavior-${index + 1}`),
    type,
    enabled: supported && input?.enabled !== false,
    unsupported: !supported,
    intensity: clamp(finite(input?.intensity, 0), 0, 1),
    cohesion: clamp(finite(input?.cohesion, 1), 0, 1),
    seedOffset: Math.trunc(finite(input?.seedOffset, index + 1)),
    params: Object.fromEntries(Object.entries(input?.params || {}).filter(([, value]) => Number.isFinite(Number(value)))),
  };
}

export function normalizeScene(input, index = 0) {
  const duration = clamp(finite(input?.duration, 5), 0.1, 3600);
  const transitionDuration = clamp(finite(input?.transition?.duration, 0), 0, duration);
  const params = Object.fromEntries(Object.entries(input?.params || {}).filter(([, value]) => {
    return typeof value !== 'number' || Number.isFinite(value);
  }));
  return {
    ...structuredClone(input || {}),
    id: String(input?.id || `scene-${index + 1}`),
    name: String(input?.name || `Escena ${index + 1}`),
    duration,
    transition: {
      duration: transitionDuration,
      easing: EASINGS.has(input?.transition?.easing) ? input.transition.easing : 'ease-in-out',
    },
    params,
    behaviors: (Array.isArray(input?.behaviors) ? input.behaviors : []).map(normalizeBehavior),
    automations: typeof input?.automations === 'object' && input.automations ? structuredClone(input.automations) : {},
  };
}

export function normalizeDirector(input) {
  const sourceScenes = Array.isArray(input?.scenes) && input.scenes.length ? input.scenes : DEFAULT_DIRECTOR.scenes;
  return {
    ...structuredClone(input || {}),
    version: 1,
    unsupportedVersion: input?.version != null && input.version !== 1,
    enabled: input?.version === 1 && input?.enabled === true,
    loop: input?.loop !== false,
    scenes: sourceScenes.map(normalizeScene),
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
  return normalizeDirector(config).scenes.reduce((sum, scene) => sum + scene.duration, 0);
}

export function advanceDirectorTime(time, delta, duration, loop) {
  if (!(duration > 0)) return 0;
  const next = finite(time, 0) + finite(delta, 0);
  if (!loop) return clamp(next, 0, duration);
  return ((next % duration) + duration) % duration;
}

function locateScene(config, absoluteTime) {
  const duration = totalDuration(config);
  const time = config.loop ? advanceDirectorTime(0, absoluteTime, duration, true) : clamp(absoluteTime, 0, duration);
  let start = 0;
  for (let index = 0; index < config.scenes.length; index++) {
    const scene = config.scenes[index];
    const isLast = index === config.scenes.length - 1;
    if (time < start + scene.duration || isLast) return { scene, index, start, localTime: time - start, time };
    start += scene.duration;
  }
  return { scene: config.scenes[0], index: 0, start: 0, localTime: 0, time: 0 };
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

function resolveScene(scene, localTime, baseState) {
  const params = { ...baseState, ...scene.params };
  const behaviors = scene.behaviors.map((behavior) => structuredClone(behavior));
  for (const [path, frames] of Object.entries(scene.automations)) {
    const parts = path.split(':');
    if (parts[0] === 'param' && parts.length === 2) {
      params[parts[1]] = laneValue(frames, localTime, params[parts[1]]);
    }
    if (parts[0] === 'behavior' && parts.length === 3) {
      const behavior = behaviors.find((item) => item.id === parts[1]);
      if (behavior && parts[2] in behavior) behavior[parts[2]] = laneValue(frames, localTime, behavior[parts[2]]);
      if (behavior && parts[2] in behavior.params) behavior.params[parts[2]] = laneValue(frames, localTime, behavior.params[parts[2]]);
    }
  }
  return { params, behaviors };
}

function blendNumberRecords(from, to, mix) {
  const result = { ...from, ...to };
  for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
    if (typeof from[key] === 'number' && typeof to[key] === 'number') result[key] = from[key] + (to[key] - from[key]) * mix;
    else if (mix < 1 && key in from) result[key] = from[key];
  }
  return result;
}

// ── Immutable scene-editing helpers (Task 7) ────────────────────────────────

const uniqueId = (prefix, scenes) => {
  let index = scenes.length + 1;
  while (scenes.some((scene) => scene.id === `${prefix}-${index}`)) index++;
  return `${prefix}-${index}`;
};

export function addScene(input, partial = {}) {
  const director = normalizeDirector(input);
  const scene = normalizeScene({ ...partial, id: partial.id || uniqueId('scene', director.scenes) }, director.scenes.length);
  return { ...director, scenes: [...director.scenes, scene] };
}

export function duplicateScene(input, id) {
  const director = normalizeDirector(input);
  const index = director.scenes.findIndex((scene) => scene.id === id);
  if (index < 0) return director;
  const copy = structuredClone(director.scenes[index]);
  copy.id = uniqueId('scene', director.scenes);
  copy.name = `${copy.name} còpia`;
  const scenes = director.scenes.slice();
  scenes.splice(index + 1, 0, copy);
  return { ...director, scenes };
}

export function moveScene(input, fromIndex, toIndex) {
  const director = normalizeDirector(input);
  const scenes = director.scenes.slice();
  const from = clamp(Math.trunc(fromIndex), 0, scenes.length - 1);
  const to = clamp(Math.trunc(toIndex), 0, scenes.length - 1);
  const [scene] = scenes.splice(from, 1);
  scenes.splice(to, 0, scene);
  return { ...director, scenes };
}

export function removeScene(input, id) {
  const director = normalizeDirector(input);
  if (director.scenes.length === 1) return director;
  return { ...director, scenes: director.scenes.filter((scene) => scene.id !== id) };
}

export const AUTOMATABLE_PARAMS = Object.freeze({
  morphT: 'number', morphSpeed: 'number', morphScatter: 'number', morphSpeedVar: 'number',
  zoom: 'number', angleX: 'number', angleY: 'number', depthFade: 'number',
  formSize: 'number', pulse: 'number', noiseTexture: 'number',
  textColor: 'hold', bgColor: 'hold', form: 'hold', projection: 'hold',
});

export const BEHAVIOR_DEFAULTS = Object.freeze({
  drift: Object.freeze({ angle: 0, elevation: 0, distance: 100, speed: 0.1, phase: 0 }),
  orbit: Object.freeze({ centerX: 0, centerY: 0, centerZ: 0, radius: 180, speed: 0.1, phase: 0, depth: 0, spread: 0 }),
  attract: Object.freeze({ targetX: 0, targetY: 0, targetZ: 0, strength: 100, radius: 400, falloff: 1 }),
  explode: Object.freeze({ centerX: 0, centerY: 0, centerZ: 0, distance: 240, spread: 0.5, progress: 0 }),
});

export function isAutomatablePath(path) {
  const parts = String(path).split(':');
  if (parts[0] === 'param' && parts.length === 2) return parts[1] in AUTOMATABLE_PARAMS;
  return parts[0] === 'behavior' && parts.length === 3;
}

export function upsertKeyframe(sceneInput, path, frameInput) {
  const scene = normalizeScene(sceneInput);
  if (!isAutomatablePath(path)) return scene;
  const time = clamp(finite(frameInput?.time, 0), 0, scene.duration);
  const easing = EASINGS.has(frameInput?.easing) ? frameInput.easing : 'linear';
  const frame = { time, value: frameInput?.value, easing };
  const existing = Array.isArray(scene.automations[path]) ? scene.automations[path] : [];
  const frames = [...existing.filter((item) => Math.abs(item.time - time) > 0.0001), frame].sort((a, b) => a.time - b.time);
  return { ...scene, automations: { ...scene.automations, [path]: frames } };
}

export function upsertBehavior(sceneInput, type) {
  const scene = normalizeScene(sceneInput);
  if (!(type in BEHAVIOR_DEFAULTS)) return scene;
  if (scene.behaviors.some((behavior) => behavior.type === type)) return scene;
  const behavior = normalizeBehavior({
    id: `${type}-${scene.behaviors.length + 1}`,
    type, enabled: true, intensity: 1, cohesion: 1,
    seedOffset: scene.behaviors.length + 1,
    params: BEHAVIOR_DEFAULTS[type],
  }, scene.behaviors.length);
  return { ...scene, behaviors: [...scene.behaviors, behavior] };
}

export function updateBehavior(sceneInput, id, patch) {
  const scene = normalizeScene(sceneInput);
  return {
    ...scene,
    behaviors: scene.behaviors.map((behavior) => behavior.id === id
      ? normalizeBehavior({ ...behavior, ...patch, params: { ...behavior.params, ...(patch.params || {}) } })
      : behavior),
  };
}

export function removeBehavior(sceneInput, id) {
  const scene = normalizeScene(sceneInput);
  return { ...scene, behaviors: scene.behaviors.filter((behavior) => behavior.id !== id) };
}

// ── Evaluation ───────────────────────────────────────────────────────────────

export function evaluateDirector(input, absoluteTime, baseState = {}, liveOverrides = {}) {
  const config = normalizeDirector(input);
  if (!config.enabled) return { sceneId: null, localTime: 0, params: baseState, behaviors: [] };
  const located = locateScene(config, finite(absoluteTime, 0));
  const current = resolveScene(located.scene, located.localTime, baseState);
  const transition = located.scene.transition;
  let params = current.params;
  let behaviors = current.behaviors;
  if (transition.duration > 0 && located.localTime < transition.duration) {
    const previous = located.index > 0 ? config.scenes[located.index - 1] : null;
    const from = previous
      ? resolveScene(previous, previous.duration, baseState)
      : { params: baseState, behaviors: [] };
    const mix = ease(transition.easing, located.localTime / transition.duration);
    params = blendNumberRecords(from.params, current.params, mix);
    behaviors = current.behaviors.map((behavior) => {
      const old = from.behaviors.find((item) => item.id === behavior.id);
      return old ? {
        ...behavior,
        intensity: old.intensity + (behavior.intensity - old.intensity) * mix,
        cohesion: old.cohesion + (behavior.cohesion - old.cohesion) * mix,
        params: blendNumberRecords(old.params, behavior.params, mix),
      } : { ...behavior, intensity: behavior.intensity * mix };
    });
  }
  behaviors = behaviors.map((behavior) => {
    const override = liveOverrides[behavior.id] || {};
    return { ...behavior, ...override, params: { ...behavior.params, ...(override.params || {}) } };
  });
  return { sceneId: located.scene.id, localTime: located.localTime, params, behaviors };
}
