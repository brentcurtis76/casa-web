# CASA BILINGUE census method

METHOD METADATA

- SOURCE_SHA: `e0c9342edcd1d9eddea0662244bf1934bfdb5cb0`
- PLAN_SHA: `c842161d0edcba560a077fdb81b31edad2f23396`
- TARGET_OS: macOS, Darwin 24.3.0
- TARGET_LOCALE: `en_US.UTF-8`
- IMPLEMENTATION: `docs/plan/bilingue/evidence/census.sh`

This document fixes the method that D1b will run. It contains no run output. D1a executes the
implementation only to verify which files it selects; no count, total or file number from that run
is recorded in this or any other D1a artifact.

## Process and locale rules

`census.sh` runs under `/bin/bash` from the repository root of a clean checkout. It exports
`LC_ALL=en_US.UTF-8` once before invoking any measurement process. Every external process has an
absolute path. The implementation uses `/usr/bin/git`, `/usr/bin/find -E`, `/usr/bin/sort -u`,
`/usr/bin/grep`, `/usr/bin/wc`, and `/usr/bin/awk`; it does not invoke a shell alias, function, or
`PATH`-resolved replacement for those tools.

The source tree must match SOURCE_SHA under `src/` and `supabase/`. Documentation-only commits on top
of SOURCE_SHA are allowed. A changed tracked or untracked source file makes the script exit non-zero.
Every configured root must exist before collection begins.

## Shared file-selection rules

Both passes use the same selector, except that Pass B adds `src/lib/whatsapp` to the Pass A roots.
The accepted extensions are `.ts`, `.tsx`, and `.json`.

The complete exclusion rule is these four `/usr/bin/find` predicates, in this order:

```text
-not -path '*__tests__*'
-not -name '*.test.*'
-not -name '*_test.*'
-not -regex '.* [0-9]\.(ts|tsx)'
```

The first three exclude test code under the two conventions this repository actually uses:
`__tests__/` directories and `*.test.ts`/`*.test.tsx` under `src/`, and the Deno underscore
convention `*_test.ts` used throughout `supabase/functions/`. **Test files are excluded because the
census measures user-visible copy surfaces, and a test file emits nothing to a user.** Its Spanish
literals are assertions and fixtures — expected values quoted from the module under test — so
counting them double-counts the production string and inflates every sizing decision D1b feeds.
The fourth predicate excludes copied TypeScript artifacts whose basename ends in a space followed by
a decimal digit.

`*_test.*` was absent from the rule until D1a round 2. Only the dot convention was excluded, so the
Deno test files inside the roots were selected and counted. Every selected `*_test.ts` was confirmed
to be a test — each declares `Deno.test` — and no non-test module in `src/` or `supabase/` imports
any `*_test` module, so excluding the convention drops no copy surface:

```bash
/usr/bin/grep -rnE "from ['\"][^'\"]*_test(\.ts)?['\"]" src supabase \
  '--include=*.ts' '--include=*.tsx' | /usr/bin/grep -vE '_test\.ts:'
# exit 1, no output — no production importer
```

No other test, spec, mock or fixture convention occurs in the configured roots at SOURCE_SHA. That
is a measured claim, not an assumption: over the candidate set produced by the roots and the
extension filter, every path whose name contains `test` in any case is covered by one of the three
predicates above, and `.spec.`/`_spec.`, `__mocks__`, and `test/` or `tests/` directory segments
match nothing.

```bash
export LC_ALL=en_US.UTF-8
ROOTS=$(/usr/bin/sed -n '/^PASS_A_ROOTS=(/,/^)/p' docs/plan/bilingue/evidence/census.sh \
  | /usr/bin/grep -vE '^(PASS_A_ROOTS=\(|\))' | /usr/bin/tr -d ' ')
/usr/bin/find -E $(echo $ROOTS) src/lib/whatsapp -type f -regex '.*\.(ts|tsx|json)$' \
  -not -regex '.* [0-9]\.(ts|tsx)' | /usr/bin/sort -u > /tmp/candidates.txt
/usr/bin/grep -iE 'test' /tmp/candidates.txt \
  | /usr/bin/grep -vE '__tests__|/[^/]*\.test\.[^/]*$|_test\.(ts|tsx|json)$'
# exit 1, no output
/usr/bin/grep -iE '__mocks__|[._]spec\.|/tests?/' /tmp/candidates.txt
# exit 1, no output
```

The fixture helpers that do exist — `pbImageFixtures.ts`, `pcuiWarningFixtures.ts` and
`phFixtures.ts` — all sit inside `src/lib/cuentacuentos/__tests__/` and are already excluded by the
first predicate. No predicate is added for a convention that matches no file: the method is locked
against SOURCE_SHA, so an exclusion that removes nothing could never be justified against a file,
and adding one would be untestable decoration. A new convention appearing later is an extension, and
the extension rule below governs it.

