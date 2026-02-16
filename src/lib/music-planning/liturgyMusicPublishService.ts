/**
 * Liturgy Music Publish Service — Orchestration for Liturgia -> Programacion Musical.
 *
 * Extracts songs from a liturgy, resolves them to music_songs, creates/updates
 * service dates and setlists, and records publication state with versioning.
 */

import { supabase } from '@/integrations/supabase/client';
import type { LiturgyElement, LiturgyElementType } from '@/types/shared/liturgy';
import type {
  ServiceType,
  PublishMode,
  PublishResult,
  PreflightWarnings,
  WarningSnapshot,
  AssetWarnings,
  MusicSongRow,
  MusicSetlistRow,
  MusicServiceDateRow,
} from '@/types/musicPlanning';
import { getSongById, getSongBySlug, getSongBySlugWithArrangements } from '@/lib/music-planning/songService';
import { createServiceDate, getServiceDates } from '@/lib/music-planning/availabilityService';
import {
  createSetlist,
  addSetlistItem,
  getSetlistsForServiceDate,
} from '@/lib/music-planning/setlistService';
import {
  getPublicationByLiturgyAndServiceDate,
  createPublication,
  incrementPublishVersion,
} from '@/lib/music-planning/publicationStateService';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Song element types in liturgy order */
const CANCION_TYPES: LiturgyElementType[] = [
  'cancion-invocacion',
  'cancion-arrepentimiento',
  'cancion-gratitud',
  'cancion-santa-cena',
];

/** Map liturgy element type to liturgical moment label */
const LITURGICAL_MOMENT_MAP: Record<string, string> = {
  'cancion-invocacion': 'Invocacion',
  'cancion-arrepentimiento': 'Arrepentimiento',
  'cancion-gratitud': 'Gratitud',
  'cancion-santa-cena': 'Santa Cena',
};

// ─── UUID detection ─────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// ─── Song resolution ────────────────────────────────────────────────────────

interface ResolvedSong {
  song: MusicSongRow;
  element: LiturgyElement;
  arrangementId: string | null;
}

/**
 * Resolve a song sourceId to a music_songs record.
 * Tries UUID lookup first, then slug fallback.
 */
async function resolveSong(
  sourceId: string,
  element: LiturgyElement
): Promise<{ resolved: ResolvedSong | null; warning: string | null }> {
  try {
    if (isUUID(sourceId)) {
      const song = await getSongById(sourceId);
      if (song) {
        // Use first arrangement (sorted by sort_order) if available
        const arrangementId =
          song.music_arrangements && song.music_arrangements.length > 0
            ? song.music_arrangements[0].id
            : null;
        return { resolved: { song, element, arrangementId }, warning: null };
      }
    }

    // Fallback to slug lookup (with arrangements for arrangement_id resolution)
    const songBySlug = await getSongBySlugWithArrangements(sourceId);
    if (songBySlug) {
      const arrangementId =
        songBySlug.music_arrangements && songBySlug.music_arrangements.length > 0
          ? songBySlug.music_arrangements.sort((a, b) => a.sort_order - b.sort_order)[0].id
          : null;
      return { resolved: { song: songBySlug, element, arrangementId }, warning: null };
    }

    return {
      resolved: null,
      warning: `Cancion "${element.title}" no encontrada en biblioteca (ID: ${sourceId})`,
    };
  } catch {
    return {
      resolved: null,
      warning: `Error al buscar cancion "${element.title}" (ID: ${sourceId})`,
    };
  }
}

// ─── Asset checking ─────────────────────────────────────────────────────────

/**
 * Check asset availability for a single song.
 * Accepts UUID or slug — normalizes to UUID before querying.
 * Queries arrangements, chord charts, audio references, and stems.
 */
