INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'templates', 'templates', false, 10485760,
  ARRAY['application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='templates anon upload') THEN
    CREATE POLICY "templates anon upload" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'templates');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='templates anon select') THEN
    CREATE POLICY "templates anon select" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'templates');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='templates anon delete') THEN
    CREATE POLICY "templates anon delete" ON storage.objects FOR DELETE TO anon USING (bucket_id = 'templates');
  END IF;
END $$;
