/**
 * PFE ronda 3 — A2: el cableado del reductor en LOS TRES sitios de subida.
 *
 * Qué prueba y qué NO prueba (D7):
 *
 *   Lo que NO prueba: que el reductor reduzca. Eso vive en
 *   `tests/e2e/downscale-image.spec.ts`, que corre el camino ráster REAL en
 *   chromium real (canvas de verdad, no jsdom) y mide entrada y salida. En
 *   jsdom el helper degrada — no hay canvas — y devuelve los bytes originales,
 *   así que "apareció un preview" acá no prueba absolutamente nada.
 *
 *   Lo que SÍ prueba: que cada sitio de subida ENTREGUE el archivo del usuario
 *   al reductor y guarde EN EL ESTADO lo que el reductor devolvió. Por eso se
 *   simula el borde del módulo: `readReferenceImageBase64` devuelve un
 *   centinela derivado del File, distinto de los bytes propios del archivo. Un
 *   sitio que ignore el archivo, invente el base64, o se salte el helper y lea
 *   el archivo por su cuenta falla por partida doble: el spy no recibe el File,
 *   y el preview no lleva el centinela.
 *
 *   Simular este borde es honesto justamente porque el helper está probado
 *   aparte en chromium real: acá no se está simulando lo que se afirma probar.
 *
 *   A2a — referencia de ESCENA  (paso escenas, panel "Ver prompt")
 *   A2b — referencia de PORTADA (paso portada, panel "Editar prompt")
 *   A2c — referencia de FIN     (paso portada, panel "Editar prompt")
 *
 * Igual que en la ronda 2, el editor es REAL y los hooks son REALES: lo único
 * simulado, además del borde del reductor, es el cliente de Supabase. El sitio
 * de subida crea su `<input type=file>` de forma imperativa y lo dispara con
 * `.click()`, así que el test intercepta ese click para quedarse con el input
 * recién creado y ejecuta el MISMO `onchange` que corre en producción — no una
 * copia del handler escrita a mano.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import type { Story } from '@/types/shared/story';
import type { LiturgyContext } from '@/types/shared/liturgy';

/**
 * Centinela: lo que el reductor "devuelve". Derivado del File para que además
 * delate un cruce de cables (un sitio que le pase el archivo de otro sitio).
 * Nunca coincide con los bytes propios del archivo.
 */
function sentinelFor(file: File): string {
  return btoa(`reducida:${file.name}:${file.size}`);
}

const { readReferenceMock } = vi.hoisted(() => ({
  readReferenceMock: vi.fn(async (file: File) => {
    return btoa(`reducida:${file.name}:${file.size}`);
  }),
}));

// Sólo se reemplaza `readReferenceImageBase64`. El tope de peso
// (`isReferenceImageTooLarge`) y su mensaje siguen siendo los reales.
vi.mock('@/lib/cuentacuentos/downscaleImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cuentacuentos/downscaleImage')>();
  return { ...actual, readReferenceImageBase64: readReferenceMock };
});

vi.mock('@/integrations/supabase/client', () => {
  let seq = 0;
  /** El upsert devuelve `updated_at`, que el hook usa como testigo. */
  const upsertBuilder = () => {
    const rowResult = async () => {
      seq += 1;
      return {
        data: { updated_at: `2026-05-01T00:00:${String(seq).padStart(2, '0')}.000Z` },
        error: null,
      };
    };
    return {
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(res as never, rej as never),
      select: () => ({
        maybeSingle: rowResult,
        single: rowResult,
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          rowResult().then(res as never, rej as never),
      }),
    };
  };

  const deleteChain = () => {
    const chain = {
      eq: () => chain,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ error: null, data: [] }).then(res as never, rej as never),
      select: () => ({
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve({ error: null, data: [] }).then(res as never, rej as never),
      }),
    };
    return chain;
  };

  const tableApi = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockImplementation(() => upsertBuilder()),
    delete: vi.fn().mockImplementation(() => deleteChain()),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  });

  const storageApi = () => ({
    upload: vi.fn().mockImplementation(async (path: string) => ({ data: { path }, error: null })),
    getPublicUrl: vi.fn().mockImplementation((path: string) => ({
      data: { publicUrl: `https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/${path}` },
    })),
    remove: vi.fn().mockResolvedValue({ error: null }),
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
    download: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  return {
    supabase: {
      from: vi.fn(() => tableApi()),
      storage: { from: vi.fn(() => storageApi()) },
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: { success: true, images: ['data:image/png;base64,iVBORw0KGgoAAA='] },
          error: null,
        }),
      },
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-pfe3' } } }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      },
    },
  };
});

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import CuentacuentoEditor from '../CuentacuentoEditor';

