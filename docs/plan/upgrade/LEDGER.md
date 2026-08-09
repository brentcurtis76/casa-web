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

### 2026-08-07 — P0 revisión Codex (ronda 3, bajo override) — Codex Sol (REVIEW)
- SESSION: UPGRADE · P0 · REVIEW
- ACTION: Tercera revisión de P0 sobre `feat/mesa-md-gates`@`5e05a73`.
  **VERDICT: FAIL — 0 BLOCKING, 1 SHOULD-FIX.**
- FINDINGS RAISED:
  - **[S1] SHOULD-FIX** — `selftest.sh:81`: `dir="$(make_stubs …)"` ejecuta `make_stubs` en
    una **subshell**, así que su `STUBS+=("$dir")` muta una copia y el array del padre queda
    vacío: el `trap EXIT` no borra nada. Los siete directorios de stubs se quedan. Contradice
    la cabecera del propio fichero, el README y el requisito explícito de la ronda 4. Codex
    lo señala como lo único que hace P1 más difícil de lo necesario.
- **MUTATION TEST — lo que yo no podía verificar y era el hueco real de la fase.** Codex lo
  hizo en un worktree desprendido en `5e05a73` y restauró byte a byte:
  predicado commiteado **7/7 OK**; predicado de la ronda 3 restaurado → **fallan exactamente
  los casos 4, 5 y 6**; predicado de la ronda 2 restaurado → **falla exactamente el caso 1**;
  predicado restaurado → 7/7 OK. **El self-test fija de verdad las tres regresiones
  históricas y no pasa en vacío.**
- CODEX CONFIRMA además: sus dos sondas fallan cerrando y nombran la herramienta · ejecución
  limpia sale con 0 sin FALLO · toolchain real 1041/160/94/46 · stdout 15.052 bytes con `cmp`
  exit 0 contra el cuerpo de la base, **idéntico también al de la ronda 1** · atribución,
  orden, agrupación multilínea y `rel()` sin tocar, así que la evidencia Z1–Z7 sigue
  aplicando · build ok, vitest 1036/6, deno 409/0 · sin cambios de producto, Supabase,
  package ni configuración de linters/TS · **el registro está completo y en orden lógico**,
  `P0-r4.md` byte-idéntico a la copia extraviada, 27 entradas en `5e05a73` y 28 en `eae138e`.
- MATIZ TÉCNICO DE CODEX (no es defecto): existe un caso real en que ESLint sale con 1 y cero
  diagnósticos reportados — `--quiet --max-warnings 0` suprime la salida de warnings sin
  cambiar el código. No es alcanzable bajo el contrato de P0, cuya invocación congelada es
  `npx eslint . -f json` sin ninguna de las dos banderas. Queda anotado por si una fase futura
  cambia la invocación. En Deno 2.7.11, un directorio vacío sale con 1 y stdout no-JSON, que
  la regla de "salida no parseable" ya rechaza correctamente.
- PM VERIFICATION: **reproduje S1 yo mismo.** 55 directorios temporales antes de la ejecución,
  **62 después** — siete nuevos, uno por caso, cada uno con los stubs dentro (el del caso 2
  solo con `npx`, coherente con que ese caso quita `deno` a propósito).
- PM TRIAGE: el SOP §1.4 manda los SHOULD-FIX al backlog sin bloquear, pero **Codex emitió
  FAIL y tiene la última palabra sobre el cierre**; Brent ha pedido terminar la fase bien, y
  el arreglo es de tres líneas. Se arregla en una ronda r5 acotada en vez de arrastrarlo.
- OPEN AFTER THIS ROUND: P0 r5 — un único SHOULD-FIX, sin tocar el gate.

### 2026-08-07 — P0 r5 — Claude Opus 5 (EXEC)
- SESSION: UPGRADE · P0 · r5 · EXEC
- ACTION: cerrar el único SHOULD-FIX de la ronda 3 de Codex: `selftest.sh` filtraba los
  siete directorios de stubs. `make_stubs` ya no crea ni imprime el directorio; lo recibe
  como primer argumento. `run_case` hace el `mktemp -d` y el `STUBS+=("$dir")` **en el
  shell padre**, así que el `trap EXIT` sí los borra. Un solo fichero tocado,
  `scripts/gates/selftest.sh` (+9 / −9).
- REPRODUCCIÓN PREVIA (antes del arreglo): 49 directorios de stubs antes de la ejecución,
  **56 después** — los siete de Codex, uno por caso.
- T1 — `bash scripts/gates/selftest.sh` → **7/7 OK**, exit 0.
- T2 — **fuga cero**: `antes: 56` / `después: 56`, delta 0, con el contador que solo ve
  directorios que contienen el stub `npx`.
- T3 — **la limpieza sobrevive a un fallo**: con el caso 3 esperando exit 99 el script
  imprime `FALLO caso 3`, sale 1, y el delta sigue siendo 0 (`antes: 56` / `después: 56`).
  La edición se revirtió acto seguido (`run_case 3 … 1 yes` restaurado).
- T4 — `git diff eae138e -- scripts/gates/changed-files-diagnostics.sh` **vacío**. El gate
  no se tocó.
- T5 — toolchain real sobre los 11 ficheros de la cabecera de `base-by-file.txt`: exit
  **0**, stderr `[gates] totales del proyecto: tsc=1041 eslint=160 deno-lint=94
  deno-check=46`, stdout **15.052 bytes** y `diff` vacío contra el cuerpo de la base.
- T6 — `scripts/gates/README.md` **sin cambios**: su frase «Cada directorio temporal se
  borra al salir (`trap`)» describe justamente lo que ahora es cierto.
- T7 — `npm run build` ok · `npx vitest run --no-file-parallelism` **1036 pass / 6 fail**,
  los seis en `MesaAbiertaDashboard.test.tsx` · `deno test --allow-all .` **409 pass /
  0 fail**.
- T8 — `git status` limpio salvo el `.claude/launch.json` no versionado y preexistente.
- ESTADO: `feat/mesa-md-gates`. P0 con S1 cerrado.
- OPEN AFTER THIS ROUND: verificación del PM y, si procede, cierre de P0.

### 2026-08-07 — P0 round 5 — PM (Fable) — VERIFICACIÓN
- SESSION: UPGRADE · P0 · PM
- ACTION: Verificación independiente del EXECUTOR REPORT de P0 r5 (`912c15d`). **S1 cerrado.
  Cero hallazgos nuevos.** P0 vuelve a IN REVIEW.
- LO QUE VERIFIQUÉ YO MISMO:
  - **T1/T2 — la fuga está cerrada.** Conté los directorios de stubs con el método del
    prompt: **56 antes, 56 después**, delta 0, y el self-test en **7/7 OK** con exit 0. Antes
    del arreglo yo mismo había medido 55 → 62.
  - Leí el diff (+9/-9, un solo fichero): `make_stubs` ya no crea ni imprime el directorio,
    lo recibe como argumento; `run_case` hace el `mktemp -d` y el `STUBS+=` **en el shell
    padre**, que es lo que faltaba para que el `trap EXIT` encuentre el array poblado.
  - **T4 — el gate está intacto**: `git diff eae138e -- scripts/gates/changed-files-diagnostics.sh`
    → **0 líneas**. Todo lo que Codex verificó en su ronda 3, incluido el mutation test, sigue
    aplicando sin reservas.
  - **T5** — toolchain real sobre los 11 ficheros: EXIT=0, totales
    `tsc=1041 eslint=160 deno-lint=94 deno-check=46`, stdout **15.052 bytes** y **diff vacío**
    contra el cuerpo de `base-by-file.txt`.
  - **T7** — `npm run build` ok (12.22s) · `deno test --allow-all .` → **409/0** · Vitest:
    **mi primera pasada dio 1035/7**, con el flake conocido de
    `CuentacuentoEditor.ph.surfaces.test.tsx` (`AssertionError: expected [] to have a length
    of 1` en el `waitFor` de `:81`, 10.785 ms). Ese fichero **aislado pasa 15/15**, y mi
    segunda pasada completa dio **1036/6** con un único fichero rojo,
    `MesaAbiertaDashboard.test.tsx`. Misma firma que vio Codex en su ronda 1. Esta rama no
    toca `src/`: es el flake del backlog S1, no una regresión. Lo dejo escrito en vez de
    reportar solo la pasada verde.
  - **T8** — `git status` limpio salvo el `.claude/launch.json` preexistente.
- LO QUE **NO** VERIFIQUÉ POR MI CUENTA: T3 (que la limpieza también actúe cuando el
  self-test falla). Exige mutar un caso, y editar fuente me está vedado por el SOP §1.1. Lo
  establecí por lectura —`trap cleanup EXIT` se dispara igual en la salida 0 que en la 1, y
  el array ya se puebla en el padre— más la evidencia del ejecutor, que mostró el caso 3
  mutado fallando con delta 0.
- FINDINGS RAISED: ninguno.
- BACKLOG: S1 (flake de `CuentacuentoEditor.ph.surfaces`) sigue abierto y ya ha aparecido en
  tres sesiones distintas —ejecutor r1, Codex r3 y esta verificación—. Merece ficha propia
  cuando P0 cierre.
- DECISIONS: ninguna nueva.
- OPEN AFTER THIS ROUND: **revisión de Codex ronda 4** sobre `feat/mesa-md-gates`. Es el
  único hallazgo pendiente de su ronda 3 y no toca el gate, así que la revisión debería ser
  corta. P0 no se marca DONE sin ese PASS.

### 2026-08-07 — P0 CIERRE — Codex PASS + PM
- SESSION: UPGRADE · P0 · PM
- ACTION: **`CODEX REVIEW ronda 4` = PASS.** Cero BLOCKING, cero SHOULD-FIX, cero NIT.
  **P0 marcada DONE** en el índice de fases con fecha 2026-08-07 y SHA `09a69d7`.
- CODEX VERIFICÓ EN EL CIERRE: limpieza en ejecución que pasa (56→56, delta 0, 7/7) **y en
  ejecución que falla** (caso 3 forzado a exit 99: sale 1, falla exactamente ese caso, delta
  0) — el T3 que yo no podía hacer · **mutation test repetido**: predicado de la ronda 3 →
  fallan exactamente 4, 5 y 6; predicado de la ronda 2 → falla exactamente el 1 · el blob del
  gate en `09a69d7` es **idéntico** al de `eae138e` (`51af6197…`) · gate real sobre los 11
  ficheros: exit 0, 15.052 bytes, `cmp` exacto contra el cuerpo de la base · totales
  `1041/160/94/46` · README y evidencia sin cambios · nada bajo `src/`, `supabase/`, package,
  lint, TS ni lockfile · `bash -n` y `git diff --check` limpios · **ningún impedimento para P1**.
- QUÉ SE CONSTRUYÓ: `scripts/gates/changed-files-diagnostics.sh` (filtra por ruta los
  diagnósticos crudos de `tsc`, ESLint, `deno lint` y `deno check`, sin canonicalización),
  `scripts/gates/selftest.sh` (7 casos que fijan las tres regresiones del propio detector),
  `scripts/gates/README.md`, y `docs/plan/upgrade/evidence/base-by-file.txt` (línea base de
  los 11 ficheros que P1–P8 tocan, capturada en worktree limpio a `1732bee`).
- QUÉ CAMBIÓ FRENTE AL PLAN ORIGINAL, y por qué:
  1. **P0 pasó de 3 a 4 ficheros** (se añadió `selftest.sh`). Tres rondas seguidas regresaron
     en el mismo bloque de clasificación y cada regresión solo se detectaba con sondas
     manuales. Decision Log 2026-08-06.
  2. **Se añadió al gate una detección de "la herramienta no corrió"** que Z1–Z7 no pedían.
     La levanté yo en la ronda 1 al ver que un `deno` ausente hacía pasar el gate en silencio.
     Costó cinco rondas y dos FAIL de Codex acertar el discriminador. **Lección para las fases
     siguientes: un requisito que el PM añade sobre un plan congelado se paga en rondas.** El
     resultado final es correcto y está fijado por el self-test, pero el camino fue caro.
  3. Se corrigió la receta de reproducción de la base (`mkdir -p`), Codex r3 N1.
- COSTE REAL DE LA FASE: 5 rondas de ejecutor (tope del SOP: 3) y 4 de Codex (tope: 2), con
  override explícito de Brent en ambos casos. Los cuatro FAIL de Codex encontraron cada uno
  un defecto real que yo no había visto; en la ronda 4 además commiteé sobre la rama
  equivocada. **La cadena de revisión independiente hizo su trabajo; el eslabón débil fui yo.**
- CONTEXT PRESSURE (para calibrar §1.3): las cinco rondas de ejecutor reportaron
  "comfortable". El límite de esta fase no fue el contexto sino la precisión del contrato.
- BACKLOG ABIERTO: B-01 a B-04, ahora en la sección `## Backlog` de PLAN.md.
- NOTAS PARA EL PROMPT DE P1 (no son cambios al plan congelado, son precisiones de uso):
  - El gate **ahora sale con código distinto de cero** cuando una herramienta no corre. El
    ejecutor de P1 debe comprobar el código de salida, no solo mirar la salida.
  - A10 acota `F = {migración, types.ts}`, pero los **2 diagnósticos que P1 elimina están en
    `MesaAbiertaAdmin.tsx`**, que P1 no toca. Para dejar constancia hay que correr el gate
    sobre `F ∪ {src/components/mesa-abierta/MesaAbiertaAdmin.tsx}` y comparar ese fichero con
    `base-by-file.txt`. El criterio no cambia; cambia el conjunto de rutas que se pasa.
  - La migración es un `.sql`: mostrará `(0)` en las cuatro herramientas. Es correcto.
- OPEN AFTER THIS ROUND: merge de `feat/mesa-md-gates` (comando entregado a Brent; **el PM no
  mergea**). Después, bootstrap de PM para **P1**, que ya tiene PR1 y PR2 concedidos.

### 2026-08-07 — P1 round 1 — PM (Fable) — BOOTSTRAP Y PROMPT
- SESSION: UPGRADE · P1 · PM
- ACTION: Bootstrap de PM para **P1 — Esquema: columna + RPC de resumen**. Prompt de
  ejecutor escrito y commiteado en `docs/plan/upgrade/prompts/P1-r1.md`. P1 pasa a
  IN PROGRESS en el índice de fases. Sin código tocado (SOP §1.1).
- ESTADO DE PARTIDA VERIFICADO CONTRA LA REALIDAD, no contra el registro:
  - `feat/mesa-md-gates` **ya está en `main`**: `git merge-base --is-ancestor` → sí, y
    `main` = `origin/main` = `5b947ac`. P0 cerrada y mergeada. La base de P1 es `5b947ac`.
  - `feat/mesa-md-schema` **no existe** todavía, ni local ni en el remoto.
  - Las cuatro herramientas de P0 están en `main`: `changed-files-diagnostics.sh`,
    `selftest.sh`, `README.md`, `evidence/base-by-file.txt` (11 ficheros, cabecera `1732bee`).
- ESTADO DE LA BASE DE DATOS (`mulsqxfhxxdsadxsljss`, introspección de solo lectura):
  `can_bring_main_dish` **no existe** · `get_my_dinner_summary` **no existe** ·
  `mesa_abierta_matches.host_food_assignment` existe, `text` **nullable**, sin default —
  confirma las seis declaraciones literales de `types.ts` que fijó Codex r5-S3 ·
  31 participantes / 6 matches / 25 assignments / 4 meses, idéntico a lo que dice el plan.
- **RIESGO DECLARADO DE P1, CERRADO ANTES DE DESPACHAR.** PLAN.md avisaba: «simular
  llamantes requiere `set_config('request.jwt.claims', …)`; **estoy asumiendo** que es
  posible». Lo probé yo: una llamada multi-sentencia de `execute_sql` comparte transacción,
  `set_config(..., true)` persiste entre sentencias y `auth.uid()` lo lee
  (`00000000-…-0000` devuelto correctamente). **A6–A8 son ejecutables.** En cambio
  `SET LOCAL ROLE authenticated` está **denegado** al usuario de solo lectura; no hace falta,
  porque la función es `SECURITY DEFINER` y filtra por `auth.uid()`, no por RLS. El prompt
  lleva las tres consultas ya escritas.
- **RIESGO NUEVO QUE EL PLAN NO PREVIÓ — canal de escritura.** El servidor MCP
  `supabase-casa` está configurado **`--read-only`**: su `execute_sql` corre como
  `supabase_read_only_user`. PLAN.md D9 dice «aplicación con un único `apply_migration`», y
  **no he probado si `apply_migration` sigue funcionando bajo esa bandera** — una sonda sería
  una escritura en producción, y PR2 autoriza aplicar *esta* migración, no experimentar. Se
  lo traslado a Brent y el prompt está ordenado para absorberlo: **todo el trabajo de
  ficheros va primero y se commitea**, la base de datos va después. Si el canal está cerrado,
  A1/A2/A9/A10/A11 quedan hechos y solo faltan A3–A8.
- FIXTURE DE A6–A8 PRESELECCIONADO, para que el ejecutor no elija uno ambiguo: mes
  `60a263e9…` tiene dos matches y **cada usuario de ese mes pertenece exactamente a uno**,
  así que «la misma fila que A7» no admite lectura doble. Valores esperados calculados por mí
  con la regla D1: `3d4d6709…` → `(6, 1)` · `771bd494…` → `(9, 2)`. Sin PII: el prompt toma
  los `user_id` de subconsultas para que nadie tenga que pegarlos.
- GATE: el padre inmediato de P1 es `main`@`5b947ac`, **no** `base-by-file.txt`. El prompt
  exige medir el padre antes de ramificar. Diferencia esperada: `MesaAbiertaAdmin.tsx`
  `tsc (12)` → `(10)`, desaparecen exactamente el TS2339 de `:376` y el TS2353 de `:882`
  (ambos por `host_food_assignment`), cero líneas añadidas, totales `tsc 1041 → 1039` y
  `160/94/46` sin mover. Es la «excepción medida y única» de D8.
- FINDINGS RAISED: ninguno (no hay ronda de ejecutor que juzgar todavía).
- DECISIONS: ninguna nueva. El plan sigue congelado en la revisión 7; nada de lo que verifiqué
  lo contradice.
- OPEN AFTER THIS ROUND: (1) Brent resuelve el canal de escritura — quitar `--read-only` del
  servidor `supabase-casa` o aplicar él mismo la migración desde el editor SQL. (2) Despachar
  `/exec UPGRADE P1 r1`. (3) Verificación independiente del PM cuando vuelva el reporte.

### 2026-08-07 — P1 r1 — Claude Opus 5 (EXEC)
- SESSION: UPGRADE · P1 · r1 · EXEC
- CONTEXT PRESSURE: comfortable — el trabajo de ficheros y los cuatro gates cupieron sin
  presión; la mitad de base de datos se cortó por permisos, no por contexto.
- ACTION: creada la rama `feat/mesa-md-schema` desde `main`@`05dc4ca` (**no** `5b947ac`: main
  había avanzado un commit, y ese commit es el del PM que escribió este mismo prompt —
  `LEDGER.md`, `PLAN.md`, `prompts/P1-r1.md`, cero código, verificado con `git diff --name-only`,
  así que no puede mover ningún diagnóstico). Escritos los dos ficheros del scope: la migración
  `20260806000000_mesa_main_dish_optout.sql` con el contrato D14 reproducido literalmente, y
  las **seis** declaraciones de `types.ts` (`can_bring_main_dish` en participants,
  `host_food_assignment: string | null` en matches), colocadas al final de los campos de
  dominio para que los timestamps sigan últimos, como en todos los bloques del fichero. Sin
  tocar el mapa `Functions` (D15).
- **BLOQUEADO EN LA MITAD DE BASE DE DATOS.** El riesgo que el PM levantó en la ronda anterior
  se materializó, pero **por una causa distinta a la prevista**: `apply_migration` no falló por
  la bandera `--read-only` del servidor MCP, sino que **el clasificador de permisos de Claude
  Code denegó la llamada** antes de que saliera de la sesión. Error verbatim: *"Permission for
  this action was denied by the Claude Code auto mode classifier. Reason: Blocked by
  classifier."* No es un error de Postgres. No reintenté por otro canal: nada de
  `supabase db push` (D9), ni `psql`, ni CLI, ni `open-brain`.
- Verificado por lectura que la base quedó **intacta**: `column_exists=0`, `function_exists=0`,
  31 filas, `current_user = supabase_read_only_user`. No hay aplicación parcial que deshacer.
  La ronda de remediación es de verificación pura, tal como el prompt se ordenó para absorber.
- COMMITS: `d9eebb0` (los 2 ficheros del scope) · más este entry del ledger.
- TESTS: gate D8 padre→punta = **exactamente** lo predicho: `MesaAbiertaAdmin.tsx`
  `tsc (12)` → `(10)`, desaparecen el TS2339 de `:376` y el TS2353 de `:882` (los dos de
  `host_food_assignment`), **cero líneas añadidas**, `types.ts` sigue `(0)(0)(0)(0)`. Totales
  `tsc 1041 → 1039`; `eslint=160 deno-lint=94 deno-check=46` sin mover. Exit 0 en ambas
  ejecuciones. · `npm run build` ok · `deno test` **409 pass / 0 fail** ·
  `npx vitest run --no-file-parallelism` → 7 rojos la 1ª vez y 8 la 2ª, **no** los 6 de base.
- **B-01 es peor de lo documentado, y lo probé con un control en vez de afirmarlo.** El flake
  no está solo en `CuentacuentoEditor.ph.surfaces.test.tsx`: también flakean
  `ph.cancel.test.tsx` (T-H.9) y `ph.concurrency.test.tsx` (T-H.5). Ejecuté la suite completa
  **tres veces sobre `main` sin mis cambios**: 6 / **8** / 6 rojos. La ejecución de 8 sobre
  `main` incluye el mismo T-H.9 que había visto en mi rama, así que el flake es preexistente y
  dependiente de carga, no mío. Además los tres ficheros pasan 18/18 en aislamiento sobre mi
  rama, y mi diff de `types.ts` son seis declaraciones **dentro de `export type Database`**:
  se borran en tiempo de compilación y no pueden alterar la conducta en ejecución.
