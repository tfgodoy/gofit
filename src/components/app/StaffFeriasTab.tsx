import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, Trash2, Loader2, ChevronDown, CalendarDays,
  Pencil, AlertTriangle, Clock,
} from "lucide-react";
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

interface StaffBasic {
  data_admissao: string | null;
  name: string;
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

const EMPTY: FeriasForm = { data_inicio: "", data_fim: "", status: "agendado", observacao: "" };

const INP = [
  "w-full bg-transparent border-0 border-b border-gray-300",
  "py-2 px-0 text-sm text-gray-900 placeholder:text-gray-400",
  "outline-none focus:border-b-2 focus:border-primary transition-colors",
].join(" ");

const SEL = [
  "w-full bg-transparent border-0 border-b border-gray-300",
  "py-2 pl-0 pr-6 text-sm text-gray-900",
  "outline-none appearance-none cursor-pointer focus:border-b-2 focus:border-primary transition-colors",
].join(" ");

const LBL = "block text-xs text-gray-500 mb-0.5";

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function calcDias(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  const a = new Date(inicio), b = new Date(fim);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

function recordToForm(f: FeriasRecord): FeriasForm {
  return { data_inicio: f.data_inicio, data_fim: f.data_fim, status: f.status, observacao: f.observacao ?? "" };
}

// ── Cálculo de gestão de férias (CLT) ────────────────────────────────────────

interface VacationMetrics {
  periodosCompletos: number;
  diasCredito: number;        // períodos × 30
  diasUtilizados: number;     // soma dos não cancelados
  saldo: number;              // crédito - utilizados
  mesesNoAtualPeriodo: number;
  inicioPeriodoAtual: string;
  fimPeriodoAtual: string;
  fimConcessivo: string;      // fim do período concessivo do último período completo
  diasParaVencer: number | null; // dias até o concessivo vencer (null se sem admissão)
  feriasVencidas: boolean;
}

function calcMetrics(dataAdmissao: string | null, ferias: FeriasRecord[]): VacationMetrics | null {
  if (!dataAdmissao) return null;

  const admissao    = new Date(dataAdmissao + "T00:00:00");
  const hoje        = new Date();
  hoje.setHours(0, 0, 0, 0);

  const meses = (hoje.getFullYear() - admissao.getFullYear()) * 12
              + (hoje.getMonth()    - admissao.getMonth());

  const periodosCompletos   = Math.floor(meses / 12);
  const mesesNoAtualPeriodo = meses % 12;
  const diasCredito         = periodosCompletos * 30;

  const diasUtilizados = ferias
    .filter(f => f.status !== "cancelado")
    .reduce((acc, f) => acc + f.dias, 0);

  // Início do período aquisitivo atual
  const inicioPeriodoAtual = new Date(admissao);
  inicioPeriodoAtual.setFullYear(admissao.getFullYear() + periodosCompletos);

  // Fim do período aquisitivo atual
  const fimPeriodoAtual = new Date(inicioPeriodoAtual);
  fimPeriodoAtual.setFullYear(fimPeriodoAtual.getFullYear() + 1);
  fimPeriodoAtual.setDate(fimPeriodoAtual.getDate() - 1);

  // Fim do período concessivo (até quando o funcionário precisa tirar as férias do último período)
  const fimConcessivo = new Date(inicioPeriodoAtual);
  fimConcessivo.setFullYear(fimConcessivo.getFullYear() + 1);
  fimConcessivo.setDate(fimConcessivo.getDate() - 1);

  const diasParaVencer = periodosCompletos > 0
    ? Math.round((fimConcessivo.getTime() - hoje.getTime()) / 86400000)
    : null;

  const feriasVencidas = diasParaVencer !== null && diasParaVencer < 0 && diasUtilizados < diasCredito;

  return {
    periodosCompletos,
    diasCredito,
    diasUtilizados,
    saldo: diasCredito - diasUtilizados,
    mesesNoAtualPeriodo,
    inicioPeriodoAtual: inicioPeriodoAtual.toISOString().split("T")[0],
    fimPeriodoAtual: fimPeriodoAtual.toISOString().split("T")[0],
    fimConcessivo: fimConcessivo.toISOString().split("T")[0],
    diasParaVencer,
    feriasVencidas,
  };
}

// ── Formulário reutilizável ──────────────────────────────────────────────────

interface FormPanelProps {
  title: string;
  form: FeriasForm;
  onChange: <K extends keyof FeriasForm>(k: K, v: FeriasForm[K]) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}

function FormPanel({ title, form, onChange, onSave, onCancel, isPending }: FormPanelProps) {
  const dias = calcDias(form.data_inicio, form.data_fim);
  return (
    <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-4">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LBL}>Data de início *</label>
          <input type="date" className={INP} value={form.data_inicio} onChange={e => onChange("data_inicio", e.target.value)} />
        </div>
        <div>
          <label className={LBL}>Data de fim *</label>
          <input type="date" className={INP} value={form.data_fim} onChange={e => onChange("data_fim", e.target.value)} />
        </div>
      </div>
      {dias > 0 && (
        <p className="text-xs font-semibold text-primary">{dias} dia{dias !== 1 ? "s" : ""}</p>
      )}
      <div>
        <label className={LBL}>Status</label>
        <div className="relative">
          <select className={SEL} value={form.status} onChange={e => onChange("status", e.target.value)}>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>
      <div>
        <label className={LBL}>Observação</label>
        <input className={INP} placeholder="Opcional" value={form.observacao} onChange={e => onChange("observacao", e.target.value)} />
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} className="text-gray-500 font-semibold text-sm hover:underline px-2">CANCELAR</button>
        <button
          type="button" onClick={onSave} disabled={isPending}
          className="bg-primary text-white font-semibold px-4 py-1.5 rounded text-sm hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          SALVAR
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function StaffFeriasTab({ staffId, contractorId }: Props) {
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm]         = useState<FeriasForm>(EMPTY);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editForm, setEditForm]       = useState<FeriasForm>(EMPTY);

  function setAdd<K extends keyof FeriasForm>(k: K, v: FeriasForm[K]) { setAddForm(f => ({ ...f, [k]: v })); }
  function setEdit<K extends keyof FeriasForm>(k: K, v: FeriasForm[K]) { setEditForm(f => ({ ...f, [k]: v })); }

  function startEdit(r: FeriasRecord) { setEditingId(r.id); setEditForm(recordToForm(r)); setShowAddForm(false); }
  function cancelEdit() { setEditingId(null); setEditForm(EMPTY); }

  const { data: staff } = useQuery({
    queryKey: ["staff-basic", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff").select("data_admissao, name").eq("id", staffId).single();
      if (error) throw error;
      return data as StaffBasic;
    },
  });

  const { data: ferias = [], isLoading } = useQuery({
    queryKey: ["staff-ferias", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_ferias").select("*").eq("staff_id", staffId)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as FeriasRecord[];
    },
  });

  const metrics = calcMetrics(staff?.data_admissao ?? null, ferias);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!addForm.data_inicio || !addForm.data_fim) throw new Error("required");
      if (addForm.data_fim < addForm.data_inicio) throw new Error("datas");
      const { error } = await supabase.from("staff_ferias").insert([{
        staff_id: staffId, contractor_id: contractorId,
        data_inicio: addForm.data_inicio, data_fim: addForm.data_fim,
        dias: calcDias(addForm.data_inicio, addForm.data_fim),
        status: addForm.status as "agendado" | "em_andamento" | "concluido" | "cancelado",
        observacao: addForm.observacao.trim() || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Férias registradas.");
      qc.invalidateQueries({ queryKey: ["staff-ferias", staffId] });
      setAddForm(EMPTY); setShowAddForm(false);
    },
    onError: (err) => {
      const msg = (err as Error).message;
      if (msg === "required") toast.error("Informe a data de início e fim.");
      else if (msg === "datas") toast.error("A data de fim deve ser após o início.");
      else toast.error("Erro ao registrar férias.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editForm.data_inicio || !editForm.data_fim) throw new Error("required");
      if (editForm.data_fim < editForm.data_inicio) throw new Error("datas");
      const { error } = await supabase.from("staff_ferias").update({
        data_inicio: editForm.data_inicio, data_fim: editForm.data_fim,
        dias: calcDias(editForm.data_inicio, editForm.data_fim),
        status: editForm.status as "agendado" | "em_andamento" | "concluido" | "cancelado",
        observacao: editForm.observacao.trim() || null,
      }).eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Período atualizado.");
      qc.invalidateQueries({ queryKey: ["staff-ferias", staffId] });
      cancelEdit();
    },
    onError: (err) => {
      const msg = (err as Error).message;
      if (msg === "required") toast.error("Informe a data de início e fim.");
      else if (msg === "datas") toast.error("A data de fim deve ser após o início.");
      else toast.error("Erro ao atualizar período.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_ferias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Período removido.");
      qc.invalidateQueries({ queryKey: ["staff-ferias", staffId] });
    },
    onError: () => toast.error("Erro ao remover período."),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Painel de gestão ─────────────────────────────────────────────── */}
      {metrics ? (
        <>
          {/* Alerta férias vencidas */}
          {metrics.feriasVencidas && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Férias vencidas!</p>
                <p className="text-xs text-red-500 mt-0.5">
                  O prazo concessivo expirou em {fmtDate(metrics.fimConcessivo)}. O funcionário tem direito a férias em dobro.
                </p>
              </div>
            </div>
          )}

          {/* Alerta vencimento próximo (até 60 dias) */}
          {!metrics.feriasVencidas && metrics.diasParaVencer !== null && metrics.diasParaVencer <= 60 && metrics.saldo > 0 && (
            <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-700">Prazo se encerrando</p>
                <p className="text-xs text-orange-500 mt-0.5">
                  {metrics.diasParaVencer} dia{metrics.diasParaVencer !== 1 ? "s" : ""} para o período concessivo vencer ({fmtDate(metrics.fimConcessivo)}). Agende as férias.
                </p>
              </div>
            </div>
          )}

          {/* Cards de métricas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{metrics.diasCredito}</p>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">Crédito acumulado</p>
              <p className="text-xs text-gray-400">{metrics.periodosCompletos} período{metrics.periodosCompletos !== 1 ? "s" : ""} × 30 dias</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">{metrics.diasUtilizados}</p>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">Dias tirados</p>
              <p className="text-xs text-gray-400">{ferias.filter(f => f.status !== "cancelado").length} período{ferias.filter(f => f.status !== "cancelado").length !== 1 ? "s" : ""}</p>
            </div>
            <div className={`border rounded-lg p-3 text-center ${
              metrics.saldo < 0  ? "bg-red-50 border-red-200"
              : metrics.saldo === 0 ? "bg-gray-50 border-gray-200"
              : "bg-green-50 border-green-100"
            }`}>
              <p className={`text-2xl font-bold ${
                metrics.saldo < 0  ? "text-red-600"
                : metrics.saldo === 0 ? "text-gray-600"
                : "text-green-700"
              }`}>
                {metrics.saldo}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">Saldo disponível</p>
              <p className="text-xs text-gray-400">dias a tirar</p>
            </div>
          </div>

          {/* Período aquisitivo atual */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Período aquisitivo em andamento</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">
                {fmtDate(metrics.inicioPeriodoAtual)} → {fmtDate(metrics.fimPeriodoAtual)}
              </p>
              <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                {metrics.mesesNoAtualPeriodo}/12 meses
              </span>
            </div>
            {/* Barra de progresso */}
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${(metrics.mesesNoAtualPeriodo / 12) * 100}%` }}
              />
            </div>
            {metrics.saldo > 0 && !metrics.feriasVencidas && metrics.diasParaVencer !== null && (
              <p className="text-xs text-gray-400">
                Prazo para tirar: até {fmtDate(metrics.fimConcessivo)}
                {metrics.diasParaVencer > 0 ? ` · ${metrics.diasParaVencer} dias restantes` : ""}
              </p>
            )}
          </div>

          {/* Informativo CLT */}
          <div className="flex items-start gap-1.5 text-xs text-gray-400">
            <CalendarDays className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Cálculo CLT: 30 dias por período aquisitivo de 12 meses · Pode fracionar em até 3 períodos</span>
          </div>
        </>
      ) : (
        /* Sem data de admissão */
        <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-orange-700">
            Cadastre a <strong>data de admissão</strong> na aba Profissional para calcular automaticamente o crédito de férias.
          </p>
        </div>
      )}

      {/* ── Lista de períodos ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1">
        <h4 className="text-sm font-semibold text-gray-700">Períodos de férias</h4>
        {!showAddForm && !editingId && (
          <button
            type="button" onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 text-primary font-semibold text-xs hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> ADICIONAR PERÍODO
          </button>
        )}
      </div>

      {showAddForm && (
        <FormPanel
          title="Novo período de férias"
          form={addForm} onChange={setAdd}
          onSave={() => addMutation.mutate()}
          onCancel={() => { setShowAddForm(false); setAddForm(EMPTY); }}
          isPending={addMutation.isPending}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
      ) : ferias.length === 0 ? (
        <div className="text-center py-6 text-sm text-gray-400">Nenhum período de férias registrado.</div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
          {ferias.map(f => (
            <div key={f.id}>
              {editingId === f.id ? (
                <div className="p-3">
                  <FormPanel
                    title="Editar período"
                    form={editForm} onChange={setEdit}
                    onSave={() => updateMutation.mutate()}
                    onCancel={cancelEdit}
                    isPending={updateMutation.isPending}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-3 bg-white">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">
                        {fmtDate(f.data_inicio)} → {fmtDate(f.data_fim)}
                      </span>
                      <span className="text-xs text-gray-400">{f.dias} dias</span>
                    </div>
                    <div className="mt-1">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[f.status]}`}>
                        {STATUS_OPTIONS.find(s => s.value === f.status)?.label ?? f.status}
                      </span>
                      {f.observacao && <span className="text-xs text-gray-400 ml-2">{f.observacao}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <button
                      type="button" onClick={() => startEdit(f)}
                      disabled={!!editingId || showAddForm}
                      className="text-gray-300 hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (confirm("Remover este período?")) deleteMutation.mutate(f.id); }}
                      disabled={!!editingId || showAddForm}
                      className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
