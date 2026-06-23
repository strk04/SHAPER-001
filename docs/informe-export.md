# Sistema d'exportació — Informe tècnic

**Projecte:** SHAPER 001  
**Data:** 2026-06-23  
**Fitxers implicats:** `main.js` (funcions `saveSVG`, `savePNG`, `startRecord`, `stopRecord`, `captureFrame`), `export-video.js`, `engine.js` (`buildSVG`, `buildScene`, `drawScene`)

---

## 1. Visió general

L'app ofereix tres formats d'exportació des del panell **Export**:

| Format | Funció | Resolució |
|--------|--------|-----------|
| SVG | `saveSVG()` | Vector pur (mida lògica del canvas) |
| PNG | `savePNG(dpi)` | Raster offscreen, 72 / 150 / 300 dpi |
| MP4 | `startRecord()` / `stopRecord()` | `canvasW × canvasH`, 30 o 60 fps |

Totes les exportacions fan servir `resolveRenderState(state.directorTime)` per capturar l'estat exacte en el moment de l'exportació (amb les sobreescritures del Director aplicades).

---

## 2. Format del canvas

Cada exportació parteix de la mida lògica definida per l'usuari:

- **`state.canvasW` / `state.canvasH`**: mida en píxels lògics (default 1350×1080).
- **`displayCanvas`**: backing store del preview = `canvasW × displayDpr` (DPR màxim 2). Només per a renderització en pantalla.
- Les exportacions no depenen del `displayCanvas` per a SVG ni PNG — generen el seu propi output a la resolució correcta.

### Presets de format

Accessibles via `#format-select`:

| Opció | Mida (px) | Ús típic |
|-------|-----------|----------|
| 9:16 | 1080 × 1920 | Stories / Reels |
| 16:9 | 1920 × 1080 | Pantalla / YouTube |
| 1:1 | 1080 × 1080 | Post quadrat |
| 4:5 (default) | 1080 × 1350 | Post vertical |
| 5:4 | 1350 × 1080 | Post apaïsat |
| A4 vertical | 1485 × 2100 | Impremta |
| A4 apaïsat | 2100 × 1485 | Impremta |
| Personalitzat | lliure | px o cm amb DPI |

En mode **cm**, l'app converteix a píxels en aplicar: `px = cm × (dpi / 2.54)`.

---

## 3. Export SVG

```js
function saveSVG() {
  const exportState = resolveRenderState(state.directorTime);
  const svg = buildSVG(exportState, width, height);   // engine.js
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  // → download shaper-{seed}.svg
}
```

- **`buildSVG`** genera markup SVG complet des de l'estat (mateixa lògica que `buildScene` però en format vectorial).
- Resultat: fitxer `.svg` editble, infinitament escalable.
- Filename: `shaper-{seed}.svg`
- Captura el frame actual del Director (temps de reproducció congelat).

---

## 4. Export PNG

```js
function savePNG(dpi) {
  const scale = dpi / 72;
  const w = Math.round(state.canvasW * scale);
  const h = Math.round(state.canvasH * scale);

  const oc = document.createElement('canvas');   // canvas offscreen
  oc.width = w;  oc.height = h;
  const octx = oc.getContext('2d');

  const exportState = resolveRenderState(state.directorTime);
  const scene = buildScene(exportState, w, h);
  drawScene(octx, scene, w, h, 1);   // DPR=1 explícit

  oc.toBlob(blob => { /* → download shaper-{dpi}dpi-{seed}.png */ }, 'image/png');
}
```

### Escala de resolució per DPI

| DPI | Factor | Exemple (1080×1350) |
|-----|--------|---------------------|
| 72 | ×1 | 1080 × 1350 px |
| 150 | ×2.08 | 2250 × 2813 px |
| 300 | ×4.17 | 4500 × 5625 px |

- Usa un **canvas offscreen separat** (no el `displayCanvas`), per tant la resolució final no depèn del DPR de la pantalla.
- `DPR = 1` forçat a `drawScene` perquè el factor d'escala ja és el `dpi/72`.
- Filename: `shaper-{dpi}dpi-{seed}.png`

---

## 5. Export MP4 (vídeo)

### Requisit de navegador

Usa la **WebCodecs API** (`VideoEncoder`, `VideoFrame`) → **Chrome i Edge únics**. Firefox no suportat; si `typeof VideoEncoder === 'undefined'`, es mostra error i s'avorta.

### Pipeline tècnic

```
displayCanvas
  → VideoFrame(canvas, { timestamp })
      → VideoEncoder (H.264 / avc1.640033)
          → mp4-muxer (ArrayBufferTarget)
              → Blob video/mp4
                  → descàrrega shaper-{seed}.mp4
```

### Configuració del encoder

```js
recState.videoEncoder.configure({
  codec: 'avc1.640033',   // H.264 High Profile Level 5.1
  width: state.canvasW,
  height: state.canvasH,
  bitrate: 8_000_000,     // 8 Mbps
  framerate: fps,         // 30 o 60
  latencyMode: 'quality',
  hardwareAcceleration: 'prefer-hardware',
});
```

