import { useState } from "react";
import { X, Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  staffId: string;
  onClose: () => void;
}

const INP = [
  "w-full bg-transparent",
  "border-0 border-b border-gray-300",
  "py-2 px-0 pr-8",
  "text-sm text-gray-900 placeholder:text-gray-400",
  "outline-none",
  "focus:border-b-2 focus:border-primary",
  "transition-colors",
].join(" ");

const LBL = "block text-xs text-gray-500 mb-0.5";

export default function ChangePasswordModal({ staffId, onClose }: Props) {
  const [newPwd,     setNewPwd]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showNew,    setShowNew]    = useState(false);
  const [showConf,   setShowConf]   = useState(false);
  const [error,      setError]      = useState("");
  const [saving,     setSaving]     = useState(false);

  async function handleSave() {
    setError("");
    if (!newPwd.trim())        { setError("Informe a nova senha."); return; }
    if (newPwd.length < 6)     { setError("Mínimo 6 caracteres."); return; }
    if (newPwd !== confirmPwd) { setError("As senhas não conferem."); return; }

    setSaving(true);
    const { error: err } = await supabase
      .from("staff")
      .update({ password_hash: btoa(newPwd) })
      .eq("id", staffId);

    if (err) {
      setError("Erro ao alterar senha. Tente novamente.");
      setSaving(false);
      return;
    }

    toast.success("Senha alterada com sucesso.");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 rounded-full p-1.5">
              <KeyRound className="w-4 h-4 text-primary" />
            </span>
            <h3 className="font-bold text-gray-900">Alterar senha</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className={LBL}>Nova senha</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                className={INP}
                placeholder="Nova senha"
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className={LBL}>Confirmar nova senha</label>
            <div className="relative">
              <input
                type={showConf ? "text" : "password"}
                className={INP}
                placeholder="Confirmar nova senha"
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConf(v => !v)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 mt-1">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="text-primary font-semibold text-sm hover:underline px-2"
          >
            CANCELAR
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-white font-semibold px-4 py-2 rounded-md text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
              : "ALTERAR SENHA"}
          </button>
        </div>
      </div>
    </div>
  );
}
