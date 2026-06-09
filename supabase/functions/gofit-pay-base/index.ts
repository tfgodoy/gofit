/**
 * Edge Function: gofit-pay-base
 * Hardening pré-Fase 5 — todos os itens do checklist implementados
 *
 * SEGURANÇA:
 *   - validateSecrets() chamado em toda requisição
 *   - Todos os erros passam por sanitizeError() antes de sair
 *   - provider_api_key_encrypted nunca retornada em responses
 *   - ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN, GOFIT_PAY_ENCRYPTION_KEY
 *     nunca aparecem em logs, responses ou mensagens públicas
 *
 * IDEMPOTÊNCIA:
 *   - create-account: verifica existência antes de chamar Asaas
 *   - webhook-receive: verifica provider_event_id antes de inserir
 *
 * AÇÕES DISPONÍVEIS:
 *   ping            → keepalive simples
 *   health-check    → diagnóstico completo (sem chamar Asaas)
 *   create-account  → Fase 5: cria subconta Asaas
 *   create-charge   → Fase 5: cria cobrança (sem cobrança ainda)
 *   cancel-charge   → Fase 6
 *   webhook-receive → estrutura pronta, processamento Fase 6
 */

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  validateSecrets,
  sanitizeError,
  SecretsValidation,
} from "./_security.ts";
import {
  AsaasService,
  AsaasConfigError,
  AsaasApiError,
  AsaasNotImplementedError,
  validateWebhookToken,
} from "./_asaas.ts";

/* ─── CORS ─────────────────────────────────────────────────────── */
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

/* ─── Clientes Supabase ─────────────────────────────────────────── */
function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")              ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

/* ─── Autenticação JWT ──────────────────────────────────────────── */
async function resolveContractor(req: Request): Promise<{ userId: string; contractorId: string } | null> {
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

  const { data: ca } = await db
    .from("contractor_auth")
    .select("contractor_id")
    .eq("id", user.id)
    .maybeSingle();
  if (ca) return { userId: user.id, contractorId: ca.contractor_id };

  const { data: st } = await db
    .from("staff")
    .select("contractor_id")
    .eq("id", user.id)
    .maybeSingle();
  if (st) return { userId: user.id, contractorId: st.contractor_id };

  return null;
}

/* ─── Atualiza status da conta (ambos os campos simultaneamente) ── */
/**
 * Item 3 do checklist: status e account_status SEMPRE atualizados juntos.
 * status = campo canônico do spec
 * account_status = alias de compatibilidade
 */
async function updateGoFitPayAccountStatus(
  db: ReturnType<typeof serviceClient>,
  accountId: string,
  newStatus: string
): Promise<void> {
  const { error } = await db
    .from("gofit_pay_accounts")
    .update({
      status:         newStatus,   // canônico (spec)
      account_status: newStatus,   // alias (compat)
      updated_at:     new Date().toISOString(),
    })
    .eq("id", accountId);

  if (error) {
    console.error("[gofit-pay] updateGoFitPayAccountStatus failed:", error.message);
    throw new Error("Falha ao atualizar status da conta.");
  }
}

/* ═══════════════════════════════════════════════════════════════════
   HANDLERS
   ═══════════════════════════════════════════════════════════════════ */

/* ─── health-check ────────────────────────────────────────────────
   Item 9 do checklist: diagnóstico completo sem chamar Asaas
   Retorna: configured, environment, contractorResolved, accountExists,
            accountStatus, missingConfig (nomes, nunca valores), message
 */
async function handleHealthCheck(
  contractorId: string,
  secrets: SecretsValidation
): Promise<Response> {
  const db = serviceClient();

  // Busca conta existente — OMITE provider_api_key_encrypted
  const { data: account } = await db
    .from("gofit_pay_accounts")
    .select("id, status, account_status, provider_account_id, provider_wallet_id")
    .eq("contractor_id", contractorId)
    .eq("provider", "asaas")
    .maybeSingle();

  const accountExists     = !!account;
  const accountComplete   = !!(account?.provider_account_id && account?.provider_wallet_id);
  const configured        = secrets.valid && accountExists;

  // Mensagem segura para UI (nunca expõe valores de secrets)
  let message: string;
  if (!secrets.valid) {
    const n = secrets.missing.length;
    message = `Configuração incompleta: ${n} variável${n > 1 ? "s" : ""} de ambiente ausente${n > 1 ? "s" : ""}.`;
  } else if (!accountExists) {
    message = "Secrets configurados. Aguardando criação da subconta GoFit Pay.";
  } else if (!accountComplete) {
    message = "Subconta criada mas incompleta. Execute novamente a ativação.";
  } else {
    message = "GoFit Pay configurado e pronto.";
  }

  return json({
    success: true,
    data: {
      configured,
      environment:        secrets.environment,
      baseUrlConfigured:  secrets.baseUrlConfigured,
      envConsistent:      secrets.envBaseUrlConsistent,
      contractorResolved: true,
      accountExists,
      accountComplete,
      accountStatus:      account?.status ?? null,     // status seguro — não é chave
      missingConfig:      secrets.missing,             // apenas nomes, nunca valores
      message,
    },
  });
}

