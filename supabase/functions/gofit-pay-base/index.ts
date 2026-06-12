/**
 * Edge Function: gofit-pay-base  v10
 * Fase 9 — Cartão de crédito (CREDIT_CARD)
 *
 * AÇÕES DISPONÍVEIS:
 *   ping                      → keepalive
 *   health-check              → diagnóstico completo
 *   activate_gofit_pay        → Fase 5: cria subconta Asaas
 *   get_activation_status     → Fase 5: retorna status atual
 *   retry_activation          → Fase 5: retry após activation_failed
 *   create-account            → alias de activate_gofit_pay
 *   create_payment_charge     → Fase 6: cria cobrança Pix/Boleto para receivable
 *   get_or_create_customer    → Fase 6: garante customer Asaas para aluno
 *   get_charge                → Fase 6: detalhe de uma cobrança
 *   list_charges              → Fase 6: lista cobranças do contractor
 *   process_webhook_event     → Fase 7: reprocessa um evento específico (por event_id)
 *   process_pending_webhooks  → Fase 7: processa eventos pendentes/falhos em lote
 *   sync_charge_status        → Fase 7.1: consulta status no Asaas e atualiza DB
 *   cancel_charge             → Fase 8: cancela cobrança no Asaas
 *   ?source=webhook           → endpoint de webhooks Asaas (sem auth, valida token)
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
  AsaasCustomer,
  AsaasPayment,
  AsaasPixQrCode,
  AsaasConfigError,
  AsaasApiError,
  AsaasNotImplementedError,
  validateWebhookToken,
  encryptSubAccountKey,
  decryptSubAccountKey,
  mapAsaasAccountStatus,
  toOnboardingStatus,
  CreateSubAccountParams,
  TokenizeCreditCardParams,
} from "./_asaas.ts";
import {
  processWebhookEvent,
  sanitizeWebhookPayload,
  mapBillingTypeToFormaPagamento,
  extractPaymentDate,
  WebhookEventRow,
} from "./_webhook.ts";

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

async function updateGoFitPayAccountStatus(
  db: ReturnType<typeof serviceClient>,
  accountId: string,
  newStatus: string
): Promise<void> {
  const { error } = await db
    .from("gofit_pay_accounts")
    .update({ status: newStatus, account_status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", accountId);
  if (error) {
    console.error("[gofit-pay] updateGoFitPayAccountStatus failed:", error.message);
    throw new Error("Falha ao atualizar status da conta.");
  }
}

async function getGoFitPayModuleId(db: ReturnType<typeof serviceClient>): Promise<string | null> {
  const { data } = await db.from("modules").select("id").eq("slug", "gofit_pay").maybeSingle();
  return data?.id ?? null;
}

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
    await db.from("company_modules").update({ status: newStatus, updated_at: now }).eq("id", cm.id);
  } else {
    await db.from("company_modules").insert({
      contractor_id: contractorId, module_id: moduleId, status: newStatus,
      activated_at: now, config_json: {},
    });
  }
}

async function assertGoFitPayActive(
  db: ReturnType<typeof serviceClient>,
  contractorId: string,
  env: "sandbox" | "production" = "sandbox"
): Promise<{ account_id: string; provider_api_key_encrypted: string; provider_account_id: string }> {
  const moduleId = await getGoFitPayModuleId(db);
  if (moduleId) {
    const { data: cm } = await db
      .from("company_modules")
      .select("status")
      .eq("contractor_id", contractorId)
      .eq("module_id", moduleId)
      .maybeSingle();
    if (cm?.status !== "active") {
      throw new GoFitPayBusinessError("GoFit Pay não está ativo para esta empresa.", "GOFIT_PAY_NOT_ACTIVE", 402);
    }
  }
  const { data: account, error } = await db
    .from("gofit_pay_accounts")
    .select("id, status, provider_account_id, provider_api_key_encrypted")
    .eq("contractor_id", contractorId)
    .eq("provider", "asaas")
    .eq("provider_environment", env)
    .maybeSingle();
  if (error || !account) {
    throw new GoFitPayBusinessError("Conta GoFit Pay não encontrada. Ative o módulo primeiro.", "ACCOUNT_NOT_FOUND", 404);
  }
  if (account.status !== "active") {
    throw new GoFitPayBusinessError(`Conta GoFit Pay com status '${account.status}'. Aguarde a aprovação.`, "ACCOUNT_NOT_ACTIVE", 402);
  }
  if (!account.provider_api_key_encrypted) {
    throw new GoFitPayBusinessError("Chave da subconta não configurada. Reative o GoFit Pay.", "MISSING_SUBACCOUNT_KEY", 503);
  }
  return {
    account_id: account.id,
    provider_api_key_encrypted: account.provider_api_key_encrypted,
    provider_account_id: account.provider_account_id ?? "",
  };
}

function sanitizePaymentForStorage(payment: AsaasPayment): Record<string, unknown> {
  return {
    id: payment.id, customer: payment.customer, billingType: payment.billingType,
    value: payment.value, netValue: payment.netValue, status: payment.status,
    dueDate: payment.dueDate, invoiceUrl: payment.invoiceUrl,
    bankSlipUrl: payment.bankSlipUrl,
    externalReference: payment.externalReference ?? null,
    description: payment.description ?? null,
  };
}

class GoFitPayBusinessError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 400
  ) {
    super(message);
    this.name = "GoFitPayBusinessError";
  }
}

// ─── Action handlers ──────────────────────────────────────────────────────────

async function handleHealthCheck(contractorId: string, secrets: SecretsValidation): Promise<Response> {
  const db = serviceClient();
  const { data: account } = await db
    .from("gofit_pay_accounts")
    .select("id, status, account_status, provider_account_id, provider_wallet_id")
    .eq("contractor_id", contractorId)
    .eq("provider", "asaas")
    .maybeSingle();

  const accountExists   = !!account;
  const accountComplete = !!(account?.provider_account_id);
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
      configured, environment: secrets.environment,
      baseUrlConfigured: secrets.baseUrlConfigured, envConsistent: secrets.envBaseUrlConsistent,
      contractorResolved: true, accountExists, accountComplete,
      accountStatus: account?.status ?? null, missingConfig: secrets.missing, message,
    },
  });
}

async function handleActivateGoFitPay(contractorId: string, secrets: SecretsValidation): Promise<Response> {
  if (!secrets.valid) {
    return err(`Configuração incompleta: ${secrets.missing.join(", ")} ausente(s).`, "CONFIG_INCOMPLETE", 503);
  }
  const db  = serviceClient();
  const now = new Date().toISOString();

  const { data: cfg, error: cfgErr } = await db
    .from("gofit_pay_config")
    .select("*")
    .eq("contractor_id", contractorId)
    .maybeSingle();
  if (cfgErr || !cfg) {
    return err("Cadastro de ativação não encontrado.", "ONBOARDING_NOT_FOUND", 404);
  }

  const requiredFields = [
    "cnpj", "razao_social", "tipo_empresa", "resp_email", "resp_celular",
    "resp_nascimento", "logradouro", "numero_end", "bairro", "cep",
  ];
  const missingFields = requiredFields.filter(f => !cfg[f as keyof typeof cfg]);
  if (missingFields.length > 0) {
    return err(`Campos obrigatórios não preenchidos: ${missingFields.join(", ")}.`, "MISSING_REQUIRED_FIELDS", 422);
  }

  const { data: existing } = await db
    .from("gofit_pay_accounts")
    .select("id, status, provider_account_id, provider_wallet_id")
    .eq("contractor_id", contractorId)
    .eq("provider", "asaas")
    .maybeSingle();

  if (existing?.provider_account_id) {
    const moduleId = await getGoFitPayModuleId(db);
    if (moduleId) await updateCompanyModuleStatus(db, contractorId, moduleId, existing.status ?? "in_review");
    return json({
      success: true,
      data: {
        already_activated: true, status: existing.status ?? "in_review",
        provider_account_id: existing.provider_account_id,
        provider_wallet_id: existing.provider_wallet_id ?? null,
        account_key_stored: null, environment: secrets.environment,
        message: "Subconta já cadastrada. Sem nova chamada ao Asaas.",
      },
    });
  }

  let asaasAccount: AsaasAccount;
  try {
    const params: CreateSubAccountParams = {
      cnpj: String(cfg.cnpj), razao_social: String(cfg.razao_social),
      tipo_empresa: String(cfg.tipo_empresa), resp_email: String(cfg.resp_email),
      resp_celular: String(cfg.resp_celular), resp_nascimento: String(cfg.resp_nascimento),
      logradouro: String(cfg.logradouro), numero_end: String(cfg.numero_end),
      complemento: cfg.complemento ? String(cfg.complemento) : undefined,
      bairro: String(cfg.bairro), cep: String(cfg.cep),
      resp_renda_mensal: cfg.resp_renda_mensal ? Number(cfg.resp_renda_mensal) : undefined,
    };
    asaasAccount = await AsaasService.createSubAccount(params);
  } catch (e) {
    const failedStatus = "activation_failed";
    const moduleId = await getGoFitPayModuleId(db);
    if (moduleId) await updateCompanyModuleStatus(db, contractorId, moduleId, failedStatus);
    await db.from("gofit_pay_config").update({ onboarding_status: failedStatus, updated_at: now }).eq("contractor_id", contractorId);
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

  const asaasStatusStr = asaasAccount.accountStatus?.status ?? "PENDING";
  const gofitStatus    = mapAsaasAccountStatus(asaasStatusStr);
  const newOnboarding  = toOnboardingStatus(gofitStatus);

  let encryptedKey: string | null = null;
  const hasApiKey = !!asaasAccount.apiKey;
  if (asaasAccount.apiKey) {
    try {
      encryptedKey = await encryptSubAccountKey(asaasAccount.apiKey);
    } catch (e) {
      console.error(`[gofit-pay] Encryption error: ${(e as Error)?.name ?? "Error"}`);
    }
  }

  const accountData: Record<string, unknown> = {
    contractor_id: contractorId, provider: "asaas",
    provider_account_id: asaasAccount.id, provider_wallet_id: asaasAccount.walletId ?? null,
    status: gofitStatus, account_status: gofitStatus,
    display_name: cfg.nome_exibicao ?? "GoFit Pay",
    automatic_transfer_enabled: cfg.transferencia_automatica ?? false,
    credit_card_anticipation_enabled: cfg.antecipacao_automatica ?? false,
    activated_at: now, updated_at: now,
  };
  if (encryptedKey) accountData.provider_api_key_encrypted = encryptedKey;

  if (existing) {
    const { error: accUpdErr } = await db.from("gofit_pay_accounts").update(accountData).eq("id", existing.id);
    if (accUpdErr) {
      console.error(`[gofit-pay] CRITICAL: gofit_pay_accounts update failed: code=${accUpdErr.code} msg=${accUpdErr.message.substring(0, 120)}`);
      return err(`Subconta criada no Asaas (id=${asaasAccount.id}) mas erro ao atualizar conta local. code=${accUpdErr.code}`, "ACCOUNT_SAVE_ERROR", 500);
    }
  } else {
    const { error: accInsErr } = await db.from("gofit_pay_accounts").insert({ ...accountData, created_at: now });
    if (accInsErr) {
      console.error(`[gofit-pay] CRITICAL: gofit_pay_accounts insert failed: code=${accInsErr.code} msg=${accInsErr.message.substring(0, 120)}`);
      return err(`Subconta criada no Asaas (id=${asaasAccount.id}) mas erro ao salvar conta local. code=${accInsErr.code}`, "ACCOUNT_SAVE_ERROR", 500);
    }
  }

  const settingsData: Record<string, unknown> = {
    contractor_id: contractorId, display_name: cfg.nome_exibicao ?? "GoFit Pay",
    late_fee_enabled: cfg.multa_ativa ?? false, late_fee_percent: cfg.multa_percentual ?? null,
    interest_enabled: cfg.juros_ativo ?? false, interest_percent: cfg.juros_percentual ?? null,
    early_discount_enabled: cfg.desconto_ativo ?? false,
    early_discount_percent: cfg.desconto_percentual ?? null,
    early_discount_days: cfg.desconto_dias ?? null,
    auto_transfer_disabled: !(cfg.transferencia_automatica ?? false),
    auto_anticipation_enabled: cfg.antecipacao_automatica ?? false, updated_at: now,
  };
  const { data: existingSettings } = await db.from("gofit_pay_settings").select("id").eq("contractor_id", contractorId).maybeSingle();
  if (existingSettings) {
    await db.from("gofit_pay_settings").update(settingsData).eq("id", existingSettings.id);
  } else {
    await db.from("gofit_pay_settings").insert({ ...settingsData, created_at: now });
  }

  await db.from("gofit_pay_config").update({ onboarding_status: newOnboarding, updated_at: now }).eq("contractor_id", contractorId);

  const moduleId = await getGoFitPayModuleId(db);
  if (moduleId) await updateCompanyModuleStatus(db, contractorId, moduleId, gofitStatus);

  return json({
    success: true,
    data: {
      status: gofitStatus, provider_account_id: asaasAccount.id,
      provider_wallet_id: asaasAccount.walletId ?? null,
      account_key_stored: hasApiKey && !!encryptedKey,
      onboarding_status: newOnboarding, environment: secrets.environment,
      message: gofitStatus === "active"
        ? "GoFit Pay ativado com sucesso!"
        : gofitStatus === "in_review"
        ? "Subconta criada. Aguardando análise do Asaas (até 2 dias úteis)."
        : "Ativação recusada pelo Asaas. Verifique os dados e tente novamente.",
    },
  });
}

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
    const { data: cm } = await db.from("company_modules").select("status")
      .eq("contractor_id", contractorId).eq("module_id", moduleId).maybeSingle();
    moduleStatus = cm?.status ?? null;
  }

  return json({
    success: true,
    data: {
      activated: !!account?.provider_account_id, status: account?.status ?? null,
      module_status: moduleStatus, provider_account_id: account?.provider_account_id ?? null,
      provider_wallet_id: account?.provider_wallet_id ?? null,
      activated_at: account?.activated_at ?? null, last_sync_at: account?.last_sync_at ?? null,
      sync_error: account?.sync_error ?? null,
    },
  });
}

async function handleRetryActivation(contractorId: string, secrets: SecretsValidation): Promise<Response> {
  if (!secrets.valid) return err("Configuração incompleta.", "CONFIG_INCOMPLETE", 503);
  const db  = serviceClient();
  const now = new Date().toISOString();

  const { data: existing } = await db.from("gofit_pay_accounts")
    .select("id, status, provider_account_id").eq("contractor_id", contractorId).eq("provider", "asaas").maybeSingle();

  if (!existing || !existing.provider_account_id) return handleActivateGoFitPay(contractorId, secrets);

  if (existing.status !== "activation_failed") {
    return err(`Retry só permitido em estado 'activation_failed'. Status atual: '${existing.status}'.`, "INVALID_STATUS_FOR_RETRY", 409);
  }

  await db.from("gofit_pay_accounts").update({
    provider_account_id: null, provider_wallet_id: null, provider_api_key_encrypted: null,
    status: "pending", account_status: "pending", sync_error: null, updated_at: now,
  }).eq("id", existing.id);

  await db.from("gofit_pay_config").update({ onboarding_status: "enviado", updated_at: now }).eq("contractor_id", contractorId);
  return handleActivateGoFitPay(contractorId, secrets);
}

async function handleGetOrCreateCustomer(
  body: Record<string, unknown>,
  contractorId: string,
  secrets: SecretsValidation
): Promise<Response> {
  if (!secrets.valid) return err("Configuração incompleta.", "CONFIG_INCOMPLETE", 503);
  const studentId = typeof body.student_id === "string" ? body.student_id : null;
  if (!studentId) return err("student_id obrigatório.", "MISSING_STUDENT_ID");

  const db = serviceClient();
  const { env: custEnv } = await resolveEnvironment(db, contractorId);
  let subAccInfo: { account_id: string; provider_api_key_encrypted: string; provider_account_id: string };
  try {
    subAccInfo = await assertGoFitPayActive(db, contractorId, custEnv);
  } catch (e) {
    if (e instanceof GoFitPayBusinessError) return err(e.message, e.code, e.httpStatus);
    throw e;
  }

  const { data: student } = await db.from("students").select("id, nome_completo, cpf, email, telefone")
    .eq("id", studentId).eq("contractor_id", contractorId).maybeSingle();
  if (!student) return err("Aluno não encontrado ou não pertence a esta empresa.", "STUDENT_NOT_FOUND", 404);

  const { data: existingCustomer } = await db.from("payment_customers")
    .select("id, provider_customer_id")
    .eq("contractor_id", contractorId).eq("student_id", studentId).eq("provider", "asaas").maybeSingle();
  if (existingCustomer?.provider_customer_id) {
    return json({ success: true, data: { customer_id: existingCustomer.id, provider_customer_id: existingCustomer.provider_customer_id, already_existed: true } });
  }

  let subAccountApiKey: string;
  try {
    subAccountApiKey = await decryptSubAccountKey(subAccInfo.provider_api_key_encrypted);
  } catch (e) {
    console.error(`[gofit-pay] Decrypt error: ${(e as Error)?.name ?? "Error"}`);
    return err("Falha de configuração interna. Reative o GoFit Pay.", "DECRYPT_ERROR", 503);
  }

  let asaasCustomer: AsaasCustomer;
  try {
    asaasCustomer = await AsaasService.upsertCustomer(subAccountApiKey, {
      name: String(student.nome_completo), cpfCnpj: student.cpf ?? undefined,
      email: student.email ?? undefined, phone: student.telefone ?? undefined,
      externalReference: `gofit:stu:${studentId}`,
    });
  } catch (e) {
    if (e instanceof AsaasApiError) {
      const { message } = sanitizeError(e);
      console.error(`[gofit-pay] upsertCustomer AsaasApiError HTTP ${e.httpStatus} code=${e.code}`);
      return err(message, "ASAAS_CUSTOMER_ERROR", 502);
    }
    throw e;
  }

  const now = new Date().toISOString();
  const { data: savedCustomer, error: custErr } = await db.from("payment_customers").insert({
    contractor_id: contractorId, student_id: studentId, client_id: studentId,
    provider: "asaas", provider_customer_id: asaasCustomer.id,
    name: String(student.nome_completo), email: student.email ?? null,
    cpf_cnpj: student.cpf ?? null, phone: student.telefone ?? null,
    synced_at: now, created_at: now, updated_at: now,
  }).select("id").single();

  if (custErr) {
    if (custErr.code === "23505") {
      const { data: recovered } = await db.from("payment_customers")
        .select("id, provider_customer_id")
        .eq("contractor_id", contractorId).eq("student_id", studentId).eq("provider", "asaas").maybeSingle();
      return json({ success: true, data: { customer_id: recovered?.id ?? null, provider_customer_id: recovered?.provider_customer_id ?? asaasCustomer.id, already_existed: true } });
    }
    console.error(`[gofit-pay] payment_customers insert error: ${custErr.code}`);
    return err("Falha ao salvar customer.", "CUSTOMER_SAVE_ERROR", 500);
  }

  return json({ success: true, data: { customer_id: savedCustomer.id, provider_customer_id: asaasCustomer.id, already_existed: false } });
}

async function handleCreatePaymentCharge(
  body: Record<string, unknown>,
  contractorId: string,
  secrets: SecretsValidation
): Promise<Response> {
  if (!secrets.valid) return err("Configuração incompleta.", "CONFIG_INCOMPLETE", 503);

  const receivableId = typeof body.receivable_id === "string" ? body.receivable_id : null;
  const billingType  = typeof body.billing_type  === "string" ? body.billing_type.toUpperCase() : null;

  if (!receivableId) return err("receivable_id obrigatório.", "MISSING_RECEIVABLE_ID");
  if (!billingType)  return err("billing_type obrigatório.", "MISSING_BILLING_TYPE");
  const ALLOWED_BILLING = ["PIX", "BOLETO", "CREDIT_CARD"] as const;
  if (!ALLOWED_BILLING.includes(billingType as typeof ALLOWED_BILLING[number])) {
    return err("billing_type inválido. Use PIX, BOLETO ou CREDIT_CARD.", "INVALID_BILLING_TYPE");
  }

  const db = serviceClient();

  const { data: receivable, error: rcvErr } = await db
    .from("receivables")
    .select("id, contractor_id, student_id, student_contract_id, valor, vencimento, descricao, status, asaas_payment_id, gateway_provider")
    .eq("id", receivableId).eq("contractor_id", contractorId).maybeSingle();
  if (rcvErr || !receivable) {
    return err("Conta a receber não encontrada ou não pertence a esta empresa.", "RECEIVABLE_NOT_FOUND", 404);
  }

  const allowedStatuses = ["pendente", "atrasado", "aguardando"];
  if (!allowedStatuses.includes(receivable.status ?? "")) {
    return err(
      `Não é possível gerar cobrança para receivable com status '${receivable.status}'. Permitido: ${allowedStatuses.join(", ")}.`,
      "INVALID_RECEIVABLE_STATUS"
    );
  }

  const amount  = Number(receivable.valor ?? 0);
  const dueDate = String(receivable.vencimento ?? "");
  if (!amount || amount <= 0) return err("Valor da receivable inválido.", "INVALID_AMOUNT");
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}/.test(dueDate)) return err("Vencimento da receivable inválido.", "INVALID_DUE_DATE");
  const dueDateFormatted = dueDate.substring(0, 10);

  if (receivable.asaas_payment_id) {
    const { data: existingCharge } = await db.from("payment_charges")
      .select("id, provider_charge_id, billing_type, status, invoice_url, bank_slip_url, pix_qr_code, pix_copy_paste")
      .eq("receivable_id", receivableId).eq("provider", "asaas").maybeSingle();
    if (existingCharge) {
      return json({ success: true, data: { charge_id: existingCharge.id, provider_charge_id: existingCharge.provider_charge_id, billing_type: existingCharge.billing_type, status: existingCharge.status, amount, due_date: dueDateFormatted, invoice_url: existingCharge.invoice_url ?? null, bank_slip_url: existingCharge.bank_slip_url ?? null, pix_qr_code: existingCharge.pix_qr_code ?? null, pix_copy_paste: existingCharge.pix_copy_paste ?? null, already_existed: true, message: "Cobrança já existente para esta receivable." } });
    }
  }

  const { data: chargeCheck } = await db.from("payment_charges")
    .select("id, provider_charge_id, billing_type, status, invoice_url, bank_slip_url, pix_qr_code, pix_copy_paste")
    .eq("receivable_id", receivableId).eq("provider", "asaas").maybeSingle();
  if (chargeCheck) {
    return json({ success: true, data: { charge_id: chargeCheck.id, provider_charge_id: chargeCheck.provider_charge_id, billing_type: chargeCheck.billing_type, status: chargeCheck.status, amount, due_date: dueDateFormatted, invoice_url: chargeCheck.invoice_url ?? null, bank_slip_url: chargeCheck.bank_slip_url ?? null, pix_qr_code: chargeCheck.pix_qr_code ?? null, pix_copy_paste: chargeCheck.pix_copy_paste ?? null, already_existed: true, message: "Cobrança já existente para esta receivable." } });
  }

  const { env: chargeEnv, productionEnabled, allowedRealCharges } = await resolveEnvironment(db, contractorId);
  if (chargeEnv === "production" && (!productionEnabled || !allowedRealCharges)) {
    return err("Cobranças em produção não autorizadas para esta empresa.", "PRODUCTION_NOT_ALLOWED", 403);
  }

  let subAccInfo: { account_id: string; provider_api_key_encrypted: string; provider_account_id: string };
  try {
    subAccInfo = await assertGoFitPayActive(db, contractorId, chargeEnv);
  } catch (e) {
    if (e instanceof GoFitPayBusinessError) return err(e.message, e.code, e.httpStatus);
    throw e;
  }

  const studentId = receivable.student_id;
  if (!studentId) return err("Receivable sem student_id.", "MISSING_STUDENT_ID", 422);

  const { data: student } = await db.from("students").select("id, nome_completo, cpf, email, telefone")
    .eq("id", studentId).eq("contractor_id", contractorId).maybeSingle();
  if (!student) return err("Aluno não encontrado ou não pertence a esta empresa.", "STUDENT_NOT_FOUND", 404);

  let subAccountApiKey: string;
  try {
    subAccountApiKey = await decryptSubAccountKey(subAccInfo.provider_api_key_encrypted);
  } catch (e) {
    console.error(`[gofit-pay] Decrypt error: ${(e as Error)?.name ?? "Error"}`);
    return err("Falha de configuração interna. Reative o GoFit Pay.", "DECRYPT_ERROR", 503);
  }

  let providerCustomerId: string;
  const { data: existingCust } = await db.from("payment_customers")
    .select("id, provider_customer_id")
    .eq("contractor_id", contractorId).eq("student_id", studentId).eq("provider", "asaas").maybeSingle();

  if (existingCust?.provider_customer_id) {
    providerCustomerId = existingCust.provider_customer_id;
  } else {
    let asaasCustomer: AsaasCustomer;
    try {
      asaasCustomer = await AsaasService.upsertCustomer(subAccountApiKey, {
        name: String(student.nome_completo), cpfCnpj: student.cpf ?? undefined,
        email: student.email ?? undefined, phone: student.telefone ?? undefined,
        externalReference: `gofit:stu:${studentId}`,
      });
    } catch (e) {
      if (e instanceof AsaasApiError) {
        const { message } = sanitizeError(e);
        console.error(`[gofit-pay] upsertCustomer HTTP ${e.httpStatus} code=${e.code}`);
        return err(message, "ASAAS_CUSTOMER_ERROR", 502);
      }
      throw e;
    }
    providerCustomerId = asaasCustomer.id;
    const nowCust = new Date().toISOString();
    const { error: custInsertErr } = await db.from("payment_customers").insert({
      contractor_id: contractorId, student_id: studentId, client_id: studentId,
      provider: "asaas", provider_customer_id: asaasCustomer.id,
      name: String(student.nome_completo), email: student.email ?? null,
      cpf_cnpj: student.cpf ?? null, phone: student.telefone ?? null,
      synced_at: nowCust, created_at: nowCust, updated_at: nowCust,
    });
    if (custInsertErr && custInsertErr.code !== "23505") {
      console.error(`[gofit-pay] payment_customers insert warn: ${custInsertErr.code}`);
    }
  }

  const externalRef = `gofit:rcv:${receivableId}`;
  let asaasPayment: AsaasPayment;
  try {
    asaasPayment = await AsaasService.createPayment(subAccountApiKey, {
      customer: providerCustomerId, billingType: billingType as "PIX" | "BOLETO" | "CREDIT_CARD",
      amount, dueDate: dueDateFormatted,
      description: receivable.descricao
        ? String(receivable.descricao).substring(0, 200)
        : `Mensalidade GoFit #${receivableId.substring(0, 8)}`,
      externalReference: externalRef,
    });
  } catch (e) {
    if (e instanceof AsaasApiError) {
      const { message } = sanitizeError(e);
      console.error(`[gofit-pay] createPayment HTTP ${e.httpStatus} code=${e.code}`);
      return err(message, "ASAAS_PAYMENT_ERROR", 502);
    }
    throw e;
  }

  let pixQrCode: AsaasPixQrCode | null = null;
  if (billingType === "PIX") {
    try {
      pixQrCode = await AsaasService.getPixQrCode(subAccountApiKey, asaasPayment.id);
    } catch (e) {
      console.error(`[gofit-pay] getPixQrCode warn: ${(e as Error)?.name ?? "Error"}`);
    }
  }

  const now = new Date().toISOString();
  const { data: savedCharge, error: chargeErr } = await db.from("payment_charges").insert({
    contractor_id: contractorId, student_id: studentId,
    student_contract_id: receivable.student_contract_id ?? null,
    receivable_id: receivableId, provider: "asaas",
    provider_charge_id: asaasPayment.id, billing_type: billingType,
    amount, value: amount, due_date: dueDateFormatted, status: asaasPayment.status,
    invoice_url: asaasPayment.invoiceUrl ?? null,
    bank_slip_url: asaasPayment.bankSlipUrl ?? null,
    pix_qr_code: pixQrCode?.encodedImage ?? null,
    pix_copy_paste: pixQrCode?.payload ?? null,
    payment_url: asaasPayment.invoiceUrl ?? null,
    external_reference: externalRef,
    provider_environment: chargeEnv,
    raw_response_json: sanitizePaymentForStorage(asaasPayment),
    created_at: now, updated_at: now,
  }).select("id").single();

  if (chargeErr) {
    if (chargeErr.code === "23505") {
      const { data: recovered } = await db.from("payment_charges")
        .select("id, provider_charge_id, billing_type, status, invoice_url, bank_slip_url, pix_qr_code, pix_copy_paste")
        .eq("receivable_id", receivableId).eq("provider", "asaas").maybeSingle();
      return json({ success: true, data: { charge_id: recovered?.id ?? null, provider_charge_id: recovered?.provider_charge_id ?? asaasPayment.id, billing_type: billingType, status: recovered?.status ?? asaasPayment.status, amount, due_date: dueDateFormatted, invoice_url: recovered?.invoice_url ?? asaasPayment.invoiceUrl ?? null, bank_slip_url: recovered?.bank_slip_url ?? asaasPayment.bankSlipUrl ?? null, pix_qr_code: recovered?.pix_qr_code ?? pixQrCode?.encodedImage ?? null, pix_copy_paste: recovered?.pix_copy_paste ?? pixQrCode?.payload ?? null, already_existed: true, message: "Cobrança já existente (conflito de concorrência)." } });
    }
    const safeMsg = chargeErr.message.substring(0, 100).replace(/\s+/g, " ");
    console.error(`[gofit-pay] payment_charges insert error: code=${chargeErr.code} ${safeMsg}`);
    return err("Falha ao salvar cobrança. Cobrança foi criada no Asaas.", "CHARGE_SAVE_ERROR", 500);
  }

  await db.from("receivables").update({
    asaas_payment_id: asaasPayment.id, asaas_customer_id: providerCustomerId,
    asaas_payment_url: asaasPayment.invoiceUrl ?? null,
    gateway_status: asaasPayment.status, gateway_provider: "asaas",
  }).eq("id", receivableId);

  return json({
    success: true,
    data: {
      charge_id: savedCharge.id, provider_charge_id: asaasPayment.id,
      billing_type: billingType, status: asaasPayment.status, amount,
      due_date: dueDateFormatted,
      invoice_url: asaasPayment.invoiceUrl ?? null,
      bank_slip_url: asaasPayment.bankSlipUrl ?? null,
      pix_qr_code: pixQrCode?.encodedImage ?? null,
      pix_copy_paste: pixQrCode?.payload ?? null,
      already_existed: false,
      message: billingType === "PIX"
        ? "Cobrança Pix criada com sucesso."
        : billingType === "BOLETO"
        ? "Cobrança Boleto criada com sucesso."
        : "Cobrança cartão de crédito criada com sucesso.",
    },
  });
}

// ─── Fase 10 — Recorrência controlada ────────────────────────────────────────

const RECURRING_ALLOWED_STATUSES = ["pendente", "atrasado", "aguardando"] as const;
const MAX_RECURRING_BATCH = 20;

/* ── Fase 12: régua de cobrança e inadimplência ───────────────────── */
async function handleGetCollectionOverview(
  body: Record<string, unknown>,
  contractorId: string
): Promise<Response> {
  const db     = serviceClient();
  const today  = new Date().toISOString().split("T")[0];

  const studentId   = typeof body.student_id   === "string"  ? body.student_id   : undefined;
  const hasCharge   = typeof body.has_charge   === "boolean" ? body.has_charge   : undefined;
  const billingType = typeof body.billing_type === "string"  ? body.billing_type : undefined;
  const delayBand   = typeof body.delay_band   === "string"  ? body.delay_band   : undefined;
  const limitRows   = typeof body.limit        === "number"  ? Math.min(body.limit as number, 300) : 150;

  type RawRcv = {
    id: string; student_id: string|null; student_contract_id: string|null;
    descricao: string|null; valor: string|number; vencimento: string;
    status: string; asaas_payment_id: string|null; gateway_status: string|null;
    students: { nome_completo: string; email: string|null } | null;
  };
  type RawCharge = {
    id: string; receivable_id: string|null; provider_charge_id: string; status: string; billing_type: string;
    invoice_url: string|null; bank_slip_url: string|null;
    pix_copy_paste: string|null; pix_qr_code: string|null; created_at: string;
  };

  // Step 1: receivables with student join (FK exists: receivables.student_id → students.id)
  let rcvQuery = db
    .from("receivables")
    .select("id,student_id,student_contract_id,descricao,valor,vencimento,status,asaas_payment_id,gateway_status,students(nome_completo,email)")
    .eq("contractor_id", contractorId)
    .not("status", "in", '("pago","cancelado")')
    .lt("vencimento", today)
    .gt("valor", 0)
    .order("vencimento", { ascending: true })
    .limit(limitRows);

  if (studentId) rcvQuery = rcvQuery.eq("student_id", studentId);

  const { data: rawItems, error } = await rcvQuery;
  if (error) {
    console.error(`[gofit-pay] get_collection_overview rcv error: ${error.message}`);
    throw new GoFitPayBusinessError(error.message, "DB_ERROR");
  }

  const rcvList = (rawItems ?? []) as RawRcv[];
  const rcvIds  = rcvList.map(r => r.id);

  // Step 2: payment_charges for those receivables (separate query — no FK defined)
  let chargeMap: Map<string, RawCharge[]> = new Map();
  if (rcvIds.length > 0) {
    const { data: rawCharges } = await db
      .from("payment_charges")
      .select("id,receivable_id,provider_charge_id,status,billing_type,invoice_url,bank_slip_url,pix_copy_paste,pix_qr_code,created_at")
      .in("receivable_id", rcvIds)
      .neq("status", "CANCELLED");
    for (const c of (rawCharges ?? []) as RawCharge[]) {
      if (!c.receivable_id) continue;
      if (!chargeMap.has(c.receivable_id)) chargeMap.set(c.receivable_id, []);
      chargeMap.get(c.receivable_id)!.push(c);
    }
  }

  const todayMs = new Date(today + "T00:00:00").getTime();

  const allItems = rcvList.map(item => {
    const vencMs = new Date(item.vencimento + "T00:00:00").getTime();
    const dias   = Math.floor((todayMs - vencMs) / 86_400_000);

    const charges = chargeMap.get(item.id) ?? [];
    const activeCharge = charges
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;

    const studentNode = item.students as { nome_completo: string; email: string|null } | null;

    return {
      receivable_id:       item.id,
      student_id:          item.student_id,
      student_nome:        studentNode?.nome_completo ?? null,
      student_email:       studentNode?.email ?? null,
      student_contract_id: item.student_contract_id,
      descricao:           item.descricao,
      valor:               Number(item.valor),
      vencimento:          item.vencimento,
      dias_em_atraso:      dias,
      rcv_status:          item.status,
      charge_id:           activeCharge?.id ?? null,
      provider_charge_id:  activeCharge?.provider_charge_id ?? null,
      charge_status:       activeCharge?.status ?? null,
      billing_type:        activeCharge?.billing_type ?? null,
      invoice_url:         activeCharge?.invoice_url ?? null,
      bank_slip_url:       activeCharge?.bank_slip_url ?? null,
      pix_copy_paste:      activeCharge?.pix_copy_paste ?? null,
      pix_qr_code:         activeCharge?.pix_qr_code ?? null,
    };
  });

  // Client-side filters (data set per company is small)
  let filtered = allItems;
  if (typeof hasCharge === "boolean")
    filtered = filtered.filter(i => hasCharge ? i.charge_id !== null : i.charge_id === null);
  if (billingType)
    filtered = filtered.filter(i => i.billing_type === billingType);
  if (delayBand) {
    filtered = filtered.filter(i => {
      const d = i.dias_em_atraso;
      if (delayBand === "0")     return d === 0;
      if (delayBand === "1-3")   return d >= 1  && d <= 3;
      if (delayBand === "4-7")   return d >= 4  && d <= 7;
      if (delayBand === "8-15")  return d >= 8  && d <= 15;
      if (delayBand === "16-30") return d >= 16 && d <= 30;
      if (delayBand === "30+")   return d > 30;
      return true;
    });
  }

  const summary = {
    total_amount_open:  allItems.reduce((s, i) => s + i.valor, 0),
    students_count:     new Set(allItems.filter(i => i.student_id).map(i => i.student_id)).size,
    overdue_count:      allItems.length,
    overdue_30_plus:    allItems.filter(i => i.dias_em_atraso > 30).length,
    without_charge:     allItems.filter(i => i.charge_id === null).length,
    with_active_charge: allItems.filter(i => i.charge_id !== null).length,
  };

  console.log(`[gofit-pay] get_collection_overview: total=${allItems.length} filtered=${filtered.length}`);
  return json({ success: true, data: { summary, items: filtered, total: allItems.length } });
}

