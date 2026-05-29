import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ChevronDown, Plus } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ── types ─────────────────────────────────────────────── */

interface Wod {
  id:         string;
  descricao:  string;
  modalidade: string;
  data:       string;
}

/* ── constants ──────────────────────────────────────────── */

type ViewType = "Mês" | "Semana" | "Dia";

const MONTHS_PT  = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS_LONG  = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"];
const DAYS_SHORT = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

const MODALIDADE_COLOR: Record<string, string> = {
  "+Cross":    "#e91e8c",
  "Funcional": "#f97316",
  "Musculação":"#8b5cf6",
  "Yoga":      "#22c55e",
  "Pilates":   "#3b82f6",
  "Aeróbico":  "#06b6d4",
};

/* ── helpers ────────────────────────────────────────────── */

function monIdx(d: Date)            { return (d.getDay() + 6) % 7; }
function getMonday(d: Date): Date   { const x = new Date(d); x.setDate(x.getDate() - monIdx(x)); x.setHours(0,0,0,0); return x; }
function addDays(d: Date, n: number){ const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a: Date, b: Date)  { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function pad2(n: number)            { return String(n).padStart(2,"0"); }
function isoDate(d: Date)           { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }

/* ── WOD block ──────────────────────────────────────────── */

function WodBlock({ wod, onClick }: { wod: Wod; onClick: () => void }) {
  const bg = MODALIDADE_COLOR[wod.modalidade] ?? "#e91e8c";
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      className="w-full rounded text-white text-[11px] font-bold px-1.5 py-1.5 text-left truncate transition-opacity hover:opacity-90 mt-1"
      style={{ background: bg, border: `1px solid ${bg}cc` }}
      title={wod.descricao || wod.modalidade}
    >
      {wod.descricao || wod.modalidade}
    </button>
  );
}

/* ── Month view ─────────────────────────────────────────── */

