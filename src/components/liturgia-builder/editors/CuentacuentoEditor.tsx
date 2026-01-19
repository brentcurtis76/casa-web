/**
 * CuentacuentoEditor - Panel para crear/editar cuentos en el Constructor
 * Integra generación de cuentos con Claude y imágenes con Nano Banana Pro
 */

import React, { useState, useCallback, useEffect } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { supabase } from '@/integrations/supabase/client';
import {
  BookOpen,
  Sparkles,
  Edit3,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Check,
  Loader2,
  MapPin,
  Users,
  Palette,
  FileText,
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  Camera,
  User,
  CheckCircle,
  Circle,
  AlertCircle,
  Code,
  X,
  Plus,
  Upload,
  MessageSquare,
} from 'lucide-react';
import type { LiturgyContext } from '@/types/shared/liturgy';
import type { SlideGroup, Slide } from '@/types/shared/slide';
import type { Story, StoryCharacter, StoryScene, StoryStatus } from '@/types/shared/story';
import { createPreviewSlideGroup } from '@/lib/cuentacuentos/storyToSlides';
import { useCuentacuentosDraft, type CuentacuentosDraftFull } from '@/hooks/useCuentacuentosDraft';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

interface CuentacuentoEditorProps {
  context: LiturgyContext;
  initialStory?: Story;
  initialSlides?: SlideGroup;
  onStoryCreated: (story: Story, slides: SlideGroup) => void;
  onStoryProgress?: (story: Story, slides: SlideGroup | null) => void;
  onStoryDeleted?: () => void;
  onNavigateToFullEditor?: () => void;
}

// Lugares predefinidos para Chile
const LOCATION_PRESETS = [
  { id: 'santiago', name: 'Santiago', description: 'La capital entre los cerros' },
  { id: 'valparaiso', name: 'Valparaíso', description: 'Ciudad puerto de colores' },
  { id: 'atacama', name: 'Desierto de Atacama', description: 'El desierto más árido' },
  { id: 'sur', name: 'Sur de Chile', description: 'Bosques y lagos' },
  { id: 'chiloe', name: 'Chiloé', description: 'Isla de mitos y palafitos' },
  { id: 'custom', name: 'Otro lugar', description: 'Especificar manualmente' },
];

// Estilos narrativos
const STORY_STYLES = [
  { id: 'aventura', name: 'Aventura', description: 'Emocionante y lleno de acción' },
  { id: 'reflexivo', name: 'Reflexivo', description: 'Mensaje profundo y significativo' },
  { id: 'humoristico', name: 'Humorístico', description: 'Divertido y alegre' },
  { id: 'misterio', name: 'Misterio', description: 'Con elementos de suspenso' },
];

// Estilos de ilustración disponibles
const ILLUSTRATION_STYLES = [
  { id: 'ghibli', name: 'Studio Ghibli', description: 'Estilo suave y cálido con fondos acuarelados' },
  { id: 'pixar', name: 'Pixar', description: 'Animación 3D expresiva y colorida' },
  { id: 'disney-classic', name: 'Disney Clásico', description: 'Animación 2D tradicional' },
  { id: 'storybook', name: 'Libro de Cuentos', description: 'Ilustración clásica de libro infantil' },
  { id: 'watercolor', name: 'Acuarela Infantil', description: 'Acuarelas suaves y delicadas' },
  { id: 'eric-carle', name: 'Estilo Eric Carle', description: 'Collage colorido con texturas' },
  { id: 'folk-art', name: 'Arte Folk Latino', description: 'Arte popular latinoamericano colorido' },
  { id: 'anime-soft', name: 'Anime Suave', description: 'Anime tierno con colores pastel' },
];

// Pasos del flujo de creación
type CreationStep =
  | 'config'           // Configurar lugar, personajes, estilo
  | 'story'            // Generar y revisar cuento
  | 'characters'       // Generar y aprobar character sheets
  | 'scenes'           // Generar y seleccionar imágenes de escenas
  | 'cover'            // Generar y seleccionar portada/fin
  | 'complete';        // Cuento completo

/**
 * Vista previa de slide de cuento
 */
const StorySlidePreview: React.FC<{ slide: Slide }> = ({ slide }) => {
  const isTitle = slide.type === 'title' || slide.type === 'song-title';

  return (
    <div
      className="aspect-[4/3] rounded-lg flex items-center justify-center p-3 text-center"
      style={{
        backgroundColor: CASA_BRAND.colors.primary.black,
        border: `1px solid ${CASA_BRAND.colors.secondary.grayLight}`,
      }}
    >
      <p
        style={{
          color: CASA_BRAND.colors.primary.white,
          fontFamily: isTitle ? CASA_BRAND.fonts.heading : CASA_BRAND.fonts.body,
          fontSize: isTitle ? '11px' : '9px',
          lineHeight: 1.4,
        }}
      >
        {slide.content.primary?.slice(0, 100)}
        {(slide.content.primary?.length || 0) > 100 && '...'}
      </p>
    </div>
  );
};

/**
 * Componente para mostrar opciones de imagen y seleccionar
 */
const ImageSelector: React.FC<{
  options: string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onSave?: () => Promise<void>;
  onRegenerate?: () => void;
  isGenerating: boolean;
  isSaving?: boolean;
  savedMessage?: string | null;
  label: string;
}> = ({ options, selectedIndex, onSelect, onSave, onRegenerate, isGenerating, isSaving, savedMessage, label }) => {
  if (isGenerating) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 size={24} className="animate-spin mr-2" style={{ color: CASA_BRAND.colors.primary.amber }} />
        <span style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>Generando {label}...</span>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="text-center p-8" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
        No hay imágenes disponibles
      </div>
    );
  }

  // Detectar si el valor es una URL o base64
  const getImageSrc = (value: string): string => {
    // Si ya es una URL (http/https) o data URL, usarla directamente
    if (value.startsWith('http') || value.startsWith('data:')) {
      return value;
    }
    // Si es base64 puro, agregar el prefijo
    return `data:image/png;base64,${value}`;
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {options.map((imageValue, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index)}
            className={`relative rounded-lg overflow-hidden transition-all ${
              selectedIndex === index ? 'ring-4' : 'hover:ring-2'
            }`}
            style={{
              ringColor: CASA_BRAND.colors.primary.amber,
            }}
          >
            <img
              src={getImageSrc(imageValue)}
              alt={`Opción ${index + 1}`}
              className="w-full aspect-[4/3] object-cover"
            />
            {selectedIndex === index && (
              <div
                className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
              >
                <Check size={14} color="white" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Botón Guardar - aparece cuando hay selección */}
      {selectedIndex !== null && onSave && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check size={16} />
                Guardar selección
              </>
            )}
          </button>
          {savedMessage && (
            <div
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: `${CASA_BRAND.colors.primary.amber}15`,
                color: CASA_BRAND.colors.primary.amber,
              }}
            >
              <CheckCircle size={16} />
              {savedMessage}
            </div>
          )}
        </div>
      )}

      {onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.white,
            borderColor: CASA_BRAND.colors.secondary.grayLight,
            color: CASA_BRAND.colors.secondary.grayDark,
          }}
        >
          <RefreshCw size={14} />
          No me gustan, generar otras opciones
        </button>
      )}
    </div>
  );
};

/**
 * Componente para subir imagen manualmente
 */
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

/**
 * Indicador de progreso de pasos
 */
