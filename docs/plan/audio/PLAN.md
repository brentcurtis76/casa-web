# PLAN — AUDIO (autopublicación y distribución del podcast CASA)

META
- REPO / ROOT: `casa-web` · plan root `docs/plan/audio/`
- SLUG / PREFIJO DE SESIÓN: `AUDIO`
- BRANCH CONVENTION: `phase/<id>-<slug>` (≤20 chars por DNS de Vercel — `phase/A1-feed`)
- BASE: `main`
- PLAN FROZEN: **no.** Codex r1 → FAIL (13) · r2 → FAIL (12) · r3 → FAIL (6) ·
  **r5 → PARTIAL PASS** · **r7 → FAIL (10)** · **r8 → FAIL (11)** · **r9 → FAIL (10)**. Esta es
  **r10 → FAIL (6)** · **r11 → FAIL (7)** · **r12 → PASS, E2 congelada**. Esta es la
  **revisión 13**. Ver §9 y §11–§19 para la trazabilidad finding → cambio.
- **RE-ALCANCE (2026-08-07):** el plan apuntaba a distribución en directorios. Brent lo declara
  **demasiado ambicioso para una primera instancia**. El objetivo nuevo es el **bucle interno
  de escucha**: grabar en el editor, derivar la carátula de la portada de la liturgia, publicar
  automáticamente en página propia, y compartir el enlace en redes y WhatsApp. **Toda la pista
  de distribución (feed RSS, backfill, directorios, corte de Spotify) pasa al backlog.**
- **ESTRUCTURA POR OLAS.** **Ola 1 = `E2`, y nada más.** Ola 2 = `E1-spike`, en paralelo.
  Ola 3 = `E-infra` → `E3a` → `E3b` → `E4-spike`, **ninguna congelada**. Ola 4 (`E1-impl`,
  `E4-impl`, `E5`, `E6`) sin planificar y **sin contarse como aprobada**.
- **`E0-gates` retirada en la r10:** UPGRADE P0 pasó Codex y se mergeó, así que el gate ya está
  en `main` (`5b947ac`). D18 vuelve a funcionar tal como se escribió.
- **Las unidades vigentes son las de §5.** Las `A*` quedan retiradas; sus cuerpos se
  conservan al final del documento porque las reviews de Codex r1–r5 los referencian por ID.
- **✅ `E2` DONE — `CODEX REVIEW E2 FINAL`: PASS** (0 BLOCKING, 1 SHOULD-FIX, 0 NIT) sobre
  `phase/E2-caratula@6d45f35`, SHA padre `05dc4ca`. Cerrada el **2026-08-08**. **Es la primera
  unidad ejecutada de este plan**, tras trece rondas de planificación y nueve reviews.
- **✅ `E2` congelada en su día — `CODEX REVIEW plan r12`: PASS** (0 BLOCKING, 1 SHOULD-FIX, 4 NIT), sobre
  el commit `3084208`. Congelados su **alcance, comportamiento, estrategia de tipado** (demostrada
  por Codex construyendo el adaptador y midiéndolo con el gate real: 0/0/0/0), **test plan** y
  **gate** (§4 verificada, `tsc=1041` reproducida en `main @ 05dc4ca`). Esta revisión 13 aplica
  los cinco arreglos que Codex pidió meter en el commit de congelado. **E2 puede ejecutarse.**
- **El resto del plan NO está congelado.** `E1-spike` es ejecutable por construcción —no toca
  código que se mergee ni pasa por el gate— pero **no ha pasado review**. `E-infra`, `E3a`, `E3b`
  y `E4-spike` siguen en borrador; `E1-impl`, `E4-impl`, `E5` y `E6` no son unidades.
- **Aviso de herencia (Codex r7/N1):** E3 y E4-spike **ya no heredan** la aprobación que Codex
  dio a A7 y A10a en la r5. La r7 les cambió scope, dependencias, e2e y pruebas de RLS, y una
  aprobación no sobrevive a eso. Se revisan de cero.
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
| Grabador de liderazgo **sin fallback para iOS < 18.4** (ambos mime son webm). *Corregido en la r9 (Codex r8/S1): la r1 escribió "roto en iOS" y eso **nunca se midió** — Safari/iOS 18.4 añadió WebM a `MediaRecorder`. Lo medible es la ausencia de fallback; lo mide E1-spike.* | `RecorderPopupPage.tsx:67-68`, `:95-100` |

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

> **Reemplazado en la revisión 7.** El objetivo anterior — feed propio inscrito en directorios,
> con Spotify degradado a destino — se conserva íntegro en §6 como bloque de backlog. No se
> descarta: se aplaza.

Que quien predica pueda **grabar, publicar y compartir** una reflexión sin salir de CASA, y que
la comunidad la escuche en una página de la iglesia.

Condición de éxito, verificable:

- Se puede **grabar el audio dentro del editor** (`/admin/sermon-editor`), no sólo subir un
  archivo.
- La **carátula del episodio se deriva de la portada de la liturgia** vinculada, reutilizando el
  sistema de generación que ya existe — no una ilustración nueva y ajena.
- Al publicar, el episodio **aparece solo** en `/reflexiones`, con su propia página
  `/reflexiones/<slug>`, reproducible por cualquiera sin iniciar sesión.
- Ese enlace **se comparte en redes y WhatsApp** y la previsualización muestra título, portada
  y predicador.

**Fuera de la condición de éxito, a propósito:** que el episodio llegue a Apple, Spotify,
iVoox o cualquier directorio. Eso es distribución y viene después.

## 2. Non-goals

**Añadidos en la revisión 7 — todo esto era el plan y ahora no lo es:**

- **No** corregir ni mudar el feed RSS, ni servirlo desde dominio propio (ex-A1, ex-A3, ex-A6).
- **No** inscribir el programa en Apple, Podcast Index, iVoox ni Amazon (ex-A-cutover-spike).
- **No** migrar el catálogo histórico desde Spotify (ex-A11-spike).
- **No** tocar nada de Spotify: ni redirect, ni corte, ni la cuenta (D8 sigue vigente).
- **No** provisionar el correo institucional de `itunes:owner`. **D6 sólo existe para la
  verificación de propiedad ante directorios**, y sin directorios no está en el camino crítico.
  Verificado el 2026-08-07: el dominio no tiene registros MX, así que ese buzón habría que
  crearlo. Cuando se retome la distribución, es lo primero.

**Vigentes desde la revisión 1:**

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

**Limpieza de la revisión 8 (Codex r7/S4).** Seis decisiones seguían describiendo el plan
retirado. **D1 llegaba a decir "Es el objetivo entero", que ya era falso**, y D11 referenciaba
fases que no existen. Salen del bloque activo al de distribución, donde vuelven a ser correctas:

| Sale del bloque activo | Por qué |
|---|---|
| ~~**D1**~~ (el feed RSS es la fuente de verdad) | El feed no está en el alcance. Su razón — "es el objetivo entero" — describía el Goal anterior |
| ~~**D4**~~ (identidad pública del feed en `www`) | No hay feed que publicar |
| ~~**D6**~~ (correo institucional en `itunes:owner`) | `itunes:owner` sólo verifica propiedad ante directorios |
| ~~**D7**~~ (no activar video en Spotify) | No se toca Spotify en este bloque |
| ~~**D8**~~ (nunca borrar la cuenta de Spotify) | Ídem. **Sigue siendo una prohibición dura**, sólo que no es arquitectura de este plan |
| ~~**D11**~~ (orden del corte: A6 antes que A13) | Referencia fases retiradas |

**Todas siguen vigentes en §6 para quien retome la distribución.** Salir del bloque activo no es
derogarlas: es dejar de fingir que gobiernan un trabajo que ya no existe.

| ID | Decisión | Razón |
|---|---|---|
| ~~**D1**~~ | **Trasladada al bloque de distribución (§6)** en la r8. | Codex r7/S4. |
| **D2** | **El audio y la portada viven en Supabase Storage (`podcast-media`), bucket público.** No se migra dentro de este plan. | Costo marginal bajo; una dependencia menos. |
| ~~**D3**~~ | **Retirada como decisión congelada en la r6.** El disparador de migración de storage (egress > 150 GB/mes) requiere una medición que ninguna fase instala ya — A0.8/A0.9 se recortaron por no servir al Goal. Baja a **nota de backlog**: cuando el costo importe, primero se monta la medición y después se define el umbral. Congelar un disparador que no puede dispararse era teatro. | Codex r5. |
| ~~**D4**~~ | **Trasladada al bloque de distribución (§6)** en la r8. | Codex r7/S4. |
| ~~**D5**~~ | **Retirada en la r9 (Codex r8/S3).** Ya no gobernaba nada propio: su mitad activa está en D12 y su mitad de GUID/`DELETE` en el backlog. Una decisión que sólo remite a otra es ruido. | Codex r8/S3. |
| ~~**D6**~~ | **Trasladada al bloque de distribución (§6)** en la r8. Medido el 2026-08-07: `dig MX anglicanasanandres.cl` → **sin registros**; el buzón habría que crearlo. | Codex r7/S4. |
| ~~**D7**~~ | **Trasladada al bloque de distribución (§6)** en la r8, con su razón corregida intacta. | Codex r7/S4. |
| ~~**D8**~~ | **Trasladada al bloque de distribución (§6)** en la r8. **Sigue siendo prohibición dura**: nunca se borra la cuenta de Spotify for Creators. | Codex r7/S4. |
| **D9** | **Sólo migraciones aditivas.** Nada de DROP/TRUNCATE/ALTER destructivo. | Regla dura del proyecto. |
| **D10** | **El bitrate de exportación no baja de 96 kbps.** *Razón rejustificada en la r8:* deja de sostenerse en el mínimo de Spotify — que ya no está en el alcance — y pasa a ser **piso de calidad de escucha** para la gente de CASA, que es quien va a oírlo. `quickProcessor.ts:161` produce hoy 128 kbps y lo satisface de sobra. | Codex r7/S4: una decisión cuya única razón era un requisito retirado, o se rejustifica o se va. |
| ~~**D11**~~ | **Trasladada al bloque de distribución (§6)** en la r8. Referenciaba A6, A12 y A13, que ya no existen. | Codex r7/S4. |
| **D12** | **El slug es inmutable**, impuesto por trigger: transición única `NULL → valor`, inmutable después, y **republicar conserva el mismo slug**. Además, `status = 'published'` ⇒ `slug IS NOT NULL`. *Ampliada en la r8* para ser la decisión autoritativa del slug, absorbiendo la mitad activa de D5. | **Restaurada tras Codex r7/B2.** La r7 la contradijo aceptando slug mutable, con el argumento de que un enlace de WhatsApp tolera el cambio "porque no está indexado". Es falso: un enlace ya compartido se rompe igual, y encima rompe la URL canónica, la caché y la previsualización social que E4 existe para construir. |
| **D13** | **PII de miembros nunca en el feed, ni en prompts de IA, ni en Open Brain.** | Regla dura del proyecto. |
| **D14** | **Todo texto de UI y de feed en español.** | Regla dura del proyecto. |
| ~~**D15**~~ | **Trasladada al workstream `captura`** en la r6, junto con las fases A19/A20. Sigue vigente allí, palabra por palabra: la captura es 100 % web y agnóstica del dispositivo (Windows, macOS, Android, iOS), y donde una plataforma imponga un límite real se degrada de forma explícita y visible. **No se descarta el requisito de Brent; cambia de plan.** | Codex r5: la captura no sirve al Goal de AUDIO. |
| ~~**D16**~~ | **Trasladada al workstream `captura`** en la r6, junto con D15. | Ídem. |
| ~~**D17**~~ | **Trasladada al backlog (§6)** en la r9. La r8 decía que bajaba a guardrail pero la dejó físicamente aquí, que es afirmar una cosa y hacer otra. | Codex r8/S3. |
| **D19** | **El origen canónico público es `https://www.anglicanasanandres.cl`.** Toda URL de episodio que el sistema emita o comparta usa ese host: `/reflexiones/<slug>`. | **Nueva en la r9 (Codex r8/S3)**, que señaló que faltaba una decisión activa para el origen canónico. Medido en la r2: el apex responde **307 → www**, así que emitir el apex haría seguir un redirect permanente hacia una URL distinta de la compartida. Es la misma medición que sostenía a D4; D4 se fue con la distribución, la medición no. |
| **D18b** | **La previsualización del enlace es la distribución.** *Endurecida en la r8:* el preview debe mostrar **título, portada, predicador y canonical** sobre una URL publicada de verdad — eso es el criterio. **`og:audio` deja de ser obligatorio por decreto**: sólo entra si E4-spike demuestra que algún canal real de CASA lo consume (E4s.6). | Brent (r3), endurecida por Codex r7/S4: exigir `og:audio` sin evidencia de que alguien lo use era fe, no diseño. |
| **D18** | **Los gates se miden con `scripts/gates/changed-files-diagnostics.sh` sobre los ficheros que la fase toca, contra el SHA padre fijado de esa fase.** Sin esquemas de identidad globales. Build verde absoluto. Todo test nuevo con prueba base-red o de mutación. | CR-9: el gate correcto ya existe en el repo y documenta 62 colisiones del enfoque que yo proponía. |

---

## 4. Gates (D18)

> **Reescrita en la r11 (Codex r10/S1).** La versión anterior seguía diciendo que el script no
> existía en `main`, que P0 estaba en `FAIL 2/2` y que había que materializarlo en worktrees.
> **Las tres cosas son falsas desde el merge de P0**, y dejaban el documento ofreciendo dos
> procedimientos incompatibles para la decisión que gobierna E2. **Éste es el único procedimiento.**

**El gate vive en `main`.** Medido:

```
$ git ls-tree main --name-only scripts/gates/
scripts/gates/README.md
scripts/gates/changed-files-diagnostics.sh
scripts/gates/selftest.sh
```

No hay SHA del gate que fijar ni worktrees que montar: se ejecuta desde el árbol.

**Línea base del repo — remedida en la r12 sobre un worktree LIMPIO de `main`:**

```
$ git worktree add --detach ../wt-measure main   # main = 05dc4ca
$ ln -s <repo>/node_modules ../wt-measure/node_modules
$ bash scripts/gates/changed-files-diagnostics.sh src/hooks/useQuickPublish.ts
[gates] totales del proyecto: tsc=1041 eslint=160 deno-lint=94 deno-check=46
```

**Son 1041.** La r11 dijo `1039` "medido" y **era falso**: ejecuté el comando sobre
`feat/mesa-md-schema` —la rama de P1 de UPGRADE, que arregla dos diagnósticos— y no sobre `main`.
El comando era real; el árbol no era el que la afirmación nombraba. Ver §5, cuarta entrada.

> **Regla, a raíz de esto:** los totales del proyecto se toman **en el SHA padre de la unidad**,
> nunca en el checkout que el PM tenga debajo, y la medición se anota **con el SHA exacto —
> nunca con el nombre de una rama**. Un total medido sin decir sobre qué árbol no es una medición.
>
> **Por qué el SHA y no la rama** (Codex r12/S1): este repo lo comparten sesiones concurrentes y
> el checkout cambia de rama bajo los pies. El 2026-08-07, entre las 15:39 y las 15:52, otra
> sesión lo tuvo en `main`; **dos mediciones de Codex y una mía se atribuyeron a la rama
> equivocada dentro de esa ventana**. Un nombre de rama no identifica un árbol. Un SHA sí.

Arreglarlos es non-goal. El gate no es "el total bajó" sino "los ficheros que toqué no ganaron un
diagnóstico nuevo".

**Procedimiento por fase:**

1. Fijar el **SHA padre** de la fase (el commit del que sale su branch) y anotarlo en el
   ledger. No `git merge-base HEAD main` — en una fase dependiente eso no es su base.
2. Medir la base en ese SHA sobre la lista `F` de ficheros que la fase modifica o crea:

```bash
bash scripts/gates/changed-files-diagnostics.sh <fichero> [<fichero> ...]
```

3. Medir igual en HEAD y comparar **mensajes crudos completos**, sin canonicalizar ni agrupar,
   **aplicando la regla de clasificación de `scripts/gates/README.md`**: *desplazamiento de línea*
   —mismo mensaje, distinta línea— es **aceptable**; *diagnóstico nuevo* es **BLOQUEANTE**.
   Esto importa en E2: sus 2 errores base viven en `(195,15)` y `(200,20)`, y **cualquier import
   nuevo los desplaza**. Leída sin esta regla, la comparación daría un delta falso en la primera
   pasada (Codex r11/S3).
3b. Para capturar la base en el SHA padre, usar el patrón del README —worktree desechable más
   symlink a `node_modules`— en vez de mover el checkout de trabajo.
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

## 5. Phase index — por olas (revisión 13 — **E2 congelada por Codex r12**)

**Dos hechos cambiaron el plano entre la r9 y la r10, y ninguno es una opinión:**

1. **UPGRADE P0 pasó Codex y se mergeó a `main`.** `scripts/gates/changed-files-diagnostics.sh`,
   `selftest.sh` y `README.md` están hoy en `main` (blob del gate
   `51af6197e5186f0dfc36076512e5d887973d85f6`, idéntico al que Codex aprobó —
   `$ git rev-parse main:scripts/gates/changed-files-diagnostics.sh` → `51af6197…`).
   **`E0-gates` se
   retira: no hay nada que incorporar ni que fijar.** D18 vuelve a funcionar tal como se escribió.
2. **Mi afirmación de que había Postgres local disponible era falsa.** Ver la corrección abajo.

### Ola 1 — candidata a congelar

| ID | Nombre | Tipo | Status | Depende de |
|----|--------|------|--------|-----------|
| E2 | Carátula desde la portada de la liturgia | Código | **✅ DONE — 2026-08-08, `6d45f35`** | — |

**Una sola unidad.** No toca base de datos ni e2e: es lógica de frontend con vitest, y el gate
que necesita ya está en `main`. Es lo único que hoy puedo congelar sin que esconda trabajo de
infraestructura que nadie ha medido.

### Ola 2 — en paralelo, sin dependencias

| ID | Nombre | Tipo | Status | Depende de |
|----|--------|------|--------|-----------|
| E1-spike | Grabación: sonda de compatibilidad real | Spike | TODO | — |

No toca código que se mergee, no pasa por el gate, no depende de nada. **Puede arrancar hoy.**

### Ola 3 — bloqueada por infraestructura que no existe

| ID | Nombre | Tipo | Status | Depende de |
|----|--------|------|--------|-----------|
| E-infra | Entorno de pruebas: Postgres local y harness e2e | Código + infra | **NO CONGELADA** | — |
| E3a | `slug`: contrato, DB y `publishService` | Código + DB | **NO CONGELADA** | E-infra |
| E3b | Páginas públicas `/reflexiones` y `/reflexiones/:slug` | Código | **NO CONGELADA** | E3a, E-infra |
| E4-spike | Previsualización: prototipo desplegado | Spike | **NO CONGELADA** | E3b |

**Los cuerpos de E3a y E3b siguen en este documento como borrador, no como contrato.** Codex r9
demostró que ambas esconden una unidad de infraestructura, y que su contrato de slug y su
semántica de paginación todavía tienen huecos (§16, B2 y B5). Se especifican cuando `E-infra`
haya medido el entorno.

### Ola 4 — todavía no son unidades

`E1-impl`, `E4-impl`, `E5` y `E6` siguen sin planificar y **sin contarse como aprobadas**.
*(Codex r11/N3: la r10 y la r11 remitían a un "§5.1" que no existe — la sección se perdió al
reensamblar el documento. El alcance corregido de E6 que guardaba está en §15, finding B6.)*

**Este bloque no entrega las cuatro condiciones del Goal.** Congelar E2 entrega la carátula
derivada de la liturgia, y nada más. Lo digo aquí para que no haya que deducirlo.

---

### Corrección: no hay Postgres local disponible

**La r9 decía "Postgres local real disponible — verificado". Era falso, y es la tercera vez en
este plan que escribo "verificado" sobre una inferencia.** Deduje la disponibilidad de que el
CLI está instalado, Docker corre y existe `config.toml`, sin ejecutar una sola comprobación.
Medido ahora, de verdad:

| Comprobación | Resultado real |
|---|---|
| `supabase status` | **Falla**: `No such container: supabase_db_mulsqxfhxxdsadxsljss` |
| Puerto 54322 | **Ocupado por otro proyecto Supabase** (`sxlogxqzmarhqsblxmtj`, 10 contenedores corriendo) |
| `config.toml` | Sin sección `[db]`: no define puertos alternativos |
| `.env.test` | **No existe** |
| `src/integrations/supabase/client.ts:5` | URL y anon key de **producción** hardcodeadas como fallback |
| Migraciones | **61**, no "~100" como decía la r9 |

**La consecuencia más grave no es el Postgres: son los e2e.** `playwright.config.ts` carga
`.env.test` sólo si existe, el servidor arranca con `npm run dev`, y `client.ts` cae por defecto
al proyecto productivo. La E3b de la r9 habría mandado a un ejecutor a **crear filas sintéticas
`draft` y `published` contra la base de producción**, que además es la compartida con Life OS.
Eso no es un criterio flojo: es una instrucción peligrosa, y la escribí yo.

**Por eso `E-infra` existe y por eso E3a/E3b no se congelan.**

### Registro de mis verificaciones falsas

Tres, todas con la misma forma — una inferencia colocada dentro de una sección titulada "medido":

| Ronda | Afirmé | Era |
|---|---|---|
| r1 | "este entorno no alcanza `*.supabase.co`" | Falso; el feed respondía 200 (Codex CR-1) |
| r2 | "`scripts/gates/changed-files-diagnostics.sh` existe en el repo" | Estaba en otra rama, no en `main` |
| r9 | "Postgres local disponible — verificado" | `supabase status` falla; el puerto está ocupado |
| r11 | "`tsc=1039`, medido el 2026-08-07" | Son **1041**. Ejecuté el comando sobre `feat/mesa-md-schema` (la rama de P1 de UPGRADE), no sobre `main` |

**La cuarta es la más instructiva, porque rompe la regla que adopté para evitar las tres
primeras.** En la r10 escribí que toda afirmación de estado del entorno llevaría su comando al
lado. En la r11 lo hice — y la afirmación siguió siendo falsa, porque **nombré el comando pero no
el árbol**. La regla, corregida: *comando, salida **y el SHA exacto** sobre el que se ejecutó —
nunca el nombre de una rama*. Un total sin árbol no es una medición; es un número con un comando
al lado.

**Y no es un defecto sólo mío.** En la r12 Codex encontró que **su propia r11** había atribuido
dos mediciones a `feat/mesa-md-schema` cuando el reflog demuestra que este checkout compartido
estaba en `main` durante esa ventana. Midió contenido de `main` y lo llamó rama. Es exactamente
el mismo error, en el otro lado de la mesa, y lo habría delatado la misma regla — de ahí que la
r12 la endurezca a SHA siempre.

Queda escrito aquí a propósito. Es el mismo defecto que este plan lleva seis rondas
diagnosticando, cometido por el PM que lo diagnostica.

### Estado verificado del código (medido 2026-08-07)

| Pieza | Estado real |
|---|---|
| Flujo de publicación rápida | **Existe**: `QuickPublishContainer.tsx`, stepper `Audio → Liturgia → Revisar → Publicar` |
| Vínculo episodio ↔ liturgia | **Existe**: `church_podcast_episodes.liturgy_id REFERENCES liturgias(id)` |
| Portada de reflexión, **recuperable por `liturgy_id`** | `ConstructorLiturgias.tsx:1064` la guarda como `portada-reflexion`; `liturgyService.ts` la persiste en `liturgia_elementos` por `(liturgia_id, tipo)`; la imagen queda en `slides.slides[0].content.imageUrl` |
| Imagen → carátula cuadrada | `base64ToSpotifyCover()` en `coverImageUtils.ts:17`, con recorte central en `:32` |
| Generación actual de carátula | `useQuickPublish.ts:360` valida título y predicador y **carga el logo** antes de llamar a Gemini |
| Gate por ficheros | **En `main`** desde el merge de UPGRADE P0 (`5b947ac`) |
| Grabador en navegador | En `leadership/AudioRecorder.tsx` + `/recorder`. **Sin fallback para iOS < 18.4**; que esté "roto en iOS" nunca se midió |

Huecos: no hay ruta `/reflexiones`; no hay columna `slug` ni en la tabla ni en `types.ts`;
`vercel.json` tiene un solo rewrite `/(.*)` → `/index.html`; `PublishResult`
(`publishService.ts:44-51`) no devuelve slug ni URL canónica.

**Secuencia:** `E2` ‖ `E1-spike` → `E-infra` → `E3a` → `E3b` → `E4-spike` → ola 4.

---

## Phase E2 — Carátula desde la portada de la liturgia

**La única unidad candidata a congelar.** Ruta trazada, **sin cambios de esquema ni pruebas
locales de DB, y sin e2e** *(corregido en la r11 por Codex r10/N1: E2 sí **lee** una tabla
Supabase real y depende de su RLS; lo que no hace es tocar esquema ni necesitar Postgres local)*:

```
liturgia_elementos  WHERE liturgia_id = <ep.liturgy_id> AND tipo = 'portada-reflexion'
  → slides.slides[0].content.imageUrl        (data URL **o base64 crudo sin prefijo**)
  → base64ToSpotifyCover()                   (coverImageUtils.ts:17, recorte central en :32)
```

**Forma real de los datos, medida por Codex r11 contra producción (SELECT de sólo lectura):**
30 filas `portada-reflexion` — **14** con prefijo `data:image/png;base64,…`, **15** con base64
crudo sin prefijo, **1** sin `slides`, **0** con URL HTTP. Y 12 de esas 14 declaran MIME `png`
sobre un payload JPEG. `loadImage` (`coverImageUtils.ts:57`) acepta ambas formas por diseño, así
que 29 de 30 son consumibles y la restante cae en E2.6(b). **Los cuatro casos de E2.6 quedan
así confirmados contra los datos reales, no contra una hipótesis.**

**Decisión de producto de Brent (2026-08-07):** sin portada de reflexión guardada, se cae a la
ruta actual de Gemini y **se avisa**. *Promesa acotada tras Codex r10/N2: la ausencia de portada
guardada **no bloquea por sí sola** el flujo. Gemini o la publicación pueden fallar por su cuenta,
y eso es otro asunto.*

### Estrategia de tipado — congelada en la r11 (resuelve Codex r10/B1)

**El problema, medido.** `src/integrations/supabase/types.ts` cubre ~16 tablas de las 128 del
proyecto y **no contiene `liturgias` ni `liturgia_elementos`**
(`grep -c liturgia_elementos` → **0**). Por eso `useQuickPublish.ts` ya arrastra **2 errores
`tsc` de base** (TS2769 en `:195` por `.from('liturgias')`, TS2352 en `:200` por el cast).
Un helper nuevo que haga `.from('liturgia_elementos')` sobre el cliente tipado produce el mismo
TS2769 — y como el fichero es nuevo, su base es **cero**, así que **cualquier diagnóstico suyo es
nuevo y D18 lo bloquea**.

