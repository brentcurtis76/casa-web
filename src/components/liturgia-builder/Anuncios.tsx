/**
 * Anuncios - Componente CRUD para gestionar anuncios de la liturgia
 * Permite crear, editar y eliminar anuncios que se mostrarán como slides
 * También permite seleccionar anuncios creados en el Generador de Gráficos
 */

import React, { useState, useEffect } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  Megaphone,
  Plus,
  Edit,
  Trash2,
  GripVertical,
  Calendar,
  Link as LinkIcon,
  Image as ImageIcon,
  X,
  Check,
  Database,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { Slide, SlideGroup } from '@/types/shared/slide';
import type { AnnouncementConfig } from '@/types/shared/liturgy';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';

// Type for graphics batches from Supabase
interface GraphicsBatch {
  id: string;
  name: string;
  event_type: string;
  event_date: string | null;
  event_time: string | null;
  event_location: string | null;
  created_at: string;
  metadata: {
    titles?: Record<string, string>;
  } | null;
}

// Type for graphics items (individual format images)
interface GraphicsItem {
  id: string;
  batch_id: string;
  format: string;
  image_url: string;
  width: number;
  height: number;
}

interface AnunciosProps {
  announcements: AnnouncementConfig[];
  onChange: (announcements: AnnouncementConfig[]) => void;
  onSlidesGenerated?: (slides: SlideGroup) => void;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  mesa_abierta: 'La Mesa Abierta',
  culto_dominical: 'Culto Dominical',
  estudio_biblico: 'Estudio Bíblico',
  retiro: 'Retiro',
  navidad: 'Navidad',
  cuaresma: 'Cuaresma',
  pascua: 'Pascua',
  bautismo: 'Bautismo',
  comunidad: 'Comunidad',
  musica: 'Música / Coro',
  oracion: 'Oración',
  generic: 'General',
};

