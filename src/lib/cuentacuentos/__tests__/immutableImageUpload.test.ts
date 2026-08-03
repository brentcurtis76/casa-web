/**
 * PB — la primitiva inmutable (G2) y su clasificador de conflicto (G3).
 *
 * Cubre T-B.2 (idempotencia), T-B.3 (hash sobre bytes decodificados) y
 * T-B.4 (verdad de MIME por magic bytes), más el set de evidencia que G3 exige
 * para el 409.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const uploadCalls: Array<{
  bucket: string;
  path: string;
  contentType?: string;
  upsert?: boolean;
  blobType: string;
  blobSize: number;
}> = [];
let uploadResult: { error: unknown } = { error: null };

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: vi.fn((bucket: string) => ({
        upload: vi.fn(
          async (path: string, blob: Blob, opts?: { contentType?: string; upsert?: boolean }) => {
            uploadCalls.push({
              bucket,
              path,
              contentType: opts?.contentType,
              upsert: opts?.upsert,
              blobType: blob.type,
              blobSize: blob.size,
            });
            return uploadResult.error
              ? { data: null, error: uploadResult.error }
              : { data: { path }, error: null };
          }
        ),
        getPublicUrl: vi.fn((path: string) => ({
          data: { publicUrl: `https://mock.supabase.co/storage/v1/object/public/${bucket}/${path}` },
        })),
      })),
    },
  },
}));

import {
  uploadImmutableDraftImage,
  uploadImmutableFinalImage,
  ImmutableUploadError,
  isDuplicateConflict,
  sniffImageType,
  sha256Hex32,
  decodeBase64Strict,
  stripDataUrlPrefix,
  isHttpReference,
} from '../immutableImageUpload';
import {
  PNG_A_B64,
  PNG_B_B64,
  JPEG_B64,
  WEBP_B64,
  GIF_B64,
  INVALID_B64,
  PNG_A_DATA_URL,
  PNG_A_DATA_URL_LYING,
  EXISTING_DRAFTS_URL,
} from './pbImageFixtures';
import {
  DUPLICATE_CONFLICT_ERROR,
  DUPLICATE_LIKE_MESSAGE_BUT_NOT_409,
  OPAQUE_409,
  BUCKET_NOT_FOUND_ERROR,
} from './pbStorageErrors';

/**
 * Hashes calculados de forma INDEPENDIENTE con `hashlib.sha256` de Python
 * sobre los bytes decodificados de cada fixture. Sirven de referencia cruzada:
 * si la primitiva hashea otra cosa (el string base64, el prefijo, el Blob),
 * estos valores no coinciden.
 */
const H = {
  PNG_A: '49e1dad481e94dfab7c9573a9a81d56a',
  PNG_B: '194bdb273fa55018b8e0e248714246a1',
  JPEG: 'cb0501d6c1250017af030077e00e88b9',
  WEBP: 'bd25bde9fc4427cd6f3babcb8f888fe6',
};

const draftArgs = (data: string) => ({
  userId: 'user-pb',
  liturgyId: 'lit-pb',
  category: 'characters',
  key: 'char1',
  data,
});

beforeEach(() => {
  uploadCalls.length = 0;
  uploadResult = { error: null };
});

describe('SHA-256 en el runtime real (WebCrypto)', () => {
  it('crypto.subtle.digest existe y coincide con un cálculo independiente', async () => {
    expect(typeof globalThis.crypto?.subtle?.digest).toBe('function');
    expect(await sha256Hex32(decodeBase64Strict(PNG_A_B64))).toBe(H.PNG_A);
    expect(await sha256Hex32(decodeBase64Strict(JPEG_B64))).toBe(H.JPEG);
  });
});

describe('T-B.3 — el hash es sobre los BYTES DECODIFICADOS', () => {
  it('dos data URL con MIME declarado distinto pero mismos bytes ⇒ mismo path', async () => {
    const a = await uploadImmutableDraftImage(draftArgs(PNG_A_DATA_URL));
    const b = await uploadImmutableDraftImage(draftArgs(PNG_A_DATA_URL_LYING));
    const c = await uploadImmutableDraftImage(draftArgs(PNG_A_B64));

    expect(a.hash32).toBe(H.PNG_A);
    expect(b.hash32).toBe(H.PNG_A);
    expect(c.hash32).toBe(H.PNG_A);
    expect(a.path).toBe(b.path);
    expect(a.path).toBe(c.path);
    expect(a.path).toBe(`user-pb/lit-pb/characters/char1_${H.PNG_A}.png`);
  });

  it('el hash es exactamente 32 hex EN MINÚSCULA', async () => {
    const r = await uploadImmutableDraftImage(draftArgs(PNG_A_B64));
    expect(r.hash32).toMatch(/^[0-9a-f]{32}$/);
  });

  it('bytes distintos ⇒ hash y path distintos', async () => {
    const a = await uploadImmutableDraftImage(draftArgs(PNG_A_B64));
    const b = await uploadImmutableDraftImage(draftArgs(PNG_B_B64));
    expect(a.hash32).not.toBe(b.hash32);
    expect(a.path).not.toBe(b.path);
  });
});

