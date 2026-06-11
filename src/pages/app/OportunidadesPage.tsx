import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { useState, useEffect, useRef } from "react";
import {
  Plus, X, Loader2, ChevronRight, ChevronLeft,
  Phone, Mail, User, Calendar, DollarSign, Trash2, Pencil,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── types ──────────────────────────────────────────────────── */

interface EtapaDin {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

interface Opportunity {
  id: string;
  student_id: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  origem: string;
  etapa: string;
  valor_estimado: number | null;
  data_entrada: string | null;
  data_prevista: string | null;
  responsavel_nome: string | null;
  observacoes: string | null;
  motivo_perda: string | null;
  nivel_interesse: string | null;
  created_at: string;
}

/* ── helpers ────────────────────────────────────────────────── */

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
  etapa: string;
  nivel_interesse: string;
  valor_estimado: string;
  data_prevista: string;
  responsavel_nome: string;
  observacoes: string;
  motivo_perda: string;
}

const emptyForm: OppForm = {
  nome: "", email: "", telefone: "", origem: "", etapa: "",
  nivel_interesse: "", valor_estimado: "", data_prevista: "",
  responsavel_nome: "", observacoes: "", motivo_perda: "",
};

function OppModal({
  opp,
  defaultEtapa,
  origens,
  motivos,
  niveis,
  etapasDin,
  onSave,
  onClose,
}: {
  opp: Opportunity | null;
  defaultEtapa: string;
  origens: { nome: string }[];
  motivos: { nome: string }[];
  niveis: { nome: string; cor: string | null }[];
  etapasDin: EtapaDin[];
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
          nivel_interesse:  opp.nivel_interesse ?? "",
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
                <option value="">Selecione...</option>
                {origens.map(o => <option key={o.nome} value={o.nome}>{o.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Etapa</label>
              <select value={form.etapa} onChange={e => set("etapa", e.target.value)} className={inputClass}>
                <option value="">Selecione...</option>
                {etapasDin.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nível de interesse</label>
            <select value={form.nivel_interesse} onChange={e => set("nivel_interesse", e.target.value)} className={inputClass}>
              <option value="">Selecione...</option>
              {niveis.map(n => <option key={n.nome} value={n.nome}>{n.nome}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Valor estimado (R$)</label>
              <CurrencyInput value={form.valor_estimado} onChange={v => set("valor_estimado", v)} placeholder="0,00" className={inputClass} />
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

          {form.etapa === "Perdido" && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Motivo da perda</label>
              <select value={form.motivo_perda} onChange={e => set("motivo_perda", e.target.value)} className={inputClass}>
                <option value="">Selecione o motivo...</option>
                {motivos.map(m => <option key={m.nome} value={m.nome}>{m.nome}</option>)}
              </select>
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
  onClickCard,
}: {
  opp: Opportunity;
  etapas: EtapaDin[];
  onEdit: (o: Opportunity) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, etapa: string) => void;
  onDragStart: (id: string) => void;
  onClickCard: (opp: Opportunity) => void;
}) {
  const currentIdx = etapas.findIndex(e => e.nome === opp.etapa);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < etapas.length - 1;
  const didDrag = useRef(false);

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = "move"; didDrag.current = true; onDragStart(opp.id); }}
      onDragEnd={() => { setTimeout(() => { didDrag.current = false; }, 0); }}
      onClick={() => { if (!didDrag.current) onClickCard(opp); }}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 group cursor-grab active:cursor-grabbing active:opacity-60 active:shadow-md transition-opacity"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-sm font-bold text-gray-800 leading-snug">{opp.nome}</p>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onEdit(opp); }} className="p-1 rounded hover:bg-gray-100" title="Editar">
            <Pencil className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(opp.id); }} className="p-1 rounded hover:bg-red-50 text-red-400" title="Excluir">
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
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
          {opp.origem || "—"}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={!canPrev}
            onClick={e => { e.stopPropagation(); canPrev && onMove(opp.id, etapas[currentIdx - 1].nome); }}
            className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20"
            title="Mover para etapa anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <button
            disabled={!canNext}
            onClick={e => { e.stopPropagation(); canNext && onMove(opp.id, etapas[currentIdx + 1].nome); }}
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
  const navigate = useNavigate();
  const [opps, setOpps]           = useState<Opportunity[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<false | null | Opportunity>(false);
  const [modalEtapa, setModalEtapa] = useState<string>("");
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [dragId, setDragId]       = useState<string | null>(null);
  const [dragOver, setDragOver]   = useState<string | null>(null);

  const [origens, setOrigens]     = useState<{ nome: string }[]>([]);
  const [motivos, setMotivos]     = useState<{ nome: string }[]>([]);
  const [niveis, setNiveis]       = useState<{ nome: string; cor: string | null }[]>([]);
  const [etapasDin, setEtapasDin] = useState<EtapaDin[]>([]);

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

  async function loadConfigs() {
    if (!user?.contractorId) return;
    const cid = user.contractorId;

    const [{ data: orig }, { data: mot }, { data: niv }] = await Promise.all([
      supabase.from("crm_config").select("nome")
        .eq("contractor_id", cid).eq("categoria", "como_conheceu").eq("ativo", true).order("ordem"),
      supabase.from("crm_config").select("nome")
        .eq("contractor_id", cid).eq("categoria", "motivo_perda").eq("ativo", true).order("ordem"),
      supabase.from("crm_config").select("nome, cor")
        .eq("contractor_id", cid).eq("categoria", "nivel_interesse_oportunidade").eq("ativo", true).order("ordem"),
    ]);

    setOrigens((orig ?? []) as { nome: string }[]);
    setMotivos((mot ?? []) as { nome: string }[]);
    setNiveis((niv ?? []) as { nome: string; cor: string | null }[]);

    const { data: funil } = await supabase
      .from("crm_funis")
      .select("id")
      .eq("contractor_id", cid)
      .eq("padrao", true)
      .single();

    if (funil) {
      const { data: etps } = await supabase
        .from("crm_funil_etapas")
        .select("id, nome, cor, ordem")
        .eq("funil_id", funil.id)
        .order("ordem");
      const etapasCarregadas = (etps ?? []) as EtapaDin[];
      setEtapasDin(etapasCarregadas);
      if (etapasCarregadas.length > 0) {
        setModalEtapa(etapasCarregadas[0].nome);
      }
    }
  }

  useEffect(() => { load(); loadConfigs(); }, [user]);

  async function handleSave(form: OppForm) {
    if (!user) return;
    const payload = {
      contractor_id:    user.contractorId!,
      nome:             form.nome.trim(),
      email:            form.email.trim() || null,
      telefone:         form.telefone.trim() || null,
      origem:           form.origem,
      etapa:            form.etapa,
      nivel_interesse:  form.nivel_interesse.trim() || null,
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

  async function handleMove(id: string, etapa: string) {
    await supabase
      .from("opportunities")
      .update({ etapa, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (etapa === "Matrícula") {
      const opp = opps.find(o => o.id === id);
      if (opp?.student_id) {
        await supabase.from("students").update({ status: "ativo" }).eq("id", opp.student_id);
      }
    }

    setOpps(prev => prev.map(o => o.id === id ? { ...o, etapa } : o));
  }

  function handleClickCard(opp: Opportunity) {
    if (opp.student_id) {
      navigate(`/app/crm/leads/${opp.student_id}`);
    } else {
      setModal(opp);
    }
  }

  function openNew(etapa: string) {
    setModalEtapa(etapa);
    setModal(null);
  }

  const byEtapa = (etapa: string) => opps.filter(o => o.etapa === etapa);

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
            </div>
          </div>
          <button
            onClick={() => openNew(etapasDin[0]?.nome ?? "")}
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
            {etapasDin.map(etapa => {
              const cards = byEtapa(etapa.nome);
              const etapaValor = cards.reduce((s, o) => s + (o.valor_estimado ?? 0), 0);
              const isOver = dragOver === etapa.nome && dragId !== null;
              const bgLight = `${etapa.cor}18`;
              const bgMid   = `${etapa.cor}28`;
              const border  = `${etapa.cor}50`;
              return (
                <div
                  key={etapa.id}
                  className="flex flex-col flex-shrink-0 w-72 rounded-2xl transition-colors"
                  style={{ backgroundColor: isOver ? bgMid : "#f9fafb" }}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(etapa.nome); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOver(null);
                    if (dragId) {
                      const opp = opps.find(o => o.id === dragId);
                      if (opp && opp.etapa !== etapa.nome) handleMove(dragId, etapa.nome);
                      setDragId(null);
                    }
                  }}
                >
                  {/* Column header */}
                  <div
                    className="px-4 py-3 rounded-t-2xl border-b"
                    style={{ backgroundColor: bgLight, borderColor: border }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">{etapa.nome}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/70 text-gray-700">
                          {cards.length}
                        </span>
                        <button
                          onClick={() => openNew(etapa.nome)}
                          className="p-0.5 rounded hover:bg-white/50 text-gray-600"
                          title="Adicionar"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {etapaValor > 0 && (
                      <p className="text-xs mt-0.5 font-semibold text-gray-600">
                        {fmtMoney(etapaValor)}
                      </p>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[80px]">
                    {cards.length === 0 ? (
                      <div
                        className="text-center py-8 rounded-xl border-2 border-dashed transition-colors"
                        style={isOver ? { borderColor: border, backgroundColor: bgLight } : {}}
                      >
                        <p
                          className="text-xs transition-colors"
                          style={isOver ? { color: etapa.cor } : { color: "#d1d5db" }}
                        >
                          {isOver ? "Soltar aqui" : "Nenhuma oportunidade"}
                        </p>
                      </div>
                    ) : (
                      cards.map(opp => (
                        <OppCard
                          key={opp.id}
                          opp={opp}
                          etapas={etapasDin}
                          onEdit={o => setModal(o)}
                          onDelete={id => setDeleteId(id)}
                          onMove={handleMove}
                          onDragStart={id => setDragId(id)}
                          onClickCard={handleClickCard}
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
          origens={origens}
          motivos={motivos}
          niveis={niveis}
          etapasDin={etapasDin}
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
