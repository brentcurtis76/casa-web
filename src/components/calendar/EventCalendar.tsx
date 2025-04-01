
import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon, Clock, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// Define interface for the events based on the existing database structure
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch all events from Supabase
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('events')
          .select('*');
        
        if (error) {
          throw error;
        }
        
        setEvents(data as Event[]);
        if (selectedDate) {
          filterEventsByDate(selectedDate, data as Event[]);
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
  
  // Function to convert database date string to Date object
  const parseEventDate = (dateStr: string): Date => {
    return parseISO(dateStr);
  };
  
  // Filter events by selected date
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
  
  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      filterEventsByDate(date);
    }
  };
  
  // Function to check if a day has an event
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
  
  // Format date for display
  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
  };
  
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
        />
      </div>

      <div>
        <h3 className="text-xl font-medium mb-4">
          {selectedDate ? (
            <>Eventos para el {formatDate(selectedDate)}</>
          ) : (
            'Eventos'
          )}
        </h3>
        
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
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
        ) : filteredEvents.length > 0 ? (
          <div className="space-y-4">
            {filteredEvents.map(event => (
              <Card key={event.id} className="overflow-hidden">
                <CardHeader className="bg-casa-50 pb-3">
                  <CardTitle>{event.title}</CardTitle>
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
            ))}
          </div>
        ) : (
          <div className="bg-secondary rounded-lg p-8 text-center">
            <p className="text-muted-foreground">No hay eventos programados para esta fecha.</p>
          </div>
        )}
      </div>
    </div>
  );
}
