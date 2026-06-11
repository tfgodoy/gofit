import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { useState, useEffect } from "react";
import {
  X, Plus, Trash2, ChevronDown, ChevronUp, Settings, DollarSign,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ─── Types ─────────────────────────────────────────────── */

interface Modalidade {
  id?: string;
  nome: string;
  tipo_acesso: "padrao" | "sessoes_semana" | "pacote_aulas";
  sessoes_por_semana: string;
  total_aulas: string;
  contabilizar_conjunto: boolean;
}

interface ContratoData {
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
  contabilizar_sessoes_conjunto: boolean;
}

interface Props {
  contrato: ContratoData | null;
  onClose: () => void;
  onSaved: () => void;
}

/* ─── Form defaults ─────────────────────────────────────── */

const EMPTY_FORM = {
  descricao: "",
  tipo: "padrao",
  duracao: "1",
  tipo_duracao: "meses",
  valor_total: "",
  valor_por_mes: "",
  permite_renovar: false,
  renova_automaticamente: false,
  renovacao_quando: "no_vencimento",
  permite_parcelado: false,
  max_parcelas: "1",
  formas_pagamento: [] as string[],
  template_contrato: "",
  assinatura_eletronica: false,
  forma_envio_assinatura: "email",
  ativo: true,
  // avancadas
  limita_periodo_venda: false,
  data_inicio_venda: "",
  data_fim_venda: "",
  max_suspensoes: "",
  max_dias_suspensao: "",
  permite_pre_venda: false,
  possui_valor_adesao: false,
  valor_adesao: "",
  comissionar_consultor: false,
  categoria_receita: "",
  contabilizar_sessoes_conjunto: false,
};

const EMPTY_MOD: Modalidade = {
  nome: "", tipo_acesso: "padrao", sessoes_por_semana: "", total_aulas: "", contabilizar_conjunto: false,
};

/* ─── Style constants ────────────────────────────────────── */

const INP = [
  "w-full bg-transparent",
  "border-0 border-b border-gray-300",
  "py-2 px-0",
  "text-sm text-gray-900 placeholder:text-gray-400",
  "outline-none",
  "focus:border-b-2 focus:border-primary",
  "transition-colors",
].join(" ");

const SEL = [
  "w-full bg-transparent",
  "border-0 border-b border-gray-300",
  "py-2 px-0 pr-6",
  "text-sm text-gray-900",
  "outline-none appearance-none",
  "focus:border-b-2 focus:border-primary",
  "transition-colors cursor-pointer",
].join(" ");

const LBL = "block text-xs text-gray-500 mb-0.5";
const REQ = <span className="text-primary ml-0.5">*</span>;

const FORMAS_PAGAMENTO = [
  { value: "dinheiro",       label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao_debito",  label: "Cartão de débito" },
  { value: "pix",            label: "PIX" },
  { value: "boleto",         label: "Boleto" },
  { value: "transferencia",  label: "Transferência" },
];

const TIPO_OPTIONS = [
  { value: "padrao",    label: "Padrão" },
  { value: "totalpass", label: "TotalPass" },
  { value: "wellhub",   label: "Wellhub" },
  { value: "gympass",   label: "GymPass" },
];

/* ─── Sub-modal: Permissões e restrições ─────────────────── */

function PermissoesModal({
  form,
  setForm,
  onClose,
}: {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  onClose: () => void;
}) {
  const [local, setLocal] = useState({
    limita_periodo_venda: form.limita_periodo_venda,
    data_inicio_venda: form.data_inicio_venda,
    data_fim_venda: form.data_fim_venda,
    max_suspensoes: form.max_suspensoes,
    max_dias_suspensao: form.max_dias_suspensao,
    permite_pre_venda: form.permite_pre_venda,
  });

  function save() {
    setForm(f => ({ ...f, ...local }));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Permissões e restrições</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-5">

          <Toggle
            label="Limitar período de vendas"
            checked={local.limita_periodo_venda}
            onChange={v => setLocal(l => ({ ...l, limita_periodo_venda: v }))}
          />
          {local.limita_periodo_venda && (
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className={LBL}>Data início venda</label>
                <input type="date" value={local.data_inicio_venda} onChange={e => setLocal(l => ({ ...l, data_inicio_venda: e.target.value }))} className={INP} />
              </div>
              <div>
                <label className={LBL}>Data fim venda</label>
                <input type="date" value={local.data_fim_venda} onChange={e => setLocal(l => ({ ...l, data_fim_venda: e.target.value }))} className={INP} />
              </div>
            </div>
          )}

          <Toggle
            label="Permitir pré-venda"
            checked={local.permite_pre_venda}
            onChange={v => setLocal(l => ({ ...l, permite_pre_venda: v }))}
          />

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className={LBL}>Máx. suspensões</label>
              <input type="number" min={0} value={local.max_suspensoes} onChange={e => setLocal(l => ({ ...l, max_suspensoes: e.target.value }))} className={INP} placeholder="Sem limite" />
            </div>
            <div>
              <label className={LBL}>Máx. dias por suspensão</label>
              <input type="number" min={0} value={local.max_dias_suspensao} onChange={e => setLocal(l => ({ ...l, max_dias_suspensao: e.target.value }))} className={INP} placeholder="Sem limite" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-primary font-semibold text-sm hover:underline px-2">CANCELAR</button>
          <button onClick={save} className="bg-primary text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">SALVAR</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-modal: Financeiro ──────────────────────────────── */

function FinanceiroModal({
  form,
  setForm,
  onClose,
}: {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  onClose: () => void;
}) {
  const [local, setLocal] = useState({
    possui_valor_adesao: form.possui_valor_adesao,
    valor_adesao: form.valor_adesao,
    comissionar_consultor: form.comissionar_consultor,
    categoria_receita: form.categoria_receita,
  });

  function save() {
    setForm(f => ({ ...f, ...local }));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Financeiro</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <Toggle
            label="Possui valor de adesão"
            checked={local.possui_valor_adesao}
            onChange={v => setLocal(l => ({ ...l, possui_valor_adesao: v }))}
          />
          {local.possui_valor_adesao && (
            <div>
              <label className={LBL}>Valor de adesão (R$)</label>
              <CurrencyInput value={local.valor_adesao} onChange={v => setLocal(l => ({ ...l, valor_adesao: v }))} className={INP} placeholder="0,00" />
            </div>
          )}

          <Toggle
            label="Comissionar consultor"
            checked={local.comissionar_consultor}
            onChange={v => setLocal(l => ({ ...l, comissionar_consultor: v }))}
          />

          <div>
            <label className={LBL}>Categoria de receita</label>
            <input type="text" value={local.categoria_receita} onChange={e => setLocal(l => ({ ...l, categoria_receita: e.target.value }))} className={INP} placeholder="Ex: Mensalidade" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-primary font-semibold text-sm hover:underline px-2">CANCELAR</button>
          <button onClick={save} className="bg-primary text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">SALVAR</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-modal: Adicionar Modalidade ────────────────────── */

function ModalidadeModal({
  initial,
  onSave,
  onClose,
}: {
  initial: Modalidade | null;
  onSave: (m: Modalidade) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<Modalidade>(initial ?? { ...EMPTY_MOD });

  function save() {
    if (!local.nome.trim()) { toast.error("Informe o nome da modalidade."); return; }
    onSave(local);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">{initial ? "Editar modalidade" : "Adicionar modalidade"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div>
            <label className={LBL}>Nome {REQ}</label>
            <input type="text" value={local.nome} onChange={e => setLocal(l => ({ ...l, nome: e.target.value }))} className={INP} placeholder="Ex: Musculação" />
          </div>
          <div>
            <label className={LBL}>Tipo de acesso</label>
            <div className="relative mt-1">
              <select value={local.tipo_acesso} onChange={e => setLocal(l => ({ ...l, tipo_acesso: e.target.value as Modalidade["tipo_acesso"] }))} className={SEL}>
                <option value="padrao">Padrão (acesso livre)</option>
                <option value="sessoes_semana">Sessões por semana</option>
                <option value="pacote_aulas">Pacote de aulas</option>
              </select>
              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {local.tipo_acesso === "sessoes_semana" && (
            <div>
              <label className={LBL}>Sessões por semana</label>
              <input type="number" min={1} value={local.sessoes_por_semana} onChange={e => setLocal(l => ({ ...l, sessoes_por_semana: e.target.value }))} className={INP} placeholder="Ex: 3" />
            </div>
          )}
          {local.tipo_acesso === "pacote_aulas" && (
            <div>
              <label className={LBL}>Total de aulas no pacote</label>
              <input type="number" min={1} value={local.total_aulas} onChange={e => setLocal(l => ({ ...l, total_aulas: e.target.value }))} className={INP} placeholder="Ex: 10" />
            </div>
          )}

          <Toggle
            label="Contabilizar modalidades em conjunto"
            checked={local.contabilizar_conjunto}
            onChange={v => setLocal(l => ({ ...l, contabilizar_conjunto: v }))}
          />
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-primary font-semibold text-sm hover:underline px-2">CANCELAR</button>
          <button onClick={save} className="bg-primary text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">SALVAR</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Toggle component ───────────────────────────────────── */

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-primary" : "bg-gray-200"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

/* ─── Section header ─────────────────────────────────────── */

function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-6 py-3 bg-gray-50 border-y border-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
    >
      <span>{title}</span>
      {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
    </button>
  );
}

/* ─── Main component ─────────────────────────────────────── */

export default function ContratoFormModal({ contrato, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const isEdit = !!contrato;

  const [form, setForm] = useState(() => {
    if (contrato) {
      return {
        descricao: contrato.descricao,
        tipo: contrato.tipo,
        duracao: String(contrato.duracao),
        tipo_duracao: contrato.tipo_duracao,
        valor_total: String(contrato.valor_total),
        valor_por_mes: contrato.valor_por_mes != null ? String(contrato.valor_por_mes) : "",
        permite_renovar: contrato.permite_renovar,
        renova_automaticamente: contrato.renova_automaticamente,
        renovacao_quando: contrato.renovacao_quando ?? "no_vencimento",
        permite_parcelado: contrato.permite_parcelado,
        max_parcelas: contrato.max_parcelas != null ? String(contrato.max_parcelas) : "1",
        formas_pagamento: contrato.formas_pagamento ?? [],
        template_contrato: contrato.template_contrato ?? "",
        assinatura_eletronica: contrato.assinatura_eletronica,
        forma_envio_assinatura: contrato.forma_envio_assinatura ?? "email",
        ativo: contrato.ativo,
        limita_periodo_venda: contrato.limita_periodo_venda,
        data_inicio_venda: contrato.data_inicio_venda ?? "",
        data_fim_venda: contrato.data_fim_venda ?? "",
        max_suspensoes: contrato.max_suspensoes != null ? String(contrato.max_suspensoes) : "",
        max_dias_suspensao: contrato.max_dias_suspensao != null ? String(contrato.max_dias_suspensao) : "",
        permite_pre_venda: contrato.permite_pre_venda,
        possui_valor_adesao: contrato.possui_valor_adesao,
        valor_adesao: contrato.valor_adesao != null ? String(contrato.valor_adesao) : "",
        comissionar_consultor: contrato.comissionar_consultor,
        categoria_receita: contrato.categoria_receita ?? "",
        contabilizar_sessoes_conjunto: contrato.contabilizar_sessoes_conjunto ?? false,
      };
    }
    return { ...EMPTY_FORM };
  });

  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [loadingMods, setLoadingMods] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // Sections open state
  const [openSections, setOpenSections] = useState({
    dados: true,
    modalidades: true,
    configuracoes: true,
    pagamento: true,
    avancadas: false,
  });

  // Sub-modals
  const [showPermissoes, setShowPermissoes] = useState(false);
  const [showFinanceiro, setShowFinanceiro] = useState(false);
  const [showModalidade, setShowModalidade] = useState(false);
  const [editingModIdx, setEditingModIdx] = useState<number | null>(null);

  function toggleSection(s: keyof typeof openSections) {
    setOpenSections(prev => ({ ...prev, [s]: !prev[s] }));
  }

  useEffect(() => {
    if (!isEdit) return;
    async function loadMods() {
      const { data } = await supabase
        .from("contrato_modalidades")
        .select("*")
        .eq("contrato_id", contrato!.id)
        .order("created_at");
      setModalidades((data ?? []).map((m: any) => ({
        id: m.id,
        nome: m.nome,
        tipo_acesso: m.tipo_acesso,
        sessoes_por_semana: m.sessoes_por_semana != null ? String(m.sessoes_por_semana) : "",
        total_aulas: m.total_aulas != null ? String(m.total_aulas) : "",
        contabilizar_conjunto: m.contabilizar_conjunto,
      })));
      setLoadingMods(false);
    }
    loadMods();
  }, [isEdit, contrato]);

  function togglePagto(value: string) {
    setForm(f => ({
      ...f,
      formas_pagamento: f.formas_pagamento.includes(value)
        ? f.formas_pagamento.filter(v => v !== value)
        : [...f.formas_pagamento, value],
    }));
  }

  function handleSaveModalidade(m: Modalidade) {
    if (editingModIdx !== null) {
      setModalidades(prev => prev.map((item, i) => (i === editingModIdx ? m : item)));
    } else {
      setModalidades(prev => [...prev, m]);
    }
    setShowModalidade(false);
    setEditingModIdx(null);
  }

  function removeModalidade(idx: number) {
    setModalidades(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!form.descricao.trim()) { toast.error("Informe a descrição do contrato."); return; }
    if (!form.valor_total || isNaN(parseFloat(form.valor_total))) { toast.error("Informe o valor total."); return; }
    if (!user?.contractorId) return;

    setSaving(true);
    try {
      const payload = {
        contractor_id: user.contractorId,
        descricao: form.descricao.trim(),
        tipo: form.tipo,
        duracao: parseInt(form.duracao) || 1,
        tipo_duracao: form.tipo_duracao,
        valor_total: parseFloat(form.valor_total) || 0,
        valor_por_mes: form.valor_por_mes ? parseFloat(form.valor_por_mes) : null,
        permite_renovar: form.permite_renovar,
        renova_automaticamente: form.renova_automaticamente,
        renovacao_quando: form.permite_renovar ? form.renovacao_quando : null,
        permite_parcelado: form.permite_parcelado,
        max_parcelas: form.permite_parcelado ? parseInt(form.max_parcelas) || null : null,
        formas_pagamento: form.formas_pagamento,
        template_contrato: form.template_contrato || null,
        assinatura_eletronica: form.assinatura_eletronica,
        forma_envio_assinatura: form.assinatura_eletronica ? form.forma_envio_assinatura : null,
        ativo: form.ativo,
        limita_periodo_venda: form.limita_periodo_venda,
        data_inicio_venda: form.limita_periodo_venda && form.data_inicio_venda ? form.data_inicio_venda : null,
        data_fim_venda: form.limita_periodo_venda && form.data_fim_venda ? form.data_fim_venda : null,
        max_suspensoes: form.max_suspensoes ? parseInt(form.max_suspensoes) : null,
        max_dias_suspensao: form.max_dias_suspensao ? parseInt(form.max_dias_suspensao) : null,
        permite_pre_venda: form.permite_pre_venda,
        possui_valor_adesao: form.possui_valor_adesao,
        valor_adesao: form.possui_valor_adesao && form.valor_adesao ? parseFloat(form.valor_adesao) : null,
        comissionar_consultor: form.comissionar_consultor,
        categoria_receita: form.categoria_receita || null,
        contabilizar_sessoes_conjunto: form.contabilizar_sessoes_conjunto,
      };

      let contratoId = contrato?.id;

      if (isEdit) {
        const { error } = await supabase.from("contratos").update(payload).eq("id", contratoId!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("contratos").insert(payload).select("id").single();
        if (error) throw error;
        contratoId = data.id;
      }

      // Sync modalidades: delete all then re-insert
      await supabase.from("contrato_modalidades").delete().eq("contrato_id", contratoId!);
      if (modalidades.length > 0) {
        const modsPayload = modalidades.map(m => ({
          contrato_id: contratoId!,
          nome: m.nome,
          tipo_acesso: m.tipo_acesso,
          sessoes_por_semana: m.tipo_acesso === "sessoes_semana" && m.sessoes_por_semana ? parseInt(m.sessoes_por_semana) : null,
          total_aulas: m.tipo_acesso === "pacote_aulas" && m.total_aulas ? parseInt(m.total_aulas) : null,
          contabilizar_conjunto: m.contabilizar_conjunto,
          permite_reposicao: true,
          max_reposicoes: 10,
          limite_reposicoes_periodo: "semana",
          matricula_obrigatoria_na_venda: false,
        }));
        await supabase.from("contrato_modalidades").insert(modsPayload);
      }

      toast.success(isEdit ? "Contrato atualizado." : "Contrato criado.");
      onSaved();
    } catch (err: any) {
      console.error("contrato save error:", err);
      toast.error("Erro ao salvar contrato.");
    } finally {
      setSaving(false);
    }
  }

  const TIPO_ACESSO_LABEL: Record<string, string> = {
    padrao: "Padrão",
    sessoes_semana: "Sessões/semana",
    pacote_aulas: "Pacote de aulas",
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-6">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 my-auto">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">
              {isEdit ? "Editar contrato" : "Novo contrato"}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ─── Dados principais ─── */}
          <SectionHeader title="Dados principais" open={openSections.dados} onToggle={() => toggleSection("dados")} />
          {openSections.dados && (
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className={LBL}>Descrição {REQ}</label>
                <input
                  type="text"
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  className={INP}
                  placeholder="Nome do contrato"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className={LBL}>Tipo</label>
                  <div className="relative mt-1">
                    <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className={SEL}>
                      {TIPO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={LBL}>Status</label>
                  <div className="relative mt-1">
                    <select value={form.ativo ? "ativo" : "inativo"} onChange={e => setForm(f => ({ ...f, ativo: e.target.value === "ativo" }))} className={SEL}>
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-5">
                <div className="col-span-1">
                  <label className={LBL}>Duração {REQ}</label>
                  <input type="number" min={1} value={form.duracao} onChange={e => setForm(f => ({ ...f, duracao: e.target.value }))} className={INP} placeholder="1" />
                </div>
                <div className="col-span-2">
                  <label className={LBL}>Período</label>
                  <div className="relative mt-1">
                    <select value={form.tipo_duracao} onChange={e => setForm(f => ({ ...f, tipo_duracao: e.target.value }))} className={SEL}>
                      <option value="dias">Dias</option>
                      <option value="meses">Meses</option>
                      <option value="anos">Anos</option>
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className={LBL}>Valor total (R$) {REQ}</label>
                  <CurrencyInput value={form.valor_total} onChange={v => setForm(f => ({ ...f, valor_total: v }))} className={INP} placeholder="0,00" />
                </div>
                <div>
                  <label className={LBL}>Valor por mês (R$)</label>
                  <CurrencyInput value={form.valor_por_mes} onChange={v => setForm(f => ({ ...f, valor_por_mes: v }))} className={INP} placeholder="0,00" />
                </div>
              </div>
            </div>
          )}

          {/* ─── Modalidades ─── */}
          <SectionHeader title="Modalidades do contrato" open={openSections.modalidades} onToggle={() => toggleSection("modalidades")} />
          {openSections.modalidades && (
            <div className="px-6 py-5">
              {loadingMods ? (
                <div className="py-4 flex justify-center">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {modalidades.length === 0 ? (
                    <p className="text-sm text-gray-400 mb-4">Nenhuma modalidade adicionada.</p>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {modalidades.map((m, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                          <div>
                            <span className="text-sm font-medium text-gray-900">{m.nome}</span>
                            <span className="ml-2 text-xs text-gray-400">
                              {TIPO_ACESSO_LABEL[m.tipo_acesso]}
                              {m.tipo_acesso === "sessoes_semana" && m.sessoes_por_semana ? ` · ${m.sessoes_por_semana}x/semana` : ""}
                              {m.tipo_acesso === "pacote_aulas" && m.total_aulas ? ` · ${m.total_aulas} aulas` : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEditingModIdx(i); setShowModalidade(true); }}
                              className="p-1 rounded text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removeModalidade(i)}
                              className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => { setEditingModIdx(null); setShowModalidade(true); }}
                    className="inline-flex items-center gap-2 text-primary text-sm font-semibold hover:underline"
                  >
                    <Plus className="w-4 h-4" /> Adicionar modalidade
                  </button>
                  <div className=\"flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl mt-4\">
                    <div className=\"flex-1\">
                      <span className=\"text-sm font-medium text-gray-800\">Contabilizar sessões de forma conjunta</span>
                      <p className=\"text-xs text-gray-500 mt-0.5\">Ao ativar, todas as aulas realizadas contam no mesmo saldo, independente da modalidade.</p>
                    </div>
                    <button
                      type=\"button\"
                      onClick={() => setForm(f => ({ ...f, contabilizar_sessoes_conjunto: !f.contabilizar_sessoes_conjunto }))}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-4 ${form.contabilizar_sessoes_conjunto ? \"bg-primary\" : \"bg-gray-200\"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.contabilizar_sessoes_conjunto ? \"translate-x-5\" : \"\"}`} />
                    </button>
                  </div>                </>
              )}
            </div>
          )}

          {/* ─── Configurações ─── */}
          <SectionHeader title="Configurações" open={openSections.configuracoes} onToggle={() => toggleSection("configuracoes")} />
          {openSections.configuracoes && (
            <div className="px-6 py-5 space-y-4">
              <Toggle label="Permite renovação" checked={form.permite_renovar} onChange={v => setForm(f => ({ ...f, permite_renovar: v }))} />
              {form.permite_renovar && (
                <>
                  <Toggle label="Renovação automática" checked={form.renova_automaticamente} onChange={v => setForm(f => ({ ...f, renova_automaticamente: v }))} />
                  <div>
                    <label className={LBL}>Renovar quando</label>
                    <div className="relative mt-1">
                      <select value={form.renovacao_quando} onChange={e => setForm(f => ({ ...f, renovacao_quando: e.target.value }))} className={SEL}>
                        <option value="no_vencimento">No vencimento</option>
                        <option value="antes_vencimento">Antes do vencimento</option>
                        <option value="apos_vencimento">Após o vencimento</option>
                      </select>
                      <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </>
              )}

              <Toggle label="Permite parcelamento" checked={form.permite_parcelado} onChange={v => setForm(f => ({ ...f, permite_parcelado: v }))} />
              {form.permite_parcelado && (
                <div>
                  <label className={LBL}>Máximo de parcelas</label>
                  <input type="number" min={1} value={form.max_parcelas} onChange={e => setForm(f => ({ ...f, max_parcelas: e.target.value }))} className={INP} placeholder="Ex: 12" />
                </div>
              )}

              <Toggle label="Assinatura eletrônica" checked={form.assinatura_eletronica} onChange={v => setForm(f => ({ ...f, assinatura_eletronica: v }))} />
              {form.assinatura_eletronica && (
                <div>
                  <label className={LBL}>Forma de envio</label>
                  <div className="relative mt-1">
                    <select value={form.forma_envio_assinatura} onChange={e => setForm(f => ({ ...f, forma_envio_assinatura: e.target.value }))} className={SEL}>
                      <option value="email">E-mail</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Forma de pagamento ─── */}
          <SectionHeader title="Forma de pagamento" open={openSections.pagamento} onToggle={() => toggleSection("pagamento")} />
          {openSections.pagamento && (
            <div className="px-6 py-5">
              <p className="text-xs text-gray-500 mb-3">Selecione as formas de pagamento aceitas neste contrato:</p>
              <div className="grid grid-cols-2 gap-2">
                {FORMAS_PAGAMENTO.map(fp => (
                  <label key={fp.value} className="flex items-center gap-2.5 cursor-pointer group">
                    <div
                      onClick={() => togglePagto(fp.value)}
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0 cursor-pointer ${
                        form.formas_pagamento.includes(fp.value)
                          ? "bg-primary border-primary"
                          : "border-gray-300 group-hover:border-primary/50"
                      }`}
                    >
                      {form.formas_pagamento.includes(fp.value) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-gray-700">{fp.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ─── Configurações avançadas ─── */}
          <SectionHeader title="Configurações avançadas" open={openSections.avancadas} onToggle={() => toggleSection("avancadas")} />
          {openSections.avancadas && (
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowPermissoes(true)}
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Settings className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Permissões e restrições</p>
                    <p className="text-xs text-gray-400 mt-0.5">Suspensões, pré-venda, período</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowFinanceiro(true)}
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Financeiro</p>
                    <p className="text-xs text-gray-400 mt-0.5">Adesão, comissão, categoria</p>
                  </div>
                </button>
              </div>

              {/* Summary of advanced config */}
              {(form.possui_valor_adesao || form.comissionar_consultor || form.limita_periodo_venda || form.permite_pre_venda || form.max_suspensoes || form.max_dias_suspensao) && (
                <div className="mt-4 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-700 space-y-0.5">
                    {form.possui_valor_adesao && form.valor_adesao && <p>Adesão: R$ {parseFloat(form.valor_adesao).toFixed(2)}</p>}
                    {form.comissionar_consultor && <p>Comissão de consultor ativada</p>}
                    {form.limita_periodo_venda && <p>Período de venda limitado</p>}
                    {form.permite_pre_venda && <p>Pré-venda habilitada</p>}
                    {form.max_suspensoes && <p>Máx. {form.max_suspensoes} suspensão(ões)</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Footer ─── */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
            <button onClick={onClose} className="text-primary font-semibold text-sm hover:underline px-2">
              CANCELAR
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? "SALVANDO..." : isEdit ? "SALVAR" : "CADASTRAR"}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      {showPermissoes && (
        <PermissoesModal form={form} setForm={setForm} onClose={() => setShowPermissoes(false)} />
      )}
      {showFinanceiro && (
        <FinanceiroModal form={form} setForm={setForm} onClose={() => setShowFinanceiro(false)} />
      )}
      {showModalidade && (
        <ModalidadeModal
          initial={editingModIdx !== null ? modalidades[editingModIdx] : null}
          onSave={handleSaveModalidade}
          onClose={() => { setShowModalidade(false); setEditingModIdx(null); }}
        />
      )}
    </>
  );
}
