/**
 * Prayer Generator - Servicio para generar oraciones con Claude
 * Utiliza la API de Claude para generar oraciones antifonales
 */

import type { LiturgyContext } from '@/types/shared/liturgy';

type PrayerType = 'oracion-invocacion' | 'oracion-arrepentimiento' | 'oracion-gratitud';

interface GeneratePrayerParams {
  context: LiturgyContext;
  prayerType: PrayerType;
}

interface GeneratePrayerResult {
  success: boolean;
  prayer?: string;
  error?: string;
}

// Prompts específicos para cada tipo de oración
const PRAYER_SYSTEM_PROMPTS: Record<PrayerType, string> = {
  'oracion-invocacion': `Eres un pastor luterano escribiendo una oración de invocación para un culto dominical.
La oración debe:
- Invitar la presencia de Dios al inicio del culto
- Ser antifonal (líder y congregación alternando)
- Usar un tono cálido y acogedor
- Tener 3-4 intercambios entre líder y congregación
- Las respuestas de la congregación deben ser cortas y fáciles de seguir
- Relacionarse con el tema del día si se proporciona

Formato de salida (usa exactamente este formato):
LÍDER: [texto del líder]
CONGREGACIÓN: [respuesta de la congregación]
LÍDER: [siguiente texto]
CONGREGACIÓN: [siguiente respuesta]
...

Escribe SOLO la oración, sin explicaciones adicionales.`,

  'oracion-arrepentimiento': `Eres un pastor luterano escribiendo una oración de arrepentimiento/confesión para un culto dominical.
La oración debe:
- Guiar a la congregación en un momento de reflexión y confesión
- Ser antifonal (líder y congregación alternando)
- Reconocer la humanidad compartida y la necesidad de gracia
- Terminar con esperanza y la seguridad del perdón de Dios
- Tener 3-4 intercambios entre líder y congregación
- Las respuestas de la congregación deben ser cortas y fáciles de seguir

Formato de salida (usa exactamente este formato):
LÍDER: [texto del líder]
CONGREGACIÓN: [respuesta de la congregación]
LÍDER: [siguiente texto]
CONGREGACIÓN: [siguiente respuesta]
...

Escribe SOLO la oración, sin explicaciones adicionales.`,

  'oracion-gratitud': `Eres un pastor luterano escribiendo una oración de gratitud/acción de gracias para un culto dominical.
La oración debe:
- Expresar agradecimiento por las bendiciones de Dios
- Ser antifonal (líder y congregación alternando)
- Celebrar tanto las bendiciones cotidianas como las espirituales
- Conectar la gratitud con el tema del día si se proporciona
- Tener 3-4 intercambios entre líder y congregación
- Las respuestas de la congregación deben ser cortas y fáciles de seguir

Formato de salida (usa exactamente este formato):
LÍDER: [texto del líder]
CONGREGACIÓN: [respuesta de la congregación]
LÍDER: [siguiente texto]
CONGREGACIÓN: [siguiente respuesta]
...

Escribe SOLO la oración, sin explicaciones adicionales.`,
};

const PRAYER_TYPE_NAMES: Record<PrayerType, string> = {
  'oracion-invocacion': 'oración de invocación',
  'oracion-arrepentimiento': 'oración de arrepentimiento',
  'oracion-gratitud': 'oración de gratitud',
};

/**
 * Genera una oración usando Claude API
 * Nota: En producción, esto debería ir a través de un backend/edge function
 * para proteger la API key
 */
export async function generatePrayer(params: GeneratePrayerParams): Promise<GeneratePrayerResult> {
  const { context, prayerType } = params;

  // Construir el prompt del usuario con el contexto de la liturgia
  const dateStr = context.date instanceof Date
    ? context.date.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : String(context.date);

  const readingsStr = context.readings.length > 0
    ? `Lecturas: ${context.readings.map(r => r.reference).join(', ')}`
    : '';

  const userPrompt = `
Fecha del culto: ${dateStr}
Título de la reflexión: ${context.title}
Resumen temático: ${context.summary}
${readingsStr}

Por favor, escribe una ${PRAYER_TYPE_NAMES[prayerType]} para este culto.
`.trim();

  try {
    // Intentar usar Supabase Edge Function si está configurada
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-prayer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          systemPrompt: PRAYER_SYSTEM_PROMPTS[prayerType],
          userPrompt,
          prayerType,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          prayer: data.prayer || data.content,
        };
      }

      // Si la edge function falla, intentar generar localmente
      console.warn('Edge function failed, attempting local generation');
    }

    // Fallback: Generar una oración de ejemplo si no hay API disponible
    return generateFallbackPrayer(prayerType, context);

  } catch (error) {
    console.error('Error generating prayer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al generar la oración',
    };
  }
}

/**
 * Genera una oración de ejemplo cuando no hay API disponible
 */
function generateFallbackPrayer(
  prayerType: PrayerType,
  context: LiturgyContext
): GeneratePrayerResult {
  const prayers: Record<PrayerType, string> = {
    'oracion-invocacion': `LÍDER: Señor, en este día te buscamos con corazones abiertos.
CONGREGACIÓN: Abre nuestros oídos para escuchar tu voz.
LÍDER: Que tu Espíritu Santo llene este lugar y nos una como familia de fe.
CONGREGACIÓN: Ven, Señor, y habita entre nosotros.
LÍDER: En el tema de "${context.title}", guíanos a comprender tu amor.
CONGREGACIÓN: Ilumina nuestros corazones con tu verdad. Amén.`,

    'oracion-arrepentimiento': `LÍDER: Señor, venimos ante ti reconociendo nuestra humanidad.
CONGREGACIÓN: Ten piedad de nosotros, Señor.
LÍDER: Confesamos que hemos fallado en amar como tú nos amas.
CONGREGACIÓN: Perdónanos y renuévanos.
LÍDER: Confiamos en tu gracia que nos restaura y nos hace nuevos.
CONGREGACIÓN: Gracias por tu amor incondicional. Amén.`,

    'oracion-gratitud': `LÍDER: Padre celestial, te damos gracias por este nuevo día.
CONGREGACIÓN: Gracias, Señor, por tus bendiciones.
LÍDER: Por tu amor que nos sostiene y la comunidad que nos acompaña.
CONGREGACIÓN: Te alabamos con todo nuestro ser.
LÍDER: Por el mensaje de "${context.title}" que nos das hoy.
CONGREGACIÓN: Que nuestras vidas reflejen tu amor. Amén.`,
  };

  return {
    success: true,
    prayer: prayers[prayerType],
  };
}

/**
 * Exportar los prompts del sistema para uso en otros componentes
 */
export { PRAYER_SYSTEM_PROMPTS, PRAYER_TYPE_NAMES };
