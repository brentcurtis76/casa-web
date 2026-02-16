/**
 * AttendanceReports — Attendance reporting with date range and age group filtering
 * Displays summary cards, bar chart, and session breakdown table
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import AgeGroupBadge from './AgeGroupBadge';
import SessionStatusBadge from './SessionStatusBadge';
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { getCalendarSessions } from '@/lib/children-ministry/calendarService';
import { getAttendance } from '@/lib/children-ministry/attendanceService';
import { getAgeGroups } from '@/lib/children-ministry/ageGroupService';
import type { ChildrenCalendarFull, ChildrenAgeGroupRow, CalendarFilters } from '@/types/childrenMinistry';

interface SessionWithAttendance {
  session: ChildrenCalendarFull;
  presentCount: number;
}

const AttendanceReports = () => {
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(
    format(new Date(Date.now() - 28 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  );
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [ageGroupFilter, setAgeGroupFilter] = useState('all');
  const [ageGroups, setAgeGroups] = useState<ChildrenAgeGroupRow[]>([]);
  const [sessions, setSessions] = useState<SessionWithAttendance[]>([]);
  const [chartData, setChartData] = useState<Record<string, string | number>[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalAttendance, setTotalAttendance] = useState(0);
  const [avgPerSession, setAvgPerSession] = useState(0);

  useEffect(() => {
    loadAgeGroups();
  }, []);

  const loadAgeGroups = async () => {
    try {
      const groups = await getAgeGroups();
      setAgeGroups(groups);
    } catch {
      // Silently handle age group load errors
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const filters: CalendarFilters = {
        from: dateFrom,
        to: dateTo,
      };

      if (ageGroupFilter !== 'all') {
        filters.age_group_id = ageGroupFilter;
      }

      const sessionList = await getCalendarSessions(filters);

      // Fetch attendance for each session
      const sessionData = await Promise.all(
        sessionList.map(async (session) => {
          const attendance = await getAttendance(session.id);
          const presentCount = attendance.filter((a) => a.is_present).length;
          return {
            session,
            presentCount,
            attendance,
          };
        })
      );

      setSessions(sessionData);

      // Calculate summary
      const uniqueDates = new Map<string, Map<string, number>>();
      let totalPresent = 0;

      sessionData.forEach(({ session, presentCount, attendance }) => {
        const date = session.date;
        if (!uniqueDates.has(date)) {
          uniqueDates.set(date, new Map());
        }

        const ageGroupName = session.age_group?.name || 'Desconocido';
        const currentCount = uniqueDates.get(date)?.get(ageGroupName) || 0;
        uniqueDates.get(date)?.set(ageGroupName, currentCount + presentCount);
        totalPresent += presentCount;
      });

      setTotalSessions(sessionData.length);
      setTotalAttendance(totalPresent);

      if (sessionData.length > 0) {
        setAvgPerSession(Math.round(totalPresent / sessionData.length));
      } else {
        setAvgPerSession(0);
      }

      // Build chart data
      if (ageGroupFilter === 'all') {
        const chartDataArray = Array.from(uniqueDates.entries())
          .map(([date, ageGroupMap]) => {
            const record: Record<string, string | number> = { date };
            ageGroupMap.forEach((count, ageGroup) => {
              record[ageGroup] = count;
            });
            return record;
          })
          .sort((a, b) => a.date.localeCompare(b.date));
        setChartData(chartDataArray);
      } else {
        const chartDataArray = Array.from(uniqueDates.entries())
          .map(([date, ageGroupMap]) => ({
            date,
            count: Array.from(ageGroupMap.values()).reduce((a, b) => a + b, 0),
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setChartData(chartDataArray);
      }
    } catch {
      // Silently handle data load errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Reporte</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Desde</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">Hasta</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ageGroup">Grupo de Edad</Label>
              <Select value={ageGroupFilter} onValueChange={setAgeGroupFilter}>
                <SelectTrigger id="ageGroup">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {ageGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={loadData} className="mt-4" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Actualizar
          </Button>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-gray-600">Total Sesiones</p>
              <p className="text-2xl font-bold mt-1">{totalSessions}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-gray-600">Total Asistencia</p>
              <p className="text-2xl font-bold mt-1">{totalAttendance}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-gray-600">Promedio por Sesión</p>
              <p className="text-2xl font-bold mt-1">{avgPerSession}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Asistencia por Sesión</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-80 w-full" />
          ) : chartData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No hay datos de asistencia para el período seleccionado
            </div>
          ) : (
            <ChartContainer
              config={
                {
                  attendance: { label: 'Asistencia', color: '#3B82F6' },
                } as ChartConfig
              }
              className="h-[300px] w-full"
            >
              {ageGroupFilter === 'all' ? (
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'dd/MM')}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip
                    content={<ChartTooltipContent />}
                    labelFormatter={(label) => format(new Date(label), 'dd/MM/yyyy')}
                  />
                  <Legend />
                  {ageGroups.map((group) => (
                    <Bar
                      key={group.id}
                      dataKey={group.name}
                      stackId="a"
                      fill={
                        group.name === 'Pequeños'
                          ? '#3B82F6'
                          : group.name === 'Medianos'
                            ? '#10B981'
                            : '#F59E0B'
                      }
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'dd/MM')}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip
                    content={<ChartTooltipContent />}
                    labelFormatter={(label) => format(new Date(label), 'dd/MM/yyyy')}
                  />
                  <Bar dataKey="count" fill="var(--color-attendance)" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Session Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Desglose por Sesión</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay datos de asistencia para el período seleccionado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Grupo de Edad</TableHead>
                    <TableHead className="text-right">Niños Presentes</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Voluntarios</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map(({ session, presentCount }) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">
                        {format(new Date(session.date), "dd/MM/yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <AgeGroupBadge ageGroup={session.age_group} />
                      </TableCell>
                      <TableCell className="text-right">{presentCount}</TableCell>
                      <TableCell className="hidden md:table-cell text-right">
                        {session.assignments.length}
                      </TableCell>
                      <TableCell>
                        <SessionStatusBadge status={session.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceReports;
