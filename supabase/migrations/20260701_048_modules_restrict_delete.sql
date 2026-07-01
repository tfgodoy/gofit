-- ══════════════════════════════════════════════════════════════════
-- Ajuste de segurança Fase 4 — Módulos globais não podem ser deletados
--
-- A migration 046 criou "platform_owners_write_modules" como FOR ALL,
-- o que implicitamente concede DELETE em modules para platform_owners.
--
-- Módulos globais são registros estruturais da plataforma: podem estar
-- referenciados por company_modules, saas_plan_features, auditorias e
-- regras de feature flags. Por isso, DELETE físico não é permitido.
-- Módulos devem ser inativados (status = 'coming_soon'/'deprecated')
-- ou ocultados (is_visible = false) em vez de deletados.
--
-- DELETE poderá ser reavaliado no futuro apenas com:
--   - verificação de integridade referencial explícita
--   - regra clara de cascata ou rejeição
--   - aprovação explícita nesta skill
-- ══════════════════════════════════════════════════════════════════

-- ── Passo 1: remover a policy FOR ALL que concedia DELETE implícito ──
DROP POLICY IF EXISTS "platform_owners_write_modules" ON public.modules;

-- ── Passo 2: recriar como INSERT separado (idempotente) ──────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'modules' AND policyname = 'platform_owners_insert_modules'
  ) THEN
    CREATE POLICY "platform_owners_insert_modules"
      ON public.modules FOR INSERT
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- ── Passo 3: recriar como UPDATE separado (idempotente) ──────────
-- Inclui inativação (status = 'deprecated'/'coming_soon') e ocultação
-- (is_visible = false) como alternativas ao DELETE.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'modules' AND policyname = 'platform_owners_update_modules'
  ) THEN
    CREATE POLICY "platform_owners_update_modules"
      ON public.modules FOR UPDATE
      USING (
        EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- ── Resultado esperado para public.modules ───────────────────────
-- SELECT: modules_select_all USING(true)  — catálogo público, leitura para todos
-- INSERT: platform_owners_insert_modules  — apenas platform_owners
-- UPDATE: platform_owners_update_modules  — apenas platform_owners
-- DELETE: nenhuma policy → bloqueado para todos
