import { useState, useEffect, useRef } from "react";
import {
  Plus, Search, ChevronLeft, ChevronRight,
  DollarSign, TrendingDown, TrendingUp, Wallet,
  Eye, FileText, Receipt, CalendarDays, RotateCcw,
  X, Loader2, Coins, Printer, Share2, Copy, Mail,
  MessageCircle, Check, ArrowDownCircle, ExternalLink,
} from "lucide-react";
import {
  getReceivableDisplayStatus, chargeModeLabel,
  type GatewayChargeInfo,
} from "@/lib/gatewayDisplayStatus";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import RegistrarPagamentoModal, {
  type ReceivableForPayment,
} from "@/components/app/RegistrarPagamentoModal";

/* ─── tipos ──────────────────────────────────────────────────── */
type StatusFilter = "todos" | "pendente" | "atrasado" | "pago" | "cancelado";
type ModoReceita = "conta_a_receber" | "receita_recebida";

interface Receivable {
  id: string; student_nome: string | null; descricao: string;
  valor: number; vencimento: string;
  status: "pendente" | "pago" | "atrasado" | "cancelado" | "aguardando";
  tipo: string; forma_pagamento: string | null;
  valor_pago: number | null; desconto: number | null;
  multa: number | null; juros: number | null;
  parcela_numero: number | null; total_parcelas: number | null;
  pago_em: string | null; hora_recebimento: string | null;
  created_at: string; updated_at: string | null;
  student_contract_id: string | null;
  centro_receita_id: string | null;
  categoria_id: string | null;
  subcategoria_id: string | null;
  conta_financeira_id: string | null;
  data_competencia: string | null;
  pagador: string | null;
  anexo_url: string | null;
  modo: string | null;
  gateway_provider: string | null;
  gateway_status: string | null;
  asaas_payment_id: string | null;
  asaas_payment_url: string | null;
}

interface CentroReceita { id: string; descricao: string; }
interface Categoria { id: string; nome: string; centro_receita_id: string | null; }
interface Subcategoria { id: string; nome: string; categoria_id: string; }
interface ContaFinanceira { id: string; nome: string; }

/* ─── helpers ────────────────────────────────────────────────── */
const TODAY = new Date().toISOString().split("T")[0];

function effStatus(r: Receivable) {
  if (r.status === "pendente" && r.vencimento < TODAY) return "atrasado";
  return r.status;
}

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  pendente:   { label: "Pendente",     bg: "bg-yellow-100", text: "text-yellow-700" },
  atrasado:   { label: "Atrasado",     bg: "bg-red-100",    text: "text-red-600"    },
  pago:       { label: "Recebido",     bg: "bg-green-100",  text: "text-green-700"  },
  aguardando: { label: "Em andamento", bg: "bg-orange-100", text: "text-orange-700" },
  cancelado:  { label: "Cancelado",    bg: "bg-gray-100",   text: "text-gray-500"   },
};

const TIPO_LABEL: Record<string, string> = {
  mensalidade: "Mensalidade", matricula: "Matrícula",
  avulso: "Avulso", multa: "Multa", aula_avulsa: "Aula avulsa", outros: "Outros",
};

const FORMA_LABEL: Record<string, string> = {
  pix: "Pix", dinheiro: "Dinheiro", cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito", boleto: "Boleto", transferencia: "Transferência",
};

const fmt  = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtD = (s: string) => new Date(s.includes("T") ? s : s + "T12:00:00").toLocaleDateString("pt-BR");
const fmtDT= (s: string) => `${new Date(s).toLocaleDateString("pt-BR")} ${new Date(s).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`;

const PAGE_SIZE = 20;

