-- ══════════════════════════════════════════════════════════════════
-- Fase 4 — GoFit Pay: Subconta Asaas por empresa
--
-- Separada de gofit_pay_config (que guarda o wizard de onboarding).
-- Esta tabela guarda o estado da conta Asaas real, populada pela
-- Fase 5 via Edge Functions. NUNCA armazena asaas_api_key.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gofit_pay_accounts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id       uuid        NOT NULL UNIQUE REFERENCES contractors(id) ON DELETE CASCADE,

  -- Status da conta Asaas (atualizado pelas Edge Functions)
  account_status      text        NOT NULL DEFAULT 'pending'
                      CHECK (account_status IN ('pending','active','suspended','cancelled','rejected')),

  -- Identificadores Asaas (preenchidos APENAS por Edge Function na Fase 5)
  -- NOTA: asaas_api_key NÃO está aqui — fica em Supabase Secrets
  asaas_account_id    text,                          -- walletId da subconta
  asaas_environment   text                           -- 'sandbox' | 'production'
                      CHECK (asaas_environment IN ('sandbox','production') OR asaas_environment IS NULL),
  asaas_wallet_id     text,                          -- wallet ID para splits
  asaas_api_key_ref   text,                          -- referência ao secret (ex: "ASAAS_KEY_<uuid>"), não o valor

  -- Controle
  activated_at        timestamptz,
  last_sync_at        timestamptz,
  sync_error          text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gofit_pay_accounts_contractor ON gofit_pay_accounts (contractor_id);
CREATE INDEX IF NOT EXISTS idx_gofit_pay_accounts_status     ON gofit_pay_accounts (account_status);

ALTER TABLE gofit_pay_accounts ENABLE ROW LEVEL SECURITY;

-- SELECT: apenas o próprio contractor
CREATE POLICY "gofit_pay_accounts_select"
  ON gofit_pay_accounts FOR SELECT
  USING (
    contractor_id IN (
      SELECT contractor_id FROM contractor_auth WHERE id = auth.uid()
      UNION
      SELECT contractor_id FROM staff WHERE id = auth.uid()
    )
  );

-- INSERT/UPDATE: apenas via service role (Edge Functions)
-- O frontend nunca insere/atualiza esta tabela diretamente
CREATE POLICY "gofit_pay_accounts_insert_service"
  ON gofit_pay_accounts FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "gofit_pay_accounts_update_service"
  ON gofit_pay_accounts FOR UPDATE
  USING (auth.role() = 'service_role');
