import { describe, it, expect } from 'vitest';
import { buildPayload, parsePayload, isOptOutMessage } from '../payload';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('buildPayload / parsePayload', () => {
  it('round-trips confirm:music', () => {
    const payload = buildPayload('confirm', 'music', UUID);
    expect(payload).toBe(`confirm:music:${UUID}`);
    expect(payload.length).toBeLessThanOrEqual(128);
    expect(parsePayload(payload)).toEqual({ action: 'confirm', domain: 'music', id: UUID });
  });

  it('round-trips decline for children and rehearsal domains', () => {
    expect(parsePayload(buildPayload('decline', 'children', UUID))).toEqual({
      action: 'decline',
      domain: 'children',
      id: UUID,
    });
    expect(parsePayload(buildPayload('decline', 'rehearsal', UUID))).toEqual({
      action: 'decline',
      domain: 'rehearsal',
      id: UUID,
    });
  });

  it('rejects unknown actions, domains, and malformed ids', () => {
    expect(parsePayload(`approve:music:${UUID}`)).toBeNull();
    expect(parsePayload(`confirm:mesa:${UUID}`)).toBeNull();
    expect(parsePayload('confirm:music:not-a-uuid')).toBeNull();
    expect(parsePayload('confirm:music')).toBeNull();
    expect(parsePayload('')).toBeNull();
    expect(parsePayload(null)).toBeNull();
    expect(parsePayload(undefined)).toBeNull();
  });
});

describe('isOptOutMessage', () => {
  it('detects opt-out keywords', () => {
    expect(isOptOutMessage('BAJA')).toBe(true);
    expect(isOptOutMessage('baja')).toBe(true);
    expect(isOptOutMessage('Quiero darme de baja por favor')).toBe(true);
    expect(isOptOutMessage('STOP')).toBe(true);
    expect(isOptOutMessage('No enviar más')).toBe(true);
    expect(isOptOutMessage('no enviar mas')).toBe(true);
    expect(isOptOutMessage('no quiero recibir estos mensajes')).toBe(true);
  });

  it('does NOT trigger on ordinary words containing keywords', () => {
    expect(isOptOutMessage('Trabaja hasta tarde, llego al ensayo')).toBe(false);
    expect(isOptOutMessage('La rebaja del arriendo')).toBe(false);
    expect(isOptOutMessage('Nos vemos en la bajada del cerro')).toBe(false);
    expect(isOptOutMessage('imparable')).toBe(false);
  });

  it('ignores empty / null input', () => {
    expect(isOptOutMessage('')).toBe(false);
    expect(isOptOutMessage(null)).toBe(false);
    expect(isOptOutMessage(undefined)).toBe(false);
  });

  it('handles diacritics and casing', () => {
    expect(isOptOutMessage('NO ENVIAR MÁS')).toBe(true);
    expect(isOptOutMessage('  Baja  ')).toBe(true);
  });
});
