/**
 * StemUploadGrid — 9 stem type slots displayed in a grid.
 *
 * Each slot represents one stem type: click, cues, pads, bass, drums,
 * guitars, vocals, keys, other.
 * Upload to music-stems bucket, delete from storage + DB.
 */

import { useRef } from 'react';
import { useCreateStem, useDeleteStem } from '@/hooks/useMusicLibrary';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Upload, Trash2, FileAudio } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { StemType, MusicStemRow } from '@/types/musicPlanning';

interface StemUploadGridProps {
  arrangementId: string;
  stems: MusicStemRow[];
  canWrite: boolean;
  canManage: boolean;
}

const STEM_TYPES: { type: StemType; label: string }[] = [
  { type: 'click', label: 'Click' },
  { type: 'cues', label: 'Cues' },
  { type: 'pads', label: 'Pads' },
  { type: 'bass', label: 'Bajo' },
  { type: 'drums', label: 'Batería' },
  { type: 'guitars', label: 'Guitarras' },
  { type: 'vocals', label: 'Voces' },
  { type: 'keys', label: 'Teclado' },
  { type: 'other', label: 'Otro' },
];

const StemUploadGrid = ({ arrangementId, stems, canWrite, canManage }: StemUploadGridProps) => {
  const createStem = useCreateStem();
  const deleteStem = useDeleteStem();
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const stemByType = new Map<StemType, MusicStemRow>();
  for (const stem of stems) {
    stemByType.set(stem.stem_type, stem);
  }

  const MAX_STEM_SIZE = 50 * 1024 * 1024; // 50 MB

  const handleUpload = async (stemType: StemType, file: File) => {
    if (file.size > MAX_STEM_SIZE) {
      toast({
        title: 'Archivo demasiado grande',
        description: `El máximo permitido es 50 MB. Este archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
        variant: 'destructive',
      });
      return;
    }

    const ext = file.name.split('.').pop() ?? 'wav';
    const storagePath = `${arrangementId}/${stemType}.${ext}`;

    // If a stem of this type already exists, delete old DB record + storage
    const existingStem = stemByType.get(stemType);
    if (existingStem) {
      await supabase.storage.from('music-stems').remove([existingStem.storage_path]);
      await supabase.from('music_stems').delete().eq('id', existingStem.id);
    }

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('music-stems')
      .upload(storagePath, file, { upsert: true });

    if (uploadError) {
      toast({
        title: 'Error al subir archivo',
        description: uploadError.message,
        variant: 'destructive',
      });
      return;
    }

    // Create DB record — roll back storage upload on failure
    createStem.mutate(
      {
        arrangement_id: arrangementId,
        stem_type: stemType,
        storage_path: storagePath,
        file_name: file.name,
      },
      {
        onError: async () => {
          await supabase.storage.from('music-stems').remove([storagePath]);
        },
      }
    );
  };

  const handleDelete = async (stem: MusicStemRow) => {
    // Delete from storage first
    const { error: storageError } = await supabase.storage
      .from('music-stems')
      .remove([stem.storage_path]);

    if (storageError) {
      toast({
        title: 'Error al eliminar archivo del almacenamiento',
        description: storageError.message,
        variant: 'destructive',
      });
      // Still try to delete DB record
    }

    deleteStem.mutate(stem.id);
  };

  const handleFileChange = (stemType: StemType, files: FileList | null) => {
    if (files && files.length > 0) {
      handleUpload(stemType, files[0]);
    }
  };

  return (
    <div className="space-y-3">
      <h4
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: CASA_BRAND.colors.secondary.grayDark }}
      >
        Stems de audio
      </h4>
      <div className="grid grid-cols-3 gap-2">
        {STEM_TYPES.map(({ type, label }) => {
          const existing = stemByType.get(type);

          return (
            <div
              key={type}
              className="border rounded-md p-3 flex flex-col items-center gap-2"
              style={{
                borderColor: existing
                  ? CASA_BRAND.colors.primary.amber
                  : CASA_BRAND.colors.secondary.grayLight,
                backgroundColor: existing ? `${CASA_BRAND.colors.primary.amber}08` : 'transparent',
              }}
            >
              <FileAudio
                className="h-5 w-5"
                style={{
                  color: existing
                    ? CASA_BRAND.colors.primary.amber
                    : CASA_BRAND.colors.secondary.grayMedium,
                }}
              />
              <span
                className="text-xs font-medium text-center"
                style={{ color: CASA_BRAND.colors.primary.black }}
              >
                {label}
              </span>

              {existing ? (
                <div className="flex flex-col items-center gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    {existing.file_name ?? 'Subido'}
                  </Badge>
                  {canManage && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-600"
                          title="Eliminar stem"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar stem</AlertDialogTitle>
                          <AlertDialogDescription>
                            {`¿Eliminar el stem "${label}"? Se eliminará el archivo y el registro.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(existing)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ) : canWrite ? (
                <>
                  <input
                    ref={(el) => { fileInputRefs.current[type] = el; }}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(type, e.target.files)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => fileInputRefs.current[type]?.click()}
                    title="Subir stem"
                    aria-label="Subir archivo"
                    disabled={createStem.isPending}
                  >
                    <Upload className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <span
                  className="text-[10px]"
                  style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                >
                  Vacío
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StemUploadGrid;
