// engine.js — pure functions for SHAPER 001
// Seeded PRNG + layout algorithm. Same seed + params => identical output.

// mulberry32 seeded PRNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Font key -> { family, weight } map.
// Default when key is absent: times-regular (Node back-compat).
const FONT_MAP = {
  'times-regular':    { family: "'Times New Roman', Times, serif", weight: 400 },
  'times-bold':       { family: "'Times New Roman', Times, serif", weight: 700 },
  'courier-regular':  { family: "'Courier New', Courier, monospace", weight: 400 },
  'courier-bold':     { family: "'Courier New', Courier, monospace", weight: 700 },
  'helvetica-regular':{ family: 'Helvetica, Arial, sans-serif', weight: 400 },
  'helvetica-bold':   { family: 'Helvetica, Arial, sans-serif', weight: 700 },
};

function resolveFontSpec(fontKey) {
  return FONT_MAP[fontKey] || FONT_MAP['times-regular'];
}

// Offscreen canvas for measuring glyph widths.
let _canvas = null;
let _ctx = null;
function getCtx() {
  if (!_ctx) {
    if (typeof OffscreenCanvas !== 'undefined') {
      _canvas = new OffscreenCanvas(8, 8);
    } else if (typeof document !== 'undefined') {
      _canvas = document.createElement('canvas');
    }
    _ctx = _canvas ? _canvas.getContext('2d') : null;
  }
  return _ctx;
}

// Width cache keyed by `${fontKey}|${fontSize}|${ch}` (and word). The glyph
// set is small, so an unbounded Map is fine and avoids per-frame measureText
// calls. We reassign ctx.font whenever fontKey or fontSize changes.
const _widthCache = new Map();
let _lastFontStr = null;
function setFont(ctx, fontSize, fontKey) {
  const { family, weight } = resolveFontSpec(fontKey);
  const fontStr = `${weight} ${fontSize}px ${family}`;
  if (fontStr !== _lastFontStr) {
    ctx.font = fontStr;
    _lastFontStr = fontStr;
  }
}

// Measure a single character width; falls back to fontSize*0.55 if no canvas.
function measureChar(ch, fontSize, fontKey) {
  const key = (fontKey || 'times-regular') + '|' + fontSize + '|' + ch;
  const cached = _widthCache.get(key);
  if (cached !== undefined) return cached;
  const ctx = getCtx();
  const w = ctx ? (setFont(ctx, fontSize, fontKey), ctx.measureText(ch).width) : fontSize * 0.55;
  _widthCache.set(key, w);
  return w;
}

// Measure full word width
function measureWord(word, fontSize, fontKey) {
  const key = (fontKey || 'times-regular') + '|' + fontSize + '|' + word;
  const cached = _widthCache.get(key);
  if (cached !== undefined) return cached;
  const ctx = getCtx();
  const w = ctx ? (setFont(ctx, fontSize, fontKey), ctx.measureText(word).width) : word.length * fontSize * 0.55;
  _widthCache.set(key, w);
  return w;
}

// Animation phase rate. Flash safety (hard requirement):
// The fastest the wave can complete oscillation cycles per second is
//   speed * PHASE_RATE * normalizedFreq  (Hz),
// where normalizedFreq is frequency clamped to [0,1] vs FREQ_MAX.
// Worst case is speed=2, normalizedFreq=1, so 2 * PHASE_RATE must be <= 2 Hz.
// => PHASE_RATE <= 1. We use 1.0 so worst-case oscillation is exactly ~2 Hz.
export const PHASE_RATE = 1.0;
// Max frequency slider value (matches data-max in index.html) for normalization.
const FREQ_MAX = 0.05;

// Effective time-driven phase (radians) for the wave, flash-capped.
function wavePhase(t, time, speed, frequency) {
  const normFreq = Math.min(1, Math.max(0, frequency / FREQ_MAX));
  // cycles-per-second = speed * PHASE_RATE * normFreq  (capped at <= 2 Hz)
  const hz = speed * PHASE_RATE * normFreq;
  return time * hz * 2 * Math.PI;
}

// Default custom 2D profile: a gentle S-curve (64 samples, offset in [-1,1]).
export const DEFAULT_CUSTOM_PROFILE = (() => {
  const n = 64;
  const arr = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    arr[i] = Math.sin(t * 2 * Math.PI) * 0.5; // one gentle S
  }
  return arr;
})();

// Linearly interpolate a normalized offset from a profile array at p in [0,1).
// Profile entries are offsets in [-1,1]; index maps p across the array span.
function sampleProfile(profile, p) {
  if (!profile || profile.length === 0) return 0;
  const n = profile.length;
  if (n === 1) return profile[0];
  // p in [0,1) -> position across [0, n-1]
  const pos = (((p % 1) + 1) % 1) * (n - 1);
  const i0 = Math.floor(pos);
  const i1 = Math.min(n - 1, i0 + 1);
  const frac = pos - i0;
  return profile[i0] + (profile[i1] - profile[i0]) * frac;
}

