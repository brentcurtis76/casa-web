/**
 * Polaridad (D2): la columna guarda la CAPACIDAD (`can_bring_main_dish`), la UI
 * pregunta por la EXCLUSIÓN (`cannotBringMainDish`). Se convierten aquí y solo aquí.
 *
 * | switch `No puedo traer el plato principal` | `can_bring_main_dish` |
 * |---|---|
 * | apagado (por defecto) | `true`  |
 * | encendido             | `false` |
 *
 * Módulo puro: sin React, sin cliente de Supabase, sin I/O.
 */
export interface ParticipantInsertInput {
  userId: string;
  monthId: string;
  rolePreference: 'host' | 'guest';
  email: string | null;
  hasPlusOne: boolean;
  plusOneName: string | null;
  recurring: boolean;
  hostAddress: string;
  maxGuests: number;
  phoneNumber: string;
  whatsappEnabled: boolean;
  /** El switch de la UI. `true` = el participante se excluye del plato principal. */
  cannotBringMainDish: boolean;
}

/** Fila lista para `.insert()` en `mesa_abierta_participants`. */
export function buildParticipantInsert(input: ParticipantInsertInput): {
  user_id: string;
  month_id: string;
  role_preference: 'host' | 'guest';
  email: string | null;
  has_plus_one: boolean;
  plus_one_name: string | null;
  recurring: boolean;
  host_address: string | null;
  host_max_guests: number | null;
  phone_number: string | null;
  whatsapp_enabled: boolean;
  can_bring_main_dish: boolean;
  // Literal, no `string`: el tipo `Insert` de la tabla exige la unión
  // '"pending" | "confirmed" | "cancelled" | "waitlist"', y un `string` ancho
  // haría fallar la sobrecarga de `.insert()` con un TS2769 nuevo.
  status: 'pending';
} {
  const isHost = input.rolePreference === 'host';

  return {
    user_id: input.userId,
    month_id: input.monthId,
    role_preference: input.rolePreference,
    email: input.email,
    has_plus_one: input.hasPlusOne,
    plus_one_name: input.plusOneName,
    recurring: input.recurring,
    host_address: isHost ? input.hostAddress : null,
    host_max_guests: isHost ? input.maxGuests : null,
    phone_number: input.phoneNumber || null,
    whatsapp_enabled: input.whatsappEnabled,
    can_bring_main_dish: !input.cannotBringMainDish,
    status: 'pending',
  };
}
