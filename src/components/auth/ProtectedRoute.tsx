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

import React, { useEffect, useRef, useState } from 'react';
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
  // Usuario al que pertenece el veredicto vigente en `authorized`.
  const authorizedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Registra el veredicto junto al usuario para el que se calculó.
    const settle = (value: boolean) => {
      if (cancelled) return;
      authorizedForUserRef.current = user?.id ?? null;
      setAuthorized(value);
    };

    async function checkAuthorization() {
      // Still loading auth or roles
      if (loading || rolesLoading) return;

      // Not logged in
      if (!user) {
        settle(false);
        return;
      }

      // Admin bypasses all checks
      if (isAdmin) {
        settle(true);
        return;
      }

      if (isPermissionCheck(requires)) {
        const allowed = await hasPermission(requires.resource, requires.action);
        settle(allowed);
      } else {
        settle(hasRole(requires.role));
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

  // ¿El veredicto vigente corresponde al usuario actual?
  const verdictMatchesUser =
    authorized !== null && authorizedForUserRef.current === (user?.id ?? null);

  // Spinner mientras no haya un veredicto válido PARA ESTE usuario.
  //
  // Una vez autorizado, una revalidación en segundo plano (p. ej. el refresco
  // de token al recuperar el foco de la pestaña) NO vuelve a mostrar el
  // spinner: sustituir los hijos por él los desmonta y destruye su estado
  // local — así se perdía el constructor de liturgias a medio armar.
  //
  // El veredicto se ata a la identidad del usuario a propósito: si cambia,
  // deja de ser válido y se vuelve a bloquear, de modo que nadie hereda la
  // autorización del usuario anterior mientras se recalcula.
  if (!verdictMatchesUser) {
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
