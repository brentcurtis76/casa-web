/**
 * Audio processing utilities using Web Audio API
 */

import { SilenceRegion } from './silenceDetector';

export interface AudioFileInfo {
  name: string;
  size: number;
  type: string;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
}

/**
 * Decode an audio file to AudioBuffer
 */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
  } finally {
    await audioContext.close();
  }
}

/**
 * Get file information from an audio file
 */
export async function getAudioFileInfo(file: File, audioBuffer: AudioBuffer): Promise<AudioFileInfo> {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
    numberOfChannels: audioBuffer.numberOfChannels,
  };
}

/**
 * Format file size for display (e.g., "12.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Format duration in seconds to MM:SS format
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format duration in seconds to HH:MM:SS format for longer audio
 */
export function formatDurationLong(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Convert AudioBuffer to WAV Blob
 * Used for saving trimmed audio without re-encoding
 */
export function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  // Calculate sizes
  const bytesPerSample = 2; // 16-bit audio
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  // Create buffer
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // Write WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write audio data (interleaved)
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numberOfChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      // Convert float to 16-bit PCM
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Trim an AudioBuffer to specified start and end times
 * Uses OfflineAudioContext which doesn't need manual closing
 */
export function trimAudioBuffer(
  audioBuffer: AudioBuffer,
  startTime: number,
  endTime: number
): AudioBuffer {
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;

  // Validate inputs
  if (startTime < 0) startTime = 0;
  if (endTime > audioBuffer.duration) endTime = audioBuffer.duration;
  if (startTime >= endTime) {
    throw new Error('Invalid trim range: start must be less than end');
  }

  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);
  const newLength = endSample - startSample;

  // Use OfflineAudioContext - doesn't need manual closing (no memory leak)
  const offlineContext = new OfflineAudioContext(numberOfChannels, newLength, sampleRate);
  const newBuffer = offlineContext.createBuffer(numberOfChannels, newLength, sampleRate);

  // Copy the relevant portion of each channel using efficient subarray copy
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const originalData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);
    newData.set(originalData.subarray(startSample, endSample));
  }

  return newBuffer;
}

/**
 * Trim an AudioBuffer and remove marked silences
 * Non-destructive: creates a new buffer without modifying the original
 * @param audioBuffer Original audio buffer
 * @param startTime Trim start time in seconds
 * @param endTime Trim end time in seconds
 * @param silences Array of silence regions marked for removal
 * @returns New AudioBuffer with trims applied and silences removed
 */
export function trimAudioBufferWithSilenceRemovals(
  audioBuffer: AudioBuffer,
  startTime: number,
  endTime: number,
  silences: SilenceRegion[]
): AudioBuffer {
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;

  // Validate inputs
  if (startTime < 0) startTime = 0;
  if (endTime > audioBuffer.duration) endTime = audioBuffer.duration;
  if (startTime >= endTime) {
    throw new Error('Invalid trim range: start must be less than end');
  }

  // Clamp silence boundaries to trim range and filter out silences completely outside
  // This ensures partial silences (crossing trim boundaries) are properly handled
  const sortedSilences = silences
    .map(s => ({
      ...s,
      // Clamp silence boundaries to trim range
      start: Math.max(s.start, startTime),
      end: Math.min(s.end, endTime),
    }))
    .filter(s => s.start < s.end) // Filter out silences completely outside trim range
    .sort((a, b) => a.start - b.start);

  // Calculate segments to keep (regions between silences)
  interface Segment {
    start: number;
    end: number;
  }

  const segments: Segment[] = [];
  let currentStart = startTime;

  for (const silence of sortedSilences) {
    // Add segment before this silence
    if (currentStart < silence.start) {
      segments.push({
        start: currentStart,
        end: silence.start,
      });
    }
    // Move past this silence
    currentStart = silence.end;
  }

  // Add final segment after last silence
  if (currentStart < endTime) {
    segments.push({
      start: currentStart,
      end: endTime,
    });
  }

  // Calculate total duration of kept segments
  const totalDuration = segments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
  const totalSamples = Math.floor(totalDuration * sampleRate);

  if (totalSamples <= 0) {
    throw new Error('No audio remains after removing silences');
  }

  // Create new buffer
  const offlineContext = new OfflineAudioContext(numberOfChannels, totalSamples, sampleRate);
  const newBuffer = offlineContext.createBuffer(numberOfChannels, totalSamples, sampleRate);

  // Copy segments for each channel
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const originalData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);

    let writeOffset = 0;

    for (const segment of segments) {
      const readStart = Math.floor(segment.start * sampleRate);
      const readEnd = Math.floor(segment.end * sampleRate);
      const segmentLength = readEnd - readStart;

      // Copy this segment
      newData.set(
        originalData.subarray(readStart, readEnd),
        writeOffset
      );

      writeOffset += segmentLength;
    }
  }

  return newBuffer;
}

