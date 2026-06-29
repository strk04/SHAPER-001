# Director Inline Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Moure el timeline del Director sota el canvas a la columna 3, substituir completament el dock antic i simplificar la presentació dels keyframes a `paràmetre + valor`.

**Architecture:** La UI del Director es manté partida entre inspector i timeline, però el timeline deixa de ser un dock separat i passa a renderitzar-se dins un host inline al `main.stage`. `director-ui.js` reconstruirà una línia principal d’escenes i una capa de keyframes apilats, mentre `main.js` elimina tota la lògica de dock/collapse/resize.

**Tech Stack:** HTML estàtic, CSS, JavaScript modular, Node test runner (`node --test`)

---

### Task 1: Blindar el wiring amb tests

**Files:**
- Modify: `tests/project-wiring.test.mjs`
- Test: `tests/project-wiring.test.mjs`

- [ ] **Step 1: Escriure el test que falla**

Afegir assertions perquè el wiring reflecteixi el nou disseny:

```js
assert.match(html, /id="directorTimelineHost"/);
assert.match(html, /id="directorTimeline"/);
assert.doesNotMatch(html, /id="directorDock"/);
assert.doesNotMatch(html, /id="directorResize"/);
assert.doesNotMatch(ui, /id="directorCollapse"/);
assert.doesNotMatch(main, /directorCollapse/);
assert.doesNotMatch(main, /directorResize/);
assert.doesNotMatch(main, /directorDock/);
assert.match(ui, /director-inline-timeline/);
assert.match(ui, /director-keyframe-label/);
```

- [ ] **Step 2: Executar el test i comprovar que falla**

Run: `node --test tests/project-wiring.test.mjs`

Expected: FAIL perquè encara existeixen `directorDock`, `directorResize` i `directorCollapse`, i encara no existeixen `directorTimelineHost` ni la nova UI inline.

- [ ] **Step 3: Mantenir la resta d’assertions consistents**

Actualitzar els tests antics perquè deixin d’esperar:

```js
assert.match(html, /id="directorDock"/);
assert.match(css, /\.director-dock/);
assert.match(ui, /id="directorCollapse"/);
assert.match(main, /directorCollapse/);
```

i en lloc seu validin el timeline inline permanent i els controls globals restants (`Reverse` i `Loop`).

- [ ] **Step 4: Re-executar el test després dels ajustos**

Run: `node --test tests/project-wiring.test.mjs`

Expected: continua FAIL fins que implementem el nou wiring, però ja falla pel comportament nou esperat.

- [ ] **Step 5: Commit intermedi quan el RED estigui clar**

```bash
git add tests/project-wiring.test.mjs
git commit -m "test: define inline director timeline wiring"
```

### Task 2: Substituir el dock per un host inline sota el canvas

**Files:**
- Modify: `index.html`
- Modify: `main.js`
- Test: `tests/project-wiring.test.mjs`

- [ ] **Step 1: Moure el host del timeline a l’HTML**

Substituir el bloc final:

```html
<section id="directorDock" class="director-dock" aria-label="Timeline del Director" hidden>
  <div id="directorResize" class="director-resize" role="separator" tabindex="0" ...></div>
  <div id="directorTimeline"></div>
</section>
```

per:

```html
<main class="stage">
  <div class="canvas-shell">
    <div id="artwork" class="artwork" role="img" aria-label="Previsualització de tipografia generativa" tabindex="-1"></div>
  </div>
  <section id="directorTimelineHost" class="director-timeline-host" aria-label="Timeline del Director">
    <div id="directorTimeline"></div>
  </section>
</main>
```

- [ ] **Step 2: Simplificar l’activació del panell Director**

A `activatePanel(panelId)`, eliminar:

```js
const directorOpen = panelId === 'panel-director';
document.body.toggleAttribute('data-director-open', directorOpen);
const dock = $('directorDock');
if (dock) dock.hidden = !directorOpen;
```

i deixar només el render del Director quan toca:

```js
if (panelId === 'panel-director') {
  directorUI?.render();
}
```

- [ ] **Step 3: Eliminar la lògica de resize/collapse**

Treure de `wireDirector()` tot el bloc relacionat amb:

```js
const resizeHandle = $('directorResize');
const collapseBtn = $('directorCollapse');
document.body.hasAttribute('data-director-collapsed');
document.body.style.setProperty('--director-dock-height', ...);
```

- [ ] **Step 4: Executar el test de wiring**

