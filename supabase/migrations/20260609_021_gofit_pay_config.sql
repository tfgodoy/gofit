-- ══════════════════════════════════════════════════════════════════
-- Fase 3 — GoFit Pay: Tabela de configuração de onboarding
-- Aplicada em: 2026-06-09
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gofit_pay_config (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id             uuid        NOT NULL UNIQUE REFERENCES contractors(id) ON DELETE CASCADE,

  -- Status do onboarding
  onboarding_status         text        NOT NULL DEFAULT 'rascunho'
                            CHECK (onboarding_status IN ('rascunho','enviado','em_analise','ativo','suspenso','cancelado')),
  onboarding_step           integer     NOT NULL DEFAULT 1,

  -- Dados da empresa
  tipo_empresa              text,
  cnpj                      text,
  razao_social              text,
  nome_fantasia             text,
  cep                       text,
  logradouro                text,
  numero_end                text,
  bairro                    text,
  cidade                    text,
  estado                    text,
  complemento               text,

  -- Dados do responsável
  resp_nome                 text,
  resp_cpf                  text,
  resp_nascimento           date,
  resp_email                text,
  resp_celular              text,
  resp_renda_mensal         numeric(14,2),

  -- Dados bancários de repasse
  banco_codigo              text,
  banco_nome                text,
  tipo_conta                text,
  agencia                   text,
  agencia_digito            text,
  conta_num                 text,
  conta_digito              text,
  titular_nome              text,
  titular_documento         text,

  -- Configurações de cobrança
  nome_exibicao             text        DEFAULT 'GoFit Pay',
  multa_ativa               boolean     DEFAULT false,
  multa_percentual          numeric(5,2),
  juros_ativo               boolean     DEFAULT false,
  juros_percentual          numeric(5,4),
  desconto_ativo            boolean     DEFAULT false,
  desconto_percentual       numeric(5,2),
  desconto_dias             integer,
  transferencia_automatica  boolean     DEFAULT false,
  antecipacao_automatica    boolean     DEFAULT false,

  -- Reservados para Fase 4 (Asaas) — preenchidos APENAS por Edge Functions
  -- asaas_api_key NÃO está aqui — fica somente em variáveis de ambiente da Edge Function
  asaas_account_id          text,
  asaas_environment         text        CHECK (asaas_environment IN ('sandbox','production') OR asaas_environment IS NULL),
  asaas_webhook_token       text,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_gofit_pay_config_contractor ON gofit_pay_config (contractor_id);

-- RLS
ALTER TABLE gofit_pay_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gofit_pay_config_select"
  ON gofit_pay_config FOR SELECT
  USING (
    contractor_id IN (
      SELECT contractor_id FROM contractor_auth WHERE id = auth.uid()
      UNION
      SELECT contractor_id FROM staff WHERE id = auth.uid()
    )
  );

CREATE POLICY "gofit_pay_config_insert"
  ON gofit_pay_config FOR INSERT
  WITH CHECK (
    contractor_id IN (
      SELECT contractor_id FROM contractor_auth WHERE id = auth.uid()
      UNION
      SELECT contractor_id FROM staff WHERE id = auth.uid()
    )
  );

CREATE POLICY "gofit_pay_config_update"
  ON gofit_pay_config FOR UPDATE
  USING (
    contractor_id IN (
      SELECT contractor_id FROM contractor_auth WHERE id = auth.uid()
      UNION
      SELECT contractor_id FROM staff WHERE id = auth.uid()
    )
  );
