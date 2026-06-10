/**
 * Fase 6 — GoFit Pay: Emissão de cobranças Pix/Boleto
 * Rota: /app/gofit-pay/cobrancas
 *
 * - Lista receivables pendentes/atrasadas/aguardando
 * - Botão "Gerar cobrança GoFit Pay" por receivable
 * - Modal: escolha Pix ou Boleto
 * - Exibe QR code (Pix) ou link/código de barras (Boleto)
 * - Idempotência: já cobradas exibem o link existente
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate }                       from "react-router-dom";
import {
  QrCode, FileText, CreditCard, ArrowLeft, RefreshCcw,
  Loader2, CheckCircle2, AlertCircle, ChevronRight,
  Copy, ExternalLink, X, Zap, Clock,
} from "lucide-react";
import AppLayout                      from "@/components/app/AppLayout";
import { supabase }                   from "@/integrations/supabase/client";
import { useAuth }                    from "@/contexts/AuthContext";
import { GoFitPayService }            from "@/services/gofit-pay";
import type { CreateChargePayload }   from "@/services/gofit-pay/types";

/* ─── Tipos ──────────────────────────────────────────────────────────── */
interface Receivable {
  id:                  string;
  student_id:          string | null;
  student_contract_id: string | null;
  valor:               number;
  vencimento:          string;
  descricao:           string | null;
  status:              string;
  asaas_payment_id:    string | null;
  gateway_provider:    string | null;
  student_name?:       string;
}

interface ChargeResult {
  charge_id:          string;
  provider_charge_id: string;
  billing_type:       string;
  status:             string;
  amount:             number;
  due_date:           string;
  invoice_url:        string | null;
  bank_slip_url:      string | null;
  pix_qr_code:        string | null;
  pix_copy_paste:     string | null;
  already_existed:    boolean;
  message:            string;
}

/* ─── Helpers de formatação ──────────────────────────────────────────── */
function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  return d.toLocaleDateString("pt-BR");
}

function statusLabel(s: string): { label: string; cls: string } {
  if (s === "pendente")   return { label: "Pendente",   cls: "bg-yellow-100 text-yellow-700" };
  if (s === "atrasado")   return { label: "Atrasado",   cls: "bg-red-100 text-red-700"       };
  if (s === "aguardando") return { label: "Aguardando", cls: "bg-blue-100 text-blue-700"     };
  return { label: s, cls: "bg-gray-100 text-gray-600" };
}

