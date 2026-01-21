/**
 * UniversalSlide - Renderizador universal de slides
 * Soporta todos los tipos de slides del sistema CASA
 * Detecta el sourceComponent para usar el renderizado correcto
 */

import React, { useState, useEffect } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { Slide } from '@/types/shared/slide';

/**
 * Post-process an illustration to ensure background matches CASA_BRAND.colors.primary.white
 * This is applied at display time to catch images that weren't processed during generation
 */
async function processIllustrationBackground(imageUrl: string, targetColor: string = CASA_BRAND.colors.primary.white): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();

    // Only set crossOrigin for HTTP/HTTPS URLs, not for data URLs
    if (imageUrl.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(imageUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);

        // Try to get image data - this can fail with SecurityError if canvas is tainted
        let imageData: ImageData;
        try {
          imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch {
          resolve(imageUrl);
          return;
        }

        const data = imageData.data;

        // Parse target color to RGB
        const targetR = parseInt(targetColor.slice(1, 3), 16);
        const targetG = parseInt(targetColor.slice(3, 5), 16);
        const targetB = parseInt(targetColor.slice(5, 7), 16);

        // Replace background pixels with target color
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

          // Replace light grays (checkered pattern)
          if (r > 190 && g > 190 && b > 190) {
            const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
            if (maxDiff < 10) {
              data[i] = targetR;
              data[i + 1] = targetG;
              data[i + 2] = targetB;
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(imageUrl);
      }
    };

    img.onerror = () => {
      resolve(imageUrl);
    };

    img.src = imageUrl;
  });
}

// Path to CASA logo in public folder
const CASA_LOGO_PATH = '/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png';

interface UniversalSlideProps {
  slide: Slide;
  scale?: number;
  showIndicator?: boolean;
  /** Show logo on portadas - only for Constructor preview, not Presenter */
  showLogo?: boolean;
}

/**
 * Separador decorativo con punto ámbar
 */
const Separator: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <div className="flex items-center justify-center" style={{ gap: `${12 * scale}px`, margin: `${16 * scale}px 0` }}>
    <div
      style={{
        width: `${80 * scale}px`,
        height: `${1 * scale}px`,
        backgroundColor: CASA_BRAND.colors.secondary.grayLight,
      }}
    />
    <div
      style={{
        width: `${8 * scale}px`,
        height: `${8 * scale}px`,
        borderRadius: '50%',
        backgroundColor: CASA_BRAND.colors.primary.amber,
      }}
    />
    <div
      style={{
        width: `${80 * scale}px`,
        height: `${1 * scale}px`,
        backgroundColor: CASA_BRAND.colors.secondary.grayLight,
      }}
    />
  </div>
);

/**
 * Renderiza una portada principal
 */
// Helper global para obtener la URL correcta de la imagen
const getImageSrc = (url: string): string => {
  // Si ya es una URL (http/https) o data URL, usarla directamente
  if (url.startsWith('http') || url.startsWith('data:')) {
    return url;
  }
  // Si es base64 puro, agregar el prefijo
  return `data:image/png;base64,${url}`;
};

