/**
 * CalendarMonthGrid — Month view grid for calendar sessions
 * 7-column grid with Spanish day headers and sessions as badges
 */

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
} from 'date-fns';
import { es } from 'date-fns/locale';
import AgeGroupBadge from './AgeGroupBadge';
import type { ChildrenCalendarFull } from '@/types/childrenMinistry';

interface CalendarMonthGridProps {
  sessions: ChildrenCalendarFull[];
  currentMonth: Date;
  onSessionClick: (id: string) => void;
}

const CalendarMonthGrid = ({ sessions, currentMonth, onSessionClick }: CalendarMonthGridProps) => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const getSessionsForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return sessions.filter((s) => s.date === dayStr);
  };

  return (
    <div className="bg-white rounded-lg border">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b">
        {dayHeaders.map((header) => (
          <div key={header} className="p-2 text-center font-semibold text-sm text-gray-700 border-r last:border-r-0">
            {header}
          </div>
        ))}
      </div>

      {/* Calendar weeks */}
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="grid grid-cols-7 border-b last:border-b-0">
          {week.map((day) => {
            const daySessionsForDay = getSessionsForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={format(day, 'yyyy-MM-dd')}
                className={`min-h-24 p-2 border-r last:border-r-0 ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                } ${isToday ? 'ring-inset ring-2 ring-amber-400' : ''}`}
                role="gridcell"
                aria-label={format(day, 'EEEE, d MMMM yyyy', { locale: es })}
              >
                <div className="text-xs font-semibold text-gray-700 mb-1">
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {daySessionsForDay.map((session) => (
                    <div
                      key={session.id}
                      className="cursor-pointer"
                      onClick={() => onSessionClick(session.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          onSessionClick(session.id);
                        }
                      }}
                    >
                      <AgeGroupBadge ageGroup={session.age_group} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default CalendarMonthGrid;
