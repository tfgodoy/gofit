import { useState, useEffect } from "react";
import {
  Plus, Search, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Clock,
  X,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type StatusFilter = "todos" | "pendente" | "atrasado" | "pago" | "cancelado";

interface Payable {
  id:              string;
  descricao:       string;
  categoria:       string;
  valor:           number;
  vencimento:      string;
  status:          "pendente" | "pago" | "atrasado" | "cancelado";
  forma_pagamento: string | null;
  valor_pago:      number | null;
  pago_em:         string | null;
  observacoes:     string | null;
  created_at:      string;
}

const TODAY = new Date().toISOString().split("T")[0];

function effectiveStatus(r: Payable): "pendente" | "pago" | "atrasado" | "cancelado" {
  if (r.status === "pendente" && r.vencimento < TODAY) return "atrasado";
  return r.status;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pendente:  { label: "Pendente",  cls: "bg-yellow-100 text-yellow-700" },
  atrasado:  { label: "Atrasado",  cls: "bg-red-100 text-red-600" },
  pago:      { label: "Pago",      cls: "bg-green-100 text-green-700" },
  cancelado: { label: "Cancelado", cls: "bg-gray-100 text-gray-500" },
};

const CATEGORIAS = [
  "Aluguel", "Água", "Energia", "Internet", "Telefone",
  "Salários", "Pró-labore", "Equipamentos", "Manutenção",
  "Marketing", "Contabilidade", "Seguros", "Impostos", "Outros",
];

const FORMAS_PGTO = ["Dinheiro", "PIX", "Débito", "Crédito", "Transferência", "Boleto"];

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("pt-BR");
}

const PAGE_SIZE = 20;

/* ── Lançar/Editar Modal ───────────────────────────────────────────── */
interface PayableForm {
  descricao:   string;
  categoria:   string;
  valor:       string;
  vencimento:  string;
  observacoes: string;
}

