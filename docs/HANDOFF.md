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
- comportaments (`Deriva`, `Òrbita`, `Atracció`, `Explosió`)
- keyframes / rombos
- controls generals (`Reverse`, `Loop`, `Timeline`) al final de la columna 2
- accions d'escena mínimes (`Afegeix`, `Elimina`)
- spec nova escrita per reordenar la fitxa d’escena de la columna 2

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

## Verificació feta

```bash
node --test tests/director.test.mjs
node --test tests/project-wiring.test.mjs
node --test tests/*.test.mjs
node --check main.js
node --check director.js
node --check director-ui.js
```

Resultat: 31 tests pass. La spec nova encara no implica canvis de codi.

## Estat git

Canvis locals pendents de commit/push:

- `director-ui.js`
- `index.html`
- `main.js`
- `styles.css`
- `tests/project-wiring.test.mjs`
- `docs/HANDOFF.md`
- `docs/STATUS.md`
- `docs/progress.md`
- `docs/decisions.md`

## Properes passes recomanades

1. Verificació visual ràpida del panell Director després del trasllat de controls generals.
2. Si l’usuari valida la spec `2026-06-29-director-scene-layout-design.md`, implementar-la.
3. Decidir si els rombos s’han de veure només dins la pestanya `Director`.
4. Millora pendent guardada: veure clarament `temps`, `valor` i `easing` dels keyframes.

## Actualització addicional

També s’han eliminat de la UI d’escena els botons:

- `Duplica`
- `←`
- `→`

L’inspector d’escena queda reduït a `Afegeix` i `Elimina`.

## Riscos / notes

- `Reverse` i `Loop` continuen sent globals del Director, no per-escena.
- La documentació històrica de `docs/superpowers/` encara parla de live recording perquè és l’especificació original, no l’estat actual del producte.
