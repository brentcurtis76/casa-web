# LEDGER — UPGRADE

### 2026-08-06 — plan round 1 — PM (Fable)
- SESSION: UPGRADE · plan · PM
- ACTION: Drafted PLAN.md rev 1 (6 fases) tras leer el subsistema Mesa Abierta y medir
  la línea base de los 7 gates en `1732bee`.
- COMMITS: (sin commit — borrador de plan)
- TESTS: baseline medida — tsc 1041 · eslint 160 (117/43) · vitest 1036 pass/6 fail ·
  build ok · deno test 409/0 · deno lint 94 · deno check 46. Node v22.22.0, Deno 2.7.11.
- FINDINGS RAISED: (n/a — fase de planificación)
- DECISIONS: D1 cuota ceil(personas/5) elegida por Brent; D2 columna con polaridad
  positiva; D5 intercambios 1↔1; D6 regla duplicada entre runtimes; D7 anfitrión primero.
- OPEN AFTER THIS ROUND: revisión adversarial de Codex.

### 2026-08-06 — plan round 1 — Codex Sol (REVIEW)
- SESSION: UPGRADE · plan · REVIEW
- ACTION: Revisión adversarial de PLAN.md rev 1. VERDICT: **FAIL**.
- FINDINGS RAISED: 7 BLOCKING (B1 D5 fabrica déficits resolubles · B2 seam de test
  imposible · B3 verificación contra datos reales de miembros · B4 camino de datos del
  admin ausente · B5 dashboard roto · B6 gates agregados en vez de por identidad ·
  B7 regla de prefijo de tabla no derogada), 5 SHOULD-FIX, 2 NIT.
- PM VERIFICATION: verifiqué en el código las 6 afirmaciones concretas; las 6 se sostienen.
  Dos matices menores devueltos a Codex (limpieza del script no está comentada sino al
  inicio; B1 se resuelve por ambas vías a la vez).
- DECISIONS: las 14 observaciones aceptadas.
- OPEN AFTER THIS ROUND: reescribir el plan.

### 2026-08-06 — plan round 2 — PM (Fable)
- SESSION: UPGRADE · plan · PM
- ACTION: PLAN.md rev 2. 6 → 8 fases (P3 extracción de núcleo, P8 dashboard);
  D5 ampliada a subconjuntos ≤2 con capacidad verificada; D8 reescrita a comparación por
  identidad; D12 prohíbe verificación contra la base compartida; D13 index.ts como
  adaptador delgado; PR1/PR2 como prerrequisitos bloqueantes de Brent.
- FINDINGS RAISED: (n/a)
- DECISIONS: 11 entradas nuevas en el Decision Log de PLAN.md.
- OPEN AFTER THIS ROUND: segunda revisión de Codex.

### 2026-08-06 — plan round 2 — Codex Sol (REVIEW)
- SESSION: UPGRADE · plan · REVIEW
- ACTION: Revisión de PLAN.md rev 2. VERDICT: **FAIL**. Round-1 B4 y B7 cerrados.
- FINDINGS RAISED: 7 BLOCKING (B1 el Goal sigue prometiendo más que una búsqueda local
  golosa · B2 no existe seam ejecutable: index.ts llama serve() al importar ·
  B3 la captura de P6 reintroduce dependencia de datos reales · B4 RLS impide al invitado
  calcular el agregado de su mesa · B5 los comandos de identidad no son reproducibles ·
  B6 hay tres caminos de override del admin, no uno · B7 la división de P5 ya es
  obligatoria), 3 SHOULD-FIX, 2 NIT.
- PM VERIFICATION: verifiqué las 6 afirmaciones de código (RLS en
  20241127_fix_rls_recursion.sql; serve() en ambos index.ts; los tres diálogos de
  override en MesaAbiertaAdmin.tsx:1350/1426/1453; .neq() en MesaAbiertaDashboard.tsx:96
  ausente del mock de src/test/setup.ts). **Las 6 se sostienen.** Codex además diagnosticó
  la causa real de los 6 tests en rojo, que yo había dejado como hipótesis.
- DECISIONS: las 12 observaciones aceptadas. **Tope de rondas Codex del SOP §1.5
  alcanzado (2 de 2) — decisión escalada a Brent: aceptar, replanificar o backlog.**
- OPEN AFTER THIS ROUND: decisión de alcance de Brent antes de escribir la rev 3.

### 2026-08-06 — plan round 3 — PM (Fable)
- SESSION: UPGRADE · plan · PM
- ACTION: PLAN.md rev 3, tras override explícito de Brent al tope de rondas del SOP §1.5.
  8 → 10 fases: P3 dividida en P3a (seam `handler.ts`) y P3b (extracción `matching.ts`);
  P5 dividida en P5a (frontend) y P5b (seam de `admin-add-participant`).
  D5 completamente especificada (orden de donantes, enumeración de subconjuntos,
  recálculo tras cada movimiento) y Goal reformulado a la garantía real de una búsqueda
  local golosa. D8 pasa a scripts ejecutables commiteados con base desde worktree limpio
  en 1732bee, doble ejecución y reporter JSON de Vitest. **D14 nueva**: `total_people` y
  `main_dish_count` persistidos en `mesa_abierta_matches`. Captura de pantalla eliminada
  como criterio. Recuentos de test delta y orden de merge lineal.
- PM VERIFICATION: verifiqué que el invitado sí puede leer su propia fila de
  `mesa_abierta_matches` (`20241127_fix_rls_recursion.sql:27`), que es lo que hace viable
  D14 sin RPC nuevo ni cambios de RLS.
- FINDINGS RAISED: (n/a)
- DECISIONS: 10 entradas nuevas en el Decision Log, incluido el override de Brent.
- OPEN AFTER THIS ROUND: 3ª revisión de Codex; PR1 y PR2 siguen pendientes.

### 2026-08-06 — plan round 3 — Codex Sol (REVIEW)
- SESSION: UPGRADE · plan · REVIEW
- ACTION: Revisión de PLAN.md rev 3. VERDICT: **FAIL**, pero convergiendo: 3 BLOCKING
  (frente a 7 y 7). Cerró r2-B2, r2-B3, r2-B6 y r2-B7.
- FINDINGS RAISED: 3 BLOCKING (B1 el Goal sigue prometiendo cobertura bajo suficiencia
  global + falta contrato de orden de salida en D5 · B2 los agregados persistidos de D14
  quedan obsoletos con cinco mutaciones del admin · B3 los canonicalizadores de D8 no son
  ejecutables: `npm run lint -f json` y resúmenes de unión reescritos), 5 SHOULD-FIX,
  1 NIT.
- PM VERIFICATION: Codex ejecutó él mismo el cambio de `types.ts` en un worktree aislado y
  midió 458→456 identidades únicas con 112 falsas nuevas por `... 11 more ...` →
  `... 12 more ...`. Verifiqué en el código los cinco flujos de mutación del admin que
  invalidan los agregados persistidos, y que el mock efectivo del dashboard es el local
  del propio fichero de test, no el de `src/test/setup.ts`.
- DECISIONS: las 9 observaciones aceptadas. **B2 era un error de diseño del PM**: la
  respuesta es eliminar las columnas persistidas y sustituirlas por una función
  `SECURITY DEFINER` en vivo (D14 reescrita), no mantener el invariante con triggers.
- OPEN AFTER THIS ROUND: revisión 4.

### 2026-08-06 — plan round 4 — PM (Fable)
- SESSION: UPGRADE · plan · PM
- ACTION: PLAN.md rev 4. 10 → 11 fases (P0 nueva: herramientas de gates separadas del
  esquema, por el tope de 10 ficheros). D14 reescrita de columnas persistidas a
  `get_my_dinner_summary()` `SECURITY DEFINER` en vivo — elimina la clase de bug de
  obsolescencia y el caso NULL de los 6 matches heredados. Goal sin cláusula de
  suficiencia global. D5 gana contrato de orden de salida y precondiciones validadas.
  Canonicalizadores corregidos (`npx eslint -f json`, normalización `... N more ...`) con
  criterio Z5 de estabilidad ante un cambio benigno real. Allowlist de goldens congelada
  en P4 (solo tests 5 y 6). P8 arregla el mock local, no `src/test/setup.ts`.
- FINDINGS RAISED: (n/a)
- DECISIONS: 6 entradas nuevas en el Decision Log.
- OPEN AFTER THIS ROUND: 4ª revisión de Codex; PR1 y PR2 siguen pendientes.

