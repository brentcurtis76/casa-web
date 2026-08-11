/**
 * Consultas públicas de `/reflexiones` — AUDIO / E3b.
 *
 * Vive separado de la UI a propósito: la paginación se prueba sin montar un solo
 * componente, y la consulta real se puede ejercer contra PostgREST local.
 *
 * PAGINACIÓN POR KEYSET, NO POR OFFSET (decisión congelada de E3b).
 * El orden es `(published_at DESC, id ASC)` y el cursor está anclado a una FILA, no a una
 * posición. Un episodio publicado entre dos peticiones no puede por tanto solapar ni
 * saltar filas — que es exactamente lo que el offset no puede prometer.
 *
 * Lo que se pierde, y queda declarado: no hay URL de «página 3». La navegación es hacia
 * atrás en el tiempo, «más antiguas».
 */

import { supabase } from '@/integrations/supabase/client';

/** Filas que se muestran por página. */
export const TAMANO_PAGINA = 12;

/**
 * Se piden 13 y se muestran 12. La fila 13 no se pinta nunca: es sólo el centinela que
 * dice si hay más, y evita una segunda consulta de recuento.
 */
export const TAMANO_LOTE = TAMANO_PAGINA + 1;

export const TABLA_EPISODIOS = 'church_podcast_episodes';

/** Sólo lo que las dos páginas pintan. `SELECT *` traería columnas internas sin uso. */
export const CAMPOS_EPISODIO =
  'id,slug,title,description,speaker,cover_url,published_at,episode_date,duration_seconds,audio_url';

/** Una reflexión publicada, tal como la pintan el índice y la página del episodio. */
export interface ReflexionPublicada {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  /** Nullable en la base, y la fila publicada del seed NO lo trae. */
  speaker: string | null;
  /** Nullable en la base, y la fila publicada del seed NO lo trae. */
  cover_url: string | null;
  published_at: string | null;
  episode_date: string;
  duration_seconds: number | null;
  audio_url: string | null;
}

/** El `(published_at, id)` de la última fila mostrada. */
export interface CursorReflexiones {
  publishedAt: string;
  id: string;
}

export interface PaginaReflexiones {
  episodios: ReflexionPublicada[];
  /** `null` cuando esta es la última página. */
  siguienteCursor: CursorReflexiones | null;
}

// ─── Validación del cursor ────────────────────────────────────────────────────
//
// `desde` llega de la URL, o sea de cualquiera. Antes de que toque el `.or()` tiene que
// pasar las dos rejillas de abajo. No hay escapado: lo que no encaja se DESCARTA y la
// página vuelve a ser la 1. Una gramática de PostgREST inyectada no puede colarse porque
// ni `,` ni `(` ni `)` ni `.` sobreviven a estas expresiones.

/**
 * ISO 8601 con zona explícita, que es lo que emite PostgREST para un `timestamptz`.
 *
 * Los componentes van capturados a propósito: la expresión sólo comprueba la FORMA, y la
 * validez de calendario y de reloj se decide después sobre esos grupos. Ver
 * `esTimestampValido`.
 */
const RE_ISO_CON_ZONA =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:([+-])(\d{2}):(\d{2})|Z)$/;

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El `CHECK` de la columna admite 1..80; el trigger sólo produce `[a-z0-9-]`. */
const RE_SLUG = /^[a-z0-9-]{1,80}$/;

const SEPARADOR_CURSOR = '|';

// ─── Los límites son los de PostgreSQL, medidos contra PostgREST local ────────
//
// La rejilla no puede ser «lo que parezca una fecha»: tiene que ser «lo que la base
// acepta». Todo lo que ella rechaza y esta función deja pasar sale por el `.or()` y
// vuelve como un 400, que es justo lo que `E3b.5` promete que no pasa. Los dos valores
// de abajo se midieron con `curl` contra el 54331, no se dedujeron de la documentación:
//
//   0000-01-01T00:00:00Z        → 400 `22008`   ·  0001-01-01T00:00:00Z → 200
//   2026-01-01T00:00:00±16:00   → 400 `22009`   ·  …±15:59             → 200

/** No hay año cero: PostgreSQL pasa de 1 a. C. a 1 d. C. */
const ANIO_MINIMO = 1;

/** PostgreSQL admite desfases hasta ±15:59:59; a las 16 en punto contesta `22009`. */
const DESFASE_HORAS_MAXIMO = 15;

// DONDE ESTA REJILLA ES MÁS ESTRICTA QUE LA BASE, Y POR QUÉ ESTÁ BIEN.
// Un barrido de 1056 candidatos contra PostgREST local dejó dos familias que la base
// ACEPTA normalizándolas y aquí se rechazan: el segundo `60` (`23:59:60Z` → 200) y la
// hora `24` (`24:00:00Z` → 200, el día siguiente). Es deliberado y lo fija el contrato
// de la r4. No rompe nada: rechazar significa cursor `null` y página 1 —sin error—, y
// PostgREST nunca EMITE ninguna de las dos formas en un `published_at`, porque Postgres
// las normaliza al guardar. Así que un cursor legítimo no puede contenerlas.
// En el sentido que importa —lo que la base rechaza y aquí se colaría— el barrido dio 0.

