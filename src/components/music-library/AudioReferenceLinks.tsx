/**
 * AudioReferenceLinks — Add/delete audio reference links for a song.
 *
 * Auto-detects youtube/spotify from URL. Supports manual source type selection.
 */

import { useState } from 'react';
import { useCreateAudioReference, useDeleteAudioReference } from '@/hooks/useMusicLibrary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Trash2, ExternalLink, Youtube, Music2, Link2 } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { MusicAudioReferenceRow, AudioSourceType } from '@/types/musicPlanning';

interface AudioReferenceLinksProps {
  songId: string;
  references: MusicAudioReferenceRow[];
  canWrite: boolean;
  canManage: boolean;
}

function detectSourceType(url: string): AudioSourceType {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('spotify.com')) return 'spotify';
  return 'other';
}

const SOURCE_TYPE_LABELS: Record<AudioSourceType, string> = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  upload: 'Archivo',
  other: 'Otro',
};

const SourceIcon = ({ sourceType }: { sourceType: AudioSourceType | null }) => {
  switch (sourceType) {
    case 'youtube':
      return <Youtube className="h-4 w-4" style={{ color: '#FF0000' }} />;
    case 'spotify':
      return <Music2 className="h-4 w-4" style={{ color: '#1DB954' }} />;
    default:
      return <Link2 className="h-4 w-4" style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />;
  }
};

const AudioReferenceLinks = ({ songId, references, canWrite, canManage }: AudioReferenceLinksProps) => {
  const createRef = useCreateAudioReference();
  const deleteRef = useDeleteAudioReference();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const handleAdd = () => {
    const url = newUrl.trim();
    if (!url) return;

    const sourceType = detectSourceType(url);
    createRef.mutate(
      {
        song_id: songId,
        url,
        source_type: sourceType,
        description: newDescription.trim() || null,
      },
      {
        onSuccess: () => {
          setNewUrl('');
          setNewDescription('');
          setShowAddForm(false);
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: CASA_BRAND.colors.secondary.grayDark }}
        >
          Referencias de audio ({references.length})
        </h3>
        {canWrite && !showAddForm && (
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        )}
      </div>

      {/* Existing references */}
      {references.length > 0 ? (
        <div className="space-y-2">
          {references.map((ref) => (
            <div
              key={ref.id}
              className="flex items-center justify-between border rounded-md px-3 py-2.5"
              style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <SourceIcon sourceType={ref.source_type} />
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: CASA_BRAND.colors.primary.black }}>
                    {ref.description ?? ref.url}
                  </p>
                  {ref.description && (
                    <p className="text-xs truncate" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                      {ref.url}
                    </p>
                  )}
                  {ref.source_type && (
                    <Badge variant="secondary" className="text-[10px] mt-0.5">
                      {SOURCE_TYPE_LABELS[ref.source_type]}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => window.open(ref.url, '_blank', 'noopener,noreferrer')}
                  title="Abrir enlace"
                  aria-label="Abrir enlace"
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
                        title="Eliminar referencia"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar referencia</AlertDialogTitle>
                        <AlertDialogDescription>
                          ¿Eliminar esta referencia de audio?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteRef.mutate(ref.id)}
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
      ) : !showAddForm ? (
        <p className="text-sm text-center py-6" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
          No hay referencias de audio. {canWrite ? 'Agrega la primera.' : ''}
        </p>
      ) : null}

      {/* Add form */}
      {canWrite && showAddForm && (
        <div
          className="space-y-3 border rounded-md p-4"
          style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
        >
          <div className="space-y-2">
            <Label htmlFor="ref-url">URL *</Label>
            <Input
              id="ref-url"
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://youtube.com/... o https://open.spotify.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ref-desc">Descripción (opcional)</Label>
            <Input
              id="ref-desc"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Ej: Versión original, Cover acústico"
            />
          </div>
          {newUrl.trim() && (
            <p className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              Tipo detectado: <strong>{SOURCE_TYPE_LABELS[detectSourceType(newUrl.trim())]}</strong>
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setNewUrl('');
                setNewDescription('');
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newUrl.trim() || createRef.isPending}
            >
              {createRef.isPending ? 'Agregando...' : 'Agregar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioReferenceLinks;
