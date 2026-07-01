# HANDOFF - SHAPER 001

_Actualitzat: 2026-07-01_

## Què ha canviat (última sessió)

- Bug real a la secció 2D detectat per l'usuari: les animacions de fila/columna només
  redimensionaven el rectangle de retall (`ctx.clip()`), no l'àtom mateix — el text es dibuixava
  sempre a `fontSize` fix i quedava revelat/amagat en lloc d'escalar-se visiblement.
- Fix a `engine2d.js` `drawGrid2D()`: `ctx.scale(colScale, rowScale)` s'aplica abans de dibuixar
  els glifs; `layout()` es crida sempre amb la mida BASE (no escalada) de la cel·la perquè el
  word-wrap es mantingui estable i només la mida visual canviï. El retall es fa després de
  l'escalat, així que la vora escala junt amb l'àtom.
- Test de regressió nou verifica que `ctx.scale()` es crida amb el `rowScale`/`colScale` real.
- Vegeu `docs/decisions.md`/`docs/progress.md` (entrada 2026-07-01) per detall.
- Sincronitzat i pujat: `strk04/SHAPER-001` (`9bab921`) i `strk04/PIxel-Perfect` (`27f89a3`).
  `node --test tests/*.mjs` → 35 pass (Shaper) / 30 pass (mirall PP).

## Estat actual

- Secció 2D: graella files×columnes, text de l'Àtom repetit a cada cel·la amb tots els paràmetres
  actius, ara l'animació escala l'àtom visiblement (no només el contenidor). Toggle de graella.
  Encara sense validació visual real al navegador.
- Export SVG/PNG/MP4 encara **no** adaptat a 2D.
- "Block In" continua en versió v1 simplificada (sense fase de push).

## Verificació

```bash
node --test tests/*.mjs   # 35 pass (Shaper)
```

## Fitxers clau

- `engine2d.js`, `main.js`, `engine.js`, `index.html`, `preset-state.js`
- `tests/engine2d.test.mjs`, `tests/project-wiring.test.mjs`

## Següent pas

- Validació visual real al navegador: confirmar que l'àtom ara s'escala visiblement amb wave/
  accordion/cascade, i que warpflow/block es veuen bé.
- Decidir si cal completar el "Block In" amb la fase de push.
- Adaptar l'export (SVG/PNG/MP4) perquè funcioni des del mode 2D.
- Mesurar rendiment amb graelles grans (`layout()` es crida sencer per cel·la) si l'usuari en
  reporta lentitud.
- `engine.js`/`motion.js` conserven `applyMotionBehaviors`/`motionBehaviors` com a codi mort, previ
  al Director — netejar-ho és una tasca separada i opcional.
