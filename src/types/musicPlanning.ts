/**
 * Music Planning Module — TypeScript Type Definitions
 *
 * Handwritten types mirroring the 19 music planning database tables.
 * These types are independent of the auto-generated Supabase types in
 * @/integrations/supabase/types.ts, which should NOT be modified.
 *
 * Convention:
 *   Row   — full row as returned by SELECT (all columns present)
 *   Insert — for INSERT: server-generated fields (id, created_at, updated_at) optional
 *   Update — for UPDATE: all fields optional (Partial<Insert>)
 */

import type { Verse } from '@/types/shared/song';

// Re-export shared song types used alongside music planning types
export type { SongTempo, SongTheme, LiturgicalMoment, VerseType, Verse } from '@/types/shared/song';

// =====================================================
// CHECK-constraint union types
// =====================================================

/** music_songs.tempo CHECK */
export type MusicTempo = 'lenta' | 'intermedia' | 'rápida';

/** music_stems.stem_type CHECK */
export type StemType = 'click' | 'cues' | 'pads' | 'bass' | 'drums' | 'guitars' | 'vocals' | 'keys' | 'other';

/** music_chord_charts.file_type CHECK */
export type ChartFileType = 'pdf' | 'png' | 'jpg';

/** music_audio_references.source_type CHECK */
export type AudioSourceType = 'youtube' | 'spotify' | 'upload' | 'other';

/** music_musician_instruments.instrument CHECK */
export type InstrumentType =
  | 'vocals'
  | 'acoustic_guitar'
  | 'electric_guitar'
  | 'bass'
  | 'drums'
  | 'keys'
  | 'percussion'
  | 'sound_tech'
  | 'other';

/** music_musician_instruments.proficiency CHECK */
export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced';

/** music_recurring_availability.pattern_type CHECK */
export type AvailabilityPatternType =
  | 'every_week'
  | 'first_and_third'
  | 'second_and_fourth'
  | 'first_only'
  | 'second_only'
  | 'third_only'
  | 'fourth_only'
  | 'last_only'
  | 'custom';

/** music_service_dates.service_type CHECK */
export type ServiceType = 'domingo_principal' | 'especial' | 'ensayo';

/** music_service_dates.status CHECK */
export type ServiceDateStatus = 'planning' | 'confirmed' | 'completed';

/** music_availability_overrides.status CHECK */
export type AvailabilityOverrideStatus = 'available' | 'unavailable' | 'maybe';

/** music_rehearsals.status CHECK */
export type RehearsalStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'completed';

/** music_rehearsal_attendees.rsvp_status CHECK */
export type RsvpStatus = 'pending' | 'accepted' | 'declined';

/** music_setlists.status CHECK */
export type SetlistStatus = 'draft' | 'finalized' | 'presented';

/** music_notification_logs.notification_type CHECK */
export type NotificationType =
  | 'assignment'
  | 'reminder_1week'
  | 'reminder_1day'
  | 'availability_request'
  | 'rehearsal_invite'
  | 'rehearsal_reminder'
  | 'schedule_published'
  | 'cancellation';

/** music_notification_logs.channel CHECK */
export type NotificationChannel = 'email' | 'whatsapp';

/** music_notification_logs.status CHECK */
export type NotificationDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed';

// =====================================================
// 1. SONG LIBRARY (6 tables)
// =====================================================

// --- 1.1 music_songs ---

