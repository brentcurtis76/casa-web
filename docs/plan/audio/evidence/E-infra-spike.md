# EVIDENCIA — `E-infra-spike`

**Unidad de medición. No se escribió código de producción. No se commiteó ningún fichero fuente.**

---

## CÓMO SE LEE ESTE DOCUMENTO — dos SHA, y no son intercambiables

El documento acumula dos rondas de medición tomadas sobre **dos árboles distintos**. La regla del
plan —*SHA siempre, nunca nombre de rama*— existe exactamente para este caso, así que cada bloque
lleva marcado sobre qué árbol se midió.

| Marca | SHA | Qué es | Qué se midió ahí |
|---|---|---|---|
| **〔r1 · `6d45f35`〕** | `6d45f35a54bde0335d05ffd6943167cf25d0a09e` | `main` **antes** del hotfix de F1 | F1, F2, S1-S7 originales |
| **〔r2 · `165e5f2`〕** | `165e5f2f01149fafefabea428dd00ce3823ce277` | `main` **con** el hotfix de F1 y los puertos fijados | remediación de los 3 BLOCKING, S1-S4 y N1 |

**Las mediciones de la r1 no se reescriben ni se re-atribuyen.** Siguen siendo verdad sobre el árbol
sobre el que se tomaron. Donde la r2 vuelve a medir lo mismo sobre `165e5f2`, se dice y se muestran
las dos salidas.

**`main` hoy no es ninguno de los dos: es `981c00f`.** `165e5f2` es antepasado suyo
(`git merge-base --is-ancestor 165e5f2 main` → verdadero), y los 19 commits que van de uno a otro
son del workstream UPGRADE más una migración de `mesa`. Donde eso cambia una cifra, se dice.

### Entorno de la r2

- **SHA medido:** `165e5f2` (worktree desechable `/tmp/wt-m`, `git worktree add --detach /tmp/wt-m 165e5f2`;
  `git -C /tmp/wt-m rev-parse HEAD` → `165e5f2f01149fafefabea428dd00ce3823ce277`).
- **Fecha:** 2026-08-08. **CLI:** `supabase 2.110.0` · **node** `v22.22.0`.
- **Worktree de medición borrado al terminar.** Nada de él se commiteó.

**VEREDICTO DE LA r1, INTACTO: la ruta A (stack local) es VIABLE.** La r2 no lo re-mide y no lo
mueve. Lo que la r2 corrige es el **bloque de plan §S8**, que no era ejecutable.

---

## Hallazgos que cambian el plan

### F1 — `supabase start` estaba roto: `config.toml` declaraba una función que no existe

**〔r1 · `6d45f35`〕** `config.toml` declara `[functions.generate-graphic]`, pero el directorio no existe:

```
$ ls supabase/functions/generate-graphic
ls: /tmp/wt-einfra/supabase/functions/generate-graphic: No such file or directory

$ git ls-tree -r --name-only 6d45f35 -- supabase/functions/generate-graphic
(salida vacía)
```

Primer intento de arranque, salida cruda (última línea):

```
{"_tag":"Error","error":{"code":"UnknownError","message":"failed to read file: open supabase/functions/generate-graphic/index.ts: no such file or directory"}}
supabase start 2>&1  0.82s user 0.44s system 1% cpu 1:35.77 total
```

**No lo causó el delta de puertos** — el delta sólo añadió secciones `[api]/[db]/[studio]/…`, y el
error nombra un fichero de función. La traza:

```
$ git log --oneline -3 -S 'functions.generate-graphic' -- supabase/config.toml
55ce9c7 Enforce JWT verification for paid edge functions

$ git log --oneline -3 --all -- supabase/functions/generate-graphic
(salida vacía — el directorio no ha existido nunca en ninguna rama)
```

`55ce9c7` añadió `verify_jwt = true` para una función que nunca existió.

**〔N1 — lo medido y lo conjeturado, separados〕**

- **Medido:** `supabase start` falla en `6d45f35`; el bloque lo introdujo `55ce9c7`; el directorio
  no ha existido nunca en ninguna rama. De ahí se sigue que **el arranque llevaba roto desde
  `55ce9c7` (2026-07-16)** para todo el repositorio.
- **No medido:** *por qué* nadie lo detectó. La r1 escribió «nadie lo había medido porque nadie
  levantaba el stack». Eso es una explicación histórica plausible, **no una medición**, y no se
  intentó comprobar. Queda marcada como conjetura.

**〔r2 · `165e5f2`〕 F1 YA ESTÁ ARREGLADO EN `main`. Es precondición, no trabajo pendiente.**
Ver §S8 *Precondición ya verificada*.

### F2 — las migraciones no otorgan permisos de tabla; el stack local deja a `anon` y `authenticated` sin `SELECT`

**〔r1 · `6d45f35`〕** Tras arrancar y aplicar las 61 migraciones, **toda** lectura por PostgREST
devuelve 401:

```
$ curl -s -w "\nHTTP %{http_code}\n" \
  "http://127.0.0.1:54331/rest/v1/church_podcast_episodes?select=title,status" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
{"code":"42501","details":null,"hint":null,"message":"permission denied for table church_podcast_episodes"}
HTTP 401
```

No es RLS — la política existe y es correcta. Es el `GRANT` de tabla.

**〔r2 · `165e5f2`〕 Reconfirmado sobre el árbol nuevo y tras `supabase db reset` limpio.**
Prueba principal — `role_table_grants`, **las tres tablas × los dos roles**:

```
$ psql "$PGURL" -c "select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema='public' and table_name in ('church_podcast_episodes','liturgias','liturgia_elementos')
  and grantee in ('anon','authenticated')
group by table_name, grantee order by table_name, grantee;"

       table_name        |    grantee    |         privilegios
-------------------------+---------------+-----------------------------
 church_podcast_episodes | anon          | REFERENCES,TRIGGER,TRUNCATE
 church_podcast_episodes | authenticated | REFERENCES,TRIGGER,TRUNCATE
 liturgia_elementos      | anon          | REFERENCES,TRIGGER,TRUNCATE
 liturgia_elementos      | authenticated | REFERENCES,TRIGGER,TRUNCATE
 liturgias               | anon          | REFERENCES,TRIGGER,TRUNCATE
 liturgias               | authenticated | REFERENCES,TRIGGER,TRUNCATE
(6 rows)
```

Falta `SELECT/INSERT/UPDATE/DELETE` para **los dos** roles en **las tres** tablas.

Causa raíz, medida en `165e5f2`:

```
$ psql "$PGURL" -c "select pg_get_userbyid(defaclrole) as rol_creador, defaclobjtype as tipo, defaclacl::text
                    from pg_default_acl where defaclnamespace='public'::regnamespace;"
  rol_creador   | tipo |                          defaclacl
----------------+------+--------------------------------------------------------------------------
 supabase_admin | r    | {postgres=arwdDxt/supabase_admin,anon=arwdDxt/supabase_admin,authenticated=arwdDxt/supabase_admin,service_role=arwdDxt/supabase_admin}
 postgres       | r    | {postgres=arwdDxt/postgres,anon=Dxt/postgres,authenticated=Dxt/postgres,service_role=Dxt/postgres}
 (…6 filas en total, incluidas las de secuencias `S` y funciones `f`)
```

