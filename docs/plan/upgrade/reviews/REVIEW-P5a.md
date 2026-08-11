## CODEX REVIEW — P5a (rounds 1–2)

VERDICT: PASS

BLOCKING:

- Ninguno.

SHOULD-FIX:

- [S1] **La costura `fetchParticipants` → diálogo de edición sigue sin prueba y puede
  corromper silenciosamente la elegibilidad** —
  `src/components/mesa-abierta/MesaAbiertaAdmin.tsx:239` — Repetí la lectura de extremo
  a extremo: el `select` trae `can_bring_main_dish`, el spread de `:275` lo conserva y
  el objeto llega a `EditParticipantDialog`, que interpreta `undefined` como capacidad
  positiva. La mutación ya medida —borrar la columna del `select`— deja los doce tests
  verdes porque ninguno monta `MesaAbiertaAdmin`; al guardar cualquier otro cambio, un
  excluido sería persistido como `can_bring_main_dish: true`. El código actual es
  correcto, por eso no bloquea P5a, pero el riesgo es corrupción de datos y no ruido.
  Acepto P6 como hogar solo si B-15 se convierte allí en criterio/test explícito: que el
  fetch entregue `false` al diálogo. Que `MesaAbiertaAdmin.tsx` aparezca en `F` no basta;
  el test plan actual de P6 no garantiza por sí mismo que esta costura vaya a montarse.

- [S2] **Los doce tests solo recorren el asistente como invitado; pueden perder el
  opt-out del anfitrión sin ponerse rojos** —
  `src/components/mesa-abierta/MesaAbiertaSignup.tsx:373` — Apliqué una cuarta mutación:
  envolví el switch con `rolePreference === 'guest'`. Los doce tests quedaron en
  **12/12** con Node v22.22.0. La mutación impediría excluirse precisamente al anfitrión,
  candidato preferido para `main_course` por D7. El código actual está bien situado en
  el bloque común de paso 3 y sirve a ambos roles, así que no es BLOCKING; falta fijarlo
  con un recorrido del asistente como anfitrión. A diferencia de S1, ninguna fase
  posterior vuelve a tocar `MesaAbiertaSignup.tsx`, por lo que este SHOULD-FIX necesita
  dueño explícito y no una entrada abierta sin salida.

NITS:

- [N1] El resumen del paso 5 representa «No traeré el plato principal» con el mismo
  `Check` verde que las confirmaciones positivas —
  `src/components/mesa-abierta/MesaAbiertaSignup.tsx:444` — La frase registra fielmente
  la elección y cumple D10; un icono neutro podría leer mejor. Es preferencia visual, no
  defecto.

NOTES ON THE PLAN ITSELF:

- **La desviación `status: 'pending'` queda ratificada.** El retorno ancho
  `status: string` prescrito por el prompt no satisface la unión literal del tipo
  `Insert` de Supabase y produce el TS2769 nuevo ya medido en la ronda 1. El literal
  estrecho es el contrato correcto y permite que `.insert()` conserve su tipado. El
  ejecutor hizo bien en medir y rechazar la prescripción.
- **Un SHOULD-FIX necesita una salida al nacer.** Regla propuesta para el SOP: antes de
  cerrar una fase, todo SHOULD-FIX de corrección/cobertura debe quedar en uno de tres
  estados auditables: (a) reparado en la fase actual; (b) asignado por enmienda a una
  fase concreta, con fichero en `F` y criterio/test nombrado; o (c) aceptado
  explícitamente por Brent como deuda, con responsable y hito. «Al backlog» sin dueño ni
  hito no es un estado de cierre. Esto resuelve B-13 y el N1 de P4 sin ensanchar
  arbitrariamente una fase posterior, y evita repetir el caso B-16/B-17.
- **D8.2 debe formalizar el segundo intento en la punta.** En esta revisión padre y
  punta reprodujeron los mismos cuatro flakes `CuentacuentoEditor.ph.*`, así que el
  resultado es inequívoco. El hueco descrito por el PM sigue siendo real: si la punta
  corre cargada y el padre tranquilo, comparar solo con el padre da un falso positivo.
  Para rojos fuera de `F`, la secuencia más discriminante es: repetir primero la misma
  punta; si el rojo persiste, ejecutar el padre. El total de tests y los rojos de `F`
  siguen siendo las señales vinculantes.

## EVIDENCIA

### Contrato y polaridad (D2, D10)

Los cuatro sitios de conversión coinciden con la tabla congelada:

| Sitio | Expresión | Switch OFF | Switch ON |
|---|---|---:|---:|
| `participantPayload.ts:61` | `!input.cannotBringMainDish` | `true` | `false` |
| `EditParticipantDialog.tsx:62,75` | `can_bring_main_dish === false` | apagado para `true`/`undefined` | encendido para `false` |
| `EditParticipantDialog.tsx:105` | `!cannotBringMainDish` | `true` | `false` |
| `AddParticipantDialog.tsx:137` | `!cannotBringMainDish` | `true` | `false` |

