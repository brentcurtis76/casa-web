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

### 2026-08-07 — A0-core round 1 — PM (Fable) + EXEC (Opus)
- SESSION: `AUDIO · A0-core · PM` / `AUDIO · A0-core · r1 · EXEC`
- CONTEXT PRESSURE: comfortable (ejecutor) — paró en descubrimiento, antes de tocar código.
- ACTION: primer `/pm-boot` de ejecución del plan. El PM eligió **A0-core** y escribió el prompt
  de ejecutor; el ejecutor devolvió **`STATUS: BLOCKED`** sin escribir nada.
- COMMITS: ninguno (el prompt nunca llegó a commitearse — ver ERROR DEL PM).
- TESTS: n/a — ninguna ronda produjo código.
- **ERROR DEL PM, corregido por el ejecutor:** A0-core **no podía arrancar**. §10 dice, literal,
  que las seis unidades recortadas *"necesitan confirmación... Ninguna fase empieza hasta que
  pase"*, y A0-core es una de ellas. El PM razonó que una fase de evidencia con un recorte que
  sólo quitaba criterios no arriesgaba retrabajo — razonamiento propio por encima de una regla
  congelada, que es exactamente lo que el ciclo existe para impedir. El escape hatch del SOP
  §1.6 funcionó.
- **COLISIÓN DE CHECKOUT:** a mitad de ronda, otra sesión (UPGRADE P0 r4) cambió el checkout
  compartido de `docs/plan-audio` a `feat/mesa-md-gates`. El prompt escrito quedó en la rama
  equivocada; el PM lo retiró para no ensuciar el árbol ajeno y no pudo escribir PLAN ni LEDGER
  durante el resto de la ronda. **Resuelto en la ronda siguiente con un worktree dedicado**
  (`/Users/brentcurtis/dev/wt-audio`).
- FINDINGS RAISED:
  - **[B1] BLOCKING** — A0-core no puede arrancar (§10). Elección de fase retirada.
  - **[B2] BLOCKING** — §10 afirma "se puede empezar hoy" y el grafo de dependencias lo
    desmiente: **ninguna de las 12 unidades era arrancable**. Cinco de las seis congeladas
    dependían de una recortada; A1 dependía de A0.7, y A0.7 resultó no existir.
  - **[S1] SHOULD-FIX** — D18 congela `scripts/gates/changed-files-diagnostics.sh`, que no
    existe en `main`. Verificado por rama: sólo en `feat/mesa-md-gates` (UPGRADE P0, `FAIL 2/2`).
  - **[N1] NIT** — el ejecutor advirtió que `docs/plan/audio/` sólo vivía en una rama local sin
    remoto. **Falso**, verificado: `origin/docs/plan-audio` existe y lleva el plan.
- DECISIONS: ninguna; se escaló a Brent.
- OPEN AFTER THIS ROUND: decisión de Brent sobre B2.

### 2026-08-07 — plan round 7 — PM (Fable)
- SESSION: `AUDIO · A0-core · PM`
- ACTION: **re-alcance completo del plan** por instrucción de Brent, tras el diagnóstico de que
  ninguna unidad era arrancable. El Goal pasa de distribución en directorios al **bucle interno
  de escucha**. 12 unidades `A*` → **5 unidades `E*`**.
- VERIFICACIÓN INDEPENDIENTE ANTES DE PROPONER (el modo de fallo de cuatro FAIL seguidos fue
  especificar sin trazar el código; esta vez se trazó primero):
  - `QuickPublishContainer.tsx` — **el flujo de publicación rápida ya existe** completo:
    `Audio → Liturgia → Revisar → Publicar`, con `useQuickPublish.ts` de máquina de estados.
  - `church_podcast_episodes.liturgy_id UUID REFERENCES liturgias(id)` — **el vínculo con la
    liturgia ya existe en el esquema**, y `QuickStepLiturgy.tsx` ya lo deja elegir.
  - `Portadas.tsx` — **ya genera una portada de REFLECTION** por recomposición imagen-a-imagen
    de la principal, con título de la liturgia y nombre del predicador. Es literalmente "una
    versión de la portada de la liturgia", que es lo que Brent pidió.
  - `useQuickPublish.ts:376` — la carátula del episodio se genera hoy como **ilustración nueva
    con Gemini** (`buildSermonCoverPrompt`); la portada de reflexión no se reutiliza.
  - `src/appRoutes.tsx` — **no existe ruta `/reflexiones`**.
  - Migración de `church_podcast_episodes` — **no existe columna `slug`**.
  - `dig MX anglicanasanandres.cl` → **sin registros**. El dominio no puede recibir correo.
- FINDINGS RAISED: ninguno propio esta ronda; se resolvieron B1/B2 del round anterior por
  re-alcance en vez de por remediación.
- DECISIONS (todas en §8 del plan):
  - Re-alcance a bucle interno de escucha. **Raised by: Brent.**
  - La carátula **reutiliza el sistema de generación existente**. **Raised by: Brent.**
  - **D6 y el correo institucional salen del camino crítico** (sin directorios, `itunes:owner`
    no verifica nada). Siguen vigentes para cuando vuelva la distribución.
  - **E3 acepta slug mutable**: se retira el trigger de inmutabilidad del alcance. Degradación
    consciente frente a D5/D12, declarada como riesgo en E3 y reversible.
  - Se registra que **D18 no es satisfacible hoy**. Ablandarlo es decisión de Codex o Brent.
