import { useState, useEffect } from "react";
import { X, Link2, Copy, Check, MessageCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onClose: () => void;
}

export default function InviteModal({ onClose }: Props) {
  const { user } = useAuth();
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.contractorId) return;
    (async () => {
      const { data, error: dbError } = await supabase
        .from("invites")
        .insert([{ contractor_id: user.contractorId! }])
        .select("id")
        .single();

      if (dbError || !data) {
        setError("Erro ao gerar convite. Tente novamente.");
      } else {
        setInviteLink(`${window.location.origin}/convite/${data.id}`);
      }
      setLoading(false);
    })();
  }, [user]);

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWhatsApp() {
    const msg = encodeURIComponent(
      `Você recebeu um convite especial! 🎉\n\nAcesse o link abaixo para fazer seu cadastro:\n${inviteLink}\n\nO link expira em 7 dias.`
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
              <Link2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Link gerado!</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Copie e compartilhe para que o cliente faça o autocadastro.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-gray-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-primary" /> Gerando link...
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
              {error}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-xs text-gray-600 flex-1 truncate">{inviteLink}</span>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
                    copied ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                >
                  {copied
                    ? <><Check className="w-3.5 h-3.5" /> Copiado!</>
                    : <><Copy className="w-3.5 h-3.5" /> COPIAR LINK</>}
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
                  className="flex items-center justify-center py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
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
