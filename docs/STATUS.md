# STATUS — SHAPER 001

_Actualitzat: 2026-06-14_

## Estat general

Estable. Desplegat a producció. SHAPER continua sent un projecte separat, però també viu integrat dins Pixel Perfect a `/shaper/`.

## URLs

- **Live:** https://q-shaper-001.vercel.app
- **PP:** https://q-pp-001.vercel.app/shaper/
- **Repo:** https://github.com/strk04/SHAPER-001
- **Deploy:** Vercel — git push main → auto-deploy

## Stack

Vanilla JS zero-build (index.html, main.js, engine.js, styles.css). Sense bundler ni node_modules. `mp4-muxer.mjs` s'usa per a l'export MP4 via WebCodecs.

## Darrera sessió

2026-06-14 — Auditoria visual i funcional a fons per acostar SHAPER a Pixel Perfect.

Fet:

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

- Revisar i commitejar, si escau, el diff pendent de guies 3D a `engine.js` també a la còpia integrada de PP.
- Fer una passada manual final al navegador real amb totes les formes 3D noves.
- Revisar token `--rule: #9d9d9d` a Q S 003 (contrast insuficient WCAG 1.4.11 — només 2.71:1).
