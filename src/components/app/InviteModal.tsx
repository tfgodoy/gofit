import { useState, type FormEvent } from "react";
import { X, Link2, Copy, Check, MessageCircle, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onClose: () => void;
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

export default function InviteModal({ onClose }: Props) {
  const { user } = useAuth();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    if (!user?.contractorId) return;
    if (!email && !telefone) {
      setError("Informe ao menos o e-mail ou o telefone do lead.");
      return;
    }
    setError("");
    setLoading(true);

    const { data, error: dbError } = await supabase
      .from("invites")
      .insert([{
        contractor_id: user.contractorId,
        nome:     nome || null,
        email:    email || null,
        telefone: telefone.replace(/\D/g, "") || null,
      }])
      .select("id")
      .single();

    if (dbError || !data) {
      setError("Erro ao gerar convite. Tente novamente.");
      setLoading(false);
      return;
    }

    const baseUrl = window.location.origin;
    setInviteLink(`${baseUrl}/convite/${data.id}`);
    setLoading(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWhatsApp() {
    const phone = telefone.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá${nome ? ` ${nome}` : ""}! 👋\n\nVocê foi convidado(a) para se cadastrar em nosso sistema.\n\nClique no link abaixo para preencher seus dados:\n${inviteLink}\n\nO link expira em 7 dias.`
    );
    const target = phone ? `https://wa.me/55${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(target, "_blank");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Enviar convite</h2>
            <p className="text-xs text-gray-400 mt-0.5">Gere um link para o lead se cadastrar</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!inviteLink ? (
          <form onSubmit={handleGenerate} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-primary mb-1.5">Nome do lead</label>
              <input
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Ex: Ana Carolina"
                value={nome}
                onChange={e => setNome(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-primary mb-1.5">
                Telefone / WhatsApp
              </label>
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
                placeholder="exemplo@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <p className="text-xs text-gray-400">
              O link ficará ativo por <span className="font-semibold text-gray-600">7 dias</span>. Pode ser enviado por WhatsApp, e-mail ou qualquer canal.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                  : <><Send className="w-4 h-4" /> Gerar convite</>}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-5">
            {/* Sucesso */}
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-800">Convite gerado!</p>
                <p className="text-xs text-green-600">Válido por 7 dias. Compartilhe o link abaixo.</p>
              </div>
            </div>

            {/* Link */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Link do convite</label>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-600 flex-1 truncate">{inviteLink}</span>
                <button onClick={handleCopy}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
                    copied ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary hover:bg-primary/20"
                  }`}>
                  {copied ? <><Check className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                </button>
              </div>
            </div>

            {/* Ações */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleWhatsApp}
                className="flex items-center justify-center gap-2 py-3 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600 transition-colors">
                <MessageCircle className="w-4 h-4" />
                Enviar via WhatsApp
              </button>
              <button onClick={onClose}
                className="flex items-center justify-center gap-2 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
