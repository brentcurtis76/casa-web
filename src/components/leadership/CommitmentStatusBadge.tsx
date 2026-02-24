/**
 * CommitmentStatusBadge — Color-coded priority and status badge for commitments
 */

import { Badge } from '@/components/ui/badge';
import type { CommitmentPriority, CommitmentStatus } from '@/types/leadershipModule';

interface CommitmentStatusBadgeProps {
  status?: CommitmentStatus;
  priority?: CommitmentPriority;
}

const STATUS_CONFIG: Record<CommitmentStatus, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'En Progreso', className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completado', className: 'bg-green-100 text-green-700' },
  overdue: { label: 'Atrasado', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelado', className: 'bg-gray-100 text-gray-400 line-through' },
};

const PRIORITY_CONFIG: Record<CommitmentPriority, { label: string; className: string }> = {
  low: { label: 'Baja', className: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Media', className: 'bg-amber-100 text-amber-700' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgente', className: 'bg-red-100 text-red-700' },
};

const CommitmentStatusBadge = ({ status, priority }: CommitmentStatusBadgeProps) => {
  if (status) {
    const config = STATUS_CONFIG[status];
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  }

  if (priority) {
    const config = PRIORITY_CONFIG[priority];
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  }

  return null;
};

export default CommitmentStatusBadge;
