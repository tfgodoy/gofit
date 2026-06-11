/**
 * Fase 13 — GoFit Pay: Relatórios e Conciliação
 * Rota: /app/gofit-pay/relatorios
 *
 * Analítico e operacional — apenas leitura e exportação.
 * Não altera receivables, não cancela cobranças, não baixa pagamentos.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, RefreshCcw, Loader2, Download,
  TrendingUp, Wallet, Clock, XCircle, AlertTriangle,
  CheckCircle2, Users, Zap, Hand, AlertOctagon,
  QrCode, FileText, CreditCard, Copy, ExternalLink,
  ChevronDown, ChevronUp, Search, Filter, BarChart3,
  RotateCcw, AlertCircle,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { GoFitPayService } from "@/services/gofit-pay";
import type {
  ReportSummary, BillingTypeStat, ReportCharge, ReportDiscrepancy, ReportFilters,
} from "@/services/gofit-pay";
import { GoFitPayEnvironmentBadge } from "@/components/gofit-pay/GoFitPayEnvironmentBadge";

/* ─── Helpers ─────────────────────────────────────────────────────── */
function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s.substring(0, 10) + "T00:00:00").toLocaleDateString("pt-BR");
}
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today() {
  return new Date().toISOString().substring(0, 10);
}

const BILLING_LABEL: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PIX:         { label: "Pix",     color: "text-green-600 bg-green-100",  icon: QrCode      },
  BOLETO:      { label: "Boleto",  color: "text-blue-600 bg-blue-100",    icon: FileText    },
  CREDIT_CARD: { label: "Cartão",  color: "text-purple-600 bg-purple-100",icon: CreditCard  },
};
const billingLabel = (bt: string | null) => BILLING_LABEL[bt ?? ""]?.label ?? bt ?? "—";
const billingIcon  = (bt: string | null) => BILLING_LABEL[bt ?? ""]?.icon ?? CreditCard;
const billingColor = (bt: string | null) => BILLING_LABEL[bt ?? ""]?.color ?? "text-gray-500 bg-gray-100";

const STATUS_GW_LABEL: Record<string, { label: string; badge: string }> = {
  PENDING:   { label: "Pendente",  badge: "bg-yellow-100 text-yellow-700" },
  RECEIVED:  { label: "Recebido",  badge: "bg-green-100 text-green-700"   },
  CONFIRMED: { label: "Confirmado",badge: "bg-green-100 text-green-700"   },
  CANCELLED: { label: "Cancelado", badge: "bg-red-100 text-red-700"       },
  OVERDUE:   { label: "Vencido",   badge: "bg-red-100 text-red-700"       },
  REFUNDED:  { label: "Estornado", badge: "bg-gray-100 text-gray-600"     },
};
const gwLabel = (s: string | null) => STATUS_GW_LABEL[s ?? ""]?.label ?? s ?? "—";
const gwBadge = (s: string | null) => STATUS_GW_LABEL[s ?? ""]?.badge ?? "bg-gray-100 text-gray-600";

const FIN_LABEL: Record<string, { label: string; badge: string }> = {
  pendente:  { label: "Pendente",  badge: "bg-yellow-100 text-yellow-700" },
  pago:      { label: "Pago",      badge: "bg-green-100 text-green-700"   },
  cancelado: { label: "Cancelado", badge: "bg-red-100 text-red-700"       },
  vencido:   { label: "Vencido",   badge: "bg-red-100 text-red-700"       },
};
const finLabel = (s: string | null) => FIN_LABEL[s ?? ""]?.label ?? s ?? "—";
const finBadge = (s: string | null) => FIN_LABEL[s ?? ""]?.badge ?? "bg-gray-100 text-gray-600";

const BAIXA_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  automatica:      { label: "Automática",       badge: "bg-green-100 text-green-700",  icon: Zap          },
  manual:          { label: "Manual",           badge: "bg-blue-100 text-blue-700",    icon: Hand         },
  nao_pago:        { label: "Não pago",         badge: "bg-gray-100 text-gray-500",    icon: Clock        },
  nao_identificado:{ label: "Não identificado", badge: "bg-amber-100 text-amber-700",  icon: AlertCircle  },
};
const baixaConfig = (tb: string) => BAIXA_CONFIG[tb] ?? BAIXA_CONFIG.nao_identificado;

