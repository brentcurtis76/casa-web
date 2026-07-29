
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

/** Perfil junto al usuario al que pertenece. */
type ProfileSnapshot = { userId: string; profile: UserProfile };

/** RBAC junto al usuario al que pertenece: se comprometen de forma atómica. */
type RbacSnapshot = {
  userId: string;
  roles: RoleName[];
  permissions: UserPermission[];
};

// Referencias estables para no re-renderizar consumidores sin necesidad.
const EMPTY_ROLES: RoleName[] = [];
const EMPTY_PERMISSIONS: UserPermission[] = [];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Perfil y RBAC se guardan JUNTO al usuario dueño de esos datos.
  //
  // Guardarlos sueltos en estado global permitía que una respuesta rezagada de
  // la identidad anterior los sobrescribiera después de cambiar de usuario:
  // ProtectedRoute los evaluaba con el `user` nuevo y registraba el resultado
  // como veredicto suyo, de modo que un usuario podía heredar por un momento
  // la autorización de cliente del anterior. Atarlos a su dueño hace que ese
  // dato simplemente no aplique a nadie más.
  const [profileState, setProfileState] = useState<ProfileSnapshot | null>(null);
  const [rbac, setRbac] = useState<RbacSnapshot | null>(null);
  const [rbacLoading, setRbacLoading] = useState(true);

  const currentUserId = user?.id ?? null;

  // Sólo se exponen los datos que pertenecen al usuario actual.
  const rbacIsCurrent = rbac !== null && rbac.userId === currentUserId;
  const roles = rbacIsCurrent ? rbac.roles : EMPTY_ROLES;
  const permissions = rbacIsCurrent ? rbac.permissions : EMPTY_PERMISSIONS;
  const profile =
    profileState !== null && profileState.userId === currentUserId
      ? profileState.profile
      : null;

  // Con sesión iniciada pero sin RBAC propio todavía, se informa "cargando":
  // nadie debe decidir autorización con datos de otra identidad ni con los
  // vacíos de partida.
  const rbacPending = currentUserId !== null && (rbacLoading || !rbacIsCurrent);
  const rolesLoading = rbacPending;
  const permissionsLoading = rbacPending;

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

  /**
   * Generación de identidad. Se incrementa cada vez que cambia el usuario
   * (login, cambio de cuenta, cierre de sesión). Toda petición en vuelo captura
   * el id de petición con el que salió y sólo la MÁS RECIENTE puede escribir
   * datos, marcadores o banderas de carga. Limpiar los marcadores no bastaba,
   * porque no cancela lo que ya está en la red.
   *
   * Los ids son por dato y monótonos, no una generación compartida: una
   * generación sólo distingue identidades, así que dos peticiones del MISMO
   * usuario (por ejemplo una recarga forzada sobre otra en vuelo) seguían
   * empatadas y la vieja podía terminar la última y pisar a la nueva.
   */
  const rbacRequestIdRef = useRef(0);
  const profileRequestIdRef = useRef(0);

  /** Identidad vigente. Es la referencia contra la que se mide "obsoleto". */
  const lastIdentityRef = useRef<string | null>(null);

  // Marcadores por dato: "cargado con éxito" e "en vuelo" se siguen aparte para
  // que el fallo de uno no cachee al otro como resuelto.
  const loadedRbacUserIdRef = useRef<string | null>(null);
  const loadingRbacUserIdRef = useRef<string | null>(null);
  const loadedProfileUserIdRef = useRef<string | null>(null);
  const loadingProfileUserIdRef = useRef<string | null>(null);

  /** Invalida lo que esté en vuelo cuando cambia la identidad. */
  const syncIdentity = useCallback((userId: string | null) => {
    if (lastIdentityRef.current === userId) return;
    lastIdentityRef.current = userId;
    // Lo que esté en vuelo deja de ser la petición vigente de su dato.
    rbacRequestIdRef.current += 1;
    profileRequestIdRef.current += 1;
    loadedRbacUserIdRef.current = null;
    loadingRbacUserIdRef.current = null;
    loadedProfileUserIdRef.current = null;
    loadingProfileUserIdRef.current = null;
    setRbacLoading(userId !== null);
  }, []);

  // Fetch user profile
  const loadProfileOnce = useCallback(async (userId: string) => {
    // La carga se programa con setTimeout, así que entre programarla y
    // ejecutarla la identidad puede haber cambiado: no se arranca siquiera.
    if (lastIdentityRef.current !== userId) return;
    if (loadedProfileUserIdRef.current === userId) return;
    if (loadingProfileUserIdRef.current === userId) return;

    loadingProfileUserIdRef.current = userId;
    const requestId = ++profileRequestIdRef.current;

    // Vigente = sigue siendo la última petición de perfil Y la identidad no
    // ha cambiado. Sólo entonces puede tocar estado o marcadores.
    const isCurrent = () =>
      requestId === profileRequestIdRef.current && lastIdentityRef.current === userId;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', userId)
        .single();

      if (!isCurrent()) return;

      if (error) {
        console.error('Error fetching user profile:', error);
        loadedProfileUserIdRef.current = null;
        return;
      }

      setProfileState({ userId, profile: data });
      loadedProfileUserIdRef.current = userId;
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      if (isCurrent()) {
        loadedProfileUserIdRef.current = null;
      }
    } finally {
      // Sólo la petición vigente libera el marcador: si no, una rezagada
      // borraría el de la que sí está en curso.
      if (isCurrent()) {
        loadingProfileUserIdRef.current = null;
      }
    }
  }, []);

  /**
   * Carga roles y permisos y los compromete en un solo estado junto a su dueño.
   *
   * Si falla se compromete un RBAC vacío para ese usuario: la autorización se
   * resuelve como denegada (fallar cerrado) en vez de quedarse colgada, pero NO
   * se marca como cargado, así que la próxima notificación reintenta.
   */
  const loadRbacOnce = useCallback(async (userId: string) => {
    // Igual que el perfil: la identidad pudo cambiar entre programar esta
    // carga y ejecutarla, y entonces no debe arrancar.
    if (lastIdentityRef.current !== userId) return;
    if (loadedRbacUserIdRef.current === userId) return;
    if (loadingRbacUserIdRef.current === userId) return;

    loadingRbacUserIdRef.current = userId;
    const requestId = ++rbacRequestIdRef.current;
    setRbacLoading(true);

    const isCurrent = () =>
      requestId === rbacRequestIdRef.current && lastIdentityRef.current === userId;

    try {
      const [rolesRes, permissionsRes] = await Promise.all([
        supabase.rpc('get_user_roles', { p_user_id: userId }),
        supabase.rpc('get_user_permissions', { p_user_id: userId }),
      ]);

      if (!isCurrent()) return;

      if (rolesRes.error || permissionsRes.error) {
        console.error(
          'Error fetching RBAC:',
          rolesRes.error ?? permissionsRes.error
        );
        setRbac({ userId, roles: [], permissions: [] });
        loadedRbacUserIdRef.current = null;
        return;
      }

      // data: TEXT[] y TABLE(resource TEXT, action TEXT) de las RPC.
      setRbac({
        userId,
        roles: (rolesRes.data as RoleName[]) || [],
        permissions: (permissionsRes.data as UserPermission[]) || [],
      });
      loadedRbacUserIdRef.current = userId;
    } catch (error) {
      console.error('Error in loadRbac:', error);
      if (isCurrent()) {
        setRbac({ userId, roles: [], permissions: [] });
        loadedRbacUserIdRef.current = null;
      }
    } finally {
      if (isCurrent()) {
        loadingRbacUserIdRef.current = null;
        setRbacLoading(false);
      }
    }
  }, []);

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
   * Cada dato se marca como cargado SÓLO si su petición tuvo éxito, y perfil y
   * RBAC se siguen por separado. Marcarlos antes cachearía un fallo transitorio
   * de red: el usuario se quedaría sin ese dato y toda notificación posterior
   * se saltaría la recarga, dejándolo así hasta recargar la página entera
   * (`refreshRoles` no tiene llamadores en producción). Si algo falla, la
   * próxima notificación — por ejemplo al volver a la pestaña — lo reintenta,
   * y sólo eso.
   */
  const loadUserDataOnce = useCallback(
    (userId: string) => {
      void loadProfileOnce(userId);
      void loadRbacOnce(userId);
    },
    [loadProfileOnce, loadRbacOnce]
  );

  // Add refreshProfile function to fetch the latest profile data
  const refreshProfile = async () => {
    if (!user) return;
    // Recarga forzada: se limpian los marcadores para saltarse el "once".
    loadedProfileUserIdRef.current = null;
    loadingProfileUserIdRef.current = null;
    await loadProfileOnce(user.id);
  };

  // Refresh roles and permissions on demand
  const refreshRoles = useCallback(async () => {
    if (!user) return;
    // Recarga forzada: se limpian los marcadores para saltarse el "once".
    loadedRbacUserIdRef.current = null;
    loadingRbacUserIdRef.current = null;
    await loadRbacOnce(user.id);
  }, [user, loadRbacOnce]);

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
        const nextUser = session?.user ?? null;
        setSession(session);
        setUser(nextUser);
        // Antes de lanzar nada: invalida lo que quede en vuelo de la identidad
        // anterior. Es un no-op cuando el usuario no cambió, que es el caso de
        // la re-notificación al volver a la pestaña.
        syncIdentity(nextUser?.id ?? null);

        if (nextUser) {
          const userId = nextUser.id;
          setTimeout(() => {
            loadUserDataOnce(userId);
          }, 0);
        } else {
          setProfileState(null);
          setRbac(null);
          setRbacLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const nextUser = session?.user ?? null;
      setSession(session);
      setUser(nextUser);
      syncIdentity(nextUser?.id ?? null);

      if (nextUser) {
        loadUserDataOnce(nextUser.id);
      } else {
        setProfileState(null);
        setRbac(null);
        setRbacLoading(false);
      }
    }).finally(() => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadUserDataOnce, syncIdentity]);

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
      // Invalida lo que siga en vuelo: al cerrar sesión, una respuesta
      // rezagada no puede repoblar el RBAC de quien acaba de salir.
      syncIdentity(null);
      setUser(null);
      setProfileState(null);
      setSession(null);
      setRbac(null);
      setRbacLoading(false);
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
