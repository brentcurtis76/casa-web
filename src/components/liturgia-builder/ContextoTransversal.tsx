/**
 * ContextoTransversal - Formulario para configurar el contexto compartido de la liturgia
 * Paso inicial del Constructor de Liturgias
 */

import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Calendar, BookOpen, User, FileText, Plus, X, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { LiturgyContext, LiturgyReading, LiturgyContextInput } from '@/types/shared/liturgy';

interface ContextoTransversalProps {
  initialContext?: Partial<LiturgyContext>;
  onSave: (context: LiturgyContextInput) => void;
  onFormChange?: (context: LiturgyContextInput | null) => void;
  isLoading?: boolean;
}

interface ReadingEntry {
  reference: string;
  text: string;
  version: string;
  versionCode: string;
  isLoading: boolean;
  isManual: boolean;
}

const BIBLE_VERSIONS = [
  { code: 'NVI', name: 'Nueva Versión Internacional' },
  { code: 'RV1960', name: 'Reina-Valera 1960' },
  { code: 'LBLA', name: 'La Biblia de las Américas' },
  { code: 'NTV', name: 'Nueva Traducción Viviente' },
];

const ContextoTransversal: React.FC<ContextoTransversalProps> = ({
  initialContext,
  onSave,
  onFormChange,
  isLoading = false,
}) => {
  const { toast } = useToast();

  // Form state - handle date properly to avoid timezone issues
  const [date, setDate] = useState<string>(() => {
    console.log('[ContextoTransversal] Initializing date state, initialContext.date:', initialContext?.date);
    if (initialContext?.date) {
      const dateValue = typeof initialContext.date === 'string'
        ? parseISO(initialContext.date)
        : initialContext.date;
      const formatted = format(dateValue, 'yyyy-MM-dd');
      console.log('[ContextoTransversal] Using initialContext date:', formatted);
      return formatted;
    }
    const nextSunday = getNextSunday();
    console.log('[ContextoTransversal] Using getNextSunday:', nextSunday);
    return nextSunday;
  });
  const [title, setTitle] = useState(initialContext?.title || '');
  const [summary, setSummary] = useState(initialContext?.summary || '');
  const [celebrant, setCelebrant] = useState(initialContext?.celebrant || '');
  const [preacher, setPreacher] = useState(initialContext?.preacher || '');

  // Readings state
  const [readings, setReadings] = useState<ReadingEntry[]>(
    initialContext?.readings?.map(r => ({
      reference: r.reference,
      text: r.text,
      version: r.version,
      versionCode: r.versionCode,
      isLoading: false,
      isManual: false,
    })) || [{ reference: '', text: '', version: '', versionCode: 'NVI', isLoading: false, isManual: false }]
  );

  // Sincronizar todos los estados cuando cambie el ID del contexto
  // IMPORTANTE: Solo sincronizar cuando cambie el ID, no cuando cambie el contenido
  // Esto evita sobrescribir los cambios que el usuario ha hecho en el formulario
  const initialContextId = initialContext?.id;
  useEffect(() => {
    if (initialContext && initialContextId) {
      console.log('[ContextoTransversal] Syncing form for context:', initialContextId);
      if (initialContext.date) {
        const dateValue = typeof initialContext.date === 'string'
          ? parseISO(initialContext.date)
          : initialContext.date;
        setDate(format(dateValue, 'yyyy-MM-dd'));
      }
      setTitle(initialContext.title || '');
      setSummary(initialContext.summary || '');
      setCelebrant(initialContext.celebrant || '');
      setPreacher(initialContext.preacher || '');
      if (initialContext.readings) {
        setReadings(initialContext.readings.map(r => ({
          reference: r.reference,
          text: r.text,
          version: r.version,
          versionCode: r.versionCode,
          isLoading: false,
          isManual: false,
        })));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContextId]); // Solo depende del ID, no del contenido completo

  // Notificar al padre de cambios en el formulario para que pueda guardar correctamente
  useEffect(() => {
    if (!onFormChange) return;

    // Solo notificar si el formulario tiene contenido válido
    const hasValidReading = readings.some(r => r.reference.trim() && r.text.trim());
    if (!date || !title.trim() || !summary.trim() || !hasValidReading) {
      onFormChange(null);
      return;
    }

    const contextInput: LiturgyContextInput = {
      date: parseISO(date),
      title: title.trim(),
      summary: summary.trim(),
      readings: readings
        .filter(r => r.reference.trim() && r.text.trim())
        .map(r => ({
          reference: r.reference,
          text: r.text,
          version: r.versionCode,
        })),
      celebrant: celebrant.trim() || undefined,
      preacher: preacher.trim() || undefined,
    };

    onFormChange(contextInput);
  }, [date, title, summary, readings, celebrant, preacher, onFormChange]);

  // Get next Sunday date
  function getNextSunday(): string {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);
    return format(nextSunday, 'yyyy-MM-dd');
  }

  // Add a new reading
  const addReading = () => {
    if (readings.length < 4) {
      setReadings([...readings, { reference: '', text: '', version: '', versionCode: 'NVI', isLoading: false, isManual: false }]);
    }
  };

  // Remove a reading
  const removeReading = (index: number) => {
    if (readings.length > 1) {
      setReadings(readings.filter((_, i) => i !== index));
    }
  };

  // Update reading reference
  const updateReference = (index: number, reference: string) => {
    const updated = [...readings];
    updated[index] = { ...updated[index], reference, text: '', version: '' };
    setReadings(updated);
  };

  // Update reading version
  const updateVersion = (index: number, versionCode: string) => {
    const updated = [...readings];
    updated[index] = { ...updated[index], versionCode, text: '', version: '' };
    setReadings(updated);
  };

  // Fetch Bible passage
  const fetchPassage = async (index: number) => {
    const reading = readings[index];
    if (!reading.reference.trim()) {
      toast({
        title: 'Error',
        description: 'Ingresa una cita bíblica primero',
        variant: 'destructive',
      });
      return;
    }

    const updated = [...readings];
    updated[index] = { ...updated[index], isLoading: true };
    setReadings(updated);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-bible-passage', {
        body: { reference: reading.reference.trim(), version: reading.versionCode },
      });

      if (error) throw error;

      if (!data?.success || !data.text) {
        throw new Error(data?.error || 'Error al obtener el texto');
      }

      updated[index] = {
        ...updated[index],
        text: data.text,
        version: data.version,
        versionCode: data.versionCode || reading.versionCode,
        reference: data.reference || reading.reference,
        isLoading: false,
        isManual: false,
      };
      setReadings(updated);

      toast({
        title: 'Lectura cargada',
        description: `${data.reference} (${data.version})`,
      });
    } catch (err) {
      updated[index] = { ...updated[index], isLoading: false, isManual: true };
      setReadings(updated);

      toast({
        title: 'No se pudo obtener el texto',
        description: 'Puedes ingresarlo manualmente',
        variant: 'destructive',
      });
    }
  };

  // Set manual text
  const setManualText = (index: number, text: string) => {
    const updated = [...readings];
    const versionInfo = BIBLE_VERSIONS.find(v => v.code === updated[index].versionCode);
    updated[index] = {
      ...updated[index],
      text,
      version: versionInfo?.name || updated[index].versionCode,
    };
    setReadings(updated);
  };

  // Validate form
  const isValid = () => {
    if (!date || !title.trim() || !summary.trim()) return false;
    const hasValidReading = readings.some(r => r.reference.trim() && r.text.trim());
    return hasValidReading;
  };

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid()) {
      toast({
        title: 'Formulario incompleto',
        description: 'Completa todos los campos requeridos y al menos una lectura',
        variant: 'destructive',
      });
      return;
    }

    console.log('[ContextoTransversal] handleSubmit - date state value:', date);
    const parsedDate = parseISO(date);
    console.log('[ContextoTransversal] handleSubmit - parsedDate:', parsedDate.toISOString());

    const contextInput: LiturgyContextInput = {
      // Use parseISO to avoid timezone issues with yyyy-MM-dd format
      date: parsedDate,
      title: title.trim(),
      summary: summary.trim(),
      readings: readings
        .filter(r => r.reference.trim() && r.text.trim())
        .map(r => ({
          reference: r.reference,
          text: r.text,
          version: r.versionCode,
        })),
      celebrant: celebrant.trim() || undefined,
      preacher: preacher.trim() || undefined,
    };

    console.log('[ContextoTransversal] handleSubmit - contextInput.date:', contextInput.date);
    onSave(contextInput);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
        >
          <FileText size={24} color={CASA_BRAND.colors.primary.white} />
        </div>
        <div>
          <h2
            style={{
              fontFamily: CASA_BRAND.fonts.heading,
              fontSize: '24px',
              fontWeight: 300,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            Contexto de la Liturgia
          </h2>
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            Información compartida por todos los elementos
          </p>
        </div>
      </div>

      {/* Date and Title Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date */}
        <div>
          <label
            className="flex items-center gap-2 mb-2"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 600,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            <Calendar size={16} style={{ color: CASA_BRAND.colors.primary.amber }} />
            Fecha de la Liturgia
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              borderColor: CASA_BRAND.colors.secondary.grayLight,
            }}
          />
        </div>

        {/* Title */}
        <div>
          <label
            className="flex items-center gap-2 mb-2"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 600,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            <FileText size={16} style={{ color: CASA_BRAND.colors.primary.amber }} />
            Título de la Reflexión *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: El amor que transforma"
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              borderColor: CASA_BRAND.colors.secondary.grayLight,
            }}
          />
        </div>
      </div>

      {/* Summary */}
      <div>
        <label
          className="flex items-center gap-2 mb-2"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            fontWeight: 600,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          Resumen / Enfoque Temático *
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Describe brevemente el tema central de la liturgia..."
          rows={3}
          className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 resize-none"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            borderColor: CASA_BRAND.colors.secondary.grayLight,
          }}
        />
      </div>

      {/* Celebrant and Preacher Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            className="flex items-center gap-2 mb-2"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 600,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            <User size={16} style={{ color: CASA_BRAND.colors.primary.amber }} />
            Celebrante (opcional)
          </label>
          <input
            type="text"
            value={celebrant}
            onChange={(e) => setCelebrant(e.target.value)}
            placeholder="Nombre del celebrante"
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              borderColor: CASA_BRAND.colors.secondary.grayLight,
            }}
          />
        </div>

        <div>
          <label
            className="flex items-center gap-2 mb-2"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 600,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            <User size={16} style={{ color: CASA_BRAND.colors.primary.amber }} />
            Predicador (opcional)
          </label>
          <input
            type="text"
            value={preacher}
            onChange={(e) => setPreacher(e.target.value)}
            placeholder="Nombre del predicador"
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              borderColor: CASA_BRAND.colors.secondary.grayLight,
            }}
          />
        </div>
      </div>

      {/* Readings Section */}
      <div
        className="p-4 rounded-lg border"
        style={{
          borderColor: CASA_BRAND.colors.secondary.grayLight,
          backgroundColor: `${CASA_BRAND.colors.amber.light}10`,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <label
            className="flex items-center gap-2"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 600,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            <BookOpen size={16} style={{ color: CASA_BRAND.colors.primary.amber }} />
            Lecturas Bíblicas *
          </label>

          {readings.length < 4 && (
            <button
              type="button"
              onClick={addReading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors hover:bg-amber-100"
              style={{
                color: CASA_BRAND.colors.primary.amber,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              <Plus size={16} />
              Agregar Lectura
            </button>
          )}
        </div>

        <div className="space-y-4">
          {readings.map((reading, index) => (
            <div
              key={index}
              className="p-4 rounded-lg border bg-white"
              style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
            >
              {/* Reading Header */}
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-sm font-medium"
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    color: CASA_BRAND.colors.primary.amber,
                  }}
                >
                  Lectura {index + 1}
                </span>
                {readings.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeReading(index)}
                    className="p-1 rounded-full hover:bg-red-50 transition-colors"
                    style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Reference and Version */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div className="md:col-span-2">
                  <input
                    type="text"
                    value={reading.reference}
                    onChange={(e) => updateReference(index, e.target.value)}
                    placeholder="Ej: Juan 3:16-21"
                    disabled={!!reading.text && !reading.isManual}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 disabled:bg-gray-50"
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      borderColor: CASA_BRAND.colors.secondary.grayLight,
                    }}
                  />
                </div>
                <div>
                  <select
                    value={reading.versionCode}
                    onChange={(e) => updateVersion(index, e.target.value)}
                    disabled={!!reading.text && !reading.isManual}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 disabled:bg-gray-50"
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      borderColor: CASA_BRAND.colors.secondary.grayLight,
                    }}
                  >
                    {BIBLE_VERSIONS.map((v) => (
                      <option key={v.code} value={v.code}>
                        {v.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Text Display or Manual Input */}
              {reading.text && !reading.isManual ? (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-xs font-medium"
                      style={{ color: CASA_BRAND.colors.primary.amber }}
                    >
                      Cargada ({reading.version})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...readings];
                        updated[index] = { ...updated[index], text: '', version: '', isManual: false };
                        setReadings(updated);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cambiar
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 max-h-24 overflow-y-auto">
                    {reading.text}
                  </p>
                </div>
              ) : reading.isManual ? (
                <div>
                  <textarea
                    value={reading.text}
                    onChange={(e) => setManualText(index, e.target.value)}
                    placeholder="Pega aquí el texto de la lectura..."
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 resize-none"
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      borderColor: CASA_BRAND.colors.secondary.grayLight,
                    }}
                  />
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fetchPassage(index)}
                    disabled={reading.isLoading || !reading.reference.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: CASA_BRAND.colors.primary.black,
                      color: CASA_BRAND.colors.primary.white,
                      fontFamily: CASA_BRAND.fonts.body,
                    }}
                  >
                    {reading.isLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Search size={16} />
                        Buscar Texto
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...readings];
                      updated[index] = { ...updated[index], isManual: true };
                      setReadings(updated);
                    }}
                    disabled={!reading.reference.trim()}
                    className="px-4 py-2 rounded-lg border text-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      borderColor: CASA_BRAND.colors.secondary.grayLight,
                    }}
                  >
                    Manual
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={!isValid() || isLoading}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.amber,
            color: CASA_BRAND.colors.primary.white,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '16px',
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Guardando...
            </>
          ) : (
            'Continuar'
          )}
        </button>
      </div>
    </form>
  );
};

export default ContextoTransversal;