async function handleAddCollectionNote(
  body: Record<string, unknown>,
  contractorId: string,
  userId: string
): Promise<Response> {
  const receivableId = typeof body.receivable_id === "string" ? body.receivable_id : null;
  const note         = typeof body.note          === "string" ? body.note.trim()   : null;

  if (!receivableId || !note) return err("receivable_id e note são obrigatórios.", "MISSING_FIELDS");
  if (note.length > 500)      return err("Observação muito longa (máx. 500 caracteres).", "NOTE_TOO_LONG");

  const db = serviceClient();

  const { data: rcv } = await db
    .from("receivables")
    .select("id,student_id")
    .eq("id", receivableId)
    .eq("contractor_id", contractorId)
    .maybeSingle();

  if (!rcv) return err("Receivable não encontrada ou sem permissão.", "NOT_FOUND", 404);

  const { data: saved, error } = await db
    .from("gofit_pay_collection_notes")
    .insert({ contractor_id: contractorId, receivable_id: receivableId, student_id: rcv.student_id, note, created_by: userId })
    .select("id,note,created_at")
    .single();

  if (error) {
    console.error(`[gofit-pay] add_collection_note error: ${error.message}`);
    throw new GoFitPayBusinessError(error.message, "DB_ERROR");
  }

  return json({ success: true, data: { note: saved } });
}

