/**
 * CASA Story Generator Edge Function
 * Genera cuentos para niños usando Claude Opus 4.5
 * Basado en el contexto litúrgico y parámetros del usuario
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
const MODEL = 'claude-opus-4-5-20251101';
const GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * Investiga información visual sobre una ubicación en Chile usando Gemini
 */
async function researchLocation(location: string): Promise<string> {
  if (!GOOGLE_AI_API_KEY) {
    console.log('[generate-story] No GOOGLE_AI_API_KEY, skipping location research');
    return '';
  }

  const researchPrompt = `Necesito información visual detallada sobre "${location}" en Chile para crear ilustraciones de un cuento infantil.

Por favor proporciona:
1. **Características geográficas**: ¿Es costa, montaña, isla, desierto, bosque, ciudad? Describe el paisaje.
2. **Elementos visuales distintivos**: ¿Qué edificios, monumentos, o elementos naturales son característicos? (faros, iglesias, volcanes, playas, etc.)
3. **Colores predominantes**: ¿Qué colores dominan el paisaje? (azul del mar, verde de bosques, colores de casas, etc.)
4. **Arquitectura local**: ¿Cómo son las casas y edificios típicos? (palafitos, casas de madera, adobe, etc.)
5. **Flora y fauna**: ¿Qué plantas y animales son típicos de la zona?
6. **Clima y luz**: ¿Cómo es la luz típica? ¿Hay niebla, sol fuerte, etc.?

Responde en español, de forma concisa pero detallada (máximo 300 palabras). Solo información visual útil para ilustraciones.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: researchPrompt }] }],
          generationConfig: { maxOutputTokens: 500 },
        }),
      }
    );

    if (!response.ok) {
      console.error('[generate-story] Error researching location:', response.status);
      return '';
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log(`[generate-story] Location research for "${location}":`, text.slice(0, 200) + '...');
    return text;
  } catch (err) {
    console.error('[generate-story] Error in location research:', err);
    return '';
  }
}

// Nombres prohibidos - niños de la comunidad CASA
const FORBIDDEN_NAMES = [
  'Matías', 'Emilia', 'Tomás', 'Amanda', 'Matilde',
  'Leonor', 'Timoteo', 'Rocío', 'Renato', 'Rafael',
  'Sofía', 'Martín', 'Isidora', 'Benjamín', 'Florencia',
  'Agustín', 'Catalina', 'Vicente', 'Valentina', 'Joaquín',
  'Antonia', 'Maximiliano', 'Fernanda', 'Sebastián', 'Josefa',
  'Alonso', 'Trinidad', 'Nicolás', 'Maite', 'Lucas',
  'Ignacia', 'Felipe', 'Pascuala', 'Diego', 'Esperanza',
  'Gabriel', 'Paz', 'Daniel', 'Colomba', 'Samuel',
  'Montserrat', 'Facundo', 'Javiera', 'Gaspar', 'Julieta',
  'Simón', 'Agustina', 'Mateo', 'Isabella', 'Santiago',
  'Antonella', 'José', 'María', 'Pedro', 'Juan',
  'Francisca', 'Francisco', 'Camila', 'Pablo', 'Constanza'
];

// System prompt para Claude - Especializado en cuentos infantiles cristocéntricos
const SYSTEM_PROMPT = `Eres un cuentacuentos experto en crear historias para niños pequeños en el contexto de una comunidad cristiana progresiva e inclusiva (CASA - Comunidad Anglicana San Andrés).

## Tu Tarea
Escribir un cuento breve para el momento del "Cuentacuento" durante la liturgia dominical.

## Especificaciones del Cuento

### Audiencia
- Niños y niñas de aproximadamente 7 años
- Lenguaje claro, sencillo y accesible
- Oraciones cortas y vocabulario apropiado para la edad

### Duración
- Máximo 5 minutos de lectura en voz alta
- EXACTAMENTE 15 escenas (mínimo 12, máximo 16)

### Estructura Narrativa
- UN personaje principal claramente definido (no pueden haber dos protagonistas)
- Puede haber personajes secundarios que acompañen o desafíen al protagonista
- Debe tener tensión dramática: un problema, dilema o conflicto
- Debe tener una resolución clara y satisfactoria

### Enfoque Cristocéntrico
- La historia debe tener una referencia a Jesús, ya sea directa o simbólica
- O bien debe conectar con una enseñanza del Evangelio
- Esta referencia debe ser significativa pero NO forzada ni doctrinal
- Evitar ser predicador o moralizante; que la enseñanza emerja naturalmente

### Para las Ilustraciones
- Cada escena debe poder visualizarse como una imagen estática
- Describir escenas con buena iluminación (evitar escenas oscuras porque la proyección no se ve bien)
- Las escenas deben tener elementos visuales interesantes

### Nombres Prohibidos
NO uses estos nombres porque pertenecen a niños de la comunidad:
${FORBIDDEN_NAMES.join(', ')}

## IMPORTANTE: Lista de Personajes

Debes incluir en el array "characters" ABSOLUTAMENTE TODOS los personajes que aparecen en el cuento, incluyendo:
- El protagonista (role: "protagonist")
- Personajes secundarios recurrentes que aparecen en múltiples escenas (role: "secondary")
- Personajes menores que aparecen en una o dos escenas (role: "minor")

Por ejemplo, si hay un alcalde, un pescador, una abuela, etc. que aparecen en alguna escena, TODOS deben estar listados con su visualDescription detallada.

Cada personaje DEBE tener una visualDescription muy detallada y consistente que incluya:
- Edad aproximada
- Contextura física
- Color y estilo de pelo
- Color de piel
- Ropa característica (colores específicos)
- Rasgos distintivos (barba, lentes, sombrero, etc.)

## Formato de Respuesta
CRÍTICO: Tu respuesta debe ser ÚNICAMENTE un objeto JSON válido. No incluyas ningún texto antes o después del JSON. No uses bloques de código markdown. Solo el JSON puro.

El JSON debe tener esta estructura exacta:
{"title":"string","summary":"string","characters":[{"name":"string","role":"protagonist|secondary|minor","description":"string","visualDescription":"string","appearsInScenes":[1,2,3]}],"scenes":[{"number":1,"text":"string","visualDescription":"string","charactersInScene":["name1","name2"]}],"spiritualConnection":"string"}

Donde:
- title: Título del cuento
- summary: Resumen en una oración
- characters: Array con TODOS los personajes (protagonist, secondary, minor)
  - visualDescription debe ser MUY detallada: edad, contextura, pelo, piel, ropa con colores específicos
  - appearsInScenes: números de escenas donde aparece
- scenes: Array de 12-16 escenas
  - text: 2-4 oraciones para leer en voz alta
  - visualDescription: descripción visual detallada, bien iluminada
  - charactersInScene: nombres de personajes en la escena
- spiritualConnection: conexión con el Evangelio`;

/**
 * Construye el prompt del usuario con la información de la liturgia y preferencias
 */
function buildUserPrompt(data: {
  context: {
    title: string;
    summary: string;
    readings: Array<{ reference: string; text: string }>;
  };
  location: string;
  locationResearch: string;
  characters: string[];
  style: string;
  additionalNotes: string;
}): string {
  const { context, location, locationResearch, characters, style, additionalNotes } = data;

  // Safely handle readings array - ensure it exists and is an array
  const readings = Array.isArray(context?.readings) ? context.readings : [];
  const readingsText = readings.length > 0
    ? readings.map((r, i) => `### Lectura ${i + 1}: ${r?.reference || 'Sin referencia'}\n${r?.text || ''}`).join('\n\n')
    : '### Lecturas\nNo hay lecturas disponibles';

  const styleDescriptions: Record<string, string> = {
    aventura: 'emocionante, con acción y momentos de suspenso positivo',
    reflexivo: 'contemplativo, con momentos de silencio y descubrimiento interior',
    humoristico: 'divertido, con situaciones graciosas y personajes simpáticos',
    misterio: 'intrigante, con un pequeño misterio que resolver',
  };

  // Safely handle characters array
  const safeCharacters = Array.isArray(characters) ? characters : [];

  return `## Información de la Liturgia

### Título/Tema
${context?.title || 'Sin título'}

### Resumen del Mensaje
${context?.summary || 'No disponible'}

${readingsText}

---

## Parámetros del Cuento

### Lugar
${location || 'Chile'}
(Ambienta la historia en este lugar de Chile, usando detalles locales reconocibles)

${locationResearch ? `### Información Visual del Lugar (investigación real)
${locationResearch}
` : ''}
### Personajes Sugeridos
${safeCharacters.length > 0 ? safeCharacters.join(', ') : 'A tu elección - crea personajes apropiados para la historia'}

### Estilo Narrativo
${styleDescriptions[style] || style}

### Notas Adicionales del Usuario
${additionalNotes || 'Ninguna'}

---

Por favor, crea un cuento original basándote en esta información. El cuento debe:
- Durar 3-5 minutos al ser leído en voz alta (aproximadamente 400-600 palabras)
- Estar dividido en párrafos cortos para facilitar la lectura
- Transmitir el mensaje espiritual de forma implícita, no explícita
- Ser apropiado para niños de 5-10 años`;
}

