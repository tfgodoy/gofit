import type { ReactNode } from "react";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { logAdminAudit } from "@/lib/adminAudit";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef } from "react";
import { ShieldAlert } from "lucide-react";

interface Props {
  /** Permissão exigida. Se `any` for passado, basta ter uma das permissões da lista. */
  permission?: string;
  any?: string[];
  children: ReactNode;
}

// Bloqueia o conteúdo (rota inteira ou trecho de UI) se o usuário não tiver
// a permissão RBAC exigida. super_admin e platform_owner sempre passam.
export default function RequireAdminPermission({ permission, any, children }: Props) {
  const { user } = useAuth();
  const { loading, hasAdminPermission, hasAnyAdminPermission } = useAdminPermissions();
  const deniedLogged = useRef(false);

  const allowed = loading
    ? true // evita flash de bloqueio enquanto carrega
    : permission
      ? hasAdminPermission(permission)
      : any
        ? hasAnyAdminPermission(any)
        : true;

  useEffect(() => {
    if (!loading && !allowed && !deniedLogged.current) {
      deniedLogged.current = true;
      logAdminAudit({
        action: "ADMIN_ACCESS_DENIED_BY_PERMISSION",
        adminUserId: user?.id,
        metadata: { required: permission ?? any },
      });
    }
  }, [loading, allowed, user, permission, any]);

  if (loading) return <>{children}</>;

  if (!allowed) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8">
        <ShieldAlert className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-white font-medium">Você não tem permissão para acessar esta área.</p>
        <p className="text-gray-500 text-sm mt-1">Fale com um administrador se acredita que isso é um erro.</p>
      </div>
    );
  }

  return <>{children}</>;
}
