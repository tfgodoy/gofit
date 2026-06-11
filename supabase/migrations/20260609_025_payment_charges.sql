-- ══════════════════════════════════════════════════════════════════
-- Fase 4 — GoFit Pay: Cobranças via gateway
--
-- Registra cada cobrança criada no Asaas.
-- Criada pela Edge Function na Fase 5.
-- Linkada opcionalmente a receivables (baixa automática na Fase 6).
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payment_charges (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id         uuid        NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,

  -- Relacionamentos internos
  payment_customer_id   uuid        REFERENCES payment_customers(id) ON DELETE SET NULL,
  receivable_id         uuid,       -- FK para receivables (nullable — pode ser cobrança avulsa)

  -- Identificação Asaas
  asaas_payment_id      text        UNIQUE,  -- ex: 'pay_abc123'
  asaas_environment     text
                        CHECK (asaas_environment IN ('sandbox','production') OR asaas_environment IS NULL),

  -- Dados da cobrança
  billing_type          text        NOT NULL
                        CHECK (billing_type IN ('PIX','BOLETO','CREDIT_CARD','DEBIT_CARD','UNDEFINED')),
  value                 numeric(14,2) NOT NULL CHECK (value > 0),
  net_value             numeric(14,2),        -- valor líquido após taxas (atualizado no recebimento)
  due_date              date        NOT NULL,
  description           text,
  external_reference    text,                  -- referência interna (ex: "receivable:uuid")

  -- Status (espelha o status Asaas)
  status                text        NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN (
                          'PENDING','RECEIVED','CONFIRMED','OVERDUE',
                          'REFUNDED','REFUND_REQUESTED','CHARGEBACK_DISPUTE',
                          'AWAITING_CHARGEBACK_REVERSAL','DUNNING_REQUESTED',
                          'DUNNING_RECEIVED','AWAITING_RISK_ANALYSIS','CANCELLED'
                        )),

  -- URLs de pagamento (geradas pelo Asaas)
  payment_url           text,
  bank_slip_url         text,
  pix_qr_code           text,
  pix_copy_paste        text,

  -- Datas de controle
  confirmed_at          timestamptz,
  paid_at               timestamptz,
  refunded_at           timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_charges_contractor     ON payment_charges (contractor_id);
CREATE INDEX IF NOT EXISTS idx_payment_charges_customer       ON payment_charges (payment_customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_charges_receivable     ON payment_charges (receivable_id) WHERE receivable_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_charges_asaas_id       ON payment_charges (asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_charges_status         ON payment_charges (status);
CREATE INDEX IF NOT EXISTS idx_payment_charges_due_date       ON payment_charges (due_date);

ALTER TABLE payment_charges ENABLE ROW LEVEL SECURITY;

-- SELECT: contractor vê suas cobranças
CREATE POLICY "payment_charges_select"
  ON payment_charges FOR SELECT
  USING (
    contractor_id IN (
      SELECT contractor_id FROM contractor_auth WHERE id = auth.uid()
      UNION
      SELECT contractor_id FROM staff WHERE id = auth.uid()
    )
  );

-- INSERT/UPDATE: apenas via service role (Edge Functions emitem cobranças)
CREATE POLICY "payment_charges_insert_service"
  ON payment_charges FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "payment_charges_update_service"
  ON payment_charges FOR UPDATE
  USING (auth.role() = 'service_role');
