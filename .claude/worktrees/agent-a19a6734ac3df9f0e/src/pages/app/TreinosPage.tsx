import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, MoreVertical, Pencil, Trash2, Copy, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/app/AppLayout";

type Workout = {
  id: string;
  nome: string;
  responsavel_nome: string | null;
  tipo_treino: string;
  nivel: string | null;
  sexo: string | null;
  idade_minima: number | null;
  idade_maxima: number | null;
  session_count?: number;
};

const PAGE_SIZE = 20;

function tipoLabel(t: string) {
  const map: Record<string, string> = {
    musculacao: "Musculação",
    funcional: "Funcional",
    aerobico: "Aeróbico",
    hiit: "HIIT",
    yoga: "Yoga",
    pilates: "Pilates",
    outro: "Outro",
  };
  return map[t] ?? t;
}

function nivelLabel(n: string | null) {
  if (!n) return "—";
  const map: Record<string, string> = {
    iniciante: "Iniciante",
    intermediario: "Intermediário",
    avancado: "Avançado",
  };
  return map[n] ?? n;
}

function sexoLabel(s: string | null) {
  if (!s) return "—";
  return s === "masculino" ? "Masculino" : s === "feminino" ? "Feminino" : "Ambos";
}

function idadeLabel(min: number | null, max: number | null) {
  if (!min && !max) return "—";
  if (min && max) return `${min}–${max} anos`;
  if (min) return `≥ ${min} anos`;
  return `≤ ${max} anos`;
}

export default function TreinosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [query]);

  useEffect(() => {
    if (!user?.contractorId) return;
    setLoading(true);
    (async () => {
      let q = supabase
        .from("workouts")
        .select("id, nome, responsavel_nome, tipo_treino, nivel, sexo, idade_minima, idade_maxima", { count: "exact" })
        .eq("contractor_id", user.contractorId!)
        .order("nome")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (query) q = q.ilike("nome", `%${query}%`);
      const { data, count, error } = await q;
      if (!error) {
        setWorkouts((data ?? []) as Workout[]);
        setTotal(count ?? 0);
      }
      setLoading(false);
    })();
  }, [user, page, query]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Excluir este treino?")) return;
    await supabase.from("workouts").delete().eq("id", id);
    setWorkouts(prev => prev.filter(w => w.id !== id));
    setTotal(prev => prev - 1);
    setOpenMenu(null);
  }

  async function handleDuplicate(w: Workout) {
    if (!user?.contractorId) return;
    const { data: newW } = await supabase
      .from("workouts")
      .insert({
        contractor_id: user.contractorId,
        nome: `${w.nome} (cópia)`,
        responsavel_nome: w.responsavel_nome,
        tipo_treino: w.tipo_treino,
        nivel: w.nivel,
        sexo: w.sexo,
        idade_minima: w.idade_minima,
        idade_maxima: w.idade_maxima,
      })
      .select()
      .single();
    setOpenMenu(null);
    if (newW) navigate(`/app/treinos/treinos/${newW.id}`);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Treinos</h1>
            <p className="text-sm text-gray-500">{total} treino{total !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => navigate("/app/treinos/treinos/novo")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Treino
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar treino..."
            className="pl-9 pr-4 py-2 w-full border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Nome</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Responsável</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Nível</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Sexo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Idade</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Carregando...</td></tr>
              ) : workouts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Dumbbell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400">Nenhum treino encontrado</p>
                    <button
                      onClick={() => navigate("/app/treinos/treinos/novo")}
                      className="mt-3 text-primary text-sm hover:underline"
                    >
                      Criar primeiro treino
                    </button>
                  </td>
                </tr>
              ) : (
                workouts.map(w => (
                  <tr
                    key={w.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer"
                    onClick={() => navigate(`/app/treinos/treinos/${w.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">{w.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{w.responsavel_nome || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{tipoLabel(w.tipo_treino)}</td>
                    <td className="px-4 py-3 text-gray-600">{nivelLabel(w.nivel)}</td>
                    <td className="px-4 py-3 text-gray-600">{sexoLabel(w.sexo)}</td>
                    <td className="px-4 py-3 text-gray-600">{idadeLabel(w.idade_minima, w.idade_maxima)}</td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="relative inline-block" ref={openMenu === w.id ? menuRef : null}>
                        <button
                          onClick={() => setOpenMenu(openMenu === w.id ? null : w.id)}
                          className="p-1.5 rounded hover:bg-gray-100"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                        {openMenu === w.id && (
                          <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[140px] py-1">
                            <button
                              onClick={() => { setOpenMenu(null); navigate(`/app/treinos/treinos/${w.id}`); }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Editar
                            </button>
                            <button
                              onClick={() => handleDuplicate(w)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Copy className="w-3.5 h-3.5" /> Duplicar
                            </button>
                            <button
                              onClick={() => handleDelete(w.id)}
                              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-end items-center gap-2 text-sm">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Anterior
            </button>
            <span className="text-gray-500">
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Próximo
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
