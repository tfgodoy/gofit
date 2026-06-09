/**
 * AsaasService — SERVER-SIDE ONLY
 *
 * SEGURANÇA:
 *   - Este arquivo NUNCA deve ser importado por código frontend/React
 *   - A chave ASAAS_API_KEY vem exclusivamente de Deno.env (Supabase Secrets)
 *   - Nenhuma chave é logada, retornada ou exposta em respostas
 *
 * FASE ATUAL: 4 (estrutura — sem chamadas reais ao Asaas)
 * FASE 5: descomentar os métodos e implementar as chamadas reais
 */

export type AsaasEnvironment = "sandbox" | "production";

const ASAAS_BASE_URL: Record<AsaasEnvironment, string> = {
  sandbox:    "https://sandbox.asaas.com/api/v3",
  production: "https://www.asaas.com/api/v3",
};

/**
 * Lê a API key do ambiente — NUNCA do corpo da requisição.
 * Na Fase 5, cada subconta terá sua própria chave armazenada em
 * Supabase Vault ou como secret nomeado (ex: ASAAS_KEY_<contractorId>).
 */
function getApiKey(environment: AsaasEnvironment): string {
  const key = environment === "production"
    ? Deno.env.get("ASAAS_API_KEY_PRODUCTION")
    : Deno.env.get("ASAAS_API_KEY_SANDBOX");

  if (!key) {
    throw new AsaasConfigError(
      `ASAAS_API_KEY_${environment.toUpperCase()} não configurada nos Supabase Secrets.`
    );
  }
  return key;
}

/** Realiza uma requisição autenticada à API Asaas */
async function asaasRequest<T>(
  environment: AsaasEnvironment,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const apiKey  = getApiKey(environment);
  const baseUrl = ASAAS_BASE_URL[environment];

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
    // Nunca loga o body completo (pode conter dados sensíveis)
    throw new AsaasApiError(
      res.status,
      json?.errors?.[0]?.description ?? "Erro na API Asaas",
      json?.errors?.[0]?.code        ?? "ASAAS_ERROR"
    );
  }

  return json as T;
}

/* ══════════════════════════════════════════════════════════════════
   AsaasService — Fase 4: esqueleto com contratos de interface
   Fase 5: implementar os métodos comentados
   ══════════════════════════════════════════════════════════════════ */

export const AsaasService = {

  /* ─── Subcontas ──────────────────────────────────────────────────── */

  /**
   * FASE 5 — Cria uma subconta Asaas (White Label).
   * Recebe os dados do gofit_pay_config e retorna o accountId.
   *
   * POST /v3/accounts
   */
  async createSubAccount(_params: CreateSubAccountParams): Promise<AsaasAccount> {
    // ── Fase 4: ainda não implementado ──
    throw new AsaasNotImplementedError("createSubAccount", 5);

    /*  FASE 5 — implementar:
    return asaasRequest<AsaasAccount>("sandbox", "POST", "/accounts", {
      name:          _params.razao_social,
      email:         _params.resp_email,
      cpfCnpj:       _params.cnpj,
      birthDate:     _params.resp_nascimento,
      companyType:   asaasCompanyType(_params.tipo_empresa),
      phone:         _params.resp_celular,
      mobilePhone:   _params.resp_celular,
      address:       _params.logradouro,
      addressNumber: _params.numero_end,
      complement:    _params.complemento,
      province:      _params.bairro,
      postalCode:    _params.cep,
    });
    */
  },

  /* ─── Customers ──────────────────────────────────────────────────── */

  /**
   * FASE 5 — Cria ou atualiza um customer no Asaas.
   * POST /v3/customers
   */
  async upsertCustomer(
    _environment: AsaasEnvironment,
    _params: CreateCustomerParams
  ): Promise<AsaasCustomer> {
    throw new AsaasNotImplementedError("upsertCustomer", 5);
  },

  /* ─── Cobranças ──────────────────────────────────────────────────── */

  /**
   * FASE 5 — Cria uma cobrança.
   * POST /v3/payments
   */
  async createPayment(
    _environment: AsaasEnvironment,
    _params: CreatePaymentParams
  ): Promise<AsaasPayment> {
    throw new AsaasNotImplementedError("createPayment", 5);
  },

  /**
   * FASE 6 — Cancela uma cobrança.
   * DELETE /v3/payments/:id
   */
  async cancelPayment(
    _environment: AsaasEnvironment,
    _paymentId: string
  ): Promise<void> {
    throw new AsaasNotImplementedError("cancelPayment", 6);
  },

  /**
   * FASE 6 — Busca uma cobrança por ID.
   * GET /v3/payments/:id
   */
  async getPayment(
    _environment: AsaasEnvironment,
    _paymentId: string
  ): Promise<AsaasPayment> {
    throw new AsaasNotImplementedError("getPayment", 6);
  },

} as const;

/* ─── Tipos Asaas ───────────────────────────────────────────────── */

export interface CreateSubAccountParams {
  cnpj: string;
  razao_social: string;
  resp_email: string;
  resp_celular: string;
  resp_nascimento: string;
  tipo_empresa: string;
  logradouro: string;
  numero_end: string;
  complemento?: string;
  bairro: string;
  cep: string;
}

export interface CreateCustomerParams {
  name: string;
  email?: string;
  cpfCnpj?: string;
  phone?: string;
  externalReference?: string;
}

export interface CreatePaymentParams {
  customer: string;           // customer ID Asaas
  billingType: string;        // PIX | BOLETO | CREDIT_CARD
  value: number;
  dueDate: string;            // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  postalService?: boolean;
}

export interface AsaasAccount {
  id: string;
  name: string;
  email: string;
  walletId: string;
  apiKey?: string;            // retornado apenas na criação (nunca logar)
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string | null;
  cpfCnpj: string | null;
}

export interface AsaasPayment {
  id: string;
  status: string;
  billingType: string;
  value: number;
  netValue: number;
  dueDate: string;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  pixQrCode?: string;
  pixCopyCola?: string;
}

/* ─── Erros ─────────────────────────────────────────────────────── */

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
    super(`AsaasService.${method} será implementado na Fase ${phase}.`);
    this.name = "AsaasNotImplementedError";
  }
}
