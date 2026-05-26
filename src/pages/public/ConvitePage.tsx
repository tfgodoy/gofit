import { useState, useEffect, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2, ChevronRight } from "lucide-react";

interface Invite {
  id: string;
  contractor_id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  status: "pending" | "used" | "expired";
  expires_at: string;
}

interface Contractor {
  nome_fantasia: string;
  razao_social: string;
}

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

type Step = "loading" | "invalid" | "expired" | "used" | "form" | "success";

export default function ConvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("loading");
  const [invite, setInvite] = useState<Invite | null>(null);
  const [contractor, setContractor] = useState<Contractor | null>(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [dataNasc, setDataNasc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setStep("invalid"); return; }

    async function loadInvite() {
      const { data: inv, error: invErr } = await supabase
        .from("invites")
        .select("id, contractor_id, nome, email, telefone, status, expires_at")
        .eq("id", token!)
        .maybeSingle();

      if (invErr || !inv) { setStep("invalid"); return; }

      if (inv.status === "used")    { setStep("used");    return; }
      if (inv.status === "expired") { setStep("expired"); return; }
      if (new Date(inv.expires_at) < new Date()) { setStep("expired"); return; }

      const { data: ctData } = await supabase
        .from("contractors")
        .select("nome_fantasia, razao_social")
        .eq("id", inv.contractor_id)
        .maybeSingle();

      setInvite(inv as Invite);
      setContractor(ctData as Contractor | null);
      setNome(inv.nome ?? "");
      setEmail(inv.email ?? "");
      setTelefone(inv.telefone ? maskPhone(inv.telefone) : "");
      setStep("form");
    }

    loadInvite();
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!invite) return;
    if (!nome.trim()) { setError("Informe seu nome completo."); return; }
    if (!email.trim() && !telefone.trim()) { setError("Informe ao menos e-mail ou telefone."); return; }
    setError("");
    setSubmitting(true);

    const { data: student, error: stErr } = await supabase
      .from("students")
      .insert([{
        contractor_id:  invite.contractor_id,
        nome_completo:  nome.trim(),
        email:          email.trim() || null,
        telefone:       telefone.replace(/\D/g, "") || null,
        cpf:            cpf.replace(/\D/g, "") || null,
        data_nascimento: dataNasc || null,
        status:         "lead" as const,
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

    setStep("success");
    setSubmitting(false);
  }

  const companyName = contractor?.nome_fantasia || contractor?.razao_social || "sua academia";

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (step === "invalid") {
    return <InfoScreen icon="❌" title="Link inválido" body="Este link de convite não existe ou foi digitado incorretamente." />;
  }
  if (step === "expired") {
    return <InfoScreen icon="⏰" title="Convite expirado" body="Este link de convite expirou. Peça um novo link para a academia." />;
  }
  if (step === "used") {
    return <InfoScreen icon="✅" title="Cadastro já realizado" body="Este link já foi utilizado. Seu cadastro está completo!" />;
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900 mb-2">Cadastro enviado!</h1>
          <p className="text-sm text-gray-500 mb-6">
            Obrigado, <strong>{nome.split(" ")[0]}</strong>! Seu cadastro foi recebido por <strong>{companyName}</strong>. Em breve entraremos em contato.
          </p>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Voltar ao início <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-primary px-8 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-1">Convite de cadastro</p>
          <h1 className="text-xl font-extrabold">{companyName}</h1>
          {invite?.nome && (
            <p className="text-sm text-white/80 mt-1">Olá, {invite.nome.split(" ")[0]}! Preencha seus dados abaixo.</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-primary mb-1.5">Nome completo *</label>
            <input
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Seu nome completo"
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-primary mb-1.5">CPF</label>
              <input
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={e => setCpf(maskCPF(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-primary mb-1.5">Nascimento</label>
              <input
                type="date"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={dataNasc}
                onChange={e => setDataNasc(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-primary mb-1.5">Telefone / WhatsApp</label>
            <input
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="(00) 00000-0000"
              value={telefone}
              onChange={e => setTelefone(maskPhone(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-primary mb-1.5">E-mail</label>
            <input
              type="email"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 mt-2"
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
              : "Concluir cadastro"}
          </button>

          <p className="text-xs text-center text-gray-400">
            Seus dados são protegidos e serão utilizados apenas por {companyName}.
          </p>
        </form>
      </div>
    </div>
  );
}

function InfoScreen({ icon, title, body }: { icon: string; title: string; body: string }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
        <p className="text-5xl mb-4">{icon}</p>
        <h1 className="text-xl font-extrabold text-gray-900 mb-2">{title}</h1>
        <p className="text-sm text-gray-500 mb-6">{body}</p>
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          Ir para o início <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
