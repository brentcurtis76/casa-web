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
  referenceImage?: string;
}

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

function isValidImageBase64(base64: string): boolean {
  if (!base64 || typeof base64 !== 'string') return false;
  return base64.startsWith('iVBORw0KGgo') || base64.startsWith('/9j/') || base64.startsWith('UklGR');
}

function isUrl(str: string): boolean {
  return str?.startsWith('http://') || str?.startsWith('https://');
}

async function downloadImageToBase64(url: string): Promise<string> {
  console.log(`[generate-scene-images] downloadImageToBase64 START - URL: ${url.slice(0, 150)}`);

  try {
    const fetchUrl = url;
    console.log(`[generate-scene-images] Fetching from: ${fetchUrl}`);

    const response = await fetch(fetchUrl, {
      headers: {
        'Accept': 'image/*',
      },
    });

    console.log(`[generate-scene-images] Fetch response: status=${response.status}, ok=${response.ok}, type=${response.headers.get('content-type')}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Could not read error body');
      console.error(`[generate-scene-images] Failed to download image: ${response.status} ${response.statusText}`, errorText.slice(0, 200));
      return '';
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('image')) {
      console.error(`[generate-scene-images] Response is not an image: ${contentType}`);
      return '';
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(`[generate-scene-images] Downloaded ${arrayBuffer.byteLength} bytes`);

    if (arrayBuffer.byteLength === 0) {
      console.error(`[generate-scene-images] Downloaded image is empty`);
      return '';
    }

    const uint8Array = new Uint8Array(arrayBuffer);

    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);

    console.log(`[generate-scene-images] Converted to base64: length=${base64.length}, prefix=${base64.slice(0, 30)}`);

    if (isValidImageBase64(base64)) {
      console.log(`[generate-scene-images] downloadImageToBase64 SUCCESS - valid base64 image`);
      return base64;
    } else {
      console.error(`[generate-scene-images] Downloaded image is not valid PNG/JPEG - prefix: ${base64.slice(0, 50)}`);
      return '';
    }
  } catch (err) {
    console.error(`[generate-scene-images] Error downloading image:`, err);
    return '';
  }
}

async function processReferenceImage(imageData: string): Promise<string> {
  if (!imageData) {
    console.log(`[generate-scene-images] processReferenceImage: no imageData provided`);
    return '';
  }

  console.log(`[generate-scene-images] processReferenceImage: input type=${isUrl(imageData) ? 'URL' : 'base64'}, length=${imageData.length}, prefix=${imageData.slice(0, 60)}`);

  if (isUrl(imageData)) {
    const result = await downloadImageToBase64(imageData);
    console.log(`[generate-scene-images] processReferenceImage: URL download result length=${result.length}, valid=${isValidImageBase64(result)}`);
    return result;
  } else if (isValidImageBase64(imageData)) {
    console.log(`[generate-scene-images] processReferenceImage: already valid base64`);
    return imageData;
  } else if (imageData.startsWith('data:')) {
    const parts = imageData.split(',');
    if (parts.length > 1) {
      const base64Part = parts[1];
      if (isValidImageBase64(base64Part)) {
        console.log(`[generate-scene-images] processReferenceImage: extracted base64 from data URL`);
        return base64Part;
      }
    }
    console.log(`[generate-scene-images] processReferenceImage: could not extract valid base64 from data URL`);
    return '';
  }

  console.log(`[generate-scene-images] processReferenceImage: invalid format, not URL or base64`);
  return '';
}

async function generateImage(
  prompt: string,
  variation: number = 0,
  referenceImages: string[] = [],
  characterDescriptions: string[] = []
): Promise<string> {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    console.log(`[generateImage] Starting with ${referenceImages.length} reference images, variation ${variation}`);

    let imagesAdded = 0;
    const hasSceneRef = characterDescriptions[0]?.includes('SCENE STYLE REFERENCE');
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
        const imgPrefix = imgData?.slice(0, 30) || 'empty';
        const isSceneRef = characterDescriptions[i]?.includes('SCENE STYLE REFERENCE');
        console.log(`[generateImage] Reference image ${i + 1}: length=${imgData?.length || 0}, prefix="${imgPrefix}", isSceneRef=${isSceneRef}`);

        if (isValidImageBase64(imgData)) {
          const mimeType = imgData.startsWith('/9j/') ? 'image/jpeg' : imgData.startsWith('UklGR') ? 'image/webp' : 'image/png';

          if (characterDescriptions[i]) {
            const isLandmarkRef = characterDescriptions[i]?.includes('LANDMARK REFERENCE');
            const isPropRef = characterDescriptions[i]?.includes('PROP REFERENCE');
            if (isSceneRef) {
              parts.push({ text: `STYLE REFERENCE IMAGE - Copy the visual style, colors, lighting, and atmosphere from this image:` });
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
      if (imagesAdded > 0 && characterDescriptions[0]?.includes('SCENE STYLE REFERENCE')) {
        finalPrompt += `\n\nGenerate variation ${variation} with slightly different composition and poses, but MAINTAIN THE SAME VISUAL STYLE as the reference image - same color palette, same lighting style, same artistic atmosphere.`;
      } else {
        finalPrompt += `\n\nGenerate variation ${variation} with slightly different composition, poses, and background details. However, the characters MUST remain VISUALLY IDENTICAL to their reference images - same face, same hair, same clothes, same colors.`;
      }
    }

    parts.push({ text: finalPrompt });

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
          imageConfig: {
            aspectRatio: '4:3',
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[generate-scene-images] API Error (${response.status}):`, errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();

    console.log(`[generate-scene-images] Full API response:`, JSON.stringify(data, null, 2).slice(0, 3000));

    if (data.error) {
      console.error(`[generate-scene-images] API returned error:`, JSON.stringify(data.error));
      throw new Error(`Gemini error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    if (data.promptFeedback?.blockReason) {
      console.error(`[generate-scene-images] Content blocked:`, data.promptFeedback.blockReason);
      throw new Error(`Content blocked by Gemini: ${data.promptFeedback.blockReason}`);
    }

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

    console.log(`[generate-scene-images] ========== NEW REQUEST ==========`);
    console.log(`[generate-scene-images] Type: ${type}, Style: ${styleId}, Count: ${count}`);

    if (type === 'scene') {
      const { sceneReferenceImage, characters } = requestData;
      console.log(`[generate-scene-images] REQUEST CHECK - sceneReferenceImage exists: ${!!sceneReferenceImage}`);
      if (sceneReferenceImage) {
        console.log(`[generate-scene-images] REQUEST CHECK - sceneReferenceImage length: ${sceneReferenceImage.length}`);
        console.log(`[generate-scene-images] REQUEST CHECK - sceneReferenceImage prefix: ${sceneReferenceImage.slice(0, 50)}`);
        console.log(`[generate-scene-images] REQUEST CHECK - isURL: ${sceneReferenceImage.startsWith('http')}`);
      }
      console.log(`[generate-scene-images] REQUEST CHECK - characters count: ${characters?.length || 0}`);
      console.log(`[generate-scene-images] REQUEST CHECK - characters with refs: ${characters?.filter((c: any) => c.referenceImage)?.length || 0}`);
    }

    let prompt: string;
    let referenceImages: string[] = [];
    let characterDescriptions: string[] = [];

    switch (type) {
      case 'scene': {
        const { scene, characters, location, sceneReferenceImage, landmarks, props } = requestData;
        if (!scene || !location) {
          throw new Error('Se requiere scene y location para generar escena');
        }

        const charactersInScene: Character[] = characters || [];
        const landmarksInScene: Landmark[] = landmarks || [];
        const propsInScene: Prop[] = props || [];

        console.log(`[generate-scene-images] Scene text: "${scene.text.slice(0, 100)}..."`);
        console.log(`[generate-scene-images] Characters for this scene (from frontend): ${charactersInScene.map(c => c.name).join(', ') || 'none'}`);
        console.log(`[generate-scene-images] Landmarks for this scene: ${landmarksInScene.map(l => l.name).join(', ') || 'none'}`);
        console.log(`[generate-scene-images] Props for this scene: ${propsInScene.map(p => p.name).join(', ') || 'none'}`);
        console.log(`[generate-scene-images] Landmark visible in scene: ${scene.landmarkVisible || false}`);

        const charactersWithImages = charactersInScene.filter(c => c.referenceImage);
        console.log(`[generate-scene-images] Characters with reference images: ${charactersWithImages.map(c => `${c.name} (${isUrl(c.referenceImage!) ? 'URL' : 'base64'})`).join(', ') || 'none'}`);

        console.log(`[generate-scene-images] Characters with reference images to process:`);
        charactersWithImages.forEach((c, i) => {
          console.log(`  ${i + 1}. ${c.name}: type=${isUrl(c.referenceImage!) ? 'URL' : 'base64'}, length=${c.referenceImage!.length}, prefix=${c.referenceImage!.slice(0, 80)}`);
        });

        const processedResults = await Promise.all(
          charactersWithImages.map(async (c) => {
            console.log(`[generate-scene-images] Processing reference for ${c.name}...`);
            const image = await processReferenceImage(c.referenceImage!);
            console.log(`[generate-scene-images] Processed ${c.name}: result length=${image.length}, valid=${isValidImageBase64(image)}`);
            return {
              image,
              description: `${c.name}: ${c.visualDescription}`,
            };
          })
        );

        console.log(`[generate-scene-images] Processing complete. Results:`);
        processedResults.forEach((r, i) => {
          console.log(`  ${i + 1}. ${r.description.slice(0, 50)}: image length=${r.image.length}, valid=${isValidImageBase64(r.image)}`);
        });

        const validResults = processedResults.filter(r => r.image !== '');
        referenceImages = validResults.map(r => r.image);
        characterDescriptions = validResults.map(r => r.description);

        console.log(`[generate-scene-images] Reference images processed: ${referenceImages.length}/${charactersWithImages.length}`);
        console.log(`[generate-scene-images] Character descriptions: ${characterDescriptions.join(' | ') || 'none'}`);

        const landmarkRefImages: string[] = [];
        const landmarkRefDescriptions: string[] = [];

        // Process landmark reference images if landmark is visible in this scene
        if (scene.landmarkVisible && landmarksInScene.length > 0) {
          for (const lm of landmarksInScene) {
            if (lm.referenceImages && lm.referenceImages.length > 0) {
              console.log(`[generate-scene-images] Processing ${lm.referenceImages.length} landmark reference images for "${lm.name}"`);
              // Cap at 2 reference images per landmark
              for (const refImg of lm.referenceImages.slice(0, 2)) {
                const processedLandmarkRef = await processReferenceImage(refImg);
                if (processedLandmarkRef) {
                  landmarkRefImages.push(processedLandmarkRef);
                  landmarkRefDescriptions.push(`LANDMARK REFERENCE - ${lm.name}: ${lm.visualDescription}. Render this building/landmark EXACTLY as shown in this photo.`);
                  console.log(`[generate-scene-images] Landmark ref image for "${lm.name}" added.`);
                }
              }
            }
          }
        }

        // Process prop reference images (reuses landmark processing branch, cap 2 per prop)
        const propRefImages: string[] = [];
        const propRefDescriptions: string[] = [];
        if (propsInScene.length > 0) {
          for (const pr of propsInScene) {
            if (pr.referenceImages && pr.referenceImages.length > 0) {
              console.log(`[generate-scene-images] Processing ${pr.referenceImages.length} prop reference images for "${pr.name}"`);
              // Cap at 2 reference images per prop
              for (const refImg of pr.referenceImages.slice(0, 2)) {
                const processedPropRef = await processReferenceImage(refImg);
                if (processedPropRef) {
                  propRefImages.push(processedPropRef);
                  propRefDescriptions.push(`PROP REFERENCE - ${pr.name}: ${pr.visualDescription}. Render this prop EXACTLY as shown in this photo.`);
                  console.log(`[generate-scene-images] Prop ref image for "${pr.name}" added.`);
                }
              }
            }
          }
        }

        // Enforce scene-wide cap: characters + landmarks + props <= 12 (Gemini 14-image ceiling, leave headroom for scene style ref + system).
        // Trim order: drop props first, then landmarks. Never drop characters.
        const MAX_PROCESSED = 12;
        const initialTotal = referenceImages.length + landmarkRefImages.length + propRefImages.length;
        let droppedProps = 0;
        let droppedLandmarks = 0;

        if (initialTotal > MAX_PROCESSED) {
          let overflow = initialTotal - MAX_PROCESSED;

          const propsToDrop = Math.min(overflow, propRefImages.length);
          if (propsToDrop > 0) {
            propRefImages.splice(propRefImages.length - propsToDrop, propsToDrop);
            propRefDescriptions.splice(propRefDescriptions.length - propsToDrop, propsToDrop);
            droppedProps = propsToDrop;
            overflow -= propsToDrop;
          }

          if (overflow > 0) {
            const landmarksToDrop = Math.min(overflow, landmarkRefImages.length);
            if (landmarksToDrop > 0) {
              landmarkRefImages.splice(landmarkRefImages.length - landmarksToDrop, landmarksToDrop);
              landmarkRefDescriptions.splice(landmarkRefDescriptions.length - landmarksToDrop, landmarksToDrop);
              droppedLandmarks = landmarksToDrop;
            }
          }

          const finalCount = referenceImages.length + landmarkRefImages.length + propRefImages.length;
          console.warn(
            `[generate-scene-images] Trimmed reference images to stay under ${MAX_PROCESSED}-image cap`,
            { initialTotal, droppedProps, droppedLandmarks, finalCount }
          );
        }

        referenceImages.push(...landmarkRefImages, ...propRefImages);
        characterDescriptions.push(...landmarkRefDescriptions, ...propRefDescriptions);

        if (sceneReferenceImage) {
          console.log(`[generate-scene-images] Scene reference image received! Type: ${isUrl(sceneReferenceImage) ? 'URL' : 'base64'}, Length: ${sceneReferenceImage.length}, Prefix: ${sceneReferenceImage.slice(0, 30)}`);
          const processedSceneRef = await processReferenceImage(sceneReferenceImage);
          if (processedSceneRef) {
            referenceImages.unshift(processedSceneRef);
            characterDescriptions.unshift('SCENE STYLE REFERENCE - Use this image as visual style reference for the entire scene composition, lighting, colors, and atmosphere');
            console.log(`[generate-scene-images] Scene reference image added successfully! Total refs now: ${referenceImages.length}`);
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

      case 'cover': {
        // IGUAL QUE SCENE: usar characters y sceneReferenceImage
        const { title, protagonist, location, characters, sceneReferenceImage, customPrompt, props } = requestData;
        if (!title || !protagonist || !location) {
          throw new Error('Se requiere title, protagonist y location para generar portada');
        }

        const propsInCover: Prop[] = props || [];

        console.log(`[generate-scene-images] COVER - characters count: ${characters?.length || 0}`);
        console.log(`[generate-scene-images] COVER - characters with refs: ${characters?.filter((c: any) => c.referenceImage)?.length || 0}`);
        console.log(`[generate-scene-images] COVER - props count: ${propsInCover.length}`);
        console.log(`[generate-scene-images] COVER - sceneReferenceImage exists: ${!!sceneReferenceImage}`);

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
        const charactersWithImages = charactersInCover.filter(c => c.referenceImage);

        console.log(`[generate-scene-images] Cover characters with reference images: ${charactersWithImages.map(c => `${c.name} (${isUrl(c.referenceImage!) ? 'URL' : 'base64'})`).join(', ') || 'none'}`);

        console.log(`[generate-scene-images] Cover characters with reference images to process:`);
        charactersWithImages.forEach((c, i) => {
          console.log(`  ${i + 1}. ${c.name}: type=${isUrl(c.referenceImage!) ? 'URL' : 'base64'}, length=${c.referenceImage!.length}, prefix=${c.referenceImage!.slice(0, 80)}`);
        });

        const processedResults = await Promise.all(
          charactersWithImages.map(async (c) => {
            console.log(`[generate-scene-images] Processing cover reference for ${c.name}...`);
            const image = await processReferenceImage(c.referenceImage!);
            console.log(`[generate-scene-images] Processed cover ${c.name}: result length=${image.length}, valid=${isValidImageBase64(image)}`);
            return {
              image,
              description: `${c.name}: ${c.visualDescription}`,
            };
          })
        );

        console.log(`[generate-scene-images] Cover processing complete. Results:`);
        processedResults.forEach((r, i) => {
          console.log(`  ${i + 1}. ${r.description.slice(0, 50)}: image length=${r.image.length}, valid=${isValidImageBase64(r.image)}`);
        });

        const validResults = processedResults.filter(r => r.image !== '');
        referenceImages = validResults.map(r => r.image);
        characterDescriptions = validResults.map(r => r.description);

        console.log(`[generate-scene-images] Cover reference images processed: ${referenceImages.length}/${charactersWithImages.length}`);

        // Process prop reference images (reuses landmark processing branch, cap 2 per prop)
        const coverPropRefImages: string[] = [];
        const coverPropRefDescriptions: string[] = [];
        if (propsInCover.length > 0) {
          for (const pr of propsInCover) {
            if (pr.referenceImages && pr.referenceImages.length > 0) {
              console.log(`[generate-scene-images] Processing ${pr.referenceImages.length} cover prop reference images for "${pr.name}"`);
              for (const refImg of pr.referenceImages.slice(0, 2)) {
                const processedPropRef = await processReferenceImage(refImg);
                if (processedPropRef) {
                  coverPropRefImages.push(processedPropRef);
                  coverPropRefDescriptions.push(`PROP REFERENCE - ${pr.name}: ${pr.visualDescription}. Render this prop EXACTLY as shown in this photo.`);
                  console.log(`[generate-scene-images] Cover prop ref image for "${pr.name}" added.`);
                }
              }
            }
          }
        }

        // Enforce cap: characters + props <= 12 (covers have no landmarks today).
        // Trim order: drop props first. Never drop characters.
        const COVER_MAX_PROCESSED = 12;
        const coverInitialTotal = referenceImages.length + coverPropRefImages.length;
        let coverDroppedProps = 0;

        if (coverInitialTotal > COVER_MAX_PROCESSED) {
          const overflow = coverInitialTotal - COVER_MAX_PROCESSED;
          const propsToDrop = Math.min(overflow, coverPropRefImages.length);
          if (propsToDrop > 0) {
            coverPropRefImages.splice(coverPropRefImages.length - propsToDrop, propsToDrop);
            coverPropRefDescriptions.splice(coverPropRefDescriptions.length - propsToDrop, propsToDrop);
            coverDroppedProps = propsToDrop;
          }
          const finalCount = referenceImages.length + coverPropRefImages.length;
          console.warn(
            `[generate-scene-images] Trimmed cover reference images to stay under ${COVER_MAX_PROCESSED}-image cap`,
            { initialTotal: coverInitialTotal, droppedProps: coverDroppedProps, droppedLandmarks: 0, finalCount }
          );
        }

        referenceImages.push(...coverPropRefImages);
        characterDescriptions.push(...coverPropRefDescriptions);

        if (sceneReferenceImage) {
          console.log(`[generate-scene-images] Cover style reference image received! Type: ${isUrl(sceneReferenceImage) ? 'URL' : 'base64'}, Length: ${sceneReferenceImage.length}, Prefix: ${sceneReferenceImage.slice(0, 30)}`);
          const processedSceneRef = await processReferenceImage(sceneReferenceImage);
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
        const { referenceImage: endReferenceImage, customPrompt: endCustomPrompt } = requestData;

        if (endCustomPrompt) {
          const stylePrompt = ILLUSTRATION_STYLES[styleId] || ILLUSTRATION_STYLES['storybook'];
          prompt = `${stylePrompt}

IMAGEN FINAL "FIN" PARA CUENTO INFANTIL

${endCustomPrompt}

Instrucciones críticas:
- Composición atractiva para página final de libro infantil
- Escena brillante y bien iluminada
- Atmósfera de cierre y satisfacción
- Imágenes apropiadas para niños 5-10 años
- **ABSOLUTAMENTE SIN TEXTO, SIN PALABRAS, SIN LETRAS EN LA IMAGEN**
- Puede ser abstracta o con elementos del cuento`;
          console.log(`[generate-scene-images] End using custom prompt`);
        } else {
          prompt = buildEndPrompt(styleId);
        }

        if (endReferenceImage) {
          console.log(`[generate-scene-images] End reference image type: ${isUrl(endReferenceImage) ? 'URL' : 'base64'}`);
          const processedImage = await processReferenceImage(endReferenceImage);
          if (processedImage) {
            referenceImages.push(processedImage);
            characterDescriptions.push('END STYLE REFERENCE - Use this image as visual style reference for the final image');
            console.log(`[generate-scene-images] End reference image processed successfully`);
          }
        }
        break;
      }

      default:
        throw new Error(`Tipo no válido: ${type}. Use: scene, character, cover, end`);
    }

    console.log(`[generate-scene-images] Prompt (${type}):`, prompt.slice(0, 300) + '...');
    console.log(`[generate-scene-images] FINAL STATE - Passing ${referenceImages.length} reference images to Gemini`);
    console.log(`[generate-scene-images] FINAL STATE - Character descriptions: ${characterDescriptions.join(' | ') || 'none'}`);
    referenceImages.forEach((img, idx) => {
      console.log(`[generate-scene-images] FINAL ref image ${idx}: length=${img?.length || 0}, isValid=${isValidImageBase64(img)}, prefix=${img?.slice(0, 20) || 'empty'}`);
    });

    const promises = [];
    for (let i = 0; i < Math.min(count, 4); i++) {
      promises.push(generateImage(prompt, i, referenceImages, characterDescriptions));
    }

    const settledResults = await Promise.allSettled(promises);

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

    if (images.length === 0 && errors.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: errors[0],
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

  } catch (error: unknown) {
    console.error('[generate-scene-images] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error generando imágenes',
        images: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
