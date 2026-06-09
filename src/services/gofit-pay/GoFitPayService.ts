/**
 * Fase 4 — GoFit Pay: Serviço frontend
 *
 * ARQUITETURA OBRIGATÓRIA:
 *   Componente → GoFitPayService → Supabase Edge Function → AsaasService → API Asaas
 *
 * REGRAS DE SEGURANÇA:
 *   ✗ NUNCA chama a API Asaas diretamente
 *   ✗ NUNCA expõe ASAAS_API_KEY no frontend
 *   ✗ NUNCA usa VITE_SUPABASE_SERVICE_ROLE_KEY no frontend
 *   ✓ Toda operação sensível → Edge Function via supabase.functions.invoke()
 *   ✓ Leituras de display → queries diretas ao Supabase (tabelas públicas RLS)
 *
 * FASE ATUAL: 4 (estrutura isolada)
 *   - Métodos de leitura: operacionais (leem do banco)
 *   - Métodos de escrita: stubs que retornam erro explicativo
 *     (serão implementados na Fase 5 com as Edge Functions)
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  GoFitPayAccount,
  GoFitPaySettings,
  PaymentCharge,
  PaymentCustomer,
  CreateChargePayload,
  EdgeFunctionResponse,
} from "./types";

/* ══════════════════════════════════════════════════════════════════ */

export const GoFitPayService = {

  /* ─── LEITURA — Conta GoFit Pay ─────────────────────────────────── */

  /**
   * Busca a conta Asaas da empresa.
   * Retorna null se ainda não foi criada (pré-Fase 5).
   */
  async getAccount(contractorId: string): Promise<GoFitPayAccount | null> {
    const { data, error } = await supabase
      .from("gofit_pay_accounts")
      .select("*")
      .eq("contractor_id", contractorId)
      .maybeSingle();

    if (error) {
      console.error("[GoFitPayService] getAccount error:", error.message);
      return null;
    }
    return data;
  },

  /* ─── LEITURA — Configurações operacionais ───────────────────────── */

  /**
   * Busca as configurações de runtime da empresa.
   * Retorna null se ainda não configuradas.
   */
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
    return data;
  },

  /**
   * Salva/atualiza configurações operacionais.
   * Estas são editadas pelo usuário diretamente (sem Edge Function).
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

  /* ─── LEITURA — Cobranças ────────────────────────────────────────── */

  /**
   * Lista cobranças da empresa com filtros opcionais.
   */
  async listCharges(
    contractorId: string,
    opts?: { status?: string; limit?: number; offset?: number }
  ): Promise<PaymentCharge[]> {
    let query = supabase
      .from("payment_charges")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("created_at", { ascending: false });

    if (opts?.status) query = query.eq("status", opts.status);
    if (opts?.limit)  query = query.limit(opts.limit);
    if (opts?.offset) query = query.range(opts.offset, (opts.offset + (opts.limit ?? 50)) - 1);

    const { data, error } = await query;
    if (error) {
      console.error("[GoFitPayService] listCharges error:", error.message);
      return [];
    }
    return (data ?? []) as PaymentCharge[];
  },

  /**
   * Busca uma cobrança por ID de pagamento Asaas.
   */
  async getChargeByAsaasId(asaasPaymentId: string): Promise<PaymentCharge | null> {
    const { data, error } = await supabase
      .from("payment_charges")
      .select("*")
      .eq("asaas_payment_id", asaasPaymentId)
      .maybeSingle();

    if (error) {
      console.error("[GoFitPayService] getChargeByAsaasId error:", error.message);
      return null;
    }
    return data;
  },

  /* ─── LEITURA — Customers ────────────────────────────────────────── */

  /**
   * Busca o customer Asaas de um aluno específico.
   */
  async getCustomerByClientId(
    contractorId: string,
    clientId: string
  ): Promise<PaymentCustomer | null> {
    const { data, error } = await supabase
      .from("payment_customers")
      .select("*")
      .eq("contractor_id", contractorId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) {
      console.error("[GoFitPayService] getCustomerByClientId error:", error.message);
      return null;
    }
    return data;
  },

  /* ─── ESCRITA — Edge Functions (Fase 5+) ─────────────────────────── */

  /**
   * FASE 5 — Cria subconta Asaas para a empresa.
   *
   * Chamar apenas após wizard completo (onboarding_status = 'enviado').
   * A Edge Function:
   *   1. Lê gofit_pay_config para obter os dados do onboarding
   *   2. Chama POST /v3/accounts no Asaas
   *   3. Salva o retorno em gofit_pay_accounts
   *   4. Atualiza company_modules.status = 'in_review'
   *
   * @throws Error com mensagem amigável se a Fase 5 ainda não estiver disponível
   */
  async createAccount(
    contractorId: string,
    environment: "sandbox" | "production" = "sandbox"
  ): Promise<EdgeFunctionResponse<{ account_id: string }>> {
    // ── Fase 4: Edge Function ainda não existe ──
    // Remover este bloco e implementar na Fase 5
    throw new GoFitPayNotImplementedError(
      "createAccount",
      5,
      "A criação de subconta Asaas será implementada na Fase 5."
    );

    /* FASE 5 — descomentar e implementar:
    const { data, error } = await supabase.functions.invoke("gofit-pay-create-account", {
      body: { contractor_id: contractorId, environment },
    });
    if (error) return { success: false, error: error.message };
    return data as EdgeFunctionResponse<{ account_id: string }>;
    */
  },

  /**
   * FASE 5 — Cria uma cobrança via Asaas.
   *
   * A Edge Function:
   *   1. Cria/verifica o customer Asaas do aluno
   *   2. Chama POST /v3/payments no Asaas
   *   3. Salva em payment_charges
   *   4. Atualiza receivables com os campos gateway se receivable_id fornecido
   *
   * @throws GoFitPayNotImplementedError se Fase 5 ainda não disponível
   */
  async createCharge(
    _payload: CreateChargePayload
  ): Promise<EdgeFunctionResponse<{ charge_id: string; payment_url: string }>> {
    // ── Fase 4: Edge Function ainda não existe ──
    throw new GoFitPayNotImplementedError(
      "createCharge",
      5,
      "A emissão de cobranças será implementada na Fase 5."
    );

    /* FASE 5 — descomentar e implementar:
    const { data, error } = await supabase.functions.invoke("gofit-pay-create-charge", {
      body: _payload,
    });
    if (error) return { success: false, error: error.message };
    return data as EdgeFunctionResponse<{ charge_id: string; payment_url: string }>;
    */
  },

  /**
   * FASE 6 — Cancela uma cobrança via Asaas.
   *
   * @throws GoFitPayNotImplementedError se Fase 6 ainda não disponível
   */
  async cancelCharge(
    _chargeId: string
  ): Promise<EdgeFunctionResponse> {
    throw new GoFitPayNotImplementedError(
      "cancelCharge",
      6,
      "O cancelamento de cobranças será implementado na Fase 6."
    );
  },

} as const;

/* ─── Erro de funcionalidade ainda não implementada ──────────────── */
export class GoFitPayNotImplementedError extends Error {
  constructor(
    public readonly method: string,
    public readonly availableInPhase: number,
    message: string
  ) {
    super(`[GoFitPay] ${method}: ${message} (disponível na Fase ${availableInPhase})`);
    this.name = "GoFitPayNotImplementedError";
  }
}
