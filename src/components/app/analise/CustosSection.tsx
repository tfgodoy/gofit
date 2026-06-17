import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDadosAnalise, calcularEncargos, fmtBRL } from "./useDadosAnalise";
import { Loader2, Calculator, Info } from "lucide-react";
import { toast } from "sonner";

interface Props {
  staffId: string;
  contractorId: string;
}

const TIPOS_CONTRATO = [
  { value: "clt",        label: "CLT" },
  { value: "pj",         label: "PJ" },
  { value: "autonomo",   label: "Autônomo" },
  { value: "estagiario", label: "Estagiário" },
  { value: "mei",        label: "MEI" },
];

export default function CustosSection({ staffId }: Props) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: dados, isLoading: loadingDados } = useDadosAnalise(staffId, today);

  const { data: staff, isLoading: loadingStaff } = useQuery({
    queryKey: ["staff-config", staffId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("staff")
        .select("tipo_contrato, incluir_encargos_no_custo")
        .eq("id", staffId).single();
      if (error) throw error;
      return data as { tipo_contrato: string; incluir_encargos_no_custo: boolean };
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: { tipo_contrato?: string; incluir_encargos_no_custo?: boolean }) => {
      const { error } = await (supabase as any).from("staff").update(patch).eq("id", staffId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-config", staffId] });
      qc.invalidateQueries({ queryKey: ["analise-dados", staffId] });
      toast.success("Configuração salva.");
    },
    onError: () => toast.error("Erro ao salvar."),
  });

  if (loadingDados || loadingStaff) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>;
  }

  const salario = dados?.salario?.valor ?? 0;
  const tipoContrato = (staff?.tipo_contrato ?? "").toLowerCase();
  const incluirEncargos = staff?.incluir_encargos_no_custo ?? false;
  const enc = calcularEncargos(salario, tipoContrato);
  const isCLT = tipoContrato === "clt";

  return (
    <div className="space-y-5">
      {/* Configurações */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold text-gray-700">Configuração de custos</h4>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo de contrato</label>
            <select
              value={tipoContrato}
              onChange={e => updateMutation.mutate({ tipo_contrato: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white outline-none focus:border-primary"
            >
              {TIPOS_CONTRATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={incluirEncargos}
                onChange={e => updateMutation.mutate({ incluir_encargos_no_custo: e.target.checked })}
                className="accent-primary w-4 h-4"
              />
              <span className="text-gray-700">Somar encargos no custo total</span>
            </label>
          </div>
        </div>
        <p className="text-xs text-gray-500 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          Os encargos abaixo são sempre calculados para visualização. O toggle controla apenas se eles entram no custo total mostrado no Resumo.
          {!isCLT && " Para PJ/Autônomo/MEI, FGTS e INSS patronal são zerados."}
        </p>
      </div>

      {/* Base de cálculo */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-500">Base de cálculo (salário atual)</p>
        <p className="text-xl font-bold text-gray-900">{fmtBRL(salario)}</p>
      </div>

      {/* Encargos mensais */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Encargos mensais</h4>
        <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
          <Linha label="13º salário (provisão mensal)" desc="Salário ÷ 12" valor={enc.decimo_terceiro} />
          <Linha label="1/3 de férias (provisão mensal)" desc="Salário ÷ 36" valor={enc.um_terco_ferias} />
          <Linha label="FGTS (8%)" desc={isCLT ? "8% sobre salário" : "Não aplicável fora de CLT"} valor={enc.fgts} ativo={isCLT} />
          <Linha label="INSS patronal (20%)" desc={isCLT ? "20% sobre salário" : "Não aplicável fora de CLT"} valor={enc.inss_patronal} ativo={isCLT} />
          <div className="flex items-center justify-between px-4 py-3 bg-primary/5">
            <div>
              <p className="text-sm font-bold text-gray-900">Total de encargos / mês</p>
              <p className="text-xs text-gray-500">Soma das provisões acima</p>
            </div>
            <span className="text-base font-bold text-primary">{fmtBRL(enc.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Linha({ label, desc, valor, ativo = true }: { label: string; desc: string; valor: number; ativo?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${ativo ? "bg-white" : "bg-gray-50"}`}>
      <div>
        <p className={`text-sm ${ativo ? "text-gray-800 font-medium" : "text-gray-400"}`}>{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <span className={`text-sm font-semibold ${ativo ? "text-gray-900" : "text-gray-400"}`}>{fmtBRL(valor)}</span>
    </div>
  );
}
