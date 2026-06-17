import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDadosAnalise, calcularEncargos, calcularGanhoOculto, type GanhoOculto, fmtBRL, fmtPct, variacao, parseGrade, descricaoGrade } from "./useDadosAnalise";
import {
  Loader2, Calendar, TrendingUp, TrendingDown, DollarSign, Clock, Bus, Gift, HandCoins, Calculator,
  PieChart as PieIcon, BarChart3, AlertCircle, Sparkles,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

interface Props {
  staffId: string;
}

const SEMANAS_MES = 4.33;

const CORES = {
  salario:    "#0f172a",
  passagem:   "#10b981",
  ajuda:      "#f59e0b",
  bonif:      "#8b5cf6",
  encargos:   "#ef4444",
};

export default function ResumoSection({ staffId }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [refDate, setRefDate] = useState(today);

  const { data: dados, isLoading } = useDadosAnalise(staffId, refDate);

  const { data: staffCfg } = useQuery({
    queryKey: ["staff-config", staffId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("staff")
        .select("name, tipo_contrato, incluir_encargos_no_custo, cargo_descricao")
        .eq("id", staffId).single();
      if (error) throw error;
      return data as { name: string; tipo_contrato: string; incluir_encargos_no_custo: boolean; cargo_descricao: string | null };
    },
  });

  const { data: salarioHistorico = [] } = useQuery({
    queryKey: ["staff-salarios-tl", staffId, refDate],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("staff_salarios")
        .select("data_vigencia, valor")
        .eq("staff_id", staffId)
        .lte("data_vigencia", refDate)
        .order("data_vigencia", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { data_vigencia: string; valor: number }[];
    },
  });

  const { data: cargaHistorico = [] } = useQuery({
    queryKey: ["staff-carga-tl", staffId, refDate],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("staff_cargas_horarias")
        .select("data_vigencia, horas_semanais")
        .eq("staff_id", staffId)
        .lte("data_vigencia", refDate)
        .order("data_vigencia", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { data_vigencia: string; horas_semanais: number }[];
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>;
  }

  if (!dados?.salario && !dados?.carga) {
    return (
      <div className="space-y-4">
        <DateSelector refDate={refDate} setRefDate={setRefDate} today={today} />
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Sem dados suficientes</p>
            <p className="text-xs text-amber-700">
              Cadastre pelo menos um salário e uma carga horária nas abas correspondentes para visualizar o resumo financeiro.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const salario  = dados.salario?.valor   ?? 0;
  const passagem = dados.passagem?.valor  ?? 0;
  const ajuda    = dados.ajudaCusto?.valor ?? 0;
  const bonif    = dados.bonificacao?.valor ?? 0;
  const horas    = Number(dados.carga?.horas_semanais ?? 0);

  const encargos = calcularEncargos(salario, staffCfg?.tipo_contrato ?? null);
  const incluirEncargos = staffCfg?.incluir_encargos_no_custo ?? false;
  const valorEncargosNoTotal = incluirEncargos ? encargos.total : 0;

  const custoTotal = salario + passagem + ajuda + bonif + valorEncargosNoTotal;
  const horasMes = horas * SEMANAS_MES;
  const valorHoraSalario = horasMes > 0 ? salario / horasMes : 0;
  const valorHoraTotal   = horasMes > 0 ? custoTotal / horasMes : 0;

  const varSalario  = variacao(dados.salario?.valor,      dados.salarioAnterior?.valor);
  const varPassagem = variacao(dados.passagem?.valor,     dados.passagemAnterior?.valor);
  const varAjuda    = variacao(dados.ajudaCusto?.valor,   dados.ajudaCustoAnterior?.valor);
  const varBonif    = variacao(dados.bonificacao?.valor,  dados.bonificacaoAnterior?.valor);
  const varCarga    = variacao(
    dados.carga ? Number(dados.carga.horas_semanais) : null,
    dados.cargaAnterior ? Number(dados.cargaAnterior.horas_semanais) : null,
  );

  const composicao = [
    { name: "Salário",       value: salario,  color: CORES.salario },
    { name: "Passagem",      value: passagem, color: CORES.passagem },
    { name: "Ajuda de custo", value: ajuda,    color: CORES.ajuda },
    { name: "Bonificação",   value: bonif,    color: CORES.bonif },
    incluirEncargos ? { name: "Encargos", value: encargos.total, color: CORES.encargos } : null,
  ].filter((x): x is { name: string; value: number; color: string } => x !== null && x.value > 0);

  const timelineSalario = salarioHistorico.map(s => ({
    data: s.data_vigencia.slice(0, 7),
    salario: Number(s.valor),
  }));
  const timelineCarga = cargaHistorico.map(c => ({
    data: c.data_vigencia.slice(0, 7),
    horas: Number(c.horas_semanais),
  }));

  return (
    <div className="space-y-5">
      <DateSelector refDate={refDate} setRefDate={setRefDate} today={today} />

      {/* Cabeçalho com nome do colaborador */}
      {staffCfg && (
        <div className="bg-slate-900 text-white rounded-lg p-4">
          <p className="text-xs text-slate-300 uppercase tracking-wider">{staffCfg.cargo_descricao || "Colaborador"}</p>
          <p className="text-xl font-bold">{staffCfg.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Análise em {fmtDateBR(refDate)} · Tipo de contrato: {staffCfg.tipo_contrato ? staffCfg.tipo_contrato.toUpperCase() : "—"}
          </p>
        </div>
      )}

      {/* Cards principais (valor + variação) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <CardValor icone={<DollarSign className="w-4 h-4" />} cor="text-slate-700" titulo="Salário" valor={salario} variacao={varSalario} dataVigencia={dados.salario?.data_vigencia} />
        <CardValor icone={<Bus className="w-4 h-4" />} cor="text-emerald-600" titulo="Passagem" valor={passagem} variacao={varPassagem} dataVigencia={dados.passagem?.data_vigencia} />
        <CardValor icone={<HandCoins className="w-4 h-4" />} cor="text-amber-600" titulo="Ajuda de custo" valor={ajuda} variacao={varAjuda} dataVigencia={dados.ajudaCusto?.data_vigencia} />
        <CardValor icone={<Gift className="w-4 h-4" />} cor="text-violet-600" titulo="Bonificação" valor={bonif} variacao={varBonif} dataVigencia={dados.bonificacao?.data_vigencia} />
        <CardHoras icone={<Clock className="w-4 h-4" />} cor="text-blue-600" titulo="Carga horária"
          horas={horas} variacao={varCarga} dataVigencia={dados.carga?.data_vigencia}
          gradeDesc={descricaoGrade(parseGrade((dados.carga as any)?.grade))} />
        <CardCusto icone={<Calculator className="w-4 h-4" />} titulo="Custo total / mês" valor={custoTotal}
          encargos={incluirEncargos ? encargos.total : null} />
      </div>

      {/* Valor da hora */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500">Valor da hora — somente salário</p>
          <p className="text-2xl font-bold text-gray-900">{fmtBRL(valorHoraSalario)} <span className="text-sm font-normal text-gray-500">/ hora</span></p>
          <p className="text-xs text-gray-400 mt-1">Salário ÷ ({horas}h × 4,33 semanas)</p>
        </div>
        <div className="bg-primary text-white border border-primary rounded-lg p-4">
          <p className="text-xs text-white/80">Valor da hora — custo total</p>
          <p className="text-2xl font-bold">{fmtBRL(valorHoraTotal)} <span className="text-sm font-normal text-white/80">/ hora</span></p>
          <p className="text-xs text-white/70 mt-1">
            Custo total ÷ horas mensais{!incluirEncargos && " (sem encargos)"}
          </p>
        </div>
      </div>

      {/* Ganho Oculto */}
      {(() => {
        const ganho = calcularGanhoOculto({
          salarioAntes: dados.salarioAnterior?.valor,
          salarioAgora: dados.salario?.valor,
          horasAntes: dados.cargaAnterior ? Number(dados.cargaAnterior.horas_semanais) : null,
          horasAgora: dados.carga ? Number(dados.carga.horas_semanais) : null,
        });
        if (!ganho || ganho.deltaPct <= 0.5 || ganho.ganhoMensal <= 0) return null;
        return <BannerGanhoOculto ganho={ganho} />;
      })()}

      {/* Composição do custo + insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-primary" /> Composição do custo
          </h4>
          {composicao.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">Sem dados para compor o custo.</p>
          ) : (
            <div className="flex justify-center">
              <PieChart width={360} height={220}>
                <Pie data={composicao} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                  {composicao.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </div>
          )}
          <div className="space-y-1.5 mt-2">
            {composicao.map((c, i) => {
              const pct = custoTotal > 0 ? (c.value / custoTotal) * 100 : 0;
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.color }}></span>
                    <span className="text-gray-600">{c.name}</span>
                  </div>
                  <span className="font-semibold text-gray-800">{pct.toFixed(1)}% · {fmtBRL(c.value)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Insights para decisão
          </h4>
          <Insights dados={dados} custoTotal={custoTotal} salario={salario} encargos={encargos.total}
            incluirEncargos={incluirEncargos} valorHoraTotal={valorHoraTotal} valorHoraSalario={valorHoraSalario}
            ganhoOculto={calcularGanhoOculto({
              salarioAntes: dados.salarioAnterior?.valor,
              salarioAgora: dados.salario?.valor,
              horasAntes: dados.cargaAnterior ? Number(dados.cargaAnterior.horas_semanais) : null,
              horasAgora: dados.carga ? Number(dados.carga.horas_semanais) : null,
            })} />
        </div>
      </div>

      {/* Timeline salário / carga */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Evolução do salário
          </h4>
          {timelineSalario.length < 2 ? (
            <p className="text-xs text-gray-400 py-8 text-center">Sem histórico suficiente.</p>
          ) : (
            <div className="flex justify-center">
              <LineChart width={420} height={180} data={timelineSalario}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$ ${(v/1000).toFixed(1)}k`} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Line type="monotone" dataKey="salario" stroke={CORES.salario} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Evolução da carga horária
          </h4>
          {timelineCarga.length < 2 ? (
            <p className="text-xs text-gray-400 py-8 text-center">Sem histórico suficiente.</p>
          ) : (
            <div className="flex justify-center">
              <LineChart width={420} height={180} data={timelineCarga}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v} h/sem`} />
                <Line type="monotone" dataKey="horas" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BannerGanhoOculto({ ganho }: { ganho: GanhoOculto }) {
  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-900">Ganho Oculto Detectado</p>
          <p className="text-xs text-amber-700 mt-1 leading-relaxed">
            O salário-base manteve <strong>{fmtBRL(ganho.salarioAgora)}</strong> ({fmtPct(ganho.pctVariacaoSalario, 0)}),
            mas a carga caiu de <strong>{ganho.horasAntes}h → {ganho.horasAgora}h/sem</strong>, elevando o valor-hora
            de <strong>{fmtBRL(ganho.valorHoraAntes)}</strong> para <strong>{fmtBRL(ganho.valorHoraAgora)}</strong>{" "}
            (<span className="text-amber-800 font-semibold">{fmtPct(ganho.pctVariacaoHora)}</span>).
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded border border-amber-200 p-3 text-center">
          <p className="text-[10px] text-amber-600 uppercase font-semibold tracking-wide">Ganho / mês</p>
          <p className="text-base font-bold text-amber-900 mt-0.5">{fmtBRL(ganho.ganhoMensal)}</p>
        </div>
        <div className="bg-white rounded border border-amber-200 p-3 text-center">
          <p className="text-[10px] text-amber-600 uppercase font-semibold tracking-wide">Ganho / ano</p>
          <p className="text-base font-bold text-amber-900 mt-0.5">{fmtBRL(ganho.ganhoAnual)}</p>
        </div>
        <div className="bg-white rounded border border-amber-200 p-3 text-center">
          <p className="text-[10px] text-amber-600 uppercase font-semibold tracking-wide">Aumento implícito</p>
          <p className="text-base font-bold text-amber-900 mt-0.5">{fmtPct(ganho.deltaPct)}</p>
        </div>
      </div>
      <p className="text-[10px] text-amber-600 italic">
        Para manter o mesmo valor-hora de {fmtBRL(ganho.valorHoraAntes)}, o salário deveria ser {fmtBRL(ganho.salarioEquivalente)}.
        Os {fmtBRL(ganho.ganhoMensal)} restantes representam um aumento embutido na redução de carga.
      </p>
    </div>
  );
}

function DateSelector({ refDate, setRefDate, today }: { refDate: string; setRefDate: (d: string) => void; today: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3">
      <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
      <label className="text-sm font-semibold text-gray-700">Data de referência:</label>
      <input
        type="date" value={refDate} onChange={e => setRefDate(e.target.value)}
        className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:border-primary outline-none"
      />
      {refDate !== today && (
        <button onClick={() => setRefDate(today)}
          className="text-xs text-primary font-semibold hover:underline">Voltar a hoje</button>
      )}
    </div>
  );
}

function CardValor({ icone, cor, titulo, valor, variacao, dataVigencia }: {
  icone: React.ReactNode; cor: string; titulo: string; valor: number;
  variacao: { delta: number; pct: number } | null; dataVigencia?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className={`flex items-center gap-1.5 ${cor} mb-1`}>
        {icone}
        <span className="text-xs font-semibold uppercase tracking-wide">{titulo}</span>
      </div>
      <p className="text-lg font-bold text-gray-900">{fmtBRL(valor)}</p>
      {variacao ? (
        <p className={`text-xs font-semibold ${variacao.pct >= 0 ? "text-emerald-600" : "text-red-600"} flex items-center gap-1`}>
          {variacao.pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {fmtPct(variacao.pct)} ({variacao.delta >= 0 ? "+" : ""}{fmtBRL(variacao.delta)})
        </p>
      ) : (
        <p className="text-xs text-gray-400">Sem comparativo anterior</p>
      )}
      {dataVigencia && <p className="text-[10px] text-gray-400 mt-0.5">Vig: {fmtDateBR(dataVigencia)}</p>}
    </div>
  );
}

function CardHoras({ icone, cor, titulo, horas, variacao, dataVigencia, gradeDesc }: {
  icone: React.ReactNode; cor: string; titulo: string; horas: number;
  variacao: { delta: number; pct: number } | null; dataVigencia?: string; gradeDesc: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className={`flex items-center gap-1.5 ${cor} mb-1`}>
        {icone}
        <span className="text-xs font-semibold uppercase tracking-wide">{titulo}</span>
      </div>
      <p className="text-lg font-bold text-gray-900">{horas} h/sem</p>
      {variacao ? (
        <p className={`text-xs font-semibold ${variacao.pct >= 0 ? "text-emerald-600" : "text-red-600"} flex items-center gap-1`}>
          {variacao.pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {fmtPct(variacao.pct)} ({variacao.delta >= 0 ? "+" : ""}{variacao.delta.toFixed(1)} h)
        </p>
      ) : (
        <p className="text-xs text-gray-400">Sem comparativo anterior</p>
      )}
      {dataVigencia && <p className="text-[10px] text-gray-400 mt-0.5">Vig: {fmtDateBR(dataVigencia)}</p>}
      {gradeDesc && <p className="text-[10px] text-gray-500 mt-0.5 truncate" title={gradeDesc}>{gradeDesc}</p>}
    </div>
  );
}

function CardCusto({ icone, titulo, valor, encargos }: {
  icone: React.ReactNode; titulo: string; valor: number; encargos: number | null;
}) {
  return (
    <div className="bg-slate-900 text-white rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-slate-300 mb-1">
        {icone}
        <span className="text-xs font-semibold uppercase tracking-wide">{titulo}</span>
      </div>
      <p className="text-lg font-bold">{fmtBRL(valor)}</p>
      {encargos != null ? (
        <p className="text-xs text-slate-300">Inclui {fmtBRL(encargos)} de encargos</p>
      ) : (
        <p className="text-xs text-slate-400">Sem encargos no total</p>
      )}
    </div>
  );
}

function Insights({ dados, custoTotal, salario, encargos, incluirEncargos, valorHoraTotal, valorHoraSalario, ganhoOculto }: {
  dados: any; custoTotal: number; salario: number; encargos: number;
  incluirEncargos: boolean; valorHoraTotal: number; valorHoraSalario: number;
  ganhoOculto: import("./useDadosAnalise").GanhoOculto | null;
}) {
  const items: { tipo: "ok" | "warn" | "info"; texto: string }[] = [];

  const varSal = variacao(dados.salario?.valor, dados.salarioAnterior?.valor);
  if (varSal) {
    items.push({
      tipo: varSal.pct >= 0 ? "ok" : "warn",
      texto: `Salário ${varSal.pct >= 0 ? "subiu" : "caiu"} ${fmtPct(varSal.pct)} (${fmtBRL(varSal.delta)}) vs vigência anterior.`,
    });
  }

  const varCarga = variacao(
    dados.carga ? Number(dados.carga.horas_semanais) : null,
    dados.cargaAnterior ? Number(dados.cargaAnterior.horas_semanais) : null,
  );

  if (ganhoOculto && ganhoOculto.deltaPct > 0.5 && ganhoOculto.ganhoMensal > 0) {
    items.push({
      tipo: "ok",
      texto: `Com a redução de ${ganhoOculto.horasAntes}h → ${ganhoOculto.horasAgora}h/sem, o valor da hora subiu ${fmtBRL(ganhoOculto.valorHoraAntes)} → ${fmtBRL(ganhoOculto.valorHoraAgora)} (${fmtPct(ganhoOculto.pctVariacaoHora)}), gerando um ganho embutido de ${fmtBRL(ganhoOculto.ganhoMensal)}/mês (${fmtBRL(ganhoOculto.ganhoAnual)}/ano).`,
    });
  } else if (varCarga) {
    items.push({
      tipo: "info",
      texto: `Carga ${varCarga.pct >= 0 ? "aumentou" : "diminuiu"} ${fmtPct(varCarga.pct)} (${varCarga.delta >= 0 ? "+" : ""}${varCarga.delta.toFixed(1)} h/sem).`,
    });
  }
  const varBonif = variacao(dados.bonificacao?.valor, dados.bonificacaoAnterior?.valor);
  if (varBonif && salario > 0) {
    const impactoNoSalario = (varBonif.delta / salario) * 100;
    items.push({
      tipo: varBonif.delta >= 0 ? "ok" : "warn",
      texto: `Bonificação ${varBonif.delta >= 0 ? "aumentou" : "diminuiu"} ${fmtBRL(varBonif.delta)} — impacto de ${fmtPct(impactoNoSalario)} sobre o salário-base.`,
    });
  }

  if (custoTotal > 0 && salario > 0) {
    const pctSalario = (salario / custoTotal) * 100;
    items.push({
      tipo: "info",
      texto: `Salário representa ${pctSalario.toFixed(1)}% do custo total; benefícios + ${incluirEncargos ? "encargos" : "extras"} somam ${(100 - pctSalario).toFixed(1)}%.`,
    });
  }

  if (incluirEncargos && encargos > 0 && salario > 0) {
    const pctEnc = (encargos / salario) * 100;
    items.push({
      tipo: "info",
      texto: `Encargos somam ${fmtBRL(encargos)} (${pctEnc.toFixed(1)}% do salário-base).`,
    });
  }

  if (valorHoraTotal > 0 && valorHoraSalario > 0) {
    const dif = ((valorHoraTotal - valorHoraSalario) / valorHoraSalario) * 100;
    items.push({
      tipo: "info",
      texto: `Custo real por hora é ${fmtPct(dif)} acima do valor-hora do salário puro.`,
    });
  }

  if (items.length === 0) {
    return <p className="text-xs text-gray-400">Cadastre mais histórico para gerar insights de variação.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className={`text-xs leading-snug px-2.5 py-2 rounded border-l-2 ${
          it.tipo === "ok"   ? "bg-emerald-50 border-emerald-400 text-emerald-900" :
          it.tipo === "warn" ? "bg-red-50 border-red-400 text-red-900" :
                               "bg-blue-50 border-blue-400 text-blue-900"
        }`}>{it.texto}</div>
      ))}
    </div>
  );
}

function fmtDateBR(d: string) {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}
