# Director Scene Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reordenar la columna 2 del Director perquè mostri primer l’activació global, després `Nova escena`, i finalment la fitxa de l’escena activa, mantenint una sola escena oberta cada vegada.

**Architecture:** El canvi és només de sidebar/inspector. `director-ui.js` continua generant l’inspector i la timeline, però es reorganitza el markup de l’escena activa perquè `Afegeix` passi a ser un botó principal fora de la fitxa i `Eliminar` quedi dins la fitxa. `styles.css` adapta espais i separadors fent servir els tokens existents, i `tests/project-wiring.test.mjs` fixa aquesta jerarquia perquè no regressi.

**Tech Stack:** Vanilla JS, HTML renderitzat via template strings, CSS amb design tokens propis, `node:test`.

---

### Task 1: Escriure el test de wiring del nou layout

**Files:**
- Modify: `tests/project-wiring.test.mjs`
- Test: `tests/project-wiring.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
test('director sidebar shows the active scene card after global controls', async () => {
  const ui = await readFile(new URL('../director-ui.js', import.meta.url), 'utf8');
  assert.match(ui, /Activa mode Director/);
  assert.match(ui, /data-director-action="add"[^>]*>.*Nova escena/s);
  assert.match(ui, /director-scene-card/);
  assert.match(ui, /Escena \\$\\{escapeHtml\\(active\\.name\\)\\}/);
  assert.match(ui, /<span>Moviment<\\/span>/);
  assert.match(ui, /<span>Durada total<\\/span>/);
  assert.match(ui, /<span>Durada transició<\\/span>/);
  assert.match(ui, /<span>Estil transició<\\/span>/);
  assert.match(ui, /data-director-action="delete"[^>]*>Elimina/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/project-wiring.test.mjs`

Expected: FAIL perquè el text/estructura actual encara fa servir `Activa`, `Afegeix`, `Durada`, `Transició` i no té `director-scene-card`.

- [ ] **Step 3: Write minimal implementation**

Modificar `director-ui.js` només prou perquè l’estructura nova existeixi:

```js
<span>Activa mode Director</span>
...
<button type="button" data-director-action="add">Nova escena</button>
...
<div class="director-scene-card">
  <h4 class="panel-title">Escena ${escapeHtml(active.name)}</h4>
  ...
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/project-wiring.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/project-wiring.test.mjs director-ui.js
git commit -m "test: cover director scene sidebar layout"
```

### Task 2: Reordenar el markup de la fitxa d’escena activa

**Files:**
- Modify: `director-ui.js`
- Test: `tests/project-wiring.test.mjs`

- [ ] **Step 1: Write the failing test**

Ampliar el mateix test perquè també comprovi que `Nova escena` va abans de la fitxa i que `Eliminar` queda dins la fitxa:

```js
assert.match(ui, /data-director-action="add"[\\s\\S]*director-scene-card/);
assert.match(ui, /director-scene-card[\\s\\S]*data-director-action="delete"/);
assert.doesNotMatch(ui, /director-scene-actions/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/project-wiring.test.mjs`

Expected: FAIL perquè encara existeix el bloc `director-scene-actions`.

- [ ] **Step 3: Write minimal implementation**

Reemplaçar l’editor d’escena per aquesta estructura:

```js
sceneEditEl.innerHTML = `
  <div class="director-scene-toolbar">
    <button type="button" data-director-action="add" aria-label="Nova escena">Nova escena</button>
  </div>
  <div class="director-scene-card" role="group" aria-label="Propietats de l'escena">
    <h4 class="panel-title">Escena ${escapeHtml(active.name)}</h4>
    <label class="control-row" for="directorSceneBehavior">
      <span>Moviment</span>
      <select id="directorSceneBehavior">...</select>
    </label>
    ...
    <div class="director-scene-card-actions">
      <button type="button" data-director-action="delete" aria-label="Elimina escena">Elimina</button>
    </div>
  </div>
  ${behaviorRows}
`;
```

El select `Moviment` reflecteix el primer comportament existent de l’escena si n’hi ha; si no, queda buit (`cap`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/project-wiring.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add director-ui.js tests/project-wiring.test.mjs
git commit -m "feat: reorder director scene sidebar"
```

### Task 3: Aplicar espais i separadors segons el sistema visual existent

**Files:**
- Modify: `styles.css`
- Test: `tests/project-wiring.test.mjs`

- [ ] **Step 1: Write the failing test**

Afegir assertions CSS per garantir els nous blocs:

```js
const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
assert.match(css, /\.director-scene-toolbar/);
assert.match(css, /\.director-scene-card/);
assert.match(css, /border-top: 1px solid var\\(--paper-3\\)/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/project-wiring.test.mjs`

Expected: FAIL perquè aquestes classes encara no existeixen.

- [ ] **Step 3: Write minimal implementation**

Afegir només els estils necessaris:

```css
.director-scene-toolbar {
  margin: var(--space-2) 0 var(--space-3);
}

.director-scene-card {
  display: grid;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--paper-3);
}

.director-scene-card-actions {
  margin-top: var(--space-2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/project-wiring.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add styles.css tests/project-wiring.test.mjs
git commit -m "style: align director scene layout with design system"
```

### Task 4: Verificar, documentar i publicar

**Files:**
- Modify: `docs/HANDOFF.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/progress.md`
- Modify: `docs/decisions.md`
- Sync: `/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi unidad/EN CURS/CC/02 Pixel Perfect/shaper/director-ui.js`
- Sync: `/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi unidad/EN CURS/CC/02 Pixel Perfect/shaper/styles.css`
- Sync: `/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi unidad/EN CURS/CC/02 Pixel Perfect/shaper/main.js` (només si s’ha tocat)
- Sync: `/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi unidad/EN CURS/CC/02 Pixel Perfect/shaper/index.html` (només si s’ha tocat)

- [ ] **Step 1: Run full verification**

Run:

```bash
node --test tests/*.test.mjs
node --check main.js
node --check director.js
node --check director-ui.js
```

Expected: totes les proves passen i cap `--check` falla.

- [ ] **Step 2: Update docs**

Documentar:

- nou ordre de la columna 2;
- `Nova escena` fora de la fitxa;
- `Eliminar` dins la fitxa;
- validació de la jerarquia visual segons els tokens existents.

- [ ] **Step 3: Commit and push**

```bash
git add director-ui.js styles.css tests/project-wiring.test.mjs docs/HANDOFF.md docs/STATUS.md docs/progress.md docs/decisions.md docs/superpowers/plans/2026-06-29-director-scene-layout-implementation.md
git commit -m "feat: reorganize director scene sidebar"
git push origin main
```

- [ ] **Step 4: Sync Pixel Perfect and publish**

Run:

```bash
cp director-ui.js "/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi unidad/EN CURS/CC/02 Pixel Perfect/shaper/director-ui.js"
cp styles.css "/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi unidad/EN CURS/CC/02 Pixel Perfect/shaper/styles.css"
```

Si també canvien `main.js` o `index.html`, copiar-los igualment. Després:

```bash
cd "/Users/albert/Library/CloudStorage/GoogleDrive-albert@querida.si/Mi unidad/EN CURS/CC/02 Pixel Perfect"
git add shaper/director-ui.js shaper/styles.css shaper/main.js shaper/index.html
git commit -m "sync: reorganize shaper director scene sidebar"
git push origin main
```