const Anuncios: React.FC<AnunciosProps> = ({
  announcements,
  onChange,
  onSlidesGenerated,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<AnnouncementConfig | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [slidesGenerated, setSlidesGenerated] = useState(false);

  // State for graphics batches selector
  const [showBatchSelector, setShowBatchSelector] = useState(false);
  const [graphicsBatches, setGraphicsBatches] = useState<GraphicsBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchesError, setBatchesError] = useState<string | null>(null);

  // Fetch graphics batches from Supabase
  const fetchBatches = async () => {
    setLoadingBatches(true);
    setBatchesError(null);
    try {
      const { data, error } = await supabase
        .from('casa_graphics_batches')
        .select('id, name, event_type, event_date, event_time, event_location, created_at, metadata')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setGraphicsBatches(data || []);
    } catch (err) {
      console.error('Error fetching graphics batches:', err);
      setBatchesError('Error al cargar anuncios guardados');
    } finally {
      setLoadingBatches(false);
    }
  };

  // Auto-generate slides whenever announcements change
  // This ensures slides are always in sync with the config,
  // so the Presenter can find them when loading from the database
  useEffect(() => {
    if (announcements.length > 0 && onSlidesGenerated) {
      const slideGroup = generateSlides();
      onSlidesGenerated(slideGroup);
      setSlidesGenerated(true);
    }
  }, [announcements]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load batches when selector is opened
  useEffect(() => {
    if (showBatchSelector) {
      fetchBatches();
    }
  }, [showBatchSelector]);

  // Convert graphics batch to AnnouncementConfig
  const batchToAnnouncement = (batch: GraphicsBatch): AnnouncementConfig => {
    const title = batch.metadata?.titles?.ppt_4_3 || batch.name;
    const dateTime = batch.event_time
      ? `${batch.event_date || ''} - ${batch.event_time}`.trim()
      : batch.event_date || '';

    return {
      title: title.replace(/\\n/g, ' '),
      content: EVENT_TYPE_LABELS[batch.event_type] || batch.event_type,
      date: dateTime,
      location: batch.event_location || undefined,
      priority: 'medium',
    };
  };

  // Add batch as announcement - fetch the PPT 4:3 image
  const handleSelectBatch = async (batch: GraphicsBatch) => {
    // Fetch the PPT 4:3 format image from casa_graphics_items
    const { data: items } = await supabase
      .from('casa_graphics_items')
      .select('image_url')
      .eq('batch_id', batch.id)
      .eq('format', 'ppt_4_3')
      .single();

    const imageUrl = items?.image_url || undefined;

    const announcement: AnnouncementConfig = {
      ...batchToAnnouncement(batch),
      imageUrl,
    };

    const newAnnouncements = [...announcements, announcement];
    setSlidesGenerated(false);
    onChange(newAnnouncements);
    setShowBatchSelector(false);
  };

  // Check if a batch is already added
  const isBatchAlreadyAdded = (batch: GraphicsBatch): boolean => {
    const title = (batch.metadata?.titles?.ppt_4_3 || batch.name).replace(/\\n/g, ' ');
    return announcements.some(a => a.title === title);
  };

  // Create new announcement
  const createNewAnnouncement = (): AnnouncementConfig => ({
    title: '',
    content: '',
    priority: 'medium',
  });

  // Start adding new announcement
  const handleAddNew = () => {
    setIsAddingNew(true);
    setEditingIndex(null);
    setEditForm(createNewAnnouncement());
    setShowBatchSelector(false);
  };

  // Start editing an announcement
  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setIsAddingNew(false);
    setEditForm({ ...announcements[index] });
  };

  // Cancel editing
  const handleCancel = () => {
    setEditingIndex(null);
    setIsAddingNew(false);
    setEditForm(null);
  };

  // Save announcement
  const handleSave = () => {
    if (!editForm || !editForm.title.trim()) {
      return;
    }

    setSlidesGenerated(false);
    if (isAddingNew) {
      onChange([...announcements, editForm]);
    } else if (editingIndex !== null) {
      const updated = [...announcements];
      updated[editingIndex] = editForm;
      onChange(updated);
    }

    handleCancel();
  };

  // Delete announcement
  const handleDelete = (index: number) => {
    setSlidesGenerated(false);
    const updated = announcements.filter((_, i) => i !== index);
    onChange(updated);
  };

  // Move announcement up
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...announcements];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  // Move announcement down
  const handleMoveDown = (index: number) => {
    if (index === announcements.length - 1) return;
    const updated = [...announcements];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  // Generate slides - use images when available
  const generateSlides = (): SlideGroup => {
    const groupId = uuidv4();
    const slides: Slide[] = [];

    // For each announcement, create a slide
    announcements.forEach((announcement, index) => {
      // If we have an image URL, use image slide type
      if (announcement.imageUrl) {
        slides.push({
          id: uuidv4(),
          type: 'announcement-image',
          content: {
            primary: announcement.title,
            imageUrl: announcement.imageUrl,
          },
          style: {
            backgroundColor: CASA_BRAND.colors.primary.white,
          },
          metadata: {
            sourceComponent: 'anuncios',
            sourceId: groupId,
            order: index + 1,
            groupTotal: announcements.length,
          },
        });
      } else {
        // Fallback to text slide
        slides.push({
          id: uuidv4(),
          type: 'announcement',
          content: {
            primary: announcement.title,
            secondary: announcement.content,
            subtitle: announcement.date,
          },
          style: {
            primaryColor: CASA_BRAND.colors.primary.black,
            secondaryColor: CASA_BRAND.colors.secondary.grayMedium,
            backgroundColor: CASA_BRAND.colors.primary.white,
            primaryFont: CASA_BRAND.fonts.heading,
            secondaryFont: CASA_BRAND.fonts.body,
          },
          metadata: {
            sourceComponent: 'anuncios',
            sourceId: groupId,
            order: index + 1,
            groupTotal: announcements.length,
          },
        });
      }
    });

    return {
      id: groupId,
      type: 'announcement',
      title: 'Anuncios',
      slides,
      metadata: {
        sourceComponent: 'anuncios',
        createdAt: new Date().toISOString(),
      },
    };
  };

  // Handle generate slides
  const handleGenerateSlides = () => {
    if (announcements.length === 0) return;
    const slideGroup = generateSlides();
    onSlidesGenerated?.(slideGroup);
    setSlidesGenerated(true);
  };

  // Render form
  const renderForm = () => {
    if (!editForm) return null;

    return (
      <div
        className="p-4 rounded-lg border-2"
        style={{
          borderColor: CASA_BRAND.colors.primary.amber,
          backgroundColor: `${CASA_BRAND.colors.amber.light}10`,
        }}
      >
        <h4
          className="mb-4"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            fontWeight: 600,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          {isAddingNew ? 'Nuevo Anuncio' : 'Editar Anuncio'}
        </h4>

        <div className="space-y-4">
          {/* Image Preview (if has image from batch) */}
          {editForm.imageUrl && (
            <div className="flex items-start gap-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div
                className="w-32 aspect-[4/3] rounded overflow-hidden flex-shrink-0 border"
                style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
              >
                <img
                  src={editForm.imageUrl}
                  alt={editForm.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <p
                  className="flex items-center gap-1 text-sm font-medium"
                  style={{ color: CASA_BRAND.colors.primary.amber }}
                >
                  <ImageIcon size={14} />
                  Imagen incluida del Generador de Gráficos
                </p>
                <p
                  className="mt-1 text-xs"
                  style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                >
                  Esta imagen se usará en la proyección. Los detalles de texto que agregues aquí aparecerán en la Guía del Celebrante.
                </p>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label
              className="block mb-1"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
                fontWeight: 600,
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              Título *
            </label>
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              placeholder="Ej: Jornada de oración"
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                borderColor: CASA_BRAND.colors.secondary.grayLight,
              }}
            />
          </div>

          {/* Content */}
          <div>
            <label
              className="block mb-1"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
                fontWeight: 600,
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              Contenido (para la Guía del Celebrante)
            </label>
            <textarea
              value={editForm.content}
              onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
              placeholder="Descripción del anuncio..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 resize-none"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                borderColor: CASA_BRAND.colors.secondary.grayLight,
              }}
            />
          </div>

          {/* Date, Location, Presenter Row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Presenter */}
            <div>
              <label
                className="flex items-center gap-1 mb-1"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '12px',
                  fontWeight: 600,
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                🎤
                Quién da el anuncio
              </label>
              <input
                type="text"
                value={editForm.presenter || ''}
                onChange={(e) => setEditForm({ ...editForm, presenter: e.target.value })}
                placeholder="Ej: María García"
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  borderColor: CASA_BRAND.colors.secondary.grayLight,
                }}
              />
            </div>

            {/* Date */}
            <div>
              <label
                className="flex items-center gap-1 mb-1"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '12px',
                  fontWeight: 600,
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                <Calendar size={12} />
                Fecha del evento
              </label>
              <input
                type="text"
                value={editForm.date || ''}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                placeholder="Ej: Sábado 15 de enero"
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  borderColor: CASA_BRAND.colors.secondary.grayLight,
                }}
              />
            </div>

            {/* Location */}
            <div>
              <label
                className="flex items-center gap-1 mb-1"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '12px',
                  fontWeight: 600,
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                📍
                Lugar
              </label>
              <input
                type="text"
                value={editForm.location || ''}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                placeholder="Ej: Salón parroquial"
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  borderColor: CASA_BRAND.colors.secondary.grayLight,
                }}
              />
            </div>
          </div>

          {/* Link */}
          <div>
            <label
              className="flex items-center gap-1 mb-1"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
                fontWeight: 600,
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              <LinkIcon size={12} />
              Enlace (opcional)
            </label>
            <input
              type="url"
              value={editForm.link || ''}
              onChange={(e) => setEditForm({ ...editForm, link: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                borderColor: CASA_BRAND.colors.secondary.grayLight,
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm transition-colors hover:bg-gray-100"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              <X size={14} />
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!editForm.title.trim()}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.amber,
                color: CASA_BRAND.colors.primary.white,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              <Check size={14} />
              Guardar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
          >
            <Megaphone size={20} color={CASA_BRAND.colors.primary.white} />
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
              Anuncios
            </h3>
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '13px',
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {announcements.length} anuncio{announcements.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {!isAddingNew && editingIndex === null && !showBatchSelector && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBatchSelector(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors border"
              style={{
                borderColor: CASA_BRAND.colors.primary.amber,
                color: CASA_BRAND.colors.primary.amber,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              <Database size={16} />
              Seleccionar Anuncio
            </button>
            <button
              type="button"
              onClick={handleAddNew}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.black,
                color: CASA_BRAND.colors.primary.white,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              <Plus size={16} />
              Crear Nuevo
            </button>
          </div>
        )}
      </div>

      {/* Form (when editing or adding) */}
      {(isAddingNew || editingIndex !== null) && renderForm()}

      {/* Graphics Batches Selector */}
      {showBatchSelector && (
        <div
          className="p-4 rounded-lg border-2"
          style={{
            borderColor: CASA_BRAND.colors.primary.amber,
            backgroundColor: `${CASA_BRAND.colors.amber.light}10`,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h4
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                fontWeight: 600,
                color: CASA_BRAND.colors.primary.black,
              }}
            >
              Seleccionar Anuncio del Generador de Gráficos
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchBatches}
                disabled={loadingBatches}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
              >
                <RefreshCw size={16} className={loadingBatches ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={() => setShowBatchSelector(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {loadingBatches ? (
            <div className="flex items-center justify-center py-8">
              <Loader2
                size={24}
                className="animate-spin"
                style={{ color: CASA_BRAND.colors.primary.amber }}
              />
              <span
                className="ml-2"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                Cargando anuncios guardados...
              </span>
            </div>
          ) : batchesError ? (
            <div className="text-center py-8">
              <AlertCircle
                size={32}
                className="mx-auto mb-2"
                style={{ color: '#EF4444' }}
              />
              <p
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  color: '#EF4444',
                }}
              >
                {batchesError}
              </p>
              <button
                type="button"
                onClick={fetchBatches}
                className="mt-2 text-sm underline"
                style={{ color: CASA_BRAND.colors.primary.amber }}
              >
                Reintentar
              </button>
            </div>
          ) : graphicsBatches.length === 0 ? (
            <div className="text-center py-8">
              <Database
                size={32}
                className="mx-auto mb-2"
                style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
              />
              <p
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                No hay anuncios guardados en el Generador de Gráficos.
              </p>
              <button
                type="button"
                onClick={handleAddNew}
                className="mt-2 text-sm underline"
                style={{ color: CASA_BRAND.colors.primary.amber }}
              >
                Crear anuncio manualmente
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {graphicsBatches.map((batch) => {
                const isAdded = isBatchAlreadyAdded(batch);
                return (
                  <button
                    key={batch.id}
                    type="button"
                    onClick={() => !isAdded && handleSelectBatch(batch)}
                    disabled={isAdded}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      isAdded
                        ? 'opacity-50 cursor-not-allowed bg-gray-50'
                        : 'hover:border-amber-400'
                    }`}
                    style={{
                      borderColor: CASA_BRAND.colors.secondary.grayLight,
                      backgroundColor: isAdded ? undefined : CASA_BRAND.colors.primary.white,
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h5
                          style={{
                            fontFamily: CASA_BRAND.fonts.body,
                            fontSize: '14px',
                            fontWeight: 600,
                            color: CASA_BRAND.colors.primary.black,
                          }}
                        >
                          {(batch.metadata?.titles?.ppt_4_3 || batch.name).replace(/\\n/g, ' ')}
                        </h5>
                        <p
                          className="mt-1"
                          style={{
                            fontFamily: CASA_BRAND.fonts.body,
                            fontSize: '12px',
                            color: CASA_BRAND.colors.secondary.grayMedium,
                          }}
                        >
                          {EVENT_TYPE_LABELS[batch.event_type] || batch.event_type}
                          {batch.event_location && ` • ${batch.event_location}`}
                        </p>
                        {batch.event_date && (
                          <p
                            className="mt-1 flex items-center gap-1 text-xs"
                            style={{ color: CASA_BRAND.colors.primary.amber }}
                          >
                            <Calendar size={12} />
                            {batch.event_date}
                            {batch.event_time && ` - ${batch.event_time}`}
                          </p>
                        )}
                      </div>
                      {isAdded ? (
                        <Check
                          size={16}
                          style={{ color: CASA_BRAND.colors.primary.amber }}
                        />
                      ) : (
                        <Plus
                          size={16}
                          style={{ color: CASA_BRAND.colors.primary.amber }}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t mt-4" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
            <button
              type="button"
              onClick={handleAddNew}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: CASA_BRAND.colors.secondary.grayLight,
                color: CASA_BRAND.colors.primary.black,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              <Plus size={14} />
              Crear anuncio manualmente
            </button>
          </div>
        </div>
      )}

      {/* Announcements List */}
      {announcements.length > 0 && !isAddingNew && editingIndex === null && !showBatchSelector && (
        <div className="space-y-3">
          {announcements.map((announcement, index) => (
            <div
              key={index}
              className="p-4 rounded-lg border flex items-start gap-3 group"
              style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
            >
              {/* Drag Handle */}
              <div className="flex flex-col gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <GripVertical size={14} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
                </button>
              </div>

              {/* Image Thumbnail (if available) */}
              {announcement.imageUrl && (
                <div
                  className="w-20 aspect-[4/3] rounded overflow-hidden flex-shrink-0 border"
                  style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                >
                  <img
                    src={announcement.imageUrl}
                    alt={announcement.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h4
                      style={{
                        fontFamily: CASA_BRAND.fonts.body,
                        fontSize: '14px',
                        fontWeight: 600,
                        color: CASA_BRAND.colors.primary.black,
                      }}
                    >
                      {announcement.title}
                    </h4>
                    <p
                      className="mt-1 line-clamp-2"
                      style={{
                        fontFamily: CASA_BRAND.fonts.body,
                        fontSize: '13px',
                        color: CASA_BRAND.colors.secondary.grayMedium,
                      }}
                    >
                      {announcement.content}
                    </p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {announcement.presenter && (
                        <p
                          className="flex items-center gap-1 text-xs"
                          style={{ color: CASA_BRAND.colors.primary.amber }}
                        >
                          🎤 {announcement.presenter}
                        </p>
                      )}
                      {announcement.date && (
                        <p
                          className="flex items-center gap-1 text-xs"
                          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                        >
                          <Calendar size={12} />
                          {announcement.date}
                        </p>
                      )}
                      {announcement.location && (
                        <p
                          className="flex items-center gap-1 text-xs"
                          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                        >
                          📍 {announcement.location}
                        </p>
                      )}
                    </div>
                    {announcement.imageUrl && (
                      <p
                        className="mt-1 flex items-center gap-1 text-xs"
                        style={{ color: CASA_BRAND.colors.primary.amber }}
                      >
                        <ImageIcon size={12} />
                        Imagen 4:3 incluida
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleEdit(index)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                >
                  <Edit size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(index)}
                  className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                  style={{ color: '#EF4444' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {announcements.length === 0 && !isAddingNew && !showBatchSelector && (
        <div
          className="p-8 rounded-lg border-2 border-dashed text-center"
          style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
        >
          <Megaphone
            size={32}
            className="mx-auto mb-3"
            style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
          />
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            No hay anuncios. Selecciona uno del Generador de Gráficos o crea uno nuevo.
          </p>
        </div>
      )}

      {/* Generate Slides Button / Success State */}
      {announcements.length > 0 && !isAddingNew && editingIndex === null && !showBatchSelector && onSlidesGenerated && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          {slidesGenerated && (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-lg"
              style={{
                backgroundColor: `${CASA_BRAND.colors.primary.amber}20`,
                color: CASA_BRAND.colors.primary.amber,
              }}
            >
              <Check size={16} />
              <span
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Slides generados correctamente
              </span>
            </div>
          )}
          <div className={slidesGenerated ? '' : 'ml-auto'}>
            <button
              type="button"
              onClick={handleGenerateSlides}
              className="flex items-center gap-2 px-6 py-2 rounded-full transition-colors"
              style={{
                backgroundColor: slidesGenerated ? CASA_BRAND.colors.secondary.grayMedium : CASA_BRAND.colors.primary.amber,
                color: CASA_BRAND.colors.primary.white,
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              <ImageIcon size={16} />
              {slidesGenerated ? 'Regenerar Slides' : 'Generar Slides'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Anuncios;
