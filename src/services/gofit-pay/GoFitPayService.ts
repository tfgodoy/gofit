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
   * FASE 12 — Retorna overview de inadimplência.
   * Receivables vencidas, não pagas, com cobrança GoFit Pay se houver.
   */
  async getCollectionOverview(opts?: {
    student_id?:   string;
    has_charge?:   boolean;
    billing_type?: string;
    delay_band?:   string;
    limit?:        number;
  }): Promise<EdgeFunctionResponse<{
    summary: CollectionSummary;
    items:   OverdueItem[];
    total:   number;
  }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: {
        action:       "get_collection_overview",
        student_id:   opts?.student_id   ?? undefined,
        has_charge:   opts?.has_charge   ?? undefined,
        billing_type: opts?.billing_type ?? undefined,
        delay_band:   opts?.delay_band   ?? undefined,
        limit:        opts?.limit        ?? 150,
      },
    });
    if (error) {
      console.error("[GoFitPayService] getCollectionOverview error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<{ summary: CollectionSummary; items: OverdueItem[]; total: number }>;
  },

  async addCollectionNote(receivable_id: string, note: string): Promise<EdgeFunctionResponse<{
    note: { id: string; note: string; created_at: string };
  }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "add_collection_note", receivable_id, note },
    });
    if (error) {
      console.error("[GoFitPayService] addCollectionNote error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<{ note: { id: string; note: string; created_at: string } }>;
  },

  async getCollectionNotes(receivable_id: string): Promise<EdgeFunctionResponse<{
    notes: Array<{ id: string; note: string; created_at: string; created_by: string | null }>;
  }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "get_collection_notes", receivable_id },
    });
    if (error) {
      console.error("[GoFitPayService] getCollectionNotes error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<{ notes: Array<{ id: string; note: string; created_at: string; created_by: string | null }> }>;
  },

  /**
   * FASE 13 — Relatórios e conciliação.
   * Retorna summary, agrupamento por forma de pagamento, tabela de cobranças e divergências.
   * contractor_id resolvido server-side via JWT.
   */
  async getReports(opts?: ReportFilters): Promise<EdgeFunctionResponse<{
    summary:        ReportSummary;
    by_billing_type: BillingTypeStat[];
    charges:        ReportCharge[];
    discrepancies:  ReportDiscrepancy[];
    meta:           { date_from: string|null; date_to: string|null; total_charges_in_period: number; returned: number; filtered_total: number; offset: number };
  }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: {
        action:              "get_reports",
        date_from:           opts?.date_from           ?? null,
        date_to:             opts?.date_to             ?? null,
        billing_type:        opts?.billing_type        ?? null,
        status_financeiro:   opts?.status_financeiro   ?? null,
        status_gateway:      opts?.status_gateway      ?? null,
        student_name:        opts?.student_name        ?? null,
        tipo_baixa:          opts?.tipo_baixa          ?? null,
        limit:               opts?.limit               ?? 100,
        offset:              opts?.offset              ?? 0,
      },
    });
    if (error) {
      console.error("[GoFitPayService] getReports error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<{
      summary:        ReportSummary;
      by_billing_type: BillingTypeStat[];
      charges:        ReportCharge[];
      discrepancies:  ReportDiscrepancy[];
      meta:           { date_from: string|null; date_to: string|null; total_charges_in_period: number; returned: number; filtered_total: number; offset: number };
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

  /**
   * FASE 14 — Retorna status do ambiente (sandbox/produção) para a empresa.
   * Não expõe valores de secrets — apenas flags booleanas de presença.
   */
  async getEnvironmentStatus(): Promise<EdgeFunctionResponse<EnvironmentStatus>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "get_environment_status" },
    });
    if (error) {
      console.error("[GoFitPayService] getEnvironmentStatus error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<EnvironmentStatus>;
  },

  /**
   * FASE 14 — Valida pré-requisitos para ativar produção controlada.
   * Retorna checklist completo; não revela valores de API keys.
   */
  async validateProductionReadiness(): Promise<EdgeFunctionResponse<ProductionReadiness>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "validate_production_readiness" },
    });
    if (error) {
      console.error("[GoFitPayService] validateProductionReadiness error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<ProductionReadiness>;
  },

  /**
   * FASE 15 — Habilita o piloto de produção para esta empresa.
   * Requer ASAAS_ENV=production nos Supabase Secrets.
   */
  async enableProductionPilot(notes?: string): Promise<EdgeFunctionResponse<PilotResult>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "enable_production_pilot", notes: notes ?? "" },
    });
    if (error) {
      console.error("[GoFitPayService] enableProductionPilot error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<PilotResult>;
  },

  /**
   * FASE 15 — Executa rollback do piloto: bloqueia novas cobranças reais.
   * Histórico preservado. Sandbox continua funcionando.
   */
  async disableProductionPilot(reason: string): Promise<EdgeFunctionResponse<RollbackResult>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "disable_production_pilot", reason },
    });
    if (error) {
      console.error("[GoFitPayService] disableProductionPilot error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<RollbackResult>;
  },

  async linkProductionAccount(params: {
    provider_account_id: string;
    api_key: string;
    provider_wallet_id?: string;
  }): Promise<EdgeFunctionResponse<LinkProductionAccountResult>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "link_production_account", ...params },
    });
    if (error) {
      console.error("[GoFitPayService] linkProductionAccount error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<LinkProductionAccountResult>;
  },

  /* ─── Fase 15.2: Carteira de cartões / tokenização ─────────────────
   * SEGURANÇA: número do cartão e CVV passam direto para a Edge Function
   * dentro do body da invocação — nunca são logados, persistidos ou
   * mantidos em estado global. As responses contêm apenas dados mascarados.
   */

  async listStudentCards(studentId: string): Promise<EdgeFunctionResponse<{ cards: StudentCardMasked[] }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "list_student_cards", student_id: studentId },
    });
    if (error) {
      console.error("[GoFitPayService] listStudentCards error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<{ cards: StudentCardMasked[] }>;
  },

  async tokenizeStudentCard(params: TokenizeCardInput & { student_id: string }): Promise<EdgeFunctionResponse<StudentCardMasked>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "tokenize_student_card", ...params },
    });
    if (error) {
      console.error("[GoFitPayService] tokenizeStudentCard error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<StudentCardMasked>;
  },

  async setDefaultStudentCard(cardId: string): Promise<EdgeFunctionResponse<{ card_id: string; is_default: boolean }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "set_default_student_card", card_id: cardId },
    });
    if (error) {
      console.error("[GoFitPayService] setDefaultStudentCard error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<{ card_id: string; is_default: boolean }>;
  },

  async deactivateStudentCard(cardId: string): Promise<EdgeFunctionResponse<{ card_id: string; status: string }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "deactivate_student_card", card_id: cardId },
    });
    if (error) {
      console.error("[GoFitPayService] deactivateStudentCard error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<{ card_id: string; status: string }>;
  },

  async createCardRegistrationLink(studentId: string, expiresInHours?: number): Promise<EdgeFunctionResponse<{ registration_url: string; expires_at: string }>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "create_card_registration_link", student_id: studentId, expires_in_hours: expiresInHours },
    });
    if (error) {
      console.error("[GoFitPayService] createCardRegistrationLink error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<{ registration_url: string; expires_at: string }>;
  },

  /* Ações PÚBLICAS — usadas pela página /aluno/cartao/:token (sem login) */

  async validateCardRegistrationLink(token: string): Promise<EdgeFunctionResponse<CardLinkValidation>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "validate_card_registration_link", token },
    });
    if (error) {
      console.error("[GoFitPayService] validateCardRegistrationLink error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<CardLinkValidation>;
  },

  async tokenizeCardFromLink(params: TokenizeCardInput & { token: string }): Promise<EdgeFunctionResponse<StudentCardMasked>> {
    const { data, error } = await supabase.functions.invoke("gofit-pay-base", {
      body: { action: "tokenize_card_from_link", ...params },
    });
    if (error) {
      console.error("[GoFitPayService] tokenizeCardFromLink error:", error.message);
      return { success: false, error: error.message };
    }
    return data as EdgeFunctionResponse<StudentCardMasked>;
  },

} as const;

