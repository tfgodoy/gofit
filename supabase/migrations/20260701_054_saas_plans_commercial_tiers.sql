-- ══════════════════════════════════════════════════════════════════
-- Reestruturação comercial dos planos SaaS da GoFit — faixas de alunos
--
-- Continua sendo GoFit cobrando a ACADEMIA (contractor) pela assinatura
-- do sistema. Não afeta mensalidade de alunos, planos de alunos,
-- financeiro interno da academia nem GoFit Pay.
--
-- Decisão de design: NÃO persistimos annual_price nem
-- annual_monthly_equivalent como colunas. Ambos são derivados de
-- price_monthly + annual_discount_percent:
--   annual_price_bruto      = price_monthly * 12
--   annual_price_com_desc   = annual_price_bruto * (1 - annual_discount_percent/100)
--   mensal_equivalente_anual= annual_price_com_desc / 12
-- Persistir esses valores criaria risco de desalinhamento se o desconto
-- ou o preço mensal mudarem sem recalcular os derivados. O front-end
-- calcula isso dinamicamente (ver src/lib/saasPlanPricing.ts).
--
-- price_yearly é mantido apenas como cache de compatibilidade — sempre
-- recalculado a partir de price_monthly + annual_discount_percent no
-- momento do save em /admin/plans. Nenhum código novo deve considerá-lo
-- fonte de verdade.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Novas colunas em saas_plans ───────────────────────────────────
ALTER TABLE public.saas_plans
  ADD COLUMN IF NOT EXISTS min_students                 integer       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_discount_percent       numeric(5,2)  NOT NULL DEFAULT 0 CHECK (annual_discount_percent >= 0 AND annual_discount_percent <= 100),
  ADD COLUMN IF NOT EXISTS billing_cycles_allowed        text[]        NOT NULL DEFAULT ARRAY['monthly','annual']::text[],
  ADD COLUMN IF NOT EXISTS contract_term_months          integer       NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS early_termination_fee_type    text          NOT NULL DEFAULT 'percentage_remaining_contract',
  ADD COLUMN IF NOT EXISTS early_termination_fee_percent numeric(5,2)  NOT NULL DEFAULT 0 CHECK (early_termination_fee_percent >= 0 AND early_termination_fee_percent <= 100),
  ADD COLUMN IF NOT EXISTS early_termination_notes       text;

-- billing_cycles_allowed só pode conter 'monthly' e/ou 'annual' — nunca trimestral/semestral
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saas_plans_billing_cycles_allowed_check'
  ) THEN
    ALTER TABLE public.saas_plans
      ADD CONSTRAINT saas_plans_billing_cycles_allowed_check
      CHECK (billing_cycles_allowed <@ ARRAY['monthly','annual']::text[]);
  END IF;
END $$;

COMMENT ON COLUMN public.saas_plans.early_termination_fee_percent IS
  'Percentual configurável de multa por rescisão antecipada de contrato anual. Valor inicial é um placeholder — regra final deve ser validada juridicamente antes de cobrança real.';

-- ── 2. Novas colunas em saas_subscriptions ───────────────────────────
-- billing_cycle e os campos de contrato anual são um SNAPSHOT capturado
-- no momento da contratação/troca — não recalculado se o plano mudar
-- depois, para preservar o que foi efetivamente contratado.
ALTER TABLE public.saas_subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle                 text          NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS contract_start                date,
  ADD COLUMN IF NOT EXISTS contract_end                  date,
  ADD COLUMN IF NOT EXISTS annual_discount_percent        numeric(5,2),
  ADD COLUMN IF NOT EXISTS early_termination_fee_percent  numeric(5,2);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saas_subscriptions_billing_cycle_check'
  ) THEN
    ALTER TABLE public.saas_subscriptions
      ADD CONSTRAINT saas_subscriptions_billing_cycle_check
      CHECK (billing_cycle IN ('monthly','annual'));
  END IF;
END $$;

-- ── 3. Seed / atualização dos planos comerciais ──────────────────────
-- 'trial' (plano de período de trial, não confundir com o novo tier
-- comercial 'free') permanece intocado — está referenciado por
-- assinatura(s) ativa(s).
--
-- 'starter' e 'profissional' já existiam (sem assinaturas usando-os
-- hoje) e são ATUALIZADOS in-place para os novos valores/faixas.
-- 'empresarial' é arquivado (status='archived') — substituído por
-- 'enterprise'. 'free', 'essencial', 'performance', 'premium',
-- 'enterprise' são NOVOS.

