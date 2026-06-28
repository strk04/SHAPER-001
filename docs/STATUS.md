# STATUS — SHAPER 001

_Actualitzat: 2026-06-29_

## Estat general

Projecte vanilla JS zero-build. La URL canònica live continua sent `/shaper/` dins Pixel Perfect.

- **Live:** https://q-pp-001.vercel.app/shaper/
- **Repo:** https://github.com/strk04/SHAPER-001
- **Deploy habitual:** editar a `17 SHAPER 001/` → copiar a `02 Pixel Perfect/shaper/` → push PP001

## Motion Director

Director està implementat localment amb:

- escenes seqüencials;
- durada per escena;
- comportaments deterministes;
- keyframes / automatització;
- pads en viu;
- export offline frame-exact.

La sessió actual ha corregit la selecció després de crear escenes: **Afegeix** i **Duplica** ara seleccionen automàticament l’escena nova.

## Verificació actual

Última verificació executada el 2026-06-29:

```bash
node --test tests/*.test.mjs   # 29 pass
node --check main.js
node --check director.js
node --check director-ui.js
```

## Pendent

- Verificació visual al navegador del flux Director:
  - crear escena;
  - duplicar escena;
  - editar durada;
  - confirmar que la columna 2 correspon a l’escena seleccionada.
- Decidir si la UX del Director s’ha de simplificar cap a un flux guiat: `Escena → Comportament → Durada → Play`.
- Commit/push del microfix si la prova visual és correcta.
