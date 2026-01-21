/**
 * ID3 Metadata Embedding for MP3 files
 * PROMPT_005: Cover Art & Metadata
 *
 * Uses browser-id3-writer to embed:
 * - Title (TIT2)
 * - Artist/Speaker (TPE1)
 * - Album/Series (TALB)
 * - Year (TYER)
 * - Comment/Description (COMM)
 * - Cover Art (APIC)
 */
import { ID3Writer } from 'browser-id3-writer';

export interface MP3Metadata {
  title: string;
  artist: string;      // Speaker
  album?: string;      // Series name
  year: number;
  comment?: string;    // Description
  coverImage?: ArrayBuffer;  // JPEG data
}

/**
 * Embed ID3 metadata into an MP3 blob
 */
export async function embedMetadata(
  mp3Blob: Blob,
  metadata: MP3Metadata
): Promise<Blob> {
  try {
    // Convert blob to ArrayBuffer
    const arrayBuffer = await mp3Blob.arrayBuffer();

    // Create ID3 writer
    const writer = new ID3Writer(arrayBuffer);

    // Set title (required)
    writer.setFrame('TIT2', metadata.title);

    // Set artist (speaker)
    writer.setFrame('TPE1', [metadata.artist]);

    // Set album (series) if provided
    if (metadata.album) {
      writer.setFrame('TALB', metadata.album);
    }

    // Set year
    writer.setFrame('TYER', metadata.year);

    // Set comment/description if provided
    if (metadata.comment) {
      writer.setFrame('COMM', {
        description: 'Description',
        text: metadata.comment,
        language: 'spa',
      });
    }

    // Set cover image if provided
    if (metadata.coverImage && metadata.coverImage.byteLength > 0) {
      writer.setFrame('APIC', {
        type: 3,           // Cover (front)
        data: metadata.coverImage,
        description: 'Cover',
        useUnicodeEncoding: false,
      });
    }

    // Build the tag
    writer.addTag();

    // Return new blob with embedded metadata
    return new Blob([writer.arrayBuffer], { type: 'audio/mpeg' });
  } catch (error) {
    console.error('Error embedding metadata:', error);
    // If embedding fails, return original blob
    return mp3Blob;
  }
}

/**
 * Convert a Blob (typically JPEG image) to ArrayBuffer for ID3 embedding
 */
export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}

/**
 * Helper to create metadata object from sermon data
 */
export function createMP3Metadata(
  title: string,
  speaker: string,
  date: Date,
  options?: {
    series?: string;
    description?: string;
    coverImageBuffer?: ArrayBuffer;
  }
): MP3Metadata {
  return {
    title,
    artist: speaker,
    album: options?.series,
    year: date.getFullYear(),
    comment: options?.description,
    coverImage: options?.coverImageBuffer,
  };
}

/**
 * Validate that metadata has minimum required fields
 */
export function validateMetadata(metadata: Partial<MP3Metadata>): metadata is MP3Metadata {
  return Boolean(
    metadata.title &&
    metadata.title.trim().length > 0 &&
    metadata.artist &&
    metadata.artist.trim().length > 0 &&
    metadata.year &&
    metadata.year > 1900 &&
    metadata.year <= new Date().getFullYear() + 1
  );
}

/**
 * Extract existing ID3 tags from an MP3 file (for debugging)
 * Note: browser-id3-writer is write-only, so this uses basic parsing
 */
export async function hasExistingID3Tags(mp3Blob: Blob): Promise<boolean> {
  try {
    const buffer = await mp3Blob.slice(0, 10).arrayBuffer();
    const view = new Uint8Array(buffer);

    // Check for ID3v2 header: "ID3" + version + flags + size
    if (view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33) {
      return true;
    }

    // Check for ID3v1 at the end (last 128 bytes start with "TAG")
    const tailBuffer = await mp3Blob.slice(-128, -125).arrayBuffer();
    const tailView = new Uint8Array(tailBuffer);
    if (tailView[0] === 0x54 && tailView[1] === 0x41 && tailView[2] === 0x47) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
