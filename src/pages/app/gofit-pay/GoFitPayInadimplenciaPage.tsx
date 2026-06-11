/**
 * Fase 12 — GoFit Pay: Inadimplência e régua de cobrança
 * Rota: /app/gofit-pay/inadimplencia
 *
 * Exibe receivables vencidas e não pagas com visibilidade operacional:
 * - Cards de resumo (total em aberto, inadimplentes, sem cobrança, etc.)
 * - Filtros por faixa de atraso, forma de cobrança, com/sem cobrança GoFit Pay
 * - Ações manuais: copiar link, abrir fatura, atualizar status, gerar cobrança
 * - Observações internas por receivable
 *
 * Não envia mensagens automaticamente. Não bloqueia alunos.
 * Não altera ContasReceberPage, VendaWizardPage nem financeiro atual.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft, RefreshCcw, Loader2, AlertTriangle, CreditCard,
  QrCode, FileText, Copy, ExternalLink, ChevronRight,
  Users, Wallet, Clock, AlertCircle, Ban, CheckCircle2,
  MessageSquare, X, Search, Filter, Zap, RotateCcw, Plus,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { GoFitPayService, type OverdueItem, type CollectionSummary } from "@/services/gofit-pay";

/* ─── Helpers ─────────────────────────────────────────────────────── */
function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtD(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("pt-BR");
}

function delayConfig(dias: number): { label: string; badge: string; dot: string } {
  if (dias <= 0)  return { label: "Vence hoje",    badge: "bg-amber-100 text-amber-700",  dot: "bg-amber-400"  };
  if (dias <= 3)  return { label: `${dias}d atraso`, badge: "bg-orange-100 text-orange-700", dot: "bg-orange-400" };
  if (dias <= 7)  return { label: `${dias}d atraso`, badge: "bg-orange-100 text-orange-700", dot: "bg-orange-500" };
  if (dias <= 15) return { label: `${dias}d atraso`, badge: "bg-red-100 text-red-700",    dot: "bg-red-400"    };
  if (dias <= 30) return { label: `${dias}d atraso`, badge: "bg-red-200 text-red-800",    dot: "bg-red-500"    };
  return           { label: `${dias}d atraso`, badge: "bg-red-300 text-red-900 font-bold", dot: "bg-red-700" };
}

const CHARGE_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: "Pendente",   cls: "bg-yellow-100 text-yellow-700" },
  OVERDUE:   { label: "Vencida",    cls: "bg-red-100 text-red-700"       },
  RECEIVED:  { label: "Pago",       cls: "bg-green-100 text-green-700"   },
  CONFIRMED: { label: "Confirmado", cls: "bg-green-100 text-green-700"   },
  CANCELLED: { label: "Cancelado",  cls: "bg-gray-100 text-gray-500"     },
};

const BILLING_ICON: Record<string, React.ElementType> = {
  PIX: QrCode, BOLETO: FileText, CREDIT_CARD: CreditCard,
};

const DELAY_BANDS = [
  { value: "",      label: "Todos"     },
  { value: "0",     label: "Hoje"      },
  { value: "1-3",   label: "1–3 dias"  },
  { value: "4-7",   label: "4–7 dias"  },
  { value: "8-15",  label: "8–15 dias" },
  { value: "16-30", label: "16–30 dias"},
  { value: "30+",   label: "+30 dias"  },
];

/* ─── KPI card ───────────────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, sub, color = "gray", urgent = false }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string; urgent?: boolean;
}) {
  const iconBg  = color === "red" ? "bg-red-100" : color === "amber" ? "bg-amber-100" : color === "blue" ? "bg-blue-100" : "bg-gray-100";
  const iconClr = color === "red" ? "text-red-600" : color === "amber" ? "text-amber-600" : color === "blue" ? "text-blue-600" : "text-gray-500";
  return (
    <div className={`bg-white rounded-2xl border p-5 flex items-start gap-4 ${urgent ? "border-red-200" : "border-gray-100"}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconClr}`} />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className={`text-xl font-black mt-0.5 ${urgent ? "text-red-700" : "text-gray-900"}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Modal: Gerar cobrança para receivable inadimplente ────────── */
