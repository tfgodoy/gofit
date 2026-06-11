-- Fase 12: observações internas de cobrança (régua / inadimplência)
-- Somente leitura interna — não altera status financeiro.

CREATE TABLE IF NOT EXISTS gofit_pay_collection_notes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id  UUID        NOT NULL,
  receivable_id  UUID        NOT NULL,
  student_id     UUID        NULL,
  note           TEXT        NOT NULL CHECK (char_length(note) BETWEEN 1 AND 500),
  created_by     UUID        NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gofit_pay_collection_notes_rcv_idx ON gofit_pay_collection_notes (receivable_id);
CREATE INDEX IF NOT EXISTS gofit_pay_collection_notes_ctr_idx ON gofit_pay_collection_notes (contractor_id);

ALTER TABLE gofit_pay_collection_notes ENABLE ROW LEVEL SECURITY;

-- Leitura e inserção por usuários autenticados (contractor_id é validado no servidor)
CREATE POLICY "collection_notes_select" ON gofit_pay_collection_notes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "collection_notes_insert" ON gofit_pay_collection_notes
  FOR INSERT TO authenticated WITH CHECK (true);
