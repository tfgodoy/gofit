/**
 * AsaasService — SERVER-SIDE ONLY (Edge Function)
 *
 * SEGURANÇA OBRIGATÓRIA:
 *   - Variáveis sensíveis APENAS de Deno.env (Supabase Secrets)
 *   - ASAAS_API_KEY       → chave da plataforma (criar subcontas)
 *   - ASAAS_WEBHOOK_TOKEN → validação de webhooks
 *   - GOFIT_PAY_ENCRYPTION_KEY → chave AES-256-GCM para criptografar subconta keys
 *   - subAccountApiKey    → chave decriptada da subconta, só em memória, NUNCA logar
 *   - provider_api_key_encrypted → lida do DB e descriptografada aqui; nunca exposta
 *
 * CRIPTOGRAFIA (AES-256-GCM):
 *   - IV: 12 bytes aleatórios por operação
 *   - Formato: base64(iv[12] || ciphertext+tag)
 *   - Chave: primeiros 32 bytes de GOFIT_PAY_ENCRYPTION_KEY (UTF-8)
 *
 * FASE ATUAL: 6
 *   - createSubAccount:  IMPLEMENTADO (sandbox) — Fase 5
 *   - upsertCustomer:    IMPLEMENTADO (sandbox) — Fase 6
 *   - createPayment:     IMPLEMENTADO (sandbox) — Fase 6
 *   - getPixQrCode:      IMPLEMENTADO (sandbox) — Fase 6
 *   - cancelPayment:     Fase 7 (stub)
 */

import { sanitizeError } from "./_security.ts";

export type AsaasEnvironment = "sandbox" | "production";

/* ─── Configuração de ambiente ─────────────────────────────────────── */

function getAsaasConfig(): { baseUrl: string; apiKey: string; webhookToken: string } {
  const baseUrl      = Deno.env.get("ASAAS_BASE_URL");
  const apiKey       = Deno.env.get("ASAAS_API_KEY");
  const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");

  if (!baseUrl)      throw new AsaasConfigError("ASAAS_BASE_URL ausente.");
  if (!apiKey)       throw new AsaasConfigError("ASAAS_API_KEY ausente.");
  if (!webhookToken) throw new AsaasConfigError("ASAAS_WEBHOOK_TOKEN ausente.");

  return { baseUrl, apiKey, webhookToken };
}

/** Retorna só a base URL — para operações com chave de subconta. */
function getBaseUrl(): string {
  const baseUrl = Deno.env.get("ASAAS_BASE_URL");
  if (!baseUrl) throw new AsaasConfigError("ASAAS_BASE_URL ausente.");
  return baseUrl;
}

/* ─── Helpers de mapeamento ──────────────────────────────────────────── */

export function toAsaasCompanyType(tipoEmpresa: string): string {
  const map: Record<string, string> = {
    mei:         "MEI",
    mei_empresa: "MEI",
    ltda:        "LIMITED",
    sa:          "LIMITED",
    eireli:      "LIMITED",
    ss:          "LIMITED",
    individual:  "INDIVIDUAL",
    associacao:  "ASSOCIATION",
    association: "ASSOCIATION",
  };
  return map[(tipoEmpresa ?? "").toLowerCase()] ?? "LIMITED";
}

export function mapAsaasAccountStatus(asaasStatus: string): string {
  const map: Record<string, string> = {
    PENDING:             "in_review",
    AWAITING_KYC_FORM:   "in_review",
    AWAITING_DOCUMENTS:  "in_review",
    ANALYSIS:            "in_review",
    APPROVED:            "active",
    ACTIVE:              "active",
    DECLINED:            "activation_failed",
    INACTIVE:            "activation_failed",
    REJECTED:            "activation_failed",
    BLOCKED:             "activation_failed",
  };
  return map[(asaasStatus ?? "").toUpperCase()] ?? "in_review";
}

export function toOnboardingStatus(gofitStatus: string): string {
  if (gofitStatus === "active")            return "ativo";
  if (gofitStatus === "in_review")         return "em_analise";
  if (gofitStatus === "activation_failed") return "activation_failed";
  return "enviado";
}

/* ─── Criptografia AES-256-GCM ──────────────────────────────────────── */

async function deriveEncryptionKey(usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  const raw = Deno.env.get("GOFIT_PAY_ENCRYPTION_KEY");
  if (!raw) throw new AsaasConfigError("GOFIT_PAY_ENCRYPTION_KEY não configurada.");

  const bytes = new TextEncoder().encode(raw);
  if (bytes.length < 32) {
    throw new AsaasConfigError("GOFIT_PAY_ENCRYPTION_KEY deve ter no mínimo 32 bytes.");
  }

  return crypto.subtle.importKey(
    "raw",
    bytes.slice(0, 32),
    { name: "AES-GCM" },
    false,
    [usage]
  );
}