export interface MusicSongRow {
  id: string;
  title: string;
  artist: string | null;
  slug: string;
  number: number | null;
  original_key: string | null;
  tempo: MusicTempo | null;
  ccli_number: string | null;
  duration_seconds: number | null;
  themes: string[] | null;
  suggested_moments: string[] | null;
  lyrics: Verse[] | null;
  spotify_url: string | null;
  youtube_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MusicSongInsert {
  id?: string;
  title: string;
  artist?: string | null;
  slug: string;
  number?: number | null;
  original_key?: string | null;
  tempo?: MusicTempo | null;
  ccli_number?: string | null;
  duration_seconds?: number | null;
  themes?: string[] | null;
  suggested_moments?: string[] | null;
  lyrics?: Verse[] | null;
  spotify_url?: string | null;
  youtube_url?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type MusicSongUpdate = Partial<MusicSongInsert>;

// --- 1.2 music_arrangements ---

export interface MusicArrangementRow {
  id: string;
  song_id: string;
  name: string;
  arrangement_key: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MusicArrangementInsert {
  id?: string;
  song_id: string;
  name: string;
  arrangement_key?: string | null;
  description?: string | null;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export type MusicArrangementUpdate = Partial<MusicArrangementInsert>;

// --- 1.3 music_stems ---

export interface MusicStemRow {
  id: string;
  arrangement_id: string;
  stem_type: StemType;
  storage_path: string;
  file_name: string | null;
  duration_seconds: number | null;
  waveform_peaks: number[] | null;
  created_at: string;
}

export interface MusicStemInsert {
  id?: string;
  arrangement_id: string;
  stem_type: StemType;
  storage_path: string;
  file_name?: string | null;
  duration_seconds?: number | null;
  waveform_peaks?: number[] | null;
  created_at?: string;
}

export type MusicStemUpdate = Partial<MusicStemInsert>;

// --- 1.4 music_chord_charts ---

export interface MusicChordChartRow {
  id: string;
  arrangement_id: string;
  storage_path: string;
  file_type: ChartFileType | null;
  transposition_key: string | null;
  created_at: string;
}

export interface MusicChordChartInsert {
  id?: string;
  arrangement_id: string;
  storage_path: string;
  file_type?: ChartFileType | null;
  transposition_key?: string | null;
  created_at?: string;
}

export type MusicChordChartUpdate = Partial<MusicChordChartInsert>;

// --- 1.5 music_audio_references ---

export interface MusicAudioReferenceRow {
  id: string;
  song_id: string;
  url: string;
  source_type: AudioSourceType | null;
  description: string | null;
  created_at: string;
}

export interface MusicAudioReferenceInsert {
  id?: string;
  song_id: string;
  url: string;
  source_type?: AudioSourceType | null;
  description?: string | null;
  created_at?: string;
}

export type MusicAudioReferenceUpdate = Partial<MusicAudioReferenceInsert>;

// --- 1.6 music_song_usage_log ---

export interface MusicSongUsageLogRow {
  id: string;
  song_id: string;
  arrangement_id: string | null;
  service_date: string;
  liturgical_moment: string | null;
  used_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface MusicSongUsageLogInsert {
  id?: string;
  song_id: string;
  arrangement_id?: string | null;
  service_date: string;
  liturgical_moment?: string | null;
  used_by?: string | null;
  notes?: string | null;
  created_at?: string;
}

export type MusicSongUsageLogUpdate = Partial<MusicSongUsageLogInsert>;

// =====================================================
// 2. MUSICIAN AVAILABILITY (6 tables)
// =====================================================

// --- 2.1 music_musicians ---

export interface MusicMusicianRow {
  id: string;
  user_id: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  whatsapp_enabled: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MusicMusicianInsert {
  id?: string;
  user_id?: string | null;
  display_name: string;
  email?: string | null;
  phone?: string | null;
  whatsapp_enabled?: boolean;
  is_active?: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type MusicMusicianUpdate = Partial<MusicMusicianInsert>;

// --- 2.2 music_musician_instruments ---

export interface MusicMusicianInstrumentRow {
  id: string;
  musician_id: string;
  instrument: InstrumentType;
  proficiency: ProficiencyLevel | null;
  is_primary: boolean;
}

export interface MusicMusicianInstrumentInsert {
  id?: string;
  musician_id: string;
  instrument: InstrumentType;
  proficiency?: ProficiencyLevel | null;
  is_primary?: boolean;
}

export type MusicMusicianInstrumentUpdate = Partial<MusicMusicianInstrumentInsert>;

// --- 2.3 music_recurring_availability ---

export interface MusicRecurringAvailabilityRow {
  id: string;
  musician_id: string;
  pattern_type: AvailabilityPatternType;
  custom_weeks: number[] | null;
  effective_from: string;
  effective_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MusicRecurringAvailabilityInsert {
  id?: string;
  musician_id: string;
  pattern_type: AvailabilityPatternType;
  custom_weeks?: number[] | null;
  effective_from: string;
  effective_until?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type MusicRecurringAvailabilityUpdate = Partial<MusicRecurringAvailabilityInsert>;

// --- 2.4 music_service_dates ---

export interface MusicServiceDateRow {
  id: string;
  date: string;
  service_type: ServiceType;
  title: string | null;
  notes: string | null;
  status: ServiceDateStatus;
  created_at: string;
  updated_at: string;
}

export interface MusicServiceDateInsert {
  id?: string;
  date: string;
  service_type?: ServiceType;
  title?: string | null;
  notes?: string | null;
  status?: ServiceDateStatus;
  created_at?: string;
  updated_at?: string;
}

export type MusicServiceDateUpdate = Partial<MusicServiceDateInsert>;

// --- 2.5 music_availability_overrides ---

export interface MusicAvailabilityOverrideRow {
  id: string;
  musician_id: string;
  service_date_id: string;
  status: AvailabilityOverrideStatus;
  preferred_instruments: string[] | null;
  notes: string | null;
  submitted_at: string | null;
}

export interface MusicAvailabilityOverrideInsert {
  id?: string;
  musician_id: string;
  service_date_id: string;
  status: AvailabilityOverrideStatus;
  preferred_instruments?: string[] | null;
  notes?: string | null;
  submitted_at?: string | null;
}

export type MusicAvailabilityOverrideUpdate = Partial<MusicAvailabilityOverrideInsert>;

// --- 2.6 music_service_assignments ---

export interface MusicServiceAssignmentRow {
  id: string;
  service_date_id: string;
  musician_id: string;
  assigned_instrument: string;
  assigned_role: string | null;
  confirmed: boolean;
  confirmed_at: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  notes: string | null;
}

export interface MusicServiceAssignmentInsert {
  id?: string;
  service_date_id: string;
  musician_id: string;
  assigned_instrument: string;
  assigned_role?: string | null;
  confirmed?: boolean;
  confirmed_at?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  notes?: string | null;
}

export type MusicServiceAssignmentUpdate = Partial<MusicServiceAssignmentInsert>;

// =====================================================
// 3. REHEARSAL (3 tables)
// =====================================================

// --- 3.1 music_rehearsals ---

export interface MusicRehearsalRow {
  id: string;
  service_date_id: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  status: RehearsalStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MusicRehearsalInsert {
  id?: string;
  service_date_id?: string | null;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  notes?: string | null;
  status?: RehearsalStatus;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type MusicRehearsalUpdate = Partial<MusicRehearsalInsert>;

// --- 3.2 music_rehearsal_songs ---

export interface MusicRehearsalSongRow {
  id: string;
  rehearsal_id: string;
  song_id: string;
  arrangement_id: string | null;
  sort_order: number;
  notes: string | null;
}

export interface MusicRehearsalSongInsert {
  id?: string;
  rehearsal_id: string;
  song_id: string;
  arrangement_id?: string | null;
  sort_order?: number;
  notes?: string | null;
}

export type MusicRehearsalSongUpdate = Partial<MusicRehearsalSongInsert>;

// --- 3.3 music_rehearsal_attendees ---

export interface MusicRehearsalAttendeeRow {
  id: string;
  rehearsal_id: string;
  musician_id: string;
  rsvp_status: RsvpStatus;
  attended: boolean | null;
  notified_at: string | null;
}

export interface MusicRehearsalAttendeeInsert {
  id?: string;
  rehearsal_id: string;
  musician_id: string;
  rsvp_status?: RsvpStatus;
  attended?: boolean | null;
  notified_at?: string | null;
}

export type MusicRehearsalAttendeeUpdate = Partial<MusicRehearsalAttendeeInsert>;

// =====================================================
// 4. SETLIST (2 tables)
// =====================================================

// --- 4.1 music_setlists ---

export interface MusicSetlistRow {
  id: string;
  service_date_id: string;
  title: string | null;
  status: SetlistStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MusicSetlistInsert {
  id?: string;
  service_date_id: string;
  title?: string | null;
  status?: SetlistStatus;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type MusicSetlistUpdate = Partial<MusicSetlistInsert>;

// --- 4.2 music_setlist_items ---

export interface MusicSetlistItemRow {
  id: string;
  setlist_id: string;
  song_id: string;
  arrangement_id: string | null;
  liturgical_moment: string | null;
  song_key: string | null;
  sort_order: number;
  notes: string | null;
  transition_notes: string | null;
}

export interface MusicSetlistItemInsert {
  id?: string;
  setlist_id: string;
  song_id: string;
  arrangement_id?: string | null;
  liturgical_moment?: string | null;
  song_key?: string | null;
  sort_order?: number;
  notes?: string | null;
  transition_notes?: string | null;
}

export type MusicSetlistItemUpdate = Partial<MusicSetlistItemInsert>;

// =====================================================
// 5. NOTIFICATIONS (1 table)
// =====================================================

// --- 5.1 music_notification_logs ---

export interface MusicNotificationLogRow {
  id: string;
  recipient_id: string | null;
  notification_type: NotificationType;
  channel: NotificationChannel | null;
  subject: string | null;
  message_content: string | null;
  external_id: string | null;
  status: NotificationDeliveryStatus;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface MusicNotificationLogInsert {
  id?: string;
  recipient_id?: string | null;
  notification_type: NotificationType;
  channel?: NotificationChannel | null;
  subject?: string | null;
  message_content?: string | null;
  external_id?: string | null;
  status?: NotificationDeliveryStatus;
  sent_at?: string | null;
  delivered_at?: string | null;
  created_at?: string;
}

export type MusicNotificationLogUpdate = Partial<MusicNotificationLogInsert>;

// =====================================================
// 6. PRACTICE SESSIONS (1 table)
// =====================================================

// --- 6.1 music_practice_sessions ---

export interface MusicPracticeSessionRow {
  id: string;
  user_id: string;
  song_id: string;
  arrangement_id: string | null;
  stem_volumes: Record<string, number> | null;
  loop_start: number | null;
  loop_end: number | null;
  tempo_factor: number;
  duration_seconds: number | null;
  started_at: string;
  ended_at: string | null;
}

export interface MusicPracticeSessionInsert {
  id?: string;
  user_id: string;
  song_id: string;
  arrangement_id?: string | null;
  stem_volumes?: Record<string, number> | null;
  loop_start?: number | null;
  loop_end?: number | null;
  tempo_factor?: number;
  duration_seconds?: number | null;
  started_at: string;
  ended_at?: string | null;
}

export type MusicPracticeSessionUpdate = Partial<MusicPracticeSessionInsert>;

// =====================================================
// COMPOSITE / JOIN TYPES
// =====================================================

/** Song with its arrangements */
export interface SongWithArrangements extends MusicSongRow {
  music_arrangements: MusicArrangementRow[];
}

/** Arrangement with its stems */
export interface ArrangementWithStems extends MusicArrangementRow {
  music_stems: MusicStemRow[];
}

/** Full song with arrangements, stems, chord charts, and audio references */
export interface SongFull extends MusicSongRow {
  music_arrangements: (MusicArrangementRow & {
    music_stems: MusicStemRow[];
    music_chord_charts: MusicChordChartRow[];
  })[];
  music_audio_references: MusicAudioReferenceRow[];
}

/** Musician with instruments and recurring availability */
export interface MusicianFull extends MusicMusicianRow {
  music_musician_instruments: MusicMusicianInstrumentRow[];
  music_recurring_availability: MusicRecurringAvailabilityRow[];
}

/** Service date with assignments and overrides */
export interface ServiceDateFull extends MusicServiceDateRow {
  music_service_assignments: (MusicServiceAssignmentRow & {
    music_musicians: MusicMusicianRow;
  })[];
  music_availability_overrides: (MusicAvailabilityOverrideRow & {
    music_musicians: MusicMusicianRow;
  })[];
}

/** Setlist with items joined to songs */
export interface SetlistWithItems extends MusicSetlistRow {
  music_setlist_items: (MusicSetlistItemRow & {
    music_songs: MusicSongRow;
  })[];
}

/** Rehearsal with songs and attendees */
export interface RehearsalFull extends MusicRehearsalRow {
  music_rehearsal_songs: (MusicRehearsalSongRow & {
    music_songs: MusicSongRow;
  })[];
  music_rehearsal_attendees: (MusicRehearsalAttendeeRow & {
    music_musicians: MusicMusicianRow;
  })[];
}

// =====================================================
// FILTER INTERFACE (used by songService)
// =====================================================

export interface SongListFilters {
  query?: string;
  tempo?: MusicTempo;
  themes?: string[];
  suggestedMoments?: string[];
  limit?: number;
  offset?: number;
  orderBy?: 'title' | 'number' | 'created_at';
  ascending?: boolean;
}

export interface MusicianListFilters {
  query?: string;
  instrument?: InstrumentType;
  isActive?: boolean;
}

// =====================================================
// 7. PUBLICATION STATE (2 tables)
// =====================================================

/** Delivery status for packet emails */
export type PacketDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed';

/** Publish mode: add songs to existing setlist or replace all */
export type PublishMode = 'add' | 'replace';

// --- 7.1 music_publication_state ---

export interface MusicPublicationStateRow {
  id: string;
  liturgy_id: string;
  service_date_id: string;
  setlist_id: string;
  publish_version: number;
  published_by: string | null;
  published_at: string;
  last_packet_path: string | null;
  warning_snapshot: WarningSnapshot | null;
  created_at: string;
  updated_at: string;
}

export interface MusicPublicationStateInsert {
  id?: string;
  liturgy_id: string;
  service_date_id: string;
  setlist_id: string;
  publish_version?: number;
  published_by?: string | null;
  published_at?: string;
  last_packet_path?: string | null;
  warning_snapshot?: WarningSnapshot | null;
  created_at?: string;
  updated_at?: string;
}

export type MusicPublicationStateUpdate = Partial<MusicPublicationStateInsert>;

// --- 7.2 music_packet_deliveries ---

export interface MusicPacketDeliveryRow {
  id: string;
  publication_id: string;
  musician_id: string | null;
  email: string;
  status: PacketDeliveryStatus;
  external_id: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface MusicPacketDeliveryInsert {
  id?: string;
  publication_id: string;
  musician_id?: string | null;
  email: string;
  status?: PacketDeliveryStatus;
  external_id?: string | null;
  sent_at?: string | null;
  error_message?: string | null;
  created_at?: string;
}

export type MusicPacketDeliveryUpdate = Partial<MusicPacketDeliveryInsert>;

// =====================================================
// PUBLISH ORCHESTRATION TYPES
// =====================================================

/** Warning snapshot stored in publication state */
export interface WarningSnapshot {
  missingSongs: string[];
  missingAssets: Record<string, string[]>;
}

/** Asset warnings for a single song */
export interface AssetWarnings {
  missingChordCharts: boolean;
  missingAudioReferences: boolean;
  missingStems: boolean;
}

/** Preflight warnings aggregated before publishing */
export interface PreflightWarnings {
  missingSongs: string[];
  missingAssets: Record<string, string[]>;
  songCount: number;
}

/** Result returned from publishLiturgyMusic orchestration */
export interface PublishResult {
  success: boolean;
  setlistId?: string;
  serviceDateId?: string;
  publicationId?: string;
  publishVersion?: number;
  warnings: PreflightWarnings;
  songsPublished: number;
}

/** Publication state with delivery summary (for UI) */
export interface PublicationWithDeliverySummary extends MusicPublicationStateRow {
  deliverySummary: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
  };
}
