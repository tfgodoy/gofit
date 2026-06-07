import { useState, useEffect, useRef } from "react";
import {
  X, LayoutGrid, Calendar, CalendarCheck, Leaf, Plus, Trash2,
  Clock, ArrowLeftRight, ChevronDown, Search, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getIcon } from "./ModalidadeFormModal";
import ModalidadeFormModal from "./ModalidadeFormModal";
import { toast } from "sonner";

/* ─── Types ─────────────────────────────────────────────── */

export type TipoAcesso = "padrao" | "sessoes_semana" | "pacote_aulas" | "gonutri";

export interface PeriodoHorario {
  dias: string[];
  hora_inicial: string;
  hora_final: string;
  horario_livre: boolean;
}

export interface ModalidadeContrato {
  id?: string;
  tipo_acesso: TipoAcesso;
  modalidade_id: string | null;
  modalidade_nome: string;
  modalidade_cor: string;
  modalidade_icone: string;
  // Sessões por semana (sessoes_semana type)
  sessoes_por_semana: string;
  tipo_periodo_acesso: string;
  sessoes_no_periodo: string;
  considerar_antecipacoes: boolean;
  considerar_reagendamentos: boolean;
  // Configurações
  limitar_acessos: boolean;
  max_acessos: string;
  tipo_duracao_acessos: string;
  permite_antecipacoes: boolean;
  qtd_antecipacoes: string;
  limite_antecipacoes: string;
  permite_reagendamentos: boolean;
  qtd_reagendamentos: string;
  limite_reagendamentos: string;
  // Avançadas
  limitar_horarios: boolean;
  periodos_horario: PeriodoHorario[];
  permite_reposicao: boolean;
  max_reposicoes: string;
  limite_reposicoes_periodo: string;
  matricula_obrigatoria_na_venda: boolean;
}

interface DBModalidade {
  id: string;
  descricao: string;
  cor: string;
  icone: string;
}

interface Props {
  initial: ModalidadeContrato | null;
  onSave: (m: ModalidadeContrato) => void;
  onClose: () => void;
}

/* ─── Constants ──────────────────────────────────────────── */

const INP = "w-full bg-transparent border-0 border-b border-gray-300 py-2 px-0 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-b-2 focus:border-primary transition-colors";
const SEL = "w-full bg-transparent border-0 border-b border-gray-300 py-2 px-0 pr-6 text-sm text-gray-900 outline-none appearance-none focus:border-b-2 focus:border-primary transition-colors cursor-pointer";
const LBL = "block text-xs text-gray-500 mb-0.5";
const REQ = <span className="text-primary ml-0.5">*</span>;

const TIPO_OPTIONS: {
  value: TipoAcesso;
  label: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.ComponentType<any>;
  badge: string | null;
  sparkle: boolean;
}[] = [
  {
    value: "padrao",
    label: "Padrão",
    description: "Acesso livre, sem necessidade de agendamento, podendo ter limite de acessos semanais e horários restritos.",
    Icon: LayoutGrid,
    badge: null,
    sparkle: false,
  },
  {
    value: "sessoes_semana",
    label: "Sessões por semana",
    description: "O aluno agenda um número fixo de aulas semanais, podendo ter horários livres ou fixos.",
    Icon: Calendar,
    badge: "Utiliza agenda",
    sparkle: false,
  },
  {
    value: "pacote_aulas",
    label: "Pacote de aulas",
    description: "O aluno recebe um número total de aulas para usar conforme preferir, dentro do período definido.",
    Icon: CalendarCheck,
    badge: "Utiliza agenda",
    sparkle: false,
  },
  {
    value: "gonutri",
    label: "GoNutri",
    description: "Os alunos desta modalidade terão acesso ao GoNutri no aplicativo, com planos alimentares inteligentes e personalizados.",
    Icon: Leaf,
    badge: null,
    sparkle: true,
  },
];

const TIPO_DURACAO_OPTIONS = [
  { value: "semana",   label: "Por semana" },
  { value: "mes",      label: "Por mês" },
  { value: "dia",      label: "Por dia" },
  { value: "hora",     label: "Por hora" },
  { value: "vigencia", label: "Por vigência contrato" },
];

