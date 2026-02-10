/**
 * ForcePasswordChangeModal — Undismissable modal that forces users to change
 * their temporary password before accessing the app.
 *
 * Rendered globally when user_metadata.must_change_password === true.
 * Cannot be closed by clicking outside, pressing Escape, or clicking X.
 */

import React, { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Lock } from 'lucide-react';

const ForcePasswordChangeModal: React.FC = () => {
  const { updatePassword, clearMustChangePassword } = useAuth();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});

  const validate = (): boolean => {
    const newErrors: { newPassword?: string; confirmPassword?: string } = {};

    if (!newPassword) {
      newErrors.newPassword = 'La contraseña es obligatoria.';
    } else if (newPassword.length < 6) {
      newErrors.newPassword = 'La contraseña debe tener al menos 6 caracteres.';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Debes confirmar la contraseña.';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await updatePassword(newPassword);
      await clearMustChangePassword();
      toast({
        title: 'Contraseña actualizada',
        description: 'Tu contraseña ha sido actualizada exitosamente.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al actualizar la contraseña.';
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
    <Dialog open={true}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-md [&>button]:hidden"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600" />
            Cambiar Contraseña
          </DialogTitle>
          <DialogDescription>
            Tu cuenta fue creada con una contraseña temporal. Por seguridad, debes
            establecer tu propia contraseña antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (errors.newPassword) setErrors((prev) => ({ ...prev, newPassword: undefined }));
              }}
              placeholder="Mínimo 6 caracteres"
              disabled={saving}
            />
            {errors.newPassword && (
              <p className="text-xs text-red-600">{errors.newPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar contraseña</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }}
              placeholder="Repite la contraseña"
              disabled={saving}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-600">{errors.confirmPassword}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Actualizando...
                </>
              ) : (
                'Cambiar contraseña'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ForcePasswordChangeModal;
