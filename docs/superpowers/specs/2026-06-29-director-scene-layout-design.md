# Director — Reordenació de la UI d'escenes

_Data: 2026-06-29 · Estat: aprovat en conversa, pendent de revisió final de l’usuari_

## Resum

La columna 2 de `Director` es reorganitza perquè el flux principal sigui més evident i més simple d’explicar. Es manté el model actual d’“una sola escena oberta cada vegada”, però es canvia la jerarquia visual perquè la columna mostri primer l’activació global del Director, després la creació d’escenes, i finalment la fitxa de l’escena activa.

No es canvia el model de dades ni el comportament temporal del Director. Aquest canvi és exclusivament d’interface i jerarquia visual.

## Objectiu

- Fer que la columna 2 sigui més llegible a primera vista.
- Separar millor allò global (`Activa mode Director`, `Nova escena`) d’allò que pertany a una escena concreta.
- Mantenir el patró actual d’una única escena oberta per vegada.
- Aplicar els tokens i patrons existents del projecte en lloc d’introduir un sistema visual nou.

## Decisió aprovada

S’aplica l’opció 1:

- només una escena oberta cada vegada, com ara;
- la columna 2 mostra únicament la fitxa de l’escena activa;
- la jerarquia queda:
  1. `Activa mode Director`
  2. botó `Nova escena`
  3. separador visual
  4. fitxa de l’escena activa

## Estructura proposada

### Bloc 1 — Activació global

Es manté un únic control global al capdamunt:

- `Activa mode Director [ ]`

Aquest bloc continua fent servir l’estructura existent de `control-row`.

### Bloc 2 — Creació d’escenes

Just sota l’activació global hi ha un únic botó:

- `Nova escena`

No comparteix línia amb cap altra acció. L’objectiu és que la creació d’escenes es llegeixi com una acció principal, no com una acció secundària dins la fitxa.

### Bloc 3 — Escena activa

Després d’un separador visual apareix la fitxa de l’escena seleccionada:

- títol: `Escena 1`
- `Moviment` [desplegable: `Deriva`, `Òrbita`, `Atracció`, `Explosió`]
- `Durada total` [input numèric en segons]
- `Durada transició` [input numèric en segons]
- `Estil transició` [desplegable: `hold`, `linear`, `ease-in`, `ease-out`, `ease-in-out`]
- botó `Eliminar`

No es mostren simultàniament les altres escenes a la columna 2. La selecció continua passant per la timeline/radiogroup existent.

## Regles de layout i disseny

Aquest canvi ha de seguir el sistema visual existent del projecte:

- espai vertical entre files normals: `var(--space-2)`
- separació entre blocs: `var(--space-3)` o `var(--space-4)` segons el patró ja usat a sidebar
- títols amb `panel-title`
- files etiquetades amb `control-row`
- separadors amb `1px solid var(--paper-3)`
- radi de cantonada: `var(--radius)` només si ja existeix una caixa real; no s’ha d’afegir una “card” nova si no cal

Principi general: reordenar i respirar millor, no redissenyar el sistema.

## Comportament

- `Nova escena` continua creant una escena nova i deixant-la seleccionada automàticament.
- En canviar l’escena activa, la fitxa mostra la nova escena seleccionada.
- `Eliminar` actua només sobre l’escena activa.
- `Reverse`, `Loop` i `Timeline` continuen sent controls globals fora d’aquesta fitxa d’escena, segons la decisió anterior.

## Fora d’abast

Aquest canvi no inclou:

- mostrar múltiples escenes obertes alhora;
- reordenar escenes des de la columna 2;
- canviar la timeline;
- introduir targetes complexes o una UI tipus accordion;
- modificar el model de comportaments o automatització.

## Fitxers previsiblement afectats

- `director-ui.js`
- `styles.css`
- `tests/project-wiring.test.mjs`

`main.js` només s’hauria de tocar si el nou wiring de camps ho fa estrictament necessari.

## Verificació prevista

- test de wiring per garantir que la columna 2 manté:
  - control global `Activa`
  - botó `Nova escena`
  - una única fitxa d’escena activa
  - camps `Moviment`, `Durada total`, `Durada transició`, `Estil transició`
  - botó `Eliminar`
- comprovació que no s’introdueixen múltiples editors d’escena simultanis a la sidebar
- `node --test tests/*.test.mjs`
- `node --check main.js`
- `node --check director-ui.js`
