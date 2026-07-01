-- ══════════════════════════════════════════════════════════════════
-- Fase 4 — Políticas RLS para platform_owners gerenciarem módulos
-- Permite criar/editar módulos globais e fazer overrides por empresa
-- ══════════════════════════════════════════════════════════════════

-- ── modules: escrita pelo owner (criar/editar catálogo global) ───
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'modules' AND policyname = 'platform_owners_write_modules'
  ) THEN
    CREATE POLICY "platform_owners_write_modules"
      ON public.modules FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- ── company_modules: INSERT pelo owner (criar override por empresa) ──
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_modules' AND policyname = 'platform_owners_insert_company_modules'
  ) THEN
    CREATE POLICY "platform_owners_insert_company_modules"
      ON public.company_modules FOR INSERT
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- ── company_modules: UPDATE pelo owner (alterar status de módulo por empresa) ──
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_modules' AND policyname = 'platform_owners_update_company_modules'
  ) THEN
    CREATE POLICY "platform_owners_update_company_modules"
      ON public.company_modules FOR UPDATE
      USING (
        EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- ── company_modules: DELETE pelo owner (remover override por empresa) ──
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_modules' AND policyname = 'platform_owners_delete_company_modules'
  ) THEN
    CREATE POLICY "platform_owners_delete_company_modules"
      ON public.company_modules FOR DELETE
      USING (
        EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- ── Índice extra para busca por module_id em company_modules ────
CREATE INDEX IF NOT EXISTS idx_company_modules_status_active
  ON public.company_modules (module_id, status);
