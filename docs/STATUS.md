# STATUS — SHAPER 001

_Actualitzat: 2026-06-17 (sessió 8)_

## Estat general

Estable. Desplegat a producció dins Pixel Perfect. La URL canònica és `/shaper/` de PP001. El Vercel standalone `q-shaper-001` ha estat desactivat.

## URLs

- **Live:** https://q-pp-001.vercel.app/shaper/
- **Repo:** https://github.com/strk04/SHAPER-001
- **Deploy:** editar a `17 SHAPER 001/` → copiar a `02 Pixel Perfect/shaper/` → push PP001

## Stack

Vanilla JS zero-build (index.html, main.js, engine.js, styles.css). Sense bundler ni node_modules. `mp4-muxer.mjs` s'usa per a l'export MP4 via WebCodecs.

## Darrera sessió

2026-06-17 (sessió 9) — 4 colors accent independents + blinkFade slider + GitHub presets + auto-play

Fet (sessió 9):

- **4 colors accent independents** (`accentMode`/`accentColor` × 4): cada color té el seu propi mode select (none/seeded/alternating-word/first-letter), color picker, prob slider i freq slider. El `accentT` es calcula a `layout()` amb 4 randoms derivats (`atomAccent × φ, √5, π`) — sense PRNG extra. Prioritat: color 1 guanya si coincideixen múltiples. `hasAccent` eliminat com a guarda (ara `accentT>0` és suficient).
- **blinkFade slider** (Dissolència 0–1): convertit de checkbox a slider. `blinkFade=0` → hard blink, `blinkFade=1` → fade cosí complet. `blinkRate` min ara 0.05 Hz per fades molt lents.
- **GitHub preset storage** (`presets-github.js`): presets guardats a repo `strk04/SHAPER-001` com a JSON files dins `presets/{projecte}/{nom}.json`. PAT token en localStorage. SHA cache per a PUT/DELETE sense GET extra.
- **Auto-play a l'inici**: l'animació arrenca en Play (no Pause) en carregar.
- **Fix pipeline 3D** (sessió 8): `extraOp`/`sizeMul`/`skew` propagats per `build3D` → `buildScene` → `drawScene`.
- Sync `02 Pixel Perfect/shaper/` (engine.js, main.js, index.html, presets-github.js) ✓

---

## Darrera sessió (anterior)

2026-06-17 (sessió 7) — Eliminació d'Easing paramètric / Inèrcia de superfície.

Fet (sessió 7):

- **Eliminat `paramSpeed` / Easing paramètric** de `engine.js`, `main.js` i `index.html`.
- **Eliminat `surfaceEase` / Inèrcia de superfície** de `engine.js`, `main.js` i `index.html`.
- `buildArcLUT` es conserva només per arc-length/tangent de superfície; ja no aplica warp paramètric.
- `surfaceFlowU` torna a ser lineal: `time * speed * 0.12`.
- Guide meta ja no mostra `EASE`.
- Sync a `02 Pixel Perfect/shaper/` pendent de commit/push en aquesta sessió.

Provat i descartat:

- **Warp paramètric espacial (`paramSpeed`)**: concentrava caràcters en zones del recorregut però no donava l'acceleració perceptiva buscada.
- **Blend ArcLUT/raw-u (`surfaceEase`)**: només deixava passar irregularitats de formes que ja les tenien; en formes uniformes com esfera/cilindre/torus no es percebia.
- **Warp espacial sobre `u`**: alterava la composició fins i tot a `t=0`, canviant el layout en lloc de només el moviment.
- **Modulació temporal del `flowU`**: els tests numèrics indicaven variació, però visualment no resolia el problema en l'ús real. Retirat.

Decisió: no mantenir cap control d'easing/inèrcia fins trobar una solució visualment comprovada en navegador real.

---

## Darrera sessió (anterior)

2026-06-17 (sessió 6) — Color d'accent per caràcter + eliminació gradient de color.

Fet (sessió 6):

