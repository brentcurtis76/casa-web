// P5a — el miembro declara la exclusión en el paso 3 y la ve reflejada en el
// resumen del paso 5. El switch nace APAGADO: quien no lo toca queda como hoy,
// es decir `can_bring_main_dish: true` (D2).

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { MesaAbiertaSignup } from '../MesaAbiertaSignup';

vi.mock('@/components/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-id', email: 'test@example.com' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mainDishSwitch = () =>
  screen.getByRole('switch', { name: /No puedo traer el plato principal/i });

const next = () => fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));

/** Deja el asistente en el paso 3 (como invitado, que no exige dirección). */
function advanceToStep3() {
  render(<MesaAbiertaSignup open onClose={vi.fn()} monthId="month-1" />);

  next(); // paso 1 → 2
  fireEvent.change(screen.getByLabelText('Nombre completo *'), {
    target: { value: 'Persona de prueba' },
  });
  fireEvent.change(screen.getByLabelText('Correo electrónico *'), {
    target: { value: 'persona@ejemplo.com' },
  });
  fireEvent.change(screen.getByLabelText('Número de teléfono *'), {
    target: { value: '+56 9 1234 5678' },
  });
  next(); // paso 2 → 3
}

/** Desde el paso 3, avanza hasta el resumen del paso 5. */
function advanceToStep5() {
  next(); // paso 3 → 4
  next(); // paso 4 → 5
  expect(screen.getByText('¡Casi listo!')).toBeInTheDocument();
}

describe('MesaAbiertaSignup — plato principal', () => {
  it('el switch aparece en el paso 3 y está apagado por defecto', () => {
    advanceToStep3();

    expect(screen.getByText('Paso 3 de 5')).toBeInTheDocument();
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'false');
    expect(
      screen.getByText('Te asignaremos ensalada, bebidas o postre en su lugar')
    ).toBeInTheDocument();
  });

  it('el resumen del paso 5 no menciona el plato principal si no se excluyó', () => {
    advanceToStep3();
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'false');

    advanceToStep5();

    expect(screen.queryByText(/plato principal/i)).not.toBeInTheDocument();
  });

  it('el resumen del paso 5 lo menciona cuando el usuario se excluye', () => {
    advanceToStep3();
    fireEvent.click(mainDishSwitch());
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'true');

    advanceToStep5();

    expect(screen.getByText('No traeré el plato principal')).toBeInTheDocument();
  });
});