UPDATE public.saas_plans SET status = 'archived', updated_at = now()
WHERE slug = 'empresarial';

INSERT INTO public.saas_plans (
  name, slug, description, price_monthly, price_yearly,
  min_students, max_students, max_staff, max_units, trial_days, sort_order, status,
  annual_discount_percent, billing_cycles_allowed, contract_term_months,
  early_termination_fee_type, early_termination_fee_percent, early_termination_notes
) VALUES
  ('Free', 'free', 'Plano gratuito de demonstração para academias muito pequenas.',
    0, 0, 0, 5, 2, 1, 0, 0, 'active',
    0, ARRAY['monthly']::text[], 12,
    'percentage_remaining_contract', 0, NULL),

  ('Starter', 'starter', 'Para academias iniciantes, até 50 alunos.',
    424.90, ROUND(424.90 * 12 * (1 - 10.0/100), 2), 0, 50, 7, 1, 14, 1, 'active',
    10, ARRAY['monthly','annual']::text[], 12,
    'percentage_remaining_contract', 20, 'Valor de multa é placeholder — validar juridicamente antes de aplicar em produção.'),

  ('Essencial', 'essencial', 'Para academias em crescimento, de 51 a 200 alunos.',
    534.90, ROUND(534.90 * 12 * (1 - 10.0/100), 2), 51, 200, 12, 1, 14, 2, 'active',
    10, ARRAY['monthly','annual']::text[], 12,
    'percentage_remaining_contract', 20, 'Valor de multa é placeholder — validar juridicamente antes de aplicar em produção.'),

  ('Profissional', 'profissional', 'Para academias estabelecidas, de 201 a 300 alunos.',
    614.90, ROUND(614.90 * 12 * (1 - 10.0/100), 2), 201, 300, 20, 1, 14, 3, 'active',
    10, ARRAY['monthly','annual']::text[], 12,
    'percentage_remaining_contract', 20, 'Valor de multa é placeholder — validar juridicamente antes de aplicar em produção.'),

  ('Performance', 'performance', 'Para redes em expansão, de 301 a 500 alunos.',
    784.90, ROUND(784.90 * 12 * (1 - 10.0/100), 2), 301, 500, 30, 1, 14, 4, 'active',
    10, ARRAY['monthly','annual']::text[], 12,
    'percentage_remaining_contract', 20, 'Valor de multa é placeholder — validar juridicamente antes de aplicar em produção.'),

  ('Premium', 'premium', 'Para grandes academias, de 501 a 800 alunos.',
    1154.90, ROUND(1154.90 * 12 * (1 - 10.0/100), 2), 501, 800, 50, 1, 14, 5, 'active',
    10, ARRAY['monthly','annual']::text[], 12,
    'percentage_remaining_contract', 20, 'Valor de multa é placeholder — validar juridicamente antes de aplicar em produção.'),

  ('Enterprise', 'enterprise', 'Acima de 801 alunos. Pode futuramente virar plano personalizado.',
    1304.90, ROUND(1304.90 * 12 * (1 - 10.0/100), 2), 801, NULL, NULL, 1, 14, 6, 'active',
    10, ARRAY['monthly','annual']::text[], 12,
    'percentage_remaining_contract', 20, 'Valor de multa é placeholder — validar juridicamente antes de aplicar em produção. Faixa acima de 801 alunos pode evoluir para plano sob consulta.')
ON CONFLICT (slug) DO UPDATE SET
  name                          = EXCLUDED.name,
  description                   = EXCLUDED.description,
  price_monthly                 = EXCLUDED.price_monthly,
  price_yearly                  = EXCLUDED.price_yearly,
  min_students                  = EXCLUDED.min_students,
  max_students                  = EXCLUDED.max_students,
  max_staff                     = EXCLUDED.max_staff,
  max_units                     = EXCLUDED.max_units,
  sort_order                    = EXCLUDED.sort_order,
  status                        = EXCLUDED.status,
  annual_discount_percent       = EXCLUDED.annual_discount_percent,
  billing_cycles_allowed        = EXCLUDED.billing_cycles_allowed,
  contract_term_months          = EXCLUDED.contract_term_months,
  early_termination_fee_type    = EXCLUDED.early_termination_fee_type,
  early_termination_fee_percent = EXCLUDED.early_termination_fee_percent,
  early_termination_notes       = EXCLUDED.early_termination_notes,
  updated_at                    = now();
