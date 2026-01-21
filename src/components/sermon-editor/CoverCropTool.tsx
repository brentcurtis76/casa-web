/**
 * CoverCropTool - Image cropping tool for custom cover uploads
 * PROMPT_005: Cover Art & Metadata
 *
 * Features:
 * - Center-square crop by default
 * - Drag to adjust crop area
 * - Resize to target dimensions (1400x1400)
 * - Preview of crop result
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Check, X, Move, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface CoverCropToolProps {
  file: File;
  onCrop: (croppedBlob: Blob) => void;
  onCancel: () => void;
  targetSize?: number;
}

interface CropArea {
  x: number;
  y: number;
  size: number;
}

export function CoverCropTool({
  file,
  onCrop,
  onCancel,
  targetSize = 1400,
}: CoverCropToolProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, size: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Load image and set up initial crop area
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);

    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });

      // Calculate initial square crop (center of image)
      const minDim = Math.min(img.width, img.height);
      setCropArea({
        x: (img.width - minDim) / 2,
        y: (img.height - minDim) / 2,
        size: minDim,
      });
    };
    img.src = url;

    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Handle zoom change
  const handleZoomChange = useCallback((value: number[]) => {
    const newZoom = value[0];
    const zoomFactor = newZoom / zoom;

    setCropArea((prev) => {
      // Adjust size based on zoom
      const newSize = Math.max(
        100,
        Math.min(
          Math.min(imageSize.width, imageSize.height),
          prev.size / zoomFactor
        )
      );

      // Keep crop centered
      const centerX = prev.x + prev.size / 2;
      const centerY = prev.y + prev.size / 2;

      return {
        x: Math.max(0, Math.min(imageSize.width - newSize, centerX - newSize / 2)),
        y: Math.max(0, Math.min(imageSize.height - newSize, centerY - newSize / 2)),
        size: newSize,
      };
    });

    setZoom(newZoom);
  }, [zoom, imageSize]);

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - cropArea.x,
      y: e.clientY - cropArea.y,
    });
  }, [cropArea]);

  // Handle drag move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;

    const container = containerRef.current;
    if (!container || !imageRef.current) return;

    const rect = container.getBoundingClientRect();
    const imgRect = imageRef.current.getBoundingClientRect();
    const scale = imageSize.width / imgRect.width;

    // Calculate new position in image coordinates
    const newX = (e.clientX - imgRect.left) * scale - cropArea.size / 2;
    const newY = (e.clientY - imgRect.top) * scale - cropArea.size / 2;

    // Constrain to image bounds
    setCropArea((prev) => ({
      ...prev,
      x: Math.max(0, Math.min(imageSize.width - prev.size, newX)),
      y: Math.max(0, Math.min(imageSize.height - prev.size, newY)),
    }));
  }, [isDragging, cropArea.size, imageSize]);

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Perform the crop
  const handleCrop = useCallback(async () => {
    if (!imageUrl) return;

    const img = new Image();
    img.src = imageUrl;

    await new Promise((resolve) => {
      img.onload = resolve;
    });

    // Create canvas for cropping
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create canvas context');

    // Draw cropped and resized image
    ctx.drawImage(
      img,
      cropArea.x,
      cropArea.y,
      cropArea.size,
      cropArea.size,
      0,
      0,
      targetSize,
      targetSize
    );

    // Convert to blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCrop(blob);
        }
      },
      'image/jpeg',
      0.9
    );
  }, [imageUrl, cropArea, targetSize, onCrop]);

  if (!imageUrl) {
    return null;
  }

  // Calculate display scale
  const containerWidth = 400;
  const displayScale = containerWidth / imageSize.width || 1;
  const displayHeight = imageSize.height * displayScale;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recortar imagen</h3>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Arrastra para ajustar el área de recorte. La imagen se recortará a un cuadrado de {targetSize}x{targetSize} píxeles.
        </p>

        {/* Crop Area */}
        <div
          ref={containerRef}
          className="relative mx-auto cursor-move overflow-hidden bg-gray-100 rounded-lg"
          style={{
            width: containerWidth,
            height: displayHeight,
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Source Image */}
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Source"
            className="w-full h-full object-contain"
            draggable={false}
          />

          {/* Darkened overlay outside crop area */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                linear-gradient(to right,
                  rgba(0,0,0,0.6) ${cropArea.x * displayScale}px,
                  transparent ${cropArea.x * displayScale}px,
                  transparent ${(cropArea.x + cropArea.size) * displayScale}px,
                  rgba(0,0,0,0.6) ${(cropArea.x + cropArea.size) * displayScale}px
                )
              `,
            }}
          />

          {/* Crop selection box */}
          <div
            className="absolute border-2 border-white shadow-lg cursor-move"
            style={{
              left: cropArea.x * displayScale,
              top: cropArea.y * displayScale,
              width: cropArea.size * displayScale,
              height: cropArea.size * displayScale,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
            }}
            onMouseDown={handleMouseDown}
          >
            {/* Corner indicators */}
            <div className="absolute -top-1 -left-1 w-3 h-3 bg-white border border-gray-300" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-white border border-gray-300" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border border-gray-300" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border border-gray-300" />

            {/* Center crosshair */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Move className="h-6 w-6 text-white/70" />
            </div>

            {/* Grid lines */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="border border-white/20" />
              ))}
            </div>
          </div>
        </div>

        {/* Zoom Control */}
        <div className="flex items-center gap-3">
          <ZoomOut className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[zoom]}
            onValueChange={handleZoomChange}
            min={50}
            max={200}
            step={5}
            className="flex-1"
          />
          <ZoomIn className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground w-12">{zoom}%</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleCrop} className="bg-amber-600 hover:bg-amber-700">
            <Check className="h-4 w-4 mr-2" />
            Usar esta imagen
          </Button>
        </div>
      </div>
    </div>
  );
}
