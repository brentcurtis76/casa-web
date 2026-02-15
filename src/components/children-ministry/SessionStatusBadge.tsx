/**
 * SessionStatusBadge — Status badge for calendar sessions
 * Shows session status (scheduled, completed, cancelled) with color coding
 */

import { Badge } from '@/components/ui/badge';
import type { SessionStatus } from '@/types/childrenMinistry';

interface SessionStatusBadgeProps {
  status: SessionStatus;
}

const SessionStatusBadge = ({ status }: SessionStatusBadgeProps) => {
  const statusMap: Record<SessionStatus, { bg: string; text: string; label: string }> = {
    scheduled: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Programada' },
    completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completada' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelada' },
  };

  const colors = statusMap[status];

  return (
    <Badge className={`${colors.bg} ${colors.text} font-medium`}>
      {colors.label}
    </Badge>
  );
};

export default SessionStatusBadge;
