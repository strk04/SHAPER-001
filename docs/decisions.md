# Decisions — SHAPER 001

## 2026-06-29 — Superficies 3D com a capa entre text posterior i frontal

El color de superficie s'aplica a totes les formes 3D, no nomes a les formes tancades. La transparencia es controla amb slider (`0` opac, `1` invisible) i per defecte queda a `0.25`.

Racional: l'usuari vol que les formes tancades puguin tapar la tipografia quan roten, pero prefereix que el mecanisme funcioni amb totes les formes si es possible. La solucio 2.5D (glifs posteriors -> malla de superficie -> glifs frontals) dona l'efecte visual demanat sense introduir WebGL ni un z-buffer complet.

Conseqüencies: les formes obertes funcionen com lamines acolorides. Les formes amb normals aproximades poden requerir ajustos futurs en casos visuals concrets. `cube` pinta la superficie com `box` per mostrar també cares superior/inferior, mentre el mapatge de glifs existent es manté.

## 2026-06-29 — Els rombos del timeline passen de ser destructius a ser editables

El clic principal sobre un rombo ja no elimina el keyframe. A partir d’ara el clic selecciona el rombo i obre una fitxa d’edició a la columna 2, mentre que l’eliminació es mou a una acció explícita (`Eliminar`) i a un menú contextual amb botó dret. Racional: l’acció principal d’un keyframe ha de ser entendre’l i modificar-lo, no destruir-lo accidentalment. Conseqüència: el timeline esdevé una eina usable de control, i el valor/temps/easing passen a ser editables sense haver de recrear el rombo.

## 2026-06-29 — El playhead del Director es pot arrossegar directament

La bola del timeline deixa de ser només un indicador passiu i passa a ser un control draggable de seek. Racional: sense scrubbing directe, els keyframes es poden veure però costa molt llegir què fan realment. Conseqüència: el temps del Director es pot moure endavant i endarrere des del mateix timeline, fent molt més clara la relació entre rombo i resultat visual.

## 2026-06-29 — El timeline del Director deixa el dock i passa sota el canvas

El timeline del Director deixa d’existir com a dock negre separat i passa a viure dins la columna 3, sota el canvas, ocupant tota l’amplada disponible. Racional: el dock actual introdueix una jerarquia visual massa pesada i separa artificialment el temps del preview principal. Conseqüència: desapareixen el bloc inferior actual i el control `Timeline` de la columna 2, i el nou timeline adopta una lectura més directa d’escenes i keyframes.

## 2026-06-29 — Al timeline només es mostra `paràmetre + valor` per keyframe

Els rombos del timeline no mostraran `easing` en aquesta iteració. Cada keyframe exposa únicament el nom del paràmetre i el seu valor. Racional: és la mínima informació útil per llegir la coreografia sense tornar a carregar la UI. Conseqüència: l’easing segueix existint com a dada del sistema, però no forma part de la lectura principal del timeline nou.

## 2026-06-29 — `Moviment` desplega els ajustos del moviment actiu, però no la pila completa antiga

La simplificació de la columna 2 no ha d’implicar perdre editabilitat del moviment. Per això, el desplegable `Moviment` manté un únic moviment visible per escena, però sota seu es renderitzen els ajustos del moviment actiu (`intensity`, `cohesion` i paràmetres específics). Racional: és el punt d’equilibri entre claredat de la UI i control real de l’animació. Conseqüència: no reintroduïm la vella pila de múltiples comportaments a la sidebar, però tampoc deixem el moviment com una elecció “cega” sense controls.

## 2026-06-29 — Les dues durades mostren `seg` inline després del camp

`Durada total` i `Durada transició` deixen de mostrar la unitat `segons` sota del camp i passen a compartir el mateix patró visual: caixa numèrica + `seg` a la dreta. Racional: és més compacte, més consistent i evita que un dels dos camps sembli tenir una estructura diferent de l’altre. Conseqüència: la unitat queda associada visualment al valor i la fitxa d’escena respira millor en vertical.

Com a ajust posterior, els dos inputs comparteixen també una amplada fixa comuna perquè la igualtat sigui literal i no depengui del contingut intrínsec del camp.

## 2026-06-29 — La fitxa d’escena mostra un únic `Moviment` en lloc de la pila completa de comportaments

La nova columna 2 no exposa ja la pila completa de comportaments ni els seus paràmetres avançats. En lloc d’això, cada escena presenta un únic desplegable `Moviment` amb `Deriva`, `Òrbita`, `Atracció` i `Explosió`. Racional: la UI demanada prioritza llegibilitat i onboarding sobre control fi, i la pila antiga afegia massa soroll conceptual. Conseqüència: la sidebar treballa amb el “moviment principal” de l’escena, i en canviar-lo es netegen les automatitzacions antigues de comportament per no deixar restes incoherents a la timeline.

## 2026-06-29 — La columna 2 de Director manté una sola escena oberta

