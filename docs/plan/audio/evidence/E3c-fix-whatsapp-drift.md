# DERIVA DE ESQUEMA — las dos migraciones de WhatsApp están **desplegadas sin fila de historial**

**Encontrado por:** Codex, review de `E3c-fix` r1 (BLOCKING B1), 2026-08-12.
**Medido por:** ejecutor de `E3c-fix`, r2, 2026-08-12.
**Precisado en la r3** tras el SHOULD-FIX S1 de Codex: cada afirmación cronológica dice ahora
exactamente qué la sostiene, y cuál **no** está medida. Ver §1.1.
**Dueño: NO es AUDIO.** Este documento existe para entregarlo al workstream de WhatsApp/CASA.
**AUDIO no ha tocado, ni tocará, nada de lo que se describe aquí.**

---

## 1. El hallazgo, en una frase

`20260612000000_casa_whatsapp_scheduling` y `20260612000001_casa_wa_reminders_cron` **no tienen fila
en `supabase_migrations.schema_migrations`**, así que la CLI las da por pendientes — pero **sus
efectos materiales están hoy en la base desplegada**, y el cron de la segunda **está activo y lleva
62 ejecuciones diarias**.

**«Pendiente en el historial» ≠ «DDL ausente».** Ésa es la lección, y `E3c-fix` r1 la dio por
equivalente. Corregido en el PLAN y en la evidencia.

### 1.1 Qué prueba exactamente cada fuente — y qué no

Precisado en la r3 tras el SHOULD-FIX S1 de Codex, que señaló con razón que la r2 escribía «desde el
2026-06-12» para **todo** el conjunto cuando la fecha sólo está medida para una parte.

| Objeto | Qué está probado | Con qué | Qué **no** está probado |
|---|---|---|---|
| Cron `wa_reminders_daily` | **Existe, está activo y corre desde el 2026-06-12** | `cron.job_run_details`, registro fechado, 62 ejecuciones | — |
| Los 3 índices | **Se crearon antes que `E3c-fix`** | orden de OID (salvedad de wraparound) | Su **fecha exacta**. El OID da orden, no calendario |
| Las 9 columnas | **Existen hoy** | `information_schema.columns` | Su **fecha de creación**: `pg_attribute` no guarda marca de tiempo y no hay instantánea previa |
| **Que `E3c-fix` no las creó** | **Probado, y sin depender de ninguna fecha** | sentencias registradas, contenido del espejo, transcripción del push (§4) | — |

**La distinción importa** porque es la que decide el alcance de la fase. Para cerrar `E3c-fix` basta
lo de la última fila —que **esta fase** no tocó nada ajeno—, y eso **no** necesita fechar la deriva.
La cronología de §3 es contexto para el workstream dueño, no soporte del alcance de AUDIO.

**Inferencia razonable que se declara COMO inferencia, no como medición:** las dos migraciones
comparten fecha de nombre (2026-06-12) y workstream, y el cron de una de ellas está fechado ese día,
así que lo más probable es que las dos se aplicaran juntas entonces. **No está medido.**

---

## 2. Qué hay desplegado — medido, no inferido

### 2.1 De `20260612000000` — las 9 columnas y los 3 índices, todos presentes

```sql
select table_name, column_name from information_schema.columns
where table_schema='public' and ((table_name='music_musicians' and column_name in
  ('whatsapp_opt_in_at','whatsapp_opt_in_method','whatsapp_suppressed'))
  or (table_name='church_children_volunteers' and column_name in
  ('whatsapp_enabled','whatsapp_opt_in_at','whatsapp_opt_in_method','whatsapp_suppressed'))
  or (table_name='music_notification_logs' and column_name in ('read_at','failure_reason')));
```
```
church_children_volunteers | whatsapp_enabled          music_musicians          | whatsapp_opt_in_at
church_children_volunteers | whatsapp_opt_in_at        music_musicians          | whatsapp_opt_in_method
church_children_volunteers | whatsapp_opt_in_method    music_musicians          | whatsapp_suppressed
church_children_volunteers | whatsapp_suppressed       music_notification_logs  | failure_reason
                                                       music_notification_logs  | read_at
```
**9 de 9.** Y los tres índices:
```
idx_church_children_volunteers_phone | idx_music_musicians_phone | idx_music_notification_logs_external_id
```
**3 de 3.** Coinciden uno a uno con `:9-34` del fichero de migración.

