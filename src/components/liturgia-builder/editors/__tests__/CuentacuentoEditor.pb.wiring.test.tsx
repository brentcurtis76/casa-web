/**
 * PB / G7 — T-B.8: CABLEADO DE PRODUCCIÓN de los cinco caminos reales.
 *
 * Esta suite es el bar no negociable de G7. Renderiza el `CuentacuentoEditor`
 * de PRODUCCIÓN, con el `useCuentacuentosDraft` de PRODUCCIÓN y la primitiva
 * inmutable de PRODUCCIÓN. Lo ÚNICO mockeado son bordes externos:
 *
 *   - cliente Supabase (auth / tablas / storage),
 *   - invocación de funciones pagas,
 *   - `fetch` (el HEAD de verificación de existencia),
 *   - el input de archivo del navegador (se dispara un `change` real con un
 *     `File` real; el `FileReader` que lo decodifica es el de jsdom).
 *
 * G7 declara explícitamente que NO cuentan: probar el helper solo, mockear el
 * hook, mockear el helper y verificar que "fue llamado", aserciones sobre el
 * texto fuente o los imports, llamar callbacks extraídos, ni renderizar un
 * wrapper de test. Nada de eso ocurre acá.
 *
 * Cinco caminos INDEPENDIENTES, cada uno con su PROPIO fixture de bytes, de
 * modo que la llamada de un sitio no puede satisfacer la aserción de otro:
 *
 *   1. control de guardado de PERSONAJE   → PNG_A  (hash A)
 *   2. control de guardado de ESCENA      → PNG_B  (hash B)
 *   3. control de guardado de PORTADA     → PNG_C  (hash C)
 *   4. control de guardado de FIN         → PNG_D  (hash D)
 *   5. acción real del componente que hace que EL HOOK persista una opción
 *      inline (subida manual de foto de un lugar/objeto → `applyPropsUpdate`
 *      → `enqueueDraftWrite` → swap de URL al estado REAL del editor) → WEBP
 *
 * Los hashes esperados se calculan con `node:crypto`, NO con la primitiva de
 * producción: si la aserción usara `sha256Hex32` sería circular.
 *
 * Prueba D7 por sitio (ver el reporte): restaurar UN sitio de producción a su
 * vieja llamada inline posicional con `upsert:true` deja el helper y esta suite
 * intactos y DEBE hacer fallar su caso — cinco mutaciones, cinco fallos.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent, cleanup } from '@testing-library/react';
import { createHash } from 'node:crypto';
import type { Story } from '@/types/shared/story';
import type { LiturgyContext } from '@/types/shared/liturgy';

import {
  PNG_A_B64,
  PNG_B_B64,
  PNG_C_B64,
  PNG_D_B64,
  WEBP_B64,
  EXISTING_DRAFTS_URL,
} from '@/lib/cuentacuentos/__tests__/pbImageFixtures';

vi.mock('@/integrations/supabase/client', async () => {
  const { makeSupabaseMock } = await import('@/lib/cuentacuentos/__tests__/pbBoundary');
  return { supabase: makeSupabaseMock() };
});
// PB/G7 — [B2]: acá había un `vi.mock('@/hooks/use-toast', …)`. G7 permite
// mockear SÓLO bordes externos (Supabase auth/tabla/storage, invocación de
// funciones pagas, timers y el input de archivo del navegador). `use-toast` es
// un hook de React de PRODUCCIÓN, interno, y NO está en esa lista: mockearlo
// bajaba la barra de integración de T-B.8. No necesita provider —es un store
// con reducer a nivel de módulo (`src/hooks/use-toast.ts`)— así que la suite
// corre el hook real.

import {
  ctl,
  uploads,
  draftUploads,
  resetBoundary,
  type UploadCall,
} from '@/lib/cuentacuentos/__tests__/pbBoundary';

// Producción — importada DESPUÉS de los mocks de borde.
import CuentacuentoEditor from '../CuentacuentoEditor';

// ---------------------------------------------------------------------------
// Identidad esperada, calculada de forma INDEPENDIENTE de producción
// ---------------------------------------------------------------------------

const USER_ID = 'user-pb';
const LITURGY_ID = 'lit-pb';
const DRAFTS_BUCKET = 'cuentacuentos-drafts';
const PUBLIC_PREFIX = `https://mock.supabase.co/storage/v1/object/public/${DRAFTS_BUCKET}/`;

/** SHA-256 de los bytes DECODIFICADOS, 32 hex en minúscula — sin tocar producción. */
function hash32(base64: string): string {
  return createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex').slice(0, 32);
}

