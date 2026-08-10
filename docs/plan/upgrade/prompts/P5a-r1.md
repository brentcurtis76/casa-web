SESSION: UPGRADE · P5a · r1 · EXEC

You are the executor for UPGRADE (CASA · La Mesa Abierta · opt-out del plato
principal), phase **P5a**, round **1**. You have no prior context. Everything you need
is below or in the repo. Read this whole prompt before touching anything.

Worktree: `/Users/brentcurtis/dev/casa-upgrade`. Plan root: `docs/plan/upgrade/`.
Work in that worktree — it is the standing UPGRADE checkout and already has
`node_modules`. Do **not** work in `/Users/brentcurtis/dev/casa-web` (a different
workstream) or `/Users/brentcurtis/dev/casa-p2-review` (holds `main`).

---

## 0. PRECONDITION — CHECK THIS FIRST, BEFORE ANYTHING ELSE

P5a depends on **P1b** and **P4**, both of which must already be in `main`. Three
executor sessions died in this exact gate during P3a because they were dispatched
before the merge existed. Run this:

```bash
cd /Users/brentcurtis/dev/casa-upgrade
git show main:docs/plan/upgrade/PLAN.md | grep -cE '^\| (P1b|P4) .*DONE'
```

**If it prints anything other than `2`: STOP.** Do not create a branch, do not write
code. Report `STATUS: BLOCKED — falta una dependencia en main` with what you got, and
nothing else. This is the correct outcome, not a failure.

**If it prints `2`:** continue. Confirm the four files you are about to edit exist and
that the two you are about to create do not:

```bash
ls src/components/mesa-abierta/{MesaAbiertaSignup,EditParticipantDialog,AddParticipantDialog,MesaAbiertaAdmin}.tsx
ls src/lib/mesa-abierta/participantPayload.ts 2>&1   # must say "No such file"
```

## BRANCH

`feat/mesa-md-form`, created from **local `main`** after the check above passes:

```bash
git checkout -b feat/mesa-md-form main
```

Commit as you go. Branch names in this repo are capped at 20 characters (Vercel DNS);
`feat/mesa-md-form` is 17. Do not rename it.

`main` is checked out in the worktree `/Users/brentcurtis/dev/casa-p2-review`, so
`git checkout main` will refuse. The command above branches from `main` **without**
switching to it, which is why it is written that way. Do not "fix" it.

Verify the PM's bootstrap commit for this round is on your branch before you start:

```bash
git log --oneline -1 -- docs/plan/upgrade/prompts/P5a-r1.md   # must print a commit
```

If that prints nothing, stop and report `STATUS: BLOCKED — el commit de bootstrap del
PM no está en main`.

---

## 1. WHAT THIS PHASE IS

Six phases have already landed. The **server** side of this feature is finished:

- **P1a/P1b** added `mesa_abierta_participants.can_bring_main_dish BOOLEAN NOT NULL
  DEFAULT TRUE` (D2, **positive** polarity) and applied it to the shared Supabase
  instance. The column is live, every existing row is `true`, and
  `src/integrations/supabase/types.ts` already declares it (lines 139, 158, 177).
- **P2** built the canonical allocation rule as a pure leaf module,
  `supabase/functions/_shared/mainDish.ts`.
- **P3a/P3b** cut `create-mesa-matches` into `handler.ts` + pure `matching.ts`.
- **P4** wired the allocator into the live path. The matcher now honours
  `can_bring_main_dish`: an excluded carrier is **never** given the main course, the
  quota is `max(1, ceil(personas/5))` (D1), and an uncovered table is reported (D4).

**The engine reads a flag that no human can currently set.** Every row is `true`
because that is the column default; there is no UI anywhere that writes `false`. P5a
is the phase that lets a person say *"no puedo traer el plato principal"* and have it
reach the database.

You are not designing a feature. You are adding one boolean to three forms and one
`select`, behind a pure helper that owns the polarity conversion.

---

