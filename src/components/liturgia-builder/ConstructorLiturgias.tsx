/**
 * ConstructorLiturgias - Orquestador principal del sistema de liturgias CASA
 * Gestiona los 18 elementos de una liturgia completa
 * Actualizado: Nueva estructura de elementos y editores
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Check,
  Download,
  Save,
  FileText,
  Music,
  MessageCircle,
  Image as ImageIcon,
  Hand,
  Megaphone,
  Settings,
  Eye,
  Loader2,
  Circle,
  SkipForward,
  Heart,
  Cross,
  Gift,
  Sparkles,
  HeartHandshake,
  Sun,
  Users,
  Flame,
  Baby,
  Church,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type {
  Liturgy,
  LiturgyContext,
  LiturgyElement,
  LiturgyElementType,
  LiturgyElementStatus,
  LiturgyContextInput,
  AnnouncementConfig,
  PortadasConfig,
  LITURGY_ORDER,
  LiturgyOrderElement,
} from '@/types/shared/liturgy';
import type { SlideGroup } from '@/types/shared/slide';
import type { Song } from '@/types/shared/song';
import type { Story } from '@/types/shared/story';
import ContextoTransversal from './ContextoTransversal';
import Portadas, { DEFAULT_PORTADAS_CONFIG } from './Portadas';
import Anuncios from './Anuncios';
import {
  OracionEditor,
  CancionSelector,
  LecturaBiblicaEditor,
  CuentacuentoEditor,
  ElementoFijoEditor,
} from './editors';
import { fixedElementToSlides } from '@/lib/fixedElementToSlides';
import type { FixedElement } from '@/types/shared/fixed-elements';
import VistaPrevia from './VistaPrevia';
import ExportPanel from './ExportPanel';

/**
 * Definición del orden de la liturgia CASA (18 elementos)
 * Incluye iconos, descripciones y configuración de editores
 */
