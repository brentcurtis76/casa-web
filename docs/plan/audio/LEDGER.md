# LEDGER — AUDIO

### 2026-08-06 — plan round 1 — PM (Fable)
- SESSION: `AUDIO · plan · PM`
- ACTION: redacción de `PLAN.md` r1 (18 fases) contra el documento de entrada de Brent, más
  verificación del código. A16/A17 (captura desde la mesa) añadidas a petición de Brent.
- COMMITS: —  (plan sin commitear al cierre de la ronda)
- TESTS: n/a — ronda de planificación, sin código.
- FINDINGS RAISED: n/a
- DECISIONS: D1–D16 congeladas provisionalmente.
- OPEN AFTER THIS ROUND: revisión adversarial de Codex.

### 2026-08-06 — plan round 2 — PM (Fable)
- SESSION: `AUDIO · plan · PM`
- ACTION: triage de `CODEX REVIEW — plan r1` (VERDICT **FAIL**, 13 findings: 9 BLOCKING,
  3 SHOULD-FIX, 1 NIT) y reescritura completa de `PLAN.md` a la revisión 2 (28 fases).
- VERIFICACIÓN INDEPENDIENTE ANTES DE ACEPTAR (no se tomó la review al pie de la letra):
  - Red: feed Supabase **200 `application/rss+xml`, 0 `<item>`**; portada `show/cover.jpg`
    **400**; apex `/podcast/feed.xml` **307 → www**; `www/podcast/feed.xml` **200 `text/html`**.
    → CR-1 y CR-2 confirmados. **La r1 afirmaba que este entorno no alcanzaba Supabase: era falso.**
  - Repo: `scripts/gates/changed-files-diagnostics.sh` existe y documenta 62 colisiones del
    enfoque global (CR-9 ✅); ESLint base **160**, no 159 (✅); `wavesurfer` ya usado en
    `useSermonEditor.ts:5-6` (✅); `index.html` con 12 líneas de OG/Twitter/JSON-LD (✅);
    `grep bitrate spotifyValidator.ts` → **0 coincidencias** (CR-5 ✅); sin ruta pública de
    liturgia (CR-7 ✅).
  - Externo: se verificó la fuente citada en CR-12 sobre video de Spotify.
- FINDINGS RAISED: ninguno propio; se resolvieron los 13 de Codex (§9 del plan).
- DECISIONS:
  - D4 corregida a `www` (medido).
  - D18 nueva: gates vía `scripts/gates/`, SHA padre fijado, build verde absoluto,
    honestidad de tests base-red/mutación.
  - D17 nueva: sin outbox con unicidad en DB no hay avisos automáticos.
  - D16 con alcance limitado; A20a decide si sobrevive.
  - **Desacuerdo parcial registrado en CR-12/D7:** el video para shows externos existe sólo
    vía Distribution API desde hosts soportados (que no somos); la fuente citada **no**
    establece reversibilidad. Se conserva la decisión y se corrige su razón.
- SPLITS: A0→A0/A5/A6 · A5+A6→A7 (fusión) · búsqueda→A8 · A8→A10a/b/c ·
  A9→A11a/b/c/d · A16→A19a/b · A17→A20a/b/c · A16 (audiencia/outbox) nueva.
- BACKLOG ADDED: ruta pública de liturgia + RLS anon; limpieza de objetos huérfanos tras
  claves versionadas; UI de gestión de suscriptores; arreglar `/recorder` en iOS;
  búsqueda full-text sobre descripción.
- OPEN AFTER THIS ROUND: Codex r2 (ronda 1 de 2 del cap de plan-review, SOP §1.5).
  A20c queda declarada sin criterios de test especificables hasta que A20a decida — marcada
  como tal a propósito, no rellenada con criterios inventados.

### 2026-08-06 — plan round 3 — PM (Fable)
- SESSION: `AUDIO · plan · PM`
- ACTION: enmienda de alcance previa a Codex r2. Brent confirma que hoy la distribución propia
  es **pegar enlaces en redes sociales**, sin lista de correo ni difusión por WhatsApp, y que
  crecer es meta futura.
- DECISIONS:
  - **A16 (audiencia/consentimiento/outbox), A17 (WhatsApp) y A18 (boletín) se RETIRAN** del
    plan al backlog. Construir consentimiento + outbox para una audiencia inexistente es
    infraestructura especulativa. Los IDs no se reciclan, para que las referencias de la
    review de Codex r1 sigan resolviendo.
  - **D17 queda vigente** aunque ninguna fase lo implemente: es la restricción que aplicará
    quien retome esas fases, y está escrita para que no reinventen `announced_at`.
  - **D18b nueva:** la previsualización del enlace ES la distribución. A10 (SEO/OG) sube de
    prioridad y deja de tratarse como accesoria; no se descarta por presupuesto.
  - Secuencia actualizada: A10a/b/c pasa a ir inmediatamente después de A7.
- EFECTO: 28 → **25 fases**. CR-11 pasa de "aceptado" a "aceptado y superado".
- TESTS: n/a — ronda de planificación.
- OPEN AFTER THIS ROUND: Codex r2 sobre la revisión 3. Plan **sin commitear** por instrucción
  explícita de Brent hasta que esté listo.

### 2026-08-06 — plan round 4 — PM (Fable)
- SESSION: `AUDIO · plan · PM`
- ACTION: triage de `CODEX REVIEW — plan r3` (VERDICT **FAIL**: 6 BLOCKING, 4 SHOULD-FIX,
  2 NIT) y enmienda a la revisión 4.
- CAP: el cap de plan-review (2 rondas, SOP §1.5) quedó **consumido** con r2. Se escaló a
  Brent con las tres opciones; **Brent autorizó explícitamente una ronda 3**. No es una
  vuelta más por inercia del PM.