## 2. THE POLARITY. READ THIS TWICE — IT IS THE ONE THING THIS PHASE GETS WRONG.

The value is stored **positively** and presented **negatively**, and the switch is
**off by default**. That is two inversions stacked on a default, and it is the exact
shape of bug where an executor flips the boolean, writes the tests with the same
flip, and ships ten green tests over inverted behaviour.

**The truth table. Every assertion you write must agree with this table, and you must
paste it into your report with each row marked against your implementation.**

| Switch `No puedo traer el plato principal` | Meaning | `can_bring_main_dish` stored | Matcher may assign main course? |
|---|---|---|---|
| **OFF** (default) | "I can bring it" | **`true`** | yes |
| **ON** | "I cannot bring it" | **`false`** | never |

Restated three ways, because one of them will be the one that sticks:

- `can_bring_main_dish = !switchIsOn`
- `switchIsOn = !can_bring_main_dish` (this is F3's "el negado del campo")
- A brand-new participant who touches nothing must land in the database as
  `can_bring_main_dish: true`, identical to every row that exists today.

**A sanity check you must actually run before you call the phase done:** find the
assertion in your tests that fixes the default, and confirm it asserts `true`. If your
default asserts `false`, you have inverted the feature and every other test is
inverted with it.

---

## 3. SCOPE — exactly nine files

Five you create, four you edit. `F` for the D8 gate is exactly this list.

**Create:**
1. `src/lib/mesa-abierta/participantPayload.ts`
2. `src/lib/mesa-abierta/__tests__/participantPayload.test.ts`
3. `src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx`
4. `src/components/mesa-abierta/__tests__/EditParticipantDialog.mainDish.test.tsx`
5. `src/components/mesa-abierta/__tests__/AddParticipantDialog.mainDish.test.tsx`

**Edit:**
6. `src/components/mesa-abierta/MesaAbiertaSignup.tsx`
7. `src/components/mesa-abierta/EditParticipantDialog.tsx`
8. `src/components/mesa-abierta/AddParticipantDialog.tsx`
9. `src/components/mesa-abierta/MesaAbiertaAdmin.tsx`

> **The repo contains tracked duplicate files named `... 2.tsx`** — including
> `MesaAbiertaAdmin 2.tsx`, `MesaAbiertaSignup 2.tsx` and a whole `__tests__ 2/`
> directory. They are editor cruft that got committed. `vitest.config.ts` already
> excludes them. **They are not in scope. Do not edit, delete, or "sync" them.** If a
> glob or a sed hits one, you have made a mistake.

### 3.1 `participantPayload.ts` — the new pure module

Pure: no React, no imports from `@/integrations/supabase/client`, no I/O. It exists so
the polarity conversion has one home and one set of tests, instead of being retyped in
three components.

Required exported surface — this is a **floor**, and the tests below assume it:

```ts
/**
 * Polaridad (D2): la columna guarda la CAPACIDAD (`can_bring_main_dish`), la UI
 * pregunta por la EXCLUSIÓN (`cannotBringMainDish`). Se convierten aquí y solo aquí.
 */
export interface ParticipantInsertInput {
  userId: string;
  monthId: string;
  rolePreference: 'host' | 'guest';
  email: string | null;
  hasPlusOne: boolean;
  plusOneName: string | null;
  recurring: boolean;
  hostAddress: string;
  maxGuests: number;
  phoneNumber: string;
  whatsappEnabled: boolean;
  /** El switch de la UI. `true` = el participante se excluye del plato principal. */
  cannotBringMainDish: boolean;
}

/** Fila lista para `.insert()` en `mesa_abierta_participants`. */
export function buildParticipantInsert(input: ParticipantInsertInput): {
  user_id: string;
  month_id: string;
  role_preference: 'host' | 'guest';
  email: string | null;
  has_plus_one: boolean;
  plus_one_name: string | null;
  recurring: boolean;
  host_address: string | null;
  host_max_guests: number | null;
  phone_number: string | null;
  whatsapp_enabled: boolean;
  can_bring_main_dish: boolean;
  status: string;
};
```

It must reproduce the host-only nulling and the `status` that the signup insert does
today (§3.2) — `host_address` and `host_max_guests` are `null` unless
`rolePreference === 'host'`, `phone_number` is `null` when empty, `status` is
`'pending'`.

If while implementing you conclude a different signature is genuinely better, you may
deviate — but say so under `DEVIATIONS FROM PROMPT` with the reason, keep the module
pure, keep the name `buildParticipantInsert`, and keep tests 1–4 asserting against it.
Do **not** widen it into a builder for the edit dialog or the admin dialog; those two
have different shapes (an `update` and an edge-function body) and unifying them is a
refactor this phase is not buying.

### 3.2 `MesaAbiertaSignup.tsx` — the member wizard

**The insert as it stands, `MesaAbiertaSignup.tsx:108–126`:**

```tsx
      // Insert participant record
      const { data: participant, error: participantError } = await supabase
        .from('mesa_abierta_participants')
        .insert({
          user_id: user.id,
          month_id: monthId,
          role_preference: rolePreference,
          email: email,
          has_plus_one: hasPlusOne,
          plus_one_name: plusOneDietary?.name || null,
          recurring,
          host_address: rolePreference === 'host' ? hostAddress : null,
          host_max_guests: rolePreference === 'host' ? maxGuests : null,
          phone_number: phoneNumber || null,
          whatsapp_enabled: whatsappEnabled,
          status: 'pending',
        })
        .select()
        .single();
```

Replace that object literal with a `buildParticipantInsert({...})` call. The
`.from(...).insert(...).select().single()` chain and the error handling around it stay
exactly as they are.

**The switch goes in step 3**, in the existing bordered block that already holds
`¿Traerás un acompañante?` and `Participación recurrente` — `MesaAbiertaSignup.tsx:344`
opens it (`<div className="space-y-4 border-t pt-4">`) and the `Participación
recurrente` row is at `:360`. Add a third row **after** `Participación recurrente`,
matching the two rows above it verbatim in structure:

```tsx
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="cannot-bring-main-dish">
                    No puedo traer el plato principal
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Te asignaremos ensalada, bebidas o postre en su lugar
                  </p>
                </div>
                <Switch
                  id="cannot-bring-main-dish"
                  checked={cannotBringMainDish}
                  onCheckedChange={setCannotBringMainDish}
                />
              </div>
```

Copy that copy **exactly** — it is D10, fixed by the plan, and Codex will diff it.

New state alongside the others at `:37–44`:
`const [cannotBringMainDish, setCannotBringMainDish] = useState(false);`

**Note the `id` + `htmlFor`.** The two existing switches have neither, so all three
render with no accessible name and `getAllByRole('switch')[n]` would be the only way to
find yours — index-fragile, and it silently retargets if anyone reorders the block.
The `id`/`htmlFor` pair makes `getByRole('switch', { name: /No puedo traer/i })` work.
**Do not retrofit ids onto the two existing switches** — out of scope.

**Step 5 summary (F5).** The summary block runs `:400–423`. The `+1` line at `:416`
is the pattern to copy — it renders only when the flag is set:

```tsx
              {hasPlusOne && (
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-semibold">Con acompañante (+1)</p>
                  </div>
                </div>
              )}
```

Add an equivalent block gated on `cannotBringMainDish`, so the summary mentions it
**only when the user excluded themselves**. A member who left the switch alone must see
no new line. Spanish, consistent with the surrounding lines; `No traeré el plato
principal` is fine.

### 3.3 `EditParticipantDialog.tsx` — the admin's edit dialog

It keeps its **own** local `interface Participant` at `:21–34`. Add
`can_bring_main_dish?: boolean;` to it.

State, next to the others at `:53–59`:
`const [cannotBringMainDish, setCannotBringMainDish] = useState(participant.can_bring_main_dish === false);`

The `useEffect` that resets the form when `participant` changes runs `:62–72` and ends
with `setStatus(participant.status);` at `:71`. Add the matching reset line there.
**If you add the state but forget the effect, the dialog shows a stale switch the
second time it is opened for a different participant — and no test in §5 catches it
unless you write test 8 to re-render with a new participant. Write it that way.**

Why `=== false` and not `!participant.can_bring_main_dish`: the field is optional on
this interface, and rows fetched before the column shipped could arrive `undefined`.
`undefined` must mean "can bring it" (switch off), matching the column default.

The `update` at `:87–101` must carry the field:

```tsx
        .update({
          role_preference: rolePreference,
          email: email || null,
          has_plus_one: hasPlusOne,
          plus_one_name: hasPlusOne ? plusOneName : null,
          host_address: rolePreference === 'host' ? hostAddress : null,
          host_max_guests: rolePreference === 'host' ? maxGuests : null,
          phone_number: phoneNumber || null,
          status: status,
          can_bring_main_dish: !cannotBringMainDish,     // ← add this
        })
```

Add the switch to the form body next to the `¿Trae acompañante?` row at `:248–256`,
same copy and same `id`/`htmlFor` treatment as §3.2.

### 3.4 `AddParticipantDialog.tsx` — the admin's add dialog

This one does **not** write to the table directly. It calls an edge function, and the
body is **camelCase**. `AddParticipantDialog.tsx:123–136`:

```tsx
      const { data, error } = await supabase.functions.invoke('admin-add-participant', {
        body: {
          monthId,
          fullName,
          email: email || null,
          phoneNumber: phoneNumber || null,
          rolePreference,
          hasPlusOne,
          plusOneName: hasPlusOne ? plusOneName : null,
          hostAddress: rolePreference === 'host' ? hostAddress : null,
          hostMaxGuests: rolePreference === 'host' ? maxGuests : null,
          whatsappEnabled,
        },
      });
```

Add `canBringMainDish: !cannotBringMainDish,` to that body. **camelCase, and the
positive form** — P5b's handler will read exactly `body.canBringMainDish` and persist
`can_bring_main_dish: body.canBringMainDish !== false`. Sending `cannotBringMainDish`,
or the snake_case name, silently breaks a phase that has not been written yet.

**The `admin-add-participant` edge function does not read this field yet. That is
correct and expected — P5b adds the server half. Do not touch
`supabase/functions/admin-add-participant/`.** Until P5b lands, an admin-added
participant still gets the column default (`true`), which is the pre-P5a behaviour.
Say so in your report under `NOT DONE / OPEN`; do not "fix" it.

New state next to `:33`, and a switch row next to the `¿Trae acompañante?` block at
`:258–268`. `resetForm` at `:35` must reset it to `false`.

### 3.5 `MesaAbiertaAdmin.tsx` — two small edits, nothing else

This file is 2227 lines and carries 10 pre-existing `tsc` errors and 14 ESLint
findings (§6). **You are making two edits in it and nothing else.**

`interface Participant` at `:46–60` — add `can_bring_main_dish?: boolean;`.

`fetchParticipants`'s `select` at `:224–238` — add the column to the list. It currently
ends:

```tsx
        host_address,
        host_max_guests,
        plus_one_name
      `)
