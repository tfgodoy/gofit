import { useState, useEffect } from "react";
import {
  UserPlus, Plus, Search, X, Loader2, Trash2,
  Phone, Mail, Calendar, ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── types ──────────────────────────────────────────────────── */

type Etapa = "lead" | "visita" | "proposta" | "matricula" | "perdido";

interface Opportunity {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  origem: string;
  etapa: Etapa;
  valor_estimado: number | null;
  data_entrada: string | null;
  data_prevista: string | null;
  responsavel_nome: string | null;
  observacoes: string | null;
  motivo_perda: string | null;
  created_at: string;
}

/* ── constants ──────────────────────────────────────────────── */

const ETAPA_STYLE: Record<Etapa, { label: string; bg: string; text: string }> = {
  lead:      { label: "Lead",             bg: "bg-blue-100",   text: "text-blue-700"   },
  visita:    { label: "Visita",           bg: "bg-purple-100", text: "text-purple-700" },
  proposta:  { label: "Proposta",         bg: "bg-orange-100", text: "text-orange-700" },
  matricula: { label: "Matrícula",        bg: "bg-green-100",  text: "text-green-700"  },
  perdido:   { label: "Perdido",          bg: "bg-red-100",    text: "text-red-700"    },
};

const ORIGENS = [
  { value: "manual",    label: "Manual"    },
  { value: "instagram", label: "Instagram" },
  { value: "facebook",  label: "Facebook"  },
  { value: "google",    label: "Google"    },
  { value: "indicacao", label: "Indicação" },
  { value: "site",      label: "Site"      },
  { value: "evento",    label: "Evento"    },
  { value: "whatsapp",  label: "WhatsApp"  },
];

const ORIGEM_LABEL: Record<string, string> = Object.fromEntries(ORIGENS.map(o => [o.value, o.label]));

const inputClass =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

function fmtBR(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

/* ── Quick-create modal (re-used from Oportunidades) ─────────── */

interface QuickForm {
  nome: string; email: string; telefone: string;
  origem: string; etapa: Etapa;
}
const emptyQ: QuickForm = { nome: "", email: "", telefone: "", origem: "manual", etapa: "lead" };

function QuickModal({ onSave, onClose }: {
  onSave: (f: QuickForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm]   = useState<QuickForm>(emptyQ);
  const [saving, setSaving] = useState(false);

  function set(k: keyof QuickForm, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function go() {
    if (!form.nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Novo Lead</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nome *</label>
            <input autoFocus value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Nome do lead" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Telefone</label>
              <input value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(00) 00000-0000" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">E-mail</label>
              <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@exemplo.com" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Origem</label>
              <select value={form.origem} onChange={e => set("origem", e.target.value)} className={inputClass}>
                {ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Etapa inicial</label>
              <select value={form.etapa} onChange={e => set("etapa", e.target.value as Etapa)} className={inputClass}>
                {(Object.entries(ETAPA_STYLE) as [Etapa, { label: string }][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
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
            CRIAR LEAD
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */

export default function LeadsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [opps, setOpps]         = useState<Opportunity[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filterEtapa, setFilterEtapa] = useState<Etapa | "">("");
  const [modal, setModal]       = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("opportunities")
      .select("*")
      .eq("contractor_id", user.contractorId!)
      .order("created_at", { ascending: false });
    setOpps((data ?? []) as Opportunity[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  async function handleSave(form: QuickForm) {
    if (!user) return;
    await supabase.from("opportunities").insert({
      contractor_id: user.contractorId!,
      nome:          form.nome.trim(),
      email:         form.email.trim() || null,
      telefone:      form.telefone.trim() || null,
      origem:        form.origem,
      etapa:         form.etapa,
    });
    toast.success("Lead criado!");
    setModal(false);
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("opportunities").delete().eq("id", id);
    toast.success("Lead excluído.");
    setDeleteId(null);
    load();
  }

  /* Metrics */
  const counts = Object.fromEntries(
    (Object.keys(ETAPA_STYLE) as Etapa[]).map(k => [k, opps.filter(o => o.etapa === k).length])
  ) as Record<Etapa, number>;

  const filtered = opps.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q || o.nome.toLowerCase().includes(q) || (o.email ?? "").toLowerCase().includes(q) || (o.telefone ?? "").includes(q);
    const matchEtapa = !filterEtapa || o.etapa === filterEtapa;
    return matchSearch && matchEtapa;
  });

  return (
    <AppLayout>
      <div className="px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Leads</h1>
              <p className="text-sm text-gray-400">{opps.length} oportunidades no total</p>
            </div>
          </div>
          <button
            onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            NOVO LEAD
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {(Object.entries(ETAPA_STYLE) as [Etapa, { label: string; bg: string; text: string }][]).map(([k, s]) => (
            <button
              key={k}
              onClick={() => setFilterEtapa(prev => prev === k ? "" : k)}
              className={`rounded-xl border px-4 py-3 text-left transition-all ${
                filterEtapa === k
                  ? `${s.bg} border-current ${s.text} ring-2 ring-offset-1`
                  : "bg-white border-gray-100 hover:border-gray-200"
              }`}
            >
              <p className={`text-2xl font-extrabold ${filterEtapa === k ? s.text : "text-gray-800"}`}>
                {counts[k]}
              </p>
              <p className={`text-xs font-semibold mt-0.5 ${filterEtapa === k ? s.text : "text-gray-500"}`}>
                {s.label}
              </p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail ou telefone..."
              className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
          </div>
          {filterEtapa && (
            <button
              onClick={() => setFilterEtapa("")}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 py-2 border border-gray-200 rounded-xl"
            >
              <X className="w-3 h-3" /> Limpar filtro
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center">
                <UserPlus className="w-7 h-7 text-orange-300" />
              </div>
              <p className="text-sm text-gray-400 font-semibold">
                {search || filterEtapa ? "Nenhum resultado encontrado" : "Nenhum lead cadastrado"}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">NOME</th>
                  <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3 hidden md:table-cell">CONTATO</th>
                  <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">ORIGEM</th>
                  <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">ETAPA</th>
                  <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3 hidden lg:table-cell">ENTRADA</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const s = ETAPA_STYLE[o.etapa];
                  const phone = (o.telefone ?? "").replace(/\D/g, "");
                  return (
                    <tr key={o.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 group">
                      <td className="px-5 py-3">
                        <p className="text-sm font-semibold text-gray-800">{o.nome}</p>
                        {o.responsavel_nome && (
                          <p className="text-xs text-gray-400">Resp: {o.responsavel_nome}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <div className="space-y-0.5">
                          {o.telefone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              <span className="text-xs text-gray-600">{o.telefone}</span>
                              {phone && (
                                <button
                                  onClick={() => window.open(`https://wa.me/55${phone}`, "_blank")}
                                  className="text-[10px] font-bold text-green-600 hover:underline ml-1"
                                >
                                  WA
                                </button>
                              )}
                            </div>
                          )}
                          {o.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              <span className="text-xs text-gray-600 truncate max-w-[160px]">{o.email}</span>
                            </div>
                          )}
                          {!o.telefone && !o.email && <span className="text-xs text-gray-300">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-gray-600">{ORIGEM_LABEL[o.origem] ?? o.origem}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {fmtBR(o.data_entrada)}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => navigate(`/app/crm/oportunidades`)}
                            className="p-1.5 rounded hover:bg-gray-100"
                            title="Ver no funil"
                          >
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => setDeleteId(o.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-red-400"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && <QuickModal onSave={handleSave} onClose={() => setModal(false)} />}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 mb-2">Excluir lead</h3>
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