/* ─── Modal de resultado ─────────────────────────────────────────────── */
function ChargeResultModal({
  result,
  onClose,
}: {
  result: ChargeResult;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isPix    = result.billing_type === "PIX";
  const isBoleto = result.billing_type === "BOLETO";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className={`px-6 py-5 ${isPix ? "bg-green-50" : "bg-blue-50"} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isPix ? "bg-green-100" : "bg-blue-100"}`}>
              {isPix
                ? <QrCode    className="w-5 h-5 text-green-600" />
                : <FileText  className="w-5 h-5 text-blue-600" />
              }
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {isPix ? "Cobrança Pix" : "Boleto Bancário"}
              </p>
              <p className="text-lg font-black text-gray-900">{formatCurrency(result.amount)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/10 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Status badge */}
        <div className="px-6 pt-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-xs font-bold text-green-700">
            {result.already_existed ? "Cobrança já existente" : "Cobrança criada com sucesso"}
          </span>
          <span className="ml-auto text-xs text-gray-400">Vcto: {formatDate(result.due_date)}</span>
        </div>

        <div className="px-6 pb-6 space-y-4 mt-4">

          {/* QR Code (Pix) */}
          {isPix && result.pix_qr_code && (
            <div className="flex flex-col items-center gap-3">
              <img
                src={`data:image/png;base64,${result.pix_qr_code}`}
                alt="QR Code Pix"
                className="w-48 h-48 rounded-xl border border-gray-200"
              />
              {result.pix_copy_paste && (
                <button
                  onClick={() => copy(result.pix_copy_paste!)}
                  className="flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700"
                >
                  {copied
                    ? <><CheckCircle2 className="w-4 h-4 text-green-500" /> Copiado!</>
                    : <><Copy className="w-4 h-4" /> Copiar Pix Copia e Cola</>
                  }
                </button>
              )}
            </div>
          )}

          {/* Boleto */}
          {isBoleto && (
            <div className="flex flex-col gap-3">
              {result.bank_slip_url && (
                <a
                  href={result.bank_slip_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors text-sm font-bold text-white"
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir boleto
                </a>
              )}
            </div>
          )}

          {/* Link da fatura (ambos) */}
          {result.invoice_url && (
            <a
              href={result.invoice_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir link de pagamento
            </a>
          )}

          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-semibold text-gray-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal de escolha de método ─────────────────────────────────────── */
function BillingTypeModal({
  receivable,
  onConfirm,
  onClose,
}: {
  receivable: Receivable;
  onConfirm: (billingType: "PIX" | "BOLETO") => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<"PIX" | "BOLETO" | null>(null);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">

        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">Gerar cobrança</p>
            <p className="text-base font-black text-gray-900">
              {formatCurrency(receivable.valor)}
            </p>
            {receivable.student_name && (
              <p className="text-xs text-gray-500 mt-0.5">{receivable.student_name}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Escolha a forma de pagamento
          </p>

          {([
            { type: "PIX"    as const, icon: QrCode,   label: "Pix",             desc: "Confirmação imediata", color: "border-green-200 bg-green-50 text-green-700" },
            { type: "BOLETO" as const, icon: FileText,  label: "Boleto",          desc: "Prazo de 3 dias úteis", color: "border-blue-200 bg-blue-50 text-blue-700"   },
          ]).map(({ type, icon: Icon, label, desc, color }) => (
            <button
              key={type}
              onClick={() => setSelected(type)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                selected === type
                  ? color + " shadow-sm"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${selected === type ? "" : "text-gray-400"}`} />
              <div className="flex-1">
                <p className={`text-sm font-bold ${selected === type ? "" : "text-gray-700"}`}>{label}</p>
                <p className={`text-xs ${selected === type ? "opacity-75" : "text-gray-400"}`}>{desc}</p>
              </div>
              {selected === type && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
            </button>
          ))}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-600"
          >
            Cancelar
          </button>
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 transition-colors text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Gerar cobrança
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function GoFitPayCobrancasPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [receivables,     setReceivables]     = useState<Receivable[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [moduleActive,    setModuleActive]    = useState<boolean | null>(null);

  const [selectedRcv,     setSelectedRcv]     = useState<Receivable | null>(null);
  const [generatingId,    setGeneratingId]    = useState<string | null>(null);
  const [chargeResult,    setChargeResult]    = useState<ChargeResult | null>(null);
  const [chargeError,     setChargeError]     = useState<string | null>(null);

  const loadReceivables = useCallback(async () => {
    if (!user?.contractorId) return;
    setLoading(true);

    // Verifica módulo ativo
    const { data: mod } = await supabase
      .from("modules")
      .select("id")
      .eq("slug", "gofit_pay")
      .maybeSingle();

    if (mod) {
      const { data: cm } = await supabase
        .from("company_modules")
        .select("status")
        .eq("contractor_id", user.contractorId)
        .eq("module_id", mod.id)
        .maybeSingle();
      setModuleActive(cm?.status === "active");
    } else {
      setModuleActive(false);
    }

    // Busca receivables pendentes
    const { data: rcvData } = await supabase
      .from("receivables")
      .select("id, student_id, student_contract_id, valor, vencimento, descricao, status, asaas_payment_id, gateway_provider")
      .eq("contractor_id", user.contractorId)
      .in("status", ["pendente", "atrasado", "aguardando"])
      .order("vencimento", { ascending: true })
      .limit(100);

    if (!rcvData?.length) {
      setReceivables([]);
      setLoading(false);
      return;
    }

    // Busca nomes dos alunos (em batch)
    const studentIds = [...new Set(rcvData.map(r => r.student_id).filter(Boolean))] as string[];
    let studentMap: Record<string, string> = {};

    if (studentIds.length > 0) {
      const { data: students } = await supabase
        .from("students")
        .select("id, nome_completo")
        .in("id", studentIds);
      if (students) {
        studentMap = Object.fromEntries(students.map(s => [s.id, s.nome_completo]));
      }
    }

    setReceivables(
      rcvData.map(r => ({
        ...r,
        student_name: r.student_id ? (studentMap[r.student_id] ?? "Aluno não encontrado") : "—",
      }))
    );
    setLoading(false);
  }, [user?.contractorId]);

  useEffect(() => { loadReceivables(); }, [loadReceivables]);

  async function handleConfirmCharge(billingType: "PIX" | "BOLETO") {
    if (!selectedRcv) return;
    setGeneratingId(selectedRcv.id);
    setSelectedRcv(null);
    setChargeError(null);

    const payload: CreateChargePayload = {
      contractor_id: user!.contractorId,
      student_id:    selectedRcv.student_id ?? "",
      receivable_id: selectedRcv.id,
      billing_type:  billingType,
      amount:        selectedRcv.valor,
      due_date:      selectedRcv.vencimento?.substring(0, 10) ?? "",
    };

    const res = await GoFitPayService.createCharge(payload);
    setGeneratingId(null);

    if (!res.success || !res.data) {
      setChargeError(res.error ?? "Erro ao gerar cobrança. Tente novamente.");
      return;
    }

    setChargeResult(res.data);
    loadReceivables(); // atualiza lista
  }

  if (moduleActive === false) {
    return (
      <AppLayout>
        <div className="flex flex-col min-h-full bg-gray-50">
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/app/gofit-pay")}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-400">GoFit Pay</span>
              <ChevronRight className="w-3 h-3 text-gray-300" />
              <span className="text-xs font-semibold text-gray-700">Cobranças</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-base font-bold text-gray-700">GoFit Pay não está ativo</p>
            <p className="text-sm text-gray-400 text-center max-w-xs">
              Ative o GoFit Pay para emitir cobranças Pix e Boleto.
            </p>
            <button
              onClick={() => navigate("/app/loja/gofit-pay")}
              className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Ativar GoFit Pay
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col min-h-full bg-gray-50">

        {/* ── Header ── */}
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/app/gofit-pay")}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-400">GoFit Pay</span>
              <ChevronRight className="w-3 h-3 text-gray-300" />
              <span className="text-xs font-semibold text-gray-700">Cobranças</span>
            </div>
            <button
              onClick={loadReceivables}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <RefreshCcw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="flex-1 px-8 py-6 max-w-5xl mx-auto w-full">

          {/* ── Título ── */}
          <div className="mb-5">
            <h1 className="text-xl font-black text-gray-900">Emitir cobranças</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Selecione uma conta a receber para gerar cobrança Pix ou Boleto.
            </p>
          </div>

          {/* ── Erro global ── */}
          {chargeError && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 mb-5">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-700">Erro ao gerar cobrança</p>
                <p className="text-xs text-red-600 mt-0.5">{chargeError}</p>
              </div>
              <button onClick={() => setChargeError(null)} className="p-0.5 rounded hover:bg-red-100">
                <X className="w-3 h-3 text-red-400" />
              </button>
            </div>
          )}

          {/* ── Conteúdo ── */}
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 justify-center mt-20">
              <Loader2 className="w-5 h-5 animate-spin" /> Carregando contas a receber...
            </div>
          ) : receivables.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-20 gap-3 text-center px-8">
              <div className="flex gap-2">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <QrCode className="w-5 h-5 text-green-600" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-sm font-bold text-gray-700">Sem contas a receber pendentes</p>
              <p className="text-xs text-gray-400 max-w-xs">
                Não há receivables com status pendente, atrasado ou aguardando.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* Legenda */}
              <div className="px-5 py-3 border-b border-gray-50 bg-gray-50/50 grid grid-cols-[1fr_120px_100px_100px_160px] gap-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <span>Aluno / Descrição</span>
                <span>Vencimento</span>
                <span className="text-right">Valor</span>
                <span className="text-center">Status</span>
                <span className="text-right">Ação</span>
              </div>

              {receivables.map((rcv) => {
                const { label, cls } = statusLabel(rcv.status);
                const hasCharge      = !!rcv.asaas_payment_id;
                const isGenerating   = generatingId === rcv.id;

                return (
                  <div
                    key={rcv.id}
                    className="px-5 py-3.5 border-b border-gray-50 last:border-b-0 grid grid-cols-[1fr_120px_100px_100px_160px] gap-3 items-center hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Aluno / Descrição */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {rcv.student_name ?? "—"}
                      </p>
                      {rcv.descricao && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {rcv.descricao}
                        </p>
                      )}
                    </div>

                    {/* Vencimento */}
                    <div className="text-sm text-gray-600">
                      {rcv.vencimento ? formatDate(rcv.vencimento) : "—"}
                    </div>

                    {/* Valor */}
                    <div className="text-sm font-bold text-gray-900 text-right">
                      {formatCurrency(rcv.valor ?? 0)}
                    </div>

                    {/* Status */}
                    <div className="flex justify-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
                        {label}
                      </span>
                    </div>

                    {/* Ação */}
                    <div className="flex justify-end">
                      {hasCharge ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Cobrança gerada
                        </span>
                      ) : isGenerating ? (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Gerando...
                        </span>
                      ) : (
                        <button
                          onClick={() => setSelectedRcv(rcv)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors"
                        >
                          <Zap className="w-3 h-3" />
                          Gerar cobrança
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Informativo de Fase 7 */}
          {!loading && receivables.length > 0 && (
            <div className="mt-4 flex items-start gap-2 text-xs text-gray-400 px-1">
              <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                A baixa automática após pagamento será implementada na Fase 7.
                A baixa manual continua funcionando normalmente em Financeiro → Contas a Receber.
              </span>
            </div>
          )}
        </div>

        {/* ── Modal: escolha de método ── */}
        {selectedRcv && (
          <BillingTypeModal
            receivable={selectedRcv}
            onConfirm={handleConfirmCharge}
            onClose={() => setSelectedRcv(null)}
          />
        )}

        {/* ── Modal: resultado ── */}
        {chargeResult && (
          <ChargeResultModal
            result={chargeResult}
            onClose={() => setChargeResult(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
