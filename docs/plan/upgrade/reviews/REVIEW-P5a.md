## CODEX REVIEW — P5a round 1

VERDICT: PASS

Revisado `feat/mesa-md-form` @ `1f566d4` (único commit de código: `7bb090e`) contra su
padre real `main` @ `62e9158`. Node v22.22.0. Worktrees dedicados: `casa-upgrade`
(punta) y `casa-p2-review` (padre), ambos limpios antes y después.

BLOCKING:

- Ninguno.

SHOULD-FIX:

- [S1] **El cableado asistente → constructor no lo cubre ningún test, y es la conducta
  central de la fase** — `src/components/mesa-abierta/MesaAbiertaSignup.tsx:125` —
  Se pidió nombrar un cambio que los diez tests no cacen, distinto del ya encontrado
  (B-15). Éste es más central que B-15. Sustituí `cannotBringMainDish,` por
  `cannotBringMainDish: false,` en la llamada a `buildParticipantInsert`: **compila sin
  un solo diagnóstico nuevo y los diez tests siguen en 10/10**. Con esa mutación, el
  switch se pinta, se enciende, y el resumen del paso 5 sigue anunciando «No traeré el
  plato principal» — pero la fila insertada lleva `can_bring_main_dish: true` y **ningún
  miembro puede excluirse jamás**. Es exactamente el estado previo a P5a, con la UI
  mintiendo encima.
  El motivo del hueco es estructural: los tests 1–4 prueban el constructor con entradas
  fabricadas, y los tests 5–7 nunca llegan a enviar el formulario —`advanceToStep5()` se
  detiene en «¡Casi listo!»— porque el fichero no mockea el cliente de Supabase (los
  otros dos ficheros de test sí lo hacen, y por eso el 9 y el 10 sí cierran su costura).
  Entre el estado del switch y el argumento del constructor no hay más garantía que la
  lectura. **F2 se cumple, pero su tercera cláusula («su estado llega al builder») está
  verificada solo por lectura**, igual que F3 lo estaba en B-15.
  Mutación ejecutada sobre el árbol y revertida; árbol limpio verificado.
  No se repara aquí: el plan congela esta fase en diez tests y `vitest +10`. Su sitio
  natural es **P6**, junto a B-15 — son el mismo defecto de forma en las dos costuras que
  quedaron sin montar (miembro→BD y admin→diálogo).

- [S2] **El reseteo del switch entre altas manuales tampoco está cubierto** —
  `src/components/mesa-abierta/AddParticipantDialog.tsx:46` — Borré
  `setCannotBringMainDish(false)` de `resetForm()` y el test 10 siguió verde.
  `resetForm()` se llama en el éxito (`AddParticipantDialog.tsx:148`), así que sin esa
  línea el switch sobrevive al alta: un admin que inscribe a alguien excluido y a
  continuación inscribe a otra persona **excluye también a la segunda sin tocarlo**.
  El código actual es correcto; lo que falta es el test que lo fije. Menor que S1 porque
  el modo de fallo exige dos altas seguidas, pero es la misma familia de corrupción
  silenciosa. Mutación ejecutada y revertida.

NITS:

- [N1] **Hay rojos por carga fuera del catálogo de B-05.** Mi primera corrida de la punta
  (bajo carga, 606 s) dio **11 fallos / 1097**: los 6 de `MesaAbiertaDashboard` más
  `CuentacuentoEditor.pg.cancel`, `ph.cancel`, `ph.concurrency`, `ph.persist` **y**
  `src/lib/cuentacuentos/__tests__/pbBaseCapture.test.tsx`. Dos observaciones para el
  backlog: (a) B-05 nombra tres ficheros `ph.*` y aquí flakearon **cinco** ficheros, uno
  de ellos `pg.*`; (b) `pbBaseCapture` **no es de la familia B-05** — no revienta por
  timeout sino por una comparación de fixture (`PB G6 — 2 diferencia(s)` en
  `editor.cover.success` y `editor.end.existingUrl`), y no está registrado como flaky en
  ningún sitio; el único registro que existe, `docs/plan/reviews/PB-review-2.md:98`, lo
  da verde. Se dirimió como manda D8.2 y no bloquea nada (evidencia abajo), pero conviene
  que el workstream CUENTOS sepa que ese fichero cede bajo carga.

