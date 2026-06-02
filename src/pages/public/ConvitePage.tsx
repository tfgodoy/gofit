import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, Users, Check, ChevronRight } from "lucide-react";

// ── Types ────────────────────────────────────────────────────
type PageStep = "loading" | "invalid" | "expired" | "used"
              | "tipo" | "form_principal" | "form_dependente" | "success";
type TipoCadastro = "cliente" | "responsavel";

interface InviteData {
  id: string;
  contractor_id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  status: "pending" | "used" | "expired";
  expires_at: string;
}
interface ContractorData {
  nome_fantasia: string;
  razao_social: string;
  fone: string | null;
}
interface FormState {
  nome: string; email: string; data_nascimento: string; sexo: string;
  telefone: string; cpf: string; cep: string; logradouro: string;
  numero: string; bairro: string; cidade: string; uf: string; objetivo: string;
}

const EMPTY_FORM: FormState = {
  nome: "", email: "", data_nascimento: "", sexo: "", telefone: "", cpf: "",
  cep: "", logradouro: "", numero: "", bairro: "", cidade: "", uf: "", objetivo: "",
};

const OBJETIVOS = [
  "Emagrecimento",
  "Hipertrofia / Ganho de massa",
  "Condicionamento físico",
  "Saúde e bem-estar",
  "Reabilitação",
  "Performance esportiva",
  "Outro",
];

// ── Helpers ──────────────────────────────────────────────────
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
function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}
function toSexo(v: string): "masculino" | "feminino" | "outro" | null {
  if (v === "masculino" || v === "feminino" || v === "outro") return v;
  return null;
}

const INP = "w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-gray-300 bg-white";