- SPLITS / MAPEO: A7 → **E3** · A10a → **E4-spike** (ambas conservan la aprobación de Codex r5).
  E1-spike, E2-spike y E5 son nuevas. Los IDs `A*` **no se reciclan** y sus cuerpos se conservan
  al final del plan porque §9/§11/§12/§13 los citan.
- BACKLOG ADDED: la **pista de distribución completa** como bloque — feed RSS (A1, A3, A6),
  portada de canal y canario (A5-core), claves content-addressed (A2-core), inmutabilidad por
  trigger (A4-core), backfill (A11-spike), `podcast:guid` (A14-core), directorios y corte de
  Spotify (A-cutover-spike), reconocimiento (A0-core). Con lo que haría falta para retomar cada
  una.
- TESTS: n/a — ronda de planificación.
- OPEN AFTER THIS ROUND: **review de Codex sobre la revisión 7.** Ninguna unidad B arranca antes.
  Pendiente también la decisión sobre D18 (esperar a UPGRADE P0, o ablandar el gate para E3/E5).

### 2026-08-07 — plan round 8 — PM (Fable)
- SESSION: `AUDIO · A0-core · PM`
- ACTION: triage de `CODEX REVIEW — plan r7` (VERDICT **FAIL**: 5 BLOCKING, 4 SHOULD-FIX, 1 NIT)
  y enmienda a la revisión 8. **Aceptados los diez findings; ningún desacuerdo.**
- VERIFICACIÓN INDEPENDIENTE ANTES DE ACEPTAR:
  - `publishService.ts:44-51` — `PublishResult` no devuelve slug ni URL canónica → B1 confirmado.
  - `publishService.ts:278-285` — el `while` reintenta **cualquier** `23505` con número nuevo;
    una colisión de slug reintentaría inútilmente → B3 confirmado.
  - `unpublishEpisode()` devuelve la fila a `draft` conservándola → la ruta de republicación
    existe, B2 confirmado.
  - `QuickPublishProgress.tsx:46,58` · `QuickStepReview.tsx:247` · `SermonCard.tsx:45` — toda la
    UI sigue apuntando a Spotify y al feed RSS → B1 (segunda mitad) confirmado.
  - `grep -c slug src/integrations/supabase/types.ts` → **0** → B3 confirmado.
  - `vercel.json` — un solo rewrite `/(.*)` → `/index.html` → B4 confirmado.
  - `ConstructorLiturgias.tsx:1064` + `liturgyService.ts` — **la portada de reflexión SÍ es
    recuperable por `liturgy_id`**, vía `liturgia_elementos` por `(liturgia_id, tipo)` → S1
    confirmado, y **la r7 afirmaba lo contrario**.
  - Quinta ronda consecutiva en que Codex acierta en todo lo comprobable.
- DIAGNÓSTICO DE CAUSA RAÍZ: las rondas 1–5 fallaron por especificar implementación sin trazar
  el código; la r7 falló por lo opuesto — **spikes sin implementación detrás y criterios sin
  contrato**. Misma enfermedad, dirección contraria: plan escrito sin comprobar qué entrega.
- DECISIÓN DE BRENT (dos preguntas, ambas respondidas antes de escribir):
  - **Alcance completo**, no recortado: se añaden las implementaciones en vez de sacar la
    grabación al backlog.
  - **El cierre del bucle entra en este bloque** (E6), en vez de dejarse para después.
- CAMBIOS: **E1-impl, E4-impl y E6 nuevas** · E5 pasa a depender de E4-impl, no de E4-spike ·
  **E2 deja de ser spike** y pasa a código (la portada es recuperable) · **E3 reescrita** con
  contrato completo de slug y D12 restaurada · **E4-spike recupera el prototipo desplegado** de
  A10a · **D18 se ejecuta desde un SHA aprobado del gate en worktrees desechables** ·
  D1/D4/D6/D7/D8/D11 al bloque de distribución · D5 partida · D10 rejustificada · D17 a
  guardrail · D18b endurecida · se retira la afirmación no medida "roto en iOS".
- EFECTO: 5 → **8 unidades**. §14 nueva con la trazabilidad de la r7.
- FINDINGS RAISED: uno propio, sobre la propia review — las dos salidas que Codex propone para
  D18 **requieren un SHA del gate ya aprobado**, y UPGRADE P0 sigue en `FAIL 2/2`. La
  dependencia baja de "P0 mergeado a `main`" a "P0 aprobado", pero no desaparece.
- TESTS: n/a — ronda de planificación.
- BACKLOG ADDED: trigger de inmutabilidad del GUID y prohibición de `DELETE` (la mitad de D5 que
  sale del alcance activo).
- OPEN AFTER THIS ROUND: **review de Codex sobre la revisión 8.** Ninguna unidad `E*` arranca
  antes. Pendiente además una decisión de producto de Brent que **bloquea E2**: qué hacer cuando
  la liturgia existe pero no tiene portada de reflexión guardada — bloquear, permitir subida
  manual, o generar con la ruta actual de Gemini.

### 2026-08-07 — plan round 9 — PM (Fable)
- SESSION: `AUDIO · A0-core · PM`
- ACTION: triage de `CODEX REVIEW — plan r8` (VERDICT **FAIL**: 6 BLOCKING, 4 SHOULD-FIX, 1 NIT)
  y **reestructuración del plan por olas**. Aceptados los once findings, sin desacuerdo.
