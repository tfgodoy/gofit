import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Loader2, ChevronDown, TrendingUp, Pencil } from "lucide-react";
import { toast } from "sonner";

export type HistoricoTable =
  | "staff_salarios"
  | "staff_passagens"
  | "staff_ajudas_custo"
  | "staff_bonificacoes";

interface Props {
  staffId: string;
  contractorId: string;
  table: HistoricoTable;
  titulo: string;
  tituloAtual: string;
}

interface Record {
  id: string;
  data_vigencia: string;
  valor: number;
  motivo: string;
  observacao: string | null;
  created_at: string;
}

interface Form {
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
  promocao: "bg-orange-100 text-orange-700",
  correcao: "bg-amber-100 text-amber-700",
};

const MOTIVO_LABEL: Record<string, string> = {
  admissao: "Admissão",
  reajuste: "Reajuste",
  promocao: "Promoção",
  correcao: "Correção",
};

const EMPTY: Form = { data_vigencia: "", valor: "", motivo: "reajuste", observacao: "" };

const INP = "w-full bg-transparent border-0 border-b border-gray-300 py-2 px-0 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-b-2 focus:border-primary transition-colors";
const SEL = "w-full bg-transparent border-0 border-b border-gray-300 py-2 pl-0 pr-6 text-sm text-gray-900 outline-none appearance-none cursor-pointer focus:border-b-2 focus:border-primary transition-colors";
const LBL = "block text-xs text-gray-500 mb-0.5";

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseCurrency(v: string): number | null {
  const clean = v.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) || n < 0 ? null : n;
}

function recordToForm(r: Record): Form {
  return {
    data_vigencia: r.data_vigencia,
    valor: r.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    motivo: r.motivo,
    observacao: r.observacao ?? "",
  };
}

interface FormPanelProps {
  title: string;
  form: Form;
  onChange: <K extends keyof Form>(k: K, v: Form[K]) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}