interface SitePlan {
  /** Nombre legible del camino. */
  name: string;
  /** Bytes plantados en ESTE sitio y en ningún otro. */
  bytes: string;
  /** Segmento de categoría dentro del path. */
  category: string;
  /** Clave semántica del slot. */
  key: string;
  extension: 'png' | 'jpg' | 'webp';
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  /** El path POSICIONAL que este sitio escribía en 185c370. */
  legacyPath: string;
}

const SITES = {
  character: {
    name: 'control de guardado de personaje',
    bytes: PNG_A_B64,
    category: 'characters',
    key: 'char1',
    extension: 'png',
    contentType: 'image/png',
    legacyPath: `${USER_ID}/${LITURGY_ID}/characters/char1_selected.png`,
  },
  scene: {
    name: 'control de guardado de escena',
    bytes: PNG_B_B64,
    category: 'scenes',
    key: 'scene1',
    extension: 'png',
    contentType: 'image/png',
    legacyPath: `${USER_ID}/${LITURGY_ID}/scenes/scene1_selected.png`,
  },
  cover: {
    name: 'control de guardado de portada',
    bytes: PNG_C_B64,
    category: 'cover',
    key: 'cover',
    extension: 'png',
    contentType: 'image/png',
    legacyPath: `${USER_ID}/${LITURGY_ID}/cover/cover_selected.png`,
  },
  end: {
    name: 'control de guardado de fin',
    bytes: PNG_D_B64,
    category: 'end',
    key: 'end',
    extension: 'png',
    contentType: 'image/png',
    legacyPath: `${USER_ID}/${LITURGY_ID}/end/end_selected.png`,
  },
  hookProp: {
    name: 'acción del componente que persiste una opción inline vía el hook',
    bytes: WEBP_B64,
    category: 'props',
    key: 'prop1',
    extension: 'webp',
    contentType: 'image/webp',
    legacyPath: `${USER_ID}/${LITURGY_ID}/props/prop1_0.png`,
  },
} satisfies Record<string, SitePlan>;

type SiteId = keyof typeof SITES;

/** Path inmutable esperado: segmento 1 = userId (compatible con la RLS own-folder). */
function expectedPath(site: SitePlan): string {
  return `${USER_ID}/${LITURGY_ID}/${site.category}/${site.key}_${hash32(site.bytes)}.${site.extension}`;
}

/**
 * Aserción común al borde de Storage para un sitio.
 *
 * Exige LA llamada de este sitio: bucket exacto, path por contenido exacto
 * (con `userId` como segmento 1), contentType olfateado, `upsert:false`, y
 * ausencia del path posicional viejo. Los bytes son distintos por sitio, así
 * que ninguna otra llamada puede satisfacer esta aserción.
 */
function assertImmutableBoundary(site: SitePlan, calls: UploadCall[]): UploadCall {
  const want = expectedPath(site);
  const match = calls.find((c) => c.path === want);
  expect(
    match,
    `no hubo subida al path direccionado por contenido esperado.\n` +
      `  esperado: ${DRAFTS_BUCKET}/${want}\n` +
      `  emitidas: ${JSON.stringify(calls.map((c) => `${c.bucket}/${c.path} upsert=${c.upsert}`), null, 2)}`
  ).toBeDefined();
  const call = match as UploadCall;

  expect(call.bucket).toBe(DRAFTS_BUCKET);
  expect(call.contentType).toBe(site.contentType);
  expect(call.upsert).toBe(false);
  // RLS `cuentacuentos-drafts`: el primer segmento del path debe ser el uid.
  expect(call.path.split('/')[0]).toBe(USER_ID);
  // El nombre lleva el hash de 32 hex minúsculas y NADA más entre `key_` y la
  // extensión: `_selected` y `_<índice>` quedaron retirados.
  expect(call.path).toMatch(
    new RegExp(`/${site.key}_[0-9a-f]{32}\\.${site.extension}$`)
  );

  // La forma posicional vieja no puede aparecer en NINGUNA subida del caso.
  expect(calls.map((c) => c.path)).not.toContain(site.legacyPath);
  expect(calls.filter((c) => c.path.includes('_selected.'))).toEqual([]);
  // Toda subida del caso —no sólo la de este sitio— es inmutable.
  expect(calls.filter((c) => c.upsert !== false)).toEqual([]);

  return call;
}