```

becomes

```tsx
        host_address,
        host_max_guests,
        plus_one_name,
        can_bring_main_dish
      `)
```

**A warning specific to this `select`.** Five of that file's ten `tsc` errors are
`SelectQueryError<"column 'email' does not exist on 'mesa_abierta_participants'.">`
at `:254`, `:255`, `:270`, `:271` and `:273`. They exist because `email` is selected
but missing from `types.ts` — pre-existing, backlog **B-08**, **not yours to fix**.
`can_bring_main_dish` *is* in `types.ts`, so adding it must leave those five messages
**character-for-character identical**. If the message text changes — for instance it
starts naming `can_bring_main_dish` instead of `email` — that is a **new diagnostic**,
it is BLOCKING under D8.4, and it means `types.ts` disagrees with the live schema.
Stop and report `STATUS: FINDINGS`; do not edit `types.ts` to paper over it.

---

## 4. ACCEPTANCE CRITERIA — each independently verifiable

- **[F1]** `buildParticipantInsert` returns `can_bring_main_dish: true` when
  `cannotBringMainDish` is `false`, and `false` when it is `true`. The module is pure:
  `grep -nE "^import" src/lib/mesa-abierta/participantPayload.ts` prints nothing, or
  only type-only imports.
- **[F2]** The switch is in **step 3**, is **off by default**, and its state reaches
  the builder: signing up without touching it produces
  `can_bring_main_dish: true` in the object handed to `.insert()`.
