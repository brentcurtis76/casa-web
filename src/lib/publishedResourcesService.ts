/**
 * Published Resources Service
 * Manages Cuentacuento and Reflexion PDFs published to the home page
 */

import { supabase } from '@/integrations/supabase/client';

export interface PublishedResource {
  id: string;
  resource_type: 'cuentacuento' | 'reflexion';
  liturgy_id: string | null;
  liturgy_date: string;
  title: string;
  description: string | null;
  pdf_url: string;
  pdf_filename: string | null;
  file_size_bytes: number | null;
  published_at: string;
  published_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get all active published resources for the home page
 */
export async function getActiveResources(): Promise<PublishedResource[]> {
  const { data, error } = await supabase
    .from('published_resources')
    .select('*')
    .eq('is_active', true)
    .order('resource_type');

  if (error) throw error;
  return (data || []) as PublishedResource[];
}

/**
 * Get a specific active resource by type
 */
export async function getActiveResourceByType(
  type: 'cuentacuento' | 'reflexion'
): Promise<PublishedResource | null> {
  const { data, error } = await supabase
    .from('published_resources')
    .select('*')
    .eq('resource_type', type)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data as PublishedResource | null;
}

/**
 * Publish a Cuentacuento PDF to the home page
 */
export async function publishCuentacuento(params: {
  liturgyId: string;
  liturgyDate: Date;
  title: string;
  pdfBlob: Blob;
}): Promise<PublishedResource> {
  const { liturgyId, liturgyDate, title, pdfBlob } = params;
  const timestamp = Date.now();
  const filename = `cuentacuento_${liturgyId}_${timestamp}.pdf`;
  const storagePath = `cuentacuentos/${filename}`;

  // 1. Upload PDF to storage
  const { error: uploadError } = await supabase.storage
    .from('liturgy-published')
    .upload(storagePath, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) throw new Error(`Error al subir PDF: ${uploadError.message}`);

  // 2. Get public URL
  const { data: urlData } = supabase.storage
    .from('liturgy-published')
    .getPublicUrl(storagePath);

  const pdfUrl = urlData.publicUrl;

  // 3. Check if there's an existing active cuentacuento
  const { data: existingResource } = await supabase
    .from('published_resources')
    .select('id')
    .eq('resource_type', 'cuentacuento')
    .eq('is_active', true)
    .maybeSingle();

  const resourceData = {
    resource_type: 'cuentacuento' as const,
    liturgy_id: liturgyId,
    liturgy_date: liturgyDate.toISOString().split('T')[0],
    title,
    description: `Cuento ilustrado para familias: ${title}`,
    pdf_url: pdfUrl,
    pdf_filename: filename,
    file_size_bytes: pdfBlob.size,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  let data;
  let error;

  if (existingResource) {
    // Update the existing active record
    console.log('[publishCuentacuento] Updating existing record:', existingResource.id);
    const updateResult = await supabase
      .from('published_resources')
      .update(resourceData)
      .eq('id', existingResource.id)
      .select()
      .single();

    data = updateResult.data;
    error = updateResult.error;
  } else {
    // Insert new record
    console.log('[publishCuentacuento] Inserting new record');
    const insertResult = await supabase
      .from('published_resources')
      .insert(resourceData)
      .select()
      .single();

    data = insertResult.data;
    error = insertResult.error;
  }

  if (error) throw new Error(`Error al publicar: ${error.message}`);
  return data as PublishedResource;
}

/**
 * Publish a Reflexion PDF to the home page
 */
export async function publishReflexion(params: {
  liturgyId: string;
  liturgyDate: Date;
  title: string;
  pdfFile: File;
}): Promise<PublishedResource> {
  const { liturgyId, liturgyDate, title, pdfFile } = params;
  const timestamp = Date.now();
  const filename = `reflexion_${liturgyId}_${timestamp}.pdf`;
  const storagePath = `reflexiones/${filename}`;

  // 1. Upload original PDF to storage
  const { error: uploadError } = await supabase.storage
    .from('liturgy-published')
    .upload(storagePath, pdfFile, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) throw new Error(`Error al subir PDF: ${uploadError.message}`);

  // 2. Get public URL
  const { data: urlData } = supabase.storage
    .from('liturgy-published')
    .getPublicUrl(storagePath);

  const pdfUrl = urlData.publicUrl;

  // 3. Check if there's an existing active reflexion
  const { data: existingResource } = await supabase
    .from('published_resources')
    .select('id')
    .eq('resource_type', 'reflexion')
    .eq('is_active', true)
    .maybeSingle();

  const resourceData = {
    resource_type: 'reflexion' as const,
    liturgy_id: liturgyId,
    liturgy_date: liturgyDate.toISOString().split('T')[0],
    title,
    description: `Reflexion pastoral: ${title}`,
    pdf_url: pdfUrl,
    pdf_filename: filename,
    file_size_bytes: pdfFile.size,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  let data;
  let error;

  if (existingResource) {
    // Update the existing active record
    console.log('[publishReflexion] Updating existing record:', existingResource.id);
    const updateResult = await supabase
      .from('published_resources')
      .update(resourceData)
      .eq('id', existingResource.id)
      .select()
      .single();

    data = updateResult.data;
    error = updateResult.error;
  } else {
    // Insert new record
    console.log('[publishReflexion] Inserting new record');
    const insertResult = await supabase
      .from('published_resources')
      .insert(resourceData)
      .select()
      .single();

    data = insertResult.data;
    error = insertResult.error;
  }

  if (error) throw new Error(`Error al publicar: ${error.message}`);
  return data as PublishedResource;
}

/**
 * Unpublish a resource (deactivate it)
 */
export async function unpublishResource(resourceId: string): Promise<void> {
  const { error } = await supabase
    .from('published_resources')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', resourceId);

  if (error) throw new Error(`Error al despublicar: ${error.message}`);
}
