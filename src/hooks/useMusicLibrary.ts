/**
 * Music Library Module — React Query Hooks
 *
 * Follows the same architectural pattern as src/lib/financial/hooks.ts.
 * The music-planning module adopts React Query for data fetching,
 * matching the precedent set by the financial module in Phase 4.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import * as songService from '@/lib/music-planning/songService';
import * as usageService from '@/lib/music-planning/songUsageService';
import type {
  MusicSongInsert,
  MusicSongUpdate,
  MusicArrangementInsert,
  MusicArrangementUpdate,
  MusicStemInsert,
  MusicChordChartInsert,
  MusicAudioReferenceInsert,
  SongListFilters,
} from '@/types/musicPlanning';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const MUSIC_LIBRARY_KEYS = {
  all: ['music-library'] as const,
  songs: (filters?: SongListFilters) =>
    ['music-library', 'songs', filters] as const,
  songById: (id: string) =>
    ['music-library', 'song', id] as const,
  arrangements: (songId: string) =>
    ['music-library', 'arrangements', songId] as const,
  arrangementDetails: (id: string) =>
    ['music-library', 'arrangement-details', id] as const,
  stems: (arrangementId: string) =>
    ['music-library', 'stems', arrangementId] as const,
  charts: (arrangementId: string) =>
    ['music-library', 'charts', arrangementId] as const,
  audioReferences: (songId: string) =>
    ['music-library', 'audio-references', songId] as const,
  songBySlug: (slug: string) =>
    ['music-library', 'songBySlug', slug] as const,
  songByNumber: (num: number) =>
    ['music-library', 'songByNumber', num] as const,
  usage: (songId: string) =>
    ['music-library', 'usage', songId] as const,
  usageStats: (songId: string) =>
    ['music-library', 'usage-stats', songId] as const,
};

// ─── Song Hooks ──────────────────────────────────────────────────────────────

export function useSongs(filters?: SongListFilters) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.songs(filters),
    queryFn: () => songService.getSongs(filters),
  });
}

export function useSongById(id: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.songById(id!),
    queryFn: () => songService.getSongById(id!),
    enabled: !!id,
  });
}

export function useSongBySlug(slug: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.songBySlug(slug!),
    queryFn: () => songService.getSongBySlug(slug!),
    enabled: !!slug,
  });
}

export function useSongByNumber(num: number | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.songByNumber(num!),
    queryFn: () => songService.getSongByNumber(num!),
    enabled: num !== null && num !== undefined,
  });
}

export function useCreateSong() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (song: MusicSongInsert) => songService.createSong(song),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Canción creada correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear la canción',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateSong() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, song }: { id: string; song: MusicSongUpdate }) =>
      songService.updateSong(id, song),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Canción actualizada correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar la canción',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteSong() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => songService.deleteSong(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Canción eliminada correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar la canción',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Arrangement Hooks ───────────────────────────────────────────────────────

export function useArrangements(songId: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.arrangements(songId!),
    queryFn: () => songService.getArrangementsBySongId(songId!),
    enabled: !!songId,
  });
}

export function useArrangementDetails(id: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.arrangementDetails(id!),
    queryFn: () => songService.getArrangementWithDetails(id!),
    enabled: !!id,
  });
}

export function useCreateArrangement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (arrangement: MusicArrangementInsert) =>
      songService.createArrangement(arrangement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Arreglo creado correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear el arreglo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateArrangement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MusicArrangementUpdate }) =>
      songService.updateArrangement(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Arreglo actualizado correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar el arreglo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteArrangement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => songService.deleteArrangement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Arreglo eliminado correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar el arreglo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Stem Hooks ──────────────────────────────────────────────────────────────

export function useStems(arrangementId: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.stems(arrangementId!),
    queryFn: () => songService.getStemsByArrangementId(arrangementId!),
    enabled: !!arrangementId,
  });
}

export function useCreateStem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (stem: MusicStemInsert) => songService.createStem(stem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Stem subido correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al subir el stem',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteStem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => songService.deleteStem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Stem eliminado correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar el stem',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Chord Chart Hooks ───────────────────────────────────────────────────────

export function useCharts(arrangementId: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.charts(arrangementId!),
    queryFn: () => songService.getChartsByArrangementId(arrangementId!),
    enabled: !!arrangementId,
  });
}

export function useCreateChordChart() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (chart: MusicChordChartInsert) =>
      songService.createChordChart(chart),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Partitura subida correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al subir la partitura',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteChordChart() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => songService.deleteChordChart(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Partitura eliminada correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar la partitura',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Audio Reference Hooks ───────────────────────────────────────────────────

export function useAudioReferences(songId: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.audioReferences(songId!),
    queryFn: () => songService.getAudioReferencesBySongId(songId!),
    enabled: !!songId,
  });
}

export function useCreateAudioReference() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (ref: MusicAudioReferenceInsert) =>
      songService.createAudioReference(ref),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Referencia de audio agregada' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al agregar referencia de audio',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteAudioReference() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => songService.deleteAudioReference(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Referencia de audio eliminada' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar referencia de audio',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Usage Hooks ─────────────────────────────────────────────────────────────

export function useSongUsage(songId: string | null, limit?: number) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.usage(songId!),
    queryFn: () => usageService.getUsageForSong(songId!, limit),
    enabled: !!songId,
  });
}

export function useSongUsageStats(songId: string | null, days?: number) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.usageStats(songId!),
    queryFn: () => usageService.getUsageStats(songId!, days),
    enabled: !!songId,
  });
}
