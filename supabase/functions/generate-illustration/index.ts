/**
 * CASA Illustration Generator Edge Function
 * Genera ilustraciones estilo línea artística usando Nano Banana Pro (gemini-3-pro-image-preview)
 * Texto se genera con Claude Opus 4.5, imágenes con Nano Banana Pro
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Usar GOOGLE_AI_API_KEY que ya está configurado en Supabase secrets
const GEMINI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');

// Modelo: Nano Banana Pro para generación de imágenes
const IMAGE_MODEL = 'gemini-3-pro-image-preview';

// Request size limits — reject early to avoid DoS / quota drain.
// jsonPrompt is a JSON-stringified design spec (~5-15 KB typical).
// referenceImage is a base64-encoded PNG (logo ~100 KB, user-selected main
// cover ~1-3 MB). Cap generously above the expected max.
const MAX_JSON_PROMPT_BYTES = 50_000;          // 50 KB
const MAX_REFERENCE_IMAGE_BYTES = 6_000_000;   // ~6 MB base64 (≈ 4.5 MB raw)
const MAX_TOTAL_BODY_BYTES = 10_000_000;       // 10 MB hard ceiling on the whole body

// Build style prompt requesting pure white background
// The frontend will replace white pixels with the exact brand color
function buildStylePrompt(): string {
  return `Create a minimalist artistic illustration with these exact requirements:

COLORS (MANDATORY):
- Main lines: Medium gray (#666666)
- Accent color: Warm amber/gold (#D4A853) - USE THIS COLOR for highlights, key elements, or artistic accents
- Background: PURE WHITE (#FFFFFF) - solid flat white background, no texture, no pattern, no gradients

STYLE:
- Single continuous flowing line art in the style of Henri Matisse or Pablo Picasso
- Abstract and contemplative, suggestive of spiritual reflection
- Elegant, minimalist, with negative space
- The amber/gold accent should appear in at least 20-30% of the illustration

CRITICAL: No text, no labels, no words, no letters in the image. Pure white background only.`;
}

// Prompts específicos por tipo de evento
const EVENT_PROMPTS: Record<string, string> = {
  mesa_abierta: `People gathering around a table sharing food, communion, togetherness`,
  culto_dominical: `Church altar with cross, candles, and open book`,
  estudio_biblico: `Open Bible with reading lamp, coffee cup, and notebook`,
  retiro: `Mountain landscape with path, trees, and birds in flight`,
  navidad: `Nativity scene with stable, star, and manger`,
  cuaresma: `Cross with crown of thorns in desert landscape with sparse vegetation`,
  pascua: `Empty tomb at sunrise with lilies and garden flowers`,
  bautismo: `Water waves with dove, shell, and light rays from above`,
  comunidad: `Circle of people with joined hands around a central cross`,
  musica: `Musical notes, guitar or piano, and sound waves`,
  oracion: `Praying hands with candle flame and ascending light`,
  generic: `Celtic cross with church architecture, candles, and open doors`,
};

function buildPrompt(eventType: string): string {
  const eventPrompt = EVENT_PROMPTS[eventType] || EVENT_PROMPTS.generic;
  return `${buildStylePrompt()}\n\nSubject: ${eventPrompt}`;
}

/**
 * Valida que un string base64 sea una imagen válida
 * Soporta PNG (iVBOR) y JPEG (/9j/)
 */
