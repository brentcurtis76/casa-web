# EVIDENCIA — `E-infra-spike` r1

**Unidad de medición. No se escribió código de producción. No se commiteó ningún fichero fuente.**

- **SHA medido:** `6d45f35a54bde0335d05ffd6943167cf25d0a09e` (worktree desechable `/tmp/wt-einfra`,
  creado con `git worktree add --detach /tmp/wt-einfra 6d45f35`; `git -C /tmp/wt-einfra rev-parse HEAD`
  → `6d45f35a54bde0335d05ffd6943167cf25d0a09e`; `git status --porcelain` → limpio).
- **Fecha:** 2026-08-08.
- **CLI:** `supabase 2.110.0` · **node** `v22.22.0` · **deno** `2.7.11`.
- **Worktree de medición borrado al terminar.** Nada de él se commiteó.

**RESULTADO: la ruta A (stack local) es VIABLE**, con dos condiciones que hay que implementar y
que nadie había medido. Se detallan en F1 y F2, y son el grueso de `E-infra-impl`.

---

## Hallazgos que cambian el plan

### F1 — `supabase start` está roto en `main @ 6d45f35`: `config.toml` declara una función que no existe

`config.toml` declara `[functions.generate-graphic]`, pero el directorio no existe:

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

**No lo causó mi delta de puertos** — mi delta sólo añadió secciones `[api]/[db]/[studio]/…`, y el
error nombra un fichero de función. La traza:

```
$ git log --oneline -3 -S 'functions.generate-graphic' -- supabase/config.toml
55ce9c7 Enforce JWT verification for paid edge functions

$ git log --oneline -3 --all -- supabase/functions/generate-graphic
(salida vacía — el directorio no ha existido nunca en ninguna rama)
```

`55ce9c7` añadió `verify_jwt = true` para una función que nunca existió. **Cualquiera que ejecute
`supabase start` hoy en `main` falla**, y por eso nadie lo había medido: la unidad que iba a
hacerlo es ésta.

**Arreglo (una línea, para `E-infra-impl`):** borrar el bloque `[functions.generate-graphic]` de
`supabase/config.toml`. En la medición lo neutralicé comentándolo en el worktree desechable.
**No se commiteó.**

### F2 — las 61 migraciones no otorgan permisos de tabla; el stack local deja a `anon` sin `SELECT`

Tras arrancar y aplicar las 61 migraciones, **toda** lectura por PostgREST devuelve 401:

```
$ curl -s -w "\nHTTP %{http_code}\n" \
  "http://127.0.0.1:54331/rest/v1/church_podcast_episodes?select=title,status" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
{"code":"42501","details":null,"hint":null,"message":"permission denied for table church_podcast_episodes"}
HTTP 401
```

No es RLS — la política existe y es correcta. Es el `GRANT` de tabla:

```
$ psql -c "select grantee, privilege_type from information_schema.role_table_grants
           where table_name='church_podcast_episodes' order by grantee, privilege_type;"
    grantee    | privilege_type
---------------+----------------
 anon          | REFERENCES
 anon          | TRIGGER
 anon          | TRUNCATE
 authenticated | REFERENCES
 authenticated | TRIGGER
 authenticated | TRUNCATE
 postgres      | DELETE
 postgres      | INSERT
 ...
```

Falta `SELECT/INSERT/UPDATE/DELETE` para `anon` y `authenticated`. **No es específico de esta
tabla** — `liturgias` y `liturgia_elementos` muestran exactamente el mismo hueco.

Causa raíz, medida:

```
$ psql -c "select pg_get_userbyid(defaclrole) as rol_creador, defaclobjtype as tipo, defaclacl::text
           from pg_default_acl where defaclnamespace='public'::regnamespace;"
  rol_creador   | tipo |                          defaclacl
----------------+------+--------------------------------------------------------------
 supabase_admin | r    | {postgres=arwdDxt/…,anon=arwdDxt/…,authenticated=arwdDxt/…}
 postgres       | r    | {postgres=arwdDxt/postgres,anon=Dxt/postgres,authenticated=Dxt/postgres}
```

