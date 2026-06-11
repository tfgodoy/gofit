/**
 * Fase 4 — GoFit Pay: Serviço frontend
 * Alinhado ao spec formal (campos canônicos: amount, student_id, provider_*)
 *
 * ARQUITETURA (obrigatória):
 *   Tela/Componente
 *   → GoFitPayService          (este arquivo — frontend)
 *   → Supabase Edge Function   (gofit-pay-base)
 *   → AsaasService             (server-side — _asaas.ts)
 *   → API Asaas
 *
 * REGRAS DE SEGURANÇA:
 *   ✗ NUNCA chama a API Asaas diretamente
 *   ✗ NUNCA expõe ASAAS_API_KEY no frontend
 *   ✗ NUNCA usa VITE_SUPABASE_SERVICE_ROLE_KEY no frontend
 *   ✗ NUNCA lê provider_api_key_encrypted do banco (omitir da query)
 *   ✓ Toda operação sensível → Edge Function via supabase.functions.invoke()
 *   ✓ Leituras de display → queries Supabase com RLS
 *
 * FASE ATUAL: 4
 *   - Leituras: funcionais
 *   - Escritas via Asaas: stubs (GoFitPayNotImplementedError)
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  GoFitPayAccount,
  GoFitPaySettings,
  PaymentCharge,
  PaymentCustomer,
  WebhookEvent,
  CreateChargePayload,
  EdgeFunctionResponse,
  AsaasEnvironment,
} from "./types";

/* ── Campos seguros para SELECT (omite provider_api_key_encrypted) ── */
const ACCOUNT_SAFE_FIELDS = [
  "id", "contractor_id", "provider", "provider_account_id", "provider_wallet_id",
  "status", "account_status", "display_name",
  "automatic_transfer_enabled", "credit_card_anticipation_enabled",
  "activated_at", "last_sync_at", "sync_error", "created_at", "updated_at",
].join(",");

/* ══════════════════════════════════════════════════════════════════ */

