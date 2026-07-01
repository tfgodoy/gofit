import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, NavLink } from "react-router-dom";
import {
  Building2, BarChart2, Package, CreditCard, FileText,
  Settings, LogOut, ShieldCheck, Dumbbell, ArrowLeft,
  Users, Clock, Globe, Phone, Mail, MapPin, Hash,
  CheckCircle2, XCircle, AlertTriangle, Loader2, Layers,
  Boxes, ToggleLeft, ToggleRight, Plus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAudit } from "@/lib/adminAudit";

interface ContractorDetail {
  id: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string | null;
  email: string;
  fone: string | null;
  site: string | null;
  instagram: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  cidade: string | null;
  uf: string | null;
  fuso_horario: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: string;
  blocked: boolean;
  deleted_at: string | null;
  created_at: string;
}

interface CompanyModuleRow {
  id: string;
  module_id: string;
  status: string;
  activated_at: string | null;
  modules: { name: string; slug: string; icon: string | null } | null;
}

interface GlobalModuleRow {
  id: string;
  slug: string;
  name: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo", trial: "Trial", suspended: "Suspenso", inactive: "Inativo",
};
const STATUS_STYLE: Record<string, string> = {
  active:    "bg-green-50 text-green-700 border-green-200",
  trial:     "bg-yellow-50 text-yellow-700 border-yellow-200",
  suspended: "bg-red-50 text-red-600 border-red-200",
  inactive:  "bg-gray-100 text-gray-500 border-gray-200",
};
const PLAN_LABEL: Record<string, string> = {
  trial: "Trial", starter: "Starter", profissional: "Profissional", empresarial: "Empresarial",
};
const MODULE_STATUS_LABEL: Record<string, string> = {
  active: "Ativo", inactive: "Inativo", pending: "Pendente",
  in_review: "Em análise", cancelled: "Cancelado", coming_soon: "Em breve",
};

interface SaasSubscriptionRow {
  id: string;
  plan_id: string;
  status: string;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  saas_plans: { name: string; slug: string; price_monthly: number } | null;
}

