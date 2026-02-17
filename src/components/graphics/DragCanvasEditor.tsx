import { useCallback, useEffect, useRef, useState } from 'react';
import { Grid3X3, Loader2, RotateCcw } from 'lucide-react';
import { useCoordinateMapper } from '@/hooks/useCoordinateMapper';
import { DraggableElement } from './DraggableElement';
import { GridOverlay } from './GridOverlay';
import { AlignmentToolbar } from './AlignmentToolbar';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  type FormatType,
  type ElementPositions,
  type TextAlign,
  DEFAULT_ELEMENT_POSITIONS,
  FORMAT_DIMENSIONS,
  ELEMENT_META,
  SELECTION_COLORS,
  ILLUSTRATION_AREA,
  TITLE_MAX_WIDTH,
} from './graphicsTypes';
import { computeLayoutMetrics, getDefaultFontSizes, type LayoutMetrics, type EventData } from './templateCompositor';
import type { ResizeUpdate } from '@/hooks/useResizeElement';

interface DragCanvasEditorProps {
  format: FormatType;
  previewBase64: string | null;
  previewLoading: boolean;
  positions: ElementPositions;
  onPositionsChange: (positions: ElementPositions) => void;
  visibleFields: {
    subtitle: boolean;
    date: boolean;
    time: boolean;
    location: boolean;
  };
  illustrationAspectRatio?: number | null;
  eventData: EventData;
  /** Show checkerboard pattern behind image for transparent backgrounds */
  showCheckerboard?: boolean;
}

type ElementId = 'title' | 'subtitle' | 'date' | 'time' | 'location' | 'illustration' | 'logo';

const TEXT_ELEMENTS: ElementId[] = ['title', 'subtitle'];
const ALIGNABLE_ELEMENTS: ElementId[] = ['title', 'subtitle', 'date', 'time', 'location'];
const ALL_ELEMENTS: ElementId[] = ['title', 'subtitle', 'date', 'time', 'location', 'illustration', 'logo'];

