import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Play, Users, Calendar, TrendingUp, Mail, Send, MessageCircle, Pencil, Trash2, RotateCcw, Home, UtensilsCrossed, UserPlus, ArrowRightLeft, MoveRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateMonthDialog } from './CreateMonthDialog';
import { EditMonthDialog } from './EditMonthDialog';
import { AddParticipantDialog } from './AddParticipantDialog';
import { EditParticipantDialog } from './EditParticipantDialog';

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
  host_food_assignment?: string;
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
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [editParticipant, setEditParticipant] = useState<Participant | null>(null);
  const [deleteParticipant, setDeleteParticipant] = useState<Participant | null>(null);
  const [deletingParticipant, setDeletingParticipant] = useState(false);

  // Move guest state
  const [moveGuest, setMoveGuest] = useState<{
    guestId: string;
    guestName: string;
    fromMatchId: string;
    fromDinnerNumber: number;
  } | null>(null);
  const [targetMatchId, setTargetMatchId] = useState<string>('');
  const [movingGuest, setMovingGuest] = useState(false);

  // Change food assignment state
  const [changeFoodAssignment, setChangeFoodAssignment] = useState<{
    guestId: string;
    guestName: string;
    matchId: string;
    currentAssignment: string;
  } | null>(null);
  const [newFoodAssignment, setNewFoodAssignment] = useState<string>('');
  const [changingFood, setChangingFood] = useState(false);

  // Convert host to guest state
  const [convertHost, setConvertHost] = useState<{
    hostParticipantId: string;
    hostName: string;
    matchId: string;
  } | null>(null);
  const [targetMatchForHost, setTargetMatchForHost] = useState<string>('');
  const [hostFoodAssignment, setHostFoodAssignment] = useState<string>('');
  const [convertingHost, setConvertingHost] = useState(false);

  // Change host food assignment state
  const [changeHostFoodAssignment, setChangeHostFoodAssignment] = useState<{
    matchId: string;
    hostName: string;
    currentAssignment: string | null;
  } | null>(null);
  const [newHostFoodAssignment, setNewHostFoodAssignment] = useState<string>('');
  const [changingHostFood, setChangingHostFood] = useState(false);

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
          host_food_assignment: match.host_food_assignment,
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

  const handleDeleteParticipant = async () => {
    if (!deleteParticipant) return;

    setDeletingParticipant(true);
    try {
      // First delete dietary restrictions for this participant
      await supabase
        .from('mesa_abierta_dietary_restrictions')
        .delete()
        .eq('participant_id', deleteParticipant.id);

      // Delete any assignments where this participant is a guest
      await supabase
        .from('mesa_abierta_assignments')
        .delete()
        .eq('guest_participant_id', deleteParticipant.id);

      // If this participant is a host with a match, we need to handle that
      const { data: hostMatch } = await supabase
        .from('mesa_abierta_matches')
        .select('id')
        .eq('host_participant_id', deleteParticipant.id)
        .maybeSingle();

      if (hostMatch) {
        // Delete assignments for this match first
        await supabase
          .from('mesa_abierta_assignments')
          .delete()
          .eq('match_id', hostMatch.id);

        // Delete the match
        await supabase
          .from('mesa_abierta_matches')
          .delete()
          .eq('id', hostMatch.id);
      }

      // Finally delete the participant
      const { error } = await supabase
        .from('mesa_abierta_participants')
        .delete()
        .eq('id', deleteParticipant.id);

      if (error) throw error;

      toast({
        title: 'Participante eliminado',
        description: `${deleteParticipant.full_name} ha sido eliminado`,
      });

      // Refresh participants list
      if (selectedMonth) {
        fetchParticipants(selectedMonth.id);
      }
    } catch (error: any) {
      console.error('Error deleting participant:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el participante',
        variant: 'destructive',
      });
    } finally {
      setDeletingParticipant(false);
      setDeleteParticipant(null);
    }
  };

  const handleMoveGuest = async () => {
    if (!moveGuest || !targetMatchId || !selectedMonth) return;

    setMovingGuest(true);
    try {
      // Get the current assignment for this guest
      const { data: currentAssignment, error: fetchError } = await supabase
        .from('mesa_abierta_assignments')
        .select('id, food_assignment')
        .eq('guest_participant_id', moveGuest.guestId)
        .eq('match_id', moveGuest.fromMatchId)
        .single();

      if (fetchError) throw fetchError;

      // Delete the old assignment
      const { error: deleteError } = await supabase
        .from('mesa_abierta_assignments')
        .delete()
        .eq('id', currentAssignment.id);

      if (deleteError) throw deleteError;

      // Create new assignment in target match
      const { error: insertError } = await supabase
        .from('mesa_abierta_assignments')
        .insert({
          match_id: targetMatchId,
          guest_participant_id: moveGuest.guestId,
          food_assignment: currentAssignment.food_assignment,
        });

      if (insertError) throw insertError;

      // Update guest counts on both matches
      const { error: decrementError } = await supabase
        .from('mesa_abierta_matches')
        .update({ guest_count: supabase.rpc('decrement', { x: 1 }) })
        .eq('id', moveGuest.fromMatchId);

      // Get current guest count and update manually
      const { data: fromMatch } = await supabase
        .from('mesa_abierta_matches')
        .select('guest_count')
        .eq('id', moveGuest.fromMatchId)
        .single();

      if (fromMatch) {
        await supabase
          .from('mesa_abierta_matches')
          .update({ guest_count: Math.max(0, fromMatch.guest_count - 1) })
          .eq('id', moveGuest.fromMatchId);
      }

      const { data: toMatch } = await supabase
        .from('mesa_abierta_matches')
        .select('guest_count')
        .eq('id', targetMatchId)
        .single();

      if (toMatch) {
        await supabase
          .from('mesa_abierta_matches')
          .update({ guest_count: toMatch.guest_count + 1 })
          .eq('id', targetMatchId);
      }

      toast({
        title: 'Invitado movido',
        description: `${moveGuest.guestName} ha sido movido a otra cena`,
      });

      // Refresh dinner matches
      await fetchDinnerMatches(selectedMonth.id);
    } catch (error: any) {
      console.error('Error moving guest:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo mover el invitado',
        variant: 'destructive',
      });
    } finally {
      setMovingGuest(false);
      setMoveGuest(null);
      setTargetMatchId('');
    }
  };

  const handleChangeFoodAssignment = async () => {
    if (!changeFoodAssignment || !newFoodAssignment || !selectedMonth) return;

    setChangingFood(true);
    try {
      const { error } = await supabase
        .from('mesa_abierta_assignments')
        .update({ food_assignment: newFoodAssignment })
        .eq('guest_participant_id', changeFoodAssignment.guestId)
        .eq('match_id', changeFoodAssignment.matchId);

      if (error) throw error;

      toast({
        title: 'Asignación actualizada',
        description: `${changeFoodAssignment.guestName} ahora trae ${
          newFoodAssignment === 'main_course' ? 'Plato Principal' :
          newFoodAssignment === 'salad' ? 'Ensalada' :
          newFoodAssignment === 'drinks' ? 'Bebidas' :
          newFoodAssignment === 'dessert' ? 'Postre' : newFoodAssignment
        }`,
      });

      // Refresh dinner matches
      await fetchDinnerMatches(selectedMonth.id);
    } catch (error: any) {
      console.error('Error changing food assignment:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo cambiar la asignación',
        variant: 'destructive',
      });
    } finally {
      setChangingFood(false);
      setChangeFoodAssignment(null);
      setNewFoodAssignment('');
    }
  };

  const handleChangeHostFoodAssignment = async () => {
    if (!changeHostFoodAssignment || !newHostFoodAssignment || !selectedMonth) return;

    setChangingHostFood(true);
    try {
      const { error } = await supabase
        .from('mesa_abierta_matches')
        .update({ host_food_assignment: newHostFoodAssignment })
        .eq('id', changeHostFoodAssignment.matchId);

      if (error) throw error;

      toast({
        title: 'Asignación actualizada',
        description: `${changeHostFoodAssignment.hostName} ahora trae ${
          newHostFoodAssignment === 'main_course' ? 'Plato Principal' :
          newHostFoodAssignment === 'salad' ? 'Ensalada' :
          newHostFoodAssignment === 'drinks' ? 'Bebidas' :
          newHostFoodAssignment === 'dessert' ? 'Postre' : newHostFoodAssignment
        }`,
      });

      // Refresh dinner matches
      await fetchDinnerMatches(selectedMonth.id);
    } catch (error: any) {
      console.error('Error changing host food assignment:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo cambiar la asignación del anfitrión',
        variant: 'destructive',
      });
    } finally {
      setChangingHostFood(false);
      setChangeHostFoodAssignment(null);
      setNewHostFoodAssignment('');
    }
  };

  const handleConvertHostToGuest = async () => {
    if (!convertHost || !targetMatchForHost || !hostFoodAssignment || !selectedMonth) return;

    setConvertingHost(true);
    try {
      // 1. Delete any remaining assignments from the host's match
      const { data: remainingAssignments } = await supabase
        .from('mesa_abierta_assignments')
        .select('id')
        .eq('match_id', convertHost.matchId);

      if (remainingAssignments && remainingAssignments.length > 0) {
        await supabase
          .from('mesa_abierta_assignments')
          .delete()
          .eq('match_id', convertHost.matchId);
      }

      // 2. Delete the host's match
      const { error: deleteMatchError } = await supabase
        .from('mesa_abierta_matches')
        .delete()
        .eq('id', convertHost.matchId);

      if (deleteMatchError) throw deleteMatchError;

      // 3. Update the participant's assigned_role to 'guest'
      const { error: updateParticipantError } = await supabase
        .from('mesa_abierta_participants')
        .update({ assigned_role: 'guest' })
        .eq('id', convertHost.hostParticipantId);

      if (updateParticipantError) throw updateParticipantError;

      // 4. Create a new assignment for the former host as a guest
      const { error: insertAssignmentError } = await supabase
        .from('mesa_abierta_assignments')
        .insert({
          match_id: targetMatchForHost,
          guest_participant_id: convertHost.hostParticipantId,
          food_assignment: hostFoodAssignment,
        });

      if (insertAssignmentError) throw insertAssignmentError;

      // 5. Update guest count on the target match
      const { data: targetMatch } = await supabase
        .from('mesa_abierta_matches')
        .select('guest_count')
        .eq('id', targetMatchForHost)
        .single();

      if (targetMatch) {
        await supabase
          .from('mesa_abierta_matches')
          .update({ guest_count: targetMatch.guest_count + 1 })
          .eq('id', targetMatchForHost);
      }

      toast({
        title: 'Anfitrión convertido',
        description: `${convertHost.hostName} ahora es invitado en otra cena`,
      });

      // Refresh dinner matches
      await fetchDinnerMatches(selectedMonth.id);
    } catch (error: any) {
      console.error('Error converting host to guest:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo convertir el anfitrión',
        variant: 'destructive',
      });
    } finally {
      setConvertingHost(false);
      setConvertHost(null);
      setTargetMatchForHost('');
      setHostFoodAssignment('');
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

      {/* Add Participant Dialog */}
      {showAddParticipant && selectedMonth && (
        <AddParticipantDialog
          open={showAddParticipant}
          onClose={() => setShowAddParticipant(false)}
          onSuccess={() => {
            setShowAddParticipant(false);
            if (selectedMonth) {
              fetchParticipants(selectedMonth.id);
            }
          }}
          monthId={selectedMonth.id}
        />
      )}

      {/* Edit Participant Dialog */}
      {editParticipant && (
        <EditParticipantDialog
          open={!!editParticipant}
          onClose={() => setEditParticipant(null)}
          onSuccess={() => {
            setEditParticipant(null);
            if (selectedMonth) {
              fetchParticipants(selectedMonth.id);
            }
          }}
          participant={editParticipant}
        />
      )}

      {/* Delete Participant Confirmation Dialog */}
      <AlertDialog open={!!deleteParticipant} onOpenChange={(open) => !open && setDeleteParticipant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar participante?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar a <strong>{deleteParticipant?.full_name}</strong>?
              <p className="mt-2">
                Esta acción eliminará su inscripción, restricciones dietéticas y cualquier asignación asociada.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingParticipant}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteParticipant}
              disabled={deletingParticipant}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingParticipant ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move Guest Dialog */}
      <AlertDialog open={!!moveGuest} onOpenChange={(open) => !open && setMoveGuest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover Invitado</AlertDialogTitle>
            <AlertDialogDescription>
              Mover a <strong>{moveGuest?.guestName}</strong> de Cena #{moveGuest?.fromDinnerNumber} a otra cena.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Seleccionar cena destino:</label>
            <Select value={targetMatchId} onValueChange={setTargetMatchId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cena..." />
              </SelectTrigger>
              <SelectContent>
                {dinnerMatches
                  .filter(d => d.id !== moveGuest?.fromMatchId)
                  .map((dinner, index) => {
                    const dinnerNumber = dinnerMatches.findIndex(d => d.id === dinner.id) + 1;
                    return (
                      <SelectItem key={dinner.id} value={dinner.id}>
                        Cena #{dinnerNumber} - {dinner.host.full_name} ({dinner.guests.length} invitados)
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={movingGuest}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMoveGuest}
              disabled={movingGuest || !targetMatchId}
              className="bg-casa-700 hover:bg-casa-800"
            >
              {movingGuest ? 'Moviendo...' : 'Mover Invitado'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Food Assignment Dialog */}
      <AlertDialog open={!!changeFoodAssignment} onOpenChange={(open) => !open && setChangeFoodAssignment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar Asignación de Comida</AlertDialogTitle>
            <AlertDialogDescription>
              Cambiar lo que debe traer <strong>{changeFoodAssignment?.guestName}</strong>.
              <br />
              Asignación actual: <strong>{
                changeFoodAssignment?.currentAssignment === 'main_course' ? 'Plato Principal' :
                changeFoodAssignment?.currentAssignment === 'salad' ? 'Ensalada' :
                changeFoodAssignment?.currentAssignment === 'drinks' ? 'Bebidas' :
                changeFoodAssignment?.currentAssignment === 'dessert' ? 'Postre' : changeFoodAssignment?.currentAssignment
              }</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Nueva asignación:</label>
            <Select value={newFoodAssignment} onValueChange={setNewFoodAssignment}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main_course">Plato Principal</SelectItem>
                <SelectItem value="salad">Ensalada</SelectItem>
                <SelectItem value="drinks">Bebidas</SelectItem>
                <SelectItem value="dessert">Postre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changingFood}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleChangeFoodAssignment}
              disabled={changingFood || !newFoodAssignment}
              className="bg-casa-700 hover:bg-casa-800"
            >
              {changingFood ? 'Guardando...' : 'Guardar Cambio'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert Host to Guest Dialog */}
      <AlertDialog open={!!convertHost} onOpenChange={(open) => !open && setConvertHost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convertir Anfitrión a Invitado</AlertDialogTitle>
            <AlertDialogDescription>
              Convertir a <strong>{convertHost?.hostName}</strong> de anfitrión a invitado.
              <br />
              <span className="text-orange-600">Esta acción eliminará su cena y lo moverá como invitado a otra cena.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Seleccionar cena destino:</label>
              <Select value={targetMatchForHost} onValueChange={setTargetMatchForHost}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cena..." />
                </SelectTrigger>
                <SelectContent>
                  {dinnerMatches
                    .filter(d => d.id !== convertHost?.matchId)
                    .map((dinner) => {
                      const dinnerNumber = dinnerMatches.findIndex(d => d.id === dinner.id) + 1;
                      return (
                        <SelectItem key={dinner.id} value={dinner.id}>
                          Cena #{dinnerNumber} - {dinner.host.full_name} ({dinner.guests.length} invitados)
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Asignar comida:</label>
              <Select value={hostFoodAssignment} onValueChange={setHostFoodAssignment}>
                <SelectTrigger>
                  <SelectValue placeholder="¿Qué debe traer?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main_course">Plato Principal</SelectItem>
                  <SelectItem value="salad">Ensalada</SelectItem>
                  <SelectItem value="drinks">Bebidas</SelectItem>
                  <SelectItem value="dessert">Postre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={convertingHost}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConvertHostToGuest}
              disabled={convertingHost || !targetMatchForHost || !hostFoodAssignment}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {convertingHost ? 'Convirtiendo...' : 'Convertir a Invitado'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Host Food Assignment Dialog */}
      <AlertDialog open={!!changeHostFoodAssignment} onOpenChange={(open) => !open && setChangeHostFoodAssignment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar Asignación del Anfitrión</AlertDialogTitle>
            <AlertDialogDescription>
              Cambiar lo que debe traer <strong>{changeHostFoodAssignment?.hostName}</strong>.
              <br />
              Asignación actual: <strong>{
                changeHostFoodAssignment?.currentAssignment === 'main_course' ? 'Plato Principal' :
                changeHostFoodAssignment?.currentAssignment === 'salad' ? 'Ensalada' :
                changeHostFoodAssignment?.currentAssignment === 'drinks' ? 'Bebidas' :
                changeHostFoodAssignment?.currentAssignment === 'dessert' ? 'Postre' :
                changeHostFoodAssignment?.currentAssignment || 'Sin asignar'
              }</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Nueva asignación:</label>
            <Select value={newHostFoodAssignment} onValueChange={setNewHostFoodAssignment}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main_course">Plato Principal</SelectItem>
                <SelectItem value="salad">Ensalada</SelectItem>
                <SelectItem value="drinks">Bebidas</SelectItem>
                <SelectItem value="dessert">Postre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changingHostFood}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleChangeHostFoodAssignment}
              disabled={changingHostFood || !newHostFoodAssignment}
              className="bg-casa-700 hover:bg-casa-800"
            >
              {changingHostFood ? 'Guardando...' : 'Guardar Cambio'}
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
                          <div className={`mb-4 p-4 rounded-lg border ${dinner.guests.length === 0 ? 'bg-orange-50 border-orange-300' : 'bg-green-50 border-green-200'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Home className={`h-5 w-5 ${dinner.guests.length === 0 ? 'text-orange-700' : 'text-green-700'}`} />
                                <span className={`font-semibold ${dinner.guests.length === 0 ? 'text-orange-800' : 'text-green-800'}`}>Anfitrión</span>
                                {dinner.host.has_plus_one && (
                                  <Badge variant="outline" className={dinner.guests.length === 0 ? 'text-orange-700 border-orange-300' : 'text-green-700 border-green-300'}>+1</Badge>
                                )}
                                {dinner.guests.length === 0 && (
                                  <Badge variant="destructive" className="text-xs">Sin invitados</Badge>
                                )}
                              </div>
                              {dinnerMatches.length > 1 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={`text-xs ${dinner.guests.length === 0 ? 'border-orange-500 text-orange-600 hover:bg-orange-50' : 'border-green-500 text-green-600 hover:bg-green-50'}`}
                                  onClick={() => setConvertHost({
                                    hostParticipantId: dinner.host.id,
                                    hostName: dinner.host.full_name,
                                    matchId: dinner.id,
                                  })}
                                  title="Convertir a invitado y mover a otra cena"
                                >
                                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                                  Mover como invitado
                                </Button>
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
                              <div className="col-span-full flex items-center gap-2 mt-1">
                                <span className="font-medium">Trae:</span>
                                <Badge
                                  variant="secondary"
                                  className={`capitalize cursor-pointer hover:bg-secondary/80 ${dinner.guests.length === 0 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}
                                  onClick={() => setChangeHostFoodAssignment({
                                    matchId: dinner.id,
                                    hostName: dinner.host.full_name,
                                    currentAssignment: dinner.host_food_assignment || null,
                                  })}
                                  title="Clic para cambiar"
                                >
                                  {dinner.host_food_assignment === 'main_course' ? 'Plato Principal' :
                                   dinner.host_food_assignment === 'salad' ? 'Ensalada' :
                                   dinner.host_food_assignment === 'drinks' ? 'Bebidas' :
                                   dinner.host_food_assignment === 'dessert' ? 'Postre' :
                                   'Sin asignar'}
                                  <Pencil className="h-3 w-3 ml-1" />
                                </Badge>
                              </div>
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
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant="secondary"
                                        className="capitalize cursor-pointer hover:bg-secondary/80"
                                        onClick={() => setChangeFoodAssignment({
                                          guestId: guest.id,
                                          guestName: guest.full_name,
                                          matchId: dinner.id,
                                          currentAssignment: guest.food_assignment,
                                        })}
                                        title="Clic para cambiar"
                                      >
                                        {guest.food_assignment === 'main_course' ? 'Plato Principal' :
                                         guest.food_assignment === 'salad' ? 'Ensalada' :
                                         guest.food_assignment === 'drinks' ? 'Bebidas' :
                                         guest.food_assignment === 'dessert' ? 'Postre' : guest.food_assignment}
                                        <Pencil className="h-3 w-3 ml-1" />
                                      </Badge>
                                      {dinnerMatches.length > 1 && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => setMoveGuest({
                                            guestId: guest.id,
                                            guestName: guest.full_name,
                                            fromMatchId: dinner.id,
                                            fromDinnerNumber: index + 1,
                                          })}
                                          title="Mover a otra cena"
                                        >
                                          <MoveRight className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
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
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Lista de Participantes</CardTitle>
                  <CardDescription>
                    {participants.length} participantes registrados para este mes
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowAddParticipant(true)}
                  className="bg-casa-700 hover:bg-casa-800"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Agregar Participante
                </Button>
              </CardHeader>
              <CardContent>
                {participants.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay participantes registrados aún.</p>
                    <p className="text-sm">Haz clic en "Agregar Participante" para agregar manualmente.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {participants.map((participant) => (
                      <div
                        key={participant.id}
                        className="p-4 bg-muted rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
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
                            <Badge variant="outline">{participant.status}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditParticipant(participant)}
                              title="Editar participante"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteParticipant(participant)}
                              title="Eliminar participante"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="font-semibold">Nombre:</span> {participant.full_name}
                          </div>
                          <div>
                            <span className="font-semibold">Email:</span> {participant.email || 'Sin correo'}
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
                )}
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
