/**
 * Fase 3 — GoFit Pay: Landing page da Loja de Módulos
 * Rota: /app/loja/gofit-pay
 *
 * Responsabilidades:
 * - Apresentar o módulo GoFit Pay com benefícios
 * - CTA para ativar (→ wizard) ou gerenciar (→ dashboard)
 * - NÃO chama Asaas
 * - NÃO altera financeiro
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CreditCard, CheckCircle2, ArrowLeft, Zap, Clock,
  ArrowRight, QrCode, FileText, RefreshCcw,
  TrendingDown, Link2, Shield, ChevronRight, Loader2,
  AlertTriangle, RotateCcw,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GoFitPayService } from "@/services/gofit-pay";

/* ─── Benefícios ─────────────────────────────────────────────────── */
const BENEFICIOS = [
  { icon: Zap,          title: "Cobrança automática",              desc: "Envie cobranças automáticas para seus alunos no vencimento da mensalidade, sem trabalho manual." },
  { icon: RefreshCcw,   title: "Baixa automática",                 desc: "Quando o aluno paga, o financeiro do GoFit é atualizado automaticamente via webhook." },
  { icon: QrCode,       title: "Pix, boleto e cartão",             desc: "Ofereça todas as formas de pagamento que seus alunos precisam, em um só lugar." },
  { icon: TrendingDown, title: "Controle de inadimplência",        desc: "Acompanhe em tempo real quem está em atraso e envie lembretes automáticos." },
  { icon: Link2,        title: "Integrado a contratos",            desc: "Conectado ao fluxo de venda e contratos do GoFit. Tudo em um sistema." },
  { icon: Shield,       title: "Seguro e certificado",             desc: "Operação realizada por gateway certificado pelo Banco Central do Brasil." },
];

/* ─── Como funciona ─────────────────────────────────────────────── */
const COMO_FUNCIONA = [
  { step: "01", title: "Ative o GoFit Pay",       desc: "Preencha os dados da sua empresa e conta bancária para repasse." },
  { step: "02", title: "Emita a primeira cobrança", desc: "No momento da venda ou diretamente em Contas a Receber." },
  { step: "03", title: "Aluno recebe e paga",      desc: "Link de pagamento por Pix, boleto ou cartão enviado diretamente." },
  { step: "04", title: "Baixa automática",         desc: "O GoFit registra o pagamento assim que o gateway confirma." },
];

