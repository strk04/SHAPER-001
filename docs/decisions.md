# Decisions — SHAPER 001

## 2026-07-01 — Secció 2D: escalar l'àtom via `ctx.scale()`, no el rectangle de retall

Bug real detectat per l'usuari ("les animacions afecten al grid, no a l'àtom"): la implementació
anterior calculava `cw`/`ch` (cel·la escalada) només per triar la mida del rectangle de retall i
per cridar `layout()`, però els glifs es dibuixaven sempre a `fontSize` fix — l'animació no
escalava el text, només revelava/amagava una porció fixa d'ell dins una caixa que canviava de mida.

Fix: `ctx.scale(colScale, rowScale)` s'aplica directament abans de dibuixar els glifs, i `layout()`
es calcula sempre a la mida BASE (no escalada) de la cel·la perquè el word-wrap no canviï amb
l'animació — només la mida visual del resultat. El retall es fa després de l'escalat perquè la
vora es mogui junt amb l'àtom.

Racional: no calia preguntar-ho — és la interpretació correcta i l'única raonable de "l'animació
escala la fila/columna": el contingut ha de créixer/encongir-se visiblement, no quedar amagat
darrere d'un retall que canvia de mida al voltant d'un text estàtic.

## 2026-07-01 — Secció 2D: repetir el text sencer, no repartir-lo entre cel·les

Revertida la decisió original de la v1 (word-wrap del text en 2 eixos per omplir la graella
exactament una vegada). L'usuari va indicar directament que "l'àtom hauria de repetir-se per cada
columna i/o fila". `layoutGrid2D()` deixa de rebre `text`/de dividir paraules; cada cel·la mostra
el mateix text sencer.

Racional: no es va donar explicació — canvi de direcció de disseny un cop vist el resultat de la
v1. Simplifica també el model (`layoutGrid2D` és ara pura geometria, sense dependència de
`tokenize()`).

## 2026-07-01 — Secció 2D: reutilitzar `layout()` en lloc d'un renderer 2D propi

El primer intent de `drawGrid2D()` feia un `fillText` + word-wrap simple, only usant `fontSize`/
`font`/`textColor`/`bgColor`. L'usuari va assenyalar que "molts paràmetres de la secció Àtom no
afecten l'àtom 2D". En lloc de reimplementar cadascun d'aquests efectes (kerning, opacitat, blink,
mida, skew, accent, soroll...) al mòdul 2D, es va decidir cridar `layout()` — la mateixa funció que
ja usa el pipeline 3D — per cada cel·la, passant-hi l'`state` complet.

