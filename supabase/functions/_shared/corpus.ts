/**
 * FASE F — behaviour corpus.
 *
 * A set of request payloads modelled on what the editor ACTUALLY sends, used
 * to pin one property: **a request `cc-cleanup` answered 200 to still gets a
 * 200**, unless this file says otherwise in writing.
 *
 * ## Why this exists
 *
 * Two review rounds of FASE F failed for the same reason in different
 * clothes: validation that was correct in isolation rejected requests the old
 * code served. Round 1 found four such cases; round 2 found five more, all
 * from a single flag that pass 1 never learned about. Every one of them was
 * found by a human reading code, and every one of them is mechanically
 * detectable — you only have to run the old handler and the new one over the
 * same payload and compare.
 *
 * So the expectations here are NOT hand-written. `corpus_baseline.json` is
 * captured by running these payloads through `b241eaf` — the pure extraction
 * commit, which is `cc-cleanup`'s behaviour made importable — and committed.
 * Hand-written expectations are exactly where an author's assumptions leak in,
 * which is the failure this corpus is meant to catch.
 *
 * ## Where the payloads come from
 *
 * Each is derived from a real `supabase.functions.invoke` call site, cited per
 * case. Shapes worth knowing, because they are not what you would guess:
 *   * `type: 'character'` sends NO reference image — just a text description.
 *   * `generate-story` sends `characters` as an array of STRINGS (split from a
 *     comma-separated field), not objects.
 *   * `generate-story` sends no `landmarks` at all; only `props`.
 *
 * ## Adding a case
 *
 * Add it here, re-run the capture script, commit the updated baseline. If the
 * new case's baseline status is a 4xx, say so — a corpus that quietly encodes
 * the old code's failures as "expected" is worth very little.
 */

export type CorpusFn = "scene-images" | "story";

export interface CorpusCase {
  /** Stable key into the baseline file. Renaming one orphans its baseline. */
  name: string;
  fn: CorpusFn;
  /** The `src/` call site this shape was taken from. */
  origin: string;
  payload: Record<string, unknown>;
  /**
   * A deliberate divergence from `cc-cleanup`. Present ONLY where FASE F is
   * meant to change the answer — i.e. the provenance rejections that are the
   * entire point of the phase. Anything else diverging is a regression.
   */
  intentional?: { status: number; code: string; why: string };
  /**
   * Relaxes the "never fetch what cc-cleanup did not" rule for this case.
   *
   * Only `generate-story` needs it: cc-cleanup passed a bucket URL to Gemini
   * as `inlineData.data`, i.e. base64-decoded a URL string into garbage and
   * called it an image. It fetched nothing because it never realised it had a
   * URL. Materialising it properly is the fix, so "cc-cleanup did not fetch
   * this" is not a property worth preserving here.
   */
  mayFetchMore?: { why: string };
}

// ---------------------------------------------------------------------------
// Fixtures. Deliberately tiny except where size is the subject.
// ---------------------------------------------------------------------------

const BUCKET = "https://proj.supabase.co/storage/v1/object/public/cuentacuentos-drafts";

