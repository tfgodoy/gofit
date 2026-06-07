import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, CheckCircle2, ScrollText } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  formas_pagamento: string[];
}

interface Student {
  id: string;
  nome_completo: string;
  status: string;
}

interface ModalidadeObrigatoriaVenda {
  modalidade_id: string;
  modalidade_nome: string;
  sessoes_por_semana: number;
}

interface ScheduleGrid {
  id: string;
  nome: string;
  modalidade_id: string;
  hora_inicio: string;
  hora_fim: string;
  dias_semana: string[];
  capacidade_maxima: number | null;
  cor: string | null;
}

type Step = "selecionar-plano" | "configurar-turma" | "conferencia" | "concluido";

/* ── Constants ──────────────────────────────────────────────── */

const FORMA_LABEL: Record<string, string> = {
  dinheiro:       "Dinheiro",
  pix:            "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito:  "Cartão de débito",
  boleto:         "Boleto",
  transferencia:  "Transferência",
};

const DIAS_LABEL: Record<string, string> = {
  seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom",
};
const DIAS_ORDER = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

const FILTROS = [
  { label: "Todos",       duracao: null, tipo_duracao: null   },
  { label: "Mensal",      duracao: 1,    tipo_duracao: "meses" },
  { label: "Trimestral",  duracao: 3,    tipo_duracao: "meses" },
  { label: "Semestral",   duracao: 6,    tipo_duracao: "meses" },
  { label: "Anual",       duracao: 12,   tipo_duracao: "meses" },
] as const;

const inputClass =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

