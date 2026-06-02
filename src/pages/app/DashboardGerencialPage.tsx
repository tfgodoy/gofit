import { useState, useEffect } from "react";
import {
  Users, UserPlus, TrendingUp, DollarSign,
  ArrowUpCircle, ArrowDownCircle, Loader2,
  CheckSquare, Activity,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

/* ── helpers ──────────────────────────────────────────────────── */

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

/* ── KPI Card ─────────────────────────────────────────────────── */

function KpiCard({
  label, value, sub, icon, iconBg, loading, valueClass = "text-gray-900",
}: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; iconBg: string;
  loading: boolean; valueClass?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{label}</p>
      <div className="flex items-end justify-between">
        <div>
          {loading
            ? <Loader2 className="w-6 h-6 animate-spin text-gray-200 mb-1" />
            : <p className={`text-3xl font-extrabold leading-none ${valueClass}`}>{value}</p>
          }
          {sub && !loading && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

/* ── Section header ──────────────────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">{children}</h2>;
}

/* ── Empty chart placeholder ─────────────────────────────────── */

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2">
      <Activity className="w-8 h-8 text-gray-200" />
      <p className="text-xs text-gray-400">{message}</p>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────── */

export default function DashboardGerencialPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  /* KPI state */
  const [ativos,       setAtivos]       = useState(0);
  const [novos,        setNovos]        = useState(0);
  const [leadsAtivos,  setLeadsAtivos]  = useState(0);
  const [entradas,     setEntradas]     = useState(0);
  const [saidas,       setSaidas]       = useState(0);
  const [aReceber,     setAReceber]     = useState(0);

  /* Chart data */
  const [statusData,  setStatusData]  = useState<{ name: string; total: number; fill: string }[]>([]);
  const [funilData,   setFunilData]   = useState<{ name: string; total: number; fill: string }[]>([]);

  /* Lists */
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [recentOpps,       setRecentOpps]       = useState<any[]>([]);

  useEffect(() => {
    if (!user?.contractorId) return;
    const cid = user.contractorId!;
    const ms  = monthStart();

    async function load() {
      const [
        { count: ativosC },
        { count: novosC },
        { count: leadsC },
        { data: transData },
        { data: recData },
        { data: studentsData },
        { data: oppsData },
        { data: actsData },
        { data: oppsRecent },
      ] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true })
          .eq("contractor_id", cid).eq("status", "ativo"),
        supabase.from("students").select("id", { count: "exact", head: true })
          .eq("contractor_id", cid).gte("created_at", ms),
        supabase.from("opportunities").select("id", { count: "exact", head: true })
          .eq("contractor_id", cid).not("etapa", "in", "(matricula,perdido)"),
        supabase.from("transactions").select("tipo, valor")
          .eq("contractor_id", cid).gte("data", ms.split("T")[0]),
        supabase.from("receivables").select("valor, status")
          .eq("contractor_id", cid).in("status", ["pendente", "atrasado"]),
        supabase.from("students").select("status")
          .eq("contractor_id", cid),
        supabase.from("opportunities").select("etapa")
          .eq("contractor_id", cid),
        supabase.from("activities").select("tipo, status, data_atividade, descricao, responsavel_nome")
          .eq("contractor_id", cid).order("data_atividade", { ascending: false }).limit(5),
        supabase.from("opportunities").select("nome, etapa, origem, created_at")
          .eq("contractor_id", cid).order("created_at", { ascending: false }).limit(5),
      ]);

      /* KPIs */
      setAtivos(ativosC ?? 0);
      setNovos(novosC ?? 0);
      setLeadsAtivos(leadsC ?? 0);

      const txs = (transData ?? []) as any[];
      setEntradas(txs.filter(t => t.tipo === "entrada").reduce((s, t) => s + (t.valor ?? 0), 0));
      setSaidas(txs.filter(t => t.tipo === "saida").reduce((s, t) => s + (t.valor ?? 0), 0));
      setAReceber((recData ?? []).reduce((s: number, r: any) => s + (r.valor ?? 0), 0));

      /* Students by status */
      const statusCount: Record<string, number> = {};
      for (const s of (studentsData ?? []) as any[]) {
        statusCount[s.status] = (statusCount[s.status] ?? 0) + 1;
      }
      setStatusData([
        { name: "Ativo",     total: statusCount["ativo"]     ?? 0, fill: "#22c55e" },
        { name: "Lead",      total: statusCount["lead"]      ?? 0, fill: "#3b82f6" },
        { name: "Inativo",   total: statusCount["inativo"]   ?? 0, fill: "#9ca3af" },
        { name: "Cancelado", total: statusCount["cancelado"] ?? 0, fill: "#ef4444" },
      ]);

      /* Funil */
      const etapaCount: Record<string, number> = {};
      for (const o of (oppsData ?? []) as any[]) {
        etapaCount[o.etapa] = (etapaCount[o.etapa] ?? 0) + 1;
      }
      setFunilData([
        { name: "Lead",      total: etapaCount["Novo lead"]        ?? 0, fill: "#3b82f6" },
        { name: "Visita",    total: etapaCount["Visita agendada"]  ?? 0, fill: "#8b5cf6" },
        { name: "Proposta",  total: etapaCount["Proposta enviada"] ?? 0, fill: "#f97316" },
        { name: "Matrícula", total: etapaCount["Matrícula"]        ?? 0, fill: "#22c55e" },
        { name: "Perdido",   total: etapaCount["Perdido"]          ?? 0, fill: "#ef4444" },
      ]);

      setRecentActivities((actsData ?? []) as any[]);
      setRecentOpps((oppsRecent ?? []) as any[]);
      setLoading(false);
    }

    load();
  }, [user]);

  const saldo = entradas - saidas;

  const TIPO_LABEL: Record<string, string> = {
    ligacao: "Ligação", visita: "Visita", email: "E-mail",
    whatsapp: "WhatsApp", nota: "Nota", tarefa: "Tarefa",
  };
  const ETAPA_LABEL: Record<string, string> = {
    lead: "Lead", visita: "Visita", proposta: "Proposta",
    matricula: "Matrícula", perdido: "Perdido",
  };
  const ETAPA_COLOR: Record<string, string> = {
    lead: "text-blue-700 bg-blue-100", visita: "text-purple-700 bg-purple-100",
    proposta: "text-orange-700 bg-orange-100", matricula: "text-green-700 bg-green-100",
    perdido: "text-red-700 bg-red-100",
  };

  return (
    <AppLayout>
      <div className="bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <h1 className="text-xl font-bold text-gray-900">Dashboard Gerencial</h1>
          <p className="text-sm text-gray-400 mt-0.5">Visão geral da academia</p>
        </div>

        <div className="px-8 py-6 space-y-6">

          {/* KPIs row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard
              label="Clientes ativos"
              value={String(ativos)}
              icon={<Users className="w-5 h-5 text-primary/70" />}
              iconBg="bg-primary/10"
              loading={loading}
            />
            <KpiCard
              label="Novos este mês"
              value={String(novos)}
              icon={<UserPlus className="w-5 h-5 text-green-600" />}
              iconBg="bg-green-50"
              loading={loading}
              valueClass="text-green-700"
            />
            <KpiCard
              label="Leads ativos"
              value={String(leadsAtivos)}
              icon={<TrendingUp className="w-5 h-5 text-orange-500" />}
              iconBg="bg-orange-50"
              loading={loading}
              valueClass="text-orange-700"
            />
            <KpiCard
              label="Entradas (mês)"
              value={loading ? "—" : fmtMoney(entradas)}
              icon={<ArrowUpCircle className="w-5 h-5 text-green-600" />}
              iconBg="bg-green-50"
              loading={loading}
              valueClass="text-green-700"
            />
            <KpiCard
              label="Saídas (mês)"
              value={loading ? "—" : fmtMoney(saidas)}
              icon={<ArrowDownCircle className="w-5 h-5 text-red-500" />}
              iconBg="bg-red-50"
              loading={loading}
              valueClass="text-red-600"
            />
            <KpiCard
              label="A receber"
              value={loading ? "—" : fmtMoney(aReceber)}
              sub="Pendente + atrasado"
              icon={<DollarSign className="w-5 h-5 text-yellow-600" />}
              iconBg="bg-yellow-50"
              loading={loading}
              valueClass={aReceber > 0 ? "text-yellow-700" : "text-gray-700"}
            />
          </div>

          {/* Saldo do mês highlight */}
          {!loading && (entradas > 0 || saidas > 0) && (
            <div className={`rounded-xl border px-6 py-4 flex items-center justify-between ${
              saldo >= 0
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Saldo do mês</p>
                <p className={`text-2xl font-extrabold mt-0.5 ${saldo >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {fmtMoney(saldo)}
                </p>
              </div>
              <p className="text-xs text-gray-500">
                {fmtMoney(entradas)} entradas · {fmtMoney(saidas)} saídas
              </p>
            </div>
          )}

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Clientes por status */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionTitle>Clientes por status</SectionTitle>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-200" />
                </div>
              ) : statusData.every(d => d.total === 0) ? (
                <EmptyChart message="Nenhum cliente cadastrado ainda" />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={statusData} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} width={68} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                      formatter={(v: unknown) => [String(v), "Clientes"] as [string, string]}
                    />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Funil CRM */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionTitle>Funil de oportunidades</SectionTitle>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-200" />
                </div>
              ) : funilData.every(d => d.total === 0) ? (
                <EmptyChart message="Nenhuma oportunidade cadastrada ainda" />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={funilData} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} width={68} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                      formatter={(v: unknown) => [String(v), "Oportunidades"] as [string, string]}
                    />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {funilData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Lists row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Oportunidades recentes */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionTitle>Oportunidades recentes</SectionTitle>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-200" />
                </div>
              ) : recentOpps.length === 0 ? (
                <EmptyChart message="Nenhuma oportunidade cadastrada ainda" />
              ) : (
                <div className="space-y-2">
                  {recentOpps.map((o: any) => (
                    <div key={o.id ?? o.nome + o.created_at} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{o.nome}</p>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0 ml-3 ${ETAPA_COLOR[o.etapa] ?? "bg-gray-100 text-gray-600"}`}>
                        {ETAPA_LABEL[o.etapa] ?? o.etapa}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Atividades recentes */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionTitle>Atividades recentes</SectionTitle>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-200" />
                </div>
              ) : recentActivities.length === 0 ? (
                <EmptyChart message="Nenhuma atividade registrada ainda" />
              ) : (
                <div className="space-y-2">
                  {recentActivities.map((a: any, i: number) => (
                    <div key={a.id ?? i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <CheckSquare className="w-3.5 h-3.5 text-primary/50" />
                        <span className="text-xs font-semibold text-gray-500">
                          {TIPO_LABEL[a.tipo] ?? a.tipo}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate flex-1">
                        {a.descricao ?? "—"}
                      </p>
                      {a.responsavel_nome && (
                        <span className="text-xs text-gray-400 flex-shrink-0">{a.responsavel_nome}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
