import { useState, useEffect } from "react";
import {
  X, Eye, EyeOff, Loader2, Plus, Trash2, ChevronDown,
  KeyRound, Upload, Users,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { StaffRole } from "@/integrations/supabase/types";
import ChangePasswordModal from "@/components/app/ChangePasswordModal";
import StaffSalarioTab from "@/components/app/StaffSalarioTab";
import StaffFeriasTab from "@/components/app/StaffFeriasTab";
import StaffOcorrenciasTab from "@/components/app/StaffOcorrenciasTab";

interface Props {
  editId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

interface Periodo {
  _id: string;
  dias: string[];
  hora_inicio: string;
  hora_fim: string;
  horario_livre: boolean;
}

interface FormState {
  // ── Pessoal ──────────────────────────────
  name: string;
  cpf: string;
  rg: string;
  data_nascimento: string;
  sexo: string;
  email: string;
  telefone: string;
  tipo_conselho: string;
  numero_conselho: string;
  password: string;
  confirm_password: string;
  showPassword: boolean;
  showConfirmPassword: boolean;
  blocked: boolean;
  role: StaffRole | "";
  // ── Profissional ─────────────────────────
  data_admissao: string;
  data_demissao: string;
  tipo_contrato: string;
  cargo_descricao: string;
  carga_horaria_semanal: string;
  salario_inicial: string;
  valor_passagem: string;
  pis_pasep: string;
  ctps_numero: string;
  ctps_serie: string;
  banco: string;
  agencia: string;
  conta: string;
  tipo_conta: string;
  chave_pix: string;
  // ── Endereço / Sistema ───────────────────
  cep: string;
  logradouro: string;
  numero_endereco: string;
  cidade: string;
  uf: string;
  bairro: string;
  complemento: string;
  horarios_ativo: boolean;
  horarios_periodos: Periodo[];
  observacoes: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;
type TabId = "pessoal" | "profissional" | "sistema" | "salario" | "ferias" | "ocorrencias";

const DIAS_SEMANA = [
  { key: "seg", label: "Seg" }, { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" }, { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" }, { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
];

const ROLES: { value: StaffRole; label: string }[] = [
  { value: "admin",           label: "Administrador(a)" },
  { value: "teacher",         label: "Professor" },
  { value: "receptionist",    label: "Recepcionista" },
  { value: "sales",           label: "Vendas" },
  { value: "nutritionist",    label: "Nutricionista" },
  { value: "physiotherapist", label: "Fisioterapeuta" },
  { value: "evaluator",       label: "Avaliador" },
];

const CONSELHOS = [
  { value: "CREF",    label: "Educação física (CREF)" },
  { value: "COREN",   label: "COREN" },
  { value: "CRM",     label: "CRM" },
  { value: "CRN",     label: "CRN" },
  { value: "CREFITO", label: "CREFITO" },
  { value: "CRP",     label: "CRP" },
  { value: "Outro",   label: "Outro" },
];

const CONTRATOS = [
  { value: "clt",        label: "CLT" },
  { value: "pj",         label: "PJ (Pessoa Jurídica)" },
  { value: "autonomo",   label: "Autônomo" },
  { value: "estagiario", label: "Estagiário" },
];

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
];

// ── Masks ────────────────────────────────────────────────────────────────────

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2)  return d;
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}
function maskCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}
function maskCEP(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0,5)}-${d.slice(5)}`;
}
function maskPIS(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3)  return d;
  if (d.length <= 8)  return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0,3)}.${d.slice(3,8)}.${d.slice(8)}`;
  return `${d.slice(0,3)}.${d.slice(3,8)}.${d.slice(8,10)}-${d.slice(10)}`;
}
function maskCurrency(v: string) {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "";
  const n = parseInt(digits, 10) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseCurrency(v: string): number | null {
  const clean = v.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) || n <= 0 ? null : n;
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

const INP = [
  "w-full bg-transparent",
  "border-0 border-b border-gray-300",
  "py-2 px-0",
  "text-sm text-gray-900 placeholder:text-gray-400",
  "outline-none",
  "focus:border-b-2 focus:border-primary",
  "transition-colors",
  "disabled:opacity-50 disabled:cursor-not-allowed",
].join(" ");

const SEL = [
  "w-full bg-transparent",
  "border-0 border-b border-gray-300",
  "py-2 pl-0 pr-6",
  "text-sm text-gray-900",
  "outline-none appearance-none cursor-pointer",
  "focus:border-b-2 focus:border-primary",
  "transition-colors",
].join(" ");

const LBL = "block text-xs text-gray-500 mb-0.5";

function Req() {
  return <span className="text-primary ml-0.5">*</span>;
}
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}
function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}
function Toggle({ active, onToggle, disabled }: { active: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative h-5 w-9 rounded-full transition-colors flex-shrink-0 ${
        active ? "bg-primary" : "bg-gray-300"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
        active ? "translate-x-4" : "translate-x-0"
      }`} />
    </button>
  );
}
function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        {children}
      </div>
    </div>
  );
}

function newPeriodo(): Periodo {
  return {
    _id: crypto.randomUUID(),
    dias: ["seg","ter","qua","qui","sex","sab","dom"],
    hora_inicio: "08:00",
    hora_fim: "18:00",
    horario_livre: false,
  };
}

const EMPTY: FormState = {
  name: "", cpf: "", rg: "", data_nascimento: "", sexo: "",
  email: "", telefone: "", tipo_conselho: "CREF", numero_conselho: "",
  password: "", confirm_password: "", showPassword: false, showConfirmPassword: false,
  blocked: false, role: "",
  data_admissao: "", data_demissao: "", tipo_contrato: "", cargo_descricao: "",
  carga_horaria_semanal: "", salario_inicial: "", valor_passagem: "",
  pis_pasep: "", ctps_numero: "", ctps_serie: "",
  banco: "", agencia: "", conta: "", tipo_conta: "", chave_pix: "",
  cep: "", logradouro: "", numero_endereco: "", cidade: "", uf: "", bairro: "", complemento: "",
  horarios_ativo: false, horarios_periodos: [newPeriodo()],
  observacoes: "",
};

// ── Componente principal ─────────────────────────────────────────────────────

export default function StaffMemberModal({ editId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const isEdit = !!editId;

  const [form, setForm]             = useState<FormState>(EMPTY);
  const [errors, setErrors]         = useState<FormErrors>({});
  const [cepLoading, setCepLoading] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [activeTab, setActiveTab]   = useState<TabId>("pessoal");

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }));
  }

  const { data: staffData, isLoading: loadingData } = useQuery({
    queryKey: ["staff-member", editId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("id", editId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!editId,
  });

  useEffect(() => {
    if (!staffData) return;
    const hr = staffData.horarios_restricao as Record<string, unknown> | null;
    let horariosAtivo   = false;
    let horariosPeriodos: Periodo[] = [newPeriodo()];

    if (hr && typeof hr === "object" && hr.ativo) {
      horariosAtivo = true;
      const raw = hr.periodos as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(raw) && raw.length > 0) {
        horariosPeriodos = raw.map(p => ({
          _id: crypto.randomUUID(),
          dias:          Array.isArray(p.dias) ? (p.dias as string[]) : [],
          hora_inicio:   typeof p.hora_inicio === "string" ? p.hora_inicio : "08:00",
          hora_fim:      typeof p.hora_fim    === "string" ? p.hora_fim    : "18:00",
          horario_livre: !!p.horario_livre,
        }));
      }
    }

    const vp = (staffData as Record<string, unknown>).valor_passagem as number | null;
    const ch = (staffData as Record<string, unknown>).carga_horaria_semanal as number | null;

    setForm({
      name:            staffData.name ?? "",
      cpf:             staffData.cpf ?? "",
      rg:              staffData.rg ?? "",
      data_nascimento: staffData.data_nascimento ?? "",
      sexo:            staffData.sexo ?? "",
      email:           staffData.email ?? "",
      telefone:        staffData.telefone ? maskPhone(staffData.telefone) : "",
      tipo_conselho:   staffData.tipo_conselho ?? "CREF",
      numero_conselho: staffData.numero_conselho ?? "",
      password: "", confirm_password: "",
      showPassword: false, showConfirmPassword: false,
      blocked:         staffData.blocked ?? false,
      role:            (staffData.role as StaffRole) ?? "",
      data_admissao:   (staffData as Record<string, unknown>).data_admissao as string ?? "",
      data_demissao:   (staffData as Record<string, unknown>).data_demissao as string ?? "",
      tipo_contrato:   (staffData as Record<string, unknown>).tipo_contrato as string ?? "",
      cargo_descricao: (staffData as Record<string, unknown>).cargo_descricao as string ?? "",
      carga_horaria_semanal: ch != null ? String(ch) : "",
      salario_inicial: "",
      valor_passagem:  vp != null ? vp.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "",
      pis_pasep:       (staffData as Record<string, unknown>).pis_pasep
                         ? maskPIS(String((staffData as Record<string, unknown>).pis_pasep))
                         : "",
      ctps_numero:     (staffData as Record<string, unknown>).ctps_numero as string ?? "",
      ctps_serie:      (staffData as Record<string, unknown>).ctps_serie as string ?? "",
      banco:           (staffData as Record<string, unknown>).banco as string ?? "",
      agencia:         (staffData as Record<string, unknown>).agencia as string ?? "",
      conta:           (staffData as Record<string, unknown>).conta as string ?? "",
      tipo_conta:      (staffData as Record<string, unknown>).tipo_conta as string ?? "",
      chave_pix:       (staffData as Record<string, unknown>).chave_pix as string ?? "",
      cep:             staffData.cep ? maskCEP(staffData.cep) : "",
      logradouro:      staffData.logradouro ?? "",
      numero_endereco: staffData.numero_endereco ?? "",
      cidade:          staffData.cidade ?? "",
      uf:              staffData.uf ?? "",
      bairro:          staffData.bairro ?? "",
      complemento:     staffData.complemento ?? "",
      horarios_ativo:  horariosAtivo,
      horarios_periodos: horariosPeriodos,
      observacoes:     staffData.observacoes ?? "",
    });
  }, [staffData]);

  async function handleCEPBlur() {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(f => ({
          ...f,
          logradouro: data.logradouro ?? f.logradouro,
          bairro:     data.bairro     ?? f.bairro,
          cidade:     data.localidade ?? f.cidade,
          uf:         data.uf         ?? f.uf,
        }));
      }
    } catch { /* ignore */ }
    setCepLoading(false);
  }

  function toggleDia(idx: number, dia: string) {
    setForm(f => ({
      ...f,
      horarios_periodos: f.horarios_periodos.map((p, i) => {
        if (i !== idx) return p;
        const dias = p.dias.includes(dia) ? p.dias.filter(d => d !== dia) : [...p.dias, dia];
        return { ...p, dias };
      }),
    }));
  }
  function updatePeriodo(idx: number, field: keyof Omit<Periodo, "_id" | "dias">, value: string | boolean) {
    setForm(f => ({
      ...f,
      horarios_periodos: f.horarios_periodos.map((p, i) => i === idx ? { ...p, [field]: value } : p),
    }));
  }
  function addPeriodo() {
    setForm(f => ({ ...f, horarios_periodos: [...f.horarios_periodos, newPeriodo()] }));
  }
  function removePeriodo(idx: number) {
    setForm(f => ({ ...f, horarios_periodos: f.horarios_periodos.filter((_, i) => i !== idx) }));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const errs: FormErrors = {};
      if (!form.name.trim())        errs.name          = "Nome é obrigatório.";
      if (!form.email.trim())       errs.email         = "E-mail é obrigatório.";
      if (!form.data_nascimento)    errs.data_nascimento = "Data de nascimento é obrigatória.";
      if (!form.telefone.trim())    errs.telefone      = "Telefone é obrigatório.";
      if (!form.role)               errs.role          = "Selecione o perfil de acesso.";
      if (!isEdit) {
        if (!form.password.trim())         errs.password         = "Senha é obrigatória.";
        else if (form.password.length < 6) errs.password         = "Mínimo 6 caracteres.";
        else if (form.password !== form.confirm_password)
                                           errs.confirm_password = "Senhas não conferem.";
      }
      if (form.data_demissao && form.data_admissao && form.data_demissao < form.data_admissao) {
        errs.data_demissao = "Demissão não pode ser antes da admissão.";
      }
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        // Switch to the tab containing the first error
        const pessoalKeys: (keyof FormState)[] = ["name","email","data_nascimento","telefone","password","confirm_password"];
        const profKeys: (keyof FormState)[] = ["data_demissao"];
        if (pessoalKeys.some(k => errs[k])) setActiveTab("pessoal");
        else if (profKeys.some(k => errs[k])) setActiveTab("profissional");
        throw new Error("validation");
      }

      const horarios_restricao = form.horarios_ativo
        ? { ativo: true, periodos: form.horarios_periodos.map(({ _id: _, ...p }) => p) }
        : null;

      const payload = {
        name:            form.name.trim(),
        email:           form.email.trim(),
        role:            form.role as StaffRole,
        cpf:             form.cpf.replace(/\D/g, "") || null,
        rg:              form.rg.trim() || null,
        data_nascimento: form.data_nascimento || null,
        sexo:            (form.sexo as "masculino" | "feminino" | "outro") || null,
        telefone:        form.telefone.replace(/\D/g, "") || null,
        tipo_conselho:   form.tipo_conselho || null,
        numero_conselho: form.numero_conselho.trim() || null,
        blocked:         form.blocked,
        cep:             form.cep.replace(/\D/g, "") || null,
        logradouro:      form.logradouro.trim() || null,
        numero_endereco: form.numero_endereco.trim() || null,
        cidade:          form.cidade.trim() || null,
        uf:              form.uf || null,
        bairro:          form.bairro.trim() || null,
        complemento:     form.complemento.trim() || null,
        horarios_restricao,
        observacoes:     form.observacoes.trim() || null,
        // Professional fields
        data_admissao:         form.data_admissao || null,
        data_demissao:         form.data_demissao || null,
        tipo_contrato:         (form.tipo_contrato as "clt" | "pj" | "autonomo" | "estagiario") || null,
        cargo_descricao:       form.cargo_descricao.trim() || null,
        carga_horaria_semanal: form.carga_horaria_semanal ? parseInt(form.carga_horaria_semanal, 10) : null,
        valor_passagem:        parseCurrency(form.valor_passagem),
        pis_pasep:             form.pis_pasep.replace(/\D/g, "") || null,
        ctps_numero:           form.ctps_numero.trim() || null,
        ctps_serie:            form.ctps_serie.trim() || null,
        banco:                 form.banco.trim() || null,
        agencia:               form.agencia.trim() || null,
        conta:                 form.conta.trim() || null,
        tipo_conta:            (form.tipo_conta as "corrente" | "poupanca") || null,
        chave_pix:             form.chave_pix.trim() || null,
      };

      if (isEdit) {
        const { error } = await supabase.from("staff").update(payload).eq("id", editId!);
        if (error) throw error;
      } else {
        const { data: newStaff, error } = await supabase
          .from("staff")
          .insert([{
            ...payload,
            contractor_id: user!.contractorId!,
            password_hash: btoa(form.password),
            active: true,
          }])
          .select("id")
          .single();
        if (error) throw error;

        // Create initial salary record if provided
        const salario = parseCurrency(form.salario_inicial);
        if (newStaff && salario && salario > 0) {
          await supabase.from("staff_salarios").insert([{
            staff_id:      newStaff.id,
            contractor_id: user!.contractorId!,
            data_vigencia: form.data_admissao || new Date().toISOString().split("T")[0],
            valor:         salario,
            motivo:        "admissao",
          }]);
        }
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Membro atualizado com sucesso." : "Membro cadastrado com sucesso.");
      onSaved();
      onClose();
    },
    onError: (err) => {
      if ((err as Error).message !== "validation") {
        console.error("staff save error:", err);
        toast.error("Erro ao salvar. Tente novamente.");
      }
    },
  });

  // ── Tab definitions ──────────────────────────────────────────────────────

  const baseTabs: { id: TabId; label: string }[] = [
    { id: "pessoal",      label: "Pessoal" },
    { id: "profissional", label: "Profissional" },
    { id: "sistema",      label: "Sistema" },
  ];
  const editTabs: { id: TabId; label: string }[] = [
    { id: "salario",      label: "Salário" },
    { id: "ferias",       label: "Férias" },
    { id: "ocorrencias",  label: "Ocorrências" },
  ];
  const tabs = isEdit ? [...baseTabs, ...editTabs] : baseTabs;

  const isRelationalTab = activeTab === "salario" || activeTab === "ferias" || activeTab === "ocorrencias";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />

        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 rounded-full p-1.5">
                <Users className="w-4 h-4 text-primary" />
              </span>
              <span className="font-bold text-gray-900">
                {isEdit ? "Editar membro" : "Novo membro"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {isEdit && (
                <button
                  onClick={() => setShowChangePwd(true)}
                  className="inline-flex items-center gap-1.5 text-primary font-semibold text-sm hover:underline"
                >
                  <KeyRound className="w-3.5 h-3.5" /> ALTERAR SENHA
                </button>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-gray-200 px-6 flex-shrink-0 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Body */}
          {loadingData ? (
            <div className="flex-1 flex items-center justify-center p-10">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

              {/* ══════════════════════════════════════════════════════
                  TAB: PESSOAL
              ══════════════════════════════════════════════════════ */}
              {activeTab === "pessoal" && (
                <>
                  <SectionBlock title="Dados pessoais">
                    <div>
                      <label className={LBL}>Nome<Req /></label>
                      <input className={INP} placeholder="Nome completo" value={form.name} onChange={e => set("name", e.target.value)} />
                      <FieldError msg={errors.name} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={LBL}>CPF</label>
                        <input className={INP} placeholder="000.000.000-00" value={form.cpf} onChange={e => set("cpf", maskCPF(e.target.value))} />
                      </div>
                      <div>
                        <label className={LBL}>RG</label>
                        <input className={INP} placeholder="RG" value={form.rg} onChange={e => set("rg", e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={LBL}>Data de nascimento<Req /></label>
                        <input type="date" className={INP} value={form.data_nascimento} onChange={e => set("data_nascimento", e.target.value)} />
                        <FieldError msg={errors.data_nascimento} />
                      </div>
                      <div>
                        <label className={LBL}>Sexo</label>
                        <SelectWrap>
                          <select className={SEL} value={form.sexo} onChange={e => set("sexo", e.target.value)}>
                            <option value="">Selecionar</option>
                            <option value="masculino">Masculino</option>
                            <option value="feminino">Feminino</option>
                            <option value="outro">Outro</option>
                          </select>
                        </SelectWrap>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={LBL}>E-mail<Req /></label>
                        <input type="email" className={INP} placeholder="email@exemplo.com" value={form.email} onChange={e => set("email", e.target.value)} />
                        <FieldError msg={errors.email} />
                      </div>
                      <div>
                        <label className={LBL}>Telefone<Req /></label>
                        <input className={INP} placeholder="(00) 00000-0000" value={form.telefone} onChange={e => set("telefone", maskPhone(e.target.value))} />
                        <FieldError msg={errors.telefone} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={LBL}>Tipo de conselho</label>
                        <SelectWrap>
                          <select className={SEL} value={form.tipo_conselho} onChange={e => set("tipo_conselho", e.target.value)}>
                            {CONSELHOS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </SelectWrap>
                      </div>
                      <div>
                        <label className={LBL}>Número do conselho</label>
                        <input className={INP} placeholder="Ex: 000000-G/SP" value={form.numero_conselho} onChange={e => set("numero_conselho", e.target.value)} />
                      </div>
                    </div>

                    {/* Senha (somente ao criar) */}
                    {!isEdit && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={LBL}>Senha<Req /></label>
                          <div className="relative">
                            <input
                              type={form.showPassword ? "text" : "password"}
                              className={INP + " pr-7"}
                              placeholder="Senha de acesso"
                              value={form.password}
                              onChange={e => set("password", e.target.value)}
                              autoComplete="new-password"
                            />
                            <button type="button" onClick={() => set("showPassword", !form.showPassword)} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              {form.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <FieldError msg={errors.password} />
                        </div>
                        <div>
                          <label className={LBL}>Confirme a senha<Req /></label>
                          <div className="relative">
                            <input
                              type={form.showConfirmPassword ? "text" : "password"}
                              className={INP + " pr-7"}
                              placeholder="Confirmar senha"
                              value={form.confirm_password}
                              onChange={e => set("confirm_password", e.target.value)}
                              autoComplete="new-password"
                            />
                            <button type="button" onClick={() => set("showConfirmPassword", !form.showConfirmPassword)} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              {form.showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <FieldError msg={errors.confirm_password} />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <p className="text-sm text-gray-700 font-medium">Bloquear acesso ao sistema</p>
                        <p className="text-xs text-gray-400 mt-0.5">O membro não poderá fazer login</p>
                      </div>
                      <Toggle active={form.blocked} onToggle={() => set("blocked", !form.blocked)} />
                    </div>
                  </SectionBlock>

                  <SectionBlock title="Perfil de acesso">
                    <div>
                      <label className={LBL}>Cargo<Req /></label>
                      <SelectWrap>
                        <select className={SEL} value={form.role} onChange={e => set("role", e.target.value as StaffRole)}>
                          <option value="">Selecionar cargo</option>
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </SelectWrap>
                      <FieldError msg={errors.role} />
                    </div>
                  </SectionBlock>
                </>
              )}

              {/* ══════════════════════════════════════════════════════
                  TAB: PROFISSIONAL
              ══════════════════════════════════════════════════════ */}
              {activeTab === "profissional" && (
                <>
                  <SectionBlock title="Vínculo empregatício">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={LBL}>Data de admissão</label>
                        <input type="date" className={INP} value={form.data_admissao} onChange={e => set("data_admissao", e.target.value)} />
                      </div>
                      <div>
                        <label className={LBL}>Data de demissão</label>
                        <input type="date" className={INP} value={form.data_demissao} onChange={e => set("data_demissao", e.target.value)} />
                        <FieldError msg={errors.data_demissao} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={LBL}>Tipo de contrato</label>
                        <SelectWrap>
                          <select className={SEL} value={form.tipo_contrato} onChange={e => set("tipo_contrato", e.target.value)}>
                            <option value="">Selecionar</option>
                            {CONTRATOS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </SelectWrap>
                      </div>
                      <div>
                        <label className={LBL}>Carga horária semanal (h)</label>
                        <input
                          type="number"
                          className={INP}
                          placeholder="Ex: 40"
                          min={1}
                          max={168}
                          value={form.carga_horaria_semanal}
                          onChange={e => set("carga_horaria_semanal", e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={LBL}>Cargo / Função</label>
                      <input className={INP} placeholder="Ex: Coordenador de Musculação" value={form.cargo_descricao} onChange={e => set("cargo_descricao", e.target.value)} />
                    </div>
                  </SectionBlock>

                  <SectionBlock title="Documentos trabalhistas">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className={LBL}>PIS / PASEP</label>
                        <input className={INP} placeholder="000.00000.00-0" value={form.pis_pasep} onChange={e => set("pis_pasep", maskPIS(e.target.value))} />
                      </div>
                      <div>
                        <label className={LBL}>CTPS Nº</label>
                        <input className={INP} placeholder="Número CTPS" value={form.ctps_numero} onChange={e => set("ctps_numero", e.target.value)} />
                      </div>
                      <div>
                        <label className={LBL}>CTPS Série</label>
                        <input className={INP} placeholder="Série" value={form.ctps_serie} onChange={e => set("ctps_serie", e.target.value)} />
                      </div>
                    </div>
                  </SectionBlock>

                  <SectionBlock title="Remuneração e benefícios">
                    <div className="grid grid-cols-2 gap-4">
                      {!isEdit ? (
                        <div>
                          <label className={LBL}>Salário inicial (R$)</label>
                          <input
                            className={INP}
                            placeholder="0,00"
                            value={form.salario_inicial}
                            onChange={e => set("salario_inicial", maskCurrency(e.target.value))}
                          />
                          <p className="text-xs text-gray-400 mt-1">Cria o primeiro registro no histórico salarial.</p>
                        </div>
                      ) : (
                        <div>
                          <label className={LBL}>Salário atual</label>
                          <p className="text-sm text-gray-500 py-2">Ver aba <strong>Salário</strong></p>
                        </div>
                      )}
                      <div>
                        <label className={LBL}>Vale transporte (R$/mês)</label>
                        <input
                          className={INP}
                          placeholder="0,00"
                          value={form.valor_passagem}
                          onChange={e => set("valor_passagem", maskCurrency(e.target.value))}
                        />
                      </div>
                    </div>
                  </SectionBlock>

                  <SectionBlock title="Dados bancários">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={LBL}>Banco</label>
                        <input className={INP} placeholder="Ex: Bradesco" value={form.banco} onChange={e => set("banco", e.target.value)} />
                      </div>
                      <div>
                        <label className={LBL}>Agência</label>
                        <input className={INP} placeholder="0000" value={form.agencia} onChange={e => set("agencia", e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={LBL}>Conta</label>
                        <input className={INP} placeholder="00000-0" value={form.conta} onChange={e => set("conta", e.target.value)} />
                      </div>
                      <div>
                        <label className={LBL}>Tipo de conta</label>
                        <SelectWrap>
                          <select className={SEL} value={form.tipo_conta} onChange={e => set("tipo_conta", e.target.value)}>
                            <option value="">Selecionar</option>
                            <option value="corrente">Corrente</option>
                            <option value="poupanca">Poupança</option>
                          </select>
                        </SelectWrap>
                      </div>
                    </div>
                    <div>
                      <label className={LBL}>Chave PIX</label>
                      <input className={INP} placeholder="CPF, e-mail, telefone ou chave aleatória" value={form.chave_pix} onChange={e => set("chave_pix", e.target.value)} />
                    </div>
                  </SectionBlock>
                </>
              )}

              {/* ══════════════════════════════════════════════════════
                  TAB: SISTEMA
              ══════════════════════════════════════════════════════ */}
              {activeTab === "sistema" && (
                <>
                  <SectionBlock title="Endereço">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className={LBL}>CEP</label>
                        <div className="relative">
                          <input
                            className={INP}
                            placeholder="00000-000"
                            value={form.cep}
                            onChange={e => set("cep", maskCEP(e.target.value))}
                            onBlur={handleCEPBlur}
                          />
                          {cepLoading && <Loader2 className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className={LBL}>Logradouro</label>
                        <input className={INP} placeholder="Rua, Av, etc." value={form.logradouro} onChange={e => set("logradouro", e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className={LBL}>Número</label>
                        <input className={INP} placeholder="Nº" value={form.numero_endereco} onChange={e => set("numero_endereco", e.target.value)} />
                      </div>
                      <div>
                        <label className={LBL}>Cidade</label>
                        <input className={INP} placeholder="Cidade" value={form.cidade} onChange={e => set("cidade", e.target.value)} />
                      </div>
                      <div>
                        <label className={LBL}>Bairro</label>
                        <input className={INP} placeholder="Bairro" value={form.bairro} onChange={e => set("bairro", e.target.value)} />
                      </div>
                      <div>
                        <label className={LBL}>Complemento</label>
                        <input className={INP} placeholder="Apto, Bloco..." value={form.complemento} onChange={e => set("complemento", e.target.value)} />
                      </div>
                      <div>
                        <label className={LBL}>UF</label>
                        <SelectWrap>
                          <select className={SEL} value={form.uf} onChange={e => set("uf", e.target.value)}>
                            <option value="">UF</option>
                            {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                          </select>
                        </SelectWrap>
                      </div>
                    </div>
                  </SectionBlock>

                  <SectionBlock title="Horários de uso do sistema">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-700 font-medium">Limitar dias e horários de uso do sistema</p>
                        <p className="text-xs text-gray-400 mt-0.5">Define quando o membro pode acessar o sistema</p>
                      </div>
                      <Toggle active={form.horarios_ativo} onToggle={() => set("horarios_ativo", !form.horarios_ativo)} />
                    </div>

                    {form.horarios_ativo && (
                      <div className="space-y-3 pt-2">
                        {form.horarios_periodos.map((periodo, idx) => (
                          <div key={periodo._id} className="border border-gray-200 rounded-lg p-3 space-y-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {DIAS_SEMANA.map(({ key, label }) => {
                                const selected = periodo.dias.includes(key);
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => toggleDia(idx, key)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                                      selected
                                        ? "bg-primary/10 text-primary font-semibold border border-primary/30"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex items-end gap-4">
                              <div className="flex-1">
                                <label className={LBL}>Hora inicial</label>
                                <input type="time" className={INP} value={periodo.hora_inicio} disabled={periodo.horario_livre} onChange={e => updatePeriodo(idx, "hora_inicio", e.target.value)} />
                              </div>
                              <div className="flex-1">
                                <label className={LBL}>Hora final</label>
                                <input type="time" className={INP} value={periodo.hora_fim} disabled={periodo.horario_livre} onChange={e => updatePeriodo(idx, "hora_fim", e.target.value)} />
                              </div>
                              <div className="flex items-center gap-2 pb-2">
                                <Toggle active={periodo.horario_livre} onToggle={() => updatePeriodo(idx, "horario_livre", !periodo.horario_livre)} />
                                <span className="text-sm text-gray-700">Horário livre</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removePeriodo(idx)}
                                disabled={form.horarios_periodos.length === 1}
                                className="pb-2 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button type="button" onClick={addPeriodo} className="flex items-center gap-1.5 text-primary font-semibold text-sm hover:underline">
                          <Plus className="w-4 h-4" /> NOVO PERÍODO
                        </button>
                      </div>
                    )}
                  </SectionBlock>

                  <SectionBlock title="Documentos">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border-2 border-dashed border-gray-200 rounded-lg p-5 flex flex-col items-center justify-center gap-2 text-center">
                        <Upload className="w-7 h-7 text-gray-300" />
                        <p className="text-sm text-gray-500">Arraste e solte ou</p>
                        <p className="text-xs text-gray-400">doc, docx, jpg, pdf, png</p>
                        <button type="button" disabled title="Em breve" className="mt-1 px-3 py-1 border border-gray-200 text-gray-400 text-xs font-semibold rounded cursor-not-allowed select-none">
                          SELECIONAR ARQUIVO
                        </button>
                      </div>
                      <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-center min-h-[100px]">
                        <p className="text-sm text-gray-400">Nenhum arquivo encontrado</p>
                      </div>
                    </div>
                  </SectionBlock>

                  <SectionBlock title="Observações">
                    <textarea
                      className="w-full bg-transparent border border-gray-200 rounded-lg p-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary transition-colors resize-none"
                      rows={3}
                      placeholder="Observação"
                      value={form.observacoes}
                      onChange={e => set("observacoes", e.target.value)}
                    />
                  </SectionBlock>
                </>
              )}

              {/* ══════════════════════════════════════════════════════
                  TABS RELACIONAIS (edit only)
              ══════════════════════════════════════════════════════ */}
              {activeTab === "salario" && editId && user?.contractorId && (
                <StaffSalarioTab staffId={editId} contractorId={user.contractorId} />
              )}
              {activeTab === "ferias" && editId && user?.contractorId && (
                <StaffFeriasTab staffId={editId} contractorId={user.contractorId} />
              )}
              {activeTab === "ocorrencias" && editId && user?.contractorId && (
                <StaffOcorrenciasTab staffId={editId} contractorId={user.contractorId} />
              )}

            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0 bg-white">
            <button onClick={onClose} className="text-primary font-semibold text-sm hover:underline px-2">
              {isRelationalTab ? "FECHAR" : "CANCELAR"}
            </button>
            {!isRelationalTab && (
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || loadingData}
                className="bg-primary text-white font-semibold px-4 py-2 rounded-md text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saveMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                  : "SALVAR"}
              </button>
            )}
          </div>
        </div>
      </div>

      {showChangePwd && editId && (
        <ChangePasswordModal staffId={editId} onClose={() => setShowChangePwd(false)} />
      )}
    </>
  );
}
