/**
 * UniversalSlide - Renderizador universal de slides
 * Soporta todos los tipos de slides del sistema CASA
 * Detecta el sourceComponent para usar el renderizado correcto
 */

import React from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { Slide } from '@/types/shared/slide';

interface UniversalSlideProps {
  slide: Slide;
  scale?: number;
  showIndicator?: boolean;
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

const renderPortadaMain = (slide: Slide, scale: number) => {
  const hasIllustration = slide.content.imageUrl;

  // Get saved config from metadata, with defaults
  const config = slide.metadata?.illustrationConfig as {
    opacity?: number;
    scale?: number;
    positionX?: number;
    positionY?: number;
  } | undefined;
  const textAlign = (slide.metadata?.textAlignment as 'left' | 'right') || 'right';

  const opacity = (config?.opacity ?? 15) / 100;
  const imgScale = config?.scale ?? 100;
  const posX = config?.positionX ?? 0;
  const posY = config?.positionY ?? 0;

  return (
    <div className="relative w-full h-full">
      {/* Background Illustration */}
      {hasIllustration && (
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{ opacity }}
        >
          <img
            src={getImageSrc(slide.content.imageUrl!)}
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

      {/* Content - position based on textAlignment */}
      <div
        className="absolute"
        style={{
          bottom: `${32 * scale}px`,
          ...(textAlign === 'right' ? { right: `${32 * scale}px` } : { left: `${32 * scale}px` }),
          textAlign: textAlign,
          maxWidth: '70%',
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontFamily: CASA_BRAND.fonts.heading,
            fontSize: `${28 * scale}px`,
            fontWeight: 300,
            color: CASA_BRAND.colors.primary.black,
            marginBottom: `${12 * scale}px`,
            lineHeight: 1.3,
          }}
        >
          {slide.content.primary}
        </h1>

        {/* Decorative line */}
        <div className={`flex ${textAlign === 'right' ? 'justify-end' : 'justify-start'}`} style={{ marginBottom: `${12 * scale}px` }}>
          <div
            style={{
              width: `${48 * scale}px`,
              height: `${2 * scale}px`,
              backgroundColor: CASA_BRAND.colors.primary.amber,
            }}
          />
        </div>

        {/* Date */}
        <p
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: `${14 * scale}px`,
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
              fontSize: `${11 * scale}px`,
              color: CASA_BRAND.colors.secondary.grayMedium,
              marginTop: `${4 * scale}px`,
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
const renderPortadaReflexion = (slide: Slide, scale: number) => {
  const hasIllustration = slide.content.imageUrl;

  // Get saved config from metadata, with defaults
  const config = slide.metadata?.illustrationConfig as {
    opacity?: number;
    scale?: number;
    positionX?: number;
    positionY?: number;
  } | undefined;
  const textAlign = (slide.metadata?.textAlignment as 'left' | 'right') || 'right';

  const opacity = (config?.opacity ?? 15) / 100;
  const imgScale = config?.scale ?? 100;
  const posX = config?.positionX ?? 0;
  const posY = config?.positionY ?? 0;

  return (
    <div className="relative w-full h-full">
      {/* Background Illustration */}
      {hasIllustration && (
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{ opacity }}
        >
          <img
            src={getImageSrc(slide.content.imageUrl!)}
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

      {/* Content - position based on textAlignment */}
      <div
        className="absolute"
        style={{
          bottom: `${32 * scale}px`,
          ...(textAlign === 'right' ? { right: `${32 * scale}px` } : { left: `${32 * scale}px` }),
          textAlign: textAlign,
          maxWidth: '70%',
        }}
      >
        {/* "Reflexión" label */}
        <p
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: `${11 * scale}px`,
            color: CASA_BRAND.colors.secondary.grayMedium,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            marginBottom: `${16 * scale}px`,
          }}
        >
          Reflexión
        </p>

        {/* Decorative line */}
        <div className={`flex ${textAlign === 'right' ? 'justify-end' : 'justify-start'}`} style={{ marginBottom: `${24 * scale}px` }}>
          <div
            style={{
              width: `${48 * scale}px`,
              height: `${2 * scale}px`,
              backgroundColor: CASA_BRAND.colors.primary.amber,
            }}
          />
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: CASA_BRAND.fonts.heading,
            fontSize: `${28 * scale}px`,
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
              fontSize: `${11 * scale}px`,
              color: CASA_BRAND.colors.secondary.grayMedium,
              marginTop: `${8 * scale}px`,
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
}) => {
  const baseWidth = CASA_BRAND.slide.width;
  const baseHeight = CASA_BRAND.slide.height;

  // Detectar tipo de portada por sourceComponent
  const isPortadaMain = slide.metadata?.sourceComponent === 'portadas-main';
  const isPortadaReflexion = slide.metadata?.sourceComponent === 'portadas-reflection';

  // Renderizar contenido según el tipo de slide
  const renderContent = () => {
    // Portada Principal
    if (isPortadaMain) {
      return renderPortadaMain(slide, scale);
    }

    // Portada de Reflexión
    if (isPortadaReflexion) {
      return renderPortadaReflexion(slide, scale);
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
              fontFamily: CASA_BRAND.fonts.heading,
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
                fontFamily: CASA_BRAND.fonts.body,
                fontWeight: 400,
                fontSize: `${24 * scale}px`,
                color: CASA_BRAND.colors.secondary.grayMedium,
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
              fontFamily: CASA_BRAND.fonts.body,
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
              fontFamily: CASA_BRAND.fonts.body,
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
              fontFamily: CASA_BRAND.fonts.body,
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
              fontFamily: CASA_BRAND.fonts.body,
              fontWeight: 400,
              fontSize: `${32 * scale}px`,
              lineHeight: 1.6,
              color: CASA_BRAND.colors.primary.black,
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
                fontFamily: CASA_BRAND.fonts.body,
                fontWeight: 600,
                fontSize: `${36 * scale}px`,
                lineHeight: 1.6,
                color: CASA_BRAND.colors.primary.amber,
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
              fontFamily: CASA_BRAND.fonts.body,
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
                fontFamily: CASA_BRAND.fonts.body,
                fontWeight: 500,
                fontSize: `${24 * scale}px`,
                color: CASA_BRAND.colors.primary.amber,
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
              fontFamily: CASA_BRAND.fonts.heading,
              fontWeight: 300,
              fontSize: `${48 * scale}px`,
              letterSpacing: '0.05em',
              color: CASA_BRAND.colors.primary.amber,
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
              fontFamily: CASA_BRAND.fonts.body,
              fontWeight: 400,
              fontSize: `${28 * scale}px`,
              lineHeight: 1.7,
              color: CASA_BRAND.colors.secondary.grayDark,
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
            fontFamily: CASA_BRAND.fonts.body,
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
                fontFamily: CASA_BRAND.fonts.body,
                fontWeight: 600,
                fontSize: `${32 * scale}px`,
                lineHeight: 1.7,
                color: CASA_BRAND.colors.primary.amber,
              }}
            >
              {slide.content.secondary}
            </p>
          </>
        )}
      </div>
    );
  };

  const isPortada = isPortadaMain || isPortadaReflexion;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: baseWidth * scale,
        height: baseHeight * scale,
        backgroundColor: slide.style.backgroundColor || CASA_BRAND.colors.primary.white,
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
