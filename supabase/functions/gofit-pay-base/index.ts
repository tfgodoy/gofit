/**
 * Edge Function: gofit-pay-base
 *
 * Roteador base para todas as operações GoFit Pay.
 * Cada `action` será expandida em fases futuras.
 *
 * SEGURANÇA:
 *   - Autentica via JWT Supabase (header Authorization)
 *   - Usa service_role para operações no banco
 *   - ASAAS_API_KEY lida apenas de Deno.env (nunca do body)
 *   - Nenhuma chave é retornada nas respostas
 *
 * FASE ATUAL: 4 (estrutura — todos os handlers retornam 501)
 * FASE 5: implementar create-account e create-charge
 * FASE 6: implementar webhook e cancel-charge
 *
 * Uso (Fase 5+):
 *   supabase.functions.invoke('gofit-pay-base', {
 *     body: { action: 'create-account', ... }
 *   })
 */

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AsaasService, AsaasNotImplementedError, AsaasApiError, AsaasConfigError } from "./_asaas.ts";

/* ─── CORS ─────────────────────────────────────────────────────── */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, code: string, status = 400) {
  return jsonResponse({ success: false, error: message, code }, status);
}

/* ─── Autenticação ──────────────────────────────────────────────── */
async function authenticateRequest(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Token de autenticação ausente.");

  // Client para verificar o JWT do usuário
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")       ?? "",
    Deno.env.get("SUPABASE_ANON_KEY")  ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new Error("Token inválido ou expirado.");

  return user;
}

/** Client com service_role para operações no banco (servidor apenas) */
function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")               ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")  ?? ""
  );
}

/** Busca o contractor_id do usuário autenticado */
async function getContractorId(supabase: ReturnType<typeof getServiceClient>, userId: string): Promise<string | null> {
  const { data: authRow } = await supabase
    .from("contractor_auth")
    .select("contractor_id")
    .eq("id", userId)
    .maybeSingle();

  if (authRow) return authRow.contractor_id;

  const { data: staffRow } = await supabase
    .from("staff")
    .select("contractor_id")
    .eq("id", userId)
    .maybeSingle();

  return staffRow?.contractor_id ?? null;
}

/* ─── Handlers ──────────────────────────────────────────────────── */

/**
 * FASE 5 — Cria subconta Asaas para a empresa.
 * Lê dados do gofit_pay_config, chama AsaasService.createSubAccount,
 * salva em gofit_pay_accounts, atualiza company_modules.
 */
async function handleCreateAccount(
  _body: Record<string, unknown>,
  _contractorId: string,
  _supabase: ReturnType<typeof getServiceClient>
) {
  // Fase 4: ainda não implementado
  try {
    await AsaasService.createSubAccount({} as never);
  } catch (e) {
    if (e instanceof AsaasNotImplementedError) {
      return errorResponse(e.message, "NOT_IMPLEMENTED_PHASE_5", 501);
    }
    throw e;
  }
}

/**
 * FASE 5 — Cria cobrança Asaas e vincula ao receivable.
 */
async function handleCreateCharge(
  _body: Record<string, unknown>,
  _contractorId: string,
  _supabase: ReturnType<typeof getServiceClient>
) {
  try {
    await AsaasService.createPayment("sandbox", {} as never);
  } catch (e) {
    if (e instanceof AsaasNotImplementedError) {
      return errorResponse(e.message, "NOT_IMPLEMENTED_PHASE_5", 501);
    }
    throw e;
  }
}

/**
 * FASE 6 — Cancela uma cobrança Asaas.
 */
async function handleCancelCharge(
  _body: Record<string, unknown>,
  _contractorId: string,
  _supabase: ReturnType<typeof getServiceClient>
) {
  return errorResponse(
    "Cancelamento de cobranças disponível na Fase 6.",
    "NOT_IMPLEMENTED_PHASE_6",
    501
  );
}

/* ─── Router principal ──────────────────────────────────────────── */
serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return errorResponse("Método não permitido.", "METHOD_NOT_ALLOWED", 405);
  }

  try {
    // 1. Autenticar usuário
    const user = await authenticateRequest(req);

    // 2. Criar client de serviço
    const supabaseAdmin = getServiceClient();

    // 3. Resolver contractor_id
    const contractorId = await getContractorId(supabaseAdmin, user.id);
    if (!contractorId) {
      return errorResponse("Empresa não encontrada.", "CONTRACTOR_NOT_FOUND", 403);
    }

    // 4. Ler e validar o body
    const body: Record<string, unknown> = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    if (!action) {
      return errorResponse("Campo 'action' é obrigatório.", "MISSING_ACTION", 400);
    }

    // 5. Rotear para o handler correto
    switch (action) {
      case "create-account":
        return await handleCreateAccount(body, contractorId, supabaseAdmin) ??
               errorResponse("Handler retornou null.", "INTERNAL_ERROR", 500);

      case "create-charge":
        return await handleCreateCharge(body, contractorId, supabaseAdmin) ??
               errorResponse("Handler retornou null.", "INTERNAL_ERROR", 500);

      case "cancel-charge":
        return await handleCancelCharge(body, contractorId, supabaseAdmin);

      case "ping":
        // Health check — confirma que a Edge Function está ativa
        return jsonResponse({
          success: true,
          data: {
            phase: 4,
            status: "operational",
            contractor_id: contractorId,
            message: "GoFit Pay base funcionando. Fase 5 implementará create-account e create-charge.",
          },
        });

      default:
        return errorResponse(`Ação desconhecida: '${action}'.`, "UNKNOWN_ACTION", 400);
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno.";

    // Erro de configuração (chave Asaas ausente) — não logar detalhes
    if (err instanceof AsaasConfigError) {
      console.error("[gofit-pay-base] Config error:", err.name);
      return errorResponse("Configuração do gateway incompleta. Contate o suporte.", "CONFIG_ERROR", 503);
    }

    // Erro da API Asaas
    if (err instanceof AsaasApiError) {
      console.error("[gofit-pay-base] Asaas API error:", err.httpStatus, err.code);
      return errorResponse(message, err.code, 502);
    }

    // Erro genérico
    console.error("[gofit-pay-base] Unhandled error:", message);
    return errorResponse("Erro interno do servidor.", "INTERNAL_ERROR", 500);
  }
});