// Shape offset function: returns base x for a given y.
// time (seconds), speed, lineSeed (0..1 per-line seeded phase) drive animation.
function shapeOffset(shape, y, height, marginLeft, amplitude, frequency, time, speed, lineSeed, customProfile) {
  switch (shape) {
    case 'custom': {
      const yNorm = height > 0 ? y / height : 0;
      // Slow vertical drift with time, like the other shapes.
      const p = yNorm + time * speed * 0.05;
      return marginLeft + amplitude * sampleProfile(customProfile, p);
    }
    case 'wave':
      return (
        marginLeft +
        amplitude *
          Math.sin(y * frequency * 2 * Math.PI + wavePhase(0, time, speed, frequency))
      );
    case 'trapezoid': {
      const t = height > 0 ? y / height : 0;
      // gentle amplitude breathing
      const breath = 1 + 0.15 * Math.sin(time * speed * PHASE_RATE + lineSeed * 2 * Math.PI);
      return marginLeft + amplitude * t * breath;
    }
    case 'diamond': {
      const t = height > 0 ? y / height : 0;
      const tri = 1 - Math.abs(t - 0.5) * 2; // 0 -> 1 -> 0
      const breath = 1 + 0.15 * Math.sin(time * speed * PHASE_RATE + lineSeed * 2 * Math.PI);
      return marginLeft + amplitude * tri * breath;
    }
    case 'rectangle':
    default:
      // gentle x0 oscillation so rectangle also animates
      return marginLeft + amplitude * 0.12 * Math.sin(time * speed * PHASE_RATE + lineSeed * 2 * Math.PI);
  }
}

// Tokenize text into words (collapse whitespace, ignore empties).
export function tokenize(text) {
  const words = String(text || '')
    .split(/\s+/)
    .filter((w) => w.length > 0);
  return words.length ? words : ['Shaper'];
}

// Main layout. Returns { lines: [{ y, chars: [{ ch, x, y }] }] }
// params: full state object. width/height = pane size in px.
export function layout(params, width, height) {
  const {
    text,
    font,
    shape,
    seed,
    fontSize,
    amplitude,
    frequency,
    charTrack,
    trackRand,
    leading,
    noiseAmt,
    wordTrack,
    wordChaos,
    wordRamp,
    charChaos,
    yJitter,
    yJitterAffect,
    dropProb,
    wordsPerRow,
    hardWrap,
    motion2d,
    rainSpeed2d,
    t,
    speed,
    customProfile,
  } = params;

  // Time/speed default to 0/1 when absent (static render stays identical).
  const time = typeof t === 'number' ? t : 0;
  const spd = typeof speed === 'number' ? speed : 1;

  const rand = mulberry32(seed);
  const marginLeft = 0;
  const words = tokenize(text);
  const profile = shape === 'custom'
    ? (Array.isArray(customProfile) && customProfile.length ? customProfile : DEFAULT_CUSTOM_PROFILE)
    : null;

  const lineCount = Math.ceil(height / Math.max(1, leading)) + 3;
  const rainOffset2d =
    motion2d === 'rain'
      ? ((time * spd * (typeof rainSpeed2d === 'number' ? rainSpeed2d : 1) * leading) % leading)
      : 0;

  const lines = [];
  let wordIndex = 0; // walks the repeated word stream

  for (let i = 0; i < lineCount; i++) {
    const baseY = i * leading + fontSize + rainOffset2d;

    // Per-line seeded phase (0..1). Drawn from the seeded PRNG so it is
    // deterministic; time only SHIFTS this phase, never re-rolls randomness.
    const linePhase = rand();

    // per-line horizontal noise — base magnitude is seeded, time smoothly
    // oscillates it via sin with the per-line seeded phase (no strobing).
    const noiseOsc = Math.sin(time * spd * PHASE_RATE + linePhase * 2 * Math.PI);
    const noise = noiseOsc * noiseAmt;
    let x0 =
      shapeOffset(shape, baseY, height, marginLeft, amplitude, frequency, time, spd, linePhase, profile) +
      noise;

    // how many words on this line
    let wordsThisLine = wordsPerRow;
    if (!hardWrap) {
      // occasional seeded run-on or short line
      const r = rand();
      if (r < 0.18) wordsThisLine = wordsPerRow + 1 + Math.floor(rand() * 3);
      else if (r > 0.9) wordsThisLine = Math.max(1, wordsPerRow - 1);
    }

    const chars = [];
    let x = x0;

    for (let w = 0; w < wordsThisLine; w++) {
      const word = words[wordIndex % words.length];
      wordIndex++;

      // lay each char of the word
      for (let c = 0; c < word.length; c++) {
        const ch = word[c];
        const cw = measureChar(ch, fontSize, font);

        const jitterOn = rand() < yJitterAffect;
        const yOff = jitterOn ? (rand() - 0.5) * 2 * yJitter : 0;
        const xChaos = (rand() - 0.5) * charChaos;
        const trackJ = rand() * trackRand * fontSize;
        const drop = rand() < dropProb;

        if (!drop) {
          chars.push({ ch, x: x + xChaos, y: baseY + yOff });
        }
        x += cw + charTrack + trackJ + xChaos;
      }

      // word spacing: base wordTrack + chaos + ramp (grows along line)
      const chaos = rand() * wordChaos;
      const ramp = wordRamp * (w / Math.max(1, wordsThisLine - 1)) * wordTrack;
      x += wordTrack + chaos + ramp;
    }

    lines.push({ y: baseY, chars });
  }

  return { lines };
}

