/**
 * Canal de sincronización para el sistema de presentación
 * Usa BroadcastChannel para comunicación entre ventanas del mismo origen
 */

import type { SyncMessage } from './types';

const CHANNEL_NAME = 'casa-presentation';

export interface SyncChannel {
  send: (msg: SyncMessage) => void;
  subscribe: (handler: (msg: SyncMessage) => void) => () => void;
  close: () => void;
}

/**
 * Crea un canal de sincronización para comunicación entre ventanas
 * @returns Objeto con métodos send, subscribe y close
 */
export function createSyncChannel(): SyncChannel {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const handlers = new Set<(msg: SyncMessage) => void>();

  channel.onmessage = (e: MessageEvent<SyncMessage>) => {
    handlers.forEach((h) => h(e.data));
  };

  return {
    /**
     * Envía un mensaje a todas las ventanas conectadas
     */
    send: (msg: SyncMessage) => {
      channel.postMessage(msg);
    },

    /**
     * Suscribe un handler para recibir mensajes
     * @returns Función para cancelar la suscripción
     */
    subscribe: (handler: (msg: SyncMessage) => void) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },

    /**
     * Cierra el canal y limpia recursos
     */
    close: () => {
      handlers.clear();
      channel.close();
    },
  };
}

/**
 * Singleton del canal de sincronización
 * Garantiza una única instancia por ventana
 */
let globalChannel: SyncChannel | null = null;

export function getSyncChannel(): SyncChannel {
  if (!globalChannel) {
    globalChannel = createSyncChannel();
  }
  return globalChannel;
}

export function closeSyncChannel(): void {
  if (globalChannel) {
    globalChannel.close();
    globalChannel = null;
  }
}
