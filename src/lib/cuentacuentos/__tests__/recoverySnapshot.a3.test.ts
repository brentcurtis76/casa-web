/**
 * A3a/S2 — recoverySnapshot pure invariants.
 *
 * Covers subtask items 5, 6, and 11:
 *  - Item 5:  restoreEditorStateV1.currentStep is `null` when the raw
 *             snapshot lacks (or has an invalid) `currentStep` — the caller
 *             is responsible for falling back to `data.current_step`.
 *  - Item 6:  scrubImageRefsDeep is field-aware, not length-based. Long
 *             narrative fields (title, summary, description, prompts,
 *             scene.text, spiritualConnection) survive verbatim regardless
 *             of length. Only values under known image-reference keys are
 *             validated against `isNonPathImageString`.
 *  - Item 11: sibling of item 5 — the DB dedicated-column fallback in the
 *             hook depends on this shape. Tested indirectly here via the
 *             restore contract and directly in the hook test.
 */

import { describe, it, expect } from 'vitest';
import {
  restoreEditorStateV1,
  scrubImageRefsDeep,
  isNonPathImageString,
} from '../recoverySnapshot';

describe('restoreEditorStateV1 — currentStep discrimination (A3a/S2 item 5)', () => {
  it('valid explicit step: passes through as-is', () => {
    const out = restoreEditorStateV1({
      version: 1,
      selections: {},
      currentStep: 'scenes',
    });
    expect(out.currentStep).toBe('scenes');
  });

  it('raw envelope invalid (no version): returns null step (default caller-supplied)', () => {
    const out = restoreEditorStateV1({ currentStep: 'scenes' });
    // envelope is invalid → whole snapshot rejected → currentStep=null
    expect(out.currentStep).toBeNull();
  });

  it('valid envelope but currentStep missing: returns null (never silently defaults to config)', () => {
    const out = restoreEditorStateV1({ version: 1, selections: {} });
    expect(out.currentStep).toBeNull();
  });

  it('valid envelope but currentStep is an invalid value: returns null', () => {
    const out = restoreEditorStateV1({
      version: 1,
      selections: {},
      currentStep: 'not-a-step',
    });
    expect(out.currentStep).toBeNull();
  });
});

describe('scrubImageRefsDeep — field-aware, length-safe (A3a/S2 item 6)', () => {
  it('preserves long narrative text (>512 chars) in non-image fields', () => {
    const longText = 'a'.repeat(2048);
    const longSummary = 'Sum: '.repeat(400); // ~2000 chars
    const longTitle = 'Titulo largo '.repeat(80);
    const longDescription = 'Descripción '.repeat(120);
    const longPrompt = 'Prompt line. '.repeat(200);

    const input = {
      title: longTitle,
      summary: longSummary,
      spiritualConnection: longText,
      scenes: [
        { number: 1, text: longText, prompt: longPrompt, description: longDescription },
      ],
      characters: [
        { id: 'c1', name: longTitle, description: longDescription, notes: longText },
      ],
      coverPrompt: longPrompt,
      endPrompt: longPrompt,
      // Not an image field name — must survive even at any length.
      customNotes: longText,
    };

    const out = scrubImageRefsDeep(input);
    expect(out.title).toBe(longTitle);
    expect(out.summary).toBe(longSummary);
    expect(out.spiritualConnection).toBe(longText);
    expect(out.scenes[0].text).toBe(longText);
    expect(out.scenes[0].prompt).toBe(longPrompt);
    expect(out.scenes[0].description).toBe(longDescription);
    expect(out.characters[0].name).toBe(longTitle);
    expect(out.characters[0].description).toBe(longDescription);
    expect(out.characters[0].notes).toBe(longText);
    expect(out.coverPrompt).toBe(longPrompt);
    expect(out.endPrompt).toBe(longPrompt);
    expect(out.customNotes).toBe(longText);
  });

  it('drops data: URLs under known image-reference fields', () => {
    const input = {
      characters: [
        {
          id: 'c1',
          characterSheetUrl: 'data:image/png;base64,AAAA',
          referenceImages: [
            'data:image/png;base64,BBBB',
            'https://cdn/keep.png',
            'u1/lit-1/kind/keep.png',
          ],
          selectedReferenceUrl: 'data:image/png;base64,CCCC',
        },
      ],
      scenes: [
        {
          number: 1,
          imageOptions: ['data:image/png;base64,DDDD', 'https://cdn/keep.png'],
          selectedImageUrl: 'data:image/png;base64,EEEE',
          imageUrl: 'data:image/png;base64,FFFF',
          text: 'This is scene narrative — must survive.',
        },
      ],
      coverImageUrl: 'data:image/png;base64,GGGG',
      coverImageOptions: ['data:image/png;base64,HHHH'],
      endImageUrl: 'https://cdn/end.png',
      endImageOptions: ['https://cdn/end-0.png'],
    };

    const out = scrubImageRefsDeep(input);
    // Data URLs dropped from image fields.
    expect(out.characters[0].characterSheetUrl).toBeUndefined();
    expect(out.characters[0].selectedReferenceUrl).toBeUndefined();
    expect(out.characters[0].referenceImages).toEqual([
      'https://cdn/keep.png',
      'u1/lit-1/kind/keep.png',
    ]);
    expect(out.scenes[0].imageOptions).toEqual(['https://cdn/keep.png']);
    expect(out.scenes[0].selectedImageUrl).toBeUndefined();
    expect(out.scenes[0].imageUrl).toBeUndefined();
    expect(out.coverImageUrl).toBeUndefined();
    expect(out.coverImageOptions).toEqual([]);
    expect(out.endImageUrl).toBe('https://cdn/end.png');
    expect(out.endImageOptions).toEqual(['https://cdn/end-0.png']);
    // Narrative text under scene.text must survive.
    expect(out.scenes[0].text).toBe('This is scene narrative — must survive.');
    // Serialized story JSON must not contain any `data:image` fragments.
    expect(JSON.stringify(out).includes('data:image')).toBe(false);
  });

  it('long non-base64 strings under image fields are kept (path-shaped, only base64 blobs drop)', () => {
    const longPathish = 'u1/lit-1/kind/' + 'x'.repeat(600); // long but not base64-only
    const out = scrubImageRefsDeep({
      coverImageUrl: longPathish,
    });
    // Not base64 charset → survives even at length > 512.
    expect(out.coverImageUrl).toBe(longPathish);
  });
});

describe('isNonPathImageString — image-specific validator (A3a/S2 item 6)', () => {
  it('rejects data URLs', () => {
    expect(isNonPathImageString('data:image/png;base64,AAAA')).toBe(true);
  });

  it('accepts HTTP(S) URLs regardless of length', () => {
    expect(isNonPathImageString('https://cdn/img.png')).toBe(false);
    expect(isNonPathImageString('http://cdn/' + 'x'.repeat(1000))).toBe(false);
  });

  it('accepts short storage paths', () => {
    expect(isNonPathImageString('u1/lit-1/scenes/scene1_0.png')).toBe(false);
  });

  it('accepts long non-base64 narrative even without HTTP scheme', () => {
    const longText = 'This is a long text with spaces, punctuation, and ñ. ' .repeat(20);
    expect(longText.length).toBeGreaterThan(512);
    expect(isNonPathImageString(longText)).toBe(false);
  });

  it('rejects long base64-alphabet-only blobs without HTTP scheme', () => {
    const b64 = 'A'.repeat(600);
    expect(isNonPathImageString(b64)).toBe(true);
  });
});
