/**
 * useCasaLogo — shared hook for loading the CASA logo as base64 for use as
 * a Gemini `referenceImage` in cover-generation flows.
 *
 * Extracted from the duplicated useEffect block in Portadas.tsx and
 * CoverArtGenerator.tsx. Both files previously carried near-identical
 * fetch/toast/cancel logic.
 *
 * Returns:
 * - `logoBase64`: raw base64 (no data-URL prefix), ready to pass as
 *   referenceImage. `null` until the initial fetch resolves.
 * - `failed`: true when the fetch has errored and no cached value is
 *   available. Callers render a persistent inline warning + retry when this
 *   is true.
 * - `retry`: bumps an internal nonce so the effect re-fires and reloads.
 *
 * Accepts an optional `onError` callback so callers can surface the failure
 * via their own toast system (shadcn useToast vs sonner) without coupling
 * this module to either.
 */

import { useEffect, useRef, useState } from 'react';
import { getCasaLogoAsBase64 } from './coverPromptBuilder';

export interface UseCasaLogoReturn {
  logoBase64: string | null;
  failed: boolean;
  retry: () => void;
}

export function useCasaLogo(onError?: (err: unknown) => void): UseCasaLogoReturn {
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  // Capture the latest onError in a ref so we don't re-fire the effect every
  // render when the caller passes an inline (unstable) callback.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    getCasaLogoAsBase64()
      .then((b64) => {
        if (!cancelled) setLogoBase64(b64);
      })
      .catch((err) => {
        console.error('[useCasaLogo] Failed to load CASA logo:', err);
        if (!cancelled) {
          setFailed(true);
          onErrorRef.current?.(err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return {
    logoBase64,
    failed,
    retry: () => setNonce((n) => n + 1),
  };
}
