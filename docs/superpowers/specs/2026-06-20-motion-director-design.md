# Motion Director — Disseny

_Data: 2026-06-20 · Estat: aprovat per l’usuari, pendent de pla d’implementació_

## Resum

SHAPER passarà de ser un generador on l’animació simplement «passa» a un instrument híbrid que permet dirigir-la. El nou **Director** combinarà escenes, comportaments generatius, automatització amb keyframes i intervenció en viu. La mateixa coreografia haurà de ser navegable, reproduïble i exportable de manera determinista.

No es pretén replicar After Effects. La proposta conserva la immediatesa generativa de SHAPER i afegeix control temporal només on aporta valor.

## Objectius

- Coreografiar una peça exacta i repetible.
- Intervenir en directe sense destruir la coreografia base.
- Animar tant paràmetres existents com moviment espacial.
- Passar gradualment d’un objecte cohesionat a caràcters independents.
- Fer que scrubbing, reverse, loop, preview i export comparteixin el mateix resultat.
- Mantenir compatibles els presets existents.

## Fora d’abast de la primera versió

- Editor de corbes Bézier avançat.
- Simulació física integrada per velocitat i acceleració entre frames.
- Capes arbitràries o composició de múltiples canvases.
- Enregistrament de canvis de transport com `Hold` o `Reverse` dins una presa.
- Edició d’àudio o sincronització audiovisual.
- Substitució d’un editor de vídeo o compositing.

## Model d’interacció

### Escenes

La peça és una seqüència ordenada d’escenes contigües. Cada escena té:

- nom;
- durada;
- estat base parcial dels paràmetres de SHAPER;
- transició d’entrada;
- pila de comportaments;
- pistes d’automatització.

La durada acumulada de les escenes defineix la durada total. Canviar la durada d’una escena desplaça automàticament les següents; la primera versió no permet solapaments ni buits.

La transició d’entrada forma part de la durada de l’escena receptora. Durant aquest interval, els valors numèrics i les intensitats dels comportaments s’interpolen des de l’escena anterior; els valors discrets canvien al final de la transició. La primera escena interpola des del preset base.

### Comportaments inicials

La primera versió inclou quatre comportaments combinables:

1. **Direcció / deriva controlada**
   - Vector de direcció, distància, velocitat i fase.
   - Moviment acotat per l’escena; no acumula posició entre frames.
2. **Òrbita**
   - Centre, radi, velocitat angular i fase.
   - Admet profunditat en mode 3D.
3. **Atracció / repulsió**
   - Punt objectiu, força signada, radi i falloff.
   - Desplaçament analític; no integra acceleració ni velocitat.
4. **Explosió / reagrupament**
   - Centre, distància, dispersió seeded i progrés normalitzat.
   - El reagrupament és el mateix progrés en sentit invers, sense error acumulat.

Cada comportament comparteix `enabled`, `intensity`, `cohesion` i un `seedOffset` estable.

### Cohesió

`cohesion` va de `0` a `1`:

- `1`: tots els caràcters reben el desplaçament calculat per al centreide; el conjunt actua com un objecte rígid.
- `0`: cada caràcter rep el camp calculat a la seva posició i la seva variació seeded.
- valors intermedis: interpolació lineal entre els dos resultats.

Formalment:

```text
offset = lerp(individualOffset, centroidOffset, cohesion)
```

### Automatització

Qualsevol paràmetre numèric autoritzat pot tenir una pista de keyframes. La primera versió admet:

- `hold`;
- `linear`;
- `ease-in`;
- `ease-out`;
- `ease-in-out`.

Les pistes només apareixen quan l’usuari activa el diamant d’automatització d’un control. Els keyframes s’expressen en temps local de l’escena i es limiten a la seva durada.

Els selects, booleans i colors canvien amb keyframes `hold` en la primera versió. Les interpolacions de color i les transicions entre formes continuen usant els mecanismes específics existents.

### Intervenció en viu

Els pads en viu controlen intensitats temporals de comportaments (`Attract`, `Repel`, `Explode`) sense alterar l’escena quan `REC` està apagat.

Amb `REC` actiu:

- les mostres del gest es capturen contra el temps absolut;
- es redueixen a un conjunt de keyframes amb tolerància configurable interna;
- s’escriuen a la pista del paràmetre corresponent;
- la pista resultant es pot editar i reproduir.

`Hold` i `Reverse` són controls de transport i no s’enregistren en la primera versió.

## Interfície

### Pestanya Director

S’afegeix `Director` a la navegació principal de SHAPER. La resta de pestanyes i controls es mantenen.

Quan Director és actiu:

- la columna d’inspector mostra l’escena seleccionada;
- els controls inclouen durada, comportaments i paràmetres del comportament actiu;
- l’stage es conserva com a àrea principal de preview;
- apareixen els pads en viu sobre l’stage;
- una timeline desplegable ocupa la zona inferior sota inspector i stage.

### Timeline

La timeline conté:

- transport: play, pausa, stop, rec, loop i direcció;
- regle temporal i playhead;
- pista principal d’escenes;
- pistes d’automatització obertes per l’usuari;
- afegir, duplicar, reordenar i eliminar escenes;
- scrubbing directe.

L’altura del dock és redimensionable i es pot col·lapsar. Fora de Director, no ocupa espai.

### Accessibilitat

