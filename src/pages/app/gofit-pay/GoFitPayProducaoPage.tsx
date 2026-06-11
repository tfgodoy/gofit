/**
 * Fase 15 — GoFit Pay: Gerenciamento de Produção Controlada
 * Rota: /app/gofit-pay/producao
 *
 * - Exibe status do ambiente atual
 * - Checklist de prontidão para produção
 * - Habilita piloto de produção (somente quando checklist OK)
 * - Executa rollback (bloqueia novas cobranças reais)
 *
 * Leitura: qualquer usuário autenticado com GoFit Pay ativo.
 * Ações: enable_production_pilot / disable_production_pilot via EF (contractor server-side).
 * Nunca expõe API keys, webhook tokens, ou service_role.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, RefreshCcw, Loader2, Shield, FlaskConical,
  CheckCircle2, XCircle, AlertTriangle, Clock, Info,
  Zap, RotateCcw, ChevronRight, AlertOctagon, Link2, Eye, EyeOff,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { GoFitPayService } from "@/services/gofit-pay";
import type { EnvironmentStatus, ProductionReadiness } from "@/services/gofit-pay";
import { GoFitPayEnvironmentBadge } from "@/components/gofit-pay/GoFitPayEnvironmentBadge";

/* ─── Status icon para checklist ───────────────────────────────── */
function CheckStatusIcon({ status }: { status: string }) {
  if (status === "ok")      return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
  if (status === "fail")    return <XCircle      className="w-4 h-4 text-red-500   flex-shrink-0" />;
  if (status === "warn")    return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
  return <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />;
}

function checkBadge(status: string) {
  if (status === "ok")   return "bg-green-100 text-green-700";
  if (status === "fail") return "bg-red-100   text-red-700";
  if (status === "warn") return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-500";
}

