/**
 * slug — normalización pura. No toca Supabase: aquí no se prueba la unicidad ni el
 * fallback, que son de la base (D23). Se prueba lo único que es de TS: la derivación
 * y el truncado en frontera de palabra.
 */

import { describe, it, expect } from 'vitest';
import { slugify, SLUG_MAX_LENGTH } from '@/lib/sermon-editor/slug';

describe('slugify', () => {
  it.each([
    ['acentos y eñes', 'Reflexión sobre el Señor', 'reflexion-sobre-el-senor'],
    ['mayúsculas', 'MATEO CINCO', 'mateo-cinco'],
    ['símbolos y puntuación', '¿Quién es mi prójimo? — Lucas 10:29', 'quien-es-mi-projimo-lucas-10-29'],
    ['diéresis y cedilla', 'Pingüino Français', 'pinguino-francais'],
    ['espacios repetidos y extremos', '   Domingo   de   Ramos   ', 'domingo-de-ramos'],
    ['cadena vacía', '', ''],
    ['sólo símbolos', '¡¿—…!!', ''],
    ['sólo espacios', '   ', ''],
  ])('%s', (_caso, entrada, esperado) => {
    expect(slugify(entrada)).toBe(esperado);
  });

  it('deja intacta una base de exactamente 80 caracteres', () => {
    const base = 'abcdefghij-'.repeat(7) + 'abc';
    expect(base).toHaveLength(SLUG_MAX_LENGTH);
    expect(slugify(base)).toBe(base);
  });

  it('trunca en la frontera de palabra, no a mitad', () => {
    // 88 caracteres: el último `-` dentro del presupuesto de 80 está en la posición 78.
    const largo = 'palabra-'.repeat(11);
    expect(largo.length).toBeGreaterThan(SLUG_MAX_LENGTH);

    const resultado = slugify(largo);

    expect(resultado.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(resultado.endsWith('-')).toBe(false);
    expect(resultado).toBe('palabra-'.repeat(9) + 'palabra');
  });

  it('corta en duro cuando no hay ningún `-` dentro del presupuesto', () => {
    const sinGuiones = 'a'.repeat(100);
    expect(slugify(sinGuiones)).toBe('a'.repeat(SLUG_MAX_LENGTH));
  });

  it('respeta un presupuesto menor — es lo que usa el sufijo de la base', () => {
    expect(slugify('uno-dos-tres-cuatro', 12)).toBe('uno-dos');
  });

  it('no deja nunca `-` en los extremos', () => {
    for (const entrada of ['—hola—', '...prueba...', '2026-', '-2026']) {
      const resultado = slugify(entrada);
      expect(resultado.startsWith('-')).toBe(false);
      expect(resultado.endsWith('-')).toBe(false);
    }
  });
});