**Decisión: adaptador tipado estrecho.** No la elige el ejecutor.

| Opción | Por qué no |
|---|---|
| Regenerar `types.ts` | Blast radius sobre 128 tablas y **1041** diagnósticos (medido en `main @ 05dc4ca`). Es el arreglo de fondo, pero es su propia unidad, no un efecto lateral de E2 |
| Reutilizar `loadLiturgy()` | Funciona y no añade diagnósticos, pero carga **la liturgia entera** —todos los elementos con sus slides en base64— para extraer una imagen. Coste real en el navegador durante la publicación |
| Cast suelto en el helper | Escape del gate sin contención |

**Lo que se construye:** un módulo nuevo y pequeño que (1) ensancha el cliente **una sola vez**
y en **un solo sitio**, (2) declara explícitamente la forma de la fila que espera, y (3)
**valida esa forma en runtime** antes de devolverla.

**El tipo ensanchado es privado del módulo y no usa `any`** (Codex r11/N1): la config extiende
`tseslint.configs.recommended`, donde `no-explicit-any` es **error**, así que un
`SupabaseClient<any, …>` añadiría 2 diagnósticos de ESLint y E2.7 lo rechazaría. El ensanchado
estructural vía `unknown` mide cero — Codex lo demostró construyendo el prototipo y pasándole el
gate real. La validación de runtime **es** el guardrail
del cast: sin ella el cast sería una promesa; con ella, una aserción comprobada. Y no es trabajo
extra — E2.6 ya la exige.

### Asimetría de RLS entre `liturgias` y `liturgia_elementos` (Codex r11/S2)

`20260108000000_fix_liturgia_rls_authenticated.sql` da a **`liturgias`** una policy de lectura
para `is_liturgia_admin` (`:29`), pero en **`liturgia_elementos`** elimina los policies de admin
y **no los recrea** (`:35-48`): ahí sólo lee el propietario.

Consecuencia concreta: el selector de liturgias de `useQuickPublish.ts:195` puede mostrarle a un
admin una liturgia **ajena**, y la portada de esa liturgia le será **invisible** — 0 filas, y el
flujo emitirá "sin portada guardada" aunque la portada exista. Los tests, que van con mocks, no
lo verían nunca.

**Por eso E2.1 dice "legible por quien publica"** y no "guardada". La definición operativa de
E2.6 distingue por tanto *no existe* de *existe pero es invisible*: ambas degradan a Gemini, y
está bien que degraden, pero el plan no puede afirmar que la carátula será la portada cuando la
RLS puede impedirlo.

**Fuera de scope, explícitamente:** ampliar la lectura de `liturgia_elementos` sería un cambio de
policies —es decir, de esquema— y E2 no toca esquema. Va al backlog.

*Medido hoy: las 30 liturgias con `portada-reflexion` tienen un solo autor, así que el caso es
**latente, no activo**. Por eso Codex lo clasificó SHOULD-FIX y no BLOCKING.*

**Al backlog:** regenerar `types.ts` para las 128 tablas. Que cubra 16 es un defecto del repo que
produce buena parte de los **1041** diagnósticos, y arreglarlo haría innecesario este adaptador.

**Cómo se presenta el aviso — congelado tras Codex r9/S1**, que señaló que la r9 lo delegaba:
se emite con el **`useToast` que el editor ya usa**, como toast no bloqueante, en español, y el
scope incluye por tanto la superficie que lo dispara. No es un estado persistente ni un
componente nuevo.

**Camino corto — también tras r9/S1:** cuando hay portada de liturgia válida, **se omiten por
completo** la validación de título/predicador y la carga del logo que `useQuickPublish.ts:360`
hace hoy antes de Gemini. Esa ruta existe para construir un prompt; con una imagen ya generada
no hay prompt que construir.

**Scope:** `useQuickPublish.ts`, un helper de lectura de la portada, el toast, y tests.

**Out of scope:** rediseñar `Portadas.tsx`; cambiar `coverPromptBuilder.ts`; el recorte manual;
cualquier cosa que toque base de datos o e2e.

**Acceptance criteria:**
- [ ] E2.1 Con liturgia vinculada y portada guardada **y legible por quien publica**, la carátula
      **es esa portada**. *Acotado en la r12 por Codex r11/S2 — ver la asimetría de RLS abajo.*
      *Mutación declarada: volver a `buildSermonCoverPrompt` pone el test rojo.*
- [ ] E2.2 Con portada de liturgia válida, **no se llama a Gemini, ni se valida
      título/predicador, ni se carga el logo**. *Mutación: reintroducir la carga del logo debe
      romper el test.*
- [ ] E2.3 La conversión 4:3 → cuadrada usa el recorte central ya implementado, y está probada.
- [ ] E2.4 Liturgia vinculada **sin** portada guardada → ruta Gemini **y toast visible en
      español**, comprobado en el test, no sólo en el helper.
- [ ] E2.5 **Sin** liturgia (`onContinueWithoutLiturgy`) → ruta Gemini, flujo intacto.
- [ ] E2.6 **Cuatro casos de fallo de lectura**, cada uno degrada a Gemini y emite el toast
      *(enumerados tras Codex r10/S2, que señaló que el DoD los exigía sin que el test plan los
      cubriera)*: (a) la consulta devuelve error; (b) `slides` ausente o con forma inesperada;
      (c) `imageUrl` vacío o inválido; (d) `base64ToSpotifyCover()` falla. **Esos cuatro casos
      son además la definición operativa de "portada válida".**
- [ ] E2.7 El adaptador **no introduce ningún diagnóstico nuevo**: su medición con el gate parte
      de cero y debe terminar en cero.
- [ ] E2.8 Gate desde `main` sobre los ficheros tocados, con el SHA padre registrado. Build verde.

**Test plan:** `src/lib/sermon-editor/__tests__/liturgyCover.test.ts` (**nuevo**) —
`recupera la portada de reflexión de la liturgia`, `cae a Gemini cuando no hay portada guardada`,
`cae a Gemini cuando la liturgia no existe`, y **un caso por cada fallo de E2.6**:
`cae a Gemini cuando la consulta devuelve error`, `cae a Gemini cuando slides tiene forma
inesperada`, `cae a Gemini cuando imageUrl está vacío`, `cae a Gemini cuando la conversión falla`.

En el test del hook — **montando `useQuickPublish`**, no sólo el helper (Codex r10, respuesta 3):
`omite la carga del logo cuando hay portada de liturgia`, `emite el toast en español al degradar
a Gemini`. No hace falta reprobar el renderer: `App.tsx:40` ya monta `<Toaster />`.

Base-red o mutación por test (D18).

```bash
bash scripts/gates/changed-files-diagnostics.sh <ficheros tocados>
npx vitest run --no-file-parallelism src/lib/sermon-editor src/hooks
npm run build
```

**Definition of done:** tests verdes con evidencia base-red/mutación, E2.1–E2.8, gate y build.

**Risks / unknowns:** que liturgias antiguas tengan un `SlideGroup` con forma distinta a
`slides[0].content.imageUrl`. E2.4 y E2.6 cubren el caso degradado sin romper la publicación.

**Rollback:** `git revert`. La ruta Gemini sigue intacta debajo.

**Depende de:** nada. El gate ya está en `main`.

---

## Phase E1-spike — Grabación: sonda de compatibilidad real

**Precondición declarada:** necesita **acceso físico a los dispositivos de la matriz**. Sin
ellos, las celdas van como **no medidas** y el bloque resultante declara alcance reducido. No se
rellenan por inferencia — que es exactamente el defecto que este PM ya cometió tres veces.

**Wiring ya trazado:** el grabador debe producir un `File`; `handleFileSelected` lo decodifica;
`quickProcessor` lo convierte a MP3; el bucket sólo acepta `audio/mpeg`
(`20260610090001_podcast_media_storage.sql:15`).

**Scope:** `evidence/E1-spike.md` y, si hace falta, una página de sonda **desechable que no se
mergea**.

**Out of scope:** implementar el grabador; tocar `leadership/`; grabación larga o multipista.

**Acceptance criteria:**
- [ ] E1s.1 Matriz con resultado por celda: iOS ≥ 18.4, iOS < 18.4, Android Chrome, macOS Safari,
      Chrome de escritorio. Cada celda: MIME negociado y si la grabación se decodifica.
- [ ] E1s.2 La medición **construye un `MediaRecorder` real y graba**. `isTypeSupported` no vale.
- [ ] E1s.3 Evidencia cruda por celda. Sin evidencia → **no medida**, nunca inferida.
- [ ] E1s.4 Postura sobre iOS < 18.4: MIME negociado, degradación y qué se promete. Sustituye la
      afirmación no medida de "roto en iOS" que el plan arrastraba desde la r1.
- [ ] E1s.5 Recomendación con costo: reutilizar `leadership/AudioRecorder.tsx`, extraerlo, o
      escribir uno nuevo.
- [ ] E1s.6 Bloque de plan para E1-impl con **controles, ciclo start/stop, permisos, errores,
      limpieza del stream y el `File` resultante** — los seis huecos de Codex r8/B1.

**Test plan:** ninguno automatizado. La verificación es la matriz con su evidencia cruda.

**Definition of done:** `evidence/E1-spike.md` commiteado con matriz, evidencia y bloque de plan.

**Rollback:** ninguno; la sonda no se mergea.

**Depende de:** nada. **Puede arrancar hoy, en paralelo con E2.**

---

## Phase E-infra — Entorno de pruebas: Postgres local y harness e2e

**NO CONGELADA.** Existe porque Codex r9/B3 y B4 demostraron que E3a y E3b escondían esta unidad
dentro de sí, y porque mi afirmación de que el entorno ya estaba listo era falsa.

**Su primer criterio es una medición, no una construcción** — precisamente para no repetir el
error de especificar infraestructura que no he tocado.

**Nota de Codex r10/S3, aceptada:** en esta forma —"scope a acotar por su primer criterio"—
E-infra es honesta **sólo mientras siga en borrador**. No se puede congelar así, porque mezcla un
spike con una implementación desconocida. **Cuando se retome se parte en dos:**
`E-infra-spike` (medición, con `FINDINGS` como salida legítima) y una unidad de implementación
redactada **después** de medir. Lo dejo escrito ahora para que quien la retome no repita el error.

**Scope (a acotar por el propio E-infra.1):** configuración de puertos de Supabase local,
`.env.test`, seed de datos sintéticos, cleanup, y una guarda que impida que los e2e apunten a
producción.

**Out of scope:** detener o reconfigurar el proyecto Supabase ajeno (`sxlogxqzmarhqsblxmtj`) que
hoy ocupa el 54322 — es de otro proyecto y no se toca; migrar los tests existentes.

**Acceptance criteria (borrador — se cierran cuando E-infra.1 mida):**
- [ ] E-infra.1 **Medición primero**: qué hace falta para levantar el stack local de este
      proyecto sin chocar con el ajeno. Puertos, comandos exactos, tiempo de arranque, y si las
      61 migraciones aplican limpias. Salida cruda.
- [ ] E-infra.2 **Guarda anti-producción**: los e2e fallan ruidosamente si la URL de Supabase
      apunta al proyecto productivo `mulsqxfhxxdsadxsljss`. Probado con una mutación que
      intente apuntar a producción y deba abortar.
- [ ] E-infra.3 `.env.test` documentado y con plantilla commiteada (sin secretos).
- [ ] E-infra.4 Seed de datos sintéticos con IDs deterministas y cleanup.
- [ ] E-infra.5 Un e2e mínimo de humo que demuestre el harness completo.

**Test plan:** el propio E-infra.5 más la mutación de E-infra.2.

**Risks / unknowns:** que levantar un segundo stack de Supabase en esta máquina no sea viable
sin tocar el proyecto ajeno. **Si es así, la salida correcta es reportar `FINDINGS`** y llevar la
decisión a Brent — no apagar contenedores de otro proyecto por cuenta propia.

**Depende de:** nada. **Es lo que desbloquea E3a y E3b.**

---

# 📝 Borradores — E3a, E3b y E4-spike (NO congelados)

**No son contrato.** Codex r9 demostró que E3a y E3b escondían la unidad de infraestructura que
ahora es `E-infra`, y dejó abiertos huecos reales en el contrato del slug (r9/B2) y en la
semántica de paginación (r9/B5). Se conservan aquí porque el trabajo de trazado es válido y
porque tirarlos obligaría a rehacerlo — **pero se reescriben cuando `E-infra` haya medido.**

**OBSOLETO dentro de estos borradores (Codex r11/S1b), no aplicar:** toda mención a
`E0-gates` —unidad **retirada en la r10**, el gate está en `main`—, incluidos los criterios
`E3a.11` y `E3b.8` que piden "el SHA de E0-gates"; la línea *"Depende de: nada, ni siquiera de
E0-gates. Es lo primero que puede arrancar"* que quedó huérfana entre E3b y E4-spike **y que
contradice la tabla de olas: E3b depende de `E-infra`**; y la fila de la tabla del slug que dice
*"CLI 2.110.0 y Docker verificados; puerto por defecto 54322"*, que es exactamente la
verificación falsa que §5 retracta. **Nada de eso gobierna nada mientras el banner esté puesto.**

**Huecos conocidos, pendientes de cerrar (§16):** base de 80 caracteres + sufijo `-2` viola el
`CHECK`; título >80 sin guion no define truncado; "5 intentos" no dice si son 5 totales o 5
adicionales; de qué título sale el slug al reintentar un borrador; interacción entre colisión de
`slug` y de `episode_number` en el mismo `UPDATE`; **`PostgrestError` no expone un campo
`constraint`** — sólo `code`, `message`, `details` y `hint` — así que "inspeccionar el nombre"
tiene que decir en qué campo y cómo, y eso exige medir la forma real del error vía PostgREST;
y la paginación por offset **no garantiza ausencia de solapes** ante inserciones entre
peticiones, así que hay que elegir entre cursor/keyset o declarar el límite.