Las migraciones corren como **`postgres`**, cuyos privilegios por defecto conceden a `anon` y
`authenticated` sólo `Dxt` (TRUNCATE/REFERENCES/TRIGGER) — **sin `SELECT`**. Los de
`supabase_admin` sí conceden `arwdDxt`.

**Lectura:** el esquema del repo depende de un estado ambiente del proyecto alojado que el stack
local no reproduce. **En hosted funciona; en local no, y el repo no lo declara en ninguna parte.**

#### 〔S1 · r2〕 La prueba impresa en la r1 era inválida. La conclusión no.

La r1 probó la ausencia de `GRANT` con un comando que no podía encontrarlos:

```
$ grep -rn 'grant .* to .*anon' supabase/migrations/ | wc -l
       0
```

Ese `0` **viene de la sensibilidad a mayúsculas, no de la ausencia**. El comando correcto,
sobre `165e5f2`:

```
$ grep -rn -i '^[[:space:]]*GRANT ' supabase/migrations/ | wc -l
       5

$ grep -rn -i '^[[:space:]]*GRANT ' supabase/migrations/
supabase/migrations/20250214_refresh_get_users_by_ids.sql:33:GRANT EXECUTE ON FUNCTION public.get_users_by_ids(uuid[]) TO authenticated;
supabase/migrations/20250214_refresh_get_users_by_ids.sql:34:GRANT EXECUTE ON FUNCTION public.get_users_by_ids(uuid[]) TO anon;
supabase/migrations/20250214_refresh_get_users_by_ids.sql:35:GRANT EXECUTE ON FUNCTION public.get_users_by_ids(uuid[]) TO service_role;
supabase/migrations/20260120000002_sermon_music_tracks.sql:73:GRANT EXECUTE ON FUNCTION set_music_track_as_default(UUID) TO authenticated;
supabase/migrations/20260522000100_save_slides_positions_rpc.sql:102:GRANT EXECUTE ON FUNCTION public.save_liturgy_slides_positions(uuid, jsonb, jsonb)

$ grep -rln -i 'revoke' supabase/migrations/ | wc -l
       0
```

**Todos son `GRANT EXECUTE ON FUNCTION`. Ninguno es de tabla. La conclusión de F2 sobrevive
intacta.** Los `0 REVOKE` sí eran ciertos.

**Discrepancia de conteo con Codex y el PM, y por qué NO es un desacuerdo:** ambos contaron **6**.
Yo cuento **5**. Los dos números son correctos sobre árboles distintos:

```
$ git grep -h -i "^[[:space:]]*GRANT " 165e5f2 -- supabase/migrations/ | wc -l
       5
$ git grep -h -i "^[[:space:]]*GRANT " main -- supabase/migrations/ | wc -l   # main = 981c00f
       6
$ git log --oneline -1 --diff-filter=A -- supabase/migrations/20260806000000_mesa_main_dish_optout.sql
d9eebb0 feat(mesa): columna can_bring_main_dish + RPC get_my_dinner_summary (P1 r1)
```

El sexto `GRANT` llegó en `d9eebb0`, **posterior a `165e5f2`**. Es precisamente el caso que la
regla «SHA siempre, nunca nombre de rama» previene.

**Nota de método:** el patrón `^[[:space:]]*GRANT ` sólo captura los `GRANT` que abren línea; el de
`20260522000100:102` es multilínea y entra por su primera línea. Vale para contar sentencias, no
para auditar permisos. **La prueba principal de F2 es la consulta a `role_table_grants` de arriba**,
no el grep.

#### Arreglo, medido en `165e5f2`

```sql
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
```

Salida: `GRANT` / `GRANT` / `GRANT`. Verificación tras aplicarlo, en §S2.

#### 〔S3 · r2〕 `ON ALL TABLES` no alcanza a lo que se cree después — medido en los dos sentidos

`GRANT … ON ALL TABLES` concede sobre las tablas **existentes en ese instante**. Medido creando una
tabla como `postgres` (que es lo que hace una migración) en los dos escenarios:

```
### S3-a: SIN alter default privileges (estado original del repo)
$ alter default privileges in schema public revoke select, insert, update, delete on tables from anon, authenticated;
$ create table public.s3_sin_adp (id int primary key);
    grantee    |         privilegios
---------------+-----------------------------
 anon          | REFERENCES,TRIGGER,TRUNCATE
 authenticated | REFERENCES,TRIGGER,TRUNCATE

### S3-b: CON alter default privileges — misma operación
$ alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
$ create table public.s3_con_adp (id int primary key);
    grantee    |                       privilegios
---------------+---------------------------------------------------------
 anon          | DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
 authenticated | DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
```

(Las dos tablas de sonda se borraron: `drop table public.s3_sin_adp; drop table public.s3_con_adp;`)

**Por tanto el seed debe llevar también:**

```sql
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
```

**Corrección al PM, con la precisión que pedía S3:** el ledger del PM decía que *«cualquier
migración futura»* rompería el entorno local. **No es exacto, y el caso roto es más estrecho:**

- **`supabase db reset` NO rompe nada: lo repara.** El CLI corre las migraciones **y después** el
  seed. Orden medido en la salida cruda del propio reset:
  ```
  Applying migration 20260612000001_casa_wa_reminders_cron.sql...
  NOTICE (00000): wa-reminders cron skipped: pg_cron=f pg_net=t
  WARN: no files matched pattern: supabase/seed.sql
  Restarting containers...
  ```
  El seed es el último paso, así que vuelve a conceder sobre todo lo que las migraciones acaban de
  crear.
- **El caso roto es la migración incremental**: aplicar una migración nueva sobre un stack ya
  levantado, sin volver a correr el seed. Esa tabla nace sin privilegios y el fallo es silencioso.
  **Es lo que `ALTER DEFAULT PRIVILEGES` cierra**, y por eso no basta con «exigir resembrar».

### 〔F3 · r2 — NUEVO〕 `supabase start` restaura el backup anterior: `start` no basta para medir

**Hallazgo de la r2, y es una trampa real para quien ejecute `E-infra-impl`.**

`supabase stop` guarda un backup por defecto (`{"backup":true,…}` — está en la salida de limpieza de
la r1). Al volver a arrancar, `supabase start` **restaura ese backup**, no reconstruye desde el
árbol. Medido: la primera consulta de la r2, hecha justo tras `supabase start`, devolvió a `anon`
y `authenticated` **todos los privilegios** —incluido `SELECT`— sobre las tres tablas:

```
### role_table_grants TRAS supabase start (contaminado por el backup de la r1)
 church_podcast_episodes | anon          | DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
 church_podcast_episodes | authenticated | DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
 (…las 6 filas iguales)
```

Eso **habría "refutado" F2 por accidente**. Lo que se estaba leyendo eran los `GRANT` que la r1
aplicó a mano, sobrevividos dentro del backup. Tras `supabase db reset` —que sí reconstruye desde
las 61 migraciones del árbol— el hueco reaparece, y ésa es la salida que se imprime en F2.

**Consecuencia para `E-infra-impl`, y va a los criterios:** una medición de permisos o de datos
sólo es válida **después de `supabase db reset`**, nunca sólo tras `supabase start`. El criterio I1
por sí solo no demuestra un entorno limpio.

