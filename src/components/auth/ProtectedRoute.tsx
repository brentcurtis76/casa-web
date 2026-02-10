/**
 * ProtectedRoute — Authorization wrapper component.
 *
 * Wraps route elements that require specific roles or permissions.
 * Redirects unauthorized users to /admin with an "Acceso denegado" toast.
 *
 * Usage:
 *   // Require a specific role
 *   <ProtectedRoute requires={{ role: 'general_admin' }}>
 *     <UserManagementPage />
 *   </ProtectedRoute>
 *
 *   // Require a specific permission
 *   <ProtectedRoute requires={{ resource: 'mesa_abierta', action: 'write' }}>
 *     <MesaAbiertaAdminPage />
 *   </ProtectedRoute>
 */

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { ProtectedRouteRequirement } from '@/types/rbac';
import { isPermissionCheck } from '@/types/rbac';

interface ProtectedRouteProps {
  requires: ProtectedRouteRequirement;
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requires, children }) => {
  const { user, loading, rolesLoading, hasRole, hasPermission, isAdmin } = useAuth();
  const { toast } = useToast();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAuthorization() {
      // Still loading auth or roles
      if (loading || rolesLoading) return;

      // Not logged in
      if (!user) {
        if (!cancelled) setAuthorized(false);
        return;
      }

      // Admin bypasses all checks
      if (isAdmin) {
        if (!cancelled) setAuthorized(true);
        return;
      }

      if (isPermissionCheck(requires)) {
        const allowed = await hasPermission(requires.resource, requires.action);
        if (!cancelled) setAuthorized(allowed);
      } else {
        const allowed = hasRole(requires.role);
        if (!cancelled) setAuthorized(allowed);
      }
    }

    checkAuthorization();

    return () => {
      cancelled = true;
    };
  }, [user, loading, rolesLoading, requires, hasRole, hasPermission, isAdmin]);

  // Show toast when authorization fails
  useEffect(() => {
    if (authorized === false) {
      toast({
        title: 'Acceso denegado',
        description: 'No tienes permisos para acceder a esta página.',
        variant: 'destructive',
      });
    }
  }, [authorized, toast]);

  // Show loading spinner while auth state is resolving
  if (loading || rolesLoading || authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Unauthorized — redirect
  if (!authorized) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
