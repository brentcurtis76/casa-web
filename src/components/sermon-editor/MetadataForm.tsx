/**
 * MetadataForm - Form component for sermon metadata
 * PROMPT_005: Cover Art & Metadata
 *
 * Features:
 * - Title with character count (max 100)
 * - Speaker input with suggestions
 * - Date picker
 * - Series input with autocomplete
 * - Description textarea (max 4000 for Spotify)
 * - Liturgy link dropdown
 */
import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Info, Link2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export interface SermonMetadata {
  title: string;
  speaker: string;
  date: Date;
  series?: string;
  description?: string;
  liturgyId?: string;
}

interface LiturgiaContext {
  id: string;
  titulo: string;        // Was 'tema' - actual column name
  fecha: string;         // Was 'fecha_domingo' - actual column name
  resumen?: string;
}

interface MetadataFormProps {
  metadata: SermonMetadata;
  onMetadataChange: (metadata: SermonMetadata) => void;
  disabled?: boolean;
}

// Character limits
const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 4000;

// Common speakers for suggestions
const KNOWN_SPEAKERS = [
  'Pastor Juan Pérez',
  'Pastora María García',
  'Rev. Carlos Mendoza',
  'Dra. Ana López',
];

export function MetadataForm({
  metadata,
  onMetadataChange,
  disabled = false,
}: MetadataFormProps) {
  const [liturgies, setLiturgies] = useState<LiturgiaContext[]>([]);
  const [matchingLiturgy, setMatchingLiturgy] = useState<LiturgiaContext | null>(null);
  const [showLiturgyPrompt, setShowLiturgyPrompt] = useState(false);
  const [pastSeries, setPastSeries] = useState<string[]>([]);
  const [isLoadingLiturgies, setIsLoadingLiturgies] = useState(false);

  // Fetch available liturgies
  useEffect(() => {
    const fetchLiturgies = async () => {
      setIsLoadingLiturgies(true);
      try {
        const { data, error } = await supabase
          .from('liturgias')
          .select('id, titulo, fecha, resumen')
          .order('fecha', { ascending: false })
          .limit(50);

        if (error) throw error;
        setLiturgies(data || []);

        // No series data available in current schema
        setPastSeries([]);
      } catch (err) {
        console.error('Error fetching liturgies:', err);
      } finally {
        setIsLoadingLiturgies(false);
      }
    };

    fetchLiturgies();
  }, []);

  // Check for matching liturgy when date changes
  useEffect(() => {
    const checkMatchingLiturgy = async () => {
      if (!metadata.date) return;

      const dateStr = format(metadata.date, 'yyyy-MM-dd');

      // Check in fetched liturgies first
      const match = liturgies.find(l => l.fecha === dateStr);

      if (match && !metadata.liturgyId) {
        setMatchingLiturgy(match);
        setShowLiturgyPrompt(true);
      } else {
        setMatchingLiturgy(null);
        setShowLiturgyPrompt(false);
      }
    };

    checkMatchingLiturgy();
  }, [metadata.date, liturgies, metadata.liturgyId]);

  // Handle liturgy import
  const handleImportLiturgy = useCallback(() => {
    if (!matchingLiturgy) return;

    const updatedMetadata: SermonMetadata = {
      ...metadata,
      liturgyId: matchingLiturgy.id,
    };

    // Auto-fill available fields from liturgia
    if (matchingLiturgy.titulo && !metadata.title) {
      updatedMetadata.title = matchingLiturgy.titulo;
    }
    if (matchingLiturgy.resumen && !metadata.description) {
      updatedMetadata.description = matchingLiturgy.resumen;
    }

    onMetadataChange(updatedMetadata);
    setShowLiturgyPrompt(false);
  }, [matchingLiturgy, metadata, onMetadataChange]);

  // Handle field changes
  const updateField = useCallback(<K extends keyof SermonMetadata>(
    field: K,
    value: SermonMetadata[K]
  ) => {
    onMetadataChange({
      ...metadata,
      [field]: value,
    });
  }, [metadata, onMetadataChange]);

  // Handle liturgy selection
  const handleLiturgySelect = useCallback((liturgyId: string) => {
    if (liturgyId === 'none') {
      updateField('liturgyId', undefined);
      return;
    }

    const selectedLiturgy = liturgies.find(l => l.id === liturgyId);
    if (selectedLiturgy) {
      updateField('liturgyId', liturgyId);

      // Optionally auto-fill from newly selected liturgy
      if (!metadata.title && selectedLiturgy.titulo) {
        onMetadataChange({
          ...metadata,
          liturgyId,
          title: selectedLiturgy.titulo,
          description: selectedLiturgy.resumen || metadata.description,
        });
      }
    }
  }, [liturgies, metadata, onMetadataChange, updateField]);

  return (
    <div className="space-y-4">
      {/* Liturgy Match Alert */}
      {showLiturgyPrompt && matchingLiturgy && (
        <Alert className="bg-amber-50 border-amber-200">
          <Link2 className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm text-amber-800">
              Se encontró una liturgia para esta fecha: "{matchingLiturgy.titulo}"
            </span>
            <div className="flex gap-2 ml-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowLiturgyPrompt(false)}
                className="text-xs"
              >
                No
              </Button>
              <Button
                size="sm"
                onClick={handleImportLiturgy}
                className="text-xs bg-amber-600 hover:bg-amber-700"
              >
                Sí, importar datos
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Title Field */}
      <div className="space-y-2">
        <Label htmlFor="title" className="flex items-center gap-1">
          Título <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Input
            id="title"
            value={metadata.title}
            onChange={(e) => updateField('title', e.target.value.slice(0, TITLE_MAX_LENGTH))}
            placeholder="Ej: La esperanza que no defrauda"
            disabled={disabled}
            className="pr-16"
            maxLength={TITLE_MAX_LENGTH}
          />
          <span className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 text-xs",
            metadata.title.length > TITLE_MAX_LENGTH * 0.9
              ? "text-amber-600"
              : "text-muted-foreground"
          )}>
            {metadata.title.length}/{TITLE_MAX_LENGTH}
          </span>
        </div>
      </div>

      {/* Speaker Field */}
      <div className="space-y-2">
        <Label htmlFor="speaker" className="flex items-center gap-1">
          Predicador <span className="text-red-500">*</span>
        </Label>
        <Input
          id="speaker"
          value={metadata.speaker}
          onChange={(e) => updateField('speaker', e.target.value)}
          placeholder="Ej: Pastor Juan Pérez"
          disabled={disabled}
          list="speakers-list"
        />
        <datalist id="speakers-list">
          {KNOWN_SPEAKERS.map((speaker) => (
            <option key={speaker} value={speaker} />
          ))}
        </datalist>
      </div>

      {/* Date Field */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1">
          Fecha <span className="text-red-500">*</span>
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled}
              className={cn(
                "w-full justify-start text-left font-normal",
                !metadata.date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {metadata.date ? (
                format(metadata.date, "EEEE d 'de' MMMM, yyyy", { locale: es })
              ) : (
                <span>Seleccionar fecha</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={metadata.date}
              onSelect={(date) => date && updateField('date', date)}
              locale={es}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Series Field */}
      <div className="space-y-2">
        <Label htmlFor="series">Serie (opcional)</Label>
        <Input
          id="series"
          value={metadata.series || ''}
          onChange={(e) => updateField('series', e.target.value || undefined)}
          placeholder="Ej: Romanos: Vida en el Espíritu"
          disabled={disabled}
          list="series-list"
        />
        <datalist id="series-list">
          {pastSeries.map((series) => (
            <option key={series} value={series} />
          ))}
        </datalist>
      </div>

      {/* Description Field */}
      <div className="space-y-2">
        <Label htmlFor="description" className="flex items-center gap-1">
          Descripción (opcional)
          <span className="text-xs text-muted-foreground ml-1">
            (para Spotify)
          </span>
        </Label>
        <div className="relative">
          <Textarea
            id="description"
            value={metadata.description || ''}
            onChange={(e) => updateField('description', e.target.value.slice(0, DESCRIPTION_MAX_LENGTH) || undefined)}
            placeholder="Breve descripción de la reflexión para mostrar en plataformas de podcast..."
            disabled={disabled}
            rows={3}
            maxLength={DESCRIPTION_MAX_LENGTH}
            className="resize-none pb-6"
          />
          <span className={cn(
            "absolute right-3 bottom-2 text-xs",
            (metadata.description?.length || 0) > DESCRIPTION_MAX_LENGTH * 0.9
              ? "text-amber-600"
              : "text-muted-foreground"
          )}>
            {metadata.description?.length || 0}/{DESCRIPTION_MAX_LENGTH}
          </span>
        </div>
      </div>

      {/* Liturgy Link Field */}
      <div className="space-y-2">
        <Label htmlFor="liturgy" className="flex items-center gap-1">
          Liturgia vinculada (opcional)
          <Info className="h-3 w-3 text-muted-foreground ml-1" />
        </Label>
        <Select
          value={metadata.liturgyId || 'none'}
          onValueChange={handleLiturgySelect}
          disabled={disabled || isLoadingLiturgies}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar liturgia..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin vincular</SelectItem>
            {liturgies.map((liturgy) => (
              <SelectItem key={liturgy.id} value={liturgy.id}>
                {format(new Date(liturgy.fecha), "d MMM yyyy", { locale: es })} - {liturgy.titulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {metadata.liturgyId && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            Datos importados de liturgia
          </p>
        )}
      </div>
    </div>
  );
}
