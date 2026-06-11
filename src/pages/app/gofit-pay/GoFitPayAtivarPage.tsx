/**
 * Fase 5 — GoFit Pay: Wizard de ativação
 * Rota: /app/loja/gofit-pay/ativar
 *
 * 5 etapas: Empresa → Responsável → Conta bancária → Configurações → Revisão
 * - Salva em gofit_pay_config a cada etapa (upsert por contractor_id)
 * - Ao finalizar (etapa 5):
 *     1. Atualiza onboarding_status = 'enviado' e company_modules.status = 'pending'
 *     2. Chama GoFitPayService.createAccount() → Edge Function → Asaas sandbox
 *     3. Exibe overlay de loading durante a chamada Asaas
 *     4. Navega para /app/loja/gofit-pay com status atualizado
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Check, Building2, User, Landmark,
  Settings, ClipboardList, Loader2, ChevronRight, CreditCard,
  Info, ToggleLeft, ToggleRight,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GoFitPayService } from "@/services/gofit-pay";

/* ─── Tipos ──────────────────────────────────────────────────────── */
interface EmpresaForm {
  tipo_empresa: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  cep: string;
  logradouro: string;
  numero_end: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

interface ResponsavelForm {
  resp_nome: string;
  resp_cpf: string;
  resp_nascimento: string;
  resp_email: string;
  resp_celular: string;
  resp_renda_mensal: string;
}

interface ContaForm {
  banco_codigo: string;
  banco_nome: string;
  tipo_conta: string;
  agencia: string;
  agencia_digito: string;
  conta_num: string;
  conta_digito: string;
  titular_nome: string;
  titular_documento: string;
}

interface ConfigForm {
  nome_exibicao: string;
  multa_ativa: boolean;
  multa_percentual: string;
  juros_ativo: boolean;
  juros_percentual: string;
  desconto_ativo: boolean;
  desconto_percentual: string;
  desconto_dias: string;
  transferencia_automatica: boolean;
  antecipacao_automatica: boolean;
}

const ESTADOS_BR = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const BANCOS_COMUNS = [
  { codigo: "001", nome: "Banco do Brasil" },
  { codigo: "033", nome: "Santander" },
  { codigo: "077", nome: "Banco Inter" },
  { codigo: "104", nome: "Caixa Econômica Federal" },
  { codigo: "208", nome: "BTG Pactual" },
  { codigo: "212", nome: "Banco Original" },
  { codigo: "237", nome: "Bradesco" },
  { codigo: "260", nome: "Nu Pagamentos (Nubank)" },
  { codigo: "341", nome: "Itaú Unibanco" },
  { codigo: "748", nome: "Sicredi" },
  { codigo: "756", nome: "Sicoob" },
];

/* ─── Steps ─────────────────────────────────────────────────────── */
const STEPS = [
  { id: 1, label: "Empresa",         icon: Building2      },
  { id: 2, label: "Responsável",     icon: User           },
  { id: 3, label: "Conta bancária",  icon: Landmark       },
  { id: 4, label: "Configurações",   icon: Settings       },
  { id: 5, label: "Revisão",         icon: ClipboardList  },
];

/* ── Campo helper ── */
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass = "w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder-gray-300";
const selectClass = "w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors";

/* ─── Toggle ─────────────────────────────────────────────────────── */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${value ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
      {value ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
      {value ? "Ativado" : "Desativado"}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function GoFitPayAtivarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]         = useState(1);
  const [saving, setSaving]     = useState(false);
  const [activating, setActivating] = useState(false);   // overlay Fase 5
  const [configId, setConfigId] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);

  /* ── Form state ── */
  const [empresa, setEmpresa] = useState<EmpresaForm>({
    tipo_empresa: "mei", cnpj: "", razao_social: "", nome_fantasia: "",
    cep: "", logradouro: "", numero_end: "", complemento: "",
    bairro: "", cidade: "", estado: "SP",
  });

  const [resp, setResp] = useState<ResponsavelForm>({
    resp_nome: "", resp_cpf: "", resp_nascimento: "",
    resp_email: "", resp_celular: "", resp_renda_mensal: "",
  });

  const [conta, setConta] = useState<ContaForm>({
    banco_codigo: "", banco_nome: "", tipo_conta: "corrente",
    agencia: "", agencia_digito: "", conta_num: "", conta_digito: "",
    titular_nome: "", titular_documento: "",
  });

