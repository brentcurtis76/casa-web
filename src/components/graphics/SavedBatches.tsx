import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Download,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface GraphicsItem {
  id: string;
  format: string;
  title: string;
  image_url: string;
  width: number;
  height: number;
}

interface GraphicsBatch {
  id: string;
  name: string;
  event_type: string;
  event_date: string | null;
  event_time: string | null;
  event_location: string | null;
  created_at: string;
  items?: GraphicsItem[];
}

const FORMAT_LABELS: Record<string, string> = {
  ppt_4_3: 'PowerPoint 4:3',
  instagram_post: 'Instagram Post',
  instagram_story: 'Instagram Story',
  facebook_post: 'Facebook Post',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  mesa_abierta: 'La Mesa Abierta',
  culto_dominical: 'Culto Dominical',
  estudio_biblico: 'Estudio Bíblico',
  retiro: 'Retiro',
  navidad: 'Navidad',
  cuaresma: 'Cuaresma',
  pascua: 'Pascua',
  bautismo: 'Bautismo',
  comunidad: 'Comunidad',
  musica: 'Música/Coro',
  oracion: 'Oración',
  generic: 'General',
};

export const SavedBatches = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [batches, setBatches] = useState<GraphicsBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<GraphicsBatch | null>(null);

  // Load batches
  useEffect(() => {
    if (!user) return;

    const loadBatches = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('casa_graphics_batches')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setBatches(data || []);
      } catch (err: any) {
        console.error('Error loading batches:', err);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los gráficos guardados.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadBatches();
  }, [user]);

  // Load items for expanded batch
  const loadBatchItems = async (batchId: string) => {
    try {
      const { data, error } = await supabase
        .from('casa_graphics_items')
        .select('*')
        .eq('batch_id', batchId)
        .order('format');

      if (error) throw error;

      setBatches(prev =>
        prev.map(b =>
          b.id === batchId ? { ...b, items: data || [] } : b
        )
      );
    } catch (err: any) {
      console.error('Error loading batch items:', err);
    }
  };

  // Toggle expanded batch
  const toggleExpand = (batchId: string) => {
    if (expandedBatch === batchId) {
      setExpandedBatch(null);
    } else {
      setExpandedBatch(batchId);
      const batch = batches.find(b => b.id === batchId);
      if (batch && !batch.items) {
        loadBatchItems(batchId);
      }
    }
  };

  // Download single image
  const handleDownload = async (item: GraphicsItem) => {
    try {
      const response = await fetch(item.image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.title.replace(/[^a-z0-9]/gi, '_')}_${item.format}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading:', err);
      toast({
        title: 'Error',
        description: 'No se pudo descargar la imagen.',
        variant: 'destructive',
      });
    }
  };

  // Download all images from batch
  const handleDownloadAll = async (batch: GraphicsBatch) => {
    if (!batch.items) return;

    for (const item of batch.items) {
      await handleDownload(item);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  };

  // Delete batch
  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;

    setDeletingBatch(batchToDelete.id);
    try {
      // Delete items from storage
      const { data: items } = await supabase
        .from('casa_graphics_items')
        .select('image_url')
        .eq('batch_id', batchToDelete.id);

      if (items) {
        for (const item of items) {
          // Extract path from URL
          const url = new URL(item.image_url);
          const path = url.pathname.split('/casa-graphics/')[1];
          if (path) {
            await supabase.storage.from('casa-graphics').remove([path]);
          }
        }
      }

      // Delete items from database
      await supabase
        .from('casa_graphics_items')
        .delete()
        .eq('batch_id', batchToDelete.id);

      // Delete batch
      const { error } = await supabase
        .from('casa_graphics_batches')
        .delete()
        .eq('id', batchToDelete.id);

      if (error) throw error;

      setBatches(prev => prev.filter(b => b.id !== batchToDelete.id));
      toast({
        title: 'Eliminado',
        description: `"${batchToDelete.name}" ha sido eliminado.`,
      });
    } catch (err: any) {
      console.error('Error deleting batch:', err);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el batch.',
        variant: 'destructive',
      });
    } finally {
      setDeletingBatch(null);
      setBatchToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No hay gráficos guardados</p>
            <p className="text-sm">Los batches que guardes aparecerán aquí.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {batches.map((batch) => (
        <Card key={batch.id}>
          <CardHeader
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleExpand(batch.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  {batch.name}
                  {expandedBatch === batch.id ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  <span className="inline-flex items-center gap-1 mr-4">
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                      {EVENT_TYPE_LABELS[batch.event_type] || batch.event_type}
                    </span>
                  </span>
                  {batch.event_date && (
                    <span className="inline-flex items-center gap-1 mr-3">
                      <Calendar className="h-3 w-3" />
                      {batch.event_date}
                    </span>
                  )}
                  {batch.event_time && (
                    <span className="inline-flex items-center gap-1 mr-3">
                      <Clock className="h-3 w-3" />
                      {batch.event_time}
                    </span>
                  )}
                </CardDescription>
                {batch.event_location && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {batch.event_location}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => batch.items && handleDownloadAll(batch)}
                  disabled={!batch.items || batch.items.length === 0}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Todos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setBatchToDelete(batch)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          {expandedBatch === batch.id && (
            <CardContent className="pt-0">
              {batch.items ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {batch.items.map((item) => (
                    <div
                      key={item.id}
                      className="relative group rounded-lg overflow-hidden border"
                    >
                      <img
                        src={item.image_url}
                        alt={FORMAT_LABELS[item.format]}
                        className="w-full object-cover"
                        style={{
                          aspectRatio:
                            item.format === 'instagram_story'
                              ? '9/16'
                              : item.format === 'instagram_post'
                              ? '1/1'
                              : item.format === 'facebook_post'
                              ? '1200/630'
                              : '4/3',
                          maxHeight: item.format === 'instagram_story' ? '200px' : undefined,
                        }}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDownload(item)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Descargar
                        </Button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                        <span className="text-white text-xs">
                          {FORMAT_LABELS[item.format]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                </div>
              )}
            </CardContent>
          )}
        </Card>
      ))}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!batchToDelete} onOpenChange={() => setBatchToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar batch</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar "{batchToDelete?.name}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingBatch}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBatch}
              disabled={!!deletingBatch}
              className="bg-red-500 hover:bg-red-600"
            >
              {deletingBatch ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SavedBatches;
