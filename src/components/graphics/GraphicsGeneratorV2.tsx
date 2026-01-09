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

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  generateAllFormats,
  generateGraphic,
  downloadGraphic,
  downloadAllGraphics,
  preloadFonts,
  DEFAULT_ILLUSTRATION_ADJUSTMENTS,
  DEFAULT_FIELD_POSITION_ADJUSTMENTS,
  type EventData,
  type GeneratedGraphic,
  type FormatType,
  type IllustrationAdjustment,
  type IllustrationAdjustments,
  type FieldPositionAdjustments,
  type AllFieldPositionAdjustments,
} from './templateCompositor';
import { Slider } from '@/components/ui/slider';

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

type Phase = 'form' | 'prompt' | 'selecting' | 'adjusting' | 'generating' | 'done';

// Base prompt para ilustraciones (sincronizado con Edge Function generate-illustration)
const BASE_STYLE_PROMPT = `Create a minimalist artistic illustration with these exact requirements:

COLORS (MANDATORY):
- Main lines: Medium gray (#666666)
- Accent color: Warm amber/gold (#D4A853) - USE THIS COLOR for highlights, key elements, or artistic accents
- Background: Warm cream (#F9F7F5) - NOT white, use this exact warm cream tone

STYLE:
- Single continuous flowing line art in the style of Henri Matisse or Pablo Picasso
- Abstract and contemplative, suggestive of spiritual reflection
- Elegant, minimalist, with negative space
- The amber/gold accent should appear in at least 20-30% of the illustration

CRITICAL: No text, no labels, no words, no letters in the image. Only the artistic illustration.`;

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

  // Toggle states for optional fields
  const [includeSubtitle, setIncludeSubtitle] = useState(false);
  const [includeDate, setIncludeDate] = useState(true);
  const [includeTime, setIncludeTime] = useState(true);
  const [includeLocation, setIncludeLocation] = useState(true);

  // Prompt state (editable)
  const [customPrompt, setCustomPrompt] = useState('');

  // Illustrations state
  const [illustrations, setIllustrations] = useState<string[]>([]);
  const [selectedIllustration, setSelectedIllustration] = useState<number | null>(null);
  const [loadingIllustrations, setLoadingIllustrations] = useState(false);

  // Generated graphics state
  const [generatedGraphics, setGeneratedGraphics] = useState<GeneratedGraphic[]>([]);
  const [generatingFormats, setGeneratingFormats] = useState(false);

  // Logo base64 (fetched once)
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // Fonts loaded
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Live preview state - now supports all 4 formats
  const [previewFormat, setPreviewFormat] = useState<FormatType>('ppt_4_3');
  const [previews, setPreviews] = useState<Record<FormatType, string | null>>({
    ppt_4_3: null,
    instagram_post: null,
    instagram_story: null,
    facebook_post: null,
  });
  const [previewLoading, setPreviewLoading] = useState(false);

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

  // Generate live previews for all formats when form fields change
  useEffect(() => {
    if (!fontsLoaded || !logoBase64) return;
    if (phase !== 'form') return;

    // Debounce preview generation
    const timeoutId = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        // Generate all 4 format previews in parallel, each with its own title
        const formats: FormatType[] = ['ppt_4_3', 'instagram_post', 'instagram_story', 'facebook_post'];
        const results = await Promise.all(
          formats.map(format => {
            const eventData: EventData = {
              title: titles[format] || 'Título del Evento',
              subtitle: includeSubtitle ? subtitle : undefined,
              date: includeDate ? (formatDateRange(dateRange) || 'Fecha del evento') : '',
              time: includeTime ? (time || '19:00 hrs') : '',
              location: includeLocation ? (location || 'Ubicación del evento') : '',
            };
            return generateGraphic(format, eventData, null, logoBase64);
          })
        );

        const newPreviews: Record<FormatType, string | null> = {
          ppt_4_3: null,
          instagram_post: null,
          instagram_story: null,
          facebook_post: null,
        };
        results.forEach((graphic, index) => {
          newPreviews[formats[index]] = graphic.base64;
        });
        setPreviews(newPreviews);
      } catch (e) {
        console.warn('Error generando previews:', e);
      } finally {
        setPreviewLoading(false);
      }
    }, 400); // 400ms debounce (slightly longer since we generate 4 images)

    return () => clearTimeout(timeoutId);
  }, [titles, dateRange, time, location, subtitle, includeSubtitle, includeDate, includeTime, includeLocation, fontsLoaded, logoBase64, phase]);

  // Build default prompt based on event type
  const buildDefaultPrompt = (type: string): string => {
    const eventPrompt = EVENT_PROMPTS[type] || EVENT_PROMPTS.generic;
    return `${BASE_STYLE_PROMPT} Subject: ${eventPrompt}`;
  };

  // Show prompt editor before generating
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

    // Set default prompt based on event type
    setCustomPrompt(buildDefaultPrompt(eventType));
    setPhase('prompt');
  };

  // Generate 4 illustrations with custom prompt
  const handleGenerateIllustrations = async () => {
    setLoadingIllustrations(true);
    setPhase('selecting');
    setSelectedIllustration(null);
    setIllustrations([]);

    try {
      const { data, error } = await supabase.functions.invoke('generate-illustration', {
        body: {
          eventType,
          count: 4,
          customPrompt: customPrompt, // Enviar prompt personalizado
        },
      });

      if (error) throw error;

      if (data?.illustrations && data.illustrations.length > 0) {
        setIllustrations(data.illustrations);
        const validCount = data.validCount || data.illustrations.filter((i: string) => i).length;
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

  // Select illustration and go to adjustment phase
  const handleSelectIllustration = (index: number) => {
    setSelectedIllustration(index);
    // Reset adjustments to defaults
    setIllustrationAdjustments({ ...DEFAULT_ILLUSTRATION_ADJUSTMENTS });
    setFieldPositionAdjustments(JSON.parse(JSON.stringify(DEFAULT_FIELD_POSITION_ADJUSTMENTS)));
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

  // Generate preview for adjustment phase
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
        const graphic = await generateGraphic(
          adjustFormat,
          eventData,
          selectedBase64,
          logoBase64,
          illustrationAdjustments[adjustFormat],
          fieldPositionAdjustments[adjustFormat]
        );
        setAdjustPreview(graphic.base64);
      } catch (e) {
        console.warn('Error generando preview de ajuste:', e);
      } finally {
        setAdjustPreviewLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [phase, adjustFormat, illustrationAdjustments, fieldPositionAdjustments, selectedIllustration, fontsLoaded, logoBase64, titles, dateRange, time, location, subtitle, includeSubtitle, includeDate, includeTime, includeLocation, illustrations]);

  // Generate all formats with current adjustments
  const handleGenerateWithAdjustments = async () => {
    if (selectedIllustration === null) return;

    setPhase('generating');
    setGeneratingFormats(true);

    const selectedBase64 = illustrations[selectedIllustration];

    try {
      // Generate each format with its own title and adjustments
      const formats: FormatType[] = ['ppt_4_3', 'instagram_post', 'instagram_story', 'facebook_post'];
      const graphics = await Promise.all(
        formats.map(format => {
          const eventData: EventData = {
            title: titles[format].replace(/\n/g, '\\n'),
            subtitle: includeSubtitle ? subtitle : undefined,
            date: includeDate ? formatDateRange(dateRange) : '',
            time: includeTime ? time : '',
            location: includeLocation ? location : '',
          };
          return generateGraphic(format, eventData, selectedBase64, logoBase64, illustrationAdjustments[format], fieldPositionAdjustments[format]);
        })
      );

      setGeneratedGraphics(graphics);
      setPhase('done');

      toast({
        title: 'Gráficos generados',
        description: `Se han creado ${graphics.length} formatos listos para descargar.`,
      });
    } catch (err: any) {
      console.error('Error generando formatos:', err);
      toast({
        title: 'Error',
        description: 'Hubo un problema generando los formatos.',
        variant: 'destructive',
      });
      setPhase('adjusting');
    } finally {
      setGeneratingFormats(false);
    }
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="title">
                    Título del Evento <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-xs text-amber-600 font-medium">
                    {FORMAT_LABELS[previewFormat]}
                  </span>
                </div>
                <textarea
                  id="title"
                  value={titles[previewFormat]}
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

          {/* Preview en tiempo real con selector de formato */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Vista Previa</CardTitle>
              <CardDescription>
                Revisa cómo se ve el texto en cada formato
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Format selector tabs */}
              <div className="flex flex-wrap gap-1">
                {(['ppt_4_3', 'instagram_post', 'instagram_story', 'facebook_post'] as FormatType[]).map((format) => (
                  <button
                    key={format}
                    onClick={() => setPreviewFormat(format)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      previewFormat === format
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {format === 'ppt_4_3' && 'PPT 4:3'}
                    {format === 'instagram_post' && 'IG Post'}
                    {format === 'instagram_story' && 'IG Story'}
                    {format === 'facebook_post' && 'Facebook'}
                  </button>
                ))}
              </div>

              {/* Preview container with dynamic aspect ratio */}
              <div
                className={`relative bg-gray-100 rounded-lg overflow-hidden border ${
                  previewFormat === 'ppt_4_3' ? 'aspect-[4/3]' :
                  previewFormat === 'instagram_post' ? 'aspect-square' :
                  previewFormat === 'instagram_story' ? 'aspect-[9/16] max-h-[400px]' :
                  'aspect-[1200/630]'
                }`}
              >
                {previews[previewFormat] ? (
                  <img
                    src={`data:image/png;base64,${previews[previewFormat]}`}
                    alt={`Preview ${FORMAT_LABELS[previewFormat]}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                  </div>
                )}
                {previewLoading && previews[previewFormat] && (
                  <div className="absolute top-2 right-2">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {FORMAT_LABELS[previewFormat]} • El preview se actualiza mientras escribes
              </p>
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
              Revisa y edita el prompt que se enviará a la IA para generar las ilustraciones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                onClick={() => setCustomPrompt(buildDefaultPrompt(eventType))}
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

      {/* Phase: Adjusting Illustration */}
      {phase === 'adjusting' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Controles de ajuste */}
          <Card>
            <CardHeader>
              <CardTitle>Ajustar Ilustración</CardTitle>
              <CardDescription>
                Modifica el tamaño, posición y opacidad de la ilustración para cada formato
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selector de formato */}
              <div className="space-y-2">
                <Label>Formato</Label>
                <div className="flex flex-wrap gap-1">
                  {(['ppt_4_3', 'instagram_post', 'instagram_story', 'facebook_post'] as FormatType[]).map((format) => (
                    <button
                      key={format}
                      onClick={() => setAdjustFormat(format)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        adjustFormat === format
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {FORMAT_LABELS[format]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider: Tamaño */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Tamaño</Label>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(illustrationAdjustments[adjustFormat].scale * 100)}%
                  </span>
                </div>
                <Slider
                  value={[illustrationAdjustments[adjustFormat].scale * 100]}
                  onValueChange={([value]) => updateAdjustment('scale', value / 100)}
                  min={30}
                  max={200}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Slider: Posición X */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Posición Horizontal</Label>
                  <span className="text-sm text-muted-foreground">
                    {illustrationAdjustments[adjustFormat].offsetX > 0 ? '+' : ''}{illustrationAdjustments[adjustFormat].offsetX}%
                  </span>
                </div>
                <Slider
                  value={[illustrationAdjustments[adjustFormat].offsetX]}
                  onValueChange={([value]) => updateAdjustment('offsetX', value)}
                  min={-100}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Slider: Posición Y */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Posición Vertical</Label>
                  <span className="text-sm text-muted-foreground">
                    {illustrationAdjustments[adjustFormat].offsetY > 0 ? '+' : ''}{illustrationAdjustments[adjustFormat].offsetY}%
                  </span>
                </div>
                <Slider
                  value={[illustrationAdjustments[adjustFormat].offsetY]}
                  onValueChange={([value]) => updateAdjustment('offsetY', value)}
                  min={-100}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Slider: Opacidad */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Opacidad</Label>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(illustrationAdjustments[adjustFormat].opacity * 100)}%
                  </span>
                </div>
                <Slider
                  value={[illustrationAdjustments[adjustFormat].opacity * 100]}
                  onValueChange={([value]) => updateAdjustment('opacity', value / 100)}
                  min={5}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Separador */}
              <div className="border-t pt-4">
                <Label className="text-sm font-medium mb-3 block">Posición de Campos</Label>

                {/* Título - X e Y */}
                <div className="space-y-2 mb-4 p-3 bg-gray-50 rounded-lg">
                  <Label className="text-xs text-amber-600 flex items-center gap-1">
                    <Heading className="h-3 w-3" /> Título
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-muted-foreground">X</span>
                        <span className="text-xs text-muted-foreground">{fieldPositionAdjustments[adjustFormat].title.offsetX}px</span>
                      </div>
                      <Slider
                        value={[fieldPositionAdjustments[adjustFormat].title.offsetX]}
                        onValueChange={([value]) => updateFieldPosition('title', 'offsetX', value)}
                        min={-200}
                        max={200}
                        step={5}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-muted-foreground">Y</span>
                        <span className="text-xs text-muted-foreground">{fieldPositionAdjustments[adjustFormat].title.offsetY}px</span>
                      </div>
                      <Slider
                        value={[fieldPositionAdjustments[adjustFormat].title.offsetY]}
                        onValueChange={([value]) => updateFieldPosition('title', 'offsetY', value)}
                        min={-200}
                        max={200}
                        step={5}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Subtítulo - X e Y */}
                {includeSubtitle && (
                  <div className="space-y-2 mb-4 p-3 bg-gray-50 rounded-lg">
                    <Label className="text-xs text-amber-600 flex items-center gap-1">
                      <Type className="h-3 w-3" /> Subtítulo
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">X</span>
                          <span className="text-xs text-muted-foreground">{fieldPositionAdjustments[adjustFormat].subtitle.offsetX}px</span>
                        </div>
                        <Slider
                          value={[fieldPositionAdjustments[adjustFormat].subtitle.offsetX]}
                          onValueChange={([value]) => updateFieldPosition('subtitle', 'offsetX', value)}
                          min={-200}
                          max={200}
                          step={5}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">Y</span>
                          <span className="text-xs text-muted-foreground">{fieldPositionAdjustments[adjustFormat].subtitle.offsetY}px</span>
                        </div>
                        <Slider
                          value={[fieldPositionAdjustments[adjustFormat].subtitle.offsetY]}
                          onValueChange={([value]) => updateFieldPosition('subtitle', 'offsetY', value)}
                          min={-200}
                          max={200}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Fecha - X e Y */}
                {includeDate && (
                  <div className="space-y-2 mb-4 p-3 bg-gray-50 rounded-lg">
                    <Label className="text-xs text-amber-600 flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" /> Fecha
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">X</span>
                          <span className="text-xs text-muted-foreground">{fieldPositionAdjustments[adjustFormat].date.offsetX}px</span>
                        </div>
                        <Slider
                          value={[fieldPositionAdjustments[adjustFormat].date.offsetX]}
                          onValueChange={([value]) => updateFieldPosition('date', 'offsetX', value)}
                          min={-200}
                          max={200}
                          step={5}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">Y</span>
                          <span className="text-xs text-muted-foreground">{fieldPositionAdjustments[adjustFormat].date.offsetY}px</span>
                        </div>
                        <Slider
                          value={[fieldPositionAdjustments[adjustFormat].date.offsetY]}
                          onValueChange={([value]) => updateFieldPosition('date', 'offsetY', value)}
                          min={-200}
                          max={200}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Hora - X e Y */}
                {includeTime && (
                  <div className="space-y-2 mb-4 p-3 bg-gray-50 rounded-lg">
                    <Label className="text-xs text-amber-600 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Hora
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">X</span>
                          <span className="text-xs text-muted-foreground">{fieldPositionAdjustments[adjustFormat].time.offsetX}px</span>
                        </div>
                        <Slider
                          value={[fieldPositionAdjustments[adjustFormat].time.offsetX]}
                          onValueChange={([value]) => updateFieldPosition('time', 'offsetX', value)}
                          min={-200}
                          max={200}
                          step={5}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">Y</span>
                          <span className="text-xs text-muted-foreground">{fieldPositionAdjustments[adjustFormat].time.offsetY}px</span>
                        </div>
                        <Slider
                          value={[fieldPositionAdjustments[adjustFormat].time.offsetY]}
                          onValueChange={([value]) => updateFieldPosition('time', 'offsetY', value)}
                          min={-200}
                          max={200}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Ubicación - X e Y */}
                {includeLocation && (
                  <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                    <Label className="text-xs text-amber-600 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Ubicación
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">X</span>
                          <span className="text-xs text-muted-foreground">{fieldPositionAdjustments[adjustFormat].location.offsetX}px</span>
                        </div>
                        <Slider
                          value={[fieldPositionAdjustments[adjustFormat].location.offsetX]}
                          onValueChange={([value]) => updateFieldPosition('location', 'offsetX', value)}
                          min={-200}
                          max={200}
                          step={5}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">Y</span>
                          <span className="text-xs text-muted-foreground">{fieldPositionAdjustments[adjustFormat].location.offsetY}px</span>
                        </div>
                        <Slider
                          value={[fieldPositionAdjustments[adjustFormat].location.offsetY]}
                          onValueChange={([value]) => updateFieldPosition('location', 'offsetY', value)}
                          min={-200}
                          max={200}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón para resetear a defaults */}
              <Button
                variant="outline"
                onClick={() => {
                  setIllustrationAdjustments(prev => ({
                    ...prev,
                    [adjustFormat]: { ...DEFAULT_ILLUSTRATION_ADJUSTMENTS[adjustFormat] },
                  }));
                  setFieldPositionAdjustments(prev => ({
                    ...prev,
                    [adjustFormat]: JSON.parse(JSON.stringify(DEFAULT_FIELD_POSITION_ADJUSTMENTS[adjustFormat])),
                  }));
                }}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Restablecer {FORMAT_LABELS[adjustFormat]}
              </Button>

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
                  onClick={handleGenerateWithAdjustments}
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generar Gráficos
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview del formato actual */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Vista Previa</CardTitle>
              <CardDescription>{FORMAT_LABELS[adjustFormat]}</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`relative bg-gray-100 rounded-lg overflow-hidden border ${
                  adjustFormat === 'ppt_4_3' ? 'aspect-[4/3]' :
                  adjustFormat === 'instagram_post' ? 'aspect-square' :
                  adjustFormat === 'instagram_story' ? 'aspect-[9/16] max-h-[500px]' :
                  'aspect-[1200/630]'
                }`}
              >
                {adjustPreview ? (
                  <img
                    src={`data:image/png;base64,${adjustPreview}`}
                    alt={`Preview ${FORMAT_LABELS[adjustFormat]}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                  </div>
                )}
                {adjustPreviewLoading && adjustPreview && (
                  <div className="absolute top-2 right-2">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                El preview se actualiza mientras ajustas los valores
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Phase: Generating Formats */}
      {phase === 'generating' && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-amber-500 mb-4" />
              <p className="text-lg font-medium">Generando 4 formatos...</p>
              <p className="text-muted-foreground">
                PPT, Instagram Post, Instagram Story, Facebook
              </p>
            </div>
          </CardContent>
        </Card>
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
                  onClick={() => setPhase('adjusting')}
                >
                  Volver a Ajustar
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
