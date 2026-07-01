import { useState, useEffect, useMemo } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import {
  BarChart2, Building2, Package, CreditCard, FileText, Settings,
  LogOut, ShieldCheck, Dumbbell, Layers, Boxes, AlertTriangle,
  RefreshCcw, CheckCircle2, Ban, RotateCcw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAudit } from "@/lib/adminAudit";
import { toast } from "sonner";

interface OverdueInvoice {
  id: string;
  contractor_id: string;
  subscription_id: string;
  amount: number;
  due_date: string;
  status: string;
  asaas_payment_id: string | null;
  created_at: string;
  contractors: { id: string; nome_fantasia: string; email: string } | null;
  saas_plans: { name: string } | null;
  saas_subscriptions: { id: string; status: string } | null;
}

const navItems = [
  { icon: BarChart2,  label: "Dashboard",    to: "/admin/dashboard",       active: true  },
  { icon: Building2,  label: "Empresas",     to: "/admin/companies",       active: true  },
  { icon: Package,    label: "Planos",       to: "/admin/plans",           active: true  },
  { icon: Layers,     label: "Assinaturas",  to: "/admin/subscriptions",   active: true  },
  { icon: Boxes,      label: "Módulos",      to: "/admin/modules",         active: true  },
  { icon: CreditCard, label: "Financeiro",   to: "/admin/billing",         active: true  },
  { icon: FileText,   label: "Auditoria",    to: "/admin/audit",           active: false },
  { icon: Settings,   label: "Configurações",to: "/admin/settings",        active: false },
];

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}
function daysOverdue(due: string, now: number) {
  const diff = now - new Date(due + "T00:00:00").getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

export default function AdminBillingOverduePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<OverdueInvoice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [now]                   = useState(() => Date.now());
  const [refreshKey, setRefreshKey] = useState(0);

  function refresh() { setLoading(true); setRefreshKey(k => k + 1); }

  useEffect(() => {
    let active = true;
    async function doLoad() {
      const { data } = await supabase
        .from("saas_invoices")
        .select("id, contractor_id, subscription_id, amount, due_date, status, asaas_payment_id, created_at, contractors(id, nome_fantasia, email), saas_plans(name), saas_subscriptions(id, status)")
        .eq("status", "overdue")
        .order("due_date", { ascending: true });
      if (!active) return;
      setInvoices((data ?? []) as unknown as OverdueInvoice[]);
      setLoading(false);
    }
    doLoad();
    return () => { active = false; };
  }, [refreshKey]);

  const totalOverdue = useMemo(() => invoices.reduce((s, i) => s + Number(i.amount), 0), [invoices]);

  async function handleMarkPaid(invoice: OverdueInvoice) {
    if (!window.confirm(`Marcar fatura de ${invoice.contractors?.nome_fantasia} como paga manualmente?`)) return;
    setSaving(true);
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("saas_invoices").update({ status: "paid", paid_at: nowIso, payment_method: "MANUAL", updated_at: nowIso }).eq("id", invoice.id);
    if (!error) {
      // Registra pagamento manual em saas_payments (trilha financeira)
      await supabase.from("saas_payments").insert({
        invoice_id: invoice.id, contractor_id: invoice.contractor_id, subscription_id: invoice.subscription_id,
        amount: invoice.amount, payment_method: "MANUAL", status: "confirmed",
        paid_at: nowIso, metadata: { source: "admin_manual" }, created_by: user?.id ?? null,
      });
      // Reativa assinatura se estava bloqueada ou inadimplente
      const subStatus = invoice.saas_subscriptions?.status;
      if (subStatus === "blocked" || subStatus === "past_due") {
        await supabase.from("saas_subscriptions").update({ status: "active", updated_at: nowIso }).eq("id", invoice.subscription_id);
        await supabase.from("saas_subscription_events").insert({
          subscription_id: invoice.subscription_id, contractor_id: invoice.contractor_id,
          event_type: "SUBSCRIPTION_REACTIVATED_AFTER_PAYMENT",
          old_value: { status: subStatus }, new_value: { status: "active" },
          metadata: { source: "admin_manual_payment", invoice_id: invoice.id, contractor_id: invoice.contractor_id },
          created_by: user?.id ?? null,
        });
      }
      await supabase.from("saas_billing_events").insert({
        invoice_id: invoice.id, subscription_id: invoice.subscription_id, contractor_id: invoice.contractor_id,
        event_type: "INVOICE_PAID_MANUAL", old_value: { status: invoice.status }, new_value: { status: "paid" },
        metadata: { method: "MANUAL" }, created_by: user?.id ?? null,
      });
      await logAdminAudit({ action: "INVOICE_PAID_MANUAL", adminUserId: user?.id, targetType: "invoice", targetId: invoice.id, contractorId: invoice.contractor_id });
      toast.success("Fatura marcada como paga." + (subStatus === "blocked" || subStatus === "past_due" ? " Assinatura reativada." : ""));
      refresh();
    } else {
      toast.error("Erro ao atualizar fatura.");
    }
    setSaving(false);
  }

  async function handleBlockSubscription(invoice: OverdueInvoice) {
    if (!invoice.subscription_id) { toast.error("Fatura sem assinatura vinculada."); return; }
    if (!window.confirm(`Bloquear assinatura de ${invoice.contractors?.nome_fantasia}? A empresa perderá acesso ao sistema.`)) return;
    setSaving(true);
    const now = new Date().toISOString();
    const currentStatus = invoice.saas_subscriptions?.status ?? "past_due";
    const { error } = await supabase.from("saas_subscriptions").update({ status: "blocked", updated_at: now }).eq("id", invoice.subscription_id);
    if (!error) {
      await supabase.from("saas_subscription_events").insert({
        subscription_id: invoice.subscription_id, contractor_id: invoice.contractor_id,
        event_type: "SUBSCRIPTION_BLOCKED_FOR_NON_PAYMENT",
        old_value: { status: currentStatus }, new_value: { status: "blocked" },
        metadata: { invoice_id: invoice.id, days_overdue: daysOverdue(invoice.due_date, now) }, created_by: user?.id ?? null,
      });
      await logAdminAudit({ action: "SUBSCRIPTION_BLOCKED_NON_PAYMENT", adminUserId: user?.id, targetType: "subscription", targetId: invoice.subscription_id, contractorId: invoice.contractor_id, metadata: { invoice_id: invoice.id } });
      toast.success("Assinatura bloqueada.");
      refresh();
    } else {
      toast.error("Erro ao bloquear assinatura.");
    }
    setSaving(false);
  }

  async function handleReactivate(invoice: OverdueInvoice) {
    if (!invoice.subscription_id) { toast.error("Fatura sem assinatura vinculada."); return; }
    if (!window.confirm(`Reativar assinatura de ${invoice.contractors?.nome_fantasia} sem pagamento?`)) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("saas_subscriptions").update({ status: "active", updated_at: now }).eq("id", invoice.subscription_id);
    if (!error) {
      await supabase.from("saas_subscription_events").insert({
        subscription_id: invoice.subscription_id, contractor_id: invoice.contractor_id,
        event_type: "SUBSCRIPTION_REACTIVATED_AFTER_PAYMENT",
        old_value: { status: invoice.saas_subscriptions?.status ?? "blocked" }, new_value: { status: "active" },
        metadata: { source: "admin_manual", invoice_id: invoice.id }, created_by: user?.id ?? null,
      });
      await logAdminAudit({ action: "SUBSCRIPTION_REACTIVATED_AFTER_PAYMENT", adminUserId: user?.id, targetType: "subscription", targetId: invoice.subscription_id, contractorId: invoice.contractor_id });
      toast.success("Assinatura reativada.");
      refresh();
    } else {
      toast.error("Erro ao reativar assinatura.");
    }
    setSaving(false);
  }

  async function handleCreateAsaas(invoice: OverdueInvoice) {
    setSaving(true);
    try {
      const session = await supabase.auth.getSession();
      const token   = session.data.session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-saas-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoice_id: invoice.id, billing_type: "PIX" }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        await logAdminAudit({ action: "SAAS_ASAAS_PAYMENT_REQUESTED", adminUserId: user?.id, targetType: "invoice", targetId: invoice.id, contractorId: invoice.contractor_id });
        toast.success("Cobrança Asaas criada.");
        refresh();
      } else {
        toast.error(json.error ?? "Erro ao criar cobrança.");
      }
    } catch {
      toast.error("Erro de conexão.");
    }
    setSaving(false);
  }

  async function handleLogout() {
    await logout();
    navigate("/admin/login");
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Sidebar */}
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

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                Cobranças Vencidas
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                {invoices.length} fatura{invoices.length !== 1 ? "s" : ""} vencida{invoices.length !== 1 ? "s" : ""} — {fmt(totalOverdue)} em aberto
              </p>
            </div>
            <button onClick={refresh} className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="text-gray-400 text-sm">Carregando...</div>
          ) : invoices.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl py-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="text-white font-medium">Nenhuma cobrança vencida</p>
              <p className="text-gray-500 text-sm mt-1">Todas as faturas estão em dia.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map(inv => {
                const days = daysOverdue(inv.due_date, now);
                const isBlocked = inv.saas_subscriptions?.status === "blocked";
                return (
                  <div key={inv.id} className="bg-gray-900 border border-red-800/30 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-semibold">{inv.contractors?.nome_fantasia ?? "—"}</span>
                          {isBlocked && <span className="px-1.5 py-0.5 bg-red-900/50 text-red-400 text-xs rounded">Bloqueada</span>}
                          {inv.saas_subscriptions?.status === "past_due" && <span className="px-1.5 py-0.5 bg-orange-900/50 text-orange-400 text-xs rounded">Past Due</span>}
                        </div>
                        <div className="text-sm text-gray-400 mt-0.5">{inv.contractors?.email ?? ""}</div>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>Plano: <span className="text-gray-300">{inv.saas_plans?.name ?? "—"}</span></span>
                          <span>Venceu em: <span className="text-red-400">{fmtDate(inv.due_date)}</span></span>
                          <span className={`font-medium ${days > 15 ? "text-red-400" : days > 5 ? "text-orange-400" : "text-yellow-400"}`}>
                            {days} dia{days !== 1 ? "s" : ""} em atraso
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xl font-bold text-red-400">{fmt(inv.amount)}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-800">
                      {!inv.asaas_payment_id && (
                        <button
                          onClick={() => handleCreateAsaas(inv)}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          Cobrar via Asaas (Pix)
                        </button>
                      )}
                      <button
                        onClick={() => handleMarkPaid(inv)}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />Marcar Pago
                      </button>
                      {!isBlocked && (
                        <button
                          onClick={() => handleBlockSubscription(inv)}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          <Ban className="w-3.5 h-3.5" />Bloquear Acesso
                        </button>
                      )}
                      {isBlocked && (
                        <button
                          onClick={() => handleReactivate(inv)}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />Reativar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
