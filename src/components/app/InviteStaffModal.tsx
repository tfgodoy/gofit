import { useState } from "react";
import { X, Users, Copy, Check, MessageCircle, Loader2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { StaffRole } from "@/integrations/supabase/types";

interface Props {
  onClose: () => void;
}

const ROLES: { value: StaffRole; label: string }[] = [
  { value: "teacher",         label: "Professor" },
  { value: "receptionist",    label: "Recepcionista" },
  { value: "sales",           label: "Vendas" },
  { value: "nutritionist",    label: "Nutricionista" },
  { value: "physiotherapist", label: "Fisioterapeuta" },
  { value: "evaluator",       label: "Avaliador" },
];

const INP = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white";
const SEL = INP + " appearance-none cursor-pointer";

export default function InviteStaffModal({ onClose }: Props) {
  const { user } = useAuth();

  const [step, setStep]           = useState<"form" | "link">("form");
  const [name, setName]           = useState("");
  const [role, setRole]           = useState<StaffRole | "">("");
  const [email, setEmail]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied]       = useState(false);
  const [error, setError]         = useState("");

  async function handleGenerate() {
    setError("");
    if (!name.trim()) { setError("Informe o nome do convidado."); return; }
    if (!role)        { setError("Selecione o cargo."); return; }

    setLoading(true);
    const { data, error: dbError } = await supabase
      .from("invites")
      .insert([{
        contractor_id: user!.contractorId!,
        invited_name:  name.trim(),
        role:          role,
        email:         email.trim() || null,
      }])
      .select("id")
      .single();

    if (dbError || !data) {
      setError("Erro ao gerar convite. Tente novamente.");
      setLoading(false);
      return;
    }

    setInviteLink(`${window.location.origin}/convite/${data.id}`);
    setStep("link");
    setLoading(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWhatsApp() {
    const empresa = user?.contractorName ?? "nossa academia";
    const roleLabel = ROLES.find(r => r.value === role)?.label ?? "profissional";
    const msg = encodeURIComponent(
`Olá, ${name.split(" ")[0]}!

Você foi convidado(a) para integrar a equipe de *${empresa}* como *${roleLabel}*.

Acesse o link abaixo para completar seu cadastro:
${inviteLink}

Qualquer dúvida, entre em contato conosco.
Equipe ${empresa}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Convidar membro</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {step === "form"
                  ? "Gere um link de convite para o profissional."
                  : "Compartilhe o link com o profissional."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">

          {step === "form" ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Nome do convidado *
                </label>
                <input
                  className={INP}
                  placeholder="Nome completo"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Cargo *
                </label>
                <div className="relative">
                  <select
                    className={SEL}
                    value={role}
                    onChange={e => setRole(e.target.value as StaffRole)}
                  >
                    <option value="">Selecionar cargo</option>
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  E-mail (opcional)
                </label>
                <input
                  type="email"
                  className={INP}
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                    : "GERAR LINK"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Link gerado para <strong>{name}</strong>:
              </p>

              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-xs text-gray-600 flex-1 truncate">{inviteLink}</span>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
                    copied
                      ? "bg-green-100 text-green-700"
                      : "bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                >
                  {copied
                    ? <><Check className="w-3.5 h-3.5" /> Copiado!</>
                    : <><Copy className="w-3.5 h-3.5" /> COPIAR</>}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleWhatsApp}
                  className="flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </button>
                <button
                  onClick={onClose}
                  className="py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