### 2026-08-06 — plan round 4 — Codex Sol (REVIEW)
- SESSION: UPGRADE · plan · REVIEW
- ACTION: Revisión de PLAN.md rev 4. VERDICT: **FAIL**. 3 BLOCKING, 2 SHOULD-FIX, 1 NIT.
- FINDINGS RAISED: B1 el tope `tables.length * 10` es falsable (déficit 21, capacidad 100)
  y el contrato de orden/aleatorización está incompleto · B2 el contrato `SECURITY DEFINER`
  no está endurecido (search_path, EXECUTE a PUBLIC por defecto, faltan clases de llamante)
  · B3 la RPC falta en el mapa `Functions` y añadirla refuta Z5 (458→460, 13/11).
- OPEN AFTER THIS ROUND: revisión 5.

### 2026-08-06 — plan round 5 — PM (Fable)
- SESSION: UPGRADE · plan · PM
- ACTION: PLAN.md rev 5. **El PM ejecutó por fin la medición que debió hacer en la ronda 3**:
  worktree limpio en 1732bee, `node_modules` enlazado, Node v22.22.0.
- MEDICIONES (crudas, reproducibles):
  - base: 1041 líneas `error TS`; Variante A (sort -u) = **458** identidades — reproduce
    exactamente el número de Codex; Variante D (colapsar literales, multiplicidad) = 1041.
  - edición **solo campos**: crudo 1041→**1039**; Variante A **0 añadidas / 2 eliminadas**;
    Variante D **0 añadidas / 2 eliminadas**. Las 2 eliminadas son los errores de
    `host_food_assignment` en `MesaAbiertaAdmin.tsx` (TS2339, TS2353).
  - edición **campos + RPC en `Functions`**: crudo 1041→**1043**; Variante A 458→460
    (13 añadidas / 11 eliminadas) — reproduce a Codex; Variante D **4 añadidas / 2
    eliminadas**. Las 13 de la Variante A mencionan **todas** los símbolos nuevos, es decir
    son reformulaciones; pero **4 sobreviven al colapso de literales y son diagnósticos
    genuinamente nuevos**, todos en `src/lib/music-planning/songUsageService.ts`.
- DECISIONS: **D15 nueva** — la RPC no se añade al mapa `Functions`; P8 la llama con la
  convención de RPC sin tipar que el repo ya usa en cinco sitios, y su contrato lo dan los
  tests A5–A8 de P1. **Se adopta la Variante D** de canonicalización. Tope de D5 derivado
  de `Δ₀` con demostración de terminación. Contrato SQL exacto de D14 con `search_path=''`,
  `REVOKE`/`GRANT` y cuatro clases de llamante. P0 baja a 3 ficheros. P6 extrae los tres
  diálogos de override.
- FINDINGS RAISED: (n/a)
- OPEN AFTER THIS ROUND: 5ª revisión de Codex; PR1 y PR2 siguen pendientes.

### 2026-08-06 — plan round 5 — Codex Sol (REVIEW)
- SESSION: UPGRADE · plan · REVIEW
- ACTION: Revisión de PLAN.md rev 5. VERDICT: **FAIL**. 5 BLOCKING (subió desde 3).
- FINDINGS RAISED: B1 el recorrido de D5 solo mira la primera mesa deficitaria · B2 la
  condición de excepción tiene un off-by-one y los tests 21/22 se contradicen · B3
  `SIDE_FOODS` y el rango de `pick` sin congelar · B4 D15 no es ejecutable: una `.rpc()`
  no listada sí produce TS2345 · B5 la Variante D tiene 62 cubos de colisión.
- PM VERIFICATION: confirmado el inventario de RPC sin tipar — son **siete**, no cinco
  (`decrement` en MesaAbiertaAdmin.tsx:785 y `save_liturgy_slides_positions` en
  saveToLiturgyService.ts:635). Codex confirmó de forma independiente la medición del PM
  sobre los 4 diagnósticos nuevos en songUsageService.ts, y dio por cerrado D14.
