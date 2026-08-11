/**
 * Aritmética del cursor, ida y vuelta por la URL, cursores hostiles y CABLEADO de la
 * consulta (AUDIO / E3b). Puro: no toca la red.
 *
 * Lo que este fichero NO puede probar, y por eso existe `tests/e2e/reflexiones-paginacion.spec.ts`:
 * que PostgREST parsee el `.or()` anidado. Un doble siempre dirá que sí.
 */

import { describe, expect, it } from 'vitest';
import {
  CAMPOS_EPISODIO,
  TABLA_EPISODIOS,
  TAMANO_LOTE,
  TAMANO_PAGINA,
  codificarCursor,
  construirConsultaPagina,
  decodificarCursor,
  esSlugValido,
  esTimestampValido,
  filtroCursor,
  formatearFechaEpisodio,
  obtenerPaginaReflexiones,
  type ClienteConsulta,
  type ConsultaEncadenable,
  type CursorReflexiones,
  type ReflexionPublicada,
  type RespuestaConsulta,
} from '../queries';

const PA = '2026-03-01T12:00:00+00:00';
const ID = '00000000-e2e0-4000-8000-000000000101';

interface Llamada {
  metodo: string;
  args: unknown[];
}

/**
 * Doble del cliente que REGISTRA la cadena emitida.
 *
 * Es la costura que permite matar la mutación «quitar el desempate por `id`» sin depender
 * del orden físico que devuelva Postgres: aquí se afirma que el segundo `.order()` se
 * emite, no que el resultado salió ordenado.
 */
function clienteEspia(respuesta: RespuestaConsulta): {
  cliente: ClienteConsulta;
  llamadas: Llamada[];
} {
  const llamadas: Llamada[] = [];

  const consulta: ConsultaEncadenable = {
    select(campos) {
      llamadas.push({ metodo: 'select', args: [campos] });
      return consulta;
    },
    eq(columna, valor) {
      llamadas.push({ metodo: 'eq', args: [columna, valor] });
      return consulta;
    },
    or(filtro) {
      llamadas.push({ metodo: 'or', args: [filtro] });
      return consulta;
    },
    order(columna, opciones) {
      llamadas.push({ metodo: 'order', args: [columna, opciones] });
      return consulta;
    },
    limit(cantidad) {
      llamadas.push({ metodo: 'limit', args: [cantidad] });
      return consulta;
    },
    then(alCumplir) {
      return Promise.resolve(respuesta).then(alCumplir);
    },
  };

  return {
    cliente: {
      from(tabla) {
        llamadas.push({ metodo: 'from', args: [tabla] });
        return consulta;
      },
    },
    llamadas,
  };
}

function filaFalsa(indice: number, publishedAt = PA): ReflexionPublicada {
  const id = `00000000-e2e0-4000-8000-${String(101 + indice).padStart(12, '0')}`;
  return {
    id,
    slug: `reflexion-falsa-${indice}`,
    title: `Reflexión ${indice}`,
    description: null,
    speaker: null,
    cover_url: null,
    published_at: publishedAt,
    episode_date: '2026-03-01',
    duration_seconds: 60,
    audio_url: 'https://example.invalid/x.mp3',
  };
}

const respuestaCon = (filas: ReflexionPublicada[]): RespuestaConsulta => ({
  data: filas,
  error: null,
  status: 200,
});

