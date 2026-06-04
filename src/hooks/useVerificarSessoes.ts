import { supabase } from "@/integrations/supabase/client";

export interface ResultadoVerificacao {
  permitido: boolean;
  motivo: string;
  sessoes_usadas: number;
  sessoes_limite: number;
  sessoes_restantes?: number;
  tipo_acesso?: string;
  contabilizar_conjunto?: boolean;
  periodo_inicio?: string;
  periodo_fim?: string;
}

/**
 * Verifica se um aluno pode fazer mais uma aula no contrato/modalidade
 * Chama a função SQL `verificar_sessoes_aluno`
 */
export async function verificarSessoesAluno(
  contractorId: string,
  studentId: string,
  studentContractId: string,
  modalidadeId: string | null = null,
  dataAula: string = new Date().toISOString().split("T")[0]
): Promise<ResultadoVerificacao> {
  try {
    const { data, error } = await supabase.rpc("verificar_sessoes_aluno", {
      p_contractor_id: contractorId,
      p_student_id: studentId,
      p_student_contract_id: studentContractId,
      p_modalidade_id: modalidadeId,
      p_data_aula: dataAula,
    });

    if (error) {
      console.error("Erro ao verificar sessões:", error);
      return {
        permitido: true,
        motivo: "Erro na verificação (permitindo por padrão)",
        sessoes_usadas: 0,
        sessoes_limite: 0,
      };
    }

    return (data as ResultadoVerificacao) ?? {
      permitido: true,
      motivo: "Sem limite configurado",
      sessoes_usadas: 0,
      sessoes_limite: 0,
    };
  } catch (err) {
    console.error("Erro crítico ao verificar sessões:", err);
    return {
      permitido: true,
      motivo: "Erro crítico (permitindo por padrão)",
      sessoes_usadas: 0,
      sessoes_limite: 0,
    };
  }
}

/**
 * Hook React para usar verificação de sessões (ex: em componentes)
 */
export function useVerificarSessoes() {
  return { verificarSessoesAluno };
}
