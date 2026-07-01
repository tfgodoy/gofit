import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import {
  BarChart2, Building2, Package, CreditCard, FileText, Settings,
  LogOut, ShieldCheck, Dumbbell, Layers, Boxes, Search, Plus,
  RefreshCcw, CheckCircle2, XCircle, AlertTriangle, Clock, ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAudit } from "@/lib/adminAudit";
import { toast } from "sonner";

interface Invoice {
  id: string;
  contractor_id: string;
  subscription_id: string;
  plan_id: string;
  amount: number;
  due_date: string;
  status: string;
  payment_method: string | null;
  asaas_payment_id: string | null;
  asaas_invoice_url: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  contractors: { id: string; nome_fantasia: string; email: string } | null;
  saas_plans: { name: string } | null;
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

const STATUS_OPTIONS = ["", "draft", "pending", "paid", "overdue", "failed", "cancelled", "refunded"];
const STATUS_LABEL: Record<string, string> = {
  "":        "Todos os status",
  draft:     "Rascunho",
  pending:   "Pendente",
  paid:      "Pago",
  overdue:   "Vencido",
  failed:    "Falhou",
  cancelled: "Cancelado",
  refunded:  "Estornado",
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

type ActionModal = { type: "asaas" | "paid_manual" | "cancel" | "overdue"; invoice: Invoice } | null;

export default function AdminBillingInvoicesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [invoices, setInvoices]     = useState<Invoice[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState("");
  const [actionModal, setAction]    = useState<ActionModal>(null);
  const [saving, setSaving]         = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("saas_invoices")
      .select("id, contractor_id, subscription_id, plan_id, amount, due_date, status, payment_method, asaas_payment_id, asaas_invoice_url, paid_at, cancelled_at, created_at, contractors(id, nome_fantasia, email), saas_plans(name)")
      .order("created_at", { ascending: false })
      .limit(200);

    setInvoices((data ?? []) as unknown as Invoice[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter(inv => {
      const matchSearch = !q || (inv.contractors?.nome_fantasia ?? "").toLowerCase().includes(q) || (inv.contractors?.email ?? "").toLowerCase().includes(q);
      const matchStatus = !statusFilter || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, search, statusFilter]);

  async function handleMarkPaid(invoice: Invoice) {
    if (!window.confirm(`Marcar fatura de ${invoice.contractors?.nome_fantasia} como paga manualmente?`)) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("saas_invoices").update({ status: "paid", paid_at: now, payment_method: "MANUAL", updated_at: now }).eq("id", invoice.id);
    if (!error) {
      await supabase.from("saas_billing_events").insert({
        invoice_id: invoice.id, subscription_id: invoice.subscription_id, contractor_id: invoice.contractor_id,
        event_type: "INVOICE_PAID_MANUAL", old_value: { status: invoice.status }, new_value: { status: "paid" },
        metadata: { method: "MANUAL" }, created_by: user?.id ?? null,
      });
      await logAdminAudit({ action: "INVOICE_PAID_MANUAL", adminUserId: user?.id, targetType: "invoice", targetId: invoice.id, contractorId: invoice.contractor_id });
      toast.success("Fatura marcada como paga.");
      void load();
    } else {
      toast.error("Erro ao atualizar fatura.");
    }
    setSaving(false);
    setAction(null);
  }

  async function handleMarkOverdue(invoice: Invoice) {
    if (!window.confirm(`Marcar fatura de ${invoice.contractors?.nome_fantasia} como vencida?`)) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("saas_invoices").update({ status: "overdue", updated_at: now }).eq("id", invoice.id);
    if (!error) {
      await supabase.from("saas_billing_events").insert({
        invoice_id: invoice.id, subscription_id: invoice.subscription_id, contractor_id: invoice.contractor_id,
        event_type: "INVOICE_OVERDUE", old_value: { status: invoice.status }, new_value: { status: "overdue" },
        created_by: user?.id ?? null,
      });
      await logAdminAudit({ action: "INVOICE_MARKED_OVERDUE", adminUserId: user?.id, targetType: "invoice", targetId: invoice.id, contractorId: invoice.contractor_id });
      toast.success("Fatura marcada como vencida.");
      void load();
    } else {
      toast.error("Erro ao atualizar fatura.");
    }
    setSaving(false);
    setAction(null);
  }

  async function handleCancel(invoice: Invoice) {
    if (!window.confirm(`Cancelar fatura de ${invoice.contractors?.nome_fantasia}?`)) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("saas_invoices").update({ status: "cancelled", cancelled_at: now, updated_at: now }).eq("id", invoice.id);
    if (!error) {
      await supabase.from("saas_billing_events").insert({
        invoice_id: invoice.id, subscription_id: invoice.subscription_id, contractor_id: invoice.contractor_id,
        event_type: "INVOICE_CANCELLED", old_value: { status: invoice.status }, new_value: { status: "cancelled" },
        created_by: user?.id ?? null,
      });
      await logAdminAudit({ action: "INVOICE_CANCELLED", adminUserId: user?.id, targetType: "invoice", targetId: invoice.id, contractorId: invoice.contractor_id });
      toast.success("Fatura cancelada.");
      void load();
    } else {
      toast.error("Erro ao cancelar fatura.");
    }
    setSaving(false);
    setAction(null);
  }

  async function handleCreateAsaas(invoice: Invoice, billingType: string) {
    setSaving(true);
    try {
      const session = await supabase.auth.getSession();
      const token   = session.data.session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-saas-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoice_id: invoice.id, billing_type: billingType }),
      });
      const json = await res.json() as { success: boolean; error?: string; data?: { asaas_payment_id?: string; asaas_invoice_url?: string } };
      if (json.success) {
        await logAdminAudit({ action: "SAAS_ASAAS_PAYMENT_REQUESTED", adminUserId: user?.id, targetType: "invoice", targetId: invoice.id, contractorId: invoice.contractor_id, metadata: { billing_type: billingType } });
        toast.success("Cobrança Asaas criada com sucesso.");
        void load();
      } else {
        toast.error(json.error ?? "Erro ao criar cobrança Asaas.");
      }
    } catch {
      toast.error("Erro de conexão com a Edge Function.");
    }
    setSaving(false);
    setAction(null);
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
        <div className="p-8 max-w-6xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Faturas SaaS</h1>
              <p className="text-gray-400 text-sm mt-1">Cobranças de assinatura por empresa</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar empresa..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatus(e.target.value)}
              className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500"
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <button onClick={() => void load()} className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Tabela */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-gray-500 text-sm">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">Nenhuma fatura encontrada.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500">
                    <th className="text-left px-5 py-3">Empresa</th>
                    <th className="text-left px-5 py-3">Plano</th>
                    <th className="text-left px-5 py-3">Vencimento</th>
                    <th className="text-right px-5 py-3">Valor</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-right px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filtered.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-800/40">
                      <td className="px-5 py-3">
                        <div className="text-white font-medium truncate max-w-[160px]">{inv.contractors?.nome_fantasia ?? "—"}</div>
                        <div className="text-xs text-gray-500">{inv.contractors?.email ?? ""}</div>
                      </td>
                      <td className="px-5 py-3 text-gray-400">{inv.saas_plans?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-gray-400">{fmtDate(inv.due_date)}</td>
                      <td className="px-5 py-3 text-right font-medium text-white">{fmt(inv.amount)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          inv.status === "paid"      ? "bg-green-900/40 text-green-400"   :
                          inv.status === "pending"   ? "bg-yellow-900/40 text-yellow-400" :
                          inv.status === "overdue"   ? "bg-red-900/40 text-red-400"      :
                          inv.status === "cancelled" ? "bg-gray-800 text-gray-500"        :
                          inv.status === "draft"     ? "bg-gray-800 text-gray-400"        :
                          "bg-gray-800 text-gray-400"
                        }`}>
                          {STATUS_LABEL[inv.status] ?? inv.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {inv.asaas_invoice_url && (
                            <a href={inv.asaas_invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-0.5">
                              <ExternalLink className="w-3 h-3" />Asaas
                            </a>
                          )}
                          {["draft","pending"].includes(inv.status) && !inv.asaas_payment_id && (
                            <button
                              onClick={() => setAction({ type: "asaas", invoice: inv })}
                              className="text-xs bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 px-2 py-1 rounded transition-colors"
                            >
                              Cobrar Asaas
                            </button>
                          )}
                          {["draft","pending","overdue"].includes(inv.status) && (
                            <button
                              onClick={() => handleMarkPaid(inv)}
                              disabled={saving}
                              className="text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 px-2 py-1 rounded transition-colors"
                            >
                              Pago Manual
                            </button>
                          )}
                          {["draft","pending"].includes(inv.status) && (
                            <button
                              onClick={() => handleMarkOverdue(inv)}
                              disabled={saving}
                              className="text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400 px-2 py-1 rounded transition-colors"
                            >
                              Vencer
                            </button>
                          )}
                          {!["paid","cancelled","refunded"].includes(inv.status) && (
                            <button
                              onClick={() => handleCancel(inv)}
                              disabled={saving}
                              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Modal Cobrar Asaas */}
      {actionModal?.type === "asaas" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-white mb-1">Criar Cobrança Asaas</h3>
            <p className="text-sm text-gray-400 mb-4">
              Empresa: <span className="text-white font-medium">{actionModal.invoice.contractors?.nome_fantasia}</span>
              <br />Valor: <span className="text-white font-medium">{fmt(actionModal.invoice.amount)}</span>
            </p>
            <div className="space-y-2">
              {(["PIX","BOLETO","CREDIT_CARD"] as const).map(bt => (
                <button
                  key={bt}
                  onClick={() => handleCreateAsaas(actionModal.invoice, bt)}
                  disabled={saving}
                  className="w-full py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white transition-colors disabled:opacity-50"
                >
                  {bt === "PIX" ? "Pix" : bt === "BOLETO" ? "Boleto" : "Cartão de Crédito"}
                </button>
              ))}
              <button onClick={() => setAction(null)} className="w-full py-2 rounded-lg text-sm text-gray-400 hover:text-white">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