function isValidImageBase64(base64: string): boolean {
  if (!base64 || typeof base64 !== 'string') return false;
  // PNG magic bytes en base64 empiezan con "iVBORw0KGgo"
  // JPEG magic bytes en base64 empiezan con "/9j/"
  return base64.startsWith('iVBORw0KGgo') || base64.startsWith('/9j/');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function unauthorized(detail: string): Response {
  return new Response(
    JSON.stringify({ error: 'Unauthorized', detail }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

function payloadTooLarge(detail: string): Response {
  return new Response(
    JSON.stringify({ error: 'Payload too large', detail }),
    { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY no está configurada');
    }

    // ── Auth: require a valid JWT. Platform-level verify_jwt=true (Supabase
    // default) guarantees the signature; we just need the user identity for
    // logging and to refuse anonymous callers.
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader) return unauthorized('Missing authorization header');

    const token = authHeader.replace(/^Bearer\s+/i, '');
    let userId = '';
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('malformed JWT');
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
      const decoded = JSON.parse(atob(padded));
      userId = decoded.sub ?? '';
      if (!userId) throw new Error('missing sub claim');
    } catch (err) {
      return unauthorized(`No se pudo leer el token: ${(err as Error).message}`);
    }

    // ── Body size cap: reject oversized payloads before JSON.parse to avoid
    // Deno-worker OOM. Content-Length is advisory; the field-level caps below
    // are the real enforcement for individual strings.
    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (contentLength > MAX_TOTAL_BODY_BYTES) {
      return payloadTooLarge(`Body exceeds ${MAX_TOTAL_BODY_BYTES} bytes`);
    }

    const { eventType = 'generic', count = 4, customPrompt, backgroundMode, jsonPrompt, referenceImage, referencePrompt, aspectRatio, refine } = await req.json();

    // ── Per-field size caps.
    if (typeof jsonPrompt === 'string' && jsonPrompt.length > MAX_JSON_PROMPT_BYTES) {
      return payloadTooLarge(`jsonPrompt exceeds ${MAX_JSON_PROMPT_BYTES} bytes`);
    }
    if (typeof referenceImage === 'string' && referenceImage.length > MAX_REFERENCE_IMAGE_BYTES) {
      return payloadTooLarge(`referenceImage exceeds ${MAX_REFERENCE_IMAGE_BYTES} bytes`);
    }

    // ── Magic-byte validation on referenceImage: confirm it's a real PNG/JPEG
    // before we forward it upstream to Gemini. Protects against payloads
    // disguised as base64 of arbitrary binary content.
    if (referenceImage !== undefined && referenceImage !== null) {
      if (typeof referenceImage !== 'string' || !isValidImageBase64(referenceImage)) {
        return new Response(
          JSON.stringify({ error: 'Invalid referenceImage', detail: 'Must be base64-encoded PNG or JPEG' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ── Refine mode: optional sibling to referenceImage. When present, runs a
    // single-image refinement pass against refine.sourceImage using minimal
    // change instructions derived from refine.feedback. Reuses the same
    // size-cap and magic-byte validation as referenceImage.
    const isRefine = refine !== undefined && refine !== null;
    if (isRefine) {
      if (typeof refine !== 'object' || typeof refine.sourceImage !== 'string' || typeof refine.feedback !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Invalid refine', detail: 'Must be { sourceImage: string, feedback: string }' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (refine.sourceImage.length > MAX_REFERENCE_IMAGE_BYTES) {
        return payloadTooLarge(`refine.sourceImage exceeds ${MAX_REFERENCE_IMAGE_BYTES} bytes`);
      }
      if (!isValidImageBase64(refine.sourceImage)) {
        return new Response(
          JSON.stringify({ error: 'Invalid refine.sourceImage', detail: 'Must be base64-encoded PNG or JPEG' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Refine mode forces a single output regardless of caller-supplied count.
    const effectiveCount = isRefine ? 1 : count;

    // Only forward aspectRatio when caller explicitly provides a valid value.
    // Omitting aspectRatio preserves prior behavior for callers that never passed it.
    const ALLOWED_ASPECT_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16'] as const;
    type AllowedAspectRatio = typeof ALLOWED_ASPECT_RATIOS[number];
    const forwardedAspectRatio: AllowedAspectRatio | undefined =
      typeof aspectRatio === 'string' && (ALLOWED_ASPECT_RATIOS as readonly string[]).includes(aspectRatio)
        ? (aspectRatio as AllowedAspectRatio)
        : undefined;

    const mode = isRefine ? 'refine' : referenceImage ? 'image-to-image' : jsonPrompt ? 'JSON prompt' : 'legacy';
    // Structural log — avoids echoing user-provided prompt/title/preacher content.
    console.log(
      `[generate-illustration] user=${userId} mode=${mode} eventType=${eventType} count=${effectiveCount}${forwardedAspectRatio ? ` aspectRatio=${forwardedAspectRatio}` : ''}`,
    );

    // Validate backgroundMode
    if (backgroundMode && backgroundMode !== 'solid' && backgroundMode !== 'transparent') {
      throw new Error('Invalid backgroundMode. Must be "solid", "transparent", or undefined.');
    }

    // Build prompt based on mode
    let prompt: string;

    if (isRefine) {
      // Refine mode: image-EDIT, not regeneration. The source image is the
      // anchor; we apply targeted modifications based on the user feedback.
      //
      // Critical: include any prompt context the caller passes (jsonPrompt or
      // customPrompt) so the model knows what the source image was originally
      // meant to be. Without that anchor, Gemini tends to over-interpret the
      // feedback and produce something unrelated — observed empirically when
      // a "use less amber + add a mother with her son" refine on a Día de la
      // Madre cover came back as an unrelated church scene with crosses.
      let contextPreamble = '';
      if (jsonPrompt) {
        const ctxText =
          typeof jsonPrompt === 'string' ? jsonPrompt : JSON.stringify(jsonPrompt);
        contextPreamble = `\n\nORIGINAL BRIEF (the source image was generated from this — preserve its intent unless the feedback overrides it):\n${ctxText}`;
      } else if (customPrompt) {
        contextPreamble = `\n\nORIGINAL BRIEF (the source image was generated from this — preserve its intent unless the feedback overrides it):\n${customPrompt}`;
      }
      prompt = `This is an IMAGE EDIT task, NOT a generation task. The image attached as the first inlineData part is the source. Your output MUST be the same image with only targeted modifications applied based on the user feedback below.\n\nUser feedback (modify the image accordingly):\n"${refine.feedback}"\n\nPreserve all unmentioned visual elements EXACTLY — subjects, composition, layout, lighting, typography, and color palette. Do NOT replace the image. Do NOT introduce new subjects unless the feedback explicitly requests them. Do NOT generate from scratch.${contextPreamble}`;
    } else if (referenceImage && referencePrompt) {
      // Image-to-image mode: recompose a reference image for a new aspect ratio
      prompt = referencePrompt;
    } else if (jsonPrompt && typeof jsonPrompt === 'string') {
      // JSON prompt mode: the frontend sends a pre-built structured prompt string
      // that includes text rendering instructions, brand kit, and editorial style.
      // The model will render text directly into the image.
      prompt = jsonPrompt;
    } else if (customPrompt) {
      // Legacy: custom prompt with style guardrails
      prompt = `${buildStylePrompt()}\n\nSubject: ${customPrompt}`;
    } else {
      // Legacy: event type prompt
      prompt = buildPrompt(eventType);
    }

    // Add transparency extraction hint if backgroundMode === 'transparent' (legacy mode only)
    if (backgroundMode === 'transparent' && !jsonPrompt && !referenceImage && !isRefine) {
      prompt += '\n\nIMPORTANT: The background MUST be PURE WHITE (#FFFFFF) with absolutely no texture, gradients, or patterns. This allows easy background extraction.';
    }

    // Intentionally omit prompt content from logs — it may contain user PII
    // (liturgy title, preacher name). Structural signal only.
    console.log(`[generate-illustration] promptBytes=${prompt.length}`);

    const illustrations: string[] = [];

    // Usar Nano Banana Pro (gemini-3-pro-image-preview) para generar ilustraciones.
    // API key moved from URL to header so it can never leak via echoed URLs in
    // upstream error messages.
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`;

    // Generar cada ilustración individualmente (Gemini genera una por request)
    const generateOne = async (index: number): Promise<string> => {
      try {
        // Build parts array — text-only or text+image depending on mode
        const parts: Array<Record<string, unknown>> = [];

        if (isRefine) {
          // Refine: source image in slot 0 + minimal change instructions.
          // Same inline-data shape as the referenceImage path.
          parts.push({
            inlineData: {
              mimeType: 'image/png',
              data: refine.sourceImage,
            }
          });
          parts.push({ text: prompt });
        } else if (referenceImage && typeof referenceImage === 'string') {
          // Image-to-image: send reference image + recomposition instructions
          parts.push({
            inlineData: {
              mimeType: 'image/png',
              data: referenceImage,
            }
          });
          parts.push({ text: prompt });
        } else {
          // Text-only generation (initial 4 options)
          parts.push({
            text: `${prompt}\n\nGenerate variation ${index + 1} of this illustration with slightly different composition.`
          });
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{
              parts,
            }],
            generationConfig: {
              responseModalities: ['Text', 'Image'],
              ...(forwardedAspectRatio ? { imageConfig: { aspectRatio: forwardedAspectRatio } } : {}),
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[generate-illustration] Error API (${index}):`, errorText);
          return '';
        }

        const data = await response.json();
        // Avoid dumping full response body — it contains base64 image data
        // (large) and potential echoed prompt content. Log structural signals
        // only.
        const hasCandidates = !!(data?.candidates && data.candidates.length > 0);
        console.log(`[generate-illustration] Respuesta ${index}: hasCandidates=${hasCandidates}`);

        // Extraer imagen de la respuesta de Gemini
        // Formato: data.candidates[0].content.parts[].inlineData.data
        if (data.candidates && data.candidates[0]?.content?.parts) {
          for (const part of data.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              const base64 = part.inlineData.data;
              if (isValidImageBase64(base64)) {
                console.log(`[generate-illustration] Imagen ${index} generada correctamente`);
                return base64;
              }
            }
          }
        }

        console.log(`[generate-illustration] No se encontró imagen en respuesta ${index}`);
        return '';
      } catch (err) {
        console.error(`[generate-illustration] Error generando imagen ${index}:`, err);
        return '';
      }
    };

    // Generar todas las ilustraciones en paralelo
    const promises = [];
    for (let i = 0; i < Math.min(effectiveCount, 4); i++) {
      promises.push(generateOne(i));
    }

    const results = await Promise.all(promises);

    // Filtrar resultados válidos
    for (const base64 of results) {
      if (isValidImageBase64(base64)) {
        illustrations.push(base64);
      }
    }

    const validCount = illustrations.length;
    console.log(`[generate-illustration] ${validCount}/${effectiveCount} ilustraciones válidas`);

    // Si no se generaron suficientes, rellenar con vacíos
    while (illustrations.length < effectiveCount) {
      illustrations.push('');
    }

    return new Response(
      JSON.stringify({
        illustrations,
        validCount,
        requestedCount: effectiveCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[generate-illustration] Error:', error);
    const message = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({
        error: message || 'Error generando ilustraciones',
        illustrations: ['', '', '', ''],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