async function handleGetCollectionNotes(
  body: Record<string, unknown>,
  contractorId: string
): Promise<Response> {
  const receivableId = typeof body.receivable_id === "string" ? body.receivable_id : null;
  if (!receivableId) return err("receivable_id é obrigatório.", "MISSING_FIELDS");

  const db = serviceClient();

  const { data: notes, error } = await db
    .from("gofit_pay_collection_notes")
    .select("id,note,created_at,created_by")
    .eq("contractor_id", contractorId)
    .eq("receivable_id", receivableId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error(`[gofit-pay] get_collection_notes error: ${error.message}`);
    throw new GoFitPayBusinessError(error.message, "DB_ERROR");
  }

  return json({ success: true, data: { notes: notes ?? [] } });
}

/* ── Fase 11: taxas GoFit Pay ─────────────────────────────────────── */
async function handleGetFees(contractorId: string): Promise<Response> {
  const db = serviceClient();

  const FEE_FIELDS = "id,contractor_id,billing_type,label,fixed_fee,percentage_fee,installment_min,installment_max,settlement_days,description,is_demo,sort_order";

  // Taxas específicas da empresa têm prioridade sobre as globais
  const { data: specific } = await db
    .from("gofit_pay_fees")
    .select(FEE_FIELDS)
    .eq("contractor_id", contractorId)
    .eq("is_active", true)
    .order("sort_order");

  if (specific && specific.length > 0) {
    console.log(`[gofit-pay] get_fees: contractor-specific fees count=${specific.length}`);
    return json({ success: true, data: { fees: specific, source: "contractor" } });
  }

  const { data: globalFees } = await db
    .from("gofit_pay_fees")
    .select(FEE_FIELDS)
    .is("contractor_id", null)
    .eq("is_active", true)
    .order("sort_order");

  console.log(`[gofit-pay] get_fees: global fees count=${globalFees?.length ?? 0}`);
  return json({ success: true, data: { fees: globalFees ?? [], source: "global" } });
}

async function handlePreviewRecurringCharges(
  body: Record<string, unknown>,
  contractorId: string
): Promise<Response> {
  const studentId         = typeof body.student_id          === "string" ? body.student_id          : null;
  const studentContractId = typeof body.student_contract_id === "string" ? body.student_contract_id : null;
  const billingType       = typeof body.billing_type        === "string" ? body.billing_type.toUpperCase() : null;
  const limit             = typeof body.limit               === "number" ? Math.min(body.limit, MAX_RECURRING_BATCH) : MAX_RECURRING_BATCH;

  if (!billingType) return err("billing_type obrigatório.", "MISSING_BILLING_TYPE");
  const ALLOWED = ["PIX", "BOLETO", "CREDIT_CARD"] as const;
  if (!ALLOWED.includes(billingType as typeof ALLOWED[number])) {
    return err("billing_type inválido. Use PIX, BOLETO ou CREDIT_CARD.", "INVALID_BILLING_TYPE");
  }

  const db = serviceClient();
  let query = db
    .from("receivables")
    .select("id, student_id, student_nome, descricao, valor, vencimento, status, student_contract_id, asaas_payment_id, gateway_provider")
    .eq("contractor_id", contractorId)
    .in("status", [...RECURRING_ALLOWED_STATUSES])
    .gt("valor", 0)
    .not("student_id", "is", null)
    .order("vencimento", { ascending: true })
    .limit(limit * 3); // busca mais para filtrar depois

  if (studentId)         query = query.eq("student_id",          studentId);
  if (studentContractId) query = query.eq("student_contract_id", studentContractId);

  const { data: receivables, error: rcvErr } = await query;
  if (rcvErr) return err("Falha ao buscar receivables.", "QUERY_ERROR", 500);

  // Para cada receivable, verifica se já tem cobrança ativa
  const today = new Date().toISOString().substring(0, 10);

  const items: Record<string, unknown>[] = [];
  for (const rcv of (receivables ?? [])) {
    if (items.length >= limit) break;

    let eligible = true;
    let reason: string | null = null;
    let existingChargeId: string | null = null;
    let existingChargeStatus: string | null = null;

    // Cobrança ativa?
    const { data: existingCharge } = await db
      .from("payment_charges")
      .select("id, status, billing_type, provider_charge_id")
      .eq("receivable_id", rcv.id)
      .eq("provider", "asaas")
      .not("status", "in", '("CANCELLED")')
      .maybeSingle();

    if (existingCharge) {
      eligible = false;
      reason = "JÁ_POSSUI_COBRANÇA_ATIVA";
      existingChargeId = existingCharge.id;
      existingChargeStatus = existingCharge.status;
    }

    const dueDateAdj = (rcv.vencimento < today) ? today : rcv.vencimento;

    items.push({
      receivable_id:          rcv.id,
      student_id:             rcv.student_id,
      student_nome:           rcv.student_nome,
      student_contract_id:    rcv.student_contract_id,
      descricao:              rcv.descricao,
      valor:                  Number(rcv.valor),
      vencimento:             rcv.vencimento,
      vencimento_ajustado:    dueDateAdj,
      vencimento_era_passado: rcv.vencimento < today,
      status:                 rcv.status,
      eligible,
      reason,
      existing_charge_id:     existingChargeId,
      existing_charge_status: existingChargeStatus,
    });
  }

  const eligibleCount = items.filter(i => i.eligible).length;

  return json({
    success: true,
    data: {
      total:          items.length,
      eligible_count: eligibleCount,
      billing_type:   billingType,
      items,
    },
  });
}

async function handleCreateRecurringCharges(
  body: Record<string, unknown>,
  contractorId: string,
  secrets: SecretsValidation
): Promise<Response> {
  if (!secrets.valid) return err("Configuração incompleta.", "CONFIG_INCOMPLETE", 503);

  const rawIds      = Array.isArray(body.receivable_ids) ? body.receivable_ids as unknown[] : null;
  const billingType = typeof body.billing_type === "string" ? body.billing_type.toUpperCase() : null;

  if (!rawIds || rawIds.length === 0) return err("receivable_ids obrigatório e não pode ser vazio.", "MISSING_RECEIVABLE_IDS");
  if (rawIds.length > MAX_RECURRING_BATCH) return err(`Máximo de ${MAX_RECURRING_BATCH} receivables por lote.`, "BATCH_TOO_LARGE");
  if (!billingType) return err("billing_type obrigatório.", "MISSING_BILLING_TYPE");
  const ALLOWED = ["PIX", "BOLETO", "CREDIT_CARD"] as const;
  if (!ALLOWED.includes(billingType as typeof ALLOWED[number])) {
    return err("billing_type inválido. Use PIX, BOLETO ou CREDIT_CARD.", "INVALID_BILLING_TYPE");
  }

  const receivableIds = rawIds.filter(id => typeof id === "string") as string[];
  if (receivableIds.length === 0) return err("receivable_ids deve conter strings UUID.", "INVALID_RECEIVABLE_IDS");

  const db = serviceClient();

  // Resolve ambiente — produção só se contractor estiver explicitamente autorizado
  const { env: batchEnv, productionEnabled, allowedRealCharges } = await resolveEnvironment(db, contractorId);
  if (batchEnv === "production" && (!productionEnabled || !allowedRealCharges)) {
    return err("Cobranças em produção não autorizadas para esta empresa.", "PRODUCTION_NOT_ALLOWED", 403);
  }

  // Valida GoFit Pay ativo e obtém chave encriptada uma vez (fora do loop)
  let subAccInfo: { account_id: string; provider_api_key_encrypted: string; provider_account_id: string };
  try {
    subAccInfo = await assertGoFitPayActive(db, contractorId, batchEnv);
  } catch (e) {
    if (e instanceof GoFitPayBusinessError) return err(e.message, e.code, e.httpStatus);
    throw e;
  }

  let subAccountApiKey: string;
  try {
    subAccountApiKey = await decryptSubAccountKey(subAccInfo.provider_api_key_encrypted);
  } catch (e) {
    console.error(`[gofit-pay] Decrypt error: ${(e as Error)?.name ?? "Error"}`);
    return err("Falha de configuração interna. Reative o GoFit Pay.", "DECRYPT_ERROR", 503);
  }

  const today = new Date().toISOString().substring(0, 10);
  const now   = new Date().toISOString();

  // Cache de customers criados neste lote para evitar chamadas redundantes ao Asaas
  const customerCache: Record<string, string> = {};

  type ItemResult = {
    receivable_id:      string;
    status:             "created" | "already_exists" | "skipped" | "failed";
    provider_charge_id: string | null;
    charge_id:          string | null;
    billing_type:       string | null;
    reason:             string | null;
  };

  const items: ItemResult[] = [];
  let created = 0, alreadyExists = 0, skipped = 0, failed = 0;

  for (const receivableId of receivableIds) {
    // 1. Busca receivable — valida ownership via eq(contractor_id)
    const { data: rcv, error: rcvErr } = await db
      .from("receivables")
      .select("id, contractor_id, student_id, student_contract_id, valor, vencimento, descricao, status, asaas_payment_id, gateway_provider")
      .eq("id", receivableId)
      .eq("contractor_id", contractorId)
      .maybeSingle();

    if (rcvErr || !rcv) {
      items.push({ receivable_id: receivableId, status: "skipped", provider_charge_id: null, charge_id: null, billing_type: null, reason: "RECEIVABLE_NOT_FOUND" });
      skipped++;
      continue;
    }

    // 2. Valida status
    if (!RECURRING_ALLOWED_STATUSES.includes(rcv.status as typeof RECURRING_ALLOWED_STATUSES[number])) {
      const reason = rcv.status === "pago" ? "RECEIVABLE_ALREADY_PAID" : rcv.status === "cancelado" ? "RECEIVABLE_CANCELLED" : "INVALID_RECEIVABLE_STATUS";
      items.push({ receivable_id: receivableId, status: "skipped", provider_charge_id: null, charge_id: null, billing_type: null, reason });
      skipped++;
      continue;
    }

    const amount = Number(rcv.valor ?? 0);
    if (!amount || amount <= 0) {
      items.push({ receivable_id: receivableId, status: "skipped", provider_charge_id: null, charge_id: null, billing_type: null, reason: "INVALID_AMOUNT" });
      skipped++;
      continue;
    }

    // 3. Idempotência — cobrança ativa existente?
    const { data: existingCharge } = await db
      .from("payment_charges")
      .select("id, provider_charge_id, billing_type, status")
      .eq("receivable_id", receivableId)
      .eq("provider", "asaas")
      .not("status", "in", '("CANCELLED")')
      .maybeSingle();

    if (existingCharge) {
      items.push({ receivable_id: receivableId, status: "already_exists", provider_charge_id: existingCharge.provider_charge_id, charge_id: existingCharge.id, billing_type: existingCharge.billing_type, reason: null });
      alreadyExists++;
      continue;
    }

    // Também checar por asaas_payment_id na receivable
    if (rcv.asaas_payment_id && rcv.gateway_provider === "asaas") {
      items.push({ receivable_id: receivableId, status: "already_exists", provider_charge_id: rcv.asaas_payment_id, charge_id: null, billing_type: null, reason: null });
      alreadyExists++;
      continue;
    }

    const studentId = rcv.student_id;
    if (!studentId) {
      items.push({ receivable_id: receivableId, status: "skipped", provider_charge_id: null, charge_id: null, billing_type: null, reason: "MISSING_STUDENT_ID" });
      skipped++;
      continue;
    }

    // 4. Customer (com cache por student_id para este lote)
    let providerCustomerId: string;
    if (customerCache[studentId]) {
      providerCustomerId = customerCache[studentId];
    } else {
      const { data: existingCust } = await db.from("payment_customers")
        .select("id, provider_customer_id")
        .eq("contractor_id", contractorId).eq("student_id", studentId).eq("provider", "asaas").maybeSingle();

      if (existingCust?.provider_customer_id) {
        providerCustomerId = existingCust.provider_customer_id;
        customerCache[studentId] = providerCustomerId;
      } else {
        const { data: student } = await db.from("students").select("id, nome_completo, cpf, email, telefone")
          .eq("id", studentId).eq("contractor_id", contractorId).maybeSingle();

        if (!student) {
          items.push({ receivable_id: receivableId, status: "skipped", provider_charge_id: null, charge_id: null, billing_type: null, reason: "STUDENT_NOT_FOUND" });
          skipped++;
          continue;
        }

        try {
          const asaasCustomer = await AsaasService.upsertCustomer(subAccountApiKey, {
            name: String(student.nome_completo), cpfCnpj: student.cpf ?? undefined,
            email: student.email ?? undefined, phone: student.telefone ?? undefined,
            externalReference: `gofit:stu:${studentId}`,
          });
          providerCustomerId = asaasCustomer.id;
          customerCache[studentId] = providerCustomerId;
          // Salva customer (ignora conflito de unicidade)
          await db.from("payment_customers").insert({
            contractor_id: contractorId, student_id: studentId, client_id: studentId,
            provider: "asaas", provider_customer_id: asaasCustomer.id,
            name: String(student.nome_completo), email: student.email ?? null,
            cpf_cnpj: student.cpf ?? null, phone: student.telefone ?? null,
            synced_at: now, created_at: now, updated_at: now,
          }).then(() => {}).catch(() => {});
        } catch (e) {
          const name = (e as Error)?.name ?? "Error";
          console.error(`[gofit-pay] batch upsertCustomer: ${name} rcv=${receivableId}`);
          items.push({ receivable_id: receivableId, status: "failed", provider_charge_id: null, charge_id: null, billing_type: null, reason: `CUSTOMER_ERROR:${name}` });
          failed++;
          continue;
        }
      }
    }

    // 5. Due date — ajusta para hoje se vencimento passado
    const rawDate         = String(rcv.vencimento ?? "").substring(0, 10);
    const dueDateFormatted = rawDate && rawDate >= today ? rawDate : today;

    // 6. Cria pagamento no Asaas
    const externalRef = `gofit:rcv:${receivableId}`;
    let asaasPayment: AsaasPayment;
    try {
      asaasPayment = await AsaasService.createPayment(subAccountApiKey, {
        customer: providerCustomerId,
        billingType: billingType as "PIX" | "BOLETO" | "CREDIT_CARD",
        amount,
        dueDate: dueDateFormatted,
        description: rcv.descricao
          ? String(rcv.descricao).substring(0, 200)
          : `Mensalidade GoFit #${receivableId.substring(0, 8)}`,
        externalReference: externalRef,
      });
    } catch (e) {
      const name = (e as Error)?.name ?? "Error";
      const code = e instanceof AsaasApiError ? String(e.code) : name;
      console.error(`[gofit-pay] batch createPayment: ${name} rcv=${receivableId}`);
      items.push({ receivable_id: receivableId, status: "failed", provider_charge_id: null, charge_id: null, billing_type: null, reason: `ASAAS_ERROR:${code}` });
      failed++;
      continue;
    }

    // 7. QR code Pix (non-fatal)
    let pixQrCode: AsaasPixQrCode | null = null;
    if (billingType === "PIX") {
      try {
        pixQrCode = await AsaasService.getPixQrCode(subAccountApiKey, asaasPayment.id);
      } catch { /* non-fatal */ }
    }

    // 8. Salva payment_charge
    const { data: savedCharge, error: chargeErr } = await db.from("payment_charges").insert({
      contractor_id: contractorId, student_id: studentId,
      student_contract_id: rcv.student_contract_id ?? null,
      receivable_id: receivableId, provider: "asaas",
      provider_charge_id: asaasPayment.id, billing_type: billingType,
      amount, value: amount, due_date: dueDateFormatted, status: asaasPayment.status,
      invoice_url: asaasPayment.invoiceUrl ?? null,
      bank_slip_url: asaasPayment.bankSlipUrl ?? null,
      pix_qr_code: pixQrCode?.encodedImage ?? null,
      pix_copy_paste: pixQrCode?.payload ?? null,
      payment_url: asaasPayment.invoiceUrl ?? null,
      external_reference: externalRef,
      provider_environment: batchEnv,
      raw_response_json: sanitizePaymentForStorage(asaasPayment),
      created_at: now, updated_at: now,
    }).select("id").single();

    if (chargeErr) {
      // Conflito de unicidade — já existe (concorrência)
      if (chargeErr.code === "23505") {
        const { data: recovered } = await db.from("payment_charges")
          .select("id, provider_charge_id, billing_type")
          .eq("receivable_id", receivableId).eq("provider", "asaas").maybeSingle();
        items.push({ receivable_id: receivableId, status: "already_exists", provider_charge_id: recovered?.provider_charge_id ?? asaasPayment.id, charge_id: recovered?.id ?? null, billing_type: recovered?.billing_type ?? billingType, reason: null });
        alreadyExists++;
        continue;
      }
      const safeMsg = chargeErr.message.substring(0, 80).replace(/\s+/g, " ");
      console.error(`[gofit-pay] batch payment_charges insert: code=${chargeErr.code} ${safeMsg}`);
      items.push({ receivable_id: receivableId, status: "failed", provider_charge_id: asaasPayment.id, charge_id: null, billing_type: billingType, reason: `SAVE_ERROR:${chargeErr.code}` });
      failed++;
      continue;
    }

    // 9. Atualiza gateway fields na receivable
    await db.from("receivables").update({
      asaas_payment_id:  asaasPayment.id,
      asaas_customer_id: providerCustomerId,
      asaas_payment_url: asaasPayment.invoiceUrl ?? null,
      gateway_status:    asaasPayment.status,
      gateway_provider:  "asaas",
    }).eq("id", receivableId);

    items.push({
      receivable_id:      receivableId,
      status:             "created",
      provider_charge_id: asaasPayment.id,
      charge_id:          savedCharge.id,
      billing_type:       billingType,
      reason:             null,
    });
    created++;
  }

  console.log(
    `[gofit-pay] create_recurring_charges: contractor=${contractorId} ` +
    `requested=${receivableIds.length} created=${created} already=${alreadyExists} ` +
    `skipped=${skipped} failed=${failed} billing=${billingType}`
  );

  return json({
    success: true,
    data: {
      summary: {
        requested:     receivableIds.length,
        created,
        already_exists: alreadyExists,
        skipped,
        failed,
      },
      billing_type: billingType,
      items,
    },
  });
}

