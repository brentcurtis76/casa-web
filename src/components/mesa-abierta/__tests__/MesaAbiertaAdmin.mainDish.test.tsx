// P5c — B-15: la costura `fetchParticipants` → `EditParticipantDialog`.
//
// Borrar `can_bring_main_dish` del `select` de `MesaAbiertaAdmin.tsx:239` deja
// verdes los doce tests de P5a, porque ninguno monta el panel. El modo de fallo
// no es ruido: sin el campo el diálogo recibe `undefined`, arranca el switch
// apagado, y guardar cualquier otro cambio persiste `can_bring_main_dish: true`,
// reinscribiendo a alguien que se había excluido.
//
// Por eso el doble de Supabase de abajo **proyecta las columnas del `select`**,
// como hace PostgREST. Un doble que devolviera la fila entera pasaría este test
// con la costura rota, que es exactamente la aserción débil que la fase prohíbe.
//
// D12: todos los datos son sintéticos y viven en memoria.

import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MesaAbiertaAdmin } from '../MesaAbiertaAdmin';

vi.mock('@/components/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-user-id', email: 'admin@example.invalid' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const MONTH_ID = 'month-1';
const PARTICIPANT_ID = 'participante-1';
const USER_ID = 'user-1';

/** La fila completa, tal como vive en la tabla. */
const PARTICIPANT_ROW: Record<string, unknown> = {
  id: PARTICIPANT_ID,
  role_preference: 'guest',
  assigned_role: null,
  has_plus_one: false,
  status: 'pending',
  user_id: USER_ID,
  email: 'invitada@example.invalid',
  phone_number: '+56 9 8765 4321',
  host_address: null,
  host_max_guests: null,
  plus_one_name: null,
  // El campo bajo prueba: esta participante se excluyó del plato principal.
  can_bring_main_dish: false,
};

const ROWS: Record<string, Array<Record<string, unknown>>> = {
  mesa_abierta_months: [
    {
      id: MONTH_ID,
      month_date: '2026-09-01',
      dinner_date: '2026-09-12',
      registration_deadline: '2026-09-05',
      dinner_time: '19:00:00',
      status: 'open',
    },
  ],
  mesa_abierta_participants: [PARTICIPANT_ROW],
  profiles: [{ id: USER_ID, full_name: 'Invitada de Prueba' }],
  mesa_abierta_dietary_restrictions: [],
};

/** `single()` sólo lo usa la comprobación de rol de administrador. */
const SINGLE_ROWS: Record<string, Record<string, unknown> | null> = {
  mesa_abierta_admin_roles: { role: 'admin' },
};

/**
 * Lo que PostgREST hace con la lista de columnas: devolver **sólo** esas. Es la
 * única parte del doble que importa para B-15.
 */
function project(
  row: Record<string, unknown>,
  columns: string | undefined,
): Record<string, unknown> {
  if (!columns || columns.trim() === '*') return row;
  const wanted = columns
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  const projected: Record<string, unknown> = {};
  for (const column of wanted) {
    if (column in row) projected[column] = row[column];
  }
  return projected;
}

/**
 * Constructor encadenable y esperable: cada método devuelve `this`, y como el
 * objeto es un thenable, un `await` resuelve el resultado de la tabla.
 */
function queryBuilder(table: string) {
  let columns: string | undefined;

  const rows = () => (ROWS[table] ?? []).map((row) => project(row, columns));

  const chain: Record<string, unknown> = {
    select: (cols?: string) => {
      columns = cols;
      return chain;
    },
    single: () => Promise.resolve({ data: SINGLE_ROWS[table] ?? null, error: null }),
    maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
    then: (
      onFulfilled?: (value: { data: unknown; error: unknown }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: rows(), error: null }).then(onFulfilled, onRejected),
  };

  for (const method of [
    'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'is', 'not', 'gte', 'lte', 'gt', 'lt',
    'order', 'limit', 'range',
  ]) {
    chain[method] = () => chain;
  }

  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => queryBuilder(table),
    auth: {},
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}));

const mainDishSwitch = () =>
  screen.getByRole('switch', { name: /No puedo traer el plato principal/i });

describe('MesaAbiertaAdmin — plato principal', () => {
  it('el fetch entrega can_bring_main_dish al diálogo de edición', async () => {
    // `userEvent` y no `fireEvent`: las pestañas de Radix se activan en
    // `mouseDown`/`focus`, y un `click` suelto no cambia de pestaña.
    const user = userEvent.setup();

    render(<MesaAbiertaAdmin />);

    // El panel sólo se dibuja tras confirmar el rol de administrador.
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Participantes/i })).toBeInTheDocument()
    );

    await user.click(screen.getByRole('tab', { name: /Participantes/i }));

    // La lista llegó del fetch: si el doble no hubiera respondido, no habría fila.
    await waitFor(() =>
      expect(screen.getByText(/Invitada de Prueba/)).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: /Editar participante/i }));

    await waitFor(() =>
      expect(screen.getByText('Editar Participante')).toBeInTheDocument()
    );

    // La costura entera: la columna sale del `select`, cruza `fetchParticipants`,
    // entra en el diálogo como prop y enciende el switch.
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'true');
  });
});
