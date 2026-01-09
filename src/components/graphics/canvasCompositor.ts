/**
 * Canvas Compositor for CASA Graphics Generator
 * REFINEMENT: "The Statement V2"
 * 
 * Philosophy: 
 * - Single strong aesthetic (Editorial/Statement)
 * - Strict alignment (No floating elements)
 * - Logo Lockup (Integrated with Title)
 * - "Tight" typography (Negative tracking, compact leading)
 */

import { OVERLAY_CONFIG, OverlayContent } from './constants';

const BRAND = {
  amber: '#D4A853',
  amberDark: '#B8923D',
  charcoal: '#1A1A1A',
  cream: '#F9F7F5',
  white: '#FFFFFF',
  black: '#000000',
};

export interface CompositorOptions {
  width: number;
  height: number;
  backgroundBase64: string;
  overlay: OverlayContent;
  style?: string;
  variationIndex?: number;
}

/**
 * Main compositor function
 */
export async function compositeGraphic(options: CompositorOptions): Promise<string> {
  const { width, height, backgroundBase64, overlay, variationIndex = 0 } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // --- 1. BASE SETUP ---
  ctx.fillStyle = BRAND.cream;
  ctx.fillRect(0, 0, width, height);

  // FIX: specific baseline for top-down layout calculation
  ctx.textBaseline = 'top';

  // --- 2. BACKGROUND PATTERN WITH MASK ---
  // We want the pattern to be texture, not noise. 
  // We apply a "Radial Mask" to fade it out behind the text area if needed,
  // OR we just keep it subtle.
  ctx.save();
  // Draw pattern full
  await drawImageFull(ctx, backgroundBase64, width, height, 0.22); // Low opacity
  ctx.restore();

  // --- 3. RENDER CONTENT (Statement V2) ---
  // Variation 0: Left Aligned Lockup
  // Variation 1: Centered Lockup
  // Variation 2: Dynamic (Big Title Left, Info Right)
  const mode = variationIndex % 3;

  if (mode === 1) {
    await renderCenteredStatement(ctx, width, height, overlay);
  } else if (mode === 2) {
    await renderDynamicStatement(ctx, width, height, overlay);
  } else {
    await renderLeftStatement(ctx, width, height, overlay);
  }

  // Add Grain/Noise for polish
  drawNoise(ctx, width, height, 0.035);

  return canvas.toDataURL('image/png').split(',')[1];
}


