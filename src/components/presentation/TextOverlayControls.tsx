/**
 * TextOverlayControls - Panel de control de text overlays en PresenterView
 * Permite agregar, editar, eliminar y gestionar visibilidad de overlays
 *
 * SISTEMA SIMPLIFICADO (v2):
 * - Cada overlay tiene su propio scope (all o elements)
 * - No hay overrides por slide
 * - Lista simple de overlays con su scope visible
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
  Globe,
  Layers,
} from 'lucide-react';
import { TextOverlayEditor } from './TextOverlayEditor';
import type { TextOverlay, TextOverlayState, TextOverlayStyle, FlattenedElement, OverlayScope } from '@/lib/presentation/types';
import { getScopeLabel, getVisibleTextOverlays, DEFAULT_TEXT_OVERLAY_STYLE } from '@/lib/presentation/types';

interface TextOverlayControlsProps {
  textOverlayState: TextOverlayState;
  currentSlideIndex: number;
  /** Elemento actual (el que contiene el slide actual) */
  currentElement: FlattenedElement | null;
  /** Lista de todos los elementos */
  elements: FlattenedElement[];
  /** Agregar un nuevo overlay */
  onAdd: (overlay: TextOverlay) => void;
  /** Actualizar un overlay existente */
  onUpdate: (id: string, updates: Partial<TextOverlay>) => void;
  /** Eliminar un overlay */
  onRemove: (id: string) => void;
  /** When true, renders without header/expand (for use inside CollapsiblePanel) */
  compact?: boolean;
}

