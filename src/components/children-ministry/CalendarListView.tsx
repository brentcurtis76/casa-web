/**
 * CalendarListView — Chronological list of calendar sessions
 * Shows sessions as rows with date, time, age group, lesson, volunteers, status
 */

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import AgeGroupBadge from './AgeGroupBadge';
import SessionStatusBadge from './SessionStatusBadge';
import type { ChildrenCalendarFull } from '@/types/childrenMinistry';

interface CalendarListViewProps {
  sessions: ChildrenCalendarFull[];
  onSessionClick: (id: string) => void;
}

const CalendarListView = ({ sessions, onSessionClick }: CalendarListViewProps) => {
  if (sessions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay clases programadas</h3>
        <p className="text-gray-500">Este mes no tiene clases programadas.</p>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Hora</TableHead>
            <TableHead>Grupo</TableHead>
            <TableHead>Lección</TableHead>
            <TableHead className="hidden md:table-cell">Voluntarios</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow
              key={session.id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => onSessionClick(session.id)}
            >
              <TableCell className="font-medium">
                {format(new Date(session.date), 'dd MMM yyyy', { locale: es })}
              </TableCell>
              <TableCell>
                {session.start_time.substring(0, 5)} - {session.end_time.substring(0, 5)}
              </TableCell>
              <TableCell>
                <AgeGroupBadge ageGroup={session.age_group} />
              </TableCell>
              <TableCell className="text-sm text-gray-600">
                {session.lesson?.title || 'Sin lección asignada'}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="text-sm">{session.assignments.length} asignados</span>
              </TableCell>
              <TableCell>
                <SessionStatusBadge status={session.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default CalendarListView;