/** Las `src` de todas las imágenes actualmente renderizadas por el editor real. */
function renderedImageSrcs(): string[] {
  return screen
    .queryAllByRole('img')
    .map((el) => el.getAttribute('src') ?? '')
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Fixtures de dominio
// ---------------------------------------------------------------------------

const baseContext: LiturgyContext = {
  id: LITURGY_ID,
  date: new Date('2026-05-10'),
  title: 'Liturgia PB',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

function storyWith(status: string, overrides: Partial<Story> = {}): Story {
  return {
    id: 'story-pb',
    title: 'Cuento PB',
    summary: 'Resumen',
    location: { name: 'Jerusalén' } as unknown as Story['location'],
    illustrationStyle: 'ghibli',
    characters: [
      {
        id: 'char1',
        name: 'María',
        role: 'protagonist',
        description: 'Niña curiosa',
        visualDescription: 'vestido azul',
      } as unknown as Story['characters'][number],
    ],
    scenes: [
      { number: 1, text: 'Escena 1', visualDescription: 'plaza' } as unknown as Story['scenes'][number],
    ],
    props: [],
    spiritualConnection: 'Esperanza',
    metadata: { createdAt: '', updatedAt: '', status } as Story['metadata'],
    ...overrides,
  } as Story;
}

/**
 * `initialStory` por sitio. El paso se alcanza por caminos REALES:
 *  - `characters` / `scenes` los deriva `getInitialStep()` de `metadata.status`;
 *  - `cover` sólo se alcanza aprobando escenas, y renderiza AMBOS selectores.
 * Las opciones se siembran del efecto que copia `characterSheetUrl` /
 * `selectedImageUrl` / `coverImageUrl` / `endImageUrl` a las opciones del
 * editor: por eso el valor inline llega al callback sin mockear nada del hook.
 */
function initialStoryFor(site: SiteId): Story {
  const bytes = SITES[site].bytes;
  if (site === 'character') {
    return storyWith('characters-pending', {
      characters: [
        {
          id: 'char1',
          name: 'María',
          role: 'protagonist',
          description: 'd',
          visualDescription: 'v',
          characterSheetUrl: bytes,
        } as unknown as Story['characters'][number],
      ],
    });
  }
  if (site === 'scene') {
    return storyWith('characters-approved', {
      scenes: [
        {
          number: 1,
          text: 'Escena 1',
          visualDescription: 'plaza',
          selectedImageUrl: bytes,
        } as unknown as Story['scenes'][number],
      ],
    });
  }
  // cover / end — se parte de `scenes-pending` y se aprueban las escenas.
  return storyWith('scenes-pending', {
    scenes: [
      {
        number: 1,
        text: 'Escena 1',
        visualDescription: 'plaza',
        selectedImageUrl: EXISTING_DRAFTS_URL,
      } as unknown as Story['scenes'][number],
    ],
    coverImageUrl: site === 'cover' ? bytes : EXISTING_DRAFTS_URL,
    endImageUrl: site === 'end' ? bytes : EXISTING_DRAFTS_URL,
  });
}

const SUCCESS_MESSAGE_RE = /(Imagen guardada exitosamente|Portada guardada exitosamente)/i;

async function yields(n: number) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

/**
 * Monta el editor de producción, alcanza el paso del sitio por interacción
 * real, y hace click en SU control de guardado. Devuelve las subidas emitidas
 * por ese click (las de la transición de aprobación se descartan antes).
 */
async function driveSaveControl(site: Exclude<SiteId, 'hookProp'>): Promise<UploadCall[]> {
  render(
    <CuentacuentoEditor
      context={baseContext}
      initialStory={initialStoryFor(site)}
      onStoryCreated={vi.fn()}
    />
  );

  if (site === 'cover' || site === 'end') {
    const approve = await waitFor(
      () => screen.getByRole('button', { name: /Aprobar escenas/i }),
      { timeout: 10000 }
    );
    await act(async () => {
      fireEvent.click(approve);
    });
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Aprobar escenas/i })).toBeNull(),
      { timeout: 10000 }
    );
  }

  const saveButtons = await waitFor(
    () => {
      const found = screen.queryAllByRole('button', { name: /Guardar selección/i });
      if (found.length === 0) throw new Error('todavía no hay control de guardado');
      return found;
    },
    { timeout: 10000 }
  );

  // En el paso `cover` hay DOS controles: portada primero, fin después.
  const index = site === 'end' ? saveButtons.length - 1 : 0;

  // Descarta lo emitido por la transición de aprobación: lo que se mide es
  // EXACTAMENTE lo que emite este click.
  uploads.length = 0;

  await act(async () => {
    fireEvent.click(saveButtons[index]);
  });
  await waitFor(() => expect(screen.queryByText(SUCCESS_MESSAGE_RE)).not.toBeNull(), {
    timeout: 10000,
  });

  return [...draftUploads()];
}

