import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  BarChart2, Building2, Package, CreditCard, FileText, Settings,
  LogOut, ShieldCheck, Dumbbell, Boxes, Layers,
  CheckCircle2, XCircle, Pencil, Plus, Trash2, Loader2,
  AlertCircle, ToggleLeft, ToggleRight, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAudit } from "@/lib/adminAudit";

/* ─── Tipos ──────────────────────────────────────────────────────── */
interface GlobalModule {
  id: string;
  slug: string;
  name: string;
  description: string;
  route: string | null;
  icon: string;
  status: "active" | "coming_soon" | "beta" | "deprecated";
  is_visible: boolean;
  sort_order: number;
  active_companies?: number;
}

interface SaasPlan {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface PlanFeature {
  id: string;
  plan_id: string;
  feature_key: string;
  enabled: boolean;
  limit_value: number | null;
}

interface ModuleFormData {
  name: string;
  slug: string;
  description: string;
  route: string;
  icon: string;
  status: "active" | "coming_soon" | "beta" | "deprecated";
  is_visible: boolean;
  sort_order: string;
}

const EMPTY_MOD_FORM: ModuleFormData = {
  name: "", slug: "", description: "", route: "", icon: "Box",
  status: "coming_soon", is_visible: true, sort_order: "0",
};

/* ─── Mapas visuais ──────────────────────────────────────────────── */
const STATUS_LABEL: Record<string, string> = {
  active: "Ativo", coming_soon: "Em breve", beta: "Beta", deprecated: "Descontinuado",
};
const STATUS_STYLE: Record<string, string> = {
  active:      "bg-green-50 text-green-700",
  coming_soon: "bg-gray-100 text-gray-500",
  beta:        "bg-blue-50 text-blue-700",
  deprecated:  "bg-red-50 text-red-400",
};
const MODULE_STATUS_OPTS: Array<{ value: string; label: string }> = [
  { value: "active",      label: "Ativo" },
  { value: "coming_soon", label: "Em breve" },
  { value: "beta",        label: "Beta" },
  { value: "deprecated",  label: "Descontinuado" },
];
const LUCIDE_ICONS = [
  "CreditCard","MessageSquare","Sparkles","Apple","ClipboardList",
  "Calendar","FileText","DollarSign","BarChart2","Building2",
  "Box","Boxes","Puzzle","LayoutGrid","Zap","Shield","Users","Settings",
];

/* ─── NavItems ───────────────────────────────────────────────────── */
const navItems = [
  { icon: BarChart2, label: "Dashboard",    to: "/admin/dashboard",      active: true },
  { icon: Building2, label: "Empresas",     to: "/admin/companies",      active: true },
  { icon: Package,   label: "Planos",       to: "/admin/plans",          active: true },
  { icon: Layers,    label: "Assinaturas",  to: "/admin/subscriptions",  active: true },
  { icon: Boxes,     label: "Módulos",      to: "/admin/modules",        active: true },
  { icon: CreditCard,label: "Financeiro",   to: "/admin/billing",        active: true  },
  { icon: FileText,  label: "Auditoria",    to: "/admin/audit",          active: false },
  { icon: Settings,  label: "Configurações",to: "/admin/settings",       active: false },
];

/* ══════════════════════════════════════════════════════════════════ */
export default function AdminModulesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"catalog" | "plan_features">("catalog");