function LancarPayableModal({
  onClose,
  onSaved,
  editing,
}: {
  onClose:  () => void;
  onSaved:  () => void;
  editing?: Payable | null;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<PayableForm>({
    descricao:   editing?.descricao   ?? "",
    categoria:   editing?.categoria   ?? "Outros",
    valor:       editing?.valor?.toString().replace(".", ",") ?? "",
    vencimento:  editing?.vencimento  ?? "",
    observacoes: editing?.observacoes ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set(k: keyof PayableForm, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    if (!user?.contractorId) return;
    if (!form.descricao.trim() || !form.valor || !form.vencimento) {
      toast.error("Preencha descrição, valor e vencimento.");
      return;
    }
    const valor = parseFloat(form.valor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    setSaving(true);
    const payload = {
      contractor_id: user.contractorId,
      descricao:     form.descricao.trim(),
      categoria:     form.categoria,
      valor,
      vencimento:    form.vencimento,
      observacoes:   form.observacoes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("payables").update(payload).eq("id", editing.id)
      : await supabase.from("payables").insert(payload);
    if (error) { toast.error("Erro ao salvar."); setSaving(false); return; }
    toast.success(editing ? "Conta atualizada." : "Conta lançada.");
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {editing ? "Editar conta a pagar" : "Lançar conta a pagar"}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição *</label>
            <input
              type="text"
              value={form.descricao}
              onChange={e => set("descricao", e.target.value)}
              placeholder="Ex: Aluguel de fevereiro"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Categoria</label>
              <select
                value={form.categoria}
                onChange={e => set("categoria", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Valor (R$) *</label>
              <input
                type="text"
                value={form.valor}
                onChange={e => set("valor", e.target.value)}
                placeholder="0,00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Vencimento *</label>
            <input
              type="date"
              value={form.vencimento}
              onChange={e => set("vencimento", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={e => set("observacoes", e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-800 px-3 py-2">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? "Salvando..." : editing ? "Salvar" : "Lançar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Registrar Pagamento Modal ─────────────────────────────────────── */
function PagarModal({
  payable,
  onClose,
  onSaved,
}: {
  payable: Payable;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [valorPago, setValorPago] = useState(payable.valor.toString().replace(".", ","));
  const [forma, setForma]         = useState("PIX");
  const [pago_em, setPagoEm]      = useState(TODAY);
  const [saving, setSaving]       = useState(false);

  async function handlePagar() {
    const vp = parseFloat(valorPago.replace(",", "."));
    if (isNaN(vp) || vp <= 0) { toast.error("Valor inválido."); return; }
    setSaving(true);
    const { error } = await supabase.from("payables").update({
      status:          "pago",
      valor_pago:      vp,
      forma_pagamento: forma,
      pago_em,
    }).eq("id", payable.id);
    if (error) { toast.error("Erro ao registrar pagamento."); setSaving(false); return; }
    toast.success("Pagamento registrado.");
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Registrar pagamento</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600 font-medium">{payable.descricao}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Valor pago (R$)</label>
              <input
                type="text"
                value={valorPago}
                onChange={e => setValorPago(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Data do pagamento</label>
              <input
                type="date"
                value={pago_em}
                onChange={e => setPagoEm(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Forma de pagamento</label>
            <select
              value={forma}
              onChange={e => setForma(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {FORMAS_PGTO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-800 px-3 py-2">
            Cancelar
          </button>
          <button
            onClick={handlePagar}
            disabled={saving}
            className="bg-green-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            {saving ? "Salvando..." : "Confirmar pagamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */
export default function ContasPagarPage() {
  const { user } = useAuth();
  const [all, setAll]               = useState<Payable[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [page, setPage]             = useState(1);
  const [showLancar, setShowLancar] = useState(false);
  const [editing, setEditing]       = useState<Payable | null>(null);
  const [payTarget, setPayTarget]   = useState<Payable | null>(null);
  const [cancelId, setCancelId]     = useState<string | null>(null);

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);
    const { data } = await supabase
      .from("payables")
      .select("*")
      .eq("contractor_id", user.contractorId)
      .order("vencimento", { ascending: false });
    setAll((data ?? []) as Payable[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const totalAPagar = all
    .filter(r => r.status === "pendente" && r.vencimento >= TODAY)
    .reduce((s, r) => s + r.valor, 0);

  const totalAtrasado = all
    .filter(r => r.status === "pendente" && r.vencimento < TODAY)
    .reduce((s, r) => s + r.valor, 0);

  const totalPagoMes = all
    .filter(r => r.status === "pago" && r.pago_em?.startsWith(mesAtual))
    .reduce((s, r) => s + (r.valor_pago ?? r.valor), 0);

  const filtered = all.filter(r => {
    const eff = effectiveStatus(r);
    if (statusFilter !== "todos" && eff !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.descricao.toLowerCase().includes(q) || r.categoria.toLowerCase().includes(q);
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
    const { error } = await supabase.from("payables").update({ status: "cancelado" }).eq("id", id);
    if (error) { toast.error("Erro ao cancelar."); return; }
    toast.success("Conta cancelada.");
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
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-900 flex-shrink-0">Contas a pagar</h1>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar descrição ou categoria"
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
                  <Plus className="w-4 h-4" /> + CONTA
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-gray-50">
            <div className="grid grid-cols-3 gap-4 px-8 py-5">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">A pagar</p>
                    <p className="text-lg font-bold text-gray-900">{fmtMoeda(totalAPagar)}</p>
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
                    <p className="text-xs text-gray-500 font-medium">Pago no mês</p>
                    <p className="text-lg font-bold text-green-600">{fmtMoeda(totalPagoMes)}</p>
                  </div>
                </div>
              </div>
            </div>

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
                      {all.length === 0 ? "Nenhuma conta lançada ainda." : "Nenhum resultado encontrado."}
                    </p>
                    {all.length === 0 && (
                      <button onClick={() => setShowLancar(true)} className="text-xs font-semibold text-primary hover:underline">
                        Lançar primeira conta →
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold">
                          <th className="text-left px-6 py-3">Descrição</th>
                          <th className="text-left px-4 py-3">Categoria</th>
                          <th className="text-left px-4 py-3">Vencimento</th>
                          <th className="text-right px-4 py-3">Valor</th>
                          <th className="text-left px-4 py-3">Status</th>
                          <th className="px-4 py-3 w-24"></th>
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
                              <td className="px-6 py-3 font-medium text-gray-900">{r.descricao}</td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{r.categoria}</td>
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
                                      onClick={() => setPayTarget(r)}
                                      title="Registrar pagamento"
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                  {eff !== "pago" && eff !== "cancelado" && (
                                    <button
                                      onClick={() => setEditing(r)}
                                      title="Editar"
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 019 16H7v-2a2 2 0 01.586-1.414z" />
                                      </svg>
                                    </button>
                                  )}
                                  {canCancel && (
                                    <button
                                      onClick={() => setCancelId(r.id)}
                                      title="Cancelar"
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

      {(showLancar || editing) && (
        <LancarPayableModal
          onClose={() => { setShowLancar(false); setEditing(null); }}
          onSaved={load}
          editing={editing}
        />
      )}

      {payTarget && (
        <PagarModal
          payable={payTarget}
          onClose={() => setPayTarget(null)}
          onSaved={load}
        />
      )}

      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Cancelar conta?</h3>
            <p className="text-sm text-gray-500 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCancelId(null)} className="text-primary font-semibold text-sm hover:underline px-2">
                VOLTAR
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
