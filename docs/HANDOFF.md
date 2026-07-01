# HANDOFF - SHAPER 001

_Actualitzat: 2026-07-01_

## Què ha canviat (última sessió)

- L'usuari ha preguntat per què `Projecció: Perspectiva` va molt més lent que `Isomètrica`, i
  després si hi havia solució.
- Diagnosi: en mode Billboard, cada glif té una mida de font diferent segons la profunditat (efecte
  de perspectiva real). El bucle de dibuix reassignava `ctx.font` a cada glif encara que la mida no
  hagués canviat, forçant re-resolucions de font innecessàries al navegador.
- Fix a `engine.js` `drawGlyph()`: la mida es arrodoneix a mig píxel i `ctx.font` només es reassigna
  quan canvia respecte al valor anterior (`lastFs`). Imperceptible visualment, redueix el nombre de
  re-resolucions per frame.
- Abans d'això, sessió prèvia: eliminada tota la funcionalitat Director (vegeu entrades anteriors a
  `docs/progress.md`/`docs/decisions.md`).
- Sincronitzat i pujat a tots dos repos: `strk04/SHAPER-001` (`eef99b4`) i `strk04/PIxel-Perfect`
  (`5b2a3e0`). `node --test tests/*.mjs` → 21 pass (Shaper) / 16 pass (mirall PP).

## Estat actual

- Sense funció Director (eliminada).
- Perspectiva optimitzada per reduir cost de `ctx.font`, però encara inherentment més cara que
  Isomètrica (fugida de perspectiva = mida variable per glif, no es pot eliminar del tot).
- Export MP4: `Manual` i durades fixes (5/10/15/30s), ambdós en temps real.

## Verificació

```bash
node --test tests/*.mjs   # 21 pass (Shaper)
```

## Fitxers clau

- `main.js`, `engine.js`, `styles.css`, `preset-state.js`
- `tests/project-wiring.test.mjs`, `tests/preset-state.test.mjs`, `tests/surface-fill.test.mjs`,
  `tests/motion.test.mjs`

## Següent pas

- Validació visual/de rendiment real al navegador amb un preset pesat en Perspectiva per confirmar
  la millora percebuda (no s'ha mesurat FPS abans/després, només raonada i aplicada la correcció).
- `engine.js`/`motion.js` conserven `applyMotionBehaviors`/`motionBehaviors` com a codi mort, previ
  al Director — netejar-ho és una tasca separada i opcional.
- Revisar deployment de Pixel Perfect si cal confirmar publicació web.
