# Motion Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afegir a SHAPER un Director híbrid amb escenes, quatre comportaments deterministes, cohesió, keyframes, controls en viu i export frame-exact.

**Architecture:** `director.js` serà l’avaluador temporal pur i el model immutable; `motion.js` calcularà offsets analítics 2D/3D; `director-ui.js` gestionarà inspector i timeline sense contenir lògica de render. `main.js` resoldrà un snapshot per temps absolut i `engine.js` aplicarà els offsets abans de projecció, mantenint un fast path idèntic quan Director estigui desactivat.

**Tech Stack:** JavaScript ES modules sense build, Canvas 2D, WebCodecs + `mp4-muxer.mjs`, HTML/CSS, `node:test` per proves pures i navegador real per verificació visual.

---

## Abast i estructura de fitxers

La funcionalitat comparteix un únic esquema temporal i un únic pipeline de render; per això es manté en un pla integrat, lliurat en fases que deixen software provable després de cada commit.

**Fitxers nous**

- `director.js`: defaults, validació, edició immutable, keyframes, escenes, rellotge i simplificació de gravacions.
- `motion.js`: deriva, òrbita, atracció/repulsió, explosió/reagrupament, cohesió i helpers per 2D/3D.
- `director-ui.js`: inspector, timeline, pads, accessibilitat i emissió d’accions.
- `export-video.js`: càlcul de frames i export offline del Director.
- `tests/director.test.mjs`: esquema, escenes, keyframes i temps.
- `tests/motion.test.mjs`: camps de moviment i determinisme.
- `tests/director-ui.test.mjs`: model d’edició consumit per la UI.
- `tests/export-video.test.mjs`: seqüència temporal d’export.
- `tests/project-wiring.test.mjs`: contractes estàtics d’HTML, CSS i integració.

**Fitxers modificats**

- `main.js:1-4,123-175,340-405,669-745,1137-1260,1267-1368,1680-1744`: estat, rellotge, render resolt, UI, presets i export.
- `engine.js:1-4,1364-1678,2325-2428`: import del motor de moviment i aplicació 2D/3D.
- `index.html:15-55,65-510,600-612`: pestanya, inspector, timeline i pads.
- `styles.css:35-37,205-365,539-610`: dock del Director, layout, controls i responsive.
- `docs/STATUS.md`, `docs/HANDOFF.md`, `docs/progress.md`, `docs/decisions.md`: estat final i decisions emergents reals.

## Regles d’execució

- Executar cada tasca amb TDD: prova vermella, implementació mínima, prova verda, commit.
- No modificar l’ordre dels rolls dels PRNG existents a `layout()` o `build3D()`.
- `Director.enabled === false` ha de conservar el snapshot i el render actuals.
- No afegir dependències ni `package.json`; les proves s’executen amb `node --test`.
- No copiar a Pixel Perfect ni desplegar fins que la verificació local completa sigui verda i l’usuari ho demani.

---

### Task 1: Esquema, defaults i normalització del Director

**Files:**
- Create: `director.js`
- Create: `tests/director.test.mjs`

- [ ] **Step 1: Escriure les proves vermelles de normalització**

```js
// tests/director.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DIRECTOR, normalizeDirector } from '../director.js';

test('normalizeDirector returns a safe disabled config for missing input', () => {
  const result = normalizeDirector(null);
  assert.equal(result.enabled, false);
  assert.equal(result.version, 1);
  assert.equal(result.scenes.length, 1);
  assert.equal(result.scenes[0].duration, 5);
});

test('normalizeDirector clamps invalid scene and behavior values', () => {
  const result = normalizeDirector({
    version: 1,
    enabled: true,
    scenes: [{
      id: '', name: '', duration: -4,
      transition: { duration: 99, easing: 'wild' },
      params: { morphT: Number.NaN },
      behaviors: [{ id: 'b', type: 'orbit', intensity: 8, cohesion: -2 }],
      automations: {},
    }],
  });
  assert.equal(result.scenes[0].duration, 0.1);
  assert.equal(result.scenes[0].transition.duration, 0.1);
  assert.equal(result.scenes[0].transition.easing, 'ease-in-out');
  assert.deepEqual(result.scenes[0].params, {});
  assert.equal(result.scenes[0].behaviors[0].intensity, 1);
  assert.equal(result.scenes[0].behaviors[0].cohesion, 0);
});

test('default config is not mutated by normalization', () => {
  const before = structuredClone(DEFAULT_DIRECTOR);
  normalizeDirector({ version: 1, scenes: [] });
  assert.deepEqual(DEFAULT_DIRECTOR, before);
});

test('unknown versions and behaviors stay visible but disabled', () => {
  const result = normalizeDirector({
    version: 9, enabled: true,
    scenes: [{ duration: 2, behaviors: [{ id: 'x', type: 'teleport', intensity: 1 }] }],
  });
  assert.equal(result.enabled, false);
  assert.equal(result.unsupportedVersion, true);
  assert.equal(result.scenes[0].behaviors[0].unsupported, true);
  assert.equal(result.scenes[0].behaviors[0].enabled, false);
});

test('unknown fields survive normalization for forward-compatible round trips', () => {
  const result = normalizeDirector({
    version: 1, futureFlag: 'keep-me',
    scenes: [{ duration: 2, futureSceneField: 7, behaviors: [] }],
  });
  assert.equal(result.futureFlag, 'keep-me');
  assert.equal(result.scenes[0].futureSceneField, 7);
});
```

- [ ] **Step 2: Executar la prova i confirmar el vermell**

Run: `node --test tests/director.test.mjs`

Expected: FAIL amb `ERR_MODULE_NOT_FOUND` per `director.js`.

- [ ] **Step 3: Implementar l’esquema mínim complet**

```js
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
```

- [ ] **Step 4: Executar la prova i confirmar el verd**

Run: `node --test tests/director.test.mjs`

Expected: `5` tests PASS, `0` FAIL.

- [ ] **Step 5: Comprovar sintaxi i crear commit**

Run: `node --check director.js`

Expected: exit `0` sense output.

```bash
git add director.js tests/director.test.mjs
git commit -m "feat: add director schema normalization"
```

---

### Task 2: Avaluador temporal, escenes i keyframes

**Files:**
- Modify: `director.js`
- Modify: `tests/director.test.mjs`

- [ ] **Step 1: Afegir proves vermelles per temps, easing i límits d’escena**

```js
// append to tests/director.test.mjs
import { evaluateDirector, totalDuration, advanceDirectorTime } from '../director.js';

test('evaluateDirector selects scenes and interpolates numeric params', () => {
  const config = normalizeDirector({
    version: 1, enabled: true, loop: false,
    scenes: [
      { id: 'a', duration: 2, params: { morphT: 0 }, automations: {} },
      {
        id: 'b', duration: 2, transition: { duration: 1, easing: 'linear' },
        params: { morphT: 1 }, behaviors: [], automations: {},
      },
    ],
  });
  assert.equal(evaluateDirector(config, 2.5, { morphT: 0 }).sceneId, 'b');
  assert.equal(evaluateDirector(config, 2.5, { morphT: 0 }).params.morphT, 0.5);
});

test('automation overrides the scene value in local scene time', () => {
  const config = normalizeDirector({
    version: 1, enabled: true, loop: false,
    scenes: [{
      id: 'a', duration: 4, params: { morphT: 0 }, behaviors: [],
      automations: {
        'param:morphT': [
          { time: 0, value: 0, easing: 'linear' },
          { time: 4, value: 1, easing: 'linear' },
        ],
      },
    }],
  });
  assert.equal(evaluateDirector(config, 2, { morphT: 0 }).params.morphT, 0.5);
});

test('advanceDirectorTime loops and clamps with absolute seconds', () => {
  assert.equal(totalDuration(normalizeDirector(null)), 5);
  assert.ok(Math.abs(advanceDirectorTime(4.8, 1, 5, true) - 0.8) < 1e-9);
  assert.equal(advanceDirectorTime(4.8, 1, 5, false), 5);
  assert.ok(Math.abs(advanceDirectorTime(0.2, -1, 5, true) - 4.2) < 1e-9);
});

test('the first scene transitions from the base preset', () => {
  const config = normalizeDirector({
    version: 1, enabled: true, loop: false,
    scenes: [{
      id: 'a', duration: 2,
      transition: { duration: 1, easing: 'linear' },
      params: { zoom: 3, bgColor: '#ffffff' }, behaviors: [], automations: {},
    }],
  });
  const result = evaluateDirector(config, 0.5, { zoom: 1, bgColor: '#000000' });
  assert.equal(result.params.zoom, 2);
  assert.equal(result.params.bgColor, '#000000');
});
```

- [ ] **Step 2: Executar només aquestes proves i confirmar que fallen**

