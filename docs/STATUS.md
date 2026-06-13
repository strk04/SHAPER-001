# STATUS — SHAPER 001

_Actualitzat: 2026-06-13 (vespre)_

## Estat general

Estable. Desplegat a producció.

## URLs

- **Live:** https://q-shaper-001.vercel.app
- **PP:** https://q-pp-001.vercel.app/shaper/
- **Repo:** https://github.com/strk04/SHAPER-001
- **Deploy:** Vercel — git push main → auto-deploy

## Stack

Vanilla JS zero-build (index.html, main.js, engine.js, styles.css). Sense bundler ni node_modules.

## Darrera sessió

2026-06-13 — Layout 3 columnes: nav index (ARIA tablist) + panel controls + stage. Seccions: Àtom / Mode / Format / Colors / Presets. Export footer sempre visible. SVG import reemplaça canvas draw editors. Kerning (charTrack fusionat, trackRand eliminat de la UI). PNG export afegit.

## Pendent

- Revisar token `--rule: #9d9d9d` a Q S 003 (contrast insuficient WCAG 1.4.11 — només 2.71:1).
