import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, SlidersHorizontal, Pencil, Trash2, X, Loader2,
  ChevronLeft, ChevronRight, ClipboardList, Plus, GripVertical,
  MoreVertical, RefreshCcw, Info, PlusCircle, ArrowUp, ArrowDown,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toTitleCase } from "@/lib/text";

/* ── Types ─────────────────────────────────────────────── */
type TipoSerie = "repeticoes" | "minutos" | "segundos" | "livre";

interface SessaoEx {
  _tempId:        string;
  id?:            string;
  exercise_id:    string | null;
  exercise_nome:  string;
  ordem:          number;
  tipo:           TipoSerie;
  series_count:   number;
  valor:          string;
  carga:          string;
  intervalo:      string;
  observacao:     string;
  compound_group: number | null;
}

interface Sessao {
  id:             string;
  nome:           string;
  created_at:     string;
  exercise_count: number;
}

interface ExOption { id: string; nome: string; grupo?: string }

/* ── Helpers ────────────────────────────────────────────── */
function tempId() { return Math.random().toString(36).slice(2); }

const TIPOS: TipoSerie[] = ["repeticoes", "segundos", "minutos", "livre"];
const TIPO_LABEL: Record<TipoSerie, string> = {
  repeticoes: "Repetições",
  segundos:   "Segundos",
  minutos:    "Minutos",
  livre:      "Livre",
};
function nextTipo(t: TipoSerie): TipoSerie {
  return TIPOS[(TIPOS.indexOf(t) + 1) % TIPOS.length];
}

function defaultEx(): Omit<SessaoEx, "_tempId" | "ordem"> {
  return {
    exercise_id: null, exercise_nome: "", tipo: "repeticoes",
    series_count: 3, valor: "12", carga: "", intervalo: "60s",
    observacao: "", compound_group: null,
  };
}

function fromSeriesData(tipo: TipoSerie, series: any[]): Partial<SessaoEx> {
  const s0 = series?.[0] ?? {};
  return {
    series_count: series?.length || 3,
    valor:        tipo === "repeticoes" ? (s0.repeticoes ?? "12") : (s0.duracao ?? "30"),
    carga:        s0.carga ?? "",
    intervalo:    s0.descanso ?? "60s",
    observacao:   s0.texto ?? "",
  };
}

function toSeriesData(ex: SessaoEx) {
  if (ex.tipo === "livre") return [{ texto: ex.observacao }];
  return Array.from({ length: Math.max(1, ex.series_count) }, () => ({
    ...(ex.tipo === "repeticoes" ? { repeticoes: ex.valor } : { duracao: ex.valor }),
    carga: ex.carga,
    descanso: ex.intervalo,
    texto: ex.observacao,
  }));
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const M = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
}

