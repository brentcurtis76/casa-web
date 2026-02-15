/**
 * LessonStatusBadge — Status badge for lessons
 * Shows lesson status (draft, ready, archived) with color coding
 */

import { Badge } from '@/components/ui/badge';
import type { LessonStatus } from '@/types/childrenMinistry';

interface LessonStatusBadgeProps {
  status: LessonStatus;
}

const LessonStatusBadge = ({ status }: LessonStatusBadgeProps) => {
  const statusMap: Record<LessonStatus, { bg: string; text: string; label: string }> = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Borrador' },
    ready: { bg: 'bg-green-100', text: 'text-green-800', label: 'Lista' },
    archived: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Archivada' },
  };

  const colors = statusMap[status];

  return (
    <Badge className={`${colors.bg} ${colors.text} font-medium`}>
      {colors.label}
    </Badge>
  );
};

export default LessonStatusBadge;