/* ══════════════════════════════════════════════════════════════════ */
export default function GoFitPayLandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [companyStatus,    setCompanyStatus]    = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [retrying,         setRetrying]         = useState(false);

  useEffect(() => {
    if (!user?.contractorId) return;
    loadStatus();
  }, [user?.contractorId]);

  async function loadStatus() {
    if (!user?.contractorId) return;

    // Busca o módulo gofit_pay
    const { data: mod } = await supabase
      .from("modules")
      .select("id")
      .eq("slug", "gofit_pay")
      .maybeSingle();

    if (!mod) { setLoading(false); return; }

    // Status do módulo por empresa
    const { data: cm } = await supabase
      .from("company_modules")
      .select("status")
      .eq("contractor_id", user!.contractorId)
      .eq("module_id", mod.id)
      .maybeSingle();

    setCompanyStatus(cm?.status ?? null);

    // Status do onboarding (wizard) — distingue incompleto de completo
    const { data: cfg } = await supabase
      .from("gofit_pay_config")
      .select("onboarding_status")
      .eq("contractor_id", user!.contractorId)
      .maybeSingle();

    setOnboardingStatus(cfg?.onboarding_status ?? null);
    setLoading(false);
  }

  // Wizard completo quando onboarding_status é 'enviado' ou posterior
  const wizardCompleto = [
    "enviado", "em_analise", "ativo", "suspenso", "activation_failed",
  ].includes(onboardingStatus ?? "");

  const isActivationFailed = companyStatus === "activation_failed";

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await GoFitPayService.retryActivation();
    } catch { /* Edge Function captura — navegar para dashboard */ }
    setRetrying(false);
    await loadStatus();               // recarrega status após retry
    navigate("/app/gofit-pay");
  }

  function handleCTA() {
    if (isActivationFailed) {
      void handleRetry();
      return;
    }
    if (!companyStatus || companyStatus === "inactive" || companyStatus === "cancelled") {
      navigate("/app/loja/gofit-pay/ativar");
    } else if (companyStatus === "pending" && !wizardCompleto) {
      navigate("/app/loja/gofit-pay/ativar");
    } else if (companyStatus === "pending" && wizardCompleto) {
      navigate("/app/gofit-pay");
    } else if (companyStatus === "in_review") {
      navigate("/app/gofit-pay");
    } else if (companyStatus === "active") {
      navigate("/app/gofit-pay");
    }
  }

  const ctaLabel = (() => {
    if (retrying) return "Tentando novamente...";
    if (isActivationFailed)                              return "Tentar novamente";
    if (!companyStatus || companyStatus === "inactive")  return "Ativar GoFit Pay";
    if (companyStatus === "cancelled")                   return "Reativar GoFit Pay";
    if (companyStatus === "pending" && !wizardCompleto)  return "Continuar ativação";
    if (companyStatus === "pending" && wizardCompleto)   return "Acompanhar status";
    if (companyStatus === "in_review")                   return "Acompanhar análise";
    if (companyStatus === "active")                      return "Acessar GoFit Pay";
    return "Ativar GoFit Pay";
  })();

  const isAtivo      = companyStatus === "active";
  const isAguardando = companyStatus === "pending" && wizardCompleto;

  return (
    <AppLayout>
      <div className="flex flex-col min-h-full bg-gray-50">

        {/* ── Sub-header ── */}
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/app/loja")}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-400">Loja de Módulos</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-xs font-semibold text-gray-700">GoFit Pay</span>

            {isAtivo && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                <CheckCircle2 className="w-3 h-3" /> Ativo
              </span>
            )}
            {companyStatus === "in_review" && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                <Clock className="w-3 h-3" /> Em análise
              </span>
            )}
            {isAguardando && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold">
                <Clock className="w-3 h-3" /> Dados enviados
              </span>
            )}
            {companyStatus === "pending" && !wizardCompleto && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">
                <Clock className="w-3 h-3" /> Ativação pendente
              </span>
            )}
            {isActivationFailed && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                <AlertTriangle className="w-3 h-3" /> Falha na ativação
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 px-8 py-8 max-w-5xl mx-auto w-full">

          {/* ── Hero ── */}
          <div className="bg-gradient-to-br from-primary/5 to-orange-50 rounded-3xl border border-primary/10 p-10 mb-8 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-widest">Módulo</p>
                  <h1 className="text-3xl font-black text-gray-900">GoFit Pay</h1>
                </div>
              </div>

              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                Receba mensalidades dos seus alunos por <strong>Pix</strong>, <strong>boleto</strong> e{" "}
                <strong>cartão de crédito</strong>, com baixa automática no financeiro do GoFit.
              </p>

              <p className="text-sm text-gray-500 mb-8">
                Seus alunos pagam sem sair da experiência GoFit.
                Você acompanha tudo em tempo real, sem acessar outro sistema.
              </p>

              {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Verificando status...
                </div>
              ) : (
                <button
                  onClick={handleCTA}
                  disabled={retrying}
                  className={`inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-base transition-all shadow-lg hover:scale-105 disabled:opacity-70 disabled:cursor-wait ${
                    isActivationFailed
                      ? "bg-red-600 hover:bg-red-700 text-white shadow-red-200"
                      : "bg-primary hover:bg-primary/90 text-white shadow-primary/20 hover:shadow-primary/30"
                  }`}
                >
                  {retrying ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isActivationFailed ? (
                    <RotateCcw className="w-5 h-5" />
                  ) : (isAtivo || isAguardando) ? (
                    <ArrowRight className="w-5 h-5" />
                  ) : (
                    <Zap className="w-5 h-5" />
                  )}
                  {ctaLabel}
                </button>
              )}
            </div>

            {/* Visual decorativo */}
            <div className="hidden md:flex flex-col gap-3 w-64 flex-shrink-0">
              {[
                { icon: QrCode,    label: "Pix",      color: "text-green-600 bg-green-100" },
                { icon: FileText,  label: "Boleto",   color: "text-blue-600 bg-blue-100"   },
                { icon: CreditCard,label: "Cartão",   color: "text-purple-600 bg-purple-100"},
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex items-center gap-3 bg-white/80 backdrop-blur rounded-xl px-4 py-3 shadow-sm border border-white">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{label}</span>
                  <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                </div>
              ))}
            </div>
          </div>

          {/* ── Benefícios ── */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-5">Por que usar o GoFit Pay?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {BENEFICIOS.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-sm transition-shadow">
                  <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center mb-3">
                    <Icon className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">{title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Como funciona ── */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-5">Como funciona</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {COMO_FUNCIONA.map(({ step, title, desc }, i) => (
                <div key={step} className="relative bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="text-3xl font-black text-primary/20 mb-2">{step}</div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">{title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                  {i < COMO_FUNCIONA.length - 1 && (
                    <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 z-10 bg-white rounded-full p-0.5" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── CTA final ── */}
          {!isAtivo && !isAguardando && !loading && (
            <div className="bg-primary rounded-2xl p-8 text-center text-white">
              <h2 className="text-xl font-black mb-2">Pronto para começar?</h2>
              <p className="text-primary-foreground/80 text-sm mb-6">
                A ativação leva menos de 5 minutos. Seus dados ficam seguros e protegidos.
              </p>
              <button
                onClick={handleCTA}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-white text-primary font-bold hover:bg-orange-50 transition-colors"
              >
                <Zap className="w-4 h-4" />
                {ctaLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
