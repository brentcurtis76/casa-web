/**
 * CASA — generate-scene-images Edge Function · entrypoint
 *
 * CASA project only (ref in supabase/config.toml). All logic lives in
 * ./handler.ts so it can be tested offline; this file only wires the runtime.
 * Deploy with scripts/security/deploy-generate-scene-images.sh.
 */
import { createHandler } from './handler.ts';

const handler = createHandler({
  env: { get: (name: string) => Deno.env.get(name) },
  fetch: (input, init) => fetch(input, init),
});

Deno.serve(handler);
