import { useState, useEffect } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import {
  BarChart2, Building2, Users, Settings, LogOut, ShieldCheck,
  TrendingUp, AlertTriangle, CheckCircle2,
  Dumbbell, CreditCard, UserPlus, Clock, ChevronRight,
  Activity, DollarSign, FileText, Package, Layers, Boxes,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ContractorRow {
  id: string;
  nome_fantasia: string;
  email: string;
  plan: string;
  status: string;
  cidade: string | null;
  uf: string | null;
  trial_ends_at: string | null;
  created_at: string;
}

interface Stats {
  mrr: number;
  activeCompanies: number;
  newThisMonth: number;
  trialCompanies: number;
  totalStudents: number;
  avgTicket: number;
}

const PIE_COLORS = ["#7c3aed", "#a78bfa", "#c4b5fd", "#ede9fe"];

const STATUS_STYLE: Record<string, string> = {
  active:    "bg-green-50 text-green-700",
  trial:     "bg-yellow-50 text-yellow-700",
  inactive:  "bg-gray-100 text-gray-500",
  suspended: "bg-red-50 text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo", trial: "Trial", inactive: "Inativo", suspended: "Suspenso",
};

const PLAN_LABELS: Record<string, string> = {
  trial: "Trial", starter: "Starter",
  profissional: "Profissional", empresarial: "Empresarial",
};

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

function KpiCard({
  label, value, sub, icon: Icon, iconClass, trend, trendUp,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; iconClass: string;
  trend?: string; trendUp?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${trendUp ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            <TrendingUp className="w-3 h-3" />
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-primary mt-1 font-medium">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<Stats>({
    mrr: 0, activeCompanies: 0, newThisMonth: 0,
    trialCompanies: 0, totalStudents: 0, avgTicket: 0,
  });
  const [companies, setCompanies]       = useState<ContractorRow[]>([]);
  const [planDist, setPlanDist]         = useState<{ name: string; value: number }[]>([]);
  const [mrrHistory, setMrrHistory]     = useState<{ mes: string; mrr: number }[]>([]);
  const [signupsHistory, setSignupsHistory] = useState<{ mes: string; novos: number; churn: number }[]>([]);
  const [dataLoading, setDataLoading]   = useState(true);
  // AJ-3: mapa contractor_id → nome do plano via saas_subscriptions (fonte da verdade)
  const [subPlanMap, setSubPlanMap]     = useState<Record<string, string>>({});
  // AJ-4: trials expirando em 7 dias via saas_subscriptions.trial_end (fonte da verdade)
  const [expiringTrials, setExpiringTrials] = useState<{ id: string; nome_fantasia: string; trial_end: string }[]>([]);

  useEffect(() => {
    async function load() {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const [
        { data: contractorsData, error: cErr },
        { data: subsData },
        { data: eventsData },
      ] = await Promise.all([
        supabase
          .from("contractors")
          .select("id, nome_fantasia, email, plan, status, cidade, uf, trial_ends_at, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("saas_subscriptions")
          .select("id, contractor_id, status, plan_id, created_at, trial_end, saas_plans(name, slug, price_monthly)"),
        supabase
          .from("saas_subscription_events")
          .select("event_type, created_at")
          .in("event_type", ["SUBSCRIPTION_CREATED", "SUBSCRIPTION_CANCELLED"])
          .gte("created_at", sixMonthsAgo.toISOString()),
      ]);

      if (cErr || !contractorsData) { setDataLoading(false); return; }

      const now         = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const active       = contractorsData.filter(c => c.status === "active");
      const newMonth     = contractorsData.filter(c => new Date(c.created_at) >= startOfMonth);

      // MRR real: soma dos preços mensais das assinaturas ativas
      const activeSubs = (subsData ?? []).filter(s => s.status === "active");
      const trialSubs  = (subsData ?? []).filter(s => s.status === "trialing");
      const mrr = activeSubs.reduce((sum, s) => {
        const plan = s.saas_plans as { price_monthly: number } | null;
        return sum + (plan?.price_monthly ?? 0);
      }, 0);

      // Distribuição por plano (via assinaturas)
      const planCount: Record<string, number> = {};
      (subsData ?? []).forEach(s => {
        const planName = (s.saas_plans as { name: string } | null)?.name ?? "Sem plano";
        planCount[planName] = (planCount[planName] ?? 0) + 1;
      });
      const dist = Object.entries(planCount).map(([name, value]) => ({ name, value }));

      // Histórico dos últimos 6 meses
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        return {
          mes: d.toLocaleString("pt-BR", { month: "short" }).replace(".", ""),
          _month: d.getMonth(),
          _year: d.getFullYear(),
          mrr: 0,
          novos: 0,
          churn: 0,
        };
      });
      // Mês atual recebe MRR real
      months[5].mrr = mrr;
      // Outros meses: novos e churn dos eventos
      months.forEach(m => {
        m.novos = (eventsData ?? []).filter(e => {
          const d = new Date(e.created_at);
          return d.getMonth() === m._month && d.getFullYear() === m._year && e.event_type === "SUBSCRIPTION_CREATED";
        }).length;
        m.churn = (eventsData ?? []).filter(e => {
          const d = new Date(e.created_at);
          return d.getMonth() === m._month && d.getFullYear() === m._year && e.event_type === "SUBSCRIPTION_CANCELLED";
        }).length;
      });

      // AJ-3: mapa contractor_id → nome do plano (saas_subscriptions é fonte da verdade)
      const planMap: Record<string, string> = {};
      (subsData ?? []).forEach(s => {
        const planName = (s.saas_plans as { name: string } | null)?.name;
        if (planName) planMap[s.contractor_id] = planName;
      });

      // AJ-4: alertas de trial via saas_subscriptions.trial_end (fonte da verdade)
      const nowMs = Date.now();
      const sevenDays = 7 * 86400000;
      const contractorNameMap: Record<string, string> = {};
      contractorsData.forEach(c => { contractorNameMap[c.id] = c.nome_fantasia; });
      const expiring = (subsData ?? [])
        .filter(s => {
          if (s.status !== "trialing") return false;
          const te = (s as { trial_end?: string | null }).trial_end;
          if (!te) return false;
          const delta = new Date(te).getTime() - nowMs;
          return delta >= 0 && delta <= sevenDays;
        })
        .map(s => ({
          id: s.contractor_id,
          nome_fantasia: contractorNameMap[s.contractor_id] ?? s.contractor_id,
          trial_end: (s as { trial_end: string }).trial_end,
        }));

      setStats({
        mrr,
        activeCompanies: active.length,
        newThisMonth: newMonth.length,
        trialCompanies: trialSubs.length,
        totalStudents: active.length * 120,
        avgTicket: activeSubs.length ? mrr / activeSubs.length : 0,
      });
      setCompanies(contractorsData.slice(0, 8));
      setPlanDist(dist);
      setMrrHistory(months.map(({ mes, mrr: m }) => ({ mes, mrr: m })));
      setSignupsHistory(months.map(({ mes, novos, churn }) => ({ mes, novos, churn })));
      setSubPlanMap(planMap);
      setExpiringTrials(expiring);
      setDataLoading(false);
    }
    load();
  }, []);

  function handleLogout() {
    logout();
    navigate("/admin/login", { replace: true });
  }

  // Capturado uma vez no mount — useState lazy initializer não é considerado render pelo linter
  const [now] = useState(() => Date.now());

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

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
          {navItems.map(({ icon: Icon, label, to, active }) => (
            active ? (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </NavLink>
            ) : (
              <div
                key={to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 cursor-not-allowed"
                title="Em breve"
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
                <span className="ml-auto text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">
                  em breve
                </span>
              </div>
            )
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100 space-y-1">
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-gray-700 truncate">{user?.email}</p>
            <p className="text-xs text-gray-400">Super Admin</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 ml-56 p-8 min-h-screen">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Painel Administrativo</h1>
            <p className="text-sm text-gray-400 mt-0.5 capitalize">{today}</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-2">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-xs font-semibold text-gray-600">Sistema operacional</span>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            label="MRR (receita mensal recorrente)"
            value={`R$ ${stats.mrr.toLocaleString("pt-BR")}`}
            sub={`Ticket médio: R$ ${stats.avgTicket.toFixed(0)}`}
            icon={DollarSign}
            iconClass="bg-primary/10 text-primary"
          />
          <KpiCard
            label="Empresas ativas"
            value={String(stats.activeCompanies)}
            sub={`+${stats.newThisMonth} este mês`}
            icon={Building2}
            iconClass="bg-blue-50 text-blue-600"
            trend={stats.newThisMonth > 0 ? `+${stats.newThisMonth}` : undefined}
            trendUp
          />
          <KpiCard
            label="Em período de trial"
            value={String(stats.trialCompanies)}
            sub={expiringTrials.length > 0 ? `${expiringTrials.length} expiram em 7 dias` : "Sem expirar em breve"}
            icon={Clock}
            iconClass="bg-yellow-50 text-yellow-600"
          />
          <KpiCard
            label="Alunos gerenciados"
            value={stats.totalStudents.toLocaleString("pt-BR")}
            sub="estimativa via empresas ativas"
            icon={Users}
            iconClass="bg-green-50 text-green-600"
          />
        </div>

        {/* Gráficos */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-gray-900">Crescimento MRR</h2>
                <p className="text-xs text-gray-400">Últimos 6 meses — mês atual com dados reais</p>
              </div>
              {stats.mrr > 0 && (
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> R$ {stats.mrr.toLocaleString("pt-BR")}
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={mrrHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`R$ ${Number(v).toLocaleString("pt-BR")}`, "MRR"]} />
                <Line type="monotone" dataKey="mrr" stroke="#7c3aed" strokeWidth={2.5} dot={{ fill: "#7c3aed", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Distribuição por plano</h2>
            <p className="text-xs text-gray-400 mb-4">Assinaturas por tipo</p>
            {planDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={planDist} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                    {planDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-gray-600">{v}</span>} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center">
                <p className="text-sm text-gray-400">Aguardando empresas...</p>
              </div>
            )}
          </div>
        </div>

        {/* Novos vs Churn + Alertas */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Novos cadastros vs Churn</h2>
            <p className="text-xs text-gray-400 mb-5">Últimos 6 meses — via saas_subscription_events</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={signupsHistory} barSize={14} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-gray-600">{v === "novos" ? "Novos" : "Churn"}</span>} />
                <Bar dataKey="novos" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="churn" fill="#fca5a5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" /> Alertas
            </h2>
            {dataLoading ? (
              <p className="text-sm text-gray-400">Carregando...</p>
            ) : expiringTrials.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 gap-2">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
                <p className="text-sm text-gray-400 text-center">Nenhum alerta no momento</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {expiringTrials.map(e => {
                  const days = Math.ceil((new Date(e.trial_end).getTime() - now) / 86400000);
                  return (
                    <li key={e.id} className="flex items-start gap-2.5 p-3 bg-yellow-50 rounded-xl">
                      <Clock className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{e.nome_fantasia}</p>
                        <p className="text-xs text-yellow-700">Trial expira em {days} dia{days !== 1 ? "s" : ""}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Tabela de empresas */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-900">Empresas cadastradas</h2>
              <p className="text-xs text-gray-400 mt-0.5">Últimas {companies.length} — ordenadas por data de cadastro</p>
            </div>
            <button
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              onClick={() => navigate("/admin/companies")}
            >
              Ver todas <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {dataLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <UserPlus className="w-10 h-10 text-gray-200" />
              <p className="text-sm text-gray-400">Nenhuma empresa cadastrada ainda.</p>
              <a href="/cadastro" className="text-xs font-semibold text-primary hover:underline">
                Cadastrar primeira empresa →
              </a>
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
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {companies.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div>
                          <p className="font-medium text-gray-900">{c.nome_fantasia}</p>
                          <p className="text-xs text-gray-400">{c.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                          {/* AJ-3: usa saas_subscriptions como fonte principal; contractors.plan é fallback legado */}
                          {subPlanMap[c.id] ?? PLAN_LABELS[c.plan] ?? "Sem assinatura"}
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
                      <td className="px-4 py-3.5 text-gray-500 text-xs">
                        {c.trial_ends_at ? new Date(c.trial_ends_at).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => navigate(`/admin/companies/${c.id}`)}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
