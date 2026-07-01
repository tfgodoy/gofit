import { useState, useEffect } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import {
  BarChart2, Building2, Package, CreditCard, FileText, Settings,
  LogOut, ShieldCheck, Dumbbell, Plus, Pencil, CheckCircle2,
  XCircle, Layers, AlertCircle, Boxes, Users, KeyRound,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAudit } from "@/lib/adminAudit";
import { computePlanPricing, fmtBRL } from "@/lib/saasPlanPricing";

interface SaasPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  status: "active" | "inactive" | "archived";
  min_students: number;
  max_students: number | null;
  max_staff: number | null;
  max_units: number;
  trial_days: number;
  sort_order: number;
  annual_discount_percent: number;
  contract_term_months: number;
  early_termination_fee_type: string;
  early_termination_fee_percent: number;
  early_termination_notes: string | null;
  created_at: string;
}

interface PlanFormData {
  name: string;
  slug: string;
  description: string;
  price_monthly: string;
  min_students: string;
  max_students: string;
  max_staff: string;
  max_units: string;
  trial_days: string;
  sort_order: string;
  status: "active" | "inactive";
  annual_discount_percent: string;
  contract_term_months: string;
  early_termination_fee_percent: string;
  early_termination_notes: string;
}

const EMPTY_FORM: PlanFormData = {
  name: "", slug: "", description: "",
  price_monthly: "0",
  min_students: "0", max_students: "", max_staff: "",
  max_units: "1", trial_days: "14", sort_order: "0",
  status: "active",
  annual_discount_percent: "10", contract_term_months: "12",
  early_termination_fee_percent: "20", early_termination_notes: "",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo", inactive: "Inativo", archived: "Arquivado",
};
const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-50 text-green-700",
  inactive: "bg-gray-100 text-gray-500",
  archived: "bg-red-50 text-red-600",
};

const navItems = [
  { icon: BarChart2, label: "Dashboard",    to: "/admin/dashboard",       active: true },
  { icon: Building2, label: "Empresas",     to: "/admin/companies",       active: true },
  { icon: Package,   label: "Planos",       to: "/admin/plans",           active: true },
  { icon: Layers,    label: "Assinaturas",  to: "/admin/subscriptions",   active: true },
  { icon: Boxes,     label: "Módulos",      to: "/admin/modules",         active: true },
  { icon: CreditCard,label: "Financeiro",   to: "/admin/billing",         active: true  },
  { icon: Users, label: "Usuários", to: "/admin/users", active: true },
  { icon: KeyRound, label: "Papéis", to: "/admin/roles", active: true },
  { icon: FileText,  label: "Auditoria",    to: "/admin/audit",           active: false },
  { icon: Settings,  label: "Configurações",to: "/admin/settings",        active: false },
];

