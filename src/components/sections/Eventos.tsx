import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { FeaturedEventCard } from '@/components/events/FeaturedEventCard';
import { EventTimeline } from '@/components/events/EventTimeline';
import { EventCalendar } from '@/components/calendar/EventCalendar';
import { Skeleton } from '@/components/ui/skeleton';
import { parseISO, isAfter, compareAsc } from 'date-fns';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string | null;
  image_url?: string | null;
  featured?: boolean;
}

export function Eventos() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('events')
          .select('*');

        if (error) throw error;

        if (data) {
          // Filter to upcoming events and sort
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const upcomingEvents = data
            .filter(event => {
              const eventDate = parseISO(event.date);
              return isAfter(eventDate, today) || eventDate.toDateString() === today.toDateString();
            })
            .sort((a, b) => {
              // Featured events first, then by date
              if (a.featured && !b.featured) return -1;
              if (!a.featured && b.featured) return 1;
              return compareAsc(parseISO(a.date), parseISO(b.date));
            });

          setEvents(upcomingEvents);
        }
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const featuredEvent = events[0];
  const upcomingEvents = events.slice(1, 5);

  return (
    <section id="eventos" className="py-20 bg-gradient-to-b from-white to-casa-50/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-light text-casa-800 mb-4">
            Próximos Eventos
          </h2>
          <p className="text-lg text-casa-600 max-w-2xl mx-auto">
            Únete a nuestras actividades y celebraciones. Cada encuentro es una oportunidad para crecer juntos.
          </p>
        </motion.div>

        {/* Loading State */}
        {isLoading ? (
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-20 w-20 rounded-xl" />
                  <Skeleton className="h-20 flex-1 rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        ) : events.length === 0 ? (
          /* Empty State */
          <motion.div
            className="text-center py-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <Calendar className="h-16 w-16 mx-auto text-casa-300 mb-4" />
            <p className="text-casa-500 text-lg">
              No hay eventos programados próximamente.
            </p>
            <p className="text-casa-400 mt-2">
              Vuelve pronto para ver nuevas actividades.
            </p>
          </motion.div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {/* Featured Event */}
            {featuredEvent && (
              <div className="mb-10">
                <FeaturedEventCard
                  title={featuredEvent.title}
                  date={featuredEvent.date}
                  time={featuredEvent.time}
                  location={featuredEvent.location}
                  description={featuredEvent.description}
                  imageUrl={featuredEvent.image_url}
                />
              </div>
            )}

            {/* Upcoming Events Timeline */}
            {upcomingEvents.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
              >
                <h3 className="text-xl font-light text-casa-700 mb-6">
                  Más Eventos
                </h3>
                <EventTimeline events={upcomingEvents} />
              </motion.div>
            )}

            {/* View Calendar Button */}
            <motion.div
              className="text-center mt-10"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowCalendar(true)}
                className="border-casa-300 text-casa-700 hover:bg-casa-50"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Ver Calendario Completo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </motion.div>
          </div>
        )}

        {/* Calendar Dialog */}
        <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-light text-casa-800">
                Calendario de Eventos
              </DialogTitle>
            </DialogHeader>
            <EventCalendar />
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
