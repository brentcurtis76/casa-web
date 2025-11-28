import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardFooter } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import { SermonCard } from "./reflexiones/SermonCard";
import { useSermonData } from "./reflexiones/useSermonData";
import { motion } from "framer-motion";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

export function Sermones() {
  const { recentSermons, isLoading, spotifyLink } = useSermonData();

  return (
    <section id="sermones" className="section bg-white noise-texture overflow-hidden relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-casa-50/50 to-transparent" />
      <div className="absolute bottom-20 right-10 w-32 h-32 border border-amber-200/30 rounded-full opacity-40" />
      <div className="absolute top-1/2 left-0 w-2 h-24 bg-gradient-to-b from-casa-200/30 via-casa-200/30 to-transparent" />

      <div className="container-custom relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.div
            className="flex items-center justify-center gap-4 mb-6"
            variants={itemVariants}
          >
            <div className="w-16 h-px bg-gradient-to-r from-transparent to-casa-300" />
            <div className="w-2 h-2 bg-amber-400 rounded-full" />
            <div className="w-16 h-px bg-gradient-to-l from-transparent to-casa-300" />
          </motion.div>

          <motion.h2
            className="heading-dramatic font-light text-casa-800 mb-6"
            variants={itemVariants}
          >
            Últimas Reflexiones
          </motion.h2>

          <motion.p
            className="text-xl text-casa-600 max-w-2xl mx-auto leading-relaxed"
            variants={itemVariants}
          >
            Explora nuestros mensajes más recientes y déjate inspirar por palabras de amor, fe y esperanza.
          </motion.p>
        </motion.div>

        {/* Cards Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {isLoading ? (
            Array(4).fill(0).map((_, index) => (
              <motion.div key={index} variants={cardVariants}>
                <Card className="overflow-hidden animate-pulse shadow-elevated">
                  <div className="aspect-video bg-gray-200"></div>
                  <CardHeader className="pb-2">
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardFooter>
                    <div className="h-9 bg-gray-200 rounded w-full"></div>
                  </CardFooter>
                </Card>
              </motion.div>
            ))
          ) : (
            recentSermons.map((sermon, index) => (
              <motion.div
                key={index}
                variants={cardVariants}
                whileHover={{
                  y: -8,
                  scale: 1.02,
                  transition: { type: "spring", stiffness: 300 }
                }}
                className="hover-lift"
              >
                <SermonCard
                  title={sermon.title}
                  speaker={sermon.speaker}
                  date={sermon.date}
                  spotifyLink={sermon.spotifyLink}
                  image={sermon.image}
                />
              </motion.div>
            ))
          )}
        </motion.div>

        {/* CTA Button */}
        <motion.div
          className="text-center mt-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          viewport={{ once: true }}
        >
          <Button
            size="lg"
            variant="outline"
            className="border-2 border-casa-300 text-casa-700 hover:bg-casa-50 hover:border-casa-400 shadow-sm hover:shadow-lg transition-all duration-300"
          >
            <a href={spotifyLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              Ver todas las reflexiones
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