async function handleGetCharge(body: Record<string, unknown>, contractorId: string): Promise<Response> {
  const chargeId = typeof body.charge_id === "string" ? body.charge_id : null;
  if (!chargeId) return err("charge_id obrigatório.", "MISSING_CHARGE_ID");
  const db = serviceClient();
  const { data: charge, error } = await db.from("payment_charges")
    .select("id, contractor_id, student_id, receivable_id, provider, provider_charge_id, billing_type, amount, value, due_date, status, invoice_url, bank_slip_url, pix_qr_code, pix_copy_paste, payment_url, external_reference, paid_at, confirmed_at, refunded_at, cancelled_at, created_at, updated_at")
    .eq("id", chargeId).eq("contractor_id", contractorId).maybeSingle();
  if (error || !charge) return err("Cobrança não encontrada.", "CHARGE_NOT_FOUND", 404);
  return json({ success: true, data: charge });
}

async function handleListCharges(body: Record<string, unknown>, contractorId: string): Promise<Response> {
  const db = serviceClient();
  let query = db.from("payment_charges")
    .select("id, student_id, receivable_id, provider, provider_charge_id, billing_type, amount, value, due_date, status, invoice_url, bank_slip_url, pix_qr_code, pix_copy_paste, paid_at, confirmed_at, cancelled_at, created_at, updated_at")
    .eq("contractor_id", contractorId)
    .order("created_at", { ascending: false });
  if (typeof body.student_id    === "string") query = query.eq("student_id",    body.student_id);
  if (typeof body.receivable_id === "string") query = query.eq("receivable_id", body.receivable_id);
  if (typeof body.status        === "string") query = query.eq("status",        body.status);
  const limit  = typeof body.limit  === "number" ? Math.min(body.limit, 100) : 50;
  const offset = typeof body.offset === "number" ? body.offset : 0;
  query = query.range(offset, offset + limit - 1);
  const { data, error } = await query;
  if (error) {
    console.error(`[gofit-pay] list_charges error: ${error.message}`);
    return err("Falha ao listar cobranças.", "LIST_CHARGES_ERROR", 500);
  }
  return json({ success: true, data: data ?? [] });
}

// ─── Fase 7.1: sync_charge_status ────────────────────────────────────────────

async function handleSyncChargeStatus(
  body: Record<string, unknown>,
  contractorId: string,
  secrets: SecretsValidation
): Promise<Response> {
  if (!secrets.valid) return err("Configuração incompleta.", "CONFIG_INCOMPLETE", 503);

  const chargeId = typeof body.charge_id === "string" ? body.charge_id : null;
  if (!chargeId) return err("charge_id obrigatório.", "MISSING_CHARGE_ID");

  const db = serviceClient();

  const { data: charge, error: chgErr } = await db
    .from("payment_charges")
    .select("id, contractor_id, receivable_id, provider_charge_id, billing_type, amount, status, pix_qr_code, pix_copy_paste, provider_environment")
    .eq("id", chargeId)
    .eq("contractor_id", contractorId)
    .maybeSingle();

  if (chgErr || !charge) return err("Cobrança não encontrada.", "CHARGE_NOT_FOUND", 404);
  if (!charge.provider_charge_id) return err("Cobrança sem provider_charge_id.", "NO_PROVIDER_ID", 422);

  const syncEnv = ((charge.provider_environment ?? "sandbox") as "sandbox" | "production");

  let subAccInfo: { account_id: string; provider_api_key_encrypted: string; provider_account_id: string };
  try {
    subAccInfo = await assertGoFitPayActive(db, contractorId, syncEnv);
  } catch (e) {
    if (e instanceof GoFitPayBusinessError) return err(e.message, e.code, e.httpStatus);
    throw e;
  }

  let subAccountApiKey: string;
  try {
    subAccountApiKey = await decryptSubAccountKey(subAccInfo.provider_api_key_encrypted);
  } catch {
    return err("Falha de configuração interna. Reative o GoFit Pay.", "DECRYPT_ERROR", 503);
  }

  let asaasPayment: AsaasPayment;
  try {
    asaasPayment = await AsaasService.getPayment(subAccountApiKey, charge.provider_charge_id);
  } catch (e) {
    if (e instanceof AsaasApiError) {
      const { message } = sanitizeError(e);
      return err(message, "ASAAS_FETCH_ERROR", 502);
    }
    throw e;
  }

  const now = new Date().toISOString();

  // Tenta buscar QR code Pix se estiver faltando
  let pixQrCode: AsaasPixQrCode | null = null;
  if (charge.billing_type === "PIX" && !charge.pix_qr_code && asaasPayment.status !== "RECEIVED" && asaasPayment.status !== "CANCELLED") {
    try {
      pixQrCode = await AsaasService.getPixQrCode(subAccountApiKey, charge.provider_charge_id);
    } catch {
      // QR code pode não estar disponível ainda — não bloqueia o sync
    }
  }

  const chargeUpdate: Record<string, unknown> = {
    status:     asaasPayment.status,
    updated_at: now,
    invoice_url: asaasPayment.invoiceUrl ?? null,
    bank_slip_url: asaasPayment.bankSlipUrl ?? null,
  };
  if (pixQrCode?.encodedImage) chargeUpdate.pix_qr_code   = pixQrCode.encodedImage;
  if (pixQrCode?.payload)      chargeUpdate.pix_copy_paste = pixQrCode.payload;
  if (asaasPayment.status === "RECEIVED" || asaasPayment.status === "CONFIRMED") chargeUpdate.paid_at = now;
  if (asaasPayment.status === "CANCELLED") chargeUpdate.cancelled_at = now;

  await db.from("payment_charges").update(chargeUpdate).eq("id", chargeId);

  // Atualiza receivable.gateway_status + baixa automática se RECEIVED
  let receivableUpdated = false;
  if (charge.receivable_id) {
    const { data: receivable } = await db
      .from("receivables")
      .select("id, status, pago_em")
      .eq("id", charge.receivable_id)
      .maybeSingle();

    if (receivable) {
      const baseRcv: Record<string, unknown> = {
        gateway_status:   asaasPayment.status,
        gateway_provider: "asaas",
        updated_at:       now,
      };

      if (asaasPayment.status === "RECEIVED" && receivable.status !== "pago") {
        const payDate = extractPaymentDate(asaasPayment as unknown as Record<string, unknown>);
        await db.from("receivables").update({
          ...baseRcv,
          status:           "pago",
          pago_em:          payDate ? `${payDate}T12:00:00Z` : now,
          hora_recebimento: now.substring(11, 19),
          forma_pagamento:  mapBillingTypeToFormaPagamento(charge.billing_type),
          valor_pago:       asaasPayment.value ?? charge.amount,
        }).eq("id", charge.receivable_id);
        receivableUpdated = true;
        console.log(`[gofit-pay] sync_charge_status: baixa automática rcv=${charge.receivable_id}`);
      } else {
        await db.from("receivables").update(baseRcv).eq("id", charge.receivable_id);
      }
    }
  }

  console.log(`[gofit-pay] sync_charge_status: charge=${chargeId} status=${asaasPayment.status}`);

  return json({
    success: true,
    data: {
      charge_id:         chargeId,
      provider_charge_id: charge.provider_charge_id,
      status:            asaasPayment.status,
      invoice_url:       asaasPayment.invoiceUrl ?? null,
      bank_slip_url:     asaasPayment.bankSlipUrl ?? null,
      pix_qr_code:       pixQrCode?.encodedImage ?? (charge.pix_qr_code as string | null) ?? null,
      pix_copy_paste:    pixQrCode?.payload ?? (charge.pix_copy_paste as string | null) ?? null,
      receivable_updated: receivableUpdated,
      message:           `Status atualizado: ${asaasPayment.status}`,
    },
  });
}

// ─── Fase 7: process_webhook_event ───────────────────────────────────────────

async function handleProcessWebhookEvent(
  body: Record<string, unknown>,
  contractorId: string
): Promise<Response> {
  const eventId = typeof body.event_id === "string" ? body.event_id : null;
  if (!eventId) return err("event_id obrigatório.", "MISSING_EVENT_ID");

  const db = serviceClient();

  const { data: event, error } = await db
    .from("gofit_pay_webhook_events")
    .select("id, event_type, provider_payment_id, payload_json, contractor_id, receivable_id, processing_attempts, processed")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !event) return err("Evento não encontrado.", "EVENT_NOT_FOUND", 404);

  // Verificação de ownership: o evento deve pertencer ao contractor ou estar sem contractor resolvido
  if (event.contractor_id && event.contractor_id !== contractorId) {
    return err("Evento não pertence a esta empresa.", "EVENT_FORBIDDEN", 403);
  }

  if (event.processed) {
    return json({
      success: true,
      data: { already_processed: true, event_id: eventId, message: "Evento já foi processado." },
    });
  }

  const now = new Date().toISOString();
  try {
    const result = await processWebhookEvent(db, event as WebhookEventRow, now);
    return json({ success: true, data: { ...result, event_id: eventId } });
  } catch (e) {
    const { message, code } = sanitizeError(e);
    console.error(`[gofit-pay] process_webhook_event error: ${(e as Error)?.name ?? "Error"}`);
    return err(message, code, 500);
  }
}

// ─── Fase 7: process_pending_webhooks ────────────────────────────────────────

async function handleProcessPendingWebhooks(
  body: Record<string, unknown>,
  contractorId: string
): Promise<Response> {
  const limit = typeof body.limit === "number" ? Math.min(body.limit, 50) : 20;
  const db = serviceClient();

  // Busca eventos não processados que pertencem a este contractor
  // Inclui eventos com contractor_id null (não resolvidos ainda) — só processa os próprios
  const { data: events, error } = await db
    .from("gofit_pay_webhook_events")
    .select("id, event_type, provider_payment_id, payload_json, contractor_id, receivable_id, processing_attempts, processed")
    .eq("contractor_id", contractorId)
    .eq("processed", false)
    .lt("processing_attempts", 5)
    .order("received_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error(`[gofit-pay] process_pending_webhooks query error: ${error.message}`);
    return err("Falha ao buscar eventos pendentes.", "QUERY_ERROR", 500);
  }

  if (!events || events.length === 0) {
    return json({ success: true, data: { processed_count: 0, failed_count: 0, events: [], message: "Nenhum evento pendente encontrado." } });
  }

  const now = new Date().toISOString();
  const results: Array<{ event_id: string; event_type: string; result: string }> = [];
  let processedCount = 0;
  let failedCount    = 0;

  for (const event of events) {
    try {
      const result = await processWebhookEvent(db, event as WebhookEventRow, now);
      results.push({ event_id: event.id, event_type: event.event_type, result: result.message });
      if (result.processed) processedCount++; else failedCount++;
    } catch (e) {
      failedCount++;
      results.push({ event_id: event.id, event_type: event.event_type, result: `ERROR: ${(e as Error)?.name ?? "Error"}` });
      console.error(`[gofit-pay] process_pending_webhooks event ${event.id} error: ${(e as Error)?.name ?? "Error"}`);
    }
  }

  return json({
    success: true,
    data: {
      processed_count: processedCount,
      failed_count: failedCount,
      total: events.length,
      events: results,
    },
  });
}

// ─── Fase 8: cancel_charge ───────────────────────────────────────────────────

async function handleCancelCharge(
  body: Record<string, unknown>,
  contractorId: string,
  secrets: SecretsValidation
): Promise<Response> {
  if (!secrets.valid) return err("Configuração incompleta.", "CONFIG_INCOMPLETE", 503);

  const chargeId = typeof body.charge_id === "string" ? body.charge_id : null;
  if (!chargeId) return err("charge_id obrigatório.", "MISSING_CHARGE_ID");

  const db  = serviceClient();
  const now = new Date().toISOString();

  // Busca cobrança — verificação de ownership embutida via .eq("contractor_id", ...)
  const { data: charge, error: chgErr } = await db
    .from("payment_charges")
    .select("id, contractor_id, receivable_id, provider_charge_id, billing_type, amount, status, provider_environment")
    .eq("id", chargeId)
    .eq("contractor_id", contractorId)
    .maybeSingle();

  if (chgErr || !charge) return err("Cobrança não encontrada.", "CHARGE_NOT_FOUND", 404);
  if (!charge.provider_charge_id) return err("Cobrança sem provider_charge_id.", "NO_PROVIDER_ID", 422);

  // Idempotência — já cancelada?
  if (charge.status === "CANCELLED" || charge.status === "DELETED") {
    return json({
      success: true,
      data: {
        already_cancelled: true,
        charge_id:          chargeId,
        provider_charge_id: charge.provider_charge_id,
        message:            "Cobrança já está cancelada.",
      },
    });
  }

  // Status impeditivos no gateway
  const PAID_STATUSES = ["RECEIVED", "CONFIRMED"];
  const BLOCKED_STATUSES = ["REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"];
  if (PAID_STATUSES.includes(charge.status ?? "")) {
    return err(
      "Esta cobrança já foi paga e não pode ser cancelada. Para tratar devolução/estorno, use o fluxo financeiro apropriado em fase futura.",
      "CHARGE_ALREADY_PAID",
      409
    );
  }
  if (BLOCKED_STATUSES.includes(charge.status ?? "")) {
    return err(
      `Cobrança com status '${charge.status}' não pode ser cancelada nesta fase.`,
      "CHARGE_NOT_CANCELLABLE",
      409
    );
  }

  // Verifica receivable — não pode cancelar se financeiro já pago
  if (charge.receivable_id) {
    const { data: receivable } = await db
      .from("receivables")
      .select("id, status")
      .eq("id", charge.receivable_id)
      .eq("contractor_id", contractorId)
      .maybeSingle();

    if (receivable?.status === "pago") {
      return err(
        "Esta cobrança já foi paga e não pode ser cancelada. Para tratar devolução/estorno, use o fluxo financeiro apropriado em fase futura.",
        "RECEIVABLE_ALREADY_PAID",
        409
      );
    }
  }

  // Verifica GoFit Pay ativo + obtém chave da subconta
  const cancelEnv = ((charge.provider_environment ?? "sandbox") as "sandbox" | "production");
  let subAccInfo: { account_id: string; provider_api_key_encrypted: string; provider_account_id: string };
  try {
    subAccInfo = await assertGoFitPayActive(db, contractorId, cancelEnv);
  } catch (e) {
    if (e instanceof GoFitPayBusinessError) return err(e.message, e.code, e.httpStatus);
    throw e;
  }

  let subAccountApiKey: string;
  try {
    subAccountApiKey = await decryptSubAccountKey(subAccInfo.provider_api_key_encrypted);
  } catch {
    return err("Falha de configuração interna. Reative o GoFit Pay.", "DECRYPT_ERROR", 503);
  }

  const previousStatus = String(charge.status ?? "UNKNOWN");

  // Cancela no Asaas
  try {
    await AsaasService.cancelPayment(subAccountApiKey, charge.provider_charge_id);
  } catch (e) {
    if (e instanceof AsaasApiError) {
      // 404 no Asaas = cobrança não existe mais — prossegue para limpar o DB
      if (e.httpStatus !== 404) {
        const { message } = sanitizeError(e);
        console.error(`[gofit-pay] cancel_charge AsaasApiError HTTP ${e.httpStatus} code=${e.code}`);
        return err(message, "ASAAS_CANCEL_ERROR", 502);
      }
      console.log(`[gofit-pay] cancel_charge: provider_charge_id=${charge.provider_charge_id} não encontrado no Asaas (404) — prosseguindo com atualização local.`);
    } else {
      throw e;
    }
  }

  // Atualiza payment_charges
  await db.from("payment_charges").update({
    status:            "CANCELLED",
    cancelled_at:      now,
    updated_at:        now,
    raw_response_json: { cancelled: true, cancelled_at: now, previous_status: previousStatus },
  }).eq("id", chargeId);

  // Atualiza receivable — apenas campos de gateway, NÃO altera status financeiro
  if (charge.receivable_id) {
    await db.from("receivables").update({
      gateway_status:    "CANCELLED",
      gateway_provider:  "asaas",
      asaas_payment_id:  null,
      asaas_payment_url: null,
      updated_at:        now,
    }).eq("id", charge.receivable_id);
  }

  // Audit log sanitizado (Edge Function logs + raw_response_json acima)
  console.log(
    `[gofit-pay] cancel_charge: OK ` +
    `contractor=${contractorId} ` +
    `charge=${chargeId} ` +
    `provider=${charge.provider_charge_id} ` +
    `prev=${previousStatus} ` +
    `new=CANCELLED`
  );

  return json({
    success: true,
    data: {
      charge_id:          chargeId,
      provider_charge_id: charge.provider_charge_id,
      previous_status:    previousStatus,
      status:             "CANCELLED",
      cancelled_at:       now,
      message:            "Cobrança cancelada com sucesso.",
    },
  });
}

// ─── Webhook receive (no auth) ────────────────────────────────────────────────

