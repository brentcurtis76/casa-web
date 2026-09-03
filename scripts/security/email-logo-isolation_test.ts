/**
 * Regression test — request isolation of the Mesa Abierta email logo.
 *
 * The signed logo URL used by the two email Edge Functions must be resolved into
 * a request-local `const` and passed explicitly into every rendering function.
 * No module-scope mutable logo state may exist, so concurrent requests can never
 * share (or overwrite) each other's signed URL. Signing failure must still send
 * the email without a logo.
 *
 * Source-text checks only: offline, no values, no network. Run: npm run test:security
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

interface EmailFunction {
  readonly file: string;
  /** Rendering functions that build the HTML and must receive the logo explicitly. */
  readonly renderers: readonly string[];
}

const EMAIL_FUNCTIONS: readonly EmailFunction[] = [
  { file: 'supabase/functions/send-mesa-notifications/index.ts', renderers: ['sendHostEmail', 'sendGuestEmail'] },
  { file: 'supabase/functions/send-signup-confirmation/index.ts', renderers: ['sendConfirmationEmail'] },
];

function sourceOf(file: string): string {
  return readFileSync(join(REPO_ROOT, file), 'utf8');
}

for (const { file, renderers } of EMAIL_FUNCTIONS) {
  Deno.test(`${file}: no module-scope mutable logo state`, () => {
    const text = sourceOf(file);
    const moduleScopeMutables = text.split('\n').filter((line) => /^(let|var)\s/.test(line));
    assert.deepEqual(moduleScopeMutables, [], 'no module-scope let/var may exist (logo state included)');
    assert.doesNotMatch(text, /^(let|var)\s+\w*[Ll]ogo/m, 'no module-scope mutable logo binding');
    assert.doesNotMatch(text, /^\s*mesaLogoUrl\s*=/m, 'the logo URL is never assigned; it is declared const per request');
    const declaration = text.indexOf('const mesaLogoUrl = await resolveMesaLogoUrl(');
    const handlerStart = text.indexOf('serve(async (req)');
    assert.ok(handlerStart >= 0, 'request handler must be present');
    assert.ok(declaration > handlerStart, 'the signed URL must be resolved into a const INSIDE the request handler');
    assert.match(text, /^\s+const mesaLogoUrl = await resolveMesaLogoUrl\(/m, 'request-local const, not a module-level binding');
  });

  Deno.test(`${file}: request-local logo state is passed explicitly into rendering`, () => {
    const text = sourceOf(file);
    assert.match(text, /function mesaLogoImg\(logoUrl: string \| null\): string/, 'renderer helper takes the logo as a parameter');
    assert.doesNotMatch(text, /mesaLogoImg\(\)/, 'the helper must never read logo state implicitly');
    assert.match(text, /\$\{mesaLogoImg\(data\.logoUrl\)\}/, 'templates render the logo from the data they were given');
    for (const renderer of renderers) {
      assert.match(
        text,
        new RegExp(`async function ${renderer}\\(data: \\{[^}]*logoUrl: string \\| null;`, 's'),
        `${renderer} must declare logoUrl in its data contract`,
      );
      assert.match(
        text,
        new RegExp(`await ${renderer}\\(\\{[^}]*logoUrl: mesaLogoUrl,`, 's'),
        `${renderer} must receive the request-local logo URL explicitly`,
      );
    }
  });

  Deno.test(`${file}: signing failure still sends the email without a logo`, () => {
    const text = sourceOf(file);
    assert.match(text, /return logoUrl \? `<img src="\$\{logoUrl\}"[^`]*` : "";/, 'a null logo renders nothing');
    const resolver = text.slice(text.indexOf('async function resolveMesaLogoUrl('), text.indexOf('function mesaLogoImg('));
    assert.ok((resolver.match(/return null;/g) ?? []).length >= 2, 'resolver returns null on a signing error and on an exception');
    assert.ok(!/throw/.test(resolver), 'resolver never throws: the email is sent without a logo instead');
  });
}
