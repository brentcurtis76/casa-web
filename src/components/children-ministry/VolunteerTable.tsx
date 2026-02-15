/**
 * VolunteerTable — Table display for volunteers list
 * Shows name, email, phone, active status, with click-to-detail
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ChildrenVolunteerRow } from '@/types/childrenMinistry';

interface VolunteerTableProps {
  volunteers: ChildrenVolunteerRow[];
  onVolunteerClick: (id: string) => void;
}

const VolunteerTable = ({ volunteers, onVolunteerClick }: VolunteerTableProps) => {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead aria-sort="ascending">Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="hidden md:table-cell">Teléfono</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {volunteers.map((volunteer) => (
            <TableRow
              key={volunteer.id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => onVolunteerClick(volunteer.id)}
            >
              <TableCell className="font-medium">{volunteer.display_name}</TableCell>
              <TableCell className="text-sm text-gray-600">
                {volunteer.email || '-'}
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-gray-600">
                {volunteer.phone || '-'}
              </TableCell>
              <TableCell>
                <Badge
                  variant={volunteer.is_active ? 'default' : 'outline'}
                  className={volunteer.is_active ? 'bg-green-100 text-green-800' : ''}
                >
                  {volunteer.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default VolunteerTable;