async function resolveContractorFromWebhook(
  db: ReturnType<typeof serviceClient>,
  paymentObj: Record<string, unknown> | null,
  payload: Record<string, unknown>
): Promise<string | null> {
  if (typeof paymentObj?.id === "string" && paymentObj.id) {
    const { data: charge } = await db.from("payment_charges").select("contractor_id")
      .eq("provider_charge_id", paymentObj.id).maybeSingle();
    if (charge?.contractor_id) return charge.contractor_id;
  }
  if (typeof paymentObj?.externalReference === "string" && paymentObj.externalReference) {
    const { data: charge } = await db.from("payment_charges").select("contractor_id")
      .eq("external_reference", paymentObj.externalReference).maybeSingle();
    if (charge?.contractor_id) return charge.contractor_id;
  }
  const accountObj = (
    payload.account    && typeof payload.account    === "object" ? payload.account    :
    payload.subaccount && typeof payload.subaccount === "object" ? payload.subaccount :
    null
  ) as Record<string, unknown> | null;
  if (typeof accountObj?.id === "string" && accountObj.id) {
    const { data: acct } = await db.from("gofit_pay_accounts").select("contractor_id")
      .eq("provider_account_id", accountObj.id).maybeSingle();
    if (acct?.contractor_id) return acct.contractor_id;
  }
  return null;
}

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

  const eventType       = typeof payload.event === "string" ? payload.event : "UNKNOWN";
  const providerEventId = typeof payload.id    === "string" ? payload.id    : null;

  const paymentObj    = payload.payment && typeof payload.payment === "object"
    ? (payload.payment as Record<string, unknown>) : null;
  const providerPayId = typeof paymentObj?.id === "string" ? paymentObj.id : null;

  const db = serviceClient();

  // Deduplication
  if (providerEventId) {
    const { data: dup } = await db.from("gofit_pay_webhook_events").select("id, processed")
      .eq("provider", "asaas").eq("provider_event_id", providerEventId).maybeSingle();
    if (dup) {
      // Se já processado, retorna 200 imediatamente
      if (dup.processed) {
        return json({ success: true, data: { duplicate: true, message: "Evento já processado." } });
      }
      // Se salvo mas não processado, tenta processar agora
      const { data: eventRow } = await db.from("gofit_pay_webhook_events")
        .select("id, event_type, provider_payment_id, payload_json, contractor_id, receivable_id, processing_attempts, processed")
        .eq("id", dup.id).maybeSingle();
      if (eventRow) {
        try {
          await processWebhookEvent(db, eventRow as WebhookEventRow, new Date().toISOString());
        } catch (e) {
          console.error(`[gofit-pay-webhook] Inline reprocess error: ${(e as Error)?.name ?? "Error"}`);
        }
      }
      return json({ success: true, data: { duplicate: true, message: "Evento reprocessado." } });
    }
  }

  const contractorId = await resolveContractorFromWebhook(db, paymentObj, payload);

  const { data: insertedEvent, error: insertErr } = await db
    .from("gofit_pay_webhook_events")
    .insert({
      contractor_id:        contractorId,
      provider:             "asaas",
      provider_environment: (Deno.env.get("ASAAS_ENV") ?? "sandbox") as "sandbox" | "production",
      event_type:           eventType,
      provider_event_id:    providerEventId,
      provider_payment_id:  providerPayId,
      asaas_payment_id:     providerPayId,
      payload_json:         sanitizeWebhookPayload(payload),
      raw_payload:          sanitizeWebhookPayload(payload),
      processed:            false,
      processing_attempts:  0,
      source_ip:            req.headers.get("x-forwarded-for") ?? null,
      received_at:          new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      return json({ success: true, data: { queued: true, duplicate: true } });
    }
    const safeMsg = insertErr.message.substring(0, 120).replace(/\s+/g, " ");
    console.error(`[gofit-pay-webhook] Insert failed: code=${insertErr.code} hint=${safeMsg}`);
    return json({ success: false, data: { queued: false, error: "Falha ao registrar evento." } }, 200);
  }

  // Processamento inline — salva primeiro, processa depois, Asaas recebe 200 rapidamente
  if (insertedEvent?.id) {
    const { data: eventRow } = await db.from("gofit_pay_webhook_events")
      .select("id, event_type, provider_payment_id, payload_json, contractor_id, receivable_id, processing_attempts, processed")
      .eq("id", insertedEvent.id).maybeSingle();
    if (eventRow) {
      try {
        await processWebhookEvent(db, eventRow as WebhookEventRow, new Date().toISOString());
      } catch (e) {
        console.error(`[gofit-pay-webhook] Inline processing error: ${(e as Error)?.name ?? "Error"}`);
        // Não falha o webhook — evento está salvo e pode ser reprocessado
      }
    }
  }

  return json({
    success: true,
    data: {
      queued:              true,
      processed:           false,
      contractor_resolved: contractorId !== null,
      event_type:          eventType,
      message:             contractorId
        ? "Evento recebido e processado."
        : "Evento recebido. Contractor não resolvido — será processado via process_pending_webhooks.",
    },
  });
}

// ─── Fase 14: helpers de ambiente ────────────────────────────────────────────

/** Resolve o ambiente efetivo para a empresa: sandbox ou production.
 *  Production só é ativado se TODAS as condições forem verdadeiras:
 *    1. ASAAS_ENV=production (secret global)
 *    2. gofit_pay_settings.production_enabled=true
 *    3. gofit_pay_settings.allowed_for_real_charges=true
 *  Se qualquer condição falhar, retorna sandbox.
 */
async function resolveEnvironment(
  db: ReturnType<typeof serviceClient>,
  contractorId: string
): Promise<{ env: "sandbox" | "production"; productionEnabled: boolean; allowedRealCharges: boolean }> {
  const globalEnv = Deno.env.get("ASAAS_ENV") ?? "sandbox";

  const { data: settings } = await db.from("gofit_pay_settings")
    .select("production_enabled, allowed_for_real_charges")
    .eq("contractor_id", contractorId).maybeSingle();

  const productionEnabled  = settings?.production_enabled   === true;
  const allowedRealCharges = settings?.allowed_for_real_charges === true;

  const env: "sandbox" | "production" =
    (globalEnv === "production" && productionEnabled && allowedRealCharges)
      ? "production"
      : "sandbox";

  return { env, productionEnabled, allowedRealCharges };
}

// ─── Fase 14: get_environment_status ─────────────────────────────────────────

async function handleGetEnvironmentStatus(contractorId: string): Promise<Response> {
  const db         = serviceClient();
  const globalEnv  = Deno.env.get("ASAAS_ENV")        ?? "sandbox";
  const baseUrl    = Deno.env.get("ASAAS_BASE_URL")    ?? "";

  const hasApiKey    = !!Deno.env.get("ASAAS_API_KEY");
  const hasWhToken   = !!Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const hasEncKey    = !!Deno.env.get("GOFIT_PAY_ENCRYPTION_KEY");

  const urlMatchesEnv =
    (globalEnv === "production" && baseUrl.includes("api.asaas.com") && !baseUrl.includes("sandbox")) ||
    (globalEnv === "sandbox"    && baseUrl.includes("sandbox.asaas.com"));

  const moduleId = await getGoFitPayModuleId(db);
  let moduleActive = false;
  if (moduleId) {
    const { data: cm } = await db.from("company_modules")
      .select("status").eq("contractor_id", contractorId).eq("module_id", moduleId).maybeSingle();
    moduleActive = cm?.status === "active";
  }

  const { data: account } = await db.from("gofit_pay_accounts")
    .select("id, status, provider_environment")
    .eq("contractor_id", contractorId).eq("provider", "asaas").maybeSingle();

  const { data: settings } = await db.from("gofit_pay_settings")
    .select("environment, production_enabled, allowed_for_real_charges, production_approved_at, production_notes")
    .eq("contractor_id", contractorId).maybeSingle();

  const { env, productionEnabled, allowedRealCharges } = await resolveEnvironment(db, contractorId);

  console.log(`[gofit-pay] get_environment_status: contractor=${contractorId} env=${env} prod_enabled=${productionEnabled}`);

  return json({
    success: true,
    data: {
      current_environment:       env,
      global_env_secret:         globalEnv,
      sandbox_active:            env === "sandbox",
      is_sandbox:                env === "sandbox",
      is_production:             env === "production",
      production_enabled:        productionEnabled,
      allowed_for_real_charges:  allowedRealCharges,
      production_approved_at:    settings?.production_approved_at ?? null,
      production_notes:          settings?.production_notes ?? null,
      module_active:             moduleActive,
      account_status:            account?.status ?? null,
      account_environment:       account?.provider_environment ?? "sandbox",
      webhook_configured:        hasWhToken,
      base_url_matches_env:      urlMatchesEnv,
      secrets_present: {
        api_key:        hasApiKey,
        webhook_token:  hasWhToken,
        encryption_key: hasEncKey,
      },
    },
  });
}

// ─── Fase 14: validate_production_readiness ───────────────────────────────────

async function handleValidateProductionReadiness(
  contractorId: string,
  secrets: SecretsValidation
): Promise<Response> {
  const db        = serviceClient();
  const globalEnv = Deno.env.get("ASAAS_ENV")     ?? "sandbox";
  const baseUrl   = Deno.env.get("ASAAS_BASE_URL") ?? "";

  type CheckStatus = "ok" | "warn" | "fail" | "pending";
  const checks: Array<{ item: string; status: CheckStatus; detail: string }> = [];

  const push = (item: string, status: CheckStatus, detail: string) =>
    checks.push({ item, status, detail });

  push("ASAAS_ENV configurado",   !!globalEnv ? "ok"  : "fail", globalEnv ? `ASAAS_ENV=${globalEnv}`          : "ASAAS_ENV ausente");
  push("ASAAS_BASE_URL válida",   !!baseUrl   ? "ok"  : "fail", baseUrl   ? "URL configurada (valor ocultado)" : "ASAAS_BASE_URL ausente");
  push("ASAAS_API_KEY configurada",  secrets.valid || !!Deno.env.get("ASAAS_API_KEY") ? "ok" : "fail",
    !!Deno.env.get("ASAAS_API_KEY")       ? "Presente (valor ocultado)" : "ASAAS_API_KEY ausente");
  push("ASAAS_WEBHOOK_TOKEN configurado", !!Deno.env.get("ASAAS_WEBHOOK_TOKEN") ? "ok"  : "fail",
    !!Deno.env.get("ASAAS_WEBHOOK_TOKEN") ? "Presente (valor ocultado)" : "ASAAS_WEBHOOK_TOKEN ausente");
  push("GOFIT_PAY_ENCRYPTION_KEY configurada", !!Deno.env.get("GOFIT_PAY_ENCRYPTION_KEY") ? "ok" : "fail",
    !!Deno.env.get("GOFIT_PAY_ENCRYPTION_KEY") ? "Presente (valor ocultado)" : "GOFIT_PAY_ENCRYPTION_KEY ausente");

  const { data: sandboxAccount } = await db.from("gofit_pay_accounts")
    .select("id, status").eq("contractor_id", contractorId).eq("provider", "asaas").eq("provider_environment", "sandbox").maybeSingle();
  push("Conta Asaas sandbox ativa", sandboxAccount?.status === "active" ? "ok" : "warn",
    sandboxAccount ? `Status: ${sandboxAccount.status}` : "Conta sandbox não encontrada");

  const { data: prodAccount } = await db.from("gofit_pay_accounts")
    .select("id, status, production_linked_at, production_verified_at")
    .eq("contractor_id", contractorId).eq("provider", "asaas").eq("provider_environment", "production").maybeSingle();
  push("Conta Asaas production vinculada", prodAccount ? (prodAccount.status === "active" ? "ok" : "warn") : "fail",
    prodAccount
      ? `Status: ${prodAccount.status} | Vinculada em: ${prodAccount.production_linked_at ?? "não registrado"}`
      : "Conta production não encontrada — use action link_production_account");

  const { data: settings } = await db.from("gofit_pay_settings")
    .select("environment, production_enabled, allowed_for_real_charges, production_approved_at, production_notes")
    .eq("contractor_id", contractorId).maybeSingle();

  const prodEnabled  = settings?.production_enabled      === true;
  const allowedReal  = settings?.allowed_for_real_charges === true;
  const approvedAt   = settings?.production_approved_at ?? null;

  push("Contractor aprovado para produção", prodEnabled ? "ok" : "warn",
    prodEnabled ? `Aprovado em ${approvedAt ?? "data não registrada"}` : "Produção não habilitada — padrão sandbox (seguro)");
  push("Cobranças reais permitidas", allowedReal ? "ok" : "warn",
    allowedReal ? "allowed_for_real_charges=true" : "Cobranças reais bloqueadas (padrão seguro)");

  const envIsProduction = (settings?.environment ?? globalEnv) === "production";
  push("Ambiente configurado para produção", envIsProduction ? "ok" : "warn",
    envIsProduction ? "environment=production" : "environment=sandbox (padrão seguro)");

  const baseUrlOk = baseUrl.includes("api.asaas.com") && !baseUrl.includes("sandbox");
  push("URL base Asaas é production", baseUrlOk ? "ok" : "warn",
    baseUrlOk ? "api.asaas.com" : "Ainda apontando para sandbox.asaas.com");

  // Webhook URL (informativo — sem revelar token)
  const supabaseUrl   = Deno.env.get("SUPABASE_URL") ?? "https://<project>.supabase.co";
  const webhookUrl    = `${supabaseUrl}/functions/v1/gofit-pay-base?source=webhook`;
  push("URL webhook para configurar no Asaas", "pending",
    `Configure: ${webhookUrl} (token via secret ASAAS_WEBHOOK_TOKEN)`);

  push("Modo sandbox sempre disponível", "ok", "Sandbox continua ativo para testes mesmo em produção habilitada");

  const critical = checks.filter(c => c.status === "fail");
  const warnings = checks.filter(c => c.status === "warn");
  const passed   = checks.filter(c => c.status === "ok");

  const readyForProduction = critical.length === 0 && prodEnabled && allowedReal && envIsProduction && !!prodAccount && prodAccount.status === "active";

  console.log(`[gofit-pay] validate_production_readiness: contractor=${contractorId} ready=${readyForProduction} critical=${critical.length} warn=${warnings.length}`);

  return json({
    success: true,
    data: {
      ready_for_production: readyForProduction,
      critical_failures:    critical.length,
      warnings:             warnings.length,
      passed:               passed.length,
      current_environment:  settings?.environment ?? globalEnv,
      summary: readyForProduction
        ? "Produção pronta. Validar cobrança real piloto antes de liberar para todos."
        : (critical.length > 0
          ? `${critical.length} falha(s) crítica(s) impedem produção.`
          : "Sandbox ativo. Produção bloqueada por padrão (seguro)."),
      checks,
    },
  });
}

// ─── Fase 15: enable_production_pilot ────────────────────────────────────────

async function handleEnableProductionPilot(
  body: Record<string, unknown>,
  contractorId: string
): Promise<Response> {
  const notes = typeof body.notes === "string" ? body.notes.trim() : "Go-live controlado — empresa piloto";

  const globalEnv = Deno.env.get("ASAAS_ENV") ?? "sandbox";
  const hasApiKey = !!Deno.env.get("ASAAS_API_KEY");
  const hasWhToken = !!Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const hasEncKey  = !!Deno.env.get("GOFIT_PAY_ENCRYPTION_KEY");

  if (!hasApiKey)  return err("ASAAS_API_KEY não configurado em Supabase Secrets.", "SECRET_MISSING_API_KEY",   422);
  if (!hasWhToken) return err("ASAAS_WEBHOOK_TOKEN não configurado em Supabase Secrets.", "SECRET_MISSING_WH_TOKEN", 422);
  if (!hasEncKey)  return err("GOFIT_PAY_ENCRYPTION_KEY não configurado em Supabase Secrets.", "SECRET_MISSING_ENC_KEY",  422);

  if (globalEnv !== "production") {
    return err(
      `ASAAS_ENV está como '${globalEnv}'. Configure ASAAS_ENV=production em Supabase Secrets antes de habilitar o piloto.`,
      "ENV_NOT_PRODUCTION",
      422
    );
  }

  const db = serviceClient();
  const now = new Date().toISOString();

  const { error } = await db.from("gofit_pay_settings").upsert(
    {
      contractor_id:           contractorId,
      environment:             "production",
      production_enabled:      true,
      allowed_for_real_charges: true,
      production_approved_at:  now,
      pilot_enabled_at:        now,
      pilot_notes:             notes,
      rollback_at:             null,
      rollback_notes:          null,
    },
    { onConflict: "contractor_id" }
  );

  if (error) {
    console.error("[gofit-pay] enable_production_pilot DB error:", error.message);
    return err("Erro ao salvar configuração de produção.", "DB_ERROR", 500);
  }

  console.log(`[gofit-pay] PRODUCTION PILOT ENABLED: contractor=${contractorId} notes="${notes}"`);

  return json({
    success: true,
    data: {
      production_enabled:      true,
      allowed_for_real_charges: true,
      pilot_enabled_at:        now,
      notes,
      message:                 "Piloto de produção habilitado. Cobranças reais agora autorizadas.",
    },
  });
}

// ─── Fase 15: disable_production_pilot (rollback) ────────────────────────────

async function handleDisableProductionPilot(
  body: Record<string, unknown>,
  contractorId: string
): Promise<Response> {
  const reason = typeof body.reason === "string" && body.reason.trim()
    ? body.reason.trim()
    : "Rollback operacional — Fase 15";

  const db  = serviceClient();
  const now = new Date().toISOString();

  const { error } = await db.from("gofit_pay_settings")
    .update({
      allowed_for_real_charges: false,
      rollback_at:              now,
      rollback_notes:           reason,
    })
    .eq("contractor_id", contractorId);

  if (error) {
    console.error("[gofit-pay] disable_production_pilot DB error:", error.message);
    return err("Erro ao executar rollback.", "DB_ERROR", 500);
  }

  console.log(`[gofit-pay] PRODUCTION PILOT ROLLED BACK: contractor=${contractorId} reason="${reason}"`);

  return json({
    success: true,
    data: {
      allowed_for_real_charges: false,
      rolled_back_at:           now,
      reason,
      message: "Rollback executado. Novas cobranças reais bloqueadas. Histórico preservado.",
    },
  });
}

// ─── Fase 15.1: link_production_account ──────────────────────────────────────

