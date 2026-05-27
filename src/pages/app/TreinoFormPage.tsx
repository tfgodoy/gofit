import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Search, Trash2, ChevronUp, ChevronDown,
  MoreVertical, GripVertical, Loader2, Check, X, Layers
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/app/AppLayout";
import { toast } from "sonner";

/* ─── Types ──────────────────────────────────────────────────── */

type TipoMetrica = "repeticoes" | "minutos" | "segundos" | "livre";

type Serie = { valor: string; carga_kg: string };

type ExerciseRow = {
  _key:         string;
  id:           string | null;
  exercise_id:  string | null;
  exercise_nome: string;
  series:       number;
  tipo_metrica: TipoMetrica;
  intervalo_seg: number | null;
  observacao:   string;
  bi_set_grupo: number | null;
  seriesData:   Serie[];
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

type ExerciseSuggestion = { id: string; nome: string; grupo_nome?: string };

/* ─── Constants ─────────────────────────────────────────────── */

const TIPOS_TREINO = [
  "musculacao", "funcional", "aerobico", "hiit", "yoga", "pilates", "outro",
];

const TIPO_LABELS: Record<string, string> = {
  musculacao: "Musculação", funcional: "Funcional", aerobico: "Aeróbico",
  hiit: "HIIT", yoga: "Yoga", pilates: "Pilates", outro: "Outro",
};

const NIVEIS = ["iniciante", "intermediario", "avancado"];
const NIVEL_LABELS: Record<string, string> = {
  iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado",
};

const METRICA_LABELS: Record<TipoMetrica, string> = {
  repeticoes: "Repetições", minutos: "Minutos", segundos: "Segundos", livre: "Livre",
};

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

/* ─── Component ─────────────────────────────────────────────── */

export default function TreinoFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "novo";
  const navigate = useNavigate();
  const { user } = useAuth();

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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workoutId = useRef<string | null>(isNew ? null : (id ?? null));

  /* Load existing workout */
  useEffect(() => {
    if (isNew || !id) return;
    (async () => {
      const { data: w } = await supabase
        .from("workouts")
        .select("*")
        .eq("id", id)
        .single();
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
        .from("workout_sessions")
        .select("*")
        .eq("workout_id", id)
        .order("ordem");

      if (!wss?.length) return;

      const sessionsBuilt: WorkoutSession[] = [];
      for (const ws of wss) {
        const { data: exs } = await supabase
          .from("workout_session_exercises")
          .select("*")
          .eq("session_id", ws.id)
          .order("ordem");

        const exercises: ExerciseRow[] = [];
        for (const ex of exs ?? []) {
          const { data: series } = await supabase
            .from("workout_session_exercise_series")
            .select("*")
            .eq("exercise_sessao_id", ex.id)
            .order("numero_serie");

          exercises.push({
            _key: uid(),
            id: ex.id,
            exercise_id: ex.exercise_id,
            exercise_nome: ex.exercise_nome,
            series: ex.series,
            tipo_metrica: ex.tipo_metrica as TipoMetrica,
            intervalo_seg: ex.intervalo_seg,
            observacao: ex.observacao ?? "",
            bi_set_grupo: ex.bi_set_grupo,
            seriesData: (series ?? []).map(s => ({
              valor: s.valor,
              carga_kg: s.carga_kg != null ? String(s.carga_kg) : "",
            })),
          });
        }
        sessionsBuilt.push({
          _key: uid(),
          id: ws.id,
          nome: ws.nome,
          ordem: ws.ordem,
          exercises,
        });
      }
      setSessions(sessionsBuilt);
    })();
  }, [id, isNew]);

  /* Auto-save */
  const triggerSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistAll(), 1200);
    setSaveStatus("saving");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!isNew) triggerSave(); }, [form, sessions]); // eslint-disable-line react-hooks/exhaustive-deps

  async function persistAll() {
    if (!user?.contractorId) return;
    if (!form.nome.trim()) return;
    setSaving(true);

    const payload = {
      contractor_id: user.contractorId,
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
      updated_at: new Date().toISOString(),
    };

    let wid = workoutId.current;
    if (!wid) {
      const { data } = await supabase.from("workouts").insert(payload).select("id").single();
      if (!data) { setSaving(false); return; }
      wid = data.id;
      workoutId.current = wid;
    } else {
      await supabase.from("workouts").update(payload).eq("id", wid);
    }

    /* Save sessions */
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

      /* Delete removed exercises */
      const keepIds = s.exercises.filter(e => e.id).map(e => e.id!);
      if (keepIds.length) {
        await supabase
          .from("workout_session_exercises")
          .delete()
          .eq("session_id", sid)
          .not("id", "in", `(${keepIds.map(k => `'${k}'`).join(",")})`);
      } else {
        await supabase.from("workout_session_exercises").delete().eq("session_id", sid);
      }

      /* Upsert exercises */
      for (let ei = 0; ei < s.exercises.length; ei++) {
        const ex = s.exercises[ei];
        const exPayload = {
          session_id: sid,
          exercise_id: ex.exercise_id,
          exercise_nome: ex.exercise_nome,
          ordem: ei,
          series: ex.series,
          tipo_metrica: ex.tipo_metrica,
          intervalo_seg: ex.intervalo_seg,
          observacao: ex.observacao || null,
          bi_set_grupo: ex.bi_set_grupo,
        };

        let eid = ex.id;
        if (!eid) {
          const { data } = await supabase
            .from("workout_session_exercises")
            .insert(exPayload).select("id").single();
          eid = data?.id ?? null;
          setSessions(prev => prev.map(ps => ps._key === s._key ? {
            ...ps,
            exercises: ps.exercises.map(pe => pe._key === ex._key ? { ...pe, id: eid } : pe),
          } : ps));
        } else {
          await supabase.from("workout_session_exercises").update(exPayload).eq("id", eid);
        }
        if (!eid) continue;

        /* Series */
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
  }

  async function handleSaveNew() {
    if (!form.nome.trim()) { toast.error("Informe o nome do treino"); return; }
    await persistAll();
    if (workoutId.current) navigate(`/app/treinos/treinos/${workoutId.current}`, { replace: true });
  }

  /* Session helpers */
  function addSession() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const nome = `SESSÃO ${letters[sessions.length] ?? sessions.length + 1}`;
    setSessions(prev => [...prev, { _key: uid(), id: null, nome, ordem: prev.length, exercises: [] }]);
    setActiveTab(sessions.length);
  }

  function removeSession(key: string) {
    setSessions(prev => {
      const next = prev.filter(s => s._key !== key);
      return next;
    });
    setActiveTab(t => Math.max(0, t - 1));
  }

  function updateSessionNome(key: string, nome: string) {
    setSessions(prev => prev.map(s => s._key === key ? { ...s, nome } : s));
  }

  /* Exercise helpers */
  function updateExercises(sessionKey: string, exercises: ExerciseRow[]) {
    setSessions(prev => prev.map(s => s._key === sessionKey ? { ...s, exercises } : s));
  }

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

  function updateSerie(sessionKey: string, exKey: string, serieIdx: number, field: keyof Serie, val: string) {
    setSessions(prev => prev.map(s => {
      if (s._key !== sessionKey) return s;
      return {
        ...s,
        exercises: s.exercises.map(e => {
          if (e._key !== exKey) return e;
          const sd = [...e.seriesData];
          sd[serieIdx] = { ...sd[serieIdx], [field]: val };
          return { ...e, seriesData: sd };
        }),
      };
    }));
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
          if (field === "series") {
            updated.seriesData = buildSeries(val as number, e.seriesData);
          }
          return updated;
        }),
      };
    }));
  }

  const f = (k: keyof WorkoutForm, v: WorkoutForm[keyof WorkoutForm]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const currentSession = sessions[activeTab];

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-white">
          <button onClick={() => navigate("/app/treinos/treinos")} className="p-1.5 rounded hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <input
              value={form.nome}
              onChange={e => f("nome", e.target.value)}
              placeholder="Nome do treino"
              className="text-lg font-semibold text-gray-800 bg-transparent border-none focus:outline-none w-full placeholder-gray-300"
            />
          </div>
          {/* Save status */}
          <div className="flex items-center gap-2 text-sm">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-green-600">
                <Check className="w-3.5 h-3.5" /> Salvo
              </span>
            )}
          </div>
          {isNew && (
            <button
              onClick={handleSaveNew}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          )}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — Prescription */}
          <aside className="w-72 border-r border-gray-100 bg-gray-50/50 overflow-y-auto p-4 space-y-4 flex-shrink-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Prescrição</p>

            <Field label="Tipo de Treino">
              <select
                value={form.tipo_treino}
                onChange={e => f("tipo_treino", e.target.value)}
                className="select-base"
              >
                {TIPOS_TREINO.map(t => (
                  <option key={t} value={t}>{TIPO_LABELS[t]}</option>
                ))}
              </select>
            </Field>

            <Field label="Nível">
              <select value={form.nivel} onChange={e => f("nivel", e.target.value)} className="select-base">
                <option value="">Todos</option>
                {NIVEIS.map(n => <option key={n} value={n}>{NIVEL_LABELS[n]}</option>)}
              </select>
            </Field>

            <Field label="Sexo">
              <select value={form.sexo} onChange={e => f("sexo", e.target.value)} className="select-base">
                <option value="">Ambos</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
              </select>
            </Field>

            <Field label="Frequência Semanal">
              <input
                type="number"
                min={1} max={7}
                value={form.frequencia_semanal}
                onChange={e => f("frequencia_semanal", Number(e.target.value))}
                className="input-base"
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Idade mín.">
                <input
                  type="number" min={0}
                  value={form.idade_minima}
                  onChange={e => f("idade_minima", e.target.value)}
                  placeholder="—"
                  className="input-base"
                />
              </Field>
              <Field label="Idade máx.">
                <input
                  type="number" min={0}
                  value={form.idade_maxima}
                  onChange={e => f("idade_maxima", e.target.value)}
                  placeholder="—"
                  className="input-base"
                />
              </Field>
            </div>

            <Field label="Responsável">
              <input
                value={form.responsavel_nome}
                onChange={e => f("responsavel_nome", e.target.value)}
                placeholder="Nome do profissional"
                className="input-base"
              />
            </Field>

            <hr className="border-gray-200" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Controle</p>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.controla_treino}
                onChange={e => f("controla_treino", e.target.checked)}
                className="accent-primary"
              />
              Controlar treino
            </label>

            {form.controla_treino && (
              <>
                <Field label="Tipo de controle">
                  <select value={form.tipo_controle} onChange={e => f("tipo_controle", e.target.value)} className="select-base">
                    <option value="">Selecione</option>
                    <option value="quantidade">Por quantidade</option>
                    <option value="data">Por data</option>
                  </select>
                </Field>
                {form.tipo_controle === "quantidade" && (
                  <Field label="Quantidade">
                    <input type="number" min={1} value={form.quantidade} onChange={e => f("quantidade", e.target.value)} className="input-base" />
                  </Field>
                )}
                {form.tipo_controle === "data" && (
                  <Field label="Data de vencimento">
                    <input type="date" value={form.data_vencimento} onChange={e => f("data_vencimento", e.target.value)} className="input-base" />
                  </Field>
                )}
              </>
            )}

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.imprimir_automaticamente}
                onChange={e => f("imprimir_automaticamente", e.target.checked)}
                className="accent-primary"
              />
              Imprimir automaticamente
            </label>

            <hr className="border-gray-200" />

            <Field label="Observações">
              <textarea
                value={form.observacoes}
                onChange={e => f("observacoes", e.target.value)}
                rows={3}
                className="input-base resize-none"
              />
            </Field>
          </aside>

          {/* Right panel — Sessions */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Session tabs */}
            <div className="flex items-center gap-0 px-4 pt-3 border-b border-gray-100 bg-white overflow-x-auto">
              {sessions.map((s, i) => (
                <div
                  key={s._key}
                  className={`group flex items-center gap-1.5 px-4 py-2 text-sm font-medium cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
                    i === activeTab
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => setActiveTab(i)}
                >
                  {i === activeTab ? (
                    <input
                      value={s.nome}
                      onChange={e => updateSessionNome(s._key, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="bg-transparent border-none focus:outline-none w-24 font-medium text-primary"
                    />
                  ) : (
                    <span>{s.nome}</span>
                  )}
                  {sessions.length > 1 && i === activeTab && (
                    <button
                      onClick={e => { e.stopPropagation(); removeSession(s._key); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addSession}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-400 hover:text-primary transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Sessão
              </button>
            </div>

            {/* Exercise list */}
            {currentSession && (
              <SessionExercises
                session={currentSession}
                onAddExercise={() => setExerciseModal({ sessionKey: currentSession._key, exerciseKey: null })}
                onUpdateExercises={exs => updateExercises(currentSession._key, exs)}
                onMoveExercise={(idx, dir) => moveExercise(currentSession._key, idx, dir)}
                onRemoveExercise={exKey => removeExercise(currentSession._key, exKey)}
                onUpdateSerie={(exKey, si, field, val) => updateSerie(currentSession._key, exKey, si, field, val)}
                onUpdateExField={(exKey, field, val) => updateExField(currentSession._key, exKey, field, val as never)}
                onEditExercise={(exKey) => {
                  const ex = currentSession.exercises.find(e => e._key === exKey);
                  setExerciseModal({ sessionKey: currentSession._key, exerciseKey: exKey, initial: ex });
                }}
              />
            )}
          </div>
        </div>
      </div>

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
        .input-base { @apply w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white; }
        .select-base { @apply w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white; }
      `}</style>
    </AppLayout>
  );
}

/* ─── Field wrapper ──────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  );
}

/* ─── Session exercises panel ────────────────────────────────── */

type SessionExercisesProps = {
  session: WorkoutSession;
  onAddExercise: () => void;
  onUpdateExercises: (exs: ExerciseRow[]) => void;
  onMoveExercise: (idx: number, dir: -1 | 1) => void;
  onRemoveExercise: (exKey: string) => void;
  onUpdateSerie: (exKey: string, si: number, field: keyof Serie, val: string) => void;
  onUpdateExField: (exKey: string, field: keyof ExerciseRow, val: unknown) => void;
  onEditExercise: (exKey: string) => void;
};

function SessionExercises({
  session, onAddExercise, onMoveExercise, onRemoveExercise,
  onUpdateSerie, onUpdateExField, onEditExercise,
}: SessionExercisesProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const exercises = session.exercises;

  function toggleBiSet(exKey: string, currentGroup: number | null) {
    if (currentGroup != null) {
      onUpdateExField(exKey, "bi_set_grupo", null);
    } else {
      const maxGroup = exercises.reduce((m, e) => e.bi_set_grupo != null ? Math.max(m, e.bi_set_grupo) : m, -1);
      onUpdateExField(exKey, "bi_set_grupo", maxGroup + 1);
    }
    setOpenMenu(null);
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-1">
      {exercises.length === 0 && (
        <div className="text-center py-16 text-gray-300">
          <Layers className="w-10 h-10 mx-auto mb-3" />
          <p className="text-sm">Nenhum exercício nesta sessão</p>
        </div>
      )}

      {exercises.map((ex, idx) => {
        const showGroupHeader =
          ex.bi_set_grupo != null &&
          (idx === 0 || exercises[idx - 1].bi_set_grupo !== ex.bi_set_grupo);

        const isLastInGroup =
          ex.bi_set_grupo != null &&
          (idx === exercises.length - 1 || exercises[idx + 1].bi_set_grupo !== ex.bi_set_grupo);

        return (
          <div key={ex._key}>
            {showGroupHeader && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-semibold text-white mb-0"
                style={{ backgroundColor: "hsl(270 60% 50%)" }}
              >
                <Layers className="w-3.5 h-3.5" />
                BI-SET / SUPER-SET
              </div>
            )}
            <div
              className={`bg-white border border-gray-100 ${
                ex.bi_set_grupo != null
                  ? showGroupHeader && isLastInGroup
                    ? "rounded-b-lg border-l-4"
                    : showGroupHeader
                    ? "border-l-4"
                    : isLastInGroup
                    ? "rounded-b-lg border-l-4 border-t-0"
                    : "border-l-4 border-t-0"
                  : "rounded-lg mb-1"
              } overflow-hidden`}
              style={ex.bi_set_grupo != null ? { borderLeftColor: "hsl(270 60% 50%)" } : undefined}
            >
              {/* Exercise header */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50/60">
                <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <span className="flex-1 text-sm font-medium text-gray-800 truncate">{ex.exercise_nome}</span>

                {/* Metrica select */}
                <select
                  value={ex.tipo_metrica}
                  onChange={e => onUpdateExField(ex._key, "tipo_metrica", e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                >
                  {(Object.keys(METRICA_LABELS) as TipoMetrica[]).map(m => (
                    <option key={m} value={m}>{METRICA_LABELS[m]}</option>
                  ))}
                </select>

                {/* Series count */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onUpdateExField(ex._key, "series", Math.max(1, ex.series - 1))}
                    className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100 text-xs"
                  >−</button>
                  <span className="w-8 text-center text-sm">{ex.series}</span>
                  <button
                    onClick={() => onUpdateExField(ex._key, "series", ex.series + 1)}
                    className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100 text-xs"
                  >+</button>
                  <span className="text-xs text-gray-400 ml-1">séries</span>
                </div>

                {/* 3-dot menu */}
                <div className="relative" ref={openMenu === ex._key ? menuRef : null}>
                  <button
                    onClick={() => setOpenMenu(openMenu === ex._key ? null : ex._key)}
                    className="p-1 rounded hover:bg-gray-200"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                  {openMenu === ex._key && (
                    <div className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[160px] py-1">
                      <button
                        onClick={() => { onEditExercise(ex._key); setOpenMenu(null); }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >Editar exercício</button>
                      <button
                        onClick={() => { toggleBiSet(ex._key, ex.bi_set_grupo); }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        {ex.bi_set_grupo != null ? "Remover do bi-set" : "Adicionar ao bi-set"}
                      </button>
                      <button
                        onClick={() => { onMoveExercise(idx, -1); setOpenMenu(null); }}
                        disabled={idx === 0}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-40 flex items-center gap-2"
                      >
                        <ChevronUp className="w-3.5 h-3.5" /> Mover para cima
                      </button>
                      <button
                        onClick={() => { onMoveExercise(idx, 1); setOpenMenu(null); }}
                        disabled={idx === exercises.length - 1}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-40 flex items-center gap-2"
                      >
                        <ChevronDown className="w-3.5 h-3.5" /> Mover para baixo
                      </button>
                      <button
                        onClick={() => { onRemoveExercise(ex._key); setOpenMenu(null); }}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remover
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Series table */}
              <div className="px-3 pb-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400">
                      <th className="py-1 pr-3 text-left font-medium w-10">Série</th>
                      <th className="py-1 pr-3 text-left font-medium">{METRICA_LABELS[ex.tipo_metrica]}</th>
                      <th className="py-1 text-left font-medium">Carga (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ex.seriesData.map((s, si) => (
                      <tr key={si}>
                        <td className="py-0.5 pr-3 text-gray-400">{si + 1}</td>
                        <td className="py-0.5 pr-3">
                          <input
                            value={s.valor}
                            onChange={e => onUpdateSerie(ex._key, si, "valor", e.target.value)}
                            placeholder="—"
                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                        </td>
                        <td className="py-0.5">
                          <input
                            value={s.carga_kg}
                            onChange={e => onUpdateSerie(ex._key, si, "carga_kg", e.target.value)}
                            placeholder="—"
                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                            type="number"
                            min={0}
                            step={0.5}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Interval */}
                <div className="flex items-center gap-2 mt-1.5">
                  <label className="text-xs text-gray-400">Intervalo (s):</label>
                  <input
                    type="number" min={0}
                    value={ex.intervalo_seg ?? ""}
                    onChange={e => onUpdateExField(ex._key, "intervalo_seg", e.target.value ? Number(e.target.value) : null)}
                    placeholder="—"
                    className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                  />
                  <label className="text-xs text-gray-400 ml-2">Obs.:</label>
                  <input
                    value={ex.observacao}
                    onChange={e => onUpdateExField(ex._key, "observacao", e.target.value)}
                    placeholder="observação opcional"
                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Add exercise button */}
      <button
        onClick={onAddExercise}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:border-primary hover:text-primary transition-colors mt-2"
      >
        <Plus className="w-4 h-4" /> Adicionar exercício
      </button>
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
  const [suggestions, setSuggestions] = useState<ExerciseSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [series, setSeries] = useState(initial?.series ?? 3);
  const [tipoMetrica, setTipoMetrica] = useState<TipoMetrica>(initial?.tipo_metrica ?? "repeticoes");
  const [intervalo, setIntervalo] = useState(initial?.intervalo_seg != null ? String(initial.intervalo_seg) : "");
  const [observacao, setObservacao] = useState(initial?.observacao ?? "");
  const [seriesData, setSeriesData] = useState<Serie[]>(
    initial?.seriesData ?? Array.from({ length: 3 }, () => ({ valor: "", carga_kg: "" }))
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (seriesData.length !== series) {
      setSeriesData(buildSeries(series, seriesData));
    }
  }, [series]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!searchText.trim()) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("exercises")
        .select("id, nome, grupo_id")
        .eq("contractor_id", contractorId)
        .ilike("nome", `%${searchText}%`)
        .limit(10);
      setSuggestions((data ?? []).map(d => ({ id: d.id, nome: d.nome })));
      setShowDropdown(true);
    }, 250);
    return () => clearTimeout(t);
  }, [searchText, contractorId]);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function handleSelectSuggestion(s: ExerciseSuggestion) {
    setSelectedExercise(s);
    setSearchText(s.nome);
    setShowDropdown(false);
  }

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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
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
          <div ref={dropdownRef} className="relative">
            <label className="text-xs font-medium text-gray-500 block mb-1">Exercício</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchText}
                onChange={e => { setSearchText(e.target.value); setSelectedExercise(null); }}
                onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                placeholder="Buscar exercício..."
                className="pl-9 pr-4 py-2 w-full border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                {suggestions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSuggestion(s)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {s.nome}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Metrica + Series */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Métrica</label>
              <select
                value={tipoMetrica}
                onChange={e => setTipoMetrica(e.target.value as TipoMetrica)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {(Object.keys(METRICA_LABELS) as TipoMetrica[]).map(m => (
                  <option key={m} value={m}>{METRICA_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Séries</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSeries(s => Math.max(1, s - 1))}
                  className="w-8 h-9 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
                >−</button>
                <input
                  type="number" min={1}
                  value={series}
                  onChange={e => setSeries(Math.max(1, Number(e.target.value)))}
                  className="flex-1 text-center border border-gray-200 rounded-lg py-2 text-sm focus:outline-none"
                />
                <button
                  onClick={() => setSeries(s => s + 1)}
                  className="w-8 h-9 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
                >+</button>
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
                      <input
                        value={s.valor}
                        onChange={e => setSeriesData(prev => prev.map((p, pi) => pi === i ? { ...p, valor: e.target.value } : p))}
                        placeholder="—"
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </td>
                    <td className="py-1">
                      <input
                        value={s.carga_kg}
                        onChange={e => setSeriesData(prev => prev.map((p, pi) => pi === i ? { ...p, carga_kg: e.target.value } : p))}
                        type="number" min={0} step={0.5}
                        placeholder="—"
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
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
              <input
                type="number" min={0}
                value={intervalo}
                onChange={e => setIntervalo(e.target.value)}
                placeholder="—"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Observação</label>
              <input
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                placeholder="opcional"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!searchText.trim()}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40"
          >
            {initial ? "Atualizar" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
