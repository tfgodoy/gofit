import { useState, useEffect } from "react";
import { X, Loader2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { StaffRole } from "@/integrations/supabase/types";

interface Props {
  editId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  email: string;
  password: string;
  role: StaffRole | "";
  active: boolean;
  cpf: string;
  rg: string;
  data_nascimento: string;
  sexo: string;
  telefone: string;
  tipo_conselho: string;
  numero_conselho: string;
  cep: string;
  logradouro: string;
  numero_endereco: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  observacoes: string;
}

const EMPTY: FormState = {
  name: "", email: "", password: "", role: "",
  active: true,
  cpf: "", rg: "", data_nascimento: "", sexo: "",
  telefone: "", tipo_conselho: "CREF", numero_conselho: "",
  cep: "", logradouro: "", numero_endereco: "", complemento: "",
  bairro: "", cidade: "", uf: "",
  observacoes: "",
};

const ROLES: { value: StaffRole; label: string }[] = [
  { value: "teacher",         label: "Professor" },
  { value: "receptionist",    label: "Recepcionista" },
  { value: "sales",           label: "Vendas" },
  { value: "nutritionist",    label: "Nutricionista" },
  { value: "physiotherapist", label: "Fisioterapeuta" },
  { value: "evaluator",       label: "Avaliador" },
];

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const CONSELHOS = ["CREF","CREFITO","CRN","CRM","CRBM","CRF","CRTR","Outro"];

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function maskCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function maskCEP(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

const INP = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white";
const SEL = INP + " appearance-none cursor-pointer";
const LBL = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={LBL}>{label}</label>
      {children}
    </div>
  );
}

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">{title}</span>
      <div className="flex-1 border-t border-gray-100" />
    </div>
  );
}

