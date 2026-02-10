/**
 * RoleEditor — Main component for role CRUD operations.
 *
 * Features:
 * - Table listing all roles from church_roles
 * - Columns: Display Name, Name (slug), Description, Users (count), System badge, Actions
 * - "Crear Rol" button opens RoleFormDialog
 * - Row actions: "Editar" (edit), "Permisos" (permissions matrix), "Eliminar" (delete)
 * - Delete: disabled if is_system=true OR user count > 0 (ISSUE-1)
 * - Show confirmation AlertDialog before delete
 * - Fetch roles + user counts on mount
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Loader2, Plus, Pencil, Shield, Trash2, Lock } from 'lucide-react';
import type { ChurchRole, RoleName } from '@/types/rbac';
import { ROLE_DISPLAY_INFO } from '@/types/rbac';
import RoleFormDialog from './RoleFormDialog';
import PermissionMatrixEditor from './PermissionMatrixEditor';

interface RoleWithCount extends ChurchRole {
  userCount: number;
}

const RoleEditor: React.FC = () => {
  const { toast } = useToast();
  const [roles, setRoles] = useState<RoleWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<ChurchRole | null>(null);

  // Permission matrix state
  const [permMatrixOpen, setPermMatrixOpen] = useState(false);
  const [permMatrixRole, setPermMatrixRole] = useState<ChurchRole | null>(null);

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleWithCount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('church_roles')
        .select('id, name, display_name, description, is_system, created_at')
        .order('is_system', { ascending: false })
        .order('display_name');

      if (rolesError) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los roles.',
          variant: 'destructive',
        });
        return;
      }

      const typedRoles = (rolesData || []) as ChurchRole[];

      // Fetch user counts per role in a single query
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('church_user_roles')
        .select('role_id');

      if (assignmentsError) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las asignaciones de usuarios.',
          variant: 'destructive',
        });
        return;
      }

      // Count users per role
      const countMap = new Map<string, number>();
      for (const assignment of assignmentsData || []) {
        const current = countMap.get(assignment.role_id) || 0;
        countMap.set(assignment.role_id, current + 1);
      }

      const rolesWithCounts: RoleWithCount[] = typedRoles.map((role) => ({
        ...role,
        userCount: countMap.get(role.id) || 0,
      }));

      setRoles(rolesWithCounts);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Error inesperado al cargar roles.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Open create dialog
  const handleCreate = () => {
    setEditingRole(null);
    setFormOpen(true);
  };

  // Open edit dialog
  const handleEdit = (role: ChurchRole) => {
    setEditingRole(role);
    setFormOpen(true);
  };

  // Open permission matrix
  const handlePermissions = (role: ChurchRole) => {
    setPermMatrixRole(role);
    setPermMatrixOpen(true);
  };

  // Initiate delete (show confirmation)
  const handleDeleteClick = (role: RoleWithCount) => {
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (!roleToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('church_roles')
        .delete()
        .eq('id', roleToDelete.id);

      if (error) {
        toast({
          title: 'Error',
          description: `No se pudo eliminar el rol: ${error.message}`,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Rol eliminado',
        description: `El rol "${roleToDelete.display_name}" fue eliminado correctamente.`,
      });

      fetchRoles();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Error inesperado al eliminar el rol.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    }
  };

  // Check if delete should be disabled
  const isDeleteDisabled = (role: RoleWithCount): boolean => {
    return role.is_system || role.userCount > 0;
  };

  // Get tooltip text for disabled delete button
  const getDeleteTooltip = (role: RoleWithCount): string => {
    if (role.is_system) return 'Los roles del sistema no se pueden eliminar';
    if (role.userCount > 0) return 'No se puede eliminar un rol con usuarios asignados';
    return 'Eliminar rol';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {roles.length} rol{roles.length !== 1 ? 'es' : ''} configurado{roles.length !== 1 ? 's' : ''}
        </p>
        <Button
          onClick={handleCreate}
          className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Plus className="h-4 w-4" />
          Crear Rol
        </Button>
      </div>

      {/* Roles table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Nombre</TableHead>
              <TableHead className="w-[140px]">Identificador</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-[100px] text-center">Usuarios</TableHead>
              <TableHead className="w-[100px] text-center">Tipo</TableHead>
              <TableHead className="w-[200px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => {
              const displayInfo = ROLE_DISPLAY_INFO[role.name as RoleName];
              const deleteDisabled = isDeleteDisabled(role);

              return (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">
                    {role.display_name || displayInfo?.displayName || role.name}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                      {role.name}
                    </code>
                  </TableCell>
                  <TableCell className="text-gray-600 text-sm">
                    {role.description || displayInfo?.description || '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-sm ${role.userCount > 0 ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                      {role.userCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {role.is_system ? (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Lock className="h-3 w-3" />
                        Sistema
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-gray-500">
                        Personalizado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(role)}
                        className="gap-1 text-gray-600 hover:text-gray-900"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePermissions(role)}
                        className="gap-1 text-gray-600 hover:text-gray-900"
                      >
                        <Shield className="h-3.5 w-3.5" />
                        Permisos
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(role)}
                        disabled={deleteDisabled}
                        className={`gap-1 ${
                          deleteDisabled
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                        }`}
                        title={getDeleteTooltip(role)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <RoleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        role={editingRole}
        onSaved={fetchRoles}
      />

      {/* Permission Matrix Dialog */}
      {permMatrixRole && (
        <PermissionMatrixEditor
          open={permMatrixOpen}
          onOpenChange={(open) => {
            setPermMatrixOpen(open);
            if (!open) setPermMatrixRole(null);
          }}
          role={permMatrixRole}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false);
            setRoleToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              {roleToDelete && (
                <>
                  ¿Estás seguro de que deseas eliminar el rol{' '}
                  <strong>{roleToDelete.display_name}</strong>? Esta acción no se
                  puede deshacer. Se eliminarán todos los permisos asociados a este rol.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar rol'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RoleEditor;
