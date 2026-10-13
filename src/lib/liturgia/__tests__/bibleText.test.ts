import { describe, it, expect } from 'vitest';
import { isWithdrawnBibleText } from '../bibleText';

describe('isWithdrawnBibleText', () => {
  it('detects the Bolls.life notice that replaces withdrawn translations', () => {
    expect(
      isWithdrawnBibleText('3 Biblica, Inc. me prohibió usar la traducción NIV; han elegido...')
    ).toBe(true);
  });

  it('accepts real passage text', () => {
    expect(
      isWithdrawnBibleText('16 Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito')
    ).toBe(false);
  });

  it('treats empty text as not withdrawn', () => {
    expect(isWithdrawnBibleText('')).toBe(false);
    expect(isWithdrawnBibleText(undefined)).toBe(false);
  });
});
