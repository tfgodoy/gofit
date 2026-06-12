import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, CheckCircle2, ScrollText, Search,
  Trash2, X, CreditCard, Banknote, QrCode, SlidersHorizontal,
  RefreshCw, ShoppingBag, Pencil, Tag, ChevronRight,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GoFitPayService } from "@/services/gofit-pay";
import { toast } from "sonner";

/* ── Types ──────────────────────────────────────────────────── */

interface Contrato {
  id: string;
  descricao: string;
  tipo: string;
  duracao: number;
  tipo_duracao: string;
  valor_total: number;
  valor_por_mes: number | null;
  tipo_cobranca: string;
  formas_pagamento: string[];
}

interface ContratoModalidade {
  modalidade_id: string;
  modalidade_nome: string;
  sessoes_por_semana: number;
  tipo_acesso: string;
  matricula_obrigatoria_na_venda: boolean;
}

interface ScheduleGrid {
  id: string;
  nome: string;
  modalidade_id: string;
  hora_inicio: string;
  hora_fim: string;
  dias_semana: string[];
}

interface EnrollmentSlot {
  grid_id: string;
  grid_nome: string;
  dia: string;
  hora_inicio: string;
  hora_fim: string;
}

interface Student {
  id: string;
  nome_completo: string;
  status: string;
}

type Fase = "venda" | "pagamento" | "concluido";
type TipoVenda = "sem_recorrencia" | "com_recorrencia";

/* ── Constants ──────────────────────────────────────────────── */

const DIAS_SHORT = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
const DIAS_LABEL_SHORT: Record<string, string> = {
  seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom",
};
const DIAS_LABEL_LONG: Record<string, string> = {
  seg: "Segunda-feira", ter: "Terça-feira", qua: "Quarta-feira",
  qui: "Quinta-feira",  sex: "Sexta-feira",  sab: "Sábado", dom: "Domingo",
};

const DURACAO_CHIPS = [
  { label: "Mensal",     duracao: 1,  tipo: "meses" },
  { label: "Trimestral", duracao: 3,  tipo: "meses" },
  { label: "Semestral",  duracao: 6,  tipo: "meses" },
  { label: "Anual",      duracao: 12, tipo: "meses" },
] as const;

const inputCls =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 " +
  "placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

/* ── Helpers ────────────────────────────────────────────────── */

function normalizeDia(dia: string): string {
  const map: Record<string, string> = {
    segunda: "seg", terca: "ter", quarta: "qua", quinta: "qui",
    sexta: "sex", sabado: "sab", domingo: "dom",
  };
  return map[dia] ?? dia;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}
function fmtDuracao(d: number, t: string) {
  if (t === "meses") return `${d} ${d === 1 ? "mês" : "meses"}`;
  if (t === "dias")  return `${d} dia${d !== 1 ? "s" : ""}`;
  return `${d} ${t}`;
}
function addMonths(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().split("T")[0];
}
function calcVenc(dataInicio: string, dia: number) {
  const d = new Date(dataInicio + "T00:00:00");
  const v = new Date(d.getFullYear(), d.getMonth(), dia);
  if (v < d) v.setMonth(v.getMonth() + 1);
  return v.toISOString().split("T")[0];
}

/* ── Sub-modal: Grades de horários (calendar grid) ─────────── */

