/**
 * Access policy for the image-generation controls of the Cuentacuentos editor.
 *
 * Mirrors the server-side requirement of the generate-scene-images Edge Function
 * (REQUIRED_PERMISSION in supabase/functions/generate-scene-images/handler.ts):
 * the caller needs `liturgy_builder` / `write`. The UI uses this helper to
 * disable generation controls instead of offering buttons that would only fail
 * with 403. scripts/security/authorization-policy_test.ts asserts both sides agree.
 */
import { RESOURCE_NAMES } from '../../../types/rbac.ts';

export const IMAGE_GENERATION_PERMISSION = {
  resource: RESOURCE_NAMES.LITURGY_BUILDER,
  action: 'write',
} as const;

export const IMAGE_GENERATION_PENDING_REASON = 'Verificando permisos…';
export const IMAGE_GENERATION_DENIED_REASON =
  'Se requiere permiso de edición en el Constructor de Liturgias para generar imágenes con IA. ' +
  'Puedes subir imágenes manualmente.';

export interface ImageGenerationAccess {
  /** True only when the user may trigger AI image generation. */
  readonly allowed: boolean;
  /** True while the permission check is still running. */
  readonly pending: boolean;
  /** Human-readable reason shown on disabled controls; null when allowed. */
  readonly reason: string | null;
}

export function resolveImageGenerationAccess(state: { loading: boolean; canWrite: boolean }): ImageGenerationAccess {
  if (state.loading) return { allowed: false, pending: true, reason: IMAGE_GENERATION_PENDING_REASON };
  if (!state.canWrite) return { allowed: false, pending: false, reason: IMAGE_GENERATION_DENIED_REASON };
  return { allowed: true, pending: false, reason: null };
}
