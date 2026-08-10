/**
 * slug — normalización pura del slug de un episodio.
 *
 * **Esto sólo produce una preferencia.** Quien garantiza el slug es la base de datos
 * (D23): el trigger `trg_podcast_episodes_slug` resuelve la unicidad, aplica el fallback
 * `reflexion-<episode_date>` cuando nadie aporta base, y lo congela una vez asignado
 * (D12). Por eso este módulo no importa Supabase ni consulta nada.
 *
 * Devolver cadena vacía es un resultado legítimo — un título de sólo símbolos no da base
 * ninguna — y significa «sin preferencia»: la base aplicará su fallback.
 */

/** Tope del `CHECK` de longitud de la columna `slug`. */
export const SLUG_MAX_LENGTH = 80;

/**
 * Trunca a `maxLength` cortando en el último `-` que quepa en el presupuesto; si no hay
 * ninguno, corte duro. En ambos casos se recorta el `-` sobrante del final.
 *
 * La regla de no cortar palabra puede acortar mucho — una base de 80 con su último guion
 * en la posición 43 baja a 42. Es la regla funcionando, no un defecto.
 */
function truncateSlug(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;

  const cut = value.slice(0, maxLength);
  const lastDash = cut.lastIndexOf('-');
  const body = lastDash > 0 ? cut.slice(0, lastDash) : cut;

  return body.replace(/-+$/, '');
}

/**
 * NFD → quitar marcas diacríticas → minúsculas → todo lo que no sea `[a-z0-9]` a `-` →
 * colapsar → recortar extremos → truncar a `maxLength`.
 */
export function slugify(value: string, maxLength: number = SLUG_MAX_LENGTH): string {
  const normalized = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  return truncateSlug(normalized, maxLength);
}
