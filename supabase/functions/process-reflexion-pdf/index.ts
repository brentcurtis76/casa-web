/**
 * CASA Process Reflexion PDF Edge Function
 * Extrae texto de un PDF de reflexión y genera un resumen temático
 * usando Claude API con soporte nativo para documentos PDF
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-sonnet-4-20250514';

// System prompt para extraer y resumir la reflexión
const SYSTEM_PROMPT = `Eres un asistente especializado en procesar textos de reflexiones litúrgicas para la Comunidad Anglicana San Andrés (CASA).

Tu tarea es:
1. Extraer TODO el texto relevante del documento PDF
2. Generar un resumen temático conciso (2-3 oraciones) que capture la esencia espiritual de la reflexión

El resumen debe:
- Identificar el tema central o mensaje principal
- Ser útil como contexto para generar oraciones y cuentos relacionados
- Mantener un tono cálido e inclusivo acorde a CASA

Responde ÚNICAMENTE con JSON válido:
{
  "texto": "Texto completo extraído del documento...",
  "resumen": "Resumen temático de 2-3 oraciones..."
}`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Límite de tamaño: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY no está configurada');
    }

    const { pdfBase64, filename } = await req.json();

    if (!pdfBase64) {
      throw new Error('Se requiere el PDF en formato base64');
    }

    // Validar tamaño del archivo
    const fileSize = Math.ceil((pdfBase64.length * 3) / 4);
    if (fileSize > MAX_FILE_SIZE) {
      throw new Error('El archivo excede el límite de 10MB');
    }

    console.log(`[process-reflexion-pdf] Procesando PDF: ${filename || 'sin nombre'}, tamaño: ${Math.round(fileSize / 1024)}KB`);

    // Llamar a Claude API con el documento PDF
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
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: 'Por favor, extrae el texto completo de este documento de reflexión y genera un resumen temático.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[process-reflexion-pdf] Error de API:', response.status, errorText);
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
    let result;
    try {
      result = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[process-reflexion-pdf] Error parseando JSON:', parseError);
      console.error('[process-reflexion-pdf] Texto recibido:', jsonText.slice(0, 500));
      throw new Error('Error parseando la respuesta de Claude');
    }

    // Validar estructura
    if (!result.texto || !result.resumen) {
      throw new Error('La respuesta no tiene la estructura esperada (texto y resumen)');
    }

    console.log(`[process-reflexion-pdf] Texto extraído: ${result.texto.length} caracteres`);
    console.log(`[process-reflexion-pdf] Resumen: ${result.resumen.slice(0, 100)}...`);

    return new Response(
      JSON.stringify({
        success: true,
        texto: result.texto,
        resumen: result.resumen,
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
    console.error('[process-reflexion-pdf] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error procesando PDF',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