// ============================================
// VARIATION 1: LEFT ALIGNED LOCKUP (The "Standard")
// ============================================
async function renderLeftStatement(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: OverlayContent
) {
  const margin = w * 0.08;
  const safeW = w - (margin * 2);

  // Grid:
  // Row 1: Logo + Title Lockup
  // Row 2: Subtitle
  // Row 3: Info (Bottom)

  let cursorY = h * 0.12;

  // --- LOGO + TITLE LOCKUP ---
  // If Logo exists, it sits TOP LEFT. Title sits below it? Or next to it?
  // "Lockup" usually means they relate. 
  // Let's try: Logo small top left. Title immediately below.

  if (content.logo.visible && content.logo.base64) {
    const logoTargetW = w * 0.14; // 14% width
    const logoTargetH = logoTargetW; // Assume square-ish
    await drawLogo(ctx, content.logo.base64, margin, cursorY, logoTargetW);
    cursorY += logoTargetH + (h * 0.05); // MORE GAP: Increased from 0.03 to 0.05
  } else {
    // If no logo, still start lower
    cursorY += h * 0.05;
  }

  // TITLE - Huge, Tight, Left
  if (content.title.visible) {
    ctx.textAlign = 'left';
    // Calculate optimal font size to fill width (approx)
    let fontSize = w * 0.15; // Start big
    // Check if title is long, scale down
    if (content.title.text.length > 20) fontSize = w * 0.11;

    setFont(ctx, 'title', fontSize);

    // Manual wrapping with tight leading
    const lines = wrapText(ctx, content.title.text, safeW * 0.95);

    // Draw cream background behind title text to ensure readability over illustration
    const titleBlockHeight = lines.length * (fontSize * 0.95) + 20;
    const titleBlockWidth = Math.max(...lines.map(line => ctx.measureText(line).width)) + 30;
    ctx.fillStyle = BRAND.cream;
    ctx.fillRect(margin - 15, cursorY - 10, titleBlockWidth, titleBlockHeight);

    // Now draw the text
    ctx.fillStyle = BRAND.charcoal;
    lines.forEach(line => {
      ctx.fillText(line, margin, cursorY);
      cursorY += fontSize * 0.95; // Tight leading
    });

    cursorY += h * 0.03;
  }

  // SEPARATOR LINE (Amber)
  ctx.fillStyle = BRAND.amber;
  ctx.fillRect(margin, cursorY, w * 0.15, 3);
  cursorY += h * 0.05;

  // SUBTITLE
  if (content.subtitle.visible) {
    // INLINE FONT SETTING to prevent helper bugs
    const subSize = Math.floor(w * 0.032); // ~3.2% strict
    ctx.font = `400 ${subSize}px Montserrat, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillStyle = BRAND.amberDark;

    // Increased line height padding
    const lineHeight = subSize * 1.4;

    const lines = wrapText(ctx, content.subtitle.text, safeW * 0.85);

    // Draw cream background behind subtitle text to ensure readability
    const subtitleBlockHeight = lines.length * lineHeight;
    const subtitleBlockWidth = Math.max(...lines.map(line => ctx.measureText(line).width)) + 20;
    ctx.fillStyle = BRAND.cream;
    ctx.fillRect(margin - 10, cursorY - 5, subtitleBlockWidth, subtitleBlockHeight + 10);

    // Now draw the text
    ctx.fillStyle = BRAND.amberDark;
    lines.forEach(line => {
      ctx.fillText(line, margin, cursorY);
      cursorY += lineHeight;
    });
  }

  // INFO (Bottom Left)
  if (content.infoBar.visible) {
    const infoY = h - margin - (h * 0.02);
    renderInfoBlock(ctx, margin, infoY, safeW, content.infoBar, 'left');
  }
}

// ============================================
// VARIATION 2: CENTERED LOCKUP (Formal)
// ============================================
async function renderCenteredStatement(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: OverlayContent
) {
  const margin = w * 0.08;
  const centerX = w / 2;
  let cursorY = h * 0.15; // visual optical center start

  // Logo Center Top
  if (content.logo.visible && content.logo.base64) {
    const logoSize = w * 0.15;
    await drawLogo(ctx, content.logo.base64, centerX - (logoSize / 2), cursorY, logoSize);
    cursorY += logoSize + (h * 0.05); // MORE GAP
  } else {
    cursorY += h * 0.05;
  }

  // Title Center
  if (content.title.visible) {
    ctx.textAlign = 'center';
    const fontSize = w * 0.12;
    setFont(ctx, 'title', fontSize);
    const lines = wrapText(ctx, content.title.text, w * 0.9);

    // Draw cream background behind title
    const titleBlockHeight = lines.length * fontSize + 20;
    const titleBlockWidth = Math.max(...lines.map(line => ctx.measureText(line).width)) + 40;
    ctx.fillStyle = BRAND.cream;
    ctx.fillRect(centerX - titleBlockWidth / 2, cursorY - 10, titleBlockWidth, titleBlockHeight);

    ctx.fillStyle = BRAND.charcoal;
    lines.forEach(line => {
      ctx.fillText(line, centerX, cursorY);
      cursorY += fontSize * 1.0;
    });
    cursorY += h * 0.03;
  }

  // Subtitle Center
  if (content.subtitle.visible) {
    const subSize = Math.floor(w * 0.032);
    ctx.font = `400 ${subSize}px Montserrat, sans-serif`;
    const lineHeight = subSize * 1.4;

    // Manual wrapping for center too? Usually short but safe to wrap
    const lines = wrapText(ctx, content.subtitle.text, w * 0.8);

    // Draw cream background behind subtitle
    const subtitleBlockHeight = lines.length * lineHeight + 10;
    const subtitleBlockWidth = Math.max(...lines.map(line => ctx.measureText(line).width)) + 30;
    ctx.fillStyle = BRAND.cream;
    ctx.fillRect(centerX - subtitleBlockWidth / 2, cursorY - 5, subtitleBlockWidth, subtitleBlockHeight);

    ctx.fillStyle = BRAND.amberDark;
    lines.forEach(line => {
      ctx.fillText(line, centerX, cursorY);
      cursorY += lineHeight;
    });
    cursorY += h * 0.04;
  }

  // Divider Center
  ctx.beginPath();
  ctx.moveTo(centerX - (w * 0.05), cursorY);
  ctx.lineTo(centerX + (w * 0.05), cursorY);
  ctx.strokeStyle = BRAND.amber;
  ctx.lineWidth = 2;
  ctx.stroke();
  cursorY += h * 0.04;

  // Info Center
  if (content.infoBar.visible) {
    renderInfoBlock(ctx, centerX, cursorY, w * 0.8, content.infoBar, 'center');
  }
}

// ============================================
// VARIATION 3: DYNAMIC (Asymmetric)
// ============================================
async function renderDynamicStatement(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: OverlayContent
) {
  const margin = w * 0.1;
  const safeW = w - (margin * 2);

  // Push everything down
  let cursorY = h * 0.25;

  // Title First (Massive)
  if (content.title.visible) {
    ctx.textAlign = 'left';
    let fontSize = w * 0.16;
    setFont(ctx, 'title', fontSize);

    const lines = wrapText(ctx, content.title.text, safeW);

    // Draw cream background behind title
    const titleBlockHeight = lines.length * (fontSize * 0.95) + 30;
    const titleBlockWidth = Math.max(...lines.map((line, i) => ctx.measureText(line).width + i * (w * 0.02))) + 40;
    ctx.fillStyle = BRAND.cream;
    ctx.fillRect(margin - 15, cursorY - 15, titleBlockWidth, titleBlockHeight);

    ctx.fillStyle = BRAND.charcoal;
    lines.forEach((line, i) => {
      // Stagger effect
      const offset = i * (w * 0.02);
      ctx.fillText(line, margin + offset, cursorY);
      cursorY += fontSize * 0.95;
    });
    cursorY += h * 0.04;
  }

  // Logo Small near title?
  if (content.logo.visible && content.logo.base64) {
    const logoSize = w * 0.10;
    // Position it absolute top right?
    const logoX = w - margin - logoSize;
    const logoY = margin;
    await drawLogo(ctx, content.logo.base64, logoX, logoY, logoSize);
  }

  // Subtitle Dynamic
  if (content.subtitle.visible) {
    const subSize = Math.floor(w * 0.032);
    ctx.font = `400 ${subSize}px Montserrat, sans-serif`;

    // Draw cream background behind subtitle
    const subtitleWidth = ctx.measureText(content.subtitle.text).width + 20;
    ctx.fillStyle = BRAND.cream;
    ctx.fillRect(margin + (w * 0.05) - 10, cursorY - 5, subtitleWidth, subSize * 1.5);

    ctx.fillStyle = BRAND.charcoal;
    ctx.fillText(content.subtitle.text, margin + (w * 0.05), cursorY);
  }

  // Info Bar - Right aligned at bottom
  if (content.infoBar.visible) {
    const infoY = h - margin;
    renderInfoBlock(ctx, w - margin, infoY, safeW, content.infoBar, 'right');
  }
}


// ============================================
// UTILS & HELPERS
// ============================================

function renderInfoBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number, // Bottom anchor Y usually
  w: number,
  info: OverlayContent['infoBar'],
  align: 'left' | 'center' | 'right'
) {
  // We render from bottom up? Or top down?
  // Let's render lines.
  const parts = [];
  if (info.date || info.time) parts.push(`${info.date} ${info.time ? '· ' + info.time : ''}`);
  if (info.location) parts.push(info.location);

  if (parts.length === 0) return;

  ctx.textAlign = align;
  // INCREASED FONT SIZE (Legibility fix)
  const fontSize = Math.max(44, w * 0.05);

  // Spacing
  const lineHeight = fontSize * 1.4;

  // Format
  ctx.font = `600 ${fontSize}px Montserrat, sans-serif`;

  // Pre-calculate lines to handle wrapping
  const allLines: string[] = [];
  parts.forEach(part => {
    // Use wrapText to ensure it fits within 'w'
    const lines = wrapText(ctx, part, w);
    allLines.push(...lines);
  });

  let curY = y;
  // If 'left' or 'right' (Dynamic), we treat y as the bottom anchor.
  if (align === 'left' || align === 'right') {
    // Move start Y up by total height so it ends at y
    const totalH = allLines.length * lineHeight;
    curY = y - totalH;
  }

  // Calculate background dimensions
  const totalHeight = allLines.length * lineHeight + 20;
  const maxLineWidth = Math.max(...allLines.map(line => ctx.measureText(line).width)) + 30;

  // Draw cream background behind info block
  ctx.fillStyle = BRAND.cream;
  if (align === 'left') {
    ctx.fillRect(x - 15, curY - 10, maxLineWidth, totalHeight);
  } else if (align === 'right') {
    ctx.fillRect(x - maxLineWidth + 15, curY - 10, maxLineWidth, totalHeight);
  } else {
    ctx.fillRect(x - maxLineWidth / 2, curY - 10, maxLineWidth, totalHeight);
  }

  // Draw text
  ctx.fillStyle = BRAND.charcoal;
  allLines.forEach(line => {
    ctx.fillText(line, x, curY);
    curY += lineHeight;
  });
}

function setFont(ctx: CanvasRenderingContext2D, type: 'title' | 'subtitle', size: number) {
  if (type === 'title') {
    ctx.font = `700 ${size}px "Playfair Display", serif`;
  } else {
    ctx.font = `400 ${size}px Montserrat, sans-serif`;
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

async function drawImageFull(ctx: CanvasRenderingContext2D, base64: string, w: number, h: number, alpha: number) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
      resolve();
    };
    img.onerror = () => {
      console.warn('Failed to load background image');
      resolve(); // Continue without the image
    };
    img.src = `data:image/png;base64,${base64}`;
  });
}

async function drawLogo(ctx: CanvasRenderingContext2D, base64: string, x: number, y: number, w: number) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const h = w * (img.height / img.width);
      ctx.drawImage(img, x, y, w, h);
      resolve();
    };
    img.onerror = () => {
      console.warn('Failed to load logo image');
      resolve(); // Continue without the logo
    };
    img.src = `data:image/png;base64,${base64}`;
  });
}

function drawNoise(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number) {
  const wN = 256;
  const hN = 256;
  const iData = ctx.createImageData(wN, hN);
  const buffer = new Uint32Array(iData.data.buffer);
  for (let i = 0; i < buffer.length; i++) {
    if (Math.random() < 0.5) buffer[i] = 0xff000000;
  }
  const off = document.createElement('canvas');
  off.width = wN;
  off.height = hN;
  off.getContext('2d')?.putImageData(iData, 0, 0);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  const patt = ctx.createPattern(off, 'repeat');
  if (patt) {
    ctx.fillStyle = patt;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

export async function preloadFonts() {
  await document.fonts.ready;
}
