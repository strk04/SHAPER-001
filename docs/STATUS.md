# STATUS — SHAPER 001

_Actualitzat: 2026-07-01_

## Estat general

Projecte vanilla JS zero-build. Flux habitual de publicació:

- editar a `17 SHAPER 001/`
- sincronitzar a `02 Pixel Perfect/shaper/`
- commit + push als dos repos

## Motion Director

S'ha eliminat el sistema de Moviment (Deriva/Òrbita/Atracció/Explosió, `behaviors`).
Director ara inclou:

- activació global
- escenes
- durada per escena
- transició + easing per escena
- llista d'efectes concrets per escena, agrupats: Àtom (Kerning, Interlínia, Aplicació de l'àtom),
  Forma 3D (Forma, Mida de forma, Proporció), Càmera (Rotació X/Y/Z, Angle X/Y),
  Moviment 3D (Velocitat, Probabilitat de pluja, Velocitat de pluja)
- cada efecte es manipula amb keyframes (mateix mecanisme que abans, ara exposat des del propi panell Director)
- keyframes / automatització
- controls globals `Reverse` i `Loop`
- timeline inline sota el canvas, a la columna 3
- indicador de temps del timeline sincronitzat amb la reproducció
- playhead draggable
- keyframes editables des de la columna 2
- menú contextual de supressió sobre rombos

`engine.js`/`motion.js` conserven `applyMotionBehaviors` com a codi mort (ja no s'hi alimenta cap
behavior des del Director); no s'ha tocat per estar fora d'abast d'aquest canvi.

## Export MP4

- Amb Director actiu, l'MP4 s'exporta offline a partir de la durada total del Director.
- Sense Director, les durades fixes (`5 s`, `10 s`, `15 s`, `30 s`) també s'exporten offline amb mostreig uniforme per frame.
- La gravació `Manual` continua sent real-time i depèn del rendiment del navegador.

## Presets

- Els presets usen un snapshot creatiu centralitzat a `preset-state.js`.
- Es guarden sliders, seed, colors, modes, càmera, toggles de càmera, outline custom, morph, canvas i Director.
- No es guarden camps efímers de sessió com `fps`, `t`, `morphClock`, `directorTime`, `directorRate` ni seleccions temporals del Director.

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

- selector `Moviment` (Deriva/Òrbita/Atracció/Explosió) ni ajustos `intensity`/`cohesion` per escena
- `ATTRACT`, `REPEL`, `EXPLODE`
- `REC`
- `Atura`
- `Hold`
- dock inferior de timeline
- resize handle del timeline
- botó `Timeline` a la columna 2

## Verificació actual

Ultima verificacio executada el 2026-06-30:

```bash
node --check director.js
node --check director-ui.js
node --check main.js
node --test tests/*.mjs   # 49 pass
```

## Pendent

- Decidir si més endavant la timeline ha de mostrar keyframes de totes les escenes o només de l’escena activa.
- Revisar deployment de Pixel Perfect si cal confirmar publicacio web.
- Sincronitzar el canvi d'efectes Director a `02 Pixel Perfect/shaper/`: els 5 fitxers
  (`director.js`, `director-ui.js`, `main.js`, `styles.css`, `tests/project-wiring.test.mjs`) ja estan
  editats al working tree de PP i els 27 tests de PP passen, però falta `git commit` + `git push` allà
  — el classificador d'auto-mode bloqueja `git commit`/`git push` quan detecta contingut copiat entre
  repos, encara que les edicions de fitxer individuals sí que es permeten. Cal que l'usuari executi
  manualment a `02 Pixel Perfect/shaper/`:
  `git add director.js director-ui.js main.js styles.css tests/project-wiring.test.mjs && git commit -m "feat: replace Director moviment with concrete effects list" && git push`

`17 SHAPER 001` ja pujat a `strk04/SHAPER-001` (`a3f277d`). `02 Pixel Perfect/shaper` encara no té
aquest commit.