interface SubEventRow {
  id: string;
  event_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

const SUB_STATUS_LABEL: Record<string, string> = {
  trialing: "Trial", active: "Ativo", past_due: "Em atraso",
  paused: "Pausado", blocked: "Bloqueado", cancelled: "Cancelado", expired: "Expirado",
};
const SUB_STATUS_STYLE: Record<string, string> = {
  trialing: "bg-yellow-50 text-yellow-700",
  active: "bg-green-50 text-green-700",
  past_due: "bg-orange-50 text-orange-700",
  paused: "bg-blue-50 text-blue-700",
  blocked: "bg-red-50 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
  expired: "bg-gray-100 text-gray-400",
};

const navItems = [
  { icon: BarChart2,  label: "Dashboard",    to: "/admin/dashboard",      active: true },
  { icon: Building2,  label: "Empresas",     to: "/admin/companies",      active: true },
  { icon: Package,    label: "Planos",       to: "/admin/plans",          active: true },
  { icon: Layers,     label: "Assinaturas",  to: "/admin/subscriptions",  active: true },
  { icon: Boxes,      label: "Módulos",      to: "/admin/modules",        active: true },
  { icon: CreditCard, label: "Financeiro",   to: "/admin/billing",        active: true  },
  { icon: FileText,   label: "Auditoria",    to: "/admin/audit",          active: false },
  { icon: Settings,   label: "Configurações",to: "/admin/settings",       active: false },
];

export default function AdminCompanyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [company, setCompany]           = useState<ContractorDetail | null>(null);
  const [staff, setStaff]               = useState<StaffRow[]>([]);
  const [modules, setModules]           = useState<CompanyModuleRow[]>([]);
  const [allGlobalModules, setAllGlobalModules] = useState<GlobalModuleRow[]>([]);
  const [subscription, setSubscription] = useState<SaasSubscriptionRow | null>(null);
  const [subEvents, setSubEvents]       = useState<SubEventRow[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<{ id: string; amount: number; due_date: string; status: string; paid_at: string | null }[]>([]);
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const viewedLogged = useRef(false);

  useEffect(() => {
    if (!id) return;
    async function load() {
      const [
        { data: contractor, error: e1 },
        { data: staffData },
        { data: modulesData },
        { data: subData },
        { data: globalModsData },
      ] = await Promise.all([
        supabase.from("contractors").select("*").eq("id", id).single(),
        supabase.from("staff")
          .select("id, name, email, role, blocked, deleted_at, created_at")
          .eq("contractor_id", id)
          .is("deleted_at", null)
          .order("created_at"),
        supabase.from("company_modules")
          .select("id, module_id, status, activated_at, modules(name, slug, icon)")
          .eq("contractor_id", id),
        supabase.from("saas_subscriptions")
          .select("id, plan_id, status, trial_start, trial_end, current_period_start, current_period_end, cancelled_at, created_at, saas_plans(name, slug, price_monthly)")
          .eq("contractor_id", id)
          .maybeSingle(),
        supabase.from("modules")
          .select("id, slug, name, status")
          .order("sort_order", { ascending: true }),
      ]);

      if (e1 || !contractor) { setError("Empresa não encontrada."); setLoading(false); return; }

      setCompany(contractor);
      setStaff(staffData ?? []);
      setModules(modulesData ?? []);
      setAllGlobalModules((globalModsData ?? []) as GlobalModuleRow[]);

      if (subData) {
        setSubscription(subData as unknown as SaasSubscriptionRow);
        const { data: evtsData } = await supabase
          .from("saas_subscription_events")
          .select("id, event_type, old_value, new_value, created_at")
          .eq("subscription_id", subData.id)
          .order("created_at", { ascending: false })
          .limit(6);
        setSubEvents((evtsData ?? []) as SubEventRow[]);
      }

      const { data: invData } = await supabase
        .from("saas_invoices")
        .select("id, amount, due_date, status, paid_at")
        .eq("contractor_id", id)
        .order("due_date", { ascending: false })
        .limit(5);
      setRecentInvoices((invData ?? []) as { id: string; amount: number; due_date: string; status: string; paid_at: string | null }[]);

      setLoading(false);

      // Auditoria de visualização — useRef evita duplo disparo se user mudar referência
      if (!viewedLogged.current) {
        viewedLogged.current = true;
        await logAdminAudit({
          action: "COMPANY_VIEWED",
          adminUserId: user?.id,
          targetType: "contractor",
          targetId: id,
          metadata: { nome_fantasia: contractor.nome_fantasia },
        });
      }
    }
    load();
  }, [id, user]);

  /* ── Toggle override de módulo por empresa ────────────────────── */
  async function handleToggleCompanyModule(cm: CompanyModuleRow) {
    if (!company) return;
    const newStatus = cm.status === "active" ? "cancelled" : "active";
    const auditAction = newStatus === "active" ? "COMPANY_MODULE_ENABLED" : "COMPANY_MODULE_DISABLED";
    const modName = cm.modules?.name ?? cm.module_id;
    if (!window.confirm(
      `${newStatus === "active" ? "Ativar" : "Desativar"} o módulo "${modName}" para esta empresa?`
    )) return;

    setActionLoading("cm_" + cm.id);
    const { error } = await supabase
      .from("company_modules")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", cm.id);

    if (!error) {
      await logAdminAudit({
        action: auditAction,
        adminUserId: user?.id,
        targetType: "company_module",
        targetId: cm.id,
        contractorId: company.id,
        metadata: { module_slug: cm.modules?.slug, old_status: cm.status, new_status: newStatus },
      });
      setModules(prev => prev.map(m => m.id === cm.id ? { ...m, status: newStatus } : m));
    }
    setActionLoading(null);
  }

  /* ── Adicionar override de módulo para empresa ─────────────────── */
  async function handleAddModuleOverride(globalMod: GlobalModuleRow) {
    if (!company) return;
    if (!window.confirm(`Ativar o módulo "${globalMod.name}" manualmente para esta empresa?`)) return;

    setActionLoading("add_" + globalMod.id);
    const { data, error } = await supabase
      .from("company_modules")
      .upsert({
        contractor_id: company.id,
        module_id:     globalMod.id,
        status:        "active",
        activated_at:  new Date().toISOString(),
        config_json:   {},
        updated_at:    new Date().toISOString(),
      }, { onConflict: "contractor_id,module_id" })
      .select("id, module_id, status, activated_at, modules(name, slug, icon)")
      .single();

    if (!error && data) {
      await logAdminAudit({
        action: "COMPANY_MODULE_OVERRIDE_CREATED",
        adminUserId: user?.id,
        targetType: "company_module",
        targetId: data.id,
        contractorId: company.id,
        metadata: { module_slug: globalMod.slug, source: "admin_override" },
      });
      setModules(prev => {
        const exists = prev.some(m => m.module_id === globalMod.id);
        if (exists) return prev.map(m => m.module_id === globalMod.id ? { ...m, status: "active" } : m);
        return [...prev, data as CompanyModuleRow];
      });
    }
    setActionLoading(null);
  }

  async function updateStatus(
    newStatus: string,
    auditAction: "COMPANY_BLOCKED" | "COMPANY_UNBLOCKED" | "COMPANY_CANCELLED",
    label: string,
  ) {
    if (!company || !window.confirm(`Confirmar: ${label}?`)) return;
    setActionLoading(auditAction);

    const { error } = await supabase
      .from("contractors")
      .update({ status: newStatus })
      .eq("id", company.id);

    if (error) { alert("Erro ao atualizar status."); setActionLoading(null); return; }

    await logAdminAudit({
      action: auditAction,
      adminUserId: user?.id,
      targetType: "contractor",
      targetId: company.id,
      metadata: { status_anterior: company.status, novo_status: newStatus },
    });

    setCompany(prev => prev ? { ...prev, status: newStatus } : prev);
    setActionLoading(null);
  }

  async function extendTrial() {
    if (!company) return;
    const base = company.trial_ends_at
      ? new Date(Math.max(new Date(company.trial_ends_at).getTime(), Date.now()))
      : new Date();
    const newDate = new Date(base);
    newDate.setDate(newDate.getDate() + 14);
    const iso = newDate.toISOString();

    if (!window.confirm(`Estender trial por 14 dias (até ${newDate.toLocaleDateString("pt-BR")})?`)) return;
    setActionLoading("TRIAL");

    // 1. Atualiza campo legacy em contractors (compatibilidade com alertas do dashboard)
    const { error: e1 } = await supabase
      .from("contractors")
      .update({ trial_ends_at: iso })
      .eq("id", company.id);

    if (e1) { alert("Erro ao estender trial."); setActionLoading(null); return; }

    // 2. Atualiza fonte da verdade: saas_subscriptions.trial_end
    if (subscription) {
      await supabase
        .from("saas_subscriptions")
        .update({ trial_end: iso, updated_at: new Date().toISOString() })
        .eq("id", subscription.id);

      // 3. Registra evento imutável em saas_subscription_events
      await supabase.from("saas_subscription_events").insert({
        subscription_id: subscription.id,
        contractor_id: company.id,
        event_type: "TRIAL_EXTENDED",
        old_value: { trial_end: subscription.trial_end },
        new_value: { trial_end: iso },
        metadata: { source: "admin_company_details", days_added: 14 },
        created_by: user?.id ?? null,
      });
    }

    // 4. Auditoria administrativa
    await logAdminAudit({
      action: "TRIAL_EXTENDED",
      adminUserId: user?.id,
      targetType: "contractor",
      targetId: company.id,
      metadata: { nova_data: iso, subscription_id: subscription?.id },
    });

    // 5. Atualiza estado local
    setCompany(prev => prev ? { ...prev, trial_ends_at: iso } : prev);
    if (subscription) {
      setSubscription(prev => prev ? { ...prev, trial_end: iso } : prev);
    }
    setActionLoading(null);
  }

  function handleLogout() { logout(); navigate("/admin/login", { replace: true }); }

  // Capturado uma vez no mount — useState lazy initializer não é considerado render pelo linter
  const [now] = useState(() => Date.now());

  const activeStaff = staff.filter(s => !s.blocked);

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
                    isActive || (to === "/admin/companies" && window.location.pathname.startsWith("/admin/companies"))
                      ? "bg-primary/10 text-primary" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
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
        {/* Breadcrumb */}
        <button
          onClick={() => navigate("/admin/companies")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Empresas
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : error || !company ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <XCircle className="w-12 h-12 text-red-300" />
            <p className="text-sm text-gray-500">{error ?? "Empresa não encontrada."}</p>
            <button onClick={() => navigate("/admin/companies")} className="text-sm font-semibold text-primary hover:underline">
              Voltar
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">{company.nome_fantasia}</h1>
                    <p className="text-sm text-gray-400">{company.razao_social}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${STATUS_STYLE[company.status] ?? "bg-gray-100 text-gray-500"}`}>
                  {STATUS_LABEL[company.status] ?? company.status}
                </span>
                <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
                  {PLAN_LABEL[company.plan] ?? company.plan}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* Coluna esquerda — dados da empresa */}
              <div className="col-span-2 space-y-6">
                {/* Dados principais */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <h2 className="font-bold text-gray-900 mb-4">Dados da empresa</h2>
                  <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <div className="flex items-start gap-3">
                      <Hash className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                      <div>
                        <dt className="text-xs text-gray-400 mb-0.5">CNPJ</dt>
                        <dd className="text-gray-700">{company.cnpj ?? "—"}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                      <div>
                        <dt className="text-xs text-gray-400 mb-0.5">E-mail</dt>
                        <dd className="text-gray-700">{company.email}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                      <div>
                        <dt className="text-xs text-gray-400 mb-0.5">Telefone</dt>
                        <dd className="text-gray-700">{company.fone ?? "—"}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                      <div>
                        <dt className="text-xs text-gray-400 mb-0.5">Cidade</dt>
                        <dd className="text-gray-700">
                          {company.cidade && company.uf ? `${company.cidade}/${company.uf}` : "—"}
                        </dd>
                      </div>
                    </div>
                    {company.site && (
                      <div className="flex items-start gap-3">
                        <Globe className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                        <div>
                          <dt className="text-xs text-gray-400 mb-0.5">Site</dt>
                          <dd className="text-gray-700">{company.site}</dd>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <Clock className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                      <div>
                        <dt className="text-xs text-gray-400 mb-0.5">Cadastro</dt>
                        <dd className="text-gray-700">{new Date(company.created_at).toLocaleDateString("pt-BR")}</dd>
                      </div>
                    </div>
                    {company.status === "trial" && company.trial_ends_at && (
                      <div className="flex items-start gap-3 col-span-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <dt className="text-xs text-gray-400 mb-0.5">Trial expira em</dt>
                          <dd className="text-gray-700 font-semibold">
                            {new Date(company.trial_ends_at).toLocaleDateString("pt-BR")}{" "}
                            {(() => {
                              const days = Math.ceil((new Date(company.trial_ends_at!).getTime() - now) / 86400000);
                              return days >= 0
                                ? <span className={`text-xs ${days <= 3 ? "text-red-500" : "text-yellow-600"}`}>({days} dias)</span>
                                : <span className="text-xs text-red-500">(expirado)</span>;
                            })()}
                          </dd>
                        </div>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Funcionários */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-gray-900">Funcionários</h2>
                    <span className="text-xs text-gray-400">{activeStaff.length} ativo{activeStaff.length !== 1 ? "s" : ""} · {staff.length} total</span>
                  </div>
                  {staff.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-sm text-gray-400">Nenhum funcionário cadastrado.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {staff.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{s.name}</p>
                            <p className="text-xs text-gray-400">{s.email} · {s.role}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.blocked ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"}`}>
                            {s.blocked ? "Bloqueado" : "Ativo"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Módulos */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-gray-900">Módulos</h2>
                    <span className="text-xs text-gray-400">Overrides manuais por empresa</span>
                  </div>

                  {/* Overrides existentes */}
                  {modules.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {modules.map(m => (
                        <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                          <div className="flex items-center gap-3 min-w-0">
                            {m.status === "active"
                              ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                              : <XCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                            }
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {m.modules?.name ?? m.module_id}
                              </p>
                              <p className={`text-xs ${m.status === "active" ? "text-green-600" : "text-gray-400"}`}>
                                Override manual — {MODULE_STATUS_LABEL[m.status] ?? m.status}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggleCompanyModule(m)}
                            disabled={!!actionLoading}
                            className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
                              m.status === "active"
                                ? "bg-red-50 text-red-600 hover:bg-red-100"
                                : "bg-green-50 text-green-700 hover:bg-green-100"
                            }`}
                          >
                            {actionLoading === "cm_" + m.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : m.status === "active"
                                ? <ToggleRight className="w-3.5 h-3.5" />
                                : <ToggleLeft className="w-3.5 h-3.5" />
                            }
                            {m.status === "active" ? "Desativar" : "Ativar"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Adicionar override para módulo sem entrada */}
                  {allGlobalModules.filter(gm =>
                    gm.status === "active" && !modules.some(m => m.module_id === gm.id)
                  ).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">
                        Adicionar acesso manual a módulo
                      </p>
                      <div className="space-y-1">
                        {allGlobalModules
                          .filter(gm => gm.status === "active" && !modules.some(m => m.module_id === gm.id))
                          .map(gm => (
                            <div key={gm.id} className="flex items-center justify-between px-3 py-2 rounded-xl border border-dashed border-gray-200">
                              <span className="text-sm text-gray-500">{gm.name}</span>
                              <button
                                onClick={() => handleAddModuleOverride(gm)}
                                disabled={!!actionLoading}
                                className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                              >
                                {actionLoading === "add_" + gm.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <Plus className="w-3 h-3" />
                                }
                                Ativar override
                              </button>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )}

                  {modules.length === 0 && allGlobalModules.filter(gm => gm.status === "active").length === 0 && (
                    <p className="text-sm text-gray-400 py-4 text-center">Nenhum módulo configurado.</p>
                  )}
                </div>

                {/* Assinatura SaaS */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-gray-900">Assinatura SaaS</h2>
                    <button
                      onClick={() => navigate("/admin/subscriptions")}
                      className="text-xs font-semibold text-primary hover:underline">
                      Gerenciar →
                    </button>
                  </div>
                  {subscription ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SUB_STATUS_STYLE[subscription.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {SUB_STATUS_LABEL[subscription.status] ?? subscription.status}
                        </span>
                        <span className="text-sm font-semibold text-primary">
                          {subscription.saas_plans?.name ?? "—"}
                        </span>
                        {subscription.saas_plans && subscription.saas_plans.price_monthly > 0 && (
                          <span className="text-xs text-gray-400">
                            R$ {subscription.saas_plans.price_monthly.toLocaleString("pt-BR")}/mês
                          </span>
                        )}
                      </div>
                      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-600">
                        {subscription.trial_start && (
                          <div>
                            <dt className="text-gray-400 mb-0.5">Início do trial</dt>
                            <dd>{new Date(subscription.trial_start).toLocaleDateString("pt-BR")}</dd>
                          </div>
                        )}
                        {subscription.trial_end && (
                          <div>
                            <dt className="text-gray-400 mb-0.5">Fim do trial</dt>
                            <dd>{new Date(subscription.trial_end).toLocaleDateString("pt-BR")}</dd>
                          </div>
                        )}
                        {subscription.current_period_start && (
                          <div>
                            <dt className="text-gray-400 mb-0.5">Período atual</dt>
                            <dd>{new Date(subscription.current_period_start).toLocaleDateString("pt-BR")}</dd>
                          </div>
                        )}
                        {subscription.cancelled_at && (
                          <div>
                            <dt className="text-gray-400 mb-0.5">Cancelada em</dt>
                            <dd className="text-red-500">{new Date(subscription.cancelled_at).toLocaleDateString("pt-BR")}</dd>
                          </div>
                        )}
                      </dl>
                      {subEvents.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-2">Últimos eventos</p>
                          <ul className="space-y-1.5">
                            {subEvents.map(e => (
                              <li key={e.id} className="flex items-center justify-between text-xs">
                                <span className="font-mono text-gray-600 bg-gray-50 px-2 py-0.5 rounded">{e.event_type}</span>
                                <span className="text-gray-400">{new Date(e.created_at).toLocaleDateString("pt-BR")}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">Nenhuma assinatura encontrada.</p>
                  )}
                </div>
              </div>

              {/* Faturas SaaS */}
              {recentInvoices.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-gray-900">Faturas SaaS</h2>
                    <button onClick={() => navigate("/admin/billing/invoices")} className="text-xs font-semibold text-primary hover:underline">
                      Ver todas →
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {recentInvoices.map(inv => (
                      <li key={inv.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{new Date(inv.due_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                        <span className="font-medium text-gray-800">
                          {Number(inv.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${
                          inv.status === "paid"      ? "bg-green-50 text-green-700"   :
                          inv.status === "pending"   ? "bg-yellow-50 text-yellow-700" :
                          inv.status === "overdue"   ? "bg-red-50 text-red-600"      :
                          "bg-gray-100 text-gray-500"
                        }`}>
                          {inv.status === "paid" ? "Pago" : inv.status === "pending" ? "Pendente" : inv.status === "overdue" ? "Vencido" : inv.status === "cancelled" ? "Cancelado" : inv.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Coluna direita — ações */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <h2 className="font-bold text-gray-900 mb-4">Ações administrativas</h2>
                  <div className="space-y-2">
                    {company.status === "active" && (
                      <>
                        <button
                          disabled={!!actionLoading}
                          onClick={() => updateStatus("suspended", "COMPANY_BLOCKED", `Bloquear ${company.nome_fantasia}`)}
                          className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40"
                        >
                          {actionLoading === "COMPANY_BLOCKED" ? "Bloqueando..." : "Bloquear empresa"}
                        </button>
                        <button
                          disabled={!!actionLoading}
                          onClick={() => updateStatus("inactive", "COMPANY_CANCELLED", `Cancelar ${company.nome_fantasia}`)}
                          className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-40"
                        >
                          {actionLoading === "COMPANY_CANCELLED" ? "Cancelando..." : "Cancelar conta"}
                        </button>
                      </>
                    )}
                    {company.status === "trial" && (
                      <>
                        <button
                          disabled={!!actionLoading}
                          onClick={extendTrial}
                          className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-40"
                        >
                          {actionLoading === "TRIAL" ? "Estendendo..." : "Estender trial (+14 dias)"}
                        </button>
                        <button
                          disabled={!!actionLoading}
                          onClick={() => updateStatus("active", "COMPANY_UNBLOCKED", `Ativar ${company.nome_fantasia}`)}
                          className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-40"
                        >
                          {actionLoading === "COMPANY_UNBLOCKED" ? "Ativando..." : "Ativar conta agora"}
                        </button>
                        <button
                          disabled={!!actionLoading}
                          onClick={() => updateStatus("suspended", "COMPANY_BLOCKED", `Bloquear ${company.nome_fantasia}`)}
                          className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40"
                        >
                          {actionLoading === "COMPANY_BLOCKED" ? "Bloqueando..." : "Bloquear empresa"}
                        </button>
                      </>
                    )}
                    {(company.status === "suspended" || company.status === "inactive") && (
                      <button
                        disabled={!!actionLoading}
                        onClick={() => updateStatus("active", "COMPANY_UNBLOCKED", `Reativar ${company.nome_fantasia}`)}
                        className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-40"
                      >
                        {actionLoading === "COMPANY_UNBLOCKED" ? "Reativando..." : "Reativar empresa"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Resumo KPIs */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                  <h2 className="font-bold text-gray-900">Resumo</h2>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-500">
                      <Users className="w-4 h-4 text-gray-300" />Funcionários
                    </span>
                    <span className="font-semibold text-gray-900">{staff.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-500">
                      <Package className="w-4 h-4 text-gray-300" />Módulos ativos
                    </span>
                    <span className="font-semibold text-gray-900">
                      {modules.filter(m => m.status === "active").length}/{modules.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-500">
                      <Clock className="w-4 h-4 text-gray-300" />Cadastrado em
                    </span>
                    <span className="font-semibold text-gray-900">
                      {new Date(company.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
