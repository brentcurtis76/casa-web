# PLAN — UPGRADE (La Mesa Abierta · opt-out del plato principal)

META
- REPO / ROOT: `/Users/brentcurtis/dev/casa-web` · plan root `docs/plan/upgrade/`
- SESSION PREFIX: `UPGRADE` (slug `upgrade`) — distinto de `docs/plan/PLAN.md` (CASA/PREL).
- BASE COMMIT: `1732bee`
- REVISIÓN: **7** — tras `CODEX REVIEW (round 6)` = FAIL (2 BLOCKING, 2 SHOULD-FIX, 1 NIT).
  La re-planificación de la rev 6 (retirada de dos exigencias inventadas) queda confirmada
  por Codex como acertada; esta revisión solo cierra los dos bloqueantes restantes.
- **PLAN FROZEN: 2026-08-06** — `CODEX REVIEW (round 7)` = **PASS**, sin BLOCKING ni
  SHOULD-FIX. Los dos NIT quedan corregidos en esta misma revisión. A partir de aquí, todo
  cambio al plan requiere una entrada en el Decision Log.
- **EJECUCIÓN DESBLOQUEADA: 2026-08-06.** Brent concedió PR1 y PR2. Todas las fases,
  incluida P1, pueden ejecutarse.

## Por qué la revisión 6 retiró dos exigencias (contexto que sigue vigente)

Las revisiones 2–5 fallaron cinco veces con una trayectoria de hallazgos BLOCKING de
**7 → 7 → 3 → 3 → 5**. Subió. Al mirar la ronda 5, cuatro de sus cinco bloqueantes
atacaban dos exigencias que **yo inventé y que nadie pidió**:

1. *"Dos implementaciones conformes producen salida byte-idéntica."* Va a haber **una**
   implementación. Introduje esa cláusula en la revisión 3 sobre-corrigiendo un hallazgo
   que solo decía que mi Goal prometía de más. Perseguirla obliga a especificar un
   algoritmo en prosa con precisión ejecutable — trabajo sin fondo: cada ronda añadía
   precisión y cada ronda destapaba otro rincón (orden de recorrido, condición de
   excepción, orden de `SIDE_FOODS`, rango de `pick`).
2. *Un esquema global de identidad de diagnósticos.* Nació de un hallazgo correcto
   (`tsc ≤1041` deja cambiar un error por otro), pero la solución no tiene por qué ser un
   detector sólido sobre 1041 diagnósticos preexistentes. Eso es un proyecto de ingeniería
   propio, ajeno al plato principal. La ronda 5 demostró que mi canonicalizador tenía 62
   cubos de colisión.

**Ambas se eliminan.** Lo que queda son garantías al servicio de la funcionalidad, y un
gate acotado a los ficheros que cada fase toca — donde el problema de falsos negativos
desaparece porque el alcance son diez ficheros, no el repo entero.

Se conserva íntegro todo lo que la ronda 5 dio por cerrado: el contrato SQL de D14 (que
pasó revisión de seguridad adversarial), P0, la descomposición en fases, y la aritmética
de tests.

---

## Prerrequisitos de congelación (solo Brent puede resolverlos)

- **PR1 — Excepción explícita a la regla de prefijo.** `CLAUDE.md:77`: "*only touch
  `church_*` prefixed tables*". Este plan altera `mesa_abierta_participants` y crea una
  función sobre tablas `mesa_abierta_*`. Verifiqué la propiedad (las crea
  `supabase/migrations/20241109000000_mesa_abierta_schema.sql`, en este repo), pero
  verificar la propiedad **no deroga la regla**.
- **PR2 — Autorización para aplicar la migración** a la instancia compartida
  (`mulsqxfhxxdsadxsljss`). Autorizar un merge no autoriza cambios de base de datos.
- **PR3 — Brent aplica físicamente la migración de P1b** (añadido 2026-08-08, Decision Log).
  PR2 autorizó el cambio; **poder ejecutarlo es otra cosa**, y esa distinción costó las tres
  rondas de P1. Ningún agente tiene canal de escritura contra `mulsqxfhxxdsadxsljss`: las dos
  puertas están probadas cerradas —el clasificador de permisos de Claude Code (P1 r1) y el
  `--read-only` del servidor MCP `supabase-casa` (P1 r2)— y la tercera vía, `supabase db push`,
  la prohíbe D9 con razón: arrastraría también `20260612000000` y `20260612000001`, que están
  sin aplicar y **no** las cubre PR2. Docker no cambia nada de esto: `supabase start` levanta
  un Postgres **local**, útil como ensayo y nada más.

---

## Goal

Un participante puede indicar al inscribirse que **no puede traer el plato principal**.
El emparejamiento **nunca** le asigna uno.

Para cada mesa, el algoritmo asigna hasta `ceil(personas / 5)` platos principales entre
los portadores dispuestos de esa mesa. Cuando una mesa queda corta, intenta intercambios
acotados entre mesas para mejorar la cobertura. **Cualquier déficit restante se reporta
explícitamente** al administrador.

> El Goal no promete cobertura completa bajo ninguna condición, ni que la búsqueda de
> intercambios sea exhaustiva. Es una búsqueda local acotada: mejora lo que encuentra y
> reporta el resto. Las garantías exactas están en D5, junto con el detalle honesto de
> **cómo se establecen** — verificador de invariantes, fixtures adversariales y revisión
> de código, no la afirmación de que unos ejemplos demuestran un universal.

## Non-goals

- No se rediseña el algoritmo de asiento. P3a/P3b lo **extraen sin cambiarlo**; P4 solo
  añade comida y reequilibrio.
- No se toca `supabase/functions/match-participants/` — verificado: no lo invoca ningún
  código de la app (única invocación real: `MesaAbiertaAdmin.tsx:511`).
- **No se completa el mapa `Functions` de `types.ts`** (ver D15). Es un workstream de
  limpieza aparte.
- No se corrigen los diagnósticos preexistentes de `tsc`/ESLint/`deno lint`/`deno check`.
- No se tocan los archivos sombra `* 2.ts(x)`.
- No se arregla el bug de `handleMoveGuest` (`MesaAbiertaAdmin.tsx:785`). Backlog.
- No hay preferencias por tipo de plato principal.
- **Ninguna verificación de conducta o de escenario toca la base compartida** (D12). P1 sí
  aplica e introspecciona la migración: eso es esquema, no conducta.

---

## Estado actual verificado

**Esquema real** (introspección): `mesa_abierta_participants` (31 filas) sin columna de
plato principal; `mesa_abierta_matches` (6 filas) con `host_food_assignment text` nullable
(`20241203_add_host_food_assignment.sql:4`); `mesa_abierta_assignments` (25 filas) con el
enum `main_course|salad|drinks|dessert|none`. `types.ts` se mantiene a mano y le faltan
`participants.email` y `matches.host_food_assignment`.

**RLS** (`20241127_fix_rls_recursion.sql`): un invitado lee **solo su propia** fila de
`mesa_abierta_assignments` (`:39`) pero **sí** la fila completa de su `mesa_abierta_matches`
(`:27`). No puede agregar los datos de su mesa desde el cliente — de ahí D14.

**Deriva repo ↔ remoto**: remoto con 60 migraciones; el repo añade `20260612000000` y
`20260612000001` sin aplicar. `supabase db push` prohibido (D9).

**Sin seams de test**: `create-mesa-matches/index.ts:11` y
`admin-add-participant/index.ts:10` llaman `serve()` al importar. Ninguna Edge Function de
Mesa Abierta es importable hoy. De ahí P3a y P5b.

**RPC sin tipar ya existentes** (inventario corregido, Codex r5 N1 — son **siete**, no
cinco): `decrement` (`MesaAbiertaAdmin.tsx:785`), `save_liturgy_slides_positions`
(`saveToLiturgyService.ts:635`), `get_users_with_email`, `get_user_permissions`,
`get_user_roles`, `has_permission`, `get_song_usage_stats`. Ninguna está en el mapa
`Functions`, y sus diagnósticos forman parte de la línea base.

**Roturas preexistentes confirmadas**:
- `MesaAbiertaAdmin.fetchParticipants` (`:226`) selecciona columnas explícitas.
- `MesaAbiertaDashboard.tsx:139` consulta `participant_id`, columna inexistente
  (la real es `guest_participant_id`); el anfitrión no tiene fila de assignment.
- `MesaAbiertaDashboard.test.tsx:24` declara un **mock local** que anula el global; carece
  de `.neq()` (el componente lo llama en `:96`), modela la cadena obsoleta
  `.gte().order().limit().single()`, devuelve un objeto donde se espera un array, y sus
  fixtures "futuras" son de diciembre de 2025.
- Tres caminos de override de comida: `:1350`, `:1426`, `:1453`.
- `scripts/mesa-abierta-stress-test.sql` enlaza a `auth.users` reales y limpia al inicio,
  no al final.

**Copia**: `send-mesa-notifications/index.ts:241` omite el `+1` del anfitrión. Ambas
funciones de notificación cargan matches con `select("*")`.

### Línea base en `1732bee` (Node v22.22.0, Deno 2.7.11)

| Gate | Comando | Base |
|---|---|---|
| Tipos | `npx tsc -p tsconfig.app.json --noEmit` | 1041 líneas `error TS` |
| Lint | `npm run lint` | 160 (117 err / 43 warn) |
| Unit | `npx vitest run --no-file-parallelism` | 1036 pass / 6 fail (78 archivos) |
| Build | `npm run build` | ok |
| Deno test | `deno test --allow-all .` desde `supabase/functions/` | 409 pass / 0 fail |
| Deno lint | `deno lint .` | 94 |
| Deno check | `deno check .` | 46 |

Los 6 rojos están todos en `MesaAbiertaDashboard.test.tsx`. `npm test` arranca en watch y
no sirve como gate.

**Medición conservada de la revisión 5** (ejecutada por el PM en worktree limpio y
confirmada independientemente por Codex): añadir `get_my_dinner_summary` al mapa
`Functions` introduce **4 diagnósticos genuinamente nuevos** en
`src/lib/music-planning/songUsageService.ts`, porque el mapa incompleto hace que toda
`.rpc()` no listada resuelva contra la unión de `Returns`. Solo campos: 1041 → 1039, cero
añadidos. Ésta es la base de D15.

---

## Frozen architectural decisions

