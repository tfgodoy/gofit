import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Plus, Search, Trash2, ChevronUp, ChevronDown,
  MoreVertical, GripVertical, Loader2, X,
  Pencil, Copy, Printer, RefreshCcw, ArrowLeftRight, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/app/AppLayout";
import { toast } from "sonner";
import { toTitleCase } from "@/lib/text";

/* ─── Types ──────────────────────────────────────────────────── */

type TipoMetrica = "repeticoes" | "minutos" | "segundos" | "livre";

type Serie = { valor: string; carga_kg: string };

type ExerciseRow = {
  _key:          string;
  id:            string | null;
  exercise_id:   string | null;
  exercise_nome: string;
  series:        number;
  tipo_metrica:  TipoMetrica;
  intervalo_seg: number | null;
  observacao:    string;
  bi_set_grupo:  number | null;
  seriesData:    Serie[];
};

type WorkoutSession = {
  _key:      string;
  id:        string | null;
  nome:      string;
  ordem:     number;
  exercises: ExerciseRow[];
};

type WorkoutForm = {
  nome:                     string;
  responsavel_nome:         string;
  tipo_treino:              string;
  nivel:                    string;
  sexo:                     string;
  frequencia_semanal:       number;
  idade_minima:             string;
  idade_maxima:             string;
  imprimir_automaticamente: boolean;
  controla_treino:          boolean;
  tipo_controle:            string;
  quantidade:               string;
  data_vencimento:          string;
  observacoes:              string;
};

type ExerciseSuggestion = { id: string; nome: string; grupo?: string };

/* ─── Constants ─────────────────────────────────────────────── */

const TIPOS_TREINO = [
  "musculacao", "funcional", "aerobico", "hiit", "yoga",
  "pilates", "emagrecimento", "outro",
];

const TIPO_LABELS: Record<string, string> = {
  musculacao: "Musculação", funcional: "Funcional", aerobico: "Aeróbico",
  hiit: "HIIT", yoga: "Yoga", pilates: "Pilates",
  emagrecimento: "Emagrecimento", outro: "Outro",
};

const NIVEIS = ["iniciante", "intermediario", "avancado"];
const NIVEL_LABELS: Record<string, string> = {
  iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado",
};

const METRICA_LABELS: Record<TipoMetrica, string> = {
  repeticoes: "Repetições", minutos: "Minutos", segundos: "Segundos", livre: "Livre",
};

const METRICA_ORDER: TipoMetrica[] = ["repeticoes", "segundos", "minutos", "livre"];

function nextMetrica(current: TipoMetrica): TipoMetrica {
  const idx = METRICA_ORDER.indexOf(current);
  return METRICA_ORDER[(idx + 1) % METRICA_ORDER.length];
}

function buildSeries(count: number, prev: Serie[]): Serie[] {
  return Array.from({ length: count }, (_, i) => prev[i] ?? { valor: "", carga_kg: "" });
}

function uid() { return Math.random().toString(36).slice(2); }

const DEFAULT_FORM: WorkoutForm = {
  nome: "", responsavel_nome: "", tipo_treino: "musculacao", nivel: "",
  sexo: "", frequencia_semanal: 3, idade_minima: "", idade_maxima: "",
  imprimir_automaticamente: false, controla_treino: false,
  tipo_controle: "", quantidade: "", data_vencimento: "", observacoes: "",
};

