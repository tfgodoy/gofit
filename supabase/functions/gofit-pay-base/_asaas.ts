/**
 * AsaasService — SERVER-SIDE ONLY (Edge Function)
 *
 * SEGURANÇA:
 *   - Este arquivo NUNCA deve ser importado por código frontend/React
 *   - Variáveis de ambiente lidas APENAS de Deno.env (Supabase Secrets):
 *       ASAAS_ENV              = sandbox | production
 *       ASAAS_BASE_URL         = URL base da API Asaas
 *       ASAAS_API_KEY          = chave da plataforma (para criar subcontas)
 *       ASAAS_WEBHOOK_TOKEN    = token de validação HMAC
 *       GOFIT_PAY_ENCRYPTION_KEY = chave AES-256-GCM para criptografar subconta keys
 *   - provider_api_key_encrypted lida do DB e descriptografada aqui (Fase 5)
 *   - Nenhuma chave é logada, retornada ou exposta em respostas
 *
 * FASE ATUAL: 4 (estrutura — sem chamadas reais ao Asaas)
 * FASE 5: descomentar e implementar os métodos
 */

export type AsaasEnvironment = "sandbox" | "production";

/* ─── Configuração de ambiente ──────────────────────────────────── */

function getEnv(): { env: AsaasEnvironment; baseUrl: string; apiKey: string; webhookToken: string } {
  const env        = (Deno.env.get("ASAAS_ENV") ?? "sandbox") as AsaasEnvironment;
  const baseUrl    = Deno.env.get("ASAAS_BASE_URL");
  const apiKey     = Deno.env.get("ASAAS_API_KEY");
  const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");

  if (!baseUrl)     throw new AsaasConfigError("ASAAS_BASE_URL não configurada nos Supabase Secrets.");
  if (!apiKey)      throw new AsaasConfigError("ASAAS_API_KEY não configurada nos Supabase Secrets.");
  if (!webhookToken) throw new AsaasConfigError("ASAAS_WEBHOOK_TOKEN não configurado nos Supabase Secrets.");

  return { env, baseUrl, apiKey, webhookToken };
}

/**
 * Descriptografa a API key da subconta armazenada em provider_api_key_encrypted.
 * Fase 4: stub — implementar com Web Crypto API na Fase 5.
 * A chave de criptografia vem de GOFIT_PAY_ENCRYPTION_KEY (Supabase Secret).
 */
async function decryptSubAccountKey(encryptedKey: string): Promise<string> {
  // Fase 4: ainda não implementado
  void encryptedKey;
  throw new AsaasNotImplementedError("decryptSubAccountKey", 5);

  /* FASE 5 — implementar com Web Crypto API:
  const masterKeyRaw = Deno.env.get("GOFIT_PAY_ENCRYPTION_KEY");
  if (!masterKeyRaw) throw new AsaasConfigError("GOFIT_PAY_ENCRYPTION_KEY não configurada.");
  // ... AES-256-GCM decrypt ...
  */
}

/**
 * Criptografa a API key da subconta antes de salvar no DB.
 * Fase 4: stub — implementar na Fase 5.
 */
async function encryptSubAccountKey(plainKey: string): Promise<string> {
  void plainKey;
  throw new AsaasNotImplementedError("encryptSubAccountKey", 5);
}

/* ─── Requisição autenticada à API Asaas ───────────────────────── */

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
      "User-Agent":   "GoFit/4.0 (+https://fitcoresys.com.br)",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();

  if (!res.ok) {
    throw new AsaasApiError(
      res.status,
      json?.errors?.[0]?.description ?? "Erro na API Asaas",
      json?.errors?.[0]?.code        ?? "ASAAS_ERROR"
    );
  }

  return json as T;
}

/* ══════════════════════════════════════════════════════════════════
   AsaasService
   Fase 4: contratos definidos, zero chamadas reais
   Fase 5: implementar os métodos
   ══════════════════════════════════════════════════════════════════ */

