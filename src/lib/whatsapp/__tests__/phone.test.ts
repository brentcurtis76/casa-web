import { describe, it, expect } from 'vitest';
import { normalizeChilePhone } from '../phone';

describe('normalizeChilePhone', () => {
  it('accepts full E.164 with plus and spaces', () => {
    const r = normalizeChilePhone('+56 9 1234 5678');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.e164).toBe('56912345678');
      expect(r.display).toBe('+56 9 1234 5678');
    }
  });

  it('accepts digits with country code, no plus', () => {
    const r = normalizeChilePhone('56912345678');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.e164).toBe('56912345678');
  });

  it('accepts local mobile starting with 9', () => {
    const r = normalizeChilePhone('912345678');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.e164).toBe('56912345678');
  });

  it('accepts dashes and parentheses', () => {
    const r = normalizeChilePhone('(+56) 9-1234-5678');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.e164).toBe('56912345678');
  });

  it('rejects Chilean landlines (56 2 ...)', () => {
    const r = normalizeChilePhone('56212345678');
    expect(r.ok).toBe(false);
  });

  it('rejects 8-digit numbers missing the mobile 9 prefix', () => {
    const r = normalizeChilePhone('12345678');
    expect(r.ok).toBe(false);
  });

  it('rejects empty / null / garbage input', () => {
    expect(normalizeChilePhone('').ok).toBe(false);
    expect(normalizeChilePhone(null).ok).toBe(false);
    expect(normalizeChilePhone(undefined).ok).toBe(false);
    expect(normalizeChilePhone('sin numero').ok).toBe(false);
  });

  it('rejects foreign numbers', () => {
    expect(normalizeChilePhone('+1 555 123 4567').ok).toBe(false);
    expect(normalizeChilePhone('+54 9 11 1234 5678').ok).toBe(false);
  });
});
