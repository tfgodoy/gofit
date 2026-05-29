import { useState, useEffect, useRef } from "react";
import {
  X, ChevronDown, Search, Check, Pencil,
  LayoutGrid, Dumbbell, Bike, Activity, Timer, Scale, Shield,
  Zap, Waves, Sun, Mountain, Heart, Trophy, Star, Globe,
  Music, Leaf, Target, Sword, Circle, Users, Award,
  Flame, Wind, Footprints,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ─── Types ─────────────────────────────────────────────── */

interface ModalidadeData {
  id: string;
  descricao: string;
  utiliza_agenda: boolean;
  utiliza_wod: boolean;
  exibir_wod_app: boolean;
  exibicao_wod: string;
  exibe_wod_antes_dia: boolean;
  dias_semana: string[];
  cor: string;
  icone: string;
  utiliza_gonutri: boolean;
  ativo: boolean;
}

interface Props {
  modalidade: ModalidadeData | null;
  onClose: () => void;
  onSaved: () => void;
}

/* ─── Icons ──────────────────────────────────────────────── */

type IconDef = {
  name: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.ComponentType<any>;
};

export const SPORT_ICONS: IconDef[] = [
  { name: "default",        label: "Modalidade",    Icon: LayoutGrid },
  { name: "dumbbell",       label: "Musculação",    Icon: Dumbbell },
  { name: "bike",           label: "Bicicleta",     Icon: Bike },
  { name: "activity",       label: "Corrida",       Icon: Activity },
  { name: "timer",          label: "Cronômetro",    Icon: Timer },
  { name: "scale",          label: "Balança",       Icon: Scale },
  { name: "shield",         label: "Defesa",        Icon: Shield },
  { name: "zap",            label: "Funcional",     Icon: Zap },
  { name: "waves",          label: "Natação",       Icon: Waves },
  { name: "sun",            label: "Praia",         Icon: Sun },
  { name: "mountain",       label: "Escalada",      Icon: Mountain },
  { name: "heart",          label: "Cardio",        Icon: Heart },
  { name: "trophy",         label: "Competição",    Icon: Trophy },
  { name: "star",           label: "Destaque",      Icon: Star },
  { name: "globe",          label: "Futebol",       Icon: Globe },
  { name: "music",          label: "Dança",         Icon: Music },
  { name: "leaf",           label: "Yoga",          Icon: Leaf },
  { name: "target",         label: "Arqueria",      Icon: Target },
  { name: "sword",          label: "Artes marciais",Icon: Sword },
  { name: "circle",         label: "Basquete",      Icon: Circle },
  { name: "users",          label: "Coletivo",      Icon: Users },
  { name: "award",          label: "Premiação",     Icon: Award },
  { name: "flame",          label: "HIIT",          Icon: Flame },
  { name: "wind",           label: "Capoeira",      Icon: Wind },
  { name: "footprints",     label: "Caminhada",     Icon: Footprints },
];

export function getIcon(name: string) {
  return SPORT_ICONS.find(i => i.name === name) ?? SPORT_ICONS[0];
}

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

const DIAS_SEMANA = [
  { value: "domingo",    label: "Domingo" },
  { value: "segunda",    label: "Segunda-feira" },
  { value: "terca",      label: "Terça-feira" },
  { value: "quarta",     label: "Quarta-feira" },
  { value: "quinta",     label: "Quinta-feira" },
  { value: "sexta",      label: "Sexta-feira" },
  { value: "sabado",     label: "Sábado" },
];

const EXIBICAO_WOD_OPTIONS = [
  { value: "contrato_ativo", label: "Só para alunos com contrato ativo da modalidade/serviço da agenda" },
  { value: "checkin",        label: "Só para alunos que já realizaram o check-in na agenda" },
  { value: "todos",          label: "Para todos os alunos" },
];

/* ─── Toggle component ───────────────────────────────────── */

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-800">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-primary" : "bg-gray-200"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

/* ─── Multi-select days ──────────────────────────────────── */

function DiasSemanaSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter(d => d !== v) : [...selected, v]);
  }

  const displayText = selected.length === 0
    ? "Nenhum dia selecionado"
    : selected.length === DIAS_SEMANA.length
      ? "Todos os dias"
      : selected.map(v => DIAS_SEMANA.find(d => d.value === v)?.label ?? v).join(", ");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between border-b border-gray-300 py-2 px-0 text-sm text-gray-900 hover:border-primary/60 transition-colors"
      >
        <span className={`flex-1 text-left truncate ${selected.length === 0 ? "text-gray-400" : ""}`}>
          {displayText}
        </span>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange([]); }}
              className="text-gray-300 hover:text-gray-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-60 overflow-y-auto">
          {DIAS_SEMANA.map(d => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggle(d.value)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 transition-colors"
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${
                selected.includes(d.value) ? "bg-primary border-primary" : "border-gray-300"
              }`}>
                {selected.includes(d.value) && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              {d.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Icon picker modal ──────────────────────────────────── */

function IconPickerModal({
  selected,
  onSelect,
  onClose,
  iconColor,
}: {
  selected: string;
  onSelect: (name: string) => void;
  onClose: () => void;
  iconColor: string;
}) {
  const [search, setSearch] = useState("");
  const [current, setCurrent] = useState(selected);

  const filtered = SPORT_ICONS.filter(i =>
    !search || i.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 flex flex-col" style={{ maxHeight: "85vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: iconColor + "22" }}>
              <LayoutGrid className="w-4 h-4" style={{ color: iconColor }} />
            </div>
            <h3 className="text-base font-bold text-gray-900">Ícones</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary/60"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-2">
            {filtered.map(({ name, label, Icon }) => {
              const isActive = current === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setCurrent(name)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-colors border-2 ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-gray-50"
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: (isActive ? iconColor : "#6b7280") + "18" }}
                  >
                    <Icon
                      className="w-5 h-5"
                      style={{ color: isActive ? iconColor : "#6b7280" }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 text-center leading-tight">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-primary font-semibold text-sm hover:underline px-2">
            CANCELAR
          </button>
          <button
            onClick={() => { onSelect(current); onClose(); }}
            className="bg-primary text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
          >
            CONFIRMAR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */

export default function ModalidadeFormModal({ modalidade, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const isEdit = !!modalidade;
  const colorInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    descricao: modalidade?.descricao ?? "",
    utiliza_agenda: modalidade?.utiliza_agenda ?? false,
    utiliza_wod: modalidade?.utiliza_wod ?? false,
    exibir_wod_app: modalidade?.exibir_wod_app ?? false,
    exibicao_wod: modalidade?.exibicao_wod ?? "contrato_ativo",
    exibe_wod_antes_dia: modalidade?.exibe_wod_antes_dia ?? false,
    dias_semana: modalidade?.dias_semana ?? [],
    cor: modalidade?.cor ?? "#f97316",
    icone: modalidade?.icone ?? "default",
    utiliza_gonutri: modalidade?.utiliza_gonutri ?? false,
    ativo: modalidade?.ativo ?? true,
  });

  const [saving, setSaving] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const iconDef = getIcon(form.icone);
  const IconComponent = iconDef.Icon;

  async function handleSave() {
    if (!form.descricao.trim()) { toast.error("Informe a descrição da modalidade."); return; }
    if (!user?.contractorId) return;

    setSaving(true);
    try {
      const payload = {
        contractor_id: user.contractorId,
        descricao: form.descricao.trim(),
        utiliza_agenda: form.utiliza_agenda,
        utiliza_wod: form.utiliza_wod,
        exibir_wod_app: form.utiliza_wod ? form.exibir_wod_app : false,
        exibicao_wod: form.utiliza_wod && form.exibir_wod_app ? form.exibicao_wod : "contrato_ativo",
        exibe_wod_antes_dia: form.utiliza_wod ? form.exibe_wod_antes_dia : false,
        dias_semana: form.utiliza_wod ? form.dias_semana : [],
        cor: form.cor,
        icone: form.icone,
        utiliza_gonutri: form.utiliza_gonutri,
        ativo: form.ativo,
      };

      if (isEdit) {
        const { error } = await supabase.from("modalidades").update(payload).eq("id", modalidade.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("modalidades").insert(payload);
        if (error) throw error;
      }

      toast.success(isEdit ? "Modalidade atualizada." : "Modalidade criada.");
      onSaved();
    } catch (err) {
      console.error("modalidade save error:", err);
      toast.error("Erro ao salvar modalidade.");
    } finally {
      setSaving(false);
    }
  }

  const exibicaoLabel = EXIBICAO_WOD_OPTIONS.find(o => o.value === form.exibicao_wod)?.label ?? "";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-6">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 my-auto">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">
              {isEdit ? "Editar modalidade" : "Nova modalidade"}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-5">

            {/* Descrição */}
            <div>
              <label className={LBL}>Descrição {REQ}</label>
              <input
                type="text"
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                className={INP}
                placeholder="Nome da modalidade"
                autoFocus
              />
            </div>

            {/* Toggles principais */}
            <Toggle label="Utiliza agenda" checked={form.utiliza_agenda} onChange={v => setForm(f => ({ ...f, utiliza_agenda: v }))} />
            <Toggle label="GoNutri" checked={form.utiliza_gonutri} onChange={v => setForm(f => ({ ...f, utiliza_gonutri: v }))} />
            <Toggle label="Utiliza WOD" checked={form.utiliza_wod} onChange={v => setForm(f => ({ ...f, utiliza_wod: v }))} />

            {/* WOD sub-fields */}
            {form.utiliza_wod && (
              <div className="ml-4 pl-3 border-l-2 border-gray-100 space-y-4">
                <Toggle
                  label="Exibir WOD no aplicativo"
                  checked={form.exibir_wod_app}
                  onChange={v => setForm(f => ({ ...f, exibir_wod_app: v }))}
                />
                {form.exibir_wod_app && (
                  <div>
                    <label className={LBL}>Exibição do WOD no aplicativo {REQ}</label>
                    <div className="relative mt-1">
                      <select
                        value={form.exibicao_wod}
                        onChange={e => setForm(f => ({ ...f, exibicao_wod: e.target.value }))}
                        className={SEL}
                        title={exibicaoLabel}
                      >
                        {EXIBICAO_WOD_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                )}

                <Toggle
                  label="Exibe WOD antes do dia"
                  checked={form.exibe_wod_antes_dia}
                  onChange={v => setForm(f => ({ ...f, exibe_wod_antes_dia: v }))}
                />

                <div>
                  <label className={LBL}>Dia da semana</label>
                  <DiasSemanaSelect
                    selected={form.dias_semana}
                    onChange={v => setForm(f => ({ ...f, dias_semana: v }))}
                  />
                </div>

                {/* Cor */}
                <div>
                  <label className={LBL}>Cor</label>
                  <div
                    className="flex items-center gap-3 border-b border-gray-300 py-2 cursor-pointer hover:border-primary/60 transition-colors"
                    onClick={() => colorInputRef.current?.click()}
                  >
                    <div
                      className="w-6 h-6 rounded flex-shrink-0"
                      style={{ backgroundColor: form.cor }}
                    />
                    <span className="text-sm text-gray-700">{form.cor}</span>
                  </div>
                  <input
                    ref={colorInputRef}
                    type="color"
                    value={form.cor}
                    onChange={e => setForm(f => ({ ...f, cor: e.target.value }))}
                    className="sr-only"
                  />
                </div>
              </div>
            )}

            {/* Divider: Wellhub */}
            <div>
              <div className="flex items-center gap-3 my-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Wellhub</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className={LBL}>Product ID</label>
                  <div className="relative">
                    <select className={`${SEL} text-gray-400`} disabled>
                      <option value="">—</option>
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
                  </div>
                </div>
                <div className="flex-1">
                  <label className={LBL}>Tipo</label>
                  <div className="relative">
                    <select className={`${SEL} text-gray-400`} disabled>
                      <option value="">—</option>
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
                  </div>
                </div>
                <button disabled className="text-xs font-semibold text-gray-300 border border-gray-200 rounded px-3 py-1.5 mb-0.5 cursor-not-allowed whitespace-nowrap">
                  ADICIONAR
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Integração Wellhub em breve.</p>
            </div>

            {/* Divider: TotalPass */}
            <div>
              <div className="flex items-center gap-3 my-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">TotalPass</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className={LBL}>Planos</label>
                  <div className="relative">
                    <select className={`${SEL} text-gray-400`} disabled>
                      <option value="">—</option>
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
                  </div>
                </div>
                <div className="flex-1">
                  <label className={LBL}>Tipo</label>
                  <div className="relative">
                    <select className={`${SEL} text-gray-400`} disabled>
                      <option value="">—</option>
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
                  </div>
                </div>
                <button disabled className="text-xs font-semibold text-gray-300 border border-gray-200 rounded px-3 py-1.5 mb-0.5 cursor-not-allowed whitespace-nowrap">
                  ADICIONAR
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Integração TotalPass em breve.</p>
            </div>

            {/* Divider: Ícones */}
            <div>
              <div className="flex items-center gap-3 my-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Ícones</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center relative cursor-pointer group"
                  style={{ backgroundColor: form.cor + "22" }}
                  onClick={() => setShowIconPicker(true)}
                >
                  <IconComponent className="w-7 h-7" style={{ color: form.cor }} />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow">
                    <Pencil className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>
                <span className="text-sm text-gray-500">Clique para trocar o ícone</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
            <button onClick={onClose} className="text-primary font-semibold text-sm hover:underline px-2">
              CANCELAR
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? "SALVANDO..." : "SALVAR"}
            </button>
          </div>
        </div>
      </div>

      {showIconPicker && (
        <IconPickerModal
          selected={form.icone}
          iconColor={form.cor}
          onSelect={name => setForm(f => ({ ...f, icone: name }))}
          onClose={() => setShowIconPicker(false)}
        />
      )}
    </>
  );
}
