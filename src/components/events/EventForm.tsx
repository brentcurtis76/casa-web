import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar, Upload, X, Star, Loader2, FolderOpen, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface GraphicsItem {
  id: string;
  format: string;
  image_url: string;
}

interface GraphicsBatch {
  id: string;
  name: string;
  event_type: string;
  event_date: string | null;
  created_at: string;
  items?: GraphicsItem[];
}

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string | null;
  image_url?: string | null;
  featured?: boolean;
}

interface EventFormProps {
  open: boolean;
  event?: Event | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const EventForm = ({ open, event, onClose, onSuccess }: EventFormProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: event?.title || '',
    date: event?.date || format(new Date(), 'yyyy-MM-dd'),
    time: event?.time || '11:00',
    location: event?.location || '',
    description: event?.description || '',
    image_url: event?.image_url || '',
    featured: event?.featured || false,
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(event?.image_url || null);

  // Saved graphics state
  const [savedBatches, setSavedBatches] = useState<GraphicsBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [showSavedGraphics, setShowSavedGraphics] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Load saved graphics batches when dialog opens
  useEffect(() => {
    if (open) {
      loadSavedBatches();
    }
  }, [open]);

  const loadSavedBatches = async () => {
    setLoadingBatches(true);
    try {
      // Load batches with their items
      const { data: batches, error } = await supabase
        .from('casa_graphics_batches')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Load items for each batch
      const batchesWithItems = await Promise.all(
        (batches || []).map(async (batch) => {
          const { data: items } = await supabase
            .from('casa_graphics_items')
            .select('id, format, image_url')
            .eq('batch_id', batch.id)
            .in('format', ['instagram_post', 'facebook_post']); // Only show square-ish formats for events
          return { ...batch, items: items || [] };
        })
      );

      setSavedBatches(batchesWithItems.filter(b => b.items && b.items.length > 0));
    } catch (err) {
      console.error('Error loading saved batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleSelectSavedGraphic = (imageUrl: string, batchId: string) => {
    setFormData(prev => ({ ...prev, image_url: imageUrl }));
    setPreviewUrl(imageUrl);
    setSelectedBatchId(batchId);
    setShowSavedGraphics(false);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona una imagen válida',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'La imagen debe ser menor a 5MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('event-images')
        .upload(fileName, file);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('event-images')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, image_url: publicUrl }));
      setPreviewUrl(publicUrl);

      toast({
        title: 'Imagen subida',
        description: 'La imagen se ha subido correctamente',
      });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: error.message || 'Error al subir la imagen',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (formData.image_url) {
      // Extract filename from URL
      const fileName = formData.image_url.split('/').pop();
      if (fileName) {
        try {
          await supabase.storage.from('event-images').remove([fileName]);
        } catch (error) {
          console.error('Error removing image:', error);
        }
      }
    }
    setFormData(prev => ({ ...prev, image_url: '' }));
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'El título es requerido',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.date) {
      toast({
        title: 'Error',
        description: 'La fecha es requerida',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.time) {
      toast({
        title: 'Error',
        description: 'La hora es requerida',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.location.trim()) {
      toast({
        title: 'Error',
        description: 'La ubicación es requerida',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const eventData = {
        title: formData.title.trim(),
        date: formData.date,
        time: formData.time,
        location: formData.location.trim(),
        description: formData.description.trim() || null,
        image_url: formData.image_url || null,
        featured: formData.featured,
      };

      if (event?.id) {
        // Update existing event
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', event.id);

        if (error) throw error;

        toast({
          title: 'Evento actualizado',
          description: 'El evento ha sido actualizado exitosamente',
        });
      } else {
        // Create new event
        const { error } = await supabase
          .from('events')
          .insert([eventData]);

        if (error) throw error;

        toast({
          title: 'Evento creado',
          description: 'El evento ha sido creado exitosamente',
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving event:', error);
      toast({
        title: 'Error',
        description: error.message || 'Error al guardar el evento',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {event ? 'Editar Evento' : 'Crear Nuevo Evento'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Ej: Liturgia Dominical"
              required
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Fecha *</Label>
              <Input
                id="date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Hora *</Label>
              <Input
                id="time"
                name="time"
                type="time"
                value={formData.time}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Ubicación *</Label>
            <Input
              id="location"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="Ej: Vicente Pérez Rosales 1765, La Reina"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe el evento (opcional)"
              rows={3}
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Imagen del Evento</Label>
            {previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-40 object-cover rounded-lg"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={handleRemoveImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Upload option */}
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Subiendo...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Haz clic para subir una imagen
                      </span>
                      <span className="text-xs text-muted-foreground">
                        PNG, JPG hasta 5MB
                      </span>
                    </div>
                  )}
                </div>

                {/* Saved graphics option */}
                {savedBatches.length > 0 && (
                  <Collapsible open={showSavedGraphics} onOpenChange={setShowSavedGraphics}>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4" />
                          Usar gráfico guardado ({savedBatches.length})
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${showSavedGraphics ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-3">
                        {loadingBatches ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          savedBatches.map((batch) => (
                            <div key={batch.id} className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">
                                {batch.name}
                                {batch.event_date && ` • ${batch.event_date}`}
                              </p>
                              <div className="flex gap-2 overflow-x-auto pb-1">
                                {batch.items?.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleSelectSavedGraphic(item.image_url, batch.id)}
                                    className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-colors ${
                                      selectedBatchId === batch.id && formData.image_url === item.image_url
                                        ? 'border-amber-500'
                                        : 'border-transparent hover:border-amber-300'
                                    }`}
                                  >
                                    <img
                                      src={item.image_url}
                                      alt={item.format}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* Featured Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              <div>
                <Label htmlFor="featured" className="cursor-pointer">Evento Destacado</Label>
                <p className="text-xs text-muted-foreground">
                  Los eventos destacados aparecen primero
                </p>
              </div>
            </div>
            <Switch
              id="featured"
              checked={formData.featured}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, featured: checked }))}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || uploading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : event ? (
                'Actualizar Evento'
              ) : (
                'Crear Evento'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