export async function encryptSubAccountKey(plainKey: string): Promise<string> {
  if (!plainKey || plainKey.trim() === "") {
    throw new AsaasConfigError("API key da subconta não pode ser vazia.");
  }

  const key = await deriveEncryptionKey("encrypt");
  const iv  = crypto.getRandomValues(new Uint8Array(12));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plainKey)
  );

  const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.length);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptSubAccountKey(encryptedB64: string): Promise<string> {
  if (!encryptedB64) throw new AsaasConfigError("Chave criptografada ausente.");

  const key = await deriveEncryptionKey("decrypt");

  let combined: Uint8Array;
  try {
    combined = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0));
  } catch {
    throw new AsaasConfigError("Formato de chave criptografada inválido.");
  }

  if (combined.length < 13) {
    throw new AsaasConfigError("Chave criptografada muito curta.");
  }

  const iv         = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  let plainBuffer: ArrayBuffer;
  try {
    plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
  } catch {
    throw new AsaasConfigError("Falha ao descriptografar chave da subconta.");
  }

  return new TextDecoder().decode(plainBuffer);
}

/* ─── Validação de webhook ────────────────────────────────────────────── */

export function validateWebhookToken(req: Request): boolean {
  const { webhookToken } = getAsaasConfig();
  const headerToken = req.headers.get("asaas-access-token") ?? "";

  if (!headerToken) return false;
  if (headerToken.length !== webhookToken.length) return false;

  let equal = true;
  for (let i = 0; i < webhookToken.length; i++) {
    if (headerToken.charCodeAt(i) !== webhookToken.charCodeAt(i)) equal = false;
  }
  return equal;
}

/* ─── Requisição autenticada à API Asaas ─────────────────────────────── */

async function asaasRequest<T>(
  apiKey:  string,
  baseUrl: string,
  method:  string,
  path:    string,
  body?:   Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "access_token": apiKey,
      "Content-Type": "application/json",
      "User-Agent":   "GoFit/6.0 (+https://fitcoresys.com.br)",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch { /* body não-JSON */ }

  if (!res.ok) {
    const desc = (json?.errors as Array<{ description?: string }>)?.[0]?.description
      ?? String(json?.message ?? "Erro na API Asaas");
    const code = (json?.errors as Array<{ code?: string }>)?.[0]?.code
      ?? "ASAAS_ERROR";
    throw new AsaasApiError(res.status, desc, code);
  }

  return json as T;
}

/* ══════════════════════════════════════════════════════════════════════
   AsaasService
   ══════════════════════════════════════════════════════════════════════ */

export const AsaasService = {

  encryptSubAccountKey,
  decryptSubAccountKey,
  validateWebhookToken,
  mapAsaasAccountStatus,
  toAsaasCompanyType,
  toOnboardingStatus,

  /* ─── Subcontas (Fase 5) ──────────────────────────────────────────── */

  async createSubAccount(params: CreateSubAccountParams): Promise<AsaasAccount> {
    const { baseUrl, apiKey } = getAsaasConfig();

    const cnpjClean    = params.cnpj.replace(/\D/g, "");
    const celularClean = params.resp_celular.replace(/\D/g, "");
    const cepClean     = params.cep.replace(/\D/g, "");
    const companyType  = toAsaasCompanyType(params.tipo_empresa);

    const requestBody: Record<string, unknown> = {
      name:          params.razao_social,
      email:         params.resp_email,
      cpfCnpj:       cnpjClean,
      birthDate:     params.resp_nascimento,
      companyType,
      mobilePhone:   celularClean,
      address:       params.logradouro,
      addressNumber: params.numero_end,
      province:      params.bairro,
      postalCode:    cepClean,
    };
    if (params.complemento)        requestBody.complement   = params.complemento;
    if (params.resp_renda_mensal)  requestBody.incomeValue  = params.resp_renda_mensal;

    const result = await asaasRequest<AsaasAccount>(
      apiKey, baseUrl, "POST", "/accounts", requestBody
    );

    // Log apenas campos seguros — NUNCA logar apiKey
    console.log(
      `[gofit-pay] Subconta criada: id=${result.id} walletId=${result.walletId ?? "?"} ` +
      `hasKey=${!!result.apiKey} status=${result.accountStatus?.status ?? "?"}`
    );

    return result;
  },

  /* ─── Customers (Fase 6) ──────────────────────────────────────────── */

  /**
   * FASE 6 — Cria ou recupera customer no Asaas usando a chave da subconta.
   *
   * subAccountApiKey = chave decriptada da subconta (só em memória — NUNCA logar).
   * Fallback: se CPF já existe no Asaas, busca o customer existente.
   */
  async upsertCustomer(
    subAccountApiKey: string,
    params: CreateCustomerParams
  ): Promise<AsaasCustomer> {
    const baseUrl = getBaseUrl();

    const body: Record<string, unknown> = { name: params.name };
    if (params.email)            body.email             = params.email;
    if (params.cpfCnpj)          body.cpfCnpj           = params.cpfCnpj.replace(/\D/g, "");
    if (params.phone)            body.mobilePhone        = params.phone.replace(/\D/g, "");
    if (params.externalReference) body.externalReference = params.externalReference;

    try {
      const customer = await asaasRequest<AsaasCustomer>(
        subAccountApiKey, baseUrl, "POST", "/customers", body
      );
      console.log(`[gofit-pay] Customer criado: id=${customer.id}`);
      return customer;
    } catch (e) {
      // CPF/CNPJ já cadastrado → buscar customer existente
      if (e instanceof AsaasApiError && params.cpfCnpj) {
        const cpfClean = params.cpfCnpj.replace(/\D/g, "");
        try {
          const list = await asaasRequest<{ data?: AsaasCustomer[] }>(
            subAccountApiKey, baseUrl, "GET", `/customers?cpfCnpj=${cpfClean}&limit=1`
          );
          if (list.data?.[0]?.id) {
            console.log(`[gofit-pay] Customer existente (cpf match): id=${list.data[0].id}`);
            return list.data[0];
          }
        } catch { /* search fallback falhou — relança erro original */ }
      }
      throw e;
    }
  },

  /* ─── Cobranças (Fase 6) ──────────────────────────────────────────── */

  /**
   * FASE 6 — Cria cobrança Pix ou Boleto usando a chave da subconta.
   * Não implementa cartão, split, recorrência ou antecipação.
   */
  async createPayment(
    subAccountApiKey: string,
    params: CreatePaymentParams
  ): Promise<AsaasPayment> {
    const baseUrl = getBaseUrl();

    const body: Record<string, unknown> = {
      customer:    params.customer,
      billingType: params.billingType,
      value:       params.amount,
      dueDate:     params.dueDate,
    };
    if (params.description)        body.description       = params.description;
    if (params.externalReference)  body.externalReference = params.externalReference;

    const result = await asaasRequest<AsaasPayment>(
      subAccountApiKey, baseUrl, "POST", "/payments", body
    );

    // Log apenas campos seguros
    console.log(
      `[gofit-pay] Cobrança criada: id=${result.id} ` +
      `type=${result.billingType} status=${result.status} value=${result.value}`
    );

    return result;
  },

  /**
   * FASE 6 — Obtém QR Code Pix de uma cobrança já criada.
   * Chamado logo após createPayment para billingType = PIX.
   */
  async getPixQrCode(
    subAccountApiKey: string,
    paymentId: string
  ): Promise<AsaasPixQrCode> {
    const baseUrl = getBaseUrl();
    return asaasRequest<AsaasPixQrCode>(
      subAccountApiKey, baseUrl, "GET", `/payments/${paymentId}/pixQrCode`
    );
  },

  /** FASE 7 — Cancela cobrança. */
  async cancelPayment(
    _subAccountApiKey: string,
    _providerChargeId: string
  ): Promise<void> {
    throw new AsaasNotImplementedError("cancelPayment", 7);
  },

} as const;

