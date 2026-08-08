SESSION: AUDIO · E-infra-impl · r1 · EXEC

You are the executor for AUDIO (autopublicación del podcast CASA), phase `E-infra-impl` round 1.
You have no prior context. Everything you need is below or in the repo.

**Esta unidad SÍ escribe código.** Construye el entorno de pruebas local y **la guarda que impide
que los e2e escriban en la base de producción compartida con Life OS**. Es la primera vez en este
plan que se toca el harness de tests.

---

## DÓNDE VIVE EL PLAN

El plan de AUDIO **no está en `main`**. Vive sólo en la rama `docs/plan-audio`:

```bash
git show docs/plan-audio:docs/plan/audio/PLAN.md                     # busca "Phase E-infra-impl": ES TU CONTRATO
git show docs/plan-audio:docs/plan/audio/evidence/E-infra-spike.md   # las mediciones: §S5.3, §S5.4, §S6, §S7
```

**El contrato es la sección `Phase E-infra-impl` de `PLAN.md`.** El documento de evidencia es el
**registro de lo que se midió** — lo citas, no lo obedeces si contradice a `PLAN.md`. (Su §S8 quedó
obsoleto a propósito; `PLAN.md` lo dice.)

Lee de la evidencia, sí o sí: **§S5.3** (las tres capas de la guarda), **§S5.4** (los cinco casos de
mutación), **§S6** (las variables), **§S7** (rangos de UUID y el viaje del humo congelado).

---

## RAMA Y SHA PADRE

```bash
git checkout main && git pull
git rev-parse HEAD          # ← ANOTA ESTE SHA. Es tu SHA padre. Va en el ledger y en el informe.
git checkout -b phase/E-infra-impl
```

`phase/E-infra-impl` son 19 caracteres: dentro del límite de 20 por DNS de Vercel.

**No fijes `165e5f2`.** El plan decide explícitamente ramificar del `main` vigente. **Y mide `N`,
el número de migraciones, sobre TU SHA** — a `165e5f2` eran 61, a `981c00f` son 62. Tu criterio es
`N/N`, no `61/61`.

---

## PRECONDICIÓN YA ENTREGADA — no la rehagas

El hotfix `165e5f2` ya borró `[functions.generate-graphic]` de `supabase/config.toml` y fijó los
puertos (`[api] 54331`, `[db] 54332/54333`, `[studio] 54334`, `[local_smtp] 54335`,
`[analytics] 54337`). **Si buscas ese bloque para borrarlo no lo encontrarás: es lo esperado.**

```bash
git show main:supabase/config.toml | grep -c "generate-graphic"   # → 0
```

---

## CUATRO TRAMPAS YA MEDIDAS. Léelas antes de tocar nada; te ahorran horas.

- **F3 — `supabase start` restaura el backup anterior.** Un `start` a secas te enseña permisos de
  una corrida pasada y te hará "refutar" F2 por accidente. **Antes de cualquier medición de
  permisos, `supabase db reset`.** Sólo el reset da estado derivado del árbol.
- **F4 — un `INSERT` en `auth.users` no produce un usuario que pueda iniciar sesión.** Da HTTP 500
  y GoTrue dice `converting NULL to string is unsupported` en `confirmation_token`. **Pon los cuatro
  campos de token a `''`** y el login devuelve `access_token`. No hace falta fila en
  `auth.identities`.
- **F2 — las migraciones no otorgan privilegios de tabla.** Sin `GRANT`, toda lectura por PostgREST
  da 401 `42501`. El esquema depende de un estado ambiente del proyecto alojado que el stack local
  no reproduce. Van en `seed.sql`.
- **`vite` cambia de puerto en silencio.** `vite.config.ts` declara `port: 8080` y **no** declara
  `strictPort`, así que si el puerto está ocupado se va al siguiente sin avisar. **`--strictPort` es
  obligatorio** en el servidor de test.

---

## SCOPE

1. **`supabase/seed.sql`** — los `GRANT` de F2, el baseline sintético (rango `…-9000-…`) y el
   usuario admin (con los tokens de F4).
