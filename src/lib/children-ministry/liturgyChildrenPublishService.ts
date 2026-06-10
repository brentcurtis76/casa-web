/**
 * Liturgy Children Publish Service — Orchestration
 *
 * Orchestrates the generation of children's activities from a Liturgy Builder
 * cuentacuentos element. Handles age group selection, lesson generation,
 * calendar session creation, and publication state tracking.
 *
 * Pattern: src/lib/music-planning/liturgyMusicPublishService.ts
 */

import { supabase } from '@/integrations/supabase/client';
import type { ChildrenAgeGroupRow, ChildrenLessonInsert } from '@/types/childrenMinistry';
import type {
  GeneratedLesson,
  PublishChildrenActivitiesResult,
  GroupGenerationResult,
  GenerateChildrenLessonResponse,
  RefinementType,
} from '@/types/childrenPublicationState';

export type { RefinementType };
import {
  getPublicationByLiturgyAndAgeGroup,
  createPublication,
  incrementPublishVersion,
} from '@/lib/children-ministry/childrenPublicationStateService';
import {
  getLesson,
  getLessonByLiturgyAndAgeGroup,
  createLesson,
  updateLesson,
  upsertLessonMaterialByType,
} from '@/lib/children-ministry/lessonService';
import {
  getSessionByDateAndAgeGroup,
  createSession,
  updateSession,
} from '@/lib/children-ministry/calendarService';
import { parseMaterials, serializeMaterials } from '@/lib/children-ministry/parseMaterials';

// ─── Age group mapping ──────────────────────────────────────────────────────

/** Strip diacritics so "Pequeños" and "Pequenos" both match */
function normalizeGroupName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Map from normalized DB age group names to Edge Function identifiers */
const AGE_GROUP_MAPPING: Record<string, 'nursery' | 'preschool' | 'elementary' | 'mixed'> = {
  'pequenos': 'nursery',
  'medianos': 'preschool',
  'grandes': 'elementary',
  'grupo mixto': 'mixed',
};

// ─── Structured logging ─────────────────────────────────────────────────────

interface PublishLogFields {
  liturgyId: string;
  ageGroupId?: string;
  ageGroupName?: string;
  groupIndex?: number;
  groupCount?: number;
  step: string;
  status: 'start' | 'ok' | 'error';
  durationMs?: number;
  requestId?: string;
  lessonId?: string;
  calendarId?: string;
  publicationId?: string;
  error?: string;
}

function logPublish(fields: PublishLogFields): void {
  // Structured single-line JSON so logs can be grepped/joined by requestId or
  // (liturgyId, ageGroupId). Keep a stable `event` key for filtering.
  console.log(JSON.stringify({ event: 'children_publish', ts: new Date().toISOString(), ...fields }));
}

/**
 * Run an awaited step with start/end logging. The step's value is returned;
 * thrown errors are re-thrown after being logged so the caller can decide
 * whether to abort the group or continue.
 */
async function runStep<T>(
  step: string,
  baseFields: Omit<PublishLogFields, 'step' | 'status' | 'durationMs' | 'error'>,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  logPublish({ ...baseFields, step, status: 'start' });
  try {
    const value = await fn();
    logPublish({ ...baseFields, step, status: 'ok', durationMs: Date.now() - startedAt });
    return value;
  } catch (error) {
    logPublish({
      ...baseFields,
      step,
      status: 'error',
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Best-effort correlation id for joining client logs with Edge Function logs.
 * crypto.randomUUID exists in modern browsers and Node 19+, but fall back to
 * Math.random in unusual runtimes (e.g. older test environments).
 */
function makeRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Ensure a fresh Supabase auth session before invoking an Edge Function. Long
 * multi-group runs can outlive a JWT TTL; calling getSession() lets the client
 * auto-refresh, and if that fails we explicitly refresh once.
 */
async function ensureFreshSession(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      throw new Error(`No se pudo refrescar la sesión: ${refreshError.message}`);
    }
    return;
  }

  const session = data.session;
  if (!session) return;

  // expires_at is unix seconds; refresh proactively if <60s remaining so the
  // EF call doesn't race the expiry mid-flight.
  const expiresAtSec = session.expires_at;
  if (expiresAtSec && expiresAtSec - Math.floor(Date.now() / 1000) < 60) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      throw new Error(`No se pudo refrescar la sesión: ${refreshError.message}`);
    }
  }
}

