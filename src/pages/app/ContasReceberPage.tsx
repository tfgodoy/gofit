import { useState, useEffect } from "react";
import {
  Plus, Search, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Clock,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import LancarCobrancaModal from "@/components/app/LancarCobrancaModal";
import RegistrarPagamentoModal, {
  type ReceivableForPayment,
} from "@/components/app/RegistrarPagamentoModal";

type StatusFilter = "todos" | "pendente" | "atrasado" | "pago" | "cancelado";

interface Receivable {
  id:              string;
  student_nome:    string | null;
  descricao:       string;
  valor:           number;
  vencimento:      string;
  status:          "pendente" | "pago" | "atrasado" | "cancelado";
  tipo:            string;
  forma_pagamento: string | null;
  valor_pago:      number | null;
  parcela_numero:  number | null;
  total_parcelas:  number | null;
  pago_em:         string | null;
  created_at:      string;
}

const TODAY = new Date().toISOString().split("T")[0];

function effectiveStatus(r: Receivable): "pendente" | "pago" | "atrasado" | "cancelado" {
  if (r.status === "pendente" && r.vencimento < TODAY) return "atrasado";
  return r.status;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pendente:  { label: "Pendente",  cls: "bg-yellow-100 text-yellow-700" },
  atrasado:  { label: "Atrasado",  cls: "bg-red-100 text-red-600" },
  pago:      { label: "Pago",      cls: "bg-green-100 text-green-700" },
  cancelado: { label: "Cancelado", cls: "bg-gray-100 text-gray-500" },
};

const TIPO_LABEL: Record<string, string> = {
  mensalidade: "Mensalidade",
  matricula:   "Matrícula",
  avulso:      "Avulso",
  multa:       "Multa",
  aula_avulsa: "Aula avulsa",
  outros:      "Outros",
};

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("pt-BR");
}

const PAGE_SIZE = 20;

