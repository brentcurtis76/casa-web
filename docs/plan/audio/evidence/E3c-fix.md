# EVIDENCIA — `E3c-fix` r1 · desplegar el esquema de `E3a` a la base real

**Ejecutor:** Claude (Opus), sesión `AUDIO · E3c-fix · r1 · EXEC`.
**STARTED:** `2026-08-12T14:19:56Z` · **Aplicación de la migración:** `2026-08-12T14:26:19Z` → `2026-08-12T14:26:28Z`.

| Qué | Valor |
|---|---|
| Checkout de ejecución | `/Users/brentcurtis/dev/casa-e3c` |
| Git common dir | `/Users/brentcurtis/dev/casa-web/.git` |
| Rama | `phase/E3c-fix` |
| SHA padre fijado | `db8ed2ead6b66708122491aef66a5ee38ae6b8bd` |
| HEAD al correr los gates | `db8ed2ead6b66708122491aef66a5ee38ae6b8bd` (**árbol idéntico al padre**) |
| Checkout de plan/evidencia | `/Users/brentcurtis/dev/casa-audio`, rama `docs/plan-audio` |
| Proyecto Supabase | `mulsqxfhxxdsadxsljss` (compartido con Life OS) |
| `node --version` | `v22.22.0` |
| `supabase --version` | `2.110.0` |
| `psql` | **ausente** (`command -v psql` vacío) |

**Resultado en una línea:** la migración está aplicada y la fila de versión reconciliada; `/reflexiones`
volvió a servir su estado vacío en producción. **`E3c.6` NO se pudo ejecutar** — el mecanismo de
escritura que el contrato daba por disponible no existe. Detalle en §7.

---

## 1. El mecanismo elegido, y por qué

**Elegido:** `supabase db push` de la CLI, ejecutado contra un **proyecto espejo en el scratchpad**
que contiene las 63 migraciones del repo **menos las dos de WhatsApp**. El repo **no se tocó**.

**Por qué éste y no los otros — cada descarte está medido, no razonado en abstracto:**

| Candidato | Por qué se descarta | Medición |
|---|---|---|
| `supabase db push` a secas sobre el repo | Prohibido por contrato **y** la propia CLI lo rechaza | §2, bloque A |
| MCP `apply_migration` | Registra en `schema_migrations` una versión con timestamp propio ⇒ rompe **E3c.1** | descarte por diseño |
| MCP `execute_sql` con la DDL | **Imposible**: conecta como `supabase_read_only_user` | §7 |
| `psql` | **Ausente en el host** | tabla de arriba |
| Mover fuera las dos migraciones ajenas dentro del repo | Muta el árbol de otro workstream aunque sea temporalmente | descartado a favor del espejo |

**La ventaja concreta del espejo:** la CLI aplica el fichero **y** escribe la fila de historial
**en la misma transacción**, y la versión que registra es la del nombre del fichero —
`20260808120000`, no un timestamp inventado. La reconciliación de `E3c.1` no es un paso posterior
que pueda quedarse a medias: es el mismo commit.

Antes de construir el espejo se verificó que el fichero es **byte a byte** el de `db8ed2e`:

```
$ shasum -a 256 <espejo>/supabase/migrations/20260808120000_church_podcast_episodes_slug.sql
6534032919a10b2c8200f3c1d2d93a7856e297e73ce88a9a786fc3f2c985d151
$ git show db8ed2e:supabase/migrations/20260808120000_church_podcast_episodes_slug.sql | shasum -a 256
6534032919a10b2c8200f3c1d2d93a7856e297e73ce88a9a786fc3f2c985d151
```

**La migración no se reescribió.** Se copió y se verificó el hash.

### 1.1 Dos intentos fallidos antes del bueno — se dejan escritos

El primer espejo contenía **sólo** la migración objetivo. La CLI lo rechazó dos veces:

```
{"code":"LegacyDbConfigIpv6Error","message":"IPv6 is not supported on your current network"}
```
(faltaba `supabase/.temp/pooler-url`; se copió y se resolvió)

```
{"code":"LegacyDbPushMissingLocalError",
 "message":"Remote migration versions not found in local migrations directory."}
```

**Esto es un guard real de la CLI y merece quedar escrito:** no acepta un directorio local que no
explique todo el historial remoto. Por eso el espejo definitivo lleva **61** ficheros (63 − 2) y no 1.

---

## 2. `E3c.7` — el conjunto de pendientes, antes y después

### A) Antes de aplicar, sobre el repo real (`/Users/brentcurtis/dev/casa-e3c`)

