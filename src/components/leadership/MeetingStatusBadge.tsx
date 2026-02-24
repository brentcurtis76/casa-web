/**
 * MeetingStatusBadge — Status badge for meetings
 */

import { Badge } from '@/components/ui/badge';
import type { MeetingStatus } from '@/types/leadershipModule';

interface MeetingStatusBadgeProps {
  status: MeetingStatus;
}

type BadgeVariant = 'outline' | 'default' | 'secondary' | 'destructive';

const STATUS_CONFIG: Record<MeetingStatus, { label: string; variant: BadgeVariant }> = {
  scheduled: { label: 'Programada', variant: 'outline' },
  in_progress: { label: 'En Curso', variant: 'default' },
  completed: { label: 'Completada', variant: 'secondary' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
};

const MeetingStatusBadge = ({ status }: MeetingStatusBadgeProps) => {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export default MeetingStatusBadge;
