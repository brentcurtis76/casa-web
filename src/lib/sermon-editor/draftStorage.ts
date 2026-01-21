/**
 * Draft storage for sermon editor
 * Uses localStorage for metadata and IndexedDB for large audio files
 */

const DRAFT_KEY = 'sermon-editor-draft';
const DB_NAME = 'sermon-editor-db';
const DB_VERSION = 2; // Incremented for multi-segment support
const AUDIO_STORE = 'audio-files';

// PROMPT_009: Segment draft data for multi-segment support
export interface SegmentDraft {
  id: string;
  order: number;
  trimStart: number;
  trimEnd: number;
  duration: number;
  joinMode: 'crossfade' | 'cut';
  silencesMarkedForRemoval: string[];
  audioFileInfo: {
    name: string;
    size: number;
    type: string;
  };
  // Enhancement settings per segment
  enhancementSettings?: {
    gainDb: number;
    normalize: boolean;
    compressorEnabled: boolean;
    compressorThreshold: number;
    compressorRatio: number;
    eqEnabled: boolean;
    eqLowGain: number;
    eqMidGain: number;
    eqHighGain: number;
    noiseReductionEnabled: boolean;
    noiseReductionAmount: number;
  };
}

export interface SermonDraft {
  // Metadata
  metadata: {
    title: string;
    speaker: string;
    date: string;
    series: string;
    description: string;
  };
  // Legacy single-segment trim settings (for backward compatibility)
  trimStart: number;
  trimEnd: number;
  duration: number;
  // Music settings
  musicSettings: {
    includeIntro: boolean;
    includeOutro: boolean;
    introTrackId: string | null;
    outroTrackId: string | null;
  };
  // Cover image as base64 (if small enough)
  coverImageBase64: string | null;
  // Legacy: Audio file info for single segment (for backward compatibility)
  audioFileInfo: {
    name: string;
    size: number;
    type: string;
  } | null;
  // Legacy: Silences marked for removal for single segment
  silencesMarkedForRemoval: string[]; // Array of silence IDs
  // PROMPT_009: Multi-segment support
  segments?: SegmentDraft[];
  activeSegmentId?: string | null;
  // Timestamp
  savedAt: string;
}

/**
 * Open IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE);
      }
    };
  });
}

/**
 * Save audio file to IndexedDB with a specific key
 * PROMPT_009: Updated to support segment-specific keys
 */
async function saveAudioToIndexedDB(file: File, key: string = 'draft-audio'): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE, 'readwrite');
    const store = transaction.objectStore(AUDIO_STORE);
    const request = store.put(file, key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Save multiple segment audio files to IndexedDB
 * PROMPT_009: Multi-segment support
 */
async function saveSegmentAudios(
  segments: Array<{ id: string; file: File }>
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE, 'readwrite');
    const store = transaction.objectStore(AUDIO_STORE);

    // Save each segment's audio file
    segments.forEach(({ id, file }) => {
      store.put(file, `segment-${id}`);
    });

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

/**
 * Load audio file from IndexedDB with a specific key
 * PROMPT_009: Updated to support segment-specific keys
 */
async function loadAudioFromIndexedDB(key: string = 'draft-audio'): Promise<File | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(AUDIO_STORE, 'readonly');
      const store = transaction.objectStore(AUDIO_STORE);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);

      transaction.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error('Error loading audio from IndexedDB:', err);
    return null;
  }
}

/**
 * Load multiple segment audio files from IndexedDB
 * PROMPT_009: Multi-segment support
 */
async function loadSegmentAudios(
  segmentIds: string[]
): Promise<Map<string, File>> {
  const result = new Map<string, File>();
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(AUDIO_STORE, 'readonly');
      const store = transaction.objectStore(AUDIO_STORE);

      let completedRequests = 0;
      const totalRequests = segmentIds.length;

      if (totalRequests === 0) {
        db.close();
        resolve(result);
        return;
      }

      segmentIds.forEach((id) => {
        const request = store.get(`segment-${id}`);
        request.onsuccess = () => {
          if (request.result) {
            result.set(id, request.result);
          }
          completedRequests++;
          if (completedRequests === totalRequests) {
            // All requests complete
          }
        };
        request.onerror = () => {
          completedRequests++;
        };
      });

      transaction.oncomplete = () => {
        db.close();
        resolve(result);
      };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (err) {
    console.error('Error loading segment audios from IndexedDB:', err);
    return result;
  }
}

/**
 * Delete audio file from IndexedDB
 * PROMPT_009: Updated to clear all segment audios as well
 */
async function deleteAudioFromIndexedDB(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(AUDIO_STORE, 'readwrite');
      const store = transaction.objectStore(AUDIO_STORE);
      // Clear all audio files (legacy + segments)
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();

      transaction.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error('Error deleting audio from IndexedDB:', err);
  }
}

/**
 * Convert Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert base64 string to Blob
 */
function base64ToBlob(base64: string): Blob {
  const parts = base64.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(parts[1]);
  const arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) {
    arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
}

/**
 * Save draft to storage
 * PROMPT_009: Updated to support multi-segment projects
 */
