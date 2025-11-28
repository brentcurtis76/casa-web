import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

// Animation variants
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

const imageContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2
    }
  }
};

const imageVariants = {
  hidden: { opacity: 0, scale: 0.85, y: 40 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

export function Equipo() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  // Parallax for images
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -25]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -15]);

  return (
    <section
      ref={sectionRef}
      id="equipo"
      className="section bg-white noise-texture overflow-hidden relative"
    >
      {/* Decorative background elements */}
      <div className="absolute top-20 right-20 w-40 h-40 border border-casa-100 rounded-full opacity-30" />
      <div className="absolute bottom-40 left-0 w-32 h-1 bg-gradient-to-r from-amber-200/40 to-transparent" />

      <div className="container-custom relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.div
            className="flex items-center justify-center gap-4 mb-6"
            variants={itemVariants}
          >
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-casa-300" />
            <div className="w-2 h-2 bg-amber-400 rounded-full" />
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-casa-300" />
          </motion.div>
          <motion.h2
            className="heading-dramatic font-light text-casa-800"
            variants={itemVariants}
          >
            Equipo y Liderazgo
          </motion.h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 mb-20">
          {/* Staggered Overlapping Images */}
          <motion.div
            className="relative h-[420px] md:h-[480px]"
            variants={imageContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {/* Main large image - back layer */}
            <motion.div
              className="absolute top-0 right-0 w-[70%] h-[65%] rounded-2xl overflow-hidden shadow-dramatic z-10"
              style={{ y: y1 }}
              variants={imageVariants}
              whileHover={{
                scale: 1.03,
                rotate: 1,
                transition: { type: "spring", stiffness: 300 }
              }}
            >
              <img
                alt="Comunidad CASA"
                className="object-cover w-full h-full"
                src="/lovable-uploads/6557351c-1481-42de-b3be-b9077ea618d7.png"
                loading="lazy"
              />
            </motion.div>

            {/* Left overlapping image with polaroid effect */}
            <motion.div
              className="absolute top-[15%] left-0 w-[55%] h-[55%] image-polaroid rounded-xl overflow-hidden z-20"
              style={{ y: y2 }}
              variants={imageVariants}
              whileHover={{
                scale: 1.05,
                rotate: -2,
                transition: { type: "spring", stiffness: 300 }
              }}
            >
              <img
                alt="Comunidad CASA"
                className="object-cover w-full h-full"
                src="/lovable-uploads/8fb1b293-53ea-495a-8af0-80ca5e683c9b.png"
                loading="lazy"
              />
            </motion.div>

            {/* Bottom center image */}
            <motion.div
              className="absolute bottom-0 left-[20%] w-[50%] h-[45%] rounded-xl overflow-hidden shadow-float z-30"
              style={{ y: y3 }}
              variants={imageVariants}
              whileHover={{
                scale: 1.05,
                rotate: 2,
                transition: { type: "spring", stiffness: 300 }
              }}
            >
              <img
                src="/lovable-uploads/530f4d22-998f-4e6e-a3b4-ec8c788e3098.png"
                alt="Comunidad CASA"
                className="object-cover w-full h-full"
                loading="lazy"
              />
            </motion.div>

            {/* Decorative elements */}
            <div className="absolute -bottom-4 -right-4 w-20 h-20 border-2 border-amber-200/50 rounded-lg -z-10" />
            <div className="absolute top-[40%] -left-6 w-3 h-16 bg-gradient-to-b from-casa-200/30 to-transparent" />
          </motion.div>

          {/* Equipo Pastoral Description */}
          <motion.div
            className="flex flex-col justify-center"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <motion.div
              className="decorative-line mb-6 bg-casa-300"
              variants={itemVariants}
            />
            <motion.h3
              className="text-2xl md:text-3xl font-light mb-6 text-casa-800"
              variants={itemVariants}
            >
              Equipo Pastoral
            </motion.h3>
            <motion.p
              className="text-lg text-casa-600 leading-relaxed mb-6"
              variants={itemVariants}
            >
              El acompañamiento espiritual de nuestra <strong className="text-casa-700">CASA</strong> reside en su apasionado Equipo Pastoral,
              liderado por Brent Curtis. A su lado, co-lideran Patricio Browne (que sigue como pastor
              titular ante la diócesis mientras dure el proceso de ordenación de Brent), Fiona Fraser,
              Claudia Araya, Arnoldo Cisternas, Mónica Van Ginderthaelen y Tomás Diéguez, cada uno
              aportando sus propias luces y perspectivas para enriquecer la misión de la iglesia.
            </motion.p>
            <motion.p
              className="text-casa-500 leading-relaxed"
              variants={itemVariants}
            >
              Eugenia Riffo gestiona con precisión y dedicación las áreas de Administración y Finanzas,
              garantizando la sostenibilidad y crecimiento de nuestra comunidad.
            </motion.p>
          </motion.div>
        </div>

        {/* Divider */}
        <motion.div
          className="flex items-center justify-center gap-6 my-16"
          initial={{ opacity: 0, scaleX: 0 }}
          whileInView={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          viewport={{ once: true }}
        >
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-casa-200 to-transparent" />
        </motion.div>

        {/* Concilio Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Concilio Text */}
          <motion.div
            className="order-2 lg:order-1"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <motion.div
              className="decorative-line mb-6 bg-amber-400"
              variants={itemVariants}
            />
            <motion.h3
              className="text-2xl md:text-3xl font-light mb-6 text-casa-800"
              variants={itemVariants}
            >
              Concilio
            </motion.h3>
            <motion.p
              className="text-lg text-casa-600 leading-relaxed"
              variants={itemVariants}
            >
              En cuanto a las decisiones y guías estratégicas, el Concilio de <strong className="text-casa-700">CASA</strong>, compuesto por
              Andrew Warren, Victor Córdova, Aurora Fontecilla, Anita Pinchart, Georgina García,
              Nevenka Echegaray, Melanie Sharman, Pablo Rebolledo y José Martínez,
              desempeña un papel crucial, velando por la integridad y el rumbo de nuestra comunidad.
            </motion.p>
            <motion.p
              className="text-casa-500 leading-relaxed mt-4"
              variants={itemVariants}
            >
              Juntos, cada miembro de nuestro equipo y concilio dedica su energía y amor para asegurar
              que <strong className="text-casa-600">CASA</strong> sea un hogar inclusivo, acogedor y en constante evolución.
            </motion.p>
          </motion.div>

          {/* Concilio Image */}
          <motion.div
            className="order-1 lg:order-2 relative"
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
            viewport={{ once: true }}
          >
            <motion.div
              className="aspect-video relative overflow-hidden rounded-2xl shadow-dramatic"
              whileHover={{
                scale: 1.02,
                transition: { type: "spring", stiffness: 300 }
              }}
            >
              <img
                alt="Concilio de CASA"
                className="w-full h-full object-cover"
                src="/lovable-uploads/92c3ec9a-16cb-405a-86d6-0914b11e5f70.jpg"
                loading="lazy"
              />
              {/* Subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-casa-900/10 via-transparent to-transparent" />
            </motion.div>
            {/* Decorative frame */}
            <div className="absolute -bottom-3 -left-3 w-24 h-24 border-2 border-casa-200/40 rounded-xl -z-10" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