const StepIndicator: React.FC<{
  currentStep: CreationStep;
  storyStatus: StoryStatus;
}> = ({ currentStep, storyStatus }) => {
  const steps = [
    { id: 'config', label: 'Configurar', icon: Palette },
    { id: 'story', label: 'Cuento', icon: BookOpen },
    { id: 'characters', label: 'Personajes', icon: Users },
    { id: 'scenes', label: 'Escenas', icon: ImageIcon },
    { id: 'cover', label: 'Portada', icon: Camera },
  ];

  const getStepStatus = (stepId: string): 'completed' | 'current' | 'pending' => {
    const stepOrder = steps.map(s => s.id);
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(stepId);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((step, index) => {
        const status = getStepStatus(step.id);
        const Icon = step.icon;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mb-1"
                style={{
                  backgroundColor: status === 'completed' ? CASA_BRAND.colors.primary.amber
                    : status === 'current' ? `${CASA_BRAND.colors.primary.amber}20`
                    : CASA_BRAND.colors.secondary.grayLight,
                  border: status === 'current' ? `2px solid ${CASA_BRAND.colors.primary.amber}` : 'none',
                }}
              >
                {status === 'completed' ? (
                  <Check size={20} color="white" />
                ) : (
                  <Icon
                    size={20}
                    style={{
                      color: status === 'current' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayMedium,
                    }}
                  />
                )}
              </div>
              <span
                className="text-xs"
                style={{
                  color: status === 'current' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayMedium,
                  fontWeight: status === 'current' ? 600 : 400,
                }}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className="flex-1 h-0.5 mx-2"
                style={{
                  backgroundColor: getStepStatus(steps[index + 1].id) !== 'pending'
                    ? CASA_BRAND.colors.primary.amber
                    : CASA_BRAND.colors.secondary.grayLight,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const CuentacuentoEditor: React.FC<CuentacuentoEditorProps> = ({
  context,
  initialStory,
  initialSlides,
  onStoryCreated,
  onStoryProgress,
  onStoryDeleted,
  onNavigateToFullEditor,
}) => {
  // Determinar paso inicial basado en estado del story
  const getInitialStep = (): CreationStep => {
    if (!initialStory) return 'config';
    switch (initialStory.metadata.status) {
      case 'draft': return 'config';
      case 'story-generated': return 'story';
      case 'characters-pending': return 'characters';
      case 'characters-approved': return 'scenes';
      case 'scenes-pending': return 'scenes';
      case 'ready': return 'complete';
      default: return 'config';
    }
  };

  // Estado del formulario
  const [location, setLocation] = useState(initialStory?.location?.name || '');
  const [customLocation, setCustomLocation] = useState('');
  const [characters, setCharacters] = useState(
    Array.isArray(initialStory?.characters)
      ? initialStory.characters.map(c => typeof c === 'string' ? c : c.name).join(', ')
      : ''
  );
  const [style, setStyle] = useState('reflexivo');
  const [illustrationStyle, setIllustrationStyle] = useState(initialStory?.illustrationStyle || 'ghibli');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Estado del cuento
  const [story, setStory] = useState<Story | null>(initialStory || null);
  const [previewSlides, setPreviewSlides] = useState<SlideGroup | null>(initialSlides || null);

  // Estado del flujo
  const [currentStep, setCurrentStep] = useState<CreationStep>(getInitialStep());

  // Estado de generación de imágenes
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingCharacterIndex, setGeneratingCharacterIndex] = useState<number | null>(null);
  const [generatingSceneIndex, setGeneratingSceneIndex] = useState<number | null>(null);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [generatingEnd, setGeneratingEnd] = useState(false);

  // Estado de selección de personajes
  const [characterSheetOptions, setCharacterSheetOptions] = useState<Record<string, string[]>>({});
  const [selectedCharacterSheets, setSelectedCharacterSheets] = useState<Record<string, number>>({});

  // Estado de selección de escenas
  const [sceneImageOptions, setSceneImageOptions] = useState<Record<number, string[]>>({});
  const [selectedSceneImages, setSelectedSceneImages] = useState<Record<number, number>>({});

  // Estado de portada/fin
  const [coverOptions, setCoverOptions] = useState<string[]>([]);
  const [selectedCover, setSelectedCover] = useState<number | null>(null);
  const [endOptions, setEndOptions] = useState<string[]>([]);
  const [selectedEnd, setSelectedEnd] = useState<number | null>(null);

  // Estado de guardado manual de imágenes
  const [savingCharacter, setSavingCharacter] = useState<string | null>(null);
  const [savedCharacterMessage, setSavedCharacterMessage] = useState<Record<string, string | null>>({});
  const [savingScene, setSavingScene] = useState<number | null>(null);
  const [savedSceneMessage, setSavedSceneMessage] = useState<Record<number, string | null>>({});
  const [savingCover, setSavingCover] = useState(false);
  const [savedCoverMessage, setSavedCoverMessage] = useState<string | null>(null);
  const [savingEnd, setSavingEnd] = useState(false);
  const [savedEndMessage, setSavedEndMessage] = useState<string | null>(null);

  // Estado para ver/editar prompts y referencias de escenas
  const [expandedScenePrompts, setExpandedScenePrompts] = useState<Record<number, boolean>>({});
  const [sceneExcludedCharacters, setSceneExcludedCharacters] = useState<Record<number, string[]>>({});
  const [sceneIncludedCharacters, setSceneIncludedCharacters] = useState<Record<number, string[]>>({}); // Personajes agregados manualmente
  const [editingScenePrompt, setEditingScenePrompt] = useState<Record<number, string>>({});
  const [showCharacterPicker, setShowCharacterPicker] = useState<number | null>(null); // Número de escena para picker
  const [sceneReferenceImages, setSceneReferenceImages] = useState<Record<number, string>>({}); // Imagen de referencia manual por escena

  // Estado para ver/editar prompts y referencias de portada y fin
  const [showCoverPromptEditor, setShowCoverPromptEditor] = useState(false);
  const [showEndPromptEditor, setShowEndPromptEditor] = useState(false);
  const [editingCoverPrompt, setEditingCoverPrompt] = useState('');
  const [editingEndPrompt, setEditingEndPrompt] = useState('');
  const [coverReferenceImage, setCoverReferenceImage] = useState<string | null>(null);
  const [endReferenceImage, setEndReferenceImage] = useState<string | null>(null);
  const [coverExcludedCharacters, setCoverExcludedCharacters] = useState<string[]>([]);
  const [coverIncludedCharacters, setCoverIncludedCharacters] = useState<string[]>([]);

  // Estado de UI
  const [showPreview, setShowPreview] = useState(true);
  const [showForm, setShowForm] = useState(!initialStory);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [promptPreview, setPromptPreview] = useState<{ systemPrompt: string; userPrompt: string } | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [confirmed, setConfirmed] = useState(!!initialStory && initialStory.metadata.status === 'ready');

  // Estado para refinamiento del cuento
  const [storyFeedback, setStoryFeedback] = useState('');
  const [refinementType, setRefinementType] = useState<'general' | 'characters' | 'plot' | 'scenes' | 'spiritual' | 'length' | 'tone'>('general');
  const [isRefining, setIsRefining] = useState(false);
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false);

  // Hook de auto-guardado
  const {
    hasDraft,
    draft,
    lastSavedAt,
    isSaving,
    saveDraft,
    deleteDraft,
    deleteStoryImages,
    showRecoveryPrompt,
    acceptRecovery,
    declineRecovery,
    saveDraftNow,
  } = useCuentacuentosDraft({ liturgyId: context.id });

  // Estado del diálogo de confirmación de eliminación
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Efecto para inicializar estados de imágenes cuando hay un initialStory
  // IMPORTANTE: Solo inicializar si NO hay un draft con imágenes que recuperar
  useEffect(() => {
    if (!initialStory) return;

    // Verificar si hay escenas sin imágenes en initialStory
    const scenesWithoutImages = initialStory.scenes?.filter(s => !s.selectedImageUrl).length || 0;
    const totalScenes = initialStory.scenes?.length || 0;
    const hasMissingSceneImages = scenesWithoutImages > 0 && totalScenes > 0;

    console.log(`[CuentacuentoEditor] initialStory has ${totalScenes - scenesWithoutImages}/${totalScenes} scene images`);

    // Inicializar character sheets con las imágenes existentes
    const charSheetOpts: Record<string, string[]> = {};
    const charSheetSelected: Record<string, number> = {};
    initialStory.characters?.forEach(char => {
      if (char.characterSheetUrl) {
        charSheetOpts[char.id] = [char.characterSheetUrl];
        charSheetSelected[char.id] = 0;
      }
    });
    if (Object.keys(charSheetOpts).length > 0) {
      setCharacterSheetOptions(charSheetOpts);
      setSelectedCharacterSheets(charSheetSelected);
    }

    // Inicializar scene images con las imágenes existentes
    const sceneOpts: Record<number, string[]> = {};
    const sceneSelected: Record<number, number> = {};
    initialStory.scenes?.forEach(scene => {
      if (scene.selectedImageUrl) {
        sceneOpts[scene.number] = [scene.selectedImageUrl];
        sceneSelected[scene.number] = 0;
      }
    });
    if (Object.keys(sceneOpts).length > 0) {
      setSceneImageOptions(sceneOpts);
      setSelectedSceneImages(sceneSelected);
    }

    // Inicializar cover y end
    if (initialStory.coverImageUrl) {
      setCoverOptions([initialStory.coverImageUrl]);
      setSelectedCover(0);
    }
    if (initialStory.endImageUrl) {
      setEndOptions([initialStory.endImageUrl]);
      setSelectedEnd(0);
    }

    console.log('[CuentacuentoEditor] Initialized image states from initialStory');

    // Si el cuento ya está completo Y tiene todas las imágenes, eliminar cualquier borrador viejo
    // NO borrar el draft si faltan imágenes - las necesitamos recuperar del draft
    if (initialStory.metadata.status === 'ready' && !hasMissingSceneImages) {
      deleteDraft();
      console.log('[CuentacuentoEditor] Deleted old draft - story is complete with all images');
    } else if (hasMissingSceneImages) {
      console.log('[CuentacuentoEditor] Keeping draft - story is missing scene images, will try to recover from draft');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo al montar - initialStory es estable

  // AUTO-SAVE DISABLED: Following Portadas pattern, we no longer auto-save.
  // Images stay in memory (as base64) until user clicks "Guardar Liturgia",
  // at which point saveLiturgy uploads them to storage.
  // This prevents race conditions between auto-save and manual save.
  //
  // The draft recovery system is still available for initial recovery,
  // but we don't continuously update the draft during editing.
  //
  // If you need to re-enable auto-save in the future, uncomment the code below.
  /*
  useEffect(() => {
    // Solo guardar si hay progreso real (no en config inicial ni complete)
    if (currentStep === 'config' || currentStep === 'complete') return;

    saveDraft({
      currentStep,
      config: {
        location,
        customLocation,
        characters,
        style,
        illustrationStyle,
        additionalNotes,
      },
      story,
      characterSheetOptions,
      selectedCharacterSheets,
      sceneImageOptions,
      selectedSceneImages,
      coverOptions,
      selectedCover,
      endOptions,
      selectedEnd,
    });
  }, [
    currentStep,
    story,
    characterSheetOptions,
    selectedCharacterSheets,
    sceneImageOptions,
    selectedSceneImages,
    coverOptions,
    selectedCover,
    endOptions,
    selectedEnd,
    location,
    customLocation,
    characters,
    style,
    illustrationStyle,
    additionalNotes,
  ]);
  */

  // STATE PERSISTENCE: Notify parent of story progress to survive tab navigation
  // This effect calls onStoryProgress whenever the story state changes,
  // allowing the parent (ConstructorLiturgias) to persist the in-progress story.
  // When the user switches tabs and comes back, the story will be passed via initialStory.
  useEffect(() => {
    if (!story || !onStoryProgress) return;

    // Build current story state with all selected images
    const currentStory: Story = {
      ...story,
      characters: story.characters.map(char => {
        const charOptions = characterSheetOptions[char.id];
        const selectedIdx = selectedCharacterSheets[char.id];
        const selectedSheet = charOptions && selectedIdx !== undefined ? charOptions[selectedIdx] : char.characterSheetUrl;
        return {
          ...char,
          characterSheetOptions: charOptions,
          characterSheetUrl: selectedSheet,
        };
      }),
      scenes: story.scenes.map(scene => {
        const options = sceneImageOptions[scene.number];
        const selectedIdx = selectedSceneImages[scene.number];
        const selectedImage = options && selectedIdx !== undefined ? options[selectedIdx] : scene.selectedImageUrl;
        return {
          ...scene,
          imageOptions: options,
          selectedImageUrl: selectedImage,
        };
      }),
      coverImageOptions: coverOptions,
      coverImageUrl: selectedCover !== null ? coverOptions[selectedCover] : story.coverImageUrl,
      endImageOptions: endOptions,
      endImageUrl: selectedEnd !== null ? endOptions[selectedEnd] : story.endImageUrl,
    };

    // Generate preview slides for current state
    const slides = createPreviewSlideGroup(currentStory);

    console.log('[CuentacuentoEditor] Notifying parent of story progress:', {
      status: currentStory.metadata.status,
      hasCharacterImages: currentStory.characters.some(c => c.characterSheetUrl),
      hasSceneImages: currentStory.scenes.some(s => s.selectedImageUrl),
    });

    onStoryProgress(currentStory, slides as unknown as SlideGroup);
  }, [
    story,
    characterSheetOptions,
    selectedCharacterSheets,
    sceneImageOptions,
    selectedSceneImages,
    coverOptions,
    selectedCover,
    endOptions,
    selectedEnd,
    onStoryProgress,
  ]);

  // Función para restaurar desde un draft
  const restoreFromDraft = useCallback((draftData: CuentacuentosDraftFull) => {
    // Restaurar configuración
    setLocation(draftData.config.location);
    setCustomLocation(draftData.config.customLocation);
    setCharacters(draftData.config.characters);
    setStyle(draftData.config.style);
    setIllustrationStyle(draftData.config.illustrationStyle);
    setAdditionalNotes(draftData.config.additionalNotes);

    // Restaurar cuento con imágenes reconstruidas
    if (draftData.story) {
      // Reconstruir URLs de imágenes seleccionadas en el story
      const restoredStory: Story = {
        ...draftData.story,
        // Reconstruir character sheets seleccionados
        characters: draftData.story.characters?.map(c => {
          const options = draftData.characterSheetOptions[c.id];
          const selectedIdx = draftData.selectedCharacterSheets[c.id];
          return {
            ...c,
            characterSheetUrl: options && selectedIdx !== undefined ? options[selectedIdx] : c.characterSheetUrl,
          };
        }),
        // Reconstruir imágenes de escenas seleccionadas
        // Si hay opciones pero no hay selección, usar la primera imagen (índice 0)
        // NOTA: Las keys pueden venir como números o strings desde JSON, intentar ambos
        scenes: draftData.story.scenes?.map(s => {
          const sceneOpts = draftData.sceneImageOptions as Record<string | number, string[]>;
          const options = sceneOpts[s.number] || sceneOpts[String(s.number)];
          const selectedOpts = draftData.selectedSceneImages as Record<string | number, number>;
          const selectedIdx = selectedOpts[s.number] ?? selectedOpts[String(s.number)];
          console.log(`[CuentacuentoEditor] Restoring scene ${s.number}: options=${options?.length || 0}, selectedIdx=${selectedIdx}`);
          return {
            ...s,
            selectedImageUrl: options?.length > 0
              ? options[selectedIdx !== undefined ? selectedIdx : 0]
              : s.selectedImageUrl,
          };
        }),
        // Reconstruir portada y fin (usar primera opción si no hay selección)
        coverImageUrl: draftData.coverOptions?.length > 0
          ? draftData.coverOptions[draftData.selectedCover ?? 0]
          : draftData.story.coverImageUrl,
        endImageUrl: draftData.endOptions?.length > 0
          ? draftData.endOptions[draftData.selectedEnd ?? 0]
          : draftData.story.endImageUrl,
      };
      setStory(restoredStory);

      // Regenerar preview slides con las imágenes restauradas
      const slides = createPreviewSlideGroup(restoredStory);
      setPreviewSlides(slides as unknown as SlideGroup);

      console.log(`[CuentacuentoEditor] Restored story with ${restoredStory.scenes?.filter(s => s.selectedImageUrl).length || 0} scene images`);
    }

    // Restaurar character sheets
    setCharacterSheetOptions(draftData.characterSheetOptions);
    setSelectedCharacterSheets(draftData.selectedCharacterSheets);

    // Restaurar scene images - normalizar keys a números
    const normalizedSceneOpts: Record<number, string[]> = {};
    for (const [key, value] of Object.entries(draftData.sceneImageOptions || {})) {
      normalizedSceneOpts[Number(key)] = value;
    }
    console.log(`[CuentacuentoEditor] Normalized scene options:`, Object.keys(normalizedSceneOpts));
    setSceneImageOptions(normalizedSceneOpts);

    const normalizedSelectedScenes: Record<number, number> = {};
    for (const [key, value] of Object.entries(draftData.selectedSceneImages || {})) {
      normalizedSelectedScenes[Number(key)] = value as number;
    }
    setSelectedSceneImages(normalizedSelectedScenes);

    // Restaurar cover/end
    setCoverOptions(draftData.coverOptions);
    setSelectedCover(draftData.selectedCover);
    setEndOptions(draftData.endOptions);
    setSelectedEnd(draftData.selectedEnd);

    // Restaurar paso actual
    setCurrentStep(draftData.currentStep);
    setShowForm(false);

    console.log(`[CuentacuentoEditor] Restored from draft, step: ${draftData.currentStep}`);
  }, []);

  // Efecto para auto-recuperar imágenes de escenas del draft cuando faltan en initialStory
  // Este efecto corre cuando el draft se carga y detecta que hay imágenes en el draft pero no en el story
  // Usa una ref para evitar ciclos infinitos con story
  const hasAutoRecoveredRef = React.useRef(false);
  useEffect(() => {
    if (!draft || !initialStory || hasAutoRecoveredRef.current) return;

    // Verificar si initialStory tiene escenas sin imágenes
    const scenesWithoutImages = initialStory.scenes?.filter(s => !s.selectedImageUrl).length || 0;
    if (scenesWithoutImages === 0) return; // Todas las escenas tienen imágenes, no hacer nada

    // Verificar si el draft tiene imágenes de escenas
    const draftSceneCount = Object.keys(draft.sceneImageOptions || {}).length;
    if (draftSceneCount === 0) return; // El draft no tiene imágenes, no hacer nada

    // Marcar como ya recuperado para evitar ciclos
    hasAutoRecoveredRef.current = true;

    console.log(`[CuentacuentoEditor] Auto-recovering ${draftSceneCount} scene images from draft (${scenesWithoutImages} missing in initialStory)`);

    // Normalizar y aplicar las imágenes del draft
    const normalizedSceneOpts: Record<number, string[]> = {};
    for (const [key, value] of Object.entries(draft.sceneImageOptions || {})) {
      normalizedSceneOpts[Number(key)] = value;
    }
    setSceneImageOptions(normalizedSceneOpts);

    const normalizedSelectedScenes: Record<number, number> = {};
    for (const [key, value] of Object.entries(draft.selectedSceneImages || {})) {
      normalizedSelectedScenes[Number(key)] = value as number;
    }
    setSelectedSceneImages(normalizedSelectedScenes);

    // También actualizar el story con las URLs de las imágenes recuperadas
    setStory(prevStory => {
      if (!prevStory) return prevStory;
      const updatedScenes = prevStory.scenes.map(scene => {
        const options = normalizedSceneOpts[scene.number];
        const selectedIdx = normalizedSelectedScenes[scene.number] ?? 0;
        const selectedUrl = options && options.length > 0 ? options[selectedIdx] : scene.selectedImageUrl;
        return { ...scene, selectedImageUrl: selectedUrl };
      });

      console.log(`[CuentacuentoEditor] Updated story with ${updatedScenes.filter(s => s.selectedImageUrl).length} scene images from draft`);

      return {
        ...prevStory,
        scenes: updatedScenes,
      };
    });
  }, [draft, initialStory]);

  // Manejar aceptación de recuperación
  const handleAcceptRecovery = useCallback(() => {
    const recoveredDraft = acceptRecovery();
    if (recoveredDraft) {
      restoreFromDraft(recoveredDraft);
    }
  }, [acceptRecovery, restoreFromDraft]);

  // Manejar rechazo de recuperación
  const handleDeclineRecovery = useCallback(() => {
    declineRecovery();
  }, [declineRecovery]);

  const selectedLocation = location === 'custom' ? customLocation : location;

  // Estilos de ilustración con sus prompts (para mostrar en preview)
  const STYLE_PROMPTS: Record<string, string> = {
    'ghibli': 'Studio Ghibli animation style, soft watercolor backgrounds, detailed natural environments, warm lighting, whimsical atmosphere, hand-drawn aesthetic',
    'pixar': 'Pixar 3D animation style, expressive characters, vibrant colors, cinematic lighting, detailed textures, emotional storytelling',
    'disney-classic': 'Classic Disney 2D animation style, golden age aesthetic, fluid lines, warm colors, fairytale atmosphere, hand-painted backgrounds',
    'storybook': "Children's storybook illustration style, soft pastel colors, gentle brushstrokes, cozy atmosphere, whimsical details, picture book aesthetic",
    'watercolor': "Children's watercolor illustration, soft washes, gentle colors, dreamy atmosphere, delicate lines, artistic and tender",
    'eric-carle': 'Eric Carle collage illustration style, bold colors, textured paper cutouts, simple shapes, vibrant and playful',
    'folk-art': 'Latin American folk art style, vibrant colors, decorative patterns, naive art aesthetic, cultural motifs, warm and festive',
    'anime-soft': 'Soft anime illustration style, big expressive eyes, pastel colors, gentle lighting, kawaii aesthetic, heartwarming atmosphere',
  };

  // Detectar qué personajes aparecen en una escena
  const detectCharactersInScene = useCallback((scene: StoryScene, characters: StoryCharacter[]): StoryCharacter[] => {
    const sceneText = `${scene.text} ${scene.visualDescription}`.toLowerCase();
    return characters.filter(character => {
      const charName = character.name.toLowerCase();
      const nameVariations = [
        charName,
        charName.replace(/^el\s+/i, ''),
        charName.replace(/^la\s+/i, ''),
        charName.replace(/^un\s+/i, ''),
        charName.replace(/^una\s+/i, ''),
      ];
      return nameVariations.some(variation => variation.length > 2 && sceneText.includes(variation));
    });
  }, []);

  // Construir el prompt de una escena para preview
  const buildScenePromptPreview = useCallback((scene: StoryScene, excludedCharacterIds: string[] = []): string => {
    if (!story) return '';

    const stylePrompt = STYLE_PROMPTS[story.illustrationStyle] || STYLE_PROMPTS['storybook'];
    const detectedCharacters = detectCharactersInScene(scene, story.characters);
    const includedCharacters = detectedCharacters.filter(c => !excludedCharacterIds.includes(c.id));

    const characterDescriptions = includedCharacters.length > 0
      ? includedCharacters.map(c => `- ${c.name}: ${c.visualDescription || c.description}`).join('\n')
      : 'No hay personajes específicos en esta escena';

    const hasReferences = includedCharacters.some(c => {
      const options = characterSheetOptions[c.id];
      const selectedIdx = selectedCharacterSheets[c.id];
      return options && selectedIdx !== undefined;
    });

    const referenceInstruction = hasReferences
      ? '\n\nIMPORTANT: Se usarán las imágenes de referencia para mantener consistencia visual EXACTA de cada personaje.'
      : '';

    return `${stylePrompt}

Descripción de la escena: ${scene.visualDescription}

Narrativa: "${scene.text}"

Ubicación: ${story.location?.name || 'Chile'}. ${story.location?.description || ''}

Personajes en ESTA escena (solo estos aparecerán):
${characterDescriptions}
${referenceInstruction}

Instrucciones críticas:
- SOLO mostrar los personajes listados
- Escena brillante y bien iluminada
- Imágenes apropiadas para niños 5-10 años
- SIN TEXTO NI PALABRAS en la imagen
- Composición cinematográfica
- Atmósfera cálida y acogedora`;
  }, [story, detectCharactersInScene, characterSheetOptions, selectedCharacterSheets]);

  // Obtener personajes con sus referencias para una escena
  // Incluye tanto los detectados automáticamente como los agregados manualmente
  const getCharactersWithReferences = useCallback((scene: StoryScene, excludedIds: string[] = [], includedIds: string[] = []) => {
    if (!story) return [];

    const detected = detectCharactersInScene(scene, story.characters);
    const detectedIds = detected.map(c => c.id);

    // Agregar personajes incluidos manualmente que no fueron detectados
    const manuallyIncluded = story.characters.filter(c =>
      includedIds.includes(c.id) && !detectedIds.includes(c.id)
    );

    const allCharacters = [...detected, ...manuallyIncluded];

    return allCharacters.map(c => {
      const options = characterSheetOptions[c.id];
      const selectedIdx = selectedCharacterSheets[c.id];
      const referenceImage = options && selectedIdx !== undefined ? options[selectedIdx] : c.characterSheetUrl;
      const isExcluded = excludedIds.includes(c.id);
      const isManuallyAdded = includedIds.includes(c.id) && !detectedIds.includes(c.id);

      return {
        ...c,
        referenceImage: isExcluded ? undefined : referenceImage,
        hasReference: !!referenceImage && !isExcluded,
        isExcluded,
        isManuallyAdded,
      };
    });
  }, [story, detectCharactersInScene, characterSheetOptions, selectedCharacterSheets]);

  // Obtener el request body para generar cuento
  const getRequestBody = useCallback(() => ({
    context: {
      title: context?.title || '',
      summary: context?.summary || '',
      readings: Array.isArray(context?.readings)
        ? context.readings.map(r => ({
            reference: r?.reference || '',
            text: r?.text || '',
          }))
        : [],
    },
    location: selectedLocation || '',
    characters: (characters || '').split(',').map(c => c.trim()).filter(Boolean),
    style: style || 'reflexivo',
    additionalNotes: additionalNotes || '',
  }), [context, selectedLocation, characters, style, additionalNotes]);

  // Ver el prompt antes de generar
  const handlePreviewPrompt = useCallback(async () => {
    if (!selectedLocation) {
      setError('Por favor selecciona o ingresa un lugar');
      return;
    }

    setLoadingPrompt(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-story', {
        body: {
          ...getRequestBody(),
          previewPromptOnly: true,
        },
      });

      if (fnError) throw fnError;

      if (data?.promptPreview) {
        setPromptPreview(data.promptPreview);
        setShowPromptPreview(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el prompt');
    } finally {
      setLoadingPrompt(false);
    }
  }, [getRequestBody, selectedLocation]);

  // Generar cuento con IA
  const handleGenerate = useCallback(async () => {
    if (!selectedLocation) {
      setError('Por favor selecciona o ingresa un lugar');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setShowPromptPreview(false);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-story', {
        body: getRequestBody(),
      });

      if (fnError) throw fnError;

      if (!data?.success) {
        throw new Error(data?.error || 'Error al generar el cuento');
      }

      const hasStructuredData = Array.isArray(data.scenes) && data.scenes.length > 0;

      const newStory: Story = {
        id: `story-${Date.now()}`,
        title: data.title || `Cuento: ${context?.title || 'Sin título'}`,
        summary: data.summary || data.moral || '',
        location: {
          name: selectedLocation || 'Chile',
          type: 'urbano',
          description: selectedLocation || 'Chile',
          visualElements: [],
          colors: [],
          lighting: 'natural',
        },
        illustrationStyle: illustrationStyle,
        characters: hasStructuredData && Array.isArray(data.characters)
          ? data.characters.map((c: { name: string; role: string; description: string; visualDescription?: string }, i: number) => ({
              id: `char-${i}`,
              name: c.name,
              role: c.role === 'protagonist' ? 'protagonist' as const : 'secondary' as const,
              description: c.description,
              visualDescription: c.visualDescription || c.description,
            }))
          : (characters || '').split(',').map(c => c.trim()).filter(Boolean).map((name, i) => ({
              id: `char-${i}`,
              name,
              role: i === 0 ? 'protagonist' as const : 'secondary' as const,
              description: name,
              visualDescription: name,
            })),
        scenes: hasStructuredData
          ? data.scenes.map((scene: { number: number; text: string; visualDescription: string }) => ({
              number: scene.number,
              text: scene.text,
              visualDescription: scene.visualDescription,
            }))
          : (data.content || '').split('\n\n').filter((p: string) => p.trim().length > 0).map((text: string, i: number) => ({
              number: i + 1,
              text: text.trim(),
              visualDescription: text.trim().slice(0, 100),
            })),
        spiritualConnection: data.spiritualConnection || data.moral || '',
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'story-generated' as const,
        },
      };

      setStory(newStory);

      // Generar slides de preview
      const slides = createPreviewSlideGroup(newStory);
      setPreviewSlides(slides as unknown as SlideGroup);
      setShowForm(false);
      setCurrentStep('story');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsGenerating(false);
    }
  }, [context, getRequestBody, selectedLocation, characters, illustrationStyle]);

  // Refinar cuento con feedback
  const handleRefineStory = useCallback(async () => {
    if (!story || !storyFeedback.trim()) {
      setError('Por favor ingresa tu feedback para refinar el cuento');
      return;
    }

    setIsRefining(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('refine-story', {
        body: {
          currentStory: {
            title: story.title,
            summary: story.summary,
            characters: story.characters.map(c => ({
              name: c.name,
              role: c.role,
              description: c.description,
              visualDescription: c.visualDescription,
            })),
            scenes: story.scenes.map(s => ({
              number: s.number,
              text: s.text,
              visualDescription: s.visualDescription,
            })),
            spiritualConnection: story.spiritualConnection,
          },
          feedback: storyFeedback,
          refinementType,
          liturgyContext: {
            title: context?.title,
            summary: context?.summary,
          },
        },
      });

      if (fnError) throw fnError;

      if (!data?.success || !data.story) {
        throw new Error(data?.error || 'Error al refinar el cuento');
      }

      // Actualizar el cuento con la versión refinada
      // Preservar IDs de personajes y escenas para mantener imágenes generadas
      const refinedStory: Story = {
        ...story,
        title: data.story.title,
        summary: data.story.summary,
        spiritualConnection: data.story.spiritualConnection,
        characters: data.story.characters.map((c: any, i: number) => ({
          ...story.characters[i], // Preservar ID y character sheet
          name: c.name,
          role: c.role,
          description: c.description,
          visualDescription: c.visualDescription,
        })),
        scenes: data.story.scenes.map((s: any, i: number) => ({
          ...story.scenes[i], // Preservar ID y selectedImageUrl
          number: s.number,
          text: s.text,
          visualDescription: s.visualDescription,
        })),
        metadata: {
          ...story.metadata,
          status: 'story-generated',
          updatedAt: new Date().toISOString(),
        },
      };

      setStory(refinedStory);
      setStoryFeedback('');
      setShowFeedbackPanel(false);

      // Mostrar mensaje de éxito con las notas de refinamiento
      if (data.refinementNotes) {
        console.log('[CuentacuentoEditor] Cuento refinado:', data.refinementNotes);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al refinar el cuento');
    } finally {
      setIsRefining(false);
    }
  }, [story, storyFeedback, refinementType, context]);

  // Eliminar cuento completamente (historia + imágenes + draft)
  const handleDeleteStory = useCallback(async () => {
    setIsDeleting(true);
    setError(null);

    try {
      console.log('[CuentacuentoEditor] Deleting story and all associated images...');

      // 1. Eliminar imágenes del Storage y el draft
      const success = await deleteStoryImages();

      if (!success) {
        throw new Error('No se pudieron eliminar las imágenes del cuento');
      }

      // 2. Limpiar todo el estado local
      setStory(null);
      setPreviewSlides(null);
      setCharacterSheetOptions({});
      setSelectedCharacterSheets({});
      setSceneImageOptions({});
      setSelectedSceneImages({});
      setCoverOptions([]);
      setSelectedCover(null);
      setEndOptions([]);
      setSelectedEnd(null);
      setCurrentStep('config');
      setShowForm(true);
      setConfirmed(false);
      setLocation('');
      setCustomLocation('');
      setCharacters('');
      setStyle('reflexivo');
      setIllustrationStyle('ghibli');
      setAdditionalNotes('');

      // 3. Notificar al padre para que limpie el elemento de la liturgia
      if (onStoryDeleted) {
        onStoryDeleted();
      }

      console.log('[CuentacuentoEditor] Story deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el cuento');
      console.error('[CuentacuentoEditor] Error deleting story:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }, [deleteStoryImages, onStoryDeleted]);

  // Generar character sheet para un personaje
  const handleGenerateCharacterSheet = useCallback(async (character: StoryCharacter, index: number) => {
    if (!story) return;

    setGeneratingCharacterIndex(index);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-scene-images', {
        body: {
          type: 'character',
          styleId: story.illustrationStyle,
          character: {
            name: character.name,
            description: character.description,
            visualDescription: character.visualDescription,
          },
          count: 4,
        },
      });

      if (fnError) throw fnError;

      if (!data?.success || !data.images?.length) {
        throw new Error(data?.error || 'No se pudieron generar imágenes');
      }

      // Actualizar estado local
      const newCharacterSheetOptions = {
        ...characterSheetOptions,
        [character.id]: data.images,
      };
      setCharacterSheetOptions(newCharacterSheetOptions);

      // Guardar inmediatamente al storage (sin esperar debounce)
      console.log(`[CuentacuentoEditor] Saving character ${character.name} images immediately...`);
      await saveDraftNow({
        currentStep,
        characterSheetOptions: newCharacterSheetOptions,
        selectedCharacterSheets,
      });
      console.log(`[CuentacuentoEditor] Character ${character.name} images saved!`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando character sheet');
    } finally {
      setGeneratingCharacterIndex(null);
    }
  }, [story, characterSheetOptions, selectedCharacterSheets, currentStep, saveDraftNow]);

  // Generar imagen para una escena
  const handleGenerateSceneImage = useCallback(async (scene: StoryScene, customPrompt?: string) => {
    if (!story) return;

    setGeneratingSceneIndex(scene.number);
    setError(null);

    try {
      // Obtener personajes excluidos e incluidos manualmente para esta escena
      const excludedIds = sceneExcludedCharacters[scene.number] || [];
      const includedIds = sceneIncludedCharacters[scene.number] || [];

      // Obtener personajes con referencias usando la misma lógica que el UI
      const charactersWithRefs = getCharactersWithReferences(scene, excludedIds, includedIds);

      // Incluir las imágenes de referencia (character sheets) seleccionadas
      // Solo para personajes no excluidos
      const charactersWithReferences = charactersWithRefs
        .filter(c => !c.isExcluded)
        .map(c => ({
          name: c.name,
          visualDescription: c.visualDescription,
          referenceImage: c.referenceImage,
        }));

      // Usar prompt personalizado si se proporciona
      const sceneData = customPrompt
        ? { text: scene.text, visualDescription: customPrompt }
        : { text: scene.text, visualDescription: scene.visualDescription };

      // Obtener imagen de referencia manual para esta escena (si existe)
      const sceneRefImage = sceneReferenceImages[scene.number];

      // Log para debug
      console.log(`[CuentacuentoEditor] Generating scene ${scene.number}:`, {
        hasSceneRefImage: !!sceneRefImage,
        sceneRefImageLength: sceneRefImage?.length || 0,
        sceneRefImagePrefix: sceneRefImage?.slice(0, 50) || 'none',
        charactersCount: charactersWithReferences.length,
        charactersWithRefs: charactersWithReferences.filter(c => c.referenceImage).map(c => c.name),
      });

      const { data, error: fnError } = await supabase.functions.invoke('generate-scene-images', {
        body: {
          type: 'scene',
          styleId: story.illustrationStyle,
          scene: sceneData,
          characters: charactersWithReferences,
          location: story.location,
          sceneReferenceImage: sceneRefImage, // Imagen de referencia manual
          count: 4,
        },
      });

      // Log de respuesta
      console.log(`[CuentacuentoEditor] Response for scene ${scene.number}:`, {
        success: data?.success,
        imagesCount: data?.images?.length || 0,
        referenceImagesCount: data?.referenceImagesCount,
        error: data?.error,
      });

      if (fnError) throw fnError;

      if (!data?.success || !data.images?.length) {
        throw new Error(data?.error || 'No se pudieron generar imágenes');
      }

      // Log de debug para ver qué personajes se detectaron
      if (data.charactersDetected) {
        console.log(`[CuentacuentoEditor] Escena ${scene.number} - Personajes detectados:`, data.charactersDetected);
      }

      // Actualizar estado local
      const newSceneImageOptions = {
        ...sceneImageOptions,
        [scene.number]: data.images,
      };
      setSceneImageOptions(newSceneImageOptions);

      // Guardar inmediatamente al storage (sin esperar debounce)
      console.log(`[CuentacuentoEditor] Saving scene ${scene.number} images immediately...`);
      await saveDraftNow({
        currentStep,
        sceneImageOptions: newSceneImageOptions,
        selectedSceneImages,
      });
      console.log(`[CuentacuentoEditor] Scene ${scene.number} images saved!`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando imagen de escena');
    } finally {
      setGeneratingSceneIndex(null);
    }
  }, [story, characterSheetOptions, selectedCharacterSheets, sceneExcludedCharacters, sceneIncludedCharacters, sceneReferenceImages, getCharactersWithReferences, sceneImageOptions, selectedSceneImages, currentStep, saveDraftNow]);

  // Construir el prompt de portada para preview
  const buildCoverPromptPreview = useCallback((): string => {
    if (!story) return '';

    const STYLE_PROMPTS: Record<string, string> = {
      'ghibli': 'Studio Ghibli animation style, soft watercolor backgrounds, detailed natural environments, warm lighting, whimsical atmosphere, hand-drawn aesthetic',
      'pixar': 'Pixar 3D animation style, expressive characters, vibrant colors, cinematic lighting, detailed textures, emotional storytelling',
      'disney-classic': 'Classic Disney 2D animation style, golden age aesthetic, fluid lines, warm colors, fairytale atmosphere, hand-painted backgrounds',
      'storybook': "Children's storybook illustration style, soft pastel colors, gentle brushstrokes, cozy atmosphere, whimsical details, picture book aesthetic",
      'watercolor': "Children's watercolor illustration, soft washes, gentle colors, dreamy atmosphere, delicate lines, artistic and tender",
      'eric-carle': 'Eric Carle collage illustration style, bold colors, textured paper cutouts, simple shapes, vibrant and playful',
      'folk-art': 'Latin American folk art style, vibrant colors, decorative patterns, naive art aesthetic, cultural motifs, warm and festive',
      'anime-soft': 'Soft anime illustration style, big expressive eyes, pastel colors, gentle lighting, kawaii aesthetic, heartwarming atmosphere',
    };

    const stylePrompt = STYLE_PROMPTS[story.illustrationStyle] || STYLE_PROMPTS['storybook'];
    const protagonist = story.characters.find(c => c.role === 'protagonist') || story.characters[0];

    // Obtener personajes NO excluidos para la portada
    const includedCharacters = story.characters.filter(c =>
      !coverExcludedCharacters.includes(c.id)
    );

    const characterDescriptions = includedCharacters.length > 0
      ? includedCharacters.map(c => `- ${c.name}: ${c.visualDescription || c.description}`).join('\n')
      : 'No hay personajes específicos';

    return `${stylePrompt}

PORTADA DEL CUENTO: "${story.title}"

Ubicación: ${story.location?.name || 'Chile'}. ${story.location?.description || ''}

Personajes principales:
${characterDescriptions}

${editingCoverPrompt || `Escena de portada que capture la esencia del cuento, mostrando al protagonista ${protagonist?.name || 'principal'} en un momento característico de la historia.`}

Instrucciones críticas:
- Composición atractiva para portada de libro infantil
- **INCLUIR EL TÍTULO "${story.title}" en la parte superior de la imagen** en una fuente amigable y legible para niños
- El título debe verse como una portada real de libro infantil
- Escena brillante y bien iluminada
- Imágenes apropiadas para niños 5-10 años
- Atmósfera cálida y acogedora`;
  }, [story, coverExcludedCharacters, editingCoverPrompt]);

  // Generar portada
  const handleGenerateCover = useCallback(async (customPrompt?: string) => {
    if (!story) return;

    setGeneratingCover(true);
    setError(null);

    try {
      // Usar EXACTAMENTE la misma lógica que handleGenerateSceneImage
      const excludedIds = coverExcludedCharacters;

      // Construir personajes con referencias igual que en escenas
      const charactersWithReferences = story.characters
        .filter(c => !excludedIds.includes(c.id))
        .map(c => {
          const options = characterSheetOptions[c.id];
          const selectedIdx = selectedCharacterSheets[c.id];
          const referenceImage = options && selectedIdx !== undefined ? options[selectedIdx] : c.characterSheetUrl;
          return {
            name: c.name,
            visualDescription: c.visualDescription,
            referenceImage,
          };
        });

      const protagonist = story.characters.find(c => c.role === 'protagonist') || story.characters[0];

      // Log para debug (igual que en escenas)
      console.log(`[CuentacuentoEditor] Generating cover:`, {
        hasCoverRefImage: !!coverReferenceImage,
        coverRefImageLength: coverReferenceImage?.length || 0,
        coverRefImagePrefix: coverReferenceImage?.slice(0, 50) || 'none',
        charactersCount: charactersWithReferences.length,
        charactersWithRefs: charactersWithReferences.filter(c => c.referenceImage).map(c => c.name),
      });

      // Enviar EXACTAMENTE igual que escenas: characters + sceneReferenceImage
      const { data, error: fnError } = await supabase.functions.invoke('generate-scene-images', {
        body: {
          type: 'cover',
          styleId: story.illustrationStyle,
          title: story.title,
          protagonist: {
            visualDescription: protagonist?.visualDescription || 'A friendly child character',
          },
          location: story.location,
          // IGUAL QUE ESCENAS: usar "characters" en lugar de "characterReferences"
          characters: charactersWithReferences,
          // IGUAL QUE ESCENAS: usar "sceneReferenceImage" en lugar de "referenceImage"
          sceneReferenceImage: coverReferenceImage,
          customPrompt: customPrompt || editingCoverPrompt || undefined,
          count: 4,
        },
      });

      // Log de respuesta (igual que en escenas)
      console.log(`[CuentacuentoEditor] Response for cover:`, {
        success: data?.success,
        imagesCount: data?.images?.length || 0,
        referenceImagesCount: data?.referenceImagesCount,
        error: data?.error,
      });

      if (fnError) throw fnError;

      if (!data?.success || !data.images?.length) {
        throw new Error(data?.error || 'No se pudieron generar imágenes de portada');
      }

      setCoverOptions(data.images);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando portada');
    } finally {
      setGeneratingCover(false);
    }
  }, [story, characterSheetOptions, selectedCharacterSheets, coverExcludedCharacters, coverReferenceImage, editingCoverPrompt]);

  // Construir el prompt de fin para preview
  const buildEndPromptPreview = useCallback((): string => {
    if (!story) return '';

    const STYLE_PROMPTS: Record<string, string> = {
      'ghibli': 'Studio Ghibli animation style, soft watercolor backgrounds, detailed natural environments, warm lighting, whimsical atmosphere, hand-drawn aesthetic',
      'pixar': 'Pixar 3D animation style, expressive characters, vibrant colors, cinematic lighting, detailed textures, emotional storytelling',
      'disney-classic': 'Classic Disney 2D animation style, golden age aesthetic, fluid lines, warm colors, fairytale atmosphere, hand-painted backgrounds',
      'storybook': "Children's storybook illustration style, soft pastel colors, gentle brushstrokes, cozy atmosphere, whimsical details, picture book aesthetic",
      'watercolor': "Children's watercolor illustration, soft washes, gentle colors, dreamy atmosphere, delicate lines, artistic and tender",
      'eric-carle': 'Eric Carle collage illustration style, bold colors, textured paper cutouts, simple shapes, vibrant and playful',
      'folk-art': 'Latin American folk art style, vibrant colors, decorative patterns, naive art aesthetic, cultural motifs, warm and festive',
      'anime-soft': 'Soft anime illustration style, big expressive eyes, pastel colors, gentle lighting, kawaii aesthetic, heartwarming atmosphere',
    };

    const stylePrompt = STYLE_PROMPTS[story.illustrationStyle] || STYLE_PROMPTS['storybook'];

    return `${stylePrompt}

IMAGEN FINAL "FIN" PARA CUENTO INFANTIL

${editingEndPrompt || `Una imagen acogedora y conclusiva que transmita el final feliz del cuento. Puede mostrar elementos decorativos como estrellas, corazones, o un paisaje sereno que invite a la reflexión.`}

Instrucciones críticas:
- Composición atractiva para página final de libro infantil
- Escena brillante y bien iluminada
- Atmósfera de cierre y satisfacción
- Imágenes apropiadas para niños 5-10 años
- SIN TEXTO NI PALABRAS en la imagen
- Puede ser abstracta o con elementos del cuento`;
  }, [story, editingEndPrompt]);

  // Generar imagen final
  const handleGenerateEnd = useCallback(async (customPrompt?: string) => {
    if (!story) return;

    setGeneratingEnd(true);
    setError(null);

    try {
      const requestBody = {
        type: 'end',
        styleId: story.illustrationStyle,
        // Imagen de referencia manual (si existe)
        referenceImage: endReferenceImage || undefined,
        // Prompt personalizado
        customPrompt: customPrompt || editingEndPrompt || undefined,
        count: 4,
      };

      console.log('[CuentacuentoEditor] End image generation request:', {
        ...requestBody,
        referenceImage: requestBody.referenceImage ? `${requestBody.referenceImage.slice(0, 50)}...` : undefined,
      });

      const { data, error: fnError } = await supabase.functions.invoke('generate-scene-images', {
        body: requestBody,
      });

      if (fnError) throw fnError;

      if (!data?.success || !data.images?.length) {
        throw new Error(data?.error || 'No se pudieron generar imágenes de fin');
      }

      setEndOptions(data.images);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando imagen final');
    } finally {
      setGeneratingEnd(false);
    }
  }, [story, endReferenceImage, editingEndPrompt]);

  // Subir imagen de personaje manualmente
  const handleUploadCharacterImage = useCallback((characterId: string, base64: string) => {
    setCharacterSheetOptions(prev => {
      const existing = prev[characterId] || [];
      const newOptions = [...existing, base64];
      // Auto-seleccionar la imagen subida (última en el array)
      setSelectedCharacterSheets(prevSelected => ({
        ...prevSelected,
        [characterId]: newOptions.length - 1
      }));
      return { ...prev, [characterId]: newOptions };
    });
  }, []);

  // Subir imagen de escena manualmente
  const handleUploadSceneImage = useCallback((sceneNumber: number, base64: string) => {
    setSceneImageOptions(prev => {
      const existing = prev[sceneNumber] || [];
      const newOptions = [...existing, base64];
      // Auto-seleccionar la imagen subida
      setSelectedSceneImages(prevSelected => ({
        ...prevSelected,
        [sceneNumber]: newOptions.length - 1
      }));
      return { ...prev, [sceneNumber]: newOptions };
    });
  }, []);

  // Subir portada manualmente
  const handleUploadCover = useCallback((base64: string) => {
    setCoverOptions(prev => {
      const newOptions = [...prev, base64];
      // Auto-seleccionar la imagen subida
      setSelectedCover(newOptions.length - 1);
      return newOptions;
    });
  }, []);

  // Subir imagen final manualmente
  const handleUploadEnd = useCallback((base64: string) => {
    setEndOptions(prev => {
      const newOptions = [...prev, base64];
      // Auto-seleccionar la imagen subida
      setSelectedEnd(newOptions.length - 1);
      return newOptions;
    });
  }, []);

  // Guardar imagen de personaje seleccionada a Supabase
  const handleSaveCharacterImage = useCallback(async (characterId: string) => {
    const selectedIdx = selectedCharacterSheets[characterId];
    const options = characterSheetOptions[characterId];
    if (selectedIdx === undefined || !options || !options[selectedIdx]) return;

    setSavingCharacter(characterId);
    setSavedCharacterMessage(prev => ({ ...prev, [characterId]: null }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const selectedImage = options[selectedIdx];

      // Si ya es una URL (no base64), ya está guardada - pero igual reducir a solo esta imagen
      if (selectedImage.startsWith('http')) {
        // Mantener SOLO esta imagen, eliminar las demás
        setCharacterSheetOptions(prev => ({
          ...prev,
          [characterId]: [selectedImage]
        }));
        setSelectedCharacterSheets(prev => ({
          ...prev,
          [characterId]: 0
        }));
        setSavedCharacterMessage(prev => ({ ...prev, [characterId]: 'Imagen ya guardada' }));
        setTimeout(() => setSavedCharacterMessage(prev => ({ ...prev, [characterId]: null })), 3000);
        return;
      }

      // Subir solo la imagen seleccionada
      const mimeType = selectedImage.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
      const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
      const byteCharacters = atob(selectedImage);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      const path = `${user.id}/${context.id}/characters/${characterId}_selected.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('cuentacuentos-drafts')
        .upload(path, blob, { contentType: mimeType, upsert: true });

      if (uploadError) throw uploadError;

      // Obtener URL pública (el bucket es público, no expira)
      const { data: urlData } = supabase.storage
        .from('cuentacuentos-drafts')
        .getPublicUrl(path);

      if (urlData?.publicUrl) {
        // Mantener SOLO la imagen guardada, eliminar las demás opciones
        setCharacterSheetOptions(prev => ({
          ...prev,
          [characterId]: [urlData.publicUrl]
        }));
        // Actualizar el índice de selección a 0 ya que ahora solo hay una imagen
        setSelectedCharacterSheets(prev => ({
          ...prev,
          [characterId]: 0
        }));
      }

      setSavedCharacterMessage(prev => ({ ...prev, [characterId]: 'Imagen guardada exitosamente' }));
      setTimeout(() => setSavedCharacterMessage(prev => ({ ...prev, [characterId]: null })), 3000);
    } catch (err) {
      console.error('Error saving character image:', err);
      setSavedCharacterMessage(prev => ({ ...prev, [characterId]: 'Error al guardar' }));
    } finally {
      setSavingCharacter(null);
    }
  }, [characterSheetOptions, selectedCharacterSheets, context.id]);

  // Guardar imagen de escena seleccionada a Supabase
  const handleSaveSceneImage = useCallback(async (sceneNumber: number) => {
    const selectedIdx = selectedSceneImages[sceneNumber];
    const options = sceneImageOptions[sceneNumber];
    if (selectedIdx === undefined || !options || !options[selectedIdx]) return;

    setSavingScene(sceneNumber);
    setSavedSceneMessage(prev => ({ ...prev, [sceneNumber]: null }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const selectedImage = options[selectedIdx];

      // Si ya es URL, mantener solo esta imagen
      if (selectedImage.startsWith('http')) {
        setSceneImageOptions(prev => ({
          ...prev,
          [sceneNumber]: [selectedImage]
        }));
        setSelectedSceneImages(prev => ({
          ...prev,
          [sceneNumber]: 0
        }));
        setSavedSceneMessage(prev => ({ ...prev, [sceneNumber]: 'Imagen ya guardada' }));
        setTimeout(() => setSavedSceneMessage(prev => ({ ...prev, [sceneNumber]: null })), 3000);
        return;
      }

      const mimeType = selectedImage.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
      const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
      const byteCharacters = atob(selectedImage);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      const path = `${user.id}/${context.id}/scenes/scene${sceneNumber}_selected.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('cuentacuentos-drafts')
        .upload(path, blob, { contentType: mimeType, upsert: true });

      if (uploadError) throw uploadError;

      // Obtener URL pública (el bucket es público, no expira)
      const { data: urlData } = supabase.storage
        .from('cuentacuentos-drafts')
        .getPublicUrl(path);

      if (urlData?.publicUrl) {
        // Mantener SOLO la imagen guardada, eliminar las demás opciones
        setSceneImageOptions(prev => ({
          ...prev,
          [sceneNumber]: [urlData.publicUrl]
        }));
        // Actualizar el índice de selección a 0 ya que ahora solo hay una imagen
        setSelectedSceneImages(prev => ({
          ...prev,
          [sceneNumber]: 0
        }));
      }

      setSavedSceneMessage(prev => ({ ...prev, [sceneNumber]: 'Imagen guardada exitosamente' }));
      setTimeout(() => setSavedSceneMessage(prev => ({ ...prev, [sceneNumber]: null })), 3000);
    } catch (err) {
      console.error('Error saving scene image:', err);
      setSavedSceneMessage(prev => ({ ...prev, [sceneNumber]: 'Error al guardar' }));
    } finally {
      setSavingScene(null);
    }
  }, [sceneImageOptions, selectedSceneImages, context.id]);

  // Guardar portada seleccionada a Supabase
  const handleSaveCover = useCallback(async () => {
    if (selectedCover === null || !coverOptions[selectedCover]) return;

    setSavingCover(true);
    setSavedCoverMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const selectedImage = coverOptions[selectedCover];

      // Si ya es URL, mantener solo esta imagen
      if (selectedImage.startsWith('http')) {
        setCoverOptions([selectedImage]);
        setSelectedCover(0);
        setSavedCoverMessage('Portada ya guardada');
        setTimeout(() => setSavedCoverMessage(null), 3000);
        return;
      }

      const mimeType = selectedImage.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
      const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
      const byteCharacters = atob(selectedImage);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      const path = `${user.id}/${context.id}/cover/cover_selected.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('cuentacuentos-drafts')
        .upload(path, blob, { contentType: mimeType, upsert: true });

      if (uploadError) throw uploadError;

      // Obtener URL pública (el bucket es público, no expira)
      const { data: urlData } = supabase.storage
        .from('cuentacuentos-drafts')
        .getPublicUrl(path);

      if (urlData?.publicUrl) {
        // Mantener SOLO la imagen guardada, eliminar las demás opciones
        setCoverOptions([urlData.publicUrl]);
        setSelectedCover(0);
      }

      setSavedCoverMessage('Portada guardada exitosamente');
      setTimeout(() => setSavedCoverMessage(null), 3000);
    } catch (err) {
      console.error('Error saving cover:', err);
      setSavedCoverMessage('Error al guardar');
    } finally {
      setSavingCover(false);
    }
  }, [coverOptions, selectedCover, context.id]);

  // Guardar imagen final seleccionada a Supabase
  const handleSaveEnd = useCallback(async () => {
    if (selectedEnd === null || !endOptions[selectedEnd]) return;

    setSavingEnd(true);
    setSavedEndMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const selectedImage = endOptions[selectedEnd];

      // Si ya es URL, mantener solo esta imagen
      if (selectedImage.startsWith('http')) {
        setEndOptions([selectedImage]);
        setSelectedEnd(0);
        setSavedEndMessage('Imagen ya guardada');
        setTimeout(() => setSavedEndMessage(null), 3000);
        return;
      }

      const mimeType = selectedImage.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
      const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
      const byteCharacters = atob(selectedImage);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      const path = `${user.id}/${context.id}/end/end_selected.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('cuentacuentos-drafts')
        .upload(path, blob, { contentType: mimeType, upsert: true });

      if (uploadError) throw uploadError;

      // Obtener URL pública (el bucket es público, no expira)
      const { data: urlData } = supabase.storage
        .from('cuentacuentos-drafts')
        .getPublicUrl(path);

      if (urlData?.publicUrl) {
        // Mantener SOLO la imagen guardada, eliminar las demás opciones
        setEndOptions([urlData.publicUrl]);
        setSelectedEnd(0);
      }

      setSavedEndMessage('Imagen guardada exitosamente');
      setTimeout(() => setSavedEndMessage(null), 3000);
    } catch (err) {
      console.error('Error saving end image:', err);
      setSavedEndMessage('Error al guardar');
    } finally {
      setSavingEnd(false);
    }
  }, [endOptions, selectedEnd, context.id]);

  // Aprobar cuento y avanzar a personajes
  const handleApproveStory = useCallback(() => {
    if (!story) return;

    setStory({
      ...story,
      metadata: {
        ...story.metadata,
        status: 'characters-pending',
        updatedAt: new Date().toISOString(),
      },
    });
    setCurrentStep('characters');
  }, [story]);

  // Aprobar personajes y avanzar a escenas
  const handleApproveCharacters = useCallback(() => {
    if (!story) return;

    // Actualizar story con character sheets seleccionados
    const updatedCharacters = story.characters.map(char => {
      const options = characterSheetOptions[char.id];
      const selectedIdx = selectedCharacterSheets[char.id];
      return {
        ...char,
        characterSheetOptions: options,
        characterSheetUrl: options && selectedIdx !== undefined ? options[selectedIdx] : undefined,
      };
    });

    setStory({
      ...story,
      characters: updatedCharacters,
      metadata: {
        ...story.metadata,
        status: 'characters-approved',
        updatedAt: new Date().toISOString(),
      },
    });
    setCurrentStep('scenes');
  }, [story, characterSheetOptions, selectedCharacterSheets]);

  // Aprobar escenas y avanzar a portada
  const handleApproveScenes = useCallback(() => {
    if (!story) return;

    // Actualizar story con imágenes de escenas seleccionadas
    const updatedScenes = story.scenes.map(scene => {
      const options = sceneImageOptions[scene.number];
      const selectedIdx = selectedSceneImages[scene.number];
      return {
        ...scene,
        imageOptions: options,
        selectedImageUrl: options && selectedIdx !== undefined ? options[selectedIdx] : undefined,
      };
    });

    setStory({
      ...story,
      scenes: updatedScenes,
      metadata: {
        ...story.metadata,
        status: 'scenes-pending',
        updatedAt: new Date().toISOString(),
      },
    });
    setCurrentStep('cover');
  }, [story, sceneImageOptions, selectedSceneImages]);

  // Finalizar cuento
  // NOTE: Images are kept as base64 here. Upload to storage happens in saveLiturgy
  // when the user clicks "Guardar Liturgia". This follows the Portadas pattern.
  const handleFinalize = useCallback(() => {
    if (!story) return;

    // Build final scenes with selected images (may be base64 or URL)
    const finalScenes = story.scenes.map(scene => {
      const options = sceneImageOptions[scene.number];
      const selectedIdx = selectedSceneImages[scene.number];
      const selectedImage = options && selectedIdx !== undefined ? options[selectedIdx] : scene.selectedImageUrl;
      return {
        ...scene,
        imageOptions: options,
        selectedImageUrl: selectedImage,
      };
    });

    // Get selected cover and end images (may be base64 or URL)
    const finalCoverImage = selectedCover !== null ? coverOptions[selectedCover] : undefined;
    const finalEndImage = selectedEnd !== null ? endOptions[selectedEnd] : undefined;

    // Debug log scene images
    console.log('[CuentacuentoEditor] Finalizing story with scenes:', finalScenes.map(s => ({
      number: s.number,
      hasImage: !!s.selectedImageUrl,
      isBase64: s.selectedImageUrl && !s.selectedImageUrl.startsWith('http'),
    })));

    // Build final story with character sheets included
    const finalCharacters = story.characters.map(char => {
      const charOptions = characterSheetOptions[char.id];
      const selectedIdx = selectedCharacterSheets[char.id];
      const selectedSheet = charOptions && selectedIdx !== undefined ? charOptions[selectedIdx] : char.characterSheetUrl;
      return {
        ...char,
        characterSheetOptions: charOptions,
        characterSheetUrl: selectedSheet,
      };
    });

    const finalStory: Story = {
      ...story,
      characters: finalCharacters,
      scenes: finalScenes,
      coverImageOptions: coverOptions,
      coverImageUrl: finalCoverImage,
      endImageOptions: endOptions,
      endImageUrl: finalEndImage,
      metadata: {
        ...story.metadata,
        status: 'ready',
        updatedAt: new Date().toISOString(),
      },
    };

    setStory(finalStory);

    // Generate final slides
    const slides = createPreviewSlideGroup(finalStory);
    setPreviewSlides(slides as unknown as SlideGroup);

    // Pass story to parent - images will be uploaded when user clicks "Guardar Liturgia"
    onStoryCreated(finalStory, slides as unknown as SlideGroup);
    setConfirmed(true);
    setCurrentStep('complete');

    // Delete the draft since story is finalized
    deleteDraft();
    console.log('[CuentacuentoEditor] Story finalized. Images will be uploaded when liturgy is saved.');
  }, [story, characterSheetOptions, selectedCharacterSheets, sceneImageOptions, selectedSceneImages, coverOptions, selectedCover, endOptions, selectedEnd, onStoryCreated, deleteDraft]);

  // Regenerar todo
  const handleRegenerate = useCallback(() => {
    setStory(null);
    setPreviewSlides(null);
    setShowForm(true);
    setConfirmed(false);
    setCurrentStep('config');
    setCharacterSheetOptions({});
    setSelectedCharacterSheets({});
    setSceneImageOptions({});
    setSelectedSceneImages({});
    setCoverOptions([]);
    setSelectedCover(null);
    setEndOptions([]);
    setSelectedEnd(null);
  }, []);

  // Editar cuento existente (sin borrar)
  const handleEditStory = useCallback(() => {
    setConfirmed(false);
    setCurrentStep('scenes'); // Ir a escenas para poder editar imágenes
  }, []);

  // Renderizar paso actual
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'config':
        return renderConfigStep();
      case 'story':
        return renderStoryStep();
      case 'characters':
        return renderCharactersStep();
      case 'scenes':
        return renderScenesStep();
      case 'cover':
        return renderCoverStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return null;
    }
  };

  // Paso 1: Configuración
  const renderConfigStep = () => (
    <div className="space-y-4">
      {/* Lugar */}
      <div>
        <label
          className="block mb-2"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            fontWeight: 500,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          <MapPin size={14} className="inline mr-1" />
          Lugar de la historia
        </label>
        <div className="grid grid-cols-3 gap-2">
          {LOCATION_PRESETS.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => setLocation(loc.id)}
              className={`p-3 rounded-lg text-left transition-all ${
                location === loc.id ? 'ring-2 ring-offset-1' : ''
              }`}
              style={{
                backgroundColor:
                  location === loc.id
                    ? `${CASA_BRAND.colors.amber.light}20`
                    : CASA_BRAND.colors.secondary.grayLight + '30',
                borderWidth: 1,
                borderColor:
                  location === loc.id
                    ? CASA_BRAND.colors.primary.amber
                    : 'transparent',
                ringColor: CASA_BRAND.colors.primary.amber,
              }}
            >
              <span
                className="block"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '13px',
                  fontWeight: 500,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                {loc.name}
              </span>
              <span
                className="text-xs"
                style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
              >
                {loc.description}
              </span>
            </button>
          ))}
        </div>

        {location === 'custom' && (
          <input
            type="text"
            value={customLocation}
            onChange={(e) => setCustomLocation(e.target.value)}
            placeholder="Escribe el lugar..."
            className="mt-2 w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              borderColor: CASA_BRAND.colors.secondary.grayLight,
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
            }}
          />
        )}
      </div>

      {/* Personajes */}
      <div>
        <label
          className="block mb-2"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            fontWeight: 500,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          <Users size={14} className="inline mr-1" />
          Personajes (opcional)
        </label>
        <input
          type="text"
          value={characters}
          onChange={(e) => setCharacters(e.target.value)}
          placeholder="Ej: María, un perrito llamado Toby, el abuelo"
          className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
          style={{
            borderColor: CASA_BRAND.colors.secondary.grayLight,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
          }}
        />
        <p className="text-xs mt-1" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
          Separa los personajes con comas
        </p>
      </div>

      {/* Estilo narrativo */}
      <div>
        <label
          className="block mb-2"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            fontWeight: 500,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          <Palette size={14} className="inline mr-1" />
          Estilo narrativo
        </label>
        <div className="flex gap-2 flex-wrap">
          {STORY_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.id)}
              className={`px-3 py-2 rounded-full transition-colors ${style === s.id ? 'ring-1' : ''}`}
              style={{
                backgroundColor: style === s.id ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayLight,
                color: style === s.id ? CASA_BRAND.colors.primary.white : CASA_BRAND.colors.secondary.grayMedium,
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '13px',
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Estilo de ilustración */}
      <div>
        <label
          className="block mb-2"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            fontWeight: 500,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          <ImageIcon size={14} className="inline mr-1" />
          Estilo de ilustración
        </label>
        <div className="grid grid-cols-4 gap-2">
          {ILLUSTRATION_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIllustrationStyle(s.id)}
              className={`p-2 rounded-lg text-left transition-all ${
                illustrationStyle === s.id ? 'ring-2 ring-offset-1' : ''
              }`}
              style={{
                backgroundColor: illustrationStyle === s.id
                  ? `${CASA_BRAND.colors.amber.light}20`
                  : CASA_BRAND.colors.secondary.grayLight + '30',
                borderWidth: 1,
                borderColor: illustrationStyle === s.id ? CASA_BRAND.colors.primary.amber : 'transparent',
              }}
            >
              <span className="block text-xs font-medium" style={{ color: CASA_BRAND.colors.primary.black }}>
                {s.name}
              </span>
              <span className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                {s.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Notas adicionales */}
      <div>
        <label
          className="block mb-2"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            fontWeight: 500,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          Notas adicionales (opcional)
        </label>
        <textarea
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          placeholder="Instrucciones especiales para el cuento..."
          rows={2}
          className="w-full px-3 py-2 rounded-lg border resize-none focus:outline-none focus:ring-2"
          style={{
            borderColor: CASA_BRAND.colors.secondary.grayLight,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-3 rounded-lg flex items-center gap-2"
          style={{ backgroundColor: '#FEE2E2', color: '#DC2626', fontFamily: CASA_BRAND.fonts.body, fontSize: '13px' }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Vista previa del prompt */}
      {showPromptPreview && promptPreview && (
        <div
          className="p-4 rounded-lg border space-y-3"
          style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight + '30', borderColor: CASA_BRAND.colors.secondary.grayLight }}
        >
          <div className="flex items-center justify-between">
            <h4 style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '14px', fontWeight: 600, color: CASA_BRAND.colors.primary.black }}>
              <FileText size={14} className="inline mr-2" />
              Prompt que se enviará a Claude Opus 4.5
            </h4>
            <button type="button" onClick={() => setShowPromptPreview(false)} className="text-sm hover:underline" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              <EyeOff size={14} className="inline mr-1" />
              Ocultar
            </button>
          </div>
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
              System Prompt
            </summary>
            <pre className="mt-2 p-3 rounded text-xs overflow-auto max-h-48" style={{ backgroundColor: CASA_BRAND.colors.primary.white, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: CASA_BRAND.colors.secondary.grayDark }}>
              {promptPreview.systemPrompt}
            </pre>
          </details>
          <details open className="group">
            <summary className="cursor-pointer text-xs font-medium" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
              User Prompt
            </summary>
            <pre className="mt-2 p-3 rounded text-xs overflow-auto max-h-64" style={{ backgroundColor: CASA_BRAND.colors.primary.white, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: CASA_BRAND.colors.secondary.grayDark }}>
              {promptPreview.userPrompt}
            </pre>
          </details>
        </div>
      )}

      {/* Botones */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePreviewPrompt}
          disabled={loadingPrompt || isGenerating || (!selectedLocation && location !== 'custom')}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border"
          style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight, color: CASA_BRAND.colors.secondary.grayDark, fontFamily: CASA_BRAND.fonts.body, fontSize: '14px' }}
        >
          {loadingPrompt ? <Loader2 size={18} className="animate-spin" /> : <><Eye size={18} /> Ver Prompt</>}
        </button>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || (!selectedLocation && location !== 'custom')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: CASA_BRAND.colors.primary.white, fontFamily: CASA_BRAND.fonts.body, fontSize: '14px', fontWeight: 500 }}
        >
          {isGenerating ? <><Loader2 size={18} className="animate-spin" /> Generando cuento...</> : <><Sparkles size={18} /> Generar cuento con IA</>}
        </button>
      </div>
    </div>
  );

  // Paso 2: Revisar cuento
  const renderStoryStep = () => {
    if (!story) return null;

    return (
      <div className="space-y-4">
        {/* Info del cuento */}
        <div className="p-4 rounded-lg border" style={{ backgroundColor: `${CASA_BRAND.colors.amber.light}10`, borderColor: CASA_BRAND.colors.amber.light }}>
          <div className="flex items-start gap-3">
            <BookOpen size={24} style={{ color: CASA_BRAND.colors.primary.amber }} />
            <div className="flex-1">
              <h4 style={{ fontFamily: CASA_BRAND.fonts.heading, fontSize: '16px', color: CASA_BRAND.colors.primary.black, marginBottom: '4px' }}>
                {story.title}
              </h4>
              <p className="text-sm" style={{ fontFamily: CASA_BRAND.fonts.body, color: CASA_BRAND.colors.secondary.grayMedium }}>
                {story.location?.name || 'Chile'} • {story.scenes.length} escenas • {story.characters.length} personajes
              </p>
              {story.spiritualConnection && (
                <p className="mt-2 text-sm italic" style={{ fontFamily: CASA_BRAND.fonts.body, color: CASA_BRAND.colors.secondary.grayDark }}>
                  Conexión espiritual: {story.spiritualConnection}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Personajes */}
        <div className="p-4 rounded-lg border" style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight }}>
          <h5 className="flex items-center gap-2 mb-3" style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '13px', fontWeight: 600, color: CASA_BRAND.colors.primary.black }}>
            <Users size={14} />
            Personajes ({story.characters.length})
          </h5>
          <div className="grid grid-cols-2 gap-3">
            {story.characters.map((character) => (
              <div
                key={character.id}
                className="p-3 rounded-lg"
                style={{
                  backgroundColor: character.role === 'protagonist' ? `${CASA_BRAND.colors.amber.light}15` : CASA_BRAND.colors.secondary.grayLight + '30',
                  borderLeft: `3px solid ${character.role === 'protagonist' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayMedium}`,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium" style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '13px', color: CASA_BRAND.colors.primary.black }}>
                    {character.name}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: character.role === 'protagonist' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayLight,
                      color: character.role === 'protagonist' ? CASA_BRAND.colors.primary.white : CASA_BRAND.colors.secondary.grayDark,
                    }}
                  >
                    {character.role === 'protagonist' ? 'Protagonista' : 'Secundario'}
                  </span>
                </div>
                <p className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                  {character.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Escenas (colapsable) */}
        <div>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 mb-3"
            style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '13px', fontWeight: 500, color: CASA_BRAND.colors.primary.black }}
          >
            <Eye size={14} />
            {showPreview ? 'Ocultar escenas' : `Ver ${story.scenes.length} escenas`}
            {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showPreview && (
            <div className="space-y-4 max-h-96 overflow-y-auto p-4 rounded-lg border" style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight }}>
              {story.scenes.map((scene, index) => (
                <div key={index} className="pb-4 border-b last:border-0 last:pb-0" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium" style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: CASA_BRAND.colors.primary.white }}>
                      {scene.number}
                    </span>
                    <span className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                      Escena {scene.number}
                    </span>
                  </div>
                  <p className="mb-2" style={{ fontFamily: CASA_BRAND.fonts.body, fontSize: '14px', lineHeight: 1.7, color: CASA_BRAND.colors.primary.black }}>
                    {scene.text}
                  </p>
                  {scene.visualDescription && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs flex items-center gap-1" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                        <ImageIcon size={12} />
                        Descripción visual
                      </summary>
                      <p className="mt-1 text-xs p-2 rounded" style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight + '30', color: CASA_BRAND.colors.secondary.grayDark, fontStyle: 'italic' }}>
                        {scene.visualDescription}
                      </p>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Panel de Feedback para Refinar */}
        <div className="mt-6 border rounded-lg p-4" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight, backgroundColor: CASA_BRAND.colors.secondary.grayLightest }}>
          <button
            type="button"
            onClick={() => setShowFeedbackPanel(!showFeedbackPanel)}
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: CASA_BRAND.colors.primary.amber }}
          >
            <MessageSquare size={16} />
            {showFeedbackPanel ? 'Ocultar panel de feedback' : '¿Quieres mejorar algo del cuento?'}
          </button>

          {showFeedbackPanel && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: CASA_BRAND.colors.primary.black }}>
                  Tipo de mejora
                </label>
                <select
                  value={refinementType}
                  onChange={(e) => setRefinementType(e.target.value as typeof refinementType)}
                  className="w-full p-2 border rounded-lg text-sm"
                  style={{ borderColor: CASA_BRAND.colors.secondary.grayMedium }}
                >
                  <option value="general">General - Mejoras libres</option>
                  <option value="characters">Personajes - Mejorar descripciones y profundidad</option>
                  <option value="plot">Trama - Fortalecer conflicto y resolución</option>
                  <option value="scenes">Escenas - Mejorar descripciones visuales</option>
                  <option value="spiritual">Espiritual - Mejorar conexión con el Evangelio</option>
                  <option value="length">Duración - Ajustar largo del cuento</option>
                  <option value="tone">Tono - Cambiar el estilo emocional</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: CASA_BRAND.colors.primary.black }}>
                  Tu feedback
                </label>
                <textarea
                  value={storyFeedback}
                  onChange={(e) => setStoryFeedback(e.target.value)}
                  placeholder="Describe qué te gustaría mejorar. Por ejemplo: 'Hazlo más divertido', 'El personaje principal necesita más personalidad', 'La moraleja es muy obvia', etc."
                  className="w-full p-3 border rounded-lg text-sm min-h-[100px]"
                  style={{ borderColor: CASA_BRAND.colors.secondary.grayMedium }}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowFeedbackPanel(false);
                    setStoryFeedback('');
                  }}
                  className="px-4 py-2 text-sm rounded-lg"
                  style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleRefineStory}
                  disabled={isRefining || !storyFeedback.trim()}
                  className="px-4 py-2 text-sm rounded-lg flex items-center gap-2"
                  style={{
                    backgroundColor: isRefining || !storyFeedback.trim()
                      ? CASA_BRAND.colors.secondary.grayMedium
                      : CASA_BRAND.colors.primary.amber,
                    color: CASA_BRAND.colors.primary.white,
                  }}
                >
                  {isRefining ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Refinando...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Refinar Cuento
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRegenerate}
            className="flex items-center gap-2 px-4 py-3 rounded-lg transition-colors border"
            style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight, color: CASA_BRAND.colors.secondary.grayDark }}
          >
            <RefreshCw size={18} />
            Regenerar
          </button>
          <button
            type="button"
            onClick={handleApproveStory}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors"
            style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: CASA_BRAND.colors.primary.white, fontWeight: 500 }}
          >
            <Check size={18} />
            Aprobar cuento y generar imágenes
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  // Paso 3: Character sheets
  const renderCharactersStep = () => {
    if (!story) return null;

    const allCharactersHaveSheets = story.characters.every(c => characterSheetOptions[c.id]?.length > 0);
    const allCharactersSelected = story.characters.every(c => selectedCharacterSheets[c.id] !== undefined);

    return (
      <div className="space-y-4">
        <div className="p-3 rounded-lg" style={{ backgroundColor: `${CASA_BRAND.colors.amber.light}10`, borderLeft: `4px solid ${CASA_BRAND.colors.primary.amber}` }}>
          <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
            Genera y selecciona una imagen de referencia para cada personaje. Esto ayudará a mantener consistencia visual en las escenas.
          </p>
        </div>

        {story.characters.map((character, index) => (
          <div key={character.id} className="p-4 rounded-lg border" style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <User size={18} style={{ color: character.role === 'protagonist' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayMedium }} />
                <span className="font-medium" style={{ color: CASA_BRAND.colors.primary.black }}>
                  {character.name}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: character.role === 'protagonist' ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayLight, color: character.role === 'protagonist' ? 'white' : CASA_BRAND.colors.secondary.grayDark }}>
                  {character.role === 'protagonist' ? 'Protagonista' : 'Secundario'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleGenerateCharacterSheet(character, index)}
                  disabled={generatingCharacterIndex !== null}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                  style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: 'white' }}
                >
                  {generatingCharacterIndex === index ? (
                    <><Loader2 size={14} className="animate-spin" /> Generando...</>
                  ) : characterSheetOptions[character.id]?.length ? (
                    <><RefreshCw size={14} /> Regenerar</>
                  ) : (
                    <><Camera size={14} /> Generar</>
                  )}
                </button>
                <ImageUploadButton
                  onUpload={(base64) => handleUploadCharacterImage(character.id, base64)}
                  label="imagen"
                  disabled={generatingCharacterIndex !== null}
                />
              </div>
            </div>

            <p className="text-xs mb-3" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              {character.visualDescription}
            </p>

            {characterSheetOptions[character.id]?.length > 0 && (
              <ImageSelector
                options={characterSheetOptions[character.id]}
                selectedIndex={selectedCharacterSheets[character.id] ?? null}
                onSelect={(idx) => setSelectedCharacterSheets(prev => ({ ...prev, [character.id]: idx }))}
                onSave={() => handleSaveCharacterImage(character.id)}
                onRegenerate={() => handleGenerateCharacterSheet(character, index)}
                isGenerating={generatingCharacterIndex === index}
                isSaving={savingCharacter === character.id}
                savedMessage={savedCharacterMessage[character.id]}
                label="character sheet"
              />
            )}
          </div>
        ))}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCurrentStep('story')}
            className="flex items-center gap-2 px-4 py-3 rounded-lg transition-colors border"
            style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight, color: CASA_BRAND.colors.secondary.grayDark }}
          >
            <ChevronLeft size={18} />
            Volver
          </button>
          <button
            type="button"
            onClick={handleApproveCharacters}
            disabled={!allCharactersHaveSheets || !allCharactersSelected}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: CASA_BRAND.colors.primary.white, fontWeight: 500 }}
          >
            <Check size={18} />
            Aprobar personajes
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  // Paso 4: Imágenes de escenas
  const renderScenesStep = () => {
    if (!story) return null;

    const scenesWithImages = story.scenes.filter(s => sceneImageOptions[s.number]?.length > 0).length;
    const scenesSelected = story.scenes.filter(s => selectedSceneImages[s.number] !== undefined).length;

    // Toggle para expandir/colapsar prompt de una escena
    const toggleScenePrompt = (sceneNumber: number) => {
      setExpandedScenePrompts(prev => ({
        ...prev,
        [sceneNumber]: !prev[sceneNumber],
      }));
      // Inicializar el prompt editable si no existe
      const scene = story.scenes.find(s => s.number === sceneNumber);
      if (scene && !editingScenePrompt[sceneNumber]) {
        setEditingScenePrompt(prev => ({
          ...prev,
          [sceneNumber]: scene.visualDescription,
        }));
      }
    };

    // Toggle para excluir/incluir un personaje de las referencias de una escena
    const toggleCharacterExclusion = (sceneNumber: number, characterId: string) => {
      setSceneExcludedCharacters(prev => {
        const currentExcluded = prev[sceneNumber] || [];
        if (currentExcluded.includes(characterId)) {
          return { ...prev, [sceneNumber]: currentExcluded.filter(id => id !== characterId) };
        } else {
          return { ...prev, [sceneNumber]: [...currentExcluded, characterId] };
        }
      });
    };

    // Agregar un personaje manualmente a las referencias de una escena
    const addCharacterToScene = (sceneNumber: number, characterId: string) => {
      setSceneIncludedCharacters(prev => {
        const currentIncluded = prev[sceneNumber] || [];
        if (!currentIncluded.includes(characterId)) {
          return { ...prev, [sceneNumber]: [...currentIncluded, characterId] };
        }
        return prev;
      });
      setShowCharacterPicker(null);
    };

    // Remover un personaje agregado manualmente
    const removeManualCharacter = (sceneNumber: number, characterId: string) => {
      setSceneIncludedCharacters(prev => {
        const currentIncluded = prev[sceneNumber] || [];
        return { ...prev, [sceneNumber]: currentIncluded.filter(id => id !== characterId) };
      });
    };

    return (
      <div className="space-y-4">
        <div className="p-3 rounded-lg" style={{ backgroundColor: `${CASA_BRAND.colors.amber.light}10`, borderLeft: `4px solid ${CASA_BRAND.colors.primary.amber}` }}>
          <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
            Genera imágenes para cada escena. Puedes ver/editar el prompt y controlar qué imágenes de referencia se usan. ({scenesWithImages}/{story.scenes.length} generadas, {scenesSelected}/{story.scenes.length} seleccionadas)
          </p>
        </div>

        <div className="max-h-[600px] overflow-y-auto space-y-4 pr-1">
          {story.scenes.map((scene) => {
            const isExpanded = expandedScenePrompts[scene.number];
            const excludedIds = sceneExcludedCharacters[scene.number] || [];
            const includedIds = sceneIncludedCharacters[scene.number] || [];
            const charactersWithRefs = getCharactersWithReferences(scene, excludedIds, includedIds);
            const hasAnyReference = charactersWithRefs.some(c => c.hasReference);

            // Personajes disponibles para agregar (que no están ya en la lista)
            const availableToAdd = story.characters.filter(c =>
              !charactersWithRefs.some(ref => ref.id === c.id)
            );

            return (
              <div key={scene.number} className="rounded-lg border overflow-hidden" style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight }}>
                {/* Header de la escena */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium" style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: 'white' }}>
                        {scene.number}
                      </span>
                      <span className="text-sm font-medium" style={{ color: CASA_BRAND.colors.primary.black }}>
                        Escena {scene.number}
                      </span>
                      {selectedSceneImages[scene.number] !== undefined && (
                        <CheckCircle size={16} style={{ color: '#10B981' }} />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Botón para ver prompt y referencias */}
                      <button
                        type="button"
                        onClick={() => toggleScenePrompt(scene.number)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                        style={{
                          backgroundColor: isExpanded ? `${CASA_BRAND.colors.primary.amber}15` : CASA_BRAND.colors.secondary.grayLight + '50',
                          color: isExpanded ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayMedium,
                        }}
                      >
                        <FileText size={12} />
                        {isExpanded ? 'Ocultar' : 'Ver prompt'}
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>

                      {/* Botón generar */}
                      <button
                        type="button"
                        onClick={() => handleGenerateSceneImage(scene, editingScenePrompt[scene.number])}
                        disabled={generatingSceneIndex !== null}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                        style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: 'white' }}
                      >
                        {generatingSceneIndex === scene.number ? (
                          <><Loader2 size={14} className="animate-spin" /> Generando...</>
                        ) : sceneImageOptions[scene.number]?.length ? (
                          <><RefreshCw size={14} /> Regenerar</>
                        ) : (
                          <><Camera size={14} /> Generar</>
                        )}
                      </button>
                      {/* Botón subir imagen */}
                      <ImageUploadButton
                        onUpload={(base64) => handleUploadSceneImage(scene.number, base64)}
                        label="imagen"
                        disabled={generatingSceneIndex !== null}
                      />
                    </div>
                  </div>

                  {/* Texto de la escena */}
                  <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                    {scene.text.slice(0, 200)}{scene.text.length > 200 ? '...' : ''}
                  </p>
                </div>

                {/* Panel expandible: Prompt e imágenes de referencia */}
                {isExpanded && (
                  <div className="border-t" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight, backgroundColor: CASA_BRAND.colors.secondary.grayLight + '20' }}>
                    {/* Imagen de referencia manual para la escena */}
                    <div className="p-4 border-b" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
                      <div className="flex items-center justify-between mb-3">
                        <h6 className="text-xs font-medium flex items-center gap-1" style={{ color: CASA_BRAND.colors.primary.black }}>
                          <ImageIcon size={12} />
                          Imagen de referencia para estilo
                        </h6>
                        <span className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                          Opcional - guía el estilo visual
                        </span>
                      </div>
                      <div className="flex items-start gap-4">
                        {/* Preview de imagen de referencia */}
                        {sceneReferenceImages[scene.number] ? (
                          <div className="relative">
                            <img
                              src={sceneReferenceImages[scene.number].startsWith('http')
                                ? sceneReferenceImages[scene.number]
                                : `data:image/png;base64,${sceneReferenceImages[scene.number]}`}
                              alt="Referencia de escena"
                              className="w-24 h-24 object-cover rounded-lg border"
                              style={{ borderColor: CASA_BRAND.colors.primary.amber }}
                            />
                            <button
                              type="button"
                              onClick={() => setSceneReferenceImages(prev => {
                                const updated = { ...prev };
                                delete updated[scene.number];
                                return updated;
                              })}
                              className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: CASA_BRAND.colors.primary.black }}
                            >
                              <X size={12} color="white" />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                            style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (!file) return;
                                if (file.size > 5 * 1024 * 1024) {
                                  alert('La imagen es muy grande. Máximo 5MB');
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onload = () => {
                                  const result = reader.result as string;
                                  const base64 = result.split(',')[1];
                                  setSceneReferenceImages(prev => ({ ...prev, [scene.number]: base64 }));
                                };
                                reader.readAsDataURL(file);
                              };
                              input.click();
                            }}
                          >
                            <Upload size={20} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
                            <span className="text-xs mt-1" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>Subir</span>
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                            Sube una imagen o usa una escena ya generada para mantener consistencia visual.
                          </p>

                          {/* Escenas ya generadas como referencia */}
                          {(() => {
                            // Obtener escenas con imagen ya seleccionada (excluyendo la actual)
                            const scenesWithImages = story?.scenes?.filter(s => {
                              if (s.number === scene.number) return false;
                              const opts = sceneImageOptions[s.number];
                              const selectedIdx = selectedSceneImages[s.number];
                              return (opts && selectedIdx !== undefined && opts[selectedIdx]) || s.selectedImageUrl;
                            }) || [];

                            if (scenesWithImages.length === 0) return null;

                            return (
                              <div className="mt-3">
                                <p className="text-xs mb-2" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                                  O usar escena existente:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {scenesWithImages.map(s => {
                                    const opts = sceneImageOptions[s.number];
                                    const selectedIdx = selectedSceneImages[s.number];
                                    const imgSrc = (opts && selectedIdx !== undefined && opts[selectedIdx]) || s.selectedImageUrl;
                                    if (!imgSrc) return null;

                                    return (
                                      <button
                                        key={s.number}
                                        type="button"
                                        onClick={() => {
                                          // Usar la imagen de esta escena como referencia
                                          setSceneReferenceImages(prev => ({ ...prev, [scene.number]: imgSrc }));
                                        }}
                                        className="relative group"
                                        title={`Usar escena ${s.number} como referencia`}
                                      >
                                        <img
                                          src={imgSrc.startsWith('http') ? imgSrc : `data:image/png;base64,${imgSrc}`}
                                          alt={`Escena ${s.number}`}
                                          className="w-12 h-12 object-cover rounded border hover:ring-2 transition-all"
                                          style={{ borderColor: CASA_BRAND.colors.secondary.grayLight, ringColor: CASA_BRAND.colors.primary.amber }}
                                        />
                                        <span
                                          className="absolute bottom-0 left-0 right-0 text-center text-xs py-0.5"
                                          style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white' }}
                                        >
                                          {s.number}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Imágenes de referencia de personajes */}
                    <div className="p-4 border-b" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
                      <div className="flex items-center justify-between mb-3">
                        <h6 className="text-xs font-medium flex items-center gap-1" style={{ color: CASA_BRAND.colors.primary.black }}>
                          <Users size={12} />
                          Personajes en la escena ({charactersWithRefs.filter(c => c.hasReference).length} con referencia)
                        </h6>
                        {!hasAnyReference && (
                          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
                            Sin referencias - menor consistencia visual
                          </span>
                        )}
                      </div>

                      {charactersWithRefs.length === 0 ? (
                        <p className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                          No se detectaron personajes en esta escena
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {charactersWithRefs.map(char => (
                            <div
                              key={char.id}
                              className={`relative rounded-lg overflow-hidden border-2 transition-all ${char.isExcluded ? 'opacity-50' : ''}`}
                              style={{
                                borderColor: char.isExcluded ? CASA_BRAND.colors.secondary.grayLight : char.hasReference ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayLight,
                              }}
                            >
                              {/* Imagen de referencia o placeholder */}
                              {char.referenceImage && !char.isExcluded ? (
                                <img
                                  src={char.referenceImage.startsWith('http') ? char.referenceImage : `data:image/png;base64,${char.referenceImage}`}
                                  alt={char.name}
                                  className="w-full aspect-square object-cover"
                                />
                              ) : (
                                <div
                                  className="w-full aspect-square flex items-center justify-center"
                                  style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight }}
                                >
                                  <User size={24} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
                                </div>
                              )}

                              {/* Nombre del personaje */}
                              <div
                                className="absolute bottom-0 left-0 right-0 px-2 py-1 text-xs truncate"
                                style={{
                                  backgroundColor: 'rgba(0,0,0,0.7)',
                                  color: 'white',
                                }}
                              >
                                {char.name}
                              </div>

                              {/* Botón para excluir/incluir o remover si es agregado manualmente */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (char.isManuallyAdded) {
                                    removeManualCharacter(scene.number, char.id);
                                  } else {
                                    toggleCharacterExclusion(scene.number, char.id);
                                  }
                                }}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                                style={{
                                  backgroundColor: char.isManuallyAdded ? '#3B82F6' : char.isExcluded ? '#EF4444' : CASA_BRAND.colors.primary.amber,
                                }}
                                title={char.isManuallyAdded ? 'Remover personaje agregado' : char.isExcluded ? 'Incluir en referencias' : 'Excluir de referencias'}
                              >
                                {char.isManuallyAdded ? (
                                  <X size={14} color="white" />
                                ) : char.isExcluded ? (
                                  <Plus size={14} color="white" />
                                ) : (
                                  <X size={14} color="white" />
                                )}
                              </button>

                              {/* Indicador si es agregado manualmente */}
                              {char.isManuallyAdded && (
                                <div
                                  className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-xs"
                                  style={{ backgroundColor: '#3B82F6', color: 'white' }}
                                >
                                  Agregado
                                </div>
                              )}

                              {/* Indicador si no tiene referencia */}
                              {!char.referenceImage && !char.isExcluded && !char.isManuallyAdded && (
                                <div
                                  className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-xs"
                                  style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}
                                >
                                  Sin imagen
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Botón para agregar personaje */}
                      {availableToAdd.length > 0 && (
                        <div className="mt-3 relative">
                          <button
                            type="button"
                            onClick={() => setShowCharacterPicker(showCharacterPicker === scene.number ? null : scene.number)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors border"
                            style={{
                              borderColor: CASA_BRAND.colors.secondary.grayLight,
                              color: CASA_BRAND.colors.secondary.grayDark,
                              backgroundColor: CASA_BRAND.colors.primary.white,
                            }}
                          >
                            <Plus size={12} />
                            Agregar referencia ({availableToAdd.length} disponibles)
                          </button>

                          {/* Dropdown de personajes disponibles */}
                          {showCharacterPicker === scene.number && (
                            <div
                              className="absolute top-full left-0 mt-1 z-10 rounded-lg shadow-lg border overflow-hidden"
                              style={{
                                backgroundColor: CASA_BRAND.colors.primary.white,
                                borderColor: CASA_BRAND.colors.secondary.grayLight,
                                minWidth: '200px',
                              }}
                            >
                              {availableToAdd.map(char => {
                                const charOptions = characterSheetOptions[char.id];
                                const charSelectedIdx = selectedCharacterSheets[char.id];
                                const charImage = charOptions && charSelectedIdx !== undefined ? charOptions[charSelectedIdx] : null;

                                return (
                                  <button
                                    key={char.id}
                                    type="button"
                                    onClick={() => addCharacterToScene(scene.number, char.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                                  >
                                    {charImage ? (
                                      <img
                                        src={charImage.startsWith('http') ? charImage : `data:image/png;base64,${charImage}`}
                                        alt={char.name}
                                        className="w-8 h-8 rounded object-cover"
                                      />
                                    ) : (
                                      <div
                                        className="w-8 h-8 rounded flex items-center justify-center"
                                        style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight }}
                                      >
                                        <User size={14} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
                                      </div>
                                    )}
                                    <span style={{ color: CASA_BRAND.colors.primary.black }}>{char.name}</span>
                                    {!charImage && (
                                      <span className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
                                        Sin imagen
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Prompt editable */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h6 className="text-xs font-medium flex items-center gap-1" style={{ color: CASA_BRAND.colors.primary.black }}>
                          <Edit3 size={12} />
                          Prompt de generación
                        </h6>
                        <button
                          type="button"
                          onClick={() => setEditingScenePrompt(prev => ({ ...prev, [scene.number]: scene.visualDescription }))}
                          className="text-xs hover:underline"
                          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                        >
                          Restaurar original
                        </button>
                      </div>
                      <textarea
                        value={editingScenePrompt[scene.number] || scene.visualDescription}
                        onChange={(e) => setEditingScenePrompt(prev => ({ ...prev, [scene.number]: e.target.value }))}
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2"
                        style={{
                          borderColor: CASA_BRAND.colors.secondary.grayLight,
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          lineHeight: 1.5,
                        }}
                        placeholder="Descripción visual de la escena..."
                      />

                      {/* Preview del prompt completo */}
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs flex items-center gap-1" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                          <Eye size={12} />
                          Ver prompt completo que se enviará
                        </summary>
                        <pre
                          className="mt-2 p-3 rounded text-xs overflow-auto max-h-48"
                          style={{
                            backgroundColor: CASA_BRAND.colors.primary.black,
                            color: CASA_BRAND.colors.secondary.grayLight,
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap',
                            fontSize: '11px',
                          }}
                        >
                          {buildScenePromptPreview(
                            { ...scene, visualDescription: editingScenePrompt[scene.number] || scene.visualDescription },
                            excludedIds
                          )}
                        </pre>
                      </details>
                    </div>
                  </div>
                )}

                {/* Selector de imágenes */}
                {sceneImageOptions[scene.number]?.length > 0 && (
                  <div className="p-4 border-t" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
                    <ImageSelector
                      options={sceneImageOptions[scene.number]}
                      selectedIndex={selectedSceneImages[scene.number] ?? null}
                      onSelect={(idx) => setSelectedSceneImages(prev => ({ ...prev, [scene.number]: idx }))}
                      onSave={() => handleSaveSceneImage(scene.number)}
                      onRegenerate={() => handleGenerateSceneImage(scene, editingScenePrompt[scene.number])}
                      isGenerating={generatingSceneIndex === scene.number}
                      isSaving={savingScene === scene.number}
                      savedMessage={savedSceneMessage[scene.number]}
                      label={`escena ${scene.number}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCurrentStep('characters')}
            className="flex items-center gap-2 px-4 py-3 rounded-lg transition-colors border"
            style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight, color: CASA_BRAND.colors.secondary.grayDark }}
          >
            <ChevronLeft size={18} />
            Volver
          </button>
          <button
            type="button"
            onClick={handleApproveScenes}
            disabled={scenesSelected < story.scenes.length}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: CASA_BRAND.colors.primary.white, fontWeight: 500 }}
          >
            <Check size={18} />
            Aprobar escenas ({scenesSelected}/{story.scenes.length})
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  // Paso 5: Portada y fin
  const renderCoverStep = () => {
    if (!story) return null;

    return (
      <div className="space-y-4">
        <div className="p-3 rounded-lg" style={{ backgroundColor: `${CASA_BRAND.colors.amber.light}10`, borderLeft: `4px solid ${CASA_BRAND.colors.primary.amber}` }}>
          <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
            Genera la portada del cuento y la imagen final de "Fin".
          </p>
        </div>

        {/* Portada */}
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight }}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium flex items-center gap-2" style={{ color: CASA_BRAND.colors.primary.black }}>
                <BookOpen size={18} />
                Portada
                {selectedCover !== null && <CheckCircle size={16} style={{ color: '#10B981' }} />}
              </h5>
              <div className="flex items-center gap-2">
                {/* Botón para editar prompt/referencias */}
                <button
                  type="button"
                  onClick={() => {
                    const newState = !showCoverPromptEditor;
                    setShowCoverPromptEditor(newState);
                    // Si se está abriendo y el prompt está vacío, inicializar con el default
                    if (newState && !editingCoverPrompt && story) {
                      const protagonist = story.characters.find(c => c.role === 'protagonist') || story.characters[0];
                      setEditingCoverPrompt(`Escena de portada que capture la esencia del cuento, mostrando al protagonista ${protagonist?.name || 'principal'} en un momento característico de la historia.`);
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors border"
                  style={{
                    borderColor: showCoverPromptEditor ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayLight,
                    color: showCoverPromptEditor ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayDark,
                    backgroundColor: showCoverPromptEditor ? `${CASA_BRAND.colors.amber.light}20` : 'transparent',
                  }}
                >
                  <Edit3 size={12} />
                  {showCoverPromptEditor ? 'Ocultar opciones' : 'Editar prompt'}
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateCover()}
                  disabled={generatingCover}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                  style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: 'white' }}
                >
                  {generatingCover ? (
                    <><Loader2 size={14} className="animate-spin" /> Generando...</>
                  ) : coverOptions.length > 0 ? (
                    <><RefreshCw size={14} /> Regenerar</>
                  ) : (
                    <><Camera size={14} /> Generar portada</>
                  )}
                </button>
                <ImageUploadButton
                  onUpload={handleUploadCover}
                  label="portada"
                  disabled={generatingCover}
                />
              </div>
            </div>

            {/* Panel expandible: Prompt y referencias para portada */}
            {showCoverPromptEditor && (
              <div className="mb-4 p-4 rounded-lg border" style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight + '20', borderColor: CASA_BRAND.colors.secondary.grayLight }}>
                {/* Imagen de referencia para la portada */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h6 className="text-xs font-medium flex items-center gap-1" style={{ color: CASA_BRAND.colors.primary.black }}>
                      <ImageIcon size={12} />
                      Imagen de referencia para estilo
                    </h6>
                    <span className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                      Opcional - guía el estilo visual
                    </span>
                  </div>
                  <div className="flex items-start gap-4">
                    {/* Preview de imagen de referencia */}
                    {coverReferenceImage ? (
                      <div className="relative">
                        <img
                          src={coverReferenceImage.startsWith('http') ? coverReferenceImage : `data:image/png;base64,${coverReferenceImage}`}
                          alt="Referencia de portada"
                          className="w-24 h-24 object-cover rounded-lg border"
                          style={{ borderColor: CASA_BRAND.colors.primary.amber }}
                        />
                        <button
                          type="button"
                          onClick={() => setCoverReferenceImage(null)}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: CASA_BRAND.colors.primary.black }}
                        >
                          <X size={12} color="white" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                        style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) {
                              alert('La imagen es muy grande. Máximo 5MB');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = () => {
                              const result = reader.result as string;
                              const base64 = result.split(',')[1];
                              setCoverReferenceImage(base64);
                            };
                            reader.readAsDataURL(file);
                          };
                          input.click();
                        }}
                      >
                        <Upload size={20} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
                        <span className="text-xs mt-1" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>Subir</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-xs mb-2" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                        Sube una imagen o usa una escena ya generada como referencia visual.
                      </p>
                      {/* Escenas ya generadas como referencia */}
                      {(() => {
                        const scenesWithImages = story?.scenes?.filter(s => {
                          const opts = sceneImageOptions[s.number];
                          const selectedIdx = selectedSceneImages[s.number];
                          return (opts && selectedIdx !== undefined && opts[selectedIdx]) || s.selectedImageUrl;
                        }) || [];

                        if (scenesWithImages.length === 0) return null;

                        return (
                          <div>
                            <p className="text-xs mb-2" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                              O usar escena existente:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {scenesWithImages.map(s => {
                                const opts = sceneImageOptions[s.number];
                                const selectedIdx = selectedSceneImages[s.number];
                                const imgSrc = (opts && selectedIdx !== undefined && opts[selectedIdx]) || s.selectedImageUrl;
                                if (!imgSrc) return null;

                                return (
                                  <button
                                    key={s.number}
                                    type="button"
                                    onClick={() => setCoverReferenceImage(imgSrc)}
                                    className="relative group"
                                    title={`Usar escena ${s.number} como referencia`}
                                  >
                                    <img
                                      src={imgSrc.startsWith('http') ? imgSrc : `data:image/png;base64,${imgSrc}`}
                                      alt={`Escena ${s.number}`}
                                      className="w-12 h-12 object-cover rounded border hover:ring-2 transition-all"
                                      style={{ borderColor: CASA_BRAND.colors.secondary.grayLight, ringColor: CASA_BRAND.colors.primary.amber }}
                                    />
                                    <span
                                      className="absolute bottom-0 left-0 right-0 text-center text-xs py-0.5"
                                      style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white' }}
                                    >
                                      {s.number}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Referencias de personajes para portada */}
                <div className="mb-4 pb-4 border-b" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
                  <div className="flex items-center justify-between mb-2">
                    <h6 className="text-xs font-medium flex items-center gap-1" style={{ color: CASA_BRAND.colors.primary.black }}>
                      <Users size={12} />
                      Personajes en la portada
                    </h6>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {story.characters.map(char => {
                      const options = characterSheetOptions[char.id];
                      const selectedIdx = selectedCharacterSheets[char.id];
                      const refImage = options && selectedIdx !== undefined ? options[selectedIdx] : char.characterSheetUrl;
                      const isExcluded = coverExcludedCharacters.includes(char.id);

                      return (
                        <div
                          key={char.id}
                          className={`relative rounded-lg overflow-hidden border-2 transition-all ${isExcluded ? 'opacity-50' : ''}`}
                          style={{
                            borderColor: isExcluded ? CASA_BRAND.colors.secondary.grayLight : refImage ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayLight,
                          }}
                        >
                          {refImage && !isExcluded ? (
                            <img
                              src={refImage.startsWith('http') ? refImage : `data:image/png;base64,${refImage}`}
                              alt={char.name}
                              className="w-full aspect-square object-cover"
                            />
                          ) : (
                            <div
                              className="w-full aspect-square flex items-center justify-center"
                              style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight }}
                            >
                              <User size={24} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
                            </div>
                          )}
                          <div
                            className="absolute bottom-0 left-0 right-0 px-2 py-1 text-xs truncate"
                            style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: 'white' }}
                          >
                            {char.name}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (isExcluded) {
                                setCoverExcludedCharacters(prev => prev.filter(id => id !== char.id));
                              } else {
                                setCoverExcludedCharacters(prev => [...prev, char.id]);
                              }
                            }}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                            style={{ backgroundColor: isExcluded ? '#EF4444' : CASA_BRAND.colors.primary.amber }}
                            title={isExcluded ? 'Incluir en referencias' : 'Excluir de referencias'}
                          >
                            {isExcluded ? <Plus size={14} color="white" /> : <X size={14} color="white" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Prompt editable para portada */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h6 className="text-xs font-medium flex items-center gap-1" style={{ color: CASA_BRAND.colors.primary.black }}>
                      <Edit3 size={12} />
                      Prompt de generación
                    </h6>
                    <button
                      type="button"
                      onClick={() => setEditingCoverPrompt('')}
                      className="text-xs hover:underline"
                      style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                    >
                      Restaurar original
                    </button>
                  </div>
                  <textarea
                    value={editingCoverPrompt}
                    onChange={(e) => setEditingCoverPrompt(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2"
                    style={{
                      borderColor: CASA_BRAND.colors.secondary.grayLight,
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      lineHeight: 1.5,
                    }}
                    placeholder="Descripción personalizada para la portada... (deja vacío para usar el prompt por defecto)"
                  />

                  {/* Preview del prompt completo */}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs flex items-center gap-1" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                      <Eye size={12} />
                      Ver prompt completo que se enviará
                    </summary>
                    <pre
                      className="mt-2 p-3 rounded text-xs overflow-auto max-h-48"
                      style={{
                        backgroundColor: CASA_BRAND.colors.primary.black,
                        color: CASA_BRAND.colors.secondary.grayLight,
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        fontSize: '11px',
                      }}
                    >
                      {buildCoverPromptPreview()}
                    </pre>
                  </details>
                </div>
              </div>
            )}

            {coverOptions.length > 0 ? (
              <ImageSelector
                options={coverOptions}
                selectedIndex={selectedCover}
                onSelect={setSelectedCover}
                onSave={handleSaveCover}
                onRegenerate={() => handleGenerateCover()}
                isGenerating={generatingCover}
                isSaving={savingCover}
                savedMessage={savedCoverMessage}
                label="portada"
              />
            ) : (
              <div className="text-center py-8" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                Genera o sube opciones de portada para seleccionar
              </div>
            )}
          </div>
        </div>

        {/* Fin */}
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight }}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium flex items-center gap-2" style={{ color: CASA_BRAND.colors.primary.black }}>
                <FileText size={18} />
                Imagen final "Fin"
                {selectedEnd !== null && <CheckCircle size={16} style={{ color: '#10B981' }} />}
              </h5>
              <div className="flex items-center gap-2">
                {/* Botón para editar prompt/referencias */}
                <button
                  type="button"
                  onClick={() => {
                    const newState = !showEndPromptEditor;
                    setShowEndPromptEditor(newState);
                    // Si se está abriendo y el prompt está vacío, inicializar con el default
                    if (newState && !editingEndPrompt) {
                      setEditingEndPrompt(`Una imagen acogedora y conclusiva que transmita el final feliz del cuento. Puede mostrar elementos decorativos como estrellas, corazones, o un paisaje sereno que invite a la reflexión.`);
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors border"
                  style={{
                    borderColor: showEndPromptEditor ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayLight,
                    color: showEndPromptEditor ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayDark,
                    backgroundColor: showEndPromptEditor ? `${CASA_BRAND.colors.amber.light}20` : 'transparent',
                  }}
                >
                  <Edit3 size={12} />
                  {showEndPromptEditor ? 'Ocultar opciones' : 'Editar prompt'}
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateEnd()}
                  disabled={generatingEnd}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                  style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: 'white' }}
                >
                  {generatingEnd ? (
                    <><Loader2 size={14} className="animate-spin" /> Generando...</>
                  ) : endOptions.length > 0 ? (
                    <><RefreshCw size={14} /> Regenerar</>
                  ) : (
                    <><Camera size={14} /> Generar "Fin"</>
                  )}
                </button>
                <ImageUploadButton
                  onUpload={handleUploadEnd}
                  label="imagen"
                  disabled={generatingEnd}
                />
              </div>
            </div>

            {/* Panel expandible: Prompt y referencias para fin */}
            {showEndPromptEditor && (
              <div className="mb-4 p-4 rounded-lg border" style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight + '20', borderColor: CASA_BRAND.colors.secondary.grayLight }}>
                {/* Imagen de referencia para el fin */}
                <div className="mb-4 pb-4 border-b" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
                  <div className="flex items-center justify-between mb-2">
                    <h6 className="text-xs font-medium flex items-center gap-1" style={{ color: CASA_BRAND.colors.primary.black }}>
                      <ImageIcon size={12} />
                      Imagen de referencia para estilo
                    </h6>
                    <span className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                      Opcional - guía el estilo visual
                    </span>
                  </div>
                  <div className="flex items-start gap-4">
                    {/* Preview de imagen de referencia */}
                    {endReferenceImage ? (
                      <div className="relative">
                        <img
                          src={endReferenceImage.startsWith('http') ? endReferenceImage : `data:image/png;base64,${endReferenceImage}`}
                          alt="Referencia de fin"
                          className="w-24 h-24 object-cover rounded-lg border"
                          style={{ borderColor: CASA_BRAND.colors.primary.amber }}
                        />
                        <button
                          type="button"
                          onClick={() => setEndReferenceImage(null)}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: CASA_BRAND.colors.primary.black }}
                        >
                          <X size={12} color="white" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                        style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) {
                              alert('La imagen es muy grande. Máximo 5MB');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = () => {
                              const result = reader.result as string;
                              const base64 = result.split(',')[1];
                              setEndReferenceImage(base64);
                            };
                            reader.readAsDataURL(file);
                          };
                          input.click();
                        }}
                      >
                        <Upload size={20} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
                        <span className="text-xs mt-1" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>Subir</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-xs mb-2" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                        Sube una imagen o usa una escena ya generada como referencia visual para mantener el estilo.
                      </p>
                      {/* Escenas ya generadas como referencia */}
                      {(() => {
                        const scenesWithImages = story?.scenes?.filter(s => {
                          const opts = sceneImageOptions[s.number];
                          const selectedIdx = selectedSceneImages[s.number];
                          return (opts && selectedIdx !== undefined && opts[selectedIdx]) || s.selectedImageUrl;
                        }) || [];

                        if (scenesWithImages.length === 0) return null;

                        return (
                          <div>
                            <p className="text-xs mb-2" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                              O usar escena existente:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {scenesWithImages.map(s => {
                                const opts = sceneImageOptions[s.number];
                                const selectedIdx = selectedSceneImages[s.number];
                                const imgSrc = (opts && selectedIdx !== undefined && opts[selectedIdx]) || s.selectedImageUrl;
                                if (!imgSrc) return null;

                                return (
                                  <button
                                    key={s.number}
                                    type="button"
                                    onClick={() => setEndReferenceImage(imgSrc)}
                                    className="relative group"
                                    title={`Usar escena ${s.number} como referencia`}
                                  >
                                    <img
                                      src={imgSrc.startsWith('http') ? imgSrc : `data:image/png;base64,${imgSrc}`}
                                      alt={`Escena ${s.number}`}
                                      className="w-12 h-12 object-cover rounded border hover:ring-2 transition-all"
                                      style={{ borderColor: CASA_BRAND.colors.secondary.grayLight, ringColor: CASA_BRAND.colors.primary.amber }}
                                    />
                                    <span
                                      className="absolute bottom-0 left-0 right-0 text-center text-xs py-0.5"
                                      style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white' }}
                                    >
                                      {s.number}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Prompt editable para fin */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h6 className="text-xs font-medium flex items-center gap-1" style={{ color: CASA_BRAND.colors.primary.black }}>
                      <Edit3 size={12} />
                      Prompt de generación
                    </h6>
                    <button
                      type="button"
                      onClick={() => setEditingEndPrompt('')}
                      className="text-xs hover:underline"
                      style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                    >
                      Restaurar original
                    </button>
                  </div>
                  <textarea
                    value={editingEndPrompt}
                    onChange={(e) => setEditingEndPrompt(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2"
                    style={{
                      borderColor: CASA_BRAND.colors.secondary.grayLight,
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      lineHeight: 1.5,
                    }}
                    placeholder="Descripción personalizada para la imagen final... (deja vacío para usar el prompt por defecto)"
                  />

                  {/* Preview del prompt completo */}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs flex items-center gap-1" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                      <Eye size={12} />
                      Ver prompt completo que se enviará
                    </summary>
                    <pre
                      className="mt-2 p-3 rounded text-xs overflow-auto max-h-48"
                      style={{
                        backgroundColor: CASA_BRAND.colors.primary.black,
                        color: CASA_BRAND.colors.secondary.grayLight,
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        fontSize: '11px',
                      }}
                    >
                      {buildEndPromptPreview()}
                    </pre>
                  </details>
                </div>
              </div>
            )}

            {endOptions.length > 0 ? (
              <ImageSelector
                options={endOptions}
                selectedIndex={selectedEnd}
                onSelect={setSelectedEnd}
                onSave={handleSaveEnd}
                onRegenerate={() => handleGenerateEnd()}
                isGenerating={generatingEnd}
                isSaving={savingEnd}
                savedMessage={savedEndMessage}
                label="imagen final"
              />
            ) : (
              <div className="text-center py-8" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                Genera o sube opciones de imagen final para seleccionar
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCurrentStep('scenes')}
            className="flex items-center gap-2 px-4 py-3 rounded-lg transition-colors border"
            style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight, color: CASA_BRAND.colors.secondary.grayDark }}
          >
            <ChevronLeft size={18} />
            Volver
          </button>
          <button
            type="button"
            onClick={handleFinalize}
            disabled={selectedCover === null || selectedEnd === null}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: CASA_BRAND.colors.primary.white, fontWeight: 500 }}
          >
            <Check size={18} />
            Finalizar cuento
          </button>
        </div>
      </div>
    );
  };

  // Paso final: Completo
  const renderCompleteStep = () => {
    if (!story) return null;

    return (
      <div className="space-y-4">
        <div className="p-6 rounded-lg text-center" style={{ backgroundColor: `${CASA_BRAND.colors.amber.light}10`, border: `2px solid ${CASA_BRAND.colors.primary.amber}` }}>
          <CheckCircle size={48} className="mx-auto mb-4" style={{ color: CASA_BRAND.colors.primary.amber }} />
          <h3 style={{ fontFamily: CASA_BRAND.fonts.heading, fontSize: '20px', color: CASA_BRAND.colors.primary.black, marginBottom: '8px' }}>
            {story.title}
          </h3>
          <p style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
            Cuento completo con {story.scenes.length} escenas ilustradas
          </p>
        </div>

        {/* Preview de algunas imágenes */}
        <div className="grid grid-cols-4 gap-2">
          {story.coverImageUrl && (
            <div className="relative rounded-lg overflow-hidden">
              <img src={story.coverImageUrl.startsWith('http') ? story.coverImageUrl : `data:image/png;base64,${story.coverImageUrl}`} alt="Portada" className="w-full aspect-[4/3] object-cover" />
              <span className="absolute bottom-1 left-1 text-xs px-1.5 py-0.5 rounded bg-black/50 text-white">Portada</span>
            </div>
          )}
          {story.scenes.slice(0, 2).map(scene => scene.selectedImageUrl && (
            <div key={scene.number} className="relative rounded-lg overflow-hidden">
              <img src={scene.selectedImageUrl.startsWith('http') ? scene.selectedImageUrl : `data:image/png;base64,${scene.selectedImageUrl}`} alt={`Escena ${scene.number}`} className="w-full aspect-[4/3] object-cover" />
              <span className="absolute bottom-1 left-1 text-xs px-1.5 py-0.5 rounded bg-black/50 text-white">Esc. {scene.number}</span>
            </div>
          ))}
          {story.endImageUrl && (
            <div className="relative rounded-lg overflow-hidden">
              <img src={story.endImageUrl.startsWith('http') ? story.endImageUrl : `data:image/png;base64,${story.endImageUrl}`} alt="Fin" className="w-full aspect-[4/3] object-cover" />
              <span className="absolute bottom-1 left-1 text-xs px-1.5 py-0.5 rounded bg-black/50 text-white">Fin</span>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleRegenerate}
            className="flex items-center gap-2 px-4 py-3 rounded-lg transition-colors border"
            style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight, color: CASA_BRAND.colors.secondary.grayDark }}
          >
            <RefreshCw size={18} />
            Crear nuevo cuento
          </button>
          <button
            type="button"
            onClick={handleEditStory}
            className="flex items-center gap-2 px-4 py-3 rounded-lg transition-colors border"
            style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.primary.amber, color: CASA_BRAND.colors.primary.amber }}
          >
            <Edit3 size={18} />
            Editar cuento
          </button>
          {onNavigateToFullEditor && (
            <button
              type="button"
              onClick={onNavigateToFullEditor}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors"
              style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: CASA_BRAND.colors.primary.white, fontWeight: 500 }}
            >
              <ExternalLink size={18} />
              Ver en editor completo
            </button>
          )}
        </div>
      </div>
    );
  };

  // Formatear fecha para mostrar
  const formatSavedAt = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleString('es-CL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Modal de recuperación de borrador - no mostrar si el cuento ya está completo */}
      {showRecoveryPrompt && draft && !confirmed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleDeclineRecovery}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${CASA_BRAND.colors.primary.amber}20` }}
              >
                <AlertCircle size={20} style={{ color: CASA_BRAND.colors.primary.amber }} />
              </div>
              <div>
                <h4
                  className="font-semibold mb-1"
                  style={{ color: CASA_BRAND.colors.primary.black, fontFamily: CASA_BRAND.fonts.heading }}
                >
                  Borrador encontrado
                </h4>
                <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                  Se encontró un cuento en progreso guardado automáticamente.
                </p>
              </div>
            </div>

            <div
              className="p-3 rounded-lg mb-4"
              style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight + '30' }}
            >
              <div className="text-sm space-y-1" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                {draft.story?.title && (
                  <p><strong>Título:</strong> {draft.story.title}</p>
                )}
                <p><strong>Paso:</strong> {
                  draft.currentStep === 'story' ? 'Revisando cuento' :
                  draft.currentStep === 'characters' ? 'Generando personajes' :
                  draft.currentStep === 'scenes' ? 'Generando escenas' :
                  draft.currentStep === 'cover' ? 'Seleccionando portada' :
                  draft.currentStep
                }</p>
                {draft.story?.scenes && (
                  <p><strong>Escenas con imagen:</strong> {
                    Object.keys(draft.selectedSceneImages).length
                  } / {draft.story.scenes.length}</p>
                )}
                <p className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                  Guardado: {formatSavedAt(draft.savedAt)}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDeclineRecovery}
                className="flex-1 px-4 py-2 rounded-lg border transition-colors"
                style={{
                  borderColor: CASA_BRAND.colors.secondary.grayLight,
                  color: CASA_BRAND.colors.secondary.grayDark,
                }}
              >
                Empezar de nuevo
              </button>
              <button
                type="button"
                onClick={handleAcceptRecovery}
                className="flex-1 px-4 py-2 rounded-lg transition-colors font-medium"
                style={{
                  backgroundColor: CASA_BRAND.colors.primary.amber,
                  color: 'white',
                }}
              >
                Recuperar borrador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Indicador de auto-guardado */}
      {currentStep !== 'config' && currentStep !== 'complete' && (
        <div
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full"
          style={{
            backgroundColor: isSaving ? `${CASA_BRAND.colors.secondary.grayLight}50` : `${CASA_BRAND.colors.amber.light}30`,
            color: isSaving ? CASA_BRAND.colors.secondary.grayMedium : CASA_BRAND.colors.amber.dark,
            width: 'fit-content',
          }}
        >
          {isSaving ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Guardando en Supabase...
            </>
          ) : lastSavedAt ? (
            <>
              <CheckCircle size={12} />
              Guardado: {formatSavedAt(lastSavedAt)}
            </>
          ) : (
            <>
              <Circle size={12} />
              Sin guardar
            </>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3
            style={{
              fontFamily: CASA_BRAND.fonts.heading,
              fontSize: '20px',
              fontWeight: 400,
              color: CASA_BRAND.colors.primary.black,
              marginBottom: '4px',
            }}
          >
            Cuentacuento
          </h3>
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            Historia ilustrada para el momento de niños
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Botón eliminar cuento - solo visible si hay una historia */}
          {(story || initialStory) && (
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors hover:bg-red-50"
                  style={{
                    color: '#DC2626',
                    fontFamily: CASA_BRAND.fonts.body,
                  }}
                >
                  <Trash2 size={14} />
                  Eliminar
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  borderRadius: '16px',
                }}
              >
                <AlertDialogHeader>
                  <AlertDialogTitle
                    className="flex items-center gap-2"
                    style={{
                      fontFamily: CASA_BRAND.fonts.heading,
                      color: CASA_BRAND.colors.primary.black,
                    }}
                  >
                    <Trash2 size={20} style={{ color: '#DC2626' }} />
                    ¿Eliminar este cuentacuento?
                  </AlertDialogTitle>
                  <AlertDialogDescription
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      color: CASA_BRAND.colors.secondary.grayMedium,
                    }}
                  >
                    Esta acción eliminará permanentemente:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>La historia "{story?.title || initialStory?.title || 'Sin título'}"</li>
                      <li>Todas las imágenes generadas (personajes, escenas, portada)</li>
                      <li>El borrador guardado en Supabase</li>
                    </ul>
                    <p className="mt-3 font-medium" style={{ color: '#DC2626' }}>
                      Esta acción no se puede deshacer.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    disabled={isDeleting}
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                    }}
                  >
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteStory}
                    disabled={isDeleting}
                    className="flex items-center gap-2"
                    style={{
                      backgroundColor: '#DC2626',
                      color: 'white',
                      fontFamily: CASA_BRAND.fonts.body,
                    }}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Eliminando...
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} />
                        Sí, eliminar
                      </>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {onNavigateToFullEditor && (
            <button
              type="button"
              onClick={onNavigateToFullEditor}
              className="flex items-center gap-1 text-sm transition-colors hover:underline"
              style={{ color: CASA_BRAND.colors.primary.amber }}
            >
              Editor completo
              <ExternalLink size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Indicador de pasos (solo si ya hay un cuento) */}
      {currentStep !== 'config' && (
        <StepIndicator currentStep={currentStep} storyStatus={story?.metadata.status || 'draft'} />
      )}

      {/* Contenido del paso actual */}
      {renderCurrentStep()}
    </div>
  );
};

export default CuentacuentoEditor;