### 〔F4 · r2 — NUEVO〕 Un `INSERT` en `auth.users` no produce un usuario que pueda iniciar sesión

**Hallazgo de la r2 al cerrar B3.** El seed es SQL, así que crea el admin sintético insertando en
`auth.users`. Con el conjunto de columnas «obvio», el usuario existe pero **el login devuelve 500**:

```
$ curl -s -w "\nHTTP %{http_code}\n" -X POST "http://127.0.0.1:54331/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"admin@e2e.local","password":"e2e-local-synthetic"}'
{"code":500,"error_code":"unexpected_failure","msg":"Database error querying schema","error_id":"66f6ed5a-…"}
HTTP 500
```

Causa, en el log del propio GoTrue (no inferida):

```
$ docker logs supabase_auth_mulsqxfhxxdsadxsljss 2>&1 | tail -5
{"component":"api","error":"error finding user: sql: Scan error on column index 3, name \"confirmation_token\": converting NULL to string is unsupported","grant_type":"password","level":"error","method":"POST","msg":"500: Database error querying schema","path":"/token","status":500,…}
```

GoTrue no sabe leer `NULL` en esas columnas de texto. Arreglo medido:

```
$ psql "$PGURL" -c "update auth.users set confirmation_token='', recovery_token='', email_change='', email_change_token_new='' where id='00000000-e2e0-4000-9000-000000000001';"
UPDATE 1

$ curl -s -X POST ".../auth/v1/token?grant_type=password" -d '{"email":"admin@e2e.local","password":"e2e-local-synthetic"}'
{"access_token":"eyJhbGciOiJFUzI1NiIsImtpZCI6…","token_type":"bearer",…}
```

**Medido también:** el login funciona **sin** fila en `auth.identities`. No hace falta sembrarla.

---

## S1 — Ruta A, arranque · **MET**

**〔r1 · `6d45f35`〕** Puertos libres verificados antes de elegirlos (`lsof -nP -iTCP:$p -sTCP:LISTEN`
sobre 54331-54340 → los diez libres). El proyecto ajeno `sxlogxqzmarhqsblxmtj` ocupa 54321, 54322,
54323, 54324 y 54327; **no se tocó**.

Delta exacto de `supabase/config.toml` (worktree desechable, **no commiteado**):

```toml
[api]
port = 54331

[db]
port = 54332
shadow_port = 54333
major_version = 15

[studio]
port = 54334

[local_smtp]        # `[inbucket]` sigue funcionando pero el CLI 2.110.0 lo marca deprecado
port = 54335

[analytics]
port = 54337
```

Comando y salida cruda (segundo intento, con F1 neutralizado):

```
$ cd /tmp/wt-einfra && time supabase start
...
WARN: no files matched pattern: supabase/seed.sql
{"DB_URL":"postgresql://postgres:postgres@127.0.0.1:54332/postgres","API_URL":"http://127.0.0.1:54331",…,"STUDIO_URL":"http://127.0.0.1:54334","PUBLISHABLE_KEY":"sb_publishable_<REDACTADO>","SECRET_KEY":"sb_secret_<REDACTADO>",…}
supabase start 2>&1  4.03s user 2.00s system 13% cpu 44.302 total
```

**Tiempo de arranque: 44.3 s.**

**Redacción declarada:** `PUBLISHABLE_KEY` y `SECRET_KEY` van como `<REDACTADO>`, aquí y en la r2.
**GitHub push protection rechazó el push** de la r1 (`GH013`, "Supabase Secret Key"). El valor es la
clave de demo fija del CLI local, no una credencial real, pero el bloqueo es correcto como política
y no procede saltárselo. Los valores se reproducen ejecutando `supabase start`.

**〔r2 · `165e5f2`〕 El arranque ya no necesita ninguna edición a mano. Medido:**

```
$ cd /tmp/wt-m && git rev-parse HEAD
165e5f2f01149fafefabea428dd00ce3823ce277
$ git status --porcelain
?? probe-reuse/          ← sonda desechable de la r2, no commiteada

$ time supabase start
...
{"DB_URL":"postgresql://postgres:postgres@127.0.0.1:54332/postgres","API_URL":"http://127.0.0.1:54331","STUDIO_URL":"http://127.0.0.1:54334",…}
supabase start 2>&1  3.24s user 1.86s system 13% cpu 37.569 total
```

**37.6 s, sobre el árbol tal cual, sin tocar `config.toml`.** Ésta es la verificación de la
precondición de §S8.

## S2 — Ruta A, migraciones y esquema utilizable · **MET**

**〔r1 · `6d45f35`〕**

```
$ cd /tmp/wt-einfra && supabase db reset
...
Applying migration 20260612000001_casa_wa_reminders_cron.sql...
NOTICE (00000): wa-reminders cron skipped: pg_cron=f pg_net=t
WARN: no files matched pattern: supabase/seed.sql
Finished supabase db reset on branch main.

$ grep -c 'Applying migration' /tmp/dbreset.log
61
```

**Las 61 aplican limpias. Ninguna falla.** `db reset` local, **nunca `--linked`**.

**Una degradación real y anotable:** `pg_cron=f` — la extensión no está en la imagen local, así que
`20260612000001_casa_wa_reminders_cron.sql` **se salta el cron a propósito**. Un e2e local **no
puede probar el camino de recordatorios de WhatsApp**. Fuera del alcance de AUDIO; queda anotado.

**〔r2 · `165e5f2`〕 Reconfirmado, y contado desde la propia base:**

```
$ supabase db reset
... Finished supabase db reset on branch main.
$ psql "$PGURL" -tAc "select count(*) from supabase_migrations.schema_migrations;"
61
$ ls /tmp/wt-m/supabase/migrations/*.sql | wc -l
      61
```

**61 ficheros en el árbol, 61 filas aplicadas.**

### 〔S2 · r2〕 Los dos roles y las tres tablas, antes y después del `GRANT`

**ANTES del seed** — `anon` y `authenticated`, las tres tablas, salida cruda:

```
--- church_podcast_episodes · ANON ---
{"code":"42501",…,"message":"permission denied for table church_podcast_episodes"} | HTTP 401
--- church_podcast_episodes · AUTHENTICATED ---
{"code":"42501",…,"message":"permission denied for table church_podcast_episodes"} | HTTP 403
--- liturgias · ANON ---
{"code":"42501",…,"message":"permission denied for table liturgias"} | HTTP 401
--- liturgias · AUTHENTICATED ---
{"code":"42501",…,"message":"permission denied for table liturgias"} | HTTP 403
--- liturgia_elementos · ANON ---
{"code":"42501",…,"message":"permission denied for table liturgias"} | HTTP 401
--- liturgia_elementos · AUTHENTICATED ---
{"code":"42501",…,"message":"permission denied for table liturgias"} | HTTP 403
```

`anon` recibe **401** y `authenticated` **403** — mismo `42501` de Postgres, distinto código HTTP.
`liturgia_elementos` denuncia `liturgias` porque su RLS consulta esa tabla.

**DESPUÉS del `GRANT`**, con el baseline sembrado (§S7):

