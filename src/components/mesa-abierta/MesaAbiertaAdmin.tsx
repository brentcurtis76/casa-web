import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Play, Users, Calendar, TrendingUp, Mail, Send, MessageCircle, Pencil, Trash2, RotateCcw, Home, UtensilsCrossed } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CreateMonthDialog } from './CreateMonthDialog';
import { EditMonthDialog } from './EditMonthDialog';

interface Month {
  id: string;
  month_date: string;
  dinner_date: string;
  registration_deadline: string;
  dinner_time: string;
  status: string;
}

interface DietaryRestriction {
  id: string;
  restriction_type: string;
  description?: string;
  severity: string;
  is_plus_one: boolean;
}

interface Participant {
  id: string;
  role_preference: string;
  assigned_role: string | null;
  has_plus_one: boolean;
  status: string;
  user_id: string;
  phone_number?: string;
  host_address?: string;
  host_max_guests?: number;
  plus_one_name?: string;
  mesa_abierta_dietary_restrictions?: DietaryRestriction[];
  full_name?: string;
  email?: string;
}

interface MatchResult {
  success: boolean;
  message: string;
  results?: {
    totalMatches: number;
    totalParticipants: number;
    hostsUsed: number;
    hostsConverted: number;
    guestsAssigned: number;
    guestsUnassigned: number;
    newConnectionsCreated: boolean;
    matchDetails: Array<{
      matchNumber: number;
      hostId: string;
      guestCount: number;
    }>;
    unassignedGuests?: string[];
  };
  error?: string;
}

interface DinnerMatch {
  id: string;
  dinner_date: string;
  dinner_time: string;
  guest_count: number;
  host: {
    id: string;
    full_name: string;
    phone_number?: string;
    host_address?: string;
    has_plus_one: boolean;
  };
  guests: Array<{
    id: string;
    full_name: string;
    phone_number?: string;
    has_plus_one: boolean;
    plus_one_name?: string;
    food_assignment: string;
    dietary_restrictions: DietaryRestriction[];
  }>;
}

