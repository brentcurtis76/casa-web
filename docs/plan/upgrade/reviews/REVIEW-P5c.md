## CODEX REVIEW — P5c (round 1)

VERDICT: FAIL

BLOCKING:

- [B1] **La aserción de D12 borra el contenido de cualquier objeto antes de
  inspeccionarlo, por lo que no detecta el caso de fuga que dice guardar** —
  `supabase/functions/create-mesa-matches/handler_test.ts:684` — El stub aplica
  `String()` a cada argumento de `console.warn`; un participante se convierte en
  `"[object Object]"` y sus campos `full_name`, `email` y `phone` desaparecen de lo que
  el test examina. Lo probé añadiendo el participante sintético completo como segundo
  argumento del warning de `handler.ts`: `el déficit real cruza el borde HTTP` siguió
  verde (**1/1**) aun cuando el logger recibió el objeto con las tres piezas de PII.
  Esto incumple la mitad explícita de B-13/H1 y D12: la fase exige que la guarda capture
  un cambio futuro que loguee un participante, no solo interpolaciones de strings.
  Debe conservar los argumentos crudos y afirmar un único argumento string exacto, o
  inspeccionar recursivamente su contenido, antes de poder cerrar P5c.

SHOULD-FIX:

- [S1] **El recorrido del anfitrión solo persiste la polaridad excluida; no guarda que
  el default apagado llegue como capacidad `true`** —
  `src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx:188` — El
  test comprueba el switch apagado, pero lo enciende siempre antes del único submit.
  Muté el cableado a
  `cannotBringMainDish: rolePreference === 'host' ? true : cannotBringMainDish`; eso
  excluye silenciosamente a todo anfitrión que no toque el switch y viola D2, pero los
  cinco tests del fichero siguieron verdes (**5/5**). **Estado (a): corregir ahora en
  P5c, antes del cierre**, enviando una vez al anfitrión con el switch intacto y
  afirmando `can_bring_main_dish: true`, además del caso encendido ya cubierto.

NITS:

- Ninguno.

NOTES ON THE PLAN ITSELF:

- **H7 está mal delimitado; la lectura del ejecutor es correcta.**
  `main..adc641f` incluye necesariamente el bootstrap del PM `b9675e6` y por eso toca
  `PLAN.md` y `prompts/P5c-r1.md`. El diff del ejecutor `b9675e6..adc641f` toca
  exactamente los cuatro ficheros de `F` más `LEDGER.md`; el commit de código
  `56505ae` toca solo los cuatro de `F`. H7 debe nombrar ese boundary, no `main`.
- **Las tres mediciones del séptimo rojo descargan B-05.** Un rojo aislado en una
  primera punta cargada, ausente en tres ejecuciones aisladas de ambos árboles y en una
  segunda suite completa tranquila, no es atribuible a este diff; además, ningún
  fichero de P5c entra en su grafo. En mi repetición no apareció: padre y punta tuvieron
  exactamente los seis rojos conocidos. D8.2 debería formalizar «repetir primero la
  punta; luego comparar con el padre si persiste», porque su literal actual vuelve a
  castigar una punta cargada frente a un padre tranquilo.
- **La descarga de E2E es aceptable para esta fase, pero el repositorio debe escribir
  el carve-out.** `npx playwright test` aborta antes de listar, con el mismo mensaje y
  en la misma línea en padre y punta, porque falta `.env.test` y continuar apuntaría al
  literal de producción. P5c no cambia conducta ni superficie E2E; forzar el gate
  violaría la guarda de seguridad. El conflicto entre la lista absoluta de `CLAUDE.md`
  y D8 debería resolverse explícitamente para fases sin conducta, no reinterpretarse en
  cada review. `npm run lint` también conserva los 161 problemas preexistentes y D8 lo
  trata correctamente como observación.

## EVIDENCIA

### Criterios H1–H7