- **[F3]** `fetchParticipants` selects `can_bring_main_dish` and `MesaAbiertaAdmin`'s
  `Participant` declares it; `EditParticipantDialog` initialises its switch as the
  negation of the field, treating `undefined` as "can bring it".
- **[F4]** `AddParticipantDialog` sends `canBringMainDish` (camelCase, positive) in the
  `admin-add-participant` body — test 10.
- **[F5]** The step-5 summary mentions the exclusion **only** when the user set the
  switch; with the switch off, no new line renders.
- **[F6]** Saving the edit dialog persists the field — the object passed to `.update()`
  contains `can_bring_main_dish` with the negated switch value — test 9.
- **[F7]** All 10 tests pass. `npx vitest run --no-file-parallelism` reports **1073
  passed / 6 failed** (baseline 1063/6, **+10**), and the 6 red are the same
  `MesaAbiertaDashboard.test.tsx` tests as the baseline. See §6 for what to do if the
  red set differs.
- **[F8]** Gate D8 over the nine files of `F`: zero new raw diagnostics against the
  §6 baseline, and `npm run build` exits 0.

---

## 5. TESTS YOU MUST WRITE — ten, named by the plan

Test names in Spanish. `+10` net; do not delete or rewrite any existing test.

**`src/lib/mesa-abierta/__tests__/participantPayload.test.ts`** — tests 1–4, pure, no
React, no mocks:
1. `switch apagado ⇒ can_bring_main_dish true`
2. `switch encendido ⇒ can_bring_main_dish false`
3. `los demás campos pasan sin alterarse` — assert the full returned row against an
   expected object, so a field silently dropped by the builder fails here.
