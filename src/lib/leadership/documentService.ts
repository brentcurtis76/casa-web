/**
 * Document Service — Supabase CRUD for church_leadership_documents and storage
 */

import { supabase } from '@/integrations/supabase/client';
import type { DocumentRow, DocumentInsert } from '@/types/leadershipModule';

/**
 * Upload a document file to storage and create a DB record.
 * File is stored in: leadership-documents/meetings/{meetingId}/{timestamp}_{filename}
 */
export async function uploadDocument(
  meetingId: string,
  file: File,
  userId: string,
  description?: string,
): Promise<DocumentRow> {
  const timestamp = Date.now();
  const storagePath = `meetings/${meetingId}/${timestamp}_${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('leadership-documents')
    .upload(storagePath, file);

  if (uploadError) throw new Error(`Error al subir el documento: ${uploadError.message}`);

  const documentInsert: DocumentInsert = {
    meeting_id: meetingId,
    filename: file.name,
    storage_path: storagePath,
    mime_type: file.type || null,
    file_size_bytes: file.size,
    description: description ?? null,
    uploaded_by: userId,
  };

  const { data, error } = await supabase
    .from('church_leadership_documents')
    .insert(documentInsert)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as DocumentRow;
}

/**
 * Get all documents for a meeting, newest first.
 */
export async function getDocuments(meetingId: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from('church_leadership_documents')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentRow[];
}

/**
 * Get a signed URL for a document (valid for 1 hour).
 */
export async function getDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('leadership-documents')
    .createSignedUrl(storagePath, 3600);

  if (error) throw new Error(`Error al obtener URL del documento: ${error.message}`);
  return data?.signedUrl ?? '';
}

/**
 * Delete a document from storage and DB.
 */
export async function deleteDocument(id: string, storagePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from('leadership-documents')
    .remove([storagePath]);

  if (storageError) throw new Error(`Error al eliminar el archivo: ${storageError.message}`);

  const { error } = await supabase
    .from('church_leadership_documents')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}
