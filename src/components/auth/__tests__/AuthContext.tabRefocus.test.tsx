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
function withLatency<T>(value: T, ms: number = RPC_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/**
 * Latencia por RPC. Dos llamadas de red independientes prácticamente nunca
 * vuelven a la vez, así que poder desbalancearlas es lo REALISTA: el orden en
 * que se resuelven cambia cuál es la última actualización de estado, y con
 * ello si React llega a renderizar de nuevo.
 */
const latency = { roles: RPC_MS, permissions: RPC_MS };

/** RBAC simulado por usuario, para poder cruzar respuestas de dos identidades. */
type RbacFixture = {
  roles: string[];
  permissions: { resource: string; action: string }[];
  rolesLatency?: number;
  permissionsLatency?: number;
};

const rbacByUser: Record<string, RbacFixture> = {};

const liturgistFixture = (): RbacFixture => ({
  roles: ['liturgist'],
  permissions: [{ resource: 'liturgy_builder', action: 'write' }],
});

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
  latency.roles = RPC_MS;
  latency.permissions = RPC_MS;
  rbacByUser[USER_ID] = liturgistFixture();
  rbacByUser[OTHER_USER_ID] = liturgistFixture();

  rolesRpc.mockImplementation((args: { p_user_id: string }) => {
    const fixture = rbacByUser[args.p_user_id] ?? liturgistFixture();
    return withLatency(
      { data: fixture.roles, error: null },
      fixture.rolesLatency ?? latency.roles
    );
  });
  permissionsRpc.mockImplementation((args: { p_user_id: string }) => {
    const fixture = rbacByUser[args.p_user_id] ?? liturgistFixture();
    return withLatency(
      { data: fixture.permissions, error: null },
      fixture.permissionsLatency ?? latency.permissions
    );
  });
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

    // Y el veredicto debe volver a resolverse hasta mostrar contenido. Si el
    // usuario nuevo obtiene el MISMO booleano que el anterior, guardar el
    // veredicto y su dueño por separado hace que `setAuthorized` sea un no-op
    // (Object.is) y React no vuelva a renderizar: la ruta se quedaría colgada
    // en el spinner para siempre.
    await flushRpc();
    await waitFor(() => {
      expect(screen.getByText('Abrir constructor')).toBeInTheDocument();
    });
  });

  /**
   * Cambio de usuario con los permisos resolviéndose ANTES que los roles, de
   * modo que la última actualización de estado sea `setRolesLoading(false)` y
   * el veredicto se calcule después, con el mismo booleano que el usuario
   * anterior.
   *
   * NOTA HONESTA: no se logró que este caso fallara con la implementación
   * anterior (veredicto booleano en estado + dueño en una ref). React vuelve a
   * renderizar el componente antes de descartar la actualización redundante,
   * y ese render releía la ref. Es decir, aquello dependía de un detalle que
   * React documenta como "puede que" — no como garantía. Este test no es
   * prueba de un fallo observado: es la red de seguridad de la invariante que
   * ahora sí se sostiene por construcción (veredicto y dueño en un solo valor
   * de estado), y fallaría si alguien los volviera a separar de una forma que
   * sí se atasque.
   */
  it('resuelve el cambio de usuario aunque el veredicto booleano no cambie', async () => {
    latency.permissions = 5;
    latency.roles = 40;

    renderProtected();
    await waitFor(() => screen.getByText('Abrir constructor'), { timeout: 2000 });

    await act(async () => {
      captured.cb?.('SIGNED_IN', makeSession(OTHER_USER_ID));
    });
    await flushMicroTick();

    // El usuario nuevo tiene exactamente los mismos permisos: mismo booleano.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });

    await waitFor(() => {
      expect(screen.getByText('Abrir constructor')).toBeInTheDocument();
    });
  });

  /**
   * SEGURIDAD: el RBAC debe estar tan atado a la identidad como el veredicto.
   *
   * Si la carga de A sigue en vuelo cuando se pasa a B, la respuesta rezagada
   * de A no puede escribir sus roles en el estado global: ProtectedRoute los
   * evaluaría con `user` = B y registraría el resultado como veredicto de B.
   * Con A administrador, B heredaría esa autorización de cliente.
   */
  it('descarta el RBAC rezagado del usuario anterior', async () => {
    // A es admin y responde tarde; B no es admin y responde rápido.
    rbacByUser[USER_ID] = {
      roles: ['general_admin'],
      permissions: [{ resource: 'liturgy_builder', action: 'write' }],
      rolesLatency: 80,
      permissionsLatency: 80,
    };
    rbacByUser[OTHER_USER_ID] = {
      roles: [],
      permissions: [],
      rolesLatency: 5,
      permissionsLatency: 5,
    };

    const Probe: React.FC = () => {
      const { roles, isAdmin } = useAuth();
      return (
        <>
          <span data-testid="is-admin">{isAdmin ? 'yes' : 'no'}</span>
          <span data-testid="roles">[{roles.join(',')}]</span>
        </>
      );
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    );

    // Con la carga de A todavía en vuelo, la sesión pasa a B.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    await act(async () => {
      captured.cb?.('SIGNED_IN', makeSession(OTHER_USER_ID));
    });

    // Llega primero B (5ms) y mucho después la respuesta rezagada de A (80ms).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    expect(screen.getByTestId('is-admin')).toHaveTextContent('no');
    expect(screen.getByTestId('roles')).toHaveTextContent('[]');
  });

  /**
   * La carga se programa con setTimeout(…, 0), así que la generación se captura
   * cuando el callback CORRE, no cuando se programa. Si la sesión pasa a B
   * antes de que corra el callback de A, el de A captura la generación nueva y
   * pasa por vigente. Si además A termina el último, el snapshot guardado es de
   * A: no se lo aplica a B (la propiedad protege eso), pero B se queda sin RBAC
   * propio y por tanto en el spinner hasta otra notificación.
   */
  it('no deja al usuario nuevo colgado por una carga diferida del anterior', async () => {
    // Sin sesión previa: las dos identidades entran por el listener.
    getSession.mockResolvedValue({ data: { session: null } });

    rbacByUser[USER_ID] = {
      roles: ['general_admin'],
      permissions: [{ resource: 'liturgy_builder', action: 'write' }],
      rolesLatency: 80,
      permissionsLatency: 80,
    };
    rbacByUser[OTHER_USER_ID] = {
      roles: ['liturgist'],
      permissions: [{ resource: 'liturgy_builder', action: 'write' }],
      rolesLatency: 5,
      permissionsLatency: 5,
    };

    const Probe: React.FC = () => {
      const { roles, rolesLoading } = useAuth();
      return (
        <>
          <span data-testid="roles">[{roles.join(',')}]</span>
          <span data-testid="loading">{rolesLoading ? 'cargando' : 'listo'}</span>
        </>
      );
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    );
    await flushMicroTick();

    // A y B se notifican antes de que corra ningún callback diferido.
    await act(async () => {
      captured.cb?.('SIGNED_IN', makeSession(USER_ID));
      captured.cb?.('SIGNED_IN', makeSession(OTHER_USER_ID));
    });

    // B responde a los 5ms; la carga rezagada de A, a los 80ms.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    expect(screen.getByTestId('roles')).toHaveTextContent('[liturgist]');
    expect(screen.getByTestId('loading')).toHaveTextContent('listo');
  });

  /**
   * Una recarga forzada limpia el marcador de "en vuelo", pero la petición
   * anterior sigue viva sobre la misma identidad: puede terminar la última y
   * pisar el resultado nuevo (y su `finally` limpiar el marcador del nuevo).
   * Afecta al refresco de perfil tras editarlo.
   */
  it('la recarga forzada de perfil gana a la petición anterior en vuelo', async () => {
    profileSingle.mockImplementationOnce(() =>
      withLatency(
        { data: { id: USER_ID, full_name: 'Nombre Viejo', avatar_url: null }, error: null },
        80
      )
    );
    profileSingle.mockImplementationOnce(() =>
      withLatency(
        { data: { id: USER_ID, full_name: 'Nombre Nuevo', avatar_url: null }, error: null },
        5
      )
    );

    const Probe: React.FC = () => {
      const { profile, refreshProfile } = useAuth();
      return (
        <>
          <span data-testid="profile">{profile?.full_name ?? 'sin-perfil'}</span>
          <button onClick={() => void refreshProfile()}>Recargar perfil</button>
        </>
      );
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    );

    // Con la primera petición (lenta) aún en vuelo, se fuerza una recarga.
    await flushMicroTick();
    await act(async () => {
      screen.getByText('Recargar perfil').click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    // Debe quedar el resultado más reciente, no el rezagado.
    expect(screen.getByTestId('profile')).toHaveTextContent('Nombre Nuevo');
  });

  /**
   * El perfil se pedía sin comprobar su resultado, y la identidad se marcaba
   * como cargada sólo con el RBAC. Si el perfil fallaba pero el RBAC no, toda
   * notificación posterior se saltaba las tres peticiones y el perfil quedaba
   * nulo hasta recargar.
   */
  it('reintenta el perfil si su carga inicial falló', async () => {
    profileSingle.mockImplementationOnce(() =>
      withLatency({ data: null, error: { message: 'network error' } })
    );

    const Probe: React.FC = () => {
      const { profile } = useAuth();
      return <span data-testid="profile">{profile?.full_name ?? 'sin-perfil'}</span>;
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    );

    await flushRpc();
    expect(screen.getByTestId('profile')).toHaveTextContent('sin-perfil');

    // Volver a la pestaña debe reintentar el perfil que faltó.
    await act(async () => {
      captured.cb?.('SIGNED_IN', makeSession(USER_ID));
    });
    await flushMicroTick();
    await flushRpc();

    await waitFor(() => {
      expect(screen.getByTestId('profile')).toHaveTextContent('Liturgista');
    });
  });

  /**
   * Un fallo transitorio de RBAC en la carga inicial no puede quedar cacheado:
   * marcar la identidad como "cargada" antes de que las peticiones tengan
   * éxito dejaba al usuario sin roles y hacía que toda notificación posterior
   * del mismo usuario se saltara la recarga. Como `refreshRoles` no tiene
   * llamadores en producción, el usuario quedaba bloqueado hasta recargar.
   */
  it('reintenta el RBAC si la carga inicial falló', async () => {
    // Primera llamada de cada RPC: error de red. Las siguientes, éxito.
    rolesRpc.mockImplementationOnce(() =>
      withLatency({ data: null, error: { message: 'network error' } })
    );
    permissionsRpc.mockImplementationOnce(() =>
      withLatency({ data: null, error: { message: 'network error' } })
    );

    const RolesProbe: React.FC = () => {
      const { roles, permissions } = useAuth();
      return (
        <span data-testid="rbac">
          {roles.join(',')}|{permissions.length}
        </span>
      );
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <RolesProbe />
        </AuthProvider>
      </MemoryRouter>
    );

    // La carga inicial falla y deja al usuario sin roles ni permisos.
    await flushRpc();
    expect(screen.getByTestId('rbac')).toHaveTextContent('|0');

    // Volver a la pestaña re-emite SIGNED_IN: debe reintentarse.
    await act(async () => {
      captured.cb?.('SIGNED_IN', makeSession(USER_ID));
    });
    await flushMicroTick();
    await flushRpc();

    await waitFor(() => {
      expect(screen.getByTestId('rbac')).toHaveTextContent('liturgist|1');
    });
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
