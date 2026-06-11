import { useState, useEffect, useRef } from "react";
import {
  Plus, Search, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Clock,
  X, Paperclip, ChevronDown, Loader2, DollarSign,
} from "lucide-react";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── Types ──────────────────────────────────────────────────────────── */
type StatusFilter = "todos" | "pendente" | "atrasado" | "pago" | "cancelado";
type ModalTipo    = "conta_a_pagar" | "despesa_paga";

interface Payable {
  id:                   string;
  descricao:            string;
  categoria:            string;       // legado (campo texto)
  categoria_id:         string | null;
  subcategoria_id:      string | null;
  centro_custo_id:      string | null;
  conta_financeira_id:  string | null;
  fornecedor:           string | null;
  valor:                number;
  vencimento:           string;
  data_competencia:     string | null;
  status:               "pendente" | "pago" | "atrasado" | "cancelado";
  forma_pagamento:      string | null;
  valor_pago:           number | null;
  pago_em:              string | null;
  hora_pagamento:       string | null;
  observacoes:          string | null;
  anexo_url:            string | null;
  tipo:                 string | null;
  created_at:           string;
}

interface CategoriaDespesa {
  id:              string;
  nome:            string;
  centro_custo_id: string | null;
}
interface SubcategoriaDespesa { id: string; nome: string; categoria_id: string; }
interface CentroCusto         { id: string; descricao: string; }
interface ContaFinanceira     { id: string; descricao: string; tipo: string; }

/* ── Helpers ────────────────────────────────────────────────────────── */
const TODAY = new Date().toISOString().split("T")[0];

function effectiveStatus(r: Payable): "pendente" | "pago" | "atrasado" | "cancelado" {
  if (r.status === "pendente" && r.vencimento < TODAY) return "atrasado";
  return r.status;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pendente:  { label: "Pendente",  cls: "bg-yellow-100 text-yellow-700" },
  atrasado:  { label: "Atrasado",  cls: "bg-red-100 text-red-600" },
  pago:      { label: "Pago",      cls: "bg-green-100 text-green-700" },
  cancelado: { label: "Cancelado", cls: "bg-gray-100 text-gray-500" },
};

const FORMAS_PGTO = ["Dinheiro", "PIX", "Débito", "Crédito", "Transferência", "Boleto", "Cheque"];

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtData(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("pt-BR");
}

const PAGE_SIZE = 20;

const INPUT_CLS = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white";
const LABEL_CLS = "block text-xs font-semibold text-gray-500 mb-1";

/* ── Fornecedor lookup ───────────────────────────────────────────────── */
interface FornecedorLookup {
  id: string;
  nome: string;
  centro_custo_id: string | null;
  categoria_id: string | null;
  subcategoria_id: string | null;
  forma_pagamento_padrao: string | null;
}