- DECISIONS: **Diagnóstico del PM**: cuatro de los cinco bloqueantes atacaban dos
  exigencias inventadas por el propio PM en las rondas 3–5 ("dos implementaciones
  byte-idénticas" y un esquema global de identidad de diagnósticos), no requisitos de
  Brent. **Brent autorizó retirarlas** en vez de seguir endureciéndolas.
- OPEN AFTER THIS ROUND: revisión 6.

### 2026-08-06 — plan round 6 — PM (Fable)
- SESSION: UPGRADE · plan · PM
- ACTION: PLAN.md rev 6, re-planificación. D5 pasa de procedimiento congelado a **ocho
  garantías** verificables por test (el recorrido lo decide P2). D8 pasa de identidad
  global a **cero diagnósticos nuevos en los ficheros que la fase toca**, con canario
  negativo en P0. Adaptador de RPC en P8 con una única conversión documentada y validación
  en runtime (B4). P6 baja a 9 ficheros (S1) y enumera las cuatro props de cada montaje
  como verificación estática declarada (S2). Las seis declaraciones de `types.ts` se fijan
  literalmente como `string | null` (S3). Inventario de RPC corregido a siete (N1).
- DECISIONS: 4 entradas nuevas, dos de ellas retiradas de decisiones previas propias.
- OPEN AFTER THIS ROUND: 6ª revisión de Codex; PR1 y PR2 siguen pendientes.

### 2026-08-06 — plan round 6 — Codex Sol (REVIEW)
- SESSION: UPGRADE · plan · REVIEW
- ACTION: Revisión de PLAN.md rev 6. VERDICT: **FAIL**, 2 BLOCKING (bajó desde 5).
- FINDINGS RAISED: B1 a D5 le faltan tres invariantes (asignar exactamente
  min(requeridos, dispuestos); decrecimiento estricto del déficit como garantía propia;
  conservación del conjunto de participantes sin duplicados ni pérdidas) · B2 el gate D8
  sigue teniendo falsos negativos dentro de F (comparar recuentos por código deja pasar
  una sustitución; y comparar siempre contra 1732bee permite reintroducir un diagnóstico
  eliminado antes), más P5a declara F=8 cuando toca 9 ficheros. 2 SHOULD-FIX, 1 NIT.
- CODEX CONFIRMA: la retirada de las dos exigencias inventadas es **acertada**; el
  contraejemplo de recorrido de la ronda 5 puede terminar legítimamente como déficit
  reportado; el gate acotado es proporcionado. r5-B4/S1/S2/S3/N1 cerrados.
- PM VERIFICATION: confirmado el error de conteo de P5a (9 ficheros, no 8).
- OPEN AFTER THIS ROUND: revisión 7.

### 2026-08-06 — plan round 7 — PM (Fable)
- SESSION: UPGRADE · plan · PM
- ACTION: PLAN.md rev 7. D5 pasa de 8 a **11 garantías** (añadidas: decrecimiento estricto
  como garantía propia; asignar exactamente min(requeridos, dispuestos); conservación del
  conjunto de participantes — clase de fallo que este código ya tuvo, ver comentario de
  `index.ts:305`). D8 compara **mensajes crudos completos contra la fase padre inmediata**,
  no recuentos por código contra la base; Z5 gana un **canario de sustitución** además del
  de adición. Se retira la afirmación de que los tests "demuestran" las garantías: se
  sustituye por verificador de invariantes reutilizable + tabla de fixtures adversariales +
  revisión de código del invariante del bucle. P5a corregido a F=9. Test 2 de
  `dinnerSummary` dirigido por tabla. Frase "byte-idéntico" de P4 reformulada.
- ARITMÉTICA ACTUALIZADA: P2 pasa de 16 a 19 tests Deno → Deno +62 = **471/0**;
  Vitest +32 y 6 rojos reparados = **1074/0**.
- OPEN AFTER THIS ROUND: 7ª revisión de Codex; PR1 y PR2 siguen pendientes.

### 2026-08-06 — plan round 7 — Codex Sol (REVIEW)
- SESSION: UPGRADE · plan · REVIEW
- ACTION: Revisión de PLAN.md rev 7. **VERDICT: PASS.** Cero BLOCKING, cero SHOULD-FIX,
  2 NIT (referencia cruzada a "propiedad 7" cuando el déficit es la garantía 10; título
  "Aritmética de tests (revisión 6)" con totales de la revisión 7).
- CODEX CONFIRMA: las once garantías de D5 son suficientes leídas junto a D1, D7, el
  contrato de `SIDE_FOODS` y el test 7. D8 establece la garantía local por fichero que
  pretende, con su limitación declarada. Adaptador de RPC, P6 a nueve ficheros y H7,
  cerrados. Aritmética correcta: Deno 471/0, Vitest 1074/0. Remedición independiente de
  la base: tsc 1041 líneas crudas, ESLint 160 (117/43).
- PM ACTION: los 2 NIT corregidos en la misma revisión (una referencia cruzada errónea
  dentro de una decisión congelada es un riesgo real para el ejecutor, no cosmética).
- DECISIONS: **PLAN CONGELADO 2026-08-06.** Enmendada la condición de congelación: el PASS
  congela el texto; PR1 y PR2 pasan a bloquear la ejecución de P1, no la congelación.
- OPEN AFTER THIS ROUND: PR1 y PR2 (Brent). Después, bootstrap de PM para P0 (SOP §3.3).

### 2026-08-06 — prerrequisitos PR1 y PR2 — PM (Fable) + Brent
- SESSION: UPGRADE · plan · PM
- ACTION: Auditoría de PR1 y concesión de ambos prerrequisitos. **P1 desbloqueada.**
- HALLAZGOS DE LA AUDITORÍA (todos verificados, no supuestos):
  - La premisa de `CLAUDE.md:77` es **cierta**: el proyecto `mulsqxfhxxdsadxsljss` aloja
    11 tablas de Life OS (`goals`, `habits`, `habit_logs`, `health_logs`,
    `journal_entries`, `life_areas`, `lifeos_calendar_events`, `lifeos_tasks`,
    `meditation_logs`, `project_health`, `workout_logs`) junto al esquema de CASA.
  - Open Brain es un proyecto **distinto** (`nnfwmjqrvyvtpfrxnkvz`): lo compartido es la
    base de la aplicación, no el almacén de memoria.
  - La regla literal estaba obsoleta: de 128 tablas solo 61 son `church_*`; CASA posee
    además `music_*` (21), `mesa_*` (10), `casa_*` (3), `liturgia*`, `graphics_*`,
    `cuentacuentos_*`, `sermon_*`, `presentation_*`, `financial_*`. Leída al pie de la
    letra habría prohibido los esquemas de música, RBAC y finanzas, ya enviados.
  - `mesa_abierta_*` sin enredos: 0 claves foráneas desde tablas ajenas (consulta sobre
    `pg_constraint`), 0 vistas/reglas dependientes (consulta sobre `pg_depend`), y 0
    referencias en el código de Life OS (la única coincidencia en SecondBrain es un
    fixture de benchmark que describe una tarea de CASA).
- DECISIONS: **PR1 concedido** por Brent. **PR2 concedido** por Brent. `CLAUDE.md:77`
  reescrita para nombrar las 11 tablas de Life OS en vez de un prefijo, con nota de la
  corrección y su fecha.
- NOT DONE: la migración de P1 **no** existe todavía; la escribe P1. Esta sesión es de
  planificación y no escribe código fuente (SOP §1.1). PR2 queda registrado y disponible
  para que P1 lo consuma.
- OPEN AFTER THIS ROUND: bootstrap de PM para P0 (SOP §3.3).

### 2026-08-06 — P0 round 1 — PM (Fable)
- SESSION: UPGRADE · P0 · PM
- ACTION: Bootstrap de PM para P0 (SOP §3.3). Escrito el prompt de ejecutor
  `docs/plan/upgrade/prompts/P0-r1.md` (SOP §3.4). P0 pasa a IN PROGRESS en el índice
  de fases.
- PM VERIFICATION (medido, no supuesto, en `19c44aa`):
  - `npx eslint . -f json` produce JSON válido con `filePath` **absoluto** — el script
    debe relativizar. `deno lint --json` produce JSON con `filename` como URL `file://`.
    Ambos riesgos declarados en P0 quedan resueltos: el formato existe.
  - `deno check .` **no** tiene modo JSON, emite escapes ANSI incluso por tubería, y sus
    diagnósticos son multilínea (mensaje primero, `at file://…:línea:col` después). Es el
    único riesgo real de la fase y así se le comunica al ejecutor.
  - Los cuatro comandos salen con código distinto de cero; un `set -e` ingenuo mata el
    script. Advertido explícitamente.
  - `git diff --name-only 1732bee HEAD` → el único fichero **fuente** que cambió desde la
    base es `src/components/ui/header.tsx`, que no está en la `F` de ninguna fase. La
    línea base tomada en `1732bee` (Z3) sigue siendo válida para la lista de Z6.
  - Desambiguación necesaria para Z5b: `MesaAbiertaAdmin.tsx` existe dos veces;
    `src/pages/` es un re-export de 29 líneas y `src/components/mesa-abierta/` el real de
    2227. Todas las referencias de línea del plan (`:226`, `:511`, `:785`, `:1350`,
    `:1426`, `:1453`) resuelven contra el de `components/`. Igual para
    `MesaAbiertaDashboard.tsx` (`:96`, `:139`). El prompt lo fija.
  - Lista de Z6 derivada de los Scope de P1–P8: **11 ficheros existentes en `1732bee`**;
    el resto de ficheros de esas fases los crea su propia fase y no tienen línea base.
- COMMITS: (pendiente — el prompt se commitea con esta entrada)
- TESTS: (n/a — ronda de preparación; no se ejecutó ningún gate nuevo)
- FINDINGS RAISED: (n/a)
- DECISIONS: ninguna nueva. El prompt no relaja ningún criterio del plan congelado.
- OPEN AFTER THIS ROUND: ejecución de P0 r1 en sesión fresca.

### 2026-08-06 — P0 round 1 — Ejecutor (Opus)
- SESSION: UPGRADE · P0 · r1 · EXEC
- BRANCH: `feat/mesa-md-gates` (desde `19c44aa`) · COMMIT: `bc48eee`
- ACTION: Implementado el gate D8. Tres ficheros nuevos, cero código de producto:
  `scripts/gates/changed-files-diagnostics.sh`, `scripts/gates/README.md`,
  `docs/plan/upgrade/evidence/base-by-file.txt`.
- IMPLEMENTACIÓN: cada herramienta se ejecuta **una vez** sobre todo el proyecto y su
  salida se atribuye por ruta. Agrupación de diagnósticos multilínea: `tsc` por cabecera
  en columna 0 + continuaciones indentadas (verificado: 1041 líneas de columna 0 = 1041
  cabeceras, ninguna continuación contiene `error TS`); `deno check` desde
  `TSxxxx [ERROR]:` hasta su primera línea `at file://…` (verificado: 46 bloques / 46
  líneas `at`, correspondencia 1:1). Sin canonicalización, sin hashing, sin cubos.
- ÚNICA NORMALIZACIÓN (documentada en el README): la línea `at file:///…` de `deno check`
  trae la ruta **absoluta y percent-encoded** del checkout y se reescribe a ruta relativa
  al repo. Sin esto la base tomada en `/tmp/upgrade-base` no sería comparable con nada
  medido en el checkout normal y **los 46 diagnósticos de `deno check` parecerían nuevos**.
  El texto del mensaje no se toca.
- TESTS (verbatim en el informe del ejecutor):
  - `npm run build` → `✓ built in 13.45s`.
  - `npx vitest run --no-file-parallelism` → **1036 pass / 6 fail**, los 6 en
    `MesaAbiertaDashboard.test.tsx` (Z7 cumplido). **Una ejecución previa dio 1035/7**: el
    7º fallo fue `CuentacuentoEditor.ph.surfaces.test.tsx` por timeout de `waitFor`, no se
    reprodujo, y esta rama no toca `src/`. Se registra como test inestable preexistente.
  - `deno test --allow-all .` desde `supabase/functions/` → **409 passed | 0 failed**.
  - Línea base sin tocar: `tsc` 1041, ESLint 160 (remedidos en la punta de la rama).
- ACCEPTANCE: Z1 ✅ · Z2 ✅ (`grep -n 'npm run lint'` → 0 hits) · Z3 ✅ (worktree en
  `1732bee`, `node_modules` enlazado, cabecera con SHA y comando, worktree eliminado) ·
  Z4 ✅ (byte-idéntico sobre 2 ficheros y sobre el set completo de 11) · Z5a ✅ (canario de
  adición en `create-mesa-matches/index.ts`: aparece el TS2322 nuevo y el resto son
  desplazamientos de línea) · Z5b ✅ (canario de sustitución en `MesaAbiertaAdmin.tsx`:
  recuento 12 y código TS2339 **idénticos**, y aun así el `diff` muestra el mensaje nuevo
  y la desaparición del viejo — **el gate no es decorativo**) · Z6 ✅ (los 11 ficheros) ·
  Z7 ✅. Ambos canarios revertidos; `git status` sin ficheros rastreados modificados.
- FINDINGS RAISED: ninguno. Los cuatro formatos asumidos en los Risks de P0 resultaron
  utilizables; el único riesgo real (`deno check` multilínea + ANSI + ruta absoluta) quedó
  resuelto y documentado.
- NOT DONE: `CuentacuentoEditor.ph.surfaces.test.tsx` es inestable (1 de 2 ejecuciones);
  fuera del alcance de P0. `docs/plan/audio/` apareció sin rastrear durante la sesión y no
  es de esta fase; se deja intacto.
- OPEN AFTER THIS ROUND: verificación independiente del PM; después P1 (desbloqueada por
  PR1/PR2) sobre esta rama.

### 2026-08-06 — P0 round 1 — PM (Fable) — VERIFICACIÓN
- SESSION: UPGRADE · P0 · PM
- ACTION: Verificación independiente del EXECUTOR REPORT de P0 r1 (`bc48eee`, `552a1ff`).
  1 BLOCKING, 1 SHOULD-FIX, 1 NIT. Prompt de remediación en `prompts/P0-r2.md`.
- LO QUE VERIFIQUÉ YO MISMO (no acepté ninguna afirmación del reporte):
  - **Alcance**: `git diff --stat main..feat/mesa-md-gates` = 4 ficheros, +533/-0. Los 3 del
    Scope más el ledger. **Cero ficheros bajo `src/` o `supabase/`.** `git worktree list`
    muestra solo el checkout principal — el worktree de la base fue retirado.
  - **Z4 (reproducibilidad)**: ejecuté el script dos veces sobre 4 ficheros; `diff` vacío.
  - **Z1**: recuento + detalle por fichero en las cuatro herramientas; una ruta inexistente
    (`src/lib/mesa-abierta/noExiste.ts`) emite `(0)`×4 sin romper. Comprobado que el `(0)`
    de `types.ts` es real y no un fallo de filtrado (`tsc | grep -c types.ts` → 0).
  - **Z3 + Z6 + la deriva `1732bee`↔`HEAD`, todo de una vez**: ejecuté el script sobre los
    11 ficheros de la base en el checkout principal y lo comparé con el cuerpo de
    `base-by-file.txt` (capturado en `/tmp/upgrade-base` a `1732bee`). **Diff vacío.** Esto
    reproduce la base entre dos checkouts distintos y valida la única desviación del
    ejecutor: la reescritura de la línea `at file://…` de `deno check` a ruta relativa. Sin
    ella los 46 diagnósticos de `deno check` habrían parecido nuevos.
  - **Z7**: `npm run build` ok (9.17s). `npx vitest run --no-file-parallelism` → **1036
    pass / 6 fail**, y los 6 nombres son exactamente los seis de
    `MesaAbiertaDashboard.test.tsx`. `deno test --allow-all .` → **409 passed / 0 failed**.
  - **Z2**: `grep -n 'npm run lint'` sobre el script → 0; usa `npx eslint . -f json` (:36).
  - Leí el script entero (141 líneas) y el README (163).
- LO QUE **NO** VERIFIQUÉ POR MI CUENTA: los canarios Z5a/Z5b. Reproducirlos exige editar
  fichero fuente, y el SOP §1.1 me lo prohíbe. Verifiqué en su lugar el **mecanismo**: el
  script emite el mensaje crudo completo, y la línea base contiene
  `MesaAbiertaAdmin.tsx(1689,57): error TS2339: Property 'hostsConvertedToGuests'…` — el
  estado previo exacto del canario de sustitución. Una sustitución cambia el texto del
  mensaje y por tanto el `diff`. El `diff` que pegó el ejecutor es consistente con eso.
  **Codex debería reejecutar Z5b él mismo en la revisión final.**
- FINDINGS RAISED:
  - **[B1] BLOCKING — el gate pasa en silencio si una herramienta no llega a ejecutarse.**
    `readJson()` traga todo error de parseo y devuelve `[]`; si `tsc` no arranca, su fichero
    de salida no tiene cabeceras y da cero. Sin stderr, sin código de salida. Lo demostré:
    con `deno` fuera del `PATH`, el script emite `(0)` en las cuatro herramientas para
    `create-mesa-matches/index.ts` — cuya base real es `deno lint (4)` y `deno check (6)` —
    y **sale con 0**. Como el criterio D8 es "cero diagnósticos **nuevos**", una cadena de
    herramientas rota no falla el gate: lo **aprueba**, para P1–P8. Es la misma clase de
    falso negativo que Z5b existe para excluir. Además el plan ya pedía la mitigación y el
    script no la implementa: **D8 punto 5** exige registrar los recuentos globales
    (1041/160/94/46) como observación para detectar sorpresas, y el script no emite ninguno.
  - **[S1] SHOULD-FIX — test intermitente ajeno al workstream.** La primera pasada del
    ejecutor dio 1035/7: un timeout de `waitFor` en
    `src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.ph.surfaces.test.tsx`.
    No reprodujo ni en su segunda pasada ni en la mía. Esta rama no toca `src/`, así que no
    es causado por P0. **Backlog** — no se arregla en esta fase.
  - **[N1] NIT — agrupación de `tsc`.** La rama `else if (cur) cur.push(line)` absorbe en el
    diagnóstico anterior cualquier línea en columna 0 que no sea cabecera. Hoy no existe
    ninguna (1041 líneas de columna 0 = 1041 cabeceras, verificado) y el README lo declara.
    Solo lo registro.
- BACKLOG ADDED: S1 (test intermitente de `CuentacuentoEditor.ph.surfaces`).
- DECISIONS: la desviación del ejecutor (normalizar la ruta de la línea `at` de
  `deno check`) se **acepta**: es necesaria para que Z3 y Z4 sean compatibles entre sí, no
  toca el texto del mensaje, y la verificación cruzada entre checkouts la demuestra correcta.
- OPEN AFTER THIS ROUND: P0 r2 — un único bloqueante, B1.

### 2026-08-06 — P0 round 2 — EJECUTOR (Opus 5) — REMEDIACIÓN B1
- SESSION: UPGRADE · P0 · r2 · EXEC
- BRANCH: `feat/mesa-md-gates` (sobre `f776e56`, sin reescribir la ronda 1)
- ACTION: cerrado el único bloqueante B1 — el gate ya no puede aprobar en silencio cuando
  una herramienta no llega a ejecutarse. Dos ficheros tocados: el script y su README.
- CAMBIOS:
  - `changed-files-diagnostics.sh`: contador **global** por herramienta dentro de `put()`;
    `readJson()` ahora registra el error de parseo en vez de tragárselo; tras emitir stdout
    se escribe **por stderr** `[gates] totales del proyecto: tsc=… eslint=… deno-lint=…
    deno-check=…` en toda ejecución; si alguna de las cuatro da **cero global** o JSON no
    parseable, se nombra la herramienta, se vuelca su stderr capturado y se sale con
    `exitCode = 1` (no `exit()`, que truncaría stdout en una tubería).
  - `scripts/gates/README.md`: sección nueva "Detección de «la herramienta no corrió»" con
    el modo de fallo reproducido, por qué los totales van por stderr y no por stdout, y el
    supuesto declarado *un cero global significa que la herramienta no corrió*.
- **stdout NO cambia.** La lógica de atribución, el orden, la agrupación de `deno check` y
  la normalización de rutas quedan intactas; el diff contra `bc48eee` solo toca la firma de
  `readJson`, una línea de contador en `put()` y el bloque nuevo posterior a la emisión.
- EVIDENCIA:
  - R1: ejecución sobre los 11 ficheros de la base → stderr
    `[gates] totales del proyecto: tsc=1041 eslint=160 deno-lint=94 deno-check=46`, EXIT=0.
  - R2: sonda del PM con `deno` fuera del `PATH` → **EXIT=1**, stderr nombra `deno-lint`
    (JSON no parseable) y `deno-check` (cero global) e incluye su `deno: command not found`.
  - R3: `diff` del stdout de los 11 ficheros contra `base-by-file.txt` sin cabecera `#` →
    **vacío** (157 líneas ambos). La base commiteada sigue siendo válida; no se regeneró.
  - R4: dos ejecuciones consecutivas → `cmp` sin diferencias (Z4 se mantiene).
  - R5: `git diff bc48eee -- scripts/gates/changed-files-diagnostics.sh` muestra la ruta de
    atribución/emisión sin modificar, luego el mecanismo del canario Z5b sigue intacto.
  - R7: `npm run build` OK (13.29s) · `npx vitest run --no-file-parallelism` → **1036 pass /
    6 fail**, los seis en `MesaAbiertaDashboard.test.tsx` · `deno test --allow-all .` →
    **409 passed / 0 failed**. El intermitente de `CuentacuentoEditor.ph.surfaces` no saltó.
- FUERA DE ALCANCE, RESPETADO: ningún diagnóstico arreglado (la base sigue en
  1041/160/94/46), nada bajo `src/`, `supabase/`, `package.json`, configs, `PLAN.md` ni
  `base-by-file.txt`. `docs/plan/audio/` sigue sin rastrear e intacto.
- OPEN AFTER THIS ROUND: verificación independiente del PM sobre B1; después P1.

### 2026-08-06 — P0 round 2 — PM (Fable) — VERIFICACIÓN
- SESSION: UPGRADE · P0 · PM
- ACTION: Verificación independiente del EXECUTOR REPORT de P0 r2 (`5e01a3e`). **B1 cerrado.
  Cero BLOCKING, cero SHOULD-FIX nuevos.** Fase limpia a mi juicio; P0 pasa a IN REVIEW.
- LO QUE VERIFIQUÉ YO MISMO:
  - **B1 cerrado, con mi sonda exacta de la ronda 1.** Con `deno` fuera del `PATH` el script
    ahora **sale con 1**, nombra las dos herramientas caídas, distingue la causa (JSON no
    parseable vs cero global) e incluye el stderr capturado
    (`deno: command not found`). Antes: `EXIT=0`, stderr vacío.
  - **R1**: en una ejecución sana, `EXIT=0` y por stderr
    `[gates] totales del proyecto: tsc=1041 eslint=160 deno-lint=94 deno-check=46` — los
    cuatro recuentos de la línea base, que es lo que pedía D8 punto 5.
  - **R3, el criterio que protegía la base**: reejecuté el script sobre los 11 ficheros y
    comparé stdout con el cuerpo de `base-by-file.txt`. **Diff vacío.** Los totales por
    stderr no contaminan el artefacto que se difea; `base-by-file.txt` sigue válido sin
    regenerarse.
  - **R4**: dos ejecuciones consecutivas, `cmp` sin diferencias.
  - **R5**: leí `git diff bc48eee..HEAD` del script (+49/-3). Toca **solo** la firma de
    `readJson`, una línea de contador en `put()` y un bloque nuevo **después** de
    `process.stdout.write`. El parser de `tsc`, la atribución de ESLint y `deno lint`, la
    agrupación de `deno check`, `rel()`, el orden y la emisión quedan **sin modificar** —
    el mecanismo de Z5b está intacto.
  - **R7**: `npm run build` ok (20.10s); `npx vitest run --no-file-parallelism` → **1036
    pass / 6 fail**, los seis nombres exactos de `MesaAbiertaDashboard.test.tsx`;
    `deno test --allow-all .` → **409 passed / 0 failed**.
  - **Alcance**: `git diff --stat f776e56..HEAD` = 3 ficheros (script, README, ledger),
    +132/-3. Cero ficheros bajo `src/` o `supabase/`. `base-by-file.txt` sin tocar.
  - Leí la sección nueva del README: documenta el modo de fallo con su reproducción, por qué
    un gate que devuelve cero en silencio es peor que no tener gate, por qué los totales van
    por stderr, y el supuesto declarado con **la condición en que deja de valer** (el día en
    que arreglar la línea base sea un objetivo).
  - Corrección de método: mi primer intento de R3 pasó los 11 ficheros como un solo argumento
    (zsh no divide en palabras la expansión sin comillas). Fallo mío, no del script; repetido
    con los argumentos explícitos, diff vacío.
- LO QUE **NO** VERIFIQUÉ POR MI CUENTA: sigue siendo Z5a/Z5b — editar fuente me está vedado
  (SOP §1.1). R5 establece que el camino de emisión no cambió respecto de la ronda 1, pero
  **Codex debe reejecutar Z5b él mismo en la revisión final.**
- FINDINGS RAISED: ninguno. Las dos suposiciones del ejecutor (truncar el stderr capturado a
  20 líneas; `process.exitCode` en vez de `process.exit()` para no truncar una tubería) son
  correctas y están justificadas.
- TESTS: build ok · vitest 1036/6 (los 6 de base) · deno test 409/0 · gate sano EXIT=0 con
  totales 1041/160/94/46 · gate roto EXIT=1 con diagnóstico.
- BACKLOG: S1 sigue abierto (test intermitente de `CuentacuentoEditor.ph.surfaces.test.tsx`,
  ajeno a este workstream; no disparó en ninguna de mis dos pasadas).
- DECISIONS: ninguna nueva; no se relajó ningún criterio de P0.
- OPEN AFTER THIS ROUND: **revisión final de Codex sobre `feat/mesa-md-gates`** (SOP §3.6).
  P0 no se marca DONE hasta que Codex pase.

### 2026-08-06 — P0 revisión final Codex (ronda 1 de 2) — Codex Sol (REVIEW)
- SESSION: UPGRADE · P0 · REVIEW
- ACTION: Revisión final de P0 sobre `feat/mesa-md-gates`@`a230749`.
  **VERDICT: FAIL — 1 BLOCKING, 1 NIT.**
- FINDINGS RAISED:
  - **[B1] BLOCKING** — `changed-files-diagnostics.sh:165`: `parseErrors.has(t) || totals[t] === 0`
    clasifica como "la herramienta no corrió" una ejecución **limpia y correcta**. Codex
    reprodujo el falso positivo: ejecutó las cuatro fronteras de comando con salida válida,
    parseable, con éxito y cero diagnósticos; **los cuatro comandos salieron con 0 y el gate
    salió con 1** marcando las cuatro como caídas. Viola **D8 punto 5** (`PLAN.md:252`), que
    declara los recuentos globales observación y **"no como criterio"**. Remediación exigida:
    capturar el estado de salida de cada herramienta y distinguir tres casos — cero + éxito
    = ejecución limpia legítima; cero + fallo o salida inválida = herramienta caída; salida
    de diagnósticos esperada + diagnósticos utilizables = ejecución normal en rojo de base.
  - **[N1] NIT** — la receta de reproducción de la base omite
    `mkdir -p /tmp/upgrade-base/scripts/gates`; el directorio no existe en `1732bee`, así que
    el `cp` documentado falla tal cual está escrito (`README.md:203`,
    `base-by-file.txt:4`). Codex lo sorteó a mano y reprodujo la evidencia exactamente, así
    que no invalida Z3.
- CODEX CONFIRMA (verificación independiente, no del reporte): **Z1–Z7 MET**, incluida
  **Z5b ejecutada por él mismo** — total del fichero 12 y TS2339 6 antes y después,
  aparece el mensaje nuevo `z5bReplacementCanary` y desaparece `hostsConvertedToGuests`;
  mutación revertida. Z3 reproducido en worktree fresco a `1732bee` con coincidencia exacta.
  Z4 byte-idéntico incluidos los totales por stderr. Sin creep de código de producto. **D12
  sin violación.** Las sondas de Deno ausente y de error de sintaxis fallan cerrando con
  stderr accionable. Vio una vez el flake conocido de `CuentacuentoEditor.ph.surfaces`
  (1035/7); su suite aislada pasó 15/15 y el reintento completo dio los 1036/6 exigidos.
- PM TRIAGE: **acepto B1 sin reservas.** La inferencia "cero global ⇒ no corrió" es inválida
  y convierte en criterio lo que D8 declara observación. El problema que la ronda 2 resolvía
  sigue siendo real —la ronda 1 salía con 0 y todo ceros con `deno` ausente, aprobando el
  gate con la cadena rota— así que lo que se corrige es el **discriminador**, no el objetivo.
  Confirmé N1 yo mismo: `git ls-tree 1732bee scripts/` no lista `scripts/gates`.
- DECISIONS: **N1 se arregla en esta ronda pese a ser NIT.** El SOP §1.4 dice registrar y no
  actuar, pero una receta de reproducción que falla tal como está escrita, dentro de evidencia
  commiteada, es una trampa real para quien reproduzca la base — el mismo criterio que aplicó
  la ronda 7 de planificación a sus dos NIT. Además el ejecutor ya edita ambos ficheros.
- OPEN AFTER THIS ROUND: **P0 r3 — ronda 3 de 3 del tope PM↔ejecutor (SOP §1.5).** Si no
  queda limpia, toca propuesta de re-planificación, no una cuarta ronda. Después, segunda y
  última revisión de Codex (§1.5: tope 2).

### 2026-08-07 — P0 r3 (ejecutor) — Claude Fable (EXEC)
- SESSION: UPGRADE · P0 · r3 · EXEC
- ACTION: Cierre de **[B1] BLOCKING** (una ejecución limpia se clasificaba como "la
  herramienta no corrió") y de **[N1]** (la receta de reproducción de la base falla tal
  como estaba escrita). Commit `9255764` sobre `feat/mesa-md-gates`, 3 ficheros
  (+79/-26): el script, el README y la cabecera de `base-by-file.txt`.
- CÓMO SE CERRÓ B1: el paso 1 del script captura ahora el **código de salida** de cada
  frontera de comando (`$WORK/<tool>.exit`) y el paso 2 clasifica sobre (exit, validez de
  la salida, recuento), nunca sobre el cero global a solas:
  - `eslint` / `deno lint` (con modo JSON): caída ⟺ parseo fallido, forma inesperada
    (no-array / sin `.diagnostics`), o exit > 1 en ESLint. `[]` y
    `{"version":1,"diagnostics":[]}` son ejecuciones limpias legítimas.
  - `tsc` / `deno check` (sin JSON): caída ⟺ exit ≠ 0 **y** cero diagnósticos
    atribuidos. Exit 0 = limpio; exit ≠ 0 con diagnósticos = rojo de base normal.
  Los totales globales siguen por stderr en toda ejecución (observación D8.5, intacta).
  El epílogo de fallo ya no afirma "un cero global significa que la herramienta no
  corrió"; el README reescribe la sección del discriminador y elimina el supuesto y su
  caveat ("deja de valer el día en que…"), ambos ahora falsos.
- EVIDENCIA (sondas ejecutadas, salida cruda en el reporte del ejecutor):
  - **C1** — cuatro stubs con éxito y salida válida vacía: `EXIT=0`, totales
    `tsc=0 eslint=0 deno-lint=0 deno-check=0` por stderr, **sin** línea `FALLO`.
  - **C2** — PATH sin `deno`: `EXIT=1`, stderr nombra `deno-lint` (salida no parseable)
    y `deno-check` (código 127) e incluye `deno: command not found` capturado.
  - **C3** — stub de eslint imprimiendo `not json` con exit 0: `EXIT=1`, nombra eslint.
  - **C4** — toolchain real: `EXIT=0`, totales `tsc=1041 eslint=160 deno-lint=94
    deno-check=46`.
  - **C5** — stdout sobre los 11 ficheros vs cuerpo de `base-by-file.txt` (sin `#`):
    **diff vacío** — el cuerpo de la base no se tocó.
  - **C6** — dos ejecuciones reales consecutivas: `cmp` byte-idéntico.
  - **C7** — la receta corregida (con `mkdir -p /tmp/upgrade-base/scripts/gates`) se
    ejecutó de punta a punta en worktree fresco a `1732bee`: EXIT=0, totales de base,
    diff vacío contra el cuerpo commiteado; worktree retirado.
  - **C9** — `npm run build` ok (9.6s); `npx vitest run --no-file-parallelism` →
    **1036 pass / 6 fail**, único fichero rojo `MesaAbiertaDashboard.test.tsx`;
    `deno test --allow-all .` → **409 passed / 0 failed**. El flake conocido de
    `CuentacuentoEditor.ph.surfaces` no disparó.
- ALCANCE: sin cambios en atribución, orden, agrupación de `deno check` ni normalización
  `at file://` — el diff del bloque de parseo es solo la captura de forma (`shapeOk`) y
  la firma local del resultado de `readJson`. Nada bajo `src/` ni `supabase/`.
- FINDINGS RAISED: ninguno.
- DECISIONS: para los dos tools JSON el discriminador primario es la forma del JSON (la
  señal que el propio prompt señala como la más fuerte); el exit se usa además solo en
  ESLint (>1 = fatal documentado). En `tsc`/`deno check` el exit lleva el peso.
- OPEN AFTER THIS ROUND: **segunda y última revisión de Codex** sobre
  `feat/mesa-md-gates`@`9255764` (SOP §1.5: tope 2). P0 no es DONE hasta que Codex pase.

### 2026-08-06 — P0 round 3 — PM (Fable) — VERIFICACIÓN
- SESSION: UPGRADE · P0 · PM
- ACTION: Verificación independiente del EXECUTOR REPORT de P0 r3 (`9255764`, `6caa87d`).
  **B1 de Codex cerrado. N1 cerrado. Cero hallazgos nuevos.** P0 vuelve a IN REVIEW.
- LO QUE VERIFIQUÉ YO MISMO (reejecuté las cuatro sondas, no acepté el reporte):
  - **C1 — el falso positivo de Codex, muerto.** Con las cuatro herramientas sustituidas por
    stubs que salen con 0 y emiten salida válida y vacía (`[]`,
    `{"version":1,"diagnostics":[]}`): **EXIT=0**, totales `tsc=0 eslint=0 deno-lint=0
    deno-check=0` por stderr, **ninguna línea `FALLO`**. Antes de esta ronda ese mismo caso
    salía con 1 marcando las cuatro herramientas como caídas.
  - **C2 — lo que la ronda 2 sí resolvía sigue resuelto.** Con `deno` fuera del `PATH`:
    **EXIT=1**, nombra `deno-check` (código 127 sin diagnósticos) y `deno-lint` (JSON no
    parseable), con su `deno: command not found` capturado.
  - **C3 — salida malformada.** Stub de ESLint que sale con 0 imprimiendo `not json`:
    **EXIT=1**, nombra eslint con el error de parseo exacto.
  - **C4** — toolchain real sobre los 11 ficheros: **EXIT=0** y totales
    `tsc=1041 eslint=160 deno-lint=94 deno-check=46`. La línea base no se movió.
  - **C5** — stdout comparado con el cuerpo de `base-by-file.txt`: **diff vacío**. El cuerpo
    de la evidencia commiteada está intacto; solo cambió una línea `#` de la cabecera.
  - **C6** — dos pasadas reales, `cmp` sin diferencias.
  - **C9** — `npm run build` ok (7.38s); `npx vitest run --no-file-parallelism` → **1036
    pass / 6 fail** con los seis nombres de siempre; `deno test --allow-all .` → **409/0**.
  - **N1** — verificado en la cabecera de `base-by-file.txt` y en el README: la receta lleva
    ahora `mkdir -p /tmp/upgrade-base/scripts/gates` con la razón anotada. Yo había
    confirmado el defecto con `git ls-tree 1732bee scripts/`.
  - **C8** — leí la sección reescrita del README: desaparecen el supuesto "cero global = no
    corrió" y su caveat, y en su lugar está el discriminador por herramienta.
  - **Alcance**: `git diff --stat 099c822..HEAD` = 4 ficheros, +125/-26. Cero bajo `src/` o
    `supabase/`. Árbol limpio salvo lo preexistente sin trackear.
  - Leí el diff completo del script (+71/-25): el epílogo de clasificación es lo único que
    cambia de fondo; atribución, orden, agrupación de `deno check` y `rel()` siguen sin
    tocarse, que es lo que permitió a Codex dar Z1–Z7 por buenos.
- FINDINGS RAISED: ninguno. Las dos suposiciones del ejecutor son correctas: el 2 de ESLint
  es fatal por convención documentada, y `Array.isArray(parsed)` en vez de `parsed || []`
  evita que una forma inesperada reviente antes de llegar a la clasificación.
- LÍMITE INHERENTE QUE CONVIENE NOMBRAR (no es hallazgo): para `tsc` y `deno check`, que no
  tienen modo JSON, una herramienta que saliera con 0 **sin haber hecho nada** es
  indistinguible de una ejecución limpia. Es exactamente el precio del arreglo que Codex
  especificó y que C1 exige; la alternativa era el falso positivo que él mismo bloqueó.
- TESTS: C1 EXIT=0 sin FALLO · C2 EXIT=1 · C3 EXIT=1 · C4 EXIT=0 con 1041/160/94/46 ·
  C5 diff vacío · C6 byte-idéntico · build ok · vitest 1036/6 · deno test 409/0.
- BACKLOG: S1 sigue abierto (flake de `CuentacuentoEditor.ph.surfaces`; no disparó en esta
  ronda ni en mi pasada).
- DECISIONS: ninguna nueva.
- OPEN AFTER THIS ROUND: **segunda y última revisión de Codex** sobre
  `feat/mesa-md-gates`@`6caa87d` (SOP §1.5, tope 2). Si no pasa, decide Brent: aceptar,
  replanificar o backlog. P0 no se marca DONE hasta el PASS.

### 2026-08-06 — P0 revisión final Codex (ronda 2 de 2) — Codex Sol (REVIEW)
- SESSION: UPGRADE · P0 · REVIEW
- ACTION: Segunda y última revisión final de P0 sobre `feat/mesa-md-gates`@`398a09d`.
  **VERDICT: FAIL — 1 BLOCKING.** r1-B1 (falso positivo) y r1-N1 quedan cerrados; el
  discriminador nuevo introduce un **falso negativo distinto**.
- FINDINGS RAISED:
  - **[B1] BLOCKING** — `changed-files-diagnostics.sh:198`: para las dos herramientas JSON,
    la forma del JSON **anula** el código de salida. `exits["deno lint"]` **no se consulta
    nunca**, y de ESLint solo falla `>1`. Sondas de Codex: `deno lint` con
    `{"version":1,"diagnostics":[]}` y **EXIT=127** → el gate sale con **0**; ESLint con
    `[]` y **EXIT=1** → el gate sale con **0**. Ambos casos los rechazaba la ronda 2.
    Contradice el contrato de remediación registrado: clasificar sobre
    `(exit, validez, recuento)` y "cero diagnósticos + comando fallido ⇒ herramienta caída".
  - Codex **acepta explícitamente** el límite inherente de `tsc`/`deno check` que registré:
    sin salida estructurada, salir con 0 sin trabajar es indistinguible de una ejecución
    limpia. Pero ese límite **no justifica ignorar un exit distinto de cero ya capturado**
    en las herramientas que sí lo tienen.
- CODEX CONFIRMA: sonda de salida limpia EXIT=0 con totales 0/0/0/0 sin FALLO · binario Deno
  ausente EXIT=1 con ambas nombradas · JSON malformado de ESLint EXIT=1 · toolchain real
  EXIT=0 con totales exactos 1041/160/94/46 · stdout idéntico al cuerpo de la base,
  **15.052 bytes, `cmp` exit 0** · cuerpo de `base-by-file.txt` intacto, solo la línea
  `mkdir -p` añadida — **N1 cerrado** · sin cambios de producto ni de configuración, ningún
  diagnóstico arreglado · atribución, orden, emisión y normalización de rutas sin tocar, por
  lo que no reejecutó Z5b.
- PM VERIFICATION: **reproduje las dos sondas yo mismo y las dos se sostienen.** `deno lint`
  con JSON válido vacío y exit 127 → gate EXIT=0. ESLint con `[]` y exit 1 → gate EXIT=0.
  Leído el bloque `:192-205`: el bucle de `["eslint","deno lint"]` solo mira `parseErrors`,
  `shapeOk` y —solo para eslint— `exits[t] > 1`. **Este fallo se me pasó al revisar el diff
  de la ronda 3**, que es exactamente lo que la verificación independiente existe para
  atrapar.
- **DOS TOPES DE BUCLE ALCANZADOS A LA VEZ (SOP §1.5)**: ronda PM↔ejecutor **3 de 3** y ronda
  Codex **2 de 2**. No abro una cuarta ronda por mi cuenta. **Decisión escalada a Brent.**
- DIAGNÓSTICO DEL PM, sin adornos: **el detector "la herramienta no corrió" no lo pide
  ningún criterio de aceptación.** Z1–Z7 no lo mencionan; el mecanismo que el plan congelado
  eligió contra un gate decorativo son los canarios Z5, y Codex los verificó él mismo. El
  detector lo introduje yo como B1 en la ronda 1. Desde entonces ha consumido las rondas 2 y
  3 y las dos rondas de Codex, y sigue mal — tres discriminadores, tres formas distintas de
  estar equivocado. Es el mismo patrón que la propia revisión 6 del plan diagnosticó sobre
  este PM: una exigencia inventada por el PM que genera rondas sin converger. Además **D8
  punto 5 dice literalmente que los recuentos globales son observación, "no como criterio"**
  — es decir, el plan congelado nunca pidió que esto hiciera fallar nada.
- OPEN AFTER THIS ROUND: decisión de Brent — aceptar, replanificar o backlog. P0 pasa a
  BLOCKED hasta entonces.

### 2026-08-06 — P0 round 4 — PM (Fable) — DECISIÓN DE BRENT Y PROMPT
- SESSION: UPGRADE · P0 · PM
- ACTION: Escalada resuelta. **Brent elige arreglar el detector, con override explícito al
  tope de 3 rondas del SOP §1.5.** Prompt de remediación en `prompts/P0-r4.md`. P0 vuelve a
  IN PROGRESS.
- DECISIONS (ambas registradas también en el Decision Log de PLAN.md):
  - **Cuarta ronda de ejecutor autorizada por Brent.** Prefiere arreglar el detector a
    retirarlo. Es la última: si no cierra limpia, se replanifica la fase.
  - **P0 pasa de 3 a 4 ficheros: se añade `scripts/gates/selftest.sh`.** Tres rondas
    seguidas han regresado en el mismo bloque de clasificación y cada regresión solo se
    detectó con sondas manuales ad hoc — incluida ésta, que a mí se me pasó leyendo el diff.
    El self-test convierte el contrato del discriminador en algo reejecutable en segundos.
    No es un requisito nuevo: es el test de una conducta ya decidida. Sigue dentro del tope
    de 10 ficheros del SOP §1.3.
- CONTENIDO DEL PROMPT: la regla a implementar cubre las dos herramientas JSON por igual —
  fallo si (1) no parsea, (2) forma inesperada, (3) exit fuera de `{0,1}`, o (4) exit `1`
  ("encontré problemas") con **cero** diagnósticos parseados, que es autocontradictorio.
  Exit `0` con cero diagnósticos sigue siendo ejecución limpia legítima: eso es lo que la
  ronda 3 acertó y no puede regresar. La rama de `tsc`/`deno check` **no se toca**, ni la
  atribución, el orden, la agrupación de `deno check` o `rel()` — todo eso lo verificó
  Codex dos veces, incluida Z5b.
- LOS SIETE CASOS DEL SELF-TEST fijan los tres defectos históricos a la vez: caso 1 el
  falso positivo de la ronda 2, caso 2 el silencio de la ronda 1, casos 4/5/6 el falso
  negativo de la ronda 3, más JSON malformado y forma inesperada.
- PENDIENTE DE DECIDIR (no lo asumo): el tope de rondas de Codex también está agotado
  (2 de 2). Una tercera revisión de Codex requiere override explícito de Brent, igual que
  éste. **Lo recomiendo**: las dos últimas rondas de Codex encontraron cada una un defecto
  real que yo no había visto, incluida ésta.
- OPEN AFTER THIS ROUND: ejecución de P0 r4.

### 2026-08-07 — P0 r4 (ejecutor) — Claude Opus 5 (EXEC)
- SESSION: UPGRADE · P0 · r4 · EXEC — ronda **bajo override explícito de Brent** al tope de
  3 rondas del SOP §1.5. Prompt: `docs/plan/upgrade/prompts/P0-r4.md`.
- SCOPE: **3 ficheros de trabajo** — `scripts/gates/changed-files-diagnostics.sh`,
  `scripts/gates/selftest.sh` (nuevo, 4º fichero de P0 por decisión del PM),
  `scripts/gates/README.md` — más esta entrada. Cero cambios bajo `src/`, `supabase/`,
  `package.json`, configuración de linters o `base-by-file.txt`.
- **B1 (BLOCKING de Codex, ronda 2 de 2) — CERRADO.** El bucle de clasificación de
  `["eslint", "deno lint"]` deja de dar prioridad a la forma del JSON sobre el código de
  salida capturado. Las cuatro reglas rigen ahora para **ambas** herramientas: (1) no
  parsea, (2) forma inesperada, (3) exit fuera de `{0,1}`, (4) exit `1` con **cero**
  diagnósticos parseados. Exit `0` con cero diagnósticos sigue siendo ejecución limpia
  legítima — el acierto de la ronda 3 no regresa. Antes: `exits["deno lint"]` se capturaba
  y **nunca se consultaba**, y de ESLint solo se rechazaba `> 1`.
- **Rama `tsc` / `deno check` intacta**, igual que atribución, orden, agrupación multilínea
  de `deno check` y `rel()`. El diff del script es +11/-6 y vive entero en el epílogo.
- **`selftest.sh` (nuevo).** Monta `npx` y `deno` de mentira en un directorio temporal, los
  antepone al `PATH`, corre el gate sobre un fichero real y asserta **su código de salida**.
  Ninguna herramienta real se ejecuta; los directorios se borran por `trap`. Los siete casos
  fijan a la vez los tres defectos históricos: caso 1 el falso positivo de la ronda 2, caso
  2 el silencio de la ronda 1, casos 4/5/6 el falso negativo de la ronda 3, más JSON no
  parseable (3) y forma inesperada (7). No está registrado en Vitest ni en Deno y no tiene
  script de npm: se corre por ruta.
- TESTS: **S1** `bash scripts/gates/selftest.sh` → 7/7 OK, exit 0 · **S2** sonda manual
  `deno lint` JSON válido vacío + exit 127 → gate EXIT=1, stderr nombra `deno-lint` ·
  **S3** sonda manual ESLint `[]` + exit 1 → gate EXIT=1, stderr nombra `eslint` · **S4**
  ejecución limpia por mano → EXIT=0 sin línea `FALLO` · **S5** binario `deno` ausente por
  mano → EXIT=1 nombrando `deno-lint` y `deno-check` con su `command not found` capturado ·
  **S6** toolchain real → EXIT=0 con `tsc=1041 eslint=160 deno-lint=94 deno-check=46`, la
  base no se movió · **S7** stdout vs. cuerpo de `base-by-file.txt` (sin líneas `#`): `diff`
  **vacío**, 15.052 bytes ambos · **S8** dos pasadas reales consecutivas: `diff` vacío ·
  **S10** `npm run build` ok (7.37s), `npx vitest run --no-file-parallelism` → **1036 pass /
  6 fail** (los seis en `MesaAbiertaDashboard.test.tsx`), `deno test --allow-all .` desde
  `supabase/functions/` → **409 passed / 0 failed**.
- **S9** — README: la viñeta de las herramientas JSON pasa a enunciar la convención de
  salida (`0` nada que reportar, `1` problemas encontrados, cualquier otro código = fallo de
  la herramienta) y las cuatro reglas numeradas, con `1` + cero diagnósticos declarado
  autocontradictorio. El párrafo de `tsc` / `deno check` y su límite aceptado quedan como
  estaban. Sección nueva para `selftest.sh` con la tabla de los siete casos y qué fija cada
  uno.
- FINDINGS RAISED: ninguno. No encontré ningún caso en que ESLint o `deno lint` salgan con
  `1` legítimamente sin emitir diagnósticos; la regla del prompt se sostiene.
- DESVIACIÓN DE ENTORNO (no es hallazgo, pero el PM debe saberlo): el prompt sitúa
  `feat/mesa-md-gates` en `165d704`. No es así. `165d704` y `f6a8cdd` —que traen el prompt
  de r4, la entrada de Codex r3 y la decisión de Brent— están en **`docs/plan-audio`**, que
  divergió de `feat/mesa-md-gates` en `69d893a`. La punta real de la rama de trabajo era
  `398a09d`. Trabajé sobre `398a09d`, que es donde vive el script. **Consecuencia: este
  `LEDGER.md` no contiene la entrada del FAIL de Codex r3 ni la decisión de r4 del PM — están
  en la copia de `docs/plan-audio`.** Las dos copias del ledger habrá que reconciliarlas
  antes del merge; no lo hago yo porque el fichero es del PM y el SOP prohíbe reflowearlo.
- BACKLOG: el flake de `CuentacuentoEditor.ph.surfaces` no disparó en esta ronda.
- DECISIONS: ninguna nueva.
- OPEN AFTER THIS ROUND: verificación del PM y, si Brent lo autoriza (el tope de Codex está
  en 2 de 2), una tercera revisión de Codex. Reconciliación de las dos copias del ledger.

### 2026-08-07 — P0 round 4 — PM (Fable) — VERIFICACIÓN + REPARACIÓN DEL REGISTRO
- SESSION: UPGRADE · P0 · PM
- ACTION: Verificación independiente del EXECUTOR REPORT de P0 r4 (`13aa12a`). **B1 de la
  ronda 2 de Codex cerrado. Cero hallazgos nuevos.** Además reparé un error mío de rama.
- LO QUE VERIFIQUÉ YO MISMO:
  - **B1 cerrado.** Corrí las seis sondas con mi propio arnés, independiente del self-test
    del ejecutor, para que un self-test que pasara en vacío no me engañara:
    `deno lint` JSON válido vacío + exit 127 → **1** · ESLint `[]` + exit 1 → **1** ·
    `deno lint` JSON válido vacío + exit 1 → **1** · ESLint forma `{}` + exit 0 → **1** ·
    binario `deno` ausente → **1** · las cuatro limpias y con éxito → **0**, sin `FALLO`.
    Las dos sondas que Codex bloqueó ahora fallan cerrando, y la ejecución limpia sigue
    saliendo con 0.
  - Leí el diff del script (**+11/-7, todo dentro del epílogo**): la regla se aplica ahora a
    **ambas** herramientas JSON —fuera de `{0,1}`, o `1` con cero diagnósticos parseados—.
    `exits["deno lint"]` ya se consulta. La rama de `tsc`/`deno check`, la atribución, el
    orden, la agrupación multilínea y `rel()` siguen intactas.
  - Leí `selftest.sh` entero (148 líneas). Comprueba el **código de salida** del gate, no su
    stdout; cada caso altera una sola variable sobre una base limpia, así que un fallo tiene
    causa única; y el caso 2 **quita de verdad** `deno` del `PATH` en vez de simularlo con un
    stub. `bash scripts/gates/selftest.sh` → **7/7 OK**, exit 0, ejecutado por mí.
  - **S6/S7/S8**: toolchain real sobre los 11 ficheros → EXIT=0, totales
    `tsc=1041 eslint=160 deno-lint=94 deno-check=46`, y **diff vacío** contra el cuerpo de
    `base-by-file.txt`. La línea base no se movió y la evidencia commiteada sigue válida.
  - **S10**: `npm run build` ok (7.70s) · `npx vitest run --no-file-parallelism` → **1036
    pass / 6 fail**, un único fichero rojo, `MesaAbiertaDashboard.test.tsx` ·
    `deno test --allow-all .` → **409 passed / 0 failed**.
- **ERROR MÍO — DIVERGENCIA DE RAMAS, DETECTADO POR EL EJECUTOR.** Mis dos últimos commits de
  PM (`165d704`, `f6a8cdd`) se escribieron sobre `docs/plan-audio` —otra rama de trabajo que
  se cruzó en el checkout— y no sobre `feat/mesa-md-gates`. Committeé sin volver a comprobar
  la rama. Consecuencia medida: el `LEDGER.md` de `165d704` se apiló sobre una copia anterior
  a la ronda 1 y **tiene 17 entradas frente a las 24 de la rama de trabajo** — le faltan
  siete. Por eso **no** hice cherry-pick: habría borrado historia. Repuse el contenido a mano:
  - las dos entradas de ledger (Codex ronda 2 de 2, y la decisión de Brent sobre r4),
    **insertadas en su lugar cronológico** antes de la entrada del ejecutor de r4. Es la única
    vez que he insertado en vez de anexar, y queda anotado aquí por eso;
  - `prompts/P0-r4.md`, extraído de `f6a8cdd`;
  - las dos filas del Decision Log de `PLAN.md` (override de la cuarta ronda, y P0 de 3 a 4
    ficheros).
  Verificado tras la reposición: 26 entradas de ledger, ninguna perdida.
- PENDIENTE PARA BRENT (no lo asumo): `docs/plan-audio` conserva esos dos commits míos, con
  una copia del ledger a la que le faltan siete entradas. Si esa rama se mergea, el conflicto
  hay que resolverlo a favor de la rama de trabajo. Limpiarlo exige tocar la rama de otro
  workstream —ya publicada— y eso no lo hago por mi cuenta.
- FINDINGS RAISED: ninguno. La suposición del ejecutor sobre `totals[t]` como cantidad de
  "cero diagnósticos parseados" es correcta y no toca D8 punto 5: se usa como señal de
  validez de la salida de la propia herramienta, nunca como criterio de aprobación.
- BACKLOG: S1 sigue abierto (flake de `CuentacuentoEditor.ph.surfaces`; no disparó).
- OPEN AFTER THIS ROUND: **tercera revisión de Codex, que requiere override explícito de
  Brent** (el tope §1.5 de 2 está agotado). P0 no se marca DONE sin ese PASS.

### 2026-08-07 — P0 — override de Brent para continuar — PM (Fable)
- SESSION: UPGRADE · P0 · PM
- ACTION: **Brent autoriza superar el tope de rondas de Codex del SOP §1.5** ("sigue con más
  rondas, tenemos que terminarlo"), y con él las rondas de ejecutor que hagan falta hasta
  cerrar P0. Registrado también en el Decision Log de PLAN.md.
- RAZÓN: las dos revisiones de Codex encontraron cada una un defecto real que yo no había
  visto —el falso positivo de la ronda 2 y el falso negativo de la ronda 3—, y en la ronda 4
  yo mismo commiteé sobre la rama equivocada. Cerrar la fase sin revisión externa sería
  confiar justo en el eslabón que ya ha fallado.
- LO QUE SE LE PIDE A CODEX EN LA RONDA 3, además de la revisión normal: **mutar la
  corrección y comprobar que `selftest.sh` falla**. Es la única verificación que a mí me está
  vedada por el SOP §1.1 y la única que demuestra que los siete casos no pasan en vacío.
- ESTADO: `feat/mesa-md-gates`@`5e05a73`. P0 IN REVIEW. Z1–Z7 verificados por Codex en su
  ronda 1; r1-B1, r1-N1 y r2-B1 cerrados y verificados por el PM.
- OPEN AFTER THIS ROUND: revisión de Codex ronda 3.
