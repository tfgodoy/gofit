CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id  uuid        NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  nome           text        NOT NULL,
  tipo           text        NOT NULL CHECK (tipo IN ('despesa', 'receita')),
  considerar_cac boolean     NOT NULL DEFAULT false,
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all anon" ON public.categorias_financeiras
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE INDEX ON public.categorias_financeiras (contractor_id, tipo);

CREATE TABLE IF NOT EXISTS public.subcategorias_financeiras (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_id  uuid        NOT NULL REFERENCES public.categorias_financeiras(id) ON DELETE CASCADE,
  contractor_id uuid        NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  nome          text        NOT NULL,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE public.subcategorias_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all anon" ON public.subcategorias_financeiras
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE INDEX ON public.subcategorias_financeiras (categoria_id);
CREATE INDEX ON public.subcategorias_financeiras (contractor_id);
