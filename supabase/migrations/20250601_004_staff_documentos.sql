-- Staff document attachments
CREATE TABLE IF NOT EXISTS public.staff_documentos (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id      uuid        NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  contractor_id uuid        NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  tipo          text        NOT NULL DEFAULT 'outros'
                            CHECK (tipo IN ('rg','cpf','comprovante_residencia','carteira_conselho','cnh','ctps','outros')),
  arquivo_nome  text        NOT NULL,
  arquivo_path  text        NOT NULL,
  tamanho       integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_documentos_staff ON public.staff_documentos(staff_id);

ALTER TABLE public.staff_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all anon" ON public.staff_documentos
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Storage bucket for staff documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-docs', 'staff-docs', false, 10485760,
  ARRAY['image/jpeg','image/jpg','image/png','application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='staff-docs anon upload') THEN
    CREATE POLICY "staff-docs anon upload" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'staff-docs');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='staff-docs anon select') THEN
    CREATE POLICY "staff-docs anon select" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'staff-docs');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='staff-docs anon delete') THEN
    CREATE POLICY "staff-docs anon delete" ON storage.objects FOR DELETE TO anon USING (bucket_id = 'staff-docs');
  END IF;
END $$;