- FINDINGS RAISED: (1) el canal de escritura está cerrado por el clasificador de permisos de la
  sesión, no por el servidor MCP — quitar `--read-only` **no bastaría**; hace falta que Brent
  autorice la llamada o aplique él la migración. (2) B-01 cubre tres ficheros, no uno.
- DECISIONS: ninguna. El plan no se contradice en nada de lo que medí.
- BACKLOG ADDED: **B-03** — ampliar B-01 a los tres ficheros `CuentacuentoEditor.ph.*`
  (`surfaces` T-H.4, `cancel` T-H.9, `concurrency` T-H.5); el criterio D8.2 «el conjunto de
  rojos por nombre es exactamente el de base» no es comprobable de forma fiable mientras estos
  flakeen bajo carga.
- OPEN AFTER THIS ROUND: A3–A8 sin ejecutar (no hay canal de escritura). Brent decide cómo se
  aplica la migración; después, una ronda corta de solo verificación cierra A3–A8 sobre el
  commit `d9eebb0` que ya está en la rama.

### 2026-08-07 — P1 round 1 — PM (Fable) — VERIFICACIÓN
- SESSION: UPGRADE · P1 · PM
- ACTION: Verificación independiente del EXECUTOR REPORT de P1 r1 (`d9eebb0` + `d8e6e9c`).
  **Cero hallazgos BLOCKING. El reporte es exacto en todo lo que comprobé.** La fase queda
  incompleta —no defectuosa— porque A3–A8 necesitan un canal de escritura que la sesión del
  ejecutor no tenía. Prompt de r2 (solo verificación) escrito y commiteado.
- LO QUE VERIFIQUÉ YO MISMO, no leyendo el reporte:
  - **Alcance**: `git diff main...feat/mesa-md-schema --stat` → **3 ficheros**, +93/−0:
    la migración (+37), `types.ts` (+6) y `LEDGER.md` (+50, proceso). Ni un fichero de más.
  - **La migración es el contrato D14 literal.** Extraje el bloque `CREATE OR REPLACE
    FUNCTION … GRANT` de `PLAN.md` y del fichero y los difeé: **idénticos**. A1:
    `grep -icE 'drop table|truncate|alter column|drop column'` → **0**.
  - **`types.ts`**: leí el diff entero. Seis líneas, las seis congeladas, con
    `host_food_assignment: string | null` (no el enum). Colocadas antes de
    `created_at`/`updated_at`, coherente con todos los bloques del fichero. A9:
    `grep -c get_my_dinner_summary` → **0**. Mapa `Functions` intacto (D15).
  - **A2**: PR1 y PR2 están en el Decision Log con fecha 2026-08-06 en `main`; el primer
    commit de P1 es de **2026-08-07T15:28:28-04:00**. Anterioridad probada.
  - **Gate D8 reejecutado por mí**, padre en un worktree desprendido en `05dc4ca` y punta en
    el checkout: ambos **EXIT=0**; totales `tsc=1041 → 1039`, `160/94/46` sin mover; el
    `diff` de las dos salidas es **byte a byte el que reportó el ejecutor** — una línea de
    recuento cambiada (`tsc (12)` → `(10)`) y **dos diagnósticos eliminados**, el TS2339 de
    `:376` y el TS2353 de `:882`, ambos de `host_food_assignment`. **Cero líneas añadidas.**
    Es exactamente la «excepción medida y única» que D8 predijo.
  - **`npm run build`** ok (10.16 s) · **`deno test --allow-all .`** → **409 pass / 0 fail**.
  - **A11 probado por evidencia dura, no por declaración**: `list_migrations` sigue teniendo
    **60** migraciones, con `20260610233000` como última. Las dos del repo sin aplicar,
    `20260612000000` y `20260612000001`, **siguen sin aplicar**. Si alguien hubiera corrido
    `supabase db push` estarían dentro. No se corrió.
  - **Base de datos intacta**: `column_exists=0`, `function_exists=0`, 31 filas, cero filas
    de la migración de P1. No hay aplicación parcial que deshacer.
- **EL FLAKE DE VITEST: el ejecutor tenía razón, y lo probé por dos vías independientes.**
  - **Empírica**: corrí la suite completa en el **commit padre `05dc4ca`, sin ninguno de los
    cambios de P1** → **7 rojos / 1035 pass**, los 6 de base más
    `CuentacuentoEditor.ph.surfaces.test.tsx`. En la rama obtuve **7 / 1035**, los 6 de base
    más `CuentacuentoEditor.ph.cancel.test.tsx` (T-H.9). Mismo exceso, sin P1 de por medio.
  - **Estructural, que es la que cierra el asunto**: `src/integrations/supabase/types.ts` no
    tiene **ninguna** exportación de runtime — siete `export type` y nada más — así que se
    borra en la transformación; y ningún test de `liturgia-builder` lo importa. El diff de
    P1 **no puede** alterar la conducta en ejecución de esos ficheros. Eso es una prueba, no
    una muestra.
- **RULING DEL PM sobre A10, declarado para que el revisor pueda impugnarlo.** Doy A10 por
  **cumplido**: su mitad de diagnósticos está verificada al byte, y la sub-condición de
  Vitest de D8.2 («el conjunto de rojos por nombre es exactamente el de base») no se cumple
  al pie de la letra **ni en la rama ni en el padre**. No es atribuible a P1. Es un defecto
  del criterio, no de la fase — ver S1.
- FINDINGS:
  - **BLOCKING: ninguno.**
  - **[S1] SHOULD-FIX (criterio del plan, no código)** — D8.2 exige que el conjunto de rojos
    por nombre sea exactamente el de base, y con tres ficheros `CuentacuentoEditor.ph.*`
    flakeando bajo carga eso **no es comprobable de forma fiable en ninguna fase**. Cada
    fase futura repetirá este juicio. Propuesta para Brent, que requiere entrada en el
    Decision Log porque el plan está congelado: o se arregla el flake, o D8.2 pasa a «el
    conjunto de rojos **atribuibles a los ficheros de la fase** no crece, y un exceso se
    descarta reejecutando y comparando contra el padre». **No he tocado el plan.**
  - **[N1] NIT** — el ejecutor pasó su primera ejecución de Vitest por `tail` y perdió el
    código de salida. Lo declaró y la repitió redirigida. Solo queda registrado.
- CORRECCIÓN DE REGISTRO DEL PM: la entrada del ejecutor numeró su item de backlog como
  **B-03**, que ya está ocupado en `PLAN.md` (la nota de ESLint `--quiet` de P0 r5). Se
  renumera a **B-05** y se añade a la tabla de Backlog. La entrada del ejecutor no se edita
  —el ledger es append-only—; esta línea es la corrección.
- **EL BLOQUEO, con precisión.** `apply_migration` no falló por Postgres ni por el servidor
  MCP: lo denegó el **clasificador de permisos de Claude Code** antes de salir de la sesión.
  Son **dos puertas distintas** y solo una está probada cerrada: aunque Brent autorice la
  llamada, el servidor `supabase-casa` sigue configurado `--read-only` y **nadie ha
  comprobado si `apply_migration` funciona bajo esa bandera**. El camino barato es que Brent
  aplique el `.sql` desde el editor SQL y r2 solo verifique en lectura — que ya probé que
  funciona con `supabase_read_only_user`.
- **DE-RIESGO ADELANTADO PARA r2**: ejecuté el cuerpo del contrato D14 **en línea** contra
  los datos reales, con el claim JWT del anfitrión puesto, y devuelve exactamente
  `(3d4d6709…, 6, 1)` — el valor que A7 espera. Las uniones, los `COALESCE`, los casts y el
  filtro por `auth.uid()` están comprobados **antes** de tocar producción. Lo único que no se
  puede ejercitar sin crear la función es la resolución del nombre `match_id`, que es a la
  vez parámetro OUT y columna de `mesa_abierta_assignments`; en el cuerpo toda referencia va
  calificada por tabla, así que no debería haber ambigüedad, y el prompt de r2 ordena
  reportarlo como FINDINGS si la hubiera en vez de parchear el SQL.
- TESTS: gate D8 padre/punta EXIT=0 y diff idéntico al reportado · `npm run build` ok ·
  `deno test` 409/0 · Vitest rama 7/1035 y **control en el padre 7/1035**.
- DECISIONS: ninguna. Nada de lo que medí contradice el plan congelado.
- BACKLOG ADDED: **B-05** (los tres ficheros `CuentacuentoEditor.ph.*` flakean, no solo
  `surfaces`) y **S1** queda arriba a la espera de la decisión de Brent.
- OPEN AFTER THIS ROUND: (1) Brent aplica la migración —recomendado: editor SQL— o autoriza
  el canal del agente. (2) `/exec UPGRADE P1 r2`, ronda de **solo verificación** sobre A3–A8.
  (3) S1 espera decisión. P1 **no se marca DONE**: falta r2 y falta Codex.

---

### 2026-08-07 — P1 r2 — Claude Opus 5 (EXEC)
- SESSION: UPGRADE · P1 · r2 · EXEC
- CONTEXT PRESSURE: comfortable — la ronda se detuvo en el STEP 0 por bloqueo, mucho antes
  de cualquier presión de contexto.
- ACTION: **STATUS: BLOCKED.** La segunda puerta —la que nunca se había probado— está
  cerrada. A3–A8 no son ejecutables porque la migración sigue sin aplicar.
  - **STEP 0, sonda de solo lectura**: `column_exists=0`, `function_exists=0`. Mundo «ambos
    0», así que el prompt ordenaba **un** intento de `apply_migration`. Lo hice, con el
    contenido verbatim del `.sql` y el nombre `20260806000000_mesa_main_dish_optout`.
  - **La llamada falló con**: `Cannot apply migration in read-only mode.`
  - **Qué puerta fue, con precisión**: la del **servidor MCP**, no la de Claude Code. El
    clasificador de permisos **dejó pasar** la llamada esta vez (en r1 la había denegado
    antes de salir de la sesión); el error viene del servidor como resultado de la
    herramienta. Confirmado en la configuración: `~/.claude.json:1955-1962` define
    `supabase-casa` con `args: ["--project-ref", "mulsqxfhxxdsadxsljss", "--read-only"]`.
    **Ahora las dos puertas están probadas y las dos están cerradas al canal del agente.**
  - **Un intento, sin reintento, sin segundo canal.** No corrí `supabase db push`, ni `psql`,
    ni la CLI, ni busqué claves de servicio, ni toqué `open-brain`. **No edité
    `~/.claude.json` para quitar `--read-only`**: eso sería el workaround que la regla
    prohíbe, y además un cambio de configuración que no me corresponde hacer.
  - **No edité ninguno de los dos ficheros de scope.** `git diff d9eebb0 --` sobre la
    migración y `types.ts` sale **vacío**; la rama es `feat/mesa-md-schema`, punta `ac9ef14`
    (el commit de documentación del PM, permitido por el prompt).
- **LO QUE SÍ PUDE PROBAR — evidencia que no depende de la migración.**
  - **V2 — nada más se movió.** `list_migrations` sigue en **60** migraciones, última
    `20260610233000`. `20260612000000` y `20260612000001` **siguen ausentes**, y no hay fila
    de `20260806000000`. `mesa_abierta_participants` sigue con **31 filas**. Cero aplicación
    parcial: el fallo fue limpio, no dejó ni la columna ni la función.
  - **STEP 4 — gate D8 de manipulación**: `EXIT=0`, stderr
    `[gates] totales del proyecto: tsc=1039 eslint=160 deno-lint=94 deno-check=46`, byte a
    byte lo que el prompt exigía. `MesaAbiertaAdmin.tsx` en `tsc (10)`. La rama es
    exactamente lo que r1 dejó. No repetí build, Vitest ni Deno: ningún fichero cambió.
  - **V1 no es obtenible**: `pg_get_functiondef` requiere que la función exista.
- COMMITS: solo esta entrada de ledger. Cero código.
- TESTS: gate D8 `EXIT=0` · `tsc=1039 eslint=160 deno-lint=94 deno-check=46`.
- FINDINGS RAISED:
  - **[BLOCKING B1] El canal de escritura del agente está cerrado por las dos puertas.**
    r1 murió en el clasificador de permisos; r2 murió en `--read-only` del servidor MCP. La
    hipótesis del PM en r1 —que autorizar la llamada podría no bastar— **queda confirmada**.
    Para desbloquear P1 hay exactamente dos caminos, y **los dos son decisión de Brent**:
    (a) que Brent aplique el `.sql` desde el editor SQL de Supabase —el camino barato, y el
    que el propio PM recomendó—, y r2 se rehaga como ronda de solo verificación, que ya está
    probada viable con `supabase_read_only_user`; o (b) quitar `--read-only` de
    `~/.claude.json` para `supabase-casa`, lo que abre el canal de escritura del agente
    contra **producción compartida con Life OS** de forma permanente. (a) es
    estrictamente menos arriesgado y no requiere tocar configuración.
- DECISIONS: ninguna. No he tocado el plan congelado ni el SQL.
- BACKLOG ADDED: ninguno.
- OPEN AFTER THIS ROUND: (1) **A3–A8 siguen sin verificar** — es lo único que le falta a P1.
  (2) Brent elige camino (a) o (b) del hallazgo B1. (3) r3 será la ronda de verificación
  A3–A8 una vez aplicada la migración. (4) S1 (criterio D8.2 vs. el flake) sigue esperando
  decisión desde r1. P1 **no se marca DONE**: faltan A3–A8 y falta Codex.

### 2026-08-07 — P1 round 2 — PM (Fable) — VERIFICACIÓN
- SESSION: UPGRADE · P1 · PM
- ACTION: Verificación independiente del EXECUTOR REPORT de P1 r2 (`87e7e0c`). **Cero
  hallazgos. El ejecutor hizo exactamente lo correcto: un intento, sin rodeos, y paró.** La
  segunda puerta —la que nadie había probado— resultó estar cerrada también. Prompt de r3
  escrito y commiteado, con el intento de escritura **prohibido de antemano**.
- LO QUE VERIFIQUÉ YO MISMO:
  - **Alcance de r2**: `87e7e0c` toca **solo** `LEDGER.md` (+55). `git diff d9eebb0` sobre los
    dos ficheros del scope → **vacío**. Nadie tocó el código, ni esta ronda ni ninguna.
  - **Base de datos intacta y sin aplicación parcial**: `column_exists=0`,
    `function_exists=0`, 31 filas, y `20260612000000`, `20260612000001` y `20260806000000`
    **los tres ausentes** de `schema_migrations`. El fallo del servidor fue limpio.
  - **Gate reejecutado por mí**: `EXIT=0`, totales `tsc=1039 eslint=160 deno-lint=94
    deno-check=46`, y la salida es **byte a byte idéntica** a la que yo mismo medí en r1. La
    rama está exactamente como la dejé verificada.
  - **La bandera `--read-only` la había confirmado yo en la ronda anterior**, en los args del
    servidor `supabase-casa` de `~/.claude.json`. El mensaje del servidor —*"Cannot apply
    migration in read-only mode"*— es coherente con eso y con que el clasificador sí dejó
    pasar la llamada esta vez. **Las dos puertas están ahora probadas, y las dos cerradas.**
    No reintenté la escritura yo: sería la misma llamada denegada, contra producción.
- CORRECCIÓN DE MI PROPIA ENTRADA ANTERIOR: en la verificación de r1 escribí «sigue teniendo
  **60** migraciones». El recuento exacto es **59** (`min 20241109000000`, `max
  20260610233000`). Lo leí de la lista del MCP en vez de contarlo. No cambia ninguna
  conclusión —lo que sostiene A11 es que `20260612000000/1` siguen ausentes, y siguen— pero
  el registro debe ser exacto. `PLAN.md` («remoto con 60 migraciones», en *Estado actual
  verificado*) arrastra el mismo desfase de uno; no lo toco, el plan está congelado y no es
  material.
- FINDINGS: **BLOCKING: ninguno. SHOULD-FIX: ninguno nuevo. NIT: ninguno.**
- **RONDAS: r1 y r2 no fueron rondas de remediación.** Ninguna de las dos produjo un solo
  hallazgo BLOCKING; las dos murieron contra infraestructura, no contra un defecto. El tope de
  3 del SOP §1.5 existe para cortar el ping-pong de defectos, y aquí no ha habido ninguno. Aun
  así, **por la letra del tope, r3 es la última ronda disponible**, así que el prompt de r3
  prohíbe explícitamente volver a intentar la escritura: si la migración no está aplicada, el
  ejecutor para en una sola llamada en vez de quemar la ronda contra el mismo muro.
- **[S2] SHOULD-FIX — ESTO NECESITA DECISIÓN DE BRENT ANTES DE APLICAR NADA.** D9 dice, en un
  plan congelado: *«Aplicación con un único `apply_migration`, tras PR1 y PR2»*. Las dos vías
  del agente hacia `apply_migration` están probadas cerradas, así que la única ruta que queda
  es que Brent pegue el `.sql` en el editor SQL — y **eso no es lo que D9 dice literalmente**.
  Si se hace sin registrarlo, la revisión final de Codex lo verá, con razón, como una
  violación de decisión congelada, y estaríamos discutiéndolo *después* de haber escrito en
  producción. El fondo de D9 se respeta entero: aditivo, sin `db push`, una sola aplicación
  atómica, después de PR1 y PR2 — solo cambia el mecanismo, y hacia uno donde la escritura la
  hace Brent en vez de un agente. **Requiere una fila en el Decision Log, que solo Brent puede
  autorizar. Yo no he tocado el plan.**
- **CONSECUENCIA TÉCNICA DE ESA DESVIACIÓN, para que no sorprenda a nadie**: el editor SQL
  **no** escribe fila en `supabase_migrations.schema_migrations`. Tras aplicar, el remoto
  tendrá la columna y la función pero **no** la versión `20260806000000`, mientras el repo sí
  tiene el fichero. Es deriva nueva, en dirección contraria a la ya documentada
  (`20260612000000/1`: en el repo, sin aplicar). Inocua en la práctica —`ADD COLUMN IF NOT
  EXISTS` y `CREATE OR REPLACE` son idempotentes, así que una reaplicación no rompe nada— pero
  debe quedar escrita. Si Brent prefiere cerrarla, un `insert … on conflict do nothing` sobre
  `schema_migrations` en la misma sesión del editor lo hace; es su decisión, no mía.
- TESTS: gate `EXIT=0`, salida idéntica a la medición del PM en r1 · sin reejecutar build,
  Vitest ni Deno: ningún fichero cambió desde r1 y ya los verifiqué entonces.
- DECISIONS: ninguna. Las dos pendientes (S1 de r1 sobre D8.2, S2 de esta ronda sobre D9) son
  de Brent.
- OPEN AFTER THIS ROUND: (1) **Decision Log para S2 antes de aplicar**, no después.
  (2) Brent aplica el `.sql` desde el editor SQL. (3) `/exec UPGRADE P1 r3`, verificación pura
  de A3–A8, con la escritura prohibida por prompt. (4) S1 sigue esperando. P1 **no se marca
  DONE**: faltan A3–A8 y falta Codex.

### 2026-08-07 — P1 r3 — Claude Opus 5 (EXEC)
- SESSION: UPGRADE · P1 · r3 · EXEC
- CONTEXT PRESSURE: comfortable — la ronda terminó en la llamada de STEP 0.
- ACTION: **Parada en una sola llamada, como manda el prompt.** Verifiqué primero la rama
  (`feat/mesa-md-schema`) y que `git diff d9eebb0` sobre los dos ficheros del scope está
  **vacío**. Después ejecuté la única consulta de STEP 0 vía `mcp__supabase-casa__execute_sql`:
  `[{"column_exists":0,"function_exists":0}]`. **La migración no está aplicada**, así que no
  hay nada que verificar: A3–A8 no son ejecutables. No llamé a `apply_migration` — sus dos
  puertas ya están probadas cerradas en r1 y r2, y el prompt lo prohíbe de antemano. No usé
  `supabase db push`, ni `psql`, ni la CLI, ni el servidor `open-brain`, ni toqué ningún
  fichero de configuración. Tampoco ejecuté STEP 1–4: sin columna ni función, sus consultas
  no tienen objeto, y el gate de STEP 4 es una comprobación anti-manipulación sobre ficheros
  que nadie tocó.
- COMMITS: solo esta entrada de registro, en `feat/mesa-md-schema`. Cero ficheros de código.
- TESTS: ninguno ejecutado. Ningún fichero cambió desde r1; los gates locales siguen siendo
  los que el PM midió y reverificó (`EXIT=0`, `tsc=1039 eslint=160 deno-lint=94
  deno-check=46`). Volver a correrlos no aportaba evidencia nueva sobre un árbol idéntico.
- FINDINGS RAISED: ninguno. Los ceros de STEP 0 son **BLOCKED**, no un defecto: coinciden
  exactamente con lo que el PM verificó al cerrar r2, o sea que el estado remoto no se ha
  movido y **no hay aplicación parcial** (0/0, no 1/0).
- DECISIONS: ninguna. Las dos abiertas (S1 sobre D8.2, S2 sobre D9) siguen siendo de Brent, y
  **S2 sigue siendo previa a cualquier aplicación**.
- BACKLOG ADDED: ninguno.
- OPEN AFTER THIS ROUND: (1) **S2 al Decision Log antes de aplicar nada** — sin eso, aplicar
  desde el editor SQL le deja a Codex una violación de decisión congelada. (2) Brent aplica
  `supabase/migrations/20260806000000_mesa_main_dish_optout.sql`. (3) A3–A8 siguen sin
  verificar y consumen ya las tres rondas del tope de SOP §1.5 sin haber podido ejecutarse:
  **la continuación necesita autorización explícita de Brent para una r4**, igual que la que
  concedió en P0. (4) S1 sigue esperando. **P1 no se marca DONE**: faltan A3–A8 y falta Codex.

### 2026-08-08 — P1 round 3 — PM (Fable) — VERIFICACIÓN + PROPUESTA DE RE-PLAN (SOP §3.9)
- SESSION: UPGRADE · P1 · PM
- ACTION: Verificación independiente de P1 r3 (`6dc9c73`). **Cero hallazgos; el reporte es
  exacto.** Con r3 se agota el tope de 3 rondas del SOP §1.5 **sin que A3–A8 se hayan podido
  ejecutar ni una sola vez**, así que el SOP manda propuesta de re-plan en vez de una cuarta
  ronda. Va abajo. **No he tocado `PLAN.md`.**
