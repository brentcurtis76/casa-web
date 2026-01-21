/**
 * CASA Oraciones Antifonales Generator Edge Function
 * Genera oraciones antifonales usando Claude API (Opus 4.5)
 *
 * Documentación Anthropic API: https://docs.anthropic.com/claude/reference/messages_post
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-opus-4-5-20251101';

// System prompt para Claude - Especializado en liturgia CASA
const SYSTEM_PROMPT = `Eres un asistente litúrgico especializado en escribir oraciones antifonales para la Comunidad Anglicana San Andrés (CASA), una comunidad cristiana progresista e inclusiva en Santiago, Chile.

## Contexto de CASA
CASA es una comunidad abierta, inspirada en Jesús, donde cada persona es vista y celebrada en su singularidad. Los valores fundamentales son: inclusión, amor incondicional, esperanza, comunidad y evolución teológica ("una teología con puntos suspensivos, siempre en conversación").

## IMPORTANTE: Momento Litúrgico
Estas oraciones se realizan AL INICIO de la liturgia, ANTES de la lectura bíblica y la reflexión. El propósito es PREPARAR el corazón de la congregación para escuchar la Palabra.

Por lo tanto:
- NO cites ni referencíes directamente el texto bíblico
- NO uses frases como "como escucharemos hoy" o "como nos dice la lectura"
- El tema de la reflexión te da el TONO y la DIRECCIÓN espiritual, pero las oraciones deben preparar para recibir, no anticipar el contenido
- Usa el tema como inspiración para crear un ambiente de apertura y receptividad

## Tu Tarea
Escribir oraciones antifonales que preparen a la congregación para:
- Abrir sus corazones a la presencia de Dios
- Reconocer su humanidad y necesidad de gracia
- Expresar gratitud y disposición para escuchar

## Estructura Requerida
Debes escribir TRES oraciones antifonales:
1. **Invocación**: Llamado inicial a la presencia de Dios - crear un espacio sagrado de encuentro
2. **Arrepentimiento**: Reconocimiento de nuestras limitaciones y necesidad de gracia - preparar el corazón
3. **Gratitud**: Acción de gracias por el momento presente y disposición para recibir

Cada oración tiene CUATRO tiempos. Cada tiempo incluye:
- **Líder**: Texto más extenso (2-4 oraciones), poético y reflexivo
- **Congregación**: Respuesta corta (1 frase breve), fácil de leer al unísono

## Estilo de Escritura
- Tono cálido, inclusivo y esperanzador
- Evitar lenguaje religioso excluyente o jerga compleja
- Usar lenguaje accesible que invite a la reflexión
- Crear imágenes y metáforas que preparen para la escucha, inspiradas en el tema pero sin citar la lectura
- Las respuestas de la congregación deben ser rítmicas y memorables
- Evitar lenguaje patriarcal exclusivo (usar "Dios" en lugar de solo pronombres masculinos)

## Formato de Respuesta
Responde ÚNICAMENTE con JSON válido, sin texto adicional antes o después:
{
  "invocacion": {
    "titulo": "Invocación",
    "tiempos": [
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."}
    ]
  },
  "arrepentimiento": {
    "titulo": "Arrepentimiento",
    "tiempos": [
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."}
    ]
  },
  "gratitud": {
    "titulo": "Gratitud",
    "tiempos": [
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."}
    ]
  }
}`;

/**
 * Construye el prompt del usuario con la información de la liturgia
 */
function buildUserPrompt(liturgia: {
  titulo: string;
  resumen: string;
  lecturas: Array<{ cita: string; texto: string }>;
  reflexionText?: string;
}): string {
  const lecturasText = liturgia.lecturas
    .map((l, i) => `### Lectura ${i + 1}: ${l.cita}\n${l.texto}`)
    .join('\n\n');

  // Incluir texto de reflexión si está disponible
  const reflexionSection = liturgia.reflexionText ? `

### Texto de la Reflexión del Predicador
${liturgia.reflexionText}

NOTA IMPORTANTE: Usa este texto de reflexión como fuente principal de inspiración temática.
Las oraciones deben preparar el corazón de la congregación para recibir este mensaje.
` : '';

  return `## Información de la Liturgia

### Título de la Reflexión
${liturgia.titulo}

### Resumen/Enfoque Temático
${liturgia.resumen}

${lecturasText}
${reflexionSection}
---

Por favor, genera las tres oraciones antifonales (Invocación, Arrepentimiento, Gratitud) basándote en esta información. Recuerda:
- Incorporar imágenes y metáforas de las lecturas${liturgia.reflexionText ? ' y del texto de reflexión' : ''}
- Mantener un tono cálido e inclusivo
- Las respuestas de la congregación deben ser cortas y fáciles de decir al unísono`;
}

/**
 * Valida la estructura de la respuesta JSON
 */
function validateOraciones(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;

  const oraciones = data as Record<string, unknown>;
  const tipos = ['invocacion', 'arrepentimiento', 'gratitud'];

  for (const tipo of tipos) {
    const oracion = oraciones[tipo] as Record<string, unknown>;
    if (!oracion) return false;
    if (typeof oracion.titulo !== 'string') return false;
    if (!Array.isArray(oracion.tiempos)) return false;
    if (oracion.tiempos.length !== 4) return false;

    for (const tiempo of oracion.tiempos) {
      if (typeof tiempo !== 'object' || tiempo === null) return false;
      const t = tiempo as Record<string, unknown>;
      if (typeof t.lider !== 'string' || typeof t.congregacion !== 'string') return false;
    }
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

    const { liturgia } = await req.json();

    if (!liturgia || !liturgia.titulo || !liturgia.lecturas) {
      throw new Error('Se requiere información de la liturgia (titulo, resumen, lecturas)');
    }

    console.log(`[generate-oraciones] Generando oraciones para: "${liturgia.titulo}"`);
    console.log(`[generate-oraciones] Lecturas: ${liturgia.lecturas.length}`);

    // Construir prompt
    const userPrompt = buildUserPrompt(liturgia);

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
      console.error('[generate-oraciones] Error de API:', response.status, errorText);
      throw new Error(`Error de Claude API: ${response.status}`);
    }

    const data = await response.json();

    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('La API no retornó contenido');
    }

    // Extraer el JSON de la respuesta
    let jsonText = data.content[0].text;

    // Limpiar posible texto antes/después del JSON
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No se encontró JSON válido en la respuesta');
    }
    jsonText = jsonMatch[0];

    // Parsear JSON
    let oraciones;
    try {
      oraciones = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[generate-oraciones] Error parseando JSON:', parseError);
      console.error('[generate-oraciones] Texto recibido:', jsonText.slice(0, 500));
      throw new Error('Error parseando la respuesta de Claude');
    }

    // Validar estructura
    if (!validateOraciones(oraciones)) {
      console.error('[generate-oraciones] Estructura inválida:', JSON.stringify(oraciones).slice(0, 500));
      throw new Error('La respuesta no tiene la estructura esperada');
    }

    console.log('[generate-oraciones] Oraciones generadas exitosamente');

    return new Response(
      JSON.stringify({
        success: true,
        oraciones,
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
    console.error('[generate-oraciones] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error generando oraciones',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
