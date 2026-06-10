/**
 * quickProcessor — verifies the progress-ordering contract by mocking the
 * underlying audio lib modules. Each downstream stage is a tiny stub so the
 * test never touches the real Web Audio API.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const applyEnhancementsMock = vi.fn();
const fetchAudioBufferMock = vi.fn();
const concatenateWithCrossfadeMock = vi.fn();
const encodeToMp3Mock = vi.fn();

vi.mock('@/lib/sermon-editor/audioEnhancer', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/sermon-editor/audioEnhancer')
  >('@/lib/sermon-editor/audioEnhancer');
  return {
    ...actual,
    applyEnhancements: (...args: unknown[]) => applyEnhancementsMock(...args),
  };
});

vi.mock('@/lib/sermon-editor/audioProcessor', () => ({
  fetchAudioBuffer: (...args: unknown[]) => fetchAudioBufferMock(...args),
  concatenateWithCrossfade: (...args: unknown[]) =>
    concatenateWithCrossfadeMock(...args),
}));

vi.mock('@/lib/sermon-editor/mp3Encoder', () => ({
  encodeToMp3: (...args: unknown[]) => encodeToMp3Mock(...args),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  },
}));

import { processQuickAudio } from '../quickProcessor';

function fakeBuffer(duration = 120): AudioBuffer {
  return { duration } as unknown as AudioBuffer;
}

describe('processQuickAudio', () => {
  beforeEach(() => {
    applyEnhancementsMock.mockReset();
    fetchAudioBufferMock.mockReset();
    concatenateWithCrossfadeMock.mockReset();
    encodeToMp3Mock.mockReset();
  });

  it('reports progress in the documented order with monotonic labels', async () => {
    const source = fakeBuffer(60);
    const enhanced = fakeBuffer(60);
    const mixed = fakeBuffer(70);
    const intro = fakeBuffer(5);
    const outro = fakeBuffer(5);

    applyEnhancementsMock.mockResolvedValue(enhanced);
    fetchAudioBufferMock.mockResolvedValueOnce(intro).mockResolvedValueOnce(outro);
    concatenateWithCrossfadeMock.mockResolvedValue(mixed);
    encodeToMp3Mock.mockImplementation(async (_buf, opts) => {
      opts.onProgress?.(0);
      opts.onProgress?.(50);
      opts.onProgress?.(100);
      return new Blob(['mp3'], { type: 'audio/mpeg' });
    });

    const events: Array<{ pct: number; label: string }> = [];
    const result = await processQuickAudio(source, {
      introUrl: 'https://example/intro.mp3',
      outroUrl: 'https://example/outro.mp3',
      onProgress: (pct, label) => events.push({ pct, label }),
    });

    expect(result.durationSeconds).toBe(70);
    expect(result.mp3Blob.type).toBe('audio/mpeg');

    // Labels must appear in the documented order.
    const labels = events.map((e) => e.label);
    const firstIdx = (l: string) => labels.findIndex((x) => x === l);
    expect(firstIdx('Mejorando la voz…')).toBeGreaterThanOrEqual(0);
    expect(firstIdx('Preparando música…')).toBeGreaterThan(
      firstIdx('Mejorando la voz…'),
    );
    expect(firstIdx('Añadiendo intro y cierre…')).toBeGreaterThan(
      firstIdx('Preparando música…'),
    );
    expect(firstIdx('Codificando MP3…')).toBeGreaterThan(
      firstIdx('Añadiendo intro y cierre…'),
    );

    // Final progress should hit 100.
    expect(events[events.length - 1].pct).toBe(100);
  });

  it('skips concatenateWithCrossfade when neither intro nor outro is provided', async () => {
    const source = fakeBuffer(45);
    const enhanced = fakeBuffer(45);

    applyEnhancementsMock.mockResolvedValue(enhanced);
    encodeToMp3Mock.mockResolvedValue(new Blob(['mp3']));

    await processQuickAudio(source, {});

    expect(fetchAudioBufferMock).not.toHaveBeenCalled();
    expect(concatenateWithCrossfadeMock).not.toHaveBeenCalled();
    expect(encodeToMp3Mock).toHaveBeenCalled();
  });

  it('wraps fetchAudioBuffer failures in a typed error', async () => {
    const source = fakeBuffer();
    applyEnhancementsMock.mockResolvedValue(fakeBuffer());
    fetchAudioBufferMock.mockRejectedValue(new Error('boom'));

    await expect(
      processQuickAudio(source, { introUrl: 'https://x/i.mp3' }),
    ).rejects.toMatchObject({
      stage: 'fetching-music',
      name: 'QuickProcessError',
    });
  });
});