Run: `node --test --test-name-pattern="evaluateDirector|automation|advanceDirectorTime" tests/director.test.mjs`

Expected: FAIL perquè les exportacions encara no existeixen.

- [ ] **Step 3: Implementar avaluació pura i paths de pista**

```js
// append to director.js
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
```

- [ ] **Step 4: Executar totes les proves del Director**

Run: `node --test tests/director.test.mjs`

Expected: `9` tests PASS, `0` FAIL.

- [ ] **Step 5: Commit**

```bash
git add director.js tests/director.test.mjs
git commit -m "feat: evaluate director scenes and automation"
```

---

### Task 3: Motor analític dels quatre comportaments i cohesió

**Files:**
- Create: `motion.js`
- Create: `tests/motion.test.mjs`

- [ ] **Step 1: Escriure proves vermelles de determinisme i semàntica**

```js
// tests/motion.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMotionBehaviors, centroidOf } from '../motion.js';

const point = { x: 10, y: 0, z: 0 };
const centroid = { x: 0, y: 0, z: 0 };

test('zero intensity preserves the exact point', () => {
  const result = applyMotionBehaviors(point, centroid, 3, [{
    id: 'd', type: 'drift', enabled: true, intensity: 0, cohesion: 0,
    seedOffset: 1, params: { angle: 0, elevation: 0, distance: 100, speed: 1, phase: 0 },
  }], 1, 42);
  assert.deepEqual(result, point);
});

test('same seed and time produce identical explosion offsets', () => {
  const behavior = {
    id: 'e', type: 'explode', enabled: true, intensity: 1, cohesion: 0,
    seedOffset: 9, params: { centerX: 0, centerY: 0, centerZ: 0, distance: 80, spread: 1, progress: 0.5 },
  };
  assert.deepEqual(
    applyMotionBehaviors(point, centroid, 7, [behavior], 2, 99),
    applyMotionBehaviors(point, centroid, 7, [behavior], 2, 99),
  );
});

test('cohesion one gives the same offset to every glyph', () => {
  const behavior = {
    id: 'a', type: 'attract', enabled: true, intensity: 1, cohesion: 1,
    seedOffset: 1, params: { targetX: 100, targetY: 0, targetZ: 0, strength: 20, radius: 200, falloff: 1 },
  };
  const a = applyMotionBehaviors({ x: 10, y: 0, z: 0 }, centroid, 1, [behavior], 0, 1);
  const b = applyMotionBehaviors({ x: -10, y: 0, z: 0 }, centroid, 2, [behavior], 0, 1);
  assert.equal(a.x - 10, b.x + 10);
});

test('centroidOf averages finite points', () => {
  assert.deepEqual(centroidOf([{ x: 0, y: 2, z: 4 }, { x: 2, y: 4, z: 6 }]), { x: 1, y: 3, z: 5 });
});
```

- [ ] **Step 2: Executar i confirmar el vermell**

Run: `node --test tests/motion.test.mjs`

Expected: FAIL amb `ERR_MODULE_NOT_FOUND` per `motion.js`.

- [ ] **Step 3: Implementar els camps com a funcions pures**

```js
// motion.js
const TAU = Math.PI * 2;
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const mix = (a, b, t) => a + (b - a) * t;
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: (a.z || 0) + (b.z || 0) });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) });
const scale = (p, amount) => ({ x: p.x * amount, y: p.y * amount, z: (p.z || 0) * amount });
const length = (p) => Math.hypot(p.x, p.y, p.z || 0);
const normalize = (p) => { const n = length(p) || 1; return scale(p, 1 / n); };

function hash01(seed) {
  let value = seed >>> 0;
  value += 0x6D2B79F5;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
}

function unitFromSeed(seed) {
  const azimuth = hash01(seed) * TAU;
  const z = hash01(seed ^ 0x9e3779b9) * 2 - 1;
  const radius = Math.sqrt(Math.max(0, 1 - z * z));
  return { x: Math.cos(azimuth) * radius, y: Math.sin(azimuth) * radius, z };
}

export function centroidOf(points) {
  const finite = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z || 0));
  if (!finite.length) return { x: 0, y: 0, z: 0 };
  const sum = finite.reduce((acc, point) => add(acc, point), { x: 0, y: 0, z: 0 });
  return scale(sum, 1 / finite.length);
}

function evaluateOffset(type, point, behavior, time, variationSeed) {
  const p = behavior.params || {};
  if (type === 'drift') {
    const angle = Number(p.angle) || 0;
    const elevation = Number(p.elevation) || 0;
    const distance = Number(p.distance) || 0;
    const phase = (Number(p.phase) || 0) + time * (Number(p.speed) || 0);
    const wave = Math.sin(phase * TAU);
    return {
      x: Math.cos(angle) * Math.cos(elevation) * distance * wave,
      y: Math.sin(angle) * Math.cos(elevation) * distance * wave,
      z: Math.sin(elevation) * distance * wave,
    };
  }
  if (type === 'orbit') {
    const center = { x: Number(p.centerX) || 0, y: Number(p.centerY) || 0, z: Number(p.centerZ) || 0 };
    const radius = Number(p.radius) || 0;
    const spread = clamp01(p.spread);
    const phaseJitter = (hash01(variationSeed) - 0.5) * spread;
    const angle = ((Number(p.phase) || 0) + phaseJitter + time * (Number(p.speed) || 0)) * TAU;
    const target = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius, z: center.z + Math.sin(angle) * (Number(p.depth) || 0) };
    return sub(target, point);
  }
  if (type === 'attract') {
    const target = { x: Number(p.targetX) || 0, y: Number(p.targetY) || 0, z: Number(p.targetZ) || 0 };
    const delta = sub(target, point);
    const radius = Math.max(0.0001, Number(p.radius) || 1);
    const falloff = Math.pow(Math.max(0, 1 - length(delta) / radius), Math.max(0.01, Number(p.falloff) || 1));
    return scale(normalize(delta), (Number(p.strength) || 0) * falloff);
  }
  if (type === 'explode') {
    const center = { x: Number(p.centerX) || 0, y: Number(p.centerY) || 0, z: Number(p.centerZ) || 0 };
    const radial = normalize(sub(point, center));
    const random = unitFromSeed(variationSeed);
    const spread = clamp01(p.spread);
    const direction = normalize({ x: mix(radial.x, random.x, spread), y: mix(radial.y, random.y, spread), z: mix(radial.z, random.z, spread) });
    return scale(direction, (Number(p.distance) || 0) * clamp01(p.progress));
  }
  return { x: 0, y: 0, z: 0 };
}

export function applyMotionBehaviors(point, centroid, glyphIdentity, behaviors, time, seed) {
  let result = { x: point.x, y: point.y, z: point.z || 0 };
  for (const behavior of behaviors || []) {
    const intensity = behavior?.enabled === false ? 0 : clamp01(behavior?.intensity);
    if (intensity === 0) continue;
    const variationSeed = ((seed >>> 0) ^ Math.imul((glyphIdentity + 1) >>> 0, 0x45d9f3b) ^ (behavior.seedOffset >>> 0)) >>> 0;
    const individual = evaluateOffset(behavior.type, result, behavior, time, variationSeed);
    const shared = evaluateOffset(behavior.type, centroid, behavior, time, behavior.seedOffset >>> 0);
    const cohesion = clamp01(behavior.cohesion);
    const offset = {
      x: mix(individual.x, shared.x, cohesion),
      y: mix(individual.y, shared.y, cohesion),
      z: mix(individual.z, shared.z, cohesion),
    };
    result = add(result, scale(offset, intensity));
  }
  return result;
}

export function applyMotionToLines(lines, behaviors, time, seed) {
  const points = lines.flatMap((line) => line.chars.map((char) => ({ x: char.x, y: char.y, z: 0 })));
  const centroid = centroidOf(points);
  let identity = 0;
  return lines.map((line) => ({
    ...line,
    chars: line.chars.map((char) => {
      const moved = applyMotionBehaviors({ x: char.x, y: char.y, z: 0 }, centroid, identity++, behaviors, time, seed);
      return { ...char, x: moved.x, y: moved.y };
    }),
  }));
}
```

- [ ] **Step 4: Executar proves i sintaxi**

Run: `node --test tests/motion.test.mjs`

Expected: `4` tests PASS, `0` FAIL.

Run: `node --check motion.js`

Expected: exit `0`.

- [ ] **Step 5: Commit**

```bash
git add motion.js tests/motion.test.mjs
git commit -m "feat: add deterministic motion behaviors"
```

---

### Task 4: Integració del moviment al pipeline 2D i 3D

**Files:**
- Modify: `engine.js:1-4,1364-1678,2325-2428`
- Modify: `tests/motion.test.mjs`

- [ ] **Step 1: Afegir una prova d’integració 2D vermella**

