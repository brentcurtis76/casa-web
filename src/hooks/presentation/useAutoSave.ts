/**
 * useAutoSave - Auto-saves presentation state to localStorage
 * Uses debouncing to avoid excessive writes (max every 2 seconds)
 */

import { useEffect, useRef, useCallback } from 'react';
import type { PresentationState, LogoState, TextOverlayState, TempSlideEdit } from '@/lib/presentation/types';

export const PRESENTATION_STATE_KEY = 'casa-presentation-state';
const SAVE_DEBOUNCE_MS = 2000;
const MAX_STATE_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface SavedPresentationState {
  liturgyId: string;
  liturgyTitle: string;
  // Preview state
  previewSlideIndex: number;
  // Live state
  liveSlideIndex: number;
  isLive: boolean;
  isBlack: boolean;
  logoState: LogoState;
  textOverlayState: TextOverlayState;
  // Live copies
  liveLogoState: LogoState;
  liveTextOverlayState: TextOverlayState;
  // Temp edits (slide content modifications)
  tempEdits: Record<string, TempSlideEdit>;
  liveTempEdits: Record<string, TempSlideEdit>;
  savedAt: number;
  // Legacy field for backwards compatibility
  currentSlideIndex?: number;
}

/**
 * Saves presentation state to localStorage with debouncing
 */
export function useAutoSave(state: PresentationState): void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any pending save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Only save if we have an active liturgy
    if (!state.data) {
      return;
    }

    // Debounced save
    timeoutRef.current = setTimeout(() => {
      const saveData: SavedPresentationState = {
        liturgyId: state.data!.liturgyId,
        liturgyTitle: state.data!.liturgyTitle,
        previewSlideIndex: state.previewSlideIndex,
        liveSlideIndex: state.liveSlideIndex,
        isLive: state.isLive,
        isBlack: state.isBlack,
        logoState: state.logoState,
        textOverlayState: state.textOverlayState,
        liveLogoState: state.liveLogoState,
        liveTextOverlayState: state.liveTextOverlayState,
        tempEdits: state.tempEdits,
        liveTempEdits: state.liveTempEdits,
        savedAt: Date.now(),
      };

      try {
        localStorage.setItem(PRESENTATION_STATE_KEY, JSON.stringify(saveData));
      } catch (err) {
        console.error('Failed to save presentation state:', err);
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    state.data,
    state.previewSlideIndex,
    state.liveSlideIndex,
    state.isLive,
    state.isBlack,
    state.logoState,
    state.textOverlayState,
    state.liveLogoState,
    state.liveTextOverlayState,
    state.tempEdits,
    state.liveTempEdits,
  ]);
}

/**
 * Retrieves saved presentation state from localStorage
 * Returns null if no state exists or if it's too old
 * Migrates old format to new format if necessary
 */
export function getSavedPresentationState(): SavedPresentationState | null {
  try {
    const saved = localStorage.getItem(PRESENTATION_STATE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved);

    // Check if state is too old (more than 4 hours)
    if (Date.now() - parsed.savedAt > MAX_STATE_AGE_MS) {
      clearSavedPresentationState();
      return null;
    }

    // Migrate old logoState format (global -> settings)
    if (parsed.logoState?.global && !parsed.logoState?.settings) {
      parsed.logoState = {
        settings: parsed.logoState.global,
        scope: { type: 'all' as const },
      };
    }

    // Migrate old textOverlayState format (ensure overlays array exists)
    if (parsed.textOverlayState && !Array.isArray(parsed.textOverlayState.overlays)) {
      // Old format might have had global/overrides/scopes
      parsed.textOverlayState = {
        overlays: parsed.textOverlayState.global ? [] : (parsed.textOverlayState.overlays || []),
      };
    }

    // Migrate old currentSlideIndex to new preview/live format
    if (typeof parsed.currentSlideIndex === 'number' && parsed.previewSlideIndex === undefined) {
      parsed.previewSlideIndex = parsed.currentSlideIndex;
      parsed.liveSlideIndex = parsed.currentSlideIndex;
    }

    // Ensure live states exist (default to preview states for migration)
    if (!parsed.liveLogoState && parsed.logoState) {
      parsed.liveLogoState = parsed.logoState;
    }
    if (!parsed.liveTextOverlayState && parsed.textOverlayState) {
      parsed.liveTextOverlayState = parsed.textOverlayState;
    }

    // Ensure tempEdits exist (default to empty objects)
    if (!parsed.tempEdits) {
      parsed.tempEdits = {};
    }
    if (!parsed.liveTempEdits) {
      parsed.liveTempEdits = parsed.tempEdits || {};
    }

    // Validate required fields exist
    if (!parsed.logoState?.settings || !parsed.textOverlayState?.overlays) {
      console.warn('Invalid saved state format, clearing');
      clearSavedPresentationState();
      return null;
    }

    return parsed as SavedPresentationState;
  } catch (err) {
    console.error('Failed to read saved presentation state:', err);
    return null;
  }
}

/**
 * Clears saved presentation state from localStorage
 */
export function clearSavedPresentationState(): void {
  try {
    localStorage.removeItem(PRESENTATION_STATE_KEY);
  } catch (err) {
    console.error('Failed to clear saved presentation state:', err);
  }
}

/**
 * Formats time elapsed since save for display
 */
export function formatTimeSinceSave(savedAt: number): string {
  const elapsed = Date.now() - savedAt;
  const minutes = Math.floor(elapsed / (1000 * 60));
  const hours = Math.floor(elapsed / (1000 * 60 * 60));

  if (hours > 0) {
    return `hace ${hours} hora${hours === 1 ? '' : 's'}`;
  }
  if (minutes > 0) {
    return `hace ${minutes} minuto${minutes === 1 ? '' : 's'}`;
  }
  return 'hace un momento';
}
