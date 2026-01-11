/**
 * LogoOverlay - Muestra el logo CASA sobre el slide en OutputView
 * Posicionado según LogoSettings (global o override por slide)
 */

import React from 'react';
import type { LogoSettings } from '@/lib/presentation/types';

// Path to CASA logo
const CASA_LOGO_PATH = '/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png';

interface LogoOverlayProps {
  settings: LogoSettings;
  slideWidth: number;
  slideHeight: number;
}

export const LogoOverlay: React.FC<LogoOverlayProps> = ({
  settings,
  slideWidth,
  slideHeight,
}) => {
  if (!settings.visible) return null;

  // Calcular tamaño del logo basado en porcentaje del ancho
  const logoSize = (settings.size / 100) * slideWidth;

  // Calcular posición basada en porcentaje
  // x e y representan el centro del logo
  const logoX = (settings.position.x / 100) * slideWidth - logoSize / 2;
  const logoY = (settings.position.y / 100) * slideHeight - logoSize / 2;

  return (
    <img
      src={CASA_LOGO_PATH}
      alt="CASA Logo"
      style={{
        position: 'absolute',
        left: logoX,
        top: logoY,
        width: logoSize,
        height: logoSize,
        opacity: 0.85,
        pointerEvents: 'none',
        zIndex: 10, // Above slides, below lower-thirds
        objectFit: 'contain',
      }}
    />
  );
};

export default LogoOverlay;