describe('cursor — ida y vuelta por la URL (E3b.4)', () => {
  it.each([
    ['zona positiva', '2026-03-01T12:00:00+00:00'],
    ['zona negativa', '2026-03-01T09:00:00-03:00'],
    ['sufijo Z', '2026-03-01T12:00:00Z'],
    ['con fracción de segundo', '2026-08-10T20:58:49.652180+00:00'],
  ])('sobrevive sin pérdida: %s', (_caso, publishedAt) => {
    const cursor: CursorReflexiones = { publishedAt, id: ID };
    const codificado = codificarCursor(cursor);

    // Lo que rompe un cursor en claro: `+` se decodifica como espacio en una query string.
    expect(codificado).not.toContain('+');
    expect(codificado).not.toContain('/');
    expect(codificado).not.toContain('=');

    // Y la vuelta completa por una URL real, no sólo por la función.
    const url = new URL(`https://ejemplo.invalid/reflexiones?desde=${codificado}`);
    expect(decodificarCursor(url.searchParams.get('desde'))).toEqual(cursor);
  });

  it('sin parámetro `desde` no hay cursor, y eso significa página 1', () => {
    expect(decodificarCursor(null)).toBeNull();
    expect(decodificarCursor(undefined)).toBeNull();
    expect(decodificarCursor('')).toBeNull();
  });
});

describe('cursores hostiles o rotos (E3b.5)', () => {
  const codificarCrudo = (plano: string) =>
    btoa(plano).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const CASOS: Array<[string, string]> = [
    ['timestamp inválido', codificarCrudo(`no-es-una-fecha|${ID}`)],
    ['UUID inválido', codificarCrudo(`${PA}|no-soy-un-uuid`)],
    ['codificación truncada', codificarCrudo(`${PA}|${ID}`).slice(0, -8)],
    [
      'gramática de PostgREST inyectada',
      codificarCrudo(`${PA},or(status.eq.draft)|${ID}`),
    ],
  ];

  it.each(CASOS)('%s ⇒ se descarta y no llega al filtro', (caso, crudo) => {
    const decodificado = decodificarCursor(crudo);

    const { cliente, llamadas } = clienteEspia(respuestaCon([]));
    construirConsultaPagina(cliente, decodificado);
    const filtros = llamadas.filter((l) => l.metodo === 'or');

    // Salida cruda de los cuatro, para que el informe no tenga que creerse el verde.
    console.log(
      `[E3b.5] ${caso}\n  desde crudo = ${crudo}\n  decodificado = ${JSON.stringify(
        decodificado
      )}\n  llamadas .or() = ${JSON.stringify(filtros)}`
    );

    expect(decodificado).toBeNull();
    expect(filtros).toEqual([]);
  });

  it('un `desde` sucio devuelve la PÁGINA 1, no una página vacía ni un error', async () => {
    const { cliente, llamadas } = clienteEspia(respuestaCon([filaFalsa(0)]));
    const pagina = await obtenerPaginaReflexiones(
      codificarCrudo(`${PA},or(status.eq.draft)|${ID}`),
      cliente
    );

    expect(pagina.episodios).toHaveLength(1);
    expect(llamadas.some((l) => l.metodo === 'or')).toBe(false);
  });
});

/**
 * E3b.5b — el agujero que Codex encontró en la review final de la fase.
 *
 * `Date.parse()` NO rechaza una fecha imposible: la normaliza y devuelve un número finito,
 * así que `esTimestampValido` decía `true` y el valor CRUDO llegaba al `.or()`. PostgREST
 * contestaba `400 22008` en vez de degradar a página 1, que es lo que `E3b.5` promete.
 *
 * Los cuatro casos de abajo son los medidos por Codex y reproducidos por el PM.
 */
