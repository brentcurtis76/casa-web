/**
 * ProtectedRoute behavior for /admin/liturgia/constructor (T-0.8).
 *
 * The App.tsx wraps ConstructorLiturgiasPage with
 *   ProtectedRoute requires={{ resource: 'liturgy_builder', action: 'write' }}.
 * These tests exercise that same wrapper against a stubbed child so we can
 * verify the gate without booting the real page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockHasPermission = vi.fn();
const mockHasRole = vi.fn();

const authState = {
  user: null as null | { id: string },
  loading: false,
  rolesLoading: false,
  isAdmin: false,
};

vi.mock('@/components/auth/AuthContext', () => ({
  useAuth: () => ({
    ...authState,
    hasPermission: mockHasPermission,
    hasRole: mockHasRole,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import ProtectedRoute from '@/components/auth/ProtectedRoute';

const SYNTHETIC_USER = { id: '11111111-1111-4111-8111-111111111111' };

function renderConstructorGate(initialPath = '/admin/liturgia/constructor') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/admin/liturgia/constructor"
          element={
            <ProtectedRoute requires={{ resource: 'liturgy_builder', action: 'write' }}>
              <div data-testid="constructor-page">Constructor cargado</div>
            </ProtectedRoute>
          }
        />
        <Route path="/admin" element={<div data-testid="admin-fallback">Panel admin</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('/admin/liturgia/constructor gate', () => {
  beforeEach(() => {
    mockHasPermission.mockReset();
    mockHasRole.mockReset();
    authState.user = SYNTHETIC_USER;
    authState.loading = false;
    authState.rolesLoading = false;
    authState.isAdmin = false;
  });

  it('renders the constructor when the user has liturgy_builder:write', async () => {
    mockHasPermission.mockImplementation(async (resource, action) => {
      return resource === 'liturgy_builder' && action === 'write';
    });

    renderConstructorGate();

    await waitFor(() => {
      expect(screen.getByTestId('constructor-page')).toBeInTheDocument();
    });
    expect(mockHasPermission).toHaveBeenCalledWith('liturgy_builder', 'write');
  });

  it('redirects away and does not render the constructor without liturgy_builder:write', async () => {
    mockHasPermission.mockResolvedValue(false);

    renderConstructorGate();

    await waitFor(() => {
      expect(screen.getByTestId('admin-fallback')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('constructor-page')).not.toBeInTheDocument();
  });
});