  const [config, setConfig] = useState<ConfigForm>({
    nome_exibicao: "GoFit Pay",
    multa_ativa: false, multa_percentual: "2",
    juros_ativo: false, juros_percentual: "1",
    desconto_ativo: false, desconto_percentual: "5", desconto_dias: "5",
    transferencia_automatica: false, antecipacao_automatica: false,
  });

  /* ─── Load existente ─────────────────────────────────────────── */
  useEffect(() => {
    if (!user?.contractorId) return;
    loadExisting();
  }, [user?.contractorId]);

  async function loadExisting() {
    if (!user?.contractorId) return;

    // Módulo
    const { data: mod } = await supabase.from("modules").select("id").eq("slug", "gofit_pay").maybeSingle();
    if (mod) setModuleId(mod.id);

    // Config existente
    const { data: cfg } = await supabase
      .from("gofit_pay_config")
      .select("*")
      .eq("contractor_id", user!.contractorId)
      .maybeSingle();

    if (!cfg) return;

    setConfigId(cfg.id);
    if (cfg.onboarding_step) setStep(cfg.onboarding_step);

    if (cfg.tipo_empresa || cfg.cnpj) {
      setEmpresa(e => ({
        ...e,
        tipo_empresa:  cfg.tipo_empresa  ?? e.tipo_empresa,
        cnpj:          cfg.cnpj          ?? e.cnpj,
        razao_social:  cfg.razao_social  ?? e.razao_social,
        nome_fantasia: cfg.nome_fantasia ?? e.nome_fantasia,
        cep:           cfg.cep           ?? e.cep,
        logradouro:    cfg.logradouro    ?? e.logradouro,
        numero_end:    cfg.numero_end    ?? e.numero_end,
        complemento:   cfg.complemento  ?? e.complemento,
        bairro:        cfg.bairro        ?? e.bairro,
        cidade:        cfg.cidade        ?? e.cidade,
        estado:        cfg.estado        ?? e.estado,
      }));
    }
    if (cfg.resp_nome || cfg.resp_cpf) {
      setResp(r => ({
        ...r,
        resp_nome:        cfg.resp_nome        ?? r.resp_nome,
        resp_cpf:         cfg.resp_cpf         ?? r.resp_cpf,
        resp_nascimento:  cfg.resp_nascimento  ?? r.resp_nascimento,
        resp_email:       cfg.resp_email       ?? r.resp_email,
        resp_celular:     cfg.resp_celular     ?? r.resp_celular,
        resp_renda_mensal: cfg.resp_renda_mensal?.toString() ?? r.resp_renda_mensal,
      }));
    }
    if (cfg.banco_codigo || cfg.agencia) {
      setConta(c => ({
        ...c,
        banco_codigo:      cfg.banco_codigo      ?? c.banco_codigo,
        banco_nome:        cfg.banco_nome        ?? c.banco_nome,
        tipo_conta:        cfg.tipo_conta        ?? c.tipo_conta,
        agencia:           cfg.agencia           ?? c.agencia,
        agencia_digito:    cfg.agencia_digito    ?? c.agencia_digito,
        conta_num:         cfg.conta_num         ?? c.conta_num,
        conta_digito:      cfg.conta_digito      ?? c.conta_digito,
        titular_nome:      cfg.titular_nome      ?? c.titular_nome,
        titular_documento: cfg.titular_documento ?? c.titular_documento,
      }));
    }
    if (cfg.nome_exibicao) {
      setConfig(cf => ({
        ...cf,
        nome_exibicao:           cfg.nome_exibicao                ?? cf.nome_exibicao,
        multa_ativa:             cfg.multa_ativa                  ?? cf.multa_ativa,
        multa_percentual:        cfg.multa_percentual?.toString() ?? cf.multa_percentual,
        juros_ativo:             cfg.juros_ativo                  ?? cf.juros_ativo,
        juros_percentual:        cfg.juros_percentual?.toString() ?? cf.juros_percentual,
        desconto_ativo:          cfg.desconto_ativo               ?? cf.desconto_ativo,
        desconto_percentual:     cfg.desconto_percentual?.toString() ?? cf.desconto_percentual,
        desconto_dias:           cfg.desconto_dias?.toString()    ?? cf.desconto_dias,
        transferencia_automatica: cfg.transferencia_automatica     ?? cf.transferencia_automatica,
        antecipacao_automatica:   cfg.antecipacao_automatica       ?? cf.antecipacao_automatica,
      }));
    }
  }

