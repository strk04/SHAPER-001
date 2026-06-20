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
