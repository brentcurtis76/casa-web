/**
 * PersonnelManager — Card-based personnel list with status filtering.
 */

import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Plus, Pencil, UserCheck, UserX, Users } from 'lucide-react';
import { formatCLP, maskRut } from '@/types/financial';
import type { Personnel } from '@/types/financial';
import { usePersonnel, useTogglePersonnelActive } from '@/lib/financial/hooks';
import PersonnelForm from './PersonnelForm';

interface PersonnelManagerProps {
  canWrite: boolean;
}

type StatusFilter = 'active' | 'inactive' | 'all';

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  indefinido: 'Indefinido',
  plazo_fijo: 'Plazo Fijo',
  honorarios: 'Honorarios',
};

const CONTRACT_TYPE_COLORS: Record<string, string> = {
  indefinido: 'bg-green-100 text-green-800',
  plazo_fijo: 'bg-amber-100 text-amber-800',
  honorarios: 'bg-blue-100 text-blue-800',
};

function maskAccountNumber(value: string | null): string {
  if (!value || value.length < 4) return value ?? '';
  return '****' + value.slice(-4);
}

const PersonnelManager = ({ canWrite }: PersonnelManagerProps) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [formOpen, setFormOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Personnel | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<Personnel | null>(null);

  const filters = statusFilter === 'all' ? undefined : { is_active: statusFilter === 'active' };
  const { data: personnel = [], isLoading } = usePersonnel(filters);
  const toggleActive = useTogglePersonnelActive();

  const handleAdd = useCallback(() => {
    setEditingPerson(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((person: Personnel) => {
    setEditingPerson(person);
    setFormOpen(true);
  }, []);

  const handleToggle = useCallback((person: Personnel) => {
    setConfirmToggle(person);
  }, []);

  const confirmToggleAction = useCallback(() => {
    if (confirmToggle) {
      toggleActive.mutate({ id: confirmToggle.id, is_active: !confirmToggle.is_active });
      setConfirmToggle(null);
    }
  }, [confirmToggle, toggleActive]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Personal</h2>
        {canWrite && (
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Personal
          </Button>
        )}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        <Button
          variant={statusFilter === 'active' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('active')}
        >
          Activo
        </Button>
        <Button
          variant={statusFilter === 'inactive' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('inactive')}
        >
          Inactivo
        </Button>
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
        >
          Todos
        </Button>
      </div>

      {/* Loading State and Content */}
      <div aria-live="polite" aria-busy={isLoading}>
        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6 space-y-3">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-36" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && personnel.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No hay personal registrado</p>
              <p className="text-sm mt-1">
                {statusFilter === 'active' && 'No hay personal activo.'}
                {statusFilter === 'inactive' && 'No hay personal inactivo.'}
                {statusFilter === 'all' && 'Agregue personal usando el botón de arriba.'}
              </p>
              {canWrite && statusFilter === 'all' && (
                <div className="mt-6">
                  <Button onClick={handleAdd}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Personal
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Personnel Cards */}
        {!isLoading && personnel.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
          {personnel.map((person) => (
            <Card key={person.id} className={!person.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">{person.name}</h3>
                    <p className="text-sm text-gray-500">{maskRut(person.rut)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={person.is_active ? 'default' : 'secondary'}>
                      {person.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Cargo</span>
                    <span className="font-medium">{person.role_position}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Contrato</span>
                    <Badge
                      variant="outline"
                      className={CONTRACT_TYPE_COLORS[person.contract_type] ?? ''}
                    >
                      {CONTRACT_TYPE_LABELS[person.contract_type] ?? person.contract_type}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Sueldo Bruto</span>
                    <span className="font-medium">{formatCLP(person.gross_salary)}</span>
                  </div>
                  {person.afp_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">AFP</span>
                      <span>{person.afp_name}</span>
                    </div>
                  )}
                  {person.isapre_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Salud</span>
                      <span>{person.isapre_name}</span>
                    </div>
                  )}
                  {person.bank_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Banco</span>
                      <span>{person.bank_name} {maskAccountNumber(person.bank_account_number)}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {canWrite && (
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(person)}
                      aria-label={`Editar ${person.name}`}
                    >
                      <Pencil className="mr-1 h-3 w-3" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(person)}
                      disabled={toggleActive.isPending}
                      aria-label={person.is_active ? `Desactivar ${person.name}` : `Activar ${person.name}`}
                    >
                      {person.is_active ? (
                        <>
                          <UserX className="mr-1 h-3 w-3" />
                          Desactivar
                        </>
                      ) : (
                        <>
                          <UserCheck className="mr-1 h-3 w-3" />
                          Activar
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        )}
      </div>

      {/* Toggle Confirmation Dialog */}
      <AlertDialog open={!!confirmToggle} onOpenChange={(open) => { if (!open) setConfirmToggle(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmToggle?.is_active ? 'Desactivar personal' : 'Activar personal'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggle?.is_active
                ? `¿Está seguro que desea desactivar a ${confirmToggle?.name}? No aparecerá en la lista activa.`
                : `¿Está seguro que desea activar a ${confirmToggle?.name}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggleAction}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Personnel Form Dialog */}
      <PersonnelForm
        open={formOpen}
        onOpenChange={setFormOpen}
        personnel={editingPerson}
      />
    </div>
  );
};

export default PersonnelManager;