- VERIFICACIÓN INDEPENDIENTE ANTES DE ACEPTAR:
  - `SermonCard` recibe `spotifyLink`, no slug; `useSermonData` selecciona seis columnas y
    **ninguna es `slug` ni `id`**; el CTA "Ver todas las reflexiones" de `Sermones.tsx` también es
    `<a href={spotifyLink}>` → **B6 confirmado, y mi scope de E6 era insuficiente**.
  - `vercel.json` — un solo rewrite `/(.*)` → `/index.html` → B3 confirmado.
  - "roto en iOS" seguía en las líneas 63 y 1313 → S1 confirmado; lo había arreglado sólo en §5.
  - `base64ToSpotifyCover` empieza en la **17**; la 57 es `loadImage` → **N1 confirmado, cita mía
    errónea**.
  - **No existe infraestructura de test contra Postgres en el repo** (`grep postgres://`,
    `pg.Client`, `new Pool`, `DATABASE_URL` en tests → 0 resultados). Pero **sí hay Postgres local
    disponible**: `supabase` CLI 2.110.0, Docker corriendo, `config.toml` con `project_id` y sin
    `[db]` (puerto por defecto 54322). Eso es lo que hace especificable a E3a.
  - Sexta review consecutiva en que Codex acierta en todo lo comprobable.
- DIAGNÓSTICO DE CAUSA RAÍZ (tercera lectura): r1–r5 fallaron por especificar sin trazar el
  código; la r7 por spikes sin implementación; la r8 por **escribir implementaciones que ningún
  spike había acotado**. Las tres son escribir plan por delante del conocimiento. **8 rondas,
  6 reviews, 0 líneas de código.**
- DECISIONES DE BRENT (ambas respondidas antes de escribir):
  - **Estructura por olas**: congelar sólo lo especificable y arrancar, en vez de enmendar otra
    vez el documento completo.
  - **E2 sin portada guardada → ruta Gemini con aviso.** Resuelve el BLOCKING B5.
- CAMBIOS: **`E0-gates` nueva** (el gate se revisa dentro de AUDIO, no espera a UPGRADE P0) ·
  **E3 partida en `E3a` + `E3b`**, con el HTTP 404 fuera y la circularidad eliminada ·
  **contrato del slug congelado en el plan** (8 decisiones que la r8 delegaba) · **E1-impl,
  E4-impl, E5 y E6 dejan de ser unidades** y pasan a la ola 3 sin planificar · §5.1 guarda el
  alcance corregido de E6 · **D19 nueva** (origen canónico) · D5 retirada · D17 al backlog ·
  residuos de "roto en iOS" y de backlog corregidos · precondiciones declaradas en ambos spikes.
- EFECTO: 8 unidades → **4 congelables + 2 spikes + una ola 3 sin planificar**. El plan declara
  explícitamente que **no entrega las cuatro condiciones del Goal**, que es lo que la r8 escondía.
- TESTS: n/a — ronda de planificación.
- BACKLOG ADDED: infraestructura de test automatizado contra Postgres (hoy no existe; E3a usa
  `supabase db reset` + SQL, que es verificación real pero no suite de regresión).
- OPEN AFTER THIS ROUND: **review de Codex sobre la ola 1 de la revisión 9.** Ninguna unidad
  arranca antes, salvo que Brent decida que E1-spike puede ir en paralelo: no toca código que se
  mergee, no depende de nada y no pasa por el gate.

### 2026-08-07 — plan round 10 — PM (Fable)
- SESSION: `AUDIO · A0-core · PM`
- ACTION: triage de `CODEX REVIEW — plan r9` (VERDICT **FAIL**: 5 BLOCKING, 4 SHOULD-FIX, 1 NIT).
  Aceptados los diez. **Ola 1 reducida a una sola unidad.**
- **ERROR PROPIO, el más serio de este plan.** La r9 afirmaba "Postgres local real disponible —
  verificado". **Era falso.** Lo deduje de que el CLI está instalado, Docker corre y existe
  `config.toml`, sin ejecutar `supabase status` ni una vez, y lo escribí como verificado también
  en el mensaje de commit. Medido ahora:
  - `supabase status` → `No such container: supabase_db_mulsqxfhxxdsadxsljss`.
  - Puerto 54322 **ocupado por otro proyecto Supabase** (`sxlogxqzmarhqsblxmtj`, 10 contenedores).
  - `.env.test` **no existe**; `playwright.config.ts` la carga sólo si existe; `client.ts:5` tiene
    URL y anon key de **producción** hardcodeadas como fallback.
  - **Consecuencia:** la E3b de la r9 habría mandado a un ejecutor a crear filas sintéticas
    `draft` y `published` **contra la base de producción compartida con Life OS**. No era un
    criterio flojo: era una instrucción peligrosa.
  - Son **61** migraciones, no "~100".
  - **Tercera verificación falsa mía** en este plan (r1: alcance a Supabase; r2: el script del
    gate; r9: el Postgres local). Las tres son inferencias colocadas dentro de secciones tituladas
    "medido". Queda registrado en §5 del plan a propósito.
- HECHO EXTERNO VERIFICADO: **UPGRADE P0 pasó Codex y ya está mergeado a `main`** (`5b947ac`;
  `main`, `feat/mesa-md-gates` y `origin/main` idénticos). El gate y su self-test están en `main`
  con el blob `51af6197…`, el mismo que Codex aprobó. **No lo mergeé yo: ya estaba hecho** cuando
  fui a verificar el SHA aprobado. Brent había autorizado el merge; no hizo falta.
