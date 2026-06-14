# Decisions — SHAPER 001

## 2026-06-15 — Formes planes: dos bugs estructurals a `engine.js`

**Bug A** (`plane` surfaceMap eix equivocat): el `default` case posava els glifs al pla XY (`y=(v-0.5)*S*aspect, z=0`) però la guia dibuixava el rectangle al pla XZ (`y=0, z=(v-0.5)*S*aspect`). Resultat: glifs i guia en planes completament disfasades. Correcció: el cas `plane` ara usa `z=(v-0.5)*S*aspect, y=0, ny=1`.

**Bug B** (`surfaceFlowU` sense límit per formes planes): `surfaceFlowU = time * spd * 0.12` creix indefinidament. Per cilindres, `u>1` fa wrap natural (funcions periòdiques). Per planes, `x=(u-0.5)*S` → `u=5` → `x=720px` fora de canvas. Correcció: `IS_FLAT ? flowU=0 : flowU=surfaceFlowU`.

## 2026-06-15 — Motion 2D post-processing en `layout()`
Els 10 nous modes s'apliquen com a post-processament sobre l'array `lines[]` retornat per `layout()`, en lloc d'integrar-se al loop principal. Motiu: el loop principal ja gestiona `rain` i `flow` amb lògica de tiling; els modes nous operen sobre posicions finals i és més net separar-los.

## 2026-06-15 — Pla / Ondulat: revert del fast-path incondicional
La sessió anterior havia afegit `P3.form === 'plane' || P3.form === 'wave-plane'` a la condició 2D fast-path de `buildScene`, provocant que mai renderitzessin en 3D. Revertit a la condició original (`mode !== '3d' && is2DPath(P3)`). L'is2DPath cobreix el cas de compatibilitat (Node/back-compat sense mode).

## 2026-06-15 — Stagger: period fix en lloc de dinàmic
El period de `stagger` era `f(lines.length)` i s'alterava en canviar fontSize/leading. Decisió: period fix 3s, delay per fila basat en `line.y / height` (posició visual) en lloc d'índex de línia. Avantatge: estable i no afectat pel buffer de línies off-canvas.

## 2026-06-12 — Documentació sincronitzada amb Obsidian
Cada projecte manté docs/ (README, STATUS, progress, decisions) sincronitzada cap al vault Obsidian (00 Obsidian/B1) via hook SessionEnd.
