/**
 * Bolls.life withdrew some translations (NVI, at Biblica's request) but still
 * answers those requests with a notice in place of every verse. Treat that
 * notice as "no text" so the UI falls back to pasting the passage by hand.
 */
const WITHDRAWN_TRANSLATION_MARKERS = ['Biblica, Inc.'];

export function isWithdrawnBibleText(text: string | null | undefined): boolean {
  if (!text) return false;
  return WITHDRAWN_TRANSLATION_MARKERS.some((marker) => text.includes(marker));
}