export function DragCanvasEditor({
  format,
  previewBase64,
  previewLoading,
  positions,
  onPositionsChange,
  visibleFields,
  illustrationAspectRatio,
  eventData,
  showCheckerboard = false,
}: DragCanvasEditorProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [selectedElement, setSelectedElement] = useState<ElementId | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [showPrecision, setShowPrecision] = useState(false);
  const [layoutMetrics, setLayoutMetrics] = useState<LayoutMetrics | null>(null);

  // Grid size: divide canvas into 16 equal columns for finer snap control
  const gridSize = FORMAT_DIMENSIONS[format].width / 16;

  const mapper = useCoordinateMapper(overlayRef, format);

  // Initialize off-screen canvas for text measurement
  if (!measureCtxRef.current) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    measureCtxRef.current = c.getContext('2d');
  }

  const updatePosition = useCallback(
    (elementId: ElementId, x: number, y: number) => {
      const updated = { ...positions };
      if (elementId === 'illustration') {
        updated.illustration = { ...updated.illustration, x, y };
      } else if (elementId === 'logo') {
        updated.logo = { ...updated.logo, x, y };
      } else {
        updated[elementId] = { ...updated[elementId], x, y };
      }
      onPositionsChange(updated);
    },
    [positions, onPositionsChange]
  );

  const updateTextAlign = useCallback(
    (elementId: ElementId, align: TextAlign) => {
      if (elementId === 'illustration' || elementId === 'logo') return;
      const updated = { ...positions };
      updated[elementId] = { ...updated[elementId], textAlign: align };
      onPositionsChange(updated);
    },
    [positions, onPositionsChange]
  );

  const updateIllustrationScale = useCallback(
    (scale: number) => {
      onPositionsChange({
        ...positions,
        illustration: { ...positions.illustration, scale },
      });
    },
    [positions, onPositionsChange]
  );

  const updateIllustrationOpacity = useCallback(
    (opacity: number) => {
      onPositionsChange({
        ...positions,
        illustration: { ...positions.illustration, opacity },
      });
    },
    [positions, onPositionsChange]
  );

  const updateLogoSize = useCallback(
    (size: number) => {
      onPositionsChange({
        ...positions,
        logo: { ...positions.logo, size },
      });
    },
    [positions, onPositionsChange]
  );

  const updateFontSize = useCallback(
    (elementId: ElementId, fontSize: number) => {
      const updated = { ...positions };
      if (elementId === 'title' || elementId === 'subtitle') {
        updated[elementId] = { ...updated[elementId], fontSize };
      } else if (elementId === 'date' || elementId === 'time' || elementId === 'location') {
        updated[elementId] = { ...updated[elementId], fontSize };
      }
      onPositionsChange(updated);
    },
    [positions, onPositionsChange]
  );

  // Combined resize callback — applies position + scale/fontSize/size in ONE state update
  // This prevents the bug where separate onScaleChange and onPositionChange calls
  // close over the same stale `positions` and the second overwrites the first.
  const handleResizeUpdate = useCallback(
    (elementId: ElementId, update: ResizeUpdate) => {
      const updated = { ...positions };
      if (elementId === 'illustration') {
        updated.illustration = {
          ...updated.illustration,
          x: update.x,
          y: update.y,
          ...(update.scale != null ? { scale: update.scale } : {}),
        };
      } else if (elementId === 'logo') {
        updated.logo = {
          ...updated.logo,
          x: update.x,
          y: update.y,
          ...(update.size != null ? { size: update.size } : {}),
        };
      } else {
        // Text elements: title, subtitle, date, time, location
        const textId = elementId as 'title' | 'subtitle' | 'date' | 'time' | 'location';
        updated[textId] = {
          ...updated[textId],
          x: update.x,
          y: update.y,
          ...(update.fontSize != null ? { fontSize: update.fontSize } : {}),
        };
      }
      onPositionsChange(updated);
    },
    [positions, onPositionsChange]
  );

  const resetToDefaults = useCallback(() => {
    const defaultPos: ElementPositions = JSON.parse(JSON.stringify(DEFAULT_ELEMENT_POSITIONS[format]));
    // Resolve auto-Y sentinels using compositor metrics
    if (measureCtxRef.current) {
      const metrics = computeLayoutMetrics(
        format,
        defaultPos,
        illustrationAspectRatio || null,
        eventData,
        { canvasForMeasure: measureCtxRef.current }
      );
      // Apply resolved Y values from metrics
      if (defaultPos.title.y < 0) {
        defaultPos.title.y = metrics.title.y;
      }
      if (defaultPos.subtitle.y < 0) {
        defaultPos.subtitle.y = metrics.subtitle.y;
      }
    }
    onPositionsChange(defaultPos);
    setSelectedElement(null);
  }, [format, onPositionsChange, illustrationAspectRatio, eventData]);

  const isElementVisible = (id: ElementId): boolean => {
    if (id === 'subtitle') return visibleFields.subtitle;
    if (id === 'date') return visibleFields.date;
    if (id === 'time') return visibleFields.time;
    if (id === 'location') return visibleFields.location;
    if (id === 'logo') return DEFAULT_ELEMENT_POSITIONS[format].logo.size > 0;
    return true;
  };

  // Compute layout metrics whenever positions or event data change
  useEffect(() => {
    if (measureCtxRef.current) {
      const metrics = computeLayoutMetrics(
        format,
        positions,
        illustrationAspectRatio || null,
        eventData,
        { canvasForMeasure: measureCtxRef.current }
      );
      setLayoutMetrics(metrics);
    }
  }, [format, positions, illustrationAspectRatio, eventData]);

  // Keyboard shortcuts for nudging selected element
  useEffect(() => {
    if (!selectedElement) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedElement) return;

      const step = e.shiftKey ? 10 : 1;
      const pos = selectedElement === 'illustration' ? positions.illustration :
                  selectedElement === 'logo' ? positions.logo :
                  positions[selectedElement as 'title' | 'subtitle' | 'date' | 'time' | 'location'];
      const displayY = pos.y >= 0 ? pos.y : 0;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          updatePosition(selectedElement, pos.x - step, displayY);
          break;
        case 'ArrowRight':
          e.preventDefault();
          updatePosition(selectedElement, pos.x + step, displayY);
          break;
        case 'ArrowUp':
          e.preventDefault();
          updatePosition(selectedElement, pos.x, displayY - step);
          break;
        case 'ArrowDown':
          e.preventDefault();
          updatePosition(selectedElement, pos.x, displayY + step);
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedElement(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement, positions, updatePosition]);

  const dims = FORMAT_DIMENSIONS[format];
  const aspectClass =
    format === 'ppt_4_3' ? 'aspect-[4/3] max-h-[450px]' :
    format === 'instagram_post' ? 'aspect-square max-h-[500px]' :
    format === 'instagram_story' ? 'aspect-[9/16] max-h-[500px]' :
    'aspect-[1200/630] max-h-[400px]';

  // Selected element info
  const selectedIsAlignable = selectedElement && ALIGNABLE_ELEMENTS.includes(selectedElement);
  const selectedAlign = selectedElement && selectedIsAlignable
    ? (positions[selectedElement as 'title' | 'subtitle' | 'date' | 'time' | 'location'].textAlign || 'left')
    : 'left';

  // Get selected element position for coordinate display
  const selectedPos = selectedElement
    ? (selectedElement === 'illustration' ? positions.illustration :
       selectedElement === 'logo' ? positions.logo :
       positions[selectedElement as 'title' | 'subtitle' | 'date' | 'time' | 'location'])
    : null;

  return (
    <div className="space-y-3">
      {/* Grid toggle */}
      <div className="flex items-center justify-end">
        <Button
          variant={showGrid ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowGrid((v) => !v)}
          className="text-xs gap-1.5"
        >
          <Grid3X3 className="h-3.5 w-3.5" />
          Cuadricula{showGrid ? ' (snap)' : ''}
        </Button>
      </div>

      {/* Preview with drag overlay */}
      <div className={`relative bg-gray-100 rounded-lg overflow-hidden border ${aspectClass}`}>
        {/* Checkerboard for transparent backgrounds — sized to image area only */}
        {showCheckerboard && mapper.ready && mapper.imageDisplayWidth > 0 && (
          <div
            className="absolute checkerboard-bg pointer-events-none"
            style={{
              left: mapper.offsetX,
              top: mapper.offsetY,
              width: mapper.imageDisplayWidth,
              height: mapper.imageDisplayHeight,
              zIndex: 0,
            }}
          />
        )}

        {/* Canvas preview image */}
        {previewBase64 ? (
          <img
            src={`data:image/png;base64,${previewBase64}`}
            alt="Preview"
            className="w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        )}

        {/* Loading indicator */}
        {previewLoading && previewBase64 && (
          <div className="absolute top-2 right-2 z-50">
            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
          </div>
        )}

        {/* Drag overlay */}
        <div
          ref={overlayRef}
          className="absolute inset-0"
          style={{ touchAction: 'none' }}
          onClick={() => setSelectedElement(null)}
        >
          {/* Grid overlay (rendered behind draggable elements) */}
          {mapper.ready && (
            <GridOverlay
              toDOM={mapper.toDOM}
              imageDisplayWidth={mapper.imageDisplayWidth}
              imageDisplayHeight={mapper.imageDisplayHeight}
              offsetX={mapper.offsetX}
              offsetY={mapper.offsetY}
              format={format}
              visible={showGrid}
            />
          )}

          {mapper.ready && ALL_ELEMENTS.map((id) => {
            // Use metrics for element sizing
            let baseX: number;
            let baseY: number;
            let baseWidth: number;
            let baseHeight: number;

            if (!layoutMetrics) {
              // Fallback if metrics not computed yet — derive reasonable defaults from format
              const pos = id === 'illustration' ? positions.illustration :
                         id === 'logo' ? positions.logo :
                         positions[id as 'title' | 'subtitle' | 'date' | 'time' | 'location'];
              const displayY = pos.y >= 0 ? pos.y : 0;
              baseX = pos.x;
              baseY = displayY;
              const defaultFonts = getDefaultFontSizes(format);
              if (id === 'illustration') {
                const area = ILLUSTRATION_AREA[format];
                const scale = positions.illustration.scale ?? 1;
                baseWidth = area.width * scale;
                baseHeight = area.height * scale;
              } else if (id === 'logo') {
                const logoSize = positions.logo.size || 100;
                baseWidth = logoSize;
                baseHeight = logoSize;
              } else if (id === 'title' || id === 'subtitle') {
                baseWidth = TITLE_MAX_WIDTH[format];
                const fs = id === 'title' ? defaultFonts.title : defaultFonts.subtitle;
                baseHeight = fs * 2;
              } else {
                // date, time, location
                baseWidth = defaultFonts.detail * 10;
                baseHeight = defaultFonts.detail * 1.5;
              }
            } else {
              // Use computed metrics
              const metrics = layoutMetrics;
              switch (id) {
                case 'illustration':
                  baseX = metrics.illustration.x;
                  baseY = metrics.illustration.y;
                  baseWidth = metrics.illustration.drawWidth;
                  baseHeight = metrics.illustration.drawHeight;
                  break;
                case 'title':
                  baseX = metrics.title.x;
                  baseY = metrics.title.y;
                  baseWidth = metrics.title.boxWidth;
                  baseHeight = metrics.title.boxHeight;
                  break;
                case 'subtitle':
                  baseX = metrics.subtitle.x;
                  baseY = metrics.subtitle.y;
                  baseWidth = metrics.subtitle.boxWidth;
                  baseHeight = metrics.subtitle.boxHeight;
                  break;
                case 'date':
                  baseX = metrics.date.x;
                  baseY = metrics.date.y;
                  baseWidth = metrics.date.width;
                  baseHeight = metrics.date.height;
                  break;
                case 'time':
                  baseX = metrics.time.x;
                  baseY = metrics.time.y;
                  baseWidth = metrics.time.width;
                  baseHeight = metrics.time.height;
                  break;
                case 'location':
                  baseX = metrics.location.x;
                  baseY = metrics.location.y;
                  baseWidth = metrics.location.width;
                  baseHeight = metrics.location.height;
                  break;
                case 'logo':
                  baseX = metrics.logo.x;
                  baseY = metrics.logo.y;
                  baseWidth = metrics.logo.size;
                  baseHeight = metrics.logo.size;
                  break;
                default:
                  baseX = 0;
                  baseY = 0;
                  baseWidth = 100;
                  baseHeight = 40;
              }
            }

            const domPos = mapper.toDOM(baseX, baseY);
            const domSize = {
              width: baseWidth / mapper.scaleFactor,
              height: baseHeight / mapper.scaleFactor,
            };

            // Determine if element is resizable (now includes text and detail elements)
            const isResizable = id === 'illustration' || id === 'logo' || id === 'title' || id === 'subtitle' || id === 'date' || id === 'time' || id === 'location';

            // Get current font size for text and detail elements
            // Resolve from positions, falling back to format defaults so resize works immediately
            const defaultFonts = getDefaultFontSizes(format);
            const currentFontSize = (id === 'title' || id === 'subtitle' || id === 'date' || id === 'time' || id === 'location')
              ? (positions[id].fontSize ?? (
                  id === 'title' ? defaultFonts.title :
                  id === 'subtitle' ? defaultFonts.subtitle :
                  defaultFonts.detail
                ))
              : undefined;

            return (
              <DraggableElement
                key={id}
                id={id}
                domX={domPos.x}
                domY={domPos.y}
                domWidth={domSize.width}
                domHeight={domSize.height}
                baseX={baseX}
                baseY={baseY}
                baseWidth={baseWidth}
                baseHeight={baseHeight}
                onPositionChange={(x, y) => updatePosition(id, x, y)}
                toBaseDelta={mapper.toBaseDelta}
                isSelected={selectedElement === id}
                onSelect={() => setSelectedElement(id)}
                visible={isElementVisible(id)}
                isResizable={isResizable}
                currentScale={id === 'illustration' ? positions.illustration.scale : undefined}
                onScaleChange={id === 'illustration' ? updateIllustrationScale : undefined}
                currentSize={id === 'logo' ? positions.logo.size : undefined}
                onSizeChange={id === 'logo' ? updateLogoSize : undefined}
                currentFontSize={currentFontSize}
                onFontSizeChange={
                  (id === 'title' || id === 'subtitle' || id === 'date' || id === 'time' || id === 'location')
                    ? (fs) => updateFontSize(id, fs)
                    : undefined
                }
                onResizePositionChange={(x, y) => updatePosition(id, x, y)}
                onResizeUpdate={(update) => handleResizeUpdate(id, update)}
                snapToGrid={showGrid}
                gridSize={gridSize}
              />
            );
          })}
        </div>
      </div>

      {/* Persistent Toolbar */}
      <div
        className="p-3 rounded-lg border transition-colors"
        style={{
          background: selectedElement ? '#f8f9fa' : '#fafafa',
          borderColor: selectedElement ? SELECTION_COLORS.borderHover : '#e5e7eb',
        }}
      >
        {!selectedElement ? (
          <p className="text-sm text-muted-foreground text-center">
            Haz clic en un elemento para seleccionarlo. Arrastra para mover.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Element name + coordinates */}
            <div className="flex items-center justify-between">
              <span
                className="text-sm font-medium px-2 py-0.5 rounded"
                style={{ background: SELECTION_COLORS.badgeBg, color: SELECTION_COLORS.badgeText }}
              >
                {ELEMENT_META[selectedElement]?.label || selectedElement}
              </span>
              {selectedPos && (
                <span className="text-xs text-muted-foreground font-mono">
                  X: {Math.round(selectedPos.x)}  Y: {Math.round(selectedPos.y >= 0 ? selectedPos.y : 0)}
                </span>
              )}
            </div>

            {/* Text alignment (for alignable elements) */}
            {selectedIsAlignable && (
              <div className="flex items-center gap-3">
                <Label className="text-xs">Alinear:</Label>
                <AlignmentToolbar
                  value={selectedAlign as TextAlign}
                  onChange={(align) => updateTextAlign(selectedElement, align)}
                />
              </div>
            )}

            {/* Illustration controls */}
            {selectedElement === 'illustration' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Tamano:</Label>
                  <Slider
                    value={[positions.illustration.scale * 100]}
                    onValueChange={([v]) => updateIllustrationScale(v / 100)}
                    min={30}
                    max={200}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {Math.round(positions.illustration.scale * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Opacidad:</Label>
                  <Slider
                    value={[positions.illustration.opacity * 100]}
                    onValueChange={([v]) => updateIllustrationOpacity(v / 100)}
                    min={5}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {Math.round(positions.illustration.opacity * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Logo size control */}
            {selectedElement === 'logo' && (
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Tamano:</Label>
                <Slider
                  value={[positions.logo.size]}
                  onValueChange={([v]) => updateLogoSize(v)}
                  min={40}
                  max={300}
                  step={1}
                  className="flex-1 max-w-[200px]"
                />
                <span className="text-xs text-muted-foreground w-10 text-right">
                  {Math.round(positions.logo.size)}px
                </span>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">
              Flechas del teclado: mover 1px | Shift+Flechas: mover 10px | Esc: deseleccionar
            </p>
          </div>
        )}
      </div>

      {/* Precision controls (collapsed) */}
      <Collapsible open={showPrecision} onOpenChange={setShowPrecision}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
            {showPrecision ? 'Ocultar' : 'Mostrar'} controles de precision
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 p-3 bg-gray-50 rounded-lg border mt-1">
            {ALL_ELEMENTS.filter(isElementVisible).map((id) => {
              const pos = id === 'illustration' ? positions.illustration :
                         id === 'logo' ? positions.logo :
                         positions[id as 'title' | 'subtitle' | 'date' | 'time' | 'location'];
              const displayY = pos.y >= 0 ? pos.y : 0;

              return (
                <div key={id} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center">
                  <Label className="text-xs font-medium">{ELEMENT_META[id]?.label}</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground w-4">X</span>
                    <Slider
                      value={[pos.x]}
                      onValueChange={([v]) => updatePosition(id, v, displayY)}
                      min={-200}
                      max={dims.width + 200}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-[10px] text-muted-foreground w-8 text-right">{Math.round(pos.x)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground w-4">Y</span>
                    <Slider
                      value={[displayY]}
                      onValueChange={([v]) => updatePosition(id, pos.x, v)}
                      min={-200}
                      max={dims.height + 200}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-[10px] text-muted-foreground w-8 text-right">{Math.round(displayY)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Reset button */}
      <Button variant="outline" onClick={resetToDefaults} className="w-full" size="sm">
        <RotateCcw className="h-4 w-4 mr-2" />
        Restablecer posiciones
      </Button>
    </div>
  );
}
