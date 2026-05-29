import { useState, useEffect, useRef } from "react";
import { X, Search, CheckCircle2, XCircle, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SlotInfo {
  id:                string;
  modalidade_nome:   string | null;
  staff_nome:        string | null;
  data:              string;
  hora_inicio:       string;
  hora_fim:          string;
  capacidade_maxima: number;
  cor:               string;
  status:            string;
}

interface Booking {
  id:           string;
  student_id:   string | null;
  student_nome: string | null;
  status:       string;
  checkin_em:   string | null;
}

interface Student { id: string; nome_completo: string }

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  reservado:    { label: "Reservado",       cls: "bg-blue-100 text-blue-700" },
  presente:     { label: "Presente",        cls: "bg-green-100 text-green-700" },
  faltou:       { label: "Faltou",          cls: "bg-red-100 text-red-600" },
  cancelado:    { label: "Cancelado",       cls: "bg-gray-100 text-gray-500" },
  lista_espera: { label: "Lista de espera", cls: "bg-yellow-100 text-yellow-700" },
};

function fmtDataLong(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });
}

interface Props {
  slot:      SlotInfo;
  onClose:   () => void;
  onChanged: () => void;
}

export default function SlotDetailModal({ slot, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [loading, setLoading]       = useState(true);
  const [students, setStudents]     = useState<Student[]>([]);
  const [showAdd, setShowAdd]       = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [dropOpen, setDropOpen]     = useState(false);
  const [selected, setSelected]     = useState<Student | null>(null);
  const [adding, setAdding]         = useState(false);
  const [cancelingSlot, setCancelingSlot] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  async function loadBookings() {
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("slot_id", slot.id)
      .neq("status", "cancelado")
      .order("created_at");
    setBookings((data ?? []) as Booking[]);
    setLoading(false);
  }

  useEffect(() => { loadBookings(); }, [slot.id]);

  useEffect(() => {
    if (!user?.contractorId) return;
    supabase.from("students")
      .select("id, nome_completo")
      .eq("contractor_id", user.contractorId)
      .order("nome_completo")
      .then(({ data }) => setStudents((data ?? []) as Student[]));
  }, [user]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setDropOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleMarkStatus(bookingId: string, status: "presente" | "faltou") {
    const update = status === "presente"
      ? { status, checkin_em: new Date().toISOString() }
      : { status };
    const { error } = await supabase.from("bookings").update(update).eq("id", bookingId);
    if (error) { toast.error("Erro ao atualizar."); return; }
    toast.success(status === "presente" ? "Presença confirmada." : "Falta registrada.");
    loadBookings();
    onChanged();
  }

  async function handleUndoStatus(bookingId: string) {
    await supabase.from("bookings").update({ status: "reservado", checkin_em: null }).eq("id", bookingId);
    loadBookings();
    onChanged();
  }

  async function handleAddBooking() {
    if (!user?.contractorId || !selected) { toast.error("Selecione um aluno."); return; }

    const activeCount = bookings.length;
    const status      = activeCount >= slot.capacidade_maxima ? "lista_espera" : "reservado";

    setAdding(true);
    const { error } = await supabase.from("bookings").insert({
      contractor_id: user.contractorId!,
      slot_id:       slot.id,
      student_id:    selected.id,
      student_nome:  selected.nome_completo,
      status,
    });
    setAdding(false);

    if (error) {
      if (error.code === "23505") toast.error("Aluno já está nesta aula.");
      else toast.error("Erro ao adicionar aluno.");
      return;
    }
    toast.success(status === "lista_espera" ? "Aluno adicionado na lista de espera." : "Aluno adicionado.");
    setSelected(null);
    setStudentSearch("");
    setShowAdd(false);
    loadBookings();
    onChanged();
  }

  async function handleCancelSlot() {
    await supabase.from("schedule_slots").update({ status: "cancelado" }).eq("id", slot.id);
    toast.success("Aula cancelada.");
    setCancelingSlot(false);
    onClose();
    onChanged();
  }

  const filteredStudents = studentSearch
    ? students.filter(s => s.nome_completo.toLowerCase().includes(studentSearch.toLowerCase()))
    : students;

  const presentCount = bookings.filter(b => b.status === "presente").length;
  const isCanceled   = slot.status === "cancelado";

  function initials(name: string | null) {
    return (name ?? "?").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-gray-100">
          <div
            className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
            style={{ backgroundColor: slot.cor }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{slot.modalidade_nome ?? "Aula"}</p>
            <p className="text-sm text-gray-500">
              {fmtDataLong(slot.data)} · {slot.hora_inicio.slice(0, 5)}–{slot.hora_fim.slice(0, 5)}
            </p>
            {slot.staff_nome && <p className="text-xs text-gray-400 mt-0.5">{slot.staff_nome}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-5 px-6 py-2.5 bg-gray-50 border-b border-gray-100 text-sm">
          <span className="text-gray-600">
            <span className="font-bold text-gray-900">{bookings.length}</span>
            <span className="text-gray-400">/{slot.capacidade_maxima}</span>
            {" "}reservados
          </span>
          <span className="text-gray-600">
            <span className="font-bold text-green-600">{presentCount}</span> presentes
          </span>
          {isCanceled && (
            <span className="ml-auto text-xs font-semibold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
              Cancelada
            </span>
          )}
        </div>

        {/* Bookings list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-1">
              <p className="text-sm text-gray-400">Nenhum aluno reservado ainda.</p>
            </div>
          ) : bookings.map(b => {
            const badge    = STATUS_BADGE[b.status] ?? STATUS_BADGE.reservado;
            const canMark  = b.status === "reservado" || b.status === "lista_espera";
            const hasMark  = b.status === "presente" || b.status === "faltou";
            return (
              <div key={b.id} className="flex items-center gap-3 px-6 py-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                  {initials(b.student_nome)}
                </div>
                <p className="flex-1 text-sm font-medium text-gray-900 truncate">
                  {b.student_nome ?? "—"}
                </p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
                  {badge.label}
                </span>
                {!isCanceled && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {canMark && (
                      <>
                        <button
                          onClick={() => handleMarkStatus(b.id, "presente")}
                          title="Marcar presente"
                          className="p-1 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMarkStatus(b.id, "faltou")}
                          title="Marcar falta"
                          className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {hasMark && (
                      <button
                        onClick={() => handleUndoStatus(b.id)}
                        title="Desfazer"
                        className="text-xs text-gray-400 hover:text-primary hover:underline px-1"
                      >
                        desfazer
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add student / cancel slot */}
        {!isCanceled && (
          <div className="px-6 py-3 border-t border-gray-100">
            {showAdd ? (
              <div ref={searchRef} className="relative">
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
                  <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Buscar aluno..."
                    value={selected ? selected.nome_completo : studentSearch}
                    onChange={e => { setStudentSearch(e.target.value); setSelected(null); setDropOpen(true); }}
                    onClick={() => setDropOpen(true)}
                    className="flex-1 text-sm text-gray-900 outline-none bg-transparent"
                  />
                  {selected && (
                    <button
                      onClick={() => { setSelected(null); setStudentSearch(""); }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {dropOpen && !selected && (
                  <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                    {filteredStudents.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-gray-400">Nenhum aluno encontrado</p>
                    ) : filteredStudents.slice(0, 20).map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setSelected(s); setStudentSearch(""); setDropOpen(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                      >
                        {s.nome_completo}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => { setShowAdd(false); setSelected(null); setStudentSearch(""); }}
                    className="text-primary text-sm font-semibold hover:underline"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddBooking}
                    disabled={!selected || adding}
                    className="ml-auto bg-primary text-white text-sm font-semibold px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {adding ? "Adicionando..." : "Adicionar"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  <UserPlus className="w-4 h-4" /> Adicionar aluno
                </button>
                <button
                  onClick={() => setCancelingSlot(true)}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Cancelar aula
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cancel slot confirmation */}
      {cancelingSlot && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Cancelar esta aula?</h3>
            <p className="text-sm text-gray-500 mb-6">
              As reservas serão mantidas no histórico mas a aula ficará marcada como cancelada.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCancelingSlot(false)} className="text-primary font-semibold text-sm hover:underline px-2">
                VOLTAR
              </button>
              <button
                onClick={handleCancelSlot}
                className="bg-red-500 text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
              >
                CANCELAR AULA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
