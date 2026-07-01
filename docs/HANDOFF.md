# HANDOFF - SHAPER 001

_Actualitzat: 2026-07-01_

## Què ha canviat (última sessió)

- Director: model d'escenes eliminat → línia temporal única (`{enabled, loop, duration,
  automations}`).
- Director: cada efecte passa de keyframe puntual a **segment amb Inici/Final** que manté un valor
  fix mentre el playhead hi és dins (decidit amb `AskUserQuestion`: hold, no rampa ni fade).
- Director: els 4 grups d'efectes ara són desplegables natius (`<details>/<summary>`), plegats per
  defecte.
- Timeline: cada efecte es dibuixa com una barra proporcional (no un punt), amplada mínima 24px.
- Dues revisions d'accessibilitat (accessibility-lead) abans de tocar `styles.css` en cada canvi.
- Vegeu `docs/decisions.md` i `docs/progress.md` (entrades 2026-07-01) per detall complet.
- Sincronitzat i pujat a tots dos repos: `strk04/SHAPER-001` (`0c6acf4`) i `strk04/PIxel-Perfect`
  (`0b4434e`). `node --test tests/*.mjs` → 47 pass (Shaper) / 42 pass (mirall PP).

## Estat actual

- Director: línia temporal única, efectes en desplegables, cadascun amb segments Inici/Final de
  valor fix.
- Export MP4 offline frame-exact, superfície 3D configurable, guies amb colors propis (sense canvis
  aquesta sessió).

## Verificació

```bash
node --test tests/*.mjs   # 47 pass (Shaper)
```

## Fitxers clau

- `director.js`, `director-ui.js`, `main.js`, `styles.css`
- `preset-state.js`, `engine.js`, `export-video.js`
- `tests/director.test.mjs`, `tests/director-ui.test.mjs`, `tests/project-wiring.test.mjs`,
  `tests/preset-state.test.mjs`

## Següent pas

- Decidir si la durada per defecte d'un segment nou (1s, `DEFAULT_SEGMENT_LENGTH` a
  `director-ui.js`) ha de ser configurable.
- Trencament de compatibilitat conegut i acceptat: presets antics amb `scenes` o amb keyframes
  puntuals `{time,value,easing}` es carreguen sense error però perden el contingut animat. Sense
  migrador — no hi ha presets amb Director en producció encara.
- `engine.js`/`motion.js` conserven `applyMotionBehaviors` com a codi mort — netejar si es vol.