describe('T-B.4 — la verdad del MIME la dan los magic bytes', () => {
  it('PNG / JPEG / WebP producen extensión y contentType correctos', async () => {
    const png = await uploadImmutableDraftImage(draftArgs(PNG_A_B64));
    const jpeg = await uploadImmutableDraftImage(draftArgs(JPEG_B64));
    const webp = await uploadImmutableDraftImage(draftArgs(WEBP_B64));

    expect([png.extension, png.contentType]).toEqual(['png', 'image/png']);
    expect([jpeg.extension, jpeg.contentType]).toEqual(['jpg', 'image/jpeg']);
    expect([webp.extension, webp.contentType]).toEqual(['webp', 'image/webp']);

    expect(png.path.endsWith('.png')).toBe(true);
    expect(jpeg.path.endsWith('.jpg')).toBe(true);
    expect(webp.path.endsWith('.webp')).toBe(true);

    // El borde recibe el contentType olfateado y el Blob del mismo tipo.
    expect(uploadCalls.map((c) => c.contentType)).toEqual(['image/png', 'image/jpeg', 'image/webp']);
    expect(uploadCalls.map((c) => c.blobType)).toEqual(['image/png', 'image/jpeg', 'image/webp']);
  });

  it('una declaración data-URL mentirosa NO gana: PNG declarado jpeg sigue siendo png', async () => {
    const r = await uploadImmutableDraftImage(draftArgs(PNG_A_DATA_URL_LYING));
    expect(r.contentType).toBe('image/png');
    expect(r.extension).toBe('png');
    expect(uploadCalls[0].contentType).toBe('image/png');
  });

  it('el WebP se reconoce por RIFF+WEBP, no por el largo', () => {
    const bytes = decodeBase64Strict(WEBP_B64);
    expect(sniffImageType(bytes)).toEqual({ contentType: 'image/webp', extension: 'webp' });
    // Un RIFF que NO es WEBP no debe pasar.
    const riffNotWebp = new Uint8Array(bytes);
    riffNotWebp[8] = 0x41; // 'A' en vez de 'W'
    expect(sniffImageType(riffNotWebp)).toBeNull();
  });
});

describe('T-B.11 — bytes no soportados y base64 inválido son RECHAZO, no default a PNG', () => {
  it('GIF ⇒ UNSUPPORTED_IMAGE y CERO subidas', async () => {
    await expect(uploadImmutableDraftImage(draftArgs(GIF_B64))).rejects.toMatchObject({
      code: 'UNSUPPORTED_IMAGE',
    });
    expect(uploadCalls).toHaveLength(0);
  });

  it('base64 inválido ⇒ INVALID_BASE64 y CERO subidas', async () => {
    await expect(uploadImmutableDraftImage(draftArgs(INVALID_B64))).rejects.toMatchObject({
      code: 'INVALID_BASE64',
    });
    expect(uploadCalls).toHaveLength(0);
  });

  it('entrada vacía ⇒ EMPTY_INPUT y CERO subidas', async () => {
    await expect(uploadImmutableDraftImage(draftArgs(''))).rejects.toMatchObject({
      code: 'EMPTY_INPUT',
    });
    expect(uploadCalls).toHaveLength(0);
  });

  it('el fallo es una excepción tipada, nunca un null silencioso', async () => {
    await expect(uploadImmutableDraftImage(draftArgs(GIF_B64))).rejects.toBeInstanceOf(
      ImmutableUploadError
    );
  });
});

describe('G3 — clasificación ESTRUCTURAL del conflicto de duplicado', () => {
  it('el 409 capturado del runtime es conflicto', () => {
    expect(isDuplicateConflict(DUPLICATE_CONFLICT_ERROR())).toBe(true);
  });

  it('mismo mensaje pero statusCode distinto NO es conflicto', () => {
    expect(isDuplicateConflict(DUPLICATE_LIKE_MESSAGE_BUT_NOT_409())).toBe(false);
  });

  it('statusCode 409 con texto opaco SÍ es conflicto (no se mira el mensaje)', () => {
    expect(isDuplicateConflict(OPAQUE_409())).toBe(true);
  });

  it('el control capturado "Bucket not found" (404) no es conflicto', () => {
    expect(isDuplicateConflict(BUCKET_NOT_FOUND_ERROR())).toBe(false);
  });

  it('no clasifica por `status`: el duplicado real trae status 400, igual que el 404', () => {
    // Este es el hecho que la captura fijó y que ninguna suposición habría dado.
    expect(DUPLICATE_CONFLICT_ERROR().status).toBe(400);
    expect(BUCKET_NOT_FOUND_ERROR().status).toBe(400);
    // Un error cuyo ÚNICO 409 esté en `status` NO debe clasificarse como
    // conflicto: la librería fijada nunca emite esa forma.
    expect(isDuplicateConflict({ status: 409, message: 'x' })).toBe(false);
  });

  it('valores no-error no rompen el clasificador', () => {
    expect(isDuplicateConflict(null)).toBe(false);
    expect(isDuplicateConflict(undefined)).toBe(false);
    expect(isDuplicateConflict('409')).toBe(false);
    expect(isDuplicateConflict({})).toBe(false);
  });
});

