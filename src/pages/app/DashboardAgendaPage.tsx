import { useState, useEffect } from "react";
import { Loader2, CalendarCheck, Users, TrendingUp, Clock } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function KpiCard({ label, value, sub, valueClass = "text-gray-900", Icon, iconCls, loading }: {
  label: string; value: string | number; sub?: string;
  valueClass?: string; Icon: React.ComponentType<{className?: string}>;
  iconCls: string; loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</p>
        <Icon className={`w-4 h-4 ${iconCls}`} />
      </div>
      {loading ? <Loader2 className="w-6 h-6 animate-spin text-gray-200" /> : (
        <>
          <p className={`text-2xl font-extrabold leading-none ${valueClass}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </>
      )}
    </div>
  );
}

export default function DashboardAgendaPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [totalHoje,      setTotalHoje]      = useState(0);
  const [presentesHoje,  setPresentesHoje]  = useState(0);
  const [taxaPresenca,   setTaxaPresenca]   = useState(0);
  const [filaEspera,     setFilaEspera]     = useState(0);
  const [aulasSemana,    setAulasSemana]    = useState(0);
  const [barData,        setBarData]        = useState<{nome: string; presentes: number; faltas: number}[]>([]);
  const [topAulas,       setTopAulas]       = useState<{nome: string; total: number; presentes: number}[]>([]);

  useEffect(() => {
    if (!user?.contractorId) return;
    const cid   = user.contractorId!;
    const today = new Date().toISOString().split("T")[0];
    const weekStart = (() => {
      const d = new Date(); const day = d.getDay();
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
      return d.toISOString().split("T")[0];
    })();
    const weekEnd = (() => {
      const d = new Date(); const day = d.getDay();
      d.setDate(d.getDate() + (day === 0 ? 0 : 7 - day));
      return d.toISOString().split("T")[0];
    })();
    /* Últimos 6 meses para gráfico */
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const sixMonthsStr = sixMonthsAgo.toISOString().split("T")[0];

    async function load() {
      const [
        { data: slotsHoje },
        { data: bkHoje },
        { data: bkFila },
        { data: slotsSemana },
        { data: bkHistorico },
        { data: slotsHistorico },
      ] = await Promise.all([
        supabase.from("schedule_slots").select("id, capacidade_maxima, modalidade_nome")
          .eq("contractor_id", cid).eq("data", today).neq("status", "cancelado"),
        supabase.from("bookings").select("slot_id, status")
          .eq("contractor_id", cid).in("status", ["presente", "reservado", "faltou"])
          .gte("created_at", today + "T00:00:00"),
        supabase.from("bookings").select("id")
          .eq("contractor_id", cid).eq("status", "lista_espera"),
        supabase.from("schedule_slots").select("id")
          .eq("contractor_id", cid).gte("data", weekStart).lte("data", weekEnd).neq("status", "cancelado"),
        supabase.from("bookings").select("status, created_at")
          .eq("contractor_id", cid).in("status", ["presente", "faltou"])
          .gte("created_at", sixMonthsStr + "T00:00:00"),
        supabase.from("schedule_slots").select("id, modalidade_nome")
          .eq("contractor_id", cid).neq("status", "cancelado"),
      ]);

      const slotsArr  = (slotsHoje ?? []) as any[];
      const bkArr     = (bkHoje    ?? []) as any[];
      const bkHistArr = (bkHistorico ?? []) as any[];
      const slotsHist = (slotsHistorico ?? []) as any[];

      setTotalHoje(slotsArr.length);
      const presentes = bkArr.filter(b => b.status === "presente").length;
      const reservados = bkArr.filter(b => b.status === "reservado").length;
      setPresentesHoje(presentes);
      setTaxaPresenca(presentes + reservados > 0
        ? Math.round((presentes / (presentes + reservados)) * 100)
        : 0);
      setFilaEspera((bkFila ?? []).length);
      setAulasSemana((slotsSemana ?? []).length);

      /* Bar chart por mês */
      const monthMap: Record<string, { presentes: number; faltas: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap[key] = { presentes: 0, faltas: 0 };
      }
      for (const b of bkHistArr) {
        const key = (b.created_at as string).slice(0, 7);
        if (!monthMap[key]) continue;
        if (b.status === "presente") monthMap[key].presentes++;
        else monthMap[key].faltas++;
      }
      setBarData(Object.entries(monthMap).map(([key, v]) => {
        const [, m] = key.split("-");
        return { nome: MESES[parseInt(m, 10) - 1], ...v };
      }));

      /* Top aulas por modalidade */
      const modMap: Record<string, { total: number; presentes: number }> = {};
      for (const s of slotsHist) {
        const nome = s.modalidade_nome ?? "Outra";
        if (!modMap[nome]) modMap[nome] = { total: 0, presentes: 0 };
        modMap[nome].total++;
      }
      setTopAulas(
        Object.entries(modMap)
          .map(([nome, v]) => ({ nome, ...v }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5)
      );

      setLoading(false);
    }

    load();
  }, [user]);

  return (
    <AppLayout>
      <div className="bg-gray-50 min-h-screen">
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <h1 className="text-xl font-bold text-gray-900">Dashboard de Agenda</h1>
          <p className="text-sm text-gray-400 mt-0.5">Presença, ocupação e desempenho das aulas</p>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard label="Aulas hoje"        value={totalHoje}    loading={loading} Icon={CalendarCheck} iconCls="text-primary"      valueClass="text-primary" />
            <KpiCard label="Presentes hoje"    value={presentesHoje} loading={loading} Icon={Users}        iconCls="text-green-500"    valueClass="text-green-700" />
            <KpiCard label="Taxa de presença"  value={`${taxaPresenca}%`} loading={loading} Icon={TrendingUp} iconCls="text-blue-500"
              sub="aulas com check-in"
              valueClass={taxaPresenca >= 70 ? "text-green-700" : taxaPresenca >= 40 ? "text-yellow-700" : "text-red-600"} />
            <KpiCard label="Aulas na semana"   value={aulasSemana}  loading={loading} Icon={CalendarCheck} iconCls="text-teal-500"    valueClass="text-teal-700" />
            <KpiCard label="Fila de espera"    value={filaEspera}   loading={loading} Icon={Clock}         iconCls="text-yellow-500"
              sub="aguardando vaga"
              valueClass={filaEspera > 0 ? "text-yellow-700" : "text-gray-500"} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Gráfico presença por mês */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-4">
                Presenças vs Faltas — últimos 6 meses
              </h2>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} width={30} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                    <Legend formatter={v => v === "presentes" ? "Presentes" : "Faltas"} />
                    <Bar dataKey="presentes" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="faltas"    fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top modalidades */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-4">
                Modalidades mais ativas
              </h2>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
              ) : topAulas.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">Sem dados</p>
              ) : (
                <div className="space-y-3">
                  {topAulas.map((a, i) => (
                    <div key={a.nome} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{a.nome}</p>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-primary rounded-full"
                            style={{ width: `${topAulas[0].total > 0 ? (a.total / topAulas[0].total) * 100 : 0}%` }} />
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-gray-500 flex-shrink-0">{a.total} aulas</p>
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
