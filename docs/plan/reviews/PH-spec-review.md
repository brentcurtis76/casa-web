# CODEX SPEC REVIEW — PH — costos (2×pro cover/end + append)

**VERDICT: EXECUTABLE WITH THE TEXT BELOW**

La decisión de producto, la base y el alcance frontend son correctos. El borrador no es
ejecutable literalmente: describe de forma incompleta el caso edge sin imágenes válidas, trata
al editor como único consumidor de una firma que también construyen siete fixtures tipados, y
un guard por `itemId` no basta ante un runner global cuyo `runItems` desplaza cualquier corrida.
Con los tres strikes verificados por el PM y G1–G10 + T-H.1–T-H.12 incorporados por referencia,
PH es ejecutable.

## Base de revisión y verificación independiente

- FE fijado: `phase/pcui-warnings`@`8ceec7c12d30ab0686a281fcf539b67a2066a99f`;
  el ref local y `origin/phase/pcui-warnings` resuelven al mismo SHA.
- Edge de sólo lectura: `phase/pb-storage-edge`@
  `10d1190321246595de14d55815804900670c1983`. Su merge-base con FE es `2e9eeae`;
  ninguna línea contiene a la otra.
- Ejecuté `jb list` y leí el mapa de worktrees antes de inspeccionar. El worktree compartido
  estaba en la pista M y conservó su ` M .gitignore`; no lo toqué. La inspección de código fue
  por `git show` y los gates se ejecutaron en un worktree detached desechable de `8ceec7c`.
  No creé rama PH, no hice checkout de un ref protegido, merge, push, deploy, llamada a proveedor
  ni acción de infraestructura.
- Quedan confirmados: 4→2 sólo para generate cover/end, tier `pro`, patrón append de
  sheets/scenes, cuatro refines pro de una imagen con reemplazo por valor, las cuatro superficies
  `ImageSelector`, collector cover/end vacío-only, persistencia por categoría y restore de options
  + selección, default edge 2, refine effective count 1, y fan-out cap 4.
- El barrido de **todas** las suites encuentra exactamente cuatro literales acoplados a
  `count: 4`: `taskFactories.test.ts:510,561` y
  `taskFactoriesPG.signal.test.ts:218,241`. Son los cuatro cambios de conteo declarados.
- La página oficial de precios de Gemini, consultada 2026-08-02, confirma flash-image
  US$60/M image tokens (1120 tokens 1K = US$0.0672, publicado como US$0.067) y pro-image
  US$120/M (1120 tokens 1K/2K = US$0.1344, publicado como US$0.134), con input pro
  US$2/M y output de texto/thinking cobrado aparte. Fuente:
  <https://ai.google.dev/gemini-api/docs/pricing>.
- Gates independientes bajo Node `v22.22.0`, carga inicial ~3.4:

  ```text
  Vitest serial: 68 files; 872 passed / 6 failed = 878 total
  Failure set: exactly the named MesaAbiertaDashboard six
  TypeScript: 1041 diagnostics
  ESLint: 159 problems = 116 errors / 43 warnings
  ```

## STRIKES

El PM debe verificar cada strike contra los SHAs fijados antes de aplicarlo.

### [S1] El edge no siempre responde 429/500 cuando cero imágenes sobreviven

Strike:

> `all-failed ⇒ 429/500 error envelope`

En `handler.ts:1348-1395`, 429/500 ocurre sólo cuando `images.length === 0` **y** existe
al menos un rechazo registrado en `errors`. Si todas las promesas se cumplen con resultado vacío
o base64 inválido, `errors` queda vacío y el edge responde 200 con `success:false, images:[]`.
La superficie FE sigue siendo error porque `invokeGenerateSceneImagesRequest` rechaza
`!data.success || !data.images.length` (`CuentacuentoEditor.tsx:493-505`), pero la premisa de
status/envelope es falsa. Reemplazarla por la distinción exacta de G2/G7.

### [S2] El editor no es el único consumidor de la nueva firma

Strike:

> `The factory signature change is internal and moves atomically with its only consumers (the editor)`

y strike la restricción incompatible:

> `Frozen suites are findings-not-patch-targets, EXCEPT the four T-H.1 declared count pins.`

