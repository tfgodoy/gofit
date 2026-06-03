import { useState, useEffect, useRef } from "react";
import { X, Search, CheckCircle2, XCircle, UserPlus, Users, ClipboardCheck, ClipboardX, ExternalLink, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SlotInfo {
  id:                         string;
  grid_id:                    string | null;
  modalidade_nome:            string | null;
  staff_nome:                 string | null;
  unit_nome?:                 string | null;
  duracao_minutos?:           number | null;
  data:                       string;
  hora_inicio:                string;
  hora_fim:                   string;
  capacidade_maxima:          number;
  cor:                        string;
  status:                     string;
}

interface GridPerms {
  permite_leads:              boolean;
  permite_clientes_especiais: boolean;
  fila_espera_ativa:          boolean;
  max_leads?:                 number | null;
  max_clientes_especiais?:    number | null;
}

interface GridComissao {
  comissionar_instrutor:       boolean;
  tipo_comissao:               string | null;
  valor_comissao_centavos:     number | null;
  staff_nome:                  string | null;
}

interface Booking {
  id:                   string;
  student_id:           string | null;
  student_nome:         string | null;
  lead_id:              string | null;
  lead_nome:            string | null;
  tipo:                 string;
  status:               string;
  checkin_em:           string | null;
  anamnese_resposta_id: string | null;
}

interface AnamneseInfo {
  id:           string;
  status:       string;
  respondido_at: string | null;
  token:        string;
}

interface Student { id: string; nome_completo: string }
interface Lead    { id: string; nome: string; telefone: string | null }

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  reservado:    { label: "Reservado",        cls: "bg-blue-100 text-blue-700"   },
  presente:     { label: "Presente",         cls: "bg-green-100 text-green-700" },
  faltou:       { label: "Faltou",           cls: "bg-red-100 text-red-600"     },
  cancelado:    { label: "Cancelado",        cls: "bg-gray-100 text-gray-500"   },
  concluido:    { label: "Concluída",        cls: "bg-green-100 text-green-700" },
  lista_espera: { label: "Fila de espera",   cls: "bg-yellow-100 text-yellow-700" },
};

function fmtDataLong(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });
}

function diffMinutes(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : null;
}

interface Props {
  slot:      SlotInfo;
  onClose:   () => void;
  onChanged: () => void;
}

type AddMode = "aluno" | "lead" | null;

