import { useState, useEffect, useCallback } from "react";
import {
  Search, SlidersHorizontal, Pencil, Trash2,
  Dumbbell, X, Loader2, ChevronLeft, ChevronRight,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ExGroup {
  id:         string;
  nome:       string;
  created_at: string;
}

/* ── Modal create / edit ─────────────────────────────── */
function GrupoModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: ExGroup;
  onClose: () => void;
  onSaved: (g: ExGroup) => void;
}) {
  const { user } = useAuth();
  const isEdit   = !!initial;
  const [nome,   setNome]   = useState(initial?.nome ?? "");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  async function handleSave() {
    if (!nome.trim()) { setError("Descrição é obrigatória."); return; }
    if (!user?.contractorId) return;
    setSaving(true); setError("");

    if (isEdit) {
      const { data, error: dbErr } = await supabase
        .from("exercise_groups")
        .update({ nome: nome.trim() })
        .eq("id", initial!.id)
        .select().single();
      setSaving(false);
      if (dbErr || !data) { setError("Erro ao salvar. Tente novamente."); return; }
      onSaved(data as ExGroup);
    } else {
      const { data, error: dbErr } = await supabase
        .from("exercise_groups")
        .insert({ contractor_id: user.contractorId!, nome: nome.trim() })
        .select().single();
      setSaving(false);
      if (dbErr || !data) { setError("Erro ao salvar. Tente novamente."); return; }
      onSaved(data as ExGroup);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">

        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
            <Dumbbell className="w-4 h-4 text-red-500" />
          </div>
          <h2 className="text-base font-bold text-gray-900 flex-1">
            {isEdit ? "Editar grupo de exercício" : "Novo grupo de exercício"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            placeholder="Descrição *"
            autoFocus
            className="w-full border-0 border-b border-gray-200 pb-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-red-400 transition-colors bg-transparent"
          />
        </div>

        <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm font-bold text-red-500 hover:underline">
            CANCELAR
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-red-600 text-white text-sm font-bold px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────── */
export default function GruposExerciciosPage() {
  const { user } = useAuth();

  const [groups,     setGroups]     = useState<ExGroup[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [page,       setPage]       = useState(1);
  const [perPage,    setPerPage]    = useState(20);
  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState<ExGroup | undefined>(undefined);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.contractorId) return;
    setLoading(true);
    const from = (page - 1) * perPage;
    const to   = from + perPage - 1;

    let q = supabase
      .from("exercise_groups")
      .select("id, nome, created_at", { count: "exact" })
      .eq("contractor_id", user.contractorId!);

    if (search.trim()) q = q.ilike("nome", `%${search.trim()}%`);

    const { data, count } = await q.order("nome").range(from, to);
    setGroups((data as ExGroup[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [user, page, perPage, search]);

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    await supabase.from("exercise_groups").delete().eq("id", id);
    setDeleteId(null);
    setGroups(prev => prev.filter(g => g.id !== id));
    setTotal(prev => prev - 1);
  }

  function handleSaved(g: ExGroup) {
    setShowModal(false);
    setEditTarget(undefined);
    const idx = groups.findIndex(x => x.id === g.id);
    if (idx >= 0) {
      setGroups(prev => prev.map(x => x.id === g.id ? g : x));
    } else {
      load();
    }
  }

  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const fromRow  = total === 0 ? 0 : (page - 1) * perPage + 1;
  const toRow    = Math.min(page * perPage, total);

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen bg-gray-50">

        {/* Toolbar */}
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-3">
          <h1 className="text-base font-bold text-gray-800 mr-2">Grupos de exercícios</h1>
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
              onClick={() => { setEditTarget(undefined); setShowModal(true); }}
              className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              + GRUPO DE EXERCÍCIO
            </button>
            <button className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              <SlidersHorizontal className="w-3.5 h-3.5" /> FILTROS
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 mx-6 my-4 bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px] border-b border-gray-100 px-4 py-2.5 text-xs font-semibold text-gray-500">
            <span>Descrição</span>
            <span />
          </div>

          {/* Rows */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-red-400" />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Dumbbell className="w-10 h-10 text-gray-200" />
              <p className="text-sm text-gray-400">Nenhum grupo encontrado</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {groups.map(g => (
                <div
                  key={g.id}
                  className="grid grid-cols-[1fr_80px] px-4 py-2.5 items-center hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm text-gray-800">{g.nome}</span>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => { setEditTarget(g); setShowModal(true); }}
                      className="p-1 rounded text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(g.id)}
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
          <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-100 bg-white text-xs text-gray-600">
            <span>Página</span>
            <select
              value={page}
              onChange={e => setPage(Number(e.target.value))}
              className="border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none"
            >
              {Array.from({ length: lastPage }, (_, i) => i + 1).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <span>Exibir</span>
            <select
              value={perPage}
              onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none"
            >
              {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="flex-1 text-center">{fromRow}–{toRow} de {total}</span>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(lastPage, p + 1))}
              disabled={page === lastPage}
              className="disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Create / Edit modal */}
      {showModal && (
        <GrupoModal
          initial={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(undefined); }}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 mb-2">Excluir grupo</h3>
            <p className="text-sm text-gray-500 mb-5">
              Tem certeza que deseja excluir este grupo? Exercícios vinculados perderão o grupo.
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