| ID | Resultado | Evidencia |
|---|---|---|
| H1 | **NO CUMPLE** | La mutación nominal de `tablesWithShortfall` sí cae, pero B1 demuestra que la garantía de PII requerida por el mismo test no existe. |
| H2 | CUMPLE la mutación nominal | Ocultar el bloque a anfitriones deja 4/5; S1 delimita la polaridad host que aún no guarda. |
| H3 | CUMPLE | Borrar la columna deja 0/1 y el diálogo recibe `aria-checked="false"` en vez de `"true"`. |
| H4 | CUMPLE | El cambio es solo comentario y describe el flujo real `handler → planSeating → shuffle/allocateAll` con el mismo `pick`. |
| H5 | CUMPLE | Deno 456→457, Vitest 1093→1095; fallos sin cambios. |
| H6 | CUMPLE | D8 sin diagnósticos nuevos en `F`; build exit 0. |
| H7 | CUMPLE bajo el boundary correcto | `b9675e6..adc641f` = cuatro ficheros de `F` + ledger. El texto `main..HEAD` es insatisfacible por el bootstrap del PM. |

### Mutaciones obligatorias y contraejemplos

Todas se ejecutaron con Node **v22.22.0** y el `deno` del `PATH`,
`/opt/homebrew/bin/deno` **2.7.11**. Todas se revirtieron con parches explícitos y el
worktree terminó limpio.

1. H1, respuesta `tablesWithShortfall: []`: **28 passed / 1 failed**. Falla solo
   `el déficit real cruza el borde HTTP`; actual `[]`, esperado
   `[{ tableId: "h1", shortfall: 2 }]`.
2. H2, switch visible solo para `guest`: **4 passed / 1 failed**. El test del anfitrión
   no encuentra el switch; el DOM prueba que sigue en `Paso 3 de 5`, muestra
   `Información de anfitrión` y conserva `Calle Falsa 123`.
3. H3, columna eliminada del `select`: **0 passed / 1 failed**. El switch del diálogo
   real queda `aria-checked="false"` en vez de `"true"`.
4. B1, warning con `participants[0]` como segundo argumento: **1/1 verde**; el
   `String(object)` del stub oculta las tres piezas sintéticas de PII.
5. S1, anfitrión forzado a `cannotBringMainDish: true`: **5/5 verdes**; el test solo
   observa el submit después de encender el switch.

La fixture H1 tiene un anfitrión y cinco invitados, todos sin disponibilidad: seis
personas, `max(1, ceil(6/5)) = 2`, cero portadores, déficit exacto 2 y una sola mesa sin
donante. `tablesWithShortfall` y `mainDishCoverage` fijan todos esos números, y
`warnings.length === 1` sí fija la cantidad de warnings. El defecto es específicamente
que la representación elegida para inspeccionar los argumentos puede ocultar PII (y que
`includes("2")` no fija por sí solo el número textual exacto).

### H3: fidelidad del doble y alcance de la costura

`project()` realiza proyección real para la lista plana usada por
`fetchParticipants`; al quitar la columna, el valor no puede entrar por la fixture. El
test también obliga a que ocurran la autorización, selección de mes, carga de
participante y perfil, activación de la pestaña con `userEvent`, apertura del diálogo y
lectura del switch. Los métodos tolerantes que devuelven `this` pueden vaciar caminos no
observados del panel, pero no pueden fabricar esa cadena ni el `false` afirmado.
`single()` solo sirve al rol admin, como declara el test; `maybeSingle()` no participa
en el camino montado.

El test H3 cubre deliberadamente la dirección **fetch → diálogo**. No cubrir aquí el
save no es otro B-15: `EditParticipantDialog.mainDish.test.tsx` ya afirma el `.update()`
con `can_bring_main_dish: true` y `false`. Romper el hijo queda cubierto allí; romper la
entrada queda cubierto aquí. Un test end-to-end adicional que repita ambos no aportaría
una costura huérfana y es ruido para P5c.

### Suites, gates, alcance y ausencia de conducta

- Punta `adc641f`: Vitest **1095 passed / 6 failed** (1101), 228.52 s.
- Padre `d5b16e8`: Vitest **1093 passed / 6 failed** (1099), 223.19 s.
- En ambos: exactamente los seis de `MesaAbiertaDashboard.test.tsx`; delta **+2**.
- Deno punta: **457/0**. Deno padre: **456/0**; delta **+1**.
- D8 punta/padre: mensajes byte-idénticos con solo desplazamiento +3 en
  `handler.ts` (`eslint` 32→35, `deno lint` 299→302, `deno check`
  356/151/150→359/154/153). Totales idénticos:
  `tsc=1039 eslint=161 deno-lint=92 deno-check=43`.
