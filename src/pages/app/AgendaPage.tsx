import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SlotDetailModal, { type SlotInfo } from "@/components/app/SlotDetailModal";

// ─── date helpers ────────────────────────────────────────────────────────────

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day  = date.getDay();
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
  const s   = start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const e   = end.toLocaleDateString("pt-BR",   { day: "2-digit", month: "short", year: "numeric" });
  return `${s} – ${e}`;
}

// ─── types ────────────────────────────────────────────────────────────────────

interface SlotRow extends SlotInfo {
  grid_id: string | null;
}

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// ─── component ────────────────────────────────────────────────────────────────

export default function AgendaPage() {
  const { user }  = useAuth();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [slots, setSlots]         = useState<SlotRow[]>([]);
  const [bkCounts, setBkCounts]   = useState<Record<string, number>>({});
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<SlotInfo | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today    = isoDate(new Date());

  async function load() {
    if (!user?.contractorId) return;
    setLoading(true);

    const from = isoDate(weekStart);
    const to   = isoDate(weekDays[6]);

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
        .select("slot_id")
        .in("slot_id", arr.map(s => s.id))
        .neq("status", "cancelado");

      const counts: Record<string, number> = {};
      for (const b of (bkData ?? []) as { slot_id: string }[])
        counts[b.slot_id] = (counts[b.slot_id] ?? 0) + 1;
      setBkCounts(counts);
    } else {
      setBkCounts({});
    }

    setLoading(false);
  }

  useEffect(() => { load(); }, [user, weekStart]);

  function slotsByDay(iso: string) {
    return slots.filter(s => s.data === iso);
  }

  function ocupacaoCls(count: number, max: number) {
    const pct = max > 0 ? count / max : 0;
    if (pct >= 1)   return "bg-red-50 text-red-600";
    if (pct >= 0.8) return "bg-orange-50 text-orange-500";
    return "bg-green-50 text-green-600";
  }

  return (
    <>
      <AppLayout>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-8 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-gray-900">Agenda</h1>

              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => setWeekStart(w => getWeekStart(addDays(w, -7)))}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <span className="text-sm font-semibold text-gray-700 min-w-[200px] text-center">
                  {fmtWeekRange(weekStart)}
                </span>
                <button
                  onClick={() => setWeekStart(w => getWeekStart(addDays(w, 7)))}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
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
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-auto bg-gray-50 p-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2 min-w-[840px]">
                {weekDays.map((day, i) => {
                  const iso       = isoDate(day);
                  const isToday   = iso === today;
                  const daySlots  = slotsByDay(iso);

                  return (
                    <div key={iso}>
                      {/* Day header */}
                      <div className={`text-center py-2 mb-2 rounded-xl ${isToday ? "bg-primary/10" : ""}`}>
                        <p className={`text-xs font-bold uppercase tracking-wide ${isToday ? "text-primary" : "text-gray-400"}`}>
                          {DAY_LABELS[i]}
                        </p>
                        <p className={`text-2xl font-bold leading-tight ${isToday ? "text-primary" : "text-gray-800"}`}>
                          {day.getDate()}
                        </p>
                      </div>

                      {/* Slot cards */}
                      <div className="space-y-2">
                        {daySlots.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-gray-200 py-4 text-center">
                            <p className="text-xs text-gray-300">sem aulas</p>
                          </div>
                        ) : daySlots.map(slot => {
                          const count      = bkCounts[slot.id] ?? 0;
                          const isCanceled = slot.status === "cancelado";

                          return (
                            <button
                              key={slot.id}
                              onClick={() => setSelected(slot)}
                              className={`w-full text-left rounded-xl border transition-all hover:shadow-md ${
                                isCanceled
                                  ? "bg-gray-50 border-gray-100 opacity-50"
                                  : "bg-white border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <div className="flex overflow-hidden rounded-xl">
                                <div
                                  className="w-1.5 flex-shrink-0"
                                  style={{ backgroundColor: isCanceled ? "#d1d5db" : slot.cor }}
                                />
                                <div className="p-2 flex-1 min-w-0">
                                  <p className="text-xs font-bold text-gray-900 truncate leading-tight">
                                    {slot.modalidade_nome ?? "Aula"}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {slot.hora_inicio.slice(0, 5)}–{slot.hora_fim.slice(0, 5)}
                                  </p>
                                  {slot.staff_nome && (
                                    <p className="text-xs text-gray-400 truncate mt-0.5">{slot.staff_nome}</p>
                                  )}
                                  <div className={`mt-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold ${ocupacaoCls(count, slot.capacidade_maxima)}`}>
                                    {count}/{slot.capacidade_maxima}
                                  </div>
                                  {isCanceled && (
                                    <span className="ml-1.5 text-xs text-red-400 font-medium">cancelada</span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
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
    </>
  );
}
