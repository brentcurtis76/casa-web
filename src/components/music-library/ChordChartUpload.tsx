/**
 * ChordChartUpload — Upload and manage chord charts for an arrangement.
 *
 * Upload to music-chord-charts bucket. Signed URLs for viewing.
 * Delete from storage + DB.
 */

import { useState, useRef } from 'react';
import { useCreateChordChart, useDeleteChordChart } from '@/hooks/useMusicLibrary';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Upload, Trash2, FileImage, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { MusicChordChartRow, ChartFileType } from '@/types/musicPlanning';

interface ChordChartUploadProps {
  arrangementId: string;
  charts: MusicChordChartRow[];
  canWrite: boolean;
  canManage: boolean;
}

function detectFileType(fileName: string): ChartFileType | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'png') return 'png';
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  return null;
}

const ChordChartUpload = ({ arrangementId, charts, canWrite, canManage }: ChordChartUploadProps) => {
  const createChart = useCreateChordChart();
  const deleteChart = useDeleteChordChart();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [transpositionKey, setTranspositionKey] = useState('');

  const MAX_CHART_SIZE = 10 * 1024 * 1024; // 10 MB

  const handleUpload = async (file: File) => {
    if (file.size > MAX_CHART_SIZE) {
      toast({
        title: 'Archivo demasiado grande',
        description: `El máximo permitido es 10 MB. Este archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
        variant: 'destructive',
      });
      return;
    }

    const fileType = detectFileType(file.name);
    if (!fileType) {
      toast({
        title: 'Formato no soportado',
        description: 'Solo se aceptan archivos PDF, PNG o JPG.',
        variant: 'destructive',
      });
      return;
    }

    const ext = file.name.split('.').pop() ?? fileType;
    const storagePath = `${arrangementId}/${Date.now()}.${ext}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('music-chord-charts')
      .upload(storagePath, file, { upsert: false });

    if (uploadError) {
      toast({
        title: 'Error al subir archivo',
        description: uploadError.message,
        variant: 'destructive',
      });
      return;
    }

    // Create DB record — roll back storage upload on failure
    createChart.mutate(
      {
        arrangement_id: arrangementId,
        storage_path: storagePath,
        file_type: fileType,
        transposition_key: transpositionKey.trim() || null,
      },
      {
        onError: async () => {
          await supabase.storage.from('music-chord-charts').remove([storagePath]);
        },
      }
    );

    setTranspositionKey('');
  };

  const handleDelete = async (chart: MusicChordChartRow) => {
    // Delete from storage first
    const { error: storageError } = await supabase.storage
      .from('music-chord-charts')
      .remove([chart.storage_path]);

    if (storageError) {
      toast({
        title: 'Error al eliminar archivo del almacenamiento',
        description: storageError.message,
        variant: 'destructive',
      });
    }

    deleteChart.mutate(chart.id);
  };

  const handleViewChart = async (chart: MusicChordChartRow) => {
    const { data, error } = await supabase.storage
      .from('music-chord-charts')
      .createSignedUrl(chart.storage_path, 3600); // 1 hour

    if (error || !data?.signedUrl) {
      toast({
        title: 'Error al generar enlace',
        description: error?.message ?? 'No se pudo generar la URL firmada.',
        variant: 'destructive',
      });
      return;
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleFileChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  };

  return (
    <div className="space-y-3">
      <h4
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: CASA_BRAND.colors.secondary.grayDark }}
      >
        Partituras / Chord Charts
      </h4>

      {/* Existing charts */}
      {charts.length > 0 ? (
        <div className="space-y-2">
          {charts.map((chart) => (
            <div
              key={chart.id}
              className="flex items-center justify-between border rounded-md px-3 py-2"
              style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileImage className="h-4 w-4 flex-shrink-0" style={{ color: CASA_BRAND.colors.primary.amber }} />
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: CASA_BRAND.colors.primary.black }}>
                    {chart.storage_path.split('/').pop()}
                  </p>
                  <div className="flex gap-1.5 mt-0.5">
                    {chart.file_type && (
                      <Badge variant="outline" className="text-[10px]">
                        {chart.file_type.toUpperCase()}
                      </Badge>
                    )}
                    {chart.transposition_key && (
                      <Badge variant="secondary" className="text-[10px]">
                        {chart.transposition_key}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleViewChart(chart)}
                  title="Ver partitura"
                  aria-label="Ver"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                {canManage && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600"
                        title="Eliminar partitura"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar partitura</AlertDialogTitle>
                        <AlertDialogDescription>
                          ¿Eliminar esta partitura? Se eliminará el archivo y el registro.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(chart)}
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
          ))}
        </div>
      ) : (
        <p className="text-sm text-center py-4" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
          No hay partituras.
        </p>
      )}

      {/* Upload form */}
      {canWrite && (
        <div className="flex items-end gap-2 pt-2 border-t" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
          <div className="flex-1">
            <Label htmlFor="chart-key" className="text-xs">
              Tonalidad (opcional)
            </Label>
            <Input
              id="chart-key"
              value={transpositionKey}
              onChange={(e) => setTranspositionKey(e.target.value)}
              placeholder="Ej: G, Am"
              className="h-9 text-sm"
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={createChart.isPending}
            className="gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            {createChart.isPending ? 'Subiendo...' : 'Subir'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ChordChartUpload;
