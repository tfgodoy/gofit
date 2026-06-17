import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Loader2, Clock, Pencil, X as XIcon } from "lucide-react";
import { toast } from "sonner";

interface Props {
  staffId: string;
  contractorId: string;
}

interface Periodo {
  id: string;
  dias: string[];        // ["mon","tue",...]
  hora_inicio: string;   // "17:00"
  hora_fim: string;      // "21:00"
}

interface Registro {
  id: string;
  data_vigencia: string;
  horas_semanais: number;
  motivo: string;
  observacao: string | null;
  grade: Periodo[] | string | null;
  created_at: string;
}

interface Form {
  data_vigencia: string;
  observacao: string;
  periodos: Periodo[];
}

const DIAS = [
  { value: "mon", label: "Seg" },
  { value: "tue", label: "Ter" },
  { value: "wed", label: "Qua" },
  { value: "thu", label: "Qui" },
  { value: "fri", label: "Sex" },
  { value: "sat", label: "Sáb" },
  { value: "sun", label: "Dom" },
];

const DOW_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

const EMPTY_PERIODO = (): Periodo => ({
  id: crypto.randomUUID(),
  dias: [],
  hora_inicio: "08:00",
  hora_fim: "12:00",
});

const EMPTY_FORM: Form = {
  data_vigencia: "",
  observacao: "",
  periodos: [EMPTY_PERIODO()],
};

const INP = "w-full bg-transparent border-0 border-b border-gray-300 py-2 px-0 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-b-2 focus:border-primary transition-colors";
const LBL = "block text-xs text-gray-500 mb-0.5";

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function parseGrade(raw: Periodo[] | string | null): Periodo[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(p => ({
      id: p.id || crypto.randomUUID(),
      dias: Array.isArray(p.dias) ? p.dias : [],
      hora_inicio: p.hora_inicio || "08:00",
      hora_fim: p.hora_fim || "12:00",
    }));
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parseGrade(parsed);
    } catch { /* texto livre legado — ignora, cai vazio */ }
  }
  return [];
}

function horasDoPeriodo(p: Periodo): number {
  const [hi, mi] = p.hora_inicio.split(":").map(Number);
  const [hf, mf] = p.hora_fim.split(":").map(Number);
  if (isNaN(hi) || isNaN(hf)) return 0;
  const inicio = hi + (mi || 0) / 60;
  const fim    = hf + (mf || 0) / 60;
  const delta  = fim - inicio;
  return delta > 0 ? delta : 0;
}

function calcHorasSemana(periodos: Periodo[]): number {
  return periodos.reduce((tot, p) => tot + horasDoPeriodo(p) * p.dias.length, 0);
}

function calcHorasMes(periodos: Periodo[], ref = new Date()): number {
  const ano = ref.getFullYear();
  const mes = ref.getMonth();
  const ultDia = new Date(ano, mes + 1, 0).getDate();
  const contagem: Record<string, number> = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 };
  for (let d = 1; d <= ultDia; d++) {
    const dow = new Date(ano, mes, d).getDay();
    const key = Object.keys(DOW_INDEX).find(k => DOW_INDEX[k] === dow)!;
    contagem[key]++;
  }
  return periodos.reduce((tot, p) => {
    const horas = horasDoPeriodo(p);
    if (horas <= 0) return tot;
    const dias = p.dias.reduce((s, d) => s + (contagem[d] || 0), 0);
    return tot + horas * dias;
  }, 0);
}

function descricaoCurta(periodos: Periodo[]): string {
  if (periodos.length === 0) return "";
  return periodos
    .filter(p => p.dias.length > 0)
    .map(p => {
      const dias = p.dias
        .sort((a, b) => DOW_INDEX[a] - DOW_INDEX[b])
        .map(d => DIAS.find(x => x.value === d)!.label).join("/");
      return `${dias} ${p.hora_inicio}–${p.hora_fim}`;
    }).join("; ");
}

