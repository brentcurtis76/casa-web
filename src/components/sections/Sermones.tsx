
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardFooter } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import { SermonCard } from "./reflexiones/SermonCard";
import { useSermonData } from "./reflexiones/useSermonData";
import { motion } from "framer-motion";

export function Sermones() {
  const { recentSermons, isLoading, spotifyLink } = useSermonData();

  return (
    <section id="sermones" className="section bg-white">
      <div className="container-custom">
        <motion.h2
          className="text-3xl md:text-4xl font-light text-center text-casa-800 mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          Últimas Reflexiones
        </motion.h2>
        <motion.p
          className="text-lg text-center max-w-3xl mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true }}
        >
          Explora nuestros mensajes más recientes y déjate inspirar por palabras de amor, fe y esperanza.
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            Array(4).fill(0).map((_, index) => (
              <Card key={index} className="overflow-hidden animate-pulse">
                <div className="aspect-video bg-gray-200"></div>
                <CardHeader className="pb-2">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardFooter>
                  <div className="h-9 bg-gray-200 rounded w-full"></div>
                </CardFooter>
              </Card>
            ))
          ) : (
            recentSermons.map((sermon, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
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
        </div>

        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          viewport={{ once: true }}
        >
          <Button size="lg" variant="outline" className="transition-transform hover:scale-105">
            <a href={spotifyLink} target="_blank" rel="noopener noreferrer" className="flex items-center">
              Ver todas las reflexiones
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
