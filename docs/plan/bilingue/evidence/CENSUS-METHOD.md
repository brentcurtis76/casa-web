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

The exclusion rule runs in two stages. **Stage one** is these four `/usr/bin/find` name predicates,
in this order:

```text
-not -path '*__tests__*'
-not -name '*.test.*'
-not -name '*_test.*'
-not -regex '.* [0-9]\.(ts|tsx)'
```

The first three exclude test code under the two conventions this repository uses for test *modules*:
`__tests__/` directories and `*.test.ts`/`*.test.tsx` under `src/`, and the Deno underscore
convention `*_test.ts` used throughout `supabase/functions/`. **Test files are excluded because the
census measures user-visible copy surfaces, and a test file emits nothing to a user.** Its Spanish
literals are assertions and fixtures — expected values quoted from the module under test — so
counting them double-counts the production string and inflates every sizing decision D1b feeds.
The fourth predicate excludes copied TypeScript artifacts whose basename ends in a space followed by
a decimal digit.

**Stage two** is a referrer-based predicate applied to `.json` paths only, fixed in the next
section. It exists because a name predicate cannot reach test *data*: a captured baseline follows no
naming convention, so there is no name to predicate on.

### Stage two: test data is excluded by who refers to it, not by what it is called

A `.json` that survives stage one is excluded when it is named by at least one `.ts`/`.tsx` file
under `src/` or `supabase/` **and every** file that names it is a test file. A `.json` that no module
names at all is **kept**: the safe direction of this rule is to include, because an unreferenced data
file may still be loaded through a path assembled at runtime.

"Names it" is basename containment, not import resolution. That is deliberately looser than an
import graph — it counts `fixedElementFile: 'la-paz.json'` and
`fetch('/data/elementos-fijos/index.json')` as referrers, and neither is an `import` statement. A
looser referrer set can only ever *keep* a data file, never drop one, so the imprecision runs in the
safe direction.

A referrer counts as a test file when its path matches this exact ERE — the same three conventions
stage one uses:

```text
(^|/)__tests__/|\.test\.[^/]+$|_test\.[^/]+$
```

`census.sh` implements this as `json_is_test_evidence`. Applied standalone to the stage-one `.json`
candidates over the configured roots, it classifies the following path as test evidence:

```bash
export LC_ALL=en_US.UTF-8
ROOTS=$(/usr/bin/sed -n '/^PASS_A_ROOTS=(/,/^)/p' docs/plan/bilingue/evidence/census.sh \
  | /usr/bin/grep -vE '^(PASS_A_ROOTS=\(|\))' | /usr/bin/tr -d ' ')
/usr/bin/find -E $(echo $ROOTS) src/lib/whatsapp -type f -name '*.json' \
  -not -path '*__tests__*' -not -name '*.test.*' -not -name '*_test.*' | /usr/bin/sort -u \
| while IFS= read -r f; do
    refs=$(/usr/bin/grep -rlF --include='*.ts' --include='*.tsx' -- "${f##*/}" src supabase \
      | /usr/bin/sort -u || true)
    [ -n "$refs" ] || { printf 'NO REFERRER (kept): %s\n' "$f"; continue; }
    printf '%s\n' "$refs" \
      | /usr/bin/grep -qvE '(^|/)__tests__/|\.test\.[^/]+$|_test\.[^/]+$' \
      || printf 'TEST EVIDENCE (excluded): %s\n' "$f"
  done
```

```text
TEST EVIDENCE (excluded): supabase/functions/generate-story/corpus_pd_base.json
```

`corpus_pd_base.json` is a captured baseline of the prompt corpus, re-captured by a documented
script and read only by `corpus_parity_test.ts`. It is not named `*_test.*`, does not sit in a
`__tests__` directory, and follows no naming convention at all — no name predicate could have
reached it, and the next captured baseline will be named differently again.

**What this rule cannot do.** It reads referrers inside `src/` and `supabase/` only, so a `.json`
referenced solely from a build script, a Deno task or a CI workflow is treated as unreferenced and
therefore kept — the safe direction, but not a correct classification. It applies to `.json` alone:
a `.ts` module that is test-only but named like production is not caught, because excluding a `.ts`
on referrer evidence could drop real copy. And it cannot decide whether a *production* referrer
actually renders the file's Spanish to a user; that question belongs to the call-path audit fixed in
`SURFACE-SCHEMA.md`.

### The `*_test.*` predicate: both claims, each with its command

`*_test.*` was absent from stage one until D1a round 2. Only the dot convention was excluded, so the
Deno test files inside the roots were selected and counted. Excluding the convention drops no copy
surface. That rests on two separate claims, and each carries its own command below. Round 2 asserted
the first and supplied a command for only the second; that gap is corrected here.

