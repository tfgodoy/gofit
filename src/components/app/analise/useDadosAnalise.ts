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

export function fmtPct(v: number, digits = 2) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export function variacao(atual: number | undefined | null, anterior: number | undefined | null) {
  if (atual == null || anterior == null || anterior === 0) return null;
  const delta = atual - anterior;
  const pct = (delta / anterior) * 100;
  return { delta, pct };
}
