import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";

type ViewType = "Mês" | "Semana" | "Dia";

const MONTHS_PT   = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS_LONG   = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"];
const DAYS_SHORT  = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

function monIdx(d: Date): number { return (d.getDay() + 6) % 7; }

function getMonday(d: Date): Date {
  const date = new Date(d);
  date.setDate(date.getDate() - monIdx(date));
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function pad2(n: number): string { return String(n).padStart(2, "0"); }

export default function WodPage() {
  const [view, setView]             = useState<ViewType>("Mês");
  const [showDrop, setShowDrop]     = useState(false);
  const [current, setCurrent]       = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  });
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const monthGrid = useMemo<Date[][]>(() => {
    const first = new Date(current.getFullYear(), current.getMonth(), 1);
    const start = getMonday(first);
    let cursor  = new Date(start);
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

          {/* View selector */}
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
          {view === "Mês"    && <MonthView  grid={monthGrid} current={current} today={today} />}
          {view === "Semana" && <WeekView   days={weekDays}  today={today} />}
          {view === "Dia"    && <DayView    date={current}   today={today} />}
        </div>
      </div>
    </AppLayout>
  );
}

/* ─── Month view ──────────────────────────────────────── */
function MonthView({ grid, current, today }: { grid: Date[][], current: Date, today: Date }) {
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-gray-200">
        {DAYS_LONG.map(d => (
          <div key={d} className="py-2.5 text-center text-xs font-semibold text-gray-500 border-r border-gray-100 last:border-r-0">
            {d}
          </div>
        ))}
      </div>
      {grid.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0" style={{ minHeight: 110 }}>
          {week.map((day, di) => {
            const inMonth = day.getMonth() === current.getMonth();
            const isToday  = sameDay(day, today);
            return (
              <div
                key={di}
                className={`border-r border-gray-100 last:border-r-0 p-1.5 ${!inMonth ? "bg-gray-50/60" : ""}`}
              >
                <div className="flex justify-end">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                    isToday
                      ? "bg-primary text-white font-bold"
                      : inMonth ? "text-gray-700" : "text-gray-300"
                  }`}>
                    {day.getDate()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ─── Week view ───────────────────────────────────────── */
function WeekView({ days, today }: { days: Date[], today: Date }) {
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-gray-200">
        {days.map((day, i) => {
          const isToday = sameDay(day, today);
          return (
            <div
              key={i}
              className={`border-r border-gray-100 last:border-r-0 py-2.5 text-center ${isToday ? "bg-primary/5" : ""}`}
            >
              <span className={`text-xs font-bold ${isToday ? "text-primary" : "text-gray-600"}`}>
                {DAYS_SHORT[monIdx(day)]} {pad2(day.getDate())}/{pad2(day.getMonth()+1)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7" style={{ minHeight: 500 }}>
        {days.map((day, i) => (
          <div
            key={i}
            className={`border-r border-gray-100 last:border-r-0 p-2 ${sameDay(day, today) ? "bg-primary/5" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Day view ────────────────────────────────────────── */
function DayView({ date, today }: { date: Date, today: Date }) {
  const isToday = sameDay(date, today);
  return (
    <div className="p-8">
      <p className={`text-sm font-bold mb-6 ${isToday ? "text-primary" : "text-gray-700"}`}>
        {DAYS_LONG[monIdx(date)]}, {pad2(date.getDate())} de {MONTHS_PT[date.getMonth()]} de {date.getFullYear()}
      </p>
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-3xl">
          🏋️
        </div>
        <p className="text-sm text-gray-400">Nenhum WOD programado para este dia</p>
        <button className="text-xs text-primary font-semibold hover:underline mt-1">
          + Adicionar WOD
        </button>
      </div>
    </div>
  );
}
