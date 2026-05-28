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

const DIAS_SEMANA = [
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
];

const ROLES: { value: StaffRole; label: string }[] = [
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

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
];

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
  cep: "", logradouro: "", numero_endereco: "", cidade: "", uf: "", bairro: "", complemento: "",
  horarios_ativo: false, horarios_periodos: [newPeriodo()],
  observacoes: "",
};

const INP = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white disabled:bg-gray-50 disabled:text-gray-400";
const SEL = INP + " appearance-none cursor-pointer pr-8";
const LBL = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1";

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-xs font-bold text-primary uppercase tracking-widest whitespace-nowrap">{title}</span>
      <div className="flex-1 border-t border-gray-100" />
    </div>
  );
}

function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

function Toggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${active ? "bg-primary" : "bg-gray-200"}`}
    >
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${active ? "translate-x-5" : ""}`} />
    </button>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

export default function StaffMemberModal({ editId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const isEdit = !!editId;

  const [form, setForm]             = useState<FormState>(EMPTY);
  const [errors, setErrors]         = useState<FormErrors>({});
  const [cepLoading, setCepLoading] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }));
  }

  // Load data when editing
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

  // Períodos helpers
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
      if (!form.name.trim())          errs.name          = "Nome é obrigatório.";
      if (!form.email.trim())         errs.email         = "E-mail é obrigatório.";
      if (!form.data_nascimento)      errs.data_nascimento = "Data de nascimento é obrigatória.";
      if (!form.telefone.trim())      errs.telefone      = "Telefone é obrigatório.";
      if (!form.role)                 errs.role          = "Selecione o perfil de acesso.";
      if (!isEdit) {
        if (!form.password.trim())        errs.password        = "Senha é obrigatória.";
        else if (form.password.length < 6) errs.password       = "Mínimo 6 caracteres.";
        else if (form.password !== form.confirm_password)
          errs.confirm_password = "Senhas não conferem.";
      }
      if (Object.keys(errs).length > 0) { setErrors(errs); throw new Error("validation"); }

      const horarios_restricao = form.horarios_ativo
        ? {
            ativo: true,
            periodos: form.horarios_periodos.map(({ _id: _, ...p }) => p),
          }
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
      };

      if (isEdit) {
        const { error } = await supabase.from("staff").update(payload).eq("id", editId!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("staff").insert([{
          ...payload,
          contractor_id: user!.contractorId!,
          password_hash: btoa(form.password),
          active: true,
        }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Membro atualizado com sucesso." : "Membro cadastrado com sucesso.");
      onSaved();
      onClose();
    },
    onError: (err) => {
      if ((err as Error).message !== "validation") {
        toast.error("Erro ao salvar. Tente novamente.");
      }
    },
  });

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">
                  {isEdit ? "Editar membro" : "Novo membro"}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isEdit ? "Atualize os dados do profissional." : "Preencha os dados do novo profissional."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEdit && (
                <button
                  onClick={() => setShowChangePwd(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" /> ALTERAR SENHA
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          {loadingData ? (
            <div className="flex-1 flex items-center justify-center p-10">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* ── SEÇÃO 1: Dados principais ── */}
              <section className="space-y-4">
                <SectionHeader title="Dados principais" />
                <div className="grid grid-cols-2 gap-3">

                  {/* Nome */}
                  <div className="col-span-2">
                    <label className={LBL}>Nome *</label>
                    <input className={INP} placeholder="Nome completo" value={form.name} onChange={e => set("name", e.target.value)} />
                    <FieldError msg={errors.name} />
                  </div>

                  {/* CPF | RG */}
                  <div>
                    <label className={LBL}>CPF</label>
                    <input className={INP} placeholder="000.000.000-00" value={form.cpf} onChange={e => set("cpf", maskCPF(e.target.value))} />
                  </div>
                  <div>
                    <label className={LBL}>RG</label>
                    <input className={INP} placeholder="RG" value={form.rg} onChange={e => set("rg", e.target.value)} />
                  </div>

                  {/* Data nascimento | Sexo */}
                  <div>
                    <label className={LBL}>Data de nascimento *</label>
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

                  {/* Email | Telefone */}
                  <div>
                    <label className={LBL}>E-mail *</label>
                    <input type="email" className={INP} placeholder="email@exemplo.com" value={form.email} onChange={e => set("email", e.target.value)} />
                    <FieldError msg={errors.email} />
                  </div>
                  <div>
                    <label className={LBL}>Telefone *</label>
                    <input className={INP} placeholder="(00) 00000-0000" value={form.telefone} onChange={e => set("telefone", maskPhone(e.target.value))} />
                    <FieldError msg={errors.telefone} />
                  </div>

                  {/* Tipo conselho | Número */}
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

                  {/* Senha (somente ao criar) */}
                  {!isEdit && (
                    <>
                      <div>
                        <label className={LBL}>Senha *</label>
                        <div className="relative">
                          <input
                            type={form.showPassword ? "text" : "password"}
                            className={INP + " pr-10"}
                            placeholder="Senha de acesso"
                            value={form.password}
                            onChange={e => set("password", e.target.value)}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => set("showPassword", !form.showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {form.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <FieldError msg={errors.password} />
                      </div>
                      <div>
                        <label className={LBL}>Confirme a senha *</label>
                        <div className="relative">
                          <input
                            type={form.showConfirmPassword ? "text" : "password"}
                            className={INP + " pr-10"}
                            placeholder="Confirme a senha"
                            value={form.confirm_password}
                            onChange={e => set("confirm_password", e.target.value)}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => set("showConfirmPassword", !form.showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {form.showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <FieldError msg={errors.confirm_password} />
                      </div>
                    </>
                  )}

                  {/* Bloquear acesso */}
                  <div className="col-span-2">
                    <div
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer"
                      onClick={() => set("blocked", !form.blocked)}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">Bloquear acesso ao sistema</p>
                        <p className="text-xs text-gray-500 mt-0.5">O membro não poderá fazer login</p>
                      </div>
                      <Toggle active={form.blocked} onToggle={() => set("blocked", !form.blocked)} />
                    </div>
                  </div>
                </div>
              </section>

              {/* ── SEÇÃO 2: Perfil de acesso ── */}
              <section className="space-y-4">
                <SectionHeader title="Perfil de acesso" />
                <div>
                  <label className={LBL}>Cargo *</label>
                  <SelectWrap>
                    <select className={SEL} value={form.role} onChange={e => set("role", e.target.value as StaffRole)}>
                      <option value="">Selecionar cargo</option>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </SelectWrap>
                  <FieldError msg={errors.role} />
                </div>
              </section>

              {/* ── SEÇÃO 3: Endereço ── */}
              <section className="space-y-4">
                <SectionHeader title="Endereço" />
                <div className="grid grid-cols-3 gap-3">
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
                      {cepLoading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className={LBL}>Logradouro</label>
                    <input className={INP} placeholder="Rua, Av, etc." value={form.logradouro} onChange={e => set("logradouro", e.target.value)} />
                  </div>
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
              </section>

              {/* ── SEÇÃO 4: Horários ── */}
              <section className="space-y-4">
                <SectionHeader title="Horários de uso do sistema" />

                <div
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer"
                  onClick={() => set("horarios_ativo", !form.horarios_ativo)}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">Limitar dias e horários de uso do sistema</p>
                    <p className="text-xs text-gray-500 mt-0.5">Define quando o membro pode acessar o sistema</p>
                  </div>
                  <Toggle active={form.horarios_ativo} onToggle={() => set("horarios_ativo", !form.horarios_ativo)} />
                </div>

                {form.horarios_ativo && (
                  <div className="space-y-3">
                    {form.horarios_periodos.map((periodo, idx) => (
                      <div key={periodo._id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                        {/* Day chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {DIAS_SEMANA.map(({ key, label }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleDia(idx, key)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-colors ${
                                periodo.dias.includes(key)
                                  ? "bg-primary text-white"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        {/* Time + controls */}
                        <div className="flex items-end gap-3">
                          <div className="flex-1">
                            <label className={LBL}>Hora inicial</label>
                            <input
                              type="time"
                              className={INP}
                              value={periodo.hora_inicio}
                              disabled={periodo.horario_livre}
                              onChange={e => updatePeriodo(idx, "hora_inicio", e.target.value)}
                            />
                          </div>
                          <div className="flex-1">
                            <label className={LBL}>Hora final</label>
                            <input
                              type="time"
                              className={INP}
                              value={periodo.hora_fim}
                              disabled={periodo.horario_livre}
                              onChange={e => updatePeriodo(idx, "hora_fim", e.target.value)}
                            />
                          </div>
                          <div className="flex flex-col items-center gap-1 pb-1">
                            <span className="text-xs text-gray-500 font-medium">Horário livre</span>
                            <Toggle
                              active={periodo.horario_livre}
                              onToggle={() => updatePeriodo(idx, "horario_livre", !periodo.horario_livre)}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removePeriodo(idx)}
                            disabled={form.horarios_periodos.length === 1}
                            className="pb-1 p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Remover período"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addPeriodo}
                      className="w-full py-2.5 border border-dashed border-gray-300 text-gray-500 text-sm font-semibold rounded-xl hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> NOVO PERÍODO
                    </button>
                  </div>
                )}
              </section>

              {/* ── SEÇÃO 5: Documentos ── */}
              <section className="space-y-4">
                <SectionHeader title="Documentos" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-center">
                    <Upload className="w-8 h-8 text-gray-300" />
                    <div>
                      <p className="text-sm text-gray-500">Arraste e solte ou</p>
                      <p className="text-xs text-gray-400 mt-1">doc, docx, jpg, pdf, png</p>
                    </div>
                    <button
                      type="button"
                      disabled
                      title="Em breve"
                      className="px-4 py-1.5 border border-gray-200 text-gray-400 text-xs font-semibold rounded-lg cursor-not-allowed select-none"
                    >
                      SELECIONAR ARQUIVO
                    </button>
                  </div>
                  <div className="border border-gray-100 rounded-xl p-4 min-h-[120px] flex items-center justify-center">
                    <p className="text-sm text-gray-400">Nenhum arquivo encontrado</p>
                  </div>
                </div>
              </section>

              {/* ── SEÇÃO 6: Observações ── */}
              <section className="space-y-4">
                <SectionHeader title="Observações" />
                <textarea
                  className={INP + " resize-none"}
                  rows={3}
                  placeholder="Observação"
                  value={form.observacoes}
                  onChange={e => set("observacoes", e.target.value)}
                />
              </section>

            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 bg-white flex-shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              CANCELAR
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || loadingData}
              className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saveMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                : "SALVAR"}
            </button>
          </div>
        </div>
      </div>

      {showChangePwd && editId && (
        <ChangePasswordModal staffId={editId} onClose={() => setShowChangePwd(false)} />
      )}
    </>
  );
}
