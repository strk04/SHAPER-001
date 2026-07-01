export const CREATIVE_PRESET_EXTRA_KEYS = Object.freeze([
  'text', 'font',
  'textColor', 'bgColor', 'guideColor', 'guideMetaColor', 'surfaceColor',
  'surfaceOcclusion', 'hardWrap',
  'seed',
  'mode', 'form', 'projection',
  'guides', 'guideMeta', 'guideLayer',
  'backfaceMirror', 'surfaceText',
  'vNorm', 'wrapMode',
  'canvasW', 'canvasH',
  'cameraEnabled',
  'opacityMode', 'blinkMode', 'blinkFade', 'sizeMode',
  'accentMode', 'accentMode2', 'accentMode3', 'accentMode4',
  'accentColor', 'accentColor2', 'accentColor3', 'accentColor4',
  'morphForm', 'morphForm2', 'morphForm3', 'morphAuto',
  'customOutline',
  'grid2d',
]);

export const EPHEMERAL_PRESET_KEYS = Object.freeze([
  'fps',
  't',
  'morphClock',
]);

function clonePresetValue(value) {
  if (value == null || typeof value !== 'object') return value;
  return structuredClone(value);
}

export function captureCreativePreset(state, sliderKeys = []) {
  const snap = { v: 1 };
  const keys = new Set([...sliderKeys, ...CREATIVE_PRESET_EXTRA_KEYS]);
  for (const key of keys) {
    if (EPHEMERAL_PRESET_KEYS.includes(key)) continue;
    if (state[key] !== undefined) snap[key] = clonePresetValue(state[key]);
  }
  return snap;
}
