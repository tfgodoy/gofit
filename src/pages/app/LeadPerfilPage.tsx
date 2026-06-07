import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, Phone, Mail, MessageSquare, StickyNote,
  Plus, Clock, User, ShoppingCart,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ── Types ──────────────────────────────────────────────────── */

interface Lead {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  sexo: "masculino" | "feminino" | "outro" | null;
  objetivo: string | null;
  observacoes: string | null;
  created_at: string;
}

interface Opportunity {
  id: string;
  etapa: string;
  created_at: string;
}

interface Activity {
  id: string;
  tipo: string;
  descricao: string | null;
  data_atividade: string | null;
  responsavel_nome: string | null;
  created_at: string;
}

type TabType = "atividade" | "nota";

/* ── Helpers ─────────────────────────────────────────────────── */

const INP = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition";

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return "";
  const today = new Date();
  const birth = new Date(birthDate + "T00:00:00");
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} anos`;
}

const ETAPA_STYLE: Record<string, string> = {
  "Novo lead":        "bg-blue-100 text-blue-700",
  "Visita agendada":  "bg-purple-100 text-purple-700",
  "Proposta enviada": "bg-orange-100 text-orange-700",
  "Matrícula":        "bg-green-100 text-green-700",
  "Perdido":          "bg-red-100 text-red-700",
};

/* ── Page ───────────────────────────────────────────────────── */

export default function LeadPerfilPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lead, setLead] = useState<Lead | null>(null);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>("atividade");

  // Atividade form
  const [tipoAtividade, setTipoAtividade] = useState("");
  const [descAtividade, setDescAtividade] = useState("");
  const [dataAtividade, setDataAtividade] = useState(new Date().toISOString().slice(0, 16));
  const [tiposAtividade, setTiposAtividade] = useState<string[]>([]);
  const [savingAtividade, setSavingAtividade] = useState(false);

  // Nota form
  const [nota, setNota] = useState("");
  const [savingNota, setSavingNota] = useState(false);

  async function load() {
    if (!user?.contractorId || !id) return;
    const [{ data: leadData }, { data: oppsData }, { data: actData }, { data: tiposData }] = await Promise.all([
      supabase.from("students").select("*").eq("id", id).eq("contractor_id", user.contractorId!).maybeSingle(),
      supabase.from("opportunities").select("id, etapa, created_at").eq("student_id", id).order("created_at", { ascending: false }),
      supabase.from("activities").select("id, tipo, descricao, data_atividade, responsavel_nome, created_at").eq("student_id", id).order("created_at", { ascending: false }),
      supabase.from("crm_config").select("nome").eq("contractor_id", user.contractorId!).eq("categoria", "tipo_atividade").eq("ativo", true).order("ordem"),
    ]);
    setLead(leadData as Lead | null);
    setOpps((oppsData ?? []) as Opportunity[]);
    setActivities((actData ?? []) as Activity[]);
    setTiposAtividade((tiposData ?? []).map((t: { nome: string }) => t.nome));
    setLoading(false);
  }

  useEffect(() => { load(); }, [user, id]);

  async function handleAddAtividade() {
    if (!user?.contractorId || !id || !tipoAtividade) { toast.error("Informe o tipo de atividade"); return; }
    setSavingAtividade(true);
    const { error } = await supabase.from("activities").insert({
      contractor_id: user.contractorId,
      student_id: id,
      tipo: tipoAtividade,
      descricao: descAtividade.trim() || null,
      data_atividade: dataAtividade ? new Date(dataAtividade).toISOString() : null,
      responsavel_nome: user.name ?? null,
      status: "concluida",
    });
    setSavingAtividade(false);
    if (error) { toast.error("Erro ao adicionar atividade"); return; }
    toast.success("Atividade registrada!");
    setTipoAtividade(""); setDescAtividade(""); setDataAtividade(new Date().toISOString().slice(0, 16));
    load();
  }

  async function handleAddNota() {
    if (!nota.trim()) return;
    setSavingNota(true);
    const { error } = await supabase.from("activities").insert({
      contractor_id: user!.contractorId,
      student_id: id,
      tipo: "nota",
      descricao: nota.trim(),
      data_atividade: new Date().toISOString(),
      responsavel_nome: user!.name ?? null,
      status: "concluida",
    });
    setSavingNota(false);
    if (error) { toast.error("Erro ao salvar nota"); return; }
    toast.success("Nota adicionada!");
    setNota("");
    load();
  }

  async function handleConverterEmCliente() {
    if (!id) return;
    const { error } = await supabase.from("students").update({ status: "ativo" }).eq("id", id);
    if (error) { toast.error("Erro ao converter lead"); return; }
    toast.success("Lead convertido em cliente!");
    navigate(`/app/clientes/${id}/dashboard`);
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!lead) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20 text-gray-400 text-sm">Lead não encontrado.</div>
      </AppLayout>
    );
  }

  const phone = (lead.telefone ?? "").replace(/\D/g, "");
  const age = calcAge(lead.data_nascimento);

  return (
    <AppLayout>
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/app/crm/leads")} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate">{lead.nome_completo}</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Lead</span>
                {age && <span className="text-xs text-gray-500">{age}</span>}
                {lead.sexo && <span className="text-xs text-gray-500 capitalize">{lead.sexo}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {phone && (
                <button
                  onClick={() => window.open(`https://wa.me/55${phone}`, "_blank")}
                  className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 text-sm font-semibold rounded-lg hover:bg-green-50 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  WHATSAPP
                </button>
              )}
              <button
                onClick={() => navigate(`/app/clientes/${id}/cadastro`)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                CADASTRO
              </button>
              <button
                onClick={handleConverterEmCliente}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                REALIZAR VENDA
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-gray-50">
          <div className="px-8 py-6 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left col — Atividade / Nota */}
              <div className="lg:col-span-2 space-y-4">

                {/* Tabs */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex border-b border-gray-100">
                    {([
                      { key: "atividade", label: "Atividade", Icon: Clock },
                      { key: "nota",      label: "Nota",      Icon: StickyNote },
                    ] as const).map(({ key, label, Icon }) => (
                      <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                          tab === key
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="p-5 space-y-4">
                    {tab === "atividade" ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo de atividade *</label>
                            <select value={tipoAtividade} onChange={e => setTipoAtividade(e.target.value)} className={INP}>
                              <option value="">Selecione...</option>
                              {tiposAtividade.map(t => <option key={t} value={t}>{t}</option>)}
                              <option value="Ligação">Ligação</option>
                              <option value="WhatsApp">WhatsApp</option>
                              <option value="E-mail">E-mail</option>
                              <option value="Reunião">Reunião</option>
                              <option value="Visita">Visita</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Data / Hora</label>
                            <input type="datetime-local" value={dataAtividade} onChange={e => setDataAtividade(e.target.value)} className={INP} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição</label>
                          <textarea value={descAtividade} onChange={e => setDescAtividade(e.target.value)} rows={3} placeholder="Descreva o que foi feito..." className={INP + " resize-none"} />
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={handleAddAtividade}
                            disabled={savingAtividade || !tipoAtividade}
                            className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
                          >
                            {savingAtividade ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            ADICIONAR
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <textarea value={nota} onChange={e => setNota(e.target.value)} rows={4} placeholder="Digite uma nota sobre este lead..." className={INP + " resize-none"} />
                        <div className="flex justify-end">
                          <button
                            onClick={handleAddNota}
                            disabled={savingNota || !nota.trim()}
                            className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
                          >
                            {savingNota ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            SALVAR NOTA
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-4">Linha do tempo</h3>
                  {activities.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Nenhuma atividade registrada.</p>
                  )}
                  <div className="space-y-4">
                    {/* Criação */}
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        {activities.length > 0 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                      </div>
                      <div className="pb-4 flex-1">
                        <p className="text-sm font-semibold text-gray-800">Criação do cadastro do lead</p>
                        <p className="text-xs text-gray-400 mt-0.5">{fmtDateTime(lead.created_at)}</p>
                      </div>
                    </div>
                    {/* Activities */}
                    {activities.map((act, idx) => (
                      <div key={act.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            {act.tipo === "nota"
                              ? <StickyNote className="w-3.5 h-3.5 text-gray-500" />
                              : <Clock className="w-3.5 h-3.5 text-gray-500" />
                            }
                          </div>
                          {idx < activities.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                        </div>
                        <div className="pb-4 flex-1">
                          <p className="text-sm font-semibold text-gray-800">{act.tipo}</p>
                          {act.descricao && <p className="text-xs text-gray-600 mt-0.5">{act.descricao}</p>}
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs text-gray-400">{fmtDateTime(act.data_atividade ?? act.created_at)}</p>
                            {act.responsavel_nome && (
                              <p className="text-xs text-gray-400">· {act.responsavel_nome}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right col */}
              <div className="space-y-4">

                {/* Contato */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                  <h3 className="text-sm font-bold text-gray-700">Contato</h3>
                  {lead.telefone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{lead.telefone}</span>
                    </div>
                  ) : null}
                  {lead.email ? (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{lead.email}</span>
                    </div>
                  ) : null}
                  {!lead.telefone && !lead.email && (
                    <p className="text-sm text-gray-400">Nenhum contato informado.</p>
                  )}
                </div>

                {/* Oportunidades */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                  <h3 className="text-sm font-bold text-gray-700">Oportunidades abertas</h3>
                  {opps.length === 0 ? (
                    <p className="text-sm text-gray-400">Nenhuma oportunidade.</p>
                  ) : (
                    <div className="space-y-2">
                      {opps.map(op => (
                        <div key={op.id} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">{lead.nome_completo}</span>
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ETAPA_STYLE[op.etapa] ?? "bg-gray-100 text-gray-600"}`}>
                            {op.etapa}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Observações */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-2">Observações</h3>
                  <p className="text-sm text-gray-500">
                    {lead.observacoes ?? "Sem observação informada."}
                  </p>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
