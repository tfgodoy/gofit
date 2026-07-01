/**
 * moduleAccess — helper centralizado para checar acesso a módulo por empresa.
 *
 * Regras de precedência (nesta ordem):
 * 1. Módulo globalmente inativo (modules.status != 'active') → sempre bloqueado
 * 2. Override ativo em company_modules (status = 'active') → liberado
 * 3. Override cancelado em company_modules (status = 'cancelled') → bloqueado
 * 4. Sem override decisivo → checar saas_plan_features do plano ativo da empresa
 * 5. Sem assinatura ativa ou trialing → bloqueado
 * 6. Feature não existe no plano → bloqueado
 *
 * USO ATUAL: área /admin/* (platform_owners têm acesso a todas as tabelas)
 *
 * PARA USO EM /app/*:
 * - saas_subscriptions precisa de policy SELECT para contractor_auth/staff
 * - A lógica aqui ficará idêntica; apenas as policies de RLS mudam
 * - Implementar a policy de contractor em fase futura antes de usar getModuleAccess() no /app/*
 */

import { supabase } from "@/integrations/supabase/client";

export type ModuleAccessSource =
  | "global_inactive"          // modules.status != 'active' → sempre bloqueado
  | "company_override_active"  // company_modules.status = 'active' → liberado por override
  | "company_override_blocked" // company_modules.status = 'cancelled' → bloqueado por override
  | "plan_feature"             // saas_plan_features.enabled = true → liberado via plano
  | "no_subscription"          // sem assinatura ativa ou trialing
  | "not_in_plan"              // plano ativo mas feature não está no plano
  | "module_not_found";        // slug não existe em modules

export interface ModuleAccessResult {
  hasAccess: boolean;
  source: ModuleAccessSource;
  companyModuleStatus?: string;
  planSlug?: string;
  featureEnabled?: boolean;
  limitValue?: number | null;
}

export async function getModuleAccess(
  contractorId: string,
  moduleSlug: string
): Promise<ModuleAccessResult> {
  const { data: mod } = await supabase
    .from("modules")
    .select("id, status")
    .eq("slug", moduleSlug)
    .single();

  if (!mod) return { hasAccess: false, source: "module_not_found" };
  if (mod.status !== "active") return { hasAccess: false, source: "global_inactive" };

  const { data: cm } = await supabase
    .from("company_modules")
    .select("status")
    .eq("contractor_id", contractorId)
    .eq("module_id", mod.id)
    .maybeSingle();

  if (cm?.status === "active") {
    return { hasAccess: true, source: "company_override_active", companyModuleStatus: cm.status };
  }
  if (cm?.status === "cancelled") {
    return { hasAccess: false, source: "company_override_blocked", companyModuleStatus: cm.status };
  }

  const { data: sub } = await supabase
    .from("saas_subscriptions")
    .select("plan_id, status, saas_plans(slug)")
    .eq("contractor_id", contractorId)
    .in("status", ["active", "trialing"])
    .maybeSingle();

  if (!sub) return { hasAccess: false, source: "no_subscription" };

  const planSlug = (sub.saas_plans as { slug: string } | null)?.slug;

  const { data: feature } = await supabase
    .from("saas_plan_features")
    .select("enabled, limit_value")
    .eq("plan_id", sub.plan_id)
    .eq("feature_key", moduleSlug)
    .maybeSingle();

  if (!feature || !feature.enabled) {
    return { hasAccess: false, source: "not_in_plan", planSlug };
  }

  return {
    hasAccess: true,
    source: "plan_feature",
    planSlug,
    featureEnabled: feature.enabled,
    limitValue: feature.limit_value,
  };
}
