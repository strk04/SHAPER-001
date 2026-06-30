export function directorFrameTimes(duration, fps) {
  if (!(duration > 0) || !(fps > 0)) return [];
  const count = Math.max(1, Math.round(duration * fps));
  return Array.from({ length: count }, (_, index) => index / fps);
}

export function resolveOfflineAnimationState(baseState, elapsed, fps) {
  const t0 = Number.isFinite(baseState?.t) ? baseState.t : 0;
  const morphClock0 = Number.isFinite(baseState?.morphClock) ? baseState.morphClock : 0;
  const speed = Number.isFinite(baseState?.speed3d) ? baseState.speed3d : 0;
  const time = Number.isFinite(elapsed) ? elapsed : 0;
  return {
    ...baseState,
    t: t0 + time * speed,
    morphClock: morphClock0 + time,
    directorTime: time,
    fps: Number.isFinite(fps) ? fps : baseState?.fps,
  };
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
