# HANDOFF - SHAPER 001

_Actualitzat: 2026-07-01_

## Què ha canviat (última sessió)

- Director: model d'escenes eliminat → línia temporal única.
- Director: cada efecte és un segment amb **Inici/Final** que manté un valor fix, però ara amb
  **easing d'entrada/sortida** configurable (`Easing entrada`/`Easing sortida`, segons) perquè el
  canvi no sigui brusc — reafinament de la decisió "hold pur" presa a la mateixa sessió (vegeu
  `docs/decisions.md`).
- Director: efecte "Forma" (i "Aplicació de l'àtom") ja no requereix escriure el valor a mà — l'editor
  mostra un `<select>` amb les opcions reals clonades del control de la pàgina.
- Director: els 4 grups d'efectes són desplegables natius (`<details>/<summary>`).
- Múltiples revisions d'accessibilitat (accessibility-lead) al llarg de la sessió, abans/després de
  cada canvi de markup o CSS.
- Vegeu `docs/decisions.md` i `docs/progress.md` (entrades 2026-07-01, ordre cronològic invers) per
  detall complet de cada iteració.
- Sincronitzat i pujat a tots dos repos: `strk04/SHAPER-001` (`687e52c`) i `strk04/PIxel-Perfect`
  (`858a608`). `node --test tests/*.mjs` → 52 pass (Shaper) / 47 pass (mirall PP).

## Estat actual

- Director: línia temporal única, efectes en desplegables, cada segment amb Inici/Final + easing
  d'entrada/sortida (numèrics) o selector de valor (Forma/wrapMode).
- Export MP4 offline frame-exact, superfície 3D configurable, guies amb colors propis (sense canvis
  aquesta sessió).

## Verificació

```bash
node --test tests/*.mjs   # 52 pass (Shaper)
```

## Fitxers clau

- `director.js`, `director-ui.js`, `main.js`, `styles.css`
- `preset-state.js`, `engine.js`, `export-video.js`
- `tests/director.test.mjs`, `tests/director-ui.test.mjs`, `tests/project-wiring.test.mjs`,
  `tests/preset-state.test.mjs`

## Següent pas

- Cap ramp/fade directe entre segments veïns encara — l'easing sempre va cap al/des del valor base,
  no cap al segment adjacent. Si l'usuari vol un encadenat directe, cal decisió nova.
- Decidir si `DEFAULT_SEGMENT_LENGTH` (1s) i `DEFAULT_EASE_LENGTH` (0.3s) han de ser configurables.
- Trencament de compatibilitat conegut i acceptat: presets antics (amb `scenes`, o amb keyframes
  puntuals `{time,value,easing}`) es carreguen sense error però perden el contingut animat. Sense
  migrador — no hi ha presets amb Director en producció encara.
- `engine.js`/`motion.js` conserven `applyMotionBehaviors` com a codi mort — netejar si es vol.