```
$ supabase db push --dry-run
DRY RUN: migrations will *not* be pushed to the database.
{"code":"LegacyDbPushMissingRemoteError",
 "message":"Found local migration files to be inserted before the last migration on remote database.",
 "suggestion":"Rerun the command with --include-all flag to apply these migrations:
supabase/migrations/20260612000000_casa_whatsapp_scheduling.sql
supabase/migrations/20260612000001_casa_wa_reminders_cron.sql"}
```

**Hallazgo operativo:** `db push` a secas **ni siquiera arranca** en este repo. Las dos de WhatsApp
son anteriores a la última versión remota, así que la CLI aborta y exige `--include-all`. El riesgo
que el contrato temía existe, pero hoy está además tapado por un guard de la propia herramienta.

### B) Dry-run del espejo, antes de aplicar — **exactamente una**

```
$ supabase db push --workdir <espejo> --dry-run
DRY RUN: migrations will *not* be pushed to the database.
Would push these migrations:
 • 20260808120000_church_podcast_episodes_slug.sql
{"upToDate":false,"dryRun":true,
 "migrations":["20260808120000_church_podcast_episodes_slug.sql"],
 "seeds":[],"roles":[],"message":"Finished supabase db push."}
```

`"seeds":[]` y `"roles":[]` — no se sembró nada ni se tocaron roles.

### C) Después de aplicar, sobre el repo real — **E3c.7 cerrado**

```
$ supabase db push --dry-run
{"code":"LegacyDbPushMissingRemoteError", … suggestion:
supabase/migrations/20260612000000_casa_whatsapp_scheduling.sql
supabase/migrations/20260612000001_casa_wa_reminders_cron.sql}

$ supabase db push --include-all --dry-run
DRY RUN: migrations will *not* be pushed to the database.
Would push these migrations:
 • 20260612000000_casa_whatsapp_scheduling.sql
 • 20260612000001_casa_wa_reminders_cron.sql
{"upToDate":false,"dryRun":true,
 "migrations":["20260612000000_casa_whatsapp_scheduling.sql",
               "20260612000001_casa_wa_reminders_cron.sql"],
 "seeds":[],"roles":[],"message":"Finished supabase db push."}
```

**Pendientes = exactamente las dos ajenas. `20260808120000` ya NO aparece.** Que es justo la prueba
de que ningún `db push` futuro reintentará la migración no idempotente y morirá con `42710`.

> ### ⚠️ CORRECCIÓN (r2, tras el BLOCKING B1 de Codex) — esto NO prueba que no se desplegara nada ajeno
>
> La r1 leyó este resultado como «las dos de WhatsApp siguen sin desplegarse». **Es falso, y la
> producción lo desmiente:** las 9 columnas y los 3 índices de `20260612000000` **están en la base**,
> y el cron de `20260612000001` **lleva activo desde el 2026-06-12 con 62 ejecuciones**.
>
> **«Pendiente en el historial» ≠ «DDL ausente».** Lo que este dry-run prueba es exactamente una
> cosa —**el estado del historial de migraciones**— y nada sobre el esquema realmente desplegado.
> La r1 confundió las dos, y era precisamente la afirmación negativa de más consecuencia de la fase.
>
> **Lo que sí queda probado, y con eso basta para el alcance de esta fase:** que **`E3c-fix` no
> desplegó nada ajeno**. Tres pruebas independientes, **y ninguna depende de fechar la deriva**:
>
> - las sentencias registradas de `20260808120000` son **10, 9 tocan `church_podcast_episodes`, 0
>   tocan WhatsApp**;
> - el proyecto espejo **no contenía** los dos ficheros (`63 → 61`, §1);
> - los dos dry-run y el push **nombraron una sola migración**.
>
> **Precisión de la r3 (Codex S1):** la r2 escribía aquí «una cronología fechada que sitúa esa deriva
> dos meses antes», y eso decía de más. Lo que hay, con su alcance exacto: el **cron** está fechado
> por `cron.job_run_details` (primera ejecución **2026-06-12**); los **3 índices** sólo están
> **ordenados** antes de esta fase por OID (455068-455070, **1.460 por debajo** de los de hoy), sin
> fecha; y de las **9 columnas** consta que existen, pero **su fecha de creación no está medida**.
> La cronología es contexto para el workstream dueño — **no** es lo que sostiene el alcance de AUDIO.
>
> **Medición completa, cronología y entrega al workstream dueño: `evidence/E3c-fix-whatsapp-drift.md`.**
> AUDIO **no ha tocado** nada de eso y no debe hacerlo.

---

## 3. Las dos lecturas de `schema_migrations`

Pedidas explícitamente por el prompt §5, porque esta base la comparten sesiones concurrentes.

