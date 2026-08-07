# `scripts/gates/` — herramientas del gate D8

## Qué es esto

`changed-files-diagnostics.sh` implementa la medición que exige la decisión **D8** de
`docs/plan/upgrade/PLAN.md`:

> Para cada fase, siendo `F` la lista de ficheros que la fase modifica o crea:
> **cero diagnósticos nuevos en `F`**, comparando **mensajes crudos completos**, no
> recuentos ni códigos.

El repo arrastra una línea base grande de diagnósticos preexistentes (en `1732bee`:
**1041** líneas `error TS`, **160** problemas de ESLint, **94** de `deno lint` y **46**
de `deno check`). Arreglarlos es un no-objetivo explícito del workstream UPGRADE. Por eso
el gate no puede ser "el recuento total bajó": tiene que ser "los mensajes crudos
atribuibles a los ficheros que toqué no ganaron un miembro nuevo".

## Invocación

```bash
scripts/gates/changed-files-diagnostics.sh <fichero> [<fichero> ...]
```

Las rutas son **relativas a la raíz del repo** y la salida respeta el orden en que se
piden. Ejemplo real:

```bash
bash scripts/gates/changed-files-diagnostics.sh \
  src/components/mesa-abierta/MesaAbiertaAdmin.tsx \
  supabase/functions/create-mesa-matches/index.ts
```

```
=== src/components/mesa-abierta/MesaAbiertaAdmin.tsx
--- tsc (12)
src/components/mesa-abierta/MesaAbiertaAdmin.tsx(1689,57): error TS2339: Property 'hostsConvertedToGuests' does not exist on type '{ … }'.
…
--- eslint (14)
src/components/mesa-abierta/MesaAbiertaAdmin.tsx(1036,21): error @typescript-eslint/no-explicit-any: Unexpected any. Specify a different type.
…
--- deno lint (0)
--- deno check (0)
=== supabase/functions/create-mesa-matches/index.ts
--- tsc (0)
--- eslint (0)
--- deno lint (4)
…
--- deno check (6)
TS18046 [ERROR]: 'error' is of type 'unknown'.
        error: error.message,
               ~~~~~
    at supabase/functions/create-mesa-matches/index.ts:497:16
…
```

Una ruta que **no existe** no rompe el script: emite la cabecera con `(0)` en las cuatro
herramientas. Las fases posteriores pasan rutas de ficheros que aún no existen en el
commit padre (`mainDish.ts` de P2, `dinnerSummary.ts` de P8, …) y eso es correcto.

Tarda ~40–60 s: cada herramienta se ejecuta **una sola vez** sobre todo el proyecto y
después se filtra la salida a todas las rutas pedidas.

## Qué herramienta cubre qué parte del árbol

| Herramienta | Comando | cwd | Cubre |
|---|---|---|---|
| `tsc` | `npx tsc -p tsconfig.app.json --noEmit` | raíz | la app de Vite (`src/`) |
| ESLint | `npx eslint . -f json` | raíz | la app de Vite y scripts sueltos de la raíz |
| `deno lint` | `deno lint --json` | `supabase/functions/` | solo las Edge Functions |
| `deno check` | `deno check .` | `supabase/functions/` | solo las Edge Functions |

Por eso **un fichero muestra legítimamente `(0)` en dos de las cuatro**: un componente de
`src/` no lo ve Deno, y una Edge Function no la ve `tsconfig.app.json`. La sección se
imprime igual con su `(0)`; una sección ausente se leería como un fallo del script.

`npx eslint . -f json`, nunca `npm run lint -f json`: npm se come el `-f` y lo interpreta
como `--force`.

## La regla D8 que sirve este script

1. Se ejecuta el script sobre `F` en el **commit padre inmediato de la fase**, y otra vez
   en la punta de la rama de la fase.
2. Se hace `diff` de las dos salidas.
3. **Un humano clasifica cada diferencia**, y solo hay dos clases:
   - **desplazamiento de línea** — mismo mensaje, distinta línea/columna porque el
     fichero creció o encogió por encima. **Aceptable.**
   - **diagnóstico nuevo** — un mensaje que no estaba. **BLOQUEANTE.**

