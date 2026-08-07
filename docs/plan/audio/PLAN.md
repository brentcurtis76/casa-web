# PLAN — AUDIO (autopublicación y distribución del podcast CASA)

META
- REPO / ROOT: `casa-web` · plan root `docs/plan/audio/`
- SLUG / PREFIJO DE SESIÓN: `AUDIO`
- BRANCH CONVENTION: `phase/<id>-<slug>` (≤20 chars por DNS de Vercel — `phase/A1-feed`)
- BASE: `main`
- PLAN FROZEN: **parcialmente.** Codex r1 → FAIL (13) · r2 → FAIL (12) · r3 → FAIL (6) ·
  **r5 → PARTIAL PASS**. Esta es la **revisión 6**, que aplica los recortes del consenso.
  Ver §9, §11, §12 y §13 para la trazabilidad finding → cambio.
- **CONGELADAS y ejecutables ya:** A1, A3, A6, A7, A10a, A11-spike.
- **ESTRATEGIA DESDE LA r5 (instrucción de Brent):** el objetivo es un plan **consensuado**, no
  un plan completo. Toda fase que Codex señale por especificar implementación sin trazar el
  código **se retira o se convierte en spike**, en vez de seguir puliéndose ronda tras ronda.
  Simplificar es una salida válida; defender el alcance no lo es.
- Cambios después del congelado requieren una entrada en el Decision Log.

---

## 0. Estado verificado (revisión 2 — medido, no asumido)

**En la revisión 1 escribí que este entorno no alcanzaba `*.supabase.co`. Era falso.** Repetí
una afirmación del documento de entrada dentro de una sección titulada "qué verifiqué", que es
el peor lugar posible para un supuesto. Codex lo detectó (CR-1). Medido ahora:

| Comprobación | Resultado real |
|---|---|
| `GET` feed Supabase | **200** `application/rss+xml; charset=utf-8` |
| `<item>` en el feed | **0 — el catálogo está vacío** |
| Portada del canal (`show/cover.jpg`) | **400 — no existe** |
| `https://anglicanasanandres.cl/podcast/feed.xml` | **307 → `www.`** |
| `https://www.anglicanasanandres.cl/podcast/feed.xml` | **200 `text/html`** (la SPA) |

Eso invalidó dos cosas de la revisión 1: el feed no se puede validar todavía (no hay episodio
ni portada con qué hacerlo), y el dominio que congelé en D4 **no es el dominio productivo**.

Lecturas de código confirmadas (revisión 1, siguen siendo ciertas):

| Afirmación | Evidencia |
|---|---|
| Tabla + RLS pública sólo de `published` | `20260610090000_church_podcast_episodes.sql` |
| Bucket `podcast-media` público, 200 MB; **el único MIME de audio permitido es `audio/mpeg`** (también admite `image/jpeg` e `image/png` para portadas — N1) | `20260610090001_podcast_media_storage.sql:15` |
| `OWNER_EMAIL` es el correo personal | `podcast-rss/index.ts:18` |
| `FEED_SELF_URL` apunta a `*.supabase.co` | `podcast-rss/index.ts:26`, `publishService.ts:22` |
| `cacheControl: '3600'` en audio y portada | `publishService.ts:205`, `:233` |
| Bitrate 128 kbps | `mp3Encoder.ts:18`, `quickProcessor.ts:161` |
| CTA siempre "Escuchar en Spotify" | `SermonCard.tsx:46` |
| Sin ruta `/reflexiones`; home hace `.limit(4)` | `appRoutes.tsx`, `useSermonData.ts:78` |
| Sin `<link>` por item, duración en segundos crudos, sin namespace `podcast:` | `podcast-rss/index.ts:62-102` |
| `vercel.json` sólo tiene el catch-all | `vercel.json` |
| Grabador de liderazgo roto en iOS (ambos mime son webm) | `RecorderPopupPage.tsx:67-68`, `:95-100` |

**Correcciones a la revisión 1 exigidas por Codex (CR-13) — ocho, todas verificadas:**

1. **`publishService` es reintentable, no idempotente de extremo a extremo.** El retry cubre
   `episode_number` ante `23505`; no cubre el resto del flujo.
2. **La inmutabilidad del GUID está *documentada*, no *aplicada*.** Es un `COMMENT ON COLUMN`
   (`migración:99`). Nada en la base lo impide. Igual pasaría con el slug si lo dejara en el
   cliente. → A4.
3. **Sí existe SEO estático genérico.** `index.html` tiene 12 líneas de `og:`, `twitter:`,
   canonical y JSON-LD. Lo ausente es SEO **por episodio**, y la implementación tendrá que
   **reemplazar** esas etiquetas, no duplicarlas. → A10.
4. **`wavesurfer.js@7.12.1` ya se usa extensamente**, no está "sólo instalado":
   `useSermonEditor.ts:5-6` lo importa con `RegionsPlugin`. Eso elimina el riesgo de "no sé qué
   versión hay" que puse en la revisión 1.
5. **WhatsApp sólo conoce `musician` y `children_volunteer`** (`_shared/whatsapp/send-core.ts:10`).
   **No existe audiencia de podcast ni de comunidad.** La revisión 1 lo sobrevendió. Tras confirmar Brent que hoy la distribución propia es pegar enlaces en redes, las fases de audiencia/WhatsApp/boletín se retiran al backlog (r3).
6. **`spotifyValidator` nunca inspecciona el bitrate** (`grep bitrate` → 0 coincidencias). El
   criterio A2.6 de la revisión 1 no probaba nada. → A2.
7. **No hay ninguna ruta pública de liturgia** y las RLS de `liturgias` son de propietario/admin.
   Tener `liturgy_id` no define una URL pública. → A7.
8. **ESLint son 160 problemas, no 159**, y existe `scripts/gates/changed-files-diagnostics.sh`,
   que implementa un gate por ficheros-cambiados mejor que el que yo especifiqué, y documenta
   **62 colisiones** producidas por la estrategia global que yo estaba proponiendo. → §4.

---

## 1. Goal

Que CASA publique el audio de las prédicas desde su propio dominio y su propio feed, que ese
feed esté inscrito en los directorios relevantes para una audiencia hispanohablante en Chile, y
que Spotify pase de ser el hosting a ser un destino más — sin perder episodios ni seguidores.

Condición de éxito, verificable:

- `https://www.anglicanasanandres.cl/podcast/feed.xml` devuelve 200 `application/rss+xml`,
  valida en Cast Feed Validator y Podbase, y contiene el catálogo completo.
- Existe `/reflexiones/<slug>` por episodio, con reproductor y descarga, compartible.
- El programa está listado en Apple, Podcast Index, iVoox y Amazon, alimentados por ese feed.
- Spotify sigue funcionando, alimentado por redirect 301 desde ese mismo feed.

## 2. Non-goals

- **No** migrar el audio fuera de Supabase Storage (ver D2/D3).
- **No** activar video en Spotify (D7).
- **No** construir analítica de podcast propia (descargas, IAB).
- **No** monetización, suscripciones de pago, ni feeds privados.
- **No** tocar las 11 tablas de Life OS.
- **No** borrar la cuenta de Spotify for Creators.
- **No** rediseñar la home. `Sermones.tsx` sólo cambia el destino de su CTA.
- **No** arreglar la base de 1041/160/94/46 diagnósticos preexistentes.
- **No** grabador multipista, monitoreo en vivo ni control remoto de la mesa.

---

## 3. Frozen architectural decisions