// ─── Publication interface ──────────────────────────────────────────────────

export interface PublishChildrenActivitiesParams {
  liturgyId: string;
  liturgyTitle: string;
  liturgySummary: string;
  bibleText: string;
  liturgyDate: string; // ISO date (yyyy-MM-dd)
  storyData: {
    title: string;
    summary: string;
    spiritualConnection: string;
    scenes: Array<{ text: string }>;
  };
  selectedAgeGroupIds: string[];
  ageGroups: ChildrenAgeGroupRow[];
}

interface SingleGroupContext {
  liturgyId: string;
  liturgyTitle: string;
  liturgySummary: string;
  bibleText: string;
  liturgyDate: string;
  storyData: PublishChildrenActivitiesParams['storyData'];
  ageGroup: ChildrenAgeGroupRow;
  groupIndex: number;
  groupCount: number;
  userId: string | null;
}

// ─── Per-group orchestration ────────────────────────────────────────────────

/**
 * Publish a single age group as an isolated unit. Throws on the first failing
 * step; the caller wraps this in try/catch so one group's failure cannot block
 * others. Idempotent on (liturgy_id, age_group_id).
 */
async function publishSingleAgeGroup(ctx: SingleGroupContext): Promise<GroupGenerationResult> {
  const { liturgyId, ageGroup, groupIndex, groupCount, userId } = ctx;
  const ageGroupId = ageGroup.id;
  const ageGroupName = ageGroup.name;
  const requestId = makeRequestId();

  const baseFields = {
    liturgyId,
    ageGroupId,
    ageGroupName,
    groupIndex,
    groupCount,
    requestId,
  };

  // 1. Lookup any existing lesson for idempotency.
  const existingLesson = await runStep('lookup_lesson', baseFields, () =>
    getLessonByLiturgyAndAgeGroup(liturgyId, ageGroupId),
  );

  // 2. Refresh session, then invoke the generator EF for this group only.
  await runStep('ensure_session', baseFields, () => ensureFreshSession());

  const generationRequest = {
    liturgyId,
    liturgyTitle: ctx.liturgyTitle,
    liturgySummary: ctx.liturgySummary,
    bibleText: ctx.bibleText,
    storyData: ctx.storyData,
    ageGroup: AGE_GROUP_MAPPING[normalizeGroupName(ageGroupName)] || 'elementary',
    ageGroupLabel: ageGroupName,
    durationMax: 30,
    childrenCountMin: 2,
    childrenCountMax: 15,
    requestId,
  };

  const generatedData = await runStep('invoke_generate', baseFields, async () => {
    const { data: invokeData, error: invokeError } = await supabase.functions.invoke<
      GenerateChildrenLessonResponse
    >('generate-children-lesson', { body: generationRequest });

    if (invokeError) {
      throw new Error(
        `Error del servicio de generación: ${invokeError.message ?? 'Error desconocido'}`,
      );
    }
    if (!invokeData) {
      throw new Error(
        'El servicio de actividades retornó un formato de respuesta inesperado. Por favor intenta nuevamente.',
      );
    }
    if (!invokeData.success) {
      throw new Error(invokeData.error || 'Generation failed');
    }
    return invokeData;
  });

  // 3. Persist (or update) the lesson.
  const fullContent = JSON.stringify({
    sequence: generatedData.sequence,
    adaptations: generatedData.adaptations,
    volunteerPlan: generatedData.volunteerPlan,
  });
  const materialsNeeded = serializeMaterials(generatedData.materials);

  const lessonId = await runStep('upsert_lesson', baseFields, async () => {
    if (existingLesson) {
      const updated = await updateLesson(existingLesson.id, {
        title: generatedData.activityName,
        description: `Generado automáticamente para ${ageGroupName}`,
        duration_minutes: generatedData.estimatedTotalMinutes,
        content: fullContent,
        materials_needed: materialsNeeded,
        status: 'ready',
      });
      return updated.id;
    }

    const lessonInsert: ChildrenLessonInsert = {
      title: generatedData.activityName || 'Actividad de Niños',
      description: `Generado automáticamente para ${ageGroupName}`,
      age_group_id: ageGroupId,
      liturgy_id: liturgyId,
      duration_minutes: generatedData.estimatedTotalMinutes || 30,
      content: fullContent,
      materials_needed: materialsNeeded,
      status: 'ready',
      created_by: userId,
    };
    const created = await createLesson(lessonInsert);
    return created.id;
  });

  // 4. Link the cuentacuentos story as a lesson material (idempotent by type).
  await runStep('upsert_story_material', { ...baseFields, lessonId }, () =>
    upsertLessonMaterialByType({
      lesson_id: lessonId,
      name: `Cuento: ${ctx.storyData.title}`,
      type: 'story',
      url: `/liturgia/${liturgyId}/cuentacuentos`,
      story_id: null,
    }),
  );

  // 5. Calendar session for (date, age_group_id).
  const calendarId = await runStep('upsert_session', { ...baseFields, lessonId }, async () => {
    const existingSession = await getSessionByDateAndAgeGroup(ctx.liturgyDate, ageGroupId);
    if (existingSession) {
      const updated = await updateSession(existingSession.id, {
        lesson_id: lessonId,
        status: 'scheduled',
      });
      return updated.id;
    }
    const created = await createSession({
      date: ctx.liturgyDate,
      start_time: '10:00',
      end_time: '10:30',
      age_group_id: ageGroupId,
      lesson_id: lessonId,
      location: 'Sala de Ninos',
      status: 'scheduled' as const,
      created_by: userId,
    });
    return created.id;
  });

  // 6. Publication state for (liturgy_id, age_group_id).
  const publicationId = await runStep(
    'upsert_publication',
    { ...baseFields, lessonId, calendarId },
    async () => {
      const existing = await getPublicationByLiturgyAndAgeGroup(liturgyId, ageGroupId);
      if (existing) {
        await incrementPublishVersion(existing.id, {
          lesson_id: lessonId,
          calendar_id: calendarId,
          published_by: userId,
        });
        return existing.id;
      }
      const created = await createPublication({
        liturgy_id: liturgyId,
        age_group_id: ageGroupId,
        lesson_id: lessonId,
        calendar_id: calendarId,
        publish_version: 1,
        published_by: userId,
        published_at: new Date().toISOString(),
      });
      return created.id;
    },
  );

  logPublish({
    ...baseFields,
    step: 'group_complete',
    status: 'ok',
    lessonId,
    calendarId,
    publicationId,
  });

  return {
    ageGroupId,
    ageGroupLabel: ageGroupName,
    success: true,
    lessonId,
    calendarId,
    publishVersionId: publicationId,
    estimatedMinutes: generatedData.estimatedTotalMinutes,
  };
}

