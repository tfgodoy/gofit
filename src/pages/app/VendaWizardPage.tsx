import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, CheckCircle2, ScrollText, Trash2, X } from "lucide-react";
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

interface ModalidadeContrato {
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
  capacidade_maxima: number | null;
  cor: string | null;
}

interface EnrollmentSlot {
  grid_id: string;
  grid_nome: string;
  dia: string;
  hora_inicio: string;
  hora_fim: string;
}

type Step = "selecionar-plano" | "matricular" | "conferencia" | "concluido";

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
  segunda: "Segunda-feira", terca: "Terça-feira", quarta: "Quarta-feira",
  quinta:  "Quinta-feira",  sexta: "Sexta-feira",  sabado: "Sábado", domingo: "Domingo",
  seg: "Segunda-feira", ter: "Terça-feira", qua: "Quarta-feira",
  qui: "Quinta-feira",  sex: "Sexta-feira",  sab: "Sábado", dom: "Domingo",
};

const DIAS_ORDER_SHORT = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
const DIAS_ORDER_LONG  = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];

const FILTROS = [
  { label: "Todos",      duracao: null, tipo_duracao: null   },
  { label: "Mensal",     duracao: 1,    tipo_duracao: "meses" },
  { label: "Trimestral", duracao: 3,    tipo_duracao: "meses" },
  { label: "Semestral",  duracao: 6,    tipo_duracao: "meses" },
  { label: "Anual",      duracao: 12,   tipo_duracao: "meses" },
] as const;

const inputClass =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

/* ── Helpers ────────────────────────────────────────────────── */

function normalizeDia(dia: string): string {
  // normalise both "seg" and "segunda" to a canonical short form
  const map: Record<string, string> = {
    segunda: "seg", terca: "ter", quarta: "qua", quinta: "qui",
    sexta: "sex", sabado: "sab", domingo: "dom",
  };
  return map[dia] ?? dia;
}

function diaLabel(dia: string): string {
  return DIAS_LABEL[dia] ?? dia;
}

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-semibold text-gray-800 text-right">{value}</span>
    </div>
  );
}

/* ── Sub-modal: escolher horários de uma modalidade ─────────── */

