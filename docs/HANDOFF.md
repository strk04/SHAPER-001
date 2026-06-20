# HANDOFF — SHAPER 001

_Actualitzat: 2026-06-20_

## Estat actual

L’aplicació existent continua estable i sense canvis funcionals en aquesta sessió. S’ha aprovat el disseny del nou **Motion Director**: escenes, comportaments generatius, cohesió regulable, keyframes i intervenció en viu, tot determinista i exportable.

## Següent pas immediat

- L’usuari ha de revisar l’especificació `docs/superpowers/specs/2026-06-20-motion-director-design.md`.
- Després de l’aprovació escrita, crear el pla d’implementació; no començar codi abans.

## Decisions clau

- Model híbrid: escenes + automatització opcional + pads en viu.
- Comportaments v1: deriva, òrbita, atracció/repulsió i explosió/reagrupament.
- Cohesió `0–1`: de caràcters independents a objecte rígid.
- Moviment analític basat en temps absolut i seed; cap física integrada entre frames.
- UI: pestanya Director, inspector contextual i timeline inferior col·lapsable.

## Fitxers importants

- Especificació: `docs/superpowers/specs/2026-06-20-motion-director-design.md`.
- Implementació actual: `main.js`, `engine.js`, `index.html`, `styles.css`.
- Flux de deploy: editar aquí → copiar a `02 Pixel Perfect/shaper/` → push PP001.

## Riscos i pendents previs

- El Director és una ampliació gran: implementar per fases i conservar el fast path actual quan està desactivat.
- Encara resten la validació visual de formes 3D/`noiseTexture` i la revisió del contrast de `--rule`.
- No hi ha cap diff pendent a `engine.js`; l’avís anterior era obsolet.
