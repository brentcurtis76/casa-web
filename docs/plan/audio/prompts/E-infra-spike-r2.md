SESSION: AUDIO · E-infra-spike · r2 · EXEC

You are the executor for AUDIO (autopublicación del podcast CASA), phase `E-infra-spike`
round 2. You have no prior context. Everything you need is below or in the repo.

**Ronda de remediación.** La r1 midió bien y su verdicto —**ruta A viable**— sobrevive entero.
Codex la revisó y devolvió **FAIL con 3 BLOCKING**. Ninguno dice que midieras mal; los tres dicen
que **el bloque de plan que dejaste no es ejecutable todavía**. Esta ronda arregla el documento,
no la medición.

**Sigues sin escribir código de producción.** El entregable es el mismo `.md`, corregido.

---

## DÓNDE VIVE TODO

El plan de AUDIO **no está en `main`**. Vive sólo en la rama `docs/plan-audio`:

```bash
git show docs/plan-audio:docs/plan/audio/evidence/E-infra-spike.md   # tu documento (534 líneas)
git show docs/plan-audio:docs/plan/audio/PLAN.md                     # §5 y "Phase E-infra-impl"
git show docs/plan-audio:docs/plan/audio/LEDGER.md                   # últimas 3 entradas
```

**Trabajas en un worktree de `docs/plan-audio`** y commiteas ahí:

```bash
git worktree add /tmp/wt-plan docs/plan-audio
```

**Para medir**, un worktree desechable de **`main @ 165e5f2`** (¡ya no `6d45f35`!):

```bash
git worktree add --detach /tmp/wt-m 165e5f2
ln -s "$(git rev-parse --show-toplevel)/node_modules" /tmp/wt-m/node_modules
```

---

## QUÉ CAMBIÓ BAJO TUS PIES DESDE LA r1 — léelo antes de tocar nada

**`main` ya no es `6d45f35`. Es `165e5f2`, y ese commit hace dos de las siete cosas que tu §S8
mandaba hacer.** Brent pidió el arreglo de F1 directamente y se mergeó fuera del ciclo de fases.
`165e5f2` toca un solo fichero, `supabase/config.toml`, y:

1. **borra `[functions.generate-graphic]`** — el arreglo de F1;
2. **fija los puertos** `[api] 54331`, `[db] 54332/54333`, `[studio] 54334`, `[local_smtp] 54335`,
   `[analytics] 54337` — exactamente los que mediste.

Verifícalo tú:

```bash
git show 165e5f2 --stat
git show 165e5f2:supabase/config.toml | tail -25
```

**Tus mediciones de la r1 siguen siendo válidas para el árbol sobre el que las tomaste
(`6d45f35`). No las reescribas ni finjas que se tomaron en `165e5f2`.** Lo que hay que actualizar
es el **bloque de plan §S8**, que le habla a un ejecutor futuro y por tanto tiene que describir el
mundo tal como estará cuando él llegue.

---

## LOS TRES BLOCKING

### B1 — la guarda que especificaste no garantiza lo que promete. **Es el importante.**

Tu §S5 propone rechazar la URL si **contiene `mulsqxfhxxdsadxsljss`**. Eso es una lista negra de un
solo elemento, y deja pasar:

- un hostname productivo propio (p. ej. `db.anglicanasanandres.cl`),
- **otro proyecto Supabase remoto** cualquiera,
- **el proyecto local ajeno en `127.0.0.1:54321`** — precisamente el que este plan protege por
  escrito.

Y hay un agujero peor, que **anula la guarda entera**:

```
playwright.config.ts:46 →  reuseExistingServer: !process.env.CI
```

En local `CI` no está definida, así que vale **`true`**: si ya hay un servidor escuchando en
`http://localhost:8080`, **Playwright se engancha a ése y nunca lanza `npm run dev`**. Ese servidor
pudo arrancarse en otra terminal sin ninguna variable de test — es decir, **con el fallback a
producción horneado dentro**. Tu guarda vive en el proceso de Playwright y comprueba *sus* variables,
que serían correctas; el navegador, mientras tanto, habla con producción. **La guarda pasa y los
tests escriben en la base compartida con Life OS.** Es el escenario normal de trabajo de Brent, no
un caso rebuscado: tener `npm run dev` abierto es lo habitual.

**Lo que §S5 y §S8 deben especificar en su lugar** (esto es dirección de diseño del PM; tú lo mides
y lo aterrizas):

- **Lista blanca, no lista negra.** El endpoint permitido se declara explícitamente
  (el stack local en `54331`), y **cualquier otra cosa aborta**, incluido `54321`.
