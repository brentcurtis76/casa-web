
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Configuración de CORS para permitir solicitudes desde el frontend
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// El token de Instagram Graph API vive únicamente en los secretos de la función:
//   supabase secrets set INSTAGRAM_ACCESS_TOKEN=<value> --project-ref <casa-ref>
// Nunca se escribe en el código, en URLs ni en los logs.
const INSTAGRAM_ACCESS_TOKEN = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
const GRAPH_API = "https://graph.instagram.com";

interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  permalink: string;
  thumbnail_url?: string;
  timestamp: string;
}

async function graphGet(path: string, token: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${GRAPH_API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const apiError = data.error as { message?: string } | undefined;
  if (!response.ok || apiError) {
    // Solo se registra el estado HTTP; nunca la respuesta completa.
    console.error(`Instagram Graph API error (HTTP ${response.status}) on ${path.split("?")[0]}`);
    throw new Error(`Error al obtener datos de Instagram: ${apiError?.message ?? "Error desconocido"}`);
  }
  return data;
}

// Controlador principal de la función Edge
serve(async (req) => {
  // Manejar solicitudes preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!INSTAGRAM_ACCESS_TOKEN) {
      throw new Error("Falta el token de acceso de Instagram (secreto INSTAGRAM_ACCESS_TOKEN)");
    }

    // Obtener media del usuario
    const media = await graphGet(
      "/me/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp&limit=6",
      INSTAGRAM_ACCESS_TOKEN,
    );
    const posts = (Array.isArray(media.data) ? media.data : []) as InstagramMedia[];
    console.log(`Se obtuvieron ${posts.length} posts de Instagram`);

    // Formatear los datos para el frontend
    const formattedPosts = posts.map((post) => ({
      id: post.id,
      imageUrl: post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url,
      caption: post.caption || "",
      permalink: post.permalink,
      timestamp: post.timestamp,
    }));

    // Obtener información del usuario
    const userData = await graphGet("/me?fields=username,account_type,media_count", INSTAGRAM_ACCESS_TOKEN);

    // Devolver la respuesta con los posts formateados y la información del usuario
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          posts: formattedPosts,
          user: {
            username: userData.username,
            accountType: userData.account_type,
            mediaCount: userData.media_count,
          },
        },
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error en la función Edge instagram-feed:", error instanceof Error ? error.message : "error");

    // Devolver respuesta de error
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido al obtener datos de Instagram",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
