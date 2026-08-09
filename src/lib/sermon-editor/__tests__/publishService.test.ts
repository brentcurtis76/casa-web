/**
 * publishService — focused tests on the episode-number assignment and
 * unique-violation retry path. Mocks the supabase client surface that the
 * service actually touches (table query builder + storage upload).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface PgError {
  message: string;
  code?: string;
}

interface QueryResult<T = unknown> {
  data: T | null;
  error: PgError | null;
}

// What the builder saw. The original mock discarded `_payload` and `_cols`, so no
// assertion about *what* was sent could ever go red; the three declared mutations of
// E3a.12 need these.
interface Recorded {
  updatePayloads: Record<string, unknown>[];
  insertPayloads: Record<string, unknown>[];
  selectCols: string[];
}

// ── Query builder mock that supports the chains used by publishService ─────
function makeQueryBuilder(
  responses: {
    insert?: QueryResult;
    update?: QueryResult[]; // sequential responses for repeated update().eq().select().single()
    selectMaxEpisode?: QueryResult; // for .not(...).order(...).limit(...)
    selectById?: QueryResult; // for .select(...).eq('id', ...).single()
  },
  recorded?: Recorded,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    _kind: null as null | 'insert' | 'update' | 'select',
    _updateCallIndex: 0,
    insert(payload: unknown) {
      this._kind = 'insert';
      recorded?.insertPayloads.push(payload as Record<string, unknown>);
      return this;
    },
    update(payload: unknown) {
      this._kind = 'update';
      recorded?.updatePayloads.push(payload as Record<string, unknown>);
      return this;
    },
    select(cols?: string) {
      if (this._kind === null) this._kind = 'select';
      if (cols !== undefined) recorded?.selectCols.push(cols);
      return this;
    },
    eq(_col: string, _val: unknown) {
      return this;
    },
    not(_col: string, _op: string, _val: unknown) {
      return this;
    },
    order(_col: string, _opts?: unknown) {
      return this;
    },
    limit(_n: number) {
      // Resolves the max-episode-number lookup
      return Promise.resolve(
        responses.selectMaxEpisode ?? { data: [], error: null },
      );
    },
    single() {
      if (this._kind === 'insert') {
        return Promise.resolve(
          responses.insert ?? { data: null, error: { message: 'no insert stub' } },
        );
      }
      if (this._kind === 'update') {
        const updates = responses.update ?? [];
        const result = updates[this._updateCallIndex] ?? updates[updates.length - 1];
        this._updateCallIndex += 1;
        return Promise.resolve(
          result ?? { data: null, error: { message: 'no update stub' } },
        );
      }
      return Promise.resolve(
        responses.selectById ?? { data: null, error: null },
      );
    },
  };
  return builder;
}

const fromMock = vi.fn();
const storageUploadMock = vi.fn();
const storageGetPublicUrlMock = vi.fn();
const getUserMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
    },
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => storageUploadMock(...args),
        getPublicUrl: (...args: unknown[]) => storageGetPublicUrlMock(...args),
      }),
    },
  },
}));

import {
  publishEpisode,
  PublishError,
  CANONICAL_ORIGIN,
} from '@/lib/sermon-editor/publishService';

function makeRecorded(): Recorded {
  return { updatePayloads: [], insertPayloads: [], selectCols: [] };
}

beforeEach(() => {
  fromMock.mockReset();
  storageUploadMock.mockReset();
  storageGetPublicUrlMock.mockReset();
  getUserMock.mockReset();

  getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  storageUploadMock.mockResolvedValue({ data: { path: 'whatever' }, error: null });
  storageGetPublicUrlMock.mockImplementation((path: string) => ({
    data: { publicUrl: `https://cdn.example/${path}` },
  }));
});

function makeMetadata() {
  return {
    title: 'Reflexión: Mateo 5',
    description: 'Descripción.',
    speaker: 'Brent Curtis',
    episodeDate: '2026-06-08',
    liturgyId: null,
  };
}

describe('publishEpisode', () => {
  it('inserts a draft, uploads audio, and publishes with episode_number = max + 1', async () => {
    const stages: string[] = [];

    const builder = makeQueryBuilder({
      insert: {
        data: {
          id: 'ep-1',
          guid: 'guid-1',
          episode_number: null,
          title: 'Reflexión: Mateo 5',
          slug: null,
        },
        error: null,
      },
      selectMaxEpisode: { data: [{ episode_number: 7 }], error: null },
      update: [
        { data: { episode_number: 8, slug: 'reflexion-mateo-5' }, error: null },
      ],
    });
    fromMock.mockReturnValue(builder);

    const result = await publishEpisode({
      mp3Blob: new Blob(['x'.repeat(1024)], { type: 'audio/mpeg' }),
      coverBlob: null,
      durationSeconds: 1234.7,
      metadata: makeMetadata(),
      onStage: (s) => stages.push(s),
    });

    expect(result.episodeId).toBe('ep-1');
    expect(result.guid).toBe('guid-1');
    expect(result.episodeNumber).toBe(8);
    expect(result.audioUrl).toContain('episodes/ep-1/audio.mp3');
    expect(result.coverUrl).toBeNull();
    expect(stages).toEqual([
      'saving-draft',
      'uploading-audio',
      'publishing',
      'done',
    ]);

    // Audio upload was called with the right options
    expect(storageUploadMock).toHaveBeenCalledTimes(1);
    const [audioPath, , audioOpts] = storageUploadMock.mock.calls[0];
    expect(audioPath).toBe('episodes/ep-1/audio.mp3');
    expect(audioOpts).toMatchObject({
      contentType: 'audio/mpeg',
      upsert: true,
      cacheControl: '3600',
    });
  });

  it('retries once with a fresh max+1 on episode_number unique violation', async () => {
    const builder = makeQueryBuilder({
      insert: {
        data: {
          id: 'ep-2',
          guid: 'guid-2',
          episode_number: null,
          title: 'Reflexión: Mateo 5',
          slug: null,
        },
        error: null,
      },
      selectMaxEpisode: { data: [{ episode_number: 3 }], error: null },
      update: [
        { data: null, error: { message: 'duplicate key', code: '23505' } },
        { data: { episode_number: 4, slug: 'reflexion-mateo-5' }, error: null },
      ],
    });
    fromMock.mockReturnValue(builder);

    const result = await publishEpisode({
      mp3Blob: new Blob(['x'], { type: 'audio/mpeg' }),
      coverBlob: null,
      durationSeconds: 10,
      metadata: makeMetadata(),
    });

    expect(result.episodeNumber).toBe(4);
  });

  it('throws PublishError carrying the episodeId when audio upload fails', async () => {
    const builder = makeQueryBuilder({
      insert: {
        data: {
          id: 'ep-3',
          guid: 'guid-3',
          episode_number: null,
          title: 'Reflexión: Mateo 5',
          slug: null,
        },
        error: null,
      },
      selectMaxEpisode: { data: [], error: null },
    });
    fromMock.mockReturnValue(builder);
    storageUploadMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'network broke' },
    });

    await expect(
      publishEpisode({
        mp3Blob: new Blob(['x'], { type: 'audio/mpeg' }),
        coverBlob: null,
        durationSeconds: 10,
        metadata: makeMetadata(),
      }),
    ).rejects.toMatchObject({
      name: 'PublishError',
      stage: 'uploading-audio',
      episodeId: 'ep-3',
    });
  });

  it('reuses existingEpisodeId without inserting a new row', async () => {
    const builder = makeQueryBuilder({
      selectById: {
        data: {
          id: 'ep-99',
          guid: 'guid-99',
          episode_number: 12,
          title: 'Reflexión: Mateo 5',
          slug: 'ya-asignado',
        },
        error: null,
      },
      // selectMaxEpisode should NOT be needed because the row already has a number
      update: [{ data: { episode_number: 12, slug: 'ya-asignado' }, error: null }],
    });
    fromMock.mockReturnValue(builder);

    const result = await publishEpisode({
      mp3Blob: new Blob(['x'], { type: 'audio/mpeg' }),
      coverBlob: null,
      durationSeconds: 10,
      metadata: makeMetadata(),
      existingEpisodeId: 'ep-99',
    });

    expect(result.episodeId).toBe('ep-99');
    expect(result.episodeNumber).toBe(12);
  });
});

// ── E3a.11 / E3a.12 — el cableado del slug ────────────────────────────────────
describe('publishEpisode · slug', () => {
  it('E3a.11 — deriva la base del título PERSISTIDO, no de metadata.title', async () => {
    const recorded = makeRecorded();
    const builder = makeQueryBuilder(
      {
        selectById: {
          data: {
            id: 'ep-t',
            guid: 'guid-t',
            episode_number: 5,
            // A — lo que hay en la fila
            title: 'Título Persistido: el Señor',
            slug: null,
          },
          error: null,
        },
        update: [
          { data: { episode_number: 5, slug: 'titulo-persistido-el-senor' }, error: null },
        ],
      },
      recorded,
    );
    fromMock.mockReturnValue(builder);

    await publishEpisode({
      mp3Blob: new Blob(['x'], { type: 'audio/mpeg' }),
      coverBlob: null,
      durationSeconds: 10,
      // B — un metadata.title distinto, que el UPDATE de publicación no escribe
      metadata: { ...makeMetadata(), title: 'Otro Título Del Formulario' },
      existingEpisodeId: 'ep-t',
    });

    // El select tiene que traerse `title`: sin él no hay título persistido del que derivar.
    expect(recorded.selectCols[0]).toContain('title');
    expect(recorded.updatePayloads[0].slug).toBe('titulo-persistido-el-senor');
  });

  it('E3a.12 — el slug que vale es el que devuelve la base, no la preferencia', async () => {
    const recorded = makeRecorded();
    const builder = makeQueryBuilder(
      {
        selectById: {
          data: { id: 'ep-x', guid: 'guid-x', episode_number: 3, title: 'X', slug: null },
          error: null,
        },
        // El trigger resolvió `x-2` sobre la preferencia `x`.
        update: [{ data: { episode_number: 3, slug: 'x-2' }, error: null }],
      },
      recorded,
    );
    fromMock.mockReturnValue(builder);

    const result = await publishEpisode({
      mp3Blob: new Blob(['x'], { type: 'audio/mpeg' }),
      coverBlob: null,
      durationSeconds: 10,
      metadata: makeMetadata(),
      existingEpisodeId: 'ep-x',
    });

    expect(recorded.updatePayloads[0].slug).toBe('x'); // la preferencia que se envió
    expect(result.slug).toBe('x-2'); // lo que se devuelve es lo que dijo la base
    expect(result.canonicalUrl).toBe(`${CANONICAL_ORIGIN}/reflexiones/x-2`);
    expect(result.canonicalUrl.endsWith('/x-2')).toBe(true);
    // El UPDATE tiene que pedir `slug` de vuelta; si no, no hay nada que devolver.
    expect(recorded.selectCols.some((c) => c.includes('slug'))).toBe(true);
  });

  it('no vuelve a proponer slug cuando la fila ya tiene uno (D12)', async () => {
    const recorded = makeRecorded();
    const builder = makeQueryBuilder(
      {
        selectById: {
          data: {
            id: 'ep-y',
            guid: 'guid-y',
            episode_number: 9,
            title: 'Un título completamente distinto',
            slug: 'slug-viejo',
          },
          error: null,
        },
        update: [{ data: { episode_number: 9, slug: 'slug-viejo' }, error: null }],
      },
      recorded,
    );
    fromMock.mockReturnValue(builder);

    const result = await publishEpisode({
      mp3Blob: new Blob(['x'], { type: 'audio/mpeg' }),
      coverBlob: null,
      durationSeconds: 10,
      metadata: makeMetadata(),
      existingEpisodeId: 'ep-y',
    });

    // Escribir la columna con otro valor haría saltar el 23514 de inmutabilidad.
    expect('slug' in recorded.updatePayloads[0]).toBe(false);
    expect(result.slug).toBe('slug-viejo');
  });

  it('reintenta el UPDATE entero ante un 23505 de slug en una republicación', async () => {
    const recorded = makeRecorded();
    const builder = makeQueryBuilder(
      {
        selectById: {
          data: { id: 'ep-z', guid: 'guid-z', episode_number: 4, title: 'Carrera', slug: null },
          error: null,
        },
        update: [
          // Carrera de slug: dos triggers pasaron el NOT EXISTS, el índice único rechazó a uno.
          { data: null, error: { message: 'duplicate key value …idx_podcast_episodes_slug', code: '23505' } },
          { data: { episode_number: 4, slug: 'carrera-2' }, error: null },
        ],
      },
      recorded,
    );
    fromMock.mockReturnValue(builder);

    const result = await publishEpisode({
      mp3Blob: new Blob(['x'], { type: 'audio/mpeg' }),
      coverBlob: null,
      durationSeconds: 10,
      metadata: makeMetadata(),
      existingEpisodeId: 'ep-z',
    });

    expect(recorded.updatePayloads).toHaveLength(2);
    expect(result.slug).toBe('carrera-2');
    // El número no se recalcula cuando la fila ya lo tenía.
    expect(result.episodeNumber).toBe(4);
  });

  it('falla en vez de inventar una URL canónica si la base no devuelve slug', async () => {
    const builder = makeQueryBuilder({
      selectById: {
        data: { id: 'ep-w', guid: 'guid-w', episode_number: 1, title: 'W', slug: null },
        error: null,
      },
      update: [{ data: { episode_number: 1, slug: null }, error: null }],
    });
    fromMock.mockReturnValue(builder);

    await expect(
      publishEpisode({
        mp3Blob: new Blob(['x'], { type: 'audio/mpeg' }),
        coverBlob: null,
        durationSeconds: 10,
        metadata: makeMetadata(),
        existingEpisodeId: 'ep-w',
      }),
    ).rejects.toMatchObject({ name: 'PublishError', stage: 'publishing' });
  });
});

describe('PublishError', () => {
  it('exposes stage and episodeId for caller resume', () => {
    const err = new PublishError('boom', 'uploading-audio', 'ep-4');
    expect(err.stage).toBe('uploading-audio');
    expect(err.episodeId).toBe('ep-4');
    expect(err.message).toBe('boom');
  });
});
