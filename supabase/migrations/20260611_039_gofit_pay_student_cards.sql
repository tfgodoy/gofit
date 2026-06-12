-- Fase 15.2: Carteira de cartões tokenizados (Asaas)
-- NUNCA armazena número completo do cartão nem CVV — apenas token criptografado
-- (AES-256-GCM via GOFIT_PAY_ENCRYPTION_KEY na Edge Function) e dados mascarados.

CREATE TABLE IF NOT EXISTS gofit_pay_student_cards (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id               UUID        NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  student_id                  UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  payment_customer_id         UUID        NULL REFERENCES payment_customers(id) ON DELETE SET NULL,
  provider                    TEXT        NOT NULL DEFAULT 'asaas',
  provider_environment        TEXT        NOT NULL DEFAULT 'sandbox'
    CHECK (provider_environment IN ('sandbox','production')),
  provider_customer_id        TEXT        NOT NULL,
  credit_card_token_encrypted TEXT        NOT NULL,
  card_brand                  TEXT        NULL,
  card_last4                  TEXT        NULL CHECK (card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$'),
  card_holder_name            TEXT        NULL,
  card_alias                  TEXT        NULL,
  expiry_month                TEXT        NULL,
  expiry_year                 TEXT        NULL,
  is_default                  BOOLEAN     NOT NULL DEFAULT false,
  status                      TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                  TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS gofit_pay_student_cards_ctr_stu_idx
  ON gofit_pay_student_cards (contractor_id, student_id);
CREATE INDEX IF NOT EXISTS gofit_pay_student_cards_default_idx
  ON gofit_pay_student_cards (contractor_id, student_id, is_default);
CREATE INDEX IF NOT EXISTS gofit_pay_student_cards_provider_cus_idx
  ON gofit_pay_student_cards (provider_customer_id);
CREATE INDEX IF NOT EXISTS gofit_pay_student_cards_env_idx
  ON gofit_pay_student_cards (provider_environment);

-- Apenas um cartão principal ATIVO por aluno/ambiente
CREATE UNIQUE INDEX IF NOT EXISTS gofit_pay_student_cards_one_default
  ON gofit_pay_student_cards (contractor_id, student_id, provider_environment)
  WHERE is_default = true AND status = 'active' AND deleted_at IS NULL;

ALTER TABLE gofit_pay_student_cards ENABLE ROW LEVEL SECURITY;

-- Leitura: somente usuário autenticado do próprio contractor.
-- Escrita: exclusiva da Edge Function (service_role bypassa RLS). Sem anon.
CREATE POLICY gofit_pay_student_cards_select ON gofit_pay_student_cards
  FOR SELECT TO authenticated
  USING (contractor_id IN (
    SELECT contractor_auth.contractor_id FROM contractor_auth WHERE contractor_auth.id = auth.uid()
    UNION
    SELECT staff.contractor_id FROM staff WHERE staff.id = auth.uid()
  ));

-- Links de cadastro de cartão (token salvo apenas como hash SHA-256)
CREATE TABLE IF NOT EXISTS gofit_pay_card_registration_links (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id        UUID        NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  student_id           UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  token_hash           TEXT        NOT NULL UNIQUE,
  provider_environment TEXT        NOT NULL DEFAULT 'sandbox'
    CHECK (provider_environment IN ('sandbox','production')),
  expires_at           TIMESTAMPTZ NOT NULL,
  used_at              TIMESTAMPTZ NULL,
  revoked_at           TIMESTAMPTZ NULL,
  created_by           UUID        NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gofit_pay_card_reg_links_ctr_stu_idx
  ON gofit_pay_card_registration_links (contractor_id, student_id);

ALTER TABLE gofit_pay_card_registration_links ENABLE ROW LEVEL SECURITY;
-- Nenhuma política: acessível apenas via service_role (Edge Function).
