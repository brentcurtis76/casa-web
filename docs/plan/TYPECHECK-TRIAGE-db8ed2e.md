# Triaje del gate de tipos — 1.039 errores

**Base medida:** `db8ed2e` (main), worktree `great-fermi-33af52`
**Entorno:** node v22.22.0, TypeScript 5.9.3, macOS 24.3.0
**Fecha:** 2026-08-12

---

## 1. El gate anterior era vacío

`npx tsc --noEmit` type-checkea CERO archivos y sale 0.

```
$ npx tsc --noEmit --listFiles | wc -l
       0
$ echo $?
0
```

Causa: el `tsconfig.json` raíz es solution-style — `"files": []` más `references` a
`./tsconfig.app.json` y `./tsconfig.node.json`. `tsc` a secas respeta `files: []` y no
recorre las project references; eso requiere `tsc -b`.

```
$ npx tsc -b --dry
A non-dry build would build project '.../tsconfig.app.json'
A non-dry build would build project '.../tsconfig.node.json'
```

## 2. Gate elegido

```
npm run typecheck   →   tsc -b --force --noEmit
```

| candidato | sigue references | caché | artefactos | resultado |
|---|---|---|---|---|
| `tsc --noEmit` | no | — | — | 0 archivos, exit 0 ❌ |
| `tsc -p app && tsc -p node` | no (hay que listarlos a mano) | no | ninguno | correcto pero se desincroniza si se añade un tercer proyecto |
| **`tsc -b --force --noEmit`** | **sí** | **anulada por `--force`** | `*.tsbuildinfo` (ya en `.gitignore:53`) | **1.039 errores, exit 2, ~23s** ✅ |

`--force` es deliberado: sin él, `tsc -b` consulta `.tsbuildinfo` y un gate podría
reportar PASS sin haber revisado nada. Se verificó que la salida de
`tsc -b --force --noEmit` es **idéntica** a la de `tsc -p tsconfig.app.json --noEmit`
(el proyecto node está limpio, exit 0).

### 2.1 Propagación a los agentes (sin esto el arreglo no sirve)

Cambiar `CLAUDE.md` no basta: los agentes del pipeline leen sus propios archivos y
son ellos quienes ejecutan el gate. Se actualizaron a `npm run typecheck`:

```
.claude/agents/developer.md:45,73        .claude/skills/pipeline-qa.md:26,76
.claude/agents/pm.md:109,172,408         .skills/skills/casa-project/SKILL.md:49,144
.claude/skills/pipeline-context.md:104   docs/OPERATING_PROCEDURES.md:182,270,353
.claude/skills/pipeline-dev.md:27,104
```

`.claude/agents/pm.md:408` era el caso crítico — la tabla de decisión aprobar/rechazar
del PM decía literalmente ``Must pass: `npx tsc --noEmit` ``, así que el PM aprobaba
sobre un gate vacío.

Se dejó **sin tocar** `.skills/skills/genera-project/SKILL.md:48`: es otro proyecto
(Genera), con su propia configuración de TypeScript.

Los archivos históricos (`reports/*/GATE-REPORT.md`, `docs/PROMPT_027_*`,
`docs/CUENTACUENTOS_OVERHAUL_REVIEW.md`) conservan el comando viejo a propósito: son
registro de lo que se ejecutó entonces, no instrucciones.

### 2.2 Piso de versión de TypeScript

`tsc -b --noEmit` exige TypeScript **≥ 5.6**. `package.json` declaraba `^5.5.3`.
Medido:

```
$ npx -p typescript@5.5.3 tsc -b --force --noEmit
error TS5094: Compiler option '--noEmit' may not be used with '--build'.
$ echo $?
1
```

Falla cerrado (exit 1), no en falso verde — pero el rango declarado mentía sobre lo
que el repo necesita, y el "arreglo" evidente ante ese mensaje es quitar `--noEmit`,
que deshace el gate. Subido a `^5.6.0`; `package-lock.json` sincronizado (sigue
resolviendo 5.9.3).