| ID | Decisión |
|---|---|
| **D1** | Cuota `max(1, ceil(personas / 5))`, personas = anfitrión + su `+1` + cada invitado + sus `+1`. Elegida por Brent. Rige idéntica en P2, P4, P6, P7, P8. |
| **D2** | `mesa_abierta_participants.can_bring_main_dish BOOLEAN NOT NULL DEFAULT TRUE`. Polaridad positiva; la UI lo presenta como exclusión. |
| **D3** | El algoritmo **nunca** asigna `main_course` a un excluido. El admin sí puede forzarlo desde los **tres** caminos de override, siempre con advertencia visible. |
| **D4** | Un déficit se reporta, nunca se resuelve en silencio. |
| **D5** | **Garantías, no procedimiento** — ver abajo. El orden de recorrido, las condiciones de parada y el orden de `SIDE_FOODS` son decisiones de implementación de P2, fijadas por sus propios tests. |
| **D6** | La regla canónica vive en `supabase/functions/_shared/mainDish.ts`, módulo hoja sin imports. P2 prueba que `tsc` y Vitest lo importan desde `src/`; la prueba de `vite build` se difiere a **P6**, primer consumidor de producción. |
| **D7** | El anfitrión es el primer candidato a plato principal cuando puede. Reversible. |
| **D8** | **Gates acotados a los ficheros que la fase toca** — ver abajo. |
| **D9** | Solo migraciones aditivas. `supabase db push` prohibido. Aplicación con un único `apply_migration`, tras PR1 y PR2. |
| **D10** | Todo texto de cara al usuario en español. |
| **D11** | Los módulos puros no llaman a `Math.random()`; la aleatoriedad entra por una `pick(n)` inyectada, que devuelve un entero en `[0, n)`. |
| **D12** | Ninguna verificación de conducta o escenario enlaza datos sintéticos a `auth.users` ni muta la base compartida. `scripts/mesa-abierta-stress-test.sql` no se usa como gate. Ninguna evidencia commiteada contiene datos de miembros. |
| **D13** | `index.ts` de cada Edge Function tocada queda como adaptador delgado. La lógica vive en `handler.ts`; la decisión pura en `matching.ts`. |
| **D14** | El invitado obtiene los agregados de su mesa llamando a `get_my_dinner_summary()`, `SECURITY DEFINER`, calculados **en vivo**. **No se persiste ningún agregado.** Contrato SQL exacto abajo (cerrado por Codex r5). |
| **D15** | La RPC **no** se añade al mapa `Functions` de `types.ts` (medido: introduce 4 diagnósticos nuevos en código no relacionado). P8 la consume a través de **un adaptador local con una única conversión de tipo documentada y validación de forma en tiempo de ejecución** (ver P8). Completar el mapa entero es backlog. |

### D5 — Garantías del reequilibrio