```js
// append to tests/motion.test.mjs
import { applyMotionToLines } from '../motion.js';

test('applyMotionToLines preserves metadata and moves positions only', () => {
  const lines = [{ y: 12, chars: [{ ch: 'A', x: 10, y: 12, accentT: 2 }] }];
  const behaviors = [{
    id: 'd', type: 'drift', enabled: true, intensity: 1, cohesion: 1,
    seedOffset: 1, params: { angle: 0, elevation: 0, distance: 20, speed: 0, phase: 0.25 },
  }];
  const moved = applyMotionToLines(lines, behaviors, 0, 1);
  assert.equal(moved[0].chars[0].x, 30);
  assert.equal(moved[0].chars[0].ch, 'A');
  assert.equal(moved[0].chars[0].accentT, 2);
  assert.equal(lines[0].chars[0].x, 10);
});
```

- [ ] **Step 2: Executar la prova per confirmar que protegeix el contracte**

Run: `node --test --test-name-pattern="applyMotionToLines" tests/motion.test.mjs`

Expected: PASS si Task 3 és correcta. Aquest pas fixa el contracte abans de tocar `engine.js`.

- [ ] **Step 3: Integrar el fast path 2D**

Afegir l’import al principi d’`engine.js`:

```js
import { applyMotionBehaviors, applyMotionToLines, centroidOf } from './motion.js';
```

Substituir la creació de `lines` del fast path 2D dins `buildScene()`:

```js
const laidOut = layout(params, width, height).lines;
const behaviors = Array.isArray(params.motionBehaviors) ? params.motionBehaviors : [];
const motionTime = Number.isFinite(params.directorTime) ? params.directorTime : 0;
const lines = behaviors.length
  ? applyMotionToLines(laidOut, behaviors, motionTime, params.seed >>> 0)
  : laidOut;
```

Expected: amb `motionBehaviors=[]`, `lines` conserva la mateixa referència i contingut que abans.

- [ ] **Step 4: Refactoritzar `build3D()` amb fast path i segona passada només quan hi ha moviment**

Substituir el helper local `transformPoint` per aquesta versió, que aplica el mateix offset al punt tangent de fallback:

```js
const transformPoint = (u, v, inst, rainDY, localMix, motionContext = null) => {
  let pt = morphSurface(u, v, inst, localMix);
  if (P.pulse > 0) {
    pt = { ...pt, x: pt.x * pulseScale, y: pt.y * pulseScale, z: pt.z * pulseScale };
  }
  if (rainDY !== 0) pt = { ...pt, y: pt.y + rainDY };
  if (motionContext?.behaviors.length) {
    const moved = applyMotionBehaviors(
      pt,
      motionContext.centroid,
      motionContext.identity,
      motionContext.behaviors,
      motionContext.time,
      seed,
    );
    pt = { ...pt, x: moved.x, y: moved.y, z: moved.z };
  }
  const rp = rotate3D(pt, ax, ay, az);
  return project(rp, P, width, height);
};
```

Abans del doble bucle de glifs, declarar:

```js
const motionBehaviors = Array.isArray(params.motionBehaviors) ? params.motionBehaviors : [];
const motionTime = Number.isFinite(params.directorTime) ? params.directorTime : 0;
const glyphs = [];
const pendingGlyphs = [];
let glyphIdentity = 0;
```

Convertir el bloc de projecció existent en el helper local següent, definit abans del doble bucle:

```js
const finalizeGlyph = (item, centroid) => {
  const { c, m0, inst, rainDY, localMix, yNorm } = item;
  const moved = motionBehaviors.length
    ? applyMotionBehaviors(item.pt, centroid, item.identity, motionBehaviors, motionTime, seed)
    : item.pt;
  const pt = {
    ...item.pt,
    x: moved.x,
    y: moved.y,
    z: moved.z,
  };
  const rp = rotate3D(pt, ax, ay, az);
  const rn = rotateDir({ x: pt.nx, y: pt.ny, z: pt.nz }, ax, ay, az);
  const pr = project(rp, P, width, height);
  const facing = rn.x * viewDir.x + rn.y * viewDir.y + rn.z * viewDir.z;
  const back = facing > 0;

  let matrixTransform = null;
  if (P.surfaceText) {
    let tx, ty;
    if (m0.tangent) {
      const rt = rotateDir(m0.tangent, ax, ay, az);
      if (P.projection === 'perspective') {
        tx = rt.x * pr.scale;
        ty = -rt.y * pr.scale;
      } else {
        const k = (0.45 * Math.min(width, height) * P.zoom) / FORM_SIZE_BASE;
        tx = (rt.x - rt.z) * Math.cos(Math.PI / 6) * k;
        ty = ((rt.x + rt.z) * Math.sin(Math.PI / 6) - rt.y) * k;
      }
    } else {
      const mT = mapUV(c.x + TANGENT_D, yNorm);
      const prSu = transformPoint(mT.u, mT.v, inst, rainDY, localMix, {
        centroid,
        identity: item.identity,
        behaviors: motionBehaviors,
        time: motionTime,
      });
      tx = prSu.X - pr.X;
      ty = prSu.Y - pr.Y;
    }
    const len = Math.hypot(tx, ty);
    if (len >= 1e-4) {
      const ca = tx / len;
      const sa = ty / len;
      const glyphScale = P.projection === 'perspective' ? pr.scale : 1;
      matrixTransform = {
        a: ca * glyphScale,
        b: sa * glyphScale,
        c: -sa * glyphScale,
        d: ca * glyphScale,
        e: pr.X,
        f: pr.Y,
      };
    }
  }

  return {
    ch: c.ch,
    X: pr.X,
    Y: pr.Y,
    z: rp.z,
    scale: pr.scale,
    back,
    matrixTransform,
    accentT: c.accentT || 0,
    blinkT: c.blinkT || 0,
    extraOp: c.extraOp !== undefined ? c.extraOp : 1,
    skew: c.skew || 0,
    sizeMul: c.sizeMul !== undefined ? c.sizeMul : 1,
  };
};
```

Al bucle existent, conservar tots els rolls en el mateix ordre. Després de pulse i rain, abans de `rotate3D`, crear l’entrada preparada:

```js
const prepared = {
  identity: glyphIdentity++,
  c,
  m0,
  pt,
  u: wu,
  v: wv,
  inst,
  rainDY,
  localMix,
  yNorm,
};
if (motionBehaviors.length) pendingGlyphs.push(prepared);
else glyphs.push(finalizeGlyph(prepared, { x: 0, y: 0, z: 0 }));
```

Eliminar d’aquest primer bucle l’antic bloc que començava amb `const rp = rotate3D` i acabava amb `glyphs.push`. Després del doble bucle, executar la segona passada només si cal:

```js
if (motionBehaviors.length) {
  const centroid = centroidOf(pendingGlyphs.map((item) => item.pt));
  for (const item of pendingGlyphs) glyphs.push(finalizeGlyph(item, centroid));
}
```

La construcció `{ ...item.pt, x, y, z }` preserva explícitament `nx/ny/nz`. Amb `motionBehaviors=[]`, no es crea cap entrada a `pendingGlyphs` i cada glif es projecta en la mateixa iteració que abans.

- [ ] **Step 5: Executar proves i checks de regressió**

Run: `node --test tests/motion.test.mjs tests/director.test.mjs`

Expected: totes les proves PASS.

Run: `node --check engine.js`

Expected: exit `0`.

Run: `git diff --check`

Expected: exit `0`.

- [ ] **Step 6: Commit**

```bash
git add engine.js tests/motion.test.mjs
git commit -m "feat: apply director motion in 2d and 3d"
```

---

### Task 5: Rellotge absolut i snapshot resolt a `main.js`

**Files:**
- Modify: `main.js:1-4,123-175,340-405`
- Modify: `engine.js:2325-2428,2500-2588`
- Modify: `director.js`
- Modify: `tests/director.test.mjs`

- [ ] **Step 1: Afegir prova de snapshot desactivat i loop exacte**

```js
// append to tests/director.test.mjs
test('disabled director returns the original base object', () => {
  const base = { morphT: 0.25 };
  const result = evaluateDirector({ version: 1, enabled: false, scenes: [] }, 10, base);
  assert.equal(result.params, base);
  assert.deepEqual(result.behaviors, []);
});
```

- [ ] **Step 2: Executar la prova**

Run: `node --test --test-name-pattern="disabled director" tests/director.test.mjs`

Expected: PASS. Si falla, corregir `evaluateDirector` abans de continuar.

- [ ] **Step 3: Importar l’avaluador i ampliar l’estat**

Al principi de `main.js`:

```js
import { DEFAULT_DIRECTOR, advanceDirectorTime, evaluateDirector, normalizeDirector, totalDuration } from './director.js';
```

Afegir a `state` abans dels custom data:

```js
director: structuredClone(DEFAULT_DIRECTOR),
directorTime: 0,
directorRate: 1,
directorLiveOverrides: {},
```

- [ ] **Step 4: Resoldre un únic snapshot abans de cada render**

Afegir abans de `render()`:

```js
function resolveRenderState(atTime = state.directorTime) {
  if (!state.director.enabled) return state;
  const resolved = evaluateDirector(state.director, atTime, state, state.directorLiveOverrides);
  const mode = resolved.params.mode || state.mode;
  const animationSpeed = mode === '2d'
    ? Number(resolved.params.speed2d ?? state.speed2d)
    : Number(resolved.params.speed3d ?? state.speed3d);
  return {
    ...state,
    ...resolved.params,
    t: atTime * (Number.isFinite(animationSpeed) ? animationSpeed : 1),
    morphClock: atTime,
    directorTime: atTime,
    motionBehaviors: resolved.behaviors,
    activeDirectorSceneId: resolved.sceneId,
  };
}
```

El Director substitueix `t` i `morphClock` només al snapshot de render, no a l’estat base. Això fa que rotacions, surface flow, morph auto i altres animacions temporals existents siguin navegables i exportables amb el mateix temps absolut.

- [ ] **Step 4b: Fer deterministes els efectes de blink durant Director**

Als objectes retornats pels paths 2D i 3D de `buildScene()` afegir:

```js
clockMs: Number.isFinite(params.directorTime) ? params.directorTime * 1000 : null,
```

A `drawScene()`, calcular una sola vegada abans de separar 2D/3D:

```js
const clockMs = Number.isFinite(scene.clockMs) ? scene.clockMs : performance.now();
```

Substituir les quatre crides actuals a `performance.now()` dels càlculs de blink 2D/3D per `clockMs`. Quan Director està desactivat, el comportament continua basat en el rellotge real actual.

Substituir `render()` per:

```js
function render(atTime = state.directorTime) {
  ensureCanvas();
  const renderState = resolveRenderState(atTime);
  const scene = buildScene(renderState, displayW, displayH);
  drawScene(displayCtx, scene, displayW, displayH, displayDpr);
}
```

- [ ] **Step 5: Fer avançar el Director en segons reals**

Dins `frame(ts)`, després de calcular `dt` i abans del render, afegir:

```js
if (state.director.enabled) {
  state.directorTime = advanceDirectorTime(
    state.directorTime,
    dt * state.directorRate,
    totalDuration(state.director),
    state.director.loop,
  );
}
```

No substituir `state.t` ni `state.morphClock`; segueixen existint per compatibilitat. El snapshot del Director pot automatitzar-los en una fase futura, però el rellotge de Director sempre usa segons reals.

- [ ] **Step 6: Verificar sintaxi, proves i commit**

Run: `node --test tests/director.test.mjs tests/motion.test.mjs`

Expected: totes PASS.

Run: `node --check main.js`

Run: `node --check engine.js`

Expected: exit `0`.

```bash
git add main.js engine.js director.js tests/director.test.mjs
git commit -m "feat: resolve director state by absolute time"
```

---

### Task 6: Shell del Director, inspector i timeline col·lapsable

**Files:**
- Create: `director-ui.js`
- Create: `tests/director-ui.test.mjs`
- Modify: `index.html:15-55,65-510,600-612`
- Modify: `styles.css:35-37,205-365,539-610`
- Modify: `main.js:669-745,1680-1744`

- [ ] **Step 1: Escriure una prova vermella del model de vista**

```js
// tests/director-ui.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { directorViewModel } from '../director-ui.js';

test('directorViewModel computes contiguous scene positions', () => {
  const view = directorViewModel({
    version: 1, enabled: true, loop: true,
    scenes: [
      { id: 'a', name: 'Flota', duration: 2, transition: { duration: 0 }, params: {}, behaviors: [], automations: {} },
      { id: 'b', name: 'Òrbita', duration: 3, transition: { duration: 0 }, params: {}, behaviors: [], automations: {} },
    ],
  }, 'b', 2.5);
  assert.deepEqual(view.scenes.map(({ id, start, end }) => ({ id, start, end })), [
    { id: 'a', start: 0, end: 2 },
    { id: 'b', start: 2, end: 5 },
  ]);
  assert.equal(view.activeScene.id, 'b');
  assert.equal(view.duration, 5);
});
```

- [ ] **Step 2: Executar i confirmar el vermell**

Run: `node --test tests/director-ui.test.mjs`

Expected: FAIL amb `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Crear el mòdul de UI amb model pur i muntatge mínim**

```js
// director-ui.js
import { normalizeDirector, totalDuration } from './director.js';

