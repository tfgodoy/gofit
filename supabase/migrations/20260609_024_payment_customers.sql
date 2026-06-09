-- ══════════════════════════════════════════════════════════════════
-- Fase 4 — GoFit Pay: Mapeamento aluno → customer Asaas
--
-- Cada aluno tem um customer_id Asaas por empresa (subconta).
-- Criado pela Edge Function quando a primeira cobrança é emitida.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payment_customers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id       uuid        NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  client_id           uuid        NOT NULL,  -- FK para tabela de alunos (clients / students)

  -- Dados cacheados do aluno para identificação no Asaas
  name                text        NOT NULL,
  email               text,
  cpf_cnpj            text,
  phone               text,

  -- Asaas (preenchidos APENAS pela Edge Function)
  asaas_customer_id   text,
  asaas_environment   text
                      CHECK (asaas_environment IN ('sandbox','production') OR asaas_environment IS NULL),

  -- Controle
  synced_at           timestamptz,
  sync_error          text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (contractor_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_customers_contractor ON payment_customers (contractor_id);
CREATE INDEX IF NOT EXISTS idx_payment_customers_client     ON payment_customers (client_id);
CREATE INDEX IF NOT EXISTS idx_payment_customers_asaas_id   ON payment_customers (asaas_customer_id) WHERE asaas_customer_id IS NOT NULL;

ALTER TABLE payment_customers ENABLE ROW LEVEL SECURITY;

-- SELECT: contractor pode ver seus clientes
CREATE POLICY "payment_customers_select"
  ON payment_customers FOR SELECT
  USING (
    contractor_id IN (
      SELECT contractor_id FROM contractor_auth WHERE id = auth.uid()
      UNION
      SELECT contractor_id FROM staff WHERE id = auth.uid()
    )
  );

-- INSERT/UPDATE: apenas via service role (Edge Functions criam o customer no Asaas)
CREATE POLICY "payment_customers_insert_service"
  ON payment_customers FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "payment_customers_update_service"
  ON payment_customers FOR UPDATE
  USING (auth.role() = 'service_role');
