import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ChevronLeft, ChevronRight, X, Pencil, Landmark, MoreVertical, FileText, TrendingUp, Trash2, Loader2 } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── Bancos ─────────────────────────────────────────────────────────── */
const BANCOS_BR = [
  { codigo: "1",   nome: "Banco do Brasil S.A." },
  { codigo: "3",   nome: "Banco da Amazônia S.A." },
  { codigo: "4",   nome: "Banco do Nordeste do Brasil S.A." },
  { codigo: "7",   nome: "BNDES" },
  { codigo: "10",  nome: "Credicoamo Crédito Rural Cooperativa" },
  { codigo: "21",  nome: "Banestes S.A." },
  { codigo: "33",  nome: "Banco Santander" },
  { codigo: "37",  nome: "Banco do Estado do Pará S.A." },
  { codigo: "41",  nome: "Banco do Estado do Rio Grande do Sul S.A." },
  { codigo: "47",  nome: "Banco do Estado de Sergipe S.A." },
  { codigo: "69",  nome: "Banco Crefisa S.A." },
  { codigo: "70",  nome: "Banco de Brasília S.A." },
  { codigo: "104", nome: "Caixa Econômica Federal" },
  { codigo: "107", nome: "Banco BOCOM BBM S.A." },
  { codigo: "120", nome: "Banco Rodobens S.A." },
  { codigo: "121", nome: "Banco Agibank S.A." },
  { codigo: "133", nome: "Cresol Confederação" },
  { codigo: "136", nome: "Unicred" },
  { codigo: "139", nome: "Intesa Sanpaolo Brasil S.A." },
  { codigo: "197", nome: "Stone Pagamentos S.A." },
  { codigo: "208", nome: "Banco BTG Pactual S.A." },
  { codigo: "212", nome: "Banco Original S.A." },
  { codigo: "217", nome: "Banco John Deere S.A." },
  { codigo: "218", nome: "Banco BS2 S.A." },
  { codigo: "222", nome: "Banco Credit Agricole Brasil S.A." },
  { codigo: "224", nome: "Banco Fibra S.A." },
  { codigo: "233", nome: "Banco Cifra S.A." },
  { codigo: "237", nome: "Banco Bradesco S.A." },
  { codigo: "241", nome: "Banco Clássico S.A." },
  { codigo: "243", nome: "Banco Máxima S.A." },
  { codigo: "246", nome: "Banco ABC Brasil S.A." },
  { codigo: "260", nome: "Nu Pagamentos S.A. (Nubank)" },
  { codigo: "290", nome: "Pagseguro Internet S.A." },
  { codigo: "318", nome: "Banco BMG S.A." },
  { codigo: "341", nome: "Itaú Unibanco S.A." },
  { codigo: "348", nome: "Banco XP S.A." },
  { codigo: "376", nome: "Banco J. P. Morgan S.A." },
  { codigo: "389", nome: "Banco Mercantil do Brasil S.A." },
  { codigo: "422", nome: "Banco Safra S.A." },
  { codigo: "477", nome: "Citibank N.A." },
  { codigo: "505", nome: "Banco Credit Suisse (Brasil) S.A." },
  { codigo: "600", nome: "Banco Luso Brasileiro S.A." },
  { codigo: "611", nome: "Banco Paulista S.A." },
  { codigo: "623", nome: "Banco Pan S.A." },
  { codigo: "626", nome: "Banco C6 S.A." },
  { codigo: "633", nome: "Banco Rendimento S.A." },
  { codigo: "637", nome: "Banco Sofisa S.A." },
  { codigo: "707", nome: "Banco Daycoval S.A." },
  { codigo: "741", nome: "Banco Ribeirão Preto S.A." },
  { codigo: "746", nome: "Banco Modal S.A." },
  { codigo: "748", nome: "Sicredi" },
  { codigo: "756", nome: "Banco Sicoob S.A." },
];

