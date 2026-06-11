/**
 * Fase 11 — Modal "Visualizar taxas" do GoFit Pay
 * Exibe taxas de PIX, BOLETO e CREDIT_CARD por abas.
 * Dados vêm da Edge Function (get_fees) — somente leitura.
 * Empresa não pode editar taxas por este modal.
 */

import { useState, useEffect } from "react";
import { X, CreditCard, FileText, QrCode, Info, Loader2, AlertTriangle } from "lucide-react";
import { GoFitPayService, type GoFitPayFee } from "@/services/gofit-pay";

type Tab = "CREDIT_CARD" | "BOLETO" | "PIX";

const TABS: { id: Tab; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { id: "CREDIT_CARD", label: "Cartão de crédito", icon: CreditCard, color: "text-purple-600", bg: "bg-purple-100" },
  { id: "BOLETO",      label: "Boleto",            icon: FileText,   color: "text-blue-600",   bg: "bg-blue-100"   },
  { id: "PIX",         label: "Pix",               icon: QrCode,     color: "text-green-600",  bg: "bg-green-100"  },
];

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function FeeLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-bold text-gray-800">{value}</span>
    </div>
  );
}

function FeeCard({ fee }: { fee: GoFitPayFee }) {
  const hasPct   = fee.percentage_fee > 0;
  const hasFixed = fee.fixed_fee > 0;
  const label    = fee.installment_min != null
    ? fee.installment_min === fee.installment_max
      ? `${fee.label}`
      : `${fee.label}`
    : fee.label;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
      <p className="text-sm font-bold text-gray-800 mb-2">{label}</p>
      <div className="divide-y divide-gray-50">
        {hasPct && (
          <FeeLine label="Taxa percentual" value={`${fmt(fee.percentage_fee)}%`} />
        )}
        {hasFixed && (
          <FeeLine label="Taxa fixa" value={`R$ ${fmt(fee.fixed_fee)}`} />
        )}
        {!hasPct && !hasFixed && (
          <FeeLine label="Taxa" value="A definir" />
        )}
        <FeeLine
          label="Prazo de repasse"
          value={
            fee.settlement_days === 0
              ? "Imediato"
              : `Em até ${fee.settlement_days} dia${fee.settlement_days !== 1 ? "s úteis" : " útil"}`
          }
        />
        {fee.description && (
          <div className="pt-2.5">
            <p className="text-xs text-gray-400">{fee.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
interface Props {
  onClose: () => void;
}

export default function GoFitPayFeesModal({ onClose }: Props) {
  const [tab,     setTab]     = useState<Tab>("CREDIT_CARD");
  const [fees,    setFees]    = useState<GoFitPayFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [isDemo,  setIsDemo]  = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await GoFitPayService.getFees();
      if (!res.success || !res.data) {
        setError("Não foi possível carregar as taxas.");
      } else {
        setFees(res.data.fees);
        setIsDemo(res.data.fees.length > 0 && res.data.fees.every(f => f.is_demo));
      }
      setLoading(false);
    }
    load();
  }, []);

  const currentFees = fees.filter(f => f.billing_type === tab).sort((a, b) => a.sort_order - b.sort_order);

  const activeTab   = TABS.find(t => t.id === tab)!;
  const TabIcon     = activeTab.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white rounded-t-2xl border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-black text-gray-900">Taxas GoFit Pay</h2>
              <p className="text-xs text-gray-400">Condições comerciais por forma de pagamento</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Demo badge */}
        {isDemo && !loading && (
          <div className="mx-6 mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Valores ilustrativos. As taxas reais serão definidas conforme sua negociação comercial.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 flex-shrink-0">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  active
                    ? "bg-white shadow-sm border border-gray-200 text-gray-800"
                    : "text-gray-400 hover:text-gray-600 hover:bg-white/60"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? t.color : ""}`} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {loading && (
            <div className="flex items-center gap-2 justify-center py-10 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando taxas...
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center gap-2 py-10 text-sm text-red-500 justify-center">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Ícone do tipo */}
              <div className={`flex items-center gap-2.5 mb-4 p-3 rounded-xl ${activeTab.bg}/40 border border-gray-100`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeTab.bg}`}>
                  <TabIcon className={`w-4 h-4 ${activeTab.color}`} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-800">{activeTab.label}</p>
                  <p className="text-xs text-gray-400">
                    {tab === "PIX"         && "Confirmação em segundos via webhooks"}
                    {tab === "BOLETO"      && "Compensação em até 3 dias úteis"}
                    {tab === "CREDIT_CARD" && "Parcelado ou à vista via link de pagamento"}
                  </p>
                </div>
              </div>

              {currentFees.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">
                  Nenhuma taxa configurada para esta forma de pagamento.
                </div>
              ) : (
                currentFees.map(f => <FeeCard key={f.id} fee={f} />)
              )}
            </>
          )}
        </div>

        {/* Footer disclaimer */}
        <div className="px-6 pb-5 pt-2 flex-shrink-0">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
            <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-600 leading-relaxed">
              As taxas exibidas são as condições comerciais configuradas para o GoFit Pay.
              Esta tela é informativa e não altera automaticamente o valor das mensalidades ou recebimentos.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