- **`accentMode`** (select: none/seeded/alternating-word/first-letter): color d'accent puntual per caràcter via `randAtom`. Tres modes: aleatori per caràcter (`accentProb`), alternació per paraula (`accentEvery`), primera lletra de cada paraula.
- **`accentColor`** (color picker): color d'accent aplicat als caràcters seleccionats.
- **Fix pipeline 3D**: `accentT` propagat per tota la cadena 3D (`build3D` → `buildScene` superfície+billboard → `drawScene` 3D fillStyle). Sense el fix, el color d'accent no tenia efecte en mode 3D.
- **Charmap → Àtom**: click a un caràcter del mapa ara l'afegeix directament a `state.text` (+ textarea) a més de copiar al portapapers.
- **Eliminat gradient de color**: `colorRamp`, `colorRampTo`, `lerpHex`, `parseHexColor` eliminats completament de `engine.js`, `main.js` i `index.html`. El gradient no afegia valor artístic; el color d'accent és la solució correcta.

Sincronitzat a `02 Pixel Perfect/shaper/` ✓

---

## Darrera sessió (anterior)

2026-06-17 (sessió 5) — 6 paràmetres d'àtom: charOpacity, charSkew, sizeRamp, densityMap, maskShape.

Fet (sessió 5):

- **`charOpacity`** (Opacitat aleatòria): opacitat per caràcter seeded independent (PRNG `randAtom`); rang 0=off → 1=màxima variació.
- **`charSkew`** (Inclinació aleatòria): skew horitzontal per caràcter via shear canvas (`ctx.setTransform`); rang 0–1.
- **`sizeRamp`** (Rampa de mida): `sizeMul` per posició X normalitzada; −1=gran esquerra/petit dreta, +1=l'invers. No afecta l'interletraje, efecte visual pur.
- **`densityMap`** (Mapa de densitat): `dropProb` augmenta linealment cap a la dreta (zona densa esquerra → zona dispersa dreta).
- **`maskShape`** (Forma màscara): clip canvas a cercle, diamant, el·lipse H/V, triangle; `maskRadius` controla la mida. Funciona tant a 2D com 3D.
- **PRNGs separats**: `randAtom` (`seed ^ 0x9e3779b9`) és independent de `rand`; no trenca els presets existents.
- **Tiling fix**: `flow` i `cascade` ara preserven tots els atributs per caràcter (`{ ...c, x: px }`).

Sincronitzat a `02 Pixel Perfect/shaper/` ✓

---

## Darrera sessió (anterior)

2026-06-15 (sessió 4) — Character Map + polits UI + audioreactiu fork.

Fet (sessió 4):

- ~~**Slider `paramSpeed`** (Easing paramètric)~~: retirat a la sessió 7 perquè no produïa l'acceleració perceptiva buscada.
- **Slider `noiseTexture`** (Buits de textura): domain warp de coordenades UV via dos camps fBm independents abans de `surfaceMap`. Causa clustering físic de caràcters (sense tocar opacitat).
- **Fix export MP4**: race condition `Cannot read properties of null ('finalize')` — guard `_stopping` + `isRecording=false` immediat al inici de `stopRecord()`.
- **Secció 2D desactivada**: botó `disabled aria-disabled="true"` mentre no és funcional.
- **Eliminat `vNorm`** de la UI (control + checkbox).
- **Eliminat canvas size** del footer; només roman play/pause.
- **10 formes 3D noves**: paraboloide, hiperboloide, el·lipsoide, molla, sella de mico, nautilus, catenoide, superquàdrica, Dini, trifoli.
- **ArcLUT tangent (Option B)**: retorna `{u, tangent}` per eliminar el doble `surfaceMap` per glif en mode `surfaceText` + `rings`/`spiral`.
- **Panel "Mapa de caràcters"**: 23 blocs Unicode (Basic Latin → Braille), selector tipografia independent, cerca per nom de bloc/hex/caràcter, click → clipboard + anunci live region. Build lazy al primer accés.
- **Fork `18 SHAPER 002`**: còpia física independent, `.git` reinicialitzat sense remote — base per audioreactivitat.

Sincronitzat a `02 Pixel Perfect/shaper/` ✓

