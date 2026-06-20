# HANDOFF — SHAPER 001

_Actualitzat: 2026-06-20_

## Estat actual

L’aplicació existent continua estable i sense canvis funcionals en aquesta sessió. S’ha aprovat el disseny del nou **Motion Director**: escenes, comportaments generatius, cohesió regulable, keyframes i intervenció en viu, tot determinista i exportable.

## Següent pas immediat

- El disseny ja està aprovat i el pla executable és a `docs/superpowers/plans/2026-06-20-motion-director-implementation.md`.
- Triar mode d’execució: subagents per tasca amb revisió entre fases, o execució inline amb checkpoints.
- Començar per Task 1 amb TDD; no saltar directament a la UI.

## Decisions clau

- Model híbrid: escenes + automatització opcional + pads en viu.
- Comportaments v1: deriva, òrbita, atracció/repulsió i explosió/reagrupament.
- Cohesió `0–1`: de caràcters independents a objecte rígid.
- Moviment analític basat en temps absolut i seed; cap física integrada entre frames.
- UI: pestanya Director, inspector contextual i timeline inferior col·lapsable.

## Fitxers importants

- Especificació: `docs/superpowers/specs/2026-06-20-motion-director-design.md`.
- Pla: `docs/superpowers/plans/2026-06-20-motion-director-implementation.md`.
- Implementació actual: `main.js`, `engine.js`, `index.html`, `styles.css`.
- Flux de deploy: editar aquí → copiar a `02 Pixel Perfect/shaper/` → push PP001.

## Riscos i pendents previs

- El Director és una ampliació gran: implementar per fases i conservar el fast path actual quan està desactivat.
- La branca `main` conté el commit documental `09e4e0f` i encara no s’ha fet push.
- Encara resten la validació visual de formes 3D/`noiseTexture` i la revisió del contrast de `--rule`.
- No hi ha cap diff pendent a `engine.js`; l’avís anterior era obsolet.
