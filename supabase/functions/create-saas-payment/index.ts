/**
 * Edge Function: create-saas-payment
 * Fase 5 — Financeiro SaaS da GoFit
 *
 * Cria ou recupera um customer Asaas para uma empresa (contractor) na conta
 * PRINCIPAL da GoFit e registra uma cobrança no Asaas para uma saas_invoice.
 *
 * SEGURANÇA:
 *   - Requer autenticação como platform_owner (validado no DB)
 *   - ASAAS_API_KEY → conta principal GoFit (nunca subconta de academia)
 *   - Chave Asaas nunca retornada ao frontend
 *   - Todos os campos Asaas são escritos APENAS aqui (service role), nunca pelo frontend
 *
 * SEPARAÇÃO DE CONTEXTOS:
 *   - payment_customers / payment_charges → academias cobrando ALUNOS (GoFit Pay)
 *   - saas_asaas_customers / saas_invoices → GoFit cobrando ACADEMIAS (SaaS Billing)
 */

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function err(message: string, code: string, status = 400) {
  return json({ success: false, error: message, code }, status);
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")              ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

function getAsaasConfig(): { baseUrl: string; apiKey: string; webhookToken: string } {
  const baseUrl      = Deno.env.get("ASAAS_BASE_URL");
  const apiKey       = Deno.env.get("ASAAS_API_KEY");
  const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";
  if (!baseUrl) throw new Error("ASAAS_BASE_URL ausente.");
  if (!apiKey)  throw new Error("ASAAS_API_KEY ausente.");
  return { baseUrl, apiKey, webhookToken };
}

async function asaasPost<T>(apiKey: string, baseUrl: string, path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method:  "POST",
    headers: {
      "access_token": apiKey,
      "Content-Type": "application/json",
      "User-Agent":   "GoFit/5.0-SaaS (+https://fitcoresys.com.br)",
    },
    body: JSON.stringify(body),
  });
  let responseJson: Record<string, unknown> = {};
  try { responseJson = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    const desc = (responseJson?.errors as Array<{ description?: string }>)?.[0]?.description
      ?? String(responseJson?.message ?? "Erro na API Asaas");
    throw new Error(desc);
  }
  return responseJson as T;
}

async function asaasGet<T>(apiKey: string, baseUrl: string, path: string): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method:  "GET",
    headers: { "access_token": apiKey, "User-Agent": "GoFit/5.0-SaaS (+https://fitcoresys.com.br)" },
  });
  let responseJson: Record<string, unknown> = {};
  try { responseJson = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new Error(String(responseJson?.message ?? "Erro na API Asaas"));
  return responseJson as T;
}

