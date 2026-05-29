import { useState, useEffect } from "react";
import { GraduationCap, Plus, Pencil, Trash2, Loader2, X, ChevronDown } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── types ──────────────────────────────────────────────────── */

interface GraduationLevel {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  descricao: string | null;
  modalidade_id: string | null;
}

interface Modalidade {
  id: string;
  descricao: string;
}

/* ── modal ──────────────────────────────────────────────────── */

const PRESET_COLORS = [
  "#ffffff", "#f3f4f6", "#fef9c3", "#fde68a", "#fca5a5",
  "#f97316", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899",
  "#1f2937", "#7c3aed", "#dc2626", "#0ea5e9", "#84cc16",
];

function LevelModal({
  level,
  modalidades,
  onSave,
  onClose,
}: {
  level: Partial<GraduationLevel> | null;
  modalidades: Modalidade[];
  onSave: (data: Omit<GraduationLevel, "id">) => Promise<void>;
  onClose: () => void;
}) {
  const [nome, setNome]               = useState(level?.nome ?? "");
  const [cor, setCor]                 = useState(level?.cor ?? "#6b7280");
  const [ordem, setOrdem]             = useState(level?.ordem ?? 0);
  const [descricao, setDescricao]     = useState(level?.descricao ?? "");
  const [modalidadeId, setModalidadeId] = useState(level?.modalidade_id ?? "");
  const [saving, setSaving]           = useState(false);

  async function handleSave() {
    if (!nome.trim()) { toast.error("Informe o nome do nível"); return; }
    setSaving(true);
    await onSave({
      nome: nome.trim(),
      cor,
      ordem: Number(ordem),
      descricao: descricao.trim() || null,
      modalidade_id: modalidadeId || null,
    });
    setSaving(false);
  }

  const inputClass =
    "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">
            {level?.id ? "Editar Nível" : "Novo Nível de Graduação"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nome *</label>
            <input
              autoFocus
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Faixa Branca, Nível 1, Bronze..."
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Cor</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setCor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition ${
                    cor === c ? "border-primary scale-110" : "border-gray-200 hover:border-gray-400"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={cor}
                onChange={e => setCor(e.target.value)}
                className="w-10 h-8 rounded cursor-pointer border border-gray-200"
              />
              <span className="text-xs text-gray-400">{cor}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Ordem</label>
              <input
                type="number"
                min={0}
                value={ordem}
                onChange={e => setOrdem(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Modalidade</label>
              <select
                value={modalidadeId}
                onChange={e => setModalidadeId(e.target.value)}
                className={inputClass}
              >
                <option value="">Todas</option>
                {modalidades.map(m => (
                  <option key={m.id} value={m.id}>{m.descricao}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={2}
              placeholder="Requisitos ou descrição opcional..."
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2"
          >
            CANCELAR
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── delete confirm ─────────────────────────────────────────── */

function DeleteConfirm({ nome, onConfirm, onCancel }: {
  nome: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-base font-bold text-gray-900 mb-2">Excluir nível</h3>
        <p className="text-sm text-gray-500 mb-5">
          Tem certeza que deseja excluir <strong>{nome}</strong>? Graduações existentes vinculadas a este nível também serão perdidas.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="text-sm font-bold text-gray-500 hover:underline">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="bg-red-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-red-700"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── page ───────────────────────────────────────────────────── */

export default function GraduacoesPage() {
  const { user } = useAuth();
  const [levels, setLevels]         = useState<GraduationLevel[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState<Partial<GraduationLevel> | null | false>(false);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [filterMod, setFilterMod]   = useState("");

  async function load() {
    if (!user) return;
    const [{ data: lvls }, { data: mods }] = await Promise.all([
      supabase
        .from("graduation_levels")
        .select("*")
        .eq("contractor_id", user.contractorId!)
        .order("ordem"),
      supabase
        .from("modalidades")
        .select("id, descricao")
        .eq("contractor_id", user.contractorId!)
        .eq("ativo", true)
        .order("descricao"),
    ]);
    setLevels((lvls ?? []) as GraduationLevel[]);
    setModalidades((mods ?? []) as Modalidade[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  async function handleSave(data: Omit<GraduationLevel, "id">) {
    if (!user) return;
    if ((modal as GraduationLevel)?.id) {
      await supabase
        .from("graduation_levels")
        .update(data)
        .eq("id", (modal as GraduationLevel).id);
    } else {
      await supabase
        .from("graduation_levels")
        .insert({ ...data, contractor_id: user.contractorId! });
    }
    toast.success("Nível salvo!");
    setModal(false);
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("graduation_levels").delete().eq("id", id);
    toast.success("Nível excluído");
    setDeleteId(null);
    load();
  }

  const filtered = filterMod
    ? levels.filter(l => l.modalidade_id === filterMod)
    : levels;

  const deleteTarget = deleteId ? levels.find(l => l.id === deleteId) : null;

  return (
    <AppLayout>
      <div className="px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Graduações</h1>
              <p className="text-sm text-gray-400">Faixas, cinturões e níveis de graduação</p>
            </div>
          </div>
          <button
            onClick={() => setModal({})}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            NOVO NÍVEL
          </button>
        </div>

        {/* Filter */}
        {modalidades.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500">Modalidade:</label>
            <div className="relative">
              <select
                value={filterMod}
                onChange={e => setFilterMod(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
              >
                <option value="">Todas</option>
                {modalidades.map(m => (
                  <option key={m.id} value={m.id}>{m.descricao}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-2 pointer-events-none" />
            </div>
          </div>
        )}

        {/* List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-300">
              <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
                <GraduationCap className="w-7 h-7 text-primary/30" />
              </div>
              <p className="text-sm text-gray-400 font-semibold">Nenhum nível cadastrado</p>
              <p className="text-xs text-gray-400">Clique em "NOVO NÍVEL" para criar o primeiro</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">NÍVEL</th>
                  <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">MODALIDADE</th>
                  <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3 hidden md:table-cell">DESCRIÇÃO</th>
                  <th className="text-center text-xs font-semibold text-gray-400 px-5 py-3">ORDEM</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(level => {
                  const modalidade = modalidades.find(m => m.id === level.modalidade_id);
                  return (
                    <tr key={level.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 group">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-5 h-5 rounded-full border border-gray-200 flex-shrink-0"
                            style={{ backgroundColor: level.cor }}
                          />
                          <span className="text-sm font-semibold text-gray-800">{level.nome}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500">
                        {modalidade?.descricao ?? <span className="text-gray-300 italic">Todas</span>}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-400 hidden md:table-cell">
                        {level.descricao ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-center text-sm text-gray-500">{level.ordem}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setModal(level)}
                            className="p-1.5 rounded hover:bg-gray-100"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => setDeleteId(level.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal !== false && (
        <LevelModal
          level={modal}
          modalidades={modalidades}
          onSave={handleSave}
          onClose={() => setModal(false)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          nome={deleteTarget.nome}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </AppLayout>
  );
}
