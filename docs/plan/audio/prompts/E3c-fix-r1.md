# EXEC — AUDIO · E3c-fix · r1

> **🔶 PROMPT HISTÓRICO — dos de sus afirmaciones quedaron refutadas el 2026-08-12** (Codex B1 sobre
> esta misma fase). Se conserva como registro de lo que se despachó; **no lo uses como estado actual.**
>
> 1. **§4 y §5 dan por hecho que las dos migraciones de WhatsApp «no están aplicadas».** Falso: sus
>    efectos están desplegados desde el **2026-06-12** (9 columnas, 3 índices y el cron
>    `wa_reminders_daily`, **activo**). Lo que falta es la **fila de historial**.
> 2. **§4 dice que `db push` a secas «aplicaría todas las pendientes» y desplegaría las de WhatsApp.**
>    Falso: **aborta** con `LegacyDbPushMissingRemoteError`. El comando peligroso es
>    **`--include-all`**, que las **reaplicaría**.
> 3. **§5 da por disponible el MCP `execute_sql` para escribir.** Falso: conecta como
>    `supabase_read_only_user`. Por eso `E3c.6` quedó **diferido** por decisión de Brent.
>
> Estado vigente: `PLAN.md` § `Phase E3c-fix` y `evidence/E3c-fix-whatsapp-drift.md`.

SESSION: `AUDIO · E3c-fix · EXEC`
RISK: **HIGH** — cambio de esquema sobre la base de producción, **compartida con Life OS**.

Eres el ejecutor de una sola fase. Esta conversación se queda abierta hasta que Codex dé `PASS`.

## 0. Instrucciones de proceso que gobiernan esta sesión

Lee y sigue, en este orden de precedencia:

1. `CLAUDE.md` del repo y `~/.claude/CLAUDE.md` — reglas duras.
2. **`~/.claude/agent-workflow/LEAN-WORKFLOW.md`** — overlay **ACTIVO** para todo worktree de
   `casa-web`.
3. `~/.claude/agent-workflow/AGENT-WORKFLOW.md` — SOP canónico.

## 1. Dónde trabajas — no lo deduzcas del nombre de la carpeta

**Dos checkouts, y hacen cosas distintas:**

| Para qué | Checkout | Rama |
|---|---|---|
| Ejecutar (CLI de supabase, gates, tests) | **crea** `/Users/brentcurtis/dev/casa-e3c` | `phase/E3c-fix`, cortada de `main` |
| Plan, ledger, evidencia, review | `/Users/brentcurtis/dev/casa-audio` (ya existe) | `docs/plan-audio` |

```bash
git -C /Users/brentcurtis/dev/casa-web worktree add -b phase/E3c-fix \
  /Users/brentcurtis/dev/casa-e3c db8ed2ead6b66708122491aef66a5ee38ae6b8bd
```

**SHA padre fijado: `db8ed2ead6b66708122491aef66a5ee38ae6b8bd`** (`main` = `origin/main` el
2026-08-12). No uses `git merge-base HEAD main`.

Confirma antes de tocar nada: `git rev-parse --show-toplevel`,
`git rev-parse --path-format=absolute --git-common-dir`, `git branch --show-current`,
`git status --short --branch`, `git worktree list`.

**El plan de AUDIO no está en `main`.** Vive sólo en `docs/plan-audio`. El worktree
`/Users/brentcurtis/dev/casa-audio` ya está creado para eso — úsalo, no muevas ningún otro checkout
de rama: este repo lo comparten varias sesiones a la vez.

Lee el contrato completo en `docs/plan/audio/PLAN.md`, sección **`## Phase E3c-fix`**, y la
evidencia del PM en `docs/plan/audio/evidence/E3c-fix-drift.md`. Este prompt no lo sustituye.

## 2. Qué está roto, y ya está medido

`E3b` está mergeada y desplegada. La página pide `slug`. La columna no existe en la base.

```
$ curl "https://mulsqxfhxxdsadxsljss.supabase.co/rest/v1/church_podcast_episodes\
?select=id,slug,title,description,speaker,cover_url,published_at,episode_date,duration_seconds,audio_url\
&status=eq.published&limit=3" -H "apikey: <anon>" -H "Authorization: Bearer <anon>"
{"code":"42703","message":"column church_podcast_episodes.slug does not exist"}
HTTP=400
```

La clave anon está en `src/integrations/supabase/client.ts:6` — es publicable y ya está en el repo.

Estado medido el 2026-08-12: **18 columnas sin `slug`** · **cero filas** en la tabla · última
migración aplicada `20260806000000` · `psql` **ausente** en el host · `supabase` CLI `2.110.0` ·
`node` `v22.22.0`.

## 3. Scope — exactamente esto

1. Aplicar **una sola** migración a la base desplegada (`mulsqxfhxxdsadxsljss`):
   `supabase/migrations/20260808120000_church_podcast_episodes_slug.sql`, **tal como está en
   `db8ed2e`. No la reescribas.**
