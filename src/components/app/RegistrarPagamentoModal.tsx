import { useState, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const INP = "w-full bg-transparent border-0 border-b border-gray-300 py-2 px-0 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-b-2 focus:border-primary transition-colors";
const SEL = "w-full bg-transparent border-0 border-b border-gray-300 py-2 px-0 pr-6 text-sm text-gray-900 outline-none appearance-none focus:border-b-2 focus:border-primary transition-colors cursor-pointer";

const FORMAS = [
  { value: "dinheiro",       label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao_debito",  label: "Cartão de débito" },
  { value: "pix",            label: "PIX" },
  { value: "boleto",         label: "Boleto" },
  { value: "transferencia",  label: "Transferência" },
];

export interface ReceivableForPayment {
  id:              string;
  descricao:       string;
  valor:           number;
  student_nome:    string | null;
  forma_pagamento: string | null;
}

interface Props {
  receivable: ReceivableForPayment;
  onClose:    () => void;
  onSaved:    () => void;
}

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function RegistrarPagamentoModal({ receivable, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [form, setForm] = useState({
    valor_pago:      receivable.valor.toFixed(2).replace(".", ","),
    desconto:        "0,00",
    juros:           "0,00",
    multa:           "0,00",
    forma_pagamento: receivable.forma_pagamento ?? "",
    pago_em:         new Date().toISOString().split("T")[0],
    observacoes:     "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.contractorId) return;
    supabase.from("cash_sessions")
      .select("id")
      .eq("contractor_id", user.contractorId)
      .eq("status", "aberto")
      .maybeSingle()
      .then(({ data }) => setOpenSessionId(data?.id ?? null));
  }, [user]);

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function parseNum(s: string) {
    return parseFloat(s.replace(",", ".")) || 0;
  }

  async function handleSave() {
    if (!user?.contractorId) return;
    const valorPago = parseNum(form.valor_pago);
    if (valorPago <= 0) { toast.error("Informe o valor pago."); return; }
    if (!form.forma_pagamento) { toast.error("Informe a forma de pagamento."); return; }

    setSaving(true);
    const { error } = await supabase
      .from("receivables")
      .update({
        status:          "pago",
        valor_pago:      valorPago,
        desconto:        parseNum(form.desconto),
        juros:           parseNum(form.juros),
        multa:           parseNum(form.multa),
        forma_pagamento: form.forma_pagamento,
        pago_em:         form.pago_em,
        cash_session_id: openSessionId,
        observacoes:     form.observacoes || null,
      })
      .eq("id", receivable.id);

    if (error) { setSaving(false); toast.error("Erro ao registrar pagamento."); return; }

    await supabase.from("transactions").insert({
      contractor_id:   user.contractorId,
      tipo:            "entrada",
      categoria:       "recebimento",
      descricao:       receivable.descricao,
      valor:           valorPago,
      data:            form.pago_em,
      forma_pagamento: form.forma_pagamento,
      receivable_id:   receivable.id,
      cash_session_id: openSessionId,
      student_nome:    receivable.student_nome,
      observacoes:     form.observacoes || null,
    });

    setSaving(false);
    toast.success("Pagamento registrado.");
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Registrar pagamento</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-gray-50 rounded-xl p-4 space-y-1">
            <p className="text-sm font-semibold text-gray-900">{receivable.descricao}</p>
            {receivable.student_nome && <p className="text-xs text-gray-500">{receivable.student_nome}</p>}
            <p className="text-base font-bold text-primary">{fmtMoeda(receivable.valor)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Valor pago (R$) *</label>
              <input className={INP} value={form.valor_pago} onChange={e => set("valor_pago", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Desconto (R$)</label>
              <input className={INP} value={form.desconto} onChange={e => set("desconto", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Juros (R$)</label>
              <input className={INP} value={form.juros} onChange={e => set("juros", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Multa (R$)</label>
              <input className={INP} value={form.multa} onChange={e => set("multa", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Forma de pagamento *</label>
              <select className={SEL} value={form.forma_pagamento} onChange={e => set("forma_pagamento", e.target.value)}>
                <option value="">Selecione</option>
                {FORMAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <ChevronDown className="absolute right-0 bottom-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Data do pagamento *</label>
              <input type="date" className={INP} value={form.pago_em} onChange={e => set("pago_em", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Observações</label>
            <input className={INP} placeholder="Opcional" value={form.observacoes} onChange={e => set("observacoes", e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-primary font-semibold text-sm hover:underline px-2">CANCELAR</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-white font-semibold text-sm px-5 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Salvando..." : "CONFIRMAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