const baseContext: LiturgyContext = {
  id: 'lit-pfe3',
  date: new Date('2026-05-10'),
  title: 'Test Liturgy PFE3',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

/** Historia en `scenes-pending`: arranca en escenas; aprobarlas lleva a portada. */
function makeScenesPendingStory(id: string): Story {
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
        characterSheetUrl: 'https://mock/char-1.png',
      } as unknown as Story['characters'][number],
    ],
    scenes: [
      {
        number: 1,
        text: 'Escena de apertura',
        visualDescription: 'plaza soleada',
        selectedImageUrl: 'https://mock/scene-1.png',
      } as unknown as Story['scenes'][number],
    ],
    props: [] as unknown as Story['props'],
    spiritualConnection: 'Esperanza',
    metadata: {
      createdAt: '',
      updatedAt: '',
      status: 'scenes-pending' as Story['metadata']['status'],
    },
  } as unknown as Story;
}

let alertSpy: ReturnType<typeof vi.fn>;
/** Inputs de archivo que el editor creó y disparó imperativamente. */
let clickedInputs: HTMLInputElement[] = [];
let clickSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  readReferenceMock.mockClear();
  clickedInputs = [];
  alertSpy = vi.fn();
  vi.stubGlobal('alert', alertSpy);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ error: null }) } as unknown as Response),
  );
  clickSpy = vi
    .spyOn(HTMLInputElement.prototype, 'click')
    .mockImplementation(function (this: HTMLInputElement) {
      clickedInputs.push(this);
    });
  vi.useRealTimers();
});

afterEach(() => {
  clickSpy.mockRestore();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function yields(n: number) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

/** Bytes con patrón: su base64 no se parece a nada que un handler pueda inventar. */
function referenceBytes() {
  // `new Uint8Array(n)` y no `Uint8Array.from(...)`: el segundo se infiere como
  // `Uint8Array<ArrayBufferLike>`, que no es un `BlobPart` válido para `File`.
  const out = new Uint8Array(4096);
  for (let i = 0; i < out.length; i++) out[i] = (i * 7 + 13) % 256;
  return out;
}

/** El base64 de los bytes CRUDOS: lo que se vería si el sitio saltara el helper. */
function rawBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1024) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 1024));
  }
  return btoa(bin);
}

const bytes = referenceBytes();
const rawOfFile = rawBase64(bytes);

function makeReferenceFile(name: string): File {
  return new File([bytes], name, { type: 'image/png' });
}

/** El botón de generación de portada; dice "Regenerar" si ya hay opciones. */
function coverGenerateButton(): HTMLElement {
  return screen.getAllByRole('button', { name: /Generar portada|Regenerar/i })[0];
}

/** Monta el editor y lo deja en el paso de ESCENAS (sin aprobarlas). */
async function renderAtScenesStep() {
  const view = render(
    <CuentacuentoEditor
      context={baseContext}
      initialStory={makeScenesPendingStory('story-pfe3')}
      onStoryCreated={vi.fn()}
    />,
  );
  await screen.findByRole('button', { name: /Aprobar escenas/i }, { timeout: 5000 });
  return view;
}

/** Monta el editor y avanza hasta el paso de PORTADA (que también trae "Fin"). */
async function renderAtCoverStep() {
  const view = render(
    <CuentacuentoEditor
      context={baseContext}
      initialStory={makeScenesPendingStory('story-pfe3')}
      onStoryCreated={vi.fn()}
    />,
  );
  const approveScenes = await screen.findByRole('button', { name: /Aprobar escenas/i }, { timeout: 5000 });
  await act(async () => {
    fireEvent.click(approveScenes);
    await yields(40);
  });
  await waitFor(() => expect(coverGenerateButton()).toBeTruthy(), { timeout: 5000 });
  return view;
}