const LITURGY_ELEMENTS: {
  type: LiturgyElementType;
  label: string;
  icon: React.ReactNode;
  description: string;
  required: boolean;
  category: 'portada' | 'oracion' | 'cancion' | 'lectura' | 'fijo' | 'otro';
  defaultTempo?: 'lenta' | 'intermedia' | 'rápida';
  fixedElementFile?: string;
}[] = [
  // 1. Portada Principal
  {
    type: 'portada-principal',
    label: 'Portada Principal',
    icon: <ImageIcon size={18} />,
    description: 'Slide de apertura del culto',
    required: true,
    category: 'portada',
  },
  // 2. Oración de Invocación
  {
    type: 'oracion-invocacion',
    label: 'Oración de Invocación',
    icon: <Sparkles size={18} />,
    description: 'Oración de apertura (IA o manual)',
    required: true,
    category: 'oracion',
  },
  // 3. Primera canción - Invocación
  {
    type: 'cancion-invocacion',
    label: 'Primera canción - Invocación',
    icon: <Music size={18} />,
    description: 'Canción de apertura (tempo rápido)',
    required: true,
    category: 'cancion',
    defaultTempo: 'rápida',
  },
  // 4. Oración de Arrepentimiento
  {
    type: 'oracion-arrepentimiento',
    label: 'Oración de Arrepentimiento',
    icon: <Flame size={18} />,
    description: 'Oración de confesión (IA o manual)',
    required: true,
    category: 'oracion',
  },
  // 5. Segunda canción - Arrepentimiento
  {
    type: 'cancion-arrepentimiento',
    label: 'Segunda canción - Arrepentimiento',
    icon: <Music size={18} />,
    description: 'Canción de reflexión (tempo intermedio)',
    required: true,
    category: 'cancion',
    defaultTempo: 'intermedia',
  },
  // 6. Oración de Gratitud
  {
    type: 'oracion-gratitud',
    label: 'Oración de Gratitud',
    icon: <Sun size={18} />,
    description: 'Oración de acción de gracias (IA o manual)',
    required: true,
    category: 'oracion',
  },
  // 7. Tercera canción - Gratitud
  {
    type: 'cancion-gratitud',
    label: 'Tercera canción - Gratitud',
    icon: <Music size={18} />,
    description: 'Canción de gratitud (tempo lento)',
    required: true,
    category: 'cancion',
    defaultTempo: 'lenta',
  },
  // 8. Lectura Bíblica
  {
    type: 'lectura-biblica',
    label: 'Lectura Bíblica',
    icon: <BookOpen size={18} />,
    description: 'Pasajes del día desde el contexto',
    required: true,
    category: 'lectura',
  },
  // 9. Cuentacuento
  {
    type: 'cuentacuentos',
    label: 'Cuentacuento',
    icon: <Baby size={18} />,
    description: 'Historia para niños (opcional)',
    required: false,
    category: 'otro',
  },
  // 10. Portada de Reflexión
  {
    type: 'portada-reflexion',
    label: 'Portada de Reflexión',
    icon: <Church size={18} />,
    description: 'Transición a la reflexión',
    required: true,
    category: 'portada',
  },
  // 11. Padre Nuestro
  {
    type: 'padre-nuestro',
    label: 'Padre Nuestro',
    icon: <Hand size={18} />,
    description: 'Oración comunitaria',
    required: true,
    category: 'fijo',
    fixedElementFile: 'padre-nuestro.json',
  },
  // 12. La Paz
  {
    type: 'paz',
    label: 'La Paz',
    icon: <HeartHandshake size={18} />,
    description: 'Momento de compartir la paz',
    required: true,
    category: 'fijo',
    fixedElementFile: 'la-paz.json',
  },
  // 13. Santa Cena
  {
    type: 'santa-cena',
    label: 'Santa Cena',
    icon: <Cross size={18} />,
    description: 'Liturgia de la Santa Cena',
    required: true,
    category: 'fijo',
    fixedElementFile: 'santa-cena.json',
  },
  // 14. Acción de Gracias
  {
    type: 'accion-gracias',
    label: 'Acción de Gracias',
    icon: <Users size={18} />,
    description: 'Oración de acción de gracias eucarística',
    required: true,
    category: 'fijo',
    fixedElementFile: 'accion-de-gracias.json',
  },
  // 15. Cuarta canción - Santa Cena
  {
    type: 'cancion-santa-cena',
    label: 'Cuarta canción - Santa Cena',
    icon: <Music size={18} />,
    description: 'Canción de comunión (tempo lento)',
    required: true,
    category: 'cancion',
    defaultTempo: 'lenta',
  },
  // 16. Ofrenda
  {
    type: 'ofrenda',
    label: 'Ofrenda',
    icon: <Gift size={18} />,
    description: 'Momento de la ofrenda',
    required: true,
    category: 'fijo',
    fixedElementFile: 'ofrenda.json',
  },
  // 17. Anuncios
  {
    type: 'anuncios',
    label: 'Anuncios',
    icon: <Megaphone size={18} />,
    description: 'Noticias de la comunidad (opcional)',
    required: false,
    category: 'otro',
  },
  // 18. Bendición Final
  {
    type: 'bendicion',
    label: 'Bendición Final',
    icon: <Hand size={18} />,
    description: 'Bendición de despedida',
    required: true,
    category: 'fijo',
    fixedElementFile: 'bendicion-final.json',
  },
];

type WorkflowStep = 'contexto' | 'elementos' | 'preview' | 'export';

interface ConstructorLiturgiasProps {
  onSave?: (liturgy: Liturgy, portadaImage?: string | null, portadasConfig?: PortadasConfig) => void | Promise<void>;
  onDirtyChange?: (isDirty: boolean) => void;
  initialLiturgy?: Liturgy;
  initialPortadaImage?: string | null;
  initialPortadasConfig?: PortadasConfig;
}

/**
 * Componente indicador de estado del elemento
 */