### Antes (`2026-08-12 14:25:29.764849` UTC, ~50 s antes de aplicar)

```sql
select now() at time zone 'utc' as leido_utc, count(*) as total_versiones, max(version) as ultima,
       (select count(*) from supabase_migrations.schema_migrations
         where version = '20260808120000') as ya_registrada
from supabase_migrations.schema_migrations;
```
```
leido_utc = 2026-08-12 14:25:29.764849 | total_versiones = 60
ultima = 20260806000000 | ya_registrada = 0
```

### La aplicación

```
$ supabase db push --workdir <espejo> --yes
Initialising login role...
Connecting to remote database...
Do you want to push these migrations to the remote database?
 • 20260808120000_church_podcast_episodes_slug.sql
 [Y/n] y
Applying migration 20260808120000_church_podcast_episodes_slug.sql...
{"upToDate":false,"dryRun":false,
 "migrations":["20260808120000_church_podcast_episodes_slug.sql"],
 "seeds":[],"roles":[],"message":"Finished supabase db push."}
```

### Después

```sql
select version, name from supabase_migrations.schema_migrations
where version >= '20260806000000' order by version;
```
```
20260806000000 | mesa_main_dish_optout
20260808120000 | church_podcast_episodes_slug
```

```sql
select count(*) as total_versiones from supabase_migrations.schema_migrations;
```
```
61
```

```sql
-- ¿hay ALGUNA versión duplicada en toda la tabla?
select version, count(*) as veces from supabase_migrations.schema_migrations
group by version having count(*) > 1;
```
```
[]   -- ninguna, en las 61
```

**Ninguna otra sesión escribió entre las dos lecturas:** 60 → 61, exactamente +1, y el delta es la
versión esperada. **`name` es `church_podcast_episodes_slug`**, la convención de la CLI — no un
nombre inventado.

> **E3c.1 CUMPLIDO.** `20260808120000` aparece exactamente una vez; las versiones ≥ `20260806000000`
> son exactamente las dos esperadas; no hay duplicados en toda la tabla.

---

## 4. `E3c.2` — la columna

**Antes:** 18 columnas, sin `slug`.

```
18 | id, liturgy_id, title, description, speaker, episode_date, audio_url, audio_size_bytes,
     duration_seconds, mime_type, cover_url, guid, episode_number, status, published_at,
     created_by, created_at, updated_at
```

**Después:** 19 columnas; la nueva es la 19.ª.

```sql
select ordinal_position, column_name, data_type from information_schema.columns
where table_schema='public' and table_name='church_podcast_episodes' order by ordinal_position;
```
```
 1 id uuid                   11 cover_url text
 2 liturgy_id uuid           12 guid text
 3 title text                13 episode_number integer
 4 description text          14 status text
 5 speaker text              15 published_at timestamp with time zone
 6 episode_date date         16 created_by uuid
 7 audio_url text            17 created_at timestamp with time zone
 8 audio_size_bytes bigint   18 updated_at timestamp with time zone
 9 duration_seconds integer  19 slug text          ← nueva
10 mime_type text
```
```
column_name = slug | data_type = text | is_nullable = YES
```

> **E3c.2 CUMPLIDO.** 18 → 19, la nueva es `slug text`.

---

## 5. `E3c.3` — los seis objetos, consultados al catálogo

**No inferidos de que la migración no diera error.** Cada uno con su definición leída de `pg_*`.
Estado **antes** de aplicar, para que el delta sea legible:

```sql
select
  (select count(*) from pg_constraint … 'podcast_episode_slug_length')        as chk_slug_length,
  (select count(*) from pg_constraint … 'podcast_episode_published_has_slug') as chk_published_has_slug,
  (select count(*) from pg_indexes    … 'idx_podcast_episodes_slug')          as idx_slug,
  (select count(*) from pg_proc       … 'church_podcast_episode_slug_body')   as fn_slug_body,
  (select count(*) from pg_proc       … 'assign_podcast_episode_slug')        as fn_assign,
  (select count(*) from pg_trigger    … 'trg_podcast_episodes_slug')          as trg_slug;
```
```
chk_slug_length=0 | chk_published_has_slug=0 | idx_slug=0
fn_slug_body=0    | fn_assign=0              | trg_slug=0     ← ninguno existía
```

### Después — los dos `CHECK` (`pg_constraint`)

```
podcast_episode_published_has_slug | c | CHECK (((status <> 'published'::text) OR (slug IS NOT NULL)))
podcast_episode_slug_length        | c | CHECK (((slug IS NULL) OR ((char_length(slug) >= 1)
                                                 AND (char_length(slug) <= 80))))
```

### El índice único (`pg_indexes`)