- [N2] Coincido con el N2 del PM: el renglón «No traeré el plato principal» del resumen
  del paso 5 usa el mismo `Check` verde que los renglones de confirmación
  (`MesaAbiertaSignup.tsx:444`). Es coherente con el patrón «esto registramos» y el
  español es correcto (D10 cumplido); un icono neutro leería mejor. Preferencia, no
  defecto.

- [N3] La fase añade 4 ficheros de test a una suite que ya flakea bajo carga. No es un
  defecto de P5a —los diez tests son rápidos y verdes en aislamiento (10/10 en ~2 s)—
  pero cada fase que añade ficheros paga un poco más de ese presupuesto. B-05 lleva cinco
  fases sin dueño y sigue sin tenerlo.

NOTES ON THE PLAN ITSELF:

- **La desviación del ejecutor es correcta y la firma del prompt era BLOCKING.** No lo di
  por bueno: apliqué la firma prescrita en §3.1 (`status: string` en el retorno de
  `buildParticipantInsert`) y medí. Aparece
  `src/components/mesa-abierta/MesaAbiertaSignup.tsx(113,17): error TS2769: No overload
  matches this call.`, y el total del proyecto pasa de **1039 a 1040**. Diagnóstico nuevo
  en un fichero de `F` ⇒ BLOCKING bajo D8.4. `status: 'pending'` lo devuelve a 1039.
  El ejecutor midió antes de decidir y lo declaró; el PM lo corroboró. Nada que añadir
  salvo la recomendación que el PM ya se hizo: **P5b, P6 y P8 no deberían prescribir tipos
  de retorno que nadie haya compilado.**

- **El absoluto de Vitest del prompt (§6.1: 1073/6) era inalcanzable**, y no por culpa del
  ejecutor: entre bootstrap y ejecución `main` absorbió P4 (`949b40a`) y
  `phase/E3a-slug` (`62e9158`). Confirmo la lección que el ledger ya recoge: **en este
  repo se cita el SHA del padre y el delta, nunca el absoluto.** Los prompts de P5b, P6,
  P7 y P8 deberían escribirse ya así.

---

## EVIDENCIA

### 1. Polaridad (D2) — los cuatro sitios de conversión, leídos contra la tabla

| Sitio | Código | Switch OFF | Switch ON |
|---|---|---|---|
| `participantPayload.ts:61` | `can_bring_main_dish: !input.cannotBringMainDish` | `true` | `false` |
| `EditParticipantDialog.tsx:105` (`.update()`) | `can_bring_main_dish: !cannotBringMainDish` | `true` | `false` |
| `EditParticipantDialog.tsx:62,75` (init) | `participant.can_bring_main_dish === false` | `undefined`/`true` ⇒ OFF | `false` ⇒ ON |
| `AddParticipantDialog.tsx:137` (body) | `canBringMainDish: !cannotBringMainDish` | `true` | `false` |

Los tres `useState(false)` (`MesaAbiertaSignup.tsx:46`, `EditParticipantDialog.tsx:62`,
`AddParticipantDialog.tsx:34`) fijan el ancla que pedía el prompt: **quien no toca nada
aterriza en `can_bring_main_dish: true`**, idéntico al DEFAULT de la columna y a las filas
que hoy existen en producción. Ningún test fija el default en `false`. Sin inversiones
cruzadas.

Un detalle que el prompt no pedía y que conviene dejar escrito: en el asistente, el switch
**no está dentro de la rama `rolePreference === 'host' ? … : …`** sino en el bloque común
que hay debajo (`MesaAbiertaSignup.tsx:345–387`). Los anfitriones lo ven. Importa porque
`host_food_assignment` puede valer `'main_course'`: si el switch hubiera caído dentro de la
rama de invitado, el excluido más probable de todos no habría podido excluirse.

### 2. Criterios de aceptación F1–F8, contra el código

