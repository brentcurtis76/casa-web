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
cp scripts/gates/changed-files-diagnostics.sh /tmp/upgrade-base/scripts/gates/
cd /tmp/upgrade-base && bash scripts/gates/changed-files-diagnostics.sh <los 11 ficheros>
git worktree remove /tmp/upgrade-base
```

El resultado, con su cabecera de SHA y comando, está en
`docs/plan/upgrade/evidence/base-by-file.txt`.
