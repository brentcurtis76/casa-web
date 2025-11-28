import { MoveRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion } from "framer-motion";

function Hero() {
  const scrollToParticipar = () => {
    const participarSection = document.getElementById('participar');
    if (participarSection) {
      participarSection.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };

  return (
    <section className="py-16 md:py-24 bg-casa-50" aria-labelledby="bienvenidos-heading">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
          {/* Text Content */}
          <div className="flex-1 order-2 lg:order-1">
            <motion.h2
              id="bienvenidos-heading"
              className="text-4xl md:text-5xl font-light text-casa-800 mb-6 leading-tight"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              Un espacio de amor, inclusión y esperanza
            </motion.h2>

            <motion.p
              className="text-lg text-casa-600 mb-6 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
            >
              Una comunidad abierta, inspirada en Jesús, donde cada persona es vista y celebrada en su singularidad.
            </motion.p>

            <motion.p
              className="text-casa-500 mb-8 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
            >
              Un espacio seguro para explorar tu espiritualidad, crecer con otros y vivir con propósito. Aquí encontrarás una fe que celebra la diversidad y abraza a todos sin condiciones.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 transition-transform hover:scale-105 border-casa-300 text-casa-700 hover:bg-white"
                  >
                    <MapPin className="w-4 h-4" />
                    Visítanos
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Nuestras Liturgias</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 py-4">
                    <div>
                      <h3 className="font-medium">Día y Hora</h3>
                      <p className="text-muted-foreground">Domingos, 11:00 AM</p>
                    </div>
                    <div>
                      <h3 className="font-medium">Dirección</h3>
                      <p className="text-muted-foreground">Vicente Pérez Rosales 1765, La Reina, Santiago</p>
                    </div>
                    <div className="mt-2">
                      <iframe
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3329.938189752371!2d-70.5666986!3d-33.4207245!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9662cfa94f2e7d41%3A0x8e14039b12e5c74b!2sVicente%20P%C3%A9rez%20Rosales%201765%2C%20La%20Reina%2C%20Regi%C3%B3n%20Metropolitana!5e0!3m2!1ses!2scl!4v1719528142344!5m2!1ses!2scl"
                        width="100%"
                        height="300"
                        style={{border: 0}}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Mapa de ubicación"
                      />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                size="lg"
                className="gap-2 transition-transform hover:scale-105 bg-casa-700 hover:bg-casa-800"
                onClick={scrollToParticipar}
              >
                Participa
                <MoveRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>

          {/* Four Images - Dynamic Layout */}
          <div className="flex-1 order-1 lg:order-2">
            <div className="grid grid-cols-3 grid-rows-2 gap-3 h-[320px] md:h-[400px]">
              {/* Cross image - larger, spans 2 rows on left */}
              <motion.div
                className="rounded-2xl overflow-hidden shadow-lg row-span-2 col-span-1"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
              >
                <img
                  alt="La cruz de nuestra iglesia"
                  className="w-full h-full object-cover object-[75%_30%] scale-150 rotate-[5deg]"
                  src="https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/public/images/iglesia.jpg"
                  loading="eager"
                />
              </motion.div>
              {/* Top right - wider */}
              <motion.div
                className="rounded-2xl overflow-hidden shadow-lg col-span-2"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
              >
                <img
                  alt="Momentos en familia"
                  className="w-full h-full object-cover"
                  src="https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/public/images/pato%20y%20nieto.jpg"
                  loading="eager"
                />
              </motion.div>
              {/* Bottom middle */}
              <motion.div
                className="rounded-2xl overflow-hidden shadow-lg"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
              >
                <img
                  alt="Comunidad CASA"
                  className="w-full h-full object-cover object-[90%_center] scale-[1.15]"
                  src="https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/public/images/rafa%20y%20renato.jpg"
                  loading="eager"
                />
              </motion.div>
              {/* Bottom right */}
              <motion.div
                className="rounded-2xl overflow-hidden shadow-lg"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
              >
                <img
                  alt="Comunidad CASA reunida"
                  className="w-full h-full object-cover"
                  src="/lovable-uploads/a02c439d-5a66-4b2f-8bd0-7897d174069f.jpg"
                  loading="eager"
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export { Hero };
