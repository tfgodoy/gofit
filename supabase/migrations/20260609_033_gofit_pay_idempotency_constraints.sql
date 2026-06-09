-- ══════════════════════════════════════════════════════════════════
-- Hardening pré-Fase 5: Constraints de idempotência
-- Não destrutivo — CREATE UNIQUE INDEX IF NOT EXISTS / DO $$
-- ══════════════════════════════════════════════════════════════════

-- ── 1. gofit_pay_accounts: único por (contractor_id, provider) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_gofit_pay_accounts_contractor_provider'
      AND conrelid = 'gofit_pay_accounts'::regclass
  ) THEN
    ALTER TABLE gofit_pay_accounts
      ADD CONSTRAINT uq_gofit_pay_accounts_contractor_provider
      UNIQUE (contractor_id, provider);
  END IF;
END $$;

-- ── 2. gofit_pay_webhook_events: único por (provider, provider_event_id) ──
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_provider_event_id
  ON gofit_pay_webhook_events (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

-- ── 3. payment_charges: idempotência de cobranças futuras ──
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_charges_provider_charge_id
  ON payment_charges (provider, provider_charge_id)
  WHERE provider_charge_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_charges_receivable_provider
  ON payment_charges (receivable_id, provider)
  WHERE receivable_id IS NOT NULL;

COMMENT ON TABLE gofit_pay_accounts IS
  'Subconta do gateway por empresa. uq_gofit_pay_accounts_contractor_provider garante no máximo uma conta por provider por empresa.';
COMMENT ON TABLE gofit_pay_webhook_events IS
  'Fila inbox de eventos webhook. provider_event_id é idempotente.';
COMMENT ON TABLE payment_charges IS
  'Cobranças do gateway. uq_payment_charges_receivable_provider: um receivable gera no máximo uma cobrança por provider.';
