/**
 * PresenterControls - Unified header bar with 4 zones
 * Zone 1: File menu (all file/session operations)
 * Zone 2: Context info (liturgy title/date)
 * Zone 3: Timer display
 * Zone 4: Presentation controls (Go Live, Black, Projector)
 */

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { CASA_BRAND } from '@/lib/brand-kit';
import { TimerClock } from './TimerClock';
import {
  Play,
  Square,
  Monitor,
  FolderOpen,
  ChevronDown,
  Save,
  Download,
  Upload,
  Database,
  ImagePlus,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PresenterControlsProps {
  // Presentation state
  isLive: boolean;
  isBlack: boolean;
  hasData: boolean;
  liveStartTime: Date | null;
  // Liturgy info
  liturgyTitle?: string;
  liturgyDate?: Date;
  // Session state
  currentSessionId: string | null;
  isUpdatingSession: boolean;
  loading: boolean;
  // Handlers - Presentation
  onGoLive: () => void;
  onToggleBlack: () => void;
  onOpenOutput: () => void;
  // Handlers - File operations
  onSelectLiturgy: () => void;
  onExport: () => void;
  onImport: () => void;
  onImportImages?: (files: FileList) => void;
  // Handlers - Session operations
  onSaveSession: () => void;
  onLoadSession: () => void;
  onUpdateSession: () => void;
  onSaveToLiturgy: () => void;
}

export const PresenterControls: React.FC<PresenterControlsProps> = ({
  isLive,
  isBlack,
  hasData,
  liveStartTime,
  liturgyTitle,
  liturgyDate,
  currentSessionId,
  isUpdatingSession,
  loading,
  onGoLive,
  onToggleBlack,
  onOpenOutput,
  onSelectLiturgy,
  onExport,
  onImport,
  onImportImages,
  onSaveSession,
  onLoadSession,
  onUpdateSession,
  onSaveToLiturgy,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onImportImages) {
      onImportImages(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-3 transition-all duration-300"
      style={{
        background: isLive
          ? `linear-gradient(90deg, ${CASA_BRAND.colors.secondary.carbon} 0%, ${CASA_BRAND.colors.primary.amber}10 100%)`
          : CASA_BRAND.colors.secondary.carbon,
        borderBottom: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
        minHeight: '64px',
      }}
    >
      {/* ZONE 1: Context Info / Title (LEFT) */}
      <div className="flex items-center gap-3" style={{ minWidth: '280px' }}>
        {hasData && liturgyTitle ? (
          <div className="flex items-center gap-3">
            <div>
              <h1
                className="truncate max-w-[300px]"
                style={{
                  fontFamily: CASA_BRAND.fonts.heading,
                  fontSize: '16px',
                  fontWeight: 600,
                  color: CASA_BRAND.colors.primary.white,
                }}
              >
                {liturgyTitle}
              </h1>
              {liturgyDate && (
                <p
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '12px',
                    color: CASA_BRAND.colors.secondary.grayMedium,
                  }}
                >
                  {liturgyDate.toLocaleDateString('es-CL', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
            {isLive && (
              <span
                className="px-2 py-1 rounded text-xs font-semibold animate-pulse"
                style={{
                  backgroundColor: `${CASA_BRAND.colors.primary.amber}30`,
                  color: CASA_BRAND.colors.primary.amber,
                }}
              >
                EN VIVO
              </span>
            )}
          </div>
        ) : (
          <span
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            Selecciona una liturgia para comenzar
          </span>
        )}
      </div>

      {/* ZONE 2: Timer (CENTER) */}
      <div className="flex items-center">
        <TimerClock isLive={isLive} liveStartTime={liveStartTime} />
      </div>

      {/* ZONE 3: File Menu + Controls (RIGHT) */}
      <div className="flex items-center gap-2" style={{ justifyContent: 'flex-end' }}>
        {/* File Menu - icon only when not live */}
        <div
          className="transition-opacity duration-200"
          style={{ opacity: isLive ? 0.6 : 1 }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 hover:bg-gray-800/50"
                style={{
                  color: CASA_BRAND.colors.secondary.grayLight,
                }}
                disabled={loading}
                aria-label="Abrir menú de archivo"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <FolderOpen size={18} />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56"
              style={{
                backgroundColor: CASA_BRAND.colors.secondary.carbon,
                borderColor: CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              <DropdownMenuItem
                onClick={onSelectLiturgy}
                style={{ color: CASA_BRAND.colors.primary.white }}
              >
                <FolderOpen size={16} className="mr-2" />
                {hasData ? 'Cambiar Liturgia...' : 'Seleccionar Liturgia...'}
              </DropdownMenuItem>

              {hasData && (
                <>
                  <DropdownMenuSeparator
                    style={{ backgroundColor: CASA_BRAND.colors.secondary.grayDark }}
                  />

                  {/* Sessions submenu */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger
                      style={{ color: CASA_BRAND.colors.primary.white }}
                    >
                      <Database size={16} className="mr-2" />
                      Sesiones
                      {currentSessionId && (
                        <span
                          className="ml-auto px-1.5 py-0.5 text-xs rounded"
                          style={{
                            backgroundColor: CASA_BRAND.colors.primary.amber + '30',
                            color: CASA_BRAND.colors.primary.amber,
                          }}
                        >
                          Activa
                        </span>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent
                      style={{
                        backgroundColor: CASA_BRAND.colors.secondary.carbon,
                        borderColor: CASA_BRAND.colors.secondary.grayDark,
                      }}
                    >
                      <DropdownMenuItem
                        onClick={onSaveSession}
                        style={{ color: CASA_BRAND.colors.primary.white }}
                      >
                        <Save size={16} className="mr-2" />
                        Guardar sesión...
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={onLoadSession}
                        style={{ color: CASA_BRAND.colors.primary.white }}
                      >
                        <FolderOpen size={16} className="mr-2" />
                        Cargar sesión...
                      </DropdownMenuItem>
                      {currentSessionId && (
                        <>
                          <DropdownMenuSeparator
                            style={{ backgroundColor: CASA_BRAND.colors.secondary.grayDark }}
                          />
                          <DropdownMenuItem
                            onClick={onUpdateSession}
                            disabled={isUpdatingSession}
                            style={{ color: CASA_BRAND.colors.primary.amber }}
                          >
                            {isUpdatingSession ? (
                              <Loader2 size={16} className="mr-2 animate-spin" />
                            ) : (
                              <RefreshCw size={16} className="mr-2" />
                            )}
                            Actualizar sesión actual
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSeparator
                    style={{ backgroundColor: CASA_BRAND.colors.secondary.grayDark }}
                  />

                  {/* Import images */}
                  {onImportImages && (
                    <DropdownMenuItem
                      onClick={() => fileInputRef.current?.click()}
                      style={{ color: CASA_BRAND.colors.primary.white }}
                    >
                      <ImagePlus size={16} className="mr-2" />
                      Importar imágenes...
                    </DropdownMenuItem>
                  )}

                  {/* Export/Import presentation */}
                  <DropdownMenuItem
                    onClick={onExport}
                    style={{ color: CASA_BRAND.colors.primary.white }}
                  >
                    <Download size={16} className="mr-2" />
                    Exportar presentación...
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onImport}
                    style={{ color: CASA_BRAND.colors.primary.white }}
                  >
                    <Upload size={16} className="mr-2" />
                    Importar presentación...
                  </DropdownMenuItem>

                  <DropdownMenuSeparator
                    style={{ backgroundColor: CASA_BRAND.colors.secondary.grayDark }}
                  />

                  {/* Save to liturgy */}
                  <DropdownMenuItem
                    onClick={onSaveToLiturgy}
                    style={{ color: CASA_BRAND.colors.primary.white }}
                  >
                    <Database size={16} className="mr-2" />
                    Guardar en liturgia...
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Divider */}
        <div
          className="h-6 w-px mx-1"
          style={{ backgroundColor: CASA_BRAND.colors.secondary.grayDark }}
        />

        {/* Projector button - hidden when live */}
        {!isLive && (
          <Button
            onClick={onOpenOutput}
            variant="ghost"
            size="icon"
            className="h-10 w-10 hover:bg-gray-800/50"
            style={{
              color: CASA_BRAND.colors.secondary.grayLight,
            }}
            title="Abrir proyector"
          >
            <Monitor size={18} />
          </Button>
        )}

        {/* Black screen button */}
        <Button
          onClick={onToggleBlack}
          disabled={!hasData}
          variant="ghost"
          size="icon"
          className={`h-10 w-10 transition-all duration-200 ${!isBlack ? 'hover:bg-gray-800/50' : ''}`}
          style={{
            backgroundColor: isBlack ? CASA_BRAND.colors.primary.black : 'transparent',
            color: isBlack ? CASA_BRAND.colors.primary.white : CASA_BRAND.colors.secondary.grayLight,
            border: isBlack ? `2px solid ${CASA_BRAND.colors.secondary.grayLight}` : 'none',
          }}
          title={isBlack ? 'Salir de negro (B)' : 'Pantalla negra (B)'}
        >
          <Square size={18} />
        </Button>

        {/* GO LIVE / TERMINAR button - Primary CTA */}
        <Button
          onClick={onGoLive}
          disabled={!hasData}
          className="gap-2 h-11 px-6 transition-all duration-200 font-semibold"
          style={{
            backgroundColor: isLive
              ? 'transparent'
              : CASA_BRAND.colors.primary.amber,
            color: isLive ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.primary.black,
            boxShadow: isLive
              ? `0 0 16px ${CASA_BRAND.colors.primary.amber}50`
              : `0 0 16px ${CASA_BRAND.colors.primary.amber}50`,
            border: isLive ? `2px solid ${CASA_BRAND.colors.primary.amber}` : 'none',
            animation: isLive ? 'terminatePulse 1.5s ease-in-out infinite' : 'none',
          }}
        >
          {isLive ? <Square size={18} /> : <Play size={18} />}
          {isLive ? 'Terminar' : 'Go Live'}
        </Button>
      </div>

      {/* Hidden file input for image import - placed outside dropdown for proper focus management */}
      {onImportImages && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default PresenterControls;
