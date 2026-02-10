/**
 * RoleAssignmentModal — Modal for assigning/removing roles from a user.
 *
 * Features:
 * - Checkbox for each of the 11 roles
 * - Current roles pre-checked
 * - Self-protection: disables general_admin for current user
 * - Confirmation dialog when removing a role
 * - Shows assigned_by name and assigned_at date per role
 * - On save: INSERTs new roles, DELETEs removed roles
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Calendar, User, Check, Minus } from 'lucide-react';
import type {
  ChurchRole,
  ChurchPermission,
  RoleName,
  UserWithEmail,
  ResourceName,
  PermissionAction,
} from '@/types/rbac';
import { ROLE_DISPLAY_INFO, ROLE_NAMES, RESOURCE_DISPLAY_NAMES } from '@/types/rbac';

interface RoleAssignmentInfo {
  roleId: string;
  roleName: RoleName;
  assignedBy: string | null;
  assignedByName: string | null;
  assignedAt: string | null;
}

interface RoleAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: UserWithEmail;
  onRolesUpdated: () => void;
}

const RoleAssignmentModal: React.FC<RoleAssignmentModalProps> = ({
  open,
  onOpenChange,
  targetUser,
  onRolesUpdated,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [allRoles, setAllRoles] = useState<ChurchRole[]>([]);
  const [currentAssignments, setCurrentAssignments] = useState<RoleAssignmentInfo[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Confirmation dialog state
  const [roleToRemove, setRoleToRemove] = useState<ChurchRole | null>(null);
  // Permissions for all roles (for effective permissions display)
  const [allPermissions, setAllPermissions] = useState<ChurchPermission[]>([]);

  const isSelf = user?.id === targetUser.id;

  // Fetch all roles and user's current assignments
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all available roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('church_roles')
        .select('id, name, display_name, description, created_at')
        .order('display_name');

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los roles.',
          variant: 'destructive',
        });
        return;
      }

      setAllRoles((rolesData as ChurchRole[]) || []);

      // Fetch all permissions for all roles (for effective permissions display)
      const { data: permissionsData } = await supabase
        .from('church_permissions')
        .select('id, role_id, resource, action');

      setAllPermissions((permissionsData as ChurchPermission[]) || []);

      // Fetch user's current role assignments with assigned_by profile info
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('church_user_roles')
        .select('id, role_id, assigned_by, assigned_at')
        .eq('user_id', targetUser.id);

      if (assignmentsError) {
        console.error('Error fetching assignments:', assignmentsError);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las asignaciones de roles.',
          variant: 'destructive',
        });
        return;
      }

      // Build assignment info with role name and assigner name
      const assignments: RoleAssignmentInfo[] = [];
      const selectedIds = new Set<string>();

      for (const assignment of assignmentsData || []) {
        const role = (rolesData as ChurchRole[])?.find(r => r.id === assignment.role_id);
        if (!role) continue;

        let assignedByName: string | null = null;
        if (assignment.assigned_by) {
          const { data: assignerProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', assignment.assigned_by)
            .single();
          assignedByName = assignerProfile?.full_name || null;
        }

        assignments.push({
          roleId: role.id,
          roleName: role.name as RoleName,
          assignedBy: assignment.assigned_by,
          assignedByName,
          assignedAt: assignment.assigned_at,
        });

        selectedIds.add(role.id);
      }

      setCurrentAssignments(assignments);
      setSelectedRoleIds(selectedIds);
    } catch (error) {
      console.error('Error loading role data:', error);
    } finally {
      setLoading(false);
    }
  }, [targetUser.id, toast]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  // Toggle a role checkbox
  const handleToggleRole = (role: ChurchRole, checked: boolean) => {
    if (!checked) {
      // Removing a role — show confirmation
      setRoleToRemove(role);
      return;
    }

    // Adding a role
    setSelectedRoleIds(prev => {
      const next = new Set(prev);
      next.add(role.id);
      return next;
    });
  };

  // Confirm role removal
  const confirmRemoveRole = () => {
    if (!roleToRemove) return;

    setSelectedRoleIds(prev => {
      const next = new Set(prev);
      next.delete(roleToRemove.id);
      return next;
    });
    setRoleToRemove(null);
  };

  // Cancel role removal
  const cancelRemoveRole = () => {
    setRoleToRemove(null);
  };

  // Save changes
  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const originalIds = new Set(currentAssignments.map(a => a.roleId));

      // Roles to add (in selectedRoleIds but not in originalIds)
      const toAdd: string[] = [];
      selectedRoleIds.forEach(id => {
        if (!originalIds.has(id)) toAdd.push(id);
      });

      // Roles to remove (in originalIds but not in selectedRoleIds)
      const toRemove: string[] = [];
      originalIds.forEach(id => {
        if (!selectedRoleIds.has(id)) toRemove.push(id);
      });

      // Delete removed roles
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('church_user_roles')
          .delete()
          .eq('user_id', targetUser.id)
          .in('role_id', toRemove);

        if (deleteError) {
          console.error('Error removing roles:', deleteError);
          toast({
            title: 'Error',
            description: 'No se pudieron eliminar algunos roles.',
            variant: 'destructive',
          });
          return;
        }

        // Audit log for removed roles (fire-and-forget)
        for (const roleId of toRemove) {
          const role = allRoles.find(r => r.id === roleId);
          if (role) {
            try {
              await supabase.from('church_audit_log').insert({
                user_id: user.id,
                action_type: 'role_removed',
                target_user_id: targetUser.id,
                details: {
                  role_name: role.name,
                  role_id: roleId,
                },
              });
            } catch {
              // Audit log failure is non-blocking
            }
          }
        }
      }

      // Insert new roles
      if (toAdd.length > 0) {
        const inserts = toAdd.map(roleId => ({
          user_id: targetUser.id,
          role_id: roleId,
          assigned_by: user.id,
        }));

        const { error: insertError } = await supabase
          .from('church_user_roles')
          .insert(inserts);

        if (insertError) {
          console.error('Error adding roles:', insertError);
          toast({
            title: 'Error',
            description: 'No se pudieron agregar algunos roles.',
            variant: 'destructive',
          });
          return;
        }

        // Audit log for added roles (fire-and-forget)
        for (const roleId of toAdd) {
          const role = allRoles.find(r => r.id === roleId);
          if (role) {
            try {
              await supabase.from('church_audit_log').insert({
                user_id: user.id,
                action_type: 'role_assigned',
                target_user_id: targetUser.id,
                details: {
                  role_name: role.name,
                  role_id: roleId,
                },
              });
            } catch {
              // Audit log failure is non-blocking
            }
          }
        }
      }

      const changeCount = toAdd.length + toRemove.length;
      if (changeCount > 0) {
        toast({
          title: 'Roles actualizados',
          description: `Se actualizaron los roles de ${targetUser.full_name || targetUser.email}.`,
        });
        onRolesUpdated();
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving roles:', error);
      toast({
        title: 'Error',
        description: 'Error al guardar los cambios.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Check if there are unsaved changes
  const hasChanges = (): boolean => {
    const originalIds = new Set(currentAssignments.map(a => a.roleId));
    if (originalIds.size !== selectedRoleIds.size) return true;
    for (const id of selectedRoleIds) {
      if (!originalIds.has(id)) return true;
    }
    return false;
  };

  // Find assignment info for a role
  const getAssignmentInfo = (roleId: string): RoleAssignmentInfo | undefined => {
    return currentAssignments.find(a => a.roleId === roleId);
  };

  // Check if a role checkbox should be disabled
  const isRoleDisabled = (role: ChurchRole): boolean => {
    // Self-protection: cannot remove own general_admin
    if (isSelf && role.name === ROLE_NAMES.GENERAL_ADMIN) return true;
    return false;
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Compute effective permissions for selected roles
  const computeEffectivePermissions = (): Map<ResourceName, Set<PermissionAction>> => {
    const effectivePerms = new Map<ResourceName, Set<PermissionAction>>();

    // Check if general_admin is selected
    const hasGeneralAdmin = Array.from(selectedRoleIds).some(roleId => {
      const role = allRoles.find(r => r.id === roleId);
      return role?.name === ROLE_NAMES.GENERAL_ADMIN;
    });

    if (hasGeneralAdmin) {
      // General admin has all permissions
      Object.keys(RESOURCE_DISPLAY_NAMES).forEach(resource => {
        effectivePerms.set(resource as ResourceName, new Set(['read', 'write', 'manage']));
      });
      return effectivePerms;
    }

    // For non-admin, collect permissions from selected roles
    allPermissions.forEach(perm => {
      if (selectedRoleIds.has(perm.role_id)) {
        const existing = effectivePerms.get(perm.resource as ResourceName) || new Set<PermissionAction>();
        existing.add(perm.action);
        effectivePerms.set(perm.resource as ResourceName, existing);
      }
    });

    return effectivePerms;
  };

  const effectivePermissions = computeEffectivePermissions();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-600" />
              Gestionar Roles
            </DialogTitle>
            <DialogDescription>
              {targetUser.full_name || targetUser.email}
              {isSelf && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Tu cuenta
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {allRoles.map((role) => {
                const isChecked = selectedRoleIds.has(role.id);
                const disabled = isRoleDisabled(role);
                const assignment = getAssignmentInfo(role.id);
                const displayInfo = ROLE_DISPLAY_INFO[role.name as RoleName];

                return (
                  <div
                    key={role.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      isChecked ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200'
                    } ${disabled ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={isChecked}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                          handleToggleRole(role, checked === true)
                        }
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor={`role-${role.id}`}
                          className={`block text-sm font-medium ${
                            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          {displayInfo?.displayName || role.display_name}
                        </label>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {displayInfo?.description || role.description || ''}
                        </p>

                        {/* Audit info for assigned roles */}
                        {assignment && (
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                            {assignment.assignedByName && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {assignment.assignedByName}
                              </span>
                            )}
                            {assignment.assignedAt && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(assignment.assignedAt)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Self-protection notice */}
                        {disabled && isSelf && role.name === ROLE_NAMES.GENERAL_ADMIN && (
                          <p className="text-xs text-amber-600 mt-1">
                            No puedes remover tu propio rol de administrador.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Effective Permissions Section */}
          {!loading && selectedRoleIds.size > 0 && (
            <div className="border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Permisos Efectivos
              </h3>
              <div className="text-xs text-gray-500 mb-3">
                Permisos que tendrá este usuario con los roles seleccionados:
              </div>
              <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600 border-b">
                        Recurso
                      </th>
                      <th className="text-center px-2 py-2 font-medium text-gray-600 border-b">
                        Leer
                      </th>
                      <th className="text-center px-2 py-2 font-medium text-gray-600 border-b">
                        Escribir
                      </th>
                      <th className="text-center px-2 py-2 font-medium text-gray-600 border-b">
                        Gestionar
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(RESOURCE_DISPLAY_NAMES).map(([resource, displayName]) => {
                      const perms = effectivePermissions.get(resource as ResourceName);
                      const hasRead = perms?.has('read') || false;
                      const hasWrite = perms?.has('write') || false;
                      const hasManage = perms?.has('manage') || false;

                      // Only show resources with at least one permission
                      if (!hasRead && !hasWrite && !hasManage) return null;

                      return (
                        <tr key={resource} className="border-b last:border-b-0 hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{displayName}</td>
                          <td className="text-center px-2 py-2">
                            {hasRead ? (
                              <Check className="h-4 w-4 text-green-600 inline" />
                            ) : (
                              <Minus className="h-4 w-4 text-gray-300 inline" />
                            )}
                          </td>
                          <td className="text-center px-2 py-2">
                            {hasWrite ? (
                              <Check className="h-4 w-4 text-green-600 inline" />
                            ) : (
                              <Minus className="h-4 w-4 text-gray-300 inline" />
                            )}
                          </td>
                          <td className="text-center px-2 py-2">
                            {hasManage ? (
                              <Check className="h-4 w-4 text-green-600 inline" />
                            ) : (
                              <Minus className="h-4 w-4 text-gray-300 inline" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {effectivePermissions.size === 0 && (
                  <div className="text-center py-4 text-gray-400 text-xs">
                    Los roles seleccionados no tienen permisos asignados.
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar cambios'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog for role removal */}
      <AlertDialog open={roleToRemove !== null} onOpenChange={(open) => !open && cancelRemoveRole()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar eliminación de rol</AlertDialogTitle>
            <AlertDialogDescription>
              {roleToRemove && (
                <>
                  ¿Estás seguro de que deseas remover el rol{' '}
                  <strong>
                    {ROLE_DISPLAY_INFO[roleToRemove.name as RoleName]?.displayName ||
                      roleToRemove.display_name}
                  </strong>{' '}
                  de {targetUser.full_name || targetUser.email}? Esta acción se aplicará al guardar.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelRemoveRole}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveRole}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remover rol
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RoleAssignmentModal;