- `npm run build`: exit 0. `npm run lint`: 161 problemas preexistentes
  (118 errores, 43 warnings); cero nuevos en `F`.
- `npx playwright test`: exit 1 antes de listar, idéntico en padre y punta, por la
  guarda anti-producción sin `.env.test`.

El diff de código `56505ae` contiene tres tests y un comentario en exactamente cuatro
ficheros. No hay cambios de producción fuera del comentario; no hay `types.ts`,
migración, base de datos, `matching.ts`, duplicados `* 2.tsx` ni trabajo de P6/P7/P8.
Los datos son sintéticos, en memoria y sin enlace a `auth.users`; no se commitea
evidencia con datos de miembros. Los nombres de test son españoles y los comentarios
siguen el idioma predominante de cada fichero. B-14 permanece correctamente en el
estado (c) ya aceptado por Brent.

---

## CODEX REVIEW — P5c (round 2, cumulative)

VERDICT: FAIL

BLOCKING:

- Ninguno. B1 de la ronda 1 está cerrado: los argumentos del warning se capturan crudos,
  la forma de la llamada queda fijada y las dos formas de fuga pedidas ponen el test en
  rojo.

SHOULD-FIX:

- [S1] **El recorrido de anfitrión distingue las dos polaridades, pero solo cuando el
  rol viene inicializado por `preferredRole`; no fija el camino real de cambiar de
  invitado a anfitrión en el paso 1** —
  `src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx:80` —
  envolví el bloque del switch con
  `rolePreference === 'guest' || preferredRole === 'host'`. Los **5/5** tests siguieron
  verdes: los recorridos de invitado satisfacen la primera rama y el recorrido de
  anfitrión satisface la segunda porque monta directamente con `preferredRole="host"`.
  Sin embargo, el asistente permite abrir con `preferredRole="guest"`, elegir
  «Quiero ser anfitrión» en el paso 1 y llegar al paso 3 con `rolePreference === 'host'`;
  en ese camino alcanzable la mutación oculta la exclusión. Cambié temporalmente el
  helper para hacer exactamente esa transición y entonces el mismo test quedó **4/5**:
  no encontró el switch. **Estado (a): corregir ahora en P5c antes del cierre**,
  conservando el recorrido de anfitrión inicial y añadiendo dentro del mismo `it` un
  tercer recorrido que empiece como invitado, seleccione anfitrión y persista la
  exclusión. No requiere aumentar el conteo de tests ni tocar producción. Bajo la regla
  de tres estados, la fase no puede cerrar mientras esta reparación todavía no existe;
  por eso el veredicto es FAIL aun sin un hallazgo BLOCKING.

NITS:

- [N1] **`deepRender()` no aporta una garantía independiente mientras se conserve el
  golden exacto** — `supabase/functions/create-mesa-matches/handler_test.ts:109` — sí se
  ejecuta en el caso verde, pero ninguna fuga puede llegar a sus aserciones: un segundo
  argumento cae antes por aridad y una fuga dentro del string cae antes por igualdad
  exacta. Mantenerlo no rompe nada y el ledger no lo cuenta dos veces, así que no merece
  otra ronda; retirarlo en la corrección de S1 dejaría más claro cuál es la prueba real.

NOTES ON THE PLAN ITSELF: Ninguna nueva. Las tres notas de la ronda 1 están aceptadas y
correctamente encaminadas a `/pm-boot`; no son bloqueos de P5c.

## EVIDENCIA DE LA RONDA 2

### Juicio sobre las nuevas aserciones

El golden exacto debe quedarse. Aquí no congela copy de usuario: congela la única llamada
operativa mediante la cual D4 informa el déficit y, junto con aridad y tipo, demuestra
que el logger recibe solo ids y números. Una reescritura benigna en una fase futura
deberá actualizarlo deliberadamente y volver a ejecutar las dos mutaciones de fuga; eso
es una revisión útil, no fragilidad accidental. Una aserción estructural más laxa
reabriría precisamente B1b.

