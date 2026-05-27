import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, SlidersHorizontal, Pencil, Trash2,
  ChevronDown, X, ImageIcon, Info, Loader2, HelpCircle,
  ChevronLeft, ChevronRight, Dumbbell, Play,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ── Types ───────────────────────────────────────────── */
interface ExGroup { id: string; nome: string }
interface Exercise {
  id:                string;
  nome:              string;
  grupo_id:          string | null;
  intensidade:       "facil" | "intermediario" | "dificil" | null;
  nome_impressao:    string | null;
  equipamento:       string | null;
  descricao:         string | null;
  demonstracao_tipo: "imagem" | "video" | null;
  demonstracao_url:  string | null;
  criado_por:        string;
  created_at:        string;
  exercise_groups:   { nome: string } | null;
}

const INTENSIDADE_LABEL: Record<string, string> = {
  facil: "Fácil", intermediario: "Intermediário", dificil: "Difícil",
};

/* ── Custom Intensidade Select ───────────────────────── */
function IntensidadeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const OPTS = [
    { value: "facil",        label: "Fácil" },
    { value: "intermediario",label: "Intermediário" },
    { value: "dificil",      label: "Difícil" },
  ];

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  const selected = OPTS.find(o => o.value === value);
  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 border-b border-gray-300 pb-2 cursor-pointer select-none"
      >
        {selected
          ? <span className="flex-1 text-sm text-gray-800">{selected.label}</span>
          : <span className="flex-1 text-sm text-gray-400">Intensidade</span>
        }
        {selected && (
          <button
            onClick={e => { e.stopPropagation(); onChange(""); }}
            className="text-gray-400 hover:text-gray-600 text-base leading-none px-0.5"
          >×</button>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 mt-1 overflow-hidden">
          {OPTS.map(opt => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                value === opt.value ? "bg-red-50 text-red-600" : "text-gray-700 hover:bg-red-50"
              }`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Custom Grupo Select ─────────────────────────────── */
function GrupoSelect({ value, onChange, groups }: {
  value: string; onChange: (v: string) => void; groups: ExGroup[]
}) {
  const [open, setOpen] = useState(false);
  const filtered = groups.filter(g => g.nome.toLowerCase().includes(value.toLowerCase()));

  return (
    <div className="relative">
      <div className="flex items-center border-b border-gray-300 pb-2">
        <input
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Grupo de exercícios *"
          className="flex-1 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
        />
        <ChevronDown className="w-4 h-4 text-gray-400 cursor-pointer" onClick={() => setOpen(v => !v)} />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 mt-1 max-h-40 overflow-y-auto">
          {filtered.map(g => (
            <div
              key={g.id}
              onMouseDown={() => { onChange(g.nome); setOpen(false); }}
              className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                value === g.nome ? "bg-red-50 text-red-600" : "text-gray-700 hover:bg-red-50"
              }`}
            >
              {g.nome}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Name Help Modal ─────────────────────────────────── */
function NomeHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center">
            <HelpCircle className="w-4 h-4 text-red-500" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Padronize o nome dos seus exercícios</h3>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="text-xs text-gray-600 space-y-1 leading-relaxed">
          <p>Use a seguinte ordem para nomear os exercícios:</p>
          <p>- Segmento, músculo alvo ou articulação envolvida</p>
          <p>- Equipamento utilizado ou acessório</p>
          <p>- Variação, dinâmica ou posicionamento</p>
          <p className="mt-2">Ex: Elevação Lateral - Crossover - Polia Cruzada - Curvado à frente</p>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="text-xs font-bold text-red-500 hover:underline">FECHAR</button>
        </div>
      </div>
    </div>
  );
}

