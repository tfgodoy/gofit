import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, SlidersHorizontal, Pencil, Trash2, X, Loader2,
  ChevronLeft, ChevronRight, ClipboardList, Plus, Check,
  GripVertical, MoreVertical,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ── Types ───────────────────────────────────────────── */
type TipoSerie = "repeticoes" | "minutos" | "segundos" | "livre";
type CompoundType = "bi-set" | "tri-set" | "super-set";

interface SerieRow {
  repeticoes?: string;
  carga?:      string;
  duracao?:    string;
  descanso?:   string;
  texto?:      string;
}

interface SessaoEx {
  _tempId:        string;
  id?:            string;
  exercise_id:    string | null;
  exercise_nome:  string;
  ordem:          number;
  tipo:           TipoSerie;
  series_data:    SerieRow[];
  compound_group: number | null;
}

interface Sessao {
  id:             string;
  nome:           string;
  created_at:     string;
  exercise_count: number;
}

interface ExOption { id: string; nome: string; grupo?: string }

/* ── Helpers ─────────────────────────────────────────── */
function tempId() { return Math.random().toString(36).slice(2); }

function defaultSerie(tipo: TipoSerie): SerieRow {
  switch (tipo) {
    case "repeticoes": return { repeticoes: "12", carga: "", descanso: "60s" };
    case "minutos":    return { duracao: "3",  descanso: "60s" };
    case "segundos":   return { duracao: "30", descanso: "60s" };
    case "livre":      return { texto: "" };
  }
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const M = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
}

