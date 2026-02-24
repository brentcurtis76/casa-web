/**
 * CommitmentManager — Full commitment management with filtering
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getCommitments,
  updateCommitmentStatus,
} from '@/lib/leadership/commitmentService';
import CommitmentCard from './CommitmentCard';
import CommitmentEditDialog from './CommitmentEditDialog';
import type { CommitmentRow, CommitmentStatus } from '@/types/leadershipModule';

interface CommitmentManagerProps {
  meetingId?: string;
  canWrite: boolean;
  onUpdated?: () => void;
}

const CommitmentManager = ({ meetingId, canWrite, onUpdated }: CommitmentManagerProps) => {
  const { toast } = useToast();
  const [commitments, setCommitments] = useState<CommitmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editCommitmentData, setEditCommitmentData] = useState<CommitmentRow | undefined>();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);

  const loadCommitments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCommitments(meetingId ? { meeting_id: meetingId } : undefined);
      setCommitments(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los compromisos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [meetingId, toast]);

  useEffect(() => {
    loadCommitments();
  }, [loadCommitments]);

  const filteredCommitments = commitments.filter((commitment) => {
    if (filterStatus !== 'all' && commitment.status !== filterStatus) return false;
    if (filterPriority !== 'all' && commitment.priority !== filterPriority) return false;
    if (filterOverdueOnly) {
      const dueDate = commitment.due_date ? new Date(commitment.due_date) : null;
      const today = new Date();
      if (!dueDate || dueDate >= today || commitment.status === 'completed') return false;
    }
    return true;
  });

  const handleStatusChange = async (id: string, newStatus: CommitmentStatus) => {
    try {
      await updateCommitmentStatus(id, newStatus);
      setCommitments(
        commitments.map((c) => (c.id === id ? { ...c, status: newStatus } : c)),
      );
      onUpdated?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado',
        variant: 'destructive',
      });
    }
  };

  const handleSaved = async () => {
    await loadCommitments();
    setCreateDialogOpen(false);
    setEditCommitmentData(undefined);
    onUpdated?.();
  };

  const overdueCount = commitments.filter((c) => {
    const dueDate = c.due_date ? new Date(c.due_date) : null;
    const today = new Date();
    return (
      dueDate &&
      dueDate < today &&
      c.status !== 'completed' &&
      c.status !== 'cancelled'
    );
  }).length;

  return (
    <div className="space-y-4 p-4">
      {overdueCount > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">
                {overdueCount}{' '}
                {overdueCount === 1 ? 'compromiso atrasado' : 'compromisos atrasados'}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setFilterOverdueOnly(true);
                setFilterStatus('all');
              }}
            >
              Ver
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-sm font-medium">Estado</label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="in_progress">En Progreso</SelectItem>
              <SelectItem value="completed">Completado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="text-sm font-medium">Prioridad</label>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="low">Baja</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canWrite && (
          <Button
            onClick={() => {
              setEditCommitmentData(undefined);
              setCreateDialogOpen(true);
            }}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-stone-900"
          >
            <Plus className="h-4 w-4" />
            Nuevo Compromiso
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : filteredCommitments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {filterOverdueOnly ? 'No hay compromisos atrasados' : 'No hay compromisos'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCommitments.map((commitment) => (
            <CommitmentCard
              key={commitment.id}
              commitment={commitment}
              onStatusChange={handleStatusChange}
              canWrite={canWrite}
              onEdit={() => {
                setEditCommitmentData(commitment);
                setCreateDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <CommitmentEditDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        commitment={editCommitmentData}
        meetingId={meetingId}
        onSaved={handleSaved}
      />
    </div>
  );
};

export default CommitmentManager;
