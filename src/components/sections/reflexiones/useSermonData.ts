
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SermonProps } from "./SermonCard";

// Datos de ejemplo como fallback
const fallbackSermons: SermonProps[] = [
  {
    title: "El amor que transforma",
    speaker: "Brent Curtis",
    date: "3 Sep 2023",
    spotifyLink: `https://open.spotify.com/show/0V0M4hBslDmQ8o2y9Rp61E`,
    image: "/lovable-uploads/530f4d22-998f-4e6e-a3b4-ec8c788e3098.png"
  },
  {
    title: "Comunidad inclusiva",
    speaker: "Patricio Browne",
    date: "27 Ago 2023",
    spotifyLink: `https://open.spotify.com/show/0V0M4hBslDmQ8o2y9Rp61E`,
    image: "/lovable-uploads/f29336e6-582e-4bd6-8fbf-e8fe350391e7.png"
  },
  {
    title: "Fe y esperanza",
    speaker: "Fiona Fraser",
    date: "20 Ago 2023",
    spotifyLink: `https://open.spotify.com/show/0V0M4hBslDmQ8o2y9Rp61E`,
    image: "/lovable-uploads/105a46c3-8fe4-429c-af7d-79a85edc4694.png"
  },
  {
    title: "El camino de la compasión",
    speaker: "Claudia Araya",
    date: "13 Ago 2023",
    spotifyLink: `https://open.spotify.com/show/0V0M4hBslDmQ8o2y9Rp61E`,
    image: "/lovable-uploads/10870cef-f487-456b-8140-5c04bf8e4312.png"
  }
];

export interface SermonDataResult {
  recentSermons: SermonProps[];
  isLoading: boolean;
  showInfo: any | null;
  spotifyLink: string;
}

export function useSermonData() {
  const [recentSermons, setRecentSermons] = useState<SermonProps[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInfo, setShowInfo] = useState<any>(null);

  // ID requerido para la API de Spotify
  const CASA_SPOTIFY_SHOW_ID = "0V0M4hBslDmQ8o2y9Rp61E";

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

  return { recentSermons, isLoading, showInfo, spotifyLink };
}