Racional: `layout()` ja calcula tots aquests efectes per caràcter (rung 2 de l'escala YAGNI: "ja
existeix al codebase"); reimplementar-los seria duplicar ~150 línies de lògica ja provada i
mantenir dues fonts de veritat sincronitzades. Únic cost: cada cel·la corre el bucle de layout
sencer (potencialment car amb graelles grans + textos llargs); acceptat sense optimitzar
prematurament, marcat com a pendent de mesurar si cal.

## 2026-07-01 — Secció 2D: graella real, no dos modes separats

Preguntat explícitament (`AskUserQuestion`) si files i columnes havien de ser una graella real
(totes dues simultànies, com cel·les d'una taula) o dos modes independents (o files, o columnes,
mai combinades). L'usuari va triar **graella real**.

Racional: no se'ns va donar el motiu explícit — decisió de disseny de l'usuari. Determina tota
l'arquitectura de `engine2d.js`: cada cel·la té una fila I una columna, i pot rebre l'efecte
combinat de totes dues alhora (l'escala de fila i la de columna es multipliquen sobre la mateixa
cel·la), en lloc de ser mútuament excloents.

## 2026-07-01 — Secció 2D: columna escala amplada (simetria amb fila/alçada)

Els 5 presets de referència escalen l'alçada de cada línia (fila). Preguntat explícitament si una
columna hauria d'escalar la seva amplada (eix natural, simètric) o traslladar-se verticalment
(efecte diferent). L'usuari va triar **escalar l'amplada**.

Racional: manté la mateixa matemàtica dels presets (`SCALE_PRESETS`) reutilitzada literalment en
tots dos eixos, només canviant quina dimensió de la cel·la s'escala — cap duplicació de lògica,
només d'aplicació.

## 2026-07-01 — Secció 2D: text compartit auto-ajustat a la graella, no text per cel·la

Preguntat explícitament si el text de l'Àtom (compartit amb 3D) s'havia de repartir automàticament
per la graella (word-wrap en 2 eixos) o si cada cel·la hauria de tenir el seu propi text
independent (com les Text layers de Mosaic a Pixel Perfect). L'usuari va triar **text compartit
auto-ajustat**.

Racional: coherent amb la premissa inicial de la sessió ("2D i 3D comparteixen l'àtom") — una sola
font de veritat per al contingut textual, no dues.

## 2026-07-01 — Secció 2D: Block In v1 sense fase de "push"

El preset de referència "Block In" té dues fases: arribada (cada línia creix 0→1 en seqüència) i
push (un cop totes han arribat, la primera línia és empesa cap avall i torna a entrar per dalt,
en bucle continu, amb retallat via `clipPath`). `blockReveal()` a `engine2d.js` només porta la
fase d'arribada, reiniciant el cicle en lloc de fer el push.

Racional: la fase de push depèn de gestionar un desplaçament de cua sobre TOTES les files alhora
(no és una funció pura per índex com les altres 4 animacions), i el retallat via `clipPath` és
específic del renderer SVG original — adaptar-ho fidelment al canvas 2D requeria una arquitectura
diferent (desplaçament + clip rectangle) fora de l'abast d'un v1 ràpid. Es va decidir fer aquesta
simplificació sense preguntar explícitament (l'usuari havia dit "pots obviar tot el que no faci
referència a les animacions", interpretat com llum verda per prioritzar velocitat d'entrega sobre
fidelitat total en la primera iteració) i comunicar-ho clarament un cop fet.

Conseqüències: el "Block In" 2D actual és una nova línia (o columna) que apareix en seqüència i
el cicle es reinicia — no hi ha efecte de "cua que puja". Pendent confirmació de l'usuari sobre si
cal completar la fase de push en una iteració futura.

## 2026-07-01 — Presets: no forçar canvi de panell en carregar

`applyPreset()` deixa de cridar `activatePanel('panel-3d')`. Aquesta crida era un residu de quan
l'app tenia mode 2D/3D commutable: com que `state.mode` és sempre `'3d'`, forçar el canvi de panell
no aportava cap valor funcional, només interrompia el flux de l'usuari (carregava un preset des de
`Presets` i es trobava al panell `3D` sense haver-ho demanat).

Conseqüències: cap — `updateEditorVisibility()` es manté per assegurar que els sliders correctes
(segons la forma del preset) es mostren encara que l'usuari no vegi el panell 3D en aquell moment.

## 2026-07-01 — Perspectiva: arrodonir la mida de font enlloc de fer-la exacta

Al mode Billboard, la mida de font varia contínuament amb la profunditat (efecte de perspectiva).
Es va decidir arrodonir-la a mig píxel abans de construir el string de `ctx.font`, en lloc de
mantenir-la exacta.

Racional: un canvi de mida de font inferior a mig píxel és imperceptible visualment, però permet
que glifs a profunditats similars reutilitzin el mateix string de font i evitin que el navegador
torni a resoldre mètriques/glyph-cache a cada `fillText`. És un compromís precisió-vs-rendiment amb
cost visual nul assumit directament (no calia preguntar-ho a l'usuari: la imperceptibilitat és
objectiva, no una tria estètica).

Conseqüències: cap canvi de comportament observable; només s'aplica al camí de dibuix canvas
(`drawGlyph()` a `engine.js`), no al model de dades (`glyph.fontSize` es continua calculant exacte
per a l'export SVG i altres consumidors).

## 2026-07-01 — Director eliminat del tot (incloent l'export MP4 offline)

Després d'una sessió sencera desenvolupant i refinant el Director (escenes → línia temporal →
segments amb easing → selector de forma), l'usuari va demanar directament "borrem tota la secció
director". Es va preguntar explícitament (`AskUserQuestion`) si calia conservar el mecanisme
d'export MP4 offline frame-exact que el Director havia introduït (`encodeDirectorFrames`/
`resolveOfflineAnimationState`, també usat per l'export de durada fixa sense Director actiu) o
eliminar-ho tot. L'usuari va triar **eliminar-ho tot**.

