/**
 * Edge Function: gofit-pay-base
 * Fase 5 — Integração real com Asaas (sandbox)
 *
 * SEGURANÇA:
 *   - validateSecrets() em toda requisição
 *   - Todos os erros passam por sanitizeError()
 *   - provider_api_key_encrypted nunca em responses
 *   - ASAAS_API_KEY nunca em logs/response/toast
 *
 * AÇÕES DISPONÍVEIS:
 *   ping                  → keepalive
 *   health-check          → diagnóstico completo
 *   activate_gofit_pay    → FASE 5: cria subconta Asaas + salva com segurança
 *   get_activation_status → FASE 5: retorna status atual da ativação
 *   retry_activation      → FASE 5: retry após activation_failed
 *   create-account        → alias de activate_gofit_pay
 *   create-charge         → FASE 5: stub
 *   cancel-charge         → FASE 6: stub
 *   ?source=webhook       → endpoint de webhooks Asaas
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
  AsaasAccount,
  AsaasConfigError,
  AsaasApiError,
  AsaasNotImplementedError,
  validateWebhookToken,
  encryptSubAccountKey,
  mapAsaasAccountStatus,
  toOnboardingStatus,
  CreateSubAccountParams,
} from "./_asaas.ts";

/* ─── CORS ──────────────────────────────────────────────────────────── */
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

/* ─── Clientes Supabase ─────────────────────────────────────────────── */
function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")              ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

/* ─── Autenticação JWT ──────────────────────────────────────────────── */
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

/* ─── Helper: status da conta (ambos os campos simultâneos) ─────────── */
async function updateGoFitPayAccountStatus(
  db: ReturnType<typeof serviceClient>,
  accountId: string,
  newStatus: string
): Promise<void> {
  const { error } = await db
    .from("gofit_pay_accounts")
    .update({
      status:         newStatus,
      account_status: newStatus,
      updated_at:     new Date().toISOString(),
    })
    .eq("id", accountId);

  if (error) {
    console.error("[gofit-pay] updateGoFitPayAccountStatus failed:", error.message);
    throw new Error("Falha ao atualizar status da conta.");
  }
}

/* ─── Helper: module_id do GoFit Pay ────────────────────────────────── */
async function getGoFitPayModuleId(db: ReturnType<typeof serviceClient>): Promise<string | null> {
  const { data } = await db
    .from("modules")
    .select("id")
    .eq("slug", "gofit_pay")
    .maybeSingle();
  return data?.id ?? null;
}

/* ─── Helper: upsert company_modules ───────────────────────────────── */
async function updateCompanyModuleStatus(
  db: ReturnType<typeof serviceClient>,
  contractorId: string,
  moduleId: string,
  newStatus: string
): Promise<void> {
  const now = new Date().toISOString();

  const { data: cm } = await db
    .from("company_modules")
    .select("id")
    .eq("contractor_id", contractorId)
    .eq("module_id", moduleId)
    .maybeSingle();

  if (cm) {
    await db
      .from("company_modules")
      .update({ status: newStatus, updated_at: now })
      .eq("id", cm.id);
  } else {
    await db
      .from("company_modules")
      .insert({
        contractor_id: contractorId,
        module_id:     moduleId,
        status:        newStatus,
        activated_at:  now,
        config_json:   {},
      });
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   HANDLERS
   ═══════════════════════════════════════════════════════════════════════ */

/* ─── health-check ──────────────────────────────────────────────────── */
async function handleHealthCheck(
  contractorId: string,
  secrets: SecretsValidation
): Promise<Response> {
  const db = serviceClient();

  const { data: account } = await db
    .from("gofit_pay_accounts")
    .select("id, status, account_status, provider_account_id, provider_wallet_id")
    .eq("contractor_id", contractorId)
    .eq("provider", "asaas")
    .maybeSingle();

  const accountExists   = !!account;
  const accountComplete = !!(account?.provider_account_id && account?.provider_wallet_id);
  const configured      = secrets.valid && accountExists && accountComplete;

  let message: string;
  if (!secrets.valid) {
    const n = secrets.missing.length;
    message = `Configuração incompleta: ${n} variável${n > 1 ? "s" : ""} ausente${n > 1 ? "s" : ""}.`;
  } else if (!accountExists) {
    message = "Secrets configurados. Subconta ainda não criada.";
  } else if (!accountComplete) {
    message = "Subconta criada mas incompleta. Reative o GoFit Pay.";
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
      accountStatus:      account?.status ?? null,
      missingConfig:      secrets.missing,
      message,
    },
  });
}