- LO QUE VERIFIQUÉ YO MISMO:
  - `feat/mesa-md-schema` está en `6dc9c73` y **publicado** (`git ls-remote` →
    `6dc9c73b93…`). `6dc9c73` toca **solo** `LEDGER.md` (+30).
  - **Los dos ficheros del scope siguen byte a byte como en `d9eebb0`**, comprobado
    ref-contra-ref (`git diff d9eebb0 6dc9c73 -- <los dos>` → vacío).
  - La rama frente a `main`: 6 ficheros, 886 inserciones, **cero borrados**; fuera de
    `docs/plan/upgrade/` solo están la migración (+37) y `types.ts` (+6).
  - Base de datos: `column_exists=0`, `function_exists=0`, 31 filas, 59 migraciones, última
    `20260610233000`. Idéntico a lo que verifiqué al cerrar r2. Nada se ha movido.
  - **P1a es inerte, y lo comprobé en vez de suponerlo**: `git grep can_bring_main_dish` sobre
    la rama devuelve, fuera de `docs/`, **solo** las tres declaraciones de `types.ts` y la
    migración. Ningún consumidor. `host_food_assignment` ya existe en el remoto desde
    `20241203`. Es decir: los dos ficheros pueden mergearse sin que nada los lea.
  - **No reejecuté el gate**, y lo digo en vez de dejarlo implícito: el diff ref-contra-ref ya
    prueba que los ficheros no se movieron, el gate es función pura de los ficheros y Z4 fijó
    que dos ejecuciones dan salida byte-idéntica. Reejecutarlo no añadiría información.
- **INCIDENTE OPERATIVO — el checkout se cambió de rama por debajo de este workstream.**
  Al empezar la verificación, `/Users/brentcurtis/dev/casa-web` estaba en
  **`phase/E2-caratula`** (workstream AUDIO), con un commit propio `6d45f35`. Mis primeros
  `git diff` contra el árbol de trabajo salieron alarmantes —los ficheros de P1 parecían
  revertidos y la migración borrada— porque estaban comparando contra **otra rama**. Rehecha
  la comprobación ref-contra-ref, **todo está intacto**. El error fue del comando, no del
  trabajo, y el reporte del ejecutor era correcto cuando lo escribió.
  **Es un riesgo vivo, no una anécdota**: dos workstreams de agente comparten un único
  checkout. Es exactamente el modo de fallo de B-02 (siete entradas de ledger perdidas en una
  rama ajena) y lo que el SOP §1.8 manda evitar con worktrees. Un ejecutor de UPGRADE lanzado
  mientras AUDIO trabaja commitearía sobre `phase/E2-caratula`. **Recomendación a Brent: dar a
  UPGRADE su propio worktree** (`git worktree add ../casa-upgrade feat/mesa-md-schema`) antes
  de la siguiente ronda. Yo escribo esta entrada desde un worktree desprendido y publico por
  SHA, sin tocar el checkout de nadie.
  Nota derivada: `main` local está en `05dc4ca` y `origin/main` en `5b947ac` — mi commit del
  prompt de P1 r1 nunca se empujó a `main` (deliberado: empujar a `main` despliega). Como
  `phase/E2-caratula` salió de `05dc4ca`, ese commit de docs viaja ahora también en la rama de
  AUDIO. Inocuo, pero que conste.
- FINDINGS: **BLOCKING: ninguno. SHOULD-FIX: ninguno nuevo. NIT: ninguno.** Las tres rondas de
  P1 han producido, entre las tres, **cero hallazgos contra el código**.

---

## PROPUESTA DE RE-PLAN — P1 (SOP §3.9). Requiere aprobación de Brent.

### 1. Qué se equivocó el plan, y con qué evidencia

**No es el esquema.** El contrato D14 está verificado: ejecuté su cuerpo **en línea** contra
los datos reales con el claim JWT del anfitrión puesto y devuelve exactamente `(3d4d6709…,
6, 1)`, el valor que A7 espera. Las uniones, los `COALESCE`, los casts y el filtro por
`auth.uid()` son correctos. Los dos ficheros pasan todos los gates y eliminan los 2
diagnósticos medidos, ni uno más.

**Es D9.** El plan congeló el mecanismo — *«Aplicación con un único `apply_migration`»* —
dando por hecho que un agente podría ejecutarlo. Tres rondas demuestran que no:

| Ronda | Qué pasó | Puerta |
|---|---|---|
| r1 | `apply_migration` denegado antes de salir de la sesión | clasificador de permisos de Claude Code |
| r2 | el clasificador dejó pasar; el servidor respondió `Cannot apply migration in read-only mode` | `--read-only` del MCP `supabase-casa` |
| r3 | no se intentó, por diseño del prompt; la migración seguía sin aplicar | — |

Ninguna de las tres murió contra un defecto. **A3–A8 no se han ejecutado ni una vez.**

El diagnóstico exacto: el plan identificó bien **PR1** (excepción a la regla de prefijo) y
**PR2** (autorización para tocar la instancia compartida) como puertas humanas que solo Brent
puede abrir. **La aplicación en sí es una tercera puerta humana**, y el plan la etiquetó como
trabajo de agente. Autorizar un cambio y poder ejecutarlo no son lo mismo — es la misma
distinción que PR2 ya hacía, aplicada un paso más allá.

### 2. La enmienda propuesta

**Partir P1 por la línea que el bloqueo ya trazó**, en vez de gastar rondas contra ella:

- **P1a — Esquema: ficheros.** Rama `feat/mesa-md-schema`, ya construida. Scope: la migración
  y las seis declaraciones de `types.ts`. Criterios **A1, A2, A9, A10, A11** — los cinco
  cumplidos y verificados por el PM de forma independiente. Verde, mergeable e **inerte**:
  cero consumidores, comprobado por `git grep`.
- **P1b — Esquema: aplicación y verificación.** Prerrequisito **PR3 — Brent aplica la
  migración**, puerta humana explícita, hermana de PR1 y PR2. Criterios **A3–A8**. Una sola
  ronda de ejecutor, de solo lectura; el prompt ya está escrito (`prompts/P1-r3.md` sirve tal
  cual).

**Por qué partir y no simplemente autorizar una r4.** Una r4 cierra P1 si Brent pega el SQL
hoy, y es legítima —el precedente existe, Brent levantó los topes dos veces en P0—. Pero deja
el workstream entero colgando de una acción humana que lleva tres rondas sin ocurrir, y no
arregla la causa. Partir cuesta lo mismo y compra dos cosas: **P2, P3a y P3b no tocan la base
de datos y pueden empezar en cuanto P1a se mergee**, y la puerta humana queda escrita en el
plan, junto a PR1 y PR2, en vez de implícita en una ronda que sigue chocando.

### 3. Qué fases posteriores quedan invalidadas

**Ninguna.** Ni un criterio de aceptación cambia. Solo cambia el grafo de dependencias:

| Fase | Depende de (hoy) | Depende de (propuesto) |
|---|---|---|
| P2, P3a | P0 | **sin cambio** — nunca dependieron de P1 |
| P3b | P3a | **sin cambio** |
| P4 | P1, P2, P3b | **P1b**, P2, P3b |
| P5a | P1, P4 | **P1b**, P4 |
| P5b | P1, P5a | **P1b**, P5a |
| P6 | P4, P5a | **sin cambio** |
| P7 | P4 | **sin cambio** |
| P8 | P1, P4, P7 | **P1b**, P4, P7 |

Orden de merge: **P1a → P2 → P3a → P3b**, con **P1b obligatoria antes de P4** — la primera
fase que de verdad necesita la columna (persiste comida y lee `can_bring_main_dish`).

### 4. Filas de Decision Log propuestas — REDACTADAS, NO ESCRITAS

| Date | Decision | Rationale | Raised by |
|---|---|---|---|
| 2026-08-08 | **D9 se cumple por aplicación manual en el editor SQL, no por `apply_migration`** | Las dos puertas del canal del agente están probadas cerradas (r1 clasificador, r2 `--read-only`). El fondo de D9 —aditivo, sin `db push`, una sola aplicación atómica, tras PR1 y PR2— se respeta entero; solo cambia el mecanismo, y hacia uno donde la escritura la ejecuta Brent | Brent (decisión), PM (diagnóstico) |
| 2026-08-08 | **P1 se parte en P1a (ficheros) y P1b (aplicación + A3–A8), con PR3 como puerta humana** | Tres rondas agotadas sin un solo hallazgo: las tres murieron contra un canal de escritura que ningún agente tiene. El plan modeló PR1 y PR2 como puertas de Brent pero no la aplicación misma. Partir desbloquea P2/P3a/P3b, que no tocan la base | PM (diagnóstico), Brent (decisión) |
| 2026-08-08 | **PR3 — Brent aplica `20260806000000_mesa_main_dish_optout.sql` desde el editor SQL** | Tercera puerta humana, hermana de PR1 y PR2 | Brent |

**Consecuencia técnica que debe constar**: el editor SQL **no** escribe fila en
`supabase_migrations.schema_migrations`. Tras aplicar, el remoto tendrá columna y función pero
no la versión `20260806000000`, mientras el repo sí tiene el fichero — deriva nueva, en
dirección contraria a la ya documentada (`20260612000000/1`: en repo, sin aplicar). Inocua
(`ADD COLUMN IF NOT EXISTS` y `CREATE OR REPLACE` son idempotentes). Se cierra, si Brent
quiere, con un `insert … on conflict do nothing` en la misma sesión del editor.

### 5. Prompt de Codex para revisar la enmienda (SOP §3.9.5)

```
SESSION: UPGRADE · P1 · plan · REVIEW

Revisión adversarial de una enmienda a un plan CONGELADO: docs/plan/upgrade/PLAN.md,
revisión 7. Lee el LEDGER.md completo de P1 (r1, r2, r3 y las tres verificaciones del PM)
antes de opinar; la propuesta está en la entrada del 2026-08-08.

La enmienda parte P1 en P1a (los dos ficheros, ya construidos y verificados) y P1b (aplicar
la migración y verificar A3–A8), e introduce PR3 —Brent aplica la migración a mano— como
tercera puerta humana junto a PR1 y PR2. Motivo: tres rondas de ejecutor agotadas, cero
hallazgos, y A3–A8 nunca ejecutadas porque ningún agente tiene canal de escritura.

Evalúa:
1. ¿Es correcto el diagnóstico, o el PM está racionalizando un fallo de ejecución como un
   fallo del plan?
2. ¿Es P1a realmente mergeable e inerte? El PM afirma cero consumidores de
   `can_bring_main_dish`. Verifícalo tú.
3. ¿Deja la partición algún hueco? En concreto: ¿puede alguna fase entre P1a y P1b romperse
   porque `types.ts` declare una columna que el remoto todavía no tiene?
4. ¿Es correcto el grafo de dependencias propuesto (§3 de la entrada)?
5. ¿La aplicación manual desde el editor SQL viola D9 en el fondo, no solo en la letra?
6. ¿Hay un canal de escritura legítimo que el PM no haya considerado y que no sea peor?
7. El PM da A10 por cumplido pese a que la sub-condición de Vitest de D8.2 no se cumple ni en
   la rama ni en el padre (ver S1). ¿Sostiene ese ruling?

Formato CODEX REVIEW. PASS solo si aceptarías que se ejecute así.
```

---

- TESTS: sin reejecutar en esta ronda; el diff ref-contra-ref lo hace innecesario (ver arriba).
- DECISIONS: ninguna tomada por mí. Tres redactadas arriba, pendientes de Brent.
- BACKLOG: sin cambios. B-05 y S1 siguen abiertos.
- OPEN AFTER THIS ROUND: (1) **Worktree propio para UPGRADE** antes de nada más.
  (2) Brent aprueba o rechaza la propuesta de re-plan. (3) Si la aprueba: revisión de Codex de
  la enmienda, luego PR3, luego P1b con `prompts/P1-r3.md`. (4) S1 sigue esperando.
  P1 **no se marca DONE** y P1a tampoco: ninguna fase cierra sin PASS de Codex.

### 2026-08-08 — P1 — ENMIENDA APROBADA (Opción A) + ENSAYO EN DOCKER — PM (Fable)
- SESSION: UPGRADE · P1 · PM
- ACTION: Brent aprueba la **Opción A**: P1 se parte en **P1a** (ficheros) y **P1b**
  (aplicación + A3–A8), con **PR3** como tercera puerta humana. Delega en el PM las dos
  decisiones menores (S1 y la fila de `schema_migrations`). `PLAN.md` enmendado: índice de
  fases, prerrequisitos, sección de fase, D8 punto 2, estado del plan, y **cinco filas nuevas
  de Decision Log**. El resto del texto sigue congelado en la revisión 7.
- **POR QUÉ DOCKER NO SUSTITUYE A PR3** (pregunta de Brent, y merece respuesta escrita porque
  volverá a surgir): `supabase start` levanta un Postgres **local**. No toca
  `mulsqxfhxxdsadxsljss`, así que no entrega la funcionalidad ni satisface A3–A8, que son
  consultas sobre el estado **de producción** y aritmética D1 sobre los 6 matches reales. La
  única forma de que la CLI escriba en producción es `supabase db push`, prohibida por D9 —y
  la prohibición es sustantiva, no burocrática: arrastraría `20260612000000` y
  `20260612000001`, sin aplicar y **fuera** de lo que PR2 autorizó. Docker sirve de **ensayo**,
  y como ensayo ha valido mucho.
- **ENSAYO EJECUTADO, y lo que costó.** Primero lancé `supabase start` sin comprobar el
  entorno: había ya un stack local de **otro proyecto** (`sxlogxqzmarhqsblxmtj`) ocupando
  54321/54322 desde hacía 24 h, y el `config.toml` de casa-web **no declara puertos**, así que
  usa esos mismos por defecto. Lo aborté antes de que creara un solo contenedor y verifiqué
  que el stack ajeno seguía sano (11 contenedores healthy). Error mío; solo se descargaron
  imágenes. Lo rehíce con la herramienta mínima: **un Postgres desechable, sin puertos
  publicados**, con stubs de `auth.uid()` y las tres tablas, datos **sintéticos** (D12), y el
  **fichero de migración aplicado verbatim**.
- **RESULTADO DEL ENSAYO — A3–A8 en forma, todos verdes:**
  - `psql -f 20260806000000_mesa_main_dish_optout.sql` → `ALTER TABLE / CREATE FUNCTION /
    REVOKE / GRANT`, **exit 0**. **La función se crea sin error de ambigüedad en `match_id`** —
    era el único riesgo del contrato D14 que no se podía probar sin crearla, y queda cerrado.
  - **A3** → `can_bring_main_dish | boolean | NO | true`, `rows_not_true = 0`.
  - **A4** → `prosecdef = t`, `proconfig = {"search_path=\"\""}` (vacío).
  - **A5** → `anon_can = f`, `authed_can = t`.
  - **A6** → ajeno de otro mes: **0 filas**.
  - **A7** → anfitrión: **1 fila**, `(aaaa1111…, 6, 1)`. La fixture reproduce a propósito la
    forma de la real: anfitrión sin `+1`, cuatro invitados de los que **uno** trae `+1`, y un
    solo `main_course` ⇒ `1 + 0 + 4 + 1 = 6` personas y 1 plato.
  - **A8** → invitado de ese match: **la misma fila**.
  - Contenedor destruido; nada publicado, nada commiteado, cero datos de miembros.
  - **Esto es un ensayo, no A3–A8.** Los criterios exigen el estado de producción y los datos
    reales. Lo que compra es que, cuando Brent aplique, la probabilidad de sorpresa es mínima
    y el modo de fallo que quedaba —la ambigüedad— está descartado.
- **DECISIONES QUE BRENT ME DELEGÓ, y el criterio con que las tomé:**
  - **S1 → D8 punto 2 se enmienda.** De «el conjunto de rojos por nombre es exactamente el de
    base» a «los rojos atribuibles a `F` no crecen; uno fuera de `F` se dirime reejecutando la
    suite en el **commit padre**». Motivo: el criterio anterior **no es comprobable** —medí 7
    rojos en el propio commit padre, sin cambios de ninguna fase— y un criterio insatisfacible
    degenera en juicio discrecional en cada fase, que es peor que no tenerlo. La regla del
    padre no inventa nada: es la misma disciplina de comparación que el punto 4 ya usa para los
    diagnósticos, y no se puede burlar, porque un rojo causado por la fase no se reproduce en
    el padre. **B-05 sigue abierto**: enmendar el criterio no arregla el flake, y no pretendo
    que lo haga.
  - **Fila de `schema_migrations` → sí, se escribe.** El editor SQL no la escribe sola. Sin
    ella, el remoto tendría columna y función pero no la versión, mientras el repo sí tiene el
    fichero: cualquier reconciliación futura la vería pendiente, y el registro de migraciones
    dejaría de reflejar la realidad. Va como **sentencia aparte**, aditiva e idempotente, y
    **no** se mete en el fichero de la migración, que sigue byte a byte igual al contrato
    congelado y verificado.
- FINDINGS RAISED: ninguno.
- DECISIONS: cinco filas nuevas en el Decision Log de `PLAN.md` (D9 por editor SQL · partición
  P1a/P1b + PR3 · enmienda de D8.2 · fila de `schema_migrations`), tres con decisión de Brent y
  dos delegadas al PM.
- BACKLOG: sin cambios. B-05 abierto. S1 **cerrado** por la enmienda de D8.2.
- OPEN AFTER THIS ROUND: (1) **PR3 — Brent aplica** las dos sentencias que se le entregan.
  (2) `/exec UPGRADE P1b r1` con `prompts/P1-r3.md`, que sirve tal cual. (3) Revisión de Codex
  de esta enmienda; el prompt está en la entrada del 2026-08-08 anterior. (4) **P2, P3a y P3b
  pueden arrancar ya**: no tocan la base de datos. P1a y P1b **no se marcan DONE** sin PASS de
  Codex.

### 2026-08-08 — P1b r1 — Claude Opus 5 (EXEC)
- SESSION: UPGRADE · P1b · r1 · EXEC
- CONTEXT PRESSURE: comfortable — la ronda terminó en una sola llamada, como el prompt exigía.
- ACTION: Ronda despachada como `/exec UPGRADE P1b r1`; el prompt es `prompts/P1-r3.md`, que la
  entrada del PM del 2026-08-08 designa como válido «tal cual» para P1b. Verificado antes de
  nada: rama `feat/mesa-md-schema`, árbol limpio, y
  `git diff d9eebb0 -- <migración> <types.ts>` **vacío** — los dos ficheros de alcance son
  byte a byte los que el PM verificó.
  **STEP 0, la puerta, una única llamada de solo lectura** a `mcp__supabase-casa__execute_sql`:
  `column_exists = 0`, `function_exists = 0`. **Los dos en cero ⇒ la migración no está
  aplicada.** El prompt ordena parar ahí en una sola llamada y **no** invocar `apply_migration`
  «para confirmar»; no se invocó. A3–A8 no son ejecutables: no hay nada que verificar.
  **PR3 sigue sin resolverse** — Brent no ha aplicado todavía las dos sentencias.
  No se ejecutaron STEP 1–4: STEP 1–3 dependen del objeto inexistente, y STEP 4 (el gate de
  manipulación) mide una rama que ningún fichero ha tocado en esta ronda.
- COMMITS: solo esta entrada de ledger, en `feat/mesa-md-schema`. Cero ficheros de producción.
- TESTS: ninguno ejecutado. Justificación arriba; ningún fichero cambió.
- FINDINGS RAISED: ninguno. Que la migración no esté aplicada no es un hallazgo contra el
  plan: es exactamente el estado que PR3 describe y que el ensayo en Postgres desechable ya
  anticipó. Cuarta ronda consecutiva de P1 que muere en el mismo punto, y la primera que lo
  hace **en una sola llamada** — la partición P1a/P1b y el STEP 0 del prompt hicieron su
  trabajo: el coste de una ronda contra un canal cerrado bajó de una ronda entera a una
  consulta.
- DECISIONS: ninguna.
- BACKLOG ADDED: ninguno.
- OPEN AFTER THIS ROUND: (1) **PR3 — Brent aplica** desde el editor SQL las dos sentencias que
  el PM le entregó (la migración verbatim + la fila de `schema_migrations` aparte). (2)
  Redespachar `/exec UPGRADE P1b r1` con el mismo `prompts/P1-r3.md` una vez aplicada; el
  contenido sirve sin cambios. (3) P1a espera PASS de Codex. (4) P2, P3a y P3b pueden arrancar
  ya, no dependen de la base de datos.

### 2026-08-08 — P1b round 1 — PM (Fable) — VERIFICACIÓN
- SESSION: UPGRADE · P1b · PM
- ACTION: Verificación de P1b r1 (`d7fb9b0`). **Cero hallazgos; el ejecutor hizo exactamente
  lo correcto** — paró en una sola consulta y no intentó ningún rodeo. **PR3 sigue sin
  resolverse**, así que A3–A8 siguen sin poder ejecutarse. **Cambio de proceso** para que esto
  no vuelva a costar una sesión, abajo.
- LO QUE VERIFIQUÉ YO MISMO:
  - **Base de datos, consultada por mí**: `column_exists=0`, `function_exists=0`, 31 filas,
    59 migraciones, última `20260610233000`. **La migración no está aplicada.** El reporte del
    ejecutor es exacto.
  - `d7fb9b0` toca **solo** `LEDGER.md` (+31). `git diff d9eebb0 d7fb9b0` sobre los dos
    ficheros del scope → **vacío**. Árbol de trabajo limpio.
- **CAMBIO DE PROCESO — la comprobación previa es mía, no de un ejecutor.** Dos rondas
  completas (P1 r3 y P1b r1) han muerto ejecutando una consulta de solo lectura para descubrir
  que un pegado no había ocurrido. Yo puedo correr esa consulta en dos segundos y sin gastar
  una sesión. **A partir de ahora no despacho P1b hasta haber confirmado yo mismo que el
  remoto lee `1/1`.** El STEP 0 del prompt se queda, pero degradado a comprobación
  anti-manipulación: si sale `0/0` es que algo cambió entre el despacho y la ejecución.
