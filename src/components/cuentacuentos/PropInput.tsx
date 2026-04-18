/**
 * PropInput - Input para definir un prop (lugar u objeto) del cuento
 * Permite subir fotos de referencia para mantener consistencia visual entre escenas
 */

import React, { useRef } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { MapPin, Package, X, ImagePlus, Info } from 'lucide-react';
import type { PropKind, PropRole, StoryProp } from '@/types/shared/story';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

interface PropInputProps {
  value: StoryProp;
  onChange: (p: StoryProp) => void;
  onRemove: () => void;
  maxImages?: number;
}

const PropInput: React.FC<PropInputProps> = ({
  value,
  onChange,
  onRemove,
  maxImages = 4,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdate = <K extends keyof StoryProp>(field: K, fieldValue: StoryProp[K]) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const allFiles = Array.from(e.target.files);
    const validFiles = allFiles.filter((file) => {
      if (file.size > MAX_IMAGE_BYTES) {
        window.alert(
          `La imagen "${file.name}" supera el límite de 5MB y fue omitida.`
        );
        return false;
      }
      return true;
    });

    const remainingSlots = maxImages - value.referenceImages.length;
    const filesToProcess = validFiles.slice(0, remainingSlots);

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
        ...value,
        referenceImages: [...value.referenceImages, ...newImages],
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    onChange({
      ...value,
      referenceImages: value.referenceImages.filter((_, i) => i !== index),
    });
  };

  const kindOptions: { id: PropKind; label: string; icon: React.ReactNode }[] = [
    { id: 'location', label: 'Lugar / Escenario', icon: <MapPin size={14} /> },
    { id: 'prop', label: 'Objeto', icon: <Package size={14} /> },
  ];

  const roleOptions: { id: PropRole; label: string }[] = [
    { id: 'primary', label: 'Principal — aparece en muchas escenas' },
    { id: 'secondary', label: 'Secundario — aparece en algunas escenas' },
  ];

  const headerIcon =
    value.kind === 'location' ? <MapPin size={16} /> : <Package size={16} />;
  const headerLabel =
    value.kind === 'location' ? 'Lugar de Referencia' : 'Objeto de Referencia';

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
          Prop del cuento
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded hover:bg-gray-100"
          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
          title="Quitar prop"
          aria-label="Quitar prop"
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
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            {headerIcon}
          </div>
          <span
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 600,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            {headerLabel}
          </span>
        </div>

        <div className="space-y-3">
          {/* Kind toggle */}
          <div>
            <label
              className="block mb-1"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
                color: CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              Tipo de prop
            </label>
            <div className="flex gap-3">
              {kindOptions.map((opt) => {
                const active = value.kind === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleUpdate('kind', opt.id)}
                    className="flex-1 px-3 py-2 rounded-lg border text-sm transition-all flex items-center justify-center gap-2"
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      borderColor: active
                        ? CASA_BRAND.colors.primary.amber
                        : CASA_BRAND.colors.secondary.grayLight,
                      backgroundColor: active
                        ? `${CASA_BRAND.colors.amber.light}30`
                        : CASA_BRAND.colors.primary.white,
                      color: active
                        ? CASA_BRAND.colors.primary.black
                        : CASA_BRAND.colors.secondary.grayMedium,
                    }}
                    aria-pressed={active}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

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
              Nombre *
            </label>
            <input
              type="text"
              value={value.name}
              onChange={(e) => handleUpdate('name', e.target.value)}
              placeholder={
                value.kind === 'location'
                  ? 'Ej: La playa al amanecer'
                  : 'Ej: Sombrero rojo con pluma'
              }
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
              value={value.narrativeRole}
              onChange={(e) => handleUpdate('narrativeRole', e.target.value)}
              placeholder={
                value.kind === 'location'
                  ? 'Ej: Es donde los personajes se encuentran por primera vez.'
                  : 'Ej: Lo lleva el protagonista durante toda la aventura.'
              }
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

          {/* Role (prominence) */}
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
              {roleOptions.map((opt) => {
                const active = value.role === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleUpdate('role', opt.id)}
                    className="flex-1 px-3 py-2 rounded-lg border text-sm transition-all"
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      borderColor: active
                        ? CASA_BRAND.colors.primary.amber
                        : CASA_BRAND.colors.secondary.grayLight,
                      backgroundColor: active
                        ? `${CASA_BRAND.colors.amber.light}30`
                        : CASA_BRAND.colors.primary.white,
                      color: active
                        ? CASA_BRAND.colors.primary.black
                        : CASA_BRAND.colors.secondary.grayMedium,
                    }}
                    aria-pressed={active}
                  >
                    {opt.label}
                  </button>
                );
              })}
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
              Fotos de Referencia ({value.referenceImages.length}/{maxImages})
            </label>

            <div
              className="flex items-start gap-2 mb-2 p-2 rounded"
              style={{ backgroundColor: `${CASA_BRAND.colors.amber.light}15` }}
            >
              <Info
                size={14}
                className="flex-shrink-0 mt-0.5"
                style={{ color: CASA_BRAND.colors.primary.amber }}
              />
              <p
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '11px',
                  color: CASA_BRAND.colors.secondary.grayDark,
                }}
              >
                Sube hasta {maxImages} fotos de referencia (máx. 5MB cada una). El sistema
                las usará para mantener el prop consistente en todas las escenas.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {value.referenceImages.map((img, index) => (
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
                    aria-label={`Quitar referencia ${index + 1}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {value.referenceImages.length < maxImages && (
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

export default PropInput;
