// PB — T-B.10 — the D3 allowlist contract, at the shared validation seam.
//
// PB adds exactly one prefix to `ACCEPTED_BUCKET_PATHS`:
// `/storage/v1/object/public/liturgia-images/`. The producer is real and
// already live: `saveLiturgy` uploads finalized cuentacuentos images to that
// bucket via `uploadSingleImage` and rewrites the element config to its public
// URLs, so a re-opened cuento sends one of those URLs back as
// `refine.sourceImage`. Under PF's drafts-only pin that refine failed closed.
//
// Everything else about the contract is UNCHANGED and re-proved here, because
// a widening is only safe if the things it did not widen still hold: the sign
// form of the new bucket, a prefix collision, a third bucket on the same
// origin, encoded-separator traversal between the two allowed buckets, and the
// pre-existing origin/credentials/fragment/scheme rejections.
//
// The URL literals below are written out IN FULL rather than derived from the
// module's own constants. D3 is a string contract: a test that built its URL
// from `ACCEPTED_BUCKET_PATHS` would follow a typo into production and still
// pass. Only `TEST_SUPABASE_URL` is shared, because the origin pin is a
// deployment fact rather than part of the contract under test.

import { assertStrictEquals } from "@std/assert";

import {
  DEFAULT_IMAGE_LIMITS,
  ImageRefError,
  validateImageRef,
  type ValidateOptions,
} from "./imageFetch.ts";
import { TEST_SUPABASE_URL } from "./testHelpers.ts";

const OPTS: ValidateOptions = {
  limits: DEFAULT_IMAGE_LIMITS,
  supabaseUrl: TEST_SUPABASE_URL,
};

const PUBLIC_LITURGIA =
  `${TEST_SUPABASE_URL}/storage/v1/object/public/liturgia-images`;
const SIGN_LITURGIA =
  `${TEST_SUPABASE_URL}/storage/v1/object/sign/liturgia-images`;
const PUBLIC_DRAFTS =
  `${TEST_SUPABASE_URL}/storage/v1/object/public/cuentacuentos-drafts`;
const SIGN_DRAFTS =
  `${TEST_SUPABASE_URL}/storage/v1/object/sign/cuentacuentos-drafts`;

/** The shape `uploadSingleImage` actually writes, so the accept case is live. */
const FINALIZED_PATH = "liturgias/lit-1/cuentacuentos/cover/cover_9f2c.png";

const FIELD = "landmarks[0].referenceImages[0]";

function accept(input: string, field = FIELD): URL {
  const ref = validateImageRef(input, field, OPTS);
  assertStrictEquals(ref.kind, "url", `expected a URL ref for ${input}`);
  if (ref.kind !== "url") throw new Error("unreachable");
  return ref.url;
}

function reject(input: string, field = FIELD): ImageRefError {
  try {
    validateImageRef(input, field, OPTS);
  } catch (err) {
    if (err instanceof ImageRefError) return err;
    throw err;
  }
  throw new Error(`expected a typed rejection, got acceptance for: ${input}`);
}

// ---------------------------------------------------------------------------
// PB-P1 — the addition
// ---------------------------------------------------------------------------

// ACCEPTANCE — base-red at db42745: FORBIDDEN_BUCKET, "La imagen no está en el
// bucket permitido."
Deno.test("PB-P1 a public liturgia-images URL on the pinned origin is accepted", () => {
  const url = accept(`${PUBLIC_LITURGIA}/${FINALIZED_PATH}`);
  assertStrictEquals(url.origin, TEST_SUPABASE_URL);
  assertStrictEquals(
    url.pathname,
    `/storage/v1/object/public/liturgia-images/${FINALIZED_PATH}`,
    "the URL must be carried through verbatim, not rewritten",
  );
});

// A query string is how a Storage URL arrives in practice (cache-busting `t=`),
// and the prefix test is on the pathname, so it must survive one.
Deno.test("PB-P1b a public liturgia-images URL with a query string is accepted", () => {
  const url = accept(`${PUBLIC_LITURGIA}/${FINALIZED_PATH}?t=1730000000`);
  assertStrictEquals(url.search, "?t=1730000000");
});

// ---------------------------------------------------------------------------
// PB-P2 — what the addition deliberately did NOT widen
// ---------------------------------------------------------------------------

// The bucket is public, `uploadSingleImage` calls `getPublicUrl`, no
// `createSignedUrl` producer exists for it in either lineage, and a live
// read-only count on 2026-07-30 found zero persisted signed liturgia-images
// URLs. A future signed producer needs its own D3 contract change.
Deno.test("PB-P2 the SIGN form of liturgia-images stays FORBIDDEN_BUCKET", () => {
  const err = reject(`${SIGN_LITURGIA}/${FINALIZED_PATH}?token=abc`);
  assertStrictEquals(err.code, "FORBIDDEN_BUCKET");
  assertStrictEquals(err.status, 422);
  assertStrictEquals(err.path, FIELD);
});

// The allowlist entry ends in `/`. Without that exactness `liturgia-images-evil`
// is a prefix match and a bucket an attacker can create becomes readable.
Deno.test("PB-P3 a bucket whose name merely starts with liturgia-images is rejected", () => {
  for (
    const bucket of [
      "liturgia-images-evil",
      "liturgia-images2",
      "liturgia-imagesX",
    ]
  ) {
    const err = reject(
      `${TEST_SUPABASE_URL}/storage/v1/object/public/${bucket}/x.png`,
    );
    assertStrictEquals(err.code, "FORBIDDEN_BUCKET", `bucket ${bucket}`);
    assertStrictEquals(err.status, 422, `bucket ${bucket}`);
  }
});

