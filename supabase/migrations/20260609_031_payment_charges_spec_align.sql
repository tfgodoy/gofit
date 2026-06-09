-- ══════════════════════════════════════════════════════════════════
-- Fase 4 — Alinha payment_charges ao spec formal
-- Não destrutivo: ADD COLUMN IF NOT EXISTS
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE payment_charges
  ADD COLUMN IF NOT EXISTS student_id              uuid,
  ADD COLUMN IF NOT EXISTS student_contract_id     uuid,
  ADD COLUMN IF NOT EXISTS provider                text    NOT NULL DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS provider_charge_id      text,
  ADD COLUMN IF NOT EXISTS amount                  numeric(14,2),
  ADD COLUMN IF NOT EXISTS invoice_url             text,
  ADD COLUMN IF NOT EXISTS raw_response_json       jsonb   DEFAULT '{}'::jsonb;

UPDATE payment_charges
  SET amount           = value,
      provider_charge_id = asaas_payment_id
  WHERE amount IS NULL OR provider_charge_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_payment_charges_student
  ON payment_charges (student_id) WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_charges_contract
  ON payment_charges (student_contract_id) WHERE student_contract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_charges_provider
  ON payment_charges (provider);
CREATE INDEX IF NOT EXISTS idx_payment_charges_prov_charge
  ON payment_charges (provider_charge_id) WHERE provider_charge_id IS NOT NULL;

COMMENT ON COLUMN payment_charges.amount
  IS 'Valor da cobrança (nome canônico do spec). Equivale a value.';
COMMENT ON COLUMN payment_charges.provider_charge_id
  IS 'ID da cobrança no gateway (ex: pay_xxx no Asaas). Equivale a asaas_payment_id.';
COMMENT ON COLUMN payment_charges.invoice_url
  IS 'URL da fatura Asaas (invoiceUrl). Diferente de payment_url (link interativo de pagamento).';
