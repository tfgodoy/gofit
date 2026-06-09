import { useState, useEffect } from "react";
import { Plus, Search, FileText, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Contrato {
  id: string;
  descricao: string;
  tipo: string;
  duracao: number;
  tipo_duracao: string;
  valor_total: number;
  valor_por_mes: number | null;
  permite_renovar: boolean;
  renova_automaticamente: boolean;
  renovacao_quando: string | null;
  permite_parcelado: boolean;
  max_parcelas: number | null;
  formas_pagamento: string[];
  template_contrato: string | null;
  assinatura_eletronica: boolean;
  forma_envio_assinatura: string | null;
  ativo: boolean;
  limita_periodo_venda: boolean;
  data_inicio_venda: string | null;
  data_fim_venda: string | null;
  max_suspensoes: number | null;
  max_dias_suspensao: number | null;
  permite_pre_venda: boolean;
  possui_valor_adesao: boolean;
  valor_adesao: number | null;
  comissionar_consultor: boolean;
  categoria_receita: string | null;
  created_at: string;
}

const TIPO_BADGE: Record<string, { label: string; cls: string }> = {
  padrao:    { label: "Padrão",    cls: "bg-gray-100 text-gray-600" },
  totalpass: { label: "TotalPass", cls: "bg-pink-100 text-pink-700" },
  wellhub:   { label: "Wellhub",   cls: "bg-pink-100 text-pink-700" },
  gympass:   { label: "GymPass",   cls: "bg-orange-100 text-orange-700" },
};

const PAGTO_LABEL: Record<string, string> = {
  dinheiro:       "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito:  "Cartão de débito",
  pix:            "PIX",
  boleto:         "Boleto",
  transferencia:  "Transferência",
};

const PAGE_SIZE = 20;

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDuracao(duracao: number, tipo: string) {
  const labels: Record<string, string> = { dias: "dia", meses: "mês/meses", anos: "ano" };
  return `${duracao} ${labels[tipo] ?? tipo}`;
}

export default function ContratosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [filtered, setFiltered] = useState<Contrato[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);
    const { data } = await supabase
      .from("contratos")
      .select("*")
      .eq("contractor_id", user.contractorId)
      .order("descricao", { ascending: true });
    setContratos((data ?? []) as Contrato[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    setFiltered(q ? contratos.filter(c => c.descricao.toLowerCase().includes(q)) : contratos);
    setPage(1);
  }, [search, contratos]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleDelete(id: string) {
    const { error } = await supabase.from("contratos").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir contrato."); return; }
    toast.success("Contrato excluído.");
    setDeleteId(null);
    load();
  }

  function openNew() { navigate("/app/administrativo/contratos/novo"); }
  function openEdit(c: Contrato) { navigate(`/app/administrativo/contratos/${c.id}/editar`); }

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-900 flex-shrink-0">Contratos</h1>

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

              <div className="ml-auto">
                <button
                  onClick={openNew}
                  className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" /> CONTRATO
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
                <FileText className="w-12 h-12 text-gray-200" />
                <p className="text-sm text-gray-400">
                  {contratos.length === 0 ? "Nenhum contrato cadastrado ainda." : "Nenhum resultado encontrado."}
                </p>
                {contratos.length === 0 && (
                  <button onClick={openNew} className="text-xs font-semibold text-primary hover:underline">
                    Criar primeiro contrato →
                  </button>
                )}
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold">
                      <th className="text-left px-6 py-3">Descrição</th>
                      <th className="text-left px-4 py-3">Duração</th>
                      <th className="text-left px-4 py-3">Parcelamento</th>
                      <th className="text-left px-4 py-3">Valor total</th>
                      <th className="text-left px-4 py-3">Forma pagto / Agregador</th>
                      <th className="px-4 py-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginated.map(c => {
                      const badge = TIPO_BADGE[c.tipo] ?? TIPO_BADGE.padrao;
                      return (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{c.descricao}</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {fmtDuracao(c.duracao, c.tipo_duracao)}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {c.permite_parcelado && c.max_parcelas
                              ? `Até ${c.max_parcelas}x`
                              : "À vista"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {fmtMoeda(c.valor_total)}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {c.formas_pagamento.length > 0
                              ? c.formas_pagamento.map(f => PAGTO_LABEL[f] ?? f).join(", ")
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => openEdit(c)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteId(c.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
                  <span>Página {page} de {totalPages} — {filtered.length} contrato{filtered.length !== 1 ? "s" : ""}</span>
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

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Excluir contrato?</h3>
            <p className="text-sm text-gray-500 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="text-primary font-semibold text-sm hover:underline px-2"
              >
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