Además de los dos sitios de producción, las suites construyen directamente cover/end generate
**siete** veces: cinco en `taskFactories.test.ts` y dos en
`taskFactoriesPG.signal.test.ts`. Cuatro coinciden con los pins de conteo y tres son consumidores
adicionales de firma (registry cover/end y `PERSIST_STALE` cover). Un `append: boolean` requerido
y los setters generate-only para limpiar selección producen diagnósticos nuevos si esos fixtures
no se actualizan. G1/G2 autorizan sólo las adaptaciones mecánicas necesarias en esas dos suites;
el conjunto de cuatro divergencias de conteo sigue siendo exacto.

### [S3] Un guard por ítem deja abierta la carrera cover↔end

Strike de la decisión 5:

> `handleGenerateCover`/`handleGenerateEnd` gain an item-busy imperative guard alongside `isApprovingRef`

`runItems` reserva de forma síncrona pero desplaza la corrida global anterior
(`storyImagePipelineRunner.ts:828-893`). Tras iniciar cover, `statusOf('end')` sigue idle: un guard
por el mismo id deja que un clic inmediato en end aborte/desplace cover. El handler debe consultar
la ocupación **global y viva** mediante `pipeline.isBusy()`; `pipeline.isRunning` capturado por un
closure sólo sirve como feedback/pre-filtro. G5 sustituye el diseño sin tocar el runner PG-frozen.

## BINDING G-TEXTS

### G1 — Base, topología y alcance

Crear una sola rama frontend `phase/ph-costs` desde
`phase/pcui-warnings`@`8ceec7c`. No existe rama edge PH. `10d1190` es referencia read-only; si
aparece una necesidad edge genuina, el executor se detiene y reporta FINDING.

Los únicos archivos de producción autorizados son
`src/lib/cuentacuentos/taskFactories.ts` y
`src/components/liturgia-builder/editors/CuentacuentoEditor.tsx`. Se autorizan tests PH nuevos y
las adaptaciones mecánicas de firma/conteo en `taskFactories.test.ts` y
`taskFactoriesPG.signal.test.ts`. No se autoriza cambio de hook, runner, concurrency, storage,
refine, lifecycle, toast, wire contract ni `supabase/**`. Una regresión de fase congelada es un
FINDING, no permiso para parchearla.

### G2 — Contrato exacto de las fábricas cover/end

`CoverTaskInput` y `EndTaskInput` ganan un `append: boolean` **requerido**. Los setters de
selección necesarios (`setSelectedCover`, `setSelectedEnd`) pertenecen a esos inputs generate;
no se añaden a `CoverRefs`/`EndRefs` compartidos ni se obliga a modificar los refines.

Ambos requests generate fijan `count:2, modelTier:'pro'`. En apply:

- `append:true`: leer la ref viva, producir `[...existing, ...result.images]`, escribir la ref
  síncronamente antes del setter, preservar selección/ref/setter de selección, y devolver el
  array completo en el patch;
- `append:false`: reemplazar por `result.images`, escribir la ref, fijar la ref de selección a
  `null`, llamar el setter de selección con `null`, y devolver el patch de options completo.

Orden y multiplicidad se conservan. Un resultado parcial de una imagen añade una; no se rellena,
duplica ni rechaza por no alcanzar dos. Cero imágenes nunca llega a apply porque el wrapper FE lo
convierte en error, tanto para el 429/500 como para el 200 `success:false` descrito en S1.

### G3 — Regenerate significa append; copy y componente compartido

La respuesta de Brent se aplica a **todo generate batch no vacío** de cover/end. Tanto el botón
de header como el botón interno de `ImageSelector` llaman con `append:true`. No queda una
superficie de reemplazo de batch para cover/end. Los refines siguen reemplazando un slot y no son
una superficie de regenerate batch. Sheets/scenes conservan su asimetría existente: regenerate
replace + control separado `2 más` append.

En estado no vacío, el header cover/end muestra exactamente `2 más` con `Sparkles` y title
`Genera 2 opciones adicionales sin descartar las existentes`. Los labels vacíos
`Generar portada` y `Generar "Fin"` no cambian.

