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
const FORM_SIZE_BASE = 400;

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
  const trackRandAmt = typeof trackRand === 'number' ? trackRand : 0;

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
  const flowRate2d =
    (typeof rainSpeed2d === 'number' ? rainSpeed2d : 1) * Math.max(1, fontSize * 2);

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
    const x0 =
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
        const trackJ = rand() * trackRandAmt * fontSize;
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

    // Flow: tile the line content periodically so it scrolls as a seamless
    // horizontal loop — the canvas can never go blank. Period = content advance.
    if (motion2d === 'flow') {
      const advance = x - x0;
      if (advance > 1) {
        const s = (((time * spd * flowRate2d) % advance) + advance) % advance;
        const tiled = [];
        for (const c of chars) {
          let px = c.x + s - advance;
          for (; px < width + fontSize; px += advance) {
            if (px > -fontSize) tiled.push({ ch: c.ch, x: px, y: c.y });
          }
        }
        lines.push({ y: baseY, chars: tiled });
        continue;
      }
    }

    lines.push({ y: baseY, chars });
  }

  // --- 2D motion post-processing (new modes) ---
  // rain and flow are handled inside the loop above; static needs nothing.
  if (motion2d !== 'static' && motion2d !== 'rain' && motion2d !== 'flow') {
    const T = time * spd;
    const cx = width / 2;
    const cy = height / 2;

    switch (motion2d) {
      case 'wave-h': {
        // Each row oscillates horizontally; wave travels downward.
        const A = leading * 0.6;
        lines.forEach((line, li) => {
          const dx = A * Math.sin(T * 2 * Math.PI + li * 0.7);
          line.chars = line.chars.map((c) => ({ ...c, x: c.x + dx }));
        });
        break;
      }
      case 'bounce': {
        // Each char bounces vertically with a seeded phase.
        let ci = 0;
        for (const line of lines) {
          for (let k = 0; k < line.chars.length; k++, ci++) {
            const phase = (ci * 0.618) % 1;
            const yOff = leading * 0.7 * Math.abs(Math.sin(Math.PI * T + phase * 2 * Math.PI));
            line.chars[k] = { ...line.chars[k], y: line.chars[k].y - yOff };
          }
        }
        break;
      }
      case 'pendulum': {
        // Global left–right swing.
        const dx = cx * 0.45 * Math.sin(T * 2 * Math.PI);
        for (const line of lines) {
          line.chars = line.chars.map((c) => ({ ...c, x: c.x + dx }));
        }
        break;
      }
      case 'cascade': {
        // Staggered horizontal flow: each row has a phase offset → diagonal cascade.
        const rate = (typeof rainSpeed2d === 'number' ? rainSpeed2d : 1) * Math.max(1, fontSize * 2);
        lines.forEach((line, li) => {
          if (!line.chars.length) return;
          const xs = line.chars.map((c) => c.x);
          const x0c = Math.min(...xs);
          const advance = Math.max(...xs) + fontSize - x0c;
          if (advance < 1) return;
          const rowPhase = li * (advance / Math.max(1, lines.length));
          const s = (((T * rate + rowPhase) % advance) + advance) % advance;
          const tiled = [];
          for (const c of line.chars) {
            let px = c.x + s - advance;
            for (; px < width + fontSize; px += advance) {
              if (px > -fontSize) tiled.push({ ch: c.ch, x: px, y: c.y });
            }
          }
          lines[li] = { ...line, chars: tiled };
        });
        break;
      }
      case 'scatter': {
        // Chars breathe radially outward from canvas center.
        const factor = Math.sin(T * 2 * Math.PI) * 0.4;
        for (const line of lines) {
          line.chars = line.chars.map((c) => ({
            ...c,
            x: cx + (c.x - cx) * (1 + factor),
            y: cy + (c.y - cy) * (1 + factor),
          }));
        }
        break;
      }
      case 'vortex': {
        // Each char rotates around canvas center.
        const angSpeed = T * 2 * Math.PI * 0.3;
        for (const line of lines) {
          line.chars = line.chars.map((c) => {
            const dx2 = c.x - cx, dy2 = c.y - cy;
            const dist = Math.hypot(dx2, dy2);
            if (dist < 1) return c;
            const angle = Math.atan2(dy2, dx2) + angSpeed;
            return { ...c, x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist };
          });
        }
        break;
      }
      case 'expand': {
        // Radial pulse: chars breathe outward from center synchronously.
        const factor = 1 + 0.35 * Math.sin(T * 2 * Math.PI);
        for (const line of lines) {
          line.chars = line.chars.map((c) => ({
            ...c,
            x: cx + (c.x - cx) * factor,
            y: cy + (c.y - cy) * factor,
          }));
        }
        break;
      }
      case 'typewriter': {
        // Sequential char reveal, loops continuously.
        // At T=0 (paused/static), show all chars so canvas is never blank.
        const allChars = [];
        for (const line of lines) {
          for (const c of line.chars) allChars.push({ line, c });
        }
        const total = allChars.length;
        if (total > 0 && T > 0) {
          const charsPerSec = Math.max(2, fontSize * 0.4);
          const cycle = total / charsPerSec;
          const phase = ((T % cycle) + cycle) % cycle;
          const visN = Math.max(1, Math.floor(phase * charsPerSec));
          for (const line of lines) line.chars = [];
          for (let k = 0; k < Math.min(visN, total); k++) {
            allChars[k].line.chars.push(allChars[k].c);
          }
        }
        break;
      }
      case 'noise-walk': {
        // Each char follows a unique smooth Lissajous-like path.
        const B = fontSize * 0.9;
        let ci = 0;
        for (const line of lines) {
          for (let k = 0; k < line.chars.length; k++, ci++) {
            const ph = ci * 0.618 * Math.PI * 2;
            const dx2 = B * Math.sin(T * 1.31 + ph);
            const dy2 = B * 0.8 * Math.cos(T * 0.97 + ph * 1.23);
            line.chars[k] = { ...line.chars[k], x: line.chars[k].x + dx2, y: line.chars[k].y + dy2 };
          }
        }
        break;
      }
      case 'stagger': {
        // Rows slide in from the left with staggered timing, then slide out.
        // Fixed period (3s) so resizing fontSize/leading doesn't reset the cycle.
        const nLines = Math.max(1, lines.length);
        const period = 3;
        const tCycle = ((T % period) + period) % period;
        const inDur = 0.35, holdDur = period * 0.45, outDur = 0.35;
        lines.forEach((line, li) => {
          // Stagger by normalised vertical position so visible rows lead, buffer rows lag.
          const yFrac = height > 0 ? Math.min(1, line.y / height) : li / nLines;
          const delay = yFrac * (period * 0.35);
          const tRow = tCycle - delay;
          let xOff;
          if (tRow <= 0) {
            xOff = -width * 1.2;
          } else if (tRow < inDur) {
            xOff = -width * 1.2 * Math.pow(1 - tRow / inDur, 3);
          } else if (tRow < inDur + holdDur) {
            xOff = 0;
          } else if (tRow < inDur + holdDur + outDur) {
            xOff = width * 1.2 * Math.pow((tRow - inDur - holdDur) / outDur, 3);
          } else {
            xOff = width * 1.2;
          }
          line.chars = line.chars.map((c) => ({ ...c, x: c.x + xOff }));
        });
        break;
      }
    }
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
    vNorm: !!params.vNorm,
    wrapMode: params.wrapMode || 'rings',
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
      const uw = ((u % 1) + 1) % 1;
      const ang = uw * 2 * Math.PI * P.turns;
      x = r * Math.cos(ang);
      z = r * Math.sin(ang);
      y = (uw - 0.5) * h + (v - 0.5) * (h * 0.1);
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
    case 'torus': {
      const R = r, rt = r * Math.max(0.1, Math.min(P.aspect, 1.5)) * 0.4;
      const a = u * 2 * Math.PI, b = v * 2 * Math.PI;
      x = (R + rt * Math.cos(b)) * Math.cos(a);
      z = (R + rt * Math.cos(b)) * Math.sin(a);
      y = rt * Math.sin(b);
      nx = Math.cos(b) * Math.cos(a); ny = Math.sin(b); nz = Math.cos(b) * Math.sin(a);
      break;
    }
    case 'cone': {
      const ang = u * 2 * Math.PI;
      const rv = r * (1 - v);
      x = rv * Math.cos(ang); z = rv * Math.sin(ang); y = (v - 0.5) * h;
      const slope = r / (h || 1);
      const slen = Math.hypot(1, slope);
      nx = Math.cos(ang) / slen; ny = slope / slen; nz = Math.sin(ang) / slen;
      break;
    }
    case 'disc': {
      const ang = u * 2 * Math.PI;
      const rv = r * (P.aspect * 0.25 + v * (1 - P.aspect * 0.25));
      x = rv * Math.cos(ang); z = rv * Math.sin(ang); y = 0;
      nx = 0; ny = 1; nz = 0;
      break;
    }
    case 'wave-plane': {
      x = (u - 0.5) * S;
      z = (v - 0.5) * S * P.aspect;
      y = Math.sin(u * 2 * Math.PI * Math.max(1, P.turns)) * r * 0.45;
      nx = 0; ny = 1; nz = 0;
      break;
    }
    case 'mobius': {
      const t = u * 2 * Math.PI;
      const w = (v - 0.5) * r * Math.max(0.2, P.aspect) * 0.6;
      x = (r + w * Math.cos(t / 2)) * Math.cos(t);
      z = (r + w * Math.cos(t / 2)) * Math.sin(t);
      y = w * Math.sin(t / 2);
      nx = Math.cos(t); ny = 0; nz = Math.sin(t);
      break;
    }
    case 'torus-knot': {
      const pk = Math.max(1, Math.round(P.facets));
      const qk = Math.max(1, Math.round(P.turns));
      const t = u * 2 * Math.PI;
      const Rk = r * 0.62, rtk = r * 0.28;
      x = (Rk + rtk * Math.cos(qk * t)) * Math.cos(pk * t);
      z = (Rk + rtk * Math.cos(qk * t)) * Math.sin(pk * t);
      y = rtk * Math.sin(qk * t) * 1.8;
      const klen = Math.hypot(x, y, z) || 1;
      nx = x / klen; ny = y / klen; nz = z / klen;
      break;
    }
    case 'box': {
      const uw = ((u % 1) + 1) % 1;
      const face = Math.floor(uw * 6);
      const fu = uw * 6 - face;
      const fy = (v - 0.5) * S;
      const a = (fu - 0.5) * S;
      if      (face === 0) { x = a;    z = -r;   y = fy;   nx = 0; ny = 0; nz = -1; }
      else if (face === 1) { x = r;    z = a;    y = fy;   nx = 1; ny = 0; nz = 0;  }
      else if (face === 2) { x = -a;   z = r;    y = fy;   nx = 0; ny = 0; nz = 1;  }
      else if (face === 3) { x = -r;   z = -a;   y = fy;   nx = -1; ny = 0; nz = 0; }
      else if (face === 4) { x = a;    z = (v - 0.5) * S; y = r;  nx = 0; ny = 1; nz = 0; }
      else                 { x = a;    z = (0.5 - v) * S; y = -r; nx = 0; ny = -1; nz = 0; }
      break;
    }
    case 'saddle': {
      const ux = u - 0.5, vz = v - 0.5;
      x = ux * S; z = vz * S * P.aspect;
      y = (ux * ux - vz * vz) * r * 1.2;
      nx = 0; ny = 1; nz = 0;
      break;
    }
    case 'capsule': {
      const ang = u * 2 * Math.PI;
      const bodyHalf = h * 0.28;
      const fullH = bodyHalf * 2 + r * 2;
      const yv = (v - 0.5) * fullH;
      if (Math.abs(yv) <= bodyHalf) {
        x = r * Math.cos(ang); z = r * Math.sin(ang); y = yv;
        nx = Math.cos(ang); ny = 0; nz = Math.sin(ang);
      } else {
        const top = yv > 0;
        const t = (Math.abs(yv) - bodyHalf) / r;
        const tc = Math.min(t, 1);
        const rc = r * Math.cos(tc * Math.PI / 2);
        const ry = r * Math.sin(tc * Math.PI / 2);
        x = rc * Math.cos(ang); z = rc * Math.sin(ang);
        y = (top ? 1 : -1) * (bodyHalf + ry);
        nx = Math.cos(ang) * Math.cos(tc * Math.PI / 2);
        ny = (top ? 1 : -1) * Math.sin(tc * Math.PI / 2);
        nz = Math.sin(ang) * Math.cos(tc * Math.PI / 2);
      }
      break;
    }
    case 'double-helix': {
      const strand = (v * 10 | 0) % 2;
      const ang = u * 2 * Math.PI * Math.max(1, P.turns) + strand * Math.PI;
      x = r * 0.55 * Math.cos(ang);
      z = r * 0.55 * Math.sin(ang);
      y = (v - 0.5) * h;
      nx = Math.cos(ang); ny = 0; nz = Math.sin(ang);
      break;
    }
    case 'cluster': // handled per-instance with cube mapping
    case 'plane':
    default: {
      // plane: flat surface in XZ (matches guide). u→x, v→z, y=0.
      x = (u - 0.5) * S;
      z = (v - 0.5) * (S * P.aspect);
      y = 0;
      nx = 0; ny = 1; nz = 0;
      break;
    }
  }
  if (inst) { x += inst.x; y += inst.y; z += inst.z; }
  return { x, y, z, nx, ny, nz };
}