```
idx_podcast_episodes_slug | CREATE UNIQUE INDEX idx_podcast_episodes_slug
                            ON public.church_podcast_episodes USING btree (slug)
                            WHERE (slug IS NOT NULL)
```

Parcial sobre `slug IS NOT NULL`, como pide `E3a`: varios borradores con `slug NULL` conviven.

### Las dos funciones (`pg_proc`)

```
assign_podcast_episode_slug      | plpgsql | volatile  |
church_podcast_episode_slug_body | sql     | immutable | p_base text, p_budget integer
```

### El trigger (`pg_trigger`)

```
trg_podcast_episodes_slug | tgenabled=O | CREATE TRIGGER trg_podcast_episodes_slug
    BEFORE INSERT OR UPDATE ON public.church_podcast_episodes
    FOR EACH ROW EXECUTE FUNCTION assign_podcast_episode_slug()
```

`tgenabled = 'O'` — habilitado en modo origen, no deshabilitado ni `REPLICA`.

### 5.1 Verificación extra: el cuerpo desplegado es byte a byte el revisado

No la pedía el contrato. Se hace porque es el sustituto más fuerte disponible de `E3c.6` (§7):
comparar el `prosrc` **de la base** con el cuerpo **del fichero**, por SHA-256.

```sql
select p.proname, encode(sha256(p.prosrc::bytea),'hex') as sha256_cuerpo_desplegado,
       length(p.prosrc) as largo, array_to_string(p.proconfig,',') as config
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
      ('church_podcast_episode_slug_body','assign_podcast_episode_slug');
```

| Función | SHA-256 en la **base** | SHA-256 en el **fichero** | ¿Igual? | `proconfig` |
|---|---|---|---|---|
| `assign_podcast_episode_slug` | `bbe078d3…7827eae` | `bbe078d3…7827eae` | **sí** | `search_path=""` |
| `church_podcast_episode_slug_body` | `ea715e35…3155682` | `ea715e35…3155682` | **sí** | `search_path=""` |

```
$ { printf '\n'; sed -n '61,69p' <migración>; } | shasum -a 256
ea715e35057143cd1fa3a29b6be032f119c705525cd1059913b417e843155682
$ { printf '\n'; sed -n '77,135p' <migración>; } | shasum -a 256
bbe078d337ad55218e73c6916b4b2de257a42c1c30f1e411d027d785b7827eae
```

`search_path=""` está puesto en las dos, como exige la migración (`:59`, `:75`).

**Lo que esto prueba y lo que no:** prueba que el código desplegado es *idénticamente* el que los
112 tests de `E3a`/`E3b` ejercitan contra un Postgres real. **No** prueba que se ejecute
correctamente en esta instancia. Eso era `E3c.6`, y sigue abierto.

**Ampliación (r2, SHOULD-FIX S1 de Codex).** `prosrc` es **sólo el cuerpo**. No cubre los atributos
de la función, y decir «el hash coincide» sin esta salvedad hacía sonar la cobertura más ancha de lo
que es: una función con el mismo cuerpo pero `SECURITY DEFINER` sería un objeto muy distinto. Medido
para cerrar el hueco en vez de sólo declararlo:

```sql
select p.proname, p.prosecdef as security_definer, pg_get_userbyid(p.proowner) as propietario,
       array_to_string(p.proacl,',') as acl, p.proisstrict, p.prokind
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
  and p.proname in ('church_podcast_episode_slug_body','assign_podcast_episode_slug');
```

| Función | `security_definer` | Propietario | ACL | `proisstrict` | `prokind` |
|---|---|---|---|---|---|
| `assign_podcast_episode_slug` | **false** (INVOKER) | `postgres` | `=X/postgres, postgres, anon, authenticated, service_role` | false | `f` |
| `church_podcast_episode_slug_body` | **false** (INVOKER) | `postgres` | idem | false | `f` |

**Las dos son `SECURITY INVOKER`** —ninguna escala privilegios—, propiedad de `postgres`, con la ACL
estándar de Supabase. Sumado a `search_path=""` y a la volatilidad de §5, los atributos que importan
quedan verificados y no sólo el cuerpo.

> **E3c.3 CUMPLIDO.** Los seis objetos existen, consultados objeto por objeto. Sin fallo parcial:
> `0/6` antes, `6/6` después.

---

## 6. `E3c.4` y `E3c.5` — producción

### `E3c.4` — la consulta exacta de la página

`CAMPOS_EPISODIO` en `src/lib/reflexiones/queries.ts:30-31`. Clave anon de
`src/integrations/supabase/client.ts:6` (publicable, ya en el repo).

