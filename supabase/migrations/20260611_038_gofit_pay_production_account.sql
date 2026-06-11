-- Fase 15.1: Suporte a conta Asaas production por contractor
-- Garante que cada contractor pode ter uma conta por (provider, environment)

ALTER TABLE gofit_pay_accounts
  ADD COLUMN IF NOT EXISTS production_linked_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS production_verified_at  TIMESTAMPTZ;

-- Unique: um contractor pode ter no máximo uma conta sandbox e uma production
CREATE UNIQUE INDEX IF NOT EXISTS idx_gofit_pay_accounts_env_unique
  ON gofit_pay_accounts(contractor_id, provider, provider_environment);
