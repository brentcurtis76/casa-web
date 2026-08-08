SESSION: AUDIO · E-infra-spike · r1 · EXEC

You are the executor for AUDIO (autopublicación del podcast CASA), phase `E-infra-spike`
round 1. You have no prior context. Everything you need is below or in the repo.

**Esta unidad NO escribe código de producción. Es una MEDICIÓN.** Su entregable es un
documento de evidencia. `STATUS: FINDINGS` es un resultado legítimo y esperado, no un fallo.

---

## DÓNDE VIVE EL PLAN (léelo antes de nada, y no lo busques a ciegas)

El plan de AUDIO **no está en `main`**. Vive sólo en la rama `docs/plan-audio`:

```bash
git show docs/plan-audio:docs/plan/audio/PLAN.md    # 2041 líneas — lee §4 (gates) y la sección "Phase E-infra-spike"
git show docs/plan-audio:docs/plan/audio/LEDGER.md  # historial de rondas
```

No hace falta que leas las 2041 líneas. Lo que gobierna esta ronda está inline abajo.

---

## DÓNDE TRABAJAS (dos árboles, a propósito)

Esta unidad **no produce cambios de código**, así que **no se crea rama `phase/`**.

1. **Para medir**, usa un worktree DESECHABLE de `main @ 6d45f35a54bde0335d05ffd6943167cf25d0a09e`.
   Ahí puedes editar `supabase/config.toml`, arrancar contenedores y romper lo que quieras.
   **Ese worktree se borra al final y nada de él se commitea.**

   ```bash
   git worktree add --detach /tmp/wt-einfra 6d45f35
   ln -s "$(git rev-parse --show-toplevel)/node_modules" /tmp/wt-einfra/node_modules
   ```

2. **Para entregar**, un worktree de `docs/plan-audio`, donde vive `docs/plan/audio/`:

   ```bash
   git worktree add /tmp/wt-plan docs/plan-audio
   ```

   Ahí escribes `docs/plan/audio/evidence/E-infra-spike.md` y tu entrada de ledger, y
   **commiteas en `docs/plan-audio`**. Es la misma pauta que siguió E2 (su entrada de
   ledger se commiteó en esa rama, `0587816`).

**Ojo:** `docs/plan-audio` divergió de `main` antes de que aterrizaran los gates y E2.
**No midas nada en ese árbol** — no tiene `scripts/gates/` ni el código de E2. Mide siempre
en el worktree de `6d45f35`.

---

## POR QUÉ EXISTE ESTA UNIDAD

`E-infra` estaba redactada como una sola fase que mezclaba una medición con una
implementación desconocida. Codex r10/S3 lo marcó y el plan aceptó partirla en dos:
**`E-infra-spike`** (esto: medir, con `FINDINGS` como salida legítima) y **`E-infra-impl`**
(redactada *después*, con lo que tú midas). El PM anterior había escrito "Postgres local
disponible — verificado" sin ejecutar una sola comprobación; era falso, y es la tercera vez
en este plan que alguien colocó una inferencia dentro de una sección titulada "medido".

**Regla de evidencia vigente en este plan, y va en serio:** toda afirmación de estado del
entorno se anota con **el comando, su salida cruda y el SHA exacto sobre el que corrió —
nunca el nombre de una rama.** Este repo lo comparten sesiones concurrentes y el checkout
cambia de rama bajo los pies; ya hubo cuatro mediciones atribuidas al árbol equivocado por
nombrar la rama en vez del SHA. Si no puedes citar el SHA, no es una medición.

---

## ESTADO MEDIDO QUE TE ENTREGO (no lo re-derives; verifícalo si dudas)

Todo lo de abajo lo midió el PM en `main @ 6d45f35a54bde0335d05ffd6943167cf25d0a09e`,
árbol limpio, el 2026-08-08.

