import { useState, useEffect } from "react";
import {
  Bot, Plus, X, Loader2, Pencil, Trash2, Play,
  Pause, MessageCircle, Mail, Send, ChevronDown,
  Zap, Users,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── types ──────────────────────────────────────────────────── */

type CanalType  = "whatsapp" | "email" | "sms";
type TipoType   = "manual" | "automatica";
type StatusType = "rascunho" | "ativo" | "pausado" | "concluido";

interface Campaign {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: TipoType;
  canal: CanalType;
  status: StatusType;
  gatilho: string | null;
  dias_apos_gatilho: number;
  mensagem: string | null;
  total_enviados: number;
  created_at: string;
  updated_at: string;
}

/* ── constants ──────────────────────────────────────────────── */

const CANAL_CONFIG: Record<CanalType, { label: string; icon: React.ReactNode; bg: string; color: string }> = {
  whatsapp: { label: "WhatsApp",  icon: <MessageCircle className="w-3.5 h-3.5" />, bg: "bg-green-100",  color: "text-green-700"  },
  email:    { label: "E-mail",    icon: <Mail className="w-3.5 h-3.5" />,          bg: "bg-blue-100",   color: "text-blue-700"   },
  sms:      { label: "SMS",       icon: <Send className="w-3.5 h-3.5" />,          bg: "bg-orange-100", color: "text-orange-700" },
};

const STATUS_CONFIG: Record<StatusType, { label: string; bg: string; text: string }> = {
  rascunho:  { label: "Rascunho",  bg: "bg-gray-100",   text: "text-gray-600"   },
  ativo:     { label: "Ativo",     bg: "bg-green-100",  text: "text-green-700"  },
  pausado:   { label: "Pausado",   bg: "bg-yellow-100", text: "text-yellow-700" },
  concluido: { label: "Concluído", bg: "bg-blue-100",   text: "text-blue-700"   },
};

const GATILHOS = [
  { value: "vencimento",  label: "Vencimento de contrato" },
  { value: "aniversario", label: "Aniversário do aluno"   },
  { value: "inatividade", label: "Inatividade"            },
  { value: "matricula",   label: "Após matrícula"         },
  { value: "lead",        label: "Novo lead"              },
];

const inputClass =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

/* ── Modal ──────────────────────────────────────────────────── */

interface CampForm {
  nome: string;
  descricao: string;
  tipo: TipoType;
  canal: CanalType;
  status: StatusType;
  gatilho: string;
  dias_apos_gatilho: string;
  mensagem: string;
}

const emptyForm: CampForm = {
  nome: "", descricao: "", tipo: "manual", canal: "whatsapp",
  status: "rascunho", gatilho: "", dias_apos_gatilho: "0", mensagem: "",
};

function CampModal({ camp, onSave, onClose }: {
  camp: Campaign | null;
  onSave: (f: CampForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm]   = useState<CampForm>(
    camp
      ? {
          nome:              camp.nome,
          descricao:         camp.descricao ?? "",
          tipo:              camp.tipo,
          canal:             camp.canal,
          status:            camp.status,
          gatilho:           camp.gatilho ?? "",
          dias_apos_gatilho: String(camp.dias_apos_gatilho),
          mensagem:          camp.mensagem ?? "",
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);

  function set(k: keyof CampForm, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function go() {
    if (!form.nome.trim()) { toast.error("Informe o nome da campanha"); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  const isAuto = form.tipo === "automatica";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: "92vh" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-800">{camp ? "Editar campanha" : "Nova campanha"}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nome *</label>
            <input autoFocus value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Nome da campanha" className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição</label>
            <input value={form.descricao} onChange={e => set("descricao", e.target.value)} placeholder="Descrição opcional" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => set("tipo", e.target.value)} className={inputClass}>
                <option value="manual">Manual</option>
                <option value="automatica">Automática</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Canal</label>
              <select value={form.canal} onChange={e => set("canal", e.target.value)} className={inputClass}>
                {(Object.entries(CANAL_CONFIG) as [CanalType, { label: string }][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)} className={inputClass}>
              {(Object.entries(STATUS_CONFIG) as [StatusType, { label: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {isAuto && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-orange-700 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Configuração de automação
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Gatilho</label>
                  <div className="relative">
                    <select value={form.gatilho} onChange={e => set("gatilho", e.target.value)} className={inputClass}>
                      <option value="">Selecione...</option>
                      {GATILHOS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Dias após gatilho</label>
                  <input
                    type="number" min="0"
                    value={form.dias_apos_gatilho}
                    onChange={e => set("dias_apos_gatilho", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Mensagem</label>
            <textarea
              value={form.mensagem}
              onChange={e => set("mensagem", e.target.value)}
              rows={5}
              placeholder={
                form.canal === "whatsapp"
                  ? "Olá {{nome}}, temos uma novidade para você! 🎉"
                  : "Digite a mensagem da campanha..."
              }
              className={`${inputClass} resize-none`}
            />
            <p className="text-xs text-gray-400 mt-1">
              Use <code className="bg-gray-100 px-1 rounded">{"{{nome}}"}</code> para o nome do aluno.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2">CANCELAR</button>
          <button
            onClick={go}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */

export default function CampanhasPage() {
  const { user } = useAuth();
  const [camps, setCamps]       = useState<Campaign[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState<false | null | Campaign>(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterTipo, setFilterTipo] = useState<TipoType | "">("");

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .eq("contractor_id", user.contractorId!)
      .order("created_at", { ascending: false });
    setCamps((data ?? []) as Campaign[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  async function handleSave(form: CampForm) {
    if (!user) return;
    const payload = {
      contractor_id:     user.contractorId!,
      nome:              form.nome.trim(),
      descricao:         form.descricao.trim() || null,
      tipo:              form.tipo,
      canal:             form.canal,
      status:            form.status,
      gatilho:           form.gatilho || null,
      dias_apos_gatilho: parseInt(form.dias_apos_gatilho) || 0,
      mensagem:          form.mensagem.trim() || null,
      updated_at:        new Date().toISOString(),
    };

    if (modal && (modal as Campaign).id) {
      await supabase.from("campaigns").update(payload).eq("id", (modal as Campaign).id);
      toast.success("Campanha atualizada!");
    } else {
      await supabase.from("campaigns").insert(payload);
      toast.success("Campanha criada!");
    }
    setModal(false);
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("campaigns").delete().eq("id", id);
    toast.success("Campanha excluída.");
    setDeleteId(null);
    load();
  }

  async function toggleStatus(camp: Campaign) {
    const next: StatusType = camp.status === "ativo" ? "pausado" : "ativo";
    await supabase.from("campaigns").update({ status: next }).eq("id", camp.id);
    setCamps(prev => prev.map(c => c.id === camp.id ? { ...c, status: next } : c));
    toast.success(next === "ativo" ? "Campanha ativada!" : "Campanha pausada.");
  }

  const filtered = filterTipo ? camps.filter(c => c.tipo === filterTipo) : camps;
  const ativas   = camps.filter(c => c.status === "ativo").length;
  const auto     = camps.filter(c => c.tipo === "automatica").length;

  return (
    <AppLayout>
      <div className="px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <Bot className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Automações / Campanhas</h1>
              <p className="text-sm text-gray-400">
                {ativas} ativas · {auto} automáticas
              </p>
            </div>
          </div>
          <button
            onClick={() => setModal(null)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            NOVA CAMPANHA
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5">
          {[
            { value: "" as const,         label: "Todas" },
            { value: "manual" as const,   label: "Manuais" },
            { value: "automatica" as const, label: "Automáticas" },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilterTipo(value)}
              className={`text-sm font-semibold px-4 py-1.5 rounded-full border transition-colors ${
                filterTipo === value
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Cards grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center">
              <Bot className="w-7 h-7 text-orange-300" />
            </div>
            <p className="text-sm text-gray-400 font-semibold">Nenhuma campanha encontrada</p>
            <p className="text-xs text-gray-400">Clique em "NOVA CAMPANHA" para começar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(camp => {
              const cc = CANAL_CONFIG[camp.canal] ?? CANAL_CONFIG.whatsapp;
              const sc = STATUS_CONFIG[camp.status] ?? STATUS_CONFIG.rascunho;
              return (
                <div
                  key={camp.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4 group"
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${cc.bg} ${cc.color}`}>
                          {cc.icon} {cc.label}
                        </div>
                        {camp.tipo === "automatica" && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                            <Zap className="w-2.5 h-2.5" /> Auto
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-gray-800 truncate">{camp.nome}</p>
                      {camp.descricao && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{camp.descricao}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setModal(camp)}
                        className="p-1.5 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                      <button
                        onClick={() => setDeleteId(camp.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Mensagem preview */}
                  {camp.mensagem && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5 line-clamp-3 leading-relaxed">
                      {camp.mensagem}
                    </p>
                  )}

                  {/* Gatilho info */}
                  {camp.tipo === "automatica" && camp.gatilho && (
                    <div className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
                      <Zap className="w-3 h-3 flex-shrink-0" />
                      <span>
                        {GATILHOS.find(g => g.value === camp.gatilho)?.label ?? camp.gatilho}
                        {camp.dias_apos_gatilho > 0 && ` · ${camp.dias_apos_gatilho} dias depois`}
                      </span>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-auto pt-1 border-t border-gray-50">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                        {sc.label}
                      </span>
                      {camp.total_enviados > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Users className="w-3 h-3" /> {camp.total_enviados}
                        </span>
                      )}
                    </div>
                    {camp.status !== "concluido" && (
                      <button
                        onClick={() => toggleStatus(camp)}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                          camp.status === "ativo"
                            ? "text-yellow-700 hover:bg-yellow-50"
                            : "text-green-700 hover:bg-green-50"
                        }`}
                      >
                        {camp.status === "ativo"
                          ? <><Pause className="w-3 h-3" /> PAUSAR</>
                          : <><Play className="w-3 h-3" /> ATIVAR</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal !== false && (
        <CampModal camp={modal} onSave={handleSave} onClose={() => setModal(false)} />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 mb-2">Excluir campanha</h3>
            <p className="text-sm text-gray-500 mb-5">Tem certeza? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="text-sm font-bold text-gray-500 hover:underline">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} className="bg-red-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-red-700">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