/* ─── Tipos Fase 15.2 ───────────────────────────────────────────── */
export interface StudentCardMasked {
  card_id:              string;
  card_brand:           string | null;
  card_last4:           string | null;
  card_alias:           string | null;
  card_holder_name:     string | null;
  expiry_month:         string | null;
  expiry_year:          string | null;
  is_default:           boolean;
  status:               string;
  provider_environment: string;
  created_at:           string;
}

export interface TokenizeCardInput {
  card_number:  string;  // SENSÍVEL — só no body da invocação
  holder_name:  string;
  expiry_month: string;
  expiry_year:  string;
  ccv:          string;  // SENSÍVEL — só no body da invocação
  card_alias?:  string;
  is_default?:  boolean;
}

export interface CardLinkValidation {
  valid:         boolean;
  reason?:       string;
  student_name?: string;
  company_name?: string;
  expires_at?:   string;
}

/* ─── Tipos Fase 12 ─────────────────────────────────────────────── */
export interface OverdueItem {
  receivable_id:       string;
  student_id:          string | null;
  student_nome:        string | null;
  student_email:       string | null;
  student_contract_id: string | null;
  descricao:           string | null;
  valor:               number;
  vencimento:          string;
  dias_em_atraso:      number;
  rcv_status:          string;
  charge_id:           string | null;
  provider_charge_id:  string | null;
  charge_status:       string | null;
  billing_type:        string | null;
  invoice_url:         string | null;
  bank_slip_url:       string | null;
  pix_copy_paste:      string | null;
  pix_qr_code:         string | null;
}