function MonthView({ grid, current, today, wods, onDayClick, onWodClick }: {
  grid:       Date[][];
  current:    Date;
  today:      Date;
  wods:       Wod[];
  onDayClick: (d: Date) => void;
  onWodClick: (id: string) => void;
}) {
  const byDate = useMemo(() => {
    const map: Record<string, Wod[]> = {};
    for (const w of wods) {
      if (!map[w.data]) map[w.data] = [];
      map[w.data].push(w);
    }
    return map;
  }, [wods]);

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-gray-200">
        {DAYS_LONG.map(d => (
          <div key={d} className="py-2.5 text-center text-xs font-semibold text-gray-500 border-r border-gray-100 last:border-r-0">{d}</div>
        ))}
      </div>
      {grid.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0" style={{ minHeight: 110 }}>
          {week.map((day, di) => {
            const inMonth = day.getMonth() === current.getMonth();
            const isToday = sameDay(day, today);
            const key     = isoDate(day);
            const dayWods = byDate[key] ?? [];
            return (
              <div
                key={di}
                onClick={() => onDayClick(day)}
                className={`border-r border-gray-100 last:border-r-0 p-1.5 cursor-pointer hover:bg-gray-50 transition-colors ${!inMonth ? "bg-gray-50/60" : ""}`}
              >
                <div className="flex justify-end mb-1">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                    isToday ? "bg-primary text-white font-bold" : inMonth ? "text-gray-700" : "text-gray-300"
                  }`}>
                    {day.getDate()}
                  </span>
                </div>
                {dayWods.slice(0, 2).map(w => (
                  <WodBlock key={w.id} wod={w} onClick={() => onWodClick(w.id)} />
                ))}
                {dayWods.length > 2 && (
                  <p className="text-[10px] text-gray-400 mt-0.5 pl-1">+{dayWods.length - 2} mais</p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ── Week view ──────────────────────────────────────────── */

function WeekView({ days, today, wods, onDayClick, onWodClick }: {
  days:       Date[];
  today:      Date;
  wods:       Wod[];
  onDayClick: (d: Date) => void;
  onWodClick: (id: string) => void;
}) {
  const byDate = useMemo(() => {
    const map: Record<string, Wod[]> = {};
    for (const w of wods) {
      if (!map[w.data]) map[w.data] = [];
      map[w.data].push(w);
    }
    return map;
  }, [wods]);

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-gray-200">
        {days.map((day, i) => {
          const isToday = sameDay(day, today);
          return (
            <div key={i} className={`border-r border-gray-100 last:border-r-0 py-3 px-2 text-center ${isToday ? "bg-primary/5" : ""}`}>
              <span className={`text-xs font-bold ${isToday ? "text-primary" : "text-gray-600"}`}>
                {DAYS_SHORT[i]} {pad2(day.getDate())}/{pad2(day.getMonth()+1)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-7" style={{ minHeight: 500 }}>
        {days.map((day, i) => {
          const isToday = sameDay(day, today);
          const key     = isoDate(day);
          const dayWods = byDate[key] ?? [];
          return (
            <div
              key={i}
              onClick={() => onDayClick(day)}
              className={`border-r border-gray-100 last:border-r-0 p-2 cursor-pointer hover:bg-gray-50 transition-colors ${isToday ? "bg-primary/5" : ""}`}
            >
              {dayWods.map(w => (
                <WodBlock key={w.id} wod={w} onClick={() => onWodClick(w.id)} />
              ))}
              {dayWods.length === 0 && (
                <div className="flex justify-center pt-4">
                  <Plus className="w-4 h-4 text-gray-200" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Day view ───────────────────────────────────────────── */

function DayView({ date, today, wods, onAdd, onWodClick }: {
  date:       Date;
  today:      Date;
  wods:       Wod[];
  onAdd:      () => void;
  onWodClick: (id: string) => void;
}) {
  const isToday = sameDay(date, today);
  const dayWods = wods.filter(w => w.data === isoDate(date));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <p className={`text-sm font-bold ${isToday ? "text-primary" : "text-gray-700"}`}>
          {DAYS_LONG[monIdx(date)]}, {pad2(date.getDate())} de {MONTHS_PT[date.getMonth()]} de {date.getFullYear()}
        </p>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
        >
          <Plus className="w-3.5 h-3.5" /> Novo WOD
        </button>
      </div>

      {dayWods.length > 0 ? (
        <div className="space-y-3 max-w-md">
          {dayWods.map(w => {
            const bg = MODALIDADE_COLOR[w.modalidade] ?? "#e91e8c";
            return (
              <button
                key={w.id}
                onClick={() => onWodClick(w.id)}
                className="w-full text-left rounded-xl text-white px-4 py-3 transition-opacity hover:opacity-90"
                style={{ background: bg }}
              >
                <p className="font-bold text-sm">{w.modalidade}</p>
                {w.descricao && <p className="text-xs opacity-80 mt-0.5">{w.descricao}</p>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-3xl">🏋️</div>
          <p className="text-sm text-gray-400">Nenhum WOD programado para este dia</p>
          <button onClick={onAdd} className="text-xs text-primary font-semibold hover:underline mt-1">+ Adicionar WOD</button>
        </div>
      )}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────── */

export default function WodPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [view,     setView]     = useState<ViewType>("Semana");
  const [showDrop, setShowDrop] = useState(false);
  const [current,  setCurrent]  = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [wods,     setWods]     = useState<Wod[]>([]);
  const today    = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const dropRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  /* ── Load WODs for visible range ── */
  const loadWods = useCallback(async () => {
    if (!user?.contractorId) return;
    let from: Date, to: Date;
    if (view === "Semana") {
      from = getMonday(current);
      to   = addDays(from, 6);
    } else if (view === "Mês") {
      from = new Date(current.getFullYear(), current.getMonth(), 1);
      to   = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    } else {
      from = current;
      to   = current;
    }
    const { data } = await supabase
      .from("wods")
      .select("id, descricao, modalidade, data")
      .eq("contractor_id", user.contractorId!)
      .gte("data", isoDate(from))
      .lte("data", isoDate(to))
      .order("data");
    setWods((data ?? []) as Wod[]);
  }, [user, view, current]);

  useEffect(() => { loadWods(); }, [loadWods]);

  const monthGrid = useMemo<Date[][]>(() => {
    const first  = new Date(current.getFullYear(), current.getMonth(), 1);
    const start  = getMonday(first);
    let cursor   = new Date(start);
    return Array.from({ length: 6 }, () =>
      Array.from({ length: 7 }, () => { const d = new Date(cursor); cursor = addDays(cursor, 1); return d; })
    );
  }, [current]);

  const weekDays = useMemo<Date[]>(() => {
    const mon = getMonday(current);
    return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  }, [current]);

  function nav(dir: -1 | 1) {
    setCurrent(prev => {
      const d = new Date(prev);
      if      (view === "Mês")    d.setMonth(d.getMonth() + dir);
      else if (view === "Semana") d.setDate(d.getDate() + dir * 7);
      else                        d.setDate(d.getDate() + dir);
      return d;
    });
  }

  function handleDayClick(day: Date) {
    navigate(`/app/wod/novo?data=${isoDate(day)}`);
  }

  function handleWodClick(id: string) {
    navigate(`/app/wod/${id}`);
  }

  const heading =
    view === "Dia"
      ? `${pad2(current.getDate())} de ${MONTHS_PT[current.getMonth()]} de ${current.getFullYear()}`
      : `${MONTHS_PT[current.getMonth()]}, ${current.getFullYear()}`;

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen bg-gray-50">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-2">
          <button onClick={() => nav(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrent(new Date())}
            className="text-xs font-bold text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            HOJE
          </button>
          <button onClick={() => nav(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="text-base font-bold text-gray-800 ml-1 flex-1">{heading}</span>

          <button
            onClick={() => navigate(`/app/wod/novo?data=${isoDate(today)}`)}
            className="flex items-center gap-1.5 text-xs font-bold text-primary border border-primary px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors mr-2"
          >
            <Plus className="w-3.5 h-3.5" /> NOVO WOD
          </button>

          <div ref={dropRef} className="relative flex flex-col items-start">
            <span className="text-[10px] text-gray-400 font-medium leading-none mb-0.5 ml-0.5">Visualização</span>
            <button
              onClick={() => setShowDrop(v => !v)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 min-w-[110px] justify-between hover:bg-gray-50 transition-colors"
            >
              {view}
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showDrop ? "rotate-180" : ""}`} />
            </button>
            {showDrop && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-30 overflow-hidden min-w-[130px]">
                {(["Mês","Semana","Dia"] as ViewType[]).map(v => (
                  <button
                    key={v}
                    onClick={() => { setView(v); setShowDrop(false); }}
                    className={`w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors ${
                      view === v ? "text-primary font-semibold bg-primary/5" : "text-gray-700"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Calendar body */}
        <div className="flex-1 bg-white">
          {view === "Mês" && (
            <MonthView
              grid={monthGrid} current={current} today={today} wods={wods}
              onDayClick={handleDayClick} onWodClick={handleWodClick}
            />
          )}
          {view === "Semana" && (
            <WeekView
              days={weekDays} today={today} wods={wods}
              onDayClick={handleDayClick} onWodClick={handleWodClick}
            />
          )}
          {view === "Dia" && (
            <DayView
              date={current} today={today} wods={wods}
              onAdd={() => handleDayClick(current)} onWodClick={handleWodClick}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