## 3. Las opciones de tsconfig NO se tocaron

`tsconfig.app.json` **no hace `extends`** del raíz — es autónomo. Ya trae:

```jsonc
"strict": false,          // ⇒ strictNullChecks off
"noImplicitAny": false,
"noUnusedLocals": false,
"noUnusedParameters": false,
"noFallthroughCasesInSwitch": false
```

Los 1.039 errores son lo que produce esa configuración **ya laxa**. No hay margen de
"aflojar más" sin desactivar la comprobación por completo.

## 4. Triaje: 1.039 errores / 120 archivos

Clasificados por **causa raíz**, no por código TS (un solo defecto produce cascadas de
códigos distintos).

| # | grupo | errores | archivos | códigos dominantes |
|---|---|---:|---:|---|
| A | Tipos generados de Supabase obsoletos | **638** (61%) | 59 | TS2769×354, TS2352×161, TS2339×103 |
| E | Archivos duplicados muertos (`Nombre 2.tsx`) | **134** (13%) | 6 | TS2339×106, TS2322×11 |
| D2 | Errores reales de aplicación | **130** (13%) | 66 | TS2339×27, TS2345×25, TS2353×19 |
| B | `Transition.ease` de framer-motion | **76** (7%) | 14 | TS2322×76 |
| C | TS2589 "excessively deep" | **41** (4%) | 24 | TS2589×41 |
| D1 | `ringColor` en objetos `style` | **20** (2%) | 8 | TS2353×20 |

### Grupo A — tipos generados obsoletos (638, una sola regeneración)

`src/integrations/supabase/types.ts` declara **17 tablas**. La base tiene ~128 tablas
CASA. Lo que hay dentro:

```
casa_graphics_batches, casa_graphics_items, church_podcast_episodes, events,
mesa_abierta_admin_roles, mesa_abierta_assignments, mesa_abierta_dietary_restrictions,
mesa_abierta_email_logs, mesa_abierta_matches, mesa_abierta_months,
mesa_abierta_participants, mesa_abierta_photos, mesa_abierta_testimonials,
mesa_abierta_whatsapp_messages, profiles, published_resources, sermon_music_tracks
```

Falta **todo** `church_*` (salvo podcast), `music_*`, `liturgias*`, `presentation_*`,
`cuentacuentos_*`, `financial_*`, `graphics_*`. Cada `.from('music_songs')` degrada así:

1. `TS2769` — `Argument of type '"music_songs"' is not assignable to parameter of type 'never'`
2. el resultado pasa a `SelectQueryError<…>` o a la unión de las 17 filas conocidas
3. `TS2339` al leer cualquier propiedad, `TS2352` al castear, `TS2353` al insertar

Tablas más golpeadas: `liturgias`×17, `music_songs`×10, `church_leadership_recordings`×9,
`church_children_lessons`×9.

**El grupo C (41 × TS2589) casi con certeza es la misma causa** — profundidad de los
genéricos de PostgREST al resolver contra el esquema incorrecto. A confirmar tras regenerar.

**Acción:** regenerar `types.ts` contra `mulsqxfhxxdsadxsljss`. Es lectura de esquema, no
una migración. Estimado: 638 (+41 si C cae) = **~679 errores, 65%, de un solo cambio**.

### Grupo E — archivos duplicados muertos (134, borrado puro)

18 archivos con sufijo Finder-duplicado están **versionados en git** y siendo
type-checkeados. Cero importaciones desde el resto de `src/`:

```
src/components/liturgia-builder/UniversalSlide 2.tsx      src/components/presentation/PresenterView 2.tsx
src/components/liturgia-builder/UniversalSlide 3.tsx      src/components/presentation/PresenterView 3.tsx
src/components/mesa-abierta/CreateMonthDialog 2.tsx       src/components/presentation/PresenterView 4.tsx
src/components/mesa-abierta/DietaryRestrictionsForm 2.tsx src/components/presentation/SlidePreview 2.tsx
src/components/mesa-abierta/MesaAbiertaAdmin 2.tsx        src/lib/presentation/types 2.ts
src/components/mesa-abierta/MesaAbiertaDashboard 2.tsx    src/lib/presentation/types 3.ts
src/components/mesa-abierta/MesaAbiertaSection 2.tsx      src/pages/MesaAbiertaAdmin 2.tsx
src/components/mesa-abierta/MesaAbiertaSignup 2.tsx       src/pages/MesaAbiertaDashboard 2.tsx
src/components/mesa-abierta/WhatsAppOptIn 2.tsx           src/test/setup 2.ts
```

`PresenterView 4.tsx` sola aporta 56 errores. **Acción:** `git rm`, previa confirmación
de Brent (borrar código versionado es su decisión, no la mía).

### Grupo B — framer-motion (76, un arreglo compartido)

`Transition.ease` espera `Easing | Easing[]`; el código pasa `number[]` literal
(curvas cubic-bezier escritas como `[0.4, 0, 0.2, 1]`). El literal se ensancha a
`number[]` y deja de encajar en la tupla `[number, number, number, number]`.
**Acción:** una constante compartida `as const` (p. ej. `EASE_SUAVE`) e importarla en
los 14 archivos. Sin cambios de runtime.

### Grupo D1 — `ringColor` (20)

`ringColor` es una utilidad de Tailwind, no una propiedad CSS; en un objeto `style`
de React no existe. Es un **bug real**: esas líneas no pintan nada hoy.
**Acción:** mover a `className` (`ring-[color]`) o usar `--tw-ring-color`.

### Grupo D2 — errores reales de aplicación (130 en 66 archivos)

Cola larga; sin arreglo masivo. Los mayores:

| errores | archivo | naturaleza |
|---:|---|---|
| 11 | `src/components/liturgia-builder/UniversalSlide.tsx` | `illustrationConfig`/`textAlignment`/`logoAlignment`/`titleBreakAfterWord` ausentes del tipo de metadatos de slide |
| 5 | `src/components/auth/AuthContext.tsx` | castea `boolean` → `RoleName[]` / `UserPermission[]` |
| 5 | `src/lib/cuentacuentos/storyPdfExporter.ts` | — |
| 5 | `src/lib/cuentacuentos/__tests__/approvalGate.a3.test.ts` | — |
| 4 | `src/components/sections/Eventos.tsx` | — |
| 4 | `src/lib/leadership/transcriptionService.ts` | — |

Casos sueltos ya señalados: `src/types/shared/index.ts:9` TS2308 (`SongTempo`
re-exportado dos veces) y `src/pages/SermonEditorPage.tsx:145` TS2322 (`description`
no existe en `AdminPageHeaderProps`).

`AuthContext.tsx:240` merece atención: castear `boolean` a `RoleName[]` sugiere que la
lista de roles puede estar llegando vacía en runtime. Es RBAC — verificar antes de
"arreglar el tipo".

## 5. Orden propuesto

| paso | acción | errores esperados |
|---|---|---:|
| 0 | gate correcto + CLAUDE.md (**hecho**, `ea1e1b6`) | 1.039 → 1.039 |
| 1 | regenerar `types.ts` de Supabase | −638 (−679 si C cae) |
| 2 | `git rm` de los 18 duplicados (requiere OK de Brent) | −134 |
| 3 | constante de easing compartida | −76 |
| 4 | `ringColor` → `className` | −20 |
| 5 | cola D2, archivo por archivo | −130 |

Pasos 1–4 son mecánicos y verificables. El paso 5 es el trabajo real y debe ir en su
propia fase, no absorbido en una fase de feature.

**Regla:** ninguna opción de `tsconfig` se debilita en ningún paso. Si un arreglo exige
aflojar la configuración, se rechaza y se documenta.