- CAMBIOS: **`E0-gates` retirada** (el gate ya está en `main`) · **ola 1 = `E2` y nada más** ·
  **`E-infra` nueva**, con una medición como primer criterio · **`E3a` y `E3b` bajan a borrador
  no congelado**, con sus siete huecos de slug y el de paginación listados · E2 congela el toast
  y el camino corto (r9/S1) · §7 reescrita con riesgos vigentes · backlog de iOS corregido ·
  61 migraciones.
- EFECTO: 4 unidades congelables → **1**. `E1-spike` sigue arrancable en paralelo.
- TESTS: n/a — ronda de planificación.
- BACKLOG ADDED: reconciliar con UPGRADE si el gate evoluciona (ya no hay copia en AUDIO).
- OPEN AFTER THIS ROUND: **review de Codex sobre E2** (y `E1-spike` como contexto). Ninguna
  unidad arranca antes.

### 2026-08-07 — plan round 11 — PM (Fable)
- SESSION: `AUDIO · A0-core · PM`
- ACTION: triage de `CODEX REVIEW — plan r10` (VERDICT **FAIL**: 1 BLOCKING, 3 SHOULD-FIX,
  2 NIT). Aceptados los seis. **La review más estrecha de las siete**: por fin discute una
  unidad y no la estructura del plan. Codex dice que congelaría el alcance y el comportamiento
  de E2, pero no su contrato de ejecución.
- VERIFICACIÓN INDEPENDIENTE:
  - `grep -c liturgia_elementos src/integrations/supabase/types.ts` → **0**. `types.ts` cubre
    **~16 tablas de las 128** del proyecto; no tiene `liturgias` ni `liturgia_elementos`.
  - `bash scripts/gates/changed-files-diagnostics.sh src/hooks/useQuickPublish.ts` → **tsc (2)**:
    TS2769 en `:195` por `.from('liturgias')` y TS2352 en `:200` por el cast a `QuickLiturgy[]`.
  - Mismo gate sobre `src/lib/liturgia/liturgyService.ts` → **tsc (38)**: se come los
    diagnósticos consultando esas tablas sin tipos.
  - **Totales reales: `tsc=1039`**, no 1041 como decía el plan desde la r1.
  - Séptima review consecutiva en que Codex acierta en todo lo comprobable.
- DECISIÓN TOMADA POR EL PM (B1 exigía que no la eligiera el ejecutor): **adaptador tipado
  estrecho** — cliente ensanchado en un solo sitio, forma de fila declarada, y **validación en
  runtime como guardrail del cast**. Descartadas: regenerar `types.ts` (blast radius de 128
  tablas → backlog), reutilizar `loadLiturgy()` (carga la liturgia entera con sus slides en
  base64 para extraer una imagen), y el cast suelto (escape del gate sin contención).
