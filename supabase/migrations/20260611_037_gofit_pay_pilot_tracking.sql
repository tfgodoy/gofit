-- Fase 15: Rastreamento do piloto de produção controlada GoFit Pay

ALTER TABLE gofit_pay_settings
  ADD COLUMN IF NOT EXISTS pilot_enabled_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pilot_notes         TEXT,
  ADD COLUMN IF NOT EXISTS rollback_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rollback_notes      TEXT;

-- Índice: facilita auditoria de pilotos ativos
CREATE INDEX IF NOT EXISTS idx_gofit_pay_settings_pilot
  ON gofit_pay_settings(contractor_id, allowed_for_real_charges)
  WHERE allowed_for_real_charges = true;
