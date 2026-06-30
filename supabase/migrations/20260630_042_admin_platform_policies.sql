-- ══════════════════════════════════════════════════════════════════
-- Fase 2 — Políticas RLS para platform_owners gerenciarem empresas
-- Permite ao admin GoFit ler e atualizar contractors, ver company_modules e staff
-- ══════════════════════════════════════════════════════════════════

-- ── contractors: leitura e atualização pelo owner ───────────────
-- SELECT: já existe policy anon USING (true), mas adicionamos uma explícita
-- para garantir independência se a policy anon for removida no futuro.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contractors'
      AND policyname = 'platform_owners_select_contractors'
  ) THEN
    CREATE POLICY "platform_owners_select_contractors"
      ON public.contractors FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contractors'
      AND policyname = 'platform_owners_update_contractors'
  ) THEN
    CREATE POLICY "platform_owners_update_contractors"
      ON public.contractors FOR UPDATE
      USING (
        EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- ── company_modules: leitura pelo owner (ver módulos de qualquer empresa) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_modules'
      AND policyname = 'platform_owners_select_company_modules'
  ) THEN
    CREATE POLICY "platform_owners_select_company_modules"
      ON public.company_modules FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- ── staff: leitura pelo owner (ver funcionários de qualquer empresa) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff'
      AND policyname = 'platform_owners_select_staff'
  ) THEN
    CREATE POLICY "platform_owners_select_staff"
      ON public.staff FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- ── Índice extra para busca por nome_fantasia (melhora performance da lista admin) ──
CREATE INDEX IF NOT EXISTS idx_contractors_nome_fantasia
  ON public.contractors (nome_fantasia);