function nomeMesAtual(): string {
  return new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

// ── Form panel (DECLARADO FORA do componente principal para não remontar) ───

interface PanelProps {
  title: string;
  form: Form;
  setForm: (updater: (f: Form) => Form) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}

function FormPanel({ title, form, setForm, onSave, onCancel, isPending }: PanelProps) {
  function updatePeriodo(id: string, patch: Partial<Periodo>) {
    setForm(f => ({
      ...f,
      periodos: f.periodos.map(p => p.id === id ? { ...p, ...patch } : p),
    }));
  }
  function toggleDia(periodoId: string, dia: string) {
    setForm(f => ({
      ...f,
      periodos: f.periodos.map(p => p.id === periodoId
        ? { ...p, dias: p.dias.includes(dia) ? p.dias.filter(d => d !== dia) : [...p.dias, dia] }
        : p),
    }));
  }
  function addPeriodo() {
    setForm(f => ({ ...f, periodos: [...f.periodos, EMPTY_PERIODO()] }));
  }
  function removePeriodo(id: string) {
    setForm(f => ({
      ...f,
      periodos: f.periodos.length > 1 ? f.periodos.filter(p => p.id !== id) : f.periodos,
    }));
  }

  const horasSemana = calcHorasSemana(form.periodos);
  const horasMes    = calcHorasMes(form.periodos);

  return (
    <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-4">
      <p className="text-sm font-semibold text-gray-700">{title}</p>

      <div>
        <label className={LBL}>Data de vigência *</label>
        <input type="date" className={INP} value={form.data_vigencia}
          onChange={e => setForm(f => ({ ...f, data_vigencia: e.target.value }))} />
      </div>

      {/* Períodos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-700">Períodos / dias de trabalho</label>
          <button type="button" onClick={addPeriodo}
            className="flex items-center gap-1 text-primary text-xs font-semibold hover:underline">
            <Plus className="w-3 h-3" /> Adicionar período
          </button>
        </div>

        {form.periodos.map((p, idx) => (
          <div key={p.id} className="border border-gray-200 bg-white rounded p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600">Período {idx + 1}</span>
              {form.periodos.length > 1 && (
                <button type="button" onClick={() => removePeriodo(p.id)}
                  className="text-gray-400 hover:text-red-600" title="Remover período">
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dias da semana */}
            <div className="flex flex-wrap gap-1.5">
              {DIAS.map(d => {
                const ativo = p.dias.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDia(p.id, d.value)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                      ativo
                        ? "bg-primary border-primary text-white"
                        : "bg-white border-gray-300 text-gray-600 hover:border-primary hover:text-primary"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>

            {/* Horários */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LBL}>Hora início</label>
                <input type="time" className={INP} value={p.hora_inicio}
                  onChange={e => updatePeriodo(p.id, { hora_inicio: e.target.value })} />
              </div>
              <div>
                <label className={LBL}>Hora fim</label>
                <input type="time" className={INP} value={p.hora_fim}
                  onChange={e => updatePeriodo(p.id, { hora_fim: e.target.value })} />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              {p.dias.length === 0
                ? "Selecione pelo menos um dia."
                : `${horasDoPeriodo(p).toFixed(2)} h × ${p.dias.length} ${p.dias.length === 1 ? "dia" : "dias"} = ${(horasDoPeriodo(p) * p.dias.length).toFixed(2)} h/sem`}
            </p>
          </div>
        ))}
      </div>

      {/* Totais calculados */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-primary/30 rounded p-3">
          <p className="text-xs text-gray-500">Carga semanal</p>
          <p className="text-lg font-bold text-primary">{horasSemana.toFixed(2)} h</p>
        </div>
        <div className="bg-white border border-primary/30 rounded p-3">
          <p className="text-xs text-gray-500">Carga mensal — {nomeMesAtual()}</p>
          <p className="text-lg font-bold text-primary">{horasMes.toFixed(2)} h</p>
        </div>
      </div>

      <div>
        <label className={LBL}>Observação</label>
        <input className={INP} placeholder="Opcional" value={form.observacao}
          onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
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

// ── Componente principal ────────────────────────────────────────────────────

export default function CargaHorariaSection({ staffId, contractorId }: Props) {
  const qc = useQueryClient();
  const queryKey = ["staff_cargas_horarias", staffId];
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<Form>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Form>(EMPTY_FORM);

  const { data: registros = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("staff_cargas_horarias")
        .select("*").eq("staff_id", staffId).order("data_vigencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Registro[];
    },
  });

  function startEdit(r: Registro) {
    setEditingId(r.id);
    setEditForm({
      data_vigencia: r.data_vigencia,
      observacao: r.observacao ?? "",
      periodos: parseGrade(r.grade).length > 0 ? parseGrade(r.grade) : [EMPTY_PERIODO()],
    });
    setShowAddForm(false);
  }
  function cancelEdit() { setEditingId(null); setEditForm(EMPTY_FORM); }

  function validar(form: Form): string | null {
    if (!form.data_vigencia) return "Informe a data de vigência.";
    const validos = form.periodos.filter(p => p.dias.length > 0 && horasDoPeriodo(p) > 0);
    if (validos.length === 0) return "Adicione ao menos um período com dias e horário válidos.";
    return null;
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      const erro = validar(addForm);
      if (erro) throw new Error(erro);
      const periodos = addForm.periodos.filter(p => p.dias.length > 0 && horasDoPeriodo(p) > 0);
      const horas = calcHorasSemana(periodos);
      const { error } = await (supabase as any).from("staff_cargas_horarias").insert([{
        staff_id: staffId, contractor_id: contractorId,
        data_vigencia: addForm.data_vigencia,
        horas_semanais: horas,
        motivo: "reajuste",
        grade: periodos,
        observacao: addForm.observacao.trim() || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Carga horária registrada.");
      qc.invalidateQueries({ queryKey });
      setAddForm(EMPTY_FORM); setShowAddForm(false);
    },
    onError: (err) => toast.error((err as Error).message || "Erro ao registrar."),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const erro = validar(editForm);
      if (erro) throw new Error(erro);
      const periodos = editForm.periodos.filter(p => p.dias.length > 0 && horasDoPeriodo(p) > 0);
      const horas = calcHorasSemana(periodos);
      const { error } = await (supabase as any).from("staff_cargas_horarias").update({
        data_vigencia: editForm.data_vigencia,
        horas_semanais: horas,
        motivo: "reajuste",
        grade: periodos,
        observacao: editForm.observacao.trim() || null,
      }).eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atualizado.");
      qc.invalidateQueries({ queryKey });
      cancelEdit();
    },
    onError: (err) => toast.error((err as Error).message || "Erro ao atualizar."),
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

  return (
    <div className="space-y-4">
      {atual && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-gray-500">Carga horária atual</p>
            <p className="text-lg font-bold text-gray-900">
              {Number(atual.horas_semanais).toFixed(2)} h/semana
              <span className="text-sm font-normal text-gray-500 ml-2">
                ≈ {calcHorasMes(parseGrade(atual.grade)).toFixed(2)} h em {nomeMesAtual()}
              </span>
            </p>
            <p className="text-xs text-gray-400">
              Vigência: {fmtDate(atual.data_vigencia)}
              {descricaoCurta(parseGrade(atual.grade)) ? ` · ${descricaoCurta(parseGrade(atual.grade))}` : ""}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Histórico de carga horária</h4>
        {!showAddForm && !editingId && (
          <button type="button" onClick={() => { setShowAddForm(true); setAddForm({ ...EMPTY_FORM, periodos: [EMPTY_PERIODO()] }); }}
            className="flex items-center gap-1.5 text-primary font-semibold text-xs hover:underline">
            <Plus className="w-3.5 h-3.5" /> REGISTRAR AJUSTE
          </button>
        )}
      </div>

      {showAddForm && (
        <FormPanel title="Nova carga horária" form={addForm} setForm={setAddForm}
          onSave={() => addMutation.mutate()}
          onCancel={() => { setShowAddForm(false); setAddForm(EMPTY_FORM); }}
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
                  <FormPanel title="Editar carga horária" form={editForm} setForm={setEditForm}
                    onSave={() => updateMutation.mutate()} onCancel={cancelEdit}
                    isPending={updateMutation.isPending} />
                </div>
              ) : (
                <div className={`flex items-center justify-between px-4 py-3 ${idx === 0 ? "bg-gray-50" : "bg-white"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{Number(r.horas_semanais).toFixed(2)} h/sem</span>
                      {idx === 0 && <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">atual</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Vigência: {fmtDate(r.data_vigencia)}
                      {descricaoCurta(parseGrade(r.grade)) ? ` · ${descricaoCurta(parseGrade(r.grade))}` : ""}
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
