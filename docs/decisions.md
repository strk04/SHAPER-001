# Decisions — SHAPER 001

## 2026-06-15 (sessió 4) — paramSpeed: warp sinusoïdal vs blend ArcLUT

Primera implementació: `u = uArc*(1-ps) + rawU*ps`. No funcionava per formes circulars perquè `arcLUT(u) ≈ u` quan la curvatura és uniforme → blend ≈ no-op.

Solució: warp monotó sobre posició de pantalla `tW = t01 - K·sin(N·2π·t01)` amb `K = 0.85/(N·2π)` (garanteix monotonia: derivada mín 0.15 > 0). `N=4` → 4 zones denses per revolució. Funciona a totes les formes independentment de la seva curvatura.

## 2026-06-15 (sessió 4) — noiseTexture: domain warp vs dropout vs opacitat

Tres implementacions per "zones amb més densitat de caràcters":
1. Dropout (skip glif si `valueNoise < threshold`) → rebutjat, "no vull treure".
2. Opacitat fBm per glif (`noiseAlpha`) → rebutjat, "no vull opacitat".
3. Domain warp UV: `wu = u + (fbm2D(…)-0.5)*str` abans de `surfaceMap` → desplaçament físic de posició → clustering real. **Acceptat.** str=0.7 (exagerat a petició per fer-ho visible).

Nota PRNG: `rainRoll` i `rainPhase` moguts abans del warp per mantenir ordre de consum fix.

## 2026-06-15 (sessió 4) — Character Map: build lazy, font independent del canvas

El panel no es construeix fins al primer click. ~2800 botons en 23 blocs → cost one-time acceptable al primer accés. Font selector independent de `state.font` (no afecta el canvas en fer browse del mapa).

## 2026-06-15 (sessió 4) — Fork audioreactiu com a còpia física independent

`18 SHAPER 002` és una còpia física de tots els fitxers de `17 SHAPER 001`. `.git` reinicialitzat buit (sense remote) per evitar push accidental a `strk04/SHAPER-001`. Les dues apps no comparteixen cap fitxer ni repositori.



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
