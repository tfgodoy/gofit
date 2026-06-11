-- ══════════════════════════════════════════════════════════════════
-- Fase 4 — Alinha payment_customers ao spec formal
-- Não destrutivo: ADD COLUMN IF NOT EXISTS
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE payment_customers
  ADD COLUMN IF NOT EXISTS student_id              uuid,
  ADD COLUMN IF NOT EXISTS provider                text NOT NULL DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS provider_customer_id    text;

UPDATE payment_customers
  SET student_id = client_id
  WHERE student_id IS NULL AND client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_customers_student
  ON payment_customers (student_id) WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_customers_provider
  ON payment_customers (provider);
CREATE INDEX IF NOT EXISTS idx_payment_customers_prov_cust
  ON payment_customers (provider_customer_id) WHERE provider_customer_id IS NOT NULL;

COMMENT ON COLUMN payment_customers.student_id
  IS 'Alias canônico do spec para client_id. Ambos referenciam o mesmo aluno.';
COMMENT ON COLUMN payment_customers.provider_customer_id
  IS 'ID do customer no gateway (ex: cus_xxx no Asaas). Equivale a asaas_customer_id.';
