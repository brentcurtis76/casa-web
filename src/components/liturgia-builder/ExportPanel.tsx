/**
 * ExportPanel - Panel de exportacion para liturgias
 * Permite presentar liturgia, descargar materiales y generar actividades infantiles
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  Download,
  Loader2,
  Check,
  BookOpen,
  Play,
  Monitor,
  Heart,
  ExternalLink,
  Globe,
  Send,
} from 'lucide-react';
import type { LiturgyElement, LiturgyElementType, LiturgyContext } from '@/types/shared/liturgy';
import type { Story } from '@/types/shared/story';
import type { ChildrenPublicationStateRow } from '@/types/childrenPublicationState';
import { exportLiturgy } from '@/lib/liturgia/exportService';
import { exportStoryToPDF } from '@/lib/cuentacuentos/storyPdfExporter';
import { publishCuentacuento } from '@/lib/publishedResourcesService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthContext';
import { ROLE_NAMES } from '@/types/rbac';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getPublicationsByLiturgyId } from '@/lib/children-ministry/childrenPublicationStateService';
import { supabase } from '@/integrations/supabase/client';
import { ChildrenActivityDialog } from './ChildrenActivityDialog';

interface ExportPanelProps {
  elements: Map<LiturgyElementType, LiturgyElement>;
  elementOrder: LiturgyElementType[];
  liturgyContext: LiturgyContext | null;
  onExportComplete?: (format: string) => void;
}

const ExportPanel: React.FC<ExportPanelProps> = ({
  elements,
  elementOrder,
  liturgyContext,
  onExportComplete,
}) => {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const [exportingCelebrant, setExportingCelebrant] = useState(false);
  const [celebrantCompleted, setCelebrantCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Story PDF export state
  const [exportingStoryPDF, setExportingStoryPDF] = useState(false);
  const [storyPDFCompleted, setStoryPDFCompleted] = useState(false);
  const [storyPDFProgress, setStoryPDFProgress] = useState({ value: 0, message: '' });

  // Story publish state
  const [publishingStory, setPublishingStory] = useState(false);
  const [storyPublished, setStoryPublished] = useState(false);

  // Children activities state
  const [childrenActivityDialogOpen, setChildrenActivityDialogOpen] = useState(false);
  const [childrenSendDialogOpen, setChildrenSendDialogOpen] = useState(false);
  const [sendingChildrenPacket, setSendingChildrenPacket] = useState(false);
  const [childrenPublications, setChildrenPublications] = useState<ChildrenPublicationStateRow[]>([]);
  const [existingChildrenPublication, setExistingChildrenPublication] = useState<ChildrenPublicationStateRow | null>(null);

  // RBAC: Can this user manage children activities?
  const canPublishChildrenActivities = hasRole(ROLE_NAMES.LITURGIST) ||
    hasRole(ROLE_NAMES.CHILDREN_MINISTRY_COORDINATOR) ||
    hasRole(ROLE_NAMES.GENERAL_ADMIN);

  // Load existing children publication state for this liturgy
  const loadPublicationState = useCallback(async () => {
    if (!liturgyContext?.id) return;
    try {
      const childrenPubs = await getPublicationsByLiturgyId(liturgyContext.id);
      setChildrenPublications(childrenPubs);
      if (childrenPubs.length > 0) {
        setExistingChildrenPublication(childrenPubs[0]);
      } else {
        setExistingChildrenPublication(null);
      }
    } catch {
      // Silently fail — children publication state may not exist yet
    }
  }, [liturgyContext?.id]);

  useEffect(() => {
    loadPublicationState();
  }, [loadPublicationState]);

  // Detect if there's a story in the elements
  const storyData = useMemo(() => {
    const cuentacuentosElement = elements.get('cuentacuentos');
    const story = cuentacuentosElement?.config?.storyData as Story | undefined;

    // Debug logging
    if (story) {
      console.log('[ExportPanel] Story found:', {
        title: story.title,
        coverImageUrl: story.coverImageUrl ? 'present' : 'MISSING',
        scenesCount: story.scenes?.length || 0,
        scenesWithImages: story.scenes?.filter((s) => s.selectedImageUrl).length || 0,
        sceneImages: story.scenes?.map((s, i) => `Scene ${i + 1}: ${s.selectedImageUrl ? 'present' : 'MISSING'}`),
      });
    }

    // Story is valid if it has cover image and at least one scene with image
    const isValid = !!(
      story?.coverImageUrl &&
      story?.scenes?.length > 0 &&
      story?.scenes?.some((s) => s.selectedImageUrl)
    );
    return isValid ? story : null;
  }, [elements]);

  // Count slides
  const totalSlides = elementOrder.reduce((count, type) => {
    const element = elements.get(type);
    const slides = element?.slides?.slides || element?.editedSlides?.slides || [];
    return count + slides.length;
  }, 0);

  // Handle celebrant guide export
  const handleExportCelebrant = async () => {
    setExportingCelebrant(true);
    setError(null);

    console.log('[ExportPanel] Exporting celebrant PDF:', elementOrder.length, 'in order,', elements.size, 'in map');

    try {
      await exportLiturgy({
        format: 'pdf-celebrant',
        elements,
        elementOrder,
        liturgyContext,
      });

      setCelebrantCompleted(true);
      onExportComplete?.('pdf-celebrant');
    } catch (err) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setExportingCelebrant(false);
    }
  };

  // Handle story PDF export
  const handleExportStoryPDF = async () => {
    if (!storyData) return;

    setExportingStoryPDF(true);
    setError(null);
    setStoryPDFProgress({ value: 0, message: 'Iniciando...' });

    try {
      const blob = await exportStoryToPDF(storyData, (value, message) => {
        setStoryPDFProgress({ value, message });
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${storyData.title.replace(/\s+/g, '_')}_cuento.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStoryPDFCompleted(true);
      onExportComplete?.('story-pdf');
    } catch (err) {
      console.error('Story PDF export error:', err);
      setError(err instanceof Error ? err.message : 'Error al exportar el cuento');
    } finally {
      setExportingStoryPDF(false);
    }
  };

  // Handle story publish to home page
  const handlePublishCuentacuento = async () => {
    if (!storyData || !liturgyContext?.id) {
      setError('No se puede publicar sin datos del cuento o contexto de liturgia');
      return;
    }

    setPublishingStory(true);
    setError(null);
    setStoryPDFProgress({ value: 0, message: 'Generando PDF...' });

    try {
      // Generate the PDF blob
      const pdfBlob = await exportStoryToPDF(storyData, (value, message) => {
        setStoryPDFProgress({ value: Math.min(value, 80), message });
      });

      setStoryPDFProgress({ value: 90, message: 'Publicando en Home...' });

      // Publish to home page
      await publishCuentacuento({
        liturgyId: liturgyContext.id,
        liturgyDate: new Date(liturgyContext.date),
        title: storyData.title,
        pdfBlob,
      });

      setStoryPDFProgress({ value: 100, message: 'Publicado!' });
      setStoryPublished(true);

      toast({
        title: 'Publicado en Home',
        description: `"${storyData.title}" ya esta disponible en la pagina principal`,
      });

      onExportComplete?.('story-published');
    } catch (err) {
      console.error('Publish error:', err);
      setError(err instanceof Error ? err.message : 'Error al publicar el cuento');
    } finally {
      setPublishingStory(false);
    }
  };

  // Handle send children packet — sends to ALL publications for this liturgy
  const handleSendChildrenPacket = async () => {
    if (!liturgyContext?.id || childrenPublications.length === 0) return;

    setSendingChildrenPacket(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error('Sesion no valida. Inicia sesion nuevamente.');
      }

      const publicationIds = childrenPublications.map((p) => p.id);

      const response = await supabase.functions.invoke('send-children-service-packet', {
        body: { liturgyId: liturgyContext.id, publicationIds },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Error al enviar paquete');
      }

      const result = response.data as { success: boolean; sent: number; failed: number; errors: string[]; error?: string };

      if (result.error && !result.success) {
        throw new Error(result.error);
      }

      toast({
        title: 'Paquete enviado',
        description: `${result.sent} correo${result.sent !== 1 ? 's' : ''} enviado${result.sent !== 1 ? 's' : ''}${result.failed > 0 ? `, ${result.failed} fallido${result.failed !== 1 ? 's' : ''}` : ''}`,
      });

      setChildrenSendDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar paquete a voluntarios');
    } finally {
      setSendingChildrenPacket(false);
    }
  };

  // Open presenter in new tab
  const handleOpenPresenter = () => {
    window.open('/presenter', '_blank');
  };

  const liturgyTitle = liturgyContext?.title || 'Liturgia';
  const liturgyDate = liturgyContext?.date
    ? new Date(liturgyContext.date).toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="space-y-6">
      {/* Presenter Section */}
      <div
        className="p-6 rounded-xl text-center"
        style={{
          background: `linear-gradient(135deg, ${CASA_BRAND.colors.primary.black} 0%, ${CASA_BRAND.colors.secondary.carbon} 100%)`,
        }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
        >
          <Monitor size={28} style={{ color: CASA_BRAND.colors.primary.black }} />
        </div>
        <h2
          style={{
            fontFamily: CASA_BRAND.fonts.heading,
            fontSize: '24px',
            fontWeight: 300,
            color: CASA_BRAND.colors.primary.white,
            letterSpacing: '0.05em',
          }}
        >
          Presentar Liturgia
        </h2>
        <p
          className="mt-2 mb-4"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            color: CASA_BRAND.colors.secondary.grayLight,
          }}
        >
          {liturgyTitle}
          {liturgyDate && ` • ${liturgyDate}`}
          {' • '}{totalSlides} slides
        </p>
        <button
          onClick={handleOpenPresenter}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.amber,
            color: CASA_BRAND.colors.primary.black,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '16px',
          }}
        >
          <Play size={20} />
          Abrir Presentador
          <ExternalLink size={16} />
        </button>
        <p
          className="mt-3"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '12px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          Se abrirá en una nueva pestaña
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="p-4 rounded-lg"
          style={{
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
          }}
        >
          <p style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '14px' }}>{error}</p>
        </div>
      )}

      {/* Downloadables Section */}
      <div className="space-y-4">
        <h3
          className="text-center"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '16px',
            fontWeight: 600,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          Materiales para descargar
        </h3>

        {/* Story PDF - Only show if there's a valid story */}
        {storyData && (
          <div
            className="p-5 rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${CASA_BRAND.colors.primary.amber}15 0%, ${CASA_BRAND.colors.primary.amber}05 100%)`,
              border: `2px solid ${CASA_BRAND.colors.primary.amber}40`,
            }}
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
              >
                <Heart size={22} style={{ color: CASA_BRAND.colors.primary.white }} />
              </div>

              {/* Content */}
              <div className="flex-1">
                <h4
                  style={{
                    fontFamily: CASA_BRAND.fonts.heading,
                    fontSize: '16px',
                    fontWeight: 600,
                    color: CASA_BRAND.colors.primary.black,
                  }}
                >
                  Cuento para Familias
                </h4>
                <p
                  className="mt-1"
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '13px',
                    color: CASA_BRAND.colors.secondary.grayDark,
                  }}
                >
                  PDF ilustrado de "{storyData.title}" para leer en casa
                </p>

                {/* Progress bar when exporting or publishing */}
                {(exportingStoryPDF || publishingStory) && (
                  <div className="mt-3">
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight }}
                    >
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${storyPDFProgress.value}%`,
                          backgroundColor: CASA_BRAND.colors.primary.amber,
                        }}
                      />
                    </div>
                    <p
                      className="mt-1 text-sm"
                      style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                    >
                      {storyPDFProgress.message}
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {/* Download button */}
                  <button
                    onClick={handleExportStoryPDF}
                    disabled={exportingStoryPDF || publishingStory}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                      backgroundColor: CASA_BRAND.colors.primary.amber,
                      color: CASA_BRAND.colors.primary.white,
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '13px',
                    }}
                  >
                    {exportingStoryPDF ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Generando...
                      </>
                    ) : storyPDFCompleted ? (
                      <>
                        <Check size={16} />
                        Descargado
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Descargar PDF
                      </>
                    )}
                  </button>

                  {/* Publish to Home button */}
                  <button
                    onClick={handlePublishCuentacuento}
                    disabled={publishingStory || exportingStoryPDF || !liturgyContext?.id}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                      backgroundColor: storyPublished
                        ? '#16a34a'
                        : CASA_BRAND.colors.primary.black,
                      color: CASA_BRAND.colors.primary.white,
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '13px',
                    }}
                  >
                    {publishingStory ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Publicando...
                      </>
                    ) : storyPublished ? (
                      <>
                        <Check size={16} />
                        Publicado
                      </>
                    ) : (
                      <>
                        <Globe size={16} />
                        Publicar en Home
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Celebrant Guide */}
        <div
          className="p-5 rounded-xl"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.white,
            border: `1px solid ${CASA_BRAND.colors.secondary.grayLight}`,
          }}
        >
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${CASA_BRAND.colors.primary.amber}20` }}
            >
              <BookOpen size={22} style={{ color: CASA_BRAND.colors.primary.amber }} />
            </div>

            {/* Content */}
            <div className="flex-1">
              <h4
                style={{
                  fontFamily: CASA_BRAND.fonts.heading,
                  fontSize: '16px',
                  fontWeight: 600,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                Guía del Celebrante
              </h4>
              <p
                className="mt-1"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '13px',
                  color: CASA_BRAND.colors.secondary.grayDark,
                }}
              >
                PDF con todos los textos, optimizado para iPad o impresión
              </p>

              {/* Download button */}
              <button
                onClick={handleExportCelebrant}
                disabled={exportingCelebrant}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  backgroundColor: celebrantCompleted
                    ? CASA_BRAND.colors.secondary.grayLight
                    : CASA_BRAND.colors.primary.amber,
                  color: celebrantCompleted
                    ? CASA_BRAND.colors.primary.black
                    : CASA_BRAND.colors.primary.white,
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '13px',
                }}
              >
                {exportingCelebrant ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generando...
                  </>
                ) : celebrantCompleted ? (
                  <>
                    <Check size={16} />
                    Descargado
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Descargar PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Children Activities Section */}
      {canPublishChildrenActivities && storyData && (
        <div className="space-y-3">
          <h3
            className="text-center"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '16px',
              fontWeight: 600,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            Actividades de Niños
          </h3>

          <div
            className="p-5 rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${CASA_BRAND.colors.secondary.grayLight}15 0%, ${CASA_BRAND.colors.secondary.grayLight}08 100%)`,
              border: `1px solid ${CASA_BRAND.colors.secondary.grayLight}50`,
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${CASA_BRAND.colors.secondary.grayLight}30` }}
              >
                <Heart size={22} style={{ color: CASA_BRAND.colors.primary.amber }} />
              </div>
              <div className="flex-1">
                <h4
                  style={{
                    fontFamily: CASA_BRAND.fonts.heading,
                    fontSize: '16px',
                    fontWeight: 600,
                    color: CASA_BRAND.colors.primary.black,
                  }}
                >
                  Generar Actividades
                </h4>
                <p
                  className="mt-1"
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '13px',
                    color: CASA_BRAND.colors.secondary.grayDark,
                  }}
                >
                  Crear actividades infantiles adaptadas por grupos de edad desde el cuento
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setChildrenActivityDialogOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                      backgroundColor: CASA_BRAND.colors.primary.amber,
                      color: CASA_BRAND.colors.primary.black,
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '13px',
                    }}
                  >
                    <Heart size={16} />
                    Generar Actividades de Niños
                  </button>

                  {canPublishChildrenActivities && existingChildrenPublication && (
                    <button
                      onClick={() => setChildrenSendDialogOpen(true)}
                      disabled={sendingChildrenPacket}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      style={{
                        backgroundColor: CASA_BRAND.colors.primary.black,
                        color: CASA_BRAND.colors.primary.white,
                        fontFamily: CASA_BRAND.fonts.body,
                        fontSize: '13px',
                      }}
                    >
                      <Send size={16} />
                      Enviar a Voluntarios
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Children Activity Dialog */}
      {storyData && liturgyContext && (
        <ChildrenActivityDialog
          isOpen={childrenActivityDialogOpen}
          onClose={() => setChildrenActivityDialogOpen(false)}
          onSuccess={() => {
            loadPublicationState();
            setChildrenActivityDialogOpen(false);
          }}
          liturgyId={liturgyContext.id}
          liturgyTitle={liturgyContext.title}
          liturgySummary={liturgyContext.summary || ''}
          bibleText={liturgyContext.bibleText || ''}
          liturgyDate={(() => {
            const d = liturgyContext.date instanceof Date
              ? liturgyContext.date
              : new Date(liturgyContext.date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          })()}
          storyData={storyData}
        />
      )}

      {/* Send Children Packet Dialog */}
      <Dialog open={childrenSendDialogOpen} onOpenChange={setChildrenSendDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}>
              Enviar Actividad a Voluntarios
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '14px', color: CASA_BRAND.colors.secondary.grayDark }}>
              Se enviara un correo electronico a todos los voluntarios asignados a las sesiones infantiles de esta actividad con los detalles de la leccion, materiales y fases.
            </p>
            {existingChildrenPublication && (
              <div className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                Version de publicacion: v{existingChildrenPublication.publish_version}
              </div>
            )}
            {sendingChildrenPacket && (
              <div className="flex items-center gap-2 text-sm" style={{ color: CASA_BRAND.colors.primary.amber }}>
                <Loader2 size={14} className="animate-spin" />
                Enviando correos...
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setChildrenSendDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSendChildrenPacket}
              disabled={sendingChildrenPacket}
            >
              {sendingChildrenPacket ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send size={16} className="mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExportPanel;
