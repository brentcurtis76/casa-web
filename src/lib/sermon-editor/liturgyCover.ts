/**
 * liturgyCover — reutiliza la portada de reflexión que el constructor de
 * liturgias ya generó como carátula del episodio del podcast.
 *
 * La portada se guarda como elemento `portada-reflexion` de la liturgia
 * (`ConstructorLiturgias.tsx` → `liturgyService.saveLiturgy`, upsert por
 * `(liturgia_id, tipo)`), con la imagen en
 * `slides.slides[0].content.imageUrl`. Ese campo llega en dos formas —
 * data URL (`data:image/png;base64,…`) o base64 crudo sin prefijo— y
 * `base64ToSpotifyCover()` acepta ambas por diseño.
 *
 * Cualquier fallo de lectura degrada: devuelve `unavailable` con un motivo en
 * español y quien llama cae a la generación con IA. Nunca lanza.
 */

import { supabase } from '@/integrations/supabase/client';
import { base64ToSpotifyCover } from './coverImageUtils';

/**
 * `src/integrations/supabase/types.ts` cubre ~16 de las 128 tablas del proyecto
 * y no incluye `liturgias` ni `liturgia_elementos`, así que el cliente tipado
 * rechaza esta consulta (TS2769). El ensanchado va aquí, **una sola vez y en un
 * solo sitio**, con un tipo estructural privado del módulo y vía `unknown` —
 * nunca `any`, que la config de ESLint trata como error.
 *
 * El guardrail del cast no es el tipo: es `extractImageUrl()`, que valida en
 * runtime la forma de la fila antes de que salga de aquí.
 */
interface ElementoRow {
  slides: unknown;
}

interface ElementoResult {
  data: ElementoRow | null;
  error: { message: string } | null;
}

interface ElementoFilter {
  eq(column: string, value: string): ElementoFilter;
  maybeSingle(): PromiseLike<ElementoResult>;
}

interface LiturgiaElementosReader {
  from(table: 'liturgia_elementos'): {
    select(columns: string): ElementoFilter;
  };
}

/** Motivo del fallo, en español, listo para el cuerpo de un toast. */
export type LiturgyCoverResult =
  | { status: 'ok'; blob: Blob }
  | { status: 'unavailable'; reason: string };

const REASON_QUERY_FAILED = 'No se pudo leer la portada de la liturgia.';
const REASON_NOT_SAVED =
  'Esta liturgia no tiene portada de reflexión guardada.';
const REASON_UNEXPECTED_SHAPE =
  'La portada guardada en la liturgia tiene un formato inesperado.';
const REASON_CONVERSION_FAILED =
  'No se pudo convertir la portada de la liturgia a carátula cuadrada.';

/**
 * Recupera la portada de reflexión de `liturgyId` y la convierte en carátula
 * cuadrada con el recorte central de `base64ToSpotifyCover()`.
 *
 * Devuelve `unavailable` —nunca lanza— cuando la consulta falla, cuando no hay
 * fila legible por quien publica (la RLS de `liturgia_elementos` es de
 * propietario: una liturgia ajena da 0 filas), cuando la forma del `SlideGroup`
 * no es la esperada, o cuando la conversión falla.
 */
export async function fetchLiturgyCover(
  liturgyId: string,
): Promise<LiturgyCoverResult> {
  const reader = supabase as unknown as LiturgiaElementosReader;

  let row: ElementoRow | null;
  try {
    const { data, error } = await reader
      .from('liturgia_elementos')
      .select('slides')
      .eq('liturgia_id', liturgyId)
      .eq('tipo', 'portada-reflexion')
      .maybeSingle();
    if (error) {
      console.error('[liturgyCover] query failed', error);
      return { status: 'unavailable', reason: REASON_QUERY_FAILED };
    }
    row = data ?? null;
  } catch (err) {
    console.error('[liturgyCover] query threw', err);
    return { status: 'unavailable', reason: REASON_QUERY_FAILED };
  }

  if (!row) {
    return { status: 'unavailable', reason: REASON_NOT_SAVED };
  }

  const imageUrl = extractImageUrl(row.slides);
  if (!imageUrl) {
    return { status: 'unavailable', reason: REASON_UNEXPECTED_SHAPE };
  }

  try {
    const blob = await base64ToSpotifyCover(imageUrl);
    return { status: 'ok', blob };
  } catch (err) {
    console.error('[liturgyCover] cover conversion failed', err);
    return { status: 'unavailable', reason: REASON_CONVERSION_FAILED };
  }
}

/**
 * Validación de runtime de `slides` → `slides[0].content.imageUrl`. Es la
 * contención del cast estructural de arriba: sin ella el cast sería una
 * promesa, con ella es una aserción comprobada.
 */
function extractImageUrl(slides: unknown): string | null {
  if (typeof slides !== 'object' || slides === null) return null;

  const group = (slides as { slides?: unknown }).slides;
  if (!Array.isArray(group) || group.length === 0) return null;

  const first: unknown = group[0];
  if (typeof first !== 'object' || first === null) return null;

  const content = (first as { content?: unknown }).content;
  if (typeof content !== 'object' || content === null) return null;

  const imageUrl = (content as { imageUrl?: unknown }).imageUrl;
  if (typeof imageUrl !== 'string' || imageUrl.trim().length === 0) return null;

  return imageUrl;
}