```
$ curl "https://mulsqxfhxxdsadxsljss.supabase.co/rest/v1/church_podcast_episodes\
?select=id,slug,title,description,speaker,cover_url,published_at,episode_date,duration_seconds,audio_url\
&status=eq.published&limit=3" -H "apikey: <anon>" -H "Authorization: Bearer <anon>"
[]
HTTP=200
```

**Antes (medición del PM):** `{"code":"42703","message":"column church_podcast_episodes.slug does not exist"}` · `HTTP=400`.
**Ahora:** `[]` · `HTTP=200`. Cuerpo vacío **correcto**: la tabla sigue con cero filas.

> **E3c.4 CUMPLIDO.** 400 → 200, cuerpo `[]`.

### `E3c.5` — sobre el DOM renderizado, no sobre el código HTTP

El contrato avisa de que el shell SPA devuelve `200` aunque la consulta falle. Las dos cadenas que
**sí** distinguen, leídas del fuente: `Reflexiones.tsx:111` (error) y `Reflexiones.tsx:152` (vacío).

Navegador real sobre `https://www.anglicanasanandres.cl/reflexiones`:

```js
{
  url: "https://www.anglicanasanandres.cl/reflexiones",
  tiene_estado_vacio: true,      // "Todavía no hay reflexiones publicadas."
  tiene_estado_error: false,     // "No pudimos cargar las reflexiones…" AUSENTE
  h1: "Reflexiones",
  num_articulos: 0
}
```

Texto renderizado del `<main>`:

```
Reflexiones
Escucha las reflexiones de nuestra comunidad.
Todavía no hay reflexiones publicadas.
```

Consola del navegador: **sin errores** (`read_console_messages onlyErrors=true` → «No console logs»).

Capa HTTP, por separado:

```
$ curl -sIL https://www.anglicanasanandres.cl/reflexiones   → HTTP=200, 0 redirecciones
$ curl -sI  https://anglicanasanandres.cl/reflexiones       → HTTP=307
```

**Nota lateral, fuera de alcance:** el apex responde `307` y el canónico servido es `www`. Es
material para `E4`/`D19`, no para esta fase; se deja anotado y no se toca.

> **E3c.5 CUMPLIDO.** `200`, estado **vacío** pintado, estado de error ausente, cero errores de consola.

---

## 7. `E3c.6` — **NO CUMPLIDO.** Una premisa del contrato es falsa

El contrato §5 afirma: *«Herramientas disponibles: `supabase` CLI 2.110.0, y el MCP `supabase-casa`
(`apply_migration`, `execute_sql`, `list_migrations`)»*, y de ahí deduce que `E3c.6` es ejecutable.
**No lo es.** Medición:

```sql
insert into public.church_podcast_episodes
  (id, title, episode_date, status, slug, audio_url, audio_size_bytes, duration_seconds)
values ('00000000-0000-4000-8000-0000e3c00001', '[E3C-FIX] fila sintetica de prueba',
        date '2026-08-12', 'draft', 'preferencia-del-cliente-no-debe-guardarse',
        'https://example.invalid/e3c-fix.mp3', 123456, 60)
returning id, status, slug;
```
```
ERROR:  42501: permission denied for table church_podcast_episodes
```

La causa, leída y no supuesta:

```sql
select current_user, session_user, current_setting('is_superuser') as es_superusuario,
       current_setting('transaction_read_only') as solo_lectura;
```
```
current_user = supabase_read_only_user | session_user = supabase_read_only_user
es_superusuario = off | solo_lectura = off
```

**`execute_sql` del MCP conecta como `supabase_read_only_user`.** No es modo lectura de la sesión
(`transaction_read_only = off`): es el **rol**, que no tiene `INSERT` sobre las tablas de `public`.
Ninguna reformulación del SQL lo cambia.

### Por qué los demás caminos tampoco sirven — y por qué no se forzó ninguno

| Camino | Por qué queda descartado |
|---|---|
| MCP `apply_migration` | Es la única escritura privilegiada del MCP, **y registra una versión nueva** en `schema_migrations` ⇒ rompe `E3c.1`, el criterio central de la fase. Encadenar llamadas no converge: cada intento de borrar la fila espuria añade otra. |
| `supabase db push` con una «migración de prueba» | Mismo problema: registra una versión inventada. Y la fila de historial la inserta la CLI **después** de las sentencias, así que una migración no puede borrar la suya propia. |
| `psql` | Ausente en el host (ya medido por el PM). |
| Conexión directa con `node` + `pg` | `pg` no es dependencia del repo, y exigiría **extraer la contraseña de la base del llavero del sistema y ponerla en claro en un comando**. No se hace. |
| Clave `service_role` | No está en el repo ni en el entorno: sólo hay `.env.example` y `.env.test.example`. La clave del repo es la **anon**, sujeta a RLS. |

