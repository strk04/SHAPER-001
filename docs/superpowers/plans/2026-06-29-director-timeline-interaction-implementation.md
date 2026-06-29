# Director Timeline Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fer usable el timeline del Director amb selecció/edició de rombos, playhead draggable i poliment visual coherent.

**Architecture:** `director-ui.js` passa a gestionar selecció de keyframes, menú contextual de supressió i seeking per playhead. `main.js` manté l’estat seleccionat i actualitza keyframes via helpers immutables existents. `styles.css` unifica tipografia i corregeix separadors.

**Tech Stack:** HTML estàtic, CSS, JavaScript modular, Node test runner (`node --test`)

---

### Task 1: Blindar el contracte del nou timeline amb tests

**Files:**
- Modify: `tests/project-wiring.test.mjs`

- [ ] Escriure tests que fallin per exigir:
  - selecció de rombos (`onSelectKeyframe`)
  - actualització (`onUpdateKeyframe`)
  - menú contextual de supressió
  - playhead draggable / seek
  - cos de text unificat a `var(--text-xs)`
  - separadors d’escena dibuixats un sol cop

- [ ] Executar `node --test tests/project-wiring.test.mjs` i comprovar RED.

### Task 2: Implementar selecció i edició de rombos

**Files:**
- Modify: `main.js`
- Modify: `director-ui.js`

- [ ] Afegir estat per al rombo seleccionat i netejar-lo en canviar d’escena.
- [ ] Fer que clic sobre un rombo el seleccioni.
- [ ] Renderitzar una fitxa d’edició del rombo actiu a la columna 2.
- [ ] Permetre editar `value`, `time` i `easing`.
- [ ] Mantenir `Eliminar` com a acció explícita de la fitxa i del menú contextual.

### Task 3: Implementar playhead draggable i poliment visual

**Files:**
- Modify: `director-ui.js`
- Modify: `styles.css`

- [ ] Permetre seek fent clic sobre la línia del timeline.
- [ ] Permetre arrossegar el playhead endavant i endarrere.
- [ ] Posar labels d’escena i labels/valors de rombo a `var(--text-xs)`.
- [ ] Dibuixar els separadors d’escena sense duplicació visual.

### Task 4: Verificar, documentar i publicar

**Files:**
- Modify: `docs/HANDOFF.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/progress.md`

- [ ] Executar:
  - `node --test tests/*.test.mjs`
  - `node --check main.js`
  - `node --check director.js`
  - `node --check director-ui.js`
- [ ] Sincronitzar `shaper/` dins Pixel Perfect.
- [ ] Repetir tests rellevants a Pixel Perfect.
- [ ] Commit + push als dos repos.
