import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Loader2, ChevronDown, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  staffId: string;
  contractorId: string;
}

type OcorrenciaTipo = string;

type OcorrenciaStatus = "pendente" | "aprovado" | "reprovado";

interface OcorrenciaRecord {
  id: string;
  tipo: string;
  data_inicio: string;
  data_fim: string | null;
  descricao: string | null;
  status: OcorrenciaStatus;
  hora_chegada: string | null;
  hora_saida: string | null;
  atraso_segundos: number | null;
  created_at: string;
}

interface OcorrenciaForm {
  tipo: string;
  data_inicio: string;
  data_fim: string;
  descricao: string;
  status: string;
  hora_chegada: string;
  hora_saida: string;
}

const TIPOS_PADRAO = [
  { value: "falta",            label: "Falta" },
  { value: "falta_justificada",label: "Falta justificada" },
  { value: "atraso",           label: "Atraso" },
  { value: "dayoff",           label: "Day Off" },
  { value: "bonus_folga",      label: "Folga bônus" },
  { value: "licenca_medica",   label: "Licença médica" },
  { value: "licenca",          label: "Licença" },
  { value: "suspensao",        label: "Suspensão" },
];

const STATUS_OPTIONS = [
  { value: "aprovado",  label: "Aprovado" },
  { value: "pendente",  label: "Pendente" },
  { value: "reprovado", label: "Reprovado" },
];

const TIPO_BADGE_PADRAO: Record<string, string> = {
  falta:             "bg-red-100 text-red-700",
  falta_justificada: "bg-orange-100 text-orange-700",
  dayoff:            "bg-blue-100 text-blue-700",
  bonus_folga:       "bg-green-100 text-green-700",
  licenca_medica:    "bg-orange-100 text-orange-700",
  licenca:           "bg-indigo-100 text-indigo-700",
  suspensao:         "bg-gray-100 text-gray-600",
};

const STATUS_BADGE: Record<string, string> = {
  aprovado:  "bg-green-100 text-green-700",
  pendente:  "bg-yellow-100 text-yellow-700",
  reprovado: "bg-red-100 text-red-700",
};

const EMPTY: OcorrenciaForm = {
  tipo: "falta",
  data_inicio: "",
  data_fim: "",
  descricao: "",
  status: "aprovado",
  hora_chegada: "",
  hora_saida: "",
};

// Converte "HH:MM" ou "HH:MM:SS" em segundos
function timeToSeconds(t: string): number {
  if (!t) return 0;
  const parts = t.split(":").map(Number);
  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
}

// Formata segundos em HH:MM:SS
function secondsToHMS(s: number): string {
  if (s <= 0) return "00:00:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(v => String(v).padStart(2, "0")).join(":");
}

// Calcula atraso em segundos entre hora esperada (saida = horário previsto de entrada) e chegada real
function calcAtrasoSegundos(chegada: string, saida: string): number {
  if (!chegada || !saida) return 0;
  const s1 = timeToSeconds(saida);   // horário previsto
  const s2 = timeToSeconds(chegada); // chegada real
  return Math.max(0, s2 - s1);
}

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