const PERIODO_OPTIONS = [
  { value: "semana", label: "Semana" },
  { value: "mes",    label: "Mês" },
  { value: "dia",    label: "Dia" },
];

const LIMITE_OPTIONS = [
  { value: "semana",   label: "Por semana" },
  { value: "mes",      label: "Por mês" },
  { value: "contrato", label: "Por contrato" },
];

const DIAS_SEMANA = [
  { value: "segunda", label: "Segunda" },
  { value: "terca",   label: "Terça" },
  { value: "quarta",  label: "Quarta" },
  { value: "quinta",  label: "Quinta" },
  { value: "sexta",   label: "Sexta" },
  { value: "sabado",  label: "Sábado" },
  { value: "domingo", label: "Domingo" },
];

const DEFAULT_PERIODO: PeriodoHorario = {
  dias: DIAS_SEMANA.map(d => d.value),
  hora_inicial: "",
  hora_final: "",
  horario_livre: false,
};

const EMPTY_FORM: Omit<ModalidadeContrato, "id"> = {
  tipo_acesso: "padrao",
  modalidade_id: null,
  modalidade_nome: "",
  modalidade_cor: "#f97316",
  modalidade_icone: "default",
  sessoes_por_semana: "",
  tipo_periodo_acesso: "semana",
  sessoes_no_periodo: "",
  considerar_antecipacoes: false,
  considerar_reagendamentos: false,
  limitar_acessos: false,
  max_acessos: "",
  tipo_duracao_acessos: "semana",
  permite_antecipacoes: false,
  qtd_antecipacoes: "",
  limite_antecipacoes: "semana",
  permite_reagendamentos: false,
  qtd_reagendamentos: "",
  limite_reagendamentos: "semana",
  limitar_horarios: false,
  periodos_horario: [],
  permite_reposicao: true,
  max_reposicoes: "10",
  limite_reposicoes_periodo: "semana",
  matricula_obrigatoria_na_venda: false,
};

/* ─── Small components ───────────────────────────────────── */

