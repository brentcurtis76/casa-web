/**
 * RBAC (Role-Based Access Control) Types and Constants
 * Defines the type system for the multi-role access control system.
 */

// ─── Role Names ───────────────────────────────────────────────────────────────

export const ROLE_NAMES = {
  GENERAL_ADMIN: 'general_admin',
  LITURGIST: 'liturgist',
  AV_VOLUNTEER: 'av_volunteer',
  WORSHIP_COORDINATOR: 'worship_coordinator',
  COMMS_VOLUNTEER: 'comms_volunteer',
  MESA_ABIERTA_COORDINATOR: 'mesa_abierta_coordinator',
  FINANCIAL_ADMIN: 'financial_admin',
  CONCILIO_MEMBER: 'concilio_member',
  EQUIPO_PASTORAL: 'equipo_pastoral',
  CHILDREN_MINISTRY_COORDINATOR: 'children_ministry_coordinator',
  CHILDREN_MINISTRY_VOLUNTEER: 'children_ministry_volunteer',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

// ─── Permission Actions ───────────────────────────────────────────────────────

export type PermissionAction = 'read' | 'write' | 'manage';

// ─── Resource Names (DB convention: underscores) ──────────────────────────────

export const RESOURCE_NAMES = {
  PRESENTER: 'presenter',
  EVENTOS: 'eventos',
  MESA_ABIERTA: 'mesa_abierta',
  GRAPHICS: 'graphics',
  SERMON_EDITOR: 'sermon_editor',
  LITURGY_BUILDER: 'liturgy_builder',
  LITURGY_SEASONS: 'liturgy_seasons',
  ORACIONES: 'oraciones',
  CANCIONES: 'canciones',
  MUSIC_SCHEDULING: 'music_scheduling',
  ELEMENTOS_FIJOS: 'elementos_fijos',
  FINANCIAL: 'financial',
  LEADERSHIP: 'leadership',
  CHILDREN_MINISTRY: 'children_ministry',
} as const;

export type ResourceName = (typeof RESOURCE_NAMES)[keyof typeof RESOURCE_NAMES];

// ─── Module ID to Resource Mapping ────────────────────────────────────────────
// Maps frontend module IDs (from AdminDashboard) to DB resource names.
// Frontend uses hyphens; DB uses underscores.

export const MODULE_RESOURCE_MAP: Record<string, ResourceName> = {
  'presenter': RESOURCE_NAMES.PRESENTER,
  'eventos': RESOURCE_NAMES.EVENTOS,
  'mesa-abierta': RESOURCE_NAMES.MESA_ABIERTA,
  'graphics': RESOURCE_NAMES.GRAPHICS,
  'sermon-editor': RESOURCE_NAMES.SERMON_EDITOR,
  'constructor': RESOURCE_NAMES.LITURGY_BUILDER,
  'temporadas': RESOURCE_NAMES.LITURGY_SEASONS,
  'oraciones': RESOURCE_NAMES.ORACIONES,
  'canciones': RESOURCE_NAMES.CANCIONES,
  'musica-programacion': RESOURCE_NAMES.MUSIC_SCHEDULING,
  'elementos-fijos': RESOURCE_NAMES.ELEMENTOS_FIJOS,
  'finanzas': RESOURCE_NAMES.FINANCIAL,
};

// ─── Role Display Info ────────────────────────────────────────────────────────
// Spanish display names and descriptions for the UI.

export const ROLE_DISPLAY_INFO: Record<RoleName, { displayName: string; description: string }> = {
  general_admin: {
    displayName: 'Administrador General',
    description: 'Acceso completo a todos los módulos y funciones',
  },
  liturgist: {
    displayName: 'Liturgista',
    description: 'Constructor de liturgias, oraciones, canciones y elementos fijos',
  },
  av_volunteer: {
    displayName: 'Voluntario AV',
    description: 'Presentador, generador de gráficos y editor de reflexiones',
  },
  worship_coordinator: {
    displayName: 'Coordinador de Alabanza',
    description: 'Canciones, programación musical, presentador y constructor de liturgias (lectura)',
  },
  comms_volunteer: {
    displayName: 'Voluntario de Comunicaciones',
    description: 'Generador de gráficos',
  },
  mesa_abierta_coordinator: {
    displayName: 'Coordinador Mesa Abierta',
    description: 'Gestión completa del módulo Mesa Abierta',
  },
  financial_admin: {
    displayName: 'Administrador Financiero',
    description: 'Gestión completa del módulo financiero',
  },
  concilio_member: {
    displayName: 'Miembro del Concilio',
    description: 'Reportes financieros y liderazgo (solo lectura)',
  },
  equipo_pastoral: {
    displayName: 'Equipo Pastoral',
    description: 'Finanzas, liderazgo, liturgias y elementos litúrgicos',
  },
  children_ministry_coordinator: {
    displayName: 'Coordinador Ministerio Infantil',
    description: 'Gestión completa del ministerio infantil',
  },
  children_ministry_volunteer: {
    displayName: 'Voluntario Ministerio Infantil',
    description: 'Ministerio infantil (solo lectura)',
  },
};

// ─── Resource Display Names (Spanish) ────────────────────────────────────────

export const RESOURCE_DISPLAY_NAMES: Record<ResourceName, string> = {
  presenter: 'Presentador',
  eventos: 'Eventos',
  mesa_abierta: 'Mesa Abierta',
  graphics: 'Gráficos',
  sermon_editor: 'Editor de Reflexiones',
  liturgy_builder: 'Constructor de Liturgias',
  liturgy_seasons: 'Temporadas Litúrgicas',
  oraciones: 'Oraciones',
  canciones: 'Canciones',
  music_scheduling: 'Programación Musical',
  elementos_fijos: 'Elementos Fijos',
  financial: 'Finanzas',
  leadership: 'Liderazgo',
  children_ministry: 'Ministerio Infantil',
};

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface ChurchRole {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

export interface ChurchUserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  assigned_at: string;
}

export interface ChurchPermission {
  id: string;
  role_id: string;
  resource: ResourceName;
  action: PermissionAction;
}

// ─── Composite Types (for UI) ─────────────────────────────────────────────────

export interface UserWithEmail {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  phone: string | null;
}

export interface UserRoleAssignment {
  id: string;
  role_id: string;
  role_name: RoleName;
  role_display_name: string;
  assigned_by: string | null;
  assigned_by_name: string | null;
  assigned_at: string;
}

export interface PermissionCheck {
  resource: string;
  action: PermissionAction;
}

export interface RoleCheck {
  role: RoleName;
}

export type ProtectedRouteRequirement = PermissionCheck | RoleCheck;

// Type guard to distinguish PermissionCheck from RoleCheck
export function isPermissionCheck(
  req: ProtectedRouteRequirement
): req is PermissionCheck {
  return 'resource' in req && 'action' in req;
}

// ─── User Permission (for AuthContext caching) ────────────────────────────────

export interface UserPermission {
  resource: string;
  action: PermissionAction;
}
