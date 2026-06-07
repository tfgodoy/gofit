import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, Pencil, ChevronDown, ChevronUp,
  CreditCard, RefreshCw, Star, CheckCircle2, XCircle,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getIcon } from "@/components/app/ModalidadeFormModal";
import ModalidadeContratoModal, { type ModalidadeContrato } from "@/components/app/ModalidadeContratoModal";

/* ─── Types ─────────────────────────────────────────────── */

const TIPO_ACESSO_LABEL: Record<string, string> = {
  padrao: "Padrão",
  sessoes_semana: "Sessões/semana",
  pacote_aulas: "Pacote de aulas",
  gonutri: "GoNutri",
};



type TipoCobranca = "sem_recorrencia" | "com_recorrencia" | "escolha_na_venda";

const EMPTY_FORM = {
  descricao: "",
  tipo: "padrao",
  duracao: "1",
  tipo_duracao: "meses",
  valor_total: "",
  permite_renovar: false,
  renova_automaticamente: false,
  permite_parcelado: false,
  vende_app_aluno: false,
  template_contrato: "",
  assinatura_eletronica: false,
  tipo_cobranca: "escolha_na_venda" as TipoCobranca,
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

/* ─── Currency mask ─────────────────────────────────────── */

function formatCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCurrency(formatted: string): number {
  return parseFloat(formatted.replace(/\./g, "").replace(",", ".")) || 0;
}

/* ─── Style helpers ──────────────────────────────────────── */

const INP = "w-full bg-transparent border-0 border-b border-gray-300 py-2 px-0 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-b-2 focus:border-primary transition-colors";
const SEL = "w-full bg-transparent border-0 border-b border-gray-300 py-2 px-0 pr-6 text-sm text-gray-900 outline-none appearance-none focus:border-b-2 focus:border-primary transition-colors cursor-pointer";
const LBL = "block text-xs text-gray-500 mb-0.5";
const REQ = <span className="text-primary ml-0.5">*</span>;

function Toggle({ label, checked, onChange, sub }: {
  label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; sub?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2 ${sub ? "ml-6" : ""}`}>
      {sub && <span className="text-gray-300 mr-2 flex-shrink-0">↳</span>}
      <span className="text-sm text-gray-800 flex-1">{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-4 ${checked ? "bg-primary" : "bg-gray-200"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <span title={text}
      className="w-4 h-4 rounded-full bg-gray-100 text-gray-400 text-xs inline-flex items-center justify-center cursor-help font-bold ml-1 flex-shrink-0">?</span>
  );
}

/* ─── Page ───────────────────────────────────────────────── */

export default function ContratoFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [modalidades, setModalidades] = useState<ModalidadeContrato[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [showAvancadas, setShowAvancadas] = useState(false);
  const [showModalidadeModal, setShowModalidadeModal] = useState(false);
  const [editingModalidadeIdx, setEditingModalidadeIdx] = useState<number | null>(null);

  /* Load for edit */
  useEffect(() => {
    if (!isEdit || !user?.contractorId) return;
    async function load() {
      const { data: c } = await supabase.from("contratos").select("*").eq("id", id!).single();
      if (!c) { toast.error("Contrato não encontrado."); navigate("/app/administrativo/contratos"); return; }

      setForm({
        descricao: c.descricao ?? "",
        tipo: c.tipo ?? "padrao",
        duracao: String(c.duracao ?? 1),
        tipo_duracao: c.tipo_duracao ?? "meses",
        valor_total: c.valor_total != null ? (c.valor_total as number).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
        permite_renovar: c.permite_renovar ?? false,
        renova_automaticamente: c.renova_automaticamente ?? false,
        permite_parcelado: c.permite_parcelado ?? false,
        vende_app_aluno: (c as any).vende_app_aluno ?? false,
        template_contrato: c.template_contrato ?? "",
        assinatura_eletronica: c.assinatura_eletronica ?? false,
        tipo_cobranca: ((c as any).tipo_cobranca ?? "escolha_na_venda") as TipoCobranca,
        ativo: c.ativo ?? true,
        limita_periodo_venda: c.limita_periodo_venda ?? false,
        data_inicio_venda: c.data_inicio_venda ?? "",
        data_fim_venda: c.data_fim_venda ?? "",
        max_suspensoes: c.max_suspensoes != null ? String(c.max_suspensoes) : "",
        max_dias_suspensao: c.max_dias_suspensao != null ? String(c.max_dias_suspensao) : "",
        permite_pre_venda: c.permite_pre_venda ?? false,
        possui_valor_adesao: c.possui_valor_adesao ?? false,
        valor_adesao: c.valor_adesao != null ? String(c.valor_adesao) : "",
        comissionar_consultor: c.comissionar_consultor ?? false,
        categoria_receita: c.categoria_receita ?? "",
        contabilizar_sessoes_conjunto: (c as any).contabilizar_sessoes_conjunto ?? false,
      });

      // Load modalidades
      const { data: mods } = await supabase
        .from("contrato_modalidades")
        .select("*, modalidades(descricao, cor, icone)")
        .eq("contrato_id", id!)
        .order("created_at");

      setModalidades((mods ?? []).map((m: any) => ({
        id: m.id,
        tipo_acesso: m.tipo_acesso,
        modalidade_id: m.modalidade_id,
        modalidade_nome: m.modalidades?.descricao ?? m.nome ?? "",
        modalidade_cor: m.modalidades?.cor ?? "#f97316",
        modalidade_icone: m.modalidades?.icone ?? "default",
        sessoes_por_semana: m.sessoes_por_semana != null ? String(m.sessoes_por_semana) : "",
        tipo_periodo_acesso: m.tipo_periodo_acesso ?? "semana",
        sessoes_no_periodo: m.sessoes_no_periodo != null ? String(m.sessoes_no_periodo) : "",
        considerar_antecipacoes: m.considerar_antecipacoes ?? false,
        considerar_reagendamentos: m.considerar_reagendamentos ?? false,
        limitar_acessos: m.limitar_acessos ?? false,
        max_acessos: m.max_acessos != null ? String(m.max_acessos) : "",
        tipo_duracao_acessos: m.tipo_duracao_acessos ?? "semana",
        permite_antecipacoes: m.permite_antecipacoes ?? false,
        qtd_antecipacoes: m.qtd_antecipacoes != null ? String(m.qtd_antecipacoes) : "",
        limite_antecipacoes: m.limite_antecipacoes ?? "semana",
        permite_reagendamentos: m.permite_reagendamentos ?? false,
        qtd_reagendamentos: m.qtd_reagendamentos != null ? String(m.qtd_reagendamentos) : "",
        limite_reagendamentos: m.limite_reagendamentos ?? "semana",
        limitar_horarios: m.limitar_horarios ?? false,
        periodos_horario: Array.isArray(m.periodos_horario) ? m.periodos_horario : [],
        permite_reposicao: m.permite_reposicao ?? true,
        max_reposicoes: m.max_reposicoes != null ? String(m.max_reposicoes) : "10",
        limite_reposicoes_periodo: m.limite_reposicoes_periodo ?? "semana",
        matricula_obrigatoria_na_venda: m.matricula_obrigatoria_na_venda ?? false,
      })));

      setLoading(false);
    }
    load();
  }, [isEdit, id, user]);

  function handleSaveModalidade(m: ModalidadeContrato) {
    if (editingModalidadeIdx !== null) {
      setModalidades(prev => prev.map((item, i) => i === editingModalidadeIdx ? m : item));
    } else {
      setModalidades(prev => [...prev, m]);
    }
    setShowModalidadeModal(false);
    setEditingModalidadeIdx(null);
  }

  async function handleSave() {
    if (!form.descricao.trim()) { toast.error("Informe a descrição do contrato."); return; }
    const valorTotal = parseCurrency(form.valor_total);
    if (!valorTotal || form.valor_total === "") { toast.error("Informe o valor total do contrato."); return; }
    if (!user?.contractorId) return;

    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {
        contractor_id: user.contractorId,
        descricao: form.descricao.trim(),
        tipo: form.tipo,
        duracao: parseInt(form.duracao) || 1,
        tipo_duracao: form.tipo_duracao,
        valor_total: valorTotal,
        permite_renovar: form.permite_renovar,
        renova_automaticamente: form.permite_renovar ? form.renova_automaticamente : false,
        permite_parcelado: form.permite_parcelado,
        vende_app_aluno: form.vende_app_aluno,
        template_contrato: form.template_contrato || null,
        assinatura_eletronica: form.assinatura_eletronica,
        tipo_cobranca: form.tipo_cobranca,
        formas_pagamento: [],
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

      let contratoId = id;
      if (isEdit) {
        const { error } = await supabase.from("contratos").update(payload).eq("id", id!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("contratos").insert(payload).select("id").single();
        if (error) throw error;
        contratoId = data.id;
      }

      // Sync modalidades
      await supabase.from("contrato_modalidades").delete().eq("contrato_id", contratoId!);
      if (modalidades.length > 0) {
        const modsPayload = modalidades.map(m => ({
          contrato_id: contratoId!,
          nome: m.modalidade_nome,
          tipo_acesso: m.tipo_acesso,
          modalidade_id: m.modalidade_id,
          sessoes_por_semana: m.sessoes_por_semana ? parseInt(m.sessoes_por_semana) : null,
          tipo_periodo_acesso: m.tipo_periodo_acesso ?? "semana",
          sessoes_no_periodo: m.sessoes_no_periodo ? parseInt(m.sessoes_no_periodo) : null,
          considerar_antecipacoes: m.considerar_antecipacoes,
          considerar_reagendamentos: m.considerar_reagendamentos,
          limitar_acessos: m.limitar_acessos,
          max_acessos: m.limitar_acessos && m.max_acessos ? parseInt(m.max_acessos) : (m.tipo_acesso === "pacote_aulas" && m.max_acessos ? parseInt(m.max_acessos) : null),
          tipo_duracao_acessos: m.tipo_duracao_acessos,
          permite_antecipacoes: m.permite_antecipacoes,
          qtd_antecipacoes: m.permite_antecipacoes && m.qtd_antecipacoes ? parseInt(m.qtd_antecipacoes) : null,
          limite_antecipacoes: m.permite_antecipacoes ? m.limite_antecipacoes : null,
          permite_reagendamentos: m.permite_reagendamentos,
          qtd_reagendamentos: m.permite_reagendamentos && m.qtd_reagendamentos ? parseInt(m.qtd_reagendamentos) : null,
          limite_reagendamentos: m.permite_reagendamentos ? m.limite_reagendamentos : null,
          limitar_horarios: m.limitar_horarios,
          periodos_horario: m.periodos_horario,
          permite_reposicao: m.permite_reposicao,
          max_reposicoes: m.permite_reposicao && m.max_reposicoes ? parseInt(m.max_reposicoes) : null,
          limite_reposicoes_periodo: m.limite_reposicoes_periodo,
          matricula_obrigatoria_na_venda: m.matricula_obrigatoria_na_venda,
          total_aulas: null,
          contabilizar_conjunto: false,
        }));
        await supabase.from("contrato_modalidades").insert(modsPayload);
      }

      toast.success(isEdit ? "Contrato atualizado." : "Contrato criado.");
      navigate("/app/administrativo/contratos");
    } catch (err) {
      console.error("contrato save error:", err);
      toast.error("Erro ao salvar contrato.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/app/administrativo/contratos")}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{isEdit ? "Editar contrato" : "Novo contrato"}</h1>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-gray-50 px-8 py-6">
          <div className="max-w-3xl mx-auto space-y-4">

            {/* ─── Dados principais ─── */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">Dados principais</h3>
              <div className="space-y-4">
                <div>
                  <label className={LBL}>Descrição {REQ}</label>
                  <input type="text" value={form.descricao}
                    onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                    className={INP} placeholder="Nome do contrato" autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className={LBL}>Duração {REQ}</label>
                    <input type="number" min={1} value={form.duracao}
                      onChange={e => setForm(f => ({ ...f, duracao: e.target.value }))}
                      className={INP} placeholder="1" />
                  </div>
                  <div>
                    <label className={LBL}>Tipo de duração {REQ}</label>
                    <div className="relative">
                      <select value={form.tipo_duracao}
                        onChange={e => setForm(f => ({ ...f, tipo_duracao: e.target.value }))}
                        className={SEL}>
                        <option value="dias">Dias</option>
                        <option value="meses">Meses</option>
                        <option value="anos">Anos</option>
                      </select>
                      <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5 items-end">
                  <div>
                    <label className={LBL}>Valor total do contrato {REQ}</label>
                    <div className="relative">
                      <span className="absolute left-0 top-2.5 text-xs text-gray-400">R$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.valor_total}
                        onChange={e => setForm(f => ({ ...f, valor_total: formatCurrency(e.target.value) }))}
                        className={INP + " pl-7"}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  {form.tipo_duracao === "meses" && parseFloat(form.duracao) > 1 && parseCurrency(form.valor_total) > 0 && (
                    <div>
                      <label className={LBL}>Valor por mês</label>
                      <div className="flex items-center gap-1.5 pb-2">
                        <span className="text-xs text-gray-400">ou</span>
                        <span className="text-sm font-semibold text-gray-700">
                          R$ {(parseCurrency(form.valor_total) / parseFloat(form.duracao)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─── Modalidades do contrato ─── */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800">Modalidades do contrato</h3>
                <button type="button"
                  onClick={() => { setEditingModalidadeIdx(null); setShowModalidadeModal(true); }}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                  <Plus className="w-4 h-4" /> + MODALIDADE
                </button>
              </div>

              {modalidades.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Não há modalidades para esse contrato</p>
              ) : (
                <div className="space-y-2 mt-2">
                  {modalidades.map((m, i) => {

                    const iconDef = getIcon(m.modalidade_icone);
                    const Ic = iconDef.Icon;
                    return (
                      <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: m.modalidade_cor + "22" }}>
                          <Ic className="w-4 h-4" style={{ color: m.modalidade_cor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900">{m.modalidade_nome || "(sem nome)"}</span>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-400">{TIPO_ACESSO_LABEL[m.tipo_acesso]}</span>
                            {m.sessoes_por_semana && (
                              <span className="text-xs font-semibold text-primary/70">{m.sessoes_por_semana}x por semana</span>
                            )}
                            {m.limitar_acessos && m.max_acessos && (
                              <span className="text-xs text-gray-400">· máx. {m.max_acessos}</span>
                            )}
                            {m.matricula_obrigatoria_na_venda && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">Matrícula na venda</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button"
                            onClick={() => { setEditingModalidadeIdx(i); setShowModalidadeModal(true); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button"
                            onClick={() => setModalidades(prev => prev.filter((_, ii) => ii !== i))}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Toggle contabilização conjunta — só aparece com 2+ modalidades */}
              {modalidades.length >= 2 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <Toggle
                    label={
                      <span className="flex flex-col">
                        <span>Contabilizar de forma conjunta as aulas/sessões das modalidades</span>
                        <span className="text-xs font-normal text-gray-400 mt-0.5">
                          Ao marcar esta opção, todas as aulas realizadas pelo cliente diminuirão da quantidade total independente da modalidade.
                        </span>
                      </span>
                    }
                    checked={form.contabilizar_sessoes_conjunto}
                    onChange={v => setForm(f => ({ ...f, contabilizar_sessoes_conjunto: v }))}
                  />
                </div>
              )}
            </div>

            {/* ─── Configurações ─── */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-2">Configurações</h3>
              <div className="divide-y divide-gray-50">
                <Toggle label={<span className="flex items-center">Permite renovar<Tip text="Permite que o aluno renove o contrato ao vencer." /></span>}
                  checked={form.permite_renovar} onChange={v => setForm(f => ({ ...f, permite_renovar: v }))} />
                {form.permite_renovar && (
                  <Toggle sub label={<span className="flex items-center">Renova automaticamente<Tip text="O sistema renova o contrato automaticamente na data de vencimento." /></span>}
                    checked={form.renova_automaticamente} onChange={v => setForm(f => ({ ...f, renova_automaticamente: v }))} />
                )}
                <Toggle label="Permite receber parcelado"
                  checked={form.permite_parcelado} onChange={v => setForm(f => ({ ...f, permite_parcelado: v }))} />
                <Toggle label={<span className="flex items-center">Vende através do app do aluno<Tip text="Permite que o aluno compre este contrato diretamente pelo aplicativo." /></span>}
                  checked={form.vende_app_aluno} onChange={v => setForm(f => ({ ...f, vende_app_aluno: v }))} />

                {/* Template de contrato */}
                <div className="py-3">
                  <label className={LBL}>Template de contrato</label>
                  <div className="flex items-end gap-2">
                    <input type="text" value={form.template_contrato}
                      onChange={e => setForm(f => ({ ...f, template_contrato: e.target.value }))}
                      className={INP + " flex-1"} placeholder="Selecionar template" />
                    <button type="button" className="p-1.5 rounded border border-gray-200 text-gray-400 hover:border-primary/40 hover:text-primary mb-0.5 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" className="p-1.5 rounded border border-gray-200 text-gray-400 hover:border-primary/40 hover:text-primary mb-0.5 transition-colors">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <Toggle sub label={<span className="flex items-center">Enviar contrato para assinatura eletrônica<Tip text="O contrato será enviado ao aluno para assinar eletronicamente." /></span>}
                  checked={form.assinatura_eletronica} onChange={v => setForm(f => ({ ...f, assinatura_eletronica: v }))} />
              </div>
            </div>

            {/* ─── Forma de pagamento ─── */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">Forma de pagamento</h3>
              <div className="grid grid-cols-3 gap-3">

                {/* Sem recorrência */}
                {(["sem_recorrencia", "com_recorrencia", "escolha_na_venda"] as TipoCobranca[]).map(tipo => {
                  const isSelected = form.tipo_cobranca === tipo;
                  const configs = {
                    sem_recorrencia: {
                      label: "Sem recorrência",
                      Icon: CreditCard,
                      popular: false,
                      features: [
                        { label: "Recorrência", ok: false },
                        { label: "Renovação automática", ok: false },
                        { label: "Renovação manual", ok: true },
                      ],
                    },
                    com_recorrencia: {
                      label: "Com recorrência (GoFit Pay)",
                      Icon: () => (
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                        </svg>
                      ),
                      popular: true,
                      features: [
                        { label: "Recorrência", ok: true },
                        { label: "Renovação automática", ok: true },
                        { label: "Renovação manual", ok: false },
                      ],
                    },
                    escolha_na_venda: {
                      label: "Escolha na venda",
                      Icon: RefreshCw,
                      popular: false,
                      features: [
                        { label: "Recorrência (opcional)", ok: true },
                        { label: "Renovação automática", ok: true },
                        { label: "Renovação manual", ok: true },
                      ],
                    },
                  }[tipo];

                  const Ic = configs.Icon;
                  return (
                    <button key={tipo} type="button"
                      onClick={() => setForm(f => ({ ...f, tipo_cobranca: tipo }))}
                      className={`relative flex flex-col gap-3 p-4 rounded-xl border-2 text-left transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                      }`}>
                      {configs.popular && (
                        <span className="absolute -top-3 right-3 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary text-white">
                          <Star className="w-3 h-3 fill-white" /> Mais popular
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                          isSelected ? "border-primary bg-primary" : "border-gray-300"
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <Ic className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-primary" : "text-gray-500"}`} />
                        <span className={`text-xs font-semibold leading-tight ${isSelected ? "text-primary" : "text-gray-800"}`}>
                          {configs.label}
                        </span>
                      </div>
                      <div className="space-y-1.5 border-t border-gray-100 pt-3">
                        {configs.features.map(f => (
                          <div key={f.label} className="flex items-center gap-1.5">
                            {f.ok
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                            <span className="text-xs text-gray-600">{f.label}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─── Configurações avançadas ─── */}
            <div className="bg-white rounded-xl border border-gray-200">
              <button type="button" onClick={() => setShowAvancadas(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4">
                <h3 className="text-sm font-bold text-gray-800">
                  Configurações avançadas{" "}
                  <span className="font-normal text-gray-400">(Opcional)</span>
                </h3>
                {showAvancadas
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {showAvancadas && (
                <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                  <Toggle label="Limitar período de vendas"
                    checked={form.limita_periodo_venda} onChange={v => setForm(f => ({ ...f, limita_periodo_venda: v }))} />
                  {form.limita_periodo_venda && (
                    <div className="grid grid-cols-2 gap-5 ml-6">
                      <div>
                        <label className={LBL}>Data início venda</label>
                        <input type="date" value={form.data_inicio_venda}
                          onChange={e => setForm(f => ({ ...f, data_inicio_venda: e.target.value }))} className={INP} />
                      </div>
                      <div>
                        <label className={LBL}>Data fim venda</label>
                        <input type="date" value={form.data_fim_venda}
                          onChange={e => setForm(f => ({ ...f, data_fim_venda: e.target.value }))} className={INP} />
                      </div>
                    </div>
                  )}
                  <Toggle label="Permitir pré-venda"
                    checked={form.permite_pre_venda} onChange={v => setForm(f => ({ ...f, permite_pre_venda: v }))} />
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className={LBL}>Máx. suspensões</label>
                      <input type="number" min={0} value={form.max_suspensoes}
                        onChange={e => setForm(f => ({ ...f, max_suspensoes: e.target.value }))}
                        className={INP} placeholder="Sem limite" />
                    </div>
                    <div>
                      <label className={LBL}>Máx. dias por suspensão</label>
                      <input type="number" min={0} value={form.max_dias_suspensao}
                        onChange={e => setForm(f => ({ ...f, max_dias_suspensao: e.target.value }))}
                        className={INP} placeholder="Sem limite" />
                    </div>
                  </div>
                  <Toggle label="Possui valor de adesão"
                    checked={form.possui_valor_adesao} onChange={v => setForm(f => ({ ...f, possui_valor_adesao: v }))} />
                  {form.possui_valor_adesao && (
                    <div className="ml-6">
                      <label className={LBL}>Valor de adesão (R$)</label>
                      <input type="number" min={0} step={0.01} value={form.valor_adesao}
                        onChange={e => setForm(f => ({ ...f, valor_adesao: e.target.value }))}
                        className={INP} placeholder="0,00" />
                    </div>
                  )}
                  <Toggle label="Comissionar consultor"
                    checked={form.comissionar_consultor} onChange={v => setForm(f => ({ ...f, comissionar_consultor: v }))} />
                  <div>
                    <label className={LBL}>Categoria de receita</label>
                    <input type="text" value={form.categoria_receita}
                      onChange={e => setForm(f => ({ ...f, categoria_receita: e.target.value }))}
                      className={INP} placeholder="Ex: Mensalidade" />
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-100 px-8 py-4 flex justify-end gap-3">
          <button onClick={() => navigate("/app/administrativo/contratos")}
            className="text-primary font-semibold text-sm hover:underline px-2">
            CANCELAR
          </button>
          <button onClick={handleSave} disabled={saving}
            className="bg-primary text-white font-semibold text-sm px-5 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60">
            {saving ? "SALVANDO..." : "SALVAR"}
          </button>
        </div>
      </div>

      {/* Modalidade modal */}
      {showModalidadeModal && (
        <ModalidadeContratoModal
          initial={editingModalidadeIdx !== null ? modalidades[editingModalidadeIdx] : null}
          onSave={handleSaveModalidade}
          onClose={() => { setShowModalidadeModal(false); setEditingModalidadeIdx(null); }}
        />
      )}
    </AppLayout>
  );
}