async function handleLinkProductionAccount(
  body: Record<string, unknown>,
  contractorId: string
): Promise<Response> {
  const providerAccountId = typeof body.provider_account_id === "string" ? body.provider_account_id.trim() : null;
  const providerWalletId  = typeof body.provider_wallet_id  === "string" ? body.provider_wallet_id.trim()  : null;
  const rawApiKey         = typeof body.api_key             === "string" ? body.api_key.trim()             : null;

  if (!providerAccountId) return err("provider_account_id obrigatório.", "MISSING_ACCOUNT_ID");
  if (!rawApiKey)         return err("api_key obrigatório.", "MISSING_API_KEY");

  const db  = serviceClient();
  const now = new Date().toISOString();

  // Verifica key contra Asaas production (best-effort — não bloqueia se timeout)
  const ASAAS_PROD_URL = "https://api.asaas.com/v3";
  let verifiedAt: string | null = null;
  try {
    const verifyRes = await fetch(`${ASAAS_PROD_URL}/myAccount`, {
      method:  "GET",
      headers: { "access_token": rawApiKey, "User-Agent": "GoFit/1.0" },
      signal:  AbortSignal.timeout(8000),
    });
    if (verifyRes.ok) {
      verifiedAt = now;
    } else {
      const errBody = await verifyRes.text().catch(() => "");
      console.warn(`[gofit-pay] link_production_account: Asaas verify returned ${verifyRes.status}: ${errBody.substring(0, 120)}`);
      return err(
        "Chave de API inválida ou sem acesso à conta de produção Asaas. Verifique e tente novamente.",
        "INVALID_PRODUCTION_KEY",
        422
      );
    }
  } catch (e) {
    // timeout ou network error — armazena sem verificação
    console.warn(`[gofit-pay] link_production_account: Asaas verify network error (stored without verification): ${(e as Error)?.name ?? "Error"}`);
  }

  // Encrypta a chave imediatamente — rawApiKey descartado após esta linha
  let encryptedKey: string;
  try {
    encryptedKey = await encryptSubAccountKey(rawApiKey);
  } catch (e) {
    console.error(`[gofit-pay] link_production_account: encrypt error: ${(e as Error)?.name ?? "Error"}`);
    return err("Falha ao criptografar chave. Verifique GOFIT_PAY_ENCRYPTION_KEY.", "ENCRYPT_ERROR", 503);
  }

  const { error: upsertErr } = await db.from("gofit_pay_accounts").upsert(
    {
      contractor_id:            contractorId,
      provider:                 "asaas",
      provider_environment:     "production",
      provider_account_id:      providerAccountId,
      provider_wallet_id:       providerWalletId ?? null,
      provider_api_key_encrypted: encryptedKey,
      status:                   "active",
      production_linked_at:     now,
      production_verified_at:   verifiedAt,
      updated_at:               now,
    },
    { onConflict: "contractor_id,provider,provider_environment" }
  );

  if (upsertErr) {
    console.error(`[gofit-pay] link_production_account DB error: ${upsertErr.message}`);
    return err("Erro ao salvar conta de produção.", "DB_ERROR", 500);
  }

  console.log(`[gofit-pay] PRODUCTION ACCOUNT LINKED: contractor=${contractorId} account=${providerAccountId} verified=${!!verifiedAt}`);

  return json({
    success: true,
    data: {
      provider_environment:   "production",
      provider_account_id:    providerAccountId,
      status:                 "active",
      linked_at:              now,
      verified:               !!verifiedAt,
      message:                verifiedAt
        ? "Conta de produção vinculada e verificada com sucesso."
        : "Conta de produção vinculada (verificação com Asaas não foi possível — chave salva).",
    },
  });
}

// ─── Fase 13: get_reports ─────────────────────────────────────────────────────