// XML escape helper (shared by 2D + 3D emission).
function escXML(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===========================================================================
// 3D pipeline. 2D is a special case: when form==='plane' and no 3D motion /
// overlays are active, buildSVG uses the original 2D path (byte-identical).
// ===========================================================================

// Pulse phase rate. Flash safety mirrors the wave reasoning: worst-case
// pulse oscillation must stay <= 2 Hz. pulseSpeed max is 2, so
// cycles-per-second = pulseSpeed * PULSE_RATE must be <= 2 => PULSE_RATE <= 1.
export const PULSE_RATE = 1.0;

// Defaults for 3D params (keep static plane render unaffected when absent).
function read3DParams(params) {
  const num = (v, d) => (typeof v === 'number' && !isNaN(v) ? v : d);
  return {
    form: params.form || 'plane',
    projection: params.projection || 'isometric',
    formSize: num(params.formSize, 400),
    aspect: num(params.aspect, 1),
    facets: Math.max(3, Math.round(num(params.facets, 4))),
    turns: Math.max(1, Math.round(num(params.turns, 3))),
    count: Math.max(1, Math.round(num(params.count, 3))),
    scatter: num(params.scatter, 80),
    fov: num(params.fov, 60),
    zoom: num(params.zoom, 1),
    rotXSpeed: num(params.rotXSpeed, 0.2),
    rotYSpeed: num(params.rotYSpeed, 0.5),
    rotZSpeed: num(params.rotZSpeed, 0),
    depthFade: num(params.depthFade, 0.4),
    pulse: num(params.pulse, 0),
    pulseSpeed: num(params.pulseSpeed, 1),
    rainProb: num(params.rainProb, 0),
    rainSpeed: num(params.rainSpeed, 1),
    guides: !!params.guides,
    backfaceMirror: !!params.backfaceMirror,
    surfaceText: !!params.surfaceText,
    angleX: num(params.angleX, 0),
    angleY: num(params.angleY, 0),
    customOutline: (params.form || 'plane') === 'custom-prism'
      ? readOutlinePoints(params.customOutline)
      : null,
  };
}

// True when the plane form with no 3D motion/overlays => use the 2D path.
function is2DPath(p) {
  return (
    p.form === 'plane' &&
    p.rotXSpeed === 0 &&
    p.rotYSpeed === 0 &&
    p.rotZSpeed === 0 &&
    p.pulse === 0 &&
    p.rainProb === 0 &&
    p.angleX === 0 &&
    p.angleY === 0 &&
    !p.guides
  );
}

// Hand-rolled rotation about X, Y, Z (radians). p = {x,y,z}.
export function rotate3D(p, ax, ay, az) {
  let { x, y, z } = p;
  // X
  let c = Math.cos(ax), s = Math.sin(ax);
  let y1 = y * c - z * s, z1 = y * s + z * c;
  y = y1; z = z1;
  // Y
  c = Math.cos(ay); s = Math.sin(ay);
  let x1 = x * c + z * s, z2 = -x * s + z * c;
  x = x1; z = z2;
  // Z
  c = Math.cos(az); s = Math.sin(az);
  let x2 = x * c - y * s, y2 = x * s + y * c;
  x = x2; y = y2;
  return { x, y, z };
}

// Rotate a direction (normal) — same matrices, no translation involved.
function rotateDir(n, ax, ay, az) {
  return rotate3D(n, ax, ay, az);
}

// Default custom 3D outline: a rounded blob (8-point smooth polygon),
// flat array [x0,z0,x1,z1,...] normalized to [-1,1] centered on origin.
export const DEFAULT_CUSTOM_OUTLINE = (() => {
  const n = 96;
  const arr = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    // gentle radius wobble for an organic blob, base 0.8
    const rad = 0.8 + 0.12 * Math.sin(a * 3) + 0.06 * Math.cos(a * 5);
    arr.push(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  return arr;
})();

// Read the custom outline as an array of {x,z} points; fall back to default.
function readOutlinePoints(outline) {
  const flat = Array.isArray(outline) && outline.length >= 6 ? outline : DEFAULT_CUSTOM_OUTLINE;
  const pts = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    pts.push({ x: flat[i], z: flat[i + 1] });
  }
  return pts.length >= 3 ? pts : readOutlinePoints(DEFAULT_CUSTOM_OUTLINE);
}

// surfaceMap: map a glyph's normalized (u,v) in [0,1] onto a 3D point + normal.
// inst = optional cluster instance offset {x,y,z}. Returns {x,y,z, nx,ny,nz}.
function surfaceMap(form, u, v, P, inst) {
  const S = P.formSize;
  const r = S / 2;
  const h = S * P.aspect;
  let x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 1;
  switch (form) {
    case 'cylinder': {
      const ang = u * 2 * Math.PI;
      x = r * Math.cos(ang);
      z = r * Math.sin(ang);
      y = (v - 0.5) * h;
      nx = Math.cos(ang); ny = 0; nz = Math.sin(ang);
      break;
    }
    case 'helix': {
      const ang = u * 2 * Math.PI * P.turns;
      x = r * Math.cos(ang);
      z = r * Math.sin(ang);
      y = (u - 0.5) * h + (v - 0.5) * (h * 0.1);
      nx = Math.cos(ang); ny = 0; nz = Math.sin(ang);
      break;
    }
    case 'sphere': {
      const lon = u * 2 * Math.PI;
      const lat = (v - 0.5) * Math.PI;
      const cl = Math.cos(lat);
      x = r * cl * Math.cos(lon);
      y = r * Math.sin(lat);
      z = r * cl * Math.sin(lon);
      const len = Math.hypot(x, y, z) || 1;
      nx = x / len; ny = y / len; nz = z / len;
      break;
    }
    case 'cube': {
      // 4 side faces of a cube of side S. Wrap u so out-of-range values
      // (overflowing lines) continue around the cube.
      const uw = ((u % 1) + 1) % 1;
      const face = Math.floor(uw * 4) % 4;
      const fu = (uw * 4) - Math.floor(uw * 4); // 0..1 across the face
      const fy = (v - 0.5) * S;
      const a = (fu - 0.5) * S;
      if (face === 0) { x = a; z = -r; nx = 0; ny = 0; nz = -1; }
      else if (face === 1) { x = r; z = a; nx = 1; ny = 0; nz = 0; }
      else if (face === 2) { x = -a; z = r; nx = 0; ny = 0; nz = 1; }
      else { x = -r; z = -a; nx = -1; ny = 0; nz = 0; }
      y = fy;
      break;
    }
    case 'star-prism': {
      const points = P.facets;
      // u wraps the star perimeter (2*points vertices, alternating radii).
      const seg = (((u % 1) + 1) % 1) * points * 2;
      const idx = Math.floor(seg);
      const frac = seg - idx;
      const ang0 = (idx / (points * 2)) * 2 * Math.PI;
      const ang1 = ((idx + 1) / (points * 2)) * 2 * Math.PI;
      const r0 = idx % 2 === 0 ? r : r * 0.45;
      const r1 = (idx + 1) % 2 === 0 ? r : r * 0.45;
      const px0 = r0 * Math.cos(ang0), pz0 = r0 * Math.sin(ang0);
      const px1 = r1 * Math.cos(ang1), pz1 = r1 * Math.sin(ang1);
      x = px0 + (px1 - px0) * frac;
      z = pz0 + (pz1 - pz0) * frac;
      y = (v - 0.5) * h;
      const len = Math.hypot(x, z) || 1;
      nx = x / len; ny = 0; nz = z / len;
      break;
    }
    case 'custom-prism': {
      const pts = P.customOutline;
      const m = pts.length;
      // u walks the closed perimeter by index interpolation (wrapped).
      const seg = (((u % 1) + 1) % 1) * m;
      const idx = Math.floor(seg) % m;
      const frac = seg - Math.floor(seg);
      const p0 = pts[idx];
      const p1 = pts[(idx + 1) % m];
      const sx = p0.x + (p1.x - p0.x) * frac;
      const sz = p0.z + (p1.z - p0.z) * frac;
      x = sx * r;
      z = sz * r;
      y = (v - 0.5) * h;
      // Normal: 2D perpendicular of the segment direction.
      // Determine outward sign via polygon winding (signed area).
      let area2 = 0;
      for (let k = 0; k < m; k++) {
        const a = pts[k], b = pts[(k + 1) % m];
        area2 += a.x * b.z - b.x * a.z;
      }
      const ccw = area2 > 0; // counter-clockwise winding
      const ex = p1.x - p0.x;
      const ez = p1.z - p0.z;
      // For CCW polygon, outward normal is (ez, -ex); flip for CW.
      let onx = ccw ? ez : -ez;
      let onz = ccw ? -ex : ex;
      const nlen = Math.hypot(onx, onz) || 1;
      nx = onx / nlen; ny = 0; nz = onz / nlen;
      break;
    }
    case 'cluster': // handled per-instance with cube mapping
    case 'plane':
    default: {
      // plane: (u,v) span the layout extents; passthrough at z=0.
      x = (u - 0.5) * S;
      y = (v - 0.5) * (S * P.aspect);
      z = 0;
      nx = 0; ny = 0; nz = 1;
      break;
    }
  }
  if (inst) { x += inst.x; y += inst.y; z += inst.z; }
  return { x, y, z, nx, ny, nz };
}

// Isometric basis (orthographic). Returns screen-space X,Y plus raw depth.
function projectIso(p, P, width, height) {
  const k = (0.45 * Math.min(width, height) * P.zoom) / Math.max(1, P.formSize);
  // Classic 2:1-ish iso: rotate the already-rotated point onto the iso plane.
  const X = (p.x - p.z) * Math.cos(Math.PI / 6);
  const Y = (p.x + p.z) * Math.sin(Math.PI / 6) - p.y;
  return {
    X: width / 2 + X * k,
    Y: height / 2 + Y * k,
    z: p.z,
    scale: 1,
  };
}

// Perspective projection. focal derived from fov; camera at +Z distance.
function projectPersp(p, P, width, height) {
  const dist = 2.5 * P.formSize;
  const fovRad = (P.fov * Math.PI) / 180;
  const focal = (Math.min(width, height) * 0.5) / Math.tan(fovRad / 2);
  const cz = dist + p.z; // distance from camera along view axis
  const denom = cz > 1 ? cz : 1;
  const f = (focal * P.zoom) / denom;
  return {
    X: width / 2 + p.x * f,
    Y: height / 2 - p.y * f,
    z: p.z,
    scale: (focal * P.zoom) / denom / (focal / dist), // ~1 at center plane
  };
}

// Build the per-glyph 3D draw list. Returns { glyphs, meta }.
function build3D(params, width, height) {
  const P = read3DParams(params);
  const { lines } = layout(params, width, height);
  const { fontSize, seed } = params;
  const time = typeof params.t === 'number' ? params.t : 0;
  const spd = typeof params.speed === 'number' ? params.speed : 1;

  // Second PRNG — never touches the existing 2D stream.
  const rand3 = mulberry32((seed >>> 0) + 1);

  // Seed-derived initial rotation angles.
  const baseRX = rand3() * 2 * Math.PI;
  const baseRY = rand3() * 2 * Math.PI;
  const baseRZ = rand3() * 2 * Math.PI;

  // Cluster instance offsets (consumed before per-glyph rolls so they stay
  // deterministic regardless of glyph count).
  const instances = [];
  const instCount = P.form === 'cluster' ? P.count : 1;
  for (let i = 0; i < instCount; i++) {
    if (P.form === 'cluster') {
      instances.push({
        x: (rand3() - 0.5) * 2 * P.scatter,
        y: (rand3() - 0.5) * 2 * P.scatter,
        z: (rand3() - 0.5) * 2 * P.scatter,
      });
    } else {
      instances.push({ x: 0, y: 0, z: 0 });
    }
  }

  // Normalize (x,y) -> (u,v) against the viewport, not the layout extents:
  // keeps the Shape offset (amplitude vs width) at its true proportion, so
  // wave/trapezoid/diamond stay visible on 3D forms. Overflowing lines wrap
  // around closed forms (u beyond 1 continues around the surface).

  // Pulse phase (flash-capped) — radial scale 1 + pulse*0.3*sin(phase).
  const pulsePhase = time * P.pulseSpeed * PULSE_RATE * 2 * Math.PI;
  const pulseScale = 1 + P.pulse * 0.3 * Math.sin(pulsePhase);

  // Rotation angles for this frame (manual orbit offsets added in radians).
  const ax = baseRX + time * P.rotXSpeed + P.angleX * Math.PI / 180;
  const ay = baseRY + time * P.rotYSpeed + P.angleY * Math.PI / 180;
  const az = baseRZ + time * P.rotZSpeed;

  const fallRange = P.formSize * 1.5;
  const project = P.projection === 'perspective' ? projectPersp : projectIso;
  const viewDir = { x: 0, y: 0, z: -1 }; // camera looks down -Z toward scene

  // Delta in layout pixels used for surface tangent sampling.
  const TANGENT_D = 2;
  const formKey = P.form === 'cluster' ? 'cube' : P.form;

  // Helper: apply the full transform chain to a (u,v) point given a fixed
  // instance offset and a fixed rain fall offset (dy). Returns projected point.
  const transformPoint = (u, v, inst, rainDY) => {
    let pt = surfaceMap(formKey, u, v, P, inst);
    if (P.pulse > 0) {
      pt = { ...pt, x: pt.x * pulseScale, y: pt.y * pulseScale, z: pt.z * pulseScale };
    }
    if (rainDY !== 0) {
      pt = { ...pt, y: pt.y + rainDY };
    }
    const rp = rotate3D(pt, ax, ay, az);
    return project(rp, P, width, height);
  };

  const glyphs = [];
  for (const line of lines) {
    for (const c of line.chars) {
      const u = c.x / width;
      const v = c.y / height;
      // Per-glyph: distribute across cluster instances by a seeded roll.
      // PRNG WARNING: consume rolls in FIXED order — inst pick first, then rain.
      const inst = instances[Math.floor(rand3() * instCount) % instCount];

      let pt = surfaceMap(formKey, u, v, P, inst);

      // Pulse (radial scale about origin).
      if (P.pulse > 0) {
        pt = { ...pt, x: pt.x * pulseScale, y: pt.y * pulseScale, z: pt.z * pulseScale };
      }

      // Rain: one seeded roll per glyph; falls deterministically with t.
      const rainRoll = rand3();
      const rainPhase = rand3();
      let rainDY = 0;
      if (P.rainProb > 0 && rainRoll < P.rainProb) {
        const fall =
          ((time * P.rainSpeed * spd * 60 + rainPhase * fallRange) % fallRange + fallRange) %
          fallRange;
        rainDY = -fall + fallRange / 2;
        pt = { ...pt, y: pt.y + rainDY };
      }

      const rp = rotate3D(pt, ax, ay, az);
      const rn = rotateDir({ x: pt.nx, y: pt.ny, z: pt.nz }, ax, ay, az);
      const pr = project(rp, P, width, height);

      // Facing: normal . viewDir (>0 => normal points toward camera-ish).
      const facing = rn.x * viewDir.x + rn.y * viewDir.y + rn.z * viewDir.z;
      const back = facing > 0; // normal pointing away from camera

      // Surface tangent matrix (only computed when surfaceText is on).
      let matrixTransform = null;
      if (P.surfaceText) {
        const uU = (c.x + TANGENT_D) / width;
        const vV = (c.y + TANGENT_D) / height;
        const prSu = transformPoint(uU, v, inst, rainDY);
        const prSv = transformPoint(u, vV, inst, rainDY);
        const ma = (prSu.X - pr.X) / TANGENT_D;
        const mb = (prSu.Y - pr.Y) / TANGENT_D;
        const mc = (prSv.X - pr.X) / TANGENT_D;
        const md = (prSv.Y - pr.Y) / TANGENT_D;
        const det = ma * md - mb * mc;
        if (Math.abs(det) >= 1e-4) {
          matrixTransform = { a: ma, b: mb, c: mc, d: md, e: pr.X, f: pr.Y };
        }
        // else: degenerate — fall back to billboard (matrixTransform stays null)
      }

      glyphs.push({
        ch: c.ch,
        X: pr.X,
        Y: pr.Y,
        z: rp.z,
        scale: pr.scale,
        back,
        matrixTransform,
      });
    }
  }

  // Depth normalization for fade + back-to-front sort.
  let minZ = Infinity, maxZ = -Infinity;
  for (const g of glyphs) {
    if (g.z < minZ) minZ = g.z;
    if (g.z > maxZ) maxZ = g.z;
  }
  const zSpan = maxZ - minZ || 1;
  for (const g of glyphs) {
    g.depth = (g.z - minZ) / zSpan; // 0 = far, 1 = near
  }
  // Sort back (far) to front (near): farther first.
  glyphs.sort((a, b) => a.z - b.z);

  return {
    P, glyphs, fontSize, time, ax, ay, az, pulseScale, spd,
    width, height,
    instances, baseRX, baseRY, baseRZ,
  };
}

// Build construction-guide path DATA (the `d` attribute string, dashed).
// Returns '' when the form has no guides. Serializer/canvas wrap it.
function buildGuidesData(ctx) {
  const { P, width, height } = ctx;
  const project = P.projection === 'perspective' ? projectPersp : projectIso;
  const { ax, ay, az } = ctx;
  const pj = (x, y, z) => {
    const rp = rotate3D({ x, y, z }, ax, ay, az);
    return project(rp, P, width, height);
  };
  const S = P.formSize, r = S / 2, h = S * P.aspect;
  let d = '';

  const ellipse = (cy, rad, steps = 48) => {
    let p = '';
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * 2 * Math.PI;
      const pr = pj(rad * Math.cos(a), cy, rad * Math.sin(a));
      p += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
    }
    return p + ' ';
  };
  const seg = (x0, y0, z0, x1, y1, z1) => {
    const a = pj(x0, y0, z0), b = pj(x1, y1, z1);
    return `M${a.X.toFixed(2)} ${a.Y.toFixed(2)}L${b.X.toFixed(2)} ${b.Y.toFixed(2)} `;
  };

  const form = P.form === 'cluster' ? 'cube' : P.form;
  switch (form) {
    case 'cylinder': {
      d += ellipse(-h / 2, r) + ellipse(0, r) + ellipse(h / 2, r);
      d += seg(0, -h / 2, 0, 0, h / 2, 0);
      break;
    }
    case 'sphere': {
      d += ellipse(0, r);
      // two meridians via rotated ellipses approximated as vertical rings
      for (let m = 0; m < 2; m++) {
        let p = '';
        const off = m * Math.PI / 2;
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * 2 * Math.PI;
          const pr = pj(r * Math.cos(a) * Math.cos(off), r * Math.sin(a), r * Math.cos(a) * Math.sin(off));
          p += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
        }
        d += p + ' ';
      }
      break;
    }
    case 'helix': {
      let p = '';
      const steps = 120;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const ang = u * 2 * Math.PI * P.turns;
        const y = (u - 0.5) * h;
        const pr = pj(r * Math.cos(ang), y, r * Math.sin(ang));
        p += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
      }
      d += p + ' ';
      d += seg(0, -h / 2, 0, 0, h / 2, 0);
      break;
    }
    case 'cube': {
      const cubes = P.form === 'cluster' ? ctx.instances : [{ x: 0, y: 0, z: 0 }];
      const c = r;
      const verts = [
        [-c, -c, -c], [c, -c, -c], [c, -c, c], [-c, -c, c],
        [-c, c, -c], [c, c, -c], [c, c, c], [-c, c, c],
      ];
      const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];
      for (const off of cubes) {
        for (const [a, b] of edges) {
          const va = verts[a], vb = verts[b];
          d += seg(va[0] + off.x, va[1] + off.y, va[2] + off.z, vb[0] + off.x, vb[1] + off.y, vb[2] + off.z);
        }
      }
      break;
    }
    case 'custom-prism': {
      const pts = P.customOutline;
      const m = pts.length;
      const ringY = [-h / 2, h / 2];
      // top + bottom perimeter polylines
      for (const y of ringY) {
        let p = '';
        for (let i = 0; i <= m; i++) {
          const sp = pts[i % m];
          const pr = pj(sp.x * r, y, sp.z * r);
          p += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
        }
        d += p + ' ';
      }
      // 4 vertical edges at quarter points
      for (let q = 0; q < 4; q++) {
        const sp = pts[Math.floor((q / 4) * m) % m];
        d += seg(sp.x * r, -h / 2, sp.z * r, sp.x * r, h / 2, sp.z * r);
      }
      break;
    }
    case 'star-prism': {
      const points = P.facets;
      const ringY = [-h / 2, h / 2];
      const starPts = [];
      for (let i = 0; i < points * 2; i++) {
        const ang = (i / (points * 2)) * 2 * Math.PI;
        const rad = i % 2 === 0 ? r : r * 0.45;
        starPts.push([rad * Math.cos(ang), rad * Math.sin(ang)]);
      }
      for (const y of ringY) {
        let p = '';
        for (let i = 0; i <= starPts.length; i++) {
          const sp = starPts[i % starPts.length];
          const pr = pj(sp[0], y, sp[1]);
          p += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
        }
        d += p + ' ';
      }
      for (const sp of starPts) {
        d += seg(sp[0], -h / 2, sp[1], sp[0], h / 2, sp[1]);
      }
      break;
    }
    default:
      break;
  }
  if (!d) return '';
  return d.trim();
}

