/**
 * Fase 4 — GoFit Pay: PaymentWebhookService (stub de documentação)
 *
 * IMPORTANTE: Este arquivo descreve a interface do serviço de webhook,
 * mas a implementação real reside EXCLUSIVAMENTE na Edge Function
 * `gofit-pay-webhook` (Fase 6).
 *
 * O frontend NUNCA processa webhooks — ele apenas consulta os eventos
 * já processados em `gofit_pay_webhook_events` para exibir histórico.
 *
 * Fluxo real (Fase 6):
 *   Asaas → POST /functions/v1/gofit-pay-webhook
 *         → valida HMAC-SHA256 com webhook_token
 *         → salva raw em gofit_pay_webhook_events
 *         → processa evento (atualiza payment_charges, receivables)
 *         → confirma com HTTP 200
 */

import { supabase } from "@/integrations/supabase/client";
import type { WebhookEvent } from "./types";

export const PaymentWebhookService = {

  /**
   * Lista eventos de webhook (auditoria/histórico para o frontend).
   * Apenas leitura — o processamento é feito server-side.
   */
  async listEvents(
    contractorId: string,
    opts?: { processed?: boolean; limit?: number }
  ): Promise<WebhookEvent[]> {
    let query = supabase
      .from("gofit_pay_webhook_events")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("received_at", { ascending: false });

    if (opts?.processed !== undefined) query = query.eq("processed", opts.processed);
    if (opts?.limit) query = query.limit(opts.limit);

    const { data, error } = await query;
    if (error) {
      console.error("[PaymentWebhookService] listEvents error:", error.message);
      return [];
    }
    return (data ?? []) as WebhookEvent[];
  },

  /**
   * Conta eventos não processados (indicador de saúde do webhook).
   */
  async countPendingEvents(contractorId: string): Promise<number> {
    const { count, error } = await supabase
      .from("gofit_pay_webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("contractor_id", contractorId)
      .eq("processed", false);

    if (error) return 0;
    return count ?? 0;
  },

} as const;

/*
 * ─── Referência: tipos de eventos Asaas (Fase 6) ──────────────────
 *
 * PAYMENT_CREATED          → Cobrança criada
 * PAYMENT_UPDATED          → Cobrança atualizada
 * PAYMENT_CONFIRMED        → Pagamento confirmado (Pix/cartão)
 * PAYMENT_RECEIVED         → Cobrança recebida em conta
 * PAYMENT_OVERDUE          → Cobrança vencida
 * PAYMENT_DELETED          → Cobrança removida
 * PAYMENT_RESTORED         → Cobrança restaurada
 * PAYMENT_REFUNDED         → Estorno realizado
 * PAYMENT_REFUND_REVERSED  → Estorno revertido
 * PAYMENT_CHARGEBACK_REQUESTED → Chargeback solicitado
 * PAYMENT_DUNNING_RECEIVED → Negativado confirmado
 *
 * Fonte: https://docs.asaas.com/reference/webhook
 */
