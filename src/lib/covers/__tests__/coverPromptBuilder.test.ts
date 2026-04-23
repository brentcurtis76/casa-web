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

  it('instructs Gemini to render the logo small (4-6% of canvas width)', () => {
    const prompt = buildLiturgyCoverPrompt({
      title: 'Culto',
      season: 'Adviento',
    });
    expect(prompt).toContain('4-6% of the canvas width');
    expect(prompt).toMatch(/SMALL and understated/);
    expect(prompt).not.toContain('8-12% of the canvas width');
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

  it('sanitizes preacher name consistently with the reflection path', () => {
    // The reflection-cover path strips smart quotes, backticks, parens, etc.
    // The sermon-cover path now applies the same allowlist for consistency.
    const prompt = buildSermonCoverPrompt({
      title: 'La Oveja Perdida',
      preacher: 'Pastor `Juan` (invitado) "Apodo"',
    });
    expect(prompt).toContain('Pastor Juan invitado Apodo');
    expect(prompt).not.toContain('`Juan`');
    expect(prompt).not.toContain('(invitado)');
    expect(prompt).not.toContain('"Apodo"');
  });
});

describe('buildLiturgyReflectionCoverPrompt', () => {
  it('uses the liturgy title as the hero (not the word "Reflexión")', () => {
    const prompt = buildLiturgyReflectionCoverPrompt({
      title: 'Mi Copa Rebosa',
      preacher: 'Brent Curtis',
    });
    expect(prompt).toContain('Title: "Mi Copa Rebosa"');
    // Older template rendered "Reflexión" as the title — verify we no
    // longer emit that string as the hero line.
    expect(prompt).not.toContain('Title: "Reflexión"');
  });

  it('explicitly forbids Gemini from rendering the word "Reflexión" on the image', () => {
    const prompt = buildLiturgyReflectionCoverPrompt({
      title: 'Mi Copa Rebosa',
      preacher: 'Brent Curtis',
    });
    // The negative instruction has to be explicit — Gemini tends to add
    // section labels like "Reflexión" when recomposing a religious cover.
    expect(prompt).toMatch(/MUST NOT appear/);
    expect(prompt).toContain('"Reflexión"');
    expect(prompt).toContain('"Reflection"');
    expect(prompt).toContain('"Sermón"');
  });

  it('instructs Gemini to preserve the small logo size from the reference', () => {
    const prompt = buildLiturgyReflectionCoverPrompt({
      title: 'Culto',
      preacher: 'Padre Juan',
    });
    expect(prompt).toMatch(/same small size/i);
    expect(prompt).toMatch(/do not enlarge it/i);
  });

  it('explicitly instructs the subtitle to be distinctly smaller than the title', () => {
    const prompt = buildLiturgyReflectionCoverPrompt({
      title: 'Culto',
      preacher: 'Padre Juan',
    });
    expect(prompt).toContain('DISTINCTLY SMALLER than the title');
    expect(prompt).toMatch(/40-50%/);
  });

  it('emphasizes exact background hex to stop Gemini drifting between variations', () => {
    const prompt = buildLiturgyReflectionCoverPrompt({ title: 'Test', preacher: 'X' });
    expect(prompt).toContain('#F7F7F7');
    expect(prompt).toMatch(/flat uniform fill/i);
  });

  it('preserves Spanish accented preacher names', () => {
    const prompt = buildLiturgyReflectionCoverPrompt({
      title: 'Culto',
      preacher: 'María José Núñez',
    });
    expect(prompt).toContain('María José Núñez');
  });

  it('strips straight and smart quotes from the preacher', () => {
    const prompt = buildLiturgyReflectionCoverPrompt({
      title: 'Culto',
      preacher: 'Juan "El Predicador" \u201cApodo\u201d',
    });
    expect(prompt).toContain('Juan El Predicador Apodo');
    expect(prompt).not.toContain('"El Predicador"');
    expect(prompt).not.toContain('\u201cApodo\u201d');
  });

  it('strips backticks, parentheses, and newlines from the preacher value', () => {
    const prompt = buildLiturgyReflectionCoverPrompt({
      title: 'Culto',
      preacher: 'Pastor `Juan` (invitado)\nreader',
    });
    expect(prompt).toContain('Subtitle: "Pastor Juan invitado reader"');
    expect(prompt).not.toContain('`Juan`');
    expect(prompt).not.toContain('(invitado)');
  });

  it('strips double quotes from the title so the plaintext template stays valid', () => {
    const prompt = buildLiturgyReflectionCoverPrompt({
      title: 'La "Gran" Comunión',
      preacher: 'Rev',
    });
    expect(prompt).toContain('Title: "La Gran Comunión"');
    expect(prompt).not.toContain('"Gran"');
  });

  it('falls back to a subtitle-less template when preacher is empty', () => {
    const prompt = buildLiturgyReflectionCoverPrompt({
      title: 'Culto',
      preacher: '   ',
    });
    expect(prompt).toContain('Subtitle: none');
    expect(prompt).not.toMatch(/Subtitle:\s*"/);
  });

  it('always pins 4:3 aspect ratio in the recomposition prompt', () => {
    const prompt = buildLiturgyReflectionCoverPrompt({ title: 'Test', preacher: 'X' });
    expect(prompt).toContain('4:3');
  });
});