// ===========================================================================
// buildScene — single computation shared by the SVG serializer (buildSVG) and
// the Canvas2D painter (drawScene). Returns everything needed to paint a frame:
//   { mode, bgColor, textColor, fontSize, fontSpec, width, height,
//     lines        (2D mode only: same {y,chars:[{ch,x,y}]} as layout),
//     glyphs       (3D mode only: sorted, each {ch,X,Y,fontSize,opacity,
//                   matrix|null, mirrored}),
//     guides       (3D mode: path `d` data string or '') }
// Determinism: identical to buildSVG's prior internals — no PRNG reordering.
// ===========================================================================
export function buildScene(params, width, height) {
  const { fontSize, textColor, bgColor } = params;
  const fontSpec = resolveFontSpec(params.font);
  const P3 = read3DParams(params);

  // --- 2D fast path ---
  // Explicit mode='2d' always forces the 2D path regardless of 3D params.
  // mode absent (back-compat / Node tests) falls through to is2DPath check.
  if (params.mode === '2d' || (params.mode !== '3d' && is2DPath(P3))) {
    const { lines } = layout(params, width, height);
    return {
      mode: '2d',
      bgColor, textColor, fontSize, fontSpec, width, height,
      lines,
    };
  }

  // --- 3D path ---
  const ctx = build3D(params, width, height);
  ctx.textColor = textColor;
  const P = ctx.P;

  const glyphs = [];
  for (const g of ctx.glyphs) {
    // depthFade: opacity = 1 - depthFade*(1-depth) (far glyphs fade), floor 0.15
    let op = 1 - P.depthFade * (1 - g.depth);
    const back = g.back;
    if (P.backfaceMirror && back) op *= 0.55;
    op = Math.max(0.15, op);

    if (P.surfaceText && g.matrixTransform !== null) {
      // Surface glyph: matrix carries all scale/perspective + skew. fontSize
      // stays at layout value — no billboard depth-scale or mirror.
      glyphs.push({
        ch: g.ch,
        matrix: g.matrixTransform,
        fontSize,
        opacity: op,
        mirrored: false,
        X: g.X, Y: g.Y,
      });
    } else {
      // Billboard path (surfaceText off, or degenerate fallback).
      const fs = fontSize * (P.projection === 'perspective' ? g.scale : 1);
      glyphs.push({
        ch: g.ch,
        matrix: null,
        fontSize: fs,
        opacity: op,
        mirrored: !!(P.backfaceMirror && back),
        X: g.X, Y: g.Y,
      });
    }
  }

  return {
    mode: '3d',
    bgColor, textColor, fontSize, fontSpec, width, height,
    glyphs,
    guides: P.guides ? buildGuidesData(ctx) : '',
  };
}

