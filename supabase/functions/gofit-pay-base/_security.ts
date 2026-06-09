/**
 * _security.ts — Helpers de segurança da Edge Function gofit-pay-base
 *
 * REGRAS ABSOLUTAS:
 *   - Nunca retornar o VALOR de variável sensível em response, log ou erro
 *   - Nunca expor: ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN, GOFIT_PAY_ENCRYPTION_KEY,
 *                  provider_api_key_encrypted, apiKey de subconta, authorization headers
 *   - Erros do Asaas passam por sanitizeError antes de sair da Edge Function
 *   - Nomes de variáveis ausentes podem ser retornados; valores nunca
 */

/* ─── Variáveis obrigatórias (nomes, nunca valores) ─────────────── */
export const REQUIRED_SECRETS = [
  "ASAAS_ENV",
  "ASAAS_BASE_URL",
  "ASAAS_API_KEY",
  "ASAAS_WEBHOOK_TOKEN",
  "GOFIT_PAY_ENCRYPTION_KEY",
] as const;

export type SecretName = typeof REQUIRED_SECRETS[number];

export interface SecretsValidation {
  valid:              boolean;
  missing:            SecretName[];
  environment:        "sandbox" | "production" | null;
  baseUrlConfigured:  boolean;
  envBaseUrlConsistent: boolean;
}

/**
 * Valida presença e coerência das variáveis de ambiente obrigatórias.
 * NUNCA loga nem retorna os valores — apenas os nomes ausentes.
 */
export function validateSecrets(): SecretsValidation {
  const missing: SecretName[] = [];

  for (const name of REQUIRED_SECRETS) {
    const val = Deno.env.get(name);
    if (!val || val.trim() === "") missing.push(name);
  }

  const rawEnv  = Deno.env.get("ASAAS_ENV")     ?? "";
  const baseUrl = Deno.env.get("ASAAS_BASE_URL") ?? "";

  const validEnvs = ["sandbox", "production"] as const;
  const environment = validEnvs.includes(rawEnv as never)
    ? (rawEnv as "sandbox" | "production")
    : null;

  if (!environment && rawEnv) {
    // Ambiente inválido — não adiciona de novo se já está em missing
    if (!missing.includes("ASAAS_ENV")) missing.push("ASAAS_ENV");
  }

  // Consistência: sandbox↔sandbox-url, production↔prod-url
  const envBaseUrlConsistent = !baseUrl || !environment || (
    (environment === "sandbox"    &&  baseUrl.includes("sandbox")) ||
    (environment === "production" && !baseUrl.includes("sandbox"))
  );

  return {
    valid: missing.length === 0 && !!environment && envBaseUrlConsistent,
    missing,
    environment,
    baseUrlConfigured: !!baseUrl,
    envBaseUrlConsistent,
  };
}

/* ─── Padrões de dados sensíveis ────────────────────────────────── */
const SENSITIVE_PATTERNS: RegExp[] = [
  /\$aact?[a-zA-Z0-9_\-]{6,}/g,            // chaves Asaas ($aact_xxx)
  /Bearer\s+[a-zA-Z0-9._\-]+/gi,           // Bearer tokens
  /eyJ[a-zA-Z0-9._\-]{20,}/g,              // JWT tokens
  /"access_token"\s*:\s*"[^"]+"/gi,
  /"apiKey"\s*:\s*"[^"]+"/gi,
  /"provider_api_key[^"]*"\s*:\s*"[^"]+"/gi,
  /ASAAS_[A-Z_]+=\S+/g,                    // env var assignments
  /GOFIT_PAY_[A-Z_]+=\S+/g,
];

const SENSITIVE_KEYWORDS = [
  "ASAAS_API_KEY",
  "ASAAS_WEBHOOK_TOKEN",
  "GOFIT_PAY_ENCRYPTION_KEY",
  "provider_api_key_encrypted",
  "access_token",
  "service_role",
  "SERVICE_ROLE_KEY",
] as const;

/**
 * Sanitiza uma string removendo padrões potencialmente sensíveis.
 * Usado internamente — nunca em logs de produção com dados reais.
 */
export function sanitizeString(input: string): string {
  let out = input;
  for (const re of SENSITIVE_PATTERNS) {
    out = out.replace(re, "[REDACTED]");
  }
  return out;
}

/**
 * Determina se uma mensagem de erro contém dados sensíveis.
 */
function containsSensitiveData(message: string): boolean {
  const lower = message.toLowerCase();
  return SENSITIVE_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

/**
 * Sanitiza um erro para retorno seguro ao frontend.
 *
 * Regra: se o erro contiver qualquer keyword sensível,
 * retorna mensagem genérica ("Erro de configuração interna.")
 * e loga apenas o tipo do erro, nunca o valor.
 */
export function sanitizeError(err: unknown): { message: string; code: string } {
  if (!(err instanceof Error)) {
    return { message: "Erro interno do servidor.", code: "INTERNAL_ERROR" };
  }

  // Verifica se a mensagem contém dados sensíveis
  if (containsSensitiveData(err.message)) {
    // Log interno: apenas o nome do erro, nunca a mensagem completa
    console.error(`[gofit-pay-security] Sensitive data in error: ${err.name} (message suppressed)`);
    return { message: "Erro de configuração interna. Contate o suporte.", code: "CONFIG_ERROR" };
  }

  // Remove padrões sensíveis da mensagem antes de retornar
  const safeMessage = sanitizeString(err.message);

  return {
    message: safeMessage,
    code:    (err as { code?: string }).code ?? err.name ?? "INTERNAL_ERROR",
  };
}

/**
 * Máscara parcial para logs internos de debug (nunca em responses).
 * Mostra apenas os primeiros 4 caracteres.
 * Ex: "$aact_Abc123xyz" → "$aac***"
 */
export function maskSecret(value: string): string {
  if (!value) return "[EMPTY]";
  if (value.length <= 4) return "***";
  return `${value.substring(0, 4)}***`;
}