export default function SlotDetailModal({ slot, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [anamneseMap, setAnamneseMap] = useState<Record<string, AnamneseInfo>>({});
  const [loading, setLoading]         = useState(true);
  const [students, setStudents]       = useState<Student[]>([]);
  const [leads,    setLeads]          = useState<Lead[]>([]);
  const [perms,    setPerms]          = useState<GridPerms | null>(null);
  const [gridComissao, setGridComissao] = useState<GridComissao | null>(null);
  const [addMode,  setAddMode]        = useState<AddMode>(null);
  const [search,   setSearch]         = useState("");
  const [dropOpen, setDropOpen]       = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedLead,    setSelectedLead]    = useState<Lead    | null>(null);
  const [adding,          setAdding]          = useState(false);
  const [cancelingSlot,   setCancelingSlot]   = useState(false);
  const [finalizando,     setFinalizando]     = useState(false);
  const [confirmarFinalizar, setConfirmarFinalizar] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  async function loadBookings() {
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("id, student_id, student_nome, lead_id, lead_nome, tipo, status, checkin_em, anamnese_resposta_id")
      .eq("slot_id", slot.id).neq("status", "cancelado").order("created_at");
    const bks = (data ?? []) as Booking[];
    setBookings(bks);

    // Carrega status das anamneses vinculadas aos bookings experimentais
    const anamIds = bks
      .filter(b => b.tipo === "experimental" && b.anamnese_resposta_id)
      .map(b => b.anamnese_resposta_id!);
    if (anamIds.length > 0) {
      const { data: aData } = await supabase
        .from("anamnese_respostas")
        .select("id, status, respondido_at, token")
        .in("id", anamIds);
      const map: Record<string, AnamneseInfo> = {};
      for (const a of (aData ?? []) as AnamneseInfo[]) map[a.id] = a;
      setAnamneseMap(map);
    } else {
      setAnamneseMap({});
    }

    setLoading(false);
  }

  useEffect(() => { loadBookings(); }, [slot.id]);

  useEffect(() => {
    if (!user?.contractorId) return;
    supabase.from("students").select("id, nome_completo")
      .eq("contractor_id", user.contractorId).order("nome_completo")
      .then(({ data }) => setStudents((data ?? []) as Student[]));

    if (slot.grid_id) {
      supabase.from("schedule_grids")
        .select("permite_leads, permite_clientes_especiais, fila_espera_ativa, max_leads, max_clientes_especiais, comissionar_instrutor, tipo_comissao, valor_comissao_centavos, staff_nome")
        .eq("id", slot.grid_id).single()
        .then(({ data }) => {
          setPerms(data as GridPerms | null);
          setGridComissao(data as GridComissao | null);
        });
    }
  }, [user, slot.grid_id]);

  useEffect(() => {
    if (!user?.contractorId || addMode !== "lead") return;
    supabase.from("opportunities").select("id, nome, telefone")
      .eq("contractor_id", user.contractorId).not("etapa", "eq", "perdido").order("nome")
      .then(({ data }) => setLeads((data ?? []) as Lead[]));
  }, [user, addMode]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function resetAdd() {
    setAddMode(null); setSearch(""); setDropOpen(false);
    setSelectedStudent(null); setSelectedLead(null);
  }

  async function handleMarkStatus(bookingId: string, status: "presente" | "faltou") {
    const update = status === "presente"
      ? { status, checkin_em: new Date().toISOString() }
      : { status };
    const { error } = await supabase.from("bookings").update(update).eq("id", bookingId);
    if (error) { toast.error("Erro ao atualizar."); return; }
    toast.success(status === "presente" ? "Presença confirmada." : "Falta registrada.");
    loadBookings(); onChanged();
  }

  async function handleUndoStatus(bookingId: string) {
    await supabase.from("bookings").update({ status: "reservado", checkin_em: null }).eq("id", bookingId);
    loadBookings(); onChanged();
  }

  async function handleAddBooking() {
    if (!user?.contractorId) return;
    const activeCount = bookings.filter(b => b.status !== "lista_espera").length;
    const useFila = perms?.fila_espera_ativa && activeCount >= slot.capacidade_maxima;
    const status = useFila ? "lista_espera" : "reservado";

    setAdding(true);
    let insertPayload: Record<string, unknown>;

    if (addMode === "aluno" && selectedStudent) {
      if (perms?.max_clientes_especiais) {
        const countEspeciais = bookings.filter(b => b.tipo === "especial" && b.status !== "cancelado").length;
        if (countEspeciais >= perms.max_clientes_especiais) {
          toast.error(`Limite atingido: máximo de ${perms.max_clientes_especiais} clientes especiais.`);
          setAdding(false);
          return;
        }
      }

      insertPayload = {
        contractor_id: user.contractorId!,
        slot_id:       slot.id,
        student_id:    selectedStudent.id,
        student_nome:  selectedStudent.nome_completo,
        tipo:          "aluno",
        status,
      };
    } else if (addMode === "lead" && selectedLead) {
      if (perms?.max_leads) {
        const countLeads = bookings.filter(b => b.tipo === "lead" && b.status !== "cancelado").length;
        if (countLeads >= perms.max_leads) {
          toast.error(`Limite atingido: máximo de ${perms.max_leads} leads nesta aula.`);
          setAdding(false);
          return;
        }
      }

      insertPayload = {
        contractor_id: user.contractorId!,
        slot_id:       slot.id,
        lead_id:       selectedLead.id,
        lead_nome:     selectedLead.nome,
        tipo:          "lead",
        status,
      };
    } else {
      toast.error("Selecione um aluno ou lead."); setAdding(false); return;
    }

    const { error } = await supabase.from("bookings").insert(insertPayload as any);
    setAdding(false);
    if (error) {
      if (error.code === "23505") toast.error("Já está nesta aula.");
      else toast.error("Erro ao adicionar.");
      return;
    }
    toast.success(status === "lista_espera" ? "Adicionado na fila de espera." : "Adicionado com sucesso.");
    resetAdd(); loadBookings(); onChanged();
  }

  async function handleCancelSlot() {
    await supabase.from("schedule_slots").update({ status: "cancelado" }).eq("id", slot.id);
    toast.success("Aula cancelada.");
    setCancelingSlot(false); onClose(); onChanged();
  }

  async function handleFinalizarAula() {
    setFinalizando(true);
    try {
      const { error: errSlot } = await supabase
        .from("schedule_slots")
        .update({ status: "concluido" })
        .eq("id", slot.id);

      if (errSlot) {
        toast.error("Erro ao finalizar aula.");
        return;
      }

      const { data: result, error: errComissao } = await supabase
        .rpc("calcular_comissao_aula", { p_slot_id: slot.id });

      if (errComissao) {
        toast.success("Aula finalizada.");
        toast.error("Erro ao calcular comissão: " + errComissao.message);
      } else if (result && typeof result === "object" && "gerou" in result && result.gerou) {
        const valor = typeof result.valor === "number"
          ? result.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "R$ 0,00";
        const instrutor = typeof result.staff_nome === "string" ? result.staff_nome : "instrutor";
        toast.success(`Aula finalizada! Comissão de ${valor} gerada para ${instrutor}.`);
      } else {
        const motivo = result && typeof result === "object" && "motivo" in result && typeof result.motivo === "string"
          ? result.motivo
          : null;
        toast.success(motivo ? `Aula finalizada. ${motivo}.` : "Aula finalizada.");
      }

      setConfirmarFinalizar(false);
      onClose();
      onChanged();
    } finally {
      setFinalizando(false);
    }
  }

  const filteredStudents = search
    ? students.filter(s => s.nome_completo.toLowerCase().includes(search.toLowerCase()))
    : students;
  const filteredLeads = search
    ? leads.filter(l => l.nome.toLowerCase().includes(search.toLowerCase()))
    : leads;

  const presentCount = bookings.filter(b => b.status === "presente").length;
  const isCanceled   = slot.status === "cancelado";
  const isConcluido  = slot.status === "concluido";
  const duration      = slot.duracao_minutos ?? diffMinutes(slot.hora_inicio, slot.hora_fim);
  const leadCount     = bookings.filter(b => b.tipo === "lead" && b.status !== "cancelado").length;
  const podeFinalizarAula = slot.status === "agendado" || slot.status === "em_andamento";

  function initials(name: string | null) {
    return (name ?? "?").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  }

  const canAddLeads = perms?.permite_leads ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: slot.cor }} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{slot.modalidade_nome ?? "Aula"}</p>
            <p className="text-sm text-gray-500">
              {fmtDataLong(slot.data)} · {slot.hora_inicio.slice(0, 5)}–{slot.hora_fim.slice(0, 5)}
              {duration && <span className="text-gray-400 ml-1">({duration} min)</span>}
            </p>
            {slot.unit_nome && (
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" /> {slot.unit_nome}
              </p>
            )}
            {slot.staff_nome && <p className="text-xs text-gray-400 mt-0.5">{slot.staff_nome}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-5 px-6 py-2.5 bg-gray-50 border-b border-gray-100 text-sm flex-shrink-0">
          <span className="text-gray-600">
            <span className="font-bold text-gray-900">{bookings.filter(b => b.status !== "lista_espera").length}</span>
            <span className="text-gray-400">/{slot.capacidade_maxima}</span>
            {" "}reservados
          </span>
          <span className="text-gray-600">
            <span className="font-bold text-green-600">{presentCount}</span> presentes
          </span>
          {bookings.filter(b => b.status === "lista_espera").length > 0 && (
            <span className="text-yellow-600 font-medium text-xs">
              {bookings.filter(b => b.status === "lista_espera").length} na fila
            </span>
          )}
          {perms?.max_leads && (
            <span className="text-orange-600 font-medium text-xs">
              {leadCount}/{perms.max_leads} leads
            </span>
          )}
          {isCanceled && (
            <span className="ml-auto text-xs font-semibold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Cancelada</span>
          )}
          {isConcluido && (
            <span className="ml-auto text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Concluída</span>
          )}
        </div>

        {/* Booking list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-1">
              <p className="text-sm text-gray-400">Nenhum aluno reservado ainda.</p>
            </div>
          ) : (
            <>
              {/* Alunos e leads normais */}
              {bookings.filter(b => b.tipo !== "experimental").map(b => {
                const nome    = b.tipo === "lead" ? (b.lead_nome ?? "Lead") : (b.student_nome ?? "—");
                const badge   = STATUS_BADGE[b.status] ?? STATUS_BADGE.reservado;
                const canMark = !isCanceled && (b.status === "reservado" || b.status === "lista_espera");
                const hasMark = !isCanceled && (b.status === "presente"  || b.status === "faltou");
                return (
                  <div key={b.id} className="flex items-center gap-3 px-6 py-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${b.tipo === "lead" ? "bg-orange-100 text-orange-700" : "bg-primary/10 text-primary"}`}>
                      {initials(nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{nome}</p>
                      {b.tipo === "lead" && <p className="text-xs text-orange-500">Lead</p>}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                    {!isCanceled && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {canMark && (
                          <>
                            <button onClick={() => handleMarkStatus(b.id, "presente")} title="Marcar presente"
                              className="p-1 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleMarkStatus(b.id, "faltou")} title="Marcar falta"
                              className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {hasMark && (
                          <button onClick={() => handleUndoStatus(b.id)}
                            className="text-xs text-gray-400 hover:text-primary hover:underline px-1">
                            desfazer
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

          {/* Bookings experimentais — com status de anamnese */}
          {bookings.filter(b => b.tipo === "experimental").map(b => {
            const nome    = b.lead_nome ?? "Lead";
            const badge   = STATUS_BADGE[b.status] ?? STATUS_BADGE.reservado;
            const canMark = !isCanceled && (b.status === "reservado" || b.status === "lista_espera");
            const hasMark = !isCanceled && (b.status === "presente"  || b.status === "faltou");
            const anam    = b.anamnese_resposta_id ? anamneseMap[b.anamnese_resposta_id] : null;
            const preenchida = !!anam?.respondido_at;
            const anamLink = anam ? `${window.location.origin}/anamnese/${anam.token}` : null;
            return (
              <div key={b.id} className={`flex items-center gap-3 px-6 py-3 ${!preenchida ? "bg-red-50/40" : ""}`}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-orange-100 text-orange-700">
                  {initials(nome)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{nome}</p>
                  <p className="text-xs text-orange-500">Aula experimental</p>
                </div>

                {/* Badge anamnese */}
                {anam ? (
                  preenchida ? (
                    <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0">
                      <ClipboardCheck className="w-3 h-3" /> Ficha OK
                    </span>
                  ) : (
                    anamLink ? (
                      <a href={anamLink} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 flex-shrink-0 hover:bg-red-200 transition-colors"
                        title="Abrir ficha de saúde">
                        <ClipboardX className="w-3 h-3" /> Ficha pendente <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 flex-shrink-0">
                        <ClipboardX className="w-3 h-3" /> Ficha pendente
                      </span>
                    )
                  )
                ) : (
                  <span className="text-xs text-gray-400 flex-shrink-0">Sem ficha</span>
                )}

                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
                  {badge.label}
                </span>
                {!isCanceled && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {canMark && (
                      <>
                        <button onClick={() => handleMarkStatus(b.id, "presente")} title="Marcar presente"
                          className="p-1 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleMarkStatus(b.id, "faltou")} title="Marcar falta"
                          className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {hasMark && (
                      <button onClick={() => handleUndoStatus(b.id)}
                        className="text-xs text-gray-400 hover:text-primary hover:underline px-1">
                        desfazer
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
            </>
          )}
        </div>

        {/* Add panel */}
        {!isCanceled && !isConcluido && (
          <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0">
            {addMode ? (
              <div ref={searchRef} className="relative">
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
                  <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input autoFocus type="text"
                    placeholder={addMode === "lead" ? "Buscar lead..." : "Buscar aluno..."}
                    value={(addMode === "aluno" ? selectedStudent?.nome_completo : selectedLead?.nome) ?? search}
                    onChange={e => {
                      setSearch(e.target.value);
                      setSelectedStudent(null); setSelectedLead(null);
                      setDropOpen(true);
                    }}
                    onClick={() => setDropOpen(true)}
                    className="flex-1 text-sm text-gray-900 outline-none bg-transparent"
                  />
                  {(selectedStudent || selectedLead) && (
                    <button onClick={() => { setSelectedStudent(null); setSelectedLead(null); setSearch(""); }}
                      className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                  )}
                </div>

                {dropOpen && !selectedStudent && !selectedLead && (
                  <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                    {addMode === "aluno" && (
                      filteredStudents.length === 0
                        ? <p className="px-3 py-2 text-sm text-gray-400">Nenhum aluno encontrado</p>
                        : filteredStudents.slice(0, 20).map(s => (
                          <button key={s.id} onClick={() => { setSelectedStudent(s); setSearch(""); setDropOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
                            {s.nome_completo}
                          </button>
                        ))
                    )}
                    {addMode === "lead" && (
                      filteredLeads.length === 0
                        ? <p className="px-3 py-2 text-sm text-gray-400">Nenhum lead encontrado</p>
                        : filteredLeads.slice(0, 20).map(l => (
                          <button key={l.id} onClick={() => { setSelectedLead(l); setSearch(""); setDropOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
                            <span>{l.nome}</span>
                            {l.telefone && <span className="ml-2 text-xs text-gray-400">{l.telefone}</span>}
                          </button>
                        ))
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-2">
                  <button onClick={resetAdd} className="text-primary text-sm font-semibold hover:underline">Cancelar</button>
                  <button onClick={handleAddBooking} disabled={(!selectedStudent && !selectedLead) || adding}
                    className="ml-auto bg-primary text-white text-sm font-semibold px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {adding ? "Adicionando..." : "Adicionar"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => setAddMode("aluno")}
                    className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                    <UserPlus className="w-4 h-4" /> Adicionar aluno
                  </button>
                  {canAddLeads && (
                    <button onClick={() => setAddMode("lead")}
                      className="flex items-center gap-1.5 text-sm font-semibold text-orange-500 hover:underline">
                      <Users className="w-4 h-4" /> Adicionar lead
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {podeFinalizarAula && !confirmarFinalizar && (
                    <button
                      onClick={() => setConfirmarFinalizar(true)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-green-600 hover:text-green-700 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Finalizar aula
                    </button>
                  )}
                  {!confirmarFinalizar && (
                    <button onClick={() => setCancelingSlot(true)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                      Cancelar aula
                    </button>
                  )}
                </div>
              </div>
            )}
            {confirmarFinalizar && (
              <div className="flex flex-wrap items-center justify-end gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2 mt-3">
                <span className="text-sm text-green-800 font-medium mr-auto">Confirmar finalização?</span>
                {gridComissao?.comissionar_instrutor && (
                  <span className="text-xs text-green-700">
                    {gridComissao.tipo_comissao === "por_cliente" ? "Comissão por aluno" : "Comissão por aula"}
                  </span>
                )}
                <button
                  onClick={handleFinalizarAula}
                  disabled={finalizando}
                  className="text-sm font-semibold text-white bg-green-600 hover:bg-green-700 px-3 py-1 rounded-lg disabled:opacity-50"
                >
                  {finalizando ? "..." : "Sim"}
                </button>
                <button
                  onClick={() => setConfirmarFinalizar(false)}
                  className="text-sm font-semibold text-gray-600 hover:text-gray-800 px-2 py-1"
                >
                  Não
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {cancelingSlot && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Cancelar esta aula?</h3>
            <p className="text-sm text-gray-500 mb-6">As reservas serão mantidas no histórico mas a aula ficará marcada como cancelada.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCancelingSlot(false)} className="text-primary font-semibold text-sm hover:underline px-2">VOLTAR</button>
              <button onClick={handleCancelSlot} className="bg-red-500 text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-red-600 transition-colors">
                CANCELAR AULA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