/* ─── Modal Recibo ───────────────────────────────────────────── */
function ReceiboModal({ r, currentUserName, contractorId, onClose }: {
  r: Receivable; currentUserName: string; contractorId: string; onClose: () => void;
}) {
  const [showShare,   setShowShare]   = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [contractor,  setContractor]  = useState<any | null>(null);
  const [studentCpf,  setStudentCpf]  = useState<string | null>(null);
  const [scExtra,     setScExtra]     = useState<{ data_fim: string | null; valor_total: number | null } | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [shareToken,  setShareToken]  = useState<string | null>(null);
  const [savingLink,  setSavingLink]  = useState(false);
  const [termica,     setTermica]     = useState(false);

  const reciboNum = parseInt(r.id.replace(/-/g, "").slice(0, 9), 16) % 900_000_000 + 100_000_000;
  const shareLink = shareToken ? `${window.location.origin}/recibo/${shareToken}` : null;
  const dataAssinatura = (r.pago_em ?? r.vencimento);

  useEffect(() => {
    async function fetchData() {
      // Contractor
      const { data: ct } = await supabase.from("contractors")
        .select("razao_social, nome_fantasia, cnpj, fone, logradouro, numero, bairro, cidade, uf")
        .eq("id", contractorId).maybeSingle();
      setContractor(ct ?? null);

      // Student CPF + contract extra
      if (r.student_contract_id) {
        const { data: sc } = await supabase.from("student_contracts")
          .select("student_id, contrato_id, data_inicio, data_fim")
          .eq("id", r.student_contract_id).maybeSingle();
        if (sc?.student_id) {
          const { data: st } = await supabase.from("students")
            .select("cpf").eq("id", sc.student_id).maybeSingle();
          setStudentCpf(st?.cpf ?? null);
        }
        if (sc?.contrato_id) {
          const { data: cn } = await supabase.from("contratos")
            .select("valor_total").eq("id", sc.contrato_id).maybeSingle();
          setScExtra({ data_fim: sc.data_fim ?? null, valor_total: cn?.valor_total ?? null });
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [r.id, contractorId, r.student_contract_id]);

  const fmtCpf = (c: string | null) => {
    if (!c) return null;
    const d = c.replace(/\D/g, "");
    if (d.length !== 11) return c;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  };
  const fmtCnpj = (c: string | null) => {
    if (!c) return null;
    const d = c.replace(/\D/g, "");
    if (d.length !== 14) return c;
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  };
  const fmtFone = (f: string | null) => {
    if (!f) return null;
    const d = f.replace(/\D/g, "");
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return f;
  };

  // Monta endereço
  const endereco = contractor
    ? [contractor.logradouro, contractor.numero, contractor.bairro, `${contractor.cidade} (${contractor.uf})`]
        .filter(Boolean).join(", ")
    : "";

  // Data formatada para assinatura
  const dtAssinatura = new Date(dataAssinatura.includes("T") ? dataAssinatura : dataAssinatura + "T12:00:00");
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataExtensa = `${dtAssinatura.getDate()} de ${meses[dtAssinatura.getMonth()]} de ${dtAssinatura.getFullYear()}`;

  // Nome do cliente/pagador para o recibo
  const nomeCliente = r.student_nome ?? r.pagador ?? "—";

  // Linha referente
  const refLine = [
    r.total_parcelas ? `${r.parcela_numero}` : "1",
    "-",
    r.descricao,
    scExtra?.valor_total ? `- ${fmt(scExtra.valor_total)}` : "",
    scExtra?.data_fim ? `- Válido até ${fmtD(scExtra.data_fim)}` : "",
  ].filter(s => s !== "").join(" ");

  // HTML do recibo (usado no print)
  function buildHtml() {
    const w = "148mm";
    const fs = "13px";
    const nomeLoja = contractor?.nome_fantasia || contractor?.razao_social || "FIT CORE STUDIO";
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Recibo nº ${reciboNum}</title>
<style>
  @page { size: ${termica ? "80mm auto" : "A5"}; margin: ${termica ? "4mm" : "12mm"}; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: ${fs}; }
  body { width: ${w}; color: #111; }
  h1 { text-align: center; font-size: ${termica ? "13px" : "16px"}; font-weight: bold; margin-bottom: ${termica ? "6px" : "10px"}; }
  .num { text-align: center; font-size: ${termica ? "10px" : "11px"}; color: #555; margin-bottom: ${termica ? "10px" : "16px"}; }
  .line { margin-bottom: ${termica ? "5px" : "8px"}; line-height: 1.5; }
  .label { font-weight: bold; }
  hr { border: none; border-top: 1px dashed #aaa; margin: ${termica ? "8px 0" : "12px 0"}; }
  .footer { margin-top: ${termica ? "14px" : "24px"}; text-align: center; font-size: ${termica ? "9px" : "11px"}; color: #555; }
  .sig-line { border-top: 1px solid #333; width: 60%; margin: ${termica ? "20px" : "32px"} auto 4px; }
  .sig-name { text-align: center; font-weight: bold; font-size: ${termica ? "10px" : "12px"}; }
  .sig-date { text-align: center; font-size: ${termica ? "9px" : "11px"}; color: #555; }
</style></head><body>
<h1>Recibo ${nomeLoja.toUpperCase()}</h1>
<p class="num">Recibo nº ${reciboNum}</p>
<p class="line"><span class="label">Recebi de</span>: ${nomeCliente}${studentCpf ? `, CPF: ${fmtCpf(studentCpf)}` : ""}, a quantia de <strong>${fmt(r.valor_pago ?? r.valor)}</strong>, referente à:</p>
<p class="line">${refLine}</p>
<hr/>
<p class="line"><span class="label">Forma de pagamento</span>: ${r.forma_pagamento ? (FORMA_LABEL[r.forma_pagamento] ?? r.forma_pagamento) : "—"}</p>
<p class="line"><span class="label">Vencimento do título</span>: ${fmtD(r.vencimento)}</p>
<p class="line"><span class="label">Número de parcelas</span>: ${r.total_parcelas ?? 1}</p>
<p class="line"><span class="label">Valor total</span>: ${fmt(r.valor)}</p>
<p class="line"><span class="label">Valor desconto</span>: ${fmt(r.desconto ?? 0)}</p>
<p class="line"><span class="label">Valor recebido</span>: ${fmt(r.valor_pago ?? r.valor)}</p>
${endereco ? `<p class="line">${endereco}</p>` : ""}
${contractor?.razao_social ? `<p class="line">${contractor.razao_social}</p>` : ""}
${contractor?.cnpj ? `<p class="line">${fmtCnpj(contractor.cnpj)}</p>` : ""}
${contractor?.fone ? `<p class="line">${fmtFone(contractor.fone)}</p>` : ""}
<div class="sig-line"></div>
<p class="sig-name">${currentUserName}</p>
<p class="sig-date">${dataExtensa}</p>
</body></html>`;
  }

  function handlePrint() {
    const w = window.open("", "_blank", "width=700,height=600");
    if (!w) { toast.error("Pop-up bloqueado. Permita pop-ups para imprimir."); return; }
    w.document.write(buildHtml());
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  }

  const nomeLoja = contractor?.nome_fantasia || contractor?.razao_social || "FIT CORE STUDIO";

  const fmtCpf_r  = (c: string | null) => { if (!c) return null; const d = c.replace(/\D/g,""); return d.length===11?`${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`:c; };
  const fmtCnpj_r = (c: string | null) => { if (!c) return null; const d = c.replace(/\D/g,""); return d.length===14?`${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`:c; };
  const fmtFone_r = (f: string | null) => { if (!f) return null; const d = f.replace(/\D/g,""); if(d.length===11)return`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`; if(d.length===10)return`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`; return f; };

  async function handleAbrirCompartilhar() {
    if (shareToken) { setShowShare(true); return; }
    setSavingLink(true);
    const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const hoje = new Date();
    const de = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
    const enderecoStr = contractor
      ? [contractor.logradouro, contractor.numero, contractor.bairro, `${contractor.cidade} (${contractor.uf})`].filter(Boolean).join(", ")
      : "";
    const payload = {
      nomeLoja,
      studentNome: r.student_nome ?? r.pagador,
      studentCpf:  studentCpf ? fmtCpf_r(studentCpf) : null,
      reciboNum,
      dataExtensa: de,
      currentUserName,
      totalSelecionado: r.valor_pago ?? r.valor,
      selectedGroups: [{
        label: r.descricao,
        periodo: null,
        selItems: [{
          parcela_numero: r.parcela_numero,
          descricao: r.descricao,
          vencimento: r.vencimento,
          pago_em: r.pago_em,
          valor_pago: r.valor_pago,
          valor: r.valor,
        }],
      }],
      endereco:    enderecoStr,
      razaoSocial: contractor?.razao_social ?? null,
      cnpj:        fmtCnpj_r(contractor?.cnpj ?? null),
      fone:        fmtFone_r(contractor?.fone ?? null),
    };
    const { data, error } = await supabase
      .from("public_receipts")
      .insert({ receipt_data: payload })
      .select("token")
      .maybeSingle();
    setSavingLink(false);
    if (error || !data) { toast.error("Erro ao gerar link."); return; }
    setShareToken(data.token);
    setShowShare(true);
  }

  async function handleCopyLink() {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copiado!");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: "92vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-gray-900">Recibo</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        {/* Recibo */}
        <div className="flex-1 overflow-y-auto px-10 py-8">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="font-sans text-sm text-gray-900 space-y-3">
              <h2 className="text-center text-lg font-bold mb-1">Recibo {nomeLoja.toUpperCase()}</h2>
              <p className="text-center text-xs text-gray-400 -mt-2 mb-4">Recibo nº {reciboNum}</p>

              <p className="leading-relaxed">
                <strong>Recebi de</strong>: {nomeCliente}
                {studentCpf ? `, CPF: ${fmtCpf(studentCpf)}` : ""},&nbsp;
                a quantia de <strong>{fmt(r.valor_pago ?? r.valor)}</strong>, referente à:
              </p>
              <p className="text-gray-700">{refLine}</p>

              <hr className="border-dashed border-gray-300" />

              <div className="space-y-1.5">
                <p><strong>Forma de pagamento</strong>: {r.forma_pagamento ? (FORMA_LABEL[r.forma_pagamento] ?? r.forma_pagamento) : "—"}</p>
                <p><strong>Vencimento do título</strong>: {fmtD(r.vencimento)}</p>
                <p><strong>Número de parcelas</strong>: {r.total_parcelas ?? 1}</p>
                <p><strong>Valor total</strong>: {fmt(r.valor)}</p>
                <p><strong>Valor desconto</strong>: {fmt(r.desconto ?? 0)}</p>
                <p><strong>Valor recebido</strong>: {fmt(r.valor_pago ?? r.valor)}</p>
              </div>

              {/* Assinatura */}
              <div className="grid grid-cols-2 gap-8 mt-6">
                <div />
                <div className="text-center">
                  <div className="border-t border-gray-600 mb-1" />
                  <p className="font-bold text-sm">{currentUserName}</p>
                  <p className="text-xs text-gray-500">{dataExtensa}</p>
                </div>
              </div>

              {/* Rodapé empresa */}
              <div className="mt-6 pt-4 border-t border-dashed border-gray-200 text-xs text-gray-500 space-y-0.5">
                {endereco && <p>{endereco}</p>}
                {contractor?.razao_social && <p>{contractor.razao_social}</p>}
                {contractor?.cnpj && <p>{fmtCnpj(contractor.cnpj)}</p>}
                {contractor?.fone && <p>{fmtFone(contractor.fone)}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm font-bold text-gray-400 hover:text-gray-600 hover:underline">FECHAR</button>
          <div className="flex items-center gap-2">
            <button onClick={handleAbrirCompartilhar} disabled={savingLink}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors">
              {savingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              COMPARTILHAR
            </button>
            <button onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors">
              <Printer className="w-4 h-4" /> IMPRIMIR
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modal Compartilhar */}
      {showShare && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowShare(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <button onClick={() => setShowShare(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Link gerado!</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">Escolha uma das opções abaixo para envio do link.</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button onClick={() => window.open(`mailto:?subject=${encodeURIComponent(`Recibo nº ${reciboNum}`)}&body=${encodeURIComponent(`Olá,\n\nSegue o link do seu recibo:\n${shareLink ?? ""}\n\nAtenciosamente,\n${currentUserName}`)}`, "_blank")}
                className="flex items-center justify-center gap-2 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:border-primary hover:text-primary transition-colors">
                <Mail className="w-4 h-4" /> E-MAIL
              </button>
              <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Segue seu recibo de pagamento:\n${shareLink ?? ""}`)}`, "_blank")}
                className="flex items-center justify-center gap-2 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:border-green-500 hover:text-green-600 transition-colors">
                <MessageCircle className="w-4 h-4" /> WHATSAPP
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-2">Ou copie o link para enviar</p>
            <div className="flex items-center gap-2">
              <input readOnly value={shareLink ?? ""}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 text-gray-500 bg-gray-50 truncate focus:outline-none" />
              <button onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${copied ? "bg-green-100 text-green-700" : "bg-primary text-white hover:bg-primary/90"}`}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "COPIADO" : "COPIAR LINK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Modal Detalhes do Financeiro (inline) ──────────────────── */
function DetalheModal({ r, charge, onClose }: { r: Receivable; charge?: GatewayChargeInfo | null; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState("dados");
  const [scData,    setScData]    = useState<any | null>(null);
  const [events,    setEvents]    = useState<any[]>([]);
  const [loadingSc, setLoadingSc] = useState(false);

  const TABS = [
    { key: "dados",      label: "DADOS PRINCIPAIS" },
    { key: "recebimento",label: "RECEBIMENTO"       },
    { key: "gateway",    label: "GATEWAY PAY"       },
    { key: "venda",      label: "VENDA"             },
    { key: "categ",      label: "CATEGORIZAÇÃO"     },
    { key: "historico",  label: "HISTÓRICO GERAL"   },
  ];

  useEffect(() => {
    if (!r.student_contract_id) return;
    setLoadingSc(true);
    async function fetch_() {
      const { data: sc } = await supabase.from("student_contracts")
        .select("id, status, created_at, desconto, valor_mensalidade, contrato_id")
        .eq("id", r.student_contract_id!).maybeSingle();
      if (sc) {
        const { data: ct } = await supabase.from("contratos")
          .select("descricao, duracao, tipo_duracao").eq("id", sc.contrato_id).maybeSingle();
        setScData({ ...sc, contrato: ct ?? null });
      }
      const { data: evs } = await supabase.from("contract_events")
        .select("id, descricao, usuario_nome, created_at")
        .eq("student_contract_id", r.student_contract_id!)
        .order("created_at", { ascending: false });
      setEvents((evs ?? []) as any[]);
      setLoadingSc(false);
    }
    fetch_();
  }, [r.student_contract_id]);

  const st = STATUS_BADGE[effStatus(r)] ?? STATUS_BADGE.pendente;
  const fmtDur = (d: number, t: string) => `${d} ${t === "meses" ? (d === 1 ? "mês" : "meses") : t}`;

  const field = (label: string, value: React.ReactNode, green = false) => (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${green ? "text-green-600" : "text-gray-800"}`}>{value ?? "—"}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <DollarSign className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold text-gray-900">Detalhes do financeiro</h3>
          <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex border-b border-gray-100">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${activeTab === t.key ? "border-primary text-primary" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-6">

          {activeTab === "dados" && (
            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-0.5">Descrição</p>
                <p className="text-base font-bold text-gray-900">{r.descricao}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Situação</p>
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${st.bg} ${st.text}`}>{st.label}</span>
              </div>
              {field("Data de vencimento", fmtD(r.vencimento))}
              {field("Valor", fmt(r.valor), true)}
              {field("Cliente / Pagador", r.student_nome ?? r.pagador)}
            </div>
          )}

          {activeTab === "recebimento" && (
            r.status === "pago" ? (
              <div className="grid grid-cols-3 gap-5">
                {field("Recebido em", r.pago_em ? fmtD(r.pago_em) : "—")}
                {field("Horário", r.hora_recebimento ? String(r.hora_recebimento).slice(0,5) : "—")}
                {field("Método", r.forma_pagamento ? (FORMA_LABEL[r.forma_pagamento] ?? r.forma_pagamento) : "—")}
                {field("Número de parcelas", r.total_parcelas ? `${r.parcela_numero ?? 1}x` : "1x")}
                <div className="col-span-3 border-t border-gray-100 pt-4">
                  <div className="grid grid-cols-4 gap-4">
                    {field("Valor original", fmt(r.valor))}
                    {field("Valor desconto", fmt(r.desconto ?? 0))}
                    {field("Valor multa", fmt(r.multa ?? 0))}
                    {field("Valor recebido", fmt(r.valor_pago ?? r.valor), true)}
                  </div>
                </div>
                {field("Usuário recebimento", "—")}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                <DollarSign className="w-8 h-8 text-gray-200" />
                <p className="text-sm">Ainda não houve recebimento para esta cobrança.</p>
              </div>
            )
          )}

          {activeTab === "gateway" && (
            (r.asaas_payment_id || charge) ? (
              <div className="space-y-5">
                {(() => {
                  const ds = getReceivableDisplayStatus(r, charge);
                  return ds ? (
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${ds.bg} ${ds.text}`}>{ds.label}</span>
                      <p className="text-xs text-gray-400">{ds.description}</p>
                    </div>
                  ) : null;
                })()}
                <div className="grid grid-cols-3 gap-5">
                  {field("Provider", "Asaas")}
                  {field("Ambiente", (charge?.provider_environment ?? "sandbox") === "production" ? "Produção" : "Sandbox")}
                  {field("Status gateway", charge?.status ?? r.gateway_status ?? "—")}
                  {field("ID da cobrança", charge?.provider_charge_id ?? r.asaas_payment_id ?? "—")}
                  {field("Forma", charge?.billing_type ?? "—")}
                  {field("Modo", chargeModeLabel(charge?.charge_mode))}
                  {charge?.card_brand && charge?.card_last4 && field("Cartão", `${charge.card_brand} **** ${charge.card_last4}`)}
                </div>
                {(charge?.invoice_url || r.asaas_payment_url) && (
                  <a
                    href={charge?.invoice_url ?? r.asaas_payment_url ?? "#"}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" /> Abrir cobrança no Asaas
                  </a>
                )}
                <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-3">
                  A baixa financeira acontece automaticamente quando o Asaas confirma o
                  recebimento (PAYMENT_RECEIVED). Status CONFIRMED indica cartão aprovado
                  aguardando liquidação — a parcela permanece pendente até lá.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-semibold text-gray-600">Sem cobrança GoFit Pay</p>
                <p className="text-xs text-center max-w-xs">Nenhuma cobrança foi emitida no gateway para esta conta. Emita em GoFit Pay → Cobranças.</p>
              </div>
            )
          )}

          {activeTab === "venda" && (
            loadingSc ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : scData ? (
              <div className="grid grid-cols-3 gap-5">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Situação</p>
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${r.status === "pago" ? "bg-green-100 text-green-700" : st.bg + " " + st.text}`}>
                    {r.status === "pago" ? "Concluída" : st.label}
                  </span>
                </div>
                {field("Data", fmtD(scData.created_at))}
                {field("Valor desconto", fmt(scData.desconto ?? 0))}
                {field("Valor", fmt(scData.valor_mensalidade ?? r.valor), true)}
                <div className="col-span-3">
                  {field("Contratos", scData.contrato ? `${scData.contrato.descricao}, ${fmtDur(scData.contrato.duracao, scData.contrato.tipo_duracao)}` : "—")}
                </div>
                {field("Consultor", "—")}
                {field("Origem", "Manual")}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                <p className="text-sm">Venda não vinculada a um contrato.</p>
              </div>
            )
          )}

          {activeTab === "categ" && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-400 py-2">Descrição</th>
                  <th className="text-left text-xs font-semibold text-gray-400 py-2">Categoria de receita</th>
                  <th className="text-right text-xs font-semibold text-gray-400 py-2">Valor categorizado</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-50">
                  <td className="py-3 text-sm text-gray-700">{r.descricao}</td>
                  <td className="py-3 text-sm text-gray-600 capitalize">{r.tipo === "mensalidade" ? "Vendas" : TIPO_LABEL[r.tipo] ?? r.tipo}</td>
                  <td className="py-3 text-sm font-semibold text-gray-800 text-right">{fmt(r.valor)}</td>
                </tr>
              </tbody>
            </table>
          )}

          {activeTab === "historico" && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-400 py-2 w-40">Data</th>
                  <th className="text-left text-xs font-semibold text-gray-400 py-2">Histórico</th>
                  <th className="text-left text-xs font-semibold text-gray-400 py-2 w-36">Usuário</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDT(r.created_at)}</td>
                  <td className="py-3 text-sm text-gray-700">Título financeiro foi criado.</td>
                  <td className="py-3 text-sm text-gray-500">—</td>
                </tr>
                {r.status === "pago" && r.pago_em && (
                  <tr className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDT(r.pago_em)}</td>
                    <td className="py-3 text-sm text-gray-700">Título financeiro alterado para recebido.</td>
                    <td className="py-3 text-sm text-gray-500">—</td>
                  </tr>
                )}
                {events.map(ev => (
                  <tr key={ev.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDT(ev.created_at)}</td>
                    <td className="py-3 text-sm text-gray-700">{ev.descricao}</td>
                    <td className="py-3 text-sm text-gray-500">{ev.usuario_nome ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex justify-end px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm font-semibold text-primary hover:underline">FECHAR</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal Conta a Receber ──────────────────────────────────── */
interface Student { id: string; nome_completo: string; }

interface ReceitaForm {
  modo: ModoReceita;
  descricao: string;
  valor: string;
  tipo: string;
  vencimento: string;
  data_recebimento: string;
  hora_recebimento: string;
  data_competencia: string;
  forma_pagamento: string;
  conta_financeira_id: string;
  centro_receita_id: string;
  categoria_id: string;
  subcategoria_id: string;
  parcelado: boolean;
  total_parcelas: string;
  observacoes: string;
}

const TIPOS_RECEITA = [
  { value: "mensalidade", label: "Mensalidade" },
  { value: "matricula",   label: "Matrícula"   },
  { value: "avulso",      label: "Avulso"      },
  { value: "aula_avulsa", label: "Aula avulsa" },
  { value: "outros",      label: "Outros"      },
];

function NovaReceitaModal({
  onClose, onSaved,
  centros, categorias, subcategorias, contas,
  contractorId,
}: {
  onClose: () => void;
  onSaved: () => void;
  centros: CentroReceita[];
  categorias: Categoria[];
  subcategorias: Subcategoria[];
  contas: ContaFinanceira[];
  contractorId: string;
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const nowTime  = new Date().toTimeString().slice(0, 5);
  const firstDom = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}-01`;

  // Busca de aluno
  const [students,         setStudents]         = useState<Student[]>([]);
  const [studentSearch,    setStudentSearch]    = useState("");
  const [studentDropOpen,  setStudentDropOpen]  = useState(false);
  const [selectedStudent,  setSelectedStudent]  = useState<Student | null>(null);
  const studentRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<ReceitaForm>({
    modo: "conta_a_receber",
    descricao: "",
    valor: "",
    tipo: "mensalidade",
    vencimento: todayStr,
    data_recebimento: todayStr,
    hora_recebimento: nowTime,
    data_competencia: firstDom,
    forma_pagamento: "",
    conta_financeira_id: "",
    centro_receita_id: "",
    categoria_id: "",
    subcategoria_id: "",
    parcelado: false,
    total_parcelas: "1",
    observacoes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!contractorId) return;
    supabase.from("students")
      .select("id, nome_completo")
      .eq("contractor_id", contractorId)
      .order("nome_completo")
      .then(({ data }) => setStudents((data ?? []) as Student[]));
  }, [contractorId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (studentRef.current && !studentRef.current.contains(e.target as Node))
        setStudentDropOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredStudents = studentSearch
    ? students.filter(s => s.nome_completo.toLowerCase().includes(studentSearch.toLowerCase()))
    : students;

  function set(k: keyof ReceitaForm, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function handleCategoriaChange(catId: string) {
    const cat = categorias.find(c => c.id === catId);
    setForm(f => ({
      ...f,
      categoria_id: catId,
      subcategoria_id: "",
      centro_receita_id: cat?.centro_receita_id ?? f.centro_receita_id,
    }));
  }

  const subsFiltradas = subcategorias.filter(s => s.categoria_id === form.categoria_id);
  const isRecebida = form.modo === "receita_recebida";

  async function handleSave() {
    if (!form.descricao.trim()) { toast.error("Informe a descrição."); return; }
    const valorNum = Number(form.valor.replace(",", "."));
    if (!form.valor || isNaN(valorNum) || valorNum <= 0) { toast.error("Informe um valor válido."); return; }
    if (!isRecebida && !form.vencimento) { toast.error("Informe o vencimento."); return; }
    if (isRecebida && !form.data_recebimento) { toast.error("Informe a data de recebimento."); return; }
    if (isRecebida && !form.forma_pagamento) { toast.error("Informe a forma de recebimento."); return; }

    setSaving(true);
    const parcelas = form.parcelado ? parseInt(form.total_parcelas) || 1 : 1;

    const rows = Array.from({ length: parcelas }, (_, i) => {
      const d = new Date((isRecebida ? form.data_recebimento : form.vencimento) + "T12:00:00");
      d.setMonth(d.getMonth() + i);
      const row: any = {
        contractor_id:     contractorId,
        student_id:        selectedStudent?.id ?? null,
        student_nome:      selectedStudent?.nome_completo ?? null,
        pagador:           selectedStudent ? null : null, // aluno já fica em student_nome
        descricao:         parcelas > 1 ? `${form.descricao} (${i+1}/${parcelas})` : form.descricao,
        valor:             valorNum,
        vencimento:        d.toISOString().split("T")[0],
        status:            isRecebida ? "pago" : "pendente",
        tipo:              form.tipo,
        modo:              form.modo,
        forma_pagamento:   form.forma_pagamento || null,
        conta_financeira_id: form.conta_financeira_id || null,
        centro_receita_id: form.centro_receita_id || null,
        categoria_id:      form.categoria_id || null,
        subcategoria_id:   form.subcategoria_id || null,
        data_competencia:  form.data_competencia || null,
        parcela_numero:    parcelas > 1 ? i + 1 : null,
        total_parcelas:    parcelas > 1 ? parcelas : null,
        observacoes:       form.observacoes.trim() || null,
      };
      if (isRecebida) {
        row.pago_em           = form.data_recebimento;
        row.hora_recebimento  = form.hora_recebimento || null;
        row.valor_pago        = valorNum;
      }
      return row;
    });

    const { error } = await supabase.from("receivables").insert(rows);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success(
      isRecebida
        ? "Receita registrada com sucesso!"
        : parcelas > 1 ? `${parcelas} cobranças lançadas!` : "Conta a receber lançada!"
    );
    onSaved();
    onClose();
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white";
  const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "94vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ArrowDownCircle className="w-5 h-5 text-primary" />
            <span className="text-base font-bold text-gray-900">Conta a receber</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        {/* Toggle modo */}
        <div className="px-6 pt-5 pb-0">
          <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => set("modo", "conta_a_receber")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!isRecebida ? "bg-white shadow text-primary" : "text-gray-500 hover:text-gray-700"}`}>
              Conta a receber
            </button>
            <button
              onClick={() => set("modo", "receita_recebida")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isRecebida ? "bg-white shadow text-green-600" : "text-gray-500 hover:text-gray-700"}`}>
              Receita já recebida
            </button>
          </div>
          {isRecebida && (
            <p className="mt-2 text-xs text-green-600 font-medium">
              ✓ Status definido como <strong>Recebido</strong> automaticamente.
            </p>
          )}
        </div>

        {/* Formulário */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Busca de aluno */}
          <div ref={studentRef} className="relative">
            <label className={labelCls}>Aluno (opcional)</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Buscar aluno cadastrado..."
                value={selectedStudent ? selectedStudent.nome_completo : studentSearch}
                onChange={e => { setStudentSearch(e.target.value); setSelectedStudent(null); setStudentDropOpen(true); }}
                onClick={() => setStudentDropOpen(true)}
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
              />
              {selectedStudent && (
                <button onClick={() => { setSelectedStudent(null); setStudentSearch(""); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {studentDropOpen && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-44 overflow-y-auto mt-1">
                {filteredStudents.length === 0
                  ? <p className="px-3 py-2 text-sm text-gray-400">Nenhum aluno encontrado</p>
                  : filteredStudents.map(s => (
                    <button key={s.id}
                      onClick={() => { setSelectedStudent(s); setStudentSearch(""); setStudentDropOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
                      {s.nome_completo}
                    </button>
                  ))
                }
              </div>
            )}
          </div>

          {/* Descrição + Tipo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Descrição *</label>
              <input className={inputCls} placeholder="Ex: Mensalidade junho..." value={form.descricao} onChange={e => set("descricao", e.target.value as string)} />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <select className={inputCls} value={form.tipo} onChange={e => set("tipo", e.target.value)}>
                {TIPOS_RECEITA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Valor + Competência + Forma */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Valor (R$) *</label>
              <CurrencyInput className={inputCls} placeholder="0,00" value={form.valor} onChange={v => set("valor", v)} />
            </div>
            <div>
              <label className={labelCls}>Competência</label>
              <input className={inputCls} type="date" value={form.data_competencia} onChange={e => set("data_competencia", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Forma de recebimento{isRecebida ? " *" : ""}</label>
              <select className={inputCls} value={form.forma_pagamento} onChange={e => set("forma_pagamento", e.target.value)}>
                <option value="">Qualquer</option>
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao_credito">Cartão de crédito</option>
                <option value="cartao_debito">Cartão de débito</option>
                <option value="boleto">Boleto</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>
          </div>

          {/* Datas conforme modo */}
          {!isRecebida ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Vencimento *</label>
                <input className={inputCls} type="date" value={form.vencimento} onChange={e => set("vencimento", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Conta financeira</label>
                <select className={inputCls} value={form.conta_financeira_id} onChange={e => set("conta_financeira_id", e.target.value)}>
                  <option value="">Selecionar...</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Data de recebimento *</label>
                <input className={inputCls} type="date" value={form.data_recebimento} onChange={e => set("data_recebimento", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Horário</label>
                <input className={inputCls} type="time" value={form.hora_recebimento} onChange={e => set("hora_recebimento", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Conta financeira</label>
                <select className={inputCls} value={form.conta_financeira_id} onChange={e => set("conta_financeira_id", e.target.value)}>
                  <option value="">Selecionar...</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Parcelado (só no modo "conta a receber") */}
          {!isRecebida && (
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 font-medium">Parcelado</span>
                <button
                  onClick={() => set("parcelado", !form.parcelado)}
                  className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${form.parcelado ? "bg-primary" : "bg-gray-200"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.parcelado ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
              {form.parcelado && (
                <div className="mt-3 max-w-[160px]">
                  <label className={labelCls}>Número de parcelas</label>
                  <input type="number" min="2" max="60" className={inputCls} value={form.total_parcelas} onChange={e => set("total_parcelas", e.target.value)} />
                </div>
              )}
            </div>
          )}

          {/* Categorização */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Categorização</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Categoria de receita</label>
                <select className={inputCls} value={form.categoria_id} onChange={e => handleCategoriaChange(e.target.value)}>
                  <option value="">Selecionar...</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Subcategoria</label>
                <select className={inputCls} value={form.subcategoria_id} onChange={e => set("subcategoria_id", e.target.value)} disabled={!form.categoria_id}>
                  <option value="">Selecionar...</option>
                  {subsFiltradas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Centro de receita</label>
                <select className={inputCls} value={form.centro_receita_id} onChange={e => set("centro_receita_id", e.target.value)}>
                  <option value="">Selecionar...</option>
                  {centros.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className={labelCls}>Observações</label>
            <textarea className={inputCls + " resize-none"} rows={2} placeholder="Observações adicionais..." value={form.observacoes} onChange={e => set("observacoes", e.target.value as string)} />
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm font-bold text-gray-400 hover:text-gray-600 hover:underline">CANCELAR</button>
          <button onClick={handleSave} disabled={saving}
            className={`inline-flex items-center gap-2 px-6 py-2 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-60 ${isRecebida ? "bg-green-600 hover:bg-green-700" : "bg-primary hover:bg-primary/90"}`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? "SALVANDO..." : isRecebida ? "REGISTRAR RECEBIMENTO" : "LANÇAR"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal Receber (para receitas sem contrato) ─────────────── */
function ReceberModal({ r, onClose, onSaved }: {
  r: Receivable; onClose: () => void; onSaved: () => void;
}) {
  const [data_recebimento, setDataRecebimento] = useState(new Date().toISOString().split("T")[0]);
  const [hora_recebimento, setHoraRecebimento] = useState(new Date().toTimeString().slice(0, 5));
  const [forma_pagamento,  setFormaPagamento]  = useState(r.forma_pagamento ?? "");
  const [valor_pago,       setValorPago]       = useState(String(r.valor));
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!forma_pagamento) { toast.error("Selecione a forma de recebimento."); return; }
    setSaving(true);
    const { error } = await supabase.from("receivables").update({
      status: "pago",
      pago_em: data_recebimento,
      hora_recebimento: hora_recebimento || null,
      forma_pagamento,
      valor_pago: Number(valor_pago.replace(",", ".")),
      updated_at: new Date().toISOString(),
    }).eq("id", r.id);
    setSaving(false);
    if (error) { toast.error("Erro ao registrar recebimento."); return; }
    toast.success("Recebimento registrado!");
    onSaved();
    onClose();
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <ArrowDownCircle className="w-5 h-5 text-green-500" />
          <h3 className="text-base font-bold text-gray-900">Registrar recebimento</h3>
          <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs text-gray-400">Descrição</p>
            <p className="text-sm font-semibold text-gray-800">{r.descricao}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Data de recebimento</label>
              <input className={inputCls} type="date" value={data_recebimento} onChange={e => setDataRecebimento(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Horário</label>
              <input className={inputCls} type="time" value={hora_recebimento} onChange={e => setHoraRecebimento(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Forma de recebimento *</label>
              <select className={inputCls} value={forma_pagamento} onChange={e => setFormaPagamento(e.target.value)}>
                <option value="">Selecionar...</option>
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao_credito">Cartão de crédito</option>
                <option value="cartao_debito">Cartão de débito</option>
                <option value="boleto">Boleto</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Valor recebido (R$)</label>
              <CurrencyInput className={inputCls} value={valor_pago} onChange={setValorPago} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={saving} className="text-sm font-bold text-gray-400 hover:underline">CANCELAR</button>
          <button onClick={handleConfirm} disabled={saving}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg disabled:opacity-60">
            {saving ? "Salvando..." : "CONFIRMAR RECEBIMENTO"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Página principal ───────────────────────────────────────── */
export default function ContasReceberPage() {
  const { user } = useAuth();
  const [all,          setAll]          = useState<Receivable[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [page,         setPage]         = useState(1);
  const [showNovaReceita, setShowNovaReceita] = useState(false);
  const [payTarget,    setPayTarget]    = useState<ReceivableForPayment | null>(null);
  const [receberTarget, setReceberTarget] = useState<Receivable | null>(null);

  // Lookups para NovaReceitaModal
  const [centros,       setCentros]    = useState<CentroReceita[]>([]);
  const [categorias,    setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcats]    = useState<Subcategoria[]>([]);
  const [contas,        setContas]     = useState<ContaFinanceira[]>([]);

  // Filtros de data
  const now = new Date();
  const [dataInicio, setDataInicio] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`);
  const [dataFim,    setDataFim]    = useState(new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10));
  const [filtroAtivo, setFiltroAtivo] = useState(false);

  // Fase 15.4 — mapa receivable_id → dados mascarados da cobrança gateway
  const [chargeMap, setChargeMap] = useState<Record<string, GatewayChargeInfo>>({});

  // 3-dots
  const [menuId,    setMenuId]    = useState<string | null>(null);
  const [detalheRec,setDetalheRec]= useState<Receivable | null>(null);
  const [reciboRec, setReciboRec] = useState<Receivable | null>(null);
  const [estornarId,setEstornarId]= useState<string | null>(null);
  const [cancelId,  setCancelId]  = useState<string | null>(null);
  const [actLoading,setActLoading]= useState(false);

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);
    const { data } = await supabase
      .from("receivables")
      .select("id, student_nome, descricao, valor, vencimento, status, tipo, forma_pagamento, valor_pago, desconto, multa, juros, parcela_numero, total_parcelas, pago_em, hora_recebimento, created_at, updated_at, student_contract_id, centro_receita_id, categoria_id, subcategoria_id, conta_financeira_id, data_competencia, pagador, anexo_url, modo, gateway_provider, gateway_status, asaas_payment_id, asaas_payment_url")
      .eq("contractor_id", user.contractorId)
      .order("vencimento", { ascending: false });
    setAll((data ?? []) as Receivable[]);
    setLoading(false);

    // Fase 15.4 — dados mascarados das cobranças GoFit Pay (apenas campos seguros)
    const { data: charges } = await supabase
      .from("payment_charges")
      .select("receivable_id, status, billing_type, charge_mode, card_brand, card_last4, provider_charge_id, invoice_url, provider_environment")
      .eq("contractor_id", user.contractorId)
      .not("receivable_id", "is", null)
      .limit(2000);
    const map: Record<string, GatewayChargeInfo> = {};
    for (const c of charges ?? []) {
      if (c.receivable_id) map[c.receivable_id] = c as GatewayChargeInfo;
    }
    setChargeMap(map);
  }

  async function loadLookups() {
    if (!user?.contractorId) return;
    const [{ data: cr }, { data: cat }, { data: sub }, { data: cf }] = await Promise.all([
      supabase.from("centros_receita").select("id, descricao").eq("contractor_id", user.contractorId).order("descricao"),
      supabase.from("categorias_financeiras").select("id, nome, centro_receita_id").eq("contractor_id", user.contractorId).eq("tipo", "receita").order("nome"),
      supabase.from("subcategorias_financeiras").select("id, nome, categoria_id").eq("contractor_id", user.contractorId).order("nome"),
      supabase.from("contas_financeiras").select("id, nome").eq("contractor_id", user.contractorId).order("nome"),
    ]);
    setCentros((cr ?? []) as CentroReceita[]);
    setCategorias((cat ?? []) as Categoria[]);
    setSubcats((sub ?? []) as Subcategoria[]);
    setContas((cf ?? []) as ContaFinanceira[]);
  }

  useEffect(() => { load(); loadLookups(); }, [user]);

  // KPIs
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const totalValor      = all.reduce((s,r) => s + Number(r.valor), 0);
  const totalRecebido   = all.filter(r => r.status === "pago").reduce((s,r) => s + Number(r.valor_pago ?? r.valor), 0);
  const totalEmAberto   = all.filter(r => r.status === "pendente" && r.vencimento >= TODAY).reduce((s,r) => s + Number(r.valor), 0);
  const totalAndamento  = all.filter(r => r.status === "aguardando").reduce((s,r) => s + Number(r.valor), 0);

  // Counts por tab
  const TAB_COUNTS: Record<StatusFilter, number> = {
    todos:     all.length,
    pendente:  all.filter(r => r.status === "pendente" && r.vencimento >= TODAY).length,
    atrasado:  all.filter(r => r.status === "pendente" && r.vencimento <  TODAY).length,
    pago:      all.filter(r => r.status === "pago").length,
    cancelado: all.filter(r => r.status === "cancelado").length,
  };

  // Filtro
  const filtered = all.filter(r => {
    const eff = effStatus(r);
    if (statusFilter !== "todos" && eff !== statusFilter) return false;
    if (filtroAtivo) {
      if (r.vencimento < dataInicio || r.vencimento > dataFim) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!r.descricao.toLowerCase().includes(q)
        && !(r.student_nome?.toLowerCase().includes(q))
        && !(r.pagador?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  function handleFilterChange(f: StatusFilter) { setStatusFilter(f); setPage(1); }

  async function handleEstornar(id: string) {
    setActLoading(true);
    await supabase.from("receivables").update({
      status: "pendente", valor_pago: null, pago_em: null, hora_recebimento: null, updated_at: new Date().toISOString(),
    }).eq("id", id);
    // remove transaction
    await supabase.from("transactions").delete().eq("receivable_id", id);
    toast.success("Recebimento estornado.");
    setActLoading(false);
    setEstornarId(null);
    load();
  }

  async function handleCancel(id: string) {
    setActLoading(true);
    await supabase.from("receivables").update({ status: "cancelado" }).eq("id", id);
    toast.success("Cobrança cancelada.");
    setActLoading(false);
    setCancelId(null);
    load();
  }

  const KPIS = [
    { icon: Wallet,      label: "Valor total",       value: fmt(totalValor),     color: "text-gray-900",   bg: "bg-blue-50",   ic: "text-blue-500"  },
    { icon: TrendingUp,  label: "Valor recebido",     value: fmt(totalRecebido),  color: "text-green-600",  bg: "bg-green-50",  ic: "text-green-500" },
    { icon: DollarSign,  label: "Valor em aberto",    value: fmt(totalEmAberto),  color: "text-orange-600", bg: "bg-orange-50", ic: "text-orange-500"},
    { icon: TrendingDown,label: "Valor em andamento", value: fmt(totalAndamento), color: "text-orange-600", bg: "bg-orange-50", ic: "text-orange-500"},
  ];

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-900 flex-shrink-0">Contas a receber</h1>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Pesquisar cliente ou descrição" value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <button onClick={() => setShowNovaReceita(true)}
                className="ml-auto inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                <Plus className="w-4 h-4" /> CONTA A RECEBER
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-gray-50">

            {/* Filtros de data */}
            <div className="px-8 pt-5 pb-0 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Data inicial</label>
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Data final</label>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white" />
              </div>
              <button onClick={() => { setFiltroAtivo(true); setPage(1); }}
                className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors self-end">
                APLICAR
              </button>
              {filtroAtivo && (
                <button onClick={() => { setFiltroAtivo(false); setPage(1); }}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 self-end flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Limpar filtro
                </button>
              )}
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-8 py-4">
              {KPIS.map(({ icon: Icon, label, value, color, bg, ic }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${ic}`} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">{label}</p>
                      <p className={`text-base font-bold ${color}`}>{value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="px-8 pb-0">
              <div className="bg-white rounded-t-xl border border-gray-200 border-b-0">
                <div className="flex items-center gap-1 px-4 pt-3">
                  {(["todos","pendente","atrasado","pago","cancelado"] as StatusFilter[]).map(tab => (
                    <button key={tab} onClick={() => handleFilterChange(tab)}
                      className={`px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5 border-b-2 ${
                        statusFilter === tab ? "text-primary border-primary" : "text-gray-500 border-transparent hover:text-gray-800"
                      }`}>
                      {{ todos:"Todos", pendente:"Pendente", atrasado:"Atrasado", pago:"Pago", cancelado:"Cancelado" }[tab]}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusFilter === tab ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"}`}>
                        {TAB_COUNTS[tab]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabela */}
            <div className="px-8 pb-8">
              <div className="bg-white rounded-b-xl border border-gray-200 border-t-0 overflow-visible">
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <DollarSign className="w-10 h-10 text-gray-200" />
                    <p className="text-sm text-gray-400">{all.length === 0 ? "Nenhuma cobrança lançada ainda." : "Nenhum resultado encontrado."}</p>
                  </div>
                ) : (
                  <>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold bg-gray-50">
                          <th className="text-left px-5 py-3">Cliente / Pagador</th>
                          <th className="text-left px-4 py-3">Descrição</th>
                          <th className="text-left px-4 py-3">Vencimento / Recebido</th>
                          <th className="text-right px-4 py-3">Valor</th>
                          <th className="text-right px-4 py-3">Recebido</th>
                          <th className="text-center px-4 py-3">Situação</th>
                          <th className="px-3 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {paginated.map(r => {
                          const eff   = effStatus(r);
                          const badge = STATUS_BADGE[eff] ?? STATUS_BADGE.pendente;
                          const isPago  = eff === "pago";
                          const canPay  = !isPago && eff !== "cancelado";
                          // receitas lançadas via modal NovaReceita (não são cobranças de mensalidade)
                          const isModoReceita = r.modo && r.modo !== "cobranca";
                          const cliente = r.student_nome ?? r.pagador ?? "—";
                          return (
                            <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-5 py-3 font-semibold text-gray-900 whitespace-nowrap max-w-[160px]">
                                <p className="truncate">{cliente}</p>
                              </td>
                              <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                                <p className="truncate">{r.descricao}</p>
                                {r.total_parcelas && (
                                  <span className="text-xs text-gray-400">{r.parcela_numero}/{r.total_parcelas}</span>
                                )}
                              </td>
                              <td className={`px-4 py-3 text-sm whitespace-nowrap ${eff === "atrasado" ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                                {isPago && r.pago_em
                                  ? <span>{fmtD(r.pago_em)}{r.hora_recebimento ? <span className="text-xs text-gray-400 ml-1">{String(r.hora_recebimento).slice(0,5)}</span> : null}</span>
                                  : fmtD(r.vencimento)
                                }
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                                {fmt(r.valor)}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                {isPago
                                  ? <span className="font-semibold text-green-600">{fmt(r.valor_pago ?? r.valor)}</span>
                                  : <span className="text-gray-400">—</span>
                                }
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                                  {badge.label}
                                </span>
                                {(() => {
                                  // Fase 15.4 — status do gateway abaixo do status financeiro
                                  const ds = getReceivableDisplayStatus(r, chargeMap[r.id] ?? null);
                                  if (!ds || ds.priority === 8) return null; // sem cobrança: sem ruído na tabela
                                  return (
                                    <div className="mt-1" title={`${ds.description}${ds.cardMasked ? ` · ${ds.cardMasked}` : ""}`}>
                                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ds.bg} ${ds.text}`}>
                                        {ds.label}
                                      </span>
                                      {ds.cardMasked && (
                                        <p className="text-[10px] text-gray-400 mt-0.5">{ds.cardMasked}</p>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              {/* 3-pontos */}
                              <td className="px-3 py-3 relative">
                                <button onClick={() => setMenuId(menuId === r.id ? null : r.id)}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                                  </svg>
                                </button>
                                {menuId === r.id && (
                                  <div className="absolute right-0 top-10 z-30 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-48">
                                    <button onClick={() => { setDetalheRec(r); setMenuId(null); }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                      <Eye className="w-3.5 h-3.5 text-gray-400" /> Detalhes
                                    </button>
                                    <button onClick={() => { toast.info("Emissão de NFS-e em breve."); setMenuId(null); }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                      <FileText className="w-3.5 h-3.5 text-gray-400" /> Emitir NFS-e
                                    </button>
                                    {isPago && (
                                      <button onClick={() => { setReciboRec(r); setMenuId(null); }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                        <Receipt className="w-3.5 h-3.5 text-gray-400" /> Recibo
                                      </button>
                                    )}
                                    <button onClick={() => { toast.info("Histórico em breve."); setMenuId(null); }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                      <CalendarDays className="w-3.5 h-3.5 text-gray-400" /> Histórico
                                    </button>
                                    {canPay && (
                                      isModoReceita ? (
                                        <button onClick={() => { setReceberTarget(r); setMenuId(null); }}
                                          className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-2">
                                          <ArrowDownCircle className="w-3.5 h-3.5" /> Receber
                                        </button>
                                      ) : (
                                        <button onClick={() => { setPayTarget({ id: r.id, descricao: r.descricao, valor: r.valor, student_nome: r.student_nome, forma_pagamento: r.forma_pagamento }); setMenuId(null); }}
                                          className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-2">
                                          <DollarSign className="w-3.5 h-3.5" /> Receber
                                        </button>
                                      )
                                    )}
                                    <div className="border-t border-gray-100 my-1" />
                                    {isPago ? (
                                      <button onClick={() => { setEstornarId(r.id); setMenuId(null); }}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                        <RotateCcw className="w-3.5 h-3.5" /> Estornar
                                      </button>
                                    ) : eff !== "cancelado" ? (
                                      <button onClick={() => { setCancelId(r.id); setMenuId(null); }}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                        <X className="w-3.5 h-3.5" /> Cancelar
                                      </button>
                                    ) : null}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Paginação */}
                    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
                      <span>Página {page} de {totalPages} — {filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
                      <div className="flex items-center gap-1">
                        <button disabled={page === 1} onClick={() => setPage(p => p-1)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button disabled={page === totalPages} onClick={() => setPage(p => p+1)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </AppLayout>

      {/* Backdrop */}
      {menuId && <div className="fixed inset-0 z-20" onClick={() => setMenuId(null)} />}

      {/* Modal Detalhes */}
      {detalheRec && <DetalheModal r={detalheRec} charge={chargeMap[detalheRec.id] ?? null} onClose={() => setDetalheRec(null)} />}

      {/* Modal Recibo */}
      {reciboRec && (
        <ReceiboModal
          r={reciboRec}
          currentUserName={user?.name ?? "—"}
          contractorId={user?.contractorId ?? ""}
          onClose={() => setReciboRec(null)}
        />
      )}

      {/* Modal Estornar */}
      {estornarId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Estornar recebimento</h3>
            <p className="text-sm text-gray-500 mb-6">O título voltará para <strong>Pendente</strong> e a transação financeira será removida. Confirmar?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEstornarId(null)} disabled={actLoading} className="text-sm font-bold text-gray-500 hover:underline">CANCELAR</button>
              <button onClick={() => handleEstornar(estornarId)} disabled={actLoading}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg disabled:opacity-60">
                {actLoading ? "Estornando..." : "CONFIRMAR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelar */}
      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Cancelar cobrança?</h3>
            <p className="text-sm text-gray-500 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCancelId(null)} disabled={actLoading} className="text-sm font-bold text-gray-500 hover:underline">CANCELAR</button>
              <button onClick={() => handleCancel(cancelId)} disabled={actLoading}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg disabled:opacity-60">
                {actLoading ? "Cancelando..." : "CONFIRMAR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {payTarget && <RegistrarPagamentoModal receivable={payTarget} onClose={() => setPayTarget(null)} onSaved={load} />}

      {showNovaReceita && (
        <NovaReceitaModal
          onClose={() => setShowNovaReceita(false)}
          onSaved={load}
          centros={centros}
          categorias={categorias}
          subcategorias={subcategorias}
          contas={contas}
          contractorId={user?.contractorId ?? ""}
        />
      )}

      {receberTarget && (
        <ReceberModal
          r={receberTarget}
          onClose={() => setReceberTarget(null)}
          onSaved={load}
        />
      )}
    </>
  );
}