function GenerateChargeModal({
  item, onClose, onCreated,
}: { item: OverdueItem; onClose: () => void; onCreated: () => void }) {
  const [billingType, setBillingType] = useState<"PIX" | "BOLETO" | "CREDIT_CARD">("PIX");
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    const res = await GoFitPayService.createRecurringCharges({
      receivable_ids: [item.receivable_id],
      billing_type:   billingType,
    });
    setLoading(false);
    if (!res.success) {
      toast.error(res.error ?? "Erro ao gerar cobrança");
      return;
    }
    const it = res.data?.items?.[0];
    if (it?.status === "created") {
      toast.success("Cobrança gerada com sucesso!");
      setResult("created");
      onCreated();
    } else if (it?.status === "already_exists") {
      toast("Cobrança já existe para esta mensalidade.", { icon: "ℹ️" });
      setResult("already_exists");
    } else {
      toast.error(it?.reason ?? "Não foi possível gerar a cobrança.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-black text-gray-900">Gerar cobrança</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5">
          <p className="text-xs text-gray-500 mb-1">Aluno</p>
          <p className="text-sm font-semibold text-gray-800 mb-1">{item.student_nome ?? "—"}</p>
          <p className="text-xs text-gray-400 mb-4">{item.descricao ?? "—"} · Venc. {fmtD(item.vencimento)} · <strong>{fmt(item.valor)}</strong></p>

          {result ? (
            <div className="flex items-center gap-2 py-3 text-sm font-semibold text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              {result === "created" ? "Cobrança gerada!" : "Cobrança já existente."}
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-gray-700 mb-2">Forma de cobrança</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {(["PIX","BOLETO","CREDIT_CARD"] as const).map(bt => {
                  const Icon = BILLING_ICON[bt];
                  return (
                    <button key={bt} onClick={() => setBillingType(bt)}
                      className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                        billingType === bt ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}>
                      <Icon className="w-4 h-4" />
                      {bt === "CREDIT_CARD" ? "Cartão" : bt === "BOLETO" ? "Boleto" : "Pix"}
                    </button>
                  );
                })}
              </div>
              <button onClick={handleCreate} disabled={loading}
                className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {loading ? "Gerando..." : "Gerar cobrança"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Modal: Observação interna ─────────────────────────────────── */
function NoteModal({ item, onClose }: { item: OverdueItem; onClose: () => void }) {
  const [notes,   setNotes]   = useState<Array<{ id: string; note: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [text,    setText]    = useState("");
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    GoFitPayService.getCollectionNotes(item.receivable_id).then(r => {
      if (r.success && r.data) setNotes(r.data.notes);
      setLoading(false);
    });
  }, [item.receivable_id]);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    const res = await GoFitPayService.addCollectionNote(item.receivable_id, text.trim());
    setSaving(false);
    if (!res.success) { toast.error("Erro ao salvar observação."); return; }
    setNotes(prev => [res.data!.note, ...prev]);
    setText("");
    toast.success("Observação salva.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-sm font-black text-gray-900">Observações internas</h2>
            <p className="text-xs text-gray-400">{item.student_nome ?? "—"} · {item.descricao ?? "—"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-6 text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /></div>
          ) : notes.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Nenhuma observação ainda.</p>
          ) : (
            <div className="space-y-3">
              {notes.map(n => (
                <div key={n.id} className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{n.note}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleDateString("pt-BR", { day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit" })}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-6 pb-5 pt-2 flex-shrink-0 border-t border-gray-100">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Adicionar observação interna (máx. 500 caracteres)..."
            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-primary/50 mb-2"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{text.length}/500</span>
            <button onClick={handleSave} disabled={saving || !text.trim()}
              className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function GoFitPayInadimplenciaPage() {
  const navigate = useNavigate();

  const [summary,  setSummary]  = useState<CollectionSummary | null>(null);
  const [items,    setItems]    = useState<OverdueItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [syncing,  setSyncing]  = useState<string | null>(null);

  // Filters (client-side over loaded data)
  const [search,      setSearch]      = useState("");
  const [delayBand,   setDelayBand]   = useState("");
  const [billingFil,  setBillingFil]  = useState("");
  const [chargeFil,   setChargeFil]   = useState<"all" | "with" | "without">("all");

  // Modals
  const [chargeModal, setChargeModal] = useState<OverdueItem | null>(null);
  const [noteModal,   setNoteModal]   = useState<OverdueItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await GoFitPayService.getCollectionOverview({ limit: 150 });
    if (res.success && res.data) {
      setSummary(res.data.summary);
      setItems(res.data.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Client-side filtering
  const filtered = items.filter(item => {
    if (search) {
      const q = search.toLowerCase();
      if (!item.student_nome?.toLowerCase().includes(q) &&
          !item.descricao?.toLowerCase().includes(q)) return false;
    }
    if (delayBand) {
      const d = item.dias_em_atraso;
      if (delayBand === "0"     && d !== 0)               return false;
      if (delayBand === "1-3"   && !(d >= 1  && d <= 3))  return false;
      if (delayBand === "4-7"   && !(d >= 4  && d <= 7))  return false;
      if (delayBand === "8-15"  && !(d >= 8  && d <= 15)) return false;
      if (delayBand === "16-30" && !(d >= 16 && d <= 30)) return false;
      if (delayBand === "30+"   && d <= 30)                return false;
    }
    if (billingFil && item.billing_type !== billingFil) return false;
    if (chargeFil === "with"    && item.charge_id === null) return false;
    if (chargeFil === "without" && item.charge_id !== null) return false;
    return true;
  });

  async function handleSyncStatus(item: OverdueItem) {
    if (!item.charge_id) return;
    setSyncing(item.charge_id);
    const res = await GoFitPayService.syncChargeStatus(item.charge_id);
    setSyncing(null);
    if (res.success) {
      toast.success("Status atualizado.");
      loadData();
    } else {
      toast.error(res.error ?? "Erro ao atualizar.");
    }
  }

  function copyToClipboard(text: string, label = "Copiado!") {
    navigator.clipboard.writeText(text).then(() => toast.success(label)).catch(() => toast.error("Não foi possível copiar."));
  }

  function copyMessage(item: OverdueItem) {
    const link = item.invoice_url ?? item.bank_slip_url ?? "";
    const msg = `Olá, ${item.student_nome ?? ""}. Identificamos uma mensalidade em aberto no valor de ${fmt(item.valor)}, vencida em ${fmtD(item.vencimento)}. Você pode regularizar pelo link: ${link}`;
    copyToClipboard(msg, "Mensagem copiada!");
  }

  return (
    <AppLayout>
      {chargeModal && (
        <GenerateChargeModal
          item={chargeModal}
          onClose={() => setChargeModal(null)}
          onCreated={() => { setChargeModal(null); loadData(); }}
        />
      )}
      {noteModal && (
        <NoteModal item={noteModal} onClose={() => setNoteModal(null)} />
      )}

      <div className="flex flex-col min-h-full bg-gray-50">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/app/gofit-pay")}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-400">GoFit Pay</span>
              <ChevronRight className="w-3 h-3 text-gray-300" />
              <span className="text-xs font-semibold text-gray-700">Inadimplência</span>
            </div>
            <button onClick={loadData} disabled={loading}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
              <RefreshCcw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </button>
          </div>
        </div>

        <div className="flex-1 px-8 py-6 max-w-7xl mx-auto w-full">

          {loading && !summary ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 justify-center mt-20">
              <Loader2 className="w-5 h-5 animate-spin" /> Carregando inadimplência...
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                <KpiCard icon={Wallet}       label="Total em aberto"       value={fmt(summary?.total_amount_open ?? 0)} color="red" urgent />
                <KpiCard icon={Users}        label="Alunos inadimplentes"  value={String(summary?.students_count ?? 0)} sub="com mensalidade vencida" />
                <KpiCard icon={AlertCircle}  label="Mensalidades vencidas" value={String(summary?.overdue_count ?? 0)} />
                <KpiCard icon={Clock}        label="+30 dias em atraso"    value={String(summary?.overdue_30_plus ?? 0)} color="red" />
                <KpiCard icon={Ban}          label="Sem cobrança emitida"  value={String(summary?.without_charge ?? 0)} color="amber" />
                <KpiCard icon={CreditCard}   label="Com cobrança ativa"    value={String(summary?.with_active_charge ?? 0)} color="blue" />
              </div>

              {/* Filters */}
              <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 mb-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar aluno ou descrição..."
                      className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-primary/50"
                    />
                  </div>

                  {/* Delay band chips */}
                  <div className="flex flex-wrap gap-1">
                    {DELAY_BANDS.map(b => (
                      <button key={b.value} onClick={() => setDelayBand(delayBand === b.value ? "" : b.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          delayBand === b.value
                            ? "bg-red-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}>
                        {b.label}
                      </button>
                    ))}
                  </div>

                  {/* Billing type */}
                  <select value={billingFil} onChange={e => setBillingFil(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/50">
                    <option value="">Todas as formas</option>
                    <option value="PIX">Pix</option>
                    <option value="BOLETO">Boleto</option>
                    <option value="CREDIT_CARD">Cartão</option>
                  </select>

                  {/* Has charge */}
                  <select value={chargeFil} onChange={e => setChargeFil(e.target.value as "all"|"with"|"without")}
                    className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/50">
                    <option value="all">Todas</option>
                    <option value="with">Com cobrança GoFit Pay</option>
                    <option value="without">Sem cobrança GoFit Pay</option>
                  </select>

                  <span className="text-xs text-gray-400 ml-auto">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <CheckCircle2 className="w-10 h-10 text-green-400" />
                    <p className="text-sm font-bold text-gray-600">Nenhuma inadimplência encontrada</p>
                    <p className="text-xs text-gray-400">
                      {items.length > 0 ? "Nenhum resultado com os filtros atuais." : "Não há receivables vencidas em aberto."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-50">
                          {["Aluno / Descrição","Vencimento","Atraso","Valor","Status Gateway","Ações"].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filtered.map(item => {
                          const dc  = delayConfig(item.dias_em_atraso);
                          const cs  = item.charge_status ? (CHARGE_STATUS_LABEL[item.charge_status] ?? { label: item.charge_status, cls: "bg-gray-100 text-gray-500" }) : null;
                          const BIcon = item.billing_type ? BILLING_ICON[item.billing_type] : null;
                          const isSyncing = syncing === item.charge_id;
                          return (
                            <tr key={item.receivable_id} className="hover:bg-gray-50/50 transition-colors">
                              {/* Aluno / Descrição */}
                              <td className="px-5 py-3.5">
                                <p className="text-xs font-semibold text-gray-800 truncate max-w-[180px]">{item.student_nome ?? "—"}</p>
                                <p className="text-xs text-gray-400 truncate max-w-[180px]">{item.descricao ?? "—"}</p>
                              </td>

                              {/* Vencimento */}
                              <td className="px-5 py-3.5 whitespace-nowrap">
                                <p className="text-xs text-gray-700">{fmtD(item.vencimento)}</p>
                              </td>

                              {/* Atraso */}
                              <td className="px-5 py-3.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${dc.badge}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${dc.dot}`} />
                                  {dc.label}
                                </span>
                              </td>

                              {/* Valor */}
                              <td className="px-5 py-3.5 whitespace-nowrap">
                                <p className="text-xs font-bold text-gray-900">{fmt(item.valor)}</p>
                              </td>

                              {/* Status gateway */}
                              <td className="px-5 py-3.5">
                                {item.charge_id ? (
                                  <div className="flex flex-col gap-1">
                                    {cs && (
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${cs.cls}`}>
                                        {BIcon && <BIcon className="w-3 h-3" />}
                                        {cs.label}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">Sem cobrança emitida</span>
                                )}
                              </td>

                              {/* Ações */}
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-1 flex-wrap">
                                  {!item.charge_id && (
                                    <button
                                      onClick={() => setChargeModal(item)}
                                      title="Gerar cobrança"
                                      className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {item.charge_id && (
                                    <button
                                      onClick={() => handleSyncStatus(item)}
                                      title="Atualizar status"
                                      disabled={isSyncing}
                                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-50"
                                    >
                                      {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                    </button>
                                  )}

                                  {item.pix_copy_paste && (
                                    <button
                                      onClick={() => copyToClipboard(item.pix_copy_paste!, "Pix copiado!")}
                                      title="Copiar Pix copia e cola"
                                      className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition-colors"
                                    >
                                      <QrCode className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {(item.invoice_url || item.bank_slip_url) && (
                                    <>
                                      <button
                                        onClick={() => copyToClipboard(item.invoice_url ?? item.bank_slip_url!, "Link copiado!")}
                                        title="Copiar link"
                                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      <a
                                        href={item.invoice_url ?? item.bank_slip_url!}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="Abrir fatura"
                                        className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-500 transition-colors"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    </>
                                  )}

                                  {(item.invoice_url || item.bank_slip_url) && item.student_nome && (
                                    <button
                                      onClick={() => copyMessage(item)}
                                      title="Copiar mensagem para aluno"
                                      className="p-1.5 rounded-lg hover:bg-indigo-100 text-indigo-500 transition-colors"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  <button
                                    onClick={() => setNoteModal(item)}
                                    title="Observações internas"
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Disclaimer */}
              <p className="text-xs text-gray-400 mt-4 text-center">
                Esta tela é operacional e informativa. Não envia mensagens automaticamente nem bloqueia alunos.
              </p>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