export const AsaasService = {

  /** Expõe utilitário de criptografia para o handler de criação de subconta */
  encryptSubAccountKey,
  decryptSubAccountKey,

  /* ─── Subcontas ─────────────────────────────────────────────────── */

  /**
   * FASE 5 — Cria subconta Asaas (White Label).
   * Usa a ASAAS_API_KEY da plataforma (não da subconta).
   * POST /accounts
   */
  async createSubAccount(params: CreateSubAccountParams): Promise<AsaasAccount> {
    throw new AsaasNotImplementedError("createSubAccount", 5);

    /* FASE 5:
    const { baseUrl, apiKey } = getEnv();
    return asaasRequest<AsaasAccount>(apiKey, baseUrl, "POST", "/accounts", {
      name:          params.razao_social,
      email:         params.resp_email,
      cpfCnpj:       params.cnpj,
      birthDate:     params.resp_nascimento,
      companyType:   toAsaasCompanyType(params.tipo_empresa),
      phone:         params.resp_celular,
      mobilePhone:   params.resp_celular,
      address:       params.logradouro,
      addressNumber: params.numero_end,
      complement:    params.complemento,
      province:      params.bairro,
      postalCode:    params.cep,
    });
    */
  },

  /* ─── Customers ─────────────────────────────────────────────────── */

  /**
   * FASE 5 — Cria ou atualiza customer no Asaas.
   * Usa a API key da SUBCONTA (descriptografada de provider_api_key_encrypted).
   * POST /customers
   */
  async upsertCustomer(
    encryptedSubAccountKey: string,
    params: CreateCustomerParams
  ): Promise<AsaasCustomer> {
    throw new AsaasNotImplementedError("upsertCustomer", 5);

    /* FASE 5:
    const { baseUrl } = getEnv();
    const subKey = await decryptSubAccountKey(encryptedSubAccountKey);
    return asaasRequest<AsaasCustomer>(subKey, baseUrl, "POST", "/customers", {
      name:              params.name,
      email:             params.email,
      cpfCnpj:           params.cpfCnpj,
      phone:             params.phone,
      externalReference: params.externalReference,
    });
    */
  },

  /* ─── Cobranças ─────────────────────────────────────────────────── */

  /**
   * FASE 5 — Cria cobrança.
   * Usa a API key da SUBCONTA.
   * POST /payments
   */
  async createPayment(
    encryptedSubAccountKey: string,
    params: CreatePaymentParams
  ): Promise<AsaasPayment> {
    throw new AsaasNotImplementedError("createPayment", 5);

    /* FASE 5:
    const { baseUrl } = getEnv();
    const subKey = await decryptSubAccountKey(encryptedSubAccountKey);
    return asaasRequest<AsaasPayment>(subKey, baseUrl, "POST", "/payments", {
      customer:          params.customer,
      billingType:       params.billingType,
      value:             params.amount,
      dueDate:           params.dueDate,
      description:       params.description,
      externalReference: params.externalReference,
    });
    */
  },

  /**
   * FASE 6 — Cancela cobrança.
   * DELETE /payments/:id
   */
  async cancelPayment(
    encryptedSubAccountKey: string,
    providerChargeId: string
  ): Promise<void> {
    throw new AsaasNotImplementedError("cancelPayment", 6);
  },

  /**
   * FASE 6 — Valida assinatura HMAC do webhook.
   * Compara header 'asaas-access-token' com ASAAS_WEBHOOK_TOKEN.
   */
  async validateWebhookSignature(req: Request): Promise<boolean> {
    throw new AsaasNotImplementedError("validateWebhookSignature", 6);

    /* FASE 6:
    const { webhookToken } = getEnv();
    const headerToken = req.headers.get("asaas-access-token");
    return headerToken === webhookToken;
    */
  },

} as const;

/* ─── Tipos de parâmetros ────────────────────────────────────────── */

export interface CreateSubAccountParams {
  cnpj:             string;
  razao_social:     string;
  resp_email:       string;
  resp_celular:     string;
  resp_nascimento:  string;
  tipo_empresa:     string;
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
  customer:           string;    // provider_customer_id
  billingType:        string;    // PIX | BOLETO | CREDIT_CARD
  amount:             number;    // spec usa amount
  dueDate:            string;    // YYYY-MM-DD
  description?:       string;
  externalReference?: string;
}

/* ─── Tipos de resposta Asaas ────────────────────────────────────── */

export interface AsaasAccount {
  id:       string;
  name:     string;
  email:    string;
  walletId: string;
  // apiKey retornado apenas na criação — NUNCA logar ou retornar ao frontend
  apiKey?:  string;
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

/* ─── Erros ──────────────────────────────────────────────────────── */

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