function FornecedorPicker({
  value, onChange, onSelectFull, contractorId,
}: {
  value: string;
  onChange: (nome: string) => void;
  onSelectFull?: (f: FornecedorLookup) => void;
  contractorId: string;
}) {
  const [fornecedores, setFornecedores] = useState<FornecedorLookup[]>([]);
  const [search,       setSearch]       = useState(value);
  const [open,         setOpen]         = useState(false);
  const [showQuick,    setShowQuick]    = useState(false);
  const [quickNome,    setQuickNome]    = useState("");
  const [savingQuick,  setSavingQuick]  = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contractorId) return;
    supabase.from("fornecedores")
      .select("id, nome, centro_custo_id, categoria_id, subcategoria_id, forma_pagamento_padrao")
      .eq("contractor_id", contractorId)
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setFornecedores((data ?? []) as FornecedorLookup[]));
  }, [contractorId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Sync search with parent value when editing
  useEffect(() => { setSearch(value); }, [value]);

  const filtered = search
    ? fornecedores.filter(f => f.nome.toLowerCase().includes(search.toLowerCase()))
    : fornecedores;

  async function handleQuickSave() {
    if (!quickNome.trim()) return;
    setSavingQuick(true);
    const { data, error } = await supabase.from("fornecedores")
      .insert({ contractor_id: contractorId, nome: quickNome.trim(), tipo: "pessoa_juridica" })
      .select("id, nome").maybeSingle();
    setSavingQuick(false);
    if (error || !data) { return; }
    setFornecedores(prev => [...prev, data as FornecedorLookup].sort((a,b) => a.nome.localeCompare(b.nome)));
    setSearch(data.nome);
    onChange(data.nome);
    setShowQuick(false);
    setQuickNome("");
    setOpen(false);
  }

  const INPUT_F = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white";

  return (
    <div ref={ref} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            className={INPUT_F + " pl-8"}
            placeholder="Buscar ou digitar nome..."
            value={search}
            onChange={e => { setSearch(e.target.value); onChange(e.target.value); setOpen(true); }}
            onClick={() => setOpen(true)}
          />
        </div>
        <button
          type="button"
          title="Cadastrar novo fornecedor"
          onClick={() => { setShowQuick(true); setQuickNome(search); setOpen(false); }}
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Dropdown de sugestões */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-400 flex items-center justify-between">
              <span>Nenhum fornecedor encontrado</span>
              <button onClick={() => { setShowQuick(true); setQuickNome(search); setOpen(false); }}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Criar "{search}"
              </button>
            </div>
          ) : (
            filtered.map(f => (
              <button key={f.id}
                onClick={() => {
                  setSearch(f.nome);
                  onChange(f.nome);
                  onSelectFull?.(f);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
                <span className="flex-1">{f.nome}</span>
                {f.categoria_id && <span className="text-[10px] bg-orange-50 text-orange-500 px-1.5 py-0.5 rounded-full font-semibold">AUTO</span>}
              </button>
            ))
          )}
        </div>
      )}

      {/* Mini-modal cadastro rápido */}
      {showQuick && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-80">
          <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Novo fornecedor (rápido)
          </p>
          <input
            autoFocus
            className={INPUT_F}
            placeholder="Nome do fornecedor..."
            value={quickNome}
            onChange={e => setQuickNome(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleQuickSave()}
          />
          <p className="text-xs text-gray-400 mt-1 mb-3">
            Para mais detalhes, acesse <strong>Configurações → Fornecedores</strong>.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setShowQuick(false)}
              className="flex-1 py-1.5 text-sm text-gray-500 hover:text-gray-700 font-semibold">
              Cancelar
            </button>
            <button onClick={handleQuickSave} disabled={savingQuick || !quickNome.trim()}
              className="flex-1 py-1.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1">
              {savingQuick ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {savingQuick ? "Salvando..." : "Cadastrar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Lançar/Editar Modal ─────────────────────────────────────────────── */
interface PayableForm {
  tipo:                ModalTipo;
  descricao:           string;
  fornecedor:          string;
  valor:               string;
  vencimento:          string;
  data_competencia:    string;
  data_pagamento:      string; // pago_em quando despesa_paga
  hora_pagamento:      string;
  forma_pagamento:     string;
  conta_financeira_id: string;
  centro_custo_id:     string;
  categoria_id:        string;
  subcategoria_id:     string;
  observacoes:         string;
}

function LancarPayableModal({
  onClose,
  onSaved,
  editing,
  categorias,
  subcategorias,
  centros,
  contas,
  contractorId,
}: {
  onClose:        () => void;
  onSaved:        () => void;
  editing?:       Payable | null;
  categorias:     CategoriaDespesa[];
  subcategorias:  SubcategoriaDespesa[];
  centros:        CentroCusto[];
  contas:         ContaFinanceira[];
  contractorId:   string;
}) {
  const { user } = useAuth();

  const [form, setForm] = useState<PayableForm>({
    tipo:                (editing?.tipo === "despesa_paga" ? "despesa_paga" : "conta_a_pagar") as ModalTipo,
    descricao:           editing?.descricao           ?? "",
    fornecedor:          editing?.fornecedor           ?? "",
    valor:               editing?.valor?.toString().replace(".", ",") ?? "",
    vencimento:          editing?.vencimento           ?? "",
    data_competencia:    editing?.data_competencia     ?? "",
    data_pagamento:      editing?.pago_em              ?? TODAY,
    hora_pagamento:      editing?.hora_pagamento        ?? new Date().toTimeString().slice(0, 5),
    forma_pagamento:     editing?.forma_pagamento      ?? "",
    conta_financeira_id: editing?.conta_financeira_id  ?? "",
    centro_custo_id:     editing?.centro_custo_id      ?? "",
    categoria_id:        editing?.categoria_id         ?? "",
    subcategoria_id:     editing?.subcategoria_id      ?? "",
    observacoes:         editing?.observacoes          ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof PayableForm>(k: K, v: PayableForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  // Ao selecionar categoria → auto-preenche centro de custo
  function handleCategoriaChange(catId: string) {
    set("categoria_id", catId);
    set("subcategoria_id", "");
    const cat = categorias.find(c => c.id === catId);
    if (cat?.centro_custo_id) {
      set("centro_custo_id", cat.centro_custo_id);
    }
  }

  const subsFiltradas = subcategorias.filter(s => s.categoria_id === form.categoria_id);

  async function handleSave() {
    if (!user?.contractorId) return;

    if (!form.descricao.trim()) { toast.error("Informe a descrição."); return; }
    if (!form.valor)            { toast.error("Informe o valor."); return; }

    if (form.tipo === "conta_a_pagar" && !form.vencimento) {
      toast.error("Informe a data de vencimento."); return;
    }
    if (form.tipo === "despesa_paga" && !form.data_pagamento) {
      toast.error("Informe a data do pagamento."); return;
    }
    if (form.tipo === "despesa_paga" && !form.forma_pagamento) {
      toast.error("Informe a forma de pagamento."); return;
    }

    const valor = parseFloat(form.valor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) { toast.error("Valor inválido."); return; }

    setSaving(true);

    const isPago = form.tipo === "despesa_paga";
    const payload: Record<string, unknown> = {
      contractor_id:       user.contractorId,
      tipo:                form.tipo,
      descricao:           form.descricao.trim(),
      fornecedor:          form.fornecedor.trim() || null,
      categoria:           categorias.find(c => c.id === form.categoria_id)?.nome ?? "Outros",
      categoria_id:        form.categoria_id   || null,
      subcategoria_id:     form.subcategoria_id || null,
      centro_custo_id:     form.centro_custo_id || null,
      conta_financeira_id: form.conta_financeira_id || null,
      valor,
      vencimento:          isPago ? form.data_pagamento : form.vencimento,
      data_competencia:    form.data_competencia || null,
      observacoes:         form.observacoes.trim() || null,
      status:              isPago ? "pago" : "pendente",
      ...(isPago ? {
        valor_pago:      valor,
        pago_em:         form.data_pagamento,
        hora_pagamento:  form.hora_pagamento || null,
        forma_pagamento: form.forma_pagamento || null,
      } : {
        forma_pagamento: form.forma_pagamento || null,
      }),
    };

    const { error } = editing
      ? await supabase.from("payables").update(payload).eq("id", editing.id)
      : await supabase.from("payables").insert(payload);

    if (error) { toast.error("Erro ao salvar."); setSaving(false); return; }
    toast.success(editing ? "Conta atualizada." : isPago ? "Despesa registrada." : "Conta lançada.");
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">
            {editing ? "Editar lançamento" : "Novo lançamento"}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>

        {/* Toggle tipo */}
        {!editing && (
          <div className="px-6 pt-4 flex-shrink-0">
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
              <button
                onClick={() => set("tipo", "conta_a_pagar")}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  form.tipo === "conta_a_pagar"
                    ? "bg-white text-primary shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Conta a pagar
              </button>
              <button
                onClick={() => set("tipo", "despesa_paga")}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  form.tipo === "despesa_paga"
                    ? "bg-white text-green-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Despesa já paga
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1 ml-1">
              {form.tipo === "conta_a_pagar"
                ? "Para obrigações futuras ou em aberto (aluguel, salários, DAS…)"
                : "Para gastos já realizados (compras, diárias, peças…)"}
            </p>
          </div>
        )}

        {/* Body — scrollável */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

          {/* Descrição */}
          <div>
            <label className={LABEL_CLS}>Descrição *</label>
            <input
              type="text"
              value={form.descricao}
              onChange={e => set("descricao", e.target.value)}
              placeholder={form.tipo === "despesa_paga" ? "Ex: Compra de material de limpeza" : "Ex: Aluguel de fevereiro"}
              className={INPUT_CLS}
            />
          </div>

          {/* Fornecedor + Valor */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Fornecedor / Favorecido</label>
              <FornecedorPicker
                value={form.fornecedor}
                onChange={v => set("fornecedor", v)}
                onSelectFull={f => {
                  // auto-fill padrões do fornecedor
                  setForm(prev => {
                    const next = { ...prev };
                    if (f.categoria_id) {
                      next.categoria_id = f.categoria_id;
                      next.subcategoria_id = f.subcategoria_id ?? "";
                    }
                    if (f.centro_custo_id) next.centro_custo_id = f.centro_custo_id;
                    if (f.forma_pagamento_padrao) next.forma_pagamento = f.forma_pagamento_padrao;
                    return next;
                  });
                  if (f.categoria_id || f.centro_custo_id || f.forma_pagamento_padrao) {
                    toast.success("Padrões do fornecedor preenchidos automaticamente", { duration: 2500 });
                  }
                }}
                contractorId={contractorId}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Valor (R$) *</label>
              <CurrencyInput
                value={form.valor}
                onChange={v => set("valor", v)}
                placeholder="0,00"
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Datas */}
          {form.tipo === "conta_a_pagar" ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLS}>Vencimento *</label>
                <input type="date" value={form.vencimento} onChange={e => set("vencimento", e.target.value)} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Competência</label>
                <input type="date" value={form.data_competencia} onChange={e => set("data_competencia", e.target.value)} className={INPUT_CLS} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={LABEL_CLS}>Data do pagamento *</label>
                <input type="date" value={form.data_pagamento} onChange={e => set("data_pagamento", e.target.value)} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>
                  Horário
                  <span className="ml-1 text-gray-400 font-normal">(para conciliação)</span>
                </label>
                <input type="time" value={form.hora_pagamento} onChange={e => set("hora_pagamento", e.target.value)} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Competência</label>
                <input type="date" value={form.data_competencia} onChange={e => set("data_competencia", e.target.value)} className={INPUT_CLS} />
              </div>
            </div>
          )}

          {/* Forma de pagamento + Conta */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>
                Forma de pagamento{form.tipo === "despesa_paga" ? " *" : ""}
              </label>
              <div className="relative">
                <select
                  value={form.forma_pagamento}
                  onChange={e => set("forma_pagamento", e.target.value)}
                  className={INPUT_CLS + " appearance-none pr-8"}
                >
                  <option value="">Selecionar…</option>
                  {FORMAS_PGTO.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={LABEL_CLS}>Conta / Caixa</label>
              <div className="relative">
                <select
                  value={form.conta_financeira_id}
                  onChange={e => set("conta_financeira_id", e.target.value)}
                  className={INPUT_CLS + " appearance-none pr-8"}
                >
                  <option value="">Selecionar…</option>
                  {contas.map(c => (
                    <option key={c.id} value={c.id}>{c.descricao}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Divisor classificação */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Classificação</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Categoria → auto-fill Centro de Custo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Categoria de despesa</label>
              <div className="relative">
                <select
                  value={form.categoria_id}
                  onChange={e => handleCategoriaChange(e.target.value)}
                  className={INPUT_CLS + " appearance-none pr-8"}
                >
                  <option value="">Selecionar…</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={LABEL_CLS}>
                Centro de custo
                {form.categoria_id && centros.find(c => c.id === form.centro_custo_id) && (
                  <span className="ml-1 text-primary text-xs font-normal">(preenchido automaticamente)</span>
                )}
              </label>
              <div className="relative">
                <select
                  value={form.centro_custo_id}
                  onChange={e => set("centro_custo_id", e.target.value)}
                  className={INPUT_CLS + " appearance-none pr-8"}
                >
                  <option value="">Selecionar…</option>
                  {centros.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Subcategoria */}
          <div>
            <label className={LABEL_CLS}>Subcategoria</label>
            <div className="relative">
              <select
                value={form.subcategoria_id}
                onChange={e => set("subcategoria_id", e.target.value)}
                disabled={subsFiltradas.length === 0}
                className={INPUT_CLS + " appearance-none pr-8 disabled:opacity-50 disabled:cursor-not-allowed"}
              >
                <option value="">{form.categoria_id ? (subsFiltradas.length === 0 ? "Sem subcategorias" : "Selecionar…") : "Selecione uma categoria primeiro"}</option>
                {subsFiltradas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className={LABEL_CLS}>Observações</label>
            <textarea
              value={form.observacoes}
              onChange={e => set("observacoes", e.target.value)}
              rows={2}
              placeholder="Notas adicionais…"
              className={INPUT_CLS + " resize-none"}
            />
          </div>

          {/* Anexo (placeholder visual) */}
          <div>
            <label className={LABEL_CLS}>Anexo (boleto, nota fiscal, recibo)</label>
            <label className="flex items-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-400 cursor-pointer hover:border-primary hover:text-primary transition-colors">
              <Paperclip className="w-4 h-4 flex-shrink-0" />
              <span>Clique para anexar arquivo</span>
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-800 px-3 py-2">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`text-white text-sm font-semibold px-6 py-2 rounded-lg disabled:opacity-60 transition-colors ${
              form.tipo === "despesa_paga"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-primary hover:bg-primary/90"
            }`}
          >
            {saving ? "Salvando…" : editing ? "Salvar" : form.tipo === "despesa_paga" ? "Registrar despesa" : "Lançar conta"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Registrar Pagamento Modal ────────────────────────────────────────── */
function PagarModal({
  payable, onClose, onSaved, contas,
}: {
  payable: Payable; onClose: () => void; onSaved: () => void; contas: ContaFinanceira[];
}) {
  type TipoRetirada = "nao_retirar" | "caixa_aberto" | "conta_financeira";

  const [forma,          setForma]         = useState(payable.forma_pagamento ?? "PIX");
  const [tipoRetirada,   setTipoRetirada]  = useState<TipoRetirada>("conta_financeira");
  const [contaId,        setContaId]       = useState(payable.conta_financeira_id ?? "");
  const [dataHora,       setDataHora]      = useState(() => {
    const now = new Date();
    const d = now.toISOString().split("T")[0];
    const h = now.toTimeString().slice(0, 5);
    return `${d}T${h}`;
  });
  // Desconto
  const [aplicarDesconto, setAplicarDesconto] = useState(false);
  const [pctDesconto,     setPctDesconto]     = useState("0,00");
  // Multa
  const [aplicarMulta,    setAplicarMulta]    = useState(false);
  const [pctMulta,        setPctMulta]        = useState("0,00");
  // Anexo
  const [anexoUrl,        setAnexoUrl]        = useState<string | null>(payable.anexo_url ?? null);
  const [anexoNome,       setAnexoNome]       = useState<string | null>(null);
  const [uploading,       setUploading]       = useState(false);
  const [anexosOpen,      setAnexosOpen]      = useState(false);
  const [dragging,        setDragging]        = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);

  const valorOriginal = payable.valor;

  function parsePct(v: string): number {
    return parseFloat(v.replace(",", ".")) || 0;
  }

  const valorDesconto = aplicarDesconto ? valorOriginal * parsePct(pctDesconto) / 100 : 0;
  const valorMulta    = aplicarMulta    ? valorOriginal * parsePct(pctMulta)    / 100 : 0;
  const totalPagar    = Math.max(0, valorOriginal - valorDesconto + valorMulta);

  async function handleUpload(file: File) {
    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!ALLOWED.includes(file.type)) {
      toast.error("Formato não permitido. Use: JPG, PNG, PDF, DOC ou DOCX.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10 MB.");
      return;
    }
    setUploading(true);
    const ext  = file.name.split(".").pop();
    const path = `payables/${payable.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("financeiro-anexos")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error("Erro ao enviar arquivo.");
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage
      .from("financeiro-anexos")
      .getPublicUrl(path);
    setAnexoUrl(urlData.publicUrl);
    setAnexoNome(file.name);
    setUploading(false);
    toast.success("Comprovante anexado!");
  }

  async function handleRemoveAnexo() {
    if (!anexoUrl) return;
    // Extrai path do URL público
    const path = anexoUrl.split("/financeiro-anexos/")[1];
    if (path) await supabase.storage.from("financeiro-anexos").remove([path]);
    await supabase.from("payables").update({ anexo_url: null }).eq("id", payable.id);
    setAnexoUrl(null);
    setAnexoNome(null);
    toast.success("Anexo removido.");
  }

  async function handlePagar(pagarAgora: boolean) {
    if (pagarAgora) {
      if (!forma) { toast.error("Informe o método de pagamento."); return; }
    }
    setSaving(true);

    const [datePart, timePart] = dataHora.split("T");

    const updates: any = {
      forma_pagamento:     forma || null,
      conta_financeira_id: tipoRetirada === "conta_financeira" ? (contaId || null) : null,
      anexo_url:           anexoUrl,
    };

    if (pagarAgora) {
      updates.status         = "pago";
      updates.valor_pago     = totalPagar;
      updates.pago_em        = datePart;
      updates.hora_pagamento = timePart || null;
    }

    const { error } = await supabase.from("payables").update(updates).eq("id", payable.id);
    setSaving(false);
    if (error) { toast.error("Erro ao registrar pagamento."); return; }
    toast.success(pagarAgora ? "Pagamento registrado!" : "Dados salvos. Conta permanece pendente.");
    onSaved(); onClose();
  }

  const INP = INPUT_CLS + " appearance-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: "92vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-base font-bold text-gray-900">Pagar conta</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Seção Dados principais */}
          <div className="m-5 border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Dados principais</p>
            </div>
            <div className="p-4 space-y-4">
              {/* Linha 1: Descrição | Valor inicial | Método */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className={LABEL_CLS}>Descrição</label>
                  <p className="text-sm text-gray-700 font-medium truncate" title={payable.descricao}>{payable.descricao}</p>
                </div>
                <div>
                  <label className={LABEL_CLS}>Valor inicial</label>
                  <p className="text-sm font-bold text-gray-900">{fmtMoeda(valorOriginal)}</p>
                </div>
                <div>
                  <label className={LABEL_CLS}>Método de pagamento *</label>
                  <div className="relative">
                    <select value={forma} onChange={e => setForma(e.target.value)} className={INP}>
                      <option value="">Selecionar…</option>
                      {FORMAS_PGTO.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Tipo de retirada */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Tipo de retirada *</label>
                  <div className="relative">
                    <select value={tipoRetirada} onChange={e => setTipoRetirada(e.target.value as TipoRetirada)} className={INP}>
                      <option value="nao_retirar">Não retirar valor</option>
                      <option value="caixa_aberto">Retirar valor do caixa aberto</option>
                      <option value="conta_financeira">Retirar valor da conta financeira</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                {tipoRetirada === "conta_financeira" && (
                  <div>
                    <label className={LABEL_CLS}>Conta financeira *</label>
                    <div className="relative">
                      <select value={contaId} onChange={e => setContaId(e.target.value)} className={INP}>
                        <option value="">Selecionar…</option>
                        {contas.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>

              {/* Data/hora e Total */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Data do pagamento *</label>
                  <input
                    type="datetime-local"
                    value={dataHora}
                    onChange={e => setDataHora(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Total a pagar *</label>
                  <p className={`text-lg font-bold mt-1 ${totalPagar !== valorOriginal ? "text-primary" : "text-gray-900"}`}>
                    {fmtMoeda(totalPagar)}
                  </p>
                </div>
              </div>

              {/* Desconto */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAplicarDesconto(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-6 rounded-full flex items-center transition-colors relative ${aplicarDesconto ? "bg-green-500" : "bg-gray-200"}`}>
                      <div className={`absolute w-4 h-4 bg-white rounded-full shadow transition-all ${aplicarDesconto ? "left-5" : "left-1"}`} />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Aplicar desconto</span>
                  </div>
                </button>
                {aplicarDesconto && (
                  <div className="px-4 pb-4 pt-0 grid grid-cols-2 gap-3 border-t border-gray-100">
                    <div>
                      <label className={LABEL_CLS}>% desconto *</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={pctDesconto}
                          onChange={e => setPctDesconto(e.target.value.replace(/[^0-9,]/g, ""))}
                          className={INPUT_CLS + " pr-7"}
                          placeholder="0,00"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                      </div>
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Valor desconto *</label>
                      <p className="text-sm font-semibold text-green-600 mt-2">{fmtMoeda(valorDesconto)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Multa */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAplicarMulta(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-6 rounded-full flex items-center transition-colors relative ${aplicarMulta ? "bg-green-500" : "bg-gray-200"}`}>
                      <div className={`absolute w-4 h-4 bg-white rounded-full shadow transition-all ${aplicarMulta ? "left-5" : "left-1"}`} />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Aplicar multa</span>
                  </div>
                </button>
                {aplicarMulta && (
                  <div className="px-4 pb-4 pt-0 grid grid-cols-2 gap-3 border-t border-gray-100">
                    <div>
                      <label className={LABEL_CLS}>% multa *</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={pctMulta}
                          onChange={e => setPctMulta(e.target.value.replace(/[^0-9,]/g, ""))}
                          className={INPUT_CLS + " pr-7"}
                          placeholder="0,00"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                      </div>
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Valor multa *</label>
                      <p className="text-sm font-semibold text-red-500 mt-2">{fmtMoeda(valorMulta)}</p>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Seção Anexos */}
          <div className="mx-5 mb-5 border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setAnexosOpen(v => !v)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-gray-400" />
                Comprovante / Anexo
                <span className="text-gray-400 font-normal text-xs">(Opcional)</span>
                {anexoUrl && (
                  <span className="ml-1 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">1 anexo</span>
                )}
              </p>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${anexosOpen ? "rotate-180" : ""}`} />
            </button>

            {anexosOpen && (
              <div className="border-t border-gray-100 p-4">
                {/* Input file oculto */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
                />

                {/* Arquivo já anexado */}
                {anexoUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Paperclip className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {anexoNome ?? "Comprovante anexado"}
                      </p>
                      <a
                        href={anexoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Visualizar arquivo →
                      </a>
                    </div>
                    <button
                      onClick={handleRemoveAnexo}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                      title="Remover anexo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  /* Drop zone */
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragging(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) handleUpload(f);
                    }}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`
                      border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                      ${dragging ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/50 hover:bg-gray-50"}
                    `}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-gray-500">Enviando arquivo...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                          <Paperclip className="w-6 h-6 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-700">
                            Arraste o arquivo aqui ou{" "}
                            <span className="text-primary">clique para selecionar</span>
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            JPG, PNG, PDF, DOC, DOCX — máximo 10 MB
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={() => handlePagar(false)}
            disabled={saving}
            className="text-sm font-bold text-gray-500 hover:text-gray-800 px-4 py-2 transition-colors uppercase tracking-wide"
          >
            Pagar Depois
          </button>
          <button
            onClick={() => handlePagar(true)}
            disabled={saving}
            className="bg-green-600 text-white text-sm font-bold px-6 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors uppercase tracking-wide flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Pagar Agora
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */
export default function ContasPagarPage() {
  const { user } = useAuth();
  const [all, setAll]               = useState<Payable[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [page, setPage]             = useState(1);
  const [showLancar, setShowLancar] = useState(false);
  const [editing, setEditing]       = useState<Payable | null>(null);
  const [payTarget, setPayTarget]   = useState<Payable | null>(null);
  const [cancelId, setCancelId]     = useState<string | null>(null);

  // lookup data
  const [categorias,    setCategorias]    = useState<CategoriaDespesa[]>([]);
  const [subcategorias, setSubcategorias] = useState<SubcategoriaDespesa[]>([]);
  const [centros,       setCentros]       = useState<CentroCusto[]>([]);
  const [contas,        setContas]        = useState<ContaFinanceira[]>([]);

  async function loadLookups() {
    if (!user?.contractorId) return;
    const cid = user.contractorId;

    const [catRes, subRes, ccRes, cfRes] = await Promise.all([
      supabase.from("categorias_financeiras")
        .select("id, nome, centro_custo_id")
        .eq("contractor_id", cid)
        .not("centro_custo_id", "is", null)
        .order("nome"),
      supabase.from("subcategorias_financeiras")
        .select("id, nome, categoria_id")
        .eq("contractor_id", cid)
        .order("nome"),
      supabase.from("centros_custo")
        .select("id, descricao")
        .eq("contractor_id", cid)
        .order("descricao"),
      supabase.from("contas_financeiras")
        .select("id, descricao, tipo")
        .eq("contractor_id", cid)
        .eq("ativo", true)
        .order("descricao"),
    ]);

    setCategorias((catRes.data ?? []) as CategoriaDespesa[]);
    setSubcategorias((subRes.data ?? []) as SubcategoriaDespesa[]);
    setCentros((ccRes.data ?? []) as CentroCusto[]);
    setContas((cfRes.data ?? []) as ContaFinanceira[]);
  }

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);
    const { data } = await supabase
      .from("payables")
      .select("*")
      .eq("contractor_id", user.contractorId)
      .order("vencimento", { ascending: false });
    setAll((data ?? []) as Payable[]);
    setLoading(false);
  }

  useEffect(() => { load(); loadLookups(); }, [user]);

  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const totalAPagar  = all.filter(r => r.status === "pendente" && r.vencimento >= TODAY).reduce((s, r) => s + r.valor, 0);
  const totalAtrasado = all.filter(r => r.status === "pendente" && r.vencimento < TODAY).reduce((s, r) => s + r.valor, 0);
  const totalPagoMes = all.filter(r => r.status === "pago" && r.pago_em?.startsWith(mesAtual)).reduce((s, r) => s + (r.valor_pago ?? r.valor), 0);

  const filtered = all.filter(r => {
    const eff = effectiveStatus(r);
    if (statusFilter !== "todos" && eff !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const catNome = categorias.find(c => c.id === r.categoria_id)?.nome ?? r.categoria;
      const ccNome  = centros.find(c => c.id === r.centro_custo_id)?.descricao ?? "";
      return (
        r.descricao.toLowerCase().includes(q) ||
        catNome.toLowerCase().includes(q) ||
        ccNome.toLowerCase().includes(q) ||
        (r.fornecedor ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const TAB_COUNTS: Record<StatusFilter, number> = {
    todos:     all.length,
    pendente:  all.filter(r => r.status === "pendente" && r.vencimento >= TODAY).length,
    atrasado:  all.filter(r => r.status === "pendente" && r.vencimento < TODAY).length,
    pago:      all.filter(r => r.status === "pago").length,
    cancelado: all.filter(r => r.status === "cancelado").length,
  };

  async function handleCancel(id: string) {
    const { error } = await supabase.from("payables").update({ status: "cancelado" }).eq("id", id);
    if (error) { toast.error("Erro ao cancelar."); return; }
    toast.success("Conta cancelada.");
    setCancelId(null); load();
  }

  const modalProps = { categorias, subcategorias, centros, contas };

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-900 flex-shrink-0">Contas a pagar</h1>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar descrição, categoria, fornecedor…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="ml-auto flex items-center gap-2">
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
            {/* Cards */}
            <div className="grid grid-cols-3 gap-4 px-8 py-5">
              {[
                { label: "A pagar", value: totalAPagar,   color: "blue",  Icon: Clock,        textCls: "text-gray-900" },
                { label: "Em atraso", value: totalAtrasado, color: "red", Icon: TrendingDown,  textCls: "text-red-600" },
                { label: "Pago no mês", value: totalPagoMes, color: "green", Icon: TrendingUp, textCls: "text-green-600" },
              ].map(({ label, value, color, Icon, textCls }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg bg-${color}-50 flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 text-${color}-500`} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">{label}</p>
                      <p className={`text-lg font-bold ${textCls}`}>{fmtMoeda(value)}</p>
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
                    <button
                      key={tab}
                      onClick={() => { setStatusFilter(tab); setPage(1); }}
                      className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
                        statusFilter === tab ? "text-primary border-b-2 border-primary" : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      {{ todos:"Todos", pendente:"Pendente", atrasado:"Atrasado", pago:"Pago", cancelado:"Cancelado" }[tab]}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        statusFilter === tab ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"
                      }`}>
                        {TAB_COUNTS[tab]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="px-8 pb-8">
              <div className="bg-white rounded-b-xl border border-gray-200 border-t-0 overflow-hidden">
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <CheckCircle className="w-10 h-10 text-gray-200" />
                    <p className="text-sm text-gray-400">
                      {all.length === 0 ? "Nenhuma conta lançada ainda." : "Nenhum resultado encontrado."}
                    </p>
                    {all.length === 0 && (
                      <button onClick={() => setShowLancar(true)} className="text-xs font-semibold text-primary hover:underline">
                        Lançar primeira conta →
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold">
                          <th className="text-left px-6 py-3">Descrição</th>
                          <th className="text-left px-4 py-3">Fornecedor</th>
                          <th className="text-left px-4 py-3">Centro de custo</th>
                          <th className="text-left px-4 py-3">Categoria</th>
                          <th className="text-left px-4 py-3">Vencimento / Pago em</th>
                          <th className="text-right px-4 py-3">Valor</th>
                          <th className="text-left px-4 py-3">Status</th>
                          <th className="px-4 py-3 w-28"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {paginated.map(r => {
                          const eff   = effectiveStatus(r);
                          const badge = STATUS_BADGE[eff];
                          const catNome = categorias.find(c => c.id === r.categoria_id)?.nome ?? r.categoria;
                          const ccNome  = centros.find(c => c.id === r.centro_custo_id)?.descricao ?? "—";
                          const canAct  = eff !== "pago" && eff !== "cancelado";
                          return (
                            <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-3">
                                <div className="font-medium text-gray-900">{r.descricao}</div>
                                {r.tipo === "despesa_paga" && (
                                  <span className="text-xs text-green-600 font-medium">Despesa paga</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{r.fornecedor ?? "—"}</td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{ccNome}</td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{catNome}</td>
                              <td className={`px-4 py-3 text-xs ${eff === "atrasado" ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                                {eff === "pago" && r.pago_em
                                  ? <>
                                      {fmtData(r.pago_em)}
                                      {r.hora_pagamento && (
                                        <span className="ml-1 text-gray-400">{r.hora_pagamento.slice(0, 5)}</span>
                                      )}
                                    </>
                                  : fmtData(r.vencimento)
                                }
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtMoeda(r.valor)}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 justify-end">
                                  {canAct && (
                                    <button onClick={() => setPayTarget(r)} title="Registrar pagamento"
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                  {canAct && (
                                    <button onClick={() => setEditing(r)} title="Editar"
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 019 16H7v-2a2 2 0 01.586-1.414z" />
                                      </svg>
                                    </button>
                                  )}
                                  {canAct && (
                                    <button onClick={() => setCancelId(r.id)} title="Cancelar"
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
                      <span>Página {page} de {totalPages} — {filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
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
        </div>
      </AppLayout>

      {(showLancar || editing) && (
        <LancarPayableModal
          onClose={() => { setShowLancar(false); setEditing(null); }}
          onSaved={load}
          editing={editing}
          contractorId={user?.contractorId ?? ""}
          {...modalProps}
        />
      )}

      {payTarget && (
        <PagarModal
          payable={payTarget}
          onClose={() => setPayTarget(null)}
          onSaved={load}
          contas={contas}
        />
      )}

      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Cancelar conta?</h3>
            <p className="text-sm text-gray-500 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCancelId(null)} className="text-primary font-semibold text-sm hover:underline px-2">VOLTAR</button>
              <button onClick={() => handleCancel(cancelId)}
                className="bg-red-500 text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-red-600 transition-colors">
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
