import { useEffect, useState } from "react";
import { verificarSessoesAluno, ResultadoVerificacao } from "@/hooks/useVerificarSessoes";

interface PainelSessoesSemanaProps {
  contractorId: string;
  studentId: string;
  studentContractId: string;
  contratoDescricao?: string;
  className?: string;
}

/**
 * Painel de progresso visual de sessões da semana
 * Exibe barra de progresso e contagem
 * Usado em ficha do aluno ou dashboard
 */
export function PainelSessoesSemana({
  contractorId,
  studentId,
  studentContractId,
  contratoDescricao = "Contrato",
  className = "",
}: PainelSessoesSemanaProps) {
  const [sessoes, setSessoes] = useState<ResultadoVerificacao | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarSessoes() {
      const hoje = new Date().toISOString().split("T")[0];
      const resultado = await verificarSessoesAluno(
        contractorId,
        studentId,
        studentContractId,
        null, // modalidade_id vazio = busca do contrato inteiro
        hoje
      );
      setSessoes(resultado);
      setLoading(false);
    }

    carregarSessoes();
  }, [contractorId, studentId, studentContractId]);

  if (loading) {
    return (
      <div className={`bg-white border border-gray-200 rounded-xl p-4 ${className}`}>
        <div className="h-6 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!sessoes || sessoes.sessoes_limite === 0) {
    return null;
  }

  const pct = Math.min((sessoes.sessoes_usadas / sessoes.sessoes_limite) * 100, 100);
  const statusColor =
    pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-yellow-500" : "bg-green-500";
  const labelColor =
    pct >= 100 ? "text-red-600" : pct >= 75 ? "text-yellow-600" : "text-green-600";

  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase">
          {contratoDescricao} — Sessões desta semana
        </p>
        <span className={`text-sm font-semibold ${labelColor} whitespace-nowrap`}>
          {sessoes.sessoes_usadas}/{sessoes.sessoes_limite}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all ${statusColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {pct >= 100 && (
        <p className="text-xs text-red-600 mt-2 font-medium">
          ⚠️ Limite semanal atingido
        </p>
      )}

      {sessoes.sessoes_restantes !== undefined && sessoes.sessoes_restantes > 0 && pct < 100 && (
        <p className="text-xs text-gray-500 mt-2">
          {sessoes.sessoes_restantes} aula{sessoes.sessoes_restantes === 1 ? "" : "s"} disponível{sessoes.sessoes_restantes === 1 ? "" : "is"}
        </p>
      )}

      {sessoes.contabilizar_conjunto && (
        <p className="text-xs text-gray-400 mt-2">
          💡 Contabilização conjunta (todas as modalidades)
        </p>
      )}
    </div>
  );
}
