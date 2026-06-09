import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { useState, useEffect } from "react";
import { Plus, Search, ChevronLeft, ChevronRight, X, CheckCircle } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Commission {
  id:             string;
  staff_id:       string;
  student_nome:   string | null;
  tipo:           string;
  descricao:      string;
  valor_base:     number;
  percentual:     number;
  valor_comissao: number;
  status:         string;
  pago_em:        string | null;
  created_at:     string;
  staff:          { name: string; role: string | null } | null;
}

interface StaffMember { id: string; name: string; role: string | null }

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtData(s: string | null) {
  if (!s) return "—";
  return new Date(s + "T12:00:00").toLocaleDateString("pt-BR");
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-yellow-100 text-yellow-700" },
  pago:     { label: "Pago",     cls: "bg-green-100 text-green-700"   },
};

const PAGE_SIZE = 20;

/* ── Modal de lançar comissão ───────────────────────── */
function LancarComissaoModal({
  onClose, onSaved, staffList,
}: { onClose: () => void; onSaved: () => void; staffList: StaffMember[] }) {
  const { user } = useAuth();
  const [staffId,      setStaffId]      = useState(staffList[0]?.id ?? "");
  const [descricao,    setDescricao]    = useState("");
  const [tipo,         setTipo]         = useState("venda");
  const [studentNome,  setStudentNome]  = useState("");
  const [valorBase,    setValorBase]    = useState("");
  const [percentual,   setPercentual]   = useState("10");
  const [saving,       setSaving]       = useState(false);

  const base  = parseFloat(valorBase.replace(",", "."))   || 0;
  const pct   = parseFloat(percentual.replace(",", "."))  || 0;
  const comissao = (base * pct) / 100;

  async function handleSave() {
    if (!user?.contractorId || !staffId || !descricao.trim() || base <= 0 || pct <= 0) {
      toast.error("Preencha todos os campos obrigatórios."); return;
    }
    setSaving(true);
    const { error } = await supabase.from("commissions").insert({
      contractor_id:  user.contractorId,
      staff_id:       staffId,
      student_nome:   studentNome.trim() || null,
      tipo,
      descricao:      descricao.trim(),
      valor_base:     base,
      percentual:     pct,
      valor_comissao: comissao,
    });
    if (error) { toast.error("Erro ao lançar comissão."); setSaving(false); return; }
    toast.success("Comissão lançada.");
    onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Lançar comissão</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Consultor/Staff *</label>
            <select
              value={staffId}
              onChange={e => setStaffId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.role ? ` · ${s.role}` : ""}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="venda">Venda</option>
                <option value="renovacao">Renovação</option>
                <option value="aula">Aula</option>
                <option value="indicacao">Indicação</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Aluno (opcional)</label>
              <input
                type="text"
                value={studentNome}
                onChange={e => setStudentNome(e.target.value)}
                placeholder="Nome do aluno"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição *</label>
            <input
              type="text"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Matrícula plano Semestral"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Valor base (R$) *</label>
              <CurrencyInput
                value={valorBase}
                onChange={setValorBase}
                placeholder="0,00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Percentual (%) *</label>
              <input
                type="text"
                value={percentual}
                onChange={e => setPercentual(e.target.value)}
                placeholder="10"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
          {base > 0 && pct > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
              <p className="text-sm text-gray-600">
                Comissão calculada: <span className="font-bold text-primary text-base">{fmtMoeda(comissao)}</span>
                <span className="text-xs text-gray-400 ml-2">({pct}% de {fmtMoeda(base)})</span>
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-800 px-3 py-2">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? "Salvando..." : "Lançar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────── */
export default function ComissoesPage() {
  const { user } = useAuth();
  const [all,       setAll]       = useState<Commission[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pendente" | "pago">("todos");
  const [staffFilter,  setStaffFilter]  = useState("todos");
  const [page,      setPage]      = useState(1);
  const [showLancar, setShowLancar] = useState(false);
  const [paying,    setPaying]    = useState<string | null>(null);

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);
    const [{ data: comData }, { data: staffData }] = await Promise.all([
      supabase.from("commissions")
        .select("*, staff!staff_id(name, role)")
        .eq("contractor_id", user.contractorId)
        .order("created_at", { ascending: false }),
      supabase.from("staff").select("id, name, role")
        .eq("contractor_id", user.contractorId).eq("active", true),
    ]);
    setAll((comData ?? []) as unknown as Commission[]);
    setStaffList((staffData ?? []) as unknown as StaffMember[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  async function handlePagar(id: string) {
    const { error } = await supabase.from("commissions").update({
      status: "pago", pago_em: new Date().toISOString().split("T")[0],
    }).eq("id", id);
    if (error) { toast.error("Erro ao registrar pagamento."); return; }
    toast.success("Comissão paga.");
    setPaying(null);
    load();
  }

  /* Totals */
  const totalPendente = all.filter(c => c.status === "pendente").reduce((s, c) => s + c.valor_comissao, 0);
  const totalPagoMes  = all.filter(c => c.status === "pago" && c.pago_em?.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, c) => s + c.valor_comissao, 0);
  const totalGeral    = all.reduce((s, c) => s + c.valor_comissao, 0);

  /* Filters */
  const filtered = all.filter(c => {
    if (statusFilter !== "todos" && c.status !== statusFilter) return false;
    if (staffFilter  !== "todos" && c.staff_id !== staffFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.descricao.toLowerCase().includes(q) || (c.student_nome?.toLowerCase().includes(q) ?? false) || ((c.staff as any)?.nome_completo?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* Ranking by staff */
  const ranking = staffList.map(s => ({
    nome: s.name,
    total: all.filter(c => c.staff_id === s.id).reduce((sum, c) => sum + c.valor_comissao, 0),
    qtd:   all.filter(c => c.staff_id === s.id).length,
  })).sort((a, b) => b.total - a.total).slice(0, 5);

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-900 flex-shrink-0">Comissões</h1>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar descrição, aluno ou consultor"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={staffFilter}
                  onChange={e => { setStaffFilter(e.target.value); setPage(1); }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="todos">Todos os consultores</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button
                  onClick={() => setShowLancar(true)}
                  className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" /> LANÇAR
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-gray-50">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4 px-8 py-5">
              {[
                { label: "Total a pagar", value: fmtMoeda(totalPendente), cls: totalPendente > 0 ? "text-yellow-700" : "text-gray-900" },
                { label: "Pago no mês",   value: fmtMoeda(totalPagoMes),  cls: "text-green-700" },
                { label: "Total geral",   value: fmtMoeda(totalGeral),    cls: "text-gray-900" },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 font-medium mb-1">{k.label}</p>
                  <p className={`text-lg font-bold ${k.cls}`}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Ranking + Tabela */}
            <div className="px-8 pb-8 grid grid-cols-1 lg:grid-cols-4 gap-5">
              {/* Ranking */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-1">
                <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Ranking</h2>
                {ranking.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhuma comissão registrada</p>
                ) : (
                  <div className="space-y-3">
                    {ranking.map((r, i) => (
                      <div key={r.nome} className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{r.nome}</p>
                          <p className="text-xs text-gray-400">{r.qtd} lançamento{r.qtd !== 1 ? "s" : ""}</p>
                        </div>
                        <p className="text-sm font-bold text-primary flex-shrink-0">{fmtMoeda(r.total)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tabela */}
              <div className="lg:col-span-3">
                {/* Tabs */}
                <div className="bg-white rounded-t-xl border border-gray-200 border-b-0">
                  <div className="flex items-center gap-1 px-4 pt-3">
                    {(["todos", "pendente", "pago"] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => { setStatusFilter(tab); setPage(1); }}
                        className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                          statusFilter === tab ? "text-primary border-b-2 border-primary" : "text-gray-500 hover:text-gray-800"
                        }`}
                      >
                        {{ todos: "Todos", pendente: "Pendente", pago: "Pago" }[tab]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-b-xl border border-gray-200 border-t-0 overflow-hidden">
                  {loading ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2">
                      <p className="text-sm text-gray-400">Nenhuma comissão encontrada.</p>
                    </div>
                  ) : (
                    <>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold">
                            <th className="text-left px-5 py-3">Consultor</th>
                            <th className="text-left px-4 py-3">Descrição</th>
                            <th className="text-left px-4 py-3">Tipo</th>
                            <th className="text-right px-4 py-3">Base</th>
                            <th className="text-right px-4 py-3">%</th>
                            <th className="text-right px-4 py-3">Comissão</th>
                            <th className="text-left px-4 py-3">Status</th>
                            <th className="px-4 py-3 w-16"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {paginated.map(c => {
                            const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.pendente;
                            return (
                              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-5 py-3 font-medium text-gray-900 text-sm">
                                  {(c.staff as any)?.name ?? "—"}
                                </td>
                                <td className="px-4 py-3 text-gray-700 max-w-[180px]">
                                  <p className="truncate">{c.descricao}</p>
                                  {c.student_nome && <p className="text-xs text-gray-400">{c.student_nome}</p>}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-500 capitalize">{c.tipo}</td>
                                <td className="px-4 py-3 text-right text-gray-600">{fmtMoeda(c.valor_base)}</td>
                                <td className="px-4 py-3 text-right text-gray-600">{c.percentual}%</td>
                                <td className="px-4 py-3 text-right font-bold text-primary">{fmtMoeda(c.valor_comissao)}</td>
                                <td className="px-4 py-3">
                                  <div>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                                    {c.pago_em && <p className="text-xs text-gray-400 mt-0.5">{fmtData(c.pago_em)}</p>}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {c.status === "pendente" && (
                                    <button
                                      onClick={() => setPaying(c.id)}
                                      title="Marcar como pago"
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm text-gray-500">
                        <span>Página {page} de {totalPages} — {filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
                        <div className="flex items-center gap-1">
                          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>

      {showLancar && (
        <LancarComissaoModal
          onClose={() => setShowLancar(false)}
          onSaved={load}
          staffList={staffList}
        />
      )}

      {paying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Confirmar pagamento</h3>
            <p className="text-sm text-gray-500 mb-6">Marcar esta comissão como paga hoje?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setPaying(null)} className="text-primary font-semibold text-sm hover:underline px-2">Cancelar</button>
              <button onClick={() => handlePagar(paying)} className="bg-green-600 text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
                Confirmar pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