export const MesaAbiertaAdmin = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingWhatsApp, setLoadingWhatsApp] = useState(false);
  const [months, setMonths] = useState<Month[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Month | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreateMonth, setShowCreateMonth] = useState(false);
  const [editMonth, setEditMonth] = useState<Month | null>(null);
  const [deleteMonth, setDeleteMonth] = useState<Month | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false);
  const [unmatching, setUnmatching] = useState(false);
  const [dinnerMatches, setDinnerMatches] = useState<DinnerMatch[]>([]);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('mesa_abierta_admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (data && !error) {
        setIsAdmin(true);
      }
    };

    checkAdminStatus();
  }, [user]);

  // Fetch months
  useEffect(() => {
    fetchMonths();
  }, []);

  // Fetch participants and matches when month changes
  useEffect(() => {
    if (selectedMonth) {
      fetchParticipants(selectedMonth.id);
      if (selectedMonth.status === 'matched') {
        fetchDinnerMatches(selectedMonth.id);
      } else {
        setDinnerMatches([]);
      }
    }
  }, [selectedMonth]);

  const fetchMonths = async () => {
    const { data, error } = await supabase
      .from('mesa_abierta_months')
      .select('*')
      .order('dinner_date', { ascending: false });

    if (data && !error) {
      setMonths(data);
      if (data.length > 0 && !selectedMonth) {
        setSelectedMonth(data[0]);
      }
    }
  };

  const fetchParticipants = async (monthId: string) => {
    // First fetch participants
    const { data, error } = await supabase
      .from('mesa_abierta_participants')
      .select(`
        id,
        role_preference,
        assigned_role,
        has_plus_one,
        status,
        user_id,
        email,
        phone_number,
        host_address,
        host_max_guests,
        plus_one_name
      `)
      .eq('month_id', monthId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching participants:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los participantes',
        variant: 'destructive',
      });
      return;
    }

    if (data) {
      // Fetch user names for all participants
      const userIds = data.map(p => p.user_id);
      const participantIds = data.map(p => p.id);

      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      // Fetch dietary restrictions for all participants
      const { data: dietaryData } = await supabase
        .from('mesa_abierta_dietary_restrictions')
        .select('*')
        .in('participant_id', participantIds);

      // Merge user data and dietary restrictions with participant data
      const participantsWithDetails = data.map(participant => {
        const user = users?.find(u => u.id === participant.user_id);
        const restrictions = dietaryData?.filter(d => d.participant_id === participant.id) || [];
        return {
          ...participant,
          full_name: user?.full_name || 'Sin nombre',
          mesa_abierta_dietary_restrictions: restrictions,
        };
      });

      setParticipants(participantsWithDetails as any);
    }
  };

  const fetchDinnerMatches = async (monthId: string) => {
    try {
      // Fetch matches with host participant info
      const { data: matches, error: matchesError } = await supabase
        .from('mesa_abierta_matches')
        .select('*')
        .eq('month_id', monthId)
        .order('created_at', { ascending: true });

      if (matchesError) {
        console.error('Error fetching matches:', matchesError);
        return;
      }

      if (!matches || matches.length === 0) {
        setDinnerMatches([]);
        return;
      }

      // Get all host participant IDs
      const hostParticipantIds = matches.map(m => m.host_participant_id);

      // Fetch host participants
      const { data: hostParticipants } = await supabase
        .from('mesa_abierta_participants')
        .select('id, user_id, phone_number, host_address, has_plus_one')
        .in('id', hostParticipantIds);

      // Get host user IDs for profile lookup
      const hostUserIds = hostParticipants?.map(p => p.user_id) || [];
      const { data: hostProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', hostUserIds);

      // Fetch assignments for all matches
      const matchIds = matches.map(m => m.id);
      const { data: assignments } = await supabase
        .from('mesa_abierta_assignments')
        .select('*')
        .in('match_id', matchIds);

      // Get guest participant IDs from assignments
      const guestParticipantIds = assignments?.map(a => a.guest_participant_id) || [];

      // Fetch guest participants
      const { data: guestParticipants } = await supabase
        .from('mesa_abierta_participants')
        .select('id, user_id, phone_number, has_plus_one, plus_one_name')
        .in('id', guestParticipantIds);

      // Get guest user IDs for profile lookup
      const guestUserIds = guestParticipants?.map(p => p.user_id) || [];
      const { data: guestProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', guestUserIds);

      // Fetch dietary restrictions for all guests
      const { data: dietaryRestrictions } = await supabase
        .from('mesa_abierta_dietary_restrictions')
        .select('*')
        .in('participant_id', guestParticipantIds);

      // Build the dinner matches with all details
      const dinnerMatchesData: DinnerMatch[] = matches.map(match => {
        const hostParticipant = hostParticipants?.find(p => p.id === match.host_participant_id);
        const hostProfile = hostProfiles?.find(p => p.id === hostParticipant?.user_id);

        const matchAssignments = assignments?.filter(a => a.match_id === match.id) || [];
        const guests = matchAssignments.map(assignment => {
          const guestParticipant = guestParticipants?.find(p => p.id === assignment.guest_participant_id);
          const guestProfile = guestProfiles?.find(p => p.id === guestParticipant?.user_id);
          const guestDietaryRestrictions = dietaryRestrictions?.filter(
            d => d.participant_id === assignment.guest_participant_id
          ) || [];

          return {
            id: assignment.guest_participant_id,
            full_name: guestProfile?.full_name || 'Sin nombre',
            phone_number: guestParticipant?.phone_number,
            has_plus_one: guestParticipant?.has_plus_one || false,
            plus_one_name: guestParticipant?.plus_one_name,
            food_assignment: assignment.food_assignment,
            dietary_restrictions: guestDietaryRestrictions,
          };
        });

        return {
          id: match.id,
          dinner_date: match.dinner_date,
          dinner_time: match.dinner_time,
          guest_count: match.guest_count,
          host: {
            id: match.host_participant_id,
            full_name: hostProfile?.full_name || 'Sin nombre',
            phone_number: hostParticipant?.phone_number,
            host_address: hostParticipant?.host_address,
            has_plus_one: hostParticipant?.has_plus_one || false,
          },
          guests,
        };
      });

      setDinnerMatches(dinnerMatchesData);
    } catch (error) {
      console.error('Error fetching dinner matches:', error);
    }
  };

  const handleDeleteMonth = async () => {
    if (!deleteMonth) return;

    setDeleting(true);
    try {
      // Get match IDs for this month first
      const { data: matches } = await supabase
        .from('mesa_abierta_matches')
        .select('id')
        .eq('month_id', deleteMonth.id);

      // Delete assignments for those matches
      if (matches && matches.length > 0) {
        const matchIds = matches.map(m => m.id);
        await supabase
          .from('mesa_abierta_assignments')
          .delete()
          .in('match_id', matchIds);
      }

      // Delete matches
      await supabase
        .from('mesa_abierta_matches')
        .delete()
        .eq('month_id', deleteMonth.id);

      // Get participant IDs for this month
      const { data: participantData } = await supabase
        .from('mesa_abierta_participants')
        .select('id')
        .eq('month_id', deleteMonth.id);

      // Delete dietary restrictions for those participants
      if (participantData && participantData.length > 0) {
        const participantIds = participantData.map(p => p.id);
        await supabase
          .from('mesa_abierta_dietary_restrictions')
          .delete()
          .in('participant_id', participantIds);
      }

      // Delete participants
      await supabase
        .from('mesa_abierta_participants')
        .delete()
        .eq('month_id', deleteMonth.id);

      // Finally delete the month
      const { error: monthError } = await supabase
        .from('mesa_abierta_months')
        .delete()
        .eq('id', deleteMonth.id);

      if (monthError) throw monthError;

      toast({
        title: 'Mes eliminado',
        description: 'El mes y todos sus datos han sido eliminados exitosamente.',
      });

      // If we deleted the selected month, clear selection
      if (selectedMonth?.id === deleteMonth.id) {
        setSelectedMonth(null);
        setParticipants([]);
      }

      // Refresh months list
      await fetchMonths();
    } catch (error: any) {
      console.error('Error deleting month:', error);
      toast({
        title: 'Error',
        description: error.message || 'Error al eliminar el mes',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteMonth(null);
    }
  };

  const runMatching = async () => {
    if (!selectedMonth) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona un mes',
        variant: 'destructive',
      });
      return;
    }

    if (selectedMonth.status !== 'open') {
      toast({
        title: 'Error',
        description: `El mes debe estar en estado 'open'. Estado actual: ${selectedMonth.status}`,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setMatchResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('create-mesa-matches', {
        body: { monthId: selectedMonth.id },
      });

      if (error) {
        throw error;
      }

      setMatchResult(data as MatchResult);

      if (data.success) {
        toast({
          title: '¡Éxito!',
          description: `Matching completado: ${data.results?.totalMatches} cenas creadas`,
        });

        // Refresh data and update selected month
        await fetchMonths();

        // Fetch updated month status
        const { data: updatedMonth } = await supabase
          .from('mesa_abierta_months')
          .select('*')
          .eq('id', selectedMonth.id)
          .single();

        if (updatedMonth) {
          setSelectedMonth(updatedMonth);
          // Fetch dinner matches after successful matching
          await fetchDinnerMatches(selectedMonth.id);
        }

        await fetchParticipants(selectedMonth.id);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Error al ejecutar matching',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Error al ejecutar matching',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnmatch = async () => {
    if (!selectedMonth) return;

    setUnmatching(true);
    try {
      // Get match IDs for this month
      const { data: matches } = await supabase
        .from('mesa_abierta_matches')
        .select('id')
        .eq('month_id', selectedMonth.id);

      // Delete assignments for those matches
      if (matches && matches.length > 0) {
        const matchIds = matches.map(m => m.id);
        await supabase
          .from('mesa_abierta_assignments')
          .delete()
          .in('match_id', matchIds);
      }

      // Delete all matches for this month
      await supabase
        .from('mesa_abierta_matches')
        .delete()
        .eq('month_id', selectedMonth.id);

      // Reset all participants back to pending status and clear assigned_role
      await supabase
        .from('mesa_abierta_participants')
        .update({ status: 'pending', assigned_role: null })
        .eq('month_id', selectedMonth.id);

      // Update month status back to open
      const { error: monthError } = await supabase
        .from('mesa_abierta_months')
        .update({ status: 'open' })
        .eq('id', selectedMonth.id);

      if (monthError) throw monthError;

      toast({
        title: 'Matching deshecho',
        description: 'El mes ha sido reiniciado. Puedes ejecutar el algoritmo de matching nuevamente.',
      });

      // Refresh data
      await fetchMonths();
      const { data: updatedMonth } = await supabase
        .from('mesa_abierta_months')
        .select('*')
        .eq('id', selectedMonth.id)
        .single();

      if (updatedMonth) {
        setSelectedMonth(updatedMonth);
      }
      await fetchParticipants(selectedMonth.id);
      setMatchResult(null);
      setDinnerMatches([]);
    } catch (error: any) {
      console.error('Error unmatching:', error);
      toast({
        title: 'Error',
        description: error.message || 'Error al deshacer el matching',
        variant: 'destructive',
      });
    } finally {
      setUnmatching(false);
      setShowUnmatchConfirm(false);
    }
  };

  const sendNotifications = async () => {
    if (!selectedMonth) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona un mes',
        variant: 'destructive',
      });
      return;
    }

    if (selectedMonth.status !== 'matched') {
      toast({
        title: 'Error',
        description: 'Debes ejecutar el matching antes de enviar notificaciones',
        variant: 'destructive',
      });
      return;
    }

    setLoadingNotifications(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-mesa-notifications', {
        body: { monthId: selectedMonth.id },
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast({
          title: '¡Éxito!',
          description: `Notificaciones enviadas: ${data.results?.emailsSent} emails exitosos, ${data.results?.emailsFailed} fallidos`,
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Error al enviar notificaciones',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Error al enviar notificaciones',
        variant: 'destructive',
      });
    } finally {
      setLoadingNotifications(false);
    }
  };

  const sendWhatsAppNotifications = async () => {
    if (!selectedMonth) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona un mes',
        variant: 'destructive',
      });
      return;
    }

    if (selectedMonth.status !== 'matched') {
      toast({
        title: 'Error',
        description: 'Debes ejecutar el matching antes de enviar notificaciones',
        variant: 'destructive',
      });
      return;
    }

    setLoadingWhatsApp(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-mesa-whatsapp', {
        body: { monthId: selectedMonth.id },
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast({
          title: '¡Éxito!',
          description: `WhatsApp enviados: ${data.results?.messagesSent} mensajes exitosos, ${data.results?.messagesFailed} fallidos`,
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Error al enviar mensajes de WhatsApp',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Error al enviar mensajes de WhatsApp',
        variant: 'destructive',
      });
    } finally {
      setLoadingWhatsApp(false);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Acceso Denegado</AlertTitle>
            <AlertDescription>
              Debes iniciar sesión para acceder al panel de administración.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Acceso Denegado</AlertTitle>
            <AlertDescription>
              No tienes permisos de administrador para acceder a esta página.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const stats = {
    total: participants.length,
    hosts: participants.filter((p) => p.role_preference === 'host').length,
    guests: participants.filter((p) => p.role_preference === 'guest').length,
    pending: participants.filter((p) => p.status === 'pending').length,
    confirmed: participants.filter((p) => p.status === 'confirmed').length,
    plusOnes: participants.filter((p) => p.has_plus_one).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-casa-700">Panel de Administración</h2>
          <p className="text-muted-foreground">Gestiona eventos y participantes de La Mesa Abierta</p>
        </div>
        <Button onClick={() => setShowCreateMonth(true)} size="lg" className="w-full sm:w-auto">
          <Calendar className="h-4 w-4 mr-2" />
          Crear Nuevo Mes
        </Button>
      </div>

      {/* Create Month Dialog */}
      {showCreateMonth && (
        <CreateMonthDialog
          open={showCreateMonth}
          onClose={() => setShowCreateMonth(false)}
          onSuccess={() => {
            setShowCreateMonth(false);
            fetchMonths();
          }}
        />
      )}

      {/* Edit Month Dialog */}
      {editMonth && (
        <EditMonthDialog
          open={!!editMonth}
          month={editMonth}
          onClose={() => setEditMonth(null)}
          onSuccess={() => {
            setEditMonth(null);
            fetchMonths();
            // Update selectedMonth if it was the one edited
            if (selectedMonth?.id === editMonth.id) {
              supabase
                .from('mesa_abierta_months')
                .select('*')
                .eq('id', editMonth.id)
                .single()
                .then(({ data }) => {
                  if (data) setSelectedMonth(data);
                });
            }
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteMonth} onOpenChange={(open) => !open && setDeleteMonth(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este mes?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán permanentemente:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>La configuración del mes</li>
                <li>Todos los participantes registrados</li>
                <li>Todos los matches y asignaciones</li>
                <li>Las restricciones dietéticas asociadas</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMonth}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unmatch Confirmation Dialog */}
      <AlertDialog open={showUnmatchConfirm} onOpenChange={setShowUnmatchConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deshacer el matching?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará todos los matches y asignaciones actuales:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Se eliminarán todas las cenas asignadas</li>
                <li>Los participantes volverán a estado "pendiente"</li>
                <li>El mes volverá a estado "open"</li>
                <li>Podrás ejecutar el algoritmo de matching nuevamente</li>
              </ul>
              <p className="mt-2 font-medium text-orange-600">
                Nota: Los participantes NO serán eliminados, solo sus asignaciones.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unmatching}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnmatch}
              disabled={unmatching}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {unmatching ? 'Deshaciendo...' : 'Deshacer Matching'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Month Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Seleccionar Mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {months.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay meses creados aún.</p>
              <p className="text-sm">Haz clic en "Crear Nuevo Mes" para comenzar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {months.map((month) => (
                <div
                  key={month.id}
                  className={`relative border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedMonth?.id === month.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted'
                  }`}
                  onClick={() => setSelectedMonth(month)}
                >
                  <div className="text-left w-full pr-16">
                    <div className="font-semibold">
                      {new Date(month.dinner_date + 'T12:00:00').toLocaleDateString('es-ES', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                    <div className={`text-sm ${selectedMonth?.id === month.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                      Cena: {new Date(month.dinner_date + 'T12:00:00').toLocaleDateString('es-ES')}
                    </div>
                    <Badge
                      variant={month.status === 'open' ? 'default' : 'secondary'}
                      className={`mt-2 ${selectedMonth?.id === month.id ? 'bg-primary-foreground text-primary' : ''}`}
                    >
                      {month.status}
                    </Badge>
                  </div>
                  {/* Edit and Delete buttons */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${selectedMonth?.id === month.id ? 'hover:bg-primary-foreground/20' : 'hover:bg-muted'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditMonth(month);
                      }}
                      title="Editar mes"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${selectedMonth?.id === month.id ? 'hover:bg-destructive/20 text-destructive-foreground' : 'hover:bg-destructive/10 text-destructive'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteMonth(month);
                      }}
                      title="Eliminar mes"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedMonth && (
        <Tabs defaultValue={selectedMonth.status === 'matched' ? 'dinners' : 'matching'} className="space-y-4">
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:grid-cols-5">
              <TabsTrigger value="matching" className="whitespace-nowrap">
                <Play className="h-4 w-4 mr-2" />
                Matching
              </TabsTrigger>
              <TabsTrigger value="dinners" disabled={selectedMonth.status !== 'matched'} className="whitespace-nowrap">
                <UtensilsCrossed className="h-4 w-4 mr-2" />
                Cenas
              </TabsTrigger>
              <TabsTrigger value="participants" className="whitespace-nowrap">
                <Users className="h-4 w-4 mr-2" />
                Participantes
              </TabsTrigger>
              <TabsTrigger value="statistics" className="whitespace-nowrap">
                <TrendingUp className="h-4 w-4 mr-2" />
                Estadísticas
              </TabsTrigger>
              <TabsTrigger value="communication" className="whitespace-nowrap">
                <Mail className="h-4 w-4 mr-2" />
                Comunicación
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Matching Tab */}
          <TabsContent value="matching" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Ejecutar Algoritmo de Matching</CardTitle>
                <CardDescription>
                  Asigna invitados a anfitriones para el mes seleccionado
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Importante</AlertTitle>
                  <AlertDescription>
                    El algoritmo solo funciona con meses en estado 'open'. Asegúrate de tener
                    suficientes anfitriones e invitados antes de ejecutar.
                  </AlertDescription>
                </Alert>

                <div className="flex items-center gap-4 flex-wrap">
                  <Button
                    onClick={runMatching}
                    disabled={loading || selectedMonth.status !== 'open'}
                    size="lg"
                    className="bg-casa-700 hover:bg-casa-800"
                  >
                    {loading ? 'Ejecutando...' : 'Ejecutar Matching'}
                  </Button>
                  {selectedMonth.status === 'matched' && (
                    <Button
                      onClick={() => setShowUnmatchConfirm(true)}
                      disabled={unmatching}
                      size="lg"
                      variant="outline"
                      className="border-orange-500 text-orange-600 hover:bg-orange-50"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {unmatching ? 'Deshaciendo...' : 'Deshacer Matching'}
                    </Button>
                  )}
                  <Badge variant={selectedMonth.status === 'open' ? 'default' : 'secondary'}>
                    Estado: {selectedMonth.status}
                  </Badge>
                </div>

                {matchResult && (
                  <div className="mt-6 space-y-4">
                    {matchResult.success ? (
                      <>
                        <Alert className="bg-green-50 border-green-200">
                          <AlertTitle className="text-green-800">¡Éxito!</AlertTitle>
                          <AlertDescription className="text-green-700">
                            {matchResult.message}
                          </AlertDescription>
                        </Alert>

                        <Card>
                          <CardHeader>
                            <CardTitle>Resultados del Matching</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              <div>
                                <div className="text-2xl font-bold text-casa-700">
                                  {matchResult.results?.totalMatches}
                                </div>
                                <div className="text-sm text-muted-foreground">Cenas Creadas</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-casa-700">
                                  {matchResult.results?.hostsUsed}
                                </div>
                                <div className="text-sm text-muted-foreground">Anfitriones Usados</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-orange-600">
                                  {matchResult.results?.hostsConvertedToGuests}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Anfitriones Convertidos
                                </div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-casa-700">
                                  {matchResult.results?.guestsAssigned}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Invitados Asignados
                                </div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-red-600">
                                  {matchResult.results?.guestsUnassigned}
                                </div>
                                <div className="text-sm text-muted-foreground">No Asignados</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-casa-700">
                                  {matchResult.results?.totalParticipants}
                                </div>
                                <div className="text-sm text-muted-foreground">Total Participantes</div>
                              </div>
                            </div>

                            {matchResult.results?.matchDetails && matchResult.results.matchDetails.length > 0 && (
                              <div className="mt-6">
                                <h4 className="font-semibold mb-3">Detalles de las Cenas</h4>
                                <div className="space-y-2">
                                  {matchResult.results.matchDetails.map((match) => (
                                    <div
                                      key={match.matchNumber}
                                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                                    >
                                      <span className="font-medium">Cena #{match.matchNumber}</span>
                                      <span className="text-sm text-muted-foreground">
                                        {match.guestCount} invitados
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                      </>
                    ) : (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{matchResult.error || matchResult.message}</AlertDescription>
                      </Alert>
                    )}

                    {matchResult.results?.unassignedGuests && matchResult.results.unassignedGuests.length > 0 && (
                      <div className="mt-6">
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Invitados Sin Asignar</AlertTitle>
                          <AlertDescription>
                            Hay {matchResult.results.unassignedGuests.length} invitados que no pudieron ser asignados debido a falta de capacidad.
                            <ul className="mt-2 list-disc list-inside">
                              {matchResult.results.unassignedGuests.map(id => {
                                const participant = participants.find(p => p.id === id);
                                return (
                                  <li key={id}>
                                    {participant?.full_name || 'Desconocido'}
                                    {participant?.has_plus_one ? ' (+1)' : ''}
                                  </li>
                                );
                              })}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}
                  </div>
                )}

                {/* Send Notifications Button - Show whenever month is matched */}
                {selectedMonth.status === 'matched' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5" />
                        Enviar Notificaciones
                      </CardTitle>
                      <CardDescription>
                        Envía emails a todos los anfitriones e invitados con los detalles de sus asignaciones
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Alert className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Importante</AlertTitle>
                        <AlertDescription>
                          Los emails se enviarán desde onboarding@resend.dev. Puedes enviar notificaciones múltiples veces si es necesario.
                        </AlertDescription>
                      </Alert>
                      <Button
                        onClick={sendNotifications}
                        disabled={loadingNotifications}
                        size="lg"
                        className="bg-green-700 hover:bg-green-800"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {loadingNotifications ? 'Enviando...' : 'Enviar Notificaciones por Email'}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Send WhatsApp Notifications Button - Show whenever month is matched */}
                {selectedMonth.status === 'matched' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-green-600" />
                        Enviar Notificaciones por WhatsApp
                      </CardTitle>
                      <CardDescription>
                        Envía mensajes de WhatsApp a todos los participantes que hayan activado WhatsApp
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Alert className="mb-4">
                        <MessageCircle className="h-4 w-4" />
                        <AlertTitle>Importante</AlertTitle>
                        <AlertDescription>
                          Solo se enviarán mensajes a participantes que hayan proporcionado su número de teléfono y habilitado WhatsApp. Asegúrate de haber configurado las credenciales de Twilio.
                        </AlertDescription>
                      </Alert>
                      <Button
                        onClick={sendWhatsAppNotifications}
                        disabled={loadingWhatsApp}
                        size="lg"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        {loadingWhatsApp ? 'Enviando...' : 'Enviar Mensajes de WhatsApp'}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dinners Tab */}
          <TabsContent value="dinners" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5" />
                  Cenas Asignadas
                </CardTitle>
                <CardDescription>
                  {dinnerMatches.length} cenas creadas para este mes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dinnerMatches.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay cenas asignadas aún.</p>
                    <p className="text-sm">Ejecuta el algoritmo de matching primero.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {dinnerMatches.map((dinner, index) => (
                      <Card key={dinner.id} className="border-2">
                        <CardHeader className="bg-casa-50 border-b">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <span className="bg-casa-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">
                                {index + 1}
                              </span>
                              Cena #{index + 1}
                            </CardTitle>
                            <Badge variant="secondary">
                              {dinner.guests.length} invitados + anfitrión
                              {dinner.host.has_plus_one ? ' (+1)' : ''}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                          {/* Host Section */}
                          <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Home className="h-5 w-5 text-green-700" />
                              <span className="font-semibold text-green-800">Anfitrión</span>
                              {dinner.host.has_plus_one && (
                                <Badge variant="outline" className="text-green-700 border-green-300">+1</Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="font-medium">Nombre:</span> {dinner.host.full_name}
                              </div>
                              {dinner.host.phone_number && (
                                <div>
                                  <span className="font-medium">Teléfono:</span> {dinner.host.phone_number}
                                </div>
                              )}
                              {dinner.host.host_address && (
                                <div className="col-span-full">
                                  <span className="font-medium">Dirección:</span> {dinner.host.host_address}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Guests Section */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Users className="h-5 w-5 text-casa-700" />
                              <span className="font-semibold">Invitados ({dinner.guests.length})</span>
                            </div>
                            <div className="space-y-3">
                              {dinner.guests.map((guest) => (
                                <div key={guest.id} className="p-3 bg-muted rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{guest.full_name}</span>
                                      {guest.has_plus_one && (
                                        <Badge variant="outline" className="text-xs">
                                          +1: {guest.plus_one_name || 'Acompañante'}
                                        </Badge>
                                      )}
                                    </div>
                                    <Badge variant="secondary" className="capitalize">
                                      {guest.food_assignment === 'main_course' ? 'Plato Principal' :
                                       guest.food_assignment === 'salad' ? 'Ensalada' :
                                       guest.food_assignment === 'drinks' ? 'Bebidas' :
                                       guest.food_assignment === 'dessert' ? 'Postre' : guest.food_assignment}
                                    </Badge>
                                  </div>
                                  {guest.phone_number && (
                                    <div className="text-sm text-muted-foreground">
                                      Tel: {guest.phone_number}
                                    </div>
                                  )}
                                  {guest.dietary_restrictions.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {guest.dietary_restrictions.map((restriction) => (
                                        <Badge
                                          key={restriction.id}
                                          variant={restriction.severity === 'allergy' ? 'destructive' : 'outline'}
                                          className="text-xs"
                                        >
                                          {restriction.is_plus_one ? '(+1) ' : ''}
                                          {restriction.description || restriction.restriction_type}
                                          {restriction.severity === 'allergy' && ' ⚠️'}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Participants Tab */}
          <TabsContent value="participants" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Participantes</CardTitle>
                <CardDescription>
                  {participants.length} participantes registrados para este mes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="p-4 bg-muted rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={participant.role_preference === 'host' ? 'default' : 'secondary'}>
                            {participant.role_preference === 'host' ? 'Anfitrión' : 'Invitado'}
                          </Badge>
                          {participant.assigned_role && participant.assigned_role !== participant.role_preference && (
                            <Badge variant="outline">
                              Asignado como: {participant.assigned_role === 'host' ? 'Anfitrión' : 'Invitado'}
                            </Badge>
                          )}
                          {participant.has_plus_one && (
                            <Badge variant="outline">+1</Badge>
                          )}
                        </div>
                        <Badge variant="outline">{participant.status}</Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-semibold">Nombre:</span> {participant.full_name}
                        </div>
                        <div>
                          <span className="font-semibold">Email:</span> {participant.email}
                        </div>
                        {participant.phone_number && (
                          <div>
                            <span className="font-semibold">Teléfono:</span> {participant.phone_number}
                          </div>
                        )}
                        {participant.host_address && (
                          <div>
                            <span className="font-semibold">Dirección:</span> {participant.host_address}
                          </div>
                        )}
                        {participant.mesa_abierta_dietary_restrictions && participant.mesa_abierta_dietary_restrictions.filter(r => !r.is_plus_one).length > 0 && (
                          <div className="col-span-full">
                            <span className="font-semibold">Restricciones:</span>{' '}
                            {participant.mesa_abierta_dietary_restrictions
                              .filter(r => !r.is_plus_one)
                              .map(r => r.description || r.restriction_type)
                              .join(', ')}
                          </div>
                        )}
                        {participant.has_plus_one && participant.plus_one_name && (
                          <div className="col-span-full">
                            <span className="font-semibold">Acompañante:</span> {participant.plus_one_name}
                            {participant.mesa_abierta_dietary_restrictions && participant.mesa_abierta_dietary_restrictions.filter(r => r.is_plus_one).length > 0 && (
                              <span className="text-muted-foreground">
                                {' '}({participant.mesa_abierta_dietary_restrictions
                                  .filter(r => r.is_plus_one)
                                  .map(r => r.description || r.restriction_type)
                                  .join(', ')})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="statistics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Total Participantes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-casa-700">{stats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Anfitriones</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-casa-700">{stats.hosts}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Invitados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-casa-700">{stats.guests}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Confirmados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{stats.confirmed}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pendientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">{stats.pending}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Con +1</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-casa-700">{stats.plusOnes}</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Communication Tab */}
          <TabsContent value="communication" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Comunicación con Participantes</CardTitle>
                <CardDescription>
                  Herramientas para contactar a los participantes (próximamente)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertTitle>Próximamente</AlertTitle>
                  <AlertDescription>
                    Funcionalidades de comunicación masiva estarán disponibles próximamente.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
