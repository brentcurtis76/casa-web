/**
 * RoleFormDialog — Dialog for creating or editing a church role.
 *
 * Create mode: name (auto-slugified from display_name), display_name, description
 * Edit mode: display_name and description only (name is read-only)
 * Auto-slugify: lowercase, spaces to underscores, strip Spanish accents
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { ChurchRole } from '@/types/rbac';

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: ChurchRole | null; // null = create mode, object = edit mode
  onSaved: () => void;
}

/**
 * Slugify a display name into a DB-safe name:
 * - Lowercase
 * - Strip Spanish accents (and other diacritics)
 * - Replace spaces and hyphens with underscores
 * - Remove any non-alphanumeric/underscore characters
 */
function slugify(displayName: string): string {
  return displayName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[\s-]+/g, '_')         // spaces/hyphens -> underscores
    .replace(/[^a-z0-9_]/g, '')      // remove non-alphanumeric
    .replace(/_+/g, '_')             // collapse multiple underscores
    .replace(/^_|_$/g, '');          // trim leading/trailing underscores
}

const RoleFormDialog: React.FC<RoleFormDialogProps> = ({
  open,
  onOpenChange,
  role,
  onSaved,
}) => {
  const { toast } = useToast();
  const isEditMode = role !== null;

  const [displayName, setDisplayName] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when opening
  useEffect(() => {
    if (open) {
      if (role) {
        setDisplayName(role.display_name);
        setName(role.name);
        setDescription(role.description || '');
      } else {
        setDisplayName('');
        setName('');
        setDescription('');
      }
      setError(null);
    }
  }, [open, role]);

  // Auto-slugify name from display_name in create mode
  useEffect(() => {
    if (!isEditMode) {
      setName(slugify(displayName));
    }
  }, [displayName, isEditMode]);

  const handleSave = async () => {
    // Validation
    if (!displayName.trim()) {
      setError('El nombre para mostrar es obligatorio.');
      return;
    }

    if (!isEditMode && !name.trim()) {
      setError('El identificador no puede estar vacío. Escribe un nombre para mostrar.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEditMode && role) {
        // UPDATE existing role
        const { error: updateError } = await supabase
          .from('church_roles')
          .update({
            display_name: displayName.trim(),
            description: description.trim() || null,
          })
          .eq('id', role.id);

        if (updateError) {
          if (updateError.message.includes('unique') || updateError.code === '23505') {
            setError('Ya existe un rol con ese nombre.');
          } else {
            setError(`Error al actualizar: ${updateError.message}`);
          }
          return;
        }

        toast({
          title: 'Rol actualizado',
          description: `El rol "${displayName.trim()}" fue actualizado correctamente.`,
        });
      } else {
        // INSERT new role
        const { error: insertError } = await supabase
          .from('church_roles')
          .insert({
            name: name.trim(),
            display_name: displayName.trim(),
            description: description.trim() || null,
          });

        if (insertError) {
          if (insertError.message.includes('unique') || insertError.code === '23505') {
            setError('Ya existe un rol con ese identificador. Prueba un nombre diferente.');
          } else {
            setError(`Error al crear: ${insertError.message}`);
          }
          return;
        }

        toast({
          title: 'Rol creado',
          description: `El rol "${displayName.trim()}" fue creado correctamente.`,
        });
      }

      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError('Error inesperado. Por favor intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Editar Rol' : 'Crear Rol'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Modifica el nombre para mostrar y la descripción del rol.'
              : 'Crea un nuevo rol personalizado para la comunidad.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="role-display-name">Nombre para mostrar *</Label>
            <Input
              id="role-display-name"
              placeholder="Ej: Líder Juvenil"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Slug Name (read-only in edit mode) */}
          <div className="space-y-2">
            <Label htmlFor="role-name">Identificador</Label>
            <Input
              id="role-name"
              value={name}
              disabled={isEditMode || saving}
              readOnly={isEditMode}
              className={isEditMode ? 'bg-gray-100 text-gray-500' : ''}
              placeholder="Se genera automáticamente"
            />
            {!isEditMode && (
              <p className="text-xs text-gray-500">
                Se genera automáticamente a partir del nombre para mostrar.
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="role-description">Descripción</Label>
            <Textarea
              id="role-description"
              placeholder="Describe brevemente las responsabilidades de este rol..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              rows={3}
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md p-3">
              {error}
            </p>
          )}
        </div>

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
            disabled={saving || !displayName.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : isEditMode ? (
              'Guardar cambios'
            ) : (
              'Crear rol'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RoleFormDialog;
