import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import GradeFormModal, { type GridData } from "@/components/app/GradeFormModal";

interface Grid {
  id:                string;
  modalidade_id:     string | null;
  modalidade_nome:   string | null;
  staff_id:          string | null;
  staff_nome:        string | null;
  nome:              string;
  dias_semana:       string[];
  hora_inicio:       string;
  hora_fim:          string;
  capacidade_maxima: number;
  cor:               string;
  ativo:             boolean;
  created_at:        string;
}

const DIA_LABELS: Record<string, string> = {
  seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom",
};

const PAGE_SIZE = 20;

export default function GradesPage() {
  const { user } = useAuth();
  const [grids, setGrids]       = useState<Grid[]>([]);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [editGrid, setEditGrid] = useState<GridData | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);
    const { data } = await supabase
      .from("schedule_grids")
      .select("*")
      .eq("contractor_id", user.contractorId)
      .order("created_at", { ascending: false });
    setGrids((data ?? []) as Grid[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  async function handleDelete(id: string) {
    const { error } = await supabase.from("schedule_grids").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir grade."); return; }
    toast.success("Grade e aulas futuras excluídas.");
    setDeleteId(null);
    load();
  }

  async function handleToggleAtivo(g: Grid) {
    await supabase.from("schedule_grids").update({ ativo: !g.ativo }).eq("id", g.id);
    load();
  }

  const totalPages = Math.max(1, Math.ceil(grids.length / PAGE_SIZE));
  const paginated  = grids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center">
              <h1 className="text-lg font-bold text-gray-900">Grades de horários</h1>
              <div className="ml-auto">
                <button
                  onClick={() => { setEditGrid(undefined); setShowForm(true); }}
                  className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" /> + GRADE
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-white">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : grids.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <p className="text-sm text-gray-400">Nenhuma grade cadastrada ainda.</p>
                <button
                  onClick={() => { setEditGrid(undefined); setShowForm(true); }}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Criar primeira grade →
                </button>
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold">
                      <th className="text-left px-6 py-3">Modalidade / Nome</th>
                      <th className="text-left px-4 py-3">Professor</th>
                      <th className="text-left px-4 py-3">Dias</th>
                      <th className="text-left px-4 py-3">Horário</th>
                      <th className="text-left px-4 py-3">Capacidade</th>
                      <th className="text-left px-4 py-3">Ativo</th>
                      <th className="px-4 py-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginated.map(g => (
                      <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: g.cor }} />
                            <div>
                              <p className="font-medium text-gray-900">
                                {g.modalidade_nome ?? (g.nome || "—")}
                              </p>
                              {g.nome && g.modalidade_nome && (
                                <p className="text-xs text-gray-400">{g.nome}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{g.staff_nome ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {g.dias_semana.map(d => (
                              <span
                                key={d}
                                className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium"
                              >
                                {DIA_LABELS[d] ?? d}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs font-mono">
                          {g.hora_inicio.slice(0, 5)} – {g.hora_fim.slice(0, 5)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{g.capacidade_maxima} alunos</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleAtivo(g)}
                            className={`w-10 h-5 rounded-full transition-colors relative ${g.ativo ? "bg-primary" : "bg-gray-200"}`}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${g.ativo ? "translate-x-5" : "translate-x-0.5"}`} />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => { setEditGrid(g); setShowForm(true); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteId(g.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
                    <span>Página {page} de {totalPages} — {grids.length} grade{grids.length !== 1 ? "s" : ""}</span>
                    <div className="flex items-center gap-1">
                      <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </AppLayout>

      {showForm && (
        <GradeFormModal
          grid={editGrid}
          onClose={() => { setShowForm(false); setEditGrid(undefined); }}
          onSaved={load}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Excluir grade?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Todas as aulas futuras desta grade também serão removidas da agenda.
            </p>
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
    </>
  );
}