export async function checkSongAssets(songId: string): Promise<AssetWarnings> {
  const warnings: AssetWarnings = {
    missingChordCharts: true,
    missingAudioReferences: true,
    missingStems: true,
  };

  try {
    // Normalize: if songId is not a UUID, resolve via slug lookup
    let resolvedId = songId;
    if (!isUUID(songId)) {
      const slugSong = await getSongBySlug(songId);
      if (!slugSong) return warnings;
      resolvedId = slugSong.id;
    }

    // Check arrangements and their chord charts / stems
    const { data: arrangements } = await supabase
      .from('music_arrangements')
      .select('id')
      .eq('song_id', resolvedId);

    if (arrangements && arrangements.length > 0) {
      const arrangementIds = arrangements.map((a) => a.id);

      // Check chord charts
      const { data: charts } = await supabase
        .from('music_chord_charts')
        .select('id')
        .in('arrangement_id', arrangementIds)
        .limit(1);

      if (charts && charts.length > 0) {
        warnings.missingChordCharts = false;
      }

      // Check stems
      const { data: stems } = await supabase
        .from('music_stems')
        .select('id')
        .in('arrangement_id', arrangementIds)
        .limit(1);

      if (stems && stems.length > 0) {
        warnings.missingStems = false;
      }
    }

    // Check audio references
    const { data: audioRefs } = await supabase
      .from('music_audio_references')
      .select('id')
      .eq('song_id', resolvedId)
      .limit(1);

    if (audioRefs && audioRefs.length > 0) {
      warnings.missingAudioReferences = false;
    }
  } catch {
    // Return all warnings as true if query fails
  }

  return warnings;
}

/**
 * Build preflight warnings for all songs in a liturgy.
 */
export async function buildPreflightWarnings(
  elements: Map<LiturgyElementType, LiturgyElement>,
  elementOrder: LiturgyElementType[]
): Promise<PreflightWarnings> {
  const warnings: PreflightWarnings = {
    missingSongs: [],
    missingAssets: {},
    songCount: 0,
  };

  for (const type of elementOrder) {
    if (!CANCION_TYPES.includes(type)) continue;

    const element = elements.get(type);
    if (!element?.sourceId) continue;

    warnings.songCount++;

    const { resolved, warning } = await resolveSong(element.sourceId, element);
    if (warning) {
      warnings.missingSongs.push(warning);
      continue;
    }

    if (resolved) {
      const assets = await checkSongAssets(resolved.song.id);
      const missing: string[] = [];
      if (assets.missingChordCharts) missing.push('partitura');
      if (assets.missingAudioReferences) missing.push('referencia_audio');
      if (assets.missingStems) missing.push('stems');

      if (missing.length > 0) {
        warnings.missingAssets[resolved.song.title] = missing;
      }
    }
  }

  return warnings;
}

// ─── Existing setlist check ─────────────────────────────────────────────────

/**
 * Check if a setlist already exists for a given service date + type.
 * Returns the existing setlist if found (to allow add/replace choice).
 */
export async function checkExistingSetlist(
  serviceDate: string,
  serviceType: ServiceType
): Promise<MusicSetlistRow | null> {
  // Find service date
  const serviceDates = await getServiceDates(serviceDate, serviceDate);
  const matchingDate = serviceDates.find(
    (sd) => sd.date === serviceDate && sd.service_type === serviceType
  );

  if (!matchingDate) return null;

  const setlists = await getSetlistsForServiceDate(matchingDate.id);
  return setlists.length > 0 ? setlists[0] : null;
}

// ─── Main orchestration ─────────────────────────────────────────────────────

export interface PublishLiturgyMusicParams {
  liturgyId: string;
  elements: Map<LiturgyElementType, LiturgyElement>;
  elementOrder: LiturgyElementType[];
  serviceDate: string; // ISO date (yyyy-MM-dd)
  serviceType: ServiceType;
  mode: PublishMode;
  liturgyTitle?: string;
}

/**
 * Main orchestration function: extract songs from liturgy, resolve to music_songs,
 * create/update service date + setlist + items, and record publication state.
 */
