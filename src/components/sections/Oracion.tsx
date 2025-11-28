import { Card, CardContent } from "@/components/ui/card";
import { PrayerRequestForm } from "@/components/prayers/PrayerRequestForm";
import { LockKeyhole, Users, Sparkles } from 'lucide-react';
import { motion } from "framer-motion";

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
  hidden: { opacity: 0, y: 25 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

const featureVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

const features = [
  {
    icon: LockKeyhole,
    title: "Confidencialidad",
    description: "Tus peticiones serán tratadas con absoluta confidencialidad y respeto."
  },
  {
    icon: Users,
    title: "Comunidad en Oración",
    description: "Nuestro equipo de oración estará intercediendo por tus necesidades."
  },
  {
    icon: Sparkles,
    title: "Esperanza Renovada",
    description: "Cree con nosotros que hay poder en la oración comunitaria y en la fe compartida."
  }
];

export function Oracion() {
  return (
    <section id="oracion" className="section bg-gradient-to-br from-casa-50 via-white to-amber-50/30 noise-texture overflow-hidden relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-white to-transparent" />
      <div className="absolute top-20 right-10 w-32 h-32 border border-amber-200/30 rounded-full opacity-40" />
      <div className="absolute bottom-20 left-20 w-20 h-20 border border-casa-200/30 rounded-full opacity-30" />
      <div className="absolute top-1/2 right-0 w-2 h-32 bg-gradient-to-b from-amber-200/30 via-amber-200/30 to-transparent" />

      <div className="container-custom relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left content */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {/* Decorative accent */}
            <motion.div
              className="decorative-line mb-8 bg-amber-400"
              variants={itemVariants}
            />

            <motion.h2
              className="heading-dramatic font-light text-casa-800 mb-6"
              variants={itemVariants}
            >
              Peticiones de Oración
            </motion.h2>

            <motion.p
              className="text-xl text-casa-600 mb-10 leading-relaxed"
              variants={itemVariants}
            >
              En CASA creemos en el poder de la oración compartida. Comparte tus peticiones con nuestra comunidad y juntos las llevaremos ante Dios.
            </motion.p>

            {/* Features */}
            <motion.div
              className="flex flex-col space-y-6"
              variants={containerVariants}
            >
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  className="flex items-start space-x-4 group"
                  variants={featureVariants}
                  custom={index}
                  whileHover={{ x: 8 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <motion.div
                    className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-casa-100 to-casa-50 text-casa-600 flex-shrink-0 group-hover:from-amber-100 group-hover:to-amber-50 group-hover:text-amber-700 transition-all duration-300"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <feature.icon size={22} />
                  </motion.div>
                  <div>
                    <h3 className="font-medium text-casa-800 mb-1 group-hover:text-casa-900 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-casa-500 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Decorative dots */}
            <motion.div
              className="mt-10 flex items-center gap-3"
              variants={itemVariants}
            >
              <div className="w-2 h-2 bg-amber-400 rounded-full" />
              <div className="w-1 h-1 bg-casa-300 rounded-full" />
              <div className="w-1 h-1 bg-casa-200 rounded-full" />
            </motion.div>
          </motion.div>

          {/* Right content - Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            viewport={{ once: true }}
            className="relative"
          >
            {/* Decorative frame behind card */}
            <div className="absolute -top-4 -right-4 w-full h-full border-2 border-amber-200/40 rounded-3xl -z-10" />

            <motion.div
              whileHover={{
                y: -4,
                transition: { type: "spring", stiffness: 300 }
              }}
            >
              <Card className="shadow-dramatic border-none rounded-2xl overflow-hidden bg-white/90 backdrop-blur-sm">
                <CardContent className="p-8">
                  <PrayerRequestForm />
                </CardContent>
              </Card>
            </motion.div>

            {/* Decorative element */}
            <div className="absolute -bottom-3 -left-3 w-16 h-16 border-2 border-casa-200/30 rounded-xl -z-10" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