**Decisión:** se reporta `E3c.6` como **no cumplido** en vez de inventar un mecanismo que rompa
`E3c.1` o que manipule credenciales. El contrato §6 ya contempla la mitad de este caso —
*«Si no puedes dejarla limpia, no lo hagas y repórtalo»*—; aquí ni siquiera se pudo crear la fila.

**Estado de la tabla tras el intento denegado — no quedó basura:**

```sql
select count(*) as filas_totales, count(*) filter (where slug is not null) as con_slug
from public.church_podcast_episodes;
```
```
filas_totales = 0 | con_slug = 0
```

### Lo que sigue sin estar demostrado, dicho sin adornos

Que el trigger **se ejecute** correctamente en esta instancia. Lo que sí está demostrado:

1. el trigger existe, está habilitado y apunta a la función correcta (§5);
2. el cuerpo desplegado de las dos funciones es **byte a byte** el revisado y aprobado en `E3a` (§5.1);
3. ese mismo cuerpo pasa los 112 tests de `E3a`/`E3b` contra un Postgres real (gate de §8).

Es evidencia estática fuerte, y **no** sustituye a una prueba de comportamiento. Queda como punto
ciego declarado de la fase.

---

## 8. `E3c.8` — ninguna tabla de Life OS tocada

**Declaración verificable, en tres patas:**

1. **La única escritura de toda la fase** fue el `supabase db push` de §3, cuyo contenido es el
   fichero `20260808120000_church_podcast_episodes_slug.sql` verificado por SHA-256. Ese fichero
   emite DDL **exclusivamente** sobre `public.church_podcast_episodes` y sus objetos
   (`:15`, `:32`, `:38`, `:43`, `:52`, `:72`, `:138`, `:145`).
2. **Todo lo demás pasó por `execute_sql`, que conecta como `supabase_read_only_user`** — un rol
   que, como demuestra el `42501` de §7, **no puede escribir**. La imposibilidad de `E3c.6` es, de
   paso, la garantía más dura de `E3c.8`.
3. Las 11 tablas de Life OS (`goals`, `habits`, `habit_logs`, `health_logs`, `journal_entries`,
   `life_areas`, `lifeos_calendar_events`, `lifeos_tasks`, `meditation_logs`, `project_health`,
   `workout_logs`) **no se leyeron ni se nombraron** en ninguna sentencia de esta fase.

Sin `DROP`, sin `TRUNCATE`, sin `ALTER` destructivo. El único `DROP` del fichero es
`DROP TRIGGER IF EXISTS` (`:138`), patrón de recreación idempotente ya aprobado en `E3a`.

**Precisión del alcance (r2, a raíz de B1).** Esta afirmación es sobre **lo que hizo esta fase**, no
sobre el estado global de la base. La r1 no marcaba la diferencia con suficiente claridad, y es
justo la distinción que B1 destapó en `E3c.7`. Dicho sin ambigüedad:

- **`E3c-fix` no emitió DDL fuera de `church_podcast_episodes`** — probado por las sentencias
  registradas (10, 9 de podcast, 0 de WhatsApp), por el contenido del espejo y por el rol de sólo
  lectura del resto de las consultas.
- **`E3c-fix` no afirma nada sobre qué más pueda haber en la base sin registrar.** De hecho **hay**
  deriva —la de WhatsApp, del 2026-06-12— y está documentada aparte, sin tocarla, en
  `evidence/E3c-fix-whatsapp-drift.md`.
- Las 11 tablas de Life OS siguen sin leerse ni nombrarse en ninguna sentencia de esta fase.

> **E3c.8 CUMPLIDO**, entendido como «esta fase no tocó nada ajeno», que es lo que el criterio pide.

---

## 9. Gates del repo

**`F` (ficheros fuente modificados) = ∅.** `HEAD` de `phase/E3c-fix` es `db8ed2e`, el propio SHA
padre, y el árbol de trabajo está limpio:

```
$ git diff db8ed2ead6b66708122491aef66a5ee38ae6b8bd --stat
(vacío)
$ git rev-parse HEAD
db8ed2ead6b66708122491aef66a5ee38ae6b8bd
$ git status --short --branch
## phase/E3c-fix
```

**Consecuencia declarada, en vez de reportar un gate no corrido:** el gate por ficheros de D18
(`scripts/gates/changed-files-diagnostics.sh`) **NO APLICA** — no hay ficheros modificados que
comparar. **No se corrió, y no se reporta como verde.**

