# HANDOFF - SHAPER 001

_Actualitzat: 2026-07-01_

## Què ha canviat (última sessió)

- 3 correccions sobre la v1 de la secció 2D:
  1. **El text es repeteix a cada cel·la** en lloc de repartir-se — `layoutGrid2D()` és ara pura
     geometria (sense `text`/`tokenize`).
  2. **Tots els paràmetres de l'Àtom afecten el 2D**: `drawGrid2D()` crida `layout()` (la mateixa
     funció del pipeline 3D) per cada cel·la amb l'`state` sencer, en lloc d'un `fillText` simple.
     Kerning, interlínia, soroll, opacitat/blink/mida/skew per caràcter, accents — tot funciona
     igual que a 3D. Cada cel·la es retalla (`ctx.clip()`) perquè el desbordament no envaeixi la
     veïna.
  3. **Toggle "Mostra graella"**: nou checkbox que dibuixa les vores de cada cel·la (amb l'escala
     animada aplicada).
- Vegeu `docs/decisions.md`/`docs/progress.md` (entrades 2026-07-01) per detall complet.
- Sincronitzat i pujat a tots dos repos: `strk04/SHAPER-001` (`1f6b7cc`) i `strk04/PIxel-Perfect`
  (`598a3f6`). `node --test tests/*.mjs` → 34 pass (Shaper) / 29 pass (mirall PP).

## Estat actual

- Secció 2D: graella files×columnes, text de l'Àtom repetit a cada cel·la amb tots els seus
  paràmetres actius, toggle de graella. Sense validació visual real al navegador encara.
- Export SVG/PNG/MP4 encara **no** adaptat a 2D — sempre surt del pipeline 3D.
- "Block In" segueix en versió v1 simplificada (sense fase de push).

## Verificació

```bash
node --test tests/*.mjs   # 34 pass (Shaper)
```

## Fitxers clau

- `engine2d.js`, `main.js`, `engine.js`, `index.html`, `preset-state.js`
- `tests/engine2d.test.mjs`, `tests/project-wiring.test.mjs`

## Següent pas

- Validació visual real al navegador de la graella 2D amb text llarg i diversos paràmetres Àtom
  actius.
- Decidir si cal completar el "Block In" amb la fase de push.
- Adaptar l'export (SVG/PNG/MP4) perquè funcioni des del mode 2D.
- Mesurar rendiment amb graelles grans (`layout()` es crida sencer per cel·la) si l'usuari en
  reporta lentitud.
- `engine.js`/`motion.js` conserven `applyMotionBehaviors`/`motionBehaviors` com a codi mort, previ
  al Director — netejar-ho és una tasca separada i opcional.
