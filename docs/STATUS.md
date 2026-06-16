# STATUS — SHAPER 001

_Actualitzat: 2026-06-17_

## Estat general

Estable. Desplegat a producció dins Pixel Perfect. La URL canònica és `/shaper/` de PP001. El Vercel standalone `q-shaper-001` ha estat desactivat.

## URLs

- **Live:** https://q-pp-001.vercel.app/shaper/
- **Repo:** https://github.com/strk04/SHAPER-001
- **Deploy:** editar a `17 SHAPER 001/` → copiar a `02 Pixel Perfect/shaper/` → push PP001

## Stack

Vanilla JS zero-build (index.html, main.js, engine.js, styles.css). Sense bundler ni node_modules. `mp4-muxer.mjs` s'usa per a l'export MP4 via WebCodecs.

## Darrera sessió

2026-06-17 (sessió 5) — 6 paràmetres d'àtom: charOpacity, charSkew, sizeRamp, colorRamp, densityMap, maskShape.

Fet (sessió 5):

- **`charOpacity`** (Opacitat aleatòria): opacitat per caràcter seeded independent (PRNG `randAtom`); rang 0=off → 1=màxima variació.
- **`charSkew`** (Inclinació aleatòria): skew horitzontal per caràcter via shear canvas (`ctx.setTransform`); rang 0–1.
- **`sizeRamp`** (Rampa de mida): `sizeMul` per posició X normalitzada; −1=gran esquerra/petit dreta, +1=l'invers. No afecta l'interletraje, efecte visual pur.
- **`colorRamp`** + **`colorRampTo`**: gradient A→B esquerra→dreta; `lerpHex` per interpolar HEX; control de color addicional al panel Colors.
- **`densityMap`** (Mapa de densitat): `dropProb` augmenta linealment cap a la dreta (zona densa esquerra → zona dispersa dreta).
- **`maskShape`** (Forma màscara): clip canvas a cercle, diamant, el·lipse H/V, triangle; `maskRadius` controla la mida. Funciona tant a 2D com 3D.
- **PRNGs separats**: `randAtom` (`seed ^ 0x9e3779b9`) és independent de `rand`; no trenca els presets existents.
- **Tiling fix**: `flow` i `cascade` ara preserven tots els atributs per caràcter (`{ ...c, x: px }`).

Sincronitzat a `02 Pixel Perfect/shaper/` ✓

---

## Darrera sessió (anterior)

2026-06-15 (sessió 4) — Character Map + polits UI + audioreactiu fork.

Fet (sessió 4):

- **Slider `paramSpeed`** (Easing paramètric): warp sinusoïdal monotó sobre t01 de pantalla, crea 4 zones de densitat per revolució. Funciona a totes les formes 3D.
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

- Commit pendent: `feat: paramSpeed warp, 10 new 3D forms, flat-form fixes, UI cleanup` + `fix: video export race condition` + `feat: domain warp noise` + `feat: Character Map panel`.
- Validació visual al navegador de totes les 10 formes 3D noves i dels sliders `paramSpeed` / `noiseTexture`.
- Revisió token `--rule: #9d9d9d` (contrast 2.71:1 — insuficient WCAG 1.4.11).
- `18 SHAPER 002` — audioreactivitat (propera sessió, repo local sense remote).