| ID | Decisión | Razón |
|---|---|---|
| **D1** | **El feed RSS propio es la fuente de verdad del catálogo.** Todo directorio, incluido Spotify, se alimenta de él. | Es el objetivo entero. |
| **D2** | **El audio y la portada viven en Supabase Storage (`podcast-media`), bucket público.** No se migra dentro de este plan. | Costo marginal bajo; una dependencia menos. |
| ~~**D3**~~ | **Retirada como decisión congelada en la r6.** El disparador de migración de storage (egress > 150 GB/mes) requiere una medición que ninguna fase instala ya — A0.8/A0.9 se recortaron por no servir al Goal. Baja a **nota de backlog**: cuando el costo importe, primero se monta la medición y después se define el umbral. Congelar un disparador que no puede dispararse era teatro. | Codex r5. |
| **D4** | **La identidad pública del feed es `https://www.anglicanasanandres.cl/podcast/feed.xml`** — con `www`, porque el apex responde **307 → www** y enviar el apex a los directorios los haría seguir un redirect permanente hacia una URL distinta de la registrada. Ningún directorio recibe jamás una URL `*.supabase.co` ni el apex. | Corrige CR-2 con medición: apex 307, `www` 200. Cambiar el dominio primario a apex sería otro plan con impacto SEO propio. |
| **D5** | **Alcance honesto, acotado por Codex r5:** el `guid` y el `slug` **de una fila** son inmutables desde el INSERT, impuesto por trigger, y una fila con `slug` **no se puede borrar**. **D5 NO afirma que la identidad del episodio sea irreemplazable** — siguen existiendo dos caminos (borrar un borrador con guid ya asignado; despublicar y publicar otra fila para el mismo episodio). Esa garantía más amplia queda **abierta**, no congelada, hasta que A11-spike la resuelva. | CR-8 + r3/B4 + r5/§4: un `COMMENT` no es garantía; proteger el `UPDATE` deja el `DELETE`; y cerrar el `DELETE` todavía no cierra el reemplazo de identidad. Prefiero una garantía estrecha y cierta a una amplia y falsa. |
| **D6** | **El correo del feed (`itunes:owner`) es institucional**, nunca personal. | Es público y es la llave de verificación de propiedad en cuatro plataformas. |
| **D7** | **No se activa video en Spotify.** *Razón corregida:* la vía de video para shows externos existe, pero **sólo vía Distribution API desde hosts soportados** (Audioboom, Libsyn, Podigee, Podspace, Audiomeans) — que como autohospedados no somos ni seremos. La vía que sí nos aplicaría es reemplazar audio por video en Spotify for Creators, y **la documentación de Spotify no establece su reversibilidad**. Ante una decisión congelada y sin reversibilidad documentada: no se toca. | Enmienda parcial de CR-12. Codex tiene razón en que "catastrófico e irreversible" estaba mal fundado; la fuente que cita tampoco establece reversibilidad. La decisión se sostiene, la razón se corrige. |
| **D8** | **Nunca borrar la cuenta de Spotify for Creators.** Mínimo 45 días de redirect activo; la recomendación es no borrarla nunca. | Se pierde la audiencia. |
| **D9** | **Sólo migraciones aditivas.** Nada de DROP/TRUNCATE/ALTER destructivo. | Regla dura del proyecto. |
| **D10** | **El bitrate de exportación no baja de 96 kbps.** | `spotifyValidator.ts:9` documenta el mínimo de Spotify. |
| **D11** | **Ninguna acción sobre Spotify (A13) ocurre antes de que A6 valide el feed y A12 tenga Apple aprobado.** | El orden es lo que hace que el corte no pierda audiencia. |
| **D12** | **El slug es inmutable una vez publicado**, impuesto por trigger (igual que D5). | Es la URL canónica indexada y compartida. |
| **D13** | **PII de miembros nunca en el feed, ni en prompts de IA, ni en Open Brain.** | Regla dura del proyecto. |
| **D14** | **Todo texto de UI y de feed en español.** | Regla dura del proyecto. |
| ~~**D15**~~ | **Trasladada al workstream `captura`** en la r6, junto con las fases A19/A20. Sigue vigente allí, palabra por palabra: la captura es 100 % web y agnóstica del dispositivo (Windows, macOS, Android, iOS), y donde una plataforma imponga un límite real se degrada de forma explícita y visible. **No se descarta el requisito de Brent; cambia de plan.** | Codex r5: la captura no sirve al Goal de AUDIO. |
| ~~**D16**~~ | **Trasladada al workstream `captura`** en la r6, junto con D15. | Ídem. |
| **D17** | **Ningún aviso automático (WhatsApp, correo) se envía sin una audiencia con consentimiento y baja, y sin una fila de entrega única por (episodio, canal, destinatario).** La idempotencia es una restricción de unicidad en la base, no una columna `announced_at`. **Ninguna fase de este plan implementa esto**: en la r3 se retiraron al backlog. D17 queda vigente como restricción para cuando se retomen — está aquí precisamente para que quien las retome no reinvente `announced_at`. | CR-11 + decisión de Brent (r3): hoy la distribución propia es pegar enlaces en redes; no hay audiencia que notificar. |
| **D18b** | **La previsualización del enlace es la distribución.** Mientras el canal propio sea compartir manualmente en redes, `og:*` y `og:audio` por episodio no son "SEO opcional": son el producto que la gente ve antes de decidir si abre. A10 no se descarta por presupuesto. | Decisión de Brent (r3). |
| **D18** | **Los gates se miden con `scripts/gates/changed-files-diagnostics.sh` sobre los ficheros que la fase toca, contra el SHA padre fijado de esa fase.** Sin esquemas de identidad globales. Build verde absoluto. Todo test nuevo con prueba base-red o de mutación. | CR-9: el gate correcto ya existe en el repo y documenta 62 colisiones del enfoque que yo proponía. |

---

## 4. Gates (D18)

El repo arrastra **1041** diagnósticos `tsc`, **160** ESLint, **94** `deno lint` y **46**
`deno check`. Arreglarlos es non-goal. El gate no es "el total bajó" sino "los ficheros que
toqué no ganaron un diagnóstico nuevo".

**Procedimiento por fase:**

1. Fijar el **SHA padre** de la fase (el commit del que sale su branch) y anotarlo en el
   ledger. No `git merge-base HEAD main` — en una fase dependiente eso no es su base.
2. Medir la base en ese SHA sobre la lista `F` de ficheros que la fase modifica o crea:

```bash
bash scripts/gates/changed-files-diagnostics.sh <fichero> [<fichero> ...]
```

3. Medir igual en HEAD y comparar **mensajes crudos completos**, sin canonicalizar ni agrupar.
4. Además, verde absoluto (no delta):

```bash
npm run build
```

5. Tests: `npx vitest run --no-file-parallelism` y, si toca edge functions, desde
   `supabase/functions/`: `deno test --allow-all .`. Cero fallos nuevos.
6. Registrar `node --version` y `deno --version`.