La doble polaridad cierra **S1 de la ronda 1**: la mutación
`cannotBringMainDish: rolePreference === 'host' ? true : cannotBringMainDish` deja ahora
**4 passed / 1 failed**, con `can_bring_main_dish: false` recibido donde el submit sin
tocar exige `true`. El S1 nuevo de esta ronda es distinto: separa el estado vivo del rol
de la prop que solo lo inicializa.

### Mutaciones

Todas se ejecutaron con Node **v22.22.0** y `/opt/homebrew/bin/deno` **2.7.11**, el mismo
`deno` del `PATH`. Cada parche se revirtió explícitamente; antes de los gates el árbol
volvió a quedar limpio.

1. **B1a**, `participants[0]` como segundo argumento del warning: **0/1**; falla en
   aridad, actual `2`, esperado `1`.
2. **B1b**, participante serializado dentro del único string: **0/1**; falla el golden y
   la salida imprime la fuga completa, incluidos `Ana Fulana` y
   `ana.fulana@example.invalid`.
3. **S1 r1**, anfitrión forzado a `cannotBringMainDish: true`: **4/5**; el submit sin
   tocar recibe `false` donde espera `true`.
4. **H1**, respuesta con `tablesWithShortfall: []`: **14/15**; falla solo
   `el déficit real cruza el borde HTTP`.
5. **H2**, switch restringido a `rolePreference === 'guest'`: **4/5**; falla el
   recorrido del anfitrión al no encontrar el switch.
6. **H3**, columna borrada del `select`: **0/1**; el diálogo recibe
   `aria-checked="false"` donde espera `"true"`.
7. **Contraejemplo S1 r2**, switch visible si
   `rolePreference === 'guest' || preferredRole === 'host'`: **5/5 verdes**. Con el
   helper cambiado para elegir anfitrión desde una prop invitado: **4/5**.

### Alcance y gates limpios

- `66e3a50..99c2e0f` añade solo
  `docs/plan/upgrade/prompts/P5c-codex-rereview.md`. Los únicos commits de código son
  `56505ae` y `7b6f837`; r2 toca exactamente los dos tests declarados y ninguna
  producción. El acumulado sigue limitado a los cuatro ficheros de `F`.
- Deno punta: **457 passed / 0 failed**. Padre `d5b16e8`: **456/0**. Delta **+1**.
- La medición Vitest limpia esperada no apareció hoy. Punta produjo primero
  **1087/14**, luego **1086/15** más un error tardío de Radix, y finalmente **1087/14**.
  Los ocho rojos adicionales estables fueron todos los de
  `usePresentationState.test.ts` por `localStorage === undefined`; el segundo intento
  cambió esos rojos por timeouts de `CuentacuentoEditor.ph.*`, confirmando la sensibilidad
  a carga ya catalogada. Al persistir el conjunto de `localStorage`, apliqué D8.2 y corrí
  el padre completo: **1085/14**. Padre y punta comparten exactamente esos ocho más los
  seis conocidos de `MesaAbiertaDashboard`; el delta vinculante sigue siendo **+2** y
  ningún fichero de P5c está rojo. Los dos ficheros Vitest de P5c pasan aislados **6/6**.
- Gate D8 en punta y padre: los cinco mensajes son byte-idénticos, con el mismo
  desplazamiento +3 en `handler.ts` (`eslint` 32→35, `deno lint` 299→302,
  `deno check` 356/151/150→359/154/153). Totales idénticos:
  `tsc=1039 eslint=161 deno-lint=92 deno-check=43`. `handler_test.ts`, incluido
  `Deno.inspect`, permanece **0/0/0/0**.
- `npm run build`: exit **0**.
- Estado final antes de anexar esta revisión: worktree limpio.

---

## CODEX REVIEW — P5c (round 4, cumulative)

STATE CHECKS: `1 · 1 · 0 · 1 · 0`

- `git log --oneline | grep -c 6b98e74` → **1**.
- `git log --oneline | grep -c 7fb483b` → **1**.
- `grep -c 'round 4' docs/plan/upgrade/reviews/REVIEW-P5c.md` → **0**.
- `grep -c 'invitado de producción' src/components/mesa-abierta/__tests/MesaAbiertaSignup.mainDish.test.tsx` → **1**.
- `grep -c 'deepRender' supabase/functions/create-mesa-matches/handler_test.ts` → **0**.

VERDICT: FINDINGS

