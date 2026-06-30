import { useState, useEffect, useCallback } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import {
  Building2, Search, BarChart2, Package, CreditCard,
  FileText, Settings, LogOut, ShieldCheck, Dumbbell,
  ChevronRight, Filter, X, Users, Clock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAudit } from "@/lib/adminAudit";

interface ContractorRow {
  id: string;
  nome_fantasia: string;
  razao_social: string;
  email: string;
  cnpj: string | null;
  fone: string | null;
  cidade: string | null;
  uf: string | null;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo", trial: "Trial", suspended: "Suspenso", inactive: "Inativo",
};
const STATUS_STYLE: Record<string, string> = {
  active:    "bg-green-50 text-green-700",
  trial:     "bg-yellow-50 text-yellow-700",
  suspended: "bg-red-50 text-red-600",
  inactive:  "bg-gray-100 text-gray-500",
};
const PLAN_LABEL: Record<string, string> = {
  trial: "Trial", starter: "Starter", profissional: "Profissional", empresarial: "Empresarial",
};

const navItems = [
  { icon: BarChart2,  label: "Dashboard",    to: "/admin/dashboard",  active: true },
  { icon: Building2,  label: "Empresas",     to: "/admin/companies",  active: true },
  { icon: Package,    label: "Planos",       to: "/admin/plans",      active: false },
  { icon: CreditCard, label: "Financeiro",   to: "/admin/billing",    active: false },
  { icon: FileText,   label: "Auditoria",    to: "/admin/audit",      active: false },
  { icon: Settings,   label: "Configurações",to: "/admin/settings",   active: false },
];

