/**
 * Fase 3 — GoFit Pay: Dashboard básico
 * Rota: /app/gofit-pay
 *
 * - Exibe status de onboarding
 * - KPI cards (vazios por enquanto)
 * - Lista de cobranças (vazia)
 * - NÃO chama Asaas
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CreditCard, Clock, CheckCircle2, AlertCircle,
  TrendingUp, Wallet, Users, ArrowUpRight,
  RefreshCcw, Loader2, Settings, ChevronRight,
  QrCode, FileText, XCircle,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ─── Status config ──────────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; desc: string }> = {
  rascunho:   { label: "Rascunho",          color: "gray",   icon: Clock,         desc: "Você iniciou o cadastro mas ainda não enviou para análise." },
  enviado:    { label: "Em análise",         color: "blue",   icon: Clock,         desc: "Seus dados foram enviados e estão sendo analisados pela nossa equipe." },
  em_analise: { label: "Em análise",         color: "blue",   icon: Clock,         desc: "Nossa equipe está revisando seus documentos. Prazo: até 2 dias úteis." },
  ativo:      { label: "Ativo",              color: "green",  icon: CheckCircle2,  desc: "Seu GoFit Pay está ativo e pronto para receber pagamentos." },
  suspenso:   { label: "Suspenso",           color: "yellow", icon: AlertCircle,   desc: "Sua conta está temporariamente suspensa. Entre em contato com o suporte." },
  cancelado:  { label: "Cancelado",          color: "red",    icon: XCircle,       desc: "Sua conta foi cancelada. Reative para voltar a receber pagamentos." },
};

const COLOR_CLASSES: Record<string, { badge: string; icon: string; border: string }> = {
  gray:   { badge: "bg-gray-100 text-gray-600",   icon: "text-gray-500",   border: "border-gray-200" },
  blue:   { badge: "bg-blue-100 text-blue-700",   icon: "text-blue-500",   border: "border-blue-200" },
  green:  { badge: "bg-green-100 text-green-700", icon: "text-green-500",  border: "border-green-200" },
  yellow: { badge: "bg-yellow-100 text-yellow-700", icon: "text-yellow-500", border: "border-yellow-200" },
  red:    { badge: "bg-red-100 text-red-700",     icon: "text-red-500",    border: "border-red-200" },
};

/* ─── KPI card ───────────────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, sub, color = "gray" }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
  const iconColor = color === "green" ? "text-green-600" : color === "blue" ? "text-blue-600" : color === "red" ? "text-red-500" : "text-gray-500";
  const iconBg    = color === "green" ? "bg-green-100"  : color === "blue" ? "bg-blue-100"  : color === "red" ? "bg-red-100"  : "bg-gray-100";
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-xl font-black text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function GoFitPayPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [onboardingStatus, setOnboardingStatus] = useState<string>("enviado");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.contractorId) return;
    loadConfig();
  }, [user?.contractorId]);

  async function loadConfig() {
    if (!user?.contractorId) return;

    const { data } = await supabase
      .from("gofit_pay_config")
      .select("onboarding_status")
      .eq("contractor_id", user!.contractorId)
      .maybeSingle();

    if (data) setOnboardingStatus(data.onboarding_status ?? "enviado");
    setLoading(false);
  }

  const statusInfo = STATUS_CONFIG[onboardingStatus] ?? STATUS_CONFIG["enviado"];
  const colorCls   = COLOR_CLASSES[statusInfo.color] ?? COLOR_CLASSES["gray"];
  const StatusIcon = statusInfo.icon;

  const isAtivo = onboardingStatus === "ativo";

  return (
    <AppLayout>
      <div className="flex flex-col min-h-full bg-gray-50">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <h1 className="text-base font-black text-gray-900">GoFit Pay</h1>
                <p className="text-xs text-gray-400">Gateway de pagamentos integrado</p>
              </div>

              <span className={`ml-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${colorCls.badge}`}>
                <StatusIcon className="w-3 h-3" />
                {statusInfo.label}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isAtivo && (
                <button onClick={() => navigate("/app/loja/gofit-pay/ativar")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors">
                  <ArrowUpRight className="w-3 h-3" />
                  Continuar ativação
                </button>
              )}
              <button onClick={() => navigate("/app/loja/gofit-pay")}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 px-8 py-8 max-w-6xl mx-auto w-full">

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 justify-center mt-20">
              <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
            </div>
          ) : (
            <>
              {/* Banner de status (só quando não ativo) */}
              {!isAtivo && (
                <div className={`flex items-start gap-3 rounded-2xl border p-5 mb-6 ${colorCls.border} bg-white`}>
                  <StatusIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${colorCls.icon}`} />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900 mb-0.5">{statusInfo.label}</p>
                    <p className="text-xs text-gray-500">{statusInfo.desc}</p>
                    {(onboardingStatus === "enviado" || onboardingStatus === "em_analise") && (
                      <p className="text-xs text-gray-400 mt-2">
                        Em caso de dúvidas, entre em contato com o suporte GoFit.
                      </p>
                    )}
                  </div>
                  {(onboardingStatus === "rascunho" || onboardingStatus === "cancelado") && (
                    <button onClick={() => navigate("/app/loja/gofit-pay/ativar")}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors flex-shrink-0">
                      Continuar <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <KpiCard
                  icon={Wallet}
                  label="Recebido no mês"
                  value={isAtivo ? "R$ 0,00" : "—"}
                  sub={isAtivo ? "Nenhuma cobrança liquidada" : "Disponível após ativação"}
                  color="green"
                />
                <KpiCard
                  icon={Clock}
                  label="Aguardando pagamento"
                  value={isAtivo ? "R$ 0,00" : "—"}
                  sub={isAtivo ? "0 cobranças em aberto" : "Disponível após ativação"}
                  color="blue"
                />
                <KpiCard
                  icon={TrendingUp}
                  label="Cobranças emitidas"
                  value={isAtivo ? "0" : "—"}
                  sub={isAtivo ? "Este mês" : "Disponível após ativação"}
                />
                <KpiCard
                  icon={Users}
                  label="Alunos com cobrança"
                  value={isAtivo ? "0" : "—"}
                  sub={isAtivo ? "Nenhum" : "Disponível após ativação"}
                />
              </div>

              {/* Lista de cobranças vazia */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                  <h2 className="text-sm font-bold text-gray-900">Cobranças recentes</h2>
                  {isAtivo && (
                    <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                      <RefreshCcw className="w-3 h-3" /> Atualizar
                    </button>
                  )}
                </div>

                {/* Empty state */}
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
                  {isAtivo ? (
                    <>
                      <div className="flex gap-2">
                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                          <QrCode className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-purple-600" />
                        </div>
                      </div>
                      <p className="text-sm font-bold text-gray-700">Nenhuma cobrança emitida ainda</p>
                      <p className="text-xs text-gray-400 max-w-xs">
                        Quando você emitir cobranças por Pix, boleto ou cartão, elas aparecerão aqui.
                      </p>
                      <button className="mt-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors">
                        Emitir primeira cobrança
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-bold text-gray-600">Módulo ainda não ativo</p>
                      <p className="text-xs text-gray-400 max-w-xs">
                        {onboardingStatus === "enviado" || onboardingStatus === "em_analise"
                          ? "Suas cobranças aparecerão aqui assim que o GoFit Pay for aprovado."
                          : "Complete a ativação para começar a emitir cobranças."}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Formas de pagamento suportadas */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { icon: QrCode,     label: "Pix",             desc: "Confirmação em segundos",     color: "text-green-600 bg-green-100"  },
                  { icon: FileText,   label: "Boleto bancário", desc: "Prazo de até 3 dias úteis",   color: "text-blue-600 bg-blue-100"    },
                  { icon: CreditCard, label: "Cartão de crédito", desc: "1x a 12x sem juros",       color: "text-purple-600 bg-purple-100" },
                ].map(({ icon: Icon, label, desc, color }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-800">{label}</p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </div>
                    {isAtivo ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-300 ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
