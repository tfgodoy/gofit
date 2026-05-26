import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { UserPlus, Search, Filter, ChevronRight, Phone, Mail, Send } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import InviteModal from "@/components/app/InviteModal";

type StudentStatus = "lead" | "ativo" | "inativo" | "cancelado";

interface Student {
  id: string;
  nome_completo: string;
  telefone: string | null;
  email: string | null;
  status: StudentStatus;
  cidade: string | null;
  uf: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<StudentStatus, string> = {
  ativo:     "bg-green-50 text-green-700",
  lead:      "bg-blue-50 text-blue-700",
  inativo:   "bg-gray-100 text-gray-500",
  cancelado: "bg-red-50 text-red-600",
};
const STATUS_LABEL: Record<StudentStatus, string> = {
  ativo: "Ativo", lead: "Lead", inativo: "Inativo", cancelado: "Cancelado",
};

const ALL_STATUS: { value: StudentStatus | "todos"; label: string }[] = [
  { value: "todos",    label: "Todos" },
  { value: "ativo",    label: "Ativos" },
  { value: "lead",     label: "Leads" },
  { value: "inativo",  label: "Inativos" },
  { value: "cancelado",label: "Cancelados" },
];

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

export default function AlunosPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StudentStatus | "todos">("todos");
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ total: 0, ativo: 0, lead: 0, inativo: 0, cancelado: 0 });
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    if (!user?.contractorId) return;
    async function load() {
      const { data } = await supabase
        .from("students")
        .select("id, nome_completo, telefone, email, status, cidade, uf, created_at")
        .eq("contractor_id", user!.contractorId!)
        .order("created_at", { ascending: false });

      const list = (data ?? []) as Student[];
      setStudents(list);
      setFiltered(list);
      setCounts({
        total:     list.length,
        ativo:     list.filter(s => s.status === "ativo").length,
        lead:      list.filter(s => s.status === "lead").length,
        inativo:   list.filter(s => s.status === "inativo").length,
        cancelado: list.filter(s => s.status === "cancelado").length,
      });
      setLoading(false);
    }
    load();
  }, [user]);

  useEffect(() => {
    let list = students;
    if (statusFilter !== "todos") list = list.filter(s => s.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.nome_completo.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.telefone?.includes(q)
      );
    }
    setFiltered(list);
  }, [search, statusFilter, students]);

  return (
    <>
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Alunos</h1>
            <p className="text-sm text-gray-400 mt-0.5">{counts.total} cadastros no total</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-2 border border-primary text-primary text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-primary/5 transition-colors"
            >
              <Send className="w-4 h-4" /> Enviar convite
            </button>
            <Link
              to="/app/alunos/novo"
              className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
            >
              <UserPlus className="w-4 h-4" /> Novo aluno
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Ativos",     value: counts.ativo,     color: "text-green-600 bg-green-50" },
            { label: "Leads",      value: counts.lead,      color: "text-blue-600 bg-blue-50" },
            { label: "Inativos",   value: counts.inativo,   color: "text-gray-500 bg-gray-100" },
            { label: "Cancelados", value: counts.cancelado, color: "text-red-600 bg-red-50" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 p-4">
              <p className={`text-2xl font-extrabold ${color.split(" ")[0]}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome, e-mail ou telefone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {ALL_STATUS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    statusFilter === value
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <UserPlus className="w-10 h-10 text-gray-200" />
              <p className="text-sm text-gray-400">
                {students.length === 0 ? "Nenhum aluno cadastrado ainda." : "Nenhum resultado para o filtro aplicado."}
              </p>
              {students.length === 0 && (
                <Link to="/app/alunos/novo" className="text-xs font-semibold text-primary hover:underline">
                  Cadastrar primeiro aluno →
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Aluno</th>
                    <th className="text-left px-4 py-3">Contato</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Cidade</th>
                    <th className="text-left px-4 py-3">Cadastro</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                            {getInitials(s.nome_completo)}
                          </div>
                          <span className="font-medium text-gray-900">{s.nome_completo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          {s.telefone && (
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Phone className="w-3 h-3" /> {s.telefone}
                            </span>
                          )}
                          {s.email && (
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Mail className="w-3 h-3" /> {s.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[s.status]}`}>
                          {STATUS_LABEL[s.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500">
                        {s.cidade && s.uf ? `${s.cidade}/${s.uf}` : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500">
                        {new Date(s.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          to={`/app/alunos/${s.id}`}
                          className="flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
                        >
                          Ver <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
    {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </>
  );
}
