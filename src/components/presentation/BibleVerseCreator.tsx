/**
 * BibleVerseCreator - Form for creating Bible verse slides
 * Supports Spanish Bible references with live preview
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Book, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Slide } from '@/types/shared/slide';

const BIBLE_VERSIONS = [
  { value: 'NVI', label: 'NVI - Nueva Versión Internacional' },
  { value: 'RV1960', label: 'RVR1960 - Reina-Valera 1960' },
  { value: 'LBLA', label: 'LBLA - La Biblia de las Américas' },
  { value: 'NTV', label: 'NTV - Nueva Traducción Viviente' },
];

interface BibleVerseCreatorProps {
  onCancel: () => void;
  onCreateSlide: (slide: Slide, insertPosition: 'after' | 'end') => void;
  currentSlideIndex: number;
  totalSlides: number;
}

interface BibleResponse {
  success: boolean;
  text?: string;
  reference?: string;
  version?: string;
  error?: string;
}

export const BibleVerseCreator: React.FC<BibleVerseCreatorProps> = ({
  onCancel,
  onCreateSlide,
  currentSlideIndex,
  totalSlides,
}) => {
  const [reference, setReference] = useState('');
  const [version, setVersion] = useState('NVI');
  const [insertPosition, setInsertPosition] = useState<'after' | 'end'>('after');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ text: string; reference: string } | null>(null);
  const [isDebouncing, setIsDebouncing] = useState(false);

  // Refs for cleanup and mounted state
  const isMountedRef = useRef(true);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const fetchVerse = useCallback(async () => {
    if (!reference.trim()) {
      setError('Ingresa una referencia bíblica');
      return;
    }

    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke<BibleResponse>(
        'fetch-bible-passage',
        {
          body: { reference: reference.trim(), version },
        }
      );

      // Check if still mounted before updating state
      if (!isMountedRef.current) return;

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Error desconocido');
      }

      setPreview({
        text: data.text || '',
        reference: data.reference || reference,
      });
    } catch (err) {
      // Check if still mounted before updating state
      if (!isMountedRef.current) return;

      setError(err instanceof Error ? err.message : 'Error al buscar el versículo');
    } finally {
      // Check if still mounted before updating state
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [reference, version]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && !isDebouncing) {
      e.preventDefault();
      setIsDebouncing(true);
      fetchVerse();

      debounceTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setIsDebouncing(false);
        }
      }, 500); // 500ms debounce
    }
  }, [loading, isDebouncing, fetchVerse]);

  const handleCreate = () => {
    if (!preview) return;

    const slide: Slide = {
      id: `temp-verse-${Date.now()}`,
      type: 'reading',
      content: {
        primary: preview.text,
        secondary: preview.reference,
        subtitle: BIBLE_VERSIONS.find((v) => v.value === version)?.label.split(' - ')[0] || version,
      },
      style: {
        primaryColor: CASA_BRAND.colors.primary.black,
        secondaryColor: CASA_BRAND.colors.primary.amber,
        backgroundColor: CASA_BRAND.colors.primary.white,
        primaryFont: CASA_BRAND.fonts.body,
        secondaryFont: CASA_BRAND.fonts.heading,
      },
      metadata: {
        sourceComponent: 'quick-add-bible',
        sourceId: `temp-${Date.now()}`,
        order: 0,
        groupTotal: 1,
      },
    };

    onCreateSlide(slide, insertPosition);
  };

  return (
    <div className="space-y-4 p-4">
      {/* Reference input */}
      <div className="space-y-2">
        <Label
          htmlFor="reference"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.white,
          }}
        >
          Referencia
        </Label>
        <div className="flex gap-2">
          <Input
            id="reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Ej: Juan 3:16, Salmos 23:1-6"
            className="flex-1"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.black,
              borderColor: CASA_BRAND.colors.secondary.grayDark,
              color: CASA_BRAND.colors.primary.white,
            }}
            onKeyDown={handleKeyDown}
            aria-label="Referencia bíblica"
          />
          <Button
            onClick={fetchVerse}
            disabled={loading || !reference.trim() || isDebouncing}
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.black,
            }}
            aria-label="Buscar versículo"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : 'Buscar'}
          </Button>
        </div>
      </div>

      {/* Version selector */}
      <div className="space-y-2">
        <Label
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.white,
          }}
        >
          Versión
        </Label>
        <Select value={version} onValueChange={setVersion}>
          <SelectTrigger
            style={{
              backgroundColor: CASA_BRAND.colors.primary.black,
              borderColor: CASA_BRAND.colors.secondary.grayDark,
              color: CASA_BRAND.colors.primary.white,
            }}
            aria-label="Seleccionar versión de la Biblia"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            style={{
              backgroundColor: CASA_BRAND.colors.secondary.carbon,
              borderColor: CASA_BRAND.colors.secondary.grayDark,
            }}
          >
            {BIBLE_VERSIONS.map((v) => (
              <SelectItem
                key={v.value}
                value={v.value}
                style={{ color: CASA_BRAND.colors.primary.white }}
              >
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="flex items-center gap-2 p-3 rounded-md"
          style={{
            backgroundColor: '#ef444420',
            border: '1px solid #ef4444',
          }}
          role="alert"
        >
          <AlertCircle size={16} style={{ color: '#ef4444' }} />
          <span
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: '#ef4444',
              fontSize: '14px',
            }}
          >
            {error}
          </span>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div
          className="p-4 rounded-lg"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.white,
            border: `1px solid ${CASA_BRAND.colors.secondary.grayLight}`,
          }}
        >
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: CASA_BRAND.colors.primary.black,
              fontSize: '14px',
              lineHeight: 1.6,
              marginBottom: '8px',
            }}
          >
            {preview.text.length > 300
              ? `${preview.text.slice(0, 300)}...`
              : preview.text}
          </p>
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.heading,
              color: CASA_BRAND.colors.primary.amber,
              fontSize: '12px',
              fontWeight: 600,
              textAlign: 'right',
            }}
          >
            — {preview.reference}
          </p>
        </div>
      )}

      {/* Insert position */}
      <div className="space-y-2">
        <Label
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.white,
          }}
        >
          Insertar
        </Label>
        <RadioGroup
          value={insertPosition}
          onValueChange={(v) => setInsertPosition(v as 'after' | 'end')}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="after" id="after" />
            <Label
              htmlFor="after"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.secondary.grayLight,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Después de slide {currentSlideIndex + 1}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="end" id="end" />
            <Label
              htmlFor="end"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.secondary.grayLight,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Al final ({totalSlides})
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          onClick={handleCreate}
          disabled={!preview}
          className="gap-2"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.amber,
            color: CASA_BRAND.colors.primary.black,
          }}
          aria-label="Agregar versículo"
        >
          <Book size={16} />
          Agregar
        </Button>
      </div>
    </div>
  );
};

export default BibleVerseCreator;