export interface CollectionSummary {
  total_amount_open:  number;
  students_count:     number;
  overdue_count:      number;
  overdue_30_plus:    number;
  without_charge:     number;
  with_active_charge: number;
}

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

/* ─── Tipos Fase 13 ─────────────────────────────────────────────── */
export interface ReportFilters {
  date_from?:         string;
  date_to?:           string;
  billing_type?:      string;
  status_financeiro?: string;
  status_gateway?:    string;
  student_name?:      string;
  tipo_baixa?:        string[];
  limit?:             number;
  offset?:            number;
}

export interface ReportSummary {
  total_cobrado:      number;
  total_pago:         number;
  total_pendente:     number;
  total_vencido:      number;
  total_cancelado:    number;
  qtd_cobranças:      number;
  qtd_alunos:         number;
  baixas_automaticas: number;
  baixas_manuais:     number;
  divergencias:       number;
}

export interface BillingTypeStat {
  billing_type:   string;
  qtd:            number;
  total_emitido:  number;
  total_pago:     number;
  pendente:       number;
  vencido:        number;
  cancelado:      number;
}

export interface ReportCharge {
  charge_id:          string;
  provider_charge_id: string | null;
  billing_type:       string | null;
  amount:             number;
  due_date:           string | null;
  status_gateway:     string | null;
  invoice_url:        string | null;
  bank_slip_url:      string | null;
  pix_copy_paste:     string | null;
  paid_at:            string | null;
  cancelled_at:       string | null;
  created_at:         string | null;
  student_nome:       string | null;
  student_email:      string | null;
  receivable_id:      string | null;
  descricao:          string | null;
  vencimento:         string | null;
  valor_rcv:          number | null;
  valor_pago_rcv:     number | null;
  status_financeiro:  string | null;
  pago_em:            string | null;
  tipo_baixa:         "automatica" | "manual" | "nao_pago" | "nao_identificado";
}

export interface ReportDiscrepancy {
  tipo:               string;
  severidade:         "Alta" | "Média" | "Baixa";
  student_nome:       string | null;
  receivable_id:      string | null;
  provider_charge_id: string | null;
  descricao:          string;
  acao_sugerida:      string;
}

/* ─── Tipos Fase 14 ─────────────────────────────────────────────── */
export interface EnvironmentStatus {
  current_environment:   "sandbox" | "production";
  global_env_secret:     string;
  sandbox_active:        boolean;
  is_sandbox:            boolean;
  is_production:         boolean;
  production_enabled:    boolean;
  allowed_for_real_charges: boolean;
  production_approved_at: string | null;
  production_notes:      string | null;
  module_active:         boolean;
  account_status:        string | null;
  account_environment:   string;
  webhook_configured:    boolean;
  base_url_matches_env:  boolean;
  secrets_present: {
    api_key:        boolean;
    webhook_token:  boolean;
    encryption_key: boolean;
  };
}

export interface ProductionReadinessCheck {
  item:    string;
  status:  "ok" | "warn" | "fail" | "pending";
  detail:  string;
}

export interface ProductionReadiness {
  ready_for_production: boolean;
  critical_failures:    number;
  warnings:             number;
  passed:               number;
  current_environment:  string;
  summary:              string;
  checks:               ProductionReadinessCheck[];
}

/* ─── Tipos Fase 15 / 15.1 ──────────────────────────────────────── */
export interface PilotResult {
  production_enabled:       boolean;
  allowed_for_real_charges: boolean;
  pilot_enabled_at:         string;
  notes:                    string;
  message:                  string;
}

export interface RollbackResult {
  allowed_for_real_charges: boolean;
  rolled_back_at:           string;
  reason:                   string;
  message:                  string;
}

export interface LinkProductionAccountResult {
  provider_environment: string;
  provider_account_id:  string;
  status:               string;
  linked_at:            string;
  verified:             boolean;
  message:              string;
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
