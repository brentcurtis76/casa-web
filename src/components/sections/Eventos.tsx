
import { EventCalendar } from '@/components/calendar/EventCalendar';

export function Eventos() {
  return (
    <section id="eventos" className="section">
      <div className="container-custom">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-casa-700 mb-8">
          Próximos Eventos
        </h2>
        <p className="text-lg text-center max-w-3xl mx-auto mb-12">
          Mantente al día con nuestras actividades y celebraciones. ¡No te pierdas ningún evento de nuestra comunidad!
        </p>
        
        <EventCalendar />
      </div>
    </section>
  );
}