Consecuencia igual de importante para leer los resultados de abajo: como el árbol **es** `db8ed2e`,
esta corrida **es** la corrida del padre. No cabe regresión de rama: no hay rama que diverja.

| Gate | Comando | Resultado |
|---|---|---|
| Build | `npm run build` | **VERDE**, `✓ built in 7.27s`, `✓ 4988 modules transformed` |
| Tests | `npx vitest run --no-file-parallelism` | **ROJO** — `6 failed \| 1155 passed (1161)` · `1 failed \| 87 passed (88)` ficheros |
| Tipos | `npx tsc --noEmit` | exit `0` — **pero vacuo**, ver abajo |
| Lint | `npm run lint` | exit `1` — `161 problems (118 errors, 43 warnings)` |
| Versiones | `node v22.22.0` · `supabase 2.110.0` | registradas |

### 9.1 El gate de tests: rojo, y las 6 son del padre

```
 FAIL  src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx > MesaAbiertaDashboard > shows pending status for unassigned participant
 FAIL  src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx > MesaAbiertaDashboard > shows assignment details for assigned guest
 FAIL  src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx > MesaAbiertaDashboard > shows assignment details for assigned host
 FAIL  src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx > MesaAbiertaDashboard > displays calendar button for assigned participants
 FAIL  src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx > MesaAbiertaDashboard > shows cancel button for non-cancelled participants
 FAIL  src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx > MesaAbiertaDashboard > displays mystery reminder for assigned participants

 Test Files  1 failed | 87 passed (88)
      Tests  6 failed | 1155 passed (1161)
   Duration  209.29s
```

- **Las 6 son de `mesa-abierta`**, una de las familias que el contrato §7 nombra como rojas de base.
- **Cero fallos en `reflexiones` / `slug` / `podcast`** (`grep -iE '(FAIL|×).*(reflexion|slug|podcast)'` → vacío).
  Los 112 tests que codifican el contrato del slug **pasan contra el esquema recién aplicado**.
- **Cero fallos nuevos respecto de `db8ed2e`**, y aquí la prueba es más fuerte que una comparación:
  el árbol medido **es** `db8ed2e`, mismo SHA, mismo lockfile, mismo `node_modules`.

**Encuadre honesto, sin reetiquetar:** bajo la letra del overlay §5, un gate requerido en rojo es
**`BLOCKED`**, aunque el fallo coincida con la base — y ese es el estado que se reporta. Bajo el
criterio que el propio contrato de `E3c-fix` fija para esta fase («cero fallos nuevos respecto de
`db8ed2e`»), el gate se cumple. **Las dos lecturas se dejan explícitas y la decisión es del PM.**
Lo que no se hace es llamarlo `PASS`.

### 9.2 `tsc --noEmit` sale 0, y no significa nada

```
$ npx tsc --noEmit                                        → exit 0, 0 líneas de salida
$ npx tsc --noEmit --listFiles | grep -v node_modules | wc -l   → 0
```

**Comprueba cero ficheros propios del repo.** Se registra como medición, **no** como evidencia de
sanidad de tipos. Es un defecto conocido del gate, ajeno a esta fase.

### 9.3 Lint: 161, el número de base

`161 problems (118 errors, 43 warnings)` coincide **exactamente** con el total de base registrado en
el ledger al cerrar `E3b` (`eslint=161`). Cero delta. Rojo de base preexistente, no de esta fase.

### 9.4 e2e

**No se corrió.** El contrato la deja condicional (*«Si corres e2e…»*), `F = ∅`, y la suite tiene
familias rojas de base ajenas a AUDIO. Se dice en vez de reportar un gate no ejecutado.

---

## 10. Resumen de criterios

| Criterio | Estado | Evidencia |
|---|---|---|
| **E3c.1** versión registrada una sola vez, sin inventadas | ✅ | §3 |
| **E3c.2** 18 → 19 columnas, `slug text` | ✅ | §4 |
| **E3c.3** los 6 objetos, por catálogo | ✅ | §5 |
| **E3c.4** `curl` 400 → 200, cuerpo `[]` | ✅ | §6 |
| **E3c.5** `/reflexiones` pinta el estado vacío | ✅ | §6 |
| **E3c.6** trigger probado en la base real | ❌ **NO CUMPLIDO** | §7 — premisa del contrato refutada |
| **E3c.7** pendientes = exactamente las dos ajenas | ✅ | §2C — **con la corrección de la r2**: mide el **historial**, no el esquema |
| **E3c.8** esta fase no tocó nada ajeno | ✅ | §8 |
| **E3c.9** esta evidencia | ✅ | este fichero + `E3c-fix-whatsapp-drift.md` |

