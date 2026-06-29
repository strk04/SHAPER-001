# Director — Timeline usable (fase A)

_Data: 2026-06-29 · Estat: aprovat en conversa_

## Resum

La primera versió del timeline inline ja existeix, però encara no és prou usable: els rombos es poden veure però no editar, el playhead no es pot arrossegar, la tipografia és massa gran i alguns separadors visuals dupliquen línies.

Aquesta fase A converteix el timeline en una eina realment editable sense entrar encara a les guies visuals dels moviments.

## Objectiu

- Fer que els rombos siguin editables.
- Fer que el playhead es pugui moure endavant i endarrere.
- Unificar tota la tipografia del timeline al cos normal del sistema.
- Eliminar l’efecte de separadors d’escena duplicats.

## Decisió aprovada

S’aplica aquest comportament:

- clic a un rombo = seleccionar-lo, no eliminar-lo;
- botó dret sobre rombo = menú contextual mínim amb opció `Eliminar`;
- quan un rombo està seleccionat, la columna 2 mostra una fitxa d’edició amb:
  - paràmetre
  - valor
  - temps
  - easing
  - eliminar
- el playhead del timeline es pot arrossegar i també es pot reposicionar fent clic a la línia del timeline;
- `E01`, `E02`, labels i valors dels rombos usen tots el mateix cos de text base del projecte;
- els separadors verticals entre escenes es dibuixen una sola vegada.

## Racional

L’usuari no percep clarament l’efecte dels rombos perquè fins ara només existia el moment de captura i l’esborrat, però no l’edició. Això fa que el timeline sembli “visible” però no “controlable”. Amb selecció + fitxa d’edició + scrubbing manual del temps, l’efecte de cada keyframe passa a ser llegible i manipulable.

## Fora d’abast

Aquesta fase no inclou encara:

- drag horitzontal directe dels rombos;
- multi-selecció;
- editor d’easing dins el timeline;
- overlays / guies visuals dels moviments (`target`, `radius`, `center`, etc.).

## Fitxers previstos

- `director-ui.js`
- `main.js`
- `styles.css`
- `tests/project-wiring.test.mjs`
- `docs/HANDOFF.md`
- `docs/STATUS.md`
- `docs/progress.md`