/**
 * Check if file type is supported
 */
export function isSupportedAudioFormat(file: File): boolean {
  const supportedTypes = [
    'audio/mpeg',      // MP3
    'audio/mp3',       // MP3 alternative
    'audio/wav',       // WAV
    'audio/wave',      // WAV alternative
    'audio/x-wav',     // WAV alternative
    'audio/mp4',       // M4A
    'audio/m4a',       // M4A alternative
    'audio/x-m4a',     // M4A alternative
    'audio/flac',      // FLAC
    'audio/x-flac',    // FLAC alternative
  ];

  // Also check by extension if MIME type is generic
  const extension = file.name.split('.').pop()?.toLowerCase();
  const supportedExtensions = ['mp3', 'wav', 'wave', 'm4a', 'mp4', 'flac'];

  return supportedTypes.includes(file.type) ||
         (extension !== undefined && supportedExtensions.includes(extension));
}

/**
 * Get supported format extensions for display
 */
export function getSupportedFormats(): string {
  return 'MP3, WAV, M4A, FLAC';
}

// ============================================================================
// PROMPT_004: Intro/Outro Music Integration - Crossfade Export Functionality
// ============================================================================

/**
 * Options for exporting audio with intro/outro music
 */
export interface ExportWithMusicOptions {
  introBuffer?: AudioBuffer | null;
  outroBuffer?: AudioBuffer | null;
  crossfadeDuration?: number; // default: 0.5s
}

/**
 * Fetch and decode an audio file from URL to AudioBuffer
 */
export async function fetchAudioBuffer(url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
  } finally {
    await audioContext.close();
  }
}

/**
 * Concatenate audio buffers with crossfade transitions
 * Used for adding intro/outro music to sermon recordings
 *
 * @param sermonBuffer The main sermon audio buffer (already trimmed)
 * @param options Options including intro/outro buffers and crossfade duration
 * @returns New AudioBuffer with intro/outro concatenated with crossfades
 */
