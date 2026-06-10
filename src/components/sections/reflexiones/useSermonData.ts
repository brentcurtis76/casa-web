import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SermonProps } from "./SermonCard";

// El programa sigue viviendo en Spotify (alimentado por nuestro feed RSS);
// los datos de los episodios vienen de nuestra propia base de datos, así que
// la web no depende de la API de Spotify (bloqueada para apps sin Premium
// desde feb 2026).
const CASA_SPOTIFY_SHOW_URL =
  "https://open.spotify.com/show/0V0M4hBslDmQ8o2y9Rp61E";

const FALLBACK_IMAGE = "/lovable-uploads/530f4d22-998f-4e6e-a3b4-ec8c788e3098.png";

// Datos de ejemplo mientras no haya episodios publicados en la base de datos.
const fallbackSermons: SermonProps[] = [
  {
    title: "El amor que transforma",
    speaker: "Brent Curtis",
    date: "3 Sep 2023",
    spotifyLink: CASA_SPOTIFY_SHOW_URL,
    image: "/lovable-uploads/530f4d22-998f-4e6e-a3b4-ec8c788e3098.png"
  },
  {
    title: "Comunidad inclusiva",
    speaker: "Patricio Browne",
    date: "27 Ago 2023",
    spotifyLink: CASA_SPOTIFY_SHOW_URL,
    image: "/lovable-uploads/f29336e6-582e-4bd6-8fbf-e8fe350391e7.png"
  },
  {
    title: "Fe y esperanza",
    speaker: "Fiona Fraser",
    date: "20 Ago 2023",
    spotifyLink: CASA_SPOTIFY_SHOW_URL,
    image: "/lovable-uploads/105a46c3-8fe4-429c-af7d-79a85edc4694.png"
  },
  {
    title: "El camino de la compasión",
    speaker: "Claudia Araya",
    date: "13 Ago 2023",
    spotifyLink: CASA_SPOTIFY_SHOW_URL,
    image: "/lovable-uploads/10870cef-f487-456b-8140-5c04bf8e4312.png"
  }
];

export interface SermonDataResult {
  recentSermons: SermonProps[];
  isLoading: boolean;
  spotifyLink: string;
}

/** `yyyy-mm-dd` → "7 Jun 2026" sin sorpresas de zona horaria. */
function formatFecha(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map((n) => parseInt(n, 10));
  return new Date(year, month - 1, day).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function useSermonData(): SermonDataResult {
  const [recentSermons, setRecentSermons] = useState<SermonProps[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEpisodes = async () => {
      try {
        setIsLoading(true);

        const { data, error } = await supabase
          .from("church_podcast_episodes")
          .select(
            "title, speaker, description, episode_date, cover_url, audio_url",
          )
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(4);

        if (error) throw error;

        if (!data || data.length === 0) {
          // Aún no hay episodios autoalojados — mostrar ejemplos sin alarmar.
          setRecentSermons(fallbackSermons);
          return;
        }

        setRecentSermons(
          data.map((ep) => ({
            title: ep.title,
            speaker: ep.speaker ?? "CASA",
            date: formatFecha(ep.episode_date),
            spotifyLink: CASA_SPOTIFY_SHOW_URL,
            image: ep.cover_url ?? FALLBACK_IMAGE,
            description: ep.description ?? undefined,
            audioUrl: ep.audio_url ?? undefined,
          })),
        );
      } catch (error) {
        console.error("Error obteniendo episodios del podcast:", error);
        setRecentSermons(fallbackSermons);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEpisodes();
  }, []);

  return {
    recentSermons,
    isLoading,
    spotifyLink: CASA_SPOTIFY_SHOW_URL,
  };
}
