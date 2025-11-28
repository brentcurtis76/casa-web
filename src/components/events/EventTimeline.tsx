import { motion } from 'framer-motion';
import { Clock, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description?: string | null;
}

interface EventTimelineProps {
  events: Event[];
}

export const EventTimeline = ({ events }: EventTimelineProps) => {
  if (events.length === 0) return null;

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[39px] top-4 bottom-4 w-px bg-casa-200 hidden md:block" />

      <div className="space-y-4">
        {events.map((event, index) => {
          const eventDate = parseISO(event.date);
          const day = format(eventDate, 'd');
          const month = format(eventDate, 'MMM', { locale: es }).toUpperCase();

          return (
            <motion.div
              key={event.id}
              className="flex gap-4 md:gap-6"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              {/* Date circle */}
              <div className="flex-shrink-0 w-20 md:w-20">
                <div className="w-20 h-20 rounded-xl bg-casa-50 border border-casa-200 flex flex-col items-center justify-center relative z-10">
                  <span className="text-2xl font-light text-casa-700">{day}</span>
                  <span className="text-xs uppercase tracking-wider text-casa-500">{month}</span>
                </div>
              </div>

              {/* Event card */}
              <motion.div
                className="flex-1 bg-white rounded-xl p-4 border border-casa-100 shadow-sm hover:shadow-md transition-shadow"
                whileHover={{ scale: 1.01 }}
              >
                <h4 className="font-medium text-casa-800 mb-2">{event.title}</h4>
                <div className="flex flex-wrap gap-3 text-sm text-casa-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {event.time}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {event.location}
                  </span>
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
