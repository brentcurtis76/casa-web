// P5a — el diálogo de edición muestra la EXCLUSIÓN y persiste la CAPACIDAD (D2).
// El switch es el negado del campo, y `undefined` —filas anteriores a la columna—
// cuenta como "sí puede traerlo", igual que el DEFAULT de la columna.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { EditParticipantDialog } from '../EditParticipantDialog';

const updateCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// El mock global de `src/test/setup.ts` devuelve `undefined` de los terminadores,
// así que el submit real revienta. Éste sí resuelve, y además captura el payload.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      update: (payload: Record<string, unknown>) => {
        updateCalls.push({ table, payload });
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  },
}));

type Participant = React.ComponentProps<typeof EditParticipantDialog>['participant'];

const baseParticipant: Participant = {
  id: 'p-1',
  role_preference: 'guest',
  assigned_role: null,
  has_plus_one: false,
  status: 'pending',
  user_id: 'user-1',
  phone_number: '+56 9 1234 5678',
  email: 'invitado@ejemplo.com',
  full_name: 'Persona Uno',
};

function renderDialog(participant: Participant) {
  return render(
    <EditParticipantDialog
      open
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      participant={participant}
    />
  );
}

const mainDishSwitch = () =>
  screen.getByRole('switch', { name: /No puedo traer el plato principal/i });

describe('EditParticipantDialog — plato principal', () => {
  beforeEach(() => {
    updateCalls.length = 0;
  });

  it('el switch se inicializa como el negado del campo', () => {
    // can_bring_main_dish: false ⇒ está excluido ⇒ switch encendido.
    const { rerender } = renderDialog({ ...baseParticipant, can_bring_main_dish: false });
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'true');

    // Reabrir con OTRO participante que sí puede traerlo ⇒ el switch lo sigue.
    rerender(
      <EditParticipantDialog
        open
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        participant={{ ...baseParticipant, id: 'p-2', can_bring_main_dish: true }}
      />
    );
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'false');

    // `undefined` (fila anterior a la columna) ⇒ apagado, como el DEFAULT.
    rerender(
      <EditParticipantDialog
        open
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        participant={{ ...baseParticipant, id: 'p-3' }}
      />
    );
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'false');
  });

  it('guardar incluye can_bring_main_dish en el update', async () => {
    renderDialog({ ...baseParticipant, can_bring_main_dish: true });
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'false');

    // Sin tocar nada: se persiste la capacidad intacta.
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() =>
      expect(updateCalls.some(c => c.table === 'mesa_abierta_participants')).toBe(true)
    );
    expect(
      updateCalls.find(c => c.table === 'mesa_abierta_participants')!.payload
    ).toMatchObject({ can_bring_main_dish: true });

    // Encendiendo el switch: la capacidad pasa a false.
    updateCalls.length = 0;
    fireEvent.click(mainDishSwitch());
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() =>
      expect(updateCalls.some(c => c.table === 'mesa_abierta_participants')).toBe(true)
    );
    expect(
      updateCalls.find(c => c.table === 'mesa_abierta_participants')!.payload
    ).toMatchObject({ can_bring_main_dish: false });
  });
});