/* ─── Toggle Switch ──────────────────────────────────────────── */

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative flex-shrink-0 inline-flex h-5 w-9 rounded-full transition-colors focus:outline-none ${
        checked ? "bg-blue-500" : "bg-gray-300"
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-4" : "translate-x-0"
      }`} />
    </button>
  );
}

/* ─── Component ─────────────────────────────────────────────── */

export default function TreinoFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "novo";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get("student_id");
  const backUrl   = searchParams.get("back") ?? "/app/treinos/treinos";
  const { user } = useAuth();

  const [prescricaoOpen, setPrescricaoOpen] = useState(true);
  const [form, setForm] = useState<WorkoutForm>(DEFAULT_FORM);
  const [sessions, setSessions] = useState<WorkoutSession[]>([
    { _key: uid(), id: null, nome: "SESSÃO A", ordem: 0, exercises: [] },
  ]);
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [exerciseModal, setExerciseModal] = useState<{
    sessionKey: string;
    exerciseKey: string | null;
    initial?: ExerciseRow;
  } | null>(null);
  const [importModal, setImportModal] = useState<string | null>(null); // sessionKey when open
  const [renamingTab, setRenamingTab] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workoutId = useRef<string | null>(isNew ? null : (id ?? null));

  /* Load existing workout */
  useEffect(() => {
    if (isNew || !id) return;
    (async () => {
      const { data: w } = await supabase
        .from("workouts").select("*").eq("id", id).single();
      if (!w) return;
      setForm({
        nome: w.nome,
        responsavel_nome: w.responsavel_nome ?? "",
        tipo_treino: w.tipo_treino,
        nivel: w.nivel ?? "",
        sexo: w.sexo ?? "",
        frequencia_semanal: w.frequencia_semanal,
        idade_minima: w.idade_minima != null ? String(w.idade_minima) : "",
        idade_maxima: w.idade_maxima != null ? String(w.idade_maxima) : "",
        imprimir_automaticamente: w.imprimir_automaticamente,
        controla_treino: w.controla_treino,
        tipo_controle: w.tipo_controle ?? "",
        quantidade: w.quantidade != null ? String(w.quantidade) : "",
        data_vencimento: w.data_vencimento ?? "",
        observacoes: w.observacoes ?? "",
      });

      const { data: wss } = await supabase
        .from("workout_sessions").select("*").eq("workout_id", id).order("ordem");

      if (!wss?.length) return;
      const sessionsBuilt: WorkoutSession[] = [];
      for (const ws of wss) {
        const { data: exs } = await supabase
          .from("workout_session_exercises").select("*").eq("session_id", ws.id).order("ordem");
        const exercises: ExerciseRow[] = [];
        for (const ex of exs ?? []) {
          const { data: series } = await supabase
            .from("workout_session_exercise_series")
            .select("*").eq("exercise_sessao_id", ex.id).order("numero_serie");
          exercises.push({
            _key: uid(), id: ex.id, exercise_id: ex.exercise_id,
            exercise_nome: ex.exercise_nome, series: ex.series,
            tipo_metrica: ex.tipo_metrica as TipoMetrica,
            intervalo_seg: ex.intervalo_seg, observacao: ex.observacao ?? "",
            bi_set_grupo: ex.bi_set_grupo,
            seriesData: (series ?? []).map(s => ({
              valor: s.valor,
              carga_kg: s.carga_kg != null ? String(s.carga_kg) : "",
            })),
          });
        }
        sessionsBuilt.push({ _key: uid(), id: ws.id, nome: ws.nome, ordem: ws.ordem, exercises });
      }
      setSessions(sessionsBuilt);
    })();
  }, [id, isNew]);

  /* Auto-save — triggers for both new and existing workouts whenever nome is filled */
  const triggerSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistAll(), 1200);
    setSaveStatus("saving");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (form.nome.trim()) triggerSave(); }, [form, sessions]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Focus rename input */
  useEffect(() => {
    if (renamingTab && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renamingTab]);

  /* ── persistAll ── */
  async function persistAll(): Promise<boolean> {
    if (!user?.contractorId) { toast.error("Sessão inválida. Faça login novamente."); return false; }
    if (!form.nome.trim()) return false;
    setSaving(true);
    try {
      const payload = {
        contractor_id: user.contractorId,
        student_id: studentId || null,
        nome: form.nome.trim(),
        responsavel_nome: form.responsavel_nome || null,
        tipo_treino: form.tipo_treino,
        nivel: form.nivel || null,
        sexo: form.sexo || null,
        frequencia_semanal: form.frequencia_semanal,
        idade_minima: form.idade_minima ? Number(form.idade_minima) : null,
        idade_maxima: form.idade_maxima ? Number(form.idade_maxima) : null,
        imprimir_automaticamente: form.imprimir_automaticamente,
        controla_treino: form.controla_treino,
        tipo_controle: form.tipo_controle || null,
        quantidade: form.quantidade ? Number(form.quantidade) : null,
        data_vencimento: form.data_vencimento || null,
        observacoes: form.observacoes || null,
        status: studentId ? "ativo" : "rascunho",
        updated_at: new Date().toISOString(),
      };

      let wid = workoutId.current;
      if (!wid) {
        const { data, error } = await supabase.from("workouts").insert(payload).select("id").single();
        if (error || !data) {
          toast.error("Erro ao salvar treino: " + (error?.message ?? "tente novamente"));
          setSaving(false);
          return false;
        }
        wid = data.id;
        workoutId.current = wid;
      } else {
        const { error } = await supabase.from("workouts").update(payload).eq("id", wid);
        if (error) {
          toast.error("Erro ao atualizar treino: " + error.message);
          setSaving(false);
          return false;
        }
      }

      for (let si = 0; si < sessions.length; si++) {
        const s = sessions[si];
        let sid = s.id;
        if (!sid) {
          const { data } = await supabase
            .from("workout_sessions")
            .insert({ workout_id: wid!, nome: s.nome, ordem: si })
            .select("id").single();
          sid = data?.id ?? null;
          setSessions(prev => prev.map(p => p._key === s._key ? { ...p, id: sid } : p));
        } else {
          await supabase.from("workout_sessions").update({ nome: s.nome, ordem: si }).eq("id", sid);
        }
        if (!sid) continue;

        const keepIds = s.exercises.filter(e => e.id).map(e => e.id!);
        if (keepIds.length) {
          await supabase.from("workout_session_exercises").delete()
            .eq("session_id", sid)
            .not("id", "in", `(${keepIds.map(k => `'${k}'`).join(",")})`);
        } else {
          await supabase.from("workout_session_exercises").delete().eq("session_id", sid);
        }

        for (let ei = 0; ei < s.exercises.length; ei++) {
          const ex = s.exercises[ei];
          const exPayload = {
            session_id: sid, exercise_id: ex.exercise_id,
            exercise_nome: ex.exercise_nome, ordem: ei, series: ex.series,
            tipo_metrica: ex.tipo_metrica, intervalo_seg: ex.intervalo_seg,
            observacao: ex.observacao || null, bi_set_grupo: ex.bi_set_grupo,
          };

          let eid = ex.id;
          if (!eid) {
            const { data } = await supabase
              .from("workout_session_exercises").insert(exPayload).select("id").single();
            eid = data?.id ?? null;
            setSessions(prev => prev.map(ps => ps._key === s._key ? {
              ...ps,
              exercises: ps.exercises.map(pe => pe._key === ex._key ? { ...pe, id: eid } : pe),
            } : ps));
          } else {
            await supabase.from("workout_session_exercises").update(exPayload).eq("id", eid);
          }
          if (!eid) continue;

          await supabase.from("workout_session_exercise_series").delete().eq("exercise_sessao_id", eid);
          if (ex.seriesData.length) {
            await supabase.from("workout_session_exercise_series").insert(
              ex.seriesData.map((s, i) => ({
                exercise_sessao_id: eid!,
                numero_serie: i + 1,
                valor: s.valor,
                carga_kg: s.carga_kg ? Number(s.carga_kg) : null,
              }))
            );
          }
        }
      }

      setSaving(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      toast.error("Erro ao salvar: " + msg);
      setSaving(false);
      setSaveStatus("idle");
      return false;
    }
  }

  async function handleSaveNew() {
    if (!form.nome.trim()) { toast.error("Informe o nome do treino"); return; }
    const ok = await persistAll();
    if (ok) navigate(backUrl, { replace: true });
  }

  /* ── Session helpers ── */
  function addSession() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const nome = `SESSÃO ${letters[sessions.length] ?? sessions.length + 1}`;
    setSessions(prev => [...prev, { _key: uid(), id: null, nome, ordem: prev.length, exercises: [] }]);
    setActiveTab(sessions.length);
  }

  function removeSession(key: string) {
    setSessions(prev => prev.filter(s => s._key !== key));
    setActiveTab(t => Math.max(0, t - 1));
  }

  function duplicateSession(s: WorkoutSession) {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const nome = `SESSÃO ${letters[sessions.length] ?? sessions.length + 1}`;
    const newSession: WorkoutSession = {
      _key: uid(), id: null, nome, ordem: sessions.length,
      exercises: s.exercises.map(ex => ({
        ...ex, _key: uid(), id: null,
        seriesData: ex.seriesData.map(sd => ({ ...sd })),
      })),
    };
    setSessions(prev => [...prev, newSession]);
    setActiveTab(sessions.length);
  }

  function updateSessionNome(key: string, nome: string) {
    setSessions(prev => prev.map(s => s._key === key ? { ...s, nome } : s));
  }

  /* ── Exercise helpers ── */
  function moveExercise(sessionKey: string, idx: number, dir: -1 | 1) {
    setSessions(prev => prev.map(s => {
      if (s._key !== sessionKey) return s;
      const arr = [...s.exercises];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return s;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...s, exercises: arr };
    }));
  }

  function removeExercise(sessionKey: string, exKey: string) {
    setSessions(prev => prev.map(s =>
      s._key === sessionKey
        ? { ...s, exercises: s.exercises.filter(e => e._key !== exKey) }
        : s
    ));
  }

  function updateExField<K extends keyof ExerciseRow>(
    sessionKey: string, exKey: string, field: K, val: ExerciseRow[K]
  ) {
    setSessions(prev => prev.map(s => {
      if (s._key !== sessionKey) return s;
      return {
        ...s,
        exercises: s.exercises.map(e => {
          if (e._key !== exKey) return e;
          const updated = { ...e, [field]: val };
          if (field === "series") updated.seriesData = buildSeries(val as number, e.seriesData);
          return updated;
        }),
      };
    }));
  }

  function updateAllSeriesValor(sessionKey: string, exKey: string, valor: string) {
    setSessions(prev => prev.map(s => {
      if (s._key !== sessionKey) return s;
      return {
        ...s,
        exercises: s.exercises.map(e => {
          if (e._key !== exKey) return e;
          return { ...e, seriesData: e.seriesData.map(sd => ({ ...sd, valor })) };
        }),
      };
    }));
  }

  function updateAllSeriesCarga(sessionKey: string, exKey: string, carga_kg: string) {
    setSessions(prev => prev.map(s => {
      if (s._key !== sessionKey) return s;
      return {
        ...s,
        exercises: s.exercises.map(e => {
          if (e._key !== exKey) return e;
          return { ...e, seriesData: e.seriesData.map(sd => ({ ...sd, carga_kg })) };
        }),
      };
    }));
  }

  function toggleBiSet(sessionKey: string, exKey: string, currentGroup: number | null, exercises: ExerciseRow[]) {
    if (currentGroup != null) {
      updateExField(sessionKey, exKey, "bi_set_grupo", null);
    } else {
      const maxGroup = exercises.reduce((m, e) => e.bi_set_grupo != null ? Math.max(m, e.bi_set_grupo) : m, -1);
      updateExField(sessionKey, exKey, "bi_set_grupo", maxGroup + 1);
    }
  }

  const f = (k: keyof WorkoutForm, v: WorkoutForm[keyof WorkoutForm]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const currentSession = sessions[activeTab];

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen bg-gray-100 pb-16">
        {/* Title */}
        <div className="bg-white border-b border-gray-200 py-3 text-center">
          <h1 className="text-base font-semibold text-red-500">
            {isNew ? "Novo treino" : "Editar treino"}
          </h1>
        </div>

        <div className="max-w-5xl mx-auto w-full px-4 py-4 space-y-3">

          {/* ── Dados da Prescrição ── */}
          <div className="bg-white rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => setPrescricaoOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-sm font-semibold text-gray-700">Dados da prescrição</span>
              {prescricaoOpen
                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {prescricaoOpen && (
              <div className="px-4 pb-5 border-t border-gray-100 pt-4 space-y-4">
                {/* Nome + Responsável */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nome *</label>
                    <input
                      value={form.nome}
                      onChange={e => f("nome", e.target.value)}
                      onBlur={e => f("nome", toTitleCase(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                      placeholder="Nome do treino"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                      Responsável
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-400 text-white text-[9px] font-bold cursor-help leading-none">?</span>
                    </label>
                    <div className="relative">
                      <input
                        value={form.responsavel_nome}
                        onChange={e => f("responsavel_nome", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white pr-8"
                        placeholder="Nome do responsável"
                      />
                      {form.responsavel_nome && (
                        <button
                          onClick={() => f("responsavel_nome", "")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tipo + Nível + Sexo */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tipo de treino *</label>
                    <select value={form.tipo_treino} onChange={e => f("tipo_treino", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                      {TIPOS_TREINO.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nível</label>
                    <select value={form.nivel} onChange={e => f("nivel", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                      <option value="">Selecione</option>
                      {NIVEIS.map(n => <option key={n} value={n}>{NIVEL_LABELS[n]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Sexo</label>
                    <select value={form.sexo} onChange={e => f("sexo", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                      <option value="">Ambos</option>
                      <option value="masculino">Masculino</option>
                      <option value="feminino">Feminino</option>
                    </select>
                  </div>
                </div>

                {/* Frequência + Idades */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Frequência semanal *</label>
                    <input
                      type="number" min={1} max={7}
                      value={form.frequencia_semanal}
                      onChange={e => f("frequencia_semanal", Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Idade mínima</label>
                    <input type="number" min={0} value={form.idade_minima}
                      onChange={e => f("idade_minima", e.target.value)}
                      placeholder="—" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Idade máxima</label>
                    <input type="number" min={0} value={form.idade_maxima}
                      onChange={e => f("idade_maxima", e.target.value)}
                      placeholder="—" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white" />
                  </div>
                </div>

                {/* Imprimir automaticamente */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <Toggle
                    checked={form.imprimir_automaticamente}
                    onChange={v => f("imprimir_automaticamente", v)}
                  />
                  <span className="text-sm text-gray-700">Imprimir automaticamente</span>
                </label>

                {/* Controla treino */}
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <Toggle
                      checked={form.controla_treino}
                      onChange={v => f("controla_treino", v)}
                    />
                    <span className="text-sm text-gray-700">Controla treino</span>
                  </label>
                  {form.controla_treino && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Tipo de controle</label>
                        <select value={form.tipo_controle} onChange={e => f("tipo_controle", e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white w-36">
                          <option value="">Selecione</option>
                          <option value="quantidade">Quantidade</option>
                          <option value="data">Data</option>
                        </select>
                      </div>
                      {form.tipo_controle === "quantidade" && (
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Quantidade *</label>
                          <input type="number" min={1} value={form.quantidade}
                            onChange={e => f("quantidade", e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white w-24" />
                        </div>
                      )}
                      {form.tipo_controle === "data" && (
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Data de vencimento</label>
                          <input type="date" value={form.data_vencimento}
                            onChange={e => f("data_vencimento", e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white w-44" />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Observações */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Observações</label>
                  <textarea
                    value={form.observacoes}
                    onChange={e => f("observacoes", e.target.value)}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white resize-none"
                    placeholder="Observações do treino"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Sessões do treino ── */}
          <div className="bg-white rounded-lg border border-gray-200">
            {/* Section header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">Sessões do treino</span>
              <div className="flex items-center gap-4 text-xs font-medium text-primary">
                <button className="flex items-center gap-1 hover:opacity-75">
                  <ArrowLeftRight className="w-3.5 h-3.5" /> Reordenar
                </button>
                <button className="flex items-center gap-1 hover:opacity-75">
                  <Printer className="w-3.5 h-3.5" /> Imprimir
                </button>
              </div>
            </div>

            {/* Session tabs */}
            <div className="flex items-center border-b border-gray-100 px-4 overflow-x-auto">
              {sessions.map((s, i) => (
                <button
                  key={s._key}
                  onClick={() => { setActiveTab(i); setRenamingTab(false); }}
                  className={`flex-shrink-0 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    i === activeTab
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {s.nome}
                </button>
              ))}
              <button
                onClick={addSession}
                className="flex-shrink-0 px-3 py-2.5 text-xs text-gray-400 hover:text-primary flex items-center gap-1 whitespace-nowrap"
              >
                <Plus className="w-3 h-3" /> SESSÃO
              </button>
            </div>

            {/* Session toolbar */}
            {currentSession && (
              <>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExerciseModal({ sessionKey: currentSession._key, exerciseKey: null })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded hover:bg-green-600"
                    >
                      <Plus className="w-3.5 h-3.5" /> EXERCÍCIO
                    </button>
                    <button
                      onClick={() => setImportModal(currentSession._key)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-green-500 text-green-600 text-xs font-bold rounded hover:bg-green-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> IMPORTAR SESSÃO BASE
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-medium">
                    <button
                      onClick={() => setRenamingTab(true)}
                      className="flex items-center gap-1 text-primary hover:opacity-75"
                    >
                      <Pencil className="w-3 h-3" /> Renomear
                    </button>
                    <button
                      onClick={() => duplicateSession(currentSession)}
                      className="flex items-center gap-1 text-primary hover:opacity-75"
                    >
                      <Copy className="w-3 h-3" /> Duplicar
                    </button>
                    {sessions.length > 1 && (
                      <button
                        onClick={() => removeSession(currentSession._key)}
                        className="flex items-center gap-1 text-red-500 hover:opacity-75"
                      >
                        <Trash2 className="w-3 h-3" /> Remover
                      </button>
                    )}
                  </div>
                </div>

                {/* Rename dialog */}
                {renamingTab && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs text-gray-500">Nome da sessão:</span>
                    <input
                      ref={renameRef}
                      value={currentSession.nome}
                      onChange={e => updateSessionNome(currentSession._key, e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setRenamingTab(false); }}
                      className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button onClick={() => setRenamingTab(false)}
                      className="text-xs text-primary font-medium hover:opacity-75">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Exercise rows */}
                <div className="p-4 space-y-1.5">
                  {currentSession.exercises.length === 0 && (
                    <div className="text-center py-12 text-gray-300 text-sm">
                      Nenhum exercício nesta sessão
                    </div>
                  )}

                  {currentSession.exercises.map((ex, idx) => {
                    const exs = currentSession.exercises;
                    const isBiSet = ex.bi_set_grupo != null;
                    const isFirstInGroup = isBiSet && (idx === 0 || exs[idx - 1].bi_set_grupo !== ex.bi_set_grupo);
                    const isLastInGroup = isBiSet && (idx === exs.length - 1 || exs[idx + 1].bi_set_grupo !== ex.bi_set_grupo);

                    return (
                      <div key={ex._key} className="flex gap-0">
                        {/* Bi-set bar */}
                        {isBiSet ? (
                          <div className="flex-shrink-0 w-6 flex items-stretch mr-1">
                            <div
                              className={`w-full bg-purple-600 flex items-center justify-center ${
                                isFirstInGroup ? "rounded-t" : ""
                              } ${isLastInGroup ? "rounded-b" : ""}`}
                              style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                            >
                              <span className="text-white text-[9px] font-bold tracking-widest"
                                style={{ transform: "rotate(180deg)" }}>
                                Bi-set
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="w-7 flex-shrink-0" />
                        )}

                        {/* Exercise card */}
                        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded px-2 py-2 min-w-0">
                          {/* Up/Grip/Down */}
                          <div className="flex flex-col items-center flex-shrink-0 gap-0">
                            <button
                              onClick={() => moveExercise(currentSession._key, idx, -1)}
                              disabled={idx === 0}
                              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab" />
                            <button
                              onClick={() => moveExercise(currentSession._key, idx, 1)}
                              disabled={idx === exs.length - 1}
                              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Exercício */}
                          <div className="flex-1 min-w-[120px]">
                            <label className="block text-[10px] text-gray-400 mb-0.5 leading-none whitespace-nowrap">Exercício *</label>
                            <div className="relative">
                              <input
                                value={ex.exercise_nome}
                                onChange={e => updateExField(currentSession._key, ex._key, "exercise_nome", e.target.value)}
                                className="w-full text-xs border-b border-gray-300 focus:outline-none focus:border-primary pb-0.5 pr-5 bg-transparent"
                              />
                              <button
                                onClick={() => updateExField(currentSession._key, ex._key, "exercise_nome", "")}
                                className="absolute right-0 top-0 text-gray-300 hover:text-gray-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Séries */}
                          <div className="flex-shrink-0 w-11">
                            <label className="block text-[10px] text-gray-400 mb-0.5 leading-none whitespace-nowrap">Séries *</label>
                            <input
                              type="number" min={1}
                              value={ex.series}
                              onChange={e => updateExField(currentSession._key, ex._key, "series", Math.max(1, Number(e.target.value)))}
                              className="w-full text-xs border-b border-gray-300 focus:outline-none focus:border-primary pb-0.5 text-center bg-transparent"
                            />
                          </div>

                          {/* Cycle metric icon */}
                          <button
                            onClick={() => updateExField(currentSession._key, ex._key, "tipo_metrica", nextMetrica(ex.tipo_metrica))}
                            className="flex-shrink-0 text-gray-400 hover:text-primary mt-3"
                            title={`Métrica: ${METRICA_LABELS[ex.tipo_metrica]}`}
                          >
                            <RefreshCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* Valor ou Descrição livre */}
                          {ex.tipo_metrica === "livre" ? (
                            <div className="flex-1 min-w-[160px]">
                              <label className="block text-[10px] text-gray-400 mb-0.5 leading-none whitespace-nowrap">Descrição livre</label>
                              <input
                                value={ex.seriesData[0]?.valor ?? ""}
                                onChange={e => updateAllSeriesValor(currentSession._key, ex._key, e.target.value)}
                                placeholder="Descreva livremente..."
                                className="w-full text-xs border-b border-gray-300 focus:outline-none focus:border-primary pb-0.5 bg-transparent"
                              />
                            </div>
                          ) : (
                            <>
                              <div className="flex-shrink-0 w-16">
                                <label className="block text-[10px] text-gray-400 mb-0.5 leading-none whitespace-nowrap">{METRICA_LABELS[ex.tipo_metrica]}</label>
                                <input
                                  value={ex.seriesData[0]?.valor ?? ""}
                                  onChange={e => updateAllSeriesValor(currentSession._key, ex._key, e.target.value)}
                                  placeholder="—"
                                  className="w-full text-xs border-b border-gray-300 focus:outline-none focus:border-primary pb-0.5 text-center bg-transparent"
                                />
                              </div>

                              {/* Carga */}
                              <div className="flex-shrink-0 w-16">
                                <label className="block text-[10px] text-gray-400 mb-0.5 leading-none whitespace-nowrap">Carga(Kg)</label>
                                <input
                                  value={ex.seriesData[0]?.carga_kg ?? ""}
                                  onChange={e => updateAllSeriesCarga(currentSession._key, ex._key, e.target.value)}
                                  placeholder="Carga(Kg)"
                                  type="number" min={0} step={0.5}
                                  className="w-full text-xs border-b border-gray-300 focus:outline-none focus:border-primary pb-0.5 text-center bg-transparent"
                                />
                              </div>

                              {/* Intervalo */}
                              <div className="flex-shrink-0 w-14">
                                <label className="block text-[10px] text-gray-400 mb-0.5 leading-none whitespace-nowrap">Intervalo</label>
                                <input
                                  type="number" min={0}
                                  value={ex.intervalo_seg ?? ""}
                                  onChange={e => updateExField(currentSession._key, ex._key, "intervalo_seg", e.target.value ? Number(e.target.value) : null)}
                                  placeholder="—"
                                  className="w-full text-xs border-b border-gray-300 focus:outline-none focus:border-primary pb-0.5 text-center bg-transparent"
                                />
                              </div>
                            </>
                          )}

                          {/* Observação */}
                          <div className="flex-1 min-w-[80px]">
                            <label className="block text-[10px] text-gray-400 mb-0.5 leading-none whitespace-nowrap">Observação</label>
                            <input
                              value={ex.observacao}
                              onChange={e => updateExField(currentSession._key, ex._key, "observacao", e.target.value)}
                              placeholder="Observação"
                              className="w-full text-xs border-b border-gray-300 focus:outline-none focus:border-primary pb-0.5 bg-transparent"
                            />
                          </div>

                          {/* Edit */}
                          <button
                            onClick={() => setExerciseModal({ sessionKey: currentSession._key, exerciseKey: ex._key, initial: ex })}
                            className="flex-shrink-0 p-1 text-primary hover:opacity-75 mt-3"
                            title="Editar exercício"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* 3-dot menu */}
                          <ExerciseMenu
                            ex={ex}
                            idx={idx}
                            total={exs.length}
                            sessionKey={currentSession._key}
                            exercises={exs}
                            onMoveUp={() => moveExercise(currentSession._key, idx, -1)}
                            onMoveDown={() => moveExercise(currentSession._key, idx, 1)}
                            onRemove={() => removeExercise(currentSession._key, ex._key)}
                            onToggleBiSet={() => toggleBiSet(currentSession._key, ex._key, ex.bi_set_grupo, exs)}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Add exercise bottom */}
                  <button
                    onClick={() => setExerciseModal({ sessionKey: currentSession._key, exerciseKey: null })}
                    className="w-full py-2.5 mt-1 border-2 border-dashed border-gray-200 rounded text-xs text-gray-400 hover:border-green-400 hover:text-green-500 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> EXERCÍCIO
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Fixed footer */}
      <div className="fixed bottom-0 left-56 right-0 bg-white border-t border-gray-200 flex items-center justify-end gap-3 px-6 py-3 z-20">
        {saveStatus === "saving" && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400 mr-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="flex items-center gap-1.5 text-xs text-green-600 mr-2">
            <Check className="w-3.5 h-3.5" /> Salvo
          </span>
        )}
        <button
          onClick={() => navigate(backUrl)}
          className="px-6 py-2 text-sm font-semibold text-gray-600 rounded border border-gray-300 hover:bg-gray-50"
        >
          VOLTAR
        </button>
        <button
          onClick={isNew ? handleSaveNew : () => { persistAll(); }}
          disabled={saving}
          className="px-6 py-2 text-sm font-semibold text-white bg-green-500 rounded hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          SALVAR
        </button>
      </div>

      {/* Import session base modal */}
      {importModal && (
        <ImportSessionModal
          contractorId={user?.contractorId ?? ""}
          onClose={() => setImportModal(null)}
          onImport={(rows) => {
            setSessions(prev => prev.map(s =>
              s._key === importModal
                ? { ...s, exercises: [...s.exercises, ...rows] }
                : s
            ));
            setImportModal(null);
          }}
        />
      )}

      {/* Exercise modal */}
      {exerciseModal && (
        <ExerciseModal
          contractorId={user?.contractorId ?? ""}
          initial={exerciseModal.initial}
          onClose={() => setExerciseModal(null)}
          onSave={(ex) => {
            const sKey = exerciseModal.sessionKey;
            if (exerciseModal.exerciseKey) {
              setSessions(prev => prev.map(s =>
                s._key === sKey
                  ? { ...s, exercises: s.exercises.map(e => e._key === exerciseModal.exerciseKey ? ex : e) }
                  : s
              ));
            } else {
              setSessions(prev => prev.map(s =>
                s._key === sKey ? { ...s, exercises: [...s.exercises, ex] } : s
              ));
            }
            setExerciseModal(null);
          }}
        />
      )}

      <style>{`
        * { box-sizing: border-box; }
      `}</style>
    </AppLayout>
  );
}

