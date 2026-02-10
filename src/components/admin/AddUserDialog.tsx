/**
 * AddUserDialog — Dialog for creating a new user with a temporary password.
 *
 * Features:
 * - Full name, email, temporary password fields
 * - Auto-generate temporary password button
 * - Optional initial role assignment checkboxes
 * - Calls admin-user-management edge function with action: "create-user"
 * - Shows success toast with the temporary password for admin to share
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, UserPlus, RefreshCw, Copy, Check } from 'lucide-react';
import type { ChurchRole, RoleName } from '@/types/rbac';
import { ROLE_DISPLAY_INFO } from '@/types/rbac';

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: () => void;
  callAdminUserMgmt: (
    action: string,
    payload: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
}

/**
 * Generate a random temporary password.
 * Excludes ambiguous characters: 0, O, 1, l, I
 */
function generateTempPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((byte) => chars[byte % chars.length])
    .join('');
}

const AddUserDialog: React.FC<AddUserDialogProps> = ({
  open,
  onOpenChange,
  onUserCreated,
  callAdminUserMgmt,
}) => {
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [allRoles, setAllRoles] = useState<ChurchRole[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    tempPassword?: string;
  }>({});
  // Success dialog state
  const [successInfo, setSuccessInfo] = useState<{ name: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch available roles
  const fetchRoles = useCallback(async () => {
    const { data } = await supabase
      .from('church_roles')
      .select('id, name, display_name, description, created_at')
      .order('display_name');

    if (data) {
      setAllRoles(data as ChurchRole[]);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchRoles();
      // Pre-fill a generated password
      setTempPassword(generateTempPassword());
    }
  }, [open, fetchRoles]);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setTempPassword('');
    setSelectedRoles(new Set());
    setErrors({});
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'El nombre es obligatorio.';
    }

    if (!email.trim()) {
      newErrors.email = 'El correo es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'El correo no es válido.';
    }

    if (!tempPassword) {
      newErrors.tempPassword = 'La contraseña temporal es obligatoria.';
    } else if (tempPassword.length < 6) {
      newErrors.tempPassword = 'Mínimo 6 caracteres.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleToggleRole = (roleName: string, checked: boolean) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(roleName);
      } else {
        next.delete(roleName);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const createdPassword = tempPassword;
      const createdName = fullName.trim();

      await callAdminUserMgmt('create-user', {
        email: email.trim(),
        fullName: createdName,
        tempPassword: createdPassword,
        roles: Array.from(selectedRoles),
      });

      // Show persistent success dialog instead of ephemeral toast
      setSuccessInfo({ name: createdName, password: createdPassword });
      setCopied(false);
      resetForm();
      onOpenChange(false);
      onUserCreated();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Error al crear el usuario.';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-amber-600" />
            Agregar Usuario
          </DialogTitle>
          <DialogDescription>
            Crea un nuevo usuario con una contraseña temporal. El usuario deberá
            cambiar su contraseña al iniciar sesión por primera vez.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full name */}
          <div className="space-y-2">
            <Label htmlFor="add-user-name">Nombre completo</Label>
            <Input
              id="add-user-name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
              }}
              placeholder="Nombre y apellido"
              disabled={saving}
            />
            {errors.fullName && (
              <p className="text-xs text-red-600">{errors.fullName}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="add-user-email">Correo electrónico</Label>
            <Input
              id="add-user-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="correo@ejemplo.com"
              disabled={saving}
            />
            {errors.email && (
              <p className="text-xs text-red-600">{errors.email}</p>
            )}
          </div>

          {/* Temporary password */}
          <div className="space-y-2">
            <Label htmlFor="add-user-password">Contraseña temporal</Label>
            <div className="flex gap-2">
              <Input
                id="add-user-password"
                value={tempPassword}
                onChange={(e) => {
                  setTempPassword(e.target.value);
                  if (errors.tempPassword)
                    setErrors((prev) => ({ ...prev, tempPassword: undefined }));
                }}
                placeholder="Mínimo 6 caracteres"
                disabled={saving}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTempPassword(generateTempPassword())}
                disabled={saving}
                className="shrink-0 gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Generar
              </Button>
            </div>
            {errors.tempPassword ? (
              <p className="text-xs text-red-600">{errors.tempPassword}</p>
            ) : (
              <p className="text-xs text-gray-500">
                Visible para que puedas compartirla con el usuario.
              </p>
            )}
          </div>

          {/* Role checkboxes */}
          {allRoles.length > 0 && (
            <div className="space-y-2">
              <Label>Roles iniciales (opcional)</Label>
              <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto border rounded-lg p-3">
                {allRoles.map((role) => {
                  const displayInfo = ROLE_DISPLAY_INFO[role.name as RoleName];
                  return (
                    <div key={role.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`add-role-${role.id}`}
                        checked={selectedRoles.has(role.name)}
                        onCheckedChange={(checked) =>
                          handleToggleRole(role.name, checked === true)
                        }
                        disabled={saving}
                      />
                      <label
                        htmlFor={`add-role-${role.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {displayInfo?.displayName || role.display_name}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear usuario'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Success dialog with copyable temp password */}
    <AlertDialog
      open={successInfo !== null}
      onOpenChange={(open) => {
        if (!open) setSuccessInfo(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Usuario creado
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                <strong>{successInfo?.name}</strong> ha sido creado exitosamente.
                Comparte la contraseña temporal con el usuario:
              </p>
              <div className="flex items-center gap-2 bg-gray-100 rounded-md p-3 font-mono text-sm">
                <span className="flex-1 select-all">{successInfo?.password}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={async () => {
                    if (successInfo?.password) {
                      await navigator.clipboard.writeText(successInfo.password);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                El usuario deberá cambiar esta contraseña al iniciar sesión por primera vez.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction className="bg-amber-600 hover:bg-amber-700 text-white">
            Entendido
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default AddUserDialog;
