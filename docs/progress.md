# Progress — SHAPER 001

## 2026-06-13 — Sliders 3D condicionals per forma

### Fet
- `updateEditorVisibility()` extesa: amaga/mostra `facets`, `turns`, `count`, `scatter` segons la forma 3D activa.
  - `facets`: cylinder / helix / star-prism / custom-prism
  - `turns`: helix
  - `count` + `scatter`: cluster
- Live region `role="status"` anuncia el canvi de forma als lectors de pantalla.
- `hidden` attribute (no CSS) → fora del tab order i l'arbre d'accessibilitat.
- Commit + push a GitHub (SHAPER 001 + Pixel Perfect). Vercel auto-deploy a https://q-pp-001.vercel.app/shaper/

### Decisions
- Sliders amagats amb `hidden` (no `display:none`) per coherència amb el patró existent dels editors customProfileEditor/customOutlineEditor.

---

## 2026-06-13 — Q S 003 design + deploy inicial

### Fet
- CSS completament reescrit amb tokens Q S 003 (idèntics a Pixel Perfect/Lumen).
- Font → `'Datatype', monospace`; sidebar → blanc; stage → `#000000`; `--radius: 0`.
- Sliders: track + thumb 1px amb `--ink-3` (#555555) — fix WCAG 1.4.11 (contrast 7.46:1 vs blanc).
- Focus → double-ring `box-shadow` (millor que el `outline` blau original).
- Botons → uppercase, transparent per defecte; `.btn-primary` negre; `#playPause` transparent.
- Collapsible `<details>` → indicador +/− sense `list-style: disclosure-*`.
- Git repo inicialitzat i push a GitHub: https://github.com/strk04/SHAPER-001
- Deploy a Vercel: https://q-shaper-001.vercel.app

### Decisions
- Slider track usa `--ink-3` (no `--rule`) per WCAG 1.4.11 — flagejat per revisar el token `--rule: #9d9d9d` a Q S 003 en una sessió futura.

---

## 2026-06-12
- Fet: creació de l'estructura de documentació (README, STATUS, progress, decisions) al vault i a docs/ del projecte.
