CREATE TABLE IF NOT EXISTS public.templates_contratos (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id uuid        NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  descricao     text        NOT NULL,
  arquivo_path  text,
  arquivo_nome  text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.templates_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all anon" ON public.templates_contratos
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX ON public.templates_contratos (contractor_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_templates_contratos_updated_at'
      AND tgrelid = 'public.templates_contratos'::regclass
  ) THEN
    CREATE TRIGGER trg_templates_contratos_updated_at
      BEFORE UPDATE ON public.templates_contratos
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
