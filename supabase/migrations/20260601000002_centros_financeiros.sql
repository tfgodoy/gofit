CREATE TABLE IF NOT EXISTS public.centros_custo (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid        NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  descricao     text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_centros_custo_contractor ON public.centros_custo(contractor_id);
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all anon" ON public.centros_custo FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.centros_receita (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid        NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  descricao     text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_centros_receita_contractor ON public.centros_receita(contractor_id);
ALTER TABLE public.centros_receita ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all anon" ON public.centros_receita FOR ALL TO anon USING (true) WITH CHECK (true);
