# Director — Timeline inline sota el canvas

_Data: 2026-06-29 · Estat: aprovat en conversa, pendent de revisió final de l’usuari_

## Resum

El timeline del Director deixa d’existir com a dock inferior separat i passa a viure dins la columna 3, just sota el canvas. El nou disseny substitueix completament el dock negre actual per una versió blanca, integrada i molt més mínima, alineada amb el llenguatge visual de la resta de la UI.

La intenció no és mantenir l’estructura antiga de pistes detallades, sinó reduir-la a una línia temporal clara amb escenes, indicador temporal i rombos visibles amb la seva informació essencial.

## Objectiu

- Eliminar el dock negre actual del Director.
- Integrar el timeline a la columna 3 sota el canvas.
- Fer-lo ocupar tota l’amplada disponible de la columna 3.
- Simplificar la lectura del temps, les escenes i els keyframes.
- Mostrar els rombos amb només:
  - nom del paràmetre
  - valor

## Decisió aprovada

S’aplica aquesta direcció:

- el timeline nou substitueix del tot el dock actual;
- viu sota el canvas, dins la columna 3;
- ocupa tota l’amplada;
- manté la selecció d’escenes;
- mostra els rombos de keyframes amb `paràmetre + valor`;
- no mostra `easing` al timeline;
- el botó `Timeline` deixa de tenir sentit a la columna 2.

## Estructura visual

### Bloc general

La columna 3 queda organitzada així:

1. canvas / preview
2. timeline inline del Director sota el canvas

No hi ha cap dock flotant, cap panell enganxat al viewport ni cap zona negra separada.

### Línia principal del timeline

La part superior del timeline és una única línia horitzontal contínua.

Sobre aquesta línia es veuen:

- inici i final del conjunt;
- separadors verticals entre escenes;
- nom curt de cada escena (`E01`, `E02`, `E03`, etc.) centrat dins del seu tram;
- indicador de temps actual sobre la línia.

Les escenes continuen essent clicables i seleccionables.

### Rombos / keyframes

Els keyframes es mostren sota la línia principal.

Cada keyframe es representa amb:

- un rombo;
- a sota, el nom del paràmetre;
- a sota, el valor.

Exemple visual esperat:

```text
◇
centerZ
200
```

Si hi ha diversos rombos en la mateixa zona temporal, s’apilen verticalment sota la línia en lloc de recuperar el sistema antic de lanes detallades.

## Comportament

- Clicar una escena continua seleccionant-la.
- Clicar un rombo continua activant el comportament actual associat al keyframe (selecció o eliminació segons el flux existent).
- La posició horitzontal de cada rombo continua depenent del temps local dins l’escena.
- El playhead continua reflectint el temps actual del Director.

## Controls globals

Com a conseqüència d’aquest canvi:

- `Timeline` s’elimina de la columna 2 perquè el timeline ja és permanent a la columna 3;
- `Reverse` i `Loop` poden continuar vivint a la columna 2 com a controls globals del Director;
- el sistema de resize del dock desapareix perquè ja no hi ha dock.

## Regles de disseny

El nou timeline ha de seguir el sistema visual existent del projecte:

- superfície blanca / clara, no negra;
- línies i separadors amb els tokens normals del projecte (`--rule`, `--paper-3`, etc.);
- espais segons `--space-*`;
- text petit i sobri com la resta de la UI;
- sense efectes de “panel flotant” ni chrome extra.

Principi visual:

- menys jerarquia artificial;
- menys caixes;
- més lectura directa de temps i keyframes.

## Fitxers previsiblement afectats

- `index.html`
- `styles.css`
- `director-ui.js`
- `main.js`
- `tests/project-wiring.test.mjs`

És probable que `directorDock`, `directorResize` i el CSS del dock actual s’eliminin completament.

## Fora d’abast

Aquest fix no inclou:

- mostrar `easing` al timeline;
- drag avançat de rombos;
- editor multipista detallat;
- reintroduir la UI antiga de lanes;
- noves accions de timeline fora de les que ja existeixen.

## Verificació prevista

- test de wiring per garantir que:
  - el dock actual desapareix;
  - el timeline viu sota el canvas / a la columna 3;
  - el control `Timeline` ja no existeix a la columna 2;
  - els rombos mostren `paràmetre + valor`;
- `node --test tests/*.test.mjs`
- `node --check main.js`
- `node --check director-ui.js`