// ─── Main orchestration ─────────────────────────────────────────────────────

/**
 * Main orchestration function: generate children's activities from cuentacuentos,
 * create lessons and calendar sessions per age group, and track publication state.
 *
 * Each age group runs as an isolated unit: a failure in one group does not
 * prevent successful persistence of the others. Idempotent on
 * (liturgy_id, age_group_id) at every persistence step.
 */
export async function publishChildrenActivities(
  params: PublishChildrenActivitiesParams,
): Promise<PublishChildrenActivitiesResult> {
  const {
    liturgyId,
    liturgyTitle,
    liturgySummary,
    bibleText,
    liturgyDate: rawLiturgyDate,
    storyData,
    selectedAgeGroupIds,
    ageGroups,
  } = params;

  // Normalize to YYYY-MM-DD to prevent idempotency mismatches.
  const liturgyDate = rawLiturgyDate.includes('T') ? rawLiturgyDate.split('T')[0] : rawLiturgyDate;

  const groupCount = selectedAgeGroupIds.length;
  const results: GroupGenerationResult[] = [];
  const warnings: string[] = [];

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id || null;

  logPublish({
    liturgyId,
    step: 'run_start',
    status: 'start',
    groupCount,
  });

  // Fail fast if the liturgy row doesn't exist. church_children_lessons and
  // church_children_publication_state both FK liturgy_id → liturgias(id), so
  // every group would otherwise burn a ~60s generation call and then die at
  // upsert_lesson with a raw FK violation. This happens when the Constructor
  // liturgy was never saved (the id only exists in memory).
  const verifyStartedAt = Date.now();
  logPublish({ liturgyId, groupCount, step: 'verify_liturgy', status: 'start' });
  const { data: liturgyRow, error: liturgyLookupError } = await supabase
    .from('liturgias')
    .select('id')
    .eq('id', liturgyId)
    .maybeSingle();

  const verifyDurationMs = Date.now() - verifyStartedAt;
  const verifyError = liturgyLookupError
    ? `No se pudo verificar la liturgia: ${liturgyLookupError.message}`
    : !liturgyRow
      ? 'La liturgia no está guardada en la base de datos. Guarda la liturgia en el Constructor y vuelve a intentarlo.'
      : null;

  if (verifyError) {
    logPublish({
      liturgyId,
      groupCount,
      step: 'verify_liturgy',
      status: 'error',
      durationMs: verifyDurationMs,
      error: verifyError,
    });
    const failedResults: GroupGenerationResult[] = selectedAgeGroupIds.map((ageGroupId) => ({
      ageGroupId,
      ageGroupLabel: ageGroups.find((ag) => ag.id === ageGroupId)?.name ?? 'Unknown',
      success: false,
      error: verifyError,
    }));
    logPublish({ liturgyId, step: 'run_complete', status: 'error', groupCount });
    return {
      success: false,
      publicationCount: 0,
      results: failedResults,
      totalActivitiesGenerated: 0,
      warnings: failedResults.map(
        (r) => `Error generando actividad para ${r.ageGroupLabel}: ${verifyError}`,
      ),
    };
  }

  logPublish({
    liturgyId,
    groupCount,
    step: 'verify_liturgy',
    status: 'ok',
    durationMs: verifyDurationMs,
  });

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
    const ageGroupId = selectedAgeGroupIds[groupIndex];
    const ageGroup = ageGroups.find((ag) => ag.id === ageGroupId);

    if (!ageGroup) {
      logPublish({
        liturgyId,
        ageGroupId,
        groupIndex,
        groupCount,
        step: 'resolve_group',
        status: 'error',
        error: 'Grupo de edad no encontrado',
      });
      results.push({
        ageGroupId,
        ageGroupLabel: 'Unknown',
        success: false,
        error: 'Grupo de edad no encontrado',
      });
      continue;
    }

    try {
      const groupResult = await publishSingleAgeGroup({
        liturgyId,
        liturgyTitle,
        liturgySummary,
        bibleText,
        liturgyDate,
        storyData,
        ageGroup,
        groupIndex,
        groupCount,
        userId,
      });
      results.push(groupResult);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      logPublish({
        liturgyId,
        ageGroupId,
        ageGroupName: ageGroup.name,
        groupIndex,
        groupCount,
        step: 'group_complete',
        status: 'error',
        error: errorMessage,
      });
      results.push({
        ageGroupId,
        ageGroupLabel: ageGroup.name,
        success: false,
        error: errorMessage,
      });
      warnings.push(`Error generando actividad para ${ageGroup.name}: ${errorMessage}`);
    }
  }

  const publicationCount = results.filter((r) => r.success).length;

  logPublish({
    liturgyId,
    step: 'run_complete',
    status: publicationCount > 0 ? 'ok' : 'error',
    groupCount,
  });

  return {
    success: publicationCount > 0,
    publicationCount,
    results,
    totalActivitiesGenerated: publicationCount,
    warnings,
  };
}