async function resolvePlatformOwner(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")      ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: auth } } }
  );
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;

  const db = serviceClient();
  const { data } = await db.from("platform_owners").select("user_id").eq("user_id", user.id).maybeSingle();
  return data ? user.id : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")   return err("Método não permitido.", "METHOD_NOT_ALLOWED", 405);

  // 1. Autenticar como platform_owner
  const adminUserId = await resolvePlatformOwner(req);
  if (!adminUserId) return err("Acesso não autorizado.", "UNAUTHORIZED", 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return err("JSON inválido.", "INVALID_JSON"); }

  const invoiceId    = typeof body.invoice_id    === "string" ? body.invoice_id    : null;
  const billingType  = typeof body.billing_type  === "string" ? body.billing_type.toUpperCase() : "PIX";

  if (!invoiceId) return err("invoice_id é obrigatório.", "MISSING_INVOICE_ID");

  const ALLOWED_BILLING = ["PIX", "BOLETO", "CREDIT_CARD"];
  if (!ALLOWED_BILLING.includes(billingType)) {
    return err("billing_type inválido. Use PIX, BOLETO ou CREDIT_CARD.", "INVALID_BILLING_TYPE");
  }

  const db  = serviceClient();
  const now = new Date().toISOString();

  // 2. Carregar fatura com dados necessários
  const { data: invoice, error: invErr } = await db
    .from("saas_invoices")
    .select(`
      id, contractor_id, subscription_id, plan_id,
      amount, due_date, status, asaas_payment_id,
      contractors!inner(id, nome_fantasia, email, cnpj),
      saas_plans!inner(name)
    `)
    .eq("id", invoiceId)
    .maybeSingle();

  if (invErr || !invoice) return err("Fatura não encontrada.", "INVOICE_NOT_FOUND", 404);

  const contractor = invoice.contractors as { id: string; nome_fantasia: string; email: string; cnpj: string } | null;
  const plan       = invoice.saas_plans  as { name: string } | null;

  if (!contractor) return err("Empresa não encontrada na fatura.", "CONTRACTOR_NOT_FOUND", 404);

  // Idempotência: já tem cobrança Asaas?
  if (invoice.asaas_payment_id) {
    return json({
      success: true,
      data: {
        already_existed: true,
        asaas_payment_id: invoice.asaas_payment_id,
        message: "Cobrança Asaas já existe para esta fatura.",
      },
    });
  }

  if (!["draft", "pending"].includes(invoice.status)) {
    return err(
      `Fatura com status '${invoice.status}' não pode gerar cobrança Asaas. Permitido: draft, pending.`,
      "INVALID_INVOICE_STATUS"
    );
  }

  // 3. Obter configuração Asaas
  let asaasConfig: { baseUrl: string; apiKey: string; webhookToken: string };
  try {
    asaasConfig = getAsaasConfig();
  } catch (e) {
    console.error("[create-saas-payment] Config error:", (e as Error).name);
    return err("Integração Asaas não configurada. Configure ASAAS_BASE_URL e ASAAS_API_KEY.", "ASAAS_CONFIG_MISSING", 503);
  }

  const { baseUrl, apiKey } = asaasConfig;

  // 4. Obter ou criar customer Asaas para o contractor
  let asaasCustomerId: string;

  const { data: existingCustomer } = await db
    .from("saas_asaas_customers")
    .select("asaas_customer_id")
    .eq("contractor_id", invoice.contractor_id)
    .maybeSingle();

  if (existingCustomer?.asaas_customer_id) {
    asaasCustomerId = existingCustomer.asaas_customer_id;
    console.log(`[create-saas-payment] Customer existente: contractor=${invoice.contractor_id}`);
  } else {
    // Criar customer na conta principal GoFit
    const customerBody: Record<string, unknown> = {
      name:              contractor.nome_fantasia,
      externalReference: `gofit:saas:${invoice.contractor_id}`,
    };
    if (contractor.email)  customerBody.email   = contractor.email;
    if (contractor.cnpj)   customerBody.cpfCnpj = contractor.cnpj.replace(/\D/g, "");

    let asaasCustomer: { id: string };
    try {
      asaasCustomer = await asaasPost<{ id: string }>(apiKey, baseUrl, "/customers", customerBody);
    } catch (e) {
      const msg = (e as Error).message ?? "Erro ao criar customer";
      // CPF/CNPJ duplicado? Tentar buscar pelo externalReference
      try {
        const found = await asaasGet<{ data?: Array<{ id: string }> }>(
          apiKey, baseUrl, `/customers?externalReference=gofit:saas:${invoice.contractor_id}&limit=1`
        );
        if (found.data?.[0]?.id) {
          asaasCustomer = { id: found.data[0].id };
        } else {
          console.error("[create-saas-payment] upsertCustomer fallback failed");
          return err(msg, "ASAAS_CUSTOMER_ERROR", 502);
        }
      } catch {
        console.error("[create-saas-payment] Customer error:", (e as Error).name);
        return err(msg, "ASAAS_CUSTOMER_ERROR", 502);
      }
    }

    asaasCustomerId = asaasCustomer.id;

    // Salvar mapeamento
    await db.from("saas_asaas_customers").upsert({
      contractor_id:     invoice.contractor_id,
      asaas_customer_id: asaasCustomerId,
      name:              contractor.nome_fantasia,
      email:             contractor.email ?? null,
      cpf_cnpj:          contractor.cnpj  ?? null,
      synced_at:         now,
      updated_at:        now,
    }, { onConflict: "contractor_id" });

    console.log(`[create-saas-payment] Customer criado: contractor=${invoice.contractor_id}`);
  }

  // 5. Criar cobrança no Asaas
  const dueDate     = String(invoice.due_date).substring(0, 10);
  const externalRef = `gofit:saas-invoice:${invoiceId}`;
  const description = `GoFit ${plan?.name ?? "Assinatura"} — ${dueDate}`;

  let asaasPayment: {
    id:          string;
    status:      string;
    invoiceUrl:  string | null;
    bankSlipUrl: string | null;
  };

  try {
    asaasPayment = await asaasPost(apiKey, baseUrl, "/payments", {
      customer:          asaasCustomerId,
      billingType,
      value:             Number(invoice.amount),
      dueDate,
      description,
      externalReference: externalRef,
    });
  } catch (e) {
    const msg = (e as Error).message ?? "Erro ao criar cobrança";
    console.error("[create-saas-payment] Payment error:", (e as Error).name);

    // Registrar evento de falha
    await db.from("saas_billing_events").insert({
      invoice_id:      invoiceId,
      subscription_id: invoice.subscription_id ?? null,
      contractor_id:   invoice.contractor_id,
      event_type:      "ASAAS_PAYMENT_FAILED",
      metadata:        { error: msg, billing_type: billingType },
      created_by:      adminUserId,
      created_at:      now,
    });

    return err(msg, "ASAAS_PAYMENT_ERROR", 502);
  }

  // 6. Atualizar fatura com dados Asaas
  await db.from("saas_invoices").update({
    status:              "pending",
    payment_method:      billingType as string,
    asaas_customer_id:   asaasCustomerId,
    asaas_payment_id:    asaasPayment.id,
    asaas_invoice_url:   asaasPayment.invoiceUrl  ?? null,
    asaas_bank_slip_url: asaasPayment.bankSlipUrl ?? null,
    updated_at:          now,
  }).eq("id", invoiceId);

  // 7. Registrar evento de billing
  await db.from("saas_billing_events").insert({
    invoice_id:      invoiceId,
    subscription_id: invoice.subscription_id ?? null,
    contractor_id:   invoice.contractor_id,
    event_type:      "ASAAS_PAYMENT_CREATED",
    new_value:       { asaas_payment_id: asaasPayment.id, billing_type: billingType, status: asaasPayment.status },
    metadata:        { description, external_ref: externalRef },
    created_by:      adminUserId,
    created_at:      now,
  });

  console.log(
    `[create-saas-payment] OK: invoice=${invoiceId} asaas=${asaasPayment.id} status=${asaasPayment.status}`
  );

  return json({
    success: true,
    data: {
      invoice_id:        invoiceId,
      asaas_payment_id:  asaasPayment.id,
      asaas_status:      asaasPayment.status,
      asaas_invoice_url: asaasPayment.invoiceUrl  ?? null,
      bank_slip_url:     asaasPayment.bankSlipUrl ?? null,
      billing_type:      billingType,
      already_existed:   false,
      message:           billingType === "PIX"
        ? "Cobrança Pix criada no Asaas para esta assinatura SaaS."
        : billingType === "BOLETO"
        ? "Boleto criado no Asaas para esta assinatura SaaS."
        : "Cobrança criada no Asaas para esta assinatura SaaS.",
    },
  });
});
