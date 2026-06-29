# HANDOFF - SHAPER 001

_Actualitzat: 2026-06-29_

## Que ha canviat

- Afegit color de superficie 3D configurable a `Colors`.
- Afegit slider `Transparencia superficie` (`0` opac, `1` invisible), amb valor per defecte `0.25`.
- `engine.js` genera una malla de quads per a totes les formes 3D i la pinta entre el text posterior i el text frontal.
- L'export SVG serialitza les mateixes capes: `text-back`, `surface`, `text-front`.
- Els presets capturen i restauren `surfaceColor` i `surfaceTransparency`.
- Afegits tests de motor i wiring.
- Canvis sincronitzats i pujats també a `02 Pixel Perfect/shaper/` (`0fba175`).

## Estat actual

- La superficie es veu per defecte en gris clar translucid (`#d8d8d8`, transparencia `0.25`).
- En formes tancades, la superficie tapa la tipografia de la part posterior segons l'opacitat.
- En formes obertes, la mateixa logica funciona com una lamina acolorida.
- Verificacio visual local feta amb `php -S 127.0.0.1:8097`: controls visibles i canvas renderitzat.

## Verificacio feta

```bash
node --check engine.js
node --check main.js
node --test tests/*.test.mjs   # 37 pass
```

## Fitxers importants

- [engine.js](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/engine.js)
- [main.js](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/main.js)
- [index.html](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/index.html)
- [tests/surface-fill.test.mjs](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/tests/surface-fill.test.mjs)
- [tests/project-wiring.test.mjs](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/tests/project-wiring.test.mjs)

## Seguent pas util

- Si cal mes qualitat d'oclusio, revisar formes amb normals aproximades (`boy-surface`, `roman-surface`, etc.) i formes morfejades amb tapes.
- Si el deploy de Pixel Perfect no s'actualitza sol, revisar l'estat del deployment associat a `strk04/PIxel-Perfect`.

## Riscos / notes

- La malla es pinta amb una aproximacio 2.5D: text posterior, superficie, text frontal. Es suficient per l'efecte demanat, pero no es un z-buffer real.
- `cube` usa una superficie tipus `box` per pintar també cares superior/inferior, mentre que els glifs del mode `cube` continuen amb el mapatge existent.
