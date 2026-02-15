/**
 * Children's Ministry Module — TypeScript Type Definitions
 *
 * Handwritten types mirroring the 9 children ministry database tables.
 * These types are independent of the auto-generated Supabase types in
 * @/integrations/supabase/types.ts, which should NOT be modified.
 *
 * Convention:
 *   Row   — full row as returned by SELECT (all columns present)
 *   Insert — for INSERT: server-generated fields (id, created_at, updated_at) optional
 *   Update — for UPDATE: all fields optional (Partial<Insert>)
 */

// =====================================================
// CHECK-constraint union types
// =====================================================

/** church_children_lessons.status CHECK */
export type LessonStatus = 'draft' | 'ready' | 'archived';

/** church_children_calendar.status CHECK */
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';

/** church_children_session_assignments.role CHECK */
export type AssignmentRole = 'lead' | 'assistant' | 'support';

/** church_children_session_assignments.status CHECK */
export type AssignmentStatus = 'assigned' | 'confirmed' | 'declined';

/** church_children_inventory.category CHECK */
export type InventoryCategory = 'craft' | 'book' | 'supply' | 'equipment' | 'other';

/** church_children_lesson_materials.type CHECK */
export type MaterialType = 'document' | 'image' | 'link' | 'video' | 'story';

// =====================================================
// ROW INTERFACES (full rows from SELECT)
// =====================================================

/** Age group (pre-seeded, read-only) */
export interface ChildrenAgeGroupRow {
  id: string;
  name: string;
  min_age: number;
  max_age: number;
  display_order: number;
  created_at: string;
}

/** Lesson */
export interface ChildrenLessonRow {
  id: string;
  title: string;
  description: string | null;
  age_group_id: string | null;
  bible_reference: string | null;
  objectives: string | null;
  content: string | null;
  materials_needed: string | null;
  duration_minutes: number;
  liturgy_id: string | null;
  tags: string[];
  status: LessonStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Lesson material/attachment */
export interface ChildrenLessonMaterialRow {
  id: string;
  lesson_id: string;
  name: string;
  type: MaterialType;
  url: string;
  story_id: string | null;
  created_at: string;
}

/** Calendar session (scheduled class) */
export interface ChildrenCalendarRow {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  age_group_id: string;
  lesson_id: string | null;
  location: string;
  notes: string | null;
  status: SessionStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Volunteer */
export interface ChildrenVolunteerRow {
  id: string;
  user_id: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Recurring weekly availability */
export interface ChildrenRecurringAvailabilityRow {
  id: string;
  volunteer_id: string;
  day_of_week: number;
  is_available: boolean;
  effective_from: string;
  effective_until: string | null;
  created_at: string;
}

/** Per-session volunteer assignment */
export interface ChildrenSessionAssignmentRow {
  id: string;
  calendar_id: string;
  volunteer_id: string;
  role: AssignmentRole;
  status: AssignmentStatus;
  assigned_by: string | null;
  created_at: string;
}

/** Attendance record */
export interface ChildrenAttendanceRow {
  id: string;
  calendar_id: string;
  child_name: string;
  age_group_id: string | null;
  is_present: boolean;
  created_at: string;
}

/** Inventory item */
export interface ChildrenInventoryRow {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  min_quantity: number;
  location: string;
  notes: string | null;
  last_restocked_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// INSERT TYPES (for INSERT operations)
// =====================================================

export type ChildrenLessonInsert = Omit<ChildrenLessonRow, 'id' | 'created_at' | 'updated_at'>;
export type ChildrenLessonMaterialInsert = Omit<ChildrenLessonMaterialRow, 'id' | 'created_at'>;
export type ChildrenCalendarInsert = Omit<ChildrenCalendarRow, 'id' | 'created_at' | 'updated_at'>;
export type ChildrenVolunteerInsert = Omit<ChildrenVolunteerRow, 'id' | 'created_at' | 'updated_at'>;
export type ChildrenRecurringAvailabilityInsert = Omit<ChildrenRecurringAvailabilityRow, 'id' | 'created_at'>;
export type ChildrenSessionAssignmentInsert = Omit<ChildrenSessionAssignmentRow, 'id' | 'created_at'>;
export type ChildrenAttendanceInsert = Omit<ChildrenAttendanceRow, 'id' | 'created_at'>;
export type ChildrenInventoryInsert = Omit<ChildrenInventoryRow, 'id' | 'created_at' | 'updated_at'>;

// =====================================================
// UPDATE TYPES (for UPDATE operations)
// =====================================================

export type ChildrenLessonUpdate = Partial<ChildrenLessonInsert>;
export type ChildrenLessonMaterialUpdate = Partial<ChildrenLessonMaterialInsert>;
export type ChildrenCalendarUpdate = Partial<ChildrenCalendarInsert>;
export type ChildrenVolunteerUpdate = Partial<ChildrenVolunteerInsert>;
export type ChildrenRecurringAvailabilityUpdate = Partial<ChildrenRecurringAvailabilityInsert>;
export type ChildrenSessionAssignmentUpdate = Partial<ChildrenSessionAssignmentInsert>;
export type ChildrenAttendanceUpdate = Partial<ChildrenAttendanceInsert>;
export type ChildrenInventoryUpdate = Partial<ChildrenInventoryInsert>;

// =====================================================
// COMPOSITE TYPES (for joined queries)
// =====================================================

/** Calendar session with joined age group, lesson, and assignments */
export interface ChildrenCalendarFull extends ChildrenCalendarRow {
  age_group: ChildrenAgeGroupRow;
  lesson: ChildrenLessonRow | null;
  assignments: (ChildrenSessionAssignmentRow & {
    volunteer: ChildrenVolunteerRow;
  })[];
}

/** Lesson with joined age group and materials */
export interface ChildrenLessonFull extends ChildrenLessonRow {
  age_group: ChildrenAgeGroupRow | null;
  materials: ChildrenLessonMaterialRow[];
}

// =====================================================
// FILTER TYPES (for query filters)
// =====================================================

export interface LessonFilters {
  age_group_id?: string;
  status?: LessonStatus;
  search?: string;
  tags?: string[];
}

export interface CalendarFilters {
  from?: string;
  to?: string;
  age_group_id?: string;
  status?: SessionStatus;
}

export interface VolunteerFilters {
  is_active?: boolean;
  search?: string;
}