const SEVERIDADE_CONFIG: Record<string, { badge: string; dot: string }> = {
  Alta:  { badge: "bg-red-100 text-red-700",    dot: "bg-red-500"    },
  Média: { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500"  },
  Baixa: { badge: "bg-gray-100 text-gray-600",  dot: "bg-gray-400"   },
};

/* ─── KPI Card ─────────────────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, sub, color = "gray" }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
  const bg   = color === "green" ? "bg-green-100" : color === "blue" ? "bg-blue-100" : color === "red" ? "bg-red-100" : color === "amber" ? "bg-amber-100" : color === "purple" ? "bg-purple-100" : "bg-gray-100";
  const ic   = color === "green" ? "text-green-600" : color === "blue" ? "text-blue-600" : color === "red" ? "text-red-600" : color === "amber" ? "text-amber-600" : color === "purple" ? "text-purple-600" : "text-gray-500";
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className={`w-4 h-4 ${ic}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium truncate">{label}</p>
        <p className="text-lg font-black text-gray-900 mt-0.5 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function GoFitPayRelatoriosPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  /* ── Filtros ─── */
  const [dateFrom,      setDateFrom]      = useState(firstOfMonth());
  const [dateTo,        setDateTo]        = useState(today());
  const [filterBt,      setFilterBt]      = useState("");
  const [filterFinSt,   setFilterFinSt]   = useState("");
  const [filterGwSt,    setFilterGwSt]    = useState("");
  const [filterStudent, setFilterStudent] = useState("");
  const [filterBaixa,   setFilterBaixa]   = useState("");

  /* ── Dados ─── */
  const [summary,       setSummary]       = useState<ReportSummary | null>(null);
  const [byBt,          setByBt]          = useState<BillingTypeStat[]>([]);
  const [charges,       setCharges]       = useState<ReportCharge[]>([]);
  const [discrepancies, setDiscrepancies] = useState<ReportDiscrepancy[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [activeEnv,     setActiveEnv]     = useState<"sandbox" | "production" | null>(null);

  /* ── UI state ─── */
  const [activeTab,     setActiveTab]     = useState<"cobranças" | "divergencias">("cobranças");
  const [showBt,        setShowBt]        = useState(true);

  /* ── Load ─── */
  const load = useCallback(async () => {
    if (!user?.contractorId) return;
    setLoading(true);
    setError(null);

    const filters: ReportFilters = {
      date_from:       dateFrom || undefined,
      date_to:         dateTo   || undefined,
      billing_type:    filterBt     || undefined,
      status_financeiro: filterFinSt || undefined,
      status_gateway:  filterGwSt   || undefined,
      student_name:    filterStudent || undefined,
      tipo_baixa:      filterBaixa ? [filterBaixa] : undefined,
      limit:           200,
      offset:          0,
    };

    const res = await GoFitPayService.getReports(filters);
    if (!res.success || !res.data) {
      setError(res.error ?? "Falha ao carregar relatórios.");
    } else {
      setSummary(res.data.summary);
      setByBt(res.data.by_billing_type);
      setCharges(res.data.charges);
      setDiscrepancies(res.data.discrepancies);
    }
    setLoading(false);
  }, [user?.contractorId, dateFrom, dateTo, filterBt, filterFinSt, filterGwSt, filterStudent, filterBaixa]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    GoFitPayService.getEnvironmentStatus().then(r => {
      if (r.success && r.data) setActiveEnv(r.data.current_environment);
    });
  }, []);

  /* ── CSV Export ─── */
  function exportCSV() {
    const header = ["data_emissao","vencimento","aluno","descricao","forma_pagamento","valor","status_financeiro","status_gateway","tipo_baixa","data_pagamento","provider_charge_id","invoice_url"];
    const rows = charges.map(c => [
      c.created_at?.substring(0, 10) ?? "",
      c.vencimento?.substring(0, 10) ?? "",
      c.student_nome ?? "",
      c.descricao ?? "",
      c.billing_type ?? "",
      c.amount?.toFixed(2) ?? "",
      c.status_financeiro ?? "",
      c.status_gateway ?? "",
      c.tipo_baixa ?? "",
      c.pago_em?.substring(0, 10) ?? "",
      c.provider_charge_id ?? "",
      c.invoice_url ?? "",
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(v => `"${(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `gofit_pay_relatorio_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).catch(() => null);
  }

  /* ── Render ─── */
  return (
    <AppLayout>
      <div className="flex flex-col min-h-full bg-gray-50">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/app/gofit-pay")}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black text-gray-900">Relatórios</h1>
                  <GoFitPayEnvironmentBadge environment={activeEnv} />
                </div>
                <p className="text-xs text-gray-400">Recebimentos, cobranças e conciliação GoFit Pay</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={load} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                Atualizar
              </button>
              <button onClick={exportCSV} disabled={charges.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-40">
                <Download className="w-3 h-3" /> Exportar CSV
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 px-8 py-6 max-w-7xl mx-auto w-full space-y-6">

          {/* Filtros */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-bold text-gray-600">Filtros</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">De</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Até</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Forma</label>
                <select value={filterBt} onChange={e => setFilterBt(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Todas</option>
                  <option value="PIX">Pix</option>
                  <option value="BOLETO">Boleto</option>
                  <option value="CREDIT_CARD">Cartão</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Status financeiro</label>
                <select value={filterFinSt} onChange={e => setFilterFinSt(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Todos</option>
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Status gateway</label>
                <select value={filterGwSt} onChange={e => setFilterGwSt(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Todos</option>
                  <option value="PENDING">Pendente</option>
                  <option value="RECEIVED">Recebido</option>
                  <option value="CONFIRMED">Confirmado</option>
                  <option value="CANCELLED">Cancelado</option>
                  <option value="OVERDUE">Vencido</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Tipo de baixa</label>
                <select value={filterBaixa} onChange={e => setFilterBaixa(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Todos</option>
                  <option value="automatica">Automática</option>
                  <option value="manual">Manual</option>
                  <option value="nao_pago">Não pago</option>
                  <option value="nao_identificado">Não identificado</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Aluno</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <input type="text" value={filterStudent} onChange={e => setFilterStudent(e.target.value)}
                    placeholder="Buscar..."
                    className="border border-gray-200 rounded-lg pl-6 pr-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary w-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && !summary && (
            <div className="flex items-center justify-center py-20 gap-2 text-sm text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" /> Carregando relatórios...
            </div>
          )}

          {summary && (
            <>
              {/* KPI Cards — 2 linhas de 5 */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard icon={TrendingUp}    label="Cobrado pelo GoFit Pay" value={fmt(summary.total_cobrado)}   sub={`${summary.qtd_cobranças} cobranças`}        color="blue"   />
                <KpiCard icon={Wallet}        label="Pago no financeiro"    value={fmt(summary.total_pago)}      sub="via gateway Asaas"                            color="green"  />
                <KpiCard icon={Clock}         label="Pendente"              value={fmt(summary.total_pendente)}  sub="vence hoje ou futuramente"                    color="amber"  />
                <KpiCard icon={AlertTriangle} label="Vencido"               value={fmt(summary.total_vencido)}   sub="vencimento passado, em aberto"                color="red"    />
                <KpiCard icon={XCircle}       label="Cancelado no gateway"  value={fmt(summary.total_cancelado)} sub="cobranças canceladas"                         color="gray"   />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard icon={Users}         label="Alunos com cobrança"   value={String(summary.qtd_alunos)}   sub="no período"                                   color="blue"   />
                <KpiCard icon={Zap}           label="Baixas automáticas"    value={String(summary.baixas_automaticas)} sub="via webhook"                            color="green"  />
                <KpiCard icon={Hand}          label="Baixas manuais"        value={String(summary.baixas_manuais)}    sub="ou não identificadas"                    color="amber"  />
                <KpiCard icon={AlertOctagon}  label="Divergências"          value={String(summary.divergencias)}      sub="requer atenção"                          color={summary.divergencias > 0 ? "red" : "gray"} />
                <KpiCard icon={BarChart3}     label="Total cobranças"       value={String(summary.qtd_cobranças)}     sub={`período ${dateFrom} → ${dateTo}`}       />
              </div>

              {/* Agrupamento por forma de pagamento */}
              {byBt.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => setShowBt(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-50 text-left hover:bg-gray-50 transition-colors"
                  >
                    <h2 className="text-sm font-bold text-gray-900">Análise por forma de pagamento</h2>
                    {showBt ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {showBt && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 text-left border-b border-gray-50">
                            <th className="px-5 py-3 font-semibold">Forma</th>
                            <th className="px-3 py-3 font-semibold text-right">Cobranças</th>
                            <th className="px-3 py-3 font-semibold text-right">Total emitido</th>
                            <th className="px-3 py-3 font-semibold text-right">Pago</th>
                            <th className="px-3 py-3 font-semibold text-right">Pendente</th>
                            <th className="px-3 py-3 font-semibold text-right">Vencido</th>
                            <th className="px-3 py-3 font-semibold text-right">Cancelado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {byBt.map(bt => {
                            const BtIcon = billingIcon(bt.billing_type);
                            const btColor = billingColor(bt.billing_type);
                            return (
                              <tr key={bt.billing_type} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                <td className="px-5 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${btColor}`}>
                                      <BtIcon className="w-3 h-3" />
                                    </div>
                                    <span className="font-semibold text-gray-800">{billingLabel(bt.billing_type)}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-right text-gray-700 font-medium">{bt.qtd}</td>
                                <td className="px-3 py-3 text-right text-gray-700">{fmt(bt.total_emitido)}</td>
                                <td className="px-3 py-3 text-right text-green-700 font-semibold">{fmt(bt.total_pago)}</td>
                                <td className="px-3 py-3 text-right text-amber-700">{fmt(bt.pendente)}</td>
                                <td className="px-3 py-3 text-right text-red-700">{fmt(bt.vencido)}</td>
                                <td className="px-3 py-3 text-right text-gray-500">{fmt(bt.cancelado)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Abas: Cobranças / Divergências */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center border-b border-gray-100 px-5 gap-4">
                  {(["cobranças", "divergencias"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`py-4 text-xs font-bold border-b-2 transition-colors ${
                        activeTab === tab
                          ? "border-primary text-primary"
                          : "border-transparent text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {tab === "cobranças" ? `Cobranças (${charges.length})` : (
                        <span className="flex items-center gap-1">
                          Divergências
                          {discrepancies.length > 0 && (
                            <span className="bg-red-100 text-red-700 rounded-full px-1.5 py-0.5 text-xs font-bold">
                              {discrepancies.length}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  ))}
                  <div className="ml-auto py-3">
                    {activeTab === "cobranças" && charges.length > 0 && (
                      <button onClick={exportCSV}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                        <Download className="w-3 h-3" /> CSV
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabela de cobranças */}
                {activeTab === "cobranças" && (
                  <>
                    {charges.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                        <BarChart3 className="w-8 h-8 text-gray-200" />
                        <p className="text-sm font-bold text-gray-600">Nenhuma cobrança no período</p>
                        <p className="text-xs text-gray-400">Ajuste os filtros ou o intervalo de datas</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 text-left border-b border-gray-50">
                              <th className="px-5 py-3 font-semibold">Emissão</th>
                              <th className="px-3 py-3 font-semibold">Vencimento</th>
                              <th className="px-3 py-3 font-semibold">Aluno / Descrição</th>
                              <th className="px-3 py-3 font-semibold">Forma</th>
                              <th className="px-3 py-3 font-semibold text-right">Valor</th>
                              <th className="px-3 py-3 font-semibold">Status fin.</th>
                              <th className="px-3 py-3 font-semibold">Status gateway</th>
                              <th className="px-3 py-3 font-semibold">Tipo baixa</th>
                              <th className="px-3 py-3 font-semibold">Pgto em</th>
                              <th className="px-3 py-3 font-semibold">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {charges.map(c => {
                              const BtIcon = billingIcon(c.billing_type);
                              const btColor = billingColor(c.billing_type);
                              const bc = baixaConfig(c.tipo_baixa);
                              const BcIcon = bc.icon;
                              return (
                                <tr key={c.charge_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                  <td className="px-5 py-3 text-gray-500">{fmtDate(c.created_at)}</td>
                                  <td className="px-3 py-3 text-gray-700">{fmtDate(c.vencimento)}</td>
                                  <td className="px-3 py-3 max-w-[160px]">
                                    <p className="font-semibold text-gray-900 truncate">{c.student_nome ?? "—"}</p>
                                    <p className="text-gray-400 truncate">{c.descricao ?? "—"}</p>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${btColor}`}>
                                      <BtIcon className="w-3 h-3" />
                                      {billingLabel(c.billing_type)}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-right font-semibold text-gray-900">
                                    {fmt(c.amount ?? 0)}
                                  </td>
                                  <td className="px-3 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${finBadge(c.status_financeiro)}`}>
                                      {finLabel(c.status_financeiro)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${gwBadge(c.status_gateway)}`}>
                                      {gwLabel(c.status_gateway)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${bc.badge}`}>
                                      <BcIcon className="w-3 h-3" />
                                      {bc.label}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-gray-500">{fmtDate(c.pago_em)}</td>
                                  <td className="px-3 py-3">
                                    <div className="flex items-center gap-1">
                                      {c.pix_copy_paste && (
                                        <button onClick={() => copyText(c.pix_copy_paste!)}
                                          title="Copiar Pix"
                                          className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-green-600 transition-colors">
                                          <QrCode className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {c.invoice_url && (
                                        <a href={c.invoice_url} target="_blank" rel="noopener noreferrer"
                                          title="Abrir fatura"
                                          className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors">
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      )}
                                      {(c.invoice_url || c.bank_slip_url) && (
                                        <button onClick={() => copyText(c.invoice_url ?? c.bank_slip_url ?? "")}
                                          title="Copiar link"
                                          className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors">
                                          <Copy className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {c.provider_charge_id && (
                                        <button onClick={() => copyText(c.provider_charge_id!)}
                                          title="Copiar ID Asaas"
                                          className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                                          <FileText className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {/* Seção de divergências */}
                {activeTab === "divergencias" && (
                  <>
                    {discrepancies.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                        <CheckCircle2 className="w-8 h-8 text-green-400" />
                        <p className="text-sm font-bold text-gray-700">Nenhuma divergência detectada</p>
                        <p className="text-xs text-gray-400">Dados do GoFit Pay estão consistentes no período consultado</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {discrepancies.map((d, i) => {
                          const sc = SEVERIDADE_CONFIG[d.severidade] ?? SEVERIDADE_CONFIG.Baixa;
                          return (
                            <div key={i} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                              <div className="flex items-start gap-3">
                                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${sc.dot}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${sc.badge}`}>
                                      {d.severidade}
                                    </span>
                                    <span className="text-xs text-gray-400">{d.tipo.replace(/_/g, " ")}</span>
                                    {d.student_nome && (
                                      <span className="text-xs font-semibold text-gray-700">{d.student_nome}</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-700 mb-1">{d.descricao}</p>
                                  <p className="text-xs text-gray-400 italic">{d.acao_sugerida}</p>
                                  {d.provider_charge_id && (
                                    <button onClick={() => copyText(d.provider_charge_id!)}
                                      className="mt-1 text-xs text-gray-400 hover:text-primary transition-colors flex items-center gap-1">
                                      <Copy className="w-3 h-3" />
                                      {d.provider_charge_id.substring(0, 24)}…
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Disclaimer */}
              <p className="text-xs text-gray-400 text-center px-4 pb-4">
                Esta tela é analítica e informativa. Não altera cobranças, receivables nem status financeiro automaticamente.
              </p>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
