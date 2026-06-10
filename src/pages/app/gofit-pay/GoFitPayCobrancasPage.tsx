/**
 * Fase 7.1 — GoFit Pay: Operação e auditoria de cobranças
 * Rota: /app/gofit-pay/cobrancas
 *
 * - Lista payment_charges com contexto de receivable e aluno
 * - Drawer lateral com detalhe completo: receivable, cobrança, aluno, webhooks
 * - Ação "Atualizar status" (sync_charge_status)
 * - Ação "Reprocessar eventos pendentes"
 * - Ação "Emitir nova cobrança" (preserva fluxo da Fase 6)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  QrCode, FileText, CreditCard, ArrowLeft, RefreshCcw, Loader2,
  CheckCircle2, AlertCircle, ChevronRight, Copy, ExternalLink, X,
  Zap, Eye, RefreshCw, RotateCcw, Webhook, User, Receipt,
  Clock, AlertTriangle, ChevronDown, ChevronUp, Ban,
} from "lucide-react";
import AppLayout          from "@/components/app/AppLayout";
import { supabase }       from "@/integrations/supabase/client";
import { useAuth }        from "@/contexts/AuthContext";
import { GoFitPayService } from "@/services/gofit-pay";
import type { CreateChargePayload, PaymentCharge, WebhookEvent } from "@/services/gofit-pay/types";

/* ─── Tipos locais ─────────────────────────────────────────────────── */

interface ChargeRow extends PaymentCharge {
  receivable_status:   string | null;
  receivable_valor:    number | null;
  receivable_vencimento: string | null;
  receivable_descricao: string | null;
  pago_em:             string | null;
  hora_recebimento:    string | null;
  forma_pagamento:     string | null;
  valor_pago:          number | null;
  student_name:        string;
}

interface Receivable {
  id:                  string;
  student_id:          string | null;
  student_contract_id: string | null;
  valor:               number;
  vencimento:          string;
  descricao:           string | null;
  status:              string;
  asaas_payment_id:    string | null;
  student_name?:       string;
}

interface CustomerInfo {
  name:             string;
  email:            string | null;
  cpf_cnpj:         string | null;
  phone:            string | null;
  provider_customer_id: string | null;
}

/* ─── Formatação ───────────────────────────────────────────────────── */

function fmtCurrency(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return d.toLocaleDateString("pt-BR");
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR");
}

/* ─── Badges ───────────────────────────────────────────────────────── */

const GATEWAY_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING:                      { label: "Aguardando pagamento", cls: "bg-yellow-100 text-yellow-700" },
  RECEIVED:                     { label: "Recebido",             cls: "bg-green-100 text-green-700"  },
  CONFIRMED:                    { label: "Confirmado",           cls: "bg-green-100 text-green-700"  },
  OVERDUE:                      { label: "Vencido",              cls: "bg-red-100 text-red-700"      },
  CANCELLED:                    { label: "Cancelado",            cls: "bg-gray-100 text-gray-500"    },
  REFUNDED:                     { label: "Estornado",            cls: "bg-gray-100 text-gray-500"    },
  REFUND_REQUESTED:             { label: "Estorno solicitado",   cls: "bg-orange-100 text-orange-700"},
  CHARGEBACK_DISPUTE:           { label: "Contestado",           cls: "bg-red-100 text-red-700"      },
  CHARGEBACK_REQUESTED:         { label: "Chargeback solicitado",cls: "bg-red-100 text-red-700"      },
  AWAITING_CHARGEBACK_REVERSAL: { label: "Aguardando reversão",  cls: "bg-orange-100 text-orange-700"},
  AWAITING_RISK_ANALYSIS:       { label: "Em análise de risco",  cls: "bg-blue-100 text-blue-700"   },
};

function GatewayBadge({ status }: { status: string | null }) {
  const b = status ? (GATEWAY_BADGE[status] ?? { label: status, cls: "bg-gray-100 text-gray-500" }) : { label: "—", cls: "bg-gray-100 text-gray-400" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${b.cls}`}>{b.label}</span>;
}

const GOFIT_BADGE: Record<string, { label: string; cls: string }> = {
  pendente:   { label: "Pendente",   cls: "bg-yellow-100 text-yellow-700" },
  atrasado:   { label: "Atrasado",   cls: "bg-red-100 text-red-700"       },
  aguardando: { label: "Aguardando", cls: "bg-blue-100 text-blue-700"     },
  pago:       { label: "Pago",       cls: "bg-green-100 text-green-700"   },
  cancelado:  { label: "Cancelado",  cls: "bg-gray-100 text-gray-500"     },
};

function GoFitBadge({ status }: { status: string | null }) {
  const b = status ? (GOFIT_BADGE[status] ?? { label: status, cls: "bg-gray-100 text-gray-500" }) : { label: "—", cls: "bg-gray-100 text-gray-400" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${b.cls}`}>{b.label}</span>;
}

