import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon, Clock, MapPin, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, isAfter, compareAsc } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string | null;
}

export function EventCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllEvents, setShowAllEvents] = useState<boolean>(false);
  
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('events')
          .select('*') as { data: Event[] | null; error: Error | null };
        
        if (error) {
          throw error;
        }
        
        if (data) {
          setEvents(data);
          if (selectedDate) {
            filterEventsByDate(selectedDate, data);
          }
          
          const today = new Date();
          const upcoming = data
            .filter(event => {
              const eventDate = parseEventDate(event.date);
              return isAfter(eventDate, today) || 
                (eventDate.getDate() === today.getDate() && 
                 eventDate.getMonth() === today.getMonth() && 
                 eventDate.getFullYear() === today.getFullYear());
            })
            .sort((a, b) => {
              return compareAsc(parseEventDate(a.date), parseEventDate(b.date));
            })
            .slice(0, 5);
          
          setUpcomingEvents(upcoming);
        }
      } catch (error) {
        console.error('Error fetching events:', error);
        setError('Error al cargar los eventos. Por favor, intente nuevamente.');
        toast({
          variant: "destructive",
          title: "Error al cargar eventos",
          description: "No pudimos cargar los eventos. Por favor, intente más tarde."
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEvents();
  }, []);
  
  const parseEventDate = (dateStr: string): Date => {
    return parseISO(dateStr);
  };
  
  const filterEventsByDate = (date: Date, eventList: Event[] = events) => {
    const filtered = eventList.filter(event => {
      const eventDate = parseEventDate(event.date);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
    setFilteredEvents(filtered);
  };
  
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      filterEventsByDate(date);
    }
  };
  
  const isDayWithEvent = (day: Date) => {
    return events.some(event => {
      const eventDate = parseEventDate(event.date);
      return (
        eventDate.getDate() === day.getDate() &&
        eventDate.getMonth() === day.getMonth() &&
        eventDate.getFullYear() === day.getFullYear()
      );
    });
  };
  
  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
  };
  
  const renderEventCard = (event: Event) => (
    <Card key={event.id} className="overflow-hidden mb-4">
      <CardHeader className="bg-casa-50 pb-3">
        <CardTitle>{event.title}</CardTitle>
        <div className="text-sm text-muted-foreground">
          {formatDate(parseEventDate(event.date))}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex items-center text-sm text-muted-foreground mb-2">
          <Clock size={16} className="mr-1" />
          <span>{event.time}</span>
        </div>
        <div className="flex items-center text-sm text-muted-foreground mb-3">
          <MapPin size={16} className="mr-1" />
          <span>{event.location}</span>
        </div>
        <CardDescription>{event.description}</CardDescription>
      </CardContent>
    </Card>
  );
  
  const visibleUpcomingEvents = upcomingEvents.slice(0, 2);
  const hasMoreEvents = upcomingEvents.length > 2;
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-medium mb-4 flex items-center">
          <CalendarIcon className="mr-2" size={20} />
          Calendario de Eventos
        </h3>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          className="rounded-md p-3 pointer-events-auto"
          modifiers={{
            hasEvent: (date) => isDayWithEvent(date),
          }}
          modifiersClassNames={{
            hasEvent: "bg-casa-200 font-bold text-casa-800",
          }}
          locale={es}
        />
      </div>

      <div>
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-medium">Próximos Eventos</h3>
            {hasMoreEvents && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex items-center text-casa-600 hover:text-casa-800"
                onClick={() => setShowAllEvents(true)}
              >
                Ver todos <ChevronRight className="ml-1" size={16} />
              </Button>
            )}
          </div>
          
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <Skeleton className="h-6 w-3/4" />
                  </CardHeader>
                  <CardContent className="pt-4">
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-2/3 mb-3" />
                    <Skeleton className="h-4 w-5/6" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : visibleUpcomingEvents.length > 0 ? (
            <div className="space-y-4">
              {visibleUpcomingEvents.map(event => renderEventCard(event))}
            </div>
          ) : (
            <div className="bg-secondary rounded-lg p-8 text-center">
              <p className="text-muted-foreground">No hay eventos próximos programados.</p>
            </div>
          )}
        </div>
        
        {selectedDate && (
          <div>
            <h3 className="text-xl font-medium mb-4">
              Eventos para el {formatDate(selectedDate)}
            </h3>
            
            {filteredEvents.length > 0 ? (
              <div className="space-y-4">
                {filteredEvents.map(event => renderEventCard(event))}
              </div>
            ) : (
              <div className="bg-secondary rounded-lg p-8 text-center">
                <p className="text-muted-foreground">No hay eventos programados para esta fecha.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showAllEvents} onOpenChange={setShowAllEvents}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Todos los Eventos Próximos</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            {upcomingEvents.length > 0 ? (
              <div className="space-y-4 mt-4">
                {upcomingEvents.map(event => renderEventCard(event))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                No hay eventos próximos programados.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
