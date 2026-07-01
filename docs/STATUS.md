# STATUS — SHAPER 001

_Actualitzat: 2026-07-02 (Secció 2D eliminada completament)_

## Estat general

Projecte vanilla JS zero-build. Flux habitual de publicació:

- editar a `17 SHAPER 001/`
- sincronitzar a `02 Pixel Perfect/shaper/`
- commit + push als dos repos

## Secció 2D (eliminada 2026-07-02)

L'usuari va demanar esborrar tota la secció 2D (viscuda 2026-07-01, v1 amb graella
files×columnes + pack dens per-instància). Ja no existeix:

- `engine2d.js` i `tests/engine2d.test.mjs` — eliminats.
- Tab/panell "2D" a `index.html` (graella, animacions per fila/columna, densitat, variació de
  mida, toggle de graella) — eliminat.
- Tot el wiring i estat a `main.js` (`state.grid2d`, `grid2dIntensity`/`grid2dSpeed`/
  `grid2dSizeVariance`, `renderGrid2D`, `wireGrid2D`, `renderGrid2DAxisControls`,
  `buildAxisPresetSelects`, la branca `state.mode === '2d'` a `render()`, l'activació de mode 2D a
  `activatePanel()`) — eliminat.
- `state.mode` torna a estar sempre a `'3d'` (com abans que existís la secció 2D); `applyPreset()`
  ja no restaura `'2d'` des d'un preset antic, sempre força `'3d'`.
- `preset-state.js` ja no guarda ni exclou res relacionat amb `grid2d`.

## Projecció Perspectiva — rendiment

En mode Billboard (`surfaceText` off), cada glif té una mida de font diferent segons la seva
profunditat (és la fugida de perspectiva real, no es pot eliminar sense perdre l'efecte). Fins
2026-07-01 el bucle de dibuix reassignava `ctx.font` a cada glif encara que la mida no hagués
canviat; ara `engine.js` `drawGlyph()` arrodoneix la mida a mig píxel i només reassigna `ctx.font`
quan canvia respecte a l'últim valor (`lastFs`), reduint quantes vegades el navegador ha de
re-resoldre la font. Isomètrica sempre ha tingut mida constant i no es veu afectada; el mode
surfaceText tampoc, perquè ja tenia aquesta comprovació.

## Director (eliminat 2026-07-01)

L'usuari va demanar esborrar tota la secció Director. Ja no existeix:

- `director.js`, `director-ui.js`, `export-video.js` i els seus tests — eliminats.
- Tab/panell "Director", timeline sota el canvas (`directorTimelineHost`), tot el CSS `.director-*`
  i `.automation-key-button` — eliminats.
- Tot el wiring a `main.js` (estat `director`/`directorTime`/`directorRate`/`selectedDirectorEffect`,
  `resolveRenderState`, `wireDirector`, `installAutomationButtons`, etc.) — eliminat.
- `render()` torna a ser directe: dibuixa `state` sense cap resolució de paràmetres animats.

`engine.js`/`motion.js` conserven `applyMotionBehaviors` com a codi mort (ja no s'hi alimenta cap
behavior des d'enlloc); no s'ha tocat perquè és previ al Director i fora d'abast d'aquesta neteja.
`engine.js` llegeix ara `params.morphClock` (en lloc del `directorTime` eliminat) per a `clockMs`
(blink determinista durant l'export) i per a `motionTime` — mateix comportament, font diferent.

## Export MP4

- Ja no hi ha export offline frame-exact (`encodeDirectorFrames`/`resolveOfflineAnimationState`
  eliminats amb Director).
- L'export de durada fixa (`5 s`, `10 s`, `15 s`, `30 s`) ara cau al mateix mecanisme que `Manual`:
  captura en temps real via `captureFrame()` dins el bucle d'animació, aturant-se sola quan
  `recState.frameN` arriba a `recState.loopTotal` (`dur * fps`). Depèn del rendiment del navegador
  igual que `Manual`.

## Presets

- Els presets usen un snapshot creatiu centralitzat a `preset-state.js`.
- Es guarden sliders, seed, colors, modes, càmera, toggles de càmera, outline custom, morph i canvas.
- Ja no es guarda ni s'exclou res relacionat amb Director (`director`, `directorTime`,
  `directorRate`, `selectedDirectorEffect` retirats de `CREATIVE_PRESET_EXTRA_KEYS` i
  `EPHEMERAL_PRESET_KEYS`).
- Presets antics que continguin un camp `director` simplement l'ignoren en carregar-se (no hi ha cap
  codi que el llegeixi); no calia migrador.
- Carregar un preset ja no canvia el panell actiu (abans saltava a `panel-3d` sempre que el preset
  incloïa `mode`); l'usuari es queda al panell des d'on ha carregat el preset (típicament
  `Presets`). Des de la secció 2D (2026-07-01), `state.mode` es restaura al valor real del preset
  (`'2d'` o `'3d'`) en lloc de forçar-se sempre a `'3d'`.

## Superficies 3D

- Les formes 3D tenen color de superficie configurable.
- Les guies 3D fan morphing quan hi ha un desti de `Morph` actiu.
- Les guies 3D poden pintar-se `Darrere` o `Davant` de la forma; `Davant` es compon com una capa 2D literal sobre el canvas.
- La meta de guies del canvas es pinta amb marge esquerre `20`, marge inferior `24` i cos `22.5px`.
- El panell `Colors` inclou `Color de superficie`, `Color de guies`, `Color meta guies` i `Transparencia superficie`.
- El panell `Colors` inclou `Oculta text posterior`, actiu per defecte.
- El panell `Estil 3D` no mostra controls de regió; la superfície sempre està aplicada, i `Tapes`/`Interior` no tenen UI.
- La superficie es pinta entre glifs posteriors i frontals, i pot descartar el text posterior quan queda darrere del cos.
- Per defecte: `#d8d8d8` amb transparencia `0.25`.
- En canviar de forma, `Mida de forma` i `Zoom` tornen als defaults (`413`, `1`).
- Algunes formes matematiques petites tenen normalitzacio interna de zoom perquè arrenquin a escala comparable.
- Sincronitzat a `02 Pixel Perfect/shaper/` i pujat a `strk04/PIxel-Perfect` (`77fe08a`).

Ja no hi ha:

- tab/panell Director, ni cap dels seus controls (escenes, efectes, segments, easing, timeline)
- selector `Moviment` (Deriva/Òrbita/Atracció/Explosió) ni ajustos `intensity`/`cohesion` per escena
- `ATTRACT`, `REPEL`, `EXPLODE`
- `REC`, `Atura`, `Hold`
- export MP4 offline frame-exact
- tab/panell 2D, `engine2d.js`, ni cap dels seus controls (graella, animacions per fila/columna,
  densitat, variació de mida, toggle de graella)

## Verificació actual

Ultima verificacio executada el 2026-07-02:

```bash
node --check main.js
node --check engine.js
node --check preset-state.js
node --test tests/*.mjs   # 22 pass
```

## Pendent

- Revisar deployment de Pixel Perfect si cal confirmar publicacio web.
- `engine.js`/`motion.js` conserven `applyMotionBehaviors`/`motionBehaviors` com a codi mort — netejar
  si es vol en una sessió separada (no és Director, és previ).

`17 SHAPER 001` pujat a `strk04/SHAPER-001` (`7c50865`). `02 Pixel Perfect/shaper` sincronitzat i
pujat a `strk04/PIxel-Perfect` (`723a002`).
