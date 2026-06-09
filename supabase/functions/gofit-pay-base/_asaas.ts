/**
 * AsaasService — SERVER-SIDE ONLY (Edge Function)
 *
 * SEGURANÇA OBRIGATÓRIA:
 *   - Variáveis sensíveis APENAS de Deno.env (Supabase Secrets)
 *   - ASAAS_API_KEY       → chave da plataforma (criar subcontas)
 *   - ASAAS_WEBHOOK_TOKEN → validação HMAC de webhooks
 *   - GOFIT_PAY_ENCRYPTION_KEY → chave AES-256-GCM para criptografar subconta keys
 *   - provider_api_key_encrypted → lida do DB e descriptografada aqui; nunca exposta
 *   - Nenhuma chave aparece em console.log, response, toast ou exception pública
 *
 * CRIPTOGRAFIA (item 5 do checklist):
 *   - AES-256-GCM via Web Crypto API (nativa no Deno)
 *   - IV: 12 bytes aleatórios por operação
 *   - Formato armazenado: base64(iv[12] || ciphertext+tag)
 *   - Chave: primeiros 32 bytes de GOFIT_PAY_ENCRYPTION_KEY (UTF-8)
 *
 * FASE ATUAL: 4/hardening
 * FASE 5: descomentar métodos de chamada real ao Asaas
 */

import { sanitizeError, maskSecret } from "./_security.ts";

export type AsaasEnvironment = "sandbox" | "production";

/* ─── Configuração de ambiente (validada pelo _security.ts) ─────── */

function getAsaasConfig(): { baseUrl: string; apiKey: string; webhookToken: string } {
  const baseUrl      = Deno.env.get("ASAAS_BASE_URL");
  const apiKey       = Deno.env.get("ASAAS_API_KEY");
  const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");

  // validateSecrets() já foi chamado antes — esta é uma segunda camada
  if (!baseUrl)      throw new AsaasConfigError("ASAAS_BASE_URL ausente.");
  if (!apiKey)       throw new AsaasConfigError("ASAAS_API_KEY ausente.");
  if (!webhookToken) throw new AsaasConfigError("ASAAS_WEBHOOK_TOKEN ausente.");

  return { baseUrl, apiKey, webhookToken };
}

/* ─── Criptografia AES-256-GCM ──────────────────────────────────── */

/**
 * Deriva a CryptoKey a partir de GOFIT_PAY_ENCRYPTION_KEY.
 * Usa os primeiros 32 bytes da chave UTF-8.
 * Lança AsaasConfigError se a variável estiver ausente ou curta demais.
 */
async function deriveEncryptionKey(usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  const raw = Deno.env.get("GOFIT_PAY_ENCRYPTION_KEY");
  if (!raw) throw new AsaasConfigError("GOFIT_PAY_ENCRYPTION_KEY não configurada.");

  const bytes = new TextEncoder().encode(raw);
  if (bytes.length < 32) {
    throw new AsaasConfigError(
      "GOFIT_PAY_ENCRYPTION_KEY deve ter no mínimo 32 bytes (256 bits)."
    );
  }

  return crypto.subtle.importKey(
    "raw",
    bytes.slice(0, 32),     // AES-256: exatamente 32 bytes
    { name: "AES-GCM" },
    false,                  // não exportável
    [usage]
  );
}

/**
 * Criptografa a API key da subconta Asaas.
 *
 * Formato do resultado: base64(iv[12] || ciphertext+tag)
 *   - iv: 12 bytes aleatórios (96 bits, padrão GCM)
 *   - ciphertext+tag: saída do AES-256-GCM (inclui tag de 16 bytes)
 *
 * NUNCA logar plainKey. Nunca retornar ao frontend.
 * Se falhar, lança AsaasConfigError — impede salvar subconta incompleta.
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

  // Concatena iv + ciphertext em um único buffer
  const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.length);

  // Encode como base64 para armazenar como texto no DB
  return btoa(String.fromCharCode(...combined));
}

/**
 * Descriptografa a API key da subconta.
 * Usado apenas internamente antes de chamar a API Asaas.
 * NUNCA expor o resultado em log ou response.
 */
export async function decryptSubAccountKey(encryptedB64: string): Promise<string> {
  if (!encryptedB64) throw new AsaasConfigError("Chave criptografada ausente.");

  const key = await deriveEncryptionKey("decrypt");

  let combined: Uint8Array;
  try {
    combined = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0));
  } catch {
    throw new AsaasConfigError("Formato de chave criptografada inválido (base64 corrompido).");
  }

  if (combined.length < 13) { // 12 IV + mínimo 1 byte
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
    // Não expor detalhes — pode indicar key errada ou dado corrompido
    throw new AsaasConfigError("Falha ao descriptografar chave da subconta.");
  }

  return new TextDecoder().decode(plainBuffer);
}

/* ─── Validação de webhook ───────────────────────────────────────── */