Las migraciones corren como **`postgres`**, y los privilegios por defecto de ese rol conceden a
`anon` sólo `Dxt` (TRUNCATE/REFERENCES/TRIGGER) — **sin `SELECT`**. Los de `supabase_admin` sí
conceden `arwdDxt`. Y el repo no compensa:

```
$ grep -rn 'grant .* to .*anon' supabase/migrations/
(0 coincidencias)

$ grep -rln 'revoke' supabase/migrations/
(0 coincidencias)
```

**Lectura:** el esquema del repo depende de un estado ambiente del proyecto alojado que el stack
local no reproduce. **En hosted funciona; en local no, y el repo no lo declara en ninguna parte.**

**Arreglo medido y verificado** (`supabase/seed.sql`, que el CLI aplica solo — hoy avisa
`WARN: no files matched pattern: supabase/seed.sql`):

```sql
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
```

Tras aplicarlo, la misma petición devuelve 200 y **RLS filtra correctamente** (ver S3).

---

## S1 — Ruta A, arranque · **MET**

Puertos libres verificados antes de elegirlos (`lsof -nP -iTCP:$p -sTCP:LISTEN` sobre
54331-54340 → los diez libres). El proyecto ajeno `sxlogxqzmarhqsblxmtj` ocupa 54321, 54322,
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
WARNING: Functions using fallback import map: admin-add-participant, admin-user-management, ...
{"DB_URL":"postgresql://postgres:postgres@127.0.0.1:54332/postgres","API_URL":"http://127.0.0.1:54331","REST_URL":"http://127.0.0.1:54331/rest/v1","GRAPHQL_URL":"http://127.0.0.1:54331/graphql/v1","FUNCTIONS_URL":"http://127.0.0.1:54331/functions/v1","MCP_URL":"http://127.0.0.1:54331/mcp","STUDIO_URL":"http://127.0.0.1:54334","PUBLISHABLE_KEY":"sb_publishable_<REDACTADO>","SECRET_KEY":"sb_secret_<REDACTADO>","JWT_SECRET":"super-secret-jwt-token-with-at-least-32-characters-long","ANON_KEY":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","SERVICE_ROLE_KEY":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","MAILPIT_URL":"http://127.0.0.1:54335","INBUCKET_URL":"http://127.0.0.1:54335","STORAGE_S3_URL":"http://127.0.0.1:54331/storage/v1/s3","S3_PROTOCOL_REGION":"local","message":""}
supabase start 2>&1  4.03s user 2.00s system 13% cpu 44.302 total
```

**Tiempo de arranque: 44.3 s** (imágenes ya descargadas; el primer intento incluyó la descarga de
`supabase/postgres:15.8.1.054` y tardó 1 m 35 s).

Las claves de arriba son las **claves fijas de demo del stack local**, idénticas en toda
instalación del CLI. No son secretos.

**Redacción declarada:** `PUBLISHABLE_KEY` y `SECRET_KEY` van como `<REDACTADO>`. Es la única
edición hecha a una salida cruda en todo este documento. **GitHub push protection rechazó el push**
(`GH013`, "Supabase Secret Key", `evidence/E-infra-spike.md:163`). El valor es la clave de demo
fija del CLI local, no una credencial real, pero el bloqueo es correcto como política y no procede
saltárselo. Los valores se reproducen ejecutando `supabase start` en cualquier instalación.

**Los dos stacks conviven.** Los nombres de contenedor llevan el `project_id`, que es distinto
(`mulsqxfhxxdsadxsljss` vs `sxlogxqzmarhqsblxmtj`), así que no colisionan:

```
$ docker ps --format '{{.Names}}' | sort
supabase_analytics_mulsqxfhxxdsadxsljss
supabase_analytics_sxlogxqzmarhqsblxmtj
supabase_auth_mulsqxfhxxdsadxsljss
supabase_auth_sxlogxqzmarhqsblxmtj
supabase_db_mulsqxfhxxdsadxsljss
supabase_db_sxlogxqzmarhqsblxmtj
...
(12 nuestros + 11 ajenos = 23)
```

## S2 — Ruta A, migraciones · **MET**

```
$ cd /tmp/wt-einfra && supabase db reset
...
Applying migration 20260610090000_church_podcast_episodes.sql...
Applying migration 20260610090001_podcast_media_storage.sql...
Applying migration 20260610233000_casa_music_publication_state_liturgy_fk.sql...
NOTICE (00000): constraint "music_publication_state_liturgy_id_fkey" of relation "music_publication_state" does not exist, skipping
Applying migration 20260612000000_casa_whatsapp_scheduling.sql...
Applying migration 20260612000001_casa_wa_reminders_cron.sql...
NOTICE (00000): wa-reminders cron skipped: pg_cron=f pg_net=t
WARN: no files matched pattern: supabase/seed.sql
Restarting containers...
Finished supabase db reset on branch main.
{"target":"local","version":"","message":"Reset local database."}

