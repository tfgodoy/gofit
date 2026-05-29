import { useState, useEffect } from "react";
import { Loader2, Users, AlertTriangle, TrendingDown, TrendingUp, UserCheck, UserX, Clock } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function KpiCard({ label, value, sub, valueClass = "text-gray-900", Icon, iconClass = "text-gray-400", loading }: {
  label: string; value: string | number; sub?: string;
  valueClass?: string; Icon?: React.ComponentType<{className?: string}>;
  iconClass?: string; loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</p>
        {Icon && <Icon className={`w-4 h-4 ${iconClass}`} />}
      </div>
      {loading
        ? <Loader2 className="w-6 h-6 animate-spin text-gray-200" />
        : <>
            <p className={`text-2xl font-extrabold leading-none ${valueClass}`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          </>
      }
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  ativo:     "#22c55e",
  lead:      "#3b82f6",
  inativo:   "#9ca3af",
  cancelado: "#ef4444",
};

export default function DashboardOperacionalPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [totalAtivos,   setTotalAtivos]   = useState(0);
  const [totalLeads,    setTotalLeads]    = useState(0);
  const [totalInativos, setTotalInativos] = useState(0);
  const [inadimplentes, setInadimplentes] = useState(0);
  const [valorInadimpl, setValorInadimpl] = useState(0);
  const [contratoVencer, setContratoVencer] = useState(0);
  const [staffAtivos,   setStaffAtivos]   = useState(0);
  const [statusData,    setStatusData]    = useState<{name: string; value: number; color: string}[]>([]);
  const [ultCadastros,  setUltCadastros]  = useState<any[]>([]);
  const [mensalData,    setMensalData]    = useState<{mes: string; ativos: number; leads: number}[]>([]);

  useEffect(() => {
    if (!user?.contractorId) return;
    const cid = user.contractorId!;
    const today = new Date().toISOString().split("T")[0];
    const em30  = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    async function load() {
      const [
        { data: students },
        { data: inadData },
        { data: vencerData },
        { data: staffData },
        { data: recentStudents },
      ] = await Promise.all([
        supabase.from("students").select("status, created_at").eq("contractor_id", cid),
        supabase.from("receivables").select("valor, status, vencimento")
          .eq("contractor_id", cid).eq("status", "pendente").lt("vencimento", today),
        supabase.from("student_contracts").select("id, data_fim, status")
          .eq("contractor_id", cid).eq("status", "ativo")
          .not("data_fim", "is", null).lte("data_fim", em30),
        supabase.from("staff").select("id, active").eq("contractor_id", cid).eq("active", true),
        supabase.from("students").select("id, nome_completo, status, created_at")
          .eq("contractor_id", cid).order("created_at", { ascending: false }).limit(6),
      ]);

      const studArr = (students ?? []) as any[];
      const ativos   = studArr.filter(s => s.status === "ativo").length;
      const leads    = studArr.filter(s => s.status === "lead").length;
      const inativos = studArr.filter(s => s.status === "inativo").length;
      const cancelados = studArr.filter(s => s.status === "cancelado").length;
      setTotalAtivos(ativos);
      setTotalLeads(leads);
      setTotalInativos(inativos);

      setStatusData([
        { name: "Ativos",    value: ativos,    color: STATUS_COLORS.ativo     },
        { name: "Leads",     value: leads,     color: STATUS_COLORS.lead      },
        { name: "Inativos",  value: inativos,  color: STATUS_COLORS.inativo   },
        { name: "Cancelados",value: cancelados, color: STATUS_COLORS.cancelado },
      ].filter(d => d.value > 0));

      const inadArr = (inadData ?? []) as any[];
      setInadimplentes(inadArr.length);
      setValorInadimpl(inadArr.reduce((s, r) => s + (r.valor ?? 0), 0));

      setContratoVencer((vencerData ?? []).length);
      setStaffAtivos((staffData ?? []).length);
      setUltCadastros((recentStudents ?? []) as any[]);

      /* Crescimento mensal (últimos 6 meses) */
      const monthMap: Record<string, { ativos: number; leads: number }> = {};
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap[key] = { ativos: 0, leads: 0 };
      }
      const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      for (const s of studArr) {
        if (!s.created_at) continue;
        const key = s.created_at.slice(0, 7);
        if (!monthMap[key]) continue;
        if (s.status === "ativo")  monthMap[key].ativos++;
        if (s.status === "lead")   monthMap[key].leads++;
      }
      setMensalData(Object.entries(monthMap).map(([key, v]) => {
        const [, m] = key.split("-");
        return { mes: MESES[parseInt(m, 10) - 1], ...v };
      }));

      setLoading(false);
    }

    load();
  }, [user]);

  const BADGE_STATUS: Record<string, string> = {
    ativo: "bg-green-100 text-green-700", lead: "bg-blue-100 text-blue-700",
    inativo: "bg-gray-100 text-gray-500", cancelado: "bg-red-100 text-red-600",
  };

  return (
    <AppLayout>
      <div className="bg-gray-50 min-h-screen">
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <h1 className="text-xl font-bold text-gray-900">Dashboard Operacional</h1>
          <p className="text-sm text-gray-400 mt-0.5">Visão geral da academia em tempo real</p>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard label="Alunos ativos"    value={totalAtivos}   loading={loading} valueClass="text-green-700"  Icon={UserCheck}   iconClass="text-green-400" />
            <KpiCard label="Leads"            value={totalLeads}    loading={loading} valueClass="text-blue-700"   Icon={Users}       iconClass="text-blue-400" />
            <KpiCard label="Inativos"         value={totalInativos} loading={loading} valueClass="text-gray-500"   Icon={UserX}       iconClass="text-gray-300" />
            <KpiCard label="Inadimplentes"    value={inadimplentes} loading={loading} valueClass={inadimplentes > 0 ? "text-red-600" : "text-gray-900"} Icon={TrendingDown} iconClass="text-red-400"
              sub={valorInadimpl > 0 ? fmtMoeda(valorInadimpl) : undefined}
            />
            <KpiCard label="Contratos a vencer (30d)" value={contratoVencer} loading={loading} valueClass={contratoVencer > 0 ? "text-yellow-700" : "text-gray-900"} Icon={Clock} iconClass="text-yellow-400" />
            <KpiCard label="Equipe ativa"     value={staffAtivos}   loading={loading} valueClass="text-primary"    Icon={TrendingUp}  iconClass="text-primary/60" />
          </div>

          {/* Alertas */}
          {!loading && (inadimplentes > 0 || contratoVencer > 0) && (
            <div className="space-y-2">
              {inadimplentes > 0 && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3.5">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">
                    <span className="font-bold">{inadimplentes} aluno{inadimplentes !== 1 ? "s" : ""}</span> com cobranças em atraso —{" "}
                    <span className="font-bold">{fmtMoeda(valorInadimpl)}</span> a recuperar.
                  </p>
                </div>
              )}
              {contratoVencer > 0 && (
                <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-3.5">
                  <Clock className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  <p className="text-sm text-yellow-700">
                    <span className="font-bold">{contratoVencer} contrato{contratoVencer !== 1 ? "s" : ""}</span> vencem nos próximos 30 dias. Contate os alunos para renovação.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Status chart */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Distribuição de status</h2>
              {loading ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
               : statusData.length === 0 ? <p className="text-xs text-gray-400 text-center py-12">Nenhum aluno cadastrado</p>
               : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                      {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Crescimento mensal */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Cadastros por mês (últimos 6 meses)</h2>
              {loading ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
               : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={mensalData} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} width={30} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                    <Legend formatter={v => v === "ativos" ? "Ativos" : "Leads"} />
                    <Bar dataKey="ativos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="leads"  fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Últimos cadastros */}
          {!loading && ultCadastros.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Últimos cadastros</h2>
              <div className="divide-y divide-gray-50">
                {ultCadastros.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {s.nome_completo?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <p className="text-sm font-medium text-gray-800">{s.nome_completo}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${BADGE_STATUS[s.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {s.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(s.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
