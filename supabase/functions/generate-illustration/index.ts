/**
 * CASA Illustration Generator Edge Function
 * Genera ilustraciones estilo línea artística usando Nano Banana Pro (gemini-3-pro-image-preview)
 * Texto se genera con Claude Opus 4.5, imágenes con Nano Banana Pro
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Usar GOOGLE_AI_API_KEY que ya está configurado en Supabase secrets
const GEMINI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');

// Modelo: Nano Banana Pro para generación de imágenes
const IMAGE_MODEL = 'gemini-3-pro-image-preview';

// Estilo base para todas las ilustraciones - optimizado para Nano Banana Pro
// Incluye acento ámbar/dorado para consistencia con Brand Kit CASA
const BASE_STYLE_PROMPT = `Create a minimalist artistic illustration with these exact requirements:

COLORS (MANDATORY):
- Main lines: Medium gray (#666666)
- Accent color: Warm amber/gold (#D4A853) - USE THIS COLOR for highlights, key elements, or artistic accents
- Background: Warm cream (#F9F7F5) - NOT white, use this exact warm cream tone

STYLE:
- Single continuous flowing line art in the style of Henri Matisse or Pablo Picasso
- Abstract and contemplative, suggestive of spiritual reflection
- Elegant, minimalist, with negative space
- The amber/gold accent should appear in at least 20-30% of the illustration

CRITICAL: No text, no labels, no words, no letters in the image. Only the artistic illustration.`;

// Prompts específicos por tipo de evento
const EVENT_PROMPTS: Record<string, string> = {
  mesa_abierta: `People gathering around a table sharing food, communion, togetherness`,
  culto_dominical: `Church altar with cross, candles, and open book`,
  estudio_biblico: `Open Bible with reading lamp, coffee cup, and notebook`,
  retiro: `Mountain landscape with path, trees, and birds in flight`,
  navidad: `Nativity scene with stable, star, and manger`,
  cuaresma: `Cross with crown of thorns in desert landscape with sparse vegetation`,
  pascua: `Empty tomb at sunrise with lilies and garden flowers`,
  bautismo: `Water waves with dove, shell, and light rays from above`,
  comunidad: `Circle of people with joined hands around a central cross`,
  musica: `Musical notes, guitar or piano, and sound waves`,
  oracion: `Praying hands with candle flame and ascending light`,
  generic: `Celtic cross with church architecture, candles, and open doors`,
};

function buildPrompt(eventType: string): string {
  const eventPrompt = EVENT_PROMPTS[eventType] || EVENT_PROMPTS.generic;
  return `${BASE_STYLE_PROMPT}\n\nSubject: ${eventPrompt}`;
}

/**
 * Valida que un string base64 sea una imagen válida
 * Soporta PNG (iVBOR) y JPEG (/9j/)
 */
function isValidImageBase64(base64: string): boolean {
  if (!base64 || typeof base64 !== 'string') return false;
  // PNG magic bytes en base64 empiezan con "iVBORw0KGgo"
  // JPEG magic bytes en base64 empiezan con "/9j/"
  return base64.startsWith('iVBORw0KGgo') || base64.startsWith('/9j/');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY no está configurada');
    }

    const { eventType = 'generic', count = 4, customPrompt } = await req.json();

    console.log(`[generate-illustration] Generando ${count} ilustraciones para: ${eventType}`);

    // Usar prompt personalizado si se proporciona, sino usar el default
    const prompt = customPrompt || buildPrompt(eventType);
    console.log(`[generate-illustration] Prompt: ${prompt.slice(0, 100)}...`);

    const illustrations: string[] = [];

    // Usar Nano Banana Pro (gemini-3-pro-image-preview) para generar ilustraciones
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    // Generar cada ilustración individualmente (Gemini genera una por request)
    const generateOne = async (index: number): Promise<string> => {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `${prompt}\n\nGenerate variation ${index + 1} of this illustration with slightly different composition.`
              }]
            }]
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[generate-illustration] Error API (${index}):`, errorText);
          return '';
        }

        const data = await response.json();
        console.log(`[generate-illustration] Respuesta ${index}:`, JSON.stringify(data).slice(0, 300));

        // Extraer imagen de la respuesta de Gemini
        // Formato: data.candidates[0].content.parts[].inlineData.data
        if (data.candidates && data.candidates[0]?.content?.parts) {
          for (const part of data.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              const base64 = part.inlineData.data;
              if (isValidImageBase64(base64)) {
                console.log(`[generate-illustration] Imagen ${index} generada correctamente`);
                return base64;
              }
            }
          }
        }

        console.log(`[generate-illustration] No se encontró imagen en respuesta ${index}`);
        return '';
      } catch (err) {
        console.error(`[generate-illustration] Error generando imagen ${index}:`, err);
        return '';
      }
    };

    // Generar todas las ilustraciones en paralelo
    const promises = [];
    for (let i = 0; i < Math.min(count, 4); i++) {
      promises.push(generateOne(i));
    }

    const results = await Promise.all(promises);

    // Filtrar resultados válidos
    for (const base64 of results) {
      if (isValidImageBase64(base64)) {
        illustrations.push(base64);
      }
    }

    const validCount = illustrations.length;
    console.log(`[generate-illustration] ${validCount}/${count} ilustraciones válidas`);

    // Si no se generaron suficientes, rellenar con vacíos
    while (illustrations.length < count) {
      illustrations.push('');
    }

    return new Response(
      JSON.stringify({
        illustrations,
        validCount,
        requestedCount: count,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[generate-illustration] Error:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Error generando ilustraciones',
        illustrations: ['', '', '', ''],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