export const GoFitPayService = {

  /* ─── Conta GoFit Pay ────────────────────────────────────────────── */

  /**
   * Busca a conta do provedor da empresa.
   * OMITE provider_api_key_encrypted por segurança.
   */
  async getAccount(contractorId: string): Promise<GoFitPayAccount | null> {
    const { data, error } = await supabase
      .from("gofit_pay_accounts")
      .select(ACCOUNT_SAFE_FIELDS)
      .eq("contractor_id", contractorId)
      .maybeSingle();

    if (error) {
      console.error("[GoFitPayService] getAccount error:", error.message);
      return null;
    }
    return data as GoFitPayAccount | null;
  },

  /* ─── Configurações operacionais ─────────────────────────────────── */

  async getSettings(contractorId: string): Promise<GoFitPaySettings | null> {
    const { data, error } = await supabase
      .from("gofit_pay_settings")
      .select("*")
      .eq("contractor_id", contractorId)
      .maybeSingle();

    if (error) {
      console.error("[GoFitPayService] getSettings error:", error.message);
      return null;
    }
    return data as GoFitPaySettings | null;
  },

  /**
   * Salva configurações operacionais (editadas pelo usuário).
   * Campos de billing (late_fee, interest, discount) também passam por aqui.
   */
  async saveSettings(
    contractorId: string,
    settings: Partial<Omit<GoFitPaySettings, "id" | "contractor_id">>
  ): Promise<{ success: boolean; error?: string }> {
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from("gofit_pay_settings")
      .select("id")
      .eq("contractor_id", contractorId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("gofit_pay_settings")
        .update({ ...settings, updated_at: now })
        .eq("contractor_id", contractorId);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await supabase
        .from("gofit_pay_settings")
        .insert({ contractor_id: contractorId, ...settings, created_at: now, updated_at: now });
      if (error) return { success: false, error: error.message };
    }

    return { success: true };
  },

  /* ─── Cobranças ──────────────────────────────────────────────────── */

  /**
   * Lista cobranças usando campos canônicos do spec.
   */
  async listCharges(
    contractorId: string,
    opts?: {
      status?:        string;
      student_id?:    string;
      receivable_id?: string;
      limit?:         number;
      offset?:        number;
    }
  ): Promise<PaymentCharge[]> {
    let query = supabase
      .from("payment_charges")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("created_at", { ascending: false });

    if (opts?.status)        query = query.eq("status", opts.status);
    if (opts?.student_id)    query = query.eq("student_id", opts.student_id);
    if (opts?.receivable_id) query = query.eq("receivable_id", opts.receivable_id);
    if (opts?.limit)         query = query.limit(opts.limit);
    if (opts?.offset)        query = query.range(opts.offset, (opts.offset + (opts.limit ?? 50)) - 1);

    const { data, error } = await query;
    if (error) {
      console.error("[GoFitPayService] listCharges error:", error.message);
      return [];
    }
    return (data ?? []) as PaymentCharge[];
  },

  /**
   * Busca cobrança pelo provider_charge_id (ex: pay_xxx do Asaas).
   */
  async getChargeByProviderChargeId(providerChargeId: string): Promise<PaymentCharge | null> {
    const { data, error } = await supabase
      .from("payment_charges")
      .select("*")
      .eq("provider_charge_id", providerChargeId)
      .maybeSingle();

    if (error) {
      console.error("[GoFitPayService] getChargeByProviderChargeId error:", error.message);
      return null;
    }
    return data as PaymentCharge | null;
  },

  /* ─── Customers ──────────────────────────────────────────────────── */

  /**
   * Busca o customer do provedor para um aluno específico.
   * Usa student_id (canônico do spec).
   */
  async getCustomerByStudentId(
    contractorId: string,
    studentId:    string
  ): Promise<PaymentCustomer | null> {
    const { data, error } = await supabase
      .from("payment_customers")
      .select("*")
      .eq("contractor_id", contractorId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (error) {
      // Tenta por client_id (legado) se não encontrou por student_id
      const { data: fallback } = await supabase
        .from("payment_customers")
        .select("*")
        .eq("contractor_id", contractorId)
        .eq("client_id", studentId)
        .maybeSingle();
      return (fallback as PaymentCustomer | null);
    }
    return data as PaymentCustomer | null;
  },

  /* ─── Webhook events (auditoria) ─────────────────────────────────── */

  async listWebhookEvents(
    contractorId: string,
    opts?: { processed?: boolean; limit?: number }
  ): Promise<WebhookEvent[]> {
    let query = supabase
      .from("gofit_pay_webhook_events")
      .select("id,contractor_id,provider,event_type,provider_event_id,provider_payment_id,receivable_id,processed,processed_at,error_message,received_at,created_at")
      .eq("contractor_id", contractorId)
      .order("received_at", { ascending: false });

    if (opts?.processed !== undefined) query = query.eq("processed", opts.processed);
    if (opts?.limit) query = query.limit(opts.limit);

    const { data, error } = await query;
    if (error) {
      console.error("[GoFitPayService] listWebhookEvents error:", error.message);
      return [];
    }
    return (data ?? []) as WebhookEvent[];
  },

  /* ─── Edge Functions (Fase 5+) ───────────────────────────────────── */

  /**
   * FASE 5 — Cria/vincula subconta Asaas para a empresa.
   *
   * Edge Function (activate_gofit_pay):
   *   1. Lê gofit_pay_config (dados do wizard)
   *   2. POST /accounts no Asaas com ASAAS_API_KEY da plataforma (sandbox)
   *   3. Criptografa a subconta apiKey com AES-256-GCM
   *   4. Salva em gofit_pay_accounts (provider_api_key_encrypted nunca retornado)
   *   5. Salva gofit_pay_settings (multa, juros, desconto)
   *   6. Atualiza company_modules.status = 'in_review' ou 'active'
   *
   * SEGURANÇA: contractor_id vem do JWT na Edge Function — nunca do body.
   */
  async createAccount(
    _contractorId: string,
    _environment:  AsaasEnvironment = "sandbox"
  ): Promise<EdgeFunctionResponse<{
    status:              string;
    provider_account_id: string;
    provider_wallet_id:  string | null;
    account_key_stored:  boolean | null;
    onboarding_status:   string;
    environment:         string | null;
    message:             string;
    already_activated?:  boolean;
  }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "activate_gofit_pay" },
      // contractor_id NÃO enviado no body — Edge Function resolve via JWT
    });

    if (error) {
      console.error("[GoFitPayService] createAccount error:", error.message);
      return { success: false, error: error.message };
    }

    return data as EdgeFunctionResponse<{
      status:              string;
      provider_account_id: string;
      provider_wallet_id:  string | null;
      account_key_stored:  boolean | null;
      onboarding_status:   string;
      environment:         string | null;
      message:             string;
      already_activated?:  boolean;
    }>;
  },

  /**
   * FASE 5 — Consulta status atual da ativação.
   * Retorna dados seguros: status, provider_account_id, provider_wallet_id, datas.
   * Nunca retorna provider_api_key_encrypted.
   */
  async getActivationStatus(): Promise<EdgeFunctionResponse<{
    activated:           boolean;
    status:              string | null;
    module_status:       string | null;
    provider_account_id: string | null;
    provider_wallet_id:  string | null;
    activated_at:        string | null;
    last_sync_at:        string | null;
    sync_error:          string | null;
  }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "get_activation_status" },
    });

    if (error) {
      console.error("[GoFitPayService] getActivationStatus error:", error.message);
      return { success: false, error: error.message };
    }

    return data as EdgeFunctionResponse<{
      activated:           boolean;
      status:              string | null;
      module_status:       string | null;
      provider_account_id: string | null;
      provider_wallet_id:  string | null;
      activated_at:        string | null;
      last_sync_at:        string | null;
      sync_error:          string | null;
    }>;
  },

  /**
   * FASE 5 — Retry após falha de ativação.
   * Só permitido quando status = 'activation_failed'.
   * Em sandbox: limpa o registro anterior e re-cria subconta.
   */
  async retryActivation(): Promise<EdgeFunctionResponse<{
    status:              string;
    provider_account_id: string;
    provider_wallet_id:  string | null;
    message:             string;
  }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "retry_activation" },
    });

    if (error) {
      console.error("[GoFitPayService] retryActivation error:", error.message);
      return { success: false, error: error.message };
    }

    return data as EdgeFunctionResponse<{
      status:              string;
      provider_account_id: string;
      provider_wallet_id:  string | null;
      message:             string;
    }>;
  },

  /**
   * FASE 6 — Cria cobrança Pix ou Boleto para uma receivable existente.
   *
   * Edge Function (create_payment_charge):
   *   1. Valida receivable ownership + status
   *   2. Garante idempotência (receivable já tem cobrança?)
   *   3. Descriptografa chave da subconta (server-side)
   *   4. Cria/obtém customer Asaas
   *   5. POST /payments no Asaas
   *   6. Para PIX: GET /payments/{id}/pixQrCode
   *   7. Salva payment_charges
   *   8. Atualiza receivable.gateway_*
   *
   * SEGURANÇA: contractor_id e chave da subconta resolvidos na Edge Function.
   */
  async createCharge(
    payload: CreateChargePayload
  ): Promise<EdgeFunctionResponse<{
    charge_id:          string;
    provider_charge_id: string;
    billing_type:       string;
    status:             string;
    amount:             number;
    due_date:           string;
    invoice_url:        string | null;
    bank_slip_url:      string | null;
    pix_qr_code:        string | null;
    pix_copy_paste:     string | null;
    already_existed:    boolean;
    message:            string;
  }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: {
        action:        "create_payment_charge",
        receivable_id: payload.receivable_id,
        billing_type:  payload.billing_type,
      },
      // contractor_id NÃO enviado no body — Edge Function resolve via JWT
    });

    if (error) {
      console.error("[GoFitPayService] createCharge error:", error.message);
      return { success: false, error: error.message };
    }

    return data as EdgeFunctionResponse<{
      charge_id:          string;
      provider_charge_id: string;
      billing_type:       string;
      status:             string;
      amount:             number;
      due_date:           string;
      invoice_url:        string | null;
      bank_slip_url:      string | null;
      pix_qr_code:        string | null;
      pix_copy_paste:     string | null;
      already_existed:    boolean;
      message:            string;
    }>;
  },

  /**
   * FASE 7.1 — Sincroniza status de uma cobrança com o Asaas.
   * Busca o status atual e atualiza payment_charges + receivable.
   * Aplica baixa automática se status for RECEIVED (mesmas regras do webhook).
   */
  async syncChargeStatus(
    chargeId: string
  ): Promise<EdgeFunctionResponse<{
    charge_id:          string;
    provider_charge_id: string;
    status:             string;
    invoice_url:        string | null;
    bank_slip_url:      string | null;
    pix_qr_code:        string | null;
    pix_copy_paste:     string | null;
    receivable_updated: boolean;
    message:            string;
  }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "sync_charge_status", charge_id: chargeId },
    });
    if (error) {
      console.error("[GoFitPayService] syncChargeStatus error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<{
      charge_id:          string;
      provider_charge_id: string;
      status:             string;
      invoice_url:        string | null;
      bank_slip_url:      string | null;
      pix_qr_code:        string | null;
      pix_copy_paste:     string | null;
      receivable_updated: boolean;
      message:            string;
    }>;
  },

  /**
   * FASE 7.1 — Reprocessa um evento de webhook específico.
   */
  async processWebhookEvent(eventId: string): Promise<EdgeFunctionResponse<{
    already_processed?: boolean;
    processed:          boolean;
    message:            string;
    receivableUpdated:  boolean;
    chargeId:           string | null;
    receivableId:       string | null;
  }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "process_webhook_event", event_id: eventId },
    });
    if (error) {
      console.error("[GoFitPayService] processWebhookEvent error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<{
      already_processed?: boolean;
      processed:          boolean;
      message:            string;
      receivableUpdated:  boolean;
      chargeId:           string | null;
      receivableId:       string | null;
    }>;
  },

  /**
   * FASE 7.1 — Processa eventos pendentes em lote.
   */
  async processPendingWebhooks(limit = 20): Promise<EdgeFunctionResponse<{
    processed_count: number;
    failed_count:    number;
    total:           number;
    events:          Array<{ event_id: string; event_type: string; result: string }>;
  }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "process_pending_webhooks", limit },
    });
    if (error) {
      console.error("[GoFitPayService] processPendingWebhooks error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<{
      processed_count: number;
      failed_count:    number;
      total:           number;
      events:          Array<{ event_id: string; event_type: string; result: string }>;
    }>;
  },

  /**
   * FASE 7.1 — Lista eventos de webhook por provider_payment_id (para drawer de detalhe).
   */
  async listWebhookEventsByProviderPaymentId(
    contractorId: string,
    providerPaymentId: string
  ): Promise<WebhookEvent[]> {
    const { data, error } = await supabase
      .from("gofit_pay_webhook_events")
      .select("id,contractor_id,provider,event_type,provider_event_id,provider_payment_id,receivable_id,processed,processed_at,error_message,processing_attempts,received_at,created_at")
      .eq("contractor_id", contractorId)
      .eq("provider_payment_id", providerPaymentId)
      .order("received_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[GoFitPayService] listWebhookEventsByProviderPaymentId error:", error.message);
      return [];
    }
    return (data ?? []) as WebhookEvent[];
  },

  /**
   * FASE 8 — Cancela cobrança no Asaas.
   *
   * Regras (aplicadas na Edge Function):
   *   - receivable.status !== 'pago' → pode cancelar
   *   - charge.status RECEIVED/CONFIRMED → impede cancelamento
   *   - charge já CANCELLED → retorna already_cancelled: true (idempotente)
   *   - contractor_id resolvido server-side
   */
  async cancelCharge(
    chargeId: string
  ): Promise<EdgeFunctionResponse<{
    charge_id:          string;
    provider_charge_id: string;
    previous_status:    string;
    status:             string;
    cancelled_at:       string;
    already_cancelled?: boolean;
    message:            string;
  }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "cancel_charge", charge_id: chargeId },
      // contractor_id NÃO enviado no body — Edge Function resolve via JWT
    });
    if (error) {
      console.error("[GoFitPayService] cancelCharge error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<{
      charge_id:          string;
      provider_charge_id: string;
      previous_status:    string;
      status:             string;
      cancelled_at:       string;
      already_cancelled?: boolean;
      message:            string;
    }>;
  },

  /* ─── Fase 10 — Recorrência controlada ──────────────────────────── */

  /**
   * FASE 10 — Preview das receivables elegíveis para cobrança recorrente.
   * Não cria cobranças — apenas lista e classifica elegibilidade.
   */
  async previewRecurringCharges(opts: {
    student_id?:          string;
    student_contract_id?: string;
    billing_type:         string;
    limit?:               number;
  }): Promise<EdgeFunctionResponse<{
    total:          number;
    eligible_count: number;
    billing_type:   string;
    items: Array<{
      receivable_id:          string;
      student_id:             string | null;
      student_nome:           string | null;
      student_contract_id:    string | null;
      descricao:              string | null;
      valor:                  number;
      vencimento:             string;
      vencimento_ajustado:    string;
      vencimento_era_passado: boolean;
      status:                 string;
      eligible:               boolean;
      reason:                 string | null;
      existing_charge_id:     string | null;
      existing_charge_status: string | null;
    }>;
  }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: {
        action:              "preview_recurring_charges",
        billing_type:        opts.billing_type,
        student_id:          opts.student_id          ?? null,
        student_contract_id: opts.student_contract_id ?? null,
        limit:               opts.limit               ?? 20,
      },
    });
    if (error) {
      console.error("[GoFitPayService] previewRecurringCharges error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<{
      total:          number;
      eligible_count: number;
      billing_type:   string;
      items: Array<{
        receivable_id:          string;
        student_id:             string | null;
        student_nome:           string | null;
        student_contract_id:    string | null;
        descricao:              string | null;
        valor:                  number;
        vencimento:             string;
        vencimento_ajustado:    string;
        vencimento_era_passado: boolean;
        status:                 string;
        eligible:               boolean;
        reason:                 string | null;
        existing_charge_id:     string | null;
        existing_charge_status: string | null;
      }>;
    }>;
  },

  /**
   * FASE 10 — Cria cobranças em lote para receivables selecionadas.
   * Contém idempotência, validação de ownership e status por receivable.
   */
  async createRecurringCharges(opts: {
    receivable_ids: string[];
    billing_type:   string;
  }): Promise<EdgeFunctionResponse<{
    summary: {
      requested:     number;
      created:       number;
      already_exists: number;
      skipped:       number;
      failed:        number;
    };
    billing_type: string;
    items: Array<{
      receivable_id:      string;
      status:             "created" | "already_exists" | "skipped" | "failed";
      provider_charge_id: string | null;
      charge_id:          string | null;
      billing_type:       string | null;
      reason:             string | null;
    }>;
  }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: {
        action:         "create_recurring_charges",
        receivable_ids: opts.receivable_ids,
        billing_type:   opts.billing_type,
      },
    });
    if (error) {
      console.error("[GoFitPayService] createRecurringCharges error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<{
      summary: {
        requested:     number;
        created:       number;
        already_exists: number;
        skipped:       number;
        failed:        number;
      };
      billing_type: string;
      items: Array<{
        receivable_id:      string;
        status:             "created" | "already_exists" | "skipped" | "failed";
        provider_charge_id: string | null;
        charge_id:          string | null;
        billing_type:       string | null;
        reason:             string | null;
      }>;
    }>;
  },

  /**
   * FASE 11 — Retorna taxas ativas do GoFit Pay.
   * Taxas específicas da empresa têm prioridade sobre globais.
   */
  async getFees(): Promise<EdgeFunctionResponse<{
    fees: GoFitPayFee[];
    source: "contractor" | "global";
  }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "get_fees" },
    });
    if (error) {
      console.error("[GoFitPayService] getFees error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<{ fees: GoFitPayFee[]; source: "contractor" | "global" }>;
  },

} as const;

/* ─── Tipos Fase 11 ─────────────────────────────────────────────── */
export interface GoFitPayFee {
  id:              string;
  contractor_id:   string | null;
  billing_type:    "PIX" | "BOLETO" | "CREDIT_CARD";
  label:           string;
  fixed_fee:       number;
  percentage_fee:  number;
  installment_min: number | null;
  installment_max: number | null;
  settlement_days: number;
  description:     string | null;
  is_demo:         boolean;
  sort_order:      number;
}

/* ─── Erro de funcionalidade não implementada ────────────────────── */
export class GoFitPayNotImplementedError extends Error {
  constructor(
    public readonly method: string,
    public readonly availableInPhase: number,
    message: string
  ) {
    super(`[GoFitPay] ${method}: ${message} (Fase ${availableInPhase})`);
    this.name = "GoFitPayNotImplementedError";
  }
}
