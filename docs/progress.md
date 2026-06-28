# Progress — SHAPER 001

## 2026-06-23 — Documentació tècnica del sistema

### Fet
- `docs/informe-presets.md` — informe complet del sistema de presets (auth GitHub, capturePreset, applyPreset, SHA cache, fluxos desar/carregar, migració, limitacions).
- `docs/informe-export.md` — informe complet del sistema d'exportació (SVG, PNG per DPI, MP4 via WebCodecs+mp4-muxer, dos modes gravació: offline Director vs. temps real).

### Pendent
- (sense canvis de codi en aquesta sessió)

---

## 2026-06-22 — Motion Director mergejar a main + keyframes interactius

### Fet
- `removeKeyframe` a `director.js`: elimina frame per temps exacte, neteja lane si buida.
- ◇ toggle a l'inspector: `aria-pressed` + CSS `::before` (◇/◆), label estàtica, font única de veritat.
- Keyframes interactius a la timeline: `buildLanes` mostra ◇/◆ (actual = ◆), clic elimina amb focus management + live region SR, `aria-label` inclou valor del paràmetre.
- `onRemoveKeyframe` callback wired a `main.js`.
- 28 tests verds. WCAG 2.2 AA verificat pre+post escriptura.
- Merge `feat/motion-director` → `main` + push a `origin/main` (`7ac5467`).

### Pendent
- Copiar fitxers a `02 Pixel Perfect/shaper/` i push PP001 (l'usuari ho ha d'autoritzar).

---

## 2026-06-20 — Implementació Motion Director (branca `feat/motion-director`)

### Fet

