import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Loader2, ChevronDown, Clock, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Props {
  staffId: string;
  contractorId: string;
}

interface Record {
  id: string;
  data_vigencia: string;
  horas_semanais: number;
  motivo: string;
  observacao: string | null;
  grade: string | null;
  created_at: string;
}

interface Form {
  data_vigencia: string;
  horas_semanais: string;
  motivo: string;
  grade: string;
  observacao: string;
}

const MOTIVOS = [
  { value: "admissao", label: "Admissão" },
  { value: "reajuste", label: "Reajuste" },
  { value: "promocao", label: "Promoção" },
  { value: "correcao", label: "Correção" },
];
const MOTIVO_LABEL: Record<string, string> = {
  admissao: "Admissão", reajuste: "Reajuste", promocao: "Promoção", correcao: "Correção",
};
const MOTIVO_BADGE: Record<string, string> = {
  admissao: "bg-blue-100 text-blue-700",
  reajuste: "bg-green-100 text-green-700",
  promocao: "bg-orange-100 text-orange-700",
  correcao: "bg-amber-100 text-amber-700",
};

const EMPTY: Form = { data_vigencia: "", horas_semanais: "", motivo: "reajuste", grade: "", observacao: "" };

const INP = "w-full bg-transparent border-0 border-b border-gray-300 py-2 px-0 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-b-2 focus:border-primary transition-colors";
const SEL = "w-full bg-transparent border-0 border-b border-gray-300 py-2 pl-0 pr-6 text-sm text-gray-900 outline-none appearance-none cursor-pointer focus:border-b-2 focus:border-primary transition-colors";
const LBL = "block text-xs text-gray-500 mb-0.5";

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function recordToForm(r: Record): Form {
  return {
    data_vigencia: r.data_vigencia,
    horas_semanais: String(r.horas_semanais),
    motivo: r.motivo,
    grade: r.grade ?? "",
    observacao: r.observacao ?? "",
  };
}

export default function CargaHorariaSection({ staffId, contractorId }: Props) {
  const qc = useQueryClient();
  const queryKey = ["staff_cargas_horarias", staffId];
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Form>(EMPTY);

  const { data: registros = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("staff_cargas_horarias")
        .select("*").eq("staff_id", staffId).order("data_vigencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Record[];
    },
  });

  function setAdd<K extends keyof Form>(k: K, v: Form[K]) { setAddForm(f => ({ ...f, [k]: v })); }
  function setEdit<K extends keyof Form>(k: K, v: Form[K]) { setEditForm(f => ({ ...f, [k]: v })); }

  function startEdit(r: Record) { setEditingId(r.id); setEditForm(recordToForm(r)); setShowAddForm(false); }
  function cancelEdit() { setEditingId(null); setEditForm(EMPTY); }

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!addForm.data_vigencia || !addForm.horas_semanais) throw new Error("required");
      const horas = parseFloat(addForm.horas_semanais.replace(",", "."));
      if (isNaN(horas) || horas <= 0) throw new Error("invalid");
      const { error } = await (supabase as any).from("staff_cargas_horarias").insert([{
        staff_id: staffId, contractor_id: contractorId,
        data_vigencia: addForm.data_vigencia, horas_semanais: horas,
        motivo: addForm.motivo,
        grade: addForm.grade.trim() || null,
        observacao: addForm.observacao.trim() || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Carga horária registrada.");
      qc.invalidateQueries({ queryKey });
      setAddForm(EMPTY); setShowAddForm(false);
    },
    onError: (err) => {
      const msg = (err as Error).message;
      if (msg === "required") toast.error("Preencha data e horas.");
      else if (msg === "invalid") toast.error("Horas inválidas.");
      else toast.error("Erro ao registrar.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editForm.data_vigencia || !editForm.horas_semanais) throw new Error("required");
      const horas = parseFloat(editForm.horas_semanais.replace(",", "."));
      if (isNaN(horas) || horas <= 0) throw new Error("invalid");
      const { error } = await (supabase as any).from("staff_cargas_horarias").update({
        data_vigencia: editForm.data_vigencia, horas_semanais: horas,
        motivo: editForm.motivo,
        grade: editForm.grade.trim() || null,
        observacao: editForm.observacao.trim() || null,
      }).eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atualizado.");
      qc.invalidateQueries({ queryKey });
      cancelEdit();
    },
    onError: () => toast.error("Erro ao atualizar."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("staff_cargas_horarias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido.");
      qc.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Erro ao remover."),
  });

  const atual = registros[0];

  function FormBlock({ form, set, onSave, onCancel, isPending, title }: {
    form: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void;
    onSave: () => void; onCancel: () => void; isPending: boolean; title: string;
  }) {
    return (
      <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-4">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LBL}>Data de vigência *</label>
            <input type="date" className={INP} value={form.data_vigencia}
              onChange={e => set("data_vigencia", e.target.value)} />
          </div>
          <div>
            <label className={LBL}>Horas semanais *</label>
            <input type="number" min="0" step="0.5" className={INP} placeholder="0"
              value={form.horas_semanais}
              onChange={e => set("horas_semanais", e.target.value)} />
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
          <label className={LBL}>Grade de horários</label>
          <input className={INP} placeholder='Ex: Ter/Qui 16:00–21:00; Seg/Qua/Sex 17:00–21:00'
            value={form.grade}
            onChange={e => set("grade", e.target.value)} />
        </div>
        <div>
          <label className={LBL}>Observação</label>
          <input className={INP} placeholder="Opcional" value={form.observacao}
            onChange={e => set("observacao", e.target.value)} />
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onCancel}
            className="text-gray-500 font-semibold text-sm hover:underline px-2">CANCELAR</button>
          <button type="button" onClick={onSave} disabled={isPending}
            className="bg-primary text-white font-semibold px-4 py-1.5 rounded text-sm hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2">
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}SALVAR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {atual && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Carga horária atual</p>
            <p className="text-lg font-bold text-gray-900">{Number(atual.horas_semanais)} horas / semana</p>
            <p className="text-xs text-gray-400">
              Vigência: {fmtDate(atual.data_vigencia)}
              {atual.grade ? ` · ${atual.grade}` : ""}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Histórico de carga horária</h4>
        {!showAddForm && !editingId && (
          <button type="button" onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 text-primary font-semibold text-xs hover:underline">
            <Plus className="w-3.5 h-3.5" /> REGISTRAR AJUSTE
          </button>
        )}
      </div>

      {showAddForm && (
        <FormBlock title="Nova carga horária" form={addForm} set={setAdd}
          onSave={() => addMutation.mutate()}
          onCancel={() => { setShowAddForm(false); setAddForm(EMPTY); }}
          isPending={addMutation.isPending} />
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
      ) : registros.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">Nenhum registro de carga horária.</div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
          {registros.map((r, idx) => (
            <div key={r.id}>
              {editingId === r.id ? (
                <div className="p-3">
                  <FormBlock title="Editar carga horária" form={editForm} set={setEdit}
                    onSave={() => updateMutation.mutate()} onCancel={cancelEdit}
                    isPending={updateMutation.isPending} />
                </div>
              ) : (
                <div className={`flex items-center justify-between px-4 py-3 ${idx === 0 ? "bg-gray-50" : "bg-white"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{Number(r.horas_semanais)} h/sem</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${MOTIVO_BADGE[r.motivo] ?? "bg-gray-100 text-gray-600"}`}>
                        {MOTIVO_LABEL[r.motivo] ?? r.motivo}
                      </span>
                      {idx === 0 && <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">atual</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Vigência: {fmtDate(r.data_vigencia)}
                      {r.grade ? ` · ${r.grade}` : ""}
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
