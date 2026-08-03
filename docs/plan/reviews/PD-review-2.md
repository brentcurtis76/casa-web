CODEX REVIEW — PD ROUND 2/2 FINAL — phase/pd-contract@2bdec82

VERDICT: FAIL

The response-parse code defect is correctly fixed and did not break its runtime class.
However, the round-1 [B1] consolidated remediation had a third, explicit D7 requirement:
tighten the existing request body-stream interruption test to assert exact HTTP 400 and
`code:"CLIENT_INPUT_INVALID"`. That test is unchanged and still cannot distinguish the
ratified behavior from the former `422/INVALID_IMAGE_REF` behavior. Under D7 and the
round-1 matrix, [B1] is therefore not completely fixed.

Per the stated gate, this is the final reviewer disposition; there is no round 3.

## RUNTIME / GATES RE-RUN

Target: clean `/private/tmp/casa-pd` worktree at
`2bdec82985ca877f7f90befe7bae18e102e031c8`, direct child of `f3d25fc`.
The delta is exactly two files, `+90/-1`; `git diff --check f3d25fc..2bdec82` is clean.
No live provider calls were made.

Runtime, verbatim:

```text
deno 2.7.11 (stable, release, aarch64-apple-darwin)
v8 14.7.173.7-rusty
typescript 5.9.2
```

Canonical gates from `supabase/functions/`, verbatim:

```text
ok | 297 passed | 0 failed (26s)

Found 94 problems
Checked 63 files

Found 46 errors.
error: Type checking failed.
GATE_EXIT test=0 lint=1 check=1
```

The non-zero lint/check exits are the captured repository baseline. I independently
recomputed the D6 identities against an archive of `f3d25fc`:

```text
CHECK_DELTA_BEGIN
CHECK_DELTA_END
CHECK_COUNTS base=46 head=46
LINT_DELTA_BEGIN
LINT_DELTA_END
LINT_COUNTS base=94 head=94
```

Focused suites:

```text
handler_contract_test.ts:
ok | 69 passed | 0 failed (43ms)

corpus_parity_test.ts:
ok | 33 passed | 0 failed (260ms)

generate-scene-images/corpus_test.ts:
ok | 31 passed | 0 failed (208ms)
```

The first attempted corpus command used the nonexistent
`generate-story/corpus_test.ts`; it was corrected to the repository's actual captured-corpus
path, `generate-scene-images/corpus_test.ts`, which passed 31/0.

## MATRIX: [B1] NOT FIXED

### Code seam — FIXED

The two guards are correctly ordered and scoped:

1. `response.json()` is inside a `catch { ... }` that binds no exception. V8's
   provider-derived `SyntaxError.message` is structurally unavailable to the handler.
2. Parsed `null`, arrays, and scalar JSON values are rejected before any property access.
3. Both guards throw `ProviderOutputError("INVALID_STORY", <fixed module literal>)` and flow
   through the existing typed dispatch.
4. Parsed message objects continue into the unchanged `stop_reason` and tool-block protocol.

My production-handler attack matrix:

```text
empty          502 exact=true leaked=[]
leading-token  502 exact=true leaked=[]
truncated      502 exact=true leaked=[]
json-string    502 exact=true leaked=[]
json-array     502 exact=true leaked=[]
json-number    502 exact=true leaked=[]
json-boolean   502 exact=true leaked=[]
json-null      502 exact=true leaked=[]
empty-object   502 exact=true leaked=[]
read-interrupt 502 exact=true leaked=[]
```

For every row, “exact” means:

```json
{
  "success": false,
  "code": "PROVIDER_OUTPUT_INVALID",
  "error": "El proveedor devolvió un cuento con una estructura inválida. Vuelve a intentarlo."
}
```

No planted token, raw response bytes, `SyntaxError`, `TypeError`, or engine parse text reached
the body or captured logs.

The additive envelope also remains intact on the new parse-failure path:

```json
{
  "status": 502,
  "body": {
    "success": false,
    "code": "PROVIDER_OUTPUT_INVALID",
    "error": "El proveedor devolvió un cuento con una estructura inválida. Vuelve a intentarlo.",
    "skippedImages": [
      {
        "field": "props[0].referenceImages[0]",
        "code": "NOT_IMAGE"
      }
    ],
    "warnings": [
      {
        "source": "location",
        "code": "MODEL_NOT_FOUND",
        "message": "El modelo de investigación visual no está disponible en la investigación del lugar. No se pudo incorporar esa información.",
        "httpStatus": 404
      }
    ]
  }
}
```

Adjacent paths did not widen:

```text
provider HTTP 400:
status=500
body={"success":false,"error":"Error de Claude API: 400"}
log="[generate-story] Error de API: 400 bytes=32"
planted provider token seen=false

valid strict-tool story:
status=200
success=true
sceneCount=15
```

The existing `PD-envelope` success-shape test also remains green.

### PD2m / PD2n discrimination — FIXED

The ten-byte leading token is a materially better base-red plant than the longer example in
round 1 because it matches V8's measured quoted prefix. Against the untouched `f3d25fc`
handler, I reproduced:

```text
PD2m-base
status=500
{"success":false,"error":"Unexpected token 'S', \"SIGNEDTOK1\"... is not valid JSON"}

PD2n-base
status=500
{"success":false,"error":"Cannot read properties of null (reading 'stop_reason')",
 "warnings":[{"source":"location","code":"MODEL_NOT_FOUND",...}]}
```

At `2bdec82`, PD2m and PD2n pass inside the 69/0 contract suite. They are genuinely
base-red and independently discriminate the two response guards.

### Required request-stream D7 pin — NOT FIXED

Round 1 required, in the same consolidated remediation:

> tighten the existing body-stream interruption test to assert exact HTTP 400 and
> `code:"CLIENT_INPUT_INVALID"` (plus its existing JSON/CORS/no-provider assertions).

`generate-story/handler_imageFetch_test.ts` is absent from
`f3d25fc..2bdec82`. Its existing D4 test still asserts only:

- CORS headers;
- JSON content type;
- `success:false`;
- zero provider calls.

It does **not** assert `res.status === 400`, `body.code === "CLIENT_INPUT_INVALID"`, or the
fixed Spanish interruption message. Consequently, that test remains green if the handler
regresses to the pre-ratification `422/INVALID_IMAGE_REF` response. PD6f pins malformed JSON,
not an interrupted request stream; PD2m's `read-interrupt` class is the Anthropic **response**
stream, not the client **request** stream. These are different boundaries.

The implementation currently returns the ratified envelope:

```text
400 {"success":false,"code":"CLIENT_INPUT_INVALID","error":"La petición se interrumpió."}
```

The failure is test honesty/completeness under D7, not a demonstrated runtime regression.
Because the missing assertion was an explicit part of [B1]'s required final remediation,
the matrix cannot be marked FIXED.

## FINDINGS / LOW-CONFIDENCE / NOTES

**Finding:** one blocking D7 omission, described above. The two response-body guards
themselves have no remaining finding.

**Low-confidence:** none.

**Notes:** corpus blobs and corpus behavior are outside the two-file delta and remained green.
The final disposition now returns to Brent for accept / re-plan / backlog as specified; this
review does not authorize another executor/reviewer round.
