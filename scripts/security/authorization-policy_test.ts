/**
 * Proves the UI access policy and the Edge Function authorization policy for
 * AI image generation are the same object: liturgy_builder / write.
 * Run: npm run test:security
 */
import assert from 'node:assert/strict';
import { LITURGY_WRITER_PERMISSION as REQUIRED_PERMISSION } from '../../supabase/functions/_shared/liturgyAuth.ts';
import {
  IMAGE_GENERATION_PERMISSION,
  resolveImageGenerationAccess,
} from '../../src/components/liturgia-builder/editors/imageGenerationAccess.ts';

Deno.test('UI and Edge Function enforce the same permission for image generation', () => {
  assert.deepEqual({ ...IMAGE_GENERATION_PERMISSION }, { ...REQUIRED_PERMISSION });
  assert.deepEqual({ ...REQUIRED_PERMISSION }, { resource: 'liturgy_builder', action: 'write' });
});

Deno.test('controls stay disabled while loading and for users without write permission', () => {
  assert.equal(resolveImageGenerationAccess({ loading: true, canWrite: true }).allowed, false);
  assert.equal(resolveImageGenerationAccess({ loading: false, canWrite: false }).allowed, false);
  assert.equal(resolveImageGenerationAccess({ loading: false, canWrite: true }).allowed, true);
  assert.equal(resolveImageGenerationAccess({ loading: false, canWrite: false }).reason?.includes('Constructor de Liturgias'), true);
  // Without an AuthProvider (isolated component render) the UI gate is inert; the Edge Function enforces.
  assert.equal(resolveImageGenerationAccess({ loading: true, canWrite: false, hasAuthContext: false }).allowed, true);
  assert.equal(resolveImageGenerationAccess({ loading: false, canWrite: false, hasAuthContext: true }).allowed, false);
});