const ElementStatusIndicator: React.FC<{ status: LiturgyElementStatus }> = ({ status }) => {
  const statusConfig = {
    pending: {
      icon: <Circle size={12} />,
      color: CASA_BRAND.colors.secondary.grayMedium,
      label: 'Pendiente',
    },
    in_progress: {
      icon: <Loader2 size={12} className="animate-spin" />,
      color: CASA_BRAND.colors.primary.amber,
      label: 'En progreso',
    },
    completed: {
      icon: <Check size={12} />,
      color: CASA_BRAND.colors.primary.amber,
      label: 'Completado',
    },
    skipped: {
      icon: <SkipForward size={12} />,
      color: CASA_BRAND.colors.secondary.grayLight,
      label: 'Omitido',
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className="flex items-center justify-center w-6 h-6 rounded-full"
      style={{ backgroundColor: `${config.color}20`, color: config.color }}
      title={config.label}
    >
      {config.icon}
    </span>
  );
};

const ConstructorLiturgias: React.FC<ConstructorLiturgiasProps> = ({
  onSave,
  onDirtyChange,
  initialLiturgy,
  initialPortadaImage,
  initialPortadasConfig,
}) => {
  // Workflow state
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('contexto');
  const [liturgyContext, setLiturgyContext] = useState<LiturgyContext | null>(
    initialLiturgy?.context || null
  );

  // Elements state - usando Map para acceso rápido
  const [elements, setElements] = useState<Map<LiturgyElementType, LiturgyElement>>(
    new Map(initialLiturgy?.elements.map((e) => [e.type, e]) || [])
  );
  const [selectedElement, setSelectedElement] = useState<LiturgyElementType | null>(null);
  // Initialize announcements from loaded liturgy if available
  const initialAnnouncements = React.useMemo(() => {
    const anunciosElement = initialLiturgy?.elements.find(e => e.type === 'anuncios');
    if (anunciosElement?.config && 'announcementConfigs' in anunciosElement.config) {
      return anunciosElement.config.announcementConfigs as AnnouncementConfig[];
    }
    return [];
  }, [initialLiturgy]);

  const [announcements, setAnnouncementsState] = useState<AnnouncementConfig[]>(initialAnnouncements);

  // Handler para actualizar anuncios y también el elemento de liturgia
  const setAnnouncements = useCallback((newAnnouncements: AnnouncementConfig[] | ((prev: AnnouncementConfig[]) => AnnouncementConfig[])) => {
    setAnnouncementsState((prev) => {
      const updated = typeof newAnnouncements === 'function' ? newAnnouncements(prev) : newAnnouncements;

      // Actualizar el elemento de anuncios con el nuevo config
      setElements((prevElements) => {
        const existingElement = prevElements.get('anuncios');
        if (existingElement || updated.length > 0) {
          const newElement: LiturgyElement = {
            id: existingElement?.id || uuidv4(),
            type: 'anuncios',
            order: LITURGY_ELEMENTS.findIndex((e) => e.type === 'anuncios'),
            title: 'Anuncios',
            status: updated.length > 0 ? 'completed' : 'pending',
            slides: existingElement?.slides,
            config: { announcementConfigs: updated },
          };
          const newElements = new Map(prevElements);
          newElements.set('anuncios', newElement);
          return newElements;
        }
        return prevElements;
      });
      setIsDirty(true);

      return updated;
    });
  }, []);

  // Shared illustration state for portadas
  const [sharedIllustration, setSharedIllustration] = useState<string | null>(
    initialPortadaImage || null
  );

  // Portadas configuration
  const [portadasConfig, setPortadasConfig] = useState<PortadasConfig>(
    initialPortadasConfig || DEFAULT_PORTADAS_CONFIG
  );

  // Loading states
  const [isSaving, setIsSaving] = useState(false);

  // Dirty state tracking
  const [isDirty, setIsDirty] = useState(false);

  // Pending context changes from the form (not yet saved via "Continuar")
  const [pendingContextChanges, setPendingContextChanges] = useState<LiturgyContextInput | null>(null);

  // Element order state - orden personalizado de la liturgia
  const [elementOrder, setElementOrder] = useState<LiturgyElementType[]>(
    initialLiturgy?.elements
      ? initialLiturgy.elements.sort((a, b) => a.order - b.order).map((e) => e.type)
      : LITURGY_ELEMENTS.map((e) => e.type)
  );

  // Handler for element order changes
  const handleOrderChange = useCallback((newOrder: LiturgyElementType[]) => {
    setElementOrder(newOrder);
    // Actualizar el orden en los elementos
    setElements((prev) => {
      const newMap = new Map(prev);
      newOrder.forEach((type, index) => {
        const element = newMap.get(type);
        if (element) {
          newMap.set(type, { ...element, order: index });
        }
      });
      return newMap;
    });
    setIsDirty(true);
  }, []);

  // Notify parent when dirty state changes
  React.useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Sincronizar context y elements cuando se carga una liturgia existente
  // IMPORTANTE: Solo sincronizar cuando cambie el ID de la liturgia, no cuando cambie el contenido
  // Esto evita sobrescribir los cambios que el usuario ha hecho
  const initialLiturgyId = initialLiturgy?.id;
  useEffect(() => {
    if (initialLiturgy?.context && initialLiturgyId) {
      console.log('[ConstructorLiturgias] Syncing context for liturgy:', initialLiturgyId);
      setLiturgyContext(initialLiturgy.context);
    }
    if (initialLiturgy?.elements && initialLiturgyId) {
      console.log('[ConstructorLiturgias] Syncing elements for liturgy:', initialLiturgyId);
      setElements(new Map(initialLiturgy.elements.map((e) => [e.type, e])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLiturgyId]); // Solo depende del ID, no del contenido completo

  // Handler for illustration changes
  const handleIllustrationChange = useCallback((illustration: string | null) => {
    setSharedIllustration(illustration);
    setIsDirty(true);
  }, []);

  // Handler for portadas config changes
  const handlePortadasConfigChange = useCallback((config: PortadasConfig) => {
    setPortadasConfig(config);
    setIsDirty(true);
  }, []);

  // Handle context save
  const handleContextSave = (input: LiturgyContextInput) => {
    console.log('[handleContextSave] Input received:', {
      date: input.date,
      dateType: typeof input.date,
      dateISO: input.date instanceof Date ? input.date.toISOString() : input.date
    });

    const context: LiturgyContext = {
      id: liturgyContext?.id || uuidv4(),
      date: input.date,
      title: input.title,
      summary: input.summary,
      readings: input.readings.map((r) => ({
        reference: r.reference,
        text: r.text || '',
        version: r.version || 'NVI',
        versionCode: r.version || 'NVI',
      })),
      celebrant: input.celebrant,
      preacher: input.preacher,
      createdAt: liturgyContext?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('[handleContextSave] Context created:', {
      contextDate: context.date,
      contextDateISO: context.date instanceof Date ? context.date.toISOString() : context.date
    });

    setLiturgyContext(context);
    setPendingContextChanges(null); // Limpiar cambios pendientes ya que se han aplicado
    setIsDirty(true);
    setCurrentStep('elementos');
  };

  // Handle element slides generated
  const handleElementSlides = useCallback((
    elementType: LiturgyElementType,
    slides: SlideGroup,
    additionalData?: {
      sourceId?: string;
      sourceTitle?: string;
      customContent?: string;
      editedSlides?: SlideGroup;
      storyData?: Story;
      announcementConfigs?: AnnouncementConfig[];
    }
  ) => {
    console.log('[handleElementSlides] Called with:', { elementType, additionalData });

    const elementDef = LITURGY_ELEMENTS.find((e) => e.type === elementType);
    if (!elementDef) return;

    const existingElement = elements.get(elementType);

    // Build config object based on element type
    let config: LiturgyElement['config'] = existingElement?.config;
    if (additionalData?.storyData) {
      config = { storyData: additionalData.storyData };
    } else if (additionalData?.announcementConfigs) {
      config = { announcementConfigs: additionalData.announcementConfigs };
    }

    const element: LiturgyElement = {
      id: existingElement?.id || uuidv4(),
      type: elementType,
      order: LITURGY_ELEMENTS.findIndex((e) => e.type === elementType),
      title: additionalData?.sourceTitle || elementDef.label,
      status: 'completed',
      slides,
      sourceId: additionalData?.sourceId,
      customContent: additionalData?.customContent,
      editedSlides: additionalData?.editedSlides,
      config,
    };

    console.log('[handleElementSlides] Saving element:', { type: element.type, sourceId: element.sourceId, hasConfig: !!config });
    setElements((prev) => new Map(prev).set(elementType, element));
    setIsDirty(true);
  }, [elements]);

  // Get element status - verifica completitud real según tipo de elemento
  const getElementStatus = (type: LiturgyElementType): LiturgyElementStatus => {
    const element = elements.get(type);
    if (!element) return 'pending';
    if (element.status === 'skipped') return 'skipped';

    // Verificar completitud real según tipo de elemento
    const def = LITURGY_ELEMENTS.find((e) => e.type === type);

    // Para canciones: debe tener sourceId (canción seleccionada)
    if (def?.category === 'cancion') {
      return element.sourceId ? 'completed' : 'pending';
    }

    // Para cuentacuentos: debe tener storyData en config
    if (type === 'cuentacuentos') {
      return element.config?.storyData ? 'completed' : 'pending';
    }

    // Para anuncios: debe tener announcementConfigs con al menos un anuncio
    if (type === 'anuncios') {
      const configs = element.config?.announcementConfigs;
      return Array.isArray(configs) && configs.length > 0 ? 'completed' : 'pending';
    }

    // Para otros elementos, verificar slides
    return element.slides ? 'completed' : 'pending';
  };

  // Skip optional element
  const handleSkipElement = useCallback((elementType: LiturgyElementType) => {
    const elementDef = LITURGY_ELEMENTS.find((e) => e.type === elementType);
    if (!elementDef || elementDef.required) return;

    const element: LiturgyElement = {
      id: elements.get(elementType)?.id || uuidv4(),
      type: elementType,
      order: LITURGY_ELEMENTS.findIndex((e) => e.type === elementType),
      title: elementDef.label,
      status: 'skipped',
    };

    setElements((prev) => new Map(prev).set(elementType, element));
    setIsDirty(true);
  }, [elements]);

  // Confirmar elemento fijo automáticamente (sin abrir editor)
  const handleConfirmFixedElement = useCallback(async (elementType: LiturgyElementType) => {
    const elementDef = LITURGY_ELEMENTS.find((e) => e.type === elementType);
    if (!elementDef || elementDef.category !== 'fijo' || !elementDef.fixedElementFile) return;

    try {
      // Cargar el JSON del elemento fijo
      const response = await fetch(`/data/elementos-fijos/${elementDef.fixedElementFile}`);
      if (!response.ok) throw new Error('No se pudo cargar el elemento');

      const fixedElement: FixedElement = await response.json();
      const slides = fixedElementToSlides(fixedElement);

      // Crear el elemento y guardarlo
      const element: LiturgyElement = {
        id: elements.get(elementType)?.id || uuidv4(),
        type: elementType,
        order: LITURGY_ELEMENTS.findIndex((e) => e.type === elementType),
        title: elementDef.label,
        status: 'completed',
        slides,
      };

      setElements((prev) => new Map(prev).set(elementType, element));
      setIsDirty(true);
    } catch (error) {
      console.error('Error al confirmar elemento fijo:', error);
    }
  }, [elements]);

  // Calculate completion percentage - usando getElementStatus para consistencia
  const completionStats = useMemo(() => {
    const requiredElements = LITURGY_ELEMENTS.filter((e) => e.required);
    const completedRequired = requiredElements.filter(
      (e) => getElementStatus(e.type) === 'completed'
    );

    const optionalElements = LITURGY_ELEMENTS.filter((e) => !e.required);
    const completedOrSkippedOptional = optionalElements.filter((e) => {
      const status = getElementStatus(e.type);
      return status === 'completed' || status === 'skipped';
    });

    // Total completado = requeridos completados + opcionales completados o skipped
    const totalDone = completedRequired.length + completedOrSkippedOptional.length;
    const totalElements = LITURGY_ELEMENTS.length; // 18

    return {
      requiredCompleted: completedRequired.length,
      requiredTotal: requiredElements.length,
      optionalDone: completedOrSkippedOptional.length,
      optionalTotal: optionalElements.length,
      percentage: Math.round((totalDone / totalElements) * 100),
    };
  }, [elements]);

  // Build final liturgy
  const buildLiturgy = (): Liturgy => {
    // Si estamos en el paso de contexto y hay cambios pendientes, usarlos
    // Esto asegura que el botón "Guardar" capture los cambios aunque el usuario
    // no haya hecho clic en "Continuar"
    let contextToUse = liturgyContext;

    if (currentStep === 'contexto' && pendingContextChanges) {
      console.log('[buildLiturgy] Using pending context changes from form');
      contextToUse = {
        id: liturgyContext?.id || uuidv4(),
        date: pendingContextChanges.date,
        title: pendingContextChanges.title,
        summary: pendingContextChanges.summary,
        readings: pendingContextChanges.readings.map((r) => ({
          reference: r.reference,
          text: r.text || '',
          version: r.version || 'NVI',
          versionCode: r.version || 'NVI',
        })),
        celebrant: pendingContextChanges.celebrant,
        preacher: pendingContextChanges.preacher,
        createdAt: liturgyContext?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    if (!contextToUse) throw new Error('No context');

    console.log('[buildLiturgy] contextToUse.date:', {
      date: contextToUse.date,
      dateType: typeof contextToUse.date,
      dateISO: contextToUse.date instanceof Date ? contextToUse.date.toISOString() : contextToUse.date
    });

    const sortedElements = Array.from(elements.values())
      .filter((e) => e.status !== 'skipped')
      .sort((a, b) => a.order - b.order);

    return {
      id: initialLiturgy?.id || uuidv4(),
      context: contextToUse,
      elements: sortedElements,
      status: completionStats.percentage === 100 ? 'ready' : 'in-progress',
      metadata: {
        createdAt: initialLiturgy?.metadata.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  };

  // Handle save
  const handleSave = async () => {
    // Permitir guardar si hay liturgyContext O si hay cambios pendientes válidos
    if (!liturgyContext && !pendingContextChanges) return;

    setIsSaving(true);
    try {
      const liturgy = buildLiturgy();
      // Await the onSave callback to ensure the save completes before marking as not dirty
      await onSave?.(liturgy, sharedIllustration, portadasConfig);
      setIsDirty(false);
    } catch (error) {
      console.error('[ConstructorLiturgias] Error saving:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Render element editor based on type
  const renderElementEditor = () => {
    if (!selectedElement || !liturgyContext) return null;

    const elementDef = LITURGY_ELEMENTS.find((e) => e.type === selectedElement);
    if (!elementDef) return null;

    const existingElement = elements.get(selectedElement);

    // Portadas
    if (selectedElement === 'portada-principal' || selectedElement === 'portada-reflexion') {
      return (
        <Portadas
          context={liturgyContext}
          sharedIllustration={sharedIllustration}
          onIllustrationChange={handleIllustrationChange}
          portadasConfig={portadasConfig}
          onConfigChange={handlePortadasConfigChange}
          onSlidesGenerated={(mainSlides, reflectionSlides) => {
            handleElementSlides('portada-principal', mainSlides);
            handleElementSlides('portada-reflexion', reflectionSlides);
          }}
        />
      );
    }

    // Oraciones (Invocación, Arrepentimiento, Gratitud)
    if (elementDef.category === 'oracion') {
      return (
        <OracionEditor
          context={liturgyContext}
          elementType={selectedElement as 'oracion-invocacion' | 'oracion-arrepentimiento' | 'oracion-gratitud'}
          initialContent={existingElement?.customContent}
          initialSlides={existingElement?.slides}
          onSlidesGenerated={(slides) => {
            handleElementSlides(selectedElement, slides);
          }}
          onContentChange={(content) => {
            // Guardar contenido para regenerar después si es necesario
          }}
        />
      );
    }

    // Canciones
    if (elementDef.category === 'cancion') {
      console.log('[ConstructorLiturgias] Rendering CancionSelector:', {
        selectedElement,
        existingElement: existingElement ? { id: existingElement.id, sourceId: existingElement.sourceId } : null
      });
      return (
        <CancionSelector
          key={selectedElement}
          elementType={selectedElement as 'cancion-invocacion' | 'cancion-arrepentimiento' | 'cancion-gratitud' | 'cancion-santa-cena'}
          selectedSongId={existingElement?.sourceId}
          onSongSelected={(song: Song, slides: SlideGroup) => {
            console.log('[ConstructorLiturgias] Song selected:', { songId: song.id, songTitle: song.title });
            handleElementSlides(selectedElement, slides, { sourceId: song.id, sourceTitle: song.title });
          }}
        />
      );
    }

    // Lectura Bíblica
    if (selectedElement === 'lectura-biblica') {
      return (
        <LecturaBiblicaEditor
          context={liturgyContext}
          initialSlides={existingElement?.slides}
          onSlidesGenerated={(slides) => {
            handleElementSlides('lectura-biblica', slides);
          }}
        />
      );
    }

    // Cuentacuento
    if (selectedElement === 'cuentacuentos') {
      // Recuperar el Story guardado en config
      const savedStory = existingElement?.config?.storyData as Story | undefined;
      return (
        <CuentacuentoEditor
          context={liturgyContext}
          initialStory={savedStory}
          initialSlides={existingElement?.slides}
          onStoryCreated={(story: Story, slides: SlideGroup) => {
            handleElementSlides('cuentacuentos', slides, { sourceId: story.id, storyData: story });
          }}
        />
      );
    }

    // Elementos Fijos
    if (elementDef.category === 'fijo' && elementDef.fixedElementFile) {
      return (
        <ElementoFijoEditor
          elementType={selectedElement as 'padre-nuestro' | 'paz' | 'santa-cena' | 'accion-gracias' | 'ofrenda' | 'bendicion'}
          fixedElementFile={elementDef.fixedElementFile}
          initialSlides={existingElement?.slides}
          editedSlides={existingElement?.editedSlides}
          onSlidesGenerated={(slides, isEdited) => {
            handleElementSlides(selectedElement, slides, {
              editedSlides: isEdited ? slides : undefined,
            });
          }}
        />
      );
    }

    // Anuncios
    if (selectedElement === 'anuncios') {
      return (
        <Anuncios
          announcements={announcements}
          onChange={setAnnouncements}
          onSlidesGenerated={(slides) => handleElementSlides('anuncios', slides, { announcementConfigs: announcements })}
        />
      );
    }

    // Placeholder para elementos no implementados
    return (
      <div className="text-center py-12">
        <Settings
          size={48}
          className="mx-auto mb-4"
          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
        />
        <h4
          style={{
            fontFamily: CASA_BRAND.fonts.heading,
            fontSize: '18px',
            color: CASA_BRAND.colors.primary.black,
            marginBottom: '8px',
          }}
        >
          {elementDef.label}
        </h4>
        <p
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          {elementDef.description}
        </p>
        <p
          className="mt-4"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '13px',
            color: CASA_BRAND.colors.secondary.grayLight,
          }}
        >
          Editor en desarrollo...
        </p>
      </div>
    );
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'contexto':
        return (
          <ContextoTransversal
            initialContext={liturgyContext || undefined}
            onSave={handleContextSave}
            onFormChange={setPendingContextChanges}
          />
        );

      case 'elementos':
        return (
          <div className="grid grid-cols-12 gap-6">
            {/* Element List - Left Panel */}
            <div className="col-span-4 space-y-2">
              <div className="flex items-center justify-between mb-4">
                <h3
                  style={{
                    fontFamily: CASA_BRAND.fonts.heading,
                    fontSize: '18px',
                    fontWeight: 400,
                    color: CASA_BRAND.colors.primary.black,
                  }}
                >
                  Elementos de la Liturgia
                </h3>
                <span
                  className="text-sm"
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    color: CASA_BRAND.colors.secondary.grayMedium,
                  }}
                >
                  {completionStats.requiredCompleted}/{completionStats.requiredTotal} requeridos
                </span>
              </div>

              <div
                className="space-y-1 max-h-[500px] overflow-y-auto pr-2"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: `${CASA_BRAND.colors.secondary.grayLight} transparent`,
                }}
              >
                {LITURGY_ELEMENTS.map((element, index) => {
                  const status = getElementStatus(element.type);
                  const isSelected = selectedElement === element.type;
                  const isFixedElement = element.category === 'fijo';
                  const canQuickConfirm = isFixedElement && status === 'pending';

                  return (
                    <div key={element.type} className="flex items-center gap-2">
                      <div
                        className={`flex-1 p-3 rounded-lg text-left transition-all flex items-center gap-3 ${
                          isSelected ? 'ring-2 ring-offset-1' : ''
                        }`}
                        style={{
                          backgroundColor: isSelected
                            ? `${CASA_BRAND.colors.amber.light}20`
                            : status === 'completed'
                              ? `${CASA_BRAND.colors.amber.light}10`
                              : CASA_BRAND.colors.primary.white,
                          borderWidth: 1,
                          borderColor: isSelected
                            ? CASA_BRAND.colors.primary.amber
                            : CASA_BRAND.colors.secondary.grayLight,
                          ringColor: CASA_BRAND.colors.primary.amber,
                        }}
                      >
                        {/* Status indicator - clickeable para elementos fijos */}
                        {canQuickConfirm ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmFixedElement(element.type);
                            }}
                            className="hover:scale-110 transition-transform"
                            title="Clic para confirmar"
                          >
                            <ElementStatusIndicator status={status} />
                          </button>
                        ) : (
                          <ElementStatusIndicator status={status} />
                        )}

                        {/* Icon and Label - clickeable para abrir editor */}
                        <button
                          type="button"
                          onClick={() => setSelectedElement(element.type)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              style={{
                                color:
                                  status === 'completed'
                                    ? CASA_BRAND.colors.primary.amber
                                    : CASA_BRAND.colors.secondary.grayMedium,
                              }}
                            >
                              {element.icon}
                            </span>
                            <span
                              className="truncate"
                              style={{
                                fontFamily: CASA_BRAND.fonts.body,
                                fontSize: '13px',
                                fontWeight: 500,
                                color: CASA_BRAND.colors.primary.black,
                              }}
                            >
                              {element.label}
                            </span>
                          </div>
                          {!element.required && (
                            <span
                              className="text-xs"
                              style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                            >
                              Opcional
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Skip button for optional elements */}
                      {!element.required && status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleSkipElement(element.type)}
                          className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                          title="Omitir"
                          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                        >
                          <SkipForward size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Element Editor - Right Panel */}
            <div className="col-span-8">
              {selectedElement && liturgyContext ? (
                <div
                  className="p-6 rounded-xl border min-h-[400px]"
                  style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                >
                  {renderElementEditor()}
                </div>
              ) : (
                <div
                  className="h-full flex items-center justify-center p-12 rounded-xl border-2 border-dashed min-h-[400px]"
                  style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                >
                  <div className="text-center">
                    <ChevronLeft
                      size={48}
                      className="mx-auto mb-4"
                      style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                    />
                    <p
                      style={{
                        fontFamily: CASA_BRAND.fonts.body,
                        fontSize: '14px',
                        color: CASA_BRAND.colors.secondary.grayMedium,
                      }}
                    >
                      Selecciona un elemento de la lista para editarlo
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'preview':
        return (
          <VistaPrevia
            elements={elements}
            elementOrder={elementOrder}
            onOrderChange={handleOrderChange}
            liturgyTitle={liturgyContext?.title}
            liturgyDate={liturgyContext?.date}
          />
        );

      case 'export':
        return (
          <ExportPanel
            elements={elements}
            elementOrder={elementOrder}
            liturgyContext={liturgyContext}
            onExportComplete={(format) => {
              console.log(`Exportación completada: ${format}`);
            }}
          />
        );
    }
  };

  // Step navigation
  const steps: { id: WorkflowStep; label: string; icon: React.ReactNode }[] = [
    { id: 'contexto', label: 'Contexto', icon: <FileText size={16} /> },
    { id: 'elementos', label: 'Elementos', icon: <Settings size={16} /> },
    { id: 'preview', label: 'Vista Previa', icon: <Eye size={16} /> },
    { id: 'export', label: 'Exportar', icon: <Download size={16} /> },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
          >
            <BookOpen size={24} color={CASA_BRAND.colors.primary.white} />
          </div>
          <div>
            <h1
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                fontSize: '28px',
                fontWeight: 300,
                color: CASA_BRAND.colors.primary.black,
              }}
            >
              Constructor de Liturgias
            </h1>
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {liturgyContext?.title || 'Nueva liturgia'}
            </p>
          </div>
        </div>

        {/* Progress and Save */}
        <div className="flex items-center gap-4">
          {currentStep !== 'contexto' && (
            <div className="flex items-center gap-2">
              <div
                className="w-32 h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${completionStats.percentage}%`,
                    backgroundColor: CASA_BRAND.colors.primary.amber,
                  }}
                />
              </div>
              <span
                className="text-sm"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                {completionStats.percentage}%
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!liturgyContext || isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.black,
              color: CASA_BRAND.colors.primary.white,
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
            }}
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Guardar
          </button>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id;
          const isPast = steps.findIndex((s) => s.id === currentStep) > index;
          const isAccessible = step.id === 'contexto' || liturgyContext;

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => isAccessible && setCurrentStep(step.id)}
                disabled={!isAccessible}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                  isActive ? 'ring-2 ring-offset-1' : ''
                } disabled:cursor-not-allowed`}
                style={{
                  backgroundColor: isActive
                    ? CASA_BRAND.colors.primary.amber
                    : isPast
                      ? `${CASA_BRAND.colors.amber.light}30`
                      : CASA_BRAND.colors.secondary.grayLight,
                  color: isActive
                    ? CASA_BRAND.colors.primary.white
                    : isPast
                      ? CASA_BRAND.colors.primary.amber
                      : CASA_BRAND.colors.secondary.grayMedium,
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '13px',
                  fontWeight: 500,
                  ringColor: CASA_BRAND.colors.primary.amber,
                  opacity: isAccessible ? 1 : 0.5,
                }}
              >
                {step.icon}
                {step.label}
              </button>
              {index < steps.length - 1 && (
                <ChevronRight
                  size={16}
                  style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Content */}
      <div
        className="p-6 rounded-xl border min-h-[500px]"
        style={{
          borderColor: CASA_BRAND.colors.secondary.grayLight,
          backgroundColor: CASA_BRAND.colors.primary.white,
        }}
      >
        {renderStepContent()}
      </div>

      {/* Navigation Buttons */}
      {currentStep !== 'contexto' && (
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => {
              const currentIndex = steps.findIndex((s) => s.id === currentStep);
              if (currentIndex > 0) {
                setCurrentStep(steps[currentIndex - 1].id);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors hover:bg-gray-100"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            <ChevronLeft size={16} />
            Anterior
          </button>

          <button
            type="button"
            onClick={() => {
              const currentIndex = steps.findIndex((s) => s.id === currentStep);
              if (currentIndex < steps.length - 1) {
                setCurrentStep(steps[currentIndex + 1].id);
              }
            }}
            disabled={currentStep === 'export'}
            className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.white,
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
            }}
          >
            Siguiente
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ConstructorLiturgias;