- **HIGIENE DE PROMPT, a partir de dos avisos del ejecutor que tenía razón en los dos.** Se
  crea `prompts/P1b-r1.md`, copia corregida de `P1-r3.md`: (1) la ruta de pre-flight decía
  `casa-web`, que es el checkout de **otro** workstream —ahora dice
  `/Users/brentcurtis/dev/casa-upgrade`, el worktree propio de UPGRADE, con la razón escrita
  al lado—; (2) las cabeceras decían `P1 · r3` y la fase se despacha como `P1b · r1` tras la
  partición. Ninguna de las dos era un defecto de fondo, pero las dos obligaron al ejecutor a
  razonar sobre qué prompt le tocaba, y eso es trabajo que el prompt debería haberle ahorrado.
  `P1-r3.md` se conserva como registro histórico de la ronda que sí se despachó con ese nombre.
- FINDINGS RAISED: **BLOCKING: ninguno. SHOULD-FIX: ninguno. NIT: ninguno.**
- DECISIONS: ninguna nueva del plan. Una de proceso, del PM: la comprobación de precondición
  la hace el PM antes de despachar.
- BACKLOG: sin cambios.
- OPEN AFTER THIS ROUND: **PR3 y nada más.** Cuando Brent aplique las dos sentencias, yo
  confirmo `1/1` y despacho `/exec UPGRADE P1b r1` con `prompts/P1b-r1.md`. Mientras tanto
  **P2, P3a y P3b están libres y no tocan la base de datos** — si UPGRADE tiene que avanzar
  hoy, es por ahí. P1a espera revisión de Codex; ninguna fase cierra sin ese PASS.

### 2026-08-08 — PR3 RESUELTA — Brent + PM (Fable)
- SESSION: UPGRADE · P1b · PM
- ACTION: **Brent aplicó la migración desde el editor SQL** de `mulsqxfhxxdsadxsljss`
  ("Success. No rows returned"). **PR3 queda resuelta.** Verificado por el PM antes de
  despachar nada, según la regla de proceso adoptada en la ronda anterior.
- LO QUE CONFIRMÉ YO MISMO, en una consulta de solo lectura:
  - `column_exists = 1` · `function_exists = 1` — los dos objetos existen.
  - `participant_rows = 31` — sin cambios; el `DEFAULT TRUE` cubrió las filas existentes sin
    backfill, como preveía D2.
  - `schema_migrations`: **59 → 60**, con `20260806000000` presente. La fila que decidí añadir
    se escribió; el registro de migraciones refleja la realidad.
  - **`20260612000000` y `20260612000001` siguen SIN aplicar.** Es la comprobación que más me
    importaba: la aplicación fue quirúrgica y no arrastró nada. Es exactamente el daño que D9
    evita al prohibir `supabase db push`, y ahora está medido, no argumentado.
- **NO ejecuté A3–A8.** Son el entregable del ejecutor de P1b; ejecutarlos yo y luego darlos
  por buenos sería calificar mi propio trabajo (SOP §1.1). Confirmar la precondición sí es mío;
  demostrar los criterios no.
- FINDINGS RAISED: ninguno.
- DECISIONS: ninguna.
- OPEN AFTER THIS ROUND: `/exec UPGRADE P1b r1` con `prompts/P1b-r1.md` — precondición
  confirmada `1/1`. Después, verificación independiente del PM y revisión de Codex sobre P1a +
  P1b juntas. P2, P3a y P3b siguen libres en paralelo.

### 2026-08-08 — P1b r1 (redespacho) — Claude Opus 5 (EXEC)
- SESSION: UPGRADE · P1b · r1 · EXEC
- CONTEXT PRESSURE: comfortable — la ronda cabe holgadamente; nada se cortó.
- ACTION: Ronda despachada como `/exec UPGRADE P1b r1` con `prompts/P1b-r1.md`, tras confirmar
  el PM la precondición. Pre-flight en el worktree propio `/Users/brentcurtis/dev/casa-upgrade`:
  rama `feat/mesa-md-schema`, árbol limpio, `git diff d9eebb0` sobre los dos ficheros de
  alcance **vacío**. **STEP 0 = `1/1`** — la migración está aplicada; el tamper check pasa.
  **A3, A4 y A5 quedan demostrados contra producción. A6, A7 y A8 NO son ejecutables por este
  canal** — ver el hallazgo. No se tocó ningún fichero de producción. No se invocó
  `apply_migration` ni ninguna vía de escritura.
- **HALLAZGO BLOQUEANTE (método, no plan): el usuario del MCP no puede EJECUTAR la función.**
  `select … from public.get_my_dinner_summary(…)` responde
  `ERROR: 42501: permission denied for function get_my_dinner_summary`. Medido, no deducido:
  - `current_user = session_user = supabase_read_only_user`;
    `pg_has_role(current_user,'authenticated','MEMBER') = false`;
    `pg_has_role(current_user,'anon','MEMBER') = false`;
    `has_function_privilege(current_user, …, 'EXECUTE') = false`.
  - `proacl = {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`.
  El truco de `set_config('request.jwt.claims', …)` es irrelevante aquí: falla el permiso de
  EJECUCIÓN sobre la función, no la resolución de `auth.uid()`. **Esto es exactamente lo que
  A5 exige** (`anon_can=false`, `authed_can=true`); la migración no tiene defecto. Lo que falla
  es la suposición del prompt de que A6–A8 se pueden demostrar desde un canal de solo lectura.
  El ensayo del PM corrió en un Postgres desechable como superusuario, donde el ACL no muerde.
  **No se intentó `SET LOCAL ROLE authenticated`** — el prompt lo prohíbe expresamente.
  La precondición `1/1` del PM comprueba que los objetos **existen**, no que sean **invocables**
  por el usuario que los va a invocar; el hueco está ahí.
- LO QUE SÍ QUEDA DEMOSTRADO (salida cruda en el reporte del ejecutor):
  - **A3** `can_bring_main_dish / boolean / NO / true`; `rows_not_true = 0` sobre 31 filas.
  - **A4** `prosecdef = true`; `proconfig = {"search_path=\"\""}` — `search_path` **vacío**.
  - **A5** `anon_can = false`, `authed_can = true`.
  - **Aritmética D1 del fixture `3d4d6709…`**: `guests=4`, `host_plus_ones=0`,
    `guest_plus_ones=1` ⇒ `1 + 0 + 4 + 1 = 6`, que **coincide** con el `total_people = 6` que la
    tabla del prompt espera. Es la mitad manual de A7; la mitad que falta es la respuesta del
    RPC, que no se puede pedir.
  - **V1** `pg_get_functiondef` idéntico al fichero del repo en cláusula WHERE y aritmética;
    solo difiere en normalización de Postgres (`SET search_path TO ''`, `$function$`,
    reflujo de `STABLE SECURITY DEFINER`). Sin deriva.
  - **V2** `schema_migrations` **60**, `max_version = 20260806000000` presente (la fila que el PM
    decidió escribir está); `20260612000000` y `20260612000001` **siguen ausentes**;
    `mesa_abierta_participants` **31** filas. Nada más se movió.
  - **STEP 4** gate `EXIT=0`, stderr `tsc=1039 eslint=160 deno-lint=94 deno-check=46`.
    `MesaAbiertaAdmin.tsx` en `tsc (10)`, como fijó el PM.
- **NOTA DE ENTORNO (no es un hallazgo del plan).** El worktree `casa-upgrade` no tenía
  `node_modules`; la primera ejecución del gate salió `EXIT=1` porque `tsc` y `eslint` **no
  llegaron a correr** (`npx` intentó descargarlos). El gate lo detectó y falló ruidosamente —
  es justo la protección que P0 r4 instaló, funcionando. Resuelto con `npm ci` en el worktree;
  `node_modules` está en `.gitignore`, así que no cambia ningún fichero versionado. Conviene que
  el prompt de futuras fases lo diga, porque cada worktree nuevo empieza igual de vacío.
- COMMITS: solo esta entrada de ledger, en `feat/mesa-md-schema`. Cero ficheros de producción.
- TESTS: el gate acotado de STEP 4 (arriba). No se reejecutaron build, Vitest ni Deno — sin
  cambios de fichero desde r1, como ordena el prompt.
- FINDINGS RAISED: **uno, bloqueante para A6–A8**, descrito arriba. Propuesta, para que la
  decida el PM y no el ejecutor: que **Brent ejecute los tres bloques de A6/A7/A8 desde el
  editor SQL** —el mismo canal con el que resolvió PR3, y que conecta como `postgres`, que sí
  está en el ACL— y pegue la salida cruda. Es una lectura, no una escritura. Las alternativas
  se descartan solas: conceder EXECUTE a `supabase_read_only_user` es un cambio de ACL en
  producción que además debilita justo lo que A5 protege, y un Postgres desechable no es el
  estado de producción que A6–A8 exigen por definición.
- DECISIONS: ninguna. El plan **no** está mal: ni el contrato SQL de D14, ni A6–A8 como
  criterios. Lo que no funciona es la vía de ejecución que el prompt eligió para demostrarlos.
- BACKLOG ADDED: ninguno.
- OPEN AFTER THIS ROUND: (1) A6, A7 y A8 siguen **sin demostrar**; P1b no cierra. (2) El PM
  decide el canal de lectura autenticada y redespacha o recoge la evidencia. (3) P1a espera
  PASS de Codex. (4) P2, P3a y P3b siguen libres en paralelo.

### 2026-08-08 — P1b round 1 — PM (Fable) — VERIFICACIÓN + ERROR PROPIO
- SESSION: UPGRADE · P1b · PM
- ACTION: Verificación de P1b r1 (`9814277`). **A3, A4 y A5 quedan demostrados y los verifiqué
  yo mismo. A6–A8 no son ejecutables por el canal del agente, y la culpa de que lo
  descubriéramos aquí y no antes es mía.** El ejecutor tiene razón en todo.
- **MI ERROR, con precisión.** En el prompt de P1 r1 escribí que el riesgo de A6–A8 estaba
  «cerrado». Lo que probé en realidad fue (a) que `set_config('request.jwt.claims', …, true)`
  persiste en una llamada multi-sentencia, y (b) que el **cuerpo** del contrato D14, pegado
  como un `SELECT` corriente, devuelve `(3d4d6709…, 6, 1)`. Ninguna de las dos cosas es
  `EXECUTE` sobre la función: el cuerpo inline son lecturas de tablas base, que el usuario de
  solo lectura sí puede hacer. Y el ensayo en Docker corrió como **superusuario**, donde el
  ACL no muerde. **Mis dos comprobaciones rodearon justo la barrera que ahora bloquea.**
  Añado que la precondición `1/1` que impuse prueba que los objetos existen, **no** que el
  canal pueda invocarlos. Era la pregunta que había que hacerse y no la hice.
- LO QUE VERIFIQUÉ YO MISMO AHORA:
  - **A3 MET** — `can_bring_main_dish | boolean | NO | true`, y `rows_not_true = 0` sobre las
    31 filas.
  - **A4 MET** — `prosecdef = true`, `proconfig = {"search_path=\"\""}`, vacío.
  - **A5 MET** — `anon` → `false`, `authenticated` → `true`.
  - **A6–A8 NO EJECUTABLES, reproducido por mí**: la llamada devuelve
    `ERROR: 42501: permission denied for function get_my_dinner_summary`. El ACL real es
    `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` y
    `pg_has_role(current_user,'authenticated','MEMBER') = false`. `supabase_read_only_user` no
    está y no debe estar: **es exactamente lo que A5 exige**. El canal está correctamente
    excluido por el mismo ACL que la fase acaba de demostrar correcto.
  - **Gate reejecutado por mí en el worktree de UPGRADE**: `EXIT=0`, totales
    `tsc=1039 eslint=160 deno-lint=94 deno-check=46`, salida **byte a byte idéntica** a mi
    medición de r1. `9814277` toca solo `LEDGER.md` (+65); los dos ficheros del scope siguen
    idénticos a `d9eebb0`.
  - `npm ci` en el worktree: `node_modules` está en `.gitignore` y `git status` sale limpio.
    **No es una desviación**, y además el gate hizo su trabajo: sin `node_modules`, `tsc` y
    ESLint no corrían y el gate **salió con EXIT=1 en vez de aprobar en silencio**. Es
    literalmente el modo de fallo que P0 gastó cinco rondas en cerrar, funcionando en
    producción.
- FINDINGS:
  - **BLOCKING: ninguno contra el código.** El esquema es correcto por los tres criterios que
    sí se pudieron ejercitar, y el ACL que impide A6–A8 es el ACL que el plan pedía.
  - **[S3] SHOULD-FIX / estructural** — ningún agente de este montaje puede demostrar la
    conducta de una función `SECURITY DEFINER` en producción: el MCP entra como
    `supabase_read_only_user`, que está fuera del ACL por diseño, y no hay clave de
    `service_role` ni de cliente autenticado en el repo. Conceder `EXECUTE` a ese usuario
    **debilitaría justo lo que A5 protege** y queda descartado. Afecta a P1b hoy y a cualquier
    fase futura que afirme conducta de RPC. Ver B-06.
- **RUTA ACORDADA PARA A6–A8** (propuesta del ejecutor, mejorada por el PM): las corre Brent
  desde el editor SQL, que conecta como `postgres` —sí está en el ACL—. **Mejora sobre lo que
  el ejecutor propuso**: cada bloque hace `set_config` de la claim **antes** de cambiar de rol
  (para que la búsqueda del `user_id` no la limite RLS) y luego `set local role authenticated`
  antes de llamar a la función. Así se ejercita el ACL real *y* el filtro por `auth.uid()`, que
  es más fiel que llamarla como `postgres`. Todo dentro de `begin … rollback`: son lecturas.
- **CADENA DE EVIDENCIA, declarada para Codex.** La salida de A6–A8 la produce **Brent**, no un
  ejecutor ni el PM. Es la única vía que existe. Lo dejo escrito aquí en vez de disimularlo:
  Codex debe saber exactamente por qué canal vino cada dato y puede pedir que se repita.
- **NO despacho una r2.** Un ejecutor no puede correr A6–A8 —es el ACL, no el prompt— así que
  su único aporte sería transcribir el pegado de Brent. Ya van tres sesiones gastadas en cosas
  que una consulta resuelve; ésta no va a ser la cuarta.
- BACKLOG ADDED: **B-06** — no hay canal de verificación de RPC para agentes. Opciones cuando
  toque (P8 consume `get_my_dinner_summary` a través de `dinnerSummary.ts`): una clave de
  `service_role` en un `.env` local no versionado, o pgTAP contra un Supabase local. **Decidir
  antes de P8**, no durante.
- OPEN AFTER THIS ROUND: (1) Brent corre los cuatro bloques y pega la salida cruda. (2) El PM
  la registra verbatim y dictamina A6–A8. (3) Revisión de Codex sobre P1a + P1b juntas, con la
  cadena de evidencia declarada. P2, P3a y P3b siguen libres.

### 2026-08-08 — P1b — A6–A8 DEMOSTRADOS · FASE LIMPIA — PM (Fable)
- SESSION: UPGRADE · P1b · PM
- ACTION: **A6, A7 y A8 quedan cumplidos.** Con ellos, los **once** criterios del P1 original
  están satisfechos. P1a y P1b pasan a IN REVIEW en el índice de fases. **La fase está limpia
  y lista para la revisión final de Codex**; el prompt queda en
  `prompts/P1-codex-review.md`. **Ninguna de las dos se marca DONE: eso solo lo hace un PASS
  de Codex.**
- **CÓMO SE OBTUVO LA EVIDENCIA, dicho antes de que nadie tenga que preguntarlo.** Brent
  ejecutó el bloque en el editor SQL de `mulsqxfhxxdsadxsljss`, que conecta como `postgres`
  —sí está en el ACL—. **No lo produjo ni un ejecutor ni el PM**, porque no existe otro canal:
  `supabase_read_only_user` está fuera del ACL por diseño, que es justo lo que A5 exige. El
  bloque son cuatro lecturas etiquetadas dentro de `begin … rollback`.
- SALIDA CRUDA, verbatim:
  ```
  | case_name    | claim_set | match_id                             | total_people | main_dish_count |
  | A6a stranger | true      | null                                 | null         | null            |
  | A6b nobody   | true      | null                                 | null         | null            |
  | A7 host      | true      | 3d4d6709-e86e-4190-a491-9c74e14b00bf | 6            | 1               |
  | A8 guest     | true      | 3d4d6709-e86e-4190-a491-9c74e14b00bf | 6            | 1               |
  ```
- DICTAMEN, criterio a criterio:
  - **A6 MET.** Dos llamantes autenticados ajenos a toda cena del mes → **cero filas**. El
    `claim_set = true` de las dos filas es lo que hace que el cero signifique algo: la claim se
    fijó de verdad, así que es una ausencia medida y no una consulta que nunca llegó a filtrar.
    Por eso pedí dos variantes y no una.
  - **A7 MET.** Una fila, `(3d4d6709…, 6, 1)`.
  - **A8 MET.** Un invitado de ese mismo match recibe **exactamente la misma fila**.
- **LO QUE VERIFIQUÉ YO MISMO, y por qué importa que fuera por otro canal.** Recalculé la
  aritmética D1 desde las tablas base con mi consulta de solo lectura: `host=1`,
  `host_plus_one=0`, `guests=4`, `guest_plus_ones=1` ⇒ **6**; y `host_main=1`, `guest_mains=0`
  ⇒ **1**. Las dos mitades que A7 exige que coincidan vienen de **canales distintos**: la
  regla, de mi consulta sobre tablas base; la respuesta de la RPC, del editor de Brent. Es una
  demostración más fuerte que si una sola sesión hubiera producido las dos.
- **COBERTURA QUE NO BUSQUÉ Y SALIÓ GRATIS**: en producción el plato principal lo lleva el
  **anfitrión** (`host_main=1`, `guest_mains=0`); en mi ensayo en Docker lo llevaba un
  **invitado**. Entre las dos ejecuciones quedan ejercitadas **las dos ramas** de la suma de
  `main_dish_count` —la del `CASE` sobre `host_food_assignment` y la del `COUNT` sobre
  assignments—, que es más de lo que A7 sola habría dado.
- ESTADO DE LA BASE tras el bloque: 31 participantes, 6 matches, 60 migraciones,
  `20260612000000/1` **siguen sin aplicar**, y **`_p1b` no existe en `public`** — el `rollback`
  hizo su trabajo y la tabla temporal no dejó rastro. El aviso de RLS del editor sobre `_p1b`
  era un heurístico genérico que no distingue tablas temporales; se corrió sin RLS a
  propósito y con criterio, no por descuido.
- FINDINGS RAISED: **BLOCKING: ninguno. SHOULD-FIX: ninguno nuevo** (S3/B-06 sigue abierto y no
  bloquea esta fase). **NIT: ninguno.**
- **LO QUE LE PIDO A CODEX QUE ATAQUE**, escrito en el prompt para que no tenga que
  descubrirlo: (1) la cadena de evidencia de A6–A8, más débil que la del resto; (2) **mi propio
  error** al dar por «cerrado» ese riesgo probando el cuerpo inline y un ensayo como
  superusuario —dos comprobaciones que rodearon la barrera—, con el encargo explícito de
  buscar la misma clase de fallo en mis otras verificaciones; (3) mi ruling sobre A10 y la
  enmienda de D8.2, por si fue interesada; (4) si partir P1 fue diagnóstico o racionalización;
  (5) si el fondo de D9 sobrevive a la aplicación manual; (6) la fila de `schema_migrations`
  escrita a mano; (7) la ambigüedad de `match_id`.
- DECISIONS: ninguna nueva.
- BACKLOG: B-05 y B-06 abiertos; ninguno bloquea.
- OPEN AFTER THIS ROUND: revisión final de Codex sobre P1a + P1b con
  `prompts/P1-codex-review.md`. En paralelo, **P2 puede arrancar ya** (`feat/mesa-md-alloc`,
  módulo puro, sin base de datos), y con ella P3a y P3b.

### 2026-08-08 — P1 CIERRE — Codex PASS + PM
- SESSION: UPGRADE · P1b · PM
- ACTION: **`CODEX REVIEW — UPGRADE P1 FINAL` = PASS**, cero BLOCKING. **P1a y P1b marcadas
  DONE** con fecha 2026-08-08 y SHA `9cc637b`. Revisión en `reviews/REVIEW-P1.md`.
- **QUÉ VERIFICÓ CODEX POR SU CUENTA**, y una cosa que hizo mejor que yo: A1–A11 contra el
  esquema vivo, **incluidas llamadas RPC autenticadas en producción** — que reprodujo por una
  vía que **yo había declarado inexistente** (ver S1). Gates padre/punta a exit 0 con
  `tsc 1041 → 1039`, dos eliminados y cero añadidos; `npm ci` en ambos worktrees; **descartó
  una primera pasada de Vitest bajo Node v26 y la repitió bajo el v22.22.0 congelado del
  plan** — precisión que yo no había pensado en exigir. Resultado: **1036/6, exactamente la
  base**, así que esta ronda cumple incluso la redacción **original** de D8.2 y la enmienda no
  está sirviendo para tapar un rojo de más. Deno 409/0. El bloque `CREATE FUNCTION … GRANT` de
  `PLAN.md` y el de la migración: **1.449 bytes cada uno, byte a byte iguales**.
