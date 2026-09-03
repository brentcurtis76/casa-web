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

export interface ImageGenerationPermissionState {
  readonly loading: boolean;
  readonly canWrite: boolean;
  /**
   * False when the editor is rendered without an AuthProvider (isolated
   * component renders in tests). Defaults to true. Without an auth context
   * there is no user to evaluate, so the UI gate is INERT rather than a
   * blanket denial: the Edge Function remains the enforcement point, and in
   * the application every route is mounted under AuthProvider (src/App.tsx).
   */
  readonly hasAuthContext?: boolean;
}

export function resolveImageGenerationAccess(state: ImageGenerationPermissionState): ImageGenerationAccess {
  if (state.hasAuthContext === false) return { allowed: true, pending: false, reason: null };
  if (state.loading) return { allowed: false, pending: true, reason: IMAGE_GENERATION_PENDING_REASON };
  if (!state.canWrite) return { allowed: false, pending: false, reason: IMAGE_GENERATION_DENIED_REASON };
  return { allowed: true, pending: false, reason: null };
}