function BillingBadge({ type }: { type: string | null }) {
  if (type === "PIX")    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700"><QrCode className="w-2.5 h-2.5" />Pix</span>;
  if (type === "BOLETO") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700"><FileText className="w-2.5 h-2.5" />Boleto</span>;
  return <span className="text-xs text-gray-400">{type ?? "—"}</span>;
}

/* ─── Cancelamento ─────────────────────────────────────────────────── */

const NON_CANCELLABLE_STATUSES = [
  "RECEIVED", "CONFIRMED", "REFUNDED", "REFUND_REQUESTED",
  "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE",
  "AWAITING_CHARGEBACK_REVERSAL", "CANCELLED",
];

function canCancelCharge(charge: ChargeRow): boolean {
  if (charge.receivable_status === "pago") return false;
  return !NON_CANCELLABLE_STATUSES.includes(charge.status ?? "");
}

function CancelConfirmModal({
  charge, onConfirm, onCancel, loading, error,
}: {
  charge:    ChargeRow;
  onConfirm: () => void;
  onCancel:  () => void;
  loading:   boolean;
  error:     string | null;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <Ban className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900">Cancelar cobrança GoFit Pay?</p>
              <p className="text-xs text-gray-400 mt-0.5">{charge.student_name} · {fmtCurrency(charge.amount)}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-gray-600">
            Essa ação cancelará a cobrança no Asaas, mas{" "}
            <strong className="text-gray-900">não apagará a conta a receber no GoFit</strong>.
          </p>
          <p className="text-sm text-gray-500">
            A mensalidade/receita continuará existindo no financeiro e poderá ser tratada
            manualmente ou receber nova cobrança em fluxo futuro.
          </p>
          {error && (
            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-semibold text-gray-600 disabled:opacity-50 transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50 transition-colors"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Cancelando...</>
              : "Confirmar cancelamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Drawer de detalhes ───────────────────────────────────────────── */

interface DrawerProps {
  charge:        ChargeRow;
  onClose:       () => void;
  onSynced:      (updated: Partial<ChargeRow>) => void;
  onReprocessed: () => void;
  onCancelled:   (chargeId: string) => void;
}

function ChargeDetailDrawer({ charge, onClose, onSynced, onReprocessed, onCancelled }: DrawerProps) {
  const { user }   = useAuth();
  const [tab, setTab] = useState<"cobranca" | "receivable" | "aluno" | "webhooks">("cobranca");
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [loadingWh, setLoadingWh] = useState(false);
  const [loadingCust, setLoadingCust] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reproMsg, setReproMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const loadWebhooks = useCallback(async () => {
    if (!user?.contractorId || !charge.provider_charge_id) return;
    setLoadingWh(true);
    const events = await GoFitPayService.listWebhookEventsByProviderPaymentId(
      user.contractorId,
      charge.provider_charge_id
    );
    setWebhooks(events);
    setLoadingWh(false);
  }, [user?.contractorId, charge.provider_charge_id]);

  const loadCustomer = useCallback(async () => {
    if (!user?.contractorId || !charge.student_id) return;
    setLoadingCust(true);
    const cust = await GoFitPayService.getCustomerByStudentId(user.contractorId, charge.student_id);
    if (cust) {
      setCustomer({
        name:                 cust.name,
        email:                cust.email ?? null,
        cpf_cnpj:             cust.cpf_cnpj ?? null,
        phone:                cust.phone ?? null,
        provider_customer_id: cust.provider_customer_id ?? null,
      });
    }
    setLoadingCust(false);
  }, [user?.contractorId, charge.student_id]);

  useEffect(() => {
    if (tab === "webhooks") loadWebhooks();
    if (tab === "aluno") loadCustomer();
  }, [tab, loadWebhooks, loadCustomer]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    const res = await GoFitPayService.syncChargeStatus(charge.id);
    setSyncing(false);
    if (res.success && res.data) {
      setSyncMsg({ ok: true, text: `Status atualizado: ${res.data.status}` });
      onSynced({
        status:         res.data.status as ChargeRow["status"],
        invoice_url:    res.data.invoice_url,
        bank_slip_url:  res.data.bank_slip_url,
        pix_qr_code:    res.data.pix_qr_code,
        pix_copy_paste: res.data.pix_copy_paste,
      });
    } else {
      setSyncMsg({ ok: false, text: res.error ?? "Erro ao atualizar status." });
    }
    setTimeout(() => setSyncMsg(null), 4000);
  }

  async function handleReprocess() {
    setReprocessing(true);
    setReproMsg(null);
    const res = await GoFitPayService.processPendingWebhooks(10);
    setReprocessing(false);
    if (res.success && res.data) {
      const { processed_count, failed_count } = res.data;
      setReproMsg({
        ok: true,
        text: `${processed_count} evento(s) processado(s)${failed_count > 0 ? `, ${failed_count} com erro` : ""}.`,
      });
      onReprocessed();
      if (tab === "webhooks") loadWebhooks();
    } else {
      setReproMsg({ ok: false, text: res.error ?? "Erro ao reprocessar." });
    }
    setTimeout(() => setReproMsg(null), 4000);
  }

  async function handleCancel() {
    setCancelling(true);
    setCancelError(null);
    const res = await GoFitPayService.cancelCharge(charge.id);
    setCancelling(false);
    if (res.success) {
      setShowCancelModal(false);
      onCancelled(charge.id);
    } else {
      setCancelError(res.error ?? "Erro ao cancelar cobrança.");
    }
  }

  const pendingWebhooks = webhooks.filter(e => !e.processed);
  const hasResolutionPending = webhooks.some(e => e.error_message?.startsWith("RESOLUTION_PENDING"));

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Painel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* Header do drawer */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${charge.billing_type === "PIX" ? "bg-green-100" : "bg-blue-100"}`}>
              {charge.billing_type === "PIX"
                ? <QrCode className="w-4 h-4 text-green-600" />
                : <FileText className="w-4 h-4 text-blue-600" />
              }
            </div>
            <div>
              <p className="text-sm font-black text-gray-900">{charge.student_name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {charge.receivable_descricao ?? `Cobrança ${charge.billing_type}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Resumo rápido */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 flex-shrink-0 flex-wrap">
          <div>
            <p className="text-xs text-gray-400">Valor</p>
            <p className="text-sm font-bold text-gray-900">{fmtCurrency(charge.amount)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Vencimento</p>
            <p className="text-sm font-semibold text-gray-700">{fmtDate(charge.due_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Status gateway</p>
            <GatewayBadge status={charge.status} />
          </div>
          <div>
            <p className="text-xs text-gray-400">Status GoFit</p>
            <GoFitBadge status={charge.receivable_status} />
          </div>
        </div>

        {/* Ações */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 flex-shrink-0 flex-wrap">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Atualizar status
          </button>

          {(pendingWebhooks.length > 0 || hasResolutionPending) && (
            <button
              onClick={handleReprocess}
              disabled={reprocessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs font-bold transition-colors disabled:opacity-50"
            >
              {reprocessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              Reprocessar pendentes
            </button>
          )}

          {charge.invoice_url && (
            <a href={charge.invoice_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold transition-colors">
              <ExternalLink className="w-3 h-3" />
              Link de pagamento
            </a>
          )}
          {charge.bank_slip_url && (
            <a href={charge.bank_slip_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors">
              <ExternalLink className="w-3 h-3" />
              Abrir boleto
            </a>
          )}
          {charge.pix_copy_paste && (
            <button
              onClick={() => copyText(charge.pix_copy_paste!, "pix")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold transition-colors">
              {copied === "pix" ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied === "pix" ? "Copiado!" : "Copiar Pix"}
            </button>
          )}

          {canCancelCharge(charge) && (
            <button
              onClick={() => { setCancelError(null); setShowCancelModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-colors ml-auto"
            >
              <Ban className="w-3 h-3" />
              Cancelar cobrança
            </button>
          )}
        </div>

        {/* Mensagens de feedback */}
        {(syncMsg || reproMsg) && (
          <div className="px-6 py-2 flex-shrink-0">
            {syncMsg && (
              <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg ${syncMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {syncMsg.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {syncMsg.text}
              </div>
            )}
            {reproMsg && (
              <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg mt-1 ${reproMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {reproMsg.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {reproMsg.text}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 flex-shrink-0">
          {([
            { key: "cobranca",   icon: Receipt, label: "Cobrança" },
            { key: "receivable", icon: CreditCard, label: "Financeiro" },
            { key: "aluno",      icon: User, label: "Aluno" },
            { key: "webhooks",   icon: Webhook, label: `Webhooks${webhooks.length > 0 ? ` (${webhooks.length})` : ""}` },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Modal de confirmação de cancelamento */}
        {showCancelModal && (
          <CancelConfirmModal
            charge={charge}
            onConfirm={handleCancel}
            onCancel={() => setShowCancelModal(false)}
            loading={cancelling}
            error={cancelError}
          />
        )}

        {/* Conteúdo da tab */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* ── Cobrança ── */}
          {tab === "cobranca" && (
            <>
              <Section title="Dados da cobrança GoFit Pay">
                <Row label="Provider"          value={charge.provider} />
                <Row label="ID no Asaas"        value={charge.provider_charge_id} mono />
                <Row label="ID interno"         value={charge.id} mono small />
                <Row label="Tipo"               value={<BillingBadge type={charge.billing_type} />} />
                <Row label="Valor"              value={fmtCurrency(charge.amount)} />
                <Row label="Vencimento"         value={fmtDate(charge.due_date)} />
                <Row label="Status gateway"     value={<GatewayBadge status={charge.status} />} />
                <Row label="Criado em"          value={fmtDateTime(charge.created_at)} />
                <Row label="Atualizado em"      value={fmtDateTime(charge.updated_at)} />
                {charge.paid_at      && <Row label="Pago em (gateway)"   value={fmtDateTime(charge.paid_at)} />}
                {charge.confirmed_at && <Row label="Confirmado em"       value={fmtDateTime(charge.confirmed_at)} />}
                {charge.cancelled_at && <Row label="Cancelado em"        value={fmtDateTime(charge.cancelled_at)} />}
                {charge.refunded_at  && <Row label="Estornado em"        value={fmtDateTime(charge.refunded_at)} />}
              </Section>

              {/* QR Code Pix */}
              {charge.billing_type === "PIX" && (
                <Section title="Pix">
                  {charge.pix_qr_code ? (
                    <div className="flex flex-col items-center gap-3 py-2">
                      <img
                        src={`data:image/png;base64,${charge.pix_qr_code}`}
                        alt="QR Code Pix"
                        className="w-40 h-40 rounded-xl border border-gray-200"
                      />
                      {charge.pix_copy_paste && (
                        <button
                          onClick={() => copyText(charge.pix_copy_paste!, "pix-tab")}
                          className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors w-full justify-center"
                        >
                          {copied === "pix-tab" ? <><CheckCircle2 className="w-3 h-3 text-green-500" /> Copiado!</> : <><Copy className="w-3 h-3" /> Copiar Pix Copia e Cola</>}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 py-2">QR Code não disponível. Use "Atualizar status" para tentar recuperar.</p>
                  )}
                </Section>
              )}

              {/* Links */}
              {(charge.invoice_url || charge.bank_slip_url) && (
                <Section title="Links de pagamento">
                  {charge.invoice_url && (
                    <a href={charge.invoice_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-primary font-semibold hover:underline">
                      <ExternalLink className="w-3 h-3" /> Abrir link da fatura
                    </a>
                  )}
                  {charge.bank_slip_url && (
                    <a href={charge.bank_slip_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-blue-600 font-semibold hover:underline mt-1">
                      <ExternalLink className="w-3 h-3" /> Abrir boleto bancário
                    </a>
                  )}
                </Section>
              )}
            </>
          )}

          {/* ── Financeiro (Receivable) ── */}
          {tab === "receivable" && (
            <Section title="Conta a receber (GoFit)">
              <Row label="ID da receivable"    value={charge.receivable_id} mono small />
              <Row label="Descrição"            value={charge.receivable_descricao} />
              <Row label="Valor"                value={fmtCurrency(charge.receivable_valor)} />
              <Row label="Vencimento"           value={fmtDate(charge.receivable_vencimento)} />
              <Row label="Status no GoFit"      value={<GoFitBadge status={charge.receivable_status} />} />
              {charge.receivable_status === "pago" && <>
                <Row label="Pago em"            value={fmtDate(charge.pago_em)} />
                <Row label="Hora recebimento"   value={charge.hora_recebimento ?? "—"} />
                <Row label="Forma de pagamento" value={charge.forma_pagamento ?? "—"} />
                <Row label="Valor pago"         value={fmtCurrency(charge.valor_pago)} />
              </>}
            </Section>
          )}

          {/* ── Aluno ── */}
          {tab === "aluno" && (
            <>
              <Section title="Dados do aluno">
                <Row label="Nome"    value={charge.student_name} />
                <Row label="ID"      value={charge.student_id} mono small />
              </Section>
              {loadingCust ? (
                <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Carregando...</div>
              ) : customer ? (
                <Section title="Dados no Asaas">
                  <Row label="Nome"               value={customer.name} />
                  <Row label="E-mail"             value={customer.email} />
                  <Row label="CPF/CNPJ"           value={customer.cpf_cnpj} />
                  <Row label="Telefone"           value={customer.phone} />
                  <Row label="ID Asaas (cus_xxx)" value={customer.provider_customer_id} mono small />
                </Section>
              ) : (
                <p className="text-xs text-gray-400">Customer Asaas não encontrado para este aluno.</p>
              )}
            </>
          )}

          {/* ── Webhooks ── */}
          {tab === "webhooks" && (
            <>
              {loadingWh ? (
                <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Carregando eventos...</div>
              ) : webhooks.length === 0 ? (
                <div className="text-center py-8">
                  <Webhook className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-500">Sem eventos de webhook</p>
                  <p className="text-xs text-gray-400 mt-1">Nenhum evento recebido para esta cobrança.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {webhooks.map(ev => (
                    <WebhookEventCard
                      key={ev.id}
                      event={ev}
                      expanded={expandedEventId === ev.id}
                      onToggle={() => setExpandedEventId(expandedEventId === ev.id ? null : ev.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Componentes auxiliares do drawer ─────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{title}</p>
      <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">{children}</div>
    </div>
  );
}

function Row({
  label, value, mono = false, small = false
}: {
  label: string; value: React.ReactNode; mono?: boolean; small?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 min-h-[1.25rem]">
      <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{label}</span>
      <span className={`text-right break-all ${mono ? "font-mono" : "font-semibold"} ${small ? "text-[10px] text-gray-400" : "text-xs text-gray-800"}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

const EVENT_TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  PAYMENT_RECEIVED:             { label: "Recebido",      cls: "bg-green-100 text-green-700"   },
  PAYMENT_CONFIRMED:            { label: "Confirmado",    cls: "bg-green-100 text-green-700"   },
  PAYMENT_CREATED:              { label: "Criado",        cls: "bg-gray-100 text-gray-600"     },
  PAYMENT_OVERDUE:              { label: "Vencido",       cls: "bg-red-100 text-red-700"       },
  PAYMENT_DELETED:              { label: "Excluído",      cls: "bg-gray-100 text-gray-500"     },
  PAYMENT_REFUNDED:             { label: "Estornado",     cls: "bg-orange-100 text-orange-700" },
  PAYMENT_CHARGEBACK_REQUESTED: { label: "Chargeback",    cls: "bg-red-100 text-red-700"       },
  PAYMENT_CHARGEBACK_DISPUTE:   { label: "Disputa",       cls: "bg-red-100 text-red-700"       },
};

interface WebhookEventWithAttempts extends WebhookEvent {
  processing_attempts?: number;
}

function WebhookEventCard({
  event, expanded, onToggle,
}: {
  event: WebhookEventWithAttempts;
  expanded: boolean;
  onToggle: () => void;
}) {
  const badge = EVENT_TYPE_BADGE[event.event_type] ?? { label: event.event_type, cls: "bg-gray-100 text-gray-500" };
  const isResolutionPending = event.error_message?.startsWith("RESOLUTION_PENDING");

  return (
    <div className={`rounded-xl border ${event.processed ? "border-gray-100" : isResolutionPending ? "border-orange-200 bg-orange-50/50" : "border-yellow-200 bg-yellow-50/50"}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
          {event.processed
            ? <span className="inline-flex items-center gap-0.5 text-xs text-green-600"><CheckCircle2 className="w-3 h-3" /> Processado</span>
            : isResolutionPending
              ? <span className="inline-flex items-center gap-0.5 text-xs text-orange-600"><AlertTriangle className="w-3 h-3" /> Aguardando resolução</span>
              : <span className="inline-flex items-center gap-0.5 text-xs text-yellow-600"><Clock className="w-3 h-3" /> Pendente</span>
          }
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-gray-100">
          <Row label="ID do evento"       value={event.id} mono small />
          <Row label="provider_payment_id" value={event.provider_payment_id} mono small />
          <Row label="Recebido em"        value={fmtDateTime(event.received_at)} />
          {event.processed_at && <Row label="Processado em" value={fmtDateTime(event.processed_at)} />}
          {(event.processing_attempts ?? 0) > 0 && <Row label="Tentativas" value={String(event.processing_attempts)} />}
          {event.error_message && (
            <div className="mt-2">
              <p className="text-xs text-gray-400 mb-1">Mensagem</p>
              <p className="text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-2 break-all font-mono">
                {event.error_message.substring(0, 200)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Modal de escolha de receivable para emissão ──────────────────── */

function EmitirCobrancaModal({
  onClose,
  onCharged,
}: {
  onClose: () => void;
  onCharged: () => void;
}) {
  const { user } = useAuth();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRcv, setSelectedRcv] = useState<Receivable | null>(null);
  const [billingType, setBillingType] = useState<"PIX" | "BOLETO" | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chargeResult, setChargeResult] = useState<ChargeResult | null>(null);

  useEffect(() => {
    async function load() {
      if (!user?.contractorId) return;
      const { data } = await supabase
        .from("receivables")
        .select("id, student_id, student_contract_id, valor, vencimento, descricao, status, asaas_payment_id")
        .eq("contractor_id", user.contractorId)
        .in("status", ["pendente", "atrasado", "aguardando"])
        .is("asaas_payment_id", null)
        .order("vencimento", { ascending: true })
        .limit(50);

      if (!data?.length) { setReceivables([]); setLoading(false); return; }
      const studentIds = [...new Set(data.map(r => r.student_id).filter(Boolean))] as string[];
      let nameMap: Record<string, string> = {};
      if (studentIds.length) {
        const { data: students } = await supabase.from("students").select("id, nome_completo").in("id", studentIds);
        if (students) nameMap = Object.fromEntries(students.map(s => [s.id, s.nome_completo]));
      }
      setReceivables(data.map(r => ({ ...r, student_name: r.student_id ? (nameMap[r.student_id] ?? "—") : "—" })));
      setLoading(false);
    }
    load();
  }, [user?.contractorId]);

  async function handleGenerate() {
    if (!selectedRcv || !billingType) return;
    setGenerating(true);
    setError(null);
    const payload: CreateChargePayload = {
      contractor_id: user!.contractorId,
      student_id:    selectedRcv.student_id ?? "",
      receivable_id: selectedRcv.id,
      billing_type:  billingType,
      amount:        selectedRcv.valor,
      due_date:      selectedRcv.vencimento?.substring(0, 10) ?? "",
    };
    const res = await GoFitPayService.createCharge(payload);
    setGenerating(false);
    if (!res.success || !res.data) { setError(res.error ?? "Erro ao gerar cobrança."); return; }
    setChargeResult(res.data as ChargeResult);
  }

  if (chargeResult) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
        <ChargeResultModal result={chargeResult} onClose={() => { onClose(); onCharged(); }} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">GoFit Pay</p>
            <p className="text-base font-black text-gray-900">Emitir nova cobrança</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
          ) : receivables.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-600">Sem contas pendentes de cobrança</p>
              <p className="text-xs text-gray-400 mt-1">Todas as contas já possuem cobranças GoFit Pay.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {receivables.map(rcv => (
                <button
                  key={rcv.id}
                  onClick={() => setSelectedRcv(selectedRcv?.id === rcv.id ? null : rcv)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border-2 text-left transition-all ${
                    selectedRcv?.id === rcv.id ? "border-primary bg-primary/5" : "border-gray-100 hover:border-gray-200 bg-white"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{rcv.student_name}</p>
                    <p className="text-xs text-gray-400">{rcv.descricao ?? "—"} · Vcto {fmtDate(rcv.vencimento)}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900 ml-4 flex-shrink-0">{fmtCurrency(rcv.valor)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedRcv && (
          <div className="px-6 py-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Forma de pagamento</p>
            <div className="flex gap-2">
              {(["PIX", "BOLETO"] as const).map(bt => (
                <button
                  key={bt}
                  onClick={() => setBillingType(bt)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                    billingType === bt
                      ? bt === "PIX" ? "border-green-400 bg-green-50 text-green-700" : "border-blue-400 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {bt === "PIX" ? <QrCode className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  {bt === "PIX" ? "Pix" : "Boleto"}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mx-6 mb-3">
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
            </div>
          </div>
        )}

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-semibold text-gray-600">
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={!selectedRcv || !billingType || generating}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Gerando...</> : "Gerar cobrança"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Resultado de cobrança (Pix / Boleto) ─────────────────────────── */

interface ChargeResult {
  charge_id: string; provider_charge_id: string; billing_type: string;
  status: string; amount: number; due_date: string;
  invoice_url: string | null; bank_slip_url: string | null;
  pix_qr_code: string | null; pix_copy_paste: string | null;
  already_existed: boolean; message: string;
}

function ChargeResultModal({ result, onClose }: { result: ChargeResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const isPix = result.billing_type === "PIX";
  function copy(text: string) { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }
  return (
    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
      <div className={`px-6 py-5 ${isPix ? "bg-green-50" : "bg-blue-50"} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isPix ? "bg-green-100" : "bg-blue-100"}`}>
            {isPix ? <QrCode className="w-5 h-5 text-green-600" /> : <FileText className="w-5 h-5 text-blue-600" />}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{isPix ? "Cobrança Pix" : "Boleto Bancário"}</p>
            <p className="text-lg font-black text-gray-900">{fmtCurrency(result.amount)}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/10"><X className="w-4 h-4 text-gray-500" /></button>
      </div>
      <div className="px-6 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-xs font-bold text-green-700">{result.already_existed ? "Cobrança já existente" : "Cobrança criada com sucesso"}</span>
        </div>
        {isPix && result.pix_qr_code && (
          <div className="flex flex-col items-center gap-3">
            <img src={`data:image/png;base64,${result.pix_qr_code}`} alt="QR Code Pix" className="w-48 h-48 rounded-xl border border-gray-200" />
            {result.pix_copy_paste && (
              <button onClick={() => copy(result.pix_copy_paste!)}
                className="flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-semibold text-gray-700">
                {copied ? <><CheckCircle2 className="w-4 h-4 text-green-500" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar Pix Copia e Cola</>}
              </button>
            )}
          </div>
        )}
        {!isPix && result.bank_slip_url && (
          <a href={result.bank_slip_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white">
            <ExternalLink className="w-4 h-4" /> Abrir boleto
          </a>
        )}
        {result.invoice_url && (
          <a href={result.invoice_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-semibold text-gray-700">
            <ExternalLink className="w-4 h-4" /> Abrir link de pagamento
          </a>
        )}
        <button onClick={onClose} className="w-full px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700">Fechar</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
══════════════════════════════════════════════════════════════════════ */

type StatusFilter = "all" | "pending" | "paid" | "overdue" | "cancelled";

export default function GoFitPayCobrancasPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [charges,       setCharges]      = useState<ChargeRow[]>([]);
  const [loading,       setLoading]      = useState(true);
  const [moduleActive,  setModuleActive] = useState<boolean | null>(null);
  const [filter,        setFilter]       = useState<StatusFilter>("all");
  const [selectedCharge, setSelectedCharge] = useState<ChargeRow | null>(null);
  const [showEmitir,    setShowEmitir]   = useState(false);
  const [globalError,   setGlobalError]  = useState<string | null>(null);

  const loadCharges = useCallback(async () => {
    if (!user?.contractorId) return;
    setLoading(true);

    // Verifica módulo ativo
    const { data: mod } = await supabase.from("modules").select("id").eq("slug", "gofit_pay").maybeSingle();
    if (mod) {
      const { data: cm } = await supabase.from("company_modules").select("status")
        .eq("contractor_id", user.contractorId).eq("module_id", mod.id).maybeSingle();
      setModuleActive(cm?.status === "active");
    } else {
      setModuleActive(false);
    }

    // Busca payment_charges
    const { data: chargesData } = await supabase
      .from("payment_charges")
      .select("id, contractor_id, student_id, student_contract_id, receivable_id, provider, provider_charge_id, billing_type, amount, value, due_date, status, invoice_url, bank_slip_url, pix_qr_code, pix_copy_paste, payment_url, paid_at, confirmed_at, refunded_at, cancelled_at, created_at, updated_at")
      .eq("contractor_id", user.contractorId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!chargesData?.length) { setCharges([]); setLoading(false); return; }

    // Busca receivables correspondentes
    const receivableIds = [...new Set(chargesData.map(c => c.receivable_id).filter(Boolean))] as string[];
    let receivableMap: Record<string, {
      status: string; valor: number; vencimento: string; descricao: string | null;
      pago_em: string | null; hora_recebimento: string | null; forma_pagamento: string | null; valor_pago: number | null;
    }> = {};

    if (receivableIds.length) {
      const { data: rcvs } = await supabase
        .from("receivables")
        .select("id, status, valor, vencimento, descricao, pago_em, hora_recebimento, forma_pagamento, valor_pago")
        .in("id", receivableIds);
      if (rcvs) receivableMap = Object.fromEntries(rcvs.map(r => [r.id, r]));
    }

    // Busca nomes dos alunos
    const studentIds = [...new Set(chargesData.map(c => c.student_id).filter(Boolean))] as string[];
    let studentMap: Record<string, string> = {};
    if (studentIds.length) {
      const { data: students } = await supabase.from("students").select("id, nome_completo").in("id", studentIds);
      if (students) studentMap = Object.fromEntries(students.map(s => [s.id, s.nome_completo]));
    }

    setCharges(chargesData.map(c => {
      const rcv = c.receivable_id ? receivableMap[c.receivable_id] : null;
      return {
        ...c,
        raw_response_json:     {},
        receivable_status:     rcv?.status ?? null,
        receivable_valor:      rcv?.valor ?? c.amount,
        receivable_vencimento: rcv?.vencimento ?? c.due_date,
        receivable_descricao:  rcv?.descricao ?? null,
        pago_em:               rcv?.pago_em ?? null,
        hora_recebimento:      rcv?.hora_recebimento ?? null,
        forma_pagamento:       rcv?.forma_pagamento ?? null,
        valor_pago:            rcv?.valor_pago ?? null,
        student_name:          c.student_id ? (studentMap[c.student_id] ?? "—") : "—",
      } as ChargeRow;
    }));

    setLoading(false);
  }, [user?.contractorId]);

  useEffect(() => { loadCharges(); }, [loadCharges]);

  // Atualiza charge no state após sync
  function handleSynced(chargeId: string, updated: Partial<ChargeRow>) {
    setCharges(prev => prev.map(c => c.id === chargeId ? { ...c, ...updated } : c));
    setSelectedCharge(prev => prev && prev.id === chargeId ? { ...prev, ...updated } : prev);
  }

  // Atualiza charge no state após cancelamento
  function handleCancelled(chargeId: string) {
    const cancelledAt = new Date().toISOString();
    setCharges(prev => prev.map(c =>
      c.id === chargeId ? { ...c, status: "CANCELLED", cancelled_at: cancelledAt } : c
    ));
    setSelectedCharge(prev =>
      prev && prev.id === chargeId
        ? { ...prev, status: "CANCELLED", cancelled_at: cancelledAt }
        : prev
    );
  }

  const filtered = charges.filter(c => {
    if (filter === "all")       return true;
    if (filter === "pending")   return c.status === "PENDING";
    if (filter === "paid")      return c.status === "RECEIVED" || c.status === "CONFIRMED";
    if (filter === "overdue")   return c.status === "OVERDUE";
    if (filter === "cancelled") return c.status === "CANCELLED" || c.status === "REFUNDED";
    return true;
  });

  const counts = {
    all:       charges.length,
    pending:   charges.filter(c => c.status === "PENDING").length,
    paid:      charges.filter(c => c.status === "RECEIVED" || c.status === "CONFIRMED").length,
    overdue:   charges.filter(c => c.status === "OVERDUE").length,
    cancelled: charges.filter(c => c.status === "CANCELLED" || c.status === "REFUNDED").length,
  };

  if (moduleActive === false) {
    return (
      <AppLayout>
        <div className="flex flex-col min-h-full bg-gray-50">
          <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-3">
            <button onClick={() => navigate("/app/gofit-pay")} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-400">GoFit Pay</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-xs font-semibold text-gray-700">Cobranças</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-base font-bold text-gray-700">GoFit Pay não está ativo</p>
            <button onClick={() => navigate("/app/loja/gofit-pay")}
              className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
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
              <span className="text-xs font-semibold text-gray-700">Cobranças</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadCharges} disabled={loading}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
                <RefreshCcw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
              </button>
              <button
                onClick={() => setShowEmitir(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors"
              >
                <Zap className="w-3 h-3" /> Emitir cobrança
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 px-8 py-6 max-w-6xl mx-auto w-full">

          {/* Título */}
          <div className="mb-5">
            <h1 className="text-xl font-black text-gray-900">Cobranças GoFit Pay</h1>
            <p className="text-sm text-gray-400 mt-0.5">Operação e auditoria de cobranças Pix e Boleto.</p>
          </div>

          {/* Erro global */}
          {globalError && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 mb-5">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600 flex-1">{globalError}</p>
              <button onClick={() => setGlobalError(null)}><X className="w-3 h-3 text-red-400" /></button>
            </div>
          )}

          {/* Filtros */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {([
              { key: "all",       label: `Todas (${counts.all})`           },
              { key: "pending",   label: `Aguardando (${counts.pending})`   },
              { key: "paid",      label: `Pagas (${counts.paid})`           },
              { key: "overdue",   label: `Vencidas (${counts.overdue})`     },
              { key: "cancelled", label: `Canceladas (${counts.cancelled})` },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === key
                    ? "bg-primary text-white"
                    : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 justify-center mt-20">
              <Loader2 className="w-5 h-5 animate-spin" /> Carregando cobranças...
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-20 gap-3 text-center px-8">
              <div className="flex gap-2">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><QrCode className="w-5 h-5 text-green-600" /></div>
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><FileText className="w-5 h-5 text-blue-600" /></div>
              </div>
              <p className="text-sm font-bold text-gray-700">
                {charges.length === 0 ? "Sem cobranças emitidas" : "Sem cobranças com este filtro"}
              </p>
              <p className="text-xs text-gray-400 max-w-xs">
                {charges.length === 0
                  ? 'Clique em "Emitir cobrança" para gerar sua primeira cobrança Pix ou Boleto.'
                  : "Tente alterar o filtro acima."}
              </p>
              {charges.length === 0 && (
                <button onClick={() => setShowEmitir(true)}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90">
                  <Zap className="w-4 h-4 inline mr-1.5" /> Emitir cobrança
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* Cabeçalho */}
              <div className="px-5 py-3 border-b border-gray-50 bg-gray-50/50 grid grid-cols-[1fr_100px_90px_80px_130px_120px_60px] gap-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <span>Aluno / Descrição</span>
                <span>Vencimento</span>
                <span className="text-right">Valor</span>
                <span className="text-center">Tipo</span>
                <span className="text-center">Status GoFit</span>
                <span className="text-center">Gateway</span>
                <span />
              </div>

              {filtered.map(c => (
                <div
                  key={c.id}
                  className="px-5 py-3 border-b border-gray-50 last:border-0 grid grid-cols-[1fr_100px_90px_80px_130px_120px_60px] gap-3 items-center hover:bg-gray-50/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.student_name}</p>
                    {c.receivable_descricao && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{c.receivable_descricao}</p>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">{fmtDate(c.due_date)}</div>
                  <div className="text-sm font-bold text-gray-900 text-right">{fmtCurrency(c.amount)}</div>
                  <div className="flex justify-center"><BillingBadge type={c.billing_type} /></div>
                  <div className="flex justify-center"><GoFitBadge status={c.receivable_status} /></div>
                  <div className="flex justify-center"><GatewayBadge status={c.status} /></div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setSelectedCharge(c)}
                      className="flex items-center gap-1 text-xs text-primary font-semibold hover:text-primary/80 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer de detalhe */}
        {selectedCharge && (
          <ChargeDetailDrawer
            charge={selectedCharge}
            onClose={() => setSelectedCharge(null)}
            onSynced={(updated) => handleSynced(selectedCharge.id, updated)}
            onReprocessed={loadCharges}
            onCancelled={handleCancelled}
          />
        )}

        {/* Modal de emissão */}
        {showEmitir && (
          <EmitirCobrancaModal
            onClose={() => setShowEmitir(false)}
            onCharged={() => { setShowEmitir(false); loadCharges(); }}
          />
        )}
      </div>
    </AppLayout>
  );
}
