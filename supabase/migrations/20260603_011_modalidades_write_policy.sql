-- Permite criar e editar modalidades pelo app.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'modalidades'
      AND policyname = 'modalidades_anon_all'
  ) THEN
    CREATE POLICY "modalidades_anon_all"
      ON public.modalidades
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Sincroniza a renomeacao solicitada no cadastro principal.
UPDATE public.modalidades
SET descricao = 'FitCross'
WHERE descricao IN ('Crossfit', 'CrossFit');

UPDATE public.schedule_grids g
SET modalidade_nome = m.descricao
FROM public.modalidades m
WHERE g.modalidade_id = m.id
  AND g.modalidade_nome IS DISTINCT FROM m.descricao;

UPDATE public.schedule_slots s
SET modalidade_nome = m.descricao
FROM public.modalidades m
WHERE s.modalidade_id = m.id
  AND s.modalidade_nome IS DISTINCT FROM m.descricao;