// ---------------------------------------------------------------------------

beforeEach(() => {
  resetBoundary();
  ctl.draftRow = null; // sin prompt "Borrador encontrado" tapando el paso
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response));
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PB G7/T-B.8 — camino 1: control de guardado de personaje', () => {
  it('sube por la primitiva inmutable y propaga la URL pública al editor real', async () => {
    const site = SITES.character;
    const calls = await driveSaveControl('character');

    const call = assertImmutableBoundary(site, calls);
    // Este click emite UNA sola subida: la de su propia imagen.
    expect(calls).toHaveLength(1);

    // La URL pública llegó al estado REAL del editor: el selector colapsó a la
    // única opción guardada y la renderiza desde Storage, no desde base64.
    const publicUrl = `${PUBLIC_PREFIX}${call.path}`;
    await waitFor(() =>
      expect(renderedImageSrcs().some((s) => s.startsWith(publicUrl))).toBe(true)
    );
    expect(renderedImageSrcs().some((s) => s.includes(site.bytes.slice(0, 40)))).toBe(false);
  }, 60_000);
});

describe('PB G7/T-B.8 — camino 2: control de guardado de escena', () => {
  it('sube por la primitiva inmutable y propaga la URL pública al editor real', async () => {
    const site = SITES.scene;
    const calls = await driveSaveControl('scene');

    const call = assertImmutableBoundary(site, calls);
    expect(calls).toHaveLength(1);

    const publicUrl = `${PUBLIC_PREFIX}${call.path}`;
    await waitFor(() =>
      expect(renderedImageSrcs().some((s) => s.startsWith(publicUrl))).toBe(true)
    );
    expect(renderedImageSrcs().some((s) => s.includes(site.bytes.slice(0, 40)))).toBe(false);
  }, 60_000);
});

describe('PB G7/T-B.8 — camino 3: control de guardado de portada', () => {
  it('sube por la primitiva inmutable y propaga la URL pública al editor real', async () => {
    const site = SITES.cover;
    const calls = await driveSaveControl('cover');

    const call = assertImmutableBoundary(site, calls);
    expect(calls).toHaveLength(1);
    // El fixture de FIN de este caso es una URL existente: no se re-sube, y su
    // hash no puede aparecer. Blindaje contra "un sitio satisface a otro".
    expect(calls.map((c) => c.path)).not.toContain(expectedPath(SITES.end));

    const publicUrl = `${PUBLIC_PREFIX}${call.path}`;
    await waitFor(() =>
      expect(renderedImageSrcs().some((s) => s.startsWith(publicUrl))).toBe(true)
    );
  }, 60_000);
});

describe('PB G7/T-B.8 — camino 4: control de guardado de fin', () => {
  it('sube por la primitiva inmutable y propaga la URL pública al editor real', async () => {
    const site = SITES.end;
    const calls = await driveSaveControl('end');

    const call = assertImmutableBoundary(site, calls);
    expect(calls).toHaveLength(1);
    expect(calls.map((c) => c.path)).not.toContain(expectedPath(SITES.cover));

    const publicUrl = `${PUBLIC_PREFIX}${call.path}`;
    await waitFor(() =>
      expect(renderedImageSrcs().some((s) => s.startsWith(publicUrl))).toBe(true)
    );
  }, 60_000);
});

