import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

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

export function Proposito() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  // Subtle parallax for the image
  const imageY = useTransform(scrollYProgress, [0, 1], [20, -20]);

  return (
    <section
      ref={sectionRef}
      id="proposito"
      className="section bg-casa-50 noise-texture overflow-hidden relative"
    >
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-amber-50/30 to-transparent pointer-events-none" />
      <div className="absolute bottom-20 left-10 w-24 h-24 border border-casa-200/40 rounded-full opacity-40" />

      <div className="container-custom relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Text Content */}
          <motion.div
            className="relative"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {/* Decorative accent line */}
            <motion.div
              className="decorative-line mb-8 bg-amber-400"
              variants={itemVariants}
            />

            <motion.h2
              className="heading-dramatic font-light text-casa-800 mb-8 relative z-10"
              variants={itemVariants}
            >
              Sentido & Propósito
            </motion.h2>

            <div className="space-y-6 relative z-10">
              <motion.p
                className="text-xl text-casa-600 leading-relaxed"
                variants={itemVariants}
              >
                Nuestra CASA surge como un faro de inclusión, igualdad y amor incondicional. Fundados en la visión de un cristianismo renovado y acogedor, nos esforzamos por ser un refugio para aquellos en busca de una espiritualidad que valora y celebra nuestras singularidades.
              </motion.p>

              <motion.p
                className="text-casa-500 leading-relaxed"
                variants={itemVariants}
              >
                En CASA, creemos que la fe es una conversación en constante evolución, permitiéndonos reflejar una imagen de Dios compasiva y llena de gracia.
              </motion.p>

              <motion.p
                className="text-casa-500 leading-relaxed italic border-l-2 border-amber-400/60 pl-4"
                variants={itemVariants}
              >
                Podríamos contarte más sobre lo que creemos, pero pensamos que la mejor forma de averiguarlo es conociéndonos. ¡Ven a visitarnos!
              </motion.p>
            </div>

            {/* Bottom decorative element */}
            <motion.div
              className="mt-10 flex items-center gap-3"
              variants={itemVariants}
            >
              <div className="w-2 h-2 bg-amber-400 rounded-full" />
              <div className="w-1 h-1 bg-casa-300 rounded-full" />
              <div className="w-1 h-1 bg-casa-200 rounded-full" />
            </motion.div>
          </motion.div>

          {/* Image */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            viewport={{ once: true }}
          >
            {/* Decorative frame behind image */}
            <div className="absolute -top-4 -right-4 w-full h-full border-2 border-amber-200/40 rounded-2xl -z-10" />

            <motion.div
              className="relative h-[400px] md:h-[500px] rounded-2xl overflow-hidden shadow-dramatic"
              style={{ y: imageY }}
              whileHover={{
                scale: 1.02,
                transition: { type: "spring", stiffness: 300 }
              }}
            >
              <img
                alt="Comunidad CASA"
                className="absolute inset-0 w-full h-full object-cover"
                src="/lovable-uploads/edce4927-d243-4828-83bc-9bd3c8d52b8f.jpg"
                loading="lazy"
              />
              {/* Subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-casa-900/10 via-transparent to-transparent" />
            </motion.div>

            {/* Bottom decorative element */}
            <div className="absolute -bottom-3 -left-3 w-20 h-20 border-2 border-casa-200/40 rounded-xl -z-10" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
