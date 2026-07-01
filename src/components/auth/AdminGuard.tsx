import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAudit } from "@/lib/adminAudit";

interface Props {
  children: React.ReactNode;
}

// Protects all /admin/* routes. Requires role "owner" (platform_owners ou
// admin_user ativo — RBAC Fase 6). platform_owners é sempre aceito
// (bootstrap/super admin). admin_users com status != 'active' são
// revalidados e barrados mesmo com sessão local ainda presente.
// Redirects unauthenticated users and non-owners to /admin/login.
// Logs ADMIN_ACCESS_DENIED for authenticated non-owners.
export default function AdminGuard({ children }: Props) {
  const { user, loading, logout } = useAuth();
  const deniedLogged = useRef(false);
  const [statusChecked, setStatusChecked] = useState(false);
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    if (!loading && user && user.role !== "owner" && !deniedLogged.current) {
      deniedLogged.current = true;
      logAdminAudit({
        action: "ADMIN_ACCESS_DENIED",
        adminUserId: user.id,
        metadata: { role: user.role, email: user.email },
      });
    }
  }, [loading, user]);

  useEffect(() => {
    let active = true;
    async function revalidate() {
      if (loading || !user || user.role !== "owner") { if (active) setStatusChecked(true); return; }

      const { data: ownerRow } = await supabase
        .from("platform_owners")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (ownerRow?.user_id) {
        if (active) { setStatusChecked(true); setRevoked(false); }
        return;
      }

      const { data: adminUserRow } = await supabase
        .from("admin_users")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;
      if (!adminUserRow || adminUserRow.status !== "active") {
        setRevoked(true);
        logout();
      }
      setStatusChecked(true);
    }
    void revalidate();
    return () => { active = false; };
  }, [loading, user, logout]);

  if (loading || !statusChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "owner" || revoked) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
