import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronDown,
  ArrowUpCircle, ArrowDownCircle, ArrowLeftRight,
  Download, Landmark, Loader2, Search, X,
  TrendingUp, TrendingDown, ArrowRightLeft, CalendarDays,
  Plus, Paperclip, CheckCircle,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/ui/CurrencyInput";

/* ─── Tipos ──────────────────────────────────────────────────── */
interface ContaFinanceira { id: string; descricao: string; tipo: string; banco_nome: string | null; banco_codigo: string | null; }
interface CategoriaDespesa { id: string; nome: string; centro_custo_id: string | null; }
interface CategoriaReceita { id: string; nome: string; centro_receita_id: string | null; }
interface Subcategoria      { id: string; nome: string; categoria_id: string; }
interface CentroCusto       { id: string; descricao: string; }
interface CentroReceita     { id: string; descricao: string; }

type SituacaoTipo = "efetivado" | "pendente" | "cancelado";
type MovTipo      = "entrada" | "saida" | "transferencia";

interface Movimento {
  id: string; tipo: MovTipo; origem: string; descricao: string;
  sub_descricao: string | null; situacao: SituacaoTipo;
  metodo: string | null; valor: number; data: string; data_original: string;
}

/* ─── Helpers ─────────────────────────────────────────────────── */
const fmt   = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDt = (s: string) => s ? new Date(s + "T12:00:00").toLocaleDateString("pt-BR") : "—";
const toISO = (dt: string) => dt ? dt.slice(0, 10) : new Date().toISOString().slice(0, 10);
function parseCurrency(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}
const TODAY = new Date().toISOString().split("T")[0];
const nowTime = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}T${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
};

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const PAGE_SIZES = [10, 20, 50, 100];
const FORMAS_PGTO = ["Dinheiro","PIX","Débito","Crédito","Transferência","Boleto","Cheque","TED/DOC","Outro"];

const SITUACAO_BADGE: Record<SituacaoTipo, { label: string; cls: string }> = {
  efetivado: { label: "Efetivado", cls: "bg-green-100 text-green-700" },
  pendente:  { label: "Pendente",  cls: "bg-yellow-100 text-yellow-700" },
  cancelado: { label: "Cancelado", cls: "bg-gray-100 text-gray-400" },
};

const INPUT_CLS = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white";
const LABEL_CLS = "block text-xs font-semibold text-gray-500 mb-1";
const SEL_CLS   = INPUT_CLS + " appearance-none pr-8";

