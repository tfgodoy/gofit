import { useState, useEffect } from "react";
import { Loader2, Activity, AlertTriangle } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
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
            <p className={`text-2xl font-extrabold leading-none ${valueClass}`}>{value}</p>
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

const REC_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  pendente:  { label: "Pendente",  bg: "bg-yellow-100", text: "text-yellow-700" },
  pago:      { label: "Pago",      bg: "bg-green-100",  text: "text-green-700"  },
  atrasado:  { label: "Atrasado",  bg: "bg-red-100",    text: "text-red-700"    },
  cancelado: { label: "Cancelado", bg: "bg-gray-100",   text: "text-gray-500"   },
};


export default function DashboardFinanceiroPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [entradas,  setEntradas]  = useState(0);
  const [saidas,    setSaidas]    = useState(0);
  const [aReceber,  setAReceber]  = useState(0);
  const [atrasado,  setAtrasado]  = useState(0);
  const [caixaStatus, setCaixaStatus] = useState<"aberto" | "fechado" | null>(null);

  const [catData,    setCatData]    = useState<{ name: string; entradas: number; saidas: number }[]>([]);
  const [recData,    setRecData]    = useState<any[]>([]);
  const [recentTxs,  setRecentTxs]  = useState<any[]>([]);

  useEffect(() => {
    if (!user?.contractorId) return;
    const cid = user.contractorId!;
    const ms  = monthStart();

    async function load() {
      const [
        { data: txs },
        { data: recs },
        { data: openCaixa },
        { data: recentTxsData },
        { data: openRecs },
      ] = await Promise.all([
        supabase.from("transactions").select("tipo, valor, categoria")
          .eq("contractor_id", cid).gte("data", ms),
        supabase.from("receivables").select("valor, status")
          .eq("contractor_id", cid),
        supabase.from("cash_sessions").select("status")
          .eq("contractor_id", cid).eq("status", "aberto").limit(1),
        supabase.from("transactions").select("tipo, valor, descricao, data, categoria, student_nome")
          .eq("contractor_id", cid).order("data", { ascending: false }).limit(8),
        supabase.from("receivables")
          .select("student_nome, descricao, valor, vencimento, status, tipo")
          .eq("contractor_id", cid)
          .in("status", ["pendente","atrasado"])
          .order("vencimento", { ascending: true })
          .limit(8),
      ]);

      const txsArr = (txs ?? []) as any[];
      const totalEnt = txsArr.filter(t => t.tipo === "entrada").reduce((s, t) => s + (t.valor ?? 0), 0);
      const totalSai = txsArr.filter(t => t.tipo === "saida").reduce((s, t) => s + (t.valor ?? 0), 0);
      setEntradas(totalEnt);
      setSaidas(totalSai);

      const recsArr = (recs ?? []) as any[];
      setAReceber(recsArr.filter(r => ["pendente","atrasado"].includes(r.status)).reduce((s: number, r: any) => s + (r.valor ?? 0), 0));
      setAtrasado(recsArr.filter(r => r.status === "atrasado").reduce((s: number, r: any) => s + (r.valor ?? 0), 0));

      setCaixaStatus((openCaixa?.length ?? 0) > 0 ? "aberto" : "fechado");

      /* categoria chart */
      const catMap: Record<string, { entradas: number; saidas: number }> = {};
      for (const t of txsArr) {
        const cat = t.categoria ?? "Outros";
        if (!catMap[cat]) catMap[cat] = { entradas: 0, saidas: 0 };
        if (t.tipo === "entrada") catMap[cat].entradas += t.valor ?? 0;
        else catMap[cat].saidas += t.valor ?? 0;
      }
      setCatData(
        Object.entries(catMap)
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => (b.entradas + b.saidas) - (a.entradas + a.saidas))
          .slice(0, 6)
      );

      setRecentTxs((recentTxsData ?? []) as any[]);
      setRecData((openRecs ?? []) as any[]);
      setLoading(false);
    }

    load();
  }, [user]);

  const saldo = entradas - saidas;

  return (
    <AppLayout>
      <div className="bg-gray-50 min-h-screen">
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard Financeiro</h1>
            <p className="text-sm text-gray-400 mt-0.5">Receitas, despesas e contas a receber</p>
          </div>
          {!loading && caixaStatus !== null && (
            <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full ${
              caixaStatus === "aberto" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}>
              <div className={`w-2 h-2 rounded-full ${caixaStatus === "aberto" ? "bg-green-500" : "bg-gray-400"}`} />
              Caixa {caixaStatus}
            </div>
          )}
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Entradas (mês)" value={fmtMoney(entradas)} loading={loading} valueClass="text-green-700" />
            <KpiCard label="Saídas (mês)"   value={fmtMoney(saidas)}   loading={loading} valueClass="text-red-600" />
            <KpiCard
              label="Saldo do mês"
              value={fmtMoney(saldo)}
              loading={loading}
              valueClass={saldo >= 0 ? "text-green-700" : "text-red-600"}
            />
            <KpiCard
              label="A receber"
              value={fmtMoney(aReceber)}
              sub={atrasado > 0 ? `${fmtMoney(atrasado)} em atraso` : undefined}
              loading={loading}
              valueClass={atrasado > 0 ? "text-red-600" : "text-yellow-700"}
            />
          </div>

          {/* Inadimplência alert */}
          {!loading && atrasado > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3.5">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">
                <span className="font-bold">{fmtMoney(atrasado)}</span> em contas atrasadas.
                Verifique as cobranças em aberto.
              </p>
            </div>
          )}

          {/* Charts + lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Categoria chart */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Movimentações por categoria (mês)</h2>
              {loading ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
               : catData.length === 0 ? <EmptyState message="Nenhuma transação este mês" />
               : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={catData} layout="vertical" margin={{ left: 0, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={v => `R$ ${Number(v).toLocaleString("pt-BR")}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} width={80} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                      formatter={(v: unknown, name: unknown) => [fmtMoney(Number(v)), name === "entradas" ? "Entradas" : "Saídas"]}
                    />
                    <Bar dataKey="entradas" fill="#22c55e" radius={[0, 4, 4, 0]} stackId="a" />
                    <Bar dataKey="saidas"   fill="#ef4444" radius={[0, 4, 4, 0]} stackId="b" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Transações recentes */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Transações recentes</h2>
              {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
               : recentTxs.length === 0 ? <EmptyState message="Nenhuma transação registrada" />
               : (
                <div className="space-y-1">
                  {recentTxs.map((t: any, i: number) => (
                    <div key={t.id ?? i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{t.descricao}</p>
                        <p className="text-xs text-gray-400">{fmtDate(t.data)}{t.student_nome ? ` · ${t.student_nome}` : ""}</p>
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 ml-3 ${t.tipo === "entrada" ? "text-green-700" : "text-red-600"}`}>
                        {t.tipo === "entrada" ? "+" : "-"}{fmtMoney(t.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Contas a receber em aberto */}
          {(loading || recData.length > 0) && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">
                Contas a receber em aberto
              </h2>
              {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-200" /></div>
               : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-semibold text-gray-400 pb-2">CLIENTE</th>
                        <th className="text-left text-xs font-semibold text-gray-400 pb-2">DESCRIÇÃO</th>
                        <th className="text-left text-xs font-semibold text-gray-400 pb-2">VENCIMENTO</th>
                        <th className="text-right text-xs font-semibold text-gray-400 pb-2">VALOR</th>
                        <th className="text-center text-xs font-semibold text-gray-400 pb-2">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recData.map((r: any, i: number) => {
                        const s = REC_STATUS[r.status] ?? REC_STATUS.pendente;
                        return (
                          <tr key={r.id ?? i} className="border-b border-gray-50 last:border-0">
                            <td className="py-2.5 text-sm text-gray-700">{r.student_nome ?? "—"}</td>
                            <td className="py-2.5 text-sm text-gray-500">{r.descricao}</td>
                            <td className="py-2.5 text-sm text-gray-500">{fmtDate(r.vencimento)}</td>
                            <td className="py-2.5 text-sm font-semibold text-right text-gray-800">{fmtMoney(r.valor)}</td>
                            <td className="py-2.5 text-center">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                                {s.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}
