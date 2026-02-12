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
import * as musicianService from '@/lib/music-planning/musicianService';
import * as availabilityService from '@/lib/music-planning/availabilityService';
import * as rehearsalService from '@/lib/music-planning/rehearsalService';
import * as setlistService from '@/lib/music-planning/setlistService';
import type {
  MusicSongInsert,
  MusicSongUpdate,
  MusicArrangementInsert,
  MusicArrangementUpdate,
  MusicStemInsert,
  MusicChordChartInsert,
  MusicAudioReferenceInsert,
  MusicMusicianInsert,
  MusicMusicianUpdate,
  MusicMusicianInstrumentInsert,
  MusicServiceDateInsert,
  MusicServiceDateUpdate,
  MusicRecurringAvailabilityInsert,
  MusicRecurringAvailabilityUpdate,
  MusicAvailabilityOverrideInsert,
  MusicServiceAssignmentInsert,
  MusicServiceAssignmentUpdate,
  SongListFilters,
  MusicianListFilters,
  MusicRehearsalInsert,
  MusicRehearsalUpdate,
  MusicRehearsalSongInsert,
  MusicRehearsalSongUpdate,
  MusicRehearsalAttendeeInsert,
  MusicRehearsalAttendeeUpdate,
  MusicSetlistInsert,
  MusicSetlistUpdate,
  MusicSetlistItemInsert,
  MusicSetlistItemUpdate,
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
  musicians: (filters?: MusicianListFilters) =>
    ['music-library', 'musicians', filters] as const,
  musicianById: (id: string) =>
    ['music-library', 'musician', id] as const,
  serviceDates: (from?: string, to?: string) =>
    ['music-library', 'service-dates', from, to] as const,
  serviceDateById: (id: string) =>
    ['music-library', 'service-date', id] as const,
  upcomingServiceDates: (limit?: number) =>
    ['music-library', 'upcoming-service-dates', limit] as const,
  recurringAvailability: (musicianId: string) =>
    ['music-library', 'recurring-availability', musicianId] as const,
  overridesForDate: (serviceDateId: string) =>
    ['music-library', 'overrides-date', serviceDateId] as const,
  overridesForMusician: (musicianId: string) =>
    ['music-library', 'overrides-musician', musicianId] as const,
  assignmentsForDate: (serviceDateId: string) =>
    ['music-library', 'assignments', serviceDateId] as const,
  musiciansFullData: () =>
    ['music-library', 'musicians-full-data'] as const,
  allOverridesForDates: (serviceDateIds: string[]) =>
    ['music-library', 'all-overrides-for-dates', serviceDateIds] as const,
  rehearsals: (from?: string, to?: string) =>
    ['music-library', 'rehearsals', from, to] as const,
  rehearsalById: (id: string) =>
    ['music-library', 'rehearsal', id] as const,
  upcomingRehearsals: (limit?: number) =>
    ['music-library', 'upcoming-rehearsals', limit] as const,
  rehearsalSongs: (rehearsalId: string) =>
    ['music-library', 'rehearsal-songs', rehearsalId] as const,
  rehearsalAttendees: (rehearsalId: string) =>
    ['music-library', 'rehearsal-attendees', rehearsalId] as const,
  setlists: (from?: string, to?: string) =>
    ['music-library', 'setlists', from, to] as const,
  setlistById: (id: string) =>
    ['music-library', 'setlist', id] as const,
  setlistItems: (setlistId: string) =>
    ['music-library', 'setlist-items', setlistId] as const,
  setlistsByServiceDate: (serviceDateId: string) =>
    ['music-library', 'setlists-by-service-date', serviceDateId] as const,
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

// ─── Musician Hooks ─────────────────────────────────────────────────────────

export function useMusicians(filters?: MusicianListFilters) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.musicians(filters),
    queryFn: () => musicianService.getMusicians(filters),
  });
}

export function useMusicianById(id: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.musicianById(id!),
    queryFn: () => musicianService.getMusicianById(id!),
    enabled: !!id,
  });
}

export function useCreateMusician() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (musician: MusicMusicianInsert) => musicianService.createMusician(musician),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Músico creado correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear el músico',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateMusician() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MusicMusicianUpdate }) =>
      musicianService.updateMusician(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Músico actualizado correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar el músico',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteMusician() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => musicianService.deleteMusician(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Músico eliminado correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar el músico',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useMusiciansFullData() {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.musiciansFullData(),
    queryFn: () => musicianService.getMusiciansFullData(),
  });
}