La comparación es contra la **fase padre inmediata**, no siempre contra `1732bee`. Comparar
siempre contra la base permitiría reintroducir un diagnóstico que una fase intermedia ya
había eliminado. `docs/plan/upgrade/evidence/base-by-file.txt` es solo el padre de la
primera fase que toca cada fichero.

Con `|F| ≤ 10` el `diff` es de unas pocas decenas de líneas y la clasificación a ojo
lleva minutos. Ese es el diseño, no un atajo.

## Sin canonicalización — a propósito

El script **no** canonicaliza, **no** hashea y **no** agrupa en cubos. La salida es el
texto crudo del mensaje, filtrado por ruta y ordenado.

Una revisión anterior del plan sí intentó un esquema global de identidad de diagnósticos
sobre los 1041 mensajes, y se le demostraron **62 cubos de colisión**: falsos negativos
que por construcción no se ven. Ese enfoque fue **retirado** (LEDGER, ronda 5). No se
reintroduce.

La **única** normalización que hace el script es reescribir la línea de localización de
`deno check`, que trae la ruta absoluta y percent-encoded del checkout
(`at file:///Users/…/supabase/functions/create-mesa-matches/index%202.ts:310:72`), a ruta
relativa al repo (`at supabase/functions/create-mesa-matches/index.ts:310:72`). Sin eso la
base tomada en el worktree `/tmp/upgrade-base` no sería comparable con nada medido en el
checkout normal, y **todos** los diagnósticos de `deno check` parecerían nuevos. El texto
del mensaje no se toca.

## Cómo se agrupan los diagnósticos multilínea

Dos de las cuatro herramientas emiten diagnósticos de varias líneas. El recuento entre
paréntesis cuenta **diagnósticos**, no líneas.

- **`tsc`** — la cabecera empieza en la columna 0 con `ruta(línea,col): error TSxxxx: …`
  y las continuaciones (`Overload 1 of 2, …`, `Type 'X' is not assignable …`) van
  indentadas. Un diagnóstico va desde una cabecera hasta la siguiente. Verificado en
  `1732bee`: las 1041 líneas de columna 0 son cabeceras y ninguna continuación contiene
  `error TS`, así que la agrupación no es ambigua.
- **`deno check`** — no tiene modo JSON. El bloque va desde una línea
  `TSxxxx [ERROR]: …` en columna 0 hasta su **primera** línea `    at file://…:l:c`, que
  es la que da el fichero, incluida. El mensaje viene antes que la localización, así que
  un `grep <ruta>` ingenuo devuelve la localización sin el mensaje: por eso se agrupa.
  Verificado en `1732bee`: 46 bloques `[ERROR]` y 46 líneas `at file://`, correspondencia
  1:1. **Limitación declarada**: si una versión futura de Deno emitiera un bloque con más
  de una línea `at file://` (una traza), este script atribuiría el bloque a la primera y
  descartaría el resto de la traza. Hoy no ocurre; si el recuento de `[ERROR]` y el de
  `at file://` dejan de coincidir, hay que revisar esta agrupación.

Las líneas de progreso `Check <ruta>` de `deno check` se descartan (dependen de la caché
de Deno) y también el resumen final `Found N errors.` / `error: Type checking failed.`.

## Detección de "la herramienta no corrió" — por qué existe

**El modo de fallo que esto cierra.** Hasta la ronda 1 el script se tragaba el fallo de
cualquier herramienta. `readJson()` capturaba todo error de parseo y devolvía `null`, que
acababa en `[]`; si `tsc` no arrancaba, `tsc.txt` simplemente no traía cabeceras y daba
cero diagnósticos. No se escribía nada por stderr y el código de salida seguía siendo 0.
Con `deno` fuera del `PATH`, la salida era esta:

```
$ env PATH="$(dirname $(which node)):/usr/bin:/bin" \
    bash scripts/gates/changed-files-diagnostics.sh supabase/functions/create-mesa-matches/index.ts
EXIT=0
=== supabase/functions/create-mesa-matches/index.ts
--- tsc (0)
--- eslint (0)
--- deno lint (0)
--- deno check (0)
```

La base real de ese fichero es `deno lint (4)` y `deno check (6)`.