$ grep -c 'Applying migration' /tmp/dbreset.log
61
```

**Las 61 aplican limpias. Ninguna falla.** `db reset` local, **nunca `--linked`**.

Los `NOTICE` son benignos: patrones `DROP … IF EXISTS` sobre una base recién creada.

**Una degradación real y anotable:** `pg_cron=f` — la extensión `pg_cron` no está en la imagen
local, así que `20260612000001_casa_wa_reminders_cron.sql` **se salta el cron a propósito**. La
migración lo maneja sin fallar, pero un e2e local **no puede probar el camino de recordatorios de
WhatsApp**. Fuera del alcance de AUDIO; queda anotado para quien lo necesite.

## S3 — Ruta A, esquema utilizable · **MET**

Las tres tablas existen y tienen RLS activa:

```
       table_name
-------------------------
 church_podcast_episodes
 liturgia_elementos
 liturgias
(3 rows)

         relname         | relrowsecurity
-------------------------+----------------
 liturgias               | t
 liturgia_elementos      | t
 church_podcast_episodes | t
```

Políticas relevantes:

```
        tablename        |            policyname          |  cmd   |        roles
-------------------------+--------------------------------+--------+----------------------
 church_podcast_episodes | podcast_episodes_admin_all     | ALL    | {public}
 church_podcast_episodes | podcast_episodes_public_read   | SELECT | {anon,authenticated}
 liturgias               | Users can read own liturgias   | SELECT | {public}
 ...
(11 rows)
```

**Lectura real bajo RLS, tras aplicar el `GRANT` de F2.** Sembré dos episodios sintéticos
(uno `published`, uno `draft`) y consulté como `anon` por PostgREST:

```
$ curl … "/rest/v1/church_podcast_episodes?select=title,status&order=title"
[{"title":"[E2E] Reflexion publicada","status":"published"}]
HTTP 200
```

**`anon` ve 1 de 2 filas** — sólo la publicada. La `draft` queda filtrada por
`podcast_episodes_public_read`. Y sobre `liturgias`, cuya RLS es de propietario:

```
$ curl … "/rest/v1/liturgias?select=id"
[]
HTTP 200
```

**Cero filas, con 200.** RLS se comporta exactamente como está diseñada.

**Restricción que hay que respetar al sembrar** (la descubrí fallando):

```
ERROR:  new row for relation "church_podcast_episodes" violates check constraint "published_episode_complete"
```

```
published_episode_complete | CHECK (((status <> 'published') OR
  ((audio_url IS NOT NULL) AND (audio_size_bytes IS NOT NULL) AND
   (duration_seconds IS NOT NULL) AND (published_at IS NOT NULL))))