| Hecho | Comando | Salida |
|---|---|---|
| CLI de Supabase | `supabase --version` | `2.110.0` |
| Stack ajeno corriendo | `docker ps` | 11 contenedores `*_sxlogxqzmarhqsblxmtj`, ocupando **54321** (kong/api), **54322** (db), **54323** (studio), **54324** (inbucket), **54327** (analytics) |
| Puertos 54300-54399 ocupados | `lsof -nP -iTCP -sTCP:LISTEN` | sólo esos cinco, todos de Docker |
| `supabase/config.toml` | `grep '^\[' supabase/config.toml` | **sólo `[functions.*]`**. No hay `[db]`, `[api]`, `[studio]`, `[inbucket]`, `[analytics]`. 35 líneas. `project_id = "mulsqxfhxxdsadxsljss"` |
| Migraciones | `ls supabase/migrations/*.sql \| wc -l` | **61** |
| Ficheros de entorno | `ls .env*` | **sólo `.env.example`**. No hay `.env` ni `.env.test` |
| `.env.test` en `.gitignore` | `.gitignore:18` | **está ignorado** — la plantilla commiteable necesita otro nombre |
| Cliente de la app | `src/integrations/supabase/client.ts:5-6` | cae por defecto a `https://mulsqxfhxxdsadxsljss.supabase.co` con la anon key de **producción**, hardcodeadas |
| Playwright | `playwright.config.ts` | `testDir: './tests/e2e'`, `baseURL: 'http://localhost:8080'`, `webServer.command: 'npm run dev'`, y carga `.env.test` **sólo si existe** |
| Suite e2e existente | `ls tests/e2e/*.spec.ts` | **16 specs** (financial-\*, rbac, recorder, mesa-abierta, liturgy-children, downscale-image) |
| ¿Los e2e llaman a Supabase directo? | `grep -rn '\.insert(\|\.update(\|\.delete(\|\.upsert(' tests/e2e/` | **0 coincidencias.** Manejan la UI; quien escribe es el cliente de la app |
| Login de los e2e | `tests/e2e/helpers/auth.ts` | usa `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` contra el formulario real de la app |
| Vitest | `vitest.config.ts` | excluye `tests/e2e/**`; los unitarios son jsdom y no tocan DB |
| API de branches | `mcp__supabase-casa__list_branches` | `{"branches":[]}`. La llamada **responde**; eso no prueba que `create_branch` esté permitido ni que sea gratis |
| Runtimes | `node --version` / `deno --version` | `v22.22.0` / `2.7.11` |

### El hallazgo que cambia la urgencia

El plan describía el riesgo en condicional: *"la E3b de la r9 habría mandado a un ejecutor a
crear filas sintéticas contra la base de producción"*. **Ya no es condicional.**
`npx playwright test` es un gate de calidad declarado en `CLAUDE.md`; hay 16 specs; arrancan
la app con `npm run dev`; `client.ts` cae a producción; y `auth.ts` inicia sesión **como
admin**. Con las credenciales puestas, la suite que ya existe se ejecuta hoy contra la base
de **producción compartida con Life OS**. Mídelo y déjalo escrito con esa claridad.

---

## SCOPE — qué mides

**Ruta A — stack local en puertos libres.** ¿Puede arrancar el stack de *este* proyecto
mientras el ajeno (`sxlogxqzmarhqsblxmtj`) ocupa 54321-54324 y 54327?

**Ruta B — branch de Supabase.** Sólo **preconditions y costo**. No la crees.

**La guarda anti-producción.** Sólo **dónde va y cómo se prueba**. No la implementes.

**El bloque de plan para `E-infra-impl`**, redactado con lo que hayas medido.

---

## EXPLÍCITAMENTE FUERA DE ALCANCE

- **NO detengas, reconfigures ni toques el proyecto ajeno `sxlogxqzmarhqsblxmtj`.** Es de
  otro proyecto. Si la ruta A exige apagarlo, la ruta A **no es viable** y eso es el
  resultado: se reporta, no se fuerza.
- **NO crees un branch de Supabase.** Cuesta dinero y es decisión de Brent (criterio S4).
- **NO ejecutes `npx playwright test` ni `npm run test:e2e`.** Hoy apuntan a producción.
- **NO ejecutes NADA contra el proyecto remoto.** Prohibidos en particular:
  `supabase db reset --linked`, `supabase db push`, `supabase link`, `supabase migration up
  --linked`, y cualquier `execute_sql` / `apply_migration` de MCP que no sea un `SELECT`.
  La base es **compartida con Life OS** y el plan sólo admite migraciones aditivas.
- **NO implementes** la guarda, el seed, el cleanup ni el e2e de humo. Eso es `E-infra-impl`.
- **NO commitees** cambios en `supabase/config.toml`, `.env*`, `client.ts`, `playwright.config.ts`
  ni ningún fichero fuente. El worktree de medición se borra entero.
- **NO migres ni toques los 16 specs existentes.**

---

## ACCEPTANCE CRITERIA — cada uno verificable por separado

- [S1] **Ruta A, arranque.** Delta exacto de `config.toml` (puertos elegidos y por qué están
      libres), comando exacto, **salida cruda** de `supabase start` y tiempo de arranque.
      Si falla, el error verbatim. Medido en el worktree de `6d45f35`.
- [S2] **Ruta A, migraciones.** Si S1 arranca: ¿aplican limpias las 61? Salida cruda de
      `supabase db reset` (local, **nunca `--linked`**). Si alguna falla, **nómbrala** y pega
      el error entero.
- [S3] **Ruta A, esquema utilizable.** Si S2 pasa: demuestra con salida cruda que existen
      `church_podcast_episodes`, `liturgias` y `liturgia_elementos` en el stack local, y que
      un cliente anon/authenticated puede leerlas bajo su RLS.
