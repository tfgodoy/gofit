import { useState, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";
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
  id?:               string;
  modalidade_id?:    string | null;
  modalidade_nome?:  string | null;
  staff_id?:         string | null;
  staff_nome?:       string | null;
  nome?:             string;
  dias_semana?:      string[];
  hora_inicio?:      string;
  hora_fim?:         string;
  capacidade_maxima?: number;
  cor?:              string;
}

interface Props {
  grid?:    GridData;
  onClose:  () => void;
  onSaved:  () => void;
}

export default function GradeFormModal({ grid, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const isEdit = !!grid?.id;

  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [staffList, setStaffList]     = useState<StaffMember[]>([]);
  const [saving, setSaving]           = useState(false);

  const [form, setForm] = useState({
    modalidade_id:     grid?.modalidade_id  ?? "",
    staff_id:          grid?.staff_id       ?? "",
    nome:              grid?.nome           ?? "",
    dias_semana:       grid?.dias_semana    ?? [] as string[],
    hora_inicio:       grid?.hora_inicio    ?? "06:00",
    hora_fim:          grid?.hora_fim       ?? "07:00",
    capacidade_maxima: String(grid?.capacidade_maxima ?? 20),
    cor:               grid?.cor            ?? "#f97316",
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
    for (let i = 0; i < 60; i++) {
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
    if (!form.hora_inicio || !form.hora_fim)    { toast.error("Informe os horários."); return; }
    if (form.hora_fim <= form.hora_inicio)      { toast.error("Hora fim deve ser após hora início."); return; }

    const selectedMod   = modalidades.find(m => m.id === form.modalidade_id);
    const selectedStaff = staffList.find(s => s.id === form.staff_id);

    const payload = {
      modalidade_id:     form.modalidade_id || null,
      modalidade_nome:   selectedMod?.descricao ?? null,
      staff_id:          form.staff_id || null,
      staff_nome:        selectedStaff?.name ?? null,
      nome:              form.nome,
      dias_semana:       form.dias_semana,
      hora_inicio:       form.hora_inicio,
      hora_fim:          form.hora_fim,
      capacidade_maxima: parseInt(form.capacidade_maxima) || 20,
      cor:               form.cor,
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
    toast.success(isEdit ? "Grade atualizada e aulas reagendadas." : "Grade criada e aulas geradas.");
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? "Editar grade" : "Nova grade de horário"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Nome opcional */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nome (opcional)</label>
            <input
              className={INP}
              placeholder="Ex: Musculação Manhã"
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            />
          </div>

          {/* Modalidade + Professor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Modalidade</label>
              <select className={SEL} value={form.modalidade_id} onChange={e => setForm(f => ({ ...f, modalidade_id: e.target.value }))}>
                <option value="">Selecione</option>
                {modalidades.map(m => <option key={m.id} value={m.id}>{m.descricao}</option>)}
              </select>
              <ChevronDown className="absolute right-0 bottom-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Professor</label>
              <select className={SEL} value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}>
                <option value="">Sem professor</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown className="absolute right-0 bottom-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Dias da semana */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">Dias da semana *</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {DIAS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDia(d.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    form.dias_semana.includes(d.value)
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hora início + Hora fim */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Hora início *</label>
              <input type="time" className={INP} value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Hora fim *</label>
              <input type="time" className={INP} value={form.hora_fim} onChange={e => setForm(f => ({ ...f, hora_fim: e.target.value }))} />
            </div>
          </div>

          {/* Capacidade + Cor */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Capacidade máxima</label>
              <input
                type="number" min="1" max="500"
                className={INP}
                value={form.capacidade_maxima}
                onChange={e => setForm(f => ({ ...f, capacidade_maxima: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Cor</label>
              <div className="flex items-center gap-3 border-b border-gray-300 py-2">
                <div
                  className="w-7 h-7 rounded-full cursor-pointer border-2 border-white ring-1 ring-gray-200 flex-shrink-0"
                  style={{ backgroundColor: form.cor }}
                  onClick={() => document.getElementById("grade-cor-picker")?.click()}
                />
                <input
                  id="grade-cor-picker"
                  type="color"
                  value={form.cor}
                  onChange={e => setForm(f => ({ ...f, cor: e.target.value }))}
                  className="sr-only"
                />
                <span className="text-sm text-gray-500 font-mono">{form.cor}</span>
              </div>
            </div>
          </div>

          {isEdit && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-xs text-yellow-800">
                Ao salvar, aulas futuras desta grade serão recriadas com as novas configurações. Reservas existentes não serão afetadas.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-primary font-semibold text-sm hover:underline px-2">CANCELAR</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-white font-semibold text-sm px-5 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Salvando..." : isEdit ? "SALVAR" : "CRIAR GRADE"}
          </button>
        </div>
      </div>
    </div>
  );
}