2. **La guarda anti-producción en tres capas** (evidencia §S5.3):
   - **Capa 1**, en `playwright.config.ts` **después de la línea 21 y antes de la 23**: exige que
     `VITE_SUPABASE_URL` **esté en una lista blanca explícita** (`http://127.0.0.1:54331` y
     `http://localhost:54331`, nada más) y que `VITE_SUPABASE_ANON_KEY` esté definida. **Lista
     blanca, no lista negra**: cualquier otro valor aborta, incluido el proyecto local ajeno de
     `54321`. `throw` con mensaje en español nombrando la variable y el valor rechazado.
   - **Capa 2**: `reuseExistingServer: false` **siempre** (no `!process.env.CI`) **y** puerto de
     test dedicado distinto de 8080 con `--strictPort`.
   - **Capa 3**: un `globalSetup` que haga `GET <baseURL>/src/integrations/supabase/client.ts`,
     extraiga el objeto `import.meta.env = {…};` **inyectado por Vite** y exija que la URL esté en la
     lista blanca y la clave presente. **No leas la línea `const SUPABASE_URL = …`: es texto fuente
     y sale idéntica apunte el servidor a donde apunte.** Ése fue un error de la r1 del spike.
3. **`.env.test.example`** con las cuatro variables de §S6. **`.env.test` real NUNCA se commitea**
   (está en `.gitignore:18`).
4. **`tests/e2e/smoke-local.spec.ts`** — el viaje de siete pasos congelado en §S7.
5. **La bandera de la enmienda 2** (abajo).
6. **Documentar el arranque** donde el repo ya documenta sus gates.

## EXPLÍCITAMENTE FUERA DE ALCANCE

- Migrar o tocar los **14 ficheros de spec existentes**.
- Crear ramas de Supabase.
- `pg_cron` local y el camino de recordatorios de WhatsApp (la extensión no está en la imagen).
- La columna `slug` y su trigger (D12) — es de E3a/E3b.
- **Detener o reconfigurar el proyecto ajeno `sxlogxqzmarhqsblxmtj`** (54321-54324, 54327).
- **Cualquier escritura contra el proyecto remoto**: `db push`, `db reset --linked`, `link`, o
  `execute_sql`/`apply_migration` que no sea `SELECT`.

---

## LAS DOS ENMIENDAS OBLIGATORIAS — nacen del FAIL 2/2 de Codex

### Enmienda 1 — el admin sembrado NO puede llegar a `/admin/roles`

Medido por Codex, **confirmado por el PM en el árbol**:

```
src/appRoutes.tsx:55
  { path: "/admin/roles", element: <ProtectedRoute requires={{ role: 'general_admin' }}>…
```

`general_admin` vive en el RBAC de CASA (`church_roles` / `church_user_roles`,
`20260209000000_casa_rbac_schema.sql`). El seed llena **`mesa_abierta_admin_roles`**, que es **otra
tabla**. Un usuario con `super_admin` de Mesa da `is_liturgia_admin = t` **y aun así no llega a esa
ruta**. Que `rbac.spec.ts:86` exista no lo desmiente: ese spec asume un `general_admin` de CASA.

**Elige UNA salida y demuéstrala de extremo a extremo con salida cruda:**
- **(a)** sembrar además la asignación en `church_user_roles` contra la fila `general_admin` de
  `church_roles`, y quedarte con `/admin/roles`; **o**
- **(b)** elegir una ruta que `mesa_abierta_admin_roles` **sí** autorice, y decir cuál y por qué.

Mide antes de elegir. **No des por autorizada una ruta porque exista un test que la visita.**

### Enmienda 2 — sin una bandera, dos mutaciones no pueden fallar

```
playwright.config.ts:19 →  if (!process.env[key]) process.env[key] = val;
```

Con un `.env.test` presente —que esta fase **exige**— un `env -u VITE_SUPABASE_URL …` **se rellena
solo desde el fichero**. Codex lo midió: `B_EXIT=0`, `C_EXIT=0`; ambos listaron tests en vez de
abortar.

**Añade una bandera** —`E2E_NO_ENV_FILE=1` que salte el bloque de carga, o `E2E_ENV_FILE` apuntando
a una ruta inexistente— y **ejecuta los casos B) y C) con ella puesta**.

---

## ACCEPTANCE CRITERIA

- [ ] I1 `supabase start` arranca sobre el árbol de la fase sin editar nada a mano; salida cruda.
- [ ] I2 `supabase db reset` aplica **N/N** sin error, con **N medido sobre tu SHA padre**; salida
      cruda. **`db reset` antes de cualquier medición de permisos** (F3).
- [ ] I3 Tras el seed, `anon` y `authenticated` leen **200** por PostgREST sobre
      `church_podcast_episodes`, `liturgias` y `liturgia_elementos`, y `anon` ve sólo lo
      `published`; salida cruda.
