/**
 * Hook para atajos de teclado en la presentacion
 */

import { useEffect, useCallback } from 'react';

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  onNext: () => void;
  onPrev: () => void;
  onFirst: () => void;
  onLast: () => void;
  onBlack: () => void;
  onPublish?: () => void;
  onFullscreen?: () => void;
}

/**
 * Hook que maneja atajos de teclado para la presentacion
 * - Right Arrow / Space / PageDown = Next slide (preview only)
 * - Left Arrow / PageUp = Previous slide (preview only)
 * - Home = First slide (preview only)
 * - End = Last slide (preview only)
 * - Enter / P = Publish changes to output
 * - B = Toggle black
 * - F = Toggle fullscreen (output)
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const {
    enabled = true,
    onNext,
    onPrev,
    onFirst,
    onLast,
    onBlack,
    onPublish,
    onFullscreen,
  } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignorar si estamos escribiendo en un input
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (event.key) {
        case 'ArrowRight':
        case ' ':
        case 'PageDown':
          event.preventDefault();
          onNext();
          break;

        case 'ArrowLeft':
        case 'PageUp':
          event.preventDefault();
          onPrev();
          break;

        case 'Home':
          event.preventDefault();
          onFirst();
          break;

        case 'End':
          event.preventDefault();
          onLast();
          break;

        case 'b':
        case 'B':
          event.preventDefault();
          onBlack();
          break;

        case 'Enter':
        case 'p':
        case 'P':
          if (onPublish) {
            event.preventDefault();
            onPublish();
          }
          break;

        case 'f':
        case 'F':
          if (onFullscreen) {
            event.preventDefault();
            onFullscreen();
          }
          break;
      }
    },
    [onNext, onPrev, onFirst, onLast, onBlack, onPublish, onFullscreen]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}