**Depende de:** E0-gates.

---

## Phase E3a — `slug`: contrato, DB y `publishService`

**Reescrita tras Codex r8/B2 y B3.** La r8 *enumeraba* las decisiones del slug y le pedía al
ejecutor que las "declarara". Eso es delegar el trabajo del planificador. **Aquí se toman.**

### Contrato del slug — congelado, no delegado

| Asunto | Decisión |
|---|---|
| **Normalización** | NFD → eliminar marcas diacríticas → minúsculas → `[^a-z0-9]+` → `-` → colapsar repetidos → recortar `-` de los extremos |
| **Longitud** | **≤ 80 caracteres**, truncando en el último `-` anterior al límite para no cortar una palabra. Impuesto además con `CHECK (char_length(slug) BETWEEN 1 AND 80)` |
| **Título vacío, sólo símbolos, o sin equivalente ASCII** | Fallback `reflexion-<episode_date en YYYY-MM-DD>` |
| **Colisión** | Sufijo numérico `-2`, `-3`, … El **índice único es el árbitro**: ante violación se reintenta con el siguiente, hasta **5** intentos, y luego **falla ruidosamente**. *Honestidad: esto es determinista con publicaciones serializadas, no bajo concurrencia real; lo que sí garantiza siempre es no producir un duplicado* |
| **Momento de asignación** | En el **`UPDATE` que publica** (`draft → published`), no al crear el borrador. Razón: el título puede cambiar mientras es borrador, y D12 congela el slug desde que se asigna |
| **Distinción de constraint** | El índice se llama **`idx_podcast_episodes_slug`**. Hoy `isUniqueViolation` sólo mira `code === '23505'` (`publishService.ts:112-117`) y el de número es `idx_podcast_episodes_number`: **el helper pasa a inspeccionar el nombre**, no sólo el código |
| **Host canónico** | `https://www.anglicanasanandres.cl` — nueva decisión activa **D19** |
| **Entorno de pruebas de base** | **Postgres local vía `supabase db reset`** (CLI 2.110.0 y Docker verificados; puerto por defecto 54322). Desechable, así que no hay problema de limpieza de datos sintéticos |

**Scope:** una migración aditiva, `publishService.ts`, tipos regenerados, y tests.

**Out of scope:** las páginas públicas (E3b); el trigger de GUID y la prohibición de `DELETE`
(backlog); el HTTP 404 (se va a la ola 3 con E4-impl).

**Acceptance criteria:**
- [ ] E3a.1 **Precondición verificada primero:** `supabase db reset` levanta el stack local y
      aplica todas las migraciones. **Si no levanta, la unidad reporta `FINDINGS` y para** — no
      se sustituye por mocks, porque una garantía de base sólo se prueba en la base.
- [ ] E3a.2 Migración aditiva: `slug TEXT`, `CHECK (char_length(slug) BETWEEN 1 AND 80)`, e
      índice único **`idx_podcast_episodes_slug`** (D9: sin DROP ni ALTER destructivo).
- [ ] E3a.3 La derivación implementa la tabla de arriba, con tests por fila: acentos, mayúsculas,
      símbolos, título vacío, título sólo-símbolos, título largo truncado en frontera de palabra.
- [ ] E3a.4 Colisión: dos títulos iguales producen `x` y `x-2`; al quinto intento fallido, error
      ruidoso, no silencioso.
- [ ] E3a.5 `isUniqueViolation` **distingue `idx_podcast_episodes_slug` de
      `idx_podcast_episodes_number`**. *Mutación declarada: volver a mirar sólo `23505` hace que
      una colisión de slug entre en el retry de número y el test se pone rojo.*
- [ ] E3a.6 Trigger: transición única `NULL → valor`; una vez asignado, inmutable (D12).
- [ ] E3a.7 **Republicar conserva el mismo slug**, probado con la secuencia
      `publicar → despublicar → republicar` contra Postgres local.
- [ ] E3a.8 `status = 'published'` ⇒ `slug IS NOT NULL`, impuesto en la base.
- [ ] E3a.9 `PublishResult` devuelve `slug` y `canonicalUrl` (host de D19).
- [ ] E3a.10 `src/integrations/supabase/types.ts` regenerado y conteniendo `slug`.
- [ ] E3a.11 Gate con el SHA de E0-gates registrado. Build verde.

**Test plan:** unitarios de derivación y colisión en `src/lib/sermon-editor/__tests__/slug.test.ts`
(**nuevo**); pruebas de trigger, `CHECK` e índice **contra Postgres local**, en
`supabase/tests/slug.sql` (**nuevo**), ejecutadas tras `supabase db reset`. Base-red o mutación
por test (D18).

```bash
supabase db reset
npx vitest run --no-file-parallelism src/lib/sermon-editor
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/slug.sql
```

**Definition of done:** tests verdes con evidencia base-red/mutación, E3a.1–E3a.11, gate.

**Risks / unknowns:** que `supabase db reset` no levante con las **61** migraciones del repo. Por
eso E3a.1 es el **primer** criterio y su salida es `FINDINGS`, no un apaño. Alternativa
registrada si ocurre: una branch de Supabase por MCP, que cuesta más y hay que limpiar.

**Rollback:** `git revert` del código. Columna, `CHECK` e índice quedan (aditivos).

**Depende de:** E0-gates.

---

## Phase E3b — Páginas públicas `/reflexiones` y `/reflexiones/:slug`

**Separada de E3a tras Codex r8/B3**, que señaló que la E3 de la r8 mezclaba migración, triggers,
concurrencia, tipos, dos páginas, paginación, RLS, Postgres y arquitectura HTTP en una sola
unidad — y que excedía claramente una sesión.

**Scope:** `src/appRoutes.tsx`, las dos páginas nuevas, y tests.

**Out of scope:** **el HTTP 404 real**, que se va a la ola 3 con E4-impl — hoy `vercel.json`
tiene un solo rewrite `/(.*)` → `/index.html` y ninguna ruta puede devolver 404 sin cambiar el
modelo de servido. **Esto elimina la dependencia circular de la r8.** Tampoco: buscador, filtros,
reproductor avanzado, enlace público a la liturgia.

**Acceptance criteria:**
- [ ] E3b.1 `/reflexiones` lista episodios `published`.
- [ ] E3b.2 **Paginación concreta: 12 por página, orden `published_at DESC` con desempate por
      `id` ascendente**, por offset. El desempate es lo que impide solapes entre páginas cuando
      dos episodios comparten `published_at`.
- [ ] E3b.3 Existe `/reflexiones/:slug` con reproductor y descarga.
- [ ] E3b.4 **e2e anónimo**: ambas rutas cargan sin sesión.
- [ ] E3b.5 **e2e anónimo**: un episodio `draft` **no** es accesible por su ruta. La RLS pública
      ya expone sólo `published` (`20260610090000_church_podcast_episodes.sql:73`); esto lo prueba.
- [ ] E3b.6 Un slug inexistente muestra un estado "no encontrado" **visual**, en español.
      *Declarado explícitamente: HTTP sigue siendo 200 hasta la ola 3.* No se finge un 404.
- [ ] E3b.7 Español (D14); sin PII de miembros (D13).
- [ ] E3b.8 Gate con el SHA de E0-gates. Build verde.

**Test plan:** tests de las dos páginas y de la paginación (incluido el caso de `published_at`
repetido, que es lo que E3b.2 existe para resolver); e2e de E3b.4 y E3b.5 con datos sintéticos.

```bash
npx vitest run --no-file-parallelism
npx playwright test
```

**Definition of done:** tests verdes con evidencia, E3b.1–E3b.8, gate.

**Risks / unknowns:** la tabla está **vacía** (0 filas, verificado), así que la paginación se
prueba con **datos sintéticos** — regla dura del proyecto.

**Rollback:** `git revert`.


---

**Depende de:** nada, **ni siquiera de E0-gates**. Es lo primero que puede arrancar.

---

## Phase E4-spike — Previsualización: prototipo desplegado

**Precondición declarada (Codex r8/S4):** necesita **credenciales de despliegue en Vercel** y
cuentas reales de WhatsApp y Facebook para comprobar el preview. Si no están disponibles, la
unidad reporta `BLOCKED` — no entrega una matriz teórica.

**El problema, medido:** `vercel.json` tiene un solo rewrite `/(.*)` → `/index.html`; hoy todas
las rutas reciben el mismo HTML con las 12 líneas genéricas de `index.html`.

**Arquitectura base heredada de A10a:** shell HTML enriquecido **para todos**, sin branching por
user-agent. Cualquier alternativa se justifica contra ella.

**Scope:** un **prototipo desplegado en preview de Vercel** (rama desechable, no se mergea) y
`evidence/E4-spike.md`.

**Acceptance criteria:**
- [ ] E4s.1 Prototipo desplegado y accesible en una URL de preview.
- [ ] E4s.2 Un crawler recibe metadatos **por episodio** — título, portada, predicador,
      canonical — verificado con `curl`, no con el navegador.
- [ ] E4s.3 **La SPA arranca correctamente sobre el HTML enriquecido.**
- [ ] E4s.4 Las 12 etiquetas genéricas de `index.html` quedan **reemplazadas, no duplicadas**.
- [ ] E4s.5 Comprobado sobre la URL desplegada con **WhatsApp y Facebook**, con evidencia.
- [ ] E4s.6 `og:audio` sólo se declara obligatorio **si E4s.5 demuestra que algún canal lo usa**.
- [ ] E4s.7 **Resuelve el HTTP 404** que E3b dejó fuera: cómo `/reflexiones/<slug-inexistente>`
      devuelve 404 real bajo la técnica elegida.
- [ ] E4s.8 Bloque de plan para E4-impl: superficie, ficheros, arquitectura de servido, 404 y
      tests automatizados — los cinco huecos que Codex r8/B1 nombró.

**Test plan:** ninguno automatizado. La verificación es el prototipo desplegado y la evidencia
cruda de E4s.2 y E4s.5.

**Definition of done:** `evidence/E4-spike.md` con la URL de preview, salidas crudas y el bloque
de plan. **El prototipo no se mergea**, así que no pasa por el gate.

**Depende de:** E3b — sin ruta y sin slug no hay URL de episodio que previsualizar.
# ⛔ Unidades `A*` — RETIRADAS en la revisión 7

**Nada de lo que sigue está vigente.** Son los cuerpos de las 12 unidades del plan de
distribución, conservados **sólo como referencia**, porque las reviews de Codex r1–r5 (§9, §11,
§12, §13) los citan por ID y esas trazas dejarían de resolver si los borrara. Ya cometí ese
error una vez: en la r6 borré sin querer los cuerpos de A12 y A13 al reemplazar un bloque.

**Los IDs `A*` no se reciclan.** El alcance vigente son las unidades `E*` de §5.

Lo que se rescata de aquí está incorporado a **E3** (que parte de A7) y a **E4-spike** (que
recupera el prototipo desplegado que A10a exigía y que la r7 había vaciado).

**Esas dos unidades NO heredan la aprobación de Codex r5** (r7/N1). La r7 les cambió scope,
dependencias, e2e y pruebas de RLS; una aprobación no sobrevive a eso. Se revisan de cero.

---

## Phase A0-core — Reconocimiento *(retirada)*

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
| **Medir el grabador de liderazgo en iOS y añadir fallback donde haga falta** (`RecorderPopupPage.tsx:67-68`) | Hallazgo de A19 | *Corregido en la r10 (Codex r9/S3): decía "arreglar... roto en iOS", lo que volvía a dar por medido algo que nunca se midió.* **Remite al resultado de E1-spike.** Es del sistema de liderazgo; se hace en su workstream |
| Búsqueda full-text sobre la descripción | A8 | A8 cubre título y predicador |
| **Texto del aviso cuando la portada existe pero la RLS la oculta** (`liturgyCover.ts:55`) | E2, Codex FINAL/S1 | `REASON_NOT_SAVED` dice *"Esta liturgia no tiene portada de reflexión guardada"*, pero una fila invisible por RLS da el mismo 0 filas y el mismo texto. **La degradación a Gemini es correcta en ambos casos; sólo el diagnóstico afirma de más.** Redacción propuesta por Codex: *"No se encontró una portada de reflexión disponible para esta liturgia."* |
| **Ampliar la lectura de `liturgia_elementos` a los admins de liturgia** | Codex r11/S2 | `20260108000000_fix_liturgia_rls_authenticated.sql` concede lectura de admin a `liturgias` (`:29`) pero **la elimina y no la recrea** en `liturgia_elementos` (`:35-48`). Un admin ve liturgias ajenas en el selector y no ve sus portadas. **Es cambio de policies, o sea de esquema**, y E2 no toca esquema |
| **Regenerar `src/integrations/supabase/types.ts` para las 128 tablas** | Codex r10/B1 | Hoy cubre **~16** y no incluye `liturgias` ni `liturgia_elementos`, lo que fuerza casts por todo el repo y produce buena parte de los **1041** diagnósticos `tsc` (`main @ 05dc4ca`). Arreglarlo haría innecesario el adaptador de E2. Blast radius grande: es su propia unidad, no un efecto lateral. **Aviso de Codex r12/N4:** los mensajes de `tsc` incrustan el volcado del union de `Database`, así que tocar `types.ts` **reimprime ~208 mensajes de ficheros ajenos con texto distinto** (mismo fichero, línea y código). Esa unidad verá cientos de deltas crudos que **no** son diagnósticos nuevos y **necesitará comparación normalizada** — el único caso del plan donde §4.3 no se aplica literal |