**Honestidad de tests (D18, alineado con D7 de `docs/plan/PLAN.md`):** todo test nuevo se
prueba **base-red** antes de su fix, con el fallo registrado. Para un test de cobertura sobre
comportamiento ya correcto, el sustituto aceptado es una **prueba de mutación**: nombrar la
mutación y mostrar el test fallando bajo ella. Una afirmación de wiring ("X está conectado a
Y") sólo se prueba con una mutación que corte ese wiring. Una aserción que no puede fallar es
un defecto.

---

## 5. Phase index — 12 unidades (consenso Codex r5, PARTIAL PASS)

| ID | Nombre | Tipo | Status | Codex r5 | Depende de |
|----|--------|------|--------|----------|-----------|
| A0-core | Reconocimiento | Evidencia | TODO | recortada | — |
| A1 | Correctitud del feed + `HEAD` + correo institucional | Código | TODO | **aprobada** | A0.7 |
| A2-core | Entrega de audio: claves versionadas y cache | Código | TODO | recortada | — |
| A3 | Dominio propio del feed (`www`) | Código | TODO | **aprobada** | A1 |
| A4-core | Slug + inmutabilidad por UPDATE y borrado | Código + DB | TODO | recortada | — |
| A5-core | Portada del canal + episodio canario | Evidencia + op | TODO | recortada | A1, A2-core, A4-core |
| A6 | **Validación operativa del feed** | Evidencia | TODO | **aprobada** | A3, A5-core |
| A7 | Páginas públicas `/reflexiones` y `/reflexiones/:slug` | Código | TODO | **aprobada** | A4-core, A5-core |
| A10a | SEO: spike de arquitectura | Spike | TODO | **aprobada** | A7 |
| A11-spike | Backfill: leer el código y escribir el bloque | Spike | TODO | **aprobada** | A0.6, A4-core |
| A14-core | `podcast:guid` + `<link>` por episodio | Código | TODO | recortada | A4-core, A7, backfill |
| A-cutover-spike | Directorios + redirect de Spotify | Spike | TODO | recortada | A6, backfill, A14-core |

**La columna `Status` usa el vocabulario del SOP §2.1** — `TODO` / `IN PROGRESS` / `IN REVIEW` /
`DONE` / `BLOCKED` — y es la única que `/pm-boot` lee para elegir fase. La columna `Codex r5`
es informativa: **aprobada** = congelada tal cual por Codex; **recortada** = reducida en la r6
siguiendo su recomendación, pendiente de una confirmación de que el recorte quedó bien, no de
rediseño.

### Nota para el PM que arranque este plan

`/pm-boot AUDIO` sin fase tomará **A0-core**, que es la primera sin dependencias. Correcto —
pero **A0-core no es una fase que un ejecutor pueda completar solo**: A0.5 (estado del programa
en Spotify for Creators), A0.6 (URL del feed de origen), A0.7 (buzón institucional) y A0.10
(auditoría de contenido musical) exigen consolas y decisiones de Brent. Un ejecutor puede hacer
A0.1–A0.4 (conteos por MCP y `curl`); el resto se lo pide el PM a Brent y se pega como
evidencia.

**Si Brent prefiere empezar por código**, la primera fase ejecutable de punta a punta por un
ejecutor es **A4-core**: sin dependencias, y la tabla `church_podcast_episodes` está **vacía**
(0 filas, verificado), lo que hace el backfill de slugs trivial ahora e incómodo después del
catálogo. `A2-core` también es autocontenida.

**Secuencia:** A0-core → (A1 ‖ A2-core ‖ A4-core) → A3 → A5-core → **A6** → A7 → A10a →
A11-spike → *(bloque de backfill, a planificar)* → A14-core → **A-cutover-spike**.

**Los tres spikes no preaprueban nada.** A10a, A11-spike y A-cutover-spike producen cada uno un
bloque de plan revisable; esos bloques se revisan antes de ejecutarse.

---

## Phase A0-core — Reconocimiento

**Tipo:** evidencia. **No bloqueante para arrancar** — pero dos de sus criterios sí son
prerequisitos puntuales (S3): **A0.6** (feed de origen accesible) bloquea **A11a**, y **A0.7**
(buzón institucional operativo) bloquea **A1** y **A12**. El resto puede quedar abierto.

**Scope:** `evidence/A0-recon.md`.

*(Recortado en la r6: A0.8 (ocupación de Storage) y A0.9 (medición mensual de egress) salen —
servían al disparador D3, que es un costo futuro, no la condición de éxito de §1. Van al backlog.)*

**Out of scope:** cualquier código; provisionar portada o episodios (es A5); validar el feed
en Apple (es A6).

**Acceptance criteria:**
- [ ] A0.1 Conteo de filas en `church_podcast_episodes` por `status`, con la consulta y su salida.
- [ ] A0.2 Conteo de `<item>` en el feed en vivo (hoy: 0).
- [ ] A0.3 Estado de `show/cover.jpg` registrado (hoy: 400).
- [ ] A0.4 Comportamiento de apex vs `www` registrado con `curl -sSI` (hoy: 307 → www; www sirve la SPA).
- [ ] A0.5 Estado del programa en Spotify for Creators confirmado en consola: ¿alojado en Spotify o alimentado por RSS?
- [ ] A0.6 URL del feed de origen de Spotify obtenida y accesible (prerequisito de A11).
- [ ] A0.7 Buzón institucional para `itunes:owner` confirmado como existente y recibiendo correo.
- [ ] A0.10 Muestra de 3 episodios auditada por contenido musical (riesgo de takedown en A12).

**Test plan:** ninguno automatizado. Es reconocimiento; la verificación es la salida cruda en
el artefacto. Lo declaro en vez de inventar criterios.

**Definition of done:** `evidence/A0-recon.md` commiteado, cada criterio con su salida cruda.

**Risks / unknowns:** A0.6 es el que puede doler — si el feed de origen ya no es accesible,
A11 completa se cae y con ella A13.

**Rollback:** ninguno; no modifica el sistema.

**Depende de:** nada.

---

## Phase A1 — Correctitud del feed + correo institucional

**Scope (≤4):** `podcast-rss/render.ts` (**nuevo**, extraer renderizador puro),
`podcast-rss/index.ts`, `podcast-rss/render_test.ts` (**nuevo**).

Cambios: `OWNER_EMAIL` → institucional (D6); `<itunes:duration>` → `HH:MM:SS`; **soporte de
`HEAD`** — hoy el handler devuelve **405** a todo lo que no sea `GET` (`index.ts:131`,
verificado en vivo), y los agregadores hacen `HEAD` sobre el feed rutinariamente (B1).

**Out of scope:** namespace `podcast:` y `<link>` por item (A14); `FEED_SELF_URL` (A3);
pre-render del XML; `podcast-backfill`; `src/`.

**Acceptance criteria:**
- [ ] A1.1 `render.ts` exporta `renderFeed`/`renderItem` puras, sin `Deno.env` ni red.
- [ ] A1.2 `index.ts` sin lógica de plantilla XML.
- [ ] A1.3 `grep -ci gmail supabase/functions/podcast-rss/` → 0.
- [ ] A1.4 `<itunes:duration>` en `HH:MM:SS` con relleno (3661 → `01:01:01`).
- [ ] A1.5 Duración `null` no emite la etiqueta.
- [ ] A1.6 Items sin `audio_url`/`audio_size_bytes`/`published_at` siguen excluidos.
- [ ] A1.7 `<guid isPermaLink="false">` sin transformar (D5).
- [ ] A1.8 `pubDate` en RFC 2822.
- [ ] A1.9 Categoría escapada como `Religion &amp; Spirituality`.
- [ ] A1.10 **`HEAD` devuelve 200 con los mismos headers que `GET` y cuerpo vacío**, no 405 (B1).
- [ ] A1.11 `POST`/`PUT` siguen devolviendo 405 — el soporte de `HEAD` no abre otros métodos.
- [ ] A1.12 Gates D18 sobre los ficheros tocados + build.

**Test plan** — `podcast-rss/render_test.ts`:
- `renderItem emite itunes:duration en HH:MM:SS`
- `renderItem rellena con ceros duraciones menores a una hora`
- `renderItem omite itunes:duration cuando duration_seconds es null`
- `renderItem conserva el guid sin transformar`
- `renderItem escapa comillas dobles en la URL del enclosure`
- `renderFeed usa el correo institucional en itunes:owner`
- `renderFeed escapa el ampersand de la categoría`
- `renderFeed excluye episodios incompletos`
- `renderFeed emite atom:link rel=self`
- `el handler responde 200 a HEAD con cuerpo vacío`
- `el handler sigue respondiendo 405 a POST`

Base-red o mutación por test (D18). Para los de cobertura (guid intacto, escapado), mutación
declarada: quitar el escape / reasignar el guid y mostrar el test rojo.

```bash
cd supabase/functions && deno test --allow-all podcast-rss/
```

**Definition of done:** tests verdes con evidencia base-red/mutación, 10 criterios, gates D18.
**No se despliega aquí** — se despliega con A3.

**Risks:** el refactor a `render.ts` introduce riesgo de regresión a cambio de testabilidad;
hoy el renderizador no tiene un solo test y cambiará dos veces más (A3, A14).

**Rollback:** `git revert`; sin deploy, el feed en vivo no se ve afectado.

**Depende de:** nada (A0.7 confirma el buzón, pero no bloquea escribir el código).

---

## Phase A2-core — Entrega de audio: claves versionadas y cache inmutable

Reescrita tras CR-5. La revisión 1 proponía `cacheControl: 31536000` sobre rutas que
`publishService` **reescribe con `upsert: true`** (`:198-206`, `:227-234`). Eso serviría
contenido viejo durante meses tras una republicación legítima. Inmutabilidad de cache exige
inmutabilidad de URL.

**Scope (≤8):** `publishService.ts`, `mp3Encoder.ts`, `quickProcessor.ts`,
`spotifyValidator.ts`, tests, y un helper `storageKeys.ts` (**nuevo**).

Cambios:
1. Claves **content-addressed**: `episodes/{id}/audio-{hash8}.mp3` y `cover-{hash8}.jpg`, con
   `audio_url`/`cover_url` actualizados en la fila. Cada republicación crea una clave nueva.
2. Con la clave inmutable, `cacheControl: '31536000'`.


**Out of scope (recortado en la r6):** **todo el trabajo de bitrate** — el cambio 128→96, el
parser de cabecera y la decisión mono/estéreo salen del plan. 128 kbps ya satisface D10 y el
mínimo de Spotify; optimizar el tamaño no acerca la condición de éxito de §1. Va al backlog.
Tampoco: re-codificar episodios ya publicados; borrar objetos antiguos (quedan
huérfanos y baratos; su limpieza va al backlog); `audioEnhancer`, `silenceDetector`.

**Acceptance criteria:**
- [ ] A2.1 La clave de audio incluye un hash del contenido; dos blobs distintos → dos claves distintas.
- [ ] A2.2 El mismo blob produce la misma clave (determinista).
- [ ] A2.3 `audio_url` y `cover_url` de la fila se actualizan a la clave nueva en cada publicación.
- [ ] A2.4 Republicar con audio nuevo deja la URL vieja intacta y apunta la fila a la nueva.
- [ ] A2.5 Audio y portada se suben con `cacheControl: '31536000'`.
- [ ] A2.11 Gates D18 + build.

**Test plan:**

`src/lib/sermon-editor/__tests__/storageKeys.test.ts` (**nuevo**):
- `deriva claves distintas para contenidos distintos`
- `deriva la misma clave para el mismo contenido`

`__tests__/publishService.test.ts` (añadir):
- `sube el audio con cacheControl inmutable de un año`
- `actualiza audio_url a la clave nueva al republicar`
- `no reutiliza la clave anterior cuando el audio cambia`

`__tests__/mp3Encoder.test.ts` (**nuevo**):
- `usa 96 kbps cuando no se especifica bitrate`
- `eleva a 96 kbps cualquier bitrate por debajo del mínimo`
- `la cabecera del MP3 producido declara el bitrate esperado` ← parser real, no mock

`__tests__/quickProcessor.test.ts` (añadir):
- `quickProcessor solicita 96 kbps al encoder` ← mutación: volver a 128 debe romperlo

```bash
npx vitest run --no-file-parallelism src/lib/sermon-editor
```

**Definition of done:** tests verdes con base-red/mutación, 11 criterios, A2.9 en el Decision
Log, gates D18.

**Risks / unknowns:**
- **Mono no verificado.** No sé si `quickProcessor` entrega buffer mono o estéreo, ni si
  `lamejs` hace downmix correcto. A2.9 obliga a decidir con medición: si el downmix no es
  trivial, la decisión registrada puede ser **96 kbps estéreo** — y eso cierra la fase
  legítimamente. Lo que ya no se permite es dejarlo abierto.
- Hashear un blob de 45 MB en el navegador cuesta tiempo; medirlo antes de elegir el algoritmo.
- Objetos antiguos quedan huérfanos. Aceptado; limpieza al backlog.

**Rollback:** `git revert`. Los objetos ya subidos siguen sirviéndose; sólo cambia el
comportamiento de subidas futuras.

**Depende de:** nada.

---

## Phase A3 — Dominio propio del feed (`www`)

**Scope (≤5):** `vercel.json`, `podcast-rss/render.ts` (`FEED_SELF_URL`), `publishService.ts`
(`PODCAST_FEED_URL`), `src/lib/__tests__/vercelConfig.test.ts` (**nuevo**),
`evidence/A3-dominio.md`.

**Out of scope:** mover el audio a dominio propio; cambiar el dominio primario de apex a `www`
o viceversa (sería otro plan, con impacto SEO propio — ver Riesgos).

**Acceptance criteria:**
- [ ] A3.1 `vercel.json` tiene un rewrite de `/podcast/feed.xml` a la edge function.
- [ ] A3.2 Ese rewrite precede al catch-all `/(.*)` en el array.
- [ ] A3.3 El catch-all del SPA sigue presente sin cambios.
- [ ] A3.4 `FEED_SELF_URL` y `PODCAST_FEED_URL` son idénticos y usan **`www`** (D4).
- [ ] A3.5 `grep -rn 'supabase.co/functions/v1/podcast-rss' src/ supabase/functions/podcast-rss/` → sólo el destino en `vercel.json`.
- [ ] A3.6 Post-deploy, con un **GET real** (`curl -sS -D - -o /dev/null <FEED www>`) → **200** `application/rss+xml` (hoy devuelve `text/html`). **No `curl -I`**: el handler responde 405 a `HEAD` y, aun con el soporte que añade A1, la verificación de contenido debe hacerse con GET (B1).
- [ ] A3.7 Post-deploy, `HEAD` (`curl -sSI`) → **200** con el mismo `Content-Type`, gracias al soporte añadido en A1 (B1). *(Se retira el requisito de `Content-Length`: el `GET` actual no lo emite y no hay requisito de directorio documentado que lo exija.)*
- [ ] A3.8 Post-deploy: el body es idéntico al de la URL de Supabase salvo `lastBuildDate`.
- [ ] A3.9 `atom:link rel="self"` dentro del feed servido usa `www`.
- [ ] A3.10 El apex sigue respondiendo 307 → `www` y **eso queda documentado** como la razón de D4.
- [ ] A3.11 Gates D18 + build.

**Test plan:**

`src/lib/__tests__/vercelConfig.test.ts` (**nuevo**, lee `vercel.json` del disco):
- `el rewrite del feed existe`
- `el rewrite del feed precede al catch-all del SPA`
- `el catch-all del SPA sigue presente`
- `la URL del feed usa el subdominio www`

`podcast-rss/render_test.ts` (añadir): `atom:link rel=self usa el dominio www`
`publishService.test.ts` (añadir): `PODCAST_FEED_URL usa el dominio www`

```bash
npx vitest run --no-file-parallelism src/lib
cd supabase/functions && deno test --allow-all podcast-rss/
```

A3.6–A3.10 son post-deploy: `curl` crudo en `evidence/A3-dominio.md`.

**Definition of done:** tests verdes, 11 criterios, edge function desplegada, evidencia
commiteada.

**Risks / unknowns:**
- **No verifiqué que Vercel preserve `Content-Type` en un rewrite hacia un origen externo.**
  A3.6/A3.7 existen para probarlo. Si lo reescribe a `text/html`, la alternativa es una
  función de Vercel que haga el fetch y fije los headers — sería una fase aparte.
- Si en el futuro se decide mover el dominio primario al apex, **la URL del feed no debe
  cambiar**: los ~15 directorios ya la tendrían. Habría que mantener `www/podcast/feed.xml`
  sirviendo 200 para siempre.

**Rollback:** `git revert` + redeploy. La URL de Supabase nunca se apaga.

**Depende de:** A1.

---

## Phase A4-core — Slug + inmutabilidad por UPDATE y borrado

Reescrita tras CR-8. La revisión 1 dejaba la inmutabilidad en el cliente, igual que el GUID
hoy — que es sólo un `COMMENT`. Una identidad pública que ~15 directorios van a indexar no se
protege con un comentario.

**Scope (≤8):** migración nueva, `episodeSlug.ts` (**nuevo**), sus tests,
`publishService.ts`, `podcast-backfill/index.ts`, `types.ts` regenerado, tests de integración.

Migración (aditiva, D9):
- `ADD COLUMN slug TEXT`, índice único parcial.
- `CHECK (status <> 'published' OR slug IS NOT NULL)`.
- **Trigger** que hace `guid` **inmutable desde el INSERT** — cualquier `UPDATE` que lo
  cambie se rechaza, sin importar el `status` — y `slug` de transición única `NULL → valor`,
  congelado después. **No basta con "inmutable mientras `status='published'`"**: el flujo real
  permite `published → draft` vía `unpublishEpisode` (`publishService.ts:335`), y desde ahí se
  podría mutar y republicar (B2).
- Backfill de slugs de filas existentes.

Forma: `<episode_date>-<título normalizado>`. ASCII puro. Colisión: sufijo **determinista
derivado del UUID** (p. ej. primeros 6 hex del `id`), no un contador incremental.

**Out of scope:** rutas y páginas (A7); `<link>` en el feed (A14); regenerar slugs existentes.

**Acceptance criteria:**
- [ ] A4.1 `grep -iE 'drop|truncate' <migración>` → 0.
- [ ] A4.2 Índice único parcial sobre `slug WHERE slug IS NOT NULL`.
- [ ] A4.3 **CHECK impide insertar/actualizar a `published` sin slug** — probado con un INSERT que debe fallar.
- [ ] A4.4 **Trigger rechaza `UPDATE` de `guid` en cualquier estado** — probado en `draft` y en `published`.
- [ ] A4.5 **Trigger permite `slug` `NULL → valor` una sola vez** y rechaza todo cambio posterior, en cualquier estado.
- [ ] A4.5b **Secuencia `publish → unpublish → mutar guid/slug → republicar` falla en el paso de mutación** — contra Postgres real.
- [ ] A4.5c **Trigger impide `DELETE` de toda fila con `slug IS NOT NULL`** (identidad pública ya adquirida). Sólo se pueden borrar borradores vírgenes. Cierra el rodeo `DELETE + INSERT`, que la política `podcast_episodes_admin_all` (`FOR ALL`, migración:61) deja abierto a cualquier admin.
- [ ] A4.5d **Secuencia `publish → unpublish → DELETE` falla**, contra Postgres real.
- [ ] A4.6 Toda fila `published` tiene slug tras la migración.
- [ ] A4.7 `slugFromEpisode()` translitera tildes y ñ (`Oración` → `oracion`).
- [ ] A4.8 Colapsa puntuación a un guion, sin guiones al borde; trunca ≤120 en límite de palabra.
- [ ] A4.9 El sufijo de colisión es determinista y derivado del UUID, no un contador.
- [ ] A4.10 `publishService` asigna slug sólo si es null; republicar no lo cambia.
- [ ] A4.11 **El retry de `23505` distingue por nombre de constraint** — una colisión de slug no se trata como colisión de `episode_number` (`publishService.ts:279`).
- [ ] A4.12 `podcast-backfill` asigna slug y no toca el `guid`.
- [ ] A4.13 Tipos regenerados con `slug`.
- [ ] A4.14 Gates D18 + build.

**Test plan:**

`__tests__/episodeSlug.test.ts` (**nuevo**): transliteración, colapso de puntuación, bordes,
truncado, determinismo, sufijo derivado del UUID, título íntegramente no-ASCII.

`__tests__/publishService.test.ts` (añadir):
- `asigna slug al publicar un episodio nuevo`
- `no regenera el slug al republicar`
- `distingue la colisión de slug de la de episode_number por nombre de constraint`

**Tests de integración contra Postgres, no mocks** (A4.3–A4.5) — el ejecutor usa una branch de
Supabase o una instancia local; los mocks no pueden probar un trigger. Comandos y salidas en
`evidence/A4-slug.md`.

```bash
npx vitest run --no-file-parallelism src/lib/sermon-editor
npx supabase db push --dry-run
```

**Definition of done:** tests verdes, 14 criterios, integración contra Postgres demostrada,
gates D18.

**Risks / unknowns:**
- **Paridad del backfill de slugs.** Replicar la transliteración en SQL no coincidirá con la de
  TypeScript. Salida preferida: la migración crea columna/índice/CHECK/trigger, y el backfill
  de filas existentes lo hace un script que usa `episodeSlug.ts` — una sola implementación. Si
  el ejecutor opta por SQL, debe demostrar paridad con un test.
- El CHECK y el backfill tienen orden: el CHECK no puede añadirse antes de que toda fila
  publicada tenga slug. Hoy hay 0 filas (A0.1), lo que hace esto trivial **ahora** y difícil
  después de A11d. Otra razón para ejecutar A4 temprano.
- `unaccent` puede no estar habilitado; verificar con `list_extensions`.

**Rollback:** la columna es nullable y nadie la lee todavía. Revertir el código basta; la
columna se queda (D9). El trigger sí debe removerse si se revierte.

**Límite declarado de esta fase (Codex r5, §4):** A4-core garantiza que **el `guid` y el `slug`
de una fila no se pueden mutar, y que una fila con `slug` no se puede borrar**. **No** garantiza
que la identidad pública del episodio sea irreemplazable: siguen existiendo dos caminos —
borrar un borrador con `guid` ya asignado (el backfill inserta el guid histórico antes de bajar
el audio, `podcast-backfill:248`), y despublicar una fila para publicar otra con guid y slug
nuevos que representen el mismo episodio (`publishService.ts:335`). **Esa garantía más amplia no
se congela aquí**; queda como pregunta abierta para el bloque que salga de A11-spike.

**Depende de:** nada.

---

## Phase A5-core — Portada del canal + episodio canario

Fase nueva, exigida por CR-1. Hoy el feed tiene **0 items** y la portada devuelve **400**:
no hay nada que validar y Apple exige ambos. Esta fase crea el objeto mínimo validable.

**Scope:** portada del canal subida al bucket; un episodio real publicado por el flujo normal;
`evidence/A5-canario.md`.

**Out of scope:** importar el catálogo histórico (A11); validar contra Apple (A6); código —
si algo falla, se levanta como finding y se arregla en la fase que corresponda.

**Acceptance criteria:**
- [ ] A5.1 `show/cover.jpg` existe y devuelve 200 `image/jpeg`.
- [ ] A5.2 La portada es **≥1400×1400, cuadrada, RGB (no CMYK)**, verificado con una herramienta y su salida pegada.
- [ ] A5.3 Un episodio real está `published` vía `publishEpisode`, no por SQL manual.
- [ ] A5.4 El feed contiene exactamente 1 `<item>` bien formado.
- [ ] A5.5 El `audio_url` del canario devuelve 200 `audio/mpeg` con `content-length` > 0.
- [ ] A5.6 El episodio tiene slug (A4) y `enclosure length` coincide con el `content-length` real.
- [ ] A5.7 El episodio canario es contenido legítimo y publicable, no un archivo de prueba — quedará en el catálogo público.

**Test plan:** ninguno automatizado; es provisión operativa. La verificación es la salida
`curl` y la inspección de la imagen.

**Definition of done:** `evidence/A5-canario.md` con salidas crudas; feed con 1 item válido.

**Risks / unknowns:**
- Si `publishEpisode` falla en producción, esta fase devuelve FINDINGS y se arregla antes de
  seguir. Es exactamente el punto: descubrirlo con un episodio, no con cien.
- A5.7 importa: no queremos un "test.mp3" en el catálogo que Apple va a indexar.

**Rollback:** `unpublishEpisode` devuelve el episodio a borrador; el feed vuelve a 0 items.

**Depende de:** A1, A2, A4.

---

## Phase A6 — Validación operativa del feed

Antes era A0. Ahora va **después** de A5, que es lo que la hace ejecutable (CR-1). **Es la
fase bloqueante del plan**: sin ella no hay A12 ni A13.

**Scope:** `evidence/A6-validacion.md`.

**Out of scope:** código; inscribirse en directorios (A12).

**Acceptance criteria:**
- [ ] A6.1 **GET real** (`curl -sS -D - -o /dev/null <FEED www>`) → 200 `application/rss+xml`. **No `curl -I`** (B1).
- [ ] A6.1b `HEAD` al feed → 200, no 405 (soporte añadido en A1).
- [ ] A6.2 `curl -sSI <AUDIO>` → `accept-ranges: bytes`, `content-type: audio/mpeg`, `content-length` > 0. *(Aquí `HEAD` sí es válido: lo sirve Storage, no la edge function.)*
- [ ] A6.3 **`curl -r 0-1023 -D - -o /dev/null <AUDIO>` → `206 Partial Content`** con `content-range`. Un GET parcial real, no un `HEAD` con `Range` (CR-1). Si falla, **es BLOCKING para todo el plan y D2 se cae**.
- [ ] A6.4 `curl -sSI <SHOW_COVER>` → 200 `image/jpeg`.
- [ ] A6.5 Cast Feed Validator: URL, veredicto y advertencias pegadas.
- [ ] A6.6 Podbase: ídem.
- [ ] A6.7 Cada advertencia clasificada BLOCKING / SHOULD-FIX / NIT, con la fase que la absorbe.
- [ ] A6.8 Veredicto explícito PROCEDER / BLOQUEADO al final del artefacto.

**Test plan:** ninguno automatizado. La verificación **es** la salida cruda, sin editar.

**Definition of done:** `evidence/A6-validacion.md` commiteado con veredicto explícito.

**Risks / unknowns:**
- **A6.3 es el riesgo más caro del plan.** Si Supabase Storage no sirve rangos, Apple rechaza
  el feed, **D2 se cae** y hay que mover el audio a un origen que sí lo haga (R2 + dominio
  propio). Eso invalidaría A12 y A13 y forzaría un re-plan. Por eso es un criterio con
  consecuencia declarada, no una casilla.
- Las advertencias de los validadores pueden abrir trabajo no contemplado. A6.7 las canaliza.

**Rollback:** ninguno; no modifica el sistema.

**Depende de:** A3, A5.

---

## Phase A7 — Páginas públicas `/reflexiones` y `/reflexiones/:slug`

A5+A6 de la revisión 1, **fusionadas** por CR-7: separarlas dejaba un archivo con tarjetas
apuntando a 404, lo que viola "toda fase cierra usable".

**Scope (≤10):** `ReflexionesPage.tsx`, `ReflexionPage.tsx`, `EpisodeList.tsx`,
`useEpisodeArchive.ts`, `useEpisodeBySlug.ts`, `appRoutes.tsx`, `SermonCard.tsx`,
`useSermonData.ts`, tests, `tests/e2e/reflexiones.spec.ts`.

**Out of scope:** búsqueda accent-insensitive y paginación por RPC (**A8** — aquí sólo orden
descendente y paginación simple por rango); wavesurfer (A9); SEO (A10); **enlace a la
liturgia** (ver A7.10).

**Acceptance criteria:**
- [ ] A7.1 `/reflexiones` renderiza sin sesión y lista sólo `published`, orden `published_at` desc.
- [ ] A7.2 Paginación simple funcional; página 2 sin solapes con la 1.
- [ ] A7.3 Estado vacío y estado de error, ambos en español.
- [ ] A7.4 `/reflexiones/<slug>` renderiza título, predicador, fecha y descripción.
- [ ] A7.5 Slug inexistente → 404 en español.
- [ ] A7.6 Un episodio `draft` no es accesible por slug (verificado **contra Postgres**, no sólo mock).
- [ ] A7.7 Reproductor con `audio_url` y `preload="none"`; botón de descarga del MP3.
- [ ] A7.8 Botón de compartir que copia la URL canónica absoluta.
- [ ] A7.9 El CTA primario de `SermonCard` apunta a `/reflexiones/<slug>`; Spotify queda secundario; sin slug no se rompe.
- [ ] A7.10 **No se promete enlace a la liturgia.** No existe ruta pública de liturgia y las RLS de `liturgias` son de propietario/admin (CR-7). Se registra en el backlog.
- [ ] A7.11 Ninguna tarjeta enlaza a una ruta que devuelva 404 al cerrar la fase.
- [ ] A7.12 Todo en español (D14); sin PII (D13).
- [ ] A7.13 Gates D18 + build + e2e verde.

**Test plan:**

`__tests__/useEpisodeArchive.test.ts`: sólo publicados, orden desc, sin solape entre páginas,
estado de error.
`__tests__/useEpisodeBySlug.test.ts`: consulta por slug + published; notFound.
`__tests__/EpisodeList.test.tsx`: vacío en español, error en español, enlaza por slug.
`__tests__/SermonCard.test.tsx`: CTA a página propia, Spotify secundario, sin slug no lanza.
`__tests__/ReflexionPage.test.tsx`: 404 en español, ofrece descarga.

`tests/e2e/reflexiones.spec.ts`:
- `el archivo carga sin sesión iniciada`
- `una tarjeta del archivo navega a la página del episodio y reproduce`

```bash
npx vitest run --no-file-parallelism src/components/sections/reflexiones src/pages
npx playwright test tests/e2e/reflexiones.spec.ts
```

A7.6 se verifica además contra Postgres, con la salida en `evidence/A7-rls.md`.

**Definition of done:** tests verdes con base-red/mutación, 13 criterios, e2e verde, gates D18.

**Risks / unknowns:**
- El e2e necesita al menos un episodio publicado — lo garantiza A5 (canario).
- La fase es la más grande del plan (10 ficheros). Si el ejecutor reporta contexto "tight",
  el corte natural es sacar `SermonCard`/`useSermonData` a una fase A7b; pero entonces A7 debe
  dejar las tarjetas de la home **sin cambiar**, nunca apuntando a 404.

**Rollback:** `git revert`. Rutas nuevas; sólo `SermonCard` toca algo existente.

**Depende de:** A4 y **A5** (S3 — el e2e necesita el episodio canario; sin él no hay nada que
navegar).

---

## Phase A10a — SEO: spike de arquitectura en preview

CR-4: en la revisión 1, A8 permitía terminar en `FINDINGS`, lo que está bien para un spike y
mal para una fase de un plan congelado. Se convierte en spike explícito.

**Scope:** un preview desplegado + `evidence/A10a-spike.md`. Código exploratorio en una rama
que **no se mergea**.

**Out of scope:** implementación definitiva (A10b); SSR de la app entera; migrar a Next.js.

**Acceptance criteria:**
- [ ] A10a.1 Verificado si el proyecto (Vite, `framework: vite`, sin directorio `api/`) admite funciones serverless — desplegando una, no razonando.
- [ ] A10a.2 Prototipo desplegado que sirve `/reflexiones/<slug>` con meta tags por episodio.
- [ ] A10a.3 Verificado que la SPA **arranca igual** sobre el HTML enriquecido (sin doble render ni hidratación rota).
- [ ] A10a.4 Verificado cómo se **reemplazan** las etiquetas genéricas de `index.html` (12 líneas) en vez de duplicarlas.
- [ ] A10a.5 Medido el impacto en TTFB frente a la ruta actual.
- [ ] A10a.6 **Recomendación de arquitectura escrita y justificada**, con la alternativa descartada y por qué.
- [ ] A10a.7 Rama del spike **no mergeada**; A10b parte de cero con la decisión tomada.

**Test plan:** ninguno — es un spike. Su salida es una decisión con evidencia, no código
mantenible. Lo declaro explícitamente.

**Definition of done:** `evidence/A10a-spike.md` con la recomendación y las mediciones; entrada
en el Decision Log.

**Riesgo declarado:** la arquitectura recomendada por Codex — **servir un shell HTML enriquecido
a todos los clientes**, sin ramificar por user-agent — es la línea base a batir. Evita cloaking
y branching frágil. Si el spike concluye otra cosa, debe justificarlo contra ella.

**Depende de:** A7.

---

## Phase A11-spike — Backfill: leer el código y escribir el bloque de plan

Las fases A11a–A11d de la r4 fueron retiradas. Codex r3 encontró en ellas cuatro defectos que
comparten una sola causa: **especifiqué comportamiento sin trazarlo por las firmas reales del
código.** Los tres concretos, verificados:

1. **La ruta manual para audio no-MP3 no existe.** A11a.1b prometía "recodificar a mano,
   publicar por el editor, conservar el GUID, cero código nuevo". `PublishArgs` **no acepta
   `guid`** (`publishService.ts:72`) y el insert deja que Postgres genere otro (`:162`); la
   acción `import` sí recibe guid pero **vuelve a descargar el enclosure original** (`:211`,
   `:284`) y no admite un MP3 local. Las piezas no conectan.
2. **El techo de memoria confía en `Content-Length`.** No cubre header ausente, `chunked`,
   header subdeclarado, ni un cuerpo que crece al leerlo.
3. **La renumeración libera el rango pero no lo reserva**, no define el orden histórico
   (`podcast-backfill:203` usa el orden del RSS, no la fecha), no contempla más de un episodio
   propio preexistente, y A11c pedía una prueba de integración dentro de una fase declarada
   "sólo evidencia".

Aplico el mismo remedio que Codex recetó para A20 y que funcionó: **no se planifica la
implementación antes de entender el código.**

**Scope:** `evidence/A11-spike.md` + un **bloque de plan revisable**. Rama de exploración que
**no se mergea**.

**Out of scope:** importar episodios; modificar `podcast-backfill` o `publishService`.

**Acceptance criteria:**
- [ ] A11s.1 Trazadas y documentadas las firmas reales de `publishEpisode`, de la acción `import` y de la política RLS, con las rutas de datos que existen **hoy** para crear una fila con un GUID dado.
- [ ] A11s.2 **Decidida la ruta para enclosures no-MP3** con una secuencia ejecutable de extremo a extremo, o declarado explícitamente que requiere código nuevo y cuánto.
- [ ] A11s.3 Medido si el feed de origen **tiene** enclosures no-MP3 — puede que la pregunta sea teórica.
- [ ] A11s.4 Decidida la estrategia de techo de memoria: rechazo previo cuando el tamaño no es fiable, o lectura por stream con contador duro y aborto. Con margen operativo, no fijada en el primer OOM observado.
- [ ] A11s.5 Decidida la reserva del rango `1..N`: congelar publicaciones durante el backfill, o reserva transaccional / advisory lock.
- [ ] A11s.6 Definido el orden del histórico (fecha ascendente) y su desempate estable.
- [ ] A11s.7 Contados los episodios propios preexistentes — no asumir que sea uno.
- [ ] A11s.8 **Entregable: bloque de plan con fases, scope, criterios y plan de test**, sometido a review antes de ejecutarse.

**Test plan:** ninguno — es un spike. Su salida es un plan auditable, no código mantenible. Lo
declaro en vez de inventar criterios, que es exactamente el error que trajo este spike.

**Definition of done:** `evidence/A11-spike.md` con las siete decisiones y el bloque de plan.

**Depende de:** A0.6 (feed de origen accesible), A4.

---

## Phase A14-core — `podcast:guid` + `<link>` por episodio

**Scope (≤4):** `podcast-rss/render.ts`, `index.ts` (incluir `slug` en el select),
`render_test.ts`, `evidence/A14-pc20.md`.

**Out of scope (recortado en la r6):** `podcast:locked` y `podcast:funding` — no son
necesarios para la condición de éxito de §1. Tampoco: `podcast:transcript` y `podcast:chapters` (backlog — son un pipeline propio);
`podcast:person`.

**Acceptance criteria:**
- [ ] A14.1 `<rss>` declara `xmlns:podcast="https://podcastindex.org/namespace/1.0"`.
- [ ] A14.2 **Antes de derivar nada, se busca un `podcast:guid` preexistente** (B5): en el feed de origen de Spotify y en Podcast Index. Si existe, **se preserva**; sólo se deriva uno nuevo cuando queda documentado que no hay identidad previa. Un show recibe ese GUID una vez, y al migrar el host nuevo debe importarlo, no inventarlo.
- [ ] A14.2b Si se deriva: UUIDv5 con el **namespace fijo prescrito** por Podcasting 2.0 y su normalización (host + path, sin esquema ni barra final), verificado contra un **vector conocido** de la especificación.
- [ ] A14.3 `<podcast:guid>` es estable entre invocaciones.
- [ ] A14.6 Cada `<item>` tiene `<link>` absoluto a `/reflexiones/<slug>`.
- [ ] A14.7 Un item sin slug omite el `<link>` en vez de emitir una URL rota.
- [ ] A14.8 El `<guid isPermaLink="false">` original no cambia (D5), verificado por mutación.
- [ ] A14.9 El feed revalida en Cast Feed Validator.
- [ ] A14.10 Gates D18 (Deno).

**Test plan** — `render_test.ts` (añadir):
- `declara el namespace de podcast 2.0`
- `podcast:guid coincide con el vector conocido de la especificación`
- `podcast:guid es estable entre invocaciones`
- `cada item enlaza a su página propia`
- `omite el link cuando el episodio no tiene slug`
- `el guid original se mantiene intacto al añadir podcast:guid`

```bash
cd supabase/functions && deno test --allow-all podcast-rss/
```

**Definition of done:** tests verdes, 10 criterios, feed revalidado, gates D18.

**Risks:** generar UUIDv5 en Deno requiere `std/uuid`; verificar que la versión fijada en
`import_map.json` lo exporte. `podcast:funding` necesita una URL de donaciones que puede no
existir — entonces se omite.

**Depende de:** A4-core, A7, y **el bloque de backfill que salga de A11-spike** (el feed de
origen debe seguir accesible para buscar un `podcast:guid` preexistente, y el catálogo completo
debe estar dentro antes de fijar identidad). *La dependencia decía `A11d`, fase ya retirada
(Codex r5).*

---

## Phase A-cutover-spike — Directorios + redirect de Spotify

Fusión de las antiguas A12 (directorios) y A13 (redirect), convertidas en **un solo spike** por
Codex r5. Dos razones. La primera es un error mío: al reemplazar el bloque de backfill borré
accidentalmente los cuerpos de A12 y A13, que estaban físicamente entre A11d y A14 en el
documento — el índice enumeraba 21 unidades y sólo existían 19 cuerpos. La segunda es la buena:
**no conviene redactarlas ahora**. Apple exige validación y revisión reales, no una casilla de
evidencia; y el redirect de Spotify es una mutación externa de alto impacto que tarda hasta
siete días y cuya recomendación oficial es importar el catálogo **antes** de redirigir.

**Scope:** `evidence/A-cutover-spike.md` + un **runbook ejecutable**.

**Out of scope:** ejecutar cualquier inscripción o el redirect. Este spike **no toca Spotify**.

**Acceptance criteria:**
- [ ] AC.1 Inventario de listings, claims y cuentas existentes: dónde está hoy el programa, con qué correo, quién tiene acceso.
- [ ] AC.2 Requisitos reales de Apple documentados a partir de su proceso oficial, no de supuestos — incluido qué valida y qué revisa a mano.
- [ ] AC.3 Requisitos de iVoox, Amazon y Podcast Index documentados igual.
- [ ] AC.4 Verificado que el correo institucional (D6) puede recibir y completar cada verificación de propiedad.
- [ ] AC.5 Precondiciones del redirect de Spotify enumeradas, con la regla oficial de importar antes de redirigir y el plazo de hasta 7 días.
- [ ] AC.6 Definido qué se exporta de Spotify antes del corte y dónde se archiva (la analítica no se transfiere).
- [ ] AC.7 Definida la verificación posterior al corte: qué prueba que el programa quedó alimentado por nuestro feed.
- [ ] AC.8 **Entregable: runbook paso a paso**, con puntos de no retorno marcados, sometido a review antes de ejecutarse.

**Test plan:** ninguno — es un spike sobre procesos de terceros. Su salida es un runbook
auditable. Lo declaro en vez de inventar criterios.

**Definition of done:** `evidence/A-cutover-spike.md` con el inventario, los requisitos y el
runbook.

**Riesgos que el runbook debe absorber:** Apple exige método de pago en el Apple ID; el
redirect tarda hasta 7 días; los seguidores se conservan pero la analítica no; **D7** (no
activar video) y **D8** (no borrar la cuenta) siguen vigentes y deben aparecer explícitos en el
runbook; y si los episodios incluyen música de adoración hay riesgo de takedown (auditado en
A0-core).

**Depende de:** A6 (feed validado), el bloque de backfill, A14-core (identidad `podcast:guid`
resuelta antes del primer envío).

---

## 6. Backlog

| Item | Origen | Por qué no es fase |
|---|---|---|
| `podcast:transcript` + VTT reutilizando `transcribe-meeting` | A14 | Pipeline propio; el mayor beneficio de accesibilidad, pero merece su propio plan |
| `podcast:chapters`, `podcast:person` | A14 | Dependen de marcar capítulos, que no existe en el editor |
| **Ruta pública de liturgia** + RLS anon | A7.10 | Hoy no existe y las RLS son de propietario/admin. Sin ella, no se puede prometer el enlace |
| Limpieza de objetos huérfanos tras claves versionadas | A2 | Baratos; una tarea de mantenimiento, no una fase |
| Audiograma para Instagram con `GraphicsGeneratorV2` | Fase 5 del doc de entrada | Concern distinto |
| Slide con QR en `/anuncios` | ídem | Independiente |
| **Audiencia, consentimiento y outbox de entrega** (ex-A16) | Codex CR-11 + decisión de Brent (r3) | Hoy no hay lista de correo ni difusión por WhatsApp, y crearlas no es el objetivo. Cuando se retomen, **D17 sigue vigente**: sin outbox con unicidad en DB no se envía nada |
| **Aviso por WhatsApp al publicar** (ex-A17) | ídem | Requiere audiencia con consentimiento y plantilla aprobada en Meta. Depende del ex-A16 |
| **Boletín por correo con Resend** (ex-A18) | ídem | Ídem, más una decisión de cadencia. Depende del ex-A16 |
| Pre-renderizar el XML del feed a Storage | A1 | Sólo si el catálogo supera ~200 items. Disparador, no tarea |
| **Arreglar el grabador de liderazgo en iOS** (`RecorderPopupPage.tsx:67-68`) | Hallazgo de A19 | Es del sistema de liderazgo. Debería reutilizar el módulo de A19a; hacerlo después y en su workstream |
| Búsqueda full-text sobre la descripción | A8 | A8 cubre título y predicador |

### Retirado en la r6 por el consenso con Codex (PARTIAL PASS r5)

Nada de esto es basura: es alcance que no sirve a la condición de éxito de §1 y que por eso
sale del plan a ejecutar. Se retoma cuando su propio objetivo lo justifique.

| Retirado | Era | Por qué sale |
|---|---|---|
| **Búsqueda accent-insensitive, filtros y RPC** | A8 | A7 ya entrega archivo paginado; buscar no aparece en la condición de éxito |
| **Reproductor avanzado (wavesurfer)** | A9 | Ya estaba declarado opcional; A7 entrega reproducción y descarga |
| **Implementación y evidencia SEO** | A10b, A10c | Su scope era "lo que decida A10a". El spike produce el bloque; planificar implementación antes es el error que costó cuatro rondas |
| **Bitrate 96 kbps, parser de cabecera, mono/estéreo** | A2.6–A2.10 | 128 kbps ya satisface D10 y el mínimo de Spotify. Optimizar tamaño no acerca el Goal |
| **Medición de egress y ocupación de Storage** | A0.8, A0.9 | Sirven al disparador D3, que es un costo futuro. **D3 baja de decisión congelada a nota de backlog**: sin medición no puede dispararse, y montar la medición no acerca el Goal |
| **`podcast:locked` y `podcast:funding`** | A14.4, A14.5 | No necesarios para la condición de éxito |
| **Limpieza del código muerto de Spotify** | A15 | Posterior al Goal, e incluye borrado potencial de buckets |
| **Grabación desde la mesa de sonido** | A19a, A19b, A20a | **No se descarta — cambia de plan.** Ver la nota de abajo |

#### Nota sobre la grabación desde la mesa (lo que Brent pidió)

Brent pidió explícitamente esta capacidad y **no se está desechando**. Codex tiene razón en que
no sirve al Goal de *este* plan: AUDIO trata de publicar y distribuir un catálogo que ya está
grabado, y el editor ya acepta archivos. La captura es un objetivo distinto — mejorar cómo
*entra* el audio, no cómo sale.

**Va a su propio workstream**, con su propio `PLAN.md`, prefijo de sesión y ciclo de review:
`docs/plan/captura/`. Lo que ya se investigó se conserva y se traslada ahí:

- **D15** (captura multiplataforma: Windows, macOS, Android, iOS; degradación explícita y
  visible) y **D16** (mime negociado por plataforma, probando construcción real del
  `MediaRecorder`, no `isTypeSupported`) pasan a ser decisiones de ese plan.
- El hallazgo verificado de que **el grabador de liderazgo está roto en iOS**
  (`RecorderPopupPage.tsx:67-68`, ambos mime son webm) y su corrección.
- La medición de Codex de que **90 min estéreo a 48 kHz ≈ 1,93 GiB de PCM** y que el pipeline
  lo materializa en memoria en cinco puntos — el dato que hace que la grabación larga sea un
  problema real y no un detalle.


---

## 7. Riesgos del plan como conjunto

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| **A6.3 falla (sin `206`)** | baja | **crítico** — cae D2, hay que migrar storage | A6 va antes de cualquier envío a directorios; consecuencia declarada |
| **A20a concluye que la grabación larga no es viable en iOS** | media | medio | Limitación documentada bajo D15; el spike cuesta menos que tres fases |
| **A20c obliga a enmendar D16 y el non-goal de procesamiento** | media | alto | A20a.5/A20a.6 lo deciden antes de escribir código |
| **A10a concluye que el proyecto Vite no admite funciones** | baja | medio | El spike lo determina desplegando, no razonando |
| Activar video en Spotify | baja | alto | D7 (razón corregida); A13.5 lo verifica |
| Borrar la cuenta de Spotify | baja | crítico | D8; nunca |
| Rechazo de Apple por portada | media | alto | A5.2 la verifica antes de A12 |
| Música de adoración → takedown | media | alto | A0.10 audita; editar los cantos fuera |
| Vercel no preserva `Content-Type` en el rewrite | media | medio | A3.6/A3.7 lo prueban; hay alternativa con función |
| El feed de origen de Spotify ya no es accesible | desconocida | alto | A0.6 lo determina antes de A11 |
| iOS ignora `echoCancellation:false` | media | medio | A19a.3 lo mide; se documenta como limitación (D15) |
| D3 nunca se dispara por falta de medición | **era cierto** | medio | Corregido: A0.9 instala la medición |
| El plan asume que "$0 marginal" es cierto | — | bajo | No verificado; A0.8/A0.9 y A11d.7 dan la línea base |

---

## 8. Decision log

| Fecha | Decisión | Razón | Levantada por |
|---|---|---|---|
| 2026-08-06 | Bitrate mínimo **96 kbps** | `spotifyValidator.ts:9` documenta el mínimo de Spotify | Planner |
| 2026-08-06 | Gates **delta-based** | El repo arrastra 1041/160/94/46 diagnósticos | Planner |
| 2026-08-06 | A16/A17 (captura) entran a este plan | Comparten el editor de sermones como superficie | Brent |
| 2026-08-06 | **D15: captura multiplataforma** (Windows, macOS, Android, iOS) | Quien graba usa el dispositivo que tenga | Brent |
| 2026-08-06 | **D4 corregida a `www`** | Medido: apex responde **307 → www**; enviar el apex a los directorios los haría seguir un redirect | Codex CR-2 |
| 2026-08-06 | **A0 deja de ser bloqueante; se añade A5 (canario) y A6 (validación)** | El feed tiene 0 items y la portada 400: no había nada que validar, y el catálogo llegaba recién en A11. Era un deadlock | Codex CR-1 |
| 2026-08-06 | **A6.3 usa `curl -r` (GET parcial), no `HEAD` con `Range`** | Un HEAD con Range no demuestra soporte de rangos | Codex CR-1 |
| 2026-08-06 | **A2 usa claves content-addressed** en vez de cache largo sobre rutas reescritas | `publishService` usa `upsert:true` sobre rutas estables; cache de un año serviría contenido viejo durante meses | Codex CR-5 |
| 2026-08-06 | **A2.9: mono vs estéreo se decide y se registra**; no se cierra la fase con la mitad del nombre bajo NOT DONE | Un DoD que permite omitir la mitad de la fase no es un DoD | Codex CR-5 |
| 2026-08-06 | **GUID y slug se imponen en la base** (CHECK + trigger), no por convención | La inmutabilidad del GUID es hoy sólo un `COMMENT`; una identidad que 15 directorios indexan necesita más | Codex CR-8 |
| 2026-08-06 | **A5+A6 de la r1 se fusionan en A7** | Separadas dejaban un archivo con tarjetas apuntando a 404, violando "toda fase cierra usable" | Codex CR-7 |
| 2026-08-06 | **Se retira la promesa de enlace a la liturgia** (A7.10) | No hay ruta pública de liturgia y las RLS son de propietario/admin. Tener una FK no define una URL | Codex CR-7 |
| 2026-08-06 | **A8 (SEO) se parte en A10a spike / A10b implementación / A10c evidencia** | Una fase que puede terminar en FINDINGS es un spike, no una fase de plan congelado | Codex CR-4 |
| 2026-08-06 | **Arquitectura SEO base: shell HTML enriquecido para todos**, sin branching por user-agent | Evita cloaking y fragilidad; A10a debe justificar cualquier alternativa contra ella | Codex CR-4 |
| 2026-08-06 | **A9 (backfill) se parte en A11a hardening / A11b dry-run / A11c canario / A11d completo** | "Ejecutar y arreglar lo que falle" no es aceptable para una migración irreversible de catálogo | Codex CR-6 |
| 2026-08-06 | **La paridad del backfill se verifica campo por campo sobre todo el catálogo**, no muestreando 5 guids | El muestreo no detecta pérdida sistemática de portada o predicador | Codex CR-6 |
| 2026-08-06 | **D18: se adopta `scripts/gates/changed-files-diagnostics.sh`** y se abandona el esquema de identidades global que yo había especificado | Ya existe en el repo, es más preciso, y documenta 62 colisiones del enfoque global | Codex CR-9 |
| 2026-08-06 | **D18 incorpora honestidad de tests**: base-red o prueba de mutación | Regla vigente del repo (D7 de `docs/plan/PLAN.md`) que la r1 omitió | Codex CR-9 |
| 2026-08-06 | **A16 nueva (audiencia, consentimiento, outbox)** antes de A17/A18 | No existe audiencia de podcast: `send-core.ts:10` sólo conoce `musician` y `children_volunteer`. Y `announced_at` no da idempotencia | Codex CR-11 |
| 2026-08-06 | **A16 (captura) se parte en A19a sonda / A19b UI**; `isTypeSupported` deja de ser la base | `isTypeSupported` sólo dice que el navegador *debería* poder; hay que construir y grabar de verdad. Safari 18.4 añadió WebM | Codex CR-10 |
| 2026-08-06 | **A17 (larga) se parte en A20a spike / A20b persistencia / A20c exportación** | 90 min estéreo a 48 kHz ≈ 1,93 GiB de PCM antes de copias; el pipeline materializa todo en memoria en 5 puntos. IndexedDB no lo resuelve | Codex CR-3 |
| 2026-08-06 | **D7: se conserva la decisión, se corrige la razón** — *desacuerdo parcial con CR-12* | Verificado en la fuente que Codex cita: el video para shows externos existe **sólo vía Distribution API desde hosts soportados** (Audioboom, Libsyn, Podigee, Podspace, Audiomeans), que como autohospedados no somos. La otra vía es Spotify for Creators, y esa página **no documenta reversibilidad**. Codex acierta en que "catastrófico e irreversible" estaba mal fundado; no acierta en que la reversibilidad esté establecida | Planner (evidencia), Codex CR-12 |
| 2026-08-06 | **D3 sólo es real si se mide: A0.9 instala la medición de egress** | El umbral de 150 GB/mes no podía dispararse nunca; A9.9 de la r1 medía ocupación, no egress | Codex CR-12 |
| 2026-08-06 | **`podcast:guid` debe usar el namespace fijo y la normalización prescritas, verificado contra un vector conocido** | "UUIDv5 derivado de la URL" es insuficiente y produciría un guid que Podcast Index no reconocería | Codex CR-12 |
| 2026-08-06 | **YouTube Music: Chile está habilitado**; deja de ser incógnita | Documentado por Google | Codex CR-12 |
| 2026-08-06 | **r3: A16/A17/A18 (audiencia, WhatsApp, boletín) se retiran al backlog** | Brent confirma que hoy la distribución propia es **pegar enlaces en redes sociales**, sin nada más sofisticado, y que crecer es una meta futura, no el objetivo de este plan. Construir consentimiento + outbox para una audiencia que no existe es infraestructura especulativa. D17 queda vigente para cuando se retomen | Brent |
| 2026-08-06 | **r3: A10 (SEO/OG) sube de prioridad y deja de tratarse como accesoria** (D18b) | Si el canal es compartir enlaces manualmente, la previsualización del enlace **es** la superficie de distribución. Un enlace sin preview no se abre | Brent + Planner |
| 2026-08-06 | **§0 corregido**: el entorno **sí** alcanza Supabase; feed 200 con **0 items**; portada **400** | La r1 repitió un supuesto del documento de entrada dentro de una sección de verificación | Codex CR-1/CR-13 |

---

## 9. Trazabilidad de la review de Codex r1

| Finding | Clase | Resolución |
|---|---|---|
| CR-1 deadlock de A0 | BLOCKING | **Aceptado.** A0 no bloqueante; nueva A5 (portada + canario); nueva A6 (validación); A6.3 con GET parcial |
| CR-2 D4 contradice el dominio real | BLOCKING | **Aceptado.** D4 → `www`, medido. Cambio de dominio primario declarado fuera de alcance |
| CR-3 A17 incompatible con el pipeline | BLOCKING | **Aceptado.** Partida en A20a/A20b/A20c; contradicción de A17.10 eliminada (A20b.9); D16 con alcance limitado |
| CR-4 A8 es una pregunta, no una fase | BLOCKING | **Aceptado.** A10a/A10b/A10c; shell HTML para todos; reemplazo de las etiquetas de `index.html` |
| CR-5 A2 vuelve inmutable lo mutable | BLOCKING | **Aceptado.** Claves content-addressed; A2.8 con parser real; A2.9 decide mono/estéreo |
| CR-6 A9 no es un backfill seguro | BLOCKING | **Aceptado.** A11a/A11b/A11c/A11d; paridad de catálogo completo |
| CR-7 A5 deja el árbol roto; liturgia inexistente | BLOCKING | **Aceptado.** A5+A6 → A7; enlace a liturgia retirado; búsqueda a la base (A8) |
| CR-8 identidades no protegidas por la DB | BLOCKING | **Aceptado.** CHECK + triggers + constraint por nombre + sufijo derivado del UUID + integración real |
| CR-9 §4 mal especificada | BLOCKING | **Aceptado.** D18 adopta `scripts/gates/`; SHA padre fijado; build verde absoluto; base-red/mutación |
| CR-10 A16 prueba mocks | SHOULD-FIX | **Aceptado.** A19a sonda con construcción real; Safari 18.4 registrado; A19a/A19b separadas |
| CR-11 A14/A15 sin infraestructura de audiencia | SHOULD-FIX | **Aceptado y superado en r3.** El finding era correcto; la respuesta ya no es construir A16, sino **retirar** las tres fases al backlog: Brent confirmó que hoy la distribución propia es pegar enlaces en redes. D17 queda como restricción vigente para cuando se retomen |
| CR-12 decisiones congeladas | SHOULD-FIX | **Aceptado en D16, D3, `podcast:guid`, YouTube. Parcialmente en D7** — ver Decision Log |
| CR-13 §0 demasiado amplio | NIT | **Aceptado.** Las 7 afirmaciones corregidas y verificadas |

---

## 10. Estado

**PLAN PARCIALMENTE CONGELADO — 12 unidades** (eran 28 en el punto más alto).

*Congelar* = dejar de revisar el plan y empezar a ejecutar. **Seis fases ya están ahí**: A1, A3,
A6, A7, A10a y A11-spike, aprobadas por Codex r5 tal como están. Se puede empezar hoy.

Las otras seis (A0-core, A2-core, A4-core, A5-core, A14-core, A-cutover-spike) quedaron
recortadas en esta r6 siguiendo exactamente su recomendación: necesitan confirmación de que el
recorte quedó bien aplicado, no rediseño.

**Regla acordada con Brent:** lo que Codex siga señalando **se recorta o se convierte en
spike**. No se pule la misma fase ronda tras ronda.
Ninguna fase empieza hasta que pase.

**Estado del cap de plan-review (SOP §1.5, N2):** Codex r1 → FAIL; Codex r2 → FAIL. **El cap de
2 rondas está consumido.** Brent, como árbitro, autorizó explícitamente una **ronda 3** tras el
escalamiento — no es una vuelta más por inercia del PM. Si r3 no pasa, se cierra el ciclo y
Brent decide: aceptar con los desacuerdos registrados, re-planificar, o mandar al backlog.

---

## 11. Trazabilidad de la review de Codex r2

| Finding | Clase | Resolución en la r4 |
|---|---|---|
| B1 A3/A6 validan con `HEAD` pero el handler sólo acepta `GET` | BLOCKING | **Aceptado.** Verificado en vivo: `HEAD` → 405 y el `GET` 200 no trae `Content-Length`. A1 añade soporte de `HEAD` (A1.10/A1.11 + tests); A3.6/A6.1 pasan a GET real; A3.7 deja de exigir `Content-Length` y pasa a verificar el `HEAD` nuevo |
| B2 CR-8 eludible vía `unpublish` | BLOCKING | **Aceptado.** `guid` inmutable desde el INSERT en cualquier estado; `slug` con transición única `NULL → valor`. A4.5b prueba la secuencia `publish → unpublish → mutar → republicar` contra Postgres |
| B3 colisión determinista con el primer episodio histórico | BLOCKING | **Aceptado.** Verificado: `podcast-backfill:203` asigna `idx + 1`. A5.8 registra la deuda; A11b.5b reporta `N`; A11c.6/6b/6c renumeran el canario a `N+1` antes de importar, con prueba de integración |
| B4 el catálogo completo aún no es importable | BLOCKING | **Aceptado.** A11a.5/5b/5c: techo aplicado **antes** de materializar el cuerpo, medido, con test de exceso. A11a.1b congela la ruta para no-MP3 (re-encode manual + flujo normal, cero código nuevo) y A11d no puede declarar "completo" con pendientes |
| B5 A14 puede crear una segunda identidad PC2.0 | BLOCKING | **Aceptado.** A14.2 busca `podcast:guid` preexistente en el feed de origen y en Podcast Index y lo preserva; sólo deriva si documenta que no hay. A14.4 con la sintaxis `owner="…"`. **A14 se mueve antes de A12/A13** en índice, secuencia y dependencias |
| B6 A20b/A20c no son contrato ejecutable | BLOCKING | **Aceptado.** **Retiradas del plan congelado.** Se congela sólo A20a, que ahora debe entregar pérdida máxima medida (A20a.9) y **un bloque de plan revisable** (A20a.10), no una recomendación |
| S1 A2 puede cerrar con producción a 128 kbps | SHOULD-FIX | **Aceptado.** Verificado `quickProcessor.ts:161`. A2.7b + test de wiring con mutación |
| S2 frontera A10b/A10c inconsistente | SHOULD-FIX | **Aceptado.** A10b cierra como "implementada, no aceptada"; se aceptan juntas. A10c.3/4/5 usan la matriz de canales reales de CASA y no asumen que `og:audio` reproduzca |
| S3 dependencias contradicen prerequisitos | SHOULD-FIX | **Aceptado.** A0.6 → A11a y A0.7 → A1/A12 declarados; A7 depende también de A5 |
| S4 D3 sin condición operativa | SHOULD-FIX | **Aceptado.** Tres condiciones: >150 GB/mes, **dos meses consecutivos**, y costo proyectado a 12 meses mayor que la alternativa documentada incluyendo la migración |
| N1 §0 impreciso sobre MIME del bucket | NIT | **Aceptado.** Corregido; "siete" → "ocho" |
| N2 §10 registra la ronda incorrecta | NIT | **Aceptado.** §10 refleja r1 FAIL + r2 FAIL, cap consumido, y que r3 la autorizó Brent explícitamente |

**Confirmaciones de Codex r2 que no requieren cambio:** D7 satisface; retirar A16/A17/A18 es
correcto y no deja hueco; D18b es correcta atada a canales reales; la arquitectura D1–D18b no
necesita revertirse; A5/A6, A10a–c y A19a/b están bien dimensionadas; el GET parcial de A6.3
es real.

---

## 12. Trazabilidad de la review de Codex r3

| Finding | Clase | Resolución en la r5 |
|---|---|---|
| B1 la ruta manual para no-MP3 no existe en el código | BLOCKING | **Aceptado — error mío.** Verificado: `PublishArgs` no acepta `guid` (`publishService.ts:72`), el insert deja que Postgres genere otro (`:162`), y la acción `import` vuelve a descargar el enclosure (`:284`). **A11a–A11d retiradas**; sustituidas por **A11-spike**, que debe trazar las firmas reales antes de planificar (A11s.1/A11s.2) |
| B2 el techo de memoria depende de `Content-Length` | BLOCKING | **Aceptado.** Absorbido por A11-spike (A11s.4): rechazo previo cuando el tamaño no es fiable, o stream con contador duro y aborto, con margen operativo |
| B3 la renumeración no reserva el rango ni define el orden | BLOCKING | **Aceptado.** Absorbido por A11-spike (A11s.5/6/7): reserva del rango, orden por fecha con desempate estable, y contar **todos** los episodios propios preexistentes |
| B4 identidad reemplazable vía `DELETE + INSERT` | BLOCKING | **Aceptado.** A4.5c/A4.5d: trigger que impide borrar toda fila con `slug IS NOT NULL`; sólo se borran borradores vírgenes. **D5 reescrita**: inmutable desde el INSERT, no "después de publicar" |
| S1 dependencias de A0 declaradas pero no normalizadas | SHOULD-FIX | **Aceptado.** A1 declara `A0.7` en el índice; el texto ya no dice "A0 no bloquea nada" sino qué criterio bloquea qué fase |
| S2 el DoD de A20a quedó atrás | SHOULD-FIX | **Aceptado.** El DoD exige A20a.9 y A20a.10 explícitamente, y distingue "máximo observado bajo la matriz" de garantía universal |

**Confirmaciones de Codex r3 que no requieren cambio:** B1/B5/B6 de r2 sustancialmente
resueltos; `HEAD` pertenece a A1 y no es scope creep; A14 antes de A12 no crea ciclo y
concuerda con la especificación de `podcast:guid`; A20a conserva criterio de cierre útil; el
resto de los cambios de la r4 es ejecutable.

---

## 13. Trazabilidad del consenso — Codex r5 (PARTIAL PASS)

Aceptados **todos** los recortes, sin excepción.

| Recomendación | Aplicado |
|---|---|
| Congelar A1, A3, A6, A7, A10a, A11-spike | ✅ marcadas CONGELADA en el índice |
| A0 → recortar (sacar A0.8/A0.9) | ✅ A0-core; egress y ocupación al backlog, **D3 degradada** |
| A2 → recortar (sacar bitrate/mono) | ✅ A2-core: sólo claves content-addressed + cache inmutable |
| A4 → recortar; no congelar la afirmación amplia | ✅ A4-core con **límite declarado**; **D5 reescrita** para afirmar sólo lo que garantiza |
| A5 → recortar (sacar A5.8) | ✅ A5-core |
| A8, A9 → sacar | ✅ backlog |
| A10b, A10c → sacar del bloque congelado | ✅ backlog; A10a produce el bloque revisable |
| A14 → recortar (locked/funding fuera; corregir dep `A11d`) | ✅ A14-core |
| A12 + A13 → un solo spike de cutover | ✅ **A-cutover-spike** — repara además mi borrado accidental de sus cuerpos |
| A15 → sacar | ✅ backlog |
| A19a, A19b, A20a → sacar | ✅ **trasladadas al workstream `captura`**, no descartadas (D15/D16 se van con ellas) |

**Error propio que Codex detectó:** el índice enumeraba 21 unidades y sólo existían 19 cuerpos,
porque al reemplazar el bloque de backfill borré sin querer los cuerpos de A12 y A13 — estaban
físicamente entre A11d y A14 en el documento. Convertirlas en un spike único resuelve el hueco
y evita redactar dos fases que no conviene redactar todavía.

**Sobre A4 (respuesta de Codex §4):** acepto el veredicto partido. PASS para "el guid y el slug
de esta fila no se pueden mutar, y una fila con slug no se puede borrar". FAIL para "la
identidad del episodio no se puede reemplazar". D5 ahora dice exactamente eso y nada más.

