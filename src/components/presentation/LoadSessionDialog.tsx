/**
 * LoadSessionDialog - Dialog para cargar una sesión de presentación guardada
 *
 * Permite a los usuarios seleccionar y cargar sesiones guardadas
 * previamente, restaurando el estado completo de la presentación.
 *
 * Phase 1.6: Presentation Persistence
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FolderOpen, AlertTriangle, Loader2, Calendar, User, Trash2 } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { PresentationSessionSummary } from '@/lib/presentation/types';
import { listSessions, deleteSession } from '@/lib/presentation/sessionService';

interface LoadSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLiturgyId?: string;
  onLoadSession: (sessionId: string) => void;
}

export const LoadSessionDialog: React.FC<LoadSessionDialogProps> = ({
  open,
  onOpenChange,
  currentLiturgyId,
  onLoadSession,
}) => {
  const [sessions, setSessions] = useState<PresentationSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterByLiturgy, setFilterByLiturgy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Load sessions when dialog opens or filter changes
  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const liturgyFilter = filterByLiturgy && currentLiturgyId ? currentLiturgyId : undefined;
      const data = await listSessions(liturgyFilter);
      setSessions(data);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Error al cargar las sesiones'
      );
    } finally {
      setIsLoading(false);
    }
  }, [filterByLiturgy, currentLiturgyId]);

  useEffect(() => {
    if (open) {
      fetchSessions();
    }
  }, [open, fetchSessions]);

  const handleLoadSession = (sessionId: string) => {
    onLoadSession(sessionId);
    onOpenChange(false);
  };

  const handleDeleteClick = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(sessionId);
  };

  const handleConfirmDelete = async (sessionId: string) => {
    setDeletingId(sessionId);
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Error al eliminar la sesión'
      );
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatServiceDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[600px]"
        style={{
          backgroundColor: CASA_BRAND.colors.secondary.carbon,
          borderColor: CASA_BRAND.colors.secondary.grayDark,
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2"
            style={{ color: CASA_BRAND.colors.primary.white }}
          >
            <FolderOpen size={20} style={{ color: CASA_BRAND.colors.primary.amber }} />
            Cargar sesión de presentación
          </DialogTitle>
          <DialogDescription style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
            Selecciona una sesión guardada para continuar donde lo dejaste.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Filter buttons */}
          {currentLiturgyId && (
            <div className="flex gap-2">
              <Button
                variant={!filterByLiturgy ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterByLiturgy(false)}
                style={
                  !filterByLiturgy
                    ? {
                        backgroundColor: CASA_BRAND.colors.primary.amber,
                        color: CASA_BRAND.colors.primary.black,
                      }
                    : {
                        borderColor: CASA_BRAND.colors.secondary.grayDark,
                        color: CASA_BRAND.colors.primary.white,
                      }
                }
              >
                Todas
              </Button>
              <Button
                variant={filterByLiturgy ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterByLiturgy(true)}
                style={
                  filterByLiturgy
                    ? {
                        backgroundColor: CASA_BRAND.colors.primary.amber,
                        color: CASA_BRAND.colors.primary.black,
                      }
                    : {
                        borderColor: CASA_BRAND.colors.secondary.grayDark,
                        color: CASA_BRAND.colors.primary.white,
                      }
                }
              >
                Esta liturgia
              </Button>
            </div>
          )}

          {/* Sessions list */}
          <div
            className="max-h-96 overflow-y-auto space-y-2 rounded-lg"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.black,
              border: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
            }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2
                  size={24}
                  className="animate-spin"
                  style={{ color: CASA_BRAND.colors.primary.amber }}
                />
              </div>
            ) : sessions.length === 0 ? (
              <p
                className="text-center py-12"
                style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
              >
                No hay sesiones guardadas
              </p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="p-4 hover:bg-opacity-50 cursor-pointer transition-colors group"
                  style={{
                    borderBottom: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
                  }}
                  onClick={() => handleLoadSession(session.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = CASA_BRAND.colors.secondary.carbon;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h4
                        className="font-medium truncate"
                        style={{ color: CASA_BRAND.colors.primary.white }}
                      >
                        {session.name}
                      </h4>
                      <p
                        className="text-sm truncate mt-0.5"
                        style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                      >
                        {session.liturgyTitle}
                      </p>
                      {session.description && (
                        <p
                          className="text-xs truncate mt-1"
                          style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                        >
                          {session.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-start gap-2 ml-4">
                      <div className="text-right">
                        <p
                          className="text-sm flex items-center gap-1 justify-end"
                          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                        >
                          <Calendar size={12} />
                          {formatDate(session.createdAt)}
                        </p>
                        <p
                          className="text-xs flex items-center gap-1 justify-end mt-0.5"
                          style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                        >
                          <User size={10} />
                          {session.createdByName}
                        </p>
                      </div>
                      {confirmDeleteId === session.id ? (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelDelete}
                            style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleConfirmDelete(session.id)}
                            disabled={deletingId === session.id}
                            style={{ color: '#ef4444' }}
                          >
                            {deletingId === session.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              'Eliminar'
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleDeleteClick(session.id, e)}
                          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                          aria-label={`Eliminar sesión ${session.name}`}
                          title="Eliminar sesión"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                  {session.serviceDate && (
                    <p
                      className="text-sm mt-2 flex items-center gap-1"
                      style={{ color: CASA_BRAND.colors.primary.amber }}
                    >
                      <span
                        className="px-2 py-0.5 rounded text-xs"
                        style={{
                          backgroundColor: CASA_BRAND.colors.primary.amber + '20',
                        }}
                      >
                        Servicio: {formatServiceDate(session.serviceDate)}
                      </span>
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {loadError && (
            <Alert variant="destructive">
              <AlertTriangle size={16} />
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            style={{
              borderColor: CASA_BRAND.colors.secondary.grayDark,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LoadSessionDialog;
