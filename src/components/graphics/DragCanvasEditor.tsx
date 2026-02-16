import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { useCoordinateMapper } from '@/hooks/useCoordinateMapper';
import { DraggableElement } from './DraggableElement';
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
} from './graphicsTypes';

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
}

type ElementId = 'title' | 'subtitle' | 'date' | 'time' | 'location' | 'illustration' | 'logo';

/** Approximate element sizes in base coordinates per format */
function getElementSize(id: ElementId, format: FormatType): { width: number; height: number } {
  const dims = FORMAT_DIMENSIONS[format];

  switch (id) {
    case 'title':
      return { width: dims.width * 0.6, height: dims.height * 0.2 };
    case 'subtitle':
      return { width: dims.width * 0.5, height: dims.height * 0.05 };
    case 'date':
    case 'time':
      return { width: dims.width * 0.35, height: dims.height * 0.05 };
    case 'location':
      return { width: dims.width * 0.4, height: dims.height * 0.06 };
    case 'illustration':
      return { width: dims.width * 0.45, height: dims.height * 0.55 };
    case 'logo': {
      const logoSize = DEFAULT_ELEMENT_POSITIONS[format].logo.size;
      return { width: logoSize, height: logoSize };
    }
    default:
      return { width: 100, height: 40 };
  }
}

const TEXT_ELEMENTS: ElementId[] = ['title', 'subtitle'];
const ALL_ELEMENTS: ElementId[] = ['title', 'subtitle', 'date', 'time', 'location', 'illustration', 'logo'];

export function DragCanvasEditor({
  format,
  previewBase64,
  previewLoading,
  positions,
  onPositionsChange,
  visibleFields,
}: DragCanvasEditorProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [selectedElement, setSelectedElement] = useState<ElementId | null>(null);
  const [showPrecision, setShowPrecision] = useState(false);

  const mapper = useCoordinateMapper(overlayRef, format);

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

  const resetToDefaults = useCallback(() => {
    onPositionsChange(JSON.parse(JSON.stringify(DEFAULT_ELEMENT_POSITIONS[format])));
    setSelectedElement(null);
  }, [format, onPositionsChange]);

  const isElementVisible = (id: ElementId): boolean => {
    if (id === 'subtitle') return visibleFields.subtitle;
    if (id === 'date') return visibleFields.date;
    if (id === 'time') return visibleFields.time;
    if (id === 'location') return visibleFields.location;
    if (id === 'logo') return DEFAULT_ELEMENT_POSITIONS[format].logo.size > 0;
    return true;
  };

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
    format === 'ppt_4_3' ? 'aspect-[4/3]' :
    format === 'instagram_post' ? 'aspect-square' :
    format === 'instagram_story' ? 'aspect-[9/16] max-h-[500px]' :
    'aspect-[1200/630]';

  // Selected element info
  const selectedIsText = selectedElement && TEXT_ELEMENTS.includes(selectedElement);
  const selectedAlign = selectedElement && selectedIsText
    ? (positions[selectedElement as 'title' | 'subtitle'].textAlign || 'left')
    : 'left';

  // Get selected element position for coordinate display
  const selectedPos = selectedElement
    ? (selectedElement === 'illustration' ? positions.illustration :
       selectedElement === 'logo' ? positions.logo :
       positions[selectedElement as 'title' | 'subtitle' | 'date' | 'time' | 'location'])
    : null;

  return (
    <div className="space-y-3">
      {/* Preview with drag overlay */}
      <div className={`relative bg-gray-100 rounded-lg overflow-hidden border ${aspectClass}`}>
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
          {mapper.ready && ALL_ELEMENTS.map((id) => {
            const pos = id === 'illustration' ? positions.illustration :
                       id === 'logo' ? positions.logo :
                       positions[id as 'title' | 'subtitle' | 'date' | 'time' | 'location'];

            const displayY = pos.y >= 0 ? pos.y : DEFAULT_ELEMENT_POSITIONS[format][id as keyof ElementPositions].y;
            const effectiveY = Math.max(displayY, 0);

            const domPos = mapper.toDOM(pos.x, effectiveY);
            const size = getElementSize(id, format);
            const domSize = {
              width: size.width / mapper.scaleFactor,
              height: size.height / mapper.scaleFactor,
            };

            return (
              <DraggableElement
                key={id}
                id={id}
                domX={domPos.x}
                domY={domPos.y}
                domWidth={domSize.width}
                domHeight={domSize.height}
                baseX={pos.x}
                baseY={effectiveY}
                baseWidth={size.width}
                baseHeight={size.height}
                onPositionChange={(x, y) => updatePosition(id, x, y)}
                toBaseDelta={mapper.toBaseDelta}
                isSelected={selectedElement === id}
                onSelect={() => setSelectedElement(id)}
                visible={isElementVisible(id)}
                isResizable={id === 'illustration' || id === 'logo'}
                currentScale={id === 'illustration' ? positions.illustration.scale : undefined}
                onScaleChange={id === 'illustration' ? updateIllustrationScale : undefined}
                currentSize={id === 'logo' ? positions.logo.size : undefined}
                onSizeChange={id === 'logo' ? updateLogoSize : undefined}
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

            {/* Text alignment (only for text elements) */}
            {selectedIsText && (
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