- Implementat el Motion Director complet seguint el pla (10 tasques, TDD, subagent-driven amb gate d'accessibilitat).
- **Mòduls nous:** `director.js` (esquema/normalització, avaluador temporal, escenes i keyframes immutables, `simplifySamples`), `motion.js` (4 camps deterministes + cohesió), `director-ui.js` (timeline radiogroup + pads press-and-hold), `export-video.js` (export offline frame-exact). 5 fitxers de test, 26 tests verds.
- **Integració:** `engine.js` aplica offsets a 2D i 3D amb fast path idèntic quan no hi ha comportaments; blink determinista via `clockMs`. `main.js` resol un snapshot per temps absolut (`resolveRenderState`), avança el Director en segons reals, munta la UI, gestiona edició/pads/gravació, presets versionats i export SVG/PNG/MP4 del frame resolt.
- **Accessibilitat (WCAG 2.2 AA):** review pre-escriptura + re-review post-escriptura sobre fitxers reals = SHIP. Escenes `role="radiogroup"`, pads press-and-hold amb force-release (element + window blur), `<output aria-live="off">`, `announce()` només discret, token `--rule-on-dark` + focus rings dock-scoped per al dock fosc.
- **Verificació:** 26 tests, `node --check` net (6 mòduls), `git diff --check` net, smoke test del servidor (index 200, markup + 6 mòduls 200).

### Queda

- Verificació visual al navegador (checklist Task 10 Step 2-3) — únic gate abans de merge a `main` i copia a `02 Pixel Perfect/shaper/`.
- Gap menor: ◇ keyframe dins comportament passa `value: 0` placeholder (captura de valor de camp real pendent).

### Commits (branca)

`db5c39e` esquema · `fd3e8d0` avaluador · `00fae03` motion · `80cc0ad` integració 2D/3D · `fb488a2` rellotge absolut · `68a7d49` shell timeline · `76b73f4` edició escenes · `b3db441` pads/gravació · `509c8c2` presets/export · (docs final).

---

## 2026-06-20 — Disseny Motion Director

### Fet

- Definit i aprovat un model híbrid de control d’animació: escenes, automatització amb keyframes i intervenció en viu.
- Seleccionats quatre comportaments per a v1: direcció/deriva, òrbita, atracció/repulsió i explosió/reagrupament.
- Definida cohesió regulable entre moviment rígid i resposta individual per caràcter.
- Aprovada la UI: pestanya Director, inspector contextual, stage existent i timeline inferior col·lapsable.
- Arquitectura separada en `director.js`, `motion.js` i `director-ui.js`.
- Especificació escrita a `docs/superpowers/specs/2026-06-20-motion-director-design.md`.
- Pla d’implementació TDD en 10 tasques escrit a `docs/superpowers/plans/2026-06-20-motion-director-implementation.md`.
- El pla cobreix esquema, avaluador temporal, moviment 2D/3D, UI, edició, live recording, presets, export frame-exact i verificació final.

### Resta

- Triar mode d’execució del pla.
- Implementar i validar sense alterar el render quan Director està desactivat.

---

## 2026-06-18 (sessió 13) — Morph orgànic per caràcter + fix desat de presets

### Fet
- **morphScatter** (slider "Dispersió aleatòria", 0–1): desplaça quan comença la transició de cada caràcter. A 0 = blend uniforme; a 1 = dissolució (cada lletra salta en un moment aleatori). PRNG separat (`seed ^ 0xc0ffee77`), 2 rolls sempre consumits → determinista.
- **morphSpeedVar** (slider "Variació de velocitat", 0–1): cada caràcter té una velocitat de transició diferent. Implementat com **easing per potència** (`localMix = rawMix ^ power`, power log-normal) dins la finestra normalitzada [0,1] — tots arriben a 1, sense talls.
- **Fix bug tall sec**: la 1a versió de speedVar escalava l'ample de finestra (>1 → caràcters que mai acabaven → salt en reiniciar). Substituït per easing.
- **morphSpeed**: rang reduït 0.05–2 → **0.01–0.3** (pas 0.01), default 0.2 → 0.05.
- **Fix desat de presets**: el feedback anava a `#exportStatus` (panell Export, `hidden` des de Presets) → desar fallava en silenci visual. Nou `#presetStatus` al panell Presets + `setPresetStatus()`; tot el feedback de presets hi va.
- **validateToken()**: ara verifica accés real al repo (push permission) en lloc de només `/user` → "connectat" ja no menteix si el token no pot escriure.
- **Text UI**: nom del repo corregit (`SHAPER-001` → `strk04/shaper-presets`) + permís correcte.
- Sync `02 Pixel Perfect/shaper/` ✓ · node --check OK

### Pendent
- Validació visual navegador: scatter + speedVar combinats; desat real amb token amb permisos.

---

## 2026-06-17 (sessió 12) — Cadena de morph de 4 formes

### Fet
- **Cadena de morph 1→2→3→4**: afegits `morphForm2`, `morphForm3`. La forma base és el node 1; els 3 destins són nodes 2,3,4 (en ordre).
- **build3D**: `chainForms` filtra els destins no buits seqüencialment. Càlcul per frame (un cop) de `morphFrom`/`morphTo`/`morphMix`. **Auto** = bucle tancat (base→d1→d2→d3→base), transició eased + hold 8s a cada node. **Manual** (Blend 0–1) = cadena oberta sense tornar a base.
- **UI**: destí 2 apareix en omplir destí 1, destí 3 en omplir destí 2 (`updateMorphVisibility`). Opcions de destí 2/3 clonades de destí 1 via JS (sense triplicar HTML).
- **Presets**: `morphForm2`/`morphForm3` a capture/apply.
- Sync `02 Pixel Perfect/shaper/` ✓ · node --check OK

### Pendent
- Validació visual navegador: cadena 4 formes auto + manual.

---

## 2026-06-17 (sessió 11) — Sistema de morphing entre formes + fix perspectiva

### Fet
- **Morph UV entre dues formes**: `morphSurface()` a `build3D` interpola `surfaceMap(formA)` → `surfaceMap(formB)` per caràcter (posició + normal). El UV de cada caràcter es manté fix. Nova secció "Morph" al panell 3D (entre Forma 3D i Càmera).
- **Controls**: `morphForm` (select forma destí, 45 opcions + "cap"), `morphT` (slider Blend 0–1 manual), `morphAuto` (checkbox), `morphSpeed` (durada transició).
- **Cicle auto amb hold**: transició A→B eased (≈`1/morphSpeed`s), hold 8s a B, transició B→A, hold 8s a A, loop. Usa `morphClock` (segons reals, acumulat a `frame()`, independent de `speed3d`). Reset a 0 en activar Auto.
- **Fix slowdown perspectiva**: `projectPersp` coïa el `zoom` dins `scale` per glif (≈2.3× al centre) → glifs ~5× més àrea de fill. Ara `scale: dist/denom` → 1 al pla central, només variant per profunditat. Consistent amb isomètrica. Glifs en perspectiva ara més petits (mida real `fontSize`).
- Sync `02 Pixel Perfect/shaper/` (engine.js, main.js, index.html) ✓

### Pendent
- Validació visual navegador: morph entre formes diverses, cicle hold 8s, perspectiva fluida.
- Commit pendent (acumulat sessions 3–11).

---

## 2026-06-17 (sessió 10) — Guies wireframe per les 20 formes noves

### Fet
- **`buildGuidesData()` — 20 nous casos** a `engine.js`: totes les formes afegides a la sessió 9 ara mostren guia wireframe quan `P.guides=true`.
- **Helpers `trace(fixed, isV, steps)`** i **`isoGrid(n, steps)`**: afegits dins `buildGuidesData`. `trace` traça una corba iso-paràmetre (u o v fixat) via `surfaceMap`. `isoGrid` en fa una graella de n−1 × 2 corbes.
- **Guies customitzades** per a: knot-35/knot-27 (línia central del nus), lissajous-3d (corba de Lissajous), helicoid (2 arestes + eix), hyperboloid-2 (2 fulls: anell + 4 meridians cada full), oloid (2 circumferències perpendiculars), seifert (nus trefoil + 3 talls de strip).
- **`isoGrid(4, 48)`** per a: enneper, pseudosphere, roman-surface, boy-surface, superformula, cardioid-rev, lemniscate-rev, dupin-cyclide, gyroid, scherk, riemann-minimal, swallowtail, klein-bottle.
- Sync `02 Pixel Perfect/shaper/engine.js` ✓

### Pendent
- Validació visual al navegador: guies de les 20 formes noves.
- Commit pendent (acumulat sessions 3–10).
- Test GitHub presets amb token real.

---

## 2026-06-17 (sessió 9) — 4 colors accent independents + blinkFade slider + GitHub presets

### Fet
- **4 colors accent independents**: `engine.js` `layout()` ara calcula `accentT` (0–4) amb 4 valors derivats de `atomAccent` via multiplicació per φ/√5/π (sense rolls extra de PRNG). La funció `_evalAM()` avalua cada color independentment. Prioritat inversa: color 1 guanya (últim `if` en ordre 4→3→2→1). `hasAccent`/`hasAccent3d` eliminats com a guarda — `accentT>0` és suficient.
- **`main.js`**: `updateAccentVisibility()` reescrita per 4 colors independents. Listeners per `accentMode2/3/4`, `accentColor2/3/4`. `capturePreset`/`applyPreset` inclouen tots els camps del 4 colors.
- **`index.html`**: 4 blocs de color amb mode select + color picker + prob slider + every slider.
- **blinkFade slider** (Dissolència 0–1): hard blink → fade cosí complet. `blinkRate` min 0.05 Hz.
- **GitHub preset storage** (`presets-github.js`): repo `strk04/SHAPER-001`, path `presets/{projecte}/{nom}.json`.
- **Auto-play a l'inici**: `play()` incondicionalment a `init()`.
- **Fix pipeline 3D (sessió 8)**: `extraOp`/`sizeMul`/`skew` propagats a 3D.
- Sync `02 Pixel Perfect/shaper/` ✓

### Pendent
- Validació visual al navegador: 4 colors accent en mode 3D (el default).
- Test GitHub presets: conectar token, crear projecte, guardar/carregar/esborrar preset.
- Commit pendent (acumulats sessions 3–8).

---

## 2026-06-17 (sessió 7) — Retirada Easing paramètric / Inèrcia de superfície

### Fet
- Eliminat `paramSpeed` del runtime: slider, estat, lectura de paràmetres, warp dins `buildArcLUT` i línia `EASE` del guide meta.
- Eliminat `surfaceEase` del runtime: slider, estat, visibilitat condicional i funcions d'inèrcia.
- `surfaceFlowU` torna a ser lineal (`time * speed * 0.12`).
- `buildArcLUT` queda només com a mapeig arc-length/tangent.

### Provat i no funcionat
- `paramSpeed`: warp sinusoïdal de posició (`t01 - K·sin(...)`). No generava la sensació clara que les tipos acceleressin/frenessin.
- `surfaceEase` com a blend ArcLUT/raw-u: invisible o massa feble en formes uniformes.
- Warp espacial sobre `u`: sí canviava posicions, però deformava/recol·locava el layout a `t=0`; no era una animació de velocitat.
- Modulació temporal de `flowU`: numèricament creava variació, però no resolia la percepció visual en ús real.

### Decisió
- Cap control d'easing/inèrcia queda actiu. No reintroduir sense prova visual al navegador.

---

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

## 2026-06-15 (sessió 4) — noiseTexture, paramSpeed retirat, Character Map, fork 002

### Fet
- `paramSpeed` (Easing paramètric): implementat com a warp sinusoïdal, però retirat a la sessió 7 perquè no funcionava visualment.
- `noiseTexture` (Buits de textura): domain warp UV via fBm. str=0.7 (exagerat a petició). Dues impls anteriors rebutjades (dropout, opacitat) — solució: desplaçament físic de posició.
- Fix race condition `stopRecord()`: guard `_stopping`, prevents doble `finalize()`.
- UI: 2D `disabled`, `vNorm` eliminat, canvas size del footer eliminat.
- Panel "Mapa de caràcters": 23 blocs Unicode, font selector, cerca, copy+live region, lazy build.
- Fork `18 SHAPER 002` independent (git reinicialitzat, sense remote) → audioreactivitat.
- Sync `02 Pixel Perfect/shaper/` ✓

### Pendent
- Commit pendent (acumulats des de sessió 3).
- Validació navegador: 10 formes noves + noiseTexture.

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

---

## 2026-06-29 — Director: selecció automàtica de nova escena

### Fet

- Detectada confusió d’UX: després de crear més d’una escena, la columna 2 continuava mostrant `Escena 1` perquè l’escena nova no quedava seleccionada.
- Implementat helper pur `applySceneAction()` a `director.js`.
- `main.js` ara delega les accions d’escena a aquest helper.
- Afegit test TDD `scene actions select the newly created scene`.

### Verificat

- `node --test tests/director.test.mjs` → 18 pass.
- `node --test tests/*.test.mjs` → 29 pass.
- `node --check main.js`
- `node --check director.js`
- `node --check director-ui.js`

### Pendent

- Provar visualment al navegador que `Afegeix` selecciona `Escena 2` i que `Duplica` selecciona la còpia.
- Continuar simplificant l’explicació i la UX inicial de Director.

---

## 2026-06-29 — Director: eliminació de live pads i `REC`

### Fet

- Retirats `ATTRACT`, `REPEL`, `EXPLODE` i `REC` de la UI del Director.
- Eliminada tota la infraestructura live associada a `main.js`, `director-ui.js`, `director.js`, `index.html` i `styles.css`.
- `evaluateDirector()` ja no admet overrides en viu.
- Afegit test de wiring per garantir que els controls live no tornen a aparèixer.

### Verificat

- `node --test tests/director.test.mjs` → 17 pass.
- `node --test tests/project-wiring.test.mjs` → 3 pass.
- `node --test tests/*.test.mjs` → 29 pass.
- `node --check main.js`
- `node --check director.js`
- `node --check director-ui.js`

### Pendent

- Validació visual del Director simplificat.
- Decidir si `Hold` i `Reverse` es mantenen o també es simplifiquen.

---

## 2026-06-29 — Director: només `Afegeix` i `Elimina` a les escenes

### Fet

- Eliminats de la UI d’escena els botons `Duplica`, `←` i `→`.
- L’inspector d’escena queda amb accions mínimes: `Afegeix` i `Elimina`.
- Afegit test de wiring per evitar que aquests botons reapareguin.

### Verificat

- `node --test tests/project-wiring.test.mjs` → 4 pass.
- `node --test tests/*.test.mjs` → 30 pass.
- `node --check director-ui.js`

### Pendent

- Validació visual ràpida del nou inspector d’escena simplificat.
