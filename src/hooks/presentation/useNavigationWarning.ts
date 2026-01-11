/**
 * useNavigationWarning - Shows warning before leaving page
 * Handles both browser close/refresh AND React Router navigation (back button, links)
 */

import { useEffect, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';

interface UseNavigationWarningOptions {
  /** Whether to show warning (e.g., only when liturgy is loaded) */
  enabled: boolean;
  /** Message to show in custom modal */
  message?: string;
}

interface NavigationWarningState {
  /** Whether navigation is currently blocked */
  isBlocked: boolean;
  /** Call to proceed with navigation */
  proceed: () => void;
  /** Call to cancel navigation and stay */
  cancel: () => void;
}

/**
 * Hook to warn users before leaving the page
 * - Uses beforeunload event for browser close/refresh
 * - Uses React Router's useBlocker for back button and in-app navigation
 *
 * Returns state for rendering a custom confirmation modal
 */
export function useNavigationWarning({
  enabled,
  message = '¿Salir de la presentación? Tu progreso se guardará automáticamente.',
}: UseNavigationWarningOptions): NavigationWarningState {

  // Handle browser close/refresh with beforeunload
  const handleBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (enabled) {
        e.preventDefault();
        // Note: Most modern browsers ignore custom messages and show their own
        // But we still need to set returnValue for Chrome compatibility
        e.returnValue = message;
        return message;
      }
    },
    [enabled, message]
  );

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleBeforeUnload]);

  // Handle React Router navigation (back button, links, navigate() calls)
  const blocker = useBlocker(
    useCallback(
      () => enabled,
      [enabled]
    )
  );

  // Return state for custom modal rendering
  return {
    isBlocked: blocker.state === 'blocked',
    proceed: () => blocker.proceed?.(),
    cancel: () => blocker.reset?.(),
  };
}

/**
 * Hook specifically for Output View - warns when output is connected/live
 * Only uses beforeunload (no React Router blocking needed for output window)
 */
export function useOutputNavigationWarning(isConnected: boolean): void {
  const handleBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (isConnected) {
        e.preventDefault();
        e.returnValue = '';
      }
    },
    [isConnected]
  );

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleBeforeUnload]);
}