BLOCKING:

- Ninguno en el diff de código de r3/r4. Las guardas añadidas son tests, están dentro de
  los cuatro ficheros de `F` y detectan las mutaciones alcanzables que dicen detectar.
  El veredicto es `FINDINGS`, no otro `FAIL`: la premisa de producción y el contrato de
  alcance/aritmética necesitan una decisión del PM antes de escribir una quinta
  corrección serial.

SHOULD-FIX:

- Ninguno. No corresponde prescribir aquí un parche (a), aceptar deuda (c) ni inventar
  una fase dueña (b): el PM debe decidir primero cuál de los dos contratos descritos en
  «NOTES ON THE PLAN ITSELF» es el deseado.

NITS:

- Ninguno.

RULING ON r4's LEGITIMACY: **Debió ser `FINDINGS` antes de cambiar código.** r4 sí cambia
la hipótesis —de «añadir el siguiente recorrido que se nos ocurrió» a enumerar entradas—
y sus dos ajustes de test son técnicamente útiles. Pero el ejecutor ya había constatado
que el contrato `+2` no describía las pruebas necesarias y que una premisa de producción
(`preferredRole` ausente) era falsa. El overlay deja al PM como dueño del contrato y
define `FINDINGS` precisamente para un contrato equivocado. r3, además, fue código
después de dos fallos consecutivos de la misma categoría sin cambio de hipótesis ni
split, en contradicción directa con §5. r4 repara la dirección técnica, no legitima de
forma retroactiva el crecimiento no autorizado de `+2` a `+4`.

RULING ON THE GRID: **La factorización sirve para la guarda estrecha B-18, pero la grilla
publicada no es un modelo correcto de producción y omite la semántica de montaje.**

El caller activo es `src/components/mesa-abierta/MesaAbiertaSection.tsx`, importado por
`src/pages/Index.tsx`. Allí:

1. `signupRole` nace como `guest` (`MesaAbiertaSection.tsx:53`).
2. El único CTA activo invoca `handleSignUp('guest')` (`:523`); no existe ninguna llamada
   a `handleSignUp('host')` en ese fichero. Por tanto las celdas 5–6 con
   `preferredRole="host"` **no son hoy producción**, igual que 3–4 con prop ausente.
3. El wizard se monta cuando existe `nextMonth`, no cuando `open` pasa a `true`
   (`:725-731`). Queda montado cerrado con prop `guest`.
4. `MesaAbiertaSignup` copia la prop una sola vez en `useState` (`:35`) y no tiene efecto
   de sincronización. `open: false → true` no remonta el wizard ni reaplica la prop.

Lo confirmé con una prueba temporal de lifecycle: montar cerrado con
`preferredRole="guest"`, hacer `rerender` abierto con `preferredRole="host"` y exigir el
radio de anfitrión. Falló: `aria-checked` siguió en `false` (**1 failed / 7 skipped**). La
prueba temporal fue retirada y el fichero quedó idéntico al commit.

Corregida la alcanzabilidad, las cuatro celdas actuales sí están cubiertas: invitado
`preferredRole="guest"`, ambas polaridades, y cambio invitado→anfitrión en paso 1, ambas
polaridades. Así, B-18 está guardada para la UI que hoy existe. Cambiar después el rol de
vuelta y navegar hacia atrás no añaden una costura necesaria al criterio H2: el estado
del opt-out es deliberadamente independiente del rol y permanece en el mismo montaje.
Pueden ser tests de interacción futuros, pero no justifican ampliar otra vez P5c.

Conservar los tests de celdas inalcanzables es aceptable como contrato unitario barato
del componente; **no** es aceptable contarlos como evidencia de recorridos de usuario.
En particular, el test de anfitrión con `preferredRole="host"` protege una API posible,
no un CTA presente en `MesaAbiertaSection.tsx`.

NOTES ON THE PLAN ITSELF:

- La deriva `Vitest +2 → +4` no es aceptable como deriva silenciosa. Si el PM conserva
  r3/r4, debe enmendar H5 y la aritmética global `1072 → 1074`, y describir las cuatro
  celdas realmente alcanzables sin llamar producción a `preferredRole="host"`.
