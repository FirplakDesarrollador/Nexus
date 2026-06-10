-- Migration: Storage bucket and RLS policies for solicitudes_documentos
-- This allows authenticated users to upload, read, and delete files

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'solicitudes_documentos',
  'solicitudes_documentos',
  false,
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow admin deletes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;

-- 3. Allow any authenticated user to upload files to solicitudes_documentos
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'solicitudes_documentos');

-- 4. Allow any authenticated user to read/download files
CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'solicitudes_documentos');

-- 5. Allow any authenticated user to delete files (admin will handle logic in app layer)
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'solicitudes_documentos');

-- 6. Also add RLS policies for nexus.documentos table
DROP POLICY IF EXISTS "Admins can manage documents" ON nexus.documentos;
DROP POLICY IF EXISTS "Users can view own documents" ON nexus.documentos;
DROP POLICY IF EXISTS "Users can insert own documents" ON nexus.documentos;

-- Admins can do everything with documents
CREATE POLICY "Admins can manage documents" ON nexus.documentos
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM nexus.users WHERE id = auth.uid() AND rol = 'ADMIN')
  );

-- Regular users can see documents of their own solicitudes
CREATE POLICY "Users can view own documents" ON nexus.documentos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM nexus.solicitudes s
      WHERE s.id = nexus.documentos.solicitud_id
      AND s.solicitante_id = auth.uid()
    )
  );

-- Regular users can insert documents for their own solicitudes
CREATE POLICY "Users can insert own documents" ON nexus.documentos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nexus.solicitudes s
      WHERE s.id = solicitud_id
      AND s.solicitante_id = auth.uid()
    )
  );
