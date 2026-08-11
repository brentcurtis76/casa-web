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