```

Un episodio `published` **exige** `audio_url`, `audio_size_bytes`, `duration_seconds` y
`published_at`. El seed de `E-infra-impl` tiene que ponerlos los cuatro.

## S4 — Ruta B, sólo preconditions · **PARCIAL — y a propósito**

**No creé ninguna rama.** Lo medible sin gastar:

```
mcp__supabase-casa__list_branches → {"branches":[]}
```

La llamada responde. **Eso no prueba que `create_branch` esté permitido ni que sea gratis**, y no
lo comprobé porque comprobarlo cuesta dinero y es decisión de Brent.

**Costo, de la documentación oficial** (`search_docs` → "Manage Branching usage"):

| Concepto | Valor |
|---|---|
| Compute de una rama (Micro, por defecto) | **USD 0.01344 / hora** |
| Extrapolado | **≈ USD 0.32 / día · ≈ USD 9.81 / mes** |
| Además | egress, disk size y storage de la rama, facturados como los del proyecto |
| **Spend Cap** | **NO cubre Branching Compute** |
| **Compute Credits** | **NO aplican a Branching Compute** (FAQ explícita) |

Cita literal: *"A branch running on the default Micro Compute size starts at 0.01344 per hour."*

**Comando exacto que la crearía** (NO ejecutado):

```bash
supabase branches create e2e --project-ref mulsqxfhxxdsadxsljss
```
o la herramienta MCP `mcp__supabase-casa__create_branch`.

**NO MEDIDO, y hay que decirlo:**
- **El plan de la organización.** Ninguna herramienta MCP disponible expone facturación ni plan
  (`supabase-casa` ofrece 19 herramientas; ninguna es de billing/organización). Branching exige
  plan de pago; si la organización está en Free, la ruta B **no existe**. Sin verificar.
- **Si `create_branch` está autorizado** para este token. Sin verificar, por costo.

**Advertencia de alcance que no estaba en el plan:** una rama de Supabase se construye aplicando
`supabase/migrations`, que contiene **sólo las 61 de CASA**. Una rama **no reproduciría las 11
tablas de Life OS** que sí conviven en producción. Para el bucle de AUDIO da igual, pero significa
que la ruta B no es "una copia de producción" — es "el esquema de CASA en limpio", que es
exactamente lo que la ruta A ya da gratis.

## S5 — Guarda anti-producción: punto de inserción y prueba · **MET**

Hoy la URL productiva llega por **tres vías**, y las tres hay que cerrarlas:

| # | Vía | Fichero:línea | Comportamiento medido |
|---|---|---|---|
| 1 | `VITE_SUPABASE_URL` | `src/integrations/supabase/client.ts:5` | Vite la inyecta desde `process.env` — **verificado** |
| 2 | **Fallback hardcodeado** | `src/integrations/supabase/client.ts:5` | `\|\| "https://mulsqxfhxxdsadxsljss.supabase.co"` |
| 3 | `.env.test` | `playwright.config.ts:9-21` | se carga sólo si existe; **no pisa** lo ya presente en `process.env` (`if (!process.env[key])`) |

**Verificación de la vía 1** (arranqué Vite con la variable y leí el módulo transformado):

```
$ VITE_SUPABASE_URL="http://127.0.0.1:54331" npx vite dev --port 8099
$ curl -s "http://127.0.0.1:8099/src/integrations/supabase/client.ts" | head -3
import.meta.env = {"BASE_URL": "/", "DEV": true, "MODE": "development", "PROD": false, "SSR": false, "VITE_SUPABASE_URL": "http://127.0.0.1:54331"};
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mulsqxfhxxdsadxsljss.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…";
```

**Vite sí inyecta `VITE_*` desde `process.env`.** Y un detalle que decide el diseño de la guarda:
`VITE_SUPABASE_ANON_KEY` **no aparece** en `import.meta.env`, porque no la puse. Es decir, poner
sólo la URL da **URL local + clave anon de PRODUCCIÓN**. La guarda tiene que exigir **las dos**.

**Punto de inserción exacto:** `playwright.config.ts`, **después de la línea 21** (cierre del
bloque que carga `.env.test`) y **antes de la línea 23** (`export default defineConfig`). Ahí
corre en el proceso Node de Playwright **antes** de que `webServer` lance `npm run dev`, así que
aborta antes de tocar nada.

**Qué debe comprobar** — y la ausencia es tan peligrosa como el valor equivocado, por la vía 2:

1. `process.env.VITE_SUPABASE_URL` **está definida** (si falta → fallback a producción → fallar).
2. **No** contiene `mulsqxfhxxdsadxsljss`.
3. `process.env.VITE_SUPABASE_ANON_KEY` **está definida** (si falta → clave de producción).
4. Fallar con `throw` y mensaje en español nombrando la variable culpable.

**Mutación exacta que lo prueba** (tres casos, todos deben salir con código ≠ 0 y **sin** arrancar
`webServer`):

```bash
# A) URL de producción explícita  → debe fallar
VITE_SUPABASE_URL=https://mulsqxfhxxdsadxsljss.supabase.co \
VITE_SUPABASE_ANON_KEY=x npx playwright test --list