- **HALLAZGOS DE CODEX, los dos corregidos ya en `PLAN.md`:**
  - **[S1] SHOULD-FIX — mi relato del canal de verificación era demasiado amplio, y lo era en
    la dirección cómoda.** Lo cierto es lo del MCP: `supabase_read_only_user` está fuera del
    ACL y no es miembro de `authenticated`. Lo que yo generalicé —«ningún agente puede
    verificar conducta de RPC»— es **falso**: Codex demostró que un login de revisión de la
    CLI enlazada asume `postgres` para resolver el `user_id`, fija la claim y asume
    `authenticated` para invocar dentro de `BEGIN … ROLLBACK`, y **reprodujo A6–A8 así**. No es
    un canal de escritura aceptable —los prompts hicieron bien en prohibir los rodeos— pero
    como vía de lectura es reproducible. Corregido: el párrafo de *Risks* de P1 lleva ahora una
    nota explícita, y **B-06 pasa al backlog de `PLAN.md` reescrito**, porque su redacción
    anterior habría hecho que P8 diera por imposible algo que sí se puede.
    Codex anota además que el ledger describe el bloque SQL de cuatro casos pero solo commiteó
    su tabla de resultados. Es exacto: el bloque está en el prompt del chat, no en el repo.
  - **[N1] NIT — eran cuatro filas de Decision Log, no cinco.** PR3 va combinada con la de la
    partición. Ninguna decisión falta; el recuento estaba mal. Corregido en los dos sitios de
    `PLAN.md`.
- **QUÉ SE CONSTRUYÓ**: `20260806000000_mesa_main_dish_optout.sql` (columna
  `can_bring_main_dish BOOLEAN NOT NULL DEFAULT TRUE` + `get_my_dinner_summary` con su `REVOKE`
  y `GRANT`, contrato D14 literal) y seis declaraciones en `types.ts`. **+43 líneas, cero
  borrados, dos ficheros de producción.** Aplicado a `mulsqxfhxxdsadxsljss` el 2026-08-08.
- **QUÉ CAMBIÓ FRENTE AL PLAN ORIGINAL, y por qué:**
  1. **P1 se partió en P1a y P1b, con PR3 como tercera puerta humana.** El plan modeló PR1 y
     PR2 como puertas de Brent pero trató la aplicación misma como trabajo de agente. Tres
     rondas se gastaron descubriendo que no lo es. Codex ratifica el diagnóstico.
  2. **D9 se cumplió por aplicación manual**, no por `apply_migration`. Autorizado y registrado
     **antes** de aplicar. Codex: RATIFICADO — las cinco protecciones de fondo sobrevivieron.
  3. **D8 punto 2 se enmendó.** Codex lo declara legítimo y observa que esta ronda cumple
     incluso la redacción vieja.
  4. **Fila de `schema_migrations` escrita a mano.** Codex la valida y añade un dato que yo no
     tenía: otras tres filas reparadas del proyecto también tienen array de sentencias nulo.
- **LECCIÓN, y es sobre mí.** Los cuatro FAIL de Codex en P0 encontraron defectos reales; aquí
  su PASS trajo igualmente la corrección más útil de la fase. Mi error de raíz fue de método,
  no de cálculo: **probé lo que era fácil de probar y lo tomé por lo que había que probar**
  —el cuerpo inline en vez de `EXECUTE`, un ensayo como superusuario en vez del ACL real— y
  después generalicé el resultado más allá de lo medido. La regla que me llevo: **cuando
  declare un riesgo cerrado, decir explícitamente qué canal y qué privilegio se ejercitaron**,
  porque «funciona» sin esa frase es justo donde se esconde el error.
- **P2 RELEÍDA A LA LUZ DE LO CONSTRUIDO (SOP §3.8.5): no necesita enmienda.** Alcance,
  criterios y tamaño siguen bien; no toca base de datos, así que nada de lo aprendido en P1 la
  toca. Dos notas de uso para su prompt, que no son cambios al plan: (a) su padre pasa a ser
  `main` con P1 dentro, así que la línea base es **`tsc = 1039`** y, como sus tres ficheros son
  nuevos, el gate se reduce a «los tres no introducen ni un diagnóstico»; (b) su criterio B7
  («rojos sin cambios») se lee bajo el **D8.2 enmendado** — que es precisamente lo que impide
  que el flake de B-05 lo vuelva incumplible, como habría pasado con la redacción vieja.
- **MERGE — no es fast-forward, y no por culpa de esta rama.** `main` se ha movido a `165e5f2`
  mientras trabajábamos: otro workstream (AUDIO / `phase/E2-caratula`) integró y publicó. La
  rama de P1 sale de `05dc4ca`. **El PM no mergea**; entrego el análisis y el comando a Brent
  tras comprobar el solape real.
- COSTE REAL DE LA FASE: 4 rondas de ejecutor (r1, r2, r3 de P1 + r1 de P1b), **cero hallazgos
  contra el código en las cuatro**, y una revisión de Codex con PASS a la primera. Lo que costó
  no fue la corrección del trabajo sino el canal de escritura, y el plan no lo había modelado.
- CONTEXT PRESSURE (§1.3): las cuatro rondas reportaron "comfortable". Ninguna se acercó al
  límite; la fase era pequeña y el cuello de botella fue externo.
- BACKLOG: **B-05** abierto (flake de los tres `CuentacuentoEditor.ph.*`). **B-06 reescrito**
  tras S1 — hay vía de verificación de RPC; **decidir antes de P8**. Ninguno bloquea.
- OPEN AFTER THIS ROUND: (1) merge de `feat/mesa-md-schema` — decisión y ejecución de Brent.
  (2) Bootstrap de PM para **P2**.

### 2026-08-08 — P2 round 1 — PM (Fable) — BOOTSTRAP Y PROMPT
- SESSION: UPGRADE · P2 · PM
- ACTION: Bootstrap de PM para **P2 — Módulo puro de asignación**. Prompt escrito y commiteado
  en `prompts/P2-r1.md`. **No despacho todavía**: P2 debe salir de un `main` con P1 dentro, y
  P1 aún no está mergeada — la razón está abajo y no es cosmética.
- **POR QUÉ P2 ESPERA AL MERGE DE P1, aunque técnicamente no dependa de ella.** P2 no toca base
  de datos, ni `types.ts`, ni componentes: depende solo de P0. Pero `feat/mesa-md-schema`
  lleva **diez entradas de este ledger** sin mergear. Si P2 sale de un `main` sin ellas y luego
  añade la suya, las dos ramas **bifurcan `LEDGER.md`** y el merge conflicta. Es exactamente el
  accidente de **B-02**, que ya costó siete entradas perdidas. El prompt convierte esto en una
  **precondición dura**: un `grep` sobre `PLAN.md` que debe encontrar P1a marcada DONE, y si no,
  el ejecutor para en seco y reporta `BLOCKED` antes de tocar nada.
- LO QUE MEDÍ ANTES DE ESCRIBIR EL PROMPT, para que el ejecutor no lo descubra a su costa:
  - **Los totales globales en `main`@`165e5f2` siguen en `1041/160/94/46`.** El merge del
    workstream AUDIO (`useQuickPublish`, `liturgyCover`, `config.toml`) **no añadió ni un
    diagnóstico**. Es la clase de sorpresa que D8 punto 5 existe para detectar, y no la hubo.
    Con P1 dentro serán **1039**; el prompt usa ese número como segunda comprobación de que el
    ejecutor está sobre el padre correcto.
  - Los tres ficheros de P2 dan `(0)(0)(0)(0)` en el padre — son nuevos. **Así que para P2 el
    gate se reduce a algo inusualmente limpio: sus tres ficheros no deben introducir ni un solo
    diagnóstico.** Cualquier recuento distinto de cero en la punta es nuevo por construcción.
  - **`src/lib/mesa-abierta/` no existe**; P2 la crea. Está dicho en el prompt.
  - **El import entre runtimes de la prueba 20 resuelve** — lo verifiqué en vez de dejar que lo
    descubriera: `tsconfig.app.json` trae `allowImportingTsExtensions: true` y
    `moduleResolution: "bundler"`, así que el especificador con `.ts` tipa; y `mainDish.ts` es
    una hoja sin imports, así que Vite no tiene nada específico de Deno con lo que atragantarse.
    Era el candidato número uno a quemar una ronda. El prompt añade: si hiciera falta un alias,
    una entrada de tsconfig o un paso de build, eso es `FINDINGS`, no un apaño.
  - **Estilo de la casa**: `supabase/functions/_shared/availableMaterials_test.ts` es el
    análogo más cercano —suite de conformidad sobre un módulo puro de `_shared`— y el prompt lo
    señala como el listón, incluida su cabecera que declara **qué prueba la suite y qué no**.
  - **Node v22.22.0 para Vitest**, explícito. Codex descartó una pasada bajo v26 en la revisión
    de P1; esa lección entra ahora en los prompts en vez de quedarse en una revisión.
- **P2 RELEÍDA (SOP §3.8.5): sin enmienda.** Alcance, criterios y tamaño siguen bien. Su
  criterio B7 («rojos sin cambios») se lee bajo el **D8.2 enmendado**, que es justo lo que
  impide que el flake de B-05 lo vuelva incumplible; el prompt lo explica para que nadie
  persiga un fantasma.
- **LO QUE LE PIDO AL EJECUTOR MÁS ALLÁ DE LOS CRITERIOS**, porque son las dos cosas que no se
  pueden comprobar con un test: (1) el **argumento de revisión de código de la garantía D5.6**
  —citar la condición de aceptación del intercambio y mostrar que exige decrecimiento
  estricto—, que ningún conjunto finito de ejemplos establece; (2) **sus decisiones de
  recorrido y por qué**, incluido si alguna hace inalcanzable un déficit resoluble. La garantía
  10 existe para que un déficit honesto sea una respuesta correcta; ocultarlo es la única forma
  de fallarla.
- FINDINGS RAISED: ninguno.
- DECISIONS: ninguna. El plan no cambia.
- OPEN AFTER THIS ROUND: (1) **Merge de P1** — decisión de Brent; el PM no mergea. (2) Después,
  `/exec UPGRADE P2 r1`. (3) Backlog B-05 y B-06 abiertos; B-06 hay que decidirlo antes de P8.

### 2026-08-08 — P2 round 1 — PM (Opus 5) — DESBLOQUEO Y DESPACHO
- SESSION: UPGRADE · P2 · PM
- ACTION: La única cosa que retenía a P2 —el merge de P1— **ya está hecha**. Verifico la
  precondición y despacho `r1` con el prompt tal cual está commiteado. **No reescribo el
  prompt**: sigue siendo correcto palabra por palabra, y su condición de parada ahora se
  cumple en vez de dispararse.
- LO QUE VERIFIQUÉ YO MISMO, no lo que dice un reporte:
  - `main` está en `24300d8`, con `feat/mesa-md-schema` dentro (`14af32f` trae las 908 líneas
    de ledger, `PLAN.md`, la migración y `types.ts`; `24300d8` es un merge vacío posterior,
    sin diff — ruido, no problema).
  - `grep -c 'P1a | Esquema: ficheros.*DONE' docs/plan/upgrade/PLAN.md` → **1**. Es
    exactamente la precondición dura del prompt, y pasa.
  - `npx tsc -p tsconfig.app.json --noEmit | grep -c "error TS"` → **1039**, bajo
    **Node v22.22.0**. Es el número que el prompt usa como segunda comprobación de padre
    correcto, y la predicción del bootstrap anterior (1041 − 2 de P1) se confirma medida, no
    supuesta.
  - `prompts/P2-r1.md` está **en `main`** (`git cat-file -e main:…` → ok). Un ejecutor en otro
    worktree lo encontrará; ése era el riesgo real de un prompt sin commitear.
- **RIESGO ABIERTO QUE NO ES MÍO DE RESOLVER: `main` local va 18 commits por delante de
  `origin/main`.** El merge de P1 **no está publicado**. Un ejecutor que trabaje en un worktree
  de este mismo checkout parte de `main` local y está bien; uno que clone de nuevo caería en un
  `main` sin P1 y su precondición dispararía `BLOCKED` — que es el comportamiento correcto del
  prompt, pero cuesta una ronda. `git push origin main` es decisión y ejecución de Brent; el PM
  no empuja a `main`.
- FINDINGS RAISED: ninguno.
- DECISIONS: ninguna. El plan no cambia; P2 sigue releída sin enmienda (§3.8.5, entrada
  anterior).
- OPEN AFTER THIS ROUND: (1) **`/exec UPGRADE P2 r1`** — despachado. (2) Publicar `main`
  (Brent). (3) Backlog B-05 y B-06 abiertos; B-06 hay que decidirlo antes de P8.

### 2026-08-08 — P2 r1 — Claude Opus 5 (EXEC)
- SESSION: UPGRADE · P2 · r1 · EXEC
- CONTEXT PRESSURE: comfortable — el fichero de tests fue lo más pesado y entró de una sola
  pasada; nunca hubo que recortar cobertura por espacio.
- ACTION: Tres ficheros nuevos, nada más tocado.
  - `supabase/functions/_shared/mainDish.ts` — módulo hoja, cero imports, sin generador de
    aleatoriedad propio. Exporta `Carrier`, `TableInput`, `SIDE_FOODS`, `requiredMainDishes`,
    `tablePeopleCount`, `balanceMainDishCarriers`, `allocateTableFood`, `allocateAll` (más los
    tipos de resultado `SwapMove`, `BalanceResult`, `TableAllocation`, `AllocationResult`,
    `TableShortfall`, `Food`, `SideFood`, `Pick`).
  - `supabase/functions/_shared/mainDish_test.ts` — 19 tests Deno sobre una tabla de 11
    fixtures de frontera, todos invocando el verificador de invariantes.
  - `src/lib/mesa-abierta/__tests__/mainDishImport.test.ts` — test 20 (Vitest), import por
    ruta relativa. **No hizo falta alias, entrada de tsconfig ni paso de build**: el import
    entre runtimes resuelve tal como el PM había verificado.
- **DECISIONES DE RECORRIDO** (lo que D5 dejaba abierto y P2 fija):
  - `SIDE_FOODS = ["salad", "drinks", "dessert"]` — el enum de la base sin `main_course`.
  - Mesas deficitarias en orden de entrada; mesas contraparte en orden de entrada; subconjuntos
    de invitados primero los de tamaño 1 en orden ascendente, luego los pares en orden
    lexicográfico. Gana el **primer** candidato aceptable y se reexplora desde arriba, porque
    los déficits han cambiado.
  - Al aplicar un intercambio, los invitados que se quedan conservan su orden relativo y los
    que llegan se añaden al final.
  - `pick` se consume por mesa en este orden y solo en este: cero o más extracciones del grupo
    de invitados dispuestos, y después **exactamente una** para el desplazamiento de la
    rotación de acompañamientos. Las mesas se recorren en el orden de entrada.
  - **Déficits resolubles que este recorrido no alcanza, dicho explícitamente**: la garantía 5
    («ningún intercambio deja a la donante en déficit») rechaza cualquier intercambio entre dos
    mesas ambas deficitarias, aunque el total bajase. El fixture F4 lo enseña: los intercambios
    T1↔T2 se rechazan uno a uno y el déficit solo se resuelve contra la mesa donante sana T3.
    Es la garantía funcionando, no un fallo, y por eso existe la garantía 10.
- **ARGUMENTO DE REVISIÓN DE CÓDIGO DE LA GARANTÍA D5.6** (ningún test lo establece): la
  condición de aceptación de `findImprovingSwap` termina en
  `const after = before - tableDeficit(receiver) - tableDeficit(donor) + tableDeficit(nextReceiver) + tableDeficit(nextDonor); if (after > before - 1) continue;`
  Solo cambian esas dos mesas, así que `after` **es** el déficit total posterior. La guarda
  descarta todo candidato que no cumpla `after ≤ before − 1`, es decir, exige decrecimiento
  estricto de al menos 1. Como el déficit total es un entero `≥ 0`, a lo sumo se aplican `Δ₀`
  intercambios — y el bucle de `balanceMainDishCarriers` declara ese mismo `Δ₀` como presupuesto.
- TESTS: `deno test --allow-all .` → **428 pass / 0 fail** (409 + 19, exacto). `npm run build`
  → exit 0. `npx vitest run --no-file-parallelism` → **1063 pass / 6 fail**, los 6 rojos son
  los de `MesaAbiertaDashboard.test.tsx` de siempre; ningún `CuentacuentoEditor.ph.*` flakeó.
  Gate D8 sobre los tres ficheros: `(0)(0)(0)(0)` en los cuatro para cada uno, **byte-idéntico
  al padre** (`diff` = 0), exit 0. Totales del proyecto sin mover: `tsc=1039 eslint=160
  deno-lint=94 deno-check=46`.
- **OBSERVACIÓN PARA EL PM — la base de Vitest del plan está desfasada, la de Deno no.** Medí
  el padre yo mismo (misma suite, apartando solo el fichero del test 20): **1062 pass / 6 fail**.
  La punta da 1063 / 6. El delta es exactamente **+1**, que es lo que B7 pide. Pero
  «Aritmética de tests» de `PLAN.md` parte de **1036**, no de 1062: la aritmética de Vitest de
  ahí en adelante (`1036 + 32 = 1068`, `1074` tras P8) está 26 tests por debajo de la realidad.
  La de Deno (409) sí es correcta: 409 + 19 = 428 medido. No cambio el plan; lo señalo.
- FINDINGS RAISED: ninguno. El plan no resultó equivocado en nada de lo que P2 toca: la API
  especificada satisface las once garantías, ninguna necesitó generación aleatoria de casos, y
  el import del test 20 no necesitó configuración.
- DECISIONS: ninguna que cambie el plan. Las de recorrido son las que D5 delega en P2 y quedan
  arriba.
- BACKLOG ADDED: ninguno.
- OPEN AFTER THIS ROUND: (1) Revisión de P2 y merge de `feat/mesa-md-alloc` — decisión de
  Brent. (2) Corregir la base de Vitest de «Aritmética de tests» (1036 → 1062) si el PM lo ve
  bien. (3) Sigue abierto: `main` local por delante de `origin/main` (P1 sin publicar).
  (4) Backlog B-05 y B-06 abiertos; B-06 hay que decidirlo antes de P8.

### 2026-08-08 — P2 round 1 — PM (Opus 5) — VERIFICACIÓN INDEPENDIENTE
- SESSION: UPGRADE · P2 · PM
- ACTION: Verificación del reporte del ejecutor de P2 r1. **No leí el reporte como evidencia**:
  reejecuté los cuatro gates yo mismo, leí los tres ficheros enteros, y comprobé cada criterio
  contra el código. Rama `feat/mesa-md-alloc`@`6af5071`, un solo commit sobre `981c00f`,
  `git diff --name-status main...` = exactamente los 3 ficheros nuevos + `LEDGER.md`.
- **LO QUE MEDÍ YO, con el comando y el resultado:**
  - Gate D8 sobre los tres ficheros → `EXIT=0`, `(0)(0)(0)(0)` en los cuatro linters para cada
    uno. Totales del proyecto `tsc=1039 eslint=160 deno-lint=94 deno-check=46`, idénticos a los
    que medí en `main` antes de despachar.
  - `deno test --allow-all .` desde `supabase/functions/` → **428 passed / 0 failed**. 409 + 19,
    exacto.
  - `npm run build` → exit 0.
  - `npx vitest run --no-file-parallelism` en la punta → **1063 pass / 6 fail**, y **volví a
    medir el padre yo mismo** haciendo checkout de `main` y ejecutando la suite completa →
    **1062 pass / 6 fail**. Delta **+1**, conjunto de rojos idéntico (los 6 de
    `MesaAbiertaDashboard.test.tsx`) en ambos. No hubo flake de `CuentacuentoEditor.ph.*` en
    ninguna de las dos pasadas. El ejecutor midió el padre moviendo el fichero del test 20 a un
    lado; es equivalente, pero el criterio es mío y lo comprobé por el camino largo.
  - B1 `grep -cE "^[[:space:]]*import"` → **0**. B2 `grep -n "Math.random"` → sin salida.
    B3 `grep -rn "mainDish" supabase --include=index.ts` → sin salida; el **único** importador
    en todo el repo es el test 20.
  - B6 no lo di por bueno de palabra: extraje el cuerpo de los 19 `Deno.test` y comprobé cuáles
    invocan `eachFixture`/`verifyInvariants`. **Los dieciséis tests 4–19 lo invocan; los 1–3
    no, y no deben** — son contrato puro y no producen asignación. Leído el verificador entero:
    **reproduce cada movimiento desde la entrada original** y recalcula personas, cuota,
    dispuestos y déficit por su cuenta, en vez de creerse los números que el módulo reporta —
    de hecho compara los del módulo contra los suyos. Es la diferencia entre un verificador y
    un eco, y está del lado correcto.
  - B4: los nombres de los tests mapean uno a uno sobre D5.1–D5.11 (4,5→G1 · 8→G2 · 9→G3 ·
    10→G4 · 11→G5 · 12→G6 · 13→G7 · 14,15→G8 · 16,17→G9 · 18→G10 · 19→G11). Las once cubiertas.
  - Las cinco clases de frontera que D5 exige están en la tabla de 11 fixtures: sin dispuestos
    (F1, F11), todos dispuestos (F2), capacidad al límite (F3, F7), déficit simultáneo (F4),
    `+1` en ambos lados (F5). F6 es el contraejemplo de Codex r2 y F7 su variante bloqueada por
    capacidad — el par que enseña que G3 y G4 son condiciones distintas.
- **EL ARGUMENTO DE LA GARANTÍA 6 SE SOSTIENE, y lo verifiqué contra el código, no contra la
  cita.** `mainDish.ts:265-268`: `after` se calcula restando las dos contribuciones viejas y
  sumando las dos nuevas, lo cual **es** el déficit total posterior y no una estimación, porque
  las demás mesas no se tocan (las dos únicas escrituras del bucle son a `receiverIndex` y
  `donorIndex`). La guarda `if (after > before - 1) continue` acepta solo `after ≤ before − 1`:
  decrecimiento estricto. De ahí G7, y `budget = initialTotalDeficit` lo hace además explícito
  en el bucle en vez de dejarlo como comentario.
- **COMPROBÉ EL FALLO DE ALIAS QUE ESTA CLASE DE CÓDIGO YA TUVO** (el "invitado en dos cenas"
  de `index.ts:305`, motivo de que G9 exista): en `balanceMainDishCarriers`, `receiver` y
  `donor` se capturan **antes** de escribir, y `swappedTable` devuelve objetos nuevos, así que
  el segundo `swappedTable` sigue leyendo la lista original del receptor. No hay aliasing. El
  verificador lo cubre además por reproducción.
