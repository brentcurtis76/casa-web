/**
 * One-time migration script: Seed 73 songs from local JSON into music_songs table.
 *
 * Run with:
 *   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-songs-to-supabase.ts
 *
 * CRITICAL (Architect M1): The old song `id` field (e.g. "01-el-espiritu") is stored
 * as the DB `slug` column so that the compatibility shim in songStorage.ts can map
 * Song.id = row.slug for backward compatibility with all existing callers.
 *
 * This script is idempotent: uses upsert with onConflict: 'slug'.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// =====================================================
// Environment setup (process.env, NOT import.meta.env)
// =====================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing required environment variables.');
  console.error('  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  console.error('');
  console.error('Usage:');
  console.error('  SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-songs-to-supabase.ts');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =====================================================
// Paths
// =====================================================

const DATA_DIR = path.resolve(__dirname, '..', 'src', 'data', 'canciones');
const INDEX_PATH = path.join(DATA_DIR, 'index.json');
const PDF_EXTRACTED_DIR = path.join(DATA_DIR, 'pdf-extracted');

// =====================================================
// Types (inline — this script cannot use @ path aliases)
// =====================================================

interface SongIndexEntry {
  id: string;
  number: number;
  title: string;
  slug: string;
  verseCount: number;
  artist?: string;
}

interface SongIndex {
  total: number;
  generatedAt: string;
  source: string;
  songs: SongIndexEntry[];
}

interface Verse {
  number: number;
  type: string;
  content: string;
}

interface SongJson {
  id: string;
  number: number;
  title: string;
  slug: string;
  artist?: string;
  startPage?: number;
  endPage?: number;
  verses: Verse[];
  metadata?: {
    verseCount: number;
    hasChorus?: boolean;
    source?: string;
    extractedAt?: string;
  };
  songTags?: {
    tempo?: string;
    themes?: string[];
    suggestedMoments?: string[];
  };
}

interface MusicSongInsert {
  title: string;
  artist?: string | null;
  slug: string;
  number?: number | null;
  lyrics?: unknown;
  tempo?: string | null;
  themes?: string[] | null;
  suggested_moments?: string[] | null;
}

// =====================================================
// Main
// =====================================================

async function main(): Promise<void> {
  console.log('=== CASA Music Song Migration ===');
  console.log(`Reading index from: ${INDEX_PATH}`);

  // Read the index
  const indexContent = fs.readFileSync(INDEX_PATH, 'utf-8');
  const index: SongIndex = JSON.parse(indexContent);

  console.log(`Found ${index.songs.length} songs in index.`);
  console.log('');

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Process in batches of 20
  const BATCH_SIZE = 20;
  const batches: SongIndexEntry[][] = [];
  for (let i = 0; i < index.songs.length; i += BATCH_SIZE) {
    batches.push(index.songs.slice(i, i + BATCH_SIZE));
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const inserts: MusicSongInsert[] = [];

    for (const entry of batch) {
      const songNum = batchIdx * BATCH_SIZE + batch.indexOf(entry) + 1;
      const jsonPath = path.join(PDF_EXTRACTED_DIR, `${entry.id}.json`);

      try {
        const songContent = fs.readFileSync(jsonPath, 'utf-8');
        const song: SongJson = JSON.parse(songContent);

        // CRITICAL (M1): Store song.id as the DB slug column
        const insert: MusicSongInsert = {
          title: song.title,
          artist: song.artist ?? null,
          slug: song.id,           // e.g. "01-el-espiritu" — maps to Song.id in the shim
          number: song.number ?? null,
          lyrics: song.verses,     // JSONB — Verse[]
          tempo: song.songTags?.tempo ?? null,
          themes: song.songTags?.themes ?? null,
          suggested_moments: song.songTags?.suggestedMoments ?? null,
        };

        inserts.push(insert);
        console.log(`[${songNum}/${index.songs.length}] Prepared: ${song.title}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[${songNum}/${index.songs.length}] ERROR reading ${entry.id}: ${msg}`);
        errors.push(`${entry.id}: ${msg}`);
        errorCount++;
      }
    }

    // Upsert the batch
    if (inserts.length > 0) {
      const { data, error } = await supabase
        .from('music_songs')
        .upsert(inserts, { onConflict: 'slug' })
        .select('id, slug');

      if (error) {
        console.error(`Batch ${batchIdx + 1} upsert error: ${error.message}`);
        errors.push(`Batch ${batchIdx + 1}: ${error.message}`);
        errorCount += inserts.length;
      } else {
        const insertedCount = data?.length ?? 0;
        successCount += insertedCount;

        // Create "Original" arrangement for each newly inserted song
        if (data && data.length > 0) {
          const arrangements = data.map((row: { id: string; slug: string }) => ({
            song_id: row.id,
            name: 'Original',
            sort_order: 0,
          }));

          const { error: arrError } = await supabase
            .from('music_arrangements')
            .upsert(arrangements, { onConflict: 'song_id,name', ignoreDuplicates: true });

          if (arrError) {
            console.error(`  Arrangement upsert error: ${arrError.message}`);
            // Non-fatal: songs are still inserted
          }
        }
      }
    }
  }

  // Summary
  console.log('');
  console.log('=== Migration Summary ===');
  console.log(`Songs migrated: ${successCount}`);
  console.log(`Errors: ${errorCount}`);

  if (errors.length > 0) {
    console.log('');
    console.log('Error details:');
    for (const err of errors) {
      console.log(`  - ${err}`);
    }
  }

  console.log('');
  console.log(`Migration complete: ${successCount} songs migrated, ${errorCount} errors.`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