  /* ─── Save step ─────────────────────────────────────────────── */
  async function saveStep(nextStep: number) {
    if (!user?.contractorId) return;
    setSaving(true);

    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      contractor_id:    user!.contractorId,
      onboarding_step:  nextStep,
      onboarding_status: nextStep >= 5 ? "enviado" : "rascunho",
      updated_at: now,
    };

    // Merge campos por etapa
    if (step >= 1) Object.assign(payload, empresa);
    if (step >= 2) Object.assign(payload, resp, {
      resp_renda_mensal: parseFloat(resp.resp_renda_mensal.replace(/\./g, "").replace(",", ".")) || null,
    });
    if (step >= 3) Object.assign(payload, conta);
    if (step >= 4) Object.assign(payload, {
      nome_exibicao:            config.nome_exibicao,
      multa_ativa:              config.multa_ativa,
      multa_percentual:         parseFloat(config.multa_percentual) || null,
      juros_ativo:              config.juros_ativo,
      juros_percentual:         parseFloat(config.juros_percentual) || null,
      desconto_ativo:           config.desconto_ativo,
      desconto_percentual:      parseFloat(config.desconto_percentual) || null,
      desconto_dias:            parseInt(config.desconto_dias) || null,
      transferencia_automatica: config.transferencia_automatica,
      antecipacao_automatica:   config.antecipacao_automatica,
    });

    let error: unknown = null;

    if (configId) {
      const { error: e } = await supabase
        .from("gofit_pay_config")
        .update(payload)
        .eq("id", configId);
      error = e;
    } else {
      const { data, error: e } = await supabase
        .from("gofit_pay_config")
        .insert({ ...payload, created_at: now })
        .select("id")
        .single();
      error = e;
      if (data) setConfigId(data.id);
    }

    if (error) {
      console.error("Erro ao salvar:", error);
      setSaving(false);
      return;
    }

    setSaving(false);

