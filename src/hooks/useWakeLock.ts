/**
 * useWakeLock — Screen Wake Lock API hook.
 *
 * Prevents the screen from dimming or locking while active, which matters for
 * long-running leadership recording sessions where the tab must stay awake.
 * Gracefully degrades on browsers without Wake Lock support.
 *
 * The wake lock is automatically released when the tab becomes hidden. When
 * the tab returns to visible, the hook re-acquires the lock if it was
 * previously requested, matching the pattern recommended by the spec.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type WakeLockType = 'screen';

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
  removeEventListener: (type: 'release', listener: () => void) => void;
}

interface WakeLockNavigator {
  wakeLock?: {
    request: (type: WakeLockType) => Promise<WakeLockSentinelLike>;
  };
}

export interface UseWakeLockResult {
  isActive: boolean;
  isSupported: boolean;
  error: Error | null;
  request: () => Promise<void>;
  release: () => Promise<void>;
}

function getWakeLockApi(): WakeLockNavigator['wakeLock'] | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & WakeLockNavigator).wakeLock;
}

export function useWakeLock(): UseWakeLockResult {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const wantActiveRef = useRef(false);

  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const acquire = useCallback(async () => {
    const api = getWakeLockApi();
    if (!api) {
      setError(new Error('Wake Lock API no soportado en este navegador'));
      return;
    }
    try {
      const sentinel = await api.request('screen');
      const onRelease = () => {
        sentinelRef.current = null;
        setIsActive(false);
      };
      sentinel.addEventListener('release', onRelease);
      sentinelRef.current = sentinel;
      setIsActive(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsActive(false);
    }
  }, []);

  const request = useCallback(async () => {
    wantActiveRef.current = true;
    await acquire();
  }, [acquire]);

  const release = useCallback(async () => {
    wantActiveRef.current = false;
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    setIsActive(false);
    if (sentinel && !sentinel.released) {
      try {
        await sentinel.release();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wantActiveRef.current && !sentinelRef.current) {
        void acquire();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [acquire]);

  useEffect(() => {
    return () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      wantActiveRef.current = false;
      if (sentinel && !sentinel.released) {
        void sentinel.release().catch(() => {
          /* cleanup-time release errors are non-fatal */
        });
      }
    };
  }, []);

  return { isActive, isSupported, error, request, release };
}

export default useWakeLock;