`ImageSelector` gana sólo `regenerateLabel?: string`, con default exacto
`No me gustan, generar otras opciones`. Cover y end pasan
`Generar 2 opciones adicionales`; sheets/scenes no pasan la prop y sus callsites y output
permanecen byte/DOM-equivalentes. No se agrega una segunda variante del componente.

### G4 — Rama replace y collector

Los cuatro callsites productivos deciden explícitamente el intent: options no vacías ⇒ append;
options vacías ⇒ replace. `collectCoverEndTasks` permanece vacío-only y construye tasks con
`append:false`; nunca regenera ni re-ofrece un append. Por ello la rama replace no es alcanzable
desde una superficie productiva no vacía, aunque sigue siendo un contrato de fábrica probado con
estado no vacío para demostrar que limpia una selección stale.

### G5 — Concurrencia sin reabrir el runner

Cada closure no vacío de cover/end conserva un pre-filtro visual de running/persisting,
refining y approval. La garantía imperativa vive en ambos handlers:

```ts
if (isApprovingRef.current || pipeline.isBusy()) return;
```

La consulta debe ser viva al runner, no el booleano de render `pipeline.isRunning` ni
`statusOf` de un solo id. Header e `ImageSelector` quedan deshabilitados o inaccesibles durante
running, persisting, refine y approval; el spinner de `ImageSelector` cuenta como inaccesible.
Dos clics en el mismo control y las secuencias cover→end/end→cover en el mismo tick producen una
sola corrida/invocación: cero abort, token displacement o segundo dispatch. No se modifica
`runItems`, `reserveRun`, `tryStart` ni ninguna semántica PG.

### G6 — Persistencia y reload reales

El patch append contiene el array completo y viaja por `enqueueGeneratedSnapshot` y el hook real.
PB sube la categoría completa, el swap sigue siendo count-matched a cualquier longitud y el
restore recupera todas las options y la selección original válida. La prueba observa el payload
real en `persistDraftRow`/upsert, desmonta, remonta sin `initialStory`, recupera la fila clonada
como JSON y observa options + selección en el editor. El control de boundary puede ser aditivo,
test-only, opt-in y default false, siguiendo el precedente PC-UI; no sustituye el hook.

### G7 — Contabilidad y modelo de costo

La afirmación ejecutable es de **primer intento de output de imagen exitoso**, no una factura ni
un techo. Cada batch FE aceptado hace una invocación edge; el edge read-only intenta una llamada
Gemini por imagen hasta `min(effectiveCount,4)`, sujeto a su retry interno. Post-PH, cover+end de
primer intento son dos invocaciones FE con `count:2`, es decir cuatro intentos pro frente a ocho
hoy; ahorro de output exitoso = 4×US$0.1344 = ~US$0.54.

El documento de costo debe hacer explícitas las poblaciones detrás de sus ejemplos:

- mínimo publicado: 12 escenas + una hoja de personaje + cero props elegibles = 26 imágenes
  flash y 4 pro = US$2.2848 ≈ US$2.28;
- típico publicado: 15 escenas + seis hojas combinadas de personaje/prop elegible = 42 flash y
  4 pro; con precios publicados redondeados = US$3.35 (aritmética exacta por tokens ≈ US$3.36).

Se excluyen expresamente: input de texto e imágenes de referencia; output de texto/thinking de
los propios modelos de imagen; generación Anthropic del cuento; research; retries cliente y
edge; refines; batches append posteriores; uploads manuales; y gasto fallido, abandonado o ya
despachado antes de cancel. No hay UI de costo, cap, warning ni knob. Cada clic append añade hasta
dos pro (~US$0.27 de image output si ambos tienen éxito); acumulación sin techo aceptada.

### G8 — Cancel y residuos

PG permanece congelado. PH sólo necesita una matriz parameterizada cover/end en el límite más
fuerte nuevo: iniciar `append:true` con options y selección existentes, estacionar un provider
que ignora abort, cancelar después del dispatch y resolver tarde. El runner/factory real debe
dejar item `pending`, cero apply/persist/enqueue, options y selección idénticas y cero dispatch
posterior. No se repite la matriz pre-attempt/stagger/backoff/persisting de T-G.1–T-G.13.

