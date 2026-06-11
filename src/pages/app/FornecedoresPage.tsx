import { useState, useEffect } from "react";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import {
  Plus, Search, X, Loader2, Truck, Edit2, ToggleLeft, ToggleRight,
  ChevronLeft, ChevronRight, Phone, Mail, Zap, DollarSign, History, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ─── Tipos ──────────────────────────────────────────────────── */
interface Fornecedor {
  id: string;
  nome: string;
  nome_fantasia: string | null;
  tipo: string;            // legado
  tipo_fornecedor: string; // empresa | pessoa_fisica | autonomo | diarista
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  chave_pix: string | null;
  // Padrões automáticos
  centro_custo_id: string | null;
  categoria_id: string | null;
  subcategoria_id: string | null;
  forma_pagamento_padrao: string | null;
  condicao_pagamento: string | null;
  dia_vencimento: number | null;
  valor_diaria: number | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
}

interface HistoricoValor {
  id: string;
  valor: number;
  observacao: string | null;
  created_at: string;
}

interface CentroCusto { id: string; descricao: string; }
interface Categoria   { id: string; nome: string; centro_custo_id: string | null; }
interface Subcategoria{ id: string; nome: string; categoria_id: string; }

const TIPOS_FORNECEDOR = [
  { value: "empresa",      label: "Empresa / PJ"           },
  { value: "pessoa_fisica", label: "Pessoa Física"         },
  { value: "autonomo",     label: "Profissional Autônomo"  },
  { value: "diarista",     label: "Diarista / Prestador"   },
];

const FORMAS_PAG = [
  { value: "pix",            label: "Pix"              },
  { value: "dinheiro",       label: "Dinheiro"         },
  { value: "cartao_credito", label: "Cartão de crédito"},
  { value: "cartao_debito",  label: "Cartão de débito" },
  { value: "boleto",         label: "Boleto"           },
  { value: "transferencia",  label: "Transferência"    },
];

const CONDICOES = [
  { value: "a_vista",  label: "À vista"     },
  { value: "mensal",   label: "Mensal"      },
  { value: "quinzenal",label: "Quinzenal"   },
  { value: "semanal",  label: "Semanal"     },
  { value: "boleto",   label: "Boleto"      },
];

const PAGE_SIZE = 20;
const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white";
const LABEL = "block text-xs font-semibold text-gray-500 mb-1";

/* ─── Modal Fornecedor ───────────────────────────────────────── */
function FornecedorModal({
  editing, onClose, onSaved, contractorId,
  centros, categorias, subcategorias,
}: {
  editing: Fornecedor | null;
  onClose: () => void;
  onSaved: () => void;
  contractorId: string;
  centros: CentroCusto[];
  categorias: Categoria[];
  subcategorias: Subcategoria[];
}) {
  const blank = {
    nome: "", nome_fantasia: "", tipo_fornecedor: "empresa",
    cpf_cnpj: "", email: "", telefone: "", whatsapp: "",
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
    banco: "", agencia: "", conta: "", tipo_conta: "corrente", chave_pix: "",
    centro_custo_id: "", categoria_id: "", subcategoria_id: "",
    forma_pagamento_padrao: "", condicao_pagamento: "", dia_vencimento: "",
    valor_diaria: "", obs_valor: "",
    observacoes: "",
  };

  const [form, setForm] = useState(() =>
    editing ? {
      nome: editing.nome,
      nome_fantasia: editing.nome_fantasia ?? "",
      tipo_fornecedor: editing.tipo_fornecedor ?? "empresa",
      cpf_cnpj: editing.cpf_cnpj ?? "",
      email: editing.email ?? "",
      telefone: editing.telefone ?? "",
      whatsapp: editing.whatsapp ?? "",
      cep: editing.cep ?? "",
      logradouro: editing.logradouro ?? "",
      numero: editing.numero ?? "",
      complemento: editing.complemento ?? "",
      bairro: editing.bairro ?? "",
      cidade: editing.cidade ?? "",
      uf: editing.uf ?? "",
      banco: editing.banco ?? "",
      agencia: editing.agencia ?? "",
      conta: editing.conta ?? "",
      tipo_conta: editing.tipo_conta ?? "corrente",
      chave_pix: editing.chave_pix ?? "",
      centro_custo_id: editing.centro_custo_id ?? "",
      categoria_id: editing.categoria_id ?? "",
      subcategoria_id: editing.subcategoria_id ?? "",
      forma_pagamento_padrao: editing.forma_pagamento_padrao ?? "",
      condicao_pagamento: editing.condicao_pagamento ?? "",
      dia_vencimento: editing.dia_vencimento?.toString() ?? "",
      valor_diaria: editing.valor_diaria?.toString().replace(".", ",") ?? "",
      obs_valor: "",
      observacoes: editing.observacoes ?? "",
    } : blank
  );

  const [tab,          setTab]          = useState<"dados" | "endereco" | "banco" | "padrao">("dados");
  const [saving,       setSaving]       = useState(false);
  const [loadingCep,   setLoadingCep]   = useState(false);
  const [historico,    setHistorico]    = useState<HistoricoValor[]>([]);
  const [loadingHist,  setLoadingHist]  = useState(false);

  // Carrega histórico ao editar diarista
  useEffect(() => {
    if (!editing?.id || editing.tipo_fornecedor !== "diarista") return;
    setLoadingHist(true);
    supabase
      .from("fornecedor_historico_valores")
      .select("id, valor, observacao, created_at")
      .eq("fornecedor_id", editing.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setHistorico((data ?? []) as HistoricoValor[]);
        setLoadingHist(false);
      });
  }, [editing?.id]);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  // ao selecionar categoria → auto-preenche centro
  function handleCatChange(catId: string) {
    const cat = categorias.find(c => c.id === catId);
    setForm(f => ({
      ...f,
      categoria_id: catId,
      subcategoria_id: "",
      centro_custo_id: cat?.centro_custo_id ?? f.centro_custo_id,
    }));
  }

  const subsFiltradas = subcategorias.filter(s => s.categoria_id === form.categoria_id);

  async function buscarCep(cep: string) {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setLoadingCep(true);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(f => ({
          ...f,
          logradouro: data.logradouro ?? f.logradouro,
          bairro:     data.bairro     ?? f.bairro,
          cidade:     data.localidade ?? f.cidade,
          uf:         data.uf         ?? f.uf,
        }));
      }
    } catch {}
    setLoadingCep(false);
  }

  function parseValor(v: string): number | null {
    if (!v.trim()) return null;
    const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? null : n;
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error("Informe o nome do fornecedor."); return; }
    setSaving(true);

    const novoValor = parseValor(form.valor_diaria);
    const valorAnterior = editing?.valor_diaria ?? null;
    const valorMudou = form.tipo_fornecedor === "diarista" &&
      novoValor !== null &&
      novoValor !== valorAnterior;

    const payload: any = {
      contractor_id:         contractorId,
      nome:                  form.nome.trim(),
      nome_fantasia:         form.nome_fantasia?.trim() || null,
      tipo_fornecedor:       form.tipo_fornecedor,
      tipo:                  form.tipo_fornecedor === "empresa" ? "pessoa_juridica" : "pessoa_fisica",
      cpf_cnpj:              form.cpf_cnpj?.trim()  || null,
      email:                 form.email?.trim()     || null,
      telefone:              form.telefone?.trim()  || null,
      whatsapp:              form.whatsapp?.trim()  || null,
      cep:                   form.cep?.trim()       || null,
      logradouro:            form.logradouro?.trim()|| null,
      numero:                form.numero?.trim()    || null,
      complemento:           form.complemento?.trim()|| null,
      bairro:                form.bairro?.trim()    || null,
      cidade:                form.cidade?.trim()    || null,
      uf:                    form.uf?.trim()        || null,
      banco:                 form.banco?.trim()     || null,
      agencia:               form.agencia?.trim()   || null,
      conta:                 form.conta?.trim()     || null,
      tipo_conta:            form.tipo_conta        || null,
      chave_pix:             form.chave_pix?.trim() || null,
      centro_custo_id:       form.centro_custo_id   || null,
      categoria_id:          form.categoria_id      || null,
      subcategoria_id:       form.subcategoria_id   || null,
      forma_pagamento_padrao:form.forma_pagamento_padrao || null,
      condicao_pagamento:    form.condicao_pagamento || null,
      dia_vencimento:        form.dia_vencimento ? parseInt(form.dia_vencimento) : null,
      valor_diaria:          novoValor,
      observacoes:           form.observacoes?.trim()|| null,
      updated_at:            new Date().toISOString(),
    };

    let savedId = editing?.id;

    if (editing) {
      const { error } = await supabase.from("fornecedores").update(payload).eq("id", editing.id);
      if (error) { setSaving(false); toast.error("Erro ao salvar: " + error.message); return; }
    } else {
      const { data, error } = await supabase.from("fornecedores").insert(payload).select("id").maybeSingle();
      if (error || !data) { setSaving(false); toast.error("Erro ao salvar: " + (error?.message ?? "erro")); return; }
      savedId = data.id;
    }

    // Registra histórico se o valor_diaria mudou (ou é o primeiro registro)
    if (form.tipo_fornecedor === "diarista" && novoValor !== null && savedId && (valorMudou || !editing)) {
      await supabase.from("fornecedor_historico_valores").insert({
        fornecedor_id: savedId,
        valor: novoValor,
        observacao: form.obs_valor?.trim() || null,
      });
    }

    setSaving(false);
    toast.success(editing ? "Fornecedor atualizado!" : "Fornecedor cadastrado!");
    onSaved();
    onClose();
  }

  const TABS = [
    { key: "dados",    label: "DADOS GERAIS"    },
    { key: "endereco", label: "ENDEREÇO"         },
    { key: "banco",    label: "DADOS BANCÁRIOS"  },
    { key: "padrao",   label: "PADRÕES"          },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "92vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-500" />
            <span className="text-base font-bold text-gray-900">
              {editing ? "Editar fornecedor" : "Novo fornecedor"}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              {t.label}
              {t.key === "padrao" && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-bold rounded-full">AUTO</span>
              )}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ── ABA DADOS GERAIS ── */}
          {tab === "dados" && (
            <>
              {/* Tipo de fornecedor */}
              <div>
                <label className={LABEL}>Tipo de fornecedor *</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS_FORNECEDOR.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => set("tipo_fornecedor", opt.value)}
                      className={`py-2 rounded-lg text-sm font-semibold border-2 transition-all ${form.tipo_fornecedor === opt.value ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nome + Nome Fantasia */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>
                    {form.tipo_fornecedor === "empresa" ? "Razão Social" : "Nome completo"} *
                  </label>
                  <input className={INPUT} value={form.nome}
                    onChange={e => set("nome", e.target.value)}
                    placeholder={form.tipo_fornecedor === "empresa" ? "Ex: NextFit Sistemas Ltda" : "Ex: Carlos Silva"} />
                </div>
                <div>
                  <label className={LABEL}>
                    {form.tipo_fornecedor === "empresa" ? "Nome Fantasia" : "Apelido / Como chama"}
                  </label>
                  <input className={INPUT} value={form.nome_fantasia ?? ""}
                    onChange={e => set("nome_fantasia", e.target.value)}
                    placeholder={form.tipo_fornecedor === "empresa" ? "Ex: NextFit" : "Ex: Carlos Técnico"} />
                </div>
              </div>

              {/* CPF/CNPJ + E-mail */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>{["empresa"].includes(form.tipo_fornecedor) ? "CNPJ" : "CPF"}</label>
                  <input className={INPUT} value={form.cpf_cnpj ?? ""}
                    onChange={e => set("cpf_cnpj", e.target.value)}
                    placeholder={form.tipo_fornecedor === "empresa" ? "00.000.000/0000-00" : "000.000.000-00"} />
                </div>
                <div>
                  <label className={LABEL}>E-mail</label>
                  <input className={INPUT} type="email" value={form.email ?? ""}
                    onChange={e => set("email", e.target.value)}
                    placeholder="email@fornecedor.com" />
                </div>
              </div>

              {/* Telefone + WhatsApp */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Telefone</label>
                  <input className={INPUT} value={form.telefone ?? ""}
                    onChange={e => set("telefone", e.target.value)} placeholder="(11) 3000-0000" />
                </div>
                <div>
                  <label className={LABEL}>WhatsApp</label>
                  <input className={INPUT} value={form.whatsapp ?? ""}
                    onChange={e => set("whatsapp", e.target.value)} placeholder="(11) 99000-0000" />
                </div>
              </div>

              {/* ── Valor da diária (apenas diarista) ── */}
              {form.tipo_fornecedor === "diarista" && (
                <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-bold text-orange-800">Valor da diária / serviço</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL}>Valor atual (R$)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">R$</span>
                        <CurrencyInput
                          className={INPUT + " pl-8"}
                          value={form.valor_diaria}
                          onChange={v => set("valor_diaria", v)}
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={LABEL}>Motivo da alteração</label>
                      <input
                        className={INPUT}
                        value={form.obs_valor}
                        onChange={e => set("obs_valor", e.target.value)}
                        placeholder="Ex: Reajuste 2026, combinado..."
                      />
                    </div>
                  </div>

                  {/* Histórico de valores */}
                  {editing && (
                    <div className="mt-1">
                      <div className="flex items-center gap-1.5 mb-2">
                        <History className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">Histórico de valores</span>
                      </div>
                      {loadingHist ? (
                        <div className="flex items-center gap-2 py-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                          <span className="text-xs text-orange-400">Carregando...</span>
                        </div>
                      ) : historico.length === 0 ? (
                        <p className="text-xs text-orange-300 italic">Nenhum registro de valor ainda.</p>
                      ) : (
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {historico.map((h, i) => {
                            const prox = historico[i + 1];
                            const diff = prox ? h.valor - prox.valor : null;
                            return (
                              <div key={h.id}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${i === 0 ? "bg-white border border-orange-200" : "bg-white/60"}`}>
                                <div className="flex items-center gap-2">
                                  {i === 0 && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">ATUAL</span>}
                                  <span className="font-bold text-gray-800">
                                    {h.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                  </span>
                                  {diff !== null && diff > 0 && <TrendingUp className="w-3 h-3 text-green-500" />}
                                  {diff !== null && diff < 0 && <TrendingDown className="w-3 h-3 text-red-400" />}
                                  {diff !== null && diff === 0 && <Minus className="w-3 h-3 text-gray-300" />}
                                </div>
                                <div className="flex items-center gap-2 text-gray-400">
                                  {h.observacao && <span className="italic text-gray-500 max-w-[120px] truncate">"{h.observacao}"</span>}
                                  <span>{new Date(h.created_at).toLocaleDateString("pt-BR")}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Observações */}
              <div>
                <label className={LABEL}>Observações internas</label>
                <textarea className={INPUT + " resize-none"} rows={2}
                  value={form.observacoes ?? ""}
                  onChange={e => set("observacoes", e.target.value)}
                  placeholder="Anotações sobre este fornecedor..." />
              </div>
            </>
          )}

          {/* ── ABA ENDEREÇO ── */}
          {tab === "endereco" && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={LABEL}>CEP</label>
                <div className="relative">
                  <input className={INPUT} value={form.cep ?? ""}
                    onChange={e => set("cep", e.target.value)}
                    onBlur={e => buscarCep(e.target.value)}
                    placeholder="00000-000" maxLength={9} />
                  {loadingCep && <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-primary" />}
                </div>
              </div>
              <div className="col-span-2">
                <label className={LABEL}>Logradouro</label>
                <input className={INPUT} value={form.logradouro ?? ""}
                  onChange={e => set("logradouro", e.target.value)} placeholder="Rua, Av, Travessa..." />
              </div>
              <div>
                <label className={LABEL}>Número</label>
                <input className={INPUT} value={form.numero ?? ""}
                  onChange={e => set("numero", e.target.value)} placeholder="123" />
              </div>
              <div>
                <label className={LABEL}>Complemento</label>
                <input className={INPUT} value={form.complemento ?? ""}
                  onChange={e => set("complemento", e.target.value)} placeholder="Sala 5..." />
              </div>
              <div>
                <label className={LABEL}>Bairro</label>
                <input className={INPUT} value={form.bairro ?? ""}
                  onChange={e => set("bairro", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={LABEL}>Cidade</label>
                <input className={INPUT} value={form.cidade ?? ""}
                  onChange={e => set("cidade", e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>UF</label>
                <input className={INPUT} value={form.uf ?? ""}
                  onChange={e => set("uf", e.target.value)} maxLength={2} placeholder="SP" />
              </div>
            </div>
          )}

          {/* ── ABA DADOS BANCÁRIOS ── */}
          {tab === "banco" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Banco</label>
                <input className={INPUT} value={form.banco ?? ""}
                  onChange={e => set("banco", e.target.value)} placeholder="Ex: Bradesco, Nubank..." />
              </div>
              <div>
                <label className={LABEL}>Tipo de conta</label>
                <select className={INPUT} value={form.tipo_conta ?? "corrente"}
                  onChange={e => set("tipo_conta", e.target.value)}>
                  <option value="corrente">Conta corrente</option>
                  <option value="poupanca">Conta poupança</option>
                  <option value="pix">Somente Pix</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Agência</label>
                <input className={INPUT} value={form.agencia ?? ""}
                  onChange={e => set("agencia", e.target.value)} placeholder="0000" />
              </div>
              <div>
                <label className={LABEL}>Conta</label>
                <input className={INPUT} value={form.conta ?? ""}
                  onChange={e => set("conta", e.target.value)} placeholder="00000-0" />
              </div>
              <div className="col-span-2">
                <label className={LABEL}>Chave Pix</label>
                <input className={INPUT} value={form.chave_pix ?? ""}
                  onChange={e => set("chave_pix", e.target.value)}
                  placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória" />
              </div>
            </div>
          )}

          {/* ── ABA PADRÕES ── */}
          {tab === "padrao" && (
            <>
              <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-100 rounded-xl mb-2">
                <Zap className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-orange-800">Preenchimento automático</p>
                  <p className="text-xs text-orange-600 mt-0.5 leading-relaxed">
                    Ao selecionar este fornecedor em um lançamento, o sistema sugerirá automaticamente o centro de custo, categoria, subcategoria e forma de pagamento abaixo.
                  </p>
                </div>
              </div>

              {/* Categoria + Centro (com auto-fill) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Categoria de despesa padrão</label>
                  <select className={INPUT} value={form.categoria_id}
                    onChange={e => handleCatChange(e.target.value)}>
                    <option value="">Selecionar...</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Subcategoria padrão</label>
                  <select className={INPUT} value={form.subcategoria_id}
                    onChange={e => set("subcategoria_id", e.target.value)}
                    disabled={!form.categoria_id}>
                    <option value="">Selecionar...</option>
                    {subsFiltradas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={LABEL}>Centro de custo padrão</label>
                <p className="text-xs text-gray-400 mb-1">Preenchido automaticamente ao selecionar a categoria. Pode ajustar manualmente.</p>
                <select className={INPUT} value={form.centro_custo_id}
                  onChange={e => set("centro_custo_id", e.target.value)}>
                  <option value="">Selecionar...</option>
                  {centros.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={LABEL}>Forma de pagamento padrão</label>
                  <select className={INPUT} value={form.forma_pagamento_padrao}
                    onChange={e => set("forma_pagamento_padrao", e.target.value)}>
                    <option value="">Selecionar...</option>
                    {FORMAS_PAG.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Condição de pagamento</label>
                  <select className={INPUT} value={form.condicao_pagamento}
                    onChange={e => set("condicao_pagamento", e.target.value)}>
                    <option value="">Selecionar...</option>
                    {CONDICOES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Dia padrão de vencimento</label>
                  <input className={INPUT} type="number" min={1} max={31}
                    value={form.dia_vencimento}
                    onChange={e => set("dia_vencimento", e.target.value)}
                    placeholder="Ex: 10" />
                </div>
              </div>

              {/* Preview automático */}
              {(form.categoria_id || form.centro_custo_id || form.forma_pagamento_padrao) && (
                <div className="mt-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Prévia do auto-preenchimento</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-32 flex-shrink-0">Fornecedor:</span>
                      <span className="font-semibold text-gray-700">{form.nome || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-32 flex-shrink-0">Centro de custo:</span>
                      <span className="font-semibold text-gray-700">
                        {centros.find(c => c.id === form.centro_custo_id)?.descricao ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-32 flex-shrink-0">Categoria:</span>
                      <span className="font-semibold text-gray-700">
                        {categorias.find(c => c.id === form.categoria_id)?.nome ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-32 flex-shrink-0">Subcategoria:</span>
                      <span className="font-semibold text-gray-700">
                        {subcategorias.find(s => s.id === form.subcategoria_id)?.nome ?? "—"}
                      </span>
                    </div>
                    {form.forma_pagamento_padrao && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-32 flex-shrink-0">Forma pagto:</span>
                        <span className="font-semibold text-gray-700">
                          {FORMAS_PAG.find(f => f.value === form.forma_pagamento_padrao)?.label ?? "—"}
                        </span>
                      </div>
                    )}
                    {form.dia_vencimento && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-32 flex-shrink-0">Vence todo dia:</span>
                        <span className="font-semibold text-gray-700">{form.dia_vencimento}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm font-bold text-gray-400 hover:text-gray-600 hover:underline">CANCELAR</button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? "SALVANDO..." : editing ? "SALVAR ALTERAÇÕES" : "CADASTRAR"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Página principal ───────────────────────────────────────── */
export default function FornecedoresPage() {
  const { user } = useAuth();
  const [all,        setAll]       = useState<Fornecedor[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [search,     setSearch]    = useState("");
  const [page,       setPage]      = useState(1);
  const [showModal,  setShowModal] = useState(false);
  const [editing,    setEditing]   = useState<Fornecedor | null>(null);
  const [togglingId, setTogglingId]= useState<string | null>(null);

  const [centros,       setCentros]    = useState<CentroCusto[]>([]);
  const [categorias,    setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcats]    = useState<Subcategoria[]>([]);

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);
    const { data } = await supabase
      .from("fornecedores").select("*")
      .eq("contractor_id", user.contractorId).order("nome");
    setAll((data ?? []) as Fornecedor[]);
    setLoading(false);
  }

  async function loadLookups() {
    if (!user?.contractorId) return;
    const [{ data: cc }, { data: cat }, { data: sub }] = await Promise.all([
      supabase.from("centros_custo").select("id, descricao").eq("contractor_id", user.contractorId).order("descricao"),
      supabase.from("categorias_financeiras").select("id, nome, centro_custo_id").eq("contractor_id", user.contractorId).eq("tipo", "despesa").order("nome"),
      supabase.from("subcategorias_financeiras").select("id, nome, categoria_id").eq("contractor_id", user.contractorId).order("nome"),
    ]);
    setCentros((cc ?? []) as CentroCusto[]);
    setCategorias((cat ?? []) as Categoria[]);
    setSubcats((sub ?? []) as Subcategoria[]);
  }

  useEffect(() => { load(); loadLookups(); }, [user]);

  async function toggleAtivo(f: Fornecedor) {
    setTogglingId(f.id);
    await supabase.from("fornecedores").update({ ativo: !f.ativo }).eq("id", f.id);
    setAll(prev => prev.map(x => x.id === f.id ? { ...x, ativo: !f.ativo } : x));
    setTogglingId(null);
  }

  const filtered = all.filter(f => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.nome.toLowerCase().includes(q) ||
      (f.nome_fantasia ?? "").toLowerCase().includes(q) ||
      (f.cpf_cnpj ?? "").includes(q) ||
      (f.email ?? "").toLowerCase().includes(q) ||
      (f.cidade ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const ativos     = all.filter(f => f.ativo).length;
  const inativos   = all.filter(f => !f.ativo).length;

  const TIPO_LABEL: Record<string, string> = {
    empresa:      "Empresa / PJ",
    pessoa_fisica:"Pessoa Física",
    autonomo:     "Autônomo",
    diarista:     "Diarista",
  };

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">Fornecedores</h1>
                  <p className="text-xs text-gray-400">Para quem a academia paga suas despesas</p>
                </div>
              </div>
              <div className="relative flex-1 max-w-xs ml-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Buscar por nome, CNPJ, cidade..."
                  value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <button onClick={() => { setEditing(null); setShowModal(true); }}
                className="ml-auto inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                <Plus className="w-4 h-4" /> NOVO FORNECEDOR
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-gray-50 p-8">

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: "Total cadastrados", value: all.length, color: "text-gray-900",  bg: "bg-gray-50",   ic: "text-gray-500",  icon: Truck        },
                { label: "Ativos",            value: ativos,     color: "text-green-700", bg: "bg-green-50",  ic: "text-green-500", icon: ToggleRight  },
                { label: "Inativos",          value: inativos,   color: "text-gray-400",  bg: "bg-gray-100",  ic: "text-gray-400",  icon: ToggleLeft   },
              ].map(({ label, value, color, bg, ic, icon: Icon }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${ic}`} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-7 h-7 animate-spin text-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
                    <Truck className="w-7 h-7 text-orange-300" />
                  </div>
                  <p className="text-sm text-gray-400 font-medium">
                    {all.length === 0 ? "Nenhum fornecedor cadastrado ainda." : "Nenhum resultado encontrado."}
                  </p>
                  {all.length === 0 && (
                    <button onClick={() => { setEditing(null); setShowModal(true); }}
                      className="inline-flex items-center gap-2 text-sm text-primary font-semibold hover:underline">
                      <Plus className="w-4 h-4" /> Cadastrar primeiro fornecedor
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold bg-gray-50">
                        <th className="text-left px-5 py-3">Nome</th>
                        <th className="text-left px-4 py-3">Tipo</th>
                        <th className="text-left px-4 py-3">CPF / CNPJ</th>
                        <th className="text-left px-4 py-3">Contato</th>
                        <th className="text-left px-4 py-3">Padrão (Categoria)</th>
                        <th className="text-center px-4 py-3">Status</th>
                        <th className="px-4 py-3 w-20 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginated.map(f => {
                        const catNome = categorias.find(c => c.id === f.categoria_id)?.nome;
                        return (
                          <tr key={f.id} className={`hover:bg-gray-50 transition-colors ${!f.ativo ? "opacity-50" : ""}`}>
                            <td className="px-5 py-3">
                              <p className="font-semibold text-gray-900 truncate max-w-[180px]">{f.nome}</p>
                              {f.nome_fantasia && <p className="text-xs text-gray-400">{f.nome_fantasia}</p>}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {TIPO_LABEL[f.tipo_fornecedor] ?? f.tipo_fornecedor}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                              {f.cpf_cnpj ?? "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                                {f.email && (
                                  <span className="flex items-center gap-1 text-xs text-gray-500">
                                    <Mail className="w-3 h-3" /> {f.email}
                                  </span>
                                )}
                                {(f.whatsapp || f.telefone) && (
                                  <span className="flex items-center gap-1 text-xs text-gray-500">
                                    <Phone className="w-3 h-3" /> {f.whatsapp ?? f.telefone}
                                  </span>
                                )}
                                {!f.email && !f.whatsapp && !f.telefone && <span className="text-xs text-gray-300">—</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {catNome
                                ? <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                                    <Zap className="w-2.5 h-2.5" /> {catNome}
                                  </span>
                                : <span className="text-xs text-gray-300">—</span>
                              }
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${f.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                                {f.ativo ? "Ativo" : "Inativo"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => { setEditing(f); setShowModal(true); }}
                                  title="Editar"
                                  className="p-1.5 rounded-lg hover:bg-primary/10 text-gray-400 hover:text-primary transition-colors">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => toggleAtivo(f)} disabled={togglingId === f.id}
                                  title={f.ativo ? "Desativar" : "Ativar"}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                                  {togglingId === f.id
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : f.ativo
                                      ? <ToggleRight className="w-3.5 h-3.5 text-green-500" />
                                      : <ToggleLeft className="w-3.5 h-3.5" />
                                  }
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
                    <span>Página {page} de {totalPages} — {filtered.length} fornecedor{filtered.length !== 1 ? "es" : ""}</span>
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

      {showModal && (
        <FornecedorModal
          editing={editing}
          onClose={() => setShowModal(false)}
          onSaved={load}
          contractorId={user?.contractorId ?? ""}
          centros={centros}
          categorias={categorias}
          subcategorias={subcategorias}
        />
      )}
    </>
  );
}