export default function ContasReceberPage() {
  const { user } = useAuth();
  const [all, setAll]               = useState<Receivable[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [page, setPage]             = useState(1);
  const [showLancar, setShowLancar] = useState(false);
  const [payTarget, setPayTarget]   = useState<ReceivableForPayment | null>(null);
  const [cancelId, setCancelId]     = useState<string | null>(null);

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);
    const { data } = await supabase
      .from("receivables")
      .select("*")
      .eq("contractor_id", user.contractorId)
      .order("vencimento", { ascending: false });
    setAll((data ?? []) as Receivable[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  // Summary stats
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const totalAReceber = all
    .filter(r => r.status === "pendente" && r.vencimento >= TODAY)
    .reduce((s, r) => s + r.valor, 0);

  const totalAtrasado = all
    .filter(r => r.status === "pendente" && r.vencimento < TODAY)
    .reduce((s, r) => s + r.valor, 0);

  const totalRecebidoMes = all
    .filter(r => r.status === "pago" && r.pago_em?.startsWith(mesAtual))
    .reduce((s, r) => s + (r.valor_pago ?? r.valor), 0);

  // Filter
  const filtered = all.filter(r => {
    const eff = effectiveStatus(r);
    if (statusFilter !== "todos" && eff !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.descricao.toLowerCase().includes(q) ||
        (r.student_nome?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleFilterChange(f: StatusFilter) {
    setStatusFilter(f);
    setPage(1);
  }

  async function handleCancel(id: string) {
    const { error } = await supabase
      .from("receivables")
      .update({ status: "cancelado" })
      .eq("id", id);
    if (error) { toast.error("Erro ao cancelar."); return; }
    toast.success("Cobrança cancelada.");
    setCancelId(null);
    load();
  }

  const TAB_COUNTS: Record<StatusFilter, number> = {
    todos:     all.length,
    pendente:  all.filter(r => r.status === "pendente" && r.vencimento >= TODAY).length,
    atrasado:  all.filter(r => r.status === "pendente" && r.vencimento < TODAY).length,
    pago:      all.filter(r => r.status === "pago").length,
    cancelado: all.filter(r => r.status === "cancelado").length,
  };

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-900 flex-shrink-0">Contas a receber</h1>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar aluno ou descrição"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => setShowLancar(true)}
                  className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" /> COBRANÇA
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-gray-50">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4 px-8 py-5">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">A receber</p>
                    <p className="text-lg font-bold text-gray-900">{fmtMoeda(totalAReceber)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Em atraso</p>
                    <p className="text-lg font-bold text-red-600">{fmtMoeda(totalAtrasado)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Recebido no mês</p>
                    <p className="text-lg font-bold text-green-600">{fmtMoeda(totalRecebidoMes)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-8 pb-0">
              <div className="bg-white rounded-t-xl border border-gray-200 border-b-0">
                <div className="flex items-center gap-1 px-4 pt-3">
                  {(["todos", "pendente", "atrasado", "pago", "cancelado"] as StatusFilter[]).map(tab => (
                    <button
                      key={tab}
                      onClick={() => handleFilterChange(tab)}
                      className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
                        statusFilter === tab
                          ? "text-primary border-b-2 border-primary"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      {{ todos: "Todos", pendente: "Pendente", atrasado: "Atrasado", pago: "Pago", cancelado: "Cancelado" }[tab]}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        statusFilter === tab ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"
                      }`}>
                        {TAB_COUNTS[tab]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="px-8 pb-8">
              <div className="bg-white rounded-b-xl border border-gray-200 border-t-0 overflow-hidden">
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <CheckCircle className="w-10 h-10 text-gray-200" />
                    <p className="text-sm text-gray-400">
                      {all.length === 0 ? "Nenhuma cobrança lançada ainda." : "Nenhum resultado encontrado."}
                    </p>
                    {all.length === 0 && (
                      <button onClick={() => setShowLancar(true)} className="text-xs font-semibold text-primary hover:underline">
                        Lançar primeira cobrança →
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold">
                          <th className="text-left px-6 py-3">Aluno</th>
                          <th className="text-left px-4 py-3">Descrição</th>
                          <th className="text-left px-4 py-3">Tipo</th>
                          <th className="text-left px-4 py-3">Vencimento</th>
                          <th className="text-right px-4 py-3">Valor</th>
                          <th className="text-left px-4 py-3">Status</th>
                          <th className="px-4 py-3 w-20"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {paginated.map(r => {
                          const eff   = effectiveStatus(r);
                          const badge = STATUS_BADGE[eff];
                          const canPay    = eff !== "pago" && eff !== "cancelado";
                          const canCancel = eff !== "pago" && eff !== "cancelado";
                          return (
                            <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-3 font-medium text-gray-900">
                                {r.student_nome ?? <span className="text-gray-400 text-xs">—</span>}
                              </td>
                              <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">
                                {r.descricao}
                                {r.total_parcelas && (
                                  <span className="ml-1 text-xs text-gray-400">{r.parcela_numero}/{r.total_parcelas}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs">
                                {TIPO_LABEL[r.tipo] ?? r.tipo}
                              </td>
                              <td className={`px-4 py-3 text-xs ${eff === "atrasado" ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                                {fmtData(r.vencimento)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                {fmtMoeda(r.valor)}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 justify-end">
                                  {canPay && (
                                    <button
                                      onClick={() => setPayTarget({
                                        id:              r.id,
                                        descricao:       r.descricao,
                                        valor:           r.valor,
                                        student_nome:    r.student_nome,
                                        forma_pagamento: r.forma_pagamento,
                                      })}
                                      title="Registrar pagamento"
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                  {canCancel && (
                                    <button
                                      onClick={() => setCancelId(r.id)}
                                      title="Cancelar cobrança"
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
                      <span>Página {page} de {totalPages} — {filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={page === 1}
                          onClick={() => setPage(p => p - 1)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          disabled={page === totalPages}
                          onClick={() => setPage(p => p + 1)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </AppLayout>

      {showLancar && (
        <LancarCobrancaModal
          onClose={() => setShowLancar(false)}
          onSaved={load}
        />
      )}

      {payTarget && (
        <RegistrarPagamentoModal
          receivable={payTarget}
          onClose={() => setPayTarget(null)}
          onSaved={load}
        />
      )}

      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Cancelar cobrança?</h3>
            <p className="text-sm text-gray-500 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCancelId(null)} className="text-primary font-semibold text-sm hover:underline px-2">
                CANCELAR
              </button>
              <button
                onClick={() => handleCancel(cancelId)}
                className="bg-red-500 text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
              >
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
