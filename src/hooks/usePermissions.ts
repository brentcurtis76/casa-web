/**
 * usePermissions — Hook that returns permission booleans for a given resource.
 *
 * Usage:
 *   const { canRead, canWrite, canManage, loading } = usePermissions('mesa_abierta');
 *
 * - Admins (general_admin) get all permissions immediately (no RPC call).
 * - Non-admins call `has_permission` RPC for each action level.
 * - Results are cached in local state per resource.
 * - Outside an AuthProvider (isolated component renders in tests) there is no
 *   user to evaluate: every permission is false, `loading` is false and
 *   `hasAuthContext` is false, instead of throwing from inside the consumer.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';

interface PermissionState {
  canRead: boolean;
  canWrite: boolean;
  canManage: boolean;
  loading: boolean;
  /** False when no AuthProvider is mounted above the caller. */
  hasAuthContext: boolean;
}

type AuthValue = ReturnType<typeof useAuth>;

/**
 * `useAuth()` throws when no AuthProvider is mounted. The hook call itself is
 * unconditional (always exactly one `useContext`), so catching that throw keeps
 * the hook order stable while letting consumers degrade instead of crashing.
 */
function useAuthIfProvided(): AuthValue | null {
  try {
    return useAuth();
  } catch {
    return null;
  }
}

export function usePermissions(resource: string): PermissionState {
  const auth = useAuthIfProvided();
  const hasAuthContext = auth !== null;
  const user = auth?.user ?? null;
  const isAdmin = auth?.isAdmin ?? false;
  const rolesLoading = auth?.rolesLoading ?? false;
  const hasPermission = auth?.hasPermission;
  const [permissions, setPermissions] = useState<PermissionState>({
    canRead: false,
    canWrite: false,
    canManage: false,
    loading: hasAuthContext,
    hasAuthContext,
  });

  useEffect(() => {
    let cancelled = false;

    async function checkPermissions() {
      // Wait for roles to load
      if (rolesLoading) return;

      // No user (or no AuthProvider) — no permissions
      if (!user || !hasPermission) {
        if (!cancelled) {
          setPermissions({ canRead: false, canWrite: false, canManage: false, loading: false, hasAuthContext });
        }
        return;
      }

      // Admin bypasses all checks
      if (isAdmin) {
        if (!cancelled) {
          setPermissions({ canRead: true, canWrite: true, canManage: true, loading: false, hasAuthContext });
        }
        return;
      }

      // Check each permission level via RPC
      const [canRead, canWrite, canManage] = await Promise.all([
        hasPermission(resource, 'read'),
        hasPermission(resource, 'write'),
        hasPermission(resource, 'manage'),
      ]);

      if (!cancelled) {
        setPermissions({ canRead, canWrite, canManage, loading: false, hasAuthContext });
      }
    }

    setPermissions(prev => ({ ...prev, loading: hasAuthContext, hasAuthContext }));
    checkPermissions();

    return () => {
      cancelled = true;
    };
  }, [user, isAdmin, rolesLoading, resource, hasPermission, hasAuthContext]);

  return permissions;
}
