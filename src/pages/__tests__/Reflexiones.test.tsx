/**
 * Índice `/reflexiones` — estados de la página y los fallbacks de campos nulos
 * (AUDIO / E3b, criterios E3b.1 y E3b.11).
 *
 * `speaker` y `cover_url` son nulables en la base y la fila publicada del seed NO trae
 * ninguno de los dos, así que los fallbacks son el caso normal, no el raro.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReflexionesPage from '../Reflexiones';
import {
  ErrorReflexiones,
  NOMBRE_DEL_SITIO,
  obtenerPaginaReflexiones,
  type PaginaReflexiones,
  type ReflexionPublicada,
} from '@/lib/reflexiones/queries';

vi.mock('@/lib/reflexiones/queries', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/reflexiones/queries')>();
  return { ...real, obtenerPaginaReflexiones: vi.fn() };
});

const consultaSimulada = vi.mocked(obtenerPaginaReflexiones);

const EPISODIO_BASE: ReflexionPublicada = {
  id: '00000000-e2e0-4000-9000-000000000010',
  slug: 'reflexion-2026-01-04',
  title: 'Reflexión publicada',
  description: null,
  speaker: null,
  cover_url: null,
  published_at: '2026-01-04T12:00:00+00:00',
  episode_date: '2026-01-04',
  duration_seconds: 600,
  audio_url: 'https://example.invalid/audio.mp3',
};

const pagina = (episodios: ReflexionPublicada[]): PaginaReflexiones => ({
  episodios,
  siguienteCursor: null,
});

function pintar() {
  return render(
    <MemoryRouter initialEntries={['/reflexiones']}>
      <ReflexionesPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  consultaSimulada.mockReset();
});

describe('índice de reflexiones (E3b.1)', () => {
  it('lista los episodios publicados con su título y su fecha', async () => {
    consultaSimulada.mockResolvedValue(pagina([EPISODIO_BASE]));
    pintar();

    expect(await screen.findByText('Reflexión publicada')).toBeInTheDocument();
    expect(screen.getByText(/4 de enero de 2026/i)).toBeInTheDocument();
  });

  it('muestra predicador y portada CUANDO existen', async () => {
    consultaSimulada.mockResolvedValue(
      pagina([
        {
          ...EPISODIO_BASE,
          speaker: 'Pastora invitada',
          cover_url: 'https://example.invalid/portada.jpg',
        },
      ])
    );
    pintar();

    expect(await screen.findByText('Pastora invitada')).toBeInTheDocument();
    const portada = screen.getByRole('img', { name: /Portada de «Reflexión publicada»/ });
    expect(portada).toHaveAttribute('src', 'https://example.invalid/portada.jpg');
  });

  it('sin predicador NO inventa nombre ni escribe «Anónimo»: omite la línea', async () => {
    consultaSimulada.mockResolvedValue(pagina([EPISODIO_BASE]));
    pintar();

    await screen.findByText('Reflexión publicada');
    expect(screen.queryByText(/anónimo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sin predicador/i)).not.toBeInTheDocument();
  });

  it('sin portada usa un marcador neutro con el nombre del sitio, nunca un `alt` vacío', async () => {
    consultaSimulada.mockResolvedValue(pagina([EPISODIO_BASE]));
    pintar();

    const marcador = await screen.findByRole('img', { name: new RegExp(NOMBRE_DEL_SITIO) });
    expect(marcador).toBeInTheDocument();
    expect(marcador.getAttribute('aria-label')).not.toBe('');
    // Y no se cuela una `<img>` con `src` vacío, que es el hueco roto que se prohíbe.
    expect(document.querySelector('img[src=""]')).toBeNull();
  });

  it('enlaza cada tarjeta a su página por slug', async () => {
    consultaSimulada.mockResolvedValue(pagina([EPISODIO_BASE]));
    pintar();

    const enlace = await screen.findByRole('link');
    expect(enlace).toHaveAttribute('href', '/reflexiones/reflexion-2026-01-04');
  });
});

describe('estados de la página', () => {
  it('estado vacío en español cuando no hay nada publicado', async () => {
    consultaSimulada.mockResolvedValue(pagina([]));
    pintar();

    expect(await screen.findByText(/Todavía no hay reflexiones publicadas/i)).toBeInTheDocument();
  });

  it('estado de ERROR estable en español, ni spinner perpetuo ni página en blanco (E3b.11)', async () => {
    consultaSimulada.mockRejectedValue(new ErrorReflexiones('PostgREST se cayó'));
    pintar();

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent(/No pudimos cargar las reflexiones/i);

    // El spinner tiene que haber DESAPARECIDO: lo que E3b.11 prohíbe es que se quede.
    await waitFor(() => {
      expect(screen.queryByText(/Cargando reflexiones/i)).not.toBeInTheDocument();
    });
    // Y no se filtra el mensaje crudo de la base.
    expect(screen.queryByText(/PostgREST se cayó/)).not.toBeInTheDocument();
  });

  it('«Más antiguas» sólo aparece cuando hay una página siguiente', async () => {
    consultaSimulada.mockResolvedValue(pagina([EPISODIO_BASE]));
    const { unmount } = pintar();

    await screen.findByText('Reflexión publicada');
    expect(screen.queryByRole('button', { name: /Más antiguas/i })).not.toBeInTheDocument();
    unmount();

    consultaSimulada.mockResolvedValue({
      episodios: [EPISODIO_BASE],
      siguienteCursor: { publishedAt: EPISODIO_BASE.published_at!, id: EPISODIO_BASE.id },
    });
    pintar();

    expect(await screen.findByRole('button', { name: /Más antiguas/i })).toBeInTheDocument();
  });
});
