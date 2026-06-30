# HANDOFF - SHAPER 001

_Actualitzat: 2026-06-30_

## Que ha canviat

- Els presets ara es capturen amb un snapshot creatiu centralitzat a `preset-state.js`, en lloc d'una llista manual dispersa dins `main.js`.
- El JSON de preset inclou `cameraEnabled`, `customOutline`, `guideMeta`, `vNorm`, `seed` i `director`, a més dels sliders i camps creatius ja existents.
- Es deixen fora explícitament camps efímers com `fps`, `t`, `morphClock`, `directorTime`, `directorRate`, `selectedDirectorSceneId` i `selectedDirectorKeyframe`.
- En carregar preset es restaura l'estat dels toggles de càmera i es sincronitza la UI amb `syncCameraToggleUI()`.
- L'export MP4 amb durada fixa i Director desactivat ara es renderitza offline frame-exact, igual que el Director.
- Afegit helper `resolveOfflineAnimationState()` per calcular `t`, `morphClock`, `directorTime` i `fps` des d'un snapshot base i un temps absolut d'export.
- `main.js` reutilitza `drawResolvedState()` perquè l'export offline pugui pintar directament un estat resolt sense dependre del `requestAnimationFrame` del preview.
- La gravació manual continua sent real-time.
- Quan `Morph` esta actiu, les guies 3D tambe fan morphing: passen pel mateix blend parametric de superficie que la forma.
- Afegit selector `Capa guies` amb opcions `Darrere` i `Davant`; per defecte continua a `Darrere`.
- Afegits colors propis `Color de guies` i `Color meta guies` al panell `Colors`, amb persistencia en presets.
- Eliminats del panell `Estil 3D` els controls de `Tapes` i `Interior`; els presets ja no els capturen ni els restauren.
- En canvas, `Davant` ara es dibuixa com una capa 2D literal per sobre de tot, resetejant la transformacio abans del traç.
- L'export SVG separa les guies en capes `guides-back` o `guides-front` segons el selector.
- Afegit color de superficie 3D configurable a `Colors`.
- Afegit slider `Transparencia superficie` (`0` opac, `1` invisible), amb valor per defecte `0.25`.
- Afegit checkbox `Oculta text posterior`, actiu per defecte, per eliminar glifs de la cara posterior encara que la superficie sigui transparent.
- En canviar de forma, `Mida de forma` i `Zoom` tornen als defaults (`413` i `1`).
- Afegida normalitzacio interna de zoom per formes matematiques que arrencaven massa petites (`roman-surface`, `dini`, `seifert`, etc.).
- `engine.js` genera una malla de quads per a totes les formes 3D i la pinta entre el text posterior i el text frontal.
- L'export SVG serialitza les capes principals: `guides-back`, `text-back`, `surface`, `text-front`, `guides-front`.
- Els presets capturen i restauren `surfaceColor` i `surfaceTransparency`.
- Afegits tests de motor i wiring.
- Canvis sincronitzats i pujats també a `02 Pixel Perfect/shaper/`.

## Estat actual

- Els presets són més complets i reproduïbles: guarden la configuració creativa de càmera, seed, outline custom i Director. No guarden el temps actual de reproducció ni seleccions d'edició temporals.
- Per obtenir MP4 fluid sense Director, seleccionar una durada fixa (`5 s`, `10 s`, etc.) fa una exportació offline amb mostreig uniforme. `Manual` continua capturant el canvas en temps real i pot dependre del rendiment del navegador.
- La superficie es veu per defecte en gris clar translucid (`#d8d8d8`, transparencia `0.25`).
- Les guies i la info meta poden tenir colors independents del text; per defecte continuen a `#111111`.
- Amb morph actiu, les guies canvien de geometria amb el blend de forma.
- Les guies poden quedar visualment darrere o davant de la superficie i la tipografia; `Davant` equival a posar la capa de guies per sobre en 2D.
- `Estil 3D` només exposa la regió `Superfície`; `Tapes` i `Interior` queden fora de la UI.
- En formes tancades, la superficie pot ser translucida pero la tipografia posterior queda oculta si `Oculta text posterior` esta actiu.
- En formes obertes, la mateixa logica funciona com una lamina acolorida.
- Verificacio visual local feta amb `php -S 127.0.0.1:8097`: controls visibles, reset de forma comprovat i canvas renderitzat.

## Verificacio feta

```bash
node --check engine.js
node --check main.js
node --check export-video.js
node --check preset-state.js
node --test tests/*.test.mjs   # 49 pass
```

## Fitxers importants

- [engine.js](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/engine.js)
- [main.js](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/main.js)
- [preset-state.js](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/preset-state.js)
- [export-video.js](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/export-video.js)
- [index.html](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/index.html)
- [tests/export-video.test.mjs](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/tests/export-video.test.mjs)
- [tests/preset-state.test.mjs](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/tests/preset-state.test.mjs)
- [tests/surface-fill.test.mjs](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/tests/surface-fill.test.mjs)
- [tests/project-wiring.test.mjs](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/tests/project-wiring.test.mjs)

## Seguent pas util

- Si cal mes qualitat d'oclusio real per transparencies complexes, valorar z-buffer/WebGL o ordenacio per tile mes fina.
- Si cal que `Manual` sigui igual de fluid, caldria convertir-lo en un flux d'export amb durada definida o afegir una opcio nova; la captura live sempre pot tenir duplicats si el navegador no manté el ritme.
- Si el deploy de Pixel Perfect no s'actualitza sol, revisar l'estat del deployment associat a `strk04/PIxel-Perfect`.

## Riscos / notes

- La malla es pinta amb una aproximacio 2.5D. Ara, amb `Oculta text posterior`, els glifs posteriors es descarten abans de pintar.
- `cube` usa una superficie tipus `box` per pintar també cares superior/inferior, mentre que els glifs del mode `cube` continuen amb el mapatge existent.
- Durant morphing, les guies usen una graella paramètrica comuna en lloc de les guies especifiques de la forma base; aixi eviten quedar congelades mentre la forma canvia.
