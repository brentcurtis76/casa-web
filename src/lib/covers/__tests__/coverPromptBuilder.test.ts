import { describe, expect, it } from 'vitest';
import {
  buildLiturgyCoverPrompt,
  buildLiturgyReflectionCoverPrompt,
  buildSermonCoverPrompt,
} from '@/lib/covers/coverPromptBuilder';

describe('buildLiturgyCoverPrompt', () => {
  it('includes the title and season in the JSON specification', () => {
    const prompt = buildLiturgyCoverPrompt({
      title: 'Segundo Domingo de Pascua',
      season: 'Tiempo Pascual',
    });
    expect(prompt).toContain('Segundo Domingo de Pascua');
    expect(prompt).toContain('TIEMPO PASCUAL');
    expect(prompt).toContain('4:3');
  });

  it('uses illustrationTheme override when provided', () => {
    const prompt = buildLiturgyCoverPrompt({
      title: 'Culto Dominical',
      season: 'Tiempo Ordinario',
      illustrationTheme: 'fishermen in a storm-tossed boat',
    });
    expect(prompt).toContain('fishermen in a storm-tossed boat');
    // Default season-derived subject should NOT be used when override is present.
    expect(prompt).not.toContain('Contemplative scene evoking the Tiempo Ordinario');
  });

  it('falls back to season-derived subject when illustrationTheme is whitespace-only', () => {
    const prompt = buildLiturgyCoverPrompt({
      title: 'Culto',
      season: 'Adviento',
      illustrationTheme: '   ',
    });
    expect(prompt).toContain('Contemplative scene evoking the Adviento');
  });
});

describe('buildSermonCoverPrompt', () => {
  it('includes the title and preacher in the JSON specification', () => {
    const prompt = buildSermonCoverPrompt({
      title: 'La Oveja Perdida',
      preacher: 'Padre Juan',
    });
    expect(prompt).toContain('La Oveja Perdida');
    expect(prompt).toContain('Padre Juan');
  });

  it('uses illustrationTheme override when provided', () => {
    const prompt = buildSermonCoverPrompt({
      title: 'Parable of the Sower',
      preacher: 'Rev María',
      illustrationTheme: 'walk to Emmaus at sunset',
    });
    expect(prompt).toContain('walk to Emmaus at sunset');
    expect(prompt).not.toContain('Abstract, contemplative scene evoking the theme of "Parable of the Sower"');
  });
});

describe('buildLiturgyReflectionCoverPrompt preacher sanitization', () => {
  it('preserves Spanish accented names', () => {
    const prompt = buildLiturgyReflectionCoverPrompt({ preacher: 'María José Núñez' });
    expect(prompt).toContain('María José Núñez');
  });

  it('strips straight and smart quotes', () => {
    const prompt = buildLiturgyReflectionCoverPrompt({
      preacher: 'Juan "El Predicador" \u201cApodo\u201d',
    });
    expect(prompt).toContain('Juan El Predicador Apodo');
    expect(prompt).not.toContain('"El Predicador"');
    expect(prompt).not.toContain('\u201cApodo\u201d');
  });

  it('strips backticks, parentheses, and newlines from the preacher value', () => {
    const prompt = buildLiturgyReflectionCoverPrompt({
      preacher: 'Pastor `Juan` (invitado)\nreader',
    });
    // Sanitized name appears clean in the rendered Subtitle line.
    expect(prompt).toContain('Subtitle: "Pastor Juan invitado reader"');
    // The raw characters from the preacher string must not survive — the
    // template itself does contain parentheses, so assert on the sanitized
    // substring rather than the whole prompt.
    expect(prompt).not.toContain('`Juan`');
    expect(prompt).not.toContain('(invitado)');
  });

  it('produces the "none" subtitle branch when preacher is empty after sanitization', () => {
    const prompt = buildLiturgyReflectionCoverPrompt({ preacher: '   ' });
    expect(prompt).toContain('Subtitle: none');
    expect(prompt).not.toMatch(/Subtitle:\s*"/);
  });

  it('always pins 4:3 aspect ratio in the recomposition prompt', () => {
    const prompt = buildLiturgyReflectionCoverPrompt({ preacher: 'Test' });
    expect(prompt).toContain('4:3');
  });
});