P2 implementa una **búsqueda local acotada**. El plan congela **qué debe cumplirse**, no
cómo recorrerlo. Cada punto es una propiedad que P2 debe establecer (ver "Cómo se
establecen" más abajo):

1. **Nunca** se asigna `main_course` a un portador con `canBringMainDish === false`.
2. Los anfitriones **nunca** se mueven de mesa.
3. Todo intercambio conserva **exactamente** el número de personas de cada mesa implicada
   (se intercambian subconjuntos de invitados de ≤2 elementos con igual suma de personas).
4. Tras cualquier intercambio, las unidades de invitado de cada mesa siguen
   `≤ maxGuestUnits`.
5. Ningún intercambio deja a la mesa donante en déficit.
6. **Todo intercambio aplicado reduce el déficit total en al menos 1.** (Codex r6 B1: en
   la revisión anterior esto solo aparecía como premisa del argumento de terminación, no
   como garantía comprobable por sí misma.)
7. El proceso **termina**: por la garantía 6 y porque el déficit total es un entero
   `≥ 0`, se aplican a lo sumo `Δ₀` intercambios, siendo `Δ₀` el déficit inicial.
8. **Cada mesa asigna exactamente `min(requiredMains, portadoresDispuestos)` platos
   principales tras el reequilibrio.** (Codex r6 B1: sin esto, una implementación puede
   asignar de menos y limitarse a reportar un déficit mayor — cumpliendo las demás
   garantías y aun así siendo incorrecta.)
9. **El conjunto global de participantes se conserva**: tras el reequilibrio, la unión de
   los invitados de todas las mesas es exactamente la de la entrada, **sin duplicados ni
   pérdidas**. (Codex r6 B1: un intercambio de igual número de personas puede aun así
   duplicar o perder a un invitado. El código actual ya tuvo un fallo de esta clase — el
   comentario de `index.ts:305` documenta la corrección de "un invitado en dos cenas".)
10. Toda mesa que no alcance su cuota aparece en `tablesWithShortfall` con su `shortfall`.
11. Para una misma entrada y una misma `pick`, **esta** implementación produce siempre el
    mismo resultado (determinismo interno; **no** se exige equivalencia con ninguna otra
    implementación hipotética).

**Cómo se establecen** (Codex r6 S1: un ejemplo concreto no demuestra un "nunca"). P2 no
usa property-based testing —el repo no lo emplea en ningún sitio— sino tres mecanismos
combinados, y el plan no afirma más de lo que dan:
- **Un verificador de invariantes reutilizable** en el fichero de test, que se aplica al
  resultado y a **cada** movimiento devuelto, comprobando las garantías 1–6, 8 y 9. Todos
  los tests lo invocan, así que cada caso nuevo las revalida.
- **Una tabla de fixtures de frontera y adversariales** (mesa sin dispuestos, todos
  dispuestos, capacidad al límite, déficit en varias mesas a la vez, `+1` en ambos lados),
  no un único caso feliz.
- **Revisión de código del invariante del bucle** para la garantía 6, que ningún conjunto
  finito de ejemplos puede establecer: el revisor confirma que la condición de aceptación
  del intercambio exige decrecimiento estricto.

**Lo que el plan ya no fija**, y P2 decide: el orden en que se recorren las mesas
deficitarias y las donantes, el orden de enumeración de subconjuntos, el orden de
`SIDE_FOODS`, y la secuencia exacta de llamadas a `pick`. Codex r5 B1 mostró que un
recorrido que solo mira la primera mesa deficitaria puede parar antes de tiempo: por eso
la garantía 10 exige reportar el déficit real y ninguna garantía exige exhaustividad. Si
P2 elige un recorrido que mejora más, mejor; el plan no lo obliga ni lo prohíbe.

### D8 — Gates acotados a los ficheros de la fase

Un esquema de identidad sobre 1041 diagnósticos preexistentes resultó tener falsos
negativos demostrables (Codex r5 B5: 62 cubos de colisión). Se sustituye por un criterio
más estrecho y sin ese problema:

Para cada fase, siendo `F` la lista de ficheros que la fase modifica o crea:

1. `npm run build` termina con éxito.
2. `npx vitest run --no-file-parallelism`: el conjunto de tests en rojo **atribuibles a los
   ficheros de `F`** no crece. La base sigue siendo los 6 de `MesaAbiertaDashboard.test.tsx`
   hasta P8, que los repara y declara el conjunto nuevo. **Un rojo fuera de `F` se dirime
   reejecutando la suite completa en el commit padre**: si también aparece allí, es
   preexistente, se anota en el reporte y no bloquea; si no aparece, es BLOCKING.
   (Enmendado 2026-08-08, Decision Log. La redacción anterior —«el conjunto en rojo, por
   nombre, es exactamente el de la base»— no es comprobable mientras los tres ficheros
   `CuentacuentoEditor.ph.*` de B-05 flakeen bajo carga: el PM midió **7 rojos en el propio
   commit padre**, sin cambios de ninguna fase. La regla del padre no es una invención nueva:
   es la misma disciplina de comparación que el punto 4 ya usa para los diagnósticos, y no se
   puede burlar, porque un rojo que la fase haya causado no se reproduce en el padre.)
3. `deno test --allow-all --no-check .` desde `supabase/functions/`: **0 fallos**.
   (Enmendado 2026-08-08, Decision Log. Era `deno test --allow-all .`. El type-check que
   `deno test` hace de su grafo es **duplicado** del paso 4, que corre `deno check .` sobre
   el árbol entero incluidos los `_test.ts`; y mientras un fichero importado arrastre
   diagnósticos preexistentes, ese duplicado no reporta 0 fallos sino que **se niega a
   ejecutar la suite**. Quitarlo no reduce la cobertura de tipos en un solo fichero.)
4. **Cero diagnósticos nuevos en `F`**, comparando **mensajes crudos completos**, no
   recuentos ni códigos (Codex r6 B2). Se filtran las salidas de
   `npx tsc -p tsconfig.app.json --noEmit`, `npx eslint . -f json`, `deno lint` y
   `deno check` a las rutas de `F`, y se comparan **contra la fase padre inmediata**, no
   siempre contra `1732bee`. El revisor clasifica a mano cada diferencia como
   *desplazamiento de línea* (mismo mensaje, otra línea — aceptable) o *diagnóstico nuevo*
   (BLOCKING). Con `|F| ≤ 10` la salida filtrada cabe en pantalla y esta clasificación es
   trabajo de minutos.
   - **Por qué mensaje completo y no recuento por código**: `MesaAbiertaAdmin.tsx` tiene
     en base seis TS2339 con **cuatro mensajes distintos** y doce `no-explicit-any`.
     Cambiar uno por otro del mismo código deja el recuento igual y pasaría un criterio
     basado en códigos.
   - **Por qué la fase padre y no la base**: comparar siempre contra `1732bee` deja que
     una fase tardía reintroduzca un diagnóstico que otra anterior había eliminado.
5. Los recuentos globales (`tsc` 1041, ESLint 160, `deno lint` 94, `deno check` 46) se
   registran en el reporte **como observación**, no como criterio: sirven para detectar
   sorpresas, no para aprobar.

**Excepción medida y única**: P1 elimina 2 diagnósticos en `MesaAbiertaAdmin.tsx` (TS2339
y TS2353, por `host_food_assignment`) y añade 0. Está medido.

### Contrato SQL de `get_my_dinner_summary` (D14)

Cerrado por Codex r5: sin superficie de inyección, `search_path` vacío, objetos
calificados, cada fila restringida por `auth.uid()`, ejecución anónima revocada, sin PII.

```sql
CREATE OR REPLACE FUNCTION public.get_my_dinner_summary(p_month_id uuid)
RETURNS TABLE (match_id uuid, total_people integer, main_dish_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.id,
         (1 + (CASE WHEN hp.has_plus_one THEN 1 ELSE 0 END)
            + COALESCE((SELECT SUM(1 + CASE WHEN gp.has_plus_one THEN 1 ELSE 0 END)
                        FROM public.mesa_abierta_assignments a
                        JOIN public.mesa_abierta_participants gp ON gp.id = a.guest_participant_id
                        WHERE a.match_id = m.id), 0))::integer,
         ((CASE WHEN m.host_food_assignment = 'main_course' THEN 1 ELSE 0 END)
            + COALESCE((SELECT COUNT(*) FROM public.mesa_abierta_assignments a2
                        WHERE a2.match_id = m.id AND a2.food_assignment = 'main_course'), 0))::integer
  FROM public.mesa_abierta_matches m
  JOIN public.mesa_abierta_participants hp ON hp.id = m.host_participant_id
  WHERE m.month_id = p_month_id
    AND (
      hp.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.mesa_abierta_assignments a3
                 JOIN public.mesa_abierta_participants p3 ON p3.id = a3.guest_participant_id
                 WHERE a3.match_id = m.id AND p3.user_id = auth.uid())
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_dinner_summary(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_dinner_summary(uuid) TO authenticated;
```

---

## Phase index

| ID | Name | Status | Branch | Depends on |
|----|------|--------|--------|-----------|
| P0 | Script de gate por ficheros + línea base | **DONE** 2026-08-07 · `09a69d7` | `feat/mesa-md-gates` | — |
| P1a | Esquema: ficheros (migración + `types.ts`) | **DONE** 2026-08-08 · `9cc637b` | `feat/mesa-md-schema` | P0, PR1, PR2 |
| P1b | Esquema: aplicación y verificación (A3–A8) | **DONE** 2026-08-08 · `9cc637b` | `feat/mesa-md-schema` | P1a, PR3 |
| P2 | Módulo puro de asignación | **DONE** 2026-08-08 · `6363378` | `feat/mesa-md-alloc` | P0 |
| P3a | Seam: `handler.ts` en `create-mesa-matches` | **DONE** 2026-08-08 · `76d2d5e` | `feat/mesa-md-seam` | P0 |
| P3b | Extraer `matching.ts` puro | **DONE** 2026-08-09 · `e2bf43a` | `feat/mesa-md-core` | P3a |
| P4 | Cablear allocator en el núcleo | **DONE** 2026-08-10 · `5ca9a10` | `feat/mesa-md-wire` | **P1b**, P2, P3b |
| P5a | Captura en el frontend | TODO | `feat/mesa-md-form` | **P1b**, P4 |
| P5b | Seam + captura en `admin-add-participant` | TODO | `feat/mesa-md-addp` | **P1b**, P5a |
| P6 | Cobertura y diálogos del panel de admin | TODO | `feat/mesa-md-admin` | P4, P5a |
| P7 | Copia de notificaciones y porciones | TODO | `feat/mesa-md-copy` | P4 |
| P8 | Dashboard del miembro | TODO | `feat/mesa-md-dash` | **P1b**, P4, P7 |

Ramas ≤20 caracteres. Recuentos de test **delta**, no absolutos.

**Orden de merge** (enmendado 2026-08-08, Decision Log — antes era lineal con P1 entera):
P0 → **P1a** → P2 → P3a → P3b, con **P1b obligatoria antes de P4**, y luego P4 → P5a → P5b →
P6 → P7 → P8. P2, P3a y P3b **nunca dependieron de P1**: son módulos puros y seams de Deno que
no tocan la base de datos, así que pueden ejecutarse mientras PR3 sigue pendiente. Ése es el
motivo de la partición: no dejar tres fases paradas detrás de una acción humana.

P1a y P1b **comparten la rama `feat/mesa-md-schema`**: P1b no cambia ningún fichero de
producción, solo ejecuta consultas de verificación y escribe su entrada de ledger. Un solo PR
cierra las dos.

---

## Phase P0 — Script de gate por ficheros + línea base

**Rama:** `feat/mesa-md-gates` · **Scope (3 ficheros):**
`scripts/gates/changed-files-diagnostics.sh`, `scripts/gates/README.md`,
`docs/plan/upgrade/evidence/base-by-file.txt`.

El script recibe una lista de ficheros y emite, por cada uno, los diagnósticos de `tsc`,
ESLint, `deno lint` y `deno check` que le corresponden, con su recuento. Sin
canonicalización: la salida es la cruda, filtrada.

**Acceptance criteria:**
- [ ] Z1 — `changed-files-diagnostics.sh <fichero>…` emite recuento y detalle por fichero
  para los cuatro linters/compiladores.
- [ ] Z2 — Usa `npx eslint . -f json`, **no** `npm run lint -f json` (npm interpreta `-f`
  como `--force`).
- [ ] Z3 — La base se captura desde `git worktree add … 1732bee` con `node_modules`
  enlazado; el reporte muestra el comando y el SHA.
- [ ] Z4 — Dos ejecuciones consecutivas sobre la base dan salida byte-idéntica.
- [ ] Z5 — **Dos canarios negativos**, ambos sobre ficheros de prueba que **no** se
  commitean (Codex r6 B2: un canario de recuento no prueba que el gate detecte una
  sustitución):
  - **Z5a — canario de adición**: introducir un error de tipos nuevo en un fichero; el
    script lo reporta.
  - **Z5b — canario de sustitución**: en `MesaAbiertaAdmin.tsx`, eliminar uno de sus seis
    TS2339 e introducir otro TS2339 **distinto** en el mismo fichero. Recuento y código
    quedan idénticos; el script **debe** reportar el mensaje nuevo. Si no lo hace, el gate
    es decorativo y eso es BLOCKING.
- [ ] Z6 — `base-by-file.txt` cubre al menos los ficheros que las fases P1–P8 van a tocar,
  para que cada fase tenga contra qué comparar.
- [ ] Z7 — Build ok; los 6 rojos de Vitest sin cambios; `deno test` 0 fallos.

**Test plan:** el script es la herramienta; su test es su propia ejecución. Z4
(reproducibilidad) y Z5 (canario negativo) son lo que impide que el gate sea decorativo —
Codex r5 B5 mostró que un gate sin canario puede tener falsos negativos indetectables.

**Risks:** **estoy asumiendo** que `deno lint --json` y `eslint -f json` producen JSON
utilizable en las versiones instaladas. Si no, `FINDINGS` con el formato real.

**Rollback:** `git revert`. Solo herramientas.

---

> **P1 se partió en P1a y P1b el 2026-08-08** (Decision Log). Lo de abajo es la fase original
> íntegra; nada de su contenido cambia, solo se reparte. **P1a** = scope, las seis
> declaraciones, y los criterios **A1, A2, A9, A10, A11** — construida, verde y verificada por
> el PM en la rama. **P1b** = criterios **A3–A8**, bloqueada por **PR3**; no toca ningún
> fichero de producción, solo ejecuta las consultas de verificación. El motivo de la partición
> está en la entrada de ledger del 2026-08-08: tres rondas agotadas sin un solo hallazgo,
> todas contra un canal de escritura que ningún agente tiene.

## Phase P1a / P1b — Esquema: columna + RPC de resumen

**Rama:** `feat/mesa-md-schema` (las dos) · **P1a bloqueada por PR1 y PR2** · **P1b bloqueada
por PR3** · base con P0

**Scope (2 ficheros):** la migración
`supabase/migrations/20260806000000_mesa_main_dish_optout.sql` (columna + función exacta de
D14, con `REVOKE` y `GRANT`), y `src/integrations/supabase/types.ts`.

**Las seis declaraciones exactas de `types.ts`** (Codex r5 S3: la columna real es `TEXT`
nullable, y usar el enum de comida produce un TS2322 nuevo):

```ts
// mesa_abierta_participants
Row:    can_bring_main_dish: boolean
Insert: can_bring_main_dish?: boolean
Update: can_bring_main_dish?: boolean
// mesa_abierta_matches
Row:    host_food_assignment: string | null
Insert: host_food_assignment?: string | null
Update: host_food_assignment?: string | null
```

**Nada en el mapa `Functions`** (D15).

**Acceptance criteria — P1a (ficheros).** Los cinco cumplidos en r1 y verificados de forma
independiente por el PM (ledger 2026-08-07); `feat/mesa-md-schema`@`d9eebb0`:
- [x] A1 — La migración contiene solo `ADD COLUMN`, `CREATE OR REPLACE FUNCTION`, `REVOKE`
  y `GRANT`; `grep -iE 'drop table|truncate|alter column|drop column'` → 0.
- [x] A2 — PR1 y PR2 constan en el Decision Log con fecha antes del primer commit.
- [x] A9 — `types.ts` declara exactamente las seis líneas de arriba y **no** contiene
  `get_my_dinner_summary` (`grep -c` → 0).
- [x] A10 — Gate D8 sobre `F = {migración, types.ts}`: cero diagnósticos nuevos; se anota
  la eliminación medida de 2 en `MesaAbiertaAdmin.tsx`. Build ok, Vitest y Deno sin cambios.
- [x] A11 — El ejecutor no ejecutó `supabase db push`.

**Acceptance criteria — P1b (aplicación y verificación).** Requieren PR3:
- [ ] A3 — `information_schema.columns` da `can_bring_main_dish / boolean / NO / true`; y
  `SELECT count(*) … WHERE can_bring_main_dish IS DISTINCT FROM TRUE` → 0.
- [ ] A4 — `SELECT prosecdef, proconfig FROM pg_proc WHERE proname='get_my_dinner_summary';`
  da `prosecdef = true` y `search_path=` **vacío**.
- [ ] A5 — `has_function_privilege('anon', …, 'EXECUTE')` → `false`;
  `has_function_privilege('authenticated', …)` → `true`.
- [ ] A6 — Llamante autenticado ajeno a toda cena del mes: **0 filas**.
- [ ] A7 — Llamante anfitrión: 1 fila con `total_people` y `main_dish_count` iguales al
  cálculo manual de D1 sobre uno de los 6 matches existentes.
- [ ] A8 — Llamante invitado de ese match: **la misma** fila que A7.

**Test plan:** sin lógica de aplicación. A3–A8 son consultas SQL reejecutables y cubren
las cuatro clases de llamante (anónimo, autenticado ajeno, anfitrión, invitado). Son lo que
compensa la ausencia de contrato de tipos por D15.

**Risks:** el riesgo declarado en la revisión 7 —*«simular llamantes requiere
`set_config('request.jwt.claims', …)`; **estoy asumiendo** que es posible»*— **está cerrado**:
el PM lo probó el 2026-08-07. Una llamada multi-sentencia de `execute_sql` comparte
transacción, `set_config(…, true)` persiste entre sentencias y `auth.uid()` lo lee.
El PM además ejecutó el **cuerpo del contrato D14 en línea** contra los datos reales y
devuelve exactamente `(3d4d6709…, 6, 1)`, el valor que A7 espera. Confirmado también que
`mulsqxfhxxdsadxsljss` es producción y no hay staging.

> **CORREGIDO 2026-08-08 tras `REVIEW-P1` S1 de Codex.** Este párrafo afirmaba que el riesgo
> de A6–A8 estaba «cerrado» y que `SET LOCAL ROLE authenticated` era «innecesario». **Las dos
> cosas eran falsas, y de dos maneras distintas.**
> 1. Lo que el PM había probado —`set_config` y el **cuerpo** del contrato pegado como un
>    `SELECT` corriente— **no es `EXECUTE` sobre la función**: son lecturas de tablas base, que
>    el usuario de solo lectura sí puede hacer. El ensayo posterior en Docker corrió como
>    **superusuario**, donde el ACL no muerde. Las dos comprobaciones rodearon la barrera real.
>    P1b chocó con ella: `ERROR 42501: permission denied for function get_my_dinner_summary`.
> 2. La afirmación de que **no existe** canal de verificación de RPC para agentes era
>    demasiado amplia. Es cierta **solo del MCP** (`supabase_read_only_user` está fuera del ACL
>    y no es miembro de `authenticated`). Codex demostró que **sí hay uno**: un login de
>    revisión de la CLI enlazada puede asumir `postgres` para resolver el `user_id` del
>    llamante, fijar la claim, y luego asumir `authenticated` para invocar la RPC dentro de
>    `BEGIN … ROLLBACK`. Con esa vía reprodujo A6–A8 de forma independiente. **No** es un canal
>    de escritura aceptable —los prompts hicieron bien en prohibir los rodeos por CLI/psql, y
>    un login con capacidad de superusuario es peor que la aplicación humana explícita de
>    Brent— pero **como vía de lectura para verificar RPC es reproducible y válida**. Ver B-06.
Riesgo que queda: la resolución del nombre `match_id`, que es a la vez parámetro OUT y columna
de `mesa_abierta_assignments`, no puede ejercitarse sin crear la función. En el cuerpo toda
referencia va calificada por tabla, así que no debería haber ambigüedad; si la hay, es
`FINDINGS` contra el contrato congelado, no algo que se parchee sobre la marcha.

**Rollback:** `git revert` para P1a. Para P1b: la columna se deja (inerte hasta P4 — el PM
verificó por `git grep` que no tiene ni un consumidor). La función puede eliminarse con
`DROP FUNCTION` con autorización de Brent.

**Fila de `schema_migrations`** (decidido por el PM 2026-08-08, ver Decision Log): aplicar
desde el editor SQL **no** escribe la versión en `supabase_migrations.schema_migrations`, así
que PR3 incluye, como sentencia aparte y después de la migración, un
`insert … on conflict do nothing` con `('20260806000000','mesa_main_dish_optout')`. **No se
añade al fichero de la migración**, que se queda byte a byte como el contrato congelado.

---

## Phase P2 — Módulo puro de asignación

**Rama:** `feat/mesa-md-alloc` · **Scope:** `supabase/functions/_shared/mainDish.ts`
(hoja, sin imports), `mainDish_test.ts`,
`src/lib/mesa-abierta/__tests__/mainDishImport.test.ts`.

**API** — igual que en revisiones anteriores (`Carrier`, `TableInput` con `maxGuestUnits`,
`requiredMainDishes`, `balanceMainDishCarriers`, `allocateTableFood`, `allocateAll`), con
dos precisiones que sí se congelan porque son contrato de tipos, no de recorrido:
- `SIDE_FOODS` contiene exactamente `salad`, `drinks`, `dessert` — **nunca `main_course`**.
  Su orden es decisión de P2 (D5).
- `pick(n)` devuelve un entero en `[0, n)` (D11).

**Acceptance criteria.** Los nueve cumplidos en r1 y verificados de forma independiente por
el PM (ledger 2026-08-08); `feat/mesa-md-alloc`@`6af5071`:
- [x] B1 — Exporta la API; `grep -cE "^[[:space:]]*import"` → 0.
- [x] B2 — `grep -n "Math.random"` → 0.
- [x] B3 — Nadie lo importa desde `supabase/functions/**/index.ts`.
- [x] B4 — Las **once garantías de D5** están cubiertas por los tests 4–19, una a una.
- [x] B5 — `SIDE_FOODS` no contiene `main_course` (test 3).
- [x] B6 — Existe el **verificador de invariantes reutilizable**, comprueba las garantías
  1–6, 8 y 9, y **todos** los tests de asignación y reequilibrio lo invocan sobre el
  resultado y sobre cada movimiento devuelto.
- [x] B7 — `deno test` **+19 tests, 0 fallos**; `vitest` **+1 test**, rojos sin cambios.
- [x] B8 — El test 20 importa el módulo desde `src/` por ruta relativa y pasa; la prueba de
  `vite build` **no** es criterio aquí (D6).
- [x] B9 — Gate D8 sobre `F` = los 3 ficheros: cero diagnósticos nuevos, por mensaje
  completo contra la fase padre. Build ok.

**Test plan** — `mainDish_test.ts` (19). Los tests 4–19 se ejecutan **sobre la tabla de
fixtures de frontera** de D5 (mesa sin dispuestos, todos dispuestos, capacidad al límite,
déficit simultáneo en varias mesas, `+1` en ambos lados), y todos invocan el verificador de
invariantes:
1. `requiredMainDishes: 1-5 => 1, 6-10 => 2, 11-15 => 3`
2. `tablePeopleCount: anfitrión, su +1, invitados y sus +1`
3. `SIDE_FOODS no contiene main_course`
4. **[D5.1]** `nunca asigna main_course a un excluido`
5. **[D5.1]** `no elige al anfitrión si se excluyó`
6. `prefiere al anfitrión cuando puede` (D7)
7. `todo portador sin main_course recibe acompañamiento, nunca none`
8. **[D5.2]** `nunca mueve a un anfitrión`
9. **[D5.3]** `todo intercambio conserva el número de personas de ambas mesas`
10. **[D5.4]** `todo intercambio respeta maxGuestUnits en ambas mesas`
11. **[D5.5]** `ningún intercambio deja a la donante en déficit`
12. **[D5.6]** `todo intercambio aplicado reduce el déficit total en al menos 1`
13. **[D5.7]** `termina: nunca aplica más de Δ₀ intercambios`
14. **[D5.8]** `cada mesa asigna exactamente min(requeridos, dispuestos) platos principales`
15. **[D5.8]** `una mesa con dispuestos de sobra no deja platos sin asignar`
16. **[D5.9]** `el conjunto de invitados se conserva: sin duplicados`
17. **[D5.9]** `el conjunto de invitados se conserva: sin pérdidas`
18. **[D5.10]** `toda mesa bajo cuota aparece en tablesWithShortfall con su shortfall`
19. **[D5.11]** `misma entrada y misma pick ⇒ mismo resultado` · y
    `resuelve el contraejemplo de Codex r2 (1×(+1) ↔ 2×solo)`

`mainDishImport.test.ts` (20): `la regla es importable desde el frontend y coincide con la
tabla de casos del test 1`.

**Risks:** los tests son ejemplos y **no demuestran los "nunca" universales**. Lo que se
afirma es lo del apartado "Cómo se establecen" de D5: verificador de invariantes sobre cada
movimiento, tabla de fixtures adversariales, y revisión de código del invariante del bucle
para la garantía 6. Si el ejecutor concluye que alguna garantía necesita generación
aleatoria de casos, es `FINDINGS` antes de improvisar un framework que el repo no usa.

**Rollback:** `git revert`. Nada lo importa.

---

## Phase P3a — Seam: `handler.ts` en `create-mesa-matches`

**Rama:** `feat/mesa-md-seam` · **Scope:** `handler.ts` (nuevo, `createHandler(deps)` con
`pick` inyectable), `index.ts` (solo env, dependencias y `serve`), `handler_test.ts`
(nuevo, 10 goldens).

**Regla dura: conducta idéntica.** Sigue `shuffle([...4])[j % 4]` y `shuffle([...4])[0]`.

**Acceptance criteria:**
- [ ] C1 — `handler.ts` no llama `serve()` ni lee `Deno.env`.
- [ ] C2 — `createHandler` acepta `pick` y su default preserva la conducta.
- [ ] C3 — Los 10 goldens pasan con un doble de Supabase en memoria (D12).
- [ ] C4 — Cubren **comida** (5, 6) y **redistribución parcial** (8).
- [ ] C5 — Los guardas de autorización, estado, plazo e idempotencia siguen en el mismo
  orden y antes de toda escritura (tests 1–4).
- [ ] C6 — `deno test --allow-all --no-check .` **+10 tests, 0 fallos** (438/0 en la punta).
  **Enmendado 2026-08-08, Decision Log**: antes decía `deno test` a secas, y así es
  incumplible — `deno test` type-checkea su grafo de importación, así que los 8
  diagnósticos que B-08 desplaza a `handler.ts` abortan la suite entera en cuanto
  `handler_test.ts` la importa. `--no-check` **no pierde cobertura**: el paso 4 de D8 ya
  corre `deno check .` sobre todo el árbol, ficheros de test incluidos.
- [ ] C7 — Gate D8 sobre `F` = los 3 ficheros. Build ok.

**Test plan:** 1 `OPTIONS 200 sin tocar la base` · 2 `sin admin rechaza antes de leer el
body` · 3 `mes fuera de open se rechaza sin escribir` · 4 `plazo vigente se rechaza sin
escribir` · 5 `golden: comida de invitados = shuffle([...4])[j % 4]` · 6 `golden: comida
del anfitrión = shuffle([...4])[0]` · 7 `golden: capacidad en unidades; el +1 del anfitrión
no consume cupo` · 8 `golden: el segundo pase redistribuye y la mesa parcial se conserva` ·
9 `golden: sin cupo → lista de espera` · 10 `golden: idempotencia sin escribir`.

**Risks:** `supabase/functions/_shared/testHelpers.ts` **no** contiene un doble de
consultas (tiene fixtures de auth, `fetch` y logging); hay que escribirlo desde cero. Si
supera al código que prueba, `FINDINGS`. `guest_count` se escribe desde
`assignedGuests.length` **después** de la redistribución (`index.ts:335`, `:362`). Es la
sesión de mayor riesgo del plan: si el contexto se agota, reportar `CONTEXT PRESSURE` para
dividir, no apurar.

**Rollback:** `git revert`. Sin cambio de conducta.

---

## Phase P3b — Extraer `matching.ts` puro

**Rama:** `feat/mesa-md-core` · **Scope:** `matching.ts` (nuevo), `matching_test.ts`
(nuevo, 8), `handler.ts` (delegar).

**Regla dura:** los 10 goldens de P3a pasan **sin modificación**.

**Acceptance criteria:**
- [ ] D1e — `matching.ts` no importa `@supabase/supabase-js` ni usa `Deno.env`.
- [ ] D2e — No llama `Math.random()`.
- [ ] D3e — `handler.ts` ya no contiene los bucles de asiento (`grep -c "hostsToUse"` → 0).
- [ ] D4e — **`git diff` sobre `handler_test.ts` vacío.**
- [ ] D5e — Los 8 tests nuevos pasan; `deno test --allow-all --no-check .` **+8, 0 fallos**
  (**446/0** en la punta, partiendo de los 438/0 que dejó P3a). Comando actualizado el
  2026-08-08 por consecuencia directa de la enmienda de D8.3; no es un criterio nuevo.
- [ ] D6e — Gate D8 sobre `F` = los 3 ficheros. Build ok.

**Test plan:** 1 `determinista para pick fija` · 2 `capacidad en unidades` · 3 `el +1 del
anfitrión no consume cupo` · 4 `anfitriones sobrantes → invitados` · 5 `se elige el mayor
número de anfitriones que cumple el mínimo` · 6 `el segundo pase redistribuye` · 7 `la
última mesa puede quedar bajo el mínimo` · 8 `el plan incluye la lista de espera`.

**Rollback:** `git revert`.

---

## Phase P4 — Cablear allocator en el núcleo

**Rama:** `feat/mesa-md-wire` · **Scope:** `matching.ts` (+`allocateAll`),
`matching_test.ts` (+6), `handler.ts` (persistir comida, exponer cobertura,
`console.warn` por déficit), `handler_test.ts` (+4).

**Allowlist congelada:** pueden cambiar **exactamente dos** goldens, el 5 y el 6 (los de
comida). **Los otros ocho pasan sin modificación** — es una regla de paridad de
extracción, no la exigencia de implementaciones byte-idénticas que se retiró (Codex r6 N1).

**Acceptance criteria:**
- [ ] E1 — La comida persistida proviene solo de `allocateAll` (test 11).
- [ ] E2 — El plan trae `mainDishCoverage[]` y `tablesWithShortfall[]`, devueltos en `results`.
- [ ] E3 — Se persiste el asiento reequilibrado y `guest_count` coincide (tests 12, 13).
- [ ] E4 — Ningún excluido recibe `main_course` (test 14).
- [ ] E5 — **Ninguna columna de agregado se escribe**
  (`grep -cE "total_people|main_dish_count" handler.ts` → 0): D14 es en vivo.
- [ ] E6 — Solo los goldens 5 y 6 difieren; los otros ocho pasan sin modificación
  (`git diff` sobre ellos, vacío).
- [ ] E7 — `deno test --allow-all --no-check .` **+10, 0 fallos** (**456/0** en la punta,
  partiendo de los 446/0 que dejó P3b). Comando y absoluto actualizados el 2026-08-09 por
  consecuencia directa de la enmienda de D8.3; no es un criterio nuevo. Igual que en D5e.
- [ ] E8 — Gate D8 sobre `F` = los 4 ficheros. Build ok.
- [ ] E9 — Sin llamadas a `apply_migration`, `execute_sql` ni `functions deploy` (D12).

**Test plan** — `matching_test.ts` (+6): cuota por mesa · nunca a un excluido · reporta
shortfall · el reequilibrio se refleja en los invitados · se respeta el mínimo tras el
reequilibrio · determinista. `handler_test.ts` (+4): 11 `la comida proviene del allocator` ·
12 `se persiste el asiento reequilibrado` · 13 `guest_count coincide` · 14 `ningún excluido
con main_course persistido`.

**Risks:** primera fase que **quiere** cambiar conducta. Tocar un tercer golden es
`FINDINGS`.

**Rollback:** `git revert` + redesplegar la versión previa. La función solo escribe en
meses sin matches.

---

## Phase P5a — Captura en el frontend

**Rama:** `feat/mesa-md-form` · **Scope:** `src/lib/mesa-abierta/participantPayload.ts`
(nuevo, puro) + test; `MesaAbiertaSignup.tsx`; `EditParticipantDialog.tsx`;
`AddParticipantDialog.tsx`; `MesaAbiertaAdmin.tsx` (`can_bring_main_dish` en el `select` de
`fetchParticipants` y en el interfaz `Participant`); tres ficheros de test de componente.

**Copia (D10):** `No puedo traer el plato principal` /
`Te asignaremos ensalada, bebidas o postre en su lugar`. Switch apagado por defecto.

**Acceptance criteria:**
- [ ] F1 — `buildParticipantInsert` → `true` con switch apagado, `false` con encendido.
- [ ] F2 — El switch está en el paso 3, apagado por defecto, y su estado llega al builder.
- [ ] F3 — `fetchParticipants` selecciona el campo y `Participant` lo declara;
  `EditParticipantDialog` inicializa el switch como el negado del campo.
- [ ] F4 — `AddParticipantDialog` envía `canBringMainDish` en el body (test 10).
- [ ] F5 — El resumen del paso 5 lo menciona solo si el usuario se excluyó.
- [ ] F6 — **Guardar el diálogo de edición persiste el campo** (test 9).
- [ ] F7 — Los **12** tests pasan; `vitest` **+12**, rojos sin cambios.
  (Enmendado 2026-08-10, Decision Log: eran 10 y `+10`.)
- [ ] F8 — Gate D8 sobre `F` = los **9** ficheros (`participantPayload.ts` + su test, los
  tres componentes de formulario, `MesaAbiertaAdmin.tsx`, y los tres tests de componente).
  Build ok.
- [ ] **F9 — El cableado del switch al builder queda fijado por un test**, no solo por
  lectura: sustituir `cannotBringMainDish` por la constante `false` en la llamada a
  `buildParticipantInsert` debe poner **algún test en rojo**. (Añadido 2026-08-10,
  Decision Log. Antes de la ronda 2 esa mutación dejaba los diez tests verdes y cero
  diagnósticos de `tsc` — medido por el PM.)
- [ ] **F10 — `resetForm` de `AddParticipantDialog` devuelve el switch a apagado**, fijado
  por un test. (Añadido 2026-08-10, Decision Log.)

**Test plan:** `participantPayload.test.ts` (1–4). `MesaAbiertaSignup.mainDish.test.tsx`
(5–7 y **11**). `EditParticipantDialog.mainDish.test.tsx` (8 estado inicial · 9 el `update`
incluye el campo). `AddParticipantDialog.mainDish.test.tsx` (10 y **12**).
Tests **11** (el submit del asistente afirma el payload que recibe `.insert()`, cierra F9)
y **12** (`resetForm` apaga el switch, cierra F10) añadidos en la **ronda 2**.

**Risks:** los tests 5–10 montan Radix en jsdom, hoy solo probado para dos componentes. Si
el wizard no se monta hasta el paso 5 sin andamiaje desproporcionado, `FINDINGS`: 1–4
cubren la carga útil y los de UI se reducen a polaridad. **Nunca aserciones débiles.**

**Rollback:** `git revert`.

---

## Phase P5b — Seam + captura en `admin-add-participant`

**Rama:** `feat/mesa-md-addp` · **Scope:** `handler.ts` (nuevo), `index.ts` (adaptador),
`handler_test.ts` (nuevo, 4).

**Acceptance criteria:**
- [ ] G1 — `handler.ts` no llama `serve()` ni lee `Deno.env`.
- [ ] G2 — Persiste `can_bring_main_dish: body.canBringMainDish !== false`.
- [ ] G3 — Los guardas de autorización siguen antes de toda escritura.
- [ ] G4 — Los 4 tests pasan; `deno test` **+4, 0 fallos**.
- [ ] G5 — Gate D8 sobre `F` = los 3 ficheros. Build ok.

**Test plan:** 1 `sin admin rechaza antes de escribir` · 2 `persiste false cuando el body lo
pide` · 3 `por defecto true si el campo falta` · 4 `no altera los demás campos`.

**Risks:** la función mezcla creación de usuario (`auth.admin.createUser`) con inserción de
participante. Si el seam obliga a reordenar efectos, `FINDINGS`.

**Rollback:** `git revert`.

---

## Phase P6 — Cobertura y diálogos del panel de admin

**Rama:** `feat/mesa-md-admin` · **Scope (9 ficheros** — Codex r5 S1: los tres tests de
diálogo se consolidan en uno**):**
`src/lib/mesa-abierta/coveragePresenter.ts` + test;
`MainDishCoverageBadge.tsx` + test; `GuestFoodDialog.tsx`, `HostFoodDialog.tsx`,
`ConvertHostDialog.tsx` + **un** `overrideDialogs.test.tsx`; `MesaAbiertaAdmin.tsx`.

**Acceptance criteria:**
- [ ] H1 — `buildCoverageBadge` usa `requiredMainDishes` del módulo canónico con D1.
- [ ] H2 — `isShort` ⇔ `assigned < required`, con variante `destructive`.
- [ ] H3 — Los tres diálogos renderizan la advertencia al elegir `main_course` para un
  excluido, y **ninguno deshabilita el botón de guardar** (D3).
- [ ] H4 — Los tres preservan la conducta previa de guardado (mismos callbacks).
- [ ] H5 — `fetchDinnerMatches` selecciona `can_bring_main_dish` para anfitriones e invitados.
- [ ] H6 — **Prueba diferida de D6**: con el módulo canónico importado desde código de
  producción, `npm run build` termina con éxito.
- [ ] H7 — **Verificación estática del cableado padre** (Codex r5 S2): el reporte del
  ejecutor muestra, para cada uno de los tres montajes en `MesaAbiertaAdmin.tsx`, las
  cuatro props pasadas — elegibilidad del participante, asignación seleccionada, manejador
  de cierre y callback de guardado — citando el fragmento de JSX. **Se declara como
  verificación estática, no como test.**
- [ ] H8 — Los 12 tests pasan; `vitest` **+12**, rojos sin cambios.
- [ ] H9 — Gate D8 sobre `F` = los 9 ficheros. Build ok, texto en español.

**Test plan:** `coveragePresenter.test.ts` (1–6). `MainDishCoverageBadge.test.tsx` (7–9).
`overrideDialogs.test.tsx` (10–12: cada diálogo advierte y permite guardar).

**Risks:** extraer tres diálogos de un fichero de 2227 líneas es la parte arriesgada. Son
bloques `AlertDialog` discretos (`:1350`, `:1426`, `:1453`), pero **estoy asumiendo** que
sus dependencias de estado son locales. Si no, `FINDINGS` y la fase se divide.
**Residuo declarado**: el cableado padre se verifica por lectura (H7), no por test —
probar el hijo no prueba al padre.

**Rollback:** `git revert`.

---

## Phase P7 — Copia de notificaciones y porciones

**Rama:** `feat/mesa-md-copy` · **Scope:** `supabase/functions/_shared/mesaCopy.ts` (nuevo)
+ test; `send-mesa-notifications/index.ts` (usar los constructores; **corregir**
`totalPeopleAtDinner`, `:241`); `send-mesa-whatsapp/index.ts`.

**Por qué:** con D1 una mesa puede tener 2 o 3 platos principales. El correo dice "Plato
Principal para {totalPeople} personas", lo que haría que cada portador cocinara para toda
la mesa. La porción correcta es `ceil(totalPeople / mainDishCount)`.

**Acceptance criteria:**
- [ ] I1 — `countPeopleAtDinner` incluye anfitrión, su `+1`, invitados y sus `+1` (D1).
- [ ] I2 — `describeFoodPortion('main_course', 9, 2)` describe **5** personas.
- [ ] I3 — Los acompañamientos se describen para el total de la mesa.
- [ ] I4 — Los cuatro constructores (anfitrión/invitado × email/WhatsApp) usan el
  denominador de D1 y la porción de I2, probados uno a uno.
- [ ] I5 — El correo de anfitrión incluye su porción; el WhatsApp de ambos roles incluye
  total y porción.
- [ ] I6 — Los 11 tests pasan; `deno test` **+11, 0 fallos**.
- [ ] I7 — Gate D8 sobre `F` = los 4 ficheros. Build ok.

**Test plan** — `mesaCopy_test.ts`: 1–7 (helpers) · 8–11 (los cuatro constructores).

**Risks:** corregir `totalPeopleAtDinner` cambia correos que ya se envían — corrección de
un bug real, visible para la comunidad; se registra en el ledger. **Estoy asumiendo** que
los constructores pueden devolver un modelo y dejar el HTML donde está; si no, `FINDINGS`.

**Rollback:** `git revert` + redesplegar las dos funciones.

---

## Phase P8 — Dashboard del miembro

**Rama:** `feat/mesa-md-dash` · **Scope:** `src/lib/mesa-abierta/dinnerSummary.ts` (nuevo,
el adaptador de D15) + test; `src/lib/mesa-abierta/dinnerView.ts` (nuevo, puro) + test;
`MesaAbiertaDashboard.tsx`; `MesaAbiertaDashboard.test.tsx`.

**El adaptador de RPC** (Codex r5 B4: una llamada `.rpc()` con un nombre no listado sí
produce un TS2345 nuevo, así que "sin tipar como las otras" **no** pasaba el propio gate de
la fase). Todo el contacto con la RPC se concentra en `dinnerSummary.ts`:

```ts
export interface DinnerSummary { matchId: string; totalPeople: number; mainDishCount: number }

// Única conversión de tipo del plan. get_my_dinner_summary no está en el mapa Functions
// de types.ts por D15 (añadirla introduce 4 diagnósticos en código no relacionado), así
// que el nombre se convierte aquí y la forma se valida en tiempo de ejecución.
export async function fetchDinnerSummary(monthId: string): Promise<DinnerSummary | null>
```

Valida la forma de cada campo antes de devolver; ante cualquier discrepancia devuelve
`null` y el dashboard oculta la porción.

**El mock a arreglar es el local, no el global** (verificado): la suite declara su propio
mock en `MesaAbiertaDashboard.test.tsx:24`, que anula el de `src/test/setup.ts`. Carece de
`.neq()`, modela la cadena obsoleta `.gte().order().limit().single()`, devuelve un objeto
donde el componente espera un array, y sus fixtures "futuras" son de diciembre de 2025.

**Acceptance criteria:**
- [ ] J1 — La consulta usa `guest_participant_id`; verificado por test, no por `grep`.
- [ ] J2 — El rol anfitrión carga su cena por `host_participant_id` y muestra
  `host_food_assignment`.
- [ ] J3 — **Toda** referencia a la RPC vive en `dinnerSummary.ts`
  (`grep -c "get_my_dinner_summary" MesaAbiertaDashboard.tsx` → 0), con **una sola**
  conversión de tipo, documentada.
- [ ] J4 — `fetchDinnerSummary` valida la forma y devuelve `null` ante datos inesperados.
- [ ] J5 — La porción es `ceil(total_people / main_dish_count)` para el plato principal y
  el total de la mesa para los acompañamientos; el literal
  `Para aproximadamente 10 personas` ya no existe.
- [ ] J6 — El mock local se reescribe: expone `.neq()`, modela la cadena real, devuelve
  arrays donde corresponde, y usa fechas futuras **relativas al momento de ejecución**.
- [ ] J7 — **Los 6 rojos quedan en verde** y el ejecutor declara el recuento. Si alguno
  sigue rojo, `FINDINGS` con la causa.
- [ ] J8 — `src/test/setup.ts` **no se modifica** (`git diff` vacío) y ningún test fuera de
  `MesaAbiertaDashboard.test.tsx` cambia de estado.
- [ ] J9 — Gate D8 sobre `F` = los 6 ficheros: **cero diagnósticos nuevos**, incluido
  `dinnerSummary.ts`. Build ok. `vitest` **+9 y −6 rojos**.

**Test plan** — `dinnerSummary.test.ts`: 1 `devuelve la forma tipada ante datos válidos` ·
2 **`devuelve null ante formas malformadas`, dirigido por tabla sobre los tres campos**
(`match_id` no-uuid, `total_people` no numérico, `main_dish_count` ausente, y cada uno
`null`) — Codex r6 S2: una validación que promete rechazar formas malformadas debe
ejercitarlas · 3 `devuelve null si el RPC no devuelve filas o responde con error`.
`dinnerView.test.ts`: 4 `el invitado ve su propia asignación` · 5 `el anfitrión ve
host_food_assignment` · 6 `porción dividida entre main_dish_count` · 7 `los acompañamientos
van al total de la mesa` · 8 `participante sin cena → estado pendiente` · 9 `sin resumen,
oculta la porción en vez de mostrar NaN`.

**Risks:** el diagnóstico de los 6 rojos viene de Codex; verifiqué que el mock local carece
de `.neq()` pero **no he ejecutado el arreglo**. J7 sigue siendo duro; si no se ponen
verdes, `FINDINGS`. Reescribir un mock que modela una consulta obsoleta puede destapar más
rutas rotas del componente.

**Rollback:** `git revert`. Vuelve a la ruta rota, que es el estado actual de producción.

---

## Riesgos transversales

1. **Base compartida con Life OS.** Requiere PR1 y PR2.
2. **Deriva repo ↔ remoto de migraciones.** `supabase db push` prohibido (D9).
3. **Sin CI.** Los gates son manuales; la evidencia cruda en cada reporte es lo único que
   separa "verde" de "creo que está verde".
4. **`npm test` no sirve como gate** (modo watch).
5. **Playwright** es un gate declarado en `CLAUDE.md` cuya base no está medida; ninguna
   fase lo usa como criterio.
6. **El mapa `Functions` de `types.ts` está incompleto** (siete RPC sin listar) y es la
   razón de D15. Completarlo es un workstream de limpieza aparte.
7. **Once fases para una columna booleana.** Seis existen por deuda preexistente que el
   opt-out destapa: sin seams (P3a, P5b), RLS que bloquea el agregado (D14), mock local
   roto (P8), tres caminos de override sin extraer (P6), y sin herramientas de gate (P0).
8. **El gate D8 ya no detecta regresiones fuera de los ficheros de la fase.** Es un
   compromiso consciente: el esquema global resultó tener falsos negativos peores. Los
   recuentos globales se anotan como observación en cada reporte, así que una sorpresa
   grande sigue siendo visible.

---

## Backlog

Abierto durante la ejecución. Ninguno bloquea una fase; se revisan al cerrar el workstream.

| ID | Origen | Qué es |
|---|---|---|
| **B-01** | P0 r1 | Test intermitente `src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.ph.surfaces.test.tsx`: `waitFor` de `:81` agota los 10 s con `expected [] to have a length of 1`. Aislado pasa 15/15. Visto en tres sesiones distintas (ejecutor P0 r1, Codex ronda 3, verificación PM de P0 r5). Ajeno a Mesa Abierta. |
| **B-02** | P0 r4 | Dos commits de PM (`165d704`, `f6a8cdd`) quedaron en la rama `docs/plan-audio`, ya publicada, con una copia de `LEDGER.md` a la que le faltan siete entradas. El contenido está repuesto en la rama de trabajo. Si `docs/plan-audio` se mergea, el conflicto de `LEDGER.md` se resuelve **a favor de la rama de trabajo**. Limpiarlo exige reescribir la rama de otro workstream: decisión de Brent. |
| **B-03** | P0 r5 (Codex) | La regla 4 del discriminador del gate ("exit 1 con cero diagnósticos es autocontradictorio") **deja de valer** si alguna fase cambia la invocación de ESLint a `--quiet --max-warnings 0`, que suprime warnings sin cambiar el código de salida. No alcanzable con la invocación congelada `npx eslint . -f json`. |
| **B-04** | Non-goals | `handleMoveGuest` (`MesaAbiertaAdmin.tsx:785`) y completar el mapa `Functions` de `types.ts` (D15) siguen fuera de alcance por decisión del plan. |
| **B-05** | P1 r1 | **B-01 se queda corto: flakean tres ficheros, no uno.** `CuentacuentoEditor.ph.surfaces` (T-H.4), `ph.cancel` (T-H.9) y `ph.concurrency` (T-H.5), todos bajo carga y todos verdes en aislamiento. Medido por el ejecutor (3 pasadas en `main`: 6/8/6) y reproducido por el PM (padre `05dc4ca` sin cambios de P1: **7 rojos**). Mientras dure, el criterio D8.2 «el conjunto de rojos por nombre es exactamente el de base» no es comprobable de forma fiable en **ninguna** fase — ver el SHOULD-FIX S1 de P1 r1, pendiente de decisión de Brent. (El ejecutor lo numeró B-03 por error; B-03 ya estaba ocupado.) |
| **B-06** | P1b r1 (corregido por Codex `REVIEW-P1` S1) | **Verificación de RPC por un agente.** El MCP `supabase-casa` **no** sirve: entra como `supabase_read_only_user`, fuera del ACL y no miembro de `authenticated` — y así debe seguir, es lo que A5 exige. Pero **sí existe** una vía de solo lectura: un login de revisión de la CLI enlazada asume `postgres` para resolver el `user_id`, fija la claim y asume `authenticated` para invocar dentro de `BEGIN … ROLLBACK`; Codex reprodujo A6–A8 así. **Decidir antes de P8**, que consume `get_my_dinner_summary` por `dinnerSummary.ts`: o se adopta esa vía, o una clave `service_role` en un `.env` no versionado, o pgTAP contra un Supabase local. **Conceder `EXECUTE` al usuario de solo lectura queda descartado**: debilitaría justo lo que A5 protege. |
| **B-07** | P2 r1 (verificación del PM) | **Los absolutos de Vitest de la «Aritmética de tests» están desfasados.** El 1036 se midió en `1732bee`; el padre de P2 (`main`@`981c00f`) da **1062 pass / 6 fail**, y con P2 dentro **1063 / 6**. Los 26 de diferencia los trajeron otros workstreams. Los **deltas** siguen siendo correctos y son lo que D8 exige; caducaron solo los absolutos. Se anotó la corrección al lado de la tabla en vez de reescribirla. No bloquea nada. (Fila añadida el 2026-08-08 durante el bootstrap de P3a: el Decision Log y la nota de la tabla ya citaban «Backlog B-07», pero nunca llegó a existir la fila.) |
| **B-08** | P3a (bootstrap del PM) | **Ocho diagnósticos preexistentes de `create-mesa-matches/index.ts` viajan a `handler.ts` con el código que P3a mueve**: `TS18046` (`error` de tipo `unknown`), 5× `TS7006` (`g`, `guest`, `j` con `any` implícito) y 2 `no-unused-vars` (`TARGET_GUEST_SIDE_FOR_DINNER`, `count`). P3a los mueve **verbatim y a propósito** — repararlos dentro del movimiento haría indiferenciable el bloque movido y volvería incomprobable la regla dura de la fase («conducta idéntica»). Arreglarlos es trabajo propio: los 5 `TS7006` nacen de que el cliente de Supabase no está tipado, así que la reparación honesta es declarar una interfaz `Participant`, no salpicar `any`. **Candidata natural: P4**, que ya toca `handler.ts`. No bloquea ninguna fase; el gate de P4 partirá de la línea base `(0)(0)(2)(6)` que deja P3a. **CORREGIDO 2026-08-08 tras medir P3a r1:** la cuenta real en la punta es `(0)(1)(2)(8)`, no `(0)(0)(2)(6)`, y **solo 6 de los 8 `deno check` son desplazamiento**. Los otros tres son **nuevos y los causó mi propia prescripción**, no el movimiento: 2× `TS7006` en `p` (`handler.ts:144–145`) porque `HandlerDeps.supabase: any` elimina el tipado contextual que `createClient(...)` daba a `participants` —un `any` contextual no dispara `noImplicitAny`, uno desnudo sí— y 1× `@typescript-eslint/no-explicit-any` (`handler.ts:26`) porque `// deno-lint-ignore no-explicit-any` silencia `deno lint` pero **no** ESLint. Los tres son consecuencia inevitable del seam inyectable que exige D13, y `_shared/adminAuth.ts:13` —el exemplar que el plan cita— carga el mismo error de ESLint. Se aceptan declarados; la línea base de P4 es **`(0)(1)(2)(8)`**. **ENCOGIDA 2026-08-09 al cerrar P3b: la mitad de ruta de escritura ya no existe.** Al tipar `matching.ts` sus entradas y su retorno —cosa que D1e obliga— los cinco `TS7006` de `:333`, `:400`×2, `:419` y `:441` **desaparecieron por construcción**, sin que nadie los tocara, y el `no-unused-vars` de `TARGET_GUEST_SIDE_FOR_DINNER` se desplazó a `matching.ts:98`. Quedan **tres**, no once: `:31` (`no-explicit-any` de `SupabaseLike`), `:290` (`count`) y `:343` (`TS18046` sobre `error`). **La línea base real de P4 sobre `handler.ts` es `(0)(1)(1)(3)`**, confirmada por el PM y por Codex de forma independiente, con los totales del proyecto corroborándolo (`deno check` 48 → 43, `deno lint` 92 → 92). |
| **B-09** | P3a r1 (verificación del PM) | **`eslint.config.js` no ignora `supabase/.temp/`**, donde `supabase start` deja el runtime local generado. En un checkout que haya levantado el entorno local (lo introdujo el workstream AUDIO en E-infra) eso son **186 diagnósticos fantasma** en un solo fichero generado, `supabase/.temp/start-secrets/…/main/index.ts`: el total de ESLint pasa de 160 a 347 sin que cambie una línea de código propio. Medido en P3a r1, donde costó un hallazgo mal atribuido. `eslint.config.js:8` ya ignora `dist` y `.claude/worktrees/**`; añadir `supabase/.temp/**` es una línea. Recordatorio de por qué D8.5 trata los totales como observación y no como criterio: **no son portables entre checkouts**. Los recuentos por fichero sí lo son. **Afinado 2026-08-09 (P3b):** en un worktree limpio Codex midió **161**, no 160, idéntico en padre y punta — así que además del ruido de `supabase/.temp/` hay **+1** estable respecto al número anotado en la línea base de `1732bee`. Sigue sin ser criterio y sigue sin atribuirse a ninguna fase, pero conviene saber que el 160 del plan tampoco es reproducible hoy en un checkout limpio. |
| **B-11** | P3b — revisión de Codex (S1) | **Los 8 tests puros de `matching_test.ts` no fijan los dos `shuffle` iniciales.** Codex sustituyó `matching.ts:76–77` por copias simples (`[...hosts]`, `[...guests]`) y **la suite siguió en 8/0**; el PM lo reprodujo. Esa mutación cambia los desempates entre anfitriones, el orden de invitados y la secuencia posterior de `pick`, pero el test de determinismo solo compara dos ejecuciones **entre sí** y los otros siete afirman sobre todo recuentos, con fixtures homogéneas donde una permutación es inobservable. **No bloqueó P3b** porque el movimiento fue byte a byte idéntico y los **diez goldens de `handler_test.ts` sí** cazan la mutación de extremo a extremo (la comida depende del orden de invitados). La reparación es barata: reforzar uno de los ocho con la traza esperada de argumentos a `pick`, o con identidades esperadas tras el shuffle. **Sitio natural: P4**, que ya añade 6 tests a ese fichero y no está sujeto a la allowlist de goldens (esa rige `handler_test.ts`). Contraste útil para calibrar la suite: la mutación del PM sobre el aliasing sí la tumbó, de 8/0 a 4/4. **CERRADA 2026-08-10 al cerrar P4, sin haberla reparado a propósito.** Codex repitió la mutación sobre la punta de P4: sustituir los dos `shuffle` iniciales por copias simples pone en rojo `el reequilibrio se refleja en los invitados` y `se respeta el mínimo tras el reequilibrio` (**26/2**). Los seis tests que P4 añadió afirman **identidades** —quién se sienta dónde tras el swap— y no solo recuentos, así que fijan el efecto observable que los ocho de P3b dejaban suelto. La decisión de la ronda de bootstrap de **no** meter B-11 en P4 resultó gratuita: el alcance propio de la fase la cerró. |
| **B-10** | P3a — revisión de Codex | **Ocho tests de `usePresentationState` fallan por `localStorage` ausente, y solo en algunos checkouts.** Codex midió Vitest en **1055 pass / 14 fail** tanto en la punta como en el padre, con idénticas identidades; el PM había medido **1063 / 6** en el padre en otro worktree. Mismo commit, distinto entorno — los 6 conocidos de `MesaAbiertaDashboard` más estos 8. **No es el flake de B-05** (`CuentacuentoEditor.ph.*`), es otra cosa y tiene causa nombrada. La regla del padre de D8.2 lo dirimió exactamente como fue diseñada. Junto con **B-09**, deja una lección para el resto del plan: **de las dos sorpresas de medición de P3a, ninguna era código y las dos eran el entorno.** Conviene decidir si el entorno de Vitest debe proveer `localStorage` antes de que otra fase lo tropiece. |
| **B-13** | P4 — revisión de Codex (S1) | **Ningún test del handler fija el cruce de `tablesWithShortfall` hasta la respuesta HTTP.** Codex cambió `handler.ts:346` por `tablesWithShortfall: []` en una copia aislada y los 28 tests de `create-mesa-matches` siguieron en **28/0**; el PM lo reprodujo. La mutación viola E2 y D4 —ocultaría a P6, P7 y P8 un déficit que el plan puro sí calculó— y **el `console.warn` de déficit tampoco lo afirma nadie**. No bloqueó P4 porque el código revisado es correcto y `matching_test.ts` sí cubre el cálculo (`reporta shortfall`); lo que falta es el tramo del borde. Reparación: una mesa sin swap posible en el doble del handler, afirmando el elemento **no vacío** de `results.tablesWithShortfall` y que el warning lleva solo ids y números. **No tiene sitio natural**: ninguna fase que queda declara `create-mesa-matches/handler_test.ts` en su `F` —P5a y P6 son frontend, P5b es `admin-add-participant`, P7 son las dos funciones de notificación, P8 el dashboard—, así que **sin una decisión explícita de Brent esto no lo recoge nadie**. Recomendación del PM: ensanchar la `F` de P7 con `handler.ts` y `handler_test.ts` y arrastrar también el comentario obsoleto de `handler.ts:11`. |
| **B-14** | P4 — revisión de Codex (verificación de bordes) | **Asimetría de robustez ante una `pick` fuera de contrato.** `_shared/mainDish.ts` acota su índice defensivamente (`boundedIndex`, que además caza `NaN`); el `shuffle` de `matching.ts` —heredado verbatim de `index.ts`— no, y una `pick` que devuelva 999 termina en `TypeError` dentro del asiento. **No es infracción de D11**, cuyo contrato exige un entero en `[0, n)` y cuyo proveedor de producción (`Math.floor(Math.random() * n)`) lo cumple; por eso Codex no lo marcó ni siquiera como SHOULD-FIX. Se anota porque el día que alguien inyecte una `pick` de test mal formada, el fallo saldrá en el sitio menos evidente. |

---

## Decision log

| Date | Decision | Rationale | Raised by |
|---|---|---|---|
| 2026-08-06 | Cuota `ceil(personas/5)` (D1) | Lectura estricta de "al menos uno por cada 5" | Brent |
| 2026-08-06 | `can_bring_main_dish DEFAULT TRUE` (D2) | Sin backfill para las 31 filas | PM |
| 2026-08-06 | El anfitrión es el primer candidato (D7) | Cocina en su casa. Reversible | PM |
| 2026-08-06 | `index.ts` como adaptador (D13); P3a/P3b y P5a/P5b divididas | Codex r1 B2, r2 B2, r3 B7: `serve()` al importar | Codex Sol |
| 2026-08-06 | `stress-test.sql` prohibido como gate (D12) | Codex r1 B3 | Codex Sol |
| 2026-08-06 | PR1 como prerrequisito bloqueante | Codex r1 B7 | Codex Sol |
| 2026-08-06 | Brent autoriza superar el tope de rondas del SOP §1.5 | Prefiere el plan completo a recortar alcance | Brent |
| 2026-08-06 | D14: agregados en vivo vía `SECURITY DEFINER`, no persistidos | Codex r3 B2; contrato SQL cerrado en r5 | Codex Sol + PM |
| 2026-08-06 | D15: la RPC no entra en el mapa `Functions` | Medido por el PM y confirmado por Codex: introduce 4 diagnósticos reales en `songUsageService.ts` | PM |
| 2026-08-06 | **Se elimina la exigencia de "dos implementaciones byte-idénticas"; D5 pasa a congelar ocho garantías en vez de un procedimiento** | Invención mía de la rev 3, no un requisito. Generaba r5-B1, B2 y B3: especificar un algoritmo en prosa con precisión ejecutable es trabajo sin fondo. Habrá una sola implementación | Brent (decisión), PM (diagnóstico) |
| 2026-08-06 | **Se elimina el esquema global de identidad de diagnósticos; D8 pasa a "cero diagnósticos nuevos en los ficheros de la fase"** | Codex r5 B5 demostró 62 cubos de colisión. Un detector sólido sobre 1041 diagnósticos preexistentes es un proyecto propio, ajeno a esta funcionalidad | Brent (decisión), Codex Sol (hallazgo) |
| 2026-08-06 | **P8 consume la RPC por un adaptador local con una única conversión documentada y validación en runtime** | Codex r5 B4: una llamada sin tipar produce un TS2345 nuevo, así que no pasaba el gate de su propia fase | Codex Sol |
| 2026-08-06 | Las seis declaraciones de `types.ts` se fijan literalmente (`string \| null`) | Codex r5 S3: usar el enum de comida produce un TS2322 nuevo | Codex Sol |
| 2026-08-06 | **Plan congelado con `VERDICT: PASS` de Codex (ronda 7)**; se enmienda la condición de congelación: el PASS congela el **texto**, y PR1/PR2 pasan a bloquear la **ejecución de P1**, no la congelación | Eran dos cosas distintas mezcladas en un solo campo de META. Congelar el texto permite escribir los prompts de ejecutor mientras Brent resuelve las autorizaciones | PM |
| 2026-08-06 | **PR1 CONCEDIDO.** `mesa_abierta_*` y `mesa_abierta_matches` pueden alterarse | Auditoría del PM sobre las 128 tablas del proyecto: la premisa de base compartida es **cierta** (11 tablas de Life OS conviven ahí), pero la regla literal de `CLAUDE.md:77` estaba obsoleta — solo 61 de 128 tablas son `church_*`, y los esquemas de música, RBAC y finanzas ya habían enviado fuera de ese prefijo. Para `mesa_abierta_*` en concreto: **cero** claves foráneas desde tablas ajenas, **cero** vistas o reglas dependientes, y **cero** referencias en el código de Life OS. `CLAUDE.md:77` se reescribe para nombrar las 11 tablas de Life OS en vez de un prefijo | PM (auditoría), Brent (concesión) |
| 2026-08-06 | **PR2 CONCEDIDO.** Autorización para aplicar la migración de P1 a la instancia compartida | Autorización explícita de Brent, distinta de cualquier aprobación de merge | Brent |
| 2026-08-06 | **Brent autoriza una cuarta ronda de ejecutor en P0**, superando el tope de 3 del SOP §1.5 | Los dos topes cayeron a la vez (ejecutor 3/3, Codex 2/2) sobre el mismo detector de "la herramienta no corrió". Brent prefiere arreglarlo a retirarlo. El arreglo es acotado y Codex enumeró los casos exactos | Brent |
| 2026-08-06 | **P0 pasa de 3 a 4 ficheros: se añade `scripts/gates/selftest.sh`** | Tres rondas seguidas han regresado en el mismo bloque de clasificación, y cada regresión solo se ha detectado con sondas manuales ad hoc. Un self-test commiteado convierte el contrato del discriminador en algo reejecutable por cualquiera en segundos. No es un requisito nuevo: es el test de una conducta ya decidida. Sigue dentro del tope de 10 ficheros del SOP §1.3 | PM |
| 2026-08-07 | **Brent autoriza superar el tope de rondas de Codex del SOP §1.5 en P0** (y las rondas de ejecutor que hagan falta): "sigue con más rondas, tenemos que terminarlo" | Las dos revisiones de Codex encontraron cada una un defecto real que el PM no había visto, y el propio PM cometió además un error de rama en la ronda 4. Con ese historial, cerrar la fase sin revisión externa sería confiar en el eslabón que ya ha fallado. Prefiere terminar P0 bien a cerrarla dentro del tope | Brent |
| 2026-08-08 | **D9 se cumple por aplicación manual desde el editor SQL, no por `apply_migration`** | Las dos puertas del canal del agente están **probadas** cerradas: el clasificador de permisos de Claude Code (P1 r1) y el `--read-only` del servidor MCP `supabase-casa` (P1 r2, error verbatim `Cannot apply migration in read-only mode`). La tercera vía, `supabase db push`, la prohíbe D9 por una razón concreta y no burocrática: arrastraría `20260612000000` y `20260612000001`, sin aplicar y **fuera** de lo que PR2 autorizó. El fondo de D9 —aditivo, sin `db push`, una sola aplicación atómica, tras PR1 y PR2— se respeta entero; solo cambia el mecanismo, y hacia uno donde la escritura la ejecuta Brent | Brent (decisión), PM (diagnóstico) |
| 2026-08-08 | **P1 se parte en P1a (ficheros) y P1b (aplicación + A3–A8); se añade PR3 como tercera puerta humana** | Tres rondas de ejecutor agotadas con **cero hallazgos contra el código**: las tres murieron contra el canal de escritura, y A3–A8 no llegaron a ejecutarse ni una vez. El plan modeló PR1 y PR2 como puertas de Brent pero trató la aplicación misma como trabajo de agente — autorizar un cambio y poder ejecutarlo no son lo mismo. Partir no invalida ninguna fase posterior ni cambia un solo criterio, y desbloquea P2/P3a/P3b, que nunca dependieron de P1 | PM (diagnóstico), Brent (decisión) |
| 2026-08-08 | **D8 punto 2 se enmienda**: de «el conjunto de rojos por nombre es exactamente el de base» a «los rojos atribuibles a `F` no crecen; un rojo fuera de `F` se dirime reejecutando en el commit padre» | El criterio anterior no es comprobable: el PM midió **7 rojos en el propio commit padre**, sin cambios de ninguna fase, por el flake de B-05. Un criterio insatisfacible se convierte en juicio discrecional en cada fase, que es peor que no tenerlo. La regla del padre es la misma disciplina que el punto 4 ya usa para diagnósticos, y no se puede burlar: un rojo causado por la fase no se reproduce en el padre | PM (S1 de P1 r1; Brent delegó la decisión) |
| 2026-08-08 | **PR3 incluye escribir la fila de `schema_migrations` a mano**, como sentencia aparte | El editor SQL no la escribe. Sin ella el remoto tendría la columna y la función pero no la versión, mientras el repo sí tiene el fichero: cualquier reconciliación futura la vería pendiente. El registro de migraciones debe reflejar la realidad. Es un `insert … on conflict do nothing`, aditivo e idempotente, y **no** se mete en el fichero de la migración, que sigue byte a byte igual al contrato congelado | PM (Brent delegó la decisión) |
| 2026-08-08 | **Los absolutos de Vitest de la «Aritmética de tests» se anotan como desfasados; los deltas se conservan** | El 1036 se midió en `1732bee`. El PM midió el padre de P2 (`main`@`981c00f`): **1062 pass / 6 fail**. Los 26 de diferencia los trajeron otros workstreams, no este plan. Reescribir los deltas sería falsear el trabajo pendiente; borrar la tabla de base perdería un dato histórico correcto. Se añade la corrección al lado. No desbloquea ni bloquea nada: D8 no se dirime por absolutos. Backlog **B-07** | PM (verificación de P2 r1) |
| 2026-08-08 | **El comando de test de Deno pasa a `deno test --allow-all --no-check .`**, tanto en el punto 3 de D8 como en el C6 de P3a | `deno test` type-checkea su grafo de importación. La suite estaba verde con `index.ts` cargando 6 diagnósticos **solo porque ningún test lo importaba**; en cuanto P3a hace que `handler_test.ts` importe `handler.ts` —el objeto entero de la fase— esos diagnósticos entran en el grafo y `deno test` **se niega a ejecutar la suite completa**, devolviendo cero tests en vez de 0 fallos. Así, «desplazar los diagnósticos de B-08» y «`deno test` → 438 passed» no podían ser ciertas a la vez. De las tres salidas, ésta es la única que no cuesta nada: **`--no-check` no reduce la cobertura de tipos**, porque el paso 4 de D8 ya corre `deno check .` sobre el árbol entero y **enumera los `_test.ts`** (verificado: `deno check create-mesa-matches/handler_test.ts` destapa por sí solo los 8 errores del handler). El type-check de `deno test` era duplicado, no adicional. Las alternativas costaban mucho más: adelantar B-08 destruye la propiedad de diff limpio que es lo único que hace verificable la regla dura de P3a, y partir la fase deja el seam sin tests. **Causa raíz: fallo de bootstrap del PM** — midió `deno check` por fichero y `deno test` en el padre, pero nunca el caso «un test importa un fichero con errores de tipo», que era justo lo que su decisión de desplazamiento iba a provocar | Ejecutor P3a r1 (hallazgo F-1), PM (diagnóstico y medición), Brent (decisión) |
| 2026-08-10 | **P5a pasa de 10 a 12 tests y de `vitest +10` a `+12`; se añaden F9 y F10** | La ronda 1 quedó correcta en el código pero con la cláusula central de F2 —«su estado llega al builder»— verificada **solo por lectura**. Medido por el PM como mutación real: sustituir `cannotBringMainDish` por `false` en la llamada a `buildParticipantInsert` deja **los diez tests verdes y cero diagnósticos de `tsc`**, es decir, la única guarda del camino principal de la funcionalidad no existía. Lo mismo, menor, con `resetForm` (B-17). **Por qué se enmienda en vez de mandarlo al backlog:** `MesaAbiertaSignup.tsx` y `AddParticipantDialog.tsx` aparecen **solo** en el alcance de P5a en todo el PLAN — ninguna fase posterior los vuelve a tocar, así que «al backlog» aquí significa «sin dueño para siempre», que es el residuo que P4 ya dejó con B-13. Los dos ficheros están hoy en la `F` de P5a, la rama está abierta y los mocks ya están escritos y probados. Se acota a dos tests y **no** se toca B-15, que sí tiene casa en P6 | PM (medición y propuesta), sesión de verificación de Claude (hallazgo S1/S2), Brent (decisión) |

---

## Aritmética de tests (revisión 7 — verificada por Codex en la ronda 7)

Con las tres garantías nuevas de D5, que llevan P2 de 16 a 19 tests Deno:

- **Deno**: P2 **+19** · P3a +10 · P3b +8 · P4 +10 · P5b +4 · P7 +11 = **+62** →
  409 + 62 = **471 pass / 0 fail**.
- **Vitest**: P2 +1 · P5a **+12** · P6 +12 · P8 +9 = **+34** → 1036 + 34 = 1070, más los
  6 rojos reparados por P8 = **1076 pass / 0 fail**.
  (P5a enmendada de +10 a +12 el 2026-08-10, Decision Log.)

> **Los absolutos de Vitest están desfasados desde el 2026-08-08** (Decision Log; backlog
> **B-07**). Los **deltas siguen siendo correctos y son lo que D8 exige**; lo que ha caducado
> es la base de la que parten. El 1036 se midió en `1732bee`; el PM midió el padre de P2
> (`main`@`981c00f`) y da **1062 pass / 6 fail (80 ficheros)** — el repo ganó 26 tests por
> trabajo de otros workstreams, no de este plan. Con eso, la proyección real es
> `1062 + 32 = 1094`, y `1100 pass / 0 fail` tras las reparaciones de P8. **La base de Deno
> (409) no se ha movido y sigue siendo exacta.** Ninguna fase se dirime por estos absolutos:
> D8 punto 2 compara rojos atribuibles contra el padre, y el punto 5 registra los totales
> como observación. Se corrigen aquí en vez de reescribirlos para no perder de vista que la
> tabla de la línea base (`1732bee`) es un dato histórico correcto, no un error.

## Respuesta a la revisión de Codex (ronda 6)

**Los dos BLOCKING se aceptan y quedan corregidos; ninguno resucita una exigencia retirada.**

- **B1** — D5 pasa de 8 a **11 garantías**. Las tres que faltaban son reales: sin la 8, una
  implementación puede asignar de menos y limitarse a reportar más déficit; la 6 estaba
  solo como premisa del argumento de terminación, no como propiedad comprobable; y la 9
  —conservación del conjunto de participantes— cubre una clase de fallo que **este mismo
  código ya tuvo** (el comentario de `index.ts:305` documenta la corrección de "un
  invitado en dos cenas").
- **B2** — el gate compara ahora **mensajes crudos completos contra la fase padre
  inmediata**, no recuentos por código contra la base. El ejemplo de Codex es decisivo:
  `MesaAbiertaAdmin.tsx` tiene seis TS2339 con cuatro mensajes distintos, así que un
  criterio por código deja pasar una sustitución. Z5 gana un **canario de sustitución**
  además del de adición. Y el recuento de `F` en P5a se corrige de 8 a **9** — era un
  error mío de conteo.
- **S1** — se retira la afirmación de que los tests "demuestran" las garantías. Se
  sustituye por lo que realmente hay: verificador de invariantes reutilizable aplicado a
  cada movimiento, tabla de fixtures adversariales, y revisión de código del invariante del
  bucle para la garantía 6.
- **S2** — el test 2 de `dinnerSummary` pasa a estar dirigido por tabla sobre los tres
  campos, más la respuesta de error del RPC.
- **N1** — la frase de P4 pasa a "pasan sin modificación"; la de P0 se conserva porque es
  reproducibilidad de una reejecución, no la exigencia retirada.

---

## Respuesta a la revisión de Codex (ronda 5)

**B1, B2, B3 y B5 se retiran junto con las exigencias que los generaban.** Los cuatro eran
correctos como crítica de lo que yo había escrito; el error estaba en haberlo escrito. D5
congela ahora ocho garantías comprobables por test en vez de un procedimiento, y D8 se
acota a los ficheros de cada fase. La aritmética lo confirma: esta revisión es más corta
que la anterior.

**B4, S1, S2, S3 y N1 se aceptan y se corrigen**: adaptador de RPC en P8, P6 baja a nueve
ficheros, la verificación estática de P6 enumera las cuatro props de cada montaje, las seis
declaraciones de `types.ts` se escriben literalmente, y el inventario de RPC sin tipar pasa
de cinco a siete.

Se conserva todo lo que la ronda 5 dio por cerrado: el contrato SQL de D14, P0, la
descomposición en once fases, el diferimiento de la prueba de `vite build` a P6, y la
aritmética de tests.

---

## Estado del plan

**CONGELADO — revisión 7, 2026-08-06.**

Trayectoria de hallazgos BLOCKING a lo largo de siete rondas: **7 → 7 → 3 → 3 → 5 → 2 → 0**.
El punto de inflexión fue la ronda 5→6: cuatro de los cinco bloqueantes de entonces
atacaban dos exigencias que el propio PM había inventado —equivalencia byte-idéntica entre
implementaciones y un esquema global de identidad de diagnósticos— y que nadie había
pedido. Retirarlas, con autorización de Brent, fue lo que desbloqueó el plan.

**PR1 y PR2 concedidos el 2026-08-06.**

**Enmendado el 2026-08-08** (**cuatro** filas nuevas en el Decision Log — PR3 va combinada con la de la partición, no aparte; el recuento «cinco» de una redacción anterior era erróneo, Codex `REVIEW-P1` N1; el resto del texto sigue
congelado en la revisión 7). Estado real:

- **P0 DONE** 2026-08-07 (`09a69d7`), Codex PASS en su cuarta ronda.
- **P1a y P1b DONE** 2026-08-08 (`9cc637b`). **`CODEX REVIEW — UPGRADE P1 FINAL` = PASS**,
  cero BLOCKING (`reviews/REVIEW-P1.md`). Codex verificó A1–A11 por su cuenta —**incluidas
  llamadas RPC autenticadas en vivo**, que reprodujo por una vía que el PM había declarado
  inexistente—, los gates padre/punta a exit 0 con `tsc 1041 → 1039` (dos eliminados, cero
  añadidos), build ok, Vitest **1036/6 exactamente la base**, Deno 409/0, y el ACL,
  `search_path` vacío y agregados en vivo de producción. Sus dos hallazgos no bloqueantes
  —S1 (mi relato del canal de verificación era demasiado amplio) y N1 (cuatro filas de Decision
  Log, no cinco)— **quedan corregidos en este mismo documento**.
- **Migración aplicada a producción** el 2026-08-08 por Brent desde el editor SQL (**PR3**), con
  su fila en `schema_migrations`. `20260612000000` y `20260612000001` **siguen sin aplicar**:
  la aplicación fue quirúrgica, que es exactamente lo que D9 protege.
- **Siguiente paso: P2** (`feat/mesa-md-alloc`), y con ella P3a y P3b. Revisadas a la luz de lo
  construido, **no necesitan enmienda**. Dos notas de uso, no cambios: (a) el padre de P2 pasa a
  ser `main` con P1 dentro, así que su línea base es **`tsc = 1039`**, no 1041, y como sus tres
  ficheros son nuevos el gate se reduce a «los tres ficheros nuevos no introducen ni un
  diagnóstico»; (b) el criterio B7 («rojos sin cambios») se lee ya bajo el **D8.2 enmendado**,
  que es justo lo que impide que el flake de B-05 lo haga incumplible.
