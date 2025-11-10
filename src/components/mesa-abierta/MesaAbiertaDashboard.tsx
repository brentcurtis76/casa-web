import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  UtensilsCrossed,
  AlertCircle,
  CheckCircle,
  Loader2,
  ExternalLink,
  X
} from "lucide-react";
import { format, addHours } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";

interface ParticipantData {
  id: string;
  role_preference: 'host' | 'guest';
  assigned_role: 'host' | 'guest' | null;
  has_plus_one: boolean;
  status: 'pending' | 'confirmed' | 'cancelled' | 'waitlist';
  host_address: string | null;
  phone_number: string | null;
  mesa_abierta_months: {
    dinner_date: string;
    month_date: string;
  };
  mesa_abierta_assignments?: Array<{
    food_assignment: string;
    mesa_abierta_matches: {
      dinner_date: string;
      dinner_time: string;
      host_participant: {
        host_address: string;
      };
    };
  }>;
  dietary_restrictions?: Array<{
    restriction_type: string;
    description: string | null;
  }>;
}

interface DinnerGroupDietary {
  restriction_type: string;
  count: number;
}

export function MesaAbiertaDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [participantData, setParticipantData] = useState<ParticipantData | null>(null);
  const [groupDietary, setGroupDietary] = useState<DinnerGroupDietary[]>([]);

  useEffect(() => {
    if (user) {
      fetchParticipantData();
    }
  }, [user]);

  const fetchParticipantData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get current/upcoming participation
      const { data: participant, error: participantError } = await supabase
        .from('mesa_abierta_participants')
        .select(`
          id,
          role_preference,
          assigned_role,
          has_plus_one,
          status,
          host_address,
          phone_number,
          mesa_abierta_months!inner(
            dinner_date,
            month_date
          ),
          mesa_abierta_assignments(
            food_assignment,
            mesa_abierta_matches!inner(
              dinner_date,
              dinner_time,
              mesa_abierta_participants!mesa_abierta_matches_host_participant_id_fkey(
                host_address
              )
            )
          )
        `)
        .eq('user_id', user.id)
        .gte('mesa_abierta_months.dinner_date', new Date().toISOString())
        .order('mesa_abierta_months.dinner_date', { ascending: true })
        .limit(1)
        .single();

      if (participantError) {
        if (participantError.code === 'PGRST116') {
          // No participation found
          setParticipantData(null);
          return;
        }
        throw participantError;
      }

      setParticipantData(participant as any);

      // If assigned, fetch group dietary restrictions
      if (participant.assigned_role && participant.mesa_abierta_assignments?.[0]) {
        await fetchGroupDietary(participant.mesa_abierta_assignments[0].mesa_abierta_matches.id);
      }

    } catch (error: any) {
      console.error('Error fetching participant data:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información de tu cena",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupDietary = async (matchId: string) => {
    try {
      // Get all participants in this match
      const { data: assignments, error } = await supabase
        .from('mesa_abierta_assignments')
        .select(`
          mesa_abierta_participants!inner(
            mesa_abierta_dietary_restrictions(
              restriction_type,
              description
            )
          )
        `)
        .eq('match_id', matchId);

      if (error) throw error;

      // Count dietary restrictions
      const restrictionCounts: { [key: string]: number } = {};
      assignments?.forEach((assignment: any) => {
        assignment.mesa_abierta_participants.mesa_abierta_dietary_restrictions?.forEach((restriction: any) => {
          const type = restriction.restriction_type;
          restrictionCounts[type] = (restrictionCounts[type] || 0) + 1;
        });
      });

      const groupedRestrictions = Object.entries(restrictionCounts).map(([type, count]) => ({
        restriction_type: type,
        count
      }));

      setGroupDietary(groupedRestrictions);

    } catch (error) {
      console.error('Error fetching group dietary:', error);
    }
  };

  const handleCancelParticipation = async () => {
    if (!participantData) return;

    try {
      const { error } = await supabase
        .from('mesa_abierta_participants')
        .update({ status: 'cancelled' })
        .eq('id', participantData.id);

      if (error) throw error;

      toast({
        title: "Participación cancelada",
        description: "Tu inscripción ha sido cancelada exitosamente"
      });

      setParticipantData({ ...participantData, status: 'cancelled' });

    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo cancelar la participación",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">⏳ Esperando Asignación</Badge>,
      confirmed: <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✓ Confirmado</Badge>,
      cancelled: <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">✗ Cancelado</Badge>,
      waitlist: <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">📋 Lista de Espera</Badge>,
    };
    return badges[status as keyof typeof badges] || null;
  };

  const getFoodAssignmentLabel = (assignment: string) => {
    const labels: { [key: string]: string } = {
      main_course: "Plato Principal",
      salad: "Ensalada",
      drinks: "Bebidas",
      dessert: "Postre",
      none: "Sin asignación"
    };
    return labels[assignment] || assignment;
  };

  const getDietaryLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      vegetarian: "Vegetariano",
      vegan: "Vegano",
      gluten_free: "Sin gluten",
      dairy_free: "Sin lácteos",
      nut_allergy: "Alergia a nueces",
      shellfish_allergy: "Alergia a mariscos",
      other: "Otra"
    };
    return labels[type] || type;
  };

  const addToCalendar = () => {
    if (!participantData?.mesa_abierta_assignments?.[0]) return;

    const assignment = participantData.mesa_abierta_assignments[0];
    const match = assignment.mesa_abierta_matches;
    const startDate = new Date(`${match.dinner_date}T${match.dinner_time}`);
    const endDate = addHours(startDate, 3);

    const title = participantData.assigned_role === 'host'
      ? "La Mesa Abierta - Anfitrión"
      : "La Mesa Abierta - Invitado";

    const location = participantData.assigned_role === 'guest'
      ? match.host_participant.host_address
      : participantData.host_address || '';

    // Google Calendar URL
    const googleCalUrl = new URL('https://calendar.google.com/calendar/render');
    googleCalUrl.searchParams.set('action', 'TEMPLATE');
    googleCalUrl.searchParams.set('text', title);
    googleCalUrl.searchParams.set('dates', `${format(startDate, "yyyyMMdd'T'HHmmss")}/${format(endDate, "yyyyMMdd'T'HHmmss")}`);
    googleCalUrl.searchParams.set('location', location);
    googleCalUrl.searchParams.set('details', 'Una cena mensual llena de sorpresas con la comunidad de CASA');

    window.open(googleCalUrl.toString(), '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-casa-700" />
      </div>
    );
  }

  if (!participantData) {
    return (
      <Card className="border-casa-200">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <UtensilsCrossed className="h-16 w-16 text-casa-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-casa-700 mb-2">
              No estás inscrito
            </h3>
            <p className="text-casa-600 mb-4">
              Aún no te has inscrito para ninguna cena próxima
            </p>
            <Button className="bg-casa-700 hover:bg-casa-800">
              Inscribirme Ahora
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isAssigned = participantData.assigned_role && participantData.mesa_abierta_assignments?.length;
  const assignment = participantData.mesa_abierta_assignments?.[0];

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border-casa-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tu Participación</CardTitle>
                <CardDescription>
                  {format(new Date(participantData.mesa_abierta_months.month_date), "MMMM yyyy", { locale: es })}
                </CardDescription>
              </div>
              {getStatusBadge(participantData.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pending State */}
            {!isAssigned && participantData.status === 'pending' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-1">Esperando asignación</p>
                  <p className="text-sm text-muted-foreground">
                    Te inscribiste como <strong>{participantData.role_preference === 'host' ? 'anfitrión' : 'invitado'}</strong>.
                    Recibirás la confirmación de tu rol y los detalles de la cena el lunes anterior al evento.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Assigned State - Guest */}
            {isAssigned && participantData.assigned_role === 'guest' && assignment && (
              <div className="space-y-4">
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <p className="font-medium text-green-800 mb-1">¡Tu cena está confirmada!</p>
                    <p className="text-sm text-green-700">
                      Has sido asignado como invitado. Aquí están los detalles.
                    </p>
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-casa-700 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-casa-500">Fecha</p>
                      <p className="text-base text-casa-800">
                        {format(new Date(assignment.mesa_abierta_matches.dinner_date), "EEEE, d 'de' MMMM", { locale: es })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-casa-700 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-casa-500">Hora</p>
                      <p className="text-base text-casa-800">{assignment.mesa_abierta_matches.dinner_time}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 md:col-span-2">
                    <MapPin className="h-5 w-5 text-casa-700 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-casa-500">Dirección</p>
                      <p className="text-base text-casa-800">{assignment.mesa_abierta_matches.host_participant.host_address}</p>
                      <Button
                        variant="link"
                        className="h-auto p-0 text-casa-700"
                        onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(assignment.mesa_abierta_matches.host_participant.host_address)}`, '_blank')}
                      >
                        Ver en Google Maps <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 md:col-span-2">
                    <UtensilsCrossed className="h-5 w-5 text-casa-700 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-casa-500">Tu asignación de comida</p>
                      <p className="text-lg font-semibold text-casa-800">
                        {getFoodAssignmentLabel(assignment.food_assignment)}
                      </p>
                      <p className="text-sm text-muted-foreground">Para aproximadamente 10 personas</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Assigned State - Host */}
            {isAssigned && participantData.assigned_role === 'host' && assignment && (
              <div className="space-y-4">
                <Alert className="bg-blue-50 border-blue-200">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription>
                    <p className="font-medium text-blue-800 mb-1">¡Serás anfitrión!</p>
                    <p className="text-sm text-blue-700">
                      Recibirás invitados en tu hogar. Aquí están los detalles.
                    </p>
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-casa-700 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-casa-500">Fecha</p>
                      <p className="text-base text-casa-800">
                        {format(new Date(assignment.mesa_abierta_matches.dinner_date), "EEEE, d 'de' MMMM", { locale: es })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-casa-700 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-casa-500">Hora</p>
                      <p className="text-base text-casa-800">{assignment.mesa_abierta_matches.dinner_time}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-casa-700 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-casa-500">Invitados esperados</p>
                      <p className="text-base text-casa-800">Aproximadamente 6-10 personas</p>
                    </div>
                  </div>

                  {assignment.food_assignment !== 'none' && (
                    <div className="flex items-start gap-3">
                      <UtensilsCrossed className="h-5 w-5 text-casa-700 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-casa-500">También debes traer</p>
                        <p className="text-lg font-semibold text-casa-800">
                          {getFoodAssignmentLabel(assignment.food_assignment)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dietary Restrictions */}
            {groupDietary.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium text-casa-700 mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Restricciones alimentarias del grupo
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {groupDietary.map((restriction) => (
                      <Badge key={restriction.restriction_type} variant="outline" className="justify-start">
                        {getDietaryLabel(restriction.restriction_type)}: {restriction.count}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Por favor considera estas restricciones al preparar tu plato
                  </p>
                </div>
              </>
            )}

            {/* Actions */}
            <Separator />
            <div className="flex flex-wrap gap-3">
              {isAssigned && (
                <Button onClick={addToCalendar} className="bg-casa-700 hover:bg-casa-800">
                  <Calendar className="h-4 w-4 mr-2" />
                  Agregar al Calendario
                </Button>
              )}
              {participantData.status !== 'cancelled' && (
                <Button
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  onClick={handleCancelParticipation}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar Participación
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Mystery Reminder */}
      {isAssigned && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Alert className="border-casa-200 bg-casa-50">
            <AlertCircle className="h-4 w-4 text-casa-700" />
            <AlertDescription className="text-casa-700">
              <p className="font-medium mb-1">🎭 Recuerda el misterio</p>
              <p className="text-sm">
                {participantData.assigned_role === 'host'
                  ? "No sabrás quiénes serán tus invitados hasta que lleguen a tu puerta."
                  : "No sabrás quién es el anfitrión ni quiénes son los otros invitados hasta que llegues."
                }
              </p>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}
    </div>
  );
}
