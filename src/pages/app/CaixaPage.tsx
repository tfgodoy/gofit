import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { useState, useEffect } from "react";
import {
  Wallet, ChevronLeft, ChevronRight, Plus, Minus,
  Lock, Unlock, X, ChevronDown,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const INP = "w-full bg-transparent border-0 border-b border-gray-300 py-2 px-0 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-b-2 focus:border-primary transition-colors";

interface CashSession {
  id:                     string;
  status:                 "aberto" | "fechado";
  saldo_inicial:          number;
  saldo_final:            number | null;
  total_entradas:         number;
  total_saidas:           number;
  observacoes_abertura:   string | null;
  observacoes_fechamento: string | null;
  opened_at:              string;
  closed_at:              string | null;
}

interface Transaction {
  id:              string;
  tipo:            "entrada" | "saida";
  descricao:       string;
  valor:           number;
  data:            string;
  forma_pagamento: string | null;
  student_nome:    string | null;
  categoria:       string | null;
  cash_session_id: string | null;
  created_at:      string;
}

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}


const FORMAS_LABEL: Record<string, string> = {
  dinheiro:       "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito:  "Cartão de débito",
  pix:            "PIX",
  boleto:         "Boleto",
  transferencia:  "Transferência",
};

const PAGE_SIZE = 20;