const renderPortadaMain = (slide: Slide, scale: number, showLogo: boolean, processedImageUrl: string | null) => {
  const hasIllustration = slide.content.imageUrl;

  // Get saved config from metadata, with defaults
  const config = slide.metadata?.illustrationConfig as {
    opacity?: number;
    scale?: number;
    positionX?: number;
    positionY?: number;
  } | undefined;
  const textAlign = (slide.metadata?.textAlignment as 'left' | 'right') || 'right';
  const logoAlign = (slide.metadata?.logoAlignment as 'left' | 'right') || 'right';

  const opacity = (config?.opacity ?? 15) / 100;
  const imgScale = config?.scale ?? 100;
  const posX = config?.positionX ?? 0;
  const posY = config?.positionY ?? 0;

  // Use processed image if available, otherwise fall back to original
  const imageSource = processedImageUrl || getImageSrc(slide.content.imageUrl!);

  return (
    <div className="relative w-full h-full">
      {/* Logo - only shown in Constructor preview, not Presenter */}
      {showLogo && (
        <div
          className="absolute"
          style={{
            top: '4%',
            zIndex: 10,
            ...(logoAlign === 'right' ? { right: '4%' } : { left: '4%' }),
          }}
        >
          <img
            src={CASA_LOGO_PATH}
            alt="CASA Logo"
            style={{
              height: `${60 * scale}px`,
              width: 'auto',
            }}
          />
        </div>
      )}

      {/* Background Illustration */}
      {hasIllustration && (
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{ opacity }}
        >
          <img
            src={imageSource}
            alt="Ilustración"
            style={{
              width: `${imgScale}%`,
              height: `${imgScale}%`,
              objectFit: 'cover',
              transform: `translate(${posX}%, ${posY}%)`,
            }}
          />
        </div>
      )}

      {/* Content - percentage-based to match Constructor preview */}
      <div
        className="absolute"
        style={{
          bottom: '8%',
          ...(textAlign === 'right' ? { right: '8%' } : { left: '8%' }),
          textAlign: textAlign,
          maxWidth: '70%',
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontFamily: CASA_BRAND.fonts.heading,
            fontSize: `${56 * scale}px`,
            fontWeight: 300,
            color: CASA_BRAND.colors.primary.black,
            marginBottom: '3%',
            lineHeight: 1.3,
          }}
        >
          {slide.content.primary}
        </h1>

        {/* Decorative line */}
        <div className={`flex ${textAlign === 'right' ? 'justify-end' : 'justify-start'}`} style={{ marginBottom: '3%' }}>
          <div
            style={{
              width: '10%',
              minWidth: `${40 * scale}px`,
              height: `${4 * scale}px`,
              backgroundColor: CASA_BRAND.colors.primary.amber,
            }}
          />
        </div>

        {/* Date */}
        <p
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: `${28 * scale}px`,
            color: CASA_BRAND.colors.primary.amber,
          }}
        >
          {slide.content.secondary}
        </p>

        {/* Season */}
        {slide.content.subtitle && (
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: `${22 * scale}px`,
              color: CASA_BRAND.colors.secondary.grayMedium,
              marginTop: '1%',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            {slide.content.subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * Renderiza una portada de reflexión
 */
const renderPortadaReflexion = (slide: Slide, scale: number, showLogo: boolean, processedImageUrl: string | null) => {
  const hasIllustration = slide.content.imageUrl;

  // Get saved config from metadata, with defaults
  const config = slide.metadata?.illustrationConfig as {
    opacity?: number;
    scale?: number;
    positionX?: number;
    positionY?: number;
  } | undefined;
  const textAlign = (slide.metadata?.textAlignment as 'left' | 'right') || 'right';
  const logoAlign = (slide.metadata?.logoAlignment as 'left' | 'right') || 'right';

  const opacity = (config?.opacity ?? 15) / 100;
  const imgScale = config?.scale ?? 100;
  const posX = config?.positionX ?? 0;
  const posY = config?.positionY ?? 0;

  // Use processed image if available, otherwise fall back to original
  const imageSource = processedImageUrl || getImageSrc(slide.content.imageUrl!);

  return (
    <div className="relative w-full h-full">
      {/* Logo - only shown in Constructor preview, not Presenter */}
      {showLogo && (
        <div
          className="absolute"
          style={{
            top: '4%',
            zIndex: 10,
            ...(logoAlign === 'right' ? { right: '4%' } : { left: '4%' }),
          }}
        >
          <img
            src={CASA_LOGO_PATH}
            alt="CASA Logo"
            style={{
              height: `${60 * scale}px`,
              width: 'auto',
            }}
          />
        </div>
      )}

      {/* Background Illustration */}
      {hasIllustration && (
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{ opacity }}
        >
          <img
            src={imageSource}
            alt="Ilustración"
            style={{
              width: `${imgScale}%`,
              height: `${imgScale}%`,
              objectFit: 'cover',
              transform: `translate(${posX}%, ${posY}%)`,
            }}
          />
        </div>
      )}

      {/* Content - percentage-based to match Constructor preview */}
      <div
        className="absolute"
        style={{
          bottom: '8%',
          ...(textAlign === 'right' ? { right: '8%' } : { left: '8%' }),
          textAlign: textAlign,
          maxWidth: '70%',
        }}
      >
        {/* "Reflexión" label */}
        <p
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: `${22 * scale}px`,
            color: CASA_BRAND.colors.secondary.grayMedium,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            marginBottom: '4%',
          }}
        >
          Reflexión
        </p>

        {/* Decorative line */}
        <div className={`flex ${textAlign === 'right' ? 'justify-end' : 'justify-start'}`} style={{ marginBottom: '6%' }}>
          <div
            style={{
              width: '10%',
              minWidth: `${40 * scale}px`,
              height: `${4 * scale}px`,
              backgroundColor: CASA_BRAND.colors.primary.amber,
            }}
          />
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: CASA_BRAND.fonts.heading,
            fontSize: `${56 * scale}px`,
            fontWeight: 300,
            color: CASA_BRAND.colors.primary.black,
            lineHeight: 1.3,
          }}
        >
          {slide.content.primary}
        </h1>

        {/* Season */}
        {slide.content.subtitle && (
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: `${22 * scale}px`,
              color: CASA_BRAND.colors.secondary.grayMedium,
              marginTop: '2%',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            {slide.content.subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * Componente principal que renderiza cualquier tipo de slide
 */
export const UniversalSlide: React.FC<UniversalSlideProps> = ({
  slide,
  scale = 1,
  showIndicator = true,
  showLogo = false,
}) => {
  const baseWidth = CASA_BRAND.slide.width;
  const baseHeight = CASA_BRAND.slide.height;

  // Detectar tipo de portada por sourceComponent
  const isPortadaMain = slide.metadata?.sourceComponent === 'portadas-main';
  const isPortadaReflexion = slide.metadata?.sourceComponent === 'portadas-reflection';
  const isPortada = isPortadaMain || isPortadaReflexion;

  // State for processed image URL (for portadas only)
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);

  // Process portada images to ensure background color matches slide background
  useEffect(() => {
    if (!isPortada || !slide.content.imageUrl) {
      setProcessedImageUrl(null);
      return;
    }

    const imageUrl = getImageSrc(slide.content.imageUrl);

    // Process the image to ensure background matches
    processIllustrationBackground(imageUrl)
      .then((processed) => {
        setProcessedImageUrl(processed);
      })
      .catch(() => {
        setProcessedImageUrl(null);
      });
  }, [isPortada, slide.content.imageUrl]);

  // Renderizar contenido según el tipo de slide
  const renderContent = () => {
    // Portada Principal
    if (isPortadaMain) {
      return renderPortadaMain(slide, scale, showLogo, processedImageUrl);
    }

    // Portada de Reflexión
    if (isPortadaReflexion) {
      return renderPortadaReflexion(slide, scale, showLogo, processedImageUrl);
    }

    const type = slide.type;

    // Slides de título genéricos (no portadas)
    if (type === 'song-title' || type === 'title') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center" style={{ padding: `0 ${48 * scale}px` }}>
          <Separator scale={scale} />
          <h1
            className="uppercase tracking-wider whitespace-pre-line"
            style={{
              fontFamily: slide.style.primaryFont || CASA_BRAND.fonts.heading,
              fontWeight: 300,
              fontSize: `${56 * scale}px`,
              color: slide.style.primaryColor || CASA_BRAND.colors.primary.black,
              letterSpacing: '0.05em',
              lineHeight: 1.2,
            }}
          >
            {slide.content.primary}
          </h1>
          {slide.content.subtitle && (
            <p
              style={{
                fontFamily: slide.style.secondaryFont || CASA_BRAND.fonts.body,
                fontWeight: 500,
                fontSize: `${36 * scale}px`,
                color: slide.style.secondaryColor || CASA_BRAND.colors.primary.amber,
                marginTop: `${16 * scale}px`,
              }}
            >
              {slide.content.subtitle}
            </p>
          )}
          <Separator scale={scale} />
        </div>
      );
    }

    // Slides de letra de canción
    if (type === 'song-lyrics') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center" style={{ padding: `0 ${48 * scale}px` }}>
          <p
            className="whitespace-pre-line"
            style={{
              fontFamily: slide.style.primaryFont || CASA_BRAND.fonts.body,
              fontWeight: 400,
              fontSize: `${36 * scale}px`,
              lineHeight: 1.7,
              color: slide.style.primaryColor || CASA_BRAND.colors.primary.black,
            }}
          >
            {slide.content.primary}
          </p>
        </div>
      );
    }

    // Slides de oración - parte del líder
    if (type === 'prayer-leader') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center" style={{ padding: `0 ${48 * scale}px` }}>
          <p
            className="whitespace-pre-line"
            style={{
              fontFamily: slide.style.primaryFont || CASA_BRAND.fonts.body,
              fontWeight: 400,
              fontSize: `${36 * scale}px`,
              lineHeight: 1.7,
              color: slide.style.primaryColor || CASA_BRAND.colors.primary.black,
            }}
          >
            {slide.content.primary}
          </p>
        </div>
      );
    }

    // Slides de oración - respuesta de congregación
    if (type === 'prayer-response') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center" style={{ padding: `0 ${48 * scale}px` }}>
          <p
            className="whitespace-pre-line"
            style={{
              fontFamily: slide.style.primaryFont || CASA_BRAND.fonts.body,
              fontWeight: 600,
              fontSize: `${36 * scale}px`,
              lineHeight: 1.7,
              color: slide.style.primaryColor || CASA_BRAND.colors.primary.amber,
            }}
          >
            {slide.content.primary}
          </p>
        </div>
      );
    }

    // Slides de oración completa (líder + respuesta)
    if (type === 'prayer-full') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center" style={{ padding: `0 ${48 * scale}px` }}>
          <p
            className="whitespace-pre-line"
            style={{
              fontFamily: slide.style.primaryFont || CASA_BRAND.fonts.body,
              fontWeight: 400,
              fontSize: `${32 * scale}px`,
              lineHeight: 1.6,
              color: slide.style.primaryColor || CASA_BRAND.colors.primary.black,
              marginBottom: `${16 * scale}px`,
            }}
          >
            {slide.content.primary}
          </p>
          <Separator scale={scale} />
          {slide.content.secondary && (
            <p
              className="whitespace-pre-line"
              style={{
                fontFamily: slide.style.secondaryFont || CASA_BRAND.fonts.body,
                fontWeight: 600,
                fontSize: `${36 * scale}px`,
                lineHeight: 1.6,
                color: slide.style.secondaryColor || CASA_BRAND.colors.primary.amber,
                marginTop: `${16 * scale}px`,
              }}
            >
              {slide.content.secondary}
            </p>
          )}
        </div>
      );
    }

    // Slides de lectura bíblica
    if (type === 'reading') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center" style={{ padding: `0 ${48 * scale}px` }}>
          <p
            className="whitespace-pre-line italic"
            style={{
              fontFamily: slide.style.primaryFont || CASA_BRAND.fonts.body,
              fontWeight: 400,
              fontSize: `${34 * scale}px`,
              lineHeight: 1.7,
              color: slide.style.primaryColor || CASA_BRAND.colors.primary.black,
            }}
          >
            {slide.content.primary}
          </p>
          {slide.content.subtitle && (
            <p
              style={{
                fontFamily: slide.style.secondaryFont || CASA_BRAND.fonts.body,
                fontWeight: 500,
                fontSize: `${24 * scale}px`,
                color: slide.style.secondaryColor || CASA_BRAND.colors.primary.amber,
                marginTop: `${24 * scale}px`,
              }}
            >
              — {slide.content.subtitle}
            </p>
          )}
        </div>
      );
    }

    // Slides de bendición
    if (type === 'blessing') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center" style={{ padding: `0 ${48 * scale}px` }}>
          <Separator scale={scale} />
          <p
            className="whitespace-pre-line"
            style={{
              fontFamily: slide.style.primaryFont || CASA_BRAND.fonts.heading,
              fontWeight: 300,
              fontSize: `${48 * scale}px`,
              letterSpacing: '0.05em',
              color: slide.style.primaryColor || CASA_BRAND.colors.primary.amber,
              lineHeight: 1.3,
            }}
          >
            {slide.content.primary}
          </p>
          <Separator scale={scale} />
        </div>
      );
    }

    // Slides de anuncio
    if (type === 'announcement') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center" style={{ padding: `0 ${48 * scale}px` }}>
          <p
            className="whitespace-pre-line"
            style={{
              fontFamily: slide.style.primaryFont || CASA_BRAND.fonts.body,
              fontWeight: 400,
              fontSize: `${28 * scale}px`,
              lineHeight: 1.7,
              color: slide.style.primaryColor || CASA_BRAND.colors.secondary.grayDark,
            }}
          >
            {slide.content.primary}
          </p>
        </div>
      );
    }

    // Slides de anuncio con imagen
    if (type === 'announcement-image') {
      return (
        <div className="flex items-center justify-center h-full">
          {slide.content.imageUrl ? (
            <img
              src={slide.content.imageUrl}
              alt="Anuncio"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <p style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              Sin imagen
            </p>
          )}
        </div>
      );
    }

    // Slides en blanco / transición
    if (type === 'blank') {
      return <div className="h-full" />;
    }

    // Slides de video
    if (type === 'video') {
      const videoUrl = slide.content.videoUrl;
      const settings = slide.content.videoSettings;

      if (!videoUrl) {
        return (
          <div
            className="flex flex-col items-center justify-center h-full"
            style={{
              backgroundColor: '#000000',
            }}
          >
            <div
              style={{
                width: `${64 * scale}px`,
                height: `${64 * scale}px`,
                borderRadius: '50%',
                backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: `${16 * scale}px`,
              }}
            >
              <svg
                width={32 * scale}
                height={32 * scale}
                viewBox="0 0 24 24"
                fill="none"
                stroke={CASA_BRAND.colors.secondary.grayMedium}
                strokeWidth={2}
              >
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: `${14 * scale}px`,
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              Video no disponible
            </p>
          </div>
        );
      }

      // For UniversalSlide preview, show a static thumbnail/placeholder
      // Actual video playback is handled by VideoSlideRenderer in Presenter/Output
      return (
        <div
          className="relative flex items-center justify-center h-full"
          style={{
            backgroundColor: '#000000',
          }}
        >
          {/* Video preview icon */}
          <div
            className="flex flex-col items-center gap-3"
          >
            <div
              style={{
                width: `${80 * scale}px`,
                height: `${80 * scale}px`,
                borderRadius: '50%',
                backgroundColor: CASA_BRAND.colors.primary.amber + '30',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width={40 * scale}
                height={40 * scale}
                viewBox="0 0 24 24"
                fill={CASA_BRAND.colors.primary.amber}
              >
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: `${16 * scale}px`,
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              Video
            </p>
            {/* Settings indicators */}
            <div
              className="flex items-center gap-2"
              style={{
                fontSize: `${11 * scale}px`,
                color: CASA_BRAND.colors.secondary.grayMedium,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              {settings?.autoPlay && <span>Auto</span>}
              {settings?.loop && <span>Repetir</span>}
              {settings?.muted && <span>Mudo</span>}
            </div>
          </div>
        </div>
      );
    }

    // Slides de cuentacuentos - SOLO IMAGEN, sin texto
    if (type === 'story-cover' || type === 'story-scene' || type === 'story-end') {
      const hasImage = slide.content.imageUrl;

      if (hasImage) {
        // Mostrar solo la imagen a pantalla completa
        return (
          <div className="w-full h-full">
            <img
              src={getImageSrc(slide.content.imageUrl!)}
              alt={type === 'story-cover' ? 'Portada' : type === 'story-end' ? 'Fin' : 'Escena'}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        );
      } else {
        // Placeholder cuando no hay imagen
        return (
          <div
            className="flex flex-col items-center justify-center h-full"
            style={{
              backgroundColor: CASA_BRAND.colors.secondary.grayLight + '30',
            }}
          >
            <div
              style={{
                width: `${64 * scale}px`,
                height: `${64 * scale}px`,
                borderRadius: '50%',
                backgroundColor: CASA_BRAND.colors.secondary.grayLight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: `${16 * scale}px`,
              }}
            >
              <span style={{ fontSize: `${32 * scale}px` }}>🖼️</span>
            </div>
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: `${14 * scale}px`,
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {type === 'story-cover' ? 'Portada del cuento' : type === 'story-end' ? 'Imagen final' : 'Imagen de escena'}
            </p>
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: `${11 * scale}px`,
                color: CASA_BRAND.colors.secondary.grayLight,
                marginTop: `${4 * scale}px`,
              }}
            >
              (Pendiente de generar)
            </p>
          </div>
        );
      }
    }

    // Default: mostrar contenido genérico
    return (
      <div className="flex flex-col items-center justify-center h-full text-center" style={{ padding: `0 ${48 * scale}px` }}>
        <p
          className="whitespace-pre-line"
          style={{
            fontFamily: slide.style.primaryFont || CASA_BRAND.fonts.body,
            fontWeight: 400,
            fontSize: `${32 * scale}px`,
            lineHeight: 1.7,
            color: slide.style.primaryColor || CASA_BRAND.colors.primary.black,
          }}
        >
          {slide.content.primary || '(Sin contenido)'}
        </p>
        {slide.content.secondary && (
          <>
            <Separator scale={scale} />
            <p
              className="whitespace-pre-line"
              style={{
                fontFamily: slide.style.secondaryFont || CASA_BRAND.fonts.body,
                fontWeight: 600,
                fontSize: `${32 * scale}px`,
                lineHeight: 1.7,
                color: slide.style.secondaryColor || CASA_BRAND.colors.primary.amber,
              }}
            >
              {slide.content.secondary}
            </p>
          </>
        )}
      </div>
    );
  };

  // For portadas, always use brand background color to ensure image background matches
  // This handles both new slides and legacy slides saved with wrong color
  const slideBackgroundColor = isPortada
    ? CASA_BRAND.colors.primary.white
    : (slide.style.backgroundColor || CASA_BRAND.colors.primary.white);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: baseWidth * scale,
        height: baseHeight * scale,
        backgroundColor: slideBackgroundColor,
        borderRadius: `${CASA_BRAND.ui.borderRadius.md}px`,
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      }}
    >
      {/* Contenido */}
      {renderContent()}

      {/* Indicador de slide (no para portadas) */}
      {showIndicator && !isPortada && slide.metadata && (
        <div
          className="absolute"
          style={{
            bottom: `${16 * scale}px`,
            right: `${16 * scale}px`,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: `${18 * scale}px`,
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          {slide.metadata.order}/{slide.metadata.groupTotal}
        </div>
      )}
    </div>
  );
};

export default UniversalSlide;
