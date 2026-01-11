/**
 * TextOverlayControls - Panel de control de text overlays en PresenterView
 * Permite agregar, editar, eliminar y gestionar visibilidad de overlays
 * Soporta modo compact para uso dentro de CollapsiblePanel
 */

import React, { useState } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  ChevronDown,
  ChevronUp,
  Type,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Globe,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { TextOverlayEditor } from './TextOverlayEditor';
import type { TextOverlay, TextOverlayState, TextOverlayStyle } from '@/lib/presentation/types';
import { getEffectiveTextOverlays } from '@/lib/presentation/types';

interface TextOverlayControlsProps {
  textOverlayState: TextOverlayState;
  currentSlideIndex: number;
  onAdd: (content: string, position?: { x: number; y: number }, style?: Partial<TextOverlayStyle>) => void;
  onUpdate: (id: string, updates: Partial<TextOverlay>) => void;
  onRemove: (id: string) => void;
  onSetOverride: (slideIndex: number, overlayId: string, override: Partial<TextOverlay>) => void;
  onRemoveOverride: (slideIndex: number, overlayId: string) => void;
  onClearOverrides: (slideIndex: number) => void;
  /** When true, renders without header/expand (for use inside CollapsiblePanel) */
  compact?: boolean;
}

export const TextOverlayControls: React.FC<TextOverlayControlsProps> = ({
  textOverlayState,
  currentSlideIndex,
  onAdd,
  onUpdate,
  onRemove,
  onSetOverride,
  onRemoveOverride,
  onClearOverrides,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingOverlay, setEditingOverlay] = useState<TextOverlay | null>(null);

  // Get effective overlays for current slide
  const effectiveOverlays = getEffectiveTextOverlays(textOverlayState, currentSlideIndex);

  // Check if current slide has overrides
  const slideHasOverrides = currentSlideIndex in textOverlayState.overrides;

  // Check if a specific overlay has override on current slide
  const hasOverrideFor = (overlayId: string): boolean => {
    const overrides = textOverlayState.overrides[currentSlideIndex];
    return overrides?.some((o) => o.id === overlayId) ?? false;
  };

  // Handle add new overlay
  const handleAddClick = () => {
    setEditingOverlay(null);
    setEditorOpen(true);
  };

  // Handle edit overlay
  const handleEditClick = (overlay: TextOverlay) => {
    setEditingOverlay(overlay);
    setEditorOpen(true);
  };

  // Handle save from editor
  const handleSave = (content: string, style: TextOverlayStyle) => {
    if (editingOverlay) {
      // Update existing
      onUpdate(editingOverlay.id, { content, style });
    } else {
      // Add new
      onAdd(content, { x: 50, y: 50 }, style);
    }
    setEditorOpen(false);
    setEditingOverlay(null);
  };

  // Handle visibility toggle
  const handleVisibilityToggle = (overlay: TextOverlay, visible: boolean) => {
    if (hasOverrideFor(overlay.id)) {
      // Update the override
      onSetOverride(currentSlideIndex, overlay.id, { visible });
    } else {
      // Update global
      onUpdate(overlay.id, { visible });
    }
  };

  // Handle create override for this slide
  const handleCreateOverride = (overlay: TextOverlay) => {
    onSetOverride(currentSlideIndex, overlay.id, {
      visible: overlay.visible,
      position: overlay.position,
    });
  };

  const content = (
    <div className="space-y-3">
          {/* Overlay list */}
          {effectiveOverlays.length === 0 ? (
            <p
              className="text-center py-4"
              style={{
                color: CASA_BRAND.colors.secondary.grayMedium,
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '13px',
              }}
            >
              No hay textos. Haz clic en "Agregar Texto" para crear uno.
            </p>
          ) : (
            <div className="space-y-2">
              {effectiveOverlays.map((overlay, index) => {
                const hasOverride = hasOverrideFor(overlay.id);
                const globalOverlay = textOverlayState.global.find((o) => o.id === overlay.id);

                return (
                  <div
                    key={overlay.id}
                    className="flex items-center gap-2 p-2 rounded"
                    style={{
                      backgroundColor: CASA_BRAND.colors.primary.black,
                      border: hasOverride
                        ? `1px solid ${CASA_BRAND.colors.primary.amber}40`
                        : `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
                    }}
                  >
                    {/* Drag handle */}
                    <GripVertical
                      size={14}
                      style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                      className="cursor-grab"
                    />

                    {/* Content preview */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="truncate"
                        style={{
                          color: overlay.visible
                            ? CASA_BRAND.colors.primary.white
                            : CASA_BRAND.colors.secondary.grayMedium,
                          fontFamily: CASA_BRAND.fonts.body,
                          fontSize: '13px',
                          opacity: overlay.visible ? 1 : 0.5,
                        }}
                      >
                        {overlay.content.substring(0, 30)}
                        {overlay.content.length > 30 ? '...' : ''}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {hasOverride ? (
                          <FileText
                            size={10}
                            style={{ color: CASA_BRAND.colors.primary.amber }}
                          />
                        ) : (
                          <Globe
                            size={10}
                            style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                          />
                        )}
                        <span
                          style={{
                            fontSize: '10px',
                            color: hasOverride
                              ? CASA_BRAND.colors.primary.amber
                              : CASA_BRAND.colors.secondary.grayMedium,
                          }}
                        >
                          {hasOverride ? 'Este slide' : 'Global'}
                        </span>
                      </div>
                    </div>

                    {/* Edit button */}
                    <button
                      onClick={() => handleEditClick(globalOverlay || overlay)}
                      className="p-1.5 rounded hover:bg-gray-700 transition-colors"
                      title="Editar"
                    >
                      <Pencil
                        size={14}
                        style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                      />
                    </button>

                    {/* Visibility toggle */}
                    <Switch
                      checked={overlay.visible}
                      onCheckedChange={(v) => handleVisibilityToggle(overlay, v)}
                      className="data-[state=checked]:bg-white data-[state=unchecked]:bg-gray-700"
                      thumbClassName="border-2 border-gray-400"
                    />

                    {/* Delete button */}
                    <button
                      onClick={() => onRemove(overlay.id)}
                      className="p-1.5 rounded hover:bg-red-900/50 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={14} style={{ color: '#ef4444' }} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            {/* Add button */}
            <Button
              onClick={handleAddClick}
              variant="outline"
              size="sm"
              className="w-full gap-2 hover:bg-white/10"
              disabled={textOverlayState.global.length >= 10}
              style={{
                borderColor: CASA_BRAND.colors.secondary.grayMedium,
                backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              <Plus size={14} />
              Agregar Texto
            </Button>

            {/* Clear overrides button */}
            {slideHasOverrides && (
              <Button
                onClick={() => onClearOverrides(currentSlideIndex)}
                variant="outline"
                size="sm"
                className="w-full gap-2 hover:bg-white/10"
                style={{
                  borderColor: CASA_BRAND.colors.secondary.grayMedium,
                  backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                  color: CASA_BRAND.colors.primary.white,
                }}
              >
                <RotateCcw size={14} />
                Restablecer a Global
              </Button>
            )}
          </div>

          {/* Limit indicator */}
          {textOverlayState.global.length >= 10 && (
            <p
              className="text-xs text-center"
              style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
            >
              Maximo 10 textos alcanzado
            </p>
          )}

      {/* Editor modal */}
      <TextOverlayEditor
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingOverlay(null);
        }}
        overlay={editingOverlay}
        onSave={handleSave}
      />
    </div>
  );

  // Compact mode: just render content without wrapper/header
  if (compact) {
    return content;
  }

  // Full mode: render with header and expand/collapse
  return (
    <div
      style={{
        borderTop: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
      }}
    >
      {/* Header - collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Type size={16} style={{ color: CASA_BRAND.colors.primary.amber }} />
          <span
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 600,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            Textos
          </span>
          {textOverlayState.global.length > 0 && (
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {textOverlayState.global.length}
            </span>
          )}
          {slideHasOverrides && (
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.amber + '30',
                color: CASA_BRAND.colors.primary.amber,
              }}
            >
              Override
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp size={16} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
        ) : (
          <ChevronDown size={16} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
        )}
      </button>

      {/* Content */}
      {isExpanded && <div className="px-4 pb-4">{content}</div>}
    </div>
  );
};

export default TextOverlayControls;
