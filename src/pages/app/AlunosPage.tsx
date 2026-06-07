import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus, Search, Send, ExternalLink, MoreVertical, SlidersHorizontal } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import InviteModal from "@/components/app/InviteModal";

type StudentStatus = "ativo" | "bloqueado" | "inativo" | "cancelado" | "lead";

interface Student {
  id: string;
  nome_completo: string;
  telefone: string | null;
  email: string | null;
  status: StudentStatus;
  data_nascimento: string | null;
  sexo: "masculino" | "feminino" | "outro" | null;
  foto_url: string | null;
  created_at: string;
  objetivo: string | null;
  origem: string | null;
}

const OBJETIVOS = [
  "Emagrecimento",
  "Hipertrofia / Ganho de massa",
  "Condicionamento físico",
  "Saúde e bem-estar",
  "Reabilitação",
  "Performance esportiva",
  "Outro",
];

const ORIGENS: { value: string; label: string }[] = [
  { value: "convite",      label: "Link de convite" },
  { value: "experimental", label: "Aula experimental" },
  { value: "sistema",      label: "Sistema (usuário criou)" },
  { value: "app",          label: "App do aluno" },
  { value: "site",         label: "Site de venda" },
];

const STATUS_STYLE: Record<StudentStatus, string> = {
  ativo:     "bg-green-100 text-green-700",
  bloqueado: "bg-amber-100 text-amber-700",
  inativo:   "bg-gray-100 text-gray-500",
  cancelado: "bg-red-100 text-red-600",
  lead:      "bg-blue-100 text-blue-700",
};
const STATUS_LABEL: Record<StudentStatus, string> = {
  ativo: "Ativo", bloqueado: "Bloqueado", inativo: "Inativo", cancelado: "Cancelado", lead: "Lead",
};
const SEX_LABEL: Record<string, string> = {
  masculino: "Masculino", feminino: "Feminino", outro: "Outro",
};

