# HANDOFF - SHAPER 001

_Actualitzat: 2026-07-01_

## Què ha canviat (última sessió)

- **Secció 2D v1 construïda des de zero** (`panel-2d` era buit fins ara). Graella real N files ×
  M columnes; el text de l'Àtom flueix i s'ajusta automàticament per omplir-la; cada fila i cada
  columna pot tenir la seva pròpia animació (o aplicar-ne una a totes). 5 animacions portades del
  "Stacked Text Tool" de referència: wave, accordion, cascade, warpflow, block (aquesta última en
  versió v1 simplificada, sense la fase de "push").
- Nou mòdul `engine2d.js` (pur, independent del pipeline 3D), 10 tests nous.
- `state.mode` torna a ser commutable 2D/3D; `render()` bifurca; `applyPreset()` restaura el mode
  real en lloc de forçar sempre `'3d'`.
- Revisió d'accessibilitat en dues passades va detectar i corregir: labels `#1`/`#2` sense context
  d'eix (canviat a "Fila 1"/"Columna 1"), i pèrdua de focus en reconstruir els selectors dinàmics
  quan es canviava el nombre de files/columnes mentre un `<select>` tenia el focus.
- **Nota**: la segona revisió d'accessibilitat va aplicar els fixos i fer `git commit`+`push` pel
  seu compte (consistent amb la instrucció global d'auto-commit, executat per l'agent en lloc de
  la sessió principal) — verificat després que els tests seguien passant.
- Vegeu `docs/decisions.md`/`docs/progress.md` (entrades 2026-07-01) per detall complet, incloent
  les 3 decisions de disseny preguntades explícitament a l'usuari.
- Sincronitzat i pujat a tots dos repos: `strk04/SHAPER-001` (`7d653bd`) i `strk04/PIxel-Perfect`
  (`c3b9c4e`). `node --test tests/*.mjs` → 32 pass (Shaper) / 27 pass (mirall PP).

## Estat actual

- Secció 2D: graella files×columnes amb 5 animacions, funcional però sense validació visual real
  al navegador (només tests unitaris de la matemàtica).
- Export SVG/PNG/MP4 encara **no** adaptat a 2D — sempre surt del pipeline 3D independentment del
  mode actiu.
- Sense funció Director (eliminada sessions anteriors). Perspectiva optimitzada. Presets no
  interrompen la navegació.

## Verificació

```bash
node --test tests/*.mjs   # 32 pass (Shaper)
```

## Fitxers clau

- `engine2d.js` (nou), `main.js`, `engine.js`, `index.html`, `preset-state.js`
- `tests/engine2d.test.mjs` (nou), `tests/project-wiring.test.mjs`, `tests/preset-state.test.mjs`,
  `tests/surface-fill.test.mjs`, `tests/motion.test.mjs`

## Següent pas

- **Decidir si cal completar el "Block In"** amb la fase de push (cua que empeny en bucle) o si la
  v1 simplificada (només arribada seqüencial) ja serveix.
- Adaptar l'export (SVG/PNG/MP4) perquè funcioni des del mode 2D.
- Validació visual real al navegador de la graella i les 5 animacions.
- `engine.js`/`motion.js` conserven `applyMotionBehaviors`/`motionBehaviors` com a codi mort, previ
  al Director — netejar-ho és una tasca separada i opcional.
