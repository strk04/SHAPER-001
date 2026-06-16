# Decisions — SHAPER 001

## 2026-06-17 (sessió 6) — Eliminar gradient de color en favor del color d'accent

El paràmetre `colorRamp` aplicava un gradient A→B horitzontal a tots els caràcters de l'àtom. L'usuari va demanar eliminar-lo completament perquè el color d'accent (`accentMode`) és la solució correcta per al cas d'ús real: color puntual i selectiu, no un gradient uniforme.

Eliminats: `colorRamp`, `colorRampTo` (state, SLIDERS, UI, buildScene, drawScene), `lerpHex`, `parseHexColor`. Cap codi de gradient roman al projecte.

## 2026-06-17 (sessió 6) — accentT: pipeline 3D complet

`accentT` es calcula a `layout()` per caràcter. Per al path 3D, la cadena és `layout()` → `build3D()` → `buildScene()` → `drawScene()`. Cal propagar `accentT` en cada pas. Fix: `build3D` inclou `accentT: c.accentT || 0` a cada glif; `buildScene` 3D el copia a les superfícies i billboards; `drawScene` 3D usa `g.accentT` per decidir el fillStyle. Sense la propagació completa, el canvi de color no té efecte en mode 3D (el mode per defecte).

## 2026-06-17 (sessió 5) — randAtom: PRNG separat per efectes d'àtom

Els efectes `charOpacity` i `charSkew` necessiten rolls aleatoris per caràcter. Afegir-los a `rand` canviaria l'output de tots els presets existents (el número de rolls per caràcter canviaria).

Solució: `randAtom = mulberry32((seed ^ 0x9e3779b9) >>> 0)` — PRNG independent inicialitzat amb un seed diferent derivat del principal. Sempre consumeix 2 rolls per caràcter (inclús si els params són 0), de manera que la seqüència és determinista i no interfereix amb `rand`. La constant `0x9e3779b9` és el Golden Ratio hash (ben distribuïda, evita col·lisions de seed).

## 2026-06-17 (sessió 5) — maskShape: clip canvas vs filter vs per-caràcter

Tres opcions per implementar `maskShape`:
1. Per caràcter: calcular si cada caràcter és dins la forma i descartar-lo si no → no dóna tall net als extrems dels glifs.
2. SVG clipPath en `buildSVG` + canvas clip en `drawScene` → la versió canvas és la correcta per al preview.
3. **Canvas clip via `ctx.save()/clip()/restore()`**: el background es dibuixa sempre a tota la pantalla (sin clip), el clip s'aplica només als glifs. La guia meta (`guideMeta`) queda fora del clip. **Acceptat.**

SVG export no inclou el clipPath per ara (quedaria fora de l'àmbit de la sessió).

## 2026-06-17 (sessió 5) — sizeRamp: layout vs draw-time

`sizeRamp` podria afectar l'espai entre caràcters (font size diferent → amplades reals diferents). Però recalcular el layout amb mides per caràcter seria complex i lent.

Decisió: `sizeMul` afecta NOMÉS la mida dibuixada, no el layout. Els caràcters es solapen o queden separats quan `sizeRamp` és alt — efecte artístic acceptable i coherent amb l'ethos generatiu de SHAPER.

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
