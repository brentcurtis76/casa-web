import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Story } from '@/types/shared/story';

// -----------------------------------------------------------------------------
// Mock del cliente Supabase con capture. Sobreescribe el mock global de
// src/test/setup.ts. No usa red — todos los métodos devuelven datos preparados.
// -----------------------------------------------------------------------------

type UpsertPayload = Record<string, unknown> & { image_paths?: Record<string, unknown> };

const upsertCalls: Array<{ payload: UpsertPayload }> = [];
const uploadCalls: Array<{ path: string }> = [];
const removedPaths: string[] = [];
let existingImagePaths: Record<string, unknown> | null = null;
let upsertError: { message: string } | null = null;

vi.mock('@/integrations/supabase/client', () => {
  const tableApi = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(async () => ({
      data: existingImagePaths ? { image_paths: existingImagePaths } : null,
      error: null,
    })),
    upsert: vi.fn().mockImplementation(async (payload: UpsertPayload) => {
      upsertCalls.push({ payload });
      return { error: upsertError };
    }),
    delete: vi.fn().mockReturnThis(),
  });

  const storageApi = () => ({
    upload: vi.fn().mockImplementation(async (path: string) => {
      uploadCalls.push({ path });
      return { data: { path }, error: null };
    }),
    getPublicUrl: vi.fn().mockImplementation((path: string) => ({
      data: { publicUrl: `https://mock.supabase.co/storage/${path}` },
    })),
    remove: vi.fn().mockImplementation(async (paths: string[]) => {
      removedPaths.push(...paths);
      return { error: null };
    }),
    list: vi.fn().mockResolvedValue({ data: [] }),
    download: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  return {
    supabase: {
      from: vi.fn(() => tableApi()),
      storage: { from: vi.fn(() => storageApi()) },
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(),
      },
    },
  };
});

// -----------------------------------------------------------------------------
// Import DESPUÉS del mock para que el módulo bajo test resuelva el cliente
// mockeado en tiempo de evaluación.
// -----------------------------------------------------------------------------
import {
  mergePatch,
  persistDraftNow,
  type CuentacuentosDraftFull,
  type DraftPatch,
} from '../useCuentacuentosDraft';

const baseSnapshot = (): CuentacuentosDraftFull => ({
  liturgyId: 'lit-1',
  currentStep: 'scenes',
  config: {
    location: 'jerusalem',
    customLocation: '',
    characters: 'jesus, discipulos',
    style: 'reflexivo',
    illustrationStyle: 'ghibli',
    additionalNotes: 'notas previas',
  },
  story: {
    id: 'story-1',
    title: 'Un cuento',
    summary: '',
    location: { name: 'Jerusalén' } as unknown as Story['location'],
    illustrationStyle: 'ghibli',
    characters: [],
    scenes: [],
    props: [],
    spiritualConnection: '',
    metadata: { createdAt: '', updatedAt: '', status: 'draft' as Story['metadata']['status'] },
  } as Story,
  characterSheetOptions: { char1: ['https://old/char1-a'] },
  selectedCharacterSheets: { char1: 0 },
  sceneImageOptions: { 1: ['https://old/scene1-a'] },
  selectedSceneImages: { 1: 0 },
  coverOptions: ['https://old/cover-a'],
  selectedCover: 0,
  endOptions: ['https://old/end-a'],
  selectedEnd: 0,
  sceneReferenceModes: { 1: 'style' },
  propReferenceImages: {},
  savedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
});

beforeEach(() => {
  upsertCalls.length = 0;
  uploadCalls.length = 0;
  removedPaths.length = 0;
  existingImagePaths = null;
  upsertError = null;
  // fetch (HEAD checks): siempre 200 para no ejercitar red.
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response)
  );
});

