/**
 * T-0.8 — /admin/liturgia/constructor requiere liturgy_builder:write
 *
 * Verifica que ProtectedRoute con requires={{ resource: 'liturgy_builder',
 * action: 'write' }} niegue el acceso a un usuario sin permisos y renderice
 * el hijo cuando el permiso está concedido. El AuthContext se mockea para
 * controlar hasPermission/isAdmin sin tocar Supabase.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks
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
}));

const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

// Import AFTER mocks
import ProtectedRoute from '../ProtectedRoute';

const ConstructorStub: React.FC = () => (
  <div data-testid="constructor-page">Constructor de Liturgias</div>
);

const AdminStub: React.FC = () => (
  <div data-testid="admin-page">Admin Dashboard</div>
);

const renderConstructorRoute = () =>
  render(
    <MemoryRouter initialEntries={['/admin/liturgia/constructor']}>
      <Routes>
        <Route path="/admin" element={<AdminStub />} />
        <Route
          path="/admin/liturgia/constructor"
          element={
            <ProtectedRoute requires={{ resource: 'liturgy_builder', action: 'write' }}>
              <ConstructorStub />
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe('T-0.8 — /admin/liturgia/constructor ProtectedRoute', () => {
  beforeEach(() => {
    toastMock.mockReset();
    authState.user = { id: '11111111-1111-4111-8111-111111111111' };
    authState.loading = false;
    authState.rolesLoading = false;
    authState.isAdmin = false;
    authState.hasPermission = vi.fn(async () => false);
    authState.hasRole = vi.fn(() => false);
  });

  it('deniega y redirige a /admin cuando el usuario no tiene liturgy_builder:write', async () => {
    authState.hasPermission = vi.fn(async (resource: string, action: string) => {
      // Sin permisos para liturgy_builder:write
      if (resource === 'liturgy_builder' && action === 'write') return false;
      return false;
    });

    renderConstructorRoute();

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

    renderConstructorRoute();

    await waitFor(() => {
      expect(screen.getByTestId('constructor-page')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument();
    expect(authState.hasPermission).toHaveBeenCalledWith('liturgy_builder', 'write');
    expect(toastMock).not.toHaveBeenCalled();
  });
});
