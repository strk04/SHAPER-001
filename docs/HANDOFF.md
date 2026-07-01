# HANDOFF - SHAPER 001

_Actualitzat: 2026-07-02_

## Què ha canviat (última sessió)

- L'usuari va demanar esborrar tota la secció 2D (graella files×columnes + pack dens
  per-instància, construïda la sessió anterior). Eliminada completament:
  `engine2d.js` i el seu test, el tab/panell "2D" a `index.html`, i tot el wiring/estat a
  `main.js` (`state.grid2d`, `grid2dIntensity`/`Speed`/`SizeVariance`, `renderGrid2D`,
  `wireGrid2D`, etc.). `state.mode` torna a estar sempre a `'3d'`.
- `preset-state.js` net de qualsevol referència a `grid2d`.
- Sincronitzat i pujat: `strk04/SHAPER-001` (`7c50865`) i `strk04/PIxel-Perfect` (`723a002`).
  `node --test tests/*.mjs` → 22 pass (Shaper) / 17 pass (mirall PP).

## Estat actual

- Projecte torna a tenir només Àtom + 3D (sense 2D, sense Director — tots dos eliminats a
  petició de l'usuari en sessions recents).
- 3D: pipeline complet (formes, càmera, projecció isomètrica/perspectiva, guies, superfície,
  morph). Perspectiva optimitzada (`ctx.font` no es reassigna si la mida no canvia).
- Presets: capturen/restauren estat creatiu sencer via `preset-state.js`; carregar un preset ja
  no canvia de panell actiu.

## Verificació

```bash
node --test tests/*.mjs   # 22 pass (Shaper)
```

## Fitxers clau

- `main.js`, `engine.js`, `index.html`, `preset-state.js`
- `tests/project-wiring.test.mjs`

## Següent pas

- Cap tasca pendent oberta explícitament per l'usuari en aquest moment.
- `engine.js`/`motion.js` conserven `applyMotionBehaviors`/`motionBehaviors` com a codi mort, previ
  al Director — netejar-ho és una tasca separada i opcional, no demanada encara.