function fmtDate(d: string | null) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function StaffOcorrenciasTab({ staffId, contractorId }: Props) {
  const qc = useQueryClient();
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState<OcorrenciaForm>(EMPTY);
  // Novo tipo customizado
  const [showNovoTipo, setShowNovoTipo] = useState(false);
  const [novoTipoLabel, setNovoTipoLabel] = useState("");
  const [savingTipo, setSavingTipo]     = useState(false);

  function set<K extends keyof OcorrenciaForm>(k: K, v: OcorrenciaForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  // Tipos customizados do contractor
  const { data: tiposCustom = [], refetch: refetchTipos } = useQuery({
    queryKey: ["ocorrencia-tipos", contractorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_config")
        .select("id, nome")
        .eq("contractor_id", contractorId)
        .eq("categoria", "ocorrencia_tipo")
        .eq("ativo", true)
        .order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  // Lista combinada: padrão + customizados
  const todosTipos = [
    ...TIPOS_PADRAO,
    ...tiposCustom.map(t => ({ value: `custom_${t.nome}`, label: t.nome })),
  ];

  function getTipoLabel(value: string) {
    return todosTipos.find(t => t.value === value)?.label ?? value;
  }
  function getTipoBadge(value: string) {
    return TIPO_BADGE_PADRAO[value] ?? "bg-violet-100 text-violet-700";
  }

  const { data: ocorrencias = [], isLoading } = useQuery({
    queryKey: ["staff-ocorrencias", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_ocorrencias")
        .select("*")
        .eq("staff_id", staffId)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as OcorrenciaRecord[];
    },
  });

  async function handleSalvarNovoTipo() {
    const label = novoTipoLabel.trim();
    if (!label) { toast.error("Informe o nome do tipo."); return; }
    const jaExiste = todosTipos.some(t => t.label.toLowerCase() === label.toLowerCase());
    if (jaExiste) { toast.error("Tipo já existe."); return; }
    setSavingTipo(true);
    const { error } = await supabase.from("crm_config").insert({
      contractor_id: contractorId,
      categoria: "ocorrencia_tipo",
      nome: label,
      ativo: true,
    });
    setSavingTipo(false);
    if (error) { toast.error("Erro ao salvar tipo."); return; }
    toast.success(`Tipo "${label}" adicionado.`);
    setNovoTipoLabel("");
    setShowNovoTipo(false);
    refetchTipos();
    // Selecionar o novo tipo automaticamente no form
    set("tipo", `custom_${label}`);
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.data_inicio) throw new Error("required");
      if (form.data_fim && form.data_fim < form.data_inicio) throw new Error("datas");
      const isAtraso = form.tipo === "atraso" || getTipoLabel(form.tipo).toLowerCase().includes("atraso");
      if (isAtraso && (!form.hora_saida || !form.hora_chegada)) throw new Error("horarios");
      const tipoFinal = form.tipo.startsWith("custom_")
        ? form.tipo.replace(/^custom_/, "")
        : form.tipo;
      const atrasoSeg = isAtraso
        ? calcAtrasoSegundos(form.hora_chegada, form.hora_saida)
        : null;
      const { error } = await supabase.from("staff_ocorrencias").insert([{
        staff_id: staffId,
        contractor_id: contractorId,
        tipo: tipoFinal as OcorrenciaTipo,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null,
        descricao: form.descricao.trim() || null,
        status: form.status as OcorrenciaStatus,
        hora_chegada: isAtraso ? form.hora_chegada || null : null,
        hora_saida:   isAtraso ? form.hora_saida   || null : null,
        atraso_segundos: atrasoSeg,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ocorrência registrada.");
      qc.invalidateQueries({ queryKey: ["staff-ocorrencias", staffId] });
      setForm(EMPTY);
      setShowForm(false);
    },
    onError: (err) => {
      const msg = (err as Error).message;
      if (msg === "required")  toast.error("Informe a data de início.");
      else if (msg === "datas") toast.error("Data de fim deve ser após o início.");
      else if (msg === "horarios") toast.error("Informe o horário previsto e o de chegada.");
      else toast.error("Erro ao registrar ocorrência.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_ocorrencias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ocorrência removida.");
      qc.invalidateQueries({ queryKey: ["staff-ocorrencias", staffId] });
    },
    onError: () => toast.error("Erro ao remover ocorrência."),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("staff_ocorrencias").update({ status: status as OcorrenciaStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado.");
      qc.invalidateQueries({ queryKey: ["staff-ocorrencias", staffId] });
    },
    onError: () => toast.error("Erro ao atualizar status."),
  });

  // Counters
  const countFaltas     = ocorrencias.filter(o => o.tipo === "falta" && o.status === "aprovado").length;
  const countFaltasJust = ocorrencias.filter(o => o.tipo === "falta_justificada" && o.status === "aprovado").length;
  const countDayoffs    = ocorrencias.filter(o => (o.tipo === "dayoff" || o.tipo === "bonus_folga") && o.status === "aprovado").length;
  const totalAtrasoSeg  = ocorrencias
    .filter(o => o.tipo === "atraso" && o.status === "aprovado" && o.atraso_segundos)
    .reduce((sum, o) => sum + (o.atraso_segundos ?? 0), 0);

  // Detecta se o tipo selecionado é "atraso" (padrão ou custom com label "atraso")
  const isAtrasoTipo = form.tipo === "atraso" ||
    getTipoLabel(form.tipo).toLowerCase().includes("atraso");

  // Para o form: atraso calculado em tempo real
  const atrasoPreviewSeg = isAtrasoTipo
    ? calcAtrasoSegundos(form.hora_chegada, form.hora_saida)
    : 0;

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{countFaltas}</p>
          <p className="text-xs text-gray-500 mt-0.5">Faltas</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-orange-500">{countFaltasJust}</p>
          <p className="text-xs text-gray-500 mt-0.5">Justificadas</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{countDayoffs}</p>
          <p className="text-xs text-gray-500 mt-0.5">Day offs / Folgas</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-yellow-600 font-mono">{secondsToHMS(totalAtrasoSeg)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total de atrasos</p>
        </div>
      </div>

      {/* Cabeçalho + botão */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Ocorrências</h4>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-primary font-semibold text-xs hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> REGISTRAR
          </button>
        )}
      </div>

      {/* Formulário inline */}
      {showForm && (
        <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-4">
          <p className="text-sm font-semibold text-gray-700">Nova ocorrência</p>

          {/* Tipo com botão "+" */}
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className={LBL}>Tipo *</label>
              <button
                type="button"
                onClick={() => setShowNovoTipo(v => !v)}
                title="Adicionar novo tipo"
                className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
              >
                <Plus className="w-3 h-3" /> novo tipo
              </button>
            </div>

            {/* Mini form novo tipo */}
            {showNovoTipo && (
              <div className="mb-3 flex items-center gap-2 bg-white border border-primary/30 rounded-lg px-3 py-2">
                <input
                  autoFocus
                  type="text"
                  value={novoTipoLabel}
                  onChange={e => setNovoTipoLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSalvarNovoTipo(); if (e.key === "Escape") setShowNovoTipo(false); }}
                  placeholder="Nome do novo tipo..."
                  className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={handleSalvarNovoTipo}
                  disabled={savingTipo}
                  className="text-xs font-bold text-white bg-primary px-2.5 py-1 rounded-md hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1"
                >
                  {savingTipo ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  SALVAR
                </button>
                <button type="button" onClick={() => { setShowNovoTipo(false); setNovoTipoLabel(""); }}
                  className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="relative">
              <select className={SEL} value={form.tipo} onChange={e => set("tipo", e.target.value)}>
                <optgroup label="Tipos padrão">
                  {TIPOS_PADRAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </optgroup>
                {tiposCustom.length > 0 && (
                  <optgroup label="Tipos personalizados">
                    {tiposCustom.map(t => (
                      <option key={t.id} value={`custom_${t.nome}`}>{t.nome}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LBL}>Data de início *</label>
              <input type="date" className={INP} value={form.data_inicio} onChange={e => set("data_inicio", e.target.value)} />
            </div>
            <div>
              <label className={LBL}>Data de fim (se multi-dia)</label>
              <input type="date" className={INP} value={form.data_fim} onChange={e => set("data_fim", e.target.value)} />
            </div>
          </div>

          {/* Campos de atraso — só para tipo "atraso" */}
          {isAtrasoTipo && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-yellow-700">Horário do atraso</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LBL}>Horário previsto *</label>
                  <input type="time" step="1" className={INP} value={form.hora_saida}
                    onChange={e => set("hora_saida", e.target.value)} />
                  <p className="text-xs text-gray-400 mt-0.5">Hora que deveria chegar</p>
                </div>
                <div>
                  <label className={LBL}>Horário de chegada *</label>
                  <input type="time" step="1" className={INP} value={form.hora_chegada}
                    onChange={e => set("hora_chegada", e.target.value)} />
                  <p className="text-xs text-gray-400 mt-0.5">Hora que chegou de fato</p>
                </div>
              </div>
              {atrasoPreviewSeg > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-yellow-700">Atraso calculado:</span>
                  <span className="font-mono font-bold text-yellow-800 text-sm">{secondsToHMS(atrasoPreviewSeg)}</span>
                </div>
              )}
              {form.hora_chegada && form.hora_saida && atrasoPreviewSeg === 0 && (
                <p className="text-xs text-green-600">✓ Sem atraso (chegou antes ou no horário)</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
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
              <label className={LBL}>Descrição</label>
              <input className={INP} placeholder="Opcional" value={form.descricao} onChange={e => set("descricao", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY); setShowNovoTipo(false); }}
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
      ) : ocorrencias.length === 0 ? (
        <div className="text-center py-8">
          <AlertCircle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Nenhuma ocorrência registrada.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
          {ocorrencias.map(o => (
            <div key={o.id} className="flex items-center justify-between px-4 py-3 bg-white">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getTipoBadge(o.tipo)}`}>
                    {getTipoLabel(o.tipo)}
                  </span>
                  <span className="text-sm text-gray-700">
                    {fmtDate(o.data_inicio)}
                    {o.data_fim && o.data_fim !== o.data_inicio ? ` → ${fmtDate(o.data_fim)}` : ""}
                  </span>
                  {o.tipo === "atraso" && o.hora_saida && o.hora_chegada && (
                    <span className="text-xs text-yellow-700 font-mono bg-yellow-50 px-1.5 py-0.5 rounded">
                      {o.hora_saida.slice(0,5)} → {o.hora_chegada.slice(0,5)}
                      {o.atraso_segundos ? ` · ${secondsToHMS(o.atraso_segundos)}` : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={o.status}
                    onChange={e => updateStatusMutation.mutate({ id: o.id, status: e.target.value })}
                    className={`text-xs font-medium px-1.5 py-0.5 rounded border-0 outline-none cursor-pointer ${STATUS_BADGE[o.status]}`}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  {o.descricao && <span className="text-xs text-gray-400 truncate">{o.descricao}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { if (confirm("Remover esta ocorrência?")) deleteMutation.mutate(o.id); }}
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
