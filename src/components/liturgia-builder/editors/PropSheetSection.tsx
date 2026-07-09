/**
 * Sección "Lugares y objetos recurrentes" del paso Personajes del
 * Cuentacuentos: da a los lugares/objetos el mismo tratamiento de
 * consistencia visual que los personajes — una hoja de referencia canónica
 * generada en el estilo del cuento (o fotos reales subidas por el usuario)
 * que luego se adjunta a cada escena donde aparecen.
 */

import React, { useRef, useState } from 'react';
import { Loader2, RefreshCw, Camera, MapPin, Package, Plus, Trash2, Upload, Check } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { StoryProp, PropKind } from '@/types/shared/story';

const imageSrc = (value: string): string =>
  value.startsWith('http') || value.startsWith('data:') ? value : `data:image/png;base64,${value}`;

const PhotoUploadButton: React.FC<{
  onUpload: (base64: string) => void;
  disabled?: boolean;
}> = ({ onUpload, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen es muy grande. Máximo 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      onUpload(base64);
    };
    reader.readAsDataURL(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50 border"
        style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight, color: CASA_BRAND.colors.secondary.grayDark }}
      >
        <Upload size={14} />
        Subir foto
      </button>
    </>
  );
};

export interface PropSheetSectionProps {
  storyProps: StoryProp[];
  sheetOptions: Record<string, string[]>;
  selectedSheets: Record<string, number>;
  generatingPropId: string | null;
  pipelineBusy: boolean;
  /** Estado del item `prop-<id>` en el pipeline (undefined si no participa). */
  statusOf: (id: string) => string | undefined;
  onGenerate: (prop: StoryProp) => void;
  onSelect: (propId: string, index: number) => void;
  onUploadPhoto: (propId: string, base64: string) => void;
  onRemove: (propId: string) => void;
  onAdd: (draft: { name: string; kind: PropKind; narrativeRole: string; visualDescription: string }) => void;
  onUpdateDescription: (propId: string, visualDescription: string) => void;
}