/* ── Series table ────────────────────────────────────── */
function SeriesTable({ tipo, series, onChange }: {
  tipo:     TipoSerie;
  series:   SerieRow[];
  onChange: (s: SerieRow[]) => void;
}) {
  function update(idx: number, field: keyof SerieRow, val: string) {
    onChange(series.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  }
  function add()            { onChange([...series, defaultSerie(tipo)]); }
  function remove(idx: number) { onChange(series.filter((_, i) => i !== idx)); }

  if (tipo === "livre") {
    return (
      <div className="mt-2 px-1">
        <textarea
          value={series[0]?.texto ?? ""}
          onChange={e => onChange([{ texto: e.target.value }])}
          placeholder="Descreva o exercício livremente (sem divisão de séries)..."
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-red-300 resize-none"
        />
      </div>
    );
  }

  const isRep  = tipo === "repeticoes";
  const unit   = tipo === "minutos" ? "min" : "seg";

  return (
    <div className="mt-2 px-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 border-b border-gray-100">
            <th className="text-left pb-1 font-medium w-8">Série</th>
            {isRep  && <><th className="text-left pb-1 pl-3 font-medium">Reps</th><th className="text-left pb-1 pl-3 font-medium">Carga</th></>}
            {!isRep && <th className="text-left pb-1 pl-3 font-medium">Duração ({unit})</th>}
            <th className="text-left pb-1 pl-3 font-medium">Descanso</th>
            <th className="w-5" />
          </tr>
        </thead>
        <tbody>
          {series.map((s, i) => (
            <tr key={i} className="border-b border-gray-50 last:border-0">
              <td className="py-1.5 text-gray-400 font-medium">{i + 1}</td>
              {isRep && (
                <>
                  <td className="py-1.5 pl-3">
                    <input
                      value={s.repeticoes ?? ""}
                      onChange={e => update(i, "repeticoes", e.target.value)}
                      className="w-16 border-b border-gray-200 text-center text-sm text-gray-800 focus:outline-none focus:border-red-400 bg-transparent pb-0.5"
                    />
                  </td>
                  <td className="py-1.5 pl-3">
                    <input
                      value={s.carga ?? ""}
                      onChange={e => update(i, "carga", e.target.value)}
                      placeholder="—"
                      className="w-20 border-b border-gray-200 text-center text-sm text-gray-800 focus:outline-none focus:border-red-400 bg-transparent pb-0.5"
                    />
                  </td>
                </>
              )}
              {!isRep && (
                <td className="py-1.5 pl-3">
                  <input
                    value={s.duracao ?? ""}
                    onChange={e => update(i, "duracao", e.target.value)}
                    className="w-20 border-b border-gray-200 text-center text-sm text-gray-800 focus:outline-none focus:border-red-400 bg-transparent pb-0.5"
                  />
                </td>
              )}
              <td className="py-1.5 pl-3">
                <input
                  value={s.descanso ?? ""}
                  onChange={e => update(i, "descanso", e.target.value)}
                  placeholder="—"
                  className="w-16 border-b border-gray-200 text-center text-sm text-gray-800 focus:outline-none focus:border-red-400 bg-transparent pb-0.5"
                />
              </td>
              <td className="py-1.5 pl-2">
                {series.length > 1 && (
                  <button onClick={() => remove(i)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={add} className="mt-2 text-xs text-red-500 hover:underline font-semibold">
        + SÉRIE
      </button>
    </div>
  );
}

/* ── Exercise search dropdown ────────────────────────── */
function ExerciseSearch({ exercises, onSelect }: {
  exercises: ExOption[];
  onSelect:  (ex: ExOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q,    setQ]    = useState("");
  const ref             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const filtered = exercises
    .filter(e => e.nome.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 25);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 border border-dashed border-red-300 text-red-500 text-xs font-bold px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> ADICIONAR EXERCÍCIO
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Pesquisar exercício..."
              autoFocus
              className="flex-1 text-sm text-gray-700 focus:outline-none bg-transparent"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 px-4 py-4 text-center">
                {exercises.length === 0
                  ? "Nenhum exercício cadastrado ainda"
                  : "Nenhum resultado"}
              </p>
            ) : filtered.map(ex => (
              <button
                key={ex.id}
                onMouseDown={() => { onSelect(ex); setOpen(false); setQ(""); }}
                className="w-full text-left px-4 py-2.5 hover:bg-red-50 transition-colors flex items-center justify-between gap-2"
              >
                <span className="text-sm text-gray-800 font-medium truncate">{ex.nome}</span>
                {ex.grupo && (
                  <span className="text-xs text-gray-400 flex-shrink-0 bg-gray-100 px-2 py-0.5 rounded-full">{ex.grupo}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Exercise item (inside drawer) ───────────────────── */
function ExerciseItem({ ex, idx, total, onUpdate, onRemove, onMoveUp, onMoveDown, onCompound }: {
  ex:          SessaoEx;
  idx:         number;
  total:       number;
  onUpdate:    (patch: Partial<SessaoEx>) => void;
  onRemove:    () => void;
  onMoveUp:    () => void;
  onMoveDown:  () => void;
  onCompound:  (type: CompoundType) => void;
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

  const TIPOS: { value: TipoSerie; label: string }[] = [
    { value: "repeticoes", label: "Repetições" },
    { value: "minutos",    label: "Minutos"    },
    { value: "segundos",   label: "Segundos"   },
    { value: "livre",      label: "Livre"      },
  ];

  function changeTipo(t: TipoSerie) {
    onUpdate({ tipo: t, series_data: [defaultSerie(t)] });
  }

  const compoundLabel: Record<number, string> = { 1: "Bi-set", 2: "Tri-set", 3: "Super-set" };

  return (
    <div className="border border-gray-200 rounded-xl overflow-visible">
      {ex.compound_group !== null && (
        <div className="bg-red-50 px-4 py-1 text-xs font-semibold text-red-500 border-b border-red-100">
          {compoundLabel[ex.compound_group] ?? "Combinado"}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 cursor-grab" />
        <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}.</span>
        <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{ex.exercise_nome}</span>

        {/* Type selector */}
        <select
          value={ex.tipo}
          onChange={e => changeTipo(e.target.value as TipoSerie)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none text-gray-600 bg-white cursor-pointer"
        >
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {/* 3-dot menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-30 bg-white border border-gray-100 rounded-xl shadow-xl py-1 min-w-[148px]">
              {idx > 0 && (
                <button onClick={() => { setMenuOpen(false); onMoveUp(); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  ↑ Mover para cima
                </button>
              )}
              {idx < total - 1 && (
                <button onClick={() => { setMenuOpen(false); onMoveDown(); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  ↓ Mover para baixo
                </button>
              )}
              <div className="border-t border-gray-100 my-1" />
              {(["bi-set","tri-set","super-set"] as CompoundType[]).map(c => (
                <button key={c} onClick={() => { setMenuOpen(false); onCompound(c); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 capitalize">
                  {c.replace("-", "‑")}
                </button>
              ))}
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => { setMenuOpen(false); onRemove(); }}
                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50">
                Remover exercício
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Series */}
      <div className="px-4 py-3">
        <SeriesTable
          tipo={ex.tipo}
          series={ex.series_data}
          onChange={s => onUpdate({ series_data: s })}
        />
      </div>
    </div>
  );
}

/* ── Session drawer editor ───────────────────────────── */
function SessionEditor({ sessionId, contractorId, allExercises, onClose, onSaved }: {
  sessionId:    string | null;
  contractorId: string;
  allExercises: ExOption[];
  onClose:      () => void;
  onSaved:      () => void;
}) {
  const [nome,       setNome]       = useState("");
  const [exercises,  setExercises]  = useState<SessaoEx[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [loading,    setLoading]    = useState(!!sessionId);

  const sidRef      = useRef<string | null>(sessionId);
  const onSavedRef  = useRef(onSaved);
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
          .map((e: any) => ({
            _tempId:       tempId(),
            id:            e.id,
            exercise_id:   e.exercise_id,
            exercise_nome: e.exercise_nome,
            ordem:         e.ordem,
            tipo:          e.tipo as TipoSerie,
            series_data:   Array.isArray(e.series_data) ? e.series_data : [defaultSerie(e.tipo)],
            compound_group: e.compound_group ?? null,
          }));
        setExercises(exs);
        setLoading(false);
      });
  }, [sessionId]);

  /* Auto-save (debounced 800ms) */
  useEffect(() => {
    if (loading || !nome.trim()) return;

    const timer = setTimeout(async () => {
      setSaveStatus("saving");

      let sid = sidRef.current;
      if (!sid) {
        const { data } = await supabase
          .from("sessions")
          .insert({ contractor_id: contractorId, nome: nome.trim() })
          .select("id").single();
        if (!data) { setSaveStatus("idle"); return; }
        sid = (data as any).id;
        sidRef.current = sid;
      } else {
        await supabase
          .from("sessions")
          .update({ nome: nome.trim(), updated_at: new Date().toISOString() })
          .eq("id", sid);
      }

      /* Replace all exercises */
      await supabase.from("session_exercises").delete().eq("session_id", sid!);
      if (exercises.length > 0) {
        await supabase.from("session_exercises").insert(
          exercises.map((e, i) => ({
            session_id:     sid!,
            exercise_id:    e.exercise_id,
            exercise_nome:  e.exercise_nome,
            ordem:          i,
            tipo:           e.tipo,
            series_data:    e.series_data as unknown as import("@/integrations/supabase/types").Json,
            compound_group: e.compound_group ?? null,
          }))
        );
      }

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
      onSavedRef.current();
    }, 800);

    return () => clearTimeout(timer);
  }, [nome, exercises, loading, contractorId]);

  /* Exercise CRUD */
  function addExercise(ex: ExOption) {
    setExercises(prev => [...prev, {
      _tempId:       tempId(),
      exercise_id:   ex.id,
      exercise_nome: ex.nome,
      ordem:         prev.length,
      tipo:          "repeticoes",
      series_data:   [defaultSerie("repeticoes")],
      compound_group: null,
    }]);
  }

  function updateEx(tid: string, patch: Partial<SessaoEx>) {
    setExercises(prev => prev.map(e => e._tempId === tid ? { ...e, ...patch } : e));
  }

  function removeEx(tid: string) {
    setExercises(prev => prev.filter(e => e._tempId !== tid));
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    setExercises(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveDown(idx: number) {
    setExercises(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  const COMPOUND_MAP: Record<CompoundType, number> = { "bi-set": 1, "tri-set": 2, "super-set": 3 };
  function setCompound(tid: string, type: CompoundType) {
    setExercises(prev => prev.map(e =>
      e._tempId === tid ? { ...e, compound_group: COMPOUND_MAP[type] } : e
    ));
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">
            {sessionId ? "Editar sessão" : "Nova sessão"}
          </h2>
          <div className="flex items-center gap-3">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-xs text-green-500">
                <Check className="w-3 h-3" /> Salvo automaticamente
              </span>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-red-400" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Name */}
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Nome da sessão *"
              autoFocus={!sessionId}
              className="w-full border-0 border-b-2 border-gray-200 pb-2 text-lg font-bold text-gray-900 placeholder-gray-300 focus:outline-none focus:border-red-400 transition-colors bg-transparent"
            />

            {!nome.trim() ? (
              <p className="text-sm text-gray-400 italic">
                Preencha o nome da sessão para adicionar exercícios.
              </p>
            ) : (
              <>
                {/* Exercise list */}
                {exercises.length > 0 && (
                  <div className="space-y-3">
                    {exercises.map((ex, idx) => (
                      <ExerciseItem
                        key={ex._tempId}
                        ex={ex}
                        idx={idx}
                        total={exercises.length}
                        onUpdate={p => updateEx(ex._tempId, p)}
                        onRemove={() => removeEx(ex._tempId)}
                        onMoveUp={() => moveUp(idx)}
                        onMoveDown={() => moveDown(idx)}
                        onCompound={t => setCompound(ex._tempId, t)}
                      />
                    ))}
                  </div>
                )}

                {/* Add exercise */}
                <ExerciseSearch exercises={allExercises} onSelect={addExercise} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Pagination ──────────────────────────────────────── */
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

/* ── Main page ───────────────────────────────────────── */
export default function SessoesPage() {
  const { user } = useAuth();

  const [sessions,     setSessions]     = useState<Sessao[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [page,         setPage]         = useState(1);
  const [perPage,      setPerPage]      = useState(20);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [editId,       setEditId]       = useState<string | null>(null);
  const [deleteId,     setDeleteId]     = useState<string | null>(null);
  const [allExercises, setAllExercises] = useState<ExOption[]>([]);

  /* Load exercises for the search dropdown */
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

    /* Count exercises per session */
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

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen bg-gray-50">

        {/* Toolbar */}
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-3">
          <h1 className="text-base font-bold text-gray-800 mr-2">Sessões</h1>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar"
              className="text-sm text-gray-700 placeholder-gray-400 focus:outline-none bg-transparent w-44"
            />
            <Search className="w-4 h-4 text-gray-400" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => { setEditId(null); setDrawerOpen(true); }}
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
        <div className="flex-1 mx-6 my-4 bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_160px_140px_80px] border-b border-gray-100 px-4 py-2.5 text-xs font-semibold text-gray-500">
            <span>Nome</span>
            <span>Nº de exercícios</span>
            <span>Criado em</span>
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
                onClick={() => { setEditId(null); setDrawerOpen(true); }}
                className="text-xs text-red-500 font-semibold hover:underline"
              >
                + Criar primeira sessão
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {sessions.map(s => (
                <div
                  key={s.id}
                  className="grid grid-cols-[1fr_160px_140px_80px] px-4 py-2.5 items-center hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-800 truncate">{s.nome}</span>
                  <span className="text-sm text-gray-500">{s.exercise_count}</span>
                  <span className="text-xs text-gray-500">{fmtDate(s.created_at)}</span>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => { setEditId(s.id); setDrawerOpen(true); }}
                      className="p-1 rounded text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(s.id)}
                      className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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

      {/* Session editor drawer */}
      {drawerOpen && (
        <SessionEditor
          sessionId={editId}
          contractorId={user?.contractorId ?? ""}
          allExercises={allExercises}
          onClose={() => { setDrawerOpen(false); setEditId(null); }}
          onSaved={loadSessions}
        />
      )}

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