export function useAddInstrument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (instrument: MusicMusicianInstrumentInsert) =>
      musicianService.addInstrument(instrument),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Instrumento agregado' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al agregar instrumento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRemoveInstrument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => musicianService.removeInstrument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Instrumento eliminado' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar instrumento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateInstrument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<MusicMusicianInstrumentInsert> }) =>
      musicianService.updateInstrument(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Instrumento actualizado' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar instrumento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Service Date Hooks ─────────────────────────────────────────────────────

export function useServiceDates(from?: string, to?: string) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.serviceDates(from, to),
    queryFn: () => availabilityService.getServiceDates(from, to),
  });
}

export function useServiceDateById(id: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.serviceDateById(id!),
    queryFn: () => availabilityService.getServiceDateById(id!),
    enabled: !!id,
  });
}

export function useUpcomingServiceDates(limit?: number) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.upcomingServiceDates(limit),
    queryFn: () => availabilityService.getUpcomingServiceDates(limit),
  });
}

export function useCreateServiceDate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (serviceDate: MusicServiceDateInsert) =>
      availabilityService.createServiceDate(serviceDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Fecha de servicio creada' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear fecha de servicio',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateServiceDate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MusicServiceDateUpdate }) =>
      availabilityService.updateServiceDate(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Fecha de servicio actualizada' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar fecha de servicio',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteServiceDate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => availabilityService.deleteServiceDate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Fecha de servicio eliminada' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar fecha de servicio',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Recurring Availability Hooks ───────────────────────────────────────────

export function useRecurringAvailability(musicianId: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.recurringAvailability(musicianId!),
    queryFn: () => availabilityService.getRecurringAvailability(musicianId!),
    enabled: !!musicianId,
  });
}

export function useCreateRecurringAvailability() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (availability: MusicRecurringAvailabilityInsert) =>
      availabilityService.createRecurringAvailability(availability),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Disponibilidad configurada' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al configurar disponibilidad',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateRecurringAvailability() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MusicRecurringAvailabilityUpdate }) =>
      availabilityService.updateRecurringAvailability(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Disponibilidad actualizada' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar disponibilidad',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteRecurringAvailability() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => availabilityService.deleteRecurringAvailability(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Disponibilidad eliminada' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar disponibilidad',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Override Hooks ─────────────────────────────────────────────────────────

export function useOverridesForDate(serviceDateId: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.overridesForDate(serviceDateId!),
    queryFn: () => availabilityService.getOverridesForServiceDate(serviceDateId!),
    enabled: !!serviceDateId,
  });
}

export function useOverridesForMusician(musicianId: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.overridesForMusician(musicianId!),
    queryFn: () => availabilityService.getOverridesForMusician(musicianId!),
    enabled: !!musicianId,
  });
}

export function useUpsertOverride() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (override: MusicAvailabilityOverrideInsert) =>
      availabilityService.upsertOverride(override),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Disponibilidad actualizada' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar disponibilidad',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteOverride() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => availabilityService.deleteOverride(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Excepción eliminada' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar excepción',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useAllOverridesForDates(serviceDateIds: string[]) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.allOverridesForDates(serviceDateIds),
    queryFn: () => availabilityService.getOverridesForServiceDates(serviceDateIds),
    enabled: serviceDateIds.length > 0,
  });
}

// ─── Assignment Hooks ───────────────────────────────────────────────────────

export function useAssignmentsForDate(serviceDateId: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.assignmentsForDate(serviceDateId!),
    queryFn: () => availabilityService.getAssignmentsForServiceDate(serviceDateId!),
    enabled: !!serviceDateId,
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (assignment: MusicServiceAssignmentInsert) =>
      availabilityService.createAssignment(assignment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Asignación creada' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear asignación',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MusicServiceAssignmentUpdate }) =>
      availabilityService.updateAssignment(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Asignación actualizada' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar asignación',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => availabilityService.deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Asignación eliminada' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar asignación',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Rehearsal Hooks ─────────────────────────────────────────────────────────

export function useRehearsals(from?: string, to?: string) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.rehearsals(from, to),
    queryFn: () => rehearsalService.getRehearsals(from, to),
  });
}

export function useRehearsalById(id: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.rehearsalById(id!),
    queryFn: () => rehearsalService.getRehearsalById(id!),
    enabled: !!id,
  });
}

export function useUpcomingRehearsals(limit?: number) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.upcomingRehearsals(limit),
    queryFn: () => rehearsalService.getUpcomingRehearsals(limit),
  });
}

export function useCreateRehearsal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (rehearsal: MusicRehearsalInsert) => rehearsalService.createRehearsal(rehearsal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Ensayo creado correctamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al crear el ensayo', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateRehearsal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MusicRehearsalUpdate }) =>
      rehearsalService.updateRehearsal(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Ensayo actualizado correctamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al actualizar el ensayo', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteRehearsal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => rehearsalService.deleteRehearsal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Ensayo eliminado correctamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al eliminar el ensayo', description: error.message, variant: 'destructive' });
    },
  });
}

