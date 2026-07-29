/**
 * Regresión — volver a la pestaña no debe desmontar la ruta protegida.
 *
 * SÍNTOMA: al construir una liturgia, cambiar de pestaña o de app y volver
 * devolvía al usuario al listado de liturgias, perdiendo el trabajo en curso.
 *
 * CAUSA (verificada en la librería instalada, @supabase/auth-js 2.90.1):
 * GoTrueClient registra un listener de `visibilitychange`
 * (GoTrueClient.js:2252). Al volver a ser visible llama a
 * `_onVisibilityChanged(false)` → `_recoverAndRefresh()`, que en el camino
 * normal (sesión válida y no expirada) termina en:
 *
 *     await this._notifyAllSubscribers('SIGNED_IN', currentSession)
 *
 * Es decir: CADA cambio de pestaña emite `SIGNED_IN` de nuevo, con el MISMO
 * usuario. AuthContext lo trataba como un login nuevo y volvía a pedir roles
 * y permisos, poniendo `rolesLoading = true`; ProtectedRoute veía ese flag y
 * sustituía a sus hijos por el spinner, desmontando el árbol y perdiendo el
 * estado local del constructor (`view` vuelve a 'list').
 *
 * Estos tests montan el AuthProvider REAL y el ProtectedRoute REAL. Sólo se
 * sustituye el cliente de Supabase, que es el límite externo: así el callback
 * de `onAuthStateChange` que se dispara es el mismo que ejecuta la librería.
 *
 * El hijo es un componente con estado local propio: lo que se afirma es el
 * contrato genérico "una re-notificación del mismo usuario no desmonta a los
 * hijos ni les borra el estado", que es exactamente lo que el constructor
 * necesita para sobrevivir.
 */

import React, { useEffect, useRef, useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Cliente de Supabase simulado — captura el callback de onAuthStateChange
// para poder dispararlo igual que lo hace _recoverAndRefresh().
// ---------------------------------------------------------------------------

type AuthCallback = (event: string, session: Session | null) => void;

const captured: { cb: AuthCallback | null } = { cb: null };
const unsubscribe = vi.fn();

const rolesRpc = vi.fn();
const permissionsRpc = vi.fn();
const profileSingle = vi.fn();
const getSession = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: AuthCallback) => {
        captured.cb = cb;
        return { data: { subscription: { unsubscribe } } };
      },
      getSession: () => getSession(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    },
    rpc: (name: string, args: unknown) => {
      if (name === 'get_user_roles') return rolesRpc(args);
      if (name === 'get_user_permissions') return permissionsRpc(args);
      return Promise.resolve({ data: null, error: null });
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => profileSingle(),
        }),
      }),
    }),
  },
}));

// Se importan DESPUÉS del mock para que el provider real lo consuma.
import { AuthProvider, useAuth } from '@/components/auth/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';

/** Latencia del RPC (ms). */
const RPC_MS = 20;

/**
 * Las RPC de RBAC son llamadas de red, no promesas ya resueltas. Modelar esa
 * latencia es imprescindible: el fallo se produce en la ventana en que
 * `rolesLoading` está en true y ProtectedRoute ya cambió a los hijos por el
 * spinner. Con mocks instantáneos React agrupa true/false en el mismo commit
 * y la ventana nunca llega al DOM, ocultando el bug.
 */
function withLatency<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), RPC_MS));
}

/** Deja correr el setTimeout(…, 0) de AuthContext sin resolver aún la RPC. */
async function flushMicroTick() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Espera a que la RPC en vuelo termine. */
async function flushRpc() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, RPC_MS + 5));
  });
}

function makeSession(userId: string): Session {
  // Objeto nuevo en cada llamada: replica que la librería deserializa la
  // sesión desde localStorage, por lo que la identidad del objeto cambia
  // aunque el usuario sea el mismo.
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00Z',
    },
  } as unknown as Session;
}

/** Cuenta montajes del hijo y conserva estado local, como el constructor. */
let mountCount = 0;

const BuilderStub: React.FC = () => {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      mountCount += 1;
    }
  }, []);

  return (
    <div>
      <span data-testid="view">{view}</span>
      <button onClick={() => setView('editor')}>Abrir constructor</button>
    </div>
  );
};

