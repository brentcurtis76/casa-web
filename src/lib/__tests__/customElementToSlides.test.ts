import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomElementConfig } from '@/types/shared/liturgy';
import {
  customImageSlideToSlides,
  customTitleSlideToSlides,
  customCallResponseToSlides,
  customTextSlideToSlides,
  customBlankSlideToSlides,
  customElementToSlides,
} from '@/lib/customElementToSlides';

vi.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

/** Helper to build a minimal config for a given subtype */
function makeConfig(
  overrides: Partial<CustomElementConfig> & Pick<CustomElementConfig, 'customType'>
): CustomElementConfig {
  return { label: 'Test Element', ...overrides };
}

describe('customImageSlideToSlides', () => {
  it('produces a custom SlideGroup with a custom-image slide', () => {
    const config = makeConfig({
      customType: 'image-slide',
      title: 'Imagen Titulo',
      subtitle: 'Subtitulo',
      imageUrl: 'https://example.com/img.jpg',
    });

    const group = customImageSlideToSlides(config);

    expect(group.type).toBe('custom');
    expect(group.title).toBe('Test Element');
    expect(group.slides).toHaveLength(1);

    const slide = group.slides[0];
    expect(slide.type).toBe('custom-image');
    expect(slide.content.primary).toBe('Imagen Titulo');
    expect(slide.content.subtitle).toBe('Subtitulo');
    expect(slide.content.imageUrl).toBe('https://example.com/img.jpg');
    expect(slide.metadata.sourceComponent).toBe('custom-element');
    expect(slide.metadata.order).toBe(1);
    expect(slide.metadata.groupTotal).toBe(1);
  });

  it('uses empty string when title is undefined', () => {
    const config = makeConfig({ customType: 'image-slide' });
    const group = customImageSlideToSlides(config);
    expect(group.slides[0].content.primary).toBe('');
  });

  it('applies dark theme styles when specified', () => {
    const config = makeConfig({ customType: 'image-slide', title: 'Dark' });
    const group = customImageSlideToSlides(config, { theme: 'dark' });
    // Dark theme has white primary text (#F7F7F7)
    expect(group.slides[0].style.primaryColor).toBe('#F7F7F7');
  });
});

describe('customTitleSlideToSlides', () => {
  it('produces a custom SlideGroup with a title slide', () => {
    const config = makeConfig({
      customType: 'title-slide',
      titleText: 'Heading',
      subtitleText: 'Subheading',
    });

    const group = customTitleSlideToSlides(config);

    expect(group.type).toBe('custom');
    expect(group.slides).toHaveLength(1);

    const slide = group.slides[0];
    expect(slide.type).toBe('title');
    expect(slide.content.primary).toBe('Heading');
    expect(slide.content.subtitle).toBe('Subheading');
  });

  it('uses empty string when titleText is undefined', () => {
    const config = makeConfig({ customType: 'title-slide' });
    const group = customTitleSlideToSlides(config);
    expect(group.slides[0].content.primary).toBe('');
  });
});

describe('customCallResponseToSlides', () => {
  it('produces title slide + prayer-full slides for each tiempo', () => {
    const config = makeConfig({
      customType: 'call-response',
      tiempos: [
        { lider: 'Líder 1', congregacion: 'Pueblo 1' },
        { lider: 'Líder 2', congregacion: 'Pueblo 2' },
      ],
    });

    const group = customCallResponseToSlides(config);

    expect(group.type).toBe('custom');
    expect(group.slides).toHaveLength(3); // 1 title + 2 tiempos

    // Title slide
    expect(group.slides[0].type).toBe('title');
    expect(group.slides[0].content.primary).toBe('Test Element');
    expect(group.slides[0].metadata.order).toBe(1);
    expect(group.slides[0].metadata.groupTotal).toBe(3);

    // First tiempo
    expect(group.slides[1].type).toBe('prayer-full');
    expect(group.slides[1].content.primary).toBe('Líder 1');
    expect(group.slides[1].content.secondary).toBe('Pueblo 1');
    expect(group.slides[1].metadata.order).toBe(2);

    // Second tiempo
    expect(group.slides[2].type).toBe('prayer-full');
    expect(group.slides[2].content.primary).toBe('Líder 2');
    expect(group.slides[2].content.secondary).toBe('Pueblo 2');
    expect(group.slides[2].metadata.order).toBe(3);
  });

  it('produces only a title slide when tiempos is empty', () => {
    const config = makeConfig({ customType: 'call-response', tiempos: [] });
    const group = customCallResponseToSlides(config);
    expect(group.slides).toHaveLength(1);
    expect(group.slides[0].type).toBe('title');
    expect(group.slides[0].metadata.groupTotal).toBe(1);
  });

  it('produces only a title slide when tiempos is undefined', () => {
    const config = makeConfig({ customType: 'call-response' });
    const group = customCallResponseToSlides(config);
    expect(group.slides).toHaveLength(1);
  });
});

