-- Storage policies for casa-graphics bucket
-- Run this in Supabase SQL Editor

-- Allow authenticated users to upload files to casa-graphics bucket
CREATE POLICY "Authenticated users can upload graphics"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'casa-graphics');

-- Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update graphics"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'casa-graphics')
WITH CHECK (bucket_id = 'casa-graphics');

-- Allow anyone to read files from casa-graphics bucket (public access)
CREATE POLICY "Anyone can view graphics"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'casa-graphics');

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete graphics"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'casa-graphics');

-- Also add RLS policies for the tables if not already done

-- Allow authenticated users to insert batches
CREATE POLICY "Authenticated users can create graphics batches"
ON casa_graphics_batches
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Allow users to view their own batches
CREATE POLICY "Users can view their own graphics batches"
ON casa_graphics_batches
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

-- Allow users to update their own batches
CREATE POLICY "Users can update their own graphics batches"
ON casa_graphics_batches
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

-- Allow users to delete their own batches
CREATE POLICY "Users can delete their own graphics batches"
ON casa_graphics_batches
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- Allow authenticated users to insert graphics items (for batches they own)
CREATE POLICY "Authenticated users can create graphics items"
ON casa_graphics_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM casa_graphics_batches
    WHERE id = batch_id AND created_by = auth.uid()
  )
);

-- Allow users to view graphics items from their batches
CREATE POLICY "Users can view their own graphics items"
ON casa_graphics_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM casa_graphics_batches
    WHERE id = batch_id AND created_by = auth.uid()
  )
);

-- Allow users to delete their own graphics items
CREATE POLICY "Users can delete their own graphics items"
ON casa_graphics_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM casa_graphics_batches
    WHERE id = batch_id AND created_by = auth.uid()
  )
);
