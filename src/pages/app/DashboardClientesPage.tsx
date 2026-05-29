import { useState, useEffect } from "react";
import { Loader2, Activity } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function KpiCard({ label, value, sub, valueClass = "text-gray-900", loading }: {
  label: string; value: string; sub?: string; valueClass?: string; loading: boolean;
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

const STATUS_FILL: Record<string, string> = {
  ativo: "#22c55e", lead: "#3b82f6", inativo: "#9ca3af", cancelado: "#ef4444",
};
const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo", lead: "Lead", inativo: "Inativo", cancelado: "Cancelado",
};

export default function DashboardClientesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [ativos,    setAtivos]    = useState(0);
  const [leads,     setLeads]     = useState(0);
  const [inativos,  setInativos]  = useState(0);
  const [cancelados, setCancelados] = useState(0);
  const [novos,     setNovos]     = useState(0);

  const [statusData,  setStatusData]  = useState<{ name: string; total: number; fill: string }[]>([]);
  const [objetivoData, setObjetivoData] = useState<{ name: string; total: number }[]>([]);
  const [sexoData,    setSexoData]    = useState<{ name: string; total: number; fill: string }[]>([]);

  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.contractorId) return;
    const cid = user.contractorId!;
    const ms  = monthStart();

    async function load() {
      const [{ data: allStudents }, { data: recentData }] = await Promise.all([
        supabase.from("students").select("status, sexo, objetivo").eq("contractor_id", cid),
        supabase.from("students")
          .select("nome_completo, status, sexo, created_at")
          .eq("contractor_id", cid)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const students = (allStudents ?? []) as any[];

      const sc: Record<string, number> = {};
      const gc: Record<string, number> = {};
      const oc: Record<string, number> = {};
      let novosC = 0;

      for (const s of students) {
        sc[s.status] = (sc[s.status] ?? 0) + 1;
        if (s.sexo) gc[s.sexo] = (gc[s.sexo] ?? 0) + 1;
        if (s.objetivo) oc[s.objetivo] = (oc[s.objetivo] ?? 0) + 1;
      }

      /* novos este mês (from recentData createdAt) */
      const msDate = new Date(ms);
      novosC = (recentData ?? []).filter((s: any) => new Date(s.created_at) >= msDate).length;

      setAtivos(sc["ativo"] ?? 0);
      setLeads(sc["lead"] ?? 0);
      setInativos(sc["inativo"] ?? 0);
      setCancelados(sc["cancelado"] ?? 0);
      setNovos(novosC);

      setStatusData(["ativo","lead","inativo","cancelado"].map(k => ({
        name: STATUS_LABEL[k], total: sc[k] ?? 0, fill: STATUS_FILL[k],
      })));

      setSexoData([
        { name: "Masculino", total: gc["masculino"] ?? 0, fill: "#3b82f6" },
        { name: "Feminino",  total: gc["feminino"]  ?? 0, fill: "#ec4899" },
        { name: "Outro",     total: gc["outro"]      ?? 0, fill: "#9ca3af" },
      ]);

      setObjetivoData(
        Object.entries(oc)
          .map(([k, v]) => ({ name: k, total: v }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 6)
      );

      setRecent((recentData ?? []) as any[]);
      setLoading(false);
    }

    load();
  }, [user]);

  const total = ativos + leads + inativos + cancelados;

  return (
    <AppLayout>
      <div className="bg-gray-50 min-h-screen">
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <h1 className="text-xl font-bold text-gray-900">Dashboard Clientes</h1>
          <p className="text-sm text-gray-400 mt-0.5">Análise da base de clientes</p>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard label="Total cadastrados" value={String(total)}     loading={loading} />
            <KpiCard label="Ativos"            value={String(ativos)}    loading={loading} valueClass="text-green-700" />
            <KpiCard label="Leads"             value={String(leads)}     loading={loading} valueClass="text-blue-700" />
            <KpiCard label="Inativos"          value={String(inativos)}  loading={loading} valueClass="text-gray-500" />
            <KpiCard label="Novos este mês"    value={String(novos)}     loading={loading} valueClass="text-primary" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Status */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Distribuição por status</h2>
              {loading ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
               : statusData.every(d => d.total === 0) ? <EmptyState message="Nenhum cliente cadastrado ainda" />
               : (
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={statusData} margin={{ left: 0, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(v: unknown) => [String(v), "Clientes"] as [string, string]} />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Sexo */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Distribuição por sexo</h2>
              {loading ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
               : sexoData.every(d => d.total === 0) ? <EmptyState message="Dados de sexo não informados" />
               : (
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={sexoData.filter(d => d.total > 0)} margin={{ left: 0, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(v: unknown) => [String(v), "Clientes"] as [string, string]} />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {sexoData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Objetivo */}
            {objetivoData.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Objetivos mais comuns</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={objetivoData} layout="vertical" margin={{ left: 0, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} width={120} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(v: unknown) => [String(v), "Clientes"] as [string, string]} />
                    <Bar dataKey="total" fill="hsl(270 60% 50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Recentes */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Clientes recentes</h2>
              {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
               : recent.length === 0 ? <EmptyState message="Nenhum cliente cadastrado" />
               : (
                <div className="space-y-1">
                  {recent.map((s: any, i: number) => (
                    <div key={s.id ?? i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{s.nome_completo}</p>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0 ml-3 ${
                        { ativo: "bg-green-100 text-green-700", lead: "bg-blue-100 text-blue-700",
                          inativo: "bg-gray-100 text-gray-500", cancelado: "bg-red-100 text-red-600" }[s.status as string] ?? "bg-gray-100 text-gray-600"
                      }`}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
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