- VERIFICACIÓN INDEPENDIENTE ANTES DE ACEPTAR:
  - `HEAD` al feed → **405**; el `GET` 200 **no emite `Content-Length`** → B1 confirmado.
  - `podcast-backfill:203` asigna `suggestedEpisodeNumber: idx + 1` → B3 confirmado.
  - `quickProcessor.ts:161` pasa `bitrate: 128` explícito → S1 confirmado.
  - Bucket admite más MIME que `audio/mpeg` → N1 confirmado.
  - Tercera ronda consecutiva en que Codex acierta en todo lo comprobable.
- CAMBIOS: B1 (soporte HEAD en A1 + GET real en A3.6/A6.1 + retiro de Content-Length) ·
  B2 (guid inmutable desde INSERT, slug NULL→valor, prueba del hueco de unpublish) ·
  B3 (renumeración del canario a N+1 antes del backfill, con integración) ·
  B4 (techo aplicado antes de materializar + ruta congelada para no-MP3) ·
  B5 (importar podcast:guid preexistente; **A14 se mueve antes de A12/A13**) ·
  B6 (**A20b/A20c retiradas**; A20a debe entregar un bloque de plan revisable) ·
  S1–S4, N1–N2.
- EFECTO: 25 → **24 fases**. §11 nueva con la trazabilidad de r2.
- DECISIONS: D3 con condición operativa de tres partes; A10b/A10c se aceptan juntas.
- TESTS: n/a — ronda de planificación.
- OPEN AFTER THIS ROUND: Codex r3. Plan **sin commitear** por instrucción de Brent.

### 2026-08-06 — plan round 5 — PM (Fable)
- SESSION: `AUDIO · plan · PM`
- ACTION: triage de `CODEX REVIEW — plan r4` (VERDICT **FAIL**: 4 BLOCKING, 2 SHOULD-FIX) y
  enmienda a la revisión 5.
- INSTRUCCIÓN DE BRENT (cambio de estrategia): el objetivo es un plan **consensuado**, no uno
  completo. Simplificar, sacar fases o recortar alcance son salidas válidas; seguir puliendo
  la misma fase ronda tras ronda, no.
- VERIFICACIÓN INDEPENDIENTE:
  - `PublishArgs` **no acepta `guid`** (`publishService.ts:72`); el insert no lo setea (`:162`).
    → B1 confirmado. **Fue un error mío**: escribí "cero código nuevo" sobre una ruta que
    necesita un parámetro inexistente.
  - `podcast_episodes_admin_all` es `FOR ALL`, incluye `DELETE` → B4 confirmado.
  - `podcast-backfill:203` ordena por RSS, no por fecha → B3 confirmado.
  - Cuarta ronda consecutiva en que Codex acierta en todo lo comprobable.
- DIAGNÓSTICO DE CAUSA RAÍZ: los cuatro bloqueos comparten un modo de fallo — especificar
  implementación sin trazar las firmas reales del código. No es mala suerte; es un patrón.
- CAMBIOS: **A11a/A11b/A11c/A11d retiradas** y sustituidas por **A11-spike** (mismo remedio que
  Codex aplicó a A20b/A20c y que funcionó) · A4.5c/A4.5d cierran el rodeo `DELETE + INSERT` ·
  D5 reescrita a "inmutable desde el INSERT" · S1 normaliza las dependencias de A0 ·
  S2 corrige el DoD de A20a.
- EFECTO: 24 → **19 fases**. §12 nueva con la trazabilidad de r3.
- TESTS: n/a — ronda de planificación.
- OPEN AFTER THIS ROUND: pasada de consenso de Codex sobre 19 fases. Regla acordada con Brent:
  lo que Codex señale se **recorta o se convierte en spike**, no se pule. Plan sin commitear.

### 2026-08-06 — plan round 6 — PM (Fable)
- SESSION: `AUDIO · plan · PM`
- ACTION: aplicación del consenso de `CODEX REVIEW — plan r5` (**PARTIAL PASS**: 6 fases
  congelables, recorte recomendado a 12 unidades). **Aceptados todos los recortes.**
- CONGELADAS (ejecutables ya): A1, A3, A6, A7, A10a, A11-spike.
- RECORTADAS: A0-core (sin egress/ocupación) · A2-core (sin bitrate/mono) · A4-core (con
  límite declarado) · A5-core (sin A5.8) · A14-core (sin locked/funding).
- SACADAS al backlog: A8, A9, A10b, A10c, A15.
- FUSIONADAS: A12 + A13 → **A-cutover-spike**.
- TRASLADADAS a un workstream propio (`docs/plan/captura/`): A19a, A19b, A20a, con D15 y D16.
  **No se descartan** — Brent pidió esa capacidad explícitamente; no sirve al Goal de AUDIO.
- ERROR PROPIO detectado por Codex: el índice enumeraba 21 unidades y sólo existían 19 cuerpos.
  Al reemplazar el bloque de backfill borré sin querer los cuerpos de A12 y A13, que estaban
  físicamente entre A11d y A14. Reparado al fusionarlas en el spike de cutover.
- DECISIONS: **D3 degradada** de decisión congelada a nota de backlog (sin medición no puede
  dispararse) · **D5 reescrita** al alcance que realmente garantiza (PASS para inmutabilidad
  de fila, FAIL para irreemplazabilidad de identidad) · **D15/D16 trasladadas** a `captura`.
- EFECTO: 19 → **12 unidades**. Pico histórico: 28.
- TESTS: n/a — ronda de planificación.
- OPEN AFTER THIS ROUND: pasada de confirmación sobre las seis recortadas. Las seis congeladas
  pueden ejecutarse desde ya. Plan sin commitear.
