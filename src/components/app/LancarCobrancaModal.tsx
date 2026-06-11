import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { useState, useEffect, useRef } from "react";
import { X, Search, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const INP = "w-full bg-transparent border-0 border-b border-gray-300 py-2 px-0 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-b-2 focus:border-primary transition-colors";
const SEL = "w-full bg-transparent border-0 border-b border-gray-300 py-2 px-0 pr-6 text-sm text-gray-900 outline-none appearance-none focus:border-b-2 focus:border-primary transition-colors cursor-pointer";

const TIPOS = [
  { value: "mensalidade", label: "Mensalidade" },
  { value: "matricula",   label: "Matrícula" },
  { value: "avulso",      label: "Avulso" },
  { value: "multa",       label: "Multa" },
  { value: "aula_avulsa", label: "Aula avulsa" },
  { value: "outros",      label: "Outros" },
];

const FORMAS = [
  { value: "dinheiro",       label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao_debito",  label: "Cartão de débito" },
  { value: "pix",            label: "PIX" },
  { value: "boleto",         label: "Boleto" },
  { value: "transferencia",  label: "Transferência" },
];

interface Student { id: string; nome_completo: string }

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function LancarCobrancaModal({ onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [students, setStudents]             = useState<Student[]>([]);
  const [studentSearch, setStudentSearch]   = useState("");
  const [studentDropOpen, setStudentDropOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const studentRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    descricao:       "",
    valor:           "",
    vencimento:      new Date().toISOString().split("T")[0],
    tipo:            "mensalidade",
    forma_pagamento: "",
    parcelado:       false,
    total_parcelas:  "1",
    observacoes:     "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.contractorId) return;
    supabase.from("students")
      .select("id, nome_completo")
      .eq("contractor_id", user.contractorId)
      .order("nome_completo")
      .then(({ data }) => setStudents((data ?? []) as Student[]));
  }, [user]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (studentRef.current && !studentRef.current.contains(e.target as Node))
        setStudentDropOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredStudents = studentSearch
    ? students.filter(s => s.nome_completo.toLowerCase().includes(studentSearch.toLowerCase()))
    : students;

  function set(k: keyof typeof form, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    if (!user?.contractorId) return;
    if (!form.descricao.trim()) { toast.error("Informe a descrição."); return; }
    const valor = parseFloat(form.valor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) { toast.error("Informe um valor válido."); return; }
    if (!form.vencimento) { toast.error("Informe o vencimento."); return; }

    setSaving(true);
    const parcelas = form.parcelado ? parseInt(form.total_parcelas) || 1 : 1;

    const rows = Array.from({ length: parcelas }, (_, i) => {
      const d = new Date(form.vencimento + "T12:00:00");
      d.setMonth(d.getMonth() + i);
      return {
        contractor_id:   user.contractorId!,
        student_id:      selectedStudent?.id ?? null,
        student_nome:    selectedStudent?.nome_completo ?? null,
        descricao:       parcelas > 1 ? `${form.descricao} (${i + 1}/${parcelas})` : form.descricao,
        valor,
        vencimento:      d.toISOString().split("T")[0],
        tipo:            form.tipo as "mensalidade" | "matricula" | "avulso" | "multa" | "aula_avulsa" | "outros",
        forma_pagamento: form.forma_pagamento || null,
        parcela_numero:  parcelas > 1 ? i + 1 : null,
        total_parcelas:  parcelas > 1 ? parcelas : null,
        observacoes:     form.observacoes || null,
        status:          "pendente" as const,
      };
    });

    const { error } = await supabase.from("receivables").insert(rows);
    setSaving(false);
    if (error) { toast.error("Erro ao lançar cobrança."); return; }
    toast.success(parcelas > 1 ? `${parcelas} cobranças lançadas.` : "Cobrança lançada com sucesso.");
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Lançar cobrança</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Aluno */}
          <div ref={studentRef} className="relative">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Aluno</label>
            <div className="flex items-center gap-2 border-b border-gray-300 py-2">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Buscar aluno..."
                value={selectedStudent ? selectedStudent.nome_completo : studentSearch}
                onChange={e => { setStudentSearch(e.target.value); setSelectedStudent(null); setStudentDropOpen(true); }}
                onClick={() => setStudentDropOpen(true)}
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
              />
              {selectedStudent && (
                <button
                  onClick={() => { setSelectedStudent(null); setStudentSearch(""); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {studentDropOpen && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto mt-1">
                {filteredStudents.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-400">Nenhum aluno encontrado</p>
                ) : filteredStudents.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedStudent(s); setStudentSearch(""); setStudentDropOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                  >
                    {s.nome_completo}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição *</label>
            <input className={INP} placeholder="Ex: Mensalidade Janeiro" value={form.descricao} onChange={e => set("descricao", e.target.value)} />
          </div>

          {/* Valor + Vencimento */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Valor (R$) *</label>
              <CurrencyInput className={INP} placeholder="0,00" value={form.valor} onChange={v => set("valor", v)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Vencimento *</label>
              <input type="date" className={INP} value={form.vencimento} onChange={e => set("vencimento", e.target.value)} />
            </div>
          </div>

          {/* Tipo + Forma */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
              <select className={SEL} value={form.tipo} onChange={e => set("tipo", e.target.value)}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <ChevronDown className="absolute right-0 bottom-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Forma de pagamento</label>
              <select className={SEL} value={form.forma_pagamento} onChange={e => set("forma_pagamento", e.target.value)}>
                <option value="">Qualquer</option>
                {FORMAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <ChevronDown className="absolute right-0 bottom-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Parcelado */}
          <div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-700">Parcelado</span>
              <button
                onClick={() => set("parcelado", !form.parcelado)}
                className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative ${form.parcelado ? "bg-primary" : "bg-gray-200"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.parcelado ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            {form.parcelado && (
              <div className="mt-3">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Número de parcelas</label>
                <input type="number" min="2" max="60" className={INP} value={form.total_parcelas} onChange={e => set("total_parcelas", e.target.value)} />
              </div>
            )}
          </div>

          {/* Observações */}
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
            {saving ? "Salvando..." : "LANÇAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
