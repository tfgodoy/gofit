import { useState } from "react";
import HistoricoMonetarioSection from "./analise/HistoricoMonetarioSection";
import CargaHorariaSection from "./analise/CargaHorariaSection";
import CustosSection from "./analise/CustosSection";
import ResumoSection from "./analise/ResumoSection";

interface Props {
  staffId: string;
  contractorId: string;
}

type SubTab = "salario" | "passagem" | "ajuda" | "bonificacao" | "carga" | "custos" | "resumo";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "salario",     label: "Histórico Salarial" },
  { id: "passagem",    label: "Passagem" },
  { id: "ajuda",       label: "Ajuda de Custo" },
  { id: "bonificacao", label: "Bonificação" },
  { id: "carga",       label: "Carga Horária" },
  { id: "custos",      label: "Custos" },
  { id: "resumo",      label: "Resumo" },
];

export default function StaffAnaliseTab({ staffId, contractorId }: Props) {
  const [sub, setSub] = useState<SubTab>("salario");

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex border-b border-gray-200 overflow-x-auto -mx-1 px-1">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSub(t.id)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              sub === t.id
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {sub === "salario" && (
          <HistoricoMonetarioSection staffId={staffId} contractorId={contractorId}
            table="staff_salarios" titulo="Histórico salarial" tituloAtual="Salário atual" />
        )}
        {sub === "passagem" && (
          <HistoricoMonetarioSection staffId={staffId} contractorId={contractorId}
            table="staff_passagens" titulo="Histórico de passagem (vale-transporte)" tituloAtual="Passagem atual" />
        )}
        {sub === "ajuda" && (
          <HistoricoMonetarioSection staffId={staffId} contractorId={contractorId}
            table="staff_ajudas_custo" titulo="Histórico de ajuda de custo" tituloAtual="Ajuda de custo atual" />
        )}
        {sub === "bonificacao" && (
          <HistoricoMonetarioSection staffId={staffId} contractorId={contractorId}
            table="staff_bonificacoes" titulo="Histórico de bonificações" tituloAtual="Bonificação atual" />
        )}
        {sub === "carga" && (
          <CargaHorariaSection staffId={staffId} contractorId={contractorId} />
        )}
        {sub === "custos" && (
          <CustosSection staffId={staffId} contractorId={contractorId} />
        )}
        {sub === "resumo" && (
          <ResumoSection staffId={staffId} />
        )}
      </div>
    </div>
  );
}
