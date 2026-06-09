/**
 * Fase 4 — GoFit Pay: Tipos compartilhados
 *
 * Usados por GoFitPayService (frontend→EdgeFunction) e pelas
 * Edge Functions (server-side). AsaasService vive apenas no servidor.
 */

/* ─── Ambiente ────────────────────────────────────────────────────── */
export type AsaasEnvironment = "sandbox" | "production";

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

/* ─── Formas de pagamento suportadas ──────────────────────────────── */
export type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "DEBIT_CARD" | "UNDEFINED";

/* ─── Status de onboarding (gofit_pay_config) ─────────────────────── */
export type OnboardingStatus =
  | "rascunho"
  | "enviado"
  | "em_analise"
  | "ativo"
  | "suspenso"
  | "cancelado";

/* ─── Conta GoFit Pay (gofit_pay_accounts) ────────────────────────── */
export interface GoFitPayAccount {
  id: string;
  contractor_id: string;
  account_status: AccountStatus;
  asaas_account_id: string | null;
  asaas_environment: AsaasEnvironment | null;
  asaas_wallet_id: string | null;
  activated_at: string | null;
  last_sync_at: string | null;
  sync_error: string | null;
}

/* ─── Configurações operacionais (gofit_pay_settings) ─────────────── */
export interface GoFitPaySettings {
  id: string;
  contractor_id: string;
  webhook_url: string | null;
  charge_description_template: string;
  boleto_expiry_days: number;
  pix_expiry_hours: number;
  send_payment_email: boolean;
  send_payment_sms: boolean;
  send_payment_whatsapp: boolean;
  auto_confirm_received: boolean;
  notify_on_overdue: boolean;
}

/* ─── Customer de pagamento (payment_customers) ───────────────────── */
export interface PaymentCustomer {
  id: string;
  contractor_id: string;
  client_id: string;
  name: string;
  email: string | null;
  cpf_cnpj: string | null;
  phone: string | null;
  asaas_customer_id: string | null;
  asaas_environment: AsaasEnvironment | null;
  synced_at: string | null;
}

/* ─── Cobrança (payment_charges) ──────────────────────────────────── */
export interface PaymentCharge {
  id: string;
  contractor_id: string;
  payment_customer_id: string | null;
  receivable_id: string | null;
  asaas_payment_id: string | null;
  billing_type: BillingType;
  value: number;
  net_value: number | null;
  due_date: string;             // YYYY-MM-DD
  description: string | null;
  status: ChargeStatus;
  payment_url: string | null;
  bank_slip_url: string | null;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  confirmed_at: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
}

/* ─── Evento de webhook (gofit_pay_webhook_events) ────────────────── */
export interface WebhookEvent {
  id: string;
  contractor_id: string;
  event_type: string;
  asaas_payment_id: string | null;
  raw_payload: Record<string, unknown>;
  processed: boolean;
  processed_at: string | null;
  processing_attempts: number;
  error_message: string | null;
  received_at: string;
}

/* ─── Payloads para Edge Functions ────────────────────────────────── */

/** Payload enviado pelo frontend para criar subconta (Fase 5) */
export interface CreateAccountPayload {
  contractor_id: string;
  environment: AsaasEnvironment;
}

/** Payload enviado pelo frontend para criar cobrança (Fase 5) */
export interface CreateChargePayload {
  contractor_id: string;
  client_id: string;
  receivable_id?: string;
  billing_type: BillingType;
  value: number;
  due_date: string;       // YYYY-MM-DD
  description?: string;
  external_reference?: string;
}

/** Resposta padrão das Edge Functions */
export interface EdgeFunctionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/* ─── Mapeamento de status Asaas → PT-BR ─────────────────────────── */
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
