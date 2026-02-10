/**
 * UserActionsDropdown — Per-row dropdown menu for user management actions.
 *
 * Actions:
 * - Gestionar Roles (opens RoleAssignmentModal)
 * - Restablecer Contraseña (confirmation → edge function)
 * - Eliminar Usuario (destructive confirmation → edge function)
 *
 * Self-deletion is disabled for the current user.
 */

import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Shield, KeyRound, Trash2, Loader2 } from 'lucide-react';
import type { UserWithEmail } from '@/types/rbac';

interface UserActionsDropdownProps {
  targetUser: UserWithEmail;
  currentUserId: string;
  onManageRoles: (user: UserWithEmail) => void;
  onUserDeleted: () => void;
  callAdminUserMgmt: (
    action: string,
    payload: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
}

const UserActionsDropdown: React.FC<UserActionsDropdownProps> = ({
  targetUser,
  currentUserId,
  onManageRoles,
  onUserDeleted,
  callAdminUserMgmt,
}) => {
  const { toast } = useToast();
  const isSelf = targetUser.id === currentUserId;

  // Confirmation dialogs
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleResetPassword = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent Radix auto-close before async completes
    setResetting(true);
    try {
      await callAdminUserMgmt('reset-password', {
        userId: targetUser.id,
        email: targetUser.email,
      });

      toast({
        title: 'Correo enviado',
        description: `Se envió un correo de recuperación a ${targetUser.email}.`,
      });
      setResetDialogOpen(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Error al enviar el correo de recuperación.';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteUser = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent Radix auto-close before async completes
    setDeleting(true);
    try {
      await callAdminUserMgmt('delete-user', {
        userId: targetUser.id,
      });

      toast({
        title: 'Usuario eliminado',
        description: `${targetUser.full_name || targetUser.email} ha sido eliminado.`,
      });
      setDeleteDialogOpen(false);
      onUserDeleted();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Error al eliminar el usuario.';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <MoreHorizontal className="h-4 w-4" />
            Acciones
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => onManageRoles(targetUser)}
            className="cursor-pointer"
          >
            <Shield className="h-4 w-4 mr-2" />
            Gestionar Roles
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setResetDialogOpen(true)}
            className="cursor-pointer"
          >
            <KeyRound className="h-4 w-4 mr-2" />
            Restablecer Contraseña
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            disabled={isSelf}
            className={`cursor-pointer ${isSelf ? '' : 'text-red-600 focus:text-red-600'}`}
            title={isSelf ? 'No puedes eliminar tu propia cuenta' : undefined}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar Usuario
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reset Password Confirmation */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restablecer contraseña</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Enviar correo de recuperación de contraseña a{' '}
              <strong>{targetUser.email}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetPassword}
              disabled={resetting}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {resetting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar correo'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el usuario{' '}
              <strong>{targetUser.full_name || targetUser.email}</strong> y todos
              sus roles asignados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar usuario'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserActionsDropdown;
