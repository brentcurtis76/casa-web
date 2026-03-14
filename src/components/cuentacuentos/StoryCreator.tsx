/**
 * StoryCreator - Componente principal para crear cuentos ilustrados
 * Orquesta todo el flujo de generación de cuentos para niños
 */

import React, { useState } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  BookOpen,
  Wand2,
  Users,
  Image,
  CheckCircle,
  ChevronRight,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import type {
  Story,
  StoryConfigInput,
  StoryCharacter,
  StoryLandmark,
  StoryScene,
  LocationInfo,
  StoryStatus,
  GeneratedStoryContent,
} from '@/types/shared/story';
import { supabase } from '@/integrations/supabase/client';
import StoryConfigForm from './StoryConfigForm';
import ImageSelector from './ImageSelector';
import StoryPreview from './StoryPreview';
import stylesData from '@/data/cuentacuentos/illustration-styles.json';

// Pasos del flujo
type Step = 'config' | 'story' | 'characters' | 'scenes' | 'preview';

interface StepInfo {
  id: Step;
  title: string;
  icon: React.ReactNode;
}

const STEPS: StepInfo[] = [
  { id: 'config', title: 'Configuración', icon: <BookOpen size={18} /> },
  { id: 'story', title: 'Cuento', icon: <Wand2 size={18} /> },
  { id: 'characters', title: 'Personajes', icon: <Users size={18} /> },
  { id: 'scenes', title: 'Escenas', icon: <Image size={18} /> },
  { id: 'preview', title: 'Vista Previa', icon: <CheckCircle size={18} /> },
];

interface StoryCreatorProps {
  onSaveStory?: (story: Story) => void;
  onExportPDF?: (story: Story) => void;
}