Run: `node --test tests/project-wiring.test.mjs`

Expected: FAIL encara per la UI/CSS del timeline, però sense referències al dock/collapse.

- [ ] **Step 5: Commit intermedi**

```bash
git add index.html main.js tests/project-wiring.test.mjs
git commit -m "refactor: move director timeline under canvas"
```

### Task 3: Reescriure la UI del timeline en format minimal

**Files:**
- Modify: `director-ui.js`
- Modify: `styles.css`
- Test: `tests/project-wiring.test.mjs`

- [ ] **Step 1: Treure el botó Timeline de la columna 2**

Eliminar del markup de l’inspector:

```html
<button type="button" id="directorCollapse" aria-expanded="true" aria-controls="directorTimeline">Timeline</button>
```

i deixar només:

```html
<button type="button" id="directorReverse" aria-pressed="false">Reverse</button>
<button type="button" id="directorLoop" aria-pressed="true">Loop</button>
```

- [ ] **Step 2: Crear el markup del timeline inline**

Substituir:

```html
<div class="director-scenes" role="radiogroup" aria-label="Escenes" id="directorScenes"></div>
<div id="directorLanes" class="director-lanes"></div>
```

per:

```html
<div class="director-inline-timeline">
  <div class="director-scenes" role="radiogroup" aria-label="Escenes" id="directorScenes"></div>
  <div id="directorLanes" class="director-lanes"></div>
</div>
```

- [ ] **Step 3: Simplificar la construcció d’escenes i keyframes**

Fer que `buildScenes(vm)` generi trams etiquetats `E01`, `E02`, etc., i que `buildLanes(active, localTime)` produeixi peces com:

```html
<button type="button" class="director-keyframe" ...>
  <span aria-hidden="true"></span>
  <span class="director-keyframe-label">centerZ</span>
  <span class="director-keyframe-value">200</span>
</button>
```

Sense mostrar `easing`, sense lane label a l’esquerra i amb apilat vertical si hi ha diversos keyframes.

- [ ] **Step 4: Reescriure l’estil del timeline**

Eliminar el CSS del dock negre i afegir regles per:

```css
.director-timeline-host { ... }
.director-inline-timeline { ... }
.director-scenes { ... }
.director-scene { ... }
.director-lanes { ... }
.director-keyframe { ... }
.director-keyframe-label { ... }
.director-keyframe-value { ... }
```

amb superfície blanca, línia fina, amplada completa i separadors d’escena.

- [ ] **Step 5: Executar el test de wiring**

Run: `node --test tests/project-wiring.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit intermedi**

```bash
git add director-ui.js styles.css tests/project-wiring.test.mjs
git commit -m "feat: redesign director inline timeline"
```

### Task 4: Verificació completa, docs i publicació

**Files:**
- Modify: `docs/HANDOFF.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/progress.md`
- Modify: `docs/decisions.md`
- Modify: `/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi unidad/EN CURS/CC/02 Pixel Perfect/shaper/` (sync copy)

- [ ] **Step 1: Executar verificació fresca**

Run: `node --test tests/*.test.mjs`

Expected: tots els tests passen.

Run: `node --check main.js`

Expected: exit 0.

Run: `node --check director.js`

Expected: exit 0.

Run: `node --check director-ui.js`

Expected: exit 0.

- [ ] **Step 2: Actualitzar memòria de projecte**

Reflectir a `docs/`:

```md
- timeline del Director mogut sota el canvas
- dock antic eliminat
- columna 2 només conserva controls globals rellevants
- timeline mostra rombos amb paràmetre + valor
```

- [ ] **Step 3: Commit del repo SHAPER**

```bash
git add index.html main.js director-ui.js styles.css tests/project-wiring.test.mjs docs/HANDOFF.md docs/STATUS.md docs/progress.md docs/decisions.md docs/superpowers/plans/2026-06-29-director-inline-timeline-implementation.md
git commit -m "feat: move director timeline inline"
git push
```

- [ ] **Step 4: Sincronitzar la còpia Pixel Perfect**

Copiar els fitxers actualitzats a:

`/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi unidad/EN CURS/CC/02 Pixel Perfect/shaper/`

i després:

```bash
git add index.html main.js director-ui.js styles.css tests/project-wiring.test.mjs
git commit -m "sync: move director timeline inline"
git push
```

- [ ] **Step 5: Confirmar estat final**

Run: `git status --short`

Expected: working tree neta als dos repositoris.
