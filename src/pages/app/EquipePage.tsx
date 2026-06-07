import { useState, useEffect } from "react";
import {
  Search, UserPlus, Send, SlidersHorizontal, Pencil, Trash2,
  ChevronLeft, ChevronRight, X, Check, Users, Loader2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { StaffRole } from "@/integrations/supabase/types";
import StaffMemberModal from "@/components/app/StaffMemberModal";
import InviteStaffModal from "@/components/app/InviteStaffModal";

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  blocked: boolean;
  deleted_at: string | null;
};

const ROLE_LABEL: Record<StaffRole, string> = {
  admin:            "Administrador(a)",
  teacher:          "Professor",
  receptionist:     "Recepcionista",
  sales:            "Vendas",
  nutritionist:     "Nutricionista",
  physiotherapist:  "Fisioterapeuta",
  evaluator:        "Avaliador",
};

const ROLE_COLOR: Record<StaffRole, string> = {
  admin:            "bg-red-100 text-red-700",
  teacher:          "bg-blue-100 text-blue-700",
  receptionist:     "bg-green-100 text-green-700",
  sales:            "bg-orange-100 text-orange-700",
  nutritionist:     "bg-teal-100 text-teal-700",
  physiotherapist:  "bg-purple-100 text-purple-700",
  evaluator:        "bg-pink-100 text-pink-700",
};

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

