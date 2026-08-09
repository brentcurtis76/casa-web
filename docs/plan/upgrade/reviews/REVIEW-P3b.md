## CODEX REVIEW — P3b round 1

VERDICT: PASS

BLOCKING:

- Ninguno.

SHOULD-FIX:

- [S1] Los 8 tests puros no fijan que los dos shuffles iniciales consuman `pick`, ni su
  orden observable — `supabase/functions/create-mesa-matches/matching_test.ts:103` — En
  una copia temporal sustituí las líneas 76–77 de `matching.ts` por copias simples
  (`[...hosts]` y `[...guests]`) y la suite siguió en 8/0. Esa mutación cambia los
  desempates entre anfitriones, el orden de invitados y la secuencia posterior de
  `pick`, pero el test de determinismo solo compara dos ejecuciones entre sí y los
  demás afirman principalmente conteos. Conviene reforzar uno de los ocho tests con
  la traza esperada de argumentos a `pick` y/o identidades esperadas tras el shuffle.
  No bloquea P3b: el movimiento actual es byte a byte idéntico, los diez goldens
  independientes del handler pasan sin cambios y sí protegen la paridad de extremo a
  extremo.

NITS:

- Ninguno.

NOTES ON THE PLAN ITSELF: La enumeración de dos miembros de `SeatingPlan` en el prompt
del ejecutor era incompleta. La implementación correcta devuelve cinco. La ruta de
escritura también consume `guestsAssignedCount`, `hostsConvertedToGuests.length` y
`allGuests.length`, y los goldens fijan esos agregados. Devolver las dos colecciones
completas conserva el bloque consumidor verbatim; no expone esos objetos fuera del
handler y nada downstream los muta. No es una desviación del contrato arquitectónico.

Verificación independiente:

- Objetivo revisado: código de `79e662e` sobre `main`@`4b44b5b`, con los commits
  posteriores hasta `ebc9228` limitados al ledger. La punta actual `4f335b9` solo añade
  el prompt de esta revisión. Todo se ejecutó en un worktree dedicado limpio con Node
  `v22.22.0`; los dos artefactos sin seguimiento del checkout original no se tocaron.
- El primer diff prescrito produce 192 líneas contra 192 y cero diferencias exactas,
  incluido whitespace. El segundo produce 175 líneas antiguas contra 165 actuales;
  las 165 son idénticas y la única diferencia es el helper `shuffle` de 10 líneas que
  ahora se exporta desde `matching.ts`.
- D1e–D3e se cumplen: `matching.ts` tiene cero imports, no usa Supabase ni `Deno.env`,
  no contiene `Math.random()`, y `handler.ts` contiene cero ocurrencias de
  `hostsToUse`. La única aleatoriedad por defecto permanece en el composition root de
  `handler.ts:43`.
- D4e se cumple: el diff de `handler_test.ts` es vacío y sus diez goldens pasan 10/0
  sin modificación. `index.ts`, `index 2.ts`, `handler_test.ts` y `_shared/` tampoco
  cambiaron. `git diff --check` es limpio y el commit de código toca exactamente los
  tres ficheros de `F`.
- D5e se cumple: `matching_test.ts` pasa 8/0 y la suite completa desde
  `supabase/functions` termina en 446 passed / 0 failed con
  `deno test --allow-all --no-check .`.
- D6e se cumple: `npm run build` termina con exit 0. El gate por fichero arroja
  `handler.ts = (tsc 0, eslint 1, deno lint 1, deno check 3)`, `matching.ts =
  (0,0,1,0)` y `matching_test.ts = (0,0,0,0)`.
- Contra el padre, `handler.ts` era `(0,1,2,8)`. Los cinco TS7006 eliminados son la
  consecuencia del retorno tipado, no una reparación manual; los cinco diagnósticos
  restantes solo cambian de línea. El aviso de `TARGET_GUEST_SIDE_FOR_DINNER` sale de
  `handler.ts:192` y reaparece con el mismo símbolo, regla y mensaje en
  `matching.ts:98`. Lo clasifico como desplazamiento aceptable bajo la revisión manual
  de D8.4 aunque el fichero destino sea nuevo: el bloque que contiene la declaración
  se movió exacto y no existe un defecto nuevo.
- Los totales globales medidos fueron `(tsc 1039, eslint 161, deno lint 92, deno check
  43)`. El padre dio `(1039,161,92,48)` con las mismas herramientas. Por tanto se
  confirma el delta 48 → 43 y la conservación 92 → 92. El 161 de ESLint difiere del
  160 anotado por el PM, pero es idéntico en padre y punta y D8.5 lo define como
  observación, no criterio.
- Vitest dio 1054 pass / 15 fail tanto en punta como en padre. En ambos aparecen los
  seis casos conocidos de `MesaAbiertaDashboard` y los ocho de `usePresentationState`
  por `localStorage`; el rojo restante rota dentro del backlog flake B-05
  (`ph.concurrency` en punta, `ph.cancel` en padre). Ninguno de los tres ficheros de
  `F` es cargado por Vitest, por lo que no hay rojo atribuible a P3b.
- La secuencia de cuatro shuffles no cambia: hosts e invitados se procesan dentro de
  `planSeating` antes de volver al handler; después se barajan la comida del host y la
  de sus invitados. `handler_test.ts` conserva un `referenceShuffle` local, no importa
  el helper de producción. Si el helper de producción derivase, los goldens 5 y 6 no
  cambiarían su referencia junto con él y detectarían la divergencia.
- El aliasing de `activeHosts`/`waitlistHosts` con los objetos de `hostStatus` es
  interno, explícito y equivalente al bloque original. No contradice la pureza que
  importa aquí: `planSeating` no muta los arrays ni objetos de entrada (también lo
  confirmé ejecutándolo con entradas congeladas). Los `console.log`/`console.warn`
  son los logs operativos preservados por D10, no I/O de datos ni texto de usuario.
- `matching_test.ts` no usa doble de Supabase, `fetch`, fixtures de `auth.users` ni
  estado compartido, cumpliendo D12.
- La frontera no dificulta P4: `hostStatus` ya representa el asiento final que
  `allocateAll` necesitará consumir y `SeatingPlan` puede crecer con
  `mainDishCoverage` y `tablesWithShortfall` sin devolver la decisión al handler ni
  volver a cortar la ruta HTTP/escritura. El tipado de disponibilidad de plato y los
  resultados de comida pertenecen precisamente al incremento previsto de P4.
- B-08 queda efectivamente reducido a tres diagnósticos de `deno check`; la línea base
  correcta de `handler.ts` para P4 es `(0,1,1,3)`.
