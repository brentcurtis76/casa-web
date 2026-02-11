/**
 * SongListTable — Searchable, filterable table of songs.
 *
 * Uses useSongs() with 300ms debounced search, 3 filter selects (tempo, theme, moment),
 * and a table with key columns.
 */

import { useState, useMemo } from 'react';
import { useSongs } from '@/hooks/useMusicLibrary';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Pencil, Trash2, X } from 'lucide-react';
import { TEMPO_LABELS, THEME_LABELS, MOMENT_LABELS, THEME_COLORS } from '@/lib/canciones/songTagsManager';
import { CASA_BRAND } from '@/lib/brand-kit';
import { formatDuration } from '@/lib/music-planning/formatters';
import type { SongListFilters } from '@/types/musicPlanning';
import type { SongTempo, SongTheme, LiturgicalMoment } from '@/types/shared/song';
import useDebounce from '@/hooks/useDebounce';

interface SongListTableProps {
  onSongClick: (songId: string) => void;
  onEditClick: (songId: string) => void;
  onDeleteClick: (songId: string, title: string) => void;
  canWrite: boolean;
  canManage: boolean;
}

const SongListTable = ({ onSongClick, onEditClick, onDeleteClick, canWrite, canManage }: SongListTableProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tempoFilter, setTempoFilter] = useState<SongTempo | ''>('');
  const [themeFilter, setThemeFilter] = useState<SongTheme | ''>('');
  const [momentFilter, setMomentFilter] = useState<LiturgicalMoment | ''>('');

  const debouncedQuery = useDebounce(searchQuery, 300);

  const filters = useMemo<SongListFilters>(() => {
    const f: SongListFilters = {};
    if (debouncedQuery) f.query = debouncedQuery;
    if (tempoFilter) f.tempo = tempoFilter;
    if (themeFilter) f.themes = [themeFilter];
    if (momentFilter) f.suggestedMoments = [momentFilter];
    return f;
  }, [debouncedQuery, tempoFilter, themeFilter, momentFilter]);

  const { data: songs, isLoading, isError } = useSongs(filters);

  const hasFilters = searchQuery || tempoFilter || themeFilter || momentFilter;

  const clearFilters = () => {
    setSearchQuery('');
    setTempoFilter('');
    setThemeFilter('');
    setMomentFilter('');
  };

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por título o artista..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select
          value={tempoFilter}
          onValueChange={(v) => setTempoFilter(v === '__all__' ? '' : v as SongTempo)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tempo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            {(Object.entries(TEMPO_LABELS) as [SongTempo, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={themeFilter}
          onValueChange={(v) => setThemeFilter(v === '__all__' ? '' : v as SongTheme)}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Tema" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            {(Object.entries(THEME_LABELS) as [SongTheme, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={momentFilter}
          onValueChange={(v) => setMomentFilter(v === '__all__' ? '' : v as LiturgicalMoment)}
        >
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Momento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            {(Object.entries(MOMENT_LABELS) as [LiturgicalMoment, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters} title="Limpiar filtros" aria-label="Limpiar filtros">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-red-500">
          Error al cargar las canciones. Intenta nuevamente.
        </div>
      ) : !songs || songs.length === 0 ? (
        <div className="text-center py-12" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
          {hasFilters
            ? 'No se encontraron canciones con los filtros aplicados.'
            : 'No hay canciones en la biblioteca. Agrega la primera.'}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="hidden md:table-cell">Artista</TableHead>
                <TableHead className="hidden md:table-cell">Tonalidad</TableHead>
                <TableHead className="hidden lg:table-cell">Tempo</TableHead>
                <TableHead className="hidden lg:table-cell">Duración</TableHead>
                <TableHead className="hidden xl:table-cell">Temas</TableHead>
                {(canWrite || canManage) && <TableHead className="w-20">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {songs.map((song) => (
                <TableRow
                  key={song.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => onSongClick(song.id)}
                >
                  <TableCell className="font-mono text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                    {song.number ?? '--'}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium" style={{ color: CASA_BRAND.colors.primary.black }}>
                      {song.title}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                    {song.artist ?? '--'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {song.original_key ? (
                      <Badge variant="outline">{song.original_key}</Badge>
                    ) : (
                      <span style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>--</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {song.tempo ? (
                      <Badge variant="secondary">
                        {TEMPO_LABELS[song.tempo] ?? song.tempo}
                      </Badge>
                    ) : (
                      <span style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>--</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell font-mono text-sm">
                    {formatDuration(song.duration_seconds)}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {song.themes?.slice(0, 3).map((theme) => (
                        <Badge
                          key={theme}
                          variant="outline"
                          style={{
                            borderColor: THEME_COLORS[theme as SongTheme] ?? '#888',
                            color: THEME_COLORS[theme as SongTheme] ?? '#888',
                          }}
                        >
                          {THEME_LABELS[theme as SongTheme] ?? theme}
                        </Badge>
                      ))}
                      {(song.themes?.length ?? 0) > 3 && (
                        <Badge variant="outline" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
                          +{(song.themes?.length ?? 0) - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  {(canWrite || canManage) && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditClick(song.id);
                            }}
                            title="Editar"
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteClick(song.id, song.title);
                            }}
                            title="Eliminar"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Result count */}
      {songs && songs.length > 0 && (
        <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
          {songs.length} {songs.length === 1 ? 'canción encontrada' : 'canciones encontradas'}
        </p>
      )}
    </div>
  );
};

export default SongListTable;
