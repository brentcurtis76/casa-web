/**
 * PH — Utilidades compartidas por las suites de editor de la fase.
 *
 * Nada acá afirma conducta: son el contexto, la `Story` semilla y los helpers
 * de manejo de tiempo/act que las tres suites PH usan igual. Las aserciones
 * viven en las suites. Sigue el precedente de `pbBoundary` /
 * `pcuiWarningFixtures`: helpers compartidos, no un wrapper de producción.
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';

import type { LiturgyContext } from '@/types/shared/liturgy';
import type { Story } from '@/types/shared/story';

import { invokes, type InvokeCall } from '@/lib/cuentacuentos/__tests__/pbBoundary';
import { EXISTING_DRAFTS_URL } from '@/lib/cuentacuentos/__tests__/pbImageFixtures';

export const CONTEXT: LiturgyContext = {
  id: 'lit-ph',
  date: new Date('2026-08-02'),
  title: 'Liturgia PH',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
};

export type BoundaryResult = { data: unknown; error: unknown };

/** Respuesta OK del borde pagado con `n` imágenes distinguibles entre sí. */
export const okImages = (...images: string[]): BoundaryResult => ({
  data: { success: true, images, skippedImages: [] },
  error: null,
});

/**
 * `Story` mínima que aterriza en el paso de escenas con la escena 1 ya
 * ilustrada, de modo que "Aprobar escenas" está disponible y la aprobación
 * arma el auto-arranque de portada+fin (camino de producción).
 */
export function makeStory(id: string, status = 'scenes-pending'): Story {
  return {
    id,
    title: `Cuento ${id}`,
    summary: 'Resumen breve',
    location: { name: 'Jerusalén' } as unknown as Story['location'],
    illustrationStyle: 'ghibli',
    characters: [
      {
        id: 'char-1',
        name: 'María',
        role: 'protagonist',
        description: 'Niña curiosa',
        visualDescription: 'niña con vestido azul',
        characterSheetUrl: EXISTING_DRAFTS_URL,
      } as unknown as Story['characters'][number],
    ],
    scenes: [
      {
        number: 1,
        text: 'Texto de la escena 1',
        visualDescription: 'Descripción visual 1',
        selectedImageUrl: EXISTING_DRAFTS_URL,
      } as unknown as Story['scenes'][number],
    ],
    props: [] as unknown as Story['props'],
    spiritualConnection: 'Esperanza',
    metadata: { createdAt: '', updatedAt: '', status: status as Story['metadata']['status'] },
  } as unknown as Story;
}

export async function yields(n: number) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

/** Deja correr timers REALES — el stagger del runner son 400 ms por worker. */
export async function settle(ms: number) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
    await yields(30);
  });
}

export function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.catch(() => {});
  return { promise, resolve, reject };
}

export const sceneImagesInvokes = (): InvokeCall[] =>
  invokes.filter((c) => c.fn === 'generate-scene-images');

export const invokesOfType = (type: string): InvokeCall[] =>
  sceneImagesInvokes().filter((c) => c.body.type === type);

/**
 * Lleva el editor REAL al paso `cover` aprobando escenas: es el camino de
 * producción y además ARMA el auto-arranque del lote portada+fin.
 */
export async function approveScenesIntoCoverStep() {
  const approve = await screen.findByRole(
    'button',
    { name: /Aprobar escenas/i },
    { timeout: 10000 },
  );
  await act(async () => {
    fireEvent.click(approve);
    await yields(60);
  });
  await waitFor(
    () => expect(screen.queryByRole('button', { name: /Aprobar escenas/i })).toBeNull(),
    { timeout: 10000 },
  );
}

/** Clic real sobre un botón, drenando microtasks como haría el usuario. */
export async function click(button: Element) {
  await act(async () => {
    fireEvent.click(button);
    await yields(40);
  });
}
