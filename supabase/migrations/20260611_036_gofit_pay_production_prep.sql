-- Fase 14: Preparação para produção controlada GoFit Pay

-- 1. gofit_pay_settings: campos de controle de ambiente/produção
ALTER TABLE gofit_pay_settings
  ADD COLUMN IF NOT EXISTS environment                TEXT        NOT NULL DEFAULT 'sandbox'
    CHECK (environment IN ('sandbox','production')),
  ADD COLUMN IF NOT EXISTS production_enabled         BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allowed_for_real_charges   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS production_approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS production_approved_by     UUID,
  ADD COLUMN IF NOT EXISTS production_notes           TEXT;

-- 2. payment_charges: rastrear em qual ambiente a cobrança foi criada
ALTER TABLE payment_charges
  ADD COLUMN IF NOT EXISTS provider_environment TEXT NOT NULL DEFAULT 'sandbox'
    CHECK (provider_environment IN ('sandbox','production'));

-- 3. gofit_pay_accounts: ambiente da conta
ALTER TABLE gofit_pay_accounts
  ADD COLUMN IF NOT EXISTS provider_environment TEXT NOT NULL DEFAULT 'sandbox'
    CHECK (provider_environment IN ('sandbox','production'));

-- 4. gofit_pay_webhook_events: ambiente do evento
ALTER TABLE gofit_pay_webhook_events
  ADD COLUMN IF NOT EXISTS provider_environment TEXT NOT NULL DEFAULT 'sandbox'
    CHECK (provider_environment IN ('sandbox','production'));

-- Índices para relatórios por ambiente
CREATE INDEX IF NOT EXISTS idx_payment_charges_env
  ON payment_charges(contractor_id, provider_environment);

CREATE INDEX IF NOT EXISTS idx_gofit_pay_accounts_env
  ON gofit_pay_accounts(contractor_id, provider_environment);
