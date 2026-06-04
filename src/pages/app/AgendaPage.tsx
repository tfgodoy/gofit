import { useMemo, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Filter, Search, Trash2, Users, Clock, MapPin } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import SlotDetailModal, { type SlotInfo } from "@/components/app/SlotDetailModal";

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function fmtWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const s = start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const e = end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  return `${s} - ${e}`;
}

function timeToMinutes(value: string) {
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function fmtHour(minutes: number) {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

interface SlotRow extends SlotInfo {
  grid_id: string | null;
}

interface BookingStats {
  active: number;
  present: number;
  waitlist: number;
}

interface PositionedSlot {
  slot: SlotRow;
  column: number;
  columns: number;
}

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
const HOUR_HEIGHT = 144;
const DEFAULT_START = 6 * 60;
const DEFAULT_END = 22 * 60;

export default function AgendaPage() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [bkStats, setBkStats] = useState<Record<string, BookingStats>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SlotInfo | null>(null);
  const [cancelDay, setCancelDay] = useState<string | null>(null);
  const [cancelingDay, setCancelingDay] = useState(false);
  const [query, setQuery] = useState("");
  const [modalidadeFilter, setModalidadeFilter] = useState("todos");
  const [staffFilter, setStaffFilter] = useState("todos");
  const [unitFilter, setUnitFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("ativos");

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = isoDate(new Date());

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);

    const from = isoDate(weekStart);
    const to = isoDate(weekDays[6]);

    const { data: slotData } = await supabase
      .from("schedule_slots")
      .select("*")
      .eq("contractor_id", user.contractorId)
      .gte("data", from)
      .lte("data", to)
      .order("hora_inicio");

    const arr = (slotData ?? []) as SlotRow[];
    setSlots(arr);

    if (arr.length > 0) {
      const { data: bkData } = await supabase
        .from("bookings")
        .select("slot_id, status")
        .in("slot_id", arr.map(s => s.id));

      const stats: Record<string, BookingStats> = {};
      for (const b of (bkData ?? []) as { slot_id: string; status: string }[]) {
        const current = stats[b.slot_id] ?? { active: 0, present: 0, waitlist: 0 };
        if (b.status === "lista_espera") current.waitlist += 1;
        else if (b.status !== "cancelado") current.active += 1;
        if (b.status === "presente") current.present += 1;
        stats[b.slot_id] = current;
      }
      setBkStats(stats);
    } else {
      setBkStats({});
    }

    setLoading(false);
  }

  useEffect(() => { load(); }, [user, weekStart]);

  const options = useMemo(() => {
    const by = (getter: (slot: SlotRow) => string | null | undefined) =>
      [...new Set(slots.map(getter).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "pt-BR"));

    return {
      modalidades: by(s => s.modalidade_nome),
      staffs: by(s => s.staff_nome),
      units: by(s => s.unit_nome),
    };
  }, [slots]);

  const filteredSlots = useMemo(() => {
    const term = query.trim().toLowerCase();
    return slots.filter(slot => {
      const stats = bkStats[slot.id] ?? { active: 0, present: 0, waitlist: 0 };
      const matchesQuery = !term || [
        slot.modalidade_nome,
        slot.staff_nome,
        slot.unit_nome,
        slot.hora_inicio,
        slot.hora_fim,
      ].some(value => (value ?? "").toLowerCase().includes(term));
      const matchesMod = modalidadeFilter === "todos" || slot.modalidade_nome === modalidadeFilter;
      const matchesStaff = staffFilter === "todos" || slot.staff_nome === staffFilter;
      const matchesUnit = unitFilter === "todos" || slot.unit_nome === unitFilter;
      const matchesStatus =
        statusFilter === "todos" ||
        (statusFilter === "ativos" && slot.status !== "cancelado") ||
        (statusFilter === "cancelado" && slot.status === "cancelado") ||
        (statusFilter === "lotado" && slot.status !== "cancelado" && stats.active >= slot.capacidade_maxima);

      return matchesQuery && matchesMod && matchesStaff && matchesUnit && matchesStatus;
    });
  }, [slots, bkStats, query, modalidadeFilter, staffFilter, unitFilter, statusFilter]);

  const timeRange = useMemo(() => {
    if (filteredSlots.length === 0) return { start: DEFAULT_START, end: DEFAULT_END };

    const min = Math.min(...filteredSlots.map(s => timeToMinutes(s.hora_inicio)));
    const max = Math.max(...filteredSlots.map(s => timeToMinutes(s.hora_fim)));
    return {
      start: Math.max(0, Math.floor(Math.min(min, DEFAULT_START) / 60) * 60),
      end: Math.min(24 * 60, Math.ceil(Math.max(max, DEFAULT_END) / 60) * 60),
    };
  }, [filteredSlots]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let m = timeRange.start; m <= timeRange.end; m += 60) list.push(m);
    return list;
  }, [timeRange]);

  const timelineHeight = ((timeRange.end - timeRange.start) / 60) * HOUR_HEIGHT;

  async function handleCancelDay() {
    if (!cancelDay || !user?.contractorId) return;
    setCancelingDay(true);
    const daySlots = slots.filter(s => s.data === cancelDay && s.status !== "cancelado");
    const daySlotIds = daySlots.map(s => s.id);
    if (daySlotIds.length > 0) {
      await supabase.from("schedule_slots").update({ status: "cancelado" })
        .in("id", daySlotIds);
      await supabase.from("schedule_slot_history").insert(daySlots.map(s => ({
        contractor_id: user.contractorId!,
        slot_id: s.id,
        evento: "aula_cancelada",
        descricao: "Aula cancelada pelo cancelamento do dia.",
        dados: {
          origem: "cancelamento_dia",
          data: cancelDay,
          status_anterior: s.status,
          status_novo: "cancelado",
        },
        criado_por: user.email ?? user.name ?? "sistema",
      })));
    }
    toast.success(`${daySlotIds.length} aula(s) cancelada(s).`);
    setCancelingDay(false);
    setCancelDay(null);
    load();
  }

  function slotsByDay(iso: string) {
    return filteredSlots
      .filter(s => s.data === iso)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  }

  function positionDaySlots(daySlots: SlotRow[]): PositionedSlot[] {
    const sorted = [...daySlots].sort((a, b) =>
      a.hora_inicio.localeCompare(b.hora_inicio) || a.hora_fim.localeCompare(b.hora_fim)
    );
    const positioned: PositionedSlot[] = [];
    const openColumns: { column: number; end: number }[] = [];

    for (const slot of sorted) {
      const start = timeToMinutes(slot.hora_inicio);
      const end = Math.max(timeToMinutes(slot.hora_fim), start + 30);

      for (let i = openColumns.length - 1; i >= 0; i--) {
        if (openColumns[i].end <= start) openColumns.splice(i, 1);
      }

      let column = 0;
      while (openColumns.some(item => item.column === column)) column += 1;
      openColumns.push({ column, end });

      positioned.push({ slot, column, columns: 1 });
    }

    for (const item of positioned) {
      const itemStart = timeToMinutes(item.slot.hora_inicio);
      const itemEnd = Math.max(timeToMinutes(item.slot.hora_fim), itemStart + 30);
      item.columns = Math.max(
        1,
        ...positioned
          .filter(other => {
            const otherStart = timeToMinutes(other.slot.hora_inicio);
            const otherEnd = Math.max(timeToMinutes(other.slot.hora_fim), otherStart + 30);
            return itemStart < otherEnd && otherStart < itemEnd;
          })
          .map(other => other.column + 1)
      );
    }

    return positioned;
  }

  function ocupacaoCls(count: number, max: number) {
    const pct = max > 0 ? count / max : 0;
    if (pct >= 1) return "bg-red-600 text-white";
    if (pct >= 0.8) return "bg-orange-500 text-black";
    return "bg-white/70 text-black";
  }

  function resetFilters() {
    setQuery("");
    setModalidadeFilter("todos");
    setStaffFilter("todos");
    setUnitFilter("todos");
    setStatusFilter("ativos");
  }

  const totalAulas = filteredSlots.length;
  const totalReservados = filteredSlots.reduce((sum, slot) => sum + (bkStats[slot.id]?.active ?? 0), 0);
  const totalLotadas = filteredSlots.filter(slot => (bkStats[slot.id]?.active ?? 0) >= slot.capacidade_maxima && slot.status !== "cancelado").length;
  const totalFila = filteredSlots.reduce((sum, slot) => sum + (bkStats[slot.id]?.waitlist ?? 0), 0);

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full bg-gray-50">
          <div className="bg-white border-b border-gray-100 px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-bold text-gray-900">Agenda</h1>

              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => setWeekStart(w => getWeekStart(addDays(w, -7)))}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Semana anterior"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <span className="text-sm font-semibold text-gray-700 min-w-[190px] text-center">
                  {fmtWeekRange(weekStart)}
                </span>
                <button
                  onClick={() => setWeekStart(w => getWeekStart(addDays(w, 7)))}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Proxima semana"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={() => setWeekStart(getWeekStart(new Date()))}
                  className="ml-2 px-3 py-1.5 text-xs font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
                >
                  Hoje
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="rounded-lg border border-gray-100 px-3 py-2">
                <p className="text-xs text-gray-400">Aulas</p>
                <p className="text-lg font-bold text-gray-900">{totalAulas}</p>
              </div>
              <div className="rounded-lg border border-gray-100 px-3 py-2">
                <p className="text-xs text-gray-400">Reservas</p>
                <p className="text-lg font-bold text-gray-900">{totalReservados}</p>
              </div>
              <div className="rounded-lg border border-gray-100 px-3 py-2">
                <p className="text-xs text-gray-400">Lotadas</p>
                <p className="text-lg font-bold text-red-600">{totalLotadas}</p>
              </div>
              <div className="rounded-lg border border-gray-100 px-3 py-2">
                <p className="text-xs text-gray-400">Fila</p>
                <p className="text-lg font-bold text-yellow-600">{totalFila}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar horários, aula, professor ou local"
                  className="w-full h-9 rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                />
              </div>

              <select value={modalidadeFilter} onChange={e => setModalidadeFilter(e.target.value)} className="h-9 rounded-lg border border-gray-200 px-3 text-sm bg-white">
                <option value="todos">Todas modalidades</option>
                {options.modalidades.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} className="h-9 rounded-lg border border-gray-200 px-3 text-sm bg-white">
                <option value="todos">Todos professores</option>
                {options.staffs.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)} className="h-9 rounded-lg border border-gray-200 px-3 text-sm bg-white">
                <option value="todos">Todos locais</option>
                {options.units.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 rounded-lg border border-gray-200 px-3 text-sm bg-white">
                <option value="ativos">Somente ativas</option>
                <option value="todos">Todas</option>
                <option value="lotado">Lotadas</option>
                <option value="cancelado">Canceladas</option>
              </select>
              <button onClick={resetFilters} className="h-9 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                <Filter className="w-4 h-4" /> Limpar
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="min-w-[1180px] bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[64px_repeat(7,minmax(150px,1fr))] border-b border-gray-200 sticky top-0 z-20 bg-white">
                  <div className="px-3 py-3 text-xs font-bold text-gray-400 border-r border-gray-100">Hora</div>
                  {weekDays.map((day, i) => {
                    const iso = isoDate(day);
                    const isToday = iso === today;
                    const daySlots = slotsByDay(iso);
                    return (
                      <div key={iso} className={`px-3 py-2 border-r border-gray-100 last:border-r-0 relative group ${isToday ? "bg-primary/5" : ""}`}>
                        <div className="flex items-center gap-2">
                          <div>
                            <p className={`text-xs font-bold uppercase ${isToday ? "text-primary" : "text-gray-400"}`}>{DAY_LABELS[i]}</p>
                            <p className="text-xl font-bold text-gray-900">{day.getDate()}</p>
                          </div>
                          <span className="ml-auto text-xs font-semibold text-gray-400">{daySlots.length} aulas</span>
                          {daySlots.length > 0 && (
                            <button
                              onClick={() => setCancelDay(iso)}
                              title="Cancelar todas as aulas do dia"
                              className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-[64px_repeat(7,minmax(150px,1fr))]">
                  <div className="relative border-r border-gray-100 bg-gray-50" style={{ height: timelineHeight }}>
                    {hours.map(hour => (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 border-t border-gray-200 px-2 pt-1 text-[11px] font-semibold text-gray-400"
                        style={{ top: ((hour - timeRange.start) / 60) * HOUR_HEIGHT }}
                      >
                        {fmtHour(hour)}
                      </div>
                    ))}
                  </div>

                  {weekDays.map(day => {
                    const iso = isoDate(day);
                    const isToday = iso === today;
                    const daySlots = slotsByDay(iso);
                    const positionedSlots = positionDaySlots(daySlots);

                    return (
                      <div key={iso} className={`relative border-r border-gray-100 last:border-r-0 ${isToday ? "bg-primary/[0.03]" : "bg-white"}`} style={{ height: timelineHeight }}>
                        {hours.map(hour => (
                          <div
                            key={hour}
                            className="absolute left-0 right-0 border-t border-gray-100"
                            style={{ top: ((hour - timeRange.start) / 60) * HOUR_HEIGHT }}
                          />
                        ))}

                        {daySlots.length === 0 && (
                          <div className="absolute inset-x-3 top-4 rounded-lg border border-dashed border-gray-200 py-3 text-center text-xs text-gray-300">
                            sem aulas
                          </div>
                        )}

                        {positionedSlots.map(({ slot, column, columns }) => {
                          const stats = bkStats[slot.id] ?? { active: 0, present: 0, waitlist: 0 };
                          const start = timeToMinutes(slot.hora_inicio);
                          const end = Math.max(timeToMinutes(slot.hora_fim), start + 30);
                          const top = ((start - timeRange.start) / 60) * HOUR_HEIGHT + 6;
                          const height = Math.max(108, ((end - start) / 60) * HOUR_HEIGHT - 12);
                          const isCanceled = slot.status === "cancelado";
                          const isFull = !isCanceled && stats.active >= slot.capacidade_maxima;
                          const gap = 6;
                          const width = `calc((100% - ${(columns + 1) * gap}px) / ${columns})`;
                          const left = `calc(${column} * ((100% - ${(columns + 1) * gap}px) / ${columns}) + ${(column + 1) * gap}px)`;

                          return (
                            <button
                              key={slot.id}
                              onClick={() => setSelected(slot)}
                              className={`absolute text-left rounded-md border shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                                isCanceled ? "border-gray-300 opacity-60" : "border-black/10"
                              }`}
                              style={{
                                top,
                                left,
                                width,
                                height,
                                backgroundColor: isCanceled ? "#e5e7eb" : slot.cor,
                              }}
                            >
                              <div className="h-full min-h-0 p-2.5 overflow-hidden text-black font-bold">
                                <div className="flex items-start gap-1">
                                  <p className="text-[11px] leading-tight truncate flex-1">
                                    {slot.hora_inicio.slice(0, 5)} - {slot.hora_fim.slice(0, 5)}
                                  </p>
                                  {isFull && <span className="text-[10px] bg-red-600 text-white rounded px-1">LOTADO</span>}
                                </div>
                                <p className="mt-0.5 text-xs truncate">{slot.modalidade_nome ?? "Aula"}</p>
                                {slot.staff_nome && (
                                  <p className="mt-0.5 text-[11px] truncate flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {slot.staff_nome}
                                  </p>
                                )}
                                {slot.unit_nome && height >= 64 && (
                                  <p className="mt-0.5 text-[11px] truncate flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {slot.unit_nome}
                                  </p>
                                )}
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] ${ocupacaoCls(stats.active, slot.capacidade_maxima)}`}>
                                    <Users className="w-3 h-3" /> {stats.active}/{slot.capacidade_maxima}
                                  </span>
                                  {stats.present > 0 && <span className="text-[11px]">{stats.present} pres.</span>}
                                  {stats.waitlist > 0 && <span className="text-[11px]">{stats.waitlist} fila</span>}
                                  {isCanceled && <span className="text-[11px]">cancelada</span>}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </AppLayout>

      {selected && (
        <SlotDetailModal
          slot={selected}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}

      {cancelDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Cancelar todas as aulas do dia?</h3>
            <p className="text-sm text-gray-500 mb-1">
              {new Date(cancelDay + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </p>
            <p className="text-sm text-gray-400 mb-6">
              {slots.filter(s => s.data === cancelDay && s.status !== "cancelado").length} aula(s) serão canceladas.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCancelDay(null)} className="text-primary font-semibold text-sm hover:underline px-2">
                VOLTAR
              </button>
              <button
                onClick={handleCancelDay}
                disabled={cancelingDay}
                className="bg-red-500 text-white font-semibold text-sm px-4 py-2 rounded-md hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {cancelingDay ? "Cancelando..." : "CANCELAR TODAS"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