4. `anfitrión conserva dirección y cupo; invitado los recibe en null`

**`src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx`** — 5–7:
5. `el switch aparece en el paso 3 y está apagado por defecto`
6. `el resumen del paso 5 no menciona el plato principal si no se excluyó`
7. `el resumen del paso 5 lo menciona cuando el usuario se excluye`

**`src/components/mesa-abierta/__tests__/EditParticipantDialog.mainDish.test.tsx`** — 8–9:
8. `el switch se inicializa como el negado del campo` — render with
   `can_bring_main_dish: false` (switch on), then re-render with a **different**
   participant carrying `true` (switch off) and assert it followed. Cover `undefined`
   ⇒ off in the same test.
9. `guardar incluye can_bring_main_dish en el update` — assert on the object the mocked
   `.update()` received.

**`src/components/mesa-abierta/__tests__/AddParticipantDialog.mainDish.test.tsx`** — 10:
10. `envía canBringMainDish en el cuerpo de la función` — assert on the second argument
    that the mocked `supabase.functions.invoke` received.

### Test infrastructure — read this before you fight the mocks

`src/test/setup.ts` installs a **global** `vi.mock` of
`@/integrations/supabase/client`. Two things about it will cost you an hour if nobody
tells you:

- Its `from()` returns chainable stubs where `single: vi.fn()` resolves to
  `undefined` — so `const { data, error } = await ...single()` **throws**. Any test
  that drives a real submit needs its own `vi.mock` of that module.
- **It has no `functions` key at all**, so `supabase.functions.invoke` is `undefined`.
  Test 10 must supply its own mock with `functions: { invoke: vi.fn() }`.