export async function publishLiturgyMusic(
  params: PublishLiturgyMusicParams
): Promise<PublishResult> {
  const {
    liturgyId,
    elements,
    elementOrder,
    serviceDate,
    serviceType,
    mode,
    liturgyTitle,
  } = params;

  const warnings: PreflightWarnings = {
    missingSongs: [],
    missingAssets: {},
    songCount: 0,
  };

  // 1. Extract song elements from liturgy in element order
  const songElements: LiturgyElement[] = [];
  for (const type of elementOrder) {
    if (!CANCION_TYPES.includes(type)) continue;
    const element = elements.get(type);
    if (element?.sourceId) {
      songElements.push(element);
      warnings.songCount++;
    }
  }

  if (songElements.length === 0) {
    return {
      success: false,
      warnings,
      songsPublished: 0,
    };
  }

  // 2. Resolve all songs
  const resolvedSongs: ResolvedSong[] = [];
  for (const element of songElements) {
    const { resolved, warning } = await resolveSong(element.sourceId!, element);
    if (warning) {
      warnings.missingSongs.push(warning);
    }
    if (resolved) {
      // Check assets
      const assets = await checkSongAssets(resolved.song.id);
      const missing: string[] = [];
      if (assets.missingChordCharts) missing.push('partitura');
      if (assets.missingAudioReferences) missing.push('referencia_audio');
      if (assets.missingStems) missing.push('stems');
      if (missing.length > 0) {
        warnings.missingAssets[resolved.song.title] = missing;
      }
      resolvedSongs.push(resolved);
    }
  }

  if (resolvedSongs.length === 0) {
    return {
      success: false,
      warnings,
      songsPublished: 0,
    };
  }

  // 3. Ensure service date exists
  let serviceDateRow: MusicServiceDateRow;
  const existingDates = await getServiceDates(serviceDate, serviceDate);
  const matchingDate = existingDates.find(
    (sd) => sd.date === serviceDate && sd.service_type === serviceType
  );

  if (matchingDate) {
    serviceDateRow = matchingDate;
  } else {
    serviceDateRow = await createServiceDate({
      date: serviceDate,
      service_type: serviceType,
      title: liturgyTitle || null,
    });
  }

  // 4. Ensure setlist exists
  let setlistRow: MusicSetlistRow;
  const existingSetlists = await getSetlistsForServiceDate(serviceDateRow.id);

  if (existingSetlists.length > 0) {
    setlistRow = existingSetlists[0];

    // If replace mode, delete existing items
    if (mode === 'replace') {
      const { error: deleteError } = await supabase
        .from('music_setlist_items')
        .delete()
        .eq('setlist_id', setlistRow.id);

      if (deleteError) throw new Error(deleteError.message);
    }
  } else {
    setlistRow = await createSetlist({
      service_date_id: serviceDateRow.id,
      title: liturgyTitle || `Setlist ${serviceDate}`,
      status: 'draft',
    });
  }

  // 5. Determine starting sort_order and existing songs for 'add' mode
  let startOrder = 0;
  let existingSongIds: Set<string> = new Set();
  if (mode === 'add') {
    const { data: existingItems } = await supabase
      .from('music_setlist_items')
      .select('sort_order, song_id')
      .eq('setlist_id', setlistRow.id)
      .order('sort_order', { ascending: false });

    if (existingItems && existingItems.length > 0) {
      startOrder = (existingItems[0] as { sort_order: number }).sort_order + 1;
      existingSongIds = new Set(
        existingItems.map((item: { song_id: string }) => item.song_id)
      );
    }
  }

  // 6. Add setlist items (skip duplicates in 'add' mode)
  let insertIndex = 0;
  for (let i = 0; i < resolvedSongs.length; i++) {
    const { song, element, arrangementId } = resolvedSongs[i];

    // In 'add' mode, skip songs already in the setlist
    if (mode === 'add' && existingSongIds.has(song.id)) {
      continue;
    }

    const liturgicalMoment = LITURGICAL_MOMENT_MAP[element.type] || null;

    await addSetlistItem({
      setlist_id: setlistRow.id,
      song_id: song.id,
      arrangement_id: arrangementId,
      liturgical_moment: liturgicalMoment,
      sort_order: startOrder + insertIndex,
    });
    insertIndex++;
  }

  // 7. Get current user for published_by
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id || null;

  // 8. Create or update publication state
  const warningSnapshot: WarningSnapshot = {
    missingSongs: warnings.missingSongs,
    missingAssets: warnings.missingAssets,
  };

  const existingPublication = await getPublicationByLiturgyAndServiceDate(
    liturgyId,
    serviceDateRow.id
  );

  let publicationId: string;
  let publishVersion: number;

  if (existingPublication) {
    const updated = await incrementPublishVersion(existingPublication.id, {
      setlist_id: setlistRow.id,
      warning_snapshot: warningSnapshot,
      published_by: userId,
    });
    publicationId = updated.id;
    publishVersion = updated.publish_version;
  } else {
    const created = await createPublication({
      liturgy_id: liturgyId,
      service_date_id: serviceDateRow.id,
      setlist_id: setlistRow.id,
      publish_version: 1,
      published_by: userId,
      warning_snapshot: warningSnapshot,
    });
    publicationId = created.id;
    publishVersion = 1;
  }

  return {
    success: true,
    setlistId: setlistRow.id,
    serviceDateId: serviceDateRow.id,
    publicationId,
    publishVersion,
    warnings,
    songsPublished: mode === 'add' ? insertIndex : resolvedSongs.length,
  };
}
