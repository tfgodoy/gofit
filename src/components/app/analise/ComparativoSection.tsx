import { useState } from "react";
import { Calendar, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import { useDadosAnalise, calcularGanhoOculto, fmtBRL, fmtPct, SEMANAS_MES } from "./useDadosAnalise";

interface Props {
  staffId: string;
}

function fmtDateBR(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

function Delta({ a, b, tipo = "brl" }: { a: number; b: number; tipo?: "brl" | "horas" }) {
  if (a === 0 && b === 0) return <span className="text-gray-400 text-xs">—</span>;
  const delta = b - a;
  if (Math.abs(delta) < 0.01) return <span className="text-gray-400 text-xs flex items-center gap-1"><Minus className="w-3 h-3" /> sem alteração</span>;
  const pct = a > 0 ? (delta / a) * 100 : null;
  const pos = delta > 0;
  return (
    <div className={`flex items-center gap-1 text-xs font-semibold ${pos ? "text-emerald-600" : "text-red-600"}`}>
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      <span>{pos ? "+" : ""}{tipo === "brl" ? fmtBRL(delta) : `${delta.toFixed(1)} h`}</span>
      {pct !== null && <span className="font-normal text-gray-400">({pos ? "+" : ""}{pct.toFixed(1)}%)</span>}
    </div>
  );
}

interface RowItem {
  label: string;
  valorA: number;
  valorB: number;
  tipo?: "brl" | "horas";
  destaque?: boolean;
}

function TabelaComparativa({ rows, labelA, labelB }: { rows: RowItem[]; labelA: string; labelB: string }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
            <th className="text-right py-2.5 px-4 text-xs font-semibold text-blue-600 uppercase tracking-wide">{labelA}</th>
            <th className="text-right py-2.5 px-4 text-xs font-semibold text-violet-600 uppercase tracking-wide">{labelB}</th>
            <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Variação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className={row.destaque ? "bg-slate-900 text-white" : "bg-white"}>
              <td className={`py-2.5 px-4 font-medium text-xs ${row.destaque ? "text-white" : "text-gray-700"}`}>{row.label}</td>
              <td className={`py-2.5 px-4 text-right font-semibold text-xs ${row.destaque ? "text-blue-200" : "text-gray-900"}`}>
                {row.valorA === 0 ? "—" : row.tipo === "horas" ? `${row.valorA} h/sem` : fmtBRL(row.valorA)}
              </td>
              <td className={`py-2.5 px-4 text-right font-semibold text-xs ${row.destaque ? "text-violet-200" : "text-gray-900"}`}>
                {row.valorB === 0 ? "—" : row.tipo === "horas" ? `${row.valorB} h/sem` : fmtBRL(row.valorB)}
              </td>
              <td className="py-2.5 px-4 text-right">
                <Delta a={row.valorA} b={row.valorB} tipo={row.tipo} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ComparativoSection({ staffId }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [dataA, setDataA] = useState(today);
  const [dataB, setDataB] = useState("");

  const { data: dadosA, isLoading: loadA } = useDadosAnalise(staffId, dataA);
  const { data: dadosB, isLoading: loadB } = useDadosAnalise(staffId, dataB);

  const salA   = Number(dadosA?.salario?.valor ?? 0);
  const salB   = Number(dadosB?.salario?.valor ?? 0);
  const pasA   = Number(dadosA?.passagem?.valor ?? 0);
  const pasB   = Number(dadosB?.passagem?.valor ?? 0);
  const ajuA   = Number(dadosA?.ajudaCusto?.valor ?? 0);
  const ajuB   = Number(dadosB?.ajudaCusto?.valor ?? 0);
  const bonA   = Number(dadosA?.bonificacao?.valor ?? 0);
  const bonB   = Number(dadosB?.bonificacao?.valor ?? 0);
  const horA   = Number(dadosA?.carga?.horas_semanais ?? 0);
  const horB   = Number(dadosB?.carga?.horas_semanais ?? 0);
  const vhA    = horA > 0 ? salA / (horA * SEMANAS_MES) : 0;
  const vhB    = horB > 0 ? salB / (horB * SEMANAS_MES) : 0;
  const totA   = salA + pasA + ajuA + bonA;
  const totB   = salB + pasB + ajuB + bonB;

  const rows: RowItem[] = [
    { label: "Salário",        valorA: salA, valorB: salB },
    { label: "Passagem",       valorA: pasA, valorB: pasB },
    { label: "Ajuda de custo", valorA: ajuA, valorB: ajuB },
    { label: "Bonificação",    valorA: bonA, valorB: bonB },
    { label: "Carga horária",  valorA: horA, valorB: horB, tipo: "horas" },
    { label: "Valor da hora",  valorA: vhA,  valorB: vhB },
    { label: "Custo total",    valorA: totA, valorB: totB, destaque: true },
  ];

  const ganhoOculto = calcularGanhoOculto({
    salarioAntes: dataA > dataB ? salB : salA,
    salarioAgora:  dataA > dataB ? salA : salB,
    horasAntes:   dataA > dataB ? horB : horA,
    horasAgora:    dataA > dataB ? horA : horB,
  });

  const semData = !dataA || !dataB;

  return (
    <div className="space-y-5">
      {/* Seletores de data */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
          <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-blue-700 mb-1">Data A (referência)</p>
            <input
              type="date" value={dataA} max={today}
              onChange={e => setDataA(e.target.value)}
              className="w-full border border-blue-300 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white"
            />
          </div>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 flex items-center gap-3">
          <Calendar className="w-4 h-4 text-violet-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-violet-700 mb-1">Data B (comparar com)</p>
            <input
              type="date" value={dataB} max={today}
              onChange={e => setDataB(e.target.value)}
              className="w-full border border-violet-300 rounded px-2 py-1 text-sm focus:border-violet-500 outline-none bg-white"
            />
          </div>
        </div>
      </div>

      {semData && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-sm text-gray-500">Selecione as duas datas para gerar o comparativo.</p>
        </div>
      )}

      {!semData && (loadA || loadB) && (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
      )}

      {!semData && !loadA && !loadB && (
        <>
          <TabelaComparativa
            rows={rows}
            labelA={fmtDateBR(dataA)}
            labelB={fmtDateBR(dataB)}
          />

          {/* Bloco Ganho Oculto quando aplicável */}
          {ganhoOculto && ganhoOculto.deltaPct > 0.5 && ganhoOculto.ganhoMensal > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-3">
              <p className="text-sm font-bold text-amber-900">Equivalência — Ganho Oculto</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                A carga reduziu de <strong>{ganhoOculto.horasAntes}h → {ganhoOculto.horasAgora}h/sem</strong> com
                o salário mantido em <strong>{fmtBRL(ganhoOculto.salarioAgora)}</strong>, gerando um aumento
                implícito do valor-hora de <strong>{fmtPct(ganhoOculto.pctVariacaoHora)}</strong>{" "}
                ({fmtBRL(ganhoOculto.valorHoraAntes)} → {fmtBRL(ganhoOculto.valorHoraAgora)}).
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded border border-amber-200 p-3 text-center">
                  <p className="text-[10px] text-amber-600 uppercase font-semibold">Ganho / mês</p>
                  <p className="text-base font-bold text-amber-900 mt-0.5">{fmtBRL(ganhoOculto.ganhoMensal)}</p>
                </div>
                <div className="bg-white rounded border border-amber-200 p-3 text-center">
                  <p className="text-[10px] text-amber-600 uppercase font-semibold">Ganho / ano</p>
                  <p className="text-base font-bold text-amber-900 mt-0.5">{fmtBRL(ganhoOculto.ganhoAnual)}</p>
                </div>
                <div className="bg-white rounded border border-amber-200 p-3 text-center">
                  <p className="text-[10px] text-amber-600 uppercase font-semibold">Aumento implícito</p>
                  <p className="text-base font-bold text-amber-900 mt-0.5">{fmtPct(ganhoOculto.deltaPct)}</p>
                </div>
              </div>
              <p className="text-[10px] text-amber-600 italic">
                Para manter {fmtBRL(ganhoOculto.valorHoraAntes)}/hora com {ganhoOculto.horasAgora}h/sem, o salário
                deveria ser <strong>{fmtBRL(ganhoOculto.salarioEquivalente)}</strong>.
                Os <strong>{fmtBRL(ganhoOculto.ganhoMensal)}/mês</strong> acima disso são o ganho oculto na redução de carga.
              </p>
            </div>
          )}

          {/* Texto de negociação */}
          {(salA > 0 || salB > 0) && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Texto para negociação
              </p>
              <div className="space-y-1.5">
                {salB !== salA && (
                  <div className="text-xs leading-snug px-2.5 py-2 rounded border-l-2 bg-blue-50 border-blue-400 text-blue-900">
                    Salário variou {fmtPct(salA > 0 ? ((salB - salA) / salA) * 100 : 0)} entre as datas
                    ({fmtBRL(salA)} → {fmtBRL(salB)}, diferença de {fmtBRL(salB - salA)}/mês = {fmtBRL((salB - salA) * 12)}/ano).
                  </div>
                )}
                {horB !== horA && (
                  <div className="text-xs leading-snug px-2.5 py-2 rounded border-l-2 bg-violet-50 border-violet-400 text-violet-900">
                    Carga horária {horB > horA ? "aumentou" : "diminuiu"} {Math.abs(horB - horA).toFixed(1)} h/sem
                    ({horA}h → {horB}h), impacto de {fmtPct(horA > 0 ? ((horB - horA) / horA) * 100 : 0)} na disponibilidade.
                  </div>
                )}
                {vhA > 0 && vhB > 0 && (
                  <div className="text-xs leading-snug px-2.5 py-2 rounded border-l-2 bg-emerald-50 border-emerald-400 text-emerald-900">
                    Valor da hora: {fmtBRL(vhA)} → {fmtBRL(vhB)}
                    {" "}({fmtPct(((vhB - vhA) / vhA) * 100)}), reflexo combinado das variações de salário e carga.
                  </div>
                )}
                {totA > 0 && totB > 0 && (
                  <div className="text-xs leading-snug px-2.5 py-2 rounded border-l-2 bg-gray-100 border-gray-400 text-gray-900">
                    Custo total (sem encargos): {fmtBRL(totA)} → {fmtBRL(totB)}{" "}
                    ({fmtPct(totA > 0 ? ((totB - totA) / totA) * 100 : 0)}, diferença de {fmtBRL(totB - totA)}/mês).
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