// Isometric basis (orthographic). Returns screen-space X,Y plus raw depth.
function projectIso(p, P, width, height) {
  const k = (0.45 * Math.min(width, height) * P.zoom) / FORM_SIZE_BASE;
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
  const dist = 2.5 * FORM_SIZE_BASE;
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

// Per-form v normalization (Option B: coverage-normalized mapping).
// Maps uniform v∈[0,1] to a surface-aware v that covers only the
// most "useful" portion of each form's v parameter.
function normalizeV(form, v) {
  switch (form) {
    case 'torus':
    case 'torus-knot':
      return v * 0.5;                                          // outer half of tube
    case 'cone':
      return 1 - Math.sqrt(Math.max(0, 1 - v));               // equal-area radial
    case 'sphere':
      return Math.asin(Math.max(-1, Math.min(1, 2 * v - 1))) / Math.PI + 0.5; // equal-area lat
    case 'disc':
      return v * 0.85 + 0.08;                                 // avoid center + edge
    case 'mobius':
      return v * 0.65 + 0.175;                                // avoid strip edges
    default:
      return v;
  }
}

// Arc-length LUT: maps pixel-space x to the u parameter that gives
// arc-length-proportional spacing on a given surface row (v fixed).
// Samples the surface N times along u=[0..uRange], builds cumulative arc,
// then interpolates. Result: consistent kerning regardless of surface curvature.
function buildArcLUT(formKey, v, P, inst, width, N = 200) {
  const uRange = 2.5;
  const step = uRange / N;
  let prev = surfaceMap(formKey, 0, v, P, inst);
  const cum = [0];
  const us = [0];
  for (let i = 1; i <= N; i++) {
    const u = i * step;
    const pt = surfaceMap(formKey, u, v, P, inst);
    cum.push(cum[i - 1] + Math.hypot(pt.x - prev.x, pt.y - prev.y, pt.z - prev.z));
    us.push(u);
    prev = pt;
  }
  const wrapN = Math.round(N / uRange); // samples that cover u=0..1
  const arc01 = cum[wrapN] || (cum[N] / uRange);
  return (px) => {
    const target = (px / width) * arc01;
    if (target <= 0) return target / (arc01 || 1);
    if (target >= cum[N]) return us[N] + (target - cum[N]) / (arc01 || 1);
    let lo = 0, hi = N;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= target) lo = mid; else hi = mid;
    }
    const seg = cum[lo + 1] - cum[lo] || 1e-10;
    return us[lo] + (us[lo + 1] - us[lo]) * ((target - cum[lo]) / seg);
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
  // Flat-surface forms start at zero so they're never viewed edge-on by default.
  const _r1 = rand3(), _r2 = rand3(), _r3 = rand3(); // always consume 3 rolls
  const FLAT_FORMS = P.form === 'plane' || P.form === 'wave-plane' || P.form === 'saddle';
  const baseRX = FLAT_FORMS ? 0 : _r1 * 2 * Math.PI;
  const baseRY = FLAT_FORMS ? 0 : _r2 * 2 * Math.PI;
  const baseRZ = FLAT_FORMS ? 0 : _r3 * 2 * Math.PI;

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
  const surfaceFlowU = time * spd * 0.12;

  // Flat forms don't wrap in u: an unbounded surfaceFlowU would move glyphs
  // off the surface (x=(u-0.5)*S grows without limit). Zero it for these.
  const IS_FLAT = P.form === 'plane' || P.form === 'wave-plane' || P.form === 'saddle';
  const flowU = IS_FLAT ? 0 : surfaceFlowU;

  // Arc-length LUTs: one per unique v (line), built lazily.
  const arcLUTs = new Map();
  const getArcLUT = (v) => {
    const key = v.toFixed(4);
    if (!arcLUTs.has(key)) {
      arcLUTs.set(key, buildArcLUT(formKey, v, P, instances[0], width));
    }
    return arcLUTs.get(key);
  };

  // Atom-to-surface mapping mode. Maps layout pixel (xPix along the reading
  // line, yNorm = which line in [0,1]) to surface params (u,v).
  //   rings   — text wraps the circumference, one ring per line (default)
  //   columns — text runs along the axis, one vertical column per line
  //   spiral  — rings sheared into a continuous helix
  //   panel   — flat patch clamped to the front of the surface, no wrap
  const wrapMode = P.wrapMode || 'rings';
  const mapUV = (xPix, yNorm) => {
    const vN = P.vNorm ? normalizeV(formKey, yNorm) : yNorm;
    switch (wrapMode) {
      case 'columns':
        return { u: yNorm + flowU, v: xPix / width };
      case 'spiral': {
        const lut = getArcLUT(vN);
        return { u: lut(xPix) + flowU + yNorm * Math.max(1, P.turns), v: vN };
      }
      case 'panel':
        return { u: 0.25 + (xPix / width) * 0.5 + flowU, v: 0.25 + yNorm * 0.5 };
      case 'rings':
      default: {
        const lut = getArcLUT(vN);
        return { u: lut(xPix) + flowU, v: vN };
      }
    }
  };

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
      const yNorm = c.y / height;
      const m0 = mapUV(c.x, yNorm);
      const u = m0.u;
      const v = m0.v;
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
        const mT = mapUV(c.x + TANGENT_D, yNorm);
        const prSu = transformPoint(mT.u, mT.v, inst, rainDY);
        const tx = prSu.X - pr.X;
        const ty = prSu.Y - pr.Y;
        const len = Math.hypot(tx, ty);
        if (len >= 1e-4) {
          const ca = tx / len;
          const sa = ty / len;
          const scale = P.projection === 'perspective' ? pr.scale : 1;
          matrixTransform = {
            a: ca * scale,
            b: sa * scale,
            c: -sa * scale,
            d: ca * scale,
            e: pr.X,
            f: pr.Y,
          };
        }
        // else: degenerate tangent — fall back to billboard (matrixTransform stays null)
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
    case 'plane': {
      // Bounding rectangle of the plane extents + axis cross.
      const px = S / 2, pz = (S * P.aspect) / 2;
      d += seg(-px, 0, -pz, px, 0, -pz);
      d += seg(px, 0, -pz, px, 0, pz);
      d += seg(px, 0, pz, -px, 0, pz);
      d += seg(-px, 0, pz, -px, 0, -pz);
      d += seg(-px, 0, 0, px, 0, 0);
      d += seg(0, 0, -pz, 0, 0, pz);
      break;
    }
    case 'torus': {
      const Rt = r, rt = r * Math.max(0.1, Math.min(P.aspect, 1.5)) * 0.4;
      d += ellipse(0, Rt + rt);           // outer equatorial ring
      if (Rt - rt > 2) d += ellipse(0, Rt - rt); // inner equatorial ring
      // Meridional ring (a circle through the tube cross-section at u=0)
      let pm = '';
      for (let i = 0; i <= 48; i++) {
        const b = (i / 48) * 2 * Math.PI;
        const px2 = (Rt + rt * Math.cos(b)), py2 = rt * Math.sin(b);
        const pr = pj(px2, py2, 0);
        pm += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
      }
      d += pm + ' ';
      break;
    }
    case 'cone': {
      d += ellipse(h / 2, r);             // base circle
      // 4 edges from apex (top) to base rim
      for (let q = 0; q < 4; q++) {
        const a = (q / 4) * 2 * Math.PI;
        d += seg(0, -h / 2, 0, r * Math.cos(a), h / 2, r * Math.sin(a));
      }
      break;
    }
    case 'disc': {
      const innerR = r * P.aspect * 0.25;
      d += ellipse(0, r);                 // outer rim
      if (innerR > 2) d += ellipse(0, innerR); // inner hole
      d += seg(-r, 0, 0, r, 0, 0);       // diameter cross
      d += seg(0, 0, -r, 0, 0, r);
      break;
    }
    case 'wave-plane': {
      const wx = S / 2, wz = (S * P.aspect) / 2;
      // Flat boundary rectangle
      d += seg(-wx, 0, -wz, wx, 0, -wz);
      d += seg(wx, 0, -wz, wx, 0, wz);
      d += seg(wx, 0, wz, -wx, 0, wz);
      d += seg(-wx, 0, wz, -wx, 0, -wz);
      // Wave profile at z=0
      const turns = Math.max(1, P.turns);
      let pw = '';
      for (let i = 0; i <= 64; i++) {
        const u = i / 64;
        const wx2 = (u - 0.5) * S;
        const wy2 = Math.sin(u * 2 * Math.PI * turns) * r * 0.45;
        const pr = pj(wx2, wy2, 0);
        pw += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
      }
      d += pw + ' ';
      break;
    }
    case 'mobius': {
      // Center-line of the strip (w=0 in the parametric)
      let pm = '';
      for (let i = 0; i <= 96; i++) {
        const t = (i / 96) * 2 * Math.PI;
        const pr = pj(r * Math.cos(t), 0, r * Math.sin(t));
        pm += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
      }
      d += pm + ' ';
      // Width guide at 0 and π
      const hw = r * Math.max(0.2, P.aspect) * 0.3;
      d += seg(r, hw, 0, r, -hw, 0);
      d += seg(-r, -hw, 0, -r, hw, 0);
      break;
    }
    case 'torus-knot': {
      const pk = Math.max(1, Math.round(P.facets));
      const qk = Math.max(1, Math.round(P.turns));
      const Rk = r * 0.62, rtk = r * 0.28;
      let pk2 = '';
      const steps = 120 * Math.max(pk, qk);
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * 2 * Math.PI;
        const kx = (Rk + rtk * Math.cos(qk * t)) * Math.cos(pk * t);
        const kz = (Rk + rtk * Math.cos(qk * t)) * Math.sin(pk * t);
        const ky = rtk * Math.sin(qk * t) * 1.8;
        const pr = pj(kx, ky, kz);
        pk2 += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
      }
      d += pk2 + ' ';
      break;
    }
    case 'box': {
      // 12-edge wireframe (same as cube)
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
      for (const [a, b] of edges) {
        const va = verts[a], vb = verts[b];
        d += seg(va[0], va[1], va[2], vb[0], vb[1], vb[2]);
      }
      break;
    }
    case 'saddle': {
      // Two parabolic cross-sections + boundary rect
      const sx = S / 2, sz = (S * P.aspect) / 2;
      // X-axis parabola (at z=0): y=(ux^2)*r*1.2 as ux varies -0.5..0.5
      let psx = '';
      for (let i = 0; i <= 32; i++) {
        const ux = i / 32 - 0.5;
        const vz2 = 0;
        const xx = ux * S, zz = vz2 * S * P.aspect;
        const yy = (ux * ux - vz2 * vz2) * r * 1.2;
        const pr = pj(xx, yy, zz);
        psx += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
      }
      d += psx + ' ';
      // Z-axis parabola (at x=0)
      let psz = '';
      for (let i = 0; i <= 32; i++) {
        const ux2 = 0;
        const vz3 = i / 32 - 0.5;
        const xx2 = ux2 * S, zz2 = vz3 * S * P.aspect;
        const yy2 = (ux2 * ux2 - vz3 * vz3) * r * 1.2;
        const pr = pj(xx2, yy2, zz2);
        psz += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
      }
      d += psz + ' ';
      // Boundary corners (4 edges of the flat XZ extent)
      d += seg(-sx, 0, -sz, sx, 0, -sz);
      d += seg(sx, 0, -sz, sx, 0, sz);
      d += seg(sx, 0, sz, -sx, 0, sz);
      d += seg(-sx, 0, sz, -sx, 0, -sz);
      break;
    }
    case 'capsule': {
      const bodyHalf = h * 0.28;
      const fullH = bodyHalf * 2 + r * 2;
      const topY = bodyHalf + r, botY = -(bodyHalf + r);
      d += ellipse(-bodyHalf, r);         // bottom cap join
      d += ellipse(bodyHalf, r);          // top cap join
      // Vertical edges
      d += seg(r, botY, 0, r, topY, 0);
      d += seg(-r, botY, 0, -r, topY, 0);
      d += seg(0, botY, r, 0, topY, r);
      d += seg(0, botY, -r, 0, topY, -r);
      // Hemisphere outlines (meridional arcs at top/bottom)
      for (let cap = -1; cap <= 1; cap += 2) {
        let pc = '';
        const cy = cap * bodyHalf;
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * Math.PI - Math.PI / 2;
          const pr = pj(r * Math.cos(a), cy + cap * r * Math.sin(a), 0);
          pc += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
        }
        d += pc + ' ';
      }
      break;
    }
    case 'double-helix': {
      // Two helix strands offset by π
      for (let strand = 0; strand < 2; strand++) {
        const phaseOff = strand * Math.PI;
        const turns = Math.max(1, P.turns);
        let ph = '';
        for (let i = 0; i <= 96; i++) {
          const u = i / 96;
          const ang = u * 2 * Math.PI * turns + phaseOff;
          const pr = pj(r * 0.55 * Math.cos(ang), (u - 0.5) * h, r * 0.55 * Math.sin(ang));
          ph += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
        }
        d += ph + ' ';
      }
      // Axis line
      d += seg(0, -h / 2, 0, 0, h / 2, 0);
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