2. Reconciliar `supabase_migrations.schema_migrations` para que la versión registrada sea
   exactamente `20260808120000`, una sola vez, sin versiones inventadas.
3. Verificar el esquema **objeto por objeto** sobre la base real.
4. Verificar que `/reflexiones` vuelve a servir su estado vacío en producción.
5. Escribir `docs/plan/audio/evidence/E3c-fix.md` en el worktree del plan.

## 4. Fuera de alcance — y por qué, para que no lo amplíes de buena fe

- **⛔ Las otras dos migraciones pendientes.** Hay **tres** sin aplicar. Dos **no son de AUDIO**:
  `20260612000000_casa_whatsapp_scheduling.sql` y `20260612000001_casa_wa_reminders_cron.sql`.
  Desplegarlas es la decisión de release de otro workstream.
- **⛔ `supabase db push` a secas — PROHIBIDO.** Aplica **todas** las pendientes en orden, así que
  desplegaría las dos de WhatsApp. Sólo se permite en variante que **no aplique nada**
  (`--dry-run` o equivalente), y para eso está `E3c.7`.
- **⛔ Sembrar episodios.** Brent lo dejó fuera explícitamente el 2026-08-12.
- **⛔ `index.html`, `vercel.json`, meta tags, canonical, el `404`.** Todo eso es `E4`.
- **⛔ Cualquier `DROP`, `TRUNCATE` o `ALTER` destructivo** (D9 + regla dura del repo).
- **⛔ Las 11 tablas de Life OS**: `goals`, `habits`, `habit_logs`, `health_logs`,
  `journal_entries`, `life_areas`, `lifeos_calendar_events`, `lifeos_tasks`, `meditation_logs`,
  `project_health`, `workout_logs`. Ni leerlas hace falta.
- **⛔ Merge o push a `main`.** No está autorizado. Sólo empujas `phase/E3c-fix`.
- **⛔ Arreglar la base de diagnósticos preexistentes** — non-goal permanente del plan.

## 5. La trampa técnica, dicha antes de que la pises

La migración **no es idempotente**: los `ADD CONSTRAINT` de las líneas **39** y **146** no llevan
guard. **Aplicarla dos veces falla con `42710 duplicate_object`.**

De ahí el riesgo real de esta fase: si el mecanismo que uses registra la versión con un timestamp
propio (≠ `20260808120000`), un `db push` futuro la verá pendiente y la reintentará, y **fallará**.
Por eso el criterio no es "la SQL corrió" sino "corrió **y** la fila de versión quedó reconciliada".

Herramientas disponibles: `supabase` CLI `2.110.0`, y el MCP `supabase-casa` (`apply_migration`,
`execute_sql`, `list_migrations`). **`psql` no existe en el host.** **Elige tú el mecanismo y
justifícalo con salida cruda** — lo que se te fija es el estado final, no la herramienta.

**Lee `schema_migrations` justo antes y justo después de aplicar, y anota las dos lecturas.** Este
repo y esta base los comparten sesiones concurrentes.

## 6. Criterios de aceptación — los nueve, con su comprobación

- **E3c.1** `20260808120000` en `schema_migrations`, **exactamente una vez**, sin otras versiones
  nuevas. `select version from supabase_migrations.schema_migrations where version >= '20260806000000'`
  → exactamente `20260806000000` y `20260808120000`.
- **E3c.2** `church_podcast_episodes` pasa de **18 a 19 columnas**; la nueva es `slug text`.
- **E3c.3** Existen, consultados a `pg_constraint` / `pg_indexes` / `pg_trigger` / `pg_proc` —
  **no inferidos de que la migración no dio error**: los `CHECK` `podcast_episode_slug_length` y
  `podcast_episode_published_has_slug`, el índice único `idx_podcast_episodes_slug`, las funciones
  `church_podcast_episode_slug_body` y `assign_podcast_episode_slug`, y el trigger
  `trg_podcast_episodes_slug`.
- **E3c.4** El `curl` de §2 pasa de `400` a **`200`**. **Cuerpo esperado `[]`** — la tabla sigue
  vacía y eso es correcto, no un fallo.
- **E3c.5** `https://www.anglicanasanandres.cl/reflexiones` responde `200` **y pinta el estado vacío,
  no el de error**. Verifícalo sobre el DOM renderizado: el shell SPA devuelve `200` aunque la
  consulta falle, así que **el código HTTP no distingue los dos casos**. Es la única aserción de la
  fase que un `curl` no cierra.
- **E3c.6** El trigger funciona en la base real, con prueba **falsable**: inserta un episodio en
  `draft`, publícalo, comprueba que recibe slug solo; intenta cambiarle el slug y comprueba que la
  base lo rechaza con **`23514`** (D12, inmutabilidad); **borra la fila al terminar** y deja la tabla
  en cero filas. Es el único `DELETE` autorizado, y sólo sobre la fila que tú creaste. Si no puedes
  dejarla limpia, **no lo hagas y repórtalo**.