// Rehearsal Songs

export function useRehearsalSongs(rehearsalId: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.rehearsalSongs(rehearsalId!),
    queryFn: () => rehearsalService.getRehearsalSongs(rehearsalId!),
    enabled: !!rehearsalId,
  });
}

export function useAddRehearsalSong() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (song: MusicRehearsalSongInsert) => rehearsalService.addRehearsalSong(song),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Canción agregada al ensayo' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al agregar canción', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateRehearsalSong() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MusicRehearsalSongUpdate }) =>
      rehearsalService.updateRehearsalSong(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al actualizar canción', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRemoveRehearsalSong() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => rehearsalService.removeRehearsalSong(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Canción eliminada del ensayo' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al eliminar canción', description: error.message, variant: 'destructive' });
    },
  });
}

export function useReorderRehearsalSongs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      rehearsalService.reorderRehearsalSongs(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al reordenar canciones', description: error.message, variant: 'destructive' });
    },
  });
}

// Rehearsal Attendees

export function useRehearsalAttendees(rehearsalId: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.rehearsalAttendees(rehearsalId!),
    queryFn: () => rehearsalService.getRehearsalAttendees(rehearsalId!),
    enabled: !!rehearsalId,
  });
}

export function useAddRehearsalAttendee() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (attendee: MusicRehearsalAttendeeInsert) => rehearsalService.addRehearsalAttendee(attendee),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Músico invitado al ensayo' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al invitar músico', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateRehearsalAttendee() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MusicRehearsalAttendeeUpdate }) =>
      rehearsalService.updateRehearsalAttendee(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Asistencia actualizada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al actualizar asistencia', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRemoveRehearsalAttendee() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => rehearsalService.removeRehearsalAttendee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Músico eliminado del ensayo' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al eliminar músico', description: error.message, variant: 'destructive' });
    },
  });
}

export function useBatchAddAttendees() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ rehearsalId, musicianIds }: { rehearsalId: string; musicianIds: string[] }) =>
      rehearsalService.batchAddAttendees(rehearsalId, musicianIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Músicos invitados al ensayo' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al invitar músicos', description: error.message, variant: 'destructive' });
    },
  });
}

// ─── Setlist Hooks ──────────────────────────────────────────────────────────

export function useSetlists(from?: string, to?: string) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.setlists(from, to),
    queryFn: () => setlistService.getSetlists(from, to),
  });
}

export function useSetlistById(id: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.setlistById(id!),
    queryFn: () => setlistService.getSetlistById(id!),
    enabled: !!id,
  });
}

export function useSetlistItems(setlistId: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.setlistItems(setlistId!),
    queryFn: () => setlistService.getSetlistItems(setlistId!),
    enabled: !!setlistId,
  });
}

export function useSetlistsByServiceDate(serviceDateId: string | null) {
  return useQuery({
    queryKey: MUSIC_LIBRARY_KEYS.setlistsByServiceDate(serviceDateId!),
    queryFn: () => setlistService.getSetlistsForServiceDate(serviceDateId!),
    enabled: !!serviceDateId,
  });
}

export function useCreateSetlist() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (setlist: MusicSetlistInsert) => setlistService.createSetlist(setlist),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Setlist creada correctamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al crear la setlist', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateSetlist() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MusicSetlistUpdate }) =>
      setlistService.updateSetlist(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Setlist actualizada correctamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al actualizar la setlist', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteSetlist() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => setlistService.deleteSetlist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Setlist eliminada correctamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al eliminar la setlist', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDuplicateSetlist() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ sourceSetlistId, targetServiceDateId }: { sourceSetlistId: string; targetServiceDateId: string }) =>
      setlistService.duplicateSetlist(sourceSetlistId, targetServiceDateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Setlist duplicada correctamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al duplicar la setlist', description: error.message, variant: 'destructive' });
    },
  });
}

export function useAddSetlistItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (item: MusicSetlistItemInsert) => setlistService.addSetlistItem(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Canción agregada a la setlist' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al agregar canción', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateSetlistItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MusicSetlistItemUpdate }) =>
      setlistService.updateSetlistItem(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al actualizar canción', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRemoveSetlistItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => setlistService.removeSetlistItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
      toast({ title: 'Canción eliminada de la setlist' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al eliminar canción', description: error.message, variant: 'destructive' });
    },
  });
}

export function useReorderSetlistItems() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      setlistService.reorderSetlistItems(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MUSIC_LIBRARY_KEYS.all });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al reordenar canciones', description: error.message, variant: 'destructive' });
    },
  });
}
