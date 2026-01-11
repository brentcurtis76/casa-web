/**
 * Hook para sincronizacion entre Presenter y Output views
 * Maneja la comunicacion via BroadcastChannel
 */

import { useEffect, useRef, useCallback } from 'react';
import { createSyncChannel, type SyncChannel } from '@/lib/presentation/syncChannel';
import type { SyncMessage, SyncRole, PresentationState } from '@/lib/presentation/types';

interface UsePresentationSyncOptions {
  role: SyncRole;
  onMessage: (message: SyncMessage) => void;
}

interface UsePresentationSyncReturn {
  send: (message: SyncMessage) => void;
  requestState: () => void;
  syncState: (state: PresentationState) => void;
}

/**
 * Hook para sincronizar estado entre ventanas de presentacion
 * @param options - Configuracion del hook
 * @returns Funciones para enviar mensajes
 */
export function usePresentationSync(
  options: UsePresentationSyncOptions
): UsePresentationSyncReturn {
  const { role, onMessage } = options;
  const channelRef = useRef<SyncChannel | null>(null);

  // Inicializar canal
  useEffect(() => {
    channelRef.current = createSyncChannel();

    const unsubscribe = channelRef.current.subscribe((message) => {
      onMessage(message);
    });

    // Output requests state on mount
    if (role === 'output') {
      channelRef.current.send({ type: 'REQUEST_STATE' });
    }

    return () => {
      unsubscribe();
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [role, onMessage]);

  // Enviar mensaje
  const send = useCallback((message: SyncMessage) => {
    channelRef.current?.send(message);
  }, []);

  // Solicitar estado actual (usado por output al conectarse)
  const requestState = useCallback(() => {
    send({ type: 'REQUEST_STATE' });
  }, [send]);

  // Sincronizar estado completo
  const syncState = useCallback((state: PresentationState) => {
    send({ type: 'STATE_SYNC', state });
  }, [send]);

  return {
    send,
    requestState,
    syncState,
  };
}