/* ─── activate_gofit_pay ─────────────────────────────────────────────────
   Fase 5: fluxo completo de ativação em sandbox
    1. Valida secrets
    2. Carrega gofit_pay_config (dados do wizard)
    3. Valida campos obrigatórios
    4. Verifica idempotência (subconta já existe?)
    5. Chama Asaas.createSubAccount()
    6. Criptografa apiKey imediatamente após recebimento
    7. Salva gofit_pay_accounts (provider_api_key_encrypted nunca em response)
    8. Salva gofit_pay_settings
    9. Atualiza gofit_pay_config.onboarding_status
   10. Atualiza company_modules.status
   11. Retorna somente dados seguros
*/
async function handleActivateGoFitPay(
  contractorId: string,
  secrets: SecretsValidation
): Promise<Response> {
  if (!secrets.valid) {
    return err(
      `Configuração incompleta: ${secrets.missing.join(", ")} ausente(s). Configure os Supabase Secrets.`,
      "CONFIG_INCOMPLETE", 503
    );
  }

  const db  = serviceClient();
  const now = new Date().toISOString();

  // ── 1. Carrega dados do wizard ──────────────────────────────────────
  const { data: cfg, error: cfgErr } = await db
    .from("gofit_pay_config")
    .select("*")
    .eq("contractor_id", contractorId)
    .maybeSingle();

  if (cfgErr || !cfg) {
    return err(
      "Cadastro de ativação não encontrado. Complete o wizard de ativação primeiro.",
      "ONBOARDING_NOT_FOUND", 404
    );
  }

  // ── 2. Valida campos obrigatórios ───────────────────────────────────
  const requiredFields = [
    "cnpj", "razao_social", "tipo_empresa",
    "resp_email", "resp_celular", "resp_nascimento",
    "logradouro", "numero_end", "bairro", "cep",
  ];
  const missingFields = requiredFields.filter(
    (f) => !cfg[f as keyof typeof cfg]
  );
  if (missingFields.length > 0) {
    return err(
      `Campos obrigatórios não preenchidos: ${missingFields.join(", ")}. Complete o wizard.`,
      "MISSING_REQUIRED_FIELDS", 422
    );
  }

  // ── 3. Idempotência ─────────────────────────────────────────────────
  const { data: existing } = await db
    .from("gofit_pay_accounts")
    .select("id, status, provider_account_id, provider_wallet_id")
    .eq("contractor_id", contractorId)
    .eq("provider", "asaas")
    .maybeSingle();

  if (existing?.provider_account_id) {
    // Subconta já criada — não chamar Asaas novamente
    const moduleId = await getGoFitPayModuleId(db);
    if (moduleId) {
      await updateCompanyModuleStatus(db, contractorId, moduleId, existing.status ?? "in_review");
    }
    return json({
      success: true,
      data: {
        already_activated:   true,
        status:              existing.status ?? "in_review",
        provider_account_id: existing.provider_account_id,
        provider_wallet_id:  existing.provider_wallet_id ?? null,
        account_key_stored:  null,
        environment:         secrets.environment,
        message:             "Subconta já cadastrada. Sem nova chamada ao Asaas.",
      },
    });
  }

  // ── 4. Chama Asaas sandbox ──────────────────────────────────────────
  let asaasAccount: AsaasAccount;
  try {
    const params: CreateSubAccountParams = {
      cnpj:            String(cfg.cnpj),
      razao_social:    String(cfg.razao_social),
      tipo_empresa:    String(cfg.tipo_empresa),
      resp_email:      String(cfg.resp_email),
      resp_celular:    String(cfg.resp_celular),
      resp_nascimento: String(cfg.resp_nascimento),
      logradouro:      String(cfg.logradouro),
      numero_end:      String(cfg.numero_end),
      complemento:     cfg.complemento ? String(cfg.complemento) : undefined,
      bairro:          String(cfg.bairro),
      cep:             String(cfg.cep),
    };
    asaasAccount = await AsaasService.createSubAccount(params);
  } catch (e) {
    // Salva estado de falha
    const failedStatus = "activation_failed";
    const moduleId = await getGoFitPayModuleId(db);
    if (moduleId) {
      await updateCompanyModuleStatus(db, contractorId, moduleId, failedStatus);
    }
    await db
      .from("gofit_pay_config")
      .update({ onboarding_status: failedStatus, updated_at: now })
      .eq("contractor_id", contractorId);

    if (e instanceof AsaasApiError) {
      const { message } = sanitizeError(e);
      console.error(`[gofit-pay] AsaasApiError HTTP ${e.httpStatus}: code=${e.code}`);
      return err(message, "ASAAS_ERROR", 502);
    }
    if (e instanceof AsaasConfigError) {
      console.error(`[gofit-pay] AsaasConfigError: ${e.name}`);
      return err("Configuração de gateway incompleta.", "CONFIG_ERROR", 503);
    }
    const { message, code } = sanitizeError(e);
    return err(message, code, 500);
  }

  // ── 5. Mapeia status Asaas → GoFit ──────────────────────────────────
  const asaasStatusStr    = asaasAccount.accountStatus?.status ?? "PENDING";
  const gofitStatus       = mapAsaasAccountStatus(asaasStatusStr);
  const newOnboarding     = toOnboardingStatus(gofitStatus);

  // ── 6. Criptografa apiKey imediatamente ─────────────────────────────
  let encryptedKey: string | null = null;
  const hasApiKey = !!asaasAccount.apiKey;

  if (asaasAccount.apiKey) {
    try {
      encryptedKey = await encryptSubAccountKey(asaasAccount.apiKey);
    } catch (e) {
      // Nunca expor erro de criptografia com detalhes
      console.error(`[gofit-pay] Encryption error: ${(e as Error)?.name ?? "Error"}`);
      // Não falhar a ativação — conta foi criada, apenas chave não pôde ser salva
    }
  }

  // ── 7. Salva gofit_pay_accounts ─────────────────────────────────────
  // provider_api_key_encrypted: salvo apenas aqui — nunca retornado
  const accountData: Record<string, unknown> = {
    contractor_id:                    contractorId,
    provider:                         "asaas",
    provider_account_id:              asaasAccount.id,
    provider_wallet_id:               asaasAccount.walletId ?? null,
    status:                           gofitStatus,
    account_status:                   gofitStatus,
    display_name:                     cfg.nome_exibicao ?? "GoFit Pay",
    automatic_transfer_enabled:       cfg.transferencia_automatica ?? false,
    credit_card_anticipation_enabled: cfg.antecipacao_automatica   ?? false,
    activated_at:                     now,
    updated_at:                       now,
  };
  if (encryptedKey) {
    accountData.provider_api_key_encrypted = encryptedKey;
  }

  if (existing) {
    await db.from("gofit_pay_accounts").update(accountData).eq("id", existing.id);
  } else {
    await db.from("gofit_pay_accounts").insert({ ...accountData, created_at: now });
  }

  // ── 8. Salva gofit_pay_settings ─────────────────────────────────────
  const settingsData: Record<string, unknown> = {
    contractor_id:             contractorId,
    display_name:              cfg.nome_exibicao          ?? "GoFit Pay",
    late_fee_enabled:          cfg.multa_ativa            ?? false,
    late_fee_percent:          cfg.multa_percentual       ?? null,
    interest_enabled:          cfg.juros_ativo            ?? false,
    interest_percent:          cfg.juros_percentual       ?? null,
    early_discount_enabled:    cfg.desconto_ativo         ?? false,
    early_discount_percent:    cfg.desconto_percentual    ?? null,
    early_discount_days:       cfg.desconto_dias          ?? null,
    auto_transfer_disabled:    !(cfg.transferencia_automatica ?? false),
    auto_anticipation_enabled: cfg.antecipacao_automatica ?? false,
    updated_at:                now,
  };

  const { data: existingSettings } = await db
    .from("gofit_pay_settings")
    .select("id")
    .eq("contractor_id", contractorId)
    .maybeSingle();

  if (existingSettings) {
    await db.from("gofit_pay_settings").update(settingsData).eq("id", existingSettings.id);
  } else {
    await db.from("gofit_pay_settings").insert({ ...settingsData, created_at: now });
  }

  // ── 9. Atualiza gofit_pay_config.onboarding_status ──────────────────
  await db
    .from("gofit_pay_config")
    .update({ onboarding_status: newOnboarding, updated_at: now })
    .eq("contractor_id", contractorId);

  // ── 10. Atualiza company_modules.status ──────────────────────────────
  const moduleId = await getGoFitPayModuleId(db);
  if (moduleId) {
    await updateCompanyModuleStatus(db, contractorId, moduleId, gofitStatus);
  }

  // ── 11. Retorna dados seguros ────────────────────────────────────────
  // NUNCA incluir: provider_api_key_encrypted, apiKey, ASAAS_API_KEY
  return json({
    success: true,
    data: {
      status:              gofitStatus,
      provider_account_id: asaasAccount.id,
      provider_wallet_id:  asaasAccount.walletId ?? null,
      account_key_stored:  hasApiKey && !!encryptedKey,
      onboarding_status:   newOnboarding,
      environment:         secrets.environment,
      message: gofitStatus === "active"
        ? "GoFit Pay ativado com sucesso!"
        : gofitStatus === "in_review"
        ? "Subconta criada. Aguardando análise do Asaas (até 2 dias úteis)."
        : "Ativação recusada pelo Asaas. Verifique os dados e tente novamente.",
    },
  });
}