function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function AdminPlansPage() {
  const { user, logout } = useAuth();
  const { hasAdminPermission } = useAdminPermissions();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SaasPlan | null>(null);
  const [form, setForm] = useState<PlanFormData>(EMPTY_FORM);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function doLoad() {
      const { data, error: e } = await supabase
        .from("saas_plans")
        .select("*")
        .order("sort_order", { ascending: true });
      if (!active) return;
      if (!e && data) setPlans(data as SaasPlan[]);
      setLoading(false);
    }
    doLoad();
    return () => { active = false; };
  }, [refreshKey]);

  function openCreate() {
    setEditingPlan(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  }

  function openEdit(plan: SaasPlan) {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description ?? "",
      price_monthly: String(plan.price_monthly),
      min_students: String(plan.min_students),
      max_students: plan.max_students != null ? String(plan.max_students) : "",
      max_staff: plan.max_staff != null ? String(plan.max_staff) : "",
      max_units: String(plan.max_units),
      trial_days: String(plan.trial_days),
      sort_order: String(plan.sort_order),
      status: plan.status === "archived" ? "inactive" : plan.status,
      annual_discount_percent: String(plan.annual_discount_percent),
      contract_term_months: String(plan.contract_term_months),
      early_termination_fee_percent: String(plan.early_termination_fee_percent),
      early_termination_notes: plan.early_termination_notes ?? "",
    });
    setError(null);
    setShowModal(true);
  }

  function handleNameChange(name: string) {
    setForm(f => ({
      ...f,
      name,
      slug: editingPlan ? f.slug : slugify(name),
    }));
  }

  async function handleSave() {
    if (!hasAdminPermission("plans.manage")) { setError("Você não tem permissão para gerenciar planos."); return; }
    if (!form.name.trim() || !form.slug.trim()) {
      setError("Nome e slug são obrigatórios.");
      return;
    }
    const minStudents = parseInt(form.min_students) || 0;
    const maxStudents = form.max_students ? parseInt(form.max_students) : null;
    if (maxStudents != null && maxStudents < minStudents) {
      setError("Máx. de alunos não pode ser menor que a faixa mínima.");
      return;
    }
    setSaving(true);
    setError(null);

    const priceMonthly = parseFloat(form.price_monthly) || 0;
    const annualDiscountPercent = parseFloat(form.annual_discount_percent) || 0;
    // price_yearly é apenas cache de compatibilidade — sempre recalculado
    // dinamicamente a partir de price_monthly + annual_discount_percent.
    const priceYearly = Math.round(priceMonthly * 12 * (1 - annualDiscountPercent / 100) * 100) / 100;

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
      price_monthly: priceMonthly,
      price_yearly: priceYearly,
      min_students: minStudents,
      max_students: maxStudents,
      max_staff: form.max_staff ? parseInt(form.max_staff) : null,
      max_units: parseInt(form.max_units) || 1,
      trial_days: parseInt(form.trial_days) || 14,
      sort_order: parseInt(form.sort_order) || 0,
      status: form.status,
      annual_discount_percent: annualDiscountPercent,
      contract_term_months: parseInt(form.contract_term_months) || 12,
      early_termination_fee_percent: parseFloat(form.early_termination_fee_percent) || 0,
      early_termination_notes: form.early_termination_notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (editingPlan) {
      const { error: e } = await supabase
        .from("saas_plans")
        .update(payload)
        .eq("id", editingPlan.id);
      if (e) { setError(e.message); setSaving(false); return; }
      await logAdminAudit({
        action: "PLAN_UPDATED",
        adminUserId: user?.id,
        targetType: "saas_plan",
        targetId: editingPlan.id,
        metadata: { name: payload.name, price_monthly: payload.price_monthly },
      });
    } else {
      const { data: created, error: e } = await supabase
        .from("saas_plans")
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select("id")
        .single();
      if (e || !created) { setError(e?.message ?? "Erro ao criar plano."); setSaving(false); return; }
      await logAdminAudit({
        action: "PLAN_CREATED",
        adminUserId: user?.id,
        targetType: "saas_plan",
        targetId: created.id,
        metadata: { name: payload.name, slug: payload.slug, price_monthly: payload.price_monthly },
      });
    }

    setSaving(false);
    setShowModal(false);
    setRefreshKey(k => k + 1);
  }

  async function toggleStatus(plan: SaasPlan) {
    if (!hasAdminPermission("plans.manage")) { alert("Você não tem permissão para gerenciar planos."); return; }
    const newStatus = plan.status === "active" ? "inactive" : "active";
    const label = newStatus === "active" ? "ativar" : "inativar";
    if (!window.confirm(`Deseja ${label} o plano "${plan.name}"?`)) return;

    const { error: e } = await supabase
      .from("saas_plans")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", plan.id);
    if (e) { alert("Erro: " + e.message); return; }

    await logAdminAudit({
      action: newStatus === "active" ? "PLAN_ACTIVATED" : "PLAN_DEACTIVATED",
      adminUserId: user?.id,
      targetType: "saas_plan",
      targetId: plan.id,
      metadata: { name: plan.name },
    });
    setRefreshKey(k => k + 1);
  }

  function handleLogout() {
    logout();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* SIDEBAR */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col fixed h-full z-10">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Dumbbell className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">
              Go<span className="text-primary">Fit</span>
            </span>
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Planos SaaS</h1>
            <p className="text-sm text-gray-400 mt-0.5">Gerencie os planos comerciais da plataforma GoFit</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Novo Plano
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Package className="w-12 h-12 text-gray-200" />
            <p className="text-gray-400 text-sm">Nenhum plano cadastrado ainda.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {plans.map(plan => (
              <div key={plan.id} className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[plan.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {STATUS_LABEL[plan.status] ?? plan.status}
                    </span>
                    <h2 className="text-lg font-bold text-gray-900 mt-2">{plan.name}</h2>
                    <p className="text-xs text-gray-400 font-mono">{plan.slug}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                </div>

                {plan.description && (
                  <p className="text-xs text-gray-500 leading-relaxed">{plan.description}</p>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-gray-900">
                      {plan.price_monthly === 0 ? "Grátis" : fmtBRL(plan.price_monthly)}
                    </span>
                    {plan.price_monthly > 0 && <span className="text-xs text-gray-400">/mês</span>}
                  </div>
                  {plan.price_monthly > 0 && plan.annual_discount_percent > 0 && (() => {
                    const pricing = computePlanPricing(plan);
                    return (
                      <p className="text-xs text-green-600 font-medium">
                        Anual: {fmtBRL(pricing.annualPriceWithDiscount)} ({plan.annual_discount_percent}% off) — equiv. {fmtBRL(pricing.annualMonthlyEquivalent)}/mês
                      </p>
                    );
                  })()}
                </div>

                <ul className="space-y-1 text-xs text-gray-600">
                  <li>🎯 Faixa: {plan.min_students} a {plan.max_students != null ? plan.max_students : "∞"} alunos</li>
                  <li>👥 Máx. alunos: {plan.max_students != null ? plan.max_students : "Ilimitado"}</li>
                  <li>🧑‍💼 Staff: {plan.max_staff != null ? plan.max_staff : "Ilimitado"}</li>
                  <li>🏢 Unidades: {plan.max_units}</li>
                  <li>⏱ Trial: {plan.trial_days} dias</li>
                  {plan.price_monthly > 0 && (
                    <li>📄 Contrato anual: {plan.contract_term_months} meses, multa {plan.early_termination_fee_percent}%</li>
                  )}
                </ul>

                <div className="flex gap-2 mt-auto pt-2 border-t border-gray-50">
                  <button onClick={() => openEdit(plan)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-primary hover:bg-primary/5 px-3 py-2 rounded-lg transition-colors">
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button onClick={() => toggleStatus(plan)}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
                      plan.status === "active"
                        ? "text-red-600 hover:bg-red-50"
                        : "text-green-600 hover:bg-green-50"
                    }`}>
                    {plan.status === "active"
                      ? <><XCircle className="w-3.5 h-3.5" /> Inativar</>
                      : <><CheckCircle2 className="w-3.5 h-3.5" /> Ativar</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL CREATE/EDIT */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingPlan ? "Editar Plano" : "Novo Plano"}
              </h2>
              <button onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nome *</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.name}
                    onChange={e => handleNameChange(e.target.value)}
                    placeholder="Ex: Profissional"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Slug *</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                    placeholder="profissional"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Descrição</label>
                  <textarea
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    rows={2}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descrição breve do plano"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Faixa mín. de alunos</label>
                  <input type="number" min="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.min_students}
                    onChange={e => setForm(f => ({ ...f, min_students: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Faixa máx. de alunos</label>
                  <input type="number" min="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.max_students}
                    onChange={e => setForm(f => ({ ...f, max_students: e.target.value }))}
                    placeholder="vazio = ilimitado"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Preço mensal (R$) *</label>
                  <input type="number" min="0" step="0.01"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.price_monthly}
                    onChange={e => setForm(f => ({ ...f, price_monthly: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Desconto anual (%)</label>
                  <input type="number" min="0" max="100" step="0.1"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.annual_discount_percent}
                    onChange={e => setForm(f => ({ ...f, annual_discount_percent: e.target.value }))}
                  />
                </div>

                {/* Preview do cálculo anual — nunca persistido, sempre derivado */}
                {parseFloat(form.price_monthly) > 0 && (
                  <div className="col-span-2 bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1">
                    {(() => {
                      const pricing = computePlanPricing({
                        price_monthly: parseFloat(form.price_monthly) || 0,
                        annual_discount_percent: parseFloat(form.annual_discount_percent) || 0,
                      });
                      return (
                        <>
                          <p>Anual bruto (sem desconto): <strong>{fmtBRL(pricing.annualPriceGross)}</strong></p>
                          <p>Anual com desconto: <strong className="text-green-600">{fmtBRL(pricing.annualPriceWithDiscount)}</strong></p>
                          <p>Equivalente mensal no anual: <strong>{fmtBRL(pricing.annualMonthlyEquivalent)}</strong></p>
                        </>
                      );
                    })()}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Máx. staff</label>
                  <input type="number" min="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.max_staff}
                    onChange={e => setForm(f => ({ ...f, max_staff: e.target.value }))}
                    placeholder="vazio = ilimitado"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Máx. unidades</label>
                  <input type="number" min="1"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.max_units}
                    onChange={e => setForm(f => ({ ...f, max_units: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Dias de trial</label>
                  <input type="number" min="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.trial_days}
                    onChange={e => setForm(f => ({ ...f, trial_days: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Ordem</label>
                  <input type="number" min="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as "active" | "inactive" }))}>
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Prazo contratual anual (meses)</label>
                  <input type="number" min="1"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.contract_term_months}
                    onChange={e => setForm(f => ({ ...f, contract_term_months: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Multa rescisória (%)</label>
                  <input type="number" min="0" max="100" step="0.1"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.early_termination_fee_percent}
                    onChange={e => setForm(f => ({ ...f, early_termination_fee_percent: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Observações de multa/rescisão</label>
                  <textarea
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    rows={2}
                    value={form.early_termination_notes}
                    onChange={e => setForm(f => ({ ...f, early_termination_notes: e.target.value }))}
                    placeholder="Ex: regra sujeita a validação jurídica antes de aplicação em produção"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
                {saving ? "Salvando..." : editingPlan ? "Salvar alterações" : "Criar plano"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
