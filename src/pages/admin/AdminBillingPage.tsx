import { useState, useEffect, useMemo } from "react";
import { useNavigate, NavLink, Link } from "react-router-dom";
import {
  BarChart2, Building2, Package, CreditCard, FileText, Settings,
  LogOut, ShieldCheck, Dumbbell, Layers, Boxes, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, XCircle, Users, KeyRound,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface InvoiceSummary {
  status: string;
  count: number;
  total: number;
}

interface RecentInvoice {
  id: string;
  contractor_id: string;
  amount: number;
  due_date: string;
  status: string;
  created_at: string;
  contractors: { nome_fantasia: string } | null;
  saas_plans: { name: string } | null;
}

const navItems = [
  { icon: BarChart2,  label: "Dashboard",    to: "/admin/dashboard",       active: true  },
  { icon: Building2,  label: "Empresas",     to: "/admin/companies",       active: true  },
  { icon: Package,    label: "Planos",       to: "/admin/plans",           active: true  },
  { icon: Layers,     label: "Assinaturas",  to: "/admin/subscriptions",   active: true  },
  { icon: Boxes,      label: "Módulos",      to: "/admin/modules",         active: true  },
  { icon: CreditCard, label: "Financeiro",   to: "/admin/billing",         active: true  },
  { icon: Users, label: "Usuários", to: "/admin/users", active: true },
  { icon: KeyRound, label: "Papéis", to: "/admin/roles", active: true },
  { icon: FileText,   label: "Auditoria",    to: "/admin/audit",           active: false },
  { icon: Settings,   label: "Configurações",to: "/admin/settings",        active: false },
];

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft:     "Rascunho",
  pending:   "Pendente",
  paid:      "Pago",
  overdue:   "Vencido",
  failed:    "Falhou",
  cancelled: "Cancelado",
  refunded:  "Estornado",
};

const INVOICE_STATUS_ICON: Record<string, React.ReactNode> = {
  paid:    <CheckCircle2 className="w-4 h-4 text-green-500" />,
  pending: <Clock        className="w-4 h-4 text-yellow-500" />,
  overdue: <AlertTriangle className="w-4 h-4 text-red-500" />,
  failed:  <XCircle      className="w-4 h-4 text-red-400" />,
};

