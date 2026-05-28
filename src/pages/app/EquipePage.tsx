import { useState, useEffect, useCallback } from "react";
import { UserPlus, Search, Send, MoreVertical, Users } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { StaffRole } from "@/integrations/supabase/types";
import StaffFormModal from "@/components/app/StaffFormModal";
import InviteStaffModal from "@/components/app/InviteStaffModal";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  blocked: boolean;
  telefone: string | null;
  created_at: string;
  deleted_at: string | null;
}

const ROLE_LABEL: Record<StaffRole, string> = {
  teacher:          "Professor",
  receptionist:     "Recepcionista",
  sales:            "Vendas",
  nutritionist:     "Nutricionista",
  physiotherapist:  "Fisioterapeuta",
  evaluator:        "Avaliador",
};

const ROLE_COLOR: Record<StaffRole, string> = {
  teacher:         "bg-blue-100 text-blue-700",
  receptionist:    "bg-green-100 text-green-700",
  sales:           "bg-orange-100 text-orange-700",
  nutritionist:    "bg-teal-100 text-teal-700",
  physiotherapist: "bg-purple-100 text-purple-700",
  evaluator:       "bg-pink-100 text-pink-700",
};

const ALL_ROLES: { value: StaffRole | "todos"; label: string }[] = [
  { value: "todos",          label: "Todos" },
  { value: "teacher",        label: "Professores" },
  { value: "receptionist",   label: "Recepcionistas" },
  { value: "sales",          label: "Vendas" },
  { value: "nutritionist",   label: "Nutricionistas" },
  { value: "physiotherapist",label: "Fisioterapeutas" },
  { value: "evaluator",      label: "Avaliadores" },
];

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

export default function EquipePage() {
  const { user } = useAuth();
  const [staff, setStaff]         = useState<StaffMember[]>([]);
  const [filtered, setFiltered]   = useState<StaffMember[]>([]);
  const [search, setSearch]       = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "todos">("todos");
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editStaff, setEditStaff] = useState<StaffMember | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [menuOpen, setMenuOpen]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.contractorId) return;
    const { data } = await supabase
      .from("staff")
      .select("id, name, email, role, active, blocked, telefone, created_at, deleted_at")
      .eq("contractor_id", user.contractorId!)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    const list = (data ?? []) as StaffMember[];
    setStaff(list);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let list = staff;
    if (roleFilter !== "todos") list = list.filter(s => s.role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.telefone?.includes(q)
      );
    }
    setFiltered(list);
  }, [search, roleFilter, staff]);

  function openEdit(member: StaffMember) {
    setEditStaff(member);
    setShowForm(true);
    setMenuOpen(null);
  }

  async function handleToggleBlock(member: StaffMember) {
    const { error } = await supabase
      .from("staff")
      .update({ blocked: !member.blocked })
      .eq("id", member.id);
    if (error) { toast.error("Erro ao atualizar status."); return; }
    toast.success(member.blocked ? "Membro desbloqueado com sucesso." : "Membro bloqueado com sucesso.");
    setMenuOpen(null);
    load();
  }

  async function handleDelete(member: StaffMember) {
    const { error } = await supabase
      .from("staff")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", member.id);
    if (error) { toast.error("Erro ao remover membro."); return; }
    toast.success("Membro removido da equipe.");
    setMenuOpen(null);
    load();
  }

  const counts: Record<StaffRole | "todos", number> = {
    todos:          staff.length,
    teacher:        staff.filter(s => s.role === "teacher").length,
    receptionist:   staff.filter(s => s.role === "receptionist").length,
    sales:          staff.filter(s => s.role === "sales").length,
    nutritionist:   staff.filter(s => s.role === "nutritionist").length,
    physiotherapist:staff.filter(s => s.role === "physiotherapist").length,
    evaluator:      staff.filter(s => s.role === "evaluator").length,
  };

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-900 flex-shrink-0">Equipe</h1>

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

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => { setEditStaff(null); setShowForm(true); }}
                  className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <UserPlus className="w-4 h-4" /> + NOVO MEMBRO
                </button>
                <button
                  onClick={() => setShowInvite(true)}
                  className="inline-flex items-center gap-2 border border-primary text-primary text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors"
                >
                  <Send className="w-4 h-4" /> CONVIDAR
                </button>
              </div>
            </div>

            {/* Role filter pills */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {ALL_ROLES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setRoleFilter(value)}
                  className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
                    roleFilter === value
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {label} <span className="opacity-60">({counts[value]})</span>
                </button>
              ))}
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
                <Users className="w-12 h-12 text-gray-200" />
                <p className="text-sm text-gray-400">
                  {staff.length === 0
                    ? "Nenhum membro cadastrado ainda."
                    : "Nenhum resultado para o filtro aplicado."}
                </p>
                {staff.length === 0 && (
                  <button
                    onClick={() => { setEditStaff(null); setShowForm(true); }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Cadastrar primeiro membro →
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold">
                    <th className="text-left px-6 py-3">Nome</th>
                    <th className="text-left px-4 py-3">Cargo</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Telefone</th>
                    <th className="text-left px-4 py-3">Situação</th>
                    <th className="px-4 py-3 w-14"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(s => (
                    <tr
                      key={s.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => openEdit(s)}
                    >
                      {/* Avatar + Nome */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                            {getInitials(s.name)}
                          </div>
                          <span className="font-medium text-gray-900">{s.name}</span>
                        </div>
                      </td>

                      {/* Cargo */}
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_COLOR[s.role]}`}>
                          {ROLE_LABEL[s.role]}
                        </span>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 text-gray-600 text-sm">{s.email}</td>

                      {/* Telefone */}
                      <td className="px-4 py-3 text-gray-600 text-sm">{s.telefone ?? "—"}</td>

                      {/* Situação */}
                      <td className="px-4 py-3">
                        {s.blocked ? (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-600">
                            Bloqueado
                          </span>
                        ) : s.active ? (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                            Ativo
                          </span>
                        ) : (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                            Inativo
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpen(menuOpen === s.id ? null : s.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {menuOpen === s.id && (
                            <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44">
                              <button
                                onClick={() => openEdit(s)}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Editar cadastro
                              </button>
                              <button
                                onClick={() => handleToggleBlock(s)}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                {s.blocked ? "Desbloquear acesso" : "Bloquear acesso"}
                              </button>
                              <div className="my-1 border-t border-gray-100" />
                              <button
                                onClick={() => handleDelete(s)}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                Remover da equipe
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </AppLayout>

      {showForm && (
        <StaffFormModal
          editId={editStaff?.id ?? null}
          onClose={() => { setShowForm(false); setEditStaff(null); }}
          onSaved={load}
        />
      )}
      {showInvite && <InviteStaffModal onClose={() => setShowInvite(false)} />}
      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}
    </>
  );
}