- CAMBIOS: E2 congela la estrategia de tipado y añade **E2.7** (el adaptador termina en cero
  diagnósticos) · **§4 reescrita entera**: el gate se ejecuta desde `main`, sin SHA que fijar ni
  worktrees, con `git ls-tree` como evidencia, y la base corregida a `tsc=1039` · E2.6 enumera
  sus cuatro fallos de lectura y esos casos **definen "portada válida"** · el test del toast se
  monta sobre `useQuickPublish`, no sobre el helper · E-infra registra que al retomarse se parte
  en spike + implementación · N1 ("sin base de datos" → "sin cambios de esquema ni pruebas
  locales de DB") · N2 (la promesa se acota a "no bloquea por sí sola").
- BACKLOG ADDED: **regenerar `types.ts` para las 128 tablas** — que cubra 16 produce buena parte
  de los 1039 diagnósticos y haría innecesario el adaptador de E2.
- REGLA ADOPTADA (respuesta 6 de Codex): para hechos estáticos del código basta `fichero:línea`;
  **para estado del entorno hacen falta comando y salida**. §4 y §17 los llevan.
- TESTS: n/a — ronda de planificación.
- OPEN AFTER THIS ROUND: **review de Codex sobre E2 r11.** Si pasa, E2 arranca. `E1-spike` sigue
  arrancable en paralelo sin depender de esa review.

### 2026-08-07 — plan round 12 — PM (Fable)
- SESSION: `AUDIO · A0-core · PM`
- ACTION: triage de `CODEX REVIEW — plan r11` (VERDICT **FAIL**: 1 BLOCKING, 3 SHOULD-FIX,
  3 NIT). Aceptados los siete. **Codex no argumentó: construyó** un prototipo fiel del adaptador
  congelado en la r11 y le pasó el gate real → `tsc(0) eslint(0) deno-lint(0) deno-check(0)`.
  **La estrategia de tipado de E2 queda validada con evidencia ejecutada.**
- **CUARTA VERIFICACIÓN FALSA MÍA, y la más instructiva.** La r11 afirmaba `tsc=1039` "medido".
  Remedido por mí:
  - En el checkout de trabajo (`feat/mesa-md-schema`, la rama de P1 de UPGRADE) → **1039**.
  - En un worktree **limpio** de `main` (`05dc4ca`) → **1041**.
  - Codex midió 1041 tres veces por vías independientes. Tiene razón.
  - **El comando era real; el árbol era el equivocado.** En la r10 adopté la regla "toda
    afirmación de estado del entorno lleva su comando al lado" — y la rompí en su primera prueba,
    porque nombré el comando pero **no el árbol**. Regla corregida: **comando, salida y la
    identidad del árbol (rama o SHA)**.
- VERIFICACIÓN INDEPENDIENTE DEL RESTO: la asimetría de RLS de S2 confirmada en
  `20260108000000_fix_liturgia_rls_authenticated.sql` — lectura de admin en `liturgias` (`:29`),
  eliminada y no recreada en `liturgia_elementos` (`:35-48`). Residuos de S1b localizados en el
  bloque de borradores (E3a.11, E3b.8, la línea huérfana "ni siquiera de E0-gates", y la fila que
  reafirmaba la verificación falsa del Postgres). El "§5.1" que el plan citaba **no existe**: se
  perdió al reensamblar el documento en la r10.
- CAMBIOS: §4 corregida a **1041** con comando, salida y SHA, más la regla de medir en el SHA
  padre · §4.3 cita la regla de clasificación del README (desplazamiento de línea aceptable /
  diagnóstico nuevo bloqueante) y §4.3b el patrón worktree+symlink · **E2.1 acotada** a "legible
  por quien publica", con la asimetría de RLS documentada · la estrategia de tipado **prohíbe
  `any`** · "data URL **o base64 crudo**", con los 30 registros reales que midió Codex ·
  §10 reescrita (seguía en la r9) · residuos de los borradores marcados **OBSOLETO, no aplicar** ·
  referencias colgantes corregidas.
- DATO ÚTIL QUE APORTA LA REVIEW: 30 filas `portada-reflexion` reales — 14 con prefijo data URL,
  15 base64 crudo, 1 sin `slides`, 0 con URL HTTP. **Confirma los cuatro casos de E2.6 contra
  datos reales**, no contra hipótesis.
- BACKLOG ADDED: ampliar la lectura de `liturgia_elementos` para admins (cambio de policies,
  fuera del scope de E2).
- TESTS: n/a — ronda de planificación.
- OPEN AFTER THIS ROUND: **review de Codex sobre E2 r12.** Codex declaró que congelaría E2 con
  B1, S2 y S3 arreglados; los tres lo están. `E1-spike` sigue arrancable en paralelo.

### 2026-08-07 — plan round 13 — PM (Fable) — ✅ E2 CONGELADA
- SESSION: `AUDIO · A0-core · PM`
- ACTION: triage de `CODEX REVIEW — plan r12` (VERDICT **PASS**: 0 BLOCKING, 1 SHOULD-FIX,
  4 NIT) sobre `3084208`. **Novena review, la primera que pasa.** Aplicados en este commit de
  congelado los cinco arreglos que Codex pidió, más el prompt de ejecutor de E2.
- **E2 QUEDA CONGELADA**: alcance, comportamiento, estrategia de tipado, test plan y gate.
  Codex validó la estrategia **construyendo el adaptador y midiéndolo** con el gate real
  (`tsc 0 / eslint 0 / deno-lint 0 / deno-check 0`), no argumentando.
- CIERRE DE LA SAGA 1039/1041 — cuatro mediciones verdaderas que se contradecían:
  - `main @ 05dc4ca`, worktree limpio → **1041** (Codex ×2, PM ×1).
  - `ac9ef14` (rama de P1), limpio → **1039** (Codex ×2, PM ×1 sin anotar SHA).
  - **Mecanismo:** `d9eebb0` añade `host_food_assignment` a `mesa_abierta_matches` en `types.ts`,
    lo que apaga `MesaAbiertaAdmin.tsx(376,39)` TS2339 y `(882,19)` TS2353. Dos, ninguno más.
  - **El error fue de los dos.** Mi r11 midió la rama y la llamó `main`. **La r11 de Codex midió
    `main` y lo llamó rama** — el reflog muestra que entre las 15:39 y las 15:52 otra sesión tuvo
    este checkout compartido en `main`, y sus dos mediciones cayeron dentro. Codex lo detectó y
    lo corrigió él mismo en la r12.
  - **Regla final: comando, salida y SHA exacto. Nunca el nombre de una rama** — en un repo con
    sesiones concurrentes, el nombre de rama no identifica un árbol.
- CAMBIOS DE ESTA RONDA: §4 y §5 unifican la regla a SHA-siempre (S1) · tres `1039` residuales
  corregidos a **1041** (N1) · añadida la fila de backlog para ampliar la lectura de
  `liturgia_elementos` (N2) · errata de §17 tachada con su bloque de corrección (N3) · §18 con
  los SHAs y admitiendo que **no anoté el mío**, más el aviso de los ~208 falsos deltas para la
  futura unidad de `types.ts` (N4) · §19 nueva.
- ENTREGABLE: **`docs/plan/audio/prompts/E2-r1.md`**, commiteado en `docs/plan-audio` para que el
  ejecutor lo encuentre desde otro worktree.
- TESTS: n/a — ronda de planificación.
- OPEN AFTER THIS ROUND: **ejecutar E2** (`/exec AUDIO E2 r1`). `E1-spike` sigue arrancable en
  paralelo, pero **no ha pasado review** — si se lanza, es por decisión explícita de Brent.
  `E-infra`, `E3a`, `E3b` y `E4-spike` siguen en borrador.

### 2026-08-07 — E2 round 1 — EXEC (Opus) — ✅ COMPLETE
- SESSION: `AUDIO · E2 · r1 · EXEC`
- BRANCH: `phase/E2-caratula` · **SHA PADRE `05dc4caf857ed4e93c662131d053672032da0cf6`**
  (= `main` en el momento de crear la rama) · COMMIT `6d45f35a54bde0335d05ffd6943167cf25d0a09e`
- ACTION: la carátula del episodio pasa a derivarse de la portada de reflexión de la
  liturgia vinculada. Cuatro ficheros, 716 inserciones:
  - `src/lib/sermon-editor/liturgyCover.ts` (**nuevo**, 133) — lee
    `liturgia_elementos WHERE liturgia_id = … AND tipo = 'portada-reflexion'`, extrae
    `slides.slides[0].content.imageUrl` y convierte con `base64ToSpotifyCover()`.
    Devuelve `{status:'ok'|'unavailable'}`; **nunca lanza**.
  - `src/hooks/useQuickPublish.ts` (+27/−2) — camino corto en `generateCover`, **antes** de
    la validación de título/predicador y de la carga del logo; toast en español al degradar.
  - `src/lib/sermon-editor/__tests__/liturgyCover.test.ts` (**nuevo**, 18 casos).
  - `src/hooks/__tests__/useQuickPublish.e2.test.ts` (**nuevo**, 8 casos, monta el hook).
- TIPADO (estrategia congelada, respetada sin desviación): un solo ensanchado del cliente,
  privado del módulo, vía `as unknown as` sobre interfaces estructurales; **cero `any`**;
  `extractImageUrl()` valida la forma en runtime y es la contención del cast.
- GATE (`05dc4ca` → `6d45f35`, ambos medidos con el script de `main`):
  - `useQuickPublish.ts` — 2 errores `tsc` antes y después, **mensajes idénticos**, movidos
    de `(195,15)`→`(198,15)` y `(200,20)`→`(203,20)`. **Desplazamiento de línea, aceptable**
    por `scripts/gates/README.md`. `diff` normalizado sólo por el número de línea: vacío.
  - Los **tres ficheros nuevos**: `tsc 0 / eslint 0 / deno-lint 0 / deno-check 0`. **E2.7 ✅**
  - Totales del proyecto sin cambio: `tsc=1041 eslint=160 deno-lint=94 deno-check=46`.
  - `npm run build` ✓ (16.59 s). `node v22.22.0` · `deno 2.7.11`.
- TESTS: `npx vitest run --no-file-parallelism src/lib/sermon-editor src/hooks` →
  **23 ficheros, 292 tests, 0 fallos**.
- HONESTIDAD DE TESTS (D18) — base-red real + cinco mutaciones, todas verificadas rojas:
  - **BASE-RED** de `useQuickPublish.e2.test.ts` antes del cableado: **6 de 8 rojos**.
    Los 2 verdes (A5, A6) cubren comportamiento ya correcto → van por mutación.
  - **M1** (A1, mutación declarada por el plan) sin camino corto → 6 rojos.
  - **M2** (A2, mutación declarada) logo cargado antes del camino corto → 6 rojos.
  - **M3** (A3) `Math.max`→`Math.min` en `coverImageUtils.ts:34` (recorte central → contain)
    → 1 rojo: `expected 1400 to be close to 1866.67`.
  - **M4** (A5) sin la guarda `if (liturgyId)` → 1 rojo:
    `expected [ 'liturgia_elementos' ] to not include 'liturgia_elementos'`.
  - **M5** (A6) `return` tras el toast en vez de degradar → 5 rojos.
- ACCEPTANCE CRITERIA: **E2.1–E2.8 cumplidos.**
- ASIMETRÍA DE RLS: respetada tal como la congeló el plan. Una liturgia ajena da 0 filas y
  degrada como si no hubiera portada; no se tocaron policies. Los tests van con mocks, así
  que **esto no está probado contra la RLS real** — sólo el camino degradado lo está.
- FINDINGS RAISED: ninguno. La ruta trazada por el plan se verificó exacta: tabla, `tipo`,
  ruta `slides.slides[0].content.imageUrl`, tolerancia de `loadImage` a base64 crudo,
  recorte central en `coverImageUtils.ts:32`, y los 2 errores base en `(195,15)`/`(200,20)`.
- NOT DONE / OPEN: la rama **no se mergea** (autoridad de Brent). Sin verificación en
  navegador — E2 es lógica bajo vitest y el flujo real exige audio, sesión y liturgia con
  portada guardada. Sigue en pie el backlog de ampliar la lectura de `liturgia_elementos`
  para admins (cambio de policies, fuera de scope).
- OPEN AFTER THIS ROUND: revisión PM de E2 r1. `E1-spike` sigue arrancable en paralelo.

### 2026-08-08 — E2 round 1 — PM (Fable), verificación
- SESSION: `AUDIO · A0-core · PM` (verifica `AUDIO · E2 · r1 · EXEC`)
- ACTION: verificación independiente del `EXECUTOR REPORT — E2 round 1`. **El informe llegó
  truncado justo en la evidencia del gate**, así que el gate lo medí entero yo.
- **LO QUE VERIFIQUÉ YO MISMO** (no re-derivado del informe):
  - **Alcance del diff** (`git diff --stat 05dc4ca 6d45f35`): 4 ficheros, +716/-2. Ni esquema, ni
    `types.ts`, ni `Portadas.tsx`, ni `coverPromptBuilder.ts`. **Sin desbordes.**
  - **Adaptador** (`liturgyCover.ts`, leído entero): un solo ensanchado vía `as unknown as` con
    interfaces estructurales privadas; `grep ": any|<any|as any"` sobre los tres ficheros nuevos →
    **cero**; `extractImageUrl()` valida la forma en runtime en cuatro niveles y la función
    **nunca lanza**.
  - **Orden del camino corto** (A2): el bloque `if (liturgyId)` está **antes** de
    `if (!title || !speaker)` y de `getCasaLogoAsBase64()`, y respeta el patrón `coverGenIdRef`
    de supersede que ya usaba el fichero.
  - **Tests reejecutados por mí**: `npx vitest run --no-file-parallelism src/lib/sermon-editor
    src/hooks` → **23 ficheros, 292 tests, todos verdes**. Reproduce el informe.
  - **Gate en HEAD `6d45f35`**: `liturgyCover.ts` **0/0/0/0**; los dos ficheros de test
    **0/0/0/0**; `useQuickPublish.ts` **tsc (2)** en `(198,15)` y `(203,20)`.
  - **Gate en base `05dc4ca`** (worktree limpio + symlink a `node_modules`):
    `useQuickPublish.ts` **tsc (2)** en `(195,15)` y `(200,20)`.
  - **DELTA: desplazamiento de línea (+3), mismos mensajes y códigos → aceptable por la regla de
    `scripts/gates/README.md`. CERO diagnósticos nuevos.** Es exactamente el falso delta que
    §4.3 anticipó, y no tropezó con él.
  - **Totales: `tsc=1041 eslint=160 deno-lint=94 deno-check=46`**, coincide con la base corregida
    en la r12 (`main @ 05dc4ca`).
  - **Mutación ejecutada por mí en worktree desechable** (`--detach 6d45f35`, borrado después —
    el entregable no se tocó): eliminado el bloque del camino corto → **6 tests rojos**. Los tests
    fallan de verdad; no son aserciones incapaces de fallar (D18).
  - **`npm run build`** → verde.
  - Entrada de ledger del ejecutor commiteada en `docs/plan-audio` (`0587816`).
- FINDINGS RAISED:
  - **BLOCKING: ninguno.**
  - **[S1] SHOULD-FIX — el mensaje de 0 filas afirma algo que el código no puede saber.**
    `REASON_NOT_SAVED` dice *"Esta liturgia no tiene portada de reflexión guardada"*, pero por la
    asimetría de RLS documentada en el plan, una liturgia **ajena que sí tiene portada** devuelve
    también 0 filas y muestra ese mismo texto. El **comportamiento** es correcto y es justo lo
    que A1 congeló ("legible por quien publica"); lo que afirma de más es **el texto**. Un
    "no está disponible" sería cierto en ambos casos. **Latente hoy** —las 30 liturgias con
    portada tienen un solo autor— y por eso no bloquea. **Al backlog.**
  - **NIT** — el gate reporta `0/0/0/0` para un fichero que **no existe** en la base, así que la
    base de los tres ficheros nuevos es cero por construcción. No invalida A7: lo que importa es
    que en HEAD midan cero, y miden cero.
- DECISIONS: ninguna nueva.
- BACKLOG ADDED: S1 (texto del aviso cuando la portada existe pero la RLS la oculta).
- OPEN AFTER THIS ROUND: **E2 está limpia y lista para la review final de Codex.** No la marco
  DONE — sólo un PASS de Codex cierra la unidad.

### 2026-08-08 — E2 CIERRE DE UNIDAD — PM (Fable)
- SESSION: `AUDIO · A0-core · PM`
- ACTION: cierre de E2 tras `CODEX REVIEW E2 FINAL` → **PASS** (0 BLOCKING, 1 SHOULD-FIX, 0 NIT).
- **`E2` marcada DONE** en `PLAN.md`: `phase/E2-caratula@6d45f35`, SHA padre `05dc4ca`,
  2026-08-08. **Primera unidad ejecutada de este plan**, tras 13 rondas de plan y 9 reviews.
- QUÉ SE CONSTRUYÓ: la carátula del episodio deja de ser una ilustración nueva de Gemini y pasa
  a ser **la portada de reflexión que el constructor de liturgias ya había generado** — con el
  título de la liturgia y el nombre del predicador. Cuando no hay portada legible, degrada a
  Gemini con aviso en español y nadie se queda sin publicar.
- **QUÉ CAMBIÓ RESPECTO DEL PLAN CONGELADO: nada.** Cero desviaciones, cero suposiciones, cero
  rondas de remediación. Es la primera unidad de este plan que no necesitó enmienda, y no es
  casualidad: el plan llegó a la ejecución con la ruta trazada a `fichero:línea`, la estrategia
  de tipado demostrada por Codex con un prototipo medido, y los cuatro casos de fallo validados
  contra 30 registros reales de producción.
- VERIFICACIÓN CRUZADA: el PM comprobó M1 (6 rojos); **Codex corrió las otras cuatro** — M2 → 1,
  M3 → 1, M4 → 1, M5 → 5. Ninguno de los dos se fió del informe.
- GATE: base `05dc4ca` vs HEAD `6d45f35` → **sólo desplazamiento de línea** en
  `useQuickPublish.ts` (`195/200` → `198/203`), tres ficheros nuevos en `0/0/0/0`, totales
  idénticos (`tsc=1041 eslint=160 deno-lint=94 deno-check=46`). **Cero diagnósticos nuevos.**
- RUNTIME (D18 §4.6): Node **v22.22.0** · Deno **2.7.11**.
- BACKLOG (del SHOULD-FIX de Codex): reescribir `REASON_NOT_SAVED` (`liturgyCover.ts:55`) a
  *"No se encontró una portada de reflexión disponible para esta liturgia"* — el texto actual
  afirma que no está guardada cuando también cubre el caso de que exista y la RLS la oculte.
- LECCIÓN REGISTRADA: **la regla de clasificación de §4.3 se ganó su sitio en su primera
  aplicación real.** El delta de E2 fue exactamente el falso positivo que anticipaba. Sin esa
  frase —que entró por Codex r11/S3— el ejecutor habría reportado un delta que no existe.
- FRICCIÓN A RESOLVER FUERA DE MI ALCANCE: el ejecutor reportó que **el grueso de su contexto se
  fue en localizar el plan**, porque AUDIO no tiene fila en `~/.claude/agent-workflow/workstreams.md`
  y su plan vive sólo en la rama `docs/plan-audio`. Cada ejecutor futuro paga ese mismo coste.
  Ese fichero **no está en mis permisos de escritura**; queda escalado a Brent.
- OPEN AFTER THIS ROUND: merge de `phase/E2-caratula` a `main` **cuando Brent lo autorice
  explícitamente**. Siguiente unidad: `E1-spike` (arrancable, sin review) o `E-infra` (borrador).

### 2026-08-08 — traspaso de PM — PM (Fable) saliente
- SESSION: `AUDIO · A0-core · PM` → se retira. Siguiente: `AUDIO · E-infra · PM`.
- MOTIVO: SOP §3.3 (un bootstrap por fase) y §4 (la sesión de PM es desechable). Esta sesión
  acumula 13 rondas de plan, 9 reviews de Codex y el cierre de E2. **Además, este PM cometió
  cuatro verificaciones falsas** —alcance a Supabase (r1), existencia del script del gate (r2),
  Postgres local (r9), `tsc=1039` (r11)— todas cazadas por Codex y todas registradas en §5 del
  plan. Re-sembrar desde `PLAN.md` + `LEDGER.md` hereda los hechos corregidos sin heredar el
  hábito.

**ENCARGO PARA EL PM ENTRANTE — antes de redactar `E-infra`, medir. No especificar a ciegas: ése
es exactamente el error que dejó a `E-infra` en borrador.**

1. **¿Sirve la ruta de Supabase branches para las pruebas de base de `E3a`?** Está registrada
   como alternativa en los riesgos de E3a y hay MCP disponible (`mcp__supabase-casa__create_branch`).
   **Si funciona, el conflicto del puerto 54322 con el proyecto ajeno `sxlogxqzmarhqsblxmtj` deja
   de importar y `E-infra` se encoge a poco más que la guarda.** Si no funciona, se sabrá con una
   medición, no con una suposición.
2. **La guarda anti-producción de los e2e**, que es barata, cierta e independiente de lo anterior:
   hoy `src/integrations/supabase/client.ts:5` cae por defecto al proyecto **productivo** y no
   existe `.env.test`. Hay que cerrarlo pase lo que pase — es la base compartida con Life OS.

**Contexto que ahorra tiempo al PM entrante:**
- `church_podcast_episodes` **sí está tipada** en `types.ts` (línea 683), a diferencia de
  `liturgias`. **`E3a` NO necesita el adaptador que E2 tuvo que construir**; su criterio de
  regenerar tipos es sólo añadir `slug` a una tabla que ya está ahí. El borrador de E3a no lo
  sabe todavía.
- Los cuerpos de `E3a`, `E3b` y `E4-spike` llevan un banner de **"no aplicar"** sobre los
  residuos de `E0-gates` y sobre la verificación falsa del Postgres. Léelo antes de reutilizarlos.
- La regla de evidencia vigente: **comando, salida y SHA exacto — nunca el nombre de una rama**.
  Este repo lo comparten sesiones concurrentes; el checkout cambia de rama bajo los pies.

**ABIERTO, pendiente de Brent:**
- **Merge de `phase/E2-caratula` a `main`** (ff de un commit). Autorización explícita requerida.
- **`E1-spike`**: arrancable y sin review. Su matriz necesita iOS <18.4, iOS ≥18.4 y Android
  físicos. **Pregunta sin responder: ¿Brent los tiene a mano?** Sin ellos, las celdas vuelven
  "no medidas" y el bloque sale con alcance reducido.
- **Fricción de arranque, fuera de los permisos del PM:** AUDIO no tiene fila en
  `~/.claude/agent-workflow/workstreams.md`, y su plan vive sólo en la rama `docs/plan-audio`.
  El ejecutor de E2 reportó que ahí se le fue el grueso del contexto. **Cada ejecutor y cada PM
  futuro paga lo mismo.** Una fila apuntando a `docs/plan/audio/` lo cierra de una vez.

### 2026-08-08 — reordenación de olas — PM (Fable) saliente
- SESSION: `AUDIO · A0-core · PM`
- ACTION: **`E1-spike` se aplaza a la ola 4** por decisión de Brent. La ola 2 pasa a ser el
  camino a la página: `E-infra` → `E3a` → `E3b` → `E4-spike`. La ola 3 queda como el cierre del
  bucle público (`E4-impl`, `E5`, `E6`), sin planificar.
- RAZÓN: `E1-spike` **no tiene dependencias técnicas** — el aplazamiento es de prioridad, no de
  bloqueo, y así queda escrito para que nadie lo lea como impedimento. Pesa que entrega un
  documento y no algo que la comunidad pueda abrir, y que su matriz exige dispositivos físicos
  cuya disponibilidad sigue sin confirmarse.
- EFECTO: el cuerpo de `E1-spike` se conserva íntegro con un banner de aplazada. **Le falta
  review, no trabajo**: se adelanta en cuanto Brent confirme los dispositivos o cambie la
  prioridad.
- TESTS: n/a — reordenación de plan.
- OPEN AFTER THIS ROUND: sin cambios respecto del traspaso — merge de E2 pendiente de
  autorización, y `/pm-boot AUDIO E-infra` con el encargo de medición como primera tarea.
