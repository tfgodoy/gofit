/**
 * Edge Function: gofit-pay-base  v5
 * Fase 6 — Emissão de cobranças Pix/Boleto para receivables existentes
 *
 * SEGURANÇA:
 *   - validateSecrets() em toda requisição
 *   - Todos os erros passam por sanitizeError()
 *   - provider_api_key_encrypted nunca em responses — descriptografada APENAS aqui
 *   - ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN, GOFIT_PAY_ENCRYPTION_KEY nunca em logs/response
 *   - contractor_id sempre resolvido pelo JWT — nunca pelo body
 *
 * AÇÕES DISPONÍVEIS:
 *   ping                    → keepalive
 *   health-check            → diagnóstico completo
 *   activate_gofit_pay      → Fase 5: cria subconta Asaas
 *   get_activation_status   → Fase 5: retorna status atual
 *   retry_activation        → Fase 5: retry após activation_failed
 *   create-account          → alias de activate_gofit_pay
 *   create_payment_charge   → Fase 6: cria cobrança Pix/Boleto para receivable
 *   get_or_create_customer  → Fase 6: garante customer Asaas para aluno
 *   get_charge              → Fase 6: detalhe de uma cobrança
 *   list_charges            → Fase 6: lista cobranças do contractor
 *   cancel-charge           → Fase 7: stub
 *   ?source=webhook         → endpoint de webhooks Asaas
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

/* ─── Helpers de conta ──────────────────────────────────────────────── */
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