function fmt(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

export default function AdminBillingPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [summaries, setSummaries]       = useState<InvoiceSummary[]>([]);
  const [recentInvoices, setRecent]     = useState<RecentInvoice[]>([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [sumRes, recentRes] = await Promise.all([
        supabase
          .from("saas_invoices")
          .select("status, amount"),
        supabase
          .from("saas_invoices")
          .select("id, contractor_id, amount, due_date, status, created_at, contractors(nome_fantasia), saas_plans(name)")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (sumRes.data) {
        const grouped: Record<string, InvoiceSummary> = {};
        for (const row of sumRes.data as { status: string; amount: number }[]) {
          if (!grouped[row.status]) grouped[row.status] = { status: row.status, count: 0, total: 0 };
          grouped[row.status].count++;
          grouped[row.status].total += Number(row.amount);
        }
        setSummaries(Object.values(grouped));
      }

      if (recentRes.data) {
        setRecent(recentRes.data as unknown as RecentInvoice[]);
      }

      setLoading(false);
    }
    void load();
  }, []);

  const mrr = useMemo(() => {
    const paid = summaries.find(s => s.status === "paid");
    return paid?.total ?? 0;
  }, [summaries]);

  const pendingTotal = useMemo(() => {
    const p = summaries.find(s => s.status === "pending");
    return p?.total ?? 0;
  }, [summaries]);

  const overdueTotal = useMemo(() => {
    const o = summaries.find(s => s.status === "overdue");
    return o?.total ?? 0;
  }, [summaries]);

  const overdueCount = useMemo(() => {
    const o = summaries.find(s => s.status === "overdue");
    return o?.count ?? 0;
  }, [summaries]);

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
          {navItems.map(item => (
            item.active ? (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? "bg-orange-500/20 text-orange-400" : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ) : (
              <div key={item.to} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 cursor-not-allowed">
                <item.icon className="w-4 h-4" />
                {item.label}
              </div>
            )
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-3 px-3 py-2 text-sm text-gray-400">
            <ShieldCheck className="w-4 h-4 text-orange-500" />
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-medium truncate">{user?.email}</div>
              <div className="text-xs text-gray-500">Platform Owner</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 w-full mt-1 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Financeiro SaaS</h1>
            <p className="text-gray-400 text-sm mt-1">Cobrança das academias pela assinatura GoFit</p>
          </div>

          {loading ? (
            <div className="text-gray-400 text-sm">Carregando...</div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Receita Recebida</span>
                  </div>
                  <div className="text-2xl font-bold text-green-400">{fmt(mrr)}</div>
                  <div className="text-xs text-gray-500 mt-1">faturas pagas</div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Receita Prevista</span>
                  </div>
                  <div className="text-2xl font-bold text-yellow-400">{fmt(pendingTotal)}</div>
                  <div className="text-xs text-gray-500 mt-1">faturas pendentes</div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Inadimplência</span>
                  </div>
                  <div className="text-2xl font-bold text-red-400">{fmt(overdueTotal)}</div>
                  <div className="text-xs text-gray-500 mt-1">{overdueCount} fatura{overdueCount !== 1 ? "s" : ""} vencida{overdueCount !== 1 ? "s" : ""}</div>
                </div>
              </div>

              {/* Resumo por status */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-white">Faturas por Status</h2>
                  <Link to="/admin/billing/invoices" className="text-xs text-orange-400 hover:underline">Ver todas</Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(["paid", "pending", "overdue", "draft", "cancelled", "failed"] as const).map(status => {
                    const s = summaries.find(x => x.status === status);
                    return (
                      <div key={status} className="bg-gray-800/60 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          {INVOICE_STATUS_ICON[status] ?? <CreditCard className="w-4 h-4 text-gray-400" />}
                          <span className="text-xs text-gray-400">{INVOICE_STATUS_LABEL[status]}</span>
                        </div>
                        <div className="text-lg font-bold text-white">{s?.count ?? 0}</div>
                        <div className="text-xs text-gray-500">{fmt(s?.total ?? 0)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Links rápidos */}
              {overdueCount > 0 && (
                <div className="bg-red-950/40 border border-red-800/40 rounded-xl p-4 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-red-300">{overdueCount} empresa{overdueCount !== 1 ? "s" : ""} inadimplente{overdueCount !== 1 ? "s" : ""}</div>
                      <div className="text-xs text-red-400/70">{fmt(overdueTotal)} em faturas vencidas</div>
                    </div>
                  </div>
                  <Link to="/admin/billing/overdue" className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                    Gerenciar
                  </Link>
                </div>
              )}

              {/* Faturas recentes */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                  <h2 className="text-sm font-semibold text-white">Faturas Recentes</h2>
                  <Link to="/admin/billing/invoices" className="text-xs text-orange-400 hover:underline">Ver todas</Link>
                </div>
                {recentInvoices.length === 0 ? (
                  <div className="px-5 py-8 text-center text-gray-500 text-sm">Nenhuma fatura criada.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-xs text-gray-500">
                        <th className="text-left px-5 py-3">Empresa</th>
                        <th className="text-left px-5 py-3">Vencimento</th>
                        <th className="text-right px-5 py-3">Valor</th>
                        <th className="text-left px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {recentInvoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-gray-800/40">
                          <td className="px-5 py-3">
                            <div className="text-white font-medium truncate max-w-[180px]">
                              {inv.contractors?.nome_fantasia ?? "—"}
                            </div>
                            <div className="text-xs text-gray-500">{inv.saas_plans?.name ?? "—"}</div>
                          </td>
                          <td className="px-5 py-3 text-gray-400">{fmtDate(inv.due_date)}</td>
                          <td className="px-5 py-3 text-right font-medium text-white">{fmt(inv.amount)}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              inv.status === "paid"      ? "bg-green-900/40 text-green-400"  :
                              inv.status === "pending"   ? "bg-yellow-900/40 text-yellow-400":
                              inv.status === "overdue"   ? "bg-red-900/40 text-red-400"     :
                              inv.status === "cancelled" ? "bg-gray-800 text-gray-500"       :
                              "bg-gray-800 text-gray-400"
                            }`}>
                              {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
