/**
 * Fase 2 — Loja de Módulos GoFit
 *
 * Responsabilidades desta página:
 * - Carregar catálogo global de módulos (tabela `modules`)
 * - Carregar status de cada módulo para a empresa logada (tabela `company_modules`)
 * - Exibir cards com botão de ação conforme status
 * - NÃO chama Asaas
 * - NÃO altera financeiro
 * - NÃO altera venda ou baixa manual
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CreditCard, MessageSquare, Sparkles, Apple, ClipboardList,
  Loader2, CheckCircle2, Clock, AlertCircle, ChevronRight,
  Store, Zap, ArrowRight, RefreshCw,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ─── Tipos ──────────────────────────────────────────────────────── */
interface Module {
  id:          string;
  slug:        string;
  name:        string;
  description: string;
  route:       string | null;
  icon:        string;
  status:      "active" | "coming_soon" | "beta" | "deprecated";
  sort_order:  number;
}

type CompanyStatus =
  | "inactive"
  | "active"
  | "pending"
  | "in_review"
  | "cancelled"
  | "coming_soon";

interface CompanyModule {
  id:           string;
  module_id:    string;
  status:       CompanyStatus;
  activated_at: string | null;
  config_json:  Record<string, unknown>;
}

/* ─── Mapa de ícones ─────────────────────────────────────────────── */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  CreditCard,
  MessageSquare,
  Sparkles,
  Apple,
  ClipboardList,
};

/* ─── Config visual por status da empresa ────────────────────────── */
const STATUS_CONFIG: Record<CompanyStatus, {
  label:     string;
  badgeCls:  string;
  btnLabel:  string;
  btnCls:    string;
  icon:      React.ComponentType<{ className?: string }>;
  canClick:  boolean;
}> = {
  inactive: {
    label:    "Disponível",
    badgeCls: "bg-primary/10 text-primary",
    btnLabel: "Ativar",
    btnCls:   "bg-primary hover:bg-primary/90 text-white",
    icon:     Zap,
    canClick: true,
  },
  pending: {
    label:    "Pendente",
    badgeCls: "bg-yellow-100 text-yellow-700",
    btnLabel: "Continuar",
    btnCls:   "bg-yellow-500 hover:bg-yellow-600 text-white",
    icon:     ArrowRight,
    canClick: true,
  },
  in_review: {
    label:    "Em análise",
    badgeCls: "bg-blue-100 text-blue-700",
    btnLabel: "Acompanhar",
    btnCls:   "bg-blue-500 hover:bg-blue-600 text-white",
    icon:     AlertCircle,
    canClick: true,
  },
  active: {
    label:    "Ativo",
    badgeCls: "bg-green-100 text-green-700",
    btnLabel: "Gerenciar",
    btnCls:   "bg-green-600 hover:bg-green-700 text-white",
    icon:     CheckCircle2,
    canClick: true,
  },
  cancelled: {
    label:    "Cancelado",
    badgeCls: "bg-red-100 text-red-600",
    btnLabel: "Reativar",
    btnCls:   "bg-red-500 hover:bg-red-600 text-white",
    icon:     RefreshCw,
    canClick: true,
  },
  coming_soon: {
    label:    "Em breve",
    badgeCls: "bg-gray-100 text-gray-500",
    btnLabel: "Em breve",
    btnCls:   "bg-gray-200 text-gray-400 cursor-not-allowed",
    icon:     Clock,
    canClick: false,
  },
};

/* ─── Descrição curta por slug (exibida no card) ─────────────────── */
const SHORT_DESC: Record<string, string> = {
  gofit_pay:       "Pix, Boleto e Cartão integrados ao GoFit",
  gofit_mensagens: "WhatsApp, SMS e automações de comunicação",
  gofit_ia:        "Insights, sugestões e assistente com IA",
  gofit_nutri:     "Planos alimentares e fichas nutricionais",
  gofit_avaliacoes:"Avaliações físicas com gráficos de evolução",
};

/* ─── Cor do gradiente por módulo ────────────────────────────────── */
const MODULE_GRADIENT: Record<string, string> = {
  gofit_pay:       "from-primary/10 to-orange-50",
  gofit_mensagens: "from-green-50 to-emerald-50",
  gofit_ia:        "from-purple-50 to-violet-50",
  gofit_nutri:     "from-lime-50 to-green-50",
  gofit_avaliacoes:"from-blue-50 to-sky-50",
};

const MODULE_ICON_COLOR: Record<string, string> = {
  gofit_pay:       "text-primary bg-primary/10",
  gofit_mensagens: "text-green-600 bg-green-100",
  gofit_ia:        "text-purple-600 bg-purple-100",
  gofit_nutri:     "text-lime-600 bg-lime-100",
  gofit_avaliacoes:"text-blue-600 bg-blue-100",
};

