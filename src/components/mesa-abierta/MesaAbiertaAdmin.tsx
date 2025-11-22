import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Play, Users, Calendar, TrendingUp, Mail, Send, MessageCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CreateMonthDialog } from './CreateMonthDialog';

interface Month {
  id: string;
  month_date: string;
  dinner_date: string;
  registration_deadline: string;
  dinner_time: string;
  status: string;
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
  dietary_restrictions?: string;
  plus_one_name?: string;
  plus_one_dietary_restrictions?: string;
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
  };
  error?: string;
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

  // Fetch participants when month changes
  useEffect(() => {
    if (selectedMonth) {
      fetchParticipants(selectedMonth.id);
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
        dietary_restrictions,
        plus_one_name,
        plus_one_dietary_restrictions
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
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      // Merge user data with participant data
      const participantsWithNames = data.map(participant => {
        const user = users?.find(u => u.id === participant.user_id);
        return {
          ...participant,
          full_name: user?.full_name || 'Sin nombre',
          // Email comes from participant record (already in data)
        };
      });

      setParticipants(participantsWithNames as any);
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
      const { data, error} = await supabase.functions.invoke('create-mesa-matches', {
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-casa-700">Panel de Administración</h2>
          <p className="text-muted-foreground">Gestiona eventos y participantes de La Mesa Abierta</p>
        </div>
        <Button onClick={() => setShowCreateMonth(true)} size="lg">
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
                <Button
                  key={month.id}
                  variant={selectedMonth?.id === month.id ? 'default' : 'outline'}
                  className="justify-start h-auto p-4"
                  onClick={() => setSelectedMonth(month)}
                >
                  <div className="text-left w-full">
                    <div className="font-semibold">
                      {new Date(month.dinner_date).toLocaleDateString('es-ES', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Cena: {new Date(month.dinner_date).toLocaleDateString('es-ES')}
                    </div>
                    <Badge variant={month.status === 'open' ? 'default' : 'secondary'} className="mt-2">
                      {month.status}
                    </Badge>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedMonth && (
        <Tabs defaultValue="matching" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="matching">
              <Play className="h-4 w-4 mr-2" />
              Matching
            </TabsTrigger>
            <TabsTrigger value="participants">
              <Users className="h-4 w-4 mr-2" />
              Participantes
            </TabsTrigger>
            <TabsTrigger value="statistics">
              <TrendingUp className="h-4 w-4 mr-2" />
              Estadísticas
            </TabsTrigger>
            <TabsTrigger value="communication">
              <Mail className="h-4 w-4 mr-2" />
              Comunicación
            </TabsTrigger>
          </TabsList>

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

                <div className="flex items-center gap-4">
                  <Button
                    onClick={runMatching}
                    disabled={loading || selectedMonth.status !== 'open'}
                    size="lg"
                    className="bg-casa-700 hover:bg-casa-800"
                  >
                    {loading ? 'Ejecutando...' : 'Ejecutar Matching'}
                  </Button>
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
                                  {matchResult.results?.hostsConverted}
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
                        {participant.dietary_restrictions && (
                          <div className="col-span-full">
                            <span className="font-semibold">Restricciones:</span> {participant.dietary_restrictions}
                          </div>
                        )}
                        {participant.has_plus_one && participant.plus_one_name && (
                          <div className="col-span-full">
                            <span className="font-semibold">Acompañante:</span> {participant.plus_one_name}
                            {participant.plus_one_dietary_restrictions && ` (${participant.plus_one_dietary_restrictions})`}
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