/* ── Exercise Modal ──────────────────────────────────── */
function ExercicioModal({
  exercise, groups, onClose, onSaved,
}: {
  exercise: Exercise | null;
  groups:   ExGroup[];
  onClose:  () => void;
  onSaved:  (e: Exercise) => void;
}) {
  const { user } = useAuth();
  const fileRef  = useRef<HTMLInputElement>(null);
  const isEdit   = !!exercise;

  const [nome,           setNome]           = useState(exercise?.nome              ?? "");
  const [intensidade,    setIntensidade]    = useState(exercise?.intensidade       ?? "");
  const [grupoNome,      setGrupoNome]      = useState(exercise?.exercise_groups?.nome ?? "");
  const [nomeImpressao,  setNomeImpressao]  = useState(exercise?.nome_impressao    ?? "");
  const [equipamento,    setEquipamento]    = useState(exercise?.equipamento       ?? "");
  const [descricao,      setDescricao]      = useState(exercise?.descricao         ?? "");
  const [demoTipo,       setDemoTipo]       = useState<"imagem" | "video">(exercise?.demonstracao_tipo ?? "imagem");
  const [demoUrl,        setDemoUrl]        = useState(exercise?.demonstracao_url  ?? "");
  const [showHelp,       setShowHelp]       = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError("Imagem muito grande. Máximo 3MB."); return; }
    const reader = new FileReader();
    reader.onload = ev => setDemoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!nome.trim())     { setError("Nome é obrigatório.");  return; }
    if (!grupoNome.trim()){ setError("Grupo é obrigatório."); return; }
    if (!user?.contractorId) return;
    setSaving(true); setError("");

    /* find-or-create group */
    let grupoId: string | null = null;
    const { data: existGrp } = await supabase
      .from("exercise_groups")
      .select("id")
      .eq("contractor_id", user.contractorId!)
      .ilike("nome", grupoNome.trim())
      .limit(1);
    if (existGrp?.length) {
      grupoId = existGrp[0].id;
    } else {
      const { data: newGrp } = await supabase
        .from("exercise_groups")
        .insert({ contractor_id: user.contractorId!, nome: grupoNome.trim() })
        .select("id").single();
      grupoId = newGrp?.id ?? null;
    }

    const payload = {
      contractor_id:     user.contractorId!,
      nome:              nome.trim(),
      grupo_id:          grupoId,
      intensidade:       (intensidade || null) as Exercise["intensidade"],
      nome_impressao:    nomeImpressao.trim() || null,
      equipamento:       equipamento.trim() || null,
      descricao:         descricao.trim() || null,
      demonstracao_tipo: (demoUrl ? demoTipo : null) as Exercise["demonstracao_tipo"],
      demonstracao_url:  demoUrl || null,
    };

    let saved: Exercise | null = null;
    if (isEdit) {
      const { data } = await supabase
        .from("exercises")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", exercise.id)
        .select("*, exercise_groups(nome)").single();
      saved = data as Exercise;
    } else {
      const { data } = await supabase
        .from("exercises")
        .insert([payload])
        .select("*, exercise_groups(nome)").single();
      saved = data as Exercise;
    }

    setSaving(false);
    if (!saved) { setError("Erro ao salvar. Tente novamente."); return; }
    onSaved(saved);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl my-4">

          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
              <Dumbbell className="w-4 h-4 text-red-500" />
            </div>
            <h2 className="text-base font-bold text-gray-900 flex-1">
              {isEdit ? "Editar exercício" : "Novo exercício"}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5">
            {error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            {/* Dados principais */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-5">
              <p className="text-xs font-semibold text-gray-500">Dados principais</p>

              {/* Row 1: Nome | Intensidade */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-1 border-b border-gray-300 pb-2">
                    <input
                      value={nome}
                      onChange={e => setNome(e.target.value)}
                      placeholder="Nome *"
                      className="flex-1 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
                    />
                    <button onClick={() => setShowHelp(true)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <IntensidadeSelect value={intensidade} onChange={setIntensidade} />
              </div>

              {/* Row 2: Grupo | Nome impressão */}
              <div className="grid grid-cols-2 gap-4">
                <GrupoSelect value={grupoNome} onChange={setGrupoNome} groups={groups} />
                <div>
                  <input
                    value={nomeImpressao}
                    onChange={e => setNomeImpressao(e.target.value)}
                    placeholder="Nome de impressão"
                    className="w-full border-b border-gray-300 pb-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Row 3: Equipamento | Descrição */}
              <div className="grid grid-cols-2 gap-4">
                <input
                  value={equipamento}
                  onChange={e => setEquipamento(e.target.value)}
                  placeholder="Equipamento"
                  className="border-b border-gray-300 pb-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
                />
                <textarea
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Descrição"
                  rows={3}
                  className="border-b border-gray-300 pb-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent resize-none"
                />
              </div>
            </div>

            {/* Demonstração do exercício */}
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 mb-3">Demonstração do exercício</p>

              {/* Imagem / Vídeo radios */}
              <div className="flex items-center gap-6 mb-4">
                {(["imagem","video"] as const).map(tipo => (
                  <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => setDemoTipo(tipo)}
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        demoTipo === tipo ? "border-red-500" : "border-gray-300"
                      }`}
                    >
                      {demoTipo === tipo && <div className="w-2 h-2 rounded-full bg-red-500" />}
                    </div>
                    <span className="text-sm text-gray-700 capitalize">
                      {tipo === "imagem" ? "Imagem" : "Vídeo"}
                    </span>
                  </label>
                ))}
              </div>

              {demoTipo === "imagem" ? (
                <div className="flex flex-col items-center gap-3">
                  {demoUrl ? (
                    <img
                      src={demoUrl}
                      alt="Exercício"
                      className="max-w-xs max-h-52 rounded-xl object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-red-200" />
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="bg-red-600 text-white text-xs font-bold px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    {demoUrl ? "ALTERAR IMAGEM" : "SELECIONAR IMAGEM"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Link vídeo (Youtube)</p>
                    <input
                      value={demoUrl}
                      onChange={e => setDemoUrl(e.target.value)}
                      placeholder="Exemplo: https://www.youtube.com/embed/KRrp4Myr-Bg"
                      className="w-full border-b border-gray-300 pb-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
                    />
                  </div>
                  {demoUrl && (
                    <div className="relative">
                      <div className="rounded-xl overflow-hidden border border-gray-200" style={{ aspectRatio: "16/9", maxWidth: 360 }}>
                        <iframe
                          key={demoUrl}
                          src={demoUrl}
                          className="w-full h-full"
                          allow="autoplay; encrypted-media"
                          allowFullScreen
                          title="Preview vídeo"
                        />
                      </div>
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
                        <Play className="w-3 h-3" /> Preview do vídeo
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                    <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-600 leading-relaxed">
                      Use o link embed do YouTube. Exemplo:<br />
                      <code className="text-blue-700">https://www.youtube.com/embed/ID_DO_VIDEO</code>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100">
            <button onClick={onClose} className="text-sm font-bold text-red-500 hover:underline">
              CANCELAR
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-red-600 text-white text-sm font-bold px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} SALVAR
            </button>
          </div>
        </div>
      </div>

      {showHelp && <NomeHelp onClose={() => setShowHelp(false)} />}
    </>
  );
}

/* ── Pagination ──────────────────────────────────────── */
function Pagination({
  page, perPage, total, onPage, onPerPage,
}: {
  page: number; perPage: number; total: number;
  onPage: (p: number) => void; onPerPage: (n: number) => void;
}) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to   = Math.min(page * perPage, total);

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-100 bg-white text-xs text-gray-600">
      <span>Página</span>
      <select
        value={page}
        onChange={e => onPage(Number(e.target.value))}
        className="border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none"
      >
        {Array.from({ length: lastPage }, (_, i) => i + 1).map(p => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <span>Exibir</span>
      <select
        value={perPage}
        onChange={e => { onPerPage(Number(e.target.value)); onPage(1); }}
        className="border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none"
      >
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

/* ── Main Page ───────────────────────────────────────── */
export default function ExerciciosPage() {
  const { user } = useAuth();

  const [exercises,    setExercises]    = useState<Exercise[]>([]);
  const [groups,       setGroups]       = useState<ExGroup[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [page,         setPage]         = useState(1);
  const [perPage,      setPerPage]      = useState(20);
  const [editExercise, setEditExercise] = useState<Exercise | null>(null);
  const [showModal,    setShowModal]    = useState(false);
  const [deleteId,     setDeleteId]     = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    if (!user?.contractorId) return;
    const { data } = await supabase
      .from("exercise_groups")
      .select("id, nome")
      .eq("contractor_id", user.contractorId!)
      .order("nome");
    setGroups((data as ExGroup[]) ?? []);
  }, [user]);

  const loadExercises = useCallback(async () => {
    if (!user?.contractorId) return;
    setLoading(true);
    const from = (page - 1) * perPage;
    const to   = from + perPage - 1;

    let query = supabase
      .from("exercises")
      .select("*, exercise_groups(nome)", { count: "exact" })
      .eq("contractor_id", user.contractorId!);

    if (search.trim()) query = query.ilike("nome", `%${search.trim()}%`);

    const { data, count } = await query.order("nome").range(from, to);
    setExercises((data as Exercise[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [user, page, perPage, search]);

  useEffect(() => { loadGroups(); }, [loadGroups]);
  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { loadExercises(); }, [loadExercises]);

  async function handleDelete(id: string) {
    await supabase.from("exercises").delete().eq("id", id);
    setDeleteId(null);
    setExercises(prev => prev.filter(e => e.id !== id));
    setTotal(prev => prev - 1);
  }

  function handleSaved(saved: Exercise) {
    setShowModal(false);
    setEditExercise(null);
    if (exercises.find(e => e.id === saved.id)) {
      setExercises(prev => prev.map(e => e.id === saved.id ? saved : e));
    } else {
      loadExercises();
      loadGroups();
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen bg-gray-50">

        {/* Toolbar */}
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-3">
          <h1 className="text-base font-bold text-gray-800 mr-2">Exercícios</h1>
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
              onClick={() => { setEditExercise(null); setShowModal(true); }}
              className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              + EXERCÍCIO
            </button>
            <button className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              <SlidersHorizontal className="w-3.5 h-3.5" /> FILTROS
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 mx-6 my-4 bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="grid grid-cols-[1fr_180px_120px_120px_80px] border-b border-gray-100 px-4 py-2.5 text-xs font-semibold text-gray-500">
            <span>Descrição</span>
            <span>Grupo de exercício</span>
            <span>Intensidade</span>
            <span>Criado por</span>
            <span />
          </div>

          {/* Rows */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-red-400" />
            </div>
          ) : exercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Dumbbell className="w-10 h-10 text-gray-200" />
              <p className="text-sm text-gray-400">Nenhum exercício encontrado</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {exercises.map(ex => (
                <div
                  key={ex.id}
                  className="grid grid-cols-[1fr_180px_120px_120px_80px] px-4 py-2.5 items-center hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm text-gray-800 truncate pr-3">{ex.nome}</span>
                  <span>
                    {ex.exercise_groups?.nome ? (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full truncate max-w-[160px] inline-block">
                        {ex.exercise_groups.nome}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </span>
                  <span className="text-xs text-gray-600">
                    {ex.intensidade ? INTENSIDADE_LABEL[ex.intensidade] : "—"}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">{ex.criado_por === "usuario" ? "Usuário" : ex.criado_por}</span>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => { setEditExercise(ex); setShowModal(true); }}
                      className="p-1 rounded text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(ex.id)}
                      className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          <Pagination
            page={page} perPage={perPage} total={total}
            onPage={setPage} onPerPage={setPerPage}
          />
        </div>
      </div>

      {/* Exercise modal */}
      {showModal && (
        <ExercicioModal
          exercise={editExercise}
          groups={groups}
          onClose={() => { setShowModal(false); setEditExercise(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 mb-2">Excluir exercício</h3>
            <p className="text-sm text-gray-500 mb-5">Tem certeza que deseja excluir este exercício? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="text-sm font-bold text-gray-500 hover:underline">Cancelar</button>
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
