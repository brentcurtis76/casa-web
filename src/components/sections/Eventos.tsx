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

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

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
    <section id="eventos" className="section bg-gradient-to-b from-white via-casa-50/30 to-white noise-texture overflow-hidden relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-radial from-amber-100/20 to-transparent rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-20 left-10 w-24 h-24 border border-casa-200/30 rounded-full opacity-40" />
      <div className="absolute top-40 left-0 w-2 h-24 bg-gradient-to-b from-amber-200/40 to-transparent" />

      <div className="container-custom relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-14"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.div
            className="flex items-center justify-center gap-4 mb-6"
            variants={itemVariants}
          >
            <div className="w-16 h-px bg-gradient-to-r from-transparent to-amber-400/60" />
            <div className="w-2 h-2 bg-amber-400 rounded-full" />
            <div className="w-16 h-px bg-gradient-to-l from-transparent to-amber-400/60" />
          </motion.div>

          <motion.h2
            className="heading-dramatic font-light text-casa-800 mb-4"
            variants={itemVariants}
          >
            Próximos Eventos
          </motion.h2>

          <motion.p
            className="text-xl text-casa-600 max-w-2xl mx-auto leading-relaxed"
            variants={itemVariants}
          >
            Únete a nuestras actividades y celebraciones. Cada encuentro es una oportunidad para crecer juntos.
          </motion.p>
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
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <motion.div
              className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-casa-100/50 flex items-center justify-center"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Calendar className="h-10 w-10 text-casa-400" />
            </motion.div>
            <p className="text-casa-600 text-xl mb-2">
              No hay eventos programados próximamente.
            </p>
            <p className="text-casa-400">
              Vuelve pronto para ver nuevas actividades.
            </p>
          </motion.div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {/* Featured Event */}
            {featuredEvent && (
              <motion.div
                className="mb-12"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <FeaturedEventCard
                  title={featuredEvent.title}
                  date={featuredEvent.date}
                  time={featuredEvent.time}
                  location={featuredEvent.location}
                  description={featuredEvent.description}
                  imageUrl={featuredEvent.image_url}
                />
              </motion.div>
            )}

            {/* Upcoming Events Timeline */}
            {upcomingEvents.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center gap-4 mb-8">
                  <h3 className="text-xl font-light text-casa-700">
                    Más Eventos
                  </h3>
                  <div className="flex-1 h-px bg-gradient-to-r from-casa-200 to-transparent" />
                </div>
                <EventTimeline events={upcomingEvents} />
              </motion.div>
            )}

            {/* View Calendar Button */}
            <motion.div
              className="text-center mt-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowCalendar(true)}
                className="border-2 border-casa-300 text-casa-700 hover:bg-casa-50 hover:border-casa-400 shadow-sm hover:shadow-lg transition-all duration-300 group"
              >
                <Calendar className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                Ver Calendario Completo
                <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
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
