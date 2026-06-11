-- ══════════════════════════════════════════════════════════════════
-- Fase 4 — Alinha gofit_pay_settings ao spec formal
-- Não destrutivo: ADD COLUMN IF NOT EXISTS
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE gofit_pay_settings
  ADD COLUMN IF NOT EXISTS gofit_pay_account_id       uuid REFERENCES gofit_pay_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS display_name               text,
  ADD COLUMN IF NOT EXISTS late_fee_enabled           boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_fee_percent           numeric(5,2),
  ADD COLUMN IF NOT EXISTS interest_enabled           boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interest_percent           numeric(5,4),
  ADD COLUMN IF NOT EXISTS early_discount_enabled     boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS early_discount_percent     numeric(5,2),
  ADD COLUMN IF NOT EXISTS early_discount_days        integer,
  ADD COLUMN IF NOT EXISTS auto_transfer_disabled     boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_anticipation_enabled  boolean      NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_gofit_pay_settings_account
  ON gofit_pay_settings (gofit_pay_account_id)
  WHERE gofit_pay_account_id IS NOT NULL;