describe('T-B.2 — idempotencia: el 409 es ÉXITO', () => {
  it('el conflicto capturado resuelve con el path determinista y deduplicated=true', async () => {
    uploadResult = { error: DUPLICATE_CONFLICT_ERROR() };
    const r = await uploadImmutableDraftImage(draftArgs(PNG_A_B64));
    expect(r.deduplicated).toBe(true);
    expect(r.path).toBe(`user-pb/lit-pb/characters/char1_${H.PNG_A}.png`);
    expect(r.publicUrl).toContain(r.path);
  });

  it('creación y duplicado producen EXACTAMENTE el mismo path', async () => {
    const created = await uploadImmutableDraftImage(draftArgs(PNG_A_B64));
    uploadResult = { error: DUPLICATE_CONFLICT_ERROR() };
    const dup = await uploadImmutableDraftImage(draftArgs(PNG_A_B64));
    expect(dup.path).toBe(created.path);
    expect(created.deduplicated).toBe(false);
    expect(dup.deduplicated).toBe(true);
  });

  it('un error que NO es conflicto RECHAZA, aunque su mensaje suene a duplicado', async () => {
    uploadResult = { error: DUPLICATE_LIKE_MESSAGE_BUT_NOT_409() };
    await expect(uploadImmutableDraftImage(draftArgs(PNG_A_B64))).rejects.toMatchObject({
      code: 'STORAGE_ERROR',
    });
  });

  it('nunca se pre-chequea la existencia: exactamente UNA llamada a Storage', async () => {
    await uploadImmutableDraftImage(draftArgs(PNG_A_B64));
    expect(uploadCalls).toHaveLength(1);
  });
});

describe('T-B.14 — la primitiva SIEMPRE emite upsert:false', () => {
  it('drafts y liturgia-images escriben con upsert:false', async () => {
    await uploadImmutableDraftImage(draftArgs(PNG_A_B64));
    await uploadImmutableFinalImage({
      liturgyId: 'lit-pb',
      category: 'cover',
      key: 'cover',
      data: PNG_B_B64,
    });
    expect(uploadCalls.map((c) => c.upsert)).toEqual([false, false]);
    expect(uploadCalls.map((c) => c.bucket)).toEqual(['cuentacuentos-drafts', 'liturgia-images']);
  });
});

describe('Paths — compatibilidad con RLS y forma exacta de G2', () => {
  it('drafts conserva userId como PRIMER segmento (own-folder RLS)', async () => {
    const r = await uploadImmutableDraftImage(draftArgs(PNG_A_B64));
    expect(r.path.split('/')[0]).toBe('user-pb');
    expect(r.path).toBe(`user-pb/lit-pb/characters/char1_${H.PNG_A}.png`);
  });

  it('liturgia-images usa el prefijo liturgias/<id>/cuentacuentos/<categoría>', async () => {
    const r = await uploadImmutableFinalImage({
      liturgyId: 'lit-pb',
      category: 'scenes',
      key: 'scene_1',
      data: JPEG_B64,
    });
    expect(r.path).toBe(`liturgias/lit-pb/cuentacuentos/scenes/scene_1_${H.JPEG}.jpg`);
  });

  it('ningún path conserva la forma posicional `_<índice>.`', async () => {
    await uploadImmutableDraftImage(draftArgs(PNG_A_B64));
    expect(uploadCalls[0].path).not.toMatch(/_\d+\.(png|jpg|webp)$/);
  });
});

describe('Auxiliares', () => {
  it('stripDataUrlPrefix sólo actúa sobre data URLs', () => {
    expect(stripDataUrlPrefix(PNG_A_DATA_URL)).toBe(PNG_A_B64);
    expect(stripDataUrlPrefix(PNG_A_B64)).toBe(PNG_A_B64);
  });

  it('isHttpReference reconoce las referencias ya persistidas', () => {
    expect(isHttpReference(EXISTING_DRAFTS_URL)).toBe(true);
    expect(isHttpReference(PNG_A_B64)).toBe(false);
    expect(isHttpReference(null)).toBe(false);
  });
});
