# HANDOFF — SHAPER 001

_Actualitzat: 2026-06-29_

## Estat actual

Director s’ha simplificat per a ús no-live:

- fora `ATTRACT`, `REPEL`, `EXPLODE`
- fora `REC`
- fora tota la maquinària interna de live overrides i gesture recording

Queden:

- escenes
- durada i transició per escena
- comportaments (`Deriva`, `Òrbita`, `Atracció`, `Explosió`)
- keyframes / rombos
- transport normal (`Atura`, `Hold`, `Reverse`, `Loop`, `Timeline`)

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

## Verificació feta

```bash
node --test tests/director.test.mjs
node --test tests/project-wiring.test.mjs
node --test tests/*.test.mjs
node --check main.js
node --check director.js
node --check director-ui.js
```

Resultat: 29 tests pass.

## Estat git

Canvis locals pendents de commit/push:

- `director.js`
- `director-ui.js`
- `index.html`
- `main.js`
- `styles.css`
- `tests/director.test.mjs`
- `tests/project-wiring.test.mjs`
- `docs/HANDOFF.md`
- `docs/STATUS.md`
- `docs/progress.md`
- `docs/decisions.md`

## Properes passes recomanades

1. Verificació visual ràpida del panell Director després de la simplificació.
2. Decidir si els rombos s’han de veure només dins la pestanya `Director`.
3. Millora pendent guardada: veure clarament `temps`, `valor` i `easing` dels keyframes.

## Riscos / notes

- `Hold` i `Reverse` continuen existint; no són live, però encara poden ser conceptualment confusos.
- La documentació històrica de `docs/superpowers/` encara parla de live recording perquè és l’especificació original, no l’estat actual del producte.