/* ─── get_activation_status ──────────────────────────────────────────── */
async function handleGetActivationStatus(contractorId: string): Promise<Response> {
  const db = serviceClient();

  const { data: account } = await db
    .from("gofit_pay_accounts")
    .select("id, status, account_status, provider_account_id, provider_wallet_id, activated_at, last_sync_at, sync_error")
    .eq("contractor_id", contractorId)
    .eq("provider", "asaas")
    .maybeSingle();

  const moduleId = await getGoFitPayModuleId(db);
  let moduleStatus: string | null = null;
  if (moduleId) {
    const { data: cm } = await db
      .from("company_modules")
      .select("status")
      .eq("contractor_id", contractorId)
      .eq("module_id", moduleId)
      .maybeSingle();
    moduleStatus = cm?.status ?? null;
  }

  return json({
    success: true,
    data: {
      activated:           !!account?.provider_account_id,
      status:              account?.status       ?? null,
      module_status:       moduleStatus,
      provider_account_id: account?.provider_account_id ?? null,
      provider_wallet_id:  account?.provider_wallet_id  ?? null,
      activated_at:        account?.activated_at ?? null,
      last_sync_at:        account?.last_sync_at ?? null,
      sync_error:          account?.sync_error   ?? null,
    },
  });
}

/* ─── retry_activation ───────────────────────────────────────────────── */
async function handleRetryActivation(
  contractorId: string,
  secrets: SecretsValidation
): Promise<Response> {
  if (!secrets.valid) {
    return err("Configuração incompleta.", "CONFIG_INCOMPLETE", 503);
  }

  const db  = serviceClient();
  const now = new Date().toISOString();

  const { data: existing } = await db
    .from("gofit_pay_accounts")
    .select("id, status, provider_account_id")
    .eq("contractor_id", contractorId)
    .eq("provider", "asaas")
    .maybeSingle();

  // Sem conta → ativação completa
  if (!existing) {
    return handleActivateGoFitPay(contractorId, secrets);
  }

  // Sem provider_account_id → falhou antes de criar no Asaas
  if (!existing.provider_account_id) {
    return handleActivateGoFitPay(contractorId, secrets);
  }

  // Só permite retry em activation_failed
  if (existing.status !== "activation_failed") {
    return err(
      `Retry só permitido em estado 'activation_failed'. Status atual: '${existing.status}'.`,
      "INVALID_STATUS_FOR_RETRY", 409
    );
  }

  // Em sandbox: limpa campos do provedor e reativa
  await db
    .from("gofit_pay_accounts")
    .update({
      provider_account_id:        null,
      provider_wallet_id:         null,
      provider_api_key_encrypted: null,
      status:                     "pending",
      account_status:             "pending",
      sync_error:                 null,
      updated_at:                 now,
    })
    .eq("id", existing.id);

  // Reseta onboarding para 'enviado' (dados do wizard ainda válidos)
  await db
    .from("gofit_pay_config")
    .update({ onboarding_status: "enviado", updated_at: now })
    .eq("contractor_id", contractorId);

  return handleActivateGoFitPay(contractorId, secrets);
}

