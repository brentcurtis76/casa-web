-- ============================================
-- Migration: Add presentation_styles column to liturgias table
-- Date: 2026-01-21
-- Description: Store permanent presentation style overrides for liturgies
-- Phase 1.6: Presentation Persistence - Save to Liturgy
-- ============================================

-- Add presentation_styles column to liturgias table
-- This stores permanent style overrides saved from the presenter view
ALTER TABLE liturgias ADD COLUMN IF NOT EXISTS presentation_styles JSONB DEFAULT NULL;

-- Structure of presentation_styles:
-- {
--   "globalStyles": {
--     "font": { family, size, color, bold, italic, align },
--     "textBackground": { style, color, opacity, padding },
--     "slideBackground": { overlayOpacity, color, gradient }
--   },
--   "elementStyles": { "element-id-1": {...}, ... },
--   "slideStyles": { "slide-id-1": {...}, ... },
--   "logoState": { settings: {...}, scope: {...} },
--   "textOverlayState": { overlays: [...] }
-- }

-- Comment for documentation
COMMENT ON COLUMN liturgias.presentation_styles IS 'Permanent presentation style overrides saved from presenter view. Contains globalStyles, elementStyles, slideStyles, logoState, and textOverlayState.';
