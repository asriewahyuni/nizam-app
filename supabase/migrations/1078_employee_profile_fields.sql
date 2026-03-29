ALTER TABLE employees ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create Storage Bucket for avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true) 
ON CONFLICT (id) DO NOTHING;

-- Policies for avatars bucket
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can update avatars" ON storage.objects;
CREATE POLICY "Users can update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can delete avatars" ON storage.objects;
CREATE POLICY "Users can delete avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars');
