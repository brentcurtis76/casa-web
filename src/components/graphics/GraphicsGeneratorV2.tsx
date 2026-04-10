/**
 * CASA Graphics Generator V2
 * Interfaz simplificada para generación de gráficos de eventos
 *
 * Flujo:
 * 1. Usuario llena formulario (título, fecha, hora, ubicación, tipo)
 * 2. Sistema genera 4 ilustraciones via Gemini
 * 3. Usuario selecciona una
 * 4. Sistema genera los 4 formatos finales
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CASA_BRAND } from '@/lib/brand-kit';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import {
  AlertCircle,
  Wand2,
  Download,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  CheckCircle,
  CalendarIcon,
  Clock,
  MapPin,
  Archive,
  Save,
  Type,
  Heading,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  generateGraphicWithPositions,
  downloadGraphic,
  downloadAllGraphics,
  preloadFonts,
  DEFAULT_ILLUSTRATION_ADJUSTMENTS,
  DEFAULT_FIELD_POSITION_ADJUSTMENTS,
  computeLayoutMetrics,
  type EventData,
  type GeneratedGraphic,
  type FormatType,
  type IllustrationAdjustment,
  type IllustrationAdjustments,
  type FieldPositionAdjustments,
  type AllFieldPositionAdjustments,
} from './templateCompositor';
import { buildJsonPromptString } from './jsonPromptBuilder';
import {
  type ElementPositions,
  type AllElementPositions,
  DEFAULT_ELEMENT_POSITIONS,
  FORMAT_DIMENSIONS,
  clonePositions,
  type GraphicsBackgroundSettings,
} from './graphicsTypes';
import { DragCanvasEditor } from './DragCanvasEditor';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// Tipos de evento disponibles
const EVENT_TYPES = [
  { value: 'mesa_abierta', label: 'La Mesa Abierta' },
  { value: 'culto_dominical', label: 'Culto Dominical' },
  { value: 'estudio_biblico', label: 'Estudio Bíblico' },
  { value: 'retiro', label: 'Retiro' },
  { value: 'navidad', label: 'Navidad' },
  { value: 'cuaresma', label: 'Cuaresma' },
  { value: 'pascua', label: 'Pascua' },
  { value: 'bautismo', label: 'Bautismo' },
  { value: 'comunidad', label: 'Comunidad' },
  { value: 'musica', label: 'Música / Coro' },
  { value: 'oracion', label: 'Oración' },
  { value: 'generic', label: 'General' },
];

// Nombres de formato para mostrar
const FORMAT_LABELS: Record<FormatType, string> = {
  ppt_4_3: 'PowerPoint 4:3',
  instagram_post: 'Instagram Post',
  instagram_story: 'Instagram Story',
  facebook_post: 'Facebook Post',
};

type Phase = 'form' | 'prompt' | 'prompt-preview' | 'selecting' | 'adjusting' | 'format-select' | 'generating' | 'logo-adjust' | 'done';

/**
 * Resolve auto-positioned elements (y = -1) to concrete Y values for ALL formats.
 * Uses computeLayoutMetrics() per format with that format's own title text,
 * so subtitle Y matches the rendered title height for each format.
 */
function resolveAutoPositions(
  positions: AllElementPositions,
  perFormatTitles: Record<FormatType, string>,
  sharedEvent: Omit<EventData, 'title'>,
  illustrationAspectRatio: number | null
): AllElementPositions {
  const resolved = clonePositions(positions);

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');

  (['ppt_4_3', 'instagram_post', 'instagram_story', 'facebook_post'] as FormatType[]).forEach(fmt => {
    const formatPositions = resolved[fmt];

    // Build per-format event using that format's title text
    const event: EventData = {
      title: perFormatTitles[fmt].replace(/\n/g, '\\n') || 'Título del Evento',
      ...sharedEvent,
    };

    const metrics = computeLayoutMetrics(
      fmt,
      formatPositions,
      illustrationAspectRatio,
      event,
      ctx ? { canvasForMeasure: ctx } : undefined
    );

    if (formatPositions.title.y < 0) {
      formatPositions.title.y = metrics.title.y;
    }
    if (formatPositions.subtitle.y < 0) {
      formatPositions.subtitle.y = metrics.subtitle.y;
    }
  });

  return resolved;
}

// Base prompt para ilustraciones - requests PURE WHITE background
// Post-processing will replace white pixels with CASA_BRAND.colors.primary.white
// This prompt matches the Portadas element for consistent image quality
const BASE_STYLE_PROMPT = `Minimalist line art illustration with PURE WHITE (#FFFFFF) solid flat background, no texture, no pattern, no gradients. Single continuous gray (#666666) line drawing in the style of Henri Matisse or Pablo Picasso one-line art. Abstract and contemplative, suggestive of spiritual reflection. No text, no labels, no words. Elegant flowing lines with amber/gold (#D4A853) accent on 20-30% of the illustration.`;

/**
 * Post-process an illustration to ensure background matches CASA_BRAND.colors.primary.white
 * Replaces white, near-white, light gray, and checkered pattern pixels with exact target color
 * When mode is 'transparent', replaces white/gray with alpha=0 instead
 */
async function processIllustrationBackground(base64: string, targetColor: string = CASA_BRAND.colors.primary.white, mode: 'solid' | 'transparent' = 'solid'): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(base64);
        return;
      }

      // Draw the original image first
      ctx.drawImage(img, 0, 0);

      // Get image data to process pixels
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Parse target color to RGB (only for solid mode)
      let targetR = 0, targetG = 0, targetB = 0;
      if (mode === 'solid') {
        targetR = parseInt(targetColor.slice(1, 3), 16);
        targetG = parseInt(targetColor.slice(3, 5), 16);
        targetB = parseInt(targetColor.slice(5, 7), 16);
      }

      // Replace background pixels with target color (solid) or alpha=0 (transparent)
      // This handles: pure white, near-white, cream, light gray, and checkered patterns
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Replace transparent pixels
        if (a < 250) {
          if (mode === 'transparent') {
            data[i + 3] = 0; // Keep transparent
          } else {
            data[i] = targetR;
            data[i + 1] = targetG;
            data[i + 2] = targetB;
            data[i + 3] = 255;
          }
          continue;
        }

        // Replace pure white and near-white (> 240)
        if (r > 240 && g > 240 && b > 240) {
          if (mode === 'transparent') {
            data[i + 3] = 0; // Make transparent
          } else {
            data[i] = targetR;
            data[i + 1] = targetG;
            data[i + 2] = targetB;
          }
          continue;
        }

        // Replace light grays (checkered pattern uses ~204 gray and white)
        if (r > 190 && g > 190 && b > 190) {
          const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
          // If it's a neutral gray (R≈G≈B), replace it
          if (maxDiff < 10) {
            if (mode === 'transparent') {
              data[i + 3] = 0; // Make transparent
            } else {
              data[i] = targetR;
              data[i + 1] = targetG;
              data[i + 2] = targetB;
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);

      const result = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
      resolve(result);
    };

    img.onerror = () => {
      resolve(base64);
    };

    img.src = `data:image/png;base64,${base64}`;
  });
}

