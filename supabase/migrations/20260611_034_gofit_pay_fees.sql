-- Fase 11: tabela de taxas do GoFit Pay
-- Suporta taxas globais (contractor_id IS NULL) e por empresa (contractor_id preenchido).
-- A Edge Function resolve prioridade: específica > global.

CREATE TABLE IF NOT EXISTS gofit_pay_fees (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id    UUID          NULL,
  billing_type     TEXT          NOT NULL CHECK (billing_type IN ('PIX','BOLETO','CREDIT_CARD')),
  label            TEXT          NOT NULL,
  fixed_fee        NUMERIC(10,4) NOT NULL DEFAULT 0,
  percentage_fee   NUMERIC(10,4) NOT NULL DEFAULT 0,
  installment_min  INT           NULL,
  installment_max  INT           NULL,
  settlement_days  INT           NOT NULL DEFAULT 0,
  description      TEXT          NULL,
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  is_demo          BOOLEAN       NOT NULL DEFAULT false,
  sort_order       INT           NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gofit_pay_fees_billing_type_idx  ON gofit_pay_fees (billing_type);
CREATE INDEX IF NOT EXISTS gofit_pay_fees_contractor_id_idx ON gofit_pay_fees (contractor_id);
CREATE INDEX IF NOT EXISTS gofit_pay_fees_active_idx        ON gofit_pay_fees (is_active) WHERE is_active = true;

ALTER TABLE gofit_pay_fees ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler taxas ativas (dados comerciais, não sensíveis)
CREATE POLICY "gofit_pay_fees_select_authenticated" ON gofit_pay_fees
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_gofit_pay_fees_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER gofit_pay_fees_updated_at
  BEFORE UPDATE ON gofit_pay_fees
  FOR EACH ROW EXECUTE FUNCTION update_gofit_pay_fees_updated_at();

-- Seed: taxas globais de demonstração (contractor_id=null, is_demo=true)
-- Valores são ilustrativos. A definir em produção.
INSERT INTO gofit_pay_fees
  (billing_type, label, fixed_fee, percentage_fee, installment_min, installment_max, settlement_days, description, is_demo, sort_order)
VALUES
  ('PIX',         'Pix',                  0.00, 0.00, NULL, NULL, 0,  'Taxa por transação Pix confirmada. Repasse imediato.',               true, 10),
  ('BOLETO',      'Boleto bancário',       1.99, 1.49, NULL, NULL, 2,  'Taxa por boleto compensado. Repasse em até 2 dias úteis.',           true, 20),
  ('CREDIT_CARD', 'À vista (1x)',          0.00, 2.49, 1,    1,    30, 'Cartão de crédito à vista. Repasse em 30 dias.',                    true, 30),
  ('CREDIT_CARD', 'De 2 a 6 parcelas',     0.00, 3.49, 2,    6,    30, 'Cartão parcelado de 2x a 6x. Prazo por parcela.',                   true, 40),
  ('CREDIT_CARD', 'De 7 a 12 parcelas',    0.00, 4.49, 7,    12,   30, 'Cartão parcelado de 7x a 12x. Prazo por parcela.',                  true, 50)
ON CONFLICT DO NOTHING;
