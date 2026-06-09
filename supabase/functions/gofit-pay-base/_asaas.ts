/**
 * AsaasService — SERVER-SIDE ONLY (Edge Function)
 *
 * SEGURANÇA OBRIGATÓRIA:
 *   - Variáveis sensíveis APENAS de Deno.env (Supabase Secrets)
 *   - ASAAS_API_KEY       → chave da plataforma (criar subcontas)
 *   - ASAAS_WEBHOOK_TOKEN → validação de webhooks
 *   - GOFIT_PAY_ENCRYPTION_KEY → chave AES-256-GCM para criptografar subconta keys
 *   - provider_api_key_encrypted → lida do DB e descriptografada aqui; nunca exposta
 *   - Nenhuma chave aparece em console.log, response, toast ou exception pública
 *
 * CRIPTOGRAFIA (AES-256-GCM):
 *   - IV: 12 bytes aleatórios por operação
 *   - Formato: base64(iv[12] || ciphertext+tag)
 *   - Chave: primeiros 32 bytes de GOFIT_PAY_ENCRYPTION_KEY (UTF-8)
 *
 * FASE ATUAL: 5
 *   - createSubAccount: IMPLEMENTADO (sandbox)
 *   - createPayment:    Fase 5 (stub)
 *   - cancelPayment:    Fase 6 (stub)
 */

import { sanitizeError, maskSecret } from "./_security.ts";

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

/* ─── Helpers de mapeamento ──────────────────────────────────────────── */

/**
 * Mapeia tipo_empresa do wizard para companyType esperado pelo Asaas.
 * Referência: https://docs.asaas.com/reference/criar-subconta
 */
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

/**
 * Mapeia accountStatus.status do Asaas para status interno GoFit Pay.
 *
 * GoFit status:
 *   in_review        → conta submetida, aguardando análise Asaas
 *   active           → conta aprovada e operacional
 *   activation_failed → conta recusada ou erro na criação
 */
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

/**
 * Mapeia status GoFit Pay para onboarding_status de gofit_pay_config.
 */
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

/**
 * Criptografa a API key da subconta Asaas.
 * Formato: base64(iv[12] || ciphertext+tag)
 * NUNCA logar plainKey. Nunca retornar ao frontend.
 */
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

/**
 * Descriptografa a API key da subconta.
 * NUNCA expor o resultado em log ou response.
 */
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

/**
 * Valida asaas-access-token com comparação constant-time.
 * NUNCA logar o token.
 */
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
      "User-Agent":   "GoFit/5.0 (+https://fitcoresys.com.br)",
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

  /* ─── Subcontas ──────────────────────────────────────────────────────
     FASE 5 — Implementado para sandbox
     Cria subconta Asaas (White Label) com a API key master da plataforma.
     A subconta recebe seu próprio apiKey → criptografar IMEDIATAMENTE com
     encryptSubAccountKey() e salvar em provider_api_key_encrypted.
     NUNCA retornar, logar ou exibir o apiKey.
  */
  async createSubAccount(params: CreateSubAccountParams): Promise<AsaasAccount> {
    const { baseUrl, apiKey } = getAsaasConfig();

    // Sanitiza campos numéricos
    const cnpjClean     = params.cnpj.replace(/\D/g, "");
    const celularClean  = params.resp_celular.replace(/\D/g, "");
    const cepClean      = params.cep.replace(/\D/g, "");
    const companyType   = toAsaasCompanyType(params.tipo_empresa);

    const requestBody: Record<string, unknown> = {
      name:          params.razao_social,
      email:         params.resp_email,
      cpfCnpj:       cnpjClean,
      birthDate:     params.resp_nascimento,   // YYYY-MM-DD (nascimento resp. legal)
      companyType,
      mobilePhone:   celularClean,
      address:       params.logradouro,
      addressNumber: params.numero_end,
      province:      params.bairro,
      postalCode:    cepClean,
    };
    if (params.complemento) {
      requestBody.complement = params.complemento;
    }

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

  /* ─── Customers ───────────────────────────────────────────────────── */

  /** FASE 5 — Cria/atualiza customer com API key da subconta. */
  async upsertCustomer(
    _encryptedSubAccountKey: string,
    _params: CreateCustomerParams
  ): Promise<AsaasCustomer> {
    throw new AsaasNotImplementedError("upsertCustomer", 5);
  },

  /* ─── Cobranças ───────────────────────────────────────────────────── */

  /** FASE 5 — Cria cobrança. */
  async createPayment(
    _encryptedSubAccountKey: string,
    _params: CreatePaymentParams
  ): Promise<AsaasPayment> {
    throw new AsaasNotImplementedError("createPayment", 5);
  },

  /** FASE 6 — Cancela cobrança. */
  async cancelPayment(
    _encryptedSubAccountKey: string,
    _providerChargeId: string
  ): Promise<void> {
    throw new AsaasNotImplementedError("cancelPayment", 6);
  },

} as const;

/* ─── Tipos de parâmetros ─────────────────────────────────────────────── */

export interface CreateSubAccountParams {
  cnpj:             string;
  razao_social:     string;
  tipo_empresa:     string;
  resp_email:       string;
  resp_celular:     string;
  resp_nascimento:  string;   // YYYY-MM-DD
  logradouro:       string;
  numero_end:       string;
  complemento?:     string;
  bairro:           string;
  cep:              string;
}

export interface CreateCustomerParams {
  name:               string;
  email?:             string;
  cpfCnpj?:          string;
  phone?:             string;
  externalReference?: string;
}

export interface CreatePaymentParams {
  customer:           string;
  billingType:        string;
  amount:             number;
  dueDate:            string;
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
    status:         string;   // PENDING | AWAITING_KYC_FORM | APPROVED | DECLINED | ...
    observations?:  string | null;
    updatedAt?:     string;
  };
}

export interface AsaasCustomer {
  id:       string;
  name:     string;
  email:    string | null;
  cpfCnpj: string | null;
}

export interface AsaasPayment {
  id:           string;
  status:       string;
  billingType:  string;
  value:        number;
  netValue:     number;
  dueDate:      string;
  invoiceUrl:   string | null;
  bankSlipUrl:  string | null;
  pixQrCode?:   string;
  pixCopyCola?: string;
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
