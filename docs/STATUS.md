# STATUS — SHAPER 001

_Actualitzat: 2026-06-29_

## Estat general

Projecte vanilla JS zero-build. Flux habitual de publicació:

- editar a `17 SHAPER 001/`
- sincronitzar a `02 Pixel Perfect/shaper/`
- commit + push als dos repos

## Motion Director

Director està simplificat per a ús no-live i actualment inclou:

- activació global
- escenes
- durada per escena
- transició + easing per escena
- un únic moviment visible per escena
- ajustos del moviment a la columna 2
- keyframes / automatització
- controls globals `Reverse` i `Loop`
- timeline inline sota el canvas, a la columna 3
- indicador de temps del timeline sincronitzat amb la reproducció

Ja no hi ha:

- `ATTRACT`, `REPEL`, `EXPLODE`
- `REC`
- `Atura`
- `Hold`
- dock inferior de timeline
- resize handle del timeline
- botó `Timeline` a la columna 2

## Verificació actual

Última verificació executada el 2026-06-29:

```bash
node --test tests/*.test.mjs   # 34 pass
node --check main.js
node --check director.js
node --check director-ui.js
```

## Pendent

- Validació visual ràpida del timeline inline nou.
- Decidir si més endavant la timeline ha de mostrar keyframes de totes les escenes o només de l’escena activa.
- Millora futura pendent: guies visuals dels ajustos de moviment (target, radius, centre, vector...).