export default function StaffFormModal({ editId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [form, setForm]     = useState<FormState>(EMPTY);
  const [loading, setLoading]   = useState(!!editId);
  const [saving, setSaving]     = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [error, setError]   = useState("");
  const isEdit = !!editId;

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data } = await supabase
        .from("staff")
        .select("*")
        .eq("id", editId)
        .single();
      if (data) {
        setForm({
          name:             data.name ?? "",
          email:            data.email ?? "",
          password:         "",
          role:             (data.role as StaffRole) ?? "",
          active:           data.active ?? true,
          cpf:              data.cpf ?? "",
          rg:               data.rg ?? "",
          data_nascimento:  data.data_nascimento ?? "",
          sexo:             data.sexo ?? "",
          telefone:         data.telefone ? maskPhone(data.telefone) : "",
          tipo_conselho:    data.tipo_conselho ?? "CREF",
          numero_conselho:  data.numero_conselho ?? "",
          cep:              data.cep ? maskCEP(data.cep) : "",
          logradouro:       data.logradouro ?? "",
          numero_endereco:  data.numero_endereco ?? "",
          complemento:      data.complemento ?? "",
          bairro:           data.bairro ?? "",
          cidade:           data.cidade ?? "",
          uf:               data.uf ?? "",
          observacoes:      data.observacoes ?? "",
        });
      }
      setLoading(false);
    })();
  }, [editId]);

  function set(field: keyof FormState, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
  }

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

  async function handleSave() {
    setError("");
    if (!form.name.trim())  { setError("Informe o nome do membro."); return; }
    if (!form.email.trim()) { setError("Informe o e-mail."); return; }
    if (!form.role)         { setError("Selecione o cargo."); return; }
    if (!isEdit && !form.password.trim()) { setError("Informe uma senha de acesso."); return; }

    setSaving(true);
    const payload = {
      name:            form.name.trim(),
      email:           form.email.trim(),
      role:            form.role as StaffRole,
      active:          form.active,
      cpf:             form.cpf.replace(/\D/g, "") || null,
      rg:              form.rg.trim() || null,
      data_nascimento: form.data_nascimento || null,
      sexo:            (form.sexo as "masculino" | "feminino" | "outro") || null,
      telefone:        form.telefone.replace(/\D/g, "") || null,
      tipo_conselho:   form.tipo_conselho || null,
      numero_conselho: form.numero_conselho.trim() || null,
      cep:             form.cep.replace(/\D/g, "") || null,
      logradouro:      form.logradouro.trim() || null,
      numero_endereco: form.numero_endereco.trim() || null,
      complemento:     form.complemento.trim() || null,
      bairro:          form.bairro.trim() || null,
      cidade:          form.cidade.trim() || null,
      uf:              form.uf || null,
      observacoes:     form.observacoes.trim() || null,
    };

    if (isEdit) {
      const updatePayload: typeof payload & { password_hash?: string } = { ...payload };
      if (form.password.trim()) {
        updatePayload.password_hash = btoa(form.password);
      }
      const { error: err } = await supabase
        .from("staff")
        .update(updatePayload)
        .eq("id", editId!);
      if (err) { setError("Erro ao salvar. Tente novamente."); setSaving(false); return; }
      toast.success("Membro atualizado com sucesso.");
    } else {
      const { error: err } = await supabase
        .from("staff")
        .insert([{
          ...payload,
          contractor_id: user!.contractorId!,
          password_hash: btoa(form.password),
        }]);
      if (err) { setError("Erro ao cadastrar. Tente novamente."); setSaving(false); return; }
      toast.success("Membro cadastrado com sucesso.");
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer — right side */}
      <div className="relative ml-auto w-full max-w-xl bg-white shadow-2xl flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-base">
              {isEdit ? "Editar membro" : "Novo membro da equipe"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEdit ? "Atualize os dados do profissional." : "Preencha os dados do novo profissional."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* Dados Pessoais */}
            <section>
              <SectionTitle title="Dados Pessoais" />
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Field label="Nome completo *">
                    <input
                      className={INP}
                      placeholder="Nome do profissional"
                      value={form.name}
                      onChange={e => set("name", e.target.value)}
                    />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="E-mail *">
                    <input
                      type="email"
                      className={INP}
                      placeholder="email@exemplo.com"
                      value={form.email}
                      onChange={e => set("email", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Telefone">
                  <input
                    className={INP}
                    placeholder="(00) 00000-0000"
                    value={form.telefone}
                    onChange={e => set("telefone", maskPhone(e.target.value))}
                  />
                </Field>
                <Field label="CPF">
                  <input
                    className={INP}
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={e => set("cpf", maskCPF(e.target.value))}
                  />
                </Field>
                <Field label="RG">
                  <input
                    className={INP}
                    placeholder="RG"
                    value={form.rg}
                    onChange={e => set("rg", e.target.value)}
                  />
                </Field>
                <Field label="Data de nascimento">
                  <input
                    type="date"
                    className={INP}
                    value={form.data_nascimento}
                    onChange={e => set("data_nascimento", e.target.value)}
                  />
                </Field>
                <Field label="Sexo">
                  <SelectWrapper>
                    <select
                      className={SEL}
                      value={form.sexo}
                      onChange={e => set("sexo", e.target.value)}
                    >
                      <option value="">Selecionar</option>
                      <option value="masculino">Masculino</option>
                      <option value="feminino">Feminino</option>
                      <option value="outro">Outro</option>
                    </select>
                  </SelectWrapper>
                </Field>
              </div>
            </section>

            {/* Dados Profissionais */}
            <section>
              <SectionTitle title="Dados Profissionais" />
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Field label="Cargo *">
                    <SelectWrapper>
                      <select
                        className={SEL}
                        value={form.role}
                        onChange={e => set("role", e.target.value)}
                      >
                        <option value="">Selecionar cargo</option>
                        {ROLES.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </SelectWrapper>
                  </Field>
                </div>
                <Field label="Tipo de conselho">
                  <SelectWrapper>
                    <select
                      className={SEL}
                      value={form.tipo_conselho}
                      onChange={e => set("tipo_conselho", e.target.value)}
                    >
                      {CONSELHOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </SelectWrapper>
                </Field>
                <Field label="Número do conselho">
                  <input
                    className={INP}
                    placeholder="Ex: 000000-G/SP"
                    value={form.numero_conselho}
                    onChange={e => set("numero_conselho", e.target.value)}
                  />
                </Field>
              </div>
            </section>

            {/* Endereço */}
            <section>
              <SectionTitle title="Endereço" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="CEP">
                  <div className="relative">
                    <input
                      className={INP}
                      placeholder="00000-000"
                      value={form.cep}
                      onChange={e => set("cep", maskCEP(e.target.value))}
                      onBlur={handleCEPBlur}
                    />
                    {cepLoading && (
                      <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                    )}
                  </div>
                </Field>
                <Field label="Número">
                  <input
                    className={INP}
                    placeholder="Nº"
                    value={form.numero_endereco}
                    onChange={e => set("numero_endereco", e.target.value)}
                  />
                </Field>
                <div className="col-span-2">
                  <Field label="Logradouro">
                    <input
                      className={INP}
                      placeholder="Rua, Av, etc."
                      value={form.logradouro}
                      onChange={e => set("logradouro", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Complemento">
                  <input
                    className={INP}
                    placeholder="Apto, Bloco..."
                    value={form.complemento}
                    onChange={e => set("complemento", e.target.value)}
                  />
                </Field>
                <Field label="Bairro">
                  <input
                    className={INP}
                    placeholder="Bairro"
                    value={form.bairro}
                    onChange={e => set("bairro", e.target.value)}
                  />
                </Field>
                <Field label="Cidade">
                  <input
                    className={INP}
                    placeholder="Cidade"
                    value={form.cidade}
                    onChange={e => set("cidade", e.target.value)}
                  />
                </Field>
                <Field label="UF">
                  <SelectWrapper>
                    <select
                      className={SEL}
                      value={form.uf}
                      onChange={e => set("uf", e.target.value)}
                    >
                      <option value="">UF</option>
                      {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </SelectWrapper>
                </Field>
              </div>
            </section>

            {/* Acesso */}
            <section>
              <SectionTitle title="Acesso ao Sistema" />
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Field label={isEdit ? "Nova senha (deixe em branco para manter)" : "Senha de acesso *"}>
                    <input
                      type="password"
                      className={INP}
                      placeholder={isEdit ? "••••••••" : "Senha inicial"}
                      value={form.password}
                      onChange={e => set("password", e.target.value)}
                      autoComplete="new-password"
                    />
                  </Field>
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      onClick={() => set("active", !form.active)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${form.active ? "bg-primary" : "bg-gray-200"}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.active ? "translate-x-5" : "translate-x-0"}`} />
                    </div>
                    <span className="text-sm text-gray-700 font-medium">
                      {form.active ? "Membro ativo" : "Membro inativo"}
                    </span>
                  </label>
                </div>
              </div>
            </section>

            {/* Observações */}
            <section>
              <SectionTitle title="Observações" />
              <textarea
                className={INP + " resize-none"}
                rows={3}
                placeholder="Anotações internas sobre o profissional..."
                value={form.observacoes}
                onChange={e => set("observacoes", e.target.value)}
              />
            </section>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-white">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            CANCELAR
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
              : isEdit ? "SALVAR ALTERAÇÕES" : "CADASTRAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
