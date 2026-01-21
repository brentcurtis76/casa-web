/**
 * Portadas - Componente para generar portadas de liturgia
 *
 * Características según spec:
 * - UNA SOLA ilustración estilo Matisse/Picasso para AMBAS portadas
 * - Logo CASA en esquina superior DERECHA (desde el repositorio, no generado por IA)
 * - Texto alineado derecha, esquina inferior
 * - Formato 4:3 (1024x768)
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CASA_BRAND } from '@/lib/brand-kit';
import { currentSeason } from '@/data/currentSeason';
import {
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Check,
  Download,
  Eye,
  EyeOff,
  Edit3,
  RotateCcw,
  SlidersHorizontal,
  AlignLeft,
  AlignRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import type { Slide, SlideGroup } from '@/types/shared/slide';
import type { LiturgyContext, IllustrationConfig, LayoutAlignment, PortadasConfig } from '@/types/shared/liturgy';
import { v4 as uuidv4 } from 'uuid';
import { UniversalSlide } from './UniversalSlide';

const DEFAULT_ILLUSTRATION_CONFIG: IllustrationConfig = {
  opacity: 15,
  scale: 100,
  positionX: 0,
  positionY: 0,
};

/**
 * Post-process an illustration to ensure background matches CASA_BRAND.colors.primary.white
 * Replaces white, near-white, light gray, and checkered pattern pixels with exact target color
 */
async function processIllustrationBackground(base64: string, targetColor: string = CASA_BRAND.colors.primary.white): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(base64);
        return;
      }

      // Draw the original image first
      ctx.drawImage(img, 0, 0);

      // Get image data to process pixels
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Parse target color to RGB
      const targetR = parseInt(targetColor.slice(1, 3), 16);
      const targetG = parseInt(targetColor.slice(3, 5), 16);
      const targetB = parseInt(targetColor.slice(5, 7), 16);

      // Replace background pixels with target color
      // This handles: pure white, near-white, cream, light gray, and checkered patterns
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Replace transparent pixels
        if (a < 250) {
          data[i] = targetR;
          data[i + 1] = targetG;
          data[i + 2] = targetB;
          data[i + 3] = 255;
          continue;
        }

        // Replace pure white and near-white (> 240)
        if (r > 240 && g > 240 && b > 240) {
          data[i] = targetR;
          data[i + 1] = targetG;
          data[i + 2] = targetB;
          continue;
        }

        // Replace light grays (checkered pattern uses ~204 gray and white)
        // Checkered patterns typically alternate between white (255) and light gray (~204 or ~192)
        if (r > 190 && g > 190 && b > 190) {
          const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
          // If it's a neutral gray (R≈G≈B), replace it
          if (maxDiff < 10) {
            data[i] = targetR;
            data[i + 1] = targetG;
            data[i + 2] = targetB;
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);

      const result = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
      resolve(result);
    };

    img.onerror = () => {
      resolve(base64);
    };

    img.src = `data:image/png;base64,${base64}`;
  });
}

export const DEFAULT_PORTADAS_CONFIG: PortadasConfig = {
  illustrationConfig: DEFAULT_ILLUSTRATION_CONFIG,
  logoAlignment: 'right',
  textAlignment: 'right',
};

// Path to CASA logo in public folder (actual logo)
const CASA_LOGO_PATH = '/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png';

interface PortadasProps {
  context: LiturgyContext;
  onSlidesGenerated?: (mainSlides: SlideGroup, reflectionSlides: SlideGroup) => void;
  /** Shared illustration state for both covers */
  sharedIllustration?: string | null;
  onIllustrationChange?: (illustration: string | null) => void;
  /** Portadas configuration (alignment, scale, position) */
  portadasConfig?: PortadasConfig;
  onConfigChange?: (config: PortadasConfig) => void;
}

