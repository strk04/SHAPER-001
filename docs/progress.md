# Progress — SHAPER 001

## 2026-06-17 (sessió 6) — Color d'accent per caràcter + eliminació gradient

### Fet
- **`accentMode`** (select: none/seeded/alternating-word/first-letter) + **`accentProb`** + **`accentEvery`**: color puntual per caràcter via `randAtom`. Tres modes implementats.
- **`accentColor`**: color picker al panel Colors.
- **Fix 3D accent**: `accentT` propagat per `build3D` → `buildScene` → `drawScene` 3D. Sense el fix, el color d'accent no tenia efecte visual en mode 3D (era el bug principal de la sessió).
- **Charmap → Àtom**: click als botons del mapa ara actualitza `state.text` + textarea directament.
- **Eliminació gradient de color**: `colorRamp`, `colorRampTo`, `lerpHex`, `parseHexColor` eliminats de `engine.js`, `main.js`, `index.html`. Cap referència resta al codi viu.
- Sync `02 Pixel Perfect/shaper/` ✓

### Pendent
- Commit pendent (acumulats des de sessió 3–4–5–6).
- Validació navegador.

---

## 2026-06-17 (sessió 5) — 6 paràmetres àtom: charOpacity, charSkew, sizeRamp, densityMap, maskShape

### Fet
- **`charOpacity`** [0–1]: opacitat aleatòria per caràcter via `randAtom` (PRNG separat de `rand`, seed `seed ^ 0x9e3779b9`).
- **`charSkew`** [0–1]: inclinació aleatòria per caràcter via `ctx.setTransform` (shear × 0.3).
- **`sizeRamp`** [−1–1]: rampa de mida per posició X; `sizeMul = 1 + sizeRamp*(xNorm*2−1)`.
- **`densityMap`** [0–1]: `dropProb` augmenta linealment cap a la dreta `(dropProb + densityMap * xNorm)`.
- **`maskShape`** (select: none/circle/diamond/ellipse-h/ellipse-v/triangle) + **`maskRadius`** [0.1–1]: clip canvas; funciona a 2D i 3D (guideMeta fora del clip).
- Fix `flow` i `cascade`: ara copien tots els atributs del caràcter (`{ ...c, x: px }`).
- Sync `02 Pixel Perfect/shaper/` ✓

### Pendent
- Commit pendent (acumulats des de sessió 3–4–5).
- Validació navegador.

---

## 2026-06-15 (sessió 4) — noiseTexture, paramSpeed, Character Map, fork 002

### Fet
- `paramSpeed` (Easing paramètric): warp sinusoïdal `t01 - K·sin(4·2π·t01)`. Fix respecte a la primera impl (blend ArcLUT/raw-u no tenia efecte per formes circulars).
- `noiseTexture` (Buits de textura): domain warp UV via fBm. str=0.7 (exagerat a petició). Dues impls anteriors rebutjades (dropout, opacitat) — solució: desplaçament físic de posició.
- Fix race condition `stopRecord()`: guard `_stopping`, prevents doble `finalize()`.
- UI: 2D `disabled`, `vNorm` eliminat, canvas size del footer eliminat.
- Panel "Mapa de caràcters": 23 blocs Unicode, font selector, cerca, copy+live region, lazy build.
- Fork `18 SHAPER 002` independent (git reinicialitzat, sense remote) → audioreactivitat.
- Sync `02 Pixel Perfect/shaper/` ✓

### Pendent
- Commit pendent (acumulats des de sessió 3).
- Validació navegador: 10 formes noves + paramSpeed + noiseTexture.

---

## 2026-06-15 — Moviment 2D × 10 + fixes 3D