// Prompts por tipo de evento
const EVENT_PROMPTS: Record<string, string> = {
  mesa_abierta: `People gathering around a table sharing food, communion, togetherness`,
  culto_dominical: `Church altar with cross, candles, and open book`,
  estudio_biblico: `Open Bible with reading lamp, coffee cup, and notebook`,
  retiro: `Mountain landscape with path, trees, and birds in flight`,
  navidad: `Nativity scene with stable, star, and manger`,
  cuaresma: `Cross with crown of thorns in desert landscape with sparse vegetation`,
  pascua: `Empty tomb at sunrise with lilies and garden flowers`,
  bautismo: `Water waves with dove, shell, and light rays from above`,
  comunidad: `Circle of people with joined hands around a central cross`,
  musica: `Musical notes, guitar or piano, and sound waves`,
  oracion: `Praying hands with candle flame and ascending light`,
  generic: `Celtic cross with church architecture, candles, and open doors`,
};

export const GraphicsGeneratorV2 = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Admin check
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  // Phase state
  const [phase, setPhase] = useState<Phase>('form');

  // Form state - Per-format titles for different line breaks
  const [titles, setTitles] = useState<Record<FormatType, string>>({
    ppt_4_3: '',
    instagram_post: '',
    instagram_story: '',
    facebook_post: '',
  });
  const [eventType, setEventType] = useState('mesa_abierta');

  // Helper to update title for a specific format
  const updateTitle = (format: FormatType, value: string) => {
    setTitles(prev => ({ ...prev, [format]: value }));
  };

  // Helper to update all titles at once (when typing in the main field)
  const updateAllTitles = (value: string) => {
    setTitles({
      ppt_4_3: value,
      instagram_post: value,
      instagram_story: value,
      facebook_post: value,
    });
  };

  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [subtitle, setSubtitle] = useState('');
  const [extraInfo, setExtraInfo] = useState('');
  // Context hint for AI prompt only — NOT rendered as text on the image
  const [contextHint, setContextHint] = useState('');

  // Toggle states for optional fields
  const [includeSubtitle, setIncludeSubtitle] = useState(false);
  const [includeDate, setIncludeDate] = useState(true);
  const [includeTime, setIncludeTime] = useState(true);
  const [includeLocation, setIncludeLocation] = useState(true);
  const [includeExtraInfo, setIncludeExtraInfo] = useState(false);
  // Per-format logo settings (enabled, size, position)
  interface LogoSettings { enabled: boolean; size: number; x: number; y: number }
  const [logoSettings, setLogoSettings] = useState<Record<FormatType, LogoSettings>>({
    ppt_4_3: { enabled: true, size: 80, x: 457, y: 34 },
    instagram_post: { enabled: true, size: 70, x: 497, y: 901 },
    instagram_story: { enabled: true, size: 70, x: 497, y: 1750 },
    facebook_post: { enabled: true, size: 70, x: 560, y: 20 },
  });

  // Text baked into image toggle — when ON, Nano Banana Pro renders text directly
  const [textBakedIn, setTextBakedIn] = useState(true);

  // Prompt state (editable)
  const [customPrompt, setCustomPrompt] = useState('');
  // Editable prompt for textBakedIn mode (shown in prompt-preview phase)
  const [editablePrompt, setEditablePrompt] = useState('');
  // User's illustration theme description (in Spanish)
  const [illustrationTheme, setIllustrationTheme] = useState('');
  // Selected formats for generation (format-select phase)
  const [selectedFormats, setSelectedFormats] = useState<FormatType[]>([]);

  // Illustrations state
  const [illustrations, setIllustrations] = useState<string[]>([]);
  const [selectedIllustration, setSelectedIllustration] = useState<number | null>(null);
  const [loadingIllustrations, setLoadingIllustrations] = useState(false);
  const [illustrationAspectRatio, setIllustrationAspectRatio] = useState<number | null>(null);

  // Generated graphics state
  const [generatedGraphics, setGeneratedGraphics] = useState<GeneratedGraphic[]>([]);
  // Raw AI-generated images (before logo overlay) — kept so we can re-composite
  const [rawGeneratedImages, setRawGeneratedImages] = useState<GeneratedGraphic[]>([]);
  const [generatingFormats, setGeneratingFormats] = useState(false);

  // Logo base64 (fetched once)
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // Fonts loaded
  const [fontsLoaded, setFontsLoaded] = useState(false);


  // Save batch state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchSaved, setBatchSaved] = useState(false);

  // Illustration adjustment state - per format
  const [adjustFormat, setAdjustFormat] = useState<FormatType>('ppt_4_3');
  const [illustrationAdjustments, setIllustrationAdjustments] = useState<IllustrationAdjustments>(
    { ...DEFAULT_ILLUSTRATION_ADJUSTMENTS }
  );
  const [adjustPreview, setAdjustPreview] = useState<string | null>(null);
  const [adjustPreviewLoading, setAdjustPreviewLoading] = useState(false);

  // Field position adjustments state - per format (fecha, hora, ubicación)
  const [fieldPositionAdjustments, setFieldPositionAdjustments] = useState<AllFieldPositionAdjustments>(
    JSON.parse(JSON.stringify(DEFAULT_FIELD_POSITION_ADJUSTMENTS))
  );

  // New: Element positions for drag-and-drop editor (absolute positions in base coords)
  const [elementPositions, setElementPositions] = useState<AllElementPositions>(
    clonePositions(DEFAULT_ELEMENT_POSITIONS)
  );

  // Background settings for transparent/solid color control
  const [backgroundSettings, setBackgroundSettings] = useState<GraphicsBackgroundSettings>({
    mode: 'solid',
    color: '#F9F7F5', // default cream
  });

  // Format date range for display
  const formatDateRange = (range: DateRange | undefined): string => {
    if (!range?.from) return '';

    if (!range.to || range.from.getTime() === range.to.getTime()) {
      return format(range.from, "d 'de' MMMM", { locale: es });
    }

    const fromMonth = range.from.getMonth();
    const toMonth = range.to.getMonth();

    if (fromMonth === toMonth) {
      return `${format(range.from, 'd', { locale: es })} - ${format(range.to, "d 'de' MMMM", { locale: es })}`;
    } else {
      return `${format(range.from, "d 'de' MMM", { locale: es })} - ${format(range.to, "d 'de' MMM", { locale: es })}`;
    }
  };

  // Check admin on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setCheckingAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from('mesa_abierta_admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (data && !error) {
        setIsAdmin(true);
      }
      setCheckingAdmin(false);
    };

    checkAdminStatus();
  }, [user]);

  // Preload fonts on mount
  useEffect(() => {
    preloadFonts()
      .then(() => setFontsLoaded(true))
      .catch(console.warn);
  }, []);

  // Fetch logo once
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const response = await fetch('/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png');
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).replace(/^data:image\/png;base64,/, '');
          setLogoBase64(base64);
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        console.warn('No se pudo cargar el logo:', e);
      }
    };
    fetchLogo();
  }, []);


  // Build default prompt based on event type or user's custom theme
  const buildDefaultPrompt = (type: string, userTheme?: string): string => {
    // If user provided a theme description, use it instead of the event type default
    const subjectPrompt = userTheme?.trim()
      ? userTheme.trim()
      : (EVENT_PROMPTS[type] || EVENT_PROMPTS.generic);
    return `${BASE_STYLE_PROMPT} Subject: ${subjectPrompt}`;
  };

  // Show prompt editor before generating (or skip to generation in baked-in mode)
  const handleShowPromptEditor = () => {
    // Check if at least one format has a title
    const hasAnyTitle = Object.values(titles).some(t => t.trim());
    if (!hasAnyTitle) {
      toast({
        title: 'Título requerido',
        description: 'Por favor ingresa un título para el evento.',
        variant: 'destructive',
      });
      return;
    }

    if (textBakedIn) {
      // In baked-in mode, show the prompt preview so user can review/edit
      const eventData: EventData = {
        title: titles.instagram_post || titles.ppt_4_3 || 'Título del Evento',
        subtitle: includeSubtitle ? subtitle : undefined,
        date: includeDate ? (formatDateRange(dateRange) || '') : '',
        time: includeTime ? (time || '') : '',
        location: includeLocation ? (location || '') : '',
      };
      const promptStr = buildJsonPromptString(eventData, eventType, 'instagram_post', {
        includeSubtitle,
        extraInfo: includeExtraInfo ? extraInfo : undefined,
        contextHint: contextHint.trim() || undefined,
      });
      setEditablePrompt(promptStr);
      setPhase('prompt-preview');
    } else {
      // Legacy mode: show editable prompt
      setCustomPrompt(buildDefaultPrompt(eventType, illustrationTheme));
      setPhase('prompt');
    }
  };

  // Generate 4 illustrations with custom prompt
  const handleGenerateIllustrations = async () => {
    setLoadingIllustrations(true);
    setPhase('selecting');
    setSelectedIllustration(null);
    setIllustrations([]);

    try {
      // Build request body depending on mode
      let requestBody: Record<string, unknown>;

      if (textBakedIn) {
        // JSON prompt mode: use the (possibly user-edited) prompt from prompt-preview phase
        requestBody = {
          eventType,
          count: 4,
          jsonPrompt: editablePrompt,
        };
      } else {
        // Legacy mode: illustration-only with canvas overlay
        requestBody = {
          eventType,
          count: 4,
          customPrompt: customPrompt,
          backgroundMode: backgroundSettings.mode,
        };
      }

      const { data, error } = await supabase.functions.invoke('generate-illustration', {
        body: requestBody,
      });

      if (error) throw error;

      if (data?.illustrations && data.illustrations.length > 0) {
        const validIllustrations = data.illustrations.filter((i: string) => i && i.length > 0);

        let processedIllustrations: string[];
        if (textBakedIn) {
          // In baked-in mode, the image is a complete graphic — no background replacement
          processedIllustrations = validIllustrations;
        } else {
          // Legacy mode: post-process to ensure background matches slide color or is transparent
          processedIllustrations = await Promise.all(
            validIllustrations.map((base64: string) =>
              processIllustrationBackground(
                base64,
                backgroundSettings.color || CASA_BRAND.colors.primary.white,
                backgroundSettings.mode
              )
            )
          );
        }
        setIllustrations(processedIllustrations);

        const validCount = processedIllustrations.length;
        if (validCount < 4) {
          toast({
            title: `${validCount} ilustraciones generadas`,
            description: 'La API no generó todas las opciones. Puedes regenerar para obtener más.',
          });
        } else {
          toast({
            title: 'Ilustraciones generadas',
            description: 'Selecciona la que más te guste.',
          });
        }
      } else {
        throw new Error('No se recibieron ilustraciones');
      }
    } catch (err: any) {
      console.error('Error generando ilustraciones:', err);

      // MODO DE PRUEBA: Si la Edge Function no está disponible,
      // continuar sin ilustración para probar el compositor
      toast({
        title: 'Modo de prueba',
        description: 'Edge Function no disponible. Continuando sin ilustración para probar el compositor.',
      });

      // Generar 4 "slots" vacíos para que el usuario pueda probar
      setIllustrations(['', '', '', '']);
    } finally {
      setLoadingIllustrations(false);
    }
  };

  // Regenerate illustrations
  const handleRegenerateIllustrations = () => {
    handleGenerateIllustrations();
  };

  // Select illustration and go to adjustment phase (or skip to final generation in baked-in mode)
  const handleSelectIllustration = (index: number) => {
    setSelectedIllustration(index);

    // Compute illustration aspect ratio
    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      setIllustrationAspectRatio(aspectRatio);
    };
    img.onerror = () => {
      setIllustrationAspectRatio(null);
    };
    img.src = `data:image/png;base64,${illustrations[index]}`;

    // Both modes go to format selection
    setSelectedFormats([]);
    if (textBakedIn) {
      setPhase('format-select');
      return;
    }

    // Legacy mode: go to adjustment phase (format-select comes after)
    // Reset adjustments to defaults
    setIllustrationAdjustments({ ...DEFAULT_ILLUSTRATION_ADJUSTMENTS });
    setFieldPositionAdjustments(JSON.parse(JSON.stringify(DEFAULT_FIELD_POSITION_ADJUSTMENTS)));

    // Resolve auto-Y positions per format using each format's own title text
    const defaultPositions = clonePositions(DEFAULT_ELEMENT_POSITIONS);
    const resolvedPositions = resolveAutoPositions(
      defaultPositions,
      titles,
      {
        subtitle: includeSubtitle ? subtitle : undefined,
        date: includeDate ? (formatDateRange(dateRange) || 'Fecha del evento') : '',
        time: includeTime ? (time || '19:00 hrs') : '',
        location: includeLocation ? (location || 'Ubicación del evento') : '',
      },
      null
    );
    setElementPositions(resolvedPositions);

    setAdjustFormat('ppt_4_3');
    setPhase('adjusting');
  };

  // Update adjustment for current format
  const updateAdjustment = (key: keyof IllustrationAdjustment, value: number) => {
    setIllustrationAdjustments(prev => ({
      ...prev,
      [adjustFormat]: {
        ...prev[adjustFormat],
        [key]: value,
      },
    }));
  };

  // Update field position adjustment for current format
  const updateFieldPosition = (
    field: 'title' | 'subtitle' | 'date' | 'time' | 'location',
    axis: 'offsetX' | 'offsetY',
    value: number
  ) => {
    setFieldPositionAdjustments(prev => ({
      ...prev,
      [adjustFormat]: {
        ...prev[adjustFormat],
        [field]: {
          ...prev[adjustFormat][field],
          [axis]: value,
        },
      },
    }));
  };

  // Generate preview for adjustment phase using drag-and-drop positions
  useEffect(() => {
    if (phase !== 'adjusting' || selectedIllustration === null) return;
    if (!fontsLoaded || !logoBase64) return;

    const timeoutId = setTimeout(async () => {
      setAdjustPreviewLoading(true);
      try {
        const selectedBase64 = illustrations[selectedIllustration];
        const eventData: EventData = {
          title: titles[adjustFormat].replace(/\n/g, '\\n') || 'Título del Evento',
          subtitle: includeSubtitle ? subtitle : undefined,
          date: includeDate ? (formatDateRange(dateRange) || 'Fecha del evento') : '',
          time: includeTime ? (time || '19:00 hrs') : '',
          location: includeLocation ? (location || 'Ubicación del evento') : '',
        };
        const graphic = await generateGraphicWithPositions(
          adjustFormat,
          eventData,
          selectedBase64,
          logoBase64,
          elementPositions[adjustFormat],
          backgroundSettings
        );
        setAdjustPreview(graphic.base64);
      } catch (e) {
        console.warn('Error generando preview de ajuste:', e);
      } finally {
        setAdjustPreviewLoading(false);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [phase, adjustFormat, elementPositions, selectedIllustration, fontsLoaded, logoBase64, titles, dateRange, time, location, subtitle, includeSubtitle, includeDate, includeTime, includeLocation, illustrations, backgroundSettings]);

  // Generate selected formats with current adjustments
  const handleGenerateWithAdjustments = async () => {
    if (selectedIllustration === null) return;

    // Use selectedFormats if any, otherwise fall back to all 4
    const formatsToGenerate: FormatType[] = selectedFormats.length > 0
      ? selectedFormats
      : ['ppt_4_3', 'instagram_post', 'instagram_story', 'facebook_post'];

    setPhase('generating');
    setGeneratingFormats(true);

    const selectedBase64 = illustrations[selectedIllustration];

    try {
      let graphics: GeneratedGraphic[];

      if (textBakedIn) {
        // Text-baked-in mode: use image-to-image to recompose the selected
        // illustration for each requested aspect ratio. The selected image is
        // sent as a reference so the model preserves its style and composition
        // while adapting to the new dimensions.
        const generateForFormat = async (format: FormatType): Promise<GeneratedGraphic> => {
          const dims = FORMAT_DIMENSIONS[format];
          const eventData: EventData = {
            title: titles[format].replace(/\n/g, '\\n') || 'Título del Evento',
            subtitle: includeSubtitle ? subtitle : undefined,
            date: includeDate ? formatDateRange(dateRange) : '',
            time: includeTime ? time : '',
            location: includeLocation ? location : '',
          };

          // Build a recomposition prompt that references the selected image
          const referencePrompt = [
            `Recompose this exact graphic design for a ${dims.width}x${dims.height} pixel format (${dims.width}:${dims.height} aspect ratio).`,
            '',
            'CRITICAL INSTRUCTIONS:',
            '1. Keep the SAME illustration, SAME text content, SAME typography, SAME color palette, and SAME overall design language.',
            '2. Adapt the LAYOUT to fit the new aspect ratio — reposition elements, adjust spacing, resize text proportionally.',
            '3. Maintain the Matisse/Picasso continuous line art style exactly as shown.',
            `4. The final image must be ${dims.width}x${dims.height} pixels.`,
            '5. All text must remain fully legible and correctly spelled.',
            '6. Do NOT include any logo, watermark, monogram, or emblem. Avoid placing important content in the bottom-right corner but let the background continue naturally — no blank or white rectangle.',
            '7. Do NOT add any religious figures, crosses, halos, or religious symbols unless the title explicitly references them.',
            '',
            `Text that must appear exactly:`,
            eventData.title ? `- Title: "${eventData.title.replace(/\\n/g, ' ')}"` : '',
            eventData.subtitle ? `- Subtitle: "${eventData.subtitle}"` : '',
            eventData.date ? `- Date: "${eventData.date}"` : '',
            eventData.time ? `- Time: "${eventData.time}"` : '',
            eventData.location ? `- Location: "${eventData.location}"` : '',
            (includeExtraInfo && extraInfo) ? `- Extra info: "${extraInfo}"` : '',
          ].filter(Boolean).join('\n');

          const { data, error } = await supabase.functions.invoke('generate-illustration', {
            body: {
              eventType,
              count: 1,
              referenceImage: selectedBase64,
              referencePrompt,
            },
          });

          if (error) throw error;

          const base64Raw = data?.illustrations?.[0] || selectedBase64;
          return { format, base64: base64Raw, width: dims.width * 2, height: dims.height * 2 };
        };

        graphics = await Promise.all(formatsToGenerate.map(generateForFormat));

        // Store raw images for re-compositing during logo adjustment
        setRawGeneratedImages(graphics);
        setGeneratedGraphics(graphics);
        setPhase('logo-adjust');

        toast({
          title: 'Gráficos generados',
          description: 'Ajusta el logo antes de finalizar.',
        });
      } else {
        // Legacy mode: generate each format with canvas text overlay
        graphics = await Promise.all(
          formatsToGenerate.map(format => {
            const eventData: EventData = {
              title: titles[format].replace(/\n/g, '\\n'),
              subtitle: includeSubtitle ? subtitle : undefined,
              date: includeDate ? formatDateRange(dateRange) : '',
              time: includeTime ? time : '',
              location: includeLocation ? location : '',
            };
            return generateGraphicWithPositions(format, eventData, selectedBase64, logoBase64, elementPositions[format], backgroundSettings);
          })
        );

        setGeneratedGraphics(graphics);
        setPhase('done');

        toast({
          title: 'Gráficos generados',
          description: `Se han creado ${graphics.length} formatos listos para descargar.`,
        });
      }
    } catch (err: any) {
      console.error('Error generando formatos:', err);
      toast({
        title: 'Error',
        description: 'Hubo un problema generando los formatos.',
        variant: 'destructive',
      });
      setPhase(textBakedIn ? 'format-select' : 'adjusting');
    } finally {
      setGeneratingFormats(false);
    }
  };

  // Apply logo to raw images and go to done phase
  const handleApplyLogo = async () => {
    if (rawGeneratedImages.length === 0) return;

    setGeneratingFormats(true);
    try {
      const final = await Promise.all(
        rawGeneratedImages.map(async (raw) => {
          const ls = logoSettings[raw.format];
          if (!ls.enabled || !logoBase64) {
            return raw;
          }

          // Build positions with user-adjusted logo x/y/size
          const pos = { ...elementPositions[raw.format] };
          pos.logo = { x: ls.x, y: ls.y, size: ls.size };

          const eventData: EventData = {
            title: titles[raw.format]?.replace(/\n/g, '\\n') || '',
            subtitle: includeSubtitle ? subtitle : undefined,
            date: includeDate ? formatDateRange(dateRange) : '',
            time: includeTime ? time : '',
            location: includeLocation ? location : '',
          };

          return generateGraphicWithPositions(
            raw.format,
            eventData,
            raw.base64,
            logoBase64,
            pos,
            backgroundSettings,
            { textBakedIn: true }
          );
        })
      );
      setGeneratedGraphics(final);
    } catch (err) {
      console.error('Error applying logo:', err);
      setGeneratedGraphics(rawGeneratedImages);
    } finally {
      setGeneratingFormats(false);
    }
    setPhase('done');
  };

  // Download single - use PPT title as base filename
  const handleDownload = (graphic: GeneratedGraphic) => {
    downloadGraphic(graphic, titles.ppt_4_3 || titles.instagram_post);
  };

  // Download all
  const handleDownloadAll = async () => {
    await downloadAllGraphics(generatedGraphics, titles.ppt_4_3 || titles.instagram_post);
    toast({
      title: 'Descargas iniciadas',
      description: 'Todos los formatos se están descargando.',
    });
  };

  // Open save dialog
  const handleOpenSaveDialog = () => {
    // Default batch name based on title
    const defaultName = titles.ppt_4_3 || titles.instagram_post || 'Gráficos';
    setBatchName(defaultName.replace(/\n/g, ' '));
    setShowSaveDialog(true);
  };

  // Save batch to database
  const handleSaveBatch = async () => {
    if (!batchName.trim() || !user) return;

    setSavingBatch(true);
    try {
      // 1. Create the batch record
      const { data: batch, error: batchError } = await supabase
        .from('casa_graphics_batches')
        .insert({
          name: batchName.trim(),
          event_type: eventType as any,
          event_date: formatDateRange(dateRange),
          event_time: time,
          event_location: location,
          illustration_base64: selectedIllustration !== null ? illustrations[selectedIllustration] : null,
          prompt_used: customPrompt,
          created_by: user.id,
          metadata: {
            titles, // Store all per-format titles
            backgroundSettings, // Persist background mode and color
          },
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // 2. Upload each graphic to storage and create item records
      const uploadPromises = generatedGraphics.map(async (graphic) => {
        // Convert base64 to blob
        const byteCharacters = atob(graphic.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });

        // Generate unique filename
        const filename = `${batch.id}/${graphic.format}_${Date.now()}.png`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('casa-graphics')
          .upload(filename, blob, {
            contentType: 'image/png',
            upsert: false,
          });

        if (uploadError) {
          console.error(`Error uploading ${graphic.format}:`, uploadError);
          throw uploadError;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('casa-graphics')
          .getPublicUrl(filename);

        // Create item record
        const { error: itemError } = await supabase
          .from('casa_graphics_items')
          .insert({
            batch_id: batch.id,
            format: graphic.format as any,
            title: titles[graphic.format],
            image_url: urlData.publicUrl,
            width: graphic.width,
            height: graphic.height,
          });

        if (itemError) throw itemError;

        return urlData.publicUrl;
      });

      await Promise.all(uploadPromises);

      setBatchSaved(true);
      setShowSaveDialog(false);
      toast({
        title: 'Batch guardado',
        description: `"${batchName}" se ha guardado para uso futuro.`,
      });
    } catch (err: any) {
      console.error('Error saving batch:', err);
      toast({
        title: 'Error al guardar',
        description: err.message || 'No se pudo guardar el batch.',
        variant: 'destructive',
      });
    } finally {
      setSavingBatch(false);
    }
  };

  // Reset to start
  const handleReset = () => {
    setPhase('form');
    setIllustrations([]);
    setSelectedIllustration(null);
    setGeneratedGraphics([]);
    setBatchSaved(false);
    setBatchName('');
    setIllustrationAdjustments({ ...DEFAULT_ILLUSTRATION_ADJUSTMENTS });
    setFieldPositionAdjustments(JSON.parse(JSON.stringify(DEFAULT_FIELD_POSITION_ADJUSTMENTS)));
    setElementPositions(clonePositions(DEFAULT_ELEMENT_POSITIONS));
    setAdjustFormat('ppt_4_3');
    setAdjustPreview(null);
  };

  // Loading state
  if (checkingAdmin) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Acceso Restringido</AlertTitle>
        <AlertDescription>
          Solo administradores pueden acceder al generador de gráficos.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Generador de Gráficos CASA</h1>
      </div>

      {/* Phase: Form */}
      {phase === 'form' && (
        <div className="max-w-xl mx-auto">
          {/* Formulario */}
          <Card>
            <CardHeader>
              <CardTitle>Detalles del Evento</CardTitle>
              <CardDescription>
                Completa la información que aparecerá en el gráfico
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Título - per format with sync option */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Título del Evento <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="title"
                  value={titles.ppt_4_3}
                  onChange={(e) => updateAllTitles(e.target.value)}
                  placeholder="Ej: La Mesa&#10;Abierta"
                  className="w-full min-h-[80px] p-3 border rounded-md text-lg resize-none"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Usa Enter para saltos de línea. El título se aplica a todos los formatos.
                </p>
              </div>

              {/* Subtítulo opcional */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-subtitle"
                    checked={includeSubtitle}
                    onCheckedChange={(checked) => setIncludeSubtitle(checked === true)}
                  />
                  <Label htmlFor="include-subtitle" className="cursor-pointer">Subtítulo</Label>
                </div>
                <Input
                  id="subtitle"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Ej: Un espacio de comunión y reflexión"
                  disabled={!includeSubtitle}
                  className={!includeSubtitle ? 'opacity-50' : ''}
                />
              </div>

              {/* Tipo de evento */}
              <div className="space-y-2">
                <Label>Tipo de Evento</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Texto integrado en imagen */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="text-baked-in"
                    checked={textBakedIn}
                    onCheckedChange={(checked) => setTextBakedIn(checked === true)}
                  />
                  <Label htmlFor="text-baked-in" className="cursor-pointer">Texto integrado en imagen</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {textBakedIn
                    ? 'Nano Banana Pro renderiza el texto directamente en la imagen con tipografía profesional (recomendado).'
                    : 'Modo clásico: la ilustración se genera sin texto y se superpone después con Canvas.'}
                </p>
              </div>

              {/* Fecha y Hora */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="include-date"
                      checked={includeDate}
                      onCheckedChange={(checked) => setIncludeDate(checked === true)}
                    />
                    <Label htmlFor="include-date" className="cursor-pointer">Fecha</Label>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={!includeDate}
                        className={`w-full justify-start text-left font-normal ${
                          !dateRange?.from ? 'text-muted-foreground' : ''
                        } ${!includeDate ? 'opacity-50' : ''}`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? formatDateRange(dateRange) : 'Seleccionar fecha'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="include-time"
                      checked={includeTime}
                      onCheckedChange={(checked) => setIncludeTime(checked === true)}
                    />
                    <Label htmlFor="include-time" className="cursor-pointer">Hora</Label>
                  </div>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      placeholder="19:00 hrs"
                      disabled={!includeTime}
                      className={`pl-10 ${!includeTime ? 'opacity-50' : ''}`}
                    />
                  </div>
                </div>
              </div>

              {/* Ubicación */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-location"
                    checked={includeLocation}
                    onCheckedChange={(checked) => setIncludeLocation(checked === true)}
                  />
                  <Label htmlFor="include-location" className="cursor-pointer">Ubicación</Label>
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="En diversas casas de la comunidad"
                    disabled={!includeLocation}
                    className={`pl-10 ${!includeLocation ? 'opacity-50' : ''}`}
                  />
                </div>
              </div>

              {/* Información adicional */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-extra-info"
                    checked={includeExtraInfo}
                    onCheckedChange={(checked) => setIncludeExtraInfo(checked === true)}
                  />
                  <Label htmlFor="include-extra-info" className="cursor-pointer">Información adicional</Label>
                </div>
                <Input
                  id="extra-info"
                  value={extraInfo}
                  onChange={(e) => setExtraInfo(e.target.value)}
                  placeholder="Ej: Trae un plato para compartir · Cuidado de niños disponible"
                  disabled={!includeExtraInfo}
                  className={!includeExtraInfo ? 'opacity-50' : ''}
                />
              </div>

              {/* Context hint — feeds AI prompt only, not rendered on image */}
              <div className="space-y-2">
                <Label htmlFor="context-hint">Contexto para la IA (opcional)</Label>
                <Input
                  id="context-hint"
                  value={contextHint}
                  onChange={(e) => setContextHint(e.target.value)}
                  placeholder="Ej: Serie de sermones sobre gratitud y contentamiento"
                />
                <p className="text-xs text-muted-foreground">
                  Ayuda al modelo a entender el tema. No aparece como texto en la imagen.
                </p>
              </div>

              {/* Generate Button */}
              <Button
                className="w-full bg-amber-500 hover:bg-amber-600"
                size="lg"
                onClick={handleShowPromptEditor}
                disabled={!Object.values(titles).some(t => t.trim()) || !fontsLoaded}
              >
                <Wand2 className="h-5 w-5 mr-2" />
                Continuar
              </Button>
            </CardContent>
          </Card>

        </div>
      )}

      {/* Phase: Prompt Editor */}
      {phase === 'prompt' && (
        <Card>
          <CardHeader>
            <CardTitle>Prompt para Ilustración</CardTitle>
            <CardDescription>
              Describe qué ilustración quieres o edita el prompt directamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User-friendly theme input in Spanish */}
            <div className="space-y-2">
              <Label htmlFor="illustration-theme">¿Qué ilustración quieres?</Label>
              <Input
                id="illustration-theme"
                value={illustrationTheme}
                onChange={(e) => {
                  setIllustrationTheme(e.target.value);
                  // Auto-update prompt when theme changes
                  if (e.target.value.trim()) {
                    setCustomPrompt(buildDefaultPrompt(eventType, e.target.value));
                  }
                }}
                placeholder="Ej: Una familia reunida alrededor de una mesa compartiendo pan"
                className="text-base"
              />
              <p className="text-xs text-muted-foreground">
                Describe lo que quieres ver. Se combinará con las directrices de estilo CASA automáticamente.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt (editable)</Label>
              <textarea
                id="prompt"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="w-full min-h-[200px] p-3 border rounded-md font-mono text-sm resize-y"
                placeholder="Describe la ilustración que deseas..."
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPhase('form')}
                className="flex-1"
              >
                Volver
              </Button>
              <Button
                variant="outline"
                onClick={() => setCustomPrompt(buildDefaultPrompt(eventType, illustrationTheme))}
              >
                Restaurar Default
              </Button>
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600"
                onClick={handleGenerateIllustrations}
                disabled={!customPrompt.trim()}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Generar Ilustraciones
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase: Prompt Preview (textBakedIn mode) */}
      {phase === 'prompt-preview' && (
        <Card>
          <CardHeader>
            <CardTitle>Revisar Prompt</CardTitle>
            <CardDescription>
              Este es el prompt estructurado que se enviará a la API. Puedes editarlo antes de generar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Prompt para Nano Banana Pro</Label>
              <Textarea
                value={editablePrompt}
                onChange={(e) => setEditablePrompt(e.target.value)}
                className="min-h-[300px] font-mono text-xs resize-y bg-gray-50 leading-relaxed"
                spellCheck={false}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPhase('form')}
                className="flex-1"
              >
                Volver
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  // Rebuild the prompt from current form data
                  const eventData: EventData = {
                    title: titles.instagram_post || titles.ppt_4_3 || 'Título del Evento',
                    subtitle: includeSubtitle ? subtitle : undefined,
                    date: includeDate ? (formatDateRange(dateRange) || '') : '',
                    time: includeTime ? (time || '') : '',
                    location: includeLocation ? (location || '') : '',
                  };
                  const promptStr = buildJsonPromptString(eventData, eventType, 'instagram_post', {
                    includeSubtitle,
                    extraInfo: includeExtraInfo ? extraInfo : undefined,
                  });
                  setEditablePrompt(promptStr);
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Restaurar
              </Button>
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600"
                onClick={handleGenerateIllustrations}
                disabled={!editablePrompt.trim()}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Generar Ilustraciones
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase: Selecting Illustration */}
      {phase === 'selecting' && (
        <Card>
          <CardHeader>
            <CardTitle>Selecciona una Ilustración</CardTitle>
            <CardDescription>
              Haz clic en la que más te guste para continuar
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingIllustrations ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-amber-500 mb-4" />
                <p className="text-muted-foreground">Generando 4 opciones...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {illustrations.map((base64, index) => (
                    <div
                      key={index}
                      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all hover:border-amber-400 ${
                        selectedIllustration === index
                          ? 'border-amber-500 ring-2 ring-amber-500'
                          : 'border-gray-200'
                      }`}
                      onClick={() => handleSelectIllustration(index)}
                    >
                      {base64 ? (
                        <img
                          src={`data:image/png;base64,${base64}`}
                          alt={`Opción ${index + 1}`}
                          className="w-full aspect-square object-cover"
                        />
                      ) : (
                        <div className="w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                          <div className="text-center text-gray-400">
                            <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-sm">Sin ilustración</p>
                            <p className="text-xs">(Modo prueba)</p>
                          </div>
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-white/90 px-2 py-1 rounded text-sm font-medium">
                        Opción {index + 1}
                      </div>
                      {selectedIllustration === index && (
                        <div className="absolute top-2 right-2 bg-amber-500 text-white p-1 rounded-full">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleRegenerateIllustrations}
                    disabled={loadingIllustrations}
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerar Opciones
                  </Button>
                  <Button variant="ghost" onClick={handleReset}>
                    Volver
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Phase: Adjusting — Drag-and-Drop Editor */}
      {phase === 'adjusting' && (
        <Card>
          <CardHeader>
            <CardTitle>Ajustar Elementos</CardTitle>
            <CardDescription>
              Arrastra los elementos para posicionarlos. Selecciona uno para ver opciones de alineación y tamaño.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Selector de formato */}
            <div className="space-y-2">
              <Label>Formato</Label>
              <div className="flex flex-wrap gap-1">
                {(['ppt_4_3', 'instagram_post', 'instagram_story', 'facebook_post'] as FormatType[]).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setAdjustFormat(fmt)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      adjustFormat === fmt
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {FORMAT_LABELS[fmt]}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Settings */}
            <div className="space-y-2">
              <Label>Fondo</Label>
              <div className="flex items-center gap-4">
                <ToggleGroup
                  type="single"
                  value={backgroundSettings.mode}
                  onValueChange={(value: 'solid' | 'transparent') => {
                    if (value) {
                      setBackgroundSettings(prev => ({ ...prev, mode: value }));
                    }
                  }}
                >
                  <ToggleGroupItem value="solid" aria-label="Fondo solido">
                    Solido
                  </ToggleGroupItem>
                  <ToggleGroupItem value="transparent" aria-label="Fondo transparente">
                    Transparente
                  </ToggleGroupItem>
                </ToggleGroup>
                {backgroundSettings.mode === 'solid' && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="bg-color" className="text-sm">Color de fondo:</Label>
                    <input
                      id="bg-color"
                      type="color"
                      value={backgroundSettings.color || '#F9F7F5'}
                      onChange={(e) => setBackgroundSettings(prev => ({ ...prev, color: e.target.value }))}
                      className="h-8 w-16 rounded border cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Drag Canvas Editor */}
            <DragCanvasEditor
              format={adjustFormat}
              previewBase64={adjustPreview}
              previewLoading={adjustPreviewLoading}
              positions={elementPositions[adjustFormat]}
              onPositionsChange={(pos) =>
                setElementPositions((prev) => ({ ...prev, [adjustFormat]: pos }))
              }
              visibleFields={{
                subtitle: includeSubtitle,
                date: includeDate,
                time: includeTime,
                location: includeLocation,
              }}
              illustrationAspectRatio={illustrationAspectRatio}
              eventData={{
                title: titles[adjustFormat].replace(/\n/g, '\\n') || 'Título del Evento',
                subtitle: includeSubtitle ? subtitle : undefined,
                date: includeDate ? (formatDateRange(dateRange) || 'Fecha del evento') : '',
                time: includeTime ? (time || '19:00 hrs') : '',
                location: includeLocation ? (location || 'Ubicación del evento') : '',
              }}
              showCheckerboard={backgroundSettings.mode === 'transparent'}
            />

            {/* Botones de navegación */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setPhase('selecting')}
                className="flex-1"
              >
                Volver
              </Button>
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600"
                onClick={() => { setSelectedFormats([]); setPhase('format-select'); }}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Seleccionar Formatos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase: Format Selection */}
      {phase === 'format-select' && (
        <Card>
          <CardHeader>
            <CardTitle>Selecciona los formatos</CardTitle>
            <CardDescription>
              Elige qué versiones quieres generar. Cada formato consume tokens de la API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {(['ppt_4_3', 'instagram_post', 'instagram_story', 'facebook_post'] as FormatType[]).map((fmt) => {
                const dims = FORMAT_DIMENSIONS[fmt];
                const isSelected = selectedFormats.includes(fmt);
                return (
                  <div
                    key={fmt}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedFormats(prev =>
                        prev.includes(fmt)
                          ? prev.filter(f => f !== fmt)
                          : [...prev, fmt]
                      );
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          setSelectedFormats(prev =>
                            checked
                              ? [...prev, fmt]
                              : prev.filter(f => f !== fmt)
                          );
                        }}
                      />
                      <div>
                        <p className="font-medium text-sm">{FORMAT_LABELS[fmt]}</p>
                        <p className="text-xs text-muted-foreground">{dims.width} × {dims.height}</p>
                        <div
                          className="mt-2 border border-gray-300 bg-gray-50"
                          style={{
                            width: 60,
                            height: Math.round(60 * (dims.height / dims.width)),
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setPhase(textBakedIn ? 'selecting' : 'adjusting')}
              >
                Volver
              </Button>
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600"
                disabled={selectedFormats.length === 0}
                onClick={handleGenerateWithAdjustments}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Generar {selectedFormats.length} Formato{selectedFormats.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase: Generating Formats */}
      {phase === 'generating' && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-amber-500 mb-4" />
              <p className="text-lg font-medium">Generando {selectedFormats.length || 4} formato{(selectedFormats.length || 4) !== 1 ? 's' : ''}...</p>
              <p className="text-muted-foreground">
                {(selectedFormats.length > 0 ? selectedFormats : ['ppt_4_3', 'instagram_post', 'instagram_story', 'facebook_post'] as FormatType[]).map(f => FORMAT_LABELS[f]).join(', ')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase: Logo Adjustment (textBakedIn mode) — draggable logo per format */}
      {phase === 'logo-adjust' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ajustar Logo por Formato</CardTitle>
              <CardDescription>
                Arrastra el logo para posicionarlo. Cada formato tiene su propia posición, tamaño y visibilidad.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Per-format cards with draggable logo overlay */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rawGeneratedImages.map((raw) => {
              const ls = logoSettings[raw.format];
              const dims = FORMAT_DIMENSIONS[raw.format];
              return (
                <Card key={raw.format} className="overflow-hidden">
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{FORMAT_LABELS[raw.format]}</span>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`logo-toggle-${raw.format}`}
                          checked={ls.enabled}
                          onCheckedChange={(checked) =>
                            setLogoSettings(prev => ({
                              ...prev,
                              [raw.format]: { ...prev[raw.format], enabled: checked === true },
                            }))
                          }
                        />
                        <Label htmlFor={`logo-toggle-${raw.format}`} className="cursor-pointer text-xs">
                          Logo
                        </Label>
                      </div>
                    </div>
                  </CardHeader>
                  {/* Image container with draggable logo overlay */}
                  <div
                    className="relative select-none"
                    style={{ cursor: ls.enabled && logoBase64 ? 'default' : undefined }}
                    onMouseDown={(e) => {
                      if (!ls.enabled || !logoBase64) return;
                      const container = e.currentTarget;
                      const rect = container.getBoundingClientRect();
                      const displayWidth = rect.width;
                      const scale = dims.width / displayWidth;
                      // Check if click is on the logo area
                      const displayLogoX = ls.x / scale;
                      const displayLogoY = ls.y / scale;
                      const displayLogoSize = ls.size / scale;
                      const clickX = e.clientX - rect.left;
                      const clickY = e.clientY - rect.top;
                      if (
                        clickX >= displayLogoX &&
                        clickX <= displayLogoX + displayLogoSize &&
                        clickY >= displayLogoY &&
                        clickY <= displayLogoY + displayLogoSize
                      ) {
                        const offsetX = clickX - displayLogoX;
                        const offsetY = clickY - displayLogoY;
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const newDisplayX = moveEvent.clientX - rect.left - offsetX;
                          const newDisplayY = moveEvent.clientY - rect.top - offsetY;
                          const newX = Math.max(0, Math.min(dims.width - ls.size, Math.round(newDisplayX * scale)));
                          const newY = Math.max(0, Math.min(dims.height - ls.size, Math.round(newDisplayY * scale)));
                          setLogoSettings(prev => ({
                            ...prev,
                            [raw.format]: { ...prev[raw.format], x: newX, y: newY },
                          }));
                        };
                        const handleMouseUp = () => {
                          window.removeEventListener('mousemove', handleMouseMove);
                          window.removeEventListener('mouseup', handleMouseUp);
                        };
                        window.addEventListener('mousemove', handleMouseMove);
                        window.addEventListener('mouseup', handleMouseUp);
                        e.preventDefault();
                      }
                    }}
                  >
                    <img
                      src={`data:image/png;base64,${raw.base64}`}
                      alt={FORMAT_LABELS[raw.format]}
                      className="w-full"
                      draggable={false}
                    />
                    {/* Draggable logo overlay */}
                    {ls.enabled && logoBase64 && (
                      <img
                        src={`data:image/png;base64,${logoBase64}`}
                        alt="Logo CASA"
                        draggable={false}
                        className="absolute pointer-events-none"
                        style={{
                          left: `${(ls.x / dims.width) * 100}%`,
                          top: `${(ls.y / dims.height) * 100}%`,
                          width: `${(ls.size / dims.width) * 100}%`,
                          height: `${(ls.size / dims.height) * 100}%`,
                          objectFit: 'contain',
                        }}
                      />
                    )}
                  </div>
                  {/* Per-format size slider */}
                  {ls.enabled && (
                    <CardContent className="py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Tamaño: {ls.size}px</Label>
                      </div>
                      <Slider
                        min={30}
                        max={200}
                        step={5}
                        value={[ls.size]}
                        onValueChange={([val]) =>
                          setLogoSettings(prev => ({
                            ...prev,
                            [raw.format]: { ...prev[raw.format], size: val },
                          }))
                        }
                      />
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setPhase('format-select')}
            >
              Volver
            </Button>
            <Button
              className="flex-1 bg-amber-500 hover:bg-amber-600"
              onClick={handleApplyLogo}
              disabled={generatingFormats}
            >
              {generatingFormats ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Finalizar
            </Button>
          </div>
        </div>
      )}

      {/* Phase: Done - Show Results */}
      {phase === 'done' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Gráficos Listos
              </CardTitle>
              <CardDescription>
                Descarga los formatos que necesites
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {generatedGraphics.map((graphic) => (
                  <div
                    key={graphic.format}
                    className="relative rounded-lg overflow-hidden border border-gray-200"
                  >
                    <img
                      src={`data:image/png;base64,${graphic.base64}`}
                      alt={FORMAT_LABELS[graphic.format]}
                      className="w-full"
                      style={{
                        aspectRatio:
                          graphic.format === 'instagram_story'
                            ? '9/16'
                            : graphic.format === 'instagram_post'
                            ? '1/1'
                            : graphic.format === 'facebook_post'
                            ? '1200/630'
                            : '4/3',
                      }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium text-sm">
                          {FORMAT_LABELS[graphic.format]}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDownload(graphic)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => setPhase(textBakedIn ? 'logo-adjust' : 'adjusting')}
                >
                  {textBakedIn ? 'Ajustar Logo' : 'Volver a Ajustar'}
                </Button>
                <Button
                  className="flex-1 bg-amber-500 hover:bg-amber-600"
                  onClick={handleDownloadAll}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Descargar Todos
                </Button>
                <Button
                  variant="outline"
                  onClick={handleOpenSaveDialog}
                  disabled={batchSaved}
                  className={batchSaved ? 'text-green-600 border-green-600' : ''}
                >
                  {batchSaved ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Guardado
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Crear Nuevo
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview of event info */}
          <Card className="bg-gray-50">
            <CardContent className="pt-4">
              <h3 className="font-medium mb-2">Resumen del evento:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li><strong>Título:</strong> {titles.ppt_4_3}</li>
                {includeSubtitle && subtitle && <li><strong>Subtítulo:</strong> {subtitle}</li>}
                <li><strong>Fecha:</strong> {formatDateRange(dateRange)}</li>
                <li><strong>Hora:</strong> {time}</li>
                <li><strong>Ubicación:</strong> {location}</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Save Batch Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar Gráficos</DialogTitle>
            <DialogDescription>
              Guarda este batch de gráficos para usarlos más tarde en anuncios u otros componentes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batch-name">Nombre del batch</Label>
              <Input
                id="batch-name"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Ej: La Mesa Abierta - Enero 2025"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Se guardarán los 4 formatos:</p>
              <ul className="list-disc list-inside mt-1">
                <li>PowerPoint 4:3</li>
                <li>Instagram Post</li>
                <li>Instagram Story</li>
                <li>Facebook Post</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              disabled={savingBatch}
            >
              Cancelar
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600"
              onClick={handleSaveBatch}
              disabled={!batchName.trim() || savingBatch}
            >
              {savingBatch ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Batch
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GraphicsGeneratorV2;