```
--- church_podcast_episodes · ANON ---
[{"title":"[BASELINE] Reflexion publicada","status":"published"}] | HTTP 200
--- church_podcast_episodes · AUTHENTICATED (admin sintético) ---
[{"id":"00000000-e2e0-4000-9000-000000000010"},
 {"id":"00000000-e2e0-4000-9000-000000000011"}] | HTTP 200
--- liturgias · ANON ---
[] | HTTP 200
--- liturgias · AUTHENTICATED (admin sintético) ---
[{"id":"00000000-e2e0-4000-9000-000000000020"}] | HTTP 200
--- liturgia_elementos · ANON ---
[] | HTTP 200
--- liturgia_elementos · AUTHENTICATED (admin sintético) ---
[{"id":"00000000-e2e0-4000-9000-000000000030"}] | HTTP 200
```

**RLS se comporta exactamente como está diseñada, y ahora con los dos roles:**

- `anon` ve **1 de 2** episodios (sólo el `published`); el `draft` queda filtrado.
- `anon` ve **0** liturgias y **0** elementos, con 200 — RLS de propietario.
- El **admin sintético** ve **los 2** episodios y **la** liturgia. Eso es la prueba de extremo a
  extremo de que `is_liturgia_admin` funciona a través de PostgREST, no sólo en SQL.

**Restricción que hay que respetar al sembrar** 〔r1〕:

```
ERROR:  new row for relation "church_podcast_episodes" violates check constraint "published_episode_complete"

published_episode_complete | CHECK (((status <> 'published') OR
  ((audio_url IS NOT NULL) AND (audio_size_bytes IS NOT NULL) AND
   (duration_seconds IS NOT NULL) AND (published_at IS NOT NULL))))
```

**Segunda restricción, medida en la r2:** `liturgias` **no tiene columna `user_id`**. La columna de
propiedad es **`created_by`**, y es la que usan las políticas:

```
$ psql "$PGURL" -c "select policyname, cmd, qual from pg_policies where tablename='liturgias';"
           policyname           |  cmd   |             qual
--------------------------------+--------+-------------------------------
 Admins can read all liturgias  | SELECT | is_liturgia_admin(auth.uid())
 Users can delete own liturgias | DELETE | (auth.uid() = created_by)
 Users can insert own liturgias | INSERT |
 Users can read own liturgias   | SELECT | (auth.uid() = created_by)
 Users can update own liturgias | UPDATE | (auth.uid() = created_by)
(5 rows)
```

Un seed que escriba `user_id` falla con `column "user_id" of relation "liturgias" does not exist`
— lo comprobé fallando.

Columnas `NOT NULL` sin default que el seed debe rellenar: `liturgias.fecha`, `liturgias.titulo`,
`liturgia_elementos.tipo`, `liturgia_elementos.orden`.

## S3 — RLS y políticas · **MET** 〔r1 · `6d45f35`〕

Las tres tablas existen y tienen RLS activa:

```
         relname         | relrowsecurity
-------------------------+----------------
 liturgias               | t
 liturgia_elementos      | t
 church_podcast_episodes | t
```

```
        tablename        |            policyname          |  cmd   |        roles
-------------------------+--------------------------------+--------+----------------------
 church_podcast_episodes | podcast_episodes_admin_all     | ALL    | {public}
 church_podcast_episodes | podcast_episodes_public_read   | SELECT | {anon,authenticated}
 liturgias               | Users can read own liturgias   | SELECT | {public}
 ...
(11 rows)
```

La verificación de lectura real bajo RLS está arriba, en §S2 〔r2〕, ampliada a los dos roles.

## S4 — Ruta B, sólo preconditions · **PARCIAL — y a propósito**

**〔r1 · `6d45f35`〕 No se creó ninguna rama.** Lo medible sin gastar:

```
mcp__supabase-casa__list_branches → {"branches":[]}
```

La llamada responde. **Eso no prueba que `create_branch` esté permitido ni que sea gratis**, y no
se comprobó porque comprobarlo cuesta dinero y es decisión de Brent.

**Costo, de la documentación oficial** (`search_docs` → "Manage Branching usage"):

| Concepto | Valor |
|---|---|
| Compute de una rama (Micro, por defecto) | **USD 0.01344 / hora** |
| Extrapolado | **≈ USD 0.32 / día · ≈ USD 9.81 / mes** |
| Además | egress, disk size y storage de la rama |
| **Spend Cap** | **NO cubre Branching Compute** |
| **Compute Credits** | **NO aplican a Branching Compute** |

**Comando exacto que la crearía** (NO ejecutado):

```bash
supabase branches create e2e --project-ref mulsqxfhxxdsadxsljss
```

**NO MEDIDO, y hay que decirlo:**

- **El plan de la organización.** Ninguna herramienta MCP disponible expone facturación. Branching
  exige plan de pago; si la organización está en Free, la ruta B **no existe**. Sin verificar.
- **Si `create_branch` está autorizado** para este token. Sin verificar, por costo.
- **〔S4 · r2 — CORREGIDO〕 Qué contendría una rama.** La r1 afirmaba categóricamente que una rama
  **no reproduciría las 11 tablas de Life OS** porque se construye aplicando `supabase/migrations`.
  **Eso era inferencia, no medición: no se creó ninguna rama y no se inspeccionó ninguna.** Es
  exactamente el defecto que este plan lleva seis rondas persiguiendo, así que la afirmación queda
  **degradada a NO MEDIDO**. No se re-mide porque **la ruta B está cerrada por innecesaria**, no
  porque se sepa qué contendría.

## S5 — Guarda anti-producción · **REESCRITA EN LA r2**

> **La especificación de la r1 era insuficiente y se sustituye entera.** Lo que la r1 midió sobre
> las tres vías de entrada de la URL sigue siendo válido y se conserva; lo que se sustituye es el
> **diseño de la guarda**, que era una lista negra de un elemento y no cerraba el agujero de
> reutilización del servidor.

### S5.1 — Por dónde entra la URL productiva 〔r1 · `6d45f35`, vigente〕

| # | Vía | Fichero:línea | Comportamiento medido |
|---|---|---|---|
| 1 | `VITE_SUPABASE_URL` | `src/integrations/supabase/client.ts:5` | Vite la inyecta desde `process.env` — **verificado** |
| 2 | **Fallback hardcodeado** | `src/integrations/supabase/client.ts:5` | `\|\| "https://mulsqxfhxxdsadxsljss.supabase.co"` |
| 3 | `.env.test` | `playwright.config.ts:9-21` | se carga sólo si existe; **no pisa** lo ya presente en `process.env` (`if (!process.env[key])`) |

Y un detalle que decide el diseño: poner **sólo** la URL da **URL local + clave anon de
PRODUCCIÓN**, porque `VITE_SUPABASE_ANON_KEY` tiene su propio fallback horneado
(`client.ts:6`). La guarda tiene que exigir **las dos**.

### S5.2 — El agujero que anula cualquier guarda de entorno 〔r2 · `165e5f2`〕 — **B1**

```
playwright.config.ts:46 →  reuseExistingServer: !process.env.CI
```