| ID | Veredicto | Dónde se sostiene |
|---|---|---|
| F1 | met | `participantPayload.ts:61`; tests 1–2 |
| F2 | met | Switch en `case 3` (`MesaAbiertaSignup.tsx:373–387`), `useState(false)` en `:46`, pasado en `:125`. **La tercera cláusula solo por lectura → S1** |
| F3 | met | `select` en `MesaAbiertaAdmin.tsx:239`, `interface` en `:60`; init del diálogo en `:62`/`:75`. Costura completa: `fetchParticipants` hace `{...participant}` (`:275`) y `:2087` pasa esa misma fila a `setEditParticipant`, consumida en `:1280` |
| F4 | met | `AddParticipantDialog.tsx:137`; test 10 exige el nombre y prohíbe los dos erróneos |
| F5 | met | `MesaAbiertaSignup.tsx:442–449`, condicionado a `cannotBringMainDish`; tests 6 y 7 |
| F6 | met | `EditParticipantDialog.tsx:105`; test 9, en ambas polaridades |
| F7 | met **en el delta** | +10 exacto en las cuatro corridas (abajo). El absoluto de §6.1 había caducado |
| F8 | met | Gate D8 sobre los nueve ficheros, comparado contra el padre real; build exit 0 |

### 3. Alcance — exactamente nueve ficheros

```
git diff --stat 62e9158 7bb090e
 src/components/mesa-abierta/AddParticipantDialog.tsx                        |  20 ++
 src/components/mesa-abierta/EditParticipantDialog.tsx                       |  22 ++
 src/components/mesa-abierta/MesaAbiertaAdmin.tsx                            |   4 +-
 src/components/mesa-abierta/MesaAbiertaSignup.tsx                           |  52 ++++---
 src/components/mesa-abierta/__tests__/AddParticipantDialog.mainDish.test.tsx |  74 +++++++
 src/components/mesa-abierta/__tests__/EditParticipantDialog.mainDish.test.tsx| 116 ++++++++++
 src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx   |  76 +++++++
 src/lib/mesa-abierta/__tests__/participantPayload.test.ts                   |  75 +++++++
 src/lib/mesa-abierta/participantPayload.ts                                  |  64 ++++++
 9 files changed, 489 insertions(+), 14 deletions(-)
```

Sin `types.ts`, sin `supabase/functions/**`, sin migración, sin base de datos, sin
`* 2.tsx`, sin diálogo de anulación ni insignia de cobertura (P6). `MesaAbiertaAdmin.tsx`
recibe **exactamente dos** ediciones: el campo en el `interface` y la columna en el
`select`. Confirmado también que `EditParticipantDialog` solo se monta desde
`MesaAbiertaAdmin.tsx:1271`, así que B-15 cubre la única costura de ese tipo que existe.

`buildParticipantInsert` no pierde ningún campo respecto del `.insert()` original: los
mismos 12 más `can_bring_main_dish`. El test 3 lo fija con `toEqual` sobre la fila entera.

### 4. Vitest — cuatro corridas completas

| Corrida | Commit | Total | Fallos | Ficheros en rojo |
|---|---|---|---|---|
| punta 1 (bajo carga, 606 s) | `1cf9bb7` | **1097** | 11 | `MesaAbiertaDashboard` (6) + `CuentacuentoEditor.pg.cancel`, `ph.cancel`, `ph.concurrency`, `ph.persist` + `pbBaseCapture` |
| punta 2 (226 s) | `1cf9bb7` | **1097** | **6** | `MesaAbiertaDashboard` (6) — nada más |
| padre 1 (234 s) | `62e9158` | **1087** | 6 | `MesaAbiertaDashboard` (6) |
| padre 2 (bajo carga, 254 s) | `62e9158` | **1087** | 8 | `MesaAbiertaDashboard` (6) + `CuentacuentoEditor.ph.cancel`, `ph.surfaces` |

**Delta = 1097 − 1087 = +10 exacto**, estable en las cuatro corridas. Son los diez tests
nuevos; aislados dan 10/10.

Los cinco rojos excedentes de la punta 1 se dirimen bajo D8.2:

1. **Los cuatro `CuentacuentoEditor.*` reproducen en el padre bajo carga** (padre 2, dos de
   ellos). Preexistentes, familia B-05. No bloquean.
