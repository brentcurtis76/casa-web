/**
 * NewSongEditor - Editor para agregar canciones nuevas
 * Permite pegar letra, generar slides automáticamente y editarlos
 */

import React, { useState, useCallback } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { createSlidesFromLyrics, splitLyricsIntoSlides } from '@/lib/songToSlides';
import { saveCustomSong } from '@/lib/songStorage';
import type { Song, Verse } from '@/types/shared/song';
import type { SlideGroup } from '@/types/shared/slide';
import { SongSlide } from './SongSlide';
import { SlidePreview } from './SlidePreview';

interface NewSongEditorProps {
  onSave?: (song: Song) => void;
  onCancel?: () => void;
}

type EditorStep = 'input' | 'preview' | 'edit';

export const NewSongEditor: React.FC<NewSongEditorProps> = ({
  onSave,
  onCancel
}) => {
  // Estado del formulario
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [linesPerSlide, setLinesPerSlide] = useState(4);

  // Estado del editor
  const [step, setStep] = useState<EditorStep>('input');
  const [slideGroup, setSlideGroup] = useState<SlideGroup | null>(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [editingSlideContent, setEditingSlideContent] = useState('');
  const [isEditingSlide, setIsEditingSlide] = useState(false);

  // Errores de validación
  const [errors, setErrors] = useState<string[]>([]);

  // Validar formulario
  const validateForm = useCallback((): boolean => {
    const newErrors: string[] = [];

    if (!title.trim()) {
      newErrors.push('El título es requerido');
    }

    if (!lyrics.trim()) {
      newErrors.push('La letra es requerida');
    }

    if (lyrics.trim().split('\n').filter(l => l.trim()).length < 2) {
      newErrors.push('La letra debe tener al menos 2 líneas');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  }, [title, lyrics]);

  // Generar slides
  const handleGenerateSlides = useCallback(() => {
    if (!validateForm()) return;

    const generated = createSlidesFromLyrics(title, lyrics, linesPerSlide, artist || undefined);
    setSlideGroup(generated);
    setStep('preview');
  }, [title, lyrics, linesPerSlide, artist, validateForm]);

  // Editar slide individual
  const handleEditSlide = (index: number) => {
    if (!slideGroup) return;
    setSelectedSlideIndex(index);
    setEditingSlideContent(slideGroup.slides[index].content.primary);
    setIsEditingSlide(true);
  };

  // Guardar edición de slide
  const handleSaveSlideEdit = () => {
    if (!slideGroup) return;

    const updatedSlides = [...slideGroup.slides];
    updatedSlides[selectedSlideIndex] = {
      ...updatedSlides[selectedSlideIndex],
      content: {
        ...updatedSlides[selectedSlideIndex].content,
        primary: editingSlideContent
      }
    };

    setSlideGroup({
      ...slideGroup,
      slides: updatedSlides
    });

    setIsEditingSlide(false);
  };

  // Dividir slide en dos
  const handleSplitSlide = (index: number) => {
    if (!slideGroup || index === 0) return; // No dividir título

    const slide = slideGroup.slides[index];
    const lines = slide.content.primary.split('\n');

    if (lines.length < 2) return;

    const midpoint = Math.ceil(lines.length / 2);
    const firstHalf = lines.slice(0, midpoint).join('\n');
    const secondHalf = lines.slice(midpoint).join('\n');

    const newSlides = [...slideGroup.slides];

    // Actualizar slide actual
    newSlides[index] = {
      ...slide,
      content: { ...slide.content, primary: firstHalf }
    };

    // Insertar nuevo slide
    const newSlide = {
      ...slide,
      id: `${slide.id}-split-${Date.now()}`,
      content: { ...slide.content, primary: secondHalf }
    };

    newSlides.splice(index + 1, 0, newSlide);

    // Actualizar metadata de orden
    const updatedSlides = newSlides.map((s, i) => ({
      ...s,
      metadata: {
        ...s.metadata,
        order: i + 1,
        groupTotal: newSlides.length
      }
    }));

    setSlideGroup({
      ...slideGroup,
      slides: updatedSlides
    });
  };

  // Unir con slide siguiente
  const handleMergeSlides = (index: number) => {
    if (!slideGroup || index === 0 || index >= slideGroup.slides.length - 1) return;

    const currentSlide = slideGroup.slides[index];
    const nextSlide = slideGroup.slides[index + 1];

    const mergedContent = `${currentSlide.content.primary}\n${nextSlide.content.primary}`;

    const newSlides = slideGroup.slides.filter((_, i) => i !== index + 1);
    newSlides[index] = {
      ...currentSlide,
      content: { ...currentSlide.content, primary: mergedContent }
    };

    // Actualizar metadata de orden
    const updatedSlides = newSlides.map((s, i) => ({
      ...s,
      metadata: {
        ...s.metadata,
        order: i + 1,
        groupTotal: newSlides.length
      }
    }));

    setSlideGroup({
      ...slideGroup,
      slides: updatedSlides
    });
  };

  // Eliminar slide
  const handleDeleteSlide = (index: number) => {
    if (!slideGroup || index === 0 || slideGroup.slides.length <= 2) return;

    const newSlides = slideGroup.slides.filter((_, i) => i !== index);

    const updatedSlides = newSlides.map((s, i) => ({
      ...s,
      metadata: {
        ...s.metadata,
        order: i + 1,
        groupTotal: newSlides.length
      }
    }));

    setSlideGroup({
      ...slideGroup,
      slides: updatedSlides
    });

    if (selectedSlideIndex >= newSlides.length) {
      setSelectedSlideIndex(newSlides.length - 1);
    }
  };

  // Guardar canción
  const handleSave = () => {
    if (!slideGroup) return;

    const songId = `custom-${Date.now()}-${title.toLowerCase().replace(/\s+/g, '-')}`;

    const verses: Verse[] = slideGroup.slides
      .filter(s => s.type === 'song-lyrics')
      .map((s, i) => ({
        number: i + 1,
        type: 'verse' as const,
        content: s.content.primary
      }));

    const newSong: Song = {
      id: songId,
      number: 0,
      title,
      artist: artist || undefined,
      slug: title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      verses,
      metadata: {
        verseCount: verses.length,
        isCustom: true,
        addedAt: new Date().toISOString(),
        source: 'manual'
      }
    };

    saveCustomSong(newSong);
    onSave?.(newSong);
  };

  // Renderizar paso de input
  const renderInputStep = () => (
    <div className="space-y-6">
      {/* Errores */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <ul className="list-inside list-disc text-sm text-red-600">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Título */}
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.black
          }}
        >
          Título de la canción *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Amazing Grace"
          className="w-full rounded-lg border px-4 py-3 transition-colors focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            borderColor: CASA_BRAND.colors.secondary.grayLight
          }}
        />
      </div>

      {/* Artista */}
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.black
          }}
        >
          Artista (opcional)
        </label>
        <input
          type="text"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="Ej: John Newton"
          className="w-full rounded-lg border px-4 py-3 transition-colors focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            borderColor: CASA_BRAND.colors.secondary.grayLight
          }}
        />
      </div>

      {/* Letra */}
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.black
          }}
        >
          Letra de la canción *
        </label>
        <textarea
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder="Pega aquí la letra de la canción...&#10;&#10;Las líneas vacías separan los versos."
          rows={12}
          className="w-full rounded-lg border px-4 py-3 transition-colors focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            borderColor: CASA_BRAND.colors.secondary.grayLight,
            resize: 'vertical'
          }}
        />
        <p
          className="mt-1 text-xs"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.secondary.grayMedium
          }}
        >
          Tip: Usa líneas vacías para separar los versos
        </p>
      </div>

      {/* Líneas por slide */}
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.black
          }}
        >
          Líneas por slide
        </label>
        <select
          value={linesPerSlide}
          onChange={(e) => setLinesPerSlide(Number(e.target.value))}
          className="rounded-lg border px-4 py-3 transition-colors focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            borderColor: CASA_BRAND.colors.secondary.grayLight
          }}
        >
          <option value={2}>2 líneas</option>
          <option value={3}>3 líneas</option>
          <option value={4}>4 líneas (recomendado)</option>
          <option value={5}>5 líneas</option>
          <option value={6}>6 líneas</option>
        </select>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-lg border px-6 py-2 transition-colors hover:bg-gray-50"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              borderColor: CASA_BRAND.colors.secondary.grayLight,
              color: CASA_BRAND.colors.secondary.grayDark
            }}
          >
            Cancelar
          </button>
        )}
        <button
          onClick={handleGenerateSlides}
          className="rounded-lg px-6 py-2 font-medium transition-colors hover:opacity-90"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            backgroundColor: CASA_BRAND.colors.primary.amber,
            color: CASA_BRAND.colors.primary.white
          }}
        >
          Generar Slides
        </button>
      </div>
    </div>
  );

  // Renderizar paso de preview/edición
  const renderPreviewStep = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3
          className="text-xl font-light"
          style={{
            fontFamily: CASA_BRAND.fonts.heading,
            color: CASA_BRAND.colors.primary.black
          }}
        >
          Vista Previa: {title}
        </h3>
        <button
          onClick={() => setStep('input')}
          className="text-sm underline"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.amber
          }}
        >
          Volver a editar letra
        </button>
      </div>

      {/* Slide seleccionado */}
      {slideGroup && (
        <div className="flex justify-center">
          <SongSlide
            slide={slideGroup.slides[selectedSlideIndex]}
            scale={0.7}
          />
        </div>
      )}

      {/* Controles del slide */}
      {slideGroup && selectedSlideIndex > 0 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => handleEditSlide(selectedSlideIndex)}
            className="rounded px-3 py-1 text-sm transition-colors hover:bg-gray-100"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: CASA_BRAND.colors.primary.black
            }}
          >
            Editar
          </button>
          <button
            onClick={() => handleSplitSlide(selectedSlideIndex)}
            className="rounded px-3 py-1 text-sm transition-colors hover:bg-gray-100"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: CASA_BRAND.colors.primary.black
            }}
          >
            Dividir
          </button>
          {selectedSlideIndex < slideGroup.slides.length - 1 && (
            <button
              onClick={() => handleMergeSlides(selectedSlideIndex)}
              className="rounded px-3 py-1 text-sm transition-colors hover:bg-gray-100"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.primary.black
              }}
            >
              Unir con siguiente
            </button>
          )}
          {slideGroup.slides.length > 2 && (
            <button
              onClick={() => handleDeleteSlide(selectedSlideIndex)}
              className="rounded px-3 py-1 text-sm text-red-600 transition-colors hover:bg-red-50"
              style={{ fontFamily: CASA_BRAND.fonts.body }}
            >
              Eliminar
            </button>
          )}
        </div>
      )}

      {/* Miniaturas */}
      {slideGroup && (
        <SlidePreview
          slideGroup={slideGroup}
          selectedIndex={selectedSlideIndex}
          onSlideSelect={setSelectedSlideIndex}
        />
      )}

      {/* Botones */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => setStep('input')}
          className="rounded-lg border px-6 py-2 transition-colors hover:bg-gray-50"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            borderColor: CASA_BRAND.colors.secondary.grayLight,
            color: CASA_BRAND.colors.secondary.grayDark
          }}
        >
          Volver
        </button>
        <button
          onClick={handleSave}
          className="rounded-lg px-6 py-2 font-medium transition-colors hover:opacity-90"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            backgroundColor: CASA_BRAND.colors.primary.black,
            color: CASA_BRAND.colors.primary.white
          }}
        >
          Guardar Canción
        </button>
      </div>

      {/* Modal de edición de slide */}
      {isEditingSlide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6">
            <h4
              className="mb-4 text-lg font-medium"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.primary.black
              }}
            >
              Editar Slide {selectedSlideIndex + 1}
            </h4>
            <textarea
              value={editingSlideContent}
              onChange={(e) => setEditingSlideContent(e.target.value)}
              rows={6}
              className="w-full rounded-lg border px-4 py-3 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                borderColor: CASA_BRAND.colors.secondary.grayLight
              }}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setIsEditingSlide(false)}
                className="rounded-lg border px-4 py-2 transition-colors hover:bg-gray-50"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  borderColor: CASA_BRAND.colors.secondary.grayLight
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSlideEdit}
                className="rounded-lg px-4 py-2 transition-colors hover:opacity-90"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  backgroundColor: CASA_BRAND.colors.primary.amber,
                  color: CASA_BRAND.colors.primary.white
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="rounded-xl border p-6"
      style={{
        backgroundColor: CASA_BRAND.colors.primary.white,
        borderColor: CASA_BRAND.colors.secondary.grayLight
      }}
    >
      <h2
        className="mb-6 text-2xl font-light"
        style={{
          fontFamily: CASA_BRAND.fonts.heading,
          color: CASA_BRAND.colors.primary.black
        }}
      >
        Agregar Nueva Canción
      </h2>

      {step === 'input' && renderInputStep()}
      {(step === 'preview' || step === 'edit') && renderPreviewStep()}
    </div>
  );
};

export default NewSongEditor;