En local `CI` no está definida ⇒ **`true`**. Si ya hay un servidor escuchando en
`http://localhost:8080`, **Playwright se engancha a ése y nunca lanza `npm run dev`**. Ese servidor
pudo arrancarse en otra terminal sin ninguna variable de test — con el fallback a producción
horneado dentro. La guarda vive en el proceso de Playwright y comprueba *sus* variables, que serían
correctas; el navegador, mientras tanto, habla con producción.

**Medido, no razonado. Caso D) — servidor productivo ya escuchando.**

**Paso 1 — un `npm run dev` sin variables ocupa el 8080:**

```
$ env -u VITE_SUPABASE_URL -u VITE_SUPABASE_ANON_KEY nohup npm run dev &
  VITE v5.4.21  ready in 317 ms
  ➜  Local:   http://localhost:8080/

$ lsof -nP -iTCP:8080 -sTCP:LISTEN
node    16055 brentcurtis   25u  IPv6 0xed59e5ffe1a944a9      0t0  TCP *:8080 (LISTEN)
```

**Paso 2 — ese servidor tiene producción horneada dentro** (`import.meta.env` **no trae**
`VITE_SUPABASE_URL`, así que el `||` del código cae al literal de producción):

```
$ curl -s "http://localhost:8080/src/integrations/supabase/client.ts" | head -4
import.meta.env = {"BASE_URL": "/", "DEV": true, "MODE": "development", "PROD": false, "SSR": false};// Updated to use environment variables for Vercel deployment
import { createClient } from "/node_modules/.vite/deps/@supabase_supabase-js.js?v=4fb556a8";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mulsqxfhxxdsadxsljss.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…";
```

**Paso 3 — con las variables locales CORRECTAS, Playwright no se queja de nada:**

```
$ VITE_SUPABASE_URL="http://127.0.0.1:54331" VITE_SUPABASE_ANON_KEY="…" npx playwright test --list
  ...
  [chromium] › recorder.spec.ts:40:3 › Recorder popup smoke › captures a chunk into IndexedDB after starting the recorder
Total: 99 tests in 14 files
```

**Paso 4 — la reutilización, medida.** `--list` **no arranca `webServer`** (comprobado: con el 8080
libre, sigue libre antes y después de `--list`), así que no sirve para demostrar el enganche. Se
midió con una **sonda desechable** —`probe-reuse/`, fuera de `tests/e2e/`, con el bloque `webServer`
**copiado verbatim** de `playwright.config.ts:43-48` y un único test que no abre navegador ni navega:

```
### CASO D-1: CI sin definir (reuseExistingServer = true) — 8080 ocupado por el servidor productivo
PID en 8080 ANTES: 16055
  ✓  1 probe-reuse/spec/noop.spec.ts:2:1 › noop — no abre navegador, no navega (5ms)
  1 passed (460ms)
PID en 8080 DESPUES: 16055

### CASO D-2: CI=1 (reuseExistingServer = false) — mismo 8080 ocupado
Error: http://localhost:8080 is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.
PID en 8080 DESPUES: 16055
```

**Mismo PID antes y después en D-1: Playwright se enganchó al servidor productivo y nunca lanzó el
suyo.** Con `reuseExistingServer: false` (D-2) **aborta**. Ésa es la medición que decide el diseño.

**Ningún spec de `tests/e2e/` se ejecutó en ninguno de los dos casos.**

### S5.3 — Qué debe especificar la guarda: **lista blanca, en tres capas**

**Capa 1 — entorno del proceso (necesaria, no suficiente).** En `playwright.config.ts`, **después
de la línea 21** (cierre del bloque que carga `.env.test`) y **antes de la línea 23**
(`export default defineConfig`), donde corre antes de que `webServer` lance nada:

1. `process.env.VITE_SUPABASE_URL` **está definida** — si falta, el fallback lleva a producción.
2. Su valor **pertenece a una lista blanca explícita**: `http://127.0.0.1:54331` y
   `http://localhost:54331`, y nada más. **Cualquier otro valor aborta**, incluidos un hostname
   productivo propio, otro proyecto Supabase remoto y **el proyecto local ajeno de `54321`**.
   *Lista blanca, no lista negra: no se enumera lo prohibido.*
3. `process.env.VITE_SUPABASE_ANON_KEY` **está definida** — si falta, se usa la clave de producción.
4. Fallar con `throw` y mensaje en español nombrando la variable culpable y el valor rechazado.

**Capa 2 — cerrar el agujero de reutilización.** Las dos cosas, y las dos están medidas:

- **`reuseExistingServer: false`, siempre** (no `!process.env.CI`). Medido en D-2: con el puerto
  ocupado **aborta** en vez de engancharse.
- **Puerto de test dedicado, distinto de 8080**, para que un `npm run dev` productivo abierto no
  pueda ser reutilizado jamás **y** para no matar la sesión de desarrollo de Brent. Medido que
  funciona:
  ```
  $ VITE_SUPABASE_URL="http://127.0.0.1:54331" VITE_SUPABASE_ANON_KEY="…" npm run dev -- --port 8111 --strictPort
    ➜  Local:   http://localhost:8111/
  ```
- **`--strictPort` es obligatorio.** Sin él, `vite` **cambia de puerto en silencio** si el suyo está
  ocupado — medido, un segundo `npm run dev` se fue solo al 8081:
  ```
  $ nohup npm run dev &          # con el 8080 ya ocupado
    ➜  Local:   http://localhost:8081/
  $ lsof -nP -iTCP:8081 -sTCP:LISTEN
  node    17993 brentcurtis   24u  IPv6 0x51c6eb87eed53b5a      0t0  TCP *:8081 (LISTEN)
  ```
  `vite.config.ts:9-12` **no declara `strictPort`**. Con `--strictPort` el fallo es inmediato y
  ruidoso: `Error: Port 8111 is already in use`.

**Capa 3 — comprobar el SERVIDOR REAL, no el entorno del proceso.** Es la única capa que distingue
«mis variables están bien» de «el servidor al que apunto está bien». Va en un **`globalSetup`**, y
eso **está medido**: `globalSetup` corre **después** de que `webServer` esté arriba y **antes** de
cualquier test.

```
$ npx playwright test --config=probe-reuse/probe2.config.ts
[WebServer]   npx update-browserslist-db@latest
[globalSetup] servidor responde HTTP 200
[globalSetup] VITE_SUPABASE_URL horneada = "http://127.0.0.1:54331"

Running 1 test using 1 worker
  ✓  1 probe-reuse/spec/noop.spec.ts:2:1 › noop — no abre navegador, no navega (5ms)
```

**Cómo se lee la URL horneada, con precisión** — y aquí la r1 mostraba la línea equivocada:

```
$ curl -s "http://localhost:8111/src/integrations/supabase/client.ts" | grep -m1 "SUPABASE_URL ="
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mulsqxfhxxdsadxsljss.supabase.co";
```

**Esa línea es texto fuente y NO cambia nunca**: aparece idéntica apunte el servidor a donde apunte.
Leerla no prueba nada. Lo que hay que leer es **la inyección de `import.meta.env`** que Vite antepone
al módulo:

```
--- servidor local (8111) ---
VITE_SUPABASE_URL = "http://127.0.0.1:54331"
VITE_SUPABASE_ANON_KEY presente = true

--- servidor productivo (8080), medido en el paso 2 ---
import.meta.env = {"BASE_URL": "/", "DEV": true, "MODE": "development", "PROD": false, "SSR": false}
  → VITE_SUPABASE_URL = undefined     ⇒ el código cae al literal de producción
```

