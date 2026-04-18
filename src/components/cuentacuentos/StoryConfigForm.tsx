/**
 * StoryConfigForm - Formulario de configuración para crear un cuento
 * Paso 1 y 2 del flujo de Cuentacuentos
 */

import React, { useState } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { BookOpen, Sparkles, AlertCircle, Plus, Layers } from 'lucide-react';
import type { StoryConfigInput, StoryProp } from '@/types/shared/story';
import { isNameForbidden } from '@/lib/cuentacuentos/promptBuilders';
import StyleSelector from './StyleSelector';
import CharacterInput from './CharacterInput';
import LocationInput from './LocationInput';
import LandmarkInput, { type LandmarkConfig } from './LandmarkInput';
import PropInput from './PropInput';

const makePropId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const createBlankProp = (): StoryProp => ({
  id: makePropId(),
  kind: 'prop',
  name: '',
  narrativeRole: '',
  visualDescription: '',
  referenceImages: [],
  role: 'secondary',
});

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
  const [landmark, setLandmark] = useState<LandmarkConfig | null>(null);
  const [props, setProps] = useState<StoryProp[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const handleAddProp = () => {
    setProps((prev) => [...prev, createBlankProp()]);
  };

  const handleUpdateProp = (id: string, updated: StoryProp) => {
    setProps((prev) => prev.map((p) => (p.id === id ? updated : p)));
  };

  const handleRemoveProp = (id: string) => {
    setProps((prev) => prev.filter((p) => p.id !== id));
  };

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

    // Validar landmark si está habilitado
    if (landmark) {
      if (!landmark.name.trim()) {
        newErrors.push('Debes ingresar el nombre del landmark');
      }
      if (!landmark.narrativeRole.trim()) {
        newErrors.push('Debes describir el rol narrativo del landmark');
      }
      if (landmark.referenceImages.length === 0) {
        newErrors.push('Debes subir al menos una foto de referencia del landmark');
      }
    }

    // Validar props
    props.forEach((p, idx) => {
      const label = p.name.trim() || `Prop ${idx + 1}`;
      if (!p.name.trim()) {
        newErrors.push(`Debes ingresar el nombre del ${label}`);
      }
      if (!p.narrativeRole.trim()) {
        newErrors.push(`Debes describir el rol narrativo de ${label}`);
      }
      if (p.referenceImages.length === 0) {
        newErrors.push(`Debes subir al menos una foto de referencia de ${label}`);
      }
    });

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
      landmarks: landmark ? [{
        name: landmark.name.trim(),
        narrativeRole: landmark.narrativeRole.trim(),
        referenceImages: landmark.referenceImages,
        role: landmark.role,
      }] : [],
      props: props.length > 0
        ? props.map((p) => ({
            kind: p.kind,
            name: p.name.trim(),
            narrativeRole: p.narrativeRole.trim(),
            referenceImages: p.referenceImages,
            role: p.role,
            sceneNumbers: p.sceneNumbers,
          }))
        : undefined,
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

          {/* Elementos visuales: landmark + props */}
          <div
            className="p-4 rounded-lg border space-y-4"
            style={{
              borderColor: CASA_BRAND.colors.secondary.grayLight,
              backgroundColor: `${CASA_BRAND.colors.amber.light}10`,
            }}
          >
            <div className="flex items-center gap-2">
              <Layers size={18} style={{ color: CASA_BRAND.colors.primary.amber }} />
              <h4
                style={{
                  fontFamily: CASA_BRAND.fonts.heading,
                  fontSize: '16px',
                  fontWeight: 500,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                Elementos visuales
              </h4>
              <span
                className="text-sm font-normal"
                style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
              >
                (opcional)
              </span>
            </div>
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
                color: CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              Agrega un landmark (edificio o monumento) y/o props (lugares y objetos) para
              mantener consistencia visual en las escenas del cuento.
            </p>

            {/* Landmark como personaje */}
            <LandmarkInput landmark={landmark} onChange={setLandmark} />

            {/* Props (lugares y objetos) */}
            <div className="space-y-4">
              {props.map((prop) => (
                <PropInput
                  key={prop.id}
                  value={prop}
                  onChange={(updated) => handleUpdateProp(prop.id, updated)}
                  onRemove={() => handleRemoveProp(prop.id)}
                />
              ))}

              <button
                type="button"
                onClick={handleAddProp}
                className="w-full py-3 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 transition-colors hover:border-amber-400"
                style={{
                  borderColor: CASA_BRAND.colors.secondary.grayLight,
                  color: CASA_BRAND.colors.secondary.grayMedium,
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                }}
              >
                <Plus size={18} />
                Agregar prop (lugar u objeto)
              </button>
            </div>
          </div>

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