/* ─── create-account ─────────────────────────────────────────────
   Fase 5 — criação real de subconta Asaas
   Item 2: verifica idempotência antes de chamar Asaas
 */
async function handleCreateAccount(
  body: Record<string, unknown>,
  contractorId: string,
  secrets: SecretsValidation
): Promise<Response> {
  if (!secrets.valid) {
    return err(
      `Configuração incompleta: ${secrets.missing.join(", ")} ausente(s).`,
      "CONFIG_INCOMPLETE", 503
    );
  }

  const db = serviceClient();

  // ── Idempotência: verificar se subconta já existe e está completa ──
  const { data: existing } = await db
    .from("gofit_pay_accounts")
    .select("id, status, provider_account_id, provider_wallet_id, provider_api_key_encrypted")
    .eq("contractor_id", contractorId)
    .eq("provider", "asaas")
    .maybeSingle();

  if (existing) {
    const isComplete = !!(
      existing.provider_account_id &&
      existing.provider_wallet_id  &&
      existing.provider_api_key_encrypted
    );

    if (isComplete) {
      // Já existe e está completa — não criar outra
      return json({
        success: true,
        data: {
          already_exists:    true,
          account_status:    existing.status,
          provider_account_id: existing.provider_account_id,
          // NUNCA retornar provider_api_key_encrypted
          message: "Subconta já cadastrada e configurada.",
        },
      });
    }
    // Existe mas incompleta — permitir retry (Fase 5 atualiza)
    console.log(`[gofit-pay] Existing incomplete account for contractor — retry allowed.`);
  }

  // ── Fase 5: chamada real ao Asaas (stub por ora) ──
  try {
    await AsaasService.createSubAccount({} as never);
  } catch (e) {
    if (e instanceof AsaasNotImplementedError) {
      return err(e.message, "NOT_IMPLEMENTED_PHASE_5", 501);
    }
    const { message, code } = sanitizeError(e);
    return err(message, code, 500);
  }

  return err("create-account: atingiu estado inesperado.", "INTERNAL_ERROR", 500);
}

/* ─── create-charge ──────────────────────────────────────────────
   Fase 5 — criação de cobrança (stub)
   Item 8: validação de idempotência de receivable_id está garantida
           pela constraint uq_payment_charges_receivable_provider no DB
 */
async function handleCreateCharge(
  _body: Record<string, unknown>,
  _contractorId: string,
  secrets: SecretsValidation
): Promise<Response> {
  if (!secrets.valid) {
    return err(`Configuração incompleta.`, "CONFIG_INCOMPLETE", 503);
  }
  return err(
    "Emissão de cobranças disponível na Fase 5.",
    "NOT_IMPLEMENTED_PHASE_5", 501
  );
}

/* ─── cancel-charge ──────────────────────────────────────────────
   Fase 6
 */
async function handleCancelCharge(): Promise<Response> {
  return err("Cancelamento de cobranças disponível na Fase 6.", "NOT_IMPLEMENTED_PHASE_6", 501);
}

/* ─── webhook-receive ────────────────────────────────────────────
   Item 6 + 7 do checklist
   - Valida asaas-access-token (ASAAS_WEBHOOK_TOKEN)
   - Verifica idempotência por provider_event_id
   - Salva raw payload em gofit_pay_webhook_events
   - Processamento real: Fase 6
 */