La capa 3 debe: hacer `GET <baseURL>/src/integrations/supabase/client.ts`, extraer el objeto
`import.meta.env = {…};`, y exigir que `VITE_SUPABASE_URL` **esté en la lista blanca** y que
`VITE_SUPABASE_ANON_KEY` **esté presente**. Si no, `throw` y ningún test corre.

### S5.4 — Mutaciones que la prueban: **cinco casos, no tres**

Los tres primeros se prueban con `--list` (basta: la capa 1 revienta al cargar la config).
**D) y E) exigen la sonda con `webServer`, porque `--list` no arranca servidor** — medido en S5.2.

```bash
# A) URL de producción explícita  → debe abortar
VITE_SUPABASE_URL=https://mulsqxfhxxdsadxsljss.supabase.co \
VITE_SUPABASE_ANON_KEY=x npx playwright test --list

# B) URL ausente (cae al fallback hardcodeado) → debe abortar
env -u VITE_SUPABASE_URL -u VITE_SUPABASE_ANON_KEY npx playwright test --list

# C) URL local pero clave ausente (clave de producción) → debe abortar
env -u VITE_SUPABASE_ANON_KEY VITE_SUPABASE_URL=http://127.0.0.1:54331 \
  npx playwright test --list

# D) servidor PRODUCTIVO ya escuchando en el puerto de test → debe abortar
#    (arrancar `env -u VITE_SUPABASE_URL -u VITE_SUPABASE_ANON_KEY npm run dev -- --port <TEST_PORT>`
#     y después lanzar la suite con las variables locales CORRECTAS)
#    Hoy, sin guarda: se engancha y pasa. Medido en S5.2/D-1.
#    Con la capa 2 aborta por puerto ocupado; con la capa 3, si algo lo dejara pasar,
#    aborta al leer `import.meta.env` del servidor real.

# E) URL apuntando al proyecto local AJENO → debe abortar
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=x \
  npx playwright test --list
```

**Por qué E) no es teórico:** el proyecto ajeno está vivo y responde igual de bien que el nuestro.
Una lista negra de `mulsqxfhxxdsadxsljss` lo dejaría pasar entero:

```
$ curl -s -o /dev/null -w "http://127.0.0.1:54321/rest/v1/ → HTTP %{http_code}\n" "http://127.0.0.1:54321/rest/v1/"
http://127.0.0.1:54321/rest/v1/ → HTTP 200
$ curl -s -o /dev/null -w "http://127.0.0.1:54331/rest/v1/ → HTTP %{http_code}\n" "http://127.0.0.1:54331/rest/v1/"
http://127.0.0.1:54331/rest/v1/ → HTTP 200
$ docker ps --format '{{.Names}}\t{{.Ports}}' | grep 54321
supabase_kong_sxlogxqzmarhqsblxmtj	0.0.0.0:54321->8000/tcp, [::]:54321->8000/tcp
```

**Caso de control:** URL **y** clave del stack local, en el puerto de test → lista los specs (o los
corre) sin error.

**No se escribió la guarda. Es `E-infra-impl`.**

## S6 — Plantilla de entorno · **MET** 〔r1 · `6d45f35`〕

`.env.test` está ignorado (`.gitignore:18`), así que **no puede ser la plantilla commiteada**.
Comprobado que `.gitignore` no ignora el nombre propuesto:

- **Fichero commiteable: `.env.test.example`** — el bloque ignora `.env`, `.env.local`, `.env.test`,
  `.env.production.local`, `.env.development.local`; **ninguna entrada es un glob** que atrape
  `.env.test.example`. Sigue la convención que el repo ya usa con `.env.example`.

Contenido propuesto (valores del stack local; **ningún secreto** — las claves del CLI son fijas):

| Variable | Valor | Por qué |
|---|---|---|
| `VITE_SUPABASE_URL` | `http://127.0.0.1:54331` | API local (`[api] port`), y el único valor de la lista blanca |
| `VITE_SUPABASE_ANON_KEY` | la `ANON_KEY` que imprime `supabase start` | clave de demo, igual en toda instalación |
| `TEST_ADMIN_EMAIL` | `admin@e2e.local` | lo lee `tests/e2e/helpers/auth.ts:9` |
| `TEST_ADMIN_PASSWORD` | contraseña sintética del seed | `auth.ts:10` |

〔r2〕 **Verificado que a `165e5f2` no existe `.env.test`** (`ls .env.test` → *No such file or
directory*), así que el bloque de carga de `playwright.config.ts:9-21` hoy no aporta nada y toda la
configuración entra por `process.env`.

## S7 — Seed y cleanup · **MET, y separado en la r2** — **B3**

**〔r1 · `6d45f35`〕 IDs sintéticos deterministas: sí.** `id` es `uuid` con default
`gen_random_uuid()`, pero **acepta valor explícito**. Cleanup determinista verificado
(`DELETE 2` → `count(*) = 0`). **Costo: cero**, todo local. `supabase db reset` (~40 s) es el
cleanup nuclear. `guid` tiene `UNIQUE`, así que los GUIDs sintéticos también deben ser
deterministas (`e2e-guid-0001`) para que un re-run tras un cleanup fallido dé un error claro y no
un duplicado.

### 〔S7 · r2〕 Dos conjuntos con rangos de UUID distintos y reconocibles

La r1 dejaba a §S8.3 sembrar filas de liturgia/episodio y a §S8.6 sembrar y borrar las suyas, **sin
decir cuáles son de quién**. Se separan así, y el rango es la marca:

| Conjunto | Rango de UUID | Quién lo crea | Quién lo borra |
|---|---|---|---|
| **BASELINE** | `00000000-e2e0-4000-`**`9000`**`-…` | `supabase/seed.sql` | **NADIE.** Ningún test lo toca |
| **PROPIEDAD DEL TEST** | `00000000-e2e0-4000-`**`8000`**`-…` | el propio test, en su `beforeAll`/cuerpo | **el propio test**, en su `afterAll`, y sólo éstos |

El rango `8000` es el que la r1 ya usó para las filas que creó y borró, así que la convención no
cambia de significado; el `9000` es nuevo y es el del baseline.

**Baseline concreto, sembrado y verificado en `165e5f2`:**

```sql
-- admin sintético (ver F4: los cuatro tokens a '' o el login da 500)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000','00000000-e2e0-4000-9000-000000000001',
  'authenticated','authenticated','admin@e2e.local',
  extensions.crypt('e2e-local-synthetic', extensions.gen_salt('bf')),
  now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false, '', '', '', '');

-- SIN ESTA FILA EL USUARIO INICIA SESIÓN PERO NO ES ADMIN  ← B3
insert into public.mesa_abierta_admin_roles (id, user_id, role)
values ('00000000-e2e0-4000-9000-000000000002','00000000-e2e0-4000-9000-000000000001','super_admin');

insert into public.church_podcast_episodes
 (id, title, episode_date, guid, status, published_at, audio_url, audio_size_bytes, duration_seconds)
values
 ('00000000-e2e0-4000-9000-000000000010','[BASELINE] Reflexion publicada','2026-01-04','e2e-baseline-0010','published', now(), 'https://example.invalid/e2e-baseline-0010.mp3', 1234567, 600),
 ('00000000-e2e0-4000-9000-000000000011','[BASELINE] Reflexion borrador','2026-01-11','e2e-baseline-0011','draft', null, null, null, null);

insert into public.liturgias (id, fecha, titulo, created_by)   -- created_by, NO user_id
values ('00000000-e2e0-4000-9000-000000000020','2026-01-04','[BASELINE] Liturgia','00000000-e2e0-4000-9000-000000000001');

insert into public.liturgia_elementos (id, liturgia_id, tipo, orden)
values ('00000000-e2e0-4000-9000-000000000030','00000000-e2e0-4000-9000-000000000020','canto',1);
```