async function handleGetReports(
  body: Record<string, unknown>,
  contractorId: string
): Promise<Response> {
  const db = serviceClient();

  const dateFrom    = typeof body.date_from         === "string" ? body.date_from  : null;
  const dateTo      = typeof body.date_to           === "string" ? body.date_to    : null;
  const billingType = typeof body.billing_type      === "string" ? body.billing_type.toUpperCase() : null;
  const statusFin   = typeof body.status_financeiro === "string" ? body.status_financeiro : null;
  const statusGw    = typeof body.status_gateway    === "string" ? body.status_gateway    : null;
  const studentName = typeof body.student_name      === "string" ? body.student_name.toLowerCase() : null;
  const tipoBaixaFilter = Array.isArray(body.tipo_baixa) ? body.tipo_baixa as string[] : null;
  const limitRows   = typeof body.limit  === "number" ? Math.min(body.limit,  500) : 100;
  const offsetRows  = typeof body.offset === "number" ? body.offset                : 0;

  const today = new Date().toISOString().substring(0, 10);

  // ── 1. payment_charges do período ──────────────────────────────────────────
  let pcQuery = db.from("payment_charges")
    .select("id,student_id,receivable_id,provider_charge_id,billing_type,amount,due_date,status,invoice_url,bank_slip_url,pix_copy_paste,paid_at,confirmed_at,cancelled_at,created_at")
    .eq("contractor_id", contractorId)
    .order("created_at", { ascending: false });

  if (dateFrom)    pcQuery = pcQuery.gte("created_at", dateFrom + "T00:00:00Z");
  if (dateTo)      pcQuery = pcQuery.lte("created_at", dateTo   + "T23:59:59Z");
  if (billingType) pcQuery = pcQuery.eq("billing_type", billingType);
  if (statusGw)    pcQuery = pcQuery.eq("status", statusGw);

  const { data: chargesRaw, error: chargesErr } = await pcQuery.limit(500);
  if (chargesErr) return err("Falha ao buscar cobranças.", "QUERY_ERROR", 500);
  const charges = chargesRaw ?? [];

  // ── 2. receivables vinculadas ao GoFit Pay ─────────────────────────────────
  const { data: allRcvRaw } = await db.from("receivables")
    .select("id,student_id,descricao,valor,valor_pago,status,vencimento,pago_em,asaas_payment_id,gateway_provider")
    .eq("contractor_id", contractorId)
    .eq("gateway_provider", "asaas")
    .limit(2000);
  const allRcv = allRcvRaw ?? [];
  const rcvMap = new Map(allRcv.map(r => [r.id as string, r]));

  // ── 3. students para nomes ─────────────────────────────────────────────────
  const studentIds = [...new Set([
    ...charges.map(c => c.student_id),
    ...allRcv.map(r => r.student_id),
  ].filter(Boolean) as string[])];

  const studentsMap = new Map<string, { nome_completo: string; email: string | null }>();
  if (studentIds.length > 0) {
    const { data: stRows } = await db.from("students")
      .select("id,nome_completo,email")
      .in("id", studentIds.slice(0, 500));
    for (const s of stRows ?? []) studentsMap.set(s.id as string, { nome_completo: s.nome_completo ?? "", email: s.email ?? null });
  }

  // ── 4. webhooks processados para baixa automática ─────────────────────────
  const asaasIds = [...new Set([
    ...allRcv.map(r => r.asaas_payment_id),
    ...charges.map(c => c.provider_charge_id),
  ].filter(Boolean) as string[])];

  const webhookAutoSet = new Set<string>();
  if (asaasIds.length > 0) {
    const { data: wh } = await db.from("gofit_pay_webhook_events")
      .select("provider_payment_id")
      .eq("contractor_id", contractorId)
      .in("event_type", ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"])
      .eq("processed", true)
      .in("provider_payment_id", asaasIds.slice(0, 200));
    for (const w of wh ?? []) {
      if (w.provider_payment_id) webhookAutoSet.add(w.provider_payment_id as string);
    }
  }

  // ── 5. Summary ─────────────────────────────────────────────────────────────
  const totalCobrado   = charges.reduce((s, c) => s + ((c.amount as number) ?? 0), 0);
  const totalCancelado = charges.filter(c => c.status === "CANCELLED").reduce((s, c) => s + ((c.amount as number) ?? 0), 0);
  const qtdCobranças   = charges.length;
  const qtdAlunos      = new Set(charges.map(c => c.student_id).filter(Boolean)).size;

  const rcvPago = allRcv.filter(r => {
    if (r.status !== "pago") return false;
    const pagoEm = (r.pago_em as string | null)?.substring(0, 10);
    if (dateFrom && pagoEm && pagoEm < dateFrom) return false;
    if (dateTo   && pagoEm && pagoEm > dateTo)   return false;
    return true;
  });
  const totalPago = rcvPago.reduce((s, r) => s + (((r.valor_pago ?? r.valor) as number) ?? 0), 0);

  const rcvPendente = allRcv.filter(r => !["pago","cancelado"].includes(r.status as string) && (r.vencimento as string) >= today);
  const rcvVencido  = allRcv.filter(r => !["pago","cancelado"].includes(r.status as string) && (r.vencimento as string) <  today);
  const totalPendente = rcvPendente.reduce((s, r) => s + ((r.valor as number) ?? 0), 0);
  const totalVencido  = rcvVencido.reduce( (s, r) => s + ((r.valor as number) ?? 0), 0);

  let baixasAuto = 0, baixasManuais = 0;
  for (const r of rcvPago) {
    const apId = r.asaas_payment_id as string | null;
    if (apId && webhookAutoSet.has(apId)) baixasAuto++;
    else baixasManuais++;
  }

  // ── 6. Agrupamento por forma de pagamento ──────────────────────────────────
  type BtStat = { qtd: number; total_emitido: number; total_pago: number; pendente: number; vencido: number; cancelado: number };
  const btMap = new Map<string, BtStat>();
  const ensureBt = (bt: string): BtStat => {
    if (!btMap.has(bt)) btMap.set(bt, { qtd: 0, total_emitido: 0, total_pago: 0, pendente: 0, vencido: 0, cancelado: 0 });
    return btMap.get(bt)!;
  };
  for (const c of charges) {
    const bt = (c.billing_type as string) ?? "UNKNOWN";
    const s = ensureBt(bt);
    s.qtd++;
    s.total_emitido += (c.amount as number) ?? 0;
    if (c.status === "CANCELLED") s.cancelado += (c.amount as number) ?? 0;
  }
  const rcvToCharge = new Map<string, typeof charges[0]>();
  for (const c of charges) { if (c.receivable_id) rcvToCharge.set(c.receivable_id as string, c); }
  for (const r of rcvPago)     { const c = rcvToCharge.get(r.id as string); if (c) ensureBt((c.billing_type as string) ?? "UNKNOWN").total_pago += (((r.valor_pago ?? r.valor) as number) ?? 0); }
  for (const r of rcvPendente) { const c = rcvToCharge.get(r.id as string); if (c) ensureBt((c.billing_type as string) ?? "UNKNOWN").pendente  += ((r.valor as number) ?? 0); }
  for (const r of rcvVencido)  { const c = rcvToCharge.get(r.id as string); if (c) ensureBt((c.billing_type as string) ?? "UNKNOWN").vencido   += ((r.valor as number) ?? 0); }
  const byBillingType = [...btMap.entries()].map(([bt, s]) => ({ billing_type: bt, ...s }));

  // ── 7. Tabela de cobranças (paginada) ──────────────────────────────────────
  const rawTable = charges.map(c => {
    const rcv     = (c.receivable_id ? rcvMap.get(c.receivable_id as string) : null) ?? null;
    const student = (c.student_id    ? studentsMap.get(c.student_id as string) : null) ?? null;
    const apId    = (rcv?.asaas_payment_id ?? c.provider_charge_id) as string | null;
    let tipoBaixa = "nao_pago";
    if (rcv?.status === "pago") {
      tipoBaixa = apId && webhookAutoSet.has(apId) ? "automatica" : apId ? "manual" : "nao_identificado";
    }
    return {
      charge_id:         c.id,
      provider_charge_id: c.provider_charge_id,
      billing_type:      c.billing_type,
      amount:            c.amount,
      due_date:          c.due_date,
      status_gateway:    c.status,
      invoice_url:       c.invoice_url,
      bank_slip_url:     c.bank_slip_url,
      pix_copy_paste:    c.pix_copy_paste,
      paid_at:           c.paid_at ?? c.confirmed_at,
      cancelled_at:      c.cancelled_at,
      created_at:        c.created_at,
      student_nome:      student?.nome_completo ?? null,
      student_email:     student?.email ?? null,
      receivable_id:     c.receivable_id,
      descricao:         rcv?.descricao ?? null,
      vencimento:        rcv?.vencimento ?? c.due_date,
      valor_rcv:         rcv?.valor ?? null,
      valor_pago_rcv:    rcv?.valor_pago ?? null,
      status_financeiro: rcv?.status ?? null,
      pago_em:           rcv?.pago_em ?? null,
      tipo_baixa:        tipoBaixa,
    };
  });

  // Filtros adicionais (client-side no servidor para garantir contractor_id)
  let filtered = rawTable;
  if (statusFin)           filtered = filtered.filter(r => r.status_financeiro === statusFin);
  if (studentName)         filtered = filtered.filter(r => r.student_nome?.toLowerCase().includes(studentName));
  if (tipoBaixaFilter?.length) filtered = filtered.filter(r => tipoBaixaFilter.includes(r.tipo_baixa));

  const chargesTable = filtered.slice(offsetRows, offsetRows + limitRows);

  // ── 8. Divergências ────────────────────────────────────────────────────────
  type Disc = {
    tipo: string; severidade: "Alta" | "Média" | "Baixa";
    student_nome: string | null; receivable_id: string | null;
    provider_charge_id: string | null; descricao: string; acao_sugerida: string;
  };
  const discs: Disc[] = [];

  for (const c of charges) {
    const rcv     = (c.receivable_id ? rcvMap.get(c.receivable_id as string) : null) ?? null;
    const student = (c.student_id    ? studentsMap.get(c.student_id as string) : null) ?? null;
    const sNome   = student?.nome_completo ?? null;
    const amt     = (c.amount as number) ?? 0;
    const rcvVal  = (rcv?.valor as number) ?? 0;

    if ((c.status === "RECEIVED" || c.status === "CONFIRMED") && rcv && rcv.status !== "pago") {
      discs.push({ tipo: "gateway_pago_financeiro_aberto", severidade: "Alta", student_nome: sNome, receivable_id: c.receivable_id as string, provider_charge_id: c.provider_charge_id as string, descricao: `Gateway ${c.status}, mas conta a receber está "${rcv.status}" no financeiro.`, acao_sugerida: "Verificar webhook ou efetuar baixa manual no financeiro." });
    }
    if (c.status === "CANCELLED" && rcv && rcv.status === "pago") {
      discs.push({ tipo: "cobranca_cancelada_financeiro_pago", severidade: "Alta", student_nome: sNome, receivable_id: c.receivable_id as string, provider_charge_id: c.provider_charge_id as string, descricao: "Cobrança cancelada no gateway, mas conta a receber está paga no financeiro.", acao_sugerida: "Verificar se o pagamento foi registrado por outro meio." });
    }
    if (rcv && amt > 0 && rcvVal > 0 && Math.abs(amt - rcvVal) > 0.01) {
      discs.push({ tipo: "valor_divergente", severidade: "Alta", student_nome: sNome, receivable_id: c.receivable_id as string, provider_charge_id: c.provider_charge_id as string, descricao: `Cobrança R$${amt.toFixed(2)} vs conta a receber R$${rcvVal.toFixed(2)}.`, acao_sugerida: "Verificar se o valor foi ajustado manualmente." });
    }
    if (rcv && rcv.status === "pago" && c.status && !["RECEIVED","CONFIRMED"].includes(c.status as string)) {
      discs.push({ tipo: "financeiro_pago_gateway_pendente", severidade: "Média", student_nome: sNome, receivable_id: c.receivable_id as string, provider_charge_id: c.provider_charge_id as string, descricao: `Conta a receber paga, mas cobrança com status "${c.status}" no gateway.`, acao_sugerida: "Sincronizar status da cobrança ou verificar pagamento manual." });
    }
  }

  // receivables com asaas_payment_id mas sem cobrança no período
  const chargeRcvIds = new Set(charges.map(c => c.receivable_id).filter(Boolean));
  let orphanCount = 0;
  for (const r of allRcv) {
    if (orphanCount >= 10) break;
    if (!r.asaas_payment_id || chargeRcvIds.has(r.id as string)) continue;
    if (dateFrom && (r.vencimento as string) < dateFrom) continue;
    if (dateTo   && (r.vencimento as string) > dateTo)   continue;
    const student = (r.student_id ? studentsMap.get(r.student_id as string) : null) ?? null;
    discs.push({ tipo: "rcv_asaas_sem_cobranca", severidade: "Baixa", student_nome: student?.nome_completo ?? null, receivable_id: r.id as string, provider_charge_id: r.asaas_payment_id as string, descricao: "Conta a receber tem asaas_payment_id mas sem cobrança no período consultado.", acao_sugerida: "Verificar filtro de período ou se o pagamento foi feito fora do GoFit Pay." });
    orphanCount++;
  }

  // webhooks não processados deste contractor
  const { data: pendingWh } = await db.from("gofit_pay_webhook_events")
    .select("id,event_type,provider_payment_id,created_at")
    .eq("contractor_id", contractorId)
    .in("event_type", ["PAYMENT_RECEIVED","PAYMENT_CONFIRMED"])
    .eq("processed", false)
    .order("created_at", { ascending: false })
    .limit(20);

  for (const w of pendingWh ?? []) {
    discs.push({ tipo: "webhook_nao_processado", severidade: "Alta", student_nome: null, receivable_id: null, provider_charge_id: w.provider_payment_id as string, descricao: `Evento ${w.event_type} recebido em ${(w.created_at as string)?.substring(0,10)} ainda não processado.`, acao_sugerida: "Usar 'Processar webhooks pendentes' na tela de cobranças." });
  }

  const divCount = discs.length;

  console.log(`[gofit-pay] get_reports: contractor=${contractorId} charges=${charges.length} discs=${divCount}`);

  return json({
    success: true,
    data: {
      summary: {
        total_cobrado:      totalCobrado,
        total_pago:         totalPago,
        total_pendente:     totalPendente,
        total_vencido:      totalVencido,
        total_cancelado:    totalCancelado,
        qtd_cobranças:      qtdCobranças,
        qtd_alunos:         qtdAlunos,
        baixas_automaticas: baixasAuto,
        baixas_manuais:     baixasManuais,
        divergencias:       divCount,
      },
      by_billing_type: byBillingType,
      charges: chargesTable,
      discrepancies: discs.slice(0, 100),
      meta: {
        date_from:               dateFrom,
        date_to:                 dateTo,
        total_charges_in_period: charges.length,
        returned:                chargesTable.length,
        filtered_total:          filtered.length,
        offset:                  offsetRows,
      },
    },
  });
}

// ─── Main router ──────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// Fase 15.2 — Carteira de cartões / tokenização
//
// REGRAS:
//   - número do cartão e CVV existem APENAS no request — nunca em log, DB,
//     response ou erro;
//   - creditCardToken é criptografado (AES-256-GCM) antes de persistir;
//   - somente dados mascarados saem nas responses (brand, last4, alias);
//   - links públicos: token aleatório forte, só o SHA-256 vai ao banco.
// ═══════════════════════════════════════════════════════════════════════════

const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "https://fitcoresys.com.br";

/** IP do cliente a partir de headers confiáveis do gateway Supabase.
 *  Limitação documentada: atrás do proxy, o primeiro hop de x-forwarded-for
 *  é o melhor IP disponível; não inventamos IP. */
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  return req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function maskedCard(row: Record<string, unknown>) {
  return {
    card_id:              row.id,
    card_brand:           row.card_brand ?? null,
    card_last4:           row.card_last4 ?? null,
    card_alias:           row.card_alias ?? null,
    card_holder_name:     row.card_holder_name ?? null,
    expiry_month:         row.expiry_month ?? null,
    expiry_year:          row.expiry_year ?? null,
    is_default:           row.is_default === true,
    status:               row.status,
    provider_environment: row.provider_environment,
    created_at:           row.created_at,
  };
}

/** Garante payment_customer + customer Asaas para o aluno (reuso do padrão Fase 6). */
async function ensureProviderCustomer(
  db: ReturnType<typeof serviceClient>,
  contractorId: string,
  studentId: string,
  subAccountApiKey: string
): Promise<{ paymentCustomerId: string | null; providerCustomerId: string; student: Record<string, unknown> }> {
  const { data: student } = await db.from("students").select("id, nome_completo, cpf, email, telefone, cep")
    .eq("id", studentId).eq("contractor_id", contractorId).maybeSingle();
  if (!student) {
    throw new GoFitPayBusinessError("Aluno não encontrado ou não pertence a esta empresa.", "STUDENT_NOT_FOUND", 404);
  }

  const { data: existingCust } = await db.from("payment_customers")
    .select("id, provider_customer_id")
    .eq("contractor_id", contractorId).eq("student_id", studentId).eq("provider", "asaas").maybeSingle();
  if (existingCust?.provider_customer_id) {
    return { paymentCustomerId: existingCust.id, providerCustomerId: existingCust.provider_customer_id, student };
  }

  const asaasCustomer = await AsaasService.upsertCustomer(subAccountApiKey, {
    name: String(student.nome_completo), cpfCnpj: student.cpf ?? undefined,
    email: student.email ?? undefined, phone: student.telefone ?? undefined,
    externalReference: `gofit:stu:${studentId}`,
  });

  const nowCust = new Date().toISOString();
  const { data: saved, error: insErr } = await db.from("payment_customers").insert({
    contractor_id: contractorId, student_id: studentId, client_id: studentId,
    provider: "asaas", provider_customer_id: asaasCustomer.id,
    name: String(student.nome_completo), email: student.email ?? null,
    cpf_cnpj: student.cpf ?? null, phone: student.telefone ?? null,
    synced_at: nowCust, created_at: nowCust, updated_at: nowCust,
  }).select("id").single();

  if (insErr && insErr.code !== "23505") {
    console.error(`[gofit-pay] payment_customers insert warn: ${insErr.code}`);
  }
  return { paymentCustomerId: saved?.id ?? null, providerCustomerId: asaasCustomer.id, student };
}

interface CardFormInput {
  card_number:  string;
  holder_name:  string;
  expiry_month: string;
  expiry_year:  string;
  ccv:          string;
  card_alias:   string | null;
  is_default:   boolean;
  holder_info:  Record<string, unknown> | null;
}

/** Extrai e valida os campos do cartão do body. Os valores sensíveis ficam
 *  apenas no objeto retornado — o chamador nunca os loga nem persiste. */
function parseCardInput(body: Record<string, unknown>): CardFormInput | { error: string; code: string } {
  const cardNumber = typeof body.card_number === "string" ? body.card_number.replace(/\D/g, "") : "";
  const holderName = typeof body.holder_name === "string" ? body.holder_name.trim() : "";
  let expiryMonth  = typeof body.expiry_month === "string" ? body.expiry_month.trim() : "";
  let expiryYear   = typeof body.expiry_year  === "string" ? body.expiry_year.trim()  : "";
  const ccv        = typeof body.ccv === "string" ? body.ccv.replace(/\D/g, "") : "";

  if (cardNumber.length < 13 || cardNumber.length > 19) return { error: "Número do cartão inválido.", code: "INVALID_CARD_NUMBER" };
  if (!holderName)                                       return { error: "Nome do titular obrigatório.", code: "MISSING_HOLDER_NAME" };
  if (!/^\d{1,2}$/.test(expiryMonth) || Number(expiryMonth) < 1 || Number(expiryMonth) > 12) {
    return { error: "Mês de validade inválido.", code: "INVALID_EXPIRY" };
  }
  expiryMonth = expiryMonth.padStart(2, "0");
  if (/^\d{2}$/.test(expiryYear)) expiryYear = `20${expiryYear}`;
  if (!/^\d{4}$/.test(expiryYear)) return { error: "Ano de validade inválido.", code: "INVALID_EXPIRY" };
  if (ccv.length < 3 || ccv.length > 4) return { error: "CVV inválido.", code: "INVALID_CCV" };

  return {
    card_number:  cardNumber,
    holder_name:  holderName,
    expiry_month: expiryMonth,
    expiry_year:  expiryYear,
    ccv,
    card_alias:   typeof body.card_alias === "string" && body.card_alias.trim() ? body.card_alias.trim().substring(0, 60) : null,
    is_default:   body.is_default === true,
    holder_info:  body.holder_info && typeof body.holder_info === "object" ? body.holder_info as Record<string, unknown> : null,
  };
}

/** Tokeniza no Asaas e persiste somente token criptografado + dados mascarados. */
async function tokenizeAndSaveCard(
  db: ReturnType<typeof serviceClient>,
  contractorId: string,
  studentId: string,
  env: "sandbox" | "production",
  card: CardFormInput,
  remoteIp: string
): Promise<Record<string, unknown>> {
  const subAccInfo = await assertGoFitPayActive(db, contractorId, env);

  let subAccountApiKey: string;
  try {
    subAccountApiKey = await decryptSubAccountKey(subAccInfo.provider_api_key_encrypted);
  } catch {
    throw new GoFitPayBusinessError("Falha de configuração interna. Reative o GoFit Pay.", "DECRYPT_ERROR", 503);
  }

  const { paymentCustomerId, providerCustomerId, student } =
    await ensureProviderCustomer(db, contractorId, studentId, subAccountApiKey);

  const cpfDigits   = String((card.holder_info?.cpfCnpj     as string) ?? (student.cpf      as string) ?? "").replace(/\D/g, "");
  let   cepDigits   = String((card.holder_info?.postalCode  as string) ?? (student.cep      as string) ?? "").replace(/\D/g, "");
  const phoneDigits = String((card.holder_info?.mobilePhone as string) ?? (student.telefone as string) ?? "").replace(/\D/g, "");
  let   addrNumber  = String((card.holder_info?.addressNumber as string) ?? "").trim();
  let   holderEmail = String((card.holder_info?.email as string) ?? (student.email as string) ?? "").trim();

  // Asaas exige postalCode/addressNumber no holderInfo. Quando o aluno não tem
  // endereço cadastrado, usa o endereço da academia como cobrança (fallback).
  if (!cepDigits || !addrNumber || !holderEmail) {
    const { data: ctr } = await db.from("contractors").select("cep, numero, email")
      .eq("id", contractorId).maybeSingle();
    if (!cepDigits)   cepDigits   = String(ctr?.cep    ?? "").replace(/\D/g, "");
    if (!addrNumber)  addrNumber  = String(ctr?.numero ?? "").trim() || "S/N";
    if (!holderEmail) holderEmail = String(ctr?.email  ?? "").trim();
  }

  const holderInfo: Record<string, unknown> = {
    name:          card.holder_name,
    email:         holderEmail || undefined,
    cpfCnpj:       cpfDigits   !== "" ? cpfDigits   : undefined,
    postalCode:    cepDigits   !== "" ? cepDigits   : undefined,
    addressNumber: addrNumber  !== "" ? addrNumber  : undefined,
    mobilePhone:   phoneDigits !== "" ? phoneDigits : undefined,
  };

  const tokenResult = await AsaasService.tokenizeCreditCard(subAccountApiKey, {
    customer: providerCustomerId,
    creditCard: {
      holderName:  card.holder_name,
      number:      card.card_number,
      expiryMonth: card.expiry_month,
      expiryYear:  card.expiry_year,
      ccv:         card.ccv,
    },
    creditCardHolderInfo: holderInfo as TokenizeCreditCardParams["creditCardHolderInfo"],
    remoteIp,
  });

  const encryptedToken = await encryptSubAccountKey(tokenResult.creditCardToken);
  const last4 = (tokenResult.creditCardNumber ?? card.card_number.slice(-4)).slice(-4);
  const now = new Date().toISOString();

  if (card.is_default) {
    await db.from("gofit_pay_student_cards")
      .update({ is_default: false, updated_at: now })
      .eq("contractor_id", contractorId).eq("student_id", studentId)
      .eq("provider_environment", env).eq("is_default", true);
  }

  // Primeiro cartão ativo do aluno vira principal automaticamente
  const { count: activeCount } = await db.from("gofit_pay_student_cards")
    .select("id", { count: "exact", head: true })
    .eq("contractor_id", contractorId).eq("student_id", studentId)
    .eq("provider_environment", env).eq("status", "active").is("deleted_at", null);
  const willBeDefault = card.is_default || (activeCount ?? 0) === 0;

  const { data: savedCard, error: cardErr } = await db.from("gofit_pay_student_cards").insert({
    contractor_id: contractorId,
    student_id:    studentId,
    payment_customer_id: paymentCustomerId,
    provider: "asaas",
    provider_environment: env,
    provider_customer_id: providerCustomerId,
    credit_card_token_encrypted: encryptedToken,
    card_brand: tokenResult.creditCardBrand ?? null,
    card_last4: last4,
    card_holder_name: card.holder_name,
    card_alias: card.card_alias,
    expiry_month: card.expiry_month,
    expiry_year:  card.expiry_year,
    is_default: willBeDefault,
    status: "active",
    created_at: now, updated_at: now,
  }).select("id, card_brand, card_last4, card_alias, card_holder_name, expiry_month, expiry_year, is_default, status, provider_environment, created_at").single();

  if (cardErr || !savedCard) {
    console.error(`[gofit-pay] student_cards insert error: ${cardErr?.code ?? "?"}`);
    throw new GoFitPayBusinessError("Falha ao salvar cartão.", "CARD_SAVE_ERROR", 500);
  }

  console.log(
    `[gofit-pay] CARD TOKENIZED: contractor=${contractorId} student=${studentId} ` +
    `env=${env} brand=${savedCard.card_brand ?? "?"} last4=${savedCard.card_last4 ?? "?"} default=${willBeDefault}`
  );

  return maskedCard(savedCard as Record<string, unknown>);
}

// ─── Action: list_student_cards ──────────────────────────────────────────────

async function handleListStudentCards(body: Record<string, unknown>, contractorId: string): Promise<Response> {
  const studentId = typeof body.student_id === "string" ? body.student_id : null;
  if (!studentId) return err("student_id obrigatório.", "MISSING_STUDENT_ID");

  const db = serviceClient();
  const { data: student } = await db.from("students").select("id")
    .eq("id", studentId).eq("contractor_id", contractorId).maybeSingle();
  if (!student) return err("Aluno não encontrado ou não pertence a esta empresa.", "STUDENT_NOT_FOUND", 404);

  const { data: cards, error } = await db.from("gofit_pay_student_cards")
    .select("id, card_brand, card_last4, card_alias, card_holder_name, expiry_month, expiry_year, is_default, status, provider_environment, created_at")
    .eq("contractor_id", contractorId).eq("student_id", studentId)
    .is("deleted_at", null)
    .order("is_default", { ascending: false }).order("created_at", { ascending: false });

  if (error) return err("Falha ao listar cartões.", "QUERY_ERROR", 500);
  return json({ success: true, data: { cards: (cards ?? []).map(c => maskedCard(c as Record<string, unknown>)) } });
}

// ─── Action: tokenize_student_card (operador autenticado) ────────────────────

async function handleTokenizeStudentCard(
  body: Record<string, unknown>,
  contractorId: string,
  secrets: SecretsValidation,
  req: Request
): Promise<Response> {
  if (!secrets.valid) return err("Configuração incompleta.", "CONFIG_INCOMPLETE", 503);

  const studentId = typeof body.student_id === "string" ? body.student_id : null;
  if (!studentId) return err("student_id obrigatório.", "MISSING_STUDENT_ID");

  const parsed = parseCardInput(body);
  if ("error" in parsed) return err(parsed.error, parsed.code, 422);

  const db = serviceClient();
  const { env } = await resolveEnvironment(db, contractorId);
  const remoteIp = typeof body.remote_ip === "string" && body.remote_ip ? body.remote_ip : clientIp(req);

  const masked = await tokenizeAndSaveCard(db, contractorId, studentId, env, parsed, remoteIp);
  return json({ success: true, data: masked });
}

// ─── Action: set_default_student_card ────────────────────────────────────────

async function handleSetDefaultStudentCard(body: Record<string, unknown>, contractorId: string): Promise<Response> {
  const cardId = typeof body.card_id === "string" ? body.card_id : null;
  if (!cardId) return err("card_id obrigatório.", "MISSING_CARD_ID");

  const db = serviceClient();
  const { data: card } = await db.from("gofit_pay_student_cards")
    .select("id, student_id, provider_environment, status")
    .eq("id", cardId).eq("contractor_id", contractorId).is("deleted_at", null).maybeSingle();
  if (!card) return err("Cartão não encontrado.", "CARD_NOT_FOUND", 404);
  if (card.status !== "active") return err("Apenas cartão ativo pode ser principal.", "CARD_NOT_ACTIVE", 422);

  const now = new Date().toISOString();
  await db.from("gofit_pay_student_cards")
    .update({ is_default: false, updated_at: now })
    .eq("contractor_id", contractorId).eq("student_id", card.student_id)
    .eq("provider_environment", card.provider_environment).eq("is_default", true);
  const { error } = await db.from("gofit_pay_student_cards")
    .update({ is_default: true, updated_at: now }).eq("id", cardId);
  if (error) return err("Falha ao definir cartão principal.", "DB_ERROR", 500);

  return json({ success: true, data: { card_id: cardId, is_default: true } });
}

// ─── Action: deactivate_student_card ─────────────────────────────────────────

async function handleDeactivateStudentCard(body: Record<string, unknown>, contractorId: string): Promise<Response> {
  const cardId = typeof body.card_id === "string" ? body.card_id : null;
  if (!cardId) return err("card_id obrigatório.", "MISSING_CARD_ID");

  const db = serviceClient();
  const { data: card } = await db.from("gofit_pay_student_cards")
    .select("id, student_id, provider_environment, is_default")
    .eq("id", cardId).eq("contractor_id", contractorId).is("deleted_at", null).maybeSingle();
  if (!card) return err("Cartão não encontrado.", "CARD_NOT_FOUND", 404);

  const now = new Date().toISOString();
  const { error } = await db.from("gofit_pay_student_cards")
    .update({ status: "inactive", is_default: false, deleted_at: now, updated_at: now })
    .eq("id", cardId);
  if (error) return err("Falha ao remover cartão.", "DB_ERROR", 500);

  // Se o removido era o principal, promove o cartão ativo mais recente
  if (card.is_default) {
    const { data: next } = await db.from("gofit_pay_student_cards")
      .select("id")
      .eq("contractor_id", contractorId).eq("student_id", card.student_id)
      .eq("provider_environment", card.provider_environment)
      .eq("status", "active").is("deleted_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (next) {
      await db.from("gofit_pay_student_cards")
        .update({ is_default: true, updated_at: now }).eq("id", next.id);
    }
  }

  return json({ success: true, data: { card_id: cardId, status: "inactive" } });
}

// ─── Action: create_card_registration_link ───────────────────────────────────

async function handleCreateCardRegistrationLink(
  body: Record<string, unknown>,
  contractorId: string,
  userId: string
): Promise<Response> {
  const studentId = typeof body.student_id === "string" ? body.student_id : null;
  if (!studentId) return err("student_id obrigatório.", "MISSING_STUDENT_ID");
  const expiresInHours = typeof body.expires_in_hours === "number"
    ? Math.min(Math.max(body.expires_in_hours, 1), 168) : 72;

  const db = serviceClient();
  const { data: student } = await db.from("students").select("id")
    .eq("id", studentId).eq("contractor_id", contractorId).maybeSingle();
  if (!student) return err("Aluno não encontrado ou não pertence a esta empresa.", "STUDENT_NOT_FOUND", 404);

  const { env } = await resolveEnvironment(db, contractorId);

  // Token forte: 32 bytes aleatórios em base64url — só o hash vai ao banco
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + expiresInHours * 3600_000).toISOString();

  const { error } = await db.from("gofit_pay_card_registration_links").insert({
    contractor_id: contractorId, student_id: studentId,
    token_hash: tokenHash, provider_environment: env,
    expires_at: expiresAt, created_by: userId,
  });
  if (error) return err("Falha ao gerar link.", "DB_ERROR", 500);

  return json({
    success: true,
    data: {
      registration_url: `${PUBLIC_APP_URL}/aluno/cartao/${token}`,
      expires_at: expiresAt,
    },
  });
}

// ─── Link público: validação compartilhada ───────────────────────────────────

async function resolveRegistrationLink(
  db: ReturnType<typeof serviceClient>,
  token: string
): Promise<{ ok: true; link: Record<string, unknown> } | { ok: false; reason: string }> {
  if (!token || token.length < 20) return { ok: false, reason: "Token inválido." };
  const tokenHash = await sha256Hex(token);
  const { data: link } = await db.from("gofit_pay_card_registration_links")
    .select("id, contractor_id, student_id, provider_environment, expires_at, used_at, revoked_at")
    .eq("token_hash", tokenHash).maybeSingle();
  if (!link)            return { ok: false, reason: "Link não encontrado." };
  if (link.revoked_at)  return { ok: false, reason: "Link revogado." };
  if (link.used_at)     return { ok: false, reason: "Link já utilizado." };
  if (new Date(link.expires_at) < new Date()) return { ok: false, reason: "Link expirado." };
  return { ok: true, link };
}

