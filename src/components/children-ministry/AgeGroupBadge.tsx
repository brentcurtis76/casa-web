/**
 * AgeGroupBadge — Colored badge for age groups
 * Displays age group name with color coding by group
 */

import { Badge } from '@/components/ui/badge';
import type { ChildrenAgeGroupRow } from '@/types/childrenMinistry';

interface AgeGroupBadgeProps {
  ageGroup: ChildrenAgeGroupRow;
}

const AgeGroupBadge = ({ ageGroup }: AgeGroupBadgeProps) => {
  const colorMap: Record<string, { bg: string; text: string }> = {
    'Pequeños': { bg: 'bg-blue-100', text: 'text-blue-800' },
    'Medianos': { bg: 'bg-green-100', text: 'text-green-800' },
    'Grandes': { bg: 'bg-amber-100', text: 'text-amber-800' },
  };

  const colors = colorMap[ageGroup.name] || { bg: 'bg-gray-100', text: 'text-gray-800' };

  return (
    <Badge className={`${colors.bg} ${colors.text} font-medium`}>
      {ageGroup.name}
    </Badge>
  );
};

export default AgeGroupBadge;