### Retirado en la r7 por el re-alcance de Brent — **la pista de distribución completa**

Esto **era el plan**. No es basura ni alcance descartado: es el objetivo original, aplazado
entero por decisión de Brent del 2026-08-07 ("primero el bucle interno; luego vemos temas de
distribución"). Se retoma como bloque, no pieza a pieza.

| Retirado | Era | Qué haría falta para retomarlo |
|---|---|---|
| **Correctitud del feed RSS** (`HEAD`, duración `HH:MM:SS`, correo institucional) | A1 | El buzón institucional. **Medido el 2026-08-07: el dominio no tiene registros MX**, así que hay que provisionar correo antes que nada |
| **Feed servido desde dominio propio** (`www`, rewrite en `vercel.json`) | A3 | Depende de A1 |
| **Validación operativa del feed** (Cast Feed Validator, Podbase, rangos `206`) | A6 | Depende de A3 y de que exista al menos un episodio con portada |
| **Portada del canal + episodio canario** | A5-core | Hoy `show/cover.jpg` da **400** |
| **Claves content-addressed + cache inmutable** | A2-core | Independiente; se puede retomar sola |
| **Inmutabilidad del `guid` por trigger y prohibición de `DELETE`** | A4-core, mitad de la ex-D5 | *Corregido en la r9 (Codex r8/S3): **el slug ya volvió** al alcance activo en E3a y D12; aquí queda sólo la parte de GUID y borrado.* Vuelve a ser obligatoria en cuanto haya distribución |
| **Backfill del catálogo desde Spotify** | A11-spike | La URL del feed de origen (ex-A0.6), que nadie ha confirmado |
| **`podcast:guid` + `<link>` por episodio** | A14-core | Depende del backfill |
| **Directorios + redirect de Spotify** | A-cutover-spike | Depende de todo lo anterior. D8 y D11 siguen vigentes cuando se retome |
| **Reconocimiento** (conteos, estado en Spotify for Creators, auditoría musical) | A0-core | Cuatro de sus ocho criterios exigen consolas de Brent |

**Decisiones trasladadas aquí en la r8 (Codex r7/S4).** Seguían en el bloque de arquitectura
activa describiendo un plan que ya no existe. Aquí vuelven a ser correctas, palabra por palabra:

| Decisión | Qué dice |
|---|---|
| **D1** | El feed RSS propio es la fuente de verdad del catálogo; todo directorio, incluido Spotify, se alimenta de él |
| **D4** | La identidad pública del feed es `https://www.anglicanasanandres.cl/podcast/feed.xml` — con `www`, porque el apex responde 307 → www |
| **D6** | El correo de `itunes:owner` es institucional, nunca personal. **Medido el 2026-08-07: el dominio no tiene MX; hay que provisionarlo antes que nada** |
| **D7** | No se activa video en Spotify (razón corregida en la r4, conservada) |
| **D8** | **Nunca borrar la cuenta de Spotify for Creators.** Prohibición dura, no preferencia |
| **D11** | Ninguna acción sobre Spotify ocurre antes de validar el feed y tener Apple aprobado |

**Trasladada aquí en la r9 (Codex r8/S3):** **D17** — ningún aviso automático (WhatsApp, correo)
se envía sin audiencia con consentimiento y baja, y sin una fila de entrega única por
(episodio, canal, destinatario). La idempotencia es una restricción de unicidad en la base, no
una columna `announced_at`. Ninguna unidad de AUDIO envía nada; está escrita para que quien
retome los avisos no la reinvente.

**Decisiones que quedan vigentes aunque ninguna unidad las implemente:** D6 (correo
institucional, nunca personal), D8 (no borrar la cuenta de Spotify), D11 (orden del corte),
D12 (slug inmutable una vez publicado), D17 (nada de envíos automáticos sin outbox). Están
escritas para que quien retome la distribución no las reinvente.

### Retirado en la r6 por el consenso con Codex (PARTIAL PASS r5)

Nada de esto es basura: es alcance que no sirve a la condición de éxito de §1 y que por eso
sale del plan a ejecutar. Se retoma cuando su propio objetivo lo justifique.

| Retirado | Era | Por qué sale |
|---|---|---|
| **Búsqueda accent-insensitive, filtros y RPC** | A8 | A7 ya entrega archivo paginado; buscar no aparece en la condición de éxito |
| **Reproductor avanzado (wavesurfer)** | A9 | Ya estaba declarado opcional; A7 entrega reproducción y descarga |
| **Implementación y evidencia SEO** | A10b, A10c | *Corregido en la r9 (Codex r8/S3): **E4-impl la reincorpora** en la ola 3, con el bloque que produzca E4-spike. Aquí queda sólo lo que exceda ese bloque* |
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
- El hallazgo de que el grabador de liderazgo **no tiene fallback para iOS < 18.4**
  (`RecorderPopupPage.tsx:67-68`, ambos mime son webm) y su corrección.
- La medición de Codex de que **90 min estéreo a 48 kHz ≈ 1,93 GiB de PCM** y que el pipeline
  lo materializa en memoria en cinco puntos — el dato que hace que la grabación larga sea un
  problema real y no un detalle.


---

## 7. Riesgos del plan como conjunto

**Reescrita en la r10 (Codex r9/S4).** La tabla anterior enumeraba riesgos de A6, A20, A0.9,
Spotify, Apple y el feed — todas unidades retiradas — e incluso afirmaba que "A0.9 instala la
medición" cuando A0.9 estaba retirado en §6. Un documento cuyo bloque de riesgos describe un plan
que ya no existe no sirve como fuente del estado activo. **Los riesgos del plan de distribución
se conservan con él, en §6.**

Riesgos vigentes de las unidades actuales:

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| **No se puede levantar un segundo stack de Supabase local** sin tocar el proyecto ajeno que ocupa el 54322 | media | alto — bloquea E3a y E3b | `E-infra.1` lo mide primero; si no es viable, **reporta `FINDINGS` a Brent**, no apaga contenedores ajenos |
| **Un e2e mal configurado escribe en producción** | **era real en la r9** | **crítico** — la base es compartida con Life OS | `E-infra.2`: guarda que aborta si la URL apunta a `mulsqxfhxxdsadxsljss`, probada con mutación |
| E1-spike no consigue los dispositivos de la matriz | media | medio | Celdas como **no medidas**, nunca inferidas; Brent decide si E1-impl arranca con cobertura parcial |
| Liturgias antiguas con `SlideGroup` de forma distinta | media | bajo | E2.4 y E2.6: degrada a Gemini con aviso, sin romper la publicación |
| E4-spike concluye que el preview obliga a cambiar el modelo de despliegue | media | alto | El spike lo determina desplegando, no razonando; el costo se declara en su bloque |
| **El PM vuelve a escribir "verificado" sobre una inferencia** | **ha ocurrido tres veces** | alto | Registro explícito en §5; toda afirmación de estado lleva el comando que la produjo |

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
| 2026-08-07 | **r7: re-alcance completo a "bucle interno de escucha".** El Goal pasa de distribución en directorios a: grabar en el editor, carátula derivada de la portada de la liturgia, publicación automática en página propia, y enlace compartible en redes y WhatsApp. 12 unidades `A*` → **5 unidades `E*`** | El plan es demasiado ambicioso para una primera instancia. Además, tras seis rondas de planificación seguía sin haber **ninguna unidad arrancable**: cinco de las seis "congeladas" dependían de una fase recortada y la sexta de una respuesta que no existía | Brent |
| 2026-08-07 | **La carátula reutiliza el sistema de generación de portadas que ya existe**; no se construye generación nueva | Decisión de producto de Brent. `Portadas.tsx` ya genera una portada de REFLECTION con el título de la liturgia y el predicador — es exactamente "una versión de la portada de la liturgia". E2-spike sólo decide si se recupera la ya generada o se reinvoca el generador | Brent |
| 2026-08-07 | **D6 y el correo institucional salen del camino crítico** | `itunes:owner` sólo sirve para verificar propiedad ante directorios, y no hay directorios en el alcance nuevo. Medido: `dig MX anglicanasanandres.cl` → **sin registros**; el dominio no puede recibir correo y ese buzón habría que crearlo. D6 sigue vigente para cuando vuelva la distribución | Brent + PM (evidencia) |
| 2026-08-07 | **E3 acepta slug mutable**: se retira el trigger de inmutabilidad (ex-A4-core) del alcance | Degradación consciente frente a D5/D12. Con el enlace circulando sólo por redes y WhatsApp, el costo de un slug cambiado es un enlace roto; con 15 directorios indexando, es pérdida de identidad. **El trigger vuelve a ser obligatorio cuando vuelva la distribución**, y así está escrito en el riesgo de E3 | PM |
| 2026-08-07 | **Se registra que D18 no es satisfacible hoy**: `scripts/gates/changed-files-diagnostics.sh` no existe en `main` | Verificado por rama: existe sólo en `feat/mesa-md-gates` (UPGRADE P0, `FAIL 2/2`, cuarta ronda por override). E3 y E5 son código y quedan atadas a que P0 aterrice. **Ablandar D18 es una decisión de Codex o Brent, no del PM** | PM |
| 2026-08-07 | **r8: cada spike lleva su implementación detrás.** Se añaden `E1-impl`, `E4-impl` y `E6`; E5 pasa a depender de E4-impl, no de E4-spike. 5 → **8 unidades** | La r7 tenía tres spikes y ninguna implementación: al completarla no habría habido grabación, ni carátula desde la liturgia, ni previsualización. **Un plan que no entrega su propio Goal está roto** | Codex r7/B1, confirmado por Brent |
| 2026-08-07 | **r8: E6 nueva — el bucle se cierra dentro de este bloque.** `PublishResult` devuelve slug y URL; la pantalla de éxito ofrece abrir/copiar/compartir; se retiran el mensaje de feed y el "Publicar en Spotify"; el CTA de la home apunta a `/reflexiones` | Medido: `publishService.ts:44-51` no devuelve slug; `QuickPublishProgress.tsx:46,58`; `QuickStepReview.tsx:247`; `SermonCard.tsx:45`. Todo el flujo seguía apuntando a lo que se acababa de sacar del alcance | Codex r7/B1 + Brent |
| 2026-08-07 | **r8: se revierte el slug mutable. D12 se restaura y amplía**; E3 lleva contrato completo de slug (derivación, colisiones, republicación, `published ⇒ slug NOT NULL`, tipos regenerados) | **Error mío en la r7.** Argumenté que un enlace de WhatsApp tolera un slug cambiado "porque no está indexado". Un enlace compartido se rompe igual, y encima rompe canonical, caché y la previsualización que E4 construye. Además `publishService.ts:278-285` reintenta cualquier `23505` como colisión de `episode_number` | Codex r7/B2 + B3 |
| 2026-08-07 | **r8: E2 deja de ser spike y pasa a unidad de código** | **Corrección de hecho.** La r7 afirmaba que la portada de reflexión no era recuperable por `liturgy_id`. Es falsa: `ConstructorLiturgias.tsx:1064` la guarda como `portada-reflexion` y `liturgyService.ts` la persiste en `liturgia_elementos`; `base64ToSpotifyCover()` acepta esa data URL | Codex r7/S1 y S2 |
| 2026-08-07 | **r8: E4-spike recupera el prototipo desplegado** que A10a exigía y que la r7 había vaciado a un memo | Un spike que prohíbe tocar `index.html` no puede demostrar que las etiquetas genéricas se reemplazan, ni que la SPA arranca sobre el shell enriquecido, ni que WhatsApp lo consume | Codex r7/B4 |
| 2026-08-07 | **r8: D18 se ejecuta desde un SHA aprobado del gate en worktrees desechables**, no esperando a que UPGRADE P0 se mergee. **Rechazado** medir con `tsc`/`eslint` a mano | Desacopla el gate de la entrega de UPGRADE: la dependencia baja de "P0 mergeado a `main`" a "P0 aprobado". Medir a mano sería un gate distinto y peor definido sobre un repo con 1041/160/94/46 diagnósticos | Codex r7/B5 |
| 2026-08-07 | **r8: D1, D4, D6, D7, D8 y D11 salen del bloque activo al de distribución. D5 se parte. D10 se rejustifica. D17 baja a guardrail. D18b se endurece** | Seis decisiones seguían describiendo el plan retirado — D1 llegaba a decir "Es el objetivo entero", ya falso, y D11 referenciaba fases inexistentes. D18b exigía `og:audio` sin evidencia de que ningún canal real lo consuma | Codex r7/S4 |
| 2026-08-07 | **r8: se retira la afirmación "el grabador está roto en iOS"** — pasa a "sin fallback para iOS anterior a 18.4", y **E1-spike tiene que medirlo** | No estaba medida. Safari/iOS 18.4 añadió WebM a `MediaRecorder`, dato que este mismo plan registraba en su ledger de la r2 mientras afirmaba lo contrario en §0 | Codex r7/S1 |
| 2026-08-08 | **✅ `E2` DONE.** `CODEX REVIEW E2 FINAL` → **PASS** sobre `6d45f35`. Cero desviaciones del plan congelado: no hubo que enmendar nada durante la ejecución | Codex verificó A1–A8 uno a uno y corrió las cuatro mutaciones que el PM no había comprobado (M2→1 rojo, M3→1, M4→1, M5→5). Runtime registrado (D18 §4.6): Node **v22.22.0**, Deno **2.7.11** | Codex (PASS final) |
| 2026-08-08 | **La regla de clasificación de §4.3 se gana su sitio en su primera aplicación real** | El delta de E2 fue exactamente el falso positivo que anticipaba: los 2 errores base de `useQuickPublish.ts` se desplazaron de `(195,15)`/`(200,20)` a `(198,15)`/`(203,20)` por los imports nuevos. Sin esa frase, el ejecutor habría reportado un delta inexistente | PM |
| 2026-08-07 | **✅ `E2` CONGELADA.** `CODEX REVIEW plan r12` → **PASS** sobre `3084208`. Se congelan alcance, comportamiento, estrategia de tipado, test plan y gate | Codex validó la estrategia de tipado **construyendo el adaptador y midiéndolo** (0/0/0/0), no argumentando, y reprodujo `tsc=1041` en `main @ 05dc4ca`. Las tres condiciones de su r11 (B1, S2, S3) quedaron aplicadas y verificadas | Codex r12 (PASS) |
| 2026-08-07 | **r13: la regla de evidencia se unifica a SHA siempre**, nunca nombre de rama | Codex r12/S1. El 2026-08-07, entre las 15:39 y las 15:52, otra sesión tuvo este checkout compartido en `main`: **dos mediciones de Codex y una mía** se atribuyeron a la rama equivocada dentro de esa ventana. Un nombre de rama no identifica un árbol; un SHA sí | Codex r12/S1 |
| 2026-08-07 | **r13: se registra que el error de atribución de árbol también lo cometió Codex** en su r11 | Simetría, y evidencia de que la regla nueva no es una penitencia del PM sino una condición del método: habría delatado a los dos | Codex r12 (auto-corrección) |
| 2026-08-07 | **r13: la unidad futura "regenerar `types.ts`" necesitará comparación normalizada** | Codex r12/N4: los mensajes de `tsc` incrustan el volcado del union de `Database`, así que tocar `types.ts` reimprime **~208 mensajes de ficheros ajenos** con texto distinto pero mismo fichero, línea y código. Es el único caso del plan donde §4.3 no se aplica literal | Codex r12/N4 |
| 2026-08-07 | **r12: la línea base se corrige a `tsc=1041`** y se fija que los totales se miden **en el SHA padre**, en worktree limpio, anotando el SHA | Codex r11/B1. La r11 dijo `1039` "medido": el comando era real pero corrió sobre `feat/mesa-md-schema` (P1 de UPGRADE, que arregla dos diagnósticos), no sobre `main`. Remedido en worktree limpio de `main` (05dc4ca): **1041** | Codex r11/B1 |
| 2026-08-07 | **r12: la regla de evidencia se endurece — comando, salida Y la identidad del árbol** | Es la cuarta verificación falsa mía, y la primera que rompe la regla adoptada para evitar las tres anteriores: nombré el comando pero no el árbol. Un total sin árbol es un número con un comando al lado | Codex r11/B1 |
| 2026-08-07 | **r12: E2.1 se acota a "portada guardada **y legible por quien publica**"** | Codex r11/S2: `20260108000000_fix_liturgia_rls_authenticated.sql` da lectura de admin a `liturgias` (`:29`) pero **la elimina y no la recrea** en `liturgia_elementos` (`:35-48`). Un admin puede ver una liturgia ajena en el selector y no ver su portada → degrada a Gemini con "sin portada guardada" aunque exista. Ampliar esa lectura sería cambio de policies, fuera del scope de E2 | Codex r11/S2 |
| 2026-08-07 | **r12: §4 cita la regla de clasificación del README** —desplazamiento de línea aceptable, diagnóstico nuevo bloqueante— y el patrón worktree+symlink | Codex r11/S3: los 2 errores base de E2 viven en `(195,15)` y `(200,20)`, y cualquier import nuevo los desplaza. Sin la regla, la comparación de E2.8 daría delta falso en la primera pasada | Codex r11/S3 |
| 2026-08-07 | **r12: la estrategia de tipado prohíbe `any` explícitamente** | Codex r11/N1 lo demostró midiendo: `SupabaseClient<any,…>` añade 2 errores de `no-explicit-any` (es **error** en esta config); el ensanchado estructural vía `unknown` mide cero | Codex r11/N1 |
| 2026-08-07 | **r11: E2 congela la estrategia de tipado — adaptador estrecho** con el cliente ensanchado en un solo sitio, la forma de fila declarada y **validación en runtime como guardrail del cast** | Codex r10/B1, medido: `types.ts` cubre ~16 de 128 tablas y no tiene `liturgias` ni `liturgia_elementos`; `useQuickPublish.ts` ya arrastra 2 errores `tsc` por eso, y un fichero nuevo parte de base cero, así que cualquier diagnóstico suyo bloquearía el gate. Regenerar `types.ts` es el arreglo de fondo pero es su propia unidad; reutilizar `loadLiturgy()` cargaría la liturgia entera para extraer una imagen | Codex r10/B1 |
| 2026-08-07 | **r11: §4 se reescribe entera** — el gate se ejecuta desde `main`, sin SHA que fijar ni worktrees. Y la línea base pasa de `tsc=1041` a **`tsc=1039`**, medida | Codex r10/S1: §4 seguía afirmando que el script no existía en `main` y que P0 estaba en `FAIL 2/2`, ofreciendo un procedimiento incompatible con §5 justo para la decisión que gobierna E2. El 1041 venía de la r1 y nadie lo volvió a medir | Codex r10/S1 |
| 2026-08-07 | **r11: E2.6 enumera sus cuatro fallos de lectura**, y esos cuatro casos son la definición operativa de "portada válida" | Codex r10/S2: el DoD exigía E2.6 y el test plan no lo cubría | Codex r10/S2 |
| 2026-08-07 | **r11: se registra que `E-infra` deberá partirse** en `E-infra-spike` + implementación cuando se retome | Codex r10/S3: en su forma actual mezcla spike e implementación, y eso sólo es aceptable mientras sea borrador | Codex r10/S3 |
| 2026-08-07 | **r10: `E0-gates` se retira.** UPGRADE P0 pasó Codex y se mergeó a `main` (`5b947ac`); el gate y su self-test ya están ahí, con el blob `51af6197…` idéntico al aprobado | Verificado: `git ls-tree main scripts/gates/`. D18 vuelve a funcionar tal como se escribió, sin SHA que fijar ni worktrees que montar | Codex (PASS de P0) |
| 2026-08-07 | **r10: la ola 1 se reduce a `E2`**, y `E3a`/`E3b` pasan detrás de una unidad nueva, **`E-infra`** | Codex r9/B3 y B4: ambas escondían la construcción de un entorno de pruebas que no existe. E2 no toca base ni e2e, así que es lo único congelable hoy sin esconder trabajo | Codex r9/B3+B4, decidido por Brent |
| 2026-08-07 | **r10: se registra que mi afirmación "Postgres local disponible" era falsa** — `supabase status` falla y el 54322 lo ocupa otro proyecto. **Tercera verificación falsa mía en este plan**, y queda escrita en §5 | Codex r9/B3 lo midió. Las tres tienen la misma forma: una inferencia dentro de una sección titulada "medido". La más grave es la derivada: la E3b de la r9 habría creado filas sintéticas **contra producción**, que es la base compartida con Life OS | Codex r9/B3+B4 |
| 2026-08-07 | **r10: E2 congela cómo se avisa (toast con el `useToast` existente) y el camino corto** (con portada válida no se valida título/predicador ni se carga el logo) | Codex r9/S1: la r9 exigía "aviso visible" sin decir dónde ni probarlo, y no aprovechaba que `useQuickPublish.ts:360` sólo hace ese trabajo para construir un prompt que ya no hace falta | Codex r9/S1 |
| 2026-08-07 | **r10: §7 se reescribe con los riesgos de las unidades vigentes** | Codex r9/S4: enumeraba riesgos de A6, A20, Spotify, Apple y feed —retiradas— y afirmaba que A0.9 instala una medición cuando A0.9 estaba retirado | Codex r9/S4 |
| 2026-08-07 | **r9: el plan pasa a olas.** Sólo se congela lo especificable hoy (`E0-gates`, `E2`, `E3a`, `E3b`); los dos spikes van en paralelo; `E1-impl`, `E4-impl`, `E5` y `E6` **dejan de contarse como unidades**. Se declara explícitamente que este bloque **no entrega las cuatro condiciones del Goal** | 8 rondas de plan, 6 reviews, 0 código. Cada enmienda hacía crecer el documento y cada documento generaba más findings (r7: 5 unidades → 10 findings; r8: 8 → 11). Codex r8/B1 nombró la causa: una implementación que su spike aún no ha acotado no se puede contar como aprobada | Codex r8/B1 + Brent |
| 2026-08-07 | **r9: `E0-gates` nueva — el gate se revisa dentro de AUDIO** | Codex r8/B4: alguna implementación del gate tiene que estar revisada, pero **no tiene por qué aprobarse como parte de UPGRADE P0**. La r8 confundía las dos cosas y dejaba seis unidades esperando a un workstream en `FAIL 2/2` | Codex r8/B4 |
| 2026-08-07 | **r9: el contrato del slug se congela en el plan, no se delega al ejecutor**: normalización NFD, ≤80 con truncado en frontera de palabra, fallback `reflexion-<fecha>`, sufijo `-N` con el índice como árbitro, asignación en el `UPDATE` que publica, e inspección del **nombre** del índice en vez del `23505` genérico | Codex r8/B2: la r8 enumeraba las decisiones y le pedía al ejecutor que las "declarara". Eso es delegar el trabajo del planificador, que es exactamente lo que r7/B3 ya había señalado | Codex r8/B2 |
| 2026-08-07 | **r9: E3 se parte en `E3a` (slug + DB) y `E3b` (páginas), y el HTTP 404 se va a la ola 3 con E4-impl** | Codex r8/B3: E3 mezclaba migración, triggers, concurrencia, tipos, dos páginas, paginación, RLS, Postgres y arquitectura HTTP — y además era circular, porque exigía un 404 que sólo E4 puede dar mientras E4 dependía de E3 | Codex r8/B3 |
| 2026-08-07 | **r9: las pruebas de base corren contra Postgres local vía `supabase db reset`** | Verificado: `supabase` CLI 2.110.0, Docker corriendo, `config.toml` con `project_id`. **No existe hoy ninguna infraestructura de test contra Postgres en el repo** (`grep postgres://\|pg.Client\|new Pool` en tests → 0), así que E3a.1 verifica primero que el stack levante y reporta `FINDINGS` si no | Codex r8/B2 (pedía declarar el entorno) |
| 2026-08-07 | **r9: E2 queda congelada — sin portada de reflexión guardada, cae a la ruta Gemini y avisa en la UI** | Codex r8/B5 la marcó BLOCKING por tener una decisión de producto abierta. Brent la resuelve: nadie se queda sin publicar, y es el comportamiento que ya existe, así que es el cambio más pequeño | Brent |
| 2026-08-07 | **D19 nueva: el origen canónico público es `https://www.anglicanasanandres.cl`** | Codex r8/S3 señaló que faltaba una decisión activa para el origen canónico. La medición que sostenía a D4 (apex → **307 → www**) sigue siendo válida aunque D4 se fuera con la distribución | Codex r8/S3 |
| 2026-08-07 | **r9: D5 se retira, D17 se traslada físicamente al backlog, y el backlog deja de reclamar el slug** | Codex r8/S3. D5 ya sólo remitía a D12; D17 decía haber bajado a backlog mientras seguía en el bloque activo; y el backlog pedía "inmutabilidad de slug y guid" cuando el slug ya había vuelto a E3a | Codex r8/S3 |
| 2026-08-07 | **r9: los spikes declaran sus precondiciones** — E1-spike necesita los dispositivos de la matriz; E4-spike necesita credenciales de Vercel y cuentas reales de WhatsApp y Facebook | Codex r8/S4: permitir evidencia incompleta sin declarar de qué depende convierte "no medido" en una salida cómoda | Codex r8/S4 |
| 2026-08-07 | **r8: E3 y E4-spike dejan de heredar la aprobación de Codex r5** a A7 y A10a | La r7 les cambió scope, dependencias, e2e y pruebas de RLS. Una aprobación no sobrevive a eso, y presentarla como heredada era vender revisión que no existe | Codex r7/N1 |

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

**PLAN POR OLAS — ola 1 = `E2`, y nada más.** `E1-spike` va en paralelo; `E-infra`, `E3a`, `E3b`
y `E4-spike` no están congeladas; `E1-impl`, `E4-impl`, `E5` y `E6` no son unidades todavía.
Trayectoria: 28 en el pico → 12 (r6) → 5 (r7) → 8 (r8) → 4 (r9) → **1 congelable desde la r10**.

**Esta revisión 12 no ha pasado por Codex. Ninguna unidad arranca hasta que lo haga.**

*(Codex r11/S1a: esta sección seguía describiendo la r9 —"ola 1 congelable (4 unidades)"— tres
revisiones después. Es la misma enfermedad que r9/S4 y r10/S1 corrigieron en §7 y §4.)*

**Por qué la r9 deja de intentar un contrato único.** Ocho rondas de plan, seis reviews, **cero
líneas de código**. Las dos últimas rondas crecieron y cada crecimiento produjo más findings: la
r7 tenía 5 unidades y sacó 10; la r8 tenía 8 y sacó 11. Codex r8/B1 nombró la causa: un spike
puede producir legítimamente el plan de su implementación, pero entonces esa implementación **no
se puede contar todavía como unidad aprobada**. Yo estaba escribiéndolas igual, y salían vacías.

La r9 sólo congela lo que hoy puedo especificar sin inventar, y **dice en voz alta que este
bloque no entrega las cuatro condiciones del Goal**: entrega la carátula desde la liturgia y las
páginas públicas. La grabación y la previsualización las acotan sus spikes y se entregan después.
El alcance total no baja; se secuencia.

### Por qué se re-alcanzó (el hallazgo que lo forzó)

La r6 dejó seis fases "congeladas y ejecutables ya". Al arrancar el PM de ejecución el
2026-08-07 se comprobó, contra el índice de dependencias, que **eso era falso**: ninguna de las
doce unidades era arrancable.

| Congelada | Depende de | Por qué estaba bloqueada |
|---|---|---|
| A1 | A0.7 | criterio que sólo Brent podía responder — y la respuesta fue que **el buzón no existe** |
| A3 | A1 | encadenada |
| A6 | A3, **A5-core** | A5-core recortada, sin confirmar |
| A7 | **A4-core**, **A5-core** | ambas recortadas |
| A10a | A7 | encadenada |
| A11-spike | A0.6, **A4-core** | Brent + recortada |

Cinco de las seis colgaban de una fase recortada; la sexta de un dato inexistente. El congelado
parcial de la r6 **no dejó nada ejecutable**, y eso no se vio en la r5 porque el recorte que
creó las seis pendientes se aplicó después.

Sobre ese diagnóstico, Brent declaró el plan demasiado ambicioso para una primera instancia y
fijó el alcance nuevo. La regla acordada desde la r5 sigue en pie: **lo que Codex señale se
recorta o se convierte en spike**; no se pule la misma unidad ronda tras ronda.

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


---

## 14. Trazabilidad de la review de Codex r7 (FAIL)

**Veredicto:** FAIL — 5 BLOCKING, 4 SHOULD-FIX, 1 NIT. **Aceptados los diez.** Ningún
desacuerdo. Quinta ronda consecutiva en que Codex acierta en todo lo comprobable.

**Verificación independiente antes de aceptar** (el PM no tomó la review al pie de la letra):

| Afirmación de Codex | Comprobación del PM | Resultado |
|---|---|---|
| `PublishResult` no devuelve slug ni URL | `publishService.ts:44-51` — sólo `episodeId, audioUrl, coverUrl, guid, episodeNumber, feedUrl` | confirmado |
| El retry de `23505` confundiría una colisión de slug | `publishService.ts:278-285` — `while (result.error && isUniqueViolation(result.error))` reintenta con número nuevo | confirmado |
| Existe despublicar → riesgo al republicar | `unpublishEpisode()` devuelve la fila a `draft` conservándola | confirmado |
| La UI sigue apuntando a Spotify y al feed | `QuickPublishProgress.tsx:46,58`; `QuickStepReview.tsx:247`; `SermonCard.tsx:45` | confirmado |
| `slug` no está en los tipos generados | `grep -c slug src/integrations/supabase/types.ts` → **0** | confirmado |
| `vercel.json` sirve el mismo HTML a todas las rutas | un solo rewrite `/(.*)` → `/index.html`, framework `vite` | confirmado |
| **La portada de reflexión SÍ es recuperable por `liturgy_id`** | `ConstructorLiturgias.tsx:1064` la guarda como `portada-reflexion`; `liturgyService.ts` la persiste en `liturgia_elementos` por `(liturgia_id, tipo)` | confirmado — **la r7 afirmaba lo contrario** |
| Referencias obsoletas a "unidad B" | líneas 19 y 1247 de la r7 | confirmado |

| Finding | Clase | Resolución en la r8 |
|---|---|---|
| **B1** el plan no implementa tres de las cuatro condiciones del Goal | BLOCKING | **Aceptado.** Se añaden `E1-impl`, `E4-impl` y `E6`; E5 pasa a depender de E4-impl. 5 → 8 unidades. Brent confirmó el alcance completo y metió el cierre del bucle dentro del bloque |
| **B2** el slug mutable rompe el producto nuevo | BLOCKING | **Aceptado — error mío.** D12 restaurada y ampliada; E3 impone `NULL → valor`, inmutabilidad posterior y republicación con el mismo slug. El trigger de GUID y la prohibición de `DELETE` siguen en backlog, como Codex admite |
| **B3** E3 no especifica cómo producir un slug correcto | BLOCKING | **Aceptado.** E3.2–E3.9: derivación, longitud, no-ASCII, colisión determinista contra la constraint, distinción del `23505`, `published ⇒ slug NOT NULL`, `PublishResult` con slug, tipos regenerados. Probado contra Postgres real |
| **B4** el spike de previsualización no prueba nada | BLOCKING | **Aceptado.** E4-spike recupera el prototipo **desplegado** de A10a: E4s.1–E4s.6, con evidencia cruda sobre WhatsApp y Facebook, y `og:audio` sólo si se demuestra que alguien lo usa |
| **B5** D18 bloquea E3/E5 y esperar el merge no es la única salida | BLOCKING | **Aceptado.** §5 fija el procedimiento: SHA aprobado del gate + worktrees desechables + ambos SHAs al ledger. **Rechazado** medir a mano, como Codex recomienda. **Matiz del PM:** ambas salidas requieren un SHA *aprobado*, y P0 sigue en `FAIL 2/2` — la dependencia baja de "mergeado" a "aprobado", no desaparece |
| **S1** §5 contiene dos verificaciones falsas | SHOULD-FIX | **Aceptado.** Corregidas ambas en §5: la portada **sí** es recuperable, y "roto en iOS" pasa a "sin fallback para iOS < 18.4", que es lo que E1-spike debe medir |
| **S2** clasificación de los spikes | SHOULD-FIX | **Aceptado.** E2 → unidad de código. E1-spike se acota a compatibilidad real con matriz de dispositivos y `MediaRecorder` construido de verdad. E4-spike → prototipo desplegado |
| **S3** criterios vagos o autoevaluados | SHOULD-FIX | **Aceptado.** Endurecidos: matriz por dispositivo (E1s.1–E1s.3); paginación con tamaño, orden y solapes (E3.10); e2e anónimo y draft inaccesible (E3.12); HTTP 404 real (E3.13); WhatsApp con matriz y URL esperada (E5.2); Facebook e Instagram declarados por separado (E5.3, E5.4) |
| **S4** las decisiones congeladas describen el plan retirado | SHOULD-FIX | **Aceptado.** D1, D4, D6, D7, D8 y D11 al bloque de distribución. D5 partida. D10 rejustificada como piso de calidad de escucha. D17 a guardrail de backlog. D18b endurecida |
| **N1** referencias de estado obsoletas | NIT | **Aceptado.** Corregidas las "unidad B"; y E3/E4-spike **dejan de presentarse como herederas** de la aprobación de A7/A10a |

**Sobre la causa raíz.** Las rondas 1–5 fallaron por especificar implementación sin trazar las
firmas reales del código. La r7 falló por lo contrario: **spikes sin implementación detrás y
criterios sin contrato**. Son la misma enfermedad en dos direcciones — plan escrito sin
comprobar qué entrega. Por eso la r8 traza cada afirmación a `fichero:línea` y cada spike lleva
su implementación con el marco que su bloque no puede contradecir.

---

## 15. Trazabilidad de la review de Codex r8 (FAIL)

**Veredicto:** FAIL — 6 BLOCKING, 4 SHOULD-FIX, 1 NIT. **Aceptados los once**, incluido el NIT
sobre una línea que yo había citado mal. Sexta review, sexto acierto en todo lo comprobable.

**Verificación independiente antes de aceptar:**

| Afirmación de Codex | Comprobación del PM | Resultado |
|---|---|---|
| `SermonCard` no recibe slug | Recibe `spotifyLink`; `SermonProps` no tiene slug ni id | confirmado |
| La consulta no lo selecciona | `useSermonData.ts` → `.select("title, speaker, description, episode_date, cover_url, audio_url")` | confirmado |
| El CTA "Ver todas las reflexiones" también abre Spotify | `Sermones.tsx` → `<a href={spotifyLink}>` | confirmado — **mi scope de E6 no lo cubría** |
| `vercel.json` impide un 404 real | Un solo rewrite `/(.*)` → `/index.html` | confirmado |
| "Roto en iOS" seguía vivo fuera de §5 | Líneas 63 y 1313 | confirmado |
| `base64ToSpotifyCover` empieza en la 17, no en la 57 | La 57 es `loadImage` | confirmado — **cita mía errónea** |
| El flujo crea el draft y publica con `UPDATE` | `publishEpisode` en `publishService.ts:119`; `isUniqueViolation` sólo mira `23505` (`:112-117`) | confirmado |

| Finding | Clase | Resolución en la r9 |
|---|---|---|
| **B1** E1-impl y E4-impl son fases vacías disfrazadas | BLOCKING | **Aceptado, y con él la conclusión estructural.** Dejan de ser unidades: pasan a la **ola 3, sin planificar**. El plan declara explícitamente que este bloque **no entrega las cuatro condiciones del Goal** |
| **B2** E3 enumera las decisiones del slug, no las toma | BLOCKING | **Aceptado.** El contrato se congela en E3a: normalización, longitud, fallback, colisión, momento de asignación, distinción de índice por nombre, host canónico (D19) y entorno Postgres |
| **B3** dependencia circular y unidad demasiado grande | BLOCKING | **Aceptado.** E3 → `E3a` + `E3b`; el HTTP 404 sale a la ola 3 (E4s.7 lo resuelve, E4-impl lo implementa). E3b.6 declara que HTTP sigue siendo 200 hasta entonces, en vez de fingirlo |
| **B4** D18 sigue dependiendo de P0 | BLOCKING | **Aceptado.** `E0-gates` incorpora un candidato del script, sus self-tests y su contrato fail-closed, y **se revisa dentro de AUDIO**. El SHA aprobado de E0 es el SHA del gate |
| **B5** E2 conserva una decisión de producto bloqueante | BLOCKING | **Aceptado.** Brent la resuelve: sin portada guardada, ruta Gemini con aviso. E2 queda congelada |
| **B6** E6 no puede satisfacer E6.5 con su scope | BLOCKING | **Aceptado.** E6 sale a la ola 3, y §5.1 guarda el alcance corregido —hook, consulta, `Sermones.tsx`, fallback sin slug, host canónico— para cuando se planifique. E6.1 se redactará como *verificar* el slug, no producirlo |
| **S1** la falsa afirmación sobre iOS sigue viva | SHOULD-FIX | **Aceptado.** Corregida en §0 (línea 63) y en la nota de captura. Estaba arreglada sólo en §5 |
| **S2** criterios que siguen delegando decisiones | SHOULD-FIX | **Aceptado.** E3b.2 fija **12 por página, `published_at DESC` con desempate por `id`**; E1-spike declara su precondición de dispositivos; E5 sale a la ola 3, donde se redactará con la matriz de evidencia |
| **S3** residuos en decisiones y backlog | SHOULD-FIX | **Aceptado.** D5 retirada; D17 trasladada físicamente al backlog; el backlog deja de reclamar el slug; el backlog de SEO remite a E4-impl; **D19 nueva** para el origen canónico |
| **S4** sizing no defendible | SHOULD-FIX | **Aceptado.** La partición E3a/E3b resuelve el tamaño; E1-impl y E4-impl dejan de dimensionarse porque dejan de ser unidades; ambos spikes declaran precondiciones |
| **N1** referencia de línea incorrecta | NIT | **Aceptado.** `coverImageUtils.ts:17` |

**Sobre la causa raíz, tercera lectura.** Las rondas 1–5 fallaron por especificar sin trazar el
código. La r7 falló por spikes sin implementación. La r8 falló por **escribir implementaciones
que ningún spike había acotado todavía**. Las tres son la misma cosa: escribir plan por delante
del conocimiento. La r9 no lo arregla escribiendo mejor — lo arregla **escribiendo menos y
ejecutando antes**.


---

## 16. Trazabilidad de la review de Codex r9 (FAIL)

**Veredicto:** FAIL — 5 BLOCKING, 4 SHOULD-FIX, 1 NIT. **Aceptados los diez.** Séptima review,
séptimo acierto en todo lo comprobable.

**Verificación independiente — y esta vez la review medía cosas que yo había afirmado sin medir:**

| Afirmación de Codex | Comprobación del PM | Resultado |
|---|---|---|
| No hay Postgres local para este proyecto | `supabase status` → `No such container: supabase_db_mulsqxfhxxdsadxsljss` | **confirmado** |
| El 54322 lo ocupa otro proyecto | `lsof` + `docker ps` → `supabase_db_sxlogxqzmarhqsblxmtj` y 9 contenedores más | **confirmado** |
| `.env.test` no existe y los e2e caen a producción | `playwright.config.ts` la carga sólo `if (existsSync)`; `client.ts:5` tiene URL y anon key productivas hardcodeadas | **confirmado** |
| Son 61 migraciones, no ~100 | `ls supabase/migrations/*.sql \| wc -l` → **61** | **confirmado** |
| La rama del gate es mutable | La punta se movió `09a69d7` → `912c15d` → `5b947ac` durante esta sesión | **confirmado** |

| Finding | Clase | Resolución en la r10 |
|---|---|---|
| **B1** E0-gates no fija el candidato | BLOCKING | **Superado por los hechos.** P0 pasó y se mergeó: el gate está en `main` con el blob aprobado. **E0-gates se retira entera** |
| **B2** el contrato del slug sigue incompleto | BLOCKING | **Aceptado.** E3a **deja de congelarse** y baja a borrador; los siete huecos (80+sufijo, truncado sin guion, "5 intentos", título al reintentar, interacción de colisiones, campo de `PostgrestError`, forma real del error vía PostgREST) quedan listados en el banner de borradores para cerrarse tras `E-infra` |
| **B3** E3a.1 describe un entorno que no está disponible | BLOCKING | **Aceptado, y es mi error, no una imprecisión.** §5 lleva la corrección y el registro de mis tres verificaciones falsas. `E-infra` existe por esto, y su primer criterio **es una medición** |
| **B4** E3b no especifica dónde corren sus e2e | BLOCKING | **Aceptado.** E3b baja a borrador. `E-infra.2` congela la guarda anti-producción, probada con una mutación que intente apuntar a `mulsqxfhxxdsadxsljss` y deba abortar |
| **B5** el offset no garantiza ausencia de solapes | BLOCKING | **Aceptado.** Queda en el banner de borradores: elegir cursor/keyset sobre `(published_at DESC, id ASC)` **o** declarar el límite. La r9 afirmaba una propiedad más fuerte que su implementación |
| **S1** E2 delega cómo presentar el aviso | SHOULD-FIX | **Aceptado.** E2 congela el toast con el `useToast` existente, lo mete en el scope y lo prueba (E2.4). Y añade el camino corto de E2.2, que Codex señaló |
| **S2** E0.7 necesita ejecución real | SHOULD-FIX | **Moot.** E0-gates se retira; el gate llegó revisado y mergeado |
| **S3** la corrección sobre iOS quedó parcial | SHOULD-FIX | **Aceptado.** El backlog pasa de "arreglar el grabador roto en iOS" a "medir y añadir fallback", remitiendo a E1-spike |
| **S4** bloques activos que contradicen el estado | SHOULD-FIX | **Aceptado.** La etiqueta "CONGELADA" desaparece del índice (§5 dice "candidata a congelar"); §7 se reescribe con los riesgos vigentes |
| **N1** "~100 migraciones" | NIT | **Aceptado.** 61 |

**Sobre la causa raíz, cuarta lectura.** Las tres anteriores eran sobre el plan. Ésta es sobre
mí: **escribo "verificado" sobre inferencias**. Ha pasado tres veces y las tres las encontró
Codex ejecutando el comando que yo no ejecuté. La r10 no lo arregla prometiendo cuidado — lo
arregla haciendo que **toda afirmación de estado lleve al lado el comando que la produjo**, y
registrando las tres en §5 para que quien lea el plan calibre.


---

## 17. Trazabilidad de la review de Codex r10 (FAIL)

**Veredicto:** FAIL — 1 BLOCKING, 3 SHOULD-FIX, 2 NIT, con la frase clave *"congelaría el alcance
y comportamiento de E2, pero todavía no su contrato de ejecución"*. **Aceptados los seis.**
La review más estrecha de las siete: el plan por fin discute una unidad, no su propia estructura.

**Verificación independiente:**

```
$ grep -c "liturgia_elementos" src/integrations/supabase/types.ts   → 0
$ bash scripts/gates/changed-files-diagnostics.sh src/hooks/useQuickPublish.ts
  --- tsc (2)
  src/hooks/useQuickPublish.ts(195,15): error TS2769  ← .from('liturgias')
  src/hooks/useQuickPublish.ts(200,20): error TS2352  ← el cast a QuickLiturgy[]
  [gates] totales del proyecto: tsc=1039 eslint=160 deno-lint=94 deno-check=46
$ bash scripts/gates/changed-files-diagnostics.sh src/lib/liturgia/liturgyService.ts
  --- tsc (38)
```

Confirmado en todo: `types.ts` cubre ~16 tablas de 128; `liturgyService.ts` se come 38
diagnósticos consultando esas mismas tablas sin tipos; y el total real es ~~**1039**, no 1041~~.

> **[r12 — corrección]** La última afirmación era **falsa**: esa medición salió del checkout
> puesto en la rama de P1 de UPGRADE, no de `main`. **Son 1041 en `main @ 05dc4ca`.** Ver §5,
> cuarta entrada, y §18.

| Finding | Clase | Resolución en la r11 |
|---|---|---|
| **B1** la implementación natural de E2 no pasa el gate tipado | BLOCKING | **Aceptado, y la decisión la toma el plan, no el ejecutor.** Adaptador tipado estrecho: cliente ensanchado en un solo sitio, forma de fila declarada, y **validación en runtime como guardrail del cast**. Se descartan explícitamente regenerar `types.ts` (blast radius de 128 tablas — va al backlog), reutilizar `loadLiturgy()` (carga la liturgia entera para una imagen) y el cast suelto. Nuevo criterio **E2.7**: el adaptador termina en cero diagnósticos |
| **S1** §4 contradice el estado del gate | SHOULD-FIX | **Aceptado.** §4 reescrita: el gate se ejecuta desde `main`, sin SHA que fijar ni worktrees, con la salida de `git ls-tree` como evidencia. Y la base pasa a **`tsc=1039`**, medida — el 1041 venía de la r1 |
| **S2** E2.6 no está cubierto por el test plan | SHOULD-FIX | **Aceptado.** E2.6 enumera sus cuatro fallos (error de consulta, `slides` con forma inesperada, `imageUrl` inválido, fallo de conversión), cada uno con su test, y **esos cuatro casos definen "portada válida"** |
| **S3** E-infra sólo es honesta mientras no se congele | SHOULD-FIX | **Aceptado.** Queda escrito en su cuerpo que al retomarse se parte en `E-infra-spike` + implementación redactada después de medir |
| **N1** "sin base de datos" es impreciso | NIT | **Aceptado.** Pasa a "sin cambios de esquema ni pruebas locales de DB": E2 **sí** lee una tabla real y depende de su RLS |
| **N2** "nadie se queda sin publicar" promete de más | NIT | **Aceptado.** Acotado a "la ausencia de portada guardada no bloquea por sí sola el flujo" |

**Sobre la respuesta 6 de Codex.** Tiene razón en que mi promesa de la r10 —"toda afirmación de
estado lleva al lado el comando que la produjo"— no se cumplía literalmente, y en que §4 no
carecía de comando sino que era **directamente falsa**. La distinción que propone queda adoptada:
para hechos estáticos del código, `fichero:línea` basta; **para estado del entorno, hacen falta
comando y salida**. §4 y §17 los llevan.


---

## 18. Trazabilidad de la review de Codex r11 (FAIL)

**Veredicto:** FAIL — 1 BLOCKING, 3 SHOULD-FIX, 3 NIT. **Aceptados los siete.** Es la review más
valiosa de las ocho, porque Codex **no argumentó: construyó**. Levantó un prototipo fiel del
adaptador congelado en la r11 y le pasó el gate real:

```
$ bash scripts/gates/changed-files-diagnostics.sh src/lib/sermon-editor/liturgyCoverProto.ts …
=== src/lib/sermon-editor/liturgyCoverProto.ts
--- tsc (0)   --- eslint (0)   --- deno lint (0)   --- deno check (0)
```

**La estrategia de tipado de E2 queda validada con evidencia ejecutada, no con un argumento.**

**Mi verificación de su BLOCKING**, que era sobre una medición mía:

```
$ git rev-parse --abbrev-ref HEAD                → feat/mesa-md-schema   ← SHA NO ANOTADO
$ bash scripts/gates/…  src/hooks/useQuickPublish.ts
  [gates] totales del proyecto: tsc=1039 …       ← lo que medí en la r11

$ git worktree add --detach ../wt-measure main   # main @ 05dc4ca, árbol limpio
$ bash scripts/gates/…  src/hooks/useQuickPublish.ts
  [gates] totales del proyecto: tsc=1041 …       ← lo correcto
```

Codex tiene razón: **son 1041**. Mi `1039` salió de la rama de P1 de UPGRADE, que arregla dos
diagnósticos. No fue un árbol sucio — fue **el árbol equivocado**.

**Y no anoté su SHA**, que es justo el defecto que la regla nueva corrige: puedo decir la rama,
no el árbol. Codex reproduce el 1039 en **`ac9ef14`** y el 1041 en **`main @ 05dc4ca`**, ambos en
árbol limpio. **Mecanismo del delta, identificado por Codex r12:** `d9eebb0` añade
`host_food_assignment` a `mesa_abierta_matches` en `types.ts`, lo que apaga exactamente dos
diagnósticos de `MesaAbiertaAdmin.tsx` — `(376,39)` TS2339 y `(882,19)` TS2353. Dos, y ninguno
más. La saga del 1039/1041 fueron **cuatro mediciones verdaderas** que se contradecían porque dos
de ellas —una de Codex y una mía— no sabían sobre qué árbol estaban paradas.

| Finding | Clase | Resolución en la r12 |
|---|---|---|
| **B1** la base "medida" de §4 es irreproducible | BLOCKING | **Aceptado.** §4, §17 y el ledger corregidos a **1041**, con el comando, la salida **y el SHA** del árbol limpio. §4 fija además que los totales se toman en el SHA padre, no en el checkout del PM. Registrado en §5 como mi **cuarta** verificación falsa |
| **S1** §4 es correcta pero no única | SHOULD-FIX | **Aceptado.** (a) §10 seguía describiendo la r9 — reescrita. (b) Los residuos de los borradores (`E0-gates` en E3a.11/E3b.8, la línea huérfana "ni siquiera de E0-gates", y la fila que reafirmaba la verificación falsa del Postgres) quedan marcados **OBSOLETO, no aplicar** en el banner |
| **S2** E2.1 congela algo que la RLS puede falsear | SHOULD-FIX | **Aceptado.** E2.1 pasa a "portada guardada **y legible por quien publica**"; la asimetría `liturgias` / `liturgia_elementos` queda documentada con sus líneas de migración; ampliar la lectura se declara cambio de esquema y va al backlog |
| **S3** §4 omite la regla de clasificación del README | SHOULD-FIX | **Aceptado.** §4.3 cita "desplazamiento de línea aceptable / diagnóstico nuevo bloqueante" y explica por qué E2 la necesita con certeza; §4.3b añade el patrón worktree+symlink |
| **N1** la estrategia debería decir "sin `any`" | NIT | **Aceptado.** Cláusula añadida, con la medición de Codex que la respalda |
| **N2** "(data URL)" es impreciso | NIT | **Aceptado.** "data URL **o base64 crudo**", con los 30 registros reales que Codex midió — y que **confirman empíricamente** los cuatro casos de E2.6 |
| **N3** referencias colgantes y restos sin comando | NIT | **Aceptado.** El "§5.1" inexistente se sustituye por el puntero real (§15/B6); el blob del gate lleva su `git rev-parse`. Las tablas históricas de §0 quedan como históricas, anteriores a la regla |

**Sobre la causa raíz, quinta lectura.** Las cuatro anteriores eran variantes de *afirmar sin
medir*. Ésta es *medir mal*: puse el comando, como exige la regla que yo mismo adopté en la ronda
anterior, y lo ejecuté sobre otro árbol. La regla no falló por floja sino por incompleta, y la
corrección es de una palabra: **el árbol también es parte de la evidencia.**


---

## 19. Trazabilidad de la review de Codex r12 (PASS — E2 congelada)

**Veredicto:** **PASS** — 0 BLOCKING, 1 SHOULD-FIX, 4 NIT, sobre el commit `3084208`.
**E2 queda congelada.** Novena review; la primera que pasa.

**Lo que Codex confirmó reproduciendo:**

| Medición | Árbol | Resultado |
|---|---|---|
| §4 (línea base) | `main @ 05dc4ca`, worktree limpio | `tsc=1041` ✓ |
| §18 (el 1039 de la r11) | `ac9ef14`, limpio | `tsc=1039` ✓ |
| Estrategia de tipado (r11) | prototipo del adaptador + gate real | `0/0/0/0` ✓ |

**Y una corrección propia de Codex**, que conviene dejar escrita: su r11 afirmó haber medido
1041 "en `feat/mesa-md-schema`". Era falso — el reflog muestra que entre las 15:39 y las 15:52
este checkout compartido estuvo en `main`, y sus dos mediciones cayeron dentro de esa ventana.
**Midió `main` y lo llamó rama: exactamente mi cuarto defecto, en el otro lado de la mesa.**
De ahí que la r13 endurezca la regla a SHA siempre, para los dos.

| Finding | Clase | Resolución en la r13 |
|---|---|---|
| **S1** unificar la regla de evidencia a SHA-siempre | SHOULD-FIX | **Aceptado.** §4 y §5 exigen ahora **SHA exacto, nunca nombre de rama**, citando la carrera de checkouts del 2026-08-07 como razón |
| **N1** tres `1039` residuales en texto vigente | NIT | **Aceptado.** Corregidos los tres a **1041**, con `main @ 05dc4ca` al lado. Los `1039` que quedan son todos históricos o correctivos |
| **N2** la fila de backlog prometida no existía | NIT | **Aceptado.** Añadida: ampliar la lectura de `liturgia_elementos` a los admins, declarada cambio de policies |
| **N3** errata en §17 | NIT | **Aceptado.** La frase "el total real es 1039, no 1041" queda tachada y con su bloque de corrección, siguiendo el patrón que §0 usó para iOS |
| **N4** completar §18 con SHAs y avisar del churn | NIT | **Aceptado.** §18 lleva los SHAs y dice explícitamente que **no anoté el mío**; el ítem de `types.ts` en el backlog lleva el aviso de los ~208 falsos deltas |

**Cierre de la saga 1039/1041.** Fueron cuatro mediciones verdaderas que se contradecían porque
dos de ellas —una de Codex, una mía— no sabían sobre qué árbol estaban paradas. El mecanismo:
`d9eebb0` añade `host_food_assignment` a `mesa_abierta_matches` en `types.ts`, apagando
`MesaAbiertaAdmin.tsx(376,39)` TS2339 y `(882,19)` TS2353. Dos diagnósticos, ninguno más.
La regla que queda escrita —**comando, salida, SHA**— es lo que impide que vuelva a pasar.
