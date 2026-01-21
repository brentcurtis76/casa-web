/**
 * Silence detection algorithm for sermon audio editor
 * Analyzes audio buffer to find regions of silence for manual review
 */

export interface SilenceRegion {
  id: string;           // Unique identifier
  start: number;        // Start time in seconds
  end: number;          // End time in seconds
  duration: number;     // Calculated: end - start
  markedForRemoval: boolean; // User-selected for removal
}

export interface SilenceDetectionOptions {
  silenceThreshold: number;     // dB level (-60 to -20, default: -40)
  minSilenceDuration: number;   // Minimum seconds to flag (1-10, default: 3)
  edgePadding: number;          // Keep this much on edges (0-2s, default: 0.5)
}

export const DEFAULT_SILENCE_OPTIONS: SilenceDetectionOptions = {
  silenceThreshold: -40,
  minSilenceDuration: 3,
  edgePadding: 0.5,
};

/**
 * Analyze audio amplitude in windows and convert to dB values
 * Uses async with periodic yielding to keep UI responsive on long audio
 */
async function analyzeAmplitude(
  audioBuffer: AudioBuffer,
  windowSizeMs: number = 100
): Promise<{ dbValues: number[]; windowDuration: number }> {
  // Mix to mono or use first channel
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // Window size in samples (e.g., 100ms at 44100Hz = 4410 samples)
  const windowSize = Math.floor((windowSizeMs / 1000) * sampleRate);
  const windowDuration = windowSize / sampleRate;

  const dbValues: number[] = [];
  let windowCount = 0;

  for (let i = 0; i < channelData.length; i += windowSize) {
    // Yield every 500 windows (~5 seconds of audio at 100ms windows) to keep UI responsive
    if (windowCount > 0 && windowCount % 500 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const end = Math.min(i + windowSize, channelData.length);
    const slice = channelData.subarray(i, end);

    // Calculate RMS (Root Mean Square) amplitude
    let sumSquares = 0;
    for (let j = 0; j < slice.length; j++) {
      sumSquares += slice[j] * slice[j];
    }
    const rms = Math.sqrt(sumSquares / slice.length);

    // Convert to dB: 20 * log10(rms)
    // Add small epsilon to avoid log(0)
    const db = 20 * Math.log10(rms + 1e-10);
    dbValues.push(db);
    windowCount++;
  }

  return { dbValues, windowDuration };
}

/**
 * Find consecutive windows below threshold and merge into regions
 */
function findSilentRegions(
  dbValues: number[],
  windowDuration: number,
  threshold: number
): Array<{ start: number; end: number }> {
  const regions: Array<{ start: number; end: number }> = [];
  let silenceStart: number | null = null;

  for (let i = 0; i < dbValues.length; i++) {
    const currentTime = i * windowDuration;
    const isSilent = dbValues[i] < threshold;

    if (isSilent && silenceStart === null) {
      // Start of silence
      silenceStart = currentTime;
    } else if (!isSilent && silenceStart !== null) {
      // End of silence
      regions.push({
        start: silenceStart,
        end: currentTime,
      });
      silenceStart = null;
    }
  }

  // Handle silence at the end of audio
  if (silenceStart !== null) {
    regions.push({
      start: silenceStart,
      end: dbValues.length * windowDuration,
    });
  }

  return regions;
}

/**
 * Apply minimum duration filter and edge padding to regions
 */
function filterAndPadRegions(
  regions: Array<{ start: number; end: number }>,
  minDuration: number,
  edgePadding: number,
  audioDuration: number
): SilenceRegion[] {
  return regions
    .filter(region => (region.end - region.start) >= minDuration)
    .map((region, index) => {
      // Apply edge padding (keep some audio on edges)
      const paddedStart = Math.min(region.start + edgePadding, region.end);
      const paddedEnd = Math.max(region.end - edgePadding, paddedStart);

      // Ensure we have at least some duration after padding
      const duration = paddedEnd - paddedStart;

      // Skip if padding eliminates the region
      if (duration < 0.1) {
        return null;
      }

      return {
        id: `silence-${index}-${Date.now()}`,
        start: paddedStart,
        end: paddedEnd,
        duration,
        markedForRemoval: false,
      };
    })
    .filter((region): region is SilenceRegion => region !== null);
}

/**
 * Detect silences in an audio buffer
 * Returns array of silence regions for user review
 */
export async function detectSilences(
  audioBuffer: AudioBuffer,
  options: SilenceDetectionOptions = DEFAULT_SILENCE_OPTIONS
): Promise<SilenceRegion[]> {
  const { silenceThreshold, minSilenceDuration, edgePadding } = options;

  // Analyze amplitude in 100ms windows (async with UI yielding for long audio)
  const { dbValues, windowDuration } = await analyzeAmplitude(audioBuffer, 100);

  // Find regions below threshold
  const rawRegions = findSilentRegions(dbValues, windowDuration, silenceThreshold);

  // Filter by minimum duration and apply edge padding
  const silenceRegions = filterAndPadRegions(
    rawRegions,
    minSilenceDuration,
    edgePadding,
    audioBuffer.duration
  );

  // Re-index after filtering
  return silenceRegions.map((region, index) => ({
    ...region,
    id: `silence-${index}-${Date.now()}`,
  }));
}

/**
 * Calculate total duration of marked silences
 */
export function calculateRemovedDuration(silences: SilenceRegion[]): number {
  return silences
    .filter(s => s.markedForRemoval)
    .reduce((total, s) => total + s.duration, 0);
}

/**
 * Count silences marked for removal
 */
export function countMarkedSilences(silences: SilenceRegion[]): number {
  return silences.filter(s => s.markedForRemoval).length;
}

/**
 * Calculate removed duration only for silences within trim range
 * Clamps silence boundaries to the trim range for accurate calculation
 */
export function calculateRemovedDurationInRange(
  silences: SilenceRegion[],
  trimStart: number,
  trimEnd: number
): number {
  return silences
    .filter(s => s.markedForRemoval && s.start < trimEnd && s.end > trimStart)
    .map(s => ({
      start: Math.max(s.start, trimStart),
      end: Math.min(s.end, trimEnd),
    }))
    .reduce((sum, s) => sum + (s.end - s.start), 0);
}
