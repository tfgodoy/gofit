import { useState, useEffect } from "react";
import {
  Loader2, Activity, TrendingUp, CheckSquare,
  UserPlus, Target, XCircle, Clock,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

/* ── helpers ──────────────────────────────────────────────── */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ── sub-components ───────────────────────────────────────── */

function KpiCard({ label, value, sub, icon, color = "text-gray-900", loading }: {
  label: string; value: string; sub?: string; icon: React.ReactNode;
  color?: string; loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
        {loading
          ? <Loader2 className="w-5 h-5 animate-spin text-gray-200" />
          : <>
              <p className={`text-2xl font-extrabold leading-none ${color}`}>{value}</p>
              {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
            </>
        }
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">{children}</h2>;
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 gap-2">
      <Activity className="w-6 h-6 text-gray-200" />
      <p className="text-xs text-gray-400">{msg}</p>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */

export default function DashboardCRMPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  /* KPIs */
  const [totalOpps,    setTotalOpps]    = useState(0);
  const [ativas,       setAtivas]       = useState(0);
  const [convertidos,  setConvertidos]  = useState(0);
  const [perdidos,     setPerdidos]     = useState(0);
  const [pendentes,    setPendentes]    = useState(0);
  const [realizadas,   setRealizadas]   = useState(0);
  const [valorAberto,  setValorAberto]  = useState(0);

  /* Charts */
  const [funilData,  setFunilData]  = useState<{ name: string; total: number; fill: string }[]>([]);
  const [origemData, setOrigemData] = useState<{ name: string; total: number }[]>([]);
  const [tipoData,   setTipoData]   = useState<{ name: string; total: number }[]>([]);

  /* Tables */
  const [recentOpps,   setRecentOpps]   = useState<any[]>([]);
  const [nivelData,    setNivelData]    = useState<{ nome: string; cor: string | null; count: number }[]>([]);
  const [recentAtivs,  setRecentAtivs]  = useState<any[]>([]);

  /* etapa → cor map (para badges dinâmicos) */
  const [etapaCorMap, setEtapaCorMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user?.contractorId) return;
    const cid = user.contractorId!;

    async function load() {
      /* 1 — etapas dinâmicas do funil padrão */
      const { data: funilRow } = await supabase
        .from("crm_funis").select("id")
        .eq("contractor_id", cid).eq("padrao", true).maybeSingle();

      let etapas: { id: string; nome: string; cor: string; ordem: number }[] = [];
      if (funilRow) {
        const { data: etps } = await supabase
          .from("crm_funil_etapas").select("id, nome, cor, ordem")
          .eq("funil_id", funilRow.id).order("ordem");
        etapas = (etps ?? []) as typeof etapas;
      }

      const corMap: Record<string, string> = {};
      for (const e of etapas) corMap[e.nome] = e.cor;
      setEtapaCorMap(corMap);

      const eMatr  = etapas.find(e => e.nome.toLowerCase().includes("matr"))?.nome  ?? "Matrícula";
      const ePerd  = etapas.find(e => e.nome.toLowerCase().includes("perd"))?.nome  ?? "Perdido";

      /* 2 — queries paralelas */
      const [
        { data: opps },
        { data: recentO },
        { data: atvsAll },
        { data: recentA },
        { data: niveisConfig },
      ] = await Promise.all([
        supabase.from("opportunities")
          .select("etapa, origem, valor_estimado, nivel_interesse")
          .eq("contractor_id", cid),
        supabase.from("opportunities")
          .select("nome, etapa, origem, created_at, valor_estimado")
          .eq("contractor_id", cid)
          .order("created_at", { ascending: false }).limit(8),
        supabase.from("activities")
          .select("tipo, status").eq("contractor_id", cid),
        supabase.from("activities")
          .select("tipo, descricao, status, data_atividade")
          .eq("contractor_id", cid)
          .order("data_atividade", { ascending: false }).limit(5),
        supabase.from("crm_config")
          .select("nome, cor")
          .eq("contractor_id", cid)
          .eq("categoria", "nivel_interesse_oportunidade")
          .eq("ativo", true)
          .order("ordem"),
      ]);

      /* 3 — KPIs de oportunidades */
      const oppsArr = (opps ?? []) as any[];
      const oppsAtivas = oppsArr.filter(o => o.etapa !== eMatr && o.etapa !== ePerd);
      setTotalOpps(oppsArr.length);
      setAtivas(oppsAtivas.length);
      setConvertidos(oppsArr.filter(o => o.etapa === eMatr).length);
      setPerdidos(oppsArr.filter(o => o.etapa === ePerd).length);
      setValorAberto(
        oppsAtivas.reduce((s: number, o: any) => s + (o.valor_estimado ?? 0), 0)
      );

      /* 4 — KPIs de atividades */
      const atvsArr = (atvsAll ?? []) as any[];
      setPendentes(atvsArr.filter(a => a.status === "pendente").length);
      setRealizadas(atvsArr.filter(a => a.status === "realizado").length);

      /* 5 — Funil chart (usa etapas dinâmicas) */
      const etapaCount: Record<string, number> = {};
      for (const o of oppsArr) etapaCount[o.etapa] = (etapaCount[o.etapa] ?? 0) + 1;
      setFunilData(etapas.map(e => ({ name: e.nome, total: etapaCount[e.nome] ?? 0, fill: e.cor })));

      /* 6 — Origem chart */
      const origCount: Record<string, number> = {};
      for (const o of oppsArr) if (o.origem) origCount[o.origem] = (origCount[o.origem] ?? 0) + 1;
      setOrigemData(
        Object.entries(origCount)
          .map(([k, v]) => ({ name: k, total: v as number }))
          .sort((a, b) => b.total - a.total).slice(0, 7)
      );

      /* 7 — Tipos de atividade chart */
      const tipoCount: Record<string, number> = {};
      for (const a of atvsArr) if (a.tipo) tipoCount[a.tipo] = (tipoCount[a.tipo] ?? 0) + 1;
      setTipoData(
        Object.entries(tipoCount)
          .map(([k, v]) => ({ name: k, total: v as number }))
          .sort((a, b) => b.total - a.total).slice(0, 8)
      );

      /* 8 — Nível de interesse (usa crm_config p/ ordenação + cor) */
      const nivelCount: Record<string, number> = {};
      for (const o of oppsArr) if (o.nivel_interesse) {
        nivelCount[o.nivel_interesse] = (nivelCount[o.nivel_interesse] ?? 0) + 1;
      }
      const niveisConf = (niveisConfig ?? []) as { nome: string; cor: string | null }[];
      const nivelOrdenado = niveisConf.map(n => ({
        nome: n.nome, cor: n.cor, count: nivelCount[n.nome] ?? 0,
      }));
      // adiciona quaisquer nomes que estejam no banco mas não na config
      for (const [nome, count] of Object.entries(nivelCount)) {
        if (!nivelOrdenado.find(n => n.nome === nome)) {
          nivelOrdenado.push({ nome, cor: null, count });
        }
      }
      setNivelData(nivelOrdenado);

      setRecentOpps((recentO ?? []) as any[]);
      setRecentAtivs((recentA ?? []) as any[]);
      setLoading(false);
    }

    load();
  }, [user]);

  const convRate = totalOpps > 0 ? Math.round((convertidos / totalOpps) * 100) : 0;
  const perdRate = totalOpps > 0 ? Math.round((perdidos  / totalOpps) * 100) : 0;

  return (
    <AppLayout>
      <div className="bg-gray-50 min-h-screen">
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <h1 className="text-xl font-bold text-gray-900">Dashboard CRM</h1>
          <p className="text-sm text-gray-400 mt-0.5">Funil de vendas e oportunidades</p>
        </div>

        <div className="px-8 py-6 space-y-6">

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard loading={loading} label="Total de leads"    value={String(totalOpps)}
              icon={<UserPlus className="w-5 h-5 text-blue-500" />} />
            <KpiCard loading={loading} label="Ativos no funil"   value={String(ativas)}
              color="text-purple-700"
              sub={valorAberto > 0 ? fmtMoney(valorAberto) : undefined}
              icon={<TrendingUp className="w-5 h-5 text-purple-500" />} />
            <KpiCard loading={loading} label="Convertidos"       value={String(convertidos)}
              color="text-green-700" sub={`${convRate}% de conversão`}
              icon={<Target className="w-5 h-5 text-green-500" />} />
            <KpiCard loading={loading} label="Perdidos"          value={String(perdidos)}
              color="text-red-600"   sub={`${perdRate}% das oportunidades`}
              icon={<XCircle className="w-5 h-5 text-red-400" />} />
            <KpiCard loading={loading} label="Ativ. pendentes"   value={String(pendentes)}
              color="text-orange-600"
              icon={<Clock className="w-5 h-5 text-orange-400" />} />
            <KpiCard loading={loading} label="Ativ. realizadas"  value={String(realizadas)}
              icon={<CheckSquare className="w-5 h-5 text-gray-400" />} />
          </div>

          {/* ── Funil + Origem ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionTitle>Funil por etapa</SectionTitle>
              {loading
                ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
                : funilData.every(d => d.total === 0)
                  ? <Empty msg="Nenhuma oportunidade cadastrada" />
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={funilData} margin={{ left: 0, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                          formatter={(v: unknown) => [String(v), "Oportunidades"] as [string, string]} />
                        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                          {funilData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )
              }
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionTitle>Origem dos leads</SectionTitle>
              {loading
                ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
                : origemData.length === 0
                  ? <Empty msg="Nenhum dado de origem disponível" />
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={origemData} layout="vertical" margin={{ left: 0, right: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} width={80} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                          formatter={(v: unknown) => [String(v), "Leads"] as [string, string]} />
                        <Bar dataKey="total" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
              }
            </div>
          </div>

          {/* ── Tipos de atividade + Nível de interesse ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionTitle>Tipos de atividade</SectionTitle>
              {loading
                ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
                : tipoData.length === 0
                  ? <Empty msg="Nenhuma atividade registrada" />
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={tipoData} margin={{ left: 0, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                          formatter={(v: unknown) => [String(v), "Atividades"] as [string, string]} />
                        <Bar dataKey="total" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
              }
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionTitle>Nível de interesse</SectionTitle>
              {loading
                ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
                : nivelData.filter(n => n.count > 0).length === 0
                  ? <Empty msg="Nenhum nível de interesse cadastrado" />
                  : (
                    <div className="space-y-3 pt-1">
                      {nivelData.map(n => {
                        const pct = ativas > 0 ? Math.round((n.count / (totalOpps || 1)) * 100) : 0;
                        return (
                          <div key={n.nome}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: n.cor ?? "#9ca3af" }} />
                                <span className="text-sm font-medium text-gray-700">{n.nome}</span>
                              </div>
                              <span className="text-sm font-bold text-gray-900">{n.count}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: n.cor ?? "#9ca3af" }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-xs text-gray-400 pt-1">
                        {nivelData.reduce((s, n) => s + n.count, 0)} oportunidades com nível informado
                      </p>
                    </div>
                  )
              }
            </div>
          </div>

          {/* ── Oportunidades recentes + Atividades recentes ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionTitle>Oportunidades recentes</SectionTitle>
              {loading
                ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
                : recentOpps.length === 0
                  ? <Empty msg="Nenhuma oportunidade cadastrada" />
                  : (
                    <div className="space-y-1">
                      {recentOpps.map((o: any, i: number) => (
                        <div key={o.id ?? i}
                          className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{o.nome}</p>
                            <p className="text-xs text-gray-400">{fmtDate(o.created_at)}</p>
                          </div>
                          <span
                            className="text-[10px] font-bold px-2.5 py-0.5 rounded-full text-white flex-shrink-0 ml-2"
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

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionTitle>Atividades recentes</SectionTitle>
              {loading
                ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
                : recentAtivs.length === 0
                  ? <Empty msg="Nenhuma atividade registrada" />
                  : (
                    <div className="space-y-1">
                      {recentAtivs.map((a: any, i: number) => (
                        <div key={i}
                          className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                                {a.tipo}
                              </span>
                              {a.descricao && (
                                <p className="text-sm text-gray-600 truncate">{a.descricao}</p>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(a.data_atividade)}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                            a.status === "realizado" ? "bg-green-100 text-green-700"
                            : a.status === "pendente"  ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-500"
                          }`}>
                            {a.status}
                          </span>
                        </div>
                      ))}
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
