// D2 — la columna guarda la CAPACIDAD, la UI pregunta por la EXCLUSIÓN. La
// conversión vive en `buildParticipantInsert` y en ningún otro sitio, así que la
// polaridad se fija aquí:
//
//   switch apagado (por defecto) ⇒ can_bring_main_dish = true  ⇒ puede recibir plato principal
//   switch encendido             ⇒ can_bring_main_dish = false ⇒ nunca lo recibe

import { describe, expect, it } from 'vitest';

import {
  buildParticipantInsert,
  type ParticipantInsertInput,
} from '../participantPayload';

const guestInput: ParticipantInsertInput = {
  userId: 'user-1',
  monthId: 'month-1',
  rolePreference: 'guest',
  email: 'invitado@ejemplo.com',
  hasPlusOne: true,
  plusOneName: 'Acompañante',
  recurring: true,
  hostAddress: 'Calle Falsa 123',
  maxGuests: 7,
  phoneNumber: '+56 9 1234 5678',
  whatsappEnabled: false,
  cannotBringMainDish: false,
};

describe('buildParticipantInsert — polaridad del plato principal (D2)', () => {
  it('switch apagado ⇒ can_bring_main_dish true', () => {
    const row = buildParticipantInsert({ ...guestInput, cannotBringMainDish: false });

    expect(row.can_bring_main_dish).toBe(true);
  });

  it('switch encendido ⇒ can_bring_main_dish false', () => {
    const row = buildParticipantInsert({ ...guestInput, cannotBringMainDish: true });

    expect(row.can_bring_main_dish).toBe(false);
  });

  it('los demás campos pasan sin alterarse', () => {
    const row = buildParticipantInsert(guestInput);

    expect(row).toEqual({
      user_id: 'user-1',
      month_id: 'month-1',
      role_preference: 'guest',
      email: 'invitado@ejemplo.com',
      has_plus_one: true,
      plus_one_name: 'Acompañante',
      recurring: true,
      host_address: null,
      host_max_guests: null,
      phone_number: '+56 9 1234 5678',
      whatsapp_enabled: false,
      can_bring_main_dish: true,
      status: 'pending',
    });
  });

  it('anfitrión conserva dirección y cupo; invitado los recibe en null', () => {
    const host = buildParticipantInsert({ ...guestInput, rolePreference: 'host' });
    expect(host.host_address).toBe('Calle Falsa 123');
    expect(host.host_max_guests).toBe(7);

    const guest = buildParticipantInsert({ ...guestInput, rolePreference: 'guest' });
    expect(guest.host_address).toBeNull();
    expect(guest.host_max_guests).toBeNull();

    // El teléfono vacío también se normaliza a null, como hacía el insert original.
    expect(buildParticipantInsert({ ...guestInput, phoneNumber: '' }).phone_number).toBeNull();
  });
});
