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
