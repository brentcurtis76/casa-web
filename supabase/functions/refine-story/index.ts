/**
 * CASA Story Refinement Edge Function
 * Refina cuentos existentes basándose en feedback del usuario
 * Usa Claude Opus 4.5 para mejorar aspectos específicos sin regenerar todo
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-opus-4-5-20251101';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tipos de refinamiento disponibles
type RefinementType = 'general' | 'characters' | 'plot' | 'scenes' | 'spiritual' | 'length' | 'tone';

// Instrucciones específicas por tipo de refinamiento
const REFINEMENT_INSTRUCTIONS: Record<RefinementType, string> = {
  general: `Refina el cuento según el feedback del usuario. Mantén la estructura general (título, personajes, escenas) pero mejora según lo indicado.`,
  characters: `Enfócate en mejorar los personajes del cuento. Puedes:
- Agregar más profundidad a la personalidad del protagonista
- Mejorar las descripciones visuales de los personajes
- Ajustar los roles secundarios
- Hacer los personajes más memorables o relatables`,
  plot: `Enfócate en mejorar la trama del cuento. Puedes:
- Fortalecer el conflicto o tensión dramática
- Mejorar la resolución
- Agregar momentos de suspenso apropiados para niños
- Hacer la historia más coherente`,
  scenes: `Enfócate en mejorar las escenas individuales. Puedes:
- Mejorar las descripciones visuales
- Ajustar el ritmo entre escenas
- Agregar detalles sensoriales
- Hacer las escenas más cinematográficas`,
  spiritual: `Enfócate en mejorar la conexión espiritual del cuento. Puedes:
- Hacer la referencia a Jesús más natural y menos forzada
- Fortalecer la enseñanza del Evangelio
- Hacer la moraleja más sutil pero impactante
- Conectar mejor con las lecturas de la liturgia`,
  length: `Ajusta la duración del cuento. Si el usuario pide más largo:
- Agrega escenas o expande las existentes
- Incluye más detalles visuales
Si pide más corto:
- Combina escenas
- Reduce descripciones manteniendo el mensaje
Mantén siempre entre 10 y 18 escenas.`,
  tone: `Ajusta el tono del cuento. Puedes hacerlo:
- Más alegre y divertido
- Más reflexivo y profundo
- Más aventurero y emocionante
- Más tierno y emotivo
Según lo que pida el usuario.`,
};

const SYSTEM_PROMPT = `Eres un editor experto de cuentos infantiles para una comunidad cristiana progresiva e inclusiva (CASA - Comunidad Anglicana San Andrés).

Tu tarea es REFINAR un cuento existente basándote en el feedback del usuario.

## Reglas Importantes

1. MANTÉN la estructura del cuento (JSON con title, summary, characters, scenes, spiritualConnection)
2. NO cambies drásticamente la historia - haz mejoras incrementales
3. PRESERVA los nombres y roles básicos de los personajes
4. MANTÉN el mismo número de escenas (o similar, entre 12-16)
5. El cuento debe seguir siendo apropiado para niños de 5-10 años
6. Las escenas deben poder visualizarse como imágenes estáticas
7. EVITA estos nombres de niños de la comunidad: Matías, Emilia, Tomás, Amanda, Matilde, Leonor, Timoteo, Rocío, Renato, Rafael, Sofía, Martín, etc.

## Formato de Respuesta
Tu respuesta debe ser ÚNICAMENTE un objeto JSON válido con la estructura:
{
  "title": "string",
  "summary": "string",
  "characters": [...],
  "scenes": [...],
  "spiritualConnection": "string",
  "refinementNotes": "string - breve descripción de los cambios realizados"
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY no está configurada');
    }

    const requestData = await req.json();
    const {
      currentStory,
      feedback,
      refinementType = 'general',
      liturgyContext
    } = requestData;

    if (!currentStory || !feedback) {
      throw new Error('Se requiere currentStory y feedback');
    }

    console.log(`[refine-story] Refinando cuento: "${currentStory.title}"`);
    console.log(`[refine-story] Tipo de refinamiento: ${refinementType}`);
    console.log(`[refine-story] Feedback: ${feedback.slice(0, 200)}...`);

    // Construir el prompt del usuario
    const userPrompt = `## Cuento Actual a Refinar

\`\`\`json
${JSON.stringify(currentStory, null, 2)}
\`\`\`

## Contexto de la Liturgia
${liturgyContext ? `
- Título: ${liturgyContext.title || 'No especificado'}
- Resumen: ${liturgyContext.summary || 'No especificado'}
` : 'No disponible'}

## Tipo de Refinamiento: ${refinementType}
${REFINEMENT_INSTRUCTIONS[refinementType as RefinementType] || REFINEMENT_INSTRUCTIONS.general}

## Feedback del Usuario
"${feedback}"

---

Por favor, refina el cuento según este feedback. Mantén la estructura JSON exacta, pero aplica las mejoras solicitadas.`;

    // Llamar a Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[refine-story] Error de API:', response.status, errorText);
      throw new Error(`Error de Claude API: ${response.status}`);
    }

    const data = await response.json();

    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('La API no retornó contenido');
    }

    // Extraer JSON de la respuesta
    let jsonText = data.content[0].text;
    console.log('[refine-story] Respuesta cruda (primeros 500 chars):', jsonText.slice(0, 500));

    // Buscar JSON en la respuesta
    let jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else {
      jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se encontró JSON válido en la respuesta');
      }
      jsonText = jsonMatch[0];
    }

    // Limpiar y parsear
    jsonText = jsonText
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      .trim();

    const refinedStory = JSON.parse(jsonText);

    // Validar estructura básica
    if (!refinedStory.title || !refinedStory.scenes || !Array.isArray(refinedStory.scenes)) {
      throw new Error('La respuesta no tiene la estructura esperada');
    }

    console.log(`[refine-story] Cuento refinado exitosamente`);
    console.log(`[refine-story] Cambios: ${refinedStory.refinementNotes || 'No especificados'}`);

    return new Response(
      JSON.stringify({
        success: true,
        story: refinedStory,
        refinementNotes: refinedStory.refinementNotes,
        model: MODEL,
        usage: {
          input_tokens: data.usage?.input_tokens || 0,
          output_tokens: data.usage?.output_tokens || 0,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[refine-story] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error refinando cuento',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