/**
 * ¿Existe realmente ese día en el calendario?
 *
 * Reconstruye la fecha en UTC y EXIGE QUE VUELVA IDÉNTICA. Una fecha imposible no falla al
 * construirse: se desborda. `Date.UTC(2026, 1, 31)` devuelve el 3 de marzo, así que si los
 * componentes reconstruidos no coinciden con los de entrada, la entrada era imposible.
 *
 * Ésta es exactamente la comprobación que `Date.parse()` NO hace, y por la que hasta la r4
 * un `2026-02-31T12:00:00+00:00` pasaba la validación y llegaba crudo al `.or()`, con
 * PostgREST contestando `400 22008`.
 *
 * El año se pone aparte con `setUTCFullYear` porque `Date.UTC` mapea los años 0-99 a
 * 1900-1999; sin eso, un `0026-…` se rechazaría por una razón falsa en vez de por su
 * calendario. El desbordamiento se sigue detectando igual: `setUTCFullYear` reaplica mes y
 * día sobre el año real, así que un 29 de febrero de un año no bisiesto vuelve a rodar.
 */
function esFechaDeCalendario(anio: number, mes: number, dia: number): boolean {
  const reconstruida = new Date(Date.UTC(2000, mes - 1, dia));
  reconstruida.setUTCFullYear(anio);

  return (
    reconstruida.getUTCFullYear() === anio &&
    reconstruida.getUTCMonth() === mes - 1 &&
    reconstruida.getUTCDate() === dia
  );
}

/**
 * Forma ISO **y** validez real, sin apoyarse en `Date.parse()`.
 *
 * `Date.parse()` normaliza en vez de rechazar, así que no sirve de rejilla: devuelve un
 * número finito para el 31 de febrero. Aquí la forma la pone la expresión regular y la
 * validez la ponen los componentes — hora ≤ 23, minuto y segundo ≤ 59, desfase dentro de
 * ±15:59, año ≥ 1, y un día que exista de verdad.
 *
 * **El criterio de «válido» es el de PostgreSQL, no el de JavaScript.** La r4 los confundió:
 * aceptaba el año `0000` y desfases hasta `±23:59` porque `Date` los admite, y la base los
 * rechaza con `22008` y `22009`. Ver `ANIO_MINIMO` y `DESFASE_HORAS_MAXIMO`.
 */
export function esTimestampValido(valor: string): boolean {
  const partes = RE_ISO_CON_ZONA.exec(valor);
  if (!partes) return false;

  const [, anio, mes, dia, hora, minuto, segundo, , desfaseHoras, desfaseMinutos] = partes;

  if (Number(anio) < ANIO_MINIMO) return false;

  // La hora 24 es el otro agujero que dejaba `Date.parse()`: la rodaba al día siguiente.
  if (Number(hora) > 23 || Number(minuto) > 59 || Number(segundo) > 59) return false;

  // `undefined` cuando la zona es `Z`, que no lleva desfase que validar.
  if (desfaseHoras !== undefined) {
    if (Number(desfaseHoras) > DESFASE_HORAS_MAXIMO || Number(desfaseMinutos) > 59) return false;
  }

  return esFechaDeCalendario(Number(anio), Number(mes), Number(dia));
}

export function esUuidValido(valor: string): boolean {
  return RE_UUID.test(valor);
}

export function esSlugValido(valor: string): boolean {
  return RE_SLUG.test(valor);
}

/**
 * Codifica el cursor en base64url.
 *
 * El timestamp lleva `:` y, con zona positiva, un `+`. En una query string `+` se decodifica
 * como espacio, así que un cursor en claro NO sobrevive la ida y vuelta. base64url no tiene
 * ninguno de los dos caracteres, así que viaja tal cual.
 */