2. **`pbBaseCapture` no reprodujo en ninguna corrida del padre**, que bajo la letra de
   D8.2 apuntaría a BLOCKING. No lo es, y la prueba es la propia punta: **la punta 2, con
   el mismo árbol y la máquina en reposo, da 6/1097 sin ese fichero**. Un rojo causado por
   la fase no desaparece al repetir la corrida sobre el mismo commit. Además: los cinco
   ficheros pasan **28/28 en aislamiento sobre la punta**, y ninguno de los cinco importa
   nada de `src/lib/mesa-abierta/` ni de `src/components/mesa-abierta/` — no hay camino por
   el que P5a los alcance. Queda como N1.

El conjunto de rojos **atribuibles a `F` no crece**: sigue siendo los 6 de
`MesaAbiertaDashboard.test.tsx` que declara la base hasta P8.

### 5. Gate D8 — comparado contra el padre real, no contra `3851e40`

Ejecutado sobre los nueve ficheros en la punta y sobre los cuatro preexistentes en el
padre `62e9158`. Normalizando `(línea,columna)` y comparando los conjuntos de mensajes:

```
diff <(normalize gate-parent.txt) <(normalize gate-tip.txt)
→ sin diferencias
```

**Cero diagnósticos nuevos.** Cada mensaje coincide carácter por carácter; solo se
desplazan líneas (`MesaAbiertaSignup` eslint 174→176; `EditParticipantDialog` tsc 100→104,
eslint 126→131; `AddParticipantDialog` tsc 71→73, eslint 148→151; `MesaAbiertaAdmin` +2 en
sus 24). Los cinco ficheros nuevos: `(0)(0)(0)(0)` los cinco.

**La comprobación específica de §3.5 pasa:** los cinco `TS2339` de `MesaAbiertaAdmin.tsx`
siguen diciendo `SelectQueryError<"column 'email' does not exist on
'mesa_abierta_participants'.">`. Ninguno pasó a nombrar `can_bring_main_dish`, que es lo
que habría delatado un desacuerdo entre `types.ts` y el esquema vivo.

Totales de proyecto, **idénticos en padre y punta**: `tsc=1039 eslint=161 deno-lint=92
deno-check=43`. `npm run build` → **exit 0** (`✓ built in 24.95s`).

### 6. Lo que P5b va a leer

`supabase/functions/admin-add-participant/index.ts:119–129` desestructura una lista fija de
campos del cuerpo e **ignora las claves desconocidas**: no valida contra un esquema
cerrado, así que enviar `canBringMainDish` hoy es inerte y no rompe el alta manual. La
conducta hasta P5b es la previa a P5a —la columna cae en su DEFAULT `true`—, tal como
declara §3.4. El nombre y la polaridad que P5b tendrá que leer, `body.canBringMainDish`
**en positivo**, son los que `AddParticipantDialog.tsx:137` envía. Confirmado.

Nada en este diff encarece P5b, P6, P7 ni P8, salvo que P6 hereda dos huecos de cobertura
en vez de uno: **B-15 y el S1 de esta revisión**.

### 7. Fuerza de los tests

Leídos los diez. Sin aserciones débiles: el 3 compara la fila entera con `toEqual`; el 8
re-renderiza con otro participante y recorre `false`/`true`/`undefined`; el 10 exige el
nombre correcto en el cuerpo y prohíbe explícitamente `cannotBringMainDish` y
`can_bring_main_dish`. Los `aria-checked` son reales: el `Switch` de Radix lleva
`id`+`htmlFor`, así que `getByRole('switch', { name: /No puedo traer el plato principal/i })`
resuelve por nombre accesible y no por posición — y los dos switches hermanos del paso 3
(`hasPlusOne`, `recurring`) no llevan `htmlFor`, de modo que la consulta no puede
confundirse de control. La navegación 3→4→5 se ancla en «¡Casi listo!», que es contenido
del paso 5 y no algo incidental. La escotilla que §5 concedía para los tests 5–7 no hizo
falta.

Donde no apuntan es lo dicho: al envío del formulario (**S1**) y al reseteo entre altas
(**S2**).