/* ─── Exercise Menu (3-dot) ──────────────────────────────────── */

/* ─── Import Session Base Modal ──────────────────────────────── */

function ImportSessionModal({ contractorId, onClose, onImport }: {
  contractorId: string;
  onClose: () => void;
  onImport: (exercises: ExerciseRow[]) => void;
}) {
  const [baseSessions, setBaseSessions] = useState<{ id: string; nome: string; exercise_count: number }[]>([]);
  const [selected, setSelected]   = useState<string | null>(null);
  const [loading,  setLoading]    = useState(true);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    supabase
      .from("sessions")
      .select("id, nome, session_exercises(id)")
      .eq("contractor_id", contractorId)
      .order("nome")
      .then(({ data }) => {
        setBaseSessions(((data ?? []) as any[]).map(s => ({
          id:             s.id,
          nome:           s.nome,
          exercise_count: (s.session_exercises ?? []).length,
        })));
        setLoading(false);
      });
  }, [contractorId]);

  async function handleImport() {
    if (!selected) return;
    setImporting(true);
    const { data } = await supabase
      .from("session_exercises")
      .select("*")
      .eq("session_id", selected)
      .order("ordem");

    const rows: ExerciseRow[] = ((data ?? []) as any[]).map(e => {
      const sd: any[] = Array.isArray(e.series_data) ? e.series_data : [];
      const tipo = e.tipo as TipoMetrica;
      const seriesCount = sd.length || 3;

      const seriesData: Serie[] = sd.length > 0
        ? sd.map(s => ({
            valor:    tipo === "repeticoes" ? (s.repeticoes ?? "") : (s.duracao ?? ""),
            carga_kg: s.carga ?? "",
          }))
        : Array.from({ length: seriesCount }, () => ({ valor: "", carga_kg: "" }));

      let intervalo_seg: number | null = null;
      if (sd[0]?.descanso) {
        const raw = String(sd[0].descanso).replace(/[^0-9]/g, "");
        if (raw) intervalo_seg = Number(raw);
      }

      return {
        _key:          uid(),
        id:            null,
        exercise_id:   e.exercise_id,
        exercise_nome: e.exercise_nome,
        series:        seriesCount,
        tipo_metrica:  tipo,
        intervalo_seg,
        observacao:    sd[0]?.texto ?? "",
        bi_set_grupo:  e.compound_group ?? null,
        seriesData,
      };
    });

    onImport(rows);
    setImporting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "80vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-800">Adicionar sessão base</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Column header */}
        <div className="px-6 py-2 border-b border-gray-100 flex-shrink-0">
          <span className="text-xs font-semibold text-gray-500">Nome</span>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : baseSessions.length === 0 ? (
            <p className="text-center py-12 text-sm text-gray-400">Nenhuma sessão cadastrada</p>
          ) : (
            baseSessions.map(s => (
              <div
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`flex items-center px-6 py-3.5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${selected === s.id ? "bg-gray-50" : ""}`}
              >
                <span className="flex-1 text-sm text-gray-800">{s.nome}</span>
                <span className="text-xs text-blue-500 mr-4 whitespace-nowrap">
                  {s.exercise_count} exercício{s.exercise_count !== 1 ? "s" : ""}
                </span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  selected === s.id ? "border-red-500" : "border-gray-300"
                }`}>
                  {selected === s.id && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-4 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="text-sm font-semibold text-gray-500 hover:text-gray-700"
          >
            FECHAR
          </button>
          <button
            onClick={handleImport}
            disabled={!selected || importing}
            className="px-5 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {importing ? "Importando..." : "SALVAR"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Exercise Menu (3-dot) ──────────────────────────────────── */

type ExerciseMenuProps = {
  ex: ExerciseRow;
  idx: number;
  total: number;
  sessionKey: string;
  exercises: ExerciseRow[];
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onToggleBiSet: () => void;
};

function ExerciseMenu({ ex, idx, total, onMoveUp, onMoveDown, onRemove, onToggleBiSet }: ExerciseMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative flex-shrink-0 mt-3" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="p-1 text-gray-400 hover:text-gray-600 rounded"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-30 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[160px] py-1 text-xs">
          <button onClick={() => { onMoveUp(); setOpen(false); }} disabled={idx === 0}
            className="w-full px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-40 flex items-center gap-2">
            <ChevronUp className="w-3 h-3" /> Mover para cima
          </button>
          <button onClick={() => { onMoveDown(); setOpen(false); }} disabled={idx === total - 1}
            className="w-full px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-40 flex items-center gap-2">
            <ChevronDown className="w-3 h-3" /> Mover para baixo
          </button>
          <button onClick={() => { onToggleBiSet(); setOpen(false); }}
            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2">
            {ex.bi_set_grupo != null ? "Remover do bi-set" : "Adicionar ao bi-set"}
          </button>
          <button onClick={() => { onRemove(); setOpen(false); }}
            className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2">
            <Trash2 className="w-3 h-3" /> Remover
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Exercise Modal ─────────────────────────────────────────── */

type ExerciseModalProps = {
  contractorId: string;
  initial?: ExerciseRow;
  onClose: () => void;
  onSave: (ex: ExerciseRow) => void;
};

function ExerciseModal({ contractorId, initial, onClose, onSave }: ExerciseModalProps) {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseSuggestion | null>(
    initial ? { id: initial.exercise_id ?? "", nome: initial.exercise_nome } : null
  );
  const [searchText, setSearchText] = useState(initial?.exercise_nome ?? "");
  const [allExercises, setAllExercises] = useState<ExerciseSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const [series, setSeries] = useState(initial?.series ?? 3);
  const [tipoMetrica, setTipoMetrica] = useState<TipoMetrica>(initial?.tipo_metrica ?? "repeticoes");
  const [intervalo, setIntervalo] = useState(initial?.intervalo_seg != null ? String(initial.intervalo_seg) : "");
  const [observacao, setObservacao] = useState(initial?.observacao ?? "");
  const [seriesData, setSeriesData] = useState<Serie[]>(
    initial?.seriesData ?? Array.from({ length: 3 }, () => ({ valor: "", carga_kg: "" }))
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (seriesData.length !== series) setSeriesData(buildSeries(series, seriesData));
  }, [series]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Load all exercises once on mount */
  useEffect(() => {
    supabase
      .from("exercises")
      .select("id, nome, exercise_groups(nome)")
      .eq("contractor_id", contractorId)
      .order("nome")
      .then(({ data }) => {
        setAllExercises(((data ?? []) as any[]).map(e => ({
          id:    e.id,
          nome:  e.nome,
          grupo: (e.exercise_groups as any)?.nome,
        })));
      });
  }, [contractorId]);

  /* Close dropdown when clicking outside input or dropdown */
  useEffect(() => {
    if (!showDropdown) return;
    function h(e: MouseEvent) {
      if (
        inputRef.current && !inputRef.current.contains(e.target as Node) &&
        dropRef.current  && !dropRef.current.contains(e.target as Node)
      ) setShowDropdown(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showDropdown]);

  function calcAndOpen() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropStyle({
        position: "fixed",
        top:      r.bottom + 4,
        left:     r.left,
        width:    r.width,
        zIndex:   9999,
      });
    }
    setShowDropdown(true);
  }

  const filtered = allExercises
    .filter(e => !searchText.trim() || e.nome.toLowerCase().includes(searchText.toLowerCase()))
    .slice(0, 60);

  function handleSave() {
    const nome = selectedExercise?.nome ?? searchText.trim();
    if (!nome) return;
    onSave({
      _key: initial?._key ?? uid(),
      id: initial?.id ?? null,
      exercise_id: selectedExercise?.id ?? null,
      exercise_nome: nome,
      series,
      tipo_metrica: tipoMetrica,
      intervalo_seg: intervalo ? Number(intervalo) : null,
      observacao,
      bi_set_grupo: initial?.bi_set_grupo ?? null,
      seriesData,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">
            {initial ? "Editar exercício" : "Adicionar exercício"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Exercise search */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Exercício</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                value={searchText}
                onChange={e => { setSearchText(e.target.value); setSelectedExercise(null); calcAndOpen(); }}
                onFocus={calcAndOpen}
                placeholder="Buscar exercício..."
                className="pl-9 pr-4 py-2 w-full border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {showDropdown && (
              <div
                ref={dropRef}
                style={dropStyle}
                className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
              >
                {filtered.length === 0 ? (
                  <p className="text-xs text-gray-400 px-4 py-3 text-center">Nenhum exercício encontrado</p>
                ) : (
                  <div className="overflow-y-auto" style={{ maxHeight: "176px" }}>
                    {filtered.map(ex => (
                      <button
                        key={ex.id}
                        onMouseDown={() => {
                          setSelectedExercise(ex);
                          setSearchText(ex.nome);
                          setShowDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition-colors text-left border-b border-gray-50 last:border-0"
                      >
                        <span className="text-sm text-gray-800 font-medium flex-1">{ex.nome}</span>
                        {ex.grupo && (
                          <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap pl-4">{ex.grupo}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Metrica + Series */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Métrica</label>
              <select value={tipoMetrica} onChange={e => setTipoMetrica(e.target.value as TipoMetrica)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {(Object.keys(METRICA_LABELS) as TipoMetrica[]).map(m => (
                  <option key={m} value={m}>{METRICA_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Séries</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setSeries(s => Math.max(1, s - 1))}
                  className="w-8 h-9 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">−</button>
                <input type="number" min={1} value={series}
                  onChange={e => setSeries(Math.max(1, Number(e.target.value)))}
                  className="flex-1 text-center border border-gray-200 rounded-lg py-2 text-sm focus:outline-none" />
                <button onClick={() => setSeries(s => s + 1)}
                  className="w-8 h-9 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">+</button>
              </div>
            </div>
          </div>

          {/* Series table */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Valores por série</label>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400">
                  <th className="pb-1 text-left w-10">Série</th>
                  <th className="pb-1 text-left">{METRICA_LABELS[tipoMetrica]}</th>
                  <th className="pb-1 text-left">Carga (kg)</th>
                </tr>
              </thead>
              <tbody>
                {seriesData.map((s, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="py-1 pr-2 text-gray-400 text-xs">{i + 1}</td>
                    <td className="py-1 pr-2">
                      <input value={s.valor}
                        onChange={e => setSeriesData(prev => prev.map((p, pi) => pi === i ? { ...p, valor: e.target.value } : p))}
                        placeholder="—"
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30" />
                    </td>
                    <td className="py-1">
                      <input value={s.carga_kg}
                        onChange={e => setSeriesData(prev => prev.map((p, pi) => pi === i ? { ...p, carga_kg: e.target.value } : p))}
                        type="number" min={0} step={0.5} placeholder="—"
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Interval + Obs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Intervalo (s)</label>
              <input type="number" min={0} value={intervalo} onChange={e => setIntervalo(e.target.value)}
                placeholder="—" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Observação</label>
              <input value={observacao} onChange={e => setObservacao(e.target.value)}
                placeholder="opcional" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={!searchText.trim()}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40">
            {initial ? "Atualizar" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
