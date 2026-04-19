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

// ─── Main orchestration ─────────────────────────────────────────────────────

/**
 * Main orchestration function: generate children's activities from cuentacuentos,
 * create lessons and calendar sessions per age group, and track publication state.
 */
export async function publishChildrenActivities(
  params: PublishChildrenActivitiesParams
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

  // Normalize to YYYY-MM-DD to prevent idempotency mismatches
  const liturgyDate = rawLiturgyDate.includes('T') ? rawLiturgyDate.split('T')[0] : rawLiturgyDate;

  const results: GroupGenerationResult[] = [];
  const warnings: string[] = [];
  let totalActivitiesGenerated = 0;

  // Get current user for published_by
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id || null;

  // Process each selected age group
  for (const ageGroupId of selectedAgeGroupIds) {
    const ageGroup = ageGroups.find((ag) => ag.id === ageGroupId);
    if (!ageGroup) {
      results.push({
        ageGroupId,
        ageGroupLabel: 'Unknown',
        success: false,
        error: 'Grupo de edad no encontrado',
      });
      continue;
    }

    try {
      // 1. Check for existing lesson (idempotency)
      const existingLesson = await getLessonByLiturgyAndAgeGroup(liturgyId, ageGroupId);

      // 2. Generate lesson via Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mulsqxfhxxdsadxsljss.supabase.co';
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/generate-children-lesson`;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('No authentication token available');
      }

      const generationRequest = {
        liturgyId,
        liturgyTitle,
        liturgySummary,
        bibleText,
        storyData,
        ageGroup: AGE_GROUP_MAPPING[normalizeGroupName(ageGroup.name)] || 'elementary',
        ageGroupLabel: ageGroup.name,
        durationMax: 30,
        childrenCountMin: 2,
        childrenCountMax: 15,
      };

      const generationResponse = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(generationRequest),
      });

      // Check status BEFORE parsing JSON — non-OK responses may return non-JSON bodies
      // (e.g., HTML gateway errors, Supabase timeout pages). Calling .json() first
      // would throw a SyntaxError that surfaces as "unexpected JSON response" to the user.
      if (!generationResponse.ok) {
        const errorText = await generationResponse.text();
        throw new Error(
          `Error del servicio de generación (${generationResponse.status}): ${errorText.slice(0, 200)}`
        );
      }

      // Safe JSON parse — guard against unexpected format even on 2xx responses
      let generatedData: GenerateChildrenLessonResponse;
      try {
        generatedData = (await generationResponse.json()) as GenerateChildrenLessonResponse;
      } catch {
        throw new Error(
          'El servicio de actividades retornó un formato de respuesta inesperado. Por favor intenta nuevamente.'
        );
      }

      if (!generatedData.success) {
        throw new Error(generatedData.error || 'Generation failed');
      }

      // 3. Create or update lesson
      let lessonId: string;

      // Store full generated data (sequence + adaptations + volunteerPlan) so the
      // PDF exporter and UI can access all fields without losing information.
      const fullContent = JSON.stringify({
        sequence: generatedData.sequence,
        adaptations: generatedData.adaptations,
        volunteerPlan: generatedData.volunteerPlan,
      });

      if (existingLesson) {
        // Update existing lesson
        const updated = await updateLesson(existingLesson.id, {
          title: generatedData.activityName,
          description: `Generado automáticamente para ${ageGroup.name}`,
          duration_minutes: generatedData.estimatedTotalMinutes,
          content: fullContent,
          materials_needed: generatedData.materials.join(', '),
          status: 'ready',
        });
        lessonId = updated.id;
      } else {
        // Create new lesson
        const lessonInsert: ChildrenLessonInsert = {
          title: generatedData.activityName || 'Actividad de Niños',
          description: `Generado automáticamente para ${ageGroup.name}`,
          age_group_id: ageGroupId,
          liturgy_id: liturgyId,
          duration_minutes: generatedData.estimatedTotalMinutes || 30,
          content: fullContent,
          materials_needed: generatedData.materials.join(', '),
          status: 'ready',
          created_by: userId,
        };

        const created = await createLesson(lessonInsert);
        lessonId = created.id;
      }

      // 4. Link cuentacuentos story as a lesson material (type: 'story')
      // Idempotent: upserts by lesson_id + type to avoid duplicates on republish.
      // story_id is null because cuentacuentos stories are embedded in the liturgy,
      // not stored in a separate story table. The stable URL references the liturgy.
      const storyRef = `/liturgia/${liturgyId}/cuentacuentos`;
      await upsertLessonMaterialByType({
        lesson_id: lessonId,
        name: `Cuento: ${storyData.title}`,
        type: 'story',
        url: storyRef,
        story_id: null,
      });

      // 5. Create or update calendar session
      let calendarId: string;

      const existingSession = await getSessionByDateAndAgeGroup(liturgyDate, ageGroupId);

      if (existingSession) {
        const updated = await updateSession(existingSession.id, {
          lesson_id: lessonId,
          status: 'scheduled',
        });
        calendarId = updated.id;
      } else {
        const sessionInsert = {
          date: liturgyDate,
          start_time: '10:00',
          end_time: '10:30',
          age_group_id: ageGroupId,
          lesson_id: lessonId,
          location: 'Sala de Ninos',
          status: 'scheduled' as const,
          created_by: userId,
        };

        const created = await createSession(sessionInsert);
        calendarId = created.id;
      }

      // 6. Create or update publication state
      const existingPublication = await getPublicationByLiturgyAndAgeGroup(liturgyId, ageGroupId);

      if (existingPublication) {
        await incrementPublishVersion(existingPublication.id, {
          lesson_id: lessonId,
          calendar_id: calendarId,
          published_by: userId,
        });
      } else {
        await createPublication({
          liturgy_id: liturgyId,
          age_group_id: ageGroupId,
          lesson_id: lessonId,
          calendar_id: calendarId,
          publish_version: 1,
          published_by: userId,
          published_at: new Date().toISOString(),
        });
      }

      results.push({
        ageGroupId,
        ageGroupLabel: ageGroup.name,
        success: true,
        lessonId,
        calendarId,
        estimatedMinutes: generatedData.estimatedTotalMinutes,
      });

      totalActivitiesGenerated++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      results.push({
        ageGroupId,
        ageGroupLabel: ageGroup.name,
        success: false,
        error: errorMessage,
      });
      warnings.push(`Error generando actividad para ${ageGroup.name}: ${errorMessage}`);
    }
  }

  return {
    success: totalActivitiesGenerated > 0,
    publicationCount: results.filter((r) => r.success).length,
    results,
    totalActivitiesGenerated,
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

  const currentMaterials = lesson.materials_needed
    ? lesson.materials_needed.split(',').map((m) => m.trim()).filter(Boolean)
    : [];

  const currentLesson = {
    activityName: lesson.title,
    sequence: parsedContent.sequence,
    adaptations: parsedContent.adaptations,
    volunteerPlan: parsedContent.volunteerPlan,
    materials: currentMaterials,
    estimatedTotalMinutes: lesson.duration_minutes,
  };

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    return {
      ageGroupId,
      ageGroupLabel,
      success: false,
      error: 'No authentication token available',
    };
  }

  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL || 'https://mulsqxfhxxdsadxsljss.supabase.co';
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/refine-children-lesson`;

  try {
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        currentLesson,
        feedback,
        refinementType,
        liturgyContext,
        ageGroupLabel,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Error del servicio de refinamiento (${response.status}): ${errorText.slice(0, 200)}`
      );
    }

    let refined: RefineChildrenLessonResponse;
    try {
      refined = (await response.json()) as RefineChildrenLessonResponse;
    } catch {
      throw new Error(
        'El servicio de refinamiento retornó un formato de respuesta inesperado. Por favor intenta nuevamente.'
      );
    }

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
      materials_needed: refined.materials.join(', '),
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
