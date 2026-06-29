# HANDOFF — SHAPER 001

_Actualitzat: 2026-06-29_

## Què ha canviat

- El timeline del Director ja no viu en un dock inferior separat.
- Ara es renderitza dins la columna 3, sota el canvas, a tota l’amplada disponible.
- El botó `Timeline` ha desaparegut de la columna 2.
- `Reverse` i `Loop` es mantenen com a controls globals del Director.
- Els keyframes del timeline es mostren en format mínim: rombo + `paràmetre` + `valor`.
- S’ha eliminat tota la lògica antiga de `directorDock`, `directorResize` i `directorCollapse`.
- Ajust posterior de poliment:
  - fora el text `Sense rombos en aquesta escena.`
  - `E01 / E02 / ...` passen a mida de text normal del sistema
  - la bola del timeline torna a seguir el temps real del Director durant la reproducció
  - el botó `Loop` queda invertit (negre/blanc) quan està actiu
- Nova fase del timeline usable:
  - clic a un rombo = seleccionar i editar
  - botó dret sobre rombo = menú contextual `Eliminar`
  - el rombo seleccionat obre fitxa d’edició a la columna 2 (`valor`, `temps`, `easing`)
  - el playhead del timeline es pot arrossegar endavant i endarrere
  - separadors d’escena corregits perquè no es vegin duplicats

## Estat actual

- Director continua funcionant amb:
  - escenes
  - durada i transició per escena
  - un únic moviment visible per escena (`Deriva`, `Òrbita`, `Atracció`, `Explosió`)
  - ajustos del moviment desplegats a la columna 2
  - automatització / rombos
  - controls globals `Reverse` i `Loop`
- El timeline nou és inline i només es mostra quan la pestanya activa és `Director`.

## Verificació feta

```bash
node --test tests/*.test.mjs
node --check main.js
node --check director.js
node --check director-ui.js
```

Resultat: 34 tests pass, checks OK.

## Fitxers clau

- [index.html](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/index.html)
- [main.js](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/main.js)
- [director-ui.js](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/director-ui.js)
- [styles.css](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/styles.css)
- [tests/project-wiring.test.mjs](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/tests/project-wiring.test.mjs)
- [docs/superpowers/specs/2026-06-29-director-inline-timeline-design.md](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/docs/superpowers/specs/2026-06-29-director-inline-timeline-design.md)
- [docs/superpowers/plans/2026-06-29-director-inline-timeline-implementation.md](/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi%20unidad/EN%20CURS/CC/17%20SHAPER%20001/docs/superpowers/plans/2026-06-29-director-inline-timeline-implementation.md)

## Següent pas útil

- Fer una validació visual ràpida del timeline usable nou dins l’app.
- Si això queda bé, la següent iteració clara és afegir guies visuals dels moviments (`target`, `radius`, `center`, etc.).

## Riscos / notes

- Ara mateix el timeline mostra els keyframes de l’escena activa posicionats dins el tram global de la seva escena.
- Encara no hi ha drag directe dels rombos; la modificació es fa via fitxa d’edició.
