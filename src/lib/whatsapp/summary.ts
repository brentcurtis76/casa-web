// Shared formatter for the send-music-service-packet response toast.

export type PacketWhatsAppSummary = {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
};

export type PacketSendResult = {
  success: boolean;
  sent: number;
  failed: number;
  errors?: string[];
  error?: string;
  whatsapp?: PacketWhatsAppSummary;
};

/** "3 correos, 2 WhatsApp, 1 sin opt-in" — omits zero-count segments except email. */
export function describePacketSendResult(result: PacketSendResult): string {
  const parts: string[] = [
    `${result.sent} correo${result.sent !== 1 ? 's' : ''} enviado${result.sent !== 1 ? 's' : ''}`,
  ];
  if (result.failed > 0) {
    parts.push(`${result.failed} correo${result.failed !== 1 ? 's' : ''} fallido${result.failed !== 1 ? 's' : ''}`);
  }
  const wa = result.whatsapp;
  if (wa) {
    if (wa.sent > 0) parts.push(`${wa.sent} WhatsApp enviado${wa.sent !== 1 ? 's' : ''}`);
    if (wa.failed > 0) parts.push(`${wa.failed} WhatsApp fallido${wa.failed !== 1 ? 's' : ''}`);
    if (wa.skipped > 0) parts.push(`${wa.skipped} sin opt-in de WhatsApp`);
  }
  return parts.join(', ');
}
