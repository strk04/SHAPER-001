// director.js
const EASINGS = new Set(['hold', 'linear', 'ease-in', 'ease-out', 'ease-in-out']);

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
    automations: Object.freeze({}),
  })],
});

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
  for (const [path, frames] of Object.entries(scene.automations)) {
    const parts = path.split(':');
    if (parts[0] === 'param' && parts.length === 2) {
      params[parts[1]] = laneValue(frames, localTime, params[parts[1]]);
    }
  }
  return { params };
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

export function applySceneAction(input, selectedSceneId, action) {
  const director = normalizeDirector(input);
  const scene = director.scenes.find((item) => item.id === selectedSceneId) || director.scenes[0];
  const index = director.scenes.findIndex((item) => item.id === scene.id);

  if (action === 'add') {
    const nextDirector = addScene(director, { name: `Escena ${director.scenes.length + 1}` });
    return { director: nextDirector, selectedSceneId: nextDirector.scenes.at(-1).id };
  }

  if (action === 'duplicate') {
    const nextDirector = duplicateScene(director, scene.id);
    return { director: nextDirector, selectedSceneId: nextDirector.scenes[index + 1]?.id || scene.id };
  }

  if (action === 'left') {
    return { director: moveScene(director, index, index - 1), selectedSceneId: scene.id };
  }

  if (action === 'right') {
    return { director: moveScene(director, index, index + 1), selectedSceneId: scene.id };
  }

  if (action === 'delete') {
    const nextDirector = removeScene(director, scene.id);
    return {
      director: nextDirector,
      selectedSceneId: nextDirector.scenes[Math.min(index, nextDirector.scenes.length - 1)].id,
    };
  }

  return { director, selectedSceneId: scene.id };
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

export function removeKeyframe(sceneInput, path, time) {
  const scene = normalizeScene(sceneInput);
  if (!isAutomatablePath(path)) return scene;
  const t = clamp(finite(time, 0), 0, scene.duration);
  const existing = Array.isArray(scene.automations[path]) ? scene.automations[path] : [];
  const frames = existing.filter((item) => Math.abs(item.time - t) > 0.0001);
  const automations = { ...scene.automations };
  if (frames.length === 0) delete automations[path];
  else automations[path] = frames;
  return { ...scene, automations };
}

// ── Evaluation ───────────────────────────────────────────────────────────────

export function evaluateDirector(input, absoluteTime, baseState = {}) {
  const config = normalizeDirector(input);
  if (!config.enabled) return { sceneId: null, localTime: 0, params: baseState };
  const located = locateScene(config, finite(absoluteTime, 0));
  const current = resolveScene(located.scene, located.localTime, baseState);
  const transition = located.scene.transition;
  let params = current.params;
  if (transition.duration > 0 && located.localTime < transition.duration) {
    const previous = located.index > 0 ? config.scenes[located.index - 1] : null;
    const from = previous
      ? resolveScene(previous, previous.duration, baseState)
      : { params: baseState };
    const mix = ease(transition.easing, located.localTime / transition.duration);
    params = blendNumberRecords(from.params, current.params, mix);
  }
  return { sceneId: located.scene.id, localTime: located.localTime, params };
}