Racional: no se'ns ha donat raó explícita del canvi de direcció — es tracta d'una decisió de
producte de l'usuari, no d'un bug. Conseqüència acceptada explícitament: l'export de durada fixa
(5/10/15/30s) deixa de ser frame-exact/offline i torna a ser una captura en temps real (com
`Manual`), depenent del rendiment del navegador durant la gravació.

Conseqüències tècniques: `director.js`, `director-ui.js`, `export-video.js` i tots els seus tests
desapareixen. `engine.js` conserva `clockMs`/`motionTime` (usats per blink determinista i pel
motor de moviment ja mort) però repuntats a `params.morphClock` en lloc del `directorTime` eliminat
— sense aquest canvi, aquest codi hauria quedat silenciosament trencat (sempre agafant el valor de
fallback). Cap migrador de presets antics amb un camp `director`: simplement queda ignorat, no hi
ha cap lectura d'aquell camp enlloc del codi.

## 2026-07-01 — Director: easing d'entrada/sortida reintroduït (contradiu la decisió anterior)

Un cop implementat el model "hold" (valor fix, sense rampa), l'usuari va provar-ho i va demanar
canviar-ho: "el canvi entre efectes no pot ser brusc, hi ha d'haver un easing d'entrada i de sortida
i una duració de l'easing d'entrar i sortir". Això reobre la decisió del mateix dia ("Director:
segments amb valor fix", més avall) sense contradir-la del tot: el **cos** del segment continua
mantenint un valor fix (no és una rampa contínua d'un valor a un altre com l'opció "b" descartada
llavors), però ara els **límits** (entrada/sortida) sí que interpolen suaument des de/cap al valor
base durant una durada configurable (`easeIn`/`easeOut` en segons, per segment).

Racional: la primera decisió (hold pur) resultava massa brusca a la pràctica un cop provada; l'usuari
no volia tornar a una rampa contínua completa (opció "b"/"c" descartades explícitament la primera
vegada), sinó suavitzar només les vores. Aquesta és una afinació de la decisió original, no una
reversió completa.

Conseqüències: `evaluateDirector` torna a fer interpolació lineal (com abans de simplificar-ho), però
només a les vores del segment i només per a valors numèrics — els efectes de valor discret (Forma,
wrapMode) continuen sense easing perquè un string no s'interpola. Per defecte els segments numèrics
nous reben `easeIn=easeOut=0.3s` (`DEFAULT_EASE_LENGTH`) perquè el comportament brusc no torni a
aparèixer per omissió.

## 2026-07-01 — Director: selector de forma en lloc de text lliure