// ── Left panel ───────────────────────────────────────────────
function LeftPanel({ contractor, companyName }: { contractor: ContractorData | null; companyName: string }) {
  return (
    <div className="hidden lg:flex lg:w-2/5 bg-[#1a1a2e] text-white flex-col relative overflow-hidden">
      {/* Decorative concentric rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute w-[520px] h-[520px] rounded-full border border-white/5" />
        <div className="absolute w-96 h-96 rounded-full border border-white/8" />
        <div className="absolute w-64 h-64 rounded-full border border-white/10" />
        <div className="absolute w-40 h-40 rounded-full border border-white/12" />
      </div>

      <div className="relative z-10 flex flex-col h-full p-10">
        {/* Company info */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {getInitials(companyName)}
          </div>
          <div>
            <p className="font-bold text-base leading-tight">{companyName}</p>
            {contractor?.fone && (
              <p className="text-sm text-gray-400">{contractor.fone}</p>
            )}
          </div>
        </div>

        {/* Main message */}
        <div className="flex-1 flex flex-col justify-center">
          <h1 className="text-4xl font-black leading-[1.15] mb-6 uppercase">
            Temos um<br />convite especial<br />para você!
          </h1>
          <p className="text-gray-300 text-sm leading-relaxed">
            <strong className="text-white">{companyName}</strong> convidou você para conhecer{" "}
            <strong className="text-white">{companyName}</strong> e dar o primeiro passo para a sua melhor versão!
          </p>
          <p className="text-gray-400 text-sm mt-4 font-semibold">
            Preencha as informações ao lado.
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-600">
          FitCoreSys – Sistema para academias © 2026 – Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export default function ConvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<PageStep>("loading");
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [contractor, setContractor] = useState<ContractorData | null>(null);
  const [tipo, setTipo] = useState<TipoCadastro | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formDep, setFormDep] = useState({ nome: "", data_nascimento: "", sexo: "" });
  const [cepLoading, setCepLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load invite on mount
  useEffect(() => {
    if (!token) { setStep("invalid"); return; }
    (async () => {
      const { data: inv, error: invErr } = await supabase
        .from("invites")
        .select("id, contractor_id, nome, email, telefone, status, expires_at")
        .eq("id", token!)
        .maybeSingle();

      if (invErr || !inv) { setStep("invalid"); return; }
      if (inv.status === "used") { setStep("used"); return; }
      if (inv.status === "expired" || new Date(inv.expires_at) < new Date()) {
        setStep("expired"); return;
      }

      const { data: ct } = await supabase
        .from("contractors")
        .select("nome_fantasia, razao_social, fone")
        .eq("id", inv.contractor_id)
        .maybeSingle();

      setInvite(inv as InviteData);
      setContractor(ct as ContractorData | null);

      // Pre-fill with invite data if available
      setForm(f => ({
        ...f,
        nome: inv.nome ?? "",
        email: inv.email ?? "",
        telefone: inv.telefone ? maskPhone(inv.telefone) : "",
      }));

      setStep("tipo");
    })();
  }, [token]);

  // CEP auto-fill
  async function handleCEPBlur() {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
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

  // Submit final form
  async function handleSubmit() {
    if (!invite) return;
    const isResp = tipo === "responsavel";

    if (!form.nome.trim()) { setError("Informe seu nome."); return; }
    if (isResp && !formDep.nome.trim()) { setError("Informe o nome do dependente."); return; }
    setError("");
    setSubmitting(true);

    const studentNome = isResp ? formDep.nome.trim() : form.nome.trim();

    const { data: student, error: stErr } = await supabase
      .from("students")
      .insert([{
        contractor_id:       invite.contractor_id,
        nome_completo:       studentNome,
        email:               form.email.trim()              || null,
        telefone:            form.telefone.replace(/\D/g, "") || null,
        cpf:                 form.cpf.replace(/\D/g, "")    || null,
        data_nascimento:     isResp ? (formDep.data_nascimento || null) : (form.data_nascimento || null),
        sexo:                toSexo(isResp ? formDep.sexo : form.sexo),
        cep:                 form.cep.replace(/\D/g, "")    || null,
        logradouro:          form.logradouro                || null,
        numero:              form.numero                    || null,
        bairro:              form.bairro                    || null,
        cidade:              form.cidade                    || null,
        uf:                  form.uf                        || null,
        responsavel_nome:    isResp ? form.nome.trim()                        : null,
        responsavel_telefone:isResp ? (form.telefone.replace(/\D/g, "") || null) : null,
        responsavel_email:   isResp ? (form.email.trim() || null)             : null,
        status:              "lead" as const,
        objetivo:            form.objetivo || null,
        observacoes:         null,
      }])
      .select("id")
      .single();

    if (stErr || !student) {
      setError("Erro ao enviar cadastro. Tente novamente.");
      setSubmitting(false);
      return;
    }

    await supabase
      .from("invites")
      .update({ status: "used" as const, student_id: student.id })
      .eq("id", invite.id);

    await supabase.from("opportunities").insert({
      contractor_id: invite.contractor_id,
      student_id:    student.id,
      nome:          studentNome,
      email:         form.email.trim() || null,
      telefone:      form.telefone.replace(/\D/g, "") || null,
      origem:        "Convite (link)",
      etapa:         "Novo lead",
      data_entrada:  new Date().toISOString().split("T")[0],
    });

    setStep("success");
    setSubmitting(false);
  }

  const companyName = contractor?.nome_fantasia || contractor?.razao_social || "FitCoreSys";

  // ── Full-screen states (no split layout) ──
  if (step === "loading") {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (step === "invalid" || step === "expired" || step === "used") {
    const msgs = {
      invalid: { icon: "❌", title: "Link inválido",           body: "Este link de convite não existe ou é inválido." },
      expired: { icon: "⏰", title: "Convite expirado",        body: "Este link de convite expirou. Solicite um novo link." },
      used:    { icon: "✅", title: "Cadastro já realizado",   body: "Este link já foi utilizado com sucesso." },
    };
    const { icon, title, body } = msgs[step];
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
          <p className="text-5xl mb-4">{icon}</p>
          <h1 className="text-xl font-extrabold text-gray-900 mb-2">{title}</h1>
          <p className="text-sm text-gray-500 mb-6">{body}</p>
          <button onClick={() => navigate("/")} className="text-sm font-semibold text-primary hover:underline">
            Ir para o início <ChevronRight className="inline w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (step === "success") {
    const finalName = tipo === "responsavel" ? formDep.nome : form.nome;
    return (
      <div className="min-h-screen flex">
        <LeftPanel contractor={contractor} companyName={companyName} />
        <div className="flex-1 flex items-center justify-center bg-white p-8">
          <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-2">Cadastro enviado!</h2>
            <p className="text-sm text-gray-500 mb-6">
              Obrigado{finalName ? `, ${finalName.split(" ")[0]}` : ""}!{" "}
              Seus dados foram recebidos por <strong>{companyName}</strong>.{" "}
              Em breve entraremos em contato.
            </p>
            <button onClick={() => navigate("/")} className="text-sm font-semibold text-primary hover:underline">
              Voltar ao início <ChevronRight className="inline w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Split layout (tipo / form_principal / form_dependente) ──
  return (
    <div className="min-h-screen flex">
      <LeftPanel contractor={contractor} companyName={companyName} />

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto bg-white flex flex-col">

        {/* Mobile company header */}
        <div className="lg:hidden flex items-center gap-3 p-5 border-b border-gray-100 bg-[#1a1a2e] text-white">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
            {getInitials(companyName)}
          </div>
          <span className="font-bold">{companyName}</span>
        </div>

        <div className="flex-1 flex flex-col justify-center px-8 py-10 max-w-lg w-full mx-auto">

          {/* ── STEP: Tipo de cadastro ── */}
          {step === "tipo" && (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Tipo de cadastro</h2>
              <p className="text-sm text-gray-500 mb-6">
                Selecione como você deseja continuar com o cadastro:
              </p>

              <div className="space-y-3">
                {[
                  { value: "cliente"     as TipoCadastro, Icon: User,  title: "Serei o cliente",      desc: "Contratarei para mim mesmo." },
                  { value: "responsavel" as TipoCadastro, Icon: Users, title: "Serei o responsável",  desc: "Contratarei para dependente(s)." },
                ].map(({ value, Icon, title, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTipo(value)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-colors text-left ${
                      tipo === value
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">{title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      tipo === value ? "border-primary bg-primary" : "border-gray-300"
                    }`}>
                      {tipo === value && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => tipo && setStep("form_principal")}
                disabled={!tipo}
                className="w-full mt-8 py-3.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider"
              >
                AVANÇAR
              </button>
            </>
          )}

          {/* ── STEP: Dados pessoais (cliente ou responsável) ── */}
          {step === "form_principal" && (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Dados pessoais</h2>
              <p className="text-sm text-gray-500 mb-6">
                {tipo === "responsavel"
                  ? "Preencha os dados do responsável:"
                  : "Preencha suas informações abaixo:"}
              </p>

              <div className="space-y-3">
                <input
                  className={INP} placeholder="Nome *"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                />
                <input
                  type="email" className={INP} placeholder="Email *"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
                <input
                  type="date" className={INP + " text-gray-500"}
                  title="Data nascimento *"
                  value={form.data_nascimento}
                  onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))}
                />
                <select
                  className={INP + (form.sexo ? "" : " text-gray-300")}
                  value={form.sexo}
                  onChange={e => setForm(f => ({ ...f, sexo: e.target.value }))}
                >
                  <option value="">Sexo *</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                  <option value="outro">Outro</option>
                </select>
                <input
                  className={INP} placeholder="Telefone *"
                  value={form.telefone}
                  onChange={e => setForm(f => ({ ...f, telefone: maskPhone(e.target.value) }))}
                />
                <input
                  className={INP} placeholder="CPF *"
                  value={form.cpf}
                  onChange={e => setForm(f => ({ ...f, cpf: maskCPF(e.target.value) }))}
                />
                <div className="relative">
                  <input
                    className={INP} placeholder="CEP *"
                    value={form.cep}
                    onChange={e => setForm(f => ({ ...f, cep: maskCEP(e.target.value) }))}
                    onBlur={handleCEPBlur}
                  />
                  {cepLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                  )}
                </div>
                <input
                  className={INP} placeholder="Logradouro *"
                  value={form.logradouro}
                  onChange={e => setForm(f => ({ ...f, logradouro: e.target.value }))}
                />
                <input
                  className={INP} placeholder="Número *"
                  value={form.numero}
                  onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                />
                <input
                  className={INP} placeholder="Bairro *"
                  value={form.bairro}
                  onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))}
                />
                <input
                  className={INP} placeholder="Cidade *"
                  value={form.cidade}
                  onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))}
                />
                <select
                  className={INP + (form.objetivo ? "" : " text-gray-300")}
                  value={form.objetivo}
                  onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))}
                >
                  <option value="">Objetivo *</option>
                  {OBJETIVOS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                  {error}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setError(""); setStep("tipo"); }}
                  className="flex-1 py-3.5 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors uppercase tracking-wider"
                >
                  VOLTAR
                </button>

                {tipo === "responsavel" ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!form.nome.trim()) { setError("Informe seu nome."); return; }
                      setError("");
                      setStep("form_dependente");
                    }}
                    className="flex-1 py-3.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors uppercase tracking-wider"
                  >
                    AVANÇAR
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 py-3.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 uppercase tracking-wider"
                  >
                    {submitting
                      ? <Loader2 className="inline w-4 h-4 animate-spin" />
                      : "ENVIAR INFORMAÇÕES"}
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── STEP: Dados do dependente ── */}
          {step === "form_dependente" && (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Dados do dependente</h2>
              <p className="text-sm text-gray-500 mb-6">
                Preencha os dados de quem vai utilizar o serviço:
              </p>

              <div className="space-y-3">
                <input
                  className={INP} placeholder="Nome do dependente *"
                  value={formDep.nome}
                  onChange={e => setFormDep(f => ({ ...f, nome: e.target.value }))}
                />
                <input
                  type="date" className={INP + " text-gray-500"}
                  title="Data de nascimento *"
                  value={formDep.data_nascimento}
                  onChange={e => setFormDep(f => ({ ...f, data_nascimento: e.target.value }))}
                />
                <select
                  className={INP + (formDep.sexo ? "" : " text-gray-300")}
                  value={formDep.sexo}
                  onChange={e => setFormDep(f => ({ ...f, sexo: e.target.value }))}
                >
                  <option value="">Sexo *</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                  {error}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setError(""); setStep("form_principal"); }}
                  className="flex-1 py-3.5 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors uppercase tracking-wider"
                >
                  VOLTAR
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-3.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 uppercase tracking-wider"
                >
                  {submitting
                    ? <Loader2 className="inline w-4 h-4 animate-spin" />
                    : "ENVIAR INFORMAÇÕES"}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