Refines, manual upload/save, notice residue, cancel control y collector conservan exactamente PG.
Un append cancelado no se auto-reofrece porque la categoría sigue no vacía; reintentar es otro
clic manual y otro costo.

### G9 — Honestidad de tests, boundaries y copy

D5: fixtures/payloads se capturan de `git show` en los SHAs fijados, no del worktree. D7: cada
test nuevo prueba base-red o una mutación nombrada; wiring se prueba cortándolo. Las cuatro
divergencias `count:4→2` y las tres adaptaciones adicionales de firma se declaran por separado.
Toda mutación se revierte y termina con tracked state limpio.

Claims de editor/DOM/persistencia/concurrencia renderizan el `CuentacuentoEditor` de producción y
usan hook, runner, factories, parser/toast y `ImageSelector` reales. Sólo se mockean límites
externos Supabase/auth/table/storage/functions, browser y timers. Tests de fábrica/runner pueden
controlar el provider externo directamente. No valen wrappers internos, hooks mockeados ni grep
como prueba de conducta.

Toda copy nueva es española (D8). Plantar tanto un token obviamente malformado como uno de forma
léxica aceptable en prompt/provider/extra fields y probar que ningún valor llega a labels/title;
las copies son constantes del cliente. Una mutación que interpole cualquiera de las dos formas
debe fallar.

### G10 — Gates, scope y cierre

D6 se mide base y head con Node `v22.22.0` y
`npx vitest run --no-file-parallelism`. Base = 878 total con sólo Mesa-six, TypeScript 1041 y
ESLint 159 (116/43). Head puede añadir tests, pero mantiene exactamente esas seis fallas y cero
identidades TypeScript/ESLint nuevas; se comparan multisets normalizados en ambas direcciones, no
raw-count “clean”. `supabase/**` diff vacío; fixture `70204600…` y
`useCuentacuentosDraft.a3.test.ts` intactos. Sin Playwright ni provider live. No merge, push,
deploy o infra (D9).

## REPLACEMENT ACCEPTANCE CRITERIA

Estos criterios reemplazan T-H.1–T-H.10 por completo.

- **T-H.1 — Conteo, tier y consumidores de firma.** Cover/end generate envían exactamente
  `count:2, modelTier:'pro'`. Re-barrido completo confirma los cuatro pins de conteo. Las siete
  construcciones directas de fábrica en las dos suites reciben `append` + setter generate-only;
  las tres que no contienen count se registran como adaptaciones de firma, no divergencias de
  conducta. Refine bodies siguen sin count y con tier pro.
- **T-H.2 — Apply append/replace.** Matriz cover/end: append con selección existente preserva
  options antiguas primero, añade en orden, actualiza ref+state y mantiene índice e imagen;
  replace con options/selección stale reemplaza y limpia ref+state. Mutaciones de ref viva,
  orden, setter o clear fallan.
- **T-H.3 — Collector y alcanzabilidad.** Collector vacío construye `append:false` y conserva su
  conducta para ambos items; no vacío produce cero tasks. Los cuatro callsites UI no vacíos pasan
  `append:true`; una mutación que envíe false falla.
- **T-H.4 — Las cuatro superficies UI.** Header + `ImageSelector`, cover + end, muestran la copy
  exacta y append. No existe regenerate-batch replace. Empty labels siguen exactos; sheets/scenes
  mantienen callsites sin prop y output existente. Todo se prueba mediante editor real.
- **T-H.5 — Guard global y matriz disabled.** Con provider estacionado, doble clic en cada
  superficie y cover→end/end→cover same-tick dejan exactamente un invoke y un token, sin abort ni
  displacement. Running, persisting, refine y approval deshabilitan o hacen inaccesibles las
  cuatro superficies. Base-red demuestra el displacement actual; mutaciones item-only,
  render-snapshot-only o sin handler guard fallan.
- **T-H.6 — Batch parcial.** Cover/end append de una sola imagen conserva todas las antiguas y la
  selección; cero imágenes mantiene options/selección y muestra el error FE tanto para
  FunctionsHttpError como para 200 `success:false`.