function MatricularModal({
  modalidade, grids, selected, onSave, onClose,
}: {
  modalidade: ContratoModalidade;
  grids: ScheduleGrid[];
  selected: EnrollmentSlot[];
  onSave: (slots: EnrollmentSlot[]) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<EnrollmentSlot[]>(selected);
  const [diaFiltro, setDiaFiltro] = useState("");

  const calendar = useMemo(() => {
    const cal: Record<string, EnrollmentSlot[]> = {};
    DIAS_SHORT.forEach(d => (cal[d] = []));
    grids.forEach(g => {
      g.dias_semana.forEach(raw => {
        const dia = normalizeDia(raw);
        if (cal[dia]) {
          cal[dia].push({ grid_id: g.id, grid_nome: g.nome, dia, hora_inicio: g.hora_inicio, hora_fim: g.hora_fim });
        }
      });
    });
    DIAS_SHORT.forEach(d => cal[d].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)));
    return cal;
  }, [grids]);

  const needed = modalidade.sessoes_por_semana;
  const count  = local.length;

  function isSelected(s: EnrollmentSlot) {
    return local.some(l => l.grid_id === s.grid_id && l.dia === s.dia);
  }
  function toggle(s: EnrollmentSlot) {
    if (isSelected(s)) {
      setLocal(prev => prev.filter(l => !(l.grid_id === s.grid_id && l.dia === s.dia)));
    } else {
      if (count >= needed) return;
      setLocal(prev => [...prev, s]);
    }
  }

  const visibleDias = diaFiltro ? [diaFiltro] : DIAS_SHORT;
  const hasAnySlot  = DIAS_SHORT.some(d => calendar[d].length > 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Adicionar grades de horários</h3>
              <p className="text-xs text-gray-500 mt-0.5">{modalidade.modalidade_nome}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-gray-500">
              Horários selecionados:{" "}
              <span className={count >= needed ? "text-green-600" : "text-primary"}>{count}</span>{" "}de {needed}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
          <select value={diaFiltro} onChange={e => setDiaFiltro(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none bg-white">
            <option value="">Dia da semana</option>
            {DIAS_SHORT.map(d => <option key={d} value={d}>{DIAS_LABEL_LONG[d]}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          {!hasAnySlot ? (
            <p className="text-sm text-gray-400 text-center py-12">
              Nenhuma grade cadastrada para esta modalidade.{" "}
              <a href="/app/agenda/grades" className="text-primary underline">Criar grade</a>
            </p>
          ) : (
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${visibleDias.length}, minmax(120px, 1fr))` }}
            >
              {visibleDias.map(d => (
                <div key={d} className="text-center text-xs font-bold text-gray-500 pb-2 border-b border-gray-100">
                  {DIAS_LABEL_SHORT[d]}
                </div>
              ))}
              {visibleDias.map(d => (
                <div key={d} className="space-y-2 pt-1">
                  {calendar[d].length === 0 ? (
                    <div className="h-12" />
                  ) : calendar[d].map((slot, i) => {
                    const sel = isSelected(slot);
                    const atLimit = count >= needed && !sel;
                    return (
                      <button key={i} onClick={() => !atLimit && toggle(slot)} disabled={atLimit}
                        className={`w-full text-left rounded-xl p-2.5 border-2 transition-all ${
                          sel
                            ? "bg-primary border-primary text-white"
                            : atLimit
                              ? "bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed text-gray-400"
                              : "bg-primary/5 border-primary/20 hover:border-primary/60 text-gray-700"
                        }`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            sel ? "border-white bg-white" : "border-current"
                          }`}>
                            {sel && (
                              <svg className="w-2 h-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-xs font-bold">
                            {slot.hora_inicio.slice(0, 5)} - {slot.hora_fim.slice(0, 5)}
                          </span>
                        </div>
                        <p className={`text-[11px] leading-tight ml-5 ${sel ? "text-white/90" : "text-gray-600"}`}>
                          {slot.grid_nome}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600">
            FECHAR
          </button>
          <button onClick={() => { onSave(local); onClose(); }}
            className="flex-1 py-2.5 text-sm font-semibold bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors">
            SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal: Adicionar contratos ─────────────────────────────── */

function AdicionarContratoModal({
  contratos, onAdicionar, onClose,
}: {
  contratos: Contrato[];
  onAdicionar: (c: Contrato) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<typeof DURACAO_CHIPS[number] | null>(null);

  const filtered = contratos.filter(c => {
    const matchSearch = !search || c.descricao.toLowerCase().includes(search.toLowerCase());
    const matchChip   = !chip || (c.duracao === chip.duracao && c.tipo_duracao === chip.tipo);
    return matchSearch && matchChip;
  });

  function tipoLabel(t: string) {
    if (t === "com_recorrencia") return "GoFit Pay (Recorrente)";
    if (t === "sem_recorrencia") return "Manual";
    return "Escolha na venda";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <ScrollText className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Adicionar contratos</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar" className={`${inputCls} pl-9`} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {DURACAO_CHIPS.map(c => (
              <button key={c.label} onClick={() => setChip(chip?.label === c.label ? null : c)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                  chip?.label === c.label
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Nenhum contrato encontrado.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map(c => (
                <div key={c.id} className="border border-gray-200 rounded-xl p-4 hover:border-primary/30 transition-colors space-y-3">
                  <p className="text-sm font-bold text-gray-800 leading-snug">{c.descricao}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-400">Duração</p>
                      <p className="font-semibold text-gray-700">{fmtDuracao(c.duracao, c.tipo_duracao)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Taxa adesão</p>
                      <p className="font-semibold text-gray-700">Grátis</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Valor</p>
                      <p className="font-semibold text-gray-700">{fmtBRL(c.valor_total)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      {tipoLabel(c.tipo_cobranca)}
                    </span>
                    <button onClick={() => onAdicionar(c)}
                      className="text-xs font-bold text-primary border border-primary/30 px-3 py-1 rounded-lg hover:bg-primary/5 transition-colors">
                      ADICIONAR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end px-5 py-3 border-t border-gray-100">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2">
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */

export default function VendaWizardPage() {
  const { id: studentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [fase, setFase] = useState<Fase>("venda");
  const [student, setStudent] = useState<Student | null>(null);
  const [allContratos, setAllContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);

  // Venda
  const [dataVenda] = useState(new Date().toISOString().split("T")[0]);
  const [tipoVenda, setTipoVenda] = useState<TipoVenda | null>(null);
  const [showContratoModal, setShowContratoModal] = useState(false);
  const [contratoSelecionado, setContratoSelecionado] = useState<Contrato | null>(null);
  const [modalidadesContrato, setModalidadesContrato] = useState<ContratoModalidade[]>([]);
  const [gridsDisponiveis, setGridsDisponiveis] = useState<ScheduleGrid[]>([]);
  const [enrollments, setEnrollments] = useState<Record<string, EnrollmentSlot[]>>({});
  const [modalidadeMatricula, setModalidadeMatricula] = useState<ContratoModalidade | null>(null);
  const [renovacaoAutomatica, setRenovacaoAutomatica] = useState(false);
  const [desconto, setDesconto] = useState(0);
  const [numParcelas, setNumParcelas] = useState(1);
  const [loadingContrato, setLoadingContrato] = useState(false);

  // Cupom / desconto
  type DescontoMode = "none" | "manual" | "cupom";
  const [descontoMode, setDescontoMode] = useState<DescontoMode>("none");
  const [cupomInput, setCupomInput] = useState("");
  const [cupomLoading, setCupomLoading] = useState(false);
  const [cupomAplicado, setCupomAplicado] = useState<{
    id: string; codigo: string; tipo: string; valor: number; desconto_reais: number;
    usos_realizados: number;
  } | null>(null);
  const [cupomErro, setCupomErro] = useState("");

  // Pagamento
  const [formaPagamento, setFormaPagamento] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split("T")[0]);
  const [diaVencimento, setDiaVencimento] = useState(new Date().getDate());
  const [diaEditado, setDiaEditado] = useState(false);
  const [saving, setSaving] = useState(false);

  // Concluído
  const [resultado, setResultado] = useState<{
    nomeAluno: string; nomePlano: string; valorMensal: number; parcelas: number; vencimento: string;
  } | null>(null);

  /* Derived — desconto incide sobre o total do contrato; parcelas derivam do novo total */
  const valorTotalContrato = contratoSelecionado
    ? (contratoSelecionado.valor_total
        ?? (contratoSelecionado.valor_por_mes ?? 0) * contratoSelecionado.duracao)
    : 0;
  const descontoReais = cupomAplicado
    ? cupomAplicado.desconto_reais
    : valorTotalContrato * (desconto / 100);
  const totalComDesconto = Math.max(0, valorTotalContrato - descontoReais);
  const maxParcelas = contratoSelecionado?.tipo_duracao === "meses" ? contratoSelecionado.duracao : 1;
  const valorParcela = numParcelas > 0
    ? Math.round((totalComDesconto / numParcelas) * 100) / 100
    : 0;
  const dataFim = contratoSelecionado?.tipo_duracao === "meses"
    ? addMonths(dataInicio, contratoSelecionado.duracao) : null;

  const modalidadesComMatricula = modalidadesContrato.filter(
    m => m.tipo_acesso === "sessoes_semana" || m.matricula_obrigatoria_na_venda
  );
  const totalSlotsNecessarios  = modalidadesComMatricula.reduce((a, m) => a + m.sessoes_por_semana, 0);
  const totalSlotsSelecionados = Object.values(enrollments).reduce((a, s) => a + s.length, 0);

  useEffect(() => {
    if (!diaEditado && dataInicio) {
      setDiaVencimento(Math.min(new Date(dataInicio + "T00:00:00").getDate(), 28));
    }
  }, [dataInicio, diaEditado]);

  useEffect(() => {
    if (!user?.contractorId || !studentId) return;
    Promise.all([
      supabase.from("students").select("id, nome_completo, status")
        .eq("id", studentId).eq("contractor_id", user.contractorId!).maybeSingle(),
      supabase.from("contratos")
        .select("id, descricao, tipo, duracao, tipo_duracao, valor_total, valor_por_mes, tipo_cobranca, formas_pagamento")
        .eq("contractor_id", user.contractorId!).eq("ativo", true).order("descricao"),
    ]).then(([{ data: s }, { data: c }]) => {
      setStudent(s as Student | null);
      setAllContratos((c ?? []) as Contrato[]);
      setLoading(false);
    });
  }, [user, studentId]);

  async function handleAdicionarContrato(c: Contrato) {
    setShowContratoModal(false);
    setContratoSelecionado(c);
    setNumParcelas(c.tipo_duracao === "meses" ? c.duracao : 1);
    setEnrollments({});
    setLoadingContrato(true);

    const { data: modsData } = await supabase
      .from("contrato_modalidades")
      .select("modalidade_id, modalidade_nome, nome, sessoes_por_semana, tipo_acesso, matricula_obrigatoria_na_venda")
      .eq("contrato_id", c.id);

    const mods: ContratoModalidade[] = ((modsData ?? []) as any[])
      .filter(m => !!m.modalidade_id)
      .map(m => ({
        modalidade_id: m.modalidade_id,
        modalidade_nome: m.modalidade_nome ?? m.nome ?? "Modalidade",
        sessoes_por_semana: m.sessoes_por_semana ?? 1,
        tipo_acesso: m.tipo_acesso ?? "padrao",
        matricula_obrigatoria_na_venda: m.matricula_obrigatoria_na_venda ?? false,
      }));
    setModalidadesContrato(mods);

    const modsComMat = mods.filter(m => m.tipo_acesso === "sessoes_semana" || m.matricula_obrigatoria_na_venda);
    if (modsComMat.length > 0) {
      const { data: grids } = await supabase
        .from("schedule_grids")
        .select("id, nome, modalidade_id, hora_inicio, hora_fim, dias_semana")
        .eq("contractor_id", user!.contractorId!)
        .eq("ativo", true)
        .in("modalidade_id", modsComMat.map(m => m.modalidade_id))
        .order("hora_inicio");
      setGridsDisponiveis((grids ?? []) as ScheduleGrid[]);
    } else {
      setGridsDisponiveis([]);
    }
    setLoadingContrato(false);
  }

  async function handleAplicarCupom() {
    if (!cupomInput.trim() || !user?.contractorId) return;
    setCupomLoading(true);
    setCupomErro("");
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("cupons")
      .select("id, codigo, tipo, valor, uso_unico, usos_realizados, usos_maximo, data_validade")
      .eq("contractor_id", user.contractorId!)
      .ilike("codigo", cupomInput.trim())
      .eq("ativo", true)
      .maybeSingle();

    setCupomLoading(false);

    if (error || !data) { setCupomErro("Cupom não encontrado."); return; }
    if (data.data_validade && data.data_validade < today) { setCupomErro("Cupom expirado."); return; }
    if (data.usos_maximo !== null && data.usos_realizados >= data.usos_maximo) {
      setCupomErro("Cupom esgotado."); return;
    }

    const desconto_reais = data.tipo === "percentual"
      ? valorTotalContrato * (data.valor / 100)
      : Math.min(data.valor, valorTotalContrato);

    setCupomAplicado({
      id: data.id, codigo: data.codigo, tipo: data.tipo, valor: data.valor,
      desconto_reais, usos_realizados: data.usos_realizados ?? 0,
    });
    setCupomErro("");
  }

  function handleRemoverCupom() {
    setCupomAplicado(null);
    setCupomInput("");
    setCupomErro("");
  }

  async function handleConfirmar() {
    if (!user?.contractorId || !studentId || !contratoSelecionado || !tipoVenda) return;
    setSaving(true);
    try {
      const { data: sc, error: scErr } = await supabase.from("student_contracts").insert({
        contractor_id:       user.contractorId!,
        student_id:          studentId,
        contrato_id:         contratoSelecionado.id,
        data_inicio:         dataInicio,
        data_fim:            dataFim,
        status:              "ativo",
        valor_mensalidade:   valorParcela,
        dia_vencimento:      diaVencimento,
        forma_pagamento:     formaPagamento,
        tipo_venda:          tipoVenda,
        renovacao_automatica: renovacaoAutomatica,
        num_parcelas:        numParcelas,
      }).select("id").single();

      if (scErr || !sc) { toast.error("Erro ao criar contrato."); return; }

      const allSlots = Object.values(enrollments).flat();
      if (allSlots.length > 0) {
        await supabase.from("fixed_enrollments").insert(
          allSlots.map(s => ({
            contractor_id: user.contractorId!,
            student_id: studentId!,
            student_nome: student?.nome_completo ?? null,
            grid_id: s.grid_id,
            dia_semana: s.dia,
            ativo: true,
          }))
        );
      }

      // Gerar uma receivable por parcela/mês — última parcela absorve a diferença de centavos
      const vencBase = calcVenc(dataInicio, diaVencimento);
      const valorUltimaParcela = Math.round((totalComDesconto - valorParcela * (numParcelas - 1)) * 100) / 100;
      const descontoPorParcela = descontoReais > 0 ? Math.round((descontoReais / numParcelas) * 100) / 100 : 0;
      const parcelas = Array.from({ length: numParcelas }, (_, i) => {
        const vencFinal = i === 0 ? vencBase : addMonths(vencBase, i);
        const vencDate  = new Date(vencFinal + "T00:00:00");
        return {
          contractor_id:   user.contractorId!,
          student_id:      studentId!,
          student_nome:    student?.nome_completo ?? null,
          descricao:       `${contratoSelecionado.descricao} — ${vencDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
          valor:           i === numParcelas - 1 ? valorUltimaParcela : valorParcela,
          vencimento:      vencFinal,
          status:          "pendente",
          tipo:            "mensalidade",
          student_contract_id: sc.id,  // vínculo com a matrícula (contrato_id omitido — nullable)
          forma_pagamento: formaPagamento,
          desconto:        descontoPorParcela,
        };
      });

      const { data: parcelasCriadas, error: recErr } = await supabase
        .from("receivables").insert(parcelas).select("id, vencimento");
      if (recErr) { toast.error("Contrato criado, erro ao gerar cobranças: " + recErr.message); return; }

      // "Vender e receber agora": venda no cartão dispara a cobrança da PRIMEIRA
      // parcela no cartão principal tokenizado do aluno (Fase 15.3). A venda nunca
      // é desfeita se a cobrança falhar; a baixa segue exclusiva via webhook RECEIVED.
      if (formaPagamento === "cartao_credito" && parcelasCriadas?.length) {
        const primeira = [...parcelasCriadas]
          .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)))[0];

        const cardsRes = await GoFitPayService.listStudentCards(studentId!);
        const cartaoPrincipal = cardsRes.success && cardsRes.data
          ? cardsRes.data.cards.find(c => c.is_default && c.status === "active") ?? null
          : null;

        if (!cartaoPrincipal) {
          toast.warning(
            "Venda criada, mas não foi possível cobrar no cartão porque o aluno não possui cartão principal cadastrado.",
            { description: "Cadastre em Cliente → Mais Ações → Cartões, ou gere o link de cadastro para o aluno.", duration: 10000 }
          );
        } else {
          const cobranca = await GoFitPayService.chargeReceivableWithDefaultCard(primeira.id);
          if (cobranca.success && cobranca.data) {
            toast.success(
              cobranca.data.already_existed
                ? "Primeira parcela já possuía cobrança ativa no gateway."
                : `Primeira parcela enviada ao Asaas no cartão ${cobranca.data.card_brand ?? ""} **** ${cobranca.data.card_last4 ?? ""}. Status: ${cobranca.data.status ?? "—"}.`,
              { description: "A baixa financeira ocorrerá quando o pagamento for recebido/liquidado.", duration: 10000 }
            );
          } else {
            toast.error(
              "Venda criada, mas a cobrança no cartão falhou.",
              { description: cobranca.error ?? "Tente novamente em GoFit Pay → Cobranças → Cobrar no cartão cadastrado.", duration: 10000 }
            );
          }
        }
      }

      if (cupomAplicado) {
        await supabase.from("cupons")
          .update({ usos_realizados: cupomAplicado.usos_realizados + 1 } as any)
          .eq("id", cupomAplicado.id);
      }

      if (student?.status !== "ativo") {
        await supabase.from("students").update({ status: "ativo", updated_at: new Date().toISOString() }).eq("id", studentId!);
      }
      await supabase.from("opportunities")
        .update({ etapa: "Matrícula" })
        .eq("student_id", studentId!).eq("contractor_id", user.contractorId!)
        .neq("etapa", "Matrícula").neq("etapa", "Perdido");

      setResultado({
        nomeAluno: student?.nome_completo ?? "",
        nomePlano: contratoSelecionado.descricao,
        valorMensal: valorParcela,
        parcelas: numParcelas,
        vencimento: vencBase,
      });
      navigate(`/app/clientes/${studentId}/dashboard`);
    } finally {
      setSaving(false);
    }
  }

  /* ── Loading ── */
  if (loading) return (
    <AppLayout>
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    </AppLayout>
  );

  /* ── Concluído ── */
  if (fase === "concluido" && resultado) return (
    <AppLayout>
      <div className="px-8 py-6 max-w-lg">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Venda realizada com sucesso!</h2>
          <p className="text-sm text-gray-600">
            <strong>{resultado.nomeAluno}</strong> matriculado(a) em{" "}
            <strong>{resultado.nomePlano}</strong>.
          </p>
          <p className="text-sm text-gray-500">
            {resultado.parcelas > 1
              ? `${resultado.parcelas}x de ${fmtBRL(resultado.valorMensal)} — 1ª parcela vence em ${fmtDate(resultado.vencimento)}.`
              : `${fmtBRL(resultado.valorMensal)} com vencimento em ${fmtDate(resultado.vencimento)}.`}
          </p>
          <div className="flex justify-center gap-3 pt-4">
            <button onClick={() => navigate("/app/financeiro/contas-a-receber")}
              className="px-5 py-2.5 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              VER FINANCEIRO
            </button>
            <button onClick={() => navigate(`/app/clientes/${studentId}/dashboard`)}
              className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
              PERFIL DO ALUNO
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );

  /* ── Pagamento ── */
  if (fase === "pagamento") {
    const formas = [
      { key: "cartao_credito", label: "Cartão",       icon: <CreditCard className="w-6 h-6" /> },
      { key: "pix",            label: "Pix",           icon: <QrCode className="w-6 h-6" /> },
      { key: "boleto",         label: "Boleto",        icon: <Banknote className="w-6 h-6" /> },
      { key: "dinheiro",       label: "Personalizado", icon: <SlidersHorizontal className="w-6 h-6" /> },
    ];
    return (
      <AppLayout>
        <div className="px-8 py-6 max-w-2xl space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setFase("venda")} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Escolha como quer receber</h1>
              {student && <p className="text-sm text-gray-500 mt-0.5">{student.nome_completo}</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="grid grid-cols-4 gap-3">
              {formas.map(f => (
                <button key={f.key} onClick={() => setFormaPagamento(f.key)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                    formaPagamento === f.key
                      ? "border-primary text-primary bg-primary/5"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}>
                  {f.icon}
                  <span className="text-xs font-semibold">{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          {formaPagamento && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-700">Dados do pagamento</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Cobranças geradas</p>
                  <p className="text-sm font-bold text-gray-800">{numParcelas}x de {fmtBRL(valorParcela)}</p>
                  <p className="text-xs text-gray-400 mt-1">Total: {fmtBRL(totalComDesconto)}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Data de início</label>
                  <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 whitespace-nowrap">Dia do pagamento</span>
                <input type="number" min={1} max={28} value={diaVencimento}
                  onChange={e => { setDiaVencimento(Math.max(1, Math.min(28, Number(e.target.value)))); setDiaEditado(true); }}
                  className={`${inputCls} max-w-[80px] text-center`} />
                <span className="text-xs text-gray-400">(máx. 28)</span>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
                {numParcelas > 1
                  ? `${numParcelas} cobranças de ${fmtBRL(valorParcela)} — 1ª vence em ${dataInicio ? fmtDate(calcVenc(dataInicio, diaVencimento)) : "—"}.`
                  : `Cobrança única de ${fmtBRL(valorParcela)} com vencimento em ${dataInicio ? fmtDate(calcVenc(dataInicio, diaVencimento)) : "—"}.`}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pb-8">
            <button onClick={() => setFase("venda")}
              className="px-5 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors">
              VOLTAR
            </button>
            <button onClick={handleConfirmar} disabled={!formaPagamento || saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              CONCLUIR VENDA
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  /* ── Venda ── */
  const mostrarRenovacao = contratoSelecionado?.tipo_duracao === "meses" && (contratoSelecionado?.duracao ?? 0) > 1;

  return (
    <AppLayout>
      <div className="px-8 py-6 max-w-2xl space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/app/clientes/${studentId}/dashboard`)}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nova Venda</h1>
            {student && <p className="text-sm text-gray-500 mt-0.5">{student.nome_completo}</p>}
          </div>
        </div>

        {/* Dados da venda */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Dados da venda</h3>
          <div className="flex items-center gap-8 text-sm">
            <div>
              <p className="text-xs text-gray-400">Data da venda</p>
              <p className="font-semibold text-gray-800">{fmtDate(dataVenda)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Consultor</p>
              <p className="font-semibold text-gray-800">{user?.name ?? "—"}</p>
            </div>
          </div>
        </div>

        {/* Tipo de venda */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Escolha o tipo de venda você deseja realizar</h3>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: "sem_recorrencia" as TipoVenda, icon: <ShoppingBag className="w-6 h-6" />, label: "Sem recorrência", desc: "Venda de contratos sem recorrência automática." },
              { key: "com_recorrencia" as TipoVenda, icon: <RefreshCw className="w-6 h-6" />,  label: "Com recorrência (GoFit Pay)", desc: "Renovação automática. Não afeta limite do cartão." },
            ]).map(t => (
              <button key={t.key}
                onClick={() => { setTipoVenda(t.key); setContratoSelecionado(null); setEnrollments({}); }}
                className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 text-center transition-colors ${
                  tipoVenda === t.key
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}>
                {t.icon}
                <span className="text-sm font-bold">{t.label}</span>
                <span className="text-xs text-gray-400 leading-snug">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Adicionar contrato */}
        {tipoVenda && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700">
                Adicione um contrato {tipoVenda === "com_recorrencia" ? "recorrente " : ""}para a venda
              </h3>
              {!contratoSelecionado && (
                <button onClick={() => setShowContratoModal(true)}
                  className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors">
                  ADICIONAR
                </button>
              )}
            </div>

            {loadingContrato ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : contratoSelecionado ? (
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <ScrollText className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{contratoSelecionado.descricao}</p>
                      <p className="text-xs text-gray-500">
                        {fmtDuracao(contratoSelecionado.duracao, contratoSelecionado.tipo_duracao)} • {fmtBRL(contratoSelecionado.valor_total)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {totalSlotsNecessarios > 0 && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        totalSlotsSelecionados >= totalSlotsNecessarios
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {totalSlotsSelecionados >= totalSlotsNecessarios ? "Matrícula reservada" : "Sem matrícula"}
                      </span>
                    )}
                    <button onClick={() => setShowContratoModal(true)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setContratoSelecionado(null); setEnrollments({}); setModalidadesContrato([]); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Matrículas */}
                {modalidadesComMatricula.length > 0 && (
                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-600">Matrículas nas grades de horários</span>
                      <span className={`font-semibold ${totalSlotsSelecionados >= totalSlotsNecessarios ? "text-green-600" : "text-primary"}`}>
                        Horários selecionados: {totalSlotsSelecionados} de {totalSlotsNecessarios}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {modalidadesComMatricula.map(mod => {
                        const slots = enrollments[mod.modalidade_id] ?? [];
                        return (
                          <div key={mod.modalidade_id} className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-gray-700 truncate pr-2">{mod.modalidade_nome}</p>
                              <button onClick={() => setModalidadeMatricula(mod)}
                                className="text-xs font-semibold text-primary hover:underline flex-shrink-0">
                                MATRICULAR
                              </button>
                            </div>
                            {slots.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">Nenhuma matrícula reservada.</p>
                            ) : slots.map((s, i) => (
                              <div key={i} className="flex items-center justify-between text-xs text-gray-600 bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                                <span className="truncate">{s.grid_nome}, {DIAS_LABEL_LONG[s.dia]?.toLowerCase()} {s.hora_inicio.slice(0, 5)}</span>
                                <button onClick={() => setEnrollments(prev => ({
                                  ...prev,
                                  [mod.modalidade_id]: (prev[mod.modalidade_id] ?? []).filter((_, ii) => ii !== i),
                                }))} className="text-gray-300 hover:text-red-500 ml-1 flex-shrink-0">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">Nenhum contrato adicionado.</p>
            )}
          </div>
        )}

        {/* Renovação */}
        {contratoSelecionado && mostrarRenovacao && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Como será a renovação do contrato após seu término?</h3>
            <div className="grid grid-cols-2 gap-3">
              {[{ value: true, label: "Renovação automática" }, { value: false, label: "Sem renovação" }].map(opt => (
                <button key={String(opt.value)} onClick={() => setRenovacaoAutomatica(opt.value)}
                  className={`py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                    renovacaoAutomatica === opt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Valor da venda */}
        {contratoSelecionado && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-700">Valor da venda</h3>

            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-xl font-extrabold text-gray-900">{fmtBRL(valorTotalContrato)}</span>
            </div>

            {/* Ações de desconto */}
            {descontoMode === "none" && !cupomAplicado && (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setDescontoMode("manual")}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  INFORMAR DESCONTO
                </button>
                <span className="text-gray-300 text-sm">ou</span>
                <button
                  onClick={() => setDescontoMode("cupom")}
                  className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-primary border border-gray-200 rounded-lg px-3 py-1.5 hover:border-primary/40 transition-colors"
                >
                  <Tag className="w-3.5 h-3.5" />
                  Aplicar cupom
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Modo: desconto manual — % e R$ sincronizados, sobre o total do contrato */}
            {descontoMode === "manual" && (
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">% de desconto</label>
                  <input
                    type="number" min={0} max={100} step="0.01" value={desconto} autoFocus
                    onChange={e => setDesconto(Math.max(0, Math.min(100, Number(e.target.value))))}
                    className={`${inputCls} max-w-[90px] text-center`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Valor desconto (R$)</label>
                  <input
                    type="number" min={0} max={valorTotalContrato} step="0.01"
                    value={Math.round(descontoReais * 100) / 100}
                    onChange={e => {
                      const reais = Math.max(0, Math.min(valorTotalContrato, Number(e.target.value)));
                      setDesconto(valorTotalContrato > 0
                        ? Math.round((reais / valorTotalContrato) * 10000) / 100
                        : 0);
                    }}
                    className={`${inputCls} max-w-[120px] text-center`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Valor após desconto</label>
                  <p className="text-sm font-bold text-gray-800 py-2">{fmtBRL(totalComDesconto)}</p>
                </div>
                <button
                  onClick={() => { setDescontoMode("none"); setDesconto(0); }}
                  className="ml-auto mb-2 text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Modo: cupom */}
            {descontoMode === "cupom" && !cupomAplicado && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      autoFocus
                      value={cupomInput}
                      onChange={e => { setCupomInput(e.target.value.toUpperCase()); setCupomErro(""); }}
                      onKeyDown={e => e.key === "Enter" && handleAplicarCupom()}
                      placeholder="Código do cupom"
                      className={`${inputCls} pl-9 uppercase`}
                    />
                  </div>
                  <button
                    onClick={handleAplicarCupom}
                    disabled={!cupomInput.trim() || cupomLoading}
                    className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    {cupomLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "APLICAR"}
                  </button>
                  <button
                    onClick={() => { setDescontoMode("none"); setCupomInput(""); setCupomErro(""); }}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {cupomErro && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <X className="w-3 h-3" /> {cupomErro}
                  </p>
                )}
              </div>
            )}

            {/* Cupom aplicado */}
            {cupomAplicado && (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-bold text-green-700">{cupomAplicado.codigo}</span>
                  <span className="text-xs text-green-600">
                    {cupomAplicado.tipo === "percentual"
                      ? `${cupomAplicado.valor}% de desconto`
                      : `${fmtBRL(cupomAplicado.valor)} de desconto`}
                  </span>
                </div>
                <button onClick={handleRemoverCupom} className="text-green-400 hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Linha de desconto aplicado */}
            {descontoReais > 0 && (
              <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-3">
                <span className="text-gray-500">Desconto</span>
                <span className="text-red-500 font-semibold">− {fmtBRL(descontoReais)}</span>
              </div>
            )}
            {descontoReais > 0 && (
              <div className="flex items-center justify-between text-sm font-bold">
                <span className="text-gray-700">Valor total após desconto</span>
                <span className="text-lg text-primary">{fmtBRL(totalComDesconto)}</span>
              </div>
            )}

            {/* Parcelamento — permite vender ex.: plano anual em 8x */}
            {maxParcelas > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-sm text-gray-600">Parcelamento</span>
                <select
                  value={numParcelas}
                  onChange={e => setNumParcelas(Number(e.target.value))}
                  className={`${inputCls} max-w-[200px]`}
                >
                  {Array.from({ length: maxParcelas }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>
                      {n}x de {fmtBRL(Math.round((totalComDesconto / n) * 100) / 100)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        {contratoSelecionado && (
          <div className="flex justify-end pb-8">
            <button onClick={() => setFase("pagamento")}
              className="px-8 py-3 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors shadow-sm">
              VENDER E RECEBER AGORA
            </button>
          </div>
        )}
      </div>

      {showContratoModal && (
        <AdicionarContratoModal
          contratos={allContratos}
          onAdicionar={handleAdicionarContrato}
          onClose={() => setShowContratoModal(false)}
        />
      )}

      {modalidadeMatricula && (
        <MatricularModal
          modalidade={modalidadeMatricula}
          grids={gridsDisponiveis.filter(g => g.modalidade_id === modalidadeMatricula.modalidade_id)}
          selected={enrollments[modalidadeMatricula.modalidade_id] ?? []}
          onSave={slots => setEnrollments(prev => ({ ...prev, [modalidadeMatricula.modalidade_id]: slots }))}
          onClose={() => setModalidadeMatricula(null)}
        />
      )}
    </AppLayout>
  );
}
