CODEX CONFIRMATION — PD COMPLETENESS — phase/pd-contract@db42745

DISPOSITION: CONFIRMED FIXED

## RUNTIME + EVIDENCE

Target: clean `/private/tmp/casa-pd` worktree at
`db427454c3d9d1950075e99f6abf10d7c8797514`.

The commit is exactly one file, `+4/-1`:

```text
supabase/functions/generate-story/handler_imageFetch_test.ts | 5 ++++-
```

`git diff --check 2bdec82..db42745` is clean. The D4-story test now:

1. keeps every existing CORS-header assertion;
2. keeps the JSON content-type assertion;
3. adds exact `res.status === 400`;
4. reads the response body exactly once;
5. keeps `body.success === false`;
6. adds exact `body.code === "CLIENT_INPUT_INVALID"`;
7. keeps the zero-provider-call assertion.

Runtime, verbatim:

```text
deno 2.7.11 (stable, release, aarch64-apple-darwin)
v8 14.7.173.7-rusty
typescript 5.9.2
```

Focused test, verbatim:

```text
running 1 test from ./generate-story/handler_imageFetch_test.ts
D4-story a body-stream failure still answers JSON with CORS ...
------- output -------
[generate-story] petición inválida del cliente: HTTP 400
----- output end -----
D4-story a body-stream failure still answers JSON with CORS ... ok (7ms)

ok | 1 passed | 0 failed | 28 filtered out (14ms)
```

Canonical headline gates:

```text
ok | 297 passed | 0 failed (29s)

Found 94 problems
Checked 63 files

Found 46 errors.
error: Type checking failed.
EXIT focused=0 test=0 lint=1 check=1
```

The lint/check exits are the unchanged captured repository baseline. The commit adds only
test assertions and `git diff --check` is clean.

I independently severed the F3 special dispatch in a disposable archive by removing:

```ts
if (err.path === "body" && err.code === "INVALID_IMAGE_REF") {
  throw new ClientInputError(400, err.message);
}
```

With the committed test intact, the exact status assertion fails:

```text
[Diff] Actual / Expected

-   422
+   400

at generate-story/handler_imageFetch_test.ts:411:5

FAILED | 0 passed | 1 failed | 28 filtered out
MUTATION_STATUS_EXIT=1
```

To avoid `assertStrictEquals` short-circuiting and prove the second assertion independently,
I suppressed only the status assertion in the disposable test while leaving the same
dispatch mutation applied. The code assertion then fails:

```text
[Diff] Actual / Expected

-   INVALID_IMAGE_REF
+   CLIENT_INPUT_INVALID

at generate-story/handler_imageFetch_test.ts:413:5

FAILED | 0 passed | 1 failed | 28 filtered out
MUTATION_CODE_EXIT=1
```

Thus both additions are independently discriminating, and the test now satisfies the exact
round-1 requirement: client request-body stream interruption is pinned to HTTP 400 plus
`CLIENT_INPUT_INVALID`, with the pre-existing assertions retained.

The production worktree remained clean. Corpus blobs are untouched and recompute to:

```text
91ec703355f3584701fe25da484370e4ba57b156
b73fa3c645e1f29b1c697fb1b7081001987a3d15
```

## NOTES (non-verdict)

none
