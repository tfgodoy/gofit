import { useState, useEffect } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import {
  BarChart2, Building2, Package, CreditCard, FileText, Settings,
  LogOut, ShieldCheck, Dumbbell, Layers, Boxes, Users, KeyRound, Lock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface RolePermission {
  key: string;
  name: string;
  category: string;
}

interface RoleRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system_role: boolean;
  permissions: RolePermission[];
}

const navItems = [
  { icon: BarChart2,  label: "Dashboard",    to: "/admin/dashboard",       active: true  },
  { icon: Building2,  label: "Empresas",     to: "/admin/companies",       active: true  },
  { icon: Package,    label: "Planos",       to: "/admin/plans",           active: true  },
  { icon: Layers,     label: "Assinaturas",  to: "/admin/subscriptions",   active: true  },
  { icon: Boxes,      label: "Módulos",      to: "/admin/modules",         active: true  },
  { icon: CreditCard, label: "Financeiro",   to: "/admin/billing",         active: true  },
  { icon: Users,      label: "Usuários",     to: "/admin/users",           active: true  },
  { icon: KeyRound,   label: "Papéis",       to: "/admin/roles",           active: true  },
  { icon: FileText,   label: "Auditoria",    to: "/admin/audit",           active: false },
  { icon: Settings,   label: "Configurações",to: "/admin/settings",        active: false },
];

export default function AdminRolesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function doLoad() {
      const [{ data: rolesData }, { data: rolePerms }] = await Promise.all([
        supabase.from("admin_roles").select("id, name, slug, description, is_system_role").order("name"),
        supabase.from("admin_role_permissions").select("role_id, admin_permissions(key, name, category)"),
      ]);
      if (!active) return;

      const permsByRole = new Map<string, RolePermission[]>();
      for (const rp of (rolePerms ?? []) as unknown as { role_id: string; admin_permissions: RolePermission | null }[]) {
        if (!rp.admin_permissions) continue;
        const list = permsByRole.get(rp.role_id) ?? [];
        list.push(rp.admin_permissions);
        permsByRole.set(rp.role_id, list);
      }

      const merged = ((rolesData ?? []) as unknown as Omit<RoleRow, "permissions">[]).map(r => ({
        ...r, permissions: permsByRole.get(r.id) ?? [],
      }));

      setRoles(merged);
      setLoading(false);
    }
    doLoad();
    return () => { active = false; };
  }, []);

  async function handleLogout() { await logout(); navigate("/admin/login"); }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <aside className="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Dumbbell className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">GoFit Admin</div>
              <div className="text-xs text-gray-400">Plataforma</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item =>
            item.active ? (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? "bg-orange-500/20 text-orange-400" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
                <item.icon className="w-4 h-4" />{item.label}
              </NavLink>
            ) : (
              <div key={item.to} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 cursor-not-allowed">
                <item.icon className="w-4 h-4" />{item.label}
              </div>
            )
          )}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-3 px-3 py-2 text-sm text-gray-400">
            <ShieldCheck className="w-4 h-4 text-orange-500" />
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-medium truncate">{user?.email}</div>
              <div className="text-xs text-gray-500">Platform Owner</div>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 w-full mt-1 transition-colors">
            <LogOut className="w-4 h-4" />Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Papéis Administrativos</h1>
            <p className="text-gray-400 text-sm mt-1">
              Visualização dos papéis e permissões do RBAC administrativo. Edição de permissões fica para uma melhoria futura (Fase 7) —
              por ora, papéis e vínculos são gerenciados via seed de migration para reduzir risco de erro humano em produção.
            </p>
          </div>

          {loading ? (
            <div className="text-gray-400 text-sm">Carregando...</div>
          ) : (
            <div className="space-y-4">
              {roles.map(role => (
                <div key={role.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-semibold">{role.name}</h3>
                      {role.is_system_role && (
                        <span className="flex items-center gap-1 text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                          <Lock className="w-3 h-3" />Papel de sistema
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{role.permissions.length} permissões</span>
                  </div>
                  {role.description && <p className="text-sm text-gray-400 mb-3">{role.description}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {role.permissions.length === 0 ? (
                      <span className="text-xs text-gray-500">Nenhuma permissão vinculada.</span>
                    ) : (
                      role.permissions.map(p => (
                        <span key={p.key} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full" title={p.category}>
                          {p.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
