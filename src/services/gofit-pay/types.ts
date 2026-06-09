/**
 * Fase 4 — GoFit Pay: Tipos compartilhados
 * Alinhado ao spec formal (campos canônicos do spec + aliases de compat)
 */

/* ─── Provedor / Ambiente ─────────────────────────────────────────── */
export type GatewayProvider    = "asaas";                          // extensível para outros gateways
export type AsaasEnvironment   = "sandbox" | "production";

/* ─── Status de conta (gofit_pay_accounts) ────────────────────────── */
export type AccountStatus = "pending" | "active" | "suspended" | "cancelled" | "rejected";

/* ─── Status de cobrança (payment_charges) ────────────────────────── */
export type ChargeStatus =
  | "PENDING"
  | "RECEIVED"
  | "CONFIRMED"
  | "OVERDUE"
  | "REFUNDED"
  | "REFUND_REQUESTED"
  | "CHARGEBACK_DISPUTE"
  | "AWAITING_CHARGEBACK_REVERSAL"
  | "DUNNING_REQUESTED"
  | "DUNNING_RECEIVED"
  | "AWAITING_RISK_ANALYSIS"
  | "CANCELLED";

/* ─── Formas de pagamento ─────────────────────────────────────────── */
export type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "DEBIT_CARD" | "UNDEFINED";

/* ─── Status de onboarding (gofit_pay_config) ─────────────────────── */
export type OnboardingStatus =
  | "rascunho"
  | "enviado"
  | "em_analise"
  | "ativo"
  | "suspenso"
  | "cancelado";

/* ─── gofit_pay_accounts ──────────────────────────────────────────── */
export interface GoFitPayAccount {
  id:                               string;
  contractor_id:                    string;
  provider:                         GatewayProvider;
  provider_account_id:              string | null;   // ID da subconta no provedor
  provider_wallet_id:               string | null;   // wallet ID para splits
  // provider_api_key_encrypted: OMITIDO — nunca retornar ao frontend
  status:                           AccountStatus;
  account_status:                   AccountStatus;   // alias legado (mesmo valor)
  display_name:                     string | null;
  automatic_transfer_enabled:       boolean;
  credit_card_anticipation_enabled: boolean;
  activated_at:                     string | null;
  last_sync_at:                     string | null;
  sync_error:                       string | null;
  created_at:                       string;
  updated_at:                       string;
}

/* ─── gofit_pay_settings ──────────────────────────────────────────── */
export interface GoFitPaySettings {
  id:                       string;
  contractor_id:            string;
  gofit_pay_account_id:     string | null;
  display_name:             string | null;
  // Multa (spec: late_fee_*)
  late_fee_enabled:         boolean;
  late_fee_percent:         number | null;
  // Juros (spec: interest_*)
  interest_enabled:         boolean;
  interest_percent:         number | null;
  // Desconto antecipado (spec: early_discount_*)
  early_discount_enabled:   boolean;
  early_discount_percent:   number | null;
  early_discount_days:      number | null;
  // Transferência e antecipação
  auto_transfer_disabled:   boolean;
  auto_anticipation_enabled: boolean;
  // Campos extras (mantidos da implementação inicial)
  webhook_url:              string | null;
  charge_description_template: string;
  boleto_expiry_days:       number;
  pix_expiry_hours:         number;
  send_payment_email:       boolean;
  send_payment_sms:         boolean;
  send_payment_whatsapp:    boolean;
  auto_confirm_received:    boolean;
  notify_on_overdue:        boolean;
}

/* ─── payment_customers ───────────────────────────────────────────── */
export interface PaymentCustomer {
  id:                    string;
  contractor_id:         string;
  student_id:            string | null;    // nome canônico do spec
  client_id:             string | null;    // alias legado (mesmo valor)
  provider:              GatewayProvider;
  provider_customer_id:  string | null;    // ex: cus_xxx (Asaas)
  // Campos extras (cache do aluno)
  name:                  string;
  email:                 string | null;
  cpf_cnpj:              string | null;
  phone:                 string | null;
  synced_at:             string | null;
  created_at:            string;
  updated_at:            string;
}