### 2.2 De `20260612000001` — **el cron existe, está ACTIVO y lleva dos meses corriendo**

**Esto va más allá de lo que la review encontró.** Codex documentó sólo los objetos de
`…000000`. Los efectos de `…000001` también están, y son los que tienen consecuencia operativa:

```sql
select jobid, jobname, schedule, active, left(command,160) as comando_recortado from cron.job;
```
```
jobid=1 | jobname=wa_reminders_daily | schedule=0 18 * * * | active=true
comando (recortado a propósito): SELECT net.http_post(
  url := 'https://mulsqxfhxxdsadxsljss.supabase.co/functions/v1/wa-reminders',
  headers := jsonb_build_object('Content-Type','applic…
```

> **El comando se recorta deliberadamente.** Lleva `WA_REMINDERS_CRON_SECRET` en las cabeceras.
> No se transcribe aquí ni en ningún otro artefacto de esta fase.

### 2.3 La contradicción aparente, resuelta

El bootstrap de `E4-spike` midió `app.wa_reminders_url` **vacía** y concluyó que
`20260612000001` «hoy no programaría el cron» (guard `:37-38`, `RAISE NOTICE`). Esa lectura era
correcta **sobre lo que pasaría si se aplicara ahora** — y llevó a leerla como «el cron no está».
**El cron sí está.** La GUC sigue sin estar puesta a nivel de base:

```sql
select setdatabase::regclass::text, setconfig from pg_db_role_setting
where array_to_string(setconfig,',') ilike '%wa_reminders%';
```
```
[]   -- no hay ningún ajuste persistente con ese nombre
```

**Conclusión honesta:** el cron se creó el 2026-06-12 en condiciones en las que el guard **no**
saltó (GUC puesta de sesión durante la aplicación, o creación manual). **No se puede reconstruir
cuál de las dos fue** con lo que hay en la base, y no se especula más allá de eso.

---

## 3. La fecha del cron — evidencia fechada (y sólo para el cron)

`cron.job_run_details` **es un registro de auditoría con marca de tiempo**:

```sql
select count(*) as n_ejecuciones, min(start_time)::date as primera, max(start_time)::date as ultima,
       count(*) filter (where status='succeeded') as ok
from cron.job_run_details where jobid=1;
```
```
n_ejecuciones = 62 | primera = 2026-06-12 | ultima = 2026-08-12 | ok = 62
```

**Primera ejecución: 2026-06-12** — exactamente la fecha que llevan las dos migraciones en el
nombre, y **dos meses antes** de que `E3c-fix` existiera.

### 3.1 Cronología independiente por OID, para los objetos que no dejan rastro fechado

Los OID de Postgres se asignan de un contador global monotónico. Sirven como **orden relativo**:

| Objeto | OID | Origen |
|---|---|---|
| tabla `church_podcast_episodes` | **454973** | migración `20260610090000` (10-jun) |
| `idx_music_musicians_phone` | **455068** | ← WhatsApp |
| `idx_church_children_volunteers_phone` | **455069** | ← WhatsApp |
| `idx_music_notification_logs_external_id` | **455070** | ← WhatsApp |
| `podcast_episode_slug_length` | **456530** | **`E3c-fix`, hoy 14:26 UTC** |
| `idx_podcast_episodes_slug` | **456531** | **`E3c-fix`, hoy 14:26 UTC** |
| `assign_podcast_episode_slug` | **456533** | **`E3c-fix`, hoy 14:26 UTC** |

Los tres de WhatsApp son **consecutivos** (455068/069/070) y caen **95 OID después** de una tabla
del 10 de junio y **1.460 OID antes** de todo lo que `E3c-fix` creó hoy.

**Lo que esta tabla prueba, dicho estrictamente (precisado en la r3, Codex S1):**

- ✅ **Los tres índices se crearon antes que los objetos de `E3c-fix`.** Eso es todo lo que el orden
  de OID sostiene, y es suficiente para el alcance de la fase.
- ❌ **No les asigna la fecha 2026-06-12.** El OID es un contador, no un calendario. La r2 escribía
  como si lo fuera.
