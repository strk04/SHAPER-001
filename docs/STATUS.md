# STATUS — SHAPER 001

_Actualitzat: 2026-06-29_

## Estat general

Projecte vanilla JS zero-build. La URL canònica live continua sent `/shaper/` dins Pixel Perfect.

- **Live:** https://q-pp-001.vercel.app/shaper/
- **Repo:** https://github.com/strk04/SHAPER-001
- **Deploy habitual:** editar a `17 SHAPER 001/` → copiar a `02 Pixel Perfect/shaper/` → push PP001

## Motion Director

Director està implementat localment com a sistema d’escenes amb:

- durada per escena
- transició + easing per escena
- comportaments deterministes
- keyframes / automatització
- transport de timeline
- export offline frame-exact
- accions d'escena mínimes (`Afegeix`, `Elimina`)

La sessió actual ha eliminat la capa de live performance:

- no hi ha `ATTRACT`, `REPEL`, `EXPLODE`
- no hi ha `REC`
- no hi ha live pads ni gravació de gestos

## Verificació actual

Última verificació executada el 2026-06-29:

```bash
node --test tests/*.test.mjs   # 30 pass
node --check main.js
node --check director.js
node --check director-ui.js
```

## Pendent

- Verificació visual del flux simplificat de Director.
- Decidir si els rombos d’automatització s’han d’amagar fora de la pestanya `Director`.
- Fer visible el valor dels keyframes seleccionats.