export async function concatenateWithCrossfade(
  sermonBuffer: AudioBuffer,
  options: ExportWithMusicOptions
): Promise<AudioBuffer> {
  const { introBuffer, outroBuffer, crossfadeDuration = 0.5 } = options;

  const sampleRate = sermonBuffer.sampleRate;
  const numberOfChannels = sermonBuffer.numberOfChannels;

  // Calculate durations
  const introDuration = introBuffer ? introBuffer.duration : 0;
  const sermonDuration = sermonBuffer.duration;
  const outroDuration = outroBuffer ? outroBuffer.duration : 0;

  // Calculate crossfade overlaps (reduce total duration by crossfade amounts)
  const introOverlap = introBuffer ? Math.min(crossfadeDuration, introDuration / 2, sermonDuration / 2) : 0;
  const outroOverlap = outroBuffer ? Math.min(crossfadeDuration, outroDuration / 2, sermonDuration / 2) : 0;

  // Total duration accounting for crossfade overlaps
  const totalDuration = introDuration + sermonDuration + outroDuration - introOverlap - outroOverlap;
  const totalSamples = Math.ceil(totalDuration * sampleRate);

  // Create offline audio context for rendering
  const offlineContext = new OfflineAudioContext(numberOfChannels, totalSamples, sampleRate);

  // Calculate start times for each section
  const introStart = 0;
  const sermonStart = introDuration - introOverlap;
  const outroStart = sermonStart + sermonDuration - outroOverlap;

  // Debug logging
  console.log('[concatenateWithCrossfade] Timeline:');
  console.log(`  Intro: ${introStart.toFixed(2)}s - ${(introStart + introDuration).toFixed(2)}s (duration: ${introDuration.toFixed(2)}s)`);
  console.log(`  Sermon: ${sermonStart.toFixed(2)}s - ${(sermonStart + sermonDuration).toFixed(2)}s (duration: ${sermonDuration.toFixed(2)}s)`);
  console.log(`  Outro: ${outroStart.toFixed(2)}s - ${(outroStart + outroDuration).toFixed(2)}s (duration: ${outroDuration.toFixed(2)}s)`);
  console.log(`  Total output: ${totalDuration.toFixed(2)}s`);
  console.log(`  Sample rates - sermon: ${sermonBuffer.sampleRate}, intro: ${introBuffer?.sampleRate}, outro: ${outroBuffer?.sampleRate}`);

  // Schedule intro with fade out
  if (introBuffer) {
    const introSource = offlineContext.createBufferSource();
    introSource.buffer = resampleBufferIfNeeded(introBuffer, sampleRate, numberOfChannels, offlineContext);

    const introGain = offlineContext.createGain();

    // Fade out at the end of intro
    const fadeOutStart = introDuration - crossfadeDuration;
    introGain.gain.setValueAtTime(1, introStart);
    introGain.gain.setValueAtTime(1, introStart + fadeOutStart);
    introGain.gain.linearRampToValueAtTime(0, introStart + introDuration);

    introSource.connect(introGain);
    introGain.connect(offlineContext.destination);
    introSource.start(introStart);
  }

  // Schedule sermon with fade in and fade out
  {
    const sermonSource = offlineContext.createBufferSource();
    sermonSource.buffer = sermonBuffer;

    const sermonGain = offlineContext.createGain();

    // Fade in if there's an intro
    if (introBuffer) {
      sermonGain.gain.setValueAtTime(0, sermonStart);
      sermonGain.gain.linearRampToValueAtTime(1, sermonStart + crossfadeDuration);
    } else {
      sermonGain.gain.setValueAtTime(1, sermonStart);
    }

    // Fade out if there's an outro
    if (outroBuffer) {
      const fadeOutStart = sermonStart + sermonDuration - crossfadeDuration;
      sermonGain.gain.setValueAtTime(1, fadeOutStart);
      sermonGain.gain.linearRampToValueAtTime(0, sermonStart + sermonDuration);
    }

    sermonSource.connect(sermonGain);
    sermonGain.connect(offlineContext.destination);
    sermonSource.start(sermonStart);
  }

  // Schedule outro with fade in
  if (outroBuffer) {
    const outroSource = offlineContext.createBufferSource();
    outroSource.buffer = resampleBufferIfNeeded(outroBuffer, sampleRate, numberOfChannels, offlineContext);

    const outroGain = offlineContext.createGain();

    // Fade in at the start of outro
    outroGain.gain.setValueAtTime(0, outroStart);
    outroGain.gain.linearRampToValueAtTime(1, outroStart + crossfadeDuration);

    outroSource.connect(outroGain);
    outroGain.connect(offlineContext.destination);
    outroSource.start(outroStart);
  }

  // Render the audio
  const renderedBuffer = await offlineContext.startRendering();
  return renderedBuffer;
}

/**
 * Helper function to resample an AudioBuffer if needed to match target sample rate/channels
 * This ensures intro/outro tracks work regardless of their original format
 */
function resampleBufferIfNeeded(
  buffer: AudioBuffer,
  targetSampleRate: number,
  targetChannels: number,
  context: OfflineAudioContext
): AudioBuffer {
  // If sample rate and channels match, return original
  if (buffer.sampleRate === targetSampleRate && buffer.numberOfChannels === targetChannels) {
    return buffer;
  }

  // Create a new buffer with the target parameters
  const duration = buffer.duration;
  const newLength = Math.ceil(duration * targetSampleRate);
  const newBuffer = context.createBuffer(targetChannels, newLength, targetSampleRate);

  // Simple resampling: copy and interpolate if needed
  for (let channel = 0; channel < targetChannels; channel++) {
    const sourceChannel = channel < buffer.numberOfChannels ? channel : 0;
    const sourceData = buffer.getChannelData(sourceChannel);
    const targetData = newBuffer.getChannelData(channel);

    const ratio = buffer.sampleRate / targetSampleRate;

    for (let i = 0; i < newLength; i++) {
      const sourceIndex = i * ratio;
      const indexFloor = Math.floor(sourceIndex);
      const indexCeil = Math.min(indexFloor + 1, sourceData.length - 1);
      const fraction = sourceIndex - indexFloor;

      // Linear interpolation
      targetData[i] = sourceData[indexFloor] * (1 - fraction) + sourceData[indexCeil] * fraction;
    }
  }

  return newBuffer;
}

