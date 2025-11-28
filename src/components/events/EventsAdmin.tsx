import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Plus, Pencil, Trash2, Calendar, MapPin, Clock, Star } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { EventForm } from './EventForm';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string | null;
  image_url?: string | null;
  featured?: boolean;
  created_at: string;
}

export const EventsAdmin = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [deleteEvent, setDeleteEvent] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  // Fetch events
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching events:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los eventos',
        variant: 'destructive',
      });
    } else {
      setEvents(data || []);
    }
    setIsLoading(false);
  };

  const handleDeleteEvent = async () => {
    if (!deleteEvent) return;

    setDeleting(true);
    try {
      // Delete image from storage if exists
      if (deleteEvent.image_url) {
        const imagePath = deleteEvent.image_url.split('/').pop();
        if (imagePath) {
          await supabase.storage.from('event-images').remove([imagePath]);
        }
      }

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', deleteEvent.id);

      if (error) throw error;

      toast({
        title: 'Evento eliminado',
        description: 'El evento ha sido eliminado exitosamente.',
      });

      await fetchEvents();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast({
        title: 'Error',
        description: error.message || 'Error al eliminar el evento',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteEvent(null);
    }
  };

  const getEventStatus = (date: string) => {
    const eventDate = parseISO(date);
    if (isPast(eventDate) && !isToday(eventDate)) {
      return { label: 'Pasado', variant: 'secondary' as const };
    }
    if (isToday(eventDate)) {
      return { label: 'Hoy', variant: 'default' as const };
    }
    return { label: 'Próximo', variant: 'outline' as const };
  };

  const formatDate = (date: string) => {
    return format(parseISO(date), "d 'de' MMMM, yyyy", { locale: es });
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-casa-700">Administrar Eventos</h2>
          <p className="text-muted-foreground">Crea y gestiona los eventos de la comunidad</p>
        </div>
        <Button onClick={() => setShowEventForm(true)} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Crear Evento
        </Button>
      </div>

      {/* Event Form Dialog */}
      {(showEventForm || editEvent) && (
        <EventForm
          open={showEventForm || !!editEvent}
          event={editEvent}
          onClose={() => {
            setShowEventForm(false);
            setEditEvent(null);
          }}
          onSuccess={() => {
            setShowEventForm(false);
            setEditEvent(null);
            fetchEvents();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEvent} onOpenChange={(open) => !open && setDeleteEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el evento
              "{deleteEvent?.title}" y su imagen asociada (si existe).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Todos los Eventos
          </CardTitle>
          <CardDescription>
            {events.length} eventos en total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-4 bg-muted rounded-lg animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay eventos creados aún.</p>
              <p className="text-sm">Haz clic en "Crear Evento" para comenzar.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => {
                const status = getEventStatus(event.date);
                return (
                  <div
                    key={event.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      status.label === 'Pasado' ? 'bg-muted/50 opacity-70' : 'bg-white hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-semibold text-lg truncate">{event.title}</h3>
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {event.featured && (
                            <Badge variant="default" className="bg-amber-500">
                              <Star className="h-3 w-3 mr-1" />
                              Destacado
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(event.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {event.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {event.location}
                          </span>
                        </div>
                        {event.description && (
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {event.description}
                          </p>
                        )}
                      </div>
                      {event.image_url && (
                        <div className="hidden sm:block flex-shrink-0">
                          <img
                            src={event.image_url}
                            alt={event.title}
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                        </div>
                      )}
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditEvent(event)}
                          title="Editar evento"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteEvent(event)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Eliminar evento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