describe('customTextSlideToSlides', () => {
  it('produces a custom SlideGroup with a custom-text slide', () => {
    const config = makeConfig({
      customType: 'text-slide',
      bodyText: 'Paragraph content here',
      title: 'Section Header',
    });

    const group = customTextSlideToSlides(config);

    expect(group.type).toBe('custom');
    expect(group.slides).toHaveLength(1);

    const slide = group.slides[0];
    expect(slide.type).toBe('custom-text');
    expect(slide.content.primary).toBe('Paragraph content here');
    expect(slide.content.subtitle).toBe('Section Header');
  });

  it('uses empty string when bodyText is undefined', () => {
    const config = makeConfig({ customType: 'text-slide' });
    const group = customTextSlideToSlides(config);
    expect(group.slides[0].content.primary).toBe('');
  });
});

describe('customBlankSlideToSlides', () => {
  it('produces a custom SlideGroup with a blank slide', () => {
    const config = makeConfig({
      customType: 'blank-slide',
      backgroundColor: '#FF0000',
    });

    const group = customBlankSlideToSlides(config);

    expect(group.type).toBe('custom');
    expect(group.slides).toHaveLength(1);

    const slide = group.slides[0];
    expect(slide.type).toBe('blank');
    expect(slide.content.primary).toBe('');
    expect(slide.style.backgroundColor).toBe('#FF0000');
  });

  it('falls back to theme background when backgroundColor is undefined', () => {
    const config = makeConfig({ customType: 'blank-slide' });
    const group = customBlankSlideToSlides(config);
    // Default (light) theme background
    expect(group.slides[0].style.backgroundColor).toBeDefined();
    expect(group.slides[0].style.backgroundColor).not.toBe('');
  });
});

describe('customElementToSlides dispatcher', () => {
  it('dispatches image-slide to customImageSlideToSlides', () => {
    const config = makeConfig({ customType: 'image-slide', title: 'Img' });
    const group = customElementToSlides(config);
    expect(group.slides[0].type).toBe('custom-image');
  });

  it('dispatches title-slide to customTitleSlideToSlides', () => {
    const config = makeConfig({ customType: 'title-slide', titleText: 'T' });
    const group = customElementToSlides(config);
    expect(group.slides[0].type).toBe('title');
  });

  it('dispatches call-response to customCallResponseToSlides', () => {
    const config = makeConfig({
      customType: 'call-response',
      tiempos: [{ lider: 'L', congregacion: 'C' }],
    });
    const group = customElementToSlides(config);
    expect(group.slides).toHaveLength(2); // title + 1 tiempo
  });

  it('dispatches text-slide to customTextSlideToSlides', () => {
    const config = makeConfig({ customType: 'text-slide', bodyText: 'B' });
    const group = customElementToSlides(config);
    expect(group.slides[0].type).toBe('custom-text');
  });

  it('dispatches blank-slide to customBlankSlideToSlides', () => {
    const config = makeConfig({ customType: 'blank-slide' });
    const group = customElementToSlides(config);
    expect(group.slides[0].type).toBe('blank');
  });

  /**
   * Verifies the default fallback for unknown customType values.
   * If a new CustomElementSubtype is added but not handled in the switch,
   * this test ensures it degrades gracefully to a blank slide.
   * When adding new subtypes, update the dispatcher switch — don't rely on this fallback.
   */
  it('falls back to blank slide for unknown customType', () => {
    const config = makeConfig({
      customType: 'nonexistent-type' as CustomElementConfig['customType'],
      label: 'Unknown',
    });
    const group = customElementToSlides(config);
    expect(group.slides).toHaveLength(1);
    expect(group.slides[0].type).toBe('blank');
    expect(group.title).toBe('Unknown');
  });

  it('passes theme option through to converters', () => {
    const config = makeConfig({ customType: 'text-slide', bodyText: 'X' });
    const group = customElementToSlides(config, { theme: 'dark' });
    // Dark theme announcement style uses secondary text color
    expect(group.slides[0].style.primaryColor).toBeDefined();
  });
});
