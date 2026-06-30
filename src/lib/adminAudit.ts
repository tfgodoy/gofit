import { supabase } from "@/integrations/supabase/client";

export type AdminAuditAction =
  | "ADMIN_LOGIN_SUCCESS"
  | "ADMIN_LOGIN_DENIED"
  | "ADMIN_LOGOUT"
  | "ADMIN_ACCESS_DENIED"
  // Fase 2+
  | "COMPANY_VIEWED"
  | "COMPANY_UPDATED"
  | "COMPANY_BLOCKED"
  | "COMPANY_UNBLOCKED"
  | "COMPANY_CANCELLED"
  | "PLAN_CHANGED"
  | "MODULE_ENABLED"
  | "MODULE_DISABLED"
  | "SUBSCRIPTION_CANCELLED"
  | "TRIAL_EXTENDED"
  | "SUPPORT_IMPERSONATION_STARTED"
  | "SUPPORT_IMPERSONATION_ENDED";

interface AuditParams {
  action: AdminAuditAction;
  adminUserId?: string | null;
  targetType?: string;
  targetId?: string;
  contractorId?: string;
  metadata?: Record<string, unknown>;
}

// Uses a SECURITY DEFINER RPC so audit writes work even outside an active owner session
// (e.g. denied login attempts where RLS would otherwise block the INSERT).
export async function logAdminAudit({
  action,
  adminUserId,
  targetType,
  targetId,
  contractorId,
  metadata,
}: AuditParams): Promise<void> {
  try {
    await supabase.rpc("insert_admin_audit_log", {
      p_admin_user_id: adminUserId ?? null,
      p_action: action,
      p_target_type: targetType ?? null,
      p_target_id: targetId ?? null,
      p_contractor_id: contractorId ?? null,
      p_metadata: metadata ?? {},
      p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    // Audit failures must never break the main flow
    console.warn("[audit] Failed to log admin action:", action);
  }
}
