/**
 * SongEditDialog — Dialog for creating or editing a song.
 *
 * When songId is null, it's a "create" dialog. When songId is provided,
 * it loads existing data and allows updating.
 * Slug is auto-generated on create from the title.
 * Themes and moments are checkbox grids.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSongById, useSongBySlug, useCreateSong, useUpdateSong } from '@/hooks/useMusicLibrary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { TEMPO_LABELS, THEME_LABELS, MOMENT_LABELS } from '@/lib/canciones/songTagsManager';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { SongTempo, SongTheme, LiturgicalMoment, Verse } from '@/types/shared/song';

interface SongEditDialogProps {
  songId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s-]/g, '')    // remove special chars
    .trim()
    .replace(/\s+/g, '-')            // spaces to hyphens
    .replace(/-+/g, '-');             // collapse multiple hyphens
}

const SongEditDialog = ({ songId, open, onOpenChange }: SongEditDialogProps) => {
  const isEditing = songId !== null;
  const { data: existingSong, isLoading } = useSongById(songId);
  const createSong = useCreateSong();
  const updateSong = useUpdateSong();

  // Form state
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [number, setNumber] = useState('');
  const [originalKey, setOriginalKey] = useState('');
  const [tempo, setTempo] = useState<SongTempo | ''>('');
  const [ccliNumber, setCcliNumber] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [lyricsText, setLyricsText] = useState('');
  const [selectedThemes, setSelectedThemes] = useState<SongTheme[]>([]);
  const [selectedMoments, setSelectedMoments] = useState<LiturgicalMoment[]>([]);

  const resetForm = useCallback(() => {
    setTitle('');
    setArtist('');
    setSlug('');
    setSlugManuallyEdited(false);
    setNumber('');
    setOriginalKey('');
    setTempo('');
    setCcliNumber('');
    setDurationSeconds('');
    setSpotifyUrl('');
    setYoutubeUrl('');
    setLyricsText('');
    setSelectedThemes([]);
    setSelectedMoments([]);
  }, []);

  // Populate form when editing
  useEffect(() => {
    if (isEditing && existingSong) {
      setTitle(existingSong.title);
      setArtist(existingSong.artist ?? '');
      setSlug(existingSong.slug);
      setSlugManuallyEdited(true); // don't auto-gen for edits
      setNumber(existingSong.number?.toString() ?? '');
      setOriginalKey(existingSong.original_key ?? '');
      setTempo(existingSong.tempo ?? '');
      setCcliNumber(existingSong.ccli_number ?? '');
      setDurationSeconds(existingSong.duration_seconds?.toString() ?? '');
      setSpotifyUrl(existingSong.spotify_url ?? '');
      setYoutubeUrl(existingSong.youtube_url ?? '');
      const existingLyrics = (existingSong.lyrics ?? []) as Verse[];
      setLyricsText(existingLyrics.map(v => v.content).join('\n\n'));
      setSelectedThemes((existingSong.themes ?? []) as SongTheme[]);
      setSelectedMoments((existingSong.suggested_moments ?? []) as LiturgicalMoment[]);
    } else if (!isEditing) {
      resetForm();
    }
  }, [isEditing, existingSong, resetForm]);

  // Auto-generate slug from title (only on create, only if not manually edited)
  useEffect(() => {
    if (!isEditing && !slugManuallyEdited && title) {
      setSlug(generateSlug(title));
    }
  }, [title, isEditing, slugManuallyEdited]);

  const toggleTheme = (theme: SongTheme) => {
    setSelectedThemes((prev) =>
      prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]
    );
  };

  const toggleMoment = (moment: LiturgicalMoment) => {
    setSelectedMoments((prev) =>
      prev.includes(moment) ? prev.filter((m) => m !== moment) : [...prev, moment]
    );
  };

  const handleSubmit = async () => {
    let finalSlug = slug.trim() || generateSlug(title);

    // On create, verify slug uniqueness; append timestamp if collision
    if (!isEditing) {
      const { data: existing } = await supabase
        .from('music_songs')
        .select('id')
        .eq('slug', finalSlug)
        .maybeSingle();
      if (existing) {
        finalSlug = `${finalSlug}-${Date.now()}`;
      }
    }

    // Parse lyrics text into Verse[] (split by blank lines)
    const parsedLyrics: Verse[] | null = lyricsText.trim()
      ? lyricsText
          .split(/\n\s*\n/)
          .map(block => block.trim())
          .filter(block => block.length > 0)
          .map((block, i) => ({
            number: i + 1,
            type: 'verse' as const,
            content: block,
          }))
      : null;

    const songData = {
      title: title.trim(),
      slug: finalSlug,
      artist: artist.trim() || null,
      number: number ? parseInt(number, 10) : null,
      original_key: originalKey.trim() || null,
      tempo: (tempo || null) as SongTempo | null,
      ccli_number: ccliNumber.trim() || null,
      duration_seconds: durationSeconds ? parseInt(durationSeconds, 10) : null,
      spotify_url: spotifyUrl.trim() || null,
      youtube_url: youtubeUrl.trim() || null,
      themes: selectedThemes.length > 0 ? selectedThemes : null,
      suggested_moments: selectedMoments.length > 0 ? selectedMoments : null,
      lyrics: parsedLyrics,
    };

    if (isEditing && songId) {
      updateSong.mutate(
        { id: songId, song: songData },
        {
          onSuccess: () => {
            onOpenChange(false);
          },
        }
      );
    } else {
      createSong.mutate(songData, {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      });
    }
  };

  const isPending = createSong.isPending || updateSong.isPending;
  const canSubmit = title.trim().length > 0 && slug.trim().length > 0 && !isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}>
            {isEditing ? 'Editar canción' : 'Nueva canción'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los datos de la canción.'
              : 'Completa los campos para agregar una canción a la biblioteca.'}
          </DialogDescription>
        </DialogHeader>

        {isEditing && isLoading ? (
          <div className="px-6 py-8 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-6 pb-4">
              {/* Basic info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nombre de la canción"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="artist">Artista</Label>
                  <Input
                    id="artist"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="Compositor o intérprete"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Slug *</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugManuallyEdited(true);
                    }}
                    placeholder="identificador-url"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="number">Número</Label>
                  <Input
                    id="number"
                    type="number"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="Ej: 42"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="originalKey">Tonalidad original</Label>
                  <Input
                    id="originalKey"
                    value={originalKey}
                    onChange={(e) => setOriginalKey(e.target.value)}
                    placeholder="Ej: G, Am, Bb"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tempo">Tempo</Label>
                  <Select
                    value={tempo}
                    onValueChange={(v) => setTempo(v === '__none__' ? '' : v as SongTempo)}
                  >
                    <SelectTrigger id="tempo">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin especificar</SelectItem>
                      {(Object.entries(TEMPO_LABELS) as [SongTempo, string][]).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ccliNumber">Número CCLI</Label>
                  <Input
                    id="ccliNumber"
                    value={ccliNumber}
                    onChange={(e) => setCcliNumber(e.target.value)}
                    placeholder="Ej: 1234567"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duración (segundos)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(e.target.value)}
                    placeholder="Ej: 240"
                  />
                </div>
              </div>

              {/* Lyrics */}
              <div className="space-y-2">
                <Label htmlFor="lyrics">Letra de la canción</Label>
                <textarea
                  id="lyrics"
                  value={lyricsText}
                  onChange={(e) => setLyricsText(e.target.value)}
                  placeholder="Pega aquí la letra de la canción...&#10;&#10;Usa líneas vacías para separar los versos."
                  rows={8}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  style={{ resize: 'vertical' }}
                />
                <p className="text-xs text-muted-foreground">
                  Separa los versos con líneas vacías. Cada bloque se convierte en un verso/slide.
                </p>
              </div>

              {/* URLs */}
              <div className="space-y-4">
                <h3
                  className="text-sm font-semibold uppercase tracking-wider"
                  style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                >
                  Enlaces externos
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="spotifyUrl">Spotify URL</Label>
                    <Input
                      id="spotifyUrl"
                      type="url"
                      value={spotifyUrl}
                      onChange={(e) => setSpotifyUrl(e.target.value)}
                      placeholder="https://open.spotify.com/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="youtubeUrl">YouTube URL</Label>
                    <Input
                      id="youtubeUrl"
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://youtube.com/..."
                    />
                  </div>
                </div>
              </div>

              {/* Themes checkbox grid */}
              <div className="space-y-3">
                <h3
                  className="text-sm font-semibold uppercase tracking-wider"
                  style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                >
                  Temas
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.entries(THEME_LABELS) as [SongTheme, string][]).map(([value, label]) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={selectedThemes.includes(value)}
                        onCheckedChange={() => toggleTheme(value)}
                      />
                      <span className="text-sm" style={{ color: CASA_BRAND.colors.primary.black }}>
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Moments checkbox grid */}
              <div className="space-y-3">
                <h3
                  className="text-sm font-semibold uppercase tracking-wider"
                  style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                >
                  Momentos sugeridos
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(MOMENT_LABELS) as [LiturgicalMoment, string][]).map(([value, label]) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={selectedMoments.includes(value)}
                        onCheckedChange={() => toggleMoment(value)}
                      />
                      <span className="text-sm" style={{ color: CASA_BRAND.colors.primary.black }}>
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="px-6 py-4 border-t" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending
              ? 'Guardando...'
              : isEditing
                ? 'Guardar cambios'
                : 'Crear canción'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SongEditDialog;