/* ─── Modal de confirmação genérico ────────────────────────────── */
function ConfirmModal({
  title, body, confirmLabel, confirmClass, onConfirm, onClose, children,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => void;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-sm font-black text-gray-900">{title}</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">{body}</p>
          {children}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function GoFitPayProducaoPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [envStatus,    setEnvStatus]    = useState<EnvironmentStatus | null>(null);
  const [readiness,    setReadiness]    = useState<ProductionReadiness | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [actionMsg,    setActionMsg]    = useState<{ ok: boolean; text: string } | null>(null);
  const [acting,       setActing]       = useState(false);

  /* ── Modais ─── */
  const [showEnableModal,  setShowEnableModal]  = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [pilotNotes,       setPilotNotes]       = useState("Go-live controlado — empresa piloto Fase 15");
  const [rollbackReason,   setRollbackReason]   = useState("Rollback operacional após validação piloto");

  /* ── Vincular conta production ─── */
  const [showLinkForm,     setShowLinkForm]     = useState(false);
  const [linkAccountId,    setLinkAccountId]    = useState("");
  const [linkWalletId,     setLinkWalletId]     = useState("");
  const [linkApiKey,       setLinkApiKey]       = useState("");
  const [showApiKey,       setShowApiKey]       = useState(false);
  const [linking,          setLinking]          = useState(false);
  const [linkMsg,          setLinkMsg]          = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!user?.contractorId) return;
    setLoading(true);
    setError(null);
    const [envRes, readRes] = await Promise.all([
      GoFitPayService.getEnvironmentStatus(),
      GoFitPayService.validateProductionReadiness(),
    ]);
    if (!envRes.success) {
      setError(envRes.error ?? "Falha ao carregar status de ambiente.");
    } else {
      setEnvStatus(envRes.data ?? null);
    }
    if (readRes.success && readRes.data) setReadiness(readRes.data);
    setLoading(false);
  }, [user?.contractorId]);

  useEffect(() => { load(); }, [load]);

  /* ── Habilitar piloto ─── */
  async function handleEnablePilot() {
    setShowEnableModal(false);
    setActing(true);
    setActionMsg(null);
    const res = await GoFitPayService.enableProductionPilot(pilotNotes);
    setActing(false);
    if (res.success) {
      setActionMsg({ ok: true, text: res.data?.message ?? "Piloto habilitado com sucesso." });
      load();
    } else {
      setActionMsg({ ok: false, text: res.error ?? "Erro ao habilitar piloto." });
    }
  }

  /* ── Rollback ─── */
  async function handleRollback() {
    setShowRollbackModal(false);
    setActing(true);
    setActionMsg(null);
    const res = await GoFitPayService.disableProductionPilot(rollbackReason);
    setActing(false);
    if (res.success) {
      setActionMsg({ ok: true, text: res.data?.message ?? "Rollback executado com sucesso." });
      load();
    } else {
      setActionMsg({ ok: false, text: res.error ?? "Erro ao executar rollback." });
    }
  }

  /* ── Vincular conta ─── */
  async function handleLinkAccount() {
    if (!linkAccountId.trim() || !linkApiKey.trim()) return;
    setLinking(true);
    setLinkMsg(null);
    const res = await GoFitPayService.linkProductionAccount({
      provider_account_id: linkAccountId.trim(),
      api_key:             linkApiKey.trim(),
      provider_wallet_id:  linkWalletId.trim() || undefined,
    });
    setLinking(false);
    setLinkApiKey(""); // limpa chave da memória após uso
    if (res.success) {
      setLinkMsg({ ok: true, text: res.data?.message ?? "Conta vinculada com sucesso." });
      setShowLinkForm(false);
      load();
    } else {
      setLinkMsg({ ok: false, text: res.error ?? "Erro ao vincular conta." });
    }
  }

  const currentEnv   = envStatus?.current_environment ?? null;
  const isProduction = currentEnv === "production";
  const pilotActive  = envStatus?.production_enabled && envStatus?.allowed_for_real_charges;
  const canEnable    = !pilotActive && (readiness?.critical_failures === 0);
  const canRollback  = pilotActive;

  /* ── Render ─── */
  return (
    <AppLayout>
      {showEnableModal && (
        <ConfirmModal
          title="Habilitar Piloto de Produção"
          body="Esta ação habilita cobranças reais para esta empresa. Confirme apenas após validar todos os pré-requisitos do checklist."
          confirmLabel="Habilitar Produção"
          confirmClass="bg-green-600 hover:bg-green-700"
          onConfirm={handleEnablePilot}
          onClose={() => setShowEnableModal(false)}
        >
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Observações do piloto</label>
            <textarea
              value={pilotNotes}
              onChange={e => setPilotNotes(e.target.value)}
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
            />
          </div>
        </ConfirmModal>
      )}

      {showRollbackModal && (
        <ConfirmModal
          title="Executar Rollback de Produção"
          body="Novas cobranças reais serão bloqueadas. O histórico de cobranças production e webhooks será preservado. Sandbox continua funcionando."
          confirmLabel="Confirmar Rollback"
          confirmClass="bg-red-600 hover:bg-red-700"
          onConfirm={handleRollback}
          onClose={() => setShowRollbackModal(false)}
        >
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Motivo do rollback</label>
            <textarea
              value={rollbackReason}
              onChange={e => setRollbackReason(e.target.value)}
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
          </div>
        </ConfirmModal>
      )}

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
                <Shield className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black text-gray-900">Produção Controlada</h1>
                  <GoFitPayEnvironmentBadge environment={currentEnv} />
                </div>
                <p className="text-xs text-gray-400">Go-live controlado, piloto e rollback GoFit Pay</p>
              </div>
            </div>
            <button onClick={load} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
              Atualizar
            </button>
          </div>
        </div>

        <div className="flex-1 px-8 py-6 max-w-4xl mx-auto w-full space-y-6">

          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-400 justify-center mt-20">
              <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
              <AlertOctagon className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {actionMsg && (
            <div className={`flex items-start gap-3 p-4 rounded-xl border ${
              actionMsg.ok
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              {actionMsg.ok
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              }
              <p className="text-sm font-medium">{actionMsg.text}</p>
            </div>
          )}

          {!loading && envStatus && (
            <>
              {/* Status do Ambiente */}
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Status do Ambiente</h2>
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <StatusField label="Ambiente ativo">
                      <GoFitPayEnvironmentBadge environment={currentEnv} size="md" />
                    </StatusField>
                    <StatusField label="Módulo GoFit Pay">
                      <BoolBadge v={envStatus.module_active} trueLabel="Ativo" falseLabel="Inativo" />
                    </StatusField>
                    <StatusField label="Conta Asaas">
                      <span className={`text-xs font-semibold ${
                        envStatus.account_status === "active" ? "text-green-600" : "text-gray-500"
                      }`}>{envStatus.account_status ?? "—"}</span>
                    </StatusField>
                    <StatusField label="Produção habilitada">
                      <BoolBadge v={!!envStatus.production_enabled} trueLabel="Sim" falseLabel="Não" />
                    </StatusField>
                    <StatusField label="Cobranças reais">
                      <BoolBadge v={!!envStatus.allowed_for_real_charges}
                        trueLabel="Autorizadas" falseLabel="Bloqueadas"
                        trueColor="green" falseColor="gray" />
                    </StatusField>
                    <StatusField label="URL corresponde ao env">
                      <BoolBadge v={envStatus.base_url_matches_env} trueLabel="Sim" falseLabel="Não" />
                    </StatusField>
                    <StatusField label="API Key">
                      <SecretPresenceBadge present={envStatus.secrets_present.api_key} />
                    </StatusField>
                    <StatusField label="Webhook Token">
                      <SecretPresenceBadge present={envStatus.secrets_present.webhook_token} />
                    </StatusField>
                    <StatusField label="Encryption Key">
                      <SecretPresenceBadge present={envStatus.secrets_present.encryption_key} />
                    </StatusField>
                  </div>
                </div>
              </section>

              {/* Checklist de prontidão */}
              {readiness && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Checklist de Prontidão para Produção
                    </h2>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-green-600 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {readiness.passed} ok
                      </span>
                      {readiness.warnings > 0 && (
                        <span className="flex items-center gap-1 text-amber-600 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" /> {readiness.warnings} warn
                        </span>
                      )}
                      {readiness.critical_failures > 0 && (
                        <span className="flex items-center gap-1 text-red-600 font-semibold">
                          <XCircle className="w-3.5 h-3.5" /> {readiness.critical_failures} falha(s)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    {readiness.checks.map((chk, i) => (
                      <div key={i}
                        className={`flex items-start gap-3 px-5 py-3.5 ${
                          i < readiness.checks.length - 1 ? "border-b border-gray-50" : ""
                        }`}>
                        <CheckStatusIcon status={chk.status} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{chk.item}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{chk.detail}</p>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${checkBadge(chk.status)}`}>
                          {chk.status.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className={`mt-3 flex items-start gap-2 p-3 rounded-xl border text-sm ${
                    readiness.ready_for_production
                      ? "bg-green-50 border-green-200 text-green-700"
                      : readiness.critical_failures > 0
                        ? "bg-red-50 border-red-200 text-red-700"
                        : "bg-amber-50 border-amber-200 text-amber-700"
                  }`}>
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="font-medium">{readiness.summary}</span>
                  </div>
                </section>
              )}

              {/* Vincular Conta de Produção */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Conta Asaas Production
                  </h2>
                  <button
                    onClick={() => { setShowLinkForm(f => !f); setLinkMsg(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors"
                  >
                    <Link2 className="w-3 h-3" />
                    {showLinkForm ? "Fechar" : "Vincular Conta"}
                  </button>
                </div>

                {linkMsg && (
                  <div className={`flex items-start gap-3 p-4 rounded-xl border mb-3 ${
                    linkMsg.ok
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-red-50 border-red-200 text-red-700"
                  }`}>
                    {linkMsg.ok
                      ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    }
                    <p className="text-sm font-medium">{linkMsg.text}</p>
                  </div>
                )}

                {showLinkForm && (
                  <div className="bg-white rounded-2xl border border-amber-200 p-5 space-y-4">
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700">
                        A chave de API é enviada via HTTPS ao servidor e criptografada imediatamente.
                        Ela nunca é armazenada em texto puro, não aparece em logs e não retorna em nenhuma resposta.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">
                          ID da Subconta Asaas (production) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={linkAccountId}
                          onChange={e => setLinkAccountId(e.target.value)}
                          placeholder="cus_abc123..."
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">
                          Chave de API da Subconta (production) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showApiKey ? "text" : "password"}
                            value={linkApiKey}
                            onChange={e => setLinkApiKey(e.target.value)}
                            placeholder="$aact_..."
                            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-amber-300 font-mono"
                            autoComplete="off"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">
                          Wallet ID (opcional)
                        </label>
                        <input
                          type="text"
                          value={linkWalletId}
                          onChange={e => setLinkWalletId(e.target.value)}
                          placeholder="wallet_..."
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleLinkAccount}
                      disabled={!linkAccountId.trim() || !linkApiKey.trim() || linking}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                        linkAccountId.trim() && linkApiKey.trim() && !linking
                          ? "bg-amber-600 hover:bg-amber-700 text-white"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {linking
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Vinculando...</>
                        : <><Link2 className="w-4 h-4" /> Vincular e Verificar Conta de Produção</>
                      }
                    </button>
                  </div>
                )}
              </section>

              {/* Gerenciamento do Piloto */}
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                  Gerenciamento do Piloto
                </h2>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">

                  {/* Estado atual do piloto */}
                  <div className={`flex items-start gap-3 p-4 rounded-xl ${
                    pilotActive
                      ? "bg-green-50 border border-green-200"
                      : "bg-gray-50 border border-gray-200"
                  }`}>
                    {pilotActive
                      ? <Shield className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      : <FlaskConical className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    }
                    <div>
                      <p className={`text-sm font-bold ${pilotActive ? "text-green-800" : "text-gray-700"}`}>
                        {pilotActive ? "Piloto de Produção ATIVO" : "Produção BLOQUEADA (padrão seguro)"}
                      </p>
                      <p className={`text-xs mt-0.5 ${pilotActive ? "text-green-600" : "text-gray-500"}`}>
                        {pilotActive
                          ? "Cobranças reais autorizadas para esta empresa. Execute rollback quando finalizar os testes."
                          : "Nenhuma cobrança real será criada. Sandbox funcionando normalmente."}
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Habilitar */}
                    <button
                      onClick={() => setShowEnableModal(true)}
                      disabled={!canEnable || acting || pilotActive}
                      className={`flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                        canEnable && !pilotActive
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {acting
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Zap className="w-4 h-4" />
                      }
                      {pilotActive ? "Piloto já ativo" : "Habilitar Piloto de Produção"}
                    </button>

                    {/* Rollback */}
                    <button
                      onClick={() => setShowRollbackModal(true)}
                      disabled={!canRollback || acting}
                      className={`flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                        canRollback
                          ? "bg-red-600 hover:bg-red-700 text-white"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {acting
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <RotateCcw className="w-4 h-4" />
                      }
                      Executar Rollback
                    </button>
                  </div>

                  {/* Aviso quando checklist tem falhas críticas */}
                  {!pilotActive && readiness && readiness.critical_failures > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                      <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-600">
                        <strong>{readiness.critical_failures} falha(s) crítica(s)</strong> bloqueiam a habilitação do piloto.
                        Resolva os itens com status FAIL no checklist antes de prosseguir.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Links rápidos */}
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                  Links Rápidos
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Cobranças",    path: "/app/gofit-pay/cobrancas",    desc: "Emitir e auditar cobranças" },
                    { label: "Relatórios",   path: "/app/gofit-pay/relatorios",   desc: "Conciliação e KPIs"          },
                    { label: "Inadimplência",path: "/app/gofit-pay/inadimplencia",desc: "Cobranças vencidas"          },
                  ].map(({ label, path, desc }) => (
                    <button key={path} onClick={() => navigate(path)}
                      className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm p-4 text-left transition-all group">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

/* ─── Componentes auxiliares ────────────────────────────────────── */
function StatusField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {children}
    </div>
  );
}

function BoolBadge({
  v, trueLabel, falseLabel,
  trueColor = "green", falseColor = "red",
}: {
  v: boolean; trueLabel: string; falseLabel: string;
  trueColor?: string; falseColor?: string;
}) {
  const cls = v
    ? trueColor === "green" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
    : falseColor === "gray" ? "bg-gray-100 text-gray-500"   : "bg-red-100 text-red-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {v ? trueLabel : falseLabel}
    </span>
  );
}

function SecretPresenceBadge({ present }: { present: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
      present ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
    }`}>
      {present ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {present ? "Configurado" : "Ausente"}
    </span>
  );
}
