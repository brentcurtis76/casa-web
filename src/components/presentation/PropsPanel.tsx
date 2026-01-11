/**
 * PropsPanel - Right sidebar control for scene props
 * Shows armed props to trigger and active props to hide
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { Look, Prop } from '@/lib/presentation/sceneTypes';
import {
  Play,
  EyeOff,
  Type,
  MessageSquare,
  Image as ImageIcon,
  Sparkles,
  Crosshair,
} from 'lucide-react';

interface PropsPanelProps {
  currentLook: Look | null;
  armedProps: Prop[];
  activeProps: Prop[];
  onShowProp: (propId: string) => void;
  onHideProp: (propId: string) => void;
  onHideAllProps: () => void;
  compact?: boolean;
}

/**
 * Get icon for prop type
 */
function getPropIcon(type: Prop['type']) {
  switch (type) {
    case 'text-overlay':
      return <Type size={14} />;
    case 'lower-third':
      return <MessageSquare size={14} />;
    case 'logo-variation':
      return <ImageIcon size={14} />;
    default:
      return <Sparkles size={14} />;
  }
}

/**
 * Get label for prop type
 */
function getPropTypeLabel(type: Prop['type']): string {
  switch (type) {
    case 'text-overlay':
      return 'Texto';
    case 'lower-third':
      return 'Lower-Third';
    case 'logo-variation':
      return 'Logo';
    default:
      return 'Prop';
  }
}

export const PropsPanel: React.FC<PropsPanelProps> = ({
  currentLook,
  armedProps,
  activeProps,
  onShowProp,
  onHideProp,
  onHideAllProps,
  compact = false,
}) => {
  // No scene loaded
  if (!currentLook) {
    return (
      <div
        className="p-4 text-center"
        style={{
          color: CASA_BRAND.colors.secondary.grayMedium,
          fontFamily: CASA_BRAND.fonts.body,
          fontSize: '13px',
        }}
      >
        <Crosshair
          size={24}
          className="mx-auto mb-2 opacity-50"
          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
        />
        <p>Sin escena activa</p>
        <p className="text-xs mt-1 opacity-70">
          Navega a un elemento para ver sus props
        </p>
      </div>
    );
  }

  const hasArmed = armedProps.length > 0;
  const hasActive = activeProps.length > 0;

  return (
    <div className={compact ? '' : 'p-4'}>
      {/* Scene header */}
      <div
        className="flex items-center justify-between mb-4 pb-3"
        style={{
          borderBottom: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
        }}
      >
        <div>
          <p
            className="text-xs uppercase tracking-wider"
            style={{
              color: CASA_BRAND.colors.secondary.grayMedium,
              fontFamily: CASA_BRAND.fonts.body,
            }}
          >
            Escena Activa
          </p>
          <p
            style={{
              color: CASA_BRAND.colors.primary.white,
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {currentLook.name}
          </p>
        </div>
        {hasActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onHideAllProps}
            className="text-xs gap-1"
            style={{
              color: CASA_BRAND.colors.secondary.grayLight,
            }}
          >
            <EyeOff size={12} />
            Ocultar todo
          </Button>
        )}
      </div>

      {/* Armed props section */}
      {hasArmed && (
        <div className="mb-4">
          <p
            className="text-xs uppercase tracking-wider mb-2 flex items-center gap-2"
            style={{
              color: CASA_BRAND.colors.primary.amber,
              fontFamily: CASA_BRAND.fonts.body,
            }}
          >
            <Crosshair size={12} />
            Armados ({armedProps.length})
          </p>
          <div className="space-y-2">
            {armedProps.map((prop) => (
              <div
                key={prop.id}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{
                  backgroundColor: CASA_BRAND.colors.primary.black,
                  border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="p-1 rounded"
                    style={{
                      backgroundColor: CASA_BRAND.colors.primary.amber + '20',
                      color: CASA_BRAND.colors.primary.amber,
                    }}
                  >
                    {getPropIcon(prop.type)}
                  </span>
                  <div>
                    <p
                      className="text-sm"
                      style={{
                        color: CASA_BRAND.colors.primary.white,
                        fontFamily: CASA_BRAND.fonts.body,
                      }}
                    >
                      {prop.name}
                    </p>
                    <p
                      className="text-xs"
                      style={{
                        color: CASA_BRAND.colors.secondary.grayMedium,
                        fontFamily: CASA_BRAND.fonts.body,
                      }}
                    >
                      {getPropTypeLabel(prop.type)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => onShowProp(prop.id)}
                  className="gap-1"
                  style={{
                    backgroundColor: CASA_BRAND.colors.primary.amber,
                    color: CASA_BRAND.colors.primary.black,
                    fontFamily: CASA_BRAND.fonts.body,
                    fontWeight: 600,
                  }}
                >
                  <Play size={12} />
                  Mostrar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active props section */}
      {hasActive && (
        <div>
          <p
            className="text-xs uppercase tracking-wider mb-2 flex items-center gap-2"
            style={{
              color: '#22c55e',
              fontFamily: CASA_BRAND.fonts.body,
            }}
          >
            <Sparkles size={12} />
            En Pantalla ({activeProps.length})
          </p>
          <div className="space-y-2">
            {activeProps.map((prop) => (
              <div
                key={prop.id}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{
                  backgroundColor: '#22c55e15',
                  border: `1px solid #22c55e30`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="p-1 rounded"
                    style={{
                      backgroundColor: '#22c55e30',
                      color: '#22c55e',
                    }}
                  >
                    {getPropIcon(prop.type)}
                  </span>
                  <div>
                    <p
                      className="text-sm"
                      style={{
                        color: CASA_BRAND.colors.primary.white,
                        fontFamily: CASA_BRAND.fonts.body,
                      }}
                    >
                      {prop.name}
                    </p>
                    <p
                      className="text-xs"
                      style={{
                        color: CASA_BRAND.colors.secondary.grayMedium,
                        fontFamily: CASA_BRAND.fonts.body,
                      }}
                    >
                      {getPropTypeLabel(prop.type)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onHideProp(prop.id)}
                  className="gap-1 hover:bg-white/10"
                  style={{
                    borderColor: CASA_BRAND.colors.secondary.grayMedium,
                    backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                    color: CASA_BRAND.colors.primary.white,
                    fontFamily: CASA_BRAND.fonts.body,
                  }}
                >
                  <EyeOff size={12} />
                  Ocultar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasArmed && !hasActive && (
        <div
          className="text-center py-6"
          style={{
            color: CASA_BRAND.colors.secondary.grayMedium,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
          }}
        >
          <p>No hay props en esta escena</p>
        </div>
      )}
    </div>
  );
};

export default PropsPanel;
