/**
 * ChildrenCalendar — Orchestrates the Calendar tab
 * Manages month navigation, view toggle (month/list), and dialogs
 */

import { useState, useEffect } from 'react';
import { addMonths, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCalendarSessions } from '@/lib/children-ministry/calendarService';
import { getAgeGroups } from '@/lib/children-ministry/ageGroupService';
import CalendarMonthGrid from './CalendarMonthGrid';
import CalendarListView from './CalendarListView';
import SessionDetailSheet from './SessionDetailSheet';
import SessionEditDialog from './SessionEditDialog';
import type { ChildrenCalendarFull, ChildrenAgeGroupRow } from '@/types/childrenMinistry';

interface ChildrenCalendarProps {
  canWrite: boolean;
  isVolunteerOnly: boolean;
}

const ChildrenCalendar = ({ canWrite, isVolunteerOnly }: ChildrenCalendarProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
  const [sessions, setSessions] = useState<ChildrenCalendarFull[]>([]);
  const [ageGroups, setAgeGroups] = useState<ChildrenAgeGroupRow[]>([]);

  // Detail and edit dialogs
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Load age groups on mount
  useEffect(() => {
    const loadAgeGroups = async () => {
      try {
        const groups = await getAgeGroups();
        setAgeGroups(groups);
      } catch {
        // Silently fail on age group load
      }
    };

    loadAgeGroups();
  }, []);

  // Load sessions for current month
  useEffect(() => {
    const loadSessions = async () => {
      setLoading(true);
      try {
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
          .toISOString()
          .split('T')[0];
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
          .toISOString()
          .split('T')[0];

        const data = await getCalendarSessions({
          from: monthStart,
          to: monthEnd,
        });

        // Filter if volunteer-only: show only sessions with this user assigned
        // Note: In production, you'd filter by current user ID from auth context
        setSessions(data);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las clases',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [currentMonth, toast]);

  const handleDetailOpen = (id: string) => {
    setSelectedSessionId(id);
    setDetailOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedSessionId(null);
    setEditDialogOpen(true);
  };

  const handleSuccess = () => {
    const loadSessions = async () => {
      try {
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
          .toISOString()
          .split('T')[0];
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
          .toISOString()
          .split('T')[0];

        const data = await getCalendarSessions({
          from: monthStart,
          to: monthEnd,
        });

        setSessions(data);
      } catch {
        // Silently fail on reload
      }
    };

    loadSessions();
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Month navigator */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold min-w-[200px] text-center">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* View toggle and create button */}
        <div className="flex gap-2">
          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('month')}
            >
              Mes
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              Lista
            </Button>
          </div>

          {canWrite && (
            <Button onClick={handleCreateNew} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Clase
            </Button>
          )}
        </div>
      </div>

      {/* Calendar content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Month grid view - shown only on desktop when in month mode */}
          {viewMode === 'month' && (
            <div className="hidden md:block">
              <CalendarMonthGrid
                sessions={sessions}
                currentMonth={currentMonth}
                onSessionClick={handleDetailOpen}
              />
            </div>
          )}

          {/* List view - shown on mobile always, or desktop when explicitly toggled */}
          {viewMode === 'list' && (
            <CalendarListView sessions={sessions} onSessionClick={handleDetailOpen} />
          )}

          {/* Fallback: show list on mobile when month view is toggled */}
          {viewMode === 'month' && (
            <div className="md:hidden">
              <CalendarListView sessions={sessions} onSessionClick={handleDetailOpen} />
            </div>
          )}
        </>
      )}

      {/* Detail sheet */}
      <SessionDetailSheet
        sessionId={selectedSessionId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canWrite={canWrite}
        onUpdated={handleSuccess}
        ageGroups={ageGroups}
      />

      {/* Edit dialog */}
      <SessionEditDialog
        sessionId={undefined}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleSuccess}
        ageGroups={ageGroups}
      />
    </div>
  );
};

export default ChildrenCalendar;
