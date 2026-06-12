/**
 * Fase 15.5 — GoFit Pay: Conta e configurações (estilo NextFit Pay)
 * Rota: /app/gofit-pay/conta
 *
 * - Lista a(s) conta(s) de repasse da empresa (gofit_pay_config + gofit_pay_accounts)
 * - Menu: Detalhes (etapas) / Configurar / Alterar conta de repasse / Visualizar taxas
 * - Configurações espelhadas em gofit_pay_settings (consumidas pela cobrança)
 * - NUNCA exibe chaves/API keys — apenas dados cadastrais e bancários
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CreditCard, Loader2, ArrowLeft, MoreVertical, Eye, Settings,
  ArrowLeftRight, Percent, X, CheckCircle2, Landmark, Building2,
  UserRound, FileCheck2, ChevronRight, Save,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import GoFitPayFeesModal from "./GoFitPayFeesModal";

interface PayConfig {
  id: string;
  onboarding_status: string | null;
  tipo_empresa: string | null; cnpj: string | null;
  razao_social: string | null; nome_fantasia: string | null;
  cep: string | null; logradouro: string | null; numero_end: string | null;
  bairro: string | null; cidade: string | null; estado: string | null; complemento: string | null;
  resp_nome: string | null; resp_cpf: string | null; resp_nascimento: string | null;
  resp_email: string | null; resp_celular: string | null; resp_renda_mensal: number | null;
  banco_codigo: string | null; banco_nome: string | null; tipo_conta: string | null;
  agencia: string | null; agencia_digito: string | null;
  conta_num: string | null; conta_digito: string | null;
  titular_nome: string | null; titular_documento: string | null;
  nome_exibicao: string | null;
  multa_ativa: boolean | null; multa_percentual: number | null;
  juros_ativo: boolean | null; juros_percentual: number | null;
  desconto_ativo: boolean | null; desconto_percentual: number | null; desconto_dias_antecipacao: number | null;
  transferencia_automatica: boolean | null; antecipacao_automatica: boolean | null;
  created_at: string;
}

interface PayAccount {
  status: string | null;
  provider_environment: string | null;
  activated_at: string | null;
}

const inputCls =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 " +
  "placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

const fmtD = (s: string | null) => s ? new Date(s).toLocaleDateString("pt-BR") : "—";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value ?? "—"}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function GoFitPayContaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cfg, setCfg]         = useState<PayConfig | null>(null);
  const [account, setAccount] = useState<PayAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const [showDetalhes, setShowDetalhes] = useState(false);
  const [showConfig,   setShowConfig]   = useState(false);
  const [showRepasse,  setShowRepasse]  = useState(false);
  const [showFees,     setShowFees]     = useState(false);

  const load = useCallback(async () => {
    if (!user?.contractorId) return;
    setLoading(true);
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from("gofit_pay_config").select("*").eq("contractor_id", user.contractorId).maybeSingle(),
      supabase.from("gofit_pay_accounts")
        .select("status, provider_environment, activated_at")
        .eq("contractor_id", user.contractorId).eq("provider", "asaas")
        .order("activated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setCfg(c as PayConfig | null);
    setAccount(a as PayAccount | null);
    setLoading(false);
  }, [user?.contractorId]);

  useEffect(() => { load(); }, [load]);

  const ativo = account?.status === "active";

  return (
    <AppLayout>
      <div className="px-8 py-6 max-w-4xl space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/app/loja")} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">GoFit Pay — Conta</h1>
            <p className="text-sm text-gray-400">Conta de repasse, dados cadastrais e configurações de cobrança</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : !cfg ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center space-y-3">
            <CreditCard className="w-10 h-10 text-gray-200 mx-auto" />
            <p className="text-sm font-semibold text-gray-600">Nenhuma conta GoFit Pay configurada</p>
            <p className="text-xs text-gray-400">Ative o GoFit Pay na Loja para configurar sua conta.</p>
            <button onClick={() => navigate("/app/loja")}
              className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
              Ir para a Loja
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold bg-gray-50">
                  <th className="text-left px-5 py-3">Descrição</th>
                  <th className="text-left px-4 py-3">Titular</th>
                  <th className="text-left px-4 py-3">Data de criação</th>
                  <th className="text-left px-4 py-3">Ambiente</th>
                  <th className="text-center px-4 py-3">Situação</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-gray-900">
                    {cfg.banco_nome ?? "Conta de repasse"}
                  </td>
                  <td className="px-4 py-4 text-gray-700">{cfg.titular_nome ?? cfg.razao_social ?? "—"}</td>
                  <td className="px-4 py-4 text-gray-500">{fmtD(account?.activated_at ?? cfg.created_at)}</td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      account?.provider_environment === "production"
                        ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                      {account?.provider_environment === "production" ? "Produção" : "Sandbox"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      ativo ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {ativo ? "Ativo" : (account?.status ?? "Pendente")}
                    </span>
                  </td>
                  <td className="px-3 py-4 relative">
                    <button onClick={() => setMenuOpen(o => !o)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                        <div className="absolute right-0 top-10 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-56">
                          <button onClick={() => { setShowDetalhes(true); setMenuOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <Eye className="w-4 h-4 text-gray-400" /> Detalhes
                          </button>
                          <button onClick={() => { setShowConfig(true); setMenuOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <Settings className="w-4 h-4 text-gray-400" /> Configurar
                          </button>
                          <button onClick={() => { setShowRepasse(true); setMenuOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <ArrowLeftRight className="w-4 h-4 text-gray-400" /> Alterar conta de repasse
                          </button>
                          <button onClick={() => { setShowFees(true); setMenuOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <Percent className="w-4 h-4 text-gray-400" /> Visualizar taxas
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDetalhes && cfg && <DetalhesModal cfg={cfg} onClose={() => setShowDetalhes(false)} />}
      {showConfig && cfg && (
        <ConfigModal cfg={cfg} contractorId={user!.contractorId!} onSaved={load} onClose={() => setShowConfig(false)} />
      )}
      {showRepasse && cfg && (
        <RepasseModal cfg={cfg} contractorId={user!.contractorId!} onSaved={load} onClose={() => setShowRepasse(false)} />
      )}
      {showFees && <GoFitPayFeesModal onClose={() => setShowFees(false)} />}
    </AppLayout>
  );
}

/* ─── Modal: Detalhes (etapas como no NextFit) ───────────────────── */
function DetalhesModal({ cfg, onClose }: { cfg: PayConfig; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { key: "conta",      label: "Informações da conta",      icon: Landmark },
    { key: "empresa",    label: "Dados da empresa",           icon: Building2 },
    { key: "resp",       label: "Responsável administrativo", icon: UserRound },
    { key: "docs",       label: "Documentos",                 icon: FileCheck2 },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Detalhes do GoFit Pay</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
          <p className="text-sm font-bold text-gray-700 mt-3 flex items-center gap-2">
            {(() => { const I = steps[step].icon; return <I className="w-4 h-4 text-primary" />; })()}
            {steps[step].label}
          </p>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-5">
              <Field label="Descrição" value={cfg.banco_nome} />
              <Field label="Titular" value={cfg.titular_nome ?? cfg.razao_social} />
              <Field label="Documento do titular" value={cfg.titular_documento ?? cfg.cnpj} />
              <Field label="Banco" value={cfg.banco_nome} />
              <Field label="Tipo de conta" value={cfg.tipo_conta === "poupanca" ? "Conta poupança" : "Conta corrente"} />
              <Field label="Agência" value={cfg.agencia ? `${cfg.agencia}${cfg.agencia_digito ? `-${cfg.agencia_digito}` : ""}` : "—"} />
              <Field label="Conta" value={cfg.conta_num ? `${cfg.conta_num}${cfg.conta_digito ? `-${cfg.conta_digito}` : ""}` : "—"} />
            </div>
          )}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-5">
              <Field label="Tipo de empresa" value={cfg.tipo_empresa} />
              <Field label="CNPJ" value={cfg.cnpj} />
              <Field label="Nome fantasia" value={cfg.nome_fantasia} />
              <Field label="Razão social" value={cfg.razao_social} />
              <Field label="CEP" value={cfg.cep} />
              <Field label="Endereço" value={cfg.logradouro} />
              <Field label="Número" value={cfg.numero_end} />
              <Field label="Cidade" value={cfg.cidade} />
              <Field label="Bairro" value={cfg.bairro} />
              <Field label="Complemento" value={cfg.complemento} />
            </div>
          )}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-5">
              <Field label="Nome completo" value={cfg.resp_nome} />
              <Field label="CPF" value={cfg.resp_cpf} />
              <Field label="Data de nascimento" value={cfg.resp_nascimento ? fmtD(cfg.resp_nascimento) : "—"} />
              <Field label="E-mail" value={cfg.resp_email} />
              <Field label="Celular" value={cfg.resp_celular} />
              <Field label="Renda média mensal" value={cfg.resp_renda_mensal != null
                ? Number(cfg.resp_renda_mensal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"} />
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                Os documentos são validados pelo Asaas durante a aprovação da conta.
                O status abaixo reflete a situação do onboarding.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-gray-700">Onboarding:</span>
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                  cfg.onboarding_status === "ativo" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                  <CheckCircle2 className="w-3 h-3" />
                  {cfg.onboarding_status === "ativo" ? "Aprovado" : (cfg.onboarding_status ?? "Em análise")}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            className="text-sm font-bold text-gray-500 hover:text-gray-700">
            {step > 0 ? "VOLTAR" : "FECHAR"}
          </button>
          {step < steps.length - 1 && (
            <button onClick={() => setStep(step + 1)}
              className="inline-flex items-center gap-1 px-5 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
              PRÓXIMA ETAPA <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Modal: Configurações (multa/juros/desconto/transferência) ───── */
function ConfigModal({ cfg, contractorId, onSaved, onClose }: {
  cfg: PayConfig; contractorId: string; onSaved: () => void; onClose: () => void;
}) {
  const [nomeAtivo,   setNomeAtivo]   = useState(!!cfg.nome_exibicao);
  const [nome,        setNome]        = useState(cfg.nome_exibicao ?? "");
  const [multaAtiva,  setMultaAtiva]  = useState(cfg.multa_ativa ?? false);
  const [multaPct,    setMultaPct]    = useState(String(cfg.multa_percentual ?? 2));
  const [jurosAtivo,  setJurosAtivo]  = useState(cfg.juros_ativo ?? false);
  const [jurosPct,    setJurosPct]    = useState(String(cfg.juros_percentual ?? 1));
  const [descAtivo,   setDescAtivo]   = useState(cfg.desconto_ativo ?? false);
  const [descPct,     setDescPct]     = useState(String(cfg.desconto_percentual ?? 0));
  const [descDias,    setDescDias]    = useState(String(cfg.desconto_dias_antecipacao ?? 0));
  const [transfOff,   setTransfOff]   = useState(!(cfg.transferencia_automatica ?? true));
  const [antecip,     setAntecip]     = useState(cfg.antecipacao_automatica ?? false);
  const [saving,      setSaving]      = useState(false);

  async function handleSave() {
    const multa = Math.min(Math.max(parseFloat(multaPct.replace(",", ".")) || 0, 0), 80);
    const juros = Math.min(Math.max(parseFloat(jurosPct.replace(",", ".")) || 0, 0), 10);
    const desc  = Math.max(parseFloat(descPct.replace(",", ".")) || 0, 0);
    const dias  = Math.max(parseInt(descDias) || 0, 0);

    setSaving(true);
    const now = new Date().toISOString();

    const { error } = await supabase.from("gofit_pay_config").update({
      nome_exibicao: nomeAtivo ? nome.trim() || null : null,
      multa_ativa: multaAtiva,        multa_percentual: multa,
      juros_ativo: jurosAtivo,        juros_percentual: juros,
      desconto_ativo: descAtivo,      desconto_percentual: desc,
      desconto_dias_antecipacao: dias,
      transferencia_automatica: !transfOff,
      antecipacao_automatica: antecip,
      updated_at: now,
    }).eq("id", cfg.id);

    // Espelha nas settings consumidas pelo fluxo de cobrança
    await supabase.from("gofit_pay_settings").update({
      display_name: nomeAtivo ? nome.trim() || null : null,
      late_fee_enabled: multaAtiva,   late_fee_percent: multa,
      interest_enabled: jurosAtivo,   interest_percent: juros,
      early_discount_enabled: descAtivo, early_discount_percent: desc, early_discount_days: dias,
      auto_transfer_disabled: transfOff,
      auto_anticipation_enabled: antecip,
      updated_at: now,
    }).eq("contractor_id", contractorId);

    setSaving(false);
    if (error) { toast.error("Erro ao salvar configurações."); return; }
    toast.success("Configurações salvas.");
    onSaved();
    onClose();
  }

  const Toggle = ({ on, set }: { on: boolean; set: (v: boolean) => void }) => (
    <button onClick={() => set(!on)}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${on ? "bg-primary" : "bg-gray-200"}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" /> Configurações
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
          {/* Nome de exibição */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Toggle on={nomeAtivo} set={setNomeAtivo} />
              <p className="text-sm text-gray-700">Personalizar o nome de exibição nas cobranças no cartão de crédito.</p>
            </div>
            {nomeAtivo && (
              <div className="pl-12">
                <label className="text-xs text-gray-400 block mb-1">Nome de exibição (fatura: ASAAS*NOME)</label>
                <input value={nome} onChange={e => setNome(e.target.value.substring(0, 22))} className={`${inputCls} max-w-xs`} />
              </div>
            )}
          </div>

          {/* Multa */}
          <div className="flex items-center gap-3 flex-wrap">
            <Toggle on={multaAtiva} set={setMultaAtiva} />
            <p className="text-sm text-gray-700 flex-1">Aplicar multa (%) para pagamentos em atraso (boleto/Pix):</p>
            {multaAtiva && (
              <input value={multaPct} onChange={e => setMultaPct(e.target.value)} className={`${inputCls} max-w-[90px] text-center`} />
            )}
          </div>
          <p className="text-[11px] text-gray-400 pl-12 -mt-3">Aplicada automaticamente pelo banco após o vencimento. Máximo 80%.</p>

          {/* Juros */}
          <div className="flex items-center gap-3 flex-wrap">
            <Toggle on={jurosAtivo} set={setJurosAtivo} />
            <p className="text-sm text-gray-700 flex-1">Aplicar juros (%) ao mês para pagamentos em atraso (boleto/Pix):</p>
            {jurosAtivo && (
              <input value={jurosPct} onChange={e => setJurosPct(e.target.value)} className={`${inputCls} max-w-[90px] text-center`} />
            )}
          </div>
          <p className="text-[11px] text-gray-400 pl-12 -mt-3">Juros mensal sobre o valor total. Máximo 10%.</p>

          {/* Desconto antecipado */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <Toggle on={descAtivo} set={setDescAtivo} />
              <p className="text-sm text-gray-700 flex-1">Aplicar desconto para pagamentos antecipados (Boleto/Pix):</p>
            </div>
            {descAtivo && (
              <div className="pl-12 flex items-center gap-3 flex-wrap">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Percentual (%)</label>
                  <input value={descPct} onChange={e => setDescPct(e.target.value)} className={`${inputCls} max-w-[90px] text-center`} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Pago até (dias antes do venc.)</label>
                  <input value={descDias} onChange={e => setDescDias(e.target.value.replace(/\D/g, ""))} className={`${inputCls} max-w-[90px] text-center`} />
                </div>
              </div>
            )}
          </div>

          {/* Transferência automática */}
          <div className="flex items-center gap-3">
            <Toggle on={transfOff} set={setTransfOff} />
            <p className="text-sm text-gray-700">Desativar transferência automática de saldo do GoFit Pay para a conta bancária.</p>
          </div>

          {/* Antecipação */}
          <div className="flex items-center gap-3">
            <Toggle on={antecip} set={setAntecip} />
            <p className="text-sm text-gray-700">Ativar a antecipação automática dos recebimentos por cartão de crédito.</p>
          </div>
          <p className="text-[11px] text-gray-400 pl-12 -mt-3">
            A antecipação possui taxas extras do banco; ao habilitar você aceita essas taxas automaticamente.
          </p>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm font-bold text-gray-500 hover:text-gray-700 px-4">CANCELAR</button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal: Alterar conta de repasse ─────────────────────────────── */
function RepasseModal({ cfg, contractorId, onSaved, onClose }: {
  cfg: PayConfig; contractorId: string; onSaved: () => void; onClose: () => void;
}) {
  const [descricao,  setDescricao]  = useState(cfg.banco_nome ?? "");
  const [titular,    setTitular]    = useState(cfg.titular_nome ?? cfg.razao_social ?? "");
  const [documento,  setDocumento]  = useState(cfg.titular_documento ?? cfg.cnpj ?? "");
  const [banco,      setBanco]      = useState(cfg.banco_nome ?? "");
  const [tipoConta,  setTipoConta]  = useState(cfg.tipo_conta ?? "corrente");
  const [agencia,    setAgencia]    = useState(cfg.agencia ?? "");
  const [agDigito,   setAgDigito]   = useState(cfg.agencia_digito ?? "");
  const [conta,      setConta]      = useState(cfg.conta_num ?? "");
  const [ctaDigito,  setCtaDigito]  = useState(cfg.conta_digito ?? "");
  const [saving,     setSaving]     = useState(false);

  async function handleSave() {
    if (!titular.trim() || !banco.trim() || !agencia.trim() || !conta.trim()) {
      toast.error("Preencha titular, banco, agência e conta."); return;
    }
    setSaving(true);
    const { error } = await supabase.from("gofit_pay_config").update({
      banco_nome: banco.trim(),
      titular_nome: titular.trim(),
      titular_documento: documento.trim() || null,
      tipo_conta: tipoConta,
      agencia: agencia.trim(), agencia_digito: agDigito.trim() || null,
      conta_num: conta.trim(), conta_digito: ctaDigito.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", cfg.id).eq("contractor_id", contractorId);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar conta de repasse."); return; }
    toast.success("Conta de repasse atualizada. A alteração no banco pode levar até 1 dia útil.");
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-primary" /> Alterar conta de repasse
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Descrição</label>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Titular *</label>
            <input value={titular} onChange={e => setTitular(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">CPF/CNPJ do titular</label>
            <input value={documento} onChange={e => setDocumento(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Banco *</label>
            <input value={banco} onChange={e => setBanco(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Tipo de conta</label>
            <select value={tipoConta} onChange={e => setTipoConta(e.target.value)} className={inputCls}>
              <option value="corrente">Conta corrente</option>
              <option value="poupanca">Conta poupança</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Agência *</label>
              <input value={agencia} onChange={e => setAgencia(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Dígito</label>
              <input value={agDigito} onChange={e => setAgDigito(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Conta *</label>
              <input value={conta} onChange={e => setConta(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Dígito</label>
              <input value={ctaDigito} onChange={e => setCtaDigito(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm font-bold text-gray-500 hover:text-gray-700 px-4">VOLTAR</button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}