function Toggle({ label, checked, onChange }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-sm text-gray-800 flex-1">{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-4 ${checked ? "bg-primary" : "bg-gray-200"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <span title={text}
      className="w-4 h-4 rounded-full bg-gray-100 text-gray-500 text-xs inline-flex items-center justify-center cursor-help font-bold ml-1 flex-shrink-0">
      ?
    </span>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div onClick={() => onChange(!checked)}
        className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          checked ? "bg-primary border-primary" : "border-gray-300 hover:border-primary/50"
        }`}>
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

/* ─── Modalidade combobox ────────────────────────────────── */

function ModalidadeSelect({ value, onChange, modalidades, onAddNew }: {
  value: string;
  onChange: (id: string, nome: string, cor: string, icone: string) => void;
  modalidades: DBModalidade[];
  onAddNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selected = modalidades.find(m => m.id === value);
  const filtered = modalidades.filter(m => !search || m.descricao.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <button type="button" onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between border-b border-gray-300 py-2 px-0 text-sm hover:border-primary/60 transition-colors">
            <span className={selected ? "text-gray-900" : "text-gray-400"}>
              {selected ? selected.descricao : "Selecionar modalidade"}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
        <button type="button" onClick={onAddNew}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-primary hover:border-primary/40 transition-colors mb-0.5"
          title="Criar nova modalidade">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-8 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Pesquisar" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-primary/60"
                autoFocus />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Nenhuma modalidade encontrada.</p>
            ) : filtered.map(m => {
              const iconDef = getIcon(m.icone);
              const Ic = iconDef.Icon;
              return (
                <button key={m.id} type="button"
                  onClick={() => { onChange(m.id, m.descricao, m.cor, m.icone); setOpen(false); setSearch(""); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 transition-colors text-left">
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: m.cor + "22" }}>
                    <Ic className="w-3 h-3" style={{ color: m.cor }} />
                  </div>
                  {m.descricao}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Period card ────────────────────────────────────────── */

function PeriodoCard({ periodo, onChange, onDelete }: {
  periodo: PeriodoHorario;
  onChange: (p: PeriodoHorario) => void;
  onDelete: () => void;
}) {
  function toggleDia(dia: string) {
    const dias = periodo.dias.includes(dia)
      ? periodo.dias.filter(d => d !== dia)
      : [...periodo.dias, dia];
    onChange({ ...periodo, dias });
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex flex-wrap gap-1.5 flex-1">
          {DIAS_SEMANA.map(d => (
            <button key={d.value} type="button" onClick={() => toggleDia(d.value)}
              className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                periodo.dias.includes(d.value)
                  ? "bg-gray-200 text-gray-800"
                  : "border border-gray-200 text-gray-400 hover:border-gray-300"
              }`}>
              {d.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onDelete}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-end gap-4">
        {!periodo.horario_livre ? (
          <>
            <div className="flex-1">
              <label className={LBL}>Hora inicial {REQ}</label>
              <div className="relative flex items-center">
                <input type="time" value={periodo.hora_inicial}
                  onChange={e => onChange({ ...periodo, hora_inicial: e.target.value })}
                  className={INP + " pr-6"} />
                <Clock className="absolute right-0 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex-1">
              <label className={LBL}>Hora final {REQ}</label>
              <div className="relative flex items-center">
                <input type="time" value={periodo.hora_final}
                  onChange={e => onChange({ ...periodo, hora_final: e.target.value })}
                  className={INP + " pr-6"} />
                <Clock className="absolute right-0 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1" />
        )}
        <div className="flex items-center gap-2 pb-2">
          <span className="text-xs text-gray-600">Horário livre</span>
          <button type="button"
            onClick={() => onChange({ ...periodo, horario_livre: !periodo.horario_livre })}
            className={`relative w-8 h-4 rounded-full transition-colors ${periodo.horario_livre ? "bg-primary" : "bg-gray-200"}`}>
            <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${periodo.horario_livre ? "translate-x-4" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */

export default function ModalidadeContratoModal({ initial, onSave, onClose }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(initial ? 2 : 1);
  const [tipoAcesso, setTipoAcesso] = useState<TipoAcesso>(initial?.tipo_acesso ?? "padrao");
  const [showAvancadas, setShowAvancadas] = useState(false);
  const [showNewModalidade, setShowNewModalidade] = useState(false);
  const [modalidades, setModalidades] = useState<DBModalidade[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [form, setForm] = useState<ModalidadeContrato>({
    id: initial?.id,
    ...EMPTY_FORM,
    ...initial,
    tipo_acesso: initial?.tipo_acesso ?? "padrao",
  });

  useEffect(() => {
    if (!user?.contractorId) return;
    supabase.from("modalidades").select("id, descricao, cor, icone")
      .eq("contractor_id", user.contractorId).order("descricao")
      .then(({ data }) => setModalidades((data ?? []) as DBModalidade[]));
  }, [user, reloadKey]);

  const tipoInfo = TIPO_OPTIONS.find(t => t.value === tipoAcesso)!;
  const TipoIcon = tipoInfo.Icon;

  function handleSave() {
    if (!form.modalidade_id && tipoAcesso !== "gonutri") {
      toast.error("Selecione uma modalidade."); return;
    }
    if (tipoAcesso === "sessoes_semana" && !form.sessoes_por_semana) {
      toast.error("Informe a quantidade de sessões por semana."); return;
    }
    onSave({ ...form, tipo_acesso: tipoAcesso });
  }

  const isSessoes = tipoAcesso === "sessoes_semana";
  const isPacote = tipoAcesso === "pacote_aulas";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-6">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 my-auto">

          {/* ─── STEP 1: Select type ─── */}
          {step === 1 && (
            <>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <LayoutGrid className="w-4 h-4 text-primary" />
                  </div>
                  <h2 className="text-base font-bold text-gray-900">Adicionar modalidade ao contrato</h2>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5">
                <p className="text-sm text-gray-600 mb-4">Selecione o tipo de acesso da modalidade:</p>
                <div className="space-y-3">
                  {TIPO_OPTIONS.map(opt => {
                    const isSelected = tipoAcesso === opt.value;
                    const Ic = opt.Icon;
                    return (
                      <button key={opt.value} type="button" onClick={() => setTipoAcesso(opt.value)}
                        className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-colors ${
                          isSelected ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                        }`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-primary/15" : "bg-gray-100"}`}>
                          <Ic className={`w-5 h-5 ${isSelected ? "text-primary" : "text-gray-500"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-gray-800"}`}>{opt.label}</span>
                            {opt.badge && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{opt.badge}</span>
                            )}
                            {opt.sparkle && <Sparkles className="w-3.5 h-3.5 text-purple-400" />}
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed">{opt.description}</p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center ${
                          isSelected ? "border-primary bg-primary" : "border-gray-300"
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                <button onClick={onClose} className="text-primary font-semibold text-sm hover:underline px-2">CANCELAR</button>
                <button onClick={() => setStep(2)}
                  className="bg-primary text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
                  AVANÇAR
                </button>
              </div>
            </>
          )}

          {/* ─── STEP 2: Configure ─── */}
          {step === 2 && (
            <>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <TipoIcon className="w-4 h-4 text-primary" />
                  </div>
                  <h2 className="text-base font-bold text-gray-900">
                    Adicionar modalidade | {tipoInfo.label}
                  </h2>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto" style={{ maxHeight: "72vh" }}>

                {/* ── Dados da modalidade ── */}
                <div className="mx-5 mt-5 mb-4 bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-800">Dados da modalidade</h3>
                    <button type="button" onClick={() => setStep(1)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      ALTERAR TIPO DE ACESSO
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Modalidade selector */}
                    <div>
                      <label className={LBL}>Modalidade {REQ}</label>
                      <ModalidadeSelect
                        value={form.modalidade_id ?? ""}
                        onChange={(id, nome, cor, icone) => setForm(f => ({ ...f, modalidade_id: id, modalidade_nome: nome, modalidade_cor: cor, modalidade_icone: icone }))}
                        modalidades={modalidades}
                        onAddNew={() => setShowNewModalidade(true)}
                      />
                    </div>

                    {/* Sessões por semana — aparece inline nos dados para o tipo sessoes_semana */}
                    {isSessoes && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={LBL}>Quantidade de sessões por semana {REQ}</label>
                          <input type="number" min={1} max={14} value={form.sessoes_por_semana}
                            onChange={e => setForm(f => ({ ...f, sessoes_por_semana: e.target.value }))}
                            className={INP} placeholder="Ex: 3" />
                        </div>
                        <div>
                          <label className={LBL}>Tipo de acesso por período {REQ}</label>
                          <div className="relative">
                            <select value={form.tipo_periodo_acesso}
                              onChange={e => setForm(f => ({ ...f, tipo_periodo_acesso: e.target.value }))}
                              className={SEL}>
                              {PERIODO_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    )}

                    {isSessoes && (
                      <div>
                        <label className={LBL}>Quantidade de sessões no período</label>
                        <input type="number" min={1} value={form.sessoes_no_periodo}
                          onChange={e => setForm(f => ({ ...f, sessoes_no_periodo: e.target.value }))}
                          className={INP} placeholder="Deixe em branco para ilimitado" />
                      </div>
                    )}

                    {isSessoes && (
                      <div>
                        <span className="text-xs text-gray-500">↳ Considerar também:</span>
                        <div className="flex items-center gap-6 mt-2">
                          <Checkbox label="Antecipações" checked={form.considerar_antecipacoes}
                            onChange={v => setForm(f => ({ ...f, considerar_antecipacoes: v }))} />
                          <Checkbox label="Reagendamentos" checked={form.considerar_reagendamentos}
                            onChange={v => setForm(f => ({ ...f, considerar_reagendamentos: v }))} />
                        </div>
                      </div>
                    )}

                    {/* Total de aulas para pacote */}
                    {isPacote && (
                      <div>
                        <label className={LBL}>Total de aulas no pacote {REQ}</label>
                        <input type="number" min={1} value={form.max_acessos}
                          onChange={e => setForm(f => ({ ...f, max_acessos: e.target.value }))}
                          className={INP} placeholder="Ex: 20" />
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Configurações ── */}
                {tipoAcesso !== "gonutri" && (
                  <div className="mx-5 mb-4 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                    <h3 className="text-sm font-bold text-gray-800">Configurações</h3>

                    {/* Padrão: limitar acessos */}
                    {tipoAcesso === "padrao" && (
                      <>
                        <Toggle
                          label="Limitar quantidade de acessos"
                          checked={form.limitar_acessos}
                          onChange={v => setForm(f => ({ ...f, limitar_acessos: v }))}
                        />
                        {form.limitar_acessos && (
                          <div className="ml-4 flex items-end gap-3">
                            <span className="text-xs text-gray-400 pb-2.5 flex-shrink-0">↳ Máximo de</span>
                            <div className="w-24">
                              <label className={LBL}>Quantidade {REQ}</label>
                              <input type="number" min={1} value={form.max_acessos}
                                onChange={e => setForm(f => ({ ...f, max_acessos: e.target.value }))}
                                className={INP} placeholder="1" />
                            </div>
                            <div className="flex-1">
                              <label className={LBL}>Tipo de duração {REQ}</label>
                              <div className="relative">
                                <select value={form.tipo_duracao_acessos}
                                  onChange={e => setForm(f => ({ ...f, tipo_duracao_acessos: e.target.value }))}
                                  className={SEL}>
                                  {TIPO_DURACAO_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Sessões semana: antecipações e reagendamentos */}
                    {isSessoes && (
                      <>
                        <Toggle
                          label={
                            <span className="flex items-center gap-1">
                              Permite antecipações
                              <Tooltip text="Habilitando essa opção, o cliente poderá antecipar as aulas do seu contrato, limitado a quantidade e periodicidade definidas nesta configuração." />
                            </span>
                          }
                          checked={form.permite_antecipacoes}
                          onChange={v => setForm(f => ({ ...f, permite_antecipacoes: v }))}
                        />
                        {form.permite_antecipacoes && (
                          <div className="ml-4 grid grid-cols-2 gap-4">
                            <div>
                              <label className={LBL}>Quantidade {REQ}</label>
                              <input type="number" min={1} value={form.qtd_antecipacoes}
                                onChange={e => setForm(f => ({ ...f, qtd_antecipacoes: e.target.value }))}
                                className={INP} placeholder="Ex: 2" />
                            </div>
                            <div>
                              <label className={LBL}>Limite {REQ}</label>
                              <div className="relative">
                                <select value={form.limite_antecipacoes}
                                  onChange={e => setForm(f => ({ ...f, limite_antecipacoes: e.target.value }))}
                                  className={SEL}>
                                  {LIMITE_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                          </div>
                        )}

                        <Toggle
                          label={
                            <span className="flex items-center gap-1">
                              Permite reagendamentos
                              <Tooltip text="Permite que o aluno reagende aulas dentro do limite configurado." />
                            </span>
                          }
                          checked={form.permite_reagendamentos}
                          onChange={v => setForm(f => ({ ...f, permite_reagendamentos: v }))}
                        />
                        {form.permite_reagendamentos && (
                          <div className="ml-4 grid grid-cols-2 gap-4">
                            <div>
                              <label className={LBL}>Quantidade {REQ}</label>
                              <input type="number" min={1} value={form.qtd_reagendamentos}
                                onChange={e => setForm(f => ({ ...f, qtd_reagendamentos: e.target.value }))}
                                className={INP} placeholder="Ex: 2" />
                            </div>
                            <div>
                              <label className={LBL}>Limite {REQ}</label>
                              <div className="relative">
                                <select value={form.limite_reagendamentos}
                                  onChange={e => setForm(f => ({ ...f, limite_reagendamentos: e.target.value }))}
                                  className={SEL}>
                                  {LIMITE_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ── Configurações avançadas ── */}
                <div className="mx-5 mb-5 bg-white rounded-xl border border-gray-200">
                  <button type="button" onClick={() => setShowAvancadas(o => !o)}
                    className="w-full flex items-center justify-between p-5">
                    <span className="text-sm font-bold text-gray-800">
                      Configurações avançadas{" "}
                      <span className="font-normal text-gray-400">(Opcional)</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showAvancadas ? "rotate-180" : ""}`} />
                  </button>

                  {showAvancadas && (
                    <div className="px-5 pb-5 border-t border-gray-100 space-y-4 pt-4">
                      {/* Reposições — só para sessoes/pacote */}
                      {(isSessoes || isPacote) && (
                        <>
                          <Toggle
                            label={
                              <span className="flex items-center gap-1">
                                Permite reposições
                                <Tooltip text="Quando o aluno cancelar uma aula, o sistema gera um crédito de reposição para uso posterior." />
                              </span>
                            }
                            checked={form.permite_reposicao}
                            onChange={v => setForm(f => ({ ...f, permite_reposicao: v }))}
                          />
                          {form.permite_reposicao && (
                            <div className="ml-4 grid grid-cols-2 gap-4">
                              <div>
                                <label className={LBL}>Quantidade máxima</label>
                                <input type="number" min={1} value={form.max_reposicoes}
                                  onChange={e => setForm(f => ({ ...f, max_reposicoes: e.target.value }))}
                                  className={INP} placeholder="Ex: 10" />
                              </div>
                              <div>
                                <label className={LBL}>Limite por</label>
                                <div className="relative">
                                  <select value={form.limite_reposicoes_periodo}
                                    onChange={e => setForm(f => ({ ...f, limite_reposicoes_periodo: e.target.value }))}
                                    className={SEL}>
                                    <option value="semana">Semana</option>
                                    <option value="mes">Mês</option>
                                    <option value="contrato">Contrato (total)</option>
                                  </select>
                                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      <Toggle
                        label={
                          <span className="flex items-center gap-1">
                            Matrícula obrigatória no ato da venda
                            <Tooltip text="Ao habilitar, será solicitado ao vendedor que escolha a turma do aluno no momento da venda deste contrato." />
                          </span>
                        }
                        checked={form.matricula_obrigatoria_na_venda}
                        onChange={v => setForm(f => ({ ...f, matricula_obrigatoria_na_venda: v }))}
                      />

                      <Toggle
                        label={
                          <span className="flex items-center gap-1">
                            Limitar dias e horários promocionais
                            <Tooltip text="Habilitando essa opção, você poderá limitar os dias e horários promocionais para o cliente frequentar o seu estabelecimento." />
                          </span>
                        }
                        checked={form.limitar_horarios}
                        onChange={v => setForm(f => ({
                          ...f,
                          limitar_horarios: v,
                          periodos_horario: v && f.periodos_horario.length === 0
                            ? [{ ...DEFAULT_PERIODO }]
                            : f.periodos_horario,
                        }))}
                      />

                      {form.limitar_horarios && (
                        <div className="space-y-3">
                          {form.periodos_horario.map((p, i) => (
                            <PeriodoCard key={i} periodo={p}
                              onChange={updated => setForm(f => ({
                                ...f,
                                periodos_horario: f.periodos_horario.map((pp, ii) => ii === i ? updated : pp),
                              }))}
                              onDelete={() => setForm(f => ({
                                ...f,
                                periodos_horario: f.periodos_horario.filter((_, ii) => ii !== i),
                              }))}
                            />
                          ))}
                          <button type="button"
                            onClick={() => setForm(f => ({ ...f, periodos_horario: [...f.periodos_horario, { ...DEFAULT_PERIODO }] }))}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline mt-1">
                            <Plus className="w-4 h-4" />
                            + NOVO PERÍODO
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                <button onClick={onClose} className="text-primary font-semibold text-sm hover:underline px-2">CANCELAR</button>
                <button onClick={handleSave}
                  className="bg-primary text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
                  SALVAR
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showNewModalidade && (
        <ModalidadeFormModal
          modalidade={null}
          onClose={() => setShowNewModalidade(false)}
          onSaved={() => { setShowNewModalidade(false); setReloadKey(k => k + 1); }}
        />
      )}
    </>
  );
}
