import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  Check,
  X,
  RefreshCw,
  Archive,
  ArrowLeft,
  CheckCircle,
  Settings,
  TreePine,
  Utensils,
  Church,
  Leaf,
  Baby,
  Headphones,
  Heart,
  Users,
  Dumbbell,
  HandHeart,
  Tag,
  Palette,
  Star,
  Music,
  Gift,
  Camera,
  Book,
  Coffee,
  Flower2,
  Sun,
  Moon,
  Cloud,
  Sparkles,
  CalendarIcon,
} from 'lucide-react';
import {
  OUTPUT_FORMATS,
  type OutputFormat,
  type PatternGeneratedImage,
  type OverlayContent,
} from './constants';
import { compositeGraphic, preloadFonts } from './canvasCompositor';
import { ThemeManager, type GraphicsTheme } from './ThemeManager';

type WorkflowPhase = 'design' | 'selection' | 'adaptation';

// Dynamic icon mapping for database themes
const ICON_COMPONENTS: Record<string, React.ReactNode> = {
  TreePine: <TreePine className="h-5 w-5" />,
  Utensils: <Utensils className="h-5 w-5" />,
  Church: <Church className="h-5 w-5" />,
  Leaf: <Leaf className="h-5 w-5" />,
  Baby: <Baby className="h-5 w-5" />,
  Headphones: <Headphones className="h-5 w-5" />,
  Heart: <Heart className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
  Dumbbell: <Dumbbell className="h-5 w-5" />,
  HandHeart: <HandHeart className="h-5 w-5" />,
  Tag: <Tag className="h-5 w-5" />,
  Palette: <Palette className="h-5 w-5" />,
  Star: <Star className="h-5 w-5" />,
  Music: <Music className="h-5 w-5" />,
  Gift: <Gift className="h-5 w-5" />,
  Camera: <Camera className="h-5 w-5" />,
  Book: <Book className="h-5 w-5" />,
  Coffee: <Coffee className="h-5 w-5" />,
  Flower2: <Flower2 className="h-5 w-5" />,
  Sun: <Sun className="h-5 w-5" />,
  Moon: <Moon className="h-5 w-5" />,
  Cloud: <Cloud className="h-5 w-5" />,
  Sparkles: <Sparkles className="h-5 w-5" />,
};

// Build pattern prompt from database theme
function buildPatternPromptFromTheme(theme: GraphicsTheme, aspectRatio: string): string {
  // Use first 5 elements for variety
  const selectedElements = theme.elements.slice(0, 5);

  return `Create a sparse decorative doodle pattern on cream background.

ABSOLUTE RULE: NO ALPHABET LETTERS. No A, B, C, no words, no text, no writing, no typography whatsoever. If you generate any letter of any alphabet, you have failed.

BACKGROUND: Solid warm cream color (#F5F0E6)

DOODLES TO DRAW (simple line art only):
${selectedElements.map(e => `- ${e}`).join('\n')}

STYLE:
- Thin charcoal pencil sketch lines (#4A4A4A)
- Very simple, minimalist drawings
- SPARSE placement - lots of empty cream space
- Objects concentrated near edges, center mostly empty

DENSITY: Light and airy. Maximum 60% coverage. Leave breathing room.

Remember: ZERO letters, ZERO text, ZERO alphabet characters.`;
}

