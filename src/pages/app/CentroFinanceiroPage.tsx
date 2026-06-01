import { useState, useEffect } from "react";
import { Plus, Search, Pencil, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Tipo = "custo" | "receita";

interface CentroRecord {
  id: string;
  descricao: string;
  created_at: string;
}

interface Props { tipo: Tipo }

const CONFIG = {
  custo: {
    titulo:       "Centros de custo",
    labelNovo:    "+ CENTRO DE CUSTO",
    labelModal:   "centro de custo",
    table:        "centros_custo" as const,
    Icon:         TrendingDown,
    iconCls:      "text-red-500",
    iconBg:       "bg-red-50",
  },
  receita: {
    titulo:       "Centros de receita",
    labelNovo:    "+ CENTRO DE RECEITA",
    labelModal:   "centro de receita",
    table:        "centros_receita" as const,
    Icon:         TrendingUp,
    iconCls:      "text-green-600",
    iconBg:       "bg-green-50",
  },
};

// ── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  tipo: Tipo;
  editing: CentroRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

function CentroModal({ tipo, editing, onClose, onSaved }: ModalProps) {
  const { user } = useAuth();
  const cfg = CONFIG[tipo];
  const [descricao, setDescricao] = useState(editing?.descricao ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user?.contractorId) return;
    const d = descricao.trim();
    if (!d) { toast.error("Informe a descrição."); return; }
    setSaving(true);
    const payload = { contractor_id: user.contractorId, descricao: d };
    const { error } = editing
      ? await supabase.from(cfg.table).update({ descricao: d }).eq("id", editing.id)
      : await supabase.from(cfg.table).insert(payload);
    if (error) { toast.error("Erro ao salvar."); setSaving(false); return; }
    toast.success(editing ? "Atualizado com sucesso." : "Cadastrado com sucesso.");
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg ${cfg.iconBg} flex items-center justify-center`}>
              <cfg.Icon className={`w-4 h-4 ${cfg.iconCls}`} />
            </div>
            <h2 className="text-base font-bold text-gray-900 capitalize">
              {editing ? `Editar ${cfg.labelModal}` : `Novo ${cfg.labelModal}`}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição *</label>
          <input
            autoFocus
            type="text"
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            placeholder="Ex: Energia Elétrica"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-800 px-3 py-2 transition-colors">
            CANCELAR
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? "Salvando..." : "SALVAR"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CentroFinanceiroPage({ tipo }: Props) {
  const { user } = useAuth();
  const cfg = CONFIG[tipo];

  const [all, setAll]             = useState<CentroRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<CentroRecord | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);
    const { data } = await supabase
      .from(cfg.table)
      .select("*")
      .eq("contractor_id", user.contractorId)
      .order("descricao", { ascending: true });
    setAll((data ?? []) as CentroRecord[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user, tipo]);

  const filtered = all.filter(r =>
    !search || r.descricao.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(id: string) {
    const { error } = await supabase.from(cfg.table).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir."); return; }
    toast.success("Excluído com sucesso.");
    setDeleteId(null);
    load();
  }

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-900 flex-shrink-0">{cfg.titulo}</h1>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" /> {cfg.labelNovo}
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto bg-gray-50 px-8 py-6">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className={`w-14 h-14 rounded-2xl ${cfg.iconBg} flex items-center justify-center`}>
                    <cfg.Icon className={`w-7 h-7 opacity-30 ${cfg.iconCls}`} />
                  </div>
                  <p className="text-sm text-gray-400 font-medium">
                    {all.length === 0 ? `Nenhum ${cfg.labelModal} cadastrado.` : "Nenhum resultado encontrado."}
                  </p>
                  {all.length === 0 && (
                    <button onClick={() => setShowModal(true)} className="text-xs font-semibold text-primary hover:underline">
                      Adicionar primeiro →
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Cabeçalho da tabela */}
                  <div className="px-6 py-3 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-500">Descrição</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {filtered.map(r => (
                      <div key={r.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors group">
                        <span className="text-sm text-gray-800">{r.descricao}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditing(r); setShowModal(true); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(r.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Rodapé */}
                  <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400">
                    {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </AppLayout>

      {/* Modal cadastro/edição */}
      {showModal && (
        <CentroModal
          tipo={tipo}
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={load}
        />
      )}

      {/* Confirm exclusão */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Excluir registro?</h3>
            <p className="text-sm text-gray-500 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="text-primary font-semibold text-sm hover:underline px-2">
                CANCELAR
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="bg-red-500 text-white font-semibold text-sm px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
              >
                EXCLUIR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
