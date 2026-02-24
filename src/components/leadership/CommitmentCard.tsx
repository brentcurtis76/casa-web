/**
 * CommitmentCard — Individual commitment with status toggle and edit
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Edit2, Calendar, User } from 'lucide-react';
import CommitmentStatusBadge from './CommitmentStatusBadge';
import type { CommitmentRow, CommitmentStatus } from '@/types/leadershipModule';

interface CommitmentCardProps {
  commitment: CommitmentRow;
  onStatusChange: (id: string, status: CommitmentStatus) => void;
  canWrite: boolean;
  onEdit: () => void;
}

const CommitmentCard = ({
  commitment,
  onStatusChange,
  canWrite,
  onEdit,
}: CommitmentCardProps) => {
  const isCompleted = commitment.status === 'completed';
  const isCancelled = commitment.status === 'cancelled';

  const isOverdue =
    commitment.due_date &&
    new Date(commitment.due_date) < new Date() &&
    !isCompleted &&
    !isCancelled;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CL', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const handleToggleComplete = () => {
    if (!canWrite) return;
    const newStatus: CommitmentStatus = isCompleted ? 'pending' : 'completed';
    onStatusChange(commitment.id, newStatus);
  };

  return (
    <Card className={`transition-all ${isCompleted ? 'opacity-60' : ''} ${isOverdue ? 'border-red-200 bg-red-50/50' : ''}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start gap-3">
          {canWrite && (
            <button
              onClick={handleToggleComplete}
              className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-green-600 transition-colors"
              aria-label={isCompleted ? 'Marcar como pendiente' : 'Marcar como completado'}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <Circle className="h-5 w-5" />
              )}
            </button>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p
                className={`text-sm font-medium break-words ${
                  isCompleted ? 'line-through text-muted-foreground' : ''
                }`}
              >
                {commitment.title}
              </p>
              <div className="flex items-center gap-1 flex-shrink-0">
                <CommitmentStatusBadge priority={commitment.priority} />
                <CommitmentStatusBadge
                  status={isOverdue ? 'overdue' : commitment.status}
                />
                {canWrite && (
                  <Button size="sm" variant="ghost" onClick={onEdit} className="h-7 w-7 p-0" aria-label="Editar compromiso">
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {commitment.description && (
              <p className="text-xs text-muted-foreground mt-1">{commitment.description}</p>
            )}

            <div className="flex flex-wrap gap-3 mt-2">
              {commitment.due_date && (
                <span
                  className={`flex items-center gap-1 text-xs ${
                    isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'
                  }`}
                >
                  <Calendar className="h-3 w-3" />
                  {formatDate(commitment.due_date)}
                </span>
              )}
              {commitment.assignee_id && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  Asignado
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CommitmentCard;
