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
