# HANDOFF - SHAPER 001

_Actualitzat: 2026-06-29_

## Que ha canviat

- Quan `Morph` esta actiu, les guies 3D tambe fan morphing: passen pel mateix blend parametric de superficie que la forma.
- Afegit selector `Capa guies` amb opcions `Darrere` i `Davant`; per defecte continua a `Darrere`.
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

- La superficie es veu per defecte en gris clar translucid (`#d8d8d8`, transparencia `0.25`).
- Amb morph actiu, les guies canvien de geometria amb el blend de forma.
- Les guies poden quedar visualment darrere o davant de la superficie i la tipografia.
- En formes tancades, la superficie pot ser translucida pero la tipografia posterior queda oculta si `Oculta text posterior` esta actiu.
- En formes obertes, la mateixa logica funciona com una lamina acolorida.
- Verificacio visual local feta amb `php -S 127.0.0.1:8097`: controls visibles, reset de forma comprovat i canvas renderitzat.

## Verificacio feta

```bash
node --check engine.js
node --check main.js
node --test tests/*.test.mjs   # 42 pass
```

## Fitxers importants

- [engine.js](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/engine.js)
- [main.js](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/main.js)
- [index.html](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/index.html)
- [tests/surface-fill.test.mjs](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/tests/surface-fill.test.mjs)
- [tests/project-wiring.test.mjs](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/tests/project-wiring.test.mjs)

## Seguent pas util

- Si cal mes qualitat d'oclusio real per transparencies complexes, valorar z-buffer/WebGL o ordenacio per tile mes fina.
- Si el deploy de Pixel Perfect no s'actualitza sol, revisar l'estat del deployment associat a `strk04/PIxel-Perfect`.

## Riscos / notes

- La malla es pinta amb una aproximacio 2.5D. Ara, amb `Oculta text posterior`, els glifs posteriors es descarten abans de pintar.
- `cube` usa una superficie tipus `box` per pintar també cares superior/inferior, mentre que els glifs del mode `cube` continuen amb el mapatge existent.
- Durant morphing, les guies usen una graella paramètrica comuna en lloc de les guies especifiques de la forma base; aixi eviten quedar congelades mentre la forma canvia.
