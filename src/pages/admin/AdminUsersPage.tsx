import { useState, useEffect } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import {
  BarChart2, Building2, Package, CreditCard, FileText, Settings,
  LogOut, ShieldCheck, Dumbbell, Layers, Boxes, Users, KeyRound,
  Plus, ToggleLeft, ToggleRight, X, Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAudit } from "@/lib/adminAudit";
import { toast } from "sonner";

interface AdminRole {
  id: string;
  name: string;
  slug: string;
}

interface AdminUserRow {
  id: string;
  user_id: string;
  name: string;
  email: string;
  status: "active" | "inactive" | "suspended";
  created_at: string;
  last_login_at: string | null;
  roles: AdminRole[];
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

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo", inactive: "Inativo", suspended: "Suspenso",
};
const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-900/40 text-green-400",
  inactive: "bg-gray-800 text-gray-400",
  suspended: "bg-red-900/40 text-red-400",
};

export default function AdminUsersPage() {
  const { user, logout } = useAuth();
  const { isSuperAdmin, hasAdminPermission } = useAdminPermissions();
  const navigate = useNavigate();

  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [roleModalUser, setRoleModalUser] = useState<AdminUserRow | null>(null);

  const canManage = isSuperAdmin || hasAdminPermission("admin_users.manage");

  function refresh() { setLoading(true); setRefreshKey(k => k + 1); }

  useEffect(() => {
    let active = true;
    async function doLoad() {
      const [{ data: usersData }, { data: rolesData }, { data: userRolesData }] = await Promise.all([
        supabase.from("admin_users").select("id, user_id, name, email, status, created_at, last_login_at").order("created_at", { ascending: false }),
        supabase.from("admin_roles").select("id, name, slug").order("name"),
        supabase.from("admin_user_roles").select("admin_user_id, admin_roles(id, name, slug)"),
      ]);
      if (!active) return;

      const rolesByUser = new Map<string, AdminRole[]>();
      for (const r of (userRolesData ?? []) as unknown as { admin_user_id: string; admin_roles: AdminRole | null }[]) {
        if (!r.admin_roles) continue;
        const list = rolesByUser.get(r.admin_user_id) ?? [];
        list.push(r.admin_roles);
        rolesByUser.set(r.admin_user_id, list);
      }

      const merged = ((usersData ?? []) as unknown as Omit<AdminUserRow, "roles">[]).map(u => ({
        ...u, roles: rolesByUser.get(u.id) ?? [],
      }));

      setRows(merged);
      setRoles((rolesData ?? []) as AdminRole[]);
      setLoading(false);
    }
    doLoad();
    return () => { active = false; };
  }, [refreshKey]);

  const superAdminCount = rows.filter(r => r.status === "active" && r.roles.some(ro => ro.slug === "super_admin")).length;

  async function handleCreateLink() {
    if (!canManage) { toast.error("Você não tem permissão para gerenciar usuários administrativos."); return; }
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setSaving(true);

    const { data: authUser } = await supabase.rpc("find_auth_user_by_email", { p_email: email }).maybeSingle() as { data: { id: string } | null };

    if (!authUser?.id) {
      toast.error("Nenhum usuário Supabase Auth encontrado com este e-mail. Peça para a pessoa criar conta primeiro.");
      setSaving(false);
      return;
    }

    const { data: created, error } = await supabase
      .from("admin_users")
      .insert({ user_id: authUser.id, name: email.split("@")[0], email, status: "active" })
      .select("id")
      .single();

    if (error) {
      toast.error(error.code === "23505" ? "Este usuário já é um admin." : "Erro ao criar vínculo admin.");
      setSaving(false);
      return;
    }

    await logAdminAudit({ action: "ADMIN_USER_CREATED", adminUserId: user?.id, targetType: "admin_user", targetId: created.id, metadata: { email } });
    toast.success("Usuário administrativo criado.");
    setShowCreate(false);
    setNewEmail("");
    setSaving(false);
    refresh();
  }

  async function handleToggleStatus(row: AdminUserRow) {
    if (!canManage) { toast.error("Você não tem permissão para gerenciar usuários administrativos."); return; }
    const isSuperAdminUser = row.roles.some(r => r.slug === "super_admin");
    if (row.status === "active" && isSuperAdminUser && superAdminCount <= 1) {
      toast.error("Não é possível desativar o último Super Admin da plataforma.");
      return;
    }
    const newStatus = row.status === "active" ? "inactive" : "active";
    if (!window.confirm(`${newStatus === "active" ? "Ativar" : "Desativar"} o acesso admin de ${row.email}?`)) return;

    const { error } = await supabase.from("admin_users").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (error) { toast.error("Erro ao atualizar status."); return; }

    await logAdminAudit({
      action: newStatus === "active" ? "ADMIN_USER_ACTIVATED" : "ADMIN_USER_DEACTIVATED",
      adminUserId: user?.id, targetType: "admin_user", targetId: row.id, metadata: { email: row.email },
    });
    toast.success(`Usuário ${newStatus === "active" ? "ativado" : "desativado"}.`);
    refresh();
  }

  async function handleAssignRole(row: AdminUserRow, role: AdminRole) {
    if (!canManage) { toast.error("Você não tem permissão para gerenciar usuários administrativos."); return; }
    const { error } = await supabase.from("admin_user_roles").insert({ admin_user_id: row.id, role_id: role.id });
    if (error) { if (error.code !== "23505") toast.error("Erro ao atribuir papel."); return; }
    await logAdminAudit({ action: "ADMIN_ROLE_ASSIGNED", adminUserId: user?.id, targetType: "admin_user", targetId: row.id, metadata: { role: role.slug } });
    toast.success(`Papel "${role.name}" atribuído.`);
    refresh();
    setRoleModalUser(prev => prev ? { ...prev, roles: [...prev.roles, role] } : prev);
  }

  async function handleRemoveRole(row: AdminUserRow, role: AdminRole) {
    if (!canManage) { toast.error("Você não tem permissão para gerenciar usuários administrativos."); return; }
    if (role.slug === "super_admin" && superAdminCount <= 1 && row.roles.some(r => r.slug === "super_admin")) {
      toast.error("Não é possível remover o último Super Admin da plataforma.");
      return;
    }
    const { error } = await supabase.from("admin_user_roles").delete().eq("admin_user_id", row.id).eq("role_id", role.id);
    if (error) { toast.error("Erro ao remover papel."); return; }
    await logAdminAudit({ action: "ADMIN_ROLE_REMOVED", adminUserId: user?.id, targetType: "admin_user", targetId: row.id, metadata: { role: role.slug } });
    toast.success(`Papel "${role.name}" removido.`);
    refresh();
    setRoleModalUser(prev => prev ? { ...prev, roles: prev.roles.filter(r => r.id !== role.id) } : prev);
  }

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
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Usuários Administrativos</h1>
              <p className="text-gray-400 text-sm mt-1">Equipe interna da GoFit com acesso a /admin/*</p>
            </div>
            {canManage && (
              <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" />Novo usuário
              </button>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-gray-500 text-sm">Carregando...</div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">Nenhum usuário administrativo cadastrado.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500">
                    <th className="text-left px-5 py-3">Nome / E-mail</th>
                    <th className="text-left px-5 py-3">Papéis</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Último login</th>
                    <th className="text-right px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {rows.map(row => (
                    <tr key={row.id} className="hover:bg-gray-800/40">
                      <td className="px-5 py-3">
                        <div className="text-white font-medium">{row.name}</div>
                        <div className="text-xs text-gray-500">{row.email}</div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.roles.length === 0 && <span className="text-xs text-gray-600">Sem papel</span>}
                          {row.roles.map(r => (
                            <span key={r.id} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">{r.name}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[row.status]}`}>
                          {STATUS_LABEL[row.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {row.last_login_at ? new Date(row.last_login_at).toLocaleString("pt-BR") : "Nunca"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canManage && (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setRoleModalUser(row)} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition-colors">
                              Papéis
                            </button>
                            <button onClick={() => handleToggleStatus(row)} className="text-xs flex items-center gap-1 text-gray-400 hover:text-white transition-colors">
                              {row.status === "active" ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Vincular usuário admin</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              O e-mail deve pertencer a um usuário já existente no Supabase Auth (ex.: alguém que já fez algum login no sistema).
            </p>
            <input
              type="email"
              placeholder="email@gofit.com.br"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 mb-4"
            />
            <button onClick={handleCreateLink} disabled={saving || !newEmail.trim()} className="w-full py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white transition-colors disabled:opacity-50">
              Vincular
            </button>
          </div>
        </div>
      )}

      {roleModalUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Papéis de {roleModalUser.email}</h3>
              <button onClick={() => setRoleModalUser(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {roles.map(role => {
                const has = roleModalUser.roles.some(r => r.id === role.id);
                return (
                  <div key={role.id} className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg">
                    <span className="text-sm text-white">{role.name}</span>
                    {has ? (
                      <button onClick={() => handleRemoveRole(roleModalUser, role)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                        <Trash2 className="w-3 h-3" />Remover
                      </button>
                    ) : (
                      <button onClick={() => handleAssignRole(roleModalUser, role)} className="text-xs text-orange-400 hover:text-orange-300">
                        Atribuir
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