Salidas crudas: `INSERT 0 1`, `INSERT 0 1`, `INSERT 0 2`, `INSERT 0 1`, `INSERT 0 1`.

### 〔S7 · r2〕 B3 — el admin sintético necesita su fila de rol. Medido.

`is_liturgia_admin` se define así (`20260106000000_liturgias_antifonales.sql:64-72`, leído en el
árbol):

```sql
CREATE OR REPLACE FUNCTION is_liturgia_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM mesa_abierta_admin_roles
    WHERE mesa_abierta_admin_roles.user_id = is_liturgia_admin.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Medición en dos pasos, salida cruda:**

```
=== PASO 1: usuario sintetico SOLO en auth.users ===
INSERT 0 1
=== PASO 2: is_liturgia_admin SIN fila de rol ===
 es_admin
----------
 f
(1 row)

=== PASO 4: anadir la fila en mesa_abierta_admin_roles ===
INSERT 0 1
=== PASO 5: is_liturgia_admin CON fila de rol ===
 es_liturgia_admin | es_mesa_admin
-------------------+---------------
 t                 | t
(1 row)
```

**`f` → `t`.** Sembrar sólo `auth.users` da un usuario que inicia sesión y **no es admin**,
exactamente como midió Codex. La fila en `mesa_abierta_admin_roles` es obligatoria, y de paso
habilita también `is_mesa_admin`.

Forma de la tabla, medida (`\d mesa_abierta_admin_roles`): `user_id uuid NOT NULL` con
**`UNIQUE`** y FK a `auth.users(id) ON DELETE CASCADE`; `role` es el enum
`mesa_abierta_admin_role`, cuyos valores son exactamente **`super_admin`** y **`coordinator`**.
El `UNIQUE` significa que el seed no puede insertar dos filas para el mismo usuario.

### 〔S7 · r2〕 El viaje del test de humo, congelado

Hoy `smoke-local.spec.ts` es un nombre sin comportamiento. Queda así:

**Ruta y acciones**

1. **Pre-estado (aserción, no suposición):** consultar `church_podcast_episodes` como `anon` por
   PostgREST contra la URL de la lista blanca. **Debe verse exactamente 1 fila**, la
   `00000000-e2e0-4000-9000-000000000010`. Si se ve otra cosa, el entorno está sucio y el test
   **falla aquí**, antes de escribir nada.
2. **Sembrar el fixture propio:** insertar un episodio `published` con
   `id = 00000000-e2e0-4000-8000-000000000001` y `guid = e2e-guid-8001`, con los cuatro campos que
   exige `published_episode_complete`.
3. **Navegador — login:** `loginAsAdmin(page)` (`tests/e2e/helpers/auth.ts`), con
   `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` del `.env.test`.
4. **Navegador — aserción de admin:** ir a `/admin/roles` y comprobar que **carga y lista roles**.
   Es la ruta que ya ejercita `rbac.spec.ts:86`, así que existe; y sólo pasa si el login **y** la
   fila de `mesa_abierta_admin_roles` funcionan de extremo a extremo.
5. **Aserción de que la app habla con la base LOCAL:** como `anon`, `church_podcast_episodes` debe
   devolver ahora **2 filas** (`…9000-…010` + `…8000-…001`), las dos `published`, y **ninguna**
   `draft`.
6. **Cleanup:** `delete from church_podcast_episodes where id = '00000000-e2e0-4000-8000-000000000001'`
   — **sólo el rango `8000`**, nunca un `delete` sin `where`, nunca el rango `9000`.
7. **Post-estado (aserción):** el conjunto de `id` de la tabla es **exactamente** el conjunto
   baseline `{…9000-…010, …9000-…011}`. Ni más ni menos.

**Contrato de limpieza — I6, sin ambigüedad**

> «Deja la tabla como la encontró» significa: **el conjunto de filas al terminar es idéntico al
> conjunto de filas del paso 1, que es el baseline sembrado por `seed.sql`.** El test borra
> **únicamente** las filas cuyo `id` está en el rango `00000000-e2e0-4000-8000-…`. **Las filas del
> baseline (rango `9000`) NO se borran, ni al final, ni en un `afterAll`, ni en un cleanup de
> emergencia.** Restaurar el baseline no es tarea del test: es tarea de `supabase db reset`.

**Fuera del alcance del humo, y se dice:** qué página pública renderiza los episodios **no está
medido** — la ruta `/reflexiones` es trabajo de E3b y no existe a `165e5f2`. Por eso el paso 5
asegura contra PostgREST y no contra el DOM. Cuando E3b exista, esa aserción se sube al navegador.

---

## S8 — Bloque de plan para `E-infra-impl`

> **Éste es el cuerpo de la fase `E-infra-impl`**, no una nota de bitácora. Un ejecutor lo lee como
> su contrato. **Reescrito en la r2 sobre `165e5f2`.**

### SHA padre

**`165e5f2f01149fafefabea428dd00ce3823ce277`.** No `6d45f35`. Se verifica con
`git rev-parse HEAD` en el árbol de la fase, no por nombre de rama.

*(`main` ha avanzado desde entonces a `981c00f`, del que `165e5f2` es antepasado. Si la fase se
ramifica de un `main` posterior, se re-verifica la precondición de abajo sobre ese SHA y se anota
cuál fue.)*

### Precondición YA VERIFICADA — no es trabajo de esta fase

Lo que la r1 listaba como puntos 1 y 2 del scope **ya está en `main`**, entregado por el hotfix
`165e5f2` fuera del ciclo de fases. **Sale de *Scope*, de *Definition of done* y de *Rollback*.**

| Qué | Dónde | Verificación |
|---|---|---|
| Borrado `[functions.generate-graphic]` (arreglo de F1) | `165e5f2:supabase/config.toml` | `git show main:supabase/config.toml \| grep -c "generate-graphic"` → **0** |
| Puertos fijados `[api] 54331`, `[db] 54332/54333`, `[studio] 54334`, `[local_smtp] 54335`, `[analytics] 54337` | `165e5f2:supabase/config.toml` | `git show 165e5f2 --stat` → **1 fichero, +18/-2** |
| `supabase start` arranca sobre el árbol sin editar nada | medido en la r2 | §S1 〔r2〕: **37.6 s**, `git status --porcelain` limpio |

**Un ejecutor que busque el bloque `[functions.generate-graphic]` para borrarlo no lo encontrará.
Eso es lo esperado, no un fallo.**

### Scope

1. **Crear `supabase/seed.sql`** con, en este orden:
   - los `GRANT` de F2 (`usage on schema`, `select/insert/update/delete on all tables`,
     `usage, select on all sequences`, a `anon` y `authenticated`);
   - el **`ALTER DEFAULT PRIVILEGES`** de S3, para que una migración incremental no vuelva a
     dejar tablas sin privilegios;
   - el **admin sintético** en `auth.users` **con los cuatro tokens a `''`** (F4) **y su fila en
     `mesa_abierta_admin_roles`** (B3);
   - el **baseline** del rango `9000` de §S7 (episodio `published`, episodio `draft`, liturgia con
     `created_by`, elemento de liturgia).
2. **Escribir la guarda anti-producción de §S5.3, en sus tres capas**: lista blanca en
   `playwright.config.ts` tras la línea 21; `reuseExistingServer: false` **y** puerto de test
   dedicado con `--strictPort`; y la comprobación del **servidor real** en un `globalSetup` que lea
   la inyección de `import.meta.env`.
3. **Crear `.env.test.example`** con las cuatro variables de §S6.
4. **Un e2e de humo**, `tests/e2e/smoke-local.spec.ts`, que ejecute exactamente el viaje congelado
   en §S7 — pre-estado, fixture del rango `8000`, login, `/admin/roles`, aserción de 2 filas,
   cleanup del rango `8000`, post-estado.
5. **Documentar el arranque** (`supabase start`, `supabase db reset`, copiar `.env.test.example` →
   `.env.test`) donde el repo documente ya sus gates. **Debe decir explícitamente que `start` solo
   restaura el backup anterior y que la puesta a punto limpia es `db reset`** (F3).

### Out of scope

- Crear ramas de Supabase (ruta B) — decisión de Brent, y la ruta A la hace innecesaria.
- Migrar o tocar los specs existentes.
- `pg_cron` local y el camino de recordatorios de WhatsApp.
- La columna `slug` y su trigger (D12) — es de E3a/E3b.
- La ruta pública `/reflexiones` y cualquier aserción de DOM sobre episodios — es de E3b.

### Criterios

- [I1] `supabase start` arranca sobre el árbol de la fase sin editar nada a mano; salida cruda.
- [I2] **`supabase db reset`** aplica 61/61 sin error **y ejecuta `seed.sql`** (desaparece el
      `WARN: no files matched pattern`); salida cruda. **Toda medición posterior se toma tras este
      reset, no tras un `start`** (F3).
- [I3] Tras el seed, y con salida cruda de `curl` para **`anon` y `authenticated`** sobre **las tres
      tablas**: `anon` lee **200** y ve sólo `published`; el admin sintético ve también el `draft`
      y su liturgia.
- [I4] `select is_liturgia_admin('<uuid del admin sintético>')` → **`t`**; salida cruda.
- [I5] Los **cinco** casos de mutación de §S5.4 (A, B, C, D, E) abortan con código ≠ 0 y **sin**
      arrancar `webServer` ni ejecutar un solo test; salida cruda de los cinco. **D) se prueba con
      un servidor productivo realmente escuchando en el puerto de test.**
- [I6] El caso de control (URL + clave locales, puerto de test) corre la suite sin error.
- [I7] El e2e de humo pasa y cumple el contrato de limpieza de §S7: **borra sólo el rango `8000` y
      deja intacto el baseline `9000`**; se pega el post-estado.
- [I8] Los 11 contenedores de `sxlogxqzmarhqsblxmtj` siguen vivos al terminar; `docker ps`.
- [I9] Gate D18 verde sobre los ficheros que la fase toca.

### Test plan

Con el stack local arriba **y tras `supabase db reset`**:
`npx playwright test tests/e2e/smoke-local.spec.ts`, más los **cinco** comandos de mutación de §S5.4
y su control. **La prueba de que la guarda sirve es que falla**: hay que pegar la salida de los
cinco casos rojos, no sólo la del verde. El caso D) exige levantar antes un `npm run dev` sin
variables en el puerto de test.

### Definition of done

I1-I9 con salida cruda y SHA. `supabase/seed.sql`, `.env.test.example`, `playwright.config.ts`, el
`globalSetup` de la capa 3 y `tests/e2e/smoke-local.spec.ts` commiteados en `phase/E-infra-impl`.
**`.env.test` real nunca commiteado.** `supabase/config.toml` **no se toca**: su parte ya está en
`165e5f2`.

### Rollback

**Todo el alcance de la fase es aditivo**: `seed.sql`, `.env.test.example`, el `globalSetup` y el
spec son ficheros nuevos; el único fichero preexistente que se modifica es `playwright.config.ts`.
`git revert` del commit de fase lo deshace entero. **Nada toca producción ni la base compartida.**
El borrado de `[functions.generate-graphic]` **ya no forma parte de este rollback** — vive en
`165e5f2`, en `main`, y revertirlo volvería a romper `supabase start` para todo el repositorio.

---

## Limpieza (obligatoria, ejecutada) 〔r2〕

```
$ pkill -f "vite"
$ for p in 8080 8111; do lsof -nP -iTCP:$p -sTCP:LISTEN || echo "$p LIBRE"; done
8080 LIBRE
8111 LIBRE

