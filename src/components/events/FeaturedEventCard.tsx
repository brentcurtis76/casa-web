import { motion } from 'framer-motion';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface FeaturedEventCardProps {
  title: string;
  date: string;
  time: string;
  location: string;
  description?: string | null;
  imageUrl?: string | null;
}

export const FeaturedEventCard = ({
  title,
  date,
  time,
  location,
  description,
  imageUrl,
}: FeaturedEventCardProps) => {
  const eventDate = parseISO(date);
  const day = format(eventDate, 'd');
  const month = format(eventDate, 'MMM', { locale: es }).toUpperCase();
  const fullDate = format(eventDate, "EEEE, d 'de' MMMM", { locale: es });

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl bg-white shadow-lg border border-casa-100"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <div className="flex flex-col md:flex-row">
        {/* Date Badge - Left Side */}
        <div className="md:w-32 bg-casa-700 text-white flex flex-col items-center justify-center py-6 md:py-0">
          <span className="text-4xl md:text-5xl font-light">{day}</span>
          <span className="text-sm uppercase tracking-wider opacity-90">{month}</span>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-8">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <h3 className="text-2xl md:text-3xl font-light text-casa-800 mb-3">
                {title}
              </h3>

              <div className="flex flex-wrap gap-4 text-casa-600 mb-4">
                <span className="flex items-center gap-1.5 text-sm">
                  <Calendar className="h-4 w-4 text-casa-500" />
                  <span className="capitalize">{fullDate}</span>
                </span>
                <span className="flex items-center gap-1.5 text-sm">
                  <Clock className="h-4 w-4 text-casa-500" />
                  {time}
                </span>
                <span className="flex items-center gap-1.5 text-sm">
                  <MapPin className="h-4 w-4 text-casa-500" />
                  {location}
                </span>
              </div>

              {description && (
                <p className="text-casa-600 leading-relaxed">
                  {description}
                </p>
              )}
            </div>

            {/* Image */}
            {imageUrl && (
              <div className="lg:w-48 flex-shrink-0">
                <img
                  src={imageUrl}
                  alt={title}
                  className="w-full h-32 lg:h-full object-cover rounded-xl"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