function magic(bytes: number[], size: number): string {
  const out = new Uint8Array(size);
  out.set(bytes, 0);
  for (let i = bytes.length; i < size; i++) out[i] = i % 251;
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < out.length; i += CHUNK) {
    binary += String.fromCharCode(...out.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

const PNG = (size = 64) => magic([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], size);
const JPEG = (size = 64) => magic([0xff, 0xd8, 0xff, 0xe0], size);

/**
 * Prop and landmark photos arrive as DATA URLs, not raw base64.
 * `PropInput.tsx:58` and `LandmarkInput.tsx:65` both use `readAsDataURL` and
 * never strip the prefix — unlike the character-sheet path, which does.
 *
 * The corpus originally sent raw base64 here, which is not what the app sends.
 * It passed, but it was testing a shape the editor never produces.
 */
const DATA_PNG = (size = 64) => `data:image/png;base64,${PNG(size)}`;
const DATA_JPEG = (size = 64) => `data:image/jpeg;base64,${JPEG(size)}`;
/** An iPhone photo. The upload paths gate on `image/*` only, so it gets through. */
const HEIC = (size = 64) => {
  const out = new Uint8Array(size);
  out.set([0x00, 0x00, 0x00, 0x18], 0);
  out.set([0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], 4);
  let binary = "";
  for (let i = 0; i < out.length; i++) binary += String.fromCharCode(out[i]);
  return btoa(binary);
};

const character = (name: string, referenceImage?: string) => ({
  name,
  visualDescription: `${name}, niña de 8 años, chaleco rojo`,
  ...(referenceImage ? { referenceImage } : {}),
});

const scene = { text: "Ana camina por el muelle al atardecer.", visualDescription: "muelle, luz dorada" };
const location = { name: "Valparaíso", type: "urbano", description: "puerto", visualElements: [], colors: [], lighting: "natural" };

export const CORPUS: CorpusCase[] = [
  // -------------------------------------------------------------------------
  // The four generate paths, in their plainest form.
  // -------------------------------------------------------------------------
  {
    name: "character-sheet",
    fn: "scene-images",
    origin: "CuentacuentoEditor.tsx:1470 handleGenerateCharacterSheet",
    // Note: no reference image. The editor never sends one for this type.
    payload: {
      type: "character",
      styleId: "storybook",
      character: { name: "Ana", description: "protagonista", visualDescription: "niña de 8 años" },
      count: 4,
    },
  },
  {
    name: "scene-no-references",
    fn: "scene-images",
    origin: "CuentacuentoEditor.tsx:1588 handleGenerateSceneImages",
    payload: { type: "scene", styleId: "storybook", scene, location, characters: [], count: 4 },
  },
  {
    name: "cover-plain",
    fn: "scene-images",
    origin: "CuentacuentoEditor.tsx:1734 handleGenerateCover",
    payload: {
      type: "cover",
      styleId: "storybook",
      title: "El faro de Ana",
      protagonist: { visualDescription: "niña de 8 años" },
      location,
      characters: [],
      count: 4,
    },
  },
  {
    name: "end-plain",
    fn: "scene-images",
    origin: "CuentacuentoEditor.tsx:1835 handleGenerateEnd",
    payload: { type: "end", styleId: "storybook", count: 4 },
  },

  // -------------------------------------------------------------------------
  // Reference images, in the states a draft actually holds them.
  // -------------------------------------------------------------------------
  {
    name: "scene-one-bucket-reference",
    fn: "scene-images",
    origin: "CuentacuentoEditor.tsx:1588 after a save swapped base64 -> URL",
    payload: {
      type: "scene",
      styleId: "storybook",
      scene,
      location,
      characters: [character("Ana", `${BUCKET}/ana.png`)],
      count: 4,
    },
  },
  {
    name: "scene-inline-reference",
    fn: "scene-images",
    origin: "CuentacuentoEditor.tsx:1588 before the first save (still base64)",
    payload: {
      type: "scene",
      styleId: "storybook",
      scene,
      location,
      characters: [character("Ana", PNG()), character("Beto", JPEG())],
      count: 4,
    },
  },
  {
    name: "cover-five-characters",
    fn: "scene-images",
    origin: "CuentacuentoEditor.tsx:1734 — a five-character story",
    // The exact shape that round 1 found rejected (B1).
    payload: {
      type: "cover",
      styleId: "storybook",
      title: "El faro de Ana",
      protagonist: { visualDescription: "niña de 8 años" },
      location,
      characters: ["Ana", "Beto", "Caro", "Dani", "Eli"].map((n) => character(n, PNG())),
      count: 4,
    },
  },
  {
    name: "scene-with-style-reference-and-props",
    fn: "scene-images",
    origin: "CuentacuentoEditor.tsx:1588 with sceneReferenceImage + getPropsForScene",
    payload: {
      type: "scene",
      styleId: "storybook",
      scene,
      location,
      characters: [character("Ana", `${BUCKET}/ana.png`)],
      sceneReferenceImage: `${BUCKET}/ref.png`,
      sceneReferenceMode: "style",
      props: [
        { id: "p1", name: "Farol", visualDescription: "farol de bronce", referenceImages: [DATA_PNG(), DATA_JPEG()] },
        { id: "p2", name: "Bote", visualDescription: "bote azul", referenceImages: [`${BUCKET}/bote.png`] },
      ],
      count: 4,
    },
  },
  {
    name: "scene-landmark-visible",
    fn: "scene-images",
    origin: "CuentacuentoEditor.tsx:1588 with scene.landmarkVisible",
    payload: {
      type: "scene",
      styleId: "storybook",
      scene: { ...scene, landmarkVisible: true },
      location,
      characters: [character("Ana", PNG())],
      landmarks: [{
        name: "Faro",
        visualDescription: "faro rojo y blanco",
        referenceImages: [DATA_PNG(), DATA_PNG(), DATA_PNG(), DATA_PNG()],
      }],
      count: 4,
    },
  },
  {
    name: "end-with-reference-and-characters",
    fn: "scene-images",
    origin: "CuentacuentoEditor.tsx:1835",
    payload: {
      type: "end",
      styleId: "storybook",
      referenceImage: `${BUCKET}/end-ref.png`,
      characters: [character("Ana", PNG()), character("Beto", PNG())],
      count: 4,
    },
  },

  // -------------------------------------------------------------------------
  // States a long-lived draft accumulates. Every one of these was a
  // regression in at least one FASE F round.
  // -------------------------------------------------------------------------
  {
    name: "draft-with-many-prop-photos",
    fn: "scene-images",
    origin: "handleUploadPropPhoto appends with no count limit and no delete",
    payload: {
      type: "scene",
      styleId: "storybook",
      scene,
      location,
      characters: [character("Ana", PNG())],
      props: Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`,
        name: `Objeto ${i}`,
        visualDescription: "objeto",
        referenceImages: [DATA_PNG(), DATA_PNG(), DATA_PNG(), DATA_PNG()],
      })),
      count: 4,
    },
  },
  {
    name: "draft-with-dead-bucket-reference",
    fn: "scene-images",
    origin: "an object deleted from cuentacuentos-drafts while the draft still cites it",
    payload: {
      type: "scene",
      styleId: "storybook",
      scene,
      location,
      characters: [character("Ana", `${BUCKET}/gone.png`), character("Beto", PNG())],
      count: 4,
    },
  },
  {
    name: "draft-with-heic-photo",
    fn: "scene-images",
    origin: "ImageUploadButton.tsx:23 gates on image/* only — iPhone photos arrive as HEIC",
    payload: {
      type: "scene",
      styleId: "storybook",
      scene,
      location,
      characters: [character("Ana", HEIC()), character("Beto", PNG())],
      count: 4,
    },
  },
  {
    name: "draft-with-legacy-signed-url",
    fn: "scene-images",
    origin: "storyData written before 2026-01-11 stored signed characterSheetUrls",
    payload: {
      type: "scene",
      styleId: "storybook",
      scene,
      location,
      characters: [
        character("Ana", "https://proj.supabase.co/storage/v1/object/sign/cuentacuentos-drafts/old.png?token=expired"),
        character("Beto", PNG()),
      ],
      count: 4,
    },
  },
  {
    name: "draft-with-oversized-photo-in-unread-slot",
    fn: "scene-images",
    origin: "a landmark whose 3rd photo is a full-resolution upload; only 2 are read",
    payload: {
      type: "scene",
      styleId: "storybook",
      scene: { ...scene, landmarkVisible: true },
      location,
      characters: [],
      landmarks: [{
        name: "Faro",
        visualDescription: "faro rojo",
        // Over the 6 MB per-image cap, at an index the handler never reads.
        referenceImages: [DATA_PNG(), DATA_PNG(), DATA_PNG(6_200_000)],
      }],
      count: 4,
    },
  },
  {
    name: "scene-with-data-url-reference",
    fn: "scene-images",
    origin: "a client that did not strip the data: prefix",
    payload: {
      type: "scene",
      styleId: "storybook",
      scene,
      location,
      characters: [character("Ana", `data:image/png;base64,${PNG()}`)],
      count: 4,
    },
  },

  // -------------------------------------------------------------------------
  // Refine.
  // -------------------------------------------------------------------------
  {
    name: "refine-scene-from-bucket",
    fn: "scene-images",
    origin: "CuentacuentoEditor.tsx:1981 handleRefineSceneImage",
    payload: {
      type: "scene",
      styleId: "storybook",
      scene,
      location,
      characters: [character("Ana", PNG())],
      refine: { sourceImage: `${BUCKET}/scene-1.png`, feedback: "más luz cálida" },
      count: 4,
    },
  },
  {
    name: "refine-character-from-inline",
    fn: "scene-images",
    origin: "CuentacuentoEditor.tsx:1892 handleRefineCharacterSheet",
    payload: {
      type: "character",
      styleId: "storybook",
      character: { name: "Ana", description: "protagonista", visualDescription: "niña de 8 años" },
      refine: { sourceImage: PNG(), feedback: "pelo más largo" },
      count: 4,
    },
  },

  // -------------------------------------------------------------------------
  // generate-story.
  // -------------------------------------------------------------------------
  {
    name: "story-minimal",
    fn: "story",
    origin: "CuentacuentoEditor.tsx:1151 getRequestBody",
    payload: {
      context: { title: "Adviento", summary: "Esperanza", readings: [], reflexionText: undefined },
      location: "Valparaíso",
      // NOTE: strings, not objects — split from a comma-separated field.
      characters: ["Ana", "Beto"],
      style: "reflexivo",
      additionalNotes: "",
    },
  },
  {
    name: "story-preview-prompt-only",
    fn: "story",
    origin: "CuentacuentoEditor.tsx:1194 handlePreviewPrompt",
    payload: {
      context: { title: "Adviento", summary: "Esperanza", readings: [] },
      location: "Valparaíso",
      characters: ["Ana"],
      style: "reflexivo",
      additionalNotes: "",
      previewPromptOnly: true,
    },
  },
  {
    name: "story-with-prop-photos",
    fn: "story",
    origin: "CuentacuentoEditor.tsx:1170 storyProps mapping",
    payload: {
      context: { title: "Adviento", summary: "Esperanza", readings: [] },
      location: "Valparaíso",
      characters: ["Ana"],
      style: "reflexivo",
      additionalNotes: "",
      props: [
        { id: "p1", kind: "prop", name: "Farol", narrativeRole: "guía", referenceImages: [DATA_PNG(), DATA_JPEG()], role: "primary" },
        { id: "p2", kind: "location", name: "Muelle", narrativeRole: "escenario", referenceImages: [`${BUCKET}/muelle.png`], role: "secondary" },
      ],
    },
    mayFetchMore: {
      why:
        "cc-cleanup sent the bucket URL to Gemini as inlineData.data — a URL " +
        "string decoded as image bytes. It fetched nothing because it never " +
        "recognised the URL. FASE F downloads it and sends real bytes.",
    },
  },
  {
    name: "story-with-many-prop-photos",
    fn: "story",
    origin: "a draft whose props accumulated photos over months",
    payload: {
      context: { title: "Adviento", summary: "Esperanza", readings: [] },
      location: "Valparaíso",
      characters: ["Ana"],
      style: "reflexivo",
      additionalNotes: "",
      props: Array.from({ length: 6 }, (_, i) => ({
        id: `p${i}`,
        kind: "prop",
        name: `Objeto ${i}`,
        narrativeRole: "apoyo",
        referenceImages: [DATA_PNG(), DATA_PNG(), DATA_PNG(), DATA_PNG(), DATA_PNG()],
        role: "secondary",
      })),
    },
  },

  {
    name: "story-builder-with-reference-photo",
    fn: "story",
    origin: "PropInput.tsx — the only way a reference photo reaches the STORY builder",
    // The story builder receives reference images through props alone; the
    // editor's request body sends no landmarks. Four photos is the UI's own
    // per-prop maximum (PropInput.tsx:24 maxImages = 4).
    payload: {
      context: { title: "Adviento", summary: "Esperanza", readings: [] },
      location: "Valparaíso",
      characters: ["Ana"],
      style: "reflexivo",
      additionalNotes: "",
      props: [{
        id: "p1",
        kind: "location",
        name: "Faro de Punta Ángeles",
        narrativeRole: "el faro que guía a Ana",
        referenceImages: [DATA_PNG(), DATA_JPEG(), DATA_PNG(), DATA_JPEG()],
        role: "primary",
      }],
    },
  },

  {
    name: "story-builder-at-the-UI-size-limit",
    fn: "story",
    origin: "PropInput.tsx:11 MAX_IMAGE_BYTES = 5MB, :24 maxImages = 4",
    // The most the UI will let you attach to ONE prop: four photos of 5 MB.
    // If the edge function refuses this, the app is offering something it
    // cannot deliver — which is the kind of mismatch worth knowing about
    // before it reaches a user, not after.
    payload: {
      context: { title: "Adviento", summary: "Esperanza", readings: [] },
      location: "Valparaíso",
      characters: ["Ana"],
      style: "reflexivo",
      additionalNotes: "",
      props: [{
        id: "p1",
        kind: "location",
        name: "Faro",
        narrativeRole: "guía",
        referenceImages: [
          DATA_PNG(5_000_000),
          DATA_PNG(5_000_000),
          DATA_PNG(5_000_000),
          DATA_PNG(5_000_000),
        ],
        role: "primary",
      }],
    },
    intentional: {
      status: 413,
      code: "BODY_TOO_LARGE",
      why:
        "NOT a clean win — this records a UI/backend mismatch that predates " +
        "FASE F and needs a frontend fix. PropInput offers 4 photos x 5 MB on " +
        "one prop = 20 MB of image data, which is ~27 MB once base64-encoded " +
        "into JSON. cc-cleanup accepted it, spent the CPU assembling it, and " +
        "then handed the provider more than a single request can carry. " +
        "Rejecting up front with a clear message is better, but the real fix " +
        "is for the editor to stop offering a combination that cannot work: " +
        "downscaling on upload would make this disappear entirely. Tracked in " +
        "FASE_F_WRITEUP.md as a pre-deploy item.",
    },
  },

  // -------------------------------------------------------------------------
  // Deliberate divergences. These are the point of FASE F: cc-cleanup served
  // them, and it should not have.
  // -------------------------------------------------------------------------
  {
    name: "REJECT-foreign-origin",
    fn: "scene-images",
    origin: "a payload naming a host that is not the bucket",
    payload: {
      type: "scene",
      styleId: "storybook",
      scene,
      location,
      characters: [character("Ana", "https://evil.example.com/x.png")],
      count: 4,
    },
    intentional: {
      status: 422,
      code: "FORBIDDEN_ORIGIN",
      why: "Invariant 11: only the pinned bucket origin may be fetched. cc-cleanup fetched any URL it was handed.",
    },
  },
  {
    name: "REJECT-plain-http",
    fn: "scene-images",
    origin: "a bucket URL downgraded to http",
    payload: {
      type: "scene",
      styleId: "storybook",
      scene,
      location,
      characters: [character("Ana", "http://proj.supabase.co/storage/v1/object/public/cuentacuentos-drafts/x.png")],
      count: 4,
    },
    intentional: {
      status: 422,
      code: "INSECURE_SCHEME",
      why: "Invariant 11: HTTPS only. cc-cleanup's isUrl() accepted http:// and fetched it in the clear.",
    },
  },
  {
    name: "REJECT-foreign-bucket",
    fn: "scene-images",
    origin: "a URL on the right host but a different bucket",
    payload: {
      type: "scene",
      styleId: "storybook",
      scene,
      location,
      characters: [character("Ana", "https://proj.supabase.co/storage/v1/object/public/other-bucket/x.png")],
      count: 4,
    },
    intentional: {
      status: 422,
      code: "FORBIDDEN_BUCKET",
      why: "Invariant 11: the drafts bucket only. Same host is not the same bucket.",
    },
  },
];