### Muxer

```js
new Muxer({
  target: new ArrayBufferTarget(),   // tot en memòria (no streaming)
  video: { codec: 'avc', width, height },
  fastStart: 'in-memory',            // moov atom al capdavant → reproducció immediata
});
```

El fitxer sencer queda a RAM fins que s'acaba la gravació; llavors es materialitza com a Blob.

### Timestamps i keyframes

- Timestamp per frame (en microsegons): `Math.round(frameIndex * (1_000_000 / fps))`
- Keyframe cada 2 s: `frameIndex % (fps * 2) === 0`

---

## 6. Dos modes de gravació de vídeo

### Mode A — Director actiu (renderització offline)

Si `state.director.enabled`:

```
pause()
→ encodeDirectorFrames({ duration, fps, renderAt, encodeCanvas })
    → directorFrameTimes(duration, fps)  // timestamps exactes 0..duration
    → per cada timestamp:
        renderAt(time)      // render del frame al displayCanvas
        encodeCanvas(index) // VideoFrame → VideoEncoder
        yield cada 8 frames (requestAnimationFrame) // no bloqueja UI
→ stopRecord()
→ restaura directorTime = 0, reprèn playback si estava en marxa
```

**`directorFrameTimes`** (export-video.js):
```js
Array.from({ length: Math.round(duration * fps) }, (_, i) => i / fps)
```
Timestamps exactes equidistants (cap deriva d'acumulació).

La durada total = `totalDuration(state.director)` (suma de totes les escenes).

### Mode B — Playback en viu (Director desactivat)

Grava en temps real dins el loop d'animació (`frame(ts)`):

```js
recState._accumTime += dt;
const interval = 1 / fps;
while (recState._accumTime >= interval) {
  captureFrame();          // VideoFrame del displayCanvas
  recState._accumTime -= interval;
}
```

L'acumulador (`_accumTime`) assegura la taxa de frames exacta fins i tot si el rAF arriba amb irregularitats.

**Parada:**
- **Manual**: l'usuari clica "Atura gravació"
- **Automàtica**: si s'ha seleccionat durada fixa → `frameN >= loopTotal`

---

## 7. Flux complet de gravació (Mode B, cas típic)

```
Usuari clica "Grava MP4"
  → startRecord()
      → crea Muxer + VideoEncoder
      → recState.isRecording = true
      → si !playing → play()
  
  Loop d'animació (frame per frame):
      → captureFrame() → VideoFrame → VideoEncoder.encode()
      → cada segon: actualitza #exportStatus amb temps transcorregut
  
Usuari clica "Atura" (o durada esgotada)
  → stopRecord()
      → VideoEncoder.flush()   // buida la cua de codificació
      → muxer.finalize()       // tanca el contenidor MP4
      → Blob → URL.createObjectURL → <a>.click() → download
      → URL.revokeObjectURL (1 s de delay)
      → neteja recState (encoder, muxer, frameN...)
      → restaura UI (botó, FPS select, duration select)
```

---

## 8. Relació entre resolució del canvas i vídeo

L'MP4 captura el **`displayCanvas`** directament (no un canvas offscreen):
- Resolució del vídeo = `canvasW × canvasH` (la mida lògica, sense DPR).
- Si el preview fa servir DPR=2 internament, el `displayCanvas.width` és `canvasW*2`, però el backing store física queda escalat cap avall al codec perquè `VideoEncoder.configure` rep `canvasW/canvasH`.

> **Nota:** Per obtenir vídeo a més resolució que la mida lògica del canvas caldria crear un canvas offscreen i renderitzar-hi; ara per ara el vídeo queda limitat a `canvasW × canvasH`.

---

## 9. Fitxers de descàrrega i noms

| Export | Filename | Notes |
|--------|----------|-------|
| SVG | `shaper-{seed}.svg` | seed = valor actual de `state.seed` |
| PNG 72 dpi | `shaper-72dpi-{seed}.png` | |
| PNG 150 dpi | `shaper-150dpi-{seed}.png` | |
| PNG 300 dpi | `shaper-300dpi-{seed}.png` | |
| MP4 | `shaper-{seed}.mp4` | |

La seed és estàtica en el moment d'exportació (no s'actualitza durant la gravació).

---

## 10. Limitacions conegudes

| Aspecte | Detall |
|---------|--------|
| Compatibilitat MP4 | Chrome / Edge only (WebCodecs). Firefox no suportat. |
| Memòria MP4 | Tot el vídeo queda a RAM fins al final. Gravacions llargues (>30 s a alta res) poden exhaurir la memòria disponible. |
| Resolució MP4 | Limitada a `canvasW × canvasH` (no DPR × escala). |
| SVG i Director | Captura un sol frame (el moment actual); no exporta seqüències SVG. |
| `toBlob` asíncrona | `savePNG` llança la descàrrega de forma asíncrona; si es crida ràpid múltiples vegades es poden encreuar. |
| Fonts custom | L'export PNG/MP4 pot no incloure fonts si no estan carregades al `document` en el moment de la captura. |
