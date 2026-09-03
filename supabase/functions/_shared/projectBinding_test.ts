// Unit tests for the CASA project binding. Purely synthetic — no network.

import { assert, assertEquals, assertStrictEquals } from "@std/assert";

import {
  assertCasaProject,
  CASA_PROJECT_REF,
  isCasaProjectUrl,
  isLocalHostname,
  ProjectBindingError,
} from "./projectBinding.ts";

const CASA_URL = `https://${CASA_PROJECT_REF}.supabase.co`;
const FNE_URL = "https://sxlogxqzmarhqsblxmtj.supabase.co";

Deno.test("isCasaProjectUrl accepts CASA and local stacks only", () => {
  assertStrictEquals(isCasaProjectUrl(CASA_URL), true);
  assertStrictEquals(isCasaProjectUrl(`${CASA_URL}/`), true);
  for (const local of ["http://127.0.0.1:54321", "http://127.0.0.1:54331", "http://localhost:54331", "http://kong:8000", "http://host.docker.internal:54321"]) {
    assertStrictEquals(isCasaProjectUrl(local), true, local);
  }
  assertStrictEquals(isCasaProjectUrl(FNE_URL), false);
  assertStrictEquals(isCasaProjectUrl("https://someotherprojectref.supabase.co"), false);
  assertStrictEquals(isCasaProjectUrl(`https://evil.example/${CASA_PROJECT_REF}.supabase.co`), false);
  assertStrictEquals(isCasaProjectUrl("not a url"), false);
  assertStrictEquals(isCasaProjectUrl(""), false);
});

Deno.test("isLocalHostname recognises the local stack hosts", () => {
  assertStrictEquals(isLocalHostname("localhost"), true);
  assertStrictEquals(isLocalHostname("[::1]"), true);
  assertStrictEquals(isLocalHostname("db.internal"), true);
  assertStrictEquals(isLocalHostname(`${CASA_PROJECT_REF}.supabase.co`), false);
});

Deno.test("assertCasaProject throws a ProjectBindingError that never echoes the offending URL", () => {
  assertCasaProject(CASA_URL, "generate-scene-images");
  assertCasaProject("http://127.0.0.1:54331", "generate-scene-images");
  for (const bad of [FNE_URL, "https://someotherprojectref.supabase.co", undefined, ""]) {
    let thrown: unknown;
    try {
      assertCasaProject(bad, "generate-scene-images");
    } catch (e) {
      thrown = e;
    }
    assert(thrown instanceof ProjectBindingError, `expected ProjectBindingError for ${String(bad)}`);
    assertEquals(thrown.message.includes("sxlogxqzmarhqsblxmtj"), false);
    assertEquals(thrown.message.includes("someotherprojectref"), false);
    assert(thrown.message.includes("generate-scene-images"));
  }
});