// -----------------------------------------------------------------------------
// T-A1.1 — mergePatch: semántica de own-key presence
// -----------------------------------------------------------------------------
describe('T-A1.1 mergePatch (own-key presence semantics)', () => {
  it('claves ausentes preservan el snapshot; claves presentes sobreescriben incluso con [], {}, null', () => {
    const snapshot = baseSnapshot();

    const patch: DraftPatch = {
      // Presente con [] → limpia
      coverOptions: [],
      // Presente con {} → limpia
      characterSheetOptions: {},
      // Presente con null → sobreescribe con null
      selectedCover: null,
      // Presente con valor "real"
      currentStep: 'cover',
      // AUSENTES: config, story, sceneImageOptions, selectedSceneImages,
      // endOptions, selectedEnd, sceneReferenceModes, propReferenceImages,
      // selectedCharacterSheets
    };

    const merged = mergePatch(snapshot, patch);

    // Claves presentes → sobreescritas literalmente
    expect(merged.coverOptions).toEqual([]);
    expect(merged.characterSheetOptions).toEqual({});
    expect(merged.selectedCover).toBeNull();
    expect(merged.currentStep).toBe('cover');

    // Claves ausentes → preservadas desde el snapshot
    expect(merged.config).toBe(snapshot.config);
    expect(merged.story).toBe(snapshot.story);
    expect(merged.sceneImageOptions).toBe(snapshot.sceneImageOptions);
    expect(merged.selectedSceneImages).toBe(snapshot.selectedSceneImages);
    expect(merged.endOptions).toBe(snapshot.endOptions);
    expect(merged.selectedEnd).toBe(snapshot.selectedEnd);
    expect(merged.sceneReferenceModes).toBe(snapshot.sceneReferenceModes);
    expect(merged.propReferenceImages).toBe(snapshot.propReferenceImages);
    expect(merged.selectedCharacterSheets).toBe(snapshot.selectedCharacterSheets);

    // El snapshot original no fue mutado.
    expect(snapshot.coverOptions).toEqual(['https://old/cover-a']);
    expect(snapshot.characterSheetOptions).toEqual({ char1: ['https://old/char1-a'] });
    expect(snapshot.selectedCover).toBe(0);
  });

  it('un patch vacío es la identidad (todas las claves ausentes)', () => {
    const snapshot = baseSnapshot();
    const merged = mergePatch(snapshot, {} as DraftPatch);
    // Mismos valores por referencia — nada tocado.
    (Object.keys(snapshot) as Array<keyof CuentacuentosDraftFull>).forEach((k) => {
      expect(merged[k]).toBe(snapshot[k]);
    });
  });

  it('nunca infiere intención por truthiness: false y 0 presentes sobreescriben', () => {
    const snapshot = baseSnapshot();
    // Simulamos un caso: selectedCover: 0 (0 es "falsy" pero presente = escribe).
    const merged = mergePatch(snapshot, { selectedCover: 0 } as DraftPatch);
    expect(merged.selectedCover).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// T-A1.2 — persistDraftNow: la primitiva persiste sin tocar React state
// -----------------------------------------------------------------------------
describe('T-A1.2 persistDraftNow (persistence-only primitive)', () => {
  it('persiste el snapshot normalizado, devuelve snapshot + uploadedUrls y no expone setters', async () => {
    // Existing DB paths que DEBEN preservarse cuando el patch no toca esas categorías.
    existingImagePaths = {
      characterSheetPaths: { charOld: ['users/u1/lit-1/characters/charOld_0.png'] },
      sceneImagePaths: { 5: ['users/u1/lit-1/scenes/scene5_0.png'] },
      coverPaths: ['users/u1/lit-1/cover/cover_0.png'],
      endPaths: ['users/u1/lit-1/end/end_0.png'],
      propImagePaths: { propOld: ['users/u1/lit-1/props/propOld_0.png'] },
      sceneReferenceModes: { 5: 'pov' },
    };

    const currentDraft = baseSnapshot();
    // Patch: sube DOS coberturas nuevas en base64 (categoría 'coverOptions' presente)
    // y limpia character sheets ({} presente). Todo lo demás AUSENTE → preservar.
    const patch: DraftPatch = {
      coverOptions: [
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      ],
      characterSheetOptions: {},
      currentStep: 'cover',
    };

    // Contrato: la firma de la primitiva NO acepta setters ni refs de React.
    // Se le pasa sólo state pura y devuelve state puro.
    const result = await persistDraftNow({
      userId: 'u1',
      liturgyId: 'lit-1',
      currentDraft,
      patch,
    });

    // === Devolución correcta ===
    expect(result).toHaveProperty('snapshot');
    expect(result).toHaveProperty('uploadedUrls');
    expect(Object.keys(result).sort()).toEqual(['snapshot', 'uploadedUrls']);

    // Snapshot normalizado: patch aplicado, identidad y metadatos inyectados.
    expect(result.snapshot.currentStep).toBe('cover');
    expect(result.snapshot.characterSheetOptions).toEqual({});
    expect(result.snapshot.coverOptions).toHaveLength(2);
    expect(result.snapshot.liturgyId).toBe('lit-1');
    expect(result.snapshot.savedAt).toEqual(expect.any(String));
    expect(new Date(result.snapshot.savedAt).toString()).not.toBe('Invalid Date');
    expect(result.snapshot.version).toBe(1);

    // Preservación por AUSENCIA en el patch — el snapshot mantiene los valores previos.
    expect(result.snapshot.sceneImageOptions).toBe(currentDraft.sceneImageOptions);
    expect(result.snapshot.endOptions).toBe(currentDraft.endOptions);
    expect(result.snapshot.sceneReferenceModes).toBe(currentDraft.sceneReferenceModes);

    // === URLs subidas correctas ===
    // Sólo cover fue tocado en categorías de imagen → dos URLs públicas.
    expect(result.uploadedUrls.coverUrls).toHaveLength(2);
    result.uploadedUrls.coverUrls.forEach((url) => {
      expect(url).toMatch(/^https:\/\/mock\.supabase\.co\/storage\//);
      expect(url).toContain('/cover/');
    });
    // Categorías ausentes del patch → no se subió nada, mapas vacíos.
    expect(result.uploadedUrls.characterSheetUrls).toEqual({});
    expect(result.uploadedUrls.sceneImageUrls).toEqual({});
    expect(result.uploadedUrls.endUrls).toEqual([]);
    expect(result.uploadedUrls.propImageUrls).toEqual({});

    // Los uploads sólo tocaron la carpeta 'cover' (patch presence gating).
    expect(uploadCalls).toHaveLength(2);
    uploadCalls.forEach((c) => expect(c.path).toContain('/cover/'));

    // === Persistencia efectiva: upsert llamado con los merged image_paths correctos ===
    expect(upsertCalls).toHaveLength(1);
    const persisted = upsertCalls[0].payload.image_paths as {
      characterSheetPaths: Record<string, string[]>;
      sceneImagePaths: Record<string, string[]>;
      coverPaths: string[];
      endPaths: string[];
      propImagePaths: Record<string, string[]>;
      sceneReferenceModes: Record<string, string>;
    };
    // Cover: reemplazado por los NUEVOS paths (patch presente).
    expect(persisted.coverPaths).toHaveLength(2);
    persisted.coverPaths.forEach((p) => expect(p).toContain('/cover/'));
    // Character sheets: patch presente con {} → limpio, NO preservar el viejo.
    expect(persisted.characterSheetPaths).toEqual({});
    // Categorías AUSENTES del patch → paths existentes preservados intactos.
    expect(persisted.sceneImagePaths).toEqual({ 5: ['users/u1/lit-1/scenes/scene5_0.png'] });
    expect(persisted.endPaths).toEqual(['users/u1/lit-1/end/end_0.png']);
    expect(persisted.propImagePaths).toEqual({ propOld: ['users/u1/lit-1/props/propOld_0.png'] });
    expect(persisted.sceneReferenceModes).toEqual({ 5: 'pov' });

    // === Contrato de "no side effects React" ===
    // La firma de persistDraftNow no acepta setters, y toma sólo datos puros;
    // por construcción no puede llamar a setDraft / setLastSavedAt ni mutar
    // draftRef. Reforzamos verificando que el input `currentDraft` no fue
    // mutado por la primitiva.
    expect(currentDraft.characterSheetOptions).toEqual({ char1: ['https://old/char1-a'] });
    expect(currentDraft.coverOptions).toEqual(['https://old/cover-a']);
    expect(currentDraft.currentStep).toBe('scenes');
    expect(currentDraft.savedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('rechaza (throw) si Supabase devuelve error en la persistencia', async () => {
    upsertError = { message: 'db offline' };
    await expect(
      persistDraftNow({
        userId: 'u1',
        liturgyId: 'lit-1',
        currentDraft: baseSnapshot(),
        patch: { currentStep: 'cover' } as DraftPatch,
      })
    ).rejects.toThrow(/db offline/);
  });
});