// ─── Refinement ─────────────────────────────────────────────────────────────

export interface RefineChildrenActivityParams {
  lessonId: string;
  feedback: string;
  refinementType?: RefinementType;
  liturgyContext?: {
    title?: string;
    summary?: string;
  };
}

interface RefineChildrenLessonResponse {
  success: boolean;
  activityName?: string;
  materials?: string[];
  sequence?: GeneratedLesson['sequence'];
  adaptations?: GeneratedLesson['adaptations'];
  volunteerPlan?: GeneratedLesson['volunteerPlan'];
  estimatedTotalMinutes?: number;
  refinementNotes?: string;
  error?: string;
}

/**
 * Refine an existing children's lesson via the refine-children-lesson Edge Function.
 * Updates the lesson in place and bumps the publication's publish_version.
 */
export async function refineChildrenActivity(
  params: RefineChildrenActivityParams
): Promise<GroupGenerationResult> {
  const { lessonId, feedback, refinementType = 'general', liturgyContext } = params;

  const lesson = await getLesson(lessonId);

  const ageGroupId = lesson.age_group_id;
  const ageGroupLabel = lesson.age_group?.name ?? 'Grupo';

  if (!ageGroupId) {
    return {
      ageGroupId: '',
      ageGroupLabel,
      success: false,
      error: 'La lección no tiene un grupo de edad asociado',
    };
  }

  if (!lesson.content) {
    return {
      ageGroupId,
      ageGroupLabel,
      success: false,
      error: 'La lección no tiene contenido para refinar',
    };
  }

  let parsedContent: {
    sequence: GeneratedLesson['sequence'];
    adaptations: GeneratedLesson['adaptations'];
    volunteerPlan: GeneratedLesson['volunteerPlan'];
  };
  try {
    parsedContent = JSON.parse(lesson.content);
  } catch {
    return {
      ageGroupId,
      ageGroupLabel,
      success: false,
      error: 'El contenido de la lección no tiene un formato JSON válido',
    };
  }

  const currentMaterials = parseMaterials(lesson.materials_needed);

  const currentLesson = {
    activityName: lesson.title,
    sequence: parsedContent.sequence,
    adaptations: parsedContent.adaptations,
    volunteerPlan: parsedContent.volunteerPlan,
    materials: currentMaterials,
    estimatedTotalMinutes: lesson.duration_minutes,
  };

  try {
    await ensureFreshSession();
    const { data: invokeData, error: invokeError } = await supabase.functions.invoke<
      RefineChildrenLessonResponse
    >('refine-children-lesson', {
      body: {
        currentLesson,
        feedback,
        refinementType,
        liturgyContext,
        ageGroupLabel,
      },
    });

    if (invokeError) {
      throw new Error(
        `Error del servicio de refinamiento: ${invokeError.message ?? 'Error desconocido'}`
      );
    }

    if (!invokeData) {
      throw new Error(
        'El servicio de refinamiento retornó un formato de respuesta inesperado. Por favor intenta nuevamente.'
      );
    }

    const refined: RefineChildrenLessonResponse = invokeData;

    if (
      !refined.success ||
      !refined.sequence ||
      !refined.adaptations ||
      !refined.volunteerPlan ||
      !refined.materials ||
      !refined.activityName ||
      refined.estimatedTotalMinutes === undefined
    ) {
      throw new Error(refined.error || 'Refinamiento falló');
    }

    const newContent = JSON.stringify({
      sequence: refined.sequence,
      adaptations: refined.adaptations,
      volunteerPlan: refined.volunteerPlan,
    });

    await updateLesson(lessonId, {
      title: refined.activityName,
      content: newContent,
      materials_needed: serializeMaterials(refined.materials),
      duration_minutes: refined.estimatedTotalMinutes,
      status: 'ready',
    });

    if (lesson.liturgy_id) {
      const publication = await getPublicationByLiturgyAndAgeGroup(lesson.liturgy_id, ageGroupId);
      if (publication) {
        const { data: authData } = await supabase.auth.getUser();
        await incrementPublishVersion(publication.id, {
          published_by: authData?.user?.id ?? null,
        });
      }
    }

    return {
      ageGroupId,
      ageGroupLabel,
      success: true,
      lessonId,
      estimatedMinutes: refined.estimatedTotalMinutes,
      refinementNotes: refined.refinementNotes,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return {
      ageGroupId,
      ageGroupLabel,
      success: false,
      error: errorMessage,
    };
  }
}
