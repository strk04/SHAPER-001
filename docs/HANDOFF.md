# HANDOFF - SHAPER 001

_Actualitzat: 2026-07-01_

## Què ha canviat (última sessió)

- Creat `CLAUDE.md` al projecte amb instrucció de sync dual Shaper + PP automàtic.
- Proposta de summary/changelog per als canvis recents.

## Estat actual

- Director simplificat: efectes concrets (Àtom, Forma 3D, Càmera, Moviment 3D) en lloc de behaviors.
- Presets creatius complets amb `preset-state.js`.
- Export MP4 offline frame-exact.
- Superfície 3D configurable (color, transparència, oclusió).
- Guies amb colors propis i capa darrere/davant.
- SHAPER commitat i pujat (`66514db`).
- PP: fitxers editats i tests OK (27/27), però `git commit`/`git push` bloquejats pel classificador d'auto-mode. L'usuari ha de fer-ho manualment:
  ```
  cd "02 Pixel Perfect/shaper"
  git add director.js director-ui.js main.js styles.css tests/project-wiring.test.mjs
  git commit -m "feat: replace Director moviment with concrete effects list"
  git push
  ```

## Verificació

```bash
node --test tests/*.mjs   # 49 pass (SHAPER)
```

## Fitxers clau

- `director.js`, `director-ui.js`, `main.js`, `styles.css`
- `preset-state.js`, `engine.js`, `export-video.js`
- `tests/director.test.mjs`, `tests/project-wiring.test.mjs`

## Següent pas

- Confirmar commit+push manual a PP.
- `engine.js`/`motion.js` conserven `applyMotionBehaviors` com a codi mort — netejar si es vol.
