
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";
import { SermonCard } from "./reflexiones/SermonCard";
import { useSermonData } from "./reflexiones/useSermonData";

export function Sermones() {
  const { recentSermons, isLoading, spotifyLink } = useSermonData();

  return (
    <section id="sermones" className="section bg-casa-50">
      <div className="container-custom">
        <h2 className="text-3xl md:text-4xl font-light text-center text-casa-800 mb-8">
          Últimas Reflexiones
        </h2>
        <p className="text-lg text-center max-w-3xl mx-auto mb-12">
          Explora nuestros mensajes más recientes y déjate inspirar por palabras de amor, fe y esperanza.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            // Mostrar esqueletos de carga mientras se obtienen los datos
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
              <SermonCard
                key={index}
                title={sermon.title}
                speaker={sermon.speaker}
                date={sermon.date}
                spotifyLink={sermon.spotifyLink}
                image={sermon.image}
              />
            ))
          )}
        </div>

        <div className="text-center mt-12">
          <Button size="lg" variant="outline">
            <a href={spotifyLink} target="_blank" rel="noopener noreferrer" className="flex items-center">
              Ver todas las reflexiones
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
