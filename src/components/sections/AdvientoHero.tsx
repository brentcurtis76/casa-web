import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin } from "lucide-react";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 25 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

export function AdvientoHero() {
  const scrollToEventos = () => {
    const eventosSection = document.getElementById('eventos');
    if (eventosSection) {
      const headerOffset = 80;
      const elementPosition = eventosSection.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section className="section relative overflow-hidden bg-gradient-to-b from-[#F7F7F7] via-white to-white noise-texture min-h-[90vh] flex items-center">
      {/* Subtle radial glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          className="w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(212,168,83,0.08) 0%, rgba(212,168,83,0.03) 40%, rgba(212,168,83,0) 70%)"
          }}
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.5, 0.8, 0.5]
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Decorative geometric elements */}
      <div className="absolute top-20 left-10 w-32 h-32 border border-[#D4A853]/20 rounded-full opacity-40" />
      <div className="absolute bottom-32 right-16 w-20 h-20 border border-[#E5E5E5] rotate-45 opacity-30" />
      <div className="absolute top-1/3 right-10 w-1 h-16 bg-gradient-to-b from-[#D4A853]/15 to-transparent" />

      <div className="container-custom relative z-10">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {/* Overline with decorative elements */}
          <motion.div
            className="flex items-center justify-center gap-4 mb-6"
            variants={itemVariants}
          >
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#D4A853]/50" />
            <p className="text-sm tracking-[0.2em] uppercase text-[#8A8A8A] font-mont font-medium">
              Año Nuevo 2026
            </p>
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#D4A853]/50" />
          </motion.div>

          {/* Scripture Reference */}
          <motion.p
            variants={itemVariants}
            className="text-[#8A8A8A] text-sm md:text-base font-serif italic mb-6 tracking-wide"
          >
            Apocalipsis 21:5
          </motion.p>

          {/* Main Scripture Quote */}
          <motion.div variants={itemVariants} className="mb-8">
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light leading-tight text-[#1A1A1A] mb-2">
              <span className="text-[#D4A853]">"</span>
              He aquí, yo hago
            </h1>
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light leading-tight text-[#1A1A1A]">
              <span className="text-[#D4A853]">nuevas todas las cosas</span>
              <span className="text-[#D4A853]">"</span>
            </h1>
          </motion.div>

          {/* Decorative Separator - Brand Style */}
          <motion.div
            variants={itemVariants}
            className="flex items-center justify-center gap-3 mb-10"
          >
            <div className="w-16 h-px bg-[#E5E5E5]" />
            <div className="w-2 h-2 rounded-full bg-[#D4A853]" />
            <div className="w-16 h-px bg-[#E5E5E5]" />
          </motion.div>

          {/* Invitation Text */}
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl lg:text-2xl text-[#555555] font-mont font-light mb-12 max-w-xl mx-auto leading-relaxed"
          >
            Te invitamos a comenzar el año juntos en nuestra{" "}
            <span className="text-[#1A1A1A] font-normal">primera liturgia dominical de 2026</span>
          </motion.p>

          {/* Event Details Card - Brand Style */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-lg border border-[#E5E5E5] p-6 md:p-8 mb-10 max-w-md mx-auto shadow-sm"
          >
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-full bg-[#D4A853]/10">
                  <Calendar className="w-5 h-5 text-[#D4A853]" />
                </div>
                <div className="text-left">
                  <p className="text-[#8A8A8A] text-xs uppercase tracking-wider font-mont mb-0.5">Fecha</p>
                  <p className="text-base text-[#1A1A1A] font-mont font-medium">Domingo, 4 de Enero</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-full bg-[#D4A853]/10">
                  <Clock className="w-5 h-5 text-[#D4A853]" />
                </div>
                <div className="text-left">
                  <p className="text-[#8A8A8A] text-xs uppercase tracking-wider font-mont mb-0.5">Hora</p>
                  <p className="text-base text-[#1A1A1A] font-mont font-medium">11:00 AM</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-full bg-[#D4A853]/10">
                  <MapPin className="w-5 h-5 text-[#D4A853]" />
                </div>
                <div className="text-left">
                  <p className="text-[#8A8A8A] text-xs uppercase tracking-wider font-mont mb-0.5">Lugar</p>
                  <p className="text-base text-[#1A1A1A] font-mont font-medium">CASA</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* CTA Button - Brand Primary Style */}
          <motion.div variants={itemVariants}>
            <Button
              size="lg"
              className="bg-[#1A1A1A] hover:bg-[#333333] text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 px-10 py-6 text-base font-mont font-medium rounded-full"
              onClick={scrollToEventos}
            >
              Acompáñanos
            </Button>
          </motion.div>

          {/* Tagline */}
          <motion.p
            variants={itemVariants}
            className="mt-10 text-[#8A8A8A] text-sm font-mont tracking-wide italic"
          >
            Un espacio de amor, inclusión y esperanza para todos
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