- **Cerrar el agujero de reutilización.** Elige y justifica con medición: `reuseExistingServer:
  false`, y/o un **puerto dedicado de test** distinto de 8080 para que un `npm run dev` productivo
  abierto no pueda ser reutilizado jamás.
- **Comprobar el servidor real, no sólo el entorno del proceso.** Ya demostraste la técnica en la
  r1: `curl` al módulo transformado y leer la URL horneada. Esa comprobación es la única que
  distingue "mis variables están bien" de "el servidor al que apunto está bien".
- **Mutaciones que cubran los dos bypasses**, además de los tres casos que ya tenías:
  - **D)** un servidor productivo ya escuchando en el puerto de test → debe abortar;
  - **E)** URL apuntando al proyecto local **ajeno** (`127.0.0.1:54321`) → debe abortar.

**Demuestra D) midiendo, no razonando**: levanta un `npm run dev` sin variables, deja que ocupe el
puerto, y enseña qué hace hoy Playwright con `--list`. Salida cruda. **No ejecutes ningún spec.**

### B2 — §S8 le habla a un mundo que ya no existe

Tras `165e5f2`, tu §S8 sigue mandando borrar `generate-graphic`, añadir los puertos, commitear
`supabase/config.toml` y ofrecer su rollback. **Todo eso ya está hecho.** `PLAN.md` dice
explícitamente que **§S8 es el cuerpo de la fase** —no el ledger—, así que un ejecutor que lea §S8
haría trabajo ya entregado y se confundiría al no encontrar nada que borrar.

Arréglalo: **SHA padre `165e5f2`**; los puntos 1 y 2 salen de *Scope*, de *Definition of done* y de
*Rollback*, y quedan como **precondición ya verificada** (con su SHA). Lo que queda en la fase:
`seed.sql`, la guarda, `.env.test.example`, el e2e de humo y la documentación de arranque.

### B3 — el seed y el test de humo se pisan, y al admin le falta un rol

Tres cosas sin cerrar, y un ejecutor tendría que inventárselas:

1. **¿Quién siembra qué?** §S8.3 le da a `seed.sql` filas de liturgia/episodio, y §S8.6 le da al
   test de humo sembrar sus propias filas deterministas y limpiarlas. **Separa los dos conjuntos**:
   IDs de *baseline* (los pone el seed, nadie los borra) contra IDs *propiedad del test* (los pone
   y los borra el test), con rangos de UUID distintos y reconocibles.
2. **I6 dice "deja la tabla como la encontró"** sin decir si eso incluye las filas del baseline.
   Escríbelo sin ambigüedad.
3. **El admin sintético no basta con `auth.users`.** Medido por Codex y **confirmado por el PM en
   el código**: `is_liturgia_admin(user_id)` es
   `EXISTS (SELECT 1 FROM mesa_abierta_admin_roles WHERE user_id = …)`
   (`20260106000000_liturgias_antifonales.sql:64-72`). Un usuario sembrado sólo en `auth.users`
   **inicia sesión pero no es admin**. El seed tiene que poner también su fila en
   `mesa_abierta_admin_roles`. Compruébalo tú y pega la salida.

Y **congela el viaje del test de humo**: ruta, acciones, aserciones, IDs de fixture y contrato
exacto de limpieza (pre-estado y post-estado). Hoy `smoke-local.spec.ts` es un nombre sin
comportamiento.

---

## LOS SHOULD-FIX Y EL NIT (todos aceptados)

- **[S1]** `evidence:105-110` — sustituye el grep inválido. `grep -rn 'grant .* to .*anon'` da 0
  **por sensibilidad a mayúsculas**, no por ausencia. El repo tiene **6 sentencias `GRANT`
  reales**, todas `GRANT EXECUTE ON FUNCTION`, ninguna de tabla — verificado por el PM con
  `grep -rn -i "^[[:space:]]*GRANT "`. **La conclusión de F2 es correcta; la prueba impresa no.**
  Pon la consulta a `role_table_grants` como prueba principal.
- **[S2]** §S3 sólo ejercita `anon` y no consulta `liturgia_elementos`. Añade `authenticated` y las
  tres tablas, con salida cruda.
- **[S3]** `GRANT … ON ALL TABLES` no alcanza a los objetos creados después. Añade
  `ALTER DEFAULT PRIVILEGES` o exige resembrar. **Y corrige de paso al PM:** mi ledger dice que
  "cualquier migración futura" rompería el entorno; Codex midió que un `db reset` completo corre
  migraciones **antes** del seed y por tanto lo repara. **El caso roto es la migración incremental,
  no el reset.** Escríbelo con esa precisión.
