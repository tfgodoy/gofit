-- ══════════════════════════════════════════════════════════════════
-- Fase 4 — GoFit Pay: Fila de eventos de webhook Asaas
--
-- Toda notificação recebida do Asaas é salva aqui ANTES de ser
-- processada (padrão outbox/inbox). Garante rastreabilidade e
-- permite reprocessamento em caso de falha.
-- Populada EXCLUSIVAMENTE pela Edge Function de webhook (Fase 6).
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gofit_pay_webhook_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id       uuid        NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,

  -- Identificação do evento Asaas
  event_type          text        NOT NULL,   -- ex: PAYMENT_RECEIVED, PAYMENT_OVERDUE, etc.
  asaas_payment_id    text,                   -- referência ao payment, se aplicável
  asaas_event_id      text,                   -- ID único do evento no Asaas (se enviado)

  -- Payload bruto (nunca alterado)
  raw_payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Controle de processamento
  processed           boolean     NOT NULL DEFAULT false,
  processed_at        timestamptz,
  processing_attempts integer     NOT NULL DEFAULT 0,
  error_message       text,

  -- Rastreabilidade
  source_ip           text,
  received_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_contractor  ON gofit_pay_webhook_events (contractor_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_payment_id  ON gofit_pay_webhook_events (asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed   ON gofit_pay_webhook_events (processed, received_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type  ON gofit_pay_webhook_events (event_type);

ALTER TABLE gofit_pay_webhook_events ENABLE ROW LEVEL SECURITY;

-- Somente service role pode inserir (Edge Function de webhook)
CREATE POLICY "webhook_events_insert_service"
  ON gofit_pay_webhook_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- SELECT e UPDATE: service role (processamento) ou contractor (consulta/auditoria)
CREATE POLICY "webhook_events_select"
  ON gofit_pay_webhook_events FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR contractor_id IN (
      SELECT contractor_id FROM contractor_auth WHERE id = auth.uid()
      UNION
      SELECT contractor_id FROM staff WHERE id = auth.uid()
    )
  );

CREATE POLICY "webhook_events_update_service"
  ON gofit_pay_webhook_events FOR UPDATE
  USING (auth.role() = 'service_role');