$ supabase stop --project-id mulsqxfhxxdsadxsljss
{"project_id_filter":"mulsqxfhxxdsadxsljss","backup":true,"message":"Stopped supabase local development setup."}

$ docker ps --format '{{.Names}}' | sort
supabase_analytics_sxlogxqzmarhqsblxmtj
supabase_auth_sxlogxqzmarhqsblxmtj
supabase_db_sxlogxqzmarhqsblxmtj
supabase_inbucket_sxlogxqzmarhqsblxmtj
supabase_kong_sxlogxqzmarhqsblxmtj
supabase_pg_meta_sxlogxqzmarhqsblxmtj
supabase_realtime_sxlogxqzmarhqsblxmtj
supabase_rest_sxlogxqzmarhqsblxmtj
supabase_storage_sxlogxqzmarhqsblxmtj
supabase_studio_sxlogxqzmarhqsblxmtj
supabase_vector_sxlogxqzmarhqsblxmtj

$ docker ps --format '{{.Names}}' | wc -l
      11

$ git worktree remove /tmp/wt-m --force
wt-m eliminado
```

**Los 11 contenedores de `sxlogxqzmarhqsblxmtj` siguen vivos y son los únicos que quedan.** El
proyecto ajeno no se tocó en ningún momento, ni en la r1 ni en la r2. La sonda `probe-reuse/` vivía
dentro del worktree desechable y desapareció con él.

## Gate D18

**No aplica, y la razón importa.** El gate se mide sobre los ficheros fuente que la fase modifica o
crea. **Esta fase no modifica ninguno**: su único entregable es este `.md` más la entrada de ledger,
ambos en `docs/plan-audio`. **No se ejecutó ningún gate y no se declara ninguno verde.**

**Nada contra el proyecto remoto:** ni `db push`, ni `db reset --linked`, ni `link`, ni escritura
por MCP. **Ningún spec de `tests/e2e/` se ejecutó** — sólo `--list`, que no arranca servidor
(medido), y una sonda desechable fuera de `tests/e2e/` con un test que no abre navegador.
