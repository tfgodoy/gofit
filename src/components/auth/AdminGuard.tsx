import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { logAdminAudit } from "@/lib/adminAudit";

interface Props {
  children: React.ReactNode;
}

// Protects all /admin/* routes. Requires role "owner" (platform_owners).
// Redirects unauthenticated users and non-owners to /admin/login.
// Logs ADMIN_ACCESS_DENIED for authenticated non-owners.
export default function AdminGuard({ children }: Props) {
  const { user, loading } = useAuth();
  const deniedLogged = useRef(false);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "owner") {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