- FINDINGS RAISED: **ninguno BLOCKING.**
  - **SHOULD-FIX (contra el PLAN, no contra el código) → backlog B-07.** Los absolutos de
    Vitest de la «Aritmética de tests» están desfasados: 1036 se midió en `1732bee` y el padre
    real da 1062. Los **deltas** (+32) siguen bien y son lo único que D8 exige, así que no
    bloquea nada. Corregido en el PLAN con nota al lado y fila de Decision Log, sin reescribir
    los deltas ni borrar la tabla histórica.
  - **NIT (observación, ninguna acción).** G5 está implementada como «la donante queda con
    déficit 0», que cumple la garantía al pie de la letra y además prohíbe todo intercambio
    entre dos mesas ambas deficitarias, aunque el total bajase. El ejecutor lo declaró él mismo
    y señaló F4 como el caso. Es exactamente lo que D5 permite —ninguna garantía exige
    exhaustividad— y G10 existe para que el déficit restante se reporte. **Lo dejo anotado para
    P4**: si en producción aparece cobertura peor de lo aceptable, aquí está el margen, y sería
    una enmienda del plan, no un parche.
  - **NIT.** `Food` incluye `"none"`, que el módulo nunca emite. Es deliberado y documentado:
    mantiene el test 7 como aserción real en vez de tautología, y el tipo espeja el enum de la
    base. Correcto.
- **LO QUE NO ENCONTRÉ Y BUSQUÉ**: ningún `Math.random`, ningún import, ningún consumidor
  prematuro, ninguna mutación de la entrada (`balanceMainDishCarriers` clona antes de tocar),
  ninguna escritura fuera de los tres ficheros, ningún fixture que haya dejado de ejercitar su
  garantía (los tests 4, 5, 6, 7, 9, 11 y 12 llevan aserciones de no-vacuidad, así que una
  tabla que dejara de cubrir un caso fallaría en vez de pasar en verde).
- DECISIONS: una, la del Decision Log de arriba (B-07). El plan no cambia en nada sustantivo:
  P2 se releyó sin enmienda antes de la ronda y sigue sin necesitarla.
- BACKLOG ADDED: **B-07** — absolutos de Vitest del plan desfasados en 26. B-05 y B-06 siguen
  abiertos; B-06 hay que decidirlo antes de P8.
- CONTEXT PRESSURE: el ejecutor reportó "comfortable" y el resultado lo respalda — 19 tests con
  verificador y 11 fixtures no es una suite recortada por espacio. La fase estaba bien
  dimensionada pese a ser la mayor del plan.
- **P2 ESTÁ LIMPIA. Lista para revisión final de Codex.** No la marco Done: eso lo hace el PASS
  de Codex, no yo.
- OPEN AFTER THIS ROUND: (1) Revisión final de Codex sobre P2. (2) Merge de
  `feat/mesa-md-alloc` — decisión de Brent; el PM no mergea. (3) Publicar `main`, que sigue por
  delante de `origin/main`. (4) Después de P2, **P3a** (`feat/mesa-md-seam`) — la sesión de
  mayor riesgo del plan.

### 2026-08-08 — P2 CIERRE — Codex (REVIEW) + PM (Opus 5)
- SESSION: UPGRADE · P2 · REVIEW
- **VERDICT: PASS.** `feat/mesa-md-alloc`@`6363378`. Cero BLOCKING, cero SHOULD-FIX, dos NIT.
  Review en `reviews/REVIEW-P2.md`, commiteada aquí — Codex la dejó sin stagear en su worktree.
- **P2 queda DONE.** Es la primera fase del plan que pasa a la primera, sin una sola ronda de
  remediación: r1 del ejecutor limpia, verificación del PM sin hallazgos, PASS de Codex.
- LO QUE CODEX VERIFICÓ POR SU CUENTA, en worktree limpio con Node v22.22.0: gate acotado
  exit 0 con `(0)(0)(0)(0)` por fichero · totales `1039/160/94/46` · Deno **428/0** · Vitest
  **1062/6 en el padre y 1063/6 en la punta**, misma identidad de rojos · `npm run build`
  exit 0. Reprodujo las dos medidas de Vitest por checkout completo, igual que yo.
- **Y ADEMÁS HIZO ALGO QUE NADIE LE PIDIÓ Y QUE VALE LA PENA REGISTRAR: 2.000 configuraciones
  adversariales generadas**, todas pasando, sin no-determinismo, sin violación de invariantes,
  sin mutación de la entrada y sin discrepancia de shortfall. El plan había retirado
  explícitamente el property-based testing del alcance de P2 (D5, «Cómo se establecen») porque
  el repo no lo usa; Codex lo aportó **desde fuera del árbol**, como evidencia de revisión y no
  como código commiteado. Es exactamente el reparto correcto: la suite de la fase sigue siendo
  de ejemplos, y la generación aleatoria la puso quien revisa, no quien implementa.
- **LAS TRES COSAS QUE LE SEÑALÉ, RESUELTAS UNA A UNA:**
  1. **Independencia del verificador** (mi punto 2, el que más me preocupaba): la juzga
     **contención suficiente, no confirmación circular**. Comparte solo `requiredMainDishes` y
     `tablePeopleCount`, fijadas antes por los tests 1 y 2; no reutiliza ni la selección, ni el
     intercambio, ni el déficit, ni el shortfall del allocator.
  2. **G5 más estricta que su redacción** (mi punto 4, que yo había clasificado NIT): **me
     corrige a mejor.** Su argumento es que no hay pérdida de cobertura en absoluto: en un
     intercambio de igual número de personas, las cuotas y el total de portadores dispuestos del
     par quedan fijos, así que **mientras ambas mesas sigan bajo cuota su déficit combinado es
     invariante** — un decrecimiento estricto es imposible hasta que una deje de ser
     deficitaria. La guarda que parecía más fuerte es *equivalente* a la condición de progreso
     alcanzable. Mi NIT no era un margen de mejora para P4: no había margen. Lo doy por cerrado.
  3. **La enmienda del plan en mi propia ronda** (mi punto 7): **legítima** bajo la regla de
     control de cambios congelada. Corrige un absoluto obsoleto, conserva el valor histórico y
     la identidad de los seis rojos, y no toca ningún criterio ni ningún resultado de gate.
- NITS (ninguna acción, ninguno bloquea): **N1** — `boundedIndex` normaliza un `pick` inválido
  en vez de fallar rápido; una integración futura podría preferir lanzar para destapar antes su
  propio bug. **N2** — la cabecera del fichero de tests dice «EVERY test below» del verificador
  y los tests 1–3 no lo llaman; es precisión documental, no hueco de cobertura. **Los dos son
  exactamente los que yo había anotado**, lo cual dice algo bueno de la verificación previa y
  nada nuevo del código.
- **UNA IMPRECISIÓN EN LA PROPIA REVIEW, que anoto para quien la lea dentro de seis meses.** Su
  tabla de ACCEPTANCE RULING usa etiquetas `[B1]`–`[B9]` **desplazadas** respecto a las del
  plan: su `[B1]` describe la fórmula de la cuota (que en el plan es el test 1, no B1), su
  `[B8]` describe el gate (que es B9), etc. **No falta ningún juicio** — los nueve criterios
  reales están dictaminados en el cuerpo del documento: el módulo hoja sin imports y la API
  (B1) en «REVIEW TARGET AND SCOPE», la ausencia de `Math.random` (B2) y el determinismo en
  «Determinism and injected selection», los importadores (B3) en el mismo apartado de scope, y
  gate, Deno y Vitest (B7, B9) en «INDEPENDENT RUNS». La correspondencia es una a una si se lee
  el cuerpo en vez de la tabla. Lo registro porque un lector futuro podría creer que «B1» de
  este plan es la fórmula de la cuota, y no lo es. **No cambia el veredicto y no reabre nada**;
  yo mismo verifiqué los nueve criterios contra el código en la ronda anterior.
- COSTE REAL DE LA FASE: **1 ronda de ejecutor, 1 verificación de PM, 1 revisión de Codex.**
  Frente a P0 (5 rondas, 4 FAIL) y P1 (4 rondas, cero hallazgos, bloqueada por un canal humano),
  P2 es la primera que sale por el camino corto — y era la mayor del plan. Lo que la distingue
  no fue suerte: el prompt llevaba medido de antemano el import entre runtimes, la línea base
  del padre y la ausencia de diagnósticos en los tres ficheros nuevos.
- FINDINGS RAISED: ninguno. DECISIONS: ninguna nueva.
- BACKLOG: **B-05**, **B-06** y **B-07** siguen abiertos. **B-06 hay que decidirlo antes de
  P8.** Ninguno bloquea P3a.
- OPEN AFTER THIS ROUND: (1) **Merge de `feat/mesa-md-alloc`** — decisión y ejecución de Brent;
  el PM no mergea. (2) Después, **P3a** (`feat/mesa-md-seam`), la sesión de mayor riesgo del
  plan: conviene arrancarla con contexto fresco. (3) `casa-web` está en `phase/E-infra-impl`
  (workstream AUDIO) con cambios ajenos sin tocar; el trabajo de UPGRADE vive en el worktree
  `casa-p2-review`.

### 2026-08-08 — P3a round 1 — PM (Opus 5) — BOOTSTRAP Y PROMPT
- SESSION: UPGRADE · P3a · PM
- ACTION: Bootstrap de PM para **P3a — Seam: `handler.ts` en `create-mesa-matches`**. Prompt
  escrito y commiteado en `prompts/P3a-r1.md`. **No despacho todavía**: P3a debe salir de un
  `main` con P2 dentro, y P2 sigue sin mergear en `feat/mesa-md-alloc`. Es exactamente la misma
  precondición dura que P2 tuvo respecto a P1, por el mismo motivo, y el prompt la implementa
  igual: un `grep` sobre `PLAN.md` que debe encontrar P2 marcada DONE, y si no, el ejecutor para
  en seco y reporta `BLOCKED` antes de tocar nada. P3a **no depende del código de P2** — depende
  solo de P0; la espera es únicamente para no bifurcar `LEDGER.md` (backlog **B-02**).
- **P3a RELEÍDA (SOP §3.8.5): sin enmienda.** Alcance, criterios C1–C7, plan de test y tamaño
  siguen bien. Lo que sí hago es medir por adelantado todo lo medible, porque el plan llama a
  esta «la sesión de mayor riesgo» y las dos fases que salieron baratas (P2) fueron las que
  llevaban el terreno medido en el prompt.
- LO QUE MEDÍ YO MISMO SOBRE EL PADRE REAL (`feat/mesa-md-alloc`@`d98fa6d`, que es `main` + P2 en
  fast-forward), no lo que dice ningún reporte:
  - **Gate D8 sobre los tres ficheros de `F`**: `handler.ts` `(0)(0)(0)(0)` y `handler_test.ts`
    `(0)(0)(0)(0)` — no existen todavía. **`index.ts` `(0)(0)(4)(6)`: diez diagnósticos
    preexistentes.** Totales `1039/160/94/46`.
  - **Deno: 428 passed / 0 failed.** Así que C6 («+10») significa **438/0** en la punta, no un
    número que el ejecutor tenga que adivinar.
  - **Vitest: 1063 passed / 6 failed**, y los 6 son todos de `MesaAbiertaDashboard.test.tsx` —
    exactamente el conjunto base que declara D8.2. Esta pasada salió limpia del flake de B-05.
  - **`npm run build` exit 0.**
- **EL HALLAZGO QUE DECIDE LA FASE, Y POR QUÉ LO RESUELVO ASÍ.** De los diez diagnósticos de
  `index.ts`, **ocho están pegados a código que P3a mueve**: los 6 de `deno check` (un TS18046
  por `error.message` sobre `unknown` y cinco TS7006 por `any` implícito en `g`, `guest`, `j`) y
  dos `no-unused-vars` (`TARGET_GUEST_SIDE_FOR_DINNER`, `count`). Cuando el bloque se mueve,
  **aterrizan en `handler.ts`, cuya línea base es cero**. Leído al pie de la letra, D8.4 —«cero
  diagnósticos nuevos en `F`», comparado por fichero— convierte eso en ocho BLOCKING y hace que
  P3a suspenda su propio gate haciendo exactamente lo que el plan le manda hacer.
  **Lo clasifico como desplazamiento, no como diagnóstico nuevo**, y esto **no es una enmienda al
  plan**: D8.4 ya le da al revisor la clasificación a mano («desplazamiento de línea —mismo
  mensaje, otra línea— aceptable»), y un movimiento verbatim entre dos ficheros que están **los
  dos dentro de `F`** es la misma especie de cosa que un desplazamiento de línea: mismo mensaje,
  otra ubicación, cero cambio neto en el proyecto. Los totales lo confirman —`deno-check` se
  queda en 46— y `deno-lint` incluso **baja a 92**, porque el `index.ts` nuevo usa el import map
  y pierde los dos `no-import-prefix`.
  Lo que **no** hago es pedirle al ejecutor que los arregle de camino, y la razón no es pereza:
  la regla dura de P3a es *conducta idéntica*, y la única forma práctica de verificarla es
  diffear el bloque movido contra el original y no ver nada. Un ejecutor que además repare ocho
  diagnósticos hace ese diff ilegible y deja la regla dura sin comprobar. Además los cinco TS7006
  no son un arreglo de una línea: nacen de que el cliente de Supabase no está tipado, y la
  reparación honesta es declarar una interfaz `Participant`, que es trabajo propio y con riesgo
  de ripple. **Queda como backlog B-08, candidata a P4**, que ya toca `handler.ts`.
  El prompt lleva la tabla exacta del estado final esperado —`handler.ts` `(0)(0)(2)(6)`,
  `index.ts` `(0)(0)(0)(0)`, `handler_test.ts` `(0)(0)(0)(0)`, totales `1039/160/92/46`— para que
  esto sea un criterio comprobable y no un juicio improvisado en la revisión. **Codex tiene que
  recibir esto explícitamente en su prompt de revisión final**; si no, lo leerá estricto y hará
  FAIL con razón aparente.
- **LO OTRO QUE EL PLAN NO SABÍA Y ABARATA LA FASE: el seam ya existe cinco veces en este repo.**
  `generate-oraciones`, `generate-story`, `generate-scene-images`, `refine-story` y
  `process-reflexion-pdf` tienen exactamente el split `handler.ts` + `index.ts` delgado +
  `handler_test.ts`, con la firma `createHandler(deps)`. La sección «Risks» de P3a no lo
  menciona y describe la fase como si hubiera que inventar el patrón. El prompt inlinea
  `generate-oraciones/index.ts` entero (27 líneas) como plantilla. Esto rebaja el riesgo real de
  la fase bastante por debajo de lo que dice el plan.
- **LO QUE SÍ SE CONFIRMA DEL RIESGO DECLARADO**: `_shared/testHelpers.ts` **no** tiene doble de
  consultas —lo verifiqué: tiene `makeAuthzDeps`, `AUTH_HEADER`, spy de `fetch`, captura de logs
  y fixtures de imagen, nada de query builder— y `wa-webhook/makeSupabase()` es una fábrica de
  cliente real, no un doble. Hay que escribirlo desde cero, dentro de `handler_test.ts` (meterlo
  en `_shared/` haría `F` de cuatro ficheros y tocaría un fichero del que dependen seis suites).
  El prompt enumera las **diez formas de llamada exactas** que el handler hace, separadas en
  lecturas y escrituras, para que el ejecutor no las derive leyendo. Y le calibra el umbral de
  `FINDINGS`: el plan dice «si el doble supera al código que prueba»; el código que prueba son
  ~470 líneas, así que un doble de 100–200 **no** es motivo de FINDINGS.
- OTRAS DOS COSAS QUE PUSE EN EL PROMPT PARA QUE NO CUESTEN UNA RONDA: (1) la sustitución exacta
  de `pick` —`Math.floor(Math.random() * (i + 1))` → `pick(i + 1)`, mismo rango, sin off-by-one—
  y el aviso de que `shuffle` corre **cuatro veces o más** por request, con el orden de consumo,
  que es la forma más probable de quemar una ronda en los goldens 5 y 6; sugiero `pick = () => 0`
  para quitarse la contabilidad de encima. (2) El `// deno-lint-ignore no-explicit-any` sobre el
  alias del cliente es **obligatorio**: `adminAuth.ts` ya lo hace, y sin él el ejecutor introduce
  un `no-explicit-any` nuevo en `handler.ts` y suspende su propio gate.
- **`index 2.ts`**: hay un duplicado obsoleto y **trackeado** en el mismo directorio, con cinco
  diagnósticos propios que ya cuentan en los totales. Está fuera de `F`. El prompt dice
  explícitamente que no se toca ni se borra — borrarlo es una decisión aparte, no un apaño de
  paso. Lo dejo anotado aquí porque es la clase de cosa que un ejecutor «arregla» sin preguntar.
- **Vitest, simplificación honesta**: `F` no contiene ningún fichero que Vitest cargue —P3a no
  toca nada bajo `src/`— así que **por construcción** cualquier rojo es preexistente y D8.2 se
  satisface sin dirimir nada en el commit padre. Se registra como observación y ya. Está en el
  prompt para que nadie persiga el flake de B-05.
- BACKLOG ADDED: **B-08** (los ocho diagnósticos desplazados; candidata P4). Y añado la **fila de
  B-07**, que el Decision Log y la nota de la «Aritmética de tests» ya citaban dos veces pero que
  nunca llegó a existir en la tabla del backlog.
- FINDINGS RAISED: ninguno contra el código. El punto de D8.4 de arriba es una **ambigüedad del
  plan que resuelvo dentro de su propia letra**, no un defecto de implementación.
- DECISIONS: ninguna que enmiende el plan. La clasificación de los ocho diagnósticos como
  desplazamiento se apoya en la cláusula de clasificación manual que D8.4 ya contiene.
- OPEN AFTER THIS ROUND: (1) **Merge de `feat/mesa-md-alloc` a `main`** — decisión y ejecución de
  Brent; el PM no mergea. Es lo único que retiene a P3a. (2) Después, `/exec UPGRADE P3a r1`.
  (3) Cuando P3a llegue a revisión final, **el prompt de Codex debe declarar el desplazamiento de
  B-08 explícitamente**. (4) Backlog B-05, B-06, B-07 y B-08 abiertos; **B-06 hay que decidirlo
  antes de P8**.

### 2026-08-08 — P3a r1 — Claude Opus 5 (EXEC) + PM (Opus 5) — VERIFICACIÓN
- SESSION: UPGRADE · P3a · r1 · EXEC (reporte) · UPGRADE · P3a · PM (verificación)
- CONTEXT PRESSURE: comfortable — el ejecutor paró en la puerta de precondición, antes de
  cualquier trabajo de implementación.
- **STATUS DEL EJECUTOR: BLOCKED, y es la conducta correcta.** La precondición dura del prompt
  falló: P2 no está mergeada en `main`. No creó rama, no escribió código, no tocó el ledger.
- **LO QUE VERIFIQUÉ YO MISMO, no lo que dice el reporte.** Las cuatro afirmaciones del
  ejecutor, comprobadas una a una tras `git fetch`:
  - `git show origin/main:docs/plan/upgrade/PLAN.md | grep -c 'P2 | Módulo puro…DONE'` → **0**.
    Confirmado.
  - Fila P2 en `origin/main`:321 → `TODO`. En `feat/mesa-md-alloc`:321 → `**DONE** · 6363378`.
    Confirmado, no es un artefacto del patrón de grep.
  - `git merge-base --is-ancestor origin/feat/mesa-md-alloc origin/main` → **no**. Sin mergear.
  - La bifurcación del ledger es real y medible: `origin/main` termina en «P2 round 1 — PM —
    DESBLOQUEO Y DESPACHO»; `feat/mesa-md-alloc` lleva **cuatro entradas más** (P2 exec,
    verificación del PM, P2 CIERRE, bootstrap de P3a). Ramificar desde `main` y añadir una
    quinta habría bifurcado exactamente esas cuatro. Es B-02 otra vez, literal.
  El ejecutor también **omitió deliberadamente la entrada de ledger** que pide el «WHEN DONE»,
  razonando que escribirla desde una rama del `main` actual causaría el daño que la precondición
  existe para evitar. **Tiene razón y lo registro yo en su lugar**, que es lo que corresponde.
- **LO QUE EL EJECUTOR NO VIO Y CAMBIA UNA INSTRUCCIÓN MÍA: `main` se movió durante la ronda.**
  En mi bootstrap `origin/main` estaba en `981c00f`; ahora está en **`1c4490f`**
  («feat(audio): E-infra-impl»), del workstream AUDIO. Consecuencias, las dos medidas:
  1. **El merge de P2 ya no es fast-forward.** `981c00f` sigue siendo ancestro de `main`, pero
     `main` tiene ahora un commit que `feat/mesa-md-alloc` no tiene. El
     `git merge --ff-only` que di al cerrar el bootstrap **habría fallado**. Hace falta un merge
     normal. Lo ensayé en una rama desechable (`tmp/p3a-parent`, ya borrada): **merge limpio,
     cero conflictos** — AUDIO no tocó `docs/plan/upgrade/` en absoluto.
  2. **Las líneas base NO cambian, y lo medí en vez de suponerlo.** Sobre el padre real
     post-merge (`origin/main` + `feat/mesa-md-alloc`): gate por fichero idéntico —`handler.ts`
     y `handler_test.ts` `(0)(0)(0)(0)`, `index.ts` `(0)(0)(4)(6)` con los mismos mensajes— y
     totales **`tsc=1039 eslint=160 deno-lint=94 deno-check=46`**, iguales. AUDIO tocó
     `.env.test.example`, `playwright.config.ts`, `scripts/gates/README.md`, `supabase/seed.sql`
     y `tests/e2e/*`: nada bajo `supabase/functions/` ni `src/`. `tsconfig.app.json` solo incluye
     `src`, y `vitest.config.ts` excluye `tests/e2e/**` explícitamente, así que Vitest sigue en
     **1063/6** y Deno en **428/0**. **El prompt `P3a-r1.md` sigue correcto palabra por palabra;
     no lo reescribo.**