# B) URL ausente (cae al fallback hardcodeado) → debe fallar
env -u VITE_SUPABASE_URL -u VITE_SUPABASE_ANON_KEY npx playwright test --list

# C) URL local pero clave ausente (clave de producción) → debe fallar
env -u VITE_SUPABASE_ANON_KEY VITE_SUPABASE_URL=http://127.0.0.1:54331 \
  npx playwright test --list
```

`--list` basta y **no ejecuta ningún test**: si la guarda está bien puesta, revienta al cargar la
config. El caso de control (las dos variables apuntando al stack local) debe listar los specs.

**No escribí la guarda.** Es `E-infra-impl`.

## S6 — Plantilla de entorno · **MET**

`.env.test` está ignorado (`.gitignore:18`, dentro del bloque `# Environment variables`), así que
**no puede ser la plantilla commiteada**. Comprobado que `.gitignore` no ignora el nombre propuesto:

- **Fichero commiteable: `.env.test.example`** — el bloque ignora `.env`, `.env.local`,
  `.env.test`, `.env.production.local`, `.env.development.local`; **ninguna entrada es un glob**
  que atrape `.env.test.example`. Sigue además la convención que el repo ya usa con `.env.example`.

Contenido propuesto (valores del stack local; **ningún secreto** — las claves del CLI son fijas
y públicas):

| Variable | Valor | Por qué |
|---|---|---|
| `VITE_SUPABASE_URL` | `http://127.0.0.1:54331` | API local (`[api] port`) |
| `VITE_SUPABASE_ANON_KEY` | la `ANON_KEY` que imprime `supabase start` | clave de demo, igual en toda instalación |
| `TEST_ADMIN_EMAIL` | `admin@e2e.local` | lo lee `tests/e2e/helpers/auth.ts:9` |
| `TEST_ADMIN_PASSWORD` | contraseña sintética del seed | `auth.ts:10` |

El usuario copia `.env.test.example` → `.env.test`. El admin sintético lo tiene que crear el seed
de `E-infra-impl`; hoy **no existe** ningún usuario en el stack local recién reseteado.

## S7 — Seed y cleanup · **MET**

**IDs sintéticos deterministas: sí.** `id` es `uuid` con default `gen_random_uuid()`, pero **acepta
valor explícito**. Usé el namespace `00000000-e2e0-4000-8000-0000000000NN`, que es
reconocible a simple vista y no colisiona con UUIDs v4 reales.

```sql
insert into public.church_podcast_episodes
 (id, title, episode_date, guid, status, published_at, audio_url, audio_size_bytes, duration_seconds)
values ('00000000-e2e0-4000-8000-000000000001', …);
→ INSERT 0 2
```

**Cleanup determinista: sí, y verificado.**

```sql
delete from public.church_podcast_episodes where id in
 ('00000000-e2e0-4000-8000-000000000001','00000000-e2e0-4000-8000-000000000002');
→ DELETE 2

select count(*) from public.church_podcast_episodes;
 quedan
--------
      0
```

**Costo: cero.** Todo local. `supabase db reset` (~40 s) es el cleanup nuclear si un test deja
basura. `guid` tiene `UNIQUE`, así que los GUIDs sintéticos también deben ser deterministas
(`e2e-guid-0001`) para que un re-run tras un cleanup fallido dé un error claro y no un duplicado.