- [S4] **Ruta B, sólo preconditions.** Plan del proyecto, si `create_branch` está permitido,
      **costo por hora/día**, y el comando exacto que la crearía. **No la crees** — va como
      FINDINGS para que decida Brent.
- [S5] **Guarda anti-producción: punto de inserción y prueba.** Nombra el/los `fichero:línea`
      exactos donde debe vivir para que Playwright **falle ruidosamente** si la URL apunta a
      `mulsqxfhxxdsadxsljss`, y la **mutación exacta** que lo probaría. Cubre que hoy la URL
      llega por tres vías: `VITE_SUPABASE_URL`, el fallback hardcodeado de `client.ts:5` y
      `.env.test` cargado por `playwright.config.ts`. No escribas la guarda.
- [S6] **Plantilla de entorno.** `.env.test` está en `.gitignore:18`. Nombra el fichero
      commiteable, sus variables y qué valor lleva cada una (sin secretos).
- [S7] **Seed y cleanup.** Con la(s) ruta(s) que resulten viables, di si admiten IDs
      sintéticos deterministas y limpieza, y a qué costo. Si ninguna ruta es viable, dilo.
- [S8] **Bloque de plan para `E-infra-impl`**, redactado a partir de S1-S7: scope,
      out-of-scope, criterios (≤15 líneas), test plan, definition of done y rollback.
      Si S1-S4 demuestran que **no hay** ruta viable, entonces S8 es una **recomendación con
      opciones y su costo**, no un bloque de implementación fingido.

---

## TESTS

**No escribes tests en esta ronda.** La verificación es la evidencia cruda de S1-S7.

**GATE (D18): no aplica, y la razón importa.** El gate se mide sobre los ficheros fuente que
la fase modifica o crea; esta fase **no modifica ninguno** — su único entregable es un `.md`.
No inventes una corrida de gate ni la declares verde. Dilo así en el informe.

---

## RULES

- **Medición, no construcción.** Si te descubres escribiendo código de producción, has salido
  del alcance: párate y anótalo.
- **Sin evidencia → "no medido".** Nunca inferido, nunca deducido de que "el CLI está
  instalado". Ése es literalmente el error que creó esta unidad.
- **Comando + salida cruda + SHA.** Toda afirmación de entorno lleva las tres cosas. Un
  nombre de rama no identifica un árbol.
- **Salida cruda sin editar.** No resumas la salida de `supabase start` ni de `db reset`.
- No amplíes el alcance. Si ves algo roto fuera de alcance, va en `NOT DONE / OPEN`.
- Todo el texto entregable en **español** (regla dura del proyecto).
- `STATUS: FINDINGS` es correcto si mides que ninguna ruta es viable. **Reportarlo es el
  éxito.** Forzar una ruta apagando contenedores ajenos o tocando producción es el fallo.
- Si te quedas sin contexto, dilo en `CONTEXT PRESSURE` — sirve para dimensionar futuras fases.

---

## LIMPIEZA OBLIGATORIA AL TERMINAR

```bash
supabase stop --project-id <el-de-este-proyecto>   # sólo el tuyo, JAMÁS el ajeno
docker ps                                          # pega la salida: los 11 contenedores de
                                                   # sxlogxqzmarhqsblxmtj deben seguir vivos
git worktree remove /tmp/wt-einfra --force
```

La salida de ese `docker ps` final es un entregable: demuestra que no tocaste el proyecto ajeno.

---

## WHEN DONE

1. Escribe `docs/plan/audio/evidence/E-infra-spike.md` con toda la evidencia cruda de S1-S8.
2. Añade tu entrada de ronda a `docs/plan/audio/LEDGER.md`.
3. Commitea ambos en **`docs/plan-audio`**.
4. Emite exactamente este informe:

```markdown
## EXECUTOR REPORT — E-infra-spike round 1
STATUS: COMPLETE | BLOCKED | FINDINGS
CONTEXT PRESSURE: comfortable | tight | ran out — <una línea: ¿en qué punto?>
BRANCH: docs/plan-audio   COMMITS: <sha…>
FILES CHANGED: <path (+x/-y) …>
WHAT I DID: <viñetas, una por criterio, cada una mapeada a su ID>
TEST COMMAND: n/a — unidad de medición; ver GATE arriba
TEST OUTPUT: n/a
ACCEPTANCE CRITERIA: <ID: met / not met / partially — con razón>
RUTA VIABLE: A | B | ninguna — <una línea con la evidencia que lo decide>
DEVIATIONS FROM PROMPT: <o "none">
ASSUMPTIONS MADE: <o "none">
NOT DONE / OPEN:
```