- FINDINGS RAISED contra el código: **ninguno** — no hay código; la ronda no llegó a existir.
  Contra mi propio bootstrap, dos, ambas mías y ninguna del ejecutor:
  - **SHOULD-FIX (proceso): el prompt quedó solo en `feat/mesa-md-alloc`, no en `main`.** Lo
    commiteé ahí para no bifurcar el ledger, y esa parte era correcta, pero el efecto es que un
    ejecutor que arranca de `main` no encuentra su propio prompt. Éste lo localizó en otro
    checkout y siguió, pero le costó trabajo que no era suyo. **La regla correcta para adelante:
    el prompt va a `main` —es un fichero nuevo, nunca conflictúa— y las ediciones de `LEDGER.md`
    y `PLAN.md` van a la rama pendiente.** Se resuelve solo en cuanto entre el merge.
  - **NIT: la orden de merge que di era `--ff-only`** y ha dejado de ser válida por el
    movimiento de `main`. Corregida abajo.
- DECISIONS: ninguna. El plan no cambia; P3a sigue releída sin enmienda y el prompt sin tocar.
- BACKLOG ADDED: ninguno. B-05, B-06, B-07 y B-08 siguen abiertos; **B-06 antes de P8**.
- **RONDAS CONSUMIDAS: cero.** Esta ronda no cuenta contra el tope de 3 del SOP §1.5: no hubo
  intento de implementación que juzgar, solo una puerta que hizo su trabajo. El redespacho tras
  el merge sigue siendo `r1`.
- OPEN AFTER THIS ROUND: (1) **Merge de `feat/mesa-md-alloc` a `main`** — decisión y ejecución de
  Brent; ahora con merge normal, no `--ff-only`. Es lo único que retiene a P3a. (2) Después,
  `/exec UPGRADE P3a r1`, con el prompt sin cambios. (3) En la revisión final de P3a, el prompt
  de Codex debe declarar explícitamente el desplazamiento de diagnósticos de **B-08**.

### 2026-08-08 — P3a r1 (2.º redespacho) — Claude Opus 5 (EXEC)
- SESSION: UPGRADE · P3a · r1 · EXEC
- CONTEXT PRESSURE: comfortable — parada en la puerta de precondición, antes de crear rama.
- **STATUS: BLOCKED. La misma puerta que la vez anterior: P2 sigue sin mergear en `main`.**
  No creé `feat/mesa-md-seam`, no escribí código, no toqué `PLAN.md`.
- ACTION: localicé el plan y el prompt, verifiqué la precondición dura del prompt y paré.
  El prompt `P3a-r1.md` **sigue existiendo solo en `feat/mesa-md-alloc`** (checkout
  `casa-p2-review`); no está en `main`. Es la SHOULD-FIX de proceso que el PM ya se anotó en
  la ronda anterior, y sigue costando trabajo de búsqueda al ejecutor.
- **LO QUE MEDÍ, tras `git fetch origin`:**
  - `git show origin/main:docs/plan/upgrade/PLAN.md | grep -c 'P2 | Módulo puro…DONE'` → **0**.
  - Fila P2 en `origin/main`:321 → `TODO`; en `origin/feat/mesa-md-alloc`:321 →
    `**DONE** 2026-08-08 · 6363378`.
  - `git merge-base --is-ancestor origin/feat/mesa-md-alloc origin/main` → **no**.
  - `origin/main` sigue en **`1c4490f`** — no se ha movido desde la verificación del PM, así que
    las líneas base que midió (gate por fichero, `tsc=1039 eslint=160 deno-lint=94 deno-check=46`,
    Deno 428/0, Vitest 1063/6) siguen siendo las del padre correcto.
  - `origin/main..origin/feat/mesa-md-alloc` = **6 commits** (1 de código P2 + 5 de docs), y el
    ledger de la rama lleva **cinco entradas** que `main` no tiene. Ramificar de `main` y añadir
    una sexta bifurcaría exactamente esas cinco: B-02 otra vez.
  - Ensayo de merge sin tocar ningún worktree:
    `git merge-tree --write-tree origin/main origin/feat/mesa-md-alloc` → **exit 0, sin
    conflictos**. Confirma el ensayo del PM: el merge es limpio pero **no** fast-forward.
- ENTRADA DE LEDGER: la escribo **en `feat/mesa-md-alloc`**, que es donde está la punta real del
  ledger. Escribirla ahí no bifurca nada; lo que bifurcaba era escribirla desde una rama de
  `main`, que es lo que la ronda anterior evitó correctamente omitiéndola.
- TESTS: ninguno ejecutado — la fase no llegó a empezar.
- FINDINGS RAISED: ninguno. El plan y el prompt siguen correctos palabra por palabra.
- DECISIONS: ninguna.
- BACKLOG ADDED: ninguno. B-05, B-06, B-07 y B-08 siguen abiertos; **B-06 antes de P8**.
- **RONDAS CONSUMIDAS: cero**, por el mismo motivo que la anterior (SOP §1.5): no hubo intento de
  implementación que juzgar. El redespacho tras el merge sigue siendo `r1`.
- OPEN AFTER THIS ROUND: (1) **Merge de `feat/mesa-md-alloc` a `main`** — decisión y ejecución de
  Brent, con merge normal (no `--ff-only`). Es lo único que retiene a P3a. (2) Después,
  `/exec UPGRADE P3a r1`, con el prompt sin cambios. (3) En la revisión final de P3a, el prompt de
  Codex debe declarar explícitamente el desplazamiento de diagnósticos de **B-08**.

### 2026-08-08 — P3a r1 (3.er redespacho) — Claude Opus 5 (EXEC)
- SESSION: UPGRADE · P3a · r1 · EXEC
- CONTEXT PRESSURE: comfortable — parada en la puerta de precondición, antes de crear rama.
- **STATUS: BLOCKED. Tercera vez, misma puerta: P2 sigue sin mergear en `main`.**
  No creé `feat/mesa-md-seam`, no escribí código, no toqué `PLAN.md`.
- ACTION: resolví el plan por `workstreams.md` → `docs/plan/upgrade/` (verificado por META:
  `SESSION PREFIX: UPGRADE`), localicé el prompt, verifiqué la precondición dura y paré.
  El prompt `P3a-r1.md` **sigue existiendo solo en `feat/mesa-md-alloc`** (checkout
  `casa-p2-review`); en `main` no está. Es la SHOULD-FIX de proceso que el PM ya se anotó hace
  dos rondas y que sigue costando búsqueda al ejecutor en cada redespacho.
- **LO QUE MEDÍ, tras `git fetch origin`:**
  - `grep -c 'P2 | Módulo puro de asignación.*DONE' docs/plan/upgrade/PLAN.md` sobre `main` →
    **0**. La precondición del prompt exige `1`.
  - Fila P2 en `main`:321 → `TODO`; en `feat/mesa-md-alloc`:321 →
    `**DONE** 2026-08-08 · 6363378`.
  - `git merge-base --is-ancestor origin/feat/mesa-md-alloc origin/main` → **no**.
  - `origin/main` sigue en **`1c4490f`**: **no se ha movido** desde la ronda anterior ni desde la
    verificación del PM, así que las líneas base medidas sobre el padre post-merge siguen siendo
    las correctas (gate por fichero `handler.ts`/`handler_test.ts` `(0)(0)(0)(0)`, `index.ts`
    `(0)(0)(4)(6)`; totales `tsc=1039 eslint=160 deno-lint=94 deno-check=46`; Deno 428/0;
    Vitest 1063/6).
  - `origin/feat/mesa-md-alloc` está en **`62baca8`**, ahora **7 commits** por delante de `main`
    (1 de código P2 + 6 de docs). El ledger de la rama lleva **seis entradas** que `main` no
    tiene (60 vs 54); esta hace **siete**. Ramificar de `main` y escribir ahí las bifurcaría
    todas: B-02 otra vez.
  - Ensayo de merge sin tocar ningún worktree:
    `git merge-tree --write-tree origin/main origin/feat/mesa-md-alloc` → **exit 0, sin
    conflictos**. El merge sigue siendo limpio y sigue **sin** ser fast-forward.
- ENTRADA DE LEDGER: escrita **en `feat/mesa-md-alloc`**, la punta real del ledger, por el mismo
  motivo que la ronda anterior.
- TESTS: ninguno ejecutado — la fase no llegó a empezar.
- FINDINGS RAISED: ninguno. El plan y el prompt siguen correctos palabra por palabra; releídos
  íntegros esta ronda y no requieren enmienda.
- DECISIONS: ninguna.
- BACKLOG ADDED: ninguno. B-05, B-06, B-07 y B-08 siguen abiertos; **B-06 antes de P8**.
- **RONDAS CONSUMIDAS: cero**, por el mismo motivo que las dos anteriores (SOP §1.5): no hubo
  intento de implementación que juzgar, solo una puerta que hizo su trabajo. El redespacho tras
  el merge sigue siendo `r1`.
- **OBSERVACIÓN DE PROCESO (no es un hallazgo del plan):** tres redespachos han terminado en la
  misma puerta sin que cambiara nada entre ellos. La puerta es correcta y no propongo relajarla;
  lo que no está funcionando es redespachar P3a antes de que exista el merge. Sugerencia para el
  PM: no volver a lanzar `/exec UPGRADE P3a r1` hasta que
  `git show origin/main:docs/plan/upgrade/PLAN.md | grep -c 'P2 | Módulo puro de asignación.*DONE'`
  imprima `1`.
- OPEN AFTER THIS ROUND: (1) **Merge de `feat/mesa-md-alloc` a `main`** — decisión y ejecución de
  Brent, con merge normal (no `--ff-only`). Es lo único que retiene a P3a. (2) Después,
  `/exec UPGRADE P3a r1`, con el prompt sin cambios. (3) En la revisión final de P3a, el prompt de
  Codex debe declarar explícitamente el desplazamiento de diagnósticos de **B-08**.

### 2026-08-08 — P3a r1 — PM (Opus 5) — SE DETIENEN LOS REDESPACHOS
- SESSION: UPGRADE · P3a · PM
- Verificado otra vez, y por última vez: `origin/main` sigue en `1c4490f` (sin moverse desde mi
  medición), `origin/feat/mesa-md-alloc` en `fdbaa86` con **8 commits y 7 entradas de ledger**
  que `main` no tiene, `--is-ancestor` → no, y `git merge-tree --write-tree` → **exit 0, sin
  conflictos**. El ejecutor acertó en todo; sus recuentos (7 commits, 6 entradas) los tomó antes
  de que aterrizara el suyo propio, lo cual no cambia nada.
- **DEJO DE REDESPACHAR P3a. La culpa del bucle es mía, no de la puerta ni del ejecutor.** Tres
  sesiones han muerto en la misma precondición sin que cambiara una sola cosa entre ellas, y las
  tres murieron porque yo cerré el mensaje anterior con una línea `/exec` pegable. La puerta
  hizo exactamente su trabajo las tres veces; lo que fallaba era despacharla antes de que
  existiera la condición. **No habrá una cuarta hasta que el merge esté verificado en
  `origin/main`.**
- **El coste ya es visible en este fichero**: tres entradas de ejecutor y dos de PM describiendo
  el mismo no-evento. El ledger es append-only y no las reordeno ni las borro, pero que quede
  dicho para quien lo lea después: **las cinco entradas cuentan un solo hecho** — P2 no estaba
  mergeada.
- **CONDICIÓN DE REARME, explícita para que nadie la infiera.** Antes de volver a despachar,
  esto tiene que imprimir `1`:
  ```
  git fetch origin && git show origin/main:docs/plan/upgrade/PLAN.md \
    | grep -c 'P2 | Módulo puro de asignación.*DONE'
  ```
  Si imprime `0`, la respuesta correcta **no** es abrir una sesión de ejecutor.
- Nada más cambia: el prompt `P3a-r1.md` sigue válido sin tocar, las líneas base siguen medidas
  y vigentes (`1039/160/94/46`, Deno `428/0`, Vitest `1063/6`), y el merge está ensayado limpio.
  **Rondas consumidas: cero.** El redespacho posterior al merge sigue siendo `r1`.
- FINDINGS RAISED: ninguno contra el código. La única corrección de esta ronda es de proceso y
  es contra mí.
- OPEN AFTER THIS ROUND: (1) **Merge de `feat/mesa-md-alloc` a `main`** — de Brent, merge normal,
  no `--ff-only`. Único bloqueo. (2) Verificar la condición de rearme de arriba. (3) Solo
  entonces, `/exec UPGRADE P3a r1`.

### 2026-08-08 — P2 MERGE + P3a DESBLOQUEADA — Brent (autorización) + PM (ejecución)
- SESSION: UPGRADE · P3a · PM
- **Brent autorizó explícitamente el merge («go ahead and merge») y lo ejecuté yo.** Merge normal
  (no `--ff-only`, imposible desde que `main` se movió a `1c4490f`): `415474b`, publicado en
  `origin/main`. Rama aprobada `feat/mesa-md-alloc`@`92d6585`.
- VERIFICACIONES PREVIAS AL MERGE, en este orden y todas antes de tocar nada: SHA aprobado ·
  `--is-ancestor` → no mergeada · FF imposible → merge commit · `git merge-tree --write-tree` →
  **exit 0, sin conflictos** · alcance del diff = **exactamente los tres ficheros de código de
  P2** (`mainDish.ts`, `mainDish_test.ts`, `mainDishImport.test.ts`) más documentos de plan ·
  worktrees sin actividad en conflicto (`main` estaba en `casa-web`, limpio salvo dos ficheros
  sin trackear de AUDIO que el merge no toca).
- VERIFICACIONES POSTERIORES, antes de publicar, porque un push a `main` dispara el despliegue de
  Vercel: **Deno 428 passed / 0 failed** —idéntico a la línea base que yo había medido— y
  `npm run build` **exit 0**. El merge no cambia nada de cara al usuario: dos módulos Deno de
  `_shared/` (que no despliega Vercel), un test de Vitest y documentos.
- **CONDICIÓN DE REARME CUMPLIDA**: sobre `origin/main`,
  `grep -c 'P2 | Módulo puro de asignación.*DONE'` → **1**. Y `prompts/P3a-r1.md` **ya está en
  `origin/main`**, así que el coste de búsqueda que pagaron los tres redespachos anteriores
  desaparece: el próximo ejecutor lo encuentra donde le dice su propio prompt.
- **P3a queda desbloqueada.** Prompt sin cambios, líneas base vigentes y medidas sobre este mismo
  árbol (`1039/160/94/46`, Deno `428/0`, Vitest `1063/6`), **rondas consumidas: cero** — el
  despacho sigue siendo `r1`.
- FINDINGS RAISED: ninguno. DECISIONS: ninguna que toque el plan.
- OPEN AFTER THIS ROUND: (1) `/exec UPGRADE P3a r1` — ahora sí. (2) En la revisión final de P3a,
  el prompt de Codex **debe declarar explícitamente el desplazamiento de diagnósticos de B-08**.
  (3) Backlog B-05, B-06, B-07 y B-08 abiertos; **B-06 hay que decidirlo antes de P8**.

### 2026-08-08 — P3a r1 — claude-opus-5 (EXEC)
- SESSION: UPGRADE · P3a · r1 · EXEC
- CONTEXT PRESSURE: comfortable. La fase no se acercó al límite: el movimiento se hizo con un
  script de extracción en vez de a mano, lo que evitó releer y retranscribir 490 líneas.
- ACTION: seam cortado. `handler.ts` nuevo (536 líneas) con `createHandler(deps)` y `pick`
  inyectable; `index.ts` reducido a adaptador fino de 21 líneas contra el import map (D13);
  `handler_test.ts` nuevo con el doble de Supabase en memoria (D12) y los 10 goldens.
  **Precondiciones verificadas antes de tocar nada**: `grep -c 'P2 | Módulo puro de
  asignación.*DONE'` → `1`, y `npx tsc -p tsconfig.app.json --noEmit | grep -c "error TS"` →
  `1039`. Node v22.22.0.
- EL MOVIMIENTO ES LITERAL Y ES COMPROBABLE. El bloque se extrajo con un script que (a) verifica
  siete anclas de línea contra la tabla del prompt, (b) corta las líneas 12–501, (c) borra la
  estrofa de env+cliente (17–22), (d) reindenta +2 y (e) sustituye los 4 sitios de `shuffle`.
  `diff -w` entre el bloque original y el movido muestra **exactamente** esas dos cosas y nada
  más. Ninguno de los diagnósticos de B-08 se tocó.
- COMMITS: `a345ce7` (movimiento), `50ca0e9` (doble + 10 goldens), `6e060e0` (comentario de C1).
  Rama `feat/mesa-md-seam`.
- TESTS: `cd supabase/functions && deno test --allow-all .` → **NO LLEGA A CORRER**: aborta en
  `Type checking failed. Found 8 errors`, todos en `handler.ts`. Cero tests ejecutados.
  Con `--no-check`: **438 passed / 0 failed** — exactamente el objetivo de C6 (428 + 10).
  El fichero nuevo, aislado y con `--no-check`: **10 passed / 0 failed**.
- FINDINGS RAISED: **dos, y el primero bloquea C6.**
  - **F-1 — C6 y el desplazamiento declarado de B-08 son mutuamente excluyentes.** `deno test`
    hace type-check de su grafo de importación. Hoy la base sale verde con `index.ts` cargando 6
    errores porque **ningún test lo importa**, así que nunca se comprueba. En cuanto
    `handler_test.ts` importa `handler.ts` —que es justo lo que pide la fase— esos errores
    entran en el grafo y `deno test` se niega a ejecutar la suite entera. No es un problema de
    mis tests: pasan los 10. Es que el plan pide a la vez «deja los diagnósticos donde están» y
    «`deno test` da 438 passed», y no pueden ser ciertas las dos. **No lo he resuelto por mi
    cuenta**: las salidas son cambiar el comando declarado a `--no-check` (debilita el
    type-check de las otras seis suites), arreglar los 8 diagnósticos aquí (adelanta B-08 y
    rompe la propiedad de «diff limpio» que justifica la fase), o partir P3a y aterrizar los
    tests después de B-08. Es decisión del PM.
  - **F-2 — la tabla de diagnósticos prevista no se cumple, en tres puntos.** Medido, no
    estimado:
    - `deno check` sobre `handler.ts` = **8**, no 6. Los dos extra son
      `TS7006 Parameter 'p'` en `handler.ts:144,145` (`participants.filter((p) => …)`, que en
      `index.ts` eran 121–122 y **no** estaban marcadas). Causa: `HandlerDeps.supabase:
      SupabaseLike = any`, que es lo que el propio prompt prescribe. En `index.ts`, `supabase`
      era el resultado tipado de `createClient(...)` y `participants` era un array, así que `p`
      recibía tipo **contextual**; un `any` contextual no es un `any` implícito y `noImplicitAny`
      callaba. Con `any` pelado no hay contexto y saltan. Total de proyecto `deno-check`
      **46 → 48**.
    - `eslint` sobre `handler.ts` = **1**, no 0:
      `@typescript-eslint/no-explicit-any` en `handler.ts:26`. El
      `// deno-lint-ignore no-explicit-any` que el prompt exige silencia **deno lint**, no
      ESLint, que tiene su propia regla. No es una desviación mía del patrón: la casa ya carga
      ese mismo error en `_shared/adminAuth.ts:13`, el fichero que el prompt cita como modelo.
    - **La línea base de `eslint` del prompt (160) es incorrecta.** Medida sobre el commit padre
      `1d6869d`: **346**. Mi punta da **347**, es decir **+1**, que es exactamente la línea de
      arriba — no +187. Conviene corregir la base antes de la revisión de Codex.
  - Lo que **sí** cuadró con la previsión: `deno-lint` **94 → 92** (los dos `no-import-prefix`
    desaparecen al escribir `index.ts` contra el import map), `tsc` **1039 → 1039**, y
    `index.ts` y `handler_test.ts` salen **0/0/0/0** los dos.
- DECISIONS: ninguna que toque el plan. No he «arreglado» ningún diagnóstico de B-08 ni he
  cambiado el comando de test declarado; ambas cosas son de F-1 y las decide el PM.
- BACKLOG ADDED: ninguno nuevo. F-1 y F-2 son hallazgos de esta ronda, no backlog.
- OPEN AFTER THIS ROUND: (1) **F-1 necesita una decisión del PM antes de que P3a pueda cerrarse**;
  el código está entero y verde, lo único que falta es cómo se ejecuta el gate de tests.
  (2) Corregir la línea base de `eslint` (160 → 346) en el plan. (3) El prompt de revisión de
  Codex debe declarar el desplazamiento **con 8 diagnósticos y +1 de eslint**, no con 6/0.
  (4) Vitest observado: **1063 passed / 6 failed**, los 6 en
  `MesaAbiertaDashboard.test.tsx` — el conjunto base declarado por D8.2, sin séptimo flake.
  `npm run build` exit 0.

### 2026-08-08 — P3a round 1 — PM (Opus 5) — VERIFICACIÓN INDEPENDIENTE
- SESSION: UPGRADE · P3a · PM
- **Ronda real: 1 de 3.** El ejecutor entregó `STATUS: FINDINGS` con el código completo y verde,
  y escaló una contradicción del plan en vez de resolverla por su cuenta. Fue la decisión
  correcta: la salida que eligiera habría atado al plan sin autoridad para hacerlo.
- **LO QUE VERIFIQUÉ YO MISMO, ejecutándolo, no leyéndolo:**
  - **El movimiento es verbatim, y esto es lo que más importaba.** Reconstruí el bloque esperado
    desde `1d6869d` (líneas 12–16 + 23–501 del `index.ts` viejo, sin la estanza de env/cliente) y
    lo comparé con el cuerpo de `handler.ts`: **484 líneas contra 484**, y `diff -w` devuelve
    **exactamente cuatro líneas distintas**, las cuatro llamadas a `shuffle` con `, pick`. Nada
    más. La regla dura de la fase queda demostrada mecánicamente, no afirmada.
  - **F-1 confirmada.** `cd supabase/functions && deno test --allow-all .` → `Found 8 errors. Type
    checking failed`, **exit 1, cero tests ejecutados**. Con `--no-check`: **438 passed / 0
    failed**. La contradicción es real.
  - C1: `grep -c "serve(\|Deno\.env" handler.ts` → **0**. C2: default en `handler.ts:38`, y
    `shuffle` usa `pick(i + 1)`, la sustitución exacta. C3/C4/C5: los 10 goldens están y se
    llaman como manda el plan; **tests 1 y 2 afirman `db.ops.length === 0`** —cero operaciones,
    más fuerte que cero escrituras— y **tests 3, 4 y 10 afirman `db.writes().length === 0`**.
    Test 2 además afirma `jsonCalls() === 0`. Comprobado leyendo los cuerpos, no el reporte.
  - Gate reproducido en el worktree del ejecutor: `handler.ts` `(0)(1)(2)(8)`, `index.ts`
    `(0)(0)(0)(0)`, `handler_test.ts` `(0)(0)(0)(0)`. Build exit 0. Vitest **1063/6**, los 6 del
    conjunto base declarado.
