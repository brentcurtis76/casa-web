
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Configuración de CORS para permitir solicitudes desde el frontend
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Controlador principal de la función Edge
serve(async (req) => {
  // Manejar solicitudes preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
    
    if (!accessToken) {
      throw new Error("Falta el token de acceso de Instagram");
    }
    
    console.log("Obteniendo datos de Instagram...");
    
    // Verificar validez del token primero
    const debugResponse = await fetch(
      `https://graph.instagram.com/debug_token?input_token=${accessToken}&access_token=${accessToken}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    
    const debugData = await debugResponse.json();
    
    if (debugData.error) {
      console.error("Error de validación de token:", debugData);
      throw new Error(`Token de Instagram inválido: ${debugData.error.message}`);
    }
    
    // Obtener media del usuario usando el token de acceso
    const response = await fetch(
      `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp&access_token=${accessToken}&limit=6`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    
    if (!response.ok || data.error) {
      console.error("Error al obtener datos de Instagram:", data);
      throw new Error(`Error al obtener datos de Instagram: ${data.error?.message || 'Error desconocido'}`);
    }
    
    console.log(`Se obtuvieron ${data.data?.length || 0} posts de Instagram`);
    
    // Formatear los datos para el frontend
    const formattedPosts = data.data.map(post => ({
      id: post.id,
      imageUrl: post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url,
      caption: post.caption || "",
      permalink: post.permalink,
      timestamp: post.timestamp
    }));

    // Obtener información del usuario
    const userResponse = await fetch(
      `https://graph.instagram.com/me?fields=username,account_type,media_count&access_token=${accessToken}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const userData = await userResponse.json();
    
    if (!userResponse.ok || userData.error) {
      console.error("Error al obtener datos del usuario de Instagram:", userData);
      throw new Error(`Error al obtener datos del usuario: ${userData.error?.message || 'Error desconocido'}`);
    }
    
    // Devolver la respuesta con los posts formateados y la información del usuario
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          posts: formattedPosts,
          user: {
            username: userData.username,
            accountType: userData.account_type,
            mediaCount: userData.media_count
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
        error: error.message || "Error desconocido al obtener datos de Instagram"
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