/* ─── payment_charges ─────────────────────────────────────────────── */
export interface PaymentCharge {
  id:                    string;
  contractor_id:         string;
  student_id:            string | null;
  student_contract_id:   string | null;
  receivable_id:         string | null;
  provider:              GatewayProvider;
  provider_charge_id:    string | null;    // ex: pay_xxx (Asaas)
  billing_type:          BillingType;
  amount:                number;           // nome canônico do spec
  value:                 number;           // alias legado (mesmo valor)
  due_date:              string;           // YYYY-MM-DD
  status:                ChargeStatus;
  invoice_url:           string | null;    // URL da fatura Asaas
  payment_url:           string | null;    // link interativo de pagamento
  bank_slip_url:         string | null;
  pix_qr_code:           string | null;
  pix_copy_paste:        string | null;
  raw_response_json:     Record<string, unknown>;
  paid_at:               string | null;
  refunded_at:           string | null;
  created_at:            string;
  updated_at:            string;
}

/* ─── gofit_pay_webhook_events ────────────────────────────────────── */
export interface WebhookEvent {
  id:                    string;
  contractor_id:         string;
  provider:              GatewayProvider;
  event_type:            string;
  provider_event_id:     string | null;    // ID único do evento no provedor
  provider_payment_id:   string | null;    // ID da cobrança no provedor
  receivable_id:         string | null;    // receivable afetado (Fase 6)
  payload_json:          Record<string, unknown>;
  processed:             boolean;
  processed_at:          string | null;
  error_message:         string | null;
  received_at:           string;
  created_at:            string;
}

/* ─── Payloads para Edge Functions ────────────────────────────────── */

/** Frontend → Edge Function: criar subconta (Fase 5) */
export interface CreateAccountPayload {
  contractor_id: string;
  environment:   AsaasEnvironment;
}

/** Frontend → Edge Function: criar cobrança (Fase 5) */
export interface CreateChargePayload {
  contractor_id:       string;
  student_id:          string;
  student_contract_id?: string;
  receivable_id?:      string;
  billing_type:        BillingType;
  amount:              number;
  due_date:            string;        // YYYY-MM-DD
  description?:        string;
  external_reference?: string;
}

/** Resposta padrão das Edge Functions */
export interface EdgeFunctionResponse<T = unknown> {
  success: boolean;
  data?:   T;
  error?:  string;
  code?:   string;
}

/* ─── Variáveis de ambiente da Edge Function ──────────────────────── */
/**
 * Definidas em Supabase Secrets (nunca no frontend):
 *   ASAAS_ENV              = sandbox | production
 *   ASAAS_BASE_URL         = https://sandbox.asaas.com/api/v3
 *   ASAAS_API_KEY          = $aact_xxx (chave da plataforma — para criar subcontas)
 *   ASAAS_WEBHOOK_TOKEN    = token de validação HMAC dos webhooks
 *   GOFIT_PAY_ENCRYPTION_KEY = chave AES-256-GCM para criptografar provider_api_key
 */
export const ASAAS_ENV_VARS = [
  "ASAAS_ENV",
  "ASAAS_BASE_URL",
  "ASAAS_API_KEY",
  "ASAAS_WEBHOOK_TOKEN",
  "GOFIT_PAY_ENCRYPTION_KEY",
] as const;

/* ─── Mapeamentos de display ──────────────────────────────────────── */
export const CHARGE_STATUS_LABEL: Record<ChargeStatus, string> = {
  PENDING:                      "Aguardando pagamento",
  RECEIVED:                     "Recebido",
  CONFIRMED:                    "Confirmado",
  OVERDUE:                      "Vencido",
  REFUNDED:                     "Estornado",
  REFUND_REQUESTED:             "Estorno solicitado",
  CHARGEBACK_DISPUTE:           "Disputa de chargeback",
  AWAITING_CHARGEBACK_REVERSAL: "Aguardando reversão",
  DUNNING_REQUESTED:            "Negativação solicitada",
  DUNNING_RECEIVED:             "Negativado",
  AWAITING_RISK_ANALYSIS:       "Em análise de risco",
  CANCELLED:                    "Cancelado",
};

export const CHARGE_STATUS_COLOR: Record<ChargeStatus, string> = {
  PENDING:                      "yellow",
  RECEIVED:                     "green",
  CONFIRMED:                    "green",
  OVERDUE:                      "red",
  REFUNDED:                     "gray",
  REFUND_REQUESTED:             "orange",
  CHARGEBACK_DISPUTE:           "red",
  AWAITING_CHARGEBACK_REVERSAL: "orange",
  DUNNING_REQUESTED:            "red",
  DUNNING_RECEIVED:             "red",
  AWAITING_RISK_ANALYSIS:       "blue",
  CANCELLED:                    "gray",
};

export const BILLING_TYPE_LABEL: Record<BillingType, string> = {
  PIX:         "Pix",
  BOLETO:      "Boleto",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD:  "Cartão de débito",
  UNDEFINED:   "Não definido",
};
