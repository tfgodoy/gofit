-- ══════════════════════════════════════════════════════════════════
-- Fase 4 — GoFit Pay: Campos de gateway em receivables
--
-- Migration NÃO DESTRUTIVA — usa ADD COLUMN IF NOT EXISTS.
-- Os campos ficam NULL por padrão, não impactam o fluxo atual.
-- Serão preenchidos pela Edge Function na Fase 5/6 quando uma
-- cobrança GoFit Pay for emitida e liquidada.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE receivables
  ADD COLUMN IF NOT EXISTS gateway_provider   text     DEFAULT NULL,  -- ex: 'gofit_pay' (null = cobrança manual)
  ADD COLUMN IF NOT EXISTS gateway_status     text     DEFAULT NULL,  -- espelha payment_charges.status
  ADD COLUMN IF NOT EXISTS asaas_payment_id   text     DEFAULT NULL,  -- ex: 'pay_abc123' (FK lógica)
  ADD COLUMN IF NOT EXISTS asaas_customer_id  text     DEFAULT NULL,  -- customer Asaas do pagador
  ADD COLUMN IF NOT EXISTS asaas_payment_url  text     DEFAULT NULL;  -- link de pagamento enviado ao aluno

-- Índices para buscas por gateway
CREATE INDEX IF NOT EXISTS idx_receivables_asaas_payment
  ON receivables (asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_receivables_gateway_provider
  ON receivables (gateway_provider)
  WHERE gateway_provider IS NOT NULL;

-- Comentários descritivos
COMMENT ON COLUMN receivables.gateway_provider  IS 'Provedor de gateway (gofit_pay). NULL = lançamento manual sem gateway.';
COMMENT ON COLUMN receivables.gateway_status    IS 'Status no gateway, espelha payment_charges.status.';
COMMENT ON COLUMN receivables.asaas_payment_id  IS 'ID da cobrança no Asaas (pay_xxx). Preenchido pela Edge Function.';
COMMENT ON COLUMN receivables.asaas_customer_id IS 'ID do customer no Asaas. Preenchido pela Edge Function.';
COMMENT ON COLUMN receivables.asaas_payment_url IS 'Link de pagamento enviado ao aluno. Preenchido pela Edge Function.';