export function codificarCursor(cursor: CursorReflexiones): string {
  const plano = `${cursor.publishedAt}${SEPARADOR_CURSOR}${cursor.id}`;
  return btoa(plano).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodifica y VALIDA. Devuelve `null` ante cualquier duda — codificación rota, timestamp
 * que no parsea, id que no es UUID, o gramática inyectada.
 *
 * `null` significa «página 1», nunca «pásalo igualmente».
 */
export function decodificarCursor(crudo: string | null | undefined): CursorReflexiones | null {
  if (!crudo) return null;

  let plano: string;
  try {
    const base64 = crudo.replace(/-/g, '+').replace(/_/g, '/');
    plano = atob(base64);
  } catch {
    return null;
  }

  const partes = plano.split(SEPARADOR_CURSOR);
  if (partes.length !== 2) return null;

  const [publishedAt, id] = partes;
  if (!esTimestampValido(publishedAt)) return null;
  if (!esUuidValido(id)) return null;

  return { publishedAt, id };
}

/**
 * El filtro de keyset: `published_at < pa` OR (`published_at = pa` AND `id > id`).
 *
 * Sólo se llama con un cursor ya validado. Medido contra PostgREST local:
 * `status=200, error=null`.
 */
export function filtroCursor(cursor: CursorReflexiones): string {
  return (
    `published_at.lt.${cursor.publishedAt},` +
    `and(published_at.eq.${cursor.publishedAt},id.gt.${cursor.id})`
  );
}

// ─── Costura para poder observar la consulta ──────────────────────────────────
//
// `construirConsultaPagina` recibe el cliente en vez de tomarlo del módulo para que un
// test pueda pasar un doble y AFIRMAR EL CABLEADO: que se emiten los dos `.order()`, el
// segundo de ellos el desempate por `id`. Sin esta costura esa mutación sólo se puede
// matar por el orden físico que devuelva Postgres, que no es una garantía.

export interface RespuestaConsulta {
  data: ReflexionPublicada[] | null;
  error: { message: string } | null;
  status?: number;
}

export interface ConsultaEncadenable extends PromiseLike<RespuestaConsulta> {
  select(campos: string): ConsultaEncadenable;
  eq(columna: string, valor: string): ConsultaEncadenable;
  or(filtro: string): ConsultaEncadenable;
  order(columna: string, opciones: { ascending: boolean }): ConsultaEncadenable;
  limit(cantidad: number): ConsultaEncadenable;
}

export interface ClienteConsulta {
  from(tabla: string): ConsultaEncadenable;
}

/**
 * El cliente real tiene tipos mucho más ricos que esta interfaz mínima; la conversión
 * existe para poder inyectar un doble en los tests, no para saltarse el tipado de la
 * respuesta, que sigue siendo `ReflexionPublicada[]`.
 */
function clientePorDefecto(): ClienteConsulta {
  return supabase as unknown as ClienteConsulta;
}

export function construirConsultaPagina(
  cliente: ClienteConsulta,
  cursor: CursorReflexiones | null
): ConsultaEncadenable {
  let consulta = cliente
    .from(TABLA_EPISODIOS)
    .select(CAMPOS_EPISODIO)
    .eq('status', 'published');

  if (cursor) {
    consulta = consulta.or(filtroCursor(cursor));
  }

  return consulta
    .order('published_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(TAMANO_LOTE);
}

export function construirConsultaEpisodio(
  cliente: ClienteConsulta,
  slug: string
): ConsultaEncadenable {
  return cliente
    .from(TABLA_EPISODIOS)
    .select(CAMPOS_EPISODIO)
    .eq('status', 'published')
    .eq('slug', slug)
    .limit(1);
}

/** Se lanza cuando la consulta falla. La UI la traduce a un mensaje estable en español. */
export class ErrorReflexiones extends Error {}

/** Nombre del sitio, para el marcador que sustituye a una portada ausente. */
export const NOMBRE_DEL_SITIO = 'CASA — Comunidad Anglicana San Andrés';

/**
 * `episode_date` es un `DATE` (`YYYY-MM-DD`), no un instante.
 *
 * `new Date('2026-01-04')` lo interpreta como medianoche UTC, que en Chile es el día 3:
 * la fecha se pintaría un día antes. Por eso se descompone a mano y se construye la fecha
 * en hora local. Vive aquí, y no en cada página, para que el índice y el episodio no
 * puedan divergir en cómo escriben la misma fecha.
 */
export function formatearFechaEpisodio(episodeDate: string): string {
  const [anio, mes, dia] = episodeDate.split('-').map(Number);
  if (!anio || !mes || !dia) return episodeDate;

  return new Date(anio, mes - 1, dia).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Una página del índice. `crudoDesde` es el parámetro de URL sin tocar: la validación
 * ocurre aquí dentro, para que ninguna página pueda saltársela.
 */
export async function obtenerPaginaReflexiones(
  crudoDesde: string | null | undefined,
  cliente: ClienteConsulta = clientePorDefecto()
): Promise<PaginaReflexiones> {
  const cursor = decodificarCursor(crudoDesde);
  const { data, error } = await construirConsultaPagina(cliente, cursor);

  if (error) throw new ErrorReflexiones(error.message);

  const filas = data ?? [];
  const episodios = filas.slice(0, TAMANO_PAGINA);
  const hayMas = filas.length > TAMANO_PAGINA;
  const ultima = episodios[episodios.length - 1];

  return {
    episodios,
    siguienteCursor:
      hayMas && ultima && ultima.published_at
        ? { publishedAt: ultima.published_at, id: ultima.id }
        : null,
  };
}

/**
 * Un episodio por su slug. Devuelve `null` cuando no hay ninguno visible con ese slug —
 * que cubre por igual «no existe» y «existe pero está despublicado y la RLS lo oculta».
 * La página no distingue los dos casos, y es deliberado: distinguirlos filtraría la
 * existencia de borradores.
 */
export async function obtenerReflexionPorSlug(
  slug: string | undefined,
  cliente: ClienteConsulta = clientePorDefecto()
): Promise<ReflexionPublicada | null> {
  if (!slug || !esSlugValido(slug)) return null;

  const { data, error } = await construirConsultaEpisodio(cliente, slug);

  if (error) throw new ErrorReflexiones(error.message);

  return data?.[0] ?? null;
}
