/**
 * Edge Function: asaas-saas-webhook
 * Fase 5 — Financeiro SaaS da GoFit
 *
 * Recebe eventos Asaas relativos às cobranças de assinaturas SaaS
 * (GoFit cobrando academias). Completamente separado do webhook
 * gofit-pay-base (que processa academias cobrando alunos).
 *
 * SEGURANÇA:
 *   - Valida token Asaas em constant-time (evita timing attacks)
 *   - Idempotente: verifica se evento já foi processado
 *   - Nunca expõe dados do Asaas no log
 *   - Usa service role apenas para operações de banco
 *
 * EVENTOS TRATADOS:
 *   PAYMENT_RECEIVED / PAYMENT_CONFIRMED → invoice paid, subscription active
 *   PAYMENT_OVERDUE                      → invoice overdue, subscription past_due
 *   PAYMENT_DELETED / PAYMENT_REFUNDED   → invoice cancelled/refunded
 *
 * CONFIGURAÇÃO NECESSÁRIA (Supabase Secrets):
 *   ASAAS_WEBHOOK_TOKEN → token configurado no painel Asaas para ESTE endpoint
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")              ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

// Comparação constant-time para evitar timing attacks
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function validateWebhookToken(req: Request): boolean {
  const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";
  if (!expected) return false;
  const received = req.headers.get("asaas-access-token") ?? "";
  if (!received)  return false;
  return constantTimeEqual(received, expected);
}

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const BLOCKED = ["apiKey", "access_token", "accessToken", "api_key"];
  const sanitized = { ...payload };
  if (sanitized.payment && typeof sanitized.payment === "object") {
    const p = { ...(sanitized.payment as Record<string, unknown>) };
    for (const k of BLOCKED) delete p[k];
    sanitized.payment = p;
  }
  for (const k of BLOCKED) delete sanitized[k];
  return sanitized;
}

function mapEventToInvoiceStatus(eventType: string): string | null {
  const map: Record<string, string> = {
    PAYMENT_RECEIVED:  "paid",
    PAYMENT_CONFIRMED: "paid",
    PAYMENT_OVERDUE:   "overdue",
    PAYMENT_DELETED:   "cancelled",
    PAYMENT_REFUNDED:  "refunded",
  };
  return map[eventType] ?? null;
}

serve(async (req) => {
  const now = new Date().toISOString();

  // Aceitar apenas POST do Asaas
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  // Validar token Asaas
  if (!validateWebhookToken(req)) {
    console.warn("[asaas-saas-webhook] Token inválido ou ausente");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const eventType      = typeof payload.event   === "string" ? payload.event   : null;
  const paymentObj     = payload.payment && typeof payload.payment === "object"
    ? (payload.payment as Record<string, unknown>)
    : null;
  const asaasPaymentId = typeof paymentObj?.id  === "string" ? paymentObj.id   : null;
  const externalRef    = typeof paymentObj?.externalReference === "string"
    ? paymentObj.externalReference
    : null;

  if (!eventType) {
    console.warn("[asaas-saas-webhook] Evento sem 'event' field");
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_event" }), { status: 200 });
  }

  // Só processar eventos de pagamento SaaS (externalReference começa com "gofit:saas-invoice:")
  const isSaasInvoice = externalRef?.startsWith("gofit:saas-invoice:");
  if (!isSaasInvoice) {
    // Pode ser evento de GoFit Pay (academias/alunos) — ignorar silenciosamente
    console.log(`[asaas-saas-webhook] Evento ignorado (não é SaaS invoice): ref=${externalRef ?? "null"} event=${eventType}`);
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "not_saas_invoice" }), { status: 200 });
  }

  const invoiceId = externalRef!.replace("gofit:saas-invoice:", "");

  const db = serviceClient();

  // Idempotência: verifica se evento já foi processado
  const { data: existingEvent } = await db
    .from("saas_billing_events")
    .select("id")
    .eq("event_type", `ASAAS_WEBHOOK_${eventType}`)
    .contains("metadata", { asaas_payment_id: asaasPaymentId ?? "" })
    .maybeSingle();

  if (existingEvent) {
    console.log(`[asaas-saas-webhook] Evento já processado: ${eventType} payment=${asaasPaymentId}`);
    return new Response(JSON.stringify({ ok: true, idempotent: true }), { status: 200 });
  }

  // Carregar fatura
  const { data: invoice, error: invErr } = await db
    .from("saas_invoices")
    .select("id, contractor_id, subscription_id, status, amount")
    .eq("id", invoiceId)
    .maybeSingle();

  // Registrar evento bruto independente de encontrar a fatura
  await db.from("saas_billing_events").insert({
    invoice_id:      invoice?.id      ?? null,
    subscription_id: invoice?.subscription_id ?? null,
    contractor_id:   invoice?.contractor_id ?? "00000000-0000-0000-0000-000000000000",
    event_type:      `ASAAS_WEBHOOK_${eventType}`,
    metadata:        {
      asaas_payment_id: asaasPaymentId,
      external_ref:     externalRef,
      payload_sanitized: sanitizePayload(payload),
    },
    created_at: now,
  });

  if (invErr || !invoice) {
    console.warn(`[asaas-saas-webhook] Fatura não encontrada: invoice_id=${invoiceId}`);
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "invoice_not_found" }), { status: 200 });
  }

  const newInvoiceStatus = mapEventToInvoiceStatus(eventType);

  if (!newInvoiceStatus) {
    console.log(`[asaas-saas-webhook] Evento sem mapeamento de status: ${eventType}`);
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_status_mapping" }), { status: 200 });
  }

  // Idempotência de status: não regredir status
  const STATUS_ORDER = ["draft", "pending", "overdue", "paid", "cancelled", "refunded", "failed"];
  const currentIdx = STATUS_ORDER.indexOf(invoice.status);
  const newIdx     = STATUS_ORDER.indexOf(newInvoiceStatus);
  if (newIdx <= currentIdx && invoice.status === newInvoiceStatus) {
    console.log(`[asaas-saas-webhook] Status já é '${newInvoiceStatus}' — skipping`);
    return new Response(JSON.stringify({ ok: true, idempotent: true }), { status: 200 });
  }

  // Atualizar fatura
  const invoiceUpdate: Record<string, unknown> = { status: newInvoiceStatus, updated_at: now };
  if (newInvoiceStatus === "paid")       invoiceUpdate.paid_at      = now;
  if (newInvoiceStatus === "cancelled")  invoiceUpdate.cancelled_at = now;

  await db.from("saas_invoices").update(invoiceUpdate).eq("id", invoice.id);

  // Atualizar assinatura se necessário
  let subscriptionUpdated = false;
  if (invoice.subscription_id) {
    const subUpdate: Record<string, unknown> = { updated_at: now };
    let subEventType: string | null = null;

    if (newInvoiceStatus === "paid") {
      subUpdate.status = "active";
      subEventType     = "SUBSCRIPTION_REACTIVATED_AFTER_PAYMENT";
    } else if (newInvoiceStatus === "overdue") {
      subUpdate.status = "past_due";
      subEventType     = "SUBSCRIPTION_MARKED_PAST_DUE";
    }

    if (subUpdate.status) {
      await db.from("saas_subscriptions").update(subUpdate).eq("id", invoice.subscription_id);
      subscriptionUpdated = true;

      if (subEventType) {
        await db.from("saas_subscription_events").insert({
          subscription_id: invoice.subscription_id,
          contractor_id:   invoice.contractor_id,
          event_type:      subEventType,
          old_value:       { status: invoice.status },
          new_value:       { status: subUpdate.status },
          metadata:        { source: "asaas_webhook", asaas_payment_id: asaasPaymentId, invoice_id: invoice.id },
          created_at:      now,
        });
      }
    }
  }

  // Registrar pagamento se confirmado
  if (newInvoiceStatus === "paid") {
    const billingTypeRaw = typeof paymentObj?.billingType === "string" ? paymentObj.billingType : null;
    await db.from("saas_payments").insert({
      invoice_id:      invoice.id,
      contractor_id:   invoice.contractor_id,
      subscription_id: invoice.subscription_id ?? null,
      amount:          Number(paymentObj?.value ?? invoice.amount),
      payment_method:  billingTypeRaw,
      status:          "confirmed",
      asaas_payment_id: asaasPaymentId,
      paid_at:          now,
      metadata:         { event_type: eventType },
      created_at:       now,
    });
  }

  // Registrar evento de billing processado
  await db.from("saas_billing_events").insert({
    invoice_id:      invoice.id,
    subscription_id: invoice.subscription_id ?? null,
    contractor_id:   invoice.contractor_id,
    event_type:      `ASAAS_WEBHOOK_PROCESSED`,
    old_value:       { invoice_status: invoice.status },
    new_value:       { invoice_status: newInvoiceStatus, subscription_updated: subscriptionUpdated },
    metadata:        { asaas_payment_id: asaasPaymentId, event_type: eventType },
    created_at:      now,
  });

  console.log(
    `[asaas-saas-webhook] OK: event=${eventType} invoice=${invoice.id} ` +
    `new_status=${newInvoiceStatus} sub_updated=${subscriptionUpdated}`
  );

  return new Response(JSON.stringify({ ok: true, invoice_id: invoice.id, new_status: newInvoiceStatus }), { status: 200 });
});
