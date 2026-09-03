/**
 * /presenter requiere presenter:read — /output sigue siendo pública.
 *
 * Ejercita el registro de rutas REAL (`appRoutes` de src/appRoutes.tsx,
 * montado por App.tsx vía createBrowserRouter) con el ProtectedRoute real:
 * si alguien quita el guard de /presenter, estos tests fallan.
 *
 *   1. Estructural: /presenter es un ProtectedRoute con presenter:read y
 *      /output NO está envuelta (la ventana del proyector es pública a propósito).
 *   2. Anónimo: sin sesión, navegar a /presenter no monta PresenterPage;
 *      redirige a /admin con toast de acceso denegado y sin consultar permisos.
 *   3. Sin permiso: un usuario autenticado sin presenter:read tampoco monta
 *      PresenterPage.
 *   4. Autorizado: con presenter:read, PresenterPage se renderiza.
 *
 * El AuthContext se mockea para controlar hasPermission sin tocar Supabase;
 * las páginas montadas se sustituyen por stubs livianos (las RUTAS son las reales).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

type AuthState = {
  user: { id: string } | null;
  loading: boolean;
  rolesLoading: boolean;
  isAdmin: boolean;
  hasPermission: (resource: string, action: string) => Promise<boolean>;
  hasRole: (role: string) => boolean;
};

const USER_ID = '22222222-2222-4222-8222-222222222222';

const authState: AuthState = {
  user: { id: USER_ID },
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

vi.mock('@/pages/PresenterPage', () => ({
  default: () => <div data-testid="presenter-page">Presentador</div>,
}));
vi.mock('@/pages/AdminDashboard', () => ({
  default: () => <div data-testid="admin-page">Admin Dashboard</div>,
}));

// Import AFTER mocks — el registro real de rutas que App.tsx monta.
import { appRoutes } from '@/appRoutes';
import ProtectedRoute from '../ProtectedRoute';

const PRESENTER_PATH = '/presenter';
const OUTPUT_PATH = '/output';

const renderRealPresenterRoute = () => {
  const router = createMemoryRouter(appRoutes, { initialEntries: [PRESENTER_PATH] });
  return render(<RouterProvider router={router} />);
};

describe('/presenter (registro real de App.tsx) requiere presenter:read', () => {
  beforeEach(() => {
    toastMock.mockReset();
    authState.user = { id: USER_ID };
    authState.loading = false;
    authState.rolesLoading = false;
    authState.isAdmin = false;
    authState.hasPermission = vi.fn(async () => false);
    authState.hasRole = vi.fn(() => false);
  });

  it('la ruta registrada envuelve PresenterPage en ProtectedRoute con presenter:read', () => {
    const route = appRoutes.find((r) => r.path === PRESENTER_PATH);
    expect(route, `ruta ${PRESENTER_PATH} debe existir en appRoutes`).toBeDefined();

    const element = route!.element as React.ReactElement;
    expect(element.type).toBe(ProtectedRoute);
    expect(element.props.requires).toEqual({ resource: 'presenter', action: 'read' });
  });

  it('/output sigue registrada sin ProtectedRoute (ventana del proyector, pública a propósito)', () => {
    const route = appRoutes.find((r) => r.path === OUTPUT_PATH);
    expect(route, `ruta ${OUTPUT_PATH} debe existir en appRoutes`).toBeDefined();
    const element = route!.element as React.ReactElement;
    expect(element.type).not.toBe(ProtectedRoute);
  });

  it('anónimo: no monta PresenterPage, redirige a /admin y no consulta permisos', async () => {
    authState.user = null;

    renderRealPresenterRoute();

    await waitFor(() => {
      expect(screen.getByTestId('admin-page')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('presenter-page')).not.toBeInTheDocument();
    expect(authState.hasPermission).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Acceso denegado', variant: 'destructive' }),
    );
  });

  it('autenticado sin presenter:read: no monta PresenterPage y redirige a /admin', async () => {
    authState.hasPermission = vi.fn(async () => false);

    renderRealPresenterRoute();

    await waitFor(() => {
      expect(screen.getByTestId('admin-page')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('presenter-page')).not.toBeInTheDocument();
    expect(authState.hasPermission).toHaveBeenCalledWith('presenter', 'read');
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Acceso denegado', variant: 'destructive' }),
    );
  });

  it('con presenter:read renderiza PresenterPage', async () => {
    authState.hasPermission = vi.fn(
      async (resource: string, action: string) => resource === 'presenter' && action === 'read',
    );

    renderRealPresenterRoute();

    await waitFor(() => {
      expect(screen.getByTestId('presenter-page')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument();
    expect(authState.hasPermission).toHaveBeenCalledWith('presenter', 'read');
    expect(toastMock).not.toHaveBeenCalled();
  });
});