export default function AdminCompaniesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [companies, setCompanies]   = useState<ContractorRow[]>([]);
  const [filtered, setFiltered]     = useState<ContractorRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("contractors")
        .select("id, nome_fantasia, razao_social, email, cnpj, fone, cidade, uf, plan, status, trial_ends_at, created_at")
        .order("created_at", { ascending: false });

      if (error) { setError("Erro ao carregar empresas."); setLoading(false); return; }
      setCompanies(data ?? []);
      setFiltered(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // Aplica filtros localmente para evitar round-trips desnecessários
  useEffect(() => {
    let result = [...companies];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(c =>
        c.nome_fantasia.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.cnpj ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        (c.razao_social ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") result = result.filter(c => c.status === statusFilter);
    if (planFilter !== "all")   result = result.filter(c => c.plan === planFilter);
    setFiltered(result);
  }, [search, statusFilter, planFilter, companies]);

  const updateStatus = useCallback(async (
    id: string,
    newStatus: string,
    auditAction: "COMPANY_BLOCKED" | "COMPANY_UNBLOCKED" | "COMPANY_CANCELLED",
    label: string,
  ) => {
    if (!window.confirm(`Confirmar: ${label}?`)) return;
    setActionLoading(id + auditAction);

    const { error } = await supabase
      .from("contractors")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      alert("Erro ao atualizar status.");
      setActionLoading(null);
      return;
    }

    await logAdminAudit({
      action: auditAction,
      adminUserId: user?.id,
      targetType: "contractor",
      targetId: id,
      metadata: { novo_status: newStatus },
    });

    setCompanies(prev =>
      prev.map(c => c.id === id ? { ...c, status: newStatus } : c)
    );
    setActionLoading(null);
  }, [user]);

  const extendTrial = useCallback(async (id: string) => {
    const current = companies.find(c => c.id === id);
    const base = current?.trial_ends_at
      ? new Date(Math.max(new Date(current.trial_ends_at).getTime(), Date.now()))
      : new Date();
    const newDate = new Date(base);
    newDate.setDate(newDate.getDate() + 14);
    const iso = newDate.toISOString();

    if (!window.confirm(`Estender trial por 14 dias (até ${newDate.toLocaleDateString("pt-BR")})?`)) return;
    setActionLoading(id + "TRIAL");

    const { error } = await supabase
      .from("contractors")
      .update({ trial_ends_at: iso })
      .eq("id", id);

    if (error) { alert("Erro ao estender trial."); setActionLoading(null); return; }

    await logAdminAudit({
      action: "TRIAL_EXTENDED",
      adminUserId: user?.id,
      targetType: "contractor",
      targetId: id,
      metadata: { nova_data: iso },
    });

    setCompanies(prev =>
      prev.map(c => c.id === id ? { ...c, trial_ends_at: iso } : c)
    );
    setActionLoading(null);
  }, [companies, user]);

  function handleLogout() { logout(); navigate("/admin/login", { replace: true }); }

  const trialExpiring = companies.filter(c => {
    if (c.status !== "trial" || !c.trial_ends_at) return false;
    const days = (new Date(c.trial_ends_at).getTime() - Date.now()) / 86400000;
    return days <= 7 && days >= 0;
  }).length;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* SIDEBAR */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col fixed h-full z-10">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Dumbbell className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">Go<span className="text-primary">Fit</span></span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">GoFit Admin</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ icon: Icon, label, to, active }) =>
            active ? (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive ? "bg-primary/10 text-primary" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />{label}
              </NavLink>
            ) : (
              <div key={to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 cursor-not-allowed"
                title="Em breve"
              >
                <Icon className="w-4 h-4 flex-shrink-0" />{label}
                <span className="ml-auto text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">em breve</span>
              </div>
            )
          )}
        </nav>
        <div className="p-3 border-t border-gray-100 space-y-1">
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-gray-700 truncate">{user?.email}</p>
            <p className="text-xs text-gray-400">Super Admin</p>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />Sair
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 ml-56 p-8 min-h-screen">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Empresas</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {loading ? "Carregando..." : `${companies.length} empresas cadastradas`}
              {trialExpiring > 0 && (
                <span className="ml-2 text-yellow-600 font-semibold">
                  · {trialExpiring} trial{trialExpiring > 1 ? "s" : ""} expirando em 7 dias
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-52 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, e-mail ou CNPJ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">Todos os status</option>
              <option value="active">Ativo</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspenso</option>
              <option value="inactive">Inativo</option>
            </select>
            <select
              value={planFilter}
              onChange={e => setPlanFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">Todos os planos</option>
              <option value="trial">Trial</option>
              <option value="starter">Starter</option>
              <option value="profissional">Profissional</option>
              <option value="empresarial">Empresarial</option>
            </select>
          </div>
          {(search || statusFilter !== "all" || planFilter !== "all") && (
            <span className="text-xs text-gray-400">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {error ? (
            <div className="flex items-center justify-center py-16 text-red-500 text-sm">{error}</div>
          ) : loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Users className="w-10 h-10 text-gray-200" />
              <p className="text-sm text-gray-400">Nenhuma empresa encontrada.</p>
              {(search || statusFilter !== "all" || planFilter !== "all") && (
                <button
                  onClick={() => { setSearch(""); setStatusFilter("all"); setPlanFilter("all"); }}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Empresa</th>
                    <th className="text-left px-4 py-3">Plano</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Cidade</th>
                    <th className="text-left px-4 py-3">Cadastro</th>
                    <th className="text-left px-4 py-3">Trial até</th>
                    <th className="text-left px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(c => {
                    const isLoading = (suffix: string) => actionLoading === c.id + suffix;
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3.5">
                          <div>
                            <p className="font-medium text-gray-900">{c.nome_fantasia}</p>
                            <p className="text-xs text-gray-400">{c.email}</p>
                            {c.cnpj && <p className="text-xs text-gray-300">{c.cnpj}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                            {PLAN_LABEL[c.plan] ?? c.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[c.status] ?? "bg-gray-100 text-gray-500"}`}>
                            {STATUS_LABEL[c.status] ?? c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600 text-xs">
                          {c.cidade && c.uf ? `${c.cidade}/${c.uf}` : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs">
                          {new Date(c.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3.5 text-xs">
                          {c.trial_ends_at ? (
                            (() => {
                              const days = Math.ceil((new Date(c.trial_ends_at).getTime() - Date.now()) / 86400000);
                              return (
                                <span className={days <= 3 ? "text-red-500 font-semibold" : days <= 7 ? "text-yellow-600" : "text-gray-500"}>
                                  {new Date(c.trial_ends_at).toLocaleDateString("pt-BR")}
                                  {days >= 0 && ` (${days}d)`}
                                </span>
                              );
                            })()
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              onClick={() => navigate(`/admin/companies/${c.id}`)}
                              className="text-xs font-semibold text-primary hover:underline px-2 py-1"
                            >
                              Detalhes
                            </button>
                            {c.status === "active" && (
                              <button
                                disabled={!!actionLoading}
                                onClick={() => updateStatus(c.id, "suspended", "COMPANY_BLOCKED", `Bloquear ${c.nome_fantasia}`)}
                                className="text-xs font-semibold text-red-500 hover:underline px-2 py-1 disabled:opacity-40"
                              >
                                {isLoading("COMPANY_BLOCKED") ? "..." : "Bloquear"}
                              </button>
                            )}
                            {c.status === "trial" && (
                              <>
                                <button
                                  disabled={!!actionLoading}
                                  onClick={() => extendTrial(c.id)}
                                  className="text-xs font-semibold text-blue-500 hover:underline px-2 py-1 disabled:opacity-40"
                                >
                                  {isLoading("TRIAL") ? "..." : "+14 dias"}
                                </button>
                                <button
                                  disabled={!!actionLoading}
                                  onClick={() => updateStatus(c.id, "active", "COMPANY_UNBLOCKED", `Ativar ${c.nome_fantasia}`)}
                                  className="text-xs font-semibold text-green-600 hover:underline px-2 py-1 disabled:opacity-40"
                                >
                                  {isLoading("COMPANY_UNBLOCKED") ? "..." : "Ativar"}
                                </button>
                                <button
                                  disabled={!!actionLoading}
                                  onClick={() => updateStatus(c.id, "suspended", "COMPANY_BLOCKED", `Bloquear ${c.nome_fantasia}`)}
                                  className="text-xs font-semibold text-red-500 hover:underline px-2 py-1 disabled:opacity-40"
                                >
                                  {isLoading("COMPANY_BLOCKED") ? "..." : "Bloquear"}
                                </button>
                              </>
                            )}
                            {c.status === "suspended" && (
                              <button
                                disabled={!!actionLoading}
                                onClick={() => updateStatus(c.id, "active", "COMPANY_UNBLOCKED", `Reativar ${c.nome_fantasia}`)}
                                className="text-xs font-semibold text-green-600 hover:underline px-2 py-1 disabled:opacity-40"
                              >
                                {isLoading("COMPANY_UNBLOCKED") ? "..." : "Reativar"}
                              </button>
                            )}
                            {c.status === "inactive" && (
                              <button
                                disabled={!!actionLoading}
                                onClick={() => updateStatus(c.id, "active", "COMPANY_UNBLOCKED", `Reativar ${c.nome_fantasia}`)}
                                className="text-xs font-semibold text-green-600 hover:underline px-2 py-1 disabled:opacity-40"
                              >
                                {isLoading("COMPANY_UNBLOCKED") ? "..." : "Reativar"}
                              </button>
                            )}
                            {(c.status === "active" || c.status === "trial") && (
                              <button
                                disabled={!!actionLoading}
                                onClick={() => updateStatus(c.id, "inactive", "COMPANY_CANCELLED", `Cancelar ${c.nome_fantasia}`)}
                                className="text-xs font-semibold text-gray-400 hover:underline px-2 py-1 disabled:opacity-40"
                              >
                                {isLoading("COMPANY_CANCELLED") ? "..." : "Cancelar"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Totais */}
        {!loading && companies.length > 0 && (
          <div className="mt-4 flex gap-4 text-xs text-gray-500">
            {["active", "trial", "suspended", "inactive"].map(s => {
              const count = companies.filter(c => c.status === s).length;
              return count > 0 ? (
                <span key={s}>
                  <span className={`font-semibold ${s === "active" ? "text-green-600" : s === "trial" ? "text-yellow-600" : s === "suspended" ? "text-red-500" : "text-gray-400"}`}>
                    {count}
                  </span>{" "}{STATUS_LABEL[s]}
                </span>
              ) : null;
            })}
          </div>
        )}
      </main>
    </div>
  );
}