- **E3c.7** Una variante que **no aplique nada** (`supabase db push --dry-run` o equivalente) muestra
  como pendientes **exactamente** `20260612000000` y `20260612000001`, y **no** `20260808120000`.
- **E3c.8** Ninguna tabla de Life OS tocada. Declarado y verificable: la fase no emite DDL fuera de
  `church_podcast_episodes` y sus objetos.
- **E3c.9** `evidence/E3c-fix.md` con toda la salida cruda, el mecanismo elegido y su justificación,
  y el estado antes/después de cada aserción.

## 7. Gates del repo — obligatorios

Esta fase **puede no tener diff de código fuente**. Si la lista `F` de ficheros fuente modificados
queda vacía:

- El gate por ficheros de D18 (`scripts/gates/changed-files-diagnostics.sh`) **no aplica**: no hay
  ficheros que comparar. **Dilo explícitamente en la evidencia** en vez de reportar un gate que no
  corriste.
- **`npm run build`** → verde absoluto (no delta). Obligatorio.
- **`npx vitest run --no-file-parallelism`** → obligatorio. `E3a` y `E3b` tienen 112 tests que
  codifican el contrato del slug, y son la red que detecta si lo aplicado no coincide con lo que el
  código espera. **Cero fallos nuevos** respecto de `db8ed2e`.
- Registra `node --version` y `supabase --version`.

**La suite e2e está roja de base** en `mesa-abierta`, `rbac`, `recorder` y `financial-*`, y no es de
AUDIO. Si corres e2e y algo falla ahí, **distingue regresión de rama de base roja** reproduciendo el
comando en un checkout limpio de `db8ed2e` y registrando SHA, entorno, comando, IDs de test y
recuentos. Un gate rojo es `BLOCKED`, nunca completo — **nunca lo reetiquetes `PASS`**.

Si concluyes que **sí** hace falta tocar código fuente, **para y repórtalo antes de escribirlo**:
sería una desviación del contrato, no una decisión tuya.

## 8. Seguridad y privacidad

- **La base es compartida con Life OS.** Verifica la propiedad de cada objeto antes de tocarlo.
- **Sólo migraciones aditivas.** Nada de `DROP`/`TRUNCATE`/`ALTER` destructivo.
- **PII de miembros nunca** en prompts de IA, logs de evidencia ni Open Brain (D13). La tabla está
  vacía, así que no debería aparecer ninguna — si aparece, la evidencia usa iniciales o rol.
- La fila de prueba de E3c.6 es **sintética**. Datos sintéticos únicamente.
- **No despliegues, no mergees, no empujes a `main`.** No autorizado en esta fase.

## 9. Qué entregas al terminar

1. `docs/plan/audio/evidence/E3c-fix.md` en el worktree del plan, commiteado en `docs/plan-audio`.
2. Rama `phase/E3c-fix` empujada a `origin` (aunque el diff de código sea vacío o mínimo).
3. Un informe en esta conversación con:
   - los nueve criterios, cada uno con su **salida cruda**, no con prosa de confianza;
   - los gates que corriste y su resultado literal;
   - **la parte más débil de lo que hiciste** y qué punto ciego queda;
   - las dos lecturas de `schema_migrations`, antes y después.

**No hagas prosa de confianza.** Comandos y salidas.

## 10. Puntos ciegos conocidos — no los descubras, empieza sabiéndolos

- **`E3c.5` necesita render, no HTTP.** El shell SPA devuelve `200` con la consulta rota. El código
  de estado no distingue error de vacío.
- **Esta fase no demuestra que la página funcione con contenido**, sólo que no está rota. Falta un
  episodio, y sembrarlo está fuera de alcance.
- **Fallo parcial es posible:** la migración no está envuelta en transacción explícita. Los
  criterios E3c.2 y E3c.3 existen para detectarlo objeto por objeto.
- **No hay rollback de esquema.** Revertir exigiría `DROP`, que las reglas duras prohíben. Si algo
  falla a mitad, **reporta el estado tal cual y no improvises limpieza**. Si el registro de versión
  queda mal, se corrige el registro — nunca borrando objetos de esquema.
- **`app.wa_reminders_url` está vacía** y `pg_cron`/`pg_net` están instalados: si por accidente se
  aplicara `20260612000001`, su guard la saltaría con `RAISE NOTICE`. **No es permiso para
  aplicarla** — el riesgo de un `push` a secas es desplegar esquema ajeno, no disparar WhatsApp.

## 11. Después

Cuando los gates requeridos estén verdes, el PM enruta el diff acumulado a **una** review
independiente de Codex. **Esta conversación se queda abierta**: si Codex devuelve `FAIL`, los
blockers vuelven aquí como **un solo lote deduplicado** y los arreglas tú. Si devuelve `PASS`, tú
haces el cierre mecánico: guardar la review, añadir la entrada al ledger, marcar la fase DONE y
anotar deriva y diferidos.
