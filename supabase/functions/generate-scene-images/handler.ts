/**
 * CASA Scene Image Generator — request handler.
 *
 * Genera imágenes para escenas de cuentos usando la familia Gemini Image:
 *  - flash (default): gemini-3.1-flash-image (Nano Banana 2) — borradores/escenas
 *  - pro: gemini-3-pro-image (Nano Banana Pro) — portada/fin/refinamientos
 * Soporta imágenes de referencia para consistencia de personajes, lugares y objetos.
 *
 * Extracted from `index.ts` (FASE F) so it can be imported by tests without
 * starting a server, reading the environment, or hitting the network.
 * `index.ts` is the only place that constructs production dependencies and
 * calls `serve()`.
 *
 * Auth: OPTIONS is handled before the guard for CORS preflight. Every other
 * method must pass `requireLiturgyWriter` BEFORE the handler reads the body,
 * downloads any image, or calls Gemini. Fail-closed by design.
 */

import {
  requireLiturgyWriter,
  type RequirePermissionDeps,
} from '../_shared/liturgyAuth.ts';
import {
  bodyShape,
  charCount,
  collectSceneImageRefs,
  DEFAULT_IMAGE_LIMITS,
  imageErrorResponse,
  describeError,
  imageFieldOf,
  ImageRefError,
  type ImageLimits,
  isRefineRequested,
  isSceneRequestType,
  listShape,
  type MaterializedImage,
  materializeImageRefs,
  prevalidateImageRefs,
  readBoundedJson,
  sceneImageReadSet,
  type SkippedImage,
  UNAVAILABLE_CODES,
} from '../_shared/imageFetch.ts';

export interface HandlerDeps {
  /** GOOGLE_AI_API_KEY. Empty/absent => the handler reports a config error. */
  apiKey: string;
  /** Model id for the `flash` tier (env override at the entrypoint). */
  flashModel: string;
  /** Model id for the `pro` tier (env override at the entrypoint). */
  proModel: string;
  /** Injectable authz backend for the shared fail-closed guard. */
  authzDeps: RequirePermissionDeps;
  /** SUPABASE_URL — pins the one bucket origin image URLs may come from. */
  supabaseUrl: string;
  /** Overridable in tests; production uses `DEFAULT_IMAGE_LIMITS`. */
  imageLimits?: ImageLimits;
}

type ModelTier = 'flash' | 'pro';

interface ModelConfig {
  apiKey: string;
  flashModel: string;
  proModel: string;
}

function resolveModel(tier: ModelTier, config: ModelConfig): string {
  return tier === 'pro' ? config.proModel : config.flashModel;
}

const MODEL_TIMEOUT_MS: Record<ModelTier, number> = {
  flash: 60_000,
  pro: 150_000,
};

/**
 * Un intento de reintento en 429/5xx/timeout con backoff corto (respeta Retry-After).
 */