/* ── Helpers ────────────────────────────────────────────────── */

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDateBR(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

function calcVencimento(dataInicio: string, diaVencimento: number): string {
  const d = new Date(dataInicio + "T00:00:00");
  const v = new Date(d.getFullYear(), d.getMonth(), diaVencimento);
  if (v < d) v.setMonth(v.getMonth() + 1);
  return v.toISOString().split("T")[0];
}

function fmtDuracao(duracao: number, tipo: string) {
  if (tipo === "meses") return `${duracao} ${duracao === 1 ? "mês" : "meses"}`;
  if (tipo === "dias")  return `${duracao} dia${duracao !== 1 ? "s" : ""}`;
  if (tipo === "anos")  return `${duracao} ano${duracao !== 1 ? "s" : ""}`;
  return `${duracao} ${tipo}`;
}

/* ── Row helper ─────────────────────────────────────────────── */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-semibold text-gray-800 text-right">{value}</span>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */

export default function VendaWizardPage() {
  const { id: studentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("selecionar-plano");
  const [student, setStudent] = useState<Student | null>(null);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);

  // Step 1
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>(FILTROS[0]);
  const [contratoSelecionado, setContratoSelecionado] = useState<Contrato | null>(null);
  const [loadingTurmas, setLoadingTurmas] = useState(false);

  // Step 2
  const [modalidadesObrigatorias, setModalidadesObrigatorias] = useState<ModalidadeObrigatoriaVenda[]>([]);
  const [gridsDisponiveis, setGridsDisponiveis] = useState<ScheduleGrid[]>([]);
  const [gridesPorModalidade, setGridesPorModalidade] = useState<Record<string, string[]>>({});

  // Step 3
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split("T")[0]);
  const [diaVencimento, setDiaVencimento] = useState(new Date().getDate());
  const [diaVencimentoEditado, setDiaVencimentoEditado] = useState(false); // true quando gestor alterou manualmente
  const [desconto, setDesconto] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState("pix");

  // Step 4
  const [resultadoVenda, setResultadoVenda] = useState<{
    nomeAluno: string;
    nomePlano: string;
    valorFinal: number;
    vencimento: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);

  /* Derived
     Para plano de 1 mês: valor mensal = valor_total (são iguais por definição).
     Para planos multi-mês: usa valor_por_mes se preenchido, senão divide valor_total pela duração. */
  const valorMensalidade = contratoSelecionado
    ? contratoSelecionado.duracao === 1
      ? contratoSelecionado.valor_total
      : (contratoSelecionado.valor_por_mes ?? contratoSelecionado.valor_total / contratoSelecionado.duracao)
    : 0;
  const valorComDesconto = valorMensalidade * (1 - desconto / 100);
  const dataFim = contratoSelecionado && contratoSelecionado.tipo_duracao === "meses"
    ? addMonths(dataInicio, contratoSelecionado.duracao)
    : null;

  const turmasCompletas = modalidadesObrigatorias.every(
    m => (gridesPorModalidade[m.modalidade_id] ?? []).length >= m.sessoes_por_semana
  );

  const contratosFiltrados = contratos.filter(c => {
    if (!filtro.duracao) return true;
    return c.duracao === filtro.duracao && c.tipo_duracao === filtro.tipo_duracao;
  });

  /* Sincronizar dia de vencimento com a data de início (se o gestor não alterou manualmente) */
  useEffect(() => {
    if (!diaVencimentoEditado && dataInicio) {
      const dia = new Date(dataInicio + "T00:00:00").getDate();
      setDiaVencimento(Math.min(dia, 28));
    }
  }, [dataInicio, diaVencimentoEditado]);

  /* Load student + contracts */
  useEffect(() => {
    if (!user?.contractorId || !studentId) return;
    Promise.all([
      supabase.from("students").select("id, nome_completo, status")
        .eq("id", studentId).eq("contractor_id", user.contractorId!).maybeSingle(),
      supabase.from("contratos")
        .select("id, descricao, tipo, duracao, tipo_duracao, valor_total, valor_por_mes, formas_pagamento")
        .eq("contractor_id", user.contractorId!).eq("ativo", true).order("descricao"),
    ]).then(([{ data: s }, { data: c }]) => {
      setStudent(s as Student | null);
      setContratos((c ?? []) as Contrato[]);
      setLoading(false);
    });
  }, [user, studentId]);

  /* Selecionar contrato e carregar turmas */
  async function handleSelecionarContrato(contrato: Contrato) {
    setContratoSelecionado(contrato);
    if (contrato.formas_pagamento?.length) setFormaPagamento(contrato.formas_pagamento[0]);
    setLoadingTurmas(true);

    const { data: modsData } = await supabase
      .from("contrato_modalidades")
      .select("modalidade_id, modalidade_nome, nome, sessoes_por_semana")
      .eq("contrato_id", contrato.id)
      .eq("matricula_obrigatoria_na_venda", true);

    const mods: ModalidadeObrigatoriaVenda[] = ((modsData ?? []) as any[])
      .filter(m => !!m.modalidade_id)
      .map(m => ({
        modalidade_id:      m.modalidade_id,
        modalidade_nome:    m.modalidade_nome ?? m.nome ?? "Modalidade",
        sessoes_por_semana: m.sessoes_por_semana ?? 1,
      }));

    setModalidadesObrigatorias(mods);
    setGridesPorModalidade({});

    if (mods.length === 0) {
      setGridsDisponiveis([]);
      setLoadingTurmas(false);
      setStep("conferencia");
      return;
    }

    const modalidadeIds = mods.map(m => m.modalidade_id);
    const { data: gridsData } = await supabase
      .from("schedule_grids")
      .select("id, nome, modalidade_id, hora_inicio, hora_fim, dias_semana, capacidade_maxima, cor")
      .eq("contractor_id", user!.contractorId!)
      .eq("ativo", true)
      .in("modalidade_id", modalidadeIds)
      .order("hora_inicio");

    setGridsDisponiveis((gridsData ?? []) as ScheduleGrid[]);
    setLoadingTurmas(false);
    setStep("configurar-turma");
  }

  function toggleGrid(modalidadeId: string, gridId: string, sessoesPorSemana: number) {
    setGridesPorModalidade(prev => {
      const current = prev[modalidadeId] ?? [];
      if (current.includes(gridId)) {
        return { ...prev, [modalidadeId]: current.filter(id => id !== gridId) };
      }
      if (current.length >= sessoesPorSemana) return prev;
      return { ...prev, [modalidadeId]: [...current, gridId] };
    });
  }

  function handleVoltar() {
    if (step === "selecionar-plano") navigate(`/app/clientes/${studentId}/dashboard`);
    else if (step === "configurar-turma") setStep("selecionar-plano");
    else if (step === "conferencia") setStep(modalidadesObrigatorias.length > 0 ? "configurar-turma" : "selecionar-plano");
  }

  async function handleConfirmarVenda() {
    if (!user?.contractorId || !studentId || !contratoSelecionado || !dataInicio) return;
    setSaving(true);

    try {
      /* 1. Criar student_contract */
      const { data: sc, error: scErr } = await supabase
        .from("student_contracts")
        .insert({
          contractor_id:     user.contractorId!,
          student_id:        studentId,
          contrato_id:       contratoSelecionado.id,
          data_inicio:       dataInicio,
          data_fim:          dataFim,
          status:            "ativo",
          valor_mensalidade: valorMensalidade,
          dia_vencimento:    diaVencimento,
          forma_pagamento:   formaPagamento,
        })
        .select("id")
        .single();

      if (scErr || !sc) { toast.error("Erro ao criar contrato"); return; }

      /* 2. Criar fixed_enrollments para cada grid selecionado */
      const todosGridIds = Object.values(gridesPorModalidade).flat();
      if (todosGridIds.length > 0) {
        const { data: jaAtivos } = await supabase
          .from("fixed_enrollments")
          .select("grid_id")
          .eq("contractor_id", user.contractorId!)
          .eq("student_id", studentId!)
          .eq("ativo", true)
          .in("grid_id", todosGridIds);

        const jaAtivosSet = new Set((jaAtivos ?? []).map((e: { grid_id: string }) => e.grid_id));
        const inserir = todosGridIds
          .filter(id => !jaAtivosSet.has(id))
          .map(id => ({
            contractor_id: user.contractorId!,
            student_id:    studentId!,
            student_nome:  student?.nome_completo ?? null,
            grid_id:       id,
            ativo:         true,
          }));

        if (inserir.length > 0) {
          const { error: enrErr } = await supabase.from("fixed_enrollments").insert(inserir);
          if (enrErr) toast.warning("Contrato criado, mas não foi possível vincular turmas.");
        }
      }

      /* 3. Gerar 1ª receivable com desconto */
      const vencStr = calcVencimento(dataInicio, diaVencimento);
      const vencDate = new Date(vencStr + "T00:00:00");
      const valorDescontoAplicado = desconto > 0 ? valorMensalidade - valorComDesconto : null;

      await supabase.from("receivables").insert({
        contractor_id:   user.contractorId!,
        student_id:      studentId!,
        student_nome:    student?.nome_completo ?? null,
        descricao:       `Mensalidade ${contratoSelecionado.descricao} — ${vencDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
        valor:           valorMensalidade,
        vencimento:      vencStr,
        status:          "pendente",
        tipo:            "mensalidade",
        contrato_id:     contratoSelecionado.id,
        forma_pagamento: formaPagamento,
        desconto:        valorDescontoAplicado,
      });

      /* 4. Atualizar status do aluno para "ativo" */
      if (student?.status !== "ativo") {
        await supabase.from("students")
          .update({ status: "ativo", updated_at: new Date().toISOString() })
          .eq("id", studentId!);
      }

      setResultadoVenda({
        nomeAluno: student?.nome_completo ?? "",
        nomePlano: contratoSelecionado.descricao,
        valorFinal: valorComDesconto,
        vencimento: vencStr,
      });
      setStep("concluido");
    } finally {
      setSaving(false);
    }
  }

  /* ── Loading ────────────────────────────────────────────── */
  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  /* ── Step 4: Concluído ──────────────────────────────────── */
  if (step === "concluido" && resultadoVenda) {
    return (
      <AppLayout>
        <div className="px-8 py-6 max-w-2xl">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Venda realizada!</h2>
            <p className="text-sm text-gray-600">
              <strong>{resultadoVenda.nomeAluno}</strong> foi matriculado(a) no plano{" "}
              <strong>{resultadoVenda.nomePlano}</strong>.
            </p>
            <p className="text-sm text-gray-500">
              1ª mensalidade de{" "}
              <strong className="text-gray-800">{fmtBRL(resultadoVenda.valorFinal)}</strong> gerada
              com vencimento em{" "}
              <strong className="text-gray-800">{fmtDateBR(resultadoVenda.vencimento)}</strong>.
            </p>
            <div className="flex justify-center gap-3 pt-4">
              <button
                onClick={() => navigate("/app/financeiro/contas-a-receber")}
                className="px-5 py-2.5 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                VER FINANCEIRO
              </button>
              <button
                onClick={() => navigate(`/app/clientes/${studentId}/dashboard`)}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
              >
                IR PARA O PERFIL DO ALUNO
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  /* ── Main layout ────────────────────────────────────────── */
  return (
    <AppLayout>
      <div className="px-8 py-6 max-w-2xl space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleVoltar}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nova Venda</h1>
            {student && <p className="text-sm text-gray-500 mt-0.5">{student.nome_completo}</p>}
          </div>
        </div>

        {/* ── STEP 1: Selecionar Plano ─────────────────────── */}
        {step === "selecionar-plano" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-700">Selecione o plano</h3>

            {/* Chips de filtro */}
            <div className="flex flex-wrap gap-2">
              {FILTROS.map(f => (
                <button
                  key={f.label}
                  onClick={() => setFiltro(f)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-full border transition-colors ${
                    filtro.label === f.label
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {contratos.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <ScrollText className="w-10 h-10 text-gray-200 mx-auto" />
                <p className="text-sm text-gray-400">Nenhum plano ativo cadastrado</p>
                <Link
                  to="/app/administrativo/contratos/novo"
                  className="inline-block text-sm text-primary font-semibold hover:underline"
                >
                  Criar plano
                </Link>
              </div>
            ) : contratosFiltrados.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Nenhum plano nessa periodicidade.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {contratosFiltrados.map(c => (
                  <div
                    key={c.id}
                    className="border border-gray-200 rounded-xl p-4 space-y-3 hover:border-primary/40 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-800 leading-snug">{c.descricao}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {fmtDuracao(c.duracao, c.tipo_duracao)}
                      </p>
                    </div>
                    <p className="text-lg font-extrabold text-gray-900">{fmtBRL(c.valor_total)}</p>
                    <button
                      onClick={() => handleSelecionarContrato(c)}
                      disabled={loadingTurmas}
                      className="w-full py-2 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
                    >
                      {loadingTurmas ? "..." : "SELECIONAR"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Configurar Turma ─────────────────────── */}
        {step === "configurar-turma" && contratoSelecionado && (
          <>
            <p className="text-sm text-gray-500">
              {student?.nome_completo} —{" "}
              <span className="font-semibold text-gray-700">{contratoSelecionado.descricao}</span>
            </p>

            {modalidadesObrigatorias.map(mod => {
              const gridsDoMod = gridsDisponiveis.filter(g => g.modalidade_id === mod.modalidade_id);
              const selecionados = gridesPorModalidade[mod.modalidade_id] ?? [];
              const horasUnicas = [...new Set(gridsDoMod.map(g => g.hora_inicio))].sort();

              return (
                <div key={mod.modalidade_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-700">{mod.modalidade_nome}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Selecione {mod.sessoes_por_semana} horário{mod.sessoes_por_semana !== 1 ? "s" : ""} na grade
                    </p>
                  </div>

                  {gridsDoMod.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      Nenhuma grade cadastrada para esta modalidade.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="w-14 py-2 text-right pr-3 text-xs text-gray-400 font-semibold" />
                            {DIAS_ORDER.map(dia => (
                              <th key={dia} className="py-2 text-center text-xs text-gray-500 font-semibold min-w-[40px]">
                                {DIAS_LABEL[dia]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {horasUnicas.map(hora => (
                            <tr key={hora}>
                              <td className="py-1.5 text-right pr-3 text-xs text-gray-500 font-mono">
                                {hora.slice(0, 5)}
                              </td>
                              {DIAS_ORDER.map(dia => {
                                const grid = gridsDoMod.find(
                                  g => g.hora_inicio === hora && g.dias_semana.includes(dia)
                                );
                                if (!grid) {
                                  return (
                                    <td key={dia} className="py-1.5 text-center">
                                      <div className="w-9 h-9 mx-auto rounded-lg bg-gray-100" />
                                    </td>
                                  );
                                }
                                const isSelected = selecionados.includes(grid.id);
                                const atLimit = selecionados.length >= mod.sessoes_por_semana && !isSelected;
                                const cor = grid.cor ?? "#ec4899";

                                return (
                                  <td key={dia} className="py-1.5 text-center">
                                    <button
                                      onClick={() => !atLimit && toggleGrid(mod.modalidade_id, grid.id, mod.sessoes_por_semana)}
                                      disabled={atLimit}
                                      title={`${hora.slice(0, 5)} — ${DIAS_LABEL[dia]}`}
                                      className={`w-9 h-9 mx-auto rounded-lg flex items-center justify-center transition-all ${
                                        atLimit ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:opacity-80"
                                      } ${isSelected ? "ring-2 ring-offset-1 ring-primary scale-110" : ""}`}
                                      style={{ backgroundColor: isSelected ? cor : cor + "55" }}
                                    >
                                      {isSelected && (
                                        <svg className="w-3.5 h-3.5 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <p className="text-xs text-gray-500">
                    Selecionados:{" "}
                    <strong className={selecionados.length >= mod.sessoes_por_semana ? "text-green-600" : "text-gray-800"}>
                      {selecionados.length}
                    </strong>{" "}
                    de <strong>{mod.sessoes_por_semana}</strong>
                  </p>
                </div>
              );
            })}

            <div className="flex justify-end pb-8">
              <button
                onClick={() => setStep("conferencia")}
                disabled={!turmasCompletas}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                CONTINUAR →
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3: Conferência ──────────────────────────── */}
        {step === "conferencia" && contratoSelecionado && (
          <>
            <p className="text-sm font-semibold text-gray-700">{student?.nome_completo}</p>

            {/* Resumo */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2.5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Resumo</h3>
              <Row label="Plano" value={contratoSelecionado.descricao} />
              <Row label="Duração" value={fmtDuracao(contratoSelecionado.duracao, contratoSelecionado.tipo_duracao)} />
              {dataFim && (
                <Row
                  label="Início / Fim"
                  value={`${fmtDateBR(dataInicio)} → ${fmtDateBR(dataFim)}`}
                />
              )}
              {modalidadesObrigatorias.flatMap(mod => {
                const ids = gridesPorModalidade[mod.modalidade_id] ?? [];
                return ids.map(id => {
                  const g = gridsDisponiveis.find(g => g.id === id);
                  if (!g) return null;
                  const dias = g.dias_semana.map(d => DIAS_LABEL[d] ?? d).join(" e ");
                  return (
                    <Row
                      key={id}
                      label="Turma"
                      value={`${mod.modalidade_nome} — ${dias} ${g.hora_inicio.slice(0, 5)}`}
                    />
                  );
                }).filter(Boolean);
              })}
            </div>

            {/* Início e Vencimento */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-700">Início e Vencimento</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Data de início</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={e => setDataInicio(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Dia de vencimento</label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={diaVencimento}
                    onChange={e => {
                      setDiaVencimento(Math.max(1, Math.min(28, Number(e.target.value))));
                      setDiaVencimentoEditado(true);
                    }}
                    className={inputClass}
                  />
                  <p className="text-xs text-gray-400 mt-1">Padrão: dia da matrícula. Altere para definir outro dia fixo de débito. Máx. 28 para funcionar em todos os meses.</p>
                </div>
              </div>
            </div>

            {/* Desconto */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-700">Desconto</h3>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Valor original</span>
                <span className="font-semibold">{fmtBRL(valorMensalidade)}</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 whitespace-nowrap">Desconto</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={desconto}
                  onChange={e => setDesconto(Math.max(0, Math.min(100, Number(e.target.value))))}
                  className={`${inputClass} max-w-[80px] text-center`}
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-3">
                <span className="text-gray-600 font-semibold">Valor final</span>
                <span className="text-lg font-extrabold text-primary">{fmtBRL(valorComDesconto)}</span>
              </div>
            </div>

            {/* Forma de Pagamento */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-700">Forma de pagamento</h3>
              <select
                value={formaPagamento}
                onChange={e => setFormaPagamento(e.target.value)}
                className={inputClass}
              >
                {(contratoSelecionado.formas_pagamento ?? []).map(f => (
                  <option key={f} value={f}>{FORMA_LABEL[f] ?? f}</option>
                ))}
              </select>

              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
                1ª mensalidade de{" "}
                <strong>{fmtBRL(valorComDesconto)}</strong> com vencimento em{" "}
                <strong>
                  {dataInicio ? fmtDateBR(calcVencimento(dataInicio, diaVencimento)) : "—"}
                </strong>.
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pb-8">
              <button
                onClick={handleVoltar}
                className="px-5 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
              >
                VOLTAR
              </button>
              <button
                onClick={handleConfirmarVenda}
                disabled={saving || !dataInicio}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                CONFIRMAR VENDA
              </button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