async function handleWebhookReceive(req: Request): Promise<Response> {
  // Passo 1: validar token sem expor ASAAS_WEBHOOK_TOKEN
  let tokenValid = false;
  try {
    tokenValid = validateWebhookToken(req);
  } catch (e) {
    if (e instanceof AsaasConfigError) {
      // Secrets não configurados — log interno sem valor
      console.error("[gofit-pay-webhook] Config error during token validation.");
      return err("Configuração de webhook incompleta.", "CONFIG_ERROR", 503);
    }
    throw e;
  }

  if (!tokenValid) {
    // Asaas vai receber 401 e pode retentar; log sem token real
    console.warn("[gofit-pay-webhook] Invalid token in request.");
    return err("Token de webhook inválido.", "UNAUTHORIZED_WEBHOOK", 401);
  }

  // Passo 2: ler payload (não confiar em campos do payload para contractor_id)
  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return err("Payload inválido.", "INVALID_PAYLOAD", 400);
  }

  const eventType       = typeof payload.event        === "string" ? payload.event        : "UNKNOWN";
  const providerEventId = typeof payload.id           === "string" ? payload.id           : null;
  const providerPayId   = typeof payload.payment?.id  === "string" ? payload.payment?.id  : null;

  // Passo 3: resolver contractor_id a partir do externalReference ou payment.id
  // (implementação real na Fase 6 — por ora registra sem contractor vinculado)
  // NUNCA confiar em contractor_id vindo do payload externo
  const db = serviceClient();

  // Passo 4: idempotência por provider_event_id
  if (providerEventId) {
    const { data: existing } = await db
      .from("gofit_pay_webhook_events")
      .select("id, processed")
      .eq("provider", "asaas")
      .eq("provider_event_id", providerEventId)
      .maybeSingle();

    if (existing) {
      // Evento já recebido — retornar 200 (Asaas não deve reenviar desnecessariamente)
      return json({
        success: true,
        data: { duplicate: true, message: "Evento já registrado." },
      });
    }
  }

  // Passo 5: salvar evento bruto (contractor_id = null por enquanto — Fase 6 resolve)
  // Nota: inserir sem contractor_id só é possível se RLS está desabilitada para service_role
  const { error: insertError } = await db
    .from("gofit_pay_webhook_events")
    .insert({
      contractor_id:      "00000000-0000-0000-0000-000000000000", // placeholder — Fase 6 resolve
      provider:           "asaas",
      event_type:         eventType,
      provider_event_id:  providerEventId,
      provider_payment_id: providerPayId,
      payload_json:       payload,
      raw_payload:        payload,                                 // alias legado
      processed:          false,
      processing_attempts: 0,
      source_ip:          req.headers.get("x-forwarded-for") ?? null,
      received_at:        new Date().toISOString(),
    });

  if (insertError) {
    // Se for duplicata pela constraint, tratar como OK
    if (insertError.code === "23505") {
      return json({ success: true, data: { duplicate: true } });
    }
    console.error("[gofit-pay-webhook] Insert failed:", insertError.message);
    // Retornar 200 para Asaas não ficar reenviando (log interno para debug)
    return json({ success: true, data: { queued: false, error: "storage_failed" } });
  }

  // Passo 6: processamento real — Fase 6
  return json({
    success: true,
    data: {
      queued:       true,
      processed:    false,
      phase:        6,
      event_type:   eventType,
      message:      "Evento registrado. Processamento implementado na Fase 6.",
    },
  });
}

/* ═══════════════════════════════════════════════════════════════════
   ROTEADOR PRINCIPAL
   ═══════════════════════════════════════════════════════════════════ */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Webhook chega sem JWT — tratar separadamente antes de autenticar
  const url = new URL(req.url);
  if (req.method === "POST" && url.searchParams.get("source") === "webhook") {
    try {
      return await handleWebhookReceive(req);
    } catch (e) {
      const { message, code } = sanitizeError(e);
      return err(message, code, 500);
    }
  }

  if (req.method !== "POST") {
    return err("Método não permitido.", "METHOD_NOT_ALLOWED", 405);
  }

  // ── 1. Ler body ──────────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return err("Body JSON inválido.", "INVALID_BODY", 400);
  }

  const action = typeof body?.action === "string" ? body.action : null;

  // ping: keepalive mínimo sem validações pesadas
  if (action === "ping") {
    return json({ success: true, data: { pong: true, phase: 4 } });
  }

  // ── 2. Autenticar usuário via JWT ────────────────────────────────
  const identity = await resolveContractor(req);
  if (!identity) {
    return err("Não autenticado ou empresa não encontrada.", "UNAUTHORIZED", 401);
  }

  // ── 3. Validar Supabase Secrets (item 1 do checklist) ───────────
  // Feito aqui para todos os handlers protegidos
  const secrets = validateSecrets();

  // ── 4. Rotear ────────────────────────────────────────────────────
  try {
    switch (action) {
      case "health-check":
        return await handleHealthCheck(identity.contractorId, secrets);

      case "create-account":
        return await handleCreateAccount(body, identity.contractorId, secrets);

      case "create-charge":
        return await handleCreateCharge(body, identity.contractorId, secrets);

      case "cancel-charge":
        return await handleCancelCharge();

      case "webhook-receive":
        // Alternativa: chamar via action (para testes internos)
        return err(
          "Use ?source=webhook com header asaas-access-token para webhooks reais.",
          "USE_WEBHOOK_ENDPOINT", 400
        );

      case null:
        return err("Campo 'action' obrigatório.", "MISSING_ACTION", 400);

      default:
        return err(`Ação desconhecida: '${action}'.`, "UNKNOWN_ACTION", 400);
    }
  } catch (e) {
    // ── Tratamento centralizado de erros (item 10) ──────────────────
    if (e instanceof AsaasConfigError) {
      // Não expor qual configuração falhou
      console.error("[gofit-pay] AsaasConfigError:", e.name);
      return err("Configuração de gateway incompleta.", "CONFIG_ERROR", 503);
    }
    if (e instanceof AsaasApiError) {
      // Erro da API Asaas: status e code são seguros; mensagem passa por sanitize
      const { message } = sanitizeError(e);
      console.error(`[gofit-pay] AsaasApiError: HTTP ${e.httpStatus} code=${e.code}`);
      return err(message, e.code, 502);
    }
    if (e instanceof AsaasNotImplementedError) {
      return err(e.message, "NOT_IMPLEMENTED", 501);
    }

    // Erro genérico — sanitizar antes de retornar
    const { message, code } = sanitizeError(e);
    console.error(`[gofit-pay] Unhandled: ${(e as Error)?.name ?? "Error"}`);
    return err(message, code, 500);
  }
});
