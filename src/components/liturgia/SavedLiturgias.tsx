/**
 * SavedLiturgias - Lista de liturgias guardadas con opción de cargar
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Loader2,
  Calendar,
  Trash2,
  Eye,
  FileText,
  ChevronRight,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type {
  LiturgiaRecord,
  OracionRecord,
  LecturaRecord,
  OracionesAntifonales,
  LecturaFetched,
  LiturgiaInput,
  Tiempo,
} from './types';

interface SavedLiturgia extends LiturgiaRecord {
  liturgia_oraciones: OracionRecord[];
  liturgia_lecturas: LecturaRecord[];
}

interface SavedLitugiasProps {
  onLoad: (
    liturgiaInput: LiturgiaInput,
    lecturas: LecturaFetched[],
    oraciones: OracionesAntifonales
  ) => void;
}

export const SavedLiturgias = ({ onLoad }: SavedLitugiasProps) => {
  const { toast } = useToast();
  const [liturgias, setLiturgias] = useState<SavedLiturgia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch saved liturgias
  const fetchLiturgias = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('liturgias')
        .select(`
          *,
          liturgia_oraciones (*),
          liturgia_lecturas (*)
        `)
        .order('fecha', { ascending: false });

      if (error) throw error;

      setLiturgias((data as SavedLiturgia[]) || []);
    } catch (err) {
      console.error('Error fetching liturgias:', err);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las liturgias guardadas',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiturgias();
  }, []);

  // Delete a liturgia
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('liturgias')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setLiturgias((prev) => prev.filter((l) => l.id !== id));
      toast({
        title: 'Liturgia eliminada',
        description: 'La liturgia ha sido eliminada exitosamente',
      });
    } catch (err) {
      console.error('Error deleting liturgia:', err);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la liturgia',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Load a liturgia into the editor
  const handleLoad = (liturgia: SavedLiturgia) => {
    // Reconstruct LiturgiaInput
    const liturgiaInput: LiturgiaInput = {
      fecha: new Date(liturgia.fecha),
      titulo: liturgia.titulo,
      resumen: liturgia.resumen || '',
      lecturas: liturgia.liturgia_lecturas.map((l) => l.cita),
    };

    // Reconstruct LecturaFetched array
    const lecturas: LecturaFetched[] = liturgia.liturgia_lecturas
      .sort((a, b) => a.orden - b.orden)
      .map((l) => ({
        cita: l.cita,
        texto: l.texto,
        version: l.version,
        versionCode: l.version,
      }));

    // Reconstruct OracionesAntifonales
    const oracionesMap: Record<string, OracionRecord> = {};
    liturgia.liturgia_oraciones.forEach((o) => {
      oracionesMap[o.tipo] = o;
    });

    const oraciones: OracionesAntifonales = {
      invocacion: {
        titulo: 'Invocacion',
        tiempos: (oracionesMap['invocacion']?.tiempos as Tiempo[]) || [],
      },
      arrepentimiento: {
        titulo: 'Arrepentimiento',
        tiempos: (oracionesMap['arrepentimiento']?.tiempos as Tiempo[]) || [],
      },
      gratitud: {
        titulo: 'Gratitud',
        tiempos: (oracionesMap['gratitud']?.tiempos as Tiempo[]) || [],
      },
    };

    onLoad(liturgiaInput, lecturas, oraciones);
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (liturgias.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            No hay liturgias guardadas
          </h3>
          <p className="text-sm text-gray-500 text-center max-w-md">
            Las liturgias que generes y guardes aparecern aqui. Puedes cargarlas
            para ver los slides o editarlas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-800">
          Liturgias Guardadas
        </h2>
        <span className="text-sm text-gray-500">
          {liturgias.length} {liturgias.length === 1 ? 'liturgia' : 'liturgias'}
        </span>
      </div>

      <div className="grid gap-4">
        {liturgias.map((liturgia) => (
          <Card
            key={liturgia.id}
            className="hover:border-amber-200 transition-colors"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">
                    {liturgia.titulo}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(liturgia.fecha)}</span>
                  </div>
                  {liturgia.resumen && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                      {liturgia.resumen}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                    <span>
                      {liturgia.liturgia_lecturas.length}{' '}
                      {liturgia.liturgia_lecturas.length === 1
                        ? 'lectura'
                        : 'lecturas'}
                    </span>
                    <span>
                      {liturgia.liturgia_oraciones.length} oraciones
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleLoad(liturgia)}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Cargar
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={deletingId === liturgia.id}
                      >
                        {deletingId === liturgia.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar liturgia</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta seguro de eliminar la liturgia "{liturgia.titulo}"?
                          Esta accion no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(liturgia.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SavedLiturgias;
