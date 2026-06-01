import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Loader2, ChevronDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Props {
  staffId: string;
  contractorId: string;
}

interface SalarioRecord {
  id: string;
  data_vigencia: string;
  valor: number;
  motivo: "admissao" | "reajuste" | "promocao" | "correcao";
  observacao: string | null;
  created_at: string;
}

interface SalarioForm {
  data_vigencia: string;
  valor: string;
  motivo: string;
  observacao: string;
}

const MOTIVOS = [
  { value: "admissao", label: "Admissão" },
  { value: "reajuste", label: "Reajuste" },
  { value: "promocao", label: "Promoção" },
  { value: "correcao", label: "Correção" },
];

const MOTIVO_BADGE: Record<string, string> = {
  admissao: "bg-blue-100 text-blue-700",
  reajuste: "bg-green-100 text-green-700",
  promocao: "bg-purple-100 text-purple-700",
  correcao: "bg-orange-100 text-orange-700",
};

const MOTIVO_LABEL: Record<string, string> = {
  admissao: "Admissão",
  reajuste: "Reajuste",
  promocao: "Promoção",
  correcao: "Correção",
};

const EMPTY: SalarioForm = {
  data_vigencia: "",
  valor: "",
  motivo: "reajuste",
  observacao: "",
};

const INP = [
  "w-full bg-transparent border-0 border-b border-gray-300",
  "py-2 px-0 text-sm text-gray-900 placeholder:text-gray-400",
  "outline-none focus:border-b-2 focus:border-primary transition-colors",
].join(" ");

const SEL = [
  "w-full bg-transparent border-0 border-b border-gray-300",
  "py-2 pl-0 pr-6 text-sm text-gray-900",
  "outline-none appearance-none cursor-pointer",
  "focus:border-b-2 focus:border-primary transition-colors",
].join(" ");

const LBL = "block text-xs text-gray-500 mb-0.5";

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function maskCurrency(v: string) {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "";
  const n = parseInt(digits, 10) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCurrency(v: string): number | null {
  const clean = v.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) || n <= 0 ? null : n;
}

export default function StaffSalarioTab({ staffId, contractorId }: Props) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SalarioForm>(EMPTY);

  function set<K extends keyof SalarioForm>(k: K, v: SalarioForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  const { data: salarios = [], isLoading } = useQuery({
    queryKey: ["staff-salarios", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_salarios")
        .select("*")
        .eq("staff_id", staffId)
        .order("data_vigencia", { ascending: false });
      if (error) throw error;
      return data as SalarioRecord[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.data_vigencia || !form.valor || !form.motivo)
        throw new Error("required");
      const valor = parseCurrency(form.valor);
      if (!valor) throw new Error("invalid");
      const { error } = await supabase.from("staff_salarios").insert([{
        staff_id: staffId,
        contractor_id: contractorId,
        data_vigencia: form.data_vigencia,
        valor,
        motivo: form.motivo,
        observacao: form.observacao.trim() || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Salário registrado.");
      qc.invalidateQueries({ queryKey: ["staff-salarios", staffId] });
      setForm(EMPTY);
      setShowForm(false);
    },
    onError: (err) => {
      const msg = (err as Error).message;
      if (msg === "required") toast.error("Preencha data, valor e motivo.");
      else if (msg === "invalid") toast.error("Valor inválido.");
      else toast.error("Erro ao registrar salário.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_salarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido.");
      qc.invalidateQueries({ queryKey: ["staff-salarios", staffId] });
    },
    onError: () => toast.error("Erro ao remover registro."),
  });

  const salarioAtual = salarios[0];

  return (
    <div className="space-y-4">
      {/* Salário atual */}
      {salarioAtual && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Salário atual</p>
            <p className="text-lg font-bold text-gray-900">{fmtBRL(salarioAtual.valor)}</p>
            <p className="text-xs text-gray-400">
              Vigência: {fmtDate(salarioAtual.data_vigencia)} ·{" "}
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${MOTIVO_BADGE[salarioAtual.motivo]}`}>
                {MOTIVO_LABEL[salarioAtual.motivo]}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Botão adicionar */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Histórico salarial</h4>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-primary font-semibold text-xs hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> REGISTRAR AJUSTE
          </button>
        )}
      </div>

      {/* Formulário inline */}
      {showForm && (
        <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-4">
          <p className="text-sm font-semibold text-gray-700">Novo registro salarial</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LBL}>Data de vigência *</label>
              <input type="date" className={INP} value={form.data_vigencia} onChange={e => set("data_vigencia", e.target.value)} />
            </div>
            <div>
              <label className={LBL}>Valor (R$) *</label>
              <input
                className={INP}
                placeholder="0,00"
                value={form.valor}
                onChange={e => set("valor", maskCurrency(e.target.value))}
              />
            </div>
          </div>
          <div>
            <label className={LBL}>Motivo *</label>
            <div className="relative">
              <select className={SEL} value={form.motivo} onChange={e => set("motivo", e.target.value)}>
                {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={LBL}>Observação</label>
            <input className={INP} placeholder="Opcional" value={form.observacao} onChange={e => set("observacao", e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY); }}
              className="text-gray-500 font-semibold text-sm hover:underline px-2"
            >
              CANCELAR
            </button>
            <button
              type="button"
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending}
              className="bg-primary text-white font-semibold px-4 py-1.5 rounded text-sm hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2"
            >
              {addMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              SALVAR
            </button>
          </div>
        </div>
      )}

      {/* Tabela de histórico */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      ) : salarios.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          Nenhum registro salarial encontrado.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
          {salarios.map((s, idx) => (
            <div key={s.id} className={`flex items-center justify-between px-4 py-3 ${idx === 0 ? "bg-gray-50" : "bg-white"}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{fmtBRL(s.valor)}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${MOTIVO_BADGE[s.motivo]}`}>
                    {MOTIVO_LABEL[s.motivo]}
                  </span>
                  {idx === 0 && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">atual</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Vigência: {fmtDate(s.data_vigencia)}
                  {s.observacao ? ` · ${s.observacao}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { if (confirm("Remover este registro?")) deleteMutation.mutate(s.id); }}
                className="text-gray-300 hover:text-red-500 transition-colors ml-3 flex-shrink-0"
                title="Remover"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
