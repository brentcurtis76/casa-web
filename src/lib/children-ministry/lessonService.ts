/**
 * Lesson Service — Supabase CRUD for lessons and lesson materials
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  ChildrenLessonRow,
  ChildrenLessonInsert,
  ChildrenLessonUpdate,
  ChildrenLessonMaterialRow,
  ChildrenLessonMaterialInsert,
  ChildrenLessonFull,
  LessonFilters,
} from '@/types/childrenMinistry';

/**
 * Get lessons with optional filters (age_group_id, status, search, tags).
 */
export async function getLessons(filters?: LessonFilters): Promise<ChildrenLessonRow[]> {
  let query = supabase.from('church_children_lessons').select('*');

  if (filters?.age_group_id) {
    query = query.eq('age_group_id', filters.age_group_id);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.search) {
    const pattern = `%${filters.search}%`;
    query = query.ilike('title', pattern);
  }

  if (filters?.tags && filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags);
  }

  const { data, error } = await query.order('title', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ChildrenLessonRow[];
}

/**
 * Get a single lesson by ID with age group and materials (nested select).
 */
export async function getLesson(id: string): Promise<ChildrenLessonFull> {
  const { data, error } = await supabase
    .from('church_children_lessons')
    .select('*, church_children_age_groups(*), church_children_lesson_materials(*)')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as ChildrenLessonFull;
}

/**
 * Create a new lesson.
 */
export async function createLesson(lesson: ChildrenLessonInsert): Promise<ChildrenLessonRow> {
  const { data, error } = await supabase
    .from('church_children_lessons')
    .insert(lesson)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as ChildrenLessonRow;
}

/**
 * Update an existing lesson.
 */
export async function updateLesson(
  id: string,
  update: ChildrenLessonUpdate,
): Promise<ChildrenLessonRow> {
  const { data, error } = await supabase
    .from('church_children_lessons')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as ChildrenLessonRow;
}

/**
 * Delete a lesson.
 */
export async function deleteLesson(id: string): Promise<void> {
  const { error } = await supabase
    .from('church_children_lessons')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Get all materials for a lesson.
 */
export async function getLessonMaterials(lessonId: string): Promise<ChildrenLessonMaterialRow[]> {
  const { data, error } = await supabase
    .from('church_children_lesson_materials')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ChildrenLessonMaterialRow[];
}

/**
 * Add a material to a lesson.
 */
export async function addLessonMaterial(
  material: ChildrenLessonMaterialInsert,
): Promise<ChildrenLessonMaterialRow> {
  const { data, error } = await supabase
    .from('church_children_lesson_materials')
    .insert(material)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as ChildrenLessonMaterialRow;
}

/**
 * Upsert a material by lesson_id + type: update if exists, insert if not.
 * Used for story materials to prevent duplicate rows on republish.
 */
export async function upsertLessonMaterialByType(
  material: ChildrenLessonMaterialInsert,
): Promise<ChildrenLessonMaterialRow> {
  // Check for existing material with same lesson_id and type
  const { data: existing, error: queryError } = await supabase
    .from('church_children_lesson_materials')
    .select('*')
    .eq('lesson_id', material.lesson_id)
    .eq('type', material.type)
    .maybeSingle();

  if (queryError) throw new Error(queryError.message);

  if (existing) {
    // Update existing row
    const { data, error } = await supabase
      .from('church_children_lesson_materials')
      .update({ name: material.name, url: material.url, story_id: material.story_id })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as ChildrenLessonMaterialRow;
  }

  // Insert new row
  return addLessonMaterial(material);
}

/**
 * Delete a lesson material.
 */
export async function deleteLessonMaterial(id: string): Promise<void> {
  const { error } = await supabase
    .from('church_children_lesson_materials')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Get a lesson by liturgy_id and age_group_id (idempotency check).
 */
export async function getLessonByLiturgyAndAgeGroup(
  liturgyId: string,
  ageGroupId: string
): Promise<ChildrenLessonRow | null> {
  const { data, error } = await supabase
    .from('church_children_lessons')
    .select('*')
    .eq('liturgy_id', liturgyId)
    .eq('age_group_id', ageGroupId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ChildrenLessonRow) || null;
}
