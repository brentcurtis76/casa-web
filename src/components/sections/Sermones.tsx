
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SermonProps {
  title: string;
  speaker: string;
  date: string;
  spotifyLink: string;
  image: string;
  description?: string;
}

function SermonCard({ title, speaker, date, spotifyLink, image }: SermonProps) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-video relative bg-muted overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <Play className="text-white h-16 w-16" />
        </div>
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl line-clamp-1">{title}</CardTitle>
        <CardDescription>
          {speaker} • {date}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={spotifyLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
            <span>Escuchar en Spotify</span>
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}

export function Sermones() {
  const [recentSermons, setRecentSermons] = useState<SermonProps[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInfo, setShowInfo] = useState<any>(null);

  // ID requerido para la API de Spotify
  const CASA_SPOTIFY_SHOW_ID = "0V0M4hBslDmQ8o2y9Rp61E";
  
  // Placeholder images en caso de que no se puedan obtener desde Spotify
  const placeholderImages = [
    "/lovable-uploads/530f4d22-998f-4e6e-a3b4-ec8c788e3098.png",
    "/lovable-uploads/f29336e6-582e-4bd6-8fbf-e8fe350391e7.png",
    "/lovable-uploads/105a46c3-8fe4-429c-af7d-79a85edc4694.png",
    "/lovable-uploads/10870cef-f487-456b-8140-5c04bf8e4312.png"
  ];

  // Datos de ejemplo como fallback
  const fallbackSermons = [
    {
      id: 1,
      title: "El amor que transforma",
      speaker: "Brent Curtis",
      date: "3 Sep 2023",
      spotifyLink: `https://open.spotify.com/show/${CASA_SPOTIFY_SHOW_ID}`,
      image: "/lovable-uploads/530f4d22-998f-4e6e-a3b4-ec8c788e3098.png"
    },
    {
      id: 2,
      title: "Comunidad inclusiva",
      speaker: "Patricio Browne",
      date: "27 Ago 2023",
      spotifyLink: `https://open.spotify.com/show/${CASA_SPOTIFY_SHOW_ID}`,
      image: "/lovable-uploads/f29336e6-582e-4bd6-8fbf-e8fe350391e7.png"
    },
    {
      id: 3,
      title: "Fe y esperanza",
      speaker: "Fiona Fraser",
      date: "20 Ago 2023",
      spotifyLink: `https://open.spotify.com/show/${CASA_SPOTIFY_SHOW_ID}`,
      image: "/lovable-uploads/105a46c3-8fe4-429c-af7d-79a85edc4694.png"
    },
    {
      id: 4,
      title: "El camino de la compasión",
      speaker: "Claudia Araya",
      date: "13 Ago 2023",
      spotifyLink: `https://open.spotify.com/show/${CASA_SPOTIFY_SHOW_ID}`,
      image: "/lovable-uploads/10870cef-f487-456b-8140-5c04bf8e4312.png"
    }
  ];

  useEffect(() => {
    const fetchSpotifySermons = async () => {
      try {
        setIsLoading(true);
        
        console.log('Obteniendo datos del podcast de Spotify...');
        
        // Llamar a nuestra función Edge en Supabase con la sintaxis correcta
        const { data, error } = await supabase.functions.invoke('spotify-sermones', {
          body: { showId: CASA_SPOTIFY_SHOW_ID }
        });
        
        if (error) {
          throw new Error(`Error al llamar a la función Edge: ${error.message}`);
        }
        
        if (!data.success) {
          throw new Error(`Error en la respuesta de la función Edge: ${data.error}`);
        }
        
        console.log('Datos obtenidos correctamente:', data);
        
        // Actualizar el estado con los datos recibidos
        setRecentSermons(data.data.episodes);
        setShowInfo(data.data.showInfo);
        
        toast({
          title: "Contenido actualizado",
          description: "Se cargaron los episodios más recientes de Spotify",
        });
      } catch (error) {
        console.error("Error obteniendo datos de Spotify:", error);
        
        // Usar datos de ejemplo en caso de error
        setRecentSermons(fallbackSermons);
        
        toast({
          variant: "destructive",
          title: "Error de conexión",
          description: "No se pudo conectar con Spotify. Mostrando datos de ejemplo.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpotifySermons();
  }, []);

  const spotifyLink = showInfo?.spotifyLink || `https://open.spotify.com/show/${CASA_SPOTIFY_SHOW_ID}`;

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
