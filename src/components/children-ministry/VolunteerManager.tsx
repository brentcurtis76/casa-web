/**
 * VolunteerManager — Orchestrates the Volunteers tab
 * Shows coordinator view (list) or volunteer view (profile + availability)
 */

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus } from 'lucide-react';
import { getVolunteers } from '@/lib/children-ministry/volunteerService';
import VolunteerTable from './VolunteerTable';
import VolunteerDetailSheet from './VolunteerDetailSheet';
import VolunteerEditDialog from './VolunteerEditDialog';
import AvailabilityEditor from './AvailabilityEditor';
import type { ChildrenVolunteerRow } from '@/types/childrenMinistry';

interface VolunteerManagerProps {
  canWrite: boolean;
  canManage: boolean;
  isVolunteerOnly: boolean;
  userId?: string;
}

const VolunteerManager = ({
  canWrite,
  canManage,
  isVolunteerOnly,
  userId,
}: VolunteerManagerProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [volunteers, setVolunteers] = useState<ChildrenVolunteerRow[]>([]);

  // Filters (coordinator view only)
  const [searchText, setSearchText] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Detail and edit dialogs
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Load volunteers on mount
  useEffect(() => {
    const loadVolunteers = async () => {
      setLoading(true);
      try {
        const data = await getVolunteers({
          is_active: showInactive ? undefined : true,
          search: searchText || undefined,
        });
        setVolunteers(data);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los voluntarios',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      loadVolunteers();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchText, showInactive, toast]);

  const handleDetailOpen = (id: string) => {
    setSelectedVolunteerId(id);
    setDetailOpen(true);
  };

  const handleCreateNew = () => {
    setEditDialogOpen(true);
  };

  const handleSuccess = async () => {
    try {
      const data = await getVolunteers({
        is_active: showInactive ? undefined : true,
        search: searchText || undefined,
      });
      setVolunteers(data);
    } catch {
      // Silently fail on reload
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Volunteer-only view: show own profile
  if (isVolunteerOnly) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Mi Perfil de Voluntario</h3>
            <p className="text-sm text-gray-500 mb-4">
              Aquí puedes ver tu información de voluntario y tu disponibilidad semanal.
            </p>
          </CardContent>
        </Card>

        {userId && (
          <div className="space-y-6">
            <AvailabilityEditor volunteerId={userId} readOnly={false} />
          </div>
        )}
      </div>
    );
  }

  // Coordinator view: show volunteers list
  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700 mb-1 block">Buscar</label>
          <Input
            placeholder="Buscar voluntarios..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="w-full md:w-48">
          <label className="text-sm font-medium text-gray-700 mb-1 block">Estado</label>
          <Select
            value={showInactive ? 'all' : 'active'}
            onValueChange={(value) => setShowInactive(value === 'all')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canWrite && (
          <Button onClick={handleCreateNew} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Voluntario
          </Button>
        )}
      </div>

      {/* Volunteers table */}
      {volunteers.length === 0 ? (
        <Card className="p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No hay voluntarios registrados
          </h3>
          <p className="text-gray-500 mb-4">
            {searchText || showInactive
              ? 'No se encontraron voluntarios con los filtros aplicados'
              : 'Comienza agregando tu primer voluntario'}
          </p>
          {canWrite && !searchText && !showInactive && (
            <Button onClick={handleCreateNew}>Agregar voluntario</Button>
          )}
        </Card>
      ) : (
        <VolunteerTable
          volunteers={volunteers}
          onVolunteerClick={handleDetailOpen}
        />
      )}

      {/* Detail sheet */}
      <VolunteerDetailSheet
        volunteerId={selectedVolunteerId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canManage={canManage}
        onUpdated={handleSuccess}
      />

      {/* Edit dialog */}
      <VolunteerEditDialog
        volunteerId={undefined}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default VolunteerManager;
