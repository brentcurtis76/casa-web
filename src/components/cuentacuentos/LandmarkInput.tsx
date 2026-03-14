/**
 * LandmarkInput - Input para definir un landmark/edificio como "personaje" visual del cuento
 * Permite subir fotos de referencia para que el sistema represente el landmark fielmente
 */

import React, { useRef } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Building2, Upload, X, ImagePlus, Info } from 'lucide-react';
import type { LandmarkRole } from '@/types/shared/story';

export interface LandmarkConfig {
  name: string;
  narrativeRole: string;
  referenceImages: string[];  // base64 data URLs
  role: LandmarkRole;
}

interface LandmarkInputProps {
  landmark: LandmarkConfig | null;
  onChange: (landmark: LandmarkConfig | null) => void;
  maxImages?: number;
}

const LandmarkInput: React.FC<LandmarkInputProps> = ({
  landmark,
  onChange,
  maxImages = 4,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEnable = () => {
    onChange({
      name: '',
      narrativeRole: '',
      referenceImages: [],
      role: 'primary',
    });
  };

  const handleDisable = () => {
    onChange(null);
  };

  const handleUpdate = (field: keyof LandmarkConfig, value: string | string[] | LandmarkRole) => {
    if (!landmark) return;
    onChange({ ...landmark, [field]: value });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!landmark || !e.target.files) return;

    const files = Array.from(e.target.files);
    const remainingSlots = maxImages - landmark.referenceImages.length;
    const filesToProcess = files.slice(0, remainingSlots);

    const results = await Promise.all(
      filesToProcess.map(
        (file) =>
          new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              resolve((event.target?.result as string) || null);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          })
      )
    );

    const newImages = results.filter((r): r is string => r !== null);
    if (newImages.length > 0) {
      onChange({
        ...landmark,
        referenceImages: [...landmark.referenceImages, ...newImages],
      });
    }

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    if (!landmark) return;
    onChange({
      ...landmark,
      referenceImages: landmark.referenceImages.filter((_, i) => i !== index),
    });
  };

  if (!landmark) {
    return (
      <div className="space-y-2">
        <label
          className="block"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            fontWeight: 600,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          Landmark / Edificio
          <span
            className="ml-2 text-sm font-normal"
            style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
          >
            (opcional)
          </span>
        </label>

        <button
          type="button"
          onClick={handleEnable}
          className="w-full py-3 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 transition-colors hover:border-amber-400"
          style={{
            borderColor: CASA_BRAND.colors.secondary.grayLight,
            color: CASA_BRAND.colors.secondary.grayMedium,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
          }}
        >
          <Building2 size={18} />
          Agregar un landmark como personaje del cuento
        </button>

        <p
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '12px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          Puedes hacer que una iglesia, edificio o monumento sea casi un "personaje" en la historia.
          Sube fotos de referencia para que aparezca fielmente en las ilustraciones.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label
          className="block"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            fontWeight: 600,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          Landmark / Edificio
        </label>
        <button
          type="button"
          onClick={handleDisable}
          className="p-1 rounded hover:bg-gray-100"
          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
          title="Quitar landmark"
        >
          <X size={16} />
        </button>
      </div>

      <div
        className="p-4 rounded-lg border"
        style={{
          borderColor: CASA_BRAND.colors.primary.amber,
          backgroundColor: CASA_BRAND.colors.primary.white,
        }}
      >
        {/* Header icon */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            <Building2 size={16} />
          </div>
          <span
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 600,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            Landmark como Personaje
          </span>
        </div>

        <div className="space-y-3">
          {/* Name */}
          <div>
            <label
              className="block mb-1"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
                color: CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              Nombre del Landmark *
            </label>
            <input
              type="text"
              value={landmark.name}
              onChange={(e) => handleUpdate('name', e.target.value)}
              placeholder="Ej: La Iglesia de San Marcos de Arica"
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                borderColor: CASA_BRAND.colors.secondary.grayLight,
                backgroundColor: CASA_BRAND.colors.primary.white,
              }}
            />
          </div>

          {/* Narrative Role */}
          <div>
            <label
              className="block mb-1"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
                color: CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              Rol narrativo *
            </label>
            <textarea
              value={landmark.narrativeRole}
              onChange={(e) => handleUpdate('narrativeRole', e.target.value)}
              placeholder="Ej: Es el corazón de la comunidad, donde todos se reúnen. La historia gira en torno a este lugar."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 resize-none"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                borderColor: CASA_BRAND.colors.secondary.grayLight,
                backgroundColor: CASA_BRAND.colors.primary.white,
              }}
            />
          </div>

          {/* Prominence */}
          <div>
            <label
              className="block mb-1"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
                color: CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              Prominencia en el cuento
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleUpdate('role', 'primary')}
                className="flex-1 px-3 py-2 rounded-lg border text-sm transition-all"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  borderColor: landmark.role === 'primary'
                    ? CASA_BRAND.colors.primary.amber
                    : CASA_BRAND.colors.secondary.grayLight,
                  backgroundColor: landmark.role === 'primary'
                    ? `${CASA_BRAND.colors.amber.light}30`
                    : CASA_BRAND.colors.primary.white,
                  color: landmark.role === 'primary'
                    ? CASA_BRAND.colors.primary.black
                    : CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                Principal — aparece en muchas escenas
              </button>
              <button
                type="button"
                onClick={() => handleUpdate('role', 'secondary')}
                className="flex-1 px-3 py-2 rounded-lg border text-sm transition-all"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  borderColor: landmark.role === 'secondary'
                    ? CASA_BRAND.colors.primary.amber
                    : CASA_BRAND.colors.secondary.grayLight,
                  backgroundColor: landmark.role === 'secondary'
                    ? `${CASA_BRAND.colors.amber.light}30`
                    : CASA_BRAND.colors.primary.white,
                  color: landmark.role === 'secondary'
                    ? CASA_BRAND.colors.primary.black
                    : CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                Secundario — aparece en algunas escenas
              </button>
            </div>
          </div>

          {/* Reference Images Upload */}
          <div>
            <label
              className="block mb-1"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
                color: CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              Fotos de Referencia ({landmark.referenceImages.length}/{maxImages})
            </label>

            {/* Info tip */}
            <div
              className="flex items-start gap-2 mb-2 p-2 rounded"
              style={{ backgroundColor: `${CASA_BRAND.colors.amber.light}15` }}
            >
              <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: CASA_BRAND.colors.primary.amber }} />
              <p
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '11px',
                  color: CASA_BRAND.colors.secondary.grayDark,
                }}
              >
                Sube fotos reales del landmark desde diferentes ángulos. El sistema las analizará para generar
                una descripción visual detallada y las usará como referencia en cada escena donde aparezca.
              </p>
            </div>

            {/* Image grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {landmark.referenceImages.map((img, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-lg overflow-hidden border group"
                  style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                >
                  <img
                    src={img}
                    alt={`Referencia ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {landmark.referenceImages.length < maxImages && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors hover:border-amber-400"
                  style={{
                    borderColor: CASA_BRAND.colors.secondary.grayLight,
                    color: CASA_BRAND.colors.secondary.grayMedium,
                  }}
                >
                  <ImagePlus size={20} />
                  <span
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '10px',
                    }}
                  >
                    Subir foto
                  </span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandmarkInput;
