import { useState, useEffect } from "react";
import { UserPlus, X, Search } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Grid {
  id: string;
  nome: string;
  modalidade_nome: string | null;
  dias_semana: string[];
  hora_inicio: string;
  hora_fim: string;
  capacidade_maxima: number;
  cor: string;
}

interface Enrollment {
  id: string;
  student_id: string;
  student_nome: string | null;
  grid_id: string;
  ativo: boolean;
}

interface Student { id: string; nome_completo: string }

const DAY_LABELS: Record<string, string> = {
  seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom",
};


export default function OcupacaoPage() {
  const { user } = useAuth();
  const [grids,       setGrids]       = useState<Grid[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students,    setStudents]    = useState<Student[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selectedGrid, setSelectedGrid] = useState<string>("todos");

  /* modal state */
  const [addTarget, setAddTarget]   = useState<{ gridId: string; gridNome: string } | null>(null);
  const [search,    setSearch]      = useState("");
  const [dropOpen,  setDropOpen]    = useState(false);
  const [selStudent, setSelStudent] = useState<Student | null>(null);
  const [saving,    setSaving]      = useState(false);

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);
    const [{ data: gData }, { data: eData }] = await Promise.all([
      supabase.from("schedule_grids").select("id, nome, modalidade_nome, dias_semana, hora_inicio, hora_fim, capacidade_maxima, cor")
        .eq("contractor_id", user.contractorId).eq("ativo", true).order("modalidade_nome"),
      supabase.from("fixed_enrollments").select("id, student_id, student_nome, grid_id, ativo")
        .eq("contractor_id", user.contractorId).eq("ativo", true),
    ]);
    setGrids((gData ?? []) as Grid[]);
    setEnrollments((eData ?? []) as Enrollment[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!user?.contractorId) return;
    supabase.from("students").select("id, nome_completo")
      .eq("contractor_id", user.contractorId).eq("status", "ativo").order("nome_completo")
      .then(({ data }) => setStudents((data ?? []) as Student[]));
  }, [user]);

  async function handleAdd() {
    if (!user?.contractorId || !addTarget || !selStudent) { toast.error("Selecione um aluno."); return; }
    setSaving(true);
    const { error } = await supabase.from("fixed_enrollments").insert({
      contractor_id: user.contractorId,
      student_id:    selStudent.id,
      student_nome:  selStudent.nome_completo,
      grid_id:       addTarget.gridId,
    });
    setSaving(false);
    if (error) {
      if (error.code === "23505") toast.error("Aluno já matriculado neste horário.");
      else toast.error("Erro ao matricular.");
      return;
    }
    toast.success("Aluno matriculado no horário fixo.");
    setAddTarget(null); setSelStudent(null); setSearch("");
    load();
  }

  async function handleRemove(enrollmentId: string) {
    await supabase.from("fixed_enrollments").update({ ativo: false }).eq("id", enrollmentId);
    toast.success("Matrícula removida.");
    load();
  }

  const filteredGrids = selectedGrid === "todos"
    ? grids
    : grids.filter(g => g.id === selectedGrid);

  const filteredStudents = search
    ? students.filter(s => s.nome_completo.toLowerCase().includes(search.toLowerCase()))
    : students;

  const enrolledIds = new Set(enrollments.map(e => e.student_id + "_" + e.grid_id));

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">
          <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-4">
            <h1 className="text-lg font-bold text-gray-900">Ocupação da Agenda</h1>
            <select
              value={selectedGrid}
              onChange={e => setSelectedGrid(e.target.value)}
              className="ml-auto border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="todos">Todas as grades</option>
              {grids.map(g => (
                <option key={g.id} value={g.id}>
                  {g.modalidade_nome ?? g.nome} — {g.hora_inicio.slice(0,5)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-auto bg-gray-50 p-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredGrids.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <p className="text-sm text-gray-400">Nenhuma grade ativa encontrada.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredGrids.map(grid => {
                  const gridEnrollments = enrollments.filter(e => e.grid_id === grid.id);
                  const pct = grid.capacidade_maxima > 0
                    ? Math.min(100, Math.round((gridEnrollments.length / grid.capacidade_maxima) * 100))
                    : 0;
                  const pctColor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-orange-400" : "bg-primary";

                  return (
                    <div key={grid.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                      {/* Grid header */}
                      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-50">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: grid.cor }} />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900">
                            {grid.modalidade_nome ?? grid.nome}
                            {grid.nome && grid.modalidade_nome ? ` — ${grid.nome}` : ""}
                          </p>
                          <p className="text-xs text-gray-400">
                            {grid.dias_semana.map(d => DAY_LABELS[d] ?? d).join(", ")}
                            {" · "}{grid.hora_inicio.slice(0,5)}–{grid.hora_fim.slice(0,5)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">
                            {gridEnrollments.length}<span className="text-gray-400 font-normal">/{grid.capacidade_maxima}</span>
                          </p>
                          <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                            <div className={`h-full ${pctColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <button
                          onClick={() => setAddTarget({ gridId: grid.id, gridNome: grid.modalidade_nome ?? grid.nome })}
                          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline flex-shrink-0 ml-2"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Matricular
                        </button>
                      </div>

                      {/* Enrolled students */}
                      {gridEnrollments.length === 0 ? (
                        <p className="px-5 py-4 text-xs text-gray-400 text-center">Nenhum aluno matriculado neste horário.</p>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {gridEnrollments.map((e, idx) => (
                            <div key={e.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 group">
                              <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{idx + 1}</span>
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                                {(e.student_nome ?? "?").slice(0, 1).toUpperCase()}
                              </div>
                              <p className="text-sm text-gray-800 flex-1 truncate">{e.student_nome ?? "—"}</p>
                              <button
                                onClick={() => handleRemove(e.id)}
                                title="Remover matrícula"
                                className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </AppLayout>

      {/* Modal de matrícula */}
      {addTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Matricular aluno</h2>
                <p className="text-xs text-gray-400 mt-0.5">{addTarget.gridNome}</p>
              </div>
              <button onClick={() => { setAddTarget(null); setSelStudent(null); setSearch(""); }}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="p-5">
              <div className="relative">
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
                  <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input
                    autoFocus type="text"
                    placeholder="Buscar aluno ativo..."
                    value={selStudent?.nome_completo ?? search}
                    onChange={e => { setSearch(e.target.value); setSelStudent(null); setDropOpen(true); }}
                    onClick={() => setDropOpen(true)}
                    className="flex-1 text-sm text-gray-900 outline-none"
                  />
                  {selStudent && (
                    <button onClick={() => { setSelStudent(null); setSearch(""); }}>
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>
                {dropOpen && !selStudent && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                    {filteredStudents.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-gray-400">Nenhum aluno encontrado</p>
                    ) : filteredStudents.filter(s => !enrolledIds.has(s.id + "_" + addTarget.gridId))
                        .slice(0, 20).map(s => (
                      <button key={s.id} onClick={() => { setSelStudent(s); setSearch(""); setDropOpen(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
                        {s.nome_completo}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-5">
                <button onClick={() => { setAddTarget(null); setSelStudent(null); setSearch(""); }}
                  className="text-sm font-semibold text-gray-500 hover:underline px-2">
                  Cancelar
                </button>
                <button onClick={handleAdd} disabled={!selStudent || saving}
                  className="bg-primary text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {saving ? "Matriculando..." : "Matricular"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
