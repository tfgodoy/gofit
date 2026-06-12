-- Fase 15.3: campos para cobrança via cartão tokenizado (não destrutivo)
ALTER TABLE payment_charges
  ADD COLUMN IF NOT EXISTS student_card_id UUID NULL REFERENCES gofit_pay_student_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS card_last4      TEXT NULL,
  ADD COLUMN IF NOT EXISTS card_brand      TEXT NULL,
  ADD COLUMN IF NOT EXISTS charge_mode     TEXT NULL
    CHECK (charge_mode IS NULL OR charge_mode IN ('invoice_url','tokenized_card'));

CREATE INDEX IF NOT EXISTS payment_charges_student_card_idx
  ON payment_charges (student_card_id) WHERE student_card_id IS NOT NULL;
