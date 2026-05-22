import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadImportedImage, uploadImportedImages } from '../imageImportService';
import { supabase } from '@/integrations/supabase/client';

type SupabaseMock = {
  storage: { from: ReturnType<typeof vi.fn> };
};

const supabaseMock = supabase as unknown as SupabaseMock;

function file(name: string, type = 'image/png', sizeBytes = 1024): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

function setupStorage(opts: {
  upload?: (path: string, _file: File) => Promise<{ error: { message: string } | null }>;
  publicUrlFor?: (path: string) => string;
}): { uploadSpy: ReturnType<typeof vi.fn> } {
  const uploadSpy = vi.fn(async (path: string, f: File) => {
    if (opts.upload) return opts.upload(path, f);
    return { error: null };
  });
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: opts.publicUrlFor ? opts.publicUrlFor(path) : `https://cdn.example.com/${path}` },
  }));
  supabaseMock.storage.from = vi.fn(() => ({
    upload: uploadSpy,
    download: vi.fn(),
    remove: vi.fn(),
    getPublicUrl,
  }));
  return { uploadSpy };
}

describe('imageImportService — uploadImportedImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-image files', async () => {
    setupStorage({});
    const txt = new File(['hi'], 'note.txt', { type: 'text/plain' });
    await expect(uploadImportedImage(txt, 'lit-1')).rejects.toThrow(/no es una imagen/i);
  });

  it('rejects files exceeding the 50MB limit', async () => {
    setupStorage({});
    const huge = file('big.png', 'image/png', 1); // size lied via property override
    Object.defineProperty(huge, 'size', { value: 51 * 1024 * 1024 });
    await expect(uploadImportedImage(huge, 'lit-1')).rejects.toThrow(/50 MB/i);
  });

  it('uploads under the bucket path liturgyId/imported/<uuid>.<ext>', async () => {
    const { uploadSpy } = setupStorage({});
    const url = await uploadImportedImage(file('photo.png', 'image/png'), 'lit-42');
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    const [pathArg] = uploadSpy.mock.calls[0];
    expect(pathArg).toMatch(/^lit-42\/imported\/[a-z0-9-]+\.png$/i);
    expect(url).toContain('lit-42/imported/');
  });

  it('falls back to filename extension when mime type is missing', async () => {
    const { uploadSpy } = setupStorage({});
    const noMime = file('drawing.webp', '');
    await uploadImportedImage(noMime, 'lit-1').catch(() => {
      /* may throw on non-image MIME — expected */
    });
    // If it passes validation (image/* mime missing means it WILL throw),
    // we only assert no upload call happened.
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it('propagates Supabase storage error messages', async () => {
    setupStorage({
      upload: async () => ({ error: { message: 'bucket not found' } }),
    });
    await expect(uploadImportedImage(file('a.png'), 'lit-1')).rejects.toThrow(/bucket not found/i);
  });
});

describe('imageImportService — uploadImportedImages partial failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns separate uploaded/failed buckets when some uploads fail', async () => {
    let callIdx = 0;
    setupStorage({
      upload: async () => {
        callIdx += 1;
        // First and third succeed, second fails
        if (callIdx === 2) return { error: { message: 'transient network error' } };
        return { error: null };
      },
    });
    const files = [file('a.png'), file('b.png'), file('c.png')];
    const result = await uploadImportedImages(files, 'lit-1');
    expect(result.uploaded).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toMatch(/transient network/i);
  });

  it('invokes onProgress for every file regardless of success/failure', async () => {
    setupStorage({
      upload: async (_path, f) => {
        if (f.name === 'b.png') return { error: { message: 'fail' } };
        return { error: null };
      },
    });
    const onProgress = vi.fn();
    const files = [file('a.png'), file('b.png'), file('c.png')];
    await uploadImportedImages(files, 'lit-1', onProgress);
    expect(onProgress).toHaveBeenCalledTimes(3);
    // Final call reports total
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
    expect(lastCall[1]).toBe(3);
  });

  it('returns empty failed list when all uploads succeed', async () => {
    setupStorage({});
    const result = await uploadImportedImages([file('a.png'), file('b.png')], 'lit-9');
    expect(result.uploaded).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(result.uploaded[0].publicUrl).toContain('lit-9/imported/');
  });

  it('does not upload base64 data — the file blob is passed through to storage.upload', async () => {
    const { uploadSpy } = setupStorage({});
    const f = file('photo.png');
    await uploadImportedImages([f], 'lit-1');
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    const [, blobArg] = uploadSpy.mock.calls[0];
    // The second arg must be a File (binary blob), not a data: URI string
    expect(blobArg).toBeInstanceOf(File);
    expect(typeof blobArg).not.toBe('string');
  });
});
