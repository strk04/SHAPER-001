# Decisions — SHAPER 001

## 2026-06-17 (sessió 10) — buildGuidesData: helpers trace/isoGrid per a formes noves

Les 20 formes noves no tenien cap cas a `buildGuidesData()` (switch → `default: break`) → cap guia wireframe. Solució: dos helpers interns `trace(fixed, isV, steps)` i `isoGrid(n, steps)` que criden `surfaceMap` directament. Aixi les guies reutilitzen la mateixa fórmula que la superfície real i mai es desincronitzen. Formes amb discontinuïtats (lemniscate, dupin-cyclide degenerat) generen punts a (0,0,0) que creen artefactes menors — acceptable per a guies. Formes amb geometria característica clara (knots, Lissajous, oloid, seifert) usen corbes custom codificades directament (el spine o les circumferències definidores) perquè l'`isoGrid` mostraria el tub exterior, no la línia característica.



## 2026-06-17 (sessió 9) — accentT: 4 colors independents sense PRNG extra

Cada color (1–4) té el seu propi mode (none/seeded/alternating-word/first-letter), prob i freq. Per evitar un 4t roll del PRNG `randAtom`, es deriven 4 valors del mateix `atomAccent` via multiplicació per constants irracional (φ=1.618, √5=2.236, π=3.141). Aquests valors cobreixen [0,1) uniformement i estan suficientment decorrelacionats per a ús visual. L'avaluació és per prioritat inversa: colors 4→3→2→1, el més alt en número guanya si hi ha superposició. La guarda `hasAccent` ha estat eliminada: `accentT>0` ja implica que s'ha de usar `accentColors[accentT]`, i `accentColors[0]` és sempre `textColor`.

## 2026-06-17 (sessió 9) — blinkFade: slider 0–1 + blinkRate min 0.05 Hz

`blinkFade` era un boolean (hard blink o fade cosí complet). Convertit a slider 0–1 per control precís de la profunditat del fade. `blinkFade=0` → hard blink (comportament anterior). `blinkFade=1` → fade cosí que arriba a opacitat 0. El cosinus fa que el fade sigui perceptivament suau (no lineal). `blinkRate` min 0.05 Hz permet cicles de 20 segons per fades molt lents i atmosfèrics.

## 2026-06-17 (sessió 9) — Presets: GitHub API en lloc de localStorage

`localStorage` es perd en format d'ordinador. Solució: repo GitHub `strk04/SHAPER-001` com a backend. Cada preset és un fitxer `presets/{projecte}/{nom}.json`. PAT token (personal access token) guardat en localStorage per autenticació. SHA cache (`Map`) per a PUT/DELETE sense GET previ. `TextEncoder`/`TextDecoder` per a base64 unicode-safe.

## 2026-06-17 (sessió 8) — extraOp/sizeMul/skew: pipeline 3D complet

Igual que `accentT` (sessió 6), els valors per caràcter calculats a `layout()` han de propagar-se per tota la cadena 3D: `build3D` → `buildScene` → `drawScene`. Sense la propagació, qualsevol efecte per caràcter és invisible en mode 3D.

Per a `sizeMul` en glifs de superfície: s'aplica escalant els components `a,b,c,d` de la matriu de transformació per `sizeMul`. La font size no cal canviar-la — la matriu ja porta l'escala de perspectiva. Per a billboards: `fontSize × sizeMul`.

Per a `skew` en billboards: s'afegeix com a component `c` del setTransform (shear horitzontal `sk * 0.3`). En glifs de superfície el shear no s'afegeix perquè la matriu de rotació ja porta inclinació pròpia de la superfície.

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
