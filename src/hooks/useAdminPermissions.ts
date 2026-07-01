import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AdminPermissionsState {
  loading: boolean;
  isSuperAdmin: boolean;
  isPlatformOwner: boolean;
  adminUserId: string | null;
  roles: string[];
  permissions: Set<string>;
  hasAdminPermission: (key: string) => boolean;
  hasAnyAdminPermission: (keys: string[]) => boolean;
  hasAllAdminPermissions: (keys: string[]) => boolean;
}

// Resolve as roles/permissões RBAC do usuário admin autenticado.
// platform_owners é sempre tratado como super_admin implícito, mesmo que
// o vínculo em admin_user_roles não exista — garante que o Owner de
// bootstrap nunca fica bloqueado por uma falha de seed.
export function useAdminPermissions(): AdminPermissionsState {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user || user.role !== "owner") {
        if (active) { setLoading(false); }
        return;
      }

      const { data: ownerRow } = await supabase
        .from("platform_owners")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const isOwner = !!ownerRow?.user_id;

      const { data: adminUser } = await supabase
        .from("admin_users")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!active) return;

      setIsPlatformOwner(isOwner);

      if (!adminUser) {
        // platform_owner sem vínculo admin_users ainda funciona como super_admin implícito
        setAdminUserId(null);
        setRoles(isOwner ? ["super_admin"] : []);
        setPermissions(new Set());
        setLoading(false);
        return;
      }

      setAdminUserId(adminUser.id as string);

      const { data: roleRows } = await supabase
        .from("admin_user_roles")
        .select("role_id, admin_roles(slug)")
        .eq("admin_user_id", adminUser.id);

      const roleIdRows = (roleRows ?? []) as unknown as { role_id: string; admin_roles: { slug: string } | null }[];
      const roleSlugs = roleIdRows.map(r => r.admin_roles?.slug).filter((s): s is string => !!s);
      const roleIds   = roleIdRows.map(r => r.role_id);

      if (!active) return;
      setRoles(roleSlugs);

      if (roleSlugs.includes("super_admin") || isOwner || roleIds.length === 0) {
        setPermissions(new Set());
        setLoading(false);
        return;
      }

      const { data: permRows } = await supabase
        .from("admin_role_permissions")
        .select("admin_permissions(key)")
        .in("role_id", roleIds);

      if (!active) return;
      const permKeys = ((permRows ?? []) as unknown as { admin_permissions: { key: string } | null }[])
        .map(p => p.admin_permissions?.key)
        .filter((k): k is string => !!k);

      setPermissions(new Set(permKeys));
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [user]);

  const isSuperAdmin = isPlatformOwner || roles.includes("super_admin");

  function hasAdminPermission(key: string): boolean {
    if (isSuperAdmin) return true;
    return permissions.has(key);
  }
  function hasAnyAdminPermission(keys: string[]): boolean {
    if (isSuperAdmin) return true;
    return keys.some(k => permissions.has(k));
  }
  function hasAllAdminPermissions(keys: string[]): boolean {
    if (isSuperAdmin) return true;
    return keys.every(k => permissions.has(k));
  }

  return {
    loading, isSuperAdmin, isPlatformOwner, adminUserId, roles, permissions,
    hasAdminPermission, hasAnyAdminPermission, hasAllAdminPermissions,
  };
}
