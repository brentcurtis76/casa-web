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
} from 'lucide-react';
import type { LiturgyContext } from '@/types/shared/liturgy';
import type { SlideGroup, Slide } from '@/types/shared/slide';
import type { Story, StoryCharacter, StoryScene, StoryStatus } from '@/types/shared/story';
import { createPreviewSlideGroup } from '@/lib/cuentacuentos/storyToSlides';
import { useCuentacuentosDraft, type CuentacuentosDraftFull } from '@/hooks/useCuentacuentosDraft';

interface CuentacuentoEditorProps {
  context: LiturgyContext;
  initialStory?: Story;
  initialSlides?: SlideGroup;
  onStoryCreated: (story: Story, slides: SlideGroup) => void;
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
  onRegenerate?: () => void;
  isGenerating: boolean;
  label: string;
}> = ({ options, selectedIndex, onSelect, onRegenerate, isGenerating, label }) => {
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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {options.map((base64, index) => (
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
              src={`data:image/png;base64,${base64}`}
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

  // Estado para ver/editar prompts y referencias de escenas
  const [expandedScenePrompts, setExpandedScenePrompts] = useState<Record<number, boolean>>({});
  const [sceneExcludedCharacters, setSceneExcludedCharacters] = useState<Record<number, string[]>>({});
  const [editingScenePrompt, setEditingScenePrompt] = useState<Record<number, string>>({});

  // Estado de UI
  const [showPreview, setShowPreview] = useState(true);
  const [showForm, setShowForm] = useState(!initialStory);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [promptPreview, setPromptPreview] = useState<{ systemPrompt: string; userPrompt: string } | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [confirmed, setConfirmed] = useState(!!initialStory && initialStory.metadata.status === 'ready');

  // Hook de auto-guardado
  const {
    hasDraft,
    draft,
    lastSavedAt,
    isSaving,
    saveDraft,
    deleteDraft,
    showRecoveryPrompt,
    acceptRecovery,
    declineRecovery,
  } = useCuentacuentosDraft({ liturgyId: context.id });

  // Efecto para guardar automáticamente cuando cambia el estado
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
    saveDraft,
    location,
    customLocation,
    characters,
    style,
    illustrationStyle,
    additionalNotes,
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

    // Restaurar cuento
    if (draftData.story) {
      setStory(draftData.story);
    }

    // Restaurar character sheets
    setCharacterSheetOptions(draftData.characterSheetOptions);
    setSelectedCharacterSheets(draftData.selectedCharacterSheets);

    // Restaurar scene images
    setSceneImageOptions(draftData.sceneImageOptions);
    setSelectedSceneImages(draftData.selectedSceneImages);

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
  const getCharactersWithReferences = useCallback((scene: StoryScene, excludedIds: string[] = []) => {
    if (!story) return [];

    const detected = detectCharactersInScene(scene, story.characters);
    return detected.map(c => {
      const options = characterSheetOptions[c.id];
      const selectedIdx = selectedCharacterSheets[c.id];
      const referenceImage = options && selectedIdx !== undefined ? options[selectedIdx] : c.characterSheetUrl;
      const isExcluded = excludedIds.includes(c.id);

      return {
        ...c,
        referenceImage: isExcluded ? undefined : referenceImage,
        hasReference: !!referenceImage && !isExcluded,
        isExcluded,
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

      setCharacterSheetOptions(prev => ({
        ...prev,
        [character.id]: data.images,
      }));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando character sheet');
    } finally {
      setGeneratingCharacterIndex(null);
    }
  }, [story]);

  // Generar imagen para una escena
  const handleGenerateSceneImage = useCallback(async (scene: StoryScene, customPrompt?: string) => {
    if (!story) return;

    setGeneratingSceneIndex(scene.number);
    setError(null);

    try {
      // Obtener personajes excluidos para esta escena
      const excludedIds = sceneExcludedCharacters[scene.number] || [];

      // Incluir las imágenes de referencia (character sheets) seleccionadas
      // Solo para personajes no excluidos
      const charactersWithReferences = story.characters
        .filter(c => !excludedIds.includes(c.id))
        .map(c => {
          const options = characterSheetOptions[c.id];
          const selectedIdx = selectedCharacterSheets[c.id];
          const referenceImage = options && selectedIdx !== undefined ? options[selectedIdx] : c.characterSheetUrl;

          return {
            name: c.name,
            visualDescription: c.visualDescription,
            referenceImage: referenceImage,
          };
        });

      // Usar prompt personalizado si se proporciona
      const sceneData = customPrompt
        ? { text: scene.text, visualDescription: customPrompt }
        : { text: scene.text, visualDescription: scene.visualDescription };

      const { data, error: fnError } = await supabase.functions.invoke('generate-scene-images', {
        body: {
          type: 'scene',
          styleId: story.illustrationStyle,
          scene: sceneData,
          characters: charactersWithReferences,
          location: story.location,
          count: 4,
        },
      });

      if (fnError) throw fnError;

      if (!data?.success || !data.images?.length) {
        throw new Error(data?.error || 'No se pudieron generar imágenes');
      }

      // Log de debug para ver qué personajes se detectaron
      if (data.charactersDetected) {
        console.log(`[CuentacuentoEditor] Escena ${scene.number} - Personajes detectados:`, data.charactersDetected);
      }

      setSceneImageOptions(prev => ({
        ...prev,
        [scene.number]: data.images,
      }));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando imagen de escena');
    } finally {
      setGeneratingSceneIndex(null);
    }
  }, [story, characterSheetOptions, selectedCharacterSheets, sceneExcludedCharacters]);

  // Generar portada
  const handleGenerateCover = useCallback(async () => {
    if (!story) return;

    setGeneratingCover(true);
    setError(null);

    try {
      const protagonist = story.characters.find(c => c.role === 'protagonist') || story.characters[0];

      // Obtener imagen de referencia del protagonista
      let protagonistReference: string | undefined;
      if (protagonist) {
        const options = characterSheetOptions[protagonist.id];
        const selectedIdx = selectedCharacterSheets[protagonist.id];
        protagonistReference = options && selectedIdx !== undefined ? options[selectedIdx] : protagonist.characterSheetUrl;
      }

      const { data, error: fnError } = await supabase.functions.invoke('generate-scene-images', {
        body: {
          type: 'cover',
          styleId: story.illustrationStyle,
          title: story.title,
          protagonist: {
            visualDescription: protagonist?.visualDescription || 'A friendly child character',
          },
          location: story.location,
          referenceImage: protagonistReference, // Imagen de referencia del protagonista
          count: 4,
        },
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
  }, [story, characterSheetOptions, selectedCharacterSheets]);

  // Generar imagen final
  const handleGenerateEnd = useCallback(async () => {
    if (!story) return;

    setGeneratingEnd(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-scene-images', {
        body: {
          type: 'end',
          styleId: story.illustrationStyle,
          count: 4,
        },
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
  }, [story]);

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
  const handleFinalize = useCallback(() => {
    if (!story) return;

    const finalStory: Story = {
      ...story,
      coverImageOptions: coverOptions,
      coverImageUrl: selectedCover !== null ? coverOptions[selectedCover] : undefined,
      endImageOptions: endOptions,
      endImageUrl: selectedEnd !== null ? endOptions[selectedEnd] : undefined,
      metadata: {
        ...story.metadata,
        status: 'ready',
        updatedAt: new Date().toISOString(),
      },
    };

    setStory(finalStory);

    // Generar slides finales
    const slides = createPreviewSlideGroup(finalStory);
    setPreviewSlides(slides as unknown as SlideGroup);

    onStoryCreated(finalStory, slides as unknown as SlideGroup);
    setConfirmed(true);
    setCurrentStep('complete');

    // Eliminar el borrador ya que se finalizó exitosamente
    deleteDraft();
    console.log('[CuentacuentoEditor] Story finalized, draft deleted');
  }, [story, coverOptions, selectedCover, endOptions, selectedEnd, onStoryCreated, deleteDraft]);

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
              {!characterSheetOptions[character.id]?.length && (
                <button
                  type="button"
                  onClick={() => handleGenerateCharacterSheet(character, index)}
                  disabled={generatingCharacterIndex !== null}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                  style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: 'white' }}
                >
                  {generatingCharacterIndex === index ? (
                    <><Loader2 size={14} className="animate-spin" /> Generando...</>
                  ) : (
                    <><Camera size={14} /> Generar</>
                  )}
                </button>
              )}
            </div>

            <p className="text-xs mb-3" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              {character.visualDescription}
            </p>

            {characterSheetOptions[character.id]?.length > 0 && (
              <ImageSelector
                options={characterSheetOptions[character.id]}
                selectedIndex={selectedCharacterSheets[character.id] ?? null}
                onSelect={(idx) => setSelectedCharacterSheets(prev => ({ ...prev, [character.id]: idx }))}
                onRegenerate={() => handleGenerateCharacterSheet(character, index)}
                isGenerating={generatingCharacterIndex === index}
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
            const charactersWithRefs = getCharactersWithReferences(scene, excludedIds);
            const hasAnyReference = charactersWithRefs.some(c => c.hasReference);

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
                    {/* Imágenes de referencia */}
                    <div className="p-4 border-b" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
                      <div className="flex items-center justify-between mb-3">
                        <h6 className="text-xs font-medium flex items-center gap-1" style={{ color: CASA_BRAND.colors.primary.black }}>
                          <ImageIcon size={12} />
                          Imágenes de referencia ({charactersWithRefs.filter(c => c.hasReference).length} activas)
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
                                  src={`data:image/png;base64,${char.referenceImage}`}
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

                              {/* Botón para excluir/incluir */}
                              <button
                                type="button"
                                onClick={() => toggleCharacterExclusion(scene.number, char.id)}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                                style={{
                                  backgroundColor: char.isExcluded ? '#EF4444' : CASA_BRAND.colors.primary.amber,
                                }}
                                title={char.isExcluded ? 'Incluir en referencias' : 'Excluir de referencias'}
                              >
                                {char.isExcluded ? (
                                  <Plus size={14} color="white" />
                                ) : (
                                  <X size={14} color="white" />
                                )}
                              </button>

                              {/* Indicador si no tiene referencia */}
                              {!char.referenceImage && !char.isExcluded && (
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
                      onRegenerate={() => handleGenerateSceneImage(scene, editingScenePrompt[scene.number])}
                      isGenerating={generatingSceneIndex === scene.number}
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
        <div className="p-4 rounded-lg border" style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight }}>
          <div className="flex items-center justify-between mb-3">
            <h5 className="font-medium flex items-center gap-2" style={{ color: CASA_BRAND.colors.primary.black }}>
              <BookOpen size={18} />
              Portada
              {selectedCover !== null && <CheckCircle size={16} style={{ color: '#10B981' }} />}
            </h5>
            {coverOptions.length === 0 && (
              <button
                type="button"
                onClick={handleGenerateCover}
                disabled={generatingCover}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: 'white' }}
              >
                {generatingCover ? <><Loader2 size={14} className="animate-spin" /> Generando...</> : <><Camera size={14} /> Generar portada</>}
              </button>
            )}
          </div>

          {coverOptions.length > 0 ? (
            <ImageSelector
              options={coverOptions}
              selectedIndex={selectedCover}
              onSelect={setSelectedCover}
              onRegenerate={handleGenerateCover}
              isGenerating={generatingCover}
              label="portada"
            />
          ) : (
            <div className="text-center py-8" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              Genera opciones de portada para seleccionar
            </div>
          )}
        </div>

        {/* Fin */}
        <div className="p-4 rounded-lg border" style={{ backgroundColor: CASA_BRAND.colors.primary.white, borderColor: CASA_BRAND.colors.secondary.grayLight }}>
          <div className="flex items-center justify-between mb-3">
            <h5 className="font-medium flex items-center gap-2" style={{ color: CASA_BRAND.colors.primary.black }}>
              <FileText size={18} />
              Imagen final "Fin"
              {selectedEnd !== null && <CheckCircle size={16} style={{ color: '#10B981' }} />}
            </h5>
            {endOptions.length === 0 && (
              <button
                type="button"
                onClick={handleGenerateEnd}
                disabled={generatingEnd}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                style={{ backgroundColor: CASA_BRAND.colors.primary.amber, color: 'white' }}
              >
                {generatingEnd ? <><Loader2 size={14} className="animate-spin" /> Generando...</> : <><Camera size={14} /> Generar "Fin"</>}
              </button>
            )}
          </div>

          {endOptions.length > 0 ? (
            <ImageSelector
              options={endOptions}
              selectedIndex={selectedEnd}
              onSelect={setSelectedEnd}
              onRegenerate={handleGenerateEnd}
              isGenerating={generatingEnd}
              label="imagen final"
            />
          ) : (
            <div className="text-center py-8" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              Genera opciones de imagen final para seleccionar
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
              <img src={`data:image/png;base64,${story.coverImageUrl}`} alt="Portada" className="w-full aspect-[4/3] object-cover" />
              <span className="absolute bottom-1 left-1 text-xs px-1.5 py-0.5 rounded bg-black/50 text-white">Portada</span>
            </div>
          )}
          {story.scenes.slice(0, 2).map(scene => scene.selectedImageUrl && (
            <div key={scene.number} className="relative rounded-lg overflow-hidden">
              <img src={`data:image/png;base64,${scene.selectedImageUrl}`} alt={`Escena ${scene.number}`} className="w-full aspect-[4/3] object-cover" />
              <span className="absolute bottom-1 left-1 text-xs px-1.5 py-0.5 rounded bg-black/50 text-white">Esc. {scene.number}</span>
            </div>
          ))}
          {story.endImageUrl && (
            <div className="relative rounded-lg overflow-hidden">
              <img src={`data:image/png;base64,${story.endImageUrl}`} alt="Fin" className="w-full aspect-[4/3] object-cover" />
              <span className="absolute bottom-1 left-1 text-xs px-1.5 py-0.5 rounded bg-black/50 text-white">Fin</span>
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
            Crear nuevo cuento
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
      {/* Modal de recuperación de borrador */}
      {showRecoveryPrompt && draft && (
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