/* ── Types ───────────────────────────────────────────────────────────── */
interface ContaFinanceira {
  id: string;
  descricao: string;
  tipo: "conta_corrente" | "conta_poupanca" | "outro";
  banco_codigo: string | null;
  banco_nome: string | null;
  agencia: string | null;
  agencia_digito: string | null;
  conta: string | null;
  conta_digito: string | null;
  titular_diferente: boolean;
  titular_nome: string | null;
  titular_cpf: string | null;
  ativo: boolean;
  created_at: string;
}

interface ContaForm {
  descricao: string;
  tipo: string;
  banco_codigo: string;
  banco_nome: string;
  agencia: string;
  agencia_digito: string;
  conta: string;
  conta_digito: string;
  titular_diferente: boolean;
  titular_nome: string;
  titular_cpf: string;
}

const TIPO_BADGE: Record<string, { label: string; cls: string }> = {
  conta_corrente: { label: "Conta corrente", cls: "bg-blue-100 text-blue-700" },
  conta_poupanca: { label: "Conta poupança", cls: "bg-green-100 text-green-700" },
  outro:          { label: "Outro",          cls: "bg-gray-100 text-gray-500" },
};

const PAGE_SIZE = 20;

/* ── Banco Dropdown ──────────────────────────────────────────────────── */
function BancoDropdown({
  value,
  onChange,
}: {
  value: { codigo: string; nome: string };
  onChange: (banco: { codigo: string; nome: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtrados = BANCOS_BR.filter(b =>
    b.codigo.includes(busca) || b.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const label = value.codigo ? `${value.codigo} - ${value.nome}` : "Escolha o banco";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      >
        <span className={value.codigo ? "text-gray-900" : "text-gray-400"}>{label}</span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              placeholder="Buscar banco..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtrados.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Nenhum banco encontrado</p>
            ) : (
              filtrados.map(b => (
                <button
                  key={b.codigo}
                  type="button"
                  onClick={() => { onChange(b); setOpen(false); setBusca(""); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 hover:text-primary transition-colors"
                >
                  {b.codigo} - {b.nome}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Modal Novo/Editar ───────────────────────────────────────────────── */
function ContaModal({
  onClose,
  onSaved,
  editing,
}: {
  onClose: () => void;
  onSaved: () => void;
  editing?: ContaFinanceira | null;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<ContaForm>({
    descricao:         editing?.descricao         ?? "",
    tipo:              editing?.tipo              ?? "",
    banco_codigo:      editing?.banco_codigo      ?? "",
    banco_nome:        editing?.banco_nome        ?? "",
    agencia:           editing?.agencia           ?? "",
    agencia_digito:    editing?.agencia_digito    ?? "",
    conta:             editing?.conta             ?? "",
    conta_digito:      editing?.conta_digito      ?? "",
    titular_diferente: editing?.titular_diferente ?? false,
    titular_nome:      editing?.titular_nome      ?? "",
    titular_cpf:       editing?.titular_cpf       ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof ContaForm>(k: K, v: ContaForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function maskCpf(v: string) {
    return v.replace(/\D/g, "").slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  async function handleSave() {
    if (!user?.contractorId) return;
    if (!form.descricao.trim() || !form.tipo) {
      toast.error("Preencha os campos obrigatórios: Descrição e Tipo.");
      return;
    }
    setSaving(true);
    const payload = {
      contractor_id:     user.contractorId,
      descricao:         form.descricao.trim(),
      tipo:              form.tipo as "conta_corrente" | "conta_poupanca" | "outro",
      banco_codigo:      form.banco_codigo || null,
      banco_nome:        form.banco_nome   || null,
      agencia:           form.agencia      || null,
      agencia_digito:    form.agencia_digito || null,
      conta:             form.conta        || null,
      conta_digito:      form.conta_digito || null,
      titular_diferente: form.titular_diferente,
      titular_nome:      form.titular_diferente ? form.titular_nome.trim() || null : null,
      titular_cpf:       form.titular_diferente ? form.titular_cpf.trim()  || null : null,
    };
    const { error } = editing
      ? await supabase.from("contas_financeiras").update(payload).eq("id", editing.id)
      : await supabase.from("contas_financeiras").insert(payload);
    if (error) { toast.error("Erro ao salvar conta."); setSaving(false); return; }
    toast.success(editing ? "Conta atualizada com sucesso." : "Conta cadastrada com sucesso.");
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Landmark className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-base font-bold text-gray-900">
              {editing ? "Editar conta financeira" : "Nova conta financeira"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição *</label>
              <input
                type="text"
                value={form.descricao}
                onChange={e => set("descricao", e.target.value)}
                placeholder="Ex: Nubank PJ"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo *</label>
              <select
                value={form.tipo}
                onChange={e => set("tipo", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Selecione...</option>
                <option value="conta_corrente">Conta corrente</option>
                <option value="conta_poupanca">Conta poupança</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Banco</label>
            <BancoDropdown
              value={{ codigo: form.banco_codigo, nome: form.banco_nome }}
              onChange={b => { set("banco_codigo", b.codigo); set("banco_nome", b.nome); }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Agência</label>
              <input
                type="text" value={form.agencia}
                onChange={e => set("agencia", e.target.value)}
                placeholder="0000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Dígito</label>
              <input
                type="text" value={form.agencia_digito}
                onChange={e => set("agencia_digito", e.target.value.slice(0, 1))}
                placeholder="0" maxLength={1}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Conta</label>
              <input
                type="text" value={form.conta}
                onChange={e => set("conta", e.target.value)}
                placeholder="00000000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Dígito</label>
              <input
                type="text" value={form.conta_digito}
                onChange={e => set("conta_digito", e.target.value.slice(0, 2))}
                placeholder="0" maxLength={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 py-1">
            <button
              type="button"
              onClick={() => set("titular_diferente", !form.titular_diferente)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                form.titular_diferente ? "bg-primary" : "bg-gray-200"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                form.titular_diferente ? "translate-x-4" : "translate-x-0"
              }`} />
            </button>
            <span className="text-sm text-gray-600">O titular da conta é diferente?</span>
          </div>

          {form.titular_diferente && (
            <div className="grid grid-cols-2 gap-4 pt-1 border-t border-gray-100">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome do titular</label>
                <input
                  type="text" value={form.titular_nome}
                  onChange={e => set("titular_nome", e.target.value)}
                  placeholder="Nome completo"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">CPF</label>
                <input
                  type="text" value={form.titular_cpf}
                  onChange={e => set("titular_cpf", maskCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 pb-5 sticky bottom-0 bg-white border-t border-gray-100 pt-4">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-800 px-3 py-2 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave} disabled={saving}
            className="bg-primary text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Extrato da Conta ────────────────────────────────────────────────── */
function ExtratoModal({
  conta,
  onClose,
  contractorId,
}: {
  conta: ContaFinanceira;
  onClose: () => void;
  contractorId: string;
}) {
  interface Movimento {
    id: string;
    tipo: "entrada" | "saida";
    descricao: string;
    valor: number;
    data: string;
    forma_pagamento: string | null;
  }

  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | "entrada" | "saida">("todos");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: rec }, { data: pay }] = await Promise.all([
        supabase
          .from("receivables")
          .select("id, descricao, valor, pago_em, forma_recebimento, modo")
          .eq("contractor_id", contractorId)
          .eq("conta_financeira_id", conta.id)
          .eq("status", "pago")
          .not("pago_em", "is", null),
        supabase
          .from("payables")
          .select("id, descricao, valor_pago, valor, pago_em, forma_pagamento")
          .eq("contractor_id", contractorId)
          .eq("conta_financeira_id", conta.id)
          .eq("status", "pago")
          .not("pago_em", "is", null),
      ]);

      const entradas: Movimento[] = (rec ?? []).map((r: any) => ({
        id: r.id,
        tipo: "entrada" as const,
        descricao: r.descricao ?? "Recebimento",
        valor: r.valor ?? 0,
        data: r.pago_em,
        forma_pagamento: r.forma_recebimento,
      }));

      const saidas: Movimento[] = (pay ?? []).map((p: any) => ({
        id: p.id,
        tipo: "saida" as const,
        descricao: p.descricao ?? "Pagamento",
        valor: p.valor_pago ?? p.valor ?? 0,
        data: p.pago_em,
        forma_pagamento: p.forma_pagamento,
      }));

      const all = [...entradas, ...saidas].sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      );
      setMovimentos(all);
      setLoading(false);
    }
    load();
  }, [conta.id, contractorId]);

  const filtered = movimentos.filter(m => filtro === "todos" || m.tipo === filtro);

  const totalEntradas = movimentos.filter(m => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
  const totalSaidas   = movimentos.filter(m => m.tipo === "saida").reduce((s, m) => s + m.valor, 0);
  const saldo         = totalEntradas - totalSaidas;

  function fmt(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  function fmtData(s: string) {
    return new Date(s + "T12:00:00").toLocaleDateString("pt-BR");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <p className="text-base font-bold text-gray-900">Extrato</p>
              <p className="text-xs text-gray-400">{conta.descricao}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-gray-100">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-0.5">Total entradas</p>
            <p className="text-base font-bold text-green-600">{fmt(totalEntradas)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-0.5">Total saídas</p>
            <p className="text-base font-bold text-red-500">{fmt(totalSaidas)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-0.5">Saldo líquido</p>
            <p className={`text-base font-bold ${saldo >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(saldo)}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-6 pt-3">
          {(["todos", "entrada", "saida"] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${filtro === f ? "bg-primary text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              {f === "todos" ? "Todos" : f === "entrada" ? "Entradas" : "Saídas"}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <FileText className="w-10 h-10 text-gray-200" />
              <p className="text-sm text-gray-400">Nenhuma movimentação registrada nesta conta.</p>
            </div>
          ) : (
            filtered.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.tipo === "entrada" ? "bg-green-100" : "bg-red-100"}`}>
                    {m.tipo === "entrada"
                      ? <ArrowUpCircle className="w-4 h-4 text-green-600" />
                      : <ArrowDownCircle className="w-4 h-4 text-red-500" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{m.descricao}</p>
                    <p className="text-xs text-gray-400">
                      {fmtData(m.data)}{m.forma_pagamento ? ` • ${m.forma_pagamento}` : ""}
                    </p>
                  </div>
                </div>
                <p className={`text-sm font-bold ${m.tipo === "entrada" ? "text-green-600" : "text-red-500"}`}>
                  {m.tipo === "entrada" ? "+" : "-"}{fmt(m.valor)}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
          {filtered.length} movimentação{filtered.length !== 1 ? "ões" : ""} exibida{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function ContasFinanceirasPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [all, setAll]             = useState<ContaFinanceira[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<ContaFinanceira | null>(null);
  const [menuOpenId,    setMenuOpenId]   = useState<string | null>(null);
  const [menuPos,       setMenuPos]      = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const [removeTarget,  setRemoveTarget] = useState<ContaFinanceira | null>(null);
  const [removing,      setRemoving]     = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleRemover() {
    if (!removeTarget) return;
    setRemoving(true);
    const { error } = await supabase.from("contas_financeiras").update({ ativo: false }).eq("id", removeTarget.id);
    setRemoving(false);
    if (error) { toast.error("Erro ao remover conta."); return; }
    toast.success("Conta removida.");
    setRemoveTarget(null);
    load();
  }

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);
    const { data } = await supabase
      .from("contas_financeiras")
      .select("*")
      .eq("contractor_id", user.contractorId)
      .order("descricao", { ascending: true });
    setAll((data ?? []) as ContaFinanceira[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  const filtered = all.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.descricao.toLowerCase().includes(q) || (r.banco_nome ?? "").toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-900 flex-shrink-0">Contas financeiras</h1>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por descrição ou banco"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" /> CONTA FINANCEIRA
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto bg-gray-50 px-8 py-6">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Landmark className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400 font-medium">
                    {all.length === 0 ? "Nenhuma conta financeira cadastrada." : "Nenhum resultado encontrado."}
                  </p>
                  {all.length === 0 && (
                    <button onClick={() => setShowModal(true)} className="text-xs font-semibold text-primary hover:underline">
                      Adicionar primeira conta →
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold">
                        <th className="text-left px-6 py-3">Descrição</th>
                        <th className="text-left px-4 py-3">Banco</th>
                        <th className="text-left px-4 py-3">Tipo</th>
                        <th className="text-left px-4 py-3">Agência</th>
                        <th className="text-left px-4 py-3">Conta</th>
                        <th className="text-left px-4 py-3">Status</th>
                        <th className="px-4 py-3 w-20"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginated.map(r => {
                        const badge = TIPO_BADGE[r.tipo] ?? TIPO_BADGE.outro;
                        return (
                          <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3 font-medium text-gray-900">{r.descricao}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {r.banco_nome ? `${r.banco_codigo} - ${r.banco_nome}` : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {r.agencia ? `${r.agencia}${r.agencia_digito ? `-${r.agencia_digito}` : ""}` : "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {r.conta ? `${r.conta}${r.conta_digito ? `-${r.conta_digito}` : ""}` : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                                {r.ativo ? "Ativa" : "Inativa"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end">
                                <button
                                  onClick={e => {
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                    setMenuOpenId(prev => prev === r.id ? null : r.id);
                                  }}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Paginação */}
                  <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
                    <span>Página {page} de {totalPages} — {filtered.length} conta{filtered.length !== 1 ? "s" : ""}</span>
                    <div className="flex items-center gap-1">
                      <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
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
      </AppLayout>

      {/* Dropdown 3-pontinhos — fixed fora do overflow da tabela */}
      {menuOpenId && (
        <>
          {/* Overlay invisível para fechar ao clicar fora */}
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
          <div
            ref={menuRef}
            className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-2xl w-52 py-1 overflow-hidden"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <button
              onClick={() => {
                const r = all.find(c => c.id === menuOpenId);
                if (r) setEditing(r);
                setMenuOpenId(null);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5"
            >
              <Pencil className="w-4 h-4 text-gray-400" />
              Editar
            </button>
            <button
              onClick={() => {
                navigate(`/app/financeiro/contas-financeiras/${menuOpenId}/extrato`);
                setMenuOpenId(null);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5"
            >
              <FileText className="w-4 h-4 text-gray-400" />
              Extrato
            </button>
            <button
              disabled
              className="w-full text-left px-4 py-2.5 text-sm text-gray-300 flex items-center gap-2.5 cursor-not-allowed"
            >
              <TrendingUp className="w-4 h-4 text-gray-200" />
              Antecipar recebíveis
              <span className="ml-auto text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">em breve</span>
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => {
                const r = all.find(c => c.id === menuOpenId);
                if (r) setRemoveTarget(r);
                setMenuOpenId(null);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2.5"
            >
              <Trash2 className="w-4 h-4" />
              Remover
            </button>
          </div>
        </>
      )}

      {/* Modal cadastro/edição */}
      {(showModal || editing) && (
        <ContaModal
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={load}
          editing={editing}
        />
      )}

      {/* Confirm Remover */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Remover conta?</h3>
                <p className="text-sm text-gray-500">{removeTarget.descricao}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              A conta será desativada e não aparecerá mais nas opções de pagamento/recebimento.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRemoveTarget(null)} className="text-primary font-semibold text-sm hover:underline px-2">
                CANCELAR
              </button>
              <button
                onClick={handleRemover}
                disabled={removing}
                className="bg-red-500 text-white font-semibold text-sm px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-60 transition-colors flex items-center gap-2"
              >
                {removing && <Loader2 className="w-4 h-4 animate-spin" />}
                REMOVER
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