/* ─── create-charge ──────────────────────────────────────────────────── */
async function handleCreateCharge(
  _body: Record<string, unknown>,
  _contractorId: string,
  secrets: SecretsValidation
): Promise<Response> {
  if (!secrets.valid) {
    return err("Configuração incompleta.", "CONFIG_INCOMPLETE", 503);
  }
  return err("Emissão de cobranças disponível na Fase 5.", "NOT_IMPLEMENTED_PHASE_5", 501);
}

/* ─── cancel-charge ──────────────────────────────────────────────────── */
async function handleCancelCharge(): Promise<Response> {
  return err("Cancelamento disponível na Fase 6.", "NOT_IMPLEMENTED_PHASE_6", 501);
}

/* ─── webhook-receive ────────────────────────────────────────────────── */
async function handleWebhookReceive(req: Request): Promise<Response> {
  let tokenValid = false;
  try {
    tokenValid = validateWebhookToken(req);
  } catch (e) {
    if (e instanceof AsaasConfigError) {
      console.error("[gofit-pay-webhook] Config error during token validation.");
      return err("Configuração de webhook incompleta.", "CONFIG_ERROR", 503);
    }
    throw e;
  }

  if (!tokenValid) {
    console.warn("[gofit-pay-webhook] Invalid or missing asaas-access-token.");
    return err("Token de webhook inválido.", "UNAUTHORIZED_WEBHOOK", 401);
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return err("Payload inválido.", "INVALID_PAYLOAD", 400);
  }

  const eventType     = typeof payload.event === "string" ? payload.event : "UNKNOWN";
  const providerEvenId = typeof payload.id    === "string" ? payload.id    : null;

  const paymentObj  = payload.payment && typeof payload.payment === "object"
    ? (payload.payment as Record<string, unknown>) : null;
  const providerPayId = typeof paymentObj?.id === "string" ? paymentObj.id : null;

  const db = serviceClient();

  // Idempotência
  if (providerEvenId) {
    const { data: dup } = await db
      .from("gofit_pay_webhook_events")
      .select("id")
      .eq("provider", "asaas")
      .eq("provider_event_id", providerEvenId)
      .maybeSingle();
    if (dup) {
      return json({ success: true, data: { duplicate: true, message: "Evento já registrado." } });
    }
  }

  const { error: insertErr } = await db
    .from("gofit_pay_webhook_events")
    .insert({
      contractor_id:       "00000000-0000-0000-0000-000000000000",
      provider:            "asaas",
      event_type:          eventType,
      provider_event_id:   providerEvenId,
      provider_payment_id: providerPayId,
      payload_json:        payload,
      raw_payload:         payload,
      processed:           false,
      processing_attempts: 0,
      source_ip:           req.headers.get("x-forwarded-for") ?? null,
      received_at:         new Date().toISOString(),
    });

  if (insertErr) {
    if (insertErr.code === "23505") {
      return json({ success: true, data: { duplicate: true } });
    }
    console.error("[gofit-pay-webhook] Insert failed:", insertErr.message);
    return json({ success: true, data: { queued: false } });
  }

  return json({
    success: true,
    data: { queued: true, processed: false, event_type: eventType, message: "Evento registrado." },
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   ROTEADOR PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════ */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Webhook: sem JWT — validação pelo token próprio Asaas
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

  // ── Body ──────────────────────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return err("Body JSON inválido.", "INVALID_BODY", 400);
  }

  const action = typeof body?.action === "string" ? body.action : null;

  // ping: keepalive sem autenticação pesada
  if (action === "ping") {
    return json({ success: true, data: { pong: true, phase: 5 } });
  }

  // ── Autenticação ───────────────────────────────────────────────────────
  const identity = await resolveContractor(req);
  if (!identity) {
    return err("Não autenticado ou empresa não encontrada.", "UNAUTHORIZED", 401);
  }

  // ── Secrets ────────────────────────────────────────────────────────────
  const secrets = validateSecrets();

  // ── Roteamento ─────────────────────────────────────────────────────────
  try {
    switch (action) {
      case "health-check":
        return await handleHealthCheck(identity.contractorId, secrets);

      case "activate_gofit_pay":
      case "create-account":           // alias de compatibilidade
        return await handleActivateGoFitPay(identity.contractorId, secrets);

      case "get_activation_status":
        return await handleGetActivationStatus(identity.contractorId);

      case "retry_activation":
        return await handleRetryActivation(identity.contractorId, secrets);

      case "create-charge":
        return await handleCreateCharge(body, identity.contractorId, secrets);

      case "cancel-charge":
        return await handleCancelCharge();

      case "webhook-receive":
        return err("Use ?source=webhook com header asaas-access-token.", "USE_WEBHOOK_ENDPOINT", 400);

      case null:
        return err("Campo 'action' obrigatório.", "MISSING_ACTION", 400);

      default:
        return err(`Ação desconhecida: '${action}'.`, "UNKNOWN_ACTION", 400);
    }
  } catch (e) {
    if (e instanceof AsaasConfigError) {
      console.error("[gofit-pay] AsaasConfigError:", e.name);
      return err("Configuração de gateway incompleta.", "CONFIG_ERROR", 503);
    }
    if (e instanceof AsaasApiError) {
      const { message } = sanitizeError(e);
      console.error(`[gofit-pay] AsaasApiError HTTP ${e.httpStatus} code=${e.code}`);
      return err(message, e.code, 502);
    }
    if (e instanceof AsaasNotImplementedError) {
      return err(e.message, "NOT_IMPLEMENTED", 501);
    }
    const { message, code } = sanitizeError(e);
    console.error(`[gofit-pay] Unhandled: ${(e as Error)?.name ?? "Error"}`);
    return err(message, code, 500);
  }
});