const PropSheetSection: React.FC<PropSheetSectionProps> = ({
  storyProps,
  sheetOptions,
  selectedSheets,
  generatingPropId,
  pipelineBusy,
  statusOf,
  onGenerate,
  onSelect,
  onUploadPhoto,
  onRemove,
  onAdd,
  onUpdateDescription,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<PropKind>('prop');
  const [newDescription, setNewDescription] = useState('');
  // Borradores locales de descripción: se confirman al salir del campo (blur)
  // para no reconstruir el story (y sus slides de preview) en cada tecla.
  const [descriptionDrafts, setDescriptionDrafts] = useState<Record<string, string>>({});

  const busy = pipelineBusy || generatingPropId !== null;

  const handleAdd = () => {
    if (!newName.trim() || !newDescription.trim()) return;
    onAdd({
      name: newName.trim(),
      kind: newKind,
      narrativeRole: '',
      visualDescription: newDescription.trim(),
    });
    setNewName('');
    setNewDescription('');
    setNewKind('prop');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h5 className="font-medium flex items-center gap-2" style={{ color: CASA_BRAND.colors.primary.black }}>
          <Package size={18} style={{ color: CASA_BRAND.colors.primary.amber }} />
          Lugares y objetos recurrentes
        </h5>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border transition-colors"
          style={{ borderColor: CASA_BRAND.colors.secondary.grayLight, color: CASA_BRAND.colors.secondary.grayDark }}
        >
          <Plus size={14} /> Agregar lugar u objeto
        </button>
      </div>

      <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
        Igual que los personajes, cada lugar u objeto que se repite entre escenas necesita una imagen
        de referencia para verse siempre igual. Genera una en el estilo del cuento o sube fotos reales.
      </p>

      {showAddForm && (
        <div className="p-3 rounded-lg border space-y-2" style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight }}>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre (ej: el auto rojo del abuelo)"
              className="flex-1 px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
            />
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value === 'location' ? 'location' : 'prop')}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
            >
              <option value="prop">Objeto</option>
              <option value="location">Lugar</option>
            </select>
          </div>
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Descripción visual detallada: forma, colores exactos, materiales, detalles distintivos…"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newName.trim() || !newDescription.trim()}
              className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
              style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: 'white' }}
            >
              Agregar
            </button>
          </div>
        </div>
      )}

      {storyProps.length === 0 && !showAddForm && (
        <p className="text-sm italic" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
          Este cuento no tiene lugares u objetos recurrentes detectados.
        </p>
      )}

      {storyProps.map((prop) => {
        const options = sheetOptions[prop.id] || [];
        const selectedIdx = selectedSheets[prop.id];
        const hasPhotos = (prop.referenceImages?.length ?? 0) > 0;
        const isGeneratingThis =
          generatingPropId === prop.id || statusOf(`prop-${prop.id}`) === 'running';

        return (
          <div key={prop.id} className="p-4 rounded-lg border" style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {prop.kind === 'location'
                  ? <MapPin size={16} style={{ color: CASA_BRAND.colors.primary.amber }} />
                  : <Package size={16} style={{ color: CASA_BRAND.colors.primary.amber }} />}
                <span className="font-medium text-sm" style={{ color: CASA_BRAND.colors.primary.black }}>{prop.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight, color: CASA_BRAND.colors.secondary.grayDark }}>
                  {prop.kind === 'location' ? 'Lugar' : 'Objeto'}
                </span>
                {(prop.sceneNumbers?.length ?? 0) > 0 && (
                  <span className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                    Escenas {prop.sceneNumbers!.join(', ')}
                  </span>
                )}
                {statusOf(`prop-${prop.id}`) === 'error' && !pipelineBusy && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>Error</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onGenerate(prop)}
                  disabled={busy || !prop.visualDescription?.trim()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                  style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: 'white' }}
                >
                  {isGeneratingThis ? (
                    <><Loader2 size={14} className="animate-spin" /> Generando...</>
                  ) : options.length > 0 ? (
                    <><RefreshCw size={14} /> Regenerar</>
                  ) : (
                    <><Camera size={14} /> Generar referencia</>
                  )}
                </button>
                <PhotoUploadButton onUpload={(base64) => onUploadPhoto(prop.id, base64)} disabled={busy} />
                <button
                  type="button"
                  onClick={() => onRemove(prop.id)}
                  disabled={busy}
                  className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
                  style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                  title="Quitar este lugar/objeto"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <textarea
              value={descriptionDrafts[prop.id] ?? prop.visualDescription ?? ''}
              onChange={(e) => setDescriptionDrafts(prev => ({ ...prev, [prop.id]: e.target.value }))}
              onBlur={() => {
                const draftText = descriptionDrafts[prop.id];
                if (draftText !== undefined && draftText !== prop.visualDescription) {
                  onUpdateDescription(prop.id, draftText);
                }
                setDescriptionDrafts(prev => {
                  const next = { ...prev };
                  delete next[prop.id];
                  return next;
                });
              }}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border text-xs mb-2"
              style={{ borderColor: CASA_BRAND.colors.secondary.grayLight, color: CASA_BRAND.colors.secondary.grayDark }}
              placeholder="Descripción visual canónica (se copia textual en cada escena)"
            />

            {/* Candidatas de hoja de referencia generadas */}
            {options.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                {options.map((option, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelect(prop.id, idx)}
                    disabled={busy}
                    className="relative rounded-lg overflow-hidden border-2 transition-all"
                    style={{ borderColor: selectedIdx === idx ? CASA_BRAND.colors.primary.amber : 'transparent' }}
                  >
                    <img src={imageSrc(option)} alt={`${prop.name} opción ${idx + 1}`} className="w-full aspect-[4/3] object-cover" />
                    {selectedIdx === idx && (
                      <span className="absolute top-1 right-1 rounded-full p-1" style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}>
                        <Check size={12} color="white" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Referencias actuales (hoja elegida y/o fotos del usuario) */}
            {hasPhotos && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>Referencias en uso:</span>
                {(prop.referenceImages || []).slice(0, 4).map((img, idx) => (
                  <img key={idx} src={imageSrc(img)} alt={`${prop.name} referencia ${idx + 1}`} className="h-12 w-16 object-cover rounded border" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PropSheetSection;