La UI d’escenes no passa a un model de múltiples fitxes desplegades. Es manté el patró actual d’una sola escena activa visible a la columna 2, però es reordena la jerarquia perquè primer apareguin els controls globals (`Activa mode Director`, `Nova escena`) i després la fitxa de l’escena activa. Racional: és la manera més simple de fer la interfície més llegible sense canviar el flux mental ni afegir soroll visual. Conseqüència: no cal introduir accordions, llistes llargues d’escenes ni una nova arquitectura de sidebar.

## 2026-06-29 — `Reverse`, `Loop` i `Timeline` passen a ser controls generals de la columna 2

`Reverse` i `Loop` no s’han de presentar com a propietats d’escena sinó com a estat global del Director, i `Timeline` tampoc ha de competir visualment amb els comportaments dins el dock. Per això s’eliminen `Atura` i `Hold` i es traslladen `Reverse`, `Loop` i `Timeline` al final de la columna 2 dins un bloc general. Conseqüència: el dock inferior queda dedicat només a la timeline, i la jerarquia conceptual és més clara: escenes i comportaments a la columna 2, reproducció global al bloc general.

## 2026-06-29 — Accions d'escena reduïdes a `Afegeix` i `Elimina`

La UI d'escenes del Director elimina `Duplica`, `←` i `→`. Racional: en la fase actual, aquestes tres accions afegeixen soroll visual i decisions secundàries a una eina que encara s'està simplificant conceptualment. Conseqüència: la UI d'escena queda més llegible i el flux principal passa a ser crear, editar i eliminar; la lògica interna de duplicar/moure es conserva per ara, però deixa de formar part de l'experiència visible.

## 2026-06-29 — Director sense capa live de performance

Per a l’ús real d’aquest projecte, el Director queda orientat a coreografia d’escenes i no a performance en viu. Es retiren `ATTRACT`, `REPEL`, `EXPLODE`, `REC` i tota la lògica de live gesture recording. Racional: aquests conceptes introduïen una segona jerarquia mental dins la UI i dificultaven entendre què era escena, què era comportament i què era acció temporal. Conseqüència: Director queda reduït a escenes, comportaments, keyframes i transport; la base és més clara i més fàcil d’explicar.

## 2026-06-29 — Crear o duplicar escena selecciona l’escena nova

Quan l’usuari prem **Afegeix** o **Duplica** dins Director, la selecció passa automàticament a l’escena creada. Racional: el flux mental és “he creat una escena, ara l’edito”; mantenir `Escena 1` seleccionada feia que la columna 2 semblés incorrecta i convertia “Durada segons” en un control ambigu. Conseqüència: les accions d’escena es centralitzen en `applySceneAction()` perquè el comportament sigui testejable i no quedi dispers dins el wiring de `main.js`.

## 2026-06-20 — Token `--rule-on-dark` per a límits sobre el dock fosc (emergent en implementació)