Un gate que puede devolver cero en silencio es **peor que no tener gate**. El criterio de
D8 es "cero diagnósticos **nuevos**": una ejecución que emite todos ceros lo cumple
trivialmente, así que una cadena de herramientas rota no falla el gate — lo **aprueba**,
en silencio, para todas las fases. Sin gate, al menos nadie cree estar cubierto.

**Los recuentos globales van SIEMPRE por stderr.** Cada ejecución emite:

```
[gates] totales del proyecto: tsc=1041 eslint=160 deno-lint=94 deno-check=46
```

Es exactamente lo que pide `PLAN.md` D8 punto 5: una **observación** para detectar
sorpresas, no un criterio de aprobación. Van por **stderr y no por stdout** porque stdout
es el artefacto que se difea entre el commit padre y la punta de la rama: meter los
totales ahí inyectaría una línea de ruido en cada comparación e invalidaría
`docs/plan/upgrade/evidence/base-by-file.txt`.

**Qué distingue una ejecución limpia de una herramienta caída.** El recuento global a
solas no lo distingue — cero diagnósticos es un resultado legítimo — así que el script
captura el **código de salida** de cada frontera de comando y clasifica cada herramienta
sobre (código de salida, validez de la salida, recuento):

- **ESLint y `deno lint`** tienen modo JSON, y ahí la señal fuerte de que la herramienta
  corrió es que su salida **parsea a la forma esperada**: un array de resultados para
  ESLint (una ejecución limpia imprime `[]`, que es JSON válido) y un objeto con
  `.diagnostics` para `deno lint` (limpio: `{"version":1,"diagnostics":[]}`). Binario
  ausente o crash dejan stdout vacío o con basura, y el parseo o la forma fallan. Un
  código de salida `> 1` de ESLint (su convención reserva el 2 para errores fatales)
  también cuenta como caída aunque hubiera JSON.
- **`tsc` y `deno check`** no tienen modo JSON, así que el código de salida lleva más
  peso: salida `0` es una ejecución limpia; salida distinta de `0` **con** diagnósticos
  atribuidos es la ejecución normal en rojo de base (lo que hace toda ejecución real en
  este repo); salida distinta de `0` **sin ningún** diagnóstico utilizable (127 por
  binario ausente, un crash, un formato irreconocible) es una caída.

Cuando una herramienta se clasifica como caída, el script escribe por stderr cuál y por
qué, incluye su stderr capturado y **sale con código distinto de cero**. Una ejecución
limpia de verdad — comandos con éxito y salida válida aunque vacía — sale con `0`: cero
diagnósticos **no** es evidencia de fallo, y los recuentos globales siguen siendo solo la
observación de D8 punto 5, nunca un criterio.

## Detalles de implementación que no son opcionales

- **No hay `set -e`.** Las cuatro herramientas salen con código distinto de cero cuando
  encuentran problemas, y en este repo siempre lo hacen.
- `NO_COLOR=1` + un filtro de escapes ANSI: `deno check` colorea incluso a través de una
  tubería, y sin esto la comparación de "mensaje crudo" diferiría en códigos de color.
- El `filePath` de ESLint es **absoluto** y el `filename` de `deno lint` es una URL
  `file://`; ambos se relativizan a la raíz del repo para que casen con el argumento que
  pasó quien llama.
- Determinismo (Z4): dentro de cada sección los diagnósticos se ordenan, y la salida no
  lleva marcas de tiempo, rutas absolutas, nombres de máquina, PIDs ni tiempos.
- La raíz del repo se deduce con `git rev-parse --show-toplevel` desde la ubicación del
  propio script, de modo que funciona igual dentro de un `git worktree`.

## Cómo se capturó la línea base

```bash
git worktree add /tmp/upgrade-base 1732bee
ln -s /Users/brentcurtis/dev/casa-web/node_modules /tmp/upgrade-base/node_modules
mkdir -p /tmp/upgrade-base/scripts/gates   # scripts/gates/ no existe en 1732bee
cp scripts/gates/changed-files-diagnostics.sh /tmp/upgrade-base/scripts/gates/
cd /tmp/upgrade-base && bash scripts/gates/changed-files-diagnostics.sh <los 11 ficheros>
git worktree remove /tmp/upgrade-base
```

El resultado, con su cabecera de SHA y comando, está en
`docs/plan/upgrade/evidence/base-by-file.txt`.
