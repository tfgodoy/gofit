import { useState, useEffect } from "react";
import {
  Plus, X, Loader2, ChevronRight, ChevronLeft,
  Phone, Mail, User, Calendar, DollarSign, Trash2, Pencil,
  TrendingUp,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── types ──────────────────────────────────────────────────── */

type Etapa = "lead" | "visita" | "proposta" | "matricula" | "perdido";

interface Opportunity {
  id: string;
  student_id: string | null;
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

const ETAPAS: { key: Etapa; label: string; color: string; bg: string; border: string }[] = [
  { key: "lead",      label: "Lead",              color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  { key: "visita",    label: "Visita agendada",   color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
  { key: "proposta",  label: "Proposta enviada",  color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  { key: "matricula", label: "Matrícula",         color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200" },
  { key: "perdido",   label: "Perdido",           color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
];

const ORIGENS = [
  { value: "manual",     label: "Manual" },
  { value: "instagram",  label: "Instagram" },
  { value: "facebook",   label: "Facebook" },
  { value: "google",     label: "Google" },
  { value: "indicacao",  label: "Indicação" },
  { value: "site",       label: "Site" },
  { value: "evento",     label: "Evento" },
  { value: "whatsapp",   label: "WhatsApp" },
  { value: "convite",    label: "Convite (link)" },
];

const ORIGEM_LABEL: Record<string, string> = Object.fromEntries(ORIGENS.map(o => [o.value, o.label]));

const ETAPA_ORDER: Etapa[] = ["lead", "visita", "proposta", "matricula", "perdido"];

function fmtBR(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

function fmtMoney(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ── Opportunity Modal (create/edit) ─────────────────────────── */

const inputClass =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

interface OppForm {
  nome: string;
  email: string;
  telefone: string;
  origem: string;
  etapa: Etapa;
  valor_estimado: string;
  data_prevista: string;
  responsavel_nome: string;
  observacoes: string;
  motivo_perda: string;
}

const emptyForm: OppForm = {
  nome: "", email: "", telefone: "", origem: "manual", etapa: "lead",
  valor_estimado: "", data_prevista: "", responsavel_nome: "",
  observacoes: "", motivo_perda: "",
};

function OppModal({
  opp,
  defaultEtapa,
  onSave,
  onClose,
}: {
  opp: Opportunity | null;
  defaultEtapa: Etapa;
  onSave: (form: OppForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<OppForm>(
    opp
      ? {
          nome:             opp.nome,
          email:            opp.email ?? "",
          telefone:         opp.telefone ?? "",
          origem:           opp.origem,
          etapa:            opp.etapa,
          valor_estimado:   opp.valor_estimado != null ? String(opp.valor_estimado) : "",
          data_prevista:    opp.data_prevista ?? "",
          responsavel_nome: opp.responsavel_nome ?? "",
          observacoes:      opp.observacoes ?? "",
          motivo_perda:     opp.motivo_perda ?? "",
        }
      : { ...emptyForm, etapa: defaultEtapa }
  );
  const [saving, setSaving] = useState(false);

  function set(k: keyof OppForm, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-800">
            {opp ? "Editar oportunidade" : "Nova oportunidade"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nome *</label>
            <input
              autoFocus
              value={form.nome}
              onChange={e => set("nome", e.target.value)}
              placeholder="Nome do lead"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Telefone / WhatsApp</label>
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
              <label className="block text-xs font-semibold text-gray-500 mb-1">Etapa</label>
              <select value={form.etapa} onChange={e => set("etapa", e.target.value as Etapa)} className={inputClass}>
                {ETAPAS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Valor estimado (R$)</label>
              <input type="number" step="0.01" value={form.valor_estimado} onChange={e => set("valor_estimado", e.target.value)} placeholder="0,00" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Data prevista de fechamento</label>
              <input type="date" value={form.data_prevista} onChange={e => set("data_prevista", e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Responsável</label>
            <input value={form.responsavel_nome} onChange={e => set("responsavel_nome", e.target.value)} placeholder="Nome do responsável" className={inputClass} />
          </div>

          {form.etapa === "perdido" && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Motivo da perda</label>
              <input value={form.motivo_perda} onChange={e => set("motivo_perda", e.target.value)} placeholder="Ex: Preço, concorrência..." className={inputClass} />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={e => set("observacoes", e.target.value)}
              rows={3}
              placeholder="Anotações sobre esta oportunidade..."
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2">
            CANCELAR
          </button>
          <button
            onClick={handleSave}
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

/* ── Opportunity Card ─────────────────────────────────────────── */

function OppCard({
  opp,
  etapas,
  onEdit,
  onDelete,
  onMove,
  onDragStart,
}: {
  opp: Opportunity;
  etapas: typeof ETAPAS;
  onEdit: (o: Opportunity) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, etapa: Etapa) => void;
  onDragStart: (id: string) => void;
}) {
  const currentIdx = ETAPA_ORDER.indexOf(opp.etapa);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < ETAPA_ORDER.length - 1;

  const etapaInfo = etapas.find(e => e.key === opp.etapa);

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = "move"; onDragStart(opp.id); }}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 group cursor-grab active:cursor-grabbing active:opacity-60 active:shadow-md transition-opacity"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-sm font-bold text-gray-800 leading-snug">{opp.nome}</p>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => onEdit(opp)}
            className="p-1 rounded hover:bg-gray-100"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={() => onDelete(opp.id)}
            className="p-1 rounded hover:bg-red-50 text-red-400"
            title="Excluir"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        {opp.telefone && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span>{opp.telefone}</span>
          </div>
        )}
        {opp.email && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{opp.email}</span>
          </div>
        )}
        {opp.responsavel_nome && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <User className="w-3 h-3 flex-shrink-0" />
            <span>{opp.responsavel_nome}</span>
          </div>
        )}
        {opp.data_prevista && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span>{fmtBR(opp.data_prevista)}</span>
          </div>
        )}
        {opp.valor_estimado != null && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
            <DollarSign className="w-3 h-3 flex-shrink-0" />
            <span>{fmtMoney(opp.valor_estimado)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${etapaInfo?.bg ?? "bg-gray-100"} ${etapaInfo?.color ?? "text-gray-600"}`}>
          {ORIGEM_LABEL[opp.origem] ?? opp.origem}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={!canPrev}
            onClick={() => canPrev && onMove(opp.id, ETAPA_ORDER[currentIdx - 1])}
            className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20"
            title="Mover para etapa anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <button
            disabled={!canNext}
            onClick={() => canNext && onMove(opp.id, ETAPA_ORDER[currentIdx + 1])}
            className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20"
            title="Mover para próxima etapa"
          >
            <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */

export default function OportunidadesPage() {
  const { user } = useAuth();
  const [opps, setOpps]         = useState<Opportunity[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState<false | null | Opportunity>(false);
  const [modalEtapa, setModalEtapa] = useState<Etapa>("lead");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dragId, setDragId]     = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Etapa | null>(null);

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

  async function handleSave(form: OppForm) {
    if (!user) return;
    const payload = {
      contractor_id:    user.contractorId!,
      nome:             form.nome.trim(),
      email:            form.email.trim() || null,
      telefone:         form.telefone.trim() || null,
      origem:           form.origem,
      etapa:            form.etapa,
      valor_estimado:   form.valor_estimado ? parseFloat(form.valor_estimado) : null,
      data_prevista:    form.data_prevista || null,
      responsavel_nome: form.responsavel_nome.trim() || null,
      observacoes:      form.observacoes.trim() || null,
      motivo_perda:     form.motivo_perda.trim() || null,
      updated_at:       new Date().toISOString(),
    };

    if (modal && (modal as Opportunity).id) {
      await supabase.from("opportunities").update(payload).eq("id", (modal as Opportunity).id);
      toast.success("Oportunidade atualizada!");
    } else {
      await supabase.from("opportunities").insert(payload);
      toast.success("Oportunidade criada!");
    }
    setModal(false);
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("opportunities").delete().eq("id", id);
    toast.success("Oportunidade excluída.");
    setDeleteId(null);
    load();
  }

  async function handleMove(id: string, etapa: Etapa) {
    await supabase
      .from("opportunities")
      .update({ etapa, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (etapa === "matricula") {
      const opp = opps.find(o => o.id === id);
      if (opp?.student_id) {
        await supabase
          .from("students")
          .update({ status: "ativo" })
          .eq("id", opp.student_id);
      }
    }

    setOpps(prev => prev.map(o => o.id === id ? { ...o, etapa } : o));
  }

  function openNew(etapa: Etapa) {
    setModalEtapa(etapa);
    setModal(null);
  }

  const byEtapa = (etapa: Etapa) => opps.filter(o => o.etapa === etapa);

  const totalValor = opps
    .filter(o => o.etapa !== "perdido")
    .reduce((s, o) => s + (o.valor_estimado ?? 0), 0);

  return (
    <AppLayout>
      <div className="px-6 py-6 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Funil de Oportunidades</h1>
              <p className="text-sm text-gray-400">
                {opps.filter(o => o.etapa !== "perdido").length} ativas
                {totalValor > 0 && ` · ${fmtMoney(totalValor)} em aberto`}
              </p>
            </div>
          </div>
          <button
            onClick={() => openNew("lead")}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            NOVA OPORTUNIDADE
          </button>
        </div>

        {/* Kanban Board */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
            {ETAPAS.map(etapa => {
              const cards = byEtapa(etapa.key);
              const etapaValor = cards.reduce((s, o) => s + (o.valor_estimado ?? 0), 0);
              const isOver = dragOver === etapa.key && dragId !== null;
              return (
                <div
                  key={etapa.key}
                  className={`flex flex-col flex-shrink-0 w-72 rounded-2xl transition-colors ${
                    isOver ? `${etapa.bg} ring-2 ring-offset-1 ${etapa.border}` : "bg-gray-50"
                  }`}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(etapa.key); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOver(null);
                    if (dragId) {
                      const opp = opps.find(o => o.id === dragId);
                      if (opp && opp.etapa !== etapa.key) handleMove(dragId, etapa.key);
                      setDragId(null);
                    }
                  }}
                >
                  {/* Column header */}
                  <div className={`px-4 py-3 rounded-t-2xl ${etapa.bg} ${etapa.border} border-b`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-bold ${etapa.color}`}>{etapa.label}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white/70 ${etapa.color}`}>
                          {cards.length}
                        </span>
                        <button
                          onClick={() => openNew(etapa.key)}
                          className={`p-0.5 rounded hover:bg-white/50 ${etapa.color}`}
                          title="Adicionar"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {etapaValor > 0 && (
                      <p className={`text-xs mt-0.5 ${etapa.color} opacity-70`}>
                        {fmtMoney(etapaValor)}
                      </p>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[80px]">
                    {cards.length === 0 ? (
                      <div className={`text-center py-8 rounded-xl border-2 border-dashed transition-colors ${
                        isOver ? `${etapa.border} ${etapa.bg}` : "border-gray-200"
                      }`}>
                        <p className={`text-xs transition-colors ${isOver ? etapa.color : "text-gray-300"}`}>
                          {isOver ? "Soltar aqui" : "Nenhuma oportunidade"}
                        </p>
                      </div>
                    ) : (
                      cards.map(opp => (
                        <OppCard
                          key={opp.id}
                          opp={opp}
                          etapas={ETAPAS}
                          onEdit={o => setModal(o)}
                          onDelete={id => setDeleteId(id)}
                          onMove={handleMove}
                          onDragStart={id => setDragId(id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {modal !== false && (
        <OppModal
          opp={modal}
          defaultEtapa={modalEtapa}
          onSave={handleSave}
          onClose={() => setModal(false)}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 mb-2">Excluir oportunidade</h3>
            <p className="text-sm text-gray-500 mb-5">Tem certeza? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="text-sm font-bold text-gray-500 hover:underline">Cancelar</button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="bg-red-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