/* ─── Página ─────────────────────────────────────────────────── */
export default function ExtratoContaPage() {
  const { contaId } = useParams<{ contaId: string }>();
  const navigate    = useNavigate();
  const { user }    = useAuth();

  const now = new Date();

  /* ── Período ── */
  const [modoPeriodo, setModoPeriodo] = useState<"mes"|"personalizado">("mes");
  const [mesAno,      setMesAno]      = useState({ mes: now.getMonth()+1, ano: now.getFullYear() });
  const [dataInicio,  setDataInicio]  = useState(() => new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10));
  const [dataFim,     setDataFim]     = useState(() => new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10));

  /* ── Dados ── */
  const [conta,      setConta]      = useState<ContaFinanceira|null>(null);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [loading,    setLoading]    = useState(true);

  /* ── Listas para modais ── */
  const [catDesp,    setCatDesp]    = useState<CategoriaDespesa[]>([]);
  const [catRec,     setCatRec]     = useState<CategoriaReceita[]>([]);
  const [subcats,    setSubcats]    = useState<Subcategoria[]>([]);
  const [centrosCusto,   setCentrosCusto]   = useState<CentroCusto[]>([]);
  const [centrosReceita, setCentrosReceita] = useState<CentroReceita[]>([]);
  const [contas,     setContas]     = useState<ContaFinanceira[]>([]);

  /* ── Filtros / paginação ── */
  const [filtroTipo, setFiltroTipo] = useState<"todos"|"entrada"|"saida"|"transferencia">("todos");
  const [busca,      setBusca]      = useState("");
  const [pageSize,   setPageSize]   = useState(10);
  const [page,       setPage]       = useState(1);
  const [mesOpen,    setMesOpen]    = useState(false);
  const mesRef = useRef<HTMLDivElement>(null);

  /* ── Modais ── */
  const [modalSaida,       setModalSaida]       = useState(false);
  const [modalEntrada,     setModalEntrada]      = useState(false);
  const [modalTransf,      setModalTransf]       = useState(false);
  const [saving,           setSaving]            = useState(false);

  /* ── Form Saída (despesa direta já paga) ── */
  const SAIDA_EMPTY = {
    descricao: "", fornecedor: "", valor: "",
    data_pagamento: TODAY, hora_pagamento: new Date().toTimeString().slice(0,5),
    data_competencia: TODAY,
    forma_pagamento: "", categoria_id: "", subcategoria_id: "",
    centro_custo_id: "", observacoes: "",
  };
  const [saidaForm, setSaidaForm] = useState(SAIDA_EMPTY);
  const setSaida = <K extends keyof typeof SAIDA_EMPTY>(k: K, v: typeof SAIDA_EMPTY[K]) =>
    setSaidaForm(f => ({ ...f, [k]: v }));
  function handleSaidaCategoria(catId: string) {
    setSaida("categoria_id", catId);
    setSaida("subcategoria_id", "");
    const cat = catDesp.find(c => c.id === catId);
    if (cat?.centro_custo_id) setSaida("centro_custo_id", cat.centro_custo_id);
  }
  const subsCusto = subcats.filter(s => s.categoria_id === saidaForm.categoria_id);

  /* ── Form Entrada (receita direta) ── */
  const ENTRADA_EMPTY = {
    descricao: "", pagador: "", valor: "",
    data_entrada: TODAY, hora_entrada: new Date().toTimeString().slice(0,5),
    data_competencia: TODAY,
    forma_recebimento: "", categoria_id: "", subcategoria_id: "",
    centro_receita_id: "", observacoes: "",
  };
  const [entradaForm, setEntradaForm] = useState(ENTRADA_EMPTY);
  const setEntrada = <K extends keyof typeof ENTRADA_EMPTY>(k: K, v: typeof ENTRADA_EMPTY[K]) =>
    setEntradaForm(f => ({ ...f, [k]: v }));
  function handleEntradaCategoria(catId: string) {
    setEntrada("categoria_id", catId);
    setEntrada("subcategoria_id", "");
    const cat = catRec.find(c => c.id === catId);
    if (cat?.centro_receita_id) setEntrada("centro_receita_id", cat.centro_receita_id);
  }
  const subsReceita = subcats.filter(s => s.categoria_id === entradaForm.categoria_id);

  /* ── Form Transferência ── */
  const TRANSF_EMPTY = { conta_destino_id: "", valor: "", data: TODAY, descricao: "Transferência entre contas", observacoes: "" };
  const [transfForm, setTransfForm] = useState(TRANSF_EMPTY);
  const setTransf = <K extends keyof typeof TRANSF_EMPTY>(k: K, v: typeof TRANSF_EMPTY[K]) =>
    setTransfForm(f => ({ ...f, [k]: v }));

  /* ── Fechar dropdown mês ao clicar fora ── */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (mesRef.current && !mesRef.current.contains(e.target as Node)) setMesOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* ── Carregar conta ── */
  useEffect(() => {
    if (!contaId) return;
    supabase.from("contas_financeiras").select("id,descricao,tipo,banco_nome,banco_codigo")
      .eq("id", contaId).maybeSingle()
      .then(({ data }) => setConta(data as ContaFinanceira|null));
  }, [contaId]);

  /* ── Carregar listas para modais ── */
  useEffect(() => {
    if (!user?.contractorId) return;
    const cid = user.contractorId;
    Promise.all([
      supabase.from("categorias_financeiras").select("id,nome,tipo,centro_custo_id,centro_receita_id").eq("contractor_id", cid),
      supabase.from("subcategorias_financeiras").select("id,nome,categoria_id").eq("contractor_id", cid),
      supabase.from("centros_custo").select("id,descricao").eq("contractor_id", cid).order("descricao"),
      supabase.from("centros_receita").select("id,descricao").eq("contractor_id", cid).order("descricao"),
      supabase.from("contas_financeiras").select("id,descricao,tipo,banco_nome,banco_codigo").eq("contractor_id", cid).eq("ativo", true).order("descricao"),
    ]).then(([cats, subs, cc, cr, cf]) => {
      const allCats = (cats.data ?? []) as any[];
      setCatDesp(allCats.filter(c => c.tipo === "despesa" || c.tipo === "Despesa").map(c => ({ id: c.id, nome: c.nome, centro_custo_id: c.centro_custo_id })));
      setCatRec (allCats.filter(c => c.tipo === "receita" || c.tipo === "Receita").map(c => ({ id: c.id, nome: c.nome, centro_receita_id: c.centro_receita_id })));
      setSubcats(       (subs.data ?? []) as Subcategoria[]);
      setCentrosCusto(  (cc.data   ?? []) as CentroCusto[]);
      setCentrosReceita((cr.data   ?? []) as CentroReceita[]);
      setContas(        (cf.data   ?? []) as ContaFinanceira[]);
    });
  }, [user]);

  /* ── Carregar movimentos ── */
  useEffect(() => {
    if (!contaId || !user?.contractorId) return;
    loadMovimentos();
  }, [contaId, mesAno, modoPeriodo, dataInicio, dataFim, user]);

  async function loadMovimentos() {
    if (!contaId || !user?.contractorId) return;
    setLoading(true);

    let inicio: string, fim: string;
    if (modoPeriodo === "mes") {
      inicio = `${mesAno.ano}-${String(mesAno.mes).padStart(2,"0")}-01`;
      fim    = `${mesAno.ano}-${String(mesAno.mes).padStart(2,"0")}-${new Date(mesAno.ano, mesAno.mes, 0).getDate()}`;
    } else {
      inicio = dataInicio;
      fim    = dataFim;
    }

    const inPeriodo = (d: string) => d && d >= inicio && d <= fim;

    const [{ data: recData }, { data: payData }, { data: trfData }] = await Promise.all([
      supabase.from("receivables")
        .select("id,descricao,valor,vencimento,pago_em,status,forma_pagamento,pagador,modo")
        .eq("contractor_id", user!.contractorId)
        .eq("conta_financeira_id", contaId)
        .gte("vencimento", inicio).lte("vencimento", fim + "Z"),
      supabase.from("payables")
        .select("id,descricao,valor,valor_pago,vencimento,pago_em,status,forma_pagamento,fornecedor,tipo")
        .eq("contractor_id", user!.contractorId)
        .eq("conta_financeira_id", contaId)
        .gte("vencimento", inicio).lte("vencimento", fim + "Z"),
      supabase.from("transferencias")
        .select("id,descricao,valor,data,conta_origem_id,conta_destino_id")
        .eq("contractor_id", user!.contractorId)
        .or(`conta_origem_id.eq.${contaId},conta_destino_id.eq.${contaId}`)
        .gte("data", inicio).lte("data", fim),
    ]);

    const entradas: Movimento[] = (recData ?? []).map((r: any) => ({
      id: r.id, tipo: "entrada" as MovTipo,
      origem: r.modo === "entrada_manual" ? "Entrada manual" : "Contas a receber",
      descricao:     r.descricao ?? "Recebimento",
      sub_descricao: r.pagador ?? null,
      situacao:      r.status === "pago" ? "efetivado" : r.status === "cancelado" ? "cancelado" : "pendente",
      metodo:        r.forma_pagamento ?? null,
      valor:         r.valor ?? 0,
      data:          r.pago_em ? r.pago_em.slice(0,10) : r.vencimento,
      data_original: r.vencimento,
    })).filter(m => inPeriodo(m.data));

    const saidas: Movimento[] = (payData ?? []).map((p: any) => ({
      id: p.id, tipo: "saida" as MovTipo,
      origem: p.tipo === "despesa_paga" ? "Saída direta" : "Contas a pagar",
      descricao:     p.descricao ?? "Pagamento",
      sub_descricao: p.fornecedor ?? null,
      situacao:      p.status === "pago" ? "efetivado" : p.status === "cancelado" ? "cancelado" : "pendente",
      metodo:        p.forma_pagamento ?? null,
      valor:         p.valor_pago ?? p.valor ?? 0,
      data:          p.pago_em ? p.pago_em.slice(0,10) : p.vencimento,
      data_original: p.vencimento,
    })).filter(m => inPeriodo(m.data));

    const transfs: Movimento[] = (trfData ?? []).map((t: any) => ({
      id: t.id, tipo: "transferencia" as MovTipo,
      origem: "Transferência",
      descricao: t.descricao ?? "Transferência entre contas",
      sub_descricao: t.conta_origem_id === contaId ? "Saída desta conta" : "Entrada nesta conta",
      situacao: "efetivado" as SituacaoTipo,
      metodo: "Transferência",
      valor: t.valor ?? 0,
      data: t.data,
      data_original: t.data,
    }));

    const all = [...entradas, ...saidas, ...transfs].sort((a, b) => {
      const da = new Date(a.data).getTime(), db = new Date(b.data).getTime();
      if (da !== db) return da - db;
      return a.tipo === "saida" ? -1 : 1;
    });

    setMovimentos(all);
    setLoading(false);
    setPage(1);
  }

  /* ─── Salvar Saída ────────────────────────────── */
  async function handleSalvarSaida() {
    if (!saidaForm.descricao.trim()) { toast.error("Informe a descrição"); return; }
    const valor = parseCurrency(saidaForm.valor);
    if (valor <= 0) { toast.error("Informe o valor"); return; }
    if (!saidaForm.forma_pagamento) { toast.error("Informe a forma de pagamento"); return; }
    if (!user?.contractorId) return;
    setSaving(true);
    const { error } = await supabase.from("payables").insert({
      contractor_id:       user.contractorId,
      conta_financeira_id: contaId,
      tipo:                "despesa_paga",
      descricao:           saidaForm.descricao.trim(),
      fornecedor:          saidaForm.fornecedor.trim() || null,
      categoria:           catDesp.find(c => c.id === saidaForm.categoria_id)?.nome ?? "Outros",
      categoria_id:        saidaForm.categoria_id    || null,
      subcategoria_id:     saidaForm.subcategoria_id  || null,
      centro_custo_id:     saidaForm.centro_custo_id  || null,
      valor,
      valor_pago:          valor,
      vencimento:          saidaForm.data_pagamento,
      pago_em:             saidaForm.data_pagamento,
      hora_pagamento:      saidaForm.hora_pagamento   || null,
      data_competencia:    saidaForm.data_competencia  || null,
      forma_pagamento:     saidaForm.forma_pagamento,
      observacoes:         saidaForm.observacoes.trim() || null,
      status:              "pago",
    });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar saída: " + error.message); return; }
    toast.success("Saída registrada!");
    setModalSaida(false);
    setSaidaForm(SAIDA_EMPTY);
    loadMovimentos();
  }

  /* ─── Salvar Entrada ──────────────────────────── */
  async function handleSalvarEntrada() {
    if (!entradaForm.descricao.trim()) { toast.error("Informe a descrição"); return; }
    const valor = parseCurrency(entradaForm.valor);
    if (valor <= 0) { toast.error("Informe o valor"); return; }
    if (!user?.contractorId) return;
    setSaving(true);
    const { error } = await supabase.from("receivables").insert({
      contractor_id:       user.contractorId,
      conta_financeira_id: contaId,
      modo:                "entrada_manual",
      descricao:           entradaForm.descricao.trim(),
      pagador:             entradaForm.pagador.trim() || null,
      categoria_id:        entradaForm.categoria_id    || null,
      subcategoria_id:     entradaForm.subcategoria_id  || null,
      centro_receita_id:   entradaForm.centro_receita_id || null,
      valor,
      valor_pago:          valor,
      vencimento:          entradaForm.data_entrada,
      pago_em:             entradaForm.data_entrada + "T" + entradaForm.hora_entrada + ":00",
      hora_recebimento:    entradaForm.hora_entrada   || null,
      data_competencia:    entradaForm.data_competencia || null,
      forma_pagamento:     entradaForm.forma_recebimento || null,
      observacoes:         entradaForm.observacoes.trim() || null,
      status:              "pago",
      tipo:                "avulso",
      desconto:            0,
      juros:               0,
      multa:               0,
    });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar entrada: " + error.message); return; }
    toast.success("Entrada registrada!");
    setModalEntrada(false);
    setEntradaForm(ENTRADA_EMPTY);
    loadMovimentos();
  }

  /* ─── Salvar Transferência ────────────────────── */
  async function handleSalvarTransf() {
    if (!transfForm.conta_destino_id) { toast.error("Selecione a conta de destino"); return; }
    if (transfForm.conta_destino_id === contaId) { toast.error("Origem e destino não podem ser a mesma conta"); return; }
    const valor = parseCurrency(transfForm.valor);
    if (valor <= 0) { toast.error("Informe o valor"); return; }
    if (!transfForm.data) { toast.error("Informe a data"); return; }
    if (!user?.contractorId) return;
    setSaving(true);
    const { error } = await supabase.from("transferencias").insert({
      contractor_id:   user.contractorId,
      conta_origem_id: contaId,
      conta_destino_id: transfForm.conta_destino_id,
      valor,
      data:            transfForm.data,
      descricao:       transfForm.descricao.trim() || "Transferência entre contas",
      observacoes:     transfForm.observacoes.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar transferência: " + error.message); return; }
    toast.success("Transferência registrada!");
    setModalTransf(false);
    setTransfForm(TRANSF_EMPTY);
    loadMovimentos();
  }

  /* ── KPIs ── */
  const efetivados    = movimentos.filter(m => m.situacao === "efetivado");
  const totalEntradas = efetivados.filter(m => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
  const totalSaidas   = efetivados.filter(m => m.tipo === "saida").reduce((s, m) => s + m.valor, 0);
  const totalPendentes= movimentos.filter(m => m.situacao === "pendente").reduce((s, m) => s + m.valor, 0);
  const saldo         = totalEntradas - totalSaidas;

  /* ── Filtros ── */
  const filtrado = movimentos.filter(m => {
    if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
    if (busca) {
      const q = busca.toLowerCase();
      return m.descricao.toLowerCase().includes(q) ||
             (m.sub_descricao ?? "").toLowerCase().includes(q) ||
             m.origem.toLowerCase().includes(q);
    }
    return true;
  });

  /* ── Saldo acumulado ── */
  const comSaldo = (() => {
    let acum = 0;
    return filtrado.map(m => {
      if (m.situacao === "efetivado") {
        if (m.tipo === "entrada") acum += m.valor;
        else if (m.tipo === "saida") acum -= m.valor;
        // transferências não alteram saldo líquido mostrado aqui
      }
      return { ...m, saldoAcum: acum };
    });
  })();

  /* ── Paginação ── */
  const totalPages = Math.max(1, Math.ceil(comSaldo.length / pageSize));
  const paginado   = comSaldo.slice((page-1)*pageSize, page*pageSize);
  const totalReg   = comSaldo.length;

  const periodoLabel = modoPeriodo === "mes"
    ? `${MESES[mesAno.mes-1]} ${mesAno.ano}`
    : `${fmtDt(dataInicio)} a ${fmtDt(dataFim)}`;

  function exportarCsv() {
    const header = "Data,Origem,Descrição,Sub,Tipo,Situação,Método,Valor,Saldo\n";
    const rows = comSaldo.map(m =>
      `${fmtDt(m.data)},"${m.origem}","${m.descricao}","${m.sub_descricao??""}", ${m.tipo},${m.situacao},"${m.metodo??""}", ${m.tipo==="entrada"?m.valor:m.tipo==="saida"?-m.valor:0},${m.saldoAcum}`
    ).join("\n");
    const blob = new Blob([header+rows], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href=url;
    a.download=`extrato-${conta?.descricao??contaId}-${periodoLabel.replace(/\s/g,"-")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function prevMes() { setMesAno(p => p.mes===1 ? {mes:12,ano:p.ano-1} : {mes:p.mes-1,ano:p.ano}); }
  function nextMes() { setMesAno(p => p.mes===12 ? {mes:1,ano:p.ano+1} : {mes:p.mes+1,ano:p.ano}); }
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({length:6},(_,i)=>anoAtual-3+i);

  /* ═══════════════════════════════════════ RENDER ════════════════════════════════ */
  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-gray-50">

        {/* ── Header ── */}
        <div className="bg-white border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3 flex-wrap">

            {/* Voltar + título */}
            <button onClick={() => navigate("/app/financeiro/contas-financeiras")}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Landmark className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Extrato de</p>
                <p className="text-base font-bold text-gray-900 leading-tight">
                  {conta ? conta.descricao : "Carregando..."}
                  {conta?.banco_nome && <span className="text-sm font-normal text-gray-400 ml-2">{conta.banco_nome}</span>}
                </p>
              </div>
            </div>

            {/* Toggle período */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 ml-6">
              {(["mes","personalizado"] as const).map(m => (
                <button key={m} onClick={() => setModoPeriodo(m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${modoPeriodo===m?"bg-white text-gray-800 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
                  {m==="mes" && <CalendarDays className="w-3.5 h-3.5" />}
                  {m==="mes" ? "Competência" : "Personalizado"}
                </button>
              ))}
            </div>

            {/* Seletor mês/ano */}
            {modoPeriodo === "mes" && (
              <>
                <button onClick={prevMes} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <div ref={mesRef} className="relative">
                  <button onClick={() => setMesOpen(v=>!v)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 hover:border-primary text-sm font-bold text-gray-800 transition-colors min-w-[160px] justify-between">
                    <span>{MESES[mesAno.mes-1]} {mesAno.ano}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                  {mesOpen && (
                    <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 w-72">
                      <div className="flex justify-between items-center mb-3">
                        {anos.map(a => (
                          <button key={a} onClick={() => setMesAno(p=>({...p,ano:a}))}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${mesAno.ano===a?"bg-primary text-white":"text-gray-500 hover:bg-gray-100"}`}>{a}</button>
                        ))}
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {MESES.map((m,i) => (
                          <button key={m} onClick={() => { setMesAno(p=>({...p,mes:i+1})); setMesOpen(false); }}
                            className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${mesAno.mes===i+1?"bg-primary text-white":"text-gray-600 hover:bg-gray-100"}`}>
                            {m.slice(0,3)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={nextMes} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </>
            )}

            {/* Range personalizado */}
            {modoPeriodo === "personalizado" && (
              <div className="flex items-center gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-0.5">Data inicial</label>
                  <input type="date" value={dataInicio} max={dataFim}
                    onChange={e => setDataInicio(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <span className="text-gray-400 mt-4">→</span>
                <div>
                  <label className="text-xs text-gray-400 block mb-0.5">Data final</label>
                  <input type="date" value={dataFim} min={dataInicio}
                    onChange={e => setDataFim(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
            )}

            {/* Busca + ações */}
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Buscar..." value={busca}
                  onChange={e => { setBusca(e.target.value); setPage(1); }}
                  className="pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-52" />
                {busca && <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>}
              </div>

              <button onClick={() => { setEntradaForm(ENTRADA_EMPTY); setModalEntrada(true); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold transition-colors shadow-sm">
                <TrendingUp className="w-4 h-4" /> Entrada
              </button>
              <button onClick={() => { setSaidaForm(SAIDA_EMPTY); setModalSaida(true); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors shadow-sm">
                <TrendingDown className="w-4 h-4" /> Saída
              </button>
              <button onClick={() => { setTransfForm(TRANSF_EMPTY); setModalTransf(true); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold transition-colors shadow-sm">
                <ArrowRightLeft className="w-4 h-4" /> Transferência
              </button>

              <button onClick={exportarCsv} title="Exportar CSV"
                className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:text-primary hover:border-primary transition-colors">
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Conteúdo ── */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-5">

          {/* Filtros de tipo */}
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { key:"todos",         label:"TODOS",          icon:ArrowLeftRight, color:"bg-gray-700"  },
              { key:"entrada",       label:"ENTRADA",        icon:ArrowUpCircle,  color:"bg-green-500" },
              { key:"saida",         label:"SAÍDA",          icon:ArrowDownCircle,color:"bg-red-500"   },
              { key:"transferencia", label:"TRANSFERÊNCIA",  icon:ArrowRightLeft, color:"bg-blue-500"  },
            ].map(({ key, label, icon: Icon, color }) => (
              <button key={key}
                onClick={() => { setFiltroTipo(key as any); setPage(1); }}
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold text-white transition-all shadow-sm ${filtroTipo===key ? color+" shadow-md scale-105" : "bg-gray-200 text-gray-500 hover:"+color+" hover:text-white"}`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label:"Entradas",  value:totalEntradas,  color:"text-green-600",  border:"border-green-200"  },
              { label:"Pendentes", value:totalPendentes, color:"text-yellow-600", border:"border-yellow-200" },
              { label:"Saídas",    value:totalSaidas,    color:"text-red-500",    border:"border-red-200"    },
              { label:"Saldo",     value:saldo,          color:saldo>=0?"text-gray-900":"text-red-600", border:"border-gray-200" },
            ].map(({ label, value, color, border }) => (
              <div key={label} className={`bg-white rounded-xl border ${border} px-5 py-4 text-center`}>
                <p className="text-xs text-gray-400 font-medium mb-1">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{fmt(value)}</p>
              </div>
            ))}
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
            ) : paginado.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                  <Landmark className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400 font-medium">
                  {movimentos.length===0 ? "Nenhuma movimentação neste período." : "Nenhum resultado para o filtro."}
                </p>
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 font-bold uppercase tracking-wide">
                      <th className="text-left px-5 py-3">Data</th>
                      <th className="text-left px-4 py-3">Origem</th>
                      <th className="text-center px-4 py-3">Situação</th>
                      <th className="text-left px-4 py-3">Método</th>
                      <th className="text-right px-4 py-3">Valor</th>
                      <th className="text-right px-5 py-3">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginado.map(m => {
                      const badge = SITUACAO_BADGE[m.situacao];
                      const isEnt  = m.tipo === "entrada";
                      const isTrf  = m.tipo === "transferencia";
                      return (
                        <tr key={m.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isEnt?"bg-green-100":isTrf?"bg-blue-100":"bg-red-100"}`}>
                                {isEnt  ? <ArrowUpCircle  className="w-3.5 h-3.5 text-green-600" />
                                 :isTrf ? <ArrowRightLeft  className="w-3.5 h-3.5 text-blue-500" />
                                        : <ArrowDownCircle className="w-3.5 h-3.5 text-red-500" />}
                              </div>
                              <span className="text-xs text-gray-600 font-medium">{fmtDt(m.data)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 max-w-[280px]">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-tight">{m.origem}</p>
                            <p className="text-sm font-semibold text-gray-800 truncate">{m.descricao}</p>
                            {m.sub_descricao && <p className="text-xs text-gray-400 truncate">{m.sub_descricao}</p>}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${badge.cls}`}>{badge.label}</span>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-500">{m.metodo ?? "—"}</td>
                          <td className={`px-4 py-3.5 text-right font-bold text-sm ${isEnt?"text-green-600":isTrf?"text-blue-500":"text-red-500"}`}>
                            {isEnt?"+":isTrf?"⇄":"-"}{fmt(m.valor)}
                          </td>
                          <td className={`px-5 py-3.5 text-right font-bold text-sm ${m.saldoAcum>=0?"text-gray-800":"text-red-600"}`}>
                            {m.situacao==="efetivado" && !isTrf ? fmt(m.saldoAcum) : <span className="text-gray-300 font-normal">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Paginação */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">Exibir</span>
                    <div className="relative">
                      <select value={pageSize} onChange={e=>{setPageSize(parseInt(e.target.value));setPage(1);}}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 pr-6 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        {PAGE_SIZES.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    </div>
                    <span className="text-xs">{(page-1)*pageSize+1}–{Math.min(page*pageSize,totalReg)} de {totalReg}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">Página</span>
                    <div className="relative">
                      <select value={page} onChange={e=>setPage(parseInt(e.target.value))}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 pr-6 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        {Array.from({length:totalPages},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}
                      </select>
                      <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
                      <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-6 text-xs text-gray-400 pb-2 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Entrada — receita ou valor recebido nesta conta</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Saída — despesa ou pagamento debitado desta conta</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>Transferência — movimentação interna entre contas</span>
          </div>
        </div>
      </div>

      {/* ════════════════════ MODAL SAÍDA ════════════════════ */}
      {modalSaida && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center"><TrendingDown className="w-4 h-4 text-red-500" /></div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Nova saída</h2>
                  <p className="text-xs text-gray-400">Despesa direta já paga — registrada no extrato de <strong>{conta?.descricao}</strong></p>
                </div>
              </div>
              <button onClick={() => setModalSaida(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {/* Descrição */}
              <div>
                <label className={LABEL_CLS}>Descrição *</label>
                <input type="text" placeholder="Ex: Compra de material de limpeza, Lanche equipe…"
                  value={saidaForm.descricao} onChange={e=>setSaida("descricao",e.target.value)} className={INPUT_CLS} />
              </div>

              {/* Fornecedor + Valor */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>Fornecedor / Favorecido</label>
                  <input type="text" placeholder="Nome ou deixe em branco"
                    value={saidaForm.fornecedor} onChange={e=>setSaida("fornecedor",e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Valor (R$) *</label>
                  <CurrencyInput value={saidaForm.valor} onChange={v=>setSaida("valor",v)} placeholder="0,00" className={INPUT_CLS} />
                </div>
              </div>

              {/* Datas + hora */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={LABEL_CLS}>Data do pagamento *</label>
                  <input type="date" value={saidaForm.data_pagamento} onChange={e=>setSaida("data_pagamento",e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Horário <span className="text-gray-400 font-normal">(conciliação)</span></label>
                  <input type="time" value={saidaForm.hora_pagamento} onChange={e=>setSaida("hora_pagamento",e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Competência</label>
                  <input type="date" value={saidaForm.data_competencia} onChange={e=>setSaida("data_competencia",e.target.value)} className={INPUT_CLS} />
                </div>
              </div>

              {/* Forma + Conta (bloqueada) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>Forma de pagamento *</label>
                  <div className="relative">
                    <select value={saidaForm.forma_pagamento} onChange={e=>setSaida("forma_pagamento",e.target.value)} className={SEL_CLS}>
                      <option value="">Selecionar…</option>
                      {FORMAS_PGTO.map(f=><option key={f}>{f}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>Conta / Caixa</label>
                  <div className={INPUT_CLS + " bg-gray-50 text-gray-500 cursor-not-allowed flex items-center gap-2"}>
                    <Landmark className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{conta?.descricao ?? "Esta conta"}</span>
                    <span className="ml-auto text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">Atual</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-px bg-gray-100"/><span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Classificação</span><div className="flex-1 h-px bg-gray-100"/>
              </div>

              {/* Categoria + Centro de custo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>Categoria de despesa</label>
                  <div className="relative">
                    <select value={saidaForm.categoria_id} onChange={e=>handleSaidaCategoria(e.target.value)} className={SEL_CLS}>
                      <option value="">Selecionar…</option>
                      {catDesp.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>Centro de custo
                    {saidaForm.categoria_id && saidaForm.centro_custo_id && <span className="ml-1 text-primary text-xs font-normal">(auto)</span>}
                  </label>
                  <div className="relative">
                    <select value={saidaForm.centro_custo_id} onChange={e=>setSaida("centro_custo_id",e.target.value)} className={SEL_CLS}>
                      <option value="">Selecionar…</option>
                      {centrosCusto.map(c=><option key={c.id} value={c.id}>{c.descricao}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Subcategoria */}
              <div>
                <label className={LABEL_CLS}>Subcategoria</label>
                <div className="relative">
                  <select value={saidaForm.subcategoria_id} onChange={e=>setSaida("subcategoria_id",e.target.value)}
                    disabled={subsCusto.length===0} className={SEL_CLS+" disabled:opacity-50 disabled:cursor-not-allowed"}>
                    <option value="">{saidaForm.categoria_id?(subsCusto.length===0?"Sem subcategorias":"Selecionar…"):"Selecione uma categoria primeiro"}</option>
                    {subsCusto.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className={LABEL_CLS}>Observações</label>
                <textarea rows={2} placeholder="Notas adicionais…" value={saidaForm.observacoes}
                  onChange={e=>setSaida("observacoes",e.target.value)} className={INPUT_CLS+" resize-none"} />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setModalSaida(false)} className="text-sm font-semibold text-gray-500 hover:text-gray-800 px-4 py-2">Cancelar</button>
              <button onClick={handleSalvarSaida} disabled={saving}
                className="bg-red-500 hover:bg-red-600 text-white text-sm font-bold px-6 py-2 rounded-lg disabled:opacity-60 flex items-center gap-2 transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4" />}
                {saving ? "Salvando…" : "Registrar saída"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ MODAL ENTRADA ════════════════════ */}
      {modalEntrada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-green-600" /></div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Nova entrada</h2>
                  <p className="text-xs text-gray-400">Receita direta recebida em <strong>{conta?.descricao}</strong></p>
                </div>
              </div>
              <button onClick={() => setModalEntrada(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {/* Descrição */}
              <div>
                <label className={LABEL_CLS}>Descrição *</label>
                <input type="text" placeholder="Ex: Repasse TotalPass, Reembolso recebido…"
                  value={entradaForm.descricao} onChange={e=>setEntrada("descricao",e.target.value)} className={INPUT_CLS} />
              </div>

              {/* Pagador + Valor */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>Cliente / Pagador</label>
                  <input type="text" placeholder="Quem efetuou o pagamento (opcional)"
                    value={entradaForm.pagador} onChange={e=>setEntrada("pagador",e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Valor (R$) *</label>
                  <CurrencyInput value={entradaForm.valor} onChange={v=>setEntrada("valor",v)} placeholder="0,00" className={INPUT_CLS} />
                </div>
              </div>

              {/* Datas + hora */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={LABEL_CLS}>Data de entrada *</label>
                  <input type="date" value={entradaForm.data_entrada} onChange={e=>setEntrada("data_entrada",e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Horário <span className="text-gray-400 font-normal">(conciliação)</span></label>
                  <input type="time" value={entradaForm.hora_entrada} onChange={e=>setEntrada("hora_entrada",e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Competência</label>
                  <input type="date" value={entradaForm.data_competencia} onChange={e=>setEntrada("data_competencia",e.target.value)} className={INPUT_CLS} />
                </div>
              </div>

              {/* Forma + Conta bloqueada */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>Forma de recebimento</label>
                  <div className="relative">
                    <select value={entradaForm.forma_recebimento} onChange={e=>setEntrada("forma_recebimento",e.target.value)} className={SEL_CLS}>
                      <option value="">Selecionar…</option>
                      {FORMAS_PGTO.map(f=><option key={f}>{f}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>Conta / Caixa</label>
                  <div className={INPUT_CLS+" bg-gray-50 text-gray-500 cursor-not-allowed flex items-center gap-2"}>
                    <Landmark className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{conta?.descricao ?? "Esta conta"}</span>
                    <span className="ml-auto text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">Atual</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-px bg-gray-100"/><span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Classificação</span><div className="flex-1 h-px bg-gray-100"/>
              </div>

              {/* Categoria receita + Centro de receita */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>Categoria de receita</label>
                  <div className="relative">
                    <select value={entradaForm.categoria_id} onChange={e=>handleEntradaCategoria(e.target.value)} className={SEL_CLS}>
                      <option value="">Selecionar…</option>
                      {catRec.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>Centro de receita
                    {entradaForm.categoria_id && entradaForm.centro_receita_id && <span className="ml-1 text-primary text-xs font-normal">(auto)</span>}
                  </label>
                  <div className="relative">
                    <select value={entradaForm.centro_receita_id} onChange={e=>setEntrada("centro_receita_id",e.target.value)} className={SEL_CLS}>
                      <option value="">Selecionar…</option>
                      {centrosReceita.map(c=><option key={c.id} value={c.id}>{c.descricao}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Subcategoria */}
              <div>
                <label className={LABEL_CLS}>Subcategoria</label>
                <div className="relative">
                  <select value={entradaForm.subcategoria_id} onChange={e=>setEntrada("subcategoria_id",e.target.value)}
                    disabled={subsReceita.length===0} className={SEL_CLS+" disabled:opacity-50 disabled:cursor-not-allowed"}>
                    <option value="">{entradaForm.categoria_id?(subsReceita.length===0?"Sem subcategorias":"Selecionar…"):"Selecione uma categoria primeiro"}</option>
                    {subsReceita.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Observações</label>
                <textarea rows={2} placeholder="Notas adicionais…" value={entradaForm.observacoes}
                  onChange={e=>setEntrada("observacoes",e.target.value)} className={INPUT_CLS+" resize-none"} />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setModalEntrada(false)} className="text-sm font-semibold text-gray-500 hover:text-gray-800 px-4 py-2">Cancelar</button>
              <button onClick={handleSalvarEntrada} disabled={saving}
                className="bg-green-500 hover:bg-green-600 text-white text-sm font-bold px-6 py-2 rounded-lg disabled:opacity-60 flex items-center gap-2 transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4" />}
                {saving ? "Salvando…" : "Registrar entrada"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ MODAL TRANSFERÊNCIA ════════════════════ */}
      {modalTransf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center"><ArrowRightLeft className="w-4 h-4 text-blue-500" /></div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Nova transferência</h2>
                  <p className="text-xs text-gray-400">Movimentação interna entre contas da empresa</p>
                </div>
              </div>
              <button onClick={() => setModalTransf(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Conta origem (bloqueada) */}
              <div>
                <label className={LABEL_CLS}>Conta de origem</label>
                <div className={INPUT_CLS+" bg-gray-50 text-gray-500 cursor-not-allowed flex items-center gap-2"}>
                  <Landmark className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{conta?.descricao ?? "Esta conta"}</span>
                  <span className="ml-auto text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">Atual</span>
                </div>
              </div>

              {/* Conta destino */}
              <div>
                <label className={LABEL_CLS}>Conta de destino *</label>
                <div className="relative">
                  <select value={transfForm.conta_destino_id} onChange={e=>setTransf("conta_destino_id",e.target.value)} className={SEL_CLS}>
                    <option value="">Selecionar conta…</option>
                    {contas.filter(c=>c.id!==contaId).map(c=>(
                      <option key={c.id} value={c.id}>{c.descricao}{c.banco_nome ? ` — ${c.banco_nome}` : ""}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Valor + Data */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>Valor (R$) *</label>
                  <CurrencyInput value={transfForm.valor} onChange={v=>setTransf("valor",v)} placeholder="0,00" className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Data *</label>
                  <input type="date" value={transfForm.data} onChange={e=>setTransf("data",e.target.value)} className={INPUT_CLS} />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className={LABEL_CLS}>Descrição</label>
                <input type="text" value={transfForm.descricao} onChange={e=>setTransf("descricao",e.target.value)} className={INPUT_CLS} />
              </div>

              {/* Observações */}
              <div>
                <label className={LABEL_CLS}>Observações</label>
                <textarea rows={2} placeholder="Opcional…" value={transfForm.observacoes}
                  onChange={e=>setTransf("observacoes",e.target.value)} className={INPUT_CLS+" resize-none"} />
              </div>

              {/* Info */}
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <ArrowRightLeft className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700">Transferências <strong>não afetam receitas nem despesas</strong>. Apenas movem saldo entre contas da empresa.</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 pb-5">
              <button onClick={() => setModalTransf(false)} className="text-sm font-semibold text-gray-500 hover:text-gray-800 px-4 py-2">Cancelar</button>
              <button onClick={handleSalvarTransf} disabled={saving}
                className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold px-6 py-2 rounded-lg disabled:opacity-60 flex items-center gap-2 transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <ArrowRightLeft className="w-4 h-4" />}
                {saving ? "Salvando…" : "Transferir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
