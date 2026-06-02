import { useState, useEffect } from "react";
import {
  CheckSquare, Plus, X, Loader2, Pencil, Trash2,
  Calendar, User, ChevronDown,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── types ──────────────────────────────────────────────────── */

interface TipoDinamico { id: string; nome: string; }

type StatusAtividade = "pendente" | "realizado" | "cancelado";

interface Activity {
  id: string;
  opportunity_id: string | null;
  student_id: string | null;
  tipo: string;
  descricao: string | null;
  data_atividade: string;
  responsavel_nome: string | null;
  status: StatusAtividade;
  created_at: string;
}

/* ── constants ──────────────────────────────────────────────── */

const STATUS_CONFIG: Record<StatusAtividade, { label: string; bg: string; text: string }> = {
  pendente:  { label: "Pendente",  bg: "bg-yellow-100", text: "text-yellow-700" },
  realizado: { label: "Realizado", bg: "bg-green-100",  text: "text-green-700"  },
  cancelado: { label: "Cancelado", bg: "bg-gray-100",   text: "text-gray-500"   },
};

const inputClass =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── Modal ──────────────────────────────────────────────────── */

interface AtvForm {
  tipo: string;
  descricao: string;
  data_atividade: string;
  responsavel_nome: string;
  status: StatusAtividade;
}

function nowLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyForm: AtvForm = {
  tipo: "", descricao: "", data_atividade: nowLocal(),
  responsavel_nome: "", status: "realizado",
};

function AtvModal({ atv, tiposDinamicos, onSave, onClose }: {
  atv: Activity | null;
  tiposDinamicos: TipoDinamico[];
  onSave: (f: AtvForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm]   = useState<AtvForm>(
    atv
      ? {
          tipo:             atv.tipo,
          descricao:        atv.descricao ?? "",
          data_atividade:   atv.data_atividade.slice(0, 16),
          responsavel_nome: atv.responsavel_nome ?? "",
          status:           atv.status,
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);

  function set(k: keyof AtvForm, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function go() {
    if (!form.tipo) { toast.error("Selecione o tipo de atividade"); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{atv ? "Editar Atividade" : "Nova Atividade"}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => set("tipo", e.target.value)} className={inputClass}>
                <option value="">Selecione...</option>
                {tiposDinamicos.length > 0
                  ? tiposDinamicos.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)
                  : <option disabled>Nenhum tipo cadastrado</option>
                }
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)} className={inputClass}>
                {(Object.entries(STATUS_CONFIG) as [StatusAtividade, { label: string }][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Data e hora</label>
            <input type="datetime-local" value={form.data_atividade} onChange={e => set("data_atividade", e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Responsável</label>
            <input value={form.responsavel_nome} onChange={e => set("responsavel_nome", e.target.value)} placeholder="Nome do responsável" className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição / Observações</label>
            <textarea
              autoFocus
              value={form.descricao}
              onChange={e => set("descricao", e.target.value)}
              rows={3}
              placeholder="Descreva o que aconteceu..."
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
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

export default function AtividadesPage() {
  const { user } = useAuth();
  const [ativs, setAtivs]               = useState<Activity[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState<false | null | Activity>(false);
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [tiposDinamicos, setTiposDinamicos] = useState<TipoDinamico[]>([]);
  const [filterTipo, setFilterTipo]     = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<StatusAtividade | "">("");

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("activities")
      .select("*")
      .eq("contractor_id", user.contractorId!)
      .order("data_atividade", { ascending: false });
    setAtivs((data ?? []) as Activity[]);
    setLoading(false);
  }

  async function loadTipos() {
    if (!user?.contractorId) return;
    const { data } = await supabase
      .from("crm_config")
      .select("id, nome")
      .eq("contractor_id", user.contractorId)
      .eq("categoria", "tipo_atividade")
      .eq("ativo", true)
      .order("ordem");
    setTiposDinamicos((data ?? []) as TipoDinamico[]);
  }

  useEffect(() => { load(); loadTipos(); }, [user]);

  async function handleSave(form: AtvForm) {
    if (!user) return;
    const payload = {
      contractor_id:    user.contractorId!,
      tipo:             form.tipo,
      descricao:        form.descricao.trim() || null,
      data_atividade:   new Date(form.data_atividade).toISOString(),
      responsavel_nome: form.responsavel_nome.trim() || null,
      status:           form.status,
    };

    if (modal && (modal as Activity).id) {
      await supabase.from("activities").update(payload).eq("id", (modal as Activity).id);
      toast.success("Atividade atualizada!");
    } else {
      await supabase.from("activities").insert(payload);
      toast.success("Atividade registrada!");
    }
    setModal(false);
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("activities").delete().eq("id", id);
    toast.success("Atividade excluída.");
    setDeleteId(null);
    load();
  }

  async function toggleStatus(atv: Activity) {
    const next: StatusAtividade = atv.status === "realizado" ? "pendente" : "realizado";
    await supabase.from("activities").update({ status: next }).eq("id", atv.id);
    setAtivs(prev => prev.map(a => a.id === atv.id ? { ...a, status: next } : a));
  }

  const filtered = ativs.filter(a => {
    const matchTipo   = !filterTipo   || a.tipo === filterTipo;
    const matchStatus = !filterStatus || a.status === filterStatus;
    return matchTipo && matchStatus;
  });

  const pendentes  = ativs.filter(a => a.status === "pendente").length;
  const realizados = ativs.filter(a => a.status === "realizado").length;

  return (
    <AppLayout>
      <div className="px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Atividades</h1>
              <p className="text-sm text-gray-400">{pendentes} pendentes · {realizados} realizadas</p>
            </div>
          </div>
          <button
            onClick={() => setModal(null)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            NOVA ATIVIDADE
          </button>
        </div>

        {/* Type pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilterTipo("")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              !filterTipo ? "bg-primary text-white border-primary" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
            }`}
          >
            Todos
          </button>
          {tiposDinamicos.map(t => (
            <button
              key={t.id}
              onClick={() => setFilterTipo(prev => prev === t.nome ? "" : t.nome)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                filterTipo === t.nome
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}
            >
              {t.nome}
            </button>
          ))}
          <div className="ml-auto">
            <div className="relative">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as StatusAtividade | "")}
                className="text-xs font-semibold text-gray-600 border border-gray-200 rounded-full pl-3 pr-7 py-1.5 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Todos status</option>
                {(Object.entries(STATUS_CONFIG) as [StatusAtividade, { label: string }][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center">
              <CheckSquare className="w-7 h-7 text-orange-300" />
            </div>
            <p className="text-sm text-gray-400 font-semibold">Nenhuma atividade encontrada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(atv => {
              const sc = STATUS_CONFIG[atv.status] ?? STATUS_CONFIG.realizado;
              return (
                <div
                  key={atv.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3.5 flex items-start gap-4 group"
                >
                  {/* Toggle icon */}
                  <button
                    onClick={() => toggleStatus(atv)}
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 transition-colors bg-primary/10 text-primary hover:bg-primary/20"
                    title="Alternar status"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {atv.tipo}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                        {sc.label}
                      </span>
                    </div>
                    {atv.descricao && (
                      <p className="text-sm text-gray-700 leading-snug mb-1">{atv.descricao}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {fmtDateTime(atv.data_atividade)}
                      </span>
                      {atv.responsavel_nome && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {atv.responsavel_nome}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => setModal(atv)}
                      className="p-1.5 rounded hover:bg-gray-100"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => setDeleteId(atv.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-red-400"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal !== false && (
        <AtvModal
          atv={modal}
          tiposDinamicos={tiposDinamicos}
          onSave={handleSave}
          onClose={() => setModal(false)}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 mb-2">Excluir atividade</h3>
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