/* ─── Tipos de parâmetros ─────────────────────────────────────────────── */

export interface CreateSubAccountParams {
  cnpj:               string;
  razao_social:       string;
  tipo_empresa:       string;
  resp_email:         string;
  resp_celular:       string;
  resp_nascimento:    string;
  logradouro:         string;
  numero_end:         string;
  complemento?:       string;
  bairro:             string;
  cep:                string;
  resp_renda_mensal?: number;
}

export interface CreateCustomerParams {
  name:               string;
  email?:             string;
  cpfCnpj?:           string;
  phone?:             string;
  externalReference?: string;
}

export interface CreatePaymentParams {
  customer:           string;   // Asaas customer ID (cus_xxx)
  billingType:        "PIX" | "BOLETO";
  amount:             number;
  dueDate:            string;   // YYYY-MM-DD
  description?:       string;
  externalReference?: string;
}

/* ─── Tipos de resposta Asaas ─────────────────────────────────────────── */

export interface AsaasAccount {
  id:         string;
  name:       string;
  email:      string;
  walletId:   string;
  apiKey?:    string;       // presente só na criação — NUNCA logar/retornar
  accountStatus?: {
    status:         string;
    observations?:  string | null;
    updatedAt?:     string;
  };
}

export interface AsaasCustomer {
  id:                 string;
  name:               string;
  email?:             string | null;
  cpfCnpj?:          string | null;
  mobilePhone?:       string | null;
  externalReference?: string | null;
}

export interface AsaasPayment {
  id:                 string;
  customer:           string;
  billingType:        string;
  value:              number;
  netValue:           number;
  status:             string;
  dueDate:            string;
  invoiceUrl:         string | null;
  bankSlipUrl:        string | null;
  externalReference?: string | null;
  description?:       string | null;
}

export interface AsaasPixQrCode {
  encodedImage:    string;   // base64 PNG — não logar
  payload:         string;   // pix copia-e-cola
  expirationDate?: string | null;
}

/* ─── Classes de erro ─────────────────────────────────────────────────── */

export class AsaasApiError extends Error {
  constructor(
    public readonly httpStatus: number,
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "AsaasApiError";
  }
}

export class AsaasConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsaasConfigError";
  }
}

export class AsaasNotImplementedError extends Error {
  constructor(method: string, phase: number) {
    super(`AsaasService.${method} disponível na Fase ${phase}.`);
    this.name = "AsaasNotImplementedError";
  }
}