### 10.1 Qué cambió en la r2 (BLOCKING B1 + SHOULD-FIX S1 de Codex)

| | Cambio |
|---|---|
| **B1** | `E3c.7` ya **no** afirma que no se desplegara nada ajeno. Se separa historial de esquema, se documenta la deriva real de WhatsApp con cronología fechada (2026-06-12, 62 ejecuciones) y se entrega a su workstream sin tocarla. **Se encontró además que la review se quedaba corta:** el cron de `20260612000001` también está desplegado y **activo**. |
| **S1** | La equivalencia por SHA-256 declara ahora que `prosrc` **no** cubre atributos, y se miden los que faltaban: las dos funciones son `SECURITY INVOKER`, `postgres`, ACL estándar. |
| Gates | Recorridos de nuevo sobre el mismo árbol; resultados idénticos (§9). |
| Código fuente | **Ninguno.** `phase/E3c-fix` sigue en `db8ed2e`. Los cambios de la r2 son de documentación, en `docs/plan-audio`. |

---

## 11. Lo más débil de lo hecho, y los puntos ciegos que quedan

**Lo más débil, sin discusión: `E3c.6` no está.** La fase demuestra que el esquema *está*, no que
*funcione*. La mitigación de §5.1 (hash del cuerpo desplegado) es fuerte pero estática: si el
trigger no disparara —por un `ALTER TABLE … DISABLE TRIGGER` posterior, por ejemplo— el hash
seguiría coincidiendo. Lo único que lo acota es `tgenabled = 'O'`, leído hoy.

**Segundo punto débil, y es el error que Codex encontró: la r1 verificó el registro y dedujo el
mundo.** `E3c.7` medía `schema_migrations` y de ahí concluyó que no había esquema ajeno desplegado.
Son dos cosas distintas y la base lo demostró. **Es exactamente el patrón que este plan ya tenía
fichado como D26** —el comando era real, el árbol no era el que la afirmación nombraba—, sólo que
aquí el eje no era la rama sino la capa: historial contra esquema. La corrección de la r2 no es
sólo reescribir la frase: es que **ninguna aserción negativa de esta fase se apoya ya en el
historial de migraciones**. La afirmación que sobrevive —«`E3c-fix` no desplegó nada ajeno»— se
sostiene sobre las sentencias registradas, el contenido del espejo y la cronología por OID, que son
tres fuentes independientes del historial.

**Tercer punto débil: el mecanismo del espejo es correcto pero poco convencional.** Depende de que
la CLI derive la versión del nombre del fichero. Está verificado a posteriori por `E3c.1` y `E3c.7`,
que es exactamente por lo que el contrato puso esos dos criterios; pero si esa derivación cambiara
en una versión futura de la CLI, el método habría que revalidarlo.

**Puntos ciegos que la fase NO cierra:**

1. **Que la página funcione con contenido.** Sirve su estado vacío. No hay episodios, y sembrarlos
   está fuera de alcance. Sigue siendo la decisión pendiente de Brent.
2. **`/reflexiones/<slug>`** no se verificó en producción: sin episodios no hay slug que pedir.
   `E3c.4` cubre la consulta del índice, no la del detalle.
3. **Las 2 migraciones de WhatsApp están desplegadas pero sin registrar** — corregido en la r2; la
   r1 decía aquí «siguen sin aplicar», que era **falso**. `db push` a secas **falla** en este repo
   hasta que su workstream alinee el historial, y **nadie debe correr `--include-all`** mientras
   tanto. Estado heredado del 2026-06-12, no creado aquí:
   `evidence/E3c-fix-whatsapp-drift.md`.
4. **El apex devuelve 307 y el canónico es `www`** — material de `E4`/`D19`.
5. **La corrida de tests es de un solo pase.** `mesa-abierta` ya dio parpadeos en esta suite
   (ledger, `E3b` r6). No se repitió: `F = ∅` y las 6 no tocan AUDIO.

---

## 12. Reproducibilidad

Todo lo de este documento se reproduce con el árbol `db8ed2e` y:

```bash
# identidad
git -C /Users/brentcurtis/dev/casa-e3c rev-parse HEAD          # db8ed2e…
git -C /Users/brentcurtis/dev/casa-e3c diff db8ed2e --stat     # vacío

# estado de pendientes (no aplica nada)
supabase db push --dry-run
supabase db push --include-all --dry-run

# gates
npm ci && npm run build
npx vitest run --no-file-parallelism
```

Las consultas SQL van íntegras en cada sección, ejecutadas vía MCP `supabase-casa`
(`execute_sql`, rol `supabase_read_only_user`) contra `mulsqxfhxxdsadxsljss`.