/**
 * Entrega `file` a la zona de subida visible ejecutando el `onchange` REAL que
 * el editor acaba de instalar en su input imperativo. Exige que haya UNA sola
 * zona abierta, para no soltar el archivo en el sitio equivocado.
 */
async function dropOnVisibleZone(file: File) {
  const zones = screen.getAllByText('Subir', { exact: true });
  expect(zones, 'debe haber exactamente una zona de subida abierta').toHaveLength(1);
  await act(async () => {
    fireEvent.click(zones[0]);
    await yields(2);
  });
  const input = clickedInputs[clickedInputs.length - 1];
  expect(input, 'el editor debió crear y disparar un <input type=file>').toBeTruthy();
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => {
    await input.onchange?.({ target: input } as unknown as Event);
    await yields(20);
  });
}

/**
 * La aserción que hace discriminante al test, por sitio:
 *   (a) el reductor recibió EL File que soltó el usuario, exactamente una vez;
 *   (b) lo que quedó en el estado (y por lo tanto en el preview) es lo que el
 *       reductor devolvió — no los bytes del archivo, no una constante.
 */
async function expectWiredThroughDownscaler(file: File, previewAlt: string) {
  expect(readReferenceMock).toHaveBeenCalledTimes(1);
  expect(readReferenceMock.mock.calls[0][0]).toBe(file);

  const img = await screen.findByAltText(previewAlt, {}, { timeout: 5000 });
  const src = img.getAttribute('src') ?? '';
  expect(src).toBe(`data:image/png;base64,${sentinelFor(file)}`);
  // Y explícitamente: los bytes crudos del archivo NO llegaron al estado.
  expect(src).not.toContain(rawOfFile.slice(0, 32));
}

describe('A2 — cada sitio de subida pasa por el reductor', () => {
  it('A2a — referencia de ESCENA: el File va al reductor y su salida queda en el estado', async () => {
    await renderAtScenesStep();

    // El panel de referencias de la escena vive detrás de "Ver prompt".
    const verPrompt = screen.getAllByRole('button', { name: /Ver prompt/i })[0];
    await act(async () => {
      fireEvent.click(verPrompt);
      await yields(5);
    });

    const file = makeReferenceFile('referencia-escena.png');
    await dropOnVisibleZone(file);

    expect(alertSpy).not.toHaveBeenCalled();
    await expectWiredThroughDownscaler(file, 'Referencia de escena');
  }, 30000);

  it('A2b — referencia de PORTADA: el File va al reductor y su salida queda en el estado', async () => {
    await renderAtCoverStep();

    // La zona de subida vive en el panel expandible "Editar prompt" de Portada.
    const abrirPortada = screen.getAllByRole('button', { name: /Editar prompt/i })[0];
    await act(async () => {
      fireEvent.click(abrirPortada);
      await yields(5);
    });

    const file = makeReferenceFile('referencia-portada.png');
    await dropOnVisibleZone(file);

    expect(alertSpy).not.toHaveBeenCalled();
    await expectWiredThroughDownscaler(file, 'Referencia de portada');
  }, 30000);

  it('A2c — referencia de FIN: el File va al reductor y su salida queda en el estado', async () => {
    await renderAtCoverStep();

    // Mismo paso que Portada; el segundo "Editar prompt" es el de "Fin".
    const abrirFin = screen.getAllByRole('button', { name: /Editar prompt/i })[1];
    expect(abrirFin, 'el paso de portada debe traer también el bloque "Fin"').toBeTruthy();
    await act(async () => {
      fireEvent.click(abrirFin);
      await yields(5);
    });

    const file = makeReferenceFile('referencia-fin.png');
    await dropOnVisibleZone(file);

    expect(alertSpy).not.toHaveBeenCalled();
    await expectWiredThroughDownscaler(file, 'Referencia de fin');
  }, 30000);
});