const ALL_STATUS: { value: StudentStatus | "todos"; label: string }[] = [
  { value: "todos",     label: "Todos" },
  { value: "ativo",     label: "Ativos" },
  { value: "bloqueado", label: "Bloqueados" },
  { value: "inativo",   label: "Inativos" },
  { value: "cancelado", label: "Cancelados" },
  { value: "lead",      label: "Leads" },
];

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return "—";
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} anos`;
}

export default function ClientesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StudentStatus | "todos">("todos");
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ total: 0, ativo: 0, bloqueado: 0, inativo: 0, cancelado: 0, lead: 0 });
  const [showInvite, setShowInvite] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [situacaoFilter, setSituacaoFilter] = useState("");
  const [sexoFilter, setSexoFilter] = useState("");
  const [objetivoFilter, setObjetivoFilter] = useState("");
  const [origemFilter, setOrigemFilter] = useState("");
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilters(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!user?.contractorId) return;
    async function load() {
      const { data } = await supabase
        .from("students")
        .select("id, nome_completo, telefone, email, status, data_nascimento, sexo, foto_url, created_at, objetivo, origem")
        .eq("contractor_id", user!.contractorId!)
        .order("nome_completo", { ascending: true });

      const list = (data ?? []) as Student[];
      const nonLeads = list.filter(s => s.status !== "lead");
      setStudents(list);
      setFiltered(nonLeads);
      setCounts({
        total:     nonLeads.length,
        ativo:     list.filter(s => s.status === "ativo").length,
        bloqueado: list.filter(s => s.status === "bloqueado").length,
        inativo:   list.filter(s => s.status === "inativo").length,
        cancelado: list.filter(s => s.status === "cancelado").length,
        lead:      list.filter(s => s.status === "lead").length,
      });
      setLoading(false);
    }
    load();
  }, [user]);

  useEffect(() => {
    // When situacaoFilter is set via dropdown, it overrides the pill
    const effectiveStatus = situacaoFilter || statusFilter;
    let list = effectiveStatus === "lead"
      ? students.filter(s => s.status === "lead")
      : students.filter(s => s.status !== "lead");
    if (effectiveStatus !== "todos" && effectiveStatus !== "lead") list = list.filter(s => s.status === effectiveStatus);
    if (sexoFilter) list = list.filter(s => s.sexo === sexoFilter);
    if (objetivoFilter) list = list.filter(s => s.objetivo === objetivoFilter);
    if (origemFilter) list = list.filter(s => s.origem === origemFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.nome_completo.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.telefone?.includes(q)
      );
    }
    setFiltered(list);
  }, [search, statusFilter, situacaoFilter, sexoFilter, objetivoFilter, origemFilter, students]);

  const activeFilterCount = [situacaoFilter, sexoFilter, objetivoFilter, origemFilter].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <>
    <AppLayout>
      <div className="flex flex-col h-full">

        {/* Top toolbar — matches NextFit Clientes header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-gray-900 flex-shrink-0">Clientes</h1>

            {/* Inline search */}
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
              <Link
                to="/app/clientes/novo"
                className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <UserPlus className="w-4 h-4" /> + CLIENTE
              </Link>
              <button
                onClick={() => setShowInvite(true)}
                className="inline-flex items-center gap-2 border border-primary text-primary text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors"
              >
                <Send className="w-4 h-4" /> CONVIDAR CLIENTE
              </button>
              <div ref={filterRef} className="relative">
                <button
                  onClick={() => setShowFilters(o => !o)}
                  className={`inline-flex items-center gap-2 border text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
                    hasActiveFilters
                      ? "border-primary text-primary bg-primary/5"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  FILTROS
                  {hasActiveFilters && (
                    <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {showFilters && (
                  <div className="absolute right-0 top-11 z-30 bg-white border border-gray-200 rounded-xl shadow-xl w-72 p-4 space-y-3">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-sm font-bold text-gray-800">Filtros</span>
                      {hasActiveFilters && (
                        <button
                          onClick={() => { setSituacaoFilter(""); setSexoFilter(""); setObjetivoFilter(""); setOrigemFilter(""); }}
                          className="text-xs text-primary hover:underline font-semibold"
                        >
                          Limpar todos
                        </button>
                      )}
                    </div>

                    {/* Situação */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Situação</label>
                      <select
                        value={situacaoFilter}
                        onChange={e => { setSituacaoFilter(e.target.value); if (e.target.value) setStatusFilter("todos"); }}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      >
                        <option value="">Todas as situações</option>
                        <option value="ativo">Ativo</option>
                        <option value="bloqueado">Bloqueado</option>
                        <option value="inativo">Inativo</option>
                        <option value="cancelado">Cancelado</option>
                        <option value="lead">Lead</option>
                      </select>
                    </div>

                    {/* Sexo */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Sexo</label>
                      <select
                        value={sexoFilter}
                        onChange={e => setSexoFilter(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      >
                        <option value="">Todos os sexos</option>
                        <option value="masculino">Masculino</option>
                        <option value="feminino">Feminino</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>

                    {/* Objetivo */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Objetivo</label>
                      <select
                        value={objetivoFilter}
                        onChange={e => setObjetivoFilter(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      >
                        <option value="">Todos os objetivos</option>
                        {OBJETIVOS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>

                    {/* Origem */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Origem</label>
                      <select
                        value={origemFilter}
                        onChange={e => setOrigemFilter(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      >
                        <option value="">Todas as origens</option>
                        {ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>

                    <button
                      onClick={() => setShowFilters(false)}
                      className="w-full py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors mt-1"
                    >
                      Aplicar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-2 mt-3">
            {ALL_STATUS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
                  statusFilter === value
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label} {value !== "todos" && <span className="opacity-60">({counts[value as StudentStatus] ?? 0})</span>}
                {value === "todos" && <span className="opacity-60">({counts.total})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Table area */}
        <div className="flex-1 overflow-auto bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <UserPlus className="w-12 h-12 text-gray-200" />
              <p className="text-sm text-gray-400">
                {students.length === 0 ? "Nenhum cliente cadastrado ainda." : "Nenhum resultado para o filtro aplicado."}
              </p>
              {students.length === 0 && (
                <Link to="/app/clientes/novo" className="text-xs font-semibold text-primary hover:underline">
                  Cadastrar primeiro cliente →
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold">
                  <th className="text-left px-6 py-3">
                    <span className="flex items-center gap-1 cursor-pointer hover:text-gray-800">
                      Nome ↑
                    </span>
                  </th>
                  <th className="text-left px-4 py-3">Situação</th>
                  <th className="text-left px-4 py-3">Idade</th>
                  <th className="text-left px-4 py-3">Sexo</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(s => (
                  <tr
                    key={s.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(s.status === "lead" ? `/app/crm/leads/${s.id}` : `/app/clientes/${s.id}/dashboard`)}
                  >
                    {/* Avatar + Nome */}
                    <td className="px-6 py-3" onClick={e => e.stopPropagation()}>
                      <div
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => navigate(s.status === "lead" ? `/app/crm/leads/${s.id}` : `/app/clientes/${s.id}/dashboard`)}
                      >
                        {s.foto_url ? (
                          <img
                            src={s.foto_url}
                            alt={s.nome_completo}
                            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                            {getInitials(s.nome_completo)}
                          </div>
                        )}
                        <span className="font-medium text-gray-900 hover:text-primary transition-colors">
                          {s.nome_completo}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[s.status]}`}>
                        {STATUS_LABEL[s.status]}
                      </span>
                    </td>

                    {/* Idade */}
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {calcAge(s.data_nascimento)}
                    </td>

                    {/* Sexo */}
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {s.sexo ? SEX_LABEL[s.sexo] : "—"}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(s.status === "lead" ? `/app/crm/leads/${s.id}` : `/app/clientes/${s.id}/dashboard`)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
                          title="Visualizar perfil"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
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
                                onClick={() => { navigate(s.status === "lead" ? `/app/crm/leads/${s.id}` : `/app/clientes/${s.id}/dashboard`); setMenuOpen(null); }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Visualizar perfil
                              </button>
                              <button
                                onClick={() => { navigate(`/app/clientes/${s.id}/cadastro`); setMenuOpen(null); }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Editar cadastro
                              </button>
                            </div>
                          )}
                        </div>
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
    {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    {menuOpen && (
      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
    )}
    </>
  );
}
