/**
 * _webhook.ts — Processamento de eventos Asaas (Fase 7)
 * Lógica de resolução de cobrança, baixa automática e idempotência.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WebhookEventRow {
  id: string;
  event_type: string;
  provider_payment_id: string | null;
  payload_json: Record<string, unknown>;
  contractor_id: string | null;
  receivable_id: string | null;
  processing_attempts: number;
  processed: boolean;
}

export interface ProcessResult {
  processed: boolean;
  message: string;
  receivableUpdated: boolean;
  chargeId: string | null;
  receivableId: string | null;
}

// ─── Mappings ─────────────────────────────────────────────────────────────────

export function mapEventToChargeStatus(eventType: string): string {
  const map: Record<string, string> = {
    PAYMENT_CREATED:              "PENDING",
    PAYMENT_CONFIRMED:            "CONFIRMED",
    PAYMENT_RECEIVED:             "RECEIVED",
    PAYMENT_OVERDUE:              "OVERDUE",
    PAYMENT_DELETED:              "CANCELLED",
    PAYMENT_REFUNDED:             "REFUNDED",
    PAYMENT_CHARGEBACK_REQUESTED: "CHARGEBACK_REQUESTED",
    PAYMENT_CHARGEBACK_DISPUTE:   "CHARGEBACK_DISPUTE",
  };
  return map[eventType] ?? eventType;
}

export function mapBillingTypeToFormaPagamento(billingType: string): string {
  const map: Record<string, string> = {
    PIX:         "pix",
    BOLETO:      "boleto",
    CREDIT_CARD: "cartao_credito",
    DEBIT_CARD:  "cartao_debito",
    UNDEFINED:   "indefinido",
  };
  return map[(billingType ?? "").toUpperCase()] ?? "indefinido";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function extractPaymentDate(paymentObj: Record<string, unknown> | null): string | null {
  if (!paymentObj) return null;
  const candidates = [
    paymentObj.clientPaymentDate,
    paymentObj.paymentDate,
    paymentObj.confirmedDate,
    paymentObj.dueDate,
  ];
  for (const d of candidates) {
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.substring(0, 10);
  }
  return null;
}

export function sanitizeWebhookPayload(payload: Record<string, unknown>): Record<string, unknown> {
  try {
    const sanitized = { ...payload };
    const BLOCKED = ["apiKey", "access_token", "accessToken", "api_key"];
    if (sanitized.payment && typeof sanitized.payment === "object") {
      const p = { ...(sanitized.payment as Record<string, unknown>) };
      for (const k of BLOCKED) delete p[k];
      sanitized.payment = p;
    }
    for (const k of BLOCKED) delete sanitized[k];
    return sanitized;
  } catch {
    return {};
  }
}

// ─── Core processor ───────────────────────────────────────────────────────────

export async function processWebhookEvent(
  db: ReturnType<typeof createClient>,
  event: WebhookEventRow,
  now: string
): Promise<ProcessResult> {
  const {
    id: eventId,
    event_type: eventType,
    provider_payment_id: providerPayId,
    payload_json,
    processing_attempts,
  } = event;

  // Increment attempts before processing so a crash is visible
  await db
    .from("gofit_pay_webhook_events")
    .update({ processing_attempts: (processing_attempts ?? 0) + 1 })
    .eq("id", eventId);

  const paymentObj =
    payload_json?.payment && typeof payload_json.payment === "object"
      ? (payload_json.payment as Record<string, unknown>)
      : null;

  // ── Step 1: Resolve charge ─────────────────────────────────────────────────
  let charge: {
    id: string;
    contractor_id: string;
    receivable_id: string | null;
    billing_type: string;
    amount: number;
  } | null = null;

  if (providerPayId) {
    const { data } = await db
      .from("payment_charges")
      .select("id, contractor_id, receivable_id, billing_type, amount")
      .eq("provider_charge_id", providerPayId)
      .eq("provider", "asaas")
      .maybeSingle();
    charge = data ?? null;
  }

  // Fallback: busca por receivables.asaas_payment_id → payment_charges
  if (!charge && providerPayId) {
    const { data: rcv } = await db
      .from("receivables")
      .select("id, contractor_id")
      .eq("asaas_payment_id", providerPayId)
      .maybeSingle();
    if (rcv) {
      const { data: chg } = await db
        .from("payment_charges")
        .select("id, contractor_id, receivable_id, billing_type, amount")
        .eq("receivable_id", rcv.id)
        .eq("provider", "asaas")
        .maybeSingle();
      charge = chg ?? null;
    }
  }

  if (!charge) {
    const msg = `RESOLUTION_PENDING: no payment_charge for provider_payment_id=${providerPayId ?? "null"}`;
    await db
      .from("gofit_pay_webhook_events")
      .update({ error_message: msg, processed: false })
      .eq("id", eventId);
    console.log(`[gofit-pay-webhook] ${msg} event=${eventId} type=${eventType}`);
    return { processed: false, message: "RESOLUTION_PENDING", receivableUpdated: false, chargeId: null, receivableId: null };
  }

  // ── Step 2: Update payment_charges ────────────────────────────────────────
  const newChargeStatus = mapEventToChargeStatus(eventType);
  const chargeUpdate: Record<string, unknown> = {
    status:            newChargeStatus,
    updated_at:        now,
    raw_response_json: sanitizeWebhookPayload(payload_json),
  };

  if (eventType === "PAYMENT_CONFIRMED")            chargeUpdate.confirmed_at = now;
  if (eventType === "PAYMENT_RECEIVED")             chargeUpdate.paid_at      = now;
  if (eventType === "PAYMENT_DELETED")              chargeUpdate.cancelled_at = now;
  if (eventType === "PAYMENT_REFUNDED") {
    chargeUpdate.refunded_at  = now;
    chargeUpdate.cancelled_at = now;
  }

  await db.from("payment_charges").update(chargeUpdate).eq("id", charge.id);

  // ── Step 3: Update receivable ──────────────────────────────────────────────
  let receivableUpdated = false;
  const receivableId = charge.receivable_id;

  if (receivableId) {
    // Persist resolved IDs to the event row
    await db
      .from("gofit_pay_webhook_events")
      .update({ receivable_id: receivableId, contractor_id: charge.contractor_id })
      .eq("id", eventId);

    const { data: receivable } = await db
      .from("receivables")
      .select("id, status, pago_em, valor_pago")
      .eq("id", receivableId)
      .maybeSingle();

    if (receivable) {
      const baseUpdate: Record<string, unknown> = {
        gateway_status:   newChargeStatus,
        gateway_provider: "asaas",
        updated_at:       now,
      };

      if (eventType === "PAYMENT_RECEIVED") {
        if (receivable.status === "pago") {
          // Idempotência: já baixada — só atualiza gateway_status
          await db.from("receivables").update(baseUpdate).eq("id", receivableId);
          console.log(`[gofit-pay-webhook] Receivable ${receivableId} já pago — baixa ignorada (idempotência).`);
        } else {
          const payDate     = extractPaymentDate(paymentObj);
          const pagoEmTs    = payDate ? `${payDate}T12:00:00Z` : now;
          const horaPart    = now.substring(11, 19);
          const billingType = typeof paymentObj?.billingType === "string"
            ? paymentObj.billingType
            : charge.billing_type;
          const formaPgto   = mapBillingTypeToFormaPagamento(billingType);
          const valorPago   = typeof paymentObj?.value === "number"
            ? paymentObj.value
            : Number(charge.amount ?? 0);

          await db.from("receivables").update({
            ...baseUpdate,
            status:           "pago",
            pago_em:          pagoEmTs,
            hora_recebimento: horaPart,
            forma_pagamento:  formaPgto,
            valor_pago:       valorPago,
          }).eq("id", receivableId);

          receivableUpdated = true;
          console.log(
            `[gofit-pay-webhook] Baixa automática: rcv=${receivableId} valor=${valorPago} forma=${formaPgto}`,
          );
        }
      } else if (eventType === "PAYMENT_OVERDUE") {
        const statusUpdate: Record<string, unknown> = { ...baseUpdate };
        if (receivable.status === "pendente" || receivable.status === "aguardando") {
          statusUpdate.status = "atrasado";
        }
        await db.from("receivables").update(statusUpdate).eq("id", receivableId);
      } else if (eventType === "PAYMENT_DELETED") {
        // Mantém o status financeiro inalterado (pendente/atrasado/aguardando).
        // Limpa os campos do gateway para permitir nova cobrança futura.
        const statusUpdate: Record<string, unknown> = { ...baseUpdate };
        if (receivable.status !== "pago") {
          statusUpdate.asaas_payment_id  = null;
          statusUpdate.asaas_payment_url = null;
        }
        await db.from("receivables").update(statusUpdate).eq("id", receivableId);
      } else if (eventType === "PAYMENT_REFUNDED") {
        // Não desfaz baixa — apenas sinaliza no log para revisão financeira
        await db.from("receivables").update(baseUpdate).eq("id", receivableId);
        console.warn(
          `[gofit-pay-webhook] REFUND ALERT: rcv=${receivableId} status=${receivable.status} — revisão financeira necessária.`,
        );
      } else if (
        eventType === "PAYMENT_CHARGEBACK_REQUESTED" ||
        eventType === "PAYMENT_CHARGEBACK_DISPUTE"
      ) {
        await db.from("receivables").update(baseUpdate).eq("id", receivableId);
        console.warn(
          `[gofit-pay-webhook] CHARGEBACK ALERT: rcv=${receivableId} event=${eventType} — revisão financeira necessária.`,
        );
      } else {
        // PAYMENT_CREATED, PAYMENT_CONFIRMED, e outros: só atualiza gateway_status
        await db.from("receivables").update(baseUpdate).eq("id", receivableId);
      }
    }
  }

  // ── Step 4: Mark processed ────────────────────────────────────────────────
  await db
    .from("gofit_pay_webhook_events")
    .update({ processed: true, processed_at: now, error_message: null })
    .eq("id", eventId);

  console.log(
    `[gofit-pay-webhook] OK: event=${eventId} type=${eventType} charge=${charge.id} rcv=${receivableId ?? "null"}`,
  );

  return {
    processed:        true,
    message:          `${eventType} processed`,
    receivableUpdated,
    chargeId:         charge.id,
    receivableId:     receivableId ?? null,
  };
}