    // Etapa 5 (revisão) → finalizar
    if (nextStep > 5) {
      await finalizar();
      return;
    }

    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finalizar() {
    if (!user?.contractorId || !moduleId) {
      navigate("/app/loja/gofit-pay");
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();

    // ── 1. Marca onboarding como 'enviado' ──────────────────────────────
    await supabase
      .from("gofit_pay_config")
      .update({ onboarding_status: "enviado", updated_at: now })
      .eq("contractor_id", user!.contractorId);

    // ── 2. Garante company_modules.status = 'pending' ───────────────────
    const { data: existingMod } = await supabase
      .from("company_modules")
      .select("id")
      .eq("contractor_id", user!.contractorId)
      .eq("module_id", moduleId)
      .maybeSingle();

    if (existingMod) {
      await supabase
        .from("company_modules")
        .update({ status: "pending", updated_at: now })
        .eq("id", existingMod.id);
    } else {
      await supabase
        .from("company_modules")
        .insert({
          contractor_id: user!.contractorId,
          module_id:     moduleId,
          status:        "pending",
          activated_at:  now,
          config_json:   {},
        });
    }

    setSaving(false);

    // ── 3. Chama Asaas via Edge Function (Fase 5) ───────────────────────
    setActivating(true);
    try {
      await GoFitPayService.createAccount(user!.contractorId, "sandbox");
      // Sucesso ou falha: a Edge Function já atualizou os status no banco.
      // Navegamos para a landing page que mostrará o status correto.
    } catch {
      // Erro inesperado: a Edge Function captura internamente.
      // Navega mesmo assim — landing page mostrará activation_failed.
    } finally {
      setActivating(false);
    }

    navigate("/app/loja/gofit-pay");
  }

  /* ─── Renders por etapa ──────────────────────────────────────── */

  function renderStep1() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Tipo de empresa" required>
          <select value={empresa.tipo_empresa} onChange={e => setEmpresa(p => ({ ...p, tipo_empresa: e.target.value }))} className={selectClass}>
            <option value="mei">MEI</option>
            <option value="mei_empresa">MEI Empresa</option>
            <option value="ltda">LTDA</option>
            <option value="sa">S/A</option>
            <option value="eireli">EIRELI</option>
            <option value="ss">Sociedade Simples</option>
          </select>
        </Field>
        <Field label="CNPJ" required>
          <input value={empresa.cnpj} onChange={e => setEmpresa(p => ({ ...p, cnpj: e.target.value }))}
            placeholder="00.000.000/0001-00" className={inputClass} />
        </Field>
        <Field label="Razão social" required>
          <input value={empresa.razao_social} onChange={e => setEmpresa(p => ({ ...p, razao_social: e.target.value }))}
            placeholder="Razão social conforme CNPJ" className={inputClass} />
        </Field>
        <Field label="Nome fantasia">
          <input value={empresa.nome_fantasia} onChange={e => setEmpresa(p => ({ ...p, nome_fantasia: e.target.value }))}
            placeholder="Como sua academia é conhecida" className={inputClass} />
        </Field>
        <Field label="CEP" required>
          <input value={empresa.cep} onChange={e => setEmpresa(p => ({ ...p, cep: e.target.value }))}
            placeholder="00000-000" className={inputClass} />
        </Field>
        <Field label="Logradouro" required>
          <input value={empresa.logradouro} onChange={e => setEmpresa(p => ({ ...p, logradouro: e.target.value }))}
            placeholder="Rua, Avenida..." className={inputClass} />
        </Field>
        <Field label="Número" required>
          <input value={empresa.numero_end} onChange={e => setEmpresa(p => ({ ...p, numero_end: e.target.value }))}
            placeholder="Ex: 123" className={inputClass} />
        </Field>
        <Field label="Complemento">
          <input value={empresa.complemento} onChange={e => setEmpresa(p => ({ ...p, complemento: e.target.value }))}
            placeholder="Sala, Andar..." className={inputClass} />
        </Field>
        <Field label="Bairro" required>
          <input value={empresa.bairro} onChange={e => setEmpresa(p => ({ ...p, bairro: e.target.value }))}
            placeholder="Bairro" className={inputClass} />
        </Field>
        <Field label="Cidade" required>
          <input value={empresa.cidade} onChange={e => setEmpresa(p => ({ ...p, cidade: e.target.value }))}
            placeholder="Cidade" className={inputClass} />
        </Field>
        <Field label="Estado" required>
          <select value={empresa.estado} onChange={e => setEmpresa(p => ({ ...p, estado: e.target.value }))} className={selectClass}>
            {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </Field>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome completo" required>
          <input value={resp.resp_nome} onChange={e => setResp(p => ({ ...p, resp_nome: e.target.value }))}
            placeholder="Nome do responsável legal" className={inputClass} />
        </Field>
        <Field label="CPF" required>
          <input value={resp.resp_cpf} onChange={e => setResp(p => ({ ...p, resp_cpf: e.target.value }))}
            placeholder="000.000.000-00" className={inputClass} />
        </Field>
        <Field label="Data de nascimento" required>
          <input type="date" value={resp.resp_nascimento} onChange={e => setResp(p => ({ ...p, resp_nascimento: e.target.value }))}
            className={inputClass} />
        </Field>
        <Field label="E-mail" required>
          <input type="email" value={resp.resp_email} onChange={e => setResp(p => ({ ...p, resp_email: e.target.value }))}
            placeholder="responsavel@email.com" className={inputClass} />
        </Field>
        <Field label="Celular" required>
          <input value={resp.resp_celular} onChange={e => setResp(p => ({ ...p, resp_celular: e.target.value }))}
            placeholder="(00) 00000-0000" className={inputClass} />
        </Field>
        <Field label="Renda mensal (R$)">
          <input value={resp.resp_renda_mensal} onChange={e => setResp(p => ({ ...p, resp_renda_mensal: e.target.value }))}
            placeholder="Ex: 5000,00" className={inputClass} />
        </Field>
        <div className="md:col-span-2 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>Esses dados são necessários para a análise de crédito e abertura da conta de pagamentos. São tratados com confidencialidade e não são exibidos ao público.</p>
        </div>
      </div>
    );
  }