The working local-override pattern in this repo is
`src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx:1–52` — a
module-scope `let` for the data, a `vi.mock` factory that closes over it, plus mocks of
`@/components/auth/AuthContext` and `@/hooks/use-toast`. Copy that shape.

`MesaAbiertaSignup` calls `useAuth()` and needs `open`, `onClose`, `monthId`; mock
`AuthContext` the way the dashboard test does.

**Radix `Switch` in jsdom: no test in this repo has ever driven one.** That is the
plan's stated risk for this phase. What you need to know: it renders as
`<button type="button" role="switch" aria-checked="false">`, so `getByRole('switch',
{ name: /…/i })` finds it (given the `id`/`htmlFor` from §3.2) and `fireEvent.click`
toggles it. Use `fireEvent`, which is what this repo uses — `userEvent` adds pointer
-capture behaviour jsdom does not implement. Assert state with
`toHaveAttribute('aria-checked', 'true')`.

**The escape hatch the plan grants, and its exact limit.** If reaching step 3 or step 5
of the wizard turns out to need scaffolding out of proportion to the phase — an auth
provider tree, a router, faking four steps of validation — you may reduce tests 5–7 to
polarity coverage and report it under `DEVIATIONS FROM PROMPT` with what you tried.
**Never weaken an assertion to make it pass.** A test that renders the component and
asserts nothing about the flag is worse than a missing test, and it will fail review.
Tests 1–4, 9 and 10 have no such escape: they carry the phase.

**TEST COMMAND (verbatim):**
```bash
npx vitest run --no-file-parallelism
```

---

## 6. BASELINE — measured by the PM today on `main` @ `3851e40`, Node v22.22.0

### 6.1 Vitest

**1063 passed / 6 failed (1069 total)**, measured in a clean worktree. All 6 failures
are in `src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx` — that is
the base D8.2 declares and it stands until P8.

Your target is **1073 / 6**, same 6 files.

D8.2's rule for anything else: a red outside `F` is settled by **re-running the suite
on the parent commit**. If it is red there too, it is pre-existing — record both
numbers in your report and move on; it does not block. If it is green on the parent, it
is yours and it is BLOCKING. Known offenders that are not yours: the three
`CuentacuentoEditor.ph.*` files flake under load (**B-05**), and
`usePresentationState` contributes 8 failures in worktrees without `localStorage`
(**B-10**). Neither imports any file in `F`.

### 6.2 Gate D8 — raw diagnostics for the four existing files

Every one of these is pre-existing and inherited (**B-08**). **You are not asked to fix
a single one.** You are asked not to add one. The five new files start from zero and
must stay at zero.

