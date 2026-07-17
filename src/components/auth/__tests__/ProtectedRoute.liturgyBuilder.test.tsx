/**
 * T-0.8 — /admin/liturgia/constructor requiere liturgy_builder:write
 *
 * Ejercita el registro de rutas REAL (`appRoutes` de src/appRoutes.tsx,
 * montado por App.tsx vía createBrowserRouter), no una copia local: si
 * alguien quita el ProtectedRoute de la ruta del constructor, estos
 * tests fallan.
 *
 *   1. Estructural: la ruta registrada para /admin/liturgia/constructor
 *      debe ser un ProtectedRoute con requires liturgy_builder:write.
 *   2. Conductual (deny): sin el permiso, navegar a la ruta real redirige
 *      a /admin con toast de acceso denegado.
 *   3. Conductual (allow): con liturgy_builder:write, la ruta real
 *      renderiza el constructor.
 *
 * El AuthContext se mockea para controlar hasPermission sin tocar
 * Supabase; las dos páginas que estos casos montan se sustituyen por
 * stubs livianos (el registro de rutas sigue siendo el real).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks (deben declararse antes de importar App/ProtectedRoute)
// ---------------------------------------------------------------------------

type AuthState = {
  user: { id: string } | null;
  loading: boolean;
  rolesLoading: boolean;
  isAdmin: boolean;
  hasPermission: (resource: string, action: string) => Promise<boolean>;
  hasRole: (role: string) => boolean;
};

const authState: AuthState = {
  user: { id: '11111111-1111-4111-8111-111111111111' },
  loading: false,
  rolesLoading: false,
  isAdmin: false,
  hasPermission: vi.fn(async () => false),
  hasRole: vi.fn(() => false),
};

vi.mock('@/components/auth/AuthContext', () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

// Stubs para las dos páginas que se montan en estos casos. Solo se
// reemplaza el componente de página; la RUTA sigue siendo la registrada
// en App.tsx.
vi.mock('@/pages/ConstructorLiturgiasPage', () => ({
  default: () => (
    <div data-testid="constructor-page">Constructor de Liturgias</div>
  ),
}));
vi.mock('@/pages/AdminDashboard', () => ({
  default: () => <div data-testid="admin-page">Admin Dashboard</div>,
}));

// Import AFTER mocks — el registro real de rutas que App.tsx monta vía
// createBrowserRouter(appRoutes).
import { appRoutes } from '@/appRoutes';
import ProtectedRoute from '../ProtectedRoute';

const CONSTRUCTOR_PATH = '/admin/liturgia/constructor';

const renderRealConstructorRoute = () => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [CONSTRUCTOR_PATH],
  });
  return render(<RouterProvider router={router} />);
};

describe('T-0.8 — /admin/liturgia/constructor (registro real de App.tsx)', () => {
  beforeEach(() => {
    toastMock.mockReset();
    authState.user = { id: '11111111-1111-4111-8111-111111111111' };
    authState.loading = false;
    authState.rolesLoading = false;
    authState.isAdmin = false;
    authState.hasPermission = vi.fn(async () => false);
    authState.hasRole = vi.fn(() => false);
  });

  it('la ruta registrada envuelve el constructor en ProtectedRoute con liturgy_builder:write', () => {
    const route = appRoutes.find((r) => r.path === CONSTRUCTOR_PATH);
    expect(route, `ruta ${CONSTRUCTOR_PATH} debe existir en appRoutes`).toBeDefined();

    const element = route!.element as React.ReactElement;
    // Falla si ProtectedRoute se quita (o se sustituye) en App.tsx.
    expect(element.type).toBe(ProtectedRoute);
    expect(element.props.requires).toEqual({
      resource: 'liturgy_builder',
      action: 'write',
    });
  });

  it('deniega y redirige a /admin cuando el usuario no tiene liturgy_builder:write', async () => {
    authState.hasPermission = vi.fn(async () => false);

    renderRealConstructorRoute();

    await waitFor(() => {
      expect(screen.getByTestId('admin-page')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('constructor-page')).not.toBeInTheDocument();
    expect(authState.hasPermission).toHaveBeenCalledWith('liturgy_builder', 'write');
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Acceso denegado',
        variant: 'destructive',
      }),
    );
  });

  it('renderiza el constructor cuando el usuario tiene liturgy_builder:write', async () => {
    authState.hasPermission = vi.fn(async (resource: string, action: string) => {
      return resource === 'liturgy_builder' && action === 'write';
    });

    renderRealConstructorRoute();

    await waitFor(() => {
      expect(screen.getByTestId('constructor-page')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument();
    expect(authState.hasPermission).toHaveBeenCalledWith('liturgy_builder', 'write');
    expect(toastMock).not.toHaveBeenCalled();
  });
});
