
import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import type { RoleName, PermissionAction, UserPermission } from '@/types/rbac';
import { ROLE_NAMES } from '@/types/rbac';

type UserProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  // RBAC fields
  roles: RoleName[];
  isAdmin: boolean;
  rolesLoading: boolean;
  permissions: UserPermission[];
  permissionsLoading: boolean;
  // Force password change
  mustChangePassword: boolean;
  clearMustChangePassword: () => Promise<void>;
  // Auth methods
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  // RBAC methods
  hasRole: (roleName: RoleName) => boolean;
  hasPermission: (resource: string, action: PermissionAction) => Promise<boolean>;
  refreshRoles: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // RBAC state
  const [roles, setRoles] = useState<RoleName[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  // Derived admin check
  const isAdmin = roles.includes(ROLE_NAMES.GENERAL_ADMIN);

  // Derived force-password-change check
  const mustChangePassword = user?.user_metadata?.must_change_password === true;

  // Clear the must_change_password flag after the user sets a new password
  const clearMustChangePassword = async () => {
    const { error } = await supabase.auth.updateUser({
      data: { must_change_password: false },
    });
    if (error) throw error;
    // Refresh session to get updated user_metadata
    const { data: { session: refreshedSession } } = await supabase.auth.getSession();
    if (refreshedSession) {
      setUser(refreshedSession.user);
      setSession(refreshedSession);
    }
  };

  // Fetch user profile
  async function fetchUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
  }

  // Fetch user roles via RPC
  // Devuelve true sólo si el RBAC se pudo leer; el llamador lo necesita para
  // no cachear como "cargado" un usuario cuya carga falló.
  const fetchUserRoles = useCallback(async (userId: string): Promise<boolean> => {
    try {
      setRolesLoading(true);
      const { data, error } = await supabase.rpc('get_user_roles', {
        p_user_id: userId,
      });

      if (error) {
        console.error('Error fetching user roles:', error);
        setRoles([]);
        return false;
      }

      // data is TEXT[] from the RPC function
      setRoles((data as RoleName[]) || []);
      return true;
    } catch (error) {
      console.error('Error in fetchUserRoles:', error);
      setRoles([]);
      return false;
    } finally {
      setRolesLoading(false);
    }
  }, []);

  // Fetch user permissions via RPC
  const fetchUserPermissions = useCallback(async (userId: string): Promise<boolean> => {
    try {
      setPermissionsLoading(true);
      const { data, error } = await supabase.rpc('get_user_permissions', {
        p_user_id: userId,
      });

      if (error) {
        console.error('Error fetching user permissions:', error);
        setPermissions([]);
        return false;
      }

      // data is TABLE(resource TEXT, action TEXT) from the RPC function
      setPermissions((data as UserPermission[]) || []);
      return true;
    } catch (error) {
      console.error('Error in fetchUserPermissions:', error);
      setPermissions([]);
      return false;
    } finally {
      setPermissionsLoading(false);
    }
  }, []);

  // Id del usuario cuyo RBAC se cargó CON ÉXITO, para no repetir el trabajo.
  const loadedUserIdRef = useRef<string | null>(null);
  // Id del usuario cuya carga está en vuelo, para no lanzarla por duplicado.
  const loadingUserIdRef = useRef<string | null>(null);

  /**
   * Carga perfil, roles y permisos SÓLO si la identidad del usuario cambió.
   *
   * Supabase vuelve a emitir `SIGNED_IN` cada vez que la pestaña recupera la
   * visibilidad: GoTrueClient escucha `visibilitychange` y llama a
   * `_recoverAndRefresh()`, que notifica `SIGNED_IN` con la MISMA sesión
   * (verificado en @supabase/auth-js 2.90.1). Si tratáramos esa
   * re-notificación como un login nuevo, `rolesLoading` volvería a true y
   * ProtectedRoute desmontaría su subárbol, haciendo que el usuario perdiera
   * el constructor de liturgias al volver de otra pestaña o aplicación.
   *
   * La identidad se marca como cargada SÓLO si el RBAC llegó completo. Marcarla
   * antes cachearía un fallo transitorio de red: el usuario se quedaría con
   * roles vacíos y toda notificación posterior se saltaría la recarga,
   * dejándolo bloqueado hasta recargar la página entera (`refreshRoles` no
   * tiene llamadores en producción). Si falla, la próxima notificación
   * — por ejemplo al volver a la pestaña — reintenta.
   */
  const loadUserDataOnce = useCallback(
    async (userId: string) => {
      if (loadedUserIdRef.current === userId) return;
      if (loadingUserIdRef.current === userId) return;
      loadingUserIdRef.current = userId;

      try {
        fetchUserProfile(userId);
        const [rolesOk, permissionsOk] = await Promise.all([
          fetchUserRoles(userId),
          fetchUserPermissions(userId),
        ]);
        loadedUserIdRef.current = rolesOk && permissionsOk ? userId : null;
      } finally {
        if (loadingUserIdRef.current === userId) {
          loadingUserIdRef.current = null;
        }
      }
    },
    [fetchUserRoles, fetchUserPermissions]
  );

  // Add refreshProfile function to fetch the latest profile data
  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  };

  // Refresh roles and permissions on demand
  const refreshRoles = useCallback(async () => {
    if (user) {
      await Promise.all([
        fetchUserRoles(user.id),
        fetchUserPermissions(user.id),
      ]);
    }
  }, [user, fetchUserRoles, fetchUserPermissions]);

  // Check if user has a specific role (local check)
  const hasRole = useCallback(
    (roleName: RoleName): boolean => {
      if (roles.includes(ROLE_NAMES.GENERAL_ADMIN)) return true;
      return roles.includes(roleName);
    },
    [roles]
  );

  // Check if user has a specific permission (cache-first, RPC fallback)
  const hasPermission = useCallback(
    async (resource: string, action: PermissionAction): Promise<boolean> => {
      if (!user) return false;
      // Admin bypasses all permission checks
      if (roles.includes(ROLE_NAMES.GENERAL_ADMIN)) return true;

      // Check cache first if permissions are loaded
      if (!permissionsLoading && permissions.length > 0) {
        return permissions.some(
          (p) => p.resource === resource && p.action === action
        );
      }

      // Fallback to RPC if cache not loaded
      try {
        const { data, error } = await supabase.rpc('has_permission', {
          p_user_id: user.id,
          p_resource: resource,
          p_action: action,
        });

        if (error) {
          console.error('Error checking permission:', error);
          return false;
        }

        return data === true;
      } catch (error) {
        console.error('Error in hasPermission:', error);
        return false;
      }
    },
    [user, roles, permissions, permissionsLoading]
  );

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const userId = session.user.id;
          setTimeout(() => {
            loadUserDataOnce(userId);
          }, 0);
        } else {
          loadedUserIdRef.current = null;
          loadingUserIdRef.current = null;
          setProfile(null);
          setRoles([]);
          setPermissions([]);
          setRolesLoading(false);
          setPermissionsLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadUserDataOnce(session.user.id);
      } else {
        loadedUserIdRef.current = null;
        loadingUserIdRef.current = null;
        setRolesLoading(false);
        setPermissionsLoading(false);
      }
    }).finally(() => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadUserDataOnce]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Login error:', error.message);
      throw new Error(error.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Signup error:', error.message);
      throw new Error(error.message || 'Error al registrar usuario');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      loadedUserIdRef.current = null;
      loadingUserIdRef.current = null;
      setUser(null);
      setProfile(null);
      setSession(null);
      setRoles([]);
      setPermissions([]);
      setRolesLoading(false);
      setPermissionsLoading(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Reset password error:', error.message);
      throw new Error(error.message || 'Error al enviar el correo de recuperación');
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Update password error:', error.message);
      throw new Error(error.message || 'Error al actualizar la contraseña');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      loading,
      roles,
      isAdmin,
      rolesLoading,
      permissions,
      permissionsLoading,
      mustChangePassword,
      clearMustChangePassword,
      login,
      signup,
      logout,
      refreshProfile,
      resetPassword,
      updatePassword,
      hasRole,
      hasPermission,
      refreshRoles,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