Los tres formularios inicializan el switch en apagado. Por tanto, quien no lo toca
aterriza como `can_bring_main_dish: true`, igual que el DEFAULT y que las filas
existentes. `AddParticipantDialog` envía `canBringMainDish` en camelCase y polaridad
positiva, exactamente el nombre que P5b consumirá; mientras P5b no exista, el servidor
actual ignora la clave y aplica el DEFAULT, como declara el plan.

Las dos cadenas fijas aparecen en español y sin deriva en los tres formularios:
`No puedo traer el plato principal` y
`Te asignaremos ensalada, bebidas o postre en su lugar`.

### Criterios F1–F10

| ID | Resultado | Evidencia |
|---|---|---|
| F1 | MET | Builder produce `true`/`false`; tests 1–2. |
| F2 | MET | Switch en paso 3, default apagado y submit real fijado por test 11. |
| F3 | MET | Campo en interfaz/select; init negada cubre `false`/`true`/`undefined`. S1 es cobertura de la costura padre, no fallo actual. |
| F4 | MET | Body `canBringMainDish`; test 10 fija ambas polaridades y prohíbe los nombres erróneos. |
| F5 | MET | Resumen condicional; tests 6–7. |
| F6 | MET | `.update()` persiste el campo en ambas polaridades; test 9. |
| F7 | MET | 12/12 aislados; suite punta 1099, padre 1087: delta +12 exacto. |
| F8 | MET | D8 idéntico en nueve rutas, build exit 0, Deno 456/0. |
| F9 | MET | Mutación exacta pone rojo test 11 y deja los otros tres del fichero verdes. |
| F10 | MET | Borrar el reset pone rojo test 12 y deja test 10 verde. |

Los `aria-checked` no son incidentales: cada switch nuevo tiene `id`, su `Label` usa
`htmlFor`, y la consulta por rol/nombre accesible resuelve el control correcto. La
navegación del asistente afirma `Paso 3 de 5` y después `¡Casi listo!`; el test 11 pulsa
el submit real y observa la fila recibida por `.insert()`.

### Mutaciones obligatorias y adicional

Ejecutadas sobre la punta con `/Users/brentcurtis/.nvm/versions/node/v22.22.0/bin/node`:

1. `cannotBringMainDish,` → `cannotBringMainDish: false,`: **1 failed / 3 passed** en
   `MesaAbiertaSignup.mainDish.test.tsx`; falla el test 11 porque esperaba
   `can_bring_main_dish: false` y recibió `true`.
2. Borrar `setCannotBringMainDish(false)`: **1 failed / 1 passed** en
   `AddParticipantDialog.mainDish.test.tsx`; falla el test 12 con
   `aria-checked="true"` en vez de `"false"`.
3. Mostrar el switch del asistente solo para `rolePreference === 'guest'`: los cuatro
   ficheros P5a siguen en **12/12**; origina S2.

Las tres mutaciones fueron revertidas con parches explícitos. El árbol quedó limpio.

### Suite, gates y alcance

- Runtime Node: **v22.22.0**. Una primera invocación descartada lanzó Vitest con Node 26;
  toda cifra de este review procede de invocaciones directas al binario v22.22.0.
- Punta `64ee283` (código r1 `7bb090e` + tests r2 `2018e06`):
  **1089 pass / 10 fail = 1099**.
- Padre exacto `62e9158`: **1077 pass / 10 fail = 1087**.
- En ambos árboles: los seis rojos declarados de `MesaAbiertaDashboard` más
  `CuentacuentoEditor.ph.surfaces`, `.ph.cancel`, `.ph.concurrency` y `.ph.persist`, todos
  fuera de `F`; ningún test P5a rojo. **Delta = +12**.
- Gate D8 en punta y padre: `tsc=1039`, `eslint=161`, `deno-lint=92`,
  `deno-check=43`; salidas idénticas tras normalizar solo línea/columna. Los cuatro
  TS2339 que imprimen el `SelectQueryError` siguen nombrando exclusivamente
  `column 'email' does not exist on 'mesa_abierta_participants'`. El TS2698 derivado
  del mismo `select` también coincide con el padre; ninguno nombra
  `can_bring_main_dish`.
- `npm run build`: exit 0 (`✓ built in 1m 14s`).
- `deno test --allow-all --no-check .`: **456 passed / 0 failed**.

Alcance de producción: r1 modifica exactamente los nueve ficheros de `F`; r2 modifica
solo los dos ficheros de test autorizados y cero producción. En
`MesaAbiertaAdmin.tsx` hay exactamente las dos ediciones lógicas contratadas (interfaz y
`select`). Sin `types.ts`, Edge Functions, migraciones, base de datos, duplicados
`* 2.tsx`, override dialogs ni badge de P6.
