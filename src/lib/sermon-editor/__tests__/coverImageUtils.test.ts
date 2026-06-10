/**
 * coverImageUtils — verifies the JPEG quality-stepping byte-limit loop.
 *
 * jsdom does not implement canvas drawing or Image decoding, so we mock
 * `document.createElement('canvas')` and the `Image` constructor so we
 * can control what each `toBlob` call returns.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { base64ToSpotifyCover } from '../coverImageUtils';

const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

type ToBlobImpl = (
  cb: (b: Blob | null) => void,
  type: string,
  quality: number,
) => void;

function installCanvasMock(toBlob: ToBlobImpl) {
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const getContext = vi.fn(() => ({
    drawImage,
    fillRect,
    fillStyle: '',
  }));
  const createElement = vi
    .spyOn(document, 'createElement')
    .mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext,
          toBlob,
        } as unknown as HTMLCanvasElement;
      }
      // Fallback to real implementation for anything else.
      return document.createElement.wrappedMethod
        ? document.createElement.wrappedMethod(tag)
        : ({} as HTMLElement);
    });
  return { createElement, getContext, drawImage };
}

function installImageMock() {
  const original = globalThis.Image;
  class MockImage {
    onload: (() => void) | null = null;
    onerror: ((e: Event | string) => void) | null = null;
    width = 1024;
    height = 1024;
    set src(_value: string) {
      // Fire load on next tick so callers can attach handlers first.
      setTimeout(() => this.onload?.(), 0);
    }
  }
  (globalThis as unknown as { Image: typeof Image }).Image =
    MockImage as unknown as typeof Image;
  return () => {
    (globalThis as unknown as { Image: typeof Image | undefined }).Image =
      original;
  };
}

describe('base64ToSpotifyCover', () => {
  let restoreImage: () => void;

  beforeEach(() => {
    restoreImage = installImageMock();
  });

  afterEach(() => {
    restoreImage();
    vi.restoreAllMocks();
  });

  it('returns the first quality step that fits under maxBytes', async () => {
    const sizes = [3_000_000, 2_500_000, 1_800_000, 1_000_000];
    const qualities: number[] = [];
    installCanvasMock((cb, _type, q) => {
      qualities.push(q);
      const idx = qualities.length - 1;
      cb(new Blob([new Uint8Array(sizes[idx] ?? 100)], { type: 'image/jpeg' }));
    });

    const blob = await base64ToSpotifyCover(TINY_PNG, 1400, 2 * 1024 * 1024);
    // Third step (0.78) is the first one under 2 MB.
    expect(qualities.slice(0, 3)).toEqual([0.92, 0.85, 0.78]);
    expect(blob.size).toBe(1_800_000);
  });

  it('throws when even the lowest quality step is still too large', async () => {
    installCanvasMock((cb) => {
      cb(new Blob([new Uint8Array(5_000_000)], { type: 'image/jpeg' }));
    });

    await expect(
      base64ToSpotifyCover(TINY_PNG, 1400, 2 * 1024 * 1024),
    ).rejects.toThrow(/portada/i);
  });
});
