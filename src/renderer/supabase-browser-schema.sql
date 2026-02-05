-- =============================================
-- CPM Browser-Based App - Supabase Schema
-- =============================================

-- 1. Admin table (single admin account)
CREATE TABLE IF NOT EXISTS browser_admin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- 2. Access keys table
CREATE TABLE IF NOT EXISTS browser_access_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT UNIQUE NOT NULL,
  key_preview TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  quota_bytes BIGINT DEFAULT 104857600,
  used_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  activated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- 3. Cloud files metadata table
CREATE TABLE IF NOT EXISTS browser_cloud_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID REFERENCES browser_access_keys(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  display_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(key_id, storage_path)
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_browser_access_keys_hash ON browser_access_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_browser_access_keys_active ON browser_access_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_browser_cloud_files_key ON browser_cloud_files(key_id);

-- 5. Row Level Security (RLS) policies

-- Enable RLS
ALTER TABLE browser_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE browser_access_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE browser_cloud_files ENABLE ROW LEVEL SECURITY;

-- Admin table: allow read for authentication (public can check credentials)
CREATE POLICY "Allow public read for auth" ON browser_admin
  FOR SELECT USING (true);

-- Access keys: allow public read/update (app needs to validate and update usage)
CREATE POLICY "Allow public read" ON browser_access_keys
  FOR SELECT USING (true);

CREATE POLICY "Allow public update" ON browser_access_keys
  FOR UPDATE USING (true);

CREATE POLICY "Allow public insert" ON browser_access_keys
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete" ON browser_access_keys
  FOR DELETE USING (true);

-- Cloud files: allow all operations (app manages access via key validation)
CREATE POLICY "Allow public all" ON browser_cloud_files
  FOR ALL USING (true);

-- 6. Create storage bucket (run this in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('cpm-browser-storage', 'cpm-browser-storage', false);

-- 7. Storage policies (run in Supabase dashboard SQL editor)
-- Allow authenticated and anon users to upload/download/delete
CREATE POLICY "Allow public uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'cpm-browser-storage');

CREATE POLICY "Allow public downloads" ON storage.objects
  FOR SELECT USING (bucket_id = 'cpm-browser-storage');

CREATE POLICY "Allow public updates" ON storage.objects
  FOR UPDATE USING (bucket_id = 'cpm-browser-storage');

CREATE POLICY "Allow public deletes" ON storage.objects
  FOR DELETE USING (bucket_id = 'cpm-browser-storage');

-- 8. Add max_seats column to access keys
ALTER TABLE browser_access_keys ADD COLUMN IF NOT EXISTS max_seats INTEGER NOT NULL DEFAULT 5;

-- 9. Users table (seat-based login system)
CREATE TABLE IF NOT EXISTS browser_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES browser_access_keys(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(key_id, username)
);

CREATE INDEX IF NOT EXISTS idx_browser_users_key ON browser_users(key_id);
CREATE INDEX IF NOT EXISTS idx_browser_users_username ON browser_users(username);

-- Enable RLS on users table
ALTER TABLE browser_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on browser_users" ON browser_users
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert on browser_users" ON browser_users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on browser_users" ON browser_users
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on browser_users" ON browser_users
  FOR DELETE USING (true);

-- 10. Insert default admin (change password after first login!)
-- Password is hashed using SHA-256. Default: admin / admin123
-- You should change this immediately after setup!
INSERT INTO browser_admin (username, password_hash)
VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9')
ON CONFLICT (username) DO NOTHING;

-- =============================================
-- IMPORTANT: After running this SQL:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create a new bucket named: cpm-browser-storage
-- 3. Set it to private (not public)
-- 4. Change the default admin password!
-- =============================================
