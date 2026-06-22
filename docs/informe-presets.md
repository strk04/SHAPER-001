# Sistema de presets — Informe tècnic

**Projecte:** SHAPER 001  
**Data:** 2026-06-22  
**Fitxers implicats:** `presets-github.js`, `main.js` (funcions `capturePreset`, `applyPreset`, `wirePresets`)

---

## 1. Arquitectura general

El sistema de presets té **dues capes**:

| Capa | Mecanisme | Clau/ruta |
|------|-----------|-----------|
| Local (llegat) | `localStorage` | `shaper-presets-v1` |
| Núvol (activa) | GitHub Contents API | `strk04/shaper-presets/presets/{project}/{name}.json` |

La capa local existeix únicament per a migració. Les operacions noves (desar, carregar, eliminar) van sempre a GitHub.

---

## 2. Autenticació

L'usuari proporciona un **GitHub Personal Access Token (PAT)** que s'emmagatzema a `localStorage` sota la clau `shaper-gh-token`.

### Validació en dues fases (`validateToken`)

1. **`/user`** — comprova que el token és vàlid a GitHub.
2. **`/repos/strk04/shaper-presets`** — comprova que el token arriba al repo i té permís d'escriptura (`permissions.push`).

Si es passa la fase 1 però no la 2, l'error és específic: el token existeix però no veu el repo. Això evita l'error típic de "connectat" sense accés real.

### Errors traduïts

El wrapper `ghFetch` intercepta els codis HTTP i retorna missatges en català:
- `401` → token invàlid o caducat
- `403` → sense permís d'escriptura al repo
- `404` → el token no veu el repo (cas típic de fine-grained tokens sense accés explícit)

---

## 3. Estructura del repositori de presets

```
strk04/shaper-presets/
└── presets/
    ├── General/
    │   ├── tipografia-negre.json
    │   └── esfera-roja.json
    └── Querida/
        └── portada-v3.json
```

Cada **projecte** és un directori. Cada **preset** és un fitxer `.json`.

### Noms de fitxer

El nom es sanititza abans de desar:
```js
const safe = name.replace(/[^\w\s\-]/g, '').trim() || 'preset';
```
S'accepten lletres, xifres, espais i guions. Els caràcters especials (accents, símbols) s'eliminen.

---

## 4. Codi de captura (`capturePreset`)

Cada preset és un snapshot pla de l'estat de l'app. La funció serialitza:

### 4a. Tots els sliders (≈50 paràmetres)

Definits a `SLIDERS` a `main.js`: `fontSize`, `amplitude`, `frequency`, `charTrack`, `leading`, `noiseAmt`, paràmetres 3D (`formSize`, `aspect`, `facets`, `turns`), càmera (`fov`, `zoom`, `rotXSpeed`, `angleX`/`Y`), morph (`morphT`, `morphSpeed`), efectes per caràcter (`charOpacity`, `blinkRate`, `sizeAmt`), colors accent (`accentProb`×4), etc.

### 4b. Camps de selecció i botons

`text`, `font`, `shape`, `textColor`, `bgColor`, `hardWrap`, `motion2d`, `mode` (`2d`/`3d`), `form` (forma 3D), `projection`, `guides`, `backfaceMirror`, `surfaceText`, `wrapMode`, `canvasW`, `canvasH`, `opacityMode`, `blinkMode`, `blinkFade`, `sizeMode`, `accentMode`×4, `accentColor`×4, `morphForm`, `morphForm2`, `morphForm3`, `morphAuto`.

### 4c. Estat del Director

```js
snap.director = structuredClone(state.director);
```
S'inclou tot l'estat del Director (escenes, comportaments, keyframes, durades). Un preset pot encapsular una composició completa.

### 4d. Versió

```js
{ v: 1, ...rest }
```
El camp `v` permet detectar formats futurs incompatibles.

### Què NO s'inclou

| Camp | Raó |
|------|-----|
| `seed` | L'aleatorietat és responsabilitat de l'usuari |
| `t`, `morphClock`, `fps`, `directorTime` | Estat efímer de playback |
| `directorLiveOverrides`, `directorRecording` | Estat de sessió en viu |
| `customProfile`, `customOutline` | Persisten per separat a `localStorage` |
| `cameraEnabled`, `guideMeta` | Opcions de visualització, no de composició |

---

## 5. Codi de càrrega (`applyPreset`)

Restaura l'estat complet en l'ordre correcte:

1. **Comprovació de versió:** si `p.v !== 1`, s'avorta.
2. **Director:** `normalizeDirector(p.director)` — normalitza i neteja l'estructura; si la versió és incompatible activa `unsupportedVersion` i desactiva el Director.
3. **Reset de sobreescritures en viu:** `directorLiveOverrides = {}`, `directorTime = 0`.
4. **Sliders:** actualitza `state[k]` + sincronitza range i output (`syncSliderUI`).
5. **Camps simples:** actualitza `state` + els elements del DOM corresponents.
6. **Mode:** crida `activatePanel('panel-2d' / 'panel-3d')` si canvia el mode.
7. **Visibilitat de controls:** `updateEditorVisibility()`, `updateOpacityVisibility()`, `updateBlinkVisibility()`, `updateSizeVisibility()`, `updateAccentVisibility()`, `updateMorphVisibility()`.
8. **Canvas:** `applyCanvasSize(p.canvasW, p.canvasH)` si hi ha mides.
9. **Render:** `scheduleRender()` + `directorUI?.render()`.

### Compatibilitat retroactiva

Presets vells amb un sol `speed` (abans de la separació 2D/3D) es mapegen automàticament:
```js
if (p.speed != null && p.speed2d == null) {
  state.speed2d = p.speed;
  state.speed3d = p.speed;
}
```

---

## 6. Operacions GitHub (`presets-github.js`)

### Cache de SHA

GitHub requereix el SHA actual del fitxer per actualitzar-lo o esborrar-lo. El mòdul manté un `Map` en memòria (`shas: Map<path, sha>`) que s'omple quan es llisten o carreguen presets. Això evita una GET extra abans de cada PUT/DELETE.

```
listPresets()  → omple shas per tots els fitxers del projecte
loadPreset()   → actualitza sha del fitxer concret
savePreset()   → usa sha si existeix (update); omite'l (create)
deletePreset() → usa sha; falla si no existeix (cal fer listPresets primer)
```

### Codificació de rutes (`encPath`)

Els noms de projecte i preset poden tenir espais o accents. La funció codifica cada segment per separat mantenint els `/`:
```js
const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');
```
Sense això, GitHub retorna 404 (confusible amb error de permís).

### Serialització

El contingut es serialitza com a Base64 en blocs de 8192 bytes per evitar stackoverflow amb `String.fromCharCode(...bytes)` en fitxers grans:
```js
function toBase64(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj, null, 2));
  // ...chunked btoa...
}
```

La lectura fa el procés invers: `atob` + `TextDecoder`.

---

## 7. Flux complet: desar un preset

```
Usuari omple nom i clica "Desa"
  → capturePreset()          # snapshot de l'estat
  → savePreset(project, name, snapshot)
      → sanititza nom
      → path = presets/{project}/{name}.json
      → toBase64(snapshot)
      → shas.get(path) → si existeix, afegeix sha (UPDATE); si no (CREATE)
      → PUT /repos/strk04/shaper-presets/contents/{path}
      → actualitza shas amb el nou sha de la resposta
  → _ghLoadPresets()         # refresca la llista
  → setPresetStatus("Desat: nom")
```

---

## 8. Flux complet: carregar un preset

```
Usuari clica "Load" a la llista
  → loadPreset(path)
      → GET /repos/{REPO}/contents/{encPath(path)}
      → actualitza shas
      → atob(content) → TextDecoder → JSON.parse
  → applyPreset(data)
      → restaura tot l'estat (veure §5)
  → setPresetStatus("Carregat: nom")
```

---

## 9. Gestió de projectes

Els projectes són directoris del repo. Es creen implícitament quan es desa el primer preset dins seu — no hi ha operació de "crear directori" a l'API de GitHub.

El botó "Nou projecte" crea l'entrada al selector localment; el directori al repo es materialitza quan es fa el primer desar.

---

## 10. Migració local → GitHub

El botó "Importa locals" llegeix de `localStorage` (`shaper-presets-v1`, format antic: `[{name, data}]`) i fa un `savePreset` per cada entrada al projecte seleccionat. Els errors individuals es salten (no interrompen la migració).

---

## 11. UX de confirmació d'eliminació

L'eliminació és irreversible (el commit queda al repo però l'app no té "undo"). Per evitar esborrat accidental:

1. Primer clic: `✕` → `"Sure?"` (timeout 3 s)
2. Si no es confirma en 3 s, torna a `✕`
3. Segon clic dins el timeout: executa `deletePreset`

---

## 12. Dependències i limitacions

| Aspecte | Detall |
|---------|--------|
| Rate limit | GitHub REST API: 5000 req/hora (autenticat). Cada llistat, desar o esborrar consumeix 1–2 requests. |
| Mida màxima del preset | GitHub limita fitxers via API a 1 MB. Un preset típic és < 5 KB; amb Director complet pot arribar a ~20 KB. |
| Visibilitat | El repo `strk04/shaper-presets` és privat. El token ha de tenir accés explícit. |
| Persistència del SHA cache | El cache és en memòria; es perd en recarregar. Cal fer `listPresets` abans de `deletePreset` en una sessió nova. |
| Encode de nom | Accents i espais es permeten al nom (visible), però s'eliminen del nom de fitxer. `"Tipografia Àgil"` → `tipografia gil.json`. |
