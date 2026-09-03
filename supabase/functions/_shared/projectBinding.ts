// CASA project binding for cost-bearing Edge Functions.
//
// A function that spends money (Gemini, Anthropic, Resend) must only ever run
// against the CASA Supabase project — never against the unrelated FNE project
// or any other ref the CLI happens to be linked to. The entrypoint calls
// `assertCasaProject(SUPABASE_URL, name)` BEFORE constructing any client or
// starting the server, so a deployment to the wrong project fails to boot
// (every request then fails closed at the platform level) instead of serving.
//
// Local development stacks (`supabase start`) are accepted so the function can
// be exercised locally. No network, no environment reads: pure module.

/** The only hosted Supabase project these functions may run against. */
export const CASA_PROJECT_REF = "mulsqxfhxxdsadxsljss";

const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "kong",
  "host.docker.internal",
]);

export function isLocalHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return LOCAL_HOSTNAMES.has(host) || host.endsWith(".local") ||
    host.endsWith(".internal");
}

/** True for the hosted CASA project URL or a local development stack. */
export function isCasaProjectUrl(supabaseUrl: string): boolean {
  try {
    const host = new URL(supabaseUrl).hostname.toLowerCase();
    return isLocalHostname(host) || host === `${CASA_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}

export class ProjectBindingError extends Error {
  constructor(functionName: string) {
    // The offending URL is deliberately not echoed: it may name another
    // customer's project and this message reaches platform logs.
    super(
      `${functionName}: SUPABASE_URL is not the CASA project (${CASA_PROJECT_REF}) nor a local stack; refusing to start`,
    );
    this.name = "ProjectBindingError";
  }
}

/**
 * Throws `ProjectBindingError` unless `supabaseUrl` points at CASA or a local
 * stack. Call it first thing in an entrypoint so the failure is a boot failure.
 */
export function assertCasaProject(
  supabaseUrl: string | undefined,
  functionName: string,
): void {
  if (!supabaseUrl || !isCasaProjectUrl(supabaseUrl)) {
    throw new ProjectBindingError(functionName);
  }
}