/**
 * Segment info for multi-segment concatenation (PROMPT_009)
 */
export interface SegmentForConcatenation {
  buffer: AudioBuffer;
  joinMode: 'crossfade' | 'cut'; // How this segment joins to the NEXT one
}

/**
 * Concatenate multiple audio segments with configurable join modes (PROMPT_009)
 * Each segment can specify whether to use crossfade or direct cut to join with the next
 */
export async function concatenateSegments(
  segments: SegmentForConcatenation[],
  crossfadeDuration: number = 0.5
): Promise<AudioBuffer> {
  if (segments.length === 0) {
    throw new Error('No segments provided');
  }

  if (segments.length === 1) {
    return segments[0].buffer;
  }

  // Use the first segment's properties as reference
  const sampleRate = segments[0].buffer.sampleRate;
  const numberOfChannels = segments[0].buffer.numberOfChannels;

  console.log('[concatenateSegments] Starting segment concatenation:');
  console.log(`  Sample rate: ${sampleRate}, channels: ${numberOfChannels}`);

  // Calculate total duration accounting for overlaps
  let totalDuration = 0;
  const segmentStartTimes: number[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentDuration = segment.buffer.duration;

    segmentStartTimes.push(totalDuration);
    console.log(`  Segment ${i + 1}: starts at ${totalDuration.toFixed(2)}s, duration ${segmentDuration.toFixed(2)}s, joinMode: ${segment.joinMode}`);

    if (i < segments.length - 1) {
      // Not the last segment - check join mode
      const nextSegment = segments[i + 1];
      const nextDuration = nextSegment.buffer.duration;

      if (segment.joinMode === 'crossfade') {
        // Crossfade: overlap with next segment
        const overlap = Math.min(crossfadeDuration, segmentDuration / 2, nextDuration / 2);
        totalDuration += segmentDuration - overlap;
        console.log(`    -> Crossfade overlap: ${overlap.toFixed(2)}s`);
      } else {
        // Direct cut: no overlap
        totalDuration += segmentDuration;
        console.log(`    -> Direct cut (no overlap)`);
      }
    } else {
      // Last segment: add full duration
      totalDuration += segmentDuration;
    }
  }
  console.log(`  Total concatenated duration: ${totalDuration.toFixed(2)}s`);

  const totalSamples = Math.ceil(totalDuration * sampleRate);

  // Create offline audio context for rendering
  const offlineContext = new OfflineAudioContext(numberOfChannels, totalSamples, sampleRate);

  // Schedule each segment
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const startTime = segmentStartTimes[i];
    const segmentDuration = segment.buffer.duration;

    const source = offlineContext.createBufferSource();
    source.buffer = resampleBufferIfNeeded(segment.buffer, sampleRate, numberOfChannels, offlineContext);

    const gain = offlineContext.createGain();

    // Calculate fade in (if previous segment used crossfade)
    const needsFadeIn = i > 0 && segments[i - 1].joinMode === 'crossfade';
    // Calculate fade out (if this segment uses crossfade to next)
    const needsFadeOut = i < segments.length - 1 && segment.joinMode === 'crossfade';

    // Set up gain envelope
    if (needsFadeIn) {
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(1, startTime + crossfadeDuration);
    } else {
      gain.gain.setValueAtTime(1, startTime);
    }

    if (needsFadeOut) {
      const fadeOutStart = startTime + segmentDuration - crossfadeDuration;
      gain.gain.setValueAtTime(1, fadeOutStart);
      gain.gain.linearRampToValueAtTime(0, startTime + segmentDuration);
    }

    source.connect(gain);
    gain.connect(offlineContext.destination);
    source.start(startTime);
  }

  // Render the audio
  const renderedBuffer = await offlineContext.startRendering();
  return renderedBuffer;
}
