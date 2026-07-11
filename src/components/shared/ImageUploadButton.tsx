/**
 * Botón para subir una imagen manualmente (valida tipo y tamaño ≤5MB) y
 * entregarla como base64 crudo (sin prefijo data:). Compartido por el editor
 * de Cuentacuentos y la sección de lugares/objetos recurrentes.
 */

import React from 'react';
import { Upload } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';

const ImageUploadButton: React.FC<{
  onUpload: (base64: string) => void;
  label: string;
  disabled?: boolean;
}> = ({ onUpload, label, disabled }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen');
      return;
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen es muy grande. Máximo 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extraer solo el base64 (sin el prefijo data:image/...)
      const base64 = result.split(',')[1];
      onUpload(base64);
    };
    reader.readAsDataURL(file);

    // Limpiar el input para permitir subir el mismo archivo de nuevo
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50 border"
        style={{
          backgroundColor: CASA_BRAND.colors.primary.white,
          borderColor: CASA_BRAND.colors.secondary.grayLight,
          color: CASA_BRAND.colors.secondary.grayDark,
        }}
      >
        <Upload size={14} />
        Subir {label}
      </button>
    </>
  );
};

export default ImageUploadButton;