```
=== src/components/mesa-abierta/MesaAbiertaSignup.tsx
--- tsc (0)
--- eslint (1)
src/components/mesa-abierta/MesaAbiertaSignup.tsx(174,21): error @typescript-eslint/no-explicit-any: Unexpected any. Specify a different type.
--- deno lint (0)
--- deno check (0)
=== src/components/mesa-abierta/EditParticipantDialog.tsx
--- tsc (1)
src/components/mesa-abierta/EditParticipantDialog.tsx(100,11): error TS2322: Type 'string' is not assignable to type '"pending" | "confirmed" | "cancelled" | "waitlist"'.
--- eslint (1)
src/components/mesa-abierta/EditParticipantDialog.tsx(126,21): error @typescript-eslint/no-explicit-any: Unexpected any. Specify a different type.
--- deno lint (0)
--- deno check (0)
=== src/components/mesa-abierta/AddParticipantDialog.tsx
--- tsc (1)
src/components/mesa-abierta/AddParticipantDialog.tsx(71,49): error TS2589: Type instantiation is excessively deep and possibly infinite.
--- eslint (1)
src/components/mesa-abierta/AddParticipantDialog.tsx(148,21): error @typescript-eslint/no-explicit-any: Unexpected any. Specify a different type.
--- deno lint (0)
--- deno check (0)
=== src/components/mesa-abierta/MesaAbiertaAdmin.tsx
--- tsc (10)
src/components/mesa-abierta/MesaAbiertaAdmin.tsx(1689,57): error TS2339: Property 'hostsConvertedToGuests' does not exist on type '{ totalMatches: number; ... }'.
src/components/mesa-abierta/MesaAbiertaAdmin.tsx(254,39): error TS2339: Property 'user_id' does not exist on type 'SelectQueryError<"column 'email' does not exist on 'mesa_abierta_participants'.">'.
src/components/mesa-abierta/MesaAbiertaAdmin.tsx(255,46): error TS2339: Property 'id' does not exist on type 'SelectQueryError<"column 'email' does not exist on 'mesa_abierta_participants'.">'.
src/components/mesa-abierta/MesaAbiertaAdmin.tsx(270,60): error TS2339: Property 'user_id' does not exist on type 'SelectQueryError<"column 'email' does not exist on 'mesa_abierta_participants'.">'.
src/components/mesa-abierta/MesaAbiertaAdmin.tsx(271,88): error TS2339: Property 'id' does not exist on type 'SelectQueryError<"column 'email' does not exist on 'mesa_abierta_participants'.">'.
src/components/mesa-abierta/MesaAbiertaAdmin.tsx(273,11): error TS2698: Spread types may only be created from object types.
src/components/mesa-abierta/MesaAbiertaAdmin.tsx(785,19): error TS2322: Type 'PostgrestFilterBuilder<...>' is not assignable to type 'number'.
src/components/mesa-abierta/MesaAbiertaAdmin.tsx(785,45): error TS2345: Argument of type '"decrement"' is not assignable to parameter of type '"is_mesa_admin" | "set_music_track_as_default"'.
src/components/mesa-abierta/MesaAbiertaAdmin.tsx(843,19): error TS2322: Type 'string' is not assignable to type '"none" | "main_course" | "salad" | "drinks" | "dessert"'.
src/components/mesa-abierta/MesaAbiertaAdmin.tsx(950,10): error TS2769: No overload matches this call. [+ 2 overload detail lines]
--- eslint (14)
  2 × no-explicit-any at (1036,21) and (1090,21)
  2 × react-hooks/exhaustive-deps warnings at (192,6) 'fetchMonths' and (204,6) 'fetchParticipants'
 10 × no-explicit-any at (279,50) (462,21) (551,21) (632,21) (668,21) (735,21) (822,21) (861,21) (899,21) (979,21)
--- deno lint (0)
--- deno check (0)
[gates] totales del proyecto: tsc=1039 eslint=161 deno-lint=92 deno-check=43
```

Reproduce it on your branch with all nine paths:

```bash
bash scripts/gates/changed-files-diagnostics.sh \
  src/lib/mesa-abierta/participantPayload.ts \
  src/lib/mesa-abierta/__tests__/participantPayload.test.ts \
  src/components/mesa-abierta/MesaAbiertaSignup.tsx \
  src/components/mesa-abierta/EditParticipantDialog.tsx \
  src/components/mesa-abierta/AddParticipantDialog.tsx \
  src/components/mesa-abierta/MesaAbiertaAdmin.tsx \
  src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx \
  src/components/mesa-abierta/__tests__/EditParticipantDialog.mainDish.test.tsx \
  src/components/mesa-abierta/__tests__/AddParticipantDialog.mainDish.test.tsx
```

Paste the **whole** output into your report, not a summary. A **line shift** (same
message text, different line) is fine and expected — your edits move code. A **new**
message is BLOCKING. Project totals are an observation only (D8.5); they drift with the
environment and are not a pass criterion. Full contract in `scripts/gates/README.md`.

Also required:
```bash
npm run build     # must exit 0 — this one IS a criterion (F8)
```

---

## 7. EXPLICITLY OUT OF SCOPE

- **Do not fix any baseline diagnostic** in §6.2 (B-08) — not the `no-explicit-any`s,
  not the `TS2589`, not the `SelectQueryError`s, not the `exhaustive-deps` warnings.
  They are catalogued and deliberately deferred.
