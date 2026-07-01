# HANDOFF - SHAPER 001

_Actualitzat: 2026-07-01_

## Què ha canviat (última sessió)

- Presets: en carregar un preset ja no salta al panell `3D` — es queda al panell des d'on s'ha
  carregat (típicament `Presets`). `applyPreset()` ja no crida `activatePanel('panel-3d')`;
  `state.mode = '3d'` i `updateEditorVisibility()` es mantenen.
- Perspectiva: `drawGlyph()` arrodoneix la mida de font a mig píxel i evita reassignar `ctx.font`
  quan no ha canviat, reduint el cost de re-resolució de font per glif en mode Billboard.
- Prèviament: eliminada tota la funcionalitat Director (vegeu entrades anteriors a
  `docs/progress.md`/`docs/decisions.md`).
- Sincronitzat i pujat a tots dos repos: `strk04/SHAPER-001` (`9180ecf`) i `strk04/PIxel-Perfect`
  (`472c560`). `node --test tests/*.mjs` → 21 pass (Shaper) / 16 pass (mirall PP).

## Estat actual

- Sense funció Director (eliminada).
- Presets no interrompen la navegació de l'usuari canviant de panell.
- Perspectiva optimitzada per reduir cost de `ctx.font`, encara inherentment més cara que
  Isomètrica (fugida de perspectiva = mida variable per glif).
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
  la millora percebuda.
- `engine.js`/`motion.js` conserven `applyMotionBehaviors`/`motionBehaviors` com a codi mort, previ
  al Director — netejar-ho és una tasca separada i opcional.
- Revisar deployment de Pixel Perfect si cal confirmar publicació web.
