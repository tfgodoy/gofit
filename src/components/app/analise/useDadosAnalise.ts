import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ValorVigente {
  valor: number;
  data_vigencia: string;
  motivo: string;
}

export interface CargaVigente {
  horas_semanais: number;
  data_vigencia: string;
  grade: string | null;
}

export interface DadosVigentes {
  salario: ValorVigente | null;
  salarioAnterior: ValorVigente | null;
  passagem: ValorVigente | null;
  passagemAnterior: ValorVigente | null;
  ajudaCusto: ValorVigente | null;
  ajudaCustoAnterior: ValorVigente | null;
  bonificacao: ValorVigente | null;
  bonificacaoAnterior: ValorVigente | null;
  carga: CargaVigente | null;
  cargaAnterior: CargaVigente | null;
}

async function buscarVigente<T extends { data_vigencia: string }>(
  table: string,
  staffId: string,
  refDate: string,
): Promise<T[]> {
  const { data, error } = await (supabase as any)
    .from(table)
    .select("*")
    .eq("staff_id", staffId)
    .lte("data_vigencia", refDate)
    .order("data_vigencia", { ascending: false })
    .limit(2);
  if (error) throw error;
  return (data ?? []) as T[];
}

export function useDadosAnalise(staffId: string, refDate: string) {
  return useQuery({
    queryKey: ["analise-dados", staffId, refDate],
    queryFn: async (): Promise<DadosVigentes> => {
      const [salarios, passagens, ajudas, bonif, cargas] = await Promise.all([
        buscarVigente<ValorVigente>("staff_salarios", staffId, refDate),
        buscarVigente<ValorVigente>("staff_passagens", staffId, refDate),
        buscarVigente<ValorVigente>("staff_ajudas_custo", staffId, refDate),
        buscarVigente<ValorVigente>("staff_bonificacoes", staffId, refDate),
        buscarVigente<CargaVigente>("staff_cargas_horarias", staffId, refDate),
      ]);
      return {
        salario: salarios[0] ?? null,
        salarioAnterior: salarios[1] ?? null,
        passagem: passagens[0] ?? null,
        passagemAnterior: passagens[1] ?? null,
        ajudaCusto: ajudas[0] ?? null,
        ajudaCustoAnterior: ajudas[1] ?? null,
        bonificacao: bonif[0] ?? null,
        bonificacaoAnterior: bonif[1] ?? null,
        carga: cargas[0] ?? null,
        cargaAnterior: cargas[1] ?? null,
      };
    },
    enabled: !!staffId && !!refDate,
  });
}

export interface Encargos {
  decimo_terceiro: number;
  um_terco_ferias: number;
  fgts: number;
  inss_patronal: number;
  total: number;
}

export function calcularEncargos(salario: number, tipoContrato: string | null): Encargos {
  const isCLT = (tipoContrato ?? "").toLowerCase() === "clt";
  const decimo_terceiro = salario / 12;
  const um_terco_ferias = salario / 36;
  const fgts = isCLT ? salario * 0.08 : 0;
  const inss_patronal = isCLT ? salario * 0.20 : 0;
  return {
    decimo_terceiro,
    um_terco_ferias,
    fgts,
    inss_patronal,
    total: decimo_terceiro + um_terco_ferias + fgts + inss_patronal,
  };
}

export function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export interface Periodo {
  id: string;
  dias: string[];
  hora_inicio: string;
  hora_fim: string;
}

const DIAS_LABELS: Record<string, string> = {
  mon: "Seg", tue: "Ter", wed: "Qua", thu: "Qui", fri: "Sex", sat: "Sáb", sun: "Dom",
};
const DOW_ORDER: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

export function parseGrade(raw: unknown): Periodo[] {
  if (!raw) return [];
  let arr: any = raw;
  if (typeof raw === "string") {
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(p => p && typeof p === "object")
    .map(p => ({
      id: typeof p.id === "string" ? p.id : "",
      dias: Array.isArray(p.dias) ? p.dias.filter((d: any) => typeof d === "string") : [],
      hora_inicio: typeof p.hora_inicio === "string" ? p.hora_inicio : "00:00",
      hora_fim: typeof p.hora_fim === "string" ? p.hora_fim : "00:00",
    }));
}

export function descricaoGrade(periodos: Periodo[]): string {
  if (!periodos || periodos.length === 0) return "";
  return periodos
    .filter(p => p.dias.length > 0)
    .map(p => {
      const dias = [...p.dias]
        .sort((a, b) => (DOW_ORDER[a] ?? 99) - (DOW_ORDER[b] ?? 99))
        .map(d => DIAS_LABELS[d] ?? d).join("/");
      return `${dias} ${p.hora_inicio}–${p.hora_fim}`;
    }).join("; ");
}

export function fmtPct(v: number, digits = 2) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export function variacao(atual: number | undefined | null, anterior: number | undefined | null) {
  if (atual == null || anterior == null || anterior === 0) return null;
  const delta = atual - anterior;
  const pct = (delta / anterior) * 100;
  return { delta, pct };
}

export const SEMANAS_MES = 4.33;

export interface GanhoOculto {
  salarioAntes: number;
  salarioAgora: number;
  horasAntes: number;
  horasAgora: number;
  valorHoraAntes: number;
  valorHoraAgora: number;
  salarioEquivalente: number;       // salário que manteria o mesmo valor/hora com a nova carga
  ganhoMensal: number;              // salarioAgora - salarioEquivalente
  ganhoAnual: number;
  pctVariacaoHora: number;          // variação % do valor/hora
  pctVariacaoSalario: number;       // variação % do salário base
  deltaPct: number;                 // (pctHora - pctSalario): "aumento implícito"
}

export function calcularGanhoOculto(params: {
  salarioAntes: number | null | undefined;
  salarioAgora: number | null | undefined;
  horasAntes: number | null | undefined;
  horasAgora: number | null | undefined;
}): GanhoOculto | null {
  const sa = Number(params.salarioAntes ?? 0);
  const sn = Number(params.salarioAgora ?? 0);
  const ha = Number(params.horasAntes ?? 0);
  const hn = Number(params.horasAgora ?? 0);
  if (sa <= 0 || sn <= 0 || ha <= 0 || hn <= 0) return null;
  const valorHoraAntes = sa / (ha * SEMANAS_MES);
  const valorHoraAgora = sn / (hn * SEMANAS_MES);
  const salarioEquivalente = valorHoraAntes * hn * SEMANAS_MES;
  const ganhoMensal = sn - salarioEquivalente;
  const ganhoAnual = ganhoMensal * 12;
  const pctVariacaoHora = ((valorHoraAgora - valorHoraAntes) / valorHoraAntes) * 100;
  const pctVariacaoSalario = ((sn - sa) / sa) * 100;
  const deltaPct = pctVariacaoHora - pctVariacaoSalario;
  return {
    salarioAntes: sa, salarioAgora: sn, horasAntes: ha, horasAgora: hn,
    valorHoraAntes, valorHoraAgora, salarioEquivalente,
    ganhoMensal, ganhoAnual, pctVariacaoHora, pctVariacaoSalario, deltaPct,
  };
}
