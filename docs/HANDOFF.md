# HANDOFF — SHAPER 001

_Actualitzat: 2026-06-20_

## Estat actual

**Motion Director implementat** a la branca `feat/motion-director` (10 tasques del pla, TDD, subagent-driven). Tota la capa automàtica és verda: **26 tests** (`node --test tests/*.test.mjs`), `node --check` net als 6 mòduls, `git diff --check` net. Re-review d'accessibilitat sobre els fitxers reals: **SHIP** (tots els criteris Critical+Major WCAG 2.2 AA PASS, ràtios de contrast verificats). Encara **NO** fusionat a `main`, **NO** copiat a Pixel Perfect, **NO** push.

## Següent pas immediat

1. **Verificació visual al navegador (gate manual pendent)** — únic bloqueig abans de merge. Servir amb `php -S localhost:8080` i recórrer el checklist de Task 10 Step 2-3 del pla: arrencada amb Director OFF idèntica, crear 3 escenes, scrub als límits exactes (sense frame blanc ni salt de seed), reverse/loop, 4 comportaments en 2D i 3D, cohesió 0/0.5/1, REC d'un pad → keyframes editables, round-trip de preset, preset antic → Director OFF, export 30 fps comparat amb preview, FPS amb Director OFF abans/després (≤5% regressió), navegació només-teclat + focus visible + live region. Smoke test ja fet: index 200, els 4 blocs de markup presents, 6 mòduls 200.
2. Si tot OK: merge a `main`, copiar fitxers a `02 Pixel Perfect/shaper/`, push PP001 (només quan l'usuari ho demani explícitament).

## Fitxers nous (branca)

- `director.js` — esquema, normalització, avaluador temporal, escenes/keyframes immutables, `simplifySamples`.
- `motion.js` — 4 camps de moviment deterministes (deriva/òrbita/atracció/explosió) + cohesió + `centroidOf`/`applyMotionToLines`.
- `director-ui.js` — `directorViewModel`, `mountDirectorUI` (inspector + timeline radiogroup), `mountLivePads` (press-and-hold accessible).
- `export-video.js` — `directorFrameTimes` + `encodeDirectorFrames` (export offline frame-exact).
- `tests/` — director, motion, director-ui, export-video, project-wiring (5 fitxers).

## Fitxers modificats

- `engine.js` — import de `motion.js`; offsets aplicats a 2D (`applyMotionToLines`) i 3D (segona passada amb `finalizeGlyph`/`pendingGlyphs`); blink determinista via `clockMs`. Fast path idèntic quan `motionBehaviors=[]`.
- `main.js` — estat del Director, `resolveRenderState` (snapshot per temps absolut), rellotge en segons reals dins `frame()`, muntatge UI, edició d'escenes, pads en viu, gravació, presets versionats (`snap.director`/`normalizeDirector(p.director)`), export offline + SVG/PNG del frame resolt.
- `index.html`, `styles.css` — panell/dock/timeline/pads del Director, token `--rule-on-dark: #8a8a8a`, focus rings dock-scoped.

## Decisions clau

- Director desactivat = byte-idèntic al render anterior (verificat: `resolveRenderState` retorna el mateix `state`; fast path sense rolls PRNG reordenats).
- Rellotge del Director en segons reals absoluts; no substitueix `state.t`/`state.morphClock` a l'estat base, només al snapshot de render → tot navegable i exportable frame-exact.
- Escenes com a `role="radiogroup"`/`radio` (no list), pads press-and-hold amb force-release (element blur + window blur), `<output aria-live="off">`, `announce()` només en esdeveniments discrets.

## Riscos i pendents

- ~~Gap ◇ keyframe de comportament amb `value: 0`~~ — **resolt** (`main.js` `onAddKeyframe` ara llegeix el valor real del camp del comportament/param a l'escena).
- Re-review a11y va flaguejar 2 Minor: (1) focus-ring de `.automation-key-button` — **descartat com a fals positiu** (el botó viu a la sidebar clara, no al dock fosc; l'ordre actual paper/ink és correcte); (2) `aria-controls` del Collapse apunta a `#directorTimeline` però col·lapsa tot el dock — cosmètic, no bloqueja.
- Pendents previs encara oberts: validació visual formes 3D/`noiseTexture`; revisió contrast `--rule: #9d9d9d`.
- `main` local té commits documentals previs (`7e5c9cc`...) sense push.

## Verificació ràpida

```bash
cd "17 SHAPER 001"
node --test tests/*.test.mjs          # 26 pass
for f in main engine director motion director-ui export-video; do node --check $f.js; done
git diff --check
```
