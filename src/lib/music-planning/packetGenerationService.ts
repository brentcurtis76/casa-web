/**
 * Packet Generation Service — PDF generation for musician packets.
 *
 * Uses pdf-lib to create combined PDF packets containing a cover page
 * and chord charts in setlist order. Uploads to Supabase storage.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from '@/integrations/supabase/client';
import { getSetlistById } from '@/lib/music-planning/setlistService';
import type { SetlistWithItems } from '@/types/musicPlanning';

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_WIDTH = 612;  // US Letter width in points
const PAGE_HEIGHT = 792; // US Letter height in points
const MARGIN = 50;
const STORAGE_BUCKET = 'music-packets';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PacketGenerationResult {
  success: boolean;
  storagePath?: string;
  pdfBlob?: Blob;
  warnings: string[];
}

export interface PacketGenerationParams {
  setlistId: string;
  serviceDateLabel: string;
  serviceTitle?: string;
  serviceDateId: string;
}

// ─── Cover page ─────────────────────────────────────────────────────────────

async function addCoverPage(
  pdfDoc: PDFDocument,
  params: {
    serviceDateLabel: string;
    serviceTitle?: string;
    songs: { title: string; moment: string | null; index: number }[];
  }
): Promise<void> {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_HEIGHT - MARGIN;

  // CASA header
  page.drawText('CASA', {
    x: MARGIN,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.8, 0.65, 0.1), // Amber-ish
  });

  page.drawText('Comunidad Anglicana San Andres', {
    x: MARGIN,
    y: y - 18,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  y -= 60;

  // Title
  const title = params.serviceTitle || 'Paquete Musical';
  page.drawText(title, {
    x: MARGIN,
    y,
    size: 24,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  y -= 30;

  // Service date
  page.drawText(params.serviceDateLabel, {
    x: MARGIN,
    y,
    size: 14,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  y -= 50;

  // Divider line
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  y -= 30;

  // Song list header
  page.drawText('Canciones', {
    x: MARGIN,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  y -= 30;

  // Song list
  for (const song of params.songs) {
    const momentLabel = song.moment ? ` (${song.moment})` : '';
    const text = `${song.index + 1}. ${song.title}${momentLabel}`;
    page.drawText(text, {
      x: MARGIN + 10,
      y,
      size: 12,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 22;

    if (y < MARGIN + 40) break; // Avoid running off page
  }

  // Footer
  page.drawText('Generado por CASA - Sistema de Gestion Comunitaria', {
    x: MARGIN,
    y: MARGIN,
    size: 8,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });
}

// ─── Chord chart embedding ──────────────────────────────────────────────────

async function fetchChordChartBytes(storagePath: string): Promise<Uint8Array | null> {
  try {
    const { data, error } = await supabase.storage
      .from('music-chord-charts')
      .download(storagePath);

    if (error || !data) return null;

    const arrayBuffer = await data.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch {
    return null;
  }
}

async function embedChordChart(
  targetDoc: PDFDocument,
  chartBytes: Uint8Array,
  fileType: string | null
): Promise<boolean> {
  try {
    if (fileType === 'pdf' || !fileType) {
      // Try as PDF
      const chartPdf = await PDFDocument.load(chartBytes, { ignoreEncryption: true });
      const pageIndices = chartPdf.getPageIndices();
      const copiedPages = await targetDoc.copyPages(chartPdf, pageIndices);
      for (const page of copiedPages) {
        targetDoc.addPage(page);
      }
      return true;
    }

    if (fileType === 'png') {
      const image = await targetDoc.embedPng(chartBytes);
      const page = targetDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const scaled = image.scaleToFit(PAGE_WIDTH - MARGIN * 2, PAGE_HEIGHT - MARGIN * 2);
      page.drawImage(image, {
        x: (PAGE_WIDTH - scaled.width) / 2,
        y: (PAGE_HEIGHT - scaled.height) / 2,
        width: scaled.width,
        height: scaled.height,
      });
      return true;
    }

    if (fileType === 'jpg') {
      const image = await targetDoc.embedJpg(chartBytes);
      const page = targetDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const scaled = image.scaleToFit(PAGE_WIDTH - MARGIN * 2, PAGE_HEIGHT - MARGIN * 2);
      page.drawImage(image, {
        x: (PAGE_WIDTH - scaled.width) / 2,
        y: (PAGE_HEIGHT - scaled.height) / 2,
        width: scaled.width,
        height: scaled.height,
      });
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// ─── Main generation ────────────────────────────────────────────────────────

/**
 * Generate a combined PDF packet for a setlist.
 * Includes a cover page followed by chord charts in setlist order.
 */
export async function generateMusicPacket(
  params: PacketGenerationParams
): Promise<PacketGenerationResult> {
  const warnings: string[] = [];

  // 1. Fetch setlist with items
  const setlist: SetlistWithItems | null = await getSetlistById(params.setlistId);
  if (!setlist) {
    return { success: false, warnings: ['Setlist no encontrada'] };
  }

  const items = setlist.music_setlist_items;
  if (items.length === 0) {
    return { success: false, warnings: ['Setlist sin canciones'] };
  }

  // 2. Create PDF document
  const pdfDoc = await PDFDocument.create();

  // 3. Add cover page
  const songs = items.map((item, idx) => ({
    title: item.music_songs.title,
    moment: item.liturgical_moment,
    index: idx,
  }));

  await addCoverPage(pdfDoc, {
    serviceDateLabel: params.serviceDateLabel,
    serviceTitle: params.serviceTitle,
    songs,
  });

  // 4. For each setlist item, fetch and embed chord charts
  for (const item of items) {
    if (!item.arrangement_id) {
      warnings.push(`${item.music_songs.title}: sin arreglo seleccionado`);
      continue;
    }

    // Fetch chord charts for this arrangement
    const { data: charts, error: chartsError } = await supabase
      .from('music_chord_charts')
      .select('storage_path, file_type')
      .eq('arrangement_id', item.arrangement_id);

    if (chartsError || !charts || charts.length === 0) {
      warnings.push(`${item.music_songs.title}: sin partitura disponible`);
      continue;
    }

    // Embed first chart found
    const chart = charts[0] as { storage_path: string; file_type: string | null };
    const chartBytes = await fetchChordChartBytes(chart.storage_path);
    if (!chartBytes) {
      warnings.push(`${item.music_songs.title}: error descargando partitura`);
      continue;
    }

    const embedded = await embedChordChart(pdfDoc, chartBytes, chart.file_type);
    if (!embedded) {
      warnings.push(`${item.music_songs.title}: error procesando partitura`);
    }
  }

  // 5. Generate PDF bytes
  const pdfBytes = await pdfDoc.save();
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

  // 6. Upload to Supabase storage
  const storagePath = `${params.serviceDateId}/${params.setlistId}/packet.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, pdfBlob, {
      upsert: true,
      contentType: 'application/pdf',
    });

  if (uploadError) {
    // Upload may fail if bucket doesn't exist yet — return PDF anyway
    warnings.push(`Error subiendo PDF al almacenamiento: ${uploadError.message}`);
    return { success: true, pdfBlob, warnings };
  }

  return {
    success: true,
    storagePath,
    pdfBlob,
    warnings,
  };
}

/**
 * Create a signed URL for a packet PDF (24-hour expiry).
 */
export async function getPacketSignedUrl(
  storagePath: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 86400); // 24 hours

  if (error) return null;
  return data.signedUrl;
}
