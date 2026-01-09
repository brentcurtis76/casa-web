import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  X,
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
} from 'lucide-react';

// Available icons for themes
const AVAILABLE_ICONS = {
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
} as const;

type IconName = keyof typeof AVAILABLE_ICONS;

export interface GraphicsTheme {
  id: string;
  key: string;
  label: string;
  description: string | null;
  icon: IconName;
  elements: string[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ThemeFormData {
  key: string;
  label: string;
  description: string;
  icon: IconName;
  elements: string;
}

const initialFormData: ThemeFormData = {
  key: '',
  label: '',
  description: '',
  icon: 'Palette',
  elements: '',
};

export const ThemeManager = () => {
  const { toast } = useToast();
  const [themes, setThemes] = useState<GraphicsTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<GraphicsTheme | null>(null);
  const [formData, setFormData] = useState<ThemeFormData>(initialFormData);

  // Fetch themes
  const fetchThemes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('graphics_themes')
      .select('*')
      .order('is_default', { ascending: false })
      .order('label');

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los temas.',
        variant: 'destructive',
      });
      console.error('Error fetching themes:', error);
    } else {
      setThemes(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchThemes();
  }, []);

  // Open dialog for new theme
  const handleNewTheme = () => {
    setEditingTheme(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  // Open dialog for editing
  const handleEditTheme = (theme: GraphicsTheme) => {
    setEditingTheme(theme);
    setFormData({
      key: theme.key,
      label: theme.label,
      description: theme.description || '',
      icon: theme.icon as IconName,
      elements: theme.elements.join('\n'),
    });
    setDialogOpen(true);
  };

  // Generate key from label
  const generateKey = (label: string): string => {
    return label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  };

  // Handle form input changes
  const handleInputChange = (field: keyof ThemeFormData, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-generate key from label for new themes
      if (field === 'label' && !editingTheme) {
        updated.key = generateKey(value);
      }
      return updated;
    });
  };

  // Save theme
  const handleSaveTheme = async () => {
    if (!formData.label.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre del tema es requerido.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.elements.trim()) {
      toast({
        title: 'Error',
        description: 'Debes agregar al menos un elemento de ilustración.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const elementsArray = formData.elements
      .split('\n')
      .map(e => e.trim())
      .filter(e => e.length > 0);

    const themeData = {
      key: formData.key || generateKey(formData.label),
      label: formData.label.trim(),
      description: formData.description.trim() || null,
      icon: formData.icon,
      elements: elementsArray,
    };

    try {
      if (editingTheme) {
        // Update existing theme
        const { error } = await supabase
          .from('graphics_themes')
          .update(themeData)
          .eq('id', editingTheme.id);

        if (error) throw error;

        toast({
          title: 'Tema actualizado',
          description: `"${themeData.label}" ha sido actualizado.`,
        });
      } else {
        // Create new theme
        const { error } = await supabase
          .from('graphics_themes')
          .insert(themeData);

        if (error) throw error;

        toast({
          title: 'Tema creado',
          description: `"${themeData.label}" ha sido creado.`,
        });
      }

      setDialogOpen(false);
      fetchThemes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo guardar el tema.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete theme
  const handleDeleteTheme = async (theme: GraphicsTheme) => {
    try {
      const { error } = await supabase
        .from('graphics_themes')
        .delete()
        .eq('id', theme.id);

      if (error) throw error;

      toast({
        title: 'Tema eliminado',
        description: `"${theme.label}" ha sido eliminado.`,
      });

      fetchThemes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el tema.',
        variant: 'destructive',
      });
    }
  };

  // Toggle theme active status
  const handleToggleActive = async (theme: GraphicsTheme) => {
    try {
      const { error } = await supabase
        .from('graphics_themes')
        .update({ is_active: !theme.is_active })
        .eq('id', theme.id);

      if (error) throw error;

      toast({
        title: theme.is_active ? 'Tema desactivado' : 'Tema activado',
        description: `"${theme.label}" ha sido ${theme.is_active ? 'desactivado' : 'activado'}.`,
      });

      fetchThemes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el tema.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Administrar Temas</h2>
          <p className="text-muted-foreground">
            Crea y edita temas de ilustración para el generador de gráficos
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewTheme} className="bg-amber-500 hover:bg-amber-600">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Tema
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTheme ? 'Editar Tema' : 'Nuevo Tema'}
              </DialogTitle>
              <DialogDescription>
                {editingTheme
                  ? 'Modifica los detalles del tema de ilustración.'
                  : 'Crea un nuevo tema de ilustración para el generador.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Label */}
              <div className="space-y-2">
                <Label htmlFor="label">Nombre del Tema *</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => handleInputChange('label', e.target.value)}
                  placeholder="Ej: Música y Alabanza"
                />
              </div>

              {/* Key (auto-generated) */}
              <div className="space-y-2">
                <Label htmlFor="key">Clave (identificador único)</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => handleInputChange('key', e.target.value)}
                  placeholder="musica_alabanza"
                  disabled={!!editingTheme}
                  className={editingTheme ? 'bg-gray-100' : ''}
                />
                <p className="text-xs text-muted-foreground">
                  Se genera automáticamente del nombre
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Instrumentos, notas musicales y elementos de alabanza"
                />
              </div>

              {/* Icon */}
              <div className="space-y-2">
                <Label>Icono</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) => handleInputChange('icon', value)}
                >
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        {AVAILABLE_ICONS[formData.icon]}
                        <span>{formData.icon}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AVAILABLE_ICONS).map(([name, icon]) => (
                      <SelectItem key={name} value={name}>
                        <div className="flex items-center gap-2">
                          {icon}
                          <span>{name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Elements */}
              <div className="space-y-2">
                <Label htmlFor="elements">
                  Elementos de Ilustración * <span className="text-xs text-muted-foreground">(uno por línea)</span>
                </Label>
                <Textarea
                  id="elements"
                  value={formData.elements}
                  onChange={(e) => handleInputChange('elements', e.target.value)}
                  placeholder={`guitar and musical instrument outlines
music note patterns floating
microphone illustrations
hands raised in worship
speaker and sound wave sketches`}
                  rows={8}
                />
                <p className="text-xs text-muted-foreground">
                  Describe los elementos visuales que la IA debe incluir en el patrón.
                  Escribe en inglés para mejores resultados.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveTheme}
                disabled={saving}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Themes Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => (
          <Card
            key={theme.id}
            className={`relative ${!theme.is_active ? 'opacity-60' : ''}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {AVAILABLE_ICONS[theme.icon as IconName] || <Palette className="h-5 w-5" />}
                  <CardTitle className="text-base">{theme.label}</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  {theme.is_default && (
                    <Badge variant="secondary" className="text-xs">
                      Por defecto
                    </Badge>
                  )}
                  {!theme.is_active && (
                    <Badge variant="outline" className="text-xs">
                      Inactivo
                    </Badge>
                  )}
                </div>
              </div>
              {theme.description && (
                <CardDescription className="text-xs">
                  {theme.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {theme.elements.length} elementos:
                  </p>
                  <p className="text-xs line-clamp-2">
                    {theme.elements.slice(0, 3).join(', ')}
                    {theme.elements.length > 3 && '...'}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditTheme(theme)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Editar
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleActive(theme)}
                  >
                    {theme.is_active ? 'Desactivar' : 'Activar'}
                  </Button>

                  {!theme.is_default && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar tema?</AlertDialogTitle>
                          <AlertDialogDescription>
                            ¿Estás seguro de que deseas eliminar "{theme.label}"?
                            Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTheme(theme)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {themes.length === 0 && (
        <Card className="py-12">
          <div className="text-center text-muted-foreground">
            <Palette className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No hay temas disponibles.</p>
            <p className="text-sm">Crea tu primer tema para comenzar.</p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ThemeManager;
