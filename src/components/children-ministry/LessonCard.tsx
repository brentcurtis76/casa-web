/**
 * LessonCard — Display card for a lesson
 * Shows title, age group, status, bible reference, duration, and description
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AgeGroupBadge from './AgeGroupBadge';
import LessonStatusBadge from './LessonStatusBadge';
import type { ChildrenLessonRow, ChildrenAgeGroupRow } from '@/types/childrenMinistry';

interface LessonCardProps {
  lesson: ChildrenLessonRow;
  ageGroup?: ChildrenAgeGroupRow;
  onClick: () => void;
}

const LessonCard = ({ lesson, ageGroup, onClick }: LessonCardProps) => {
  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow h-full"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-2">{lesson.title}</CardTitle>
          <LessonStatusBadge status={lesson.status} />
        </div>
        {ageGroup && (
          <div className="mt-2">
            <AgeGroupBadge ageGroup={ageGroup} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {lesson.bible_reference && (
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Biblia:</span> {lesson.bible_reference}
          </p>
        )}
        {lesson.duration_minutes && (
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Duración:</span> {lesson.duration_minutes} minutos
          </p>
        )}
        {lesson.description && (
          <p className="text-sm text-gray-600 line-clamp-3">{lesson.description}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default LessonCard;