Fet (sessions anteriors):

- Auto-play a l'inici (respecta `prefers-reduced-motion`).
- Toggle vNorm: normalització de cobertura-v per forma (torus, con, esfera, disc, Möbius).
- 4 modes d'aplicació d'àtom: Anells, Columnes, Espiral, Panell (selector `wrapMode`).
- Format fusiont amb Export panel; canvas redimensiona en col·lapsar la navegació.
- Flux horitzontal 2D: loop seamless per tiling (mai canvas en blanc).
- 10 nous moviments 2D: Ona H, Rebot, Pèndol, Cascada, Dispersió, Vòrtex, Expansió, Màquina, Deriva, Escalonat.
- Fix Pla / Ondulat: el path 3D forçat incondicionalment a 2D va ser revertit; ara funcionen com a formes 3D.
- Fix typewriter: canvas en blanc a T=0 resolt (mostra tots si T=0).
- Fix stagger: el period ara és fix (3s) independent de fontSize/leading.
- Eliminada forma "Conjunt"; "Prisma personalitzat" → "Custom" (al final de la llista).

Provat:

- UI alineada amb la shell de Pixel Perfect: 3 columnes, espais, paddings, tipografia, selects, sliders, textareas i export footer.
- Columna 2 corregida: només carrega el panell concret seleccionat a columna 1.
- Export mogut al footer de columna 1.
- Àtom corregit d'inici: text Català sincronitzat entre `state.text` i textarea.
- Bug NaN corregit: `trackRand` ja no existeix a la UI; ara té fallback `0` dins layout.
- Text sobre superfície activat per defecte: l'Àtom es mou per la UV/superfície de la forma 3D.
- Deformació tipogràfica corregida: transform de superfície ara és rígid (angle tangent + escala uniforme), no una matriu afí amb shear.
- Hèlix corregida: wrap de `u` perquè el text no surti de la forma amb el flow.
- 2D animat: `Moviment 2D` amb `Flux horitzontal` per defecte, més `Estàtic` i `Pluja`.
- `Mida de forma` corregida: ara afecta visualment la mida projectada de la forma 3D.
- Controls 3D filtrats per forma amb `FORM_3D_CONTROLS`.
- Export ampliat a estil Lumen Gen: PNG, SVG i MP4 amb FPS, durada, format, DPI/custom canvas i bitrate.
- Presets amb localStorage i import/export JSON.
- Afegides 10 formes 3D: torus, con, disc, ondulat, Möbius, nus toroïdal, caixa, sella, càpsula i doble hèlix.

Provat:

- Checks de sintaxi/DOM sobre `index.html`, `main.js`, `engine.js`, `styles.css`.
- Regressió Àtom: primera línia amb glyphs vàlids, sense col·lapse vertical per `NaN`.
- Regressió superfície: tots els glyphs de superfície generen matriu quan `surfaceText` està actiu.
- Regressió tipus rígida: glyphs en superfície sense deformació/shear.
- Regressió hèlix: text visible amb surface flow acumulat.
- Regressió controls: controls visibles mapejats per forma.
- Regressió 2D/formSize: flow 2D actiu i `formSize` canvia els bounds projectats.

No resolt / vigilar:

- El Browser tool va bloquejar una verificació interactiva en `127.0.0.1`; es va validar amb asserts estàtics/Node.
- Hi ha un diff no commitejat a `engine.js` que afegeix guies per les formes 3D noves. No sobreescriure'l sense revisar.
- GitHub Desktop pot confondre si apunta a `/Users/albert/Documents/Pixel Perfect`: aquest és un stub, no el repo real de Pixel Perfect.
- La pluja 2D continua existint però fa salt/reset per disseny (`offset % leading`); per això el default és `Flux horitzontal`.

## Pendent

- Validació visual al navegador de totes les formes 3D noves i del slider `noiseTexture`.
- Revisió token `--rule: #9d9d9d` (contrast 2.71:1 — insuficient WCAG 1.4.11).
- `18 SHAPER 002` — audioreactivitat (propera sessió, repo local sense remote).
