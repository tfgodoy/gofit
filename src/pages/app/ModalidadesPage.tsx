import { useState, useEffect } from "react";
import { Plus, Search, MoreVertical, ChevronLeft, ChevronRight, SlidersHorizontal, Globe } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ModalidadeFormModal, { getIcon } from "@/components/app/ModalidadeFormModal";

interface Modalidade {
  id: string;
  descricao: string;
  utiliza_agenda: boolean;
  utiliza_wod: boolean;
  exibir_wod_app: boolean;
  exibicao_wod: string;
  exibe_wod_antes_dia: boolean;
  dias_semana: string[];
  cor: string;
  icone: string;
  utiliza_gonutri: boolean;
  ativo: boolean;
  permite_agendamento_publico: boolean;
  created_at: string;
}

const PAGE_SIZE = 20;

export default function ModalidadesPage() {
  const { user } = useAuth();
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [filtered, setFiltered] = useState<Modalidade[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Modalidade | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);
    const { data } = await supabase
      .from("modalidades")
      .select("*")
      .eq("contractor_id", user.contractorId)
      .order("descricao", { ascending: true });
    setModalidades((data ?? []) as Modalidade[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    setFiltered(q ? modalidades.filter(m => m.descricao.toLowerCase().includes(q)) : modalidades);
    setPage(1);
  }, [search, modalidades]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const paginated = filtered.slice(start, start + PAGE_SIZE);

  async function handleDelete(id: string) {
    const { error } = await supabase.from("modalidades").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir modalidade."); return; }
    toast.success("Modalidade excluída.");
    setDeleteId(null);
    load();
  }

  async function handleToggleAgendamento(m: Modalidade) {
    const novo = !m.permite_agendamento_publico;
    await supabase.from("modalidades")
      .update({ permite_agendamento_publico: novo })
      .eq("id", m.id);
    toast.success(novo ? "Agendamento público habilitado." : "Agendamento público desabilitado.");
    setMenuOpen(null);
    load();
  }

  function openNew() { setEditing(null); setShowForm(true); }
  function openEdit(m: Modalidade) { setEditing(m); setMenuOpen(null); setShowForm(true); }

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-900 flex-shrink-0">Modalidades</h1>

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

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={openNew}
                  className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" /> MODALIDADE
                </button>
                <button className="inline-flex items-center gap-2 border border-gray-200 text-gray-600 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <SlidersHorizontal className="w-4 h-4" /> FILTROS
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto bg-white">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <Plus className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">
                  {modalidades.length === 0 ? "Nenhuma modalidade cadastrada ainda." : "Nenhum resultado encontrado."}
                </p>
                {modalidades.length === 0 && (
                  <button onClick={openNew} className="text-xs font-semibold text-primary hover:underline">
                    Criar primeira modalidade →
                  </button>
                )}
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold">
                      <th className="text-left px-6 py-3">Descrição</th>
                      <th className="px-4 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginated.map(m => {
                      const iconDef = getIcon(m.icone);
                      const IconComp = iconDef.Icon;
                      return (
                        <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              {/* Icon swatch */}
                              <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: m.cor + "22" }}
                              >
                                <IconComp className="w-4 h-4" style={{ color: m.cor }} />
                              </div>

                              {/* Name */}
                              <span className="font-medium text-gray-900">{m.descricao}</span>

                              {/* Badges */}
                              <div className="flex items-center gap-1.5 ml-1">
                                {m.utiliza_agenda && (
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
                                    Agenda
                                  </span>
                                )}
                                {m.utiliza_wod && (
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                                    WOD
                                  </span>
                                )}
                                {m.utiliza_gonutri && (
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                    GoNutri
                                  </span>
                                )}
                                {m.permite_agendamento_publico && (
                                  <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                    <Globe className="w-2.5 h-2.5" /> Agendamento público
                                  </span>
                                )}
                                {!m.ativo && (
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                                    Inativo
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="relative flex justify-end">
                              <button
                                onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {menuOpen === m.id && (
                                <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-52">
                                  <button
                                    onClick={() => openEdit(m)}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => handleToggleAgendamento(m)}
                                    className="w-full text-left px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 flex items-center gap-2"
                                  >
                                    <Globe className="w-3.5 h-3.5" />
                                    {m.permite_agendamento_publico ? "Desabilitar agendamento" : "Habilitar agendamento público"}
                                  </button>
                                  <button
                                    onClick={() => { setDeleteId(m.id); setMenuOpen(null); }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50"
                                  >
                                    Excluir
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                <div className="flex items-center justify-end px-6 py-3 border-t border-gray-100 gap-4 text-sm text-gray-500">
                  <span>
                    {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} de {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      disabled={page === totalPages}
                      onClick={() => setPage(p => p + 1)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </AppLayout>

      {/* Form modal */}
      {showForm && (
        <ModalidadeFormModal
          modalidade={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Excluir modalidade?</h3>
            <p className="text-sm text-gray-500 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="text-primary font-semibold text-sm hover:underline px-2">
                CANCELAR
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="bg-red-500 text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
              >
                EXCLUIR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}
    </>
  );
}
