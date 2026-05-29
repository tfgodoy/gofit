import { useState, useEffect } from "react";
import {
  Search, ChevronLeft, ChevronRight, TrendingUp, ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Transaction {
  id:              string;
  tipo:            "entrada" | "saida";
  descricao:       string;
  valor:           number;
  data:            string;
  forma_pagamento: string | null;
  student_nome:    string | null;
  categoria:       string | null;
  created_at:      string;
}

const FORMAS_LABEL: Record<string, string> = {
  dinheiro:       "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito:  "Cartão de débito",
  pix:            "PIX",
  boleto:         "Boleto",
  transferencia:  "Transferência",
};

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("pt-BR");
}

const PAGE_SIZE = 20;

function monthRange() {
  const now   = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  return { start, end };
}

export default function VendasPage() {
  const { user } = useAuth();
  const [all, setAll]         = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(1);
  const [tipo, setTipo]       = useState<"todos" | "entrada" | "saida">("todos");

  const mr = monthRange();
  const [dateFrom, setDateFrom] = useState(mr.start);
  const [dateTo, setDateTo]     = useState(mr.end);

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);
    let q = supabase
      .from("transactions")
      .select("*")
      .eq("contractor_id", user.contractorId)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false });

    if (dateFrom) q = q.gte("data", dateFrom);
    if (dateTo)   q = q.lte("data", dateTo);

    const { data } = await q;
    setAll((data ?? []) as Transaction[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user, dateFrom, dateTo]);

  const filtered = all.filter(t => {
    if (tipo !== "todos" && t.tipo !== tipo) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.descricao.toLowerCase().includes(q) ||
        (t.student_nome?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const totalEntradas = filtered.filter(t => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0);
  const totalSaidas   = filtered.filter(t => t.tipo === "saida").reduce((s, t) => s + t.valor, 0);
  const saldo         = totalEntradas - totalSaidas;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-lg font-bold text-gray-900 flex-shrink-0">Vendas</h1>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <span className="text-gray-400 text-sm">até</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-48"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50 p-8 space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <ArrowUpCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Total entradas</p>
                  <p className="text-base font-bold text-green-700">{fmtMoeda(totalEntradas)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                  <ArrowDownCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Total saídas</p>
                  <p className="text-base font-bold text-red-600">{fmtMoeda(totalSaidas)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${saldo >= 0 ? "bg-primary/10" : "bg-red-50"}`}>
                  <TrendingUp className={`w-5 h-5 ${saldo >= 0 ? "text-primary" : "text-red-500"}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Saldo</p>
                  <p className={`text-base font-bold ${saldo >= 0 ? "text-primary" : "text-red-600"}`}>{fmtMoeda(saldo)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-t-xl border border-gray-200 border-b-0">
            <div className="flex items-center gap-1 px-4 pt-3">
              {(["todos", "entrada", "saida"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTipo(t); setPage(1); }}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                    tipo === t ? "text-primary border-b-2 border-primary" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {{ todos: "Todos", entrada: "Entradas", saida: "Saídas" }[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-b-xl border border-gray-200 border-t-0 overflow-hidden -mt-5">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <TrendingUp className="w-10 h-10 text-gray-200" />
                <p className="text-sm text-gray-400">Nenhuma transação encontrada neste período.</p>
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold">
                      <th className="text-left px-6 py-3">Data</th>
                      <th className="text-left px-4 py-3">Descrição</th>
                      <th className="text-left px-4 py-3">Aluno / Origem</th>
                      <th className="text-left px-4 py-3">Categoria</th>
                      <th className="text-left px-4 py-3">Forma de pagamento</th>
                      <th className="text-left px-4 py-3">Tipo</th>
                      <th className="text-right px-6 py-3">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginated.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 text-gray-600 text-xs">{fmtData(t.data)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">{t.descricao}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{t.student_nome ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{t.categoria ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {t.forma_pagamento ? (FORMAS_LABEL[t.forma_pagamento] ?? t.forma_pagamento) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            t.tipo === "entrada" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                          }`}>
                            {t.tipo === "entrada" ? "Entrada" : "Saída"}
                          </span>
                        </td>
                        <td className={`px-6 py-3 text-right font-bold ${t.tipo === "entrada" ? "text-green-700" : "text-red-600"}`}>
                          {t.tipo === "entrada" ? "+" : "−"}{fmtMoeda(t.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
                  <span>Página {page} de {totalPages} — {filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
                  <div className="flex items-center gap-1">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
