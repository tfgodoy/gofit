import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { useCEP } from "@/hooks/useCEP";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── helpers de máscara ──────────────────────────────────────
function maskCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}
function maskCEP(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0,5)}-${d.slice(5)}`;
}

// ── tipos ──────────────────────────────────────────────────
type SocialType = "instagram" | "facebook" | "tiktok" | "twitter" | "outro";
interface ExtraContact { type: SocialType; value: string }

interface FormState {
  nome_completo: string; cpf: string; data_nascimento: string;
  sexo: string; status: string; telefone: string; email: string;
  cep: string; logradouro: string; numero: string; complemento: string;
  bairro: string; cidade: string; uf: string;
  tem_responsavel: boolean;
  responsavel_nome: string; responsavel_telefone: string; responsavel_email: string;
  whatsapp_notificacoes: boolean; observacoes: string;
}

const initial: FormState = {
  nome_completo: "", cpf: "", data_nascimento: "", sexo: "", status: "lead",
  telefone: "", email: "",
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
  tem_responsavel: false,
  responsavel_nome: "", responsavel_telefone: "", responsavel_email: "",
  whatsapp_notificacoes: true, observacoes: "",
};

// ── sub-componente de campo ─────────────────────────────────
const lbl = "block text-xs font-semibold mb-1.5 text-primary";
const inp = "w-full px-3 py-2.5 text-sm rounded-none border-0 border-b border-gray-200 focus:outline-none focus:border-primary bg-transparent transition-colors placeholder:text-gray-300";
const sel = inp + " cursor-pointer";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={lbl}>{label}{required && " *"}</label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <p className="text-sm font-bold text-gray-700 mb-5 pb-2 border-b border-gray-100">{title}</p>
      {children}
    </div>
  );
}

const SOCIAL_OPTIONS: { value: SocialType; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook",  label: "Facebook" },
  { value: "tiktok",    label: "TikTok" },
  { value: "twitter",   label: "Twitter / X" },
  { value: "outro",     label: "Outro" },
];

const SOCIAL_PLACEHOLDER: Record<SocialType, string> = {
  instagram: "@usuario",
  facebook: "facebook.com/usuario",
  tiktok: "@usuario",
  twitter: "@usuario",
  outro: "contato",
};

// ── página ─────────────────────────────────────────────────
export default function AlunoFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fetchCEP, loading: cepLoading } = useCEP();

  const [form, setForm] = useState<FormState>(initial);
  const [extras, setExtras] = useState<ExtraContact[]>([{ type: "instagram", value: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [error, setError] = useState("");

  // Load existing student data when editing
  useEffect(() => {
    if (!id || !user?.contractorId) return;
    (async () => {
      const { data } = await supabase
        .from("students")
        .select("*")
        .eq("id", id)
        .eq("contractor_id", user.contractorId!)
        .maybeSingle();

      if (data) {
        const d = data as Record<string, unknown>;
        const maskPhone = (v: string | null) => {
          if (!v) return "";
          const n = v.replace(/\D/g, "").slice(0, 11);
          if (n.length <= 2) return n;
          if (n.length <= 7) return `(${n.slice(0,2)}) ${n.slice(2)}`;
          if (n.length <= 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
          return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
        };
        const maskCPF = (v: string | null) => {
          if (!v) return "";
          const n = v.replace(/\D/g, "").slice(0, 11);
          if (n.length <= 3) return n;
          if (n.length <= 6) return `${n.slice(0,3)}.${n.slice(3)}`;
          if (n.length <= 9) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6)}`;
          return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`;
        };
        const maskCEP = (v: string | null) => {
          if (!v) return "";
          const n = v.replace(/\D/g, "").slice(0, 8);
          return n.length <= 5 ? n : `${n.slice(0,5)}-${n.slice(5)}`;
        };

        setForm({
          nome_completo:        (d.nome_completo as string) ?? "",
          cpf:                  maskCPF(d.cpf as string | null),
          data_nascimento:      (d.data_nascimento as string) ?? "",
          sexo:                 (d.sexo as string) ?? "",
          status:               (d.status as string) ?? "lead",
          telefone:             maskPhone(d.telefone as string | null),
          email:                (d.email as string) ?? "",
          cep:                  maskCEP(d.cep as string | null),
          logradouro:           (d.logradouro as string) ?? "",
          numero:               (d.numero as string) ?? "",
          complemento:          (d.complemento as string) ?? "",
          bairro:               (d.bairro as string) ?? "",
          cidade:               (d.cidade as string) ?? "",
          uf:                   (d.uf as string) ?? "",
          tem_responsavel:      Boolean(d.responsavel_nome),
          responsavel_nome:     (d.responsavel_nome as string) ?? "",
          responsavel_telefone: maskPhone(d.responsavel_telefone as string | null),
          responsavel_email:    (d.responsavel_email as string) ?? "",
          whatsapp_notificacoes: Boolean(d.whatsapp_notificacoes ?? true),
          observacoes:          (d.observacoes as string) ?? "",
        });

        const rawExtras = d.contatos_extras as { type: string; value: string }[] | null;
        if (Array.isArray(rawExtras) && rawExtras.length > 0) {
          setExtras(rawExtras as ExtraContact[]);
        }
      }
      setLoadingData(false);
    })();
  }, [id, user]);

  function set(field: keyof FormState, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleCEPBlur() {
    const data = await fetchCEP(form.cep);
    if (data) {
      setForm(prev => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        bairro:     data.bairro     || prev.bairro,
        cidade:     data.localidade || prev.cidade,
        uf:         data.uf         || prev.uf,
      }));
    }
  }

  function addExtra() {
    setExtras(prev => [...prev, { type: "instagram", value: "" }]);
  }
  function removeExtra(i: number) {
    setExtras(prev => prev.filter((_, idx) => idx !== i));
  }
  function setExtra(i: number, field: keyof ExtraContact, value: string) {
    setExtras(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!user?.contractorId) { setError("Sessão inválida."); return; }
    setSubmitting(true);

    const payload = {
      contractor_id:          user.contractorId,
      nome_completo:          form.nome_completo,
      cpf:                    form.cpf.replace(/\D/g, "") || null,
      data_nascimento:        form.data_nascimento || null,
      sexo:                   (form.sexo || null) as "masculino" | "feminino" | "outro" | null,
      status:                 form.status as "lead" | "ativo" | "inativo" | "cancelado",
      telefone:               form.telefone.replace(/\D/g, "") || null,
      email:                  form.email || null,
      cep:                    form.cep.replace(/\D/g, "") || null,
      logradouro:             form.logradouro || null,
      numero:                 form.numero || null,
      complemento:            form.complemento || null,
      bairro:                 form.bairro || null,
      cidade:                 form.cidade || null,
      uf:                     form.uf || null,
      responsavel_nome:       form.tem_responsavel ? form.responsavel_nome || null : null,
      responsavel_telefone:   form.tem_responsavel ? form.responsavel_telefone.replace(/\D/g, "") || null : null,
      responsavel_email:      form.tem_responsavel ? form.responsavel_email || null : null,
      contatos_extras:        extras.filter(e => e.value.trim()) as unknown as import("@/integrations/supabase/types").Json,
      whatsapp_notificacoes:  form.whatsapp_notificacoes,
      observacoes:            form.observacoes || null,
    };

    const { error: dbError } = isEdit
      ? await supabase.from("students").update(payload).eq("id", id!)
      : await supabase.from("students").insert([payload]);

    if (dbError) {
      setError("Erro ao salvar. Tente novamente.");
      setSubmitting(false);
      return;
    }
    navigate("/app/clientes");
  }

  if (loadingData) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/app/clientes"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para lista
          </Link>
          <h1 className="text-2xl font-extrabold text-gray-900">
            {isEdit ? "Editar cliente" : "Novo Cliente"}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isEdit ? "Atualize os dados do cliente" : "Preencha os dados para cadastrar um novo cliente ou lead"}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl border border-gray-100 p-7">

            {/* ── Dados Pessoais ── */}
            <Section title="Dados Pessoais">
              <div className="grid md:grid-cols-2 gap-x-10 gap-y-5">
                <div className="md:col-span-2 grid md:grid-cols-3 gap-x-10 gap-y-5">
                  <div className="md:col-span-2">
                    <Field label="Nome Completo" required>
                      <input className={inp} value={form.nome_completo}
                        onChange={e => set("nome_completo", e.target.value)} required />
                    </Field>
                  </div>
                  <Field label="CPF">
                    <input className={inp} value={form.cpf} placeholder="000.000.000-00"
                      onChange={e => set("cpf", maskCPF(e.target.value))} />
                  </Field>
                </div>

                <Field label="Data de Nascimento">
                  <input type="date" className={inp} value={form.data_nascimento}
                    onChange={e => set("data_nascimento", e.target.value)} />
                </Field>
                <Field label="Sexo">
                  <select className={sel} value={form.sexo}
                    onChange={e => set("sexo", e.target.value)}>
                    <option value="">Selecionar</option>
                    <option value="masculino">Masculino</option>
                    <option value="feminino">Feminino</option>
                    <option value="outro">Outro</option>
                  </select>
                </Field>

                <Field label="Telefone / WhatsApp">
                  <input className={inp} value={form.telefone} placeholder="(00) 00000-0000"
                    onChange={e => set("telefone", maskPhone(e.target.value))} />
                </Field>
                <Field label="E-mail">
                  <input type="email" className={inp} value={form.email}
                    placeholder="exemplo@email.com"
                    onChange={e => set("email", e.target.value)} />
                </Field>

                <Field label="Status" required>
                  <select className={sel} value={form.status}
                    onChange={e => set("status", e.target.value)} required>
                    <option value="lead">Lead</option>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </Field>
              </div>
            </Section>

            {/* ── Endereço ── */}
            <Section title="Endereço">
              <div className="grid md:grid-cols-2 gap-x-10 gap-y-5">
                <Field label="CEP">
                  <div className="relative">
                    <input className={inp} value={form.cep} placeholder="00000-000"
                      onChange={e => set("cep", maskCEP(e.target.value))}
                      onBlur={handleCEPBlur} />
                    {cepLoading && (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
                    )}
                  </div>
                </Field>
                <Field label="Logradouro">
                  <input className={inp} value={form.logradouro}
                    placeholder="Rua, Avenida..."
                    onChange={e => set("logradouro", e.target.value)} />
                </Field>
                <Field label="Número">
                  <input className={inp} value={form.numero} placeholder="Ex: 123"
                    onChange={e => set("numero", e.target.value)} />
                </Field>
                <Field label="Complemento">
                  <input className={inp} value={form.complemento}
                    placeholder="Apto, Bloco..."
                    onChange={e => set("complemento", e.target.value)} />
                </Field>
                <Field label="Bairro">
                  <input className={inp} value={form.bairro}
                    onChange={e => set("bairro", e.target.value)} />
                </Field>
                <Field label="Cidade">
                  <input className={inp} value={form.cidade}
                    onChange={e => set("cidade", e.target.value)} />
                </Field>
                <Field label="Estado (UF)">
                  <input className={inp} value={form.uf} placeholder="UF" maxLength={2}
                    onChange={e => set("uf", e.target.value.toUpperCase())} />
                </Field>
              </div>
            </Section>

            {/* ── Responsável ── */}
            <Section title="Responsável">
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Pessoa responsável pelo cliente para fins financeiros e contratuais. Todas as notificações de contratos e cobranças serão encaminhadas ao responsável.
              </p>
              <label className="flex items-center gap-2.5 cursor-pointer mb-5">
                <div
                  onClick={() => set("tem_responsavel", !form.tem_responsavel)}
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                    form.tem_responsavel ? "border-primary bg-primary" : "border-gray-300"
                  }`}
                >
                  {form.tem_responsavel && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <span className="text-sm text-gray-700">Este aluno possui um responsável</span>
              </label>

              {form.tem_responsavel && (
                <div className="grid md:grid-cols-2 gap-x-10 gap-y-5 pl-6 border-l-2 border-primary/20">
                  <div className="md:col-span-2">
                    <Field label="Nome do Responsável" required>
                      <input className={inp} value={form.responsavel_nome}
                        onChange={e => set("responsavel_nome", e.target.value)} required />
                    </Field>
                  </div>
                  <Field label="Telefone do Responsável">
                    <input className={inp} value={form.responsavel_telefone}
                      placeholder="(00) 00000-0000"
                      onChange={e => set("responsavel_telefone", maskPhone(e.target.value))} />
                  </Field>
                  <Field label="E-mail do Responsável">
                    <input type="email" className={inp} value={form.responsavel_email}
                      onChange={e => set("responsavel_email", e.target.value)} />
                  </Field>
                </div>
              )}
            </Section>

            {/* ── Mais Contatos ── */}
            <Section title="Mais Contatos">
              <div className="space-y-3">
                {extras.map((extra, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <select
                      className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white min-w-[130px]"
                      value={extra.type}
                      onChange={e => setExtra(i, "type", e.target.value)}
                    >
                      {SOCIAL_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <input
                      className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder={SOCIAL_PLACEHOLDER[extra.type]}
                      value={extra.value}
                      onChange={e => setExtra(i, "value", e.target.value)}
                    />
                    {extras.length > 1 && (
                      <button type="button" onClick={() => removeExtra(i)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addExtra}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </button>
              </div>
            </Section>

            {/* ── Notificações ── */}
            <Section title="Notificações">
              <div className="flex items-start justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-900">WhatsApp</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Ao desmarcar, o cliente não irá mais receber notificações pelo WhatsApp.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => set("whatsapp_notificacoes", !form.whatsapp_notificacoes)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    form.whatsapp_notificacoes ? "bg-primary" : "bg-gray-300"
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    form.whatsapp_notificacoes ? "left-6" : "left-1"
                  }`} />
                </button>
              </div>
            </Section>

            {/* ── Observações ── */}
            <Section title="Observações">
              <textarea
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                rows={4}
                placeholder="Informações adicionais sobre o aluno/lead..."
                value={form.observacoes}
                onChange={e => set("observacoes", e.target.value)}
              />
            </Section>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 mt-6">
            <Link
              to="/app/clientes"
              className="px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-8 py-2.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-lg shadow-primary/20"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : "Cadastrar"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