export async function saveDraft(
  state: {
    metadata: SermonDraft['metadata'];
    trimStart: number;
    trimEnd: number;
    duration: number;
    musicSettings: {
      includeIntro: boolean;
      includeOutro: boolean;
      introTrack: { id: string } | null;
      outroTrack: { id: string } | null;
    };
    silences: Array<{ id: string; markedForRemoval?: boolean }>;
    // PROMPT_009: Multi-segment support
    segments?: Array<{
      id: string;
      file: File;
      order: number;
      trimStart: number;
      trimEnd: number;
      duration: number;
      joinMode: 'crossfade' | 'cut';
      silences: Array<{ id: string; markedForRemoval?: boolean }>;
      enhancementSettings: {
        gainDb: number;
        normalize: boolean;
        compressorEnabled: boolean;
        compressorThreshold: number;
        compressorRatio: number;
        eqEnabled: boolean;
        eqLowGain: number;
        eqMidGain: number;
        eqHighGain: number;
        noiseReductionEnabled: boolean;
        noiseReductionAmount: number;
      };
    }>;
    activeSegmentId?: string | null;
  },
  audioFile: File | null,
  coverImage: Blob | null
): Promise<void> {
  // PROMPT_009: Save segment audio files if multi-segment mode
  if (state.segments && state.segments.length > 0) {
    await saveSegmentAudios(
      state.segments.map(seg => ({ id: seg.id, file: seg.file }))
    );
  } else if (audioFile) {
    // Legacy single-file mode
    await saveAudioToIndexedDB(audioFile);
  }

  // Convert cover image to base64 if present and small enough (< 1MB)
  let coverImageBase64: string | null = null;
  if (coverImage && coverImage.size < 1024 * 1024) {
    coverImageBase64 = await blobToBase64(coverImage);
  }

  // PROMPT_009: Build segment drafts if multi-segment mode
  const segmentDrafts: SegmentDraft[] | undefined = state.segments?.map(seg => ({
    id: seg.id,
    order: seg.order,
    trimStart: seg.trimStart,
    trimEnd: seg.trimEnd,
    duration: seg.duration,
    joinMode: seg.joinMode,
    silencesMarkedForRemoval: seg.silences
      .filter(s => s.markedForRemoval)
      .map(s => s.id),
    audioFileInfo: {
      name: seg.file.name,
      size: seg.file.size,
      type: seg.file.type,
    },
    enhancementSettings: seg.enhancementSettings,
  }));

  // Build draft object
  const draft: SermonDraft = {
    metadata: state.metadata,
    trimStart: state.trimStart,
    trimEnd: state.trimEnd,
    duration: state.duration,
    musicSettings: {
      includeIntro: state.musicSettings.includeIntro,
      includeOutro: state.musicSettings.includeOutro,
      introTrackId: state.musicSettings.introTrack?.id || null,
      outroTrackId: state.musicSettings.outroTrack?.id || null,
    },
    coverImageBase64,
    audioFileInfo: audioFile ? {
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type,
    } : null,
    silencesMarkedForRemoval: state.silences
      .filter(s => s.markedForRemoval)
      .map(s => s.id),
    // PROMPT_009: Multi-segment data
    segments: segmentDrafts,
    activeSegmentId: state.activeSegmentId,
    savedAt: new Date().toISOString(),
  };

  // Save to localStorage
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

/**
 * Load draft from storage
 * PROMPT_009: Updated to support multi-segment projects
 */
export async function loadDraft(): Promise<{
  draft: SermonDraft;
  audioFile: File | null;
  coverImage: Blob | null;
  // PROMPT_009: Segment audio files mapped by segment ID
  segmentAudioFiles?: Map<string, File>;
} | null> {
  // Check localStorage for draft
  const draftJson = localStorage.getItem(DRAFT_KEY);
  if (!draftJson) {
    return null;
  }

  try {
    const draft: SermonDraft = JSON.parse(draftJson);

    // PROMPT_009: Load segment audio files if multi-segment mode
    let segmentAudioFiles: Map<string, File> | undefined;
    if (draft.segments && draft.segments.length > 0) {
      const segmentIds = draft.segments.map(seg => seg.id);
      segmentAudioFiles = await loadSegmentAudios(segmentIds);
    }

    // Load legacy audio from IndexedDB (for backward compatibility)
    const audioFile = await loadAudioFromIndexedDB();

    // Convert cover image from base64
    const coverImage = draft.coverImageBase64
      ? base64ToBlob(draft.coverImageBase64)
      : null;

    return { draft, audioFile, coverImage, segmentAudioFiles };
  } catch (err) {
    console.error('Error loading draft:', err);
    return null;
  }
}

/**
 * Check if a draft exists
 */
export function hasDraft(): boolean {
  return localStorage.getItem(DRAFT_KEY) !== null;
}

/**
 * Get draft info without loading full data
 */
export function getDraftInfo(): { savedAt: string; title: string; speaker: string } | null {
  const draftJson = localStorage.getItem(DRAFT_KEY);
  if (!draftJson) return null;

  try {
    const draft: SermonDraft = JSON.parse(draftJson);
    return {
      savedAt: draft.savedAt,
      title: draft.metadata.title || 'Sin título',
      speaker: draft.metadata.speaker || 'Sin predicador',
    };
  } catch {
    return null;
  }
}

/**
 * Delete draft from storage
 */
export async function deleteDraft(): Promise<void> {
  localStorage.removeItem(DRAFT_KEY);
  await deleteAudioFromIndexedDB();
}

/**
 * Format saved time as relative string
 */
export function formatSavedTime(isoString: string): string {
  const saved = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - saved.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'hace unos segundos';
  if (diffMins < 60) return `hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
}