**Claim one — every file the predicate excludes declares a test runner.** The check enumerates the
excluded set from the committed roots rather than a written-down list, refuses to pass vacuously if
that set is empty, and exits non-zero naming any file that does not declare `Deno.test`:

```bash
export LC_ALL=en_US.UTF-8
ROOTS=$(/usr/bin/sed -n '/^PASS_A_ROOTS=(/,/^)/p' docs/plan/bilingue/evidence/census.sh \
  | /usr/bin/grep -vE '^(PASS_A_ROOTS=\(|\))' | /usr/bin/tr -d ' ')
EXCLUDED=$(/usr/bin/find -E $(echo $ROOTS) src/lib/whatsapp -type f -regex '.*\.(ts|tsx|json)$' \
  -name '*_test.*' | /usr/bin/sort -u)
[ -n "$EXCLUDED" ] || { printf 'FAIL: the *_test.* predicate excludes nothing here — the claim would pass vacuously\n'; exit 1; }
NOT_A_TEST=$(printf '%s\n' "$EXCLUDED" | while IFS= read -r f; do
  /usr/bin/grep -qE '(^|[^[:alnum:]_$.])Deno\.test[[:space:]]*[({]' "$f" || printf '%s\n' "$f"
done)
[ -z "$NOT_A_TEST" ] || { printf 'FAIL: excluded by *_test.* but declares no Deno.test runner:\n%s\n' "$NOT_A_TEST"; exit 1; }
printf 'OK: every file the *_test.* predicate excludes declares a Deno.test runner\n'
```

```text
OK: every file the *_test.* predicate excludes declares a Deno.test runner
```

That the check is capable of failing was established rather than assumed. Against a synthetic
`*_test.ts` that declares no runner, it names the file and exits 1:

```bash
export LC_ALL=en_US.UTF-8
SCRATCH=$(/usr/bin/mktemp -d)
printf 'export const copy = "Guardar";\n' > "$SCRATCH/impostor_test.ts"
NOT_A_TEST=$(printf '%s\n' "$SCRATCH/impostor_test.ts" | while IFS= read -r f; do
  /usr/bin/grep -qE '(^|[^[:alnum:]_$.])Deno\.test[[:space:]]*[({]' "$f" || printf '%s\n' "${f##*/}"
done)
[ -z "$NOT_A_TEST" ] || { printf 'FAIL: excluded by *_test.* but declares no Deno.test runner:\n%s\n' "$NOT_A_TEST"; /bin/rm -rf "$SCRATCH"; exit 1; }
printf 'OK\n'; /bin/rm -rf "$SCRATCH"
```

```text
FAIL: excluded by *_test.* but declares no Deno.test runner:
impostor_test.ts
(exit 1)
```

**Claim two — no non-test module imports a `*_test` module:**

```bash
/usr/bin/grep -rnE "from ['\"][^'\"]*_test(\.ts)?['\"]" src supabase \
  '--include=*.ts' '--include=*.tsx' | /usr/bin/grep -vE '_test\.ts:'
# exit 1, no output — no production importer
```

**The limit both claims leave open.** A declared test runner and an absent importer together show
that these files are tests and that no production module pulls their strings in. Neither shows that
a test file emits nothing to a user by some other route — a test that itself wrote to a user-visible
sink would satisfy both checks and still be excluded. An importer search cannot close that gap; only
the call-path audit in `SURFACE-SCHEMA.md` can, and it is scoped to production surfaces. This is a
stated blind spot under D-N, not a proven absence.

### A retracted claim

Round 2 of this artifact stated: *"No other test, spec, mock or fixture convention occurs in the
configured roots at SOURCE_SHA."* **That claim is retracted.** It was falsified by
`corpus_pd_base.json`, which is test evidence inside the roots and which the survey below does not
see — the survey searches names, and that file's name says nothing. Codex found it in D1a round 1 of
final review. The failure was not the survey; it was extending a name-based finding into a claim
about fixtures, which are not identified by name.

What the survey below actually supports is narrower, and is all that is claimed now: **no test, spec
or mock *naming* convention beyond the three already excluded occurs in the configured roots at
SOURCE_SHA.** Test *data* does occur there, under no naming convention at all, and stage two above is
what catches it. Over the candidate set produced by the roots and the extension filter, every path
whose name contains `test` in any case is covered by one of the three name predicates, and
`.spec.`/`_spec.`, `__mocks__`, and `test/` or `tests/` directory segments match nothing:

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

The fixture helpers *named as such* — `pbImageFixtures.ts`, `pcuiWarningFixtures.ts` and
`phFixtures.ts` — all sit inside `src/lib/cuentacuentos/__tests__/` and are already excluded by the
first predicate. They are not the whole population of test evidence in the roots, and this paragraph
no longer claims they are: unnamed test data is stage two's problem, not stage one's. No predicate is
added for a *naming* convention that matches no file: the method is locked
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
