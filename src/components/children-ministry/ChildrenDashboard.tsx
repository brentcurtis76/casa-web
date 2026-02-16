/**
 * ChildrenDashboard — Coordinator and volunteer dashboard
 * Coordinator view: 4 summary cards, upcoming sessions, low-stock items, attendance chart
 * Volunteer view: own sessions, availability editor
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { BookOpen, Calendar, Users, ClipboardCheck, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AgeGroupBadge from './AgeGroupBadge';
import AvailabilityEditor from './AvailabilityEditor';
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { getLessons } from '@/lib/children-ministry/lessonService';
import { getCalendarSessions, getUpcomingSessions } from '@/lib/children-ministry/calendarService';
import { getVolunteers, getMyVolunteerProfile } from '@/lib/children-ministry/volunteerService';
import { getAttendanceSummary } from '@/lib/children-ministry/attendanceService';
import { getLowStockItems } from '@/lib/children-ministry/inventoryService';
import type { ChildrenCalendarFull, ChildrenInventoryRow, ChildrenVolunteerRow } from '@/types/childrenMinistry';

interface ChildrenDashboardProps {
  canWrite: boolean;
  isVolunteerOnly: boolean;
  userId?: string;
}

const ChildrenDashboard = ({ canWrite, isVolunteerOnly, userId }: ChildrenDashboardProps) => {
  const { user } = useAuth();
  const effectiveUserId = userId || user?.id;

  // Coordinator view state
  const [activeLessons, setActiveLessons] = useState(0);
  const [upcomingSessions, setUpcomingSessions] = useState(0);
  const [activeVolunteers, setActiveVolunteers] = useState(0);
  const [avgAttendance, setAvgAttendance] = useState(0);
  const [sessions, setSessions] = useState<ChildrenCalendarFull[]>([]);
  const [lowStockItems, setLowStockItems] = useState<ChildrenInventoryRow[]>([]);
  const [chartData, setChartData] = useState<{ date: string; count: number }[]>([]);

  // Volunteer view state
  const [volunteerProfile, setVolunteerProfile] = useState<ChildrenVolunteerRow | null>(null);
  const [volunteerSessions, setVolunteerSessions] = useState<ChildrenCalendarFull[]>([]);
  const [volunteerLoading, setVolunteerLoading] = useState(isVolunteerOnly);

  // General
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isVolunteerOnly) {
      loadVolunteerView();
    } else {
      loadCoordinatorView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVolunteerOnly]);

  const loadCoordinatorView = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const [lessons, sessionCount, volunteers, attendance, upcomingList, lowStocks, chartSummary] =
        await Promise.all([
          getLessons({ status: 'ready' }),
          getCalendarSessions({ from: today, to: weekFromNow, status: 'scheduled' }),
          getVolunteers({ is_active: true }),
          getAttendanceSummary(fourWeeksAgo, today),
          getUpcomingSessions(5),
          getLowStockItems(),
          getAttendanceSummary(eightWeeksAgo, today),
        ]);

      setActiveLessons(lessons.length);
      setUpcomingSessions(sessionCount.length);
      setActiveVolunteers(volunteers.length);

      if (attendance.length > 0) {
        const totalCount = attendance.reduce((sum, item) => sum + item.count, 0);
        const avg = Math.round(totalCount / attendance.length);
        setAvgAttendance(avg);
      } else {
        setAvgAttendance(0);
      }

      setSessions(upcomingList);
      setLowStockItems(lowStocks);
      setChartData(chartSummary);
    } catch {
      // Silently handle coordinator dashboard load errors
    } finally {
      setLoading(false);
    }
  };

  const loadVolunteerView = async () => {
    try {
      setVolunteerLoading(true);
      if (!effectiveUserId) {
        setVolunteerProfile(null);
        return;
      }

      const profile = await getMyVolunteerProfile(effectiveUserId);
      setVolunteerProfile(profile);

      if (profile) {
        const allSessions = await getUpcomingSessions();
        const userSessions = allSessions.filter((session) =>
          session.assignments.some((a) => a.volunteer_id === profile.id)
        );
        setVolunteerSessions(userSessions);
      }
    } catch {
      // Silently handle volunteer view load errors
    } finally {
      setVolunteerLoading(false);
    }
  };

  if (isVolunteerOnly) {
    return (
      <div className="space-y-6">
        {volunteerLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !volunteerProfile ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  No estás registrado como voluntario
                </h3>
                <p className="text-gray-500">Contacta al coordinador para registrarte.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Mis Próximas Clases</CardTitle>
              </CardHeader>
              <CardContent>
                {volunteerSessions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No tienes clases programadas
                  </div>
                ) : (
                  <div className="space-y-3">
                    {volunteerSessions.map((session) => (
                      <div
                        key={session.id}
                        className="border rounded-lg p-4 flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <div className="font-medium">
                            {format(new Date(session.date), "EEEE d 'de' MMMM", { locale: es })}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {session.start_time} - {session.end_time}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <AgeGroupBadge ageGroup={session.age_group} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Mi Disponibilidad</CardTitle>
              </CardHeader>
              <CardContent>
                <AvailabilityEditor volunteerId={volunteerProfile.id} readOnly={false} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600">Lecciones Activas</p>
                  <p className="text-2xl font-bold mt-1">{activeLessons}</p>
                </div>
                <BookOpen className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600">Próximas Clases (7 días)</p>
                  <p className="text-2xl font-bold mt-1">{upcomingSessions}</p>
                </div>
                <Calendar className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600">Voluntarios Activos</p>
                  <p className="text-2xl font-bold mt-1">{activeVolunteers}</p>
                </div>
                <Users className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600">Asistencia Promedio</p>
                  <p className="text-2xl font-bold mt-1">
                    {avgAttendance}
                    <span className="text-sm font-normal text-gray-600 ml-1">niños/clase</span>
                  </p>
                </div>
                <ClipboardCheck className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upcoming Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Próximas Clases</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No hay clases programadas</p>
              <Button variant="outline">Programar clase</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">
                        {format(new Date(session.date), "EEEE d 'de' MMMM", { locale: es })}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {session.start_time} - {session.end_time}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <AgeGroupBadge ageGroup={session.age_group} />
                        <span className="text-sm text-gray-600">
                          {session.lesson?.title || 'Sin lección'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {session.assignments.length} voluntarios
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Low Stock Items */}
      {!loading && lowStockItems.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Items con Stock Bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded">
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-gray-600">
                      Cantidad: <span className="text-red-600 font-semibold">{item.quantity}</span> /
                      Mínimo: {item.min_quantity}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Reabastecer
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Asistencia Reciente (últimas 8 semanas)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-80 w-full" />
          ) : chartData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No hay datos de asistencia aún
            </div>
          ) : (
            <ChartContainer config={{ attendance: { label: 'Niños presentes', color: '#D4A853' } } as ChartConfig} className="h-[300px] w-full">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), 'dd/MM')}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-attendance)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ChildrenDashboard;
