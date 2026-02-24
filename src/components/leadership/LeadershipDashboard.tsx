/**
 * LeadershipDashboard — Summary cards, overdue alert, recent activity
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Calendar, CheckCircle2, Clock, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getUpcomingMeetings,
  getOpenCommitments,
  getOverdueCommitments,
} from '@/lib/leadership/meetingService';
import type { MeetingRow } from '@/types/leadershipModule';

interface CommitmentBasic {
  id: string;
  title: string;
  due_date: string | null;
}

interface CommitmentWithAssignee extends CommitmentBasic {
  assignee_id: string | null;
}

interface LeadershipDashboardProps {
  canWrite: boolean;
  canManage: boolean;
  userId?: string;
  onNavigateToTab?: (tab: string) => void;
}

const LeadershipDashboard = ({ canWrite, canManage, userId, onNavigateToTab }: LeadershipDashboardProps) => {
  const { toast } = useToast();
  const [upcomingMeetings, setUpcomingMeetings] = useState<MeetingRow[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [overdueItems, setOverdueItems] = useState<CommitmentWithAssignee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [upcoming, open, overdue] = await Promise.all([
          getUpcomingMeetings(5),
          getOpenCommitments(),
          getOverdueCommitments(),
        ]);

        setUpcomingMeetings(upcoming);
        setOpenCount(open.length);
        setOverdueItems(overdue as CommitmentWithAssignee[]);
      } catch (_error) {
        toast({
          title: 'Error',
          description: 'No se pudo cargar el dashboard',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [toast]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CL', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const myOverdueItems = userId
    ? overdueItems.filter((item) => item.assignee_id === userId)
    : [];

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => onNavigateToTab?.('reuniones')}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-stone-900"
          >
            <Plus className="h-4 w-4" />
            Nueva Reunión
          </Button>
          <Button
            onClick={() => onNavigateToTab?.('compromisos')}
            variant="outline"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nuevo Compromiso
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximas Reuniones</CardTitle>
            <Calendar className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingMeetings.length}</div>
            <p className="text-xs text-muted-foreground">Próximos 30 días</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compromisos Abiertos</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openCount}</div>
            <p className="text-xs text-muted-foreground">En progreso o pendientes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueItems.length}</div>
            <p className="text-xs text-muted-foreground">Requieren atención</p>
          </CardContent>
        </Card>
      </div>

      {/* Your Overdue Items */}
      {myOverdueItems.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900 text-base">
              <AlertCircle className="h-5 w-5" />
              {myOverdueItems.length}{' '}
              {myOverdueItems.length === 1
                ? 'compromiso tuyo atrasado'
                : 'compromisos tuyos atrasados'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myOverdueItems.slice(0, 3).map((commitment) => (
                <div
                  key={commitment.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-orange-900">{commitment.title}</span>
                  {commitment.due_date && (
                    <Badge variant="destructive">{formatDate(commitment.due_date)}</Badge>
                  )}
                </div>
              ))}
              {myOverdueItems.length > 3 && (
                <p className="text-xs text-orange-700 pt-2">
                  +{myOverdueItems.length - 3} más
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Overdue Alert (admins see all) */}
      {canManage && overdueItems.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900 text-base">
              <AlertCircle className="h-5 w-5" />
              {overdueItems.length}{' '}
              {overdueItems.length === 1 ? 'Compromiso Atrasado (Total)' : 'Compromisos Atrasados (Total)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueItems.slice(0, 3).map((commitment) => (
                <div
                  key={commitment.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-red-900">{commitment.title}</span>
                  {commitment.due_date && (
                    <Badge variant="destructive">{formatDate(commitment.due_date)}</Badge>
                  )}
                </div>
              ))}
              {overdueItems.length > 3 && (
                <p className="text-xs text-red-700 pt-2">
                  +{overdueItems.length - 3} más compromisos atrasados
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Meetings */}
      <Card>
        <CardHeader>
          <CardTitle>Próximas Reuniones</CardTitle>
          <CardDescription>
            {upcomingMeetings.length === 0
              ? 'No hay reuniones programadas'
              : `${upcomingMeetings.length} reuniones próximas`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin reuniones próximas</p>
            ) : (
              upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{meeting.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(meeting.meeting_date)}
                      {meeting.start_time && ` • ${meeting.start_time}`}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-amber-50">
                    Programada
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Overdue commitments detail */}
      {overdueItems.length === 0 && openCount > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-900">
              Todos los compromisos están al día
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LeadershipDashboard;