- **[S4]** `evidence:326-330` afirma categóricamente que una rama de Supabase no incluiría las
  tablas de Life OS. **No creaste ninguna rama: eso es inferencia, no medición** — el defecto que
  este plan lleva seis rondas persiguiendo. Márcalo como desconocido o bórralo; la ruta B ya está
  cerrada por innecesaria.
- **[N1]** "nadie lo había medido porque nadie levantaba el stack" es una explicación histórica sin
  medir. Lo medido es que estaba roto desde `55ce9c7`. Sepáralo.

---

## EXPLÍCITAMENTE FUERA DE ALCANCE

- **No escribas la guarda, el seed, el `.env.test.example` ni el e2e.** Siguen siendo
  `E-infra-impl`. Esta ronda **los especifica**; no los construye.
- **No ejecutes ningún spec de `tests/e2e/`.** `--list` sí; correr tests no.
- **Nada contra el proyecto remoto**: ni `db push`, ni `db reset --linked`, ni `link`, ni
  `execute_sql`/`apply_migration` que no sea `SELECT`. Base compartida con Life OS.
- **No toques el proyecto ajeno `sxlogxqzmarhqsblxmtj`** (54321-54324, 54327). Los 11 contenedores
  siguen vivos al terminar y lo demuestras con `docker ps`.
- **No crees ramas de Supabase.**
- **No reescribas las mediciones válidas de la r1** ni las re-atribuyas a otro SHA.
- No commitees ficheros fuente.

---

## ACCEPTANCE CRITERIA

- [R1] **B1 cerrado**: §S5 y §S8 especifican guarda por **lista blanca**, cierre del agujero de
      `reuseExistingServer`, y verificación del **servidor real** además del entorno del proceso.
- [R2] **B1 medido**: salida cruda del bypass D) —servidor productivo ya escuchando, Playwright
      enganchándose— tal como se comporta **hoy**, sin guarda. Y el caso E) especificado.
- [R3] **B2 cerrado**: §S8 pinchado a `165e5f2`; puntos 1 y 2 fuera de scope/DoD/rollback y
      convertidos en precondición verificada con SHA.
- [R4] **B3 cerrado**: baseline vs. fixtures del test separados por rango de UUID; I6 sin
      ambigüedad; seed del admin **con su fila en `mesa_abierta_admin_roles`**, comprobado y con
      salida cruda; viaje del test de humo congelado (ruta, acciones, aserciones, pre/post-estado).
- [R5] S1-S4 y N1 aplicados.
- [R6] **Las mediciones válidas de la r1 quedan intactas**, cada una con el SHA sobre el que se
      tomó. El documento distingue sin ambigüedad qué se midió en `6d45f35` y qué en `165e5f2`.
- [R7] Limpieza: `docker ps` final con los 11 contenedores ajenos vivos; worktrees borrados.

---

## RULES

- **Comando + salida cruda + SHA.** Siempre. Un nombre de rama no identifica un árbol.
- **Sin evidencia → "no medido".** Nunca inferido. S4 y N1 existen exactamente por esto.
- Salida cruda sin editar; si redactas un secreto, decláralo como hiciste en la r1.
- No amplíes el alcance. Lo que veas roto fuera de alcance va en `NOT DONE / OPEN`.
- Todo el texto en **español**.
- **GATE D18: no aplica** — la fase no modifica ficheros fuente. No finjas una corrida verde.
- Si concluyes que un BLOCKING de Codex está equivocado, **dilo y demuéstralo con una medición**.
  Discrepar con evidencia es correcto; obedecer sin ella, no.

---

## WHEN DONE

1. Actualiza `docs/plan/audio/evidence/E-infra-spike.md`.
2. Añade tu entrada de ronda a `docs/plan/audio/LEDGER.md`.
3. Commitea ambos en **`docs/plan-audio`**.
4. Emite exactamente este informe:

```markdown
## EXECUTOR REPORT — E-infra-spike round 2
STATUS: COMPLETE | BLOCKED | FINDINGS
CONTEXT PRESSURE: comfortable | tight | ran out — <una línea>
BRANCH: docs/plan-audio   COMMITS: <sha…>
FILES CHANGED: <path (+x/-y) …>
WHAT I DID: <viñetas, una por criterio R1-R7>
TEST COMMAND: n/a — unidad de medición; ver GATE
TEST OUTPUT: n/a
ACCEPTANCE CRITERIA: <R1-R7: met / not met / partially — con razón>
BLOCKING DE CODEX: <B1, B2, B3: cerrado / no cerrado — con dónde se ve>
DEVIATIONS FROM PROMPT: <o "none">
ASSUMPTIONS MADE: <o "none">
NOT DONE / OPEN:
```
