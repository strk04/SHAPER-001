// engine.js — pure functions for SHAPER 001
// Seeded PRNG + layout algorithm. Same seed + params => identical output.

// 2D value noise: smooth trilinear hash. Output [0,1].
function valueNoise2D(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  return h(ix, iy) * (1 - ux) * (1 - uy)
       + h(ix + 1, iy) * ux * (1 - uy)
       + h(ix, iy + 1) * (1 - ux) * uy
       + h(ix + 1, iy + 1) * ux * uy;
}

// 4-octave fBm: offsets per octave prevent axis alignment → organic feel.
function fbm2D(x, y) {
  let v = 0, a = 0.5, px = x, py = y;
  for (let i = 0; i < 4; i++) {
    v += a * valueNoise2D(px, py);
    px = px * 2.1 + 1.7; py = py * 2.1 + 0.3;
    a *= 0.5;
  }
  return v; // ≈ [0, 1]
}

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
    charOpacity = 0.6,
    charSkew = 0,
    densityMap = 0,
    opacityMode = 'none',
    opacityProb = 0.15,
    opacityEvery = 2,
    blinkMode = 'none',
    blinkRate = 2,
    blinkProb = 0.15,
    blinkEvery = 2,
    sizeMode = 'none',
    sizeAmt = 1.5,
    sizeProb = 0.15,
    sizeEvery = 2,
    accentMode  = 'none', accentProb  = 0.15, accentEvery  = 2,
    accentMode2 = 'none', accentProb2 = 0,    accentEvery2 = 2,
    accentMode3 = 'none', accentProb3 = 0,    accentEvery3 = 2,
    accentMode4 = 'none', accentProb4 = 0,    accentEvery4 = 2,
  } = params;

  // Time/speed default to 0/1 when absent (static render stays identical).
  const time = typeof t === 'number' ? t : 0;
  const spd = typeof speed === 'number' ? speed : 1;
  const trackRandAmt = typeof trackRand === 'number' ? trackRand : 0;

  const rand = mulberry32(seed);
  const randAtom = mulberry32((seed ^ 0x9e3779b9) >>> 0);
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
      const wordIdxForAccent = wordIndex;
      const word = words[wordIndex % words.length];
      wordIndex++;

      // lay each char of the word
      for (let c = 0; c < word.length; c++) {
        const ch = word[c];
        const cw = measureChar(ch, fontSize, font);

        // Atom PRNG rolls (separate PRNG — always consumed for determinism)
        const atomOp = randAtom();
        const atomSkewRaw = randAtom();
        const atomAccent = randAtom();
        const atomBlink = randAtom();
        const atomSize = randAtom();

        const jitterOn = rand() < yJitterAffect;
        const yOff = jitterOn ? (rand() - 0.5) * 2 * yJitter : 0;
        const xChaos = (rand() - 0.5) * charChaos;
        const trackJ = rand() * trackRandAmt * fontSize;

        // densityMap: drop probability increases toward right edge
        let effectiveDrop = dropProb;
        if (densityMap > 0) {
          const xNorm = width > 0 ? Math.max(0, Math.min(1, x / width)) : 0;
          effectiveDrop = Math.min(1, dropProb + densityMap * xNorm);
        }
        const drop = rand() < effectiveDrop;

        if (!drop) {
          const xNorm = width > 0 ? Math.max(0, Math.min(1, (x + xChaos) / width)) : 0;

          let opacityT = 0;
          if (opacityMode === 'seeded') opacityT = atomOp < opacityProb ? 1 : 0;
          else if (opacityMode === 'alternating-word') opacityT = Math.floor(wordIdxForAccent / Math.max(1, opacityEvery)) % 2 === 1 ? 1 : 0;
          else if (opacityMode === 'first-letter') opacityT = c === 0 ? 1 : 0;
          const extraOp = opacityT ? Math.max(0.05, 1 - charOpacity) : 1;

          const skew = (atomSkewRaw - 0.5) * 2 * charSkew;

          let sizeMul = 1;
          if (sizeMode === 'ramp') sizeMul = Math.max(0.05, Math.pow(Math.max(0.01, sizeAmt), xNorm * 2 - 1));
          else if (sizeMode === 'seeded') sizeMul = atomSize < sizeProb ? sizeAmt : 1;
          else if (sizeMode === 'alternating-word') sizeMul = Math.floor(wordIdxForAccent / Math.max(1, sizeEvery)) % 2 === 1 ? sizeAmt : 1;
          else if (sizeMode === 'first-letter') sizeMul = c === 0 ? sizeAmt : 1;

          let blinkT = 0;
          if (blinkMode === 'seeded') blinkT = atomBlink < blinkProb ? 1 : 0;
          else if (blinkMode === 'alternating-word') blinkT = Math.floor(wordIdxForAccent / Math.max(1, blinkEvery)) % 2 === 1 ? 1 : 0;
          else if (blinkMode === 'first-letter') blinkT = c === 0 ? 1 : 0;

          const _a1 = atomAccent;
          const _a2 = (atomAccent * 1.6180339887) % 1;
          const _a3 = (atomAccent * 2.2360679774) % 1;
          const _a4 = (atomAccent * 3.1415926535) % 1;
          function _evalAM(mode, a, prob, every, wi, ci) {
            if (mode === 'seeded')           return a < prob;
            if (mode === 'alternating-word') return Math.floor(wi / Math.max(1, every)) % 2 === 1;
            if (mode === 'first-letter')     return ci === 0;
            return false;
          }
          let accentT = 0;
          if (_evalAM(accentMode4, _a4, accentProb4, accentEvery4, wordIdxForAccent, c)) accentT = 4;
          if (_evalAM(accentMode3, _a3, accentProb3, accentEvery3, wordIdxForAccent, c)) accentT = 3;
          if (_evalAM(accentMode2, _a2, accentProb2, accentEvery2, wordIdxForAccent, c)) accentT = 2;
          if (_evalAM(accentMode,  _a1, accentProb,  accentEvery,  wordIdxForAccent, c)) accentT = 1;

          chars.push({ ch, x: x + xChaos, y: baseY + yOff, extraOp, skew, sizeMul, accentT, blinkT });
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
            if (px > -fontSize) tiled.push({ ...c, x: px });
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
              if (px > -fontSize) tiled.push({ ...c, x: px });
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

const CAM_NEUTRAL = {
  fov: 60, zoom: 1,
  rotXSpeed: 0, rotYSpeed: 0, rotZSpeed: 0,
  depthFade: 0, angleX: 0, angleY: 0,
};

// Defaults for 3D params (keep static plane render unaffected when absent).
function read3DParams(params) {
  const num = (v, d) => (typeof v === 'number' && !isNaN(v) ? v : d);
  const ce = params.cameraEnabled || {};
  const cam = (key) => ce[key] === false ? CAM_NEUTRAL[key] : num(params[key], CAM_NEUTRAL[key]);
  return {
    form: params.form || 'plane',
    projection: params.projection || 'isometric',
    formSize: num(params.formSize, 400),
    aspect: num(params.aspect, 1),
    facets: Math.max(3, Math.round(num(params.facets, 4))),
    turns: Math.max(1, Math.round(num(params.turns, 3))),
    count: Math.max(1, Math.round(num(params.count, 3))),
    scatter: num(params.scatter, 80),
    fov: cam('fov'),
    zoom: cam('zoom'),
    rotXSpeed: cam('rotXSpeed'),
    rotYSpeed: cam('rotYSpeed'),
    rotZSpeed: cam('rotZSpeed'),
    depthFade: cam('depthFade'),
    pulse: num(params.pulse, 0),
    pulseSpeed: num(params.pulseSpeed, 1),
    rainProb: num(params.rainProb, 0),
    rainSpeed: num(params.rainSpeed, 1),
    guides: !!params.guides,
    backfaceMirror: !!params.backfaceMirror,
    surfaceText: !!params.surfaceText,
    angleX: cam('angleX'),
    angleY: cam('angleY'),
    customOutline: (params.form || 'plane') === 'custom-prism'
      ? readOutlinePoints(params.customOutline)
      : null,
    vNorm: !!params.vNorm,
    wrapMode: params.wrapMode || 'rings',
    noiseTexture: num(params.noiseTexture, 0),
    guideMeta: !!params.guideMeta,
    fps: num(params.fps, 0),
    morphForm: params.morphForm || '',
    morphT: num(params.morphT, 0),
    morphAuto: !!params.morphAuto,
    morphSpeed: num(params.morphSpeed, 0.2),
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
function _tubePt(px,py,pz,qx,qy,qz,tr,phi){
  const dx=qx-px,dy=qy-py,dz=qz-pz,tl=Math.hypot(dx,dy,dz)||1;
  const Tx=dx/tl,Ty=dy/tl,Tz=dz/tl;
  const uA=Math.abs(Ty)<.9,rx=uA?0:1,ry=uA?1:0;
  const dot=rx*Tx+ry*Ty;
  const n0x=rx-dot*Tx,n0y=ry-dot*Ty,n0z=-dot*Tz;
  const nl=Math.hypot(n0x,n0y,n0z)||1;
  const Nx=n0x/nl,Ny=n0y/nl,Nz=n0z/nl;
  const Bx=Ty*Nz-Tz*Ny,By=Tz*Nx-Tx*Nz,Bz=Tx*Ny-Ty*Nx;
  const cp=Math.cos(phi),sp=Math.sin(phi);
  const nx=cp*Nx+sp*Bx,ny=cp*Ny+sp*By,nz=cp*Nz+sp*Bz;
  return[px+tr*nx,py+tr*ny,pz+tr*nz,nx,ny,nz];
}

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
    case 'paraboloid': {
      // Bowl opening upward. u = azimuthal, v = radial (0=apex, 1=rim).
      const ang = u * 2 * Math.PI;
      const rv = v;
      x = r * rv * Math.cos(ang);
      z = r * rv * Math.sin(ang);
      y = rv * rv * h * 0.55 - h * 0.25;
      // Outward normal: outward radial + downward tilt (tangent of parabola).
      const slope = 2 * rv * h * 0.55 / r;
      const slen = Math.hypot(1, slope);
      nx = Math.cos(ang) / slen; nz = Math.sin(ang) / slen; ny = -slope / slen;
      break;
    }
    case 'hyperboloid': {
      // Cooling-tower shape: cosh profile, tightest at v=0.5.
      const k = Math.max(0.5, P.aspect) * 2.2;
      const ang = u * 2 * Math.PI;
      const ch = Math.cosh((v - 0.5) * k);
      x = r * 0.45 * ch * Math.cos(ang);
      z = r * 0.45 * ch * Math.sin(ang);
      y = (v - 0.5) * h;
      nx = Math.cos(ang); ny = 0; nz = Math.sin(ang);
      break;
    }
    case 'ellipsoid': {
      // 3-axis ellipsoid: aspect controls y-radius independently.
      const lon = u * 2 * Math.PI;
      const lat = (v - 0.5) * Math.PI;
      const cl = Math.cos(lat);
      x = r * Math.cos(lon) * cl;
      y = r * P.aspect * Math.sin(lat);
      z = r * Math.sin(lon) * cl;
      // Normal: gradient of (x/r)²+(y/(r*aspect))²+(z/r)²=1.
      const ry2 = r * P.aspect;
      const nlen = Math.hypot(x / (r * r), y / (ry2 * ry2), z / (r * r)) || 1;
      nx = (x / (r * r)) / nlen;
      ny = (y / (ry2 * ry2)) / nlen;
      nz = (z / (r * r)) / nlen;
      break;
    }
    case 'spring': {
      // Coil spring: helix of radius HR with tube of radius TR.
      const turns = Math.max(1, P.turns);
      const HR = r * 0.65;
      const TR = r * Math.max(0.08, P.aspect * 0.12);
      const theta = v * 2 * Math.PI * turns;
      const omega = 2 * Math.PI * turns;
      // Tangent of helix centerline (unnormalized).
      const Tx = -HR * Math.sin(theta) * omega;
      const Ty = h;
      const Tz = HR * Math.cos(theta) * omega;
      const Tlen = Math.hypot(Tx, Ty, Tz) || 1;
      const tx2 = Tx / Tlen, ty2 = Ty / Tlen, tz2 = Tz / Tlen;
      // Outward radial from helix axis (approx principal normal flipped).
      const Rx = Math.cos(theta), Ry = 0, Rz = Math.sin(theta);
      // Binormal: T × R (perpendicular in tube cross-section).
      const bx = ty2 * Rz - tz2 * Ry;
      const by = tz2 * Rx - tx2 * Rz;
      const bz = tx2 * Ry - ty2 * Rx;
      const blen = Math.hypot(bx, by, bz) || 1;
      const phi = u * 2 * Math.PI;
      const cp = Math.cos(phi), sp = Math.sin(phi);
      nx = cp * Rx + sp * bx / blen;
      ny = cp * Ry + sp * by / blen;
      nz = cp * Rz + sp * bz / blen;
      x = HR * Math.cos(theta) + TR * nx;
      y = (v - 0.5) * h + TR * ny;
      z = HR * Math.sin(theta) + TR * nz;
      break;
    }
    case 'monkey-saddle': {
      // z = x³ − 3xy² (3 peaks, 3 valleys vs regular saddle's 2+2).
      const ux2 = u - 0.5, vz2 = v - 0.5;
      x = ux2 * S;
      z = vz2 * S * P.aspect;
      y = (ux2 * ux2 * ux2 - 3 * ux2 * vz2 * vz2) * r * 1.6;
      // Normal: ∂y/∂x = (3ux²−3vz²)*scale, ∂y/∂z = −6ux*vz*scale
      const dydx = (3 * ux2 * ux2 - 3 * vz2 * vz2) * r * 1.6 / S;
      const dydz = -6 * ux2 * vz2 * r * 1.6 / (S * P.aspect);
      const nlen2 = Math.hypot(dydx, 1, dydz) || 1;
      nx = -dydx / nlen2; ny = 1 / nlen2; nz = -dydz / nlen2;
      break;
    }
    case 'shell': {
      // Logarithmic spiral shell (nautilus). v = travel, u = tube angle.
      const turns = Math.max(1, P.turns);
      const sweep = v * 2 * Math.PI * turns;
      const growth = Math.exp(v * 2.0); // radius grows ~e² from v=0..1
      const Rc = r * 0.25 * growth;
      const TR2 = Rc * 0.45;
      const cx2 = Rc * Math.cos(sweep);
      const cz2 = Rc * Math.sin(sweep);
      const cy2 = (0.5 - v) * h * 0.5;
      // Outward radial from spiral center.
      const Rx2 = Math.cos(sweep), Rz2 = Math.sin(sweep);
      const phi2 = u * 2 * Math.PI;
      nx = Math.cos(phi2) * Rx2;
      nz = Math.cos(phi2) * Rz2;
      ny = Math.sin(phi2);
      x = cx2 + TR2 * nx;
      y = cy2 + TR2 * ny;
      z = cz2 + TR2 * nz;
      break;
    }
    case 'catenoid': {
      // Minimal surface between two rings. cosh profile.
      const k2 = Math.max(0.5, 3 / P.aspect);
      const vv = (v - 0.5) * k2;
      const ch2 = Math.cosh(vv);
      const rW = r / Math.cosh(k2 * 0.5); // normalise waist to ≈r
      const ang2 = u * 2 * Math.PI;
      x = rW * ch2 * Math.cos(ang2);
      z = rW * ch2 * Math.sin(ang2);
      y = (v - 0.5) * h;
      nx = Math.cos(ang2); ny = 0; nz = Math.sin(ang2);
      break;
    }
    case 'superquadric': {
      // Generalised sphere: facets controls squareness (2=sphere, 8≈cube).
      const exp = 2 / Math.max(0.25, Math.min(8, P.facets));
      const sgn = (val) => (val >= 0 ? 1 : -1);
      const sp = (val, e) => sgn(val) * Math.abs(val) ** e;
      const lon2 = u * 2 * Math.PI;
      const lat2 = (v - 0.5) * Math.PI;
      x = r * sp(Math.cos(lon2), exp) * sp(Math.cos(lat2), exp);
      y = r * P.aspect * sp(Math.sin(lat2), exp);
      z = r * sp(Math.sin(lon2), exp) * sp(Math.cos(lat2), exp);
      // Approximate outward normal.
      const nlen3 = Math.hypot(x, y / (P.aspect * P.aspect), z) || 1;
      nx = x / nlen3; ny = y / (P.aspect * P.aspect * nlen3); nz = z / nlen3;
      break;
    }
    case 'dini': {
      // Dini's surface: pseudosphere with twist (constant negative curvature).
      const a = r * 0.42;
      const twist = Math.max(0.05, P.aspect) * 3;
      const turns2 = Math.max(1, P.turns);
      const phi3 = v * Math.PI * 0.82 + 0.09; // latitude (avoid poles)
      const theta2 = u * 2 * Math.PI * turns2 + twist * v;
      x = a * Math.sin(phi3) * Math.cos(theta2);
      z = a * Math.sin(phi3) * Math.sin(theta2);
      y = a * (Math.cos(phi3) + Math.log(Math.tan(phi3 / 2)));
      // Normal: outward on pseudosphere.
      const nlen4 = Math.hypot(x, 0, z) || 1;
      nx = x / nlen4; ny = 0; nz = z / nlen4;
      break;
    }
    case 'trifolium': {
      // Trifolium (3-petal rose) extruded as a prism.
      const theta3 = u * 2 * Math.PI;
      const rho = r * 0.6 * Math.max(0, 1 + Math.cos(3 * theta3)) * 0.5;
      x = rho * Math.cos(theta3);
      z = rho * Math.sin(theta3);
      y = (v - 0.5) * h;
      // Normal: perpendicular to curve in XZ.
      const drho = -r * 0.6 * 0.5 * 3 * Math.sin(3 * theta3);
      const dxdt = drho * Math.cos(theta3) - rho * Math.sin(theta3);
      const dzdt = drho * Math.sin(theta3) + rho * Math.cos(theta3);
      const nlen5 = Math.hypot(dzdt, 0, -dxdt) || 1;
      nx = dzdt / nlen5; ny = 0; nz = -dxdt / nlen5;
      break;
    }
    case 'enneper': {
      const eu=(u-.5)*3,ev=(v-.5)*3,esc=r*.27;
      x=(eu-eu**3/3+eu*ev*ev)*esc; z=(ev-ev**3/3+ev*eu*eu)*esc;
      y=(eu*eu-ev*ev)*esc*.55;
      nx=0;ny=1;nz=0; break;
    }
    case 'pseudosphere': {
      const pLat=v*(Math.PI-.4)+.2,pLon=u*2*Math.PI,pSl=Math.sin(pLat);
      x=r*.52*pSl*Math.cos(pLon); z=r*.52*pSl*Math.sin(pLon);
      y=r*.52*(Math.cos(pLat)+Math.log(Math.tan(pLat/2)));
      nx=Math.cos(pLon);ny=0;nz=Math.sin(pLon); break;
    }
    case 'gyroid': {
      const gx=(u-.5)*Math.PI*2.4,gy=(v-.5)*Math.PI*2.4;
      let gz=0;
      for(let _i=0;_i<6;_i++){
        const _f=Math.sin(gx)*Math.cos(gy)+Math.sin(gy)*Math.cos(gz)+Math.sin(gz)*Math.cos(gx);
        const _d=-Math.sin(gy)*Math.sin(gz)+Math.cos(gz)*Math.cos(gx);
        gz-=_f/(Math.abs(_d)>1e-5?_d:1e-5);
        gz=Math.max(-Math.PI,Math.min(Math.PI,gz));
      }
      const gsc=r*.26; x=gx*gsc;z=gy*gsc;y=gz*gsc;
      nx=0;ny=1;nz=0; break;
    }
    case 'scherk': {
      const skx=(u-.5)*Math.PI*.88,sky=(v-.5)*Math.PI*.88;
      const ckx=Math.cos(skx),cky=Math.cos(sky),skSc=r*.36;
      x=skx*skSc;z=sky*skSc;
      y=(Math.abs(ckx)>.04&&Math.abs(cky)>.04)?Math.log(Math.abs(cky/ckx))*skSc*.85:0;
      nx=0;ny=1;nz=0; break;
    }
    case 'boy-surface': {
      const bTh=u*Math.PI/2,bPh=v*2*Math.PI,bCT=Math.cos(bTh);
      const bD=2-Math.SQRT2*Math.sin(3*bTh)*Math.sin(2*bPh);
      if(Math.abs(bD)<.08){x=0;y=0;z=0;nx=0;ny=1;nz=0;break;}
      const bSc=r*.46;
      x=(Math.SQRT2*bCT*bCT*Math.cos(2*bPh)+bCT*Math.sin(2*bTh)*Math.cos(bPh))/bD*bSc;
      z=(Math.SQRT2*bCT*bCT*Math.sin(2*bPh)-bCT*Math.sin(2*bTh)*Math.sin(bPh))/bD*bSc;
      y=3*bCT*bCT/bD*bSc-bSc;
      nx=0;ny=1;nz=0; break;
    }
    case 'roman-surface': {
      const ra=u*Math.PI,rb=v*Math.PI,rSc=r*.6;
      x=.5*Math.sin(2*ra)*Math.cos(rb)**2*rSc;
      z=.5*Math.sin(ra)*Math.sin(2*rb)*rSc;
      y=.5*Math.cos(ra)*Math.sin(2*rb)*rSc;
      nx=0;ny=1;nz=0; break;
    }
    case 'klein-bottle': {
      const ka=u*2*Math.PI,kb=v*2*Math.PI,kRv=4*(1-Math.cos(ka)/2),kSc=r*.055;
      let kx2,ky2;
      if(ka<Math.PI){kx2=6*Math.cos(ka)*(1+Math.sin(ka))+kRv*Math.cos(kb)*Math.cos(ka);ky2=16*Math.sin(ka)+kRv*Math.sin(ka)*Math.cos(kb);}
      else{kx2=6*Math.cos(ka)*(1+Math.sin(ka))+kRv*Math.cos(kb+Math.PI);ky2=16*Math.sin(ka);}
      x=kx2*kSc;y=ky2*kSc;z=kRv*Math.sin(kb)*kSc;
      nx=0;ny=1;nz=0; break;
    }
    case 'knot-35': {
      const k35t=u*2*Math.PI,k35R=r*.56,k35r2=r*.24,k35tr=r*Math.max(.05,P.aspect*.1);
      const _k35=(t)=>[(k35R+k35r2*Math.cos(5*t))*Math.cos(3*t),k35r2*Math.sin(5*t),(k35R+k35r2*Math.cos(5*t))*Math.sin(3*t)];
      const _kp=_k35(k35t),_kq=_k35(k35t+1e-4);
      const _kr=_tubePt(_kp[0],_kp[1],_kp[2],_kq[0],_kq[1],_kq[2],k35tr,v*2*Math.PI);
      x=_kr[0];y=_kr[1];z=_kr[2];nx=_kr[3];ny=_kr[4];nz=_kr[5]; break;
    }
    case 'knot-27': {
      const k27t=u*2*Math.PI,k27R=r*.56,k27r2=r*.22,k27tr=r*Math.max(.05,P.aspect*.1);
      const _k27=(t)=>[(k27R+k27r2*Math.cos(7*t))*Math.cos(2*t),k27r2*Math.sin(7*t),(k27R+k27r2*Math.cos(7*t))*Math.sin(2*t)];
      const _kp2=_k27(k27t),_kq2=_k27(k27t+1e-4);
      const _kr2=_tubePt(_kp2[0],_kp2[1],_kp2[2],_kq2[0],_kq2[1],_kq2[2],k27tr,v*2*Math.PI);
      x=_kr2[0];y=_kr2[1];z=_kr2[2];nx=_kr2[3];ny=_kr2[4];nz=_kr2[5]; break;
    }
    case 'lissajous-3d': {
      const la=Math.max(1,Math.round(P.facets)),lb=Math.max(1,Math.round(P.turns));
      const lc=Math.max(1,Math.round(P.aspect*2+1)),lR=r*.65,lTr=r*Math.max(.04,P.aspect*.06);
      const lt=u*2*Math.PI;
      const _lc=(t)=>[lR*Math.cos(la*t+.4),lR*Math.sin(lb*t),lR*Math.cos(lc*t+.7)];
      const _lp=_lc(lt),_lq=_lc(lt+1e-4);
      const _lr=_tubePt(_lp[0],_lp[1],_lp[2],_lq[0],_lq[1],_lq[2],lTr,v*2*Math.PI);
      x=_lr[0];y=_lr[1];z=_lr[2];nx=_lr[3];ny=_lr[4];nz=_lr[5]; break;
    }
    case 'cardioid-rev': {
      const ct=u*2*Math.PI,cphi=v*2*Math.PI,crp=1-Math.cos(ct),cSc=r*.38;
      x=crp*Math.cos(ct)*cSc-r*.18;
      y=crp*Math.sin(ct)*Math.cos(cphi)*cSc;
      z=crp*Math.sin(ct)*Math.sin(cphi)*cSc;
      nx=0;ny=Math.cos(cphi);nz=Math.sin(cphi); break;
    }
    case 'helicoid': {
      const hTurns=Math.max(1,P.turns),hAng=u*2*Math.PI*hTurns,hVr=v*2-1;
      x=hVr*r*Math.cos(hAng);z=hVr*r*Math.sin(hAng);y=(u-.5)*h;
      nx=Math.cos(hAng);ny=0;nz=Math.sin(hAng); break;
    }
    case 'hyperboloid-2': {
      const h2Lon=u*2*Math.PI,h2Sign=v<.5?1:-1;
      const h2T=(v<.5?v*2:(v-.5)*2)*Math.max(.5,P.aspect)*1.8;
      x=r*.42*Math.sinh(h2T)*Math.cos(h2Lon);z=r*.42*Math.sinh(h2T)*Math.sin(h2Lon);
      y=r*.42*Math.cosh(h2T)*h2Sign;
      nx=Math.cos(h2Lon);ny=0;nz=Math.sin(h2Lon); break;
    }
    case 'lemniscate-rev': {
      const lmt=u<.5?u*Math.PI-Math.PI/4:(u-.5)*Math.PI+3*Math.PI/4;
      const lmphi=v*2*Math.PI,lmc2=Math.cos(2*lmt);
      if(lmc2<=.005){x=0;y=0;z=0;nx=0;ny=1;nz=0;break;}
      const lmr=Math.sqrt(lmc2),lmSc=r*.62;
      const lmx2=lmr*Math.cos(lmt),lmy2=Math.abs(lmr*Math.sin(lmt));
      x=lmx2*lmSc;y=lmy2*Math.cos(lmphi)*lmSc;z=lmy2*Math.sin(lmphi)*lmSc;
      nx=0;ny=Math.cos(lmphi);nz=Math.sin(lmphi); break;
    }
    case 'dupin-cyclide': {
      const dcA=r*.6,dcB=r*.4,dcC=Math.sqrt(dcA*dcA-dcB*dcB),dcD=dcA*.3;
      const dcU=u*2*Math.PI,dcV=v*2*Math.PI,dcDen=dcA-dcC*Math.cos(dcU)*Math.cos(dcV);
      if(Math.abs(dcDen)<.04){x=0;y=0;z=0;nx=0;ny=1;nz=0;break;}
      x=(dcD*(dcC-dcA*Math.cos(dcU)*Math.cos(dcV))+dcB*dcB*Math.cos(dcU))/dcDen;
      y=dcB*Math.sin(dcU)*(dcA-dcD*Math.cos(dcV))/dcDen;
      z=dcB*Math.sin(dcV)*(dcC*Math.cos(dcU)-dcD)/dcDen;
      nx=Math.cos(dcU);ny=0;nz=Math.sin(dcV); break;
    }
    case 'superformula': {
      const sfM1=Math.max(1,Math.round(P.facets)),sfM2=Math.max(1,Math.round(P.turns));
      const sfN=Math.max(.1,P.aspect);
      const sfFn=(a,m)=>{const v1=Math.abs(Math.cos(m*a/4))**2+Math.abs(Math.sin(m*a/4))**2;return v1>0?v1**(-1/sfN):0;};
      const sfLon=u*2*Math.PI,sfLat=(v-.5)*Math.PI;
      const sfR1=sfFn(sfLon,sfM1),sfR2=sfFn(sfLat,sfM2),sfCl=Math.cos(sfLat);
      x=r*sfR1*Math.cos(sfLon)*sfR2*sfCl;y=r*sfR2*Math.sin(sfLat);z=r*sfR1*Math.sin(sfLon)*sfR2*sfCl;
      const sfL=Math.hypot(x,y,z)||1;nx=x/sfL;ny=y/sfL;nz=z/sfL; break;
    }
    case 'oloid': {
      const olt=u*2*Math.PI,olD=r*.5,olRc=r*.55;
      const olP1=[olD+olRc*Math.cos(olt),0,olRc*Math.sin(olt)];
      const olP2=[-olD+olRc*Math.cos(olt),olRc*Math.sin(olt),0];
      x=olP1[0]*(1-v)+olP2[0]*v;y=olP1[1]*(1-v)+olP2[1]*v;z=olP1[2]*(1-v)+olP2[2]*v;
      nx=0;ny=1;nz=0; break;
    }
    case 'swallowtail': {
      const swT=u*2.4-1.2,swA=(v-.5)*3.5;
      x=swA*r*.19;z=(-4*swT**3-2*swA*swT)*r*.065;y=(3*swT**4+swA*swT*swT)*r*.095;
      nx=0;ny=1;nz=0; break;
    }
    case 'seifert': {
      const sfT2=u*2*Math.PI,sfSc=r*.135;
      const _sfS=(t)=>[(Math.sin(t)+2*Math.sin(2*t))*sfSc,(Math.cos(t)-2*Math.cos(2*t))*sfSc,-Math.sin(3*t)*sfSc];
      const _sfP=_sfS(sfT2),_sfQ=_sfS(sfT2+1e-4);
      const _sfN=_tubePt(_sfP[0],_sfP[1],_sfP[2],_sfQ[0],_sfQ[1],_sfQ[2],0,1.5*sfT2);
      const sfW=(v-.5)*r*.20;
      x=_sfP[0]+_sfN[3]*sfW;y=_sfP[1]+_sfN[4]*sfW;z=_sfP[2]+_sfN[5]*sfW;
      nx=_sfN[3];ny=_sfN[4];nz=_sfN[5]; break;
    }
    case 'riemann-minimal': {
      const rmx=(u-.5)*Math.PI*2.6,rmy=(v-.5)*Math.PI*2.6,rmSc=r*.27;
      x=rmx*rmSc;z=rmy*rmSc;
      y=(Math.sin(rmx)*Math.cos(rmy)+.5*Math.sin(2*rmx)*Math.cos(2*rmy)+.25*Math.sin(3*rmx)*Math.cos(3*rmy))*rmSc*.85;
      nx=0;ny=1;nz=0; break;
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
    // Glyph scale: 1 at the center plane (z=0), varying only with depth.
    // Zoom is intentionally excluded — it scales position spread (via f) but
    // not glyph size, matching isometric (which renders glyphs at fontSize).
    // Baking zoom in here made perspective glyphs ~zoom× larger → ~zoom²
    // more fill area per fillText, the cause of the perspective slowdown.
    scale: dist / denom,
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
// Also returns the pre-computed 3D surface tangent at each sample so the
// caller can rotate it and skip a second surfaceMap call per glyph.
// Returns: (px) => { u, tangent: {dx,dy,dz} (unit 3D tangent along u) }
function buildArcLUT(formKey, v, P, inst, width, N = 200) {
  const uRange = 2.5;
  const step = uRange / N;
  const pts = [];
  for (let i = 0; i <= N; i++) pts.push(surfaceMap(formKey, i * step, v, P, inst));

  const cum = [0];
  const us = [];
  for (let i = 0; i <= N; i++) us.push(i * step);
  for (let i = 1; i <= N; i++) {
    cum.push(cum[i - 1] + Math.hypot(
      pts[i].x - pts[i - 1].x,
      pts[i].y - pts[i - 1].y,
      pts[i].z - pts[i - 1].z,
    ));
  }

  // Central-difference tangents (forward diff at endpoints).
  const tangents = [];
  for (let i = 0; i <= N; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    tangents.push({ dx: dx / len, dy: dy / len, dz: dz / len });
  }

  const wrapN = Math.round(N / uRange); // samples that cover u=0..1
  const arc01 = cum[wrapN] || (cum[N] / uRange);
  return (px, uOffset = 0) => {
    const t01 = px / width;
    const shifted = t01 + (((uOffset % 1) + 1) % 1);
    const shifted01 = shifted <= 1 ? shifted : shifted % 1;
    const target = shifted01 * arc01;
    let lo = 0;
    if (target <= 0) {
      lo = 0;
    } else if (target >= cum[N]) {
      lo = N - 1;
    } else {
      let hi = N;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= target) lo = mid; else hi = mid;
      }
    }
    const seg = cum[lo + 1] - cum[lo] || 1e-10;
    const t = Math.max(0, Math.min(1, (target - cum[lo]) / seg));
    const u = us[lo] + (us[lo + 1] - us[lo]) * t;
    const ta = tangents[lo], tb = tangents[Math.min(lo + 1, N)];
    const tdx = ta.dx + (tb.dx - ta.dx) * t;
    const tdy = ta.dy + (tb.dy - ta.dy) * t;
    const tdz = ta.dz + (tb.dz - ta.dz) * t;
    const tlen = Math.hypot(tdx, tdy, tdz) || 1;
    return { u, tangent: { dx: tdx / tlen, dy: tdy / tlen, dz: tdz / tlen } };
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
  const morphFormKey = P.morphForm || '';
  const morphTeff = P.morphAuto && morphFormKey
    ? (1 - Math.cos(time * P.morphSpeed * 2 * Math.PI)) / 2
    : Math.max(0, Math.min(1, P.morphT || 0));
  const surfaceFlowU = time * spd * 0.12;

  // Flat forms don't wrap in u: an unbounded surfaceFlowU would move glyphs
  // off the surface (x=(u-0.5)*S grows without limit). Zero it for these.
  const IS_FLAT = P.form === 'plane' || P.form === 'wave-plane' || P.form === 'saddle'
    || P.form === 'enneper' || P.form === 'scherk' || P.form === 'swallowtail' || P.form === 'riemann-minimal';
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
        return { u: yNorm + flowU, v: xPix / width, tangent: null };
      case 'spiral': {
        const motionU = flowU + yNorm * Math.max(1, P.turns);
        const { u, tangent } = getArcLUT(vN)(xPix, motionU);
        return {
          u,
          v: vN,
          tangent,
        };
      }
      case 'panel':
        return { u: 0.25 + (xPix / width) * 0.5 + flowU, v: 0.25 + yNorm * 0.5, tangent: null };
      case 'rings':
      default: {
        const { u, tangent } = getArcLUT(vN)(xPix, flowU);
        return { u, v: vN, tangent };
      }
    }
  };

  // Helper: apply the full transform chain to a (u,v) point given a fixed
  // instance offset and a fixed rain fall offset (dy). Returns projected point.
  const morphSurface = (u, v, inst) => {
    if (morphTeff > 0 && morphFormKey) {
      const ptA = surfaceMap(formKey, u, v, P, inst);
      const ptB = surfaceMap(morphFormKey, u, v, P, inst);
      const t = morphTeff;
      return {
        x: ptA.x + (ptB.x - ptA.x) * t, y: ptA.y + (ptB.y - ptA.y) * t, z: ptA.z + (ptB.z - ptA.z) * t,
        nx: ptA.nx + (ptB.nx - ptA.nx) * t, ny: ptA.ny + (ptB.ny - ptA.ny) * t, nz: ptA.nz + (ptB.nz - ptA.nz) * t,
      };
    }
    return surfaceMap(formKey, u, v, P, inst);
  };

  const transformPoint = (u, v, inst, rainDY) => {
    let pt = morphSurface(u, v, inst);
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
      // PRNG WARNING: consume rolls in FIXED order — inst, rain rolls, then noise.
      const inst = instances[Math.floor(rand3() * instCount) % instCount];
      const rainRoll = rand3();
      const rainPhase = rand3();

      // Domain warp: two independent fBm fields displace (u,v) before surfaceMap.
      // Characters are attracted toward noise peaks → organic density clusters.
      let wu = u, wv = v;
      if (P.noiseTexture > 0) {
        const str = P.noiseTexture * 0.7;
        wu = u + (fbm2D(u * 2 + 17.5, v * 2.5 + 3.2) - 0.5) * str;
        wv = v + (fbm2D(u * 2 +  3.1, v * 2.5 + 12.7) - 0.5) * str * 0.5;
      }

      let pt = morphSurface(wu, wv, inst);

      // Pulse (radial scale about origin).
      if (P.pulse > 0) {
        pt = { ...pt, x: pt.x * pulseScale, y: pt.y * pulseScale, z: pt.z * pulseScale };
      }

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
        let tx, ty;
        if (m0.tangent) {
          // Fast path: rotate the pre-computed 3D LUT tangent — no extra surfaceMap call.
          const rt = rotateDir(m0.tangent, ax, ay, az);
          if (P.projection === 'perspective') {
            tx = rt.x * pr.scale;
            ty = -rt.y * pr.scale;
          } else {
            // Isometric: apply the linear (non-translational) part of projectIso.
            const k = (0.45 * Math.min(width, height) * P.zoom) / FORM_SIZE_BASE;
            tx = (rt.x - rt.z) * Math.cos(Math.PI / 6) * k;
            ty = ((rt.x + rt.z) * Math.sin(Math.PI / 6) - rt.y) * k;
          }
        } else {
          // Fallback (panel / columns): compute tangent by sampling the surface.
          const mT = mapUV(c.x + TANGENT_D, yNorm);
          const prSu = transformPoint(mT.u, mT.v, inst, rainDY);
          tx = prSu.X - pr.X;
          ty = prSu.Y - pr.Y;
        }
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
        // else: degenerate tangent — billboard (matrixTransform stays null)
      }

      glyphs.push({
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
  const trace = (fixed, isV, steps = 48) => {
    let p = '';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const sm = surfaceMap(P.form, isV ? fixed : t, isV ? t : fixed, P, null);
      const pr = pj(sm.x, sm.y, sm.z);
      p += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
    }
    return p + ' ';
  };
  const isoGrid = (n, steps = 48) => {
    let s = '';
    for (let i = 1; i < n; i++) {
      const f = i / n;
      s += trace(f, false, steps);
      s += trace(f, true, steps);
    }
    return s;
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
    case 'paraboloid': {
      d += ellipse(0, r);           // rim
      d += ellipse(-h * 0.25, 0);   // apex (dot — just a point)
      for (let q = 0; q < 4; q++) {
        const a = (q / 4) * 2 * Math.PI;
        let pp = '';
        for (let i = 0; i <= 24; i++) {
          const rv = i / 24;
          const pr = pj(r * rv * Math.cos(a), rv * rv * h * 0.55 - h * 0.25, r * rv * Math.sin(a));
          pp += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
        }
        d += pp + ' ';
      }
      break;
    }
    case 'hyperboloid': {
      const kh = Math.max(0.5, P.aspect) * 2.2;
      d += ellipse(-h / 2, r * 0.45 * Math.cosh(kh * 0.5)); // top ring
      d += ellipse(0, r * 0.45);                              // waist
      d += ellipse(h / 2, r * 0.45 * Math.cosh(kh * 0.5));  // bottom ring
      for (let q = 0; q < 4; q++) {
        const a = (q / 4) * 2 * Math.PI;
        let ph = '';
        for (let i = 0; i <= 32; i++) {
          const vv = i / 32;
          const ch = Math.cosh((vv - 0.5) * kh);
          const pr = pj(r * 0.45 * ch * Math.cos(a), (vv - 0.5) * h, r * 0.45 * ch * Math.sin(a));
          ph += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
        }
        d += ph + ' ';
      }
      break;
    }
    case 'ellipsoid': {
      d += ellipse(0, r);          // equatorial ring
      // Meridional ellipse (y-major)
      let pm = '';
      for (let i = 0; i <= 48; i++) {
        const lat = (i / 48 - 0.5) * Math.PI;
        const pr = pj(r * Math.cos(lat), r * P.aspect * Math.sin(lat), 0);
        pm += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
      }
      d += pm + ' ';
      let pm2 = '';
      for (let i = 0; i <= 48; i++) {
        const lat = (i / 48 - 0.5) * Math.PI;
        const pr = pj(0, r * P.aspect * Math.sin(lat), r * Math.cos(lat));
        pm2 += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
      }
      d += pm2 + ' ';
      break;
    }
    case 'spring': {
      const turns_s = Math.max(1, P.turns);
      const HR = r * 0.65;
      let ps = '';
      const steps = turns_s * 40;
      for (let i = 0; i <= steps; i++) {
        const vv = i / steps;
        const theta_s = vv * 2 * Math.PI * turns_s;
        const pr = pj(HR * Math.cos(theta_s), (vv - 0.5) * h, HR * Math.sin(theta_s));
        ps += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
      }
      d += ps + ' ';
      break;
    }
    case 'monkey-saddle': {
      const msx = S / 2, msz = (S * P.aspect) / 2;
      // 3 parabola arms
      for (let arm = 0; arm < 3; arm++) {
        const ang_ms = (arm / 3) * 2 * Math.PI;
        let pa = '';
        for (let i = 0; i <= 24; i++) {
          const t = (i / 24 - 0.5);
          const ux2 = t * Math.cos(ang_ms) * 0.5;
          const vz2 = t * Math.sin(ang_ms) * 0.5 / P.aspect;
          const pr = pj(ux2 * S, (ux2 * ux2 * ux2 - 3 * ux2 * vz2 * vz2) * r * 1.6, vz2 * S * P.aspect);
          pa += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
        }
        d += pa + ' ';
      }
      d += seg(-msx, 0, -msz, msx, 0, -msz);
      d += seg(msx, 0, -msz, msx, 0, msz);
      d += seg(msx, 0, msz, -msx, 0, msz);
      d += seg(-msx, 0, msz, -msx, 0, -msz);
      break;
    }
    case 'shell': {
      const turns_sh = Math.max(1, P.turns);
      let psh = '';
      const steps_sh = turns_sh * 40;
      for (let i = 0; i <= steps_sh; i++) {
        const vv = i / steps_sh;
        const sweep = vv * 2 * Math.PI * turns_sh;
        const Rc = r * 0.25 * Math.exp(vv * 2.0);
        const pr = pj(Rc * Math.cos(sweep), (0.5 - vv) * h * 0.5, Rc * Math.sin(sweep));
        psh += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
      }
      d += psh + ' ';
      break;
    }
    case 'catenoid': {
      const kc = Math.max(0.5, 3 / P.aspect);
      const rW = r / Math.cosh(kc * 0.5);
      d += ellipse(-h / 2, rW * Math.cosh(kc * 0.5)); // top
      d += ellipse(0, rW);                              // waist
      d += ellipse(h / 2, rW * Math.cosh(kc * 0.5));  // bottom
      for (let q = 0; q < 4; q++) {
        const a = (q / 4) * 2 * Math.PI;
        let pc = '';
        for (let i = 0; i <= 32; i++) {
          const vv = i / 32;
          const ch = Math.cosh((vv - 0.5) * kc);
          const pr = pj(rW * ch * Math.cos(a), (vv - 0.5) * h, rW * ch * Math.sin(a));
          pc += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
        }
        d += pc + ' ';
      }
      break;
    }
    case 'superquadric': {
      const expG = 2 / Math.max(0.25, Math.min(8, P.facets));
      const sgnG = (val) => (val >= 0 ? 1 : -1);
      const spG = (val, e) => sgnG(val) * Math.abs(val) ** e;
      // 3 cross-section rings
      for (let ci = 0; ci < 3; ci++) {
        const latG = (ci / 2 - 0.5) * Math.PI * 0.8;
        let pg = '';
        for (let i = 0; i <= 48; i++) {
          const lonG = (i / 48) * 2 * Math.PI;
          const pr = pj(
            r * spG(Math.cos(lonG), expG) * spG(Math.cos(latG), expG),
            r * P.aspect * spG(Math.sin(latG), expG),
            r * spG(Math.sin(lonG), expG) * spG(Math.cos(latG), expG),
          );
          pg += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
        }
        d += pg + ' ';
      }
      break;
    }
    case 'dini': {
      const a_d = r * 0.42;
      const twist_d = Math.max(0.05, P.aspect) * 3;
      const turns_d = Math.max(1, P.turns);
      let pd = '';
      for (let i = 0; i <= 120; i++) {
        const vv = i / 120;
        const phi_d = vv * Math.PI * 0.82 + 0.09;
        const theta_d = (i / 120) * 2 * Math.PI * turns_d + twist_d * vv;
        const pr = pj(
          a_d * Math.sin(phi_d) * Math.cos(theta_d),
          a_d * (Math.cos(phi_d) + Math.log(Math.tan(phi_d / 2))),
          a_d * Math.sin(phi_d) * Math.sin(theta_d),
        );
        pd += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
      }
      d += pd + ' ';
      break;
    }
    case 'trifolium': {
      // Top and bottom trifolium outlines + axis.
      for (const yOff of [-h / 2, h / 2]) {
        let pt3 = '';
        for (let i = 0; i <= 96; i++) {
          const theta3 = (i / 96) * 2 * Math.PI;
          const rho3 = r * 0.6 * Math.max(0, 1 + Math.cos(3 * theta3)) * 0.5;
          const pr = pj(rho3 * Math.cos(theta3), yOff, rho3 * Math.sin(theta3));
          pt3 += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
        }
        d += pt3 + ' ';
      }
      d += seg(0, -h / 2, 0, 0, h / 2, 0); // axis
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
    case 'enneper':
    case 'pseudosphere':
    case 'roman-surface':
    case 'boy-surface':
    case 'superformula':
    case 'cardioid-rev':
    case 'lemniscate-rev':
    case 'dupin-cyclide':
    case 'gyroid':
    case 'scherk':
    case 'riemann-minimal':
    case 'swallowtail':
    case 'klein-bottle': {
      d += isoGrid(4, 48);
      break;
    }
    case 'knot-35': {
      const k35R = r * 0.56, k35r2 = r * 0.24;
      let pk35 = '';
      for (let i = 0; i <= 180; i++) {
        const t = (i / 180) * 2 * Math.PI;
        const pr = pj(
          (k35R + k35r2 * Math.cos(5 * t)) * Math.cos(3 * t),
          k35r2 * Math.sin(5 * t),
          (k35R + k35r2 * Math.cos(5 * t)) * Math.sin(3 * t),
        );
        pk35 += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
      }
      d += pk35 + ' ';
      break;
    }
    case 'knot-27': {
      const k27R = r * 0.56, k27r2 = r * 0.22;
      let pk27 = '';
      for (let i = 0; i <= 200; i++) {
        const t = (i / 200) * 2 * Math.PI;
        const pr = pj(
          (k27R + k27r2 * Math.cos(7 * t)) * Math.cos(2 * t),
          k27r2 * Math.sin(7 * t),
          (k27R + k27r2 * Math.cos(7 * t)) * Math.sin(2 * t),
        );
        pk27 += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
      }
      d += pk27 + ' ';
      break;
    }
    case 'lissajous-3d': {
      const la = Math.max(1, Math.round(P.facets));
      const lb = Math.max(1, Math.round(P.turns));
      const lc = Math.max(1, Math.round(P.aspect * 2 + 1));
      const lR = r * 0.65;
      const liSteps = Math.min(480, la * lb * lc * 30);
      let pli = '';
      for (let i = 0; i <= liSteps; i++) {
        const t = (i / liSteps) * 2 * Math.PI;
        const pr = pj(lR * Math.cos(la * t + 0.4), lR * Math.sin(lb * t), lR * Math.cos(lc * t + 0.7));
        pli += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
      }
      d += pli + ' ';
      break;
    }
    case 'helicoid': {
      const hTurns = Math.max(1, P.turns);
      for (let side = -1; side <= 1; side += 2) {
        let ph = '';
        for (let i = 0; i <= 96; i++) {
          const u2 = i / 96;
          const ang = u2 * 2 * Math.PI * hTurns;
          const pr = pj(side * r * Math.cos(ang), (u2 - 0.5) * h, side * r * Math.sin(ang));
          ph += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
        }
        d += ph + ' ';
      }
      d += seg(0, -h / 2, 0, 0, h / 2, 0);
      break;
    }
    case 'hyperboloid-2': {
      const kA2 = Math.max(0.5, P.aspect) * 1.8;
      const rH = r * 0.42;
      for (let sheet = -1; sheet <= 1; sheet += 2) {
        d += ellipse(rH * sheet, rH * Math.sinh(kA2));
        for (let q = 0; q < 4; q++) {
          const ang = (q / 4) * 2 * Math.PI;
          let ph = '';
          for (let i = 0; i <= 32; i++) {
            const t2 = (i / 32) * kA2;
            const pr = pj(rH * Math.sinh(t2) * Math.cos(ang), rH * Math.cosh(t2) * sheet, rH * Math.sinh(t2) * Math.sin(ang));
            ph += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
          }
          d += ph + ' ';
        }
      }
      break;
    }
    case 'oloid': {
      const olD = r * 0.5, olRc = r * 0.55;
      let pc1 = '', pc2 = '';
      for (let i = 0; i <= 48; i++) {
        const t = (i / 48) * 2 * Math.PI;
        const p1 = pj(olD + olRc * Math.cos(t), 0, olRc * Math.sin(t));
        pc1 += (i === 0 ? 'M' : 'L') + p1.X.toFixed(2) + ' ' + p1.Y.toFixed(2);
        const p2 = pj(-olD + olRc * Math.cos(t), olRc * Math.sin(t), 0);
        pc2 += (i === 0 ? 'M' : 'L') + p2.X.toFixed(2) + ' ' + p2.Y.toFixed(2);
      }
      d += pc1 + ' ' + pc2 + ' ';
      break;
    }
    case 'seifert': {
      const sfSc2 = r * 0.135;
      let ps = '';
      for (let i = 0; i <= 120; i++) {
        const t = (i / 120) * 2 * Math.PI;
        const pr = pj(
          (Math.sin(t) + 2 * Math.sin(2 * t)) * sfSc2,
          (Math.cos(t) - 2 * Math.cos(2 * t)) * sfSc2,
          -Math.sin(3 * t) * sfSc2,
        );
        ps += (i === 0 ? 'M' : 'L') + pr.X.toFixed(2) + ' ' + pr.Y.toFixed(2);
      }
      d += ps + ' ';
      d += trace(0.2, false, 32) + trace(0.5, false, 32) + trace(0.8, false, 32);
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
      blinkMode: params.blinkMode || 'none',
      blinkRate: typeof params.blinkRate === 'number' ? params.blinkRate : 2,
      blinkFade: typeof params.blinkFade === 'number' ? params.blinkFade : (params.blinkFade ? 1 : 0),
      accentMode: params.accentMode || 'none',
      accentColors: [
        textColor,
        params.accentColor  || textColor,
        params.accentColor2 || params.accentColor || textColor,
        params.accentColor3 || params.accentColor || textColor,
        params.accentColor4 || params.accentColor || textColor,
      ],
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
        accentT: g.accentT || 0,
        blinkT: g.blinkT || 0,
        extraOp: g.extraOp !== undefined ? g.extraOp : 1,
        skew: g.skew || 0,
        sizeMul: g.sizeMul !== undefined ? g.sizeMul : 1,
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
        accentT: g.accentT || 0,
        blinkT: g.blinkT || 0,
        extraOp: g.extraOp !== undefined ? g.extraOp : 1,
        skew: g.skew || 0,
        sizeMul: g.sizeMul !== undefined ? g.sizeMul : 1,
      });
    }
  }

  return {
    mode: '3d',
    bgColor, textColor, fontSize, fontSpec, width, height,
    glyphs,
    guides: P.guides ? buildGuidesData(ctx) : '',
    guideMeta: P.guideMeta,
    guideMetaData: P.guideMeta ? {
      formSize: Math.round(P.formSize),
      angleX: P.angleX,
      angleY: P.angleY,
      speed3d: typeof params.speed3d === 'number' ? params.speed3d : 0,
      fps: P.fps,
    } : null,
    blinkMode: params.blinkMode || 'none',
    blinkRate: typeof params.blinkRate === 'number' ? params.blinkRate : 2,
    blinkFade: typeof params.blinkFade === 'number' ? params.blinkFade : (params.blinkFade ? 1 : 0),
    accentMode: params.accentMode || 'none',
    accentColors: [
      textColor,
      params.accentColor  || textColor,
      params.accentColor2 || params.accentColor || textColor,
      params.accentColor3 || params.accentColor || textColor,
      params.accentColor4 || params.accentColor || textColor,
    ],
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
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const fs2d = scene.fontSpec;
    const hasAccent = true;
    const blinkHalfMs2d = scene.blinkRate > 0 ? (500 / scene.blinkRate) : 500;
    const blinkActive2d = scene.blinkFade === 0 && scene.blinkMode !== 'none' && Math.floor(performance.now() / blinkHalfMs2d) % 2 === 0;
    const _cos2d = (Math.cos(performance.now() / (blinkHalfMs2d * 2) * Math.PI * 2) + 1) / 2;
    const blinkFadeFactor2d = scene.blinkFade > 0 && scene.blinkMode !== 'none'
      ? 1 - scene.blinkFade * (1 - _cos2d) : 1;
    let lastFs2d = -1;

    for (const line of scene.lines) {
      for (const c of line.chars) {
        if (c.blinkT && blinkActive2d) continue;
        const rawOp = c.extraOp !== undefined ? c.extraOp : 1;
        const extraOp = (c.blinkT && scene.blinkFade > 0) ? rawOp * blinkFadeFactor2d : rawOp;
        const sizeMul = c.sizeMul !== undefined ? c.sizeMul : 1;
        const skew = c.skew || 0;

        ctx.globalAlpha = extraOp;
        ctx.fillStyle = (hasAccent && c.accentT) ? scene.accentColors[c.accentT] : scene.textColor;

        const fs = scene.fontSize * sizeMul;
        if (fs !== lastFs2d) {
          ctx.font = `${fs2d.weight} ${fs}px ${fs2d.family}`;
          lastFs2d = fs;
        }

        if (skew !== 0) {
          ctx.setTransform(d, 0, d * skew * 0.3, d, d * c.x, d * c.y);
          ctx.fillText(c.ch, 0, 0);
          ctx.setTransform(d, 0, 0, d, 0, 0);
        } else {
          ctx.fillText(c.ch, c.x, c.y);
        }
      }
    }
    ctx.globalAlpha = 1;

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
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const fs3d = scene.fontSpec;
  const hasAccent3d = true;
  const blinkHalfMs3d = scene.blinkRate > 0 ? (500 / scene.blinkRate) : 500;
  const blinkActive3d = scene.blinkFade === 0 && scene.blinkMode !== 'none' && Math.floor(performance.now() / blinkHalfMs3d) % 2 === 0;
  const _cos3d = (Math.cos(performance.now() / (blinkHalfMs3d * 2) * Math.PI * 2) + 1) / 2;
  const blinkFadeFactor3d = scene.blinkFade > 0 && scene.blinkMode !== 'none'
    ? 1 - scene.blinkFade * (1 - _cos3d) : 1;
  let lastFs = null;
  for (const g of scene.glyphs) {
    if (g.blinkT && blinkActive3d) continue;
    const baseOp = (g.blinkT && scene.blinkFade > 0) ? g.opacity * blinkFadeFactor3d : g.opacity;
    ctx.globalAlpha = baseOp * (g.extraOp !== undefined ? g.extraOp : 1);
    ctx.fillStyle = (hasAccent3d && g.accentT) ? scene.accentColors[g.accentT] : scene.textColor;
    const sm = g.sizeMul !== undefined ? g.sizeMul : 1;
    if (g.matrix) {
      const m = g.matrix;
      // Scale matrix components by sizeMul for per-char size variation.
      ctx.setTransform(d * m.a * sm, d * m.b * sm, d * m.c * sm, d * m.d * sm, d * m.e, d * m.f);
      if (scene.fontSize !== lastFs) {
        ctx.font = `${fs3d.weight} ${scene.fontSize}px ${fs3d.family}`;
        lastFs = scene.fontSize;
      }
      ctx.fillText(g.ch, 0, 0);
    } else {
      // Billboard: translate (+ optional mirror + skew) and scale font.
      const sk = g.skew || 0;
      ctx.setTransform(
        d * (g.mirrored ? -1 : 1), 0, d * sk * 0.3, d, d * g.X, d * g.Y,
      );
      // Billboard font size varies per glyph; apply sizeMul on top.
      const fs = g.fontSize * sm;
      ctx.font = `${fs3d.weight} ${fs}px ${fs3d.family}`;
      lastFs = fs;
      ctx.fillText(g.ch, 0, 0);
    }
  }
  ctx.globalAlpha = 1;

  if (scene.guideMeta && scene.guideMetaData) {
    const md = scene.guideMetaData;
    const fs = scene.fontSpec;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = scene.textColor;
    ctx.globalAlpha = 0.55;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = fs.weight + ' 9px ' + fs.family;
    const rows = [
      'SIZE ' + md.formSize,
      'AX ' + md.angleX.toFixed(1) + '  AY ' + md.angleY.toFixed(1),
      'SPD ' + md.speed3d.toFixed(2),
      'FPS ' + Math.round(md.fps),
    ];
    const lh = 11;
    rows.forEach((row, i) => ctx.fillText(row, 10, height - 10 - (rows.length - 1 - i) * lh));
    ctx.globalAlpha = 1;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