- **F-2c ES INCORRECTA, y la corrijo con la medición.** El ejecutor concluyó que mi línea base de
  ESLint (160) estaba mal y que lo real era 346. No: **el mismo commit da 160 en un checkout
  limpio (`casa-p2-review`) y 347 en `casa-web`**. La diferencia es **187 = 186 + 1**. Los 186
  salen de un único fichero generado, `supabase/.temp/start-secrets/…/main/index.ts`, que deja
  `supabase start` y que `eslint.config.js` no ignora — artefacto local del entorno de AUDIO, no
  del commit. El **+1** sí es suyo y es real. Su aritmética de delta era correcta; su diagnóstico
  de la causa no. **El total de ESLint no es portable entre checkouts**, que es exactamente por
  qué D8.5 lo trata como observación. Backlog **B-09**.
- **F-2a ES CORRECTA Y ES CULPA MÍA.** Dos de los 8 `deno check` no son desplazamiento: los
  `TS7006` de `p` en `handler.ts:144–145` **los causó la prescripción de mi prompt**,
  `HandlerDeps.supabase: SupabaseLike = any`, que borra el tipado contextual que `createClient(...)`
  daba a `participants`. Su explicación —un `any` contextual no dispara `noImplicitAny`, uno
  desnudo sí— es exacta. Igual el `no-explicit-any` de ESLint: el `deno-lint-ignore` que yo exigí
  silencia `deno lint`, no ESLint, y `adminAuth.ts:13` —el exemplar que yo mismo cité— carga el
  mismo error. **B-08 queda corregida: 6 desplazados + 3 nuevos por consecuencia del seam**, y la
  línea base de P4 es `(0)(1)(2)(8)`, no `(0)(0)(2)(6)`.
- **F-1 ES MI FALLO DE BOOTSTRAP, dicho sin rodeos.** `deno test` type-checkea su grafo de
  importación. Hoy la suite está verde con `index.ts` cargando 6 errores **solo porque ningún test
  lo importa**. En cuanto `handler_test.ts` importa `handler.ts` —el objeto entero de la fase— esos
  errores entran en el grafo y `deno test` se niega a ejecutar la suite completa. Medí `deno check`
  por fichero y `deno test` en el padre, pero **nunca simulé el caso «un test importa un fichero con
  errores de tipo»**, que era precisamente lo que mi decisión de desplazamiento iba a provocar.
- **MI RECOMENDACIÓN SOBRE F-1, con el dato que la decide.** De las tres salidas que planteó el
  ejecutor, la primera es mucho más barata de lo que él supuso, y lo comprobé:
  **`deno check .` ya type-checkea el árbol entero por su cuenta, ficheros de test incluidos.**
  `deno check .` enumera `handler_test.ts`, `availableMaterials_test.ts`, `contract_test.ts` y el
  resto; y `deno check create-mesa-matches/handler_test.ts` a solas destapa los 8 errores del
  handler. Es el **paso 4 del gate D8**, independiente y conservado. Por tanto **`deno test
  --no-check` no pierde ni una pizca de cobertura de tipos**: elimina una comprobación duplicada,
  no una comprobación. Las otras dos salidas cuestan mucho más —adelantar B-08 destruye la
  propiedad de diff limpio que es lo único que hace verificable esta fase, y partir P3a deja el
  seam sin tests hasta otra fase—. **Recomiendo enmendar C6 a `deno test --allow-all --no-check .`
  con fila de Decision Log.** No lo hago yo: cambia un criterio congelado.
- FINDINGS: **BLOCKING B1** = F-1, resoluble con una decisión de plan, **no con una ronda de
  ejecutor** — el código está completo y verde. **SHOULD-FIX S1** = B-08 mal contada (corregida
  arriba). **SHOULD-FIX S2** = total de ESLint no portable (B-09). **NIT N1** = el diagnóstico de
  causa de F-2c, corregido. **NIT N2** = el grep de C1 cazó su propio comentario de cabecera; lo
  reformuló él mismo en `6e060e0`, fuera del bloque movido. **Cero hallazgos BLOCKING contra el
  trabajo del ejecutor.**
- BACKLOG ADDED: **B-09**. B-08 corregida.
- OPEN AFTER THIS ROUND: (1) **Decisión de Brent sobre C6** (recomendación: `--no-check`).
  (2) Con eso, la fase queda limpia y lista para Codex **sin ronda de remediación**. (3) El prompt
  de Codex debe declarar el desplazamiento como **6 desplazados + 3 nuevos**, no 6 + 0, y advertir
  que el total de ESLint depende del checkout. (4) B-05, B-06, B-07, B-08, B-09 abiertos; **B-06
  antes de P8**.

### 2026-08-08 — P3a round 1 — CIERRE DE RONDA · C6 ENMENDADA — Brent (decisión) + PM (Opus 5)
- SESSION: UPGRADE · P3a · PM
- **Brent resolvió F-1 por la opción recomendada: C6 pasa a `deno test --allow-all --no-check .`**
  Enmendados **los dos** sitios donde vivía el comando —el **punto 3 de D8** (rige para todas las
  fases) y el **C6 de P3a**— más una fila de Decision Log que deja escrita la causa raíz: fue un
  fallo de bootstrap mío, no del ejecutor.
- **Por qué la enmienda no debilita nada, verificado y no supuesto**: `deno check .` del paso 4
  de D8 **enumera los ficheros `_test.ts`** (`handler_test.ts`, `availableMaterials_test.ts`,
  `contract_test.ts`, `corpus_test.ts`, `imageFetch_test.ts`…) y `deno check
  create-mesa-matches/handler_test.ts` a solas destapa los 8 errores del handler. El type-check
  que hacía `deno test` era **duplicado del paso 4**, no cobertura adicional — y, mientras un
  fichero importado arrastre diagnósticos, un duplicado que **se niega a ejecutar la suite** en
  vez de reportar 0 fallos.
- **C6 verificada bajo el comando enmendado, por mí:** `cd supabase/functions && deno test
  --allow-all --no-check .` → **438 passed / 0 failed**. Los +10 exactos sobre la línea base de
  428 que medí en el bootstrap.
- **UNA COMPROBACIÓN MÁS QUE HICE ANTES DE DAR LA FASE POR LIMPIA**, porque yo mismo se la iba a
  pedir a Codex: los goldens 5 y 6 comparan contra `referenceShuffle`, y había que descartar que
  fuera circular. **No lo es**: está **definido en local en `handler_test.ts:85`**, y el fichero
  importa únicamente `assertEquals` y `createHandler` — no reimporta el `shuffle` del handler, así
  que no puede derivar con él en silencio. Es, eso sí, una **reimplementación línea por línea**:
  fija la conducta de hoy, no valida el algoritmo, y un error conceptual compartido pasaría los
  dos. Para una fase cuyo mandato es *conducta idéntica* lo doy por el instrumento correcto, y se
  lo señalo a Codex por si discrepa.
- **LA FASE ESTÁ LIMPIA Y LISTA PARA LA REVISIÓN FINAL DE CODEX.** Los siete criterios se cumplen:
  C1 (`grep` → 0), C2 (default en `:38`, `pick(i + 1)` sin off-by-one), C3 (10 goldens contra el
  doble en memoria, sin base real), C4 (comida en 5 y 6, redistribución parcial en 8), C5 (orden
  de guardas intacto por el diff verbatim; ops/writes en cero afirmados en los cinco tests), C6
  (438/0), C7 (tabla de gate medida y declarada, build exit 0). **Sin ronda de remediación: cero
  hallazgos BLOCKING contra el trabajo del ejecutor.** Rondas consumidas: **1 de 3**.
- Prompt de revisión final escrito y commiteado en `prompts/P3a-codex-review.md`. Lleva por
  delante las **tres cosas que harían fallar la fase por el motivo equivocado**: que los 11
  diagnósticos de `handler.ts` son 6 desplazados + 3 nuevos declarados (B-08 corregida) + 2
  `no-unused-vars`, que el comando de Deno se enmendó a mitad de fase y por qué eso no reduce
  cobertura, y que el total de ESLint **no es portable** entre checkouts (B-09). También le pide
  que reproduzca él mismo la comparación de 484 líneas, que es donde vive la fase.
- FINDINGS RAISED: ninguno nuevo. DECISIONS: la enmienda de C6/D8.3, con fila de Decision Log.
- BACKLOG: B-05, B-06, B-07, **B-08 (corregida)**, **B-09** abiertos. **B-06 antes de P8.**
- OPEN AFTER THIS ROUND: (1) **Revisión final de Codex** con `prompts/P3a-codex-review.md`.
  (2) La fase **no** se marca DONE hasta que Codex pase — es lo único que la cierra. (3) Merge de
  `feat/mesa-md-seam`, después y solo si Codex pasa: decisión de Brent. (4) Luego **P3b**
  (`feat/mesa-md-core`), cuya regla dura es que **los 10 goldens de P3a pasen sin modificación**.

### 2026-08-08 — P3a CIERRE — Codex (REVIEW) + PM (Opus 5)
- SESSION: UPGRADE · P3a · REVIEW
- **VERDICT: PASS.** `feat/mesa-md-seam`@`76d2d5e`. **Cero BLOCKING, cero SHOULD-FIX, cero NIT** —
  la primera fase del plan que sale sin una sola observación. Review en `reviews/REVIEW-P3a.md`.
  **La había commiteado en local y sin publicar** (igual que en P2); la empujé yo tras leerla.
  **P3a queda DONE.**
- LO QUE CODEX VERIFICÓ POR SU CUENTA: **reprodujo la comparación mecánica de las 484 líneas** y
  confirma que `diff -w` solo difiere en las cuatro llamadas a `shuffle` con `pick`, con
  Fisher–Yates intacto y sin off-by-one · Deno **438/0** · gate acotado y build **exit 0** ·
  `handler.ts` sin `serve` ni `Deno.env`, `index.ts` como adaptador fino · `index 2.ts` y
  `_shared/testHelpers.ts` sin tocar · los 10 goldens con doble en memoria, sin base real ni
  `auth.users`, con cero escrituras en los guardas exigidos.
- **AVALA LAS DOS COSAS QUE MÁS ME PREOCUPABAN.** (1) La enmienda de C6/D8.3 a `--no-check`:
  «coherente — la suite ejecutó 438/0 y `deno check` sigue cubriendo el grafo completo, incluido
  `handler_test.ts`». Era el punto donde yo mismo le pedí que discrepara si no estaba de acuerdo.
  (2) La clasificación de B-08: los seis desplazados conservan sus mensajes y **las únicas
  consecuencias nuevas son las tres que el plan ya aceptaba**.
- **Y EXPLICA LA DISCREPANCIA DE VITEST QUE YO NO HABÍA RESUELTO.** Midió **1055/14** en punta y
  padre con idénticas identidades; yo había medido **1063/6** en el padre, en otro worktree. Las
  ocho de diferencia son de `usePresentationState` por **`localStorage` ausente**, y se reproducen
  sin P3a. **No es el flake de B-05**, es otra cosa con causa nombrada — mi prompt había dicho «si
  ves 7, es B-05», y eso habría desorientado a quien viera 14. Backlog **B-10**. La regla del
  padre de D8.2 hizo exactamente su trabajo.
- **DE LAS DOS SORPRESAS DE MEDICIÓN DE ESTA FASE, NINGUNA ERA CÓDIGO Y LAS DOS ERAN EL ENTORNO**
  (B-09, el total de ESLint inflado por `supabase/.temp/`; B-10, `localStorage`). Vale la pena
  registrarlo como patrón: los recuentos por fichero fueron portables en todos los checkouts, los
  totales de proyecto no lo fueron en ninguno.
- COSTE REAL DE LA FASE: **1 ronda de ejecutor, 1 verificación de PM, 1 revisión de Codex** — más
  tres redespachos muertos en la puerta de precondición, que fueron culpa mía y no de la fase.
  «La sesión de mayor riesgo del plan» salió por el camino corto, y lo que la abarató fue
  concreto: el seam ya existía cinco veces en el repo, y el prompt llevaba medida de antemano la
  línea base por fichero.
- **§3.8.5 — P3b RELEÍDA A LA LUZ DE LO CONSTRUIDO. UNA ENMIENDA HECHA Y UNA DECISIÓN QUE PROPONGO:**
  - **Hecho:** D5e decía `deno test` a secas. Actualizado a `deno test --allow-all --no-check .`,
    **446/0** en la punta. Es consecuencia directa de la enmienda de D8.3 ya aprobada, no un
    criterio nuevo; lo escribo explícito para que ningún ejecutor lo redescubra a su costa.
  - **Propuesto, y es de Brent: P3b es mejor sitio que P4 para B-08.** P3b vuelve a mover código
    —los bucles de asiento— a un fichero nuevo con línea base cero, así que la pregunta de
    desplazamiento de D8.4 se repite. Medido: de los 11 diagnósticos de `handler.ts`, **`:192`
    (`TARGET_GUEST_SIDE_FOR_DINNER`) y `:333` (`g`) caen dentro del bloque que P3b extrae**, y
    `:144–145` (`p`) están justo en la frontera; `:400`, `:419`, `:441`, `:467` y `:520` son ruta
    de escritura y se quedan. **Pero D1e exige que `matching.ts` sea puro**, sin importar
    `@supabase/supabase-js` — y un módulo puro tiene que nombrar sus tipos de entrada, igual que
    `mainDish.ts` nombró `Carrier` y `TableInput` en P2. En cuanto lo haga, esos `TS7006`
    **desaparecen por construcción en vez de desplazarse**. Es decir: P3b va a tener que declarar
    la interfaz `Participant` que B-08 pide, quiera o no. Adelantar B-08 ahí cuesta poco y deja
    `matching.ts` limpio; dejarlo para P4 arrastra el problema una fase más.
  - Sin otras enmiendas: alcance, D1e–D4e, D6e y el tamaño de P3b siguen bien. Su regla dura
    —los 10 goldens de P3a pasan **sin modificación**, `git diff` sobre `handler_test.ts` vacío—
    es ahora concreta y comprobable contra `76d2d5e`.
- FINDINGS RAISED: ninguno. DECISIONS: ninguna nueva; la de C6/D8.3 ya está en el Decision Log.
- BACKLOG: **B-10** añadido. B-05, B-06, B-07, B-08 (corregida), B-09, B-10 abiertos. **B-06 hay
  que decidirlo antes de P8.**
- OPEN AFTER THIS ROUND: (1) **Merge de `feat/mesa-md-seam`** — decisión de Brent; fast-forward
  posible mientras `main` no se mueva. (2) Decidir si B-08 se adelanta a P3b. (3) Después,
  `/pm-boot UPGRADE P3b` con contexto fresco.

### 2026-08-08 — P3b round 1 — PM (Opus 5) — BOOTSTRAP Y PROMPT
- SESSION: UPGRADE · P3b · PM
- **Estado al arrancar:** P3a **DONE** (Codex PASS sin una sola observación, `76d2d5e`). P3b es
  la siguiente fase por el índice: `TODO`, depende solo de P3a, y P4 depende de ella. Rondas de
  ejecutor consumidas en P3b: **cero**.
- **LO QUE MEDÍ YO MISMO, ejecutándolo, no heredándolo del ledger.** El abaratamiento de P3a se
  atribuyó explícitamente a que el prompt llevaba la línea base medida de antemano; repito el
  procedimiento:
  - `cd supabase/functions && deno test --allow-all --no-check .` → **438 passed / 0 failed**.
    Coincide con lo que dejó P3a. El objetivo de D5e (**446/0**) es por tanto exacto.
  - `scripts/gates/changed-files-diagnostics.sh` sobre `handler.ts` → **`(0)(1)(2)(8)`**,
    idéntico a la B-08 corregida. **Y con los mensajes crudos y sus líneas**, que es lo que hacía
    falta: sin eso no se puede decir qué diagnóstico cae dentro del bloque extraído y cuál no.
  - `_shared/mainDish.ts` (el módulo puro de P2) → **`(0)(0)(0)(0)`**. Es la prueba de que en
    este repo un módulo puro llega a cero, así que exigírselo a `matching.ts` no es una
    aspiración: es un listón ya alcanzado, y el prompt cita el fichero como patrón.
  - Merge de `feat/mesa-md-seam` a `main`: **fast-forward posible** (`--is-ancestor` → sí),
    `git merge-tree --write-tree` **exit 0 sin conflictos**, y el alcance de código son
    **exactamente los tres ficheros de P3a** (`handler.ts` +536, `handler_test.ts` +511,
    `index.ts` −506) más documentos de plan.
- **EL BLOQUEO, DICHO ANTES QUE NADA: `feat/mesa-md-seam` NO ESTÁ EN `main`.** `origin/main`
  sigue en `1d6869d` y `grep -c 'P3a | Seam.*DONE'` sobre `origin/main` → **0**. P3b no puede
  ejecutarse: su regla dura es que los diez goldens de P3a pasen sin modificación, y esos
  ficheros **no existen** fuera de la rama del seam.
- **NO DESPACHO, Y ESO ES DELIBERADO.** El coste de P3a fue tres sesiones de ejecutor muertas en
  esta misma puerta, y el PM de entonces dejó escrito que la culpa fue cerrar el mensaje con una
  línea `/exec` pegable antes de que existiera la condición. No repito el patrón: la línea `/exec`
  de este mensaje va explícitamente detrás del merge, con la condición de rearme verificable
  incluida **dentro** del propio prompt (§0), de modo que aunque se despache antes de tiempo el
  ejecutor se detenga en la primera orden en vez de gastar una sesión.
- **B-08 — RESUELVO LA PREGUNTA QUE P3a DEJÓ ABIERTA, Y NO NECESITA DECISIÓN DE BRENT.** El PM de
  P3a propuso «adelantar B-08 a P3b» como decisión de Brent. Al medirlo, la pregunta se disuelve:
  - **D1e ya obliga a la mitad.** `matching.ts` no puede importar `@supabase/supabase-js`, así que
    no hereda el tipado del cliente y **tiene que nombrar sus tipos de entrada**. En cuanto lo
    haga, los `TS7006` de dentro del bloque desaparecen **por construcción**, no por una tarea
    añadida. No es alcance nuevo: es consecuencia de un criterio ya congelado.
  - **La otra mitad cae sola.** `:400` (×2), `:419` y `:441` son la ruta de escritura iterando
    `host.assignedGuests`, que tras esta fase viene del **valor de retorno tipado** de
    `matching.ts`. Dejan de ser `any` implícito sin que nadie los toque.
  - **El residuo se queda donde estaba**: `:26` (`no-explicit-any` de `SupabaseLike`), `:467`
    (`count`) y `:520` (`TS18046`) no son del bloque extraído. **Siguen en B-08 y siguen siendo
    de P4.** Meterlos aquí sí sería alcance nuevo y ensuciaría el diff, que es justo lo que hace
    verificable la fase.
  - Por tanto **ningún criterio cambia y no hace falta fila de Decision Log**. Lo que sí hice fue
    escribir en el prompt, explícito, que **las bajas de diagnósticos son un aprobado y no una
    desviación** — D8.4 prohíbe diagnósticos *nuevos*, no premia conservarlos. Sin esa frase, un
    ejecutor prudente vería `handler.ts` bajar de 11 y creería haber roto algo.
- **LOS DOS RIESGOS QUE EL PROMPT LLEVA POR DELANTE**, porque son las dos formas realistas de
  romper los goldens sin darse cuenta:
  - **Aliasing.** `activeHosts` y `waitlistHosts` son `slice()` de `hostStatus`: copian el array,
    **no los elementos**, y el segundo pase muta a través de ellos. Una extracción que rehaga los
    objetos deja la redistribución invisible en `hostStatus`. El test 6 es el que lo caza y el
    prompt pide escribirlo pronto.
  - **La secuencia de `pick`.** `shuffle` se llama en cuatro sitios y **solo dos se van**: los de
    comida (`:375`, `:399`) se quedan hasta P4. `shuffle` tiene que exportarse desde `matching.ts`
    e importarse en `handler.ts` —**una sola implementación**, porque los goldens 5 y 6 comparan
    contra una reimplementación local (`handler_test.ts:85`) y dos copias de la real podrían
    derivar en silencio—. Cualquier cambio en el número u orden de llamadas a `pick` mueve la
    salida.
- Prompt escrito y **commiteado** en `prompts/P3b-r1.md`, en `feat/mesa-md-seam`, para que entre
  en `main` con el merge y el ejecutor lo encuentre donde su propio prompt le dice — el coste de
  búsqueda que pagaron los tres redespachos de P3a.
- TESTS: `deno test --allow-all --no-check .` → 438/0 (línea base, verificada por mí). Ninguna
  ejecución de fase todavía.
- FINDINGS RAISED: ninguno — no hay trabajo de ejecutor que juzgar.
- DECISIONS: ninguna que toque el plan. B-08 aclarada arriba **sin** enmienda.
- BACKLOG: sin cambios. B-05, B-06, B-07, B-08, B-09, B-10 abiertos. **B-06 antes de P8.**
- OPEN AFTER THIS ROUND: (1) **Merge de `feat/mesa-md-seam` a `main`** — decisión explícita de
  Brent; fast-forward posible y ensayado limpio. **Único bloqueo.** (2) Verificar
  `git show origin/main:docs/plan/upgrade/PLAN.md | grep -c 'P3a | Seam.*DONE'` → `1`.
  (3) Solo entonces, `/exec UPGRADE P3b r1`.
