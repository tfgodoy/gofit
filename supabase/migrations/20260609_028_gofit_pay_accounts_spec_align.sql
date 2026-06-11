-- ══════════════════════════════════════════════════════════════════
-- Fase 4 — Alinha gofit_pay_accounts ao spec formal
-- Não destrutivo: ADD COLUMN IF NOT EXISTS
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE gofit_pay_accounts
  ADD COLUMN IF NOT EXISTS provider                         text    NOT NULL DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS provider_account_id              text,
  ADD COLUMN IF NOT EXISTS provider_wallet_id               text,
  -- Chave API da subconta criptografada com AES-256-GCM
  -- Chave mestre: Supabase Secret GOFIT_PAY_ENCRYPTION_KEY
  -- Descriptografia: Edge Function apenas. NUNCA retornar ao frontend.
  ADD COLUMN IF NOT EXISTS provider_api_key_encrypted       text,
  ADD COLUMN IF NOT EXISTS status                           text    NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','active','suspended','cancelled','rejected')),
  ADD COLUMN IF NOT EXISTS display_name                     text,
  ADD COLUMN IF NOT EXISTS automatic_transfer_enabled       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_card_anticipation_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_gofit_pay_accounts_provider
  ON gofit_pay_accounts (provider);

COMMENT ON COLUMN gofit_pay_accounts.provider_api_key_encrypted
  IS 'API key da subconta criptografada com AES-256-GCM. Descriptografar apenas na Edge Function via GOFIT_PAY_ENCRYPTION_KEY. NUNCA retornar ao frontend.';