export const GraphicsGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Admin check state
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  // View state
  const [showThemeManager, setShowThemeManager] = useState(false);

  // Themes from database
  const [themes, setThemes] = useState<GraphicsTheme[]>([]);
  const [loadingThemes, setLoadingThemes] = useState(true);

  // Workflow state
  const [workflowPhase, setWorkflowPhase] = useState<WorkflowPhase>('design');
  const [designVariations, setDesignVariations] = useState<PatternGeneratedImage[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<PatternGeneratedImage | null>(null);
  const [adaptedImages, setAdaptedImages] = useState<PatternGeneratedImage[]>([]);

  // Form state - Dynamic theme from database
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<OutputFormat[]>(['instagram_feed', 'instagram_story']);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [variationCount, setVariationCount] = useState(3);

  // Event details state (for overlay)
  const [eventDetails, setEventDetails] = useState({
    title: '',
    subtitle: '',
    date: '',
    time: '',
    location: '',
  });

  // Date range picker state
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Format date range for display
  const formatDateRange = (range: DateRange | undefined): string => {
    if (!range?.from) return '';

    if (!range.to || range.from.getTime() === range.to.getTime()) {
      // Single date
      return format(range.from, "d 'de' MMMM", { locale: es });
    }

    // Date range
    const fromMonth = range.from.getMonth();
    const toMonth = range.to.getMonth();

    if (fromMonth === toMonth) {
      // Same month: "15 - 20 de Diciembre"
      return `${format(range.from, 'd', { locale: es })} - ${format(range.to, "d 'de' MMMM", { locale: es })}`;
    } else {
      // Different months: "28 de Dic - 3 de Enero"
      return `${format(range.from, "d 'de' MMM", { locale: es })} - ${format(range.to, "d 'de' MMM", { locale: es })}`;
    }
  };

  // Update eventDetails.date when dateRange changes
  useEffect(() => {
    const formattedDate = formatDateRange(dateRange);
    setEventDetails(prev => ({ ...prev, date: formattedDate }));
  }, [dateRange]);

  // Logo base64 (from edge function response)
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Get selected theme object
  const selectedTheme = themes.find(t => t.id === selectedThemeId) || null;

  // Real-time prompt preview - updates as user fills form
  const livePromptPreview = selectedTheme
    ? buildPatternPromptFromTheme(selectedTheme, '1:1')
    : 'Selecciona un tema para ver el prompt...';

  // Fetch themes from database
  const fetchThemes = async () => {
    setLoadingThemes(true);
    const { data, error } = await supabase
      .from('graphics_themes')
      .select('*')
      .eq('is_active', true)
      .order('label');

    if (error) {
      console.error('Error fetching themes:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los temas.',
        variant: 'destructive',
      });
    } else {
      setThemes(data || []);
      // Select first theme by default
      if (data && data.length > 0 && !selectedThemeId) {
        setSelectedThemeId(data[0].id);
      }
    }
    setLoadingThemes(false);
  };

  // Preload fonts on mount
  useEffect(() => {
    preloadFonts()
      .then(() => setFontsLoaded(true))
      .catch(console.warn);
  }, []);

  // Load themes on mount
  useEffect(() => {
    fetchThemes();
  }, []);

  // Check if user is admin
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

  // Build overlay config from event details
  // Note: logo.base64 will be set separately when calling applyOverlay
  const buildOverlayConfig = (): OverlayContent => ({
    logo: {
      visible: includeLogo,
      base64: undefined, // Will be set when we have the logo from edge function
    },
    title: {
      visible: !!eventDetails.title,
      text: eventDetails.title,
    },
    subtitle: {
      visible: !!eventDetails.subtitle,
      text: eventDetails.subtitle,
    },
    infoBar: {
      visible: !!(eventDetails.date || eventDetails.time || eventDetails.location),
      date: eventDetails.date || undefined,
      time: eventDetails.time || undefined,
      location: eventDetails.location || undefined,
    },
  });

  const handleFormatToggle = (format: OutputFormat) => {
    setSelectedFormats(prev =>
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  const selectAllFormats = () => {
    setSelectedFormats(Object.keys(OUTPUT_FORMATS) as OutputFormat[]);
  };

  const clearAllFormats = () => {
    setSelectedFormats([]);
  };

  // Apply overlay to pattern image using canvas compositor
  const applyOverlay = async (
    patternBase64: string,
    width: number,
    height: number,
    overlay: OverlayContent,
    variationIndex: number = 0
  ): Promise<string> => {
    return compositeGraphic({
      width,
      height,
      backgroundBase64: patternBase64,
      overlay,
      variationIndex
    });
  };

  // Phase 1: Generate pattern variations (all 1:1)
  const handleGenerateVariations = async () => {
    if (!eventDetails.title) {
      toast({
        title: 'Título requerido',
        description: 'Por favor ingresa un título para el evento.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedTheme) {
      toast({
        title: 'Tema requerido',
        description: 'Por favor selecciona un tema de ilustración.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setWorkflowPhase('design');
    setSelectedDesign(null);
    setAdaptedImages([]);

    // Initialize variations as pending
    const initialVariations: PatternGeneratedImage[] = Array.from({ length: variationCount }, (_, i) => ({
      id: `variation-${i}-${Date.now()}`,
      format: 'instagram_feed' as OutputFormat,
      aspectRatio: '1:1',
      prompt: buildPatternPromptFromTheme(selectedTheme!, '1:1'),
      generatedAt: new Date(),
      status: 'pending' as const,
      illustrationTheme: selectedTheme?.key as any,
    }));

    setDesignVariations(initialVariations);

    // Generate each variation
    for (let i = 0; i < variationCount; i++) {
      // Update status to generating
      setDesignVariations(prev =>
        prev.map((img, idx) =>
          idx === i ? { ...img, status: 'generating' as const } : img
        )
      );

      try {
        const patternPrompt = buildPatternPromptFromTheme(selectedTheme!, '1:1');
        const variationPrompt = `${patternPrompt}\n\nVariation ${i + 1} of ${variationCount}: Create a unique arrangement of the decorative elements.`;

        const { data, error } = await supabase.functions.invoke('generate-graphic', {
          body: {
            prompt: variationPrompt,
            format: 'instagram_feed',
            aspectRatio: '1:1',
            category: selectedTheme?.key,
            includeLogo: false, // Logo handled by compositor
            patternOnly: true,
            illustrationTheme: selectedTheme?.key,
          },
        });

        if (error) throw error;

        // Store logo base64 from response
        const currentLogo = data.logoBase64 || logoBase64;
        console.log('[GraphicsGenerator] Logo debug:', {
          hasLogoFromResponse: !!data.logoBase64,
          logoLength: data.logoBase64?.length || 0,
          includeLogo,
          currentLogoAvailable: !!currentLogo
        });

        if (data.logoBase64 && !logoBase64) {
          setLogoBase64(data.logoBase64);
        }

        // Apply overlay to the pattern - use the logo directly from response
        const overlayConfig = buildOverlayConfig();
        if (includeLogo && currentLogo) {
          overlayConfig.logo.base64 = currentLogo;
          overlayConfig.logo.visible = true;
          console.log('[GraphicsGenerator] Logo will be drawn, base64 length:', currentLogo.length);
        } else {
          console.log('[GraphicsGenerator] Logo NOT being drawn. includeLogo:', includeLogo, 'currentLogo:', !!currentLogo);
        }

        const compositedBase64 = await applyOverlay(
          data.base64,
          1080, // Instagram feed width
          1080, // Instagram feed height (1:1)
          overlayConfig,
          i // Pass iteration index for style variation
        );

        setDesignVariations(prev =>
          prev.map((img, idx) =>
            idx === i
              ? {
                ...img,
                status: 'completed' as const,
                base64: compositedBase64,
                patternBase64: data.base64,
                overlayConfig,
              }
              : img
          )
        );
      } catch (err: any) {
        console.error(`Error generating variation ${i}:`, err);

        // FALLBACK: If API fails (e.g. network error), utilize local fallback
        // so user can still verify the Text Layout logic without backend.
        console.warn('API Failed, using fallback pattern to verify compositor.');

        try {
          // Use existing logo if available
          const currentLogo = logoBase64;
          const overlayConfig = buildOverlayConfig();

          if (includeLogo && currentLogo) {
            overlayConfig.logo.base64 = currentLogo;
            overlayConfig.logo.visible = true;
          }

          // 1x1 Transparent Pixel (The compositor fills background with Cream anyway)
          const fallbackPattern = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

          const compositedBase64 = await applyOverlay(
            fallbackPattern,
            1080,
            1080,
            overlayConfig,
            i
          );

          setDesignVariations(prev =>
            prev.map((img, idx) =>
              idx === i
                ? {
                  ...img,
                  status: 'completed' as const,
                  base64: compositedBase64,
                  patternBase64: fallbackPattern,
                  overlayConfig,
                }
                : img
            )
          );

          toast({
            title: 'Modo Offline (Fallback)',
            description: 'Error de conexión. Se generó una vista previa local para verificar el diseño de texto.',
            variant: 'destructive',
          });

        } catch (composeErr) {
          setDesignVariations(prev =>
            prev.map((img, idx) =>
              idx === i
                ? {
                  ...img,
                  status: 'failed' as const,
                  error: err.message || 'Error de conexión y Fallback falló',
                }
                : img
            )
          );
        }
      }
    }

    setIsGenerating(false);
    setWorkflowPhase('selection');

    toast({
      title: 'Variaciones generadas',
      description: `Se han generado ${variationCount} variaciones de diseño. Selecciona tu favorita.`,
    });
  };

  // Select a design for adaptation
  const handleSelectDesign = (image: PatternGeneratedImage) => {
    setSelectedDesign(image);
  };

  // Phase 2: Generate adaptations in different aspect ratios
  const handleGenerateAdaptations = async () => {
    if (!selectedDesign || !selectedDesign.patternBase64) {
      toast({
        title: 'Error',
        description: 'Primero selecciona un diseño completado.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedFormats.length === 0) {
      toast({
        title: 'Selecciona formatos',
        description: 'Debes seleccionar al menos un formato de salida.',
        variant: 'destructive',
      });
      return;
    }

    // Filter out 1:1 format since we already have it
    const formatsToGenerate = selectedFormats.filter(f => f !== 'instagram_feed');

    if (formatsToGenerate.length === 0) {
      toast({
        title: 'Formatos ya generados',
        description: 'El formato 1:1 ya está disponible en tu diseño seleccionado.',
      });
      return;
    }

    setIsGenerating(true);
    setWorkflowPhase('adaptation');

    // Initialize adapted images as pending
    const initialAdapted: PatternGeneratedImage[] = formatsToGenerate.map(format => ({
      id: `${format}-${Date.now()}`,
      format,
      aspectRatio: OUTPUT_FORMATS[format].ratio,
      prompt: buildPatternPromptFromTheme(selectedTheme!, OUTPUT_FORMATS[format].ratio),
      generatedAt: new Date(),
      status: 'pending' as const,
      illustrationTheme: selectedTheme?.key as any,
    }));

    // Include the original selected design
    setAdaptedImages([
      { ...selectedDesign, status: 'completed' as const },
      ...initialAdapted,
    ]);

    // Generate each adaptation
    for (let i = 0; i < formatsToGenerate.length; i++) {
      const format = formatsToGenerate[i];
      const formatConfig = OUTPUT_FORMATS[format];

      // Update status to generating
      setAdaptedImages(prev =>
        prev.map(img =>
          img.format === format ? { ...img, status: 'generating' as const } : img
        )
      );

      try {
        const patternPrompt = buildPatternPromptFromTheme(selectedTheme!, formatConfig.ratio);

        const { data, error } = await supabase.functions.invoke('generate-graphic', {
          body: {
            prompt: patternPrompt,
            format,
            aspectRatio: formatConfig.geminiRatio,
            category: selectedTheme?.key,
            includeLogo: false,
            patternOnly: true,
            illustrationTheme: selectedTheme?.key,
            // Pass reference pattern for consistent style
            referenceImage: selectedDesign.patternBase64,
          },
        });

        if (error) throw error;

        // Calculate dimensions for this format
        const baseWidth = 1080;
        const [ratioW, ratioH] = formatConfig.ratio.split(':').map(Number);
        const width = baseWidth;
        const height = Math.round(baseWidth * (ratioH / ratioW));

        // Apply overlay - use logo from response or state
        const currentLogo = data.logoBase64 || logoBase64;
        const overlayConfig = buildOverlayConfig();
        if (includeLogo && currentLogo) {
          overlayConfig.logo.base64 = currentLogo;
          overlayConfig.logo.visible = true;
        }

        const compositedBase64 = await applyOverlay(
          data.base64,
          width,
          height,
          overlayConfig
        );

        setAdaptedImages(prev =>
          prev.map(img =>
            img.format === format
              ? {
                ...img,
                status: 'completed' as const,
                base64: compositedBase64,
                patternBase64: data.base64,
                overlayConfig,
              }
              : img
          )
        );
      } catch (err: any) {
        console.error(`Error generating ${format}:`, err);

        setAdaptedImages(prev =>
          prev.map(img =>
            img.format === format
              ? {
                ...img,
                status: 'failed' as const,
                error: err.message || 'Error desconocido',
              }
              : img
          )
        );
      }
    }

    setIsGenerating(false);

    toast({
      title: 'Adaptaciones completadas',
      description: `Se han procesado ${formatsToGenerate.length + 1} imágenes.`,
    });
  };

  const downloadImage = async (image: PatternGeneratedImage) => {
    if (!image.base64) return;

    try {
      const format = OUTPUT_FORMATS[image.format];
      const filename = `casa-${selectedTheme?.key || "theme"}-${image.format}-${Date.now()}.png`;

      const link = document.createElement('a');
      link.href = `data:image/png;base64,${image.base64}`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Descarga iniciada',
        description: `Descargando ${format.label}...`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'No se pudo descargar la imagen.',
        variant: 'destructive',
      });
    }
  };

  const downloadAllImages = async () => {
    const completedImages = adaptedImages.filter(img => img.status === 'completed');

    if (completedImages.length === 0) {
      toast({
        title: 'Sin imágenes',
        description: 'No hay imágenes completadas para descargar.',
        variant: 'destructive',
      });
      return;
    }

    for (const image of completedImages) {
      await downloadImage(image);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const retryGeneration = async (image: PatternGeneratedImage, inPhase: 'variations' | 'adaptations') => {
    const updateFn = inPhase === 'variations' ? setDesignVariations : setAdaptedImages;

    updateFn(prev =>
      prev.map(img =>
        img.id === image.id ? { ...img, status: 'generating' as const, error: undefined } : img
      )
    );

    try {
      const formatConfig = OUTPUT_FORMATS[image.format];
      const patternPrompt = buildPatternPromptFromTheme(selectedTheme!, formatConfig.ratio);

      const { data, error } = await supabase.functions.invoke('generate-graphic', {
        body: {
          prompt: patternPrompt,
          format: image.format,
          aspectRatio: formatConfig.geminiRatio,
          category: selectedTheme?.key,
          includeLogo: false,
          patternOnly: true,
          illustrationTheme: selectedTheme?.key,
        },
      });

      if (error) throw error;

      // Calculate dimensions
      const baseWidth = 1080;
      const [ratioW, ratioH] = formatConfig.ratio.split(':').map(Number);
      const width = baseWidth;
      const height = Math.round(baseWidth * (ratioH / ratioW));

      // Apply overlay
      const overlayConfig = buildOverlayConfig();
      overlayConfig.logo.base64 = data.logoBase64 || logoBase64 || undefined;

      const compositedBase64 = await applyOverlay(
        data.base64,
        width,
        height,
        overlayConfig
      );

      updateFn(prev =>
        prev.map(img =>
          img.id === image.id
            ? {
              ...img,
              status: 'completed' as const,
              base64: compositedBase64,
              patternBase64: data.base64,
              overlayConfig,
            }
            : img
        )
      );
    } catch (err: any) {
      updateFn(prev =>
        prev.map(img =>
          img.id === image.id
            ? {
              ...img,
              status: 'failed' as const,
              error: err.message || 'Error desconocido',
            }
            : img
        )
      );
    }
  };

  const resetToDesign = () => {
    setWorkflowPhase('design');
    setSelectedDesign(null);
    setAdaptedImages([]);
  };

  const resetToSelection = () => {
    setWorkflowPhase('selection');
    setAdaptedImages([]);
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

  // Render image card
  const renderImageCard = (
    image: PatternGeneratedImage,
    phase: 'variations' | 'adaptations',
    isSelectable?: boolean
  ) => {
    const format = OUTPUT_FORMATS[image.format];
    const isSelected = selectedDesign?.id === image.id;

    return (
      <Card
        key={image.id}
        className={`overflow-hidden transition-all ${isSelectable
          ? 'cursor-pointer hover:ring-2 hover:ring-amber-500'
          : ''
          } ${isSelected ? 'ring-2 ring-amber-500' : ''}`}
        onClick={isSelectable && image.status === 'completed' ? () => handleSelectDesign(image) : undefined}
      >
        <div
          className="relative bg-gray-100"
          style={{ aspectRatio: format.ratio.replace(':', '/') }}
        >
          {image.status === 'pending' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                <span className="text-sm">En espera...</span>
              </div>
            </div>
          )}

          {image.status === 'generating' && (
            <div className="absolute inset-0 flex items-center justify-center bg-amber-50">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-2" />
                <span className="text-sm text-amber-600">Generando...</span>
              </div>
            </div>
          )}

          {image.status === 'completed' && image.base64 && (
            <>
              <img
                src={`data:image/png;base64,${image.base64}`}
                alt={format.label}
                className="w-full h-full object-cover"
              />
              {isSelected && (
                <div className="absolute top-2 right-2 bg-amber-500 text-white p-1 rounded-full">
                  <CheckCircle className="h-5 w-5" />
                </div>
              )}
            </>
          )}

          {image.status === 'failed' && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50">
              <div className="text-center p-4">
                <X className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <span className="text-sm text-red-600 block mb-2">
                  {image.error || 'Error al generar'}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    retryGeneration(image, phase);
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Reintentar
                </Button>
              </div>
            </div>
          )}
        </div>

        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{format.label}</p>
              <p className="text-xs text-muted-foreground">{format.ratio}</p>
            </div>
            {image.status === 'completed' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadImage(image);
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Show theme manager if toggled
  if (showThemeManager) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              setShowThemeManager(false);
              fetchThemes(); // Refresh themes when returning
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al Generador
          </Button>
        </div>
        <ThemeManager />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Generador de Gráficos CASA</h1>
          <p className="text-muted-foreground">
            Crea gráficos profesionales con ilustraciones de línea
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedTheme && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              {selectedTheme.label}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowThemeManager(true)}
          >
            <Settings className="h-4 w-4 mr-1" />
            Temas
          </Button>
        </div>
      </div>

      {/* Workflow Progress */}
      <div className="flex items-center gap-2 text-sm">
        <Badge
          variant={workflowPhase === 'design' ? 'default' : 'outline'}
          className={workflowPhase === 'design' ? 'bg-amber-500' : ''}
        >
          1. Diseño
        </Badge>
        <span className="text-muted-foreground">→</span>
        <Badge
          variant={workflowPhase === 'selection' ? 'default' : 'outline'}
          className={workflowPhase === 'selection' ? 'bg-amber-500' : ''}
        >
          2. Selección
        </Badge>
        <span className="text-muted-foreground">→</span>
        <Badge
          variant={workflowPhase === 'adaptation' ? 'default' : 'outline'}
          className={workflowPhase === 'adaptation' ? 'bg-amber-500' : ''}
        >
          3. Formatos
        </Badge>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column: Form */}
        <div className="space-y-4">
          {/* Theme Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Tema de Ilustración</CardTitle>
              <CardDescription>
                Selecciona el estilo visual para tu gráfico
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingThemes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                </div>
              ) : themes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No hay temas disponibles.</p>
                  <Button
                    variant="link"
                    onClick={() => setShowThemeManager(true)}
                    className="text-amber-600"
                  >
                    Crear un tema
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {themes.map((theme) => (
                    <Button
                      key={theme.id}
                      variant={selectedThemeId === theme.id ? 'default' : 'outline'}
                      className={`h-auto py-2 px-2 flex flex-col items-center gap-1 text-center ${selectedThemeId === theme.id ? 'bg-amber-500 hover:bg-amber-600' : ''
                        }`}
                      onClick={() => setSelectedThemeId(theme.id)}
                      disabled={workflowPhase !== 'design'}
                    >
                      {ICON_COMPONENTS[theme.icon] || <Palette className="h-5 w-5" />}
                      <span className="text-xs leading-tight">{theme.label}</span>
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Event Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Detalles del Evento</CardTitle>
              <CardDescription>
                Información que aparecerá en el gráfico
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="event-title">
                  Título Principal <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="event-title"
                  value={eventDetails.title}
                  onChange={(e) => setEventDetails(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej: Bazar Navideño"
                  disabled={workflowPhase !== 'design'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-subtitle">Subtítulo</Label>
                <Input
                  id="event-subtitle"
                  value={eventDetails.subtitle}
                  onChange={(e) => setEventDetails(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Ej: Comunidad Anglicana San Andrés"
                  disabled={workflowPhase !== 'design'}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${!dateRange?.from ? 'text-muted-foreground' : ''
                          }`}
                        disabled={workflowPhase !== 'design'}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          formatDateRange(dateRange)
                        ) : (
                          <span>Seleccionar fecha</span>
                        )}
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
                      <div className="p-3 border-t text-xs text-muted-foreground">
                        Selecciona una fecha o un rango de fechas
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-time">Hora</Label>
                  <Input
                    id="event-time"
                    value={eventDetails.time}
                    onChange={(e) => setEventDetails(prev => ({ ...prev, time: e.target.value }))}
                    placeholder="Ej: 10:30 AM"
                    disabled={workflowPhase !== 'design'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-location">Lugar</Label>
                <Input
                  id="event-location"
                  value={eventDetails.location}
                  onChange={(e) => setEventDetails(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Ej: Templo Principal"
                  disabled={workflowPhase !== 'design'}
                />
              </div>

              {/* Include Logo Option */}
              <div className="flex items-center space-x-3 pt-2 p-3 rounded-lg border bg-amber-50 border-amber-200">
                <Checkbox
                  id="include-logo"
                  checked={includeLogo}
                  onCheckedChange={(checked) => setIncludeLogo(checked === true)}
                  disabled={workflowPhase !== 'design'}
                />
                <div className="flex-1">
                  <Label htmlFor="include-logo" className="cursor-pointer font-medium">
                    Incluir logo CASA
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    El logo aparecerá centrado en la parte superior
                  </p>
                </div>
                <img
                  src="/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png"
                  alt="CASA Logo"
                  className="h-10 w-10 object-contain"
                />
              </div>
            </CardContent>
          </Card>

          {/* Variation Count (Phase 1) */}
          {workflowPhase === 'design' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">3. Número de Variaciones</CardTitle>
                <CardDescription>
                  ¿Cuántas opciones de diseño quieres ver?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {[2, 3, 4].map((count) => (
                    <Button
                      key={count}
                      variant={variationCount === count ? 'default' : 'outline'}
                      className={variationCount === count ? 'bg-amber-500 hover:bg-amber-600' : ''}
                      onClick={() => setVariationCount(count)}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Output Formats (Phase 2) */}
          {workflowPhase === 'selection' && selectedDesign && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">3. Formatos de Salida</CardTitle>
                <CardDescription>
                  Selecciona los formatos que necesitas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Button size="sm" variant="outline" onClick={selectAllFormats}>
                    Todos
                  </Button>
                  <Button size="sm" variant="outline" onClick={clearAllFormats}>
                    Ninguno
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(OUTPUT_FORMATS) as [OutputFormat, typeof OUTPUT_FORMATS[OutputFormat]][]).map(
                    ([key, format]) => (
                      <div
                        key={key}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedFormats.includes(key)
                          ? 'bg-amber-50 border-amber-500'
                          : 'hover:bg-gray-50'
                          }`}
                        onClick={() => handleFormatToggle(key)}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedFormats.includes(key)}
                            className="pointer-events-none"
                          />
                          <div>
                            <p className="font-medium text-sm">{format.label}</p>
                            <p className="text-xs text-muted-foreground">{format.ratio}</p>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Live Prompt Preview */}
          {workflowPhase === 'design' && (
            <Card className="border-dashed border-slate-300 bg-slate-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Vista Previa del Prompt (en tiempo real)
                </CardTitle>
                <CardDescription className="text-xs">
                  Este es el prompt que se enviará a Gemini
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-white border border-slate-200 p-3 rounded-lg overflow-auto max-h-[200px] whitespace-pre-wrap font-mono text-slate-700">
                  {livePromptPreview}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Generate Button */}
          {workflowPhase === 'design' && (
            <Button
              className="w-full bg-amber-500 hover:bg-amber-600"
              size="lg"
              onClick={handleGenerateVariations}
              disabled={isGenerating || !eventDetails.title || !fontsLoaded || !selectedTheme}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generando variaciones...
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5 mr-2" />
                  Generar {variationCount} Variaciones
                </>
              )}
            </Button>
          )}

          {/* Selection Phase Buttons */}
          {workflowPhase === 'selection' && (
            <div className="space-y-2">
              {/* Show generate adaptations only if design selected */}
              {selectedDesign && (
                <Button
                  className="w-full bg-amber-500 hover:bg-amber-600"
                  size="lg"
                  onClick={handleGenerateAdaptations}
                  disabled={isGenerating || selectedFormats.length === 0}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Generando adaptaciones...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-5 w-5 mr-2" />
                      Generar en {selectedFormats.length} Formatos
                    </>
                  )}
                </Button>
              )}

              {/* Regenerate variations button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGenerateVariations}
                disabled={isGenerating}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerar Variaciones
              </Button>

              {/* Back to edit parameters */}
              <Button
                variant="ghost"
                className="w-full"
                onClick={resetToDesign}
                disabled={isGenerating}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Editar Parámetros
              </Button>
            </div>
          )}

          {/* Download All Button */}
          {workflowPhase === 'adaptation' && (
            <div className="space-y-2">
              <Button
                className="w-full"
                variant="outline"
                onClick={downloadAllImages}
                disabled={adaptedImages.filter(img => img.status === 'completed').length === 0}
              >
                <Archive className="h-4 w-4 mr-2" />
                Descargar Todas las Imágenes
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={resetToSelection}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a selección
              </Button>
            </div>
          )}
        </div>

        {/* Right Column: Preview */}
        <div className="space-y-4">
          {/* Design Variations (Phase 1 & 2) */}
          {(workflowPhase === 'design' || workflowPhase === 'selection') && designVariations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  {workflowPhase === 'design' ? 'Generando Variaciones...' : 'Selecciona un Diseño'}
                </CardTitle>
                <CardDescription>
                  {workflowPhase === 'selection'
                    ? 'Haz clic en el diseño que prefieras para continuar'
                    : 'Las variaciones se generan una por una'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {designVariations.map((image) =>
                    renderImageCard(image, 'variations', workflowPhase === 'selection')
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Adapted Images (Phase 3) */}
          {workflowPhase === 'adaptation' && adaptedImages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Imágenes Adaptadas
                </CardTitle>
                <CardDescription>
                  Tu diseño en diferentes formatos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {adaptedImages.map((image) => renderImageCard(image, 'adaptations'))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {designVariations.length === 0 && adaptedImages.length === 0 && (
            <Card className="h-[400px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Vista previa</p>
                <p className="text-sm">
                  Completa el formulario y genera variaciones para ver los resultados aquí
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
