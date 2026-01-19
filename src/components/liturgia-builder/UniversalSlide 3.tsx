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
const renderPortadaMain = (slide: Slide, scale: number) => {
  const hasIllustration = slide.content.imageUrl;

  return (
    <div className="relative w-full h-full">
      {/* Background Illustration */}
      {hasIllustration && (
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{ opacity: 0.9 }}
        >
          <img
            src={slide.content.imageUrl!.startsWith('data:')
              ? slide.content.imageUrl
              : `data:image/png;base64,${slide.content.imageUrl}`}
            alt="Ilustración"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>
      )}

      {/* Logo */}
      <div
        className="absolute"
        style={{
          top: `${24 * scale}px`,
          left: `${24 * scale}px`,
        }}
      >
        <img
          src={CASA_LOGO_PATH}
          alt="CASA Logo"
          style={{
            width: `${48 * scale}px`,
            height: `${48 * scale}px`,
            opacity: 0.8,
          }}
        />
      </div>

      {/* Content - bottom right */}
      <div
        className="absolute"
        style={{
          bottom: `${32 * scale}px`,
          right: `${32 * scale}px`,
          textAlign: 'right',
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
        <div className="flex justify-end" style={{ marginBottom: `${12 * scale}px` }}>
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

  return (
    <div className="relative w-full h-full">
      {/* Background Illustration */}
      {hasIllustration && (
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{ opacity: 0.9 }}
        >
          <img
            src={slide.content.imageUrl!.startsWith('data:')
              ? slide.content.imageUrl
              : `data:image/png;base64,${slide.content.imageUrl}`}
            alt="Ilustración"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>
      )}

      {/* Logo */}
      <div
        className="absolute"
        style={{
          top: `${24 * scale}px`,
          left: `${24 * scale}px`,
        }}
      >
        <img
          src={CASA_LOGO_PATH}
          alt="CASA Logo"
          style={{
            width: `${48 * scale}px`,
            height: `${48 * scale}px`,
            opacity: 0.8,
          }}
        />
      </div>

      {/* Content - bottom right */}
      <div
        className="absolute"
        style={{
          bottom: `${32 * scale}px`,
          right: `${32 * scale}px`,
          textAlign: 'right',
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
        <div className="flex justify-end" style={{ marginBottom: `${24 * scale}px` }}>
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

  // Las portadas tienen su propio logo
  const isPortada = isPortadaMain || isPortadaReflexion;
  const showLogo = !isPortada && slide.type !== 'song-title' && slide.type !== 'title';

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
      {/* Logo CASA (solo para slides que no son portadas ni títulos) */}
      {showLogo && (
        <img
          src={CASA_LOGO_PATH}
          alt="CASA"
          style={{
            position: 'absolute',
            top: CASA_BRAND.slide.padding * scale,
            right: CASA_BRAND.slide.padding * scale,
            width: 32 * scale,
            height: 32 * scale,
            opacity: 0.8,
          }}
        />
      )}

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
