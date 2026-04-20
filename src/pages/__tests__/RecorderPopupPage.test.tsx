/**
 * RecorderPopupPage — Button interaction tests
 *
 * Reproduces a real user report: once "Grabando" is shown the Pausar and
 * Detener y guardar buttons do not respond to clicks. We stub getUserMedia,
 * MediaRecorder, the auth context, useSearchParams, Supabase, and the
 * uploader, then actually click the buttons via userEvent to verify that
 * onClick reaches the handlers and the status transitions correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the component under test
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'test@example.com',
};

vi.mock('@/components/auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => {
      const params = new URLSearchParams();
      params.set('meetingId', '22222222-2222-4222-8222-222222222222');
      return [params, () => {}] as const;
    },
  };
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Stable references — match real useWakeLock which memoizes via useCallback.
const wakeLockRequest = vi.fn().mockResolvedValue(undefined);
const wakeLockRelease = vi.fn().mockResolvedValue(undefined);
vi.mock('@/hooks/useWakeLock', () => {
  const fn = () => ({
    isActive: true,
    isSupported: true,
    error: null,
    request: wakeLockRequest,
    release: wakeLockRelease,
  });
  return { useWakeLock: fn, default: fn };
});

vi.mock('@/lib/leadership/recorderChannel', () => ({
  createRecorderChannel: () => ({
    send: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    close: vi.fn(),
  }),
}));

vi.mock('@/lib/leadership/recorderUploader', () => ({
  uploadSegment: vi.fn().mockResolvedValue({ segmentIndex: 0 }),
  uploadLiveSnapshot: vi.fn().mockResolvedValue(undefined),
  finalize: vi.fn().mockResolvedValue({ recordingId: 'rec-1' }),
}));

vi.mock('@/lib/leadership/recorderSession', () => ({
  openRecorderDB: vi.fn().mockResolvedValue(null),
  saveSegment: vi.fn().mockResolvedValue(undefined),
  listSegments: vi.fn().mockResolvedValue([]),
  deleteSession: vi.fn().mockResolvedValue(undefined),
}));

// Mock the Supabase client enough for the session insert + update flow.
const mockSessionId = '11111111-1111-4111-8111-111111111111';
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockSessionId },
            error: null,
          }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    },
  },
}));

// ---------------------------------------------------------------------------
// MediaRecorder stub — synchronous state transitions via pause()/resume()/stop()
// ---------------------------------------------------------------------------

class MockMediaRecorder {
  static isTypeSupported(_t: string): boolean {
    return true;
  }
  ondataavailable: ((evt: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((evt: Event) => void) | null = null;
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType: string;
  stream: MediaStream;

  constructor(stream: MediaStream, opts?: { mimeType?: string }) {
    this.stream = stream;
    this.mimeType = opts?.mimeType ?? 'audio/webm';
  }
  start(_timeslice?: number) {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    if (this.onstop) this.onstop();
  }
  pause() {
    if (this.state === 'recording') this.state = 'paused';
  }
  resume() {
    if (this.state === 'paused') this.state = 'recording';
  }
}
Object.assign(globalThis, {
  MediaRecorder: MockMediaRecorder,
  BlobEvent: class {},
});

// getUserMedia stub
beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [
          { stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() },
        ],
        getAudioTracks: () => [
          { stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() },
        ],
      }),
    },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  document.body.style.pointerEvents = '';
  vi.clearAllMocks();
});

// Import AFTER mocks are declared
import RecorderPopupPage from '../RecorderPopupPage';

const renderPopup = () =>
  render(
    <MemoryRouter initialEntries={['/recorder?meetingId=22222222-2222-4222-8222-222222222222']}>
      <RecorderPopupPage />
    </MemoryRouter>,
  );

describe('RecorderPopupPage — button interactions', () => {
  it('advances to "Grabando" state after mounting', async () => {
    renderPopup();
    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: 'Grabando' })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it('responds to Pausar button click and transitions to "En pausa"', async () => {
    const user = userEvent.setup();
    renderPopup();

    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: 'Grabando' })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const pauseBtn = screen.getByRole('button', { name: /Pausar/i });
    expect(pauseBtn).not.toBeDisabled();

    await user.click(pauseBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'En pausa' })).toBeInTheDocument();
    });
  });

  it('responds to Detener y guardar button click and leaves "Grabando" state', async () => {
    const user = userEvent.setup();
    renderPopup();

    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: 'Grabando' })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const stopBtn = screen.getByRole('button', { name: /Detener/i });
    expect(stopBtn).not.toBeDisabled();

    await user.click(stopBtn);

    await waitFor(
      () => {
        const heading = screen.getByRole('heading', { level: 1 });
        expect(['Deteniendo…', 'Detenido']).toContain(heading.textContent);
      },
      { timeout: 5000 },
    );
  });

  it('Pausar still works after body gets pointer-events:none (Radix Dialog leak)', async () => {
    const user = userEvent.setup();
    renderPopup();

    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: 'Grabando' })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Simulate the known Radix bug where body gets stuck at pointer-events:none
    document.body.style.pointerEvents = 'none';

    // Let the MutationObserver tick
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // After the mitigation fires, body should be clickable again
    expect(document.body.style.pointerEvents).not.toBe('none');

    const pauseBtn = screen.getByRole('button', { name: /Pausar/i });
    await user.click(pauseBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'En pausa' })).toBeInTheDocument();
    });
  });
});
