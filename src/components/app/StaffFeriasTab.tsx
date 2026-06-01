import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Loader2, ChevronDown, CalendarDays } from "lucide-react";
import { toast } from "sonner";

interface Props {
  staffId: string;
  contractorId: string;
}

interface FeriasRecord {
  id: string;
  data_inicio: string;
  data_fim: string;
  dias: number;
  status: "agendado" | "em_andamento" | "concluido" | "cancelado";
  observacao: string | null;
  created_at: string;
}

interface FeriasForm {
  data_inicio: string;
  data_fim: string;
  status: string;
  observacao: string;
}

const STATUS_OPTIONS = [
  { value: "agendado",     label: "Agendado" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido",    label: "Concluído" },
  { value: "cancelado",    label: "Cancelado" },
];

const STATUS_BADGE: Record<string, string> = {
  agendado:     "bg-blue-100 text-blue-700",
  em_andamento: "bg-yellow-100 text-yellow-700",
  concluido:    "bg-green-100 text-green-700",
  cancelado:    "bg-gray-100 text-gray-500",
};

const STATUS_LABEL: Record<string, string> = {
  agendado:     "Agendado",
  em_andamento: "Em andamento",
  concluido:    "Concluído",
  cancelado:    "Cancelado",
};

const EMPTY: FeriasForm = {
  data_inicio: "",
  data_fim: "",
  status: "agendado",
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

function calcDias(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  const a = new Date(inicio);
  const b = new Date(fim);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

export default function StaffFeriasTab({ staffId, contractorId }: Props) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FeriasForm>(EMPTY);

  function set<K extends keyof FeriasForm>(k: K, v: FeriasForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  const { data: ferias = [], isLoading } = useQuery({
    queryKey: ["staff-ferias", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_ferias")
        .select("*")
        .eq("staff_id", staffId)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as FeriasRecord[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.data_inicio || !form.data_fim) throw new Error("required");
      if (form.data_fim < form.data_inicio) throw new Error("datas");
      const dias = calcDias(form.data_inicio, form.data_fim);
      const { error } = await supabase.from("staff_ferias").insert([{
        staff_id: staffId,
        contractor_id: contractorId,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        dias,
        status: form.status,
        observacao: form.observacao.trim() || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Férias registradas.");
      qc.invalidateQueries({ queryKey: ["staff-ferias", staffId] });
      setForm(EMPTY);
      setShowForm(false);
    },
    onError: (err) => {
      const msg = (err as Error).message;
      if (msg === "required") toast.error("Informe a data de início e fim.");
      else if (msg === "datas") toast.error("A data de fim deve ser após o início.");
      else toast.error("Erro ao registrar férias.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_ferias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido.");
      qc.invalidateQueries({ queryKey: ["staff-ferias", staffId] });
    },
    onError: () => toast.error("Erro ao remover registro."),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("staff_ferias").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado.");
      qc.invalidateQueries({ queryKey: ["staff-ferias", staffId] });
    },
    onError: () => toast.error("Erro ao atualizar status."),
  });

  const totalDias = ferias
    .filter(f => f.status !== "cancelado")
    .reduce((acc, f) => acc + f.dias, 0);

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-center gap-3">
        <CalendarDays className="w-5 h-5 text-blue-500 flex-shrink-0" />
        <div>
          <p className="text-xs text-gray-500">Total de dias de férias registrados</p>
          <p className="text-lg font-bold text-gray-900">{totalDias} dias</p>
          <p className="text-xs text-gray-400">{ferias.filter(f => f.status !== "cancelado").length} período(s)</p>
        </div>
      </div>

      {/* Cabeçalho + botão */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Períodos de férias</h4>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-primary font-semibold text-xs hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> ADICIONAR PERÍODO
          </button>
        )}
      </div>

      {/* Formulário inline */}
      {showForm && (
        <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-4">
          <p className="text-sm font-semibold text-gray-700">Novo período de férias</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LBL}>Data de início *</label>
              <input type="date" className={INP} value={form.data_inicio} onChange={e => set("data_inicio", e.target.value)} />
            </div>
            <div>
              <label className={LBL}>Data de fim *</label>
              <input type="date" className={INP} value={form.data_fim} onChange={e => set("data_fim", e.target.value)} />
            </div>
          </div>
          {form.data_inicio && form.data_fim && form.data_fim >= form.data_inicio && (
            <p className="text-xs text-primary font-medium">
              {calcDias(form.data_inicio, form.data_fim)} dias
            </p>
          )}
          <div>
            <label className={LBL}>Status</label>
            <div className="relative">
              <select className={SEL} value={form.status} onChange={e => set("status", e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
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

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      ) : ferias.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          Nenhum período de férias registrado.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
          {ferias.map(f => (
            <div key={f.id} className="flex items-center justify-between px-4 py-3 bg-white">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {fmtDate(f.data_inicio)} → {fmtDate(f.data_fim)}
                  </span>
                  <span className="text-xs text-gray-400">{f.dias} dias</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={f.status}
                    onChange={e => updateStatusMutation.mutate({ id: f.id, status: e.target.value })}
                    className={`text-xs font-medium px-1.5 py-0.5 rounded border-0 outline-none cursor-pointer ${STATUS_BADGE[f.status]}`}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  {f.observacao && <span className="text-xs text-gray-400">{f.observacao}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { if (confirm("Remover este período?")) deleteMutation.mutate(f.id); }}
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
