
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Configuración de CORS para permitir solicitudes desde el frontend
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Función para obtener el token de acceso de Spotify
async function getSpotifyToken() {
  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
  
  if (!clientId || !clientSecret) {
    throw new Error("Faltan las credenciales de Spotify (CLIENT_ID o CLIENT_SECRET)");
  }

  const authString = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authString}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Error al obtener token de Spotify:", data);
    throw new Error(`Error de autenticación con Spotify: ${data.error}`);
  }

  return data.access_token;
}

// Función para obtener los episodios del podcast
async function getShowEpisodes(token, showId) {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/shows/${showId}/episodes?market=ES&limit=4`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Error al obtener episodios:", data);
      throw new Error(`Error al obtener episodios: ${data.error?.message || 'Error desconocido'}`);
    }

    return data.items;
  } catch (error) {
    console.error("Error al obtener episodios:", error);
    throw error;
  }
}

// Función para obtener información del show
async function getShowInfo(token, showId) {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/shows/${showId}?market=ES`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Error al obtener info del show:", data);
      throw new Error(`Error al obtener info del show: ${data.error?.message || 'Error desconocido'}`);
    }

    return data;
  } catch (error) {
    console.error("Error al obtener info del show:", error);
    throw error;
  }
}

// Función para procesar y formatear las fechas en español
function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-ES', { 
    day: 'numeric',
    month: 'short', 
    year: 'numeric' 
  }).format(date);
}

// Controlador principal de la función Edge
serve(async (req) => {
  // Manejar solicitudes preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let showId = "0V0M4hBslDmQ8o2y9Rp61E"; // ID por defecto del podcast de CASA
    
    // Intentar leer el showId del cuerpo de la solicitud
    try {
      const body = await req.json();
      if (body && body.showId) {
        showId = body.showId;
      }
    } catch (e) {
      console.log("No se proporcionó un cuerpo de solicitud o no es un JSON válido, usando ID por defecto");
    }
    
    console.log(`Obteniendo datos para el podcast con ID: ${showId}`);
    
    // Obtener token de Spotify
    const token = await getSpotifyToken();
    console.log("Token de Spotify obtenido correctamente");
    
    // Obtener los episodios recientes
    const episodes = await getShowEpisodes(token, showId);
    console.log(`Se obtuvieron ${episodes.length} episodios`);
    
    // Obtener información del show
    const showInfo = await getShowInfo(token, showId);
    console.log("Información del show obtenida correctamente");
    
    // Procesar y formatear los episodios para la respuesta
    const formattedEpisodes = episodes.map(episode => ({
      title: episode.name,
      speaker: showInfo.publisher, // Usar el publisher como speaker por defecto
      date: formatDate(episode.release_date),
      spotifyLink: episode.external_urls.spotify,
      image: episode.images[0]?.url || showInfo.images[0]?.url,
      description: episode.description
    }));

    // Devolver la respuesta con los episodios formateados
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          episodes: formattedEpisodes,
          showInfo: {
            name: showInfo.name,
            description: showInfo.description,
            spotifyLink: showInfo.external_urls.spotify,
            publisher: showInfo.publisher,
            image: showInfo.images[0]?.url
          }
        }
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error en la función Edge:", error);
    
    // Devolver respuesta de error
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Error desconocido al obtener datos de Spotify"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