describe('PB G7/T-B.8 — camino 5: el hook persiste una opción inline por una acción real', () => {
  it('subir una foto de lugar/objeto la persiste por la primitiva y la URL vuelve al editor', async () => {
    const site = SITES.hookProp;

    // Un prop SIN referencias: la subida manual es la que lo resuelve.
    const story = storyWith('characters-pending', {
      characters: [
        {
          id: 'char1',
          name: 'María',
          role: 'protagonist',
          description: 'd',
          visualDescription: 'v',
          characterSheetUrl: EXISTING_DRAFTS_URL,
        } as unknown as Story['characters'][number],
      ],
      props: [
        {
          id: 'prop1',
          kind: 'place',
          name: 'Pozo',
          narrativeRole: 'lugar de encuentro',
          visualDescription: 'pozo de piedra',
          referenceImages: [],
          role: 'secondary',
        },
      ] as unknown as Story['props'],
    });

    render(
      <CuentacuentoEditor context={baseContext} initialStory={story} onStoryCreated={vi.fn()} />
    );

    // El input de archivo del navegador es un borde externo: se dispara un
    // `change` real con un `File` real. `FileReader` (jsdom) hace el resto, y
    // de ahí en adelante todo es el editor y el hook de producción.
    const fileInput = await waitFor(
      () => {
        const inputs = document.querySelectorAll('input[type="file"]');
        if (inputs.length === 0) throw new Error('todavía no hay input de archivo');
        return inputs[inputs.length - 1] as HTMLInputElement;
      },
      { timeout: 10000 }
    );

    const bytes = Buffer.from(site.bytes, 'base64');
    const file = new File([bytes], 'pozo.webp', { type: 'image/webp' });

    uploads.length = 0;
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      // `FileReader` es asíncrono: hay que dejar correr su `onload`.
      await new Promise((r) => setTimeout(r, 50));
      await yields(30);
    });

    // La escritura pasa por la cola serializada del hook.
    const calls = await waitFor(
      () => {
        const found = draftUploads();
        if (found.length === 0) throw new Error('el hook todavía no subió nada');
        return [...found];
      },
      { timeout: 10000 }
    );

    const call = assertImmutableBoundary(site, calls);
    // El WebP demuestra además que el olfateo por magic bytes viaja por la ruta
    // del hook: en 185c370 este byte-stream se habría etiquetado `image/png`.
    expect(call.contentType).toBe('image/webp');
    expect(call.path.endsWith('.webp')).toBe(true);

    // `onCommit` del editor real hizo el swap: la referencia del prop ya es la
    // URL pública de Storage, no el base64 que subió el usuario.
    const publicUrl = `${PUBLIC_PREFIX}${call.path}`;
    await waitFor(
      () => {
        const refImg = screen.queryByAltText(/Pozo referencia 1/i);
        expect(refImg?.getAttribute('src')).toBe(publicUrl);
      },
      { timeout: 10000 }
    );
  }, 60_000);
});

describe('PB T-B.14 — inventario de inmutabilidad en los cuatro controles manuales', () => {
  it('ninguna subida de cuentacuentos usa `upsert:true` ni un nombre posicional', async () => {
    // Recorre los CUATRO controles manuales en una sola verificación de
    // inventario: si cualquiera volviera a `upsert:true`, esto falla en el
    // borde externo (no por inspección de código).
    //
    // [B2] — el título decía "los cinco caminos"; el recorrido es de cuatro.
    // El camino 5 (la ruta del hook) queda cubierto por su propio caso, cuya
    // `assertImmutableBoundary` exige `upsert:false` en TODAS las subidas de
    // ese caso. Por eso la mutación por sitio del hook deja este inventario en
    // verde: no es un sustituto del resultado por sitio, tal como lo anticipa
    // la revisión.
    for (const site of ['character', 'scene', 'cover', 'end'] as const) {
      cleanup();
      resetBoundary();
      ctl.draftRow = null;
      const calls = await driveSaveControl(site);
      expect(
        calls.filter((c) => c.upsert !== false),
        `${SITES[site].name}: subida con upsert distinto de false`
      ).toEqual([]);
      expect(
        calls.filter((c) => c.path.includes('_selected.')),
        `${SITES[site].name}: sobrevive un nombre posicional`
      ).toEqual([]);
    }
  }, 120_000);
});
