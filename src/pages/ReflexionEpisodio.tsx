/**
 * `/reflexiones/:slug` — página pública de un episodio (AUDIO / E3b).
 *
 * Reproductor, descarga y el enlace canónico visible y copiable.
 *
 * EL «NO ENCONTRADO» DE AQUÍ ES VISUAL, Y EL HTTP SIGUE SIENDO 200. `vercel.json` tiene un
 * único rewrite `/(.*)` → `/index.html`, así que ninguna ruta puede devolver un 404 real sin
 * cambiar el modelo de servido: eso es de la ola 3 (`E4-impl`). No se finge el código.
 *
 * Tampoco se reutiliza `src/pages/NotFound.tsx`: su texto está en inglés y D14 exige español.
 *
 * Un episodio despublicado y uno inexistente muestran EL MISMO estado, a propósito:
 * distinguirlos filtraría la existencia de borradores.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Calendar, Check, Copy, Download, Mic } from 'lucide-react';
import { CANONICAL_ORIGIN } from '@/lib/sermon-editor/publishService';
import {
  ErrorReflexiones,
  formatearFechaEpisodio,
  obtenerReflexionPorSlug,
  type ReflexionPublicada,
} from '@/lib/reflexiones/queries';
import { PortadaDeReflexion } from '@/pages/Reflexiones';

/**
 * La URL canónica se construye desde `CANONICAL_ORIGIN` (D19), la MISMA constante que usa
 * `publishService` al publicar. No es una copia: si el origen cambiara, cambian las dos.
 *
 * Sin `export`: este módulo es una página, y exportar de él algo que no sea un componente
 * dispara `react-refresh/only-export-components` — un diagnóstico nuevo que el gate D18
 * cuenta. Su único consumidor está en este fichero.
 */
function urlCanonicaDeReflexion(slug: string): string {
  return `${CANONICAL_ORIGIN}/reflexiones/${slug}`;
}

function ControlDeCompartir({ slug }: { slug: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = urlCanonicaDeReflexion(slug);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles el enlace sigue visible y seleccionable a mano.
      setCopiado(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <label htmlFor="enlace-canonico" className="block text-sm font-medium text-slate-700">
        Comparte esta reflexión
      </label>
      <div className="mt-2 flex gap-2">
        {/* El enlace se PINTA, no sólo se copia: sin portapapeles sigue estando a la vista. */}
        <input
          id="enlace-canonico"
          type="text"
          readOnly
          value={url}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
        />
        <button
          type="button"
          onClick={copiar}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {copiado ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {copiado ? 'Copiado' : 'Copiar enlace'}
        </button>
      </div>
    </div>
  );
}

function EstadoSimple({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
      <p className="mt-3 text-slate-600">{detalle}</p>
      <Link
        to="/reflexiones"
        className="mt-6 inline-block text-sm font-medium text-slate-700 underline hover:text-slate-900"
      >
        Volver a las reflexiones
      </Link>
    </main>
  );
}

export default function ReflexionEpisodioPage() {
  const { slug } = useParams<{ slug: string }>();

  const [episodio, setEpisodio] = useState<ReflexionPublicada | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;

    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        const encontrado = await obtenerReflexionPorSlug(slug);
        if (!vigente) return;
        setEpisodio(encontrado);
      } catch (e) {
        if (!vigente) return;
        setEpisodio(null);
        setError(
          e instanceof ErrorReflexiones
            ? 'No pudimos cargar esta reflexión. Vuelve a intentarlo en un momento.'
            : 'Ocurrió un error inesperado al cargar esta reflexión.'
        );
      } finally {
        if (vigente) setCargando(false);
      }
    };

    void cargar();
    return () => {
      vigente = false;
    };
  }, [slug]);

  if (cargando) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-slate-600">Cargando la reflexión…</p>
      </main>
    );
  }

  if (error) {
    return <EstadoSimple titulo="No pudimos cargar la reflexión" detalle={error} />;
  }

  if (!episodio) {
    return (
      <EstadoSimple
        titulo="No encontramos esta reflexión"
        detalle="Puede que el enlace esté equivocado o que la reflexión ya no esté publicada."
      />
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Link
        to="/reflexiones"
        className="inline-block text-sm font-medium text-slate-700 underline hover:text-slate-900"
      >
        Volver a las reflexiones
      </Link>

      <PortadaDeReflexion episodio={episodio} />

      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">{episodio.title}</h1>
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          {formatearFechaEpisodio(episodio.episode_date)}
        </p>
        {/* Sin predicador se omite la línea entera, igual que en el índice. */}
        {episodio.speaker && (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Mic className="h-4 w-4" aria-hidden="true" />
            {episodio.speaker}
          </p>
        )}
      </header>

      {episodio.description && (
        <p className="whitespace-pre-line text-slate-700">{episodio.description}</p>
      )}

      {episodio.audio_url ? (
        <div className="space-y-3">
          <audio controls preload="none" src={episodio.audio_url} className="w-full">
            Tu navegador no puede reproducir este audio.
          </audio>
          <a
            href={episodio.audio_url}
            download
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 underline hover:text-slate-900"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Descargar el audio
          </a>
        </div>
      ) : (
        <p className="text-slate-600">Esta reflexión todavía no tiene audio disponible.</p>
      )}

      {episodio.slug && <ControlDeCompartir slug={episodio.slug} />}
    </main>
  );
}