El camp "Valor" de l'editor d'efecte, per a paràmetres de valor discret (Forma, Aplicació de l'àtom),
passa de `<input type="text">` a `<select>` amb les mateixes opcions que el control real de la
pàgina (`document.getElementById(AUTOMATION_CONTROL_IDS[name])`), en lloc de duplicar-ne la llista
de 45 formes com a constant nova.

Racional: l'usuari havia d'escriure a mà l'id intern de la forma (`"cylinder"`, `"torus-knot"`...)
sense cap ajuda, propens a error. Reutilitzar les opcions del control ja existent (rung 2 de
l'escala d'YAGNI: "ja existeix al codebase") evita duplicar 45 línies i mantenir dues fonts de
veritat sincronitzades.

## 2026-07-01 — Director: segments amb valor fix (no rampa ni fade)

Cada efecte aplicat sobre la línia temporal té un **Inici** i un **Final**, i manté **un sol valor
fix** mentre el playhead és dins d'aquest rang; fora del rang, el paràmetre cau al seu valor base.
Es va preguntar explícitament a l'usuari (`AskUserQuestion`) entre tres opcions — valor fix (hold),
rampa entre dos valors, o fade in/out — i va triar **hold**.

Racional: l'usuari vol pensar en "aquest efecte és actiu entre aquests dos instants", no en corbes
d'interpolació. Simplifica també la UI (no cal easing per segment) i el model (`director.js` ja no
necessita `EASINGS` ni cap lògica d'interpolació entre segments).

Conseqüències: cap ramp/fade nativa. Si en el futur es vol una transició suau a l'entrada/sortida
d'un segment, caldrà una decisió nova i explícita (no assumir-la implícitament); de moment un
efecte "apareix"/"desapareix" de cop als límits del segment. Trencament de compatibilitat amb
l'antic format `{time, value, easing}` (keyframe puntual) — no hi ha migrador perquè no hi ha
presets amb Director en producció.

## 2026-07-01 — Director: una sola línia temporal, sense escenes

S'elimina el model d'escenes del Director (cada escena amb la seva pròpia durada, transició i
automatitzacions locals) i es substitueix per una única línia temporal contínua: una `Durada` total i
un conjunt de keyframes per paràmetre col·locats directament sobre aquesta línia.

Racional: l'usuari vol pensar l'animació com una sola timeline on va aplicant efectes al llarg del
temps, no com una seqüència d'escenes discretes que cal encadenar amb transicions. El mecanisme de
keyframes per paràmetre (`AUTOMATABLE_PARAMS`/`EFFECT_GROUPS`, ja introduït a la decisió anterior) es
manté intacte; només canvia el contenidor: abans cada escena tenia el seu propi rellotge local i les
seves pròpies automatitzacions, ara tot viu en un únic espai de temps absolut.

Conseqüències: `addScene`/`duplicateScene`/`moveScene`/`removeScene`/`applySceneAction` i les
transicions entre escenes desapareixen del tot (no es conserven com a codi mort, ja que no tenien cap
sentit sense escenes). **Trencament de compatibilitat conegut i acceptat**: `normalizeDirector` ja no
llegeix `input.scenes`; un preset antic amb escenes es carrega amb Director actiu però `duration=5` i
`automations={}` (buit) — no falla, però perd el contingut animat. No s'ha escrit cap migrador perquè
encara no hi ha presets amb Director en producció fora d'aquesta sessió de desenvolupament. El
radiogroup d'escenes de la UI se substitueix per un únic `role="slider"` (`#directorTrack`) seekable per
pointer i teclat — revisat amb accessibility-lead abans d'aplicar el CSS corresponent.

## 2026-06-30 — Director: efectes concrets per paràmetre, no "moviments" de partícula

S'elimina el selector `Moviment` per escena (Deriva/Òrbita/Atracció/Explosió, amb `intensity`/`cohesion`)
i es substitueix per una llista explícita d'efectes concrets agrupats per categoria (Àtom, Forma 3D,
Càmera, Moviment 3D), cadascun automatitzable amb keyframes des del propi panell Director.