The copied-artifact exclusion is implemented with BSD extended regular expressions by invoking
`/usr/bin/find -E` and applying `.* [0-9]\.(ts|tsx)`. Bare `find -regex` is not interchangeable with
this rule. All selected paths are normalized by `/usr/bin/sort -u` before either pass.

The complete Pass A roots are:

```text
src/components/liturgia-builder
src/components/liturgia
src/lib/liturgia
src/pages/ConstructorLiturgiasPage.tsx
src/data/elementos-fijos
src/components/presentation
src/lib/presentation
src/hooks/presentation
src/lib/cuentacuentos
src/lib/children-ministry
src/lib/music-planning
src/types/shared/liturgy.ts
supabase/functions/generate-story
supabase/functions/refine-story
supabase/functions/generate-oraciones
supabase/functions/generate-children-lesson
supabase/functions/refine-children-lesson
supabase/functions/fetch-bible-passage
supabase/functions/process-reflexion-pdf
supabase/functions/send-children-service-packet
supabase/functions/send-music-service-packet
supabase/functions/wa-send
supabase/functions/wa-reminders
supabase/functions/_shared/whatsapp
```

The Pass B roots are exactly the Pass A roots plus:

```text
src/lib/whatsapp
```

## Pass A

Pass A uses this exact ERE character class:

```text
[áéíóúñüÁÉÍÓÚÑÜ¿¡]
```

Its codepoints, in class order, are:

```text
U+00E1 U+00E9 U+00ED U+00F3 U+00FA U+00F1 U+00FC
U+00C1 U+00C9 U+00CD U+00D3 U+00DA U+00D1 U+00DC U+00BF U+00A1
```

For `.ts` and `.tsx`, a matching line is excluded when the original line matches this exact ERE:

```text
^[[:space:]]*(//|\*|/\*)
```

That is a deliberate line-oriented rule. It removes full-line comments and block-comment lines
whose first non-space token is `*` or `/*`; it retains code followed by an inline comment and does
not attempt to parse strings. JSON is not passed through the comment filter.

## Pass B

Pass B reads the committed `wordlist-passB.txt`, ignoring blank lines and lines beginning with `#`.
It joins these entries with `|` and matches the exact ERE `\b(WORDS)\b` using `/usr/bin/grep -E`.
Matching is case-sensitive: no `-i` flag or case folding is permitted. The boundary is BSD grep's
`\b` word boundary under the exported locale. The comment treatment is identical to Pass A.

The complete list is:

```text
Guardar
Guardando
Cancelar
Cerrar
Buscar
Eliminar
Editar
Nuevo
Nueva
Crear
Agregar
Borrar
Aceptar
Volver
Siguiente
Anterior
Enviar
Enviando
Descargar
Cargando
Cargar
Seleccionar
Elegir
Filtrar
Ordenar
Mostrar
Ocultar
Copiar
Confirmar
Continuar
Salir
Ayuda
Nombre
Fecha
Archivo
Imagen
Todos
Todas
Ninguno
Ninguna
Mensaje
Correo
Usuario
Cantidad
Actualizar
Activar
Desactivar
Duplicar
Vista previa
```

The following ambiguous or English-overlapping tokens are deliberately excluded:

```text
Error
Total
Ver
Sin
Con
Para
Tipo
Lista
Estado
Hora
```

This is a precision-over-recall choice: a Pass B match should be useful evidence of Spanish UI copy,
even though the method knowingly misses unaccented Spanish outside the frozen list. Adding, removing,
recasing, or stemming a token changes the method and is forbidden in D1b.

## Reporting and arithmetic

The passes are reported separately. They are not unioned and neither is labelled as the census's
single authoritative answer. For each pass, `census.sh` emits one row per selected path and a summary
row. Pass A records matching non-comment lines. Pass B records matching non-comment lines and the
subset whose line has no Pass A character. Shell integer arithmetic accumulates those per-path values.

The script never prints source-line contents. This keeps paths and measurements available without
copying values that could contain personal data.

## Structural blind spots and extension rule

This method is a reproducible candidate floor, not a completeness proof. It cannot find declarations
outside the frozen roots, Spanish without a Pass A character or a frozen Pass B token, text assembled
dynamically without one of those markers, runtime database values, external registries, text baked
into image pixels, or a declaration whose emitted value only becomes visible through a separate file.

D1b addresses part of that blind spot with the call-path audit fixed in `SURFACE-SCHEMA.md`. A future
extension must add a new reviewed method phase before measuring: examples include a repository-wide
AST literal pass, runtime sink instrumentation, database provenance fixtures, OCR over generated
assets, and explicit exports from external registries. Results from distinct methods remain separately
labelled rather than silently merged.
