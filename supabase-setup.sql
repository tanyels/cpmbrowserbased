-- =============================================
-- CPM Cloud Storage - Key-Based Access Setup
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop old tables if they exist
DROP TABLE IF EXISTS cloud_files;
DROP TABLE IF EXISTS cloud_key_users;
DROP TABLE IF EXISTS cloud_access_keys;

-- Access Keys Table
CREATE TABLE cloud_access_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  key_preview TEXT NOT NULL,
  quota_bytes BIGINT NOT NULL DEFAULT 26214400,
  used_bytes BIGINT NOT NULL DEFAULT 0,
  duration_years INTEGER NOT NULL DEFAULT 1,
  max_users INTEGER NOT NULL DEFAULT 1,
  activated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cloud Files Table (linked to keys, not users)
CREATE TABLE cloud_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES cloud_access_keys(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  original_filename TEXT,
  file_size BIGINT NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cloud_files_key_id ON cloud_files(key_id);
CREATE INDEX idx_cloud_access_keys_hash ON cloud_access_keys(key_hash);

-- Enable RLS
ALTER TABLE cloud_access_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow all operations (key validation happens in app)
-- These are permissive because the app validates keys before operations

CREATE POLICY "Allow read access keys" ON cloud_access_keys
  FOR SELECT USING (true);

CREATE POLICY "Allow update access keys" ON cloud_access_keys
  FOR UPDATE USING (true);

CREATE POLICY "Allow read files" ON cloud_files
  FOR SELECT USING (true);

CREATE POLICY "Allow insert files" ON cloud_files
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow delete files" ON cloud_files
  FOR DELETE USING (true);

-- Storage bucket policies (run separately if bucket exists)
-- First create bucket 'cpme-files' in Storage dashboard with Public = OFF

-- Then run:
-- DROP POLICY IF EXISTS "Users can access own folder" ON storage.objects;

CREATE POLICY "Allow all storage operations" ON storage.objects
  FOR ALL USING (bucket_id = 'cpme-files');

-- =============================================
-- Helper function to generate keys (for admin use)
-- =============================================

CREATE OR REPLACE FUNCTION generate_access_key(
  p_duration_years INTEGER DEFAULT 1,
  p_max_users INTEGER DEFAULT 1,
  p_quota_mb INTEGER DEFAULT 25
)
RETURNS TABLE(plain_key TEXT, key_id UUID) AS $$
DECLARE
  v_key TEXT;
  v_hash TEXT;
  v_preview TEXT;
  v_id UUID;
BEGIN
  -- Generate random key: xxxx-xxxx-xxxx-xxxx
  v_key := lower(
    substr(md5(random()::text), 1, 4) || '-' ||
    substr(md5(random()::text), 1, 4) || '-' ||
    substr(md5(random()::text), 1, 4) || '-' ||
    substr(md5(random()::text), 1, 4)
  );

  -- Hash for storage
  v_hash := encode(sha256(v_key::bytea), 'hex');

  -- Preview (last 4 chars)
  v_preview := '••••-••••-••••-' || substr(v_key, 16, 4);

  -- Insert key
  INSERT INTO cloud_access_keys (key_hash, key_preview, duration_years, max_users, quota_bytes)
  VALUES (v_hash, v_preview, p_duration_years, p_max_users, p_quota_mb * 1024 * 1024)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_key, v_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Generate some test keys (remove in production)
-- =============================================

-- Generate a 1-year, 1-user test key
-- SELECT * FROM generate_access_key(1, 1, 25);

-- Generate a 2-year, 5-user test key
-- SELECT * FROM generate_access_key(2, 5, 25);