/**
 * Valida o header asaas-access-token de uma requisição webhook.
 * Compara com timing-safe (evita timing attacks).
 * NUNCA logar o token.
 */
export function validateWebhookToken(req: Request): boolean {
  const { webhookToken } = getAsaasConfig();
  const headerToken = req.headers.get("asaas-access-token") ?? "";

  if (!headerToken) return false;
  if (headerToken.length !== webhookToken.length) return false;

  // Comparação constante simples (Deno não tem timingSafeEqual nativo em stdlib 0.168)
  let equal = true;
  for (let i = 0; i < webhookToken.length; i++) {
    if (headerToken.charCodeAt(i) !== webhookToken.charCodeAt(i)) equal = false;
  }
  return equal;
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
      "access_token": apiKey,   // header proprietário Asaas
      "Content-Type": "application/json",
      "User-Agent":   "GoFit/4.0 (+https://fitcoresys.com.br)",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Lê o body uma vez
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch { /* body não-JSON — ignore */ }

  if (!res.ok) {
    const desc = (json?.errors as Array<{ description?: string }>)?.[0]?.description
      ?? "Erro na API Asaas";
    const code = (json?.errors as Array<{ code?: string }>)?.[0]?.code
      ?? "ASAAS_ERROR";
    throw new AsaasApiError(res.status, desc, code);
  }

  return json as T;
}

/* ══════════════════════════════════════════════════════════════════
   AsaasService
   Fase 4/hardening: contratos + crypto implementados; chamadas reais = Fase 5
   ══════════════════════════════════════════════════════════════════ */

export const AsaasService = {

  /* ─── Exportações de utilidades ─────────────────────────────────── */
  encryptSubAccountKey,
  decryptSubAccountKey,
  validateWebhookToken,

  /* ─── Subcontas ─────────────────────────────────────────────────── */

  /**
   * FASE 5 — Cria subconta Asaas (White Label).
   * Usa ASAAS_API_KEY da plataforma (não da subconta).
   * Retorna AsaasAccount incluindo apiKey — que DEVE ser criptografada
   * antes de persistir e nunca retornada ao frontend.
   */
  async createSubAccount(_params: CreateSubAccountParams): Promise<AsaasAccount> {
    throw new AsaasNotImplementedError("createSubAccount", 5);

    /* FASE 5 — implementar:
    const { baseUrl, apiKey } = getAsaasConfig();
    const result = await asaasRequest<AsaasAccount>(apiKey, baseUrl, "POST", "/accounts", {
      name:          _params.razao_social,
      email:         _params.resp_email,
      cpfCnpj:       _params.cnpj,
      birthDate:     _params.resp_nascimento,
      companyType:   toAsaasCompanyType(_params.tipo_empresa),
      phone:         _params.resp_celular,
      mobilePhone:   _params.resp_celular,
      address:       _params.logradouro,
      addressNumber: _params.numero_end,
      complement:    _params.complemento,
      province:      _params.bairro,
      postalCode:    _params.cep,
    });
    // CRÍTICO: nunca logar result.apiKey
    return result;
    */
  },

  /* ─── Customers ─────────────────────────────────────────────────── */

  /** FASE 5 — Cria/atualiza customer no Asaas com API key da subconta. */
  async upsertCustomer(
    _encryptedSubAccountKey: string,
    _params: CreateCustomerParams
  ): Promise<AsaasCustomer> {
    throw new AsaasNotImplementedError("upsertCustomer", 5);

    /* FASE 5:
    const { baseUrl } = getAsaasConfig();
    const subKey = await decryptSubAccountKey(_encryptedSubAccountKey);
    // CRÍTICO: nunca logar subKey
    return asaasRequest<AsaasCustomer>(subKey, baseUrl, "POST", "/customers", { ... });
    */
  },

  /* ─── Cobranças ─────────────────────────────────────────────────── */

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

/* ─── Tipos de parâmetros ────────────────────────────────────────── */

export interface CreateSubAccountParams {
  cnpj:            string;
  razao_social:    string;
  resp_email:      string;
  resp_celular:    string;
  resp_nascimento: string;
  tipo_empresa:    string;
  logradouro:      string;
  numero_end:      string;
  complemento?:    string;
  bairro:          string;
  cep:             string;
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

export interface AsaasAccount {
  id:       string;
  name:     string;
  email:    string;
  walletId: string;
  apiKey?:  string;   // presente só na criação — NUNCA logar/retornar
}

export interface AsaasCustomer {
  id:       string;
  name:     string;
  email:    string | null;
  cpfCnpj: string | null;
}

export interface AsaasPayment {
  id:          string;
  status:      string;
  billingType: string;
  value:       number;
  netValue:    number;
  dueDate:     string;
  invoiceUrl:  string | null;
  bankSlipUrl: string | null;
  pixQrCode?:  string;
  pixCopyCola?: string;
}

/* ─── Classes de erro ────────────────────────────────────────────── */

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
