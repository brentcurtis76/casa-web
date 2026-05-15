import { describe, it, expect } from 'vitest';
import { parseMaterials, serializeMaterials } from '../parseMaterials';

describe('serializeMaterials', () => {
  it('joins with newlines', () => {
    expect(serializeMaterials(['papel', 'lápices'])).toBe('papel\nlápices');
  });

  it('returns null for empty input', () => {
    expect(serializeMaterials([])).toBeNull();
    expect(serializeMaterials(['  ', ''])).toBeNull();
  });

  it('trims and drops empty entries', () => {
    expect(serializeMaterials(['  papel  ', '', '  lápices'])).toBe('papel\nlápices');
  });

  it('preserves commas inside items', () => {
    const out = serializeMaterials(['papel (rojo, azul)', 'tijeras']);
    expect(out).toBe('papel (rojo, azul)\ntijeras');
    expect(parseMaterials(out)).toEqual(['papel (rojo, azul)', 'tijeras']);
  });
});

describe('parseMaterials', () => {
  it('returns [] for null/undefined/empty', () => {
    expect(parseMaterials(null)).toEqual([]);
    expect(parseMaterials(undefined)).toEqual([]);
    expect(parseMaterials('')).toEqual([]);
  });

  it('splits newline-delimited values (including \\r\\n)', () => {
    expect(parseMaterials('papel\nlápices\ntijeras')).toEqual(['papel', 'lápices', 'tijeras']);
    expect(parseMaterials('papel\r\nlápices')).toEqual(['papel', 'lápices']);
  });

  it('parses legacy comma-joined values', () => {
    expect(parseMaterials('papel, lápices, tijeras')).toEqual(['papel', 'lápices', 'tijeras']);
  });

  it('keeps commas inside parentheses for legacy values', () => {
    expect(parseMaterials('papel (rojo, azul), tijeras, cinta (verde, blanca)')).toEqual([
      'papel (rojo, azul)',
      'tijeras',
      'cinta (verde, blanca)',
    ]);
  });

  it('handles nested parentheses in legacy values', () => {
    expect(parseMaterials('item (a, (b, c)), other')).toEqual(['item (a, (b, c))', 'other']);
  });

  it('trims whitespace and drops empty items', () => {
    expect(parseMaterials('  papel  ,  , lápices ,')).toEqual(['papel', 'lápices']);
    expect(parseMaterials('papel\n\n  \nlápices')).toEqual(['papel', 'lápices']);
  });

  it('prefers newline split when both delimiters appear', () => {
    expect(parseMaterials('papel (rojo, azul)\ntijeras')).toEqual([
      'papel (rojo, azul)',
      'tijeras',
    ]);
  });

  it('keeps a long parenthesized color list intact in both formats (regression)', () => {
    const item =
      'Temperas o pinturas acrílicas de colores (rojo, amarillo, azul, verde, naranja, morado)';
    const otherItems = ['Pinceles', 'Cartulinas blancas grandes', 'Vasos plásticos para agua'];

    // New-format storage: newline-delimited (what serializeMaterials produces)
    const newFormat = [item, ...otherItems].join('\n');
    expect(parseMaterials(newFormat)).toEqual([item, ...otherItems]);

    // Legacy storage: comma-joined — parenthesized commas must stay together
    const legacyFormat = [item, ...otherItems].join(', ');
    expect(parseMaterials(legacyFormat)).toEqual([item, ...otherItems]);
  });
});