export default function EquipePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const contractorId = user?.contractorId ?? "";

  const [search, setSearch]                       = useState("");
  const [debouncedSearch, setDebouncedSearch]     = useState("");
  const [page, setPage]                           = useState(1);
  const [pageSize, setPageSize]                   = useState(10);
  const [filterPanelOpen, setFilterPanelOpen]     = useState(false);
  const [pendingShowRemoved, setPendingShowRemoved] = useState(false);
  const [showRemoved, setShowRemoved]             = useState(false);
  const [memberModalOpen, setMemberModalOpen]     = useState(false);
  const [editId, setEditId]                       = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen]     = useState(false);
  const [confirmDeleteId, setConfirmDeleteId]     = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [showRemoved]);

  const { data, isLoading } = useQuery({
    queryKey: ["staff", contractorId, debouncedSearch, page, pageSize, showRemoved],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to   = from + pageSize - 1;

      let q = supabase
        .from("staff")
        .select("id, name, email, role, active, blocked, deleted_at", { count: "exact" })
        .eq("contractor_id", contractorId)
        .range(from, to)
        .order("name", { ascending: true });

      if (showRemoved) q = q.not("deleted_at", "is", null);
      else             q = q.is("deleted_at", null);

      if (debouncedSearch.trim()) q = q.ilike("name", `%${debouncedSearch.trim()}%`);

      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as StaffRow[], total: count ?? 0 };
    },
    enabled: !!contractorId,
  });

  const rows       = data?.rows ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fromItem   = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toItem     = Math.min(page * pageSize, total);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("staff")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro removido da equipe.");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setConfirmDeleteId(null);
    },
    onError: () => toast.error("Erro ao remover membro."),
  });

  function openCreate() { setEditId(null); setMemberModalOpen(true); }
  function openEdit(id: string) { setEditId(id); setMemberModalOpen(true); }
  function applyFilters() { setShowRemoved(pendingShowRemoved); setFilterPanelOpen(false); }
  function clearFilters()  { setPendingShowRemoved(false); setShowRemoved(false); setFilterPanelOpen(false); }

  const activeFiltersCount = showRemoved ? 1 : 0;

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full bg-white">

          {/* ── Header ── */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-base font-bold text-gray-900 flex-shrink-0">Equipe</h1>

              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-gray-400"
                />
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={openCreate}
                  className="inline-flex items-center gap-1.5 bg-primary text-white font-semibold px-4 py-2 rounded-md text-sm hover:bg-primary/90 transition-colors"
                >
                  <UserPlus className="w-4 h-4" /> MEMBRO
                </button>
                <button
                  onClick={() => setInviteModalOpen(true)}
                  className="inline-flex items-center gap-1.5 border border-primary text-primary font-semibold px-4 py-2 rounded-md text-sm bg-white hover:bg-primary/5 transition-colors"
                >
                  <Send className="w-4 h-4" /> CONVIDAR MEMBRO
                </button>
                <button
                  onClick={() => { setPendingShowRemoved(showRemoved); setFilterPanelOpen(true); }}
                  className={`relative inline-flex items-center gap-1.5 text-gray-600 font-semibold text-sm px-3 py-2 rounded-md transition-colors ${
                    activeFiltersCount > 0 ? "text-primary" : "hover:bg-gray-50"
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" /> FILTROS
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Users className="w-10 h-10 text-gray-200" />
                <p className="text-sm text-gray-400">
                  {!debouncedSearch.trim() && total === 0
                    ? "Nenhum membro cadastrado ainda."
                    : "Nenhum resultado para o filtro aplicado."}
                </p>
                {!debouncedSearch.trim() && total === 0 && (
                  <button onClick={openCreate} className="text-xs font-semibold text-primary hover:underline">
                    Cadastrar primeiro membro →
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Nome</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">E-mail</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Cargo</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Situação</th>
                    <th className="py-3 px-4 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      {confirmDeleteId === row.id ? (
                        <td colSpan={5} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-700">
                              Remover <strong>{row.name}</strong> da equipe?
                            </span>
                            <button
                              onClick={() => deleteMutation.mutate(row.id)}
                              disabled={deleteMutation.isPending}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-md hover:bg-red-700 disabled:opacity-60 transition-colors"
                            >
                              {deleteMutation.isPending
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Check className="w-3.5 h-3.5" />}
                              CONFIRMAR
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-md hover:bg-gray-100 transition-colors"
                            >
                              CANCELAR
                            </button>
                          </div>
                        </td>
                      ) : (
                        <>
                          {/* Nome */}
                          <td className="px-4 py-3">
                            <div
                              className="flex items-center gap-3 cursor-pointer"
                              onClick={() => openEdit(row.id)}
                            >
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                                {getInitials(row.name)}
                              </div>
                              <span className="text-sm text-gray-900 hover:text-primary transition-colors font-medium">
                                {row.name}
                              </span>
                            </div>
                          </td>

                          {/* E-mail */}
                          <td className="px-4 py-3 text-sm text-gray-900">{row.email}</td>

                          {/* Cargo */}
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLOR[row.role]}`}>
                              {ROLE_LABEL[row.role]}
                            </span>
                          </td>

                          {/* Situação */}
                          <td className="px-4 py-3">
                            {row.deleted_at ? (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Removido</span>
                            ) : row.blocked ? (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">Bloqueado</span>
                            ) : row.active ? (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Ativo</span>
                            ) : (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Inativo</span>
                            )}
                          </td>

                          {/* Ações — sempre visíveis */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEdit(row.id)}
                                title="Editar"
                                className="text-gray-400 hover:text-gray-700 transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              {!row.deleted_at && (
                                <button
                                  onClick={() => setConfirmDeleteId(row.id)}
                                  title="Remover"
                                  className="text-gray-400 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Paginação ── */}
          {total > 0 && (
            <div className="flex items-center justify-between py-3 px-4 border-t border-gray-200 text-sm text-gray-500 flex-shrink-0">
              {/* Esquerda: Exibir + contador */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span>Exibir</span>
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="border border-gray-200 rounded text-sm px-2 py-1 focus:outline-none focus:border-primary bg-white"
                  >
                    {[10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <span>{fromItem}–{toItem} de {total}</span>
              </div>

              {/* Direita: Página + nav */}
              <div className="flex items-center gap-2">
                <span>Página</span>
                <select
                  value={page}
                  onChange={e => setPage(Number(e.target.value))}
                  className="border border-gray-200 rounded text-sm px-2 py-1 focus:outline-none focus:border-primary bg-white"
                >
                  {Array.from({ length: totalPages }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
                <span>de {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </AppLayout>

      {/* ── Painel Filtros ── */}
      {filterPanelOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setFilterPanelOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-72 bg-white shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 text-sm">Filtros</h2>
              <button
                onClick={() => setFilterPanelOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-4 space-y-4">
              <label
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setPendingShowRemoved(v => !v)}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  pendingShowRemoved ? "bg-primary border-primary" : "border-gray-300"
                }`}>
                  {pendingShowRemoved && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-gray-700">Exibir apenas removidos</span>
              </label>
            </div>

            <div className="flex gap-2 p-4 border-t border-gray-200">
              <button
                onClick={clearFilters}
                className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-md hover:bg-gray-50 transition-colors"
              >
                LIMPAR
              </button>
              <button
                onClick={applyFilters}
                className="flex-1 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors"
              >
                APLICAR
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modais ── */}
      {memberModalOpen && (
        <StaffMemberModal
          editId={editId}
          onClose={() => { setMemberModalOpen(false); setEditId(null); }}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["staff"] })}
        />
      )}
      {inviteModalOpen && (
        <InviteStaffModal onClose={() => setInviteModalOpen(false)} />
      )}
    </>
  );
}
