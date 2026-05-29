import { useState, useEffect } from "react";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getRange(periodo: string): { inicio: string; fim: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (periodo === "mes_atual") {
    const inicio = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const fim    = new Date(y, m + 1, 0).toISOString().split("T")[0];
    return { inicio, fim, label: now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  }
  if (periodo === "mes_anterior") {
    const d = new Date(y, m - 1, 1);
    const inicio = d.toISOString().split("T")[0];
    const fim    = new Date(y, m, 0).toISOString().split("T")[0];
    return { inicio, fim, label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  }
  if (periodo === "trimestre") {
    const q = Math.floor(m / 3);
    const inicio = new Date(y, q * 3, 1).toISOString().split("T")[0];
    const fim    = new Date(y, q * 3 + 3, 0).toISOString().split("T")[0];
    return { inicio, fim, label: `${q + 1}º trimestre de ${y}` };
  }
  if (periodo === "semestre") {
    const s = m < 6 ? 0 : 1;
    const inicio = new Date(y, s * 6, 1).toISOString().split("T")[0];
    const fim    = new Date(y, s * 6 + 6, 0).toISOString().split("T")[0];
    return { inicio, fim, label: `${s + 1}º semestre de ${y}` };
  }
  /* ano */
  return { inicio: `${y}-01-01`, fim: `${y}-12-31`, label: `Ano ${y}` };
}

interface CatLine {
  categoria: string;
  valor:     number;
}

interface DreData {
  receitas:  CatLine[];
  despesas:  CatLine[];
  totalRec:  number;
  totalDesp: number;
  resultado: number;
  mensal:    { mes: string; receitas: number; despesas: number }[];
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function DrePage() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState("mes_atual");
  const [loading, setLoading] = useState(true);
  const [dre, setDre]         = useState<DreData | null>(null);

  useEffect(() => {
    if (!user?.contractorId) return;
    const cid = user.contractorId!;
    const { inicio, fim } = getRange(periodo);
    setLoading(true);

    async function load() {
      const [
        { data: txs },
        { data: pays },
      ] = await Promise.all([
        supabase.from("transactions").select("tipo, valor, categoria, data")
          .eq("contractor_id", cid).gte("data", inicio).lte("data", fim),
        supabase.from("payables").select("valor_pago, valor, categoria, pago_em, status")
          .eq("contractor_id", cid).eq("status", "pago")
          .gte("pago_em", inicio).lte("pago_em", fim),
      ]);

      const txsArr  = (txs  ?? []) as any[];
      const paysArr = (pays ?? []) as any[];

      /* Receitas */
      const recMap: Record<string, number> = {};
      for (const t of txsArr.filter(t => t.tipo === "entrada")) {
        const cat = t.categoria ?? "Outros";
        recMap[cat] = (recMap[cat] ?? 0) + (t.valor ?? 0);
      }

      /* Despesas: transactions saida + payables pago */
      const despMap: Record<string, number> = {};
      for (const t of txsArr.filter(t => t.tipo === "saida")) {
        const cat = t.categoria ?? "Outros";
        despMap[cat] = (despMap[cat] ?? 0) + (t.valor ?? 0);
      }
      for (const p of paysArr) {
        const cat = p.categoria ?? "Outros";
        despMap[cat] = (despMap[cat] ?? 0) + (p.valor_pago ?? p.valor ?? 0);
      }

      const receitas = Object.entries(recMap).map(([categoria, valor]) => ({ categoria, valor }))
        .sort((a, b) => b.valor - a.valor);
      const despesas = Object.entries(despMap).map(([categoria, valor]) => ({ categoria, valor }))
        .sort((a, b) => b.valor - a.valor);

      const totalRec  = receitas.reduce((s, x) => s + x.valor, 0);
      const totalDesp = despesas.reduce((s, x) => s + x.valor, 0);

      /* Mensal (apenas para períodos > 1 mês) */
      const mensal: { mes: string; receitas: number; despesas: number }[] = [];
      if (periodo !== "mes_atual" && periodo !== "mes_anterior") {
        const mMap: Record<string, { receitas: number; despesas: number }> = {};
        for (const t of txsArr) {
          const mes = t.data?.slice(0, 7);
          if (!mes) continue;
          if (!mMap[mes]) mMap[mes] = { receitas: 0, despesas: 0 };
          if (t.tipo === "entrada") mMap[mes].receitas += t.valor ?? 0;
          else mMap[mes].despesas += t.valor ?? 0;
        }
        for (const p of paysArr) {
          const mes = p.pago_em?.slice(0, 7);
          if (!mes) continue;
          if (!mMap[mes]) mMap[mes] = { receitas: 0, despesas: 0 };
          mMap[mes].despesas += p.valor_pago ?? p.valor ?? 0;
        }
        Object.entries(mMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([key, val]) => {
          const [y, m] = key.split("-");
          mensal.push({ mes: `${MESES[parseInt(m, 10) - 1]}/${y.slice(2)}`, ...val });
        });
      }

      setDre({ receitas, despesas, totalRec, totalDesp, resultado: totalRec - totalDesp, mensal });
      setLoading(false);
    }

    load();
  }, [user, periodo]);

  const range = getRange(periodo);

  return (
    <AppLayout>
      <div className="bg-gray-50 min-h-screen">
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">DRE Gerencial</h1>
            <p className="text-sm text-gray-400 mt-0.5">{range.label}</p>
          </div>
          <select
            value={periodo}
            onChange={e => setPeriodo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="mes_atual">Mês atual</option>
            <option value="mes_anterior">Mês anterior</option>
            <option value="trimestre">Trimestre atual</option>
            <option value="semestre">Semestre atual</option>
            <option value="ano">Ano atual</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
          </div>
        ) : dre && (
          <div className="px-8 py-6 space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total Receitas</p>
                </div>
                <p className="text-2xl font-extrabold text-green-700">{fmtMoeda(dre.totalRec)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total Despesas</p>
                </div>
                <p className="text-2xl font-extrabold text-red-600">{fmtMoeda(dre.totalDesp)}</p>
              </div>
              <div className={`rounded-xl border p-5 ${
                dre.resultado >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Minus className={`w-4 h-4 ${dre.resultado >= 0 ? "text-green-600" : "text-red-600"}`} />
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Resultado Líquido</p>
                </div>
                <p className={`text-2xl font-extrabold ${dre.resultado >= 0 ? "text-green-800" : "text-red-800"}`}>
                  {fmtMoeda(dre.resultado)}
                </p>
              </div>
            </div>

            {/* Gráfico mensal (só se tiver dados) */}
            {dre.mensal.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-4">Receitas vs Despesas por mês</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dre.mensal} margin={{ left: 0, right: 24, top: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={v => `R$${Number(v).toLocaleString("pt-BR")}`} width={72} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                      formatter={(v: unknown, name: unknown) => [fmtMoeda(Number(v)), name === "receitas" ? "Receitas" : "Despesas"]}
                    />
                    <Legend formatter={v => v === "receitas" ? "Receitas" : "Despesas"} />
                    <Bar dataKey="receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabela DRE */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Conta</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Bloco Receitas */}
                  <tr className="bg-green-50 border-b border-green-100">
                    <td colSpan={3} className="px-6 py-2 text-xs font-bold text-green-800 uppercase tracking-wide">
                      Receitas
                    </td>
                  </tr>
                  {dre.receitas.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-sm text-gray-400 text-center">Nenhuma receita no período</td>
                    </tr>
                  ) : dre.receitas.map(r => (
                    <tr key={r.categoria} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-2.5 text-gray-700 pl-10">{r.categoria}</td>
                      <td className="px-6 py-2.5 text-right font-medium text-green-700">{fmtMoeda(r.valor)}</td>
                      <td className="px-6 py-2.5 text-right text-gray-400">
                        {dre.totalRec > 0 ? `${((r.valor / dre.totalRec) * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b-2 border-green-200 bg-green-50">
                    <td className="px-6 py-2.5 font-bold text-green-800">Total Receitas</td>
                    <td className="px-6 py-2.5 text-right font-bold text-green-800">{fmtMoeda(dre.totalRec)}</td>
                    <td className="px-6 py-2.5 text-right text-gray-400">100%</td>
                  </tr>

                  {/* Espaçador */}
                  <tr><td colSpan={3} className="py-1 bg-gray-50" /></tr>

                  {/* Bloco Despesas */}
                  <tr className="bg-red-50 border-b border-red-100">
                    <td colSpan={3} className="px-6 py-2 text-xs font-bold text-red-800 uppercase tracking-wide">
                      Despesas
                    </td>
                  </tr>
                  {dre.despesas.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-sm text-gray-400 text-center">Nenhuma despesa no período</td>
                    </tr>
                  ) : dre.despesas.map(d => (
                    <tr key={d.categoria} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-2.5 text-gray-700 pl-10">{d.categoria}</td>
                      <td className="px-6 py-2.5 text-right font-medium text-red-600">{fmtMoeda(d.valor)}</td>
                      <td className="px-6 py-2.5 text-right text-gray-400">
                        {dre.totalDesp > 0 ? `${((d.valor / dre.totalDesp) * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b-2 border-red-200 bg-red-50">
                    <td className="px-6 py-2.5 font-bold text-red-800">Total Despesas</td>
                    <td className="px-6 py-2.5 text-right font-bold text-red-800">{fmtMoeda(dre.totalDesp)}</td>
                    <td className="px-6 py-2.5 text-right text-gray-400">100%</td>
                  </tr>

                  {/* Resultado */}
                  <tr className={dre.resultado >= 0 ? "bg-green-100" : "bg-red-100"}>
                    <td className={`px-6 py-3 text-base font-extrabold ${dre.resultado >= 0 ? "text-green-900" : "text-red-900"}`}>
                      Resultado Líquido
                    </td>
                    <td className={`px-6 py-3 text-right text-base font-extrabold ${dre.resultado >= 0 ? "text-green-900" : "text-red-900"}`}>
                      {fmtMoeda(dre.resultado)}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-500 text-sm">
                      {dre.totalRec > 0 ? `${((dre.resultado / dre.totalRec) * 100).toFixed(1)}% margem` : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