export default function CaixaPage() {
  const { user } = useAuth();
  const [openSession, setOpenSession] = useState<CashSession | null>(null);
  const [history, setHistory]         = useState<CashSession[]>([]);
  const [movements, setMovements]     = useState<Transaction[]>([]);
  const [loading, setLoading]         = useState(true);
  const [page, setPage]               = useState(1);

  const [showAbrirModal, setShowAbrirModal]   = useState(false);
  const [showFecharModal, setShowFecharModal] = useState(false);
  const [showLancarSaida, setShowLancarSaida] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // Abrir caixa form
  const [abrirForm, setAbrirForm] = useState({ saldo_inicial: "0,00", observacoes: "" });
  const [savingAbrir, setSavingAbrir] = useState(false);

  // Fechar caixa form
  const [fecharForm, setFecharForm] = useState({ saldo_final: "0,00", observacoes: "" });
  const [savingFechar, setSavingFechar] = useState(false);

  // Lançar saída form
  const [saidaForm, setSaidaForm] = useState({
    descricao: "", valor: "", categoria: "", forma_pagamento: "dinheiro", observacoes: "",
  });
  const [savingSaida, setSavingSaida] = useState(false);

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);

    const [{ data: sessoes }, { data: txs }] = await Promise.all([
      supabase.from("cash_sessions").select("*").eq("contractor_id", user.contractorId).order("opened_at", { ascending: false }),
      supabase.from("transactions").select("*").eq("contractor_id", user.contractorId).order("created_at", { ascending: false }).limit(200),
    ]);

    const all = (sessoes ?? []) as CashSession[];
    const open = all.find(s => s.status === "aberto") ?? null;
    setOpenSession(open);
    setHistory(all.filter(s => s.status === "fechado"));
    setMovements((txs ?? []) as Transaction[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  async function handleAbrir() {
    if (!user?.contractorId) return;
    const saldo = parseFloat(abrirForm.saldo_inicial.replace(",", ".")) || 0;
    setSavingAbrir(true);
    const { error } = await supabase.from("cash_sessions").insert({
      contractor_id:        user.contractorId,
      saldo_inicial:        saldo,
      observacoes_abertura: abrirForm.observacoes || null,
      status:               "aberto",
    });
    setSavingAbrir(false);
    if (error) { toast.error("Erro ao abrir caixa."); return; }
    toast.success("Caixa aberto.");
    setShowAbrirModal(false);
    setAbrirForm({ saldo_inicial: "0,00", observacoes: "" });
    load();
  }

  async function handleFechar() {
    if (!openSession) return;
    const saldo = parseFloat(fecharForm.saldo_final.replace(",", ".")) || 0;
    setSavingFechar(true);
    const { error } = await supabase.from("cash_sessions").update({
      status:                 "fechado",
      saldo_final:            saldo,
      observacoes_fechamento: fecharForm.observacoes || null,
      closed_at:              new Date().toISOString(),
    }).eq("id", openSession.id);
    setSavingFechar(false);
    if (error) { toast.error("Erro ao fechar caixa."); return; }
    toast.success("Caixa fechado.");
    setShowFecharModal(false);
    setFecharForm({ saldo_final: "0,00", observacoes: "" });
    load();
  }

  async function handleLancarSaida() {
    if (!user?.contractorId || !openSession) return;
    if (!saidaForm.descricao.trim()) { toast.error("Informe a descrição."); return; }
    const valor = parseFloat(saidaForm.valor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) { toast.error("Informe um valor válido."); return; }

    setSavingSaida(true);
    const { error } = await supabase.from("transactions").insert({
      contractor_id:   user.contractorId,
      tipo:            "saida",
      descricao:       saidaForm.descricao,
      valor,
      categoria:       saidaForm.categoria || null,
      forma_pagamento: saidaForm.forma_pagamento,
      cash_session_id: openSession.id,
      observacoes:     saidaForm.observacoes || null,
      data:            new Date().toISOString().split("T")[0],
    });
    setSavingSaida(false);
    if (error) { toast.error("Erro ao lançar saída."); return; }
    toast.success("Saída lançada.");
    setShowLancarSaida(false);
    setSaidaForm({ descricao: "", valor: "", categoria: "", forma_pagamento: "dinheiro", observacoes: "" });
    load();
  }

  const sessionMovements = openSession
    ? movements.filter(t => t.cash_session_id === openSession.id)
    : [];

  const saldoAtual = openSession
    ? openSession.saldo_inicial + openSession.total_entradas - openSession.total_saidas
    : 0;

  const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const paginatedHistory = history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold text-gray-900">Caixa</h1>
              {!loading && (
                openSession ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowLancarSaida(true)}
                      className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-sm font-semibold px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Minus className="w-4 h-4" /> Lançar saída
                    </button>
                    <button
                      onClick={() => {
                        setFecharForm({ saldo_final: saldoAtual.toFixed(2).replace(".", ","), observacoes: "" });
                        setShowFecharModal(true);
                      }}
                      className="inline-flex items-center gap-2 bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                    >
                      <Lock className="w-4 h-4" /> FECHAR CAIXA
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAbrirModal(true)}
                    className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Unlock className="w-4 h-4" /> ABRIR CAIXA
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-gray-50 p-8 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Open session card */}
                {openSession ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Caixa aberto</p>
                        <p className="text-xs text-gray-500">Desde {fmtDateTime(openSession.opened_at)}</p>
                      </div>
                      <span className="ml-auto text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Aberto</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Saldo inicial</p>
                        <p className="text-base font-bold text-gray-900">{fmtMoeda(openSession.saldo_inicial)}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Entradas</p>
                        <p className="text-base font-bold text-green-700">{fmtMoeda(openSession.total_entradas)}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Saídas</p>
                        <p className="text-base font-bold text-red-600">{fmtMoeda(openSession.total_saidas)}</p>
                      </div>
                      <div className="bg-primary/5 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Saldo atual</p>
                        <p className="text-base font-bold text-primary">{fmtMoeda(saldoAtual)}</p>
                      </div>
                    </div>

                    {/* Movements */}
                    {sessionMovements.length > 0 && (
                      <div className="mt-5">
                        <p className="text-xs font-semibold text-gray-500 mb-2">Movimentações desta sessão</p>
                        <div className="divide-y divide-gray-50">
                          {sessionMovements.map(t => (
                            <div key={t.id} className="flex items-center gap-3 py-2.5">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${t.tipo === "entrada" ? "bg-green-100" : "bg-red-100"}`}>
                                {t.tipo === "entrada"
                                  ? <Plus className="w-3.5 h-3.5 text-green-600" />
                                  : <Minus className="w-3.5 h-3.5 text-red-500" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900 font-medium truncate">{t.descricao}</p>
                                {t.student_nome && <p className="text-xs text-gray-400">{t.student_nome}</p>}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className={`text-sm font-semibold ${t.tipo === "entrada" ? "text-green-600" : "text-red-500"}`}>
                                  {t.tipo === "entrada" ? "+" : "−"}{fmtMoeda(t.valor)}
                                </p>
                                {t.forma_pagamento && <p className="text-xs text-gray-400">{FORMAS_LABEL[t.forma_pagamento] ?? t.forma_pagamento}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-10 flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
                      <Wallet className="w-7 h-7 text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">Nenhum caixa aberto</p>
                    <p className="text-xs text-gray-400">Abra o caixa para registrar movimentações financeiras.</p>
                    <button
                      onClick={() => setShowAbrirModal(true)}
                      className="mt-2 bg-primary text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      Abrir caixa
                    </button>
                  </div>
                )}

                {/* History */}
                {history.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h2 className="text-sm font-bold text-gray-700">Histórico de caixas</h2>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold">
                          <th className="w-8 px-3 py-3" />
                          <th className="text-left px-3 py-3">Abertura</th>
                          <th className="text-left px-3 py-3">Fechamento</th>
                          <th className="text-right px-3 py-3">Saldo inicial</th>
                          <th className="text-right px-3 py-3">Entradas</th>
                          <th className="text-right px-3 py-3">Saídas</th>
                          <th className="text-right px-3 py-3">Saldo final</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedHistory.map(s => {
                          const sessionTxs = movements.filter(t => t.cash_session_id === s.id);
                          const isExpanded = expandedSession === s.id;
                          return (
                            <>
                              <tr
                                key={s.id}
                                onClick={() => setExpandedSession(isExpanded ? null : s.id)}
                                className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                              >
                                <td className="px-3 py-3 text-gray-400">
                                  <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                </td>
                                <td className="px-3 py-3 text-gray-700">{fmtDateTime(s.opened_at)}</td>
                                <td className="px-3 py-3 text-gray-600">{s.closed_at ? fmtDateTime(s.closed_at) : "—"}</td>
                                <td className="px-3 py-3 text-right text-gray-700">{fmtMoeda(s.saldo_inicial)}</td>
                                <td className="px-3 py-3 text-right text-green-600 font-medium">{fmtMoeda(s.total_entradas)}</td>
                                <td className="px-3 py-3 text-right text-red-500 font-medium">{fmtMoeda(s.total_saidas)}</td>
                                <td className="px-3 py-3 text-right font-bold text-gray-900">{fmtMoeda(s.saldo_final ?? 0)}</td>
                              </tr>

                              {/* Expansão: movimentações da sessão */}
                              {isExpanded && (
                                <tr key={`${s.id}-detail`} className="bg-gray-50 border-b border-gray-100">
                                  <td colSpan={7} className="px-8 py-3">
                                    {sessionTxs.length === 0 ? (
                                      <p className="text-xs text-gray-400 italic py-1">
                                        Nenhuma movimentação registrada nesta sessão.
                                      </p>
                                    ) : (
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="text-gray-400 font-semibold border-b border-gray-200">
                                            <th className="text-left py-1.5">Descrição</th>
                                            <th className="text-left py-1.5">Cliente</th>
                                            <th className="text-left py-1.5">Data</th>
                                            <th className="text-left py-1.5">Forma</th>
                                            <th className="text-left py-1.5">Categoria</th>
                                            <th className="text-right py-1.5">Valor</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {sessionTxs.map(t => (
                                            <tr key={t.id}>
                                              <td className="py-1.5 text-gray-700 font-medium">{t.descricao || "—"}</td>
                                              <td className="py-1.5 text-gray-500">{t.student_nome || "—"}</td>
                                              <td className="py-1.5 text-gray-500 whitespace-nowrap">
                                                {t.data ? new Date(t.data + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                                              </td>
                                              <td className="py-1.5 text-gray-500">
                                                {t.forma_pagamento ? (FORMAS_LABEL[t.forma_pagamento] ?? t.forma_pagamento) : "—"}
                                              </td>
                                              <td className="py-1.5 text-gray-400">{t.categoria || "—"}</td>
                                              <td className={`py-1.5 text-right font-semibold whitespace-nowrap ${t.tipo === "entrada" ? "text-green-600" : "text-red-500"}`}>
                                                {t.tipo === "entrada" ? "+" : "−"}{fmtMoeda(t.valor)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
                        <span>Página {page} de {totalPages}</span>
                        <div className="flex items-center gap-1">
                          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </AppLayout>

      {/* Abrir caixa modal */}
      {showAbrirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Abrir caixa</h2>
              <button onClick={() => setShowAbrirModal(false)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Saldo inicial (R$)</label>
                <input className={INP} value={abrirForm.saldo_inicial} onChange={e => setAbrirForm(f => ({ ...f, saldo_inicial: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Observações</label>
                <input className={INP} placeholder="Opcional" value={abrirForm.observacoes} onChange={e => setAbrirForm(f => ({ ...f, observacoes: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowAbrirModal(false)} className="text-primary font-semibold text-sm hover:underline px-2">CANCELAR</button>
              <button
                onClick={handleAbrir}
                disabled={savingAbrir}
                className="bg-primary text-white font-semibold text-sm px-5 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {savingAbrir ? "Abrindo..." : "ABRIR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fechar caixa modal */}
      {showFecharModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Fechar caixa</h2>
              <button onClick={() => setShowFecharModal(false)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Saldo inicial</p>
                  <p className="font-semibold text-gray-900">{fmtMoeda(openSession?.saldo_inicial ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Saldo esperado</p>
                  <p className="font-semibold text-primary">{fmtMoeda(saldoAtual)}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Saldo final (R$)</label>
                <input className={INP} value={fecharForm.saldo_final} onChange={e => setFecharForm(f => ({ ...f, saldo_final: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Observações</label>
                <input className={INP} placeholder="Opcional" value={fecharForm.observacoes} onChange={e => setFecharForm(f => ({ ...f, observacoes: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowFecharModal(false)} className="text-primary font-semibold text-sm hover:underline px-2">CANCELAR</button>
              <button
                onClick={handleFechar}
                disabled={savingFechar}
                className="bg-red-500 text-white font-semibold text-sm px-5 py-2 rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {savingFechar ? "Fechando..." : "FECHAR CAIXA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lançar saída modal */}
      {showLancarSaida && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Lançar saída</h2>
              <button onClick={() => setShowLancarSaida(false)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição *</label>
                <input className={INP} placeholder="Ex: Aluguel, Limpeza..." value={saidaForm.descricao} onChange={e => setSaidaForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Valor (R$) *</label>
                  <CurrencyInput className={INP} placeholder="0,00" value={saidaForm.valor} onChange={v => setSaidaForm(f => ({ ...f, valor: v }))} />
                </div>
                <div className="relative">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Forma de pagamento</label>
                  <select
                    className="w-full bg-transparent border-0 border-b border-gray-300 py-2 px-0 pr-6 text-sm text-gray-900 outline-none appearance-none focus:border-b-2 focus:border-primary transition-colors cursor-pointer"
                    value={saidaForm.forma_pagamento}
                    onChange={e => setSaidaForm(f => ({ ...f, forma_pagamento: e.target.value }))}
                  >
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao_credito">Cartão de crédito</option>
                    <option value="cartao_debito">Cartão de débito</option>
                    <option value="pix">PIX</option>
                    <option value="transferencia">Transferência</option>
                  </select>
                  <ChevronDown className="absolute right-0 bottom-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Categoria</label>
                <input className={INP} placeholder="Ex: Despesa fixa, Manutenção..." value={saidaForm.categoria} onChange={e => setSaidaForm(f => ({ ...f, categoria: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Observações</label>
                <input className={INP} placeholder="Opcional" value={saidaForm.observacoes} onChange={e => setSaidaForm(f => ({ ...f, observacoes: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowLancarSaida(false)} className="text-primary font-semibold text-sm hover:underline px-2">CANCELAR</button>
              <button
                onClick={handleLancarSaida}
                disabled={savingSaida}
                className="bg-primary text-white font-semibold text-sm px-5 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {savingSaida ? "Lançando..." : "LANÇAR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
