# CASA BILINGUE census method

METHOD METADATA

- SOURCE_SHA: `e0c9342edcd1d9eddea0662244bf1934bfdb5cb0`
- PLAN_SHA: `c842161d0edcba560a077fdb81b31edad2f23396`
- TARGET_OS: macOS, Darwin 24.3.0
- TARGET_LOCALE: `en_US.UTF-8`
- IMPLEMENTATION: `docs/plan/bilingue/evidence/census.sh`

This document fixes the method that D1b will run. It contains no run output. The implementation is
syntax-checked but not executed in D1a.

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
The accepted extensions are `.ts`, `.tsx`, and `.json`. Paths containing `__tests__`, names matching
`*.test.*`, and copied TypeScript artifacts whose basename ends in a space followed by a decimal
digit are excluded.

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