function FormPanel({ title, form, onChange, onSave, onCancel, isPending }: FormPanelProps) {
  return (
    <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-4">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LBL}>Data de vigência *</label>
          <input type="date" className={INP} value={form.data_vigencia}
            onChange={e => onChange("data_vigencia", e.target.value)} />
        </div>
        <div>
          <label className={LBL}>Valor (R$) *</label>
          <CurrencyInput className={INP} placeholder="0,00" value={form.valor}
            onChange={v => onChange("valor", v)} />
        </div>
      </div>
      <div>
        <label className={LBL}>Motivo *</label>
        <div className="relative">
          <select className={SEL} value={form.motivo} onChange={e => onChange("motivo", e.target.value)}>
            {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>
      <div>
        <label className={LBL}>Observação</label>
        <input className={INP} placeholder="Opcional" value={form.observacao}
          onChange={e => onChange("observacao", e.target.value)} />
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="text-gray-500 font-semibold text-sm hover:underline px-2">CANCELAR</button>
        <button type="button" onClick={onSave} disabled={isPending}
          className="bg-primary text-white font-semibold px-4 py-1.5 rounded text-sm hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          SALVAR
        </button>
      </div>
    </div>
  );
}

export default function HistoricoMonetarioSection({ staffId, contractorId, table, titulo, tituloAtual }: Props) {
  const qc = useQueryClient();
  const queryKey = [table, staffId];
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Form>(EMPTY);

  function setAdd<K extends keyof Form>(k: K, v: Form[K]) { setAddForm(f => ({ ...f, [k]: v })); }
  function setEdit<K extends keyof Form>(k: K, v: Form[K]) { setEditForm(f => ({ ...f, [k]: v })); }

  function startEdit(r: Record) {
    setEditingId(r.id); setEditForm(recordToForm(r)); setShowAddForm(false);
  }
  function cancelEdit() { setEditingId(null); setEditForm(EMPTY); }

  const { data: registros = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from(table)
        .select("*").eq("staff_id", staffId).order("data_vigencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Record[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!addForm.data_vigencia || !addForm.valor) throw new Error("required");
      const valor = parseCurrency(addForm.valor);
      if (valor === null) throw new Error("invalid");
      const { error } = await (supabase as any).from(table).insert([{
        staff_id: staffId, contractor_id: contractorId,
        data_vigencia: addForm.data_vigencia, valor,
        motivo: addForm.motivo, observacao: addForm.observacao.trim() || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro adicionado.");
      qc.invalidateQueries({ queryKey });
      setAddForm(EMPTY); setShowAddForm(false);
    },
    onError: (err) => {
      const msg = (err as Error).message;
      if (msg === "required") toast.error("Preencha data e valor.");
      else if (msg === "invalid") toast.error("Valor inválido.");
      else toast.error("Erro ao registrar.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editForm.data_vigencia || !editForm.valor) throw new Error("required");
      const valor = parseCurrency(editForm.valor);
      if (valor === null) throw new Error("invalid");
      const { error } = await (supabase as any).from(table).update({
        data_vigencia: editForm.data_vigencia, valor,
        motivo: editForm.motivo, observacao: editForm.observacao.trim() || null,
      }).eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro atualizado.");
      qc.invalidateQueries({ queryKey });
      cancelEdit();
    },
    onError: (err) => {
      const msg = (err as Error).message;
      if (msg === "required") toast.error("Preencha data e valor.");
      else if (msg === "invalid") toast.error("Valor inválido.");
      else toast.error("Erro ao atualizar.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido.");
      qc.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Erro ao remover."),
  });

  const atual = registros[0];

  return (
    <div className="space-y-4">
      {atual && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">{tituloAtual}</p>
            <p className="text-lg font-bold text-gray-900">{fmtBRL(atual.valor)}</p>
            <p className="text-xs text-gray-400">
              Vigência: {fmtDate(atual.data_vigencia)} ·{" "}
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${MOTIVO_BADGE[atual.motivo] ?? "bg-gray-100 text-gray-600"}`}>
                {MOTIVO_LABEL[atual.motivo] ?? atual.motivo}
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">{titulo}</h4>
        {!showAddForm && !editingId && (
          <button type="button" onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 text-primary font-semibold text-xs hover:underline">
            <Plus className="w-3.5 h-3.5" /> REGISTRAR AJUSTE
          </button>
        )}
      </div>

      {showAddForm && (
        <FormPanel title="Novo registro" form={addForm} onChange={setAdd}
          onSave={() => addMutation.mutate()}
          onCancel={() => { setShowAddForm(false); setAddForm(EMPTY); }}
          isPending={addMutation.isPending} />
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
      ) : registros.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">Nenhum registro encontrado.</div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
          {registros.map((r, idx) => (
            <div key={r.id}>
              {editingId === r.id ? (
                <div className="p-3">
                  <FormPanel title="Editar registro" form={editForm} onChange={setEdit}
                    onSave={() => updateMutation.mutate()} onCancel={cancelEdit}
                    isPending={updateMutation.isPending} />
                </div>
              ) : (
                <div className={`flex items-center justify-between px-4 py-3 ${idx === 0 ? "bg-gray-50" : "bg-white"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{fmtBRL(r.valor)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${MOTIVO_BADGE[r.motivo] ?? "bg-gray-100 text-gray-600"}`}>
                        {MOTIVO_LABEL[r.motivo] ?? r.motivo}
                      </span>
                      {idx === 0 && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">atual</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Vigência: {fmtDate(r.data_vigencia)}
                      {r.observacao ? ` · ${r.observacao}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <button type="button" onClick={() => startEdit(r)}
                      disabled={!!editingId || showAddForm}
                      className="text-gray-300 hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                    <button type="button"
                      onClick={() => { if (confirm("Remover este registro?")) deleteMutation.mutate(r.id); }}
                      disabled={!!editingId || showAddForm}
                      className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remover"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