- [ ] I4 Los cinco casos de mutación de §S5.4 (A-E) salen con código ≠ 0 y **sin** arrancar
      `webServer`; salida cruda de los cinco.
- [ ] I5 **B) y C) se ejecutan con la bandera de la enmienda 2** y salen con código ≠ 0.
- [ ] I6 El control **lista los specs** (`--list`) y el humo pasa. **No corras los 99 tests.**
- [ ] I7 **Enmienda 1 demostrada de extremo a extremo**, con salida cruda de la autorización.
- [ ] I8 El humo deja la tabla en el baseline exacto: borra **sólo** el rango `8000`, nunca el
      `9000`.
- [ ] I9 Los 11 contenedores de `sxlogxqzmarhqsblxmtj` siguen vivos al terminar; `docker ps`.
- [ ] I10 **Gate D18 verde** sobre los ficheros que la fase toca.

---

## GATE D18 — esta vez SÍ aplica

Tocas ficheros fuente, así que el gate se mide. Procedimiento (§4 del plan):

```bash
# base, en un worktree desechable de TU SHA PADRE + symlink a node_modules
bash scripts/gates/changed-files-diagnostics.sh <fichero> [<fichero> …]
# lo mismo en HEAD, y se comparan MENSAJES CRUDOS COMPLETOS
npm run build      # verde absoluto, no delta
npx vitest run --no-file-parallelism
```

**Regla de clasificación (`scripts/gates/README.md`), y en esta fase importa:** *desplazamiento de
línea* —mismo mensaje, distinta línea— es **aceptable**; *diagnóstico nuevo* es **BLOQUEANTE**.
Vas a añadir líneas a `playwright.config.ts`, así que **espera desplazamientos y no los reportes
como delta**. Registra `node --version` y `deno --version`.

---

## RULES

- **Comando + salida cruda + SHA.** Siempre. Un nombre de rama no identifica un árbol: este repo lo
  comparten sesiones concurrentes y el checkout cambia de rama bajo los pies. Ya ha pasado tres
  veces en este plan.
- **Sin evidencia → "no medido".** Nunca inferido.
- **La prueba de que la guarda sirve es que FALLA.** Pega la salida de los cinco casos rojos, no
  sólo la del verde. Una aserción que no puede fallar es un defecto (D18).
- **NUNCA ejecutes `npx playwright test` sin la guarda puesta y sin las variables locales.** Hasta
  que la capa 1 exista, la suite apunta a producción.
- Cambios quirúrgicos. No refactorices de paso.
- Todo el texto de UI y de documento en **español**.
- Si los tests salen rojos, itera hasta 3 veces; si siguen rojos, `STATUS: BLOCKED` con el error
  real. **Nunca reportes un build rojo como completo.**
- Si descubres que el plan está equivocado: **para y reporta `STATUS: FINDINGS`.** Es el resultado
  correcto, no un fallo. Este plan ya lo ha usado con provecho dos veces.

## LIMPIEZA AL TERMINAR

```bash
supabase stop --project-id <el de este proyecto>   # sólo el tuyo, JAMÁS el ajeno
docker ps                                          # pega la salida: los 11 de sxlogxqzmarhqsblxmtj vivos
```

---

## WHEN DONE

Añade tu entrada de ronda a `docs/plan/audio/LEDGER.md` (worktree de `docs/plan-audio`), commitea el
código en `phase/E-infra-impl`, y emite exactamente este informe:

```markdown
## EXECUTOR REPORT — E-infra-impl round 1
STATUS: COMPLETE | BLOCKED | FINDINGS
CONTEXT PRESSURE: comfortable | tight | ran out — <una línea>
BRANCH: phase/E-infra-impl   SHA PADRE: <sha>   COMMITS: <sha…>
FILES CHANGED: <path (+x/-y) …>
WHAT I DID: <viñetas, una por criterio I1-I10>
ENMIENDA 1: <salida elegida (a) o (b), y por qué — con la evidencia>
TEST COMMAND: <verbatim>
TEST OUTPUT: <tail verbatim, sin editar>
GATE D18: <base vs HEAD, mensajes crudos; build; vitest; node/deno>
ACCEPTANCE CRITERIA: <I1-I10: met / not met / partially — con razón>
DEVIATIONS FROM PROMPT: <o "none">
ASSUMPTIONS MADE: <o "none">
NOT DONE / OPEN:
```