Racional: el sistema de behaviors movia partícules de glifs individualment de forma genèrica i abstracta
(4 tipus de moviment configurables amb paràmetres tècnics com `radius`/`falloff`), cosa que no es
corresponia amb com l'usuari pensa l'animació (vol animar paràmetres concrets ja existents al disseny:
kerning, forma, rotació de càmera, pluja...). El mecanisme de keyframes per paràmetre ja existia
(`AUTOMATABLE_PARAMS` + botons-diamant), només calia: (1) restringir-lo als 14 paràmetres rellevants en
comptes dels antics (zoom, pulse, morph*, etc., ara fora de l'abast), i (2) exposar-lo com una llista
explícita dins el Director en lloc de botons dispersos pels panells originals (decisió presa amb
`AskUserQuestion`: l'usuari va triar la llista explícita per sobre de reutilitzar només els botons
existents).

Conseqüències: `engine.js`/`motion.js` mantenen `applyMotionBehaviors` com a codi mort (cap consumidor
l'alimenta ja), no s'ha eliminat per no ampliar l'abast del canvi. Presets/escenes antics amb `behaviors`
es normalitzen ignorant aquest camp (no hi ha migració ni avís).

## 2026-06-30 — Els presets guarden un snapshot creatiu, no l'estat complet de sessió

Els presets passen a usar `preset-state.js` com a contracte central de persistència. El JSON guarda els camps creatius/reproduïbles de la composició: sliders, seed, colors, modes, canvas, càmera, toggles de càmera, outline custom, morph i Director.

Racional: bolcar literalment tot `state` també guardaria informació temporal o d'edició que no forma part de la peça, com el temps actual de reproducció, FPS, direcció de playback o el keyframe seleccionat. Separar `CREATIVE_PRESET_EXTRA_KEYS` i `EPHEMERAL_PRESET_KEYS` fa explícit què ha d'entrar en un preset i evita oblits com `cameraEnabled`.

Conseqüències: els presets nous són més complets i reprodueixen millor una composició. Els presets antics continuen carregant perquè `applyPreset()` manté defaults quan falta un camp. Quan s'afegeixi un nou paràmetre creatiu que no sigui slider, s'ha d'afegir a `CREATIVE_PRESET_EXTRA_KEYS`; si és temporal, a `EPHEMERAL_PRESET_KEYS`.

## 2026-06-30 — Els MP4 amb durada fixa s'exporten offline també sense Director

Les exportacions MP4 amb una durada seleccionada deixen de capturar el canvas del preview en temps real quan Director està desactivat. Ara prenen un snapshot de l'estat base i renderitzen cada frame a un temps absolut uniforme abans de codificar-lo.

Racional: la captura live depèn del `requestAnimationFrame` i del cost de l'encoder. Si el navegador perd un frame, el codi podia codificar dues imatges visuals iguals amb timestamps regulars, creant micro-salts en el fitxer resultant. El mostreig offline separa el ritme del vídeo del rendiment puntual del navegador.

Conseqüències: les durades fixes (`5 s`, `10 s`, `15 s`, `30 s`) són el camí recomanat per export fluïd. La gravació `Manual` continua sent real-time i, per definició, pot reflectir caigudes de rendiment del preview.

## 2026-06-29 — Oclusio posterior independent de la transparencia

La transparencia de superficie i l'oclusio de la tipografia posterior passen a ser controls separats. `Transparencia superficie` controla nomes l'alpha visual de la malla; `Oculta text posterior` decideix si els glifs back-facing es dibuixen o no.

Racional: una superficie translucida pot ser esteticament util, pero l'usuari necessita que el cos de la forma pugui amagar text posterior de manera fiable. Separar els dos conceptes evita que una transparencia baixa sigui l'unica manera d'obtenir oclusio.

Conseqüencies: amb el checkbox actiu, el text posterior desapareix completament encara que la superficie sigui semitransparent. Si es desactiva, es recupera el comportament anterior de veure glifs posteriors a traves de la malla.

## 2026-06-29 — Les formes restauren mida i zoom base en canviar

Quan l'usuari canvia de forma, `Mida de forma` i `Zoom` tornen als defaults compartits (`413` i `1`). A mes, algunes formes matematiques tenen un factor intern de zoom per compensar definicions parametrices que ocupen molt menys espai visual que una esfera o un cub.

Racional: el flux creatiu no ha d'obligar a fer super zoom cada cop que es prova una forma nova. El mateix set inicial de controls ha de donar una distancia de treball acceptable en totes les formes.

Conseqüencies: els sliders visibles continuen mostrant els mateixos valors base per totes les formes, mentre que el motor aplica una escala interna nomes a formes petites. Si una forma concreta queda massa gran o massa petita, el mapa `FORM_ZOOM_SCALE` és el punt d'ajust.

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

## 2026-06-30 — La regió Superfície deixa de ser configurable

Decisió: eliminar el control `Regió / Superfície` de `Estil 3D` i considerar la superfície sempre activa.

Racional: després de retirar `Interior` i `Tapes`, el selector de regió només podia activar o desactivar la superfície, cosa que duplicava el comportament base del mode 3D i feia la UI menys clara.

Conseqüència: els presets nous ja no guarden `regionSurface`. Els presets antics que continguin `regionSurface:false` no apaguen la superfície.

## 2026-06-29 — Guies durant morphing com a graella paramètrica

Durant morphing, les guies especifiques de cada forma base queden substituides per una graella paramètrica comuna interpolada entre forma origen i forma desti.

Racional: les guies especifiques de formes tancades (arestes, meridians, eixos, perfils) no comparteixen topologia entre totes les destinacions possibles. Una graella UV comuna manté continuitat visual i evita que les guies quedin congelades mentre la forma canvia.

Conseqüència: sense morph actiu, cada forma conserva les seves guies actuals; amb morph actiu, la guia prioritza continuitat del blend per sobre de detalls singulars de cada forma.



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
