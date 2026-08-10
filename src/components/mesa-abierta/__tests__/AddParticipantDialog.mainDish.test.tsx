// P5a — el diálogo de alta manual no escribe en la tabla: llama a la edge function
// `admin-add-participant`, cuyo cuerpo es camelCase. El campo viaja en su forma
// POSITIVA (`canBringMainDish`), que es la que P5b leerá en el servidor.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AddParticipantDialog } from '../AddParticipantDialog';

const invoke = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// El mock global de `src/test/setup.ts` no tiene clave `functions`, así que
// `supabase.functions.invoke` sería `undefined`. Este override la aporta.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
    auth: {},
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
  },
}));

function renderDialog() {
  return render(
    <AddParticipantDialog open onClose={vi.fn()} onSuccess={vi.fn()} monthId="month-1" />
  );
}

async function submitWithName() {
  fireEvent.change(screen.getByLabelText('Nombre completo *'), {
    target: { value: 'Persona de prueba' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Agregar Participante' }));
  await waitFor(() => expect(invoke).toHaveBeenCalled());
  return invoke.mock.calls[0][1] as { body: Record<string, unknown> };
}

describe('AddParticipantDialog — plato principal', () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('envía canBringMainDish en el cuerpo de la función', async () => {
    renderDialog();

    const zwitch = screen.getByRole('switch', { name: /No puedo traer el plato principal/i });
    expect(zwitch).toHaveAttribute('aria-checked', 'false');

    // Switch apagado ⇒ el cuerpo lleva la capacidad en positivo.
    const bodyOff = await submitWithName();
    expect(bodyOff.body).toMatchObject({ canBringMainDish: true });
    expect(bodyOff.body).not.toHaveProperty('cannotBringMainDish');
    expect(bodyOff.body).not.toHaveProperty('can_bring_main_dish');
    expect(invoke.mock.calls[0][0]).toBe('admin-add-participant');

    // Switch encendido ⇒ el mismo campo en false.
    invoke.mockClear();
    fireEvent.click(zwitch);
    expect(zwitch).toHaveAttribute('aria-checked', 'true');

    const bodyOn = await submitWithName();
    expect(bodyOn.body).toMatchObject({ canBringMainDish: false });
  });
});