**Nota fuera de alcance pero relevante para E3a/E3b:** `church_podcast_episodes` **no tiene columna
`slug`** a `6d45f35`. D12 (slug inmutable por trigger) **todavía no existe en el esquema**; es
trabajo de una fase posterior, no un supuesto que E-infra-impl pueda dar por hecho.

## S8 — Bloque de plan para `E-infra-impl`

### Scope

1. **Arreglar F1**: borrar `[functions.generate-graphic]` de `supabase/config.toml`.
2. **Fijar puertos** en `config.toml` (`[api] 54331`, `[db] 54332/54333`, `[studio] 54334`,
   `[local_smtp] 54335`, `[analytics] 54337`).
3. **Crear `supabase/seed.sql`** con: los `GRANT` de F2, un usuario admin sintético en
   `auth.users`, y las filas mínimas de liturgia/episodio que necesiten los tests.
4. **Escribir la guarda anti-producción** en `playwright.config.ts` tras la línea 21, con las
   cuatro comprobaciones de S5.
5. **Crear `.env.test.example`** con las cuatro variables de S6.
6. **Un e2e de humo** que arranque contra el stack local, siembre por IDs deterministas, verifique
   y limpie.
7. **Documentar el arranque** (`supabase start` + copiar `.env.test.example`) donde el repo
   documente ya sus gates.

### Out of scope

- Crear ramas de Supabase (ruta B) — sigue siendo decisión de Brent, y la ruta A la hace innecesaria.
- Migrar o tocar los 16 specs existentes.
- `pg_cron` local y el camino de recordatorios de WhatsApp.
- La columna `slug` y su trigger (D12) — es de E3a/E3b.

### Criterios (≤15 líneas)

- [I1] `supabase start` arranca en limpio desde `main` sin editar nada a mano; salida cruda.
- [I2] `supabase db reset` aplica 61/61 sin error; salida cruda.
- [I3] Tras el seed, `anon` lee por PostgREST **200** y ve sólo `published`; salida cruda de `curl`.
- [I4] Los tres casos de mutación de S5 (A, B, C) salen con código ≠ 0 y **sin** arrancar `webServer`;
      salida cruda de los tres.
- [I5] El caso de control (URL+clave locales) lista los specs sin error.
- [I6] El e2e de humo pasa contra el stack local y deja la tabla como la encontró.
- [I7] Los 11 contenedores de `sxlogxqzmarhqsblxmtj` siguen vivos al terminar; `docker ps`.
- [I8] Gate D18 verde sobre los ficheros que la fase toca.

### Test plan

`npx playwright test tests/e2e/smoke-local.spec.ts` con el stack local arriba, más los tres
comandos de mutación de S5 y su control. La prueba de que la guarda sirve **es que falla**: hay
que pegar la salida de los tres casos rojos, no sólo la del verde.

### Definition of done

I1-I8 con salida cruda y SHA. `supabase/config.toml`, `supabase/seed.sql`, `.env.test.example`,
`playwright.config.ts` y el spec de humo commiteados en `phase/E-infra-impl`. **`.env.test` real
nunca commiteado.**

### Rollback

Todo es aditivo salvo el borrado del bloque `[functions.generate-graphic]`, que apunta a una
función inexistente. `git revert` del commit de fase lo deshace entero; nada toca producción ni la
base compartida.

---

## Limpieza (obligatoria, ejecutada)

```
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

$ git worktree remove /tmp/wt-einfra --force
wt-einfra eliminado
```

**Los 11 contenedores de `sxlogxqzmarhqsblxmtj` siguen vivos y son los únicos que quedan.** Los 12
míos desaparecieron. **El proyecto ajeno no se tocó en ningún momento.**

## Gate D18

**No aplica, y la razón importa.** El gate se mide sobre los ficheros fuente que la fase modifica
o crea. **Esta fase no modifica ninguno**: su único entregable es este `.md` más la entrada de
ledger, ambos en `docs/plan-audio`. **No ejecuté ningún gate y no declaro ninguno verde.**

Tampoco ejecuté `npx playwright test` ni `npm run test:e2e`, ni nada contra el proyecto remoto,
tal como prohíbe el prompt.