/**
 * Valida la estructura de la respuesta JSON (nuevo formato con escenas)
 */
function validateStory(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;

  const story = data as Record<string, unknown>;

  // Validar campos requeridos
  if (typeof story.title !== 'string') return false;
  if (typeof story.summary !== 'string') return false;
  if (typeof story.spiritualConnection !== 'string') return false;

  // Validar characters array
  if (!Array.isArray(story.characters) || story.characters.length === 0) return false;

  // Validar scenes array
  if (!Array.isArray(story.scenes) || story.scenes.length === 0) return false;

  // Validar estructura de cada escena
  for (const scene of story.scenes as Array<Record<string, unknown>>) {
    if (typeof scene.number !== 'number') return false;
    if (typeof scene.text !== 'string') return false;
    if (typeof scene.visualDescription !== 'string') return false;
  }

  return true;
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
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY no está configurada');
    }

    const requestData = await req.json();

    const { context, location, characters, style, additionalNotes, previewPromptOnly } = requestData;

    if (!context || !location) {
      throw new Error('Se requiere contexto de la liturgia y ubicación');
    }

    console.log(`[generate-story] Generando cuento para: "${context.title}"`);
    console.log(`[generate-story] Ubicación: ${location}, Estilo: ${style}`);

    // Investigar la ubicación real usando Gemini
    console.log(`[generate-story] Investigando ubicación: ${location}...`);
    const locationResearch = await researchLocation(location);

    // Si solo quieren ver el prompt, devolverlo sin generar
    if (previewPromptOnly) {
      const userPrompt = buildUserPrompt({
        context,
        location,
        locationResearch,
        characters: characters || [],
        style: style || 'reflexivo',
        additionalNotes: additionalNotes || ''
      });
      return new Response(
        JSON.stringify({
          success: true,
          promptPreview: {
            systemPrompt: SYSTEM_PROMPT,
            userPrompt: userPrompt,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Construir prompt con la investigación de ubicación
    const userPrompt = buildUserPrompt({
      context,
      location,
      locationResearch,
      characters: characters || [],
      style: style || 'reflexivo',
      additionalNotes: additionalNotes || ''
    });

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
        max_tokens: 4096,
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
      console.error('[generate-story] Error de API:', response.status, errorText);
      throw new Error(`Error de Claude API: ${response.status}`);
    }

    const data = await response.json();

    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('La API no retornó contenido');
    }

    // Extraer el JSON de la respuesta
    let jsonText = data.content[0].text;
    console.log('[generate-story] Respuesta cruda (primeros 500 chars):', jsonText.slice(0, 500));

    // Intentar encontrar el JSON en la respuesta
    // Primero buscar si hay un bloque de código JSON
    let jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else {
      // Buscar el JSON directamente (objeto que empiece con { y termine con })
      jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[generate-story] No se encontró JSON en:', jsonText);
        throw new Error('No se encontró JSON válido en la respuesta');
      }
      jsonText = jsonMatch[0];
    }

    // Limpiar caracteres problemáticos que pueden causar errores de parsing
    jsonText = jsonText
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '') // Caracteres de control (excepto \t \n \r)
      .trim();

    console.log('[generate-story] JSON limpio (primeros 1000 chars):', jsonText.slice(0, 1000));

    // Parsear JSON con múltiples intentos de limpieza
    let story;
    const parseAttempts = [
      // Intento 1: JSON tal cual
      () => JSON.parse(jsonText),
      // Intento 2: Limpiar saltos de línea dentro de strings
      () => {
        const cleaned = jsonText.replace(/("(?:[^"\\]|\\.)*")|[\n\r\t]/g, (match, group) => {
          if (group) return group; // Mantener strings intactos
          return ' '; // Reemplazar whitespace fuera de strings
        });
        return JSON.parse(cleaned);
      },
      // Intento 3: Limpieza agresiva de comillas y whitespace
      () => {
        const cleaned = jsonText
          .replace(/'/g, "'")
          .replace(/"/g, '"')
          .replace(/"/g, '"')
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
        return JSON.parse(cleaned);
      },
      // Intento 4: Eliminar todo whitespace extra
      () => {
        const cleaned = jsonText
          .replace(/\s+/g, ' ')
          .replace(/"\s*:\s*/g, '":')
          .replace(/,\s*/g, ',')
          .replace(/\[\s*/g, '[')
          .replace(/\s*\]/g, ']')
          .replace(/\{\s*/g, '{')
          .replace(/\s*\}/g, '}');
        return JSON.parse(cleaned);
      }
    ];

    for (let i = 0; i < parseAttempts.length; i++) {
      try {
        story = parseAttempts[i]();
        console.log(`[generate-story] Parseado exitoso en intento ${i + 1}`);
        break;
      } catch (err) {
        console.log(`[generate-story] Intento ${i + 1} falló:`, err instanceof Error ? err.message : 'Error');
        if (i === parseAttempts.length - 1) {
          console.error('[generate-story] Todos los intentos de parsing fallaron');
          console.error('[generate-story] JSON que falló (últimos 500 chars):', jsonText.slice(-500));
          throw new Error('Error parseando la respuesta de Claude - JSON inválido');
        }
      }
    }

    // Validar estructura
    if (!validateStory(story)) {
      console.error('[generate-story] Estructura inválida:', JSON.stringify(story).slice(0, 500));
      throw new Error('La respuesta no tiene la estructura esperada');
    }

    console.log('[generate-story] Cuento generado exitosamente:', story.title);
    console.log(`[generate-story] Escenas: ${story.scenes?.length || 0}, Personajes: ${story.characters?.length || 0}`);

    // Construir el contenido como texto plano para compatibilidad
    const contentText = Array.isArray(story.scenes)
      ? story.scenes.map((s: { text: string }) => s.text).join('\n\n')
      : '';

    return new Response(
      JSON.stringify({
        success: true,
        // Nuevo formato estructurado
        title: story.title,
        summary: story.summary,
        characters: story.characters,
        scenes: story.scenes,
        spiritualConnection: story.spiritualConnection,
        // Compatibilidad con formato anterior
        content: contentText,
        story: contentText,
        moral: story.spiritualConnection,
        suggestedDuration: Math.ceil((story.scenes?.length || 12) / 3), // ~3 escenas por minuto
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
    console.error('[generate-story] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error generando cuento',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
