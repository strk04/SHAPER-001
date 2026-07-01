# HANDOFF - SHAPER 001

_Actualitzat: 2026-07-01_

## Què ha canviat (última sessió)

- L'usuari va compartir captures de referència (patrons de text repetit dens, mides variables,
  fluid) i va dir que la nostra secció 2D és "bàsica i pobra" en comparació. Preguntat què calia
  millorar (densitat / mida per repetició / fluïdesa) — va marcar els 3.
- **Nou pack dens per-instància**: cada cel·la de la graella (files×columnes, sense canvis) pot
  subdividir-se en `density×density` repeticions independents (control `Densitat`, 1-6). Cada
  instància oscil·la amb una fase pròpia (seeded, no sincronitzada), controlada pel slider
  `Variació de mida` (0-1) — dona la sensació orgànica dels exemples en lloc d'un bloc en bloc.
  Amb `density=1`/`sizeVariance=0` (defaults) el resultat és idèntic a abans.
- Vegeu `docs/decisions.md`/`docs/progress.md` (entrada 2026-07-01) per detall complet.
- Sincronitzat i pujat: `strk04/SHAPER-001` (`a3818c1`) i `strk04/PIxel-Perfect` (`b76c9e4`).
  `node --test tests/*.mjs` → 39 pass (Shaper) / 34 pass (mirall PP).

## Estat actual

- Secció 2D: graella files×columnes + pack dens per-instància amb variació orgànica de mida.
  L'animació escala l'àtom real (no només el contenidor). Toggle de graella. Encara sense
  validació visual real al navegador.
- Export SVG/PNG/MP4 encara **no** adaptat a 2D. "Block In" continua en versió v1 simplificada.

## Verificació

```bash
node --test tests/*.mjs   # 39 pass (Shaper)
```

## Fitxers clau

- `engine2d.js`, `main.js`, `engine.js`, `index.html`, `preset-state.js`
- `tests/engine2d.test.mjs`, `tests/project-wiring.test.mjs`

## Següent pas

- **Validació visual real al navegador** — prioritari: confirmar que el pack dens + variació de
  mida s'acosta al mood de les captures de referència (densitat, mida, fluïdesa).
- Mesurar rendiment amb densitat alta + graelles grans (`layout()` es crida `rows×cols×density²`
  cops per frame).
- Decidir si cal completar el "Block In" amb la fase de push.
- Adaptar l'export (SVG/PNG/MP4) perquè funcioni des del mode 2D.
- `engine.js`/`motion.js` conserven `applyMotionBehaviors`/`motionBehaviors` com a codi mort, previ
  al Director — netejar-ho és una tasca separada i opcional.
