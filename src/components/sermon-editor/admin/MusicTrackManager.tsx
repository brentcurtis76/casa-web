/**
 * Admin component for managing intro/outro music tracks
 * Part of PROMPT_004: Intro/Outro Music Integration
 */
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Play, Pause, Trash2, Check, Loader2, Music2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Progress } from '@/components/ui/progress';

// Types
export interface MusicTrack {
  id: string;
  name: string;
  type: 'intro' | 'outro';
  audio_url: string;
  duration_seconds: number | null;
  is_default: boolean;
  created_at: string;
  created_by: string | null;
}

interface TrackUploadForm {
  name: string;
  type: 'intro' | 'outro';
  file: File | null;
}

// Brand-consistent toast styles
const toastStyles = {
  success: {
    style: {
      background: '#292524',
      color: '#fef3c7',
      border: '1px solid #D97706',
    },
  },
  error: {
    style: {
      background: '#292524',
      color: '#fef3c7',
      border: '1px solid #dc2626',
    },
  },
};

export function MusicTrackManager() {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [deleteConfirmTrack, setDeleteConfirmTrack] = useState<MusicTrack | null>(null);
  const [form, setForm] = useState<TrackUploadForm>({
    name: '',
    type: 'intro',
    file: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch tracks on mount
  useEffect(() => {
    fetchTracks();
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const fetchTracks = async () => {
    try {
      const { data, error } = await supabase
        .from('sermon_music_tracks')
        .select('*')
        .order('type')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTracks((data as MusicTrack[]) || []);
    } catch (err) {
      console.error('Error fetching tracks:', err);
      toast.error('Error al cargar las pistas de música', toastStyles.error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave'];
    if (!validTypes.includes(file.type)) {
      toast.error('Formato no soportado. Use MP3 o WAV.', toastStyles.error);
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo es demasiado grande. Máximo 10MB.', toastStyles.error);
      return;
    }

    setForm(prev => ({ ...prev, file }));
  };

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const timeoutId = setTimeout(() => {
        URL.revokeObjectURL(audio.src);
        reject(new Error('Audio duration detection timed out'));
      }, 10000); // 10 second timeout

      audio.onloadedmetadata = () => {
        clearTimeout(timeoutId);
        resolve(audio.duration);
        URL.revokeObjectURL(audio.src);
      };
      audio.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error('Failed to load audio'));
        URL.revokeObjectURL(audio.src);
      };
      audio.src = URL.createObjectURL(file);
    });
  };

  const handleUpload = async () => {
    if (!form.file || !form.name.trim() || !user) {
      toast.error('Complete todos los campos', toastStyles.error);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Get audio duration
      setUploadProgress(10);
      const duration = await getAudioDuration(form.file);

      // Generate unique filename
      const fileExt = form.file.name.split('.').pop();
      const fileName = `${form.type}_${Date.now()}.${fileExt}`;
      const filePath = `${form.type}/${fileName}`;

      // Upload file to storage
      setUploadProgress(30);
      const { error: uploadError } = await supabase.storage
        .from('sermon-music')
        .upload(filePath, form.file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      setUploadProgress(70);
      const { data: urlData } = supabase.storage
        .from('sermon-music')
        .getPublicUrl(filePath);

      // Create database record
      setUploadProgress(90);
      const { error: dbError } = await supabase
        .from('sermon_music_tracks')
        .insert({
          name: form.name.trim(),
          type: form.type,
          audio_url: urlData.publicUrl,
          duration_seconds: Math.round(duration * 100) / 100,
          is_default: false,
          created_by: user.id,
        });

      if (dbError) throw dbError;

      setUploadProgress(100);
      toast.success('Pista subida exitosamente', toastStyles.success);

      // Reset form and refresh
      setForm({ name: '', type: 'intro', file: null });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await fetchTracks();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Error al subir la pista', toastStyles.error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSetDefault = async (track: MusicTrack) => {
    try {
      // Use the database function to set default
      const { error } = await supabase.rpc('set_music_track_as_default', {
        track_id: track.id,
      });

      if (error) throw error;

      toast.success(`${track.name} establecida como predeterminada`, toastStyles.success);
      await fetchTracks();
    } catch (err) {
      console.error('Set default error:', err);
      toast.error('Error al establecer como predeterminada', toastStyles.error);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmTrack) return;

    try {
      // PROMPT_004b Fix 2: Safely extract file path from URL using URL API
      const url = new URL(deleteConfirmTrack.audio_url);
      const pathParts = url.pathname.split('/');
      // Find the bucket name and get everything after it
      const bucketIndex = pathParts.findIndex(p => p === 'sermon-music');
      const filePath = bucketIndex >= 0
        ? pathParts.slice(bucketIndex + 1).join('/')
        : `${deleteConfirmTrack.type}/${pathParts[pathParts.length - 1]}`;

      // Delete from storage (PROMPT_004b Fix 6: handle storage errors)
      const { error: storageError } = await supabase.storage
        .from('sermon-music')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage deletion failed, file may be orphaned:', storageError);
        // Continue with DB deletion - file cleanup can be done manually
      }

      // Delete from database
      const { error } = await supabase
        .from('sermon_music_tracks')
        .delete()
        .eq('id', deleteConfirmTrack.id);

      if (error) throw error;

      toast.success('Pista eliminada', toastStyles.success);
      setDeleteConfirmTrack(null);
      await fetchTracks();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Error al eliminar la pista', toastStyles.error);
    }
  };

  const handlePlayPause = (track: MusicTrack) => {
    if (playingTrackId === track.id && audioRef.current) {
      audioRef.current.pause();
      setPlayingTrackId(null);
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Create new audio element
    const audio = new Audio(track.audio_url);
    audio.onended = () => setPlayingTrackId(null);
    audio.play().catch(err => {
      console.error('Audio playback failed:', err);
      setPlayingTrackId(null);
    });
    audioRef.current = audio;
    setPlayingTrackId(track.id);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const introTracks = tracks.filter(t => t.type === 'intro');
  const outroTracks = tracks.filter(t => t.type === 'outro');

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Subir Nueva Pista
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="track-name">Nombre de la pista</Label>
              <Input
                id="track-name"
                placeholder="ej: CASA Intro 2024"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="track-type">Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(value: 'intro' | 'outro') =>
                  setForm(prev => ({ ...prev, type: value }))
                }
                disabled={uploading}
              >
                <SelectTrigger id="track-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="intro">Introducción</SelectItem>
                  <SelectItem value="outro">Cierre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="track-file">Archivo de audio (MP3 o WAV, máx 10MB)</Label>
            <Input
              ref={fileInputRef}
              id="track-file"
              type="file"
              accept="audio/mpeg,audio/wav,audio/x-wav"
              onChange={handleFileSelect}
              disabled={uploading}
            />
            {form.file && (
              <p className="text-sm text-muted-foreground">
                Seleccionado: {form.file.name}
              </p>
            )}
          </div>

          {uploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                Subiendo... {uploadProgress}%
              </p>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={uploading || !form.file || !form.name.trim()}
            className="w-full bg-amber-600 hover:bg-amber-700"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Subir Pista
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Intro Tracks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Music2 className="h-5 w-5 text-amber-600" />
            Pistas de Introducción
          </CardTitle>
        </CardHeader>
        <CardContent>
          {introTracks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay pistas de introducción
            </p>
          ) : (
            <div className="space-y-2">
              {introTracks.map(track => (
                <TrackItem
                  key={track.id}
                  track={track}
                  isPlaying={playingTrackId === track.id}
                  onPlayPause={() => handlePlayPause(track)}
                  onSetDefault={() => handleSetDefault(track)}
                  onDelete={() => setDeleteConfirmTrack(track)}
                  formatDuration={formatDuration}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outro Tracks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Music2 className="h-5 w-5 text-stone-600" />
            Pistas de Cierre
          </CardTitle>
        </CardHeader>
        <CardContent>
          {outroTracks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay pistas de cierre
            </p>
          ) : (
            <div className="space-y-2">
              {outroTracks.map(track => (
                <TrackItem
                  key={track.id}
                  track={track}
                  isPlaying={playingTrackId === track.id}
                  onPlayPause={() => handlePlayPause(track)}
                  onSetDefault={() => handleSetDefault(track)}
                  onDelete={() => setDeleteConfirmTrack(track)}
                  formatDuration={formatDuration}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmTrack} onOpenChange={() => setDeleteConfirmTrack(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pista?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la pista
              "{deleteConfirmTrack?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Sub-component for track item
interface TrackItemProps {
  track: MusicTrack;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
  formatDuration: (seconds: number | null) => string;
}

function TrackItem({
  track,
  isPlaying,
  onPlayPause,
  onSetDefault,
  onDelete,
  formatDuration,
}: TrackItemProps) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border ${
        track.is_default ? 'border-amber-500 bg-amber-50' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onPlayPause}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <div>
          <p className="font-medium text-sm">
            {track.name}
            {track.is_default && (
              <span className="ml-2 text-xs text-amber-600 font-normal">
                (Predeterminada)
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDuration(track.duration_seconds)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!track.is_default && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSetDefault}
            className="text-xs"
          >
            <Check className="h-3 w-3 mr-1" />
            Predeterminada
          </Button>
        )}
        {/* PROMPT_004b Fix 5: Disable delete button for default tracks */}
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${track.is_default ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:text-red-700 hover:bg-red-50'}`}
          onClick={onDelete}
          disabled={track.is_default}
          title={track.is_default ? 'No se puede eliminar la pista predeterminada' : 'Eliminar'}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default MusicTrackManager;
