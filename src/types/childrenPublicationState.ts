/**
 * Children's Ministry Publication State Types
 *
 * Types for orchestration of children's activities from Liturgy Builder.
 * Mirrors the pattern of musicPlanning.ts for consistency.
 */

// =====================================================
// PUBLICATION STATE ROW INTERFACES
// =====================================================

/** Publication state record (database row) */
export interface ChildrenPublicationStateRow {
  id: string;
  liturgy_id: string | null;
  age_group_id: string;
  lesson_id: string | null;
  calendar_id: string | null;
  publish_version: number;
  published_by: string | null;
  published_at: string;
  warning_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/** Packet delivery tracking record */
export interface ChildrenPacketDeliveryRow {
  id: string;
  publication_id: string;
  volunteer_id: string | null;
  email: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  external_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

// =====================================================
// INSERT / UPDATE TYPES
// =====================================================

export type ChildrenPublicationStateInsert = Omit<
  ChildrenPublicationStateRow,
  'id' | 'created_at' | 'updated_at'
>;

export type ChildrenPublicationStateUpdate = Partial<ChildrenPublicationStateInsert>;

export type ChildrenPacketDeliveryInsert = Omit<ChildrenPacketDeliveryRow, 'id' | 'created_at'>;

export type ChildrenPacketDeliveryUpdate = Partial<ChildrenPacketDeliveryInsert>;

// =====================================================
// AI GENERATION INTERFACES
// =====================================================

/** Request to generate-children-lesson Edge Function */
export interface GenerateChildrenLessonRequest {
  liturgyId: string;
  liturgyTitle: string;
  liturgySummary: string;
  bibleText: string;
  storyData: {
    title: string;
    summary: string;
    spiritualConnection: string;
    scenes: Array<{ text: string }>;
  };
  ageGroup: 'nursery' | 'preschool' | 'elementary' | 'mixed';
  ageGroupLabel: string;
  durationMax?: number;
  childrenCountMin?: number;
  childrenCountMax?: number;
  previewPromptOnly?: boolean;
}

/** Phase in the 3-phase lesson structure */
export interface LessonPhase {
  phase: 'movimiento' | 'expresion_conversacion' | 'reflexion_metaprendizaje';
  title: string;
  description: string;
  minutes: number;
}

/** Generated lesson output from AI */
export interface GeneratedLesson {
  activityName: string;
  materials: string[];
  sequence: [LessonPhase, LessonPhase, LessonPhase];
  adaptations: {
    small: string; // 2-5 children
    medium: string; // 6-10 children
    large: string; // 11-15 children
    mixed: string; // all ages together
  };
  volunteerPlan: {
    leader: string;
    support: string;
  };
  estimatedTotalMinutes: number;
}

/** Response from generate-children-lesson Edge Function */
export interface GenerateChildrenLessonResponse {
  success: boolean;
  activityName?: string;
  materials?: string[];
  sequence?: [LessonPhase, LessonPhase, LessonPhase];
  adaptations?: {
    small: string;
    medium: string;
    large: string;
    mixed: string;
  };
  volunteerPlan?: {
    leader: string;
    support: string;
  };
  estimatedTotalMinutes?: number;
  promptPreview?: {
    systemPrompt: string;
    userPrompt: string;
  };
  error?: string;
  model?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// =====================================================
// ORCHESTRATION INTERFACES
// =====================================================

/** Per-group generation result */
export interface GroupGenerationResult {
  ageGroupId: string;
  ageGroupLabel: string;
  success: boolean;
  lessonId?: string;
  calendarId?: string;
  publishVersionId?: string;
  error?: string;
  estimatedMinutes?: number;
}

/** Overall publication result */
export interface PublishChildrenActivitiesResult {
  success: boolean;
  publicationCount: number;
  results: GroupGenerationResult[];
  totalActivitiesGenerated: number;
  warnings: string[];
}
