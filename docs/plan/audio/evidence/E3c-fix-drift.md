# EVIDENCIA — deriva de migraciones entre `main` y la base desplegada

**Tomada por el PM en el bootstrap de `E4-spike` (2026-08-12), antes de redactar ningún contrato.**
Es la medición que convirtió `E4-spike` en bloqueada y que hizo nacer `E3c-fix`.

**Árbol medido:** `main` = `origin/main` = `db8ed2ead6b66708122491aef66a5ee38ae6b8bd`.
**Base medida:** proyecto Supabase `mulsqxfhxxdsadxsljss` (el compartido con Life OS), vía MCP
`supabase-casa`, rol de servicio de la API de management.
**Host:** `supabase` CLI `2.110.0` · `node` `v22.22.0` · `psql` **ausente** (`command -v psql` vacío).

---

## 1. El defecto que se escapó: `/reflexiones` responde 400 en producción

`E3b` está mergeada y desplegada. La página pide `slug`. La columna no existe en la base.

Consulta exacta que emite la página (`CAMPOS_EPISODIO` en `src/lib/reflexiones/queries.ts:30-31`),
contra la API pública real:

```
$ curl "https://mulsqxfhxxdsadxsljss.supabase.co/rest/v1/church_podcast_episodes\
?select=id,slug,title,description,speaker,cover_url,published_at,episode_date,duration_seconds,audio_url\
&status=eq.published&limit=3"
{"code":"42703","details":null,"hint":null,"message":"column church_podcast_episodes.slug does not exist"}
HTTP=400
```

Control, la misma consulta sin `slug`:

```
$ curl ".../church_podcast_episodes?select=id,title&status=eq.published&limit=3"
[]
HTTP=200
```

**Las dos cosas que dice el control importan:** la tabla responde, y **está vacía**.

Columnas reales de la tabla — **18, sin `slug`**:

```sql
select count(*), string_agg(column_name, ', ' order by ordinal_position)
from information_schema.columns where table_name = 'church_podcast_episodes';
```
```
18 | id, liturgy_id, title, description, speaker, episode_date, audio_url,
     audio_size_bytes, duration_seconds, mime_type, cover_url, guid,
     episode_number, status, published_at, created_by, created_at, updated_at
```

Filas por estado:

```sql
select status, count(*) from church_podcast_episodes group by status;
```
```
[]   -- cero filas, de cualquier estado
```

**Alcance honesto del daño:** como la tabla está vacía, ningún visitante ha perdido contenido. Lo
que ve es el estado de error en español (`No pudimos cargar las reflexiones…`) en vez del estado
vacío. La página no funciona, y no funcionaría tampoco si hubiera contenido.

**Encuadre en el overlay:** es un `ESCAPED DEFECT` — apareció después del `PASS` final de `E3b`.
Ni el ejecutor, ni yo, ni Codex lo vimos, porque las tres verificaciones se hicieron contra el
entorno local que construyó `E-infra-impl`, donde `supabase db reset` sí aplica la migración.
**Mergear a `main` no despliega esquema.** Nadie lo había escrito, así que nadie lo comprobó.

---

## 2. Auditoría completa de deriva — son TRES, no una

```
ficheros de migración en main : 63
versiones aplicadas en la base: 60
```

```
$ comm -23 <migraciones-en-main> <versiones-aplicadas>
20260612000000
20260612000001
20260808120000
```

```
$ comm -13 <migraciones-en-main> <versiones-aplicadas>
(vacío)   -- no hay deriva inversa: la base no tiene nada que main no tenga
```

| Versión | Fichero | Workstream | ¿La aplica `E3c-fix`? |
|---|---|---|---|
| `20260612000000` | `casa_whatsapp_scheduling.sql` | **NO es AUDIO** | **NO** |
| `20260612000001` | `casa_wa_reminders_cron.sql` | **NO es AUDIO** | **NO** |
| `20260808120000` | `church_podcast_episodes_slug.sql` | AUDIO / `E3a` | **SÍ, la única** |

**Por qué esto es la medición más importante del documento:** `supabase db push` aplica **todas**
las pendientes en orden. Un `push` a secas desplegaría las dos migraciones de WhatsApp, que son
la decisión de release de otro workstream y no de AUDIO. El overlay lo prohíbe explícitamente
(§5: enrutar a una fase acotada *"rather than expanding an unrelated feature's scope"*).

Estado del guard del cron, medido para no exagerar el riesgo:

```sql
select (select exists(select 1 from pg_extension where extname='pg_cron')) as pg_cron,
       (select exists(select 1 from pg_extension where extname='pg_net'))  as pg_net,
       coalesce(nullif(current_setting('app.wa_reminders_url', true),''),'(vacio)') as wa_url;
```
```
pg_cron = true | pg_net = true | wa_url = (vacio)
```

`20260612000001` se salta con `RAISE NOTICE` cuando la GUC está vacía (`:37-38`), así que **hoy no
programaría el cron**. Pero `20260612000000` sí crearía su esquema. El riesgo real es desplegar
esquema ajeno, no disparar WhatsApp. Se declara así y no peor de lo que es.

---

## 3. La migración de `E3a`: aditiva, y NO idempotente en dos puntos

`git show main:supabase/migrations/20260808120000_church_podcast_episodes_slug.sql`

Sin `DROP TABLE`, `TRUNCATE` ni `DELETE` (cumple D9 y la regla dura del repo). El único `DROP`
es `DROP TRIGGER IF EXISTS` en `:138`, el patrón normal de recreación idempotente.

Guards, línea por línea:

| Línea | Sentencia | Idempotente |
|---|---|---|
| 16 | `ADD COLUMN IF NOT EXISTS slug TEXT` | sí |
| **39** | `ADD CONSTRAINT podcast_episode_slug_length` | **NO** |
| 43 | `CREATE UNIQUE INDEX IF NOT EXISTS idx_podcast_episodes_slug` | sí |
| 52, 72 | `CREATE OR REPLACE FUNCTION` ×2 | sí |
| 138-139 | `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` | sí |
| **146** | `ADD CONSTRAINT podcast_episode_published_has_slug` | **NO** |

**Consecuencia operativa:** aplicar el fichero dos veces **falla** con `42710 duplicate_object` en
la línea 39. Por eso el criterio de `E3c-fix` no es "la SQL corrió" sino "la SQL corrió **y** la
fila de versión quedó reconciliada", de modo que ningún `db push` futuro la reintente.

El backfill del paso 2 es un **no-op** aquí: recorre las filas `published` con `slug IS NULL` y la
tabla está vacía. Se dice para que nadie lea las 0 filas afectadas como un fallo.

---

## 4. Lo que esto le hace a `E4-spike`

`E4-spike` dependía de `E3b` con la razón correcta: *"sin ruta y sin slug no hay URL de episodio
que previsualizar"*. La ruta está. **El slug no está en la base desplegada, y no hay episodios.**
Así que la dependencia se cumplía en `main` y no en el entorno donde el spike tiene que correr.

Queda además refutado el método del spike; ver §3 de la entrada de ledger del 2026-08-12 y el
bloque reescrito de `E4-spike` en el PLAN.
