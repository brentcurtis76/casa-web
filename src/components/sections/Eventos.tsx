
import { EventCalendar } from '@/components/calendar/EventCalendar';
import { motion } from 'framer-motion';

export function Eventos() {
  return (
    <section id="eventos" className="section bg-white">
      <div className="container-custom">
        <motion.h2
          className="text-3xl md:text-4xl font-bold text-center text-casa-700 mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          Próximos Eventos
        </motion.h2>
        <motion.p
          className="text-lg text-center max-w-3xl mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true }}
        >
          Mantente al día con nuestras actividades y celebraciones. ¡No te pierdas ningún evento de nuestra comunidad!
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <EventCalendar />
        </motion.div>
      </div>
    </section>
  );
}