/* ══════════════════════════════════════════════════════════════════ */
export default function LojaModulosPage() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const [modules,        setModules]        = useState<Module[]>([]);
  const [companyModules, setCompanyModules] = useState<CompanyModule[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [activating,     setActivating]     = useState<string | null>(null); // module_id

  /* ── Carrega catálogo + status da empresa ── */
  useEffect(() => {
    if (!user?.contractorId) return;
    loadData();
  }, [user?.contractorId]);

  async function loadData() {
    if (!user?.contractorId) return;
    setLoading(true);

    const [{ data: mods, error: modsErr }, { data: comps, error: compsErr }] = await Promise.all([
      supabase
        .from("modules")
        .select("id, slug, name, description, route, icon, status, sort_order")
        .eq("is_visible", true)
        .order("sort_order"),
      supabase
        .from("company_modules")
        .select("id, module_id, status, activated_at, config_json")
        .eq("contractor_id", user!.contractorId),
    ]);

    if (modsErr)  console.error("[loja] erro ao carregar modules:", modsErr.message);
    if (compsErr) console.error("[loja] erro ao carregar company_modules:", compsErr.message);

    setModules((mods ?? []) as Module[]);
    setCompanyModules((comps ?? []) as CompanyModule[]);
    setLoading(false);
  }

  /* ── Resolve status da empresa para um módulo ── */
  function getCompanyModule(moduleId: string): CompanyModule | null {
    return companyModules.find(cm => cm.module_id === moduleId) ?? null;
  }

  function resolveStatus(mod: Module): CompanyStatus {
    const cm = getCompanyModule(mod.id);
    if (!cm) {
      // Módulo de catálogo coming_soon → sempre coming_soon para empresa
      if (mod.status === "coming_soon") return "coming_soon";
      return "inactive";
    }
    return cm.status;
  }

  /* ── Ação do botão conforme status ── */
  async function handleAction(mod: Module, currentStatus: CompanyStatus) {
    if (!user?.contractorId) return;
    const cfg = STATUS_CONFIG[currentStatus];
    if (!cfg.canClick) return;

    // GoFit Pay com status inactive → iniciar ativação
    if (mod.slug === "gofit_pay" && currentStatus === "inactive") {
      await activateModule(mod);
      return;
    }

    // GoFit Pay ativo → navegar para a página de gerenciamento (Fase 3+)
    if (mod.slug === "gofit_pay" && currentStatus === "active") {
      navigate("/app/gofit-pay");
      return;
    }

    // GoFit Pay pending/in_review → navegar para acompanhamento (Fase 3+)
    if (mod.slug === "gofit_pay" && (currentStatus === "pending" || currentStatus === "in_review")) {
      navigate("/app/loja/gofit-pay");
      return;
    }

    // GoFit Pay cancelled → reativar
    if (mod.slug === "gofit_pay" && currentStatus === "cancelled") {
      await activateModule(mod);
      return;
    }
  }

  /* ── Ativar módulo: cria ou atualiza company_modules ── */
  async function activateModule(mod: Module) {
    if (!user?.contractorId) return;

    // RLS de company_modules exige sessão Supabase Auth (auth.uid())
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sessão expirada. Saia e entre novamente para ativar módulos.");
      return;
    }

    setActivating(mod.id);

    const cm = getCompanyModule(mod.id);

    // Já ativo — nada a inserir, apenas sincroniza a UI
    if (cm?.status === "active") {
      setActivating(null);
      await loadData();
      return;
    }

    if (cm) {
      // Já existe — atualizar status
      const { error } = await supabase
        .from("company_modules")
        .update({
          status:       "pending",
          activated_at: new Date().toISOString(),
          updated_at:   new Date().toISOString(),
        })
        .eq("id", cm.id)
        .eq("contractor_id", user!.contractorId);

      if (error) {
        console.error("[loja] erro ao reativar módulo:", error.message);
        toast.error("Erro ao reativar módulo");
        setActivating(null);
        return;
      }
    } else {
      // Não existe (ou o SELECT não enxergou) — upsert idempotente evita
      // violar UNIQUE(contractor_id, module_id) se o registro já existir
      const { error } = await supabase
        .from("company_modules")
        .upsert({
          contractor_id: user!.contractorId,
          module_id:     mod.id,
          status:        "pending",
          activated_at:  new Date().toISOString(),
          config_json:   {},
        }, { onConflict: "contractor_id,module_id" });

      if (error) {
        console.error("[loja] erro ao ativar módulo:", error.message);
        toast.error("Erro ao ativar módulo");
        setActivating(null);
        return;
      }
    }

    toast.success(`${mod.name} ativado! Em breve você receberá as instruções de configuração.`);
    setActivating(null);
    await loadData(); // recarrega para refletir novo status
  }

  /* ── Conta módulos ativos ── */
  const totalAtivos = companyModules.filter(cm => cm.status === "active").length;

  /* ════════════════════════════════════════════ RENDER ════════════ */
  return (
    <AppLayout>
      <div className="flex flex-col min-h-full bg-gray-50">

        {/* ── Hero header ── */}
        <div className="bg-white border-b border-gray-100">
          <div className="px-8 py-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Store className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Loja de Módulos</h1>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Expanda as funcionalidades do GoFit para o seu negócio
                  </p>
                </div>
              </div>

              {/* Badge resumo */}
              {!loading && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Módulos ativos</p>
                    <p className="text-2xl font-bold text-gray-900">{totalAtivos}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Conteúdo ── */}
        <div className="flex-1 px-8 py-8">

          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-gray-400">Carregando módulos...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Grid de cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {modules.map(mod => {
                  const companyStatus = resolveStatus(mod);
                  const statusCfg     = STATUS_CONFIG[companyStatus];
                  const IconComp      = ICON_MAP[mod.icon] ?? CreditCard;
                  const StatusIcon    = statusCfg.icon;
                  const gradient      = MODULE_GRADIENT[mod.slug] ?? "from-gray-50 to-gray-100";
                  const iconColor     = MODULE_ICON_COLOR[mod.slug] ?? "text-gray-500 bg-gray-100";
                  const shortDesc     = SHORT_DESC[mod.slug] ?? mod.description;
                  const cm            = getCompanyModule(mod.id);
                  const isGoFitPay    = mod.slug === "gofit_pay";
                  const isLoading     = activating === mod.id;
                  const btnLabel      = isGoFitPay && companyStatus === "active"
                    ? "Acessar GoFit Pay"
                    : statusCfg.btnLabel;

                  return (
                    <div
                      key={mod.id}
                      className={`relative bg-gradient-to-br ${gradient} rounded-2xl border border-gray-100 overflow-hidden flex flex-col transition-all hover:shadow-md hover:-translate-y-0.5`}
                    >
                      {/* Badge de status */}
                      <div className="absolute top-4 right-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${statusCfg.badgeCls}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusCfg.label}
                        </span>
                      </div>

                      {/* Corpo do card */}
                      <div className="p-6 flex-1">
                        {/* Ícone */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${iconColor}`}>
                          <IconComp className="w-6 h-6" />
                        </div>

                        {/* Nome */}
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                          {mod.name}
                          {isGoFitPay && (
                            <span className="ml-2 text-xs bg-primary text-white px-2 py-0.5 rounded-full align-middle font-semibold">
                              Destaque
                            </span>
                          )}
                        </h3>

                        {/* Descrição curta */}
                        <p className="text-sm text-gray-500 mb-1">{shortDesc}</p>

                        {/* Descrição longa — visível apenas no GoFit Pay */}
                        {isGoFitPay && (
                          <p className="text-xs text-gray-400 mt-2 leading-relaxed line-clamp-3">
                            {mod.description}
                          </p>
                        )}

                        {/* Data de ativação (se ativo) */}
                        {cm?.activated_at && companyStatus === "active" && (
                          <p className="text-xs text-green-600 mt-3 font-medium">
                            ✓ Ativo desde {new Date(cm.activated_at).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>

                      {/* Footer do card */}
                      <div className="px-6 pb-6">
                        <button
                          onClick={() => handleAction(mod, companyStatus)}
                          disabled={!statusCfg.canClick || isLoading}
                          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${statusCfg.btnCls} ${!statusCfg.canClick ? "opacity-60" : ""}`}
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <StatusIcon className="w-4 h-4" />
                          )}
                          {isLoading ? "Ativando..." : btnLabel}
                          {statusCfg.canClick && !isLoading && (
                            <ChevronRight className="w-4 h-4 ml-auto" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Nota de rodapé */}
              <div className="mt-10 flex items-start gap-3 bg-white rounded-xl border border-gray-100 px-6 py-4 max-w-2xl">
                <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-600">Sobre os módulos</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    Módulos marcados como <strong>"Em breve"</strong> estão em desenvolvimento.
                    Ao ativar o <strong>GoFit Pay</strong>, sua conta será configurada para receber
                    pagamentos via Pix, Boleto e Cartão sem sair do GoFit.
                    Nenhuma chave ou dado sensível é armazenado no navegador.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
