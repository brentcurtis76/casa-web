/**
 * MP3 encoding utilities using @breezystack/lamejs (fixed fork)
 */
import { Mp3Encoder } from '@breezystack/lamejs';

export interface EncodingOptions {
  bitrate?: number;  // kbps, default 128
  onProgress?: (progress: number) => void;  // 0-100
}

/**
 * Convert AudioBuffer to MP3 Blob using lamejs
 */
export async function encodeToMp3(
  audioBuffer: AudioBuffer,
  options: EncodingOptions = {}
): Promise<Blob> {
  const { bitrate = 128, onProgress } = options;

  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;

  // Create encoder (stereo or mono)
  const encoder = new Mp3Encoder(numberOfChannels, sampleRate, bitrate);

  // Get audio data
  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = numberOfChannels > 1
    ? audioBuffer.getChannelData(1)
    : leftChannel;

  // Convert Float32 to Int16
  const leftSamples = floatTo16BitPCM(leftChannel);
  const rightSamples = floatTo16BitPCM(rightChannel);

  // Encode in chunks for better performance and progress reporting
  const chunkSize = 1152; // MP3 frame size
  const mp3Data: Int8Array[] = [];
  const totalChunks = Math.ceil(leftSamples.length / chunkSize);

  for (let i = 0; i < leftSamples.length; i += chunkSize) {
    const leftChunk = leftSamples.subarray(i, Math.min(i + chunkSize, leftSamples.length));
    const rightChunk = rightSamples.subarray(i, Math.min(i + chunkSize, rightSamples.length));

    let mp3buf: Int8Array;
    if (numberOfChannels > 1) {
      mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      // Some lamejs forks require two channels even for mono
      // Pass the same buffer twice for mono encoding
      mp3buf = encoder.encodeBuffer(leftChunk, leftChunk);
    }

    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }

    // Report progress
    if (onProgress) {
      const currentChunk = Math.floor(i / chunkSize);
      const progress = Math.round((currentChunk / totalChunks) * 100);
      onProgress(progress);
    }

    // Yield to the event loop every 100 chunks to prevent UI freezing
    if (i % (chunkSize * 100) === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Flush remaining data
  const finalBuf = encoder.flush();
  if (finalBuf.length > 0) {
    mp3Data.push(finalBuf);
  }

  if (onProgress) {
    onProgress(100);
  }

  // Combine all chunks into a single Blob
  const totalLength = mp3Data.reduce((sum, arr) => sum + arr.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of mp3Data) {
    combined.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.length), offset);
    offset += chunk.length;
  }

  return new Blob([combined], { type: 'audio/mpeg' });
}

/**
 * Convert Float32Array audio samples to Int16Array
 * Float32 range: -1.0 to 1.0
 * Int16 range: -32768 to 32767
 */
function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);

  for (let i = 0; i < float32Array.length; i++) {
    // Clamp value to valid range
    let sample = Math.max(-1, Math.min(1, float32Array[i]));
    // Convert to 16-bit integer
    int16Array[i] = sample < 0
      ? Math.round(sample * 32768)
      : Math.round(sample * 32767);
  }

  return int16Array;
}

/**
 * Download a Blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a filename for the exported sermon
 */
export function generateExportFilename(
  title?: string,
  date?: Date
): string {
  const sanitizedTitle = title
    ? title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').substring(0, 50)
    : 'sermon';

  const dateStr = date
    ? date.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  return `${sanitizedTitle}_${dateStr}.mp3`;
}
