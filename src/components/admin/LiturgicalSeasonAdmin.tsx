import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  Save,
  Check,
  Church,
  Sparkles,
  Sun,
  Leaf,
  Cross,
  Flame,
  Calendar,
  Star,
  Pencil,
} from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';

// Season icons mapping
const SEASON_ICONS: Record<string, React.ReactNode> = {
  advent: <Sparkles className="h-5 w-5" />,
  christmas: <Star className="h-5 w-5" />,
  epiphany: <Sun className="h-5 w-5" />,
  lent: <Leaf className="h-5 w-5" />,
  holy_week: <Cross className="h-5 w-5" />,
  easter: <Church className="h-5 w-5" />,
  pentecost: <Flame className="h-5 w-5" />,
  ordinary: <Calendar className="h-5 w-5" />,
};

interface LiturgicalSeasonPreset {
  id: string;
  name: string;
  scripture_reference: string;
  scripture_text: string;
  theme: string;
  accent_color: string;
  liturgical_color: string | null;
  sort_order: number;
}

interface CurrentSeason {
  id: string;
  name: string;
  scripture: {
    reference: string;
    text: string;
  };
  theme: string;
  accentColor: string;
}

export function LiturgicalSeasonAdmin() {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [presets, setPresets] = useState<LiturgicalSeasonPreset[]>([]);
  const [currentSeason, setCurrentSeason] = useState<CurrentSeason | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // Custom season dialog
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customSeason, setCustomSeason] = useState({
    name: '',
    scriptureReference: '',
    scriptureText: '',
    theme: '',
    accentColor: '#D4A853',
  });

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigate('/');
        return;
      }

      const { data } = await supabase
        .from('mesa_abierta_admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!data) {
        toast({
          title: 'Acceso denegado',
          description: 'No tienes permisos de administrador.',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setIsAdmin(true);
    };

    checkAdmin();
  }, [user, navigate, toast]);

  // Fetch data
  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      setLoading(true);

      // Fetch presets
      const { data: presetsData, error: presetsError } = await supabase
        .from('liturgical_season_presets')
        .select('*')
        .order('sort_order');

      if (presetsError) {
        console.error('Error fetching presets:', presetsError);
      } else {
        setPresets(presetsData || []);
      }

      // Fetch current season from site_config
      const { data: configData, error: configError } = await supabase
        .from('site_config')
        .select('value')
        .eq('key', 'liturgical_season')
        .single();

      if (configError) {
        console.error('Error fetching current season:', configError);
      } else if (configData?.value) {
        const seasonValue = configData.value as CurrentSeason;
        setCurrentSeason(seasonValue);
        setSelectedPreset(seasonValue.id);
      }

      setLoading(false);
    };

    fetchData();
  }, [isAdmin]);

  // Apply preset
  const applyPreset = async (preset: LiturgicalSeasonPreset) => {
    setSaving(true);

    const seasonConfig: CurrentSeason = {
      id: preset.id,
      name: preset.name,
      scripture: {
        reference: preset.scripture_reference,
        text: preset.scripture_text,
      },
      theme: preset.theme,
      accentColor: preset.accent_color,
    };

    const { error } = await supabase
      .from('site_config')
      .update({ value: seasonConfig })
      .eq('key', 'liturgical_season');

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la temporada.',
        variant: 'destructive',
      });
    } else {
      setCurrentSeason(seasonConfig);
      setSelectedPreset(preset.id);
      toast({
        title: 'Temporada actualizada',
        description: `La página ahora muestra "${preset.name}"`,
      });
    }

    setSaving(false);
  };

  // Apply custom season
  const applyCustomSeason = async () => {
    if (!customSeason.name || !customSeason.scriptureReference || !customSeason.scriptureText) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor completa todos los campos obligatorios.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const seasonConfig: CurrentSeason = {
      id: 'custom',
      name: customSeason.name,
      scripture: {
        reference: customSeason.scriptureReference,
        text: customSeason.scriptureText,
      },
      theme: customSeason.theme || 'Un espacio de amor, inclusión y esperanza',
      accentColor: customSeason.accentColor,
    };

    const { error } = await supabase
      .from('site_config')
      .update({ value: seasonConfig })
      .eq('key', 'liturgical_season');

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la temporada.',
        variant: 'destructive',
      });
    } else {
      setCurrentSeason(seasonConfig);
      setSelectedPreset('custom');
      setCustomDialogOpen(false);
      toast({
        title: 'Temporada personalizada aplicada',
        description: `La página ahora muestra "${customSeason.name}"`,
      });
    }

    setSaving(false);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminPageHeader
        title="Temporada Litúrgica"
        subtitle="Configura el mensaje del Hero en la página principal"
        breadcrumbs={[
          { label: 'Liturgia' },
          { label: 'Temporadas' },
        ]}
        backTo="/admin"
      />

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Current Season Card */}
            {currentSeason && (
              <Card className="border-2 border-amber-200 bg-amber-50/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Church className="h-5 w-5 text-amber-600" />
                        Temporada Actual
                      </CardTitle>
                      <CardDescription>
                        Esto es lo que se muestra en la página principal
                      </CardDescription>
                    </div>
                    <Badge
                      className="text-white"
                      style={{ backgroundColor: currentSeason.accentColor }}
                    >
                      {currentSeason.name}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-white rounded-lg p-6 border">
                    <p className="text-sm text-gray-500 italic mb-2">
                      {currentSeason.scripture.reference}
                    </p>
                    <p className="text-xl font-serif text-gray-900 mb-4">
                      "{currentSeason.scripture.text}"
                    </p>
                    <p className="text-gray-600">
                      {currentSeason.theme}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Season Selection */}
            <Tabs defaultValue="presets" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="presets">Temporadas Predefinidas</TabsTrigger>
                <TabsTrigger value="custom">Personalizado</TabsTrigger>
              </TabsList>

              <TabsContent value="presets" className="mt-6">
                <div className="grid gap-4 md:grid-cols-2">
                  {presets.map((preset) => (
                    <Card
                      key={preset.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedPreset === preset.id
                          ? 'ring-2 ring-amber-500 bg-amber-50/30'
                          : ''
                      }`}
                      onClick={() => !saving && applyPreset(preset)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: `${preset.accent_color}20` }}
                            >
                              <span style={{ color: preset.accent_color }}>
                                {SEASON_ICONS[preset.id] || <Calendar className="h-5 w-5" />}
                              </span>
                            </div>
                            <div>
                              <CardTitle className="text-base">{preset.name}</CardTitle>
                              {preset.liturgical_color && (
                                <p className="text-xs text-gray-500">
                                  Color: {preset.liturgical_color}
                                </p>
                              )}
                            </div>
                          </div>
                          {selectedPreset === preset.id && (
                            <Check className="h-5 w-5 text-amber-600" />
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-gray-500 italic mb-1">
                          {preset.scripture_reference}
                        </p>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          "{preset.scripture_text}"
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="custom" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Pencil className="h-5 w-5" />
                      Crear Temporada Personalizada
                    </CardTitle>
                    <CardDescription>
                      Define tu propio mensaje para el Hero de la página principal
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre de la Temporada *</Label>
                        <Input
                          id="name"
                          placeholder="Ej: Tiempo de Epifanía"
                          value={customSeason.name}
                          onChange={(e) =>
                            setCustomSeason({ ...customSeason, name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="accentColor">Color de Acento</Label>
                        <div className="flex gap-2">
                          <Input
                            id="accentColor"
                            type="color"
                            className="w-16 h-10 p-1 cursor-pointer"
                            value={customSeason.accentColor}
                            onChange={(e) =>
                              setCustomSeason({ ...customSeason, accentColor: e.target.value })
                            }
                          />
                          <Input
                            value={customSeason.accentColor}
                            onChange={(e) =>
                              setCustomSeason({ ...customSeason, accentColor: e.target.value })
                            }
                            placeholder="#D4A853"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="scriptureReference">Referencia Bíblica *</Label>
                      <Input
                        id="scriptureReference"
                        placeholder="Ej: Mateo 2:2"
                        value={customSeason.scriptureReference}
                        onChange={(e) =>
                          setCustomSeason({ ...customSeason, scriptureReference: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="scriptureText">Texto de la Cita *</Label>
                      <Textarea
                        id="scriptureText"
                        placeholder="Ej: Hemos visto su estrella en el oriente y venimos a adorarle"
                        value={customSeason.scriptureText}
                        onChange={(e) =>
                          setCustomSeason({ ...customSeason, scriptureText: e.target.value })
                        }
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="theme">Subtítulo / Tema</Label>
                      <Input
                        id="theme"
                        placeholder="Ej: La luz de Cristo se manifiesta al mundo"
                        value={customSeason.theme}
                        onChange={(e) =>
                          setCustomSeason({ ...customSeason, theme: e.target.value })
                        }
                      />
                    </div>

                    <Button
                      onClick={applyCustomSeason}
                      disabled={saving}
                      className="w-full bg-[#1A1A1A] hover:bg-[#333333]"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Aplicar Temporada Personalizada
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Help Text */}
            <Card className="bg-gray-50 border-dashed">
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <Church className="h-8 w-8 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 mb-1">
                      ¿Cuándo cambiar la temporada?
                    </h3>
                    <p className="text-sm text-gray-600">
                      El año litúrgico anglicano sigue este ciclo: <strong>Adviento</strong> (4 domingos antes de Navidad) →{' '}
                      <strong>Navidad</strong> (25 dic - 5 ene) → <strong>Epifanía</strong> (6 ene hasta Cuaresma) →{' '}
                      <strong>Cuaresma</strong> (Miércoles de Ceniza hasta Pascua) → <strong>Semana Santa</strong> →{' '}
                      <strong>Pascua</strong> (50 días) → <strong>Pentecostés</strong> → <strong>Tiempo Ordinario</strong>.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