/* ── Inline Exercise Autocomplete ───────────────────────── */
function ExerciseField({ value, onChange, exercises }: {
  value:    string;
  onChange: (id: string | null, nome: string) => void;
  exercises: ExOption[];
}) {
  const [open,      setOpen]      = useState(false);
  const [search,    setSearch]    = useState(value);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);

  /* Calculate fixed position synchronously from the event (not in useEffect)
     so getBoundingClientRect is always accurate even inside overflow:auto parents */
  function calcAndOpen() {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setDropStyle({
        position: "fixed",
        top:      r.bottom + 6,
        left:     r.left,
        minWidth: Math.max(r.width, 400),
        zIndex:   9999,
      });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const filtered = exercises
    .filter(e => e.nome.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 60);

  return (
    <div ref={ref} className="relative flex-1 min-w-[180px]">
      <p className={`text-[10px] font-medium mb-0.5 ${open ? "text-red-500" : "text-gray-400"}`}>
        Exercício *
      </p>
      <div className="flex items-center gap-1 border-b border-gray-300 pb-0.5">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); calcAndOpen(); }}
          onFocus={calcAndOpen}
          placeholder="Pesquisar exercício..."
          className="flex-1 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent min-w-0"
        />
        {value && (
          <button
            onMouseDown={() => { onChange(null, ""); setSearch(""); calcAndOpen(); }}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {open && (
        <div
          className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
          style={dropStyle}
        >
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 px-4 py-3 text-center">
              {exercises.length === 0 ? "Nenhum exercício cadastrado" : "Nenhum resultado"}
            </p>
          ) : (
            /* max-h for ~4 items (each ~44px), scrollbar if more */
            <div className="overflow-y-auto" style={{ maxHeight: "176px" }}>
              {filtered.map(ex => (
                <button
                  key={ex.id}
                  onMouseDown={() => { onChange(ex.id, ex.nome); setSearch(ex.nome); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition-colors text-left border-b border-gray-50 last:border-0"
                >
                  <span className="text-gray-300 flex-shrink-0 text-sm">☆</span>
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
  );
}

/* ── Inline Exercise Row ────────────────────────────────── */
function ExerciseRow({ ex, idx, total, exercises, onUpdate, onRemove, onMoveUp, onMoveDown }: {
  ex:         SessaoEx;
  idx:        number;
  total:      number;
  exercises:  ExOption[];
  onUpdate:   (patch: Partial<SessaoEx>) => void;
  onRemove:   () => void;
  onMoveUp:   () => void;
  onMoveDown: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function h(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  return (
    <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      {/* Move controls */}
      <div className="flex flex-col items-center gap-0.5 flex-shrink-0 text-gray-400">
        <button onClick={onMoveUp} disabled={idx === 0}
          className="disabled:opacity-25 hover:text-gray-600 transition-colors">
          <ArrowUp className="w-3 h-3" />
        </button>
        <GripVertical className="w-3.5 h-3.5 cursor-grab" />
        <button onClick={onMoveDown} disabled={idx === total - 1}
          className="disabled:opacity-25 hover:text-gray-600 transition-colors">
          <ArrowDown className="w-3 h-3" />
        </button>
      </div>

      {/* Exercise name autocomplete */}
      <ExerciseField
        value={ex.exercise_nome}
        exercises={exercises}
        onChange={(id, nome) => onUpdate({ exercise_id: id, exercise_nome: nome })}
      />

      {/* Séries */}
      <div className="flex-shrink-0 w-14 text-center">
        <p className="text-[10px] font-medium text-gray-400 mb-0.5">Séries *</p>
        <input
          type="number" min={1} max={99}
          value={ex.series_count}
          onChange={e => onUpdate({ series_count: Math.max(1, parseInt(e.target.value) || 1) })}
          className="w-full border-b border-gray-300 text-sm text-center text-gray-800 focus:outline-none bg-transparent pb-0.5"
        />
      </div>

      {/* Tipo toggle */}
      <button
        onClick={() => onUpdate({ tipo: nextTipo(ex.tipo) })}
        title={`Tipo: ${TIPO_LABEL[ex.tipo]}. Clique para alterar.`}
        className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-600 flex items-center justify-center hover:bg-orange-700 transition-colors"
      >
        <RefreshCcw className="w-3.5 h-3.5 text-white" />
      </button>

      {/* Valor (repetições / duração) ou Descrição livre */}
      {ex.tipo === "livre" ? (
        <div className="flex-shrink-0 w-44">
          <p className="text-[10px] font-medium text-gray-400 mb-0.5">Descrição livre</p>
          <input
            value={ex.valor}
            onChange={e => onUpdate({ valor: e.target.value })}
            placeholder="Descreva livremente..."
            className="w-full border-b border-gray-300 text-sm text-gray-700 placeholder-gray-300 focus:outline-none bg-transparent pb-0.5"
          />
        </div>
      ) : (
        <div className="flex-shrink-0 w-20 text-center">
          <p className="text-[10px] font-medium text-gray-400 mb-0.5">{TIPO_LABEL[ex.tipo]}</p>
          <input
            value={ex.valor}
            onChange={e => onUpdate({ valor: e.target.value })}
            className="w-full border-b border-gray-300 text-sm text-center text-gray-800 focus:outline-none bg-transparent pb-0.5"
          />
        </div>
      )}

      {/* Carga */}
      <div className="flex-shrink-0 w-24">
        <p className="text-[10px] font-medium text-gray-400 mb-0.5 flex items-center gap-0.5">
          <Info className="w-2.5 h-2.5" /> Carga(Kg)
        </p>
        <input
          value={ex.carga}
          onChange={e => onUpdate({ carga: e.target.value })}
          placeholder="—"
          className="w-full border-b border-gray-300 text-sm text-gray-700 placeholder-gray-300 focus:outline-none bg-transparent pb-0.5"
        />
      </div>

      {/* Intervalo */}
      <div className="flex-shrink-0 w-24">
        <p className="text-[10px] font-medium text-gray-400 mb-0.5 flex items-center gap-0.5">
          <Info className="w-2.5 h-2.5" /> Intervalo
        </p>
        <input
          value={ex.intervalo}
          onChange={e => onUpdate({ intervalo: e.target.value })}
          placeholder="—"
          className="w-full border-b border-gray-300 text-sm text-gray-700 placeholder-gray-300 focus:outline-none bg-transparent pb-0.5"
        />
      </div>

      {/* Observação */}
      <div className="flex-1 min-w-[100px]">
        <p className="text-[10px] font-medium text-gray-400 mb-0.5 flex items-center gap-0.5">
          <Info className="w-2.5 h-2.5" /> Observação
        </p>
        <input
          value={ex.observacao}
          onChange={e => onUpdate({ observacao: e.target.value })}
          placeholder="—"
          className="w-full border-b border-gray-300 text-sm text-gray-700 placeholder-gray-300 focus:outline-none bg-transparent pb-0.5"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-30 bg-white border border-gray-100 rounded-xl shadow-xl py-1 min-w-[160px]">
              <button
                onClick={() => { setMenuOpen(false); onRemove(); }}
                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50"
              >
                Remover exercício
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Session Editor Full Page ───────────────────────────── */
function SessionEditorPage({ sessionId, contractorId, allExercises, onBack, onSaved }: {
  sessionId:    string | null;
  contractorId: string;
  allExercises: ExOption[];
  onBack:       () => void;
  onSaved:      () => void;
}) {
  const [nome,       setNome]       = useState("");
  const [exercises,  setExercises]  = useState<SessaoEx[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSaved,  setLastSaved]  = useState<string>("");
  const [loading,    setLoading]    = useState(!!sessionId);
  const [saving,     setSaving]     = useState(false);

  const sidRef     = useRef<string | null>(sessionId);
  const onSavedRef = useRef(onSaved);
  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);

  /* Load existing session */
  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    supabase
      .from("sessions")
      .select("*, session_exercises(*)")
      .eq("id", sessionId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const d = data as any;
        setNome(d.nome);
        const exs: SessaoEx[] = (d.session_exercises || [])
          .sort((a: any, b: any) => a.ordem - b.ordem)
          .map((e: any) => {
            const sd = Array.isArray(e.series_data) ? e.series_data : [];
            return {
              _tempId:       tempId(),
              id:            e.id,
              exercise_id:   e.exercise_id,
              exercise_nome: e.exercise_nome,
              ordem:         e.ordem,
              tipo:          e.tipo as TipoSerie,
              compound_group: e.compound_group ?? null,
              ...fromSeriesData(e.tipo as TipoSerie, sd),
            } as SessaoEx;
          });
        setExercises(exs);
        setLoading(false);
      });
  }, [sessionId]);

  /* Auto-save debounced 800ms */
  useEffect(() => {
    if (loading || !nome.trim()) return;
    const timer = setTimeout(async () => {
      setSaveStatus("saving");
      const nomeNorm = toTitleCase(nome.trim());
      let sid = sidRef.current;
      if (!sid) {
        const { data } = await supabase
          .from("sessions")
          .insert({ contractor_id: contractorId, nome: nomeNorm })
          .select("id").single();
        if (!data) { setSaveStatus("idle"); return; }
        sid = (data as any).id;
        sidRef.current = sid;
      } else {
        await supabase
          .from("sessions")
          .update({ nome: nomeNorm, updated_at: new Date().toISOString() })
          .eq("id", sid);
      }

      await supabase.from("session_exercises").delete().eq("session_id", sid!);
      if (exercises.length > 0) {
        await supabase.from("session_exercises").insert(
          exercises.map((e, i) => ({
            session_id:    sid!,
            exercise_id:   e.exercise_id,
            exercise_nome: e.exercise_nome,
            ordem:         i,
            tipo:          e.tipo,
            series_data:   toSeriesData(e) as any,
            compound_group: e.compound_group ?? null,
          }))
        );
      }

      setSaveStatus("saved");
      setLastSaved("há poucos segundos");
      setTimeout(() => setSaveStatus("idle"), 4000);
      onSavedRef.current();
    }, 800);
    return () => clearTimeout(timer);
  }, [nome, exercises, loading, contractorId]);

  /* Exercise CRUD */
  function addExercise() {
    setExercises(prev => [...prev, { _tempId: tempId(), ordem: prev.length, ...defaultEx() }]);
  }
  function updateEx(tid: string, patch: Partial<SessaoEx>) {
    setExercises(prev => prev.map(e => e._tempId === tid ? { ...e, ...patch } : e));
  }
  function removeEx(tid: string) {
    setExercises(prev => prev.filter(e => e._tempId !== tid));
  }
  function moveUp(idx: number) {
    if (idx === 0) return;
    setExercises(prev => { const n = [...prev]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n; });
  }
  function moveDown(idx: number) {
    setExercises(prev => {
      if (idx >= prev.length - 1) return prev;
      const n = [...prev]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n;
    });
  }

  async function handleSaveAndBack() {
    if (!nome.trim()) { onBack(); return; }
    setSaving(true);
    const nomeNorm = toTitleCase(nome.trim());
    let sid = sidRef.current;
    if (!sid) {
      const { data } = await supabase
        .from("sessions")
        .insert({ contractor_id: contractorId, nome: nomeNorm })
        .select("id").single();
      if (!data) { setSaving(false); return; }
      sid = (data as any).id;
      sidRef.current = sid;
    } else {
      await supabase
        .from("sessions")
        .update({ nome: nomeNorm, updated_at: new Date().toISOString() })
        .eq("id", sid);
    }
    await supabase.from("session_exercises").delete().eq("session_id", sid!);
    if (exercises.length > 0) {
      await supabase.from("session_exercises").insert(
        exercises.map((e, i) => ({
          session_id:     sid!,
          exercise_id:    e.exercise_id,
          exercise_nome:  e.exercise_nome,
          ordem:          i,
          tipo:           e.tipo,
          series_data:    toSeriesData(e) as any,
          compound_group: e.compound_group ?? null,
        }))
      );
    }
    onSavedRef.current();
    onBack();
  }

  const savedText = saveStatus === "saving"
    ? "Salvando..."
    : saveStatus === "saved"
    ? `Salvo ${lastSaved}!`
    : "";

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Centered red title */}
      <div className="text-center pt-5 pb-2">
        <h1 className="text-base font-bold text-red-500">
          {sessionId ? "Editar Sessão" : "Nova Sessão"}
        </h1>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-red-400" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-24 px-6">
          <div className="max-w-5xl mx-auto space-y-5">

            {/* Dados da sessão */}
            <div>
              <h2 className="text-sm font-semibold text-gray-600 mb-2">Dados da sessão</h2>
              <div className="bg-white border border-gray-200 rounded-xl px-6 py-4">
                <label className="text-xs text-gray-500 block mb-1.5">Nome da sessão *</label>
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  onBlur={e => setNome(toTitleCase(e.target.value))}
                  placeholder="Nome da sessão"
                  autoFocus={!sessionId}
                  className="w-full border-b border-gray-200 pb-1.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-red-400 bg-transparent transition-colors"
                />
              </div>
            </div>

            {/* Exercícios da sessão */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-sm font-semibold text-gray-600">Exercícios da sessão</h2>
                <a
                  href="/app/treinos/exercicios"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline"
                >
                  Cadastrar novo exercício
                </a>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl">
                {/* Toolbar */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 rounded-t-xl">
                  <button
                    onClick={addExercise}
                    disabled={!nome.trim()}
                    className="inline-flex items-center gap-1.5 bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> EXERCÍCIO
                  </button>
                  {savedText && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      {saveStatus === "saving" && <Loader2 className="w-3 h-3 animate-spin" />}
                      {savedText}
                    </span>
                  )}
                </div>

                {/* Exercise rows */}
                <div className="px-4 py-3 space-y-2">
                  {exercises.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">
                      {!nome.trim()
                        ? "Preencha o nome da sessão para adicionar exercícios."
                        : "Nenhum exercício adicionado. Clique em + EXERCÍCIO para começar."}
                    </p>
                  )}

                  {exercises.map((ex, idx) => (
                    <ExerciseRow
                      key={ex._tempId}
                      ex={ex}
                      idx={idx}
                      total={exercises.length}
                      exercises={allExercises}
                      onUpdate={p => updateEx(ex._tempId, p)}
                      onRemove={() => removeEx(ex._tempId)}
                      onMoveUp={() => moveUp(idx)}
                      onMoveDown={() => moveDown(idx)}
                    />
                  ))}

                  {/* Add placeholder */}
                  {nome.trim() && (
                    <button
                      onClick={addExercise}
                      className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-300 rounded-lg text-gray-400 text-sm hover:border-red-300 hover:text-red-400 transition-colors"
                    >
                      <PlusCircle className="w-4 h-4" /> EXERCÍCIO
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Fixed footer */}
      <div className="fixed bottom-0 left-56 right-0 bg-white border-t border-gray-100 px-8 py-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm font-bold text-blue-500 hover:underline"
        >
          VOLTAR
        </button>
        <div className="flex items-center gap-4">
          {savedText && saveStatus === "saved" && (
            <span className="text-xs text-gray-400">{savedText}</span>
          )}
          <button
            onClick={handleSaveAndBack}
            disabled={saving || !nome.trim()}
            className="bg-green-500 text-white text-sm font-bold px-6 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Salvando..." : "SALVAR"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Pagination ─────────────────────────────────────────── */
function Pagination({ page, perPage, total, onPage, onPerPage }: {
  page: number; perPage: number; total: number;
  onPage: (p: number) => void; onPerPage: (n: number) => void;
}) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to   = Math.min(page * perPage, total);
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-100 text-xs text-gray-600">
      <span>Página</span>
      <select value={page} onChange={e => onPage(Number(e.target.value))}
        className="border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none">
        {Array.from({ length: lastPage }, (_, i) => i + 1).map(p =>
          <option key={p} value={p}>{p}</option>)}
      </select>
      <span>Exibir</span>
      <select value={perPage} onChange={e => { onPerPage(Number(e.target.value)); onPage(1); }}
        className="border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none">
        {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <span className="flex-1 text-center">{from}–{to} de {total}</span>
      <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} className="disabled:opacity-30">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button onClick={() => onPage(Math.min(lastPage, page + 1))} disabled={page === lastPage} className="disabled:opacity-30">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────── */
export default function SessoesPage() {
  const { user } = useAuth();

  const [sessions,     setSessions]     = useState<Sessao[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [page,         setPage]         = useState(1);
  const [perPage,      setPerPage]      = useState(20);
  const [editorOpen,   setEditorOpen]   = useState(false);
  const [editId,       setEditId]       = useState<string | null>(null);
  const [deleteId,     setDeleteId]     = useState<string | null>(null);
  const [allExercises, setAllExercises] = useState<ExOption[]>([]);

  useEffect(() => {
    if (!user?.contractorId) return;
    supabase
      .from("exercises")
      .select("id, nome, exercise_groups(nome)")
      .eq("contractor_id", user.contractorId!)
      .order("nome")
      .then(({ data }) => {
        setAllExercises(((data ?? []) as any[]).map(e => ({
          id:    e.id,
          nome:  e.nome,
          grupo: (e.exercise_groups as any)?.nome,
        })));
      });
  }, [user]);

  const loadSessions = useCallback(async () => {
    if (!user?.contractorId) return;
    setLoading(true);
    const from = (page - 1) * perPage;
    const to   = from + perPage - 1;

    let q = supabase
      .from("sessions")
      .select("id, nome, created_at", { count: "exact" })
      .eq("contractor_id", user.contractorId!);
    if (search.trim()) q = q.ilike("nome", `%${search.trim()}%`);

    const { data, count } = await q.order("created_at", { ascending: false }).range(from, to);
    const rows = (data ?? []) as any[];

    const ids = rows.map(s => s.id);
    let cntMap: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: exRows } = await supabase
        .from("session_exercises")
        .select("session_id")
        .in("session_id", ids);
      (exRows ?? []).forEach((e: any) => {
        cntMap[e.session_id] = (cntMap[e.session_id] ?? 0) + 1;
      });
    }

    setSessions(rows.map(s => ({ ...s, exercise_count: cntMap[s.id] ?? 0 })));
    setTotal(count ?? 0);
    setLoading(false);
  }, [user, page, perPage, search]);

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  async function handleDelete(id: string) {
    await supabase.from("sessions").delete().eq("id", id);
    setDeleteId(null);
    setSessions(prev => prev.filter(s => s.id !== id));
    setTotal(prev => prev - 1);
  }

  /* ── Full page editor ── */
  if (editorOpen) {
    return (
      <AppLayout>
        <SessionEditorPage
          sessionId={editId}
          contractorId={user?.contractorId ?? ""}
          allExercises={allExercises}
          onBack={() => { setEditorOpen(false); setEditId(null); loadSessions(); }}
          onSaved={loadSessions}
        />
      </AppLayout>
    );
  }

  /* ── List view ── */
  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen bg-gray-50">

        {/* Toolbar */}
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-6">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-bold text-gray-800 whitespace-nowrap">Sessões</h1>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 leading-none mb-1">Pesquisar</span>
              <div className="flex items-center gap-2 border-b border-gray-300 pb-0.5">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Pesquisar sessão"
                  className="text-sm text-gray-700 placeholder-gray-400 focus:outline-none bg-transparent w-48"
                />
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => { setEditId(null); setEditorOpen(true); }}
              className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              + SESSÃO
            </button>
            <button className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              <SlidersHorizontal className="w-3.5 h-3.5" /> FILTROS
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 mx-4 my-4 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_160px_140px_80px] border-b border-gray-200 px-6 py-3">
            <span className="text-xs font-semibold text-gray-600">Nome</span>
            <span className="text-xs font-semibold text-gray-600">Nº de exercícios</span>
            <span className="text-xs font-semibold text-gray-600">Criado em</span>
            <span />
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-red-400" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <ClipboardList className="w-10 h-10 text-gray-200" />
              <p className="text-sm text-gray-400">Nenhuma sessão cadastrada</p>
              <button
                onClick={() => { setEditId(null); setEditorOpen(true); }}
                className="text-xs text-red-500 font-semibold hover:underline"
              >
                + Criar primeira sessão
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {sessions.map(s => (
                <div
                  key={s.id}
                  className="grid grid-cols-[1fr_160px_140px_80px] px-6 py-3.5 items-center hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-800 truncate">{s.nome}</span>
                  <span className="text-sm text-gray-500">{s.exercise_count}</span>
                  <span className="text-xs text-gray-500">{fmtDate(s.created_at)}</span>
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => { setEditId(s.id); setEditorOpen(true); }}
                      className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(s.id)}
                      className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Pagination page={page} perPage={perPage} total={total} onPage={setPage} onPerPage={setPerPage} />
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 mb-2">Excluir sessão</h3>
            <p className="text-sm text-gray-500 mb-5">
              Tem certeza que deseja excluir esta sessão? Os exercícios vinculados também serão removidos.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="text-sm font-bold text-gray-500 hover:underline">
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="bg-red-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