  /* ── Catálogo ── */
  const [modules, setModules]     = useState<GlobalModule[]>([]);
  const [loadingMods, setLoadingMods] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refreshMods, setRefreshMods] = useState(0);

  /* ── Modal de edição de módulo ── */
  const [showModModal, setShowModModal] = useState(false);
  const [editingMod, setEditingMod] = useState<GlobalModule | null>(null);
  const [modForm, setModForm]       = useState<ModuleFormData>(EMPTY_MOD_FORM);
  const [modError, setModError]     = useState<string | null>(null);
  const [savingMod, setSavingMod]   = useState(false);

  /* ── Features por plano ── */
  const [plans, setPlans]           = useState<SaasPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [planFeatures, setPlanFeatures] = useState<PlanFeature[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [featureError, setFeatureError] = useState<string | null>(null);
  const [refreshFeatures, setRefreshFeatures] = useState(0);
  const [addingFeatureKey, setAddingFeatureKey] = useState<string>("");
  const [addingFeatureLimit, setAddingFeatureLimit] = useState<string>("");
  const [addingFeature, setAddingFeature] = useState(false);

  /* ── Carrega módulos globais ─────────────────────────────────── */
  useEffect(() => {
    let active = true;
    async function doLoad() {
      const { data: mods } = await supabase
        .from("modules")
        .select("id, slug, name, description, route, icon, status, is_visible, sort_order")
        .order("sort_order", { ascending: true });

      if (!active) return;

      const modsList: GlobalModule[] = (mods ?? []) as GlobalModule[];

      // Conta empresas com módulo ativo para cada módulo
      if (modsList.length > 0) {
        const { data: counts } = await supabase
          .from("company_modules")
          .select("module_id")
          .eq("status", "active");

        if (!active) return;
        const countMap: Record<string, number> = {};
        (counts ?? []).forEach(r => {
          countMap[r.module_id] = (countMap[r.module_id] ?? 0) + 1;
        });
        modsList.forEach(m => { m.active_companies = countMap[m.id] ?? 0; });
      }

      setModules(modsList);
      setLoadingMods(false);
    }
    doLoad();
    return () => { active = false; };
  }, [refreshMods]);

  /* ── Carrega planos ──────────────────────────────────────────── */
  useEffect(() => {
    let active = true;
    async function doLoad() {
      const { data } = await supabase
        .from("saas_plans")
        .select("id, name, slug, status")
        .order("sort_order", { ascending: true });
      if (!active) return;
      const planList = (data ?? []) as SaasPlan[];
      setPlans(planList);
      if (planList.length > 0) setSelectedPlanId(curr => curr || planList[0].id);
      setLoadingPlans(false);
    }
    doLoad();
    return () => { active = false; };
  }, []);

  /* ── Carrega features do plano selecionado ───────────────────── */
  useEffect(() => {
    if (!selectedPlanId) return;
    let active = true;
    async function doLoad() {
      setLoadingFeatures(true);
      const { data } = await supabase
        .from("saas_plan_features")
        .select("id, plan_id, feature_key, enabled, limit_value")
        .eq("plan_id", selectedPlanId)
        .order("feature_key", { ascending: true });
      if (!active) return;
      setPlanFeatures((data ?? []) as PlanFeature[]);
      setLoadingFeatures(false);
    }
    doLoad();
    return () => { active = false; };
  }, [selectedPlanId, refreshFeatures]);

  /* ── Toggle status do módulo global ─────────────────────────── */
  async function handleToggleModuleStatus(mod: GlobalModule) {
    const newStatus = mod.status === "active" ? "coming_soon" : "active";
    const actionKey = mod.status === "active" ? "MODULE_GLOBAL_DISABLED" : "MODULE_GLOBAL_ENABLED";
    if (!window.confirm(
      `${newStatus === "active" ? "Ativar" : "Desativar"} o módulo "${mod.name}"?\n` +
      `${newStatus !== "active" ? "Empresas com acesso via plano perderão acesso mesmo com feature habilitada." : ""}`
    )) return;

    setActionLoading(mod.id + "_status");
    const { error } = await supabase
      .from("modules")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", mod.id);

    if (!error) {
      await logAdminAudit({
        action: actionKey,
        adminUserId: user?.id,
        targetType: "module",
        targetId: mod.id,
        metadata: { slug: mod.slug, old_status: mod.status, new_status: newStatus },
      });
    }
    setActionLoading(null);
    setRefreshMods(k => k + 1);
  }

  /* ── Toggle visibilidade do módulo ──────────────────────────── */
  async function handleToggleVisible(mod: GlobalModule) {
    setActionLoading(mod.id + "_visible");
    await supabase
      .from("modules")
      .update({ is_visible: !mod.is_visible, updated_at: new Date().toISOString() })
      .eq("id", mod.id);
    setActionLoading(null);
    setRefreshMods(k => k + 1);
  }

  /* ── Abrir modal criar/editar módulo ─────────────────────────── */
  function openCreateMod() {
    setEditingMod(null);
    setModForm(EMPTY_MOD_FORM);
    setModError(null);
    setShowModModal(true);
  }

  function openEditMod(mod: GlobalModule) {
    setEditingMod(mod);
    setModForm({
      name: mod.name, slug: mod.slug, description: mod.description,
      route: mod.route ?? "", icon: mod.icon,
      status: mod.status, is_visible: mod.is_visible,
      sort_order: String(mod.sort_order),
    });
    setModError(null);
    setShowModModal(true);
  }

  async function handleSaveMod() {
    if (!modForm.name.trim() || !modForm.slug.trim()) {
      setModError("Nome e slug são obrigatórios.");
      return;
    }
    setSavingMod(true);
    setModError(null);

    const payload = {
      name: modForm.name.trim(),
      slug: modForm.slug.trim(),
      description: modForm.description.trim(),
      route: modForm.route.trim() || null,
      icon: modForm.icon.trim() || "Box",
      status: modForm.status,
      is_visible: modForm.is_visible,
      sort_order: parseInt(modForm.sort_order) || 0,
      updated_at: new Date().toISOString(),
    };

    if (editingMod) {
      const { error } = await supabase.from("modules").update(payload).eq("id", editingMod.id);
      if (error) { setModError(error.message); setSavingMod(false); return; }
      await logAdminAudit({
        action: "MODULE_UPDATED",
        adminUserId: user?.id,
        targetType: "module",
        targetId: editingMod.id,
        metadata: { slug: payload.slug },
      });
    } else {
      const { data, error } = await supabase.from("modules").insert(payload).select("id").single();
      if (error) { setModError(error.message); setSavingMod(false); return; }
      await logAdminAudit({
        action: "MODULE_CREATED",
        adminUserId: user?.id,
        targetType: "module",
        targetId: data?.id,
        metadata: { slug: payload.slug },
      });
    }

    setSavingMod(false);
    setShowModModal(false);
    setRefreshMods(k => k + 1);
  }

  /* ── Toggle feature por plano ────────────────────────────────── */
  async function handleToggleFeature(feat: PlanFeature) {
    setActionLoading(feat.id);
    const { error } = await supabase
      .from("saas_plan_features")
      .update({ enabled: !feat.enabled })
      .eq("id", feat.id);

    if (!error) {
      const plan = plans.find(p => p.id === feat.plan_id);
      await logAdminAudit({
        action: feat.enabled ? "PLAN_FEATURE_REMOVED" : "PLAN_FEATURE_ADDED",
        adminUserId: user?.id,
        targetType: "saas_plan",
        targetId: feat.plan_id,
        metadata: {
          feature_key: feat.feature_key,
          enabled: !feat.enabled,
          plan_slug: plan?.slug,
        },
      });
    }
    setActionLoading(null);
    setRefreshFeatures(k => k + 1);
  }

  /* ── Alterar limite de feature ───────────────────────────────── */
  async function handleUpdateLimit(feat: PlanFeature, newLimit: string) {
    const limitVal = newLimit === "" ? null : parseInt(newLimit);
    if (newLimit !== "" && isNaN(limitVal!)) return;
    setActionLoading(feat.id + "_limit");
    const { error } = await supabase
      .from("saas_plan_features")
      .update({ limit_value: limitVal })
      .eq("id", feat.id);

    if (!error) {
      const plan = plans.find(p => p.id === feat.plan_id);
      await logAdminAudit({
        action: "PLAN_FEATURE_LIMIT_CHANGED",
        adminUserId: user?.id,
        targetType: "saas_plan",
        targetId: feat.plan_id,
        metadata: {
          feature_key: feat.feature_key,
          old_limit: feat.limit_value,
          new_limit: limitVal,
          plan_slug: plan?.slug,
        },
      });
    }
    setActionLoading(null);
    setRefreshFeatures(k => k + 1);
  }

  /* ── Remover feature do plano ────────────────────────────────── */
  async function handleRemoveFeature(feat: PlanFeature) {
    const plan = plans.find(p => p.id === feat.plan_id);
    if (!window.confirm(`Remover a feature "${feat.feature_key}" do plano "${plan?.name}"?`)) return;
    setActionLoading(feat.id + "_remove");
    const { error } = await supabase.from("saas_plan_features").delete().eq("id", feat.id);
    if (!error) {
      await logAdminAudit({
        action: "PLAN_FEATURE_REMOVED",
        adminUserId: user?.id,
        targetType: "saas_plan",
        targetId: feat.plan_id,
        metadata: { feature_key: feat.feature_key, plan_slug: plan?.slug },
      });
    }
    setActionLoading(null);
    setRefreshFeatures(k => k + 1);
  }

  /* ── Adicionar feature ao plano ──────────────────────────────── */
  async function handleAddFeature() {
    if (!addingFeatureKey.trim() || !selectedPlanId) return;
    const limitVal = addingFeatureLimit === "" ? null : parseInt(addingFeatureLimit);
    if (addingFeatureLimit !== "" && isNaN(limitVal!)) {
      setFeatureError("Limite deve ser um número inteiro.");
      return;
    }
    setAddingFeature(true);
    setFeatureError(null);
    const { error } = await supabase
      .from("saas_plan_features")
      .upsert({
        plan_id:     selectedPlanId,
        feature_key: addingFeatureKey.trim(),
        enabled:     true,
        limit_value: limitVal,
      }, { onConflict: "plan_id,feature_key" });

    if (error) {
      setFeatureError(error.message);
    } else {
      const plan = plans.find(p => p.id === selectedPlanId);
      await logAdminAudit({
        action: "PLAN_FEATURE_ADDED",
        adminUserId: user?.id,
        targetType: "saas_plan",
        targetId: selectedPlanId,
        metadata: { feature_key: addingFeatureKey.trim(), plan_slug: plan?.slug },
      });
      setAddingFeatureKey("");
      setAddingFeatureLimit("");
    }
    setAddingFeature(false);
    setRefreshFeatures(k => k + 1);
  }

  /* ════════════════════════════════════════ RENDER ════════════════ */
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-56 bg-gray-900 flex flex-col flex-shrink-0">
        <div className="px-5 py-6 flex items-center gap-3 border-b border-gray-700">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Dumbbell className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">GoFit</p>
            <p className="text-gray-400 text-xs">Admin</p>
          </div>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-3">
          {navItems.map(item => (
            item.active ? (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isActive
                    ? "bg-primary text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-700"}`
                }
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </NavLink>
            ) : (
              <div key={item.to}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 cursor-not-allowed">
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </div>
            )
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{user?.email}</p>
              <p className="text-gray-400 text-xs">Owner</p>
            </div>
          </div>
          <button onClick={() => { logout(); navigate("/admin/login"); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <LogOut className="w-3.5 h-3.5" />Sair
          </button>
        </div>
      </aside>

      {/* ── Conteúdo ── */}
      <main className="flex-1 overflow-y-auto">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Módulos e Feature Flags</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Gerencie o catálogo global de módulos e as features por plano
              </p>
            </div>
            {activeTab === "catalog" && (
              <button onClick={openCreateMod}
                className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors">
                <Plus className="w-4 h-4" /> Novo Módulo
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4">
            {[
              { key: "catalog",       label: "Catálogo Global" },
              { key: "plan_features", label: "Features por Plano" },
            ].map(tab => (
              <button key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`text-sm font-semibold pb-3 border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-8 py-6">

          {/* ══ TAB: Catálogo Global ══ */}
          {activeTab === "catalog" && (
            <>
              {loadingMods ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
                        <th className="px-6 py-3 text-left">Módulo</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Visível</th>
                        <th className="px-4 py-3 text-left">Empresas ativas</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {modules.map(mod => (
                        <tr key={mod.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900">{mod.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{mod.slug}</p>
                            {mod.route && (
                              <p className="text-xs text-gray-300 font-mono mt-0.5">{mod.route}</p>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[mod.status] ?? "bg-gray-100 text-gray-500"}`}>
                              {STATUS_LABEL[mod.status] ?? mod.status}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => handleToggleVisible(mod)}
                              disabled={actionLoading === mod.id + "_visible"}
                              className="text-gray-400 hover:text-primary transition-colors"
                              title={mod.is_visible ? "Ocultar da loja" : "Mostrar na loja"}
                            >
                              {actionLoading === mod.id + "_visible"
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : mod.is_visible
                                  ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  : <XCircle className="w-4 h-4 text-gray-300" />
                              }
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm font-semibold text-gray-700">
                              {mod.active_companies ?? 0}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditMod(mod)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
                                title="Editar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleToggleModuleStatus(mod)}
                                disabled={!!actionLoading}
                                className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                                  mod.status === "active"
                                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                                    : "bg-green-50 text-green-600 hover:bg-green-100"
                                }`}
                              >
                                {actionLoading === mod.id + "_status"
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : mod.status === "active"
                                    ? <ToggleRight className="w-3.5 h-3.5" />
                                    : <ToggleLeft className="w-3.5 h-3.5" />
                                }
                                {mod.status === "active" ? "Desativar" : "Ativar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {modules.length === 0 && (
                    <div className="py-12 text-center">
                      <Boxes className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm text-gray-400">Nenhum módulo cadastrado.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ══ TAB: Features por Plano ══ */}
          {activeTab === "plan_features" && (
            <div className="space-y-6">

              {/* Seletor de plano */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Selecionar plano
                </label>
                {loadingPlans ? (
                  <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                ) : (
                  <div className="relative inline-block">
                    <select
                      value={selectedPlanId}
                      onChange={e => { setSelectedPlanId(e.target.value); setRefreshFeatures(k => k + 1); }}
                      className="appearance-none bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.slug})</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Features do plano selecionado */}
              {selectedPlanId && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">
                      Features — {plans.find(p => p.id === selectedPlanId)?.name}
                    </h3>
                    <p className="text-xs text-gray-400">
                      feature_key deve corresponder ao slug do módulo
                    </p>
                  </div>

                  {loadingFeatures ? (
                    <div className="py-12 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                    </div>
                  ) : (
                    <>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
                            <th className="px-6 py-3 text-left">Feature Key</th>
                            <th className="px-4 py-3 text-left">Módulo</th>
                            <th className="px-4 py-3 text-left">Habilitada</th>
                            <th className="px-4 py-3 text-left">Limite</th>
                            <th className="px-4 py-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {planFeatures.map(feat => {
                            const linkedMod = modules.find(m => m.slug === feat.feature_key);
                            return (
                              <tr key={feat.id} className="hover:bg-gray-50">
                                <td className="px-6 py-3 font-mono text-xs text-gray-700">
                                  {feat.feature_key}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-500">
                                  {linkedMod
                                    ? <span className="text-primary font-medium">{linkedMod.name}</span>
                                    : <span className="text-gray-300 italic">Não vinculado</span>
                                  }
                                </td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => handleToggleFeature(feat)}
                                    disabled={actionLoading === feat.id}
                                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                                      feat.enabled
                                        ? "bg-green-50 text-green-700 hover:bg-green-100"
                                        : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                    }`}
                                  >
                                    {actionLoading === feat.id
                                      ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : feat.enabled
                                        ? <CheckCircle2 className="w-3 h-3" />
                                        : <XCircle className="w-3 h-3" />
                                    }
                                    {feat.enabled ? "Sim" : "Não"}
                                  </button>
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    min={0}
                                    defaultValue={feat.limit_value ?? ""}
                                    placeholder="Ilimitado"
                                    onBlur={e => handleUpdateLimit(feat, e.target.value)}
                                    className="w-28 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                  />
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => handleRemoveFeature(feat)}
                                    disabled={actionLoading === feat.id + "_remove"}
                                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    title="Remover feature"
                                  >
                                    {actionLoading === feat.id + "_remove"
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <Trash2 className="w-3.5 h-3.5" />
                                    }
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {planFeatures.length === 0 && (
                        <div className="py-8 text-center">
                          <p className="text-sm text-gray-400">Nenhuma feature cadastrada para este plano.</p>
                        </div>
                      )}

                      {/* Adicionar feature */}
                      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-600 mb-3">Adicionar feature ao plano</p>
                        {featureError && (
                          <div className="flex items-center gap-2 text-xs text-red-600 mb-2">
                            <AlertCircle className="w-3.5 h-3.5" />{featureError}
                          </div>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="relative">
                            <select
                              value={addingFeatureKey}
                              onChange={e => setAddingFeatureKey(e.target.value)}
                              className="appearance-none bg-white border border-gray-200 text-gray-700 text-xs rounded-xl px-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-40"
                            >
                              <option value="">— Selecionar feature key —</option>
                              {modules
                                .filter(m => !planFeatures.some(f => f.feature_key === m.slug))
                                .map(m => (
                                  <option key={m.id} value={m.slug}>{m.name} ({m.slug})</option>
                                ))
                              }
                              <option value="_custom_">— Digitar chave customizada —</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                          </div>
                          {addingFeatureKey === "_custom_" && (
                            <input
                              type="text"
                              placeholder="feature_key"
                              className="bg-white border border-gray-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
                              onBlur={e => setAddingFeatureKey(e.target.value || "_custom_")}
                            />
                          )}
                          <input
                            type="number"
                            min={0}
                            value={addingFeatureLimit}
                            onChange={e => setAddingFeatureLimit(e.target.value)}
                            placeholder="Limite (vazio = ilimitado)"
                            className="bg-white border border-gray-200 text-xs rounded-xl px-3 py-2 w-44 focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <button
                            onClick={handleAddFeature}
                            disabled={!addingFeatureKey || addingFeatureKey === "_custom_" || addingFeature}
                            className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            {addingFeature ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            Adicionar
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Nota sobre precedência */}
              <div className="flex items-start gap-3 bg-blue-50 rounded-xl border border-blue-100 px-5 py-4">
                <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-blue-700 mb-1">Regras de precedência de acesso</p>
                  <ol className="text-xs text-blue-600 space-y-0.5 list-decimal list-inside">
                    <li>Módulo global inativo → sempre bloqueado (independente do plano)</li>
                    <li>Override manual ativo em company_modules → liberado</li>
                    <li>Override manual cancelado em company_modules → bloqueado</li>
                    <li>Feature habilitada no plano ativo → liberado via plano</li>
                    <li>Sem assinatura ativa → bloqueado</li>
                    <li>Feature ausente ou desabilitada no plano → bloqueado</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ══ Modal: Criar/Editar Módulo ══ */}
      {showModModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">
                {editingMod ? "Editar Módulo" : "Novo Módulo"}
              </h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              {modError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{modError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nome *</label>
                  <input type="text" value={modForm.name}
                    onChange={e => setModForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Slug *</label>
                  <input type="text" value={modForm.slug}
                    onChange={e => setModForm(f => ({ ...f, slug: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição</label>
                <textarea value={modForm.description}
                  onChange={e => setModForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Rota (URL)</label>
                  <input type="text" value={modForm.route} placeholder="/app/..."
                    onChange={e => setModForm(f => ({ ...f, route: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ícone (Lucide)</label>
                  <select value={modForm.icon}
                    onChange={e => setModForm(f => ({ ...f, icon: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                    {LUCIDE_ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                  <select value={modForm.status}
                    onChange={e => setModForm(f => ({ ...f, status: e.target.value as ModuleFormData["status"] }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                    {MODULE_STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ordem</label>
                  <input type="number" value={modForm.sort_order}
                    onChange={e => setModForm(f => ({ ...f, sort_order: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={modForm.is_visible}
                      onChange={e => setModForm(f => ({ ...f, is_visible: e.target.checked }))}
                      className="rounded" />
                    <span className="text-xs font-semibold text-gray-600">Visível na loja</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModModal(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSaveMod} disabled={savingMod}
                className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
                {savingMod ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
