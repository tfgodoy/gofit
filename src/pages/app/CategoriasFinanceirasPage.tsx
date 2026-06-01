import { useState, useEffect, useRef } from "react";
import { Plus, MoreVertical, Pencil, Trash2, Tags } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Tipo = "despesa" | "receita";

interface Categoria {
  id: string;
  nome: string;
  tipo: Tipo;
  considerar_cac: boolean;
  subcategorias?: Subcategoria[];
}

interface Subcategoria {
  id: string;
  categoria_id: string;
  nome: string;
}

/* ── Menu ⋮ ─────────────────────────────────────────────────────────── */
function MenuAcoes({
  onEditar,
  onRemover,
}: {
  onEditar: () => void;
  onRemover: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden">
          <button
            onClick={() => { setOpen(false); onEditar(); }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-gray-400" />
            Editar
          </button>
          <button
            onClick={() => { setOpen(false); onRemover(); }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remover
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Modal Categoria ─────────────────────────────────────────────────── */
function CategoriaModal({
  tipo,
  onClose,
  onSaved,
  editing,
}: {
  tipo: Tipo;
  onClose: () => void;
  onSaved: () => void;
  editing?: Categoria | null;
}) {
  const { user } = useAuth();
  const [nome, setNome] = useState(editing?.nome ?? "");
  const [cac, setCac] = useState(editing?.considerar_cac ?? false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user?.contractorId) return;
    if (!nome.trim()) { toast.error("Preencha a descrição."); return; }
    setSaving(true);
    const payload = { contractor_id: user.contractorId, nome: nome.trim(), tipo, considerar_cac: cac };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = editing
      ? await (supabase as any).from("categorias_financeiras").update(payload).eq("id", editing.id)
      : await (supabase as any).from("categorias_financeiras").insert(payload);
    if (error) { toast.error("Erro ao salvar categoria."); setSaving(false); return; }
    toast.success(editing ? "Categoria atualizada." : "Categoria criada.");
    onSaved(); onClose();
  }

  const tipoLabel = tipo === "despesa" ? "despesa" : "receita";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Tags className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-base font-bold text-gray-900">
            {editing ? `Editar categoria de ${tipoLabel}` : `Nova categoria de ${tipoLabel}`}
          </h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição *</label>
            <input
              autoFocus
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()}
              placeholder={`Nome da categoria de ${tipoLabel}`}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={cac}
              onChange={e => setCac(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20"
            />
            <span className="text-sm text-gray-600">Considerar no custo de aquisição de cliente (CAC)</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-800 px-3 py-2 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal Subcategoria ──────────────────────────────────────────────── */
function SubcategoriaModal({
  categoria,
  onClose,
  onSaved,
  editing,
}: {
  categoria: Categoria;
  onClose: () => void;
  onSaved: () => void;
  editing?: Subcategoria | null;
}) {
  const { user } = useAuth();
  const [nome, setNome] = useState(editing?.nome ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user?.contractorId) return;
    if (!nome.trim()) { toast.error("Preencha a descrição."); return; }
    setSaving(true);
    const payload = { contractor_id: user.contractorId, categoria_id: categoria.id, nome: nome.trim() };
    const { error } = editing
      ? await (supabase as any).from("subcategorias_financeiras").update(payload).eq("id", editing.id)
      : await (supabase as any).from("subcategorias_financeiras").insert(payload);
    if (error) { toast.error("Erro ao salvar subcategoria."); setSaving(false); return; }
    toast.success(editing ? "Subcategoria atualizada." : "Subcategoria criada.");
    onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
            <Tags className="w-4 h-4 text-sky-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {editing ? "Editar subcategoria" : "Nova subcategoria"}
            </h2>
            <p className="text-xs text-gray-400">{categoria.nome}</p>
          </div>
        </div>
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição *</label>
          <input
            autoFocus
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            placeholder="Nome da subcategoria"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-800 px-3 py-2 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Confirm Remover ─────────────────────────────────────────────────── */
function ConfirmModal({
  titulo,
  mensagem,
  onConfirm,
  onClose,
}: {
  titulo: string;
  mensagem: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-2">{titulo}</h3>
        <p className="text-sm text-gray-500 mb-6">{mensagem}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="text-primary font-semibold text-sm hover:underline px-2">
            CANCELAR
          </button>
          <button
            onClick={onConfirm}
            className="bg-red-500 text-white font-semibold text-sm px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            REMOVER
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function CategoriasFinanceirasPage() {
  const { user } = useAuth();
  const [aba, setAba] = useState<Tipo>("despesa");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalCat, setModalCat]     = useState(false);
  const [editCat, setEditCat]       = useState<Categoria | null>(null);
  const [modalSub, setModalSub]     = useState<Categoria | null>(null);
  const [editSub, setEditSub]       = useState<{ cat: Categoria; sub: Subcategoria } | null>(null);
  const [confirmCat, setConfirmCat] = useState<Categoria | null>(null);
  const [confirmSub, setConfirmSub] = useState<Subcategoria | null>(null);

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);
    const { data: cats } = await (supabase as any)
      .from("categorias_financeiras")
      .select("*")
      .eq("contractor_id", user.contractorId)
      .eq("tipo", aba)
      .order("nome", { ascending: true });

    const { data: subs } = await (supabase as any)
      .from("subcategorias_financeiras")
      .select("*")
      .eq("contractor_id", user.contractorId)
      .order("nome", { ascending: true });

    const result = ((cats ?? []) as Categoria[]).map(c => ({
      ...c,
      subcategorias: ((subs ?? []) as Subcategoria[]).filter(s => s.categoria_id === c.id),
    }));

    setCategorias(result);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user, aba]);

  async function handleRemoverCategoria(cat: Categoria) {
    const { error } = await (supabase as any).from("categorias_financeiras").delete().eq("id", cat.id);
    if (error) { toast.error("Erro ao remover categoria."); return; }
    toast.success("Categoria removida.");
    setConfirmCat(null);
    load();
  }

  async function handleRemoverSubcategoria(sub: Subcategoria) {
    const { error } = await (supabase as any).from("subcategorias_financeiras").delete().eq("id", sub.id);
    if (error) { toast.error("Erro ao remover subcategoria."); return; }
    toast.success("Subcategoria removida.");
    setConfirmSub(null);
    load();
  }

  const tipoLabel = aba === "despesa" ? "despesa" : "receita";

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <h1 className="text-lg font-bold text-gray-900">Categorias</h1>
            <div className="flex gap-0 mt-3 border-b border-gray-100 -mb-4">
              {(["despesa", "receita"] as Tipo[]).map(t => (
                <button
                  key={t}
                  onClick={() => setAba(t)}
                  className={`px-4 pb-3 text-xs font-semibold uppercase tracking-wide transition-colors border-b-2 -mb-px ${
                    aba === t
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Categorias de {t}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto bg-gray-50 px-8 py-6">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Sub-header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-700">Categorias de {tipoLabel}</h2>
                <button
                  onClick={() => setModalCat(true)}
                  className="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  CATEGORIA DE {tipoLabel.toUpperCase()}
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : categorias.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Tags className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">Nenhuma categoria de {tipoLabel} cadastrada.</p>
                  <button onClick={() => setModalCat(true)} className="text-xs font-semibold text-primary hover:underline">
                    Criar primeira categoria →
                  </button>
                </div>
              ) : (
                <div>
                  {categorias.map(cat => (
                    <div key={cat.id}>
                      {/* Categoria pai */}
                      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <span className="text-sm font-bold text-gray-800 uppercase tracking-wide">{cat.nome}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setModalSub(cat)}
                            className="inline-flex items-center gap-1.5 bg-sky-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-sky-600 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            SUBCATEGORIA
                          </button>
                          <MenuAcoes
                            onEditar={() => setEditCat(cat)}
                            onRemover={() => setConfirmCat(cat)}
                          />
                        </div>
                      </div>

                      {/* Subcategorias */}
                      {cat.subcategorias && cat.subcategorias.length > 0 ? (
                        cat.subcategorias.map(sub => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between px-6 py-3 pl-12 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            <span className="text-sm text-gray-600">{sub.nome}</span>
                            <MenuAcoes
                              onEditar={() => setEditSub({ cat, sub })}
                              onRemover={() => setConfirmSub(sub)}
                            />
                          </div>
                        ))
                      ) : (
                        <div className="px-12 py-3 border-b border-gray-100">
                          <span className="text-xs text-gray-400 italic">Nenhuma subcategoria</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </AppLayout>

      {(modalCat || editCat) && (
        <CategoriaModal
          tipo={aba}
          onClose={() => { setModalCat(false); setEditCat(null); }}
          onSaved={load}
          editing={editCat}
        />
      )}

      {modalSub && (
        <SubcategoriaModal
          categoria={modalSub}
          onClose={() => setModalSub(null)}
          onSaved={load}
        />
      )}

      {editSub && (
        <SubcategoriaModal
          categoria={editSub.cat}
          onClose={() => setEditSub(null)}
          onSaved={load}
          editing={editSub.sub}
        />
      )}

      {confirmCat && (
        <ConfirmModal
          titulo="Remover categoria?"
          mensagem={`A categoria "${confirmCat.nome}" e todas as suas subcategorias serão removidas. Esta ação não pode ser desfeita.`}
          onConfirm={() => handleRemoverCategoria(confirmCat)}
          onClose={() => setConfirmCat(null)}
        />
      )}

      {confirmSub && (
        <ConfirmModal
          titulo="Remover subcategoria?"
          mensagem={`A subcategoria "${confirmSub.nome}" será removida permanentemente.`}
          onConfirm={() => handleRemoverSubcategoria(confirmSub)}
          onClose={() => setConfirmSub(null)}
        />
      )}
    </>
  );
}