export function directorViewModel(input, selectedSceneId, time) {
  const director = normalizeDirector(input);
  let cursor = 0;
  const scenes = director.scenes.map((scene) => {
    const item = { ...scene, start: cursor, end: cursor + scene.duration };
    cursor += scene.duration;
    return item;
  });
  return {
    director,
    scenes,
    duration: totalDuration(director),
    time,
    activeScene: scenes.find((scene) => scene.id === selectedSceneId) || scenes[0],
  };
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

export function mountDirectorUI({ inspector, timeline, getState, onSelectScene, onSeek, onToggleEnabled }) {
  function render() {
    const state = getState();
    const view = directorViewModel(state.director, state.selectedDirectorSceneId, state.directorTime);
    const active = view.activeScene;
    inspector.innerHTML = `
      <h3 class="panel-title">Director</h3>
      <label class="control-row" for="directorEnabled"><span>Actiu</span><input id="directorEnabled" type="checkbox" ${view.director.enabled ? 'checked' : ''}></label>
      <p class="director-scene-name">${escapeHtml(active.name)}</p>
      <output id="directorTimeOutput">${view.time.toFixed(2)} s</output>
    `;
    timeline.innerHTML = `
      <div class="director-scenes" role="list" aria-label="Escenes">${view.scenes.map((scene) => {
        const width = (scene.duration / view.duration) * 100;
        return `<button type="button" role="listitem" class="director-scene${scene.id === active.id ? ' is-active' : ''}" data-scene-id="${escapeHtml(scene.id)}" style="width:${width}%">${escapeHtml(scene.name)}</button>`;
      }).join('')}</div>
      <label class="sr-only" for="directorPlayhead">Temps del Director</label>
      <input id="directorPlayhead" type="range" min="0" max="${view.duration}" step="0.01" value="${view.time}">
    `;
    inspector.querySelector('#directorEnabled').addEventListener('change', (event) => onToggleEnabled(event.target.checked));
    timeline.querySelector('#directorPlayhead').addEventListener('input', (event) => onSeek(Number(event.target.value)));
    timeline.querySelectorAll('[data-scene-id]').forEach((button) => button.addEventListener('click', () => onSelectScene(button.dataset.sceneId)));
  }
  function setTime(time, sceneId) {
    const playhead = timeline.querySelector('#directorPlayhead');
    const output = inspector.querySelector('#directorTimeOutput');
    if (playhead) playhead.value = String(time);
    if (output) output.textContent = `${time.toFixed(2)} s`;
    timeline.querySelectorAll('[data-scene-id]').forEach((button) => {
      button.classList.toggle('is-playing', button.dataset.sceneId === sceneId);
    });
  }
  render();
  return { render, setTime };
}
```

- [ ] **Step 4: Afegir HTML semàntic**

Afegir al menú després de Presets:

```html
<button class="app-menu-item" type="button" data-panel-target="panel-director" aria-pressed="false">
  <span class="app-menu-mark" aria-hidden="true">[ ]</span>
  <span>Director</span>
</button>
```

Afegir dins `#controls` abans de `panel-export`:

```html
<section class="panel" id="panel-director" hidden>
  <div id="directorInspector"></div>
</section>
```

Afegir dins `.stage`, després de `.canvas-shell`:

```html
<div id="directorLivePads" class="director-live-pads" hidden aria-label="Controls en viu"></div>
```

Afegir després de `</main>` i abans de l’script:

```html
<section id="directorDock" class="director-dock" aria-label="Timeline del Director" hidden>
  <button type="button" id="directorResize" class="director-resize" role="separator" aria-orientation="horizontal" aria-label="Canvia l’alçada de la timeline" aria-valuemin="140" aria-valuemax="480" aria-valuenow="220"></button>
  <div class="director-transport" role="toolbar" aria-label="Transport del Director">
    <button type="button" id="directorStop">Atura</button>
    <button type="button" id="directorHold" aria-pressed="false">Hold</button>
    <button type="button" id="directorReverse" aria-pressed="false">Reverse</button>
    <button type="button" id="directorRecord" aria-pressed="false">REC</button>
    <button type="button" id="directorLoop" aria-pressed="true">Loop</button>
    <button type="button" id="directorCollapse" aria-expanded="true">Timeline</button>
  </div>
  <div id="directorTimeline"></div>
</section>
```

- [ ] **Step 5: Afegir CSS del dock sense alterar el layout normal**

```css
body[data-director-open] .stage { padding-bottom: var(--director-dock-height, 220px); }

.director-dock {
  position: fixed;
  z-index: 20;
  right: 0;
  bottom: 0;
  left: calc(var(--app-menu-width) + var(--sidebar-width));
  height: var(--director-dock-height, 220px);
  padding: var(--space-3);
  overflow: auto;
  border-top: 1px solid var(--rule);
  background: var(--ink);
  color: var(--paper);
}

.director-dock[hidden] { display: none; }
.director-resize { position: absolute; top: 0; right: 0; left: 0; width: 100%; height: 8px; padding: 0; border: 0; cursor: ns-resize; }
body[data-director-collapsed] .director-dock { height: auto; }
body[data-director-collapsed] #directorTimeline { display: none; }
body[data-director-collapsed][data-director-open] .stage { padding-bottom: 52px; }
.director-transport { display: flex; gap: var(--space-1); margin-bottom: var(--space-2); }
.director-scenes { display: flex; min-height: 44px; }
.director-scene { min-width: 48px; border-color: var(--ink-3); color: var(--paper); background: transparent; }
.director-scene.is-active { background: var(--paper); color: var(--ink); }
#directorPlayhead { width: 100%; }
.director-live-pads { position: absolute; right: var(--space-4); bottom: calc(var(--director-dock-height, 220px) + var(--space-4)); z-index: 10; }
body[data-nav-collapsed] .director-dock { left: var(--sidebar-width); }

@media (max-width: 860px) {
  .director-dock { position: static; width: 100%; height: auto; }
  body[data-director-open] .stage { padding-bottom: 0; }
}
```

- [ ] **Step 6: Muntar la UI des de `main.js`**

Importar:

```js
import { mountDirectorUI } from './director-ui.js';
```

Afegir a `state`:

```js
selectedDirectorSceneId: 'scene-1',
```

Afegir funció:

```js
let directorUI = null;
let lastAnnouncedDirectorSceneId = null;

function wireDirector() {
  directorUI = mountDirectorUI({
    inspector: $('directorInspector'),
    timeline: $('directorTimeline'),
    getState: () => state,
    onSelectScene: (id) => { state.selectedDirectorSceneId = id; directorUI.render(); },
    onSeek: (time) => { state.directorTime = time; render(time); directorUI.render(); },
    onToggleEnabled: (enabled) => { state.director = { ...state.director, enabled }; scheduleRender(); directorUI.render(); },
  });
}
```

Afegir dins `wireDirector()` el resize per pointer i teclat:

```js
const resizeHandle = $('directorResize');
let resizeStart = null;
resizeHandle.addEventListener('pointerdown', (event) => {
  resizeStart = { y: event.clientY, height: $('directorDock').getBoundingClientRect().height };
  resizeHandle.setPointerCapture(event.pointerId);
});
resizeHandle.addEventListener('pointermove', (event) => {
  if (!resizeStart) return;
  const height = Math.max(140, Math.min(480, resizeStart.height + resizeStart.y - event.clientY));
  document.body.style.setProperty('--director-dock-height', `${height}px`);
  resizeHandle.setAttribute('aria-valuenow', String(Math.round(height)));
  resizeCanvas();
});
resizeHandle.addEventListener('pointerup', () => { resizeStart = null; });
resizeHandle.addEventListener('pointercancel', () => { resizeStart = null; });
resizeHandle.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  const current = Number(resizeHandle.getAttribute('aria-valuenow')) || 220;
  const height = Math.max(140, Math.min(480, current + (event.key === 'ArrowUp' ? 10 : -10)));
  document.body.style.setProperty('--director-dock-height', `${height}px`);
  resizeHandle.setAttribute('aria-valuenow', String(height));
  resizeCanvas();
  event.preventDefault();
});
```

Al final de `render()`, després de `drawScene(...)`, afegir:

```js
directorUI?.setTime(atTime, renderState.activeDirectorSceneId);
if (state.director.enabled && renderState.activeDirectorSceneId !== lastAnnouncedDirectorSceneId) {
  lastAnnouncedDirectorSceneId = renderState.activeDirectorSceneId;
  const active = state.director.scenes.find((item) => item.id === renderState.activeDirectorSceneId);
  if (active) announce(`Escena ${active.name}`);
}
```

Això mou playhead i classe `.is-playing` sense reconstruir tota la timeline, i només escriu al live region quan canvia l’escena.

Cridar `wireDirector()` a `init()` després de `wirePresets()`.

A `activatePanel()`, afegir:

```js
const directorOpen = panelId === 'panel-director';
document.body.toggleAttribute('data-director-open', directorOpen);
$('directorDock').hidden = !directorOpen;
$('directorLivePads').hidden = !directorOpen;
if (directorOpen) directorUI?.render();
resizeCanvas();
```

- [ ] **Step 7: Proves, sintaxi i commit**

Run: `node --test tests/director-ui.test.mjs tests/director.test.mjs tests/motion.test.mjs`

Expected: totes PASS.

Run: `node --check director-ui.js`

Run: `node --check main.js`

Expected: exit `0`.

```bash
git add director-ui.js tests/director-ui.test.mjs index.html styles.css main.js
git commit -m "feat: add director timeline shell"
```

---

### Task 7: Edició d’escenes i pistes d’automatització

**Files:**
- Modify: `director.js`
- Modify: `director-ui.js`
- Modify: `index.html`
- Modify: `tests/director.test.mjs`
- Modify: `tests/director-ui.test.mjs`

- [ ] **Step 1: Escriure proves vermelles d’edició immutable**

```js
// append to tests/director.test.mjs
import {
  addScene, duplicateScene, moveScene, removeScene, upsertKeyframe,
  upsertBehavior, updateBehavior, removeBehavior, isAutomatablePath,
} from '../director.js';

test('scene editing is immutable and never removes the final scene', () => {
  const base = normalizeDirector(null);
  const added = addScene(base, { name: 'Òrbita', duration: 3 });
  const duplicated = duplicateScene(added, added.scenes[1].id);
  const moved = moveScene(duplicated, 2, 0);
  const removed = removeScene(moved, moved.scenes[1].id);
  assert.equal(base.scenes.length, 1);
  assert.equal(added.scenes.length, 2);
  assert.equal(duplicated.scenes.length, 3);
  assert.equal(removed.scenes.length, 2);
  assert.equal(removeScene(base, base.scenes[0].id).scenes.length, 1);
});

test('upsertKeyframe clamps time and replaces same-time values', () => {
  const scene = normalizeDirector(null).scenes[0];
  const once = upsertKeyframe(scene, 'param:morphT', { time: 8, value: 0.4, easing: 'linear' });
  const twice = upsertKeyframe(once, 'param:morphT', { time: 5, value: 0.8, easing: 'ease-out' });
  assert.deepEqual(twice.automations['param:morphT'], [{ time: 5, value: 0.8, easing: 'ease-out' }]);
});

test('behavior editing creates supported defaults and stays immutable', () => {
  const scene = normalizeDirector(null).scenes[0];
  const withOrbit = upsertBehavior(scene, 'orbit');
  const id = withOrbit.behaviors[0].id;
  const updated = updateBehavior(withOrbit, id, { intensity: 0.75, params: { radius: 240 } });
  const removed = removeBehavior(updated, id);
  assert.equal(scene.behaviors.length, 0);
  assert.equal(withOrbit.behaviors[0].type, 'orbit');
  assert.equal(updated.behaviors[0].intensity, 0.75);
  assert.equal(updated.behaviors[0].params.radius, 240);
  assert.equal(removed.behaviors.length, 0);
});

test('automation allowlist accepts known paths and rejects arbitrary state', () => {
  assert.equal(isAutomatablePath('param:morphT'), true);
  assert.equal(isAutomatablePath('param:textColor'), true);
  assert.equal(isAutomatablePath('param:director'), false);
  assert.equal(isAutomatablePath('behavior:orbit-1:intensity'), true);
});
```

- [ ] **Step 2: Executar i confirmar el vermell**

Run: `node --test --test-name-pattern="scene editing|upsertKeyframe|behavior editing|automation allowlist" tests/director.test.mjs`

Expected: FAIL per exportacions inexistents.

- [ ] **Step 3: Implementar helpers immutables**

```js
// append to director.js
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

export function upsertBehavior(sceneInput, type) {
  const scene = normalizeScene(sceneInput);
  if (!(type in BEHAVIOR_DEFAULTS)) return scene;
  if (scene.behaviors.some((behavior) => behavior.type === type)) return scene;
  const behavior = normalizeBehavior({
    id: `${type}-${scene.behaviors.length + 1}`,
    type,
    enabled: true,
    intensity: 1,
    cohesion: 1,
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
```

- [ ] **Step 4: Ampliar la UI amb accions explícites**

Afegir a l’inspector generat per `mountDirectorUI()`:

```html
<div class="director-scene-actions" role="group" aria-label="Accions d’escena">
  <button type="button" data-director-action="add">Afegeix</button>
  <button type="button" data-director-action="duplicate">Duplica</button>
  <button type="button" data-director-action="left">←</button>
  <button type="button" data-director-action="right">→</button>
  <button type="button" data-director-action="delete">Elimina</button>
</div>
<label class="control-row" for="directorSceneDuration"><span>Durada</span><input id="directorSceneDuration" type="number" min="0.1" max="3600" step="0.1" value="${active.duration}"></label>
<label class="control-row" for="directorTransitionDuration"><span>Transició</span><input id="directorTransitionDuration" type="number" min="0" max="${active.duration}" step="0.1" value="${active.transition.duration}"></label>
<label class="control-row" for="directorTransitionEasing"><span>Easing</span><select id="directorTransitionEasing"><option>linear</option><option>ease-in</option><option>ease-out</option><option selected>ease-in-out</option></select></label>
<div class="director-behavior-palette" role="group" aria-label="Afegeix comportament">
  <button type="button" data-add-behavior="drift">Deriva</button>
  <button type="button" data-add-behavior="orbit">Òrbita</button>
  <button type="button" data-add-behavior="attract">Atracció</button>
  <button type="button" data-add-behavior="explode">Explosió</button>
</div>
```

Ampliar l’API de `mountDirectorUI` amb `onSceneAction`, `onSceneDuration`, `onTransitionChange`, `onAddBehavior`, `onUpdateBehavior`, `onRemoveBehavior` i `onAddKeyframe`. Cada listener només emet una acció; `main.js` aplica els helpers purs, actualitza `state.director`, manté una selecció vàlida i crida `directorUI.render()`.

Afegir a `main.js` aquests adaptadors, important els helpers corresponents des de `director.js`:

```js
function replaceDirectorScene(nextScene) {
  state.director = {
    ...state.director,
    scenes: state.director.scenes.map((scene) => scene.id === nextScene.id ? nextScene : scene),
  };
  directorUI.render();
  scheduleRender();
}

function selectedDirectorScene() {
  return state.director.scenes.find((scene) => scene.id === state.selectedDirectorSceneId) || state.director.scenes[0];
}

function handleDirectorSceneAction(action) {
  const scene = selectedDirectorScene();
  const index = state.director.scenes.findIndex((item) => item.id === scene.id);
  if (action === 'add') state.director = addScene(state.director, { name: `Escena ${state.director.scenes.length + 1}` });
  if (action === 'duplicate') state.director = duplicateScene(state.director, scene.id);
  if (action === 'left') state.director = moveScene(state.director, index, index - 1);
  if (action === 'right') state.director = moveScene(state.director, index, index + 1);
  if (action === 'delete') state.director = removeScene(state.director, scene.id);
  if (!state.director.scenes.some((item) => item.id === state.selectedDirectorSceneId)) {
    state.selectedDirectorSceneId = state.director.scenes[Math.min(index, state.director.scenes.length - 1)].id;
  }
  directorUI.render();
  scheduleRender();
}

function updateSelectedSceneDuration(duration) {
  const scene = selectedDirectorScene();
  replaceDirectorScene(normalizeScene({ ...scene, duration }));
}

function updateSelectedTransition(patch) {
  const scene = selectedDirectorScene();
  replaceDirectorScene(normalizeScene({ ...scene, transition: { ...scene.transition, ...patch } }));
}

function addSelectedBehavior(type) {
  replaceDirectorScene(upsertBehavior(selectedDirectorScene(), type));
}

function updateSelectedBehavior(id, patch) {
  replaceDirectorScene(updateBehavior(selectedDirectorScene(), id, patch));
}

function removeSelectedBehavior(id) {
  replaceDirectorScene(removeBehavior(selectedDirectorScene(), id));
}
```

Definir a `director-ui.js` els camps numèrics visibles per comportament:

```js
const BEHAVIOR_FIELDS = Object.freeze({
  drift: ['angle', 'elevation', 'distance', 'speed', 'phase'],
  orbit: ['centerX', 'centerY', 'centerZ', 'radius', 'speed', 'phase', 'depth', 'spread'],
  attract: ['targetX', 'targetY', 'targetZ', 'strength', 'radius', 'falloff'],
  explode: ['centerX', 'centerY', 'centerZ', 'distance', 'spread', 'progress'],
});

export const AUTOMATION_CONTROL_IDS = Object.freeze({
  morphT: 'rng-morphT', morphSpeed: 'rng-morphSpeed', morphScatter: 'rng-morphScatter', morphSpeedVar: 'rng-morphSpeedVar',
  zoom: 'rng-zoom', angleX: 'rng-angleX', angleY: 'rng-angleY', depthFade: 'rng-depthFade',
  formSize: 'rng-formSize', pulse: 'rng-pulse', noiseTexture: 'rng-noiseTexture',
  textColor: 'textColor', bgColor: 'bgColor', form: 'form', projection: 'projection',
});
```

Per cada comportament actiu, renderitzar `intensity`, `cohesion`, els camps de `BEHAVIOR_FIELDS[type]`, un diamant amb path `behavior:<id>:<field>` i un botó Elimina. Si `behavior.unsupported` és true, renderitzar el tipus com a «no compatible» i no mostrar controls executables.

Importar també `AUTOMATION_CONTROL_IDS` a `main.js`. Després de `buildSliders()` a `init()`, recórrer el mapa, trobar cada control i inserir un botó diamant adjacent amb `data-automation-path=<nom>`. No duplicar-lo si el control ja té un germà amb el mateix path.

```js
function installAutomationButtons() {
  for (const [name, id] of Object.entries(AUTOMATION_CONTROL_IDS)) {
    const control = $(id);
    if (!control || document.querySelector(`[data-automation-path="${name}"]`)) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'automation-key-button';
    button.dataset.automationPath = name;
    button.setAttribute('aria-label', `Afegeix keyframe a ${name}`);
    button.textContent = '◇';
    control.insertAdjacentElement('afterend', button);
  }
}
```

Per automatització, importar `AUTOMATABLE_PARAMS` des de `director.js` i afegir un botó diamant al costat dels controls autoritzats amb `data-automation-path`. En clicar-lo:

```js
const name = control.dataset.automationPath;
const kind = AUTOMATABLE_PARAMS[name];
const value = kind === 'number' ? Number(control.value) : control.value;
onAddKeyframe(`param:${name}`, value);
```

`main.js` calcula `const { localTime } = evaluateDirector(state.director, state.directorTime, state);` i aplica `upsertKeyframe` a l’escena seleccionada amb `{ time: localTime, value, easing: kind === 'hold' ? 'hold' : 'linear' }`.

Afegir les pistes de l’escena activa a la timeline:

```js
const lanes = Object.entries(active.automations).map(([path, frames]) => `
  <div class="director-lane" data-lane-path="${escapeHtml(path)}">
    <span>${escapeHtml(path)}</span>
    <div class="director-keyframes">${frames.map((frame) => `<button type="button" class="director-keyframe" style="left:${(frame.time / active.duration) * 100}%" aria-label="${escapeHtml(path)} a ${frame.time.toFixed(2)} segons"></button>`).join('')}</div>
  </div>
`).join('');
```

Afegir listeners de transport a `wireDirector()`:

```js
$('directorStop').addEventListener('click', () => { pause(); state.directorTime = 0; render(0); directorUI.render(); });
$('directorHold').addEventListener('click', () => {
  if (playing) pause(); else play();
  $('directorHold').setAttribute('aria-pressed', String(!playing));
});
$('directorReverse').addEventListener('click', () => {
  state.directorRate *= -1;
  $('directorReverse').setAttribute('aria-pressed', String(state.directorRate < 0));
});
$('directorLoop').addEventListener('click', () => {
  state.director = { ...state.director, loop: !state.director.loop };
  $('directorLoop').setAttribute('aria-pressed', String(state.director.loop));
});
$('directorCollapse').addEventListener('click', () => {
  const collapsed = document.body.toggleAttribute('data-director-collapsed');
  $('directorCollapse').setAttribute('aria-expanded', String(!collapsed));
});
```

- [ ] **Step 5: Executar proves i commit**

Run: `node --test tests/director.test.mjs tests/director-ui.test.mjs`

Expected: totes PASS.

```bash
git add director.js director-ui.js index.html main.js tests/director.test.mjs tests/director-ui.test.mjs
git commit -m "feat: edit director scenes and keyframes"
```

---

### Task 8: Pads en viu i gravació simplificada a keyframes

**Files:**
- Modify: `director.js`
- Modify: `director-ui.js`
- Modify: `main.js`
- Modify: `index.html`
- Modify: `tests/director.test.mjs`

- [ ] **Step 1: Escriure prova vermella de simplificació de mostres**

```js
// append to tests/director.test.mjs
import { simplifySamples } from '../director.js';

test('simplifySamples keeps endpoints and meaningful changes', () => {
  const result = simplifySamples([
    { time: 0, value: 0 },
    { time: 0.1, value: 0.01 },
    { time: 0.2, value: 0.5 },
    { time: 0.3, value: 0.51 },
    { time: 0.4, value: 1 },
  ], 0.05);
  assert.deepEqual(result, [
    { time: 0, value: 0, easing: 'linear' },
    { time: 0.2, value: 0.5, easing: 'linear' },
    { time: 0.4, value: 1, easing: 'linear' },
  ]);
});
```

- [ ] **Step 2: Executar i confirmar el vermell**

Run: `node --test --test-name-pattern="simplifySamples" tests/director.test.mjs`

Expected: FAIL per exportació inexistent.

- [ ] **Step 3: Implementar simplificació determinista**

```js
// append to director.js
export function simplifySamples(samples, tolerance = 0.02) {
  const sorted = (Array.isArray(samples) ? samples : [])
    .filter((sample) => Number.isFinite(sample?.time) && Number.isFinite(sample?.value))
    .sort((a, b) => a.time - b.time);
  if (sorted.length <= 2) return sorted.map((sample) => ({ ...sample, easing: 'linear' }));
  const kept = [{ ...sorted[0], easing: 'linear' }];
  for (let index = 1; index < sorted.length - 1; index++) {
    const current = sorted[index];
    if (Math.abs(current.value - kept.at(-1).value) >= tolerance) kept.push({ ...current, easing: 'linear' });
  }
  kept.push({ ...sorted.at(-1), easing: 'linear' });
  return kept;
}
```

- [ ] **Step 4: Crear pads accessibles i events pointer/keyboard**

Renderitzar a `#directorLivePads`:

```html
<button type="button" data-live-behavior="attract" data-live-value="1">ATTRACT</button>
<button type="button" data-live-behavior="attract" data-live-value="-1">REPEL</button>
<button type="button" data-live-behavior="explode" data-live-value="1">EXPLODE</button>
```

`director-ui.js` ha d’emetre `onLiveStart(type, value)` en `pointerdown`/`keydown` i `onLiveEnd(type)` en `pointerup`, `pointercancel`, `keyup` i `blur`. Usar `setPointerCapture()` quan hi hagi `pointerId`.

- [ ] **Step 5: Capturar overrides i gravar-los**

Afegir `simplifySamples` a l’import existent de `./director.js` a `main.js`.

Afegir a `state`:

```js
directorRecording: false,
directorRecordedSamples: {},
directorActiveLive: {},
```

Afegir a `main.js`:

```js
function setLiveBehavior(type, value) {
  const activeSceneId = evaluateDirector(state.director, state.directorTime, state).sceneId;
  const scene = state.director.scenes.find((item) => item.id === activeSceneId);
  const behavior = scene?.behaviors.find((item) => item.type === type);
  if (!behavior) return;
  const field = type === 'attract' ? 'strength' : 'progress';
  const baseValue = Number(behavior.params[field]) || 0;
  const liveValue = type === 'attract' ? value * Math.max(1, Math.abs(baseValue)) : Math.max(0, value);
  state.directorActiveLive = {
    ...state.directorActiveLive,
    [type]: { sceneId: scene.id, behaviorId: behavior.id, field, baseValue },
  };
  state.directorLiveOverrides = {
    ...state.directorLiveOverrides,
    [behavior.id]: { params: { [field]: liveValue } },
  };
  if (state.directorRecording) {
    const path = `${scene.id}|behavior:${behavior.id}:${field}`;
    const list = state.directorRecordedSamples[path] || [];
    state.directorRecordedSamples = { ...state.directorRecordedSamples, [path]: [...list, { time: state.directorTime, value: liveValue }] };
  }
  scheduleRender();
}

function clearLiveBehavior(type) {
  const active = state.directorActiveLive[type];
  if (!active) return;
  const scene = state.director.scenes.find((item) => item.id === active.sceneId);
  const behavior = scene?.behaviors.find((item) => item.id === active.behaviorId);
  if (!scene || !behavior) return;
  const { field, baseValue } = active;
  if (state.directorRecording) {
    const path = `${scene.id}|behavior:${behavior.id}:${field}`;
    const list = state.directorRecordedSamples[path] || [];
    state.directorRecordedSamples = { ...state.directorRecordedSamples, [path]: [...list, { time: state.directorTime, value: baseValue }] };
  }
  const next = { ...state.directorLiveOverrides };
  delete next[behavior.id];
  state.directorLiveOverrides = next;
  const activeNext = { ...state.directorActiveLive };
  delete activeNext[type];
  state.directorActiveLive = activeNext;
  scheduleRender();
}

function finishDirectorRecording() {
  let director = normalizeDirector(state.director);
  for (const [compoundPath, samples] of Object.entries(state.directorRecordedSamples)) {
    const separator = compoundPath.indexOf('|');
    const sceneId = compoundPath.slice(0, separator);
    const path = compoundPath.slice(separator + 1);
    const sceneIndex = director.scenes.findIndex((scene) => scene.id === sceneId);
    if (sceneIndex < 0) continue;
    const sceneStart = director.scenes.slice(0, sceneIndex).reduce((sum, scene) => sum + scene.duration, 0);
    const scene = director.scenes[sceneIndex];
    const frames = simplifySamples(samples, 0.02).map((frame) => ({
      time: Math.max(0, Math.min(scene.duration, frame.time - sceneStart)),
      value: frame.value,
      easing: 'linear',
    }));
    const scenes = director.scenes.slice();
    scenes[sceneIndex] = { ...scene, automations: { ...scene.automations, [path]: frames } };
    director = { ...director, scenes };
  }
  state.director = director;
  state.directorRecording = false;
  state.directorRecordedSamples = {};
  $('directorRecord').setAttribute('aria-pressed', 'false');
  directorUI.render();
}

$('directorRecord').addEventListener('click', () => {
  if (state.directorRecording) {
    finishDirectorRecording();
  } else {
    state.directorRecording = true;
    state.directorRecordedSamples = {};
    $('directorRecord').setAttribute('aria-pressed', 'true');
  }
});
```

El primer `|` de cada clau separa `sceneId` i path. Això permet gravar una intervenció que travessa diversos canvis d’escena sense assignar mostres a l’escena equivocada.

- [ ] **Step 6: Proves i commit**

Run: `node --test tests/director.test.mjs tests/director-ui.test.mjs`

Expected: totes PASS.

```bash
git add director.js director-ui.js main.js index.html tests/director.test.mjs
git commit -m "feat: record live director gestures"
```

---

### Task 9: Presets versionats i export offline frame-exact

**Files:**
- Create: `export-video.js`
- Create: `tests/export-video.test.mjs`
- Create: `tests/project-wiring.test.mjs`
- Modify: `main.js:1137-1368`
- Modify: `director.js`

- [ ] **Step 1: Escriure proves vermelles per frames d’export i wiring de presets**

```js
// tests/export-video.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { directorFrameTimes, encodeDirectorFrames } from '../export-video.js';

test('directorFrameTimes covers frame zero and excludes the end sentinel', () => {
  assert.deepEqual(directorFrameTimes(1, 4), [0, 0.25, 0.5, 0.75]);
});

test('directorFrameTimes rejects invalid duration or fps', () => {
  assert.deepEqual(directorFrameTimes(0, 30), []);
  assert.deepEqual(directorFrameTimes(1, 0), []);
});

test('encodeDirectorFrames renders and encodes the same absolute times', async () => {
  const rendered = [];
  const encoded = [];
  await encodeDirectorFrames({
    duration: 1,
    fps: 2,
    renderAt: (time) => rendered.push(time),
    encodeCanvas: (index, fps) => encoded.push([index, fps]),
    yieldEvery: 99,
  });
  assert.deepEqual(rendered, [0, 0.5]);
  assert.deepEqual(encoded, [[0, 2], [1, 2]]);
});
```

```js
// tests/project-wiring.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('preset capture and apply include director data', async () => {
  const source = await readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(source, /snap\.director\s*=\s*structuredClone\(state\.director\)/);
  assert.match(source, /state\.director\s*=\s*normalizeDirector\(p\.director\)/);
});

test('director UI is wired in HTML and CSS', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const engine = await readFile(new URL('../engine.js', import.meta.url), 'utf8');
  assert.match(html, /id="panel-director"/);
  assert.match(html, /id="directorDock"/);
  assert.match(css, /\.director-dock/);
  assert.match(engine, /applyMotionBehaviors/);
  assert.match(engine, /clockMs/);
});
```

- [ ] **Step 2: Executar i confirmar el vermell**

Run: `node --test tests/export-video.test.mjs tests/project-wiring.test.mjs`

Expected: FAIL per `export-video.js` absent i wiring de preset encara absent.

- [ ] **Step 3: Crear helpers d’export**

```js
// export-video.js
export function directorFrameTimes(duration, fps) {
  if (!(duration > 0) || !(fps > 0)) return [];
  const count = Math.max(1, Math.round(duration * fps));
  return Array.from({ length: count }, (_, index) => index / fps);
}

export async function encodeDirectorFrames({ duration, fps, renderAt, encodeCanvas, onProgress, yieldEvery = 8 }) {
  const times = directorFrameTimes(duration, fps);
  for (let index = 0; index < times.length; index++) {
    renderAt(times[index]);
    encodeCanvas(index, fps);
    onProgress?.(index + 1, times.length);
    if ((index + 1) % yieldEvery === 0) await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return times.length;
}
```

- [ ] **Step 4: Persistir Director sense trencar presets antics**

Al final de `capturePreset()` abans del `return`:

```js
snap.director = structuredClone(state.director);
```

Al principi d’`applyPreset(p)`, després de validar `p.v`:

```js
state.director = normalizeDirector(p.director);
state.directorTime = 0;
state.selectedDirectorSceneId = state.director.scenes[0].id;
state.directorLiveOverrides = {};
if (state.director.unsupportedVersion) {
  setPresetStatus('Aquest preset usa una versió més nova del Director; es carrega la composició base amb Director desactivat.');
}
```

Si `p.director` no existeix, `normalizeDirector(undefined)` retorna Director desactivat i el preset antic conserva el render base.

- [ ] **Step 5: Afegir export complet del Director**

Importar:

```js
import { encodeDirectorFrames } from './export-video.js';
```

Separar la codificació actual de `captureFrame()` en una funció que accepti índex explícit:

```js
function encodeCurrentCanvas(frameIndex, fps) {
  const ts = Math.round(frameIndex * (1_000_000 / fps));
  const videoFrame = new VideoFrame(displayCanvas, { timestamp: ts });
  recState.videoEncoder.encode(videoFrame, { keyFrame: frameIndex % (fps * 2) === 0 });
  videoFrame.close();
}
```

Reescriure l’inici de `captureFrame()` perquè el camí manual reutilitzi el helper i mantingui el comptador actual:

```js
function captureFrame() {
  if (!recState.isRecording || !recState.videoEncoder || !displayCanvas) return;
  const fps = getRecordFps();
  encodeCurrentCanvas(recState.frameN, fps);
  recState.frameN++;

  if (recState.frameN % fps === 0) {
    const elapsed = Math.round(recState.frameN / fps);
    if (recState.loopTotal > 0) {
      const remaining = Math.ceil((recState.loopTotal - recState.frameN) / fps);
      setExportStatus(`Gravant… ${remaining}s restants`);
    } else {
      setExportStatus(`Gravant… ${elapsed}s`);
    }
  }
  if (recState.loopTotal > 0 && recState.frameN >= recState.loopTotal) stopRecord();
}
```

Després de configurar encoder/muxer dins `startRecord()`, si Director està actiu:

```js
const duration = totalDuration(state.director);
const wasPlaying = playing;
pause();
recState.isRecording = true;
try {
  await encodeDirectorFrames({
    duration,
    fps,
    renderAt: (time) => render(time),
    encodeCanvas: (index, exportFps) => encodeCurrentCanvas(index, exportFps),
    onProgress: (done, total) => setExportStatus(`Exportant Director… ${done}/${total}`),
  });
  await stopRecord();
} finally {
  state.directorTime = 0;
  render(0);
  if (wasPlaying) play();
}
return;
```

El camí actual de gravació en temps real es conserva quan Director està desactivat.

- [ ] **Step 5b: Fer que SVG i PNG exportin el frame resolt actual**

A `saveSVG()` substituir l’ús directe de `state`:

```js
const exportState = resolveRenderState(state.directorTime);
const svg = buildSVG(exportState, width, height);
```

A `savePNG()` substituir l’ús directe de `state`:

```js
const exportState = resolveRenderState(state.directorTime);
const scene = buildScene(exportState, w, h);
```

Quan Director està desactivat, `resolveRenderState()` retorna el mateix objecte `state`, de manera que aquest canvi conserva el camí anterior.

- [ ] **Step 6: Executar proves i commit**

Run: `node --test tests/*.test.mjs`

Expected: totes PASS.

Run: `node --check export-video.js`

Run: `node --check main.js`

Expected: exit `0`.

```bash
git add export-video.js tests/export-video.test.mjs tests/project-wiring.test.mjs main.js director.js
git commit -m "feat: persist and export director timelines"
```

---

### Task 10: Verificació completa, accessibilitat i memòria del projecte

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `main.js`
- Modify: `docs/STATUS.md`
- Modify: `docs/HANDOFF.md`
- Modify: `docs/progress.md`
- Modify: `docs/decisions.md` only if implementation reveals a real new decision

- [ ] **Step 1: Executar la suite completa i checks de sintaxi**

Run: `node --test tests/*.test.mjs`

Expected: `0` failures.

Run: `node --check main.js`

Run: `node --check engine.js`

Run: `node --check director.js`

Run: `node --check motion.js`

Run: `node --check director-ui.js`

Run: `node --check export-video.js`

Expected: exit `0`.

Run: `git diff --check`

Expected: exit `0`.

- [ ] **Step 2: Servir l’app i verificar el flux al navegador real**

Run: `php -S 127.0.0.1:8080`

Expected: servidor local disponible a `http://127.0.0.1:8080`.

Validar amb el navegador integrat, en aquest ordre:

1. L’app antiga arrenca i renderitza amb Director desactivat.
2. Obrir Director no canvia la mida del canvas de manera incorrecta.
3. Activar Director i crear tres escenes: Flota, Òrbita, Sortida.
4. Fer scrub als límits exactes entre escenes; no hi ha frame blanc ni salt de seed.
5. Provar reverse i loop.
6. Provar deriva, òrbita, atracció, repulsió, explosió i reagrupament en 2D i 3D.
7. Provar cohesió `0`, `0.5` i `1`.
8. Gravar un pad amb `REC`, reproduir-lo i confirmar que genera keyframes editables.
9. Desar el preset, recarregar-lo i confirmar escena, temps, comportaments i pistes.
10. Carregar un preset antic i confirmar que Director queda desactivat.
11. Exportar la peça completa a 30 fps i comparar visualment els frames inicial, central i final amb el preview als mateixos temps.
12. Amb text llarg, comparar l’FPS mitjà durant 10 segons amb Director desactivat abans/després; acceptar com a màxim una regressió del 5%.
13. Activar els quatre comportaments simultanis i confirmar que preview, scrub i controls continuen responent sense bloquejos llargs.

- [ ] **Step 3: Verificar accessibilitat i responsive**

- Navegar menú, inspector, escenes, playhead i pads només amb teclat.
- Confirmar focus visible a tots els controls.
- Confirmar que el live region anuncia canvi d’escena i estat de gravació, però no cada frame.
- A menys de `860px`, confirmar que el dock passa a flux normal i no tapa l’stage.
- Amb `prefers-reduced-motion: reduce`, confirmar que l’app s’atura i el Director es pot navegar manualment.

- [ ] **Step 4: Corregir qualsevol defecte trobat i repetir verificació completa**

Per cada defecte, afegir primer una prova automatitzada quan sigui reproduïble en Node. Després repetir Step 1 i només marcar aquest pas quan torni a donar `0` failures.

- [ ] **Step 5: Actualitzar la memòria canònica**

Actualitzar:

- `docs/STATUS.md`: Director implementat, proves i limitacions reals.
- `docs/HANDOFF.md`: estat operatiu, següent pas, fitxers, bloquejos i riscos.
- `docs/progress.md`: entrada `2026-06-20` amb què s’ha implementat i què resta.
- `docs/decisions.md`: només decisions noves aparegudes durant la implementació; no duplicar l’especificació.

- [ ] **Step 6: Commit final de verificació i documentació**

```bash
git add index.html styles.css main.js docs/STATUS.md docs/HANDOFF.md docs/progress.md docs/decisions.md tests
git commit -m "docs: record motion director verification"
```

- [ ] **Step 7: Revisió final de branca**

Run: `git status --short --branch`

Expected: worktree net; branca local per davant d’`origin/main` només pels commits del Director.

Run: `git log --oneline --decorate -12`

Expected: commits petits i ordenats per esquema, avaluador, moviment, integració, UI, edició, live, export i verificació.

No fer push, còpia a Pixel Perfect ni deploy sense autorització explícita de l’usuari.