const Portadas: React.FC<PortadasProps> = ({
  context,
  onSlidesGenerated,
  sharedIllustration,
  onIllustrationChange,
  portadasConfig,
  onConfigChange,
}) => {
  const { toast } = useToast();
  const [illustrations, setIllustrations] = useState<string[]>([]);
  const [selectedIllustration, setSelectedIllustration] = useState<string | null>(
    sharedIllustration || null
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewType, setPreviewType] = useState<'main' | 'reflection'>('main');
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [showImageControls, setShowImageControls] = useState(false);
  const [illustrationTheme, setIllustrationTheme] = useState<string>('');
  const [illustrationConfig, setIllustrationConfig] = useState<IllustrationConfig>(
    portadasConfig?.illustrationConfig || DEFAULT_ILLUSTRATION_CONFIG
  );
  const [logoAlignment, setLogoAlignment] = useState<LayoutAlignment>(
    portadasConfig?.logoAlignment || 'right'
  );
  const [textAlignment, setTextAlignment] = useState<LayoutAlignment>(
    portadasConfig?.textAlignment || 'right'
  );
  const [showLogoPreview, setShowLogoPreview] = useState(true);

  // Notify parent when config changes
  useEffect(() => {
    const newConfig: PortadasConfig = {
      illustrationConfig,
      logoAlignment,
      textAlignment,
    };
    onConfigChange?.(newConfig);
  }, [illustrationConfig, logoAlignment, textAlignment, onConfigChange]);

  // Generate default prompt based on context - requests PURE WHITE background
  // Post-processing will replace white pixels with CASA_BRAND.colors.primary.white
  const defaultPrompt = useMemo(() => {
    // Use user's custom theme if provided, otherwise extract from context
    const themeDescription = illustrationTheme.trim()
      ? illustrationTheme.trim()
      : (context.summary
          ? context.summary.split(' ').slice(0, 10).join(' ')
          : context.title);

    return `Minimalist line art illustration with PURE WHITE (#FFFFFF) solid flat background, no texture, no pattern, no gradients. Single continuous gray (#666666) line drawing in the style of Henri Matisse or Pablo Picasso one-line art. Subject: ${themeDescription}. Abstract and contemplative, suggestive of spiritual reflection. No text, no labels, no words. Elegant flowing lines with amber/gold (#D4A853) accent on 20-30% of the illustration.`;
  }, [context.summary, context.title, illustrationTheme]);

  // Initialize custom prompt when context changes
  useEffect(() => {
    setCustomPrompt(defaultPrompt);
  }, [defaultPrompt]);

  // Sync with parent's shared illustration
  useEffect(() => {
    if (sharedIllustration !== undefined) {
      setSelectedIllustration(sharedIllustration);
    }
  }, [sharedIllustration]);

  // Reset prompt to default
  const resetPrompt = () => {
    setCustomPrompt(defaultPrompt);
  };

  // Reset illustration config to default
  const resetIllustrationConfig = () => {
    setIllustrationConfig(DEFAULT_ILLUSTRATION_CONFIG);
  };

  // Check if illustration config has been modified
  const isConfigModified =
    illustrationConfig.opacity !== DEFAULT_ILLUSTRATION_CONFIG.opacity ||
    illustrationConfig.scale !== DEFAULT_ILLUSTRATION_CONFIG.scale ||
    illustrationConfig.positionX !== DEFAULT_ILLUSTRATION_CONFIG.positionX ||
    illustrationConfig.positionY !== DEFAULT_ILLUSTRATION_CONFIG.positionY;

  // Generate illustrations using Imagen 4.0 (Matisse/Picasso style)
  const generateIllustrations = async () => {
    setIsGenerating(true);
    setIllustrations([]);

    try {
      const { data, error } = await supabase.functions.invoke('generate-illustration', {
        body: {
          eventType: 'culto_dominical',
          count: 4,
          customPrompt: customPrompt || defaultPrompt,
        },
      });

      if (error) throw error;

      // Filter out empty strings
      const validIllustrations = (data.illustrations || []).filter(
        (i: string) => i && i.length > 0
      );

      if (validIllustrations.length === 0) {
        throw new Error('No se pudieron generar ilustraciones');
      }

      // Post-process each illustration to ensure background matches slide color
      const processedIllustrations = await Promise.all(
        validIllustrations.map((base64: string) => processIllustrationBackground(base64))
      );

      setIllustrations(processedIllustrations);

      toast({
        title: 'Ilustraciones generadas',
        description: `${validIllustrations.length} opciones estilo Matisse/Picasso`,
      });
    } catch (err) {
      console.error('Error generating illustrations:', err);
      toast({
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'No se pudieron generar las ilustraciones',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Select an illustration (shared for both covers)
  const selectIllustration = (illustrationBase64: string) => {
    setSelectedIllustration(illustrationBase64);
    onIllustrationChange?.(illustrationBase64);
  };

  // Generate slide groups for both covers
  const generateSlides = useCallback((): { main: SlideGroup; reflection: SlideGroup } => {
    const formattedDate = format(new Date(context.date), "EEEE d 'de' MMMM", { locale: es });
    const mainGroupId = uuidv4();
    const reflectionGroupId = uuidv4();

    // Get current season name
    const seasonName = currentSeason.name.toUpperCase();

    // Main Cover Slide - includes illustration and config for proper rendering
    const mainSlide: Slide = {
      id: uuidv4(),
      type: 'title',
      content: {
        primary: context.title,
        secondary: formattedDate,
        subtitle: seasonName,
        imageUrl: selectedIllustration || undefined,
      },
      style: {
        primaryColor: CASA_BRAND.colors.primary.black,
        secondaryColor: CASA_BRAND.colors.primary.amber,
        backgroundColor: CASA_BRAND.colors.primary.white,
        primaryFont: CASA_BRAND.fonts.heading,
        secondaryFont: CASA_BRAND.fonts.body,
      },
      metadata: {
        sourceComponent: 'portadas-main',
        sourceId: mainGroupId,
        order: 1,
        groupTotal: 1,
        // Save illustration config for presenter rendering
        illustrationConfig: {
          opacity: illustrationConfig.opacity,
          scale: illustrationConfig.scale,
          positionX: illustrationConfig.positionX,
          positionY: illustrationConfig.positionY,
        },
        textAlignment,
        logoAlignment,
      },
    };

    // Reflection Cover Slide - includes illustration and config for proper rendering
    const reflectionSlide: Slide = {
      id: uuidv4(),
      type: 'title',
      content: {
        primary: context.title,
        secondary: 'Reflexión',
        subtitle: seasonName,
        imageUrl: selectedIllustration || undefined,
      },
      style: {
        primaryColor: CASA_BRAND.colors.primary.black,
        secondaryColor: CASA_BRAND.colors.primary.amber,
        backgroundColor: CASA_BRAND.colors.primary.white,
        primaryFont: CASA_BRAND.fonts.heading,
        secondaryFont: CASA_BRAND.fonts.body,
      },
      metadata: {
        sourceComponent: 'portadas-reflection',
        sourceId: reflectionGroupId,
        order: 1,
        groupTotal: 1,
        // Save illustration config for presenter rendering
        illustrationConfig: {
          opacity: illustrationConfig.opacity,
          scale: illustrationConfig.scale,
          positionX: illustrationConfig.positionX,
          positionY: illustrationConfig.positionY,
        },
        textAlignment,
        logoAlignment,
      },
    };

    return {
      main: {
        id: mainGroupId,
        type: 'announcement',
        title: 'Portada Principal',
        slides: [mainSlide],
        metadata: {
          sourceComponent: 'portadas',
          createdAt: new Date().toISOString(),
        },
      },
      reflection: {
        id: reflectionGroupId,
        type: 'announcement',
        title: 'Portada de Reflexión',
        slides: [reflectionSlide],
        metadata: {
          sourceComponent: 'portadas',
          createdAt: new Date().toISOString(),
        },
      },
    };
  }, [context, selectedIllustration, illustrationConfig, textAlignment, logoAlignment]);

  // Export both slides
  const exportSlides = () => {
    console.log('[Portadas] exportSlides called, selectedIllustration:', !!selectedIllustration);

    if (!selectedIllustration) {
      toast({
        title: 'Selecciona una ilustración',
        description: 'Debes seleccionar una ilustración para ambas portadas',
        variant: 'destructive',
      });
      return;
    }

    const { main, reflection } = generateSlides();
    console.log('[Portadas] Generated slides:', {
      mainSlides: main.slides.length,
      reflectionSlides: reflection.slides.length,
      hasImage: !!main.slides[0]?.content?.imageUrl,
    });

    onSlidesGenerated?.(main, reflection);

    toast({
      title: '✓ Portadas guardadas',
      description: 'Ahora guarda la liturgia para persistir los cambios',
    });
  };

  // Get illustration URL
  const getIllustrationUrl = (base64: string) => `data:image/png;base64,${base64}`;

  // Build the slide object that will be used for BOTH preview and saving
  // This ensures Constructor and Presenter show the exact same thing
  const buildSlideForPreview = useCallback((type: 'main' | 'reflection'): Slide => {
    const dateValue = typeof context.date === 'string'
      ? parseISO(context.date)
      : context.date;
    const formattedDate = format(dateValue, "EEEE d 'de' MMMM", { locale: es });

    if (type === 'main') {
      return {
        id: 'preview-main',
        type: 'portada-main',
        content: {
          primary: context.title,
          secondary: formattedDate,
          subtitle: currentSeason.name,
          imageUrl: selectedIllustration ? getIllustrationUrl(selectedIllustration) : undefined,
        },
        style: {
          backgroundColor: CASA_BRAND.colors.primary.white,
          primaryColor: CASA_BRAND.colors.primary.black,
        },
        metadata: {
          sourceComponent: 'portadas-main',
          textAlignment: textAlignment,
          logoAlignment: logoAlignment,
          illustrationConfig: illustrationConfig,
        },
      };
    } else {
      return {
        id: 'preview-reflection',
        type: 'portada-reflection',
        content: {
          primary: context.title,
          subtitle: currentSeason.name,
          imageUrl: selectedIllustration ? getIllustrationUrl(selectedIllustration) : undefined,
        },
        style: {
          backgroundColor: CASA_BRAND.colors.primary.white,
          primaryColor: CASA_BRAND.colors.primary.black,
        },
        metadata: {
          sourceComponent: 'portadas-reflection',
          textAlignment: textAlignment,
          logoAlignment: logoAlignment,
          illustrationConfig: illustrationConfig,
        },
      };
    }
  }, [context.date, context.title, selectedIllustration, textAlignment, logoAlignment, illustrationConfig]);

  // Render cover preview using UniversalSlide - SAME component as Presenter
  // This guarantees what you see in Constructor = what you see in Presenter
  const renderCoverPreview = (type: 'main' | 'reflection') => {
    const previewSlide = buildSlideForPreview(type);

    // Container dimensions for the preview
    const containerWidth = 500;
    const containerHeight = containerWidth * 0.75; // 4:3 aspect ratio

    // Scale to fit container (base slide is 1024x768)
    const scaleRatio = containerWidth / CASA_BRAND.slide.width;

    return (
      <div
        className="relative rounded-lg overflow-hidden shadow-lg"
        style={{
          width: `${containerWidth}px`,
          height: `${containerHeight}px`,
        }}
      >
        <UniversalSlide
          slide={previewSlide}
          scale={scaleRatio}
          showIndicator={false}
          showLogo={showLogoPreview}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
        >
          <ImageIcon size={20} color={CASA_BRAND.colors.primary.white} />
        </div>
        <div>
          <h3
            style={{
              fontFamily: CASA_BRAND.fonts.heading,
              fontSize: '20px',
              fontWeight: 400,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            Portadas de Liturgia
          </h3>
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '13px',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            Una ilustración Matisse/Picasso para ambas portadas
          </p>
        </div>
      </div>

      {/* Preview Toggle and Alignment Controls */}
      <div className="flex items-center justify-center gap-4">
        {/* Portada type toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPreviewType('main')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              previewType === 'main' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
            }`}
            style={{ fontFamily: CASA_BRAND.fonts.body }}
          >
            Portada Principal
          </button>
          <button
            type="button"
            onClick={() => setPreviewType('reflection')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              previewType === 'reflection' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
            }`}
            style={{ fontFamily: CASA_BRAND.fonts.body }}
          >
            Portada Reflexión
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200" />

        {/* Logo visibility and alignment */}
        <div className="flex items-center gap-2">
          <span
            className="text-xs"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            Logo
          </span>
          <button
            type="button"
            onClick={() => setShowLogoPreview(!showLogoPreview)}
            className={`p-2 rounded transition-colors ${
              showLogoPreview
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            title={showLogoPreview ? 'Ocultar logo' : 'Mostrar logo'}
          >
            {showLogoPreview ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setLogoAlignment('left')}
              disabled={!showLogoPreview}
              className={`p-2 rounded transition-colors ${
                logoAlignment === 'left' && showLogoPreview
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
              title="Logo a la izquierda"
            >
              <AlignLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setLogoAlignment('right')}
              disabled={!showLogoPreview}
              className={`p-2 rounded transition-colors ${
                logoAlignment === 'right' && showLogoPreview
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
              title="Logo a la derecha"
            >
              <AlignRight size={16} />
            </button>
          </div>
        </div>

        {/* Text alignment toggle */}
        <div className="flex items-center gap-2">
          <span
            className="text-xs"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            Texto
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setTextAlignment('left')}
              className={`p-2 rounded transition-colors ${
                textAlignment === 'left'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title="Texto a la izquierda"
            >
              <AlignLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setTextAlignment('right')}
              className={`p-2 rounded transition-colors ${
                textAlignment === 'right'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title="Texto a la derecha"
            >
              <AlignRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="max-w-2xl mx-auto">
        {renderCoverPreview(previewType)}
      </div>

      {/* Image Controls Section - Only show when illustration is selected */}
      {selectedIllustration && (
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
              <span
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  fontWeight: 500,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                Ajustes de ilustración
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isConfigModified && (
                <button
                  type="button"
                  onClick={resetIllustrationConfig}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-gray-100 transition-colors"
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    color: CASA_BRAND.colors.secondary.grayMedium,
                  }}
                >
                  <RotateCcw size={12} />
                  Restaurar
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowImageControls(!showImageControls)}
                className="px-3 py-1 rounded text-xs transition-colors"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  backgroundColor: showImageControls
                    ? CASA_BRAND.colors.primary.amber
                    : CASA_BRAND.colors.secondary.grayLight,
                  color: showImageControls
                    ? CASA_BRAND.colors.primary.white
                    : CASA_BRAND.colors.primary.black,
                }}
              >
                {showImageControls ? 'Ocultar' : 'Ajustar'}
              </button>
            </div>
          </div>

          {showImageControls ? (
            <div className="space-y-5">
              {/* Opacity Slider */}
              <div>
                <div className="flex justify-between mb-2">
                  <label
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '13px',
                      color: CASA_BRAND.colors.secondary.grayDark,
                    }}
                  >
                    Opacidad
                  </label>
                  <span
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '13px',
                      color: CASA_BRAND.colors.primary.amber,
                      fontWeight: 500,
                    }}
                  >
                    {illustrationConfig.opacity}%
                  </span>
                </div>
                <Slider
                  value={[illustrationConfig.opacity]}
                  onValueChange={([value]) =>
                    setIllustrationConfig((prev) => ({ ...prev, opacity: value }))
                  }
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Scale Slider */}
              <div>
                <div className="flex justify-between mb-2">
                  <label
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '13px',
                      color: CASA_BRAND.colors.secondary.grayDark,
                    }}
                  >
                    Tamaño
                  </label>
                  <span
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '13px',
                      color: CASA_BRAND.colors.primary.amber,
                      fontWeight: 500,
                    }}
                  >
                    {illustrationConfig.scale}%
                  </span>
                </div>
                <Slider
                  value={[illustrationConfig.scale]}
                  onValueChange={([value]) =>
                    setIllustrationConfig((prev) => ({ ...prev, scale: value }))
                  }
                  min={50}
                  max={200}
                  step={10}
                  className="w-full"
                />
              </div>

              {/* Position X Slider */}
              <div>
                <div className="flex justify-between mb-2">
                  <label
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '13px',
                      color: CASA_BRAND.colors.secondary.grayDark,
                    }}
                  >
                    Posición horizontal
                  </label>
                  <span
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '13px',
                      color: CASA_BRAND.colors.primary.amber,
                      fontWeight: 500,
                    }}
                  >
                    {illustrationConfig.positionX > 0 ? '+' : ''}
                    {illustrationConfig.positionX}%
                  </span>
                </div>
                <Slider
                  value={[illustrationConfig.positionX]}
                  onValueChange={([value]) =>
                    setIllustrationConfig((prev) => ({ ...prev, positionX: value }))
                  }
                  min={-50}
                  max={50}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Position Y Slider */}
              <div>
                <div className="flex justify-between mb-2">
                  <label
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '13px',
                      color: CASA_BRAND.colors.secondary.grayDark,
                    }}
                  >
                    Posición vertical
                  </label>
                  <span
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '13px',
                      color: CASA_BRAND.colors.primary.amber,
                      fontWeight: 500,
                    }}
                  >
                    {illustrationConfig.positionY > 0 ? '+' : ''}
                    {illustrationConfig.positionY}%
                  </span>
                </div>
                <Slider
                  value={[illustrationConfig.positionY]}
                  onValueChange={([value]) =>
                    setIllustrationConfig((prev) => ({ ...prev, positionY: value }))
                  }
                  min={-50}
                  max={50}
                  step={5}
                  className="w-full"
                />
              </div>
            </div>
          ) : (
            <p
              className="text-sm"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              Opacidad: {illustrationConfig.opacity}% · Tamaño: {illustrationConfig.scale}% ·
              Posición: ({illustrationConfig.positionX}, {illustrationConfig.positionY})
            </p>
          )}

          {isConfigModified && (
            <p
              className="mt-2 text-xs"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.primary.amber,
              }}
            >
              ✎ Configuración personalizada
            </p>
          )}
        </div>
      )}

      {/* Illustration Theme Input - Simple field for non-tech users */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
      >
        <label
          className="block mb-2"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            fontWeight: 500,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          ¿Qué ilustración quieres?
        </label>
        <input
          type="text"
          value={illustrationTheme}
          onChange={(e) => setIllustrationTheme(e.target.value)}
          placeholder="Ej: pescadores en un bote, manos orando, paloma volando..."
          className="w-full p-3 rounded-lg border focus:outline-none focus:ring-2"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            borderColor: CASA_BRAND.colors.secondary.grayLight,
            color: CASA_BRAND.colors.primary.black,
          }}
        />
        <p
          className="mt-2 text-xs"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          Describe en español lo que quieres ver. Deja vacío para usar el tema de la liturgia.
        </p>
      </div>

      {/* Prompt Editor Section - Advanced, for tech users */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Edit3 size={16} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
            <span
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                fontWeight: 500,
                color: CASA_BRAND.colors.primary.black,
              }}
            >
              Prompt avanzado
            </span>
          </div>
          <div className="flex items-center gap-2">
            {customPrompt !== defaultPrompt && (
              <button
                type="button"
                onClick={resetPrompt}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-gray-100 transition-colors"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                <RotateCcw size={12} />
                Restaurar
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPromptEditor(!showPromptEditor)}
              className="px-3 py-1 rounded text-xs transition-colors"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                backgroundColor: showPromptEditor
                  ? CASA_BRAND.colors.primary.amber
                  : CASA_BRAND.colors.secondary.grayLight,
                color: showPromptEditor
                  ? CASA_BRAND.colors.primary.white
                  : CASA_BRAND.colors.primary.black,
              }}
            >
              {showPromptEditor ? 'Ocultar' : 'Editar'}
            </button>
          </div>
        </div>

        {showPromptEditor ? (
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={6}
            className="w-full p-3 rounded-lg border resize-none focus:outline-none focus:ring-2"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '13px',
              borderColor: CASA_BRAND.colors.secondary.grayLight,
              color: CASA_BRAND.colors.primary.black,
            }}
            placeholder="Escribe el prompt para generar la ilustración..."
          />
        ) : (
          <p
            className="text-sm line-clamp-2"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            {customPrompt}
          </p>
        )}

        {customPrompt !== defaultPrompt && (
          <p
            className="mt-2 text-xs"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: CASA_BRAND.colors.primary.amber,
            }}
          >
            ✎ Prompt personalizado
          </p>
        )}
      </div>

      {/* Generate Illustrations Button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={generateIllustrations}
          disabled={isGenerating}
          className="flex items-center gap-2 px-6 py-3 rounded-full transition-colors"
          style={{
            backgroundColor: isGenerating
              ? CASA_BRAND.colors.secondary.grayLight
              : CASA_BRAND.colors.primary.black,
            color: CASA_BRAND.colors.primary.white,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Generando estilo Matisse/Picasso...
            </>
          ) : (
            <>
              <RefreshCw size={18} />
              {illustrations.length > 0 ? 'Regenerar' : 'Generar'} Ilustraciones
            </>
          )}
        </button>
      </div>

      {/* Illustration Options */}
      {illustrations.length > 0 && (
        <div>
          <p
            className="text-center mb-4"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            Selecciona una ilustración (se usará en ambas portadas)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {illustrations.map((illustration, index) => {
              const isSelected = selectedIllustration === illustration;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => selectIllustration(illustration)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-offset-2' : ''
                  }`}
                  style={{
                    borderColor: isSelected ? CASA_BRAND.colors.primary.amber : 'transparent',
                    ringColor: CASA_BRAND.colors.primary.amber,
                  }}
                >
                  <img
                    src={getIllustrationUrl(illustration)}
                    alt={`Opción ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <div
                      className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
                    >
                      <Check size={14} color="white" strokeWidth={3} />
                    </div>
                  )}
                  <div
                    className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      color: 'white',
                      fontFamily: CASA_BRAND.fonts.body,
                    }}
                  >
                    {index + 1}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selection Status and Export */}
      {(illustrations.length > 0 || selectedIllustration) && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center gap-4">
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                color: selectedIllustration
                  ? CASA_BRAND.colors.primary.amber
                  : CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {selectedIllustration
                ? '✓ Ilustración seleccionada para ambas portadas'
                : 'Selecciona una ilustración'}
            </p>
            {selectedIllustration && (
              <button
                type="button"
                onClick={() => setPreviewType(previewType === 'main' ? 'reflection' : 'main')}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <Eye size={14} />
                Ver otra portada
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={exportSlides}
            disabled={!selectedIllustration}
            className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.white,
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            <Download size={16} />
            Usar estas portadas
          </button>
        </div>
      )}
    </div>
  );
};

export default Portadas;
