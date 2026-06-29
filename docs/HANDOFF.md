# HANDOFF — SHAPER 001

_Actualitzat: 2026-06-29_

## Estat actual

Director s’ha simplificat per a ús no-live:

- fora `ATTRACT`, `REPEL`, `EXPLODE`
- fora `REC`
- fora tota la maquinària interna de live overrides i gesture recording
- fora `Atura` i `Hold`

Queden:

- escenes
- durada i transició per escena
- un únic moviment visible per escena (`Deriva`, `Òrbita`, `Atracció`, `Explosió`)
- keyframes / rombos
- controls generals (`Reverse`, `Loop`, `Timeline`) al final de la columna 2
- accions d'escena mínimes (`Nova escena`, `Eliminar`)

## Canvis d’aquesta sessió

- `index.html`
  - eliminat `#directorLivePads`
  - eliminat botó `#directorRecord`
- `main.js`
  - eliminat estat live (`directorLiveOverrides`, `directorRecording`, `directorRecordedSamples`, `directorActiveLive`)
  - eliminat wiring de `REC` i live pads
  - `evaluateDirector()` es crida sense overrides live
- `director-ui.js`
  - eliminat `mountLivePads()`
- `director.js`
  - eliminat `simplifySamples()`
  - `evaluateDirector()` simplificat: sense paràmetre `liveOverrides`
- `styles.css`
  - eliminats estils de live pads
- `tests/`
  - afegit test que garanteix que Director ja no exposa controls live
  - eliminat el test de `simplifySamples()`
- `director-ui.js`
  - afegit bloc `General` al final de la columna 2 amb `Reverse`, `Loop` i `Timeline`
- `index.html`
  - eliminats `Atura`, `Hold`, `Reverse`, `Loop` i `Timeline` del dock
- `main.js`
  - eliminat wiring de `Atura` i `Hold`
- `styles.css`
  - eliminat CSS antic de `director-transport`
- `tests/project-wiring.test.mjs`
  - afegit test que garanteix que els controls generals viuen a la columna 2 i no al dock
- `docs/superpowers/specs/2026-06-29-director-scene-layout-design.md`
  - escrita la spec per a la nova jerarquia visual de la columna 2 del Director
- `docs/superpowers/plans/2026-06-29-director-scene-layout-implementation.md`
  - escrit el pla d’implementació i executat inline
- `director-ui.js`
  - eliminat el mini-playhead de la columna 2
  - `Activa` passa a `Activa mode Director`
  - `Nova escena` passa a viure fora de la fitxa d’escena
  - la fitxa activa mostra només `Moviment`, `Durada total`, `Durada transició`, `Estil transició` i `Eliminar`
- `director.js`
  - afegit `setSceneMovement()` per reduir cada escena a un únic moviment visible i netejar automatitzacions de comportament antigues
- `main.js`
  - afegit wiring per al desplegable `Moviment`
  - el moviment seleccionat torna a exposar ajustos propis via `onUpdateBehavior`
- `styles.css`
  - nous blocs `.director-scene-toolbar` i `.director-scene-card`
  - eliminat CSS orfe de la fitxa antiga de comportaments
  - `Durada total` i `Durada transició` ara mostren `seg` inline a la dreta del camp
  - els dos inputs de durada comparteixen ara la mateixa amplada fixa
  - nou bloc `.director-movement-settings` per als ajustos del moviment actiu
- `tests/project-wiring.test.mjs`
  - afegit test que blinda la nova jerarquia de la columna 2 del Director
  - ampliat per blindar el patró `input + seg` a les dues durades
  - ampliat perquè `Moviment` segueixi desplegant paràmetres i ajustos

## Verificació feta

```bash
node --test tests/director.test.mjs
node --test tests/project-wiring.test.mjs
node --test tests/*.test.mjs
node --check main.js
node --check director.js
node --check director-ui.js
```

Resultat: 33 tests pass.

## Estat git

Canvis locals pendents de commit/push:

- `director-ui.js`
- `director.js`
- `main.js`
- `styles.css`
- `tests/project-wiring.test.mjs`
- `docs/HANDOFF.md`
- `docs/STATUS.md`
- `docs/progress.md`
- `docs/decisions.md`
- `docs/superpowers/plans/2026-06-29-director-scene-layout-implementation.md`

## Properes passes recomanades

1. Verificació visual ràpida del nou flux de columna 2 (`Activa` → `Nova escena` → fitxa activa → ajustos del moviment → `General`).
2. Decidir si els rombos s’han de veure només dins la pestanya `Director`.
3. Valorar si el desplegable `Moviment` ha de permetre també un estat “cap”.
4. Revisar si `seg` inline té prou aire visual al costat del camp.
5. Millora pendent guardada: veure clarament `temps`, `valor` i `easing` dels keyframes.

## Actualització addicional

També s’han eliminat de la UI d’escena els botons:

- `Duplica`
- `←`
- `→`

I ara la fitxa queda reduïda a `Moviment`, els seus ajustos, durades, easing i `Eliminar`, mentre `Nova escena` viu fora de la fitxa.

## Riscos / notes

- `Reverse` i `Loop` continuen sent globals del Director, no per-escena.
- La documentació històrica de `docs/superpowers/` encara parla de live recording perquè és l’especificació original, no l’estat actual del producte.