async function getGoFitPayModuleId(db: ReturnType<typeof serviceClient>): Promise<string | null> {
  const { data } = await db
    .from("modules")
    .select("id")
    .eq("slug", "gofit_pay")
    .maybeSingle();
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

/* ─── Helper: verifica se GoFit Pay está active ─────────────────────── */
async function assertGoFitPayActive(
  db: ReturnType<typeof serviceClient>,
  contractorId: string
): Promise<{
  account_id:                  string;
  provider_api_key_encrypted:  string;
  provider_account_id:         string;
}> {
  const moduleId = await getGoFitPayModuleId(db);
  if (moduleId) {
    const { data: cm } = await db
      .from("company_modules")
      .select("status")
      .eq("contractor_id", contractorId)
      .eq("module_id", moduleId)
      .maybeSingle();
    if (cm?.status !== "active") {
      throw new GoFitPayBusinessError(
        "GoFit Pay não está ativo para esta empresa.",
        "GOFIT_PAY_NOT_ACTIVE",
        402
      );
    }
  }

  const { data: account, error } = await db
    .from("gofit_pay_accounts")
    .select("id, status, provider_account_id, provider_api_key_encrypted")
    .eq("contractor_id", contractorId)
    .eq("provider", "asaas")
    .maybeSingle();

  if (error || !account) {
    throw new GoFitPayBusinessError(
      "Conta GoFit Pay não encontrada. Ative o módulo primeiro.",
      "ACCOUNT_NOT_FOUND",
      404
    );
  }
  if (account.status !== "active") {
    throw new GoFitPayBusinessError(
      `Conta GoFit Pay com status '${account.status}'. Aguarde a aprovação.`,
      "ACCOUNT_NOT_ACTIVE",
      402
    );
  }
  if (!account.provider_api_key_encrypted) {
    throw new GoFitPayBusinessError(
      "Chave da subconta não configurada. Reative o GoFit Pay.",
      "MISSING_SUBACCOUNT_KEY",
      503
    );
  }

  return {
    account_id:                 account.id,
    provider_api_key_encrypted: account.provider_api_key_encrypted,
    provider_account_id:        account.provider_account_id ?? "",
  };
}

/* ─── Sanitização de response Asaas para armazenamento ─────────────── */
function sanitizePaymentForStorage(payment: AsaasPayment): Record<string, unknown> {
  return {
    id:               payment.id,
    customer:         payment.customer,
    billingType:      payment.billingType,
    value:            payment.value,
    netValue:         payment.netValue,
    status:           payment.status,
    dueDate:          payment.dueDate,
    invoiceUrl:       payment.invoiceUrl,
    bankSlipUrl:      payment.bankSlipUrl,
    externalReference: payment.externalReference ?? null,
    description:      payment.description ?? null,
  };
}

/* ─── Erro de negócio ────────────────────────────────────────────────── */
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

/* ══════════════════════════════════════════════════════════════════════
   HANDLERS — Fase 5 (inalterados)
   ══════════════════════════════════════════════════════════════════════ */

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
  const accountComplete = !!(account?.provider_account_id && account?.provider_account_id);
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

  const requiredFields = [
    "cnpj", "razao_social", "tipo_empresa",
    "resp_email", "resp_celular", "resp_nascimento",
    "logradouro", "numero_end", "bairro", "cep",
  ];
  const missingFields = requiredFields.filter(f => !cfg[f as keyof typeof cfg]);
  if (missingFields.length > 0) {
    return err(
      `Campos obrigatórios não preenchidos: ${missingFields.join(", ")}. Complete o wizard.`,
      "MISSING_REQUIRED_FIELDS", 422
    );
  }

  const { data: existing } = await db
    .from("gofit_pay_accounts")
    .select("id, status, provider_account_id, provider_wallet_id")
    .eq("contractor_id", contractorId)
    .eq("provider", "asaas")
    .maybeSingle();

  if (existing?.provider_account_id) {
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

  await db
    .from("gofit_pay_config")
    .update({ onboarding_status: newOnboarding, updated_at: now })
    .eq("contractor_id", contractorId);

  const moduleId = await getGoFitPayModuleId(db);
  if (moduleId) {
    await updateCompanyModuleStatus(db, contractorId, moduleId, gofitStatus);
  }

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

  if (!existing || !existing.provider_account_id) {
    return handleActivateGoFitPay(contractorId, secrets);
  }

  if (existing.status !== "activation_failed") {
    return err(
      `Retry só permitido em estado 'activation_failed'. Status atual: '${existing.status}'.`,
      "INVALID_STATUS_FOR_RETRY", 409
    );
  }

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

  await db
    .from("gofit_pay_config")
    .update({ onboarding_status: "enviado", updated_at: now })
    .eq("contractor_id", contractorId);

  return handleActivateGoFitPay(contractorId, secrets);
}

/* ══════════════════════════════════════════════════════════════════════
   HANDLERS — Fase 6: Emissão de cobranças Pix/Boleto
   ══════════════════════════════════════════════════════════════════════ */

/**
 * get_or_create_customer — Garante que o aluno tem customer Asaas na subconta.
 *
 * Body: { action, student_id }
 * Retorna: { customer_id (interno), provider_customer_id }
 *
 * Não retorna dados sensíveis da subconta.
 */
async function handleGetOrCreateCustomer(
  body: Record<string, unknown>,
  contractorId: string,
  secrets: SecretsValidation
): Promise<Response> {
  if (!secrets.valid) {
    return err("Configuração incompleta.", "CONFIG_INCOMPLETE", 503);
  }

  const studentId = typeof body.student_id === "string" ? body.student_id : null;
  if (!studentId) return err("student_id obrigatório.", "MISSING_STUDENT_ID");

  const db = serviceClient();

  // Valida GoFit Pay active + pega chave da subconta
  let subAccInfo: { account_id: string; provider_api_key_encrypted: string; provider_account_id: string };
  try {
    subAccInfo = await assertGoFitPayActive(db, contractorId);
  } catch (e) {
    if (e instanceof GoFitPayBusinessError) return err(e.message, e.code, e.httpStatus);
    throw e;
  }

  // Busca aluno (verifica ownership)
  const { data: student } = await db
    .from("students")
    .select("id, nome_completo, cpf, email, telefone")
    .eq("id", studentId)
    .eq("contractor_id", contractorId)
    .maybeSingle();

  if (!student) {
    return err("Aluno não encontrado ou não pertence a esta empresa.", "STUDENT_NOT_FOUND", 404);
  }

  // Verifica se já existe customer local
  const { data: existingCustomer } = await db
    .from("payment_customers")
    .select("id, provider_customer_id")
    .eq("contractor_id", contractorId)
    .eq("student_id", studentId)
    .eq("provider", "asaas")
    .maybeSingle();

  if (existingCustomer?.provider_customer_id) {
    return json({
      success: true,
      data: {
        customer_id:          existingCustomer.id,
        provider_customer_id: existingCustomer.provider_customer_id,
        already_existed:      true,
      },
    });
  }

  // Descriptografa chave da subconta — só em memória
  let subAccountApiKey: string;
  try {
    subAccountApiKey = await decryptSubAccountKey(subAccInfo.provider_api_key_encrypted);
  } catch (e) {
    console.error(`[gofit-pay] Decrypt error: ${(e as Error)?.name ?? "Error"}`);
    return err("Falha de configuração interna. Reative o GoFit Pay.", "DECRYPT_ERROR", 503);
  }

  // Cria customer no Asaas
  let asaasCustomer: AsaasCustomer;
  try {
    asaasCustomer = await AsaasService.upsertCustomer(subAccountApiKey, {
      name:               String(student.nome_completo),
      cpfCnpj:            student.cpf    ?? undefined,
      email:              student.email  ?? undefined,
      phone:              student.telefone ?? undefined,
      externalReference:  `gofit:stu:${studentId}`,
    });
  } catch (e) {
    if (e instanceof AsaasApiError) {
      const { message } = sanitizeError(e);
      console.error(`[gofit-pay] upsertCustomer AsaasApiError HTTP ${e.httpStatus} code=${e.code}`);
      return err(message, "ASAAS_CUSTOMER_ERROR", 502);
    }
    throw e;
  }

  // Salva payment_customer
  const now = new Date().toISOString();
  const { data: savedCustomer, error: custErr } = await db
    .from("payment_customers")
    .insert({
      contractor_id:        contractorId,
      student_id:           studentId,
      client_id:            studentId,   // alias de compat
      provider:             "asaas",
      provider_customer_id: asaasCustomer.id,
      name:                 String(student.nome_completo),
      email:                student.email    ?? null,
      cpf_cnpj:             student.cpf      ?? null,
      phone:                student.telefone ?? null,
      synced_at:            now,
      created_at:           now,
      updated_at:           now,
    })
    .select("id")
    .single();

  if (custErr) {
    // Conflito de constraint → recupera registro existente
    if (custErr.code === "23505") {
      const { data: recovered } = await db
        .from("payment_customers")
        .select("id, provider_customer_id")
        .eq("contractor_id", contractorId)
        .eq("student_id", studentId)
        .eq("provider", "asaas")
        .maybeSingle();
      return json({
        success: true,
        data: {
          customer_id:          recovered?.id ?? null,
          provider_customer_id: recovered?.provider_customer_id ?? asaasCustomer.id,
          already_existed:      true,
        },
      });
    }
    console.error(`[gofit-pay] payment_customers insert error: ${custErr.code}`);
    return err("Falha ao salvar customer.", "CUSTOMER_SAVE_ERROR", 500);
  }

  return json({
    success: true,
    data: {
      customer_id:          savedCustomer.id,
      provider_customer_id: asaasCustomer.id,
      already_existed:      false,
    },
  });
}

/**
 * create_payment_charge — FASE 6
 *
 * Cria cobrança Pix ou Boleto para uma receivable existente.
 *
 * Body: { action, receivable_id, billing_type }
 *   billing_type: "PIX" | "BOLETO"
 *
 * Fluxo:
 *   1. Valida billing_type
 *   2. Carrega receivable (verifica ownership + status)
 *   3. Idempotência: receivable já tem cobrança?
 *   4. Verifica GoFit Pay active + descriptografa chave da subconta
 *   5. Carrega aluno
 *   6. Garante customer Asaas (get_or_create)
 *   7. Cria cobrança Asaas (PIX ou BOLETO)
 *   8. Se PIX, busca QR code
 *   9. Salva payment_charges
 *  10. Atualiza receivable.gateway_*
 *  11. Retorna resposta sanitizada
 *
 * SEGURANÇA:
 *   - contractor_id vem do JWT, nunca do body
 *   - subAccountApiKey fica apenas em memória (nunca em log/response)
 *   - pix_qr_code (base64) salvo apenas no banco; retornado para o frontend
 *   - raw_response_json: sanitizado (sem campos sensíveis)
 */
async function handleCreatePaymentCharge(
  body: Record<string, unknown>,
  contractorId: string,
  secrets: SecretsValidation
): Promise<Response> {
  if (!secrets.valid) {
    return err("Configuração incompleta.", "CONFIG_INCOMPLETE", 503);
  }

  const receivableId = typeof body.receivable_id === "string" ? body.receivable_id : null;
  const billingType  = typeof body.billing_type  === "string" ? body.billing_type.toUpperCase() : null;

  if (!receivableId) return err("receivable_id obrigatório.", "MISSING_RECEIVABLE_ID");
  if (!billingType)  return err("billing_type obrigatório.", "MISSING_BILLING_TYPE");
  if (billingType !== "PIX" && billingType !== "BOLETO") {
    return err("billing_type inválido. Use PIX ou BOLETO.", "INVALID_BILLING_TYPE");
  }

  const db = serviceClient();

  // ── 1. Carrega receivable (verifica ownership) ──────────────────────
  const { data: receivable, error: rcvErr } = await db
    .from("receivables")
    .select("id, contractor_id, student_id, student_contract_id, valor, vencimento, descricao, status, asaas_payment_id, gateway_provider")
    .eq("id", receivableId)
    .eq("contractor_id", contractorId)
    .maybeSingle();

  if (rcvErr || !receivable) {
    return err("Conta a receber não encontrada ou não pertence a esta empresa.", "RECEIVABLE_NOT_FOUND", 404);
  }

  // ── 2. Valida status da receivable ───────────────────────────────────
  const allowedStatuses = ["pendente", "atrasado", "aguardando"];
  if (!allowedStatuses.includes(receivable.status ?? "")) {
    return err(
      `Não é possível gerar cobrança para receivable com status '${receivable.status}'. ` +
      `Permitido: ${allowedStatuses.join(", ")}.`,
      "INVALID_RECEIVABLE_STATUS"
    );
  }

  // ── 3. Valida valor e vencimento ────────────────────────────────────
  const amount  = Number(receivable.valor ?? 0);
  const dueDate = String(receivable.vencimento ?? "");
  if (!amount || amount <= 0) {
    return err("Valor da receivable inválido.", "INVALID_AMOUNT");
  }
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}/.test(dueDate)) {
    return err("Vencimento da receivable inválido.", "INVALID_DUE_DATE");
  }
  const dueDateFormatted = dueDate.substring(0, 10);

  // ── 4. Idempotência ─────────────────────────────────────────────────
  if (receivable.asaas_payment_id) {
    const { data: existingCharge } = await db
      .from("payment_charges")
      .select("id, provider_charge_id, billing_type, status, invoice_url, bank_slip_url, pix_qr_code, pix_copy_paste")
      .eq("receivable_id", receivableId)
      .eq("provider", "asaas")
      .maybeSingle();

    if (existingCharge) {
      console.log(`[gofit-pay] Idempotência: receivable ${receivableId} já tem cobrança ${existingCharge.provider_charge_id}`);
      return json({
        success: true,
        data: {
          charge_id:            existingCharge.id,
          provider_charge_id:   existingCharge.provider_charge_id,
          billing_type:         existingCharge.billing_type,
          status:               existingCharge.status,
          amount,
          due_date:             dueDateFormatted,
          invoice_url:          existingCharge.invoice_url   ?? null,
          bank_slip_url:        existingCharge.bank_slip_url ?? null,
          pix_qr_code:          existingCharge.pix_qr_code   ?? null,
          pix_copy_paste:       existingCharge.pix_copy_paste ?? null,
          already_existed:      true,
          message:              "Cobrança já existente para esta receivable.",
        },
      });
    }
  }

  // Verifica também na tabela de cobranças (sem asaas_payment_id na receivable)
  const { data: chargeCheck } = await db
    .from("payment_charges")
    .select("id, provider_charge_id, billing_type, status, invoice_url, bank_slip_url, pix_qr_code, pix_copy_paste")
    .eq("receivable_id", receivableId)
    .eq("provider", "asaas")
    .maybeSingle();

  if (chargeCheck) {
    return json({
      success: true,
      data: {
        charge_id:          chargeCheck.id,
        provider_charge_id: chargeCheck.provider_charge_id,
        billing_type:       chargeCheck.billing_type,
        status:             chargeCheck.status,
        amount,
        due_date:           dueDateFormatted,
        invoice_url:        chargeCheck.invoice_url   ?? null,
        bank_slip_url:      chargeCheck.bank_slip_url ?? null,
        pix_qr_code:        chargeCheck.pix_qr_code   ?? null,
        pix_copy_paste:     chargeCheck.pix_copy_paste ?? null,
        already_existed:    true,
        message:            "Cobrança já existente para esta receivable.",
      },
    });
  }

  // ── 5. Valida GoFit Pay active + chave da subconta ───────────────────
  let subAccInfo: { account_id: string; provider_api_key_encrypted: string; provider_account_id: string };
  try {
    subAccInfo = await assertGoFitPayActive(db, contractorId);
  } catch (e) {
    if (e instanceof GoFitPayBusinessError) return err(e.message, e.code, e.httpStatus);
    throw e;
  }

  // ── 6. Carrega aluno ────────────────────────────────────────────────
  const studentId = receivable.student_id;
  if (!studentId) {
    return err("Receivable sem student_id.", "MISSING_STUDENT_ID", 422);
  }

  const { data: student } = await db
    .from("students")
    .select("id, nome_completo, cpf, email, telefone")
    .eq("id", studentId)
    .eq("contractor_id", contractorId)
    .maybeSingle();

  if (!student) {
    return err("Aluno não encontrado ou não pertence a esta empresa.", "STUDENT_NOT_FOUND", 404);
  }

  // ── 7. Descriptografa chave da subconta — só em memória ─────────────
  let subAccountApiKey: string;
  try {
    subAccountApiKey = await decryptSubAccountKey(subAccInfo.provider_api_key_encrypted);
  } catch (e) {
    console.error(`[gofit-pay] Decrypt error: ${(e as Error)?.name ?? "Error"}`);
    return err("Falha de configuração interna. Reative o GoFit Pay.", "DECRYPT_ERROR", 503);
  }

  // ── 8. Get or create customer Asaas ─────────────────────────────────
  let providerCustomerId: string;

  const { data: existingCust } = await db
    .from("payment_customers")
    .select("id, provider_customer_id")
    .eq("contractor_id", contractorId)
    .eq("student_id", studentId)
    .eq("provider", "asaas")
    .maybeSingle();

  if (existingCust?.provider_customer_id) {
    providerCustomerId = existingCust.provider_customer_id;
    console.log(`[gofit-pay] Customer existente: ${providerCustomerId}`);
  } else {
    let asaasCustomer: AsaasCustomer;
    try {
      asaasCustomer = await AsaasService.upsertCustomer(subAccountApiKey, {
        name:              String(student.nome_completo),
        cpfCnpj:           student.cpf      ?? undefined,
        email:             student.email    ?? undefined,
        phone:             student.telefone ?? undefined,
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

    const now = new Date().toISOString();
    const { error: custInsertErr } = await db
      .from("payment_customers")
      .insert({
        contractor_id:        contractorId,
        student_id:           studentId,
        client_id:            studentId,
        provider:             "asaas",
        provider_customer_id: asaasCustomer.id,
        name:                 String(student.nome_completo),
        email:                student.email    ?? null,
        cpf_cnpj:             student.cpf      ?? null,
        phone:                student.telefone ?? null,
        synced_at:            now,
        created_at:           now,
        updated_at:           now,
      });

    if (custInsertErr && custInsertErr.code !== "23505") {
      // Não fatal — continua com o customer criado no Asaas
      console.error(`[gofit-pay] payment_customers insert warn: ${custInsertErr.code}`);
    }
  }

  // ── 9. Cria cobrança Asaas (PIX ou BOLETO) ───────────────────────────
  const externalRef = `gofit:rcv:${receivableId}`;

  let asaasPayment: AsaasPayment;
  try {
    asaasPayment = await AsaasService.createPayment(subAccountApiKey, {
      customer:          providerCustomerId,
      billingType:       billingType as "PIX" | "BOLETO",
      amount,
      dueDate:           dueDateFormatted,
      description:       receivable.descricao
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

  // ── 10. Para PIX, busca QR code ──────────────────────────────────────
  let pixQrCode: AsaasPixQrCode | null = null;
  if (billingType === "PIX") {
    try {
      pixQrCode = await AsaasService.getPixQrCode(subAccountApiKey, asaasPayment.id);
    } catch (e) {
      // Não fatal — continua sem QR code; o link da fatura funciona
      console.error(`[gofit-pay] getPixQrCode warn: ${(e as Error)?.name ?? "Error"}`);
    }
  }

  // ── 11. Salva payment_charges ────────────────────────────────────────
  const now = new Date().toISOString();
  const { data: savedCharge, error: chargeErr } = await db
    .from("payment_charges")
    .insert({
      contractor_id:      contractorId,
      student_id:         studentId,
      student_contract_id: receivable.student_contract_id ?? null,
      receivable_id:      receivableId,
      provider:           "asaas",
      provider_charge_id: asaasPayment.id,
      billing_type:       billingType,
      amount,
      value:              amount,         // alias
      due_date:           dueDateFormatted,
      status:             asaasPayment.status,
      invoice_url:        asaasPayment.invoiceUrl    ?? null,
      bank_slip_url:      asaasPayment.bankSlipUrl   ?? null,
      pix_qr_code:        pixQrCode?.encodedImage    ?? null,
      pix_copy_paste:     pixQrCode?.payload         ?? null,
      payment_url:        asaasPayment.invoiceUrl    ?? null,
      external_reference: externalRef,
      raw_response_json:  sanitizePaymentForStorage(asaasPayment),
      created_at:         now,
      updated_at:         now,
    })
    .select("id")
    .single();

  if (chargeErr) {
    if (chargeErr.code === "23505") {
      // Corrida de requests — recupera cobrança existente
      const { data: recovered } = await db
        .from("payment_charges")
        .select("id, provider_charge_id, billing_type, status, invoice_url, bank_slip_url, pix_qr_code, pix_copy_paste")
        .eq("receivable_id", receivableId)
        .eq("provider", "asaas")
        .maybeSingle();
      return json({
        success: true,
        data: {
          charge_id:          recovered?.id ?? null,
          provider_charge_id: recovered?.provider_charge_id ?? asaasPayment.id,
          billing_type:       billingType,
          status:             recovered?.status ?? asaasPayment.status,
          amount,
          due_date:           dueDateFormatted,
          invoice_url:        recovered?.invoice_url   ?? asaasPayment.invoiceUrl   ?? null,
          bank_slip_url:      recovered?.bank_slip_url ?? asaasPayment.bankSlipUrl  ?? null,
          pix_qr_code:        recovered?.pix_qr_code   ?? pixQrCode?.encodedImage   ?? null,
          pix_copy_paste:     recovered?.pix_copy_paste ?? pixQrCode?.payload        ?? null,
          already_existed:    true,
          message:            "Cobrança já existente (conflito de concorrência).",
        },
      });
    }
    const safeMsg = chargeErr.message.substring(0, 100).replace(/\s+/g, " ");
    console.error(`[gofit-pay] payment_charges insert error: code=${chargeErr.code} ${safeMsg}`);
    return err("Falha ao salvar cobrança. Cobrança foi criada no Asaas.", "CHARGE_SAVE_ERROR", 500);
  }

  // ── 12. Atualiza receivable com campos gateway ────────────────────────
  await db
    .from("receivables")
    .update({
      asaas_payment_id:  asaasPayment.id,
      asaas_customer_id: providerCustomerId,
      asaas_payment_url: asaasPayment.invoiceUrl ?? null,
      gateway_status:    asaasPayment.status,
      gateway_provider:  "asaas",
    })
    .eq("id", receivableId);

  console.log(
    `[gofit-pay] Cobrança Fase 6 criada: ` +
    `charge=${savedCharge.id} providerCharge=${asaasPayment.id} ` +
    `rcv=${receivableId} type=${billingType} value=${amount}`
  );

  // ── 13. Resposta sanitizada ──────────────────────────────────────────
  // NUNCA incluir: subAccountApiKey, provider_api_key_encrypted, ASAAS_API_KEY
  return json({
    success: true,
    data: {
      charge_id:          savedCharge.id,
      provider_charge_id: asaasPayment.id,
      billing_type:       billingType,
      status:             asaasPayment.status,
      amount,
      due_date:           dueDateFormatted,
      invoice_url:        asaasPayment.invoiceUrl    ?? null,
      bank_slip_url:      asaasPayment.bankSlipUrl   ?? null,
      pix_qr_code:        pixQrCode?.encodedImage    ?? null,
      pix_copy_paste:     pixQrCode?.payload         ?? null,
      already_existed:    false,
      message:            billingType === "PIX"
        ? "Cobrança Pix criada com sucesso."
        : "Cobrança Boleto criada com sucesso.",
    },
  });
}

/**
 * get_charge — Retorna detalhes de uma cobrança pelo ID interno.
 * Body: { action, charge_id }
 */
async function handleGetCharge(
  body: Record<string, unknown>,
  contractorId: string
): Promise<Response> {
  const chargeId = typeof body.charge_id === "string" ? body.charge_id : null;
  if (!chargeId) return err("charge_id obrigatório.", "MISSING_CHARGE_ID");

  const db = serviceClient();

  const { data: charge, error } = await db
    .from("payment_charges")
    .select("id, contractor_id, student_id, receivable_id, provider, provider_charge_id, billing_type, amount, value, due_date, status, invoice_url, bank_slip_url, pix_qr_code, pix_copy_paste, payment_url, external_reference, paid_at, created_at, updated_at")
    .eq("id", chargeId)
    .eq("contractor_id", contractorId)
    .maybeSingle();

  if (error || !charge) {
    return err("Cobrança não encontrada.", "CHARGE_NOT_FOUND", 404);
  }

  return json({ success: true, data: charge });
}

/**
 * list_charges — Lista cobranças do contractor.
 * Body: { action, student_id?, receivable_id?, status?, limit?, offset? }
 */
async function handleListCharges(
  body: Record<string, unknown>,
  contractorId: string
): Promise<Response> {
  const db = serviceClient();

  let query = db
    .from("payment_charges")
    .select("id, student_id, receivable_id, provider, provider_charge_id, billing_type, amount, value, due_date, status, invoice_url, bank_slip_url, pix_qr_code, pix_copy_paste, paid_at, created_at, updated_at")
    .eq("contractor_id", contractorId)
    .order("created_at", { ascending: false });

  if (typeof body.student_id    === "string") query = query.eq("student_id",    body.student_id);
  if (typeof body.receivable_id === "string") query = query.eq("receivable_id", body.receivable_id);
  if (typeof body.status        === "string") query = query.eq("status",        body.status);

  const limit  = typeof body.limit  === "number" ? Math.min(body.limit, 100)  : 50;
  const offset = typeof body.offset === "number" ? body.offset : 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    console.error(`[gofit-pay] list_charges error: ${error.message}`);
    return err("Falha ao listar cobranças.", "LIST_CHARGES_ERROR", 500);
  }

  return json({ success: true, data: data ?? [] });
}

/* ─── cancel-charge — Fase 7 (stub) ─────────────────────────────────── */
async function handleCancelCharge(): Promise<Response> {
  return err("Cancelamento de cobranças disponível na Fase 7.", "NOT_IMPLEMENTED_PHASE_7", 501);
}

/* ══════════════════════════════════════════════════════════════════════
   WEBHOOK
   ══════════════════════════════════════════════════════════════════════ */

async function resolveContractorFromWebhook(
  db: ReturnType<typeof serviceClient>,
  paymentObj: Record<string, unknown> | null,
  payload: Record<string, unknown>
): Promise<string | null> {

  // 1. Tenta por provider_charge_id (payment.id)
  if (typeof paymentObj?.id === "string" && paymentObj.id) {
    const { data: charge } = await db
      .from("payment_charges")
      .select("contractor_id")
      .eq("provider_charge_id", paymentObj.id)
      .maybeSingle();
    if (charge?.contractor_id) return charge.contractor_id;
  }

  // 2. Tenta por externalReference (Fase 6: "gofit:rcv:{uuid}")
  if (typeof paymentObj?.externalReference === "string" && paymentObj.externalReference) {
    const { data: charge } = await db
      .from("payment_charges")
      .select("contractor_id")
      .eq("external_reference", paymentObj.externalReference)
      .maybeSingle();
    if (charge?.contractor_id) return charge.contractor_id;
  }

  // 3. Tenta por provider_account_id da subconta
  const accountObj = (
    payload.account    && typeof payload.account    === "object" ? payload.account    :
    payload.subaccount && typeof payload.subaccount === "object" ? payload.subaccount :
    null
  ) as Record<string, unknown> | null;

  if (typeof accountObj?.id === "string" && accountObj.id) {
    const { data: acct } = await db
      .from("gofit_pay_accounts")
      .select("contractor_id")
      .eq("provider_account_id", accountObj.id)
      .maybeSingle();
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

  if (providerEventId) {
    const { data: dup } = await db
      .from("gofit_pay_webhook_events")
      .select("id")
      .eq("provider", "asaas")
      .eq("provider_event_id", providerEventId)
      .maybeSingle();
    if (dup) {
      return json({ success: true, data: { duplicate: true, message: "Evento já registrado." } });
    }
  }

  const contractorId = await resolveContractorFromWebhook(db, paymentObj, payload);

  const { error: insertErr } = await db
    .from("gofit_pay_webhook_events")
    .insert({
      contractor_id:       contractorId,
      provider:            "asaas",
      event_type:          eventType,
      provider_event_id:   providerEventId,
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
    const safeMsg = insertErr.message.substring(0, 120).replace(/\s+/g, " ");
    console.error(`[gofit-pay-webhook] Insert failed: code=${insertErr.code} hint=${safeMsg}`);
    return json({
      success: false,
      data:    { queued: false, error: "Falha ao registrar evento. Verifique os logs da Edge Function." },
    }, 200); // 200 para não acionar retry do Asaas
  }

  console.log(
    `[gofit-pay-webhook] Evento registrado: type=${eventType} ` +
    `eventId=${providerEventId ?? "?"} payId=${providerPayId ?? "?"} ` +
    `contractor=${contractorId ?? "unresolved"}`
  );

  return json({
    success: true,
    data: {
      queued:              true,
      processed:           false,
      contractor_resolved: contractorId !== null,
      event_type:          eventType,
      message: contractorId
        ? "Evento registrado."
        : "Evento registrado. Contractor não resolvido — será processado na Fase 7.",
    },
  });
}

/* ══════════════════════════════════════════════════════════════════════
   ROTEADOR PRINCIPAL
   ══════════════════════════════════════════════════════════════════════ */

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

  if (req.method !== "POST") {
    return err("Método não permitido.", "METHOD_NOT_ALLOWED", 405);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return err("Body JSON inválido.", "INVALID_BODY", 400);
  }

  const action = typeof body?.action === "string" ? body.action : null;

  if (action === "ping") {
    return json({ success: true, data: { pong: true, phase: 6 } });
  }

  const identity = await resolveContractor(req);
  if (!identity) {
    return err("Não autenticado ou empresa não encontrada.", "UNAUTHORIZED", 401);
  }

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

      // ── Fase 6 ────────────────────────────────────────────────────────
      case "create_payment_charge":
        return await handleCreatePaymentCharge(body, identity.contractorId, secrets);

      case "get_or_create_customer":
        return await handleGetOrCreateCustomer(body, identity.contractorId, secrets);

      case "get_charge":
        return await handleGetCharge(body, identity.contractorId);

      case "list_charges":
        return await handleListCharges(body, identity.contractorId);

      // ── Fase 7 (stub) ─────────────────────────────────────────────────
      case "cancel-charge":
        return await handleCancelCharge();

      // ── Deprecated (Fase 5 stub) ──────────────────────────────────────
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
    if (e instanceof GoFitPayBusinessError) {
      return err(e.message, e.code, e.httpStatus);
    }
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
