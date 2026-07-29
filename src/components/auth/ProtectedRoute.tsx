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

/** Resultado de autorización atado al usuario para el que se calculó. */
type Verdict = { userId: string | null; allowed: boolean };

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requires, children }) => {
  const { user, loading, rolesLoading, hasRole, hasPermission, isAdmin } = useAuth();
  const { toast } = useToast();
  // El veredicto y el usuario para el que se calculó viven JUNTOS en el estado.
  //
  // Tenerlos separados (booleano en estado + dueño en una ref) es incorrecto:
  // al cambiar de usuario con el mismo resultado booleano, `setAuthorized`
  // sería un no-op por Object.is y React podría no volver a renderizar, con la
  // ref ya apuntando al usuario nuevo pero la UI comprometida mostrando el
  // spinner. Además, leer una ref durante el render hace que la salida no sea
  // función pura del estado. Con un objeto nuevo por veredicto, cada cambio de
  // identidad produce siempre un valor de estado distinto.
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const currentUserId = user?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    // Registra el veredicto junto al usuario para el que se calculó.
    const settle = (allowed: boolean) => {
      if (cancelled) return;
      setVerdict({ userId: user?.id ?? null, allowed });
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

  // Show toast when authorization fails.
  // Se avisa una vez por identidad: el veredicto es un objeto nuevo en cada
  // revalidación, así que sin deduplicar se repetiría el toast.
  const toastedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!verdict) return;

    if (verdict.allowed) {
      // Si más adelante se le revoca el permiso, vuelve a avisarse.
      toastedKeyRef.current = null;
      return;
    }

    const key = verdict.userId ?? '__anon__';
    if (toastedKeyRef.current === key) return;
    toastedKeyRef.current = key;

    toast({
      title: 'Acceso denegado',
      description: 'No tienes permisos para acceder a esta página.',
      variant: 'destructive',
    });
  }, [verdict, toast]);

  // ¿El veredicto vigente corresponde al usuario actual?
  const verdictMatchesUser = verdict !== null && verdict.userId === currentUserId;

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
  if (!verdict.allowed) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