function renderProtected() {
  // MemoryRouter: ProtectedRoute redirige con <Navigate> cuando deniega.
  return render(
    <MemoryRouter initialEntries={['/admin/liturgia/constructor']}>
      <AuthProvider>
        <ProtectedRoute requires={{ resource: 'liturgy_builder', action: 'write' }}>
          <BuilderStub />
        </ProtectedRoute>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mountCount = 0;
  captured.cb = null;
  vi.clearAllMocks();

  getSession.mockResolvedValue({ data: { session: makeSession(USER_ID) } });
  rolesRpc.mockImplementation(() => withLatency({ data: ['liturgist'], error: null }));
  permissionsRpc.mockImplementation(() =>
    withLatency({
      data: [{ resource: 'liturgy_builder', action: 'write' }],
      error: null,
    })
  );
  profileSingle.mockImplementation(() =>
    withLatency({
      data: { id: USER_ID, full_name: 'Liturgista', avatar_url: null },
      error: null,
    })
  );
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthContext — re-notificación SIGNED_IN al volver a la pestaña', () => {
  it('mantiene montado al hijo y conserva su estado local', async () => {
    const user = userEvent.setup();
    renderProtected();

    // El constructor queda autorizado y montado.
    await screen.findByText('Abrir constructor');
    expect(mountCount).toBe(1);

    // El usuario entra al editor (equivalente a view = 'editor').
    await user.click(screen.getByText('Abrir constructor'));
    expect(screen.getByTestId('view')).toHaveTextContent('editor');

    const rolesCallsBefore = rolesRpc.mock.calls.length;

    // Cambio de pestaña: la librería vuelve a emitir SIGNED_IN con el MISMO
    // usuario y un objeto de sesión nuevo.
    await act(async () => {
      captured.cb?.('SIGNED_IN', makeSession(USER_ID));
    });

    // Ventana crítica: aquí es donde el usuario perdía el constructor. Si
    // AuthContext re-consulta el RBAC, `rolesLoading` pasa a true y
    // ProtectedRoute sustituye a los hijos por el spinner.
    await flushMicroTick();
    expect(screen.getByTestId('view')).toHaveTextContent('editor');
    expect(mountCount).toBe(1);

    // Y tras completarse cualquier revalidación, sigue sin remontar.
    await flushRpc();
    expect(screen.getByTestId('view')).toHaveTextContent('editor');
    expect(mountCount).toBe(1);

    // No debe re-consultarse el RBAC para el mismo usuario.
    expect(rolesRpc.mock.calls.length).toBe(rolesCallsBefore);
  });

  it('no muestra el spinner al re-notificar el mismo usuario', async () => {
    renderProtected();
    await screen.findByText('Abrir constructor');

    await act(async () => {
      captured.cb?.('TOKEN_REFRESHED', makeSession(USER_ID));
    });

    await flushMicroTick();
    expect(screen.getByText('Abrir constructor')).toBeInTheDocument();
    expect(mountCount).toBe(1);
  });

  it('sí vuelve a cargar roles cuando cambia el usuario de verdad', async () => {
    renderProtected();
    await screen.findByText('Abrir constructor');

    const before = rolesRpc.mock.calls.length;

    await act(async () => {
      captured.cb?.('SIGNED_IN', makeSession(OTHER_USER_ID));
    });
    await flushMicroTick();

    await waitFor(() => {
      expect(rolesRpc.mock.calls.length).toBeGreaterThan(before);
    });
    // El RBAC se pidió para el usuario nuevo, no para el anterior.
    expect(rolesRpc).toHaveBeenLastCalledWith({ p_user_id: OTHER_USER_ID });
  });

  /**
   * `refreshRoles` es API pública del contexto: cualquier pantalla puede
   * pedir una revalidación del RBAC (por ejemplo tras cambiar permisos). Esa
   * revalidación pone `rolesLoading` en true con el árbol ya montado, que es
   * justo la condición que desmontaba al constructor. ProtectedRoute debe
   * absorberla sin tirar a sus hijos.
   */
  it('no desmonta a los hijos durante un refreshRoles en vuelo', async () => {
    const user = userEvent.setup();

    const RefreshButton: React.FC = () => {
      const { refreshRoles } = useAuth();
      return <button onClick={() => void refreshRoles()}>Revalidar RBAC</button>;
    };

    render(
      <MemoryRouter initialEntries={['/admin/liturgia/constructor']}>
        <AuthProvider>
          <RefreshButton />
          <ProtectedRoute requires={{ resource: 'liturgy_builder', action: 'write' }}>
            <BuilderStub />
          </ProtectedRoute>
        </AuthProvider>
      </MemoryRouter>
    );

    await screen.findByText('Abrir constructor');
    await user.click(screen.getByText('Abrir constructor'));
    expect(screen.getByTestId('view')).toHaveTextContent('editor');

    // Dispara la revalidación y observa la ventana en que está en vuelo.
    await act(async () => {
      await user.click(screen.getByText('Revalidar RBAC'));
    });
    await flushMicroTick();

    expect(screen.getByTestId('view')).toHaveTextContent('editor');
    expect(mountCount).toBe(1);

    await flushRpc();
    expect(screen.getByTestId('view')).toHaveTextContent('editor');
    expect(mountCount).toBe(1);
  });

  it('limpia roles y permisos al cerrar sesión', async () => {
    renderProtected();
    await screen.findByText('Abrir constructor');

    await act(async () => {
      captured.cb?.('SIGNED_OUT', null);
    });
    await flushMicroTick();

    // Sin usuario, ProtectedRoute deja de renderizar al constructor.
    await waitFor(() => {
      expect(screen.queryByText('Abrir constructor')).not.toBeInTheDocument();
    });
  });
});
