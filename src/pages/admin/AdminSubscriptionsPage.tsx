import { useState, useEffect, useMemo } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import {
  BarChart2, Building2, Package, CreditCard, FileText, Settings,
  LogOut, ShieldCheck, Dumbbell, Search, Layers, AlertCircle,
  RefreshCcw, XCircle, CheckCircle2, Calendar,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAudit } from "@/lib/adminAudit";

interface SaasPlan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
}

interface ContractorInfo {
  id: string;
  nome_fantasia: string;
  email: string;
  status: string;
}

interface SubscriptionRow {
  id: string;
  contractor_id: string;
  plan_id: string;
  status: string;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  saas_plans: SaasPlan | null;
  contractors: ContractorInfo | null;
}

const SUB_STATUS_LABEL: Record<string, string> = {
  trialing: "Trial",
  active: "Ativo",
  past_due: "Em atraso",
  paused: "Pausado",
  blocked: "Bloqueado",
  cancelled: "Cancelado",
  expired: "Expirado",
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

const SUB_STATUS_OPTIONS = [
  "trialing", "active", "past_due", "paused", "blocked", "cancelled", "expired",
];

const navItems = [
  { icon: BarChart2, label: "Dashboard",    to: "/admin/dashboard",       active: true },
  { icon: Building2, label: "Empresas",     to: "/admin/companies",       active: true },
  { icon: Package,   label: "Planos",       to: "/admin/plans",           active: true },
  { icon: Layers,    label: "Assinaturas",  to: "/admin/subscriptions",   active: true },
  { icon: CreditCard,label: "Financeiro",   to: "/admin/billing",         active: false },
  { icon: FileText,  label: "Auditoria",    to: "/admin/audit",           active: false },
  { icon: Settings,  label: "Configurações",to: "/admin/settings",        active: false },
];

type ModalMode = "status" | "plan" | "trial" | null;

export default function AdminSubscriptionsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedSub, setSelectedSub] = useState<SubscriptionRow | null>(null);
  const [modalValue, setModalValue] = useState("");
  const [modalDate, setModalDate] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function doLoad() {
      const [{ data: subs }, { data: plansData }] = await Promise.all([
        supabase
          .from("saas_subscriptions")
          .select(`
            id, contractor_id, plan_id, status, trial_start, trial_end,
            current_period_start, current_period_end, cancelled_at, created_at, updated_at,
            saas_plans(id, name, slug, price_monthly),
            contractors(id, nome_fantasia, email, status)
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("saas_plans")
          .select("id, name, slug, price_monthly")
          .eq("status", "active")
          .order("sort_order"),
      ]);
      if (!active) return;
      if (subs) setSubscriptions(subs as unknown as SubscriptionRow[]);
      if (plansData) setPlans(plansData as SaasPlan[]);
      setLoading(false);
    }
    doLoad();
    return () => { active = false; };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    let result = [...subscriptions];
    if (statusFilter !== "all") result = result.filter(s => s.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(s =>
        (s.contractors?.nome_fantasia ?? "").toLowerCase().includes(q) ||
        (s.contractors?.email ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [subscriptions, statusFilter, search]);

  function openModal(mode: ModalMode, sub: SubscriptionRow) {
    setSelectedSub(sub);
    setModalMode(mode);
    setActionError(null);
    if (mode === "status") setModalValue(sub.status);
    if (mode === "plan") setModalValue(sub.plan_id);
    if (mode === "trial") {
      const trialEnd = sub.trial_end ? sub.trial_end.split("T")[0] : "";
      setModalDate(trialEnd);
    }
  }

  async function insertSubEvent(
    subId: string,
    contractorId: string,
    eventType: string,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
  ) {
    await supabase.from("saas_subscription_events").insert({
      subscription_id: subId,
      contractor_id: contractorId,
      event_type: eventType,
      old_value: oldValue,
      new_value: newValue,
      metadata: {},
      created_by: user?.id ?? null,
    });
  }

  async function handleStatusChange() {
    if (!selectedSub || !modalValue) return;
    if (modalValue === selectedSub.status) { setModalMode(null); return; }
    setActionLoading(true);
    setActionError(null);

    const updates: Record<string, unknown> = {
      status: modalValue,
      updated_at: new Date().toISOString(),
    };
    if (modalValue === "cancelled") {
      updates.cancelled_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("saas_subscriptions")
      .update(updates)
      .eq("id", selectedSub.id);

    if (error) { setActionError(error.message); setActionLoading(false); return; }

    await insertSubEvent(
      selectedSub.id, selectedSub.contractor_id,
      "SUBSCRIPTION_STATUS_CHANGED",
      { status: selectedSub.status },
      { status: modalValue },
    );
    await logAdminAudit({
      action: modalValue === "cancelled" ? "SUBSCRIPTION_CANCELLED"
            : modalValue === "active" ? "SUBSCRIPTION_ACTIVATED"
            : "SUBSCRIPTION_STATUS_CHANGED",
      adminUserId: user?.id,
      targetType: "saas_subscription",
      targetId: selectedSub.id,
      contractorId: selectedSub.contractor_id,
      metadata: {
        old_status: selectedSub.status,
        new_status: modalValue,
        nome_fantasia: selectedSub.contractors?.nome_fantasia,
      },
    });

    setActionLoading(false);
    setModalMode(null);
    setRefreshKey(k => k + 1);
  }

  async function handlePlanChange() {
    if (!selectedSub || !modalValue) return;
    if (modalValue === selectedSub.plan_id) { setModalMode(null); return; }
    setActionLoading(true);
    setActionError(null);

    const newPlan = plans.find(p => p.id === modalValue);
    const oldPlan = selectedSub.saas_plans;

    const { error } = await supabase
      .from("saas_subscriptions")
      .update({ plan_id: modalValue, updated_at: new Date().toISOString() })
      .eq("id", selectedSub.id);

    if (error) { setActionError(error.message); setActionLoading(false); return; }

    await insertSubEvent(
      selectedSub.id, selectedSub.contractor_id,
      "SUBSCRIPTION_PLAN_CHANGED",
      { plan_id: selectedSub.plan_id, plan_name: oldPlan?.name, price_monthly: oldPlan?.price_monthly },
      { plan_id: modalValue, plan_name: newPlan?.name, price_monthly: newPlan?.price_monthly },
    );
    await logAdminAudit({
      action: "SUBSCRIPTION_PLAN_CHANGED",
      adminUserId: user?.id,
      targetType: "saas_subscription",
      targetId: selectedSub.id,
      contractorId: selectedSub.contractor_id,
      metadata: {
        old_plan: oldPlan?.name,
        new_plan: newPlan?.name,
        nome_fantasia: selectedSub.contractors?.nome_fantasia,
      },
    });

    setActionLoading(false);
    setModalMode(null);
    setRefreshKey(k => k + 1);
  }

  async function handleTrialExtend() {
    if (!selectedSub || !modalDate) return;
    setActionLoading(true);
    setActionError(null);

    const newTrialEnd = new Date(modalDate + "T23:59:59Z").toISOString();
    const { error } = await supabase
      .from("saas_subscriptions")
      .update({
        trial_end: newTrialEnd,
        status: selectedSub.status === "expired" || selectedSub.status === "cancelled" ? "trialing" : selectedSub.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedSub.id);

    if (error) { setActionError(error.message); setActionLoading(false); return; }

    await insertSubEvent(
      selectedSub.id, selectedSub.contractor_id,
      "TRIAL_EXTENDED",
      { trial_end: selectedSub.trial_end },
      { trial_end: newTrialEnd },
    );
    await logAdminAudit({
      action: "TRIAL_EXTENDED",
      adminUserId: user?.id,
      targetType: "saas_subscription",
      targetId: selectedSub.id,
      contractorId: selectedSub.contractor_id,
      metadata: {
        old_trial_end: selectedSub.trial_end,
        new_trial_end: newTrialEnd,
        nome_fantasia: selectedSub.contractors?.nome_fantasia,
      },
    });

    setActionLoading(false);
    setModalMode(null);
    setRefreshKey(k => k + 1);
  }

  async function handleCancel(sub: SubscriptionRow) {
    if (!window.confirm(`Cancelar a assinatura de "${sub.contractors?.nome_fantasia}"? Esta ação pode ser revertida.`)) return;
    const { error } = await supabase
      .from("saas_subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", sub.id);
    if (error) { alert("Erro: " + error.message); return; }
    await insertSubEvent(sub.id, sub.contractor_id, "SUBSCRIPTION_CANCELLED",
      { status: sub.status }, { status: "cancelled" });
    await logAdminAudit({
      action: "SUBSCRIPTION_CANCELLED",
      adminUserId: user?.id,
      targetType: "saas_subscription",
      targetId: sub.id,
      contractorId: sub.contractor_id,
      metadata: { nome_fantasia: sub.contractors?.nome_fantasia },
    });
    setRefreshKey(k => k + 1);
  }

  async function handleReactivate(sub: SubscriptionRow) {
    if (!window.confirm(`Reativar a assinatura de "${sub.contractors?.nome_fantasia}"?`)) return;
    const { error } = await supabase
      .from("saas_subscriptions")
      .update({ status: "active", cancelled_at: null, updated_at: new Date().toISOString() })
      .eq("id", sub.id);
    if (error) { alert("Erro: " + error.message); return; }
    await insertSubEvent(sub.id, sub.contractor_id, "SUBSCRIPTION_REACTIVATED",
      { status: sub.status }, { status: "active" });
    await logAdminAudit({
      action: "SUBSCRIPTION_REACTIVATED",
      adminUserId: user?.id,
      targetType: "saas_subscription",
      targetId: sub.id,
      contractorId: sub.contractor_id,
      metadata: { nome_fantasia: sub.contractors?.nome_fantasia },
    });
    setRefreshKey(k => k + 1);
  }

  function handleLogout() {
    logout();
    navigate("/admin/login", { replace: true });
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    subscriptions.forEach(s => { counts[s.status] = (counts[s.status] ?? 0) + 1; });
    return counts;
  }, [subscriptions]);

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
              <div key={to} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 cursor-not-allowed" title="Em breve">
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
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4" />Sair
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 ml-56 p-8 min-h-screen">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-gray-900">Assinaturas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Gerencie o status comercial de cada empresa</p>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(["all", ...SUB_STATUS_OPTIONS] as const).map(s => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                statusFilter === s
                  ? "bg-primary text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
              }`}>
              {s === "all" ? `Todos (${subscriptions.length})` : `${SUB_STATUS_LABEL[s] ?? s} (${statusCounts[s] ?? 0})`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            className="w-full max-w-sm pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Buscar por empresa ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Layers className="w-10 h-10 text-gray-200" />
              <p className="text-sm text-gray-400">Nenhuma assinatura encontrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase tracking-wide">
                    <th className="text-left px-5 py-3">Empresa</th>
                    <th className="text-left px-4 py-3">Plano</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Trial até</th>
                    <th className="text-left px-4 py-3">Período</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(sub => (
                    <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => navigate(`/admin/companies/${sub.contractor_id}`)}
                          className="text-left">
                          <p className="font-medium text-gray-900 hover:text-primary transition-colors">
                            {sub.contractors?.nome_fantasia ?? "—"}
                          </p>
                          <p className="text-xs text-gray-400">{sub.contractors?.email ?? "—"}</p>
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                          {sub.saas_plans?.name ?? "—"}
                        </span>
                        {sub.saas_plans && sub.saas_plans.price_monthly > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            R$ {sub.saas_plans.price_monthly.toLocaleString("pt-BR")}/mês
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SUB_STATUS_STYLE[sub.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {SUB_STATUS_LABEL[sub.status] ?? sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500">
                        {sub.trial_end
                          ? new Date(sub.trial_end).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500">
                        {sub.current_period_start
                          ? new Date(sub.current_period_start).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openModal("plan", sub)}
                            className="text-xs font-medium text-gray-600 hover:text-primary hover:bg-primary/5 px-2.5 py-1.5 rounded-lg transition-colors"
                            title="Trocar plano">
                            <Package className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openModal("status", sub)}
                            className="text-xs font-medium text-gray-600 hover:text-primary hover:bg-primary/5 px-2.5 py-1.5 rounded-lg transition-colors"
                            title="Alterar status">
                            <RefreshCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openModal("trial", sub)}
                            className="text-xs font-medium text-gray-600 hover:text-primary hover:bg-primary/5 px-2.5 py-1.5 rounded-lg transition-colors"
                            title="Estender trial">
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                          {sub.status !== "cancelled" && sub.status !== "expired" ? (
                            <button
                              onClick={() => handleCancel(sub)}
                              className="text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
                              title="Cancelar">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(sub)}
                              className="text-xs font-medium text-green-600 hover:bg-green-50 px-2.5 py-1.5 rounded-lg transition-colors"
                              title="Reativar">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* MODAL */}
      {modalMode && selectedSub && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-base">
                {modalMode === "status" && "Alterar Status"}
                {modalMode === "plan" && "Trocar Plano"}
                {modalMode === "trial" && "Estender Trial"}
              </h2>
              <button onClick={() => setModalMode(null)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Empresa: <span className="font-semibold text-gray-900">{selectedSub.contractors?.nome_fantasia}</span>
              </p>

              {actionError && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{actionError}
                </div>
              )}

              {modalMode === "status" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Novo status</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={modalValue}
                    onChange={e => setModalValue(e.target.value)}>
                    {SUB_STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{SUB_STATUS_LABEL[s] ?? s}</option>
                    ))}
                  </select>
                </div>
              )}

              {modalMode === "plan" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Novo plano</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={modalValue}
                    onChange={e => setModalValue(e.target.value)}>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — R$ {p.price_monthly.toLocaleString("pt-BR")}/mês
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modalMode === "trial" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nova data de fim do trial</label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={modalDate}
                    onChange={e => setModalDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setModalMode(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={
                  modalMode === "status" ? handleStatusChange
                  : modalMode === "plan" ? handlePlanChange
                  : handleTrialExtend
                }
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
                {actionLoading ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