function MatricularModal({
  modalidade,
  grids,
  selected,
  onSave,
  onClose,
}: {
  modalidade: ModalidadeContrato;
  grids: ScheduleGrid[];
  selected: EnrollmentSlot[];
  onSave: (slots: EnrollmentSlot[]) => void;
  onClose: () => void;
}) {
  const [localSelected, setLocalSelected] = useState<EnrollmentSlot[]>(selected);

  // Expand each grid into individual day slots
  const allSlots: EnrollmentSlot[] = grids.flatMap(g =>
    g.dias_semana.map(dia => ({
      grid_id:    g.id,
      grid_nome:  g.nome,
      dia:        normalizeDia(dia),
      hora_inicio: g.hora_inicio,
      hora_fim:    g.hora_fim,
    }))
  ).sort((a, b) => {
    const orderA = DIAS_ORDER_SHORT.indexOf(a.dia);
    const orderB = DIAS_ORDER_SHORT.indexOf(b.dia);
    if (orderA !== orderB) return orderA - orderB;
    return a.hora_inicio.localeCompare(b.hora_inicio);
  });

  function isSlotSelected(slot: EnrollmentSlot) {
    return localSelected.some(s => s.grid_id === slot.grid_id && s.dia === slot.dia);
  }

  function toggleSlot(slot: EnrollmentSlot) {
    if (isSlotSelected(slot)) {
      setLocalSelected(prev => prev.filter(s => !(s.grid_id === slot.grid_id && s.dia === slot.dia)));
    } else {
      if (localSelected.length >= modalidade.sessoes_por_semana) return;
      setLocalSelected(prev => [...prev, slot]);
    }
  }

  const needed = modalidade.sessoes_por_semana;
  const count  = localSelected.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Adicionar grades de horários</h3>
            <p className="text-xs text-gray-500 mt-0.5">{modalidade.modalidade_nome}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-xs text-gray-600">
            Selecione <strong>{needed}</strong> horário{needed !== 1 ? "s" : ""} por semana •{" "}
            <span className={count >= needed ? "text-green-600 font-semibold" : "text-primary font-semibold"}>
              {count} de {needed} selecionado{count !== 1 ? "s" : ""}
            </span>
          </p>
        </div>

        {/* Slots list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {allSlots.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Nenhuma grade cadastrada para esta modalidade.
            </p>
          ) : allSlots.map((slot, i) => {
            const sel = isSlotSelected(slot);
            const atLimit = count >= needed && !sel;
            return (
              <label key={i}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors cursor-pointer ${
                  sel ? "border-primary bg-primary/5" : atLimit ? "border-gray-100 opacity-40 cursor-not-allowed" : "border-gray-100 hover:border-gray-200"
                }`}>
                <input type="checkbox" className="hidden"
                  checked={sel} disabled={atLimit}
                  onChange={() => !atLimit && toggleSlot(slot)} />
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  sel ? "bg-primary border-primary" : "border-gray-300"
                }`}>
                  {sel && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-700 flex-1" onClick={() => !atLimit && toggleSlot(slot)}>
                  {slot.grid_nome}, {diaLabel(slot.dia).toLowerCase()} das{" "}
                  {slot.hora_inicio.slice(0, 5)} às {slot.hora_fim.slice(0, 5)}
                </span>
              </label>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600">
            FECHAR
          </button>
          <button
            onClick={() => { onSave(localSelected); onClose(); }}
            className="flex-1 py-2.5 text-sm font-semibold bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors">
            SALVAR
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

  const [step, setStep] = useState<Step>("selecionar-plano");
  const [student, setStudent] = useState<Student | null>(null);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);

  // Step 1
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>(FILTROS[0]);
  const [contratoSelecionado, setContratoSelecionado] = useState<Contrato | null>(null);
  const [loadingTurmas, setLoadingTurmas] = useState(false);

  // Step 2 — matrícula
  const [modalidadesContrato, setModalidadesContrato] = useState<ModalidadeContrato[]>([]);
  const [gridsDisponiveis, setGridsDisponiveis] = useState<ScheduleGrid[]>([]);
  // enrollments: modalidade_id → EnrollmentSlot[]
  const [enrollments, setEnrollments] = useState<Record<string, EnrollmentSlot[]>>({});
  // which modalidade sub-modal is open
  const [modalidadeModalAberta, setModalidadeModalAberta] = useState<ModalidadeContrato | null>(null);

  // Step 3
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split("T")[0]);
  const [diaVencimento, setDiaVencimento] = useState(new Date().getDate());
  const [diaVencimentoEditado, setDiaVencimentoEditado] = useState(false);
  const [desconto, setDesconto] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState("pix");

  // Step 4
  const [resultadoVenda, setResultadoVenda] = useState<{
    nomeAluno: string; nomePlano: string; valorFinal: number; vencimento: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);

  /* Derived */
  const valorMensalidade = contratoSelecionado
    ? contratoSelecionado.duracao === 1
      ? contratoSelecionado.valor_total
      : (contratoSelecionado.valor_por_mes ?? contratoSelecionado.valor_total / contratoSelecionado.duracao)
    : 0;
  const valorComDesconto = valorMensalidade * (1 - desconto / 100);
  const dataFim = contratoSelecionado && contratoSelecionado.tipo_duracao === "meses"
    ? addMonths(dataInicio, contratoSelecionado.duracao)
    : null;

  const contratosFiltrados = contratos.filter(c => {
    if (!filtro.duracao) return true;
    return c.duracao === filtro.duracao && c.tipo_duracao === filtro.tipo_duracao;
  });

  // Modalidades que precisam de matrícula (sessoes_semana OU matricula_obrigatoria_na_venda)
  const modalidadesComMatricula = modalidadesContrato.filter(
    m => m.tipo_acesso === "sessoes_semana" || m.matricula_obrigatoria_na_venda
  );

  const totalSlotsNecessarios = modalidadesComMatricula.reduce(
    (acc, m) => acc + m.sessoes_por_semana, 0
  );
  const totalSlotsSelecionados = Object.values(enrollments).reduce(
    (acc, slots) => acc + slots.length, 0
  );

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

  /* Selecionar contrato */
  async function handleSelecionarContrato(contrato: Contrato) {
    setContratoSelecionado(contrato);
    if (contrato.formas_pagamento?.length) setFormaPagamento(contrato.formas_pagamento[0]);
    setLoadingTurmas(true);
    setEnrollments({});

    // Load ALL modalidades of this contract
    const { data: modsData } = await supabase
      .from("contrato_modalidades")
      .select("modalidade_id, modalidade_nome, nome, sessoes_por_semana, tipo_acesso, matricula_obrigatoria_na_venda")
      .eq("contrato_id", contrato.id);

    const mods: ModalidadeContrato[] = ((modsData ?? []) as any[])
      .filter(m => !!m.modalidade_id)
      .map(m => ({
        modalidade_id:               m.modalidade_id,
        modalidade_nome:             m.modalidade_nome ?? m.nome ?? "Modalidade",
        sessoes_por_semana:          m.sessoes_por_semana ?? 1,
        tipo_acesso:                 m.tipo_acesso ?? "padrao",
        matricula_obrigatoria_na_venda: m.matricula_obrigatoria_na_venda ?? false,
      }));

    setModalidadesContrato(mods);

    const modsComMatricula = mods.filter(
      m => m.tipo_acesso === "sessoes_semana" || m.matricula_obrigatoria_na_venda
    );

    if (modsComMatricula.length === 0) {
      setGridsDisponiveis([]);
      setLoadingTurmas(false);
      setStep("conferencia");
      return;
    }

    const modalidadeIds = modsComMatricula.map(m => m.modalidade_id);
    const { data: gridsData } = await supabase
      .from("schedule_grids")
      .select("id, nome, modalidade_id, hora_inicio, hora_fim, dias_semana, capacidade_maxima, cor")
      .eq("contractor_id", user!.contractorId!)
      .eq("ativo", true)
      .in("modalidade_id", modalidadeIds)
      .order("hora_inicio");

    setGridsDisponiveis((gridsData ?? []) as ScheduleGrid[]);
    setLoadingTurmas(false);
    setStep("matricular");
  }

  function handleVoltar() {
    if (step === "selecionar-plano") navigate(`/app/clientes/${studentId}/dashboard`);
    else if (step === "matricular") setStep("selecionar-plano");
    else if (step === "conferencia") {
      if (modalidadesComMatricula.length > 0) setStep("matricular");
      else setStep("selecionar-plano");
    }
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

      /* 2. Criar fixed_enrollments para cada slot selecionado */
      const allSlots = Object.values(enrollments).flat();
      if (allSlots.length > 0) {
        const inserir = allSlots.map(slot => ({
          contractor_id: user.contractorId!,
          student_id:    studentId!,
          student_nome:  student?.nome_completo ?? null,
          grid_id:       slot.grid_id,
          dia_semana:    slot.dia,
          ativo:         true,
        }));
        const { error: enrErr } = await supabase.from("fixed_enrollments").insert(inserir);
        if (enrErr) toast.warning("Contrato criado, mas não foi possível vincular turmas.");
      }

      /* 3. Gerar 1ª receivable */
      const vencStr = calcVencimento(dataInicio, diaVencimento);
      const vencDate = new Date(vencStr + "T00:00:00");
      const valorDescontoReais = desconto > 0 ? Number(valorMensalidade) - Number(valorComDesconto) : 0;

      const { error: recErr } = await supabase.from("receivables").insert({
        contractor_id:   user.contractorId!,
        student_id:      studentId!,
        student_nome:    student?.nome_completo ?? null,
        descricao:       `Mensalidade ${contratoSelecionado.descricao} — ${vencDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
        valor:           Number(valorComDesconto),
        vencimento:      vencStr,
        status:          "pendente",
        tipo:            "mensalidade",
        contrato_id:     contratoSelecionado.id,
        forma_pagamento: formaPagamento,
        desconto:        valorDescontoReais,
      });

      if (recErr) { toast.error("Contrato criado, mas erro ao gerar cobrança: " + recErr.message); return; }

      /* 4. Atualizar status do aluno */
      if (student?.status !== "ativo") {
        await supabase.from("students")
          .update({ status: "ativo", updated_at: new Date().toISOString() })
          .eq("id", studentId!);
      }

      /* 5. Mover opportunity para "Matrícula" */
      await supabase
        .from("opportunities")
        .update({ etapa: "Matrícula" })
        .eq("student_id", studentId!)
        .eq("contractor_id", user.contractorId!)
        .neq("etapa", "Matrícula")
        .neq("etapa", "Perdido");

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
          <button onClick={handleVoltar} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
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

            <div className="flex flex-wrap gap-2">
              {FILTROS.map(f => (
                <button key={f.label} onClick={() => setFiltro(f)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-full border transition-colors ${
                    filtro.label === f.label
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>

            {contratos.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <ScrollText className="w-10 h-10 text-gray-200 mx-auto" />
                <p className="text-sm text-gray-400">Nenhum plano ativo cadastrado</p>
                <Link to="/app/administrativo/contratos/novo"
                  className="inline-block text-sm text-primary font-semibold hover:underline">
                  Criar plano
                </Link>
              </div>
            ) : contratosFiltrados.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhum plano nessa periodicidade.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {contratosFiltrados.map(c => (
                  <div key={c.id}
                    className="border border-gray-200 rounded-xl p-4 space-y-3 hover:border-primary/40 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-gray-800 leading-snug">{c.descricao}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{fmtDuracao(c.duracao, c.tipo_duracao)}</p>
                    </div>
                    <p className="text-lg font-extrabold text-gray-900">{fmtBRL(c.valor_total)}</p>
                    <button onClick={() => handleSelecionarContrato(c)} disabled={loadingTurmas}
                      className="w-full py-2 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors">
                      {loadingTurmas ? "..." : "SELECIONAR"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Matrículas nas grades de horários ────── */}
        {step === "matricular" && contratoSelecionado && (
          <>
            {/* Contract summary card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ScrollText className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm font-bold text-gray-900">{contratoSelecionado.descricao}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Duração</p>
                  <p className="font-semibold text-gray-800">{fmtDuracao(contratoSelecionado.duracao, contratoSelecionado.tipo_duracao)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Taxa de adesão</p>
                  <p className="font-semibold text-gray-800">Grátis</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Valor do contrato</p>
                  <p className="font-semibold text-gray-800">{fmtBRL(contratoSelecionado.valor_total)}</p>
                </div>
              </div>
            </div>

            {/* Enrollment section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-800">Matrículas nas grades de horários</h3>
                <span className="text-xs font-semibold text-gray-500">
                  Horários selecionados:{" "}
                  <span className={totalSlotsSelecionados >= totalSlotsNecessarios ? "text-green-600" : "text-primary"}>
                    {totalSlotsSelecionados} de {totalSlotsNecessarios}
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {modalidadesComMatricula.map(mod => {
                  const slots = enrollments[mod.modalidade_id] ?? [];
                  const gridsDoMod = gridsDisponiveis.filter(g => g.modalidade_id === mod.modalidade_id);
                  return (
                    <div key={mod.modalidade_id}
                      className="border border-gray-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-800">{mod.modalidade_nome}</p>
                        <button
                          onClick={() => setModalidadeModalAberta(mod)}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          MATRICULAR
                        </button>
                      </div>

                      {slots.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Nenhuma matrícula reservada.</p>
                      ) : (
                        <div className="space-y-1">
                          {slots.map((slot, i) => (
                            <div key={i} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5">
                              <span>
                                {slot.grid_nome}, {diaLabel(slot.dia).toLowerCase()} das{" "}
                                {slot.hora_inicio.slice(0, 5)} às {slot.hora_fim.slice(0, 5)}
                              </span>
                              <button
                                onClick={() => setEnrollments(prev => ({
                                  ...prev,
                                  [mod.modalidade_id]: (prev[mod.modalidade_id] ?? []).filter(
                                    (_, ii) => ii !== i
                                  ),
                                }))}
                                className="ml-2 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {gridsDoMod.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          Nenhuma grade criada para esta modalidade.{" "}
                          <Link to="/app/agenda/grades" className="underline">Criar grade</Link>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pb-8">
              <button onClick={handleVoltar}
                className="px-5 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors">
                VOLTAR
              </button>
              <button
                onClick={() => setStep("conferencia")}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
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
                <Row label="Início / Fim" value={`${fmtDateBR(dataInicio)} → ${fmtDateBR(dataFim)}`} />
              )}
              {Object.entries(enrollments).flatMap(([modId, slots]) =>
                slots.map((slot, i) => (
                  <Row key={`${modId}-${i}`}
                    label="Matrícula"
                    value={`${slot.grid_nome}, ${diaLabel(slot.dia).toLowerCase()} ${slot.hora_inicio.slice(0, 5)}`}
                  />
                ))
              )}
            </div>

            {/* Início e Vencimento */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-700">Início e Vencimento</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Data de início</label>
                  <input type="date" value={dataInicio}
                    onChange={e => setDataInicio(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Dia de vencimento</label>
                  <input type="number" min={1} max={28} value={diaVencimento}
                    onChange={e => {
                      setDiaVencimento(Math.max(1, Math.min(28, Number(e.target.value))));
                      setDiaVencimentoEditado(true);
                    }} className={inputClass} />
                  <p className="text-xs text-gray-400 mt-1">Máx. 28 para funcionar em todos os meses.</p>
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
                <input type="number" min={0} max={100} value={desconto}
                  onChange={e => setDesconto(Math.max(0, Math.min(100, Number(e.target.value))))}
                  className={`${inputClass} max-w-[80px] text-center`} />
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
              <select value={formaPagamento}
                onChange={e => setFormaPagamento(e.target.value)} className={inputClass}>
                {(contratoSelecionado.formas_pagamento?.length
                  ? contratoSelecionado.formas_pagamento
                  : ["dinheiro", "pix", "cartao_credito", "cartao_debito", "boleto", "transferencia"]
                ).map(f => (
                  <option key={f} value={f}>{FORMA_LABEL[f] ?? f}</option>
                ))}
              </select>
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
                1ª mensalidade de{" "}
                <strong>{fmtBRL(valorComDesconto)}</strong> com vencimento em{" "}
                <strong>{dataInicio ? fmtDateBR(calcVencimento(dataInicio, diaVencimento)) : "—"}</strong>.
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pb-8">
              <button onClick={handleVoltar}
                className="px-5 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors">
                VOLTAR
              </button>
              <button onClick={handleConfirmarVenda} disabled={saving || !dataInicio}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-colors">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                CONFIRMAR VENDA
              </button>
            </div>
          </>
        )}
      </div>

      {/* Sub-modal de matrícula */}
      {modalidadeModalAberta && (
        <MatricularModal
          modalidade={modalidadeModalAberta}
          grids={gridsDisponiveis.filter(g => g.modalidade_id === modalidadeModalAberta.modalidade_id)}
          selected={enrollments[modalidadeModalAberta.modalidade_id] ?? []}
          onSave={slots => setEnrollments(prev => ({ ...prev, [modalidadeModalAberta.modalidade_id]: slots }))}
          onClose={() => setModalidadeModalAberta(null)}
        />
      )}
    </AppLayout>
  );
}
