# Supabase Storage Setup for La Mesa Abierta

This document describes how to set up the Supabase Storage bucket for Mesa Abierta photos.

## Storage Bucket Creation

### Manual Setup (Supabase Dashboard)

1. **Navigate to Storage**
   - Go to your Supabase project dashboard
   - Click on "Storage" in the left sidebar

2. **Create New Bucket**
   - Click "New bucket"
   - Bucket name: `mesa-abierta-photos`
   - Public bucket: `false` (private - requires authentication)
   - File size limit: `5 MB`
   - Allowed MIME types: `image/jpeg, image/png, image/webp, image/gif`

3. **Configure Bucket Settings**
   - Enable RLS (Row Level Security)
   - Enable image optimization (automatic resizing and format conversion)

## Storage Policies

After creating the bucket, set up these policies:

### 1. Upload Policy - "Users can upload photos for their dinners"

```sql
CREATE POLICY "Users can upload photos for their dinners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'mesa-abierta-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

**Explanation**: Users can only upload to folders named after their user ID.

### 2. Read Policy - "Anyone can view approved photos"

```sql
CREATE POLICY "Anyone can view approved photos"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'mesa-abierta-photos'
);
```

**Explanation**: All photos can be viewed, but approval is controlled at the database level.

### 3. Update Policy - "Users can update their own photos"

```sql
CREATE POLICY "Users can update their own photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'mesa-abierta-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### 4. Delete Policy - "Users can delete their own photos"

```sql
CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'mesa-abierta-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### 5. Admin Override - "Admins can manage all photos"

```sql
CREATE POLICY "Admins can manage all photos"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'mesa-abierta-photos'
  AND EXISTS (
    SELECT 1 FROM mesa_abierta_admin_roles
    WHERE user_id = auth.uid()
  )
);
```

## Folder Structure

Photos will be organized in the following structure:

```
mesa-abierta-photos/
├── {user_id}/
│   ├── {month_id}/
│   │   ├── {timestamp}_1.jpg
│   │   ├── {timestamp}_2.jpg
│   │   └── ...
│   └── ...
└── ...
```

Example:
```
mesa-abierta-photos/
├── 550e8400-e29b-41d4-a716-446655440000/
│   ├── 2024-11/
│   │   ├── 1699876543210_dinner.jpg
│   │   └── 1699876789012_group.jpg
│   └── 2024-12/
│       └── 1702345678901_celebration.jpg
```

## File Naming Convention

Format: `{user_id}/{month_id}/{timestamp}_{random}.{ext}`

- **user_id**: UUID of the user uploading
- **month_id**: Year-Month format (e.g., "2024-11")
- **timestamp**: Unix timestamp in milliseconds
- **random**: Random string for uniqueness
- **ext**: File extension (jpg, png, webp)

Example:
```typescript
const fileName = `${userId}/${monthId}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`
```

## Image Optimization

Supabase Storage will automatically:
- Convert images to WebP format for better compression
- Generate thumbnails (configurable sizes)
- Strip metadata for privacy
- Optimize file sizes

### Transformation URLs

To get optimized versions:

```typescript
// Original
const originalUrl = supabase.storage
  .from('mesa-abierta-photos')
  .getPublicUrl(filePath).data.publicUrl

// Thumbnail (300x300)
const thumbnailUrl = supabase.storage
  .from('mesa-abierta-photos')
  .getPublicUrl(filePath, {
    transform: {
      width: 300,
      height: 300,
      resize: 'cover'
    }
  }).data.publicUrl

// Medium size (800x600)
const mediumUrl = supabase.storage
  .from('mesa-abierta-photos')
  .getPublicUrl(filePath, {
    transform: {
      width: 800,
      height: 600,
      resize: 'contain'
    }
  }).data.publicUrl
```

## Upload Example

```typescript
import { supabase } from '@/integrations/supabase/client'

const uploadPhoto = async (file: File, monthId: string) => {
  const userId = (await supabase.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Not authenticated')

  // Generate unique filename
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}/${monthId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

  // Upload to storage
  const { data, error } = await supabase.storage
    .from('mesa-abierta-photos')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) throw error

  return data.path
}
```

## Download/View Example

```typescript
const getPhotoUrl = (photoPath: string) => {
  const { data } = supabase.storage
    .from('mesa-abierta-photos')
    .getPublicUrl(photoPath)

  return data.publicUrl
}

// With optimization
const getThumbnailUrl = (photoPath: string) => {
  const { data } = supabase.storage
    .from('mesa-abierta-photos')
    .getPublicUrl(photoPath, {
      transform: {
        width: 400,
        height: 400,
        resize: 'cover',
        quality: 80
      }
    })

  return data.publicUrl
}
```

## Delete Example

```typescript
const deletePhoto = async (photoPath: string) => {
  const { error } = await supabase.storage
    .from('mesa-abierta-photos')
    .remove([photoPath])

  if (error) throw error
}
```

## Security Considerations

1. **File Validation**: Always validate file types and sizes on the client AND server
2. **User Ownership**: Ensure users can only upload to their own folders
3. **Approval Flow**: Photos must be approved by admins before appearing in public gallery
4. **Metadata Stripping**: Automatic removal of EXIF data for privacy
5. **Virus Scanning**: Consider integrating with a virus scanning service for production

## Migration Script (Alternative to Manual Setup)

If you prefer to set up the bucket programmatically:

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mesa-abierta-photos',
  'mesa-abierta-photos',
  false,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Add all policies from above...
```

## Testing

After setup, test with:

1. Upload a test image as an authenticated user
2. Verify you can retrieve the image URL
3. Try to upload to another user's folder (should fail)
4. Test image transformations
5. Verify admin users can access all photos

## Monitoring

Monitor storage usage in the Supabase dashboard:
- Total storage used
- Number of files
- Bandwidth usage
- Failed uploads

Set up alerts for:
- Storage approaching quota
- Unusual upload patterns
- High bandwidth usage

## Backup

Configure automatic backups in Supabase dashboard:
- Daily backups recommended
- Retention period: 30 days
- Point-in-time recovery enabled