// D3 forbids widening to an origin-wide allowlist. Adding a second bucket must
// not turn the check into "any bucket on the pinned origin": every name that is
// not one of the two allowlisted ones stays unreadable.
Deno.test("PB-P4 a third bucket on the pinned origin is rejected", () => {
  for (const bucket of ["liturgias-pdf", "avatars", "reflexiones"]) {
    const err = reject(
      `${TEST_SUPABASE_URL}/storage/v1/object/public/${bucket}/x.png`,
    );
    assertStrictEquals(err.code, "FORBIDDEN_BUCKET", `bucket ${bucket}`);
    assertStrictEquals(err.status, 422, `bucket ${bucket}`);
  }
});

// ---------------------------------------------------------------------------
// PB-P5 — cross-bucket traversal, now that there are two buckets to cross
// ---------------------------------------------------------------------------

// This is the case PB makes load-bearing. With one allowed bucket, an encoded
// separator pointing at the other bucket was rejected by the prefix test
// anyway. With two, `…/cuentacuentos-drafts/..%2fliturgia-images/x.png` starts
// with an ALLOWED prefix, so only the encoded-separator guard stands between it
// and a fetch that resolves into the other bucket once something decodes the
// path a second time. Both directions are checked: either bucket can be the
// launch point.
Deno.test("PB-P5 encoded-separator traversal between the two allowed buckets is rejected", () => {
  const traversals = [
    `${PUBLIC_DRAFTS}/..%2fliturgia-images/x.png`,
    `${PUBLIC_DRAFTS}/..%5cliturgia-images/x.png`,
    `${PUBLIC_DRAFTS}/..%2Fliturgia-images/x.png`,
    `${PUBLIC_LITURGIA}/..%2fcuentacuentos-drafts/x.png`,
    `${PUBLIC_LITURGIA}/..%5ccuentacuentos-drafts/x.png`,
    `${PUBLIC_LITURGIA}/..%5Ccuentacuentos-drafts/x.png`,
  ];
  for (const input of traversals) {
    const err = reject(input);
    assertStrictEquals(err.code, "FORBIDDEN_BUCKET", input);
    assertStrictEquals(err.status, 422, input);
  }
});

// ---------------------------------------------------------------------------
// PB-P6 — the pre-existing rejections, retained
// ---------------------------------------------------------------------------

Deno.test("PB-P6 wrong origin, credentials, fragment and http are still rejected", () => {
  // Another origin, even with an otherwise perfect liturgia-images path.
  assertStrictEquals(
    reject(
      `https://evil.example.com/storage/v1/object/public/liturgia-images/${FINALIZED_PATH}`,
    ).code,
    "FORBIDDEN_ORIGIN",
  );
  // A look-alike host that merely contains the pinned one.
  assertStrictEquals(
    reject(
      `https://proj.supabase.co.evil.example.com/storage/v1/object/public/liturgia-images/x.png`,
    ).code,
    "FORBIDDEN_ORIGIN",
  );
  // Credentials, on the newly allowed bucket.
  assertStrictEquals(
    reject(
      `https://user:pw@proj.supabase.co/storage/v1/object/public/liturgia-images/x.png`,
    ).code,
    "URL_CREDENTIALS",
  );
  // Fragment, on the newly allowed bucket.
  assertStrictEquals(
    reject(`${PUBLIC_LITURGIA}/x.png#frag`).code,
    "URL_FRAGMENT",
  );
  // Plain http to the same host is not the pinned origin's scheme.
  assertStrictEquals(
    reject(
      `http://proj.supabase.co/storage/v1/object/public/liturgia-images/x.png`,
    ).code,
    "INSECURE_SCHEME",
  );
});

// ---------------------------------------------------------------------------
// PB-P7 — the drafts prefixes are retained, not replaced
// ---------------------------------------------------------------------------

Deno.test("PB-P7 both cuentacuentos-drafts prefixes still validate", () => {
  assertStrictEquals(
    accept(`${PUBLIC_DRAFTS}/user-1/lit-1/cover/cover_9f2c.png`).pathname,
    "/storage/v1/object/public/cuentacuentos-drafts/user-1/lit-1/cover/cover_9f2c.png",
  );
  assertStrictEquals(
    accept(`${SIGN_DRAFTS}/user-1/lit-1/cover/cover_9f2c.png?token=abc`)
      .pathname,
    "/storage/v1/object/sign/cuentacuentos-drafts/user-1/lit-1/cover/cover_9f2c.png",
  );
});

// ---------------------------------------------------------------------------
// PB-P8 — provenance applies to unconsumed entries too
// ---------------------------------------------------------------------------

// A forbidden URL must be caught wherever it hides, including in a slot the
// selected request type never reads. The widening must not change that, in
// either direction: the new bucket is accepted in an unconsumed slot and a
// third bucket is still fatal there.
Deno.test("PB-P8 the widened allowlist applies identically to unconsumed entries", () => {
  const ref = validateImageRef(
    `${PUBLIC_LITURGIA}/${FINALIZED_PATH}`,
    "characters[0].referenceImage",
    OPTS,
    false,
  );
  assertStrictEquals(ref.kind, "url");
  assertStrictEquals(ref.consumed, false);

  try {
    validateImageRef(
      `${TEST_SUPABASE_URL}/storage/v1/object/public/avatars/x.png`,
      "characters[0].referenceImage",
      OPTS,
      false,
    );
    throw new Error("expected a typed rejection for a third bucket");
  } catch (err) {
    if (!(err instanceof ImageRefError)) throw err;
    assertStrictEquals(err.code, "FORBIDDEN_BUCKET");
  }
});