// ─── Action pública: validate_card_registration_link ─────────────────────────

async function handleValidateCardRegistrationLink(body: Record<string, unknown>): Promise<Response> {
  const token = typeof body.token === "string" ? body.token : "";
  const db = serviceClient();
  const res = await resolveRegistrationLink(db, token);
  if (!res.ok) return json({ success: true, data: { valid: false, reason: res.reason } });

  const { data: student } = await db.from("students").select("nome_completo")
    .eq("id", res.link.student_id).maybeSingle();
  const { data: contractor } = await db.from("contractors").select("nome_fantasia, razao_social")
    .eq("id", res.link.contractor_id).maybeSingle();

  // Nome parcial: primeiro nome + inicial do sobrenome
  const partes = String(student?.nome_completo ?? "").trim().split(/\s+/);
  const partial = partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1][0]}.` : (partes[0] ?? "");

  return json({
    success: true,
    data: {
      valid: true,
      student_name: partial,
      company_name: contractor?.nome_fantasia ?? contractor?.razao_social ?? "",
      expires_at: res.link.expires_at,
    },
  });
}

// ─── Action pública: tokenize_card_from_link ─────────────────────────────────

async function handleTokenizeCardFromLink(
  body: Record<string, unknown>,
  secrets: SecretsValidation,
  req: Request
): Promise<Response> {
  if (!secrets.valid) return err("Configuração incompleta.", "CONFIG_INCOMPLETE", 503);

  const token = typeof body.token === "string" ? body.token : "";
  const db = serviceClient();
  const res = await resolveRegistrationLink(db, token);
  if (!res.ok) return err(res.reason, "INVALID_REGISTRATION_LINK", 410);

  const parsed = parseCardInput(body);
  if ("error" in parsed) return err(parsed.error, parsed.code, 422);

  // contractor/student vêm do LINK — nunca do body (não permite trocar pelo URL)
  const contractorId = String(res.link.contractor_id);
  const studentId    = String(res.link.student_id);
  const env          = res.link.provider_environment as "sandbox" | "production";
  const remoteIp     = clientIp(req);

  const masked = await tokenizeAndSaveCard(db, contractorId, studentId, env, parsed, remoteIp);

  // Uso único: marca o link como utilizado
  await db.from("gofit_pay_card_registration_links")
    .update({ used_at: new Date().toISOString() }).eq("id", res.link.id);

  return json({ success: true, data: masked });
}

// ═══════════════════════════════════════════════════════════════════════════
// Fase 15.3 — Cobrança de receivable usando cartão principal tokenizado
//
// REGRAS:
//   - creditCardToken é descriptografado SOMENTE aqui, no momento da cobrança,
//     usado na chamada ao Asaas e descartado (escopo de função);
//   - nunca logado, nunca retornado;
//   - idempotência: receivable com asaas_payment_id ou payment_charge ativa
//     não gera nova cobrança (retorna already_existed);
//   - a baixa financeira segue exclusivamente via webhook/sync — esta action
//     NUNCA marca a receivable como paga.
// ═══════════════════════════════════════════════════════════════════════════

const CHARGEABLE_RECEIVABLE_STATUSES = ["pendente", "atrasado", "aguardando"];

async function handleChargeReceivableWithDefaultCard(
  body: Record<string, unknown>,
  contractorId: string,
  secrets: SecretsValidation,
  req: Request
): Promise<Response> {
  if (!secrets.valid) return err("Configuração incompleta.", "CONFIG_INCOMPLETE", 503);

  const receivableId = typeof body.receivable_id === "string" ? body.receivable_id : null;
  if (!receivableId) return err("receivable_id obrigatório.", "MISSING_RECEIVABLE_ID");

  const db = serviceClient();

  // 1. Receivable do contractor logado (contractor_id NUNCA vem do body)
  const { data: receivable } = await db.from("receivables")
    .select("id, contractor_id, student_id, student_contract_id, valor, vencimento, descricao, status, asaas_payment_id")
    .eq("id", receivableId).eq("contractor_id", contractorId).maybeSingle();
  if (!receivable) return err("Conta a receber não encontrada ou não pertence a esta empresa.", "RECEIVABLE_NOT_FOUND", 404);

  if (!CHARGEABLE_RECEIVABLE_STATUSES.includes(receivable.status ?? "")) {
    return err(
      `Receivable com status '${receivable.status}' não pode ser cobrada. Permitido: ${CHARGEABLE_RECEIVABLE_STATUSES.join(", ")}.`,
      "INVALID_RECEIVABLE_STATUS", 422
    );
  }

  // 2. Idempotência — já tem cobrança ativa?
  const { data: existingCharge } = await db.from("payment_charges")
    .select("id, provider_charge_id, billing_type, status, charge_mode, card_last4, card_brand")
    .eq("receivable_id", receivableId).eq("provider", "asaas")
    .is("cancelled_at", null)
    .not("status", "in", "(CANCELLED,REFUNDED)")
    .maybeSingle();
  if (existingCharge || receivable.asaas_payment_id) {
    return json({
      success: true,
      data: {
        already_existed: true,
        charge_id: existingCharge?.id ?? null,
        provider_charge_id: existingCharge?.provider_charge_id ?? receivable.asaas_payment_id,
        status: existingCharge?.status ?? null,
        charge_mode: existingCharge?.charge_mode ?? null,
        message: "Esta parcela já possui cobrança ativa no gateway.",
      },
    });
  }

  const amount  = Number(receivable.valor ?? 0);
  const dueDate = String(receivable.vencimento ?? "").substring(0, 10);
  if (!amount || amount <= 0) return err("Valor da receivable inválido.", "INVALID_AMOUNT", 422);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return err("Vencimento da receivable inválido.", "INVALID_DUE_DATE", 422);

  const studentId = receivable.student_id;
  if (!studentId) return err("Receivable sem aluno vinculado.", "MISSING_STUDENT_ID", 422);

  // 3. Ambiente e conta ativa
  const { env: chargeEnv, productionEnabled, allowedRealCharges } = await resolveEnvironment(db, contractorId);
  if (chargeEnv === "production" && (!productionEnabled || !allowedRealCharges)) {
    return err("Cobranças em produção não autorizadas para esta empresa.", "PRODUCTION_NOT_ALLOWED", 403);
  }

  // 4. Cartão principal ativo do aluno no ambiente atual
  const { data: card } = await db.from("gofit_pay_student_cards")
    .select("id, credit_card_token_encrypted, card_brand, card_last4, provider_customer_id")
    .eq("contractor_id", contractorId).eq("student_id", studentId)
    .eq("provider_environment", chargeEnv)
    .eq("is_default", true).eq("status", "active").is("deleted_at", null)
    .maybeSingle();
  if (!card) {
    return err("Aluno não possui cartão principal cadastrado. Cadastre em Mais Ações → Cartões.", "NO_DEFAULT_CARD", 422);
  }

  let subAccInfo: { account_id: string; provider_api_key_encrypted: string; provider_account_id: string };
  try {
    subAccInfo = await assertGoFitPayActive(db, contractorId, chargeEnv);
  } catch (e) {
    if (e instanceof GoFitPayBusinessError) return err(e.message, e.code, e.httpStatus);
    throw e;
  }

  let subAccountApiKey: string;
  try {
    subAccountApiKey = await decryptSubAccountKey(subAccInfo.provider_api_key_encrypted);
  } catch {
    return err("Falha de configuração interna. Reative o GoFit Pay.", "DECRYPT_ERROR", 503);
  }

  // 5. Customer Asaas (reusa o vinculado ao cartão; fallback cria/busca)
  let providerCustomerId = card.provider_customer_id as string;
  if (!providerCustomerId) {
    try {
      const ensured = await ensureProviderCustomer(db, contractorId, studentId, subAccountApiKey);
      providerCustomerId = ensured.providerCustomerId;
    } catch (e) {
      if (e instanceof GoFitPayBusinessError) return err(e.message, e.code, e.httpStatus);
      throw e;
    }
  }

  // 6. Token descriptografado APENAS aqui — usado e descartado
  let creditCardToken: string;
  try {
    creditCardToken = await decryptSubAccountKey(card.credit_card_token_encrypted);
  } catch {
    return err("Falha ao acessar cartão cadastrado. Cadastre o cartão novamente.", "CARD_DECRYPT_ERROR", 503);
  }

  const externalRef = `gofit:rcv:${receivableId}`;
  let asaasPayment: AsaasPayment;
  try {
    asaasPayment = await AsaasService.createCreditCardPaymentWithToken(subAccountApiKey, {
      customer: providerCustomerId,
      amount,
      dueDate,
      creditCardToken,
      remoteIp: clientIp(req),
      description: receivable.descricao
        ? String(receivable.descricao).substring(0, 200)
        : `Mensalidade GoFit #${receivableId.substring(0, 8)}`,
      externalReference: externalRef,
    });
  } catch (e) {
    if (e instanceof AsaasApiError) {
      const { message } = sanitizeError(e);
      console.error(`[gofit-pay] token charge HTTP ${e.httpStatus} code=${e.code}`);
      return err(message, "ASAAS_TOKEN_CHARGE_ERROR", 502);
    }
    throw e;
  }

  // 7. Persiste payment_charge (modo tokenized_card)
  const now = new Date().toISOString();
  const { data: savedCharge, error: chargeErr } = await db.from("payment_charges").insert({
    contractor_id: contractorId, student_id: studentId,
    student_contract_id: receivable.student_contract_id ?? null,
    receivable_id: receivableId, provider: "asaas",
    provider_charge_id: asaasPayment.id, billing_type: "CREDIT_CARD",
    amount, value: amount, due_date: dueDate, status: asaasPayment.status,
    invoice_url: asaasPayment.invoiceUrl ?? null,
    payment_url: asaasPayment.invoiceUrl ?? null,
    external_reference: externalRef,
    provider_environment: chargeEnv,
    raw_response_json: sanitizePaymentForStorage(asaasPayment),
    student_card_id: card.id,
    card_last4: card.card_last4 ?? null,
    card_brand: card.card_brand ?? null,
    charge_mode: "tokenized_card",
    created_at: now, updated_at: now,
  }).select("id").single();

  if (chargeErr) {
    if (chargeErr.code === "23505") {
      const { data: recovered } = await db.from("payment_charges")
        .select("id, provider_charge_id, status")
        .eq("receivable_id", receivableId).eq("provider", "asaas").maybeSingle();
      return json({ success: true, data: { already_existed: true, charge_id: recovered?.id ?? null, provider_charge_id: recovered?.provider_charge_id ?? asaasPayment.id, status: recovered?.status ?? asaasPayment.status, message: "Cobrança já existente (concorrência)." } });
    }
    console.error(`[gofit-pay] token charge save error: code=${chargeErr.code}`);
    return err("Falha ao salvar cobrança. Cobrança foi criada no Asaas.", "CHARGE_SAVE_ERROR", 500);
  }

  // 8. Atualiza APENAS gateway fields — baixa fica para o webhook/sync
  await db.from("receivables").update({
    asaas_payment_id: asaasPayment.id, asaas_customer_id: providerCustomerId,
    asaas_payment_url: asaasPayment.invoiceUrl ?? null,
    gateway_status: asaasPayment.status, gateway_provider: "asaas",
  }).eq("id", receivableId);

  console.log(
    `[gofit-pay] TOKENIZED CHARGE: contractor=${contractorId} receivable=${receivableId} ` +
    `charge=${asaasPayment.id} status=${asaasPayment.status} env=${chargeEnv} ` +
    `card=${card.card_brand ?? "?"}-${card.card_last4 ?? "?"}`
  );

  return json({
    success: true,
    data: {
      already_existed: false,
      charge_id: savedCharge.id,
      provider_charge_id: asaasPayment.id,
      billing_type: "CREDIT_CARD",
      charge_mode: "tokenized_card",
      status: asaasPayment.status,
      amount,
      due_date: dueDate,
      card_brand: card.card_brand ?? null,
      card_last4: card.card_last4 ?? null,
      provider_environment: chargeEnv,
      message: `Cobrança enviada ao cartão ${card.card_brand ?? ""} **** ${card.card_last4 ?? ""}.`,
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  if (req.method === "POST" && url.searchParams.get("source") === "webhook") {
    try {
      return await handleWebhookReceive(req);
    } catch (e) {
      const { message, code } = sanitizeError(e);
      return err(message, code, 500);
    }
  }

  if (req.method !== "POST") return err("Método não permitido.", "METHOD_NOT_ALLOWED", 405);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return err("Body JSON inválido.", "INVALID_BODY", 400);
  }

  const action = typeof body?.action === "string" ? body.action : null;

  if (action === "ping") return json({ success: true, data: { pong: true, phase: 9 } });

  // ── Ações PÚBLICAS do link de cadastro de cartão (sem login do painel) ──
  // Segurança: o token do link identifica contractor+student; valida hash,
  // expiração e revogação server-side. Nada além disso é exposto.
  if (action === "validate_card_registration_link") {
    try {
      return await handleValidateCardRegistrationLink(body);
    } catch (e) {
      const { message, code } = sanitizeError(e);
      return err(message, code, 500);
    }
  }
  if (action === "tokenize_card_from_link") {
    try {
      return await handleTokenizeCardFromLink(body, validateSecrets(), req);
    } catch (e) {
      if (e instanceof GoFitPayBusinessError) return err(e.message, e.code, e.httpStatus);
      if (e instanceof AsaasApiError) {
        const { message } = sanitizeError(e);
        console.error(`[gofit-pay] tokenize_from_link AsaasApiError HTTP ${e.httpStatus} code=${e.code}`);
        return err(message, e.code, 502);
      }
      const { message, code } = sanitizeError(e);
      console.error(`[gofit-pay] tokenize_from_link error: ${(e as Error)?.name ?? "Error"}`);
      return err(message, code, 500);
    }
  }

  const identity = await resolveContractor(req);
  if (!identity) return err("Não autenticado ou empresa não encontrada.", "UNAUTHORIZED", 401);

  const secrets = validateSecrets();

  try {
    switch (action) {
      case "health-check":
        return await handleHealthCheck(identity.contractorId, secrets);

      case "activate_gofit_pay":
      case "create-account":
        return await handleActivateGoFitPay(identity.contractorId, secrets);

      case "get_activation_status":
        return await handleGetActivationStatus(identity.contractorId);

      case "retry_activation":
        return await handleRetryActivation(identity.contractorId, secrets);

      case "create_payment_charge":
        return await handleCreatePaymentCharge(body, identity.contractorId, secrets);

      case "get_or_create_customer":
        return await handleGetOrCreateCustomer(body, identity.contractorId, secrets);

      case "get_charge":
        return await handleGetCharge(body, identity.contractorId);

      case "list_charges":
        return await handleListCharges(body, identity.contractorId);

      case "sync_charge_status":
        return await handleSyncChargeStatus(body, identity.contractorId, secrets);

      case "process_webhook_event":
        return await handleProcessWebhookEvent(body, identity.contractorId);

      case "process_pending_webhooks":
        return await handleProcessPendingWebhooks(body, identity.contractorId);

      case "get_collection_overview":
        return await handleGetCollectionOverview(body, identity.contractorId);

      case "add_collection_note":
        return await handleAddCollectionNote(body, identity.contractorId, identity.userId);

      case "get_collection_notes":
        return await handleGetCollectionNotes(body, identity.contractorId);

      case "get_fees":
        return await handleGetFees(identity.contractorId);

      case "preview_recurring_charges":
        return await handlePreviewRecurringCharges(body, identity.contractorId);

      case "create_recurring_charges":
        return await handleCreateRecurringCharges(body, identity.contractorId, secrets);

      case "get_reports":
        return await handleGetReports(body, identity.contractorId);

      case "get_environment_status":
        return await handleGetEnvironmentStatus(identity.contractorId);

      case "validate_production_readiness":
        return await handleValidateProductionReadiness(identity.contractorId, secrets);

      case "enable_production_pilot":
        return await handleEnableProductionPilot(body, identity.contractorId);

      case "disable_production_pilot":
        return await handleDisableProductionPilot(body, identity.contractorId);

      case "link_production_account":
        return await handleLinkProductionAccount(body, identity.contractorId);

      case "list_student_cards":
        return await handleListStudentCards(body, identity.contractorId);

      case "tokenize_student_card":
        return await handleTokenizeStudentCard(body, identity.contractorId, secrets, req);

      case "set_default_student_card":
        return await handleSetDefaultStudentCard(body, identity.contractorId);

      case "deactivate_student_card":
        return await handleDeactivateStudentCard(body, identity.contractorId);

      case "create_card_registration_link":
        return await handleCreateCardRegistrationLink(body, identity.contractorId, identity.userId);

      case "charge_receivable_with_default_card":
        return await handleChargeReceivableWithDefaultCard(body, identity.contractorId, secrets, req);

      case "cancel_charge":
      case "cancel-charge":
        return await handleCancelCharge(body, identity.contractorId, secrets);

      case "create-charge":
        return err("Use action 'create_payment_charge' (Fase 6).", "USE_CREATE_PAYMENT_CHARGE", 400);

      case "webhook-receive":
        return err("Use ?source=webhook com header asaas-access-token.", "USE_WEBHOOK_ENDPOINT", 400);

      case null:
        return err("Campo 'action' obrigatório.", "MISSING_ACTION", 400);

      default:
        return err(`Ação desconhecida: '${action}'.`, "UNKNOWN_ACTION", 400);
    }
  } catch (e) {
    if (e instanceof GoFitPayBusinessError) return err(e.message, e.code, e.httpStatus);
    if (e instanceof AsaasConfigError) {
      console.error("[gofit-pay] AsaasConfigError:", e.name);
      return err("Configuração de gateway incompleta.", "CONFIG_ERROR", 503);
    }
    if (e instanceof AsaasApiError) {
      const { message } = sanitizeError(e);
      console.error(`[gofit-pay] AsaasApiError HTTP ${e.httpStatus} code=${e.code}`);
      return err(message, e.code, 502);
    }
    if (e instanceof AsaasNotImplementedError) return err(e.message, "NOT_IMPLEMENTED", 501);
    const { message, code } = sanitizeError(e);
    console.error(`[gofit-pay] Unhandled: ${(e as Error)?.name ?? "Error"}`);
    return err(message, code, 500);
  }
});
