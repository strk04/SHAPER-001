# HANDOFF - SHAPER 001

_Actualitzat: 2026-07-01_

## Què ha canviat (última sessió)

- Director reescrit: model d'escenes eliminat, ara és una única línia temporal contínua
  (`{ enabled, loop, duration, automations }`). Vegeu `docs/decisions.md` (2026-07-01) i
  `docs/progress.md` per detall complet de fitxers tocats.
- `director-ui.js`: radiogroup d'escenes → un únic `#directorTrack` (`role="slider"`, seekable per
  pointer i teclat), revisat amb accessibility-lead abans del canvi de CSS.
- Sincronitzat i pujat a tots dos repos: `strk04/SHAPER-001` (`5365602`) i `strk04/PIxel-Perfect`
  (`ec932f5`). `node --test tests/*.mjs` → 46 pass (Shaper) / 41 pass (mirall PP).

## Estat actual

- Director: línia temporal única, efectes concrets (Àtom, Forma 3D, Càmera, Moviment 3D) amb
  keyframes col·locats directament sobre la línia.
- Export MP4 offline frame-exact (sense canvis aquesta sessió).
- Superfície 3D configurable (color, transparència, oclusió) (sense canvis aquesta sessió).
- Guies amb colors propis i capa darrere/davant (sense canvis aquesta sessió).

## Verificació

```bash
node --test tests/*.mjs   # 46 pass (Shaper)
```

## Fitxers clau

- `director.js`, `director-ui.js`, `main.js`, `styles.css`
- `preset-state.js`, `engine.js`, `export-video.js`
- `tests/director.test.mjs`, `tests/director-ui.test.mjs`, `tests/project-wiring.test.mjs`

## Següent pas

- L'usuari indicarà quins efectes concrets vol poder aplicar sobre la línia temporal i com es
  comporten (propera instrucció esperada).
- Trencament de compatibilitat conegut: presets antics amb `scenes` es carreguen sense error però
  perden el contingut animat (`duration` cau a `5`, `automations` buit). Sense migrador — no hi ha
  presets amb Director en producció encara.
- `engine.js`/`motion.js` conserven `applyMotionBehaviors` com a codi mort — netejar si es vol.