describe('fechas de calendario imposibles (E3b.5b)', () => {
  const codificarCrudo = (plano: string) =>
    btoa(plano).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  /** `[caso, timestamp, en qué lo convertía `Date.parse()`]` */
  const IMPOSIBLES: Array<[string, string, string]> = [
    ['31 de febrero', '2026-02-31T12:00:00+00:00', '2026-03-03'],
    ['29 de febrero de un año NO bisiesto', '2025-02-29T00:00:00Z', '2025-03-01'],
    ['31 de abril', '2026-04-31T00:00:00Z', '2026-05-01'],
    ['hora 24', '2026-01-01T24:00:00Z', 'el día siguiente'],
  ];

  it.each(IMPOSIBLES)(
    '%s ⇒ cursor nulo, página 1 y cero `.or()`',
    async (caso, timestamp, normalizacion) => {
      const valido = esTimestampValido(timestamp);
      const crudo = codificarCrudo(`${timestamp}|${ID}`);
      const decodificado = decodificarCursor(crudo);

      const { cliente, llamadas } = clienteEspia(respuestaCon([filaFalsa(0)]));
      const pagina = await obtenerPaginaReflexiones(crudo, cliente);
      const filtros = llamadas.filter((l) => l.metodo === 'or');

      // Salida cruda de los cuatro: el informe no tiene que creerse el verde.
      console.log(
        `[E3b.5b] ${caso}\n  timestamp = ${timestamp}\n  ` +
          `Date.parse lo normalizaba a = ${normalizacion}\n  ` +
          `esTimestampValido = ${valido}\n  ` +
          `decodificarCursor = ${JSON.stringify(decodificado)}\n  ` +
          `episodios de la página = ${pagina.episodios.length}\n  ` +
          `llamadas .or() = ${JSON.stringify(filtros)}`
      );

      expect(valido).toBe(false);
      expect(decodificado).toBeNull();
      // Página 1: la consulta se emite igual, pero sin el filtro de keyset.
      expect(pagina.episodios).toHaveLength(1);
      expect(filtros).toEqual([]);
    }
  );
});

/**
 * La contrapartida de `E3b.5b`: el arreglo tenía que ser ESTRECHO. Lo que ya se rechazaba
 * bien sigue rechazándose, y —más importante, porque es lo que una validación más dura
 * rompe primero— lo que ya se aceptaba sigue aceptándose.
 */
describe('el arreglo de E3b.5b no desborda', () => {
  const CASOS: Array<[string, string, boolean]> = [
    // Ya se rechazaban con `Date.parse()`; tienen que seguir rechazándose sin él.
    ['desfase +99:99', '2026-03-01T12:00:00+99:99', false],
    ['desfase +25:00', '2026-03-01T12:00:00+25:00', false],
    ['desfase +00:61', '2026-03-01T12:00:00+00:61', false],
    ['segundo 60', '2026-03-01T12:00:60Z', false],
    ['segundo 99', '2026-03-01T12:00:99Z', false],
    ['mes 13', '2026-13-01T12:00:00Z', false],
    ['día 32', '2026-03-32T12:00:00Z', false],
    ['minuto 60', '2026-03-01T12:60:00Z', false],
    // Y lo que SÍ es válido y una rejilla demasiado dura mataría.
    ['desfase -14:00, que es un desfase real', '2026-03-01T09:00:00-14:00', true],
    ['fracción de segundo', '2026-08-10T20:58:49.652180+00:00', true],
    ['29 de febrero de un año bisiesto', '2024-02-29T00:00:00Z', true],
    ['31 de diciembre', '2026-12-31T23:59:59Z', true],
  ];

  it.each(CASOS)('%s ⇒ %s', (caso, timestamp, esperado) => {
    const obtenido = esTimestampValido(timestamp);
    console.log(`[E3b.5b/regresión] ${caso}: ${timestamp} ⇒ ${obtenido} (esperado ${esperado})`);
    expect(obtenido).toBe(esperado);
  });
});