El dock del Director és `background: var(--ink)` (#000) amb text `--paper`. Cap gris existent supera 3:1 (WCAG 1.4.11) contra **alhora** #fff i #000: `--ink-3` (#555) passa sobre blanc però falla a 2.6:1 sobre negre, i `--rule` (#9d9d9d) ja era marginal sobre blanc. Decisió: afegir un token de superfície fosca dedicat `--rule-on-dark: #8a8a8a` (~6:1 sobre #000) i usar-lo per a totes les vores de controls del dock (escenes, pads, keyframes, lanes), mai `--ink-3`. Els focus rings del dock també s'inverteixen (anella interior `--ink`, exterior `--paper`) per ser visibles tant sobre el dock negre com sobre els botons d'escena actius (blancs).

## 2026-06-20 — Escenes com a radiogroup i pads press-and-hold amb force-release (emergent, gate a11y)

La revisió d'accessibilitat va corregir el disseny inicial abans d'escriure codi: (1) la fila d'escenes és `role="radiogroup"`/`role="radio"` amb `aria-checked` + roving tabindex + fletxes/Home/End (no `role="list"`, que despullaria el rol de botó i deixaria la selecció sense host vàlid); (2) els pads en viu (press-and-hold) implementen alliberament forçat en `blur` de l'element **i** `blur` de finestra, a més de pointerup/cancel i keyup, perquè un pad no pugui quedar enganxat «on» en perdre focus o finestra; (3) el `<output>` del temps porta `aria-live="off"` i `announce()` només es dispara en canvis discrets (canvi d'escena, REC), mai per frame. Aquests patrons són requisits, no preferències, per al compliment WCAG 2.2 AA.

## 2026-06-20 — Director híbrid en lloc d’una timeline completa tipus After Effects

SHAPER ha de conservar la seva naturalesa generativa però permetre coreografiar i repetir una peça. S’adopta un model híbrid: escenes per estructurar, comportaments per generar moviment, pistes de keyframes només quan cal precisió i pads per intervenir en viu. Això evita convertir la UI en un editor de composició generalista. La timeline viu en una pestanya Director i es pot col·lapsar; la resta de l’eina continua funcionant com ara.

## 2026-06-20 — Moviment analític i determinista basat en temps absolut

Els comportaments del Director no integraran física entre frames. Cada posició es calcularà com una funció pura del punt base, temps absolut, seed i paràmetres. Això fa possible scrubbing, reverse, loops i export frame-exact sense reproduir l’historial anterior. Conseqüència: atracció, repulsió i explosió tindran sensació de camp físic però no seran una simulació dinàmica real.

## 2026-06-20 — Cohesió com a interpolació entre centreide i resposta individual

Un únic control `cohesion` governarà l’escala del moviment: `1` aplica el camp calculat al centreide a tots els caràcters; `0` avalua cada caràcter i la seva variació seeded; els valors intermedis interpolen els dos offsets. Això cobreix moviment de bloc i moviment de partícules sense duplicar cada comportament en dos modes separats.

## 2026-06-18 (sessió 13) — speedVar com a easing per potència, no com a ample de finestra

La variació de velocitat per caràcter es va implementar primer escalant l'ample de la finestra de transició (`charSpan = baseSpan * spanMul`). Bug: caràcters "lents" tenien `charSpan > 1` i mai arribaven a `localMix = 1` abans que el cicle reiniciés → salt sec. Decisió: la velocitat és un **easing per potència** dins la finestra normalitzada [0,1] (`localMix = rawMix ^ power`, `power = exp((roll-0.5)·var·3)`). `x^n = 1` quan `x = 1` per qualsevol potència → cap caràcter queda a mig camí, sense talls. scatter i speedVar usen un PRNG separat amb 2 rolls SEMPRE consumits (independentment dels valors) per mantenir el determinisme seed+params.

## 2026-06-18 (sessió 13) — Feedback de presets en panell propi + validació d'accés real

Els missatges de presets escrivien a `#exportStatus`, que viu al panell Export (`hidden` quan s'està al panell Presets) → desar/error invisibles, símptoma "no passa res". Decisió: cada panell amb el seu propi `role="status"`; `#presetStatus` al panell Presets, `setPresetStatus()` dedicat. A més, `validateToken()` validava només `/user`, que passa amb qualsevol token vàlid encara que no tingui accés al repo privat → l'app deia "connectat" i després fallava amb 404 silenciós. Ara `validateToken()` fa també `GET /repos/{REPO}` i comprova `permissions.push`, llançant un error clar i accionable si el token no pot escriure. Principi: l'estat "connectat" no ha de mentir mai sobre la capacitat real.

## 2026-06-17 (sessió 12) — Morph chain: from/to/mix per frame, no per glif

La cadena de N formes podria interpolar tots els nodes per caràcter, però només calen dos `surfaceMap` per glif (node origen i destí del segment actiu). Per tant `morphFrom`/`morphTo`/`morphMix` es resolen un sol cop per frame (fora del loop de glifs) segons el rellotge auto o el slider manual. Cost idèntic al morph de 2 formes. Auto és bucle **tancat** (l'últim node torna a la base) perquè l'animació no salti; manual és cadena **oberta** (Blend 1 = últim destí) per donar control directe de l'extrem. Els destins es revelen seqüencialment a la UI per evitar configuracions amb forats (destí 3 sense destí 2).



## 2026-06-17 (sessió 11) — Morph: lerp UV en lloc de morph topològic

El morphing entre formes es fa interpolant linealment els punts 3D que `surfaceMap` retorna per al mateix `(u,v)` a forma A i forma B (`morphSurface`). Avantatge: zero estructura nova — reutilitza tot el pipeline existent (rotació, projecció, surfaceText, pulse, rain s'apliquen al punt ja interpolat). Cada caràcter conserva el seu `(u,v)`, així es mou pel camí 3D més curt entre la seva posició a A i a B. No és un morph topològic real (no re-malla), però visualment és fluid per a tipografia generativa. La normal també s'interpola per mantenir l'orientació de surfaceText coherent.

## 2026-06-17 (sessió 11) — morphClock: rellotge en segons reals separat de state.t

El hold de 8s ha de ser literal. `state.t` s'acumula com `dt * speed3d` (default 0.1) → no són segons reals. Solució: `state.morphClock` acumula `dt` cru (segons reals) a `frame()`, només mentre està en Play. El cicle auto-morph (transició + hold) opera sobre `morphClock`, així el hold és exactament 8s independentment de `speed3d` o `morphSpeed`. Es reseteja a 0 en activar Auto per arrencar des de forma A. No trenca determinisme d'export perquè el morph és animació temporal (l'export captura el frame segons el clock actual).

## 2026-06-17 (sessió 11) — projectPersp: treure zoom de l'escala per glif

`scale: (focal·zoom)/denom / (focal/dist)` = `zoom·dist/denom` → al pla central (z=0) donava `zoom` (≈2.3), no 1 com deia el comentari. Resultat: glifs en perspectiva renderitzats a `fontSize×2.3` → ~5× àrea de `fillText` → causa del slowdown. Fix: `scale: dist/denom` → 1 al centre, només variació per profunditat (0.83–1.25). El zoom segueix controlant l'extensió de posicions via `f`. Consistència amb isomètrica (que renderitza glifs a `fontSize`, scale=1). Trade-off acceptat: presets vells en perspectiva tindran glifs més petits.



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