const StoryCreator: React.FC<StoryCreatorProps> = ({
  onSaveStory,
  onExportPDF,
}) => {
  // Estado del flujo
  const [currentStep, setCurrentStep] = useState<Step>('config');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado del cuento
  const [story, setStory] = useState<Story | null>(null);
  const [config, setConfig] = useState<StoryConfigInput | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedStoryContent | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);

  // Regeneration loading state
  const [regeneratingCharacterId, setRegeneratingCharacterId] = useState<string | null>(null);
  const [regeneratingSceneNumber, setRegeneratingSceneNumber] = useState<number | null>(null);

  // Obtener índice del paso actual
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  // Manejar envío del formulario de configuración
  const handleConfigSubmit = async (configData: StoryConfigInput) => {
    setConfig(configData);
    setIsLoading(true);
    setError(null);

    try {
      // NOTA: En producción, estas llamadas irían a las rutas API del backend
      // Por ahora, simulamos el flujo para mostrar la estructura

      // 1. Investigar el lugar (llamaría a Claude API)
      console.log('Investigando lugar:', configData.locationName);

      // Simular respuesta de investigación de lugar
      const mockLocationInfo: LocationInfo = {
        name: configData.locationName,
        region: 'Chile',
        type: 'costa',
        description: `${configData.locationName}, un hermoso lugar de Chile con paisajes impresionantes.`,
        visualElements: ['paisaje natural', 'cielo azul', 'vegetación local'],
        colors: ['azul', 'verde', 'dorado'],
        lighting: 'Luz cálida y brillante del día',
      };
      setLocationInfo(mockLocationInfo);

      // 2. Generar el cuento (llamaría a Claude API)
      console.log('Generando cuento con Claude API...');

      // Simular respuesta de generación de cuento
      const mockGeneratedContent: GeneratedStoryContent = {
        title: `La aventura en ${configData.locationName}`,
        summary: 'Un cuento sobre la importancia de la amistad y la fe.',
        characters: configData.characters.map((c, i) => ({
          name: c.name || (i === 0 ? 'Luna' : `Amigo ${i}`),
          role: i === 0 ? 'protagonist' : 'secondary',
          description: c.description,
        })),
        scenes: Array.from({ length: 12 }, (_, i) => ({
          number: i + 1,
          text: `Escena ${i + 1}: Esta es una escena de ejemplo del cuento que se generaría con Claude.`,
          visualDescription: `Escena ${i + 1} del cuento, mostrando a los personajes en ${configData.locationName}.`,
        })),
        spiritualConnection: 'El cuento refleja el amor incondicional que Jesús nos enseña.',
      };
      setGeneratedContent(mockGeneratedContent);

      // 3. Crear estructura inicial del cuento
      const initialStory: Story = {
        id: `story-${Date.now()}`,
        title: mockGeneratedContent.title,
        summary: mockGeneratedContent.summary,
        liturgyTitle: configData.liturgyTitle,
        liturgyReadings: configData.liturgyReadings ? [configData.liturgyReadings] : undefined,
        liturgySummary: configData.liturgySummary,
        location: mockLocationInfo,
        illustrationStyle: configData.illustrationStyleId,
        characters: mockGeneratedContent.characters.map((c, i) => ({
          id: `char-${i}`,
          name: c.name,
          role: c.role,
          description: c.description,
          visualDescription: c.description,
          characterSheetOptions: [],
        })),
        landmarks: (configData.landmarks || []).map((lm, i) => ({
          id: `landmark-${i}`,
          name: lm.name,
          narrativeRole: lm.narrativeRole,
          // TODO: When wired to real API, populate from response.landmarkAnalyses[i].visualDescription
          visualDescription: '',
          referenceImages: lm.referenceImages,
          role: lm.role,
        })),
        scenes: mockGeneratedContent.scenes.map((s) => ({
          number: s.number,
          text: s.text,
          visualDescription: s.visualDescription,
          landmarkVisible: s.landmarkVisible,
          imageOptions: [],
        })),
        spiritualConnection: mockGeneratedContent.spiritualConnection,
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'story-generated',
        },
      };
      setStory(initialStory);

      // Avanzar al siguiente paso
      setCurrentStep('story');
    } catch (err) {
      console.error('Error generando cuento:', err);
      setError('Hubo un error al generar el cuento. Por favor intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar aprobación del cuento escrito
  const handleApproveStory = () => {
    setCurrentStep('characters');
    // Aquí se generarían los character sheets con Imagen 3
  };

  // Manejar selección de character sheet
  const handleSelectCharacterSheet = (characterId: string, imageUrl: string) => {
    if (!story) return;

    setStory({
      ...story,
      characters: story.characters.map((c) =>
        c.id === characterId ? { ...c, characterSheetUrl: imageUrl } : c
      ),
      metadata: { ...story.metadata, updatedAt: new Date().toISOString() },
    });
  };

  // Verificar si todos los personajes tienen imagen seleccionada
  const allCharactersApproved = story?.characters.every((c) => c.characterSheetUrl);

  // Manejar avance a escenas
  const handleProceedToScenes = () => {
    if (!allCharactersApproved) return;
    setCurrentStep('scenes');
    // Aquí se generarían las imágenes de escenas con Imagen 3
  };

  // Manejar selección de imagen de escena
  const handleSelectSceneImage = (sceneNumber: number, imageUrl: string) => {
    if (!story) return;

    setStory({
      ...story,
      scenes: story.scenes.map((s) =>
        s.number === sceneNumber ? { ...s, selectedImageUrl: imageUrl } : s
      ),
      metadata: { ...story.metadata, updatedAt: new Date().toISOString() },
    });
  };

  // Regenerar character sheet con prompt editado
  const handleRegenerateCharacterSheet = async (character: StoryCharacter) => {
    if (!story) return;

    const description = character.editedVisualDescription ?? character.visualDescription;
    if (!description?.trim()) {
      setError('La descripción del personaje no puede estar vacía');
      return;
    }

    setRegeneratingCharacterId(character.id);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-scene-images', {
        body: {
          type: 'character',
          styleId: story.illustrationStyle,
          character: {
            name: character.name,
            description: character.description,
            visualDescription: description,
          },
          count: 4,
        },
      });

      if (fnError) throw fnError;
      if (!data?.success || !data.images?.length) {
        throw new Error(data?.error || 'No se pudieron generar imágenes');
      }

      setStory(prev => prev ? {
        ...prev,
        characters: prev.characters.map(c =>
          c.id === character.id
            ? { ...c, characterSheetOptions: data.images }
            : c
        ),
        metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
      } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error regenerando character sheet');
    } finally {
      setRegeneratingCharacterId(null);
    }
  };

  // Regenerar imagen de escena
  const handleRegenerateSceneImage = async (scene: StoryScene) => {
    if (!story) return;

    if (!scene.visualDescription?.trim()) {
      setError('La descripción visual de la escena no puede estar vacía');
      return;
    }

    setRegeneratingSceneNumber(scene.number);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-scene-images', {
        body: {
          type: 'scene',
          styleId: story.illustrationStyle,
          scene: { text: scene.text, visualDescription: scene.visualDescription },
          characters: story.characters
            .filter(c => c.characterSheetUrl)
            .map(c => ({
              name: c.name,
              visualDescription: c.editedVisualDescription ?? c.visualDescription,
              referenceImage: c.characterSheetUrl,
            })),
          location: story.location,
          count: 4,
        },
      });

      if (fnError) throw fnError;
      if (!data?.success || !data.images?.length) {
        throw new Error(data?.error || 'No se pudieron generar imágenes');
      }

      setStory(prev => prev ? {
        ...prev,
        scenes: prev.scenes.map(s =>
          s.number === scene.number
            ? { ...s, imageOptions: data.images }
            : s
        ),
        metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
      } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error regenerando imagen de escena');
    } finally {
      setRegeneratingSceneNumber(null);
    }
  };

  // Verificar si todas las escenas tienen imagen
  const allScenesComplete = story?.scenes.every((s) => s.selectedImageUrl);

  // Manejar avance a preview
  const handleProceedToPreview = () => {
    if (!allScenesComplete) return;
    setCurrentStep('preview');
    if (story) {
      setStory({
        ...story,
        metadata: { ...story.metadata, status: 'ready', updatedAt: new Date().toISOString() },
      });
    }
  };

  // Manejar guardar cuento — merge edited prompts into visualDescription
  const handleSaveStory = () => {
    if (story && onSaveStory) {
      const storyWithEdits = {
        ...story,
        characters: story.characters.map(c => ({
          ...c,
          visualDescription: c.editedVisualDescription ?? c.visualDescription,
          editedVisualDescription: undefined,
        })),
      };
      onSaveStory(storyWithEdits);
    }
  };

  // Manejar exportar PDF
  const handleExportPDF = () => {
    if (story && onExportPDF) {
      onExportPDF(story);
    }
  };

  // Obtener estilo seleccionado
  const selectedStyle = config?.illustrationStyleId
    ? stylesData.styles.find((s) => s.id === config.illustrationStyleId)
    : null;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;
            const isClickable = isCompleted;

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => isClickable && setCurrentStep(step.id)}
                  disabled={!isClickable}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                    isActive ? 'ring-2 ring-offset-2' : ''
                  } ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                  style={{
                    backgroundColor: isCompleted
                      ? CASA_BRAND.colors.primary.amber
                      : isActive
                      ? CASA_BRAND.colors.amber.light
                      : CASA_BRAND.colors.secondary.grayLight,
                    color: isCompleted || isActive
                      ? CASA_BRAND.colors.primary.black
                      : CASA_BRAND.colors.secondary.grayMedium,
                    ringColor: CASA_BRAND.colors.primary.amber,
                  }}
                >
                  {isCompleted ? <CheckCircle size={18} /> : step.icon}
                  <span
                    className="hidden sm:inline text-sm font-medium"
                    style={{ fontFamily: CASA_BRAND.fonts.body }}
                  >
                    {step.title}
                  </span>
                </button>
                {index < STEPS.length - 1 && (
                  <ChevronRight
                    size={20}
                    className="mx-2"
                    style={{ color: CASA_BRAND.colors.secondary.grayLight }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mb-6 p-4 rounded-lg flex items-start gap-3"
          style={{ backgroundColor: '#FEF2F2' }}
        >
          <AlertCircle size={20} style={{ color: '#EF4444' }} />
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              color: '#B91C1C',
            }}
          >
            {error}
          </p>
        </div>
      )}

      {/* Contenido según el paso */}
      {currentStep === 'config' && (
        <StoryConfigForm onSubmit={handleConfigSubmit} isLoading={isLoading} />
      )}

      {currentStep === 'story' && story && (
        <div className="space-y-6">
          <div
            className="p-6 rounded-lg border"
            style={{
              borderColor: CASA_BRAND.colors.secondary.grayLight,
              backgroundColor: CASA_BRAND.colors.primary.white,
            }}
          >
            <h3
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                fontSize: '24px',
                fontWeight: 300,
                color: CASA_BRAND.colors.primary.black,
              }}
            >
              {story.title}
            </h3>
            <p
              className="mt-2"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {story.summary}
            </p>

            {/* Personajes */}
            <div className="mt-6">
              <h4
                className="mb-3"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  fontWeight: 600,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                Personajes:
              </h4>
              <div className="flex flex-wrap gap-2">
                {story.characters.map((c) => (
                  <span
                    key={c.id}
                    className="px-3 py-1 rounded-full text-sm"
                    style={{
                      backgroundColor:
                        c.role === 'protagonist'
                          ? CASA_BRAND.colors.primary.amber
                          : CASA_BRAND.colors.secondary.grayLight,
                      color:
                        c.role === 'protagonist'
                          ? CASA_BRAND.colors.primary.white
                          : CASA_BRAND.colors.primary.black,
                      fontFamily: CASA_BRAND.fonts.body,
                    }}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Escenas */}
            <div className="mt-6">
              <h4
                className="mb-3"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  fontWeight: 600,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                Escenas ({story.scenes.length}):
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {story.scenes.map((scene) => (
                  <div
                    key={scene.number}
                    className="p-3 rounded-lg"
                    style={{
                      backgroundColor: CASA_BRAND.colors.secondary.grayLight,
                    }}
                  >
                    <span
                      className="font-semibold"
                      style={{
                        fontFamily: CASA_BRAND.fonts.body,
                        fontSize: '13px',
                        color: CASA_BRAND.colors.primary.amber,
                      }}
                    >
                      Escena {scene.number}:
                    </span>
                    <p
                      className="mt-1"
                      style={{
                        fontFamily: CASA_BRAND.fonts.body,
                        fontSize: '14px',
                        color: CASA_BRAND.colors.primary.black,
                      }}
                    >
                      {scene.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Conexión espiritual */}
            <div
              className="mt-6 p-4 rounded-lg"
              style={{
                backgroundColor: `${CASA_BRAND.colors.amber.light}20`,
                borderLeft: `4px solid ${CASA_BRAND.colors.primary.amber}`,
              }}
            >
              <h4
                className="mb-1"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: CASA_BRAND.colors.primary.amber,
                }}
              >
                Conexión Espiritual
              </h4>
              <p
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                {story.spiritualConnection}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setCurrentStep('config')}
              className="px-4 py-2 rounded-lg"
              style={{
                border: `1px solid ${CASA_BRAND.colors.secondary.grayLight}`,
                color: CASA_BRAND.colors.secondary.grayDark,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Volver a editar
            </button>
            <button
              onClick={handleApproveStory}
              className="flex items-center gap-2 px-6 py-2 rounded-full font-semibold"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.amber,
                color: CASA_BRAND.colors.primary.white,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Aprobar y continuar
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {currentStep === 'characters' && story && (
        <div className="space-y-6">
          <div className="mb-4">
            <h3
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                fontSize: '24px',
                fontWeight: 300,
                color: CASA_BRAND.colors.primary.black,
              }}
            >
              Aprobación de Personajes
            </h3>
            <p
              className="mt-1"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              Selecciona la mejor imagen para cada personaje
            </p>
          </div>

          <div className="space-y-6">
            {story.characters.map((character) => {
              const currentPrompt = character.editedVisualDescription ?? character.visualDescription;
              const isModified = character.editedVisualDescription !== undefined && character.editedVisualDescription !== character.visualDescription;

              return (
                <div key={character.id} className="space-y-3">
                  {/* Character header with role badge */}
                  <div className="flex items-center gap-2">
                    <h4
                      style={{
                        fontFamily: CASA_BRAND.fonts.body,
                        fontSize: '14px',
                        fontWeight: 600,
                        color: CASA_BRAND.colors.primary.black,
                      }}
                    >
                      {character.name}
                    </h4>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs"
                      style={{
                        backgroundColor: character.role === 'protagonist'
                          ? `${CASA_BRAND.colors.primary.amber}20`
                          : `${CASA_BRAND.colors.secondary.grayLight}`,
                        color: character.role === 'protagonist'
                          ? CASA_BRAND.colors.primary.amber
                          : CASA_BRAND.colors.secondary.grayDark,
                        fontFamily: CASA_BRAND.fonts.body,
                      }}
                    >
                      {character.role === 'protagonist' ? 'Protagonista' : 'Secundario'}
                    </span>
                  </div>

                  {/* Editable description textarea */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        className="text-xs"
                        style={{
                          color: CASA_BRAND.colors.secondary.grayMedium,
                          fontFamily: CASA_BRAND.fonts.body,
                        }}
                      >
                        Descripción visual (prompt para generación)
                      </label>
                      {isModified && (
                        <button
                          type="button"
                          onClick={() =>
                            setStory(prev => prev ? {
                              ...prev,
                              characters: prev.characters.map(c =>
                                c.id === character.id ? { ...c, editedVisualDescription: undefined } : c
                              ),
                            } : prev)
                          }
                          className="flex items-center gap-1 text-xs hover:underline"
                          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                        >
                          <RotateCcw size={12} />
                          Restaurar original
                        </button>
                      )}
                    </div>
                    <textarea
                      value={currentPrompt}
                      onChange={(e) =>
                        setStory(prev => prev ? {
                          ...prev,
                          characters: prev.characters.map(c =>
                            c.id === character.id ? { ...c, editedVisualDescription: e.target.value } : c
                          ),
                        } : prev)
                      }
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2"
                      style={{
                        borderColor: isModified
                          ? CASA_BRAND.colors.primary.amber
                          : CASA_BRAND.colors.secondary.grayLight,
                        fontFamily: CASA_BRAND.fonts.body,
                        fontSize: '13px',
                        lineHeight: 1.5,
                        ringColor: CASA_BRAND.colors.primary.amber,
                      }}
                      placeholder="Descripción visual del personaje..."
                    />
                  </div>

                  {/* Image selector */}
                  <ImageSelector
                    title={character.name}
                    imageOptions={character.characterSheetOptions || []}
                    selectedImageUrl={character.characterSheetUrl || null}
                    onSelect={(url) => handleSelectCharacterSheet(character.id, url)}
                    onRegenerate={currentPrompt?.trim() ? () => handleRegenerateCharacterSheet(character) : undefined}
                    isRegenerating={regeneratingCharacterId === character.id}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setCurrentStep('story')}
              className="px-4 py-2 rounded-lg"
              style={{
                border: `1px solid ${CASA_BRAND.colors.secondary.grayLight}`,
                color: CASA_BRAND.colors.secondary.grayDark,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Volver
            </button>
            <button
              onClick={handleProceedToScenes}
              disabled={!allCharactersApproved}
              className="flex items-center gap-2 px-6 py-2 rounded-full font-semibold disabled:opacity-50"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.amber,
                color: CASA_BRAND.colors.primary.white,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Continuar a escenas
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {currentStep === 'scenes' && story && (
        <div className="space-y-6">
          <div className="mb-4">
            <h3
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                fontSize: '24px',
                fontWeight: 300,
                color: CASA_BRAND.colors.primary.black,
              }}
            >
              Selección de Escenas
            </h3>
            <p
              className="mt-1"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              Selecciona la mejor imagen para cada escena del cuento
            </p>
          </div>

          <div className="space-y-6">
            {story.scenes.map((scene) => (
              <ImageSelector
                key={scene.number}
                title={`Escena ${scene.number}`}
                subtitle={scene.text}
                imageOptions={scene.imageOptions || []}
                selectedImageUrl={scene.selectedImageUrl || null}
                onSelect={(url) => handleSelectSceneImage(scene.number, url)}
                onRegenerate={() => handleRegenerateSceneImage(scene)}
                isRegenerating={regeneratingSceneNumber === scene.number}
              />
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setCurrentStep('characters')}
              className="px-4 py-2 rounded-lg"
              style={{
                border: `1px solid ${CASA_BRAND.colors.secondary.grayLight}`,
                color: CASA_BRAND.colors.secondary.grayDark,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Volver
            </button>
            <button
              onClick={handleProceedToPreview}
              disabled={!allScenesComplete}
              className="flex items-center gap-2 px-6 py-2 rounded-full font-semibold disabled:opacity-50"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.amber,
                color: CASA_BRAND.colors.primary.white,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Ver vista previa
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {currentStep === 'preview' && story && (
        <div className="space-y-6">
          <StoryPreview story={story} onExportPDF={handleExportPDF} />

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setCurrentStep('scenes')}
              className="px-4 py-2 rounded-lg"
              style={{
                border: `1px solid ${CASA_BRAND.colors.secondary.grayLight}`,
                color: CASA_BRAND.colors.secondary.grayDark,
                fontFamily: CASA_BRAND.fonts.body,
              }}
            >
              Volver a editar
            </button>
            {onSaveStory && (
              <button
                onClick={handleSaveStory}
                className="flex items-center gap-2 px-6 py-2 rounded-full font-semibold"
                style={{
                  backgroundColor: CASA_BRAND.colors.primary.amber,
                  color: CASA_BRAND.colors.primary.white,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                <CheckCircle size={18} />
                Guardar Cuento
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryCreator;