- **T-H.7 — Persistencia/reload.** Cadena editor real 2→4, payload de hook observado, remount/reload
  real sin `initialStory`, cuatro options recuperadas en orden y misma selección/imagen elegida.
  PB path shape y T-A3.5 permanecen intactos.
- **T-H.8 — Contabilidad.** Multiset de invokes: cada clic aceptado = una invocación edge con
  count 2; cover+end inicial = dos invokes/4 imágenes pro solicitadas. La prueba FE no finge
  observar fan-out provider: esa implicación se atribuye al código read-only `10d1190`. El texto
  de costos contiene fórmula, poblaciones y exclusiones de G7.
- **T-H.9 — Cancel append.** La matriz parameterizada cover/end de G8 prueba late resolve tras
  cancel, pending, cero apply/persist/enqueue/post-cancel dispatch y estado/selección intactos.
  Es suficiente junto a T-G.1–T-G.13; no se duplica la matriz PG.
- **T-H.10 — Compatibilidad.** Los cuatro refines reemplazan su slot por valor como antes;
  sheets/scenes/prop, upload, collector, lifecycle, notices, runner y hook de producción no
  cambian. Suites PFE/PB/PG/PC-UI relevantes verdes; cualquier diferencia es FINDING.
- **T-H.11 — D5/D7/D8/G10.** Cada test tiene base-red o mutación registrada con SHA, runtime,
  falla, revert y estado limpio. Wiring, no-replace, guard global, labels y ambas formas de
  hygiene son mutation-sensitive. Claims component-level cumplen la frontera literal G9.
- **T-H.12 — D6 y scope.** Full serial Vitest, TypeScript y ESLint cumplen G10 con deltas de
  identidad vacíos; diff de producción exactamente dos archivos, `supabase/**` vacío, fixture y
  T-A3.5 intactos, sin provider, Playwright, merge, push o deploy.

## RESPUESTAS FINALES Q1–Q7

### Q1 — Base/topología

**CONFIRMAR con G1.** Una rama FE desde `8ceec7c`; ninguna rama edge; `10d1190` sólo lectura.

### Q2 — Consecuencia no-replace

**CONFIRMAR con G3.** La respuesta de Brent elimina el regenerate-batch destructivo de cover/end.
Sheets/scenes conservan replace + append. Refine sigue siendo reemplazo de un slot y no contradice
la decisión.

### Q3 — Clear de `!append`

**CONFIRMAR con G2/G4.** Es la alineación correcta con sheets/scenes y elimina el índice stale.
En producción post-PH sólo se llama false desde options vacías; la fábrica prueba además el caso
stale no vacío para que el clear sea load-bearing.

### Q4 — Prop aditiva de `ImageSelector`

**CONFIRMAR con G3.** Una prop opcional de label con default exacto es el cambio mínimo. Los
callsites sheets/scenes no cambian; cover/end pasan copy append-honest exacta.

### Q5 — Guards concurrentes

**HANDLER SÍ; runner NO, con la corrección G5.** Closure + guard vivo global en ambos handlers
son suficientes. Un guard sólo por item no lo es. El runner PG-frozen no se toca.

### Q6 — Profundidad cancel

**UNA matriz nueva es suficiente si está parameterizada cover/end y usa late resolve
abort-ignoring.** Es el único apply nuevo; PG ya cubre el resto de boundaries. G8/T-H.9 fijan la
forma exacta.

### Q7 — Completitud

T-H.1–T-H.12 reemplazan el borrador. Confirman los cuatro pins de count y añaden: tres consumidores
de firma no-count, setters generate-only, carrera global cover↔end, distinción 200-empty vs
429/500, batch parcial, copy exacta, fórmula/poblaciones de costo, exclusión explícita de
text/thinking output, frontera G10 y cancel parameterizado.

## FINAL CLOSE

Con [S1]–[S3] PM-verificados y aplicados, y G1–G10 + T-H.1–T-H.12 incorporados como spec PH
autoritativa, el veredicto es **EXECUTABLE**. Sin el texto sustitutorio, no lo es. Esta revisión
de spec queda fuera del cap; la primera revisión de la futura rama executor sigue siendo ronda
1/2 y el reporte del executor vuelve sólo al PM (gate 2).
