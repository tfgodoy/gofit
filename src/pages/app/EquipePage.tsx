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
  teacher:          "Professor",
  receptionist:     "Recepcionista",
  sales:            "Vendas",
  nutritionist:     "Nutricionista",
  physiotherapist:  "Fisioterapeuta",
  evaluator:        "Avaliador",
};

const ROLE_COLOR: Record<StaffRole, string> = {
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

  const [search, setSearch]               = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage]                   = useState(1);
  const [pageSize, setPageSize]           = useState(10);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [pendingShowRemoved, setPendingShowRemoved] = useState(false);
  const [showRemoved, setShowRemoved]     = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editId, setEditId]               = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  function renderPageNumbers() {
    const pages: number[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (page <= 3) {
      pages.push(1, 2, 3, 4, 5);
    } else if (page >= totalPages - 2) {
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      for (let i = page - 2; i <= page + 2; i++) pages.push(i);
    }
    return pages;
  }

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-gray-900 flex-shrink-0">Equipe</h1>

              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={openCreate}
                  className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <UserPlus className="w-4 h-4" /> + MEMBRO
                </button>
                <button
                  onClick={() => setInviteModalOpen(true)}
                  className="inline-flex items-center gap-2 border border-primary text-primary text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors"
                >
                  <Send className="w-4 h-4" /> CONVIDAR MEMBRO
                </button>
                <button
                  onClick={() => { setPendingShowRemoved(showRemoved); setFilterPanelOpen(true); }}
                  className={`relative inline-flex items-center gap-2 border text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
                    activeFiltersCount > 0
                      ? "border-primary text-primary bg-primary/5"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" /> FILTROS
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto bg-white">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Users className="w-12 h-12 text-gray-200" />
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold">
                    <th className="text-left px-6 py-3">Nome</th>
                    <th className="text-left px-4 py-3">E-mail</th>
                    <th className="text-left px-4 py-3">Cargo</th>
                    <th className="text-left px-4 py-3">Situação</th>
                    <th className="px-4 py-3 w-20 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      {confirmDeleteId === row.id ? (
                        <td colSpan={5} className="px-6 py-3">
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-700">
                              Remover <strong>{row.name}</strong> da equipe?
                            </span>
                            <button
                              onClick={() => deleteMutation.mutate(row.id)}
                              disabled={deleteMutation.isPending}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                            >
                              {deleteMutation.isPending
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Check className="w-3.5 h-3.5" />}
                              CONFIRMAR
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              CANCELAR
                            </button>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="px-6 py-3">
                            <div
                              className="flex items-center gap-3 cursor-pointer"
                              onClick={() => openEdit(row.id)}
                            >
                              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                                {getInitials(row.name)}
                              </div>
                              <span className="font-medium text-gray-900 hover:text-primary transition-colors">
                                {row.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{row.email}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_COLOR[row.role]}`}>
                              {ROLE_LABEL[row.role]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {row.deleted_at ? (
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Removido</span>
                            ) : row.blocked ? (
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-600">Bloqueado</span>
                            ) : row.active ? (
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Ativo</span>
                            ) : (
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">Inativo</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEdit(row.id)}
                                title="Editar"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              {!row.deleted_at && (
                                <button
                                  onClick={() => setConfirmDeleteId(row.id)}
                                  title="Remover"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-white flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Itens por página:</span>
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {[10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <span className="text-xs text-gray-500">{fromItem}–{toItem} de {total}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {renderPageNumbers().map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 text-xs font-semibold rounded-lg transition-colors ${
                      p === page ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </AppLayout>

      {/* Filter panel */}
      {filterPanelOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setFilterPanelOpen(false)} />
          <div className="fixed right-0 top-0 h-full z-50 w-72 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Filtros</h2>
              <button
                onClick={() => setFilterPanelOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 px-5 py-5 space-y-4">
              <label
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setPendingShowRemoved(!pendingShowRemoved)}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  pendingShowRemoved ? "bg-primary border-primary" : "border-gray-300"
                }`}>
                  {pendingShowRemoved && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-gray-700">Exibir apenas removidos</span>
              </label>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
              <button
                onClick={clearFilters}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                LIMPAR
              </button>
              <button
                onClick={applyFilters}
                className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                APLICAR
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
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
