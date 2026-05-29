import { useState, useEffect } from "react";
import { X, ChevronDown, Settings, Clock, Users } from "lucide-react";
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

export interface GridData {
  id?:                        string;
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
  fila_espera_ativa?:         boolean;
  antecedencia_checkin_min?:  number;
  encerramento_checkin_min?:  number;
}

interface Props {
  grid?:    GridData;
  onClose:  () => void;
  onSaved:  () => void;
}

type Tab = "dados" | "permissoes";

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
  const [saving, setSaving]           = useState(false);

  const [form, setForm] = useState({
    modalidade_id:              grid?.modalidade_id              ?? "",
    staff_id:                   grid?.staff_id                   ?? "",
    nome:                       grid?.nome                       ?? "",
    dias_semana:                grid?.dias_semana                ?? [] as string[],
    hora_inicio:                grid?.hora_inicio                ?? "06:00",
    hora_fim:                   grid?.hora_fim                   ?? "07:00",
    capacidade_maxima:          String(grid?.capacidade_maxima   ?? 20),
    cor:                        grid?.cor                        ?? "#f97316",
    permite_leads:              grid?.permite_leads              ?? false,
    permite_clientes_especiais: grid?.permite_clientes_especiais ?? false,
    fila_espera_ativa:          grid?.fila_espera_ativa          ?? false,
    antecedencia_checkin_min:   String(grid?.antecedencia_checkin_min  ?? 0),
    encerramento_checkin_min:   String(grid?.encerramento_checkin_min  ?? 0),
  });

  useEffect(() => {
    if (!user?.contractorId) return;
    Promise.all([
      supabase.from("modalidades").select("id, descricao").eq("contractor_id", user.contractorId).eq("ativo", true).order("descricao"),
      supabase.from("staff").select("id, name").eq("contractor_id", user.contractorId).eq("active", true).order("name"),
    ]).then(([{ data: m }, { data: s }]) => {
      setModalidades((m ?? []) as Modalidade[]);
      setStaffList((s ?? []) as StaffMember[]);
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
          data:              d.toISOString().split("T")[0],
          hora_inicio:       form.hora_inicio,
          hora_fim:          form.hora_fim,
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
    if (!form.hora_inicio || !form.hora_fim)   { toast.error("Informe os horários."); return; }
    if (form.hora_fim <= form.hora_inicio)     { toast.error("Hora fim deve ser após hora início."); return; }

    const selectedMod   = modalidades.find(m => m.id === form.modalidade_id);
    const selectedStaff = staffList.find(s => s.id === form.staff_id);

    const payload = {
      modalidade_id:              form.modalidade_id || null,
      modalidade_nome:            selectedMod?.descricao ?? null,
      staff_id:                   form.staff_id || null,
      staff_nome:                 selectedStaff?.name ?? null,
      nome:                       form.nome,
      dias_semana:                form.dias_semana,
      hora_inicio:                form.hora_inicio,
      hora_fim:                   form.hora_fim,
      capacidade_maxima:          parseInt(form.capacidade_maxima) || 20,
      cor:                        form.cor,
      permite_leads:              form.permite_leads,
      permite_clientes_especiais: form.permite_clientes_especiais,
      fila_espera_ativa:          form.fila_espera_ativa,
      antecedencia_checkin_min:   parseInt(form.antecedencia_checkin_min) || 0,
      encerramento_checkin_min:   parseInt(form.encerramento_checkin_min) || 0,
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
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Hora fim *</label>
                  <input type="time" className={INP} value={form.hora_fim}
                    onChange={e => setForm(f => ({ ...f, hora_fim: e.target.value }))} />
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
                <Toggle
                  value={form.permite_clientes_especiais}
                  onChange={v => setForm(f => ({ ...f, permite_clientes_especiais: v }))}
                  label="Permite clientes especiais"
                  description="Alunos sem contrato ativo na modalidade"
                />
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
