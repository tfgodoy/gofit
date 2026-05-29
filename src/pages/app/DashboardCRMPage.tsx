import { useState, useEffect } from "react";
import { Loader2, Activity } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function KpiCard({ label, value, sub, valueClass = "text-gray-900", loading }: {
  label: string; value: string; sub?: string;
  valueClass?: string; loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{label}</p>
      {loading
        ? <Loader2 className="w-6 h-6 animate-spin text-gray-200" />
        : <>
            <p className={`text-3xl font-extrabold leading-none ${valueClass}`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          </>
      }
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-36 gap-2">
      <Activity className="w-7 h-7 text-gray-200" />
      <p className="text-xs text-gray-400">{message}</p>
    </div>
  );
}

const ETAPA_ORDER = ["lead", "visita", "proposta", "matricula", "perdido"] as const;
const ETAPA_LABEL: Record<string, string> = {
  lead: "Lead", visita: "Visita", proposta: "Proposta",
  matricula: "Matrícula", perdido: "Perdido",
};
const ETAPA_FILL: Record<string, string> = {
  lead: "#3b82f6", visita: "#8b5cf6", proposta: "#f97316",
  matricula: "#22c55e", perdido: "#ef4444",
};
const ETAPA_COLOR: Record<string, string> = {
  lead: "bg-blue-100 text-blue-700", visita: "bg-purple-100 text-purple-700",
  proposta: "bg-orange-100 text-orange-700", matricula: "bg-green-100 text-green-700",
  perdido: "bg-red-100 text-red-700",
};

export default function DashboardCRMPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [totalOpps,  setTotalOpps]  = useState(0);
  const [ativas,     setAtivas]     = useState(0);
  const [convertidos, setConvertidos] = useState(0);
  const [perdidos,   setPerdidos]   = useState(0);
  const [totalAtivs, setTotalAtivs] = useState(0);

  const [funilData,  setFunilData]  = useState<{ name: string; total: number; fill: string }[]>([]);
  const [origemData, setOrigemData] = useState<{ name: string; total: number }[]>([]);

  const [recentOpps, setRecentOpps] = useState<any[]>([]);
  const [campanhas,  setCampanhas]  = useState<{ total: number; ativas: number }>({ total: 0, ativas: 0 });

  useEffect(() => {
    if (!user?.contractorId) return;
    const cid = user.contractorId!;

    async function load() {
      const [
        { data: opps },
        { count: atvsCount },
        { data: camps },
        { data: recentO },
      ] = await Promise.all([
        supabase.from("opportunities").select("etapa, origem").eq("contractor_id", cid),
        supabase.from("activities").select("id", { count: "exact", head: true }).eq("contractor_id", cid),
        supabase.from("campaigns").select("status").eq("contractor_id", cid),
        supabase.from("opportunities")
          .select("nome, etapa, origem, created_at")
          .eq("contractor_id", cid)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const oppsArr = (opps ?? []) as any[];
      setTotalOpps(oppsArr.length);
      setAtivas(oppsArr.filter(o => !["matricula","perdido"].includes(o.etapa)).length);
      setConvertidos(oppsArr.filter(o => o.etapa === "matricula").length);
      setPerdidos(oppsArr.filter(o => o.etapa === "perdido").length);
      setTotalAtivs(atvsCount ?? 0);

      /* funil */
      const etapaCount: Record<string, number> = {};
      for (const o of oppsArr) etapaCount[o.etapa] = (etapaCount[o.etapa] ?? 0) + 1;
      setFunilData(ETAPA_ORDER.map(k => ({ name: ETAPA_LABEL[k], total: etapaCount[k] ?? 0, fill: ETAPA_FILL[k] })));

      /* origem */
      const origCount: Record<string, number> = {};
      for (const o of oppsArr) origCount[o.origem] = (origCount[o.origem] ?? 0) + 1;
      const ORIG_LABELS: Record<string, string> = {
        manual: "Manual", instagram: "Instagram", facebook: "Facebook",
        google: "Google", indicacao: "Indicação", site: "Site",
        evento: "Evento", whatsapp: "WhatsApp",
      };
      setOrigemData(
        Object.entries(origCount)
          .map(([k, v]) => ({ name: ORIG_LABELS[k] ?? k, total: v }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 6)
      );

      /* campanhas */
      const campsArr = (camps ?? []) as any[];
      setCampanhas({ total: campsArr.length, ativas: campsArr.filter(c => c.status === "ativo").length });

      setRecentOpps((recentO ?? []) as any[]);
      setLoading(false);
    }

    load();
  }, [user]);

  const convRate = totalOpps > 0 ? Math.round((convertidos / totalOpps) * 100) : 0;

  return (
    <AppLayout>
      <div className="bg-gray-50 min-h-screen">
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <h1 className="text-xl font-bold text-gray-900">Dashboard CRM</h1>
          <p className="text-sm text-gray-400 mt-0.5">Funil de vendas e oportunidades</p>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard label="Total de leads"    value={String(totalOpps)}  loading={loading} />
            <KpiCard label="Ativos no funil"   value={String(ativas)}     loading={loading} valueClass="text-purple-700" />
            <KpiCard label="Convertidos"       value={String(convertidos)} loading={loading} valueClass="text-green-700" />
            <KpiCard label="Taxa de conversão" value={`${convRate}%`}     loading={loading} valueClass="text-orange-700" />
            <KpiCard label="Atividades"        value={String(totalAtivs)} loading={loading} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Funil por etapa</h2>
              {loading ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
               : funilData.every(d => d.total === 0) ? <EmptyState message="Nenhuma oportunidade cadastrada" />
               : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={funilData} margin={{ left: 0, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(v: unknown) => [String(v), "Oportunidades"] as [string, string]} />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {funilData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Origem dos leads</h2>
              {loading ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
               : origemData.length === 0 ? <EmptyState message="Nenhuma oportunidade cadastrada" />
               : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={origemData} layout="vertical" margin={{ left: 0, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} width={68} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(v: unknown) => [String(v), "Leads"] as [string, string]} />
                    <Bar dataKey="total" fill="hsl(270 60% 50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Oportunidades recentes + Resumo campanhas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Oportunidades recentes</h2>
              {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
               : recentOpps.length === 0 ? <EmptyState message="Nenhuma oportunidade cadastrada" />
               : (
                <div className="space-y-1">
                  {recentOpps.map((o: any, i: number) => (
                    <div key={o.id ?? i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{o.nome}</p>
                        <p className="text-xs text-gray-400">{fmtDate(o.created_at)}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ETAPA_COLOR[o.etapa] ?? "bg-gray-100 text-gray-600"}`}>
                        {ETAPA_LABEL[o.etapa] ?? o.etapa}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-4">Campanhas</h2>
              {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
               : (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <p className="text-4xl font-extrabold text-gray-900">{campanhas.total}</p>
                    <p className="text-xs text-gray-400 mt-1">campanhas criadas</p>
                  </div>
                  <div className={`rounded-xl px-4 py-3 text-center ${campanhas.ativas > 0 ? "bg-green-50" : "bg-gray-50"}`}>
                    <p className={`text-2xl font-extrabold ${campanhas.ativas > 0 ? "text-green-700" : "text-gray-400"}`}>
                      {campanhas.ativas}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">ativas agora</p>
                  </div>
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-center">
                    <p className="text-2xl font-extrabold text-red-600">{perdidos}</p>
                    <p className="text-xs text-gray-500 mt-0.5">oportunidades perdidas</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
