import { MoveRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

// Animation variants for staggered reveal
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
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

const imageVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 40 },
  visible: (delay: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.7,
      delay: delay,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  })
};

function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  // Parallax transforms for each image (different speeds)
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -30]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -20]);
  const y4 = useTransform(scrollYProgress, [0, 1], [0, -40]);

  const scrollToParticipar = () => {
    const participarSection = document.getElementById('participar');
    if (participarSection) {
      participarSection.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };

  return (
    <section
      ref={sectionRef}
      className="py-20 md:py-32 bg-casa-50 noise-texture overflow-hidden"
      aria-labelledby="bienvenidos-heading"
    >
      <div className="container-custom">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-center">
          {/* Text Content */}
          <motion.div
            className="flex-1 order-2 lg:order-1 max-w-xl"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {/* Decorative accent */}
            <motion.div
              className="decorative-line mb-8 bg-casa-400"
              variants={itemVariants}
            />

            <motion.h2
              id="bienvenidos-heading"
              className="heading-dramatic font-light text-casa-800 mb-8"
              variants={itemVariants}
            >
              Un espacio de amor, inclusión y esperanza
            </motion.h2>

            <motion.p
              className="text-xl text-casa-600 mb-6 leading-relaxed"
              variants={itemVariants}
            >
              Una comunidad abierta, inspirada en Jesús, donde cada persona es vista y celebrada en su singularidad.
            </motion.p>

            <motion.p
              className="text-casa-500 mb-10 leading-relaxed"
              variants={itemVariants}
            >
              Un espacio seguro para explorar tu espiritualidad, crecer con otros y vivir con propósito. Aquí encontrarás una fe que celebra la diversidad y abraza a todos sin condiciones.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4"
              variants={itemVariants}
            >
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 border-2 border-casa-300 text-casa-700 hover:bg-white hover:border-casa-400 hover:shadow-lg transition-all duration-300"
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
                className="gap-2 bg-casa-700 hover:bg-casa-800 shadow-lg hover:shadow-xl transition-all duration-300"
                onClick={scrollToParticipar}
              >
                Participa
                <MoveRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </motion.div>

          {/* Overlapping Image Collage */}
          <div className="flex-1 order-1 lg:order-2 relative h-[400px] md:h-[500px] lg:h-[550px] w-full">
            {/* Main large image - bottom layer */}
            <motion.div
              className="absolute top-0 right-0 w-[75%] md:w-[70%] h-[65%] rounded-3xl overflow-hidden shadow-dramatic z-10"
              style={{ y: y1 }}
              custom={0}
              variants={imageVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{
                scale: 1.03,
                rotate: 1,
                transition: { type: "spring", stiffness: 300 }
              }}
            >
              <img
                alt="Momentos en familia"
                className="w-full h-full object-cover"
                src="https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/public/images/pato%20y%20nieto.jpg"
                loading="eager"
              />
            </motion.div>

            {/* Cross image - overlapping left side with polaroid effect */}
            <motion.div
              className="absolute top-[15%] left-0 w-[45%] md:w-[40%] h-[48%] image-polaroid rounded-2xl overflow-hidden z-20"
              style={{ y: y2 }}
              custom={0.15}
              variants={imageVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{
                scale: 1.05,
                rotate: -2,
                transition: { type: "spring", stiffness: 300 }
              }}
            >
              <img
                alt="La cruz de nuestra iglesia"
                className="w-full h-full object-cover object-[85%_30%] scale-[1.60] rotate-[5deg]"
                src="https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/public/images/iglesia.jpg"
                loading="eager"
              />
            </motion.div>

            {/* Bottom right image - overlapping */}
            <motion.div
              className="absolute bottom-[5%] right-[5%] w-[50%] md:w-[45%] h-[40%] rounded-2xl overflow-hidden shadow-float z-30"
              style={{ y: y3 }}
              custom={0.3}
              variants={imageVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{
                scale: 1.05,
                rotate: 2,
                transition: { type: "spring", stiffness: 300 }
              }}
            >
              <img
                alt="Comunidad CASA reunida"
                className="w-full h-full object-cover"
                src="/lovable-uploads/a02c439d-5a66-4b2f-8bd0-7897d174069f.jpg"
                loading="eager"
              />
            </motion.div>

            {/* Small accent image - bottom left */}
            <motion.div
              className="absolute bottom-[0%] left-[10%] w-[35%] md:w-[30%] h-[35%] rounded-xl overflow-hidden shadow-elevated z-25"
              style={{ y: y4 }}
              custom={0.45}
              variants={imageVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{
                scale: 1.08,
                transition: { type: "spring", stiffness: 300 }
              }}
            >
              <img
                alt="Comunidad CASA"
                className="w-full h-full object-cover object-[105%_center] scale-[1.20]"
                src="https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/public/images/rafa%20y%20renato.jpg"
                loading="eager"
              />
            </motion.div>

            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 border-2 border-casa-200 rounded-full opacity-30 z-0" />
            <div className="absolute bottom-10 -left-6 w-16 h-16 bg-amber-100 rounded-full opacity-40 z-0" />
          </div>
        </div>
      </div>
    </section>
  );
}

export { Hero };