export const TextOverlayControls: React.FC<TextOverlayControlsProps> = ({
  textOverlayState,
  currentSlideIndex,
  currentElement,
  elements,
  onAdd,
  onUpdate,
  onRemove,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingOverlay, setEditingOverlay] = useState<TextOverlay | null>(null);

  // Get all overlays
  const allOverlays = textOverlayState.overlays;

  // Get visible overlays for current slide (for display indicator)
  const visibleOnCurrentSlide = getVisibleTextOverlays(textOverlayState, currentSlideIndex, elements);

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
  const handleSave = (content: string, style: TextOverlayStyle, scope: OverlayScope) => {
    if (editingOverlay) {
      // Update existing overlay (preserve position)
      onUpdate(editingOverlay.id, { content, style, scope });
    } else {
      // Create new overlay (center by default, user can drag to reposition)
      // Starts as NOT visible so user can position it before showing on projector
      const newOverlay: TextOverlay = {
        id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        content,
        position: { x: 50, y: 50 },
        style,
        visible: false,
        scope,
      };
      onAdd(newOverlay);
    }
    setEditorOpen(false);
    setEditingOverlay(null);
  };

  // Handle visibility toggle for current element
  // This toggle controls whether the overlay shows on the CURRENT element
  const handleVisibilityToggle = (overlay: TextOverlay, shouldShow: boolean) => {
    const isCurrentlyVisible = isVisibleOnSlide(overlay);

    if (shouldShow && !isCurrentlyVisible) {
      // Turn ON for current element
      if (!overlay.visible) {
        // First enable global visibility
        onUpdate(overlay.id, { visible: true });
      }

      // Add current element to scope
      if (overlay.scope.type === 'elements' && currentElement) {
        if (!overlay.scope.elementIds.includes(currentElement.id)) {
          onUpdate(overlay.id, {
            scope: { type: 'elements', elementIds: [...overlay.scope.elementIds, currentElement.id] },
          });
        }
      } else if (overlay.scope.type === 'element' && currentElement) {
        if (overlay.scope.elementId !== currentElement.id) {
          onUpdate(overlay.id, { scope: { type: 'element', elementId: currentElement.id } });
        }
      } else if (overlay.scope.type === 'slide') {
        if (overlay.scope.slideIndex !== currentSlideIndex) {
          onUpdate(overlay.id, { scope: { type: 'slide', slideIndex: currentSlideIndex } });
        }
      }
      // If scope is 'all' and visibility is on, it shows (no change needed)
    } else if (!shouldShow && isCurrentlyVisible) {
      // Turn OFF for current element - remove from scope
      if (overlay.scope.type === 'all') {
        // Switching from 'all' to all elements except current
        if (currentElement) {
          const otherElementIds = elements
            .filter((e) => e.id !== currentElement.id)
            .map((e) => e.id);
          onUpdate(overlay.id, { scope: { type: 'elements', elementIds: otherElementIds } });
        }
      } else if (overlay.scope.type === 'elements' && currentElement) {
        const newIds = overlay.scope.elementIds.filter((id) => id !== currentElement.id);
        onUpdate(overlay.id, { scope: { type: 'elements', elementIds: newIds } });
      } else if (overlay.scope.type === 'element') {
        onUpdate(overlay.id, { scope: { type: 'elements', elementIds: [] } });
      } else if (overlay.scope.type === 'slide') {
        onUpdate(overlay.id, { scope: { type: 'elements', elementIds: [] } });
      }
    }
  };

  // Check if overlay is visible on current slide
  const isVisibleOnSlide = (overlay: TextOverlay): boolean => {
    return visibleOnCurrentSlide.some((o) => o.id === overlay.id);
  };

  const content = (
    <div className="space-y-3">
      {/* Overlay list */}
      {allOverlays.length === 0 ? (
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
          {allOverlays.map((overlay) => {
            const scopeLabel = getScopeLabel(overlay.scope, elements);
            const isOnCurrentSlide = isVisibleOnSlide(overlay);

            return (
              <div
                key={overlay.id}
                className="flex items-center gap-2 p-2 rounded"
                style={{
                  backgroundColor: CASA_BRAND.colors.primary.black,
                  border: isOnCurrentSlide
                    ? `1px solid ${CASA_BRAND.colors.primary.amber}40`
                    : `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
                  opacity: overlay.visible ? 1 : 0.6,
                }}
              >
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
                    }}
                  >
                    {overlay.content.substring(0, 30)}
                    {overlay.content.length > 30 ? '...' : ''}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {overlay.scope.type === 'all' ? (
                      <Globe
                        size={10}
                        style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                      />
                    ) : (
                      <Layers
                        size={10}
                        style={{ color: CASA_BRAND.colors.primary.amber }}
                      />
                    )}
                    <span
                      style={{
                        fontSize: '10px',
                        color: overlay.scope.type === 'all'
                          ? CASA_BRAND.colors.secondary.grayMedium
                          : CASA_BRAND.colors.primary.amber,
                      }}
                    >
                      {scopeLabel}
                    </span>
                    {isOnCurrentSlide && (
                      <span
                        className="ml-1 px-1.5 py-0.5 rounded text-[9px]"
                        style={{
                          backgroundColor: CASA_BRAND.colors.primary.amber + '30',
                          color: CASA_BRAND.colors.primary.amber,
                        }}
                      >
                        activo
                      </span>
                    )}
                  </div>
                </div>

                {/* Edit button */}
                <button
                  onClick={() => handleEditClick(overlay)}
                  className="p-1.5 rounded hover:bg-gray-700 transition-colors"
                  title="Editar"
                >
                  <Pencil
                    size={14}
                    style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                  />
                </button>

                {/* Visibility toggle - controls visibility on CURRENT element */}
                <Switch
                  checked={isOnCurrentSlide}
                  onCheckedChange={(v) => handleVisibilityToggle(overlay, v)}
                  className="border-2 data-[state=unchecked]:bg-gray-700"
                  style={{
                    borderColor: isOnCurrentSlide ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayMedium,
                    backgroundColor: isOnCurrentSlide ? CASA_BRAND.colors.primary.amber : undefined,
                  }}
                  title={isOnCurrentSlide ? 'Visible en este elemento' : 'No visible en este elemento'}
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

      {/* Add button */}
      <div className="pt-2">
        <Button
          onClick={handleAddClick}
          variant="outline"
          size="sm"
          className="w-full gap-2 hover:bg-white/10"
          disabled={allOverlays.length >= 10}
          style={{
            borderColor: CASA_BRAND.colors.secondary.grayMedium,
            backgroundColor: CASA_BRAND.colors.secondary.grayDark,
            color: CASA_BRAND.colors.primary.white,
          }}
        >
          <Plus size={14} />
          Agregar Texto
        </Button>
      </div>

      {/* Limit indicator */}
      {allOverlays.length >= 10 && (
        <p
          className="text-xs text-center"
          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
        >
          Máximo 10 textos alcanzado
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
        elements={elements}
        currentSlideIndex={currentSlideIndex}
        currentElement={currentElement}
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
          {allOverlays.length > 0 && (
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {allOverlays.length}
            </span>
          )}
          {visibleOnCurrentSlide.length > 0 && (
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.amber + '30',
                color: CASA_BRAND.colors.primary.amber,
              }}
            >
              {visibleOnCurrentSlide.length} activos
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
