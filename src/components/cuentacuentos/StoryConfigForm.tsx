/**
 * StoryConfigForm - Formulario de configuración para crear un cuento
 * Paso 1 y 2 del flujo de Cuentacuentos
 */

import React, { useState } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { BookOpen, Sparkles, AlertCircle } from 'lucide-react';
import type { StoryConfigInput } from '@/types/shared/story';
import { isNameForbidden } from '@/lib/cuentacuentos/promptBuilders';
import StyleSelector from './StyleSelector';
import CharacterInput from './CharacterInput';
import LocationInput from './LocationInput';

interface StoryConfigFormProps {
  onSubmit: (config: StoryConfigInput) => void;
  isLoading?: boolean;
}

const StoryConfigForm: React.FC<StoryConfigFormProps> = ({ onSubmit, isLoading = false }) => {
  // Estado del formulario
  const [liturgyTitle, setLiturgyTitle] = useState('');
  const [liturgyReadings, setLiturgyReadings] = useState('');
  const [liturgySummary, setLiturgySummary] = useState('');
  const [locationName, setLocationName] = useState('');
  const [characters, setCharacters] = useState<{ description: string; name?: string }[]>([
    { description: '', name: '' },
  ]);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    // Validar lugar
    if (!locationName.trim()) {
      newErrors.push('Debes ingresar un lugar para el cuento');
    }

    // Validar protagonista
    if (!characters[0]?.description.trim()) {
      newErrors.push('Debes describir al protagonista');
    }

    // Validar estilo
    if (!selectedStyleId) {
      newErrors.push('Debes seleccionar un estilo de ilustración');
    }

    // Validar nombres prohibidos
    const forbiddenNames = characters
      .filter((c) => c.name && isNameForbidden(c.name))
      .map((c) => c.name);
    if (forbiddenNames.length > 0) {
      newErrors.push(`Nombres no permitidos: ${forbiddenNames.join(', ')}`);
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const config: StoryConfigInput = {
      liturgyTitle: liturgyTitle.trim() || undefined,
      liturgyReadings: liturgyReadings.trim() || undefined,
      liturgySummary: liturgySummary.trim() || undefined,
      locationName: locationName.trim(),
      characters: characters.filter((c) => c.description.trim()),
      illustrationStyleId: selectedStyleId!,
    };

    onSubmit(config);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
        >
          <BookOpen size={24} color={CASA_BRAND.colors.primary.white} />
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
            Crear Nuevo Cuento
          </h2>
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            Configura los elementos del cuento ilustrado
          </p>
        </div>
      </div>

      {/* Errores */}
      {errors.length > 0 && (
        <div
          className="p-4 rounded-lg flex items-start gap-3"
          style={{ backgroundColor: '#FEF2F2' }}
        >
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
          <div>
            <p
              className="font-semibold"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                color: '#991B1B',
              }}
            >
              Por favor corrige los siguientes errores:
            </p>
            <ul className="mt-1 list-disc list-inside">
              {errors.map((error, i) => (
                <li
                  key={i}
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '13px',
                    color: '#B91C1C',
                  }}
                >
                  {error}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* PASO 1: Contexto de la Liturgia (opcional) */}
      <section
        className="p-6 rounded-lg border"
        style={{
          borderColor: CASA_BRAND.colors.secondary.grayLight,
          backgroundColor: CASA_BRAND.colors.primary.white,
        }}
      >
        <h3
          className="mb-4"
          style={{
            fontFamily: CASA_BRAND.fonts.heading,
            fontSize: '18px',
            fontWeight: 400,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          Paso 1: Contexto de la Liturgia
          <span
            className="ml-2 text-sm font-normal"
            style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
          >
            (opcional)
          </span>
        </h3>

        <div className="space-y-4">
          <div>
            <label
              className="block mb-1"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                fontWeight: 600,
                color: CASA_BRAND.colors.primary.black,
              }}
            >
              Título/Tema de la Liturgia
            </label>
            <input
              type="text"
              value={liturgyTitle}
              onChange={(e) => setLiturgyTitle(e.target.value)}
              placeholder="Ej: El camino de la esperanza"
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
              className="block mb-1"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                fontWeight: 600,
                color: CASA_BRAND.colors.primary.black,
              }}
            >
              Lecturas Bíblicas
            </label>
            <input
              type="text"
              value={liturgyReadings}
              onChange={(e) => setLiturgyReadings(e.target.value)}
              placeholder="Ej: Juan 14:1-6, Salmo 23"
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
              className="block mb-1"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                fontWeight: 600,
                color: CASA_BRAND.colors.primary.black,
              }}
            >
              Resumen del Tema
            </label>
            <textarea
              value={liturgySummary}
              onChange={(e) => setLiturgySummary(e.target.value)}
              placeholder="Ej: Reflexión sobre la confianza en Dios en momentos difíciles"
              rows={3}
              className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 resize-none"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                borderColor: CASA_BRAND.colors.secondary.grayLight,
              }}
            />
          </div>
        </div>
      </section>

      {/* PASO 2: Configuración del Cuento */}
      <section
        className="p-6 rounded-lg border"
        style={{
          borderColor: CASA_BRAND.colors.secondary.grayLight,
          backgroundColor: CASA_BRAND.colors.primary.white,
        }}
      >
        <h3
          className="mb-4"
          style={{
            fontFamily: CASA_BRAND.fonts.heading,
            fontSize: '18px',
            fontWeight: 400,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          Paso 2: Configuración del Cuento
        </h3>

        <div className="space-y-6">
          {/* Lugar */}
          <LocationInput value={locationName} onChange={setLocationName} />

          {/* Personajes */}
          <CharacterInput characters={characters} onChange={setCharacters} />

          {/* Estilo de ilustración */}
          <StyleSelector selectedStyleId={selectedStyleId} onSelectStyle={setSelectedStyleId} />
        </div>
      </section>

      {/* Botón de submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
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
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generando cuento...
            </>
          ) : (
            <>
              <Sparkles size={20} />
              Generar Cuento
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default StoryConfigForm;
