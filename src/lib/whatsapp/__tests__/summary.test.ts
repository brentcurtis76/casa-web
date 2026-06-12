import { describe, it, expect } from 'vitest';
import { describePacketSendResult } from '../summary';

describe('describePacketSendResult', () => {
  it('formats email-only results (legacy response without whatsapp)', () => {
    expect(
      describePacketSendResult({ success: true, sent: 3, failed: 0 })
    ).toBe('3 correos enviados');
    expect(
      describePacketSendResult({ success: true, sent: 1, failed: 1 })
    ).toBe('1 correo enviado, 1 correo fallido');
  });

  it('includes whatsapp counts when present', () => {
    expect(
      describePacketSendResult({
        success: true,
        sent: 3,
        failed: 0,
        whatsapp: { sent: 2, failed: 1, skipped: 1, errors: [] },
      })
    ).toBe('3 correos enviados, 2 WhatsApp enviados, 1 WhatsApp fallido, 1 sin opt-in de WhatsApp');
  });

  it('omits zero whatsapp segments', () => {
    expect(
      describePacketSendResult({
        success: true,
        sent: 2,
        failed: 0,
        whatsapp: { sent: 0, failed: 0, skipped: 0, errors: [] },
      })
    ).toBe('2 correos enviados');
  });
});
