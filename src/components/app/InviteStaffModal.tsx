import { useState } from "react";
import { X, Send, Loader2, ChevronDown } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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

const INP = [
  "w-full bg-transparent",
  "border-0 border-b border-gray-300",
  "py-2 px-0",
  "text-sm text-gray-900 placeholder:text-gray-400",
  "outline-none",
  "focus:border-b-2 focus:border-primary",
  "transition-colors",
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

export default function InviteStaffModal({ onClose }: Props) {
  const { user } = useAuth();

  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");
  const [role,  setRole]  = useState<StaffRole | "">("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; role?: string }>({});

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const errs: typeof errors = {};
      if (!name.trim())  errs.name  = "Informe o nome do convidado.";
      if (!email.trim()) errs.email = "Informe o e-mail.";
      if (!role)         errs.role  = "Selecione o perfil de acesso.";
      if (Object.keys(errs).length > 0) { setErrors(errs); throw new Error("validation"); }

      const { error } = await supabase
        .from("invites")
        .insert([{
          contractor_id: user!.contractorId!,
          invited_name:  name.trim(),
          email:         email.trim(),
          role:          role,
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Convite enviado para ${email}.`);
      onClose();
    },
    onError: (err) => {
      if ((err as Error).message !== "validation") {
        toast.error("Erro ao enviar convite. Tente novamente.");
      }
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 rounded-full p-1.5">
              <Send className="w-4 h-4 text-primary" />
            </span>
            <h2 className="font-bold text-gray-900">Convidar membro da equipe</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className={LBL}>Nome <span className="text-primary ml-0.5">*</span></label>
            <input
              className={INP}
              placeholder="Nome completo do convidado"
              value={name}
              onChange={e => { setName(e.target.value); setErrors(v => ({ ...v, name: undefined })); }}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className={LBL}>E-mail <span className="text-primary ml-0.5">*</span></label>
            <input
              type="email"
              className={INP}
              placeholder="email@exemplo.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setErrors(v => ({ ...v, email: undefined })); }}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className={LBL}>Perfil de acesso <span className="text-primary ml-0.5">*</span></label>
            <div className="relative">
              <select
                className={SEL}
                value={role}
                onChange={e => { setRole(e.target.value as StaffRole); setErrors(v => ({ ...v, role: undefined })); }}
              >
                <option value="">Selecionar cargo</option>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="text-primary font-semibold text-sm hover:underline px-2"
          >
            CANCELAR
          </button>
          <button
            onClick={() => inviteMutation.mutate()}
            disabled={inviteMutation.isPending}
            className="bg-primary text-white font-semibold px-4 py-2 rounded-md text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {inviteMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
              : "CONVIDAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
