import { useState, useEffect } from "react";
import { X, ChevronDown, Settings, Clock, Users, Shield, Smartphone, DollarSign, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const INP = "w-full bg-transparent border-0 border-b border-gray-300 py-2 px-0 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-b-2 focus:border-primary transition-colors";
const SEL = "w-full bg-transparent border-0 border-b border-gray-300 py-2 px-0 pr-6 text-sm text-gray-900 outline-none appearance-none focus:border-b-2 focus:border-primary transition-colors cursor-pointer";

const DIAS = [
  { value: "seg", label: "Seg", js: 1 },
  { value: "ter", label: "Ter", js: 2 },
  { value: "qua", label: "Qua", js: 3 },
  { value: "qui", label: "Qui", js: 4 },
  { value: "sex", label: "Sex", js: 5 },
  { value: "sab", label: "Sáb", js: 6 },
  { value: "dom", label: "Dom", js: 0 },
];

interface Modalidade { id: string; descricao: string }
interface StaffMember { id: string; name: string }
interface Unit { id: string; nome: string }

export interface GridData {
  id?:                        string;
  tipo?:                      string;
  unit_id?:                   string | null;
  unit_nome?:                 string | null;
  duracao_minutos?:           number | null;
  modalidade_id?:             string | null;
  modalidade_nome?:           string | null;
  staff_id?:                  string | null;
  staff_nome?:                string | null;
  nome?:                      string;
  dias_semana?:               string[];
  hora_inicio?:               string;
  hora_fim?:                  string;
  capacidade_maxima?:         number;
  cor?:                       string;
  permite_leads?:             boolean;
  permite_clientes_especiais?:boolean;
  max_clientes_especiais?:    number | null;
  max_leads?:                 number | null;
  fila_espera_ativa?:         boolean;
  antecedencia_checkin_min?:  number;
  encerramento_checkin_min?:  number;
  permite_cancelar_checkin?:    boolean;
  cancelar_checkin_limite_min?: number;
  acesso_antecedencia_min?:     number;
  acesso_tolerancia_atraso_min?:number;
  exibir_app_modo?:             string;
  checkin_app_modo?:            string;
  comissionar_instrutor?:       boolean;
  tipo_comissao?:               string | null;
  valor_comissao_centavos?:     number | null;
  min_clientes_comissao?:       number | null;
  considera_faltantes_comissao?:boolean;
  restricao_genero?:            string | null;
  agenda_livre?:                boolean;
}

interface Props {
  grid?:    GridData;
  onClose:  () => void;
  onSaved:  () => void;
}

type Tab = "dados" | "permissoes" | "comissao";

function calcDurationMinutes(start?: string, end?: string) {
  if (!start || !end) return 50;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : 50;
}

function addMinutesToTime(start: string, minutes: number) {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function Toggle({ value, onChange, label, description }: {
  value: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 mt-0.5 ${value ? "bg-primary" : "bg-gray-200"}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

export default function GradeFormModal({ grid, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const isEdit = !!grid?.id;
  const [activeTab, setActiveTab] = useState<Tab>("dados");

  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [staffList,   setStaffList]   = useState<StaffMember[]>([]);
  const [unitList,    setUnitList]    = useState<Unit[]>([]);
  const [saving, setSaving]           = useState(false);
  const [showAcesso, setShowAcesso]   = useState(false);
  const [showApp,    setShowApp]      = useState(false);
  const [showAvancado, setShowAvancado] = useState(false);

  const [form, setForm] = useState({
    tipo:                       grid?.tipo                       ?? "contrato",
    unit_id:                    grid?.unit_id                    ?? "",
    duracao_minutos:            String(grid?.duracao_minutos ?? calcDurationMinutes(grid?.hora_inicio, grid?.hora_fim)),
    modalidade_id:              grid?.modalidade_id              ?? "",
    staff_id:                   grid?.staff_id                   ?? "",
    nome:                       grid?.nome                       ?? "",
    dias_semana:                grid?.dias_semana                ?? [] as string[],
    hora_inicio:                grid?.hora_inicio                ?? "06:00",
    capacidade_maxima:          String(grid?.capacidade_maxima   ?? 20),
    cor:                        grid?.cor                        ?? "#f97316",
    permite_leads:              grid?.permite_leads              ?? false,
    permite_clientes_especiais: grid?.permite_clientes_especiais ?? false,
    max_clientes_especiais:     String(grid?.max_clientes_especiais ?? ""),
    max_leads:                  String(grid?.max_leads ?? ""),
    fila_espera_ativa:          grid?.fila_espera_ativa          ?? false,
    antecedencia_checkin_min:   String(grid?.antecedencia_checkin_min  ?? 0),
    encerramento_checkin_min:   String(grid?.encerramento_checkin_min  ?? 0),
    permite_cancelar_checkin:    grid?.permite_cancelar_checkin ?? true,
    cancelar_checkin_limite_min: String(grid?.cancelar_checkin_limite_min ?? 10),
    acesso_antecedencia_min:     String(grid?.acesso_antecedencia_min ?? 10),
    acesso_tolerancia_atraso_min:String(grid?.acesso_tolerancia_atraso_min ?? 5),
    exibir_app_modo:             grid?.exibir_app_modo ?? "todos",
    checkin_app_modo:            grid?.checkin_app_modo ?? "todos",
    comissionar_instrutor:        grid?.comissionar_instrutor ?? false,
    tipo_comissao:                grid?.tipo_comissao ?? "por_aula",
    valor_comissao_centavos:      String(grid?.valor_comissao_centavos ?? ""),
    min_clientes_comissao:        String(grid?.min_clientes_comissao ?? ""),
    considera_faltantes_comissao: grid?.considera_faltantes_comissao ?? false,
    restricao_genero:             grid?.restricao_genero ?? "",
    agenda_livre:                 grid?.agenda_livre ?? false,
  });

  useEffect(() => {
    if (!user?.contractorId) return;
    Promise.all([
      supabase.from("modalidades").select("id, descricao").eq("contractor_id", user.contractorId).eq("ativo", true).order("descricao"),
      supabase.from("staff").select("id, name").eq("contractor_id", user.contractorId).eq("active", true).order("name"),
      supabase.from("units").select("id, nome").eq("contractor_id", user.contractorId).eq("ativo", true).order("nome"),
    ]).then(([{ data: m }, { data: s }, { data: u }]) => {
      setModalidades((m ?? []) as Modalidade[]);
      setStaffList((s ?? []) as StaffMember[]);
      setUnitList((u ?? []) as Unit[]);
    });
  }, [user]);

  function toggleDia(value: string) {
    setForm(f => ({
      ...f,
      dias_semana: f.dias_semana.includes(value)
        ? f.dias_semana.filter(d => d !== value)
        : [...f.dias_semana, value],
    }));
  }

  async function generateSlots(gridId: string, contractorId: string) {
    const dayMap = Object.fromEntries(DIAS.map(d => [d.value, d.js]));
    const allowedJs = form.dias_semana.map(d => dayMap[d]).filter(v => v !== undefined);

    const selectedMod   = modalidades.find(m => m.id === form.modalidade_id);
    const selectedStaff = staffList.find(s => s.id === form.staff_id);
    const selectedUnit  = unitList.find(u => u.id === form.unit_id);
    const horaFimCalc   = addMinutesToTime(form.hora_inicio, parseInt(form.duracao_minutos) || 50);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const slots = [];
    for (let i = 0; i < 90; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (allowedJs.includes(d.getDay())) {
        slots.push({
          contractor_id:     contractorId,
          grid_id:           gridId,
          modalidade_id:     form.modalidade_id || null,
          modalidade_nome:   selectedMod?.descricao ?? null,
          staff_id:          form.staff_id || null,
          staff_nome:        selectedStaff?.name ?? null,
          tipo:              form.tipo,
          unit_id:           form.unit_id || null,
          unit_nome:         selectedUnit?.nome ?? null,
          data:              d.toISOString().split("T")[0],
          hora_inicio:       form.hora_inicio,
          hora_fim:          horaFimCalc,
          capacidade_maxima: parseInt(form.capacidade_maxima) || 20,
          cor:               form.cor,
          status:            "agendado",
        });
      }
    }

    for (let i = 0; i < slots.length; i += 100) {
      await supabase.from("schedule_slots").insert(slots.slice(i, i + 100));
    }
  }

  async function handleSave() {
    if (!user?.contractorId) return;
    if (form.dias_semana.length === 0) { toast.error("Selecione ao menos um dia."); return; }
    if (!form.hora_inicio) { toast.error("Informe o horário de início."); return; }
    if (!form.duracao_minutos || parseInt(form.duracao_minutos) < 5) {
      toast.error("Informe uma duração válida (mínimo 5 minutos).");
      return;
    }

    const selectedMod   = modalidades.find(m => m.id === form.modalidade_id);
    const selectedStaff = staffList.find(s => s.id === form.staff_id);
    const selectedUnit  = unitList.find(u => u.id === form.unit_id);
    const horaFimCalc   = addMinutesToTime(form.hora_inicio, parseInt(form.duracao_minutos) || 50);

    const payload = {
      tipo:                       form.tipo,
      unit_id:                    form.unit_id || null,
      unit_nome:                  selectedUnit?.nome ?? null,
      duracao_minutos:            parseInt(form.duracao_minutos) || 50,
      modalidade_id:              form.modalidade_id || null,
      modalidade_nome:            selectedMod?.descricao ?? null,
      staff_id:                   form.staff_id || null,
      staff_nome:                 selectedStaff?.name ?? null,
      nome:                       form.nome,
      dias_semana:                form.dias_semana,
      hora_inicio:                form.hora_inicio,
      hora_fim:                   horaFimCalc,
      capacidade_maxima:          parseInt(form.capacidade_maxima) || 20,
      cor:                        form.cor,
      permite_leads:              form.permite_leads,
      permite_clientes_especiais: form.permite_clientes_especiais,
      max_clientes_especiais:     form.max_clientes_especiais ? parseInt(form.max_clientes_especiais) : null,
      max_leads:                  form.max_leads ? parseInt(form.max_leads) : null,
      fila_espera_ativa:          form.fila_espera_ativa,
      antecedencia_checkin_min:   parseInt(form.antecedencia_checkin_min) || 0,
      encerramento_checkin_min:   parseInt(form.encerramento_checkin_min) || 0,
      permite_cancelar_checkin:    form.permite_cancelar_checkin,
      cancelar_checkin_limite_min: parseInt(form.cancelar_checkin_limite_min) || 10,
      acesso_antecedencia_min:     parseInt(form.acesso_antecedencia_min) || 10,
      acesso_tolerancia_atraso_min:parseInt(form.acesso_tolerancia_atraso_min) || 5,
      exibir_app_modo:             form.exibir_app_modo,
      checkin_app_modo:            form.checkin_app_modo,
      comissionar_instrutor:        form.comissionar_instrutor,
      tipo_comissao:                form.comissionar_instrutor ? form.tipo_comissao : null,
      valor_comissao_centavos:      form.comissionar_instrutor && form.valor_comissao_centavos
        ? parseInt(form.valor_comissao_centavos)
        : null,
      min_clientes_comissao:        form.comissionar_instrutor && form.min_clientes_comissao
        ? parseInt(form.min_clientes_comissao)
        : null,
      considera_faltantes_comissao: form.comissionar_instrutor ? form.considera_faltantes_comissao : false,
      restricao_genero:             form.restricao_genero || null,
      agenda_livre:                 form.agenda_livre,
    };

    setSaving(true);

    if (isEdit) {
      const { error } = await supabase.from("schedule_grids").update(payload).eq("id", grid!.id!);
      if (error) { setSaving(false); toast.error("Erro ao atualizar grade."); return; }
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("schedule_slots").delete().eq("grid_id", grid!.id!).gte("data", today);
      await generateSlots(grid!.id!, user.contractorId!);
    } else {
      const { data, error } = await supabase
        .from("schedule_grids")
        .insert({ contractor_id: user.contractorId!, ...payload })
        .select("id")
        .single();
      if (error || !data) { setSaving(false); toast.error("Erro ao criar grade."); return; }
      await generateSlots(data.id, user.contractorId!);
    }

    setSaving(false);
    toast.success(isEdit ? "Grade atualizada." : "Grade criada e aulas geradas (90 dias).");
    onSaved();
    onClose();
  }

  const TABS: { key: Tab; label: string; Icon: React.ComponentType<{className?: string}> }[] = [
    { key: "dados",      label: "Dados",      Icon: Clock },
    { key: "permissoes", label: "Permissões", Icon: Settings },
    { key: "comissao",   label: "Comissão",   Icon: DollarSign },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? "Editar grade" : "Nova grade de horário"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <t.Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "dados" && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">Tipo da grade *</label>
                <div className="flex gap-3">
                  {[
                    { value: "contrato", label: "Contrato", desc: "Acesso via plano do aluno" },
                    { value: "servico", label: "Serviço", desc: "Acesso via serviço avulso" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, tipo: opt.value }))}
                      className={`flex-1 border rounded-xl p-3 text-left transition-colors ${
                        form.tipo === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <p className={`text-sm font-semibold ${form.tipo === opt.value ? "text-primary" : "text-gray-700"}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome (opcional)</label>
                <input className={INP} placeholder="Ex: Musculação Manhã" value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Modalidade</label>
                  <select className={SEL} value={form.modalidade_id}
                    onChange={e => setForm(f => ({ ...f, modalidade_id: e.target.value }))}>
                    <option value="">Selecione</option>
                    {modalidades.map(m => <option key={m.id} value={m.id}>{m.descricao}</option>)}
                  </select>
                  <ChevronDown className="absolute right-0 bottom-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Professor</label>
                  <select className={SEL} value={form.staff_id}
                    onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}>
                    <option value="">Sem professor</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-0 bottom-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div className="relative">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Local / Sala</label>
                <select className={SEL} value={form.unit_id}
                  onChange={e => setForm(f => ({ ...f, unit_id: e.target.value }))}>
                  <option value="">Sem local definido</option>
                  {unitList.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
                <ChevronDown className="absolute right-0 bottom-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">Dias da semana *</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {DIAS.map(d => (
                    <button key={d.value} type="button" onClick={() => toggleDia(d.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        form.dias_semana.includes(d.value)
                          ? "bg-primary text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Hora início *</label>
                  <input type="time" className={INP} value={form.hora_inicio}
                    onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Duração (minutos) *</label>
                  <input type="number" min="5" max="480" className={INP} value={form.duracao_minutos}
                    onChange={e => setForm(f => ({ ...f, duracao_minutos: e.target.value }))} />
                  {form.hora_inicio && form.duracao_minutos && (
                    <p className="text-xs text-gray-400 mt-1">
                      Término: {addMinutesToTime(form.hora_inicio, parseInt(form.duracao_minutos) || 0)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Capacidade máxima</label>
                  <input type="number" min="1" max="500" className={INP} value={form.capacidade_maxima}
                    onChange={e => setForm(f => ({ ...f, capacidade_maxima: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Cor</label>
                  <div className="flex items-center gap-3 border-b border-gray-300 py-2">
                    <div className="w-7 h-7 rounded-full cursor-pointer border-2 border-white ring-1 ring-gray-200 flex-shrink-0"
                      style={{ backgroundColor: form.cor }}
                      onClick={() => document.getElementById("grade-cor-picker")?.click()} />
                    <input id="grade-cor-picker" type="color" value={form.cor}
                      onChange={e => setForm(f => ({ ...f, cor: e.target.value }))} className="sr-only" />
                    <span className="text-sm text-gray-500 font-mono">{form.cor}</span>
                  </div>
                </div>
              </div>

              {isEdit && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                  <p className="text-xs text-yellow-800">
                    Ao salvar, aulas futuras serão recriadas com as novas configurações. Reservas existentes não serão afetadas.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "permissoes" && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 mb-4">Configure quem pode se agendar e como o check-in funciona nesta grade.</p>

              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-gray-500" />
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Acesso</p>
                </div>
                <Toggle
                  value={form.permite_leads}
                  onChange={v => setForm(f => ({ ...f, permite_leads: v }))}
                  label="Permite agendar leads"
                  description="Leads do CRM podem ser adicionados nesta aula"
                />
                {form.permite_leads && (
                  <div className="ml-4 mb-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Máximo de leads por aula</label>
                    <input
                      type="number" min="0" max="100"
                      value={form.max_leads}
                      onChange={e => setForm(f => ({ ...f, max_leads: e.target.value }))}
                      className="w-32 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="sem limite"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Deixe em branco para ilimitado</p>
                  </div>
                )}
                <Toggle
                  value={form.permite_clientes_especiais}
                  onChange={v => setForm(f => ({ ...f, permite_clientes_especiais: v }))}
                  label="Permite clientes especiais"
                  description="Alunos sem contrato ativo na modalidade"
                />
                {form.permite_clientes_especiais && (
                  <div className="ml-4 mb-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Máximo de clientes especiais por aula</label>
                    <input
                      type="number" min="0" max="100"
                      value={form.max_clientes_especiais}
                      onChange={e => setForm(f => ({ ...f, max_clientes_especiais: e.target.value }))}
                      className="w-32 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="sem limite"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Deixe em branco para ilimitado</p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Check-in e Fila</p>
                </div>
                <Toggle
                  value={form.fila_espera_ativa}
                  onChange={v => setForm(f => ({ ...f, fila_espera_ativa: v }))}
                  label="Fila de espera ativa"
                  description="Quando lotado, alunos entram na fila e são promovidos automaticamente"
                />
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Abre check-in (min antes)
                    </label>
                    <input
                      type="number" min="0" max="1440"
                      value={form.antecedencia_checkin_min}
                      onChange={e => setForm(f => ({ ...f, antecedencia_checkin_min: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="0 = qualquer hora"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Fecha check-in (min antes)
                    </label>
                    <input
                      type="number" min="0" max="1440"
                      value={form.encerramento_checkin_min}
                      onChange={e => setForm(f => ({ ...f, encerramento_checkin_min: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="0 = não fecha"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Ex: Abre 60 min antes, fecha 15 min antes do início da aula.
                </p>
                <div className="border-t border-gray-100 mt-3 pt-3">
                  <Toggle
                    value={form.permite_cancelar_checkin}
                    onChange={v => setForm(f => ({ ...f, permite_cancelar_checkin: v }))}
                    label="Permite cancelar check-in"
                    description="O aluno pode cancelar sua presença pelo app"
                  />
                  {form.permite_cancelar_checkin && (
                    <div className="ml-4 mt-1">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Até quantos minutos antes pode cancelar
                      </label>
                      <input
                        type="number" min="0" max="1440"
                        value={form.cancelar_checkin_limite_min}
                        onChange={e => setForm(f => ({ ...f, cancelar_checkin_limite_min: e.target.value }))}
                        className="w-32 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Ex: 10"
                      />
                      <p className="text-xs text-gray-400 mt-0.5">Ex: 10 = pode cancelar até 10 min antes do início</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <button
                  type="button"
                  onClick={() => setShowAcesso(v => !v)}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-gray-500" />
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Controle de Acesso Físico</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showAcesso ? "rotate-180" : ""}`} />
                </button>
                <p className="text-xs text-gray-400 mt-1">Configure as janelas de tempo para integração com catraca ou biometria.</p>
                {showAcesso && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Pode entrar (min antes)</label>
                      <input
                        type="number" min="0" max="120"
                        value={form.acesso_antecedencia_min}
                        onChange={e => setForm(f => ({ ...f, acesso_antecedencia_min: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="10"
                      />
                      <p className="text-xs text-gray-400 mt-0.5">Antes do início</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Tolerância de atraso (min)</label>
                      <input
                        type="number" min="0" max="60"
                        value={form.acesso_tolerancia_atraso_min}
                        onChange={e => setForm(f => ({ ...f, acesso_tolerancia_atraso_min: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="5"
                      />
                      <p className="text-xs text-gray-400 mt-0.5">Após o início</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <button
                  type="button"
                  onClick={() => setShowApp(v => !v)}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-gray-500" />
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">App do Aluno</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showApp ? "rotate-180" : ""}`} />
                </button>
                <p className="text-xs text-gray-400 mt-1">Controle quem vê e quem pode fazer check-in pelo aplicativo.</p>
                {showApp && (
                  <div className="space-y-4 mt-4">
                    <div className="relative">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Exibir grade no app para</label>
                      <select className={SEL} value={form.exibir_app_modo}
                        onChange={e => setForm(f => ({ ...f, exibir_app_modo: e.target.value }))}>
                        <option value="todos">Todos os alunos</option>
                        <option value="contrato_ativo">Só alunos com contrato ativo na modalidade</option>
                      </select>
                      <ChevronDown className="absolute right-0 bottom-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Permite check-in pelo app para</label>
                      <select className={SEL} value={form.checkin_app_modo}
                        onChange={e => setForm(f => ({ ...f, checkin_app_modo: e.target.value }))}>
                        <option value="todos">Todos os alunos</option>
                        <option value="contrato_ativo">Só alunos com contrato ativo na modalidade</option>
                      </select>
                      <ChevronDown className="absolute right-0 bottom-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <button
                  type="button"
                  onClick={() => setShowAvancado(v => !v)}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-gray-500" />
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                      Configurações Avançadas
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showAvancado ? "rotate-180" : ""}`} />
                </button>
                <p className="text-xs text-gray-400 mt-1">
                  Restrições de público e comportamento de cobrança.
                </p>

                {showAvancado && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="flex items-start justify-between gap-4 py-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">Restringir por gênero</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Somente alunos do gênero selecionado poderão ser adicionados nesta aula
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setForm(f => ({
                            ...f,
                            restricao_genero: f.restricao_genero ? "" : "feminino",
                          }))}
                          className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 mt-0.5 ${
                            form.restricao_genero ? "bg-primary" : "bg-gray-200"
                          }`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            form.restricao_genero ? "translate-x-5" : "translate-x-0.5"
                          }`} />
                        </button>
                      </div>

                      {form.restricao_genero && (
                        <div className="ml-4 flex gap-2 mt-1">
                          {[
                            { value: "feminino", label: "Feminino" },
                            { value: "masculino", label: "Masculino" },
                          ].map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setForm(f => ({ ...f, restricao_genero: opt.value }))}
                              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                form.restricao_genero === opt.value
                                  ? "bg-primary text-white"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-start justify-between gap-4 py-2 border-t border-gray-100 pt-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">Agenda livre</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Alunos com contrato ativo podem participar sem consumir sessões ou créditos do plano.
                          Útil para aulas de demonstração, eventos e aulas bônus.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, agenda_livre: !f.agenda_livre }))}
                        className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 mt-0.5 ${
                          form.agenda_livre ? "bg-primary" : "bg-gray-200"
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          form.agenda_livre ? "translate-x-5" : "translate-x-0.5"
                        }`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "comissao" && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 mb-4">
                Configure se e como o instrutor desta grade será comissionado ao finalizar cada aula.
              </p>

              {!form.staff_id && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
                  <p className="text-xs text-yellow-800">
                    Defina um professor na aba Dados para configurar comissão.
                  </p>
                </div>
              )}

              <div className={`space-y-2 ${!form.staff_id ? "opacity-40 pointer-events-none" : ""}`}>
                <div className="bg-gray-50 rounded-xl p-4">
                  <Toggle
                    value={form.comissionar_instrutor}
                    onChange={v => setForm(f => ({ ...f, comissionar_instrutor: v }))}
                    label="Comissionar instrutor"
                    description="Gerar comissão automaticamente ao finalizar cada aula"
                  />
                </div>

                {form.comissionar_instrutor && (
                  <>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">
                        Tipo de comissão
                      </p>
                      <div className="flex gap-3">
                        {[
                          { value: "por_aula", label: "Por aula", desc: "Valor fixo por aula dada" },
                          { value: "por_cliente", label: "Por aluno", desc: "Valor x nº de alunos presentes" },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, tipo_comissao: opt.value }))}
                            className={`flex-1 border rounded-xl p-3 text-left transition-colors ${
                              form.tipo_comissao === opt.value
                                ? "border-primary bg-primary/5"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <p className={`text-sm font-semibold ${form.tipo_comissao === opt.value ? "text-primary" : "text-gray-700"}`}>
                              {opt.label}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Valor {form.tipo_comissao === "por_cliente" ? "por aluno presente" : "por aula"} *
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">R$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={form.valor_comissao_centavos
                            ? (parseInt(form.valor_comissao_centavos) / 100).toFixed(2).replace(".", ",")
                            : ""}
                          onChange={e => {
                            const digits = e.target.value.replace(/\D/g, "");
                            setForm(f => ({ ...f, valor_comissao_centavos: digits }));
                          }}
                          className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          placeholder="0,00"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {form.tipo_comissao === "por_cliente"
                          ? "Ex: R$ 3,00 por aluno, 6 alunos = R$ 18,00"
                          : "Ex: R$ 15,00 independente do número de alunos"}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4">
                      <Toggle
                        value={!!form.min_clientes_comissao}
                        onChange={v => setForm(f => ({
                          ...f,
                          min_clientes_comissao: v ? "4" : "",
                        }))}
                        label="Exigir mínimo de alunos"
                        description="Só comissiona se houver pelo menos N alunos presentes"
                      />
                      {!!form.min_clientes_comissao && (
                        <div className="mt-3 ml-4">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">
                            Mínimo de alunos
                          </label>
                          <input
                            type="number" min="1" max="100"
                            value={form.min_clientes_comissao}
                            onChange={e => setForm(f => ({ ...f, min_clientes_comissao: e.target.value }))}
                            className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4">
                      <Toggle
                        value={form.considera_faltantes_comissao}
                        onChange={v => setForm(f => ({ ...f, considera_faltantes_comissao: v }))}
                        label="Considerar clientes faltantes"
                        description="Alunos com falta contam no cálculo da comissão"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="text-primary font-semibold text-sm hover:underline px-2">CANCELAR</button>
          <button onClick={handleSave} disabled={saving}
            className="bg-primary text-white font-semibold text-sm px-5 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? "Salvando..." : isEdit ? "SALVAR" : "CRIAR GRADE"}
          </button>
        </div>
      </div>
    </div>
  );
}
