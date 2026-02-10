/**
 * usePermissions — Hook that returns permission booleans for a given resource.
 *
 * Usage:
 *   const { canRead, canWrite, canManage, loading } = usePermissions('mesa_abierta');
 *
 * - Admins (general_admin) get all permissions immediately (no RPC call).
 * - Non-admins call `has_permission` RPC for each action level.
 * - Results are cached in local state per resource.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';

interface PermissionState {
  canRead: boolean;
  canWrite: boolean;
  canManage: boolean;
  loading: boolean;
}

export function usePermissions(resource: string): PermissionState {
  const { user, isAdmin, rolesLoading, hasPermission } = useAuth();
  const [permissions, setPermissions] = useState<PermissionState>({
    canRead: false,
    canWrite: false,
    canManage: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function checkPermissions() {
      // Wait for roles to load
      if (rolesLoading) return;

      // No user — no permissions
      if (!user) {
        if (!cancelled) {
          setPermissions({ canRead: false, canWrite: false, canManage: false, loading: false });
        }
        return;
      }

      // Admin bypasses all checks
      if (isAdmin) {
        if (!cancelled) {
          setPermissions({ canRead: true, canWrite: true, canManage: true, loading: false });
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
        setPermissions({ canRead, canWrite, canManage, loading: false });
      }
    }

    setPermissions(prev => ({ ...prev, loading: true }));
    checkPermissions();

    return () => {
      cancelled = true;
    };
  }, [user, isAdmin, rolesLoading, resource, hasPermission]);

  return permissions;
}