async function fetchGeminiWithRetry(
  apiUrl: string,
  apiKey: string,
  body: unknown,
  timeoutMs: number
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 15_000)
          : 2_000 + Math.random() * 3_000;
        console.warn(`[generate-scene-images] Gemini ${response.status}, reintentando en ${Math.round(delayMs)}ms`);
        await response.body?.cancel();
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      return response;
    } catch (err) {
      lastErr = err;
      if (attempt === 0) {
        console.warn(`[generate-scene-images] Error de red/timeout, reintentando: ${describeError(err)}`);
        await new Promise((r) => setTimeout(r, 2_000 + Math.random() * 3_000));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// Estilos de ilustración con sus prompts
const ILLUSTRATION_STYLES: Record<string, string> = {
  'ghibli': 'Studio Ghibli animation style, soft watercolor backgrounds, detailed natural environments, warm lighting, whimsical atmosphere, hand-drawn aesthetic',
  'pixar': 'Pixar 3D animation style, expressive characters, vibrant colors, cinematic lighting, detailed textures, emotional storytelling',
  'disney-classic': 'Classic Disney 2D animation style, golden age aesthetic, fluid lines, warm colors, fairytale atmosphere, hand-painted backgrounds',
  'dreamworks': 'DreamWorks animation style, dynamic poses, bold colors, expressive faces, cinematic composition, playful energy',
  'storybook': "Children's storybook illustration style, soft pastel colors, gentle brushstrokes, cozy atmosphere, whimsical details, picture book aesthetic",
  'watercolor': "Children's watercolor illustration, soft washes, gentle colors, dreamy atmosphere, delicate lines, artistic and tender",
  'eric-carle': 'Eric Carle collage illustration style, bold colors, textured paper cutouts, simple shapes, vibrant and playful, The Very Hungry Caterpillar aesthetic',
  'quentin-blake': 'Quentin Blake illustration style, loose pen and ink drawings, energetic lines, splashes of watercolor, whimsical and expressive characters, Roald Dahl book aesthetic',
  'papercut': 'Paper cut-out illustration style, layered paper effect, soft shadows, colorful shapes, handcrafted aesthetic, dimensional depth',
  'claymation': 'Claymation stop-motion style, 3D clay figures, textured surfaces, warm lighting, handcrafted charm, Aardman animation aesthetic',
  'folk-art': 'Latin American folk art style, vibrant colors, decorative patterns, naive art aesthetic, cultural motifs, warm and festive',
  'anime-soft': 'Soft anime illustration style, big expressive eyes, pastel colors, gentle lighting, kawaii aesthetic, heartwarming atmosphere',
  'cartoon-network': 'Modern cartoon style, bold outlines, flat colors, geometric shapes, playful proportions, Adventure Time / Steven Universe aesthetic',
  'beatrix-potter': 'Beatrix Potter illustration style, detailed naturalistic animals, soft watercolors, English countryside aesthetic, gentle and refined, Peter Rabbit style',
};

interface Character {
  name: string;
  visualDescription: string;
  referenceImage?: string;
}

/**
 * Local mirror of GenerateSceneImagesRefine in src/types/shared/story.ts.
 * Edge functions cannot import app types, so this shape must be kept in sync
 * with Phase 1. When present on a request, the handler forces exactly one
 * generated image and uses sourceImage as slot 0 of the Gemini inlineData parts.
 */
interface Refine {
  sourceImage: string;
  feedback: string;
}

const REFINE_INSTRUCTION_TEMPLATE =
  'REFINE THE PROVIDED IMAGE according to this feedback: `{feedback}`. Preserve all unmentioned visual elements (composition, lighting, characters, style, color palette) exactly. The reference images that follow are character / landmark / prop references — keep them visually consistent with the source image.';

interface Landmark {
  name: string;
  visualDescription: string;
  referenceImages: string[];  // base64 data URLs or URLs
}

interface Prop {
  name: string;
  visualDescription: string;
  referenceImages: string[];  // base64 data URLs or URLs
}

interface Scene {
  text: string;
  visualDescription: string;
  landmarkVisible?: boolean;
}

interface Location {
  name: string;
  description: string;
}

function detectCharactersInScene(
  scene: Scene,
  characters: Character[]
): Character[] {
  const sceneText = `${scene.text} ${scene.visualDescription}`.toLowerCase();

  return characters.filter(character => {
    const charName = character.name.toLowerCase();
    const nameVariations = [
      charName,
      charName.replace(/^el\s+/i, ''),
      charName.replace(/^la\s+/i, ''),
      charName.replace(/^los\s+/i, ''),
      charName.replace(/^las\s+/i, ''),
      charName.replace(/^un\s+/i, ''),
      charName.replace(/^una\s+/i, ''),
    ];

    return nameVariations.some(variation =>
      variation.length > 2 && sceneText.includes(variation)
    );
  });
}

function buildPropReferenceLines(props: Prop[]): string {
  if (!props || props.length === 0) return '';
  const lines = props.map(p =>
    `PROP REFERENCE — "${p.name}": ${p.visualDescription}. Render EXACTLY as shown in reference photos; architectural / structural / material details must match precisely.`
  );
  return `\n\n${lines.join('\n')}`;
}

function buildScenePrompt(
  styleId: string,
  scene: Scene,
  charactersInScene: Character[],
  location: Location,
  landmarks?: Landmark[],
  props?: Prop[]
): string {
  const stylePrompt = ILLUSTRATION_STYLES[styleId] || ILLUSTRATION_STYLES['storybook'];

  const characterDescriptions = charactersInScene.length > 0
    ? charactersInScene.map(c => `- ${c.name}: ${c.visualDescription}`).join('\n')
    : 'No specific characters in this scene';

  const referenceInstruction = charactersInScene.some(c => c.referenceImage)
    ? `\n\nIMPORTANT: Use the reference images provided to maintain EXACT visual consistency for each character. The characters must look IDENTICAL to their reference images in terms of: clothing, hair color/style, facial features, body proportions, and any distinctive features.`
    : '';

  // Include landmark info if visible in this scene
  const visibleLandmarks = (landmarks || []).filter((lm) => scene.landmarkVisible && lm.visualDescription);
  const landmarkSection = visibleLandmarks.length > 0
    ? `\n\nLANDMARK/BUILDING visible in this scene (reference photos provided - render FAITHFULLY):
${visibleLandmarks.map(lm => `- ${lm.name}: ${lm.visualDescription}`).join('\n')}

CRITICAL: The landmark/building MUST be rendered with EXACT architectural details matching the reference photos. Copy the shape, colors, materials, windows, doors, and all distinctive features precisely. The landmark should be immediately recognizable to someone who knows the real building.`
    : '';

  const propSection = buildPropReferenceLines(props || []);

  return `${stylePrompt}

Scene description: ${scene.visualDescription}

Scene narrative: "${scene.text}"

Location: ${location.name}, Chile. ${location.description}

Characters that appear in THIS scene (ONLY these characters should be shown):
${characterDescriptions}
${referenceInstruction}
${landmarkSection}${propSection}

CRITICAL instructions:
- ONLY show the characters listed above - no other characters should appear
- Do NOT redesign any character, landmark or prop: match their canonical descriptions and reference images exactly, in every detail
- Bright, well-lit scene (this will be projected in a room with natural light)
- Child-friendly imagery appropriate for ages 5-10
- **ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO WRITING OF ANY KIND IN THE IMAGE** - This is extremely important, the image must be purely visual with zero text elements
- Cinematic composition with good framing
- Warm, inviting atmosphere
- Focus on the emotional moment described in the scene
- If reference images are provided, the characters MUST look exactly like their references${visibleLandmarks.length > 0 ? '\n- The landmark/building MUST match the provided reference photos exactly' : ''}${(props && props.length > 0) ? '\n- Props listed above MUST match their reference photos exactly in shape, colors, materials, and distinctive details' : ''}
- Do not include any signs, labels, captions, titles, or any form of written text
`.trim();
}

function buildCharacterSheetPrompt(
  styleId: string,
  character: { name: string; description: string; visualDescription: string }
): string {
  const stylePrompt = ILLUSTRATION_STYLES[styleId] || ILLUSTRATION_STYLES['storybook'];

  return `${stylePrompt}

Character design sheet, full body view, white background.

Character: ${character.visualDescription}

The character should be shown in a neutral standing pose, facing slightly to the side, with a friendly expression. Show the full body from head to toe. Clean white background with no other elements.

Important:
- Bright, well-lit image
- Child-friendly appearance
- Expressive but not exaggerated features
- **ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO LABELS** - the image must contain zero text elements
- Suitable for children ages 5-10
- Pure visual illustration only
`.trim();
}

/**
 * Hoja de referencia canónica para un lugar u objeto recurrente, análoga al
 * character sheet: lugares → plano general (establishing shot); objetos →
 * toma de producto sobre fondo neutro. Se genera en el estilo del cuento y
 * luego se adjunta como referencia a cada escena donde aparece.
 */
function buildPropSheetPrompt(
  styleId: string,
  prop: { name: string; kind: 'location' | 'prop'; visualDescription: string }
): string {
  const stylePrompt = ILLUSTRATION_STYLES[styleId] || ILLUSTRATION_STYLES['storybook'];

  const subjectInstructions = prop.kind === 'location'
    ? `Establishing shot of a location, wide view showing the full place clearly.

Location: ${prop.visualDescription}

Show the location from a slightly elevated three-quarter view in neutral daylight, with all its distinctive architectural/natural features fully visible. No people, no animals, no characters — the location alone.`
    : `Reference sheet of a single object, product-shot style.

Object: ${prop.visualDescription}

Show the object centered on a plain, light neutral background, three-quarter view, evenly lit, with all its distinctive details, colors and materials clearly visible. No people, no animals, no characters — the object alone.`;

  return `${stylePrompt}

${subjectInstructions}

Important:
- This image will be used as the canonical visual reference for "${prop.name}" across every illustration of a children's story — every distinctive detail must be clear and unambiguous
- Bright, well-lit image
- **ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO LABELS** - the image must contain zero text elements
- Suitable for children ages 5-10
- Pure visual illustration only
`.trim();
}

function buildCoverPrompt(
  styleId: string,
  title: string,
  protagonist: { visualDescription: string },
  location: Location
): string {
  const stylePrompt = ILLUSTRATION_STYLES[styleId] || ILLUSTRATION_STYLES['storybook'];

  return `${stylePrompt}

Book cover illustration for a children's story titled "${title}".

The image should show the main character:
${protagonist.visualDescription}

Setting: ${location.name}, Chile. ${location.description}

The title "${title}" should appear at the top in a friendly, readable children's book font.

Important:
- Bright, colorful, and inviting
- The character should look friendly and approachable
- Include visual elements from the story's setting
- Professional children's book cover composition
- Child-friendly, suitable for ages 5-10
`.trim();
}

function buildEndPrompt(styleId: string): string {
  const stylePrompt = ILLUSTRATION_STYLES[styleId] || ILLUSTRATION_STYLES['storybook'];

  return `${stylePrompt}

Simple, elegant end card for a children's story.

The word "Fin" in a decorative but readable children's book font, centered.

Decorated with subtle, child-friendly ornamental elements like small stars, leaves, or simple flourishes.

Warm, soft background color. Bright and cheerful mood.

No characters, just the text and decorative elements.
`.trim();
}

// Marcadores de referencias "de estilo/escenario" (no de personaje): guían
// estilo, composición o locación en vez de la identidad de un personaje.
const STYLE_REF_MARKERS = [
  'SCENE STYLE REFERENCE',
  'SAME-LOCATION REFERENCE',
  'COVER STYLE REFERENCE',
  'END STYLE REFERENCE',
];

function isStyleReferenceDesc(desc?: string): boolean {
  return !!desc && STYLE_REF_MARKERS.some((marker) => desc.includes(marker));
}

function isValidImageBase64(base64: string): boolean {
  if (!base64 || typeof base64 !== 'string') return false;
  return base64.startsWith('iVBORw0KGgo') || base64.startsWith('/9j/') || base64.startsWith('UklGR');
}

async function generateImage(
  prompt: string,
  variation: number = 0,
  referenceImages: string[] = [],
  characterDescriptions: string[] = [],
  refine: Refine | undefined,
  modelTier: ModelTier,
  config: ModelConfig
): Promise<string> {
  const model = resolveModel(modelTier, config);
  // The key travels in a header, not the query string: runtime network errors
  // embed the request URL in their message, so `?key=` put the secret one
  // console.error away from the logs.
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    console.log(`[generateImage] Starting with ${referenceImages.length} reference images, variation ${variation}, refine=${!!refine}`);

    let imagesAdded = 0;

    if (refine && isValidImageBase64(refine.sourceImage)) {
      const refineMime = refine.sourceImage.startsWith('/9j/')
        ? 'image/jpeg'
        : refine.sourceImage.startsWith('UklGR')
          ? 'image/webp'
          : 'image/png';
      parts.push({
        text: 'REFINE SOURCE IMAGE — This is the existing image to refine. It is provided as the FIRST inlineData part. Use it as the base; modify ONLY what the user feedback requests.',
      });
      parts.push({ inlineData: { mimeType: refineMime, data: refine.sourceImage } });
      imagesAdded++;
      console.log(`[generateImage] Added refine source image as slot 0 (${refineMime})`);
    } else if (refine) {
      console.warn('[generateImage] refine.sourceImage missing or invalid base64 — proceeding without refine source');
    }

    const hasSceneRef = isStyleReferenceDesc(characterDescriptions[0]);
    const hasLandmarkRef = characterDescriptions.some(d => d?.includes('LANDMARK REFERENCE'));

    if (referenceImages.length > 0) {

      let refInstruction: string;
      if (hasSceneRef) {
        refInstruction = `CRITICAL REFERENCE IMAGES:
The FIRST image is a SCENE STYLE REFERENCE - use it to guide the visual style, composition, lighting, colors, and atmosphere of the generated scene.
${referenceImages.length > 1 ? `The remaining ${referenceImages.length - 1} image(s) show the EXACT appearance of characters${hasLandmarkRef ? ' and/or landmarks/buildings' : ''}.` : ''}

For character references, you MUST copy these visual details EXACTLY:
- Face shape, features, and expression style
- Hair color, style, and length
- Skin tone and body proportions
- Clothing colors, patterns, and style
- Any distinctive accessories or features
${hasLandmarkRef ? `
For LANDMARK/BUILDING references, you MUST copy these architectural details EXACTLY:
- Overall shape, proportions, and structure
- Colors of walls, roof, doors, windows
- Distinctive architectural features (towers, arches, columns, etc.)
- Materials and textures
- The landmark must be IMMEDIATELY RECOGNIZABLE to someone who knows the real building` : ''}

Study each reference carefully before generating.`;
      } else {
        const charCount = characterDescriptions.filter(d => !d?.includes('LANDMARK REFERENCE')).length;
        const landmarkCount = characterDescriptions.filter(d => d?.includes('LANDMARK REFERENCE')).length;
        refInstruction = `CRITICAL REFERENCE IMAGES:
The following ${referenceImages.length} image(s) show the EXACT appearance of ${charCount > 0 ? `characters` : ''}${charCount > 0 && landmarkCount > 0 ? ' and ' : ''}${landmarkCount > 0 ? 'landmarks/buildings' : ''} that must appear in the generated scene.

For CHARACTER references, you MUST copy these visual details EXACTLY:
- Face shape, features, and expression style
- Hair color, style, and length
- Skin tone and body proportions
- Clothing colors, patterns, and style
- Any distinctive accessories or features
${hasLandmarkRef ? `
For LANDMARK/BUILDING references, you MUST copy these architectural details EXACTLY:
- Overall shape, proportions, and structure
- Colors of walls, roof, doors, windows
- Distinctive architectural features (towers, arches, columns, etc.)
- Materials and textures
- The landmark must be IMMEDIATELY RECOGNIZABLE to someone who knows the real building` : ''}

Study each reference carefully before generating. All subjects in your output MUST be visually identical to their references.`;
      }

      parts.push({ text: refInstruction });

      for (let i = 0; i < referenceImages.length && i < 14; i++) {
        const imgData = referenceImages[i];
        const isSceneRef = isStyleReferenceDesc(characterDescriptions[i]);
        // Size and role only — never a base64 prefix (invariant 11).
        console.log(`[generateImage] Reference image ${i + 1}: length=${imgData?.length || 0}, isSceneRef=${isSceneRef}`);

        if (isValidImageBase64(imgData)) {
          const mimeType = imgData.startsWith('/9j/') ? 'image/jpeg' : imgData.startsWith('UklGR') ? 'image/webp' : 'image/png';

          if (characterDescriptions[i]) {
            const isLandmarkRef = characterDescriptions[i]?.includes('LANDMARK REFERENCE');
            const isPropRef = characterDescriptions[i]?.includes('PROP REFERENCE');
            if (isSceneRef) {
              // La descripción trae la instrucción correcta según el tipo de
              // referencia (estilo, misma locación/pov, portada, fin).
              parts.push({ text: characterDescriptions[i] });
            } else if (isLandmarkRef) {
              parts.push({ text: `LANDMARK/BUILDING REFERENCE IMAGE - Render this building EXACTLY as shown, copying all architectural details: ${characterDescriptions[i]}` });
            } else if (isPropRef) {
              parts.push({ text: `PROP REFERENCE IMAGE - Render this prop EXACTLY as shown, copying all structural and material details: ${characterDescriptions[i]}` });
            } else {
              parts.push({ text: `Character reference ${i + 1} - ${characterDescriptions[i]}:` });
            }
          }

          parts.push({
            inlineData: {
              mimeType,
              data: imgData
            }
          });
          imagesAdded++;
          console.log(`[generateImage] Added reference image ${i + 1} as ${mimeType}, isSceneRef=${isSceneRef}`);
        } else {
          console.log(`[generateImage] Reference image ${i + 1} INVALID - not PNG/JPEG base64`);
        }
      }
    }

    console.log(`[generateImage] Total images added to request: ${imagesAdded}`);

    let finalPrompt = prompt;

    if (imagesAdded > 0) {
      if (hasSceneRef) {
        finalPrompt = `CRITICAL: You MUST use the STYLE REFERENCE IMAGE above to match the visual style, color palette, lighting, and artistic atmosphere. Generate a scene that looks like it belongs in the same visual world as the reference.

${prompt}`;
      } else {
        finalPrompt = `REMEMBER: The characters MUST match the reference images provided above EXACTLY.

${prompt}`;
      }
    }

    if (variation > 0) {
      if (imagesAdded > 0 && isStyleReferenceDesc(characterDescriptions[0])) {
        finalPrompt += `\n\nGenerate variation ${variation} with slightly different composition and poses, but MAINTAIN THE SAME VISUAL STYLE as the reference image - same color palette, same lighting style, same artistic atmosphere.`;
      } else {
        finalPrompt += `\n\nGenerate variation ${variation} with slightly different composition, poses, and background details. However, the characters MUST remain VISUALLY IDENTICAL to their reference images - same face, same hair, same clothes, same colors.`;
      }
    }

    parts.push({ text: finalPrompt });

    const textParts = parts.filter(p => p.text).length;
    const imageParts = parts.filter(p => p.inlineData).length;
    console.log(`[generateImage] Sending request to Gemini with ${parts.length} total parts: ${textParts} text, ${imageParts} images`);

    const response = await fetchGeminiWithRetry(
      apiUrl,
      config.apiKey,
      {
        contents: [{
          parts
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '4:3',
          },
        },
      },
      MODEL_TIMEOUT_MS[modelTier]
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[generate-scene-images] API Error (${response.status}): ${bodyShape(errorText)}`);
      throw new Error(`Gemini API error: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();

    // The raw response embeds inlineData base64; log its shape, not its bytes.
    console.log(`[generate-scene-images] API response keys:`, Object.keys(data).join(', '));

    if (data.error) {
      console.error(`[generate-scene-images] API returned error: ${bodyShape(JSON.stringify(data.error))}`);
      throw new Error(`Gemini error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    if (data.promptFeedback?.blockReason) {
      console.error(`[generate-scene-images] Content blocked: ${charCount(data.promptFeedback.blockReason)}`);
      throw new Error(`Content blocked by Gemini: ${data.promptFeedback.blockReason}`);
    }

    if (data.candidates && data.candidates[0]?.content?.parts) {
      console.log(`[generate-scene-images] Found ${data.candidates[0].content.parts.length} parts in response`);
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          const base64 = part.inlineData.data;
          console.log(`[generate-scene-images] Found inlineData, length: ${base64.length}`);
          if (isValidImageBase64(base64)) {
            return base64;
          } else {
            console.log(`[generate-scene-images] Invalid base64 format`);
          }
        } else if (part.text) {
          console.log(`[generate-scene-images] Found text part: ${charCount(part.text)}`);
        }
      }
    } else {
      console.log(`[generate-scene-images] No candidates or parts found. Data keys:`, Object.keys(data));
      if (data.candidates) {
        console.log(`[generate-scene-images] Candidate count:`, data.candidates.length);
      }
    }

    console.log(`[generate-scene-images] No valid image found in response`);
    return '';
  } catch (err) {
    console.error(`[generate-scene-images] Error in generateImage: ${describeError(err)}`);
    throw err;
  }
}

/** Client-facing message for a provider response that produced no image. */
export const NO_IMAGE_ERROR = 'El servicio de imágenes no devolvió una imagen.';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function createHandler(
  deps: HandlerDeps,
): (req: Request) => Promise<Response> {
  const config: ModelConfig = {
    apiKey: deps.apiKey,
    flashModel: deps.flashModel,
    proModel: deps.proModel,
  };
  const limits: ImageLimits = deps.imageLimits ?? DEFAULT_IMAGE_LIMITS;
  // Checked once here, not per-request after the downloads: the key is
  // constant per deployment, and running pass 1/pass 2 first meant a
  // misconfigured function burned Storage egress and then reported an
  // image-level error instead of the real fault.
  const missingApiKey = !deps.apiKey;

  return async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // F0 fail-closed authz: runs BEFORE req.json(), any download, Storage, or the
  // provider. Missing/invalid token => 401, denied => 403, backend error => 503.
  const authz = await requireLiturgyWriter(req, deps.authzDeps, corsHeaders);
  if (!authz.ok) {
    return authz.response;
  }

  if (missingApiKey) {
    console.error('[generate-scene-images] GOOGLE_AI_API_KEY no está configurada');
    return new Response(
      JSON.stringify({
        success: false,
        error: 'El servicio de imágenes no está configurado.',
        images: [],
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // FASE F pass 1 + pass 2. Both run before the first Gemini call: a single
  // untrusted image entry anywhere in the request means zero Storage fetches
  // and zero provider spend (T-F.9).
  //
  // This whole block sits INSIDE the try that produces the JSON+CORS error
  // response. An earlier shape rethrew non-ImageRefError failures from a catch
  // that sat outside it, so a client disconnecting mid-upload escaped the
  // handler entirely and `serve` answered with CORS-less plain text.
  //
  // `skippedImages` is declared OUTSIDE that try for the same reason the story
  // handler does it: drops are recorded during the image phase and reported by
  // a response written much later, so an escalating failure in between used to
  // discard the report. The scene envelope had the identical hole.
  let skippedImages: Array<{ field: string; code: string }> = [];

  try {
    // Client JSON. The pre-FASE-F `await req.json()` typed this `any` and the
    // switch below relies on that; keeping the same shape confines this change
    // to the image path rather than cascading into every unrelated field.
    // deno-lint-ignore no-explicit-any
    let requestData: any;
    let sourceImages: Map<string, MaterializedImage>;
    let skipped: SkippedImage[];
    try {
      requestData = await readBoundedJson(req, limits);

      // `limits` reaches the collector too: the slot ceiling is enforced
      // DURING traversal, so a pathological array is cut off instead of being
      // copied in full and rejected afterwards.
      const prevalidated = prevalidateImageRefs(collectSceneImageRefs(requestData, limits), {
        limits,
        supabaseUrl: deps.supabaseUrl,
      });
      const result = await materializeImageRefs(prevalidated, { limits });
      sourceImages = result.images;
      skipped = result.skipped;
    } catch (err) {
      if (err instanceof ImageRefError) {
        console.warn(
          `[generate-scene-images] request rejected: ${err.code} at ${err.path}`,
        );
        return imageErrorResponse(err, corsHeaders, { images: [] });
      }
      throw err;
    }

    // Unusable individual images do not fail the request: the entry is dropped
    // and generation continues, which is what the pre-FASE-F code did by
    // returning '' and filtering. Provenance and size failures never reach
    // here — those threw above.
    if (skipped.length > 0) {
      console.warn(
        `[generate-scene-images] ${skipped.length} image(s) skipped: ` +
          skipped.map((s) => `${s.path}=${s.code}`).join(', '),
      );
    }
    // Reported to the client, not just the log: a reference silently missing
    // from the generation is indistinguishable from one that was used.
    skippedImages = skipped.map((s) => ({ field: s.path, code: s.code }));

    // The SAME consumption plan pass 1 used. Reading through it is what keeps
    // the collector's `consumed` flag from being parallel bookkeeping: a field
    // this request type does not read is not collected as consumed, not
    // fetched, not charged — and not readable here either. Severing one entry
    // of the plan therefore breaks the collector and this branch together,
    // which is the only way "these two agree" is a testable claim.
    const reads = sceneImageReadSet(requestData);

    /** The request type for logs: the branch name, or `desconocido`. */
    const safeType = (value: unknown): string =>
      isSceneRequestType(value) ? value : 'desconocido';

    /**
     * The scene-reference mode for logs: the enum value, or `desconocido`.
     * The field's domain is `'style' | 'pov'` (the only value the consumer
     * at the scene-ref instruction checks is `'pov'`; everything else is
     * treated as style — logging keeps that tolerance, it just stops
     * quoting the raw value).
     */
    const safeMode = (value: unknown): string =>
      value === 'style' || value === 'pov' ? value : 'desconocido';

    /** Base64 for a validated slot, or '' when absent, skipped, or unread. */
    const takeImage = (path: string): string => {
      const field = imageFieldOf(path);
      if (!reads.has(field)) {
        // Fail closed and say so in shape terms. Reaching this means a branch
        // reads a field the plan does not list — a drift the plan exists to
        // make loud rather than silently expensive.
        console.warn(
          `[generate-scene-images] field not in the consumption plan for this request; ignored`,
          { field, type: safeType(requestData?.type) },
        );
        return '';
      }
      return sourceImages.get(path)?.base64 ?? '';
    };

    const { type, styleId, count = 2 } = requestData;
    const modelTier: ModelTier = requestData.modelTier === 'pro' ? 'pro' : 'flash';
    const rawRefine = requestData.refine;
    const refineRequested = isRefineRequested(requestData);
    const refine: Refine | undefined =
      refineRequested && typeof rawRefine.sourceImage === 'string'
        ? { sourceImage: rawRefine.sourceImage, feedback: rawRefine.feedback }
        : undefined;

    // Fail closed on a refine whose source is not even a string. Falling
    // through with `refine === undefined` turned the request into a full
    // regeneration from scratch — silently discarding the image the user
    // asked to refine, which is the exact failure invariant 11 forbids.
    if (refineRequested && !refine) {
      console.warn('[generate-scene-images] refine source is not a string — refusing');
      return imageErrorResponse(
        new ImageRefError(
          'REFINE_SOURCE_UNAVAILABLE',
          'refine.sourceImage',
          'La imagen a refinar no está disponible.',
        ),
        corsHeaders,
        { images: [], skippedImages },
      );
    }

    // Refine fail-closed (invariant 11): the editor swaps base64→URL after every
    // save, so the image to refine usually arrives as a bucket URL. If it cannot
    // be materialised we refuse the request instead of silently regenerating
    // from scratch — the client preserves the selection and can say so.
    if (refine) {
      const source = takeImage('refine.sourceImage');
      if (!source) {
        // Report WHY. A source that was too large to download is a size
        // problem the user can act on; only a genuinely unproducible object
        // is "unavailable". Collapsing both into REFINE_SOURCE_UNAVAILABLE
        // told someone with an oversized cover to check its availability.
        const reason = skipped.find((s) => s.path === 'refine.sourceImage');
        if (reason && !UNAVAILABLE_CODES.has(reason.code)) {
          const precise = new ImageRefError(
            reason.code,
            'refine.sourceImage',
            reason.code === 'NOT_IMAGE'
              ? 'El formato de la imagen a refinar no es compatible (usa PNG, JPEG o WebP).'
              : 'La imagen a refinar supera el tamaño permitido.',
          );
          console.warn(`[generate-scene-images] refine source rejected: ${reason.code}`);
          return imageErrorResponse(precise, corsHeaders, { images: [], skippedImages });
        }
        const err = new ImageRefError(
          'REFINE_SOURCE_UNAVAILABLE',
          'refine.sourceImage',
          'La imagen a refinar no está disponible.',
        );
        console.warn('[generate-scene-images] refine source unavailable — refusing');
        return imageErrorResponse(err, corsHeaders, { images: [], skippedImages });
      }
      refine.sourceImage = source;
    }

    // Refine requests always produce exactly one image; slot 0 of inlineData is the source.
    const effectiveCount = refine ? 1 : count;

    console.log(`[generate-scene-images] ========== NEW REQUEST ==========`);
    // `Number(...)`: the coerced numeric the variation loop actually uses,
    // never the raw request scalar. `modelTier` is already the narrowed
    // `'pro' | 'flash'` local, not `requestData.modelTier`.
    console.log(`[generate-scene-images] Type: ${safeType(type)}, Style: ${charCount(styleId)}, Count: ${Number(count)}, refine=${!!refine}, effectiveCount=${Number(effectiveCount)}, modelTier=${modelTier}, model=${resolveModel(modelTier, config)}`);

    if (type === 'scene') {
      const { sceneReferenceMode = 'style' } = requestData;
      // Counts only: URLs, query strings, and base64 prefixes are never logged.
      console.log(
        `[generate-scene-images] REQUEST CHECK - mode=${safeMode(sceneReferenceMode)}, images validated=${sourceImages.size}`,
      );
    }

    let prompt: string;
    let referenceImages: string[] = [];
    let characterDescriptions: string[] = [];

    switch (type) {
      case 'scene': {
        const { scene, characters, location, sceneReferenceImage, sceneReferenceMode = 'style', landmarks, props } = requestData;
        if (!scene || !location) {
          throw new Error('Se requiere scene y location para generar escena');
        }

        const charactersInScene: Character[] = characters || [];
        const landmarksInScene: Landmark[] = landmarks || [];
        const propsInScene: Prop[] = props || [];

        console.log(`[generate-scene-images] Scene text: ${charCount(scene.text)}`);
        console.log(`[generate-scene-images] Characters for this scene (from frontend): ${listShape(charactersInScene.map(c => c.name))}`);
        console.log(`[generate-scene-images] Landmarks for this scene: ${listShape(landmarksInScene.map(l => l.name))}`);
        console.log(`[generate-scene-images] Props for this scene: ${listShape(propsInScene.map(p => p.name))}`);
        console.log(`[generate-scene-images] Landmark visible in scene: ${Boolean(scene.landmarkVisible)}`);

        // Index-preserving: the slot path is how a character maps to the image
        // pass 1 validated and pass 2 materialised.
        const charactersWithImages = charactersInScene
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.referenceImage);
        console.log(`[generate-scene-images] Characters with reference images: ${charactersWithImages.length}`);

        const processedResults = charactersWithImages.map(({ c, i }) => ({
          image: takeImage(`characters[${i}].referenceImage`),
          description: `${c.name}: ${c.visualDescription}`,
        }));

        const validResults = processedResults.filter(r => r.image !== '');
        referenceImages = validResults.map(r => r.image);
        characterDescriptions = validResults.map(r => r.description);

        console.log(`[generate-scene-images] Reference images processed: ${referenceImages.length}/${charactersWithImages.length}`);
        console.log(`[generate-scene-images] Character descriptions: ${listShape(characterDescriptions)}`);

        const landmarkRefImages: string[] = [];
        const landmarkRefDescriptions: string[] = [];

        // Process landmark reference images if landmark is visible in this scene
        if (scene.landmarkVisible && landmarksInScene.length > 0) {
          for (const [lmIndex, lm] of landmarksInScene.entries()) {
            if (lm.referenceImages && lm.referenceImages.length > 0) {
              console.log(`[generate-scene-images] Processing ${lm.referenceImages.length} landmark reference images for landmark ${lmIndex} (${charCount(lm.name)})`);
              // Cap at 2 reference images per landmark
              for (let j = 0; j < Math.min(lm.referenceImages.length, 2); j++) {
                const processedLandmarkRef = takeImage(`landmarks[${lmIndex}].referenceImages[${j}]`);
                if (processedLandmarkRef) {
                  landmarkRefImages.push(processedLandmarkRef);
                  landmarkRefDescriptions.push(`LANDMARK REFERENCE - ${lm.name}: ${lm.visualDescription}. Render this building/landmark EXACTLY as shown in this photo.`);
                  console.log(`[generate-scene-images] Landmark ref image for landmark ${lmIndex} added.`);
                }
              }
            }
          }
        }

        // Process prop reference images (reuses landmark processing branch, cap 2 per prop)
        const propRefImages: string[] = [];
        const propRefDescriptions: string[] = [];
        if (propsInScene.length > 0) {
          for (const [prIndex, pr] of propsInScene.entries()) {
            if (pr.referenceImages && pr.referenceImages.length > 0) {
              console.log(`[generate-scene-images] Processing ${pr.referenceImages.length} prop reference images for prop ${prIndex} (${charCount(pr.name)})`);
              // Cap at 2 reference images per prop
              for (let j = 0; j < Math.min(pr.referenceImages.length, 2); j++) {
                const processedPropRef = takeImage(`props[${prIndex}].referenceImages[${j}]`);
                if (processedPropRef) {
                  propRefImages.push(processedPropRef);
                  propRefDescriptions.push(`PROP REFERENCE - ${pr.name}: ${pr.visualDescription}. Render this prop EXACTLY as shown in this photo.`);
                  console.log(`[generate-scene-images] Prop ref image for prop ${prIndex} added.`);
                }
              }
            }
          }
        }

        // Enforce scene-wide cap: characters + landmarks + props (+ scene-style + refine source) <= 12
        // (Gemini 14-image ceiling, leave headroom for system parts).
        // In refine mode, slot 0 is reserved for refine.sourceImage so the budget for everything
        // else shrinks to 11. Trim order (lowest priority first):
        // scene-style ref → props → landmarks → characters (characters trimmed only in refine
        // mode, since the refine source already encodes their appearance; non-refine preserves
        // the historical behavior of never dropping characters).
        const HARD_CAP = 12;
        const MAX_PROCESSED = refine ? HARD_CAP - 1 : HARD_CAP;
        const willAddSceneRef = !!sceneReferenceImage;
        const sceneRefBudgetCost = willAddSceneRef ? 1 : 0;
        const initialTotal =
          referenceImages.length +
          landmarkRefImages.length +
          propRefImages.length +
          sceneRefBudgetCost;
        let droppedSceneRef = false;
        const droppedPropNames: string[] = [];
        const droppedLandmarkNames: string[] = [];
        const droppedCharacterNames: string[] = [];

        if (initialTotal > MAX_PROCESSED) {
          let overflow = initialTotal - MAX_PROCESSED;

          if (overflow > 0 && willAddSceneRef) {
            droppedSceneRef = true;
            overflow -= 1;
            console.warn(
              `[generate-scene-images] Refine/cap pressure: dropping scene-style reference image (mode=${safeMode(sceneReferenceMode)}) to keep refine source in slot 0`
            );
          }

          while (overflow > 0 && propRefImages.length > 0) {
            propRefImages.pop();
            const droppedDesc = propRefDescriptions.pop() ?? '';
            const propName = droppedDesc.match(/PROP REFERENCE - ([^:]+):/)?.[1] ?? 'unknown prop';
            droppedPropNames.push(propName);
            overflow -= 1;
          }

          while (overflow > 0 && landmarkRefImages.length > 0) {
            landmarkRefImages.pop();
            const droppedDesc = landmarkRefDescriptions.pop() ?? '';
            const lmName = droppedDesc.match(/LANDMARK REFERENCE - ([^:]+):/)?.[1] ?? 'unknown landmark';
            droppedLandmarkNames.push(lmName);
            overflow -= 1;
          }

          if (refine) {
            while (overflow > 0 && referenceImages.length > 0) {
              referenceImages.pop();
              const droppedDesc = characterDescriptions.pop() ?? '';
              const charName = droppedDesc.split(':')[0]?.trim() || 'unknown character';
              droppedCharacterNames.push(charName);
              overflow -= 1;
            }
          }

          if (droppedPropNames.length > 0) {
            console.warn(
              `[generate-scene-images] Trimmed prop reference image(s) to stay under ${MAX_PROCESSED}-image cap: ${listShape(droppedPropNames)}`
            );
          }
          if (droppedLandmarkNames.length > 0) {
            console.warn(
              `[generate-scene-images] Trimmed landmark reference image(s) to stay under ${MAX_PROCESSED}-image cap: ${listShape(droppedLandmarkNames)}`
            );
          }
          if (droppedCharacterNames.length > 0) {
            console.warn(
              `[generate-scene-images] Trimmed character reference image(s) (refine mode) to stay under ${MAX_PROCESSED}-image cap: ${listShape(droppedCharacterNames)}`
            );
          }

          const finalCount =
            referenceImages.length +
            landmarkRefImages.length +
            propRefImages.length +
            (willAddSceneRef && !droppedSceneRef ? 1 : 0);
          console.warn(
            `[generate-scene-images] Trimmed reference images to stay under ${MAX_PROCESSED}-image cap`,
            {
              initialTotal,
              droppedSceneRef,
              droppedProps: droppedPropNames.length,
              droppedLandmarks: droppedLandmarkNames.length,
              droppedCharacters: droppedCharacterNames.length,
              finalCount,
              refine: !!refine,
            }
          );
        }

        referenceImages.push(...landmarkRefImages, ...propRefImages);
        characterDescriptions.push(...landmarkRefDescriptions, ...propRefDescriptions);

        if (sceneReferenceImage && !droppedSceneRef) {
          const processedSceneRef = takeImage('sceneReferenceImage');
          if (processedSceneRef) {
            const sceneRefInstruction = sceneReferenceMode === 'pov'
              ? 'SAME-LOCATION REFERENCE — This image shows the exact setting for this scene. Render the SAME location, same buildings, same props, same lighting atmosphere, but from a DIFFERENT camera angle / point of view that matches the new scene description. Preserve spatial relationships, scale, and environment details. Do NOT change the location or its distinctive features.'
              : 'SCENE STYLE REFERENCE - Use this image as visual style reference for the entire scene composition, lighting, colors, and atmosphere';
            referenceImages.unshift(processedSceneRef);
            characterDescriptions.unshift(sceneRefInstruction);
            console.log(`[generate-scene-images] Scene reference image added successfully (mode: ${safeMode(sceneReferenceMode)})! Total refs now: ${referenceImages.length}`);
          } else {
            console.log(`[generate-scene-images] Scene reference image processing FAILED`);
          }
        } else {
          console.log(`[generate-scene-images] No scene reference image provided`);
        }

        prompt = buildScenePrompt(styleId, scene, charactersInScene, location, landmarksInScene, propsInScene);
        break;
      }

      case 'character': {
        const { character } = requestData;
        if (!character) {
          throw new Error('Se requiere character para generar character sheet');
        }
        prompt = buildCharacterSheetPrompt(styleId, character);
        break;
      }

      case 'prop': {
        const { prop } = requestData;
        if (!prop?.name || !prop?.visualDescription) {
          throw new Error('Se requiere prop {name, kind, visualDescription} para generar la hoja de referencia');
        }
        const propKind: 'location' | 'prop' = prop.kind === 'location' ? 'location' : 'prop';
        prompt = buildPropSheetPrompt(styleId, { name: prop.name, kind: propKind, visualDescription: prop.visualDescription });

        // Fotos reales opcionales del usuario como referencia adicional
        if (Array.isArray(prop.referenceImages) && prop.referenceImages.length > 0) {
          for (let j = 0; j < Math.min(prop.referenceImages.length, 2); j++) {
            const processed = takeImage(`prop.referenceImages[${j}]`);
            if (processed) {
              referenceImages.push(processed);
              characterDescriptions.push(`PROP REFERENCE - ${prop.name}: ${prop.visualDescription}. Render this ${propKind === 'location' ? 'place' : 'object'} EXACTLY as shown in this photo.`);
            }
          }
        }
        break;
      }

      case 'cover': {
        // IGUAL QUE SCENE: usar characters y sceneReferenceImage
        const { title, protagonist, location, characters, sceneReferenceImage, customPrompt, props } = requestData;
        if (!title || !protagonist || !location) {
          throw new Error('Se requiere title, protagonist y location para generar portada');
        }

        const propsInCover: Prop[] = props || [];

        console.log(
          `[generate-scene-images] COVER - characters=${characters?.length || 0}, props=${propsInCover.length}, styleRef=${!!sceneReferenceImage}`,
        );

        const propPromptLines = buildPropReferenceLines(propsInCover);

        if (customPrompt) {
          const stylePrompt = ILLUSTRATION_STYLES[styleId] || ILLUSTRATION_STYLES['storybook'];
          prompt = `${stylePrompt}

PORTADA DEL CUENTO: "${title}"

Ubicación: ${location.name}. ${location.description || ''}

${customPrompt}${propPromptLines}

Instrucciones críticas:
- Composición atractiva para portada de libro infantil
- **INCLUIR EL TÍTULO "${title}" en la parte superior de la imagen** en una fuente amigable y legible para niños
- El título debe verse como una portada real de libro infantil
- Escena brillante y bien iluminada
- Imágenes apropiadas para niños 5-10 años
- Atmósfera cálida y acogedora`;
          console.log(`[generate-scene-images] Cover using custom prompt`);
        } else {
          prompt = buildCoverPrompt(styleId, title, protagonist, location) + propPromptLines;
        }

        const charactersInCover: Character[] = characters || [];
        const charactersWithImages = charactersInCover
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.referenceImage);

        console.log(`[generate-scene-images] Cover characters with reference images: ${charactersWithImages.length}`);

        const processedResults = charactersWithImages.map(({ c, i }) => ({
          image: takeImage(`characters[${i}].referenceImage`),
          description: `${c.name}: ${c.visualDescription}`,
        }));

        const validResults = processedResults.filter(r => r.image !== '');
        referenceImages = validResults.map(r => r.image);
        characterDescriptions = validResults.map(r => r.description);

        console.log(`[generate-scene-images] Cover reference images processed: ${referenceImages.length}/${charactersWithImages.length}`);

        // Process prop reference images (reuses landmark processing branch, cap 2 per prop)
        const coverPropRefImages: string[] = [];
        const coverPropRefDescriptions: string[] = [];
        if (propsInCover.length > 0) {
          for (const [prIndex, pr] of propsInCover.entries()) {
            if (pr.referenceImages && pr.referenceImages.length > 0) {
              console.log(`[generate-scene-images] Processing ${pr.referenceImages.length} cover prop reference images for prop ${prIndex} (${charCount(pr.name)})`);
              for (let j = 0; j < Math.min(pr.referenceImages.length, 2); j++) {
                const processedPropRef = takeImage(`props[${prIndex}].referenceImages[${j}]`);
                if (processedPropRef) {
                  coverPropRefImages.push(processedPropRef);
                  coverPropRefDescriptions.push(`PROP REFERENCE - ${pr.name}: ${pr.visualDescription}. Render this prop EXACTLY as shown in this photo.`);
                  console.log(`[generate-scene-images] Cover prop ref image for prop ${prIndex} added.`);
                }
              }
            }
          }
        }

        // Enforce cap: characters + props (+ cover-style + refine source) <= 12 (covers have no landmarks today).
        // In refine mode, slot 0 is reserved for refine.sourceImage so the budget shrinks to 11.
        // Trim order: cover-style ref → props → characters (characters trimmed only in refine
        // mode, since the refine source already encodes their appearance; non-refine preserves
        // the historical behavior of never dropping characters).
        const COVER_HARD_CAP = 12;
        const COVER_MAX_PROCESSED = refine ? COVER_HARD_CAP - 1 : COVER_HARD_CAP;
        const coverWillAddStyleRef = !!sceneReferenceImage;
        const coverStyleRefBudgetCost = coverWillAddStyleRef ? 1 : 0;
        const coverInitialTotal =
          referenceImages.length + coverPropRefImages.length + coverStyleRefBudgetCost;
        let coverDroppedStyleRef = false;
        const coverDroppedPropNames: string[] = [];
        const coverDroppedCharacterNames: string[] = [];

        if (coverInitialTotal > COVER_MAX_PROCESSED) {
          let overflow = coverInitialTotal - COVER_MAX_PROCESSED;

          if (overflow > 0 && coverWillAddStyleRef) {
            coverDroppedStyleRef = true;
            overflow -= 1;
            console.warn(
              `[generate-scene-images] Refine/cap pressure: dropping cover style reference image to keep refine source in slot 0`
            );
          }

          while (overflow > 0 && coverPropRefImages.length > 0) {
            coverPropRefImages.pop();
            const droppedDesc = coverPropRefDescriptions.pop() ?? '';
            const propName = droppedDesc.match(/PROP REFERENCE - ([^:]+):/)?.[1] ?? 'unknown prop';
            coverDroppedPropNames.push(propName);
            overflow -= 1;
          }

          if (refine) {
            while (overflow > 0 && referenceImages.length > 0) {
              referenceImages.pop();
              const droppedDesc = characterDescriptions.pop() ?? '';
              const charName = droppedDesc.split(':')[0]?.trim() || 'unknown character';
              coverDroppedCharacterNames.push(charName);
              overflow -= 1;
            }
          }

          if (coverDroppedPropNames.length > 0) {
            console.warn(
              `[generate-scene-images] Trimmed cover prop reference image(s) to stay under ${COVER_MAX_PROCESSED}-image cap: ${listShape(coverDroppedPropNames)}`
            );
          }
          if (coverDroppedCharacterNames.length > 0) {
            console.warn(
              `[generate-scene-images] Trimmed cover character reference image(s) (refine mode) to stay under ${COVER_MAX_PROCESSED}-image cap: ${listShape(coverDroppedCharacterNames)}`
            );
          }

          const finalCount =
            referenceImages.length +
            coverPropRefImages.length +
            (coverWillAddStyleRef && !coverDroppedStyleRef ? 1 : 0);
          console.warn(
            `[generate-scene-images] Trimmed cover reference images to stay under ${COVER_MAX_PROCESSED}-image cap`,
            {
              initialTotal: coverInitialTotal,
              droppedStyleRef: coverDroppedStyleRef,
              droppedProps: coverDroppedPropNames.length,
              droppedCharacters: coverDroppedCharacterNames.length,
              droppedLandmarks: 0,
              finalCount,
              refine: !!refine,
            }
          );
        }

        referenceImages.push(...coverPropRefImages);
        characterDescriptions.push(...coverPropRefDescriptions);

        if (sceneReferenceImage && !coverDroppedStyleRef) {
          const processedSceneRef = takeImage('sceneReferenceImage');
          if (processedSceneRef) {
            referenceImages.unshift(processedSceneRef);
            characterDescriptions.unshift('COVER STYLE REFERENCE - Use this image as visual style reference for colors, lighting, composition, and atmosphere');
            console.log(`[generate-scene-images] Cover style reference image added successfully! Total refs now: ${referenceImages.length}`);
          } else {
            console.log(`[generate-scene-images] Cover style reference image processing FAILED`);
          }
        } else {
          console.log(`[generate-scene-images] No cover style reference image provided`);
        }
        break;
      }

      case 'end': {
        const { referenceImage: endReferenceImage, customPrompt: endCustomPrompt, characters: endCharacters } = requestData;

        const charactersInEnd: Character[] = endCharacters || [];
        const charactersWithImages = charactersInEnd
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.referenceImage);

        console.log(`[generate-scene-images] END - characters count: ${charactersInEnd.length}`);
        console.log(`[generate-scene-images] END - characters with refs: ${charactersWithImages.length}`);

        const characterDescriptionsBlock = charactersInEnd.length > 0
          ? `\n\nPersonajes en la imagen final:\n${charactersInEnd.map(c => `- ${c.name}: ${c.visualDescription}`).join('\n')}`
          : '';

        const characterReferenceInstruction = charactersWithImages.length > 0
          ? `\n\nIMPORTANT: Use the reference images provided to maintain EXACT visual consistency for each character. The characters must look IDENTICAL to their reference images in terms of: clothing, hair color/style, facial features, body proportions, and any distinctive features.`
          : '';

        if (endCustomPrompt) {
          const stylePrompt = ILLUSTRATION_STYLES[styleId] || ILLUSTRATION_STYLES['storybook'];
          prompt = `${stylePrompt}

IMAGEN FINAL "FIN" PARA CUENTO INFANTIL

${endCustomPrompt}${characterDescriptionsBlock}${characterReferenceInstruction}

Instrucciones críticas:
- Composición atractiva para página final de libro infantil
- Escena brillante y bien iluminada
- Atmósfera de cierre y satisfacción
- Imágenes apropiadas para niños 5-10 años
- **ABSOLUTAMENTE SIN TEXTO, SIN PALABRAS, SIN LETRAS EN LA IMAGEN**
- Puede ser abstracta o con elementos del cuento`;
          console.log(`[generate-scene-images] End using custom prompt`);
        } else {
          prompt = buildEndPrompt(styleId) + characterDescriptionsBlock + characterReferenceInstruction;
        }

        // Process character reference images for the end (mirrors the scene case pattern)
        if (charactersWithImages.length > 0) {
          const processedResults = charactersWithImages.map(({ c, i }) => ({
            image: takeImage(`characters[${i}].referenceImage`),
            description: `${c.name}: ${c.visualDescription}`,
          }));

          const validResults = processedResults.filter(r => r.image !== '');
          let endCharRefImages = validResults.map(r => r.image);
          let endCharRefDescriptions = validResults.map(r => r.description);

          // Enforce 12-image cap on end character references (Gemini 14-image ceiling leaves
          // headroom for system parts). In refine mode the cap shrinks to 11 to reserve slot 0
          // for refine.sourceImage. Trim from the end (lowest priority) and emit a warn naming
          // the dropped reference(s).
          const END_HARD_CAP = 12;
          const END_MAX_PROCESSED = refine ? END_HARD_CAP - 1 : END_HARD_CAP;
          if (endCharRefImages.length > END_MAX_PROCESSED) {
            const initialTotal = endCharRefImages.length;
            const droppedNames = endCharRefDescriptions
              .slice(END_MAX_PROCESSED)
              .map(d => d.split(':')[0] || 'unknown character');
            endCharRefImages = endCharRefImages.slice(0, END_MAX_PROCESSED);
            endCharRefDescriptions = endCharRefDescriptions.slice(0, END_MAX_PROCESSED);
            console.warn(
              `[generate-scene-images] Trimmed end character reference image(s) to stay under ${END_MAX_PROCESSED}-image cap: ${listShape(droppedNames)}`,
              {
                initialTotal,
                finalCount: endCharRefImages.length,
                dropped: initialTotal - endCharRefImages.length,
                refine: !!refine,
              }
            );
          }

          referenceImages.push(...endCharRefImages);
          characterDescriptions.push(...endCharRefDescriptions);
          console.log(`[generate-scene-images] End character references added: ${endCharRefImages.length}`);
        }

        if (endReferenceImage) {
          // In refine mode, drop the end-style reference if it would push us past the
          // 11-slot budget for non-source refs (slot 0 reserved for refine.sourceImage).
          const endNonSourceBudget = refine ? 11 : 12;
          if (referenceImages.length >= endNonSourceBudget) {
            console.warn(
              `[generate-scene-images] Dropping end style reference image to stay under ${endNonSourceBudget + (refine ? 1 : 0)}-image cap (refine=${!!refine})`
            );
          } else {
            const processedImage = takeImage('referenceImage');
            if (processedImage) {
              referenceImages.push(processedImage);
              characterDescriptions.push('END STYLE REFERENCE - Use this image as visual style reference for the final image');
              console.log(`[generate-scene-images] End reference image processed successfully`);
            }
          }
        }
        break;
      }

      default:
        throw new Error(`Tipo no válido: ${type}. Use: scene, character, prop, cover, end`);
    }

    if (refine) {
      // Replacement FUNCTION, not string: `$&`, `$'` and `` $` `` in user
      // feedback are otherwise interpreted as substitution patterns and
      // silently garble the refine instruction.
      prompt = `${prompt}\n\n${REFINE_INSTRUCTION_TEMPLATE.replace('{feedback}', () => refine.feedback)}`;
    }

    console.log(`[generate-scene-images] Prompt (${safeType(type)}): ${charCount(prompt)}`);
    console.log(`[generate-scene-images] FINAL STATE - Passing ${referenceImages.length} reference images to Gemini (refine=${!!refine}, effectiveCount=${Number(effectiveCount)})`);

    const promises = [];
    for (let i = 0; i < Math.min(effectiveCount, 4); i++) {
      promises.push(generateImage(prompt, i, referenceImages, characterDescriptions, refine, modelTier, config));
    }

    const settledResults = await Promise.allSettled(promises);

    const images: string[] = [];
    const errors: string[] = [];

    settledResults.forEach((result, i) => {
      if (result.status === 'fulfilled' && isValidImageBase64(result.value)) {
        images.push(result.value);
      } else if (result.status === 'rejected') {
        // Redacted for the log; the client-facing `errors` array keeps the
        // original message, which never leaves the JSON response body.
        console.error(`[generate-scene-images] Variation ${i} failed: ${describeError(result.reason)}`);
        errors.push(result.reason?.message || String(result.reason));
      } else {
        // A provider 200 that carries no usable image is an upstream failure:
        // recorded like any other so the caller never receives a silent,
        // image-less "success". Metadata only — the response body is not logged.
        console.warn(`[generate-scene-images] Variation ${i} returned no usable image`);
        errors.push(NO_IMAGE_ERROR);
      }
    });

    console.log(`[generate-scene-images] ${images.length}/${Number(count)} imágenes válidas generadas`);
    if (errors.length > 0) {
      // Redacted: provider errors quote the request URL. The unredacted text
      // still goes to the client in the JSON body, which is not a log sink.
      console.log(`[generate-scene-images] Errors: ${listShape(errors)}`);
    }

    if (images.length === 0 && errors.length > 0) {
      // Propagar rate-limit como 429 para que el cliente pueda bajar su concurrencia
      const isRateLimited = errors.some((e) => e.includes('429') || /rate.?limit/i.test(e));
      return new Response(
        JSON.stringify({
          success: false,
          error: errors[0],
          errors,
          images: [],
          skippedImages,
          referenceImagesCount: referenceImages.length,
        }),
        {
          status: isRateLimited ? 429 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: images.length > 0,
        images,
        skippedImages,
        validCount: images.length,
        requestedCount: count,
        model: resolveModel(modelTier, config),
        modelTier,
        prompt: prompt.slice(0, 500),
        referenceImagesCount: referenceImages.length,
        errors: errors.length > 0 ? errors : undefined,
        charactersDetected: type === 'scene' ?
          (requestData.characters || [])
            .filter((c: Character) => detectCharactersInScene(requestData.scene, [c]).length > 0)
            .map((c: Character) => c.name)
          : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    console.error(`[generate-scene-images] Error: ${describeError(error)}`);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error generando imágenes',
        images: [],
        // Additive, and only when there is something to report — see the story
        // handler. Existing fields, codes and semantics unchanged.
        ...(skippedImages.length > 0 ? { skippedImages } : {}),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
  };
}