// Serialize a 3D glyph's transform to an SVG transform attribute value.
function glyphTransformSVG(g) {
  if (g.matrix) {
    const m = g.matrix;
    return (
      `matrix(${m.a.toFixed(4)} ${m.b.toFixed(4)} ${m.c.toFixed(4)} ${m.d.toFixed(4)} ` +
      `${m.e.toFixed(2)} ${m.f.toFixed(2)})`
    );
  }
  return `translate(${g.X.toFixed(2)} ${g.Y.toFixed(2)})${g.mirrored ? ' scale(-1,1)' : ''}`;
}

// Build an SVG string from params. textColor/bgColor are user-controlled.
// Thin serializer over buildScene — output is byte-identical to before for the
// 2D fast path, and geometry-identical for 3D.
export function buildSVG(params, width, height) {
  const scene = buildScene(params, width, height);
  const { bgColor, textColor, fontSize, fontSpec } = scene;

  const head =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice">` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${escXML(bgColor)}"/>`;

  if (scene.mode === '2d') {
    let body = '';
    for (const line of scene.lines) {
      if (!line.chars.length) continue;
      let tspans = '';
      for (const c of line.chars) {
        tspans += `<tspan x="${c.x.toFixed(2)}" y="${c.y.toFixed(2)}">${escXML(c.ch)}</tspan>`;
      }
      body += `<text>${tspans}</text>`;
    }
    return (
      head +
      `<g font-family="${escXML(fontSpec.family)}" font-weight="${fontSpec.weight}" font-size="${fontSize}" fill="${escXML(textColor)}">` +
      body +
      `</g></svg>`
    );
  }

  // 3D serialization
  let body = '';
  for (const g of scene.glyphs) {
    body +=
      `<text transform="${glyphTransformSVG(g)}" font-size="${g.fontSize.toFixed(2)}" ` +
      `opacity="${g.opacity.toFixed(3)}">${escXML(g.ch)}</text>`;
  }

  const guides = scene.guides
    ? `<path d="${scene.guides}" fill="none" stroke="${escXML(textColor)}" ` +
      `stroke-width="1" stroke-dasharray="4 4" opacity="0.5"/>`
    : '';

  return (
    head +
    guides +
    `<g font-family="${escXML(fontSpec.family)}" font-weight="${fontSpec.weight}" font-size="${fontSize}" fill="${escXML(textColor)}" ` +
    `text-anchor="middle">` +
    body +
    `</g>` +
    `</svg>`
  );
}

// ===========================================================================
// drawScene — paint a scene (from buildScene) onto a Canvas 2D context.
// width/height are CSS px; dpr scales to device pixels. The context is assumed
// untransformed on entry; we reset the transform on exit.
// ===========================================================================
export function drawScene(ctx, scene, width, height, dpr) {
  const d = dpr || 1;
  ctx.setTransform(d, 0, 0, d, 0, 0);

  // Background.
  ctx.fillStyle = scene.bgColor;
  ctx.fillRect(0, 0, width, height);

  if (scene.mode === '2d') {
    ctx.fillStyle = scene.textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const fs2d = scene.fontSpec;
    ctx.font = `${fs2d.weight} ${scene.fontSize}px ${fs2d.family}`;
    for (const line of scene.lines) {
      for (const c of line.chars) {
        ctx.fillText(c.ch, c.x, c.y);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return;
  }

  // --- 3D ---
  // Guides: dashed strokes under the text.
  if (scene.guides) {
    ctx.save();
    ctx.strokeStyle = scene.textColor;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const path = new Path2D(scene.guides);
    ctx.stroke(path);
    ctx.restore();
  }

  // Glyphs (sorted back-to-front in buildScene). text-anchor:middle in SVG ->
  // textAlign:center here; baseline alphabetic matches SVG's default.
  ctx.fillStyle = scene.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const fs3d = scene.fontSpec;
  let lastFs = null;
  for (const g of scene.glyphs) {
    ctx.globalAlpha = g.opacity;
    if (g.matrix) {
      const m = g.matrix;
      // setTransform composes with dpr: device = dpr * matrix.
      ctx.setTransform(d * m.a, d * m.b, d * m.c, d * m.d, d * m.e, d * m.f);
      if (scene.fontSize !== lastFs) {
        ctx.font = `${fs3d.weight} ${scene.fontSize}px ${fs3d.family}`;
        lastFs = scene.fontSize;
      }
      ctx.fillText(g.ch, 0, 0);
    } else {
      // Billboard: translate (+ optional horizontal mirror) and scale font.
      ctx.setTransform(
        d * (g.mirrored ? -1 : 1), 0, 0, d, d * g.X, d * g.Y,
      );
      // Billboard font size varies per glyph; set every time (cheap enough,
      // and the value genuinely changes under perspective).
      ctx.font = `${fs3d.weight} ${g.fontSize}px ${fs3d.family}`;
      lastFs = g.fontSize;
      ctx.fillText(g.ch, 0, 0);
    }
  }
  ctx.globalAlpha = 1;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
