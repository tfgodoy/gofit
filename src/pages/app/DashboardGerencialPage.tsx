import { useState, useEffect } from "react";
import {
  Users, UserPlus, TrendingUp, DollarSign,
  ArrowUpCircle, ArrowDownCircle, Loader2,
  Activity, AlertCircle, Target, Clock,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

/* ── helpers ──────────────────────────────────────────────────── */

const PT_MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function lastNMonths(n: number): { key: string; label: string }[] {
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    result.push({
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${PT_MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
    });
  }
  return result;
}

/* ── sub-components ───────────────────────────────────────────── */

function KpiCard({ label, value, sub, icon, iconBg, loading, valueClass = "text-gray-900" }: {
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">{children}</h2>;
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-36 gap-2">
      <Activity className="w-7 h-7 text-gray-200" />
      <p className="text-xs text-gray-400">{message}</p>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export default function DashboardGerencialPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  /* KPIs */
  const [ativos,        setAtivos]        = useState(0);
  const [novos,         setNovos]         = useState(0);
  const [bloqueados,    setBloqueados]    = useState(0);
  const [totalAlunos,   setTotalAlunos]   = useState(0);
  const [leadsAtivos,   setLeadsAtivos]   = useState(0);
  const [convertidos,   setConvertidos]   = useState(0);
  const [totalOpps,     setTotalOpps]     = useState(0);
  const [pendentes,     setPendentes]     = useState(0);
  const [entradas,      setEntradas]      = useState(0);
  const [saidas,        setSaidas]        = useState(0);
  const [aReceber,      setAReceber]      = useState(0);

  /* Charts */
  const [statusData,    setStatusData]    = useState<{ name: string; total: number; fill: string }[]>([]);
  const [funilData,     setFunilData]     = useState<{ name: string; total: number; fill: string }[]>([]);
  const [monthlyData,   setMonthlyData]   = useState<{ name: string; total: number }[]>([]);
  const [atvsStatusData, setAtvsStatusData] = useState<{ name: string; total: number; fill: string }[]>([]);

  /* Lists */
  const [recentOpps,    setRecentOpps]    = useState<any[]>([]);
  const [pendAtivs,     setPendAtivs]     = useState<any[]>([]);
  const [etapaCorMap,   setEtapaCorMap]   = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user?.contractorId) return;
    const cid = user.contractorId!;
    const ms  = monthStart();

    async function load() {
      /* ── 1. Etapas dinâmicas ── */
      const { data: funilRow } = await supabase
        .from("crm_funis").select("id")
        .eq("contractor_id", cid).eq("padrao", true).maybeSingle();

      let etapas: { nome: string; cor: string }[] = [];
      if (funilRow) {
        const { data: etps } = await supabase
          .from("crm_funil_etapas").select("nome, cor, ordem")
          .eq("funil_id", funilRow.id).order("ordem");
        etapas = (etps ?? []) as typeof etapas;
      }

      const corMap: Record<string, string> = {};
      for (const e of etapas) corMap[e.nome] = e.cor;
      setEtapaCorMap(corMap);

      const eMatr = etapas.find(e => e.nome.toLowerCase().includes("matr"))?.nome ?? "Matrícula";
      const ePerd = etapas.find(e => e.nome.toLowerCase().includes("perd"))?.nome ?? "Perdido";

      /* ── 2. Queries paralelas ── */
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      const [
        { data: studentsAll },
        { count: novosC },
        { data: oppsAll },
        { data: atvsAll },
        { data: pendAtvsData },
        { data: transData },
        { data: recData },
        { data: recentO },
        { data: recentStudents },
      ] = await Promise.all([
        supabase.from("students").select("status").eq("contractor_id", cid),
        supabase.from("students").select("id", { count: "exact", head: true })
          .eq("contractor_id", cid).gte("created_at", ms),
        supabase.from("opportunities").select("etapa, valor_estimado")
          .eq("contractor_id", cid),
        supabase.from("activities").select("status").eq("contractor_id", cid),
        supabase.from("activities")
          .select("tipo, descricao, data_atividade, responsavel_nome")
          .eq("contractor_id", cid).eq("status", "pendente")
          .order("data_atividade", { ascending: true }).limit(6),
        supabase.from("transactions").select("tipo, valor")
          .eq("contractor_id", cid).gte("data", ms.split("T")[0]),
        supabase.from("receivables").select("valor, status")
          .eq("contractor_id", cid).in("status", ["pendente", "atrasado"]),
        supabase.from("opportunities")
          .select("nome, etapa, origem, created_at, valor_estimado")
          .eq("contractor_id", cid)
          .order("created_at", { ascending: false }).limit(6),
        supabase.from("students").select("created_at")
          .eq("contractor_id", cid)
          .gte("created_at", sixMonthsAgo.toISOString()),
      ]);

      /* ── 3. KPIs de alunos ── */
      const stuArr = (studentsAll ?? []) as any[];
      const ativosN     = stuArr.filter(s => s.status === "ativo").length;
      const bloqueadosN = stuArr.filter(s => s.status === "bloqueado").length;
      setAtivos(ativosN);
      setBloqueados(bloqueadosN);
      setTotalAlunos(stuArr.length);
      setNovos(novosC ?? 0);

      /* ── 4. KPIs de oportunidades ── */
      const oppsArr = (oppsAll ?? []) as any[];
      const leadsN      = oppsArr.filter(o => o.etapa !== eMatr && o.etapa !== ePerd).length;
      const convN       = oppsArr.filter(o => o.etapa === eMatr).length;
      setLeadsAtivos(leadsN);
      setConvertidos(convN);
      setTotalOpps(oppsArr.length);

      /* ── 5. KPIs de atividades ── */
      const atvsArr = (atvsAll ?? []) as any[];
      setPendentes(atvsArr.filter(a => a.status === "pendente").length);

      /* ── 6. Financeiro ── */
      const txs = (transData ?? []) as any[];
      setEntradas(txs.filter(t => t.tipo === "entrada").reduce((s, t) => s + (t.valor ?? 0), 0));
      setSaidas(  txs.filter(t => t.tipo === "saida").reduce((s, t) => s + (t.valor ?? 0), 0));
      setAReceber((recData ?? []).reduce((s: number, r: any) => s + (r.valor ?? 0), 0));

      /* ── 7. Gráfico: alunos por status ── */
      const sCount: Record<string, number> = {};
      for (const s of stuArr) sCount[s.status] = (sCount[s.status] ?? 0) + 1;
      setStatusData([
        { name: "Ativo",      total: sCount["ativo"]      ?? 0, fill: "#22c55e" },
        { name: "Lead",       total: sCount["lead"]       ?? 0, fill: "#3b82f6" },
        { name: "Inativo",    total: sCount["inativo"]    ?? 0, fill: "#9ca3af" },
        { name: "Bloqueado",  total: sCount["bloqueado"]  ?? 0, fill: "#f59e0b" },
        { name: "Cancelado",  total: sCount["cancelado"]  ?? 0, fill: "#ef4444" },
      ]);

      /* ── 8. Gráfico: funil CRM dinâmico ── */
      const eCount: Record<string, number> = {};
      for (const o of oppsArr) eCount[o.etapa] = (eCount[o.etapa] ?? 0) + 1;
      setFunilData(etapas.map(e => ({ name: e.nome, total: eCount[e.nome] ?? 0, fill: e.cor })));

      /* ── 9. Gráfico: novos alunos por mês ── */
      const months = lastNMonths(6);
      const mCount: Record<string, number> = Object.fromEntries(months.map(m => [m.key, 0]));
      for (const s of (recentStudents ?? []) as any[]) {
        const d = new Date(s.created_at);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (k in mCount) mCount[k]++;
      }
      setMonthlyData(months.map(m => ({ name: m.label, total: mCount[m.key] })));

      /* ── 10. Gráfico: atividades por status ── */
      const aCount = { pendente: 0, realizado: 0, cancelado: 0 };
      for (const a of atvsArr) {
        if (a.status in aCount) aCount[a.status as keyof typeof aCount]++;
      }
      setAtvsStatusData([
        { name: "Pendentes",  total: aCount.pendente,  fill: "#f59e0b" },
        { name: "Realizadas", total: aCount.realizado, fill: "#22c55e" },
        { name: "Canceladas", total: aCount.cancelado, fill: "#9ca3af" },
      ]);

      setRecentOpps((recentO ?? []) as any[]);
      setPendAtivs((pendAtvsData ?? []) as any[]);
      setLoading(false);
    }

    load();
  }, [user]);

  const saldo      = entradas - saidas;
  const convRate   = totalOpps > 0 ? Math.round((convertidos / totalOpps) * 100) : 0;
  const bloqRate   = totalAlunos > 0 ? Math.round((bloqueados / totalAlunos) * 100) : 0;

  function fmtDataAtiv(iso: string) {
    const d = new Date(iso);
    const hoje = new Date();
    const diff = Math.ceil((d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `${Math.abs(diff)}d atrasado`;
    if (diff === 0) return "hoje";
    return `em ${diff}d`;
  }

  return (
    <AppLayout>
      <div className="bg-gray-50 min-h-screen">
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <h1 className="text-xl font-bold text-gray-900">Dashboard Gerencial</h1>
          <p className="text-sm text-gray-400 mt-0.5">Visão geral da academia — {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
        </div>

        <div className="px-8 py-6 space-y-6">

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard loading={loading} label="Clientes ativos"
              value={String(ativos)} sub={`de ${totalAlunos} total`}
              icon={<Users className="w-5 h-5 text-primary/70" />} iconBg="bg-primary/10" />

            <KpiCard loading={loading} label="Novos este mês"
              value={String(novos)} valueClass="text-green-700"
              icon={<UserPlus className="w-5 h-5 text-green-600" />} iconBg="bg-green-50" />

            <KpiCard loading={loading} label="Inadimplentes"
              value={String(bloqueados)} sub={bloqRate > 0 ? `${bloqRate}% da base` : undefined}
              valueClass={bloqueados > 0 ? "text-amber-600" : "text-gray-900"}
              icon={<AlertCircle className="w-5 h-5 text-amber-500" />} iconBg="bg-amber-50" />

            <KpiCard loading={loading} label="Leads no CRM"
              value={String(leadsAtivos)} sub={`${convRate}% conversão`}
              valueClass="text-orange-700"
              icon={<TrendingUp className="w-5 h-5 text-orange-500" />} iconBg="bg-orange-50" />

            <KpiCard loading={loading} label="Ativ. pendentes"
              value={String(pendentes)}
              valueClass={pendentes > 0 ? "text-red-600" : "text-gray-900"}
              icon={<Clock className="w-5 h-5 text-red-400" />} iconBg="bg-red-50" />

            <KpiCard loading={loading} label="Convertidos CRM"
              value={String(convertidos)} sub={`de ${totalOpps} oportunidades`}
              valueClass="text-green-700"
              icon={<Target className="w-5 h-5 text-green-600" />} iconBg="bg-green-50" />
          </div>

          {/* ── Financeiro ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`rounded-xl border px-5 py-4 flex items-center justify-between col-span-1 sm:col-span-1 ${
              entradas > 0 || saidas > 0 ? "bg-green-50 border-green-200" : "bg-white border-gray-100"
            }`}>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Entradas (mês)</p>
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-200 mt-1" />
                  : <p className="text-2xl font-extrabold text-green-700 mt-1">{fmtMoney(entradas)}</p>}
              </div>
              <ArrowUpCircle className="w-8 h-8 text-green-300" />
            </div>
            <div className="rounded-xl border px-5 py-4 flex items-center justify-between bg-white border-gray-100">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Saídas (mês)</p>
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-200 mt-1" />
                  : <p className="text-2xl font-extrabold text-red-600 mt-1">{fmtMoney(saidas)}</p>}
              </div>
              <ArrowDownCircle className="w-8 h-8 text-red-200" />
            </div>
            <div className={`rounded-xl border px-5 py-4 flex items-center justify-between ${
              aReceber > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-gray-100"
            }`}>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">A receber</p>
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-200 mt-1" />
                  : <p className={`text-2xl font-extrabold mt-1 ${aReceber > 0 ? "text-amber-600" : "text-gray-700"}`}>
                      {fmtMoney(aReceber)}
                    </p>}
                <p className="text-xs text-gray-400 mt-0.5">pendente + atrasado</p>
              </div>
              <DollarSign className="w-8 h-8 text-amber-300" />
            </div>
          </div>

          {!loading && (entradas > 0 || saidas > 0) && (
            <div className={`rounded-xl border px-6 py-4 flex items-center justify-between ${
              saldo >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
            }`}>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Saldo do mês</p>
                <p className={`text-2xl font-extrabold mt-0.5 ${saldo >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {fmtMoney(saldo)}
                </p>
              </div>
              <p className="text-sm text-gray-500 hidden sm:block">
                {fmtMoney(entradas)} entradas · {fmtMoney(saidas)} saídas
              </p>
            </div>
          )}

          {/* ── Gráficos 2x2 ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Novos alunos por mês */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionTitle>Novos alunos — últimos 6 meses</SectionTitle>
              {loading
                ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
                : monthlyData.every(d => d.total === 0)
                  ? <EmptyChart message="Nenhum aluno cadastrado nos últimos 6 meses" />
                  : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={monthlyData} margin={{ left: 0, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                          formatter={(v: unknown) => [String(v), "Novos alunos"] as [string, string]} />
                        <Bar dataKey="total" fill="hsl(270 60% 50%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
              }
            </div>

            {/* Alunos por status */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionTitle>Base de alunos por status</SectionTitle>
              {loading
                ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
                : statusData.every(d => d.total === 0)
                  ? <EmptyChart message="Nenhum aluno cadastrado ainda" />
                  : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={statusData} layout="vertical" margin={{ left: 8, right: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} width={68} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                          formatter={(v: unknown) => [String(v), "Alunos"] as [string, string]} />
                        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                          {statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )
              }
            </div>

            {/* Funil CRM dinâmico */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionTitle>Funil de oportunidades</SectionTitle>
              {loading
                ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
                : funilData.every(d => d.total === 0)
                  ? <EmptyChart message="Nenhuma oportunidade cadastrada ainda" />
                  : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={funilData} layout="vertical" margin={{ left: 8, right: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} width={80} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                          formatter={(v: unknown) => [String(v), "Oportunidades"] as [string, string]} />
                        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                          {funilData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )
              }
            </div>

            {/* Atividades por status */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionTitle>Atividades por status</SectionTitle>
              {loading
                ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
                : atvsStatusData.every(d => d.total === 0)
                  ? <EmptyChart message="Nenhuma atividade registrada" />
                  : (
                    <div className="space-y-4 pt-2">
                      {atvsStatusData.map(d => {
                        const total = atvsStatusData.reduce((s, x) => s + x.total, 0);
                        const pct   = total > 0 ? Math.round((d.total / total) * 100) : 0;
                        return (
                          <div key={d.name}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-medium text-gray-700">{d.name}</span>
                              <span className="text-sm font-bold text-gray-900">{d.total} <span className="text-xs font-normal text-gray-400">({pct}%)</span></span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: d.fill }} />
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-xs text-gray-400 pt-1">
                        {atvsStatusData.reduce((s, d) => s + d.total, 0)} atividades no total
                      </p>
                    </div>
                  )
              }
            </div>
          </div>

          {/* ── Listas ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Oportunidades recentes */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionTitle>Oportunidades recentes</SectionTitle>
              {loading
                ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
                : recentOpps.length === 0
                  ? <EmptyChart message="Nenhuma oportunidade cadastrada" />
                  : (
                    <div className="space-y-0.5">
                      {recentOpps.map((o: any, i: number) => (
                        <div key={o.id ?? i}
                          className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{o.nome}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(o.created_at).toLocaleDateString("pt-BR")}
                              {o.valor_estimado ? ` · ${fmtMoney(o.valor_estimado)}` : ""}
                            </p>
                          </div>
                          <span
                            className="text-[10px] font-bold px-2.5 py-0.5 rounded-full text-white flex-shrink-0 ml-3"
                            style={{ backgroundColor: etapaCorMap[o.etapa] ?? "#9ca3af" }}
                          >
                            {o.etapa}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
              }
            </div>

            {/* Atividades pendentes */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionTitle>
                Atividades pendentes {pendentes > 0 && <span className="normal-case font-normal text-gray-400 ml-1">({pendentes} total)</span>}
              </SectionTitle>
              {loading
                ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
                : pendAtivs.length === 0
                  ? <EmptyChart message="Nenhuma atividade pendente" />
                  : (
                    <div className="space-y-0.5">
                      {pendAtivs.map((a: any, i: number) => {
                        const prazo     = fmtDataAtiv(a.data_atividade);
                        const atrasado  = prazo.includes("atrasado");
                        return (
                          <div key={i}
                            className="flex items-start justify-between py-2.5 border-b border-gray-50 last:border-0 gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                  {a.tipo}
                                </span>
                                {a.responsavel_nome && (
                                  <span className="text-xs text-gray-400 truncate">{a.responsavel_nome}</span>
                                )}
                              </div>
                              {a.descricao && (
                                <p className="text-sm text-gray-600 truncate">{a.descricao}</p>
                              )}
                            </div>
                            <span className={`text-xs font-semibold flex-shrink-0 ${
                              atrasado ? "text-red-600" : "text-gray-500"
                            }`}>
                              {prazo}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )
              }
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