- Si la intención del producto es que un CTA pueda cambiar `signupRole` a `host` antes
  de abrir, el contrato actual es insuficiente: hay que ensanchar `F` para incluir
  `MesaAbiertaSection.tsx` y una prueba del lifecycle caller→wizard, y decidir si la prop
  debe sincronizar estado o si el wizard debe remontarse. Eso es una enmienda/split, no
  una quinta edición del test aislado.
- Si esa entrada directa de anfitrión no forma parte del producto, el PM puede cerrar el
  descubrimiento declarando inalcanzables también 5–6. En ese contrato, los tests r4 de
  invitado y r3 de cambio en paso 1 bastan para la superficie actual; el test de prop
  host queda sólo como regresión unitaria.
- Las tres notas de plan de r1 siguen en sus dueños ya aceptados y no se reabren aquí.

## EVIDENCIA DE LA RONDA 4

### Estado, alcance y toolchain

- Branch `feat/mesa-md-guards`, padre `d5b16e8`, commits r3 `6b98e74` y r4 `7fb483b`
  presentes. `fee5203..<tip>` es docs-only; no hay producción sobre el último commit de
  contenido.
- r3/r4 no modifican producción. El acumulado sigue limitado a los cuatro ficheros de
  `F`; `handler.ts` conserva como único cambio no-test el comentario ya revisado.
- Node **v22.22.0** y `/opt/homebrew/bin/deno` **2.7.11**.
- Antes de anexar esta revisión, `git status --short` quedó vacío.

### Diez mutaciones

Cada mutación se aplicó de una en una y se revirtió con el árbol limpio:

1. **R4a**, ocultar el switch al invitado de producción: **6 passed / 1 failed**; cayó
   únicamente `el invitado de producción...`.
2. **R4b**, forzar exclusión al invitado de producción en el payload: **6/1**; cayó
   únicamente el nuevo test en la polaridad sin tocar.
3. **H1**, responder `tablesWithShortfall: []`: **14/1**; cayó sólo el déficit real.
4. **H2**, mostrar el switch sólo a `rolePreference === 'guest'`: **5/2**; cayeron los
   dos recorridos de anfitrión.
5. **H3**, quitar `can_bring_main_dish` del `select`: **0/1**; el diálogo recibió el
   switch apagado en vez de encendido.
6. **B1a**, añadir `participants[0]` como segundo argumento del warning: **0/1**; aridad
   actual 2, esperada 1.
7. **B1b**, concatenar el participante serializado al warning: **0/1**; cayó el golden
   exacto y la salida mostró nombre, correo y teléfono sintéticos.
8. **S1**, forzar a todo anfitrión a excluirse: **5/2**; cayeron las polaridades sin
   tocar de ambos recorridos host.
9. **R3a**, visibilidad por
   `preferredRole === 'host' || rolePreference === 'guest'`: **6/1**; cayó sólo el
   anfitrión elegido desde la entrada guest.
10. **R3b**, forzar la celda prop ausente + host: **7/7 verdes**. Se **elimina como
    mutación exigible**: no afecta a ningún caller de producción y su supervivencia no
    demuestra un defecto de B-18. La afirmación del prompt de que aún caía por P5a no se
    reprodujo después de que el helper r3 pasara a prop guest explícita.

### Gates reproducidos

- Suites P5c aisladas: **8/8** (Signup 7, Admin 1).
- Vitest serial exacto (`npx vitest run --no-file-parallelism`): punta
  **1097 passed / 6 failed** (1103), 212.97 s; padre `d5b16e8`
  **1093 / 6** (1099), 213.10 s. Los seis rojos son en ambos los mismos de
  `MesaAbiertaDashboard.test.tsx`; delta P5c **+4**.
- Deno: punta **457/0**; padre **456/0**; delta **+1**.
- D8 punta/padre: los mismos cinco diagnósticos con desplazamiento +3 en
  `handler.ts`; totales idénticos
  `tsc=1039 eslint=161 deno-lint=92 deno-check=43`. Los tres ficheros de test quedan
  `0/0/0/0`.
- `npm run build`: exit **0**. Los avisos de Browserslist, clase Tailwind ambigua y
  tamaño de chunks son preexistentes.
- `npm run lint` y Playwright permanecen descargados por la revisión r1, como autoriza
  el prompt r4; no se repitieron.
