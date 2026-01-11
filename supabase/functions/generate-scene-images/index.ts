/**
 * CASA Scene Image Generator Edge Function
 * Genera imágenes para escenas de cuentos usando Nano Banana Pro (gemini-3-pro-image-preview)
 * Soporta imágenes de referencia para consistencia de personajes
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
const IMAGE_MODEL = 'gemini-3-pro-image-preview';

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
  referenceImage?: string; // base64 de la imagen de referencia
}

interface Scene {
  text: string;
  visualDescription: string;
}

interface Location {
  name: string;
  description: string;
}

/**
 * Detecta qué personajes aparecen en una escena basándose en el texto y descripción visual
 */
function detectCharactersInScene(
  scene: Scene,
  characters: Character[]
): Character[] {
  const sceneText = `${scene.text} ${scene.visualDescription}`.toLowerCase();

  return characters.filter(character => {
    const charName = character.name.toLowerCase();
    // Buscar el nombre del personaje en el texto de la escena
    // También buscar variaciones comunes (sin artículos, diminutivos, etc.)
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

/**
 * Construye el prompt para generar una imagen de escena
 * Solo incluye los personajes que aparecen en la escena
 */
function buildScenePrompt(
  styleId: string,
  scene: Scene,
  charactersInScene: Character[],
  location: Location
): string {
  const stylePrompt = ILLUSTRATION_STYLES[styleId] || ILLUSTRATION_STYLES['storybook'];

  // Construir descripciones de personajes que SÍ aparecen en la escena
  const characterDescriptions = charactersInScene.length > 0
    ? charactersInScene.map(c => `- ${c.name}: ${c.visualDescription}`).join('\n')
    : 'No specific characters in this scene';

  // Instrucción especial si hay imágenes de referencia
  const referenceInstruction = charactersInScene.some(c => c.referenceImage)
    ? `\n\nIMPORTANT: Use the reference images provided to maintain EXACT visual consistency for each character. The characters must look IDENTICAL to their reference images in terms of: clothing, hair color/style, facial features, body proportions, and any distinctive features.`
    : '';

  return `${stylePrompt}

Scene description: ${scene.visualDescription}

Scene narrative: "${scene.text}"

Location: ${location.name}, Chile. ${location.description}

Characters that appear in THIS scene (ONLY these characters should be shown):
${characterDescriptions}
${referenceInstruction}

CRITICAL instructions:
- ONLY show the characters listed above - no other characters should appear
- Bright, well-lit scene (this will be projected in a room with natural light)
- Child-friendly imagery appropriate for ages 5-10
- **ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO WRITING OF ANY KIND IN THE IMAGE** - This is extremely important, the image must be purely visual with zero text elements
- Cinematic composition with good framing
- Warm, inviting atmosphere
- Focus on the emotional moment described in the scene
- If reference images are provided, the characters MUST look exactly like their references
- Do not include any signs, labels, captions, titles, or any form of written text
`.trim();
}

/**
 * Construye el prompt para character sheet
 */
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
 * Construye el prompt para la portada
 */
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

/**
 * Construye el prompt para la imagen final "Fin"
 */
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

/**
 * Valida que un string base64 sea una imagen válida
 */
function isValidImageBase64(base64: string): boolean {
  if (!base64 || typeof base64 !== 'string') return false;
  return base64.startsWith('iVBORw0KGgo') || base64.startsWith('/9j/');
}

/**
 * Verifica si un string es una URL
 */
function isUrl(str: string): boolean {
  return str?.startsWith('http://') || str?.startsWith('https://');
}

/**
 * Descarga una imagen desde URL y la convierte a base64
 */
async function downloadImageToBase64(url: string): Promise<string> {
  try {
    console.log(`[generate-scene-images] Downloading image from URL: ${url.slice(0, 100)}...`);

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[generate-scene-images] Failed to download image: ${response.status} ${response.statusText}`);
      return '';
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Convertir a base64
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);

    console.log(`[generate-scene-images] Downloaded image, base64 length: ${base64.length}, starts with: ${base64.slice(0, 20)}`);

    if (isValidImageBase64(base64)) {
      return base64;
    } else {
      console.error(`[generate-scene-images] Downloaded image is not valid PNG/JPEG base64`);
      return '';
    }
  } catch (err) {
    console.error(`[generate-scene-images] Error downloading image:`, err);
    return '';
  }
}

/**
 * Procesa una imagen de referencia: si es URL la descarga, si es base64 la valida
 */
async function processReferenceImage(imageData: string): Promise<string> {
  if (!imageData) return '';

  if (isUrl(imageData)) {
    return await downloadImageToBase64(imageData);
  } else if (isValidImageBase64(imageData)) {
    return imageData;
  }

  return '';
}

/**
 * Genera una imagen usando Nano Banana Pro
 * Soporta imágenes de referencia para consistencia de personajes
 */
async function generateImage(
  prompt: string,
  variation: number = 0,
  referenceImages: string[] = [],
  characterDescriptions: string[] = []
): Promise<string> {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  try {
    // Construir las partes del contenido
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    // Log detallado para diagnóstico
    console.log(`[generateImage] Starting with ${referenceImages.length} reference images, variation ${variation}`);

    // Agregar imágenes de referencia primero (si las hay)
    let imagesAdded = 0;
    if (referenceImages.length > 0) {
      // Agregar instrucción detallada sobre las referencias
      const refInstruction = `CRITICAL CHARACTER REFERENCE IMAGES:
The following ${referenceImages.length} image(s) show the EXACT appearance of characters that must appear in the generated scene.
You MUST copy these visual details EXACTLY:
- Face shape, features, and expression style
- Hair color, style, and length
- Skin tone and body proportions
- Clothing colors, patterns, and style
- Any distinctive accessories or features

Study each reference carefully before generating. The characters in your output MUST be visually identical to these references.`;

      parts.push({ text: refInstruction });

      // Agregar cada imagen de referencia con su descripción
      for (let i = 0; i < referenceImages.length && i < 14; i++) {
        const imgData = referenceImages[i];
        const imgPrefix = imgData?.slice(0, 30) || 'empty';
        console.log(`[generateImage] Reference image ${i + 1}: length=${imgData?.length || 0}, prefix="${imgPrefix}"`);

        if (isValidImageBase64(imgData)) {
          const mimeType = imgData.startsWith('/9j/') ? 'image/jpeg' : 'image/png';

          // Agregar etiqueta para la imagen
          if (characterDescriptions[i]) {
            parts.push({ text: `Character reference ${i + 1} - ${characterDescriptions[i]}:` });
          }

          parts.push({
            inlineData: {
              mimeType,
              data: imgData
            }
          });
          imagesAdded++;
          console.log(`[generateImage] Added reference image ${i + 1} as ${mimeType}`);
        } else {
          console.log(`[generateImage] Reference image ${i + 1} INVALID - not PNG/JPEG base64`);
        }
      }
    }

    console.log(`[generateImage] Total images added to request: ${imagesAdded}`);

    // Agregar el prompt principal con énfasis en consistencia
    let finalPrompt = prompt;

    if (imagesAdded > 0) {
      finalPrompt = `REMEMBER: The characters MUST match the reference images provided above EXACTLY.

${prompt}`;
    }

    if (variation > 0) {
      finalPrompt += `\n\nGenerate variation ${variation} with slightly different composition, poses, and background details. However, the characters MUST remain VISUALLY IDENTICAL to their reference images - same face, same hair, same clothes, same colors.`;
    }

    parts.push({ text: finalPrompt });

    // Log detallado del request
    const textParts = parts.filter(p => p.text).length;
    const imageParts = parts.filter(p => p.inlineData).length;
    console.log(`[generateImage] Sending request to Gemini with ${parts.length} total parts: ${textParts} text, ${imageParts} images`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[generate-scene-images] API Error (${response.status}):`, errorText);
      // Propagar el error para que el usuario lo vea
      throw new Error(`Gemini API error: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();

    // Log completo de la respuesta para debugging
    console.log(`[generate-scene-images] Full API response:`, JSON.stringify(data, null, 2).slice(0, 3000));

    // Verificar si hay error en la respuesta
    if (data.error) {
      console.error(`[generate-scene-images] API returned error:`, JSON.stringify(data.error));
      throw new Error(`Gemini error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    // Verificar si hay promptFeedback (bloqueo de contenido)
    if (data.promptFeedback?.blockReason) {
      console.error(`[generate-scene-images] Content blocked:`, data.promptFeedback.blockReason);
      throw new Error(`Content blocked by Gemini: ${data.promptFeedback.blockReason}`);
    }

    // Extraer imagen de la respuesta
    if (data.candidates && data.candidates[0]?.content?.parts) {
      console.log(`[generate-scene-images] Found ${data.candidates[0].content.parts.length} parts in response`);
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          const base64 = part.inlineData.data;
          console.log(`[generate-scene-images] Found inlineData, length: ${base64.length}, starts with: ${base64.slice(0, 20)}`);
          if (isValidImageBase64(base64)) {
            return base64;
          } else {
            console.log(`[generate-scene-images] Invalid base64 format`);
          }
        } else if (part.text) {
          console.log(`[generate-scene-images] Found text part: ${part.text.slice(0, 200)}`);
        }
      }
    } else {
      console.log(`[generate-scene-images] No candidates or parts found. Data keys:`, Object.keys(data));
      if (data.candidates) {
        console.log(`[generate-scene-images] Candidates:`, JSON.stringify(data.candidates, null, 2).slice(0, 1000));
      }
    }

    console.log(`[generate-scene-images] No valid image found in response`);
    return '';
  } catch (err) {
    console.error(`[generate-scene-images] Error in generateImage:`, err);
    // Re-throw para que el error se propague
    throw err;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY no está configurada');
    }

    const requestData = await req.json();
    const { type, styleId, count = 4 } = requestData;

    console.log(`[generate-scene-images] Type: ${type}, Style: ${styleId}, Count: ${count}`);

    let prompt: string;
    let referenceImages: string[] = [];
    let characterDescriptions: string[] = [];

    switch (type) {
      case 'scene': {
        const { scene, characters, location } = requestData;
        if (!scene || !location) {
          throw new Error('Se requiere scene y location para generar escena');
        }

        // El frontend ya hizo la detección + inclusión manual + exclusión de personajes
        // Usamos directamente la lista que nos envía
        const charactersInScene: Character[] = characters || [];

        console.log(`[generate-scene-images] Scene text: "${scene.text.slice(0, 100)}..."`);
        console.log(`[generate-scene-images] Characters for this scene (from frontend): ${charactersInScene.map(c => c.name).join(', ') || 'none'}`);

        // Recopilar y procesar imágenes de referencia de los personajes
        // Soporta tanto URLs (imágenes guardadas) como base64 (imágenes recién generadas)
        const charactersWithImages = charactersInScene.filter(c => c.referenceImage);
        console.log(`[generate-scene-images] Characters with reference images: ${charactersWithImages.map(c => `${c.name} (${isUrl(c.referenceImage!) ? 'URL' : 'base64'})`).join(', ') || 'none'}`);

        // Procesar imágenes y mantener las descripciones de personajes en el mismo orden
        const processedResults = await Promise.all(
          charactersWithImages.map(async (c) => ({
            image: await processReferenceImage(c.referenceImage!),
            description: `${c.name}: ${c.visualDescription}`,
          }))
        );

        // Filtrar los que tienen imagen válida y mantener sincronizado con descripciones
        const validResults = processedResults.filter(r => r.image !== '');
        referenceImages = validResults.map(r => r.image);
        characterDescriptions = validResults.map(r => r.description);

        console.log(`[generate-scene-images] Reference images processed: ${referenceImages.length}/${charactersWithImages.length}`);
        console.log(`[generate-scene-images] Character descriptions: ${characterDescriptions.join(' | ') || 'none'}`);

        prompt = buildScenePrompt(styleId, scene, charactersInScene, location);
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

      case 'cover': {
        const { title, protagonist, location, referenceImage } = requestData;
        if (!title || !protagonist || !location) {
          throw new Error('Se requiere title, protagonist y location para generar portada');
        }
        prompt = buildCoverPrompt(styleId, title, protagonist, location);

        // Usar imagen de referencia del protagonista si está disponible
        // Soporta tanto URLs como base64
        if (referenceImage) {
          console.log(`[generate-scene-images] Cover reference image type: ${isUrl(referenceImage) ? 'URL' : 'base64'}`);
          const processedImage = await processReferenceImage(referenceImage);
          if (processedImage) {
            referenceImages = [processedImage];
            console.log(`[generate-scene-images] Cover reference image processed successfully`);
          }
        }
        break;
      }

      case 'end': {
        prompt = buildEndPrompt(styleId);
        break;
      }

      default:
        throw new Error(`Tipo no válido: ${type}. Use: scene, character, cover, end`);
    }

    console.log(`[generate-scene-images] Prompt (${type}):`, prompt.slice(0, 300) + '...');
    console.log(`[generate-scene-images] Passing ${referenceImages.length} reference images to Gemini`);

    // Generar múltiples variaciones en paralelo
    const promises = [];
    for (let i = 0; i < Math.min(count, 4); i++) {
      promises.push(generateImage(prompt, i, referenceImages, characterDescriptions));
    }

    // Usar allSettled para capturar errores individuales
    const settledResults = await Promise.allSettled(promises);

    // Procesar resultados
    const images: string[] = [];
    const errors: string[] = [];

    settledResults.forEach((result, i) => {
      if (result.status === 'fulfilled' && isValidImageBase64(result.value)) {
        images.push(result.value);
      } else if (result.status === 'rejected') {
        console.error(`[generate-scene-images] Variation ${i} failed:`, result.reason?.message || result.reason);
        errors.push(result.reason?.message || String(result.reason));
      } else {
        console.log(`[generate-scene-images] Variation ${i} returned empty image`);
      }
    });

    console.log(`[generate-scene-images] ${images.length}/${count} imágenes válidas generadas`);
    if (errors.length > 0) {
      console.log(`[generate-scene-images] Errors: ${errors.join(' | ')}`);
    }

    // Si no hay imágenes pero hay errores, devolver el error
    if (images.length === 0 && errors.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: errors[0], // Mostrar el primer error
          errors,
          images: [],
          referenceImagesCount: referenceImages.length,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: images.length > 0,
        images,
        validCount: images.length,
        requestedCount: count,
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

  } catch (error) {
    console.error('[generate-scene-images] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error generando imágenes',
        images: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
