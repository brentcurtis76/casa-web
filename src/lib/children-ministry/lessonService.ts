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
 * Delete a lesson material.
 */
export async function deleteLessonMaterial(id: string): Promise<void> {
  const { error } = await supabase
    .from('church_children_lesson_materials')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}
