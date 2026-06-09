-- ══════════════════════════════════════════════════════════════════
-- Fase 4 — Alinha gofit_pay_webhook_events ao spec formal
-- Não destrutivo: ADD COLUMN IF NOT EXISTS
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE gofit_pay_webhook_events
  ADD COLUMN IF NOT EXISTS provider               text    NOT NULL DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS provider_event_id      text,
  ADD COLUMN IF NOT EXISTS provider_payment_id    text,
  ADD COLUMN IF NOT EXISTS receivable_id          uuid,
  ADD COLUMN IF NOT EXISTS payload_json           jsonb   DEFAULT '{}'::jsonb;

UPDATE gofit_pay_webhook_events
  SET provider_event_id   = asaas_event_id,
      provider_payment_id = asaas_payment_id,
      payload_json        = raw_payload
  WHERE provider_event_id IS NULL OR provider_payment_id IS NULL OR payload_json = '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider
  ON gofit_pay_webhook_events (provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_prov_event_id
  ON gofit_pay_webhook_events (provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_prov_pmt_id
  ON gofit_pay_webhook_events (provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_receivable
  ON gofit_pay_webhook_events (receivable_id) WHERE receivable_id IS NOT NULL;

COMMENT ON COLUMN gofit_pay_webhook_events.provider_event_id
  IS 'ID único do evento no gateway. Equivale a asaas_event_id.';
COMMENT ON COLUMN gofit_pay_webhook_events.payload_json
  IS 'Payload canônico do spec. Equivale a raw_payload (mantido para compatibilidade).';
