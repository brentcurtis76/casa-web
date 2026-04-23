/**
 * Portadas — Liturgy cover generator (baked-in-text flow)
 *
 * Generates two cover slides via Gemini 3 Pro Image Preview:
 * - MAIN cover: liturgy title + liturgical season + CASA logo, all rendered
 *   inside the image by Gemini (no Canvas/React text overlay).
 * - REFLECTION cover: image-to-image recomposition from the selected main
 *   cover. Illustration and layout are preserved; text is swapped to the
 *   liturgy title (same as the main cover) + preacher name as subtitle. No
 *   "Reflexión" label — the slide's position in the liturgy signals its role.
 *
 * Format: 4:3 (1024x768). CASA logo is passed as `referenceImage` so Gemini
 * uses the real logo rather than inventing one.
 *
 * Both slides are saved with `metadata.textBakedIn = true` so UniversalSlide
 * renders them full-bleed with no overlays. Legacy slides (pre-refactor) keep
 * rendering via the text-overlay path — no migration needed.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { currentSeason as fallbackSeason } from '@/data/currentSeason';
import { Image as ImageIcon, Loader2, RefreshCw, Check, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Slide, SlideGroup } from '@/types/shared/slide';
import type { LiturgyContext } from '@/types/shared/liturgy';
import { v4 as uuidv4 } from 'uuid';
import { UniversalSlide } from './UniversalSlide';
import {
  buildLiturgyCoverPrompt,
  buildLiturgyReflectionCoverPrompt,
  type GenerateIllustrationResponse,
} from '@/lib/covers/coverPromptBuilder';
import { useCasaLogo } from '@/lib/covers/useCasaLogo';
import { IllustrationThemeInput } from '@/components/covers/IllustrationThemeInput';

interface PortadasProps {
  context: LiturgyContext;
  onSlidesGenerated?: (mainSlides: SlideGroup, reflectionSlides: SlideGroup) => void;
}

const Portadas: React.FC<PortadasProps> = ({ context, onSlidesGenerated }) => {
  const { toast } = useToast();

  // ---- Generation state ----
  const [mainVariations, setMainVariations] = useState<string[]>([]);
  const [selectedMainCover, setSelectedMainCover] = useState<string | null>(null);
  const [reflectionCover, setReflectionCover] = useState<string | null>(null);
  const [isGeneratingMain, setIsGeneratingMain] = useState(false);
  const [isGeneratingReflection, setIsGeneratingReflection] = useState(false);
  const [previewType, setPreviewType] = useState<'main' | 'reflection'>('main');
  const [illustrationTheme, setIllustrationTheme] = useState<string>('');

  // ---- CASA logo as Gemini reference image ----
  const { logoBase64, failed: logoLoadFailed, retry: retryLogoLoad } = useCasaLogo(() => {
    toast({
      title: 'No se pudo cargar el logo CASA',
      description: 'La generación de portadas requiere el logo. Usa el botón Reintentar.',
      variant: 'destructive',
    });
  });

  // ---- Liturgical season (same source as the rest of the app) ----
  const [seasonName, setSeasonName] = useState(fallbackSeason.name);
  useEffect(() => {
    const fetchSeason = async () => {
      const { data, error } = await supabase
        .from('site_config')
        .select('value')
        .eq('key', 'liturgical_season')
        .single();
      if (!error && data?.value) {
        const season = data.value as { name: string };
        if (season.name) setSeasonName(season.name);
      }
    };
    fetchSeason();
  }, []);

  // ---- Main cover generation ----
  const generateMainVariations = async () => {
    if (!logoBase64) {
      toast({
        title: 'Logo no disponible',
        description: 'El logo CASA aún se está cargando. Intenta de nuevo en un momento.',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingMain(true);
    setMainVariations([]);
    setSelectedMainCover(null);
    setReflectionCover(null);

    try {
      const jsonPrompt = buildLiturgyCoverPrompt({
        title: context.title,
        season: seasonName,
        illustrationTheme,
      });

      const { data, error } = await supabase.functions.invoke<GenerateIllustrationResponse>(
        'generate-illustration',
        {
          body: {
            jsonPrompt,
            referenceImage: logoBase64,
            count: 4,
            aspectRatio: '4:3',
          },
        },
      );

      if (error) throw error;

      const valid = (data?.illustrations ?? []).filter((i) => i && i.length > 0);
      if (valid.length === 0) {
        throw new Error('No se pudieron generar portadas');
      }

      setMainVariations(valid);
      toast({
        title: 'Portadas generadas',
        description: `${valid.length} variaciones con texto y logo integrados`,
      });
    } catch (err) {
      console.error('[Portadas] Error generating main cover variations:', err);
      toast({
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'No se pudieron generar las portadas',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingMain(false);
    }
  };

  // ---- Reflection cover generation (image-to-image from the selected main) ----
  // Monotonic request counter guards against races: if the user switches
  // main-cover selections before a prior reflection call returns, the stale
  // response is discarded instead of overwriting the current one.
  const reflectionRequestIdRef = useRef(0);
  const generateReflectionCover = useCallback(
    async (mainCoverBase64: string) => {
      const requestId = ++reflectionRequestIdRef.current;
      setIsGeneratingReflection(true);
      setReflectionCover(null);
      try {
        const referencePrompt = buildLiturgyReflectionCoverPrompt({
          title: context.title,
          preacher: context.preacher ?? '',
        });
        const { data, error } = await supabase.functions.invoke<GenerateIllustrationResponse>(
          'generate-illustration',
          {
            body: {
              referenceImage: mainCoverBase64,
              referencePrompt,
              count: 1,
              aspectRatio: '4:3',
            },
          },
        );
        // If a newer request has started since, abandon this response entirely.
        if (reflectionRequestIdRef.current !== requestId) return;
        if (error) throw error;
        const valid = (data?.illustrations ?? []).filter((i) => i && i.length > 0);
        if (valid.length === 0) {
          throw new Error('No se pudo generar la portada de reflexión');
        }
        setReflectionCover(valid[0]);
      } catch (err) {
        if (reflectionRequestIdRef.current !== requestId) return;
        console.error('[Portadas] Error generating reflection cover:', err);
        toast({
          title: 'Error al generar portada de reflexión',
          description:
            err instanceof Error
              ? err.message
              : 'Intenta seleccionar la portada principal de nuevo',
          variant: 'destructive',
        });
      } finally {
        // Only the latest request is allowed to clear the in-flight flag —
        // earlier (superseded) requests return without touching it.
        if (reflectionRequestIdRef.current === requestId) {
          setIsGeneratingReflection(false);
        }
      }
    },
    [context.preacher, toast],
  );

  // Retry reflection generation manually if it fails
  const retryReflection = () => {
    if (selectedMainCover) {
      generateReflectionCover(selectedMainCover);
    }
  };

  // Selecting a main variation auto-fires the reflection generation
  const selectMainVariation = (base64: string) => {
    setSelectedMainCover(base64);
    generateReflectionCover(base64);
  };

  // ---- Preview slide (consumed by UniversalSlide) ----
  const buildSlideForPreview = useCallback(
    (type: 'main' | 'reflection'): Slide => {
      const base64 = type === 'main' ? selectedMainCover : reflectionCover;
      const imageUrl = base64 ? `data:image/png;base64,${base64}` : undefined;

      return {
        id: `preview-${type}`,
        type: type === 'main' ? 'portada-main' : 'portada-reflection',
        content: {
          primary: context.title,
          // Both cover types render the liturgy title as the hero. Subtitle
          // differs: season label for the main cover, preacher name for the
          // reflection cover. These fields are metadata only (not rendered
          // by UniversalSlide when textBakedIn=true) but are kept accurate
          // for search, export, and accessibility tools.
          subtitle: type === 'reflection' ? context.preacher || undefined : seasonName,
          imageUrl,
        },
        style: {
          backgroundColor: CASA_BRAND.colors.primary.white,
          primaryColor: CASA_BRAND.colors.primary.black,
        },
        metadata: {
          sourceComponent: type === 'main' ? 'portadas-main' : 'portadas-reflection',
          sourceId: `preview-${type}`,
          order: 1,
          groupTotal: 1,
          textBakedIn: true,
        },
      };
    },
    [context.title, context.preacher, seasonName, selectedMainCover, reflectionCover],
  );

  const renderCoverPreview = (type: 'main' | 'reflection') => {
    const base64 = type === 'main' ? selectedMainCover : reflectionCover;
    const containerWidth = 500;
    const containerHeight = containerWidth * 0.75; // 4:3

    // Placeholder before any image is generated for this cover type
    if (!base64) {
      return (
        <div
          className="relative rounded-lg overflow-hidden shadow-lg flex items-center justify-center"
          style={{
            width: `${containerWidth}px`,
            height: `${containerHeight}px`,
            backgroundColor: CASA_BRAND.colors.primary.white,
            border: `1px dashed ${CASA_BRAND.colors.secondary.grayLight}`,
          }}
        >
          <div className="text-center px-6">
            {type === 'reflection' && isGeneratingReflection ? (
              <>
                <Loader2
                  className="animate-spin mx-auto mb-2"
                  size={24}
                  style={{ color: CASA_BRAND.colors.primary.amber }}
                />
                <p
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '13px',
                    color: CASA_BRAND.colors.secondary.grayDark,
                  }}
                >
                  Generando portada de reflexión...
                </p>
              </>
            ) : (
              <p
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '13px',
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                {type === 'main'
                  ? 'Genera y selecciona la portada principal para ver la vista previa'
                  : 'Selecciona la portada principal para generar la de reflexión'}
              </p>
            )}
          </div>
        </div>
      );
    }

    const previewSlide = buildSlideForPreview(type);
    const scaleRatio = containerWidth / CASA_BRAND.slide.width;

    return (
      <div
        className="relative rounded-lg overflow-hidden shadow-lg"
        style={{ width: `${containerWidth}px`, height: `${containerHeight}px` }}
      >
        <UniversalSlide slide={previewSlide} scale={scaleRatio} showIndicator={false} />
      </div>
    );
  };

  // ---- Export both covers as slides ----
  const exportSlides = () => {
    if (!selectedMainCover || !reflectionCover) {
      toast({
        title: 'Portadas incompletas',
        description: 'Espera a que ambas portadas estén generadas antes de guardar',
        variant: 'destructive',
      });
      return;
    }

    const mainGroupId = uuidv4();
    const reflectionGroupId = uuidv4();

    const sharedStyle = {
      primaryColor: CASA_BRAND.colors.primary.black,
      secondaryColor: CASA_BRAND.colors.primary.amber,
      backgroundColor: CASA_BRAND.colors.primary.white,
      primaryFont: CASA_BRAND.fonts.heading,
      secondaryFont: CASA_BRAND.fonts.body,
    };

    const mainSlide: Slide = {
      id: uuidv4(),
      type: 'title',
      content: {
        primary: context.title,
        subtitle: seasonName,
        imageUrl: `data:image/png;base64,${selectedMainCover}`,
      },
      style: sharedStyle,
      metadata: {
        sourceComponent: 'portadas-main',
        sourceId: mainGroupId,
        order: 1,
        groupTotal: 1,
        textBakedIn: true,
      },
    };

    const reflectionSlide: Slide = {
      id: uuidv4(),
      type: 'title',
      content: {
        // Reflection cover uses the liturgy title as its hero (matches the
        // baked image) with the preacher name as a quiet caption. No
        // "Reflexión" text on the cover — its position in the liturgy is
        // what signals it's the reflection section.
        primary: context.title,
        subtitle: context.preacher || undefined,
        imageUrl: `data:image/png;base64,${reflectionCover}`,
      },
      style: sharedStyle,
      metadata: {
        sourceComponent: 'portadas-reflection',
        sourceId: reflectionGroupId,
        order: 1,
        groupTotal: 1,
        textBakedIn: true,
      },
    };

    onSlidesGenerated?.(
      {
        id: mainGroupId,
        type: 'announcement',
        title: 'Portada Principal',
        slides: [mainSlide],
        metadata: { sourceComponent: 'portadas', createdAt: new Date().toISOString() },
      },
      {
        id: reflectionGroupId,
        type: 'announcement',
        title: 'Portada de Reflexión',
        slides: [reflectionSlide],
        metadata: { sourceComponent: 'portadas', createdAt: new Date().toISOString() },
      },
    );

    toast({
      title: '✓ Portadas guardadas',
      description: 'Ahora guarda la liturgia para persistir los cambios',
    });
  };

  const canExport = !!(selectedMainCover && reflectionCover);

  // Concise status string for screen-reader announcement via aria-live.
  const generationStatusForSr = isGeneratingMain
    ? 'Generando portadas principales con texto y logo integrados'
    : isGeneratingReflection
      ? 'Generando portada de reflexión a partir de la portada principal'
      : canExport
        ? 'Ambas portadas están listas'
        : selectedMainCover
          ? 'Selecciona la portada principal para continuar'
          : '';

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
            Texto y logo integrados por Gemini (estilo Matisse/Picasso, 4:3)
          </p>
        </div>
      </div>

      {/* Screen-reader-only live region announcing generation progress */}
      <div className="sr-only" role="status" aria-live="polite">
        {generationStatusForSr}
      </div>

      {/* Preview type toggle */}
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setPreviewType('main')}
          className="px-4 py-2 rounded-full text-sm font-medium transition-colors"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            backgroundColor:
              previewType === 'main'
                ? CASA_BRAND.colors.primary.black
                : CASA_BRAND.colors.secondary.grayLight,
            color:
              previewType === 'main'
                ? CASA_BRAND.colors.primary.white
                : CASA_BRAND.colors.secondary.carbon,
          }}
        >
          Portada Principal
        </button>
        <button
          type="button"
          onClick={() => setPreviewType('reflection')}
          disabled={!selectedMainCover}
          aria-describedby={!selectedMainCover ? 'portada-reflection-disabled-hint' : undefined}
          className="px-4 py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            backgroundColor:
              previewType === 'reflection'
                ? CASA_BRAND.colors.primary.black
                : CASA_BRAND.colors.secondary.grayLight,
            color:
              previewType === 'reflection'
                ? CASA_BRAND.colors.primary.white
                : CASA_BRAND.colors.secondary.carbon,
          }}
        >
          Portada Reflexión
          {isGeneratingReflection && (
            <Loader2 className="inline ml-2 animate-spin" size={14} aria-hidden="true" />
          )}
        </button>
        <span id="portada-reflection-disabled-hint" className="sr-only">
          Selecciona primero una portada principal
        </span>
      </div>

      {/* Current liturgical season (read-only informational) */}
      <div className="flex items-center justify-center">
        <span
          className="text-xs"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          Temporada:&nbsp;
          <span style={{ color: CASA_BRAND.colors.secondary.grayDark, fontWeight: 500 }}>
            {seasonName}
          </span>
        </span>
      </div>

      {/* Preview */}
      <div className="max-w-2xl mx-auto">{renderCoverPreview(previewType)}</div>

      {/* Illustration theme input (shared component) */}
      <IllustrationThemeInput
        value={illustrationTheme}
        onChange={setIllustrationTheme}
      />

      {/* Persistent warning when the CASA logo (required as a reference image
          for Gemini) failed to load. Gives the user a recovery path rather
          than leaving the Generate button silently disabled. */}
      {logoLoadFailed && !logoBase64 && (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border p-3"
          style={{
            borderColor: CASA_BRAND.colors.amber.dark,
            backgroundColor: CASA_BRAND.colors.primary.white,
          }}
        >
          <p
            className="text-sm"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: CASA_BRAND.colors.secondary.carbon,
            }}
          >
            No se pudo cargar el logo CASA. La generación de portadas lo requiere como referencia.
          </p>
          <button
            type="button"
            onClick={retryLogoLoad}
            className="shrink-0 px-3 py-1 rounded-lg text-sm font-medium"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Generate button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={generateMainVariations}
          disabled={isGeneratingMain || !logoBase64}
          className="flex items-center gap-2 px-6 py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: isGeneratingMain
              ? CASA_BRAND.colors.secondary.grayLight
              : CASA_BRAND.colors.primary.black,
            color: CASA_BRAND.colors.primary.white,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          {isGeneratingMain ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Generando portadas con texto...
            </>
          ) : (
            <>
              <RefreshCw size={18} />
              {mainVariations.length > 0 ? 'Regenerar' : 'Generar'} Portadas
            </>
          )}
        </button>
      </div>

      {/* Main cover variation grid */}
      {mainVariations.length > 0 && (
        <div>
          <p
            className="text-center mb-4"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            Selecciona la portada principal. La portada de reflexión se generará a partir de ella.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {mainVariations.map((variation, index) => {
              const isSelected = selectedMainCover === variation;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => selectMainVariation(variation)}
                  aria-label={`Seleccionar portada opción ${index + 1}`}
                  aria-pressed={isSelected}
                  className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-offset-2' : ''
                  }`}
                  style={{
                    borderColor: isSelected
                      ? CASA_BRAND.colors.primary.amber
                      : 'transparent',
                  }}
                >
                  <img
                    src={`data:image/png;base64,${variation}`}
                    alt=""
                    aria-hidden="true"
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

      {/* Save section */}
      {(mainVariations.length > 0 || selectedMainCover) && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                color: canExport
                  ? CASA_BRAND.colors.primary.amber
                  : CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {canExport
                ? '✓ Ambas portadas listas'
                : selectedMainCover && isGeneratingReflection
                  ? 'Generando portada de reflexión...'
                  : selectedMainCover
                    ? 'Portada de reflexión falló — reintenta'
                    : 'Selecciona una portada principal'}
            </p>
            {selectedMainCover && !reflectionCover && !isGeneratingReflection && (
              <button
                type="button"
                onClick={retryReflection}
                className="text-sm px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  color: CASA_BRAND.colors.secondary.grayDark,
                }}
              >
                Reintentar reflexión
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={exportSlides}
            disabled={!canExport}
            className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.white,
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            <Save size={16} aria-hidden="true" />
            Usar estas portadas
          </button>
        </div>
      )}
    </div>
  );
};

export default Portadas;