- Timeline i inspector han de ser navegables amb teclat.
- Cada control gràfic ha de tenir una alternativa numèrica.
- El playhead i la selecció d’escena s’anuncien mitjançant un live region sense anunciar cada frame.
- Els pads usen botons reals amb estats premut/actiu.

## Arquitectura

### `director.js`

Mòdul pur responsable de:

- validar i normalitzar la configuració del Director;
- calcular l’escena activa a partir del temps absolut;
- interpolar transicions i keyframes;
- retornar un snapshot resolt de paràmetres i comportaments.

Interfície conceptual:

```js
evaluateDirector(directorConfig, absoluteTime, baseState)
// => { sceneId, localTime, params, behaviors }
```

No llegeix DOM, canvas ni temps global.

### `motion.js`

Mòdul pur responsable de calcular offsets 2D/3D:

```js
applyMotionBehaviors(basePoint, centroid, glyphIdentity, behaviors, time, seed)
// => { x, y, z }
```

Cada comportament és analític i depèn exclusivament de les entrades. No conserva velocitat ni posició entre frames.

### `director-ui.js`

Responsable de:

- renderitzar i actualitzar timeline i inspector;
- gestionar selecció, drag, resize i scrubbing;
- capturar gestos dels pads;
- emetre accions semàntiques cap a `main.js`.

No calcula moviments ni interpola keyframes.

### Integració amb `main.js` i `engine.js`

`main.js` manté el rellotge absolut del Director, aplica les accions de la UI i demana un snapshot resolt abans de cada render.

Ordre d’avaluació:

```text
preset base
→ estat parcial de l’escena
→ transició entre escenes
→ keyframes
→ override en viu dels paràmetres de comportament
→ comportaments
→ render
```

En 3D, `engine.js` aplica els offsets després de `surfaceMap`/morph i abans de rotació de càmera i projecció. En 2D, els aplica després de `layout()` i abans de construir/dibuixar l’escena.

## Temps, scrubbing i export

El Director usa un únic temps absolut en segons. El frame interactiu l’incrementa amb `dt`; l’export no depèn del ritme real i avalua cada frame amb:

```text
absoluteTime = frameIndex / exportFps
```

Quan Director és actiu, l’export d’una peça completa comença a `0` i acaba a la durada total de les escenes. Quan Director està desactivat, es conserva el flux d’export actual.

Conseqüències:

- saltar a qualsevol temps no requereix reproduir els frames anteriors;
- reverse avalua temps decreixent;
- loop aplica mòdul sobre la durada total;
- preview i export passen pel mateix avaluador;
- seed + configuració + temps produeixen el mateix frame.

## Persistència i compatibilitat

Els presets incorporen un bloc opcional:

```json
{
  "director": {
    "version": 1,
    "loop": true,
    "scenes": [],
    "liveRecording": null
  }
}
```

- Si `director` no existeix, SHAPER es comporta exactament com ara.
- Camps desconeguts es conserven quan sigui possible però s’ignoren en execució.
- Valors no finits, durades negatives i keyframes fora de rang es normalitzen o descarten.
- Una versió futura desconeguda desactiva Director per al preset i mostra un missatge; no bloqueja el render base.

## Gestió d’errors

- Una escena buida usa el snapshot base.
- Un comportament desconegut s’ignora i es marca a l’inspector.
- Un paràmetre no automatitzable no crea pista.
- Si la gravació en viu no es pot simplificar, es conserva una mostra mínima segura i s’avisa l’usuari.
- Cap error de Director ha d’impedir exportar o renderitzar l’estat base.

## Rendiment

- Cost objectiu: `O(glyphs × behaviorsActius)` amb un màxim inicial de quatre comportaments.
- El snapshot de keyframes es calcula un cop per frame, no per glif.
- Centreide i valors comuns de cada comportament es precalculen un cop per frame.
- Intensitat zero i Director desactivat prenen un fast path sense cost per glif rellevant.

## Verificació

### Proves unitàries

- Normalització de configuracions incompletes i invàlides.
- Selecció d’escena als límits temporals.
- Interpolació de cada easing.
- Mateix seed + temps = mateix offset.
- `cohesion=1`, `cohesion=0` i valors intermedis.
- Cada comportament torna a la posició base amb intensitat zero.

### Proves d’integració

- Scrubbing, reverse i loop sense salts als límits.
- Afegir, duplicar, reordenar i eliminar escenes.
- Enregistrar un gest i reproduir els keyframes resultants.
- Presets antics sense bloc `director` mantenen el render anterior.
- Guardar i recarregar presets amb Director conserva la peça.

### Verificació visual i d’export

- Comparar posicions resoltes del preview i export per una sèrie de frames.
- Validar els quatre comportaments en 2D i 3D.
- Validar cohesió en `0`, `0.5` i `1`.
- Confirmar que la timeline col·lapsada no altera el canvas ni la UI existent.

## Estratègia de lliurament

La implementació s’ha de dividir en fases verificables:

1. Avaluador temporal, esquema de dades i proves deterministes.
2. Motor dels quatre comportaments i integració 2D/3D.
3. Escenes, inspector i transport bàsic.
4. Pistes de keyframes i scrubbing.
5. Pads en viu i gravació simplificada.
6. Persistència, compatibilitat, export i validació visual final.

Cada fase ha de mantenir el comportament existent quan Director està desactivat.