- **Do not edit `src/integrations/supabase/types.ts`.** It already declares the column.
- **Do not touch any `supabase/functions/**` file, any migration, or the database.**
  P5b writes the `admin-add-participant` server half; P4 owns the matcher.
- **Do not touch the admin override dialogs** (`GuestFoodDialog`, `HostFoodDialog`,
  `ConvertHostDialog`), the coverage badge, or anything about showing coverage in the
  admin panel. That is **P6** and it has its own nine-file scope.
- **Do not touch notification copy or the member dashboard.** P7 and P8.
- **Do not retrofit ids, labels, or accessibility fixes onto the existing switches**
  (`¿Traerás un acompañante?`, `Participación recurrente`, WhatsApp). Only your new one
  gets an `id`.
- **Do not touch any `* 2.tsx` / `__tests__ 2/` file.**
- **Do not refactor `MesaAbiertaAdmin.tsx`.** Two edits, §3.5.

---

## 8. RULES

- Surgical changes only. No bulk file modifications. Match the existing patterns in
  these files — the three switch rows you are copying were written to a house style.
- **All user-facing text in Spanish (D10).** The two strings in §3.2 are fixed by the
  plan and must appear verbatim. Test names in Spanish, matching §5. Code comments
  follow the file you are in.
- Do not grade your own work in prose. Show the diff and the raw test output.
- If tests are red, iterate up to 3 times. If still red, report `STATUS: BLOCKED` with
  the real error. Never report a red build as complete.
- If you discover the plan is wrong — `can_bring_main_dish` is missing from `types.ts`,
  the `select` produces a diagnostic that renames the `SelectQueryError`, the wizard
  cannot be mounted without disproportionate scaffolding — **stop coding** and report
  `STATUS: FINDINGS` with what you found and what you would propose instead. That is
  the correct outcome, not a failure. Do not work around a broken plan.
- Do not expand scope. If something out of scope is broken, note it under NOT DONE.
- Before you finish, **self-review against §4 one criterion at a time**, running the
  actual command for each. F1 and F3 are greps; do them, do not reason about them.
- **Re-read §2 and mark the truth table against your implementation before you write
  your report.** Both rows. This is the one instruction in this prompt that, skipped,
  produces ten green tests over a broken feature.

---

## 9. WHEN DONE

Append your round entry to `docs/plan/upgrade/LEDGER.md` (append only — never reflow or
reorder that file; the PM appends to it too), in this format:

```markdown
### 2026-08-10 — P5a round 1 — <actor>
- SESSION: UPGRADE · P5a · r1 · EXEC
- CONTEXT PRESSURE:
- ACTION:
- COMMITS:
- TESTS: <command> → <counts>
- FINDINGS RAISED:
- DECISIONS:
- BACKLOG ADDED:
- OPEN AFTER THIS ROUND:
```

Then output exactly this report:

```markdown
## EXECUTOR REPORT — P5a round 1
STATUS: COMPLETE | BLOCKED | FINDINGS
CONTEXT PRESSURE: comfortable | tight | ran out — <one line: at what point?>
BRANCH: feat/mesa-md-form   COMMITS: <sha…>
FILES CHANGED: <path (+x/-y) …>
WHAT I DID: <bullets, one per acceptance criterion, mapped to F1–F8>
POLARITY TABLE (§2): <both rows, each marked against the implementation>
TEST COMMAND: npx vitest run --no-file-parallelism
TEST OUTPUT: <verbatim tail, unedited — passed/failed counts and the red file names>
GATE D8 OUTPUT: <whole output of changed-files-diagnostics.sh over the nine paths>
BUILD: <npm run build exit code>
ACCEPTANCE CRITERIA: <F1–F8: met / not met / partially — with reason>
DEVIATIONS FROM PROMPT: <or "none">
ASSUMPTIONS MADE: <or "none">
NOT DONE / OPEN:
```
