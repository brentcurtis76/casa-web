/**
 * `/reflexiones` — índice público de reflexiones publicadas (AUDIO / E3b).
 *
 * Pública de verdad: no va envuelta en `ProtectedRoute` y la RLS
 * `podcast_episodes_public_read` sólo deja ver `status = 'published'`.
 *
 * La paginación es por keyset y el cursor viaja en `?desde=`. Esta página NO lo interpreta:
 * se lo pasa crudo a `obtenerPaginaReflexiones`, que valida y descarta lo que no encaje.
 * Así no hay dos sitios donde pueda colarse un cursor sucio.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Mic } from 'lucide-react';
import {
  ErrorReflexiones,
  NOMBRE_DEL_SITIO,
  codificarCursor,
  formatearFechaEpisodio,
  obtenerPaginaReflexiones,
  type CursorReflexiones,
  type ReflexionPublicada,
} from '@/lib/reflexiones/queries';

/**
 * Marcador de portada ausente (contrato de E3b): nunca un hueco roto ni un `alt` vacío.
 * `speaker` y `cover_url` son nulables y la fila publicada del seed no trae ninguno.
 */
export function PortadaDeReflexion({ episodio }: { episodio: ReflexionPublicada }) {
  if (episodio.cover_url) {
    return (
      <img
        src={episodio.cover_url}
        alt={`Portada de «${episodio.title}»`}
        className="h-40 w-full rounded-t-lg object-cover"
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`Reflexión sin portada — ${NOMBRE_DEL_SITIO}`}
      className="flex h-40 w-full items-center justify-center rounded-t-lg bg-slate-100 px-4 text-center"
    >
      <span className="text-sm font-medium text-slate-500">{NOMBRE_DEL_SITIO}</span>
    </div>
  );
}

function TarjetaDeReflexion({ episodio }: { episodio: ReflexionPublicada }) {
  const contenido = (
    <article className="h-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <PortadaDeReflexion episodio={episodio} />
      <div className="space-y-2 p-4">
        <h2 className="text-lg font-semibold text-slate-900">{episodio.title}</h2>
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          {formatearFechaEpisodio(episodio.episode_date)}
        </p>
        {/* Sin predicador NO se inventa nombre ni se escribe «Anónimo»: se omite la línea. */}
        {episodio.speaker && (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Mic className="h-4 w-4" aria-hidden="true" />
            {episodio.speaker}
          </p>
        )}
      </div>
    </article>
  );

  // Sin slug no hay URL pública que ofrecer. No puede pasar con una fila `published`
  // (el CHECK `podcast_episode_published_has_slug` lo impide), pero la columna es
  // nulable y el tipo lo refleja, así que la página no asume lo que no puede probar.
  if (!episodio.slug) return contenido;

  return (
    <Link to={`/reflexiones/${episodio.slug}`} className="block h-full">
      {contenido}
    </Link>
  );
}

export default function ReflexionesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const desde = searchParams.get('desde');

  const [episodios, setEpisodios] = useState<ReflexionPublicada[]>([]);
  const [siguienteCursor, setSiguienteCursor] = useState<CursorReflexiones | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;

    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        const pagina = await obtenerPaginaReflexiones(desde);
        if (!vigente) return;
        setEpisodios(pagina.episodios);
        setSiguienteCursor(pagina.siguienteCursor);
      } catch (e) {
        if (!vigente) return;
        // Estado de error ESTABLE: nunca un spinner perpetuo ni una página en blanco.
        setEpisodios([]);
        setSiguienteCursor(null);
        setError(
          e instanceof ErrorReflexiones
            ? 'No pudimos cargar las reflexiones. Vuelve a intentarlo en un momento.'
            : 'Ocurrió un error inesperado al cargar las reflexiones.'
        );
      } finally {
        if (vigente) setCargando(false);
      }
    };

    void cargar();
    return () => {
      vigente = false;
    };
  }, [desde]);

  const irAMasAntiguas = useCallback(() => {
    if (!siguienteCursor) return;
    setSearchParams({ desde: codificarCursor(siguienteCursor) });
  }, [siguienteCursor, setSearchParams]);

  const irAlComienzo = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Reflexiones</h1>
        <p className="mt-2 text-slate-600">
          Escucha las reflexiones de nuestra comunidad.
        </p>
      </header>

      {cargando && <p className="text-slate-600">Cargando reflexiones…</p>}

      {!cargando && error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {!cargando && !error && episodios.length === 0 && (
        <p className="text-slate-600">Todavía no hay reflexiones publicadas.</p>
      )}

      {!cargando && !error && episodios.length > 0 && (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {episodios.map((episodio) => (
            <li key={episodio.id}>
              <TarjetaDeReflexion episodio={episodio} />
            </li>
          ))}
        </ul>
      )}

      {!cargando && !error && (
        <nav className="mt-10 flex items-center justify-between" aria-label="Paginación">
          {desde ? (
            <button
              type="button"
              onClick={irAlComienzo}
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Más recientes
            </button>
          ) : (
            <span />
          )}

          {siguienteCursor && (
            <button
              type="button"
              onClick={irAMasAntiguas}
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              Más antiguas
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </nav>
      )}
    </main>
  );
}