  function renderStep3() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Banco" required>
          <select value={conta.banco_codigo}
            onChange={e => {
              const banco = BANCOS_COMUNS.find(b => b.codigo === e.target.value);
              setConta(p => ({ ...p, banco_codigo: e.target.value, banco_nome: banco?.nome ?? p.banco_nome }));
            }}
            className={selectClass}>
            <option value="">Selecione o banco</option>
            {BANCOS_COMUNS.map(b => (
              <option key={b.codigo} value={b.codigo}>{b.codigo} — {b.nome}</option>
            ))}
            <option value="outro">Outro</option>
          </select>
        </Field>
        {conta.banco_codigo === "outro" && (
          <Field label="Nome do banco">
            <input value={conta.banco_nome} onChange={e => setConta(p => ({ ...p, banco_nome: e.target.value }))}
              placeholder="Nome do banco" className={inputClass} />
          </Field>
        )}
        <Field label="Tipo de conta" required>
          <select value={conta.tipo_conta} onChange={e => setConta(p => ({ ...p, tipo_conta: e.target.value }))} className={selectClass}>
            <option value="corrente">Conta Corrente</option>
            <option value="poupanca">Conta Poupança</option>
            <option value="pagamento">Conta Pagamento</option>
          </select>
        </Field>
        <Field label="Agência" required>
          <input value={conta.agencia} onChange={e => setConta(p => ({ ...p, agencia: e.target.value }))}
            placeholder="Ex: 0001" className={inputClass} />
        </Field>
        <Field label="Dígito da agência">
          <input value={conta.agencia_digito} onChange={e => setConta(p => ({ ...p, agencia_digito: e.target.value }))}
            placeholder="Ex: 0" className={inputClass} maxLength={1} />
        </Field>
        <Field label="Número da conta" required>
          <input value={conta.conta_num} onChange={e => setConta(p => ({ ...p, conta_num: e.target.value }))}
            placeholder="Número da conta" className={inputClass} />
        </Field>
        <Field label="Dígito da conta">
          <input value={conta.conta_digito} onChange={e => setConta(p => ({ ...p, conta_digito: e.target.value }))}
            placeholder="Ex: 1" className={inputClass} maxLength={1} />
        </Field>
        <Field label="Nome do titular" required>
          <input value={conta.titular_nome} onChange={e => setConta(p => ({ ...p, titular_nome: e.target.value }))}
            placeholder="Nome conforme cadastro bancário" className={inputClass} />
        </Field>
        <Field label="CPF / CNPJ do titular" required>
          <input value={conta.titular_documento} onChange={e => setConta(p => ({ ...p, titular_documento: e.target.value }))}
            placeholder="000.000.000-00 ou 00.000.000/0001-00" className={inputClass} />
        </Field>
        <div className="md:col-span-2 flex items-start gap-2 bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-xs text-yellow-800">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>Os repasses automáticos serão feitos para esta conta. Certifique-se de que os dados estão corretos antes de enviar.</p>
        </div>
      </div>
    );
  }

  function renderStep4() {
    return (
      <div className="space-y-5">
        <Field label="Nome de exibição">
          <input value={config.nome_exibicao} onChange={e => setConfig(p => ({ ...p, nome_exibicao: e.target.value }))}
            placeholder="Ex: AcademiaXYZ Pay" className={inputClass} />
          <p className="text-xs text-gray-400 mt-1">Nome que seus alunos verão na cobrança. Padrão: GoFit Pay.</p>
        </Field>

        {/* Multa */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">Multa por atraso</p>
              <p className="text-xs text-gray-400">Aplicada uma única vez no vencimento</p>
            </div>
            <Toggle value={config.multa_ativa} onChange={v => setConfig(p => ({ ...p, multa_ativa: v }))} />
          </div>
          {config.multa_ativa && (
            <Field label="Percentual de multa (%)">
              <input type="number" min="0" max="10" step="0.1"
                value={config.multa_percentual}
                onChange={e => setConfig(p => ({ ...p, multa_percentual: e.target.value }))}
                className={`${inputClass} max-w-xs`} />
            </Field>
          )}
        </div>

        {/* Juros */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">Juros por dia de atraso</p>
              <p className="text-xs text-gray-400">Percentual diário após o vencimento</p>
            </div>
            <Toggle value={config.juros_ativo} onChange={v => setConfig(p => ({ ...p, juros_ativo: v }))} />
          </div>
          {config.juros_ativo && (
            <Field label="Percentual de juros (% ao dia)">
              <input type="number" min="0" max="1" step="0.01"
                value={config.juros_percentual}
                onChange={e => setConfig(p => ({ ...p, juros_percentual: e.target.value }))}
                className={`${inputClass} max-w-xs`} />
            </Field>
          )}
        </div>

        {/* Desconto */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">Desconto para pagamento antecipado</p>
              <p className="text-xs text-gray-400">Incentiva o pagamento antes do vencimento</p>
            </div>
            <Toggle value={config.desconto_ativo} onChange={v => setConfig(p => ({ ...p, desconto_ativo: v }))} />
          </div>
          {config.desconto_ativo && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Percentual de desconto (%)">
                <input type="number" min="0" max="100" step="0.5"
                  value={config.desconto_percentual}
                  onChange={e => setConfig(p => ({ ...p, desconto_percentual: e.target.value }))}
                  className={inputClass} />
              </Field>
              <Field label="Dias de antecedência">
                <input type="number" min="1" max="30"
                  value={config.desconto_dias}
                  onChange={e => setConfig(p => ({ ...p, desconto_dias: e.target.value }))}
                  className={inputClass} />
              </Field>
            </div>
          )}
        </div>

        {/* Transferência automática */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">Transferência automática</p>
              <p className="text-xs text-gray-400">Repasse automático para sua conta bancária após liquidação</p>
            </div>
            <Toggle value={config.transferencia_automatica} onChange={v => setConfig(p => ({ ...p, transferencia_automatica: v }))} />
          </div>
        </div>

        {/* Antecipação automática */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">Antecipação automática de recebíveis</p>
              <p className="text-xs text-gray-400">Receba o valor antecipado (sujeito a tarifa)</p>
            </div>
            <Toggle value={config.antecipacao_automatica} onChange={v => setConfig(p => ({ ...p, antecipacao_automatica: v }))} />
          </div>
        </div>
      </div>
    );
  }

  function renderStep5() {
    const nomeContaBanco = BANCOS_COMUNS.find(b => b.codigo === conta.banco_codigo)?.nome ?? conta.banco_nome;

    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 mb-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>Revise todos os dados antes de enviar. Após o envio, nossa equipe analisará sua solicitação em até 2 dias úteis.</p>
        </div>

        {/* Empresa */}
        <ReviewBlock title="Empresa" onEdit={() => setStep(1)}>
          <ReviewRow label="Tipo"          value={empresa.tipo_empresa.toUpperCase()} />
          <ReviewRow label="CNPJ"          value={empresa.cnpj} />
          <ReviewRow label="Razão social"  value={empresa.razao_social} />
          <ReviewRow label="Nome fantasia" value={empresa.nome_fantasia || "—"} />
          <ReviewRow label="Endereço"      value={`${empresa.logradouro}, ${empresa.numero_end}${empresa.complemento ? ` - ${empresa.complemento}` : ""}`} />
          <ReviewRow label="Bairro/Cidade" value={`${empresa.bairro} - ${empresa.cidade}/${empresa.estado}`} />
          <ReviewRow label="CEP"           value={empresa.cep} />
        </ReviewBlock>

        {/* Responsável */}
        <ReviewBlock title="Responsável" onEdit={() => setStep(2)}>
          <ReviewRow label="Nome"          value={resp.resp_nome} />
          <ReviewRow label="CPF"           value={resp.resp_cpf} />
          <ReviewRow label="Nascimento"    value={resp.resp_nascimento} />
          <ReviewRow label="E-mail"        value={resp.resp_email} />
          <ReviewRow label="Celular"       value={resp.resp_celular} />
        </ReviewBlock>

        {/* Conta */}
        <ReviewBlock title="Conta bancária" onEdit={() => setStep(3)}>
          <ReviewRow label="Banco"         value={`${conta.banco_codigo} — ${nomeContaBanco}`} />
          <ReviewRow label="Tipo"          value={conta.tipo_conta} />
          <ReviewRow label="Agência"       value={`${conta.agencia}${conta.agencia_digito ? `-${conta.agencia_digito}` : ""}`} />
          <ReviewRow label="Conta"         value={`${conta.conta_num}${conta.conta_digito ? `-${conta.conta_digito}` : ""}`} />
          <ReviewRow label="Titular"       value={conta.titular_nome} />
          <ReviewRow label="CPF/CNPJ tit." value={conta.titular_documento} />
        </ReviewBlock>

        {/* Configurações */}
        <ReviewBlock title="Configurações" onEdit={() => setStep(4)}>
          <ReviewRow label="Nome exibição"        value={config.nome_exibicao} />
          <ReviewRow label="Multa"                value={config.multa_ativa ? `${config.multa_percentual}%` : "Desativada"} />
          <ReviewRow label="Juros"                value={config.juros_ativo ? `${config.juros_percentual}% ao dia` : "Desativados"} />
          <ReviewRow label="Desconto antecipado"  value={config.desconto_ativo ? `${config.desconto_percentual}% / ${config.desconto_dias} dias` : "Desativado"} />
          <ReviewRow label="Transferência auto"   value={config.transferencia_automatica ? "Sim" : "Não"} />
          <ReviewRow label="Antecipação auto"     value={config.antecipacao_automatica ? "Sim" : "Não"} />
        </ReviewBlock>
      </div>
    );
  }

  /* ─── Sub-componentes de revisão ─────────────────────────────── */
  function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
          <p className="text-sm font-bold text-gray-800">{title}</p>
          <button type="button" onClick={onEdit} className="text-xs text-primary font-semibold hover:underline">Editar</button>
        </div>
        <div className="px-4 py-3 space-y-2">{children}</div>
      </div>
    );
  }

  function ReviewRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-gray-400 w-36 flex-shrink-0">{label}</span>
        <span className="text-xs text-gray-800 font-medium">{value || "—"}</span>
      </div>
    );
  }

  /* ─── Render principal ───────────────────────────────────────── */
  const currentStep = STEPS[step - 1];

  return (
    <AppLayout>
      {/* ── Overlay de ativação Asaas (Fase 5) ── */}
      {activating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-10 max-w-sm w-full mx-4 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">Ativando GoFit Pay…</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Estamos criando sua subconta no gateway de pagamentos.<br />
              Não feche esta página.
            </p>
            <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col min-h-full bg-gray-50">

        {/* Sub-header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/app/loja/gofit-pay")}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-400">Loja de Módulos</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-xs text-gray-400">GoFit Pay</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-xs font-semibold text-gray-700">Ativação</span>
          </div>
        </div>

        <div className="flex-1 px-8 py-8 max-w-3xl mx-auto w-full">

          {/* Título */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-black text-gray-900">Ativar GoFit Pay</h1>
            </div>
            <p className="text-sm text-gray-400 pl-13">Preencha as informações em 5 etapas rápidas.</p>
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-0 mb-8 bg-white rounded-2xl border border-gray-100 p-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = step > s.id;
              const active = step === s.id;
              return (
                <div key={s.id} className="flex items-center flex-1">
                  <div className={`flex flex-col items-center gap-1 flex-1 cursor-pointer group ${done ? "cursor-pointer" : ""}`}
                    onClick={() => done && setStep(s.id)}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                      done   ? "bg-green-500 text-white" :
                      active ? "bg-primary text-white shadow-lg shadow-primary/20" :
                               "bg-gray-100 text-gray-400"
                    }`}>
                      {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className={`text-xs font-semibold text-center ${active ? "text-primary" : done ? "text-green-600" : "text-gray-400"}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-shrink-0 w-6 h-0.5 mx-1 rounded-full transition-colors ${done ? "bg-green-300" : "bg-gray-100"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Card do step */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-5">
              {(() => { const Icon = currentStep.icon; return <Icon className="w-5 h-5 text-primary" />; })()}
              <h2 className="text-lg font-bold text-gray-900">{currentStep.label}</h2>
              <span className="ml-auto text-xs text-gray-400">Etapa {step} de 5</span>
            </div>

            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            {step === 5 && renderStep5()}
          </div>

          {/* Navegação */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => step > 1 ? setStep(step - 1) : navigate("/app/loja/gofit-pay")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {step > 1 ? "Voltar" : "Cancelar"}
            </button>

            <button
              type="button"
              onClick={() => saveStep(step + 1)}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all shadow-md shadow-primary/20 disabled:opacity-60">
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
              ) : step === 5 ? (
                <><Check className="w-4 h-4" /> Enviar para análise</>
              ) : (
                <>Próxima etapa <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
