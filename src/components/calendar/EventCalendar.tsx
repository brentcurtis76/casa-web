
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon, Clock, MapPin } from 'lucide-react';

// Datos de ejemplo para eventos
const mockEvents = [
  {
    id: 1,
    title: 'Servicio Dominical',
    date: new Date(2023, 8, 17),
    time: '11:00 AM',
    location: 'Templo Principal',
    description: 'Servicio regular de adoración dominical.'
  },
  {
    id: 2,
    title: 'Estudio Bíblico',
    date: new Date(2023, 8, 20),
    time: '7:00 PM',
    location: 'Sala de Estudios',
    description: 'Estudio profundo de las escrituras.'
  },
  {
    id: 3,
    title: 'Grupo Juvenil',
    date: new Date(2023, 8, 22),
    time: '6:00 PM',
    location: 'Salón Comunitario',
    description: 'Reunión para jóvenes entre 14-18 años.'
  },
  {
    id: 4,
    title: 'Retiro Espiritual',
    date: new Date(2023, 8, 29),
    time: '9:00 AM - 5:00 PM',
    location: 'Centro de Retiros El Descanso',
    description: 'Un día de renovación y conexión espiritual.'
  },
  {
    id: 5,
    title: 'Servicio Dominical',
    date: new Date(2023, 8, 24),
    time: '11:00 AM',
    location: 'Templo Principal',
    description: 'Servicio regular de adoración dominical.'
  }
];

// Función para obtener eventos por fecha
function getEventsByDate(date: Date) {
  return mockEvents.filter(event => 
    event.date.getDate() === date.getDate() &&
    event.date.getMonth() === date.getMonth() &&
    event.date.getFullYear() === date.getFullYear()
  );
}

export function EventCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState(getEventsByDate(new Date()));

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      setEvents(getEventsByDate(date));
    }
  };

  // Función para resaltar fechas con eventos
  const isDayWithEvent = (day: Date) => {
    return mockEvents.some(event => 
      event.date.getDate() === day.getDate() &&
      event.date.getMonth() === day.getMonth() &&
      event.date.getFullYear() === day.getFullYear()
    );
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
            <>Eventos para el {selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</>
          ) : (
            'Eventos'
          )}
        </h3>
        
        {events.length > 0 ? (
          <div className="space-y-4">
            {events.map(event => (
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
