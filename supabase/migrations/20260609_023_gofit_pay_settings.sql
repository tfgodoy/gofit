-- ══════════════════════════════════════════════════════════════════
-- Fase 4 — GoFit Pay: Configurações operacionais por empresa
--
-- Complementa gofit_pay_config (que guarda o wizard) com
-- configurações de runtime: webhook, expiração, notificações.
-- Populada pelo frontend (empresa configura) e pela Edge Function
-- (webhook_url é gerado pela plataforma).
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gofit_pay_settings (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id               uuid        NOT NULL UNIQUE REFERENCES contractors(id) ON DELETE CASCADE,

  -- Webhook (gerado pela Edge Function na Fase 5, não pelo frontend)
  webhook_url                 text,
  webhook_token               text,        -- token de validação (não sensível — apenas verifica HMAC)

  -- Configurações de cobrança
  charge_description_template text        DEFAULT 'Mensalidade {mes}/{ano} — {nome_aluno}',
  boleto_expiry_days          integer     NOT NULL DEFAULT 3
                              CHECK (boleto_expiry_days BETWEEN 1 AND 30),
  pix_expiry_hours            integer     NOT NULL DEFAULT 24
                              CHECK (pix_expiry_hours BETWEEN 1 AND 168),

  -- Notificações automáticas Asaas
  send_payment_email          boolean     NOT NULL DEFAULT true,
  send_payment_sms            boolean     NOT NULL DEFAULT false,
  send_payment_whatsapp       boolean     NOT NULL DEFAULT false,

  -- Comportamento pós-pagamento
  auto_confirm_received       boolean     NOT NULL DEFAULT true,  -- confirmar recebimento automático
  notify_on_overdue           boolean     NOT NULL DEFAULT true,  -- notificar inadimplência

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gofit_pay_settings_contractor ON gofit_pay_settings (contractor_id);

ALTER TABLE gofit_pay_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gofit_pay_settings_select"
  ON gofit_pay_settings FOR SELECT
  USING (
    contractor_id IN (
      SELECT contractor_id FROM contractor_auth WHERE id = auth.uid()
      UNION
      SELECT contractor_id FROM staff WHERE id = auth.uid()
    )
  );

CREATE POLICY "gofit_pay_settings_insert"
  ON gofit_pay_settings FOR INSERT
  WITH CHECK (
    contractor_id IN (
      SELECT contractor_id FROM contractor_auth WHERE id = auth.uid()
      UNION
      SELECT contractor_id FROM staff WHERE id = auth.uid()
    )
  );

CREATE POLICY "gofit_pay_settings_update"
  ON gofit_pay_settings FOR UPDATE
  USING (
    contractor_id IN (
      SELECT contractor_id FROM contractor_auth WHERE id = auth.uid()
      UNION
      SELECT contractor_id FROM staff WHERE id = auth.uid()
    )
  );
