## CODEX REVIEW — P4 round 1

VERDICT: PASS

BLOCKING:

- Ninguno.

SHOULD-FIX:

- [S1] Falta un caso del handler con déficit real que fije el cruce de
  `tablesWithShortfall` hasta la respuesta y el `console.warn` —
  `supabase/functions/create-mesa-matches/handler_test.ts:528` — En una copia
  aislada cambié únicamente `handler.ts:346` por
  `tablesWithShortfall: []`; los 14 tests de `matching_test.ts` y los 14 de
  `handler_test.ts` siguieron en **28/0**. La mutación viola E2/D4 y ocultaría a
  P6/P7/P8 un déficit que el plan puro sí calculó. El código revisado es correcto,
  por eso no bloquea P4; conviene añadir al doble del handler una mesa sin swap
  posible y afirmar tanto el elemento no vacío de `results.tablesWithShortfall`
  como que el warning contiene solo ids y números.

NITS:

- [N1] El encabezado todavía dice que `pick` es el seam «which `shuffle` uses»
  aunque `handler.ts` ya no importa ni llama a `shuffle` —
  `supabase/functions/create-mesa-matches/handler.ts:11` — comentario obsoleto,
  ya declarado y razonablemente diferido a P7.
- [N2] `docs/plan/upgrade/reviews/REVIEW-P1.md` sigue sin seguimiento en el
  worktree `casa-upgrade`. No pertenece a P4, pero confirma el problema operativo
  ya señalado: la revisión de P1 aún no está publicada.

NOTES ON THE PLAN ITSELF: La lectura literal del prompt de ejecución de E6 («el
único hunk permitido fuera de los dos goldens y los cuatro tests es añadir
`can_bring_main_dish`») entra en conflicto con E8: tras reescribir los dos goldens
permitidos, `FOODS` y `referenceShuffle` quedan muertos y conservarlos crea dos
`no-unused-vars` nuevos. Reproduje que en el padre ambos helpers solo alimentaban
esos goldens. Acepto la resolución del PM: borrarlos es consecuencia necesaria de
la modificación permitida y no altera ninguno de los ocho bloques protegidos.
No es un defecto del código, aunque esa excepción debió quedar incorporada al
plan o al prompt en vez de existir solo como ruling posterior.

La retirada del supuesto B-12 de Vitest también fue correcta bajo D8.2. En este
worktree la punta dio **1055 pass / 14 fail**: los 6 casos declarados de
`MesaAbiertaDashboard.test.tsx` y los 8 de `usePresentationState.test.ts` por
`localStorage` ausente (B-10). El padre `3851e40`, ejecutado con el mismo entorno,
reprodujo esos 14 y además flakeó un caso de `CuentacuentoEditor.ph.persist`
(**1054/15**, B-05). No hay rojo atribuible a los cuatro ficheros de P4. El
resultado 1063/6 del PM es otra variante válida del entorno, no una base portátil.

B-11 ya puede cerrarse aunque no se exigiera repararlo: al sustituir ahora los dos
shuffles iniciales por copias simples, los nuevos tests
`el reequilibrio se refleja en los invitados` y
`se respeta el mínimo tras el reequilibrio` fallan (**26/2**). La suite de P4 sí
fija el efecto observable que los ocho tests de P3b no fijaban.

Verificación independiente:

- Revisé `e87392e`; el único cambio de código es `0fad9ad` sobre
  `main`@`3851e40`. El diff de código toca exactamente los cuatro ficheros de F,
  todos bajo `supabase/functions/create-mesa-matches/`; `git diff --check` es
  limpio y no hay migración, SQL, deploy ni escritura a la base compartida.
- Los ocho goldens protegidos son byte-idénticos entre `3851e40` y `0fad9ad`.
  Salen los dos nombres de comida, entran sus dos reemplazos y los cuatro tests
  nuevos: 10 → 14. Fuera de ellos, los hunks funcionales del fixture son la
  propiedad requerida `can_bring_main_dish` y su default `true`; la eliminación
  de los dos helpers muertos queda cubierta por el ruling anterior.
- E1–E5 se cumplen. `handler.ts` ya no contiene `foodAssignments`, `allocateAll`
  ni `TableInput`; el bucle escribe `Dinner`, un único objeto post-rebalance que
  une participante y comida. `hostStatus` recibe las listas post-swap antes de
  las actualizaciones de roles/status, `guest_count` sale de la misma lista que
  produce las assignments, los excluidos nunca reciben `main_course`, y no se
  escribe `total_people` ni `main_dish_count`.
- E2/D4 se cumplen en el código: `mainDishCoverage` conserva id de mesa,
  `peopleCount`, cuota, portadores dispuestos, platos asignados y déficit;
  `tablesWithShortfall` pasa sin transformación desde `allocateAll` al plan y a
  `results`. El warning nuevo contiene solo `tableId`, cantidad de mesas y
  `shortfall`. Respuesta y logs nuevos llevan ids y números, no nombres, emails
  ni teléfonos.
- D1/D3/D5/D7/D11/D13/D14 sobreviven al cableado. `matching.ts` importa solo la
  hoja pura `_shared/mainDish.ts`; no usa Supabase, `Deno.env` ni aleatoriedad
  propia. Los anfitriones sin invitados siguen fuera de `allocateAll`, como en la
  ruta histórica. Las cuatro extensiones de `SeatingPlan` (`dinners`, cobertura,
  déficits y movimientos) mantienen la decisión fuera del handler y hacen
  comprobable el asiento persistido.
- Probé además los bordes pedidos con llamadas directas a `planSeating`: un host
  excluido recibe `salad`; un host convertido a invitado y excluido recibe
  `salad`; una mesa de 10 personas con un solo portador devuelve
  `[{tableId: "hs", shortfall: 1}]`. Un `pick` que devuelve 999 termina en
  `TypeError` dentro del shuffle de asiento preexistente; no es infracción de
  D11, cuyo contrato exige un entero en `[0,n)` y cuyo proveedor de producción
  lo cumple. El allocator canónico sí acota defensivamente su propio índice.
- Reproduje las tres mutaciones del PM sobre copias aisladas: neutralizar el
  rebalance da **25/3** (incluye handler 12); quitar el fold-back da **27/1**;
  rotar la comida entre invitados da **24/4** e incluye ambos tests de excluidos.
  La cuarta mutación no detectada es S1.
- `deno test --allow-all --no-check .` desde `supabase/functions/` termina en
  **456 passed / 0 failed**. `npm run build` termina con exit 0 usando Node
  **v22.22.0** y Deno **2.7.11**.
- El gate D8, ejecutado en worktrees limpios tanto en punta como en padre, da en
  ambos: `matching.ts (0,0,1,0)`, `matching_test.ts (0,0,0,0)`,
  `handler.ts (0,1,1,3)` y `handler_test.ts (0,0,0,0)`. Los mensajes son los
  mismos y solo cambian las líneas. Totales idénticos:
  `tsc=1039 eslint=161 deno-lint=92 deno-check=43`.
- No veo obstáculo nuevo para P5a/P6/P7/P8 ni scope creep. `dinners` evita el
  cruce de objetos en la escritura; `mainDishMoves` queda interno al plan; los
  consumidores reciben los dos arrays de E2 con ids y agregados suficientes,
  sin listas de portadores ni agregados persistidos.