### Fet
- Auto-play a l'inici respectant `prefers-reduced-motion`.
- `vNorm` toggle: normalització de cobertura-v per cada forma (torus, con, esfera, disc, Möbius).
- Selector `wrapMode` amb 4 modes: Anells (default), Columnes, Espiral, Panell.
- Format fusionat dins Export; canvas es redimensiona en col·lapsar nav.
- Flux horitzontal 2D convertit a loop seamless per tiling.
- 10 nous modes `motion2d`: wave-h, bounce, pendulum, cascade, scatter, vortex, expand, typewriter, noise-walk, stagger.
- Fix `buildScene`: Pla i Ondulat forçats a 2D path incondicionalment → revertit a condició original.
- Fix `typewriter`: blank canvas a T=0 → ara mostra tots els chars si T=0.
- Fix `stagger`: period dinàmic (s'alterava amb fontSize/leading) → ara fixed a 3s, delay basat en y/height.
- Eliminada forma "Conjunt"; "Prisma personalitzat" → "Custom" al final.

### Pendent
- Commit pendent (múltiples canvis: wrapMode, vNorm, motion2d×10, fixes).
- Validació visual al navegador de tots els 10 modes nous.

---

## 2026-06-15 (continuació) — Formes planes fixes

### Fet
- Fix `plane` surfaceMap: eix equivocat (pla XY → pla XZ, `ny=1`).
- Fix `surfaceFlowU` per formes planes: ara és `0` per evitar que els glifs surtin del canvas conforme passa el temps.
- Afectades: Pla, Ondulat, Sella.

---

## 2026-06-15 (sessió 3) — ArcLUT tangent + 10 formes noves

### Fet
- **Option B (rendiment)**: `buildArcLUT` ara retorna `(px) => { u, tangent }`. El loop de glifs usa `rotateDir(m0.tangent)` en lloc d'un segon `surfaceMap+rotate3D+project` — elimina ~50% de la càrrega per glif en mode `surfaceText` amb `rings` i `spiral`.
- **10 formes noves**: paraboloide, hiperboloide, el·lipsoide, molla (spring), sella de mico, nautilus (shell), catenoide, superquàdrica, Dini, trifoli.
- Guies (dashed wireframe) implementades per totes les formes noves.
- HTML: 10 opcions noves al select `#form`.
- `FORM_3D_CONTROLS`: entrades per les 10 noves formes (paràmetres rellevants visibles).
- Sync a `02 Pixel Perfect/shaper/`.

### Pendent
- Validació visual al navegador (totes les formes noves).
- Commit pendent.

---

## 2026-06-13 (vespre) — Layout 3 columnes

### Fet
- Reestructura completa: sidebar → 3 columnes (nav + controls + stage).
- Col 1: ARIA tablist vertical (Àtom / Mode / Format / Colors / Presets + footer Export).
- Col 2: tabpanels — cada secció en el seu panell scrollable.
- Col 3: stage (sense canvis).
- Àtom panel: `Cos` (fontSize) primer, `Velocitat` (speed) just after Tall fix, separadors visuals.
- Mode panel: toggle 2D/3D + contingut condicional 2D/3D dins el panell.
- `charTrack` relabeled `Kerning`; `trackRand` eliminat de la UI (default 0, state manté).
- Canvas draw editors eliminats → SVG file import (perfil 2D + contorn 3D via SVGGeometryElement).
- `savePNG` afegit al costat de `saveSVG` al footer d'exportació.
- Teclat: ArrowDown/Up, Home/End, roving tabindex (spec accessibility-lead).
- Deploy: SHAPER 001 + PP repo.

### Decisions
- `wireTabs()` implementa l'ARIA tabs pattern (no `<nav>` + button, sinó `role="tablist"`) per coherència semàntica amb la spec W3C.
- SVG import usa `SVGGeometryElement.getTotalLength/getPointAtLength` en lloc d'un parser manual — aprofita el motor SVG del navegador.
- `trackRand` eliminat de la UI (simplificació Kerning), però el state i el motor el mantenen — si es vol recuperar la variació, és addició trivial.

---

## 2026-06-13 — Sliders 3D condicionals per forma

### Fet
- `updateEditorVisibility()` extesa: amaga/mostra `facets`, `turns`, `count`, `scatter` segons la forma 3D activa.
  - `facets`: cylinder / helix / star-prism / custom-prism
  - `turns`: helix
  - `count` + `scatter`: cluster
- Live region `role="status"` anuncia el canvi de forma als lectors de pantalla.
- `hidden` attribute (no CSS) → fora del tab order i l'arbre d'accessibilitat.
- Commit + push a GitHub (SHAPER 001 + Pixel Perfect). Vercel auto-deploy a https://q-pp-001.vercel.app/shaper/

### Decisions
- Sliders amagats amb `hidden` (no `display:none`) per coherència amb el patró existent dels editors customProfileEditor/customOutlineEditor.

---

## 2026-06-13 — Q S 003 design + deploy inicial

### Fet
- CSS completament reescrit amb tokens Q S 003 (idèntics a Pixel Perfect/Lumen).
- Font → `'Datatype', monospace`; sidebar → blanc; stage → `#000000`; `--radius: 0`.
- Sliders: track + thumb 1px amb `--ink-3` (#555555) — fix WCAG 1.4.11 (contrast 7.46:1 vs blanc).
- Focus → double-ring `box-shadow` (millor que el `outline` blau original).
- Botons → uppercase, transparent per defecte; `.btn-primary` negre; `#playPause` transparent.
- Collapsible `<details>` → indicador +/− sense `list-style: disclosure-*`.
- Git repo inicialitzat i push a GitHub: https://github.com/strk04/SHAPER-001
- Deploy via PP001: https://q-pp-001.vercel.app/shaper/ (standalone q-shaper-001.vercel.app desactivat)

### Decisions
- Slider track usa `--ink-3` (no `--rule`) per WCAG 1.4.11 — flagejat per revisar el token `--rule: #9d9d9d` a Q S 003 en una sessió futura.

---

## 2026-06-12
- Fet: creació de l'estructura de documentació (README, STATUS, progress, decisions) al vault i a docs/ del projecte.
