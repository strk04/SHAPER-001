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
