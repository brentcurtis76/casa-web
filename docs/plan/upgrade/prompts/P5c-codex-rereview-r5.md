SESSION: UPGRADE · P5c · r5 · RE-REVIEW

**This is the ONE current review prompt for P5c.** r5 contains no executor/code round:
it is the contract re-review required by your r4 `FINDINGS`. All older
`P5c-codex-*.md` prompts are superseded.

---

## STOP — VERIFY THE AMENDMENT AND THE UNCHANGED CODE SHA

```bash
git fetch origin && git checkout feat/mesa-md-guards && git pull --ff-only

git merge-base --is-ancestor 68bc206 HEAD; echo $?  # must be 0 — PM amendment
grep -c 'P5c se enmienda tras' docs/plan/upgrade/PLAN.md  # must be 1
grep -c 'CODEX REVIEW — P5c (round 5' \
  docs/plan/upgrade/reviews/REVIEW-P5c.md  # must be 0
git diff --name-only fee5203..HEAD | \
  grep -Ev '^(docs/plan/upgrade/|CLAUDE\.md$)' | wc -l  # must be 0
git diff --name-only b9675e6..fee5203 -- . ':!docs/plan/upgrade/**'
# must print exactly the four files of F
```

Report the five results at the top of the review. If one differs, stop and report the
mismatch.

- Parent: `main`@`d5b16e8`.
- Last implementation/content commit: `fee5203`.
- Code commits remain `56505ae`, `7b6f837`, `6b98e74`, `7fb483b`.
- Your r4 review/FINDINGS: `7d01fa4`, `reviews/REVIEW-P5c.md:251`.
- Executor handoff accepting FINDINGS: `34f90fc`.
- PM amendment: `68bc206`.
- Anything after `fee5203` is review/contract documentation; there is no r5 code patch.

Use Node v22.22.0 and `/opt/homebrew/bin/deno` 2.7.11 for any command you choose to
repeat.

---

## WHY THIS RETURNS DIRECTLY TO REVIEW

r4 should have returned `FINDINGS` before widening coverage. You ruled that already; the
executor accepted it and stopped. The PM has now amended the contract. There is no fifth
serial patch to review and no executor decision left pending. Judge whether the amended
contract accurately ratifies the existing code and resolves every plan note from r4.

The full gates and mutations ran against the unchanged implementation SHA in your r4
review. You may reuse those results after proving `fee5203..HEAD` has no implementation,
lockfile or runtime-config change (the only repo-level file is the textual gate rule in
`CLAUDE.md`). Do not spend seven minutes rerunning them merely because the prompt is new;
rerun anything whose evidence you doubt.

---

## THE FOUR PM DECISIONS TO REVIEW

### 1. Vitest `+2 → +4` is ratified

The two extra tests stay. Scope now says Signup `+3`, H5 says Vitest `+4`, and the plan
arithmetic changes:

- workstream delta `+36 → +38`;
- historical total `1072 → 1074`;
- after P8 `1078 → 1080`;
- B-07 projection `1094 → 1096`, then `1100 → 1102` after P8.

This ratifies existing evidence; it does not excuse r3/r4 procedure retroactively.

### 2. Unreachable paths stay only as unit over-coverage

The r1 test with `preferredRole="host"` and P5a's four tests with an absent prop are not
rewritten. The prop is optional, so they retain a cheap component API/default contract.
The plan now states explicitly that they are unreachable from the active caller and do
not count as user protection, B-18 evidence or production grid cells.

### 3. H2 is satisfied by the real host route

The canonical B-18 evidence is now named:

- production guest with `preferredRole="guest"`, both polarities;
- `preferredRole="guest"` → select host in step 1, both polarities.

The second test is `el anfitrión elegido en el paso 1 también puede excluirse`. The H2
mutation `rolePreference === 'guest'` makes it fail. The production grid is four cells,
all covered. Direct prop-host is supplementary only.

### 4. All three r1 plan notes are closed

- **H7:** the normative boundary is `b9675e6..fee5203`; outside
  `docs/plan/upgrade/`, exactly the four files of `F` may change. Above `fee5203`, only
  review/amendment docs may change. `main..HEAD` is no longer used.
- **D8.2:** an unexpected red outside `F` repeats once on the exact tip first. Only a red
  that persists is compared with the parent. Parent clean means BLOCKING; reproduction
  on the parent means pre-existing.
- **Behaviour-free gate rule:** `CLAUDE.md` now allows only a narrowly evidenced
  discharge of pre-existing red unit-test/lint gates or Playwright stopping at the
  anti-production guard, for a phase limited to tests/docs/comments. It requires
  explicit phase authorization, zero new diagnostics in `F`, exact parent/tip parity
  and raw evidence.
  Any runtime/E2E/config change loses the exception. Bypassing the guard or pointing at
  production remains prohibited.

Rule especially on whether that `CLAUDE.md` exception is narrow enough. If not, return a
specific contract finding; do not ask an executor to patch around it.

---

## EVIDENCE THAT REMAINS BINDING

- Nine valid mutations fall: R4a, R4b, H1, H2, H3, B1a, B1b, S1 and R3a.
- R3b survives 7/7 and is struck because it affects only absent-prop + host, unreachable
  from production. It is not a tenth requirement.
- P5c isolated: 8/8.
- Vitest tip 1097/6 (1103), parent 1093/6 (1099): delta +4, same six dashboard reds.
- Deno tip 457/0, parent 456/0: delta +1.
- D8 totals identical tip/parent, no new diagnostics in `F`.
- Build exit 0. Lint and Playwright have the parent/tip evidence required by the newly
  written behaviour-free rule.

Do not reopen the three accepted r1 plan notes as future work: this amendment resolves
them now. Do not require unreachable paths to protect users; the contract says they do
not. Do identify any arithmetic, scope or gate contradiction that remains.

---

## REQUIRED OUTPUT

Append, do not rewrite, to `docs/plan/upgrade/reviews/REVIEW-P5c.md`:

```markdown
## CODEX REVIEW — P5c (round 5, amended contract)
STATE CHECKS: <five results>
VERDICT: PASS | FAIL | FINDINGS
BLOCKING:
- ...
SHOULD-FIX:
- ... <three-state disposition>
NITS:
- ...
RULING ON THE AMENDMENT:
RULING ON H2 AND THE PRODUCTION GRID:
RULING ON GATES / H7 / ARITHMETIC:
```

`PASS` means the amended contract accurately describes the already-reviewed code and P5c
may proceed to mechanical close. `FAIL` means a defect remains inside the ratified
contract/code. `FINDINGS` means the amendment itself is still wrong or evidence is
unavailable.

Commit the appended review and push `origin/feat/mesa-md-guards`.
