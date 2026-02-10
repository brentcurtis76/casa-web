/**
 * PermissionMatrixEditor — Full-width dialog showing a resource x action permission grid.
 *
 * - Rows: 13 resources with Spanish display names
 * - Columns: read (Leer) | write (Escribir) | manage (Administrar)
 * - Checkboxes fetched from church_permissions for the selected role
 * - Toggle: INSERT or DELETE from church_permissions individually
 * - For general_admin: all checked, all disabled, show info banner
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Info } from 'lucide-react';
import type { ChurchRole, ChurchPermission, ResourceName, PermissionAction } from '@/types/rbac';
import { RESOURCE_NAMES, RESOURCE_DISPLAY_NAMES } from '@/types/rbac';

interface PermissionMatrixEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: ChurchRole;
}

const ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: 'read', label: 'Leer' },
  { key: 'write', label: 'Escribir' },
  { key: 'manage', label: 'Administrar' },
];

const ALL_RESOURCES: ResourceName[] = Object.values(RESOURCE_NAMES);

const PermissionMatrixEditor: React.FC<PermissionMatrixEditorProps> = ({
  open,
  onOpenChange,
  role,
}) => {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<ChurchPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null); // "resource:action" key for loading state

  const isGeneralAdmin = role.name === 'general_admin';

  // Build a set of "resource:action" keys for quick lookup
  const permissionSet = new Set(
    permissions.map((p) => `${p.resource}:${p.action}`)
  );

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('church_permissions')
        .select('id, role_id, resource, action')
        .eq('role_id', role.id);

      if (error) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los permisos.',
          variant: 'destructive',
        });
        return;
      }

      setPermissions((data as ChurchPermission[]) || []);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Error inesperado al cargar permisos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [role.id, toast]);

  useEffect(() => {
    if (open) {
      fetchPermissions();
    }
  }, [open, fetchPermissions]);

  const handleToggle = async (resource: ResourceName, action: PermissionAction) => {
    if (isGeneralAdmin) return;

    const key = `${resource}:${action}`;
    const hasPermission = permissionSet.has(key);

    setToggling(key);

    try {
      if (hasPermission) {
        // DELETE the permission row
        const permRow = permissions.find(
          (p) => p.resource === resource && p.action === action
        );
        if (!permRow) return;

        const { error } = await supabase
          .from('church_permissions')
          .delete()
          .eq('id', permRow.id);

        if (error) {
          toast({
            title: 'Error',
            description: `No se pudo quitar el permiso: ${error.message}`,
            variant: 'destructive',
          });
          return;
        }

        setPermissions((prev) => prev.filter((p) => p.id !== permRow.id));
        toast({
          title: 'Permiso eliminado',
          description: `${RESOURCE_DISPLAY_NAMES[resource]} - ${ACTIONS.find(a => a.key === action)?.label}`,
        });
      } else {
        // INSERT a new permission row
        const { data, error } = await supabase
          .from('church_permissions')
          .insert({
            role_id: role.id,
            resource,
            action,
          })
          .select('id, role_id, resource, action')
          .single();

        if (error) {
          toast({
            title: 'Error',
            description: `No se pudo agregar el permiso: ${error.message}`,
            variant: 'destructive',
          });
          return;
        }

        if (data) {
          setPermissions((prev) => [...prev, data as ChurchPermission]);
        }
        toast({
          title: 'Permiso agregado',
          description: `${RESOURCE_DISPLAY_NAMES[resource]} - ${ACTIONS.find(a => a.key === action)?.label}`,
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Error inesperado al modificar el permiso.',
        variant: 'destructive',
      });
    } finally {
      setToggling(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permisos: {role.display_name}</DialogTitle>
          <DialogDescription>
            Configura los permisos de acceso a cada módulo para este rol.
          </DialogDescription>
        </DialogHeader>

        {/* Info banner for general_admin */}
        {isGeneralAdmin && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              El rol de Administrador General tiene todos los permisos automáticamente.
              No es necesario modificar esta matriz.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-medium text-gray-700">
                    Recurso
                  </th>
                  {ACTIONS.map((action) => (
                    <th
                      key={action.key}
                      className="text-center px-4 py-3 font-medium text-gray-700 w-24"
                    >
                      {action.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_RESOURCES.map((resource, idx) => (
                  <tr
                    key={resource}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                  >
                    <td className="px-4 py-2.5 text-gray-900">
                      {RESOURCE_DISPLAY_NAMES[resource]}
                    </td>
                    {ACTIONS.map((action) => {
                      const key = `${resource}:${action.key}`;
                      const checked = isGeneralAdmin || permissionSet.has(key);
                      const isToggling = toggling === key;

                      return (
                        <td key={action.key} className="text-center px-4 py-2.5">
                          {isToggling ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400 mx-auto" />
                          ) : (
                            <Checkbox
                              checked={checked}
                              disabled={isGeneralAdmin}
                              onCheckedChange={() =>
                                handleToggle(resource, action.key)
                              }
                              aria-label={`${RESOURCE_DISPLAY_NAMES[resource]} - ${action.label}`}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PermissionMatrixEditor;