- ❌ **Ser consecutivos no prueba «una sola transacción»**, que es lo que la r2 afirmaba. Sólo
  prueba que nada más consumió un OID entre medias. Es *compatible* con una sola transacción y con
  el orden del fichero (`:27`, `:30`, `:34`), pero no lo demuestra.

**Salvedad ya declarada en la r2:** el contador de OID puede dar la vuelta. En esta base los valores
están en las centenas de miles, sin indicio de wraparound, así que el orden es fiable.

**Y la salvedad que de verdad importa:** ninguna de estas dos cronologías —ni la fechada del §3, ni
la de orden de aquí— es lo que sostiene el alcance de `E3c-fix`. Eso lo sostiene el §4, que no
depende de fechas.

---

## 4. `E3c-fix` no creó nada de esto — tres pruebas independientes

1. **Las sentencias registradas de la migración de AUDIO no mencionan WhatsApp.** La CLI guarda el
   array de sentencias aplicadas:
   ```sql
   select array_length(statements,1) as n,
          (select count(*) from unnest(statements) s where s ilike '%church_podcast_episodes%') as podcast,
          (select count(*) from unnest(statements) s where s ilike '%whatsapp%' or s ilike '%music_musicians%'
             or s ilike '%children_volunteers%' or s ilike '%notification_logs%') as whatsapp
   from supabase_migrations.schema_migrations where version='20260808120000';
   ```
   ```
   n = 10 | podcast = 9 | whatsapp = 0
   ```
2. **El proyecto espejo no contenía los ficheros.** Se copiaron 63 y se borraron los dos de WhatsApp
   **antes** de cualquier `push`: `63 → 61`, verificado en la evidencia principal §1.
3. **Los dos dry-run y el push nombraron una sola migración**, y la salida JSON de la CLI la lista
   por nombre.

Y el orden por OID del §3.1 lo cierra por el otro lado: lo creado hoy tiene OID **1.460 más altos**.
Nada de lo que se aplicó hoy pudo producir un OID inferior.

---

## 5. Qué NO se ha hecho, y por qué

- **No se ha aplicado, reparado ni revertido nada de WhatsApp.** Fuera de alcance de AUDIO por
  contrato, y Codex lo pidió explícitamente en B1.4.
- **No se ha tocado el cron**, aunque esté activo. Desactivarlo o borrarlo es una decisión de
  release de su workstream, no de AUDIO.
- **No se ha escrito la fila de historial que falta.** Tentador y equivocado: `supabase migration
  repair --status applied 20260612000000 20260612000001` alinearía el historial con la realidad en
  un comando — **pero sólo debe hacerlo quien pueda confirmar que lo desplegado coincide de verdad,
  objeto por objeto, con lo que dicen esos dos ficheros hoy.** AUDIO no puede afirmarlo.

## 6. Para el workstream de WhatsApp — lo que hay que decidir

1. **¿Lo desplegado coincide con los ficheros de hoy?** Los ficheros pueden haber cambiado desde el
   12 de junio. Comprobar objeto por objeto antes de tocar el historial.
2. **Si coincide → `migration repair --status applied`** con las dos versiones. Alinea historial y
   realidad sin ejecutar DDL, y desbloquea `supabase db push` en este repo, que **hoy falla en seco**
   (`LegacyDbPushMissingRemoteError`) para cualquiera que lo intente.
3. **Si no coincide**, hay que reconciliar el diferencial antes, y NO con `db push`.
4. **El cron activo es lo urgente de los dos**: dispara un `http_post` diario a las 18:00 con un
   secreto en cabeceras, y nadie lo tiene registrado como desplegado.

---

## 7. Riesgo que esto crea para cualquiera, no sólo para AUDIO

`supabase db push` a secas **falla** en este repo hasta que el historial se alinee. Peor: quien lo
«arregle» con `--include-all` **reaplicaría las dos migraciones**. `20260612000000` es idempotente
(`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`), así que probablemente sobreviviría.
**`20260612000001` no se ha auditado para eso** — y crear un segundo cron duplicado sí tendría
efecto observable. **Nadie debería correr `--include-all` en este repo hasta cerrar el punto 2 del §6.**
