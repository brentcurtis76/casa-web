/**
 * E / A9a — Decisión pura del auto-arranque (auto-kick) del pipeline.
 *
 * ## Por qué existe este módulo
 *
 * El auto-arranque legado se INFERÍA de una transición de pasos: un efecto
 * comparaba `prevStep → currentStep` y, si el par pertenecía a la lista de
 * avances (`story→characters`, `characters→scenes`, `scenes→cover`), disparaba
 * el lote. Esa inferencia es exactamente lo que A9a prohíbe:
 *
 *   - El MISMO par de pasos se produce por caminos que NO deben generar nada
 *     (restaurar un borrador una posición más adelante, `handleEditStory`,
 *     navegar hacia atrás y volver), así que la señal no distingue intención de
 *     coincidencia.
 *   - El efecto se arma con el cambio de paso, no con la persistencia de la
 *     aprobación: un rerender podía perder o duplicar el disparo.
 *
 * A9a lo reemplaza por un INTENT EXPLÍCITO: la aprobación, y sólo ella, arma
 * `{step, epoch}` dentro de su `onSuccess` (es decir, después de que el commit
 * autoritativo persistió). Este módulo decide qué hacer con ese intent, y el
 * runner decide si la corrida efectivamente arrancó (`tryStart` → `accepted`).
 *
 * La función es pura para poder testearla exhaustivamente sin React ni runner.
 */

import type { EditorCreationStep } from './recoverySnapshot';

/**
 * Intención de auto-arranque armada por una aprobación ya persistida.
 * `epoch` es la época del draft viva en el momento del commit — sirve para que
 * un intent no sobreviva a un cambio de ciclo de vida (delete, regenerar,
 * recuperar borrador, cambiar de historia).
 */
export interface AutoKickIntent {
  step: EditorCreationStep;
  epoch: number;
}

/** Estado vivo contra el que se evalúa el intent. */
export interface AutoKickLiveState {
  step: EditorCreationStep;
  epoch: number;
}

/**
 * Qué hacer con el intent pendiente:
 *
 *  - `fire`  — el intent corresponde al estado vivo: intentar arrancar. El
 *              intent se consume SÓLO si el runner acepta (`accepted:true`);
 *              si estaba ocupado, se CONSERVA para reintentar al quedar idle.
 *  - `clear` — el intent ya no corresponde a la realidad (cambió la época, o el
 *              paso vivo no es el que la aprobación dejó). Se descarta SIN
 *              disparar nada.
 *  - `none`  — no hay intent armado. Nunca se genera por inferencia de pasos.
 */
export type AutoKickDecision = 'fire' | 'clear' | 'none';

export function shouldAutoKick(
  intent: AutoKickIntent | null | undefined,
  live: AutoKickLiveState,
): AutoKickDecision {
  if (!intent) return 'none';
  // Cambio de ciclo de vida: el intent pertenece a un draft que ya no está
  // vivo. Descartar sin disparar — nunca generar contra la historia nueva.
  if (intent.epoch !== live.epoch) return 'clear';
  // El paso vivo se movió respecto del que dejó la aprobación (el usuario
  // navegó, o llegó otra transición). El intent quedó obsoleto: descartarlo.
  if (intent.step !== live.step) return 'clear';
  return 'fire';
}