describe('cableado de la consulta', () => {
  it('emite el desempate por `id` como SEGUNDO `.order()` (mutación 1)', () => {
    const { cliente, llamadas } = clienteEspia(respuestaCon([]));
    construirConsultaPagina(cliente, null);

    const ordenes = llamadas.filter((l) => l.metodo === 'order');
    expect(ordenes).toEqual([
      { metodo: 'order', args: ['published_at', { ascending: false }] },
      { metodo: 'order', args: ['id', { ascending: true }] },
    ]);
  });

  it('pide 13 para mostrar 12: la fila extra es sólo el centinela', () => {
    const { cliente, llamadas } = clienteEspia(respuestaCon([]));
    construirConsultaPagina(cliente, null);

    expect(TAMANO_LOTE).toBe(TAMANO_PAGINA + 1);
    expect(llamadas).toContainEqual({ metodo: 'limit', args: [TAMANO_LOTE] });
    expect(llamadas).toContainEqual({ metodo: 'from', args: [TABLA_EPISODIOS] });
    expect(llamadas).toContainEqual({ metodo: 'select', args: [CAMPOS_EPISODIO] });
    expect(llamadas).toContainEqual({ metodo: 'eq', args: ['status', 'published'] });
  });

  it('el filtro de keyset es literalmente el medido contra PostgREST', () => {
    expect(filtroCursor({ publishedAt: PA, id: ID })).toBe(
      `published_at.lt.${PA},and(published_at.eq.${PA},id.gt.${ID})`
    );
  });

  it('con cursor válido sí emite el `.or()`, una sola vez', () => {
    const { cliente, llamadas } = clienteEspia(respuestaCon([]));
    construirConsultaPagina(cliente, { publishedAt: PA, id: ID });

    expect(llamadas.filter((l) => l.metodo === 'or')).toEqual([
      { metodo: 'or', args: [filtroCursor({ publishedAt: PA, id: ID })] },
    ]);
  });
});

describe('aritmética de la página', () => {
  it('13 filas ⇒ 12 mostradas y cursor anclado a la 12.ª', async () => {
    const filas = Array.from({ length: 13 }, (_, i) => filaFalsa(i));
    const { cliente } = clienteEspia(respuestaCon(filas));

    const pagina = await obtenerPaginaReflexiones(null, cliente);

    expect(pagina.episodios).toHaveLength(12);
    expect(pagina.episodios.at(-1)?.id).toBe(filas[11].id);
    expect(pagina.siguienteCursor).toEqual({ publishedAt: PA, id: filas[11].id });
    // La 13.ª no se pinta nunca.
    expect(pagina.episodios.map((e) => e.id)).not.toContain(filas[12].id);
  });

  it('12 filas ⇒ es la última página y no hay cursor', async () => {
    const filas = Array.from({ length: 12 }, (_, i) => filaFalsa(i));
    const { cliente } = clienteEspia(respuestaCon(filas));

    const pagina = await obtenerPaginaReflexiones(null, cliente);

    expect(pagina.episodios).toHaveLength(12);
    expect(pagina.siguienteCursor).toBeNull();
  });

  it('tabla vacía ⇒ ni episodios ni cursor', async () => {
    const { cliente } = clienteEspia(respuestaCon([]));
    const pagina = await obtenerPaginaReflexiones(null, cliente);

    expect(pagina.episodios).toEqual([]);
    expect(pagina.siguienteCursor).toBeNull();
  });

  it('un error de la consulta se propaga; no se devuelve una página vacía silenciosa', async () => {
    const { cliente } = clienteEspia({ data: null, error: { message: 'boom' }, status: 500 });

    await expect(obtenerPaginaReflexiones(null, cliente)).rejects.toThrow('boom');
  });
});

describe('validación del slug', () => {
  it.each([
    ['reflexion-2026-01-04', true],
    ['reflexion-2026-01-04-2', true],
    ['MAYUSCULAS', false],
    ['con espacio', false],
    ['slug.con.punto', false],
    ['', false],
    ['x'.repeat(81), false],
  ])('%s ⇒ %s', (slug, esperado) => {
    expect(esSlugValido(slug)).toBe(esperado);
  });
});

describe('fecha del episodio', () => {
  it('no se corre un día: `episode_date` es un DATE, no un instante UTC', () => {
    // `new Date('2026-01-04')` sería medianoche UTC, o sea el día 3 en Chile.
    expect(formatearFechaEpisodio('2026-01-04')).toContain('4');
    expect(formatearFechaEpisodio('2026-01-04')).toContain('2026');
    expect(formatearFechaEpisodio('2026-01-04')).not.toContain('3 de');
  });
});
